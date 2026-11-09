import type { ElementType, ProjectData, Scene, SceneElement, SceneTransitionType } from '../../types';
import { getOfficialPluginRealtimeMapping, getPluginById } from '../../plugins/registry';
import { layoutAiOperations } from './layoutEngine';
import { auditAiOperations, type AiVisualIssue } from './visualAudit';
import {
  AI_SCENE_DESIGN_CONTRACT,
  DEFAULT_AI_SCENE_DESIGN,
  AI_SCENE_VISUAL_TOKENS,
  normalizeAiElementRole,
  resolveAiSceneDesign,
  type AiElementRole,
  type AiSceneDesign,
} from './sceneDesignGrammar';

export type AiSceneOperationKind = 'create-scene' | 'create-element' | 'update-scene' | 'update-element' | 'delete-element' | 'reorder-elements' | 'bind-mqtt';

export interface AiElementDraft extends Partial<SceneElement> {
  type: ElementType;
  name?: string;
  pluginId?: string;
  role?: AiElementRole;
}

export type AiSceneOperation =
  | {
      kind: 'create-scene';
      sceneId?: string;
      name: string;
      duration?: number;
      bgColor?: string;
    }
  | {
      kind: 'create-element';
      sceneId?: string;
      element: AiElementDraft;
    }
  | {
      kind: 'update-scene';
      sceneId?: string;
      patch: AiScenePatch;
    }
  | {
      kind: 'update-element';
      sceneId?: string;
      elementId?: string;
      targetOperation?: number;
      patch: AiElementDraft;
    }
  | {
      kind: 'delete-element';
      sceneId?: string;
      elementId?: string;
      targetOperation?: number;
    }
  | {
      kind: 'reorder-elements';
      sceneId?: string;
      elementIds: string[];
    }
  | {
      kind: 'bind-mqtt';
      sceneId?: string;
      targetElementId?: string;
      targetOperation?: number;
      pluginId?: string;
    };

export interface AiLayoutIssue {
  sceneId: string;
  first: string;
  second: string;
}

export interface AiSceneProposal {
  title: string;
  summary: string;
  operations: AiSceneOperation[];
  warnings: string[];
  generatedAt: string;
  source: 'local' | 'model';
  design: AiSceneDesign;
  layout: {
    overlaps: AiLayoutIssue[];
    autoLayout: boolean;
    visualIssues: AiVisualIssue[];
  };
  evaluation?: AiSceneEvaluation;
}

export interface AiSceneEvaluation {
  source: 'model' | 'local' | 'unavailable';
  status: 'passed' | 'needs-review' | 'deferred';
  score?: number;
  summary: string;
  issues: string[];
  repairInstructions: string[];
}

type AiScenePatch = Partial<Pick<Scene, 'alias' | 'duration' | 'cruiseDuration' | 'bgColor' | 'transitionIn' | 'transitionOut' | 'transitionDuration'>>;

export interface ApplyAiSceneResult {
  project: ProjectData;
  createdSceneId?: string;
  createdElementIds: string[];
  adjustedCount: number;
  appliedOperationCount: number;
  skippedOperationCount: number;
  skippedOperationIndexes: number[];
}

const VALID_ELEMENT_TYPES: ElementType[] = [
  'img',
  'vid',
  'txt',
  'shape',
  'saber',
  'vfx',
  '3d_group',
  'chart',
  'panorama-img',
  'panorama-vid',
  'model-3d',
  'gaussian-splat',
  'group',
  'ui-component',
  'custom-code',
];

const DEFAULT_MQTT_PLUGIN_ID = 'aether.metric-card';

// AI may only set fields that the editor already knows how to render or edit.
const SAFE_AI_ELEMENT_KEYS = new Set([
  'id', 'type', 'name', 'sourceName', 'refId', 'role', 'content', 'x', 'y', 'w', 'h', 'rot', 'zIndex', 'opacity', 'blendMode', 'visible', 'locked',
  'mediaAspect', 'lockAspectRatio', 'groupId', 'vidMode', 'loop', 'muted', 'videoControls', 'videoPlayerStyle', 'playbackRate',
  'startTime', 'duration', 'animType', 'animDur', 'exitAnimType', 'exitAnimDur', 'loopAnim', 'loopAnimSpeed',
  'link', 'linkType', 'trigger', 'hoverDelay', 'hoverEffect', 'hoverColor', 'hoverIntensity',
  'popupAnimationType', 'popupExitAnimationType', 'popupAnimationDuration', 'popupPosition', 'popupSize', 'popupX', 'popupY', 'popupWidth', 'popupHeight', 'popupRatio', 'popupRatioW', 'popupRatioH', 'popupOverlayOpacity', 'popupCloseOnOverlay', 'popupTheme', 'popupDisplay', 'popupBgColor', 'popupBorderColor', 'popupGlowColor', 'popupTitleColor', 'popupRadius', 'popupOverlayBlur', 'popupAccentColor', 'linkEnterAnim', 'linkExitAnim', 'linkAnimDuration',
  'is3dLayer', 'depthZ', 'parallaxFactor', 'enable3DShadow',
  'color', 'textColor', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign', 'letterSpacing',
  'backgroundType', 'backgroundColor', 'gradientType', 'gradientAngle', 'gradientStart', 'gradientVia', 'gradientEnd', 'borderRadius', 'borderWidth', 'borderColor', 'boxShadow', 'backdropBlur', 'shapePadding', 'shapeKind', 'shapePath',
  'chartKind', 'chartData', 'chartTitle', 'chartColors', 'chartShowLegend', 'chartShowGrid', 'bindText', 'bindValue', 'uiComponentType', 'uiComponentData', 'pluginId', 'customCode',
  'vfxMotionType', 'vfxColorA', 'vfxColorB', 'vfxColorC', 'vfxSpeed', 'vfxIntensity', 'vfxParams',
  'saberPreset', 'saberEffectType', 'saberPath', 'saberPathType', 'saberShapeName', 'saberGlowColor', 'saberSecondaryGlowColor', 'saberCoreColor', 'saberCoreWidth', 'saberGlowIntensity', 'saberGlowSpread', 'saberStartOffset', 'saberEndOffset', 'saberGrowthMode', 'saberGrowthSpeed', 'saberFlickerIntensity', 'saberTaper', 'saberCapStyle', 'saberGlowFalloff', 'saberDashed', 'saberDashLength', 'saberDashGap', 'saberDashOffset', 'saberBlendMode', 'saberNodes',
  'counterValue', 'counterPrefix', 'counterSuffix', 'clockFormat',
  'interaction', 'variableName', 'variableValue',
  'panoramaFov', 'panoramaAutoRotate', 'panoramaAutoRotateSpeed', 'modelAutoRotate', 'modelAutoRotateSpeed', 'modelCameraDistance', 'modelViewAzimuth', 'modelViewElevation', 'modelScale', 'splatSize',
  'ai3dLayerDirection', 'ai3dLayerDistance', 'ai3dExplodeDirection', 'ai3dExplodeDistance', 'ai3dExplodeSpeed', 'ai3dExplodeSpin', 'ai3dCollisionDirection', 'ai3dCollisionDistance', 'ai3dCollisionBounce', 'ai3dCollisionSpeed', 'ai3dLayers', 'ai3dExplode', 'ai3dPhysics', 'ai3dLoopEnabled', 'ai3dShowPanel', 'ai3dControlVariant', 'ai3dPreviewControls', 'ai3dExportControls',
]);

const INTERACTION_ACTIONS = new Set(['none', 'jump', 'popup', 'url', 'media', 'set-variable']);
const INTERACTION_TRIGGERS = new Set(['click', 'hover', 'long-press', 'swipe-direction']);

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, maxLength = 160): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cleanJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => cleanJsonValue(item, depth + 1)).filter((item) => item !== undefined);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item]) => [key.slice(0, 80), cleanJsonValue(item, depth + 1)])
        .filter(([, item]) => item !== undefined),
    );
  }
  return undefined;
}

