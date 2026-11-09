/**
 * AETHER headless 核心统一出口。
 * 编辑器 / API / CLI / MCP / AI 生成都必须通过这里暴露的 API 操作数据。
 */

// 错误体系
export { AetherError, isAetherError, toAetherError, ERROR_CODES } from './errors';
export type { ErrorCode } from './errors';

// 工具
export { genId, genShortCode } from './id';
export { logger, createLogger } from './logger';
export type { Logger, LogLevel } from './logger';

// Schema（版本/类型/校验/迁移/归一化）
export {
  SCHEMA_VERSION,
  CURRENT_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  DB_NAME,
  LEGACY_DB_NAME,
} from './schema/version';
export {
  validateProjectData,
  isValidProjectData,
  ProjectDataSchema,
} from './schema/validate';
export type { ValidationIssue, ValidateResult } from './schema/validate';
export { normalizeProjectData } from './schema/normalize';
export type { NormalizeResult } from './schema/types';
export { runMigrations, MIGRATIONS } from './schema/migrations';
export type { Migration } from './schema/migrations';

// 核心数据模型类型
export type {
  ProjectData,
  AssetManifest,
  AssetEntry,
  BrandingConfig,
  EditorSettings,
} from './schema/types';
