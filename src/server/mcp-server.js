// src/server/mcp-server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getProvider } from "../providers/index.js";
import { log } from "../utils/log.js";
import { z } from "zod";
import { newTask, loadTask, saveTask, transition, deleteTask } from "../workflow/task-manager.js";
import { parseC2C } from "../protocol/parser.js";
import { validate } from "../protocol/validator.js";
import { planPrompt, reviewPrompt } from "../deepseek/prompts.js";
import { repoContext, git, clip, checkpoint } from "../utils/git.js";
import { MAX_ITERATIONS } from "../protocol/states.js";

const server = new McpServer({ name: "c2c-agent", version: "0.2.0" });
const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: "text", text: `ERROR: ${msg}` }] });

// ── Helper tự động Retry khi AI quên chuẩn C2C ─────────
async function askWithRetry(providerInstance, page, initialPrompt, task_id, allowedStates) {
  let prompt = initialPrompt;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    const before = await providerInstance.countAnswers(page);
    await providerInstance.sendPrompt(page, prompt);
    const raw = await providerInstance.waitForAnswer(page, before);
    try {
      const msg = parseC2C(raw);
      const errs = validate(msg, { taskId: task_id, allowed: allowedStates });
      if (errs.length) throw new Error(errs.join("; "));
      return msg; // Thành công
    } catch (e) {
      log(task_id, `Lỗi protocol (lần ${attempts + 1}): ${e.message}`);
      attempts++;
      if (attempts >= maxAttempts) throw new Error("AI liên tục trả lời sai protocol. Hủy bỏ: " + e.message);
      prompt = "Your last response failed validation. You MUST answer ONLY with the <<<C2C_BEGIN>>>...<<<C2C_END>>> block containing the correct STATE and required fields. DO NOT include normal conversation text.";
    }
  }
}

// ── Handler cho PLAN ──────────────────────────────────────────────────────────
const planHandler = async ({ task_id, task, repository, constraints, provider: explicitProvider }) => {
  try {
    const providerInstance = getProvider(explicitProvider);
    const providerName = providerInstance.name;

    const t = newTask({ taskId: task_id, requirement: task, repository });
    transition(t, "WAITING_FOR_PLAN");

    // Mở hội thoại mới cho mỗi lần PLAN
    const page = await providerInstance.getPage(null, { newChat: true });

    // Kiểm tra hostname khớp provider kỳ vọng
    const currentUrl = page.url();
    const hostname = new URL(currentUrl).hostname;
    const tab_title = await page.title();
    const expectedHostname = providerInstance.getExpectedHostname();
    if (hostname !== expectedHostname && !hostname.endsWith('.' + expectedHostname)) {
      throw new Error(`LỖI HOSTNAME: Tab đang mở '${hostname}', không khớp với hostname kỳ vọng '${expectedHostname}' của provider '${providerName}'. Dừng lại.`);
    }

    const msg = await askWithRetry(providerInstance, page, planPrompt({
      taskId: task_id, messageId: `${task_id}_plan`, requirement: task, constraints,
      context: await repoContext(repository),
      executor: providerName,
    }), task_id, ["PLAN_APPROVED", "PLAN_REJECTED"]);

    // Lưu conversationUrl theo từng provider
    t.conversationUrls = t.conversationUrls || {};
    t.conversationUrls[providerName] = page.url();
    t.conversationUrl = page.url(); // backward compat
    t.lastMessage = msg;
    transition(t, msg.STATE, "plan");

    return ok({
      provider: providerName,
      hostname,
      tab_title,
      message_id: msg.MESSAGE_ID,
      task_id,
      state: msg.STATE,
      iteration: 0,
      plan: msg.PLAN || msg.ISSUES,
    });
  } catch (e) { return fail(e.message); }
};