function normalizeInteraction(raw: unknown): SceneElement['interaction'] | undefined {
  if (!isRecord(raw)) return undefined;
  const action = typeof raw.action === 'string' && INTERACTION_ACTIONS.has(raw.action) ? raw.action as NonNullable<SceneElement['interaction']>['action'] : 'none';
  const trigger = typeof raw.trigger === 'string' && INTERACTION_TRIGGERS.has(raw.trigger) ? raw.trigger as NonNullable<SceneElement['interaction']>['trigger'] : 'click';
  const result: NonNullable<SceneElement['interaction']> = { action, trigger };
  if (raw.target !== undefined) result.target = text(raw.target, '', 120);
  if (raw.url !== undefined) result.url = text(raw.url, '', 2048);
  if (raw.mediaRefId !== undefined) result.mediaRefId = text(raw.mediaRefId, '', 160);
  if (raw.mediaType === 'image' || raw.mediaType === 'video') result.mediaType = raw.mediaType;
  if (raw.variableName !== undefined) result.variableName = text(raw.variableName, '', 120);
  if (raw.variableValue !== undefined && ['string', 'number', 'boolean'].includes(typeof raw.variableValue)) result.variableValue = raw.variableValue;
  if (raw.hoverDelay !== undefined) result.hoverDelay = numberInRange(raw.hoverDelay, 0.3, 0, 10);
  return result;
}

function normalizeElementDraft(raw: unknown): AiElementDraft | null {
  if (!isRecord(raw) || !VALID_ELEMENT_TYPES.includes(raw.type)) return null;
  const x = numberInRange(raw.x, 10, 0, 96);
  const y = numberInRange(raw.y, 10, 0, 96);
  const draft: AiElementDraft = {
    ...Object.fromEntries(
      Object.entries(raw)
        .filter(([key]) => SAFE_AI_ELEMENT_KEYS.has(key))
        .map(([key, value]) => [key, cleanJsonValue(value)]),
    ),
    type: raw.type,
    name: text(raw.name || raw.sourceName, 'AI 图层', 80),
    x,
    y,
    w: Math.min(numberInRange(raw.w, 24, 1, 100), 100 - x),
    h: Math.min(numberInRange(raw.h, 16, 1, 100), 100 - y),
    opacity: numberInRange(raw.opacity, 100, 0, 100),
    startTime: numberInRange(raw.startTime, 0, 0, 86400),
    duration: numberInRange(raw.duration, 6, 0.1, 86400),
    zIndex: numberInRange(raw.zIndex, 10, 1, 100000),
  };
  if (raw.content !== undefined) draft.content = text(raw.content, '', 2000);
  if (raw.sourceName !== undefined) draft.sourceName = text(raw.sourceName, draft.name || 'AI 图层', 100);
  if (raw.uiComponentType !== undefined) draft.uiComponentType = text(raw.uiComponentType, 'metric-card', 80);
  if (raw.pluginId !== undefined) draft.pluginId = text(raw.pluginId, DEFAULT_MQTT_PLUGIN_ID, 120);
  if (raw.role !== undefined) draft.role = normalizeAiElementRole(raw.role);
  if (isRecord(raw.uiComponentData)) draft.uiComponentData = cleanJsonValue(raw.uiComponentData);
  if (isRecord(raw.interaction)) draft.interaction = normalizeInteraction(raw.interaction);
  if (raw.variableName !== undefined) draft.variableName = text(raw.variableName, '', 120);
  if (raw.variableValue !== undefined && ['string', 'number', 'boolean'].includes(typeof raw.variableValue)) draft.variableValue = raw.variableValue;
  return draft;
}

function normalizeElementPatch(raw: unknown): AiElementDraft | null {
  if (!isRecord(raw)) return null;
  const patch = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]) => SAFE_AI_ELEMENT_KEYS.has(key) && key !== 'id' && key !== 'type')
      .map(([key, value]) => [key, cleanJsonValue(value)]),
  ) as unknown as AiElementDraft;
  if (raw.name !== undefined || raw.sourceName !== undefined) patch.name = text(raw.name || raw.sourceName, 'AI 图层', 80);
  if (raw.content !== undefined) patch.content = text(raw.content, '', 2000);
  if (raw.uiComponentType !== undefined) patch.uiComponentType = text(raw.uiComponentType, 'metric-card', 80);
  if (raw.pluginId !== undefined) patch.pluginId = text(raw.pluginId, DEFAULT_MQTT_PLUGIN_ID, 120);
  if (raw.role !== undefined) patch.role = normalizeAiElementRole(raw.role);
  if (isRecord(raw.uiComponentData)) patch.uiComponentData = cleanJsonValue(raw.uiComponentData);
  if (isRecord(raw.interaction)) patch.interaction = normalizeInteraction(raw.interaction);
  if (raw.variableName !== undefined) patch.variableName = text(raw.variableName, '', 120);
  if (raw.variableValue !== undefined && ['string', 'number', 'boolean'].includes(typeof raw.variableValue)) patch.variableValue = raw.variableValue;
  return Object.keys(patch).length ? patch : null;
}

function normalizeOperation(raw: unknown): AiSceneOperation | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return null;
  const sceneId = raw.sceneId === undefined ? undefined : text(raw.sceneId, 'new-scene', 100);
  if (raw.kind === 'create-scene') {
    return {
      kind: raw.kind,
      sceneId,
      name: text(raw.name || raw.alias, 'AI 生成场景', 100),
      duration: numberInRange(raw.duration, 12, 1, 86400),
      bgColor: text(raw.bgColor, '#07111d', 80),
    };
  }
  if (raw.kind === 'create-element') {
    const element = normalizeElementDraft(raw.element);
    return element ? { kind: raw.kind, sceneId, element } : null;
  }
  if (raw.kind === 'update-scene' && isRecord(raw.patch)) {
    const patch: AiScenePatch = {};
    if (raw.patch.alias !== undefined) patch.alias = text(raw.patch.alias, 'AI 生成场景', 100);
    if (raw.patch.duration !== undefined) patch.duration = numberInRange(raw.patch.duration, 12, 1, 86400);
    if (raw.patch.cruiseDuration !== undefined) patch.cruiseDuration = numberInRange(raw.patch.cruiseDuration, 8, 0, 86400);
    if (raw.patch.bgColor !== undefined) patch.bgColor = text(raw.patch.bgColor, '#07111d', 80);
    if (raw.patch.transitionIn !== undefined) patch.transitionIn = text(raw.patch.transitionIn, 'fade', 30) as SceneTransitionType;
    if (raw.patch.transitionOut !== undefined) patch.transitionOut = text(raw.patch.transitionOut, 'fade', 30) as SceneTransitionType;
    if (raw.patch.transitionDuration !== undefined) patch.transitionDuration = numberInRange(raw.patch.transitionDuration, 0.6, 0, 10);
    return { kind: raw.kind, sceneId, patch };
  }
  if (raw.kind === 'update-element' && isRecord(raw.patch)) {
    const patch = normalizeElementPatch(raw.patch);
    if (!patch) return null;
    return {
      kind: raw.kind,
      sceneId,
      elementId: raw.elementId === undefined ? undefined : text(raw.elementId, '', 120),
      targetOperation: raw.targetOperation === undefined ? undefined : Math.max(0, Math.floor(numberInRange(raw.targetOperation, 0, 0, 1000))),
      patch,
    };
  }
  if (raw.kind === 'delete-element') {
    if (raw.elementId === undefined && raw.targetOperation === undefined) return null;
    return {
      kind: raw.kind,
      sceneId,
      elementId: raw.elementId === undefined ? undefined : text(raw.elementId, '', 120),
      targetOperation: raw.targetOperation === undefined ? undefined : Math.max(0, Math.floor(numberInRange(raw.targetOperation, 0, 0, 1000))),
    };
  }
  if (raw.kind === 'reorder-elements' && Array.isArray(raw.elementIds)) {
    return { kind: raw.kind, sceneId, elementIds: raw.elementIds.map((id) => text(id, '', 120)).filter(Boolean).slice(0, 40) };
  }
  if (raw.kind === 'bind-mqtt') {
    return {
      kind: raw.kind,
      sceneId,
      targetElementId: raw.targetElementId === undefined ? undefined : text(raw.targetElementId, '', 120),
      targetOperation: raw.targetOperation === undefined ? undefined : Math.max(0, Math.floor(numberInRange(raw.targetOperation, 0, 0, 1000))),
      pluginId: raw.pluginId === undefined ? DEFAULT_MQTT_PLUGIN_ID : text(raw.pluginId, DEFAULT_MQTT_PLUGIN_ID, 120),
    };
  }
  return null;
}

