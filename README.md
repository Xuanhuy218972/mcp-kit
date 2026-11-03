# C2C-Agent MCP Server (`c2c-agent` v0.2.0)

Bộ MCP Server triển khai mô hình **C2C (Chat-to-Code / Controller-to-Coder)** chạy trên nền tảng **Node.js (ESM)**, kết nối giao thức **Stdio** phục vụ cho **Antigravity IDE**.

Trong mô hình này, các mô hình ngôn ngữ lớn (LLM) như **Muse (muse.ai)** hoặc **DeepSeek (chat.deepseek.com)** chỉ đóng vai trò là **PLANNER** (lập kế hoạch kiến trúc, phản biện yêu cầu) và **REVIEWER** (đánh giá diff, log kiểm thử, duyệt chất lượng mã nguồn). AI **KHÔNG** chỉnh sửa trực tiếp các tệp tin trong repository; việc sửa code và chạy test được thực hiện bởi Coding Agent hoặc nhà phát triển cục bộ.

---

## ⚠️ 3 CẢNH BÁO QUAN TRỌNG

1. **KHÔNG DÙNG API KEY — ĐIỀU KHIỂN TRÌNH DUYỆT QUA CDP CỔNG 9222**:
   Hệ thống không sử dụng REST API hay token bản quyền. MCP Server kết nối trực tiếp vào phiên duyệt web đã đăng nhập tài khoản của bạn thông qua **Chrome DevTools Protocol (CDP)** tại cổng `http://127.0.0.1:9222`. Bạn bắt buộc phải khởi động Chrome bằng script (`Chrome_Debug.bat` trên Windows hoặc `chrome_debug.sh` trên Ubuntu) trước khi gọi các tool của MCP.
2. **KHÔNG CÓ TỰ ĐỘNG CHUYỂN ĐỔI DỰ PHÒNG (NO AUTO-FALLBACK)**:
   Mã nguồn hoàn toàn **KHÔNG** tự động chuyển từ Muse sang DeepSeek khi xảy ra lỗi (mất mạng, timeout, captcha, sai cấu trúc hợp đồng...). Nếu muốn chuyển sang DeepSeek, người dùng phải chủ động:
   - Gọi trực tiếp tool `deepseek_plan` hoặc `deepseek_review`.
   - Hoặc truyền tham số `provider: "deepseek"` khi gọi tool `c2c_plan` / `c2c_review`.
   - Hoặc đặt biến môi trường `PROVIDER=deepseek`.
3. **KHÔNG CÓ THƯ VIỆN DOTENV — FILE `.env` KHÔNG TỰ ĐỘNG LOAD**:
   Dự án không cài đặt và không sử dụng `dotenv`. Việc tạo file `.env` trên đĩa sẽ **không** có tác dụng trong runtime. Toàn bộ biến môi trường phải được khai báo trong trường `"env"` của file cấu hình MCP trong IDE (`mcp_config.json`) hoặc được `export` sẵn trong môi trường shell trước khi mở IDE.

---

## 🛠️ DANH SÁCH 7 MCP TOOLS

| Tên Tool | Tham số chính | Chức năng & Trạng thái FSM |
| :--- | :--- | :--- |
| `c2c_plan` | `task_id`, `task`, `repository`, `constraints` (opt), `provider` (opt) | Mở hội thoại mới trên tab provider (Muse hoặc DeepSeek), gửi requirement và ngữ cảnh repo (`AGENTS.md`, `git ls-files`). Nhận phản hồi dạng hợp đồng C2C: chuyển sang `PLAN_APPROVED` hoặc `PLAN_REJECTED`. |
| `c2c_review` | `task_id`, `test_output`, `git_diff` (opt), `provider` (opt) | Tự động tạo git checkpoint (branch `c2c/<taskId>` và tag `iteration-<N>`), gửi bundle (git status, diff, test output) vào đúng URL hội thoại trước đó. Nhận `REVIEW_PASSED` (chuyển sang `DONE`) hoặc `REVIEW_FAILED`. Nếu chạm mốc `MAX_ITERATIONS` sẽ chuyển sang `MAX_ITERATIONS`. |
| `deepseek_plan` | `task_id`, `task`, `repository`, `constraints` (opt) | Wrapper gọi `c2c_plan` với provider cố định là `deepseek`. |
| `deepseek_review` | `task_id`, `test_output`, `git_diff` (opt) | Wrapper gọi `c2c_review` với provider cố định là `deepseek`. |
| `get_c2c_status` | `task_id` | Đọc tệp `tasks/active/<task_id>.json` và trả về trạng thái hiện tại (`state`, `iteration`, `last_message`). |
| `reset_c2c_task` | `task_id` | Xóa tệp JSON lưu trạng thái task trong thư mục `tasks/active/`. |
| `complete_c2c_task` | `task_id` | Cưỡng chế chuyển trạng thái task sang `DONE`. |

