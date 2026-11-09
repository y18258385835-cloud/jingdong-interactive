/** Classify transient module-loading failures separately from real render crashes. */
export function isDynamicModuleLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error);
  const normalized = message.toLowerCase();
  return [
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
    'chunkloaderror',
    'loading chunk',
    'unable to preload css',
  ].some((pattern) => normalized.includes(pattern));
}