export function analyzeAiSceneProposal(proposal: Pick<AiSceneProposal, 'operations'>): AiLayoutIssue[] {
  const byScene = new Map<string, Array<{ id: string; x: number; y: number; w: number; h: number }>>();
  proposal.operations.forEach((operation, index) => {
    if (operation.kind !== 'create-element' || operation.element.type === 'vfx' || operation.element.type === 'saber') return;
    const element = operation.element;
    const sceneId = operation.sceneId || 'new-scene';
    const list = byScene.get(sceneId) || [];
    list.push({
      id: text(element.id || element.name, `图层 ${index + 1}`, 80),
      x: numberInRange(element.x, 0, 0, 100),
      y: numberInRange(element.y, 0, 0, 100),
      w: numberInRange(element.w, 10, 0, 100),
      h: numberInRange(element.h, 10, 0, 100),
    });
    byScene.set(sceneId, list);
  });

  const issues: AiLayoutIssue[] = [];
  byScene.forEach((elements, sceneId) => {
    elements.forEach((first, firstIndex) => {
      elements.slice(firstIndex + 1).forEach((second) => {
        const overlapW = Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x);
        const overlapH = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y);
        if (overlapW > 1 && overlapH > 1) issues.push({ sceneId, first: first.id, second: second.id });
      });
    });
  });
  return issues;
}

export function sanitizeAiSceneProposal(raw: unknown, source: AiSceneProposal['source'] = 'model'): AiSceneProposal | null {
  if (!isRecord(raw) || !Array.isArray(raw.operations)) return null;
  const design = resolveAiSceneDesign(raw.design || {
    style: raw.style,
    density: raw.density,
    layoutTemplate: raw.layoutTemplate,
  });
  const normalizedOperations = raw.operations.map(normalizeOperation).filter((operation): operation is AiSceneOperation => Boolean(operation)).slice(0, 40);
  const laidOutOperations = layoutAiOperations(normalizedOperations, design);
  const elementCountByScene = new Map<string, number>();
  let vfxCount = 0;
  const operations = laidOutOperations.filter((operation) => {
    if (operation.kind !== 'create-element') return true;
    const sceneId = operation.sceneId || 'new-scene';
    const elementCount = elementCountByScene.get(sceneId) || 0;
    if (elementCount >= AI_SCENE_DESIGN_CONTRACT.maxElements) return false;
    elementCountByScene.set(sceneId, elementCount + 1);
    if (operation.element.type === 'vfx') {
      if (vfxCount >= AI_SCENE_DESIGN_CONTRACT.maxBackgroundEffects) return false;
      vfxCount += 1;
      operation.element.opacity = Math.min(operation.element.opacity ?? 100, AI_SCENE_DESIGN_CONTRACT.maxBackgroundEffectOpacity);
    }
    if (operation.element.type === 'txt' && operation.element.fontSize !== undefined) {
      operation.element.fontSize = numberInRange(
        operation.element.fontSize,
        AI_SCENE_DESIGN_CONTRACT.bodyTextSize,
        AI_SCENE_DESIGN_CONTRACT.minTextSize,
        design.style === 'reference-led' ? 72 : 36,
      );
    }
    return true;
  });
  if (operations.length === 0) return null;
  const proposal: AiSceneProposal = {
    title: text(raw.title, 'AI 场景方案', 100),
    summary: text(raw.summary, '已根据当前工程能力生成可编辑场景方案。', 600),
    operations,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((item) => text(item, '', 180)).filter(Boolean).slice(0, 12) : [],
    generatedAt: text(raw.generatedAt, new Date().toISOString(), 60),
    source,
    design,
    layout: { overlaps: [] as AiLayoutIssue[], autoLayout: true, visualIssues: [] as AiVisualIssue[] },
  } satisfies AiSceneProposal;
  if (isRecord(raw.evaluation)) {
    const evaluationStatus = ['passed', 'needs-review', 'deferred'].includes(raw.evaluation.status) ? raw.evaluation.status as AiSceneEvaluation['status'] : 'deferred';
    const evaluationSource = ['model', 'local', 'unavailable'].includes(raw.evaluation.source) ? raw.evaluation.source as AiSceneEvaluation['source'] : 'unavailable';
    proposal.evaluation = {
      source: evaluationSource,
      status: evaluationStatus,
      score: typeof raw.evaluation.score === 'number' && Number.isFinite(raw.evaluation.score) ? Math.max(0, Math.min(100, Math.round(raw.evaluation.score))) : undefined,
      summary: text(raw.evaluation.summary, '评测结果待确认', 500),
      issues: Array.isArray(raw.evaluation.issues) ? raw.evaluation.issues.map((item) => text(item, '', 240)).filter(Boolean).slice(0, 12) : [],
      repairInstructions: Array.isArray(raw.evaluation.repairInstructions) ? raw.evaluation.repairInstructions.map((item) => text(item, '', 240)).filter(Boolean).slice(0, 12) : [],
    };
  }
  proposal.layout.overlaps = analyzeAiSceneProposal(proposal);
  proposal.layout.visualIssues = auditAiOperations(proposal.operations);
  if (proposal.layout.overlaps.length > 0) {
    proposal.warnings.push(`发现 ${proposal.layout.overlaps.length} 组图层重叠，应用时会自动避让。`);
  }
  proposal.layout.visualIssues.forEach((issue) => {
    if (!proposal.warnings.includes(issue.message)) proposal.warnings.push(issue.message);
  });
  return proposal;
}

function pluginForPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  const keywords: Array<[string[], string]> = [
    [['温度', 'temperature', '热'], 'aether.temperature-card'],
    [['压力', 'pressure', '压强'], 'aether.pressure-gauge'],
    [['能耗', '能量', 'energy', '功率'], 'aether.energy-card'],
    [['电压', 'voltage'], 'aether.voltage-card'],
    [['电流', 'current'], 'aether.current-card'],
    [['振动', 'vibration'], 'aether.vibration-trend'],
    [['流量', 'flow'], 'aether.flow-counter'],
    [['电池', 'battery'], 'aether.battery-health'],
  ];
  const matched = keywords.find(([terms]) => terms.some((term) => lower.includes(term)));
  return getPluginById(matched?.[1] || DEFAULT_MQTT_PLUGIN_ID) || getPluginById(DEFAULT_MQTT_PLUGIN_ID)!;
}

function createLocalElement(
  id: string,
  name: string,
  type: ElementType,
  layout: Pick<SceneElement, 'x' | 'y' | 'w' | 'h'>,
  extra: Partial<AiElementDraft> = {},
): AiSceneOperation {
  return {
    kind: 'create-element',
    sceneId: 'new-scene',
    element: { id, type, name, ...layout, ...extra },
  };
}

function compactAiTitle(prompt: string): string {
  const firstClause = prompt
    .replace(/^\s*(请\s*)?(生成|创建|制作|做一个|做)\s*/i, '')
    .split(/[，,。；;]/)[0]
    .replace(/(的)?(场景|大屏)$/, '')
    .trim();
  return text(firstClause, '工业设备运行总览', 18);
}

