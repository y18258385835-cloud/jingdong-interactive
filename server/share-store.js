import crypto from 'crypto';

export const SHARE_TOKEN_PATTERN = /^[a-f0-9]{24}$/;

/**
 * In-memory snapshots behind LAN share links.
 *
 * Kept framework-free so the TTL/size/eviction rules can be unit tested
 * without booting the Express server.
 */
export function createShareStore(options = {}) {
  const ttlMs = Number(options.ttlMs) || 2 * 60 * 60 * 1000;
  const maxBytes = Number(options.maxBytes) || 20 * 1024 * 1024;
  const maxTotalBytes = Number(options.maxTotalBytes) || 200 * 1024 * 1024;
  const maxItems = Number(options.maxItems) || 100;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const createToken = typeof options.createToken === 'function'
    ? options.createToken
    : () => crypto.randomBytes(12).toString('hex');

  const items = new Map();
  let totalBytes = 0;

  const remove = (token) => {
    const item = items.get(token);
    if (!item) return;
    items.delete(token);
    totalBytes = Math.max(0, totalBytes - (item.bytes || 0));
  };

  const cleanup = () => {
    const current = now();
    for (const [token, item] of items.entries()) {
      if (!item || item.expiresAt <= current) remove(token);
    }
  };

  // Keep memory bounded even if many people publish in a short window.
  const enforce = () => {
    while (items.size > maxItems || totalBytes > maxTotalBytes) {
      const oldest = items.keys().next().value;
      if (!oldest) break;
      remove(oldest);
    }
  };

  return {
    publish(html, title) {
      cleanup();
      const text = typeof html === 'string' ? html : '';
      if (!text.trim()) return { ok: false, status: 400, error: '分享内容为空' };
      const bytes = Buffer.byteLength(text, 'utf8');
      if (bytes > maxBytes) {
        return { ok: false, status: 413, error: '工程过大，无法生成分享链接；请改用 ZIP 导出' };
      }
      const token = createToken();
      const expiresAt = now() + ttlMs;
      items.set(token, {
        html: text,
        bytes,
        title: String(title || '鲸动交互平台分享').slice(0, 120),
        createdAt: now(),
        expiresAt,
      });
      totalBytes += bytes;
      enforce();
      return { ok: true, token, expiresAt, bytes };
    },

    get(token) {
      cleanup();
      if (typeof token !== 'string' || !SHARE_TOKEN_PATTERN.test(token)) return null;
      const item = items.get(token);
      if (!item || item.expiresAt <= now()) {
        if (item) remove(token);
        return null;
      }
      return item;
    },

    cleanup,

    get size() {
      return items.size;
    },

    get totalBytes() {
      return totalBytes;
    },
  };
}
