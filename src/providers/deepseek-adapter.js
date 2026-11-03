// src/providers/deepseek-adapter.js
// Wrap các function deepseek/ hiện có vào interface ChatProvider
import { ChatProvider } from './base.js';
import { getPage } from '../deepseek/browser.js';
import { sendPrompt as _sendPrompt } from '../deepseek/sender.js';
import { countAnswers as _countAnswers, waitForAnswer as _waitForAnswer, waitForStableAnswer as _waitForStableAnswer } from '../deepseek/reader.js';

export const DEEPSEEK_HOME = process.env.DEEPSEEK_URL || 'https://chat.deepseek.com/';

export class DeepSeekAdapter extends ChatProvider {
  name = 'deepseek';

  getExpectedHostname() {
    return new URL(DEEPSEEK_HOME).hostname;
  }

  async getPage(url = null, opts = {}) {
    return getPage(url, opts);
  }

  async countAnswers(page) {
    return _countAnswers(page);
  }

  async sendPrompt(page, text) {
    return _sendPrompt(page, text);
  }

  async waitForAnswer(page, before, opts = {}) {
    return _waitForAnswer(page, before, opts);
  }

  async waitForStableAnswer(page, before, opts = {}) {
    return _waitForStableAnswer(page, before, opts);
  }
}