export function createLocalAiSceneProposal(prompt: string): AiSceneProposal {
  const cleanPrompt = text(prompt, '工业实时数据监控场景', 240);
  if (/(产品发布|新品发布|keynote|主视觉)/i.test(cleanPrompt)) return createProductLaunchProposal(cleanPrompt);
  if (/(展厅序厅|序厅迎宾|品牌时间轴|品牌历程|数字沙盘|园区导览|互动体验墙|产品体验墙)/i.test(cleanPrompt)) return createExhibitionWallProposal(cleanPrompt);
  if (/(展陈|导览|展馆|museum|全景)/i.test(cleanPrompt)) return createExhibitionGuideProposal(cleanPrompt);
  if (/(saber|视觉动效|光效系统|动态视觉)/i.test(cleanPrompt)) return createMotionShowcaseProposal(cleanPrompt);
  const plugin = pluginForPrompt(cleanPrompt);
  const pluginMapping = getOfficialPluginRealtimeMapping(plugin);
  const pluginSample = (plugin.sample || {}) as Record<string, unknown>;
  const title = compactAiTitle(cleanPrompt);
  const operations: AiSceneOperation[] = [
    { kind: 'create-scene', sceneId: 'new-scene', name: `AI · ${title}`, duration: 14, bgColor: AI_SCENE_VISUAL_TOKENS.background },
    { kind: 'create-scene', sceneId: 'ai-detail', name: `AI · ${title} · 详情`, duration: 10, bgColor: AI_SCENE_VISUAL_TOKENS.background },
    createLocalElement('ai_vfx', '背景氛围', 'vfx', { x: 0, y: 0, w: 100, h: 100 }, {
      role: 'background',
      vfxMotionType: 'abyss-grid',
      vfxColorA: '#22d3ee',
      vfxColorB: '#7c3aed',
      vfxSpeed: 0.35,
      opacity: 18,
      blendMode: 'screen',
    }),
    createLocalElement('ai_title', '主标题', 'txt', { x: 6, y: 6, w: 88, h: 7 }, {
      role: 'page-title',
      content: title,
      fontSize: 32,
      color: '#f8fafc',
      textColor: '#f8fafc',
      fontWeight: '700',
      textAlign: 'left',
      animType: 'fade-in',
      animDur: 0.5,
    }),
    createLocalElement('ai_subtitle', '生成说明', 'txt', { x: 6, y: 14, w: 72, h: 3.5 }, {
      role: 'page-subtitle',
      content: '实时遥测  /  MQTT 链路  /  AETHER 场景编排',
      fontSize: 13,
      color: '#8ba4bc',
      textColor: '#8ba4bc',
      textAlign: 'left',
      animType: 'slide-up',
      animDur: 0.45,
    }),
    createLocalElement('ai_rule', '分隔线', 'shape', { x: 6, y: 20, w: 88, h: 0.5 }, {
      role: 'divider',
      backgroundType: 'solid',
      backgroundColor: '#22d3ee',
      opacity: 58,
      borderRadius: 1,
    }),
    createLocalElement('ai_metric', plugin.name, 'ui-component', { x: 6, y: 25, w: 27, h: 28 }, {
      role: 'primary-metric',
      uiComponentType: plugin.componentType,
      pluginId: plugin.id,
      uiComponentData: {
        ...pluginSample,
        label: pluginSample.label || pluginSample.title || '核心指标',
        dataBinding: { sourceId: 'mqtt.realtime', queryId: plugin.dataContract, refresh: 'realtime', mapping: pluginMapping, emptyState: 'placeholder' },
      },
      animType: 'zoom-in',
      animDur: 0.55,
    }),
    createLocalElement('ai_pressure', '压力状态', 'ui-component', { x: 36, y: 25, w: 27, h: 28 }, {
      role: 'secondary-metric',
      uiComponentType: 'gauge',
      pluginId: 'aether.pressure-gauge',
      uiComponentData: {
        label: '系统压力',
        value: 68,
        unit: 'kPa',
        status: 'normal',
        dataBinding: { sourceId: 'mqtt.realtime', queryId: 'pressure.v1', refresh: 'realtime', mapping: { value: 'value', status: 'status' }, emptyState: 'placeholder' },
      },
      animType: 'slide-up',
      animDur: 0.5,
    }),
    createLocalElement('ai_status', '状态摘要', 'ui-component', { x: 66, y: 25, w: 28, h: 28 }, {
      role: 'status-summary',
      uiComponentType: 'stats-table',
      pluginId: 'aether.stats-table',
      uiComponentData: {
        label: '状态摘要',
        rows: [
          { label: '数据链路', value: '在线', status: '正常' },
          { label: '边缘网关', value: '1.8s', status: '在线' },
        ],
        dataBinding: { sourceId: 'mqtt.realtime', queryId: 'table.v1', refresh: 'realtime', mapping: { rows: 'rows', status: 'status' }, emptyState: 'placeholder' },
      },
      animType: 'slide-up',
      animDur: 0.6,
    }),
    createLocalElement('ai_trend', '趋势分析', 'ui-component', { x: 6, y: 58, w: 58, h: 29 }, {
      role: 'trend-analysis',
      uiComponentType: 'trend-line',
      pluginId: 'aether.trend-line',
      uiComponentData: {
        label: '实时趋势',
        series: [32, 46, 41, 58, 52, 68, 64, 78],
        color: '#22d3ee',
        dataBinding: { sourceId: 'mqtt.realtime', queryId: 'series.v1', refresh: 'realtime', mapping: { series: 'series', status: 'status' }, emptyState: 'placeholder' },
      },
      animType: 'slide-up',
      animDur: 0.5,
    }),
    createLocalElement('ai_alerts', '事件列表', 'ui-component', { x: 66, y: 58, w: 28, h: 29 }, {
      role: 'event-list',
      uiComponentType: 'alert-list',
      pluginId: 'aether.alert-list',
      uiComponentData: {
        label: '实时事件',
        items: [],
        dataBinding: { sourceId: 'mqtt.realtime', queryId: 'alert.v1', refresh: 'realtime', mapping: { items: 'items', status: 'status' }, emptyState: 'placeholder' },
      },
      animType: 'slide-up',
      animDur: 0.65,
    }),
    createLocalElement('ai_detail_action', '查看详情', 'ui-component', { x: 78, y: 91, w: 16, h: 5 }, {
      uiComponentType: 'glow-button',
      uiComponentData: { label: '查看详情', color: '#22d3ee' },
      link: 'ai-detail',
      linkType: 'jump',
      trigger: 'click',
      hoverEffect: 'glow',
      hoverColor: '#22d3ee',
      hoverIntensity: 42,
      animType: 'fade-in',
      animDur: 0.5,
    }),
    {
      ...createLocalElement('ai_detail_title', '详情页标题', 'txt', { x: 6, y: 6, w: 88, h: 7 }, {
        role: 'page-title',
        content: `${title} · 设备详情`,
        fontSize: 32,
        color: '#f8fafc',
        textColor: '#f8fafc',
        fontWeight: '700',
        textAlign: 'left',
        animType: 'fade-in',
        animDur: 0.5,
      }),
      sceneId: 'ai-detail',
    },
    {
      ...createLocalElement('ai_overview_action', '返回总览', 'ui-component', { x: 6, y: 91, w: 18, h: 5 }, {
        uiComponentType: 'glow-button',
        uiComponentData: { label: '返回总览', color: '#22d3ee' },
        link: 'new-scene',
        linkType: 'jump',
        trigger: 'click',
        hoverEffect: 'glow',
        hoverColor: '#22d3ee',
        hoverIntensity: 35,
        animType: 'fade-in',
        animDur: 0.5,
      }),
      sceneId: 'ai-detail',
    },
  ];
  operations.push(
    { kind: 'bind-mqtt', sceneId: 'new-scene', targetElementId: 'ai_metric', pluginId: plugin.id },
    { kind: 'bind-mqtt', sceneId: 'new-scene', targetElementId: 'ai_pressure', pluginId: 'aether.pressure-gauge' },
    { kind: 'bind-mqtt', sceneId: 'new-scene', targetElementId: 'ai_trend', pluginId: 'aether.trend-line' },
    { kind: 'bind-mqtt', sceneId: 'new-scene', targetElementId: 'ai_status', pluginId: 'aether.stats-table' },
    { kind: 'bind-mqtt', sceneId: 'new-scene', targetElementId: 'ai_alerts', pluginId: 'aether.alert-list' },
  );
  return sanitizeAiSceneProposal({
    title: `AI 场景方案 · ${title}`,
    summary: `已生成一个可编辑的新场景，包含标题、指标、趋势、状态、事件和科技氛围层，并默认接入 MQTT 样例数据。`,
    operations,
    design: DEFAULT_AI_SCENE_DESIGN,
    warnings: [],
    generatedAt: new Date().toISOString(),
  }, 'local')!;
}

