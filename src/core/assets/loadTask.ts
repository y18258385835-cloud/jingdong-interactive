import { AetherError } from '../errors';

export type LoadTaskStatus = 'pending' | 'loading' | 'completed' | 'cancelled' | 'timed-out' | 'failed';
export interface LoadTaskSnapshot { status: LoadTaskStatus; progress: number; error?: Error; }
export interface LoadTaskContext { signal: AbortSignal; report: (progress: number) => void; }
export interface LoadTask<T> { promise: Promise<T>; cancel: () => void; getSnapshot: () => LoadTaskSnapshot; subscribe: (listener: (snapshot: LoadTaskSnapshot) => void) => () => void; }
export interface LoadTaskOptions { timeoutMs?: number; onProgress?: (progress: number) => void; }

export function createLoadTask<T>(executor: (context: LoadTaskContext) => Promise<T>, options: LoadTaskOptions = {}): LoadTask<T> {
  const controller = new AbortController();
  const listeners = new Set<(snapshot: LoadTaskSnapshot) => void>();
  let snapshot: LoadTaskSnapshot = { status: 'pending', progress: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (next: LoadTaskSnapshot) => { snapshot = next; options.onProgress?.(next.progress); listeners.forEach((listener) => listener(snapshot)); };
  const promise = (async () => {
    update({ status: 'loading', progress: 0 });
    try {
      const execution = executor({ signal: controller.signal, report: (progress) => update({ status: 'loading', progress: Math.max(0, Math.min(1, progress)) }) });
      const timeout = options.timeoutMs && options.timeoutMs > 0
        ? new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort('timeout'); reject(new AetherError('E_TIMEOUT', '资源加载超时')); }, options.timeoutMs); })
        : null;
      const result = await (timeout ? Promise.race([execution, timeout]) : execution);
      if (controller.signal.aborted) throw controller.signal.reason === 'timeout' ? new AetherError('E_TIMEOUT', '资源加载超时') : new AetherError('E_CANCELLED', '资源加载已取消');
      update({ status: 'completed', progress: 1 });
      return result;
    } catch (error) {
      const timedOut = controller.signal.reason === 'timeout';
      const cancelled = controller.signal.aborted && !timedOut;
      const normalized = error instanceof Error ? error : new Error(String(error));
      update({ status: timedOut ? 'timed-out' : cancelled ? 'cancelled' : 'failed', progress: snapshot.progress, error: normalized });
      throw timedOut ? new AetherError('E_TIMEOUT', '资源加载超时', normalized) : cancelled ? new AetherError('E_CANCELLED', '资源加载已取消', normalized) : normalized;
    } finally { if (timer) clearTimeout(timer); }
  })();
  return { promise, cancel: () => controller.abort('cancelled'), getSnapshot: () => snapshot, subscribe: (listener) => { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener); } };
}
export async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  return createLoadTask(({ signal }) => operation(signal), { timeoutMs }).promise;
}
