// src/providers/muse-adapter.js
// Muse.ai ChatProvider adapter — dùng các selector thực tế đã khảo sát

import { ChatProvider } from './base.js';
import { getBrowser } from '../deepseek/browser.js'; // tái dùng CDP connect singleton

export const MUSE_HOME = process.env.MUSE_URL || 'https://muse.ai/';
export const C2C_END = '<<<C2C_END>>>';

// ─── Selectors thực tế từ khảo sát DOM (16/10/2026) ──────────────────────────
const SEL = {
  // Textarea nhập prompt (pre-hydration & sau hydrate đều dùng cùng aria-label)
  input:  'textarea[aria-label="Nhắn tin"]',

  // Nút gửi — chỉ xuất hiện sau khi có text trong textarea
  send:   'button[aria-label="Gửi"][data-pel-click="chat_send_message"]',

  // Nút dừng streaming
  stop:   'button[aria-label="Dừng"]',

  // Container của mỗi message (user & assistant)
  msgItem: '[data-message-item="true"]',

  // Chỉ lấy assistant messages
  answer:  '[data-message-item="true"][data-message-role="assistant"]',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class MuseAdapter extends ChatProvider {
  name = 'muse';

  /** Hostname kỳ vọng suy ra từ MUSE_URL, không gõ cứng */
  getExpectedHostname() {
    return new URL(process.env.MUSE_URL || MUSE_HOME).hostname;
  }

  /**
   * Trả về puppeteer Page đang mở Muse.
   * Tìm tab có hostname khớp với expectedHostname.
   * Nếu newChat: true, điều hướng tới /thread/new để bắt đầu hội thoại sạch.
   */
  async getPage(url = null, { newChat = false } = {}) {
    const b = await getBrowser();
    const pages = await b.pages();
    const expectedHost = this.getExpectedHostname();

    const baseUrl = process.env.MUSE_URL || MUSE_HOME;
    const targetUrl = url || (newChat ? `${baseUrl.replace(/\/+$/, '')}/thread/new` : baseUrl);

    // Tìm tab Muse đang mở
    let page = pages.find(p => {
      try {
        const h = new URL(p.url()).hostname;
        return h === expectedHost || h.endsWith('.' + expectedHost);
      } catch { return false; }
    });
    if (!page) page = await b.newPage();

    // Navigate nếu URL khác với hiện tại hoặc cần newChat
    const current = page.url();
    const needNav = newChat || (url && url !== current && !current.startsWith(url)) || !current.includes(expectedHost);
    if (needNav) {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }
    await page.bringToFront();

    // Đợi textarea xuất hiện (chứng tỏ đã đăng nhập và React đã mount)
    try {
      await page.waitForSelector(SEL.input, { timeout: 20000 });
    } catch {
      throw new Error(`LỖI ĐĂNG NHẬP / GIAO DIỆN: Không tìm thấy ô chat Muse tại '${page.url()}'. Có thể bạn chưa đăng nhập hoặc Muse chưa load xong. Vui lòng đăng nhập trên Chrome.`);
    }
    return page;
  }

  /**
   * Lấy ID của assistant message mới nhất hiện có (hoặc số lượng nếu không có ID)
   */
  async countAnswers(page) {
    return page.$$eval(SEL.answer, (els) => {
      if (!els.length) return '';
      const last = els[els.length - 1];
      return last.getAttribute('data-message-id') || String(els.length);
    }).catch(() => '');
  }

  /**
   * Gửi prompt vào Muse:
   * Chèn văn bản một lần qua HTMLTextAreaElement prototype setter + dispatch input event,
   * sau đó click nút Gửi (nhanh ~400ms, không lag, không cắt text kể cả prompt dài ~3000 ký tự).
   */
  async sendPrompt(page, text) {
    try {
      await page.waitForSelector(SEL.input, { timeout: 30000 });
    } catch {
      throw new Error('LỖI GIAO DIỆN: Không tìm thấy ô chat Muse. Có thể bạn chưa đăng nhập hoặc bị đăng xuất.');
    }

    await page.focus(SEL.input);
    await sleep(150);

    // Chèn text một lần (nhanh, kích hoạt đúng React onChange/onInput)
    await page.evaluate((sel, t) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, t);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, SEL.input, text);

    await sleep(400); // Đợi nút Gửi render

    // Click nút Gửi
    const sendBtn = await page.$(SEL.send);
    if (!sendBtn) throw new Error('Không tìm thấy nút Gửi của Muse sau khi nhập text.');
    await sendBtn.click();
  }

  /**
   * Đợi Muse trả lời xong:
   * 1. Ưu tiên: xuất hiện marker (<<<C2C_END>>>)
   * 2. Hoặc: nút "Dừng" streaming đã biến mất và có chứa STATE hợp lệ
   */
  async waitForAnswer(page, before, { timeoutMs = 300000, marker = C2C_END } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const stopVisible = await page.$(SEL.stop).then(el => !!el).catch(() => false);
      const info = await page.$$eval(SEL.answer, (els) => {
        if (!els.length) return { id: '', n: 0, text: '' };
        const last = els[els.length - 1];
        return {
          id: last.getAttribute('data-message-id') || String(els.length),
          n: els.length,
          text: last.innerText || '',
        };
      }).catch(() => ({ id: '', n: 0, text: '' }));

      const isNew = typeof before === 'string'
        ? (info.id && info.id !== before)
        : (info.n > before);

      if (isNew && info.text) {
        if (info.text.includes(marker)) return info.text;
        // Nếu nút Dừng đã mất và văn bản đã có STATE chuẩn
        if (!stopVisible && /STATE:\s*(PLAN_APPROVED|PLAN_REJECTED|REVIEW_PASSED|REVIEW_FAILED)/i.test(info.text)) {
          return info.text;
        }
      }
      await sleep(1500);
    }
    throw new Error('TIMEOUT: Muse không trả lời kịp');
  }

  /**
   * Đợi streaming kết thúc bằng cách:
   * 1. Chờ stop button biến mất
   * 2. Text ổn định trong stableMs ms liên tiếp
   */
  async waitForStableAnswer(page, before, { timeoutMs = 120000, stableMs = 3000 } = {}) {
    const start = Date.now();
    let last = '', since = Date.now();

    while (Date.now() - start < timeoutMs) {
      await sleep(1000);

      const stopVisible = await page.$(SEL.stop).then(el => !!el).catch(() => false);
      const info = await page.$$eval(SEL.answer, (els) => {
        if (!els.length) return { id: '', n: 0, text: '' };
        const el = els[els.length - 1];
        return {
          id: el.getAttribute('data-message-id') || String(els.length),
          n: els.length,
          text: el.innerText || '',
        };
      }).catch(() => ({ id: '', n: 0, text: '' }));

      const isNew = typeof before === 'string'
        ? (info.id && info.id !== before)
        : (info.n > before);

      if (isNew && info.text) {
        if (info.text !== last) {
          last = info.text;
          since = Date.now();
        } else if (!stopVisible && Date.now() - since >= stableMs) {
          return last;
        }
      }
    }
    throw new Error('TIMEOUT: Muse streaming không kết thúc');
  }
}
