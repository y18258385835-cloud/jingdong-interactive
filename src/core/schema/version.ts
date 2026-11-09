/**
 * Schema 版本常量（唯一事实）。
 * 任何"数据格式"变更都必须 bump SCHEMA_VERSION 并在 migrations.ts 提供迁移。
 */

/** 当前工程数据模型版本 */
export const SCHEMA_VERSION = 43;

/** 当前编辑器 localStorage key（本轮起使用） */
export const CURRENT_STORAGE_KEY = 'aether_desktop_project_v43';

/** 旧版 localStorage key（用于一次性迁移读取） */
export const LEGACY_STORAGE_KEY = 'aether_desktop_project_v42';

/** 当前 IndexedDB 库名 */
export const DB_NAME = 'AetherDesktopDB_v43';

/** 旧版 IndexedDB 库名（用于一次性迁移） */
export const LEGACY_DB_NAME = 'AetherDesktopDB_v42';

/** 数据缺失 schemaVersion 时的缺省版本（视为最旧已知版本） */
export const LEGACY_DEFAULT_VERSION = 42;

/** 工程数据缺省版本，若 schemaVersion 缺失，先按此处理再迁移 */
export const MIN_SUPPORTED_VERSION = 42;
