// src/deepseek/sender.js
import { SEL } from "./selectors.js";

export async function sendPrompt(page, text) {
  try {
    // Đợi ô input xuất hiện tối đa 30s
    await page.waitForSelector(SEL.input, { timeout: 30000 });
  } catch (error) {
    throw new Error("LỖI GIAO DIỆN: Không tìm thấy ô chat. Có thể DeepSeek đang yêu cầu giải Captcha hoặc bạn đã bị đăng xuất. Mở Chrome lên kiểm tra ngay!");
  }
  
  await page.evaluate((sel, t) => {
    const el = document.querySelector(sel);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, t);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, SEL.input, text);
  await page.focus(SEL.input);
  await page.keyboard.press("Enter");
}