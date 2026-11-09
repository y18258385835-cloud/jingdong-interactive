/**
 * ProjectData 读取归一化（唯一入口）。
 * 所有外部数据（本地 / 导入 / API / CLI / MCP / AI 生成）必须先经 normalizeProjectData。
 *
 * 处理顺序：空值检查 → 版本识别 → 迁移 → 温和修复 → 校验 → 返回。
 */

import { AetherError } from '../errors';
import { SCHEMA_VERSION, LEGACY_DEFAULT_VERSION } from './version';
import { runMigrations } from './migrations';
import { validateProjectData, isValidateOk, type ValidationIssue } from './validate';
import type { NormalizeResult, ProjectData } from './types';
import { inspectCustomCodePlugin } from '../../utils/customCode';

export { isNormalizeOk } from './types';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// —— 温和修复（可自动修复项）——

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

/** 修复单个元素的数值越界字段。返回是否修复了任意项。 */
function repairElement(el: Record<string, unknown>): boolean {
  let fixed = false;
  const supportedTriggers = new Set(['click', 'hover', 'long-press', 'swipe-direction']);
  const fix = (key: string, min: number, max: number, fallback: number): void => {
    if (el[key] !== undefined && typeof el[key] === 'number') {
      const n = el[key] as number;
      if (!Number.isFinite(n) || n < min || n > max) {
        el[key] = clamp(n, min, max, fallback);
        fixed = true;
      }
    }
  };

  fix('x', 0, 100, 0);
  fix('y', 0, 100, 0);
  fix('w', 0, 100, 10);
  fix('h', 0, 100, 10);
  fix('opacity', 0, 100, 100);
  fix('rot', -3600, 3600, 0);
  fix('startTime', 0, 86400, 0);
  fix('duration', 0, 86400, 1);
  fix('depthZ', -100, 100, 0);
  fix('parallaxFactor', 0, 1, 0.04);
  fix('hoverDelay', 0, 10, 0.3);
  fix('fontSize', 1, 1000, 24);
  fix('loopAnimSpeed', 0.1, 5, 1);
  fix('gradientAngle', 0, 360, 135);
  fix('saberCoreWidth', 0.1, 40, 1);
  fix('saberGlowIntensity', 0.2, 5, 1);
  fix('saberGlowSpread', 2, 100, 20);
  fix('saberDashLength', 1, 24, 8);
  fix('saberDashGap', 1, 24, 6);
  fix('saberDashOffset', 0, 100, 0);
  fix('saberStartOffset', 0, 100, 0);
  fix('saberEndOffset', 0, 100, 100);
  fix('saberFlickerIntensity', 0, 100, 0);
  fix('saberGrowthSpeed', 0.1, 5, 1);
  fix('panoramaFov', 30, 120, 75);
  fix('panoramaAutoRotateSpeed', 0.1, 5, 1);
  fix('modelAutoRotateSpeed', 0.1, 5, 1);
  fix('splatSize', 0.5, 5, 1);
  fix('playbackRate', 0.1, 16, 1);
  if (el.videoPlayerStyle !== undefined && (typeof el.videoPlayerStyle !== 'string' || !['none', 'minimal', 'classic', 'cinema'].includes(el.videoPlayerStyle))) {
    el.videoPlayerStyle = 'none';
    fixed = true;
  }
  // Older imports defaulted every video to the classic player with native
  // controls. Migrate that implicit default once, while preserving an
  // explicit choice recorded by the inspector.
  if ((el.type === 'vid' || el.type === 'panorama-vid') && el.videoPlayerCustomized !== true && el.videoControls === true && (el.videoPlayerStyle === undefined || el.videoPlayerStyle === 'classic')) {
    el.videoControls = false;
    el.videoPlayerStyle = 'none';
    fixed = true;
  }
  fix('vfxSpeed', 0.2, 5, 1);

  // Older builds could write keyframes in layer-local time while the editor
  // reads them in scene time. Migrate only the unambiguous delayed-layer case.
  const startTime = typeof el.startTime === 'number' && Number.isFinite(el.startTime) ? el.startTime : 0;
  const keyframes = isPlainObject(el.keyframes) ? el.keyframes : undefined;
  const tracks = keyframes && Array.isArray(keyframes.tracks) ? keyframes.tracks : [];
  const frames = tracks.flatMap((track) => isPlainObject(track) && Array.isArray(track.keyframes) ? track.keyframes : []);
  if (startTime > 0 && frames.length > 0 && frames.every((frame) => isPlainObject(frame) && typeof frame.time === 'number' && frame.time < startTime - 0.035)) {
    frames.forEach((frame) => {
      if (isPlainObject(frame) && typeof frame.time === 'number') frame.time = Math.max(0, Number((frame.time + startTime).toFixed(2)));
    });
    fixed = true;
  }

  // zIndex：必须为正整数
  if (el.zIndex !== undefined && (typeof el.zIndex !== 'number' || !Number.isInteger(el.zIndex) || (el.zIndex as number) < 1)) {
    el.zIndex = 10;
    fixed = true;
  }
  if (typeof el.trigger === 'string' && !supportedTriggers.has(el.trigger)) {
    el.trigger = 'click';
    fixed = true;
  }
  if (isPlainObject(el.interaction) && typeof el.interaction.trigger === 'string' && !supportedTriggers.has(el.interaction.trigger)) {
    el.interaction.trigger = 'click';
    fixed = true;
  }
  if (Array.isArray(el.hotspots)) {
    for (const hotspot of el.hotspots) {
      if (!isPlainObject(hotspot)) continue;
      if (typeof hotspot.trigger === 'string' && !supportedTriggers.has(hotspot.trigger)) {
        hotspot.trigger = 'click';
        fixed = true;
      }
      if (isPlainObject(hotspot.interaction) && typeof hotspot.interaction.trigger === 'string' && !supportedTriggers.has(hotspot.interaction.trigger)) {
        hotspot.interaction.trigger = 'click';
        fixed = true;
      }
    }
  }
  return fixed;
}

