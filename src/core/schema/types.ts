/**
 * 核心数据模型类型（唯一事实来源）。
 * 基于 src/types/index.ts 扩展，新增 schemaVersion / assets / branding / settings。
 * 不删除、不重命名 src/types 中任何现有字段（铁律 1）。
 */

// 重新导出现有 UI 层类型（核心层引用同一份）
export type {
  ElementType,
  BlendMode,
  InAnimType,
  OutAnimType,
  LoopAnimType,
  LayerGroup,
  SceneElement,
  SceneTransitionType,
  Scene,
  ProjectMeta,
  GlobalVariable,
  ComponentPreset,
  ViewportState,
  PlaybackState,
  HistoryItem,
  HistoryActionType,
} from '../../types';

import type {
  ProjectMeta,
  Scene,
  GlobalVariable,
  ComponentPreset,
  ViewportState,
} from '../../types';

export interface AssetManifest {
  version: number; // 固定 1
  items: Record<string, AssetEntry>;
}

export interface AssetEntry {
  refId: string; // 与 SceneElement.refId 一一对应
  kind: 'image' | 'video' | 'audio' | 'model' | 'splat';
  mime: string; // 如 image/png
  size: number; // 字节
  sha256?: string; // 可选，用于去重/校验
  createdAt: string; // ISO 时间
}

export interface BrandingConfig {
  license: 'free' | 'pro' | 'enterprise'; // 默认 'free'
  watermark?: { enabled: boolean; text: string };
  brand?: { name?: string; primaryColor?: string };
}

export interface EditorSettings {
  lastActiveSceneId?: string;
  viewport?: ViewportState;
  timelineCollapsed?: boolean;
  recentProjects?: { id: string; title: string; updatedAt: string }[];
}

/** 核心层 ProjectData（含 schemaVersion 必填） */
export interface ProjectData {
  schemaVersion: number;
  meta: ProjectMeta;
  scenes: Record<string, Scene>;
  start: string;
  is3DParallaxEnabled?: boolean;
  parallaxIntensity?: number;
  variables?: GlobalVariable[];
  components?: ComponentPreset[];
  assets?: AssetManifest; // [NEW] 素材清单
  branding?: BrandingConfig; // [NEW] 品牌/水印/授权
  settings?: EditorSettings; // [NEW] UI 持久化偏好
}

/** 归一化/校验结果类型 */
export type NormalizeResult =
  | { ok: true; data: ProjectData; warnings: string[] }
  | { ok: false; error: AetherErrorLike };

/** 供 normalize 使用的错误最小形状（避免循环依赖，仅取 code/message） */
export interface AetherErrorLike {
  code: string;
  message: string;
  details?: unknown;
}

/** 类型守卫：NormalizeResult 是否为成功分支（供各层安全收窄） */
export function isNormalizeOk(r: NormalizeResult): r is Extract<NormalizeResult, { ok: true }> {
  return r.ok === true;
}
