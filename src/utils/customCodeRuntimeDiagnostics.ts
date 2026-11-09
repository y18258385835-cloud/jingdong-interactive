import type { CustomCodeDiagnostic } from '../types';

export type CustomCodeRuntimeCategory = 'runtime-error' | 'unhandled-rejection' | 'console' | 'alert';

export interface CustomCodeRuntimeDiagnostic extends CustomCodeDiagnostic {
  blocking: boolean;
  category: CustomCodeRuntimeCategory;
}

type RuntimeDiagnosticInput = {
  message?: unknown;
  reason?: unknown;
  line?: unknown;
  lineno?: unknown;
  column?: unknown;
  colno?: unknown;
  stack?: unknown;
};

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const stringifyRuntimeValue = (value: unknown) => {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
};

const getRuntimeMessage = (input: unknown) => {
  if (input && typeof input === 'object' && 'message' in input) {
    const message = stringifyRuntimeValue((input as { message?: unknown }).message);
    if (message) return message;
  }
  return stringifyRuntimeValue(input) || '自定义组件运行错误';
};

export const parseRuntimeStackLocation = (stack?: string) => {
  if (!stack) return {};
  for (const line of stack.split(/\r?\n/)) {
    const match = line.match(/:(\d+):(\d+)\)?\s*$/);
    if (!match) continue;
    return { line: Number(match[1]), column: Number(match[2]) };
  }
  return {};
};

export const formatRuntimeDiagnosticMessage = (diagnostic: Pick<CustomCodeDiagnostic, 'message' | 'line' | 'column'>) => {
  const location = diagnostic.line
    ? ` · 第 ${diagnostic.line} 行${diagnostic.column ? `，第 ${diagnostic.column} 列` : ''}`
    : '';
  return `${diagnostic.message}${location}`;
};

export const parseRuntimeDiagnostic = (
  input: unknown,
  options: {
    category: CustomCodeRuntimeCategory;
    blocking: boolean;
    level?: CustomCodeDiagnostic['level'];
    source?: CustomCodeDiagnostic['source'];
    line?: unknown;
    column?: unknown;
    stack?: unknown;
  },
): CustomCodeRuntimeDiagnostic => {
  const payload = input && typeof input === 'object' ? input as RuntimeDiagnosticInput : {};
  const rawValue = payload.reason ?? payload.message ?? input;
  const message = getRuntimeMessage(rawValue);
  const stack = typeof options.stack === 'string'
    ? options.stack
    : typeof payload.stack === 'string'
      ? payload.stack
      : rawValue instanceof Error
        ? rawValue.stack
        : undefined;
  const stackLocation = parseRuntimeStackLocation(stack);
  const line = toPositiveInteger(options.line ?? payload.line ?? payload.lineno) ?? stackLocation.line;
  const column = toPositiveInteger(options.column ?? payload.column ?? payload.colno) ?? stackLocation.column;

  return {
    level: options.level || (options.blocking ? 'error' : 'warning'),
    source: options.source || 'sandbox',
    message,
    ...(line ? { line } : {}),
    ...(column ? { column } : {}),
    ...(stack ? { stack } : {}),
    blocking: options.blocking,
    category: options.category,
  };
};
