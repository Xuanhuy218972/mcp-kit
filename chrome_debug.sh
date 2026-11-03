#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "          DANG KHOI DONG CHROME DEBUG (PORT 9222) - UBUNTU/LINUX"
echo "======================================================================"

# 1. Tim binary Google Chrome hoac Chromium theo thu tu uu tien
CHROME_BIN=""
for bin in google-chrome chromium-browser chromium; do
    if command -v "$bin" >/dev/null 2>&1; then
        CHROME_BIN="$(command -v "$bin")"
        break
    fi
done

if [ -z "$CHROME_BIN" ]; then
    echo "[LOI] Khong tim thay trinh duyet google-chrome, chromium-browser hoac chromium tren he thong!"
    echo "Vui long cai dat truoc khi tiep tuc."
    exit 1
fi

echo "Da tim thay trinh duyet: $CHROME_BIN"

# 2. Kiem tra truoc bang curl http://127.0.0.1:9222/json/version, neu da chay thi khong mo them
if curl -s --connect-timeout 1 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    echo "[THONG BAO] Chrome Debug port 9222 da dang chay san tren may!"
    exit 0
fi

# 3. Profile: $HOME/.config/c2c/chrome-profile, tao thu muc neu chua co
PROFILE_DIR="$HOME/.config/c2c/chrome-profile"
mkdir -p "$PROFILE_DIR"
echo "Dang mo Chrome tren cong 9222 voi profile tai $PROFILE_DIR..."

# 4. Neu chua chay thi mo Chrome
"$CHROME_BIN" \
    --remote-debugging-port=9222 \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run \
    --no-default-browser-check \
    https://chat.deepseek.com \
    https://muse.ai >/dev/null 2>&1 &

# 5. Cho toi da 5 giay cho cong 9222 phan hoi
READY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -s --connect-timeout 1 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.5
done

if [ $READY -eq 1 ]; then
    echo "[THANH CONG] Chrome Debug da san sang tren cong 9222!"
else
    echo "[CANH BAO] Chrome dang khoi dong, vui long kiem tra cua so trinh duyet tren man hinh."
fi

echo "======================================================================"
echo "Luu y: Vui long dang nhap DeepSeek va Muse tren cua so Chrome vua mo."
echo "Du lieu session se duoc luu lai tai $PROFILE_DIR."
echo "======================================================================"