function createProductLaunchProposal(prompt: string): AiSceneProposal {
  const title = compactAiTitle(prompt);
  const operations: AiSceneOperation[] = [
    { kind: 'create-scene', sceneId: 'launch', name: `模板 · ${title}`, duration: 12, bgColor: '#101316' },
    { kind: 'create-scene', sceneId: 'launch-detail', name: `${title} · 核心卖点`, duration: 10, bgColor: '#101316' },
    createLocalElement('launch_vfx', '产品氛围', 'vfx', { x: 0, y: 0, w: 100, h: 100 }, { role: 'background', vfxMotionType: 'nebula', vfxColorA: '#8b5cf6', vfxColorB: '#fb7185', opacity: 16, vfxSpeed: 0.2 }),
    createLocalElement('launch_eyebrow', '产品分类', 'txt', { x: 8, y: 13, w: 32, h: 3 }, { content: 'NEW RELEASE / 2026', fontSize: 12, color: '#c4b5fd', textColor: '#c4b5fd', letterSpacing: 2, animType: 'fade-in' }),
    createLocalElement('launch_title', '产品标题', 'txt', { x: 8, y: 20, w: 48, h: 16 }, { role: 'page-title', content: title, fontSize: 36, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700', animType: 'slide-up' }),
    createLocalElement('launch_copy', '核心说明', 'txt', { x: 8, y: 39, w: 42, h: 8 }, { content: '为下一代体验而设计。以更少的界面承载更明确的价值。', fontSize: 14, color: '#aeb9c6', textColor: '#aeb9c6', animType: 'fade-in' }),
    createLocalElement('launch_product', '产品主体占位', 'shape', { x: 58, y: 14, w: 30, h: 54 }, { shapeKind: 'rounded-rect', backgroundType: 'gradient', gradientStart: '#1d2735', gradientVia: '#8b5cf6', gradientEnd: '#f8fafc', borderRadius: 8, boxShadow: '0 24px 64px rgba(139,92,246,.34)', animType: 'zoom-in', animDur: 0.7 }),
    createLocalElement('launch_point_1', '卖点一', 'ui-component', { x: 8, y: 58, w: 22, h: 13 }, { uiComponentType: 'metric-card', pluginId: 'aether.metric-card', uiComponentData: { label: '设计语言', value: '更纯粹', unit: '' }, animType: 'slide-up' }),
    createLocalElement('launch_point_2', '卖点二', 'ui-component', { x: 33, y: 58, w: 22, h: 13 }, { uiComponentType: 'metric-card', pluginId: 'aether.metric-card', uiComponentData: { label: '关键能力', value: '更清晰', unit: '' }, animType: 'slide-up' }),
    createLocalElement('launch_action', '查看核心卖点', 'ui-component', { x: 8, y: 80, w: 18, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: '查看核心卖点', color: '#c4b5fd' }, link: 'launch-detail', linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: 'launch-detail' } }),
    { ...createLocalElement('launch_detail_title', '详情标题', 'txt', { x: 8, y: 12, w: 72, h: 10 }, { role: 'page-title', content: `${title} · 核心卖点`, fontSize: 32, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700' }), sceneId: 'launch-detail' },
    { ...createLocalElement('launch_back', '返回发布页', 'ui-component', { x: 8, y: 84, w: 17, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: '返回发布页', color: '#c4b5fd' }, link: 'launch', linkType: 'jump', trigger: 'click' }), sceneId: 'launch-detail' },
  ];
  operations.forEach((operation) => {
    if (operation.kind === 'create-element' && operation.sceneId === 'new-scene') operation.sceneId = 'launch';
  });
  return sanitizeAiSceneProposal({ title: `产品发布模板 · ${title}`, summary: '已应用产品发布模板：主视觉、可替换产品主体、卖点卡片与双场景跳转均可直接编辑。', operations, design: DEFAULT_AI_SCENE_DESIGN, warnings: ['产品主体为可替换形状占位，请在素材库中替换为最终产品图或 3D 模型。'], generatedAt: new Date().toISOString() }, 'local')!;
}

function createExhibitionGuideProposal(prompt: string): AiSceneProposal {
  const title = compactAiTitle(prompt);
  const operations: AiSceneOperation[] = [
    { kind: 'create-scene', sceneId: 'guide', name: `模板 · ${title}`, duration: 16, bgColor: '#07111d' },
    { kind: 'create-scene', sceneId: 'guide-detail', name: `${title} · 展项详情`, duration: 12, bgColor: '#07111d' },
    createLocalElement('guide_background', '全景素材占位', 'panorama-img', { x: 0, y: 0, w: 100, h: 100 }, { refId: '', opacity: 72, panoramaAutoRotate: true, panoramaAutoRotateSpeed: 0.18 }),
    createLocalElement('guide_tint', '全景遮罩', 'shape', { x: 0, y: 0, w: 100, h: 100 }, { backgroundType: 'gradient', gradientStart: '#07111d', gradientVia: '#0f3b45', gradientEnd: '#07111d', opacity: 28 }),
    createLocalElement('guide_title', '导览标题', 'txt', { x: 7, y: 8, w: 66, h: 8 }, { role: 'page-title', content: title, fontSize: 32, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700' }),
    createLocalElement('guide_hint', '导览提示', 'txt', { x: 7, y: 17, w: 48, h: 4 }, { content: '选择展项，进入沉浸式内容', fontSize: 13, color: '#b2c9d6', textColor: '#b2c9d6' }),
    createLocalElement('guide_hotspot_1', '展项 A', 'ui-component', { x: 23, y: 43, w: 15, h: 7 }, { uiComponentType: 'glow-button', uiComponentData: { label: '展项 A', color: '#fbbf24' }, link: 'guide-detail', linkType: 'jump', trigger: 'click', hoverEffect: 'glow', interaction: { trigger: 'click', action: 'jump', target: 'guide-detail' } }),
    createLocalElement('guide_hotspot_2', '展项 B', 'ui-component', { x: 61, y: 32, w: 15, h: 7 }, { uiComponentType: 'glow-button', uiComponentData: { label: '展项 B', color: '#fbbf24' }, link: 'guide-detail', linkType: 'jump', trigger: 'click', hoverEffect: 'glow', interaction: { trigger: 'click', action: 'jump', target: 'guide-detail' } }),
    { ...createLocalElement('guide_detail_title', '展项详情标题', 'txt', { x: 8, y: 10, w: 76, h: 8 }, { role: 'page-title', content: `${title} · 展项详情`, fontSize: 32, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700' }), sceneId: 'guide-detail' },
    { ...createLocalElement('guide_detail_copy', '展项正文', 'txt', { x: 8, y: 24, w: 58, h: 20 }, { content: '在这里替换展项文字、视频或 3D 模型。当前内容与热点均可在编辑器中修改。', fontSize: 15, color: '#b2c9d6', textColor: '#b2c9d6' }), sceneId: 'guide-detail' },
    { ...createLocalElement('guide_back', '返回导览', 'ui-component', { x: 8, y: 84, w: 16, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: '返回导览', color: '#fbbf24' }, link: 'guide', linkType: 'jump', trigger: 'click' }), sceneId: 'guide-detail' },
  ];
  operations.forEach((operation) => {
    if (operation.kind === 'create-element' && operation.sceneId === 'new-scene') operation.sceneId = 'guide';
  });
  return sanitizeAiSceneProposal({ title: `展陈导览模板 · ${title}`, summary: '已应用展陈导览模板：全景承载层、可点击热点和详情页均已生成。', operations, design: DEFAULT_AI_SCENE_DESIGN, warnings: ['全景层未虚构外部地址，请从素材库指定最终全景图或视频。'], generatedAt: new Date().toISOString() }, 'local')!;
}

type ExhibitionWallVariant = 'foyer' | 'timeline' | 'sandtable' | 'experience';

function getExhibitionWallVariant(prompt: string): ExhibitionWallVariant {
  if (/(品牌时间轴|品牌历程|里程碑)/i.test(prompt)) return 'timeline';
  if (/(数字沙盘|园区导览|空间导览)/i.test(prompt)) return 'sandtable';
  if (/(互动体验墙|产品体验墙|体验展墙)/i.test(prompt)) return 'experience';
  return 'foyer';
}

function createExhibitionWallProposal(prompt: string): AiSceneProposal {
  const variant = getExhibitionWallVariant(prompt);
  const title = compactAiTitle(prompt);
  const config = {
    foyer: { sceneId: 'foyer', detailId: 'foyer-zone', label: '展厅序厅迎宾', accent: '#38bdf8', bg: '#07111d', subtitle: '从序厅开始，进入品牌与展区的沉浸式叙事', action: '进入核心展区', detail: '核心展区内容' },
    timeline: { sceneId: 'timeline', detailId: 'timeline-detail', label: '品牌时间轴叙事', accent: '#a78bfa', bg: '#111025', subtitle: '用里程碑串联品牌、技术与未来', action: '查看阶段故事', detail: '品牌里程碑详情' },
    sandtable: { sceneId: 'sandtable', detailId: 'zone-detail', label: '园区数字沙盘', accent: '#2dd4bf', bg: '#071916', subtitle: '选择园区分区，查看空间、产业与服务能力', action: '查看分区详情', detail: '园区分区详情' },
    experience: { sceneId: 'experience', detailId: 'experience-detail', label: '互动产品体验墙', accent: '#fb7185', bg: '#160d19', subtitle: '围绕产品主体和关键能力构建触控展墙', action: '开始体验', detail: '产品体验详情' },
  }[variant];

  const operations: AiSceneOperation[] = [
    { kind: 'create-scene', sceneId: config.sceneId, name: `展厅大屏 · ${config.label}`, duration: 18, bgColor: config.bg },
    { kind: 'create-scene', sceneId: config.detailId, name: `${config.label} · ${config.detail}`, duration: 12, bgColor: config.bg },
    createLocalElement(`${variant}_vfx`, '展厅氛围背景', 'vfx', { x: 0, y: 0, w: 100, h: 100 }, { role: 'background', vfxMotionType: variant === 'sandtable' ? 'abyss-grid' : 'nebula', vfxColorA: config.accent, vfxColorB: '#0f172a', opacity: 18, vfxSpeed: 0.18 }),
    createLocalElement(`${variant}_title`, '展厅主标题', 'txt', { x: 6, y: 7, w: 88, h: 7 }, { role: 'page-title', content: title, fontSize: 34, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700', animType: 'fade-in', animDur: 0.45 }),
    createLocalElement(`${variant}_subtitle`, '展厅导览说明', 'txt', { x: 6, y: 15, w: 62, h: 4 }, { role: 'page-subtitle', content: config.subtitle, fontSize: 13, color: '#b6c5d5', textColor: '#b6c5d5', animType: 'slide-up', animDur: 0.4 }),
    createLocalElement(`${variant}_rule`, '展厅分隔线', 'shape', { x: 6, y: 21, w: 88, h: 0.5 }, { role: 'divider', backgroundType: 'solid', backgroundColor: config.accent, opacity: 65, borderRadius: 1 }),
  ];

  if (variant === 'timeline') {
    operations.push(
      createLocalElement('timeline_line', '品牌时间轴光带', 'saber', { x: 8, y: 34, w: 84, h: 7 }, { saberPreset: 'neon', saberGlowColor: config.accent, saberSecondaryGlowColor: '#38bdf8', saberCoreColor: '#ffffff', saberGlowIntensity: 48, saberCoreWidth: 2, saberPath: 'M 2 50 L 98 50', animType: 'fade-in', animDur: 0.7 }),
      ...['创立', '突破', '拓展', '未来'].map((label, index) => createLocalElement(`timeline_${index}`, `${label}里程碑`, 'ui-component', { x: 8 + index * 21, y: 48, w: 18, h: 18 }, { uiComponentType: 'metric-card', pluginId: 'aether.metric-card', uiComponentData: { label: `${2012 + index * 4} · ${label}`, value: index === 3 ? 'NEXT' : `${index + 1}.0`, unit: '' }, animType: 'slide-up', animDur: 0.35 + index * 0.08 })),
      createLocalElement('timeline_action', config.action, 'ui-component', { x: 8, y: 78, w: 19, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: config.action, color: config.accent }, link: config.detailId, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: config.detailId } }),
    );
  } else if (variant === 'sandtable') {
    operations.push(
      createLocalElement('sandtable_model', '园区数字沙盘可替换位', 'shape', { x: 33, y: 29, w: 34, h: 39 }, { shapeKind: 'rounded-rect', backgroundType: 'gradient', gradientStart: '#0e2f2c', gradientVia: '#115e59', gradientEnd: '#0f172a', borderColor: config.accent, borderWidth: 1, borderRadius: 6, boxShadow: `0 0 36px ${config.accent}44`, animType: 'zoom-in', animDur: 0.6 }),
      createLocalElement('sandtable_zone_a', '产业园区热点', 'ui-component', { x: 8, y: 33, w: 19, h: 7 }, { uiComponentType: 'glow-button', uiComponentData: { label: '产业园区', color: config.accent }, link: config.detailId, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: config.detailId } }),
      createLocalElement('sandtable_zone_b', '生活配套热点', 'ui-component', { x: 72, y: 40, w: 19, h: 7 }, { uiComponentType: 'glow-button', uiComponentData: { label: '生活配套', color: config.accent }, link: config.detailId, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: config.detailId } }),
      createLocalElement('sandtable_zone_c', '创新中心热点', 'ui-component', { x: 41, y: 75, w: 19, h: 7 }, { uiComponentType: 'glow-button', uiComponentData: { label: '创新中心', color: config.accent }, link: config.detailId, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: config.detailId } }),
    );
  } else {
    if (variant === 'foyer') operations.push(createLocalElement('foyer_panorama', '序厅全景可替换位', 'panorama-img', { x: 0, y: 0, w: 100, h: 100 }, { role: 'background', refId: '', opacity: 55, panoramaAutoRotate: true, panoramaAutoRotateSpeed: 0.16 }));
    operations.push(
      createLocalElement(`${variant}_feature`, variant === 'experience' ? '产品主体可替换位' : '展厅主视觉可替换位', 'shape', { x: 52, y: 28, w: 38, h: 45 }, { shapeKind: 'rounded-rect', backgroundType: 'gradient', gradientStart: '#16273a', gradientVia: config.accent, gradientEnd: '#f8fafc', opacity: 82, borderRadius: 7, boxShadow: `0 18px 48px ${config.accent}33`, animType: 'zoom-in', animDur: 0.6 }),
      ...['核心叙事', '重点展项', '沉浸体验'].map((label, index) => createLocalElement(`${variant}_card_${index}`, label, 'ui-component', { x: 7, y: 28 + index * 16, w: 37, h: 12 }, { uiComponentType: 'metric-card', pluginId: 'aether.metric-card', uiComponentData: { label, value: variant === 'experience' ? ['触控', '联动', '定制'][index] : ['01', '02', '03'][index], unit: '' }, animType: 'slide-up', animDur: 0.35 + index * 0.08 })),
      createLocalElement(`${variant}_action`, config.action, 'ui-component', { x: 7, y: 79, w: 20, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: config.action, color: config.accent }, link: config.detailId, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: config.detailId } }),
    );
  }

  operations.push(
    { ...createLocalElement(`${variant}_detail_title`, '详情页标题', 'txt', { x: 6, y: 7, w: 88, h: 7 }, { role: 'page-title', content: `${config.label} · ${config.detail}`, fontSize: 32, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700', animType: 'fade-in' }), sceneId: config.detailId },
    { ...createLocalElement(`${variant}_detail_media`, '详情主视觉可替换位', 'shape', { x: 6, y: 27, w: 46, h: 43 }, { shapeKind: 'rounded-rect', backgroundType: 'gradient', gradientStart: '#142236', gradientVia: config.accent, gradientEnd: '#0f172a', borderRadius: 6, opacity: 82 }), sceneId: config.detailId },
    { ...createLocalElement(`${variant}_detail_info`, '详情信息卡', 'ui-component', { x: 58, y: 27, w: 35, h: 28 }, { uiComponentType: 'stats-table', pluginId: 'aether.stats-table', uiComponentData: { label: config.detail, rows: [{ label: '内容类型', value: '可编辑', status: '就绪' }, { label: '交互状态', value: '已配置', status: '可用' }] }, animType: 'slide-up' }), sceneId: config.detailId },
    { ...createLocalElement(`${variant}_back`, '返回展厅大屏', 'ui-component', { x: 6, y: 82, w: 18, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: '返回展厅大屏', color: config.accent }, link: config.sceneId, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target: config.sceneId } }), sceneId: config.detailId },
  );
  operations.forEach((operation) => {
    if (operation.kind === 'create-element' && operation.sceneId === 'new-scene') operation.sceneId = config.sceneId;
  });
  return sanitizeAiSceneProposal({
    title: `展厅大屏模板 · ${config.label}`,
    summary: `已生成 ${config.label} 的主场景与详情场景，包含可替换主视觉位、可编辑内容层和可点击场景跳转。`,
    operations,
    design: DEFAULT_AI_SCENE_DESIGN,
    warnings: ['全景、主视觉和沙盘均为本地可替换占位；请从素材库指定最终图片、视频或 3D 模型。'],
    generatedAt: new Date().toISOString(),
  }, 'local')!;
}

function createMotionShowcaseProposal(prompt: string): AiSceneProposal {
  const title = compactAiTitle(prompt);
  const operations: AiSceneOperation[] = [
    { kind: 'create-scene', sceneId: 'motion', name: `模板 · ${title}`, duration: 12, bgColor: '#090d18' },
    createLocalElement('motion_vfx', '动态背景', 'vfx', { x: 0, y: 0, w: 100, h: 100 }, { role: 'background', vfxMotionType: 'abyss-grid', vfxColorA: '#8b5cf6', vfxColorB: '#22d3ee', opacity: 20, vfxSpeed: 0.25 }),
    createLocalElement('motion_title', '动效标题', 'txt', { x: 9, y: 17, w: 56, h: 10 }, { role: 'page-title', content: title, fontSize: 36, color: '#f8fafc', textColor: '#f8fafc', fontWeight: '700', animType: 'slide-up', animDur: 0.6 }),
    createLocalElement('motion_copy', '动效说明', 'txt', { x: 9, y: 29, w: 48, h: 6 }, { content: '节制的光线与进入节奏，为内容建立层次。', fontSize: 14, color: '#b2c9d6', textColor: '#b2c9d6', animType: 'fade-in' }),
    createLocalElement('motion_saber', '主光带', 'saber', { x: 58, y: 24, w: 30, h: 18 }, { saberPreset: 'neon', saberGlowColor: '#8b5cf6', saberSecondaryGlowColor: '#22d3ee', saberCoreColor: '#ffffff', saberGlowIntensity: 65, saberCoreWidth: 3, saberPath: 'M 5 80 C 25 10 60 95 95 20', animType: 'fade-in', loopAnim: 'float' }),
    createLocalElement('motion_card', '节奏说明', 'ui-component', { x: 9, y: 54, w: 32, h: 20 }, { uiComponentType: 'metric-card', pluginId: 'aether.metric-card', uiComponentData: { label: '入场节奏', value: '600', unit: 'ms' }, animType: 'slide-up' }),
    createLocalElement('motion_action', '查看动效规范', 'ui-component', { x: 9, y: 82, w: 18, h: 6 }, { uiComponentType: 'glow-button', uiComponentData: { label: '查看动效规范', color: '#8b5cf6' }, trigger: 'click', hoverEffect: 'glow' }),
  ];
  operations.forEach((operation) => {
    if (operation.kind === 'create-element' && operation.sceneId === 'new-scene') operation.sceneId = 'motion';
  });
  return sanitizeAiSceneProposal({ title: `视觉动效模板 · ${title}`, summary: '已应用视觉动效模板：背景氛围、Saber 光带和分层进入节奏均可在时间线中编辑。', operations, design: DEFAULT_AI_SCENE_DESIGN, warnings: [], generatedAt: new Date().toISOString() }, 'local')!;
}

function rectanglesOverlap(a: Pick<SceneElement, 'x' | 'y' | 'w' | 'h'>, b: Pick<SceneElement, 'x' | 'y' | 'w' | 'h'>): boolean {
  const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlapW > 1 && overlapH > 1;
}

function findNonOverlappingPosition(
  candidate: Pick<SceneElement, 'x' | 'y' | 'w' | 'h'>,
  occupied: SceneElement[],
): { x: number; y: number; adjusted: boolean } {
  if (!occupied.some((element) => rectanglesOverlap(candidate, element))) return { x: candidate.x, y: candidate.y, adjusted: false };
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const x = Math.min(100 - candidate.w, Math.max(0, candidate.x + column * 3));
      const y = Math.min(100 - candidate.h, Math.max(0, candidate.y + row * 3));
      const next = { ...candidate, x, y };
      if (!occupied.some((element) => rectanglesOverlap(next, element))) return { x, y, adjusted: true };
    }
  }
  return { x: candidate.x, y: candidate.y, adjusted: false };
}

