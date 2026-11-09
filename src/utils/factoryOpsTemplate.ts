import type { ProjectData, Scene, SceneElement } from '../types';

const makeElement = (id: string, type: SceneElement['type'], x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id, type, refId: '', sourceName: id, x, y, w, h, zIndex: extra.zIndex ?? 1, opacity: extra.opacity ?? 100,
  startTime: 0, duration: 60, ...extra,
});

const text = (id: string, content: string, x: number, y: number, w: number, h: number, fontSize: number, color = '#172033', extra: Partial<SceneElement> = {}) => makeElement(id, 'txt', x, y, w, h, { content, color, fontSize, fontWeight: '700', ...extra });

const component = (id: string, type: string, x: number, y: number, w: number, h: number, data: Record<string, unknown>) => makeElement(id, 'ui-component', x, y, w, h, {
  uiComponentType: type, uiComponentData: { theme: 'light', textColor: '#172033', mutedTextColor: '#64748b', surfaceColor: '#ffffff', borderColor: '#dce4ec', ...data },
});

function createFactoryScene(): Scene {
  const devices = [
    { id: 'press-a', name: '冲压线 A', status: '运行', x: 18, y: 13, value: 86, unit: '件/min', color: '#3679ed' },
    { id: 'weld-b', name: '焊接单元 B', status: '运行', x: 48, y: 15, value: 74, unit: '件/min', color: '#18b487' },
    { id: 'assembly-c', name: '装配线 C', status: '运行', x: 18, y: 39, value: 62, unit: '件/min', color: '#8268e8' },
    { id: 'inspect-d', name: '质检工位 D', status: '待机', x: 48, y: 40, value: 51, unit: '件/min', color: '#f0a11c' },
    { id: 'pack-e', name: '包装单元 E', status: '运行', x: 34, y: 62, value: 68, unit: '件/min', color: '#60738a' },
  ];
  const elements: SceneElement[] = [
    makeElement('factory-header', 'shape', 0, 0, 100, 16, { zIndex: 0, color: '#ffffff', opacity: 100, borderWidth: 0 }),
    makeElement('factory-sidebar', 'shape', 0, 16, 32, 84, { zIndex: 0, color: '#f7f9fc', opacity: 100, borderWidth: 0 }),
    text('factory-title', '智造工厂 · 生产监控', 2, 4, 18, 7, 27, '#172033'),
    text('factory-date', 'PRODUCTION CONTROL CENTER　 /　 2026-09-28 10:42:16', 2, 11, 28, 3, 11, '#64748b', { fontWeight: '500' }),
    text('factory-search', '⌕　搜索设备 / 工单…', 82, 5, 16, 7, 14, '#64748b', { fontWeight: '500' }),
    component('factory-output', 'metric-card', 22, 3, 14, 10, { title: '今日产量', label: '今日产量', value: 12458, unit: '件', color: '#3679ed', accentColor: '#3679ed', lowMotion: true }),
    component('factory-delivered', 'metric-card', 37, 3, 14, 10, { title: '已交付', label: '已交付', value: 10234, unit: '件', color: '#16a36a', accentColor: '#16a36a', lowMotion: true }),
    component('factory-alerts', 'metric-card', 52, 3, 13, 10, { title: '异常', label: '异常', value: 3, unit: '项', color: '#ef4444', accentColor: '#ef4444', lowMotion: true }),
    component('factory-target', 'metric-card', 66, 3, 14, 10, { title: '达成率', label: '达成率', value: 96.8, unit: '%', color: '#3679ed', accentColor: '#3679ed', lowMotion: true }),
    component('factory-health', 'metric-card', 35, 19, 13, 10, { title: '系统负载', label: '系统负载', value: 42, unit: '%', color: '#3679ed', accentColor: '#3679ed', lowMotion: true }),
    component('factory-latency', 'metric-card', 50, 19, 13, 10, { title: '网络延迟', label: '网络延迟', value: 12, unit: 'ms', color: '#16a36a', accentColor: '#16a36a', lowMotion: true }),
    component('factory-temperature', 'metric-card', 65, 19, 13, 10, { title: '环境温度', label: '环境温度', value: 24.5, unit: '°C', color: '#16a36a', accentColor: '#16a36a', lowMotion: true }),
    component('factory-power', 'metric-card', 80, 19, 13, 10, { title: '实时功耗', label: '实时功耗', value: 128, unit: 'kW', color: '#f59e0b', accentColor: '#f59e0b', lowMotion: true }),
    text('factory-status-title', '运行状态总览', 3, 19, 26, 5, 20),
    component('factory-status-chart', 'donut-chart', 6, 25, 21, 19, { title: '运行状态', label: '运行状态', value: 76, color: '#16b96a', accentColor: '#16b96a', lowMotion: true }),
    text('factory-lines-title', '产线设备运行数据', 3, 48, 27, 5, 20),
    component('factory-lines', 'stats-table', 3, 54, 27, 16, { title: '产线设备运行数据', rows: [
      { label: '冲压线 A', value: '98.5%', status: '运行' },
      { label: '焊接单元 B', value: '96.2%', status: '运行' },
      { label: '装配线 C', value: '82.4%', status: '运行' },
    ], repeat: { maxItems: 5, overflow: 'adaptive' } }),
    text('factory-trend-title', '生产产能趋势', 3, 73, 27, 5, 20),
    component('factory-trend', 'trend-line', 3, 79, 27, 18, { title: '生产产能趋势', label: '产能 / 件', series: [68, 73, 70, 78, 76, 84, 82, 88], categories: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'], color: '#3679ed', accentColor: '#3679ed', lowMotion: true }),
    component('factory-floor-map', 'factory-floor', 34, 31, 64, 64, { label: '生产设备实时布局', devices, lowMotion: true }),
    text('factory-map-hint', '设备分布　/　运行状态与产能实时同步', 37, 96, 58, 3, 10, '#64748b', { fontWeight: '500' }),
  ];
  return {
    id: 'factory_ops', alias: '智能工厂监控中枢', type: 'scene', duration: 60, cruiseDuration: 60,
    bgColor: '#eef2f6', inPoint: 0, outPoint: 60, transitionIn: 'fade', transitionOut: 'fade', transitionDuration: 0.4, els: elements,
  };
}

export function createFactoryOpsTemplateProject(): ProjectData {
  const scene = createFactoryScene();
  return {
    meta: { v: 42.1, title: '智能工厂监控中枢', author: '鲸动交互平台', updatedAt: new Date().toISOString() },
    start: scene.id, canvas: { width: 1920, height: 1080 }, scenes: { [scene.id]: scene }, variables: [],
  };
}
