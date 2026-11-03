// src/providers/index.js
// Factory: đọc biến môi trường CHAT_PROVIDER (hoặc config) và trả về adapter phù hợp
// Không cần sửa code để chuyển provider — chỉ đổi env var.

import { DeepSeekAdapter } from './deepseek-adapter.js';
import { MuseAdapter } from './muse-adapter.js';

/**
 * Các provider được hỗ trợ:
 *   CHAT_PROVIDER=deepseek   → DeepSeekAdapter  (mặc định)
 *   CHAT_PROVIDER=muse       → MuseAdapter
 */
const PROVIDERS = {
  deepseek: DeepSeekAdapter,
  muse: MuseAdapter,
};

const _instances = {};

/**
 * Trả về instance của provider được yêu cầu hoặc từ môi trường.
 * Thứ tự ưu tiên:
 *   1. Tham số name ('muse' hoặc 'deepseek')
 *   2. process.env.PROVIDER hoặc process.env.CHAT_PROVIDER
 * Nếu không thiết lập: Báo lỗi rõ ràng, KHÔNG tự động fallback về deepseek.
 */
export function getProvider(name = null) {
  const chosen = (name || process.env.PROVIDER || process.env.CHAT_PROVIDER || '').toLowerCase().trim();
  if (!chosen) {
    throw new Error("Chưa chọn provider. Vui lòng truyền tham số 'provider' ('muse' hoặc 'deepseek') hoặc thiết lập biến môi trường PROVIDER (không tự động fallback về deepseek).");
  }

  const Cls = PROVIDERS[chosen];
  if (!Cls) {
    const known = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Provider không hợp lệ: "${chosen}". Các provider được hỗ trợ: ${known}`);
  }

  if (!_instances[chosen]) {
    _instances[chosen] = new Cls();
    console.error(`[c2c] Provider initialized: ${chosen}`);
  }
  return _instances[chosen];
}

/** Reset instances (dùng cho test) */
export function resetProvider() {
  for (const k of Object.keys(_instances)) delete _instances[k];
}

export { DeepSeekAdapter, MuseAdapter };
