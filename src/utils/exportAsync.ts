/** Promise helpers for keeping long-running exports cancellable and bounded. */
export function withExportTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => reject(new DOMException('Export cancelled', 'AbortError')));
    const timer = setTimeout(
      () => finish(() => {
        onTimeout?.();
        reject(new Error(`${label}超过${Math.ceil(timeoutMs / 1000)}秒，已停止导出，请重试或降低导出设置`));
      }),
      timeoutMs,
    );
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
    task.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export function waitForExportFrame(signal?: AbortSignal, timeoutMs = 1000): Promise<void> {
  return withExportTimeout(new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }), timeoutMs, '画面刷新等待', signal);
}
