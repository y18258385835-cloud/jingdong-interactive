export type OfficialPoint = { id: string; label: string; value: number; color: string };
export type OfficialFlowNode = { id: string; label: string; type: 'start' | 'process' | 'decision' | 'end'; color?: string };
export type OfficialTableRow = { id: string; cells: string[] };
import { CITY_MAP_NAMES } from './cityMapIndex';

const COLORS = ['#36d9ff', '#82f3c4', '#ffb86b', '#a78bfa', '#ff7aa8', '#fbbf24'];
const points = (labels: string[], values: number[]): OfficialPoint[] => labels.map((label, index) => ({ id: `point-${index + 1}`, label, value: values[index] ?? 0, color: COLORS[index % COLORS.length] }));

export const OFFICIAL_SHAPE_IDS = new Set(['rect', 'rounded-rect', 'circle', 'polygon', 'star', 'triangle', 'decision', 'decision-node', 'start-end', 'flow-document', 'flow-data', 'subprocess', 'external-data', 'internal-storage', 'queue-data', 'database', 'manual-input', 'flow-card', 'flow-strip', 'display', 'manual-operation', 'prepare', 'loop-limit', 'page-reference', 'or-node', 'sum-node', 'cross-page-reference', 'sort-node', 'merge-node', 'parallel-node', 'flow-note', 'remark']);
export const OFFICIAL_FLOW_NODE_IDS = new Set(['start-end', 'flow-document', 'flow-data', 'subprocess', 'external-data', 'internal-storage', 'queue-data', 'database', 'manual-input', 'flow-card', 'flow-strip', 'display', 'manual-operation', 'prepare', 'loop-limit', 'page-reference', 'or-node', 'sum-node', 'cross-page-reference', 'sort-node', 'merge-node', 'parallel-node', 'flow-note', 'remark']);
export const OFFICIAL_MEDIA_IDS = new Set(['image', 'video', 'audio', 'carousel', 'video-player', 'audio-player', 'webpage', 'qr-code', 'chat-bubble']);
export const OFFICIAL_CONTAINER_IDS = new Set(['placeholder', 'annotation', 'point-annotation', 'dynamic-component', 'scroll-panel', 'float-layer', 'document', 'code-component', 'drawer', 'popover', 'browser-frame', 'phone-frame']);

/**
 * 官方组件的设计画布是 420x240（`GALAXY_COMPONENT_BASE_SIZE['official-modao']`）。
 * 画布内按 1920x1080 舞台换算成百分比；直接采用组件的自然尺寸可以保证插入后
 * 1:1 呈现，不再被拉伸（按钮文字变形、圆形变椭圆都是尺寸比例不匹配导致的）。
 */
const OFFICIAL_NATURAL_SIZES: Record<string, { w: number; h: number }> = {};
const assignNaturalSize = (ids: string[], w: number, h: number) => {
  ids.forEach((id) => { OFFICIAL_NATURAL_SIZES[id] = { w, h }; });
};