### Quy tắc vòng đời & Thời gian chờ (Timeouts & Retries)
- **Giới hạn vòng lặp (`MAX_ITERATIONS`)**: Tối đa `5` lần review lặp lại. Nếu lần thứ 5 vẫn `REVIEW_FAILED`, task dừng khẩn cấp ở trạng thái `MAX_ITERATIONS`.
- **Timeout chờ câu trả lời (`waitForAnswer`)**: `300,000ms` (5 phút) cho cả Muse và DeepSeek.
- **Timeout điều hướng trang (`getPage`)**: `30,000ms` (30 giây).
- **Timeout chờ ô chat (`waitForSelector`)**: `20,000ms` đến `30,000ms`.
- **Tự động Retry cú pháp**: Tối đa `2` lần nếu AI trả lời thiếu khối hợp đồng `<<<C2C_BEGIN>>>...<<<C2C_END>>>` hoặc thiếu trường bắt buộc.

---

## 📦 DEPENDENCIES & PHIÊN BẢN

- **Runtime**: Node.js (hỗ trợ ECMAScript Modules `"type": "module"`)
- **Dependencies chính thức**:
  - `@modelcontextprotocol/sdk`: `^1.31.0` (Giao thức chuẩn MCP Server qua Stdio)
  - `puppeteer-core`: `^25.12.0` (Tương tác Chrome DevTools Protocol không tải kèm Chromium)
  - `zod`: `^4.6.5` (Validate schema input của MCP Tools)

---

## 📁 CẤU TRÚC REPOSITORY

```text
mcp-kit/
├── .env.example                                  # Hướng dẫn khai báo biến môi trường (không dùng dotenv)
├── .gitignore                                    # Loại bỏ logs, node_modules, profiles, tasks JSON
├── Chrome_Debug.bat                              # Launcher khởi động Chrome Debug trên Windows
├── chrome_debug.sh                               # Launcher khởi động Chrome Debug trên Ubuntu/Linux (LF)
├── package.json                                  # Khai báo thư viện và script
├── package-lock.json                             # Khóa phiên bản dependencies
├── README.md                                     # Tài liệu hướng dẫn sử dụng và vận hành
├── antigravity/
│   ├── mcp_config.windows.example.json           # File cấu hình mẫu MCP cho Antigravity trên Windows
│   └── mcp_config.linux.example.json             # File cấu hình mẫu MCP cho Antigravity trên Linux
├── docs/
│   └── PLAN_MUSE.md                              # Bản thiết kế kiến trúc chi tiết C2C + Muse
├── src/
│   ├── deepseek/                                 # Puppeteer automation cho DeepSeek Web
│   ├── protocol/                                 # Parser, validator, states của C2C contract
│   ├── providers/                                # Base provider, Muse adapter, DeepSeek adapter, Factory
│   ├── server/
│   │   └── mcp-server.js                         # Entrypoint chạy MCP server
│   ├── utils/                                    # Git helper, logger, path resolver
│   └── workflow/                                 # FSM state machine và task manager
└── tasks/
    └── active/
        └── .gitkeep                              # Thư mục rỗng lưu trữ task JSON trong phiên làm việc
```

> **Ghi chú**: Các scripts kiểm thử nội bộ (`scripts/`) sẽ được bổ sung ở các commit riêng sau khi chuẩn hóa.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY TRÊN WINDOWS

