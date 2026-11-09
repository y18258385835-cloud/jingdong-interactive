/**
 * AETHER 统一错误体系（全局唯一错误类型）
 * 所有层（core / API / CLI / MCP / UI）共用，禁止各层自造错误类型。
 */

export type ErrorCode =
  | 'E_VALIDATION' // 数据校验失败
  | 'E_SCHEMA_MIGRATION' // 迁移失败
  | 'E_SCHEMA_NEWER' // 数据版本高于程序
  | 'E_NOT_FOUND' // 场景/图层/工程/素材不存在
  | 'E_CONFLICT' // id 冲突/重复创建
  | 'E_STORAGE_FULL' // localStorage/IndexedDB 配额满
  | 'E_EXPORT_TOO_LARGE' // 单文件导出超限
  | 'E_EXPORT_UNSUPPORTED' // 含不支持导出的元素
  | 'E_AUTH_REQUIRED' // 未授权/无 API Key
  | 'E_AI_TIMEOUT' // AI 调用超时
  | 'E_AI_GENERATION_FAILED' // AI 生成或校验失败
  | 'E_TIMEOUT' // 通用任务超时
  | 'E_CANCELLED' // 通用任务取消
  | 'E_INTERNAL'; // 未归类内部错误

export const ERROR_CODES: readonly ErrorCode[] = [
  'E_VALIDATION',
  'E_SCHEMA_MIGRATION',
  'E_SCHEMA_NEWER',
  'E_NOT_FOUND',
  'E_CONFLICT',
  'E_STORAGE_FULL',
  'E_EXPORT_TOO_LARGE',
  'E_EXPORT_UNSUPPORTED',
  'E_AUTH_REQUIRED',
  'E_AI_TIMEOUT',
  'E_AI_GENERATION_FAILED',
  'E_TIMEOUT',
  'E_CANCELLED',
  'E_INTERNAL',
];

export class AetherError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AetherError';
    this.code = code;
    this.details = details;
  }
}

export function isAetherError(err: unknown): err is AetherError {
  return err instanceof AetherError;
}

/** 将任意异常归一化为 AetherError（内部错误保持内部，未知异常包装为 E_INTERNAL） */
export function toAetherError(err: unknown, fallbackMessage = '内部错误'): AetherError {
  if (isAetherError(err)) return err;
  if (err instanceof Error) return new AetherError('E_INTERNAL', err.message || fallbackMessage, err);
  return new AetherError('E_INTERNAL', fallbackMessage, err);
}

/** 对网络/AI/导出等瞬态错误进行有限重试，取消和校验错误不会重复执行。 */
export async function retryAsync<T>(operation: () => Promise<T>, options: { retries?: number; delayMs?: number; shouldRetry?: (error: unknown) => boolean } = {}): Promise<T> {
  const retries = Math.max(0, options.retries ?? 2);
  const delayMs = Math.max(0, options.delayMs ?? 250);
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); } catch (error) {
      if (attempt >= retries || options.shouldRetry?.(error) === false) throw error;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}