assignNaturalSize(['icon-left', 'icon-right', 'icon-up', 'icon-down', 'icon-add', 'icon-close', 'icon-search', 'icon-menu'], 56, 56);
assignNaturalSize(['button', 'button-2', 'primary-button', 'secondary-button', 'icon-button', 'close-button', 'link-area'], 120, 48);
assignNaturalSize(['button-tech-1', 'button-tech-2', 'button-tech-3', 'button-tech-4', 'button-text-1', 'button-text-2', 'button-text-3', 'button-text-4', 'button-text-5', 'button-text-6'], 108, 46);
assignNaturalSize(['solid-badge', 'outline-badge', 'status-badge'], 82, 32);
assignNaturalSize(['count-badge'], 86, 39);
assignNaturalSize(['spinner-loader', 'ring-loader', 'wave-loader'], 101, 72);
assignNaturalSize(['dots-loader'], 119, 72);
assignNaturalSize(['avatar'], 124, 48);
assignNaturalSize(['avatar-group'], 104, 32);
assignNaturalSize(['rating'], 125, 30);
assignNaturalSize(['divider'], 75, 24);
assignNaturalSize(['tooltip'], 66, 39);
assignNaturalSize(['checkbox', 'radio'], 70, 24);
assignNaturalSize(['switch', 'ios-switch', 'android-switch', 'switch-ios'], 140, 42);
assignNaturalSize(['switch-material'], 160, 42);
assignNaturalSize(['input', 'select', 'date-picker', 'time-picker', 'search-input', 'password-input', 'upload'], 420, 74);
assignNaturalSize(['textarea'], 420, 146);
assignNaturalSize(['file-input'], 420, 107);
assignNaturalSize(['slider'], 420, 76);
assignNaturalSize(['number-stepper'], 420, 66);
assignNaturalSize(['progress-bar'], 420, 38);
assignNaturalSize(['qr-code'], 146, 88);
assignNaturalSize(['audio', 'audio-player'], 145, 24);
assignNaturalSize(['rect', 'star', 'flow-document', 'flow-data', 'flow-card', 'flow-strip', 'display', 'prepare', 'or-node', 'sum-node', 'sort-node', 'merge-node', 'flow-note', 'remark'], 64, 76);
assignNaturalSize(['circle', 'polygon', 'triangle', 'subprocess', 'database'], 76, 76);
assignNaturalSize(['rounded-rect', 'decision', 'decision-node', 'external-data', 'internal-storage', 'queue-data', 'manual-input', 'manual-operation', 'loop-limit', 'cross-page-reference', 'parallel-node'], 88, 76);
assignNaturalSize(['start-end'], 93, 76);
assignNaturalSize(['page-reference'], 100, 76);
assignNaturalSize(['card-basic', 'card-outline', 'card-media', 'card-profile', 'card-stat', 'card-list', 'empty-state', 'skeleton', 'weather-card', 'camera-panel', 'text', 'title', 'top-title', 'section-title', 'hero-title', 'image', 'video', 'video-player', 'carousel', 'webpage', 'chat-bubble', 'table-chart', 'bar-chart', 'bar-chart-horizontal', 'line-chart', 'area-chart', 'combo-chart', 'pie-chart', 'ring-chart', 'funnel', 'radar', 'heatmap', 'waterfall-chart', 'rose-chart', 'gauge', 'water-wave', 'scatter', 'bubble-chart', 'yuejue-chart', 'sunburst-chart', 'boxplot-chart', 'sankey-chart', 'wordcloud-chart', 'stat-map', 'dynamic-bar', '3d-bar', 'progress-ring', 'map', 'map-marker', 'frame', 'frame-style-1', 'frame-style-2', 'frame-style-3', 'frame-style-4', 'browser-frame', 'phone-frame', 'popup-1', 'popup-2', 'popup-3', 'popup-4', 'popup-5', 'popup-6', 'placeholder', 'annotation', 'point-annotation', 'dynamic-component', 'scroll-panel', 'float-layer', 'document', 'code-component', 'drawer', 'popover'], 420, 240);
assignNaturalSize(['notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'], 420, 70);

/** Default aspect ratios keep first-insert selection handles close to each control's painted footprint. */
export function getOfficialComponentCanvasSize(modaoId: string): { w: number; h: number } {
  const natural = OFFICIAL_NATURAL_SIZES[modaoId];
  if (natural) {
    return {
      w: Math.round((natural.w / 1920 * 100) * 10) / 10,
      h: Math.round((natural.h / 1080 * 100) * 10) / 10,
    };
  }
  const id = modaoId;
  let width = 21.9;
  let aspectRatio = 420 / 240;
  if (OFFICIAL_FLOW_NODE_IDS.has(id) || ['decision-node', 'start-end', 'timeline', 'steps', 'stepper', 'swimlane', 'vertical-swimlane', 'horizontal-swimlane', 'flow', 'mindmap'].includes(id)) { width = 26; aspectRatio = 2; }
  else if (OFFICIAL_CONTAINER_IDS.has(id) || ['frame', 'browser-frame', 'phone-frame'].includes(id)) { width = 21.9; aspectRatio = 420 / 240; }
  const h = Math.round((width * 1920 / 1080 / aspectRatio) * 10) / 10;
  return { w: width, h };
}