1. **Cài đặt dependencies**:
   ```cmd
   cd C:\REPO_HOCTAP\mcp-kit
   npm install
   ```
2. **Khởi động Chrome Debug**:
   - Chạy file `Chrome_Debug.bat`. Trình duyệt Google Chrome sẽ mở với cổng debug 9222 và profile tại `C:\c2c\chrome-profile`.
   - Đăng nhập tài khoản của bạn trên cả 2 tab: [Muse.ai](https://muse.ai) và [DeepSeek](https://chat.deepseek.com).
3. **Cấu hình Antigravity IDE**:
   - Tham khảo tệp `antigravity\mcp_config.windows.example.json`.
   - Cập nhật cấu hình MCP trong IDE trỏ tới:
     ```json
     {
       "mcpServers": {
         "c2c-agent": {
           "command": "node",
           "args": ["C:\\REPO_HOCTAP\\mcp-kit\\src\\server\\mcp-server.js"],
           "env": {
             "PROVIDER": "muse",
             "MUSE_URL": "https://muse.ai/",
             "DEEPSEEK_URL": "https://chat.deepseek.com/"
           }
         }
       }
     }
     ```

---

## 🐧 HƯỚNG DẪN CÀI ĐẶT & CHẠY TRÊN UBUNTU / LINUX

1. **Cài đặt trình duyệt & Node.js**:
   ```bash
   sudo apt update
   sudo apt install -y google-chrome-stable   # hoặc: sudo apt install -y chromium-browser
   npm install
   ```
2. **Khởi động Chrome Debug**:
   - Cấp quyền thực thi và chạy script:
     ```bash
     chmod +x chrome_debug.sh
     ./chrome_debug.sh
     ```
   - **ĐĂNG NHẬP LẠI TÀI KHOẢN**: Vì thư mục profile của Windows (`C:\c2c\chrome-profile`) không tương thích trực tiếp sang cấu trúc Linux, script Linux sẽ sử dụng profile riêng tại `$HOME/.config/c2c/chrome-profile`. Bạn **bắt buộc phải đăng nhập lại** Muse.ai và DeepSeek trên cửa sổ Chrome vừa mở.
3. **Cấu hình Antigravity IDE**:
   - Tham khảo tệp `antigravity\mcp_config.linux.example.json`.
   - Thay thế `<username>` bằng tên tài khoản người dùng Ubuntu của bạn:
     ```json
     {
       "mcpServers": {
         "c2c-agent": {
           "command": "node",
           "args": ["/home/<username>/mcp-kit/src/server/mcp-server.js"],
           "env": {
             "PROVIDER": "muse",
             "MUSE_URL": "https://muse.ai/",
             "DEEPSEEK_URL": "https://chat.deepseek.com/"
           }
         }
       }
     }
     ```

---

## 🔧 KHẮC PHỤC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

1. **Lỗi `LỖI KẾT NỐI: Không tìm thấy Chrome`**:
   - Kiểm tra xem cổng 9222 đã mở chưa bằng cách truy cập: `http://127.0.0.1:9222/json/version` trên trình duyệt hoặc chạy `curl http://127.0.0.1:9222/json/version`.
   - Đảm bảo script debug (`Chrome_Debug.bat` hoặc `chrome_debug.sh`) vẫn đang chạy nền.
2. **Lỗi `LỖI GIAO DIỆN / ĐĂNG NHẬP: Không tìm thấy ô chat`**:
   - Giao diện web của Muse hoặc DeepSeek có thể đã cập nhật selector DOM, hoặc trang web đang hiện hộp thoại Captcha / Cloudflare / phiên đăng nhập đã hết hạn. Hãy chuyển qua cửa sổ Chrome kiểm tra trực tiếp.
3. **Task bị kẹt trạng thái `MAX_ITERATIONS`**:
   - Khi task đã lặp quá 5 vòng review không đạt, FSM sẽ khóa task.
   - Để làm lại: Gọi tool `reset_c2c_task` với `task_id` tương ứng để xóa file trạng thái cũ và bắt đầu lại từ `c2c_plan`.
   - Để chấp nhận code hiện tại: Gọi tool `complete_c2c_task` để đưa trạng thái về `DONE`.
