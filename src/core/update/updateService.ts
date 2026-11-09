import { API_BASE_URL } from '../auth/types';

/** 服务端下发的最新版本信息。 */
export interface AppUpdateInfo {
  version: string;
  url: string;
  notes?: string;
  publishedAt?: number | null;
  sha256?: string | null;
}

const CACHE_KEY = 'aether_update_check_v1';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000;
const DEFAULT_DOWNLOAD_URL = 'https://jd-hub.top/';

/** 语义化版本比较：a > b 返回 1，相等 0，小于 -1。 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const l = left[index] || 0;
    const r = right[index] || 0;
    if (l !== r) return l > r ? 1 : -1;
  }
  return 0;
}

/** 拉取最新版本信息；网络失败返回 null，不影响启动。 */
export async function fetchLatestUpdate(): Promise<AppUpdateInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/app-update`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data.version !== 'string' || !data.version.trim()) return null;
    return {
      version: data.version.trim(),
      url: typeof data.url === 'string' && /^https?:\/\//i.test(data.url) ? data.url : DEFAULT_DOWNLOAD_URL,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      publishedAt: Number(data.publishedAt) || null,
      sha256: typeof data.sha256 === 'string' ? data.sha256 : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 检查更新。默认 24 小时缓存一次；force=true 时忽略缓存（手动检查）。
 * 返回「比当前版本新」的信息，没有更新时返回 null。
 */
export async function checkForUpdate(currentVersion: string, options: { force?: boolean } = {}): Promise<AppUpdateInfo | null> {
  if (!options.force) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { at: number; info: AppUpdateInfo | null } | null;
      if (cached && Date.now() - cached.at < CHECK_INTERVAL) return cached.info || null;
    } catch { /* ignore broken cache */ }
  }

  const latest = await fetchLatestUpdate();
  const info = latest && compareVersions(latest.version, currentVersion) > 0 ? latest : null;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), info }));
  } catch { /* ignore quota errors */ }
  return info;
}