/**
 * Older project files stored only the display label/kind for official components.
 * Keep those files editable by recovering the stable Modao id before rendering or
 * opening the inspector.  New inserts still always persist modaoId directly.
 */
export function inferOfficialModaoId(data: Record<string, unknown> = {}): string {
  const explicit = String(data.modaoId || data.componentId || data.templateId || '').trim();
  if (explicit) return explicit;
  const label = String(data.label || data.title || data.content || data.region || data.mapCenter || '').trim().toLowerCase();
  const cityMap = Object.entries(CITY_MAP_NAMES).find(([, name]) => {
    const cityName = name.replace(/[市区县]$/, '').toLowerCase();
    return cityName && (label === `${cityName}地图` || label === cityName);
  });
  if (cityMap) return cityMap[0];
  const aliases: Array<[string, string[]]> = [
    ['map-guangzhou', ['广州地图', '广州']], ['map-shenzhen', ['深圳地图', '深圳']],
    ['map-shanghai', ['上海地图', '上海']], ['map-beijing', ['北京地图', '北京']],
    ['map-chengdu', ['成都地图', '成都']], ['map-chongqing', ['重庆地图', '重庆']],
    ['stat-map', ['统计地图', '热力地图']], ['map-marker', ['地图标记', '地图标注']], ['map', ['地图']],
    ['dynamic-number', ['数字动态组件', '数字动态']], ['big-number', ['大数字组件', '大数字']],
    ['weather-card', ['天气']], ['camera-panel', ['摄像头组件', '摄像头']],
    ['flow', ['流程图']], ['mindmap', ['思维导图', '脑图']], ['table-chart', ['数据表格', '表格']],
    ['pie-chart', ['饼状图', '饼图']], ['ring-chart', ['环形图', '圆环图']], ['bar-chart', ['柱状图']],
    ['line-chart', ['折线图']], ['input', ['输入框']], ['textarea', ['多行输入框']], ['select', ['下拉选择']],
    ['button', ['基础按钮']], ['button-2', ['按钮2']], ['tabs', ['标签页']],
  ];
  const hit = aliases.find(([, names]) => names.some((name) => label.includes(name.toLowerCase())));
  return hit?.[0] || '';
}

