/**
 * 统一日志（headless 核心唯一日志入口）。
 * 核心模块不得直接 console.log/console.warn/console.error，统一走这里，
 * 便于测试静默、生产脱敏与审计扩展。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

interface LoggerOptions {
  level?: LogLevel; // 低于该级别的输出被抑制
  silent?: boolean; // 完全静默（测试用）
  prefix?: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class ConsoleLogger implements Logger {
  private readonly level: LogLevel;
  private readonly silent: boolean;
  private readonly prefix: string;

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? 'info';
    this.silent = opts.silent ?? false;
    this.prefix = opts.prefix ?? '[aether]';
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.silent) return false;
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private format(msg: string, meta?: unknown): string {
    return meta === undefined ? `${this.prefix} ${msg}` : `${this.prefix} ${msg} ${safeStringify(meta)}`;
  }

  debug(msg: string, meta?: unknown): void {
    if (this.shouldLog('debug')) console.debug(this.format(msg, meta));
  }
  info(msg: string, meta?: unknown): void {
    if (this.shouldLog('info')) console.info(this.format(msg, meta));
  }
  warn(msg: string, meta?: unknown): void {
    if (this.shouldLog('warn')) console.warn(this.format(msg, meta));
  }
  error(msg: string, meta?: unknown): void {
    if (this.shouldLog('error')) console.error(this.format(msg, meta));
  }
}

function safeStringify(meta: unknown): string {
  try {
    const s = JSON.stringify(meta);
    return s === undefined ? String(meta) : s;
  } catch {
    return String(meta);
  }
}

/** 全局默认 logger（可通过 setLogger 替换，测试中替换为 silent） */
export const logger: Logger = new ConsoleLogger();

/** 创建独立 logger 实例（供 API/CLI/MCP 各自命名空间使用） */
export function createLogger(opts: LoggerOptions = {}): Logger {
  return new ConsoleLogger(opts);
}
