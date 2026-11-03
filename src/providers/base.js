// src/providers/base.js
// Interface chung cho mọi chat provider (DeepSeek, Muse, ...)
// Mỗi adapter PHẢI implement đúng các method này.

/**
 * @interface ChatProvider
 *
 * getPage(url?: string) -> Page         // Trả về puppeteer Page, navigate nếu cần
 * countAnswers(page) -> number          // Đếm số message assistant hiện tại
 * sendPrompt(page, text) -> void        // Gõ và gửi prompt
 * waitForAnswer(page, before, opts) -> string   // Đợi và trả về full text response (có marker)
 * waitForStableAnswer(page, before, opts) -> string  // Đợi text ổn định (không cần marker)
 */

export class ChatProvider {
  /** Hostname kỳ vọng (ví dụ: 'chat.deepseek.com' hoặc 'muse.ai') */
  getExpectedHostname() { throw new Error('Not implemented: getExpectedHostname'); }

  /** Trả về puppeteer Page đã mở sẵn URL */
  async getPage(_url, _opts) { throw new Error('Not implemented: getPage'); }

  /** Đếm số assistant message trên page */
  async countAnswers(_page) { throw new Error('Not implemented: countAnswers'); }

  /** Gửi prompt text vào chatbox */
  async sendPrompt(_page, _text) { throw new Error('Not implemented: sendPrompt'); }

  /**
   * Đợi cho đến khi xuất hiện message mới có chứa marker
   * @param {Page} page
   * @param {number} before - số messages trước khi gửi
   * @param {{ timeoutMs?: number, marker?: string }} opts
   * @returns {Promise<string>}
   */
  async waitForAnswer(_page, _before, _opts) { throw new Error('Not implemented: waitForAnswer'); }

  /**
   * Đợi cho đến khi text ổn định (streaming kết thúc), không cần marker
   */
  async waitForStableAnswer(_page, _before, _opts) { throw new Error('Not implemented: waitForStableAnswer'); }
}