export function getOfficialComponentDefaults(modaoId: string, label: string, accentColor = '#36d9ff'): Record<string, unknown> {
  const base = { modaoId, label, accentColor, color: accentColor, opacity: 100 };
  if (['icon-left', 'icon-right', 'icon-up', 'icon-down', 'icon-add', 'icon-close', 'icon-search', 'icon-menu'].includes(modaoId)) return { ...base, iconSize: 56, strokeWidth: 2, showFrame: true, surface: 'transparent' };
  if (modaoId === 'card-basic') return { ...base, title: label, subtitle: '通用信息面板', content: '可编辑的卡片正文内容，适合承载说明信息。', status: '正常', actionLabel: '查看详情', borderRadius: 8 };
  if (modaoId === 'card-outline') return { ...base, title: label, eyebrow: 'OUTLINE', footer: '更多信息', borderRadius: 8 };
  if (modaoId === 'card-media') return { ...base, title: label, imageUrl: '', mediaTag: 'MEDIA', caption: '图片与说明内容', borderRadius: 8 };
  if (modaoId === 'card-profile') return { ...base, title: label, name: 'AETHER 用户', role: '产品设计师', status: '在线', avatarText: 'A', avatarUrl: '', followers: 128, projects: 24, following: false, borderRadius: 8 };
  if (modaoId === 'card-stat') return { ...base, title: label, content: '可编辑内容', caption: '统计卡片', value: 7516.5, unit: '', trendValue: 12.6, progress: 72, progressLabel: '目标完成度', borderRadius: 8 };
  if (modaoId === 'card-list') return { ...base, title: label, viewAllLabel: '查看全部', listItems: [{ label: '项目进度', value: '86%', color: accentColor }, { label: '用户增长', value: '64%', color: '#82f3c4' }, { label: '设备状态', value: '98%', color: '#ffb86b' }], borderRadius: 8 };
  const cityMapName = CITY_MAP_NAMES[modaoId];
  if (cityMapName) {
    const cityName = cityMapName.replace(/[市区县]$/, '');
    return { ...base, region: cityName, mapCenter: cityName, zoom: 10, markers: [{ id: 'marker-1', label: '重点区域', color: accentColor, x: 50, y: 50 }], showLabels: true };
  }
  if (['dynamic-number', 'big-number', 'metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'].includes(modaoId)) {
    return { ...base, value: modaoId === 'big-number' ? 1284 : 72, unit: modaoId === 'big-number' ? '人' : '%', caption: modaoId === 'big-number' ? '访问总量' : '完成率', min: 0, max: modaoId === 'big-number' ? 999999 : 100, trend: '+12.6%', accentColor };
  }
  if (modaoId === 'weather-card') return { ...base, city: '北京', temperature: 24, condition: '晴朗', humidity: 46, wind: '东南风 2 级', unit: '°C' };
  if (modaoId === 'camera-panel') return { ...base, cameraName: 'CAM-01', status: '在线', location: '主入口', timestamp: '实时', showControls: true };
  if (['popup-1', 'popup-2', 'popup-3', 'popup-4', 'popup-5', 'popup-6'].includes(modaoId)) return { ...base, title: label, content: '这里是弹窗正文内容，可在属性面板中自定义。', buttons: ['取消', '确认'], anchor: 'center', showClose: true, showConnector: modaoId === 'popup-4' };
  if (['frame-style-1', 'frame-style-2', 'frame-style-3', 'frame-style-4'].includes(modaoId)) return { ...base, title: '数据监控中心', content: '窗口内容区域', frameStyle: modaoId, showHeader: true, headerMeta: 'LIVE' };
  if (['map-chengdu', 'map-chongqing', 'map-beijing', 'map-shanghai', 'map-guangzhou', 'map-shenzhen'].includes(modaoId)) return { ...base, region: label.replace('地图', ''), mapCenter: label.replace('地图', ''), zoom: 10, markers: [{ id: 'marker-1', label: '重点区域', color: accentColor }], showLabels: true };
  if (['dynamic-bar', '3d-bar'].includes(modaoId)) return {
    ...base,
    unit: '数量',
    max: 100,
    items: points(['一月', '二月', '三月', '四月', '五月', '六月'], [38, 62, 48, 78, 56, 88]),
    showGrid: true,
    showLegend: true,
    is3d: modaoId === '3d-bar',
    ...(modaoId === '3d-bar' ? { depth: 16, perspective: 34, showFloor: true, showValues: true } : {}),
  };
  if (['other-group-5', 'customer-call', 'top-title'].includes(modaoId)) return { ...base, content: label, subtitle: modaoId === 'customer-call' ? '客户呼叫信息' : '', accentColor };
  if (['button-tech-1', 'button-tech-2', 'button-tech-3', 'button-tech-4'].includes(modaoId)) return { ...base, buttonLabel: label, variant: modaoId, icon: '', disabled: false };
  if (['bar-chart', 'bar-chart-horizontal', 'line-chart', 'area-chart', 'combo-chart', 'funnel', 'scatter', 'heatmap', 'tree-chart', 'waterfall-chart', 'rose-chart', 'water-wave', 'bubble-chart', 'yuejue-chart', 'sunburst-chart', 'boxplot-chart', 'sankey-chart', 'wordcloud-chart', 'dynamic-bar', '3d-bar', 'progress-ring'].includes(modaoId)) {
    return { ...base, unit: '', max: 100, items: points(['A', 'B', 'C', 'D', 'E', 'F'], [38, 62, 48, 78, 56, 88]), showGrid: true, showLegend: true };
  }
  if (['pie-chart', 'ring-chart'].includes(modaoId)) {
    return { ...base, items: points(['Desktop', 'Mobile', 'Tablet'], [45, 35, 20]), showLegend: true, normalizePercent: true };
  }
  if (['gauge', 'radar'].includes(modaoId)) {
    return { ...base, value: 72, min: 0, max: 100, unit: '%', items: points(['Speed', 'Quality', 'Cost', 'Safety', 'Reach'], [72, 64, 58, 80, 68]) };
  }
  if (modaoId === 'table' || modaoId === 'table-chart') {
    return { ...base, columns: ['Name', 'Value', 'Status'], rows: [{ id: 'row-1', cells: ['Device', '1284', 'Normal'] }, { id: 'row-2', cells: ['Visits', '923', 'Normal'] }, { id: 'row-3', cells: ['Load', '42%', 'Warning'] }], showHeader: true };
  }
  if (['tabs', 'top-nav', 'side-nav', 'dropdown-menu', 'popup-menu', 'nav-menu', 'vertical-menu', 'horizontal-menu', 'tree-menu', 'mobile-nav', 'segmented', 'collapse-panel', 'pagination', 'pagination-1', 'pagination-2', 'breadcrumb', 'menu-horizontal', 'menu-vertical', 'bottom-nav'].includes(modaoId)) return { ...base, tabs: modaoId.startsWith('pagination') ? ['1', '2', '3', '4'] : ['首页', '产品', '服务'], activeTab: 0, orientation: ['side-nav', 'vertical-menu', 'tree-menu', 'menu-vertical'].includes(modaoId) ? 'vertical' : 'horizontal', showIcons: false };
  if (['select'].includes(modaoId)) return { ...base, placeholder: 'Select an option', options: ['Option 1', 'Option 2', 'Option 3'], required: false, disabled: false };
  if (['input', 'textarea', 'file-input', 'date-picker', 'time-picker', 'search-input', 'password-input', 'upload'].includes(modaoId)) return { ...base, placeholder: modaoId === 'file-input' || modaoId === 'upload' ? '选择文件' : '请输入', defaultValue: '', content: '', required: false, disabled: false, rowsCount: modaoId === 'textarea' ? 4 : 1 };
  if (['checkbox', 'radio', 'switch', 'ios-switch', 'android-switch'].includes(modaoId)) return { ...base, checked: false, required: false, disabled: false };
  if (['switch-ios', 'switch-material'].includes(modaoId)) return { ...base, checked: true, required: false, disabled: false };
  if (modaoId === 'rating') return { ...base, value: 4, min: 0, max: 5, step: 1, unit: '星' };
  if (modaoId === 'skeleton') return { ...base, content: '内容预览', lineCount: 4, showAvatar: true, animationEnabled: true, borderRadius: 6 };
  if (modaoId === 'avatar') return { ...base, label, subtitle: 'Online', avatarText: 'A', avatarUrl: '', avatarSize: 42, showSubtitle: true };
  if (modaoId === 'avatar-group') return { ...base, members: [{ id: 'member-1', label: 'A', color: COLORS[0] }, { id: 'member-2', label: 'B', color: COLORS[1] }, { id: 'member-3', label: 'C', color: COLORS[2] }, { id: 'member-4', label: 'D', color: COLORS[3] }], maxVisible: 4, showOverflow: true, overflowLabel: '+0', avatarSize: 32, overlap: 8 };
  if (modaoId === 'divider') return { ...base, label: 'Divider', orientation: 'horizontal', lineStyle: 'solid', lineWidth: 1, showLabel: true, gap: 10 };
  if (modaoId === 'progress-bar') return { ...base, value: 58, min: 0, max: 100, unit: '%', showLabel: true, showValue: true, trackHeight: 8 };
  if (['slider', 'number-stepper'].includes(modaoId)) return { ...base, value: modaoId === 'number-stepper' ? 1 : 58, min: 0, max: 100, step: 1, unit: modaoId === 'number-stepper' ? '' : '%' };
  if (modaoId === 'vertical-swimlane' || modaoId === 'horizontal-swimlane' || modaoId === 'swimlane') return { ...base, orientation: modaoId === 'vertical-swimlane' ? 'vertical' : 'horizontal', lanes: [{ id: 'lane-1', label: 'Lane 1' }, { id: 'lane-2', label: 'Lane 2' }, { id: 'lane-3', label: 'Lane 3' }], nodes: [{ id: 'step-1', label: 'Step 1', lane: 0 }, { id: 'step-2', label: 'Step 2', lane: 1 }], showArrows: true };
  if (['flow', 'mindmap', 'timeline', 'steps', 'stepper', 'decision-node'].includes(modaoId)) return { ...base, nodes: [{ id: 'start', label: '开始', type: 'start' }, { id: 'process', label, type: 'process' }, { id: 'end', label: '结束', type: 'end' }], direction: 'horizontal', showArrows: true };
  if (['map', 'map-marker', 'map-chengdu', 'map-chongqing', 'map-beijing', 'map-shanghai', 'map-guangzhou', 'map-shenzhen', 'stat-map'].includes(modaoId)) return { ...base, region: modaoId === 'stat-map' ? '中国' : modaoId.replace('map-', '').replace('map', 'Beijing'), mapCenter: modaoId === 'stat-map' ? '中国' : modaoId.replace('map-', '').replace('map', 'Beijing'), zoom: 10, markers: [{ id: 'marker-1', label: 'Main point', color: accentColor }], showLabels: true };
  if (OFFICIAL_SHAPE_IDS.has(modaoId)) return { ...base, content: label, fillColor: `${accentColor}26`, strokeColor: accentColor, strokeWidth: 2, rotation: 0, sides: modaoId === 'triangle' ? 3 : modaoId === 'star' ? 5 : 6, cornerRadius: modaoId === 'rounded-rect' ? 12 : 0, showLabel: true };
  if (OFFICIAL_MEDIA_IDS.has(modaoId)) return { ...base, assetName: '', assetUrl: '', autoplay: false, loop: false, controls: modaoId === 'video' ? false : true, muted: false, posterUrl: '', items: modaoId === 'carousel' ? ['Slide 1', 'Slide 2', 'Slide 3'] : [], activeIndex: 0, placeholder: 'Paste an asset URL', qrValue: 'https://aether.local', qrSize: 9, qrForeground: '#071522', qrBackground: '#ffffff', qrErrorCorrection: 'M' };
  if (OFFICIAL_CONTAINER_IDS.has(modaoId)) return {
    ...base,
    title: label,
    content: 'Editable component content',
    items: ['Content 1', 'Content 2', 'Content 3'],
    lanes: ['Section 1', 'Section 2'],
    expanded: true,
    dismissible: true,
    scrollable: modaoId === 'scroll-panel',
    scrollDirection: 'vertical',
    author: 'AETHER',
    severity: 'info',
    componentRef: '',
    propsJson: '{\n  "variant": "default"\n}',
    code: '',
    language: 'html',
    pageTitle: label,
    headerText: 'AETHER DOCUMENT',
    footerText: 'Page 1',
    showHeader: true,
    showFooter: true,
    pointerX: 50,
    pointerY: 50,
    pointerDirection: 'bottom',
    borderRadius: 8,
    backgroundColor: '#0c1c30',
  };
  if (['image', 'video', 'audio', 'carousel', 'webpage', 'qr-code', 'chat-bubble'].includes(modaoId)) return { ...base, assetName: '', assetUrl: '', autoplay: false, loop: false, controls: true };
  if (['card-basic', 'card-outline', 'card-media', 'card-profile', 'card-stat', 'card-list', 'empty-state', 'skeleton', 'drawer', 'popover'].includes(modaoId)) return { ...base, title: label, content: '可编辑内容', items: ['内容一', '内容二', '内容三'], dismissible: true, borderRadius: 8 };
  if (modaoId === 'card-basic') return { ...base, title: label, subtitle: '通用信息面板', content: '可编辑的卡片正文内容，适合承载说明信息。', status: '正常', actionLabel: '查看详情', borderRadius: 8 };
  if (modaoId === 'card-outline') return { ...base, title: label, eyebrow: 'OUTLINE', footer: '更多信息', borderRadius: 8 };
  if (modaoId === 'card-media') return { ...base, title: label, imageUrl: '', mediaTag: 'MEDIA', caption: '图片与说明内容', borderRadius: 8 };
  if (modaoId === 'card-profile') return { ...base, title: label, name: 'AETHER 用户', role: '产品设计师', status: '在线', avatarText: 'A', avatarUrl: '', followers: 128, projects: 24, following: false, borderRadius: 8 };
  if (modaoId === 'card-stat') return { ...base, title: label, caption: '统计卡片', value: 7516.5, unit: '', trendValue: 12.6, progress: 72, progressLabel: '目标完成度', borderRadius: 8 };
  if (modaoId === 'card-list') return { ...base, title: label, viewAllLabel: '查看全部', listItems: [{ label: '项目进度', value: '86%', color: accentColor }, { label: '用户增长', value: '64%', color: '#82f3c4' }, { label: '设备状态', value: '98%', color: '#ffb86b' }], borderRadius: 8 };
  if (['spinner-loader', 'dots-loader', 'ring-loader', 'wave-loader'].includes(modaoId)) return { ...base, label, value: 48, speed: 1, loaderSize: 34, motionEnabled: true, surface: 'transparent' };
  if (['notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'].includes(modaoId)) {
    const notificationType = modaoId.replace('notification-', '').replace('toast', 'info').replace('alert', 'warning');
    return { ...base, title: label, content: '这是一条可编辑的通知消息', notificationType, dismissible: true, showIcon: true, duration: 0, dismissed: false, surface: modaoId === 'toast' ? 'subtle' : 'card' };
  }
  if (['solid-badge', 'outline-badge', 'status-badge', 'count-badge'].includes(modaoId)) return { ...base, content: label, value: 12, status: '正常' };
  if (['breadcrumb', 'menu-horizontal', 'menu-vertical', 'bottom-nav'].includes(modaoId)) return { ...base, tabs: ['首页', '产品', '服务'], activeTab: 0, orientation: modaoId === 'menu-vertical' ? 'vertical' : 'horizontal' };
  if (['button', 'button-2', 'button-text-1', 'button-text-2', 'button-text-3', 'button-text-4', 'button-text-5', 'button-text-6', 'link-area', 'primary-button', 'secondary-button', 'icon-button', 'close-button'].includes(modaoId)) return { ...base, buttonLabel: label, variant: modaoId, icon: modaoId === 'close-button' ? '×' : '', disabled: false, pressed: false, action: 'none' };
  if (['list', 'panel', 'modal', 'tooltip', 'annotation', 'frame', 'browser-frame', 'phone-frame', 'grid-bg'].includes(modaoId)) return { ...base, content: '', items: ['Content 1', 'Content 2', 'Content 3'], backgroundColor: '#0c1c30', borderRadius: 8, opacity: 100 };
  return { ...base, content: '', value: 0 };
}

export interface OfficialComponentDefinition {
  id: string;
  label: string;
  kind: string;
  category: string;
  accent?: string;
  premium?: boolean;
  previewVariant?: string;
}

/** Build the exact data payload shared by the library preview and canvas insertion. */
export function createOfficialComponentData(component: OfficialComponentDefinition): Record<string, unknown> {
  return {
    ...getOfficialComponentDefaults(component.id, component.label, component.accent || '#36d9ff'),
    kind: component.kind,
    group: component.category,
    premium: component.premium || false,
    previewVariant: component.previewVariant || '',
  };
}

export function patchOfficialArray<T>(value: unknown, fallback: T[]): T[] { return Array.isArray(value) && value.length ? value as T[] : fallback; }
