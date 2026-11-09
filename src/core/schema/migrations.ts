/**
 * Schema 迁移注册表。
 * 铁律 10：数据格式改动必须 bump SCHEMA_VERSION 并在此新增迁移。
 * 迁移要求：幂等（重复执行结果一致）；不得改动 scenes 内容（除非有明确理由并记录）。
 */

import type { ProjectData } from './types';

export type Migration = (prev: unknown) => unknown;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const MIGRATIONS: Record<number, Migration> = {
  /**
   * 42 → 43：
   * - 顶层新增 schemaVersion: 43
   * - 顶层新增 assets: { version: 1, items: {} }（素材清单，空初始）
   * - branding / settings 保持缺省（undefined）
   * - 幂等：若已存在 schemaVersion 或 assets 则不覆盖
   */
  42: (prev) => {
    if (!isPlainObject(prev)) return prev;
    const next: Record<string, unknown> = { ...prev };
    if (next.schemaVersion === undefined) next.schemaVersion = 43;
    if (next.assets === undefined) next.assets = { version: 1, items: {} };
    return next as unknown as ProjectData;
  },
};

/** 按版本顺序执行迁移。返回迁移后的数据或抛出携带版本信息的错误。 */
export function runMigrations(raw: unknown, fromVersion: number, toVersion: number): unknown {
  if (fromVersion >= toVersion) return raw;
  let data = raw;
  for (let v = fromVersion; v < toVersion; v++) {
    const migration = MIGRATIONS[v];
    if (!migration) {
      throw new Error(`缺少版本 ${v} → ${v + 1} 的迁移函数，无法迁移（from=${fromVersion}, to=${toVersion}）`);
    }
    data = migration(data);
  }
  return data;
}
