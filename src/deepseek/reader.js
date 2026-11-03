// src/deepseek/reader.js
import { SEL } from "./selectors.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const C2C_END = "<<<C2C_END>>>";

export async function countAnswers(page) {
  return page.$$eval(SEL.answer, (els) => els.length);
}

export async function waitForAnswer(page, before, { timeoutMs = 300000, marker = C2C_END } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await page.$$eval(SEL.answer, (els) => ({
      n: els.length,
      text: els.length ? els[els.length - 1].innerText : "",
    }));
    if (info.n > before && info.text.includes(marker)) return info.text;
    await sleep(1500);
  }
  throw new Error("TIMEOUT: DeepSeek không trả lời kịp");
}

// Dùng cho PoC (không có marker): đợi text ổn định
export async function waitForStableAnswer(page, before, { timeoutMs = 120000, stableMs = 4000 } = {}) {
  const start = Date.now();
  let last = "", since = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await page.$$eval(SEL.answer, (els) => ({
      n: els.length,
      text: els.length ? els[els.length - 1].innerText : "",
    }));
    if (info.n > before && info.text) {
      if (info.text !== last) { last = info.text; since = Date.now(); }
      else if (Date.now() - since >= stableMs) return info.text;
    }
    await sleep(1000);
  }
  throw new Error("TIMEOUT");
}