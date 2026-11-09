import { dbManager } from './db';
import { EXPORT_PLAYER_GLOBAL, isExportPlayerMode } from './exportPlayerMode';

const DIRECT_URL_PATTERN = /^(data:|blob:|https?:\/\/)/i;
const PACKAGED_ASSET_PATTERN = /^(?:\.\/|\/)?assets\//i;

export function resolveExportPlayerAssetUrl(
  ref: string,
  options?: { isExportPlayer?: boolean; baseUrl?: string },
): string {
  if (!ref) return '';
  const exportPlayer = options?.isExportPlayer ?? (
    typeof window !== 'undefined'
      && isExportPlayerMode(
        window.location.search,
        (window as Window & { [EXPORT_PLAYER_GLOBAL]?: unknown })[EXPORT_PLAYER_GLOBAL],
      )
  );
  if (!exportPlayer || (!DIRECT_URL_PATTERN.test(ref) && !PACKAGED_ASSET_PATTERN.test(ref))) return '';
  if (DIRECT_URL_PATTERN.test(ref)) return ref;

  const baseUrl = options?.baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  try {
    return new URL(ref, baseUrl).href;
  } catch {
    return '';
  }
}

export async function loadRuntimeAssetUrl(ref: string): Promise<string> {
  const packagedUrl = resolveExportPlayerAssetUrl(ref);
  return packagedUrl || dbManager.loadUrl(ref);
}
