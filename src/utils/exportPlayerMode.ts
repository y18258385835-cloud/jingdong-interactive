export const EXPORT_PLAYER_GLOBAL = '__AETHER_EXPORT_PLAYER__';

export function isExportPlayerMode(locationSearch: string, globalFlag: unknown): boolean {
  return globalFlag === true || new URLSearchParams(locationSearch).get('aether-player') === '1';
}
