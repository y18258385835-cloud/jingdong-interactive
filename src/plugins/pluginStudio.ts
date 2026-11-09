import { GALAXY_COMPONENT_BASE_SIZE } from '../components/ui/galaxyComponentMeta';
import { getOfficialPluginRealtimeMapping, type OfficialPluginDefinition } from './registry';

export const USER_PLUGIN_STORAGE_KEY = 'aether_user_plugins_v1';

export const PLUGIN_STYLES = [
  { id: 'control-room', name: '控制室', accent: '#22d3ee', surface: '#0b1b2e', border: '#155e75' },
  { id: 'signal', name: '信号橙', accent: '#fb923c', surface: '#25160e', border: '#9a3412' },
  { id: 'paper', name: '工程白', accent: '#84cc16', surface: '#172018', border: '#4d7c0f' },
  { id: 'violet', name: '夜航紫', accent: '#a78bfa', surface: '#1d1833', border: '#6d28d9' },
] as const;

export type PluginStyleId = typeof PLUGIN_STYLES[number]['id'];
export interface AiPluginDraft {
  name: string;
  description: string;
  dataContract: string;
  tags: string[];
  telemetry: OfficialPluginDefinition['telemetry'];
}

export function validatePluginDefinition(input: unknown): { ok: true; plugin: OfficialPluginDefinition } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: '插件文件必须是 JSON 对象' };
  const value = input as Record<string, unknown>;
  const componentType = value.componentType;
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(value.id)) return { ok: false, error: 'id 只能包含字母、数字、点、下划线和短横线' };
  if (typeof value.name !== 'string' || !value.name.trim()) return { ok: false, error: '缺少插件名称' };
  if (typeof componentType !== 'string' || !Object.hasOwn(GALAXY_COMPONENT_BASE_SIZE, componentType)) return { ok: false, error: '组件类型不在安全渲染器白名单中' };
  if (typeof value.dataContract !== 'string' || !value.dataContract.trim()) return { ok: false, error: '缺少数据契约' };
  if (!value.sample || typeof value.sample !== 'object' || Array.isArray(value.sample)) return { ok: false, error: '缺少 sample 预览数据' };
  const telemetry = value.telemetry;
  if (telemetry !== undefined && (typeof telemetry !== 'object' || Array.isArray(telemetry))) return { ok: false, error: 'telemetry 必须是对象' };
  const plugin: OfficialPluginDefinition = {
    id: value.id as string,
    name: (value.name as string).trim(),
    description: typeof value.description === 'string' ? value.description : '用户创建的实时 UI 组件',
    category: typeof value.category === 'string' ? value.category as OfficialPluginDefinition['category'] : '用户组件',
    version: typeof value.version === 'string' ? value.version : '1.0.0',
    componentType: componentType as OfficialPluginDefinition['componentType'],
    status: 'installed',
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : ['用户组件'],
    sample: value.sample as Record<string, unknown>,
    dataContract: value.dataContract as string,
    telemetry: telemetry as OfficialPluginDefinition['telemetry'],
    source: value.source === 'ai' ? 'ai' : 'community',
    author: typeof value.author === 'string' ? value.author : '本地用户',
    schemaVersion: 1,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  };
  return { ok: true, plugin };
}

export function loadUserPlugins(): OfficialPluginDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(USER_PLUGIN_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(validatePluginDefinition).filter((result): result is { ok: true; plugin: OfficialPluginDefinition } => result.ok).map(({ plugin }) => plugin);
  } catch {
    return [];
  }
}

export function saveUserPlugins(plugins: OfficialPluginDefinition[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_PLUGIN_STORAGE_KEY, JSON.stringify(plugins.slice(-80)));
}

export function createAiPlugin(prompt: string, styleId: PluginStyleId, componentType: OfficialPluginDefinition['componentType']): OfficialPluginDefinition {
  const style = PLUGIN_STYLES.find((item) => item.id === styleId) || PLUGIN_STYLES[0];
  const cleanPrompt = prompt.trim().replace(/\s+/g, ' ').slice(0, 80) || '现场设备状态';
  const id = `ai.${Date.now().toString(36)}`;
  const sample: Record<string, unknown> = {
    label: cleanPrompt,
    title: cleanPrompt,
    value: 78,
    unit: '%',
    color: style.accent,
    accentColor: style.accent,
    surfaceColor: style.surface,
    borderColor: style.border,
  };
  const telemetry: OfficialPluginDefinition['telemetry'] = { value: 'metrics.onlineRate', unit: 'metrics.onlineUnit', status: 'status' };
  if (componentType === 'trend-line' || componentType === 'bar-chart') {
    sample.series = [62, 68, 71, 66, 78, 74];
    telemetry.series = 'series';
  } else if (componentType === 'stats-table') {
    sample.rows = [];
    telemetry.rows = 'rows';
  } else if (componentType === 'alert-list') {
    sample.items = [];
    telemetry.items = 'items';
  } else if (componentType === 'geo-map') {
    telemetry.location = 'location';
  } else if (componentType === 'topology') {
    telemetry.topology = 'topology';
  }
  const plugin: OfficialPluginDefinition = {
    id,
    name: cleanPrompt,
    description: `AI 生成 · ${style.name}风格 · MQTT 实时组件`,
    category: '用户组件' as OfficialPluginDefinition['category'],
    version: '1.0.0',
    componentType,
    status: 'installed',
    tags: ['AI生成', style.name, 'MQTT'],
    sample: { ...sample, dataBinding: { sourceId: 'mqtt.realtime', refresh: 'realtime' } },
    dataContract: `user.${componentType}.v1`,
    telemetry,
    source: 'ai',
    author: 'AI Design Studio',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
  };
  return plugin;
}

/** Model output only supplies metadata. Rendering and realtime binding stay platform-controlled. */
export function createAiPluginFromDraft(prompt: string, styleId: PluginStyleId, componentType: OfficialPluginDefinition['componentType'], draft: AiPluginDraft): OfficialPluginDefinition {
  const base = createAiPlugin(prompt, styleId, componentType);
  return {
    ...base,
    name: draft.name.trim().slice(0, 80) || base.name,
    description: draft.description.trim().slice(0, 240) || base.description,
    dataContract: draft.dataContract.trim().slice(0, 81) || base.dataContract,
    tags: [...new Set([...draft.tags.map((tag) => tag.trim().slice(0, 24)).filter(Boolean), 'AI生成', 'MQTT'])].slice(0, 12),
    telemetry: { ...base.telemetry, ...draft.telemetry },
  };
}

export function withRealtimeBinding(plugin: OfficialPluginDefinition): OfficialPluginDefinition {
  return {
    ...plugin,
    sample: { ...plugin.sample, dataBinding: { sourceId: 'mqtt.realtime', queryId: plugin.dataContract, refresh: 'realtime', mapping: getOfficialPluginRealtimeMapping(plugin), freshness: { warningAfterMs: 5000, offlineAfterMs: 15000 }, emptyState: 'placeholder' } },
  };
}
