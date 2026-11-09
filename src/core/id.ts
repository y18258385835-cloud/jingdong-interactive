/**
 * 唯一 id 生成器。
 * 所有"新建"操作（工程/场景/图层/素材）必须使用 genId，保证唯一且可读。
 */

export function genId(prefix = 'uid'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/** 生成短码（用于预览链接等），只含 URL 安全字符 */
export function genShortCode(len = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // 去掉易混淆字符 i/l/o/0/1
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
