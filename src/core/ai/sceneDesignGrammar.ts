import type { ElementType } from '../../types';

export type AiSceneStyle = 'industrial-instrument' | 'reference-led';
export type AiSceneDensity = 'balanced' | 'dense' | 'spacious';
export type AiLayoutTemplate = 'control-room-overview' | 'metric-first' | 'trend-first' | 'reference-led';

export type AiElementRole =
  | 'background'
  | 'page-title'
  | 'page-subtitle'
  | 'divider'
  | 'primary-metric'
  | 'secondary-metric'
  | 'status-summary'
  | 'trend-analysis'
  | 'event-list'
  | 'footer';

export interface AiSceneDesign {
  style: AiSceneStyle;
  density: AiSceneDensity;
  layoutTemplate: AiLayoutTemplate;
}

/** Hard limits shared by model output, local fallbacks, and the visual audit. */
export const AI_SCENE_DESIGN_CONTRACT = {
  gridUnit: 0.5,
  minTextSize: 12,
  bodyTextSize: 14,
  titleMinSize: 24,
  maxSurfaceRadius: 8,
  maxAccentColors: 4,
  maxElements: 12,
  maxBackgroundEffects: 1,
  maxBackgroundEffectOpacity: 24,
} as const;

export const AI_SCENE_VISUAL_TOKENS = {
  background: '#07111D',
  surface: '#0D1B2A',
  textPrimary: '#F8FAFC',
  textSecondary: '#8BA4BC',
  textMuted: '#68839A',
  accentPrimary: '#22D3EE',
  accentSecondary: '#7C3AED',
} as const;

export const DEFAULT_AI_SCENE_DESIGN: AiSceneDesign = {
  style: 'industrial-instrument',
  density: 'balanced',
  layoutTemplate: 'control-room-overview',
};

const styles = new Set<AiSceneStyle>(['industrial-instrument', 'reference-led']);
const densities = new Set<AiSceneDensity>(['balanced', 'dense', 'spacious']);
const templates = new Set<AiLayoutTemplate>(['control-room-overview', 'metric-first', 'trend-first', 'reference-led']);
const roles = new Set<AiElementRole>([
  'background', 'page-title', 'page-subtitle', 'divider', 'primary-metric',
  'secondary-metric', 'status-summary', 'trend-analysis', 'event-list', 'footer',
]);

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function resolveAiSceneDesign(raw: unknown): AiSceneDesign {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const style = stringValue(value.style) as AiSceneStyle;
  const density = stringValue(value.density) as AiSceneDensity;
  const layoutTemplate = stringValue(value.layoutTemplate) as AiLayoutTemplate;
  return {
    style: styles.has(style) ? style : DEFAULT_AI_SCENE_DESIGN.style,
    density: densities.has(density) ? density : DEFAULT_AI_SCENE_DESIGN.density,
    layoutTemplate: templates.has(layoutTemplate) ? layoutTemplate : DEFAULT_AI_SCENE_DESIGN.layoutTemplate,
  };
}

export function normalizeAiElementRole(value: unknown): AiElementRole | undefined {
  const role = stringValue(value) as AiElementRole;
  return roles.has(role) ? role : undefined;
}

export function inferAiElementRole(element: {
  id?: unknown;
  name?: unknown;
  sourceName?: unknown;
  type?: ElementType;
  uiComponentType?: unknown;
  role?: unknown;
}): AiElementRole | undefined {
  const explicit = normalizeAiElementRole(element.role);
  if (explicit) return explicit;
  if (element.type === 'vfx' || element.type === 'saber') return 'background';

  const text = [element.id, element.name, element.sourceName, element.uiComponentType]
    .filter((item): item is string => typeof item === 'string')
    .join(' ')
    .toLowerCase();
  if (element.type === 'txt') {
    if (text.includes('title') || text.includes('标题')) return 'page-title';
    if (text.includes('subtitle') || text.includes('副标题') || text.includes('说明')) return 'page-subtitle';
    if (text.includes('footer') || text.includes('脚注')) return 'footer';
  }
  if (element.type === 'shape' && (text.includes('divider') || text.includes('rule') || text.includes('分隔'))) return 'divider';
  if (text.includes('trend') || text.includes('趋势')) return 'trend-analysis';
  if (text.includes('alert') || text.includes('event') || text.includes('事件') || text.includes('告警')) return 'event-list';
  if (text.includes('status') || text.includes('summary') || text.includes('状态') || text.includes('摘要')) return 'status-summary';
  return undefined;
}