/** 修复场景与场景内元素。返回 warning 文案数组。 */
function repairProject(project: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  const scenes = project.scenes;
  if (!isPlainObject(scenes)) return warnings;

  const sceneIds = Object.keys(scenes);
  // B3：start 指向不存在场景 → 修正为第一个
  const start = project.start;
  if (typeof start !== 'string' || !sceneIds.includes(start)) {
    project.start = sceneIds[0] ?? '';
    warnings.push(`start 场景无效，已修正为 "${project.start}"`);
  }

  for (const sid of sceneIds) {
    const scene = scenes[sid];
    if (!isPlainObject(scene)) continue;
    const sceneObj = scene as Record<string, unknown>;
    // B6：场景 duration ≤ 0 → 归一化为 1
    if (typeof sceneObj.duration === 'number' && sceneObj.duration <= 0) {
      sceneObj.duration = 1;
      warnings.push(`场景 "${sid}" duration 无效，已归一化为 1s`);
    }
    if (typeof sceneObj.transitionDuration === 'number') {
      sceneObj.transitionDuration = clamp(sceneObj.transitionDuration, 0, 10, 0.6);
    }
    const els = sceneObj.els;
    if (Array.isArray(els)) {
      els.forEach((elRaw, idx) => {
        if (!isPlainObject(elRaw)) return;
        const customCode = isPlainObject(elRaw.customCode) ? elRaw.customCode : undefined;
        if (customCode) {
          const diagnostics = inspectCustomCodePlugin({
            html: typeof customCode.html === 'string' ? customCode.html : '',
            css: typeof customCode.css === 'string' ? customCode.css : '',
            js: typeof customCode.js === 'string' ? customCode.js : '',
          });
          if (diagnostics.errors.length) {
            const previous = isPlainObject(customCode.diagnostics) ? customCode.diagnostics : {};
            customCode.diagnostics = {
              ...previous,
              status: 'error',
              errors: diagnostics.errors,
              warnings: diagnostics.warnings,
              checkedAt: new Date().toISOString(),
            };
            warnings.push(`场景 "${sid}" 元素[${idx}] 的自定义代码未通过安全检查，已禁用运行时执行`);
          }
        }
        if (repairElement(elRaw as Record<string, unknown>)) {
          warnings.push(`场景 "${sid}" 元素[${idx}] 存在越界数值，已温和修复`);
        }
      });
    }
  }
  return warnings;
}

/**
 * 归一化入口。详见顶部注释。
 */
export function normalizeProjectData(raw: unknown): NormalizeResult {
  // 1. 空值检查
  if (raw === null || raw === undefined) {
    return { ok: false, error: new AetherError('E_VALIDATION', '工程数据为空') };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, error: new AetherError('E_VALIDATION', '工程数据必须为对象') };
  }

  // 2. 版本识别（缺失 → 按最旧已知版本处理）
  const rawVersion = (raw as Record<string, unknown>).schemaVersion;
  const version =
    typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : LEGACY_DEFAULT_VERSION;

  // 3. 版本超前 → 拒绝
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: new AetherError('E_SCHEMA_NEWER', `工程数据版本(${version})高于当前程序(${SCHEMA_VERSION})，请升级软件后再打开`, { version, supported: SCHEMA_VERSION }),
    };
  }

  // 4. 迁移
  let data: unknown = raw;
  if (version < SCHEMA_VERSION) {
    try {
      data = runMigrations(raw, version, SCHEMA_VERSION);
    } catch (err) {
      return {
        ok: false,
        error: new AetherError('E_SCHEMA_MIGRATION', err instanceof Error ? err.message : '数据迁移失败', { from: version, to: SCHEMA_VERSION }),
      };
    }
  }

  // 5. 温和修复
  const warnings: string[] = [];
  if (isPlainObject(data)) {
    warnings.push(...repairProject(data as Record<string, unknown>));
  }

  // 6. 校验
  const v = validateProjectData(data);
  if (!isValidateOk(v)) {
    return { ok: false, error: new AetherError('E_VALIDATION', '工程数据校验失败', { issues: v.issues }) };
  }

  // 7. 兜底确保 schemaVersion 存在
  const finalData = data as ProjectData;
  if (typeof finalData.schemaVersion !== 'number') {
    (finalData as unknown as Record<string, unknown>).schemaVersion = SCHEMA_VERSION;
    warnings.push('缺失 schemaVersion，已补写当前版本');
  }

  return { ok: true, data: finalData, warnings };
}