// ── Handler cho REVIEW ────────────────────────────────────────────────────────
const MAX_DIFF = 40000, MAX_TEST = 8000;
const reviewHandler = async ({ task_id, test_output, git_diff, provider: explicitProvider }) => {
  try {
    const providerInstance = getProvider(explicitProvider);
    const providerName = providerInstance.name;

    const t = loadTask(task_id);
    if (!t) throw new Error("Task không tồn tại");
    if (["PLAN_APPROVED", "REVIEW_FAILED"].includes(t.state)) transition(t, "CODING");

    t.iteration += 1;
    transition(t, "REVIEWING", `iteration ${t.iteration}`);
    await checkpoint(t.repository, task_id, t.iteration); // Tự động tạo git tag để rollback

    const bundle = [
      "===== GIT STATUS =====\n" + clip(await git(t.repository, ["status", "--short"]), 4000),
      "===== GIT DIFF =====\n" + clip(git_diff ?? await git(t.repository, ["diff", "HEAD~1"]), MAX_DIFF),
      "===== TEST OUTPUT =====\n" + clip(test_output, MAX_TEST),
    ].join("\n\n");

    // Dùng conversationUrl của provider hiện tại (fallback sang conversationUrl cũ)
    const convUrl = (t.conversationUrls?.[providerName]) || t.conversationUrl;

    const page = await providerInstance.getPage(convUrl);

    // Kiểm tra hostname khớp provider kỳ vọng
    const currentUrl = page.url();
    const hostname = new URL(currentUrl).hostname;
    const tab_title = await page.title();
    const expectedHostname = providerInstance.getExpectedHostname();
    if (hostname !== expectedHostname && !hostname.endsWith('.' + expectedHostname)) {
      throw new Error(`LỖI HOSTNAME: Tab đang mở '${hostname}', không khớp với hostname kỳ vọng '${expectedHostname}' của provider '${providerName}'. Dừng lại.`);
    }

    const msg = await askWithRetry(providerInstance, page, reviewPrompt({
      taskId: task_id, messageId: `${task_id}_rev${t.iteration}`,
      iteration: t.iteration, requirement: t.requirement,
      // Nếu đổi provider lúc review, đính kèm lại PLAN để giữ ngữ cảnh
      plan: (convUrl !== t.conversationUrl) ? (t.lastMessage?.PLAN || '') : undefined,
      bundle,
      executor: providerName,
    }), task_id, ["REVIEW_FAILED", "REVIEW_PASSED"]);

    // Cập nhật conversationUrl cho provider hiện tại
    t.conversationUrls = t.conversationUrls || {};
    t.conversationUrls[providerName] = page.url();
    t.conversationUrl = page.url();
    t.lastMessage = msg;
    transition(t, msg.STATE, "review");

    const baseResult = {
      provider: providerName,
      hostname,
      tab_title,
      iteration: t.iteration,
    };

    if (msg.STATE === "REVIEW_FAILED" && t.iteration >= MAX_ITERATIONS) {
      transition(t, "MAX_ITERATIONS");
      return ok({ ...baseResult, state: "MAX_ITERATIONS", issues: msg.ISSUES, note: "Giới hạn lặp. Dừng." });
    }
    if (msg.STATE === "REVIEW_PASSED") {
      transition(t, "DONE");
      return ok({ ...baseResult, state: "REVIEW_PASSED", summary: msg.SUMMARY, tests: msg.TESTS });
    }
    return ok({ ...baseResult, state: "REVIEW_FAILED", issues: msg.ISSUES, required_fixes: msg.REQUIRED_FIXES });
  } catch (e) { return fail(e.message); }
};

const planSchema = {
  task_id: z.string(),
  task: z.string(),
  repository: z.string(),
  constraints: z.string().optional(),
  provider: z.string().optional().describe("Provider chat ('muse' hoặc 'deepseek'). Mặc định lấy từ env PROVIDER."),
};

const reviewSchema = {
  task_id: z.string(),
  test_output: z.string(),
  git_diff: z.string().optional(),
  provider: z.string().optional().describe("Provider chat ('muse' hoặc 'deepseek'). Mặc định lấy từ env PROVIDER."),
};

// Đăng ký tools c2c (nhận provider linh hoạt)
server.tool("c2c_plan", planSchema, planHandler);
server.tool("c2c_review", reviewSchema, reviewHandler);

// Đăng ký tools deepseek (cố định provider deepseek)
server.tool("deepseek_plan", planSchema, (args) => planHandler({ ...args, provider: "deepseek" }));
server.tool("deepseek_review", reviewSchema, (args) => reviewHandler({ ...args, provider: "deepseek" }));

server.tool("get_c2c_status", { task_id: z.string() }, async ({ task_id }) => {
  const t = loadTask(task_id); return t ? ok({ state: t.state, iteration: t.iteration, last_message: t.lastMessage }) : fail("not found");
});
server.tool("reset_c2c_task", { task_id: z.string() }, async ({ task_id }) => { deleteTask(task_id); return ok({ reset: task_id }); });
server.tool("complete_c2c_task", { task_id: z.string() }, async ({ task_id }) => {
  const t = loadTask(task_id); if (!t) return fail("not found");
  t.state = "DONE"; saveTask(t); return ok({ state: "DONE" });
});

await server.connect(new StdioServerTransport());
log("server", `c2c-agent started | default env PROVIDER: ${process.env.PROVIDER || process.env.CHAT_PROVIDER || '(chưa đặt, cần truyền qua tool hoặc env)'}`);