function buildMqttData(pluginId: string | undefined, existing: unknown): Record<string, unknown> {
  const plugin = getPluginById(pluginId || DEFAULT_MQTT_PLUGIN_ID) || getPluginById(DEFAULT_MQTT_PLUGIN_ID)!;
  const mapping = getOfficialPluginRealtimeMapping(plugin);
  const sample = isRecord(plugin.sample) ? plugin.sample : {};
  return {
    ...sample,
    ...(isRecord(existing) ? existing : {}),
    pluginId: plugin.id,
    pluginVersion: plugin.version,
    dataBinding: {
      sourceId: 'mqtt.realtime',
      queryId: plugin.dataContract,
      refresh: 'realtime',
      mapping,
      freshness: { warningAfterMs: 5000, offlineAfterMs: 15000 },
      emptyState: 'placeholder',
    },
  };
}

export function applyAiSceneProposal(project: ProjectData, proposal: AiSceneProposal, activeSceneId: string): ApplyAiSceneResult {
  const requestedScenes = proposal.operations
    .map((operation, index) => ({ operation, index }))
    .filter((entry): entry is { operation: Extract<AiSceneOperation, { kind: 'create-scene' }>; index: number } => entry.operation.kind === 'create-scene');
  const createdSceneIds = requestedScenes.map(({ index }) => `ai_scene_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`);
  const createdSceneId = createdSceneIds[0];
  const sceneIdMap = new Map<string, string>();
  requestedScenes.forEach(({ operation }, index) => {
    const requestedId = operation.sceneId || `new-scene-${index}`;
    if (!sceneIdMap.has(requestedId)) sceneIdMap.set(requestedId, createdSceneIds[index]);
  });
  const resolveSceneId = (requested?: string) => {
    const requestedId = requested?.trim();
    if (!requestedId || requestedId === 'active-scene' || requestedId === 'current-scene') return activeSceneId;
    return sceneIdMap.get(requestedId) || requestedId || createdSceneId || activeSceneId;
  };

  const nextScenes = { ...project.scenes };
  requestedScenes.forEach(({ operation }, index) => {
    const newSceneId = createdSceneIds[index];
    nextScenes[newSceneId] = {
      id: newSceneId,
      alias: operation.name,
      type: 'scene',
      duration: operation.duration || 12,
      cruiseDuration: Math.min(operation.duration || 12, 8),
      bgColor: operation.bgColor || '#07111d',
      transitionIn: 'fade',
      transitionOut: 'fade',
      transitionDuration: 0.6,
      els: [],
    };
  });

  const createdElementIds: string[] = [];
  const requestedElementIds = new Map<string, string>();
  const operationElementIds = new Map<number, string>();
  const skippedOperationIndexes: number[] = [];
  let appliedOperationCount = requestedScenes.length;
  let adjustedCount = 0;
  const occupiedByScene = new Map<string, SceneElement[]>();

  proposal.operations.forEach((operation, operationIndex) => {
    if (operation.kind !== 'create-element') return;
    const targetSceneId = resolveSceneId(operation.sceneId);
    const targetScene = nextScenes[targetSceneId];
    if (!targetScene) {
      skippedOperationIndexes.push(operationIndex);
      return;
    }
    const draft = operation.element;
    const pluginId = draft.pluginId || (isRecord(draft.uiComponentData) && typeof draft.uiComponentData.pluginId === 'string' ? draft.uiComponentData.pluginId : undefined);
    const requestedId = typeof draft.id === 'string' ? draft.id : undefined;
    const actualId = `ai_el_${Date.now()}_${operationIndex}_${Math.random().toString(36).slice(2, 6)}`;
    const x = numberInRange(draft.x, 10, 0, 96);
    const y = numberInRange(draft.y, 10, 0, 96);
    const isBackgroundEffect = draft.type === 'vfx';
    const base: SceneElement = {
      ...draft,
      id: actualId,
      type: draft.type,
      refId: typeof draft.refId === 'string' ? draft.refId : '',
      sourceName: text(draft.name || draft.sourceName, 'AI 图层', 100),
      x,
      y,
      w: Math.min(numberInRange(draft.w, 24, 1, 100), 100 - x),
      h: Math.min(numberInRange(draft.h, 16, 1, 100), 100 - y),
      rot: numberInRange(draft.rot, 0, -360, 360),
      zIndex: isBackgroundEffect ? 0 : Math.max(0, ...targetScene.els.map((element) => element.zIndex || 0), ...(occupiedByScene.get(targetSceneId) || []).map((element) => element.zIndex || 0)) + 10,
      opacity: numberInRange(draft.opacity, 100, 0, 100),
      blendMode: draft.blendMode || 'normal',
      visible: draft.visible !== false,
      locked: false,
      startTime: numberInRange(draft.startTime, 0, 0, 86400),
      duration: numberInRange(draft.duration, 6, 0.1, 86400),
      animType: draft.animType || (draft.type === 'ui-component' ? 'slide-up' : 'none'),
      animDur: numberInRange(draft.animDur, 0.5, 0, 30),
      exitAnimType: draft.exitAnimType || 'fade-out',
      exitAnimDur: numberInRange(draft.exitAnimDur, 0.4, 0, 30),
      content: typeof draft.content === 'string' ? draft.content : draft.type === 'txt' ? 'AI TEXT' : undefined,
      color: draft.color,
      textColor: draft.textColor || draft.color,
      fontSize: draft.fontSize,
      fontFamily: draft.fontFamily,
      fontWeight: draft.fontWeight,
      textAlign: draft.textAlign,
      backgroundType: draft.backgroundType,
      backgroundColor: draft.backgroundColor,
      gradientType: draft.gradientType,
      gradientStart: draft.gradientStart,
      gradientVia: draft.gradientVia,
      gradientEnd: draft.gradientEnd,
      gradientAngle: draft.gradientAngle,
      borderRadius: draft.borderRadius,
      borderWidth: draft.borderWidth,
      borderColor: draft.borderColor,
      boxShadow: draft.boxShadow,
      backdropBlur: draft.backdropBlur,
      uiComponentType: draft.uiComponentType,
      uiComponentData: draft.type === 'ui-component'
        ? { ...buildMqttData(pluginId, draft.uiComponentData), aiLayoutManaged: true }
        : draft.uiComponentData,
      vfxMotionType: draft.vfxMotionType,
      vfxColorA: draft.vfxColorA,
      vfxColorB: draft.vfxColorB,
      vfxColorC: draft.vfxColorC,
      vfxSpeed: draft.vfxSpeed,
      vfxParams: draft.vfxParams,
      chartKind: draft.chartKind,
      chartData: draft.chartData,
      chartTitle: draft.chartTitle,
      chartColors: draft.chartColors,
      bindText: draft.bindText,
      bindValue: draft.bindValue,
      // AI proposals refer to scenes by their stable request ids. Resolve both
      // legacy link fields and the modern interaction config after scene ids are created.
      link: draft.link ? sceneIdMap.get(draft.link) || draft.link : draft.link,
      interaction: isRecord(draft.interaction)
        ? {
            ...draft.interaction,
            target: typeof draft.interaction.target === 'string'
              ? sceneIdMap.get(draft.interaction.target) || draft.interaction.target
              : draft.interaction.target,
          }
        : draft.interaction,
    };
    const occupied = occupiedByScene.get(targetSceneId) || targetScene.els.filter((element) => element.type !== 'vfx' && element.type !== 'saber');
    const position = isBackgroundEffect ? { x: base.x, y: base.y, adjusted: false } : findNonOverlappingPosition(base, occupied);
    if (position.adjusted) adjustedCount += 1;
    const placed = { ...base, x: position.x, y: position.y };
    if (!isBackgroundEffect && draft.type !== 'saber') {
      occupied.push(placed);
      occupiedByScene.set(targetSceneId, occupied);
    }
    nextScenes[targetSceneId] = { ...targetScene, els: [...targetScene.els, placed], duration: Math.max(targetScene.duration || 1, placed.startTime + placed.duration) };
    createdElementIds.push(actualId);
    operationElementIds.set(operationIndex, actualId);
    if (requestedId) requestedElementIds.set(requestedId, actualId);
    appliedOperationCount += 1;
  });

  proposal.operations.forEach((operation, operationIndex) => {
    if (operation.kind === 'create-scene' || operation.kind === 'create-element') return;
    const targetSceneId = resolveSceneId(operation.sceneId);
    const targetScene = nextScenes[targetSceneId];
    if (!targetScene) {
      skippedOperationIndexes.push(operationIndex);
      return;
    }
    if (operation.kind === 'update-scene') {
      nextScenes[targetSceneId] = { ...targetScene, ...operation.patch };
      appliedOperationCount += 1;
      return;
    }
    const targetId = 'elementId' in operation && operation.elementId
      ? requestedElementIds.get(operation.elementId) || operation.elementId
      : 'targetOperation' in operation && operation.targetOperation !== undefined
        ? operationElementIds.get(operation.targetOperation)
        : undefined;
    if (operation.kind === 'update-element') {
      const targetElement = targetId ? targetScene.els.find((element) => element.id === targetId) : undefined;
      if (!targetElement) {
        skippedOperationIndexes.push(operationIndex);
        return;
      }
      nextScenes[targetSceneId] = {
        ...targetScene,
        els: targetScene.els.map((element) => element.id === targetId ? { ...element, ...operation.patch, id: element.id, type: element.type } : element),
      };
      appliedOperationCount += 1;
      return;
    }
    if (operation.kind === 'delete-element') {
      if (!targetId || !targetScene.els.some((element) => element.id === targetId)) {
        skippedOperationIndexes.push(operationIndex);
        return;
      }
      nextScenes[targetSceneId] = { ...targetScene, els: targetScene.els.filter((element) => element.id !== targetId) };
      appliedOperationCount += 1;
      return;
    }
    if (operation.kind === 'reorder-elements') {
      const requestedIds = operation.elementIds.map((id) => requestedElementIds.get(id) || id);
      const existing = targetScene.els.filter((element) => requestedIds.includes(element.id));
      if (!existing.length) {
        skippedOperationIndexes.push(operationIndex);
        return;
      }
      const ordered = [...existing].sort((a, b) => requestedIds.indexOf(a.id) - requestedIds.indexOf(b.id));
      const untouched = targetScene.els.filter((element) => !requestedIds.includes(element.id));
      nextScenes[targetSceneId] = {
        ...targetScene,
        els: [...untouched, ...ordered.map((element, index) => ({ ...element, zIndex: (index + 1) * 10 }))],
      };
      appliedOperationCount += 1;
      return;
    }
    if (operation.kind !== 'bind-mqtt') return;
    const mqttTargetId = operation.targetElementId
      ? requestedElementIds.get(operation.targetElementId) || operation.targetElementId
      : operation.targetOperation !== undefined
        ? operationElementIds.get(operation.targetOperation)
        : undefined;
    const targetElement = mqttTargetId ? nextScenes[targetSceneId].els.find((element) => element.id === mqttTargetId) : undefined;
    if (!targetElement || targetElement.type !== 'ui-component') {
      skippedOperationIndexes.push(operationIndex);
      return;
    }
    nextScenes[targetSceneId] = {
      ...nextScenes[targetSceneId],
      els: nextScenes[targetSceneId].els.map((element) => (
        element.id === mqttTargetId && element.type === 'ui-component'
          ? { ...element, uiComponentData: buildMqttData(operation.pluginId, element.uiComponentData) }
          : element
      )),
    };
    appliedOperationCount += 1;
  });

  return {
    project: {
      ...project,
      meta: { ...project.meta, updatedAt: new Date().toISOString() },
      start: createdSceneId || project.start,
      scenes: nextScenes,
    },
    createdSceneId,
    createdElementIds,
    adjustedCount,
    appliedOperationCount,
    skippedOperationCount: skippedOperationIndexes.length,
    skippedOperationIndexes,
  };
}
