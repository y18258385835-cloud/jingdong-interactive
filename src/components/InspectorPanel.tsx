import React, { useRef, useState, useEffect, useMemo } from 'react';
// VFX 检视器含动效实现（200+ KB），只在选中 VFX 图层时加载。
const VfxInspector = React.lazy(() => import('./VfxInspector').then((module) => ({ default: module.VfxInspector })));
import { 
  Sliders, Move, Palette, Sparkles, Link as LinkIcon, 
  Trash2, Lock, Unlock, Eye, EyeOff, Layers, Music, Image as ImageIcon, Eraser,
  Type, Video, Square, Box, RefreshCw, Play, Shuffle, Compass,
  Folder, FolderPlus, Unlink, Check, Plus, Camera, BarChart3 as BarChart3Icon,
  Database as DatabaseIcon, Save as SaveIcon, GitBranch,
  ArrowRight, CornerDownRight, ZoomIn,
  MapPin, Upload, Info, Circle, MousePointer, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Diamond, Code2, Copy, ClipboardPaste, MoreHorizontal
} from 'lucide-react';
import { ProjectData, Scene, SceneElement, BlendMode, InAnimType, OutAnimType, LoopAnimType, SceneTransitionType, LayerGroup, Hotspot, type Ai3DControlKind, type Ai3DControlVariant, type ContinuousInteractionConfig, type ContinuousInteractionNode, type PopupConfig, type InteractionEffectTrigger } from '../types';
import { detachInstance, updateMasterFromInstance } from '../utils/componentMasters';
import { InteractionComposerModal } from './InteractionComposerModal';
import { dbManager, processImageFile, type AssetMetadata } from '../utils/db';
import { computeMediaAspect } from '../utils/mediaAspect';
import { ShapeInspector } from './ShapeInspector';
import { SaberInspector } from './SaberInspector';
import { TextStyleControls } from './TextStyleControls';
import { FontFamilyPicker } from './FontFamilyPicker';
import { FOLDER_COLORS, getGroupColorConfig } from './LeftSidebar';
import { isPopupScene } from '../utils/sceneLoop';
import { getProjectCanvas, CANVAS_PRESETS, getCanvasRatioLabel } from '../utils/canvas';
import { createDefaultGestureBindings } from '../core/motion/defaults';
import { detectInteractionConflicts, resolveInteraction, INTERACTION_TRIGGER_OPTIONS, type InteractionConfig } from '../utils/interactionModel';
import { getPluginById } from '../plugins/registry';
import { GRADIENT_PRESETS, getGradientBackground } from '../utils/shapeStyles';
import { CHART_INTERACTION_IDS, CHART_INTERACTION_LABELS } from '../utils/charts';
import { createDefaultPopup, getPopups, normalizePopupTheme, popupCollectionPatch, resizePopups, resolvePopupSizePercent, POPUP_COLORS } from '../utils/popups';
import { nextContinuousCheckpointPosition, normalizeContinuousInteraction, removeContinuousCheckpoint } from '../utils/continuousInteraction';
import { isContinuousInteractionComponent } from './ui/galaxyComponentMeta';
import { HOLOGRAPHIC_GAUGE_TYPES } from './ui/HolographicGauges';
import { getPrimaryCustomCodeText, hasCustomCodeTextLayer, replacePrimaryCustomCodeText } from '../utils/customCode';
import { TEXT_STYLE_PRESETS, getTextStylePresetStyle } from '../utils/textStylePresets';
import { getBoundsAspectRatio, isAspectRatioResizeLocked, resizeBoundsWithAspect } from '../core/render/resize';
import { getLayerPlaybackConfig, MAX_LAYER_PLAYBACK_COUNT } from '../core/render/layerPlayback';
import { getOfficialComponentDefaults, inferOfficialModaoId, OFFICIAL_SHAPE_IDS, OFFICIAL_FLOW_NODE_IDS, OFFICIAL_MEDIA_IDS, OFFICIAL_CONTAINER_IDS } from './ui/officialComponentModel';
import { CITY_MAP_NAMES, CITY_MAP_IDS, isCityMapId } from './ui/cityMapIndex';
import { clearAllKeyframes, clearKeyframeProperties, copyKeyframe, evaluateAnimatedProperty, evaluateElementProperties, getKeyframeAt, getNeighborKeyframe, getPropertyTrack, hasKeyframeClipboard, MASK_ANIMATED_PROPERTIES, pasteKeyframe, removeKeyframe, setKeyframeEasing, upsertKeyframe, type KeyframeEasing, type KeyframeProperty } from '../core/animation/keyframes';
import { CustomCodeDynamicControls } from './CustomCodeDynamicControls';
import { ScrubbableNumberInput } from './ui/ScrubbableNumberInput';
import { SceneDataInspector } from './SceneDataInspector';

const UI_CARD_COMPONENT_TYPES = new Set([
  'glass-card',
  'gradient-card',
  'neon-card',
  'profile-card',
  'metric-card',
  'spotlight-card',
  'split-feature-card',
  'outline-panel-card',
]);

const UI_TEXT_COMPONENT_TYPES = new Set([
  'green-outline-button', 'cyan-solid-button', 'auth-toggle-button', 'transparent-bubble-button',
  'blue-bubble-button', 'back-button', 'next-button', 'play-button', 'pause-button',
  'pause-button-alt', 'sci-fi-neon-button', 'sci-fi-neon-frame-button', 'sci-fi-polygon-button',
  'sci-fi-node-button', 'sci-fi-glow-button', 'sci-fi-stripe-button', 'data-visualization-header',
  'visualization-header', 'tech-blue-header', 'people-count-blue', 'people-count-green',
  'module-lightning', 'module-star', 'module-bubble', 'module-car', 'module-user', 'module-flask',
  'module-user-icon', 'module-flask-icon', 'module-data', 'pattern-prediction-chart',
  'data-trend-chart', 'data-trend-cyber-chart', 'data-trend-area-chart', 'data-trend-dual-area-chart',
  'cyber-bubble-chart', 'cyber-ring-chart', 'cyber-multi-ring-chart', 'cyber-hud-gauge',
  'cyber-radar-chart', 'cyber-3d-donut-chart', 'distribution-stat-chart', 'pyramid-distribution-chart',
]);

const OFFICIAL_CHART_IDS = new Set(['bar-chart', 'bar-chart-horizontal', 'line-chart', 'area-chart', 'combo-chart', 'funnel', 'scatter', 'heatmap', 'tree-chart', 'table-chart', 'pie-chart', 'ring-chart', 'gauge', 'radar', 'dynamic-bar', '3d-bar', 'waterfall-chart', 'rose-chart', 'water-wave', 'bubble-chart', 'yuejue-chart', 'sunburst-chart', 'boxplot-chart', 'sankey-chart', 'wordcloud-chart', 'stat-map', 'progress-ring']);
const OFFICIAL_FORM_IDS = new Set(['input', 'textarea', 'select', 'file-input', 'checkbox', 'radio', 'switch', 'ios-switch', 'android-switch', 'slider', 'number-stepper', 'date-picker', 'time-picker', 'search-input', 'password-input', 'upload', 'switch-ios', 'switch-material', 'progress-bar']);
const OFFICIAL_NAV_IDS = new Set(['tabs', 'top-nav', 'side-nav', 'dropdown-menu', 'popup-menu', 'nav-menu', 'vertical-menu', 'horizontal-menu', 'tree-menu', 'mobile-nav', 'segmented', 'collapse-panel', 'pagination', 'pagination-1', 'pagination-2', 'breadcrumb', 'menu-horizontal', 'menu-vertical', 'bottom-nav']);
const OFFICIAL_FLOW_IDS = new Set(['flow', 'mindmap', 'timeline', 'steps', 'stepper', 'swimlane', 'decision-node']);
const OFFICIAL_METRIC_IDS = new Set(['dynamic-number', 'big-number', 'metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6']);
const OFFICIAL_POPUP_IDS = new Set(['popup-1', 'popup-2', 'popup-3', 'popup-4', 'popup-5', 'popup-6']);
const OFFICIAL_FRAME_IDS = new Set(['frame-style-1', 'frame-style-2', 'frame-style-3', 'frame-style-4']);
const OFFICIAL_MAP_IDS = new Set(['map', 'map-marker', 'stat-map', ...CITY_MAP_IDS]);
const OFFICIAL_BUTTON_IDS = new Set(['button', 'button-2', 'button-tech-1', 'button-tech-2', 'button-tech-3', 'button-tech-4', 'button-text-1', 'button-text-2', 'button-text-3', 'button-text-4', 'button-text-5', 'button-text-6', 'link-area', 'primary-button', 'secondary-button', 'icon-button', 'close-button']);
const OFFICIAL_CARD_IDS = new Set(['card-basic', 'card-outline', 'card-media', 'card-profile', 'card-stat', 'card-list']);
const OFFICIAL_FEEDBACK_IDS = new Set(['notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert', 'tooltip', 'empty-state', 'skeleton']);
const OFFICIAL_BADGE_IDS = new Set(['solid-badge', 'outline-badge', 'status-badge', 'count-badge']);

const OfficialMediaUpload: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const acceptedTypes = ['video', 'video-player'].includes(id) ? 'video/*' : ['audio', 'audio-player'].includes(id) ? 'audio/*' : 'image/*';
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith(acceptedTypes.split('/')[0] + '/')) {
      setError('文件类型与当前组件不匹配。');
      event.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const refId = `official-media-${Date.now()}`;
      const blob = file.type.startsWith('image/') ? await processImageFile(file) : file;
      await dbManager.put(refId, blob);
      update({ assetRefId: refId, assetName: file.name, assetUrl: '', mediaType: file.type });
    } catch {
      setError('上传失败，请检查文件后重试。');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  if (!['image', 'video', 'video-player', 'audio', 'audio-player', 'carousel'].includes(id)) return null;
  return <div className="space-y-1" data-testid="official-media-upload">
    <label className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded border border-sky-400/30 bg-sky-400/5 px-2 text-[10px] text-sky-200 hover:bg-sky-400/10">
      <Upload size={12} />{uploading ? '正在保存…' : data.assetName ? '替换本地媒体' : '上传图片或媒体'}
      <input type="file" accept={acceptedTypes} className="sr-only" onChange={handleChange} disabled={uploading} />
    </label>
    {data.assetName && <div className="truncate text-[9px] text-slate-500" title={String(data.assetName)}>已绑定：{String(data.assetName)}</div>}
    {error && <div role="alert" className="text-[9px] text-rose-300">{error}</div>}
  </div>;
};

const OfficialContainerFields: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  const field = (label: string, key: string, type: 'text' | 'number' = 'text', placeholder = '') => <label className="block text-[10px] text-slate-400"><span className="mb-1 block">{label}</span><input type={type} value={data[key] ?? ''} placeholder={placeholder} onChange={(event) => update({ [key]: type === 'number' ? (event.target.value === '' ? undefined : Number(event.target.value)) : event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" /></label>;
  const items = Array.isArray(data.items) ? data.items.map(String) : [];
  return <div className="mt-3 space-y-2 border-t border-violet-400/20 pt-3" data-testid="official-container-inspector"><div className="text-[10px] font-semibold text-violet-200">容器专用属性</div><div className="grid grid-cols-2 gap-2">{field('标题', 'title', 'text', '标题')}{field('作者/来源', 'author', 'text', 'AETHER')}</div>{field('正文内容', 'content', 'text', '可编辑内容')}{['dynamic-component', 'code-component'].includes(id) && <div className="grid grid-cols-2 gap-2">{field('组件引用', 'componentRef', 'text', '组件 ID')}{field('语言', 'language', 'text', 'html')}</div>}{id === 'code-component' && <label className="block text-[10px] text-slate-400"><span className="mb-1 block">代码</span><textarea rows={5} value={String(data.code || '')} onChange={(event) => update({ code: event.target.value })} className="w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[10px] text-emerald-200" /></label>}{['scroll-panel', 'float-layer', 'drawer', 'popover'].includes(id) && <div className="grid grid-cols-2 gap-2">{field('圆角', 'borderRadius', 'number', '8')}<label className="block text-[10px] text-slate-400">滚动方向<select value={String(data.scrollDirection || 'vertical')} onChange={(event) => update({ scrollDirection: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="vertical">垂直</option><option value="horizontal">水平</option></select></label></div>}{['drawer', 'popover'].includes(id) && <label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.dismissible !== false} onChange={(event) => update({ dismissible: event.target.checked })} />允许关闭</label>}<div className="space-y-1 rounded border border-white/10 p-2"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">内容条目</span><button type="button" onClick={() => update({ items: [...items, `内容 ${items.length + 1}`] })} className="flex items-center gap-1 rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加</button></div>{items.map((item, index) => <div key={`${index}-${item}`} className="grid grid-cols-[1fr_28px] gap-1"><input value={item} onChange={(event) => update({ items: items.map((value, itemIndex) => itemIndex === index ? event.target.value : value) })} aria-label={`容器条目${index + 1}`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><button type="button" disabled={items.length <= 1} onClick={() => update({ items: items.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`删除容器条目${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>)}</div></div>;
};

/** Semantic fields that only exist on the matching Modao container type. */
const OfficialContainerAdvancedFields: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  const field = (label: string, key: string, type: 'text' | 'number' = 'text', placeholder = '') => <label className="block text-[10px] text-slate-400"><span className="mb-1 block">{label}</span><input type={type} value={data[key] ?? ''} placeholder={placeholder} onChange={(event) => update({ [key]: type === 'number' ? (event.target.value === '' ? undefined : Number(event.target.value)) : event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" /></label>;
  if (id === 'point-annotation') return <div className="mt-2 space-y-2 rounded border border-amber-400/10 p-2" data-testid="official-point-annotation-fields"><div className="text-[10px] font-medium text-amber-100">指针批注</div><div className="grid grid-cols-2 gap-2">{field('指针 X (%)', 'pointerX', 'number', '50')}{field('指针 Y (%)', 'pointerY', 'number', '50')}</div><label className="block text-[10px] text-slate-400">指针方向<select value={String(data.pointerDirection || 'bottom')} onChange={(event) => update({ pointerDirection: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="top">上</option><option value="right">右</option><option value="bottom">下</option><option value="left">左</option></select></label></div>;
  if (id === 'document') return <div className="mt-2 space-y-2 rounded border border-violet-400/10 p-2" data-testid="official-document-fields"><div className="text-[10px] font-medium text-violet-100">文档版式</div>{field('页面标题', 'pageTitle', 'text', '页面标题')}{field('页眉', 'headerText', 'text', 'AETHER DOCUMENT')}{field('页脚', 'footerText', 'text', 'Page 1')}<div className="flex gap-4 text-[10px] text-slate-400"><label className="flex items-center gap-1"><input type="checkbox" checked={data.showHeader !== false} onChange={(event) => update({ showHeader: event.target.checked })} />显示页眉</label><label className="flex items-center gap-1"><input type="checkbox" checked={data.showFooter !== false} onChange={(event) => update({ showFooter: event.target.checked })} />显示页脚</label></div></div>;
  if (id === 'dynamic-component') return <div className="mt-2 space-y-2 rounded border border-purple-400/10 p-2" data-testid="official-dynamic-fields"><div className="text-[10px] font-medium text-purple-100">动态组件参数</div>{field('组件实例名称', 'componentRef', 'text', 'component-id')}<label className="block text-[10px] text-slate-400"><span className="mb-1 block">属性 JSON</span><textarea rows={5} value={String(data.propsJson || '')} onChange={(event) => update({ propsJson: event.target.value })} className="w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[10px] text-purple-100" placeholder={'{\n  "variant": "default"\n}'} /></label></div>;
  if (id === 'code-component') return <div className="mt-2 rounded border border-emerald-400/10 p-2" data-testid="official-code-fields"><label className="block text-[10px] text-slate-400">语言<select value={String(data.language || 'html')} onChange={(event) => update({ language: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="html">HTML</option><option value="css">CSS</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="json">JSON</option></select></label></div>;
  return null;
};

const OfficialSpecialFields: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  const field = (label: string, key: string, type: 'text' | 'number' = 'text', placeholder = '') => <label className="block text-[10px] text-slate-400"><span className="mb-1 block">{label}</span><input type={type} value={data[key] ?? ''} placeholder={placeholder} onChange={(event) => update({ [key]: type === 'number' ? (event.target.value === '' ? undefined : Number(event.target.value)) : event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" /></label>;
  return <div className="mt-3 space-y-2 border-t border-cyan-400/20 pt-3"><div className="text-[10px] font-semibold text-cyan-200">组件属性</div>{OFFICIAL_METRIC_IDS.has(id) && <><div className="grid grid-cols-2 gap-2">{field('当前数值', 'value', 'number', '0')}{field('单位', 'unit', 'text', '%')}</div><div className="grid grid-cols-2 gap-2">{field('标题', 'caption', 'text', '完成率')}{field('趋势', 'trend', 'text', '+12.6%')}</div><div className="grid grid-cols-2 gap-2">{field('最小值', 'min', 'number', '0')}{field('最大值', 'max', 'number', '100')}</div></>}{id === 'weather-card' && <><div className="grid grid-cols-2 gap-2">{field('城市', 'city', 'text', '北京')}{field('温度', 'temperature', 'number', '24')}</div><div className="grid grid-cols-2 gap-2">{field('天气状态', 'condition', 'text', '晴朗')}{field('湿度', 'humidity', 'number', '46')}</div>{field('风力', 'wind', 'text', '东南风 2 级')}</>}{id === 'camera-panel' && <><div className="grid grid-cols-2 gap-2">{field('摄像头名称', 'cameraName', 'text', 'CAM-01')}{field('状态', 'status', 'text', '在线')}</div>{field('位置', 'location', 'text', '主入口')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showControls !== false} onChange={(event) => update({ showControls: event.target.checked })} />显示控制条</label></>}{OFFICIAL_POPUP_IDS.has(id) && <>{field('弹窗标题', 'title', 'text', '提示')}{field('正文内容', 'content', 'text', '弹窗正文')}<label className="block text-[10px] text-slate-400">按钮文案<input value={Array.isArray(data.buttons) ? data.buttons.join(',') : ''} onChange={(event) => update({ buttons: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showClose !== false} onChange={(event) => update({ showClose: event.target.checked })} />显示关闭按钮</label></>}{OFFICIAL_FRAME_IDS.has(id) && <>{field('窗口标题', 'title', 'text', '数据监控中心')}{field('内容', 'content', 'text', '窗口内容区域')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showHeader !== false} onChange={(event) => update({ showHeader: event.target.checked })} />显示顶部栏</label></>}{OFFICIAL_BUTTON_IDS.has(id) && <>{field('按钮文案', 'buttonLabel', 'text', '确认')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.disabled)} onChange={(event) => update({ disabled: event.target.checked })} />禁用按钮</label></>}{OFFICIAL_MAP_IDS.has(id) && <><div className="grid grid-cols-2 gap-2">{field('地区', 'region', 'text', '北京')}{field('缩放级别', 'zoom', 'number', '10')}</div>{field('地图中心', 'mapCenter', 'text', '北京')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showLabels !== false} onChange={(event) => update({ showLabels: event.target.checked })} />显示地图标签</label></>}</div>;
};

const OfficialSpecialExtraFields: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  const markers = Array.isArray(data.markers) ? data.markers : [];
  const updateMarker = (index: number, patch: Record<string, unknown>) => update({ markers: markers.map((marker: any, markerIndex: number) => markerIndex === index ? { ...marker, ...patch } : marker) });
  return <div className="mt-2 space-y-2">
    {OFFICIAL_POPUP_IDS.has(id) && <div className="grid grid-cols-2 gap-2">
      <label className="block text-[10px] text-slate-400">锚点位置<select value={data.anchor || 'center'} onChange={(event) => update({ anchor: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="center">中心</option><option value="top">顶部</option><option value="right">右侧</option><option value="bottom">底部</option><option value="left">左侧</option></select></label>
      <label className="flex items-center gap-2 pt-4 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.showConnector)} onChange={(event) => update({ showConnector: event.target.checked })} />显示连接线</label>
    </div>}
    {OFFICIAL_MAP_IDS.has(id) && <div className="space-y-2 rounded border border-cyan-400/10 p-2">
      <label className="block text-[10px] text-slate-400">地图地区<select aria-label="地图地区" value={isCityMapId(id) ? id : ''} onChange={(event) => { const nextId = event.target.value; const nextName = CITY_MAP_NAMES[nextId]; if (nextName) { const name = nextName.replace(/[市区县]$/, ''); update({ modaoId: nextId, label: `${name}地图`, region: name, mapCenter: name }); } }} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="" disabled>选择城市地图</option>{Object.entries(CITY_MAP_NAMES).sort((a, b) => a[1].localeCompare(b[1], 'zh-CN')).map(([cityId, name]) => <option key={cityId} value={cityId}>{name}</option>)}</select></label>
      <label className="block text-[10px] text-slate-400">缩放级别 · {Math.max(0, Math.min(20, Number(data.zoom ?? 10)))}<input aria-label="地图缩放级别" type="range" min="0" max="20" value={Math.max(0, Math.min(20, Number(data.zoom ?? 10)))} onChange={(event) => update({ zoom: Number(event.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
      <div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">标记点（可增删、改名称和位置）</span><button type="button" onClick={() => update({ markers: [...markers, { id: `marker-${Date.now()}`, label: `标记 ${markers.length + 1}`, x: 50, y: 50, color: '#36d9ff' }] })} className="flex items-center gap-1 rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加</button></div>
      {markers.map((marker: any, index: number) => <div key={marker.id || index} className="grid grid-cols-[1fr_42px_42px_28px_24px] gap-1">
        <input value={marker.label ?? ''} onChange={(event) => updateMarker(index, { label: event.target.value })} aria-label={`标记点${index + 1}名称`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
        <input type="number" min="0" max="100" value={marker.x ?? 50} onChange={(event) => updateMarker(index, { x: Number(event.target.value) })} aria-label={`标记点${index + 1}横坐标`} className="rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white" />
        <input type="number" min="0" max="100" value={marker.y ?? 50} onChange={(event) => updateMarker(index, { y: Number(event.target.value) })} aria-label={`标记点${index + 1}纵坐标`} className="rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white" />
        <input type="color" value={String(marker.color || '#36d9ff')} onChange={(event) => updateMarker(index, { color: event.target.value })} aria-label={`标记点${index + 1}颜色`} className="h-7 w-7 rounded border border-white/10 bg-black/40" />
        <button type="button" disabled={markers.length <= 1} onClick={() => update({ markers: markers.filter((_: unknown, markerIndex: number) => markerIndex !== index) })} aria-label={`删除标记点${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button>
      </div>)}
    </div>}
    <label className="block text-[10px] text-slate-400">组件透明度 · {Math.max(0, Math.min(100, Number(data.opacity ?? 100)))}%
      <input aria-label="组件透明度" type="range" min="0" max="100" value={Math.max(0, Math.min(100, Number(data.opacity ?? 100)))} onChange={(event) => update({ opacity: Number(event.target.value) })} className="mt-1 w-full accent-cyan-400" />
    </label>
  </div>;
};

const OfficialButtonFields: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  if (!OFFICIAL_BUTTON_IDS.has(id)) return null;
  const action = String(data.action || 'none');
  return <div className="mt-2 space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-button-fields"><div className="text-[10px] font-medium text-cyan-100">按钮交互</div><p className="text-[10px] leading-4 text-slate-400">编辑态点击只选中图层；进入互动预览或演示模式后，按钮才会执行动作并显示反馈。</p><div className="grid grid-cols-2 gap-2"><label className="block text-[10px] text-slate-400">图标<input value={String(data.icon || '')} onChange={(event) => update({ icon: event.target.value })} placeholder="↗" className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label><label className="block text-[10px] text-slate-400">预设动作<select value={action} onChange={(event) => update({ action: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="none">无</option><option value="navigate">跳转</option><option value="submit">提交</option><option value="toggle">切换</option><option value="close">关闭</option></select></label></div>{action === 'navigate' && <label className="block text-[10px] text-slate-400">目标场景 ID<input value={String(data.actionTarget || '')} onChange={(event) => update({ actionTarget: event.target.value })} placeholder="留空则使用图层交互目标" className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label>}{action === 'submit' && <label className="block text-[10px] text-slate-400">提交反馈<input value={String(data.submitFeedback || '已提交')} onChange={(event) => update({ submitFeedback: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label>}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.pressed)} onChange={(event) => update({ pressed: event.target.checked })} />初始显示为按下</label></div>;
};

const OfficialFlowAdvancedFields: React.FC<{ id: string; data: Record<string, any>; update: (patch: Record<string, unknown>) => void }> = ({ id, data, update }) => {
  if (!OFFICIAL_FLOW_IDS.has(id)) return null;
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  return <div className="mt-2 space-y-2 rounded border border-orange-400/10 p-2" data-testid="official-flow-advanced-fields"><label className="block text-[10px] text-slate-400">流程方向<select value={String(data.direction || 'horizontal')} onChange={(event) => update({ direction: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="horizontal">水平</option><option value="vertical">垂直</option></select></label><div className="space-y-1"><div className="text-[10px] text-slate-400">节点颜色</div>{nodes.map((node: any, index: number) => <div key={node.id || index} className="grid grid-cols-[1fr_40px] gap-1"><span className="truncate rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white">{String(node.label || `Node ${index + 1}`)}</span><input type="color" value={String(node.color || '#36d9ff')} onChange={(event) => update({ nodes: nodes.map((item: any, nodeIndex: number) => nodeIndex === index ? { ...item, color: event.target.value } : item) })} aria-label={`节点${index + 1}颜色`} className="h-7 w-full rounded border border-white/10 bg-black/40" /></div>)}</div></div>;
};

/**
 * 官方组件的“组件文字”到底改哪个字段：不同族渲染器读取的字段不同
 * （按钮读 buttonLabel、指标读 caption、通知/弹窗读 title、形状读 content）。
 * 这里统一解析主文案字段，避免用户改了“组件文字”画布却没有任何变化。
 */
const getOfficialPrimaryTextKey = (data: Record<string, any>): string => {
  const id = inferOfficialModaoId(data);
  if (!id) return 'label';
  if (/^(button|button-2|primary-button|secondary-button|icon-button|close-button|link-area)$/.test(id) || id.startsWith('button-tech-') || id.startsWith('button-text-')) return 'buttonLabel';
  if (/^(metric-|dynamic-number|big-number|card-stat)/.test(id)) return 'caption';
  if (/^(notification-|toast$|alert$)/.test(id)) return 'title';
  if (id.startsWith('popup-') || id.startsWith('frame-style-') || id.startsWith('card-')) return 'title';
  if (OFFICIAL_SHAPE_IDS.has(id)) return 'content';
  return 'label';
};

const getOfficialPrimaryTextValue = (data: Record<string, any>): string => {
  const key = getOfficialPrimaryTextKey(data);
  const value = data[key];
  return typeof value === 'string' ? value : String(data.label || '');
};

const OfficialModaoInspector: React.FC<{ element: SceneElement; onUpdateElement: (id: string, patch: Partial<SceneElement>, historyLabel?: string) => void }> = ({ element, onUpdateElement }) => {
  const storedData = element.uiComponentData || {};
  const id = inferOfficialModaoId(storedData);
  const data = id ? { ...getOfficialComponentDefaults(id, String(storedData.label || '官方组件'), String(storedData.accentColor || storedData.color || '#36d9ff')), ...storedData } : storedData;
  const update = (patch: Record<string, unknown>) => {
    let normalizedPatch = Object.prototype.hasOwnProperty.call(patch, 'defaultValue')
      ? { ...patch, content: patch.defaultValue }
      : patch;
    // Keep exactly one active media source so an old local asset cannot mask a URL edit.
    if (Object.prototype.hasOwnProperty.call(patch, 'assetUrl') && !Object.prototype.hasOwnProperty.call(patch, 'assetRefId')) {
      normalizedPatch = { ...normalizedPatch, assetRefId: undefined };
    } else if (Object.prototype.hasOwnProperty.call(patch, 'assetRefId') && patch.assetRefId) {
      normalizedPatch = { ...normalizedPatch, assetUrl: '' };
    }
    if (Array.isArray(patch.columns)) {
      const nextColumns = patch.columns.map(String);
      const currentRows = Array.isArray(data.rows) ? data.rows : [];
      normalizedPatch = { ...normalizedPatch, rows: currentRows.map((row: any) => ({ ...row, cells: nextColumns.map((_, index) => String(row.cells?.[index] ?? '')) })) };
    }
    if (Array.isArray(patch.tabs)) {
      const nextTabs = patch.tabs as string[];
      normalizedPatch = { ...normalizedPatch, activeTab: Math.min(Math.max(0, Number(data.activeTab) || 0), Math.max(0, nextTabs.length - 1)) };
    }
    onUpdateElement(element.id, { uiComponentData: { ...data, ...normalizedPatch } }, '编辑官方组件属性');
  };
  const values = Array.isArray(data.items) ? data.items : [];
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const columns = Array.isArray(data.columns) ? data.columns.map(String) : ['Name', 'Value', 'Status'];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const tabs = Array.isArray(data.tabs) ? data.tabs.map(String) : ['Overview', 'Data', 'Settings'];
  const options = Array.isArray(data.options) ? data.options.map(String) : ['Option 1', 'Option 2', 'Option 3'];
  const updateItem = (index: number, patch: Record<string, unknown>) => update({ items: values.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item) });
  const addItem = () => update({ items: [...values, { id: `point-${Date.now()}`, label: `Item ${values.length + 1}`, value: 0, color: '#36d9ff' }] });
  const removeItem = (index: number) => { if (values.length <= 1) return; update({ items: values.filter((_: unknown, itemIndex: number) => itemIndex !== index) }); };
  const field = (label: string, key: string, type: 'text' | 'number' = 'text', placeholder = '') => <label className="block text-[10px] text-slate-400"><span className="mb-1 block">{label}</span><input type={type} value={data[key] ?? ''} placeholder={placeholder} onChange={(event) => update({ [key]: type === 'number' ? (event.target.value === '' ? undefined : Number(event.target.value)) : event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" /></label>;
  if (!id) return null;
  if (OFFICIAL_CONTAINER_IDS.has(id)) return <><OfficialContainerFields id={id} data={data} update={update} /><OfficialContainerAdvancedFields id={id} data={data} update={update} /></>;
  if (OFFICIAL_METRIC_IDS.has(id) || id === 'weather-card' || id === 'camera-panel' || OFFICIAL_POPUP_IDS.has(id) || OFFICIAL_FRAME_IDS.has(id) || OFFICIAL_BUTTON_IDS.has(id) || OFFICIAL_MAP_IDS.has(id) || (OFFICIAL_FLOW_IDS.has(id) && !OFFICIAL_SHAPE_IDS.has(id))) return <><OfficialSpecialFields id={id} data={data} update={update} /><OfficialButtonFields id={id} data={data} update={update} /><OfficialFlowAdvancedFields id={id} data={data} update={update} /><OfficialSpecialExtraFields id={id} data={data} update={update} /></>;
  if (OFFICIAL_CARD_IDS.has(id)) {
    const cardRows = Array.isArray(data.listItems) ? data.listItems : (Array.isArray(data.items) ? data.items : [{ label: '项目进度', value: '86%' }, { label: '用户增长', value: '64%' }, { label: '设备状态', value: '98%' }]);
    const updateCardRow = (index: number, patch: Record<string, unknown>) => update({ listItems: cardRows.map((row: any, rowIndex: number) => rowIndex === index ? { ...row, ...patch } : row) });
    return <div className="mt-3 space-y-2 border-t border-cyan-400/20 pt-3" data-testid="official-card-inspector">
      <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-cyan-200">卡片专用属性</span><span className="font-mono text-[9px] text-slate-500">{id}</span></div>
      <div className="grid grid-cols-2 gap-2">{field('卡片标题', 'title', 'text', '标题')}{field('状态', 'status', 'text', '正常')}</div>
      {id === 'card-basic' && <><div className="grid grid-cols-2 gap-2">{field('副标题', 'subtitle', 'text', '通用信息面板')}{field('按钮文案', 'actionLabel', 'text', '查看详情')}</div>{field('卡片正文', 'content', 'text', '可编辑内容')}</>}
      {id === 'card-outline' && <><div className="grid grid-cols-2 gap-2">{field('眉题', 'eyebrow', 'text', 'OUTLINE')}{field('底部文案', 'footer', 'text', '更多信息')}</div></>}
      {id === 'card-media' && <><div className="grid grid-cols-2 gap-2">{field('图片 URL', 'imageUrl', 'text', 'https://...')}{field('媒体标签', 'mediaTag', 'text', 'MEDIA')}</div>{field('图片说明', 'caption', 'text', '图片与说明内容')}</>}
      {id === 'card-profile' && <><div className="grid grid-cols-2 gap-2">{field('姓名', 'name', 'text', '姓名')}{field('角色', 'role', 'text', '产品设计师')}</div><div className="grid grid-cols-2 gap-2">{field('头像文字', 'avatarText', 'text', 'A')}{field('头像 URL', 'avatarUrl', 'text', 'https://...')}</div><div className="grid grid-cols-2 gap-2">{field('关注者', 'followers', 'number', '128')}{field('项目数', 'projects', 'number', '24')}</div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.following)} onChange={(event) => update({ following: event.target.checked })} />已关注</label></>}
      {id === 'card-stat' && <><div className="grid grid-cols-2 gap-2">{field('指标名称', 'caption', 'text', '统计卡片')}{field('数值', 'value', 'number', '7516.5')}</div><div className="grid grid-cols-3 gap-2">{field('单位', 'unit', 'text', '')}{field('趋势值', 'trendValue', 'number', '12.6')}{field('完成度', 'progress', 'number', '72')}</div>{field('进度说明', 'progressLabel', 'text', '目标完成度')}</>}
      {id === 'card-list' && <div className="space-y-1"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">列表条目</span><button type="button" onClick={() => update({ listItems: [...cardRows, { label: `条目 ${cardRows.length + 1}`, value: '0%' }] })} className="rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200">+ 添加</button></div>{cardRows.map((row: any, index: number) => <div key={`${row.label || 'row'}-${index}`} className="grid grid-cols-[1fr_68px_28px] gap-1"><input value={String(row.label || '')} onChange={(event) => updateCardRow(index, { label: event.target.value })} aria-label={`列表条目${index + 1}名称`} className="min-w-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><input value={String(row.value ?? '')} onChange={(event) => updateCardRow(index, { value: event.target.value })} aria-label={`列表条目${index + 1}数值`} className="min-w-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><button type="button" disabled={cardRows.length <= 1} onClick={() => update({ listItems: cardRows.filter((_: unknown, rowIndex: number) => rowIndex !== index) })} aria-label={`删除列表条目${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>)}</div>}
      <div className="grid grid-cols-2 gap-2">{field('圆角', 'borderRadius', 'number', '8')}{field('透明度', 'opacity', 'number', '100')}</div>
    </div>;
  }
  if (['spinner-loader', 'dots-loader', 'ring-loader', 'wave-loader'].includes(id)) return <div className="mt-3 space-y-2 border-t border-cyan-400/20 pt-3" data-testid="official-loader-inspector"><div className="text-[10px] font-semibold text-cyan-200">加载动画属性</div><p className="text-[10px] leading-4 text-slate-400">放入画布后即可看到循环动效；“播放动效”控制开关。画布点击只选中图层。</p><div className="grid grid-cols-2 gap-2">{field('速度倍率', 'speed', 'number', '1')}{field('尺寸（px）', 'loaderSize', 'number', '34')}</div>{id === 'ring-loader' && field('进度（%）', 'value', 'number', '72')}{field('提示文字', 'label', 'text', '加载中')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.motionEnabled !== false} onChange={(event) => update({ motionEnabled: event.target.checked })} />播放动效</label><label className="block text-[10px] text-slate-400">表面<select value={String(data.surface || 'transparent')} onChange={(event) => update({ surface: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="transparent">透明（推荐）</option><option value="subtle">弱表面</option><option value="card">卡片容器</option></select></label>{field('圆角', 'borderRadius', 'number', '8')}</div>;
  return <div className="mt-3 space-y-2 border-t border-cyan-400/20 pt-3" data-testid="official-modao-inspector">
    <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-cyan-200">官方组件专用属性</span><span className="font-mono text-[9px] text-slate-500">{id}</span></div>
    {id === 'qr-code' && <div className="space-y-2 rounded border border-sky-400/10 p-2" data-testid="official-qr-fields"><div className="text-[10px] font-medium text-sky-100">二维码属性</div>{field('编码内容', 'qrValue', 'text', 'https://…')}<div className="grid grid-cols-2 gap-2">{field('尺寸', 'qrSize', 'number', '9')}<label className="block text-[10px] text-slate-400">纠错级别<select value={String(data.qrErrorCorrection || 'M')} onChange={(event) => update({ qrErrorCorrection: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="L">L</option><option value="M">M</option><option value="Q">Q</option><option value="H">H</option></select></label></div><div className="grid grid-cols-2 gap-2"><label className="block text-[10px] text-slate-400">前景色<input type="color" value={String(data.qrForeground || '#071522')} onChange={(event) => update({ qrForeground: event.target.value })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/40" /></label><label className="block text-[10px] text-slate-400">背景色<input type="color" value={String(data.qrBackground || '#ffffff')} onChange={(event) => update({ qrBackground: event.target.value })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/40" /></label></div></div>}
    {['gauge', 'progress-ring'].includes(id) && <div className="grid grid-cols-2 gap-2">{field('当前数值', 'value', 'number', '58')}{field('单位', 'unit', 'text', '%')}</div>}
    {OFFICIAL_SHAPE_IDS.has(id) && <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-shape-fields"><div className="text-[10px] font-medium text-cyan-100">形状属性</div>{field('形状文字', 'content', 'text', '文字')}{!['circle', 'start-end'].includes(id) && <div className="grid grid-cols-3 gap-2">{field('边数', 'sides', 'number', '6')}{field('旋转角度', 'rotation', 'number', '0')}{field('边框粗细', 'strokeWidth', 'number', '2')}</div>}<div className="grid grid-cols-2 gap-2"><label className="block text-[10px] text-slate-400">填充色<input type="color" value={String(data.fillColor || '#16344a')} onChange={(event) => update({ fillColor: event.target.value })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/40" /></label><label className="block text-[10px] text-slate-400">描边色<input type="color" value={String(data.strokeColor || data.accentColor || '#36d9ff')} onChange={(event) => update({ strokeColor: event.target.value })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/40" /></label></div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showLabel !== false} onChange={(event) => update({ showLabel: event.target.checked })} />显示文字</label></div>}
    {OFFICIAL_FLOW_NODE_IDS.has(id) && <div className="space-y-2 rounded border border-orange-400/10 p-2" data-testid="official-flow-symbol-fields"><div className="text-[10px] font-medium text-orange-100">流程符号</div>{field('符号文字', 'content', 'text', '步骤名称')}<div className="grid grid-cols-2 gap-2">{field('宽度', 'symbolWidth', 'number', '120')}{field('高度', 'symbolHeight', 'number', '64')}</div></div>}
    {['swimlane', 'vertical-swimlane', 'horizontal-swimlane'].includes(id) && <div className="space-y-2 rounded border border-orange-400/10 p-2" data-testid="official-swimlane-fields"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">泳道</span><button type="button" onClick={() => update({ lanes: [...(Array.isArray(data.lanes) ? data.lanes : []), { id: `lane-${Date.now()}`, label: `泳道 ${(Array.isArray(data.lanes) ? data.lanes.length : 0) + 1}` }] })} className="rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加</button></div>{(Array.isArray(data.lanes) ? data.lanes : []).map((lane: any, index: number) => <div key={lane.id || index} className="grid grid-cols-[1fr_28px] gap-1"><input value={lane.label ?? ''} onChange={(event) => update({ lanes: data.lanes.map((item: any, laneIndex: number) => laneIndex === index ? { ...item, label: event.target.value } : item) })} aria-label={`泳道${index + 1}名称`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><button type="button" disabled={data.lanes.length <= 1} onClick={() => update({ lanes: data.lanes.filter((_: unknown, laneIndex: number) => laneIndex !== index) })} aria-label={`删除泳道${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>)}</div>}
    {OFFICIAL_MEDIA_IDS.has(id) && <div className="space-y-2 rounded border border-sky-400/10 p-2" data-testid="official-media-fields"><div className="text-[10px] font-medium text-sky-100">媒体源与播放</div>{field('资源 URL', 'assetUrl', 'text', 'https://…')}{field('资源名称 / 替代文本', 'assetName', 'text', '描述媒体')}{['video', 'video-player'].includes(id) && field('封面 URL', 'posterUrl', 'text', 'https://…')}<div className="flex flex-wrap gap-3 text-[10px] text-slate-400">{[['autoplay', '自动播放'], ['loop', '循环'], ['controls', '显示控件'], ['muted', '静音']].map(([key, caption]) => <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={Boolean(data[key])} onChange={(event) => update({ [key]: event.target.checked })} />{caption}</label>)}</div>{id === 'carousel' && <div className="space-y-1"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">轮播页</span><button type="button" onClick={() => update({ items: [...(Array.isArray(data.items) ? data.items : []), `第 ${(Array.isArray(data.items) ? data.items.length : 0) + 1} 页`] })} className="rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加</button></div>{(Array.isArray(data.items) ? data.items : []).map((slide: string, index: number) => <div key={`${index}-${slide}`} className="grid grid-cols-[1fr_28px] gap-1"><input value={slide} onChange={(event) => update({ items: data.items.map((item: string, slideIndex: number) => slideIndex === index ? event.target.value : item) })} aria-label={`轮播页${index + 1}标题`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><button type="button" disabled={data.items.length <= 1} onClick={() => update({ items: data.items.filter((_: unknown, slideIndex: number) => slideIndex !== index) })} aria-label={`删除轮播页${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>)}</div>}</div>}
    {OFFICIAL_MEDIA_IDS.has(id) && <OfficialMediaUpload id={id} data={data} update={update} />}
    {OFFICIAL_CONTAINER_IDS.has(id) && <div className="space-y-2 rounded border border-violet-400/10 p-2" data-testid="official-container-fields"><div className="text-[10px] font-medium text-violet-100">容器内容</div>{field('标题', 'title', 'text', '标题')}{field('正文', 'content', 'text', '内容')}{field('资源 URL', 'assetUrl', 'text', 'https://…')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.scrollable)} onChange={(event) => update({ scrollable: event.target.checked })} />允许滚动</label><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">容器条目</span><button type="button" onClick={() => update({ items: [...(Array.isArray(data.items) ? data.items : []), `内容 ${(Array.isArray(data.items) ? data.items.length : 0) + 1}`] })} className="rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加</button></div>{(Array.isArray(data.items) ? data.items : []).map((item: string, index: number) => <div key={`${index}-${item}`} className="grid grid-cols-[1fr_28px] gap-1"><input value={item} onChange={(event) => update({ items: data.items.map((value: string, itemIndex: number) => itemIndex === index ? event.target.value : value) })} aria-label={`容器条目${index + 1}`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><button type="button" disabled={data.items.length <= 1} onClick={() => update({ items: data.items.filter((_: unknown, itemIndex: number) => itemIndex !== index) })} aria-label={`删除容器条目${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>)}</div>}
    {OFFICIAL_CARD_IDS.has(id) && <div className="space-y-2"><div className="grid grid-cols-2 gap-2">{field('卡片标题', 'title', 'text', '标题')}{field('状态', 'status', 'text', '正常')}</div>{field('卡片内容', 'content', 'text', '可编辑内容')}{field('右侧数值/动作', 'value', 'text', '查看详情')}</div>}
    {OFFICIAL_FEEDBACK_IDS.has(id) && <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-feedback-fields"><div className="text-[10px] font-medium text-cyan-100">{id === 'skeleton' ? '骨架屏布局' : '通知与反馈'}</div>{['notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'].includes(id) && <><p className="text-[10px] leading-4 text-slate-400">用法：拖入画布后，在互动预览中可关闭通知；编辑画布点击组件只会选中图层。关闭后可在这里重新显示。</p>{field('标题', 'title', 'text', '提示标题')}{field('消息内容', 'content', 'text', '消息内容')}<div className="grid grid-cols-2 gap-2"><label className="block text-[10px] text-slate-400">通知类型<select value={String(data.notificationType || 'info')} onChange={(event) => update({ notificationType: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="success">成功</option><option value="info">信息</option><option value="warning">警告</option><option value="error">错误</option></select></label><label className="block text-[10px] text-slate-400">表面<select value={String(data.surface || (id === 'toast' ? 'subtle' : 'card'))} onChange={(event) => update({ surface: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="transparent">透明</option><option value="subtle">弱表面</option><option value="card">卡片</option></select></label></div>{field('自动关闭时长（ms，0=不自动）', 'duration', 'number', '0')}<label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showIcon !== false} onChange={(event) => update({ showIcon: event.target.checked })} />显示类型图标</label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.dismissible !== false} onChange={(event) => update({ dismissible: event.target.checked })} />允许关闭</label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={!data.dismissed} onChange={(event) => update({ dismissed: !event.target.checked })} />画布中显示</label></>}{id === 'skeleton' && <><div className="grid grid-cols-2 gap-2">{field('占位行数（2–8）', 'lineCount', 'number', '4')}{field('圆角（px）', 'borderRadius', 'number', '6')}</div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showAvatar !== false} onChange={(event) => update({ showAvatar: event.target.checked })} />显示头像占位</label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.animationEnabled !== false} onChange={(event) => update({ animationEnabled: event.target.checked })} />播放明暗动效</label></>}{['tooltip', 'empty-state'].includes(id) && field('提示内容', 'content', 'text', id === 'empty-state' ? '暂无数据' : '提示信息')}</div>}
    {OFFICIAL_BADGE_IDS.has(id) && <div className="grid grid-cols-2 gap-2">{field('徽章文案', 'content', 'text', '正常')}{field('数字', 'value', 'number', '12')}</div>}
    {id === 'avatar' && <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-avatar-fields"><div className="text-[10px] font-medium text-cyan-100">Avatar</div><div className="grid grid-cols-2 gap-2">{field('Initial', 'avatarText', 'text', 'A')}{field('Subtitle', 'subtitle', 'text', 'Online')}</div>{field('Image URL', 'avatarUrl', 'text', 'https://...')}<div className="grid grid-cols-2 gap-2">{field('Size', 'avatarSize', 'number', '42')}<label className="flex items-center gap-2 pt-4 text-[10px] text-slate-400"><input type="checkbox" checked={data.showSubtitle !== false} onChange={(event) => update({ showSubtitle: event.target.checked })} />Show subtitle</label></div></div>}
    {id === 'avatar-group' && <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-avatar-group-fields"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-cyan-100">Avatar group</span><button type="button" onClick={() => update({ members: [...(Array.isArray(data.members) ? data.members : []), { id: `member-${Date.now()}`, label: String.fromCharCode(65 + (Array.isArray(data.members) ? data.members.length : 0)), color: '#36d9ff' }] })} className="rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> Add</button></div><div className="space-y-1">{(Array.isArray(data.members) ? data.members : []).map((member: any, index: number) => <div key={member.id || index} className="grid grid-cols-[1fr_38px_28px] gap-1"><input value={String(member.label || '')} onChange={(event) => update({ members: (data.members || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, label: event.target.value } : item) })} aria-label={`Avatar ${index + 1}`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><input type="color" value={String(member.color || '#36d9ff')} onChange={(event) => update({ members: (data.members || []).map((item: any, itemIndex: number) => itemIndex === index ? { ...item, color: event.target.value } : item) })} aria-label={`Avatar ${index + 1} color`} className="h-7 w-full rounded border border-white/10 bg-black/40" /><button type="button" disabled={(data.members || []).length <= 1} onClick={() => update({ members: (data.members || []).filter((_: unknown, itemIndex: number) => itemIndex !== index) })} aria-label={`Delete avatar ${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>)}</div><div className="grid grid-cols-3 gap-2">{field('Max visible', 'maxVisible', 'number', '4')}{field('Size', 'avatarSize', 'number', '32')}{field('Overlap', 'overlap', 'number', '8')}</div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showOverflow !== false} onChange={(event) => update({ showOverflow: event.target.checked })} />Show overflow</label></div>}
    {id === 'divider' && <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-divider-fields"><div className="grid grid-cols-2 gap-2"><label className="block text-[10px] text-slate-400">Orientation<select value={String(data.orientation || 'horizontal')} onChange={(event) => update({ orientation: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label><label className="block text-[10px] text-slate-400">Line style<select value={String(data.lineStyle || 'solid')} onChange={(event) => update({ lineStyle: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label></div><div className="grid grid-cols-2 gap-2">{field('Label', 'label', 'text', 'Divider')}{field('Width', 'lineWidth', 'number', '1')}</div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showLabel !== false} onChange={(event) => update({ showLabel: event.target.checked })} />Show label</label></div>}
    {OFFICIAL_CHART_IDS.has(id) && !['table-chart'].includes(id) && <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">{field('单位', 'unit', 'text', '%')}{field('最大值', 'max', 'number', '自动')}</div>
      {id === '3d-bar' && <div className="space-y-2 rounded border border-violet-400/15 bg-violet-400/[0.03] p-2" data-testid="official-3d-chart-fields">
        <div className="text-[10px] font-medium text-violet-200">立体视图</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] text-slate-400">柱体厚度 {Number(data.depth ?? 16)}<input aria-label="柱体厚度" type="range" min="4" max="28" value={Math.max(4, Math.min(28, Number(data.depth ?? 16)))} onChange={(event) => update({ depth: Number(event.target.value) })} className="mt-1 w-full accent-violet-400" /></label>
          <label className="block text-[10px] text-slate-400">透视角度 {Number(data.perspective ?? 34)}°<input aria-label="立体透视角度" type="range" min="12" max="55" value={Math.max(12, Math.min(55, Number(data.perspective ?? 34)))} onChange={(event) => update({ perspective: Number(event.target.value) })} className="mt-1 w-full accent-violet-400" /></label>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={data.showFloor !== false} onChange={(event) => update({ showFloor: event.target.checked })} />透视基底</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={data.showValues !== false} onChange={(event) => update({ showValues: event.target.checked })} />数值标签</label>
        </div>
      </div>}
      <div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">数据项（修改后图形和占比同步）</span><button type="button" onClick={addItem} className="flex items-center gap-1 rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加</button></div>
      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">{values.map((item: any, index: number) => <div key={item.id || index} className={`grid gap-1 ${id === '3d-bar' ? 'grid-cols-[minmax(0,1fr)_58px_28px_28px]' : 'grid-cols-[minmax(0,1fr)_72px_34px]'}`}><input value={item.label ?? ''} onChange={(event) => updateItem(index, { label: event.target.value })} aria-label={`数据项${index + 1}名称`} className="min-w-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><input type="number" min={id === '3d-bar' ? 0 : undefined} value={item.value ?? 0} onChange={(event) => updateItem(index, { value: Number(event.target.value) })} aria-label={`数据项${index + 1}数值`} className="min-w-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />{id === '3d-bar' && <input type="color" value={String(item.color || data.color || '#36d9ff')} onChange={(event) => updateItem(index, { color: event.target.value })} aria-label={`数据项${index + 1}颜色`} className="h-7 w-full rounded border border-white/10 bg-black/40 p-0.5" />}<button type="button" disabled={values.length <= 1} onClick={() => removeItem(index)} aria-label={`删除数据项${index + 1}`} title={values.length <= 1 ? '至少保留一项数据' : '删除此数据项'} className="grid h-7 w-8 place-items-center rounded border border-rose-400/20 text-rose-300 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={12} /></button></div>)}</div>
      <div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showGrid !== false} onChange={(event) => update({ showGrid: event.target.checked })} />显示网格</label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showLegend !== false} onChange={(event) => update({ showLegend: event.target.checked })} />显示图例</label></div>
    </div>}
    {id === 'number-stepper' && <div className="grid grid-cols-3 gap-2">{field('最小值', 'min', 'number', '0')}{field('最大值', 'max', 'number', '100')}{field('步长', 'step', 'number', '1')}</div>}
    {OFFICIAL_NAV_IDS.has(id) && <div className="space-y-2"><label className="block text-[10px] text-slate-400">标签项（逗号分隔）<input value={tabs.join(',')} onChange={(event) => update({ tabs: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label><div className="grid grid-cols-2 gap-2">{field('当前标签索引', 'activeTab', 'number', '0')}<label className="block text-[10px] text-slate-400">方向<select value={data.orientation || 'horizontal'} onChange={(event) => update({ orientation: event.target.value })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white"><option value="horizontal">水平</option><option value="vertical">垂直</option></select></label></div></div>}
    {['table', 'table-chart'].includes(id) && <div className="space-y-2"><label className="block text-[10px] text-slate-400">列名（逗号分隔）<input value={columns.join(',')} onChange={(event) => update({ columns: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">行数据</span><button type="button" onClick={() => update({ rows: [...rows, { id: `row-${Date.now()}`, cells: columns.map(() => '') }] })} className="flex items-center gap-1 rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加行</button></div><div className="max-h-40 space-y-1 overflow-y-auto">{rows.map((row: any, index: number) => <div key={row.id || index} className="grid grid-cols-[1fr_28px] gap-1"><input value={(Array.isArray(row.cells) ? row.cells : []).join(' | ')} onChange={(event) => update({ rows: rows.map((item: any, rowIndex: number) => rowIndex === index ? { ...item, cells: event.target.value.split('|').map((value) => value.trim()) } : item) })} aria-label={`第${index + 1}行`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><button type="button" onClick={() => update({ rows: rows.filter((_: unknown, rowIndex: number) => rowIndex !== index) })} aria-label={`删除第${index + 1}行`} className="rounded border border-rose-400/20 text-rose-300"><Trash2 size={11} /></button></div>)}</div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showHeader !== false} onChange={(event) => update({ showHeader: event.target.checked })} />显示表头</label></div>}
    {OFFICIAL_FLOW_IDS.has(id) && <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">节点（可增删、改文字、改类型）</span><button type="button" onClick={() => update({ nodes: [...nodes, { id: `node-${Date.now()}`, label: `Node ${nodes.length + 1}`, type: 'process' }] })} className="flex items-center gap-1 rounded border border-cyan-400/30 px-2 py-1 text-[10px] text-cyan-200"><Plus size={11} /> 添加节点</button></div><div className="max-h-48 space-y-1 overflow-y-auto">{nodes.map((node: any, index: number) => <div key={node.id || index} className="grid grid-cols-[1fr_110px_28px] gap-1"><input value={node.label ?? ''} onChange={(event) => update({ nodes: nodes.map((item: any, nodeIndex: number) => nodeIndex === index ? { ...item, label: event.target.value } : item) })} aria-label={`节点${index + 1}文字`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><select value={node.type || 'process'} onChange={(event) => update({ nodes: nodes.map((item: any, nodeIndex: number) => nodeIndex === index ? { ...item, type: event.target.value } : item) })} aria-label={`节点${index + 1}类型`} className="rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white"><option value="start">开始</option><option value="process">流程</option><option value="decision">判断</option><option value="end">结束</option><option value="document">文档</option><option value="data">数据</option><option value="subprocess">子流程</option><option value="database">数据库</option><option value="manual-input">手动输入</option><option value="loop">循环</option><option value="parallel">并行</option><option value="merge">合并</option><option value="sort">排序</option></select><button type="button" onClick={() => update({ nodes: nodes.filter((_: unknown, nodeIndex: number) => nodeIndex !== index) })} aria-label={`删除节点${index + 1}`} className="rounded border border-rose-400/20 text-rose-300"><Trash2 size={11} /></button></div>)}</div><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={data.showArrows !== false} onChange={(event) => update({ showArrows: event.target.checked })} />显示连接箭头</label></div>}
    {id === 'rating' && <div className="space-y-2 rounded border border-amber-400/10 p-2" data-testid="official-rating-fields"><p className="text-[10px] leading-4 text-slate-400">点击星星可直接设置评分；在互动预览中也可体验。</p><div className="grid grid-cols-2 gap-2">{field('最低评分', 'min', 'number', '0')}{field('星星总数', 'max', 'number', '5')}</div><div className="grid grid-cols-2 gap-2">{field('当前评分', 'value', 'number', '4')}{field('步长', 'step', 'number', '1')}</div><label className="block text-[10px] text-slate-400">星星颜色<input type="color" value={String(data.ratingColor || data.accentColor || '#ffbd78')} onChange={(event) => update({ ratingColor: event.target.value })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/40" /></label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.disabled)} onChange={(event) => update({ disabled: event.target.checked })} />禁用评分</label></div>}
    {id === 'progress-bar' && <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-progress-fields"><p className="text-[10px] leading-4 text-slate-400">进度条用于展示进度；需要用户拖动调整时，请使用“滑块”。</p><div className="grid grid-cols-3 gap-2">{field('最小值', 'min', 'number', '0')}{field('最大值', 'max', 'number', '100')}{field('当前进度', 'value', 'number', '58')}</div><div className="grid grid-cols-2 gap-2">{field('单位', 'unit', 'text', '%')}<label className="block text-[10px] text-slate-400"><span className="mb-1 block">轨道高度（px）</span><input type="number" min="2" max="24" value={data.trackHeight ?? 8} onChange={(event) => update({ trackHeight: Math.max(2, Math.min(24, Number(event.target.value) || 8)) })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label></div><div className="flex gap-4 text-[10px] text-slate-400"><label className="flex items-center gap-1"><input type="checkbox" checked={data.showLabel !== false} onChange={(event) => update({ showLabel: event.target.checked })} />显示标签</label><label className="flex items-center gap-1"><input type="checkbox" checked={data.showValue !== false} onChange={(event) => update({ showValue: event.target.checked })} />显示数值</label></div></div>}
    {OFFICIAL_FORM_IDS.has(id) && id !== 'progress-bar' && <div className="space-y-2">{['switch', 'ios-switch', 'android-switch', 'switch-ios', 'switch-material'].includes(id) ? <div className="space-y-2 rounded border border-cyan-400/10 p-2" data-testid="official-switch-fields"><p className="text-[10px] leading-4 text-slate-400">编辑态点击画布会选中图层，不会切换开关；进入互动预览后点击开关测试。此开关只演示开 / 关状态，不会触发其他业务动作。</p>{field('开关标签', 'label', 'text', '设置名称')}<div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400"><label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(data.checked)} onChange={(event) => update({ checked: event.target.checked })} />初始为开启</label><label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(data.disabled)} onChange={(event) => update({ disabled: event.target.checked })} />禁用开关</label></div></div> : <><div className="grid grid-cols-2 gap-2">{field('占位文字', 'placeholder', 'text', '请输入')}{field('默认值', 'defaultValue', 'text', '')}</div>{id === 'select' && <label className="block text-[10px] text-slate-400">选项（每行一个）<textarea rows={3} value={options.join('\n')} onChange={(event) => update({ options: event.target.value.split('\n').filter(Boolean) })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white" /></label>}{['slider', 'rating'].includes(id) && <div className="grid grid-cols-3 gap-2">{field('最小值', 'min', 'number', '0')}{field('最大值', 'max', 'number', id === 'rating' ? '5' : '100')}{field('步长', 'step', 'number', '1')}</div>}{['slider', 'rating'].includes(id) && <div className="grid grid-cols-2 gap-2">{field('当前值', 'value', 'number', '0')}{field('单位', 'unit', 'text', id === 'rating' ? '星' : '%')}</div>}<div className="flex gap-4 text-[10px] text-slate-400"><label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(data.required)} onChange={(event) => update({ required: event.target.checked })} />必填</label><label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(data.disabled)} onChange={(event) => update({ disabled: event.target.checked })} />禁用</label></div></>}</div>}
    {['map', 'map-marker'].includes(id) && <div className="grid grid-cols-2 gap-2">{field('地图中心', 'mapCenter', 'text', '北京')}{field('缩放级别', 'zoom', 'number', '10')}</div>}
    {['image', 'video', 'audio', 'carousel'].includes(id) && <div className="grid grid-cols-2 gap-2"><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.autoplay)} onChange={(event) => update({ autoplay: event.target.checked })} />自动播放</label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={Boolean(data.loop)} onChange={(event) => update({ loop: event.target.checked })} />循环</label></div>}
    {!OFFICIAL_CHART_IDS.has(id) && !OFFICIAL_NAV_IDS.has(id) && !OFFICIAL_FLOW_IDS.has(id) && !OFFICIAL_FORM_IDS.has(id) && !OFFICIAL_FEEDBACK_IDS.has(id) && !OFFICIAL_BADGE_IDS.has(id) && !['avatar', 'avatar-group', 'divider', 'rating', 'table', 'decision', 'swimlane', 'map', 'map-marker', 'image', 'video', 'audio', 'carousel'].includes(id) && <div className="grid grid-cols-2 gap-2">{field('正文内容', 'content', 'text', '可编辑内容')}{field('数值', 'value', 'number', '0')}</div>}
    <div className="grid grid-cols-2 gap-2">{field('圆角', 'borderRadius', 'number', '8')}{field('透明度', 'opacity', 'number', '100')}</div>
  </div>;
};

const DEFAULT_COLLAPSED_SECTIONS: Record<string, boolean> = {
  'scene-bg': true,
  'scene-trans': true,
  'scene-gesture': true,
  'scene-groups': false,
  'scene-data': false,
  'scene-comps': false,
  'scene-hud': true,
  'el-timing': false,
  'el-interact': false,
  'el-popup': true,
  'el-pano': true,
  'el-chart': false,
  'el-data': false,
  'el-3d': false,
};

type ElementInspectorTab = 'base' | 'effects' | 'animation' | 'interaction' | 'data';
type SceneInspectorTab = 'base' | 'appearance' | 'transition' | 'interaction' | 'data';

const INSPECTOR_TAB_STORAGE_KEY = 'aether.inspector.last-tab';
const ELEMENT_INSPECTOR_TABS: readonly ElementInspectorTab[] = [
  'base',
  'effects',
  'animation',
  'interaction',
  'data',
];

const isElementInspectorTab = (value: string | null): value is ElementInspectorTab =>
  value !== null && ELEMENT_INSPECTOR_TABS.includes(value as ElementInspectorTab);

const ELEMENT_INSPECTOR_GUIDANCE: Record<ElementInspectorTab, string> = {
  base: '编辑内容、位置、尺寸和组件外观；坐标与尺寸使用相对画布比例，适配不同画布时会同步缩放。',
  animation: '设置入场、关键帧、停留、退场与循环动效；时长以秒为单位，预览时按时间轴顺序执行。',
  interaction: '配置点击或连续节点触发的动作；跳转和弹窗需要选择目标场景，变量写入会在运行时生效。',
  effects: '调整颜色、滤镜、阴影、模糊、景深与视觉反馈；保持样式克制，确保内容和交互状态清晰。',
  data: '把图层属性绑定到场景变量，让预览和发布内容随数据变化。',
};

const SCENE_INSPECTOR_GUIDANCE: Record<SceneInspectorTab, string> = {
  base: '设置场景名称、时长、画布比例与呈现类型。',
  appearance: '配置场景背景颜色、渐变、背景图片和背景音乐。',
  transition: '设置场景进入、退出与转场动效；统一控制动效类型和时长。',
  interaction: '配置自动轮播、播放控制栏和体感交互。',
  data: '管理全局变量、图层分组与可复用组件。',
};

const InspectorGuide: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-1.5 px-0.5 text-[10px] leading-4 text-slate-500">
    <Info size={11} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
    <p>{children}</p>
  </div>
);

const createDefaultContinuousNodePopup = (index: number): Omit<PopupConfig, 'id' | 'target' | 'enabled'> => {
  const { id: _id, target: _target, enabled: _enabled, ...popup } = createDefaultPopup(index);
  return { ...popup, popupRatio: 'free', popupHeight: popup.popupWidth };
};

function getPopupRatioPatch(
  popup: Partial<PopupConfig>,
  ratio: PopupConfig['popupRatio'],
  canvasAspect: number,
): Partial<PopupConfig> {
  const current = resolvePopupSizePercent(popup, canvasAspect);
  if (ratio === 'free') {
    return { popupRatio: 'free', popupSize: 'custom', popupWidth: current.width, popupHeight: current.height };
  }
  const next = resolvePopupSizePercent({ ...popup, popupRatio: ratio }, canvasAspect);
  return { popupRatio: ratio, popupSize: 'custom', popupWidth: next.width, popupHeight: next.height };
}

const ContinuousInteractionEditor: React.FC<{
  element: SceneElement;
  scenes: ProjectData['scenes'];
  canvasAspect: number;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>, actionTitle?: string, recordHistory?: boolean) => void;
}> = ({ element, scenes, canvasAspect, onUpdateElement }) => {
  const config = normalizeContinuousInteraction(element.uiComponentData?.continuousInteraction as ContinuousInteractionConfig | undefined);
  const update = (patch: Partial<ContinuousInteractionConfig>) => onUpdateElement(element.id, {
    uiComponentData: { ...(element.uiComponentData || {}), continuousInteraction: { ...config, ...patch } },
  });
  const updateNode = (id: string, patch: Partial<ContinuousInteractionNode>) => update({
    nodes: config.nodes.map((node) => node.id === id ? { ...node, ...patch } : node),
  });
  const addNode = () => {
    if (config.nodes.length >= 8) return;
    const position = nextContinuousCheckpointPosition(config);
    update({
      mode: 'staged',
      nodes: [...config.nodes, {
        id: `checkpoint_${Date.now()}`,
        position,
        role: 'checkpoint',
        label: `节点 ${config.nodes.filter((node) => node.role === 'checkpoint').length + 1}`,
        interaction: { action: 'popup' },
        popup: createDefaultContinuousNodePopup(config.nodes.filter((node) => node.interaction?.action === 'popup').length),
        retrigger: 'once',
      }],
    });
  };
  const checkpointNodes = config.nodes.filter((node) => node.role === 'checkpoint');
  const removeNode = (id: string) => {
    const next = removeContinuousCheckpoint(config, id);
    update({ nodes: next.nodes, activeNodeId: next.activeNodeId });
  };
  const removeLatestNode = () => {
    const latest = checkpointNodes[checkpointNodes.length - 1];
    if (latest) removeNode(latest.id);
  };

  return <div className="mt-3 space-y-3 border-t border-cyan-400/20 pt-3">
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-[10px] font-semibold text-cyan-100">多段式连续交互</div>
        <div className="mt-0.5 text-[9px] leading-4 text-slate-500">起点与终点固定，中间节点按需添加。</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={addNode} disabled={config.nodes.length >= 8} className="flex h-7 items-center gap-1 rounded border border-cyan-400/30 bg-cyan-400/10 px-2 text-[10px] font-medium text-cyan-100 transition-colors hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="添加交互节点">
          <Plus size={12} /> 添加节点
        </button>
        <button type="button" onClick={removeLatestNode} disabled={checkpointNodes.length === 0} className="flex h-7 items-center gap-1 rounded border border-rose-400/25 bg-rose-400/[0.08] px-2 text-[10px] font-medium text-rose-200 transition-colors hover:bg-rose-400/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="删除最后一个中间节点" title="删除最后一个中间节点">
          <Trash2 size={12} /> 删除节点
        </button>
      </div>
    </div>

    <label className="block space-y-1 text-[10px] text-slate-400">
      <span>引导文案</span>
      <input value={config.label} onChange={(event) => update({ label: event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400" />
    </label>
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-[10px] text-slate-400"><span>交互模式</span><select value={config.mode} onChange={(event) => update({ mode: event.target.value as ContinuousInteractionConfig['mode'] })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"><option value="confirm">终点确认</option><option value="staged">逐段触发</option><option value="explore">自由探索</option></select></label>
      <label className="space-y-1 text-[10px] text-slate-400"><span>弹窗期间</span><select value={config.popupPolicy} onChange={(event) => update({ popupPolicy: event.target.value as ContinuousInteractionConfig['popupPolicy'] })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"><option value="lock">锁定进度</option><option value="continue">允许继续</option></select></label>
    </div>

    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="mb-2 flex items-center justify-between text-[9px] text-slate-500"><span>节点轨道</span><span>{config.nodes.length}/8</span></div>
      <div className="relative mx-1 h-5 rounded-full bg-white/10">
        {config.nodes.map((node) => <i key={node.id} title={node.label || node.role} className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 ${node.role === 'checkpoint' ? 'bg-cyan-400' : 'bg-slate-300'}`} style={{ left: `${node.position}%` }} />)}
      </div>
    </div>

    <div className="space-y-2">
      {config.nodes.map((node, index) => {
        const immutable = node.role === 'start' || node.role === 'end';
        const action = node.interaction?.action || 'none';
        const popup = node.popup || {};
        const updatePopup = (patch: Omit<Partial<PopupConfig>, 'id' | 'target' | 'enabled'>) => updateNode(node.id, { popup: { ...popup, ...patch } });
        const activatePopupEditor = () => update({ activeNodeId: node.id });
        return <div key={node.id} className={`space-y-2 rounded-md border p-2 ${config.activeNodeId === node.id ? 'border-sky-400/50 bg-sky-400/[0.045]' : 'border-white/10 bg-white/[0.025]'}`}>
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded bg-white/10 text-[9px] font-bold text-slate-300">{index + 1}</span>
            <input value={node.label || ''} onChange={(event) => updateNode(node.id, { label: event.target.value })} placeholder={node.role === 'start' ? '起始锚点' : node.role === 'end' ? '完成' : '节点名称'} className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" />
            {!immutable && <button type="button" onClick={() => removeNode(node.id)} className="grid h-6 w-6 place-items-center rounded text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300" aria-label={`删除${node.label || '节点'}`}><Trash2 size={13} /></button>}
          </div>
          {!immutable && <div className="grid grid-cols-[1fr_44px] items-center gap-2"><input type="range" min="5" max="95" value={node.position} onChange={(event) => updateNode(node.id, { position: Number(event.target.value) })} className="h-1 w-full cursor-pointer accent-cyan-400" aria-label={`${node.label || '节点'}位置`} /><input type="number" min="5" max="95" value={node.position} onChange={(event) => updateNode(node.id, { position: Math.max(5, Math.min(95, Number(event.target.value) || 5)) })} className="w-full rounded border border-white/10 bg-black/40 px-1 py-1 text-right font-mono text-[10px] text-white" aria-label="节点位置百分比" /></div>}
          {node.role !== 'start' && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[9px] text-slate-500"><span>到达动作</span><select value={action} onChange={(event) => { const nextAction = event.target.value as NonNullable<ContinuousInteractionNode['interaction']>['action']; const popupIndex = config.nodes.filter((item) => item.id !== node.id && item.interaction?.action === 'popup').length; updateNode(node.id, { interaction: { ...node.interaction, action: nextAction }, popup: nextAction === 'popup' && !node.popup ? createDefaultContinuousNodePopup(popupIndex) : node.popup }); }} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="none">无动作</option><option value="popup">弹出场景</option><option value="jump">切换场景</option><option value="set-variable">写入变量</option></select></label><label className="space-y-1 text-[9px] text-slate-500"><span>重复触发</span><select value={node.retrigger || 'once'} onChange={(event) => updateNode(node.id, { retrigger: event.target.value as ContinuousInteractionNode['retrigger'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="once">仅一次</option><option value="on-reenter">回退后重触发</option><option value="every-crossing">每次跨越</option></select></label></div>}
          {(action === 'popup' || action === 'jump') && <label className="block space-y-1 text-[9px] text-slate-500"><span>目标场景</span><select value={node.interaction?.target || ''} onChange={(event) => updateNode(node.id, { interaction: { ...node.interaction, action, target: event.target.value } })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="">选择场景</option>{Object.values(scenes).map((scene) => <option key={scene.id} value={scene.id}>{scene.alias || scene.id}</option>)}</select></label>}
          {action === 'popup' && <details open className="rounded border border-sky-400/20 bg-sky-400/[0.035] p-2">
            <summary className="cursor-pointer list-none text-[10px] font-medium text-sky-100">弹窗呈现</summary>
            <div className="mt-2 space-y-2">
              <button type="button" onClick={activatePopupEditor} className={`w-full rounded border px-2 py-1.5 text-[10px] font-medium transition-colors ${config.activeNodeId === node.id ? 'border-sky-300 bg-sky-400/20 text-sky-50' : 'border-sky-400/30 bg-black/20 text-sky-200 hover:bg-sky-400/15'}`} aria-label={`在画布编辑${node.label || '节点'}弹窗`}>{config.activeNodeId === node.id ? '正在画布编辑此节点弹窗' : '在画布编辑此节点弹窗'}</button>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[9px] text-slate-500"><span>呈现方式</span><select value={popup.popupDisplay || 'modal'} onChange={(event) => updatePopup({ popupDisplay: event.target.value as PopupConfig['popupDisplay'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="modal">模态弹窗</option><option value="popover">浮层卡片</option><option value="inline">原地展开</option></select></label>
                <label className="space-y-1 text-[9px] text-slate-500"><span>入场动画</span><select value={popup.popupAnimationType || 'fadeIn'} onChange={(event) => updatePopup({ popupAnimationType: event.target.value as PopupConfig['popupAnimationType'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="none">无动画</option><option value="fadeIn">淡入</option><option value="slideUp">上浮</option><option value="slideDown">下落</option><option value="slideLeft">左滑</option><option value="slideRight">右滑</option><option value="zoomIn">放大</option><option value="bounce">弹性</option></select></label>
              </div>
              <label className="block space-y-1 text-[9px] text-slate-500"><span>出场动画</span><select value={popup.popupExitAnimationType ?? 'fadeOut'} onChange={(event) => updatePopup({ popupExitAnimationType: event.target.value as PopupConfig['popupExitAnimationType'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="none">无动画</option><option value="fadeOut">淡出</option><option value="slideUp">向上滑出</option><option value="slideDown">向下滑出</option><option value="slideLeft">向左滑出</option><option value="slideRight">向右滑出</option><option value="zoomOut">缩小退出</option><option value="zoomIn">放大退出</option><option value="bounce">弹性退出</option><option value="rotate">旋转退出</option></select></label>
              <label className="block space-y-1 text-[9px] text-slate-500"><span>停留方式</span><select value={popup.popupStayMode || 'short'} onChange={(event) => updatePopup({ popupStayMode: event.target.value as PopupConfig['popupStayMode'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="short">短期停留（可关闭）</option><option value="long">长期停留（不退出）</option></select><span className="block leading-4 text-slate-600">长期停留会保留至主场景切换，不显示关闭入口。</span></label>
              <label className="block space-y-1 text-[9px] text-slate-500"><span>弹窗位置</span><select value={popup.popupPosition || 'center'} onChange={(event) => updatePopup({ popupPosition: event.target.value as PopupConfig['popupPosition'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="center">居中</option><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option><option value="custom">自定义坐标</option></select></label>
              <div className="grid grid-cols-3 gap-1 rounded border border-white/10 bg-black/20 p-1.5" role="group" aria-label="弹窗九宫格定位">
                {[{ x: 8, y: 8, label: '↖' }, { x: 50, y: 8, label: '↑' }, { x: 92, y: 8, label: '↗' }, { x: 8, y: 50, label: '←' }, { x: 50, y: 50, label: '●' }, { x: 92, y: 50, label: '→' }, { x: 8, y: 92, label: '↙' }, { x: 50, y: 92, label: '↓' }, { x: 92, y: 92, label: '↘' }].map((position) => {
                  const active = popup.popupPosition === 'custom' && Math.abs((popup.popupX ?? 50) - position.x) < 5 && Math.abs((popup.popupY ?? 50) - position.y) < 5;
                  return <button key={`${position.x}-${position.y}`} type="button" onClick={() => updatePopup({ popupPosition: 'custom', popupX: position.x, popupY: position.y })} aria-label={`定位到${position.label}`} className={`aspect-square rounded text-[12px] transition-colors ${active ? 'bg-sky-500 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-sky-500/20 hover:text-sky-200'}`}>{position.label}</button>;
                })}
              </div>
              <p className="text-[9px] leading-4 text-slate-500">选择节点后可在画布拖拽虚线框，精确调整位置和尺寸。</p>
              {popup.popupPosition === 'custom' && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[9px] text-slate-500"><span>X (%)</span><input type="number" min="0" max="100" value={popup.popupX ?? 50} onChange={(event) => updatePopup({ popupX: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /></label><label className="space-y-1 text-[9px] text-slate-500"><span>Y (%)</span><input type="number" min="0" max="100" value={popup.popupY ?? 50} onChange={(event) => updatePopup({ popupY: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /></label></div>}
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[9px] text-slate-500"><span>弹窗大小</span><select value={popup.popupSize || 'medium'} onChange={(event) => updatePopup({ popupSize: event.target.value as PopupConfig['popupSize'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="small">小</option><option value="medium">中</option><option value="large">大</option><option value="custom">自定义</option></select></label>
                <label className="space-y-1 text-[9px] text-slate-500"><span>宽高比</span><select value={popup.popupRatio || '16:9'} onChange={(event) => updatePopup(getPopupRatioPatch(popup, event.target.value as PopupConfig['popupRatio'], canvasAspect))} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="free">自由</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option><option value="9:16">9:16</option><option value="custom">自定义比例</option></select></label>
              </div>
              <div className="grid grid-cols-4 gap-1" role="group" aria-label="常用弹窗尺寸">{[{ label: '小', width: 40 }, { label: '中', width: 60 }, { label: '大', width: 80 }, { label: '全屏', width: 95 }].map((size) => <button key={size.label} type="button" onClick={() => updatePopup({ popupSize: 'custom', popupWidth: size.width })} className={`rounded py-1 text-[9px] font-medium transition-colors ${popup.popupSize === 'custom' && Math.abs((popup.popupWidth ?? 60) - size.width) < 2 ? 'bg-sky-500 text-white' : 'bg-white/[0.06] text-slate-400 hover:bg-sky-500/20 hover:text-sky-200'}`}>{size.label}</button>)}</div>
              {popup.popupSize === 'custom' && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[9px] text-slate-500"><span>宽度 (%)</span><input type="number" min="10" max="96" value={popup.popupWidth ?? 60} onChange={(event) => updatePopup({ popupWidth: Math.max(10, Math.min(96, Number(event.target.value) || 10)) })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /></label><label className="space-y-1 text-[9px] text-slate-500"><span>高度 (%)</span><input type="number" min="10" max="96" value={popup.popupHeight ?? popup.popupWidth ?? 60} disabled={popup.popupRatio !== 'free'} onChange={(event) => updatePopup({ popupHeight: Math.max(10, Math.min(96, Number(event.target.value) || 10)) })} className={`w-full rounded border border-white/10 px-1.5 py-1 text-[10px] ${popup.popupRatio === 'free' ? 'bg-black/40 text-white' : 'cursor-not-allowed bg-black/20 text-slate-500'}`} title={popup.popupRatio === 'free' ? '自由调整高度' : '高度由宽高比控制'} /></label></div>}
              {popup.popupRatio === 'custom' && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[9px] text-slate-500"><span>比例宽</span><input type="number" min="1" max="30" value={popup.popupRatioW ?? 16} onChange={(event) => updatePopup({ popupRatioW: Math.max(1, Math.min(30, Number(event.target.value) || 1)) })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /></label><label className="space-y-1 text-[9px] text-slate-500"><span>比例高</span><input type="number" min="1" max="30" value={popup.popupRatioH ?? 9} onChange={(event) => updatePopup({ popupRatioH: Math.max(1, Math.min(30, Number(event.target.value) || 1)) })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /></label></div>}
              <div className="flex items-center justify-between border-t border-white/10 pt-2"><span className="text-[10px] text-slate-400">点击遮罩关闭</span><button type="button" onClick={() => updatePopup({ popupCloseOnOverlay: !(popup.popupCloseOnOverlay ?? true) })} aria-pressed={popup.popupCloseOnOverlay ?? true} className={`relative h-5 w-9 rounded-full transition-colors ${(popup.popupCloseOnOverlay ?? true) ? 'bg-sky-500' : 'bg-white/20'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${(popup.popupCloseOnOverlay ?? true) ? 'translate-x-4' : 'translate-x-0.5'}`} /></button></div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[9px] text-slate-500"><span>弹窗款式</span><select value={normalizePopupTheme(popup.popupTheme)} onChange={(event) => updatePopup({ popupTheme: event.target.value as PopupConfig['popupTheme'] })} className="w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white"><option value="default">默认深色</option><option value="immersive">沉浸透明</option><option value="neon">霓虹</option><option value="cyberpunk">赛博朋克</option><option value="glass">全息玻璃</option><option value="hologram">全息投影</option><option value="luxury">奢华金</option><option value="minimal">极简白</option><option value="corporate">商务蓝</option></select></label>
                <label className="space-y-1 text-[9px] text-slate-500"><span>动画时长 ({popup.popupAnimationDuration ?? 500}ms)</span><input type="range" min="100" max="1000" step="50" value={popup.popupAnimationDuration ?? 500} onChange={(event) => updatePopup({ popupAnimationDuration: Number(event.target.value) })} className="h-6 w-full accent-sky-400" /></label>
              </div>
              <details className="border-t border-white/10 pt-2"><summary className="cursor-pointer list-none text-[9px] text-slate-400">高级外观</summary><div className="mt-2 space-y-2"><div className="grid grid-cols-3 gap-2"><label className="space-y-1 text-[9px] text-slate-500"><span>背景</span><input type="color" value={popup.popupBgColor || '#111420'} onChange={(event) => updatePopup({ popupBgColor: event.target.value })} className="h-7 w-full rounded border border-white/10 bg-transparent" /></label><label className="space-y-1 text-[9px] text-slate-500"><span>边框</span><input type="color" value={popup.popupBorderColor || '#ffffff'} onChange={(event) => updatePopup({ popupBorderColor: event.target.value })} className="h-7 w-full rounded border border-white/10 bg-transparent" /></label><label className="space-y-1 text-[9px] text-slate-500"><span>辉光</span><input type="color" value={popup.popupGlowColor || '#38bdf8'} onChange={(event) => updatePopup({ popupGlowColor: event.target.value })} className="h-7 w-full rounded border border-white/10 bg-transparent" /></label></div><label className="block space-y-1 text-[9px] text-slate-500"><span>圆角 ({popup.popupRadius ?? 16}px)</span><input type="range" min="0" max="40" step="2" value={popup.popupRadius ?? 16} onChange={(event) => updatePopup({ popupRadius: Number(event.target.value) })} className="h-5 w-full accent-sky-400" /></label><label className="block space-y-1 text-[9px] text-slate-500"><span>遮罩模糊 ({popup.popupOverlayBlur ?? 24}px)</span><input type="range" min="0" max="60" step="2" value={popup.popupOverlayBlur ?? 24} onChange={(event) => updatePopup({ popupOverlayBlur: Number(event.target.value) })} className="h-5 w-full accent-sky-400" /></label><label className="block space-y-1 text-[9px] text-slate-500"><span>遮罩透明度 ({Math.round((popup.popupOverlayOpacity ?? 0.8) * 100)}%)</span><input type="range" min="0" max="100" step="5" value={Math.round((popup.popupOverlayOpacity ?? 0.8) * 100)} onChange={(event) => updatePopup({ popupOverlayOpacity: Number(event.target.value) / 100 })} className="h-5 w-full accent-sky-400" /></label></div></details>
            </div>
          </details>}
          {action === 'set-variable' && <div className="grid grid-cols-2 gap-2"><input value={String(node.interaction?.variableName || '')} onChange={(event) => updateNode(node.id, { interaction: { ...node.interaction, action, variableName: event.target.value } })} placeholder="变量名" className="rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /><input value={String(node.interaction?.variableValue ?? '')} onChange={(event) => updateNode(node.id, { interaction: { ...node.interaction, action, variableValue: event.target.value } })} placeholder="变量值" className="rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white" /></div>}
        </div>;
      })}
    </div>
  </div>;
};

interface InspectorPanelProps {
  projectData: ProjectData;
  activeSceneId: string;
  selectedElementId: string | null;
  onUpdateProject: (updater: (prev: ProjectData) => ProjectData, actionTitle?: string, actionType?: any, details?: string, recordHistory?: boolean) => void;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>, actionTitle?: string, recordHistory?: boolean) => void;
  onDeleteElement: (elId: string) => void;
  onSelectElement: (id: string | null) => void;
  onPreviewTransition?: () => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onOpenDrawMode?: () => void;
  /** Enter the mask-specific pen workflow for the currently selected layer. */
  onOpenMaskPenMode?: () => void;
  onOpenBackgroundRemoval?: () => void;
  onOpenCustomCodePlugin?: (elementId: string) => void;
  /** 当前选中的热点（编辑模式） */
  selectedHotspot?: { elementId: string; hotspotId: string } | null;
  /** 更新热点属性 */
  onUpdateHotspot?: (elementId: string, hotspotId: string, patch: Partial<Hotspot>) => void;
  /** 删除热点 */
  onDeleteHotspot?: (elementId: string, hotspotId: string) => void;
  /** 取消选中热点 */
  onSelectHotspot?: (elementId: string, hotspotId: string | null) => void;
  /** 拆开合并图层组（嵌套容器） */
  onUnmergeElement?: (elId: string) => void;
  /** 面板宽度（由外部拖拽分隔条控制） */
  width?: number;
}

type VisualAssetKind = 'image' | 'video' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat' | 'audio' | 'font' | 'other';

interface VisualAssetOption {
  key: string;
  name: string;
  sourceName: string;
  kind: VisualAssetKind;
}

const getVisualAssetKind = (metadata: AssetMetadata | undefined, blob: Blob | undefined, name: string): VisualAssetKind => {
  const declared = metadata?.kind;
  if (declared === '3d') return 'model-3d';
  if (declared === 'panorama') return 'panorama-img';
  if (declared === 'panorama-video') return 'panorama-vid';
  if (declared === 'gaussian-splat') return 'gaussian-splat';
  if (declared === 'image' || declared === 'video' || declared === 'audio') return declared;

  const lowerName = name.toLowerCase();
  const mime = blob?.type?.toLowerCase() || '';
  if (/\.(ply|splat)$/.test(lowerName) || /gaussian|splat/.test(lowerName)) return 'gaussian-splat';
  if (/\.(glb|gltf|obj|fbx|stl|3ds)$/.test(lowerName) || mime.includes('model/')) return 'model-3d';
  if (/pano|360|equirect/.test(lowerName)) {
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/.test(lowerName)) return 'panorama-vid';
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|avif)$/.test(lowerName)) return 'panorama-img';
  }
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(lowerName)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/.test(lowerName)) return 'audio';
  if (/\.(ttf|otf|woff|woff2)$/.test(lowerName) || mime.includes('font')) return 'font';
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)$/.test(lowerName)) return 'image';
  return 'other';
};

const visualAssetKindLabel: Record<VisualAssetKind, string> = {
  image: '图片',
  video: '视频',
  'panorama-img': 'VR全景图',
  'panorama-vid': 'VR全景视频',
  'model-3d': '3D模型',
  'gaussian-splat': '高斯泼溅',
  audio: '音频',
  font: '字体',
  other: '其他',
};

const UiComponentTextStyleControls: React.FC<{ element: SceneElement; onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void }> = ({ element, onUpdateElement }) => {
  const data = element.uiComponentData || {};
  const textElement = {
    ...element,
    ...data,
    type: 'txt',
    content: data.label || '',
    color: data.textColor || '#333333',
    textColor: data.textColor || '#333333',
  } as SceneElement;
  const updateTextStyle = (_elementId: string, patch: Partial<SceneElement>) => {
    const supportedKeys = [
      'textColor', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textDecoration',
      'textAlign', 'letterSpacing', 'lineHeight', 'textOpacity', 'textPadding',
      'textGlowEnabled', 'textGlowColor', 'textGlowBlur', 'textGlowIntensity',
      'textShadowEnabled', 'textShadowColor', 'textShadowBlur', 'textShadowDistance',
      'textShadowAngle', 'textShadowOpacity',
    ] as const;
    const stylePatch = supportedKeys.reduce((result, key) => {
      if (key in patch) result[key] = patch[key];
      return result;
    }, {} as Record<string, unknown>);
    onUpdateElement(element.id, { uiComponentData: { ...data, ...stylePatch } });
  };
  return <TextStyleControls element={textElement} onUpdateElement={updateTextStyle} colorField="textColor" paddingField="textPadding" defaultLineHeight={1.2} />;
};

const UiItemsEditor: React.FC<{ element: SceneElement; onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void }> = ({ element, onUpdateElement }) => {
  const data = element.uiComponentData || {};
  const updateData = (patch: Record<string, unknown>) => onUpdateElement(element.id, { uiComponentData: { ...data, ...patch } });
  const type = element.uiComponentType || '';
  const [visualAssets, setVisualAssets] = useState<VisualAssetOption[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadVisualAssets = async () => {
      setAssetsLoading(true);
      try {
        await dbManager.ensureReady();
        const keys = await dbManager.getAllKeys();
        const next: VisualAssetOption[] = [];
        for (const key of keys) {
          try {
            const metadata = await dbManager.getMetadata(key) as AssetMetadata | undefined;
            const blob = dbManager.getBlob(key) || await dbManager.get(key);
            const name = metadata?.name || metadata?.originalName || key.replace(/^asset_|^img_|^res_/, '');
            const typeName = metadata?.originalName || metadata?.name || key;
            next.push({ key, name, sourceName: typeName, kind: getVisualAssetKind(metadata, blob, typeName) });
          } catch {
            // 忽略单个损坏素材，避免属性面板整体不可用。
          }
        }
        if (!cancelled) setVisualAssets(next.sort((a, b) => a.name.localeCompare(b.name)));
      } finally {
        if (!cancelled) setAssetsLoading(false);
      }
    };
    loadVisualAssets();
    return () => { cancelled = true; };
  }, []);


  if (type === 'custom-visual') {
    const currentAssetId = data.assetRefId || data.visual?.assetRefId || '';
    const currentAsset = visualAssets.find((asset) => asset.key === currentAssetId);
    const currentAssetKnown = !currentAssetId || !!currentAsset;
    const handleAssetChange = (assetId: string) => {
      const asset = visualAssets.find((item) => item.key === assetId);
      updateData({
        assetRefId: assetId || undefined,
        assetKind: asset?.kind,
        assetName: asset?.sourceName || asset?.name,
        visual: {
          ...(data.visual || {}),
          assetRefId: assetId || undefined,
          assetKind: asset?.kind,
          assetName: asset?.sourceName || asset?.name,
        },
      });
    };
    return <div className="space-y-2 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-cyan-200">绑定视觉素材</span><span className="text-[9px] text-slate-500">从素材库直接选择</span></div>
      <select value={currentAssetId} onChange={(event) => handleAssetChange(event.target.value)} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400" aria-label="选择 UI 视觉素材">
        <option value="">{assetsLoading ? '正在加载素材…' : '选择视觉素材'}</option>
        {visualAssets.map((asset) => <option key={asset.key} value={asset.key}>{asset.name} · {visualAssetKindLabel[asset.kind]}</option>)}
      </select>
      {currentAsset && <div className="text-[9px] text-cyan-200/70">已识别为 {visualAssetKindLabel[currentAsset.kind]}</div>}
      {!assetsLoading && !currentAssetKnown && <div className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[9px] text-amber-200">当前素材不在素材库中，预览可能为空。</div>}
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0"><span className="mb-1 block text-[9px] text-slate-500">显示方式</span><select value={data.visual?.fit || 'contain'} onChange={(event) => updateData({ visual: { ...(data.visual || {}), fit: event.target.value } })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white"><option value="contain">完整显示</option><option value="cover">铺满裁切</option></select></label>
        <label className="min-w-0"><span className="mb-1 block text-[9px] text-slate-500">透明度</span><input type="number" min="0" max="1" step="0.05" value={data.visual?.opacity ?? 1} onChange={(event) => updateData({ visual: { ...(data.visual || {}), opacity: Math.max(0, Math.min(1, Number(event.target.value) || 0)) } })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /></label>
      </div>
    </div>;
  }

  if (type === 'data-trend-chart' || type === 'data-trend-cyber-chart' || type === 'data-trend-area-chart') {
    const points = Array.isArray(data.chartData) ? data.chartData : [];
    const updatePoints = (next: Array<{ xLabel: string; value: number }>) => updateData({
      chartData: next,
      series: next.map((point) => point.value),
      categories: next.map((point) => point.xLabel),
    });
    return <div className="space-y-1.5 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-cyan-200">数据点 {points.length}</span><div className="flex gap-1"><button type="button" onClick={() => updatePoints([...points, { xLabel: `${points.length + 1}`, value: 0 }])} className="rounded bg-cyan-500/20 px-2 py-1 text-[10px] text-cyan-200">+ 增加</button><button type="button" disabled={points.length <= 1} onClick={() => updatePoints(points.slice(0, -1))} className="rounded bg-white/10 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40">- 删除</button></div></div>
      {points.map((point: any, index: number) => <div key={index} className="grid grid-cols-[1fr_72px] gap-1.5"><input value={point.xLabel ?? ''} onChange={(event) => { const next = [...points]; next[index] = { ...point, xLabel: event.target.value }; updatePoints(next); }} className="min-w-0 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第 ${index + 1} 个横轴标签`} /><input type="number" value={point.value ?? 0} onChange={(event) => { const next = [...points]; next[index] = { ...point, value: Number(event.target.value) || 0 }; updatePoints(next); }} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第 ${index + 1} 个数值`} /></div>)}
      <label className="block text-[9px] text-slate-500">纵轴最大值<input type="number" min="1" value={data.maxY ?? ''} onChange={(event) => updateData({ maxY: Math.max(1, Number(event.target.value) || 1) })} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" /></label>
    </div>;
  }

  if (type === 'bar-chart' || type === 'trend-line') {
    const series = Array.isArray(data.series) ? data.series : [46, 68, 54, 82, 61, 74];
    const categories = Array.isArray(data.categories) ? data.categories : series.map((_: unknown, index: number) => `项目 ${index + 1}`);
    return <div className="space-y-1.5 border-t border-white/10 pt-2"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-cyan-200">手动项目 {series.length}</span><div className="flex gap-1"><button type="button" onClick={() => updateData({ series: [...series, 50], categories: [...categories, `项目 ${series.length + 1}`] })} className="rounded bg-cyan-500/20 px-2 py-1 text-[10px] text-cyan-200">+ 增加</button><button type="button" disabled={series.length <= 1} onClick={() => updateData({ series: series.slice(0, -1), categories: categories.slice(0, -1) })} className="rounded bg-white/10 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40">- 删除</button></div></div>{series.map((value: number, index: number) => <div key={index} className="grid grid-cols-[1fr_72px] gap-1.5"><input value={categories[index] || `项目 ${index + 1}`} onChange={(event) => { const next = [...categories]; next[index] = event.target.value; updateData({ categories: next }); }} className="min-w-0 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第${index + 1}项名称`} /><input type="number" value={value} onChange={(event) => { const next = [...series]; next[index] = Number(event.target.value) || 0; updateData({ series: next }); }} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第${index + 1}项数值`} /></div>)}</div>;
  }

  if (type === 'pattern-prediction-chart') {
    const points = Array.isArray(data.chartData)
      ? data.chartData
      : Array.isArray(data.series)
        ? data.series.map((value: number, index: number) => ({ xLabel: data.categories?.[index] || `项目 ${index + 1}`, value }))
        : [];
    const updatePoints = (next: Array<{ xLabel: string; value: number }>) => updateData({
      chartData: next,
      series: next.map((point) => point.value),
      categories: next.map((point) => point.xLabel),
    });
    return <div className="space-y-1.5 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-cyan-200">数据点 {points.length}</span><div className="flex gap-1"><button type="button" onClick={() => updatePoints([...points, { xLabel: `${points.length + 1}`, value: 3000 }])} className="rounded bg-cyan-500/20 px-2 py-1 text-[10px] text-cyan-200">+ 增加</button><button type="button" disabled={points.length <= 1} onClick={() => updatePoints(points.slice(0, -1))} className="rounded bg-white/10 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40">- 删除</button></div></div>
      {points.map((point: any, index: number) => <div key={index} className="grid grid-cols-[1fr_88px] gap-1.5"><input value={point.xLabel ?? ''} onChange={(event) => { const next = [...points]; next[index] = { ...point, xLabel: event.target.value }; updatePoints(next); }} className="min-w-0 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第${index + 1}个横轴标签`} /><input type="number" value={point.value ?? 0} onChange={(event) => { const next = [...points]; next[index] = { ...point, value: Number(event.target.value) || 0 }; updatePoints(next); }} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第${index + 1}个数据值`} /></div>)}
      <div className="grid grid-cols-2 gap-1.5"><label className="text-[9px] text-slate-500">纵轴最大值<input type="number" min="1" value={data.maxY ?? 8000} onChange={(event) => updateData({ maxY: Math.max(1, Number(event.target.value) || 8000) })} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" /></label><label className="text-[9px] text-slate-500">纵轴分段<input type="number" min="1" max="12" value={data.ySteps ?? 4} onChange={(event) => updateData({ ySteps: Math.max(1, Math.min(12, Number(event.target.value) || 4)) })} className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" /></label></div>
    </div>;
  }

  const jsonArrayEditor = (key: string, label: string, fallback: unknown[]) => {
    const items = Array.isArray(data[key]) ? data[key] : fallback;
    return <div className="space-y-1.5 border-t border-white/10 pt-2">
      <label className="block text-[10px] font-medium text-cyan-200">{label}</label>
      <textarea
        value={JSON.stringify(items, null, 2)}
        onChange={(event) => {
          try { updateData({ [key]: JSON.parse(event.target.value) }); } catch { /* 保留正在编辑的非完整 JSON */ }
        }}
        rows={7}
        className="w-full resize-y rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] font-mono text-white outline-none focus:border-cyan-400"
        aria-label={label}
      />
    </div>;
  };

  if (type === 'data-trend-dual-area-chart') return jsonArrayEditor('dualData', '双曲线数据 JSON', [{ xLabel: '4.1', valueA: 35, valueB: 52, tag: 'A' }]);
  if (type === 'cyber-bubble-chart') return jsonArrayEditor('bubbles', '气泡数据 JSON', [{ value: 61, x: 44, y: 40, label: '61%' }]);
  if (type === 'cyber-ring-chart' || type === 'cyber-multi-ring-chart') return jsonArrayEditor('rings', '圆环数据 JSON', [{ value: 68, label: '68%' }]);
  if (type === 'cyber-radar-chart') return jsonArrayEditor('radarData', '雷达数据 JSON', [{ label: '维度一', valueA: 85, valueB: 65 }]);
  if (type === 'cyber-3d-donut-chart') return jsonArrayEditor('donutData', '3D 环形数据 JSON', [{ name: 'XXXXXX', value: 35 }]);
  if (type === 'distribution-stat-chart') return jsonArrayEditor('distributionData', '分布数据 JSON', [{ name: 'XXXXXX', value: 35 }]);
  if (type === 'pyramid-distribution-chart') return jsonArrayEditor('pyramidData', '金字塔分层数据 JSON', [{ name: 'XXXXXXXXX', value: 35, c1: '#5eead4', c2: '#2dd4bf', side: 'right' }]);

  if (type === 'stats-table' || type === 'alert-list') {
    const key = type === 'stats-table' ? 'rows' : 'items';
    const items = Array.isArray(data[key]) ? data[key] : [];
    const fallbackItem = type === 'stats-table' ? { label: '新项目', value: '0', status: 'normal' } : { label: '新告警', value: '刚刚', status: 'info' };
    return <div className="space-y-1.5 border-t border-white/10 pt-2"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-cyan-200">手动项目 {items.length}</span><button type="button" onClick={() => updateData({ [key]: [...items, fallbackItem] })} className="rounded bg-cyan-500/20 px-2 py-1 text-[10px] text-cyan-200">+ 增加项目</button></div>{items.map((item: any, index: number) => <div key={index} className="grid grid-cols-[1fr_72px_52px_24px] gap-1.5"><input value={item.label || ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, label: event.target.value }; updateData({ [key]: next }); }} className="min-w-0 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第${index + 1}项名称`} /><input value={item.value ?? ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, value: event.target.value }; updateData({ [key]: next }); }} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white" aria-label={`第${index + 1}项数值`} /><input value={item.status || ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, status: event.target.value }; updateData({ [key]: next }); }} className="rounded border border-white/10 bg-black/30 px-1 py-1 text-[10px] text-white" aria-label={`第${index + 1}项状态`} /><button type="button" onClick={() => updateData({ [key]: items.filter((_: unknown, itemIndex: number) => itemIndex !== index) })} className="rounded bg-rose-500/15 text-[10px] text-rose-200" aria-label={`删除第${index + 1}项`}>×</button></div>)}</div>;
  }

  if (type === 'geo-map' || type === 'topology') {
    return <div className="space-y-1.5 border-t border-white/10 pt-2"><div className="text-[10px] font-medium text-cyan-200">终端数据</div><div className="text-[9px] leading-4 text-slate-500">已按组件类型自动匹配定位或拓扑数据；需要接入特殊消息时，在下方高级设置中修改。</div></div>;
  }
  return null;
};

const SIMPLE_DATA_SOURCES = [
  { value: 'mock.telemetry', label: '模拟信号（预览）' },
  { value: 'mqtt.realtime', label: 'MQTT 网关（现场实时）' },
  { value: 'recorded.demo', label: '录制数据（回放）' },
  { value: 'none', label: '不接收数据' },
] as const;

const FRESHNESS_PRESETS = [
  { value: 'standard', label: '自动判断（5 秒提醒，15 秒离线）', warningAfterMs: 5000, offlineAfterMs: 15000 },
  { value: 'sensitive', label: '更敏感（2 秒提醒，8 秒离线）', warningAfterMs: 2000, offlineAfterMs: 8000 },
  { value: 'relaxed', label: '更宽松（10 秒提醒，30 秒离线）', warningAfterMs: 10000, offlineAfterMs: 30000 },
] as const;

const getPrimaryMapping = (type: string, plugin?: ReturnType<typeof getPluginById>) => {
  if (plugin?.telemetry?.value) return { field: 'value', path: plugin.telemetry.value, label: plugin.name };
  if (plugin?.telemetry?.series) return { field: 'series', path: plugin.telemetry.series, label: plugin.name };
  if (plugin?.telemetry?.rows) return { field: 'rows', path: plugin.telemetry.rows, label: plugin.name };
  if (plugin?.telemetry?.items) return { field: 'items', path: plugin.telemetry.items, label: plugin.name };
  if (plugin?.telemetry?.location) return { field: 'location', path: plugin.telemetry.location, label: '定位数据' };
  if (plugin?.telemetry?.topology) return { field: 'topology', path: plugin.telemetry.topology, label: '拓扑数据' };
  if (type === 'trend-line' || type === 'bar-chart' || type === 'pattern-prediction-chart') return { field: 'series', path: 'series', label: '趋势数据' };
  if (type === 'stats-table') return { field: 'rows', path: 'rows', label: '设备列表' };
  if (type === 'alert-list') return { field: 'items', path: 'items', label: '告警列表' };
  if (type === 'geo-map') return { field: 'location', path: 'location', label: '定位数据' };
  if (type === 'topology') return { field: 'topology', path: 'topology', label: '拓扑数据' };
  return { field: 'value', path: 'metrics.value', label: '当前数值' };
};

const SimpleDataBindingEditor: React.FC<{ element: SceneElement; onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void }> = ({ element, onUpdateElement }) => {
  const data = element.uiComponentData || {};
  const binding = data.dataBinding || {};
  const mapping = binding.mapping || {};
  const plugin = data.pluginId ? getPluginById(data.pluginId) : undefined;
  const primary = getPrimaryMapping(element.uiComponentType || '', plugin);
  const currentPrimaryPath = mapping[primary.field] || primary.path;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const updateBinding = (patch: Record<string, unknown>) => onUpdateElement(element.id, {
    uiComponentData: { ...data, dataBinding: { ...binding, ...patch } },
  });
  const updateMapping = (field: string, value: string) => updateBinding({
    mapping: { ...mapping, [field]: value || undefined },
  });
  const updateFreshness = (field: 'warningAfterMs' | 'offlineAfterMs', value: number) => updateBinding({
    freshness: { ...(binding.freshness || {}), [field]: Math.max(0, value) },
  });

  const mappingLabels: Record<string, string> = {
    value: '监测数值', label: '设备名称', unit: '单位', status: '状态', freshness: '新鲜度',
    series: '趋势数据', categories: '分类名称', rows: '设备列表', items: '告警列表',
    content: '设备详情', location: '定位数据', topology: '拓扑数据',
  };
  const advancedMappings = [
    { field: primary.field, path: primary.path },
    ...Object.entries(plugin?.telemetry || {}).map(([field, path]) => ({ field, path: String(path) })),
    ...(element.uiComponentType === 'bar-chart' || element.uiComponentType === 'trend-line' || element.uiComponentType === 'pattern-prediction-chart' ? [{ field: 'categories', path: 'categories' }] : []),
    { field: 'status', path: 'status' },
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.field === item.field) === index);

  const warningAfterMs = Number(binding.freshness?.warningAfterMs ?? 5000);
  const offlineAfterMs = Number(binding.freshness?.offlineAfterMs ?? 15000);
  const preset = FRESHNESS_PRESETS.find((item) => item.warningAfterMs === warningAfterMs && item.offlineAfterMs === offlineAfterMs);
  const isCustomMapping = currentPrimaryPath !== primary.path;

  return <div className="mt-3 border-t border-cyan-400/15 pt-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-semibold text-cyan-200">数据绑定</span>
      <span className="text-[9px] text-slate-500">不用填写字段路径</span>
    </div>
    <label className="block">
      <span className="mb-1 block text-[9px] text-slate-500">数据来源</span>
      <select value={binding.sourceId || 'mock.telemetry'} onChange={(event) => updateBinding({ sourceId: event.target.value, refresh: event.target.value === 'none' ? 'manual' : 'realtime' })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400" aria-label="选择数据来源">
        {SIMPLE_DATA_SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
      </select>
    </label>
    <label className="block">
      <span className="mb-1 block text-[9px] text-slate-500">监测项目</span>
      <select value={isCustomMapping ? 'custom' : primary.path} onChange={(event) => { if (event.target.value === 'custom') setAdvancedOpen(true); else updateMapping(primary.field, primary.path); }} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400" aria-label="选择监测项目">
        <option value={primary.path}>自动匹配：{primary.label}</option>
        <option value="custom">手动指定（高级设置）</option>
      </select>
    </label>
    <label className="block">
      <span className="mb-1 block text-[9px] text-slate-500">异常处理</span>
      <select value={preset?.value || 'custom'} onChange={(event) => { const next = FRESHNESS_PRESETS.find((item) => item.value === event.target.value); if (next) updateBinding({ freshness: { ...(binding.freshness || {}), warningAfterMs: next.warningAfterMs, offlineAfterMs: next.offlineAfterMs } }); else setAdvancedOpen(true); }} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400" aria-label="选择异常处理方式">
        {FRESHNESS_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        {!preset && <option value="custom">自定义（高级设置）</option>}
      </select>
    </label>
    <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className="flex w-full items-center justify-between rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-left text-[9px] text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200" aria-expanded={advancedOpen}>
      <span>高级数据设置</span><ChevronDown size={12} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
    </button>
    {advancedOpen && <div className="space-y-2 rounded border border-white/10 bg-black/20 p-2">
      <div className="text-[9px] leading-4 text-slate-500">专业用法：这里填写 MQTT 消息中的字段路径。普通使用无需修改。</div>
      <div className="space-y-1.5">{advancedMappings.map(({ field, path }) => <label key={field} className="block"><span className="mb-1 block text-[9px] text-slate-500">{mappingLabels[field] || field}字段路径</span><input value={mapping[field] || path} onChange={(event) => updateMapping(field, event.target.value)} className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white outline-none focus:border-cyan-400" placeholder={path} aria-label={`${mappingLabels[field] || field}字段路径`} /></label>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0"><span className="mb-1 block text-[9px] text-slate-500">提醒（秒）</span><input type="number" min="0" step="1" value={Math.round(warningAfterMs / 1000)} onChange={(event) => updateFreshness('warningAfterMs', Number(event.target.value || 0) * 1000)} className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white outline-none focus:border-cyan-400" aria-label="数据延迟提醒秒数" /></label>
        <label className="min-w-0"><span className="mb-1 block text-[9px] text-slate-500">离线（秒）</span><input type="number" min="0" step="1" value={Math.round(offlineAfterMs / 1000)} onChange={(event) => updateFreshness('offlineAfterMs', Number(event.target.value || 0) * 1000)} className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white outline-none focus:border-cyan-400" aria-label="数据延迟离线秒数" /></label>
      </div>
    </div>}
  </div>;
};

const KeyframeActions: React.FC<{
  element: SceneElement;
  property: KeyframeProperty;
  properties?: KeyframeProperty[];
  values?: Partial<Record<KeyframeProperty, number>>;
  value: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  onUpdateElement: (id: string, patch: Partial<SceneElement>, title?: string) => void;
  minimal?: boolean;
}> = ({ element, property, properties, values, value, currentTime, onSeek, onUpdateElement, minimal = false }) => {
  const groupedProperties = properties?.length ? properties : [property];
  const track = getPropertyTrack(element, property);
  const activeFrame = getKeyframeAt(track, currentTime);
  const activeFrames = groupedProperties.map((item) => getKeyframeAt(getPropertyTrack(element, item), currentTime));
  const active = activeFrames.some(Boolean);
  const allActive = activeFrames.every(Boolean);
  const [clipboardVersion, setClipboardVersion] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const canPaste = clipboardVersion >= 0 && hasKeyframeClipboard(property);
  const updateTracks = (nextTracks: ReturnType<typeof upsertKeyframe>) => onUpdateElement(element.id, { keyframes: nextTracks }, '编辑关键帧');
  const toggle = () => {
    let working = { ...element, keyframes: { tracks: element.keyframes?.tracks || [] } } as SceneElement;
    groupedProperties.forEach((item) => {
      const nextValue = item === property ? value : (values?.[item] ?? Number((element as any)[item] ?? 0));
      working = {
        ...working,
        keyframes: {
          tracks: allActive
            ? removeKeyframe(working, item, currentTime).tracks
            : upsertKeyframe(working, item, currentTime, nextValue).tracks,
        },
      };
    });
    updateTracks(working.keyframes);
  };
  const jump = (direction: -1 | 1) => {
    const target = getNeighborKeyframe(track, currentTime, direction);
    if (target) onSeek?.(target.time);
  };
  const paste = () => {
    const next = pasteKeyframe(element, property, currentTime);
    if (next) updateTracks(next);
  };
  const copy = () => {
    if (!activeFrame) return;
    copyKeyframe(activeFrame, property);
    setClipboardVersion((version) => version + 1);
  };
  return <div className="relative ml-auto flex shrink-0 items-center gap-0.5 text-slate-500" aria-label={`${groupedProperties.join('/')}关键帧控制`}>
    <button type="button" className={`grid h-5 w-5 place-items-center rounded transition-colors ${active ? 'text-sky-300' : 'hover:bg-white/10 hover:text-slate-200'}`} onClick={toggle} title={allActive ? '删除当前关键帧' : '添加关键帧'} aria-label={allActive ? '删除当前关键帧' : '添加关键帧'}><Diamond size={13} fill={active ? 'currentColor' : 'none'} strokeWidth={1.8} /></button>
    {!minimal && <button type="button" className="grid h-7 w-6 place-items-center rounded-md hover:bg-white/10 hover:text-white" onClick={() => setAdvancedOpen((open) => !open)} title="更多关键帧操作" aria-label="更多关键帧操作"><MoreHorizontal size={14} /></button>}
    {advancedOpen && <div className="absolute right-0 top-8 z-40 min-w-[150px] rounded-md border border-white/10 bg-[#1b1e27] p-1.5 shadow-xl">
      <div className="flex items-center gap-1 border-b border-white/10 pb-1.5">
        <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={() => jump(-1)} disabled={!getNeighborKeyframe(track, currentTime, -1)} title="上一关键帧"><ChevronLeft size={13} /></button>
        <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={() => jump(1)} disabled={!getNeighborKeyframe(track, currentTime, 1)} title="下一关键帧"><ChevronRight size={13} /></button>
        <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={copy} disabled={!activeFrame} title="复制当前关键帧"><Copy size={12} /></button>
        <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={paste} disabled={!canPaste} title="粘贴关键帧"><ClipboardPaste size={12} /></button>
      </div>
      <button type="button" className="mt-1 flex h-7 w-full items-center rounded px-2 text-left text-[10px] text-rose-300 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-30" onClick={() => onUpdateElement(element.id, { keyframes: clearAllKeyframes(element) }, '清空全部关键帧')} disabled={!element.keyframes?.tracks?.some((item) => item.keyframes.length > 0)} title="清空此图层的全部关键帧">清空全部关键帧</button>
      {activeFrame && <select
      value={activeFrame.easing || 'ease-in-out'}
      onChange={(event) => onUpdateElement(element.id, { keyframes: setKeyframeEasing(element, property, activeFrame.id, event.target.value as KeyframeEasing) }, '设置关键帧缓动')}
      className="mt-1 h-6 w-full rounded border border-white/10 bg-black/30 px-1 text-[10px] text-slate-300 outline-none"
      aria-label="关键帧缓动"
      title="关键帧缓动"
    >
      <option value="linear">线性</option>
      <option value="ease-in">缓入</option>
      <option value="ease-out">缓出</option>
      <option value="ease-in-out">缓入缓出</option>
      <option value="hold">保持</option>
    </select>}
    </div>}
  </div>;
};

const AnimatedNumericField: React.FC<{
  element: SceneElement;
  property: KeyframeProperty;
  label: string;
  value: number;
  currentTime: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  showKeyframe?: boolean;
  keyframeProperties?: KeyframeProperty[];
  keyframeValues?: Partial<Record<KeyframeProperty, number>>;
  onSeek?: (time: number) => void;
  onChange: (value: number) => void;
  onCommitChange?: (value: number) => void;
  onUpdateElement: (id: string, patch: Partial<SceneElement>, title?: string) => void;
}> = ({ element, property, label, value, currentTime, step = 1, min, max, unit = '', showKeyframe = true, keyframeProperties, keyframeValues, onSeek, onChange, onCommitChange, onUpdateElement }) => {
  const [draft, setDraft] = useState(() => String(Number.isFinite(value) ? value : 0));
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(Number.isFinite(value) ? value : 0));
  }, [value]);
  const keyframeControl = showKeyframe ? <KeyframeActions element={element} property={property} properties={keyframeProperties} values={keyframeValues} value={value} currentTime={currentTime} onSeek={onSeek} onUpdateElement={onUpdateElement} minimal /> : null;
  return (
  <div className="space-y-1.5" data-animated-property={property}>
    <div className="flex min-w-0 items-center gap-2">
      <label className="min-w-0 flex-1 text-[10px] text-slate-400">{label}</label>
      <div className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          onFocus={() => { focusedRef.current = true; }}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
          }}
          onBlur={() => {
            focusedRef.current = false;
            const next = Number.isFinite(Number(draft)) ? Number(draft) : value;
            setDraft(String(next));
            onChange(next);
            onCommitChange?.(next);
          }}
          className="h-6 w-[76px] rounded border border-white/10 bg-black/40 px-1.5 text-right text-[10px] font-mono text-white outline-none focus:border-sky-400"
          aria-label={`${label}数值`}
        />
        {unit && <span className="text-[9px] text-slate-500">{unit}</span>}
        {keyframeControl}
      </div>
    </div>
  </div>
  );
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  projectData,
  activeSceneId,
  selectedElementId,
  onUpdateProject,
  onUpdateElement,
  onDeleteElement,
  onSelectElement,
  onPreviewTransition,
  currentTime = 0,
  onSeek,
  onOpenDrawMode,
  onOpenMaskPenMode,
  onOpenBackgroundRemoval,
  onOpenCustomCodePlugin,
  selectedHotspot,
  onUpdateHotspot,
  onDeleteHotspot,
  onSelectHotspot,
  onUnmergeElement,
  width = 256,
}) => {
  // 被弹窗（popup）交互引用的场景 id：这类场景只作弹窗内容，不参与自动轮播/巡航
    const bgImageInputRef = useRef<HTMLInputElement>(null);
  const bgmAudioInputRef = useRef<HTMLInputElement>(null);
  const mediaReplaceInputRef = useRef<HTMLInputElement>(null);
  const hotspotMediaInputRef = useRef<HTMLInputElement>(null);
  const hotspotIconInputRef = useRef<HTMLInputElement>(null);
  const hotspotModelInputRef = useRef<HTMLInputElement>(null);

  // 区块折叠状态（key -> 是否折叠）。核心/常用区块默认展开，高级/次要区块默认折叠，
  // 避免属性面板过长需要反复滚动；点击区块标题可展开/折叠，面板头部可一键全部展开/折叠。
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ ...DEFAULT_COLLAPSED_SECTIONS });
  const [interactionComposerOpen, setInteractionComposerOpen] = useState(false);
  const [elementInspectorTab, setElementInspectorTab] = useState<ElementInspectorTab>(() => {
    try {
      const savedTab = window.localStorage.getItem(INSPECTOR_TAB_STORAGE_KEY);
      return isElementInspectorTab(savedTab) ? savedTab : 'base';
    } catch {
      return 'base';
    }
  });
  const [sceneInspectorTab, setSceneInspectorTab] = useState<SceneInspectorTab>('base');
  const collapsedSectionsRef = useRef(collapsedSections);
  const collapsedByInspectorRef = useRef<Record<string, Record<string, boolean>>>({});
  const inspectorScrollRef = useRef<HTMLElement | null>(null);
  const inspectorScrollByKeyRef = useRef<Record<string, number>>({});
  const inspectorKey = `${activeSceneId}:${selectedElementId || 'scene'}`;
  const previousInspectorKeyRef = useRef(inspectorKey);

  useEffect(() => {
    collapsedSectionsRef.current = collapsedSections;
  }, [collapsedSections]);

  // 每个图层/场景独立记忆属性面板的滚动位置和区块展开状态。
  useEffect(() => {
    const previousKey = previousInspectorKeyRef.current;
    const panel = inspectorScrollRef.current;
    if (panel && previousKey) {
      inspectorScrollByKeyRef.current[previousKey] = panel.scrollTop;
      collapsedByInspectorRef.current[previousKey] = { ...collapsedSectionsRef.current };
    }

    previousInspectorKeyRef.current = inspectorKey;
    const savedSections = collapsedByInspectorRef.current[inspectorKey];
    if (savedSections) {
      setCollapsedSections({ ...savedSections });
    } else {
      const defaults = { ...DEFAULT_COLLAPSED_SECTIONS };
      collapsedByInspectorRef.current[inspectorKey] = defaults;
      setCollapsedSections(defaults);
    }

    const savedScrollTop = inspectorScrollByKeyRef.current[inspectorKey] || 0;
    requestAnimationFrame(() => {
      if (inspectorScrollRef.current) inspectorScrollRef.current.scrollTop = savedScrollTop;
    });
  }, [inspectorKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(INSPECTOR_TAB_STORAGE_KEY, elementInspectorTab);
    } catch {
      // 存储不可用时保持编辑器正常工作，不影响面板状态。
    }
  }, [elementInspectorTab]);

  useEffect(() => {
    setSceneInspectorTab('base');
  }, [activeSceneId]);

  const handleInspectorScroll = (e: React.UIEvent<HTMLElement>) => {
    inspectorScrollByKeyRef.current[inspectorKey] = e.currentTarget.scrollTop;
  };
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const setAllSections = (collapsed: boolean) =>
    setCollapsedSections((prev) => {
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => { next[k] = collapsed; });
      return next;
    });

  const activeScene = projectData.scenes[activeSceneId] || Object.values(projectData.scenes)[0];
  const interactionConflicts = detectInteractionConflicts(activeScene);
  const updateActiveScene = (patch: Partial<Scene>) => {
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return { ...prev, scenes: { ...prev.scenes, [activeSceneId]: { ...scene, ...patch } } };
    }, '场景背景设置', 'scene_update');
  };
  // 工程级画布尺寸（默认 1920x1080 / 16:9）
  const canvasSpec = getProjectCanvas(projectData);
  // 自定义画布设置（宽高输入）
  const [customCanvasOpen, setCustomCanvasOpen] = useState(false);
  const [customW, setCustomW] = useState('1080');
  const [customH, setCustomH] = useState('1920');
  const selectedElement = activeScene?.els.find((e) => e.id === selectedElementId);
  const animatedValues = selectedElement ? evaluateElementProperties(selectedElement, currentTime) : null;
  const updateAnimatable = (property: KeyframeProperty, value: number, patch: Partial<SceneElement>, recordHistory = true) => {
    if (!selectedElement) return;
    const nextPatch = getPropertyTrack(selectedElement, property)
      ? { ...patch, keyframes: upsertKeyframe(selectedElement, property, currentTime, value) }
      : patch;
    onUpdateElement(selectedElement.id, nextPatch, undefined, recordHistory);
  };
  useEffect(() => {
    if (selectedElement?.interactionArea) setElementInspectorTab('interaction');
  }, [selectedElement?.id, selectedElement?.interactionArea]);
  const layerPlayback = selectedElement ? getLayerPlaybackConfig(selectedElement) : null;
  const customCodeTextLayer = Boolean(selectedElement?.type === 'custom-code' && selectedElement.customCode && hasCustomCodeTextLayer(selectedElement.customCode.html));
  const supportsTypography = selectedElement?.type === 'txt' || customCodeTextLayer;
  const popupConfigs = selectedElement?.linkType === 'popup' ? getPopups(selectedElement) : [];
  const popupEditor = popupConfigs.find((popup) => popup.id === (selectedElement?.popupActiveId || popupConfigs[0]?.id)) || popupConfigs[0];
  const updatePopupEditor = (patch: Partial<PopupConfig>) => {
    if (!selectedElement || !popupEditor) return;
    const next = popupConfigs.map((popup) => popup.id === popupEditor.id ? { ...popup, ...patch } : popup);
    onUpdateElement(selectedElement.id, { ...popupCollectionPatch(next), popupActiveId: popupEditor.id });
  };
  const updateAi3DControl = (
    surface: 'ai3dPreviewControls' | 'ai3dExportControls',
    kind: Ai3DControlKind,
    patch: Partial<NonNullable<SceneElement[typeof surface]>[Ai3DControlKind]>
  ) => {
    if (!selectedElement) return;
    const current = selectedElement[surface] || {};
    onUpdateElement(selectedElement.id, {
      [surface]: { ...current, [kind]: { ...current[kind], ...patch } },
    });
  };

  const renderAi3DActionControls = (kind: Ai3DControlKind, fallbackLabel: string, accent: 'cyan' | 'orange' | 'purple') => {
    if (!selectedElement) return null;
    const preview = selectedElement.ai3dPreviewControls?.[kind];
    const exported = selectedElement.ai3dExportControls?.[kind];
    const accentClass = accent === 'cyan'
      ? 'bg-cyan-500/20 text-cyan-200'
      : accent === 'orange'
        ? 'bg-orange-500/20 text-orange-200'
        : 'bg-purple-500/20 text-purple-200';
    return (
      <div className="mt-2 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1.5 space-y-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[9px] text-slate-500">{fallbackLabel}动作按钮</span>
          <select
            value={preview?.variant || selectedElement.ai3dControlVariant || 'glass'}
            onChange={(event) => {
              const variant = event.target.value as Ai3DControlVariant;
              updateAi3DControl('ai3dPreviewControls', kind, { variant });
              updateAi3DControl('ai3dExportControls', kind, { variant });
            }}
            className="rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[9px] text-slate-300"
            aria-label={`${fallbackLabel}按钮样式`}
          >
            <option value="glass">玻璃</option>
            <option value="solid">实色</option>
            <option value="outline">描边</option>
            <option value="minimal">极简</option>
          </select>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
          <input
            value={preview?.label || ''}
            onChange={(event) => updateAi3DControl('ai3dPreviewControls', kind, { label: event.target.value })}
            placeholder={fallbackLabel}
            maxLength={24}
            className="min-w-0 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-[9px] text-slate-200 placeholder:text-slate-600"
            aria-label={`${fallbackLabel}按钮名称`}
          />
          <button
            type="button"
            onClick={() => updateAi3DControl('ai3dPreviewControls', kind, { visible: preview?.visible === false })}
            aria-pressed={preview?.visible !== false}
            className={`rounded px-1.5 py-1 text-[9px] ${preview?.visible !== false ? accentClass : 'bg-white/5 text-slate-500'}`}
          >预览</button>
          <button
            type="button"
            onClick={() => updateAi3DControl('ai3dExportControls', kind, { visible: exported?.visible === false })}
            aria-pressed={exported?.visible !== false}
            className={`rounded px-1.5 py-1 text-[9px] ${exported?.visible !== false ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-500'}`}
          >导出</button>
        </div>
      </div>
    );
  };

  // 选中的热点对象查找
  const hotspotOwnerElement = selectedHotspot
    ? activeScene?.els.find((e) => e.id === selectedHotspot.elementId)
    : null;
  const selectedHotspotObj: Hotspot | null =
    selectedHotspot && hotspotOwnerElement && Array.isArray(hotspotOwnerElement.hotspots)
      ? hotspotOwnerElement.hotspots.find((h) => h.id === selectedHotspot.hotspotId) || null
      : null;

  // 图表数据文本（每行: 名称,数值）
  const [chartDataText, setChartDataText] = useState<string>('');
  useEffect(() => {
    const d = selectedElement?.chartData || [];
    setChartDataText(d.map((x) => `${x.label},${x.value}`).join('\n'));
  }, [selectedElementId]);

  const handleChartDataText = (text: string) => {
    setChartDataText(text);
    const rows = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = rows
      .map((row) => {
        const idx = row.lastIndexOf(',');
        const label = (idx >= 0 ? row.slice(0, idx) : row).trim();
        const val = parseFloat(idx >= 0 ? row.slice(idx + 1) : row);
        return Number.isFinite(val) ? { label: label || '项', value: val } : null;
      })
      .filter((x): x is { label: string; value: number } => x !== null);
    if (parsed.length) onUpdateElement(selectedElementId!, { chartData: parsed });
  };

  // Background Image Upload
  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blob = await processImageFile(file);
    const refKey = 'bg_' + Date.now();
    await dbManager.put(refKey, blob);
    onUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...activeScene,
          bgRef: refKey,
        },
      },
    }));
    e.target.value = '';
  };

  // Background Audio Upload
  const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const refKey = 'bgm_' + Date.now();
    await dbManager.put(refKey, file);
    onUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...activeScene,
          bgmRef: refKey,
        },
      },
    }));
    e.target.value = '';
  };

  // Media Replace
  const handleMediaReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElement) return;
    const refKey = 'res_' + Date.now();
    const isVideo = selectedElement.type === 'vid' || selectedElement.type === 'panorama-vid';
    const isPanorama = selectedElement.type === 'panorama-img' || selectedElement.type === 'panorama-vid';
    let mediaAspect: number | undefined;
    if (selectedElement.type === 'img' || selectedElement.type === 'panorama-img') {
      const blob = await processImageFile(file);
      await dbManager.put(refKey, blob);
      mediaAspect = await computeMediaAspect(blob, 'image');
    } else {
      await dbManager.put(refKey, file);
      if (isVideo) mediaAspect = await computeMediaAspect(file, 'video');
    }
    const size = !isPanorama && mediaAspect
      ? resizeBoundsWithAspect({
          width: selectedElement.w,
          height: selectedElement.h,
          editedDimension: 'width',
          aspectRatio: mediaAspect,
          canvasWidth: canvasSpec.width,
          canvasHeight: canvasSpec.height,
          minDimension: 1,
        })
      : null;
    onUpdateElement(selectedElement.id, {
      refId: refKey,
      sourceName: file.name,
      ...(mediaAspect ? { mediaAspect } : {}),
      ...(!isPanorama && mediaAspect ? { lockAspectRatio: true } : {}),
      ...(size ? {
        w: size.width,
        h: size.height,
        y: selectedElement.y + (selectedElement.h - size.height) / 2,
      } : {}),
    });
    e.target.value = '';
  };

  // ==================== 热点编辑面板（选中热点时独立渲染） ====================
  if (selectedHotspotObj && selectedHotspot) {
    const sceneEntries = Object.entries(projectData.scenes);
    const update = (patch: Partial<Hotspot>) =>
      onUpdateHotspot?.(selectedHotspot.elementId, selectedHotspot.hotspotId, patch);
    // Hotspot and ordinary layers share the same interaction representation.  Keep the
    // legacy fields in sync so projects made by older versions still behave identically.
    const interaction = resolveInteraction(selectedHotspotObj);
    const updateInteraction = (patch: Partial<InteractionConfig>) => {
      const next = { ...selectedHotspotObj.interaction, ...patch };
      const action = next.action ?? interaction.action;
      const trigger = next.trigger ?? interaction.trigger;
      const target = next.target ?? interaction.target;
      const url = next.url ?? interaction.url;
      const mediaRefId = next.mediaRefId ?? interaction.mediaRefId;
      const mediaType = next.mediaType ?? interaction.mediaType;
      const variableName = next.variableName ?? interaction.variableName;
      const variableValue = next.variableValue ?? interaction.variableValue;
      const hoverDelay = next.hoverDelay ?? interaction.hoverDelay;
      const linkType = action === 'jump' || action === 'popup' || action === 'url' || action === 'media'
        ? action
        : undefined;
      update({
        interaction: next,
        trigger,
        hoverDelay,
        linkType,
        link: target,
        linkUrl: url,
        mediaRefId,
        mediaType,
        variableName,
        variableValue,
      });
    };

    const handleHotspotMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const refKey = 'res_' + Date.now();
      const isVid = file.type.startsWith('video');
      if (isVid) {
        await dbManager.put(refKey, file);
      } else {
        const blob = await processImageFile(file);
        await dbManager.put(refKey, blob);
      }
      updateInteraction({ action: 'media', mediaRefId: refKey, mediaType: isVid ? 'video' : 'image' });
      e.target.value = '';
    };

    // 热点自定义图标上传（图片/视频）
    const handleHotspotIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const refKey = 'icon_' + Date.now();
      const isVid = file.type.startsWith('video');
      if (isVid) {
        await dbManager.put(refKey, file);
        update({ iconType: 'video', iconVideoRefId: refKey, iconImageRefId: undefined });
      } else {
        const blob = await processImageFile(file);
        await dbManager.put(refKey, blob);
        update({ iconType: 'image', iconImageRefId: refKey, iconVideoRefId: undefined });
      }
      e.target.value = '';
    };

    const handleHotspotModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const refKey = 'asset_hotspot_model_' + Date.now();
      await dbManager.put(refKey, file);
      update({ iconType: 'model', iconModelRefId: refKey, iconModelElementId: undefined });
      e.target.value = '';
    };

    return (
      <aside style={{ width }} className="bg-[#12141c] border-l border-white/10 flex flex-col h-full select-none text-xs text-slate-300 overflow-y-auto min-w-0">
        <input
          type="file"
          ref={hotspotMediaInputRef}
          className="hidden"
          accept="image/*,video/*"
          onChange={handleHotspotMediaUpload}
        />
        <input
          type="file"
          ref={hotspotIconInputRef}
          className="hidden"
          accept="image/*,video/*"
          onChange={handleHotspotIconUpload}
        />
        <input
          type="file"
          ref={hotspotModelInputRef}
          className="hidden"
          accept=".glb,.gltf,.obj,.fbx,.stl,.3mf,.dae,.ply,model/gltf-binary,model/gltf+json"
          onChange={handleHotspotModelUpload}
        />

        {/* Header */}
        <div className="h-10 bg-[#0f1117] border-b border-white/10 flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-amber-400" />
            <span className="font-bold text-slate-200 uppercase tracking-wider">热点属性 (HOTSPOT)</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectHotspot?.(selectedHotspot.elementId, null)}
            className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
          >
            完成
          </button>
        </div>

        <div className="p-3 space-y-4">
          {/* 外观 */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">外观</span>

            {/* 图标类型 */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">图标类型</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { v: 'preset', label: '预设图标' },
                  { v: 'image', label: '自定义图片' },
                  { v: 'video', label: '自定义视频' },
                  { v: 'model', label: '3D 模型' },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => {
                      if (opt.v === 'preset') {
                        update({ iconType: 'preset', iconImageRefId: undefined, iconVideoRefId: undefined, iconModelRefId: undefined, iconModelElementId: undefined });
                      } else {
                        update({ iconType: opt.v, ...(opt.v === 'model' ? {} : { iconModelRefId: undefined, iconModelElementId: undefined }) });
                      }
                    }}
                    className={`py-1.5 rounded-lg border text-[10px] transition-colors ${
                      (selectedHotspotObj.iconType || 'preset') === opt.v
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 预设图标选择（iconType=preset 时显示） */}
            {selectedHotspotObj.iconType === 'model' && (
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400 mb-1">3D 模型来源</label>
                <button type="button" onClick={() => hotspotModelInputRef.current?.click()} className="w-full px-3 py-2 bg-sky-500/15 border border-sky-500/30 rounded-lg text-[11px] text-sky-300 hover:bg-sky-500/25 transition-colors flex items-center justify-center gap-1.5">
                  <Upload size={12} />
                  {selectedHotspotObj.iconModelRefId ? '更换上传模型' : '上传 GLB / GLTF 模型'}
                </button>
                <select value={selectedHotspotObj.iconModelElementId || ''} onChange={(e) => update({ iconModelElementId: e.target.value || undefined, iconModelRefId: e.target.value ? undefined : selectedHotspotObj.iconModelRefId })} className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none">
                  <option value="">选择工程内模型（含 AI 生成模型）</option>
                  {(activeScene?.els || []).filter((el) => el.type === 'model-3d').map((el) => <option key={el.id} value={el.id}>{el.sourceName || el.id}</option>)}
                </select>
                {(selectedHotspotObj.iconModelRefId || selectedHotspotObj.iconModelElementId) && <div className="flex items-center gap-1.5 text-[10px] text-emerald-400"><Check size={11} />{selectedHotspotObj.iconModelElementId ? '已关联工程模型' : '已上传 3D 模型'}</div>}
              </div>
            )}

            {(selectedHotspotObj.iconType === 'preset' || !selectedHotspotObj.iconType) && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">图标样式</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: 'dot', label: '圆点', icon: <Circle size={14} /> },
                    { v: 'plus', label: '+号', icon: <Plus size={14} /> },
                    { v: 'arrow', label: '箭头', icon: <ArrowRight size={14} /> },
                    { v: 'info', label: '信息', icon: <Info size={14} /> },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => update({ icon: opt.v })}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] transition-colors ${
                        (selectedHotspotObj.icon || 'dot') === opt.v
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                          : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 自定义图标上传（iconType=image/video 时显示） */}
            {(selectedHotspotObj.iconType === 'image' || selectedHotspotObj.iconType === 'video') && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => hotspotIconInputRef.current?.click()}
                  className="w-full px-3 py-2 bg-sky-500/15 border border-sky-500/30 rounded-lg text-[11px] text-sky-300 hover:bg-sky-500/25 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Upload size={12} />
                  {selectedHotspotObj.iconType === 'image'
                    ? (selectedHotspotObj.iconImageRefId ? '更换图片' : '上传图片')
                    : (selectedHotspotObj.iconVideoRefId ? '更换视频' : '上传视频')}
                </button>
                {(selectedHotspotObj.iconType === 'image' && selectedHotspotObj.iconImageRefId) ||
                (selectedHotspotObj.iconType === 'video' && selectedHotspotObj.iconVideoRefId) ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <Check size={11} />
                    已关联{selectedHotspotObj.iconType === 'video' ? '视频' : '图片'}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">请上传{selectedHotspotObj.iconType === 'video' ? '视频' : '图片'}文件</div>
                )}
              </div>
            )}

            {/* 预设图标颜色/大小（iconType=preset 时显示） */}
            {(selectedHotspotObj.iconType === 'preset' || !selectedHotspotObj.iconType) && (
              <>
                {/* 颜色 */}
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-400">颜色</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedHotspotObj.color || '#38bdf8'}
                      onChange={(e) => update({ color: e.target.value })}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                    <input
                      type="text"
                      value={selectedHotspotObj.color || '#38bdf8'}
                      onChange={(e) => update({ color: e.target.value })}
                      className="w-20 px-2 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] font-mono text-slate-300"
                    />
                  </div>
                </div>

                {/* 大小 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">大小</label>
                    <span className="text-[11px] font-mono text-slate-500">{selectedHotspotObj.size || 28}px</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={64}
                    value={selectedHotspotObj.size || 28}
                    onChange={(e) => update({ size: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>
              </>
            )}

            {/* 自定义图标样式（iconType=image/video 时显示） */}
            {(selectedHotspotObj.iconType === 'image' || selectedHotspotObj.iconType === 'video') && (
              <>
                {/* 宽度 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">宽度</label>
                    <span className="text-[11px] font-mono text-slate-500">{selectedHotspotObj.iconWidth || 56}px</span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={200}
                    value={selectedHotspotObj.iconWidth || 56}
                    onChange={(e) => update({ iconWidth: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* 高度 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">高度</label>
                    <span className="text-[11px] font-mono text-slate-500">{selectedHotspotObj.iconHeight || 56}px</span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={200}
                    value={selectedHotspotObj.iconHeight || 56}
                    onChange={(e) => update({ iconHeight: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* 形状 */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">形状</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: 'rounded', label: '圆角' },
                      { v: 'circle', label: '圆形' },
                      { v: 'square', label: '方形' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => update({ iconShape: opt.v })}
                        className={`py-1.5 rounded-lg border text-[10px] transition-colors ${
                          (selectedHotspotObj.iconShape || 'rounded') === opt.v
                            ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 圆角（仅 rounded 形状） */}
                {selectedHotspotObj.iconShape === 'rounded' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400">圆角半径</label>
                      <span className="text-[11px] font-mono text-slate-500">{selectedHotspotObj.iconBorderRadius || 8}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={selectedHotspotObj.iconBorderRadius || 8}
                      onChange={(e) => update({ iconBorderRadius: Number(e.target.value) })}
                      className="w-full accent-sky-500"
                    />
                  </div>
                )}

                {/* 透明度 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400">透明度</label>
                    <span className="text-[11px] font-mono text-slate-500">{Math.round((selectedHotspotObj.iconOpacity ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={Math.round((selectedHotspotObj.iconOpacity ?? 1) * 100)}
                    onChange={(e) => update({ iconOpacity: Number(e.target.value) / 100 })}
                    className="w-full accent-sky-500"
                  />
                </div>

                {/* 视频图标选项（仅 video 类型） */}
                {selectedHotspotObj.iconType === 'video' && (
                  <div className="space-y-1.5 p-2 rounded-lg bg-white/[0.03] border border-white/10">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">视频播放</span>
                    <label className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>自动播放</span>
                      <input
                        type="checkbox"
                        checked={selectedHotspotObj.iconAutoPlay !== false}
                        onChange={(e) => update({ iconAutoPlay: e.target.checked })}
                        className="accent-sky-500"
                      />
                    </label>
                    <label className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>循环播放</span>
                      <input
                        type="checkbox"
                        checked={selectedHotspotObj.iconLoop !== false}
                        onChange={(e) => update({ iconLoop: e.target.checked })}
                        className="accent-sky-500"
                      />
                    </label>
                    <label className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>静音</span>
                      <input
                        type="checkbox"
                        checked={selectedHotspotObj.iconMuted !== false}
                        onChange={(e) => update({ iconMuted: e.target.checked })}
                        className="accent-sky-500"
                      />
                    </label>
                  </div>
                )}
              </>
            )}

            {/* Label */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">标签文字（悬停显示）</label>
              <input
                type="text"
                value={selectedHotspotObj.label || ''}
                onChange={(e) => update({ label: e.target.value })}
                placeholder="如：客厅 → 卧室"
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* 交互行为 */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">交互行为</span>

            {/* 与普通图层保持一致：点击或悬停触发 */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">触发方式</label>
              <select
                value={interaction.trigger}
                onChange={(e) => updateInteraction({ trigger: e.target.value as InteractionConfig['trigger'] })}
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
              >
                {INTERACTION_TRIGGER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            {interaction.trigger === 'hover' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  悬停延迟：{(interaction.hoverDelay * 1000).toFixed(0)}ms
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={interaction.hoverDelay}
                  onChange={(e) => updateInteraction({ hoverDelay: Number(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </div>
            )}
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-cyan-100">多动作编排</div>
                  <div className="mt-0.5 text-[9px] text-slate-400">改数据、切组件状态、跳转可以串成一套流程</div>
                </div>
                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                  {(interaction.steps?.length || 0)} 步
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInteractionComposerOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-400/10 py-1.5 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
              >
                <GitBranch size={11} />
                {interaction.steps?.length ? '编辑动作流程' : '打开动作编排'}
              </button>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">悬停效果</label>
              <select
                value={selectedHotspotObj.hoverEffect || 'none'}
                onChange={(e) => update({ hoverEffect: e.target.value as Hotspot['hoverEffect'] })}
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
              >
                <option value="none">无</option>
                <option value="glow">发光</option>
                <option value="outline">描边</option>
                <option value="scale">放大</option>
                <option value="float">浮动</option>
                <option value="brighten">增亮</option>
              </select>
            </div>

            {/* 链接类型 */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">响应动作</label>
              <select
                value={interaction.action}
                onChange={(e) => updateInteraction({ action: e.target.value as InteractionConfig['action'] })}
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
              >
                <option value="jump">跳转场景</option>
                <option value="popup">弹窗场景</option>
                <option value="url">打开 URL</option>
                <option value="media">媒体弹窗（图片/视频）</option>
                <option value="set-variable">修改变量</option>
                <option value="none">无响应</option>
              </select>
            </div>

            {/* 目标场景 */}
            {(interaction.action === 'jump' || interaction.action === 'popup') && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {interaction.action === 'popup' ? '弹窗场景' : '目标场景'}
                </label>
                <select
                  value={interaction.target || ''}
                  onChange={(e) => updateInteraction({ target: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                >
                  <option value="">-- 选择场景 --</option>
                  {sceneEntries.map(([id, sc]) => (
                    <option key={id} value={id}>
                      {sc.alias || id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* URL */}
            {interaction.action === 'url' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">URL 地址</label>
                <input
                  type="text"
                  value={interaction.url || ''}
                  onChange={(e) => updateInteraction({ url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            )}

            {/* 媒体上传 */}
            {interaction.action === 'media' && (
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400">关联媒体文件</label>
                <button
                  type="button"
                  onClick={() => hotspotMediaInputRef.current?.click()}
                  className="w-full px-3 py-2 bg-sky-500/15 border border-sky-500/30 rounded-lg text-[11px] text-sky-300 hover:bg-sky-500/25 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Upload size={12} />
                  {interaction.mediaRefId ? '更换媒体文件' : '上传图片/视频'}
                </button>
                {interaction.mediaRefId && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <Check size={11} />
                    已关联 {interaction.mediaType === 'video' ? '视频' : '图片'}（{interaction.mediaRefId.slice(0, 12)}…）
                  </div>
                )}
              </div>
            )}

            {interaction.action === 'set-variable' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">变量名</label>
                  <input
                    type="text"
                    value={interaction.variableName || ''}
                    onChange={(e) => updateInteraction({ variableName: e.target.value })}
                    placeholder="例如：用户类型"
                    className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">变量值</label>
                  <input
                    type="text"
                    value={String(interaction.variableValue ?? '')}
                    onChange={(e) => updateInteraction({ variableValue: e.target.value })}
                    placeholder="输入要写入的值"
                    className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* 【新增】呈现动画效果 */}
            {(interaction.action === 'popup' || interaction.action === 'media') && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <label className="block text-[11px] text-slate-400 mb-1">弹窗自定义标题（可选）</label>
                <input
                  type="text"
                  maxLength={200}
                  value={selectedHotspotObj.popupTitle || ''}
                  onChange={(e) => update({ popupTitle: e.target.value })}
                  placeholder="留空则不显示标题"
                  className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
                />
              </div>
            )}

            {(interaction.action === 'popup' || interaction.action === 'media') && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">呈现动画</span>

                {/* 动画类型 */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">入场动画</label>
                  <select
                    value={selectedHotspotObj.popupAnimationType || selectedHotspotObj.animationType || 'fadeIn'}
                    onChange={(e) => update({ animationType: e.target.value as Hotspot['animationType'], popupAnimationType: e.target.value as Hotspot['popupAnimationType'] })}
                    className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                  >
                    <option value="none">无动画</option>
                    <option value="fadeIn">淡入</option>
                    <option value="slideUp">上浮</option>
                    <option value="slideDown">下落</option>
                    <option value="slideLeft">左滑</option>
                    <option value="slideRight">右滑</option>
                    <option value="zoomIn">放大</option>
                    <option value="zoomOut">缩小</option>
                    <option value="bounce">弹性</option>
                    <option value="rotate">旋转</option>
                  </select>
                </div>

                {/* 动画时长 */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    动画时长: {selectedHotspotObj.popupAnimationDuration || selectedHotspotObj.animationDuration || 300}ms
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={selectedHotspotObj.popupAnimationDuration || selectedHotspotObj.animationDuration || 300}
                    onChange={(e) => {
                      const duration = parseInt(e.target.value);
                      update({ animationDuration: duration, popupAnimationDuration: duration });
                    }}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
              </div>
            )}

            {/* 【新增】弹窗位置与大小控制 */}
            {(interaction.action === 'popup' || interaction.action === 'media') && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">弹窗位置与大小</span>

                {/* 弹窗位置 */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">弹窗位置</label>
                  <select
                    value={selectedHotspotObj.popupPosition || 'center'}
                    onChange={(e) => update({ popupPosition: e.target.value as Hotspot['popupPosition'] })}
                    className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                  >
                    <option value="center">居中</option>
                    <option value="top-left">左上角</option>
                    <option value="top-right">右上角</option>
                    <option value="bottom-left">左下角</option>
                    <option value="bottom-right">右下角</option>
                    <option value="custom">自定义位置</option>
                  </select>
                </div>

                {/* 自定义位置 */}
                {selectedHotspotObj.popupPosition === 'custom' && (
                  <div className="space-y-2">
                    {/* 九宫格快速定位 */}
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">快速定位（点击格子）</label>
                      <div className="grid grid-cols-3 gap-1 p-1.5 bg-white/[0.03] rounded-lg border border-white/10">
                        {[
                          { x: 8, y: 8, label: '↖' },
                          { x: 50, y: 8, label: '↑' },
                          { x: 92, y: 8, label: '↗' },
                          { x: 8, y: 50, label: '←' },
                          { x: 50, y: 50, label: '●' },
                          { x: 92, y: 50, label: '→' },
                          { x: 8, y: 92, label: '↙' },
                          { x: 50, y: 92, label: '↓' },
                          { x: 92, y: 92, label: '↘' },
                        ].map((pos, i) => {
                          const isActive = Math.abs((selectedHotspotObj.popupX ?? 50) - pos.x) < 5 && Math.abs((selectedHotspotObj.popupY ?? 50) - pos.y) < 5;
                          return (
                            <button
                              key={i}
                              onClick={() => update({ popupX: pos.x, popupY: pos.y })}
                              className={`aspect-square rounded text-[13px] font-bold transition-all ${
                                isActive
                                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                                  : 'bg-white/[0.04] text-slate-400 hover:bg-sky-500/20 hover:text-sky-300'
                              }`}
                            >
                              {pos.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* 精确数字输入 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">X位置 (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedHotspotObj.popupX ?? 50}
                          onChange={(e) => update({ popupX: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Y位置 (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedHotspotObj.popupY ?? 50}
                          onChange={(e) => update({ popupY: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-600 leading-tight">💡 也可在画布上直接拖拽弹窗预览框调整位置</p>
                  </div>
                )}

                {/* 弹窗大小 */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">弹窗大小</label>
                  <select
                    value={selectedHotspotObj.popupSize || 'medium'}
                    onChange={(e) => update({ popupSize: e.target.value as Hotspot['popupSize'] })}
                    className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                  >
                    <option value="small">小 (40%)</option>
                    <option value="medium">中 (60%)</option>
                    <option value="large">大 (80%)</option>
                    <option value="custom">自定义大小</option>
                  </select>
                </div>

                {/* 自定义大小 */}
                {selectedHotspotObj.popupSize === 'custom' && (
                  <div className="space-y-2">
                    {/* 尺寸快速预设 */}
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">常用尺寸</label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { w: 40, h: 50, label: '小' },
                          { w: 60, h: 70, label: '中' },
                          { w: 80, h: 80, label: '大' },
                          { w: 95, h: 90, label: '全屏' },
                          { w: 70, h: 39, label: '16:9' },
                          { w: 60, h: 45, label: '4:3' },
                          { w: 50, h: 50, label: '1:1' },
                          { w: 35, h: 62, label: '9:16' },
                        ].map((size, i) => {
                          const isActive = Math.abs((selectedHotspotObj.popupWidth ?? 60) - size.w) < 2 && Math.abs((selectedHotspotObj.popupHeight ?? 60) - size.h) < 2;
                          return (
                            <button
                              key={i}
                              onClick={() => update({ popupWidth: size.w, popupHeight: size.h })}
                              className={`py-1.5 rounded text-[10px] font-bold transition-all ${
                                isActive
                                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                                  : 'bg-white/[0.04] text-slate-400 hover:bg-sky-500/20 hover:text-sky-300'
                              }`}
                            >
                              {size.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* 精确数字输入 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">宽度 (%)</label>
                        <input
                          type="number"
                          min="10"
                          max="100"
                          value={selectedHotspotObj.popupWidth ?? 60}
                          onChange={(e) => update({ popupWidth: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">高度 (%)</label>
                        <input
                          type="number"
                          min="10"
                          max="100"
                          value={selectedHotspotObj.popupHeight ?? 60}
                          onChange={(e) => update({ popupHeight: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-600 leading-tight">💡 也可在画布上拖拽弹窗预览框的边角手柄调整大小</p>
                  </div>
                )}

                {/* 遮罩设置 */}
                <div className="space-y-1.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-400">遮罩透明度</span>
                      <span className="text-[10px] font-mono text-slate-500">{Math.round((selectedHotspotObj.popupOverlayOpacity ?? 0.8) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round((selectedHotspotObj.popupOverlayOpacity ?? 0.8) * 100)}
                      onChange={(e) => update({ popupOverlayOpacity: Number(e.target.value) / 100 })}
                      className="w-full accent-sky-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-slate-400">遮罩模糊</span>
                      <span className="text-[10px] font-mono text-slate-500">{selectedHotspotObj.popupOverlayBlur ?? 24}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="48"
                      value={selectedHotspotObj.popupOverlayBlur ?? 24}
                      onChange={(e) => update({ popupOverlayBlur: Number(e.target.value) })}
                      className="w-full accent-sky-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">点击遮罩关闭</span>
                    <button
                      type="button"
                      onClick={() => update({ popupCloseOnOverlay: !(selectedHotspotObj.popupCloseOnOverlay ?? true) })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        (selectedHotspotObj.popupCloseOnOverlay ?? true) ? 'bg-sky-500' : 'bg-white/20'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        (selectedHotspotObj.popupCloseOnOverlay ?? true) ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <div className="pt-1.5 border-t border-white/10 space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">弹窗呈现方式</label>
                      <select value={selectedHotspotObj.popupDisplay || 'modal'} onChange={(e) => update({ popupDisplay: e.target.value as Hotspot['popupDisplay'] })} className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none">
                        <option value="modal">模态窗 (Modal)</option>
                        <option value="popover">浮层卡片 (Popover)</option>
                        <option value="inline">原地展开 (Inline)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">弹窗主题</label>
                      <select value={normalizePopupTheme(selectedHotspotObj.popupTheme)} onChange={(e) => update({ popupTheme: e.target.value as Hotspot['popupTheme'] })} className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded text-[11px] text-slate-300 focus:border-sky-500/50 focus:outline-none">
                        <option value="default">默认</option>
                        <option value="immersive">沉浸 (Immersive)</option>
                        <option value="neon">霓虹 (Neon)</option>
                        <option value="cyberpunk">赛博朋克</option>
                        <option value="glass">玻璃 (Glass)</option>
                        <option value="hologram">全息 (Hologram)</option>
                        <option value="luxury">奢华</option>
                        <option value="minimal">极简</option>
                        <option value="corporate">企业</option>
                        
                        
                        
                        
                        
                        
                        
                        
                        
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">弹窗比例</label>
                      <div className="grid grid-cols-6 gap-1">
                        {(['free', '16:9', '4:3', '1:1', '9:16', 'custom'] as const).map((ratio) => (
                          <button type="button" key={ratio} onClick={() => update(getPopupRatioPatch(selectedHotspotObj, ratio, canvasSpec.width / canvasSpec.height) as Partial<Hotspot>)} className={`py-1 rounded text-[10px] font-bold ${(selectedHotspotObj.popupRatio || '16:9') === ratio ? 'bg-sky-500 text-white' : 'bg-white/[0.04] text-slate-400 hover:bg-sky-500/20'}`}>
                            {ratio === 'free' ? '自由' : ratio === 'custom' ? '自定义' : ratio}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedHotspotObj.popupRatio === 'custom' && (
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={30} value={selectedHotspotObj.popupRatioW ?? 16} onChange={(e) => update({ popupRatioW: Math.max(1, Math.min(30, Number(e.target.value) || 16)) })} className="w-14 px-1.5 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] text-center text-slate-300" />
                        <span className="text-slate-500">:</span>
                        <input type="number" min={1} max={30} value={selectedHotspotObj.popupRatioH ?? 9} onChange={(e) => update({ popupRatioH: Math.max(1, Math.min(30, Number(e.target.value) || 9)) })} className="w-14 px-1.5 py-1 bg-white/[0.04] border border-white/10 rounded text-[11px] text-center text-slate-300" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['popupBgColor', '背景颜色', '#111420'],
                        ['popupBorderColor', '边框颜色', '#ffffff'],
                        ['popupGlowColor', '发光颜色', '#38bdf8'],
                        ['popupTitleColor', '标题颜色', '#ffffff'],
                        ['popupAccentColor', '强调色', '#38bdf8'],
                      ] as const).map(([key, label, fallback]) => (
                        <label key={key} className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                          <span>{label}</span>
                          <input type="color" value={(selectedHotspotObj[key] || fallback) as string} onChange={(e) => update({ [key]: e.target.value } as Partial<Hotspot>)} className="w-7 h-6 rounded bg-transparent border border-white/10 cursor-pointer" />
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">圆角 {selectedHotspotObj.popupRadius ?? 16}px</label>
                      <input type="range" min="0" max="40" step="2" value={selectedHotspotObj.popupRadius ?? 16} onChange={(e) => update({ popupRadius: Number(e.target.value) })} className="w-full accent-sky-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 位置信息（只读） */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">3D 位置（拖动热点可修改）</span>
            <div className="text-[10px] font-mono text-slate-500">
              {selectedHotspotObj.position.coordType === 'spherical' ? (
                <>θ={selectedHotspotObj.position.theta.toFixed(1)}° φ={selectedHotspotObj.position.phi.toFixed(1)}°</>
              ) : (
                <>x={selectedHotspotObj.position.x?.toFixed(2)} y={selectedHotspotObj.position.y?.toFixed(2)} z={selectedHotspotObj.position.z?.toFixed(2)}</>
              )}
            </div>
          </div>

          {/* 删除 */}
          <button
            type="button"
            onClick={() => {
              onDeleteHotspot?.(selectedHotspot.elementId, selectedHotspot.hotspotId);
            }}
            className="w-full px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-[11px] text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 size={12} />
            删除此热点
          </button>
        </div>
        <InteractionComposerModal
          isOpen={interactionComposerOpen}
          onClose={() => setInteractionComposerOpen(false)}
          steps={selectedHotspotObj.interaction?.steps || []}
          scenes={projectData.scenes}
          variables={projectData.variables}
          components={projectData.components}
          elements={activeScene?.els || []}
          onSave={(steps) => updateInteraction({ steps })}
        />
      </aside>
    );
  }

  return (
    <>
    <aside
      ref={inspectorScrollRef}
      onScroll={handleInspectorScroll}
      style={{ width }}
      className="bg-[#12141c] border-l border-white/10 flex flex-col h-full select-none text-xs text-slate-300 overflow-x-hidden overflow-y-auto min-w-0 pb-16"
    >
      {/* Hidden file pickers */}
      <input
        type="file"
        ref={bgImageInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleBgImageUpload}
      />
      <input
        type="file"
        ref={bgmAudioInputRef}
        className="hidden"
        accept="audio/*"
        onChange={handleBgmUpload}
      />
      <input
        type="file"
        ref={mediaReplaceInputRef}
        className="hidden"
        accept={(selectedElement?.type === 'vid' || selectedElement?.type === 'panorama-vid') ? 'video/*' : 'image/*'}
        onChange={handleMediaReplace}
      />

      {/* Header Tabs: Scene Properties vs Element Properties */}
      <div className="h-10 bg-[#0f1117] border-b border-white/10 flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders size={13} className="text-sky-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            {selectedElement ? '图层属性 (ELEMENT)' : '场景设置 (SCENE)'}
          </span>
        </div>

        {selectedElement && (
          <button
            type="button"
            onClick={() => onSelectElement(null)}
            className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
          >
            切换为场景设置
          </button>
        )}
        {/* 全部展开 / 全部折叠 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setAllSections(false)}
            title="展开所有区块"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-slate-200"
          >
            <ChevronDown size={13} className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => setAllSections(true)}
            title="折叠所有区块"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-slate-200"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>
      {interactionConflicts.length > 0 && (
        <div className="mx-2 mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[10px] text-amber-200" role="status">
          <div className="font-semibold">交互冲突 {interactionConflicts.length} 项</div>
          <div className="mt-0.5 text-amber-100/80">{interactionConflicts[0].message}</div>
        </div>
      )}

      <div className="p-2.5 pb-20 space-y-3">
        {/* ================= IF NO ELEMENT SELECTED: SCENE INSPECTOR ================= */}
        {!selectedElement && (
          <div className="space-y-4">
            <div role="tablist" aria-label="场景设置分类" className="sticky top-0 z-20 -mx-2.5 grid grid-cols-5 border-y border-white/10 bg-[#12141c] px-1 shadow-lg shadow-black/10">
              {([
                { id: 'base', label: '基础', icon: Move },
                { id: 'appearance', label: '外观', icon: Palette },
                { id: 'transition', label: '动效', icon: Sparkles },
                { id: 'interaction', label: '交互', icon: MousePointer },
                { id: 'data', label: '数据', icon: DatabaseIcon },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={sceneInspectorTab === id} onClick={() => setSceneInspectorTab(id)} className={`relative flex min-h-9 min-w-0 items-center justify-center gap-0.5 px-0.5 text-[9px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${sceneInspectorTab === id ? 'text-sky-300' : 'text-slate-500 hover:text-slate-200'}`}>
                  <Icon size={11} /><span className="truncate">{label}</span>
                  {sceneInspectorTab === id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-sky-400" />}
                </button>
              ))}
            </div>
            <InspectorGuide>{SCENE_INSPECTOR_GUIDANCE[sceneInspectorTab]}</InspectorGuide>
            {/* Scene Basic Info */}
            <div className={`space-y-2 ${sceneInspectorTab === 'base' ? '' : 'hidden'}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><Info size={12} className="text-sky-400" />场景基本信息</span>
                <span className="text-[10px] font-mono text-slate-500">ID: {activeScene.id}</span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">场景名称</label>
                <input
                  type="text"
                  value={activeScene.alias || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateProject((prev) => ({
                      ...prev,
                      scenes: {
                        ...prev.scenes,
                        [activeSceneId]: { ...activeScene, alias: val },
                      },
                    }));
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">总时长 (秒)</label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    step="0.5"
                    value={activeScene.duration}
                    onChange={(e) => {
                      const val = Math.max(1, parseFloat(e.target.value) || 10);
                      onUpdateProject((prev) => ({
                        ...prev,
                        scenes: {
                          ...prev.scenes,
                          [activeSceneId]: { ...activeScene, duration: val },
                        },
                      }));
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">单场景停留时长 (秒)</label>
                  <input
                    type="number"
                    min="0"
                    max="600"
                    step="0.5"
                    value={activeScene.cruiseDuration || 0}
                    placeholder="0=跟随总时长"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateProject((prev) => ({
                        ...prev,
                        scenes: {
                          ...prev.scenes,
                          [activeSceneId]: { ...activeScene, cruiseDuration: val },
                        },
                      }));
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div className="bg-sky-950/30 border border-sky-500/20 rounded-md px-2 py-1.5">
                  <label className="block text-[11px] text-slate-400 mb-1">全局轮播间隔 (秒)</label>
                  <input
                    type="number"
                    min="1"
                    max="3600"
                    step="0.5"
                    value={activeScene.autoAdvanceDelay || 0}
                    placeholder="0=跟随巡航/总时长"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateProject((prev) => ({
                        ...prev,
                        scenes: {
                          ...prev.scenes,
                          [activeSceneId]: { ...activeScene, autoAdvanceDelay: val },
                        },
                      }));
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500 font-mono"
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">开启全局自动轮播后，本场景停留该时长后自动进入下一场景</p>
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400"><Video size={12} className="text-violet-400" />场景呈现类型</label>
                <select
                  value={activeScene.type === 'interface' ? 'modal' : (activeScene.type || 'scene')}
                  onChange={(e) => {
                    const val = e.target.value as 'scene' | 'modal';
                    onUpdateProject((prev) => ({
                      ...prev,
                      scenes: {
                        ...prev.scenes,
                        [activeSceneId]: { ...activeScene, type: val },
                      },
                    }));
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                >
                  <option value="scene">🎬 画布全屏场景</option>
                  <option value="modal">💬 弹窗场景</option>
                </select>
                <p className="text-[9px] text-slate-500 mt-0.5">「画布全屏场景」参与自动轮播/巡航；「弹窗场景」仅被交互触发弹出，不参与轮播</p>
              </div>

              {/* 【工程级画布】画布比例设置：决定舞台/输出比例，元素百分比自动等比适配 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400"><Square size={12} className="text-cyan-400" />画布比例</label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {canvasSpec.width} × {canvasSpec.height}（{getCanvasRatioLabel(canvasSpec.width, canvasSpec.height)}）
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {CANVAS_PRESETS.map((p) => {
                    const active = canvasSpec.width === p.width && canvasSpec.height === p.height;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        title={`${p.sub}`}
                        onClick={() => {
                          if (active) return;
                          setCustomCanvasOpen(false);
                          onUpdateProject((prev) => ({
                            ...prev,
                            canvas: { width: p.width, height: p.height },
                          }));
                        }}
                        className={`rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                          active
                            ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-sky-500/40 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  {/* 自定义画布 */}
                  <button
                    type="button"
                    title="自定义宽高（异形屏/拼接屏）"
                    onClick={() => {
                      setCustomCanvasOpen((v) => !v);
                      setCustomW(String(canvasSpec.width));
                      setCustomH(String(canvasSpec.height));
                    }}
                    className={`rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                      customCanvasOpen || !CANVAS_PRESETS.some((p) => p.width === canvasSpec.width && p.height === canvasSpec.height)
                        ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-sky-500/40 hover:text-slate-200'
                    }`}
                  >
                    自定义
                  </button>
                </div>
                {customCanvasOpen && (
                  <div className="mt-2 flex items-center gap-2 bg-black/30 rounded-md p-2">
                    <input
                      type="number" min={100} max={8000}
                      value={customW}
                      onChange={(e) => setCustomW(e.target.value)}
                      className="w-16 px-1.5 py-1 rounded bg-white/10 border border-white/10 text-white text-[11px] font-mono outline-none focus:border-sky-500"
                      placeholder="宽"
                    />
                    <span className="text-slate-600 text-[11px]">×</span>
                    <input
                      type="number" min={100} max={8000}
                      value={customH}
                      onChange={(e) => setCustomH(e.target.value)}
                      className="w-16 px-1.5 py-1 rounded bg-white/10 border border-white/10 text-white text-[11px] font-mono outline-none focus:border-sky-500"
                      placeholder="高"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const w = parseInt(customW, 10);
                        const h = parseInt(customH, 10);
                        if (Number.isFinite(w) && Number.isFinite(h) && w >= 100 && h >= 100 && w <= 8000 && h <= 8000) {
                          onUpdateProject((prev) => ({ ...prev, canvas: { width: w, height: h } }));
                          setCustomCanvasOpen(false);
                        }
                      }}
                      className="ml-auto px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-white text-[10px] font-semibold"
                    >
                      应用
                    </button>
                  </div>
                )}
                <p className="text-[9px] text-slate-500 mt-0.5">切换比例后舞台与导出输出跟随新比例；元素为百分比坐标，自动等比适配无需迁移</p>
              </div>
            </div>

            {/* 背景与视效：当前分类只有一个区块，固定展开 */}
            <div className={sceneInspectorTab === 'appearance' ? '' : 'hidden'}>
            <div className="w-full flex items-center justify-between border-t border-white/10 pt-3 group">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><Palette size={12} className="text-sky-400" />背景与视效</span>
            </div>
            <div className="pt-3 space-y-3">
              {(() => {
                const gradientType = activeScene.gradientType || 'linear';
                const gradientStart = activeScene.gradientStart || '#06b6d4';
                const gradientVia = activeScene.gradientVia || '#3b82f6';
                const gradientEnd = activeScene.gradientEnd || '#9333ea';
                const gradientAngle = activeScene.gradientAngle ?? 135;
                const gradientPreview = getGradientBackground({ gradientType, gradientStart, gradientVia: activeScene.gradientVia, gradientEnd, gradientAngle });
                const colorValue = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
                return <>
                  <div>
                    <label htmlFor="scene-background-type" className="mb-1 block text-[11px] text-slate-400">背景类型</label>
                    <select
                      id="scene-background-type"
                      value={activeScene.backgroundType || 'solid'}
                      onChange={(event) => updateActiveScene({ backgroundType: event.target.value as 'solid' | 'gradient' | 'transparent' })}
                      className="h-8 w-full rounded border border-white/10 bg-black/40 px-2 text-[11px] text-white outline-none focus:border-sky-400/60"
                    >
                      <option value="solid">纯色背景</option>
                      <option value="gradient">渐变背景</option>
                      <option value="transparent">无背景（透明）</option>
                    </select>
                  </div>

                  {activeScene.backgroundType === 'transparent' ? <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 px-2.5 py-2 text-[10px] leading-relaxed text-sky-100/80">当前场景不渲染颜色、渐变或背景图。原背景设置会保留，切回其他类型即可恢复。</div> : activeScene.backgroundType !== 'gradient' ? <div>
                    <label className="mb-1 block text-[11px] text-slate-400">背景基底颜色</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={colorValue(activeScene.bgColor || '#08080c', '#08080c')} onChange={(event) => updateActiveScene({ bgColor: event.target.value })} className="h-8 w-9 cursor-pointer rounded border border-white/20 bg-transparent" />
                      <input type="text" value={activeScene.bgColor || '#08080c'} onChange={(event) => updateActiveScene({ bgColor: event.target.value })} className="flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-sky-400/60" />
                    </div>
                    <div className="mt-2">
                      <span className="mb-1.5 block text-[10px] font-semibold text-slate-400">卡片渐变快捷设置</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {GRADIENT_PRESETS.slice(0, 6).map((preset) => <button key={`solid-${preset.id}`} type="button" onClick={() => updateActiveScene({ backgroundType: 'gradient', gradientType: preset.type, gradientAngle: preset.angle ?? 135, gradientStart: preset.start, gradientVia: preset.via, gradientEnd: preset.end })} className="h-7 truncate rounded border border-white/10 px-2 text-left text-[10px] text-white transition hover:border-pink-300/60" style={{ background: preset.css }} title={`应用渐变：${preset.name}`}>{preset.name}</button>)}
                      </div>
                    </div>
                  </div> : <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                    <div className="h-14 rounded border border-white/15" style={{ background: gradientPreview }} aria-label="渐变背景预览" />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-400">渐变形态<select value={gradientType} onChange={(event) => updateActiveScene({ backgroundType: 'gradient', gradientType: event.target.value as 'linear' | 'radial' })} className="mt-1 h-8 w-full rounded border border-white/10 bg-black/40 px-2 text-[11px] text-white"><option value="linear">线性渐变</option><option value="radial">径向渐变</option></select></label>
                      <label className="text-[10px] text-slate-400">渐变角度 <span className="float-right font-mono text-pink-300">{gradientAngle}°</span><input type="range" min="0" max="360" step="5" disabled={gradientType === 'radial'} value={gradientAngle} onChange={(event) => updateActiveScene({ backgroundType: 'gradient', gradientAngle: Number(event.target.value) })} className="mt-2 w-full accent-pink-500 disabled:opacity-30" /></label>
                    </div>
                    {gradientType === 'linear' && <div className="flex gap-1 overflow-x-auto pb-0.5">{[135, 90, 180, 45, 315, 0].map((angle) => <button key={angle} type="button" onClick={() => updateActiveScene({ backgroundType: 'gradient', gradientAngle: angle })} className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${gradientAngle === angle ? 'border-pink-400/60 bg-pink-500/20 text-pink-200' : 'border-white/10 bg-white/5 text-slate-400'}`}>{angle}°</button>)}</div>}
                    <div className="border-t border-white/10 pt-2">
                      <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-semibold text-slate-400">渐变色标</span><button type="button" onClick={() => updateActiveScene({ gradientVia: activeScene.gradientVia ? undefined : '#3b82f6' })} className="text-[10px] text-pink-300 hover:text-pink-200">{activeScene.gradientVia ? '移除中间色' : '+ 添加中间色'}</button></div>
                      <div className="space-y-1.5">
                        {([['起始色', 'gradientStart', gradientStart, '#06b6d4'], ...(activeScene.gradientVia ? [['过渡色', 'gradientVia', gradientVia, '#3b82f6'] as const] : []), ['终止色', 'gradientEnd', gradientEnd, '#9333ea']] as const).map(([label, key, value, fallback]) => <div key={key} className="flex items-center gap-2"><span className="w-12 shrink-0 text-[10px] text-slate-500">{label}</span><input type="color" value={colorValue(value, fallback)} onChange={(event) => updateActiveScene({ backgroundType: 'gradient', [key]: event.target.value } as Partial<Scene>)} className="h-7 w-7 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent" /><input type="text" value={value} onChange={(event) => updateActiveScene({ backgroundType: 'gradient', [key]: event.target.value } as Partial<Scene>)} className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white outline-none focus:border-pink-400/60" /></div>)}
                      </div>
                    </div>
                    <div><span className="mb-1.5 block text-[10px] font-semibold text-slate-400">渐变预设</span><div className="grid grid-cols-2 gap-1.5">{GRADIENT_PRESETS.slice(0, 8).map((preset) => <button key={preset.id} type="button" onClick={() => updateActiveScene({ backgroundType: 'gradient', gradientType: preset.type, gradientAngle: preset.angle ?? 135, gradientStart: preset.start, gradientVia: preset.via, gradientEnd: preset.end })} className="h-8 rounded border border-white/10 px-2 text-left text-[10px] text-white transition hover:border-white/30" style={{ background: preset.css }} title={preset.name}>{preset.name}</button>)}</div></div>
                  </div>}

                  <div className="space-y-2">
                {activeScene.backgroundType !== 'transparent' && <>
                  <button
                    type="button"
                    onClick={() => bgImageInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg flex items-center justify-center gap-2 text-slate-200 transition-colors font-medium"
                  >
                    <ImageIcon size={14} className="text-sky-400" />
                    <span>{activeScene.bgRef ? '更换背景图' : '上传场景背景图'}</span>
                  </button>

                  {activeScene.bgRef && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateProject((prev) => ({
                          ...prev,
                          scenes: {
                            ...prev.scenes,
                            [activeSceneId]: { ...activeScene, bgRef: '' },
                          },
                        }));
                      }}
                      className="w-full py-1 text-rose-400 hover:text-rose-300 text-[11px]"
                    >
                      移除背景图
                    </button>
                  )}
                </>}

                <button
                  type="button"
                  onClick={() => bgmAudioInputRef.current?.click()}
                  className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg flex items-center justify-center gap-2 text-slate-200 transition-colors font-medium"
                >
                  <Music size={14} className="text-pink-400" />
                  <span>{activeScene.bgmRef ? '更换场景背景音频' : '上传场景背景音频 (BGM)'}</span>
                </button>

                {activeScene.bgmRef && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProject((prev) => ({
                        ...prev,
                        scenes: {
                          ...prev.scenes,
                          [activeSceneId]: { ...activeScene, bgmRef: '' },
                        },
                      }));
                    }}
                    className="w-full py-1 text-rose-400 hover:text-rose-300 text-[11px]"
                  >
                    移除背景音频
                  </button>
                )}
              </div>
                  </>;
                })()}
            </div>

            {/* Scene Transition Settings：当前分类只有一个区块，固定展开 */}
            </div>
            <div className={sceneInspectorTab === 'transition' ? '' : 'hidden'}>
            <div className="w-full flex items-center justify-between border-t border-white/10 pt-3 group">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                <Sparkles size={13} className="text-amber-400" />
                场景转场设置 (TRANSITION)
              </span>
              <span className="flex items-center gap-2">
                {onPreviewTransition && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onPreviewTransition(); }}
                    title="即时预览该场景转场动效"
                    className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Play size={10} className="fill-current" />
                    <span>预览转场</span>
                  </span>
                )}
              </span>
            </div>
            <div className="pt-3 space-y-3">

              {/* Enter Transition (进入转场) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-300 font-medium">进入转场 (In Transition)</label>
                  <span className="text-[10px] font-mono text-sky-400">{activeScene.transitionIn || 'fade'}</span>
                </div>
                <select
                  value={activeScene.transitionIn || 'fade'}
                  onChange={(e) => {
                    const val = e.target.value as SceneTransitionType;
                    onUpdateProject((prev) => ({
                      ...prev,
                      scenes: {
                        ...prev.scenes,
                        [activeSceneId]: { ...activeScene, transitionIn: val },
                      },
                    }));
                  }}
                  className="w-full bg-black/40 border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                >
                  <option value="none">⏹️ 无转场 (直接硬切)</option>
                  <option value="fade">🌫️ 平滑淡入 (Crossfade)</option>
                  <option value="slide-left">⬅️ 向左推进 (Slide Left)</option>
                  <option value="slide-right">➡️ 向右推进 (Slide Right)</option>
                  <option value="slide-up">⬆️ 向上滑入 (Slide Up)</option>
                  <option value="slide-down">⬇️ 向下滑入 (Slide Down)</option>
                  <option value="zoom-in">🔍 镜头推近 (Zoom In)</option>
                  <option value="zoom-out">🔭 景深后撤 (Zoom Out)</option>
                  <option value="dissolve">🫧 模糊溶解 (Blur Dissolve)</option>
                  <option value="flip-3d">🔄 3D 空间翻转 (3D Flip)</option>
                  <option value="cube-3d">🎲 3D 立方体旋转 (3D Cube)</option>
                  <option value="glitch">⚡ 赛博故障波纹 (Glitch Wipe)</option>
                  <option value="wipe-right">✨ 光幕对角划过 (Wipe)</option>
                  <option value="soft-wipe">柔光擦拭</option>
                  <option value="radial-reveal">径向扩散</option>
                  <option value="diagonal-curtain">斜切光幕</option>
                  <option value="blur-dissolve">模糊溶解（静态推荐）</option>
                </select>
              </div>

              {/* Exit Transition (退出转场) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-300 font-medium">退出转场 (Exit Transition)</label>
                  <span className="text-[10px] font-mono text-indigo-400">{activeScene.transitionOut || 'none'}</span>
                </div>
                <select
                  value={activeScene.transitionOut || 'none'}
                  onChange={(e) => {
                    const val = e.target.value as SceneTransitionType;
                    onUpdateProject((prev) => ({
                      ...prev,
                      scenes: {
                        ...prev.scenes,
                        [activeSceneId]: { ...activeScene, transitionOut: val },
                      },
                    }));
                  }}
                  className="w-full bg-black/40 border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-400"
                >
                  <option value="none">⏹️ 无特殊退出 (跟随默认)</option>
                  <option value="fade">🌫️ 平滑淡出 (Fade Out)</option>
                  <option value="slide-left">⬅️ 向左滑出 (Slide Left)</option>
                  <option value="slide-right">➡️ 向右滑出 (Slide Right)</option>
                  <option value="slide-up">⬆️ 向上滑出 (Slide Up)</option>
                  <option value="slide-down">⬇️ 向下滑出 (Slide Down)</option>
                  <option value="zoom-out">🔭 缩放退场 (Zoom Out)</option>
                  <option value="dissolve">🫧 模糊溶解退场 (Blur Dissolve)</option>
                  <option value="flip-3d">🔄 3D 翻转退场 (3D Flip)</option>
                  <option value="cube-3d">🎲 3D 立方体退场 (3D Cube)</option>
                  <option value="soft-wipe">柔光擦拭退场</option>
                  <option value="radial-reveal">径向扩散退场</option>
                  <option value="diagonal-curtain">斜切光幕退场</option>
                  <option value="blur-dissolve">模糊溶解退场（静态推荐）</option>
                </select>
              </div>

              {/* Transition Duration (转场时长) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">转场时长 (秒)</label>
                  <span className="text-[11px] font-mono text-amber-300 font-bold">
                    {(activeScene.transitionDuration ?? 0.6).toFixed(2)}s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.05"
                    value={activeScene.transitionDuration ?? 0.6}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateProject((prev) => ({
                        ...prev,
                        scenes: {
                          ...prev.scenes,
                          [activeSceneId]: { ...activeScene, transitionDuration: val },
                        },
                      }));
                    }}
                    className="flex-1 accent-amber-400"
                  />
                  <input
                    type="number"
                    min="0.2"
                    max="2.5"
                    step="0.05"
                    value={activeScene.transitionDuration ?? 0.6}
                    onChange={(e) => {
                      const val = Math.max(0.1, Math.min(5, parseFloat(e.target.value) || 0.6));
                      onUpdateProject((prev) => ({
                        ...prev,
                        scenes: {
                          ...prev.scenes,
                          [activeSceneId]: { ...activeScene, transitionDuration: val },
                        },
                      }));
                    }}
                    className="w-16 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs text-white text-center font-mono outline-none focus:border-amber-400"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[0.3, 0.6, 1.0, 1.5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        onUpdateProject((prev) => ({
                          ...prev,
                          scenes: {
                            ...prev.scenes,
                            [activeSceneId]: { ...activeScene, transitionDuration: d },
                          },
                        }));
                      }}
                      className={`flex-1 py-0.5 text-[10px] rounded border transition-colors ${
                        (activeScene.transitionDuration ?? 0.6) === d
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition Easing (缓动曲线) */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">动力学缓动曲线 (Easing)</label>
                <select
                  value={activeScene.transitionEasing || 'cubic-bezier(0.25, 0.1, 0.25, 1)'}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateProject((prev) => ({
                      ...prev,
                      scenes: {
                        ...prev.scenes,
                        [activeSceneId]: { ...activeScene, transitionEasing: val },
                      },
                    }));
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                >
                  <option value="cubic-bezier(0.25, 0.1, 0.25, 1)">✨ 电影级平滑 (Cinematic Smooth)</option>
                  <option value="cubic-bezier(0.16, 1, 0.3, 1)">⚡ 弹性动力学 (Spring Smooth)</option>
                  <option value="ease-out">🌊 平滑减速 (Ease Out)</option>
                  <option value="ease-in-out">🔄 缓入缓出 (Ease In-Out)</option>
                  <option value="linear">📐 匀速运动 (Linear)</option>
                </select>
              </div>
            </div>

            {/* 播放控制栏 HUD 款式（工程级，编辑器预览与导出共用） */}
            </div>
            <div className={sceneInspectorTab === 'interaction' ? '' : 'hidden'}>
            <button
              type="button"
              onClick={() => toggleSection('scene-hud')}
              className="w-full flex items-center justify-between border-t border-white/10 pt-3 group"
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-sky-400">🎛️</span>
                <span>播放控制栏 HUD</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-mono">
                  {{ default:'默认胶囊', minimal:'极简', tech:'科技', hidden:'隐藏' }[projectData.hudConfig?.style || 'default']}
                </span>
                <ChevronDown size={12} className={`transition-transform ${collapsedSections['scene-hud'] ? '' : 'rotate-180'} text-slate-500 group-hover:text-slate-300`} />
              </span>
            </button>
            <div className={`pt-3 space-y-3 ${collapsedSections['scene-hud'] ? 'hidden' : ''}`}>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { v: 'default', label: '默认', desc: '深色胶囊' },
                  { v: 'minimal', label: '极简', desc: '底部半透' },
                  { v: 'tech', label: '科技', desc: '发光边框' },
                  { v: 'hidden', label: '隐藏', desc: '不显示' },
                ] as const).map((opt) => {
                  const cur = projectData.hudConfig?.style || 'default';
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => onUpdateProject((prev) => ({
                        ...prev,
                        hudConfig: {
                          style: opt.v,
                          showDots: prev.hudConfig?.showDots ?? true,
                          showTitle: prev.hudConfig?.showTitle ?? true,
                          collapsible: prev.hudConfig?.collapsible ?? true,
                        },
                      }))}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        cur === opt.v ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/25'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{opt.label}</div>
                      <div className="text-[8px] opacity-70 mt-0.5">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
              {(projectData.hudConfig?.style || 'default') !== 'hidden' && (
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox"
                      checked={projectData.hudConfig?.showDots ?? true}
                      onChange={(e) => onUpdateProject((prev) => ({ ...prev, hudConfig: { style: prev.hudConfig?.style || 'default', showDots: e.target.checked, showTitle: prev.hudConfig?.showTitle ?? true, collapsible: prev.hudConfig?.collapsible ?? true } }))}
                      className="accent-sky-500" />
                    <span className="text-[10px] text-slate-400">场景进度点</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox"
                      checked={projectData.hudConfig?.showTitle ?? true}
                      onChange={(e) => onUpdateProject((prev) => ({ ...prev, hudConfig: { style: prev.hudConfig?.style || 'default', showDots: prev.hudConfig?.showDots ?? true, showTitle: e.target.checked, collapsible: prev.hudConfig?.collapsible ?? true } }))}
                      className="accent-sky-500" />
                    <span className="text-[10px] text-slate-400">场景名</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox"
                      checked={projectData.hudConfig?.collapsible ?? true}
                      onChange={(e) => onUpdateProject((prev) => ({ ...prev, hudConfig: { style: prev.hudConfig?.style || 'default', showDots: prev.hudConfig?.showDots ?? true, showTitle: prev.hudConfig?.showTitle ?? true, collapsible: e.target.checked } }))}
                      className="accent-sky-500" />
                    <span className="text-[10px] text-slate-400">允许折叠控制栏</span>
                  </label>
                </div>
              )}
              <p className="text-[9px] text-slate-500 leading-relaxed">按 E 进入预览可查看效果，导出的 HTML 将沿用此款式。</p>
            </div>

            {/* Scene Gesture Controls（体感控制 · 可折叠） */}
            <button
              type="button"
              onClick={() => toggleSection('scene-gesture')}
              className="w-full flex items-center justify-between border-t border-white/10 pt-3 group"
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-violet-400">🎯</span>
                <span>体感控制</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-mono">
                  {projectData.motionInput?.enabled ? (activeScene.gestureBindings || []).length + ' 个绑定' : '未启用'}
                </span>
                <ChevronDown size={12} className={`transition-transform ${collapsedSections['scene-gesture'] ? '' : 'rotate-180'} text-slate-500 group-hover:text-slate-300`} />
              </span>
            </button>
            <div className={`pt-3 space-y-3 ${collapsedSections['scene-gesture'] ? 'hidden' : ''}`}>

              {/* 工程级开关 */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-300 font-medium">体感交互（工程级）</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !(projectData.motionInput?.enabled ?? false);
                    onUpdateProject((prev) => ({
                      ...prev,
                      motionInput: { ...prev.motionInput, enabled: next, sensitivity: prev.motionInput?.sensitivity ?? 1 },
                    }));
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${(projectData.motionInput?.enabled ?? false) ? 'bg-violet-500' : 'bg-white/15'}`}
                  title="开启后预览/演示模式可隔空操控"
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(projectData.motionInput?.enabled ?? false) ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
              {projectData.motionInput?.enabled && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-300">全局灵敏度</label>
                    <span className="text-[10px] font-mono text-violet-300">{(projectData.motionInput?.sensitivity ?? 1).toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2}
                    step={0.05}
                    value={projectData.motionInput?.sensitivity ?? 1}
                    onChange={(e) =>
                      onUpdateProject((prev) => ({
                        ...prev,
                        motionInput: { ...prev.motionInput, enabled: true, sensitivity: Number(e.target.value) },
                      }), '调整体感灵敏度', 'scene_update', undefined, false)
                    }
                    onPointerUp={() => onUpdateProject((prev) => prev, '调整体感灵敏度', 'scene_update')}
                    onKeyUp={() => onUpdateProject((prev) => prev, '调整体感灵敏度', 'scene_update')}
                    className="w-full accent-violet-500"
                  />
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-300">死区</label>
                      <span className="text-[10px] font-mono text-violet-300">{((projectData.motionInput?.deadZone ?? 0.06) * 100).toFixed(0)}%</span>
                    </div>
                    <input type="range" min={0} max={0.3} step={0.01} value={projectData.motionInput?.deadZone ?? 0.06}
                      onChange={(e) => onUpdateProject((prev) => ({ ...prev, motionInput: { ...prev.motionInput, enabled: true, sensitivity: prev.motionInput?.sensitivity ?? 1, deadZone: Number(e.target.value) } }), '调整体感死区', 'scene_update', undefined, false)}
                      className="w-full accent-violet-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-300">反向控制</label>
                    <button type="button" aria-label="切换体感反向" onClick={() => onUpdateProject((prev) => ({ ...prev, motionInput: { ...prev.motionInput, enabled: true, sensitivity: prev.motionInput?.sensitivity ?? 1, reverse: !(prev.motionInput?.reverse ?? false) } }), '切换体感反向', 'scene_update')} className={`relative w-9 h-5 rounded-full transition-colors ${(projectData.motionInput?.reverse ?? false) ? 'bg-violet-500' : 'bg-white/15'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(projectData.motionInput?.reverse ?? false) ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-300">失联提示延迟</label>
                      <span className="text-[10px] font-mono text-violet-300">{projectData.motionInput?.disconnectTimeout ?? 900}ms</span>
                    </div>
                    <input type="range" min={200} max={5000} step={100} value={projectData.motionInput?.disconnectTimeout ?? 900}
                      onChange={(e) => onUpdateProject((prev) => ({ ...prev, motionInput: { ...prev.motionInput, enabled: true, sensitivity: prev.motionInput?.sensitivity ?? 1, disconnectTimeout: Number(e.target.value) } }), '调整失联提示延迟', 'scene_update', undefined, false)}
                      className="w-full accent-violet-500" />
                  </div>
                </div>
              )}

              {/* 场景手势绑定列表 */}
              {(activeScene.gestureBindings || []).map((b, bi) => (
                <div key={b.id} className="p-2.5 bg-violet-500/[0.06] border border-violet-500/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={b.gesture}
                      onChange={(e) =>
                        onUpdateProject((prev) => ({
                          ...prev,
                          scenes: {
                            ...prev.scenes,
                            [activeSceneId]: {
                              ...activeScene,
                              gestureBindings: (activeScene.gestureBindings || []).map((x, xi) => (xi === bi ? { ...x, gesture: e.target.value as any } : x)),
                            },
                          },
                        }))
                      }
                      className="flex-1 bg-black/40 border border-white/15 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400"
                    >
                      <option value="wave">👋 挥手</option>
                      <option value="open_palm">🖐 手掌张开</option>
                      <option value="swipe_left">👈 手掌左滑</option>
                      <option value="swipe_right">👉 手掌右滑</option>
                      <option value="fist">✊ 握拳</option>
                      <option value="point">☝️ 指点</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateProject((prev) => ({
                          ...prev,
                          scenes: {
                            ...prev.scenes,
                            [activeSceneId]: {
                              ...activeScene,
                              gestureBindings: (activeScene.gestureBindings || []).filter((_, xi) => xi !== bi),
                            },
                          },
                        }))
                      }
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                      title="删除此绑定"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={b.action}
                      onChange={(e) =>
                        onUpdateProject((prev) => ({
                          ...prev,
                          scenes: {
                            ...prev.scenes,
                            [activeSceneId]: {
                              ...activeScene,
                              gestureBindings: (activeScene.gestureBindings || []).map((x, xi) => (xi === bi ? { ...x, action: e.target.value as any } : x)),
                            },
                          },
                        }))
                      }
                      className="flex-1 bg-black/40 border border-white/15 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400"
                    >
                      <option value="next_scene">⏭ 切到下一场景</option>
                      <option value="prev_scene">⏮ 切到上一场景</option>
                      <option value="goto_scene">🎯 跳到指定场景</option>
                      <option value="goto_start">🏠 返回起始场景</option>
                      <option value="show_menu">📋 呼出/收起控制栏</option>
                      <option value="none">— 无动作</option>
                    </select>
                    {b.action === 'goto_scene' && (
                      <select
                        value={b.targetSceneId || ''}
                        onChange={(e) =>
                          onUpdateProject((prev) => ({
                            ...prev,
                            scenes: {
                              ...prev.scenes,
                              [activeSceneId]: {
                                ...activeScene,
                                gestureBindings: (activeScene.gestureBindings || []).map((x, xi) => (xi === bi ? { ...x, targetSceneId: e.target.value } : x)),
                              },
                            },
                          }))
                        }
                        className="w-28 bg-black/40 border border-white/15 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-violet-400"
                      >
                        {(Object.values(projectData.scenes) as any[]).map((sc) => (
                          <option key={sc.id} value={sc.id}>{sc.alias || sc.id}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400 shrink-0">灵敏度</label>
                    <input
                      type="range"
                      min={0.2}
                      max={2}
                      step={0.05}
                      value={b.sensitivity ?? 1}
                      onChange={(e) =>
                        onUpdateProject((prev) => ({
                          ...prev,
                          scenes: {
                            ...prev.scenes,
                            [activeSceneId]: {
                              ...activeScene,
                              gestureBindings: (activeScene.gestureBindings || []).map((x, xi) => (xi === bi ? { ...x, sensitivity: Number(e.target.value) } : x)),
                            },
                          },
                        }), '调整手势灵敏度', 'scene_update', undefined, false)
                      }
                      onPointerUp={() => onUpdateProject((prev) => prev, '调整手势灵敏度', 'scene_update')}
                      onKeyUp={() => onUpdateProject((prev) => prev, '调整手势灵敏度', 'scene_update')}
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-[10px] font-mono text-violet-300 w-8 text-right">{(b.sensitivity ?? 1).toFixed(2)}×</span>
                  </div>
                </div>
              ))}

              {/* 空绑定时一键填充推荐默认预设 */}
              {(activeScene.gestureBindings || []).length === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      motionInput: { ...prev.motionInput, enabled: prev.motionInput?.enabled ?? true, sensitivity: prev.motionInput?.sensitivity ?? 1 },
                      scenes: {
                        ...prev.scenes,
                        [activeSceneId]: { ...activeScene, gestureBindings: createDefaultGestureBindings() },
                      },
                    }), '填充体感默认预设', 'scene_update')
                  }
                  className="w-full p-2 rounded-lg border border-dashed border-violet-500/40 text-violet-300 text-[11px] font-semibold hover:bg-violet-500/10 transition-colors"
                >
                  ⚡ 填充默认预设（挥手/右滑下一页 · 左滑上一页 · 握拳回首页）
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const id = 'gb-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                  const nb = { id, gesture: 'wave' as any, action: 'next_scene' as any, sensitivity: 1 };
                  onUpdateProject((prev) => ({
                    ...prev,
                    motionInput: { ...prev.motionInput, enabled: prev.motionInput?.enabled ?? true, sensitivity: prev.motionInput?.sensitivity ?? 1 },
                    scenes: {
                      ...prev.scenes,
                      [activeSceneId]: { ...activeScene, gestureBindings: [...(activeScene.gestureBindings || []), nb] },
                    },
                  }));
                }}
                className="w-full py-1.5 rounded-md border border-dashed border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs font-medium transition-colors"
              >
                + 添加手势绑定
              </button>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                开启工程级体感后，预览/演示模式下用摄像头隔空操控：手势触发对应场景动作。绑定按场景独立配置，场景序列中会显示手势徽标。
              </p>
            </div>

            {/* Scene Layer Groups & Label Colors Overview（可折叠） */}
            </div>
            <div className={sceneInspectorTab === 'data' ? '' : 'hidden'}>
              <SceneDataInspector
                projectData={projectData}
                activeSceneId={activeSceneId}
                activeScene={activeScene}
                selectedElement={selectedElement}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                onUpdateProject={onUpdateProject}
                onUpdateElement={onUpdateElement}
                onSelectElement={onSelectElement}
              />
            </div>
          </div>
        )}
        {selectedElement && (
          <div className="space-y-4">
            {selectedElement.interactionArea && (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-3 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                  <MousePointer size={14} />
                  <span>交互设置</span>
                </div>
                <p className="text-[10px] leading-4 text-slate-400">这是一个透明点击区域。轮廓只在编辑时显示，预览和导出时自动隐藏。</p>
                <label className="block space-y-1 text-[10px] text-slate-400">
                  <span>触发方式</span>
                  <select
                    value={selectedElement.interaction?.trigger || 'click'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { interaction: { ...selectedElement.interaction, trigger: e.target.value as SceneElement['trigger'], action: selectedElement.interaction?.action || 'jump' } }, '修改交互设置')}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="click">点击</option>
                    <option value="hover">悬停</option>
                    <option value="long-press">长按</option>
                  </select>
                </label>
                <label className="block space-y-1 text-[10px] text-slate-400">
                  <span>动作</span>
                  <select
                    value={selectedElement.interaction?.action || 'jump'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { interaction: { ...selectedElement.interaction, trigger: selectedElement.interaction?.trigger || 'click', action: e.target.value as NonNullable<SceneElement['interaction']>['action'] } }, '修改交互设置')}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="jump">跳转场景</option>
                    <option value="popup">打开弹窗</option>
                    <option value="url">打开网页</option>
                  </select>
                </label>
                {(selectedElement.interaction?.action || 'jump') === 'url' ? (
                  <label className="block space-y-1 text-[10px] text-slate-400"><span>选择场景或链接</span><input type="url" value={selectedElement.interaction?.url || ''} onChange={(e) => onUpdateElement(selectedElement.id, { interaction: { ...selectedElement.interaction, action: 'url', url: e.target.value } }, '修改交互设置')} placeholder="https://example.com" className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white" /></label>
                ) : (
                  <label className="block space-y-1 text-[10px] text-slate-400"><span>目标场景</span><select value={selectedElement.interaction?.target || ''} onChange={(e) => onUpdateElement(selectedElement.id, { interaction: { ...selectedElement.interaction, action: selectedElement.interaction?.action || 'jump', target: e.target.value } }, '修改交互设置')} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"><option value="">选择场景</option>{Object.values(projectData.scenes).filter((scene) => scene.id !== activeSceneId).map((scene) => <option key={scene.id} value={scene.id}>{scene.alias || scene.id}</option>)}</select></label>
                )}
                {((selectedElement.interaction?.action || 'jump') !== 'url' && !selectedElement.interaction?.target) && <div className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[10px] text-amber-200">尚未选择目标场景，预览时不会触发。</div>}
              </div>
            )}
            {selectedElement.type === 'custom-code' && selectedElement.customCode && (
              <div className="space-y-3">
                <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-900 p-3 space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                        <Code2 size={13} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {selectedElement.customCode.name || '代码微组件'}
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            v{selectedElement.customCode.version || '1.0'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedElement.customCode.diagnostics?.status === 'error' ? 'bg-rose-400 animate-pulse' : selectedElement.customCode.diagnostics?.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          <span>{selectedElement.customCode.diagnostics?.status === 'warning' ? '组件有轻微警告' : selectedElement.customCode.diagnostics?.status === 'error' ? '代码存在语法异常' : '组件就绪 · 渲染正常'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCustomCodePlugin?.(selectedElement.id)}
                      className="px-2 py-1 rounded-md text-[10px] font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors flex items-center gap-1"
                      title="打开源码编辑器 (专业模式)"
                    >
                      <Code2 size={11} />
                      <span>查看源码</span>
                    </button>
                  </div>
                </div>

                <CustomCodeDynamicControls
                  element={selectedElement}
                  onUpdateElement={onUpdateElement}
                  projectVariables={projectData.variables}
                />
              </div>
            )}
            {/* Quick Actions & Header */}
            <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">
                  {selectedElement.interactionArea ? '交互区域' : selectedElement.type.toUpperCase()}
                </span>
                <input
                  type="text"
                  value={selectedElement.sourceName || ''}
                  placeholder="重命名图层..."
                  onChange={(e) => onUpdateElement(selectedElement.id, { sourceName: e.target.value })}
                  className="bg-transparent text-xs font-semibold text-white outline-none w-32 border-b border-transparent focus:border-sky-400"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onUpdateElement(selectedElement.id, { locked: !selectedElement.locked })}
                  title={selectedElement.locked ? '解锁' : '锁定'}
                  className={`p-1.5 rounded ${selectedElement.locked ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:bg-white/10'}`}
                >
                  {selectedElement.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteElement(selectedElement.id)}
                  title="删除图层 (Delete)"
                  className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* 合并图层组（嵌套容器）：子图层列表 + 拆开 */}
            <div role="tablist" aria-label="图层属性分类" className="sticky top-0 z-20 -mx-3 grid grid-cols-5 border-y border-white/10 bg-[#12141c] px-1 shadow-lg shadow-black/10">
              {([
                { id: 'base', label: '基础', icon: Move },
                { id: 'effects', label: '外观', icon: Palette },
                { id: 'animation', label: '动效', icon: Sparkles },
                { id: 'interaction', label: '交互', icon: MousePointer },
                { id: 'data', label: '数据', icon: DatabaseIcon },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={elementInspectorTab === id}
                  onClick={() => setElementInspectorTab(id)}
                  className={`relative flex min-h-9 min-w-0 items-center justify-center gap-0.5 px-0.5 text-[9px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
                    elementInspectorTab === id ? 'text-sky-300' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  <Icon size={11} />
                  <span className="truncate">{label}</span>
                  {elementInspectorTab === id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-sky-400" />}
                </button>
              ))}
            </div>

            <InspectorGuide>{ELEMENT_INSPECTOR_GUIDANCE[elementInspectorTab]}</InspectorGuide>

            {elementInspectorTab === 'base' && selectedElement.type === 'group' && selectedElement.componentInstance && (() => {
              const instance = selectedElement.componentInstance;
              const master = projectData.components?.find((item) => item.id === instance.masterId);
              const variant = master?.variants?.find((item) => item.id === (instance.variantId || 'default'));
              return (
                <div className="p-3 bg-cyan-950/40 rounded-lg border border-cyan-500/30">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0 text-[11px] font-semibold text-cyan-200 flex items-center gap-1.5">
                      <Layers size={12} />
                      <span className="truncate">组件副本 · {master?.name || '母版已丢失'}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {master && (
                        <button
                          type="button"
                          onClick={() => onUpdateProject((prev) => {
                            const result = updateMasterFromInstance(prev, selectedElement.id);
                            return result?.projectData || prev;
                          }, '更新组件母版')}
                          title="把当前副本的外观写回母版，并同步所有副本"
                          className="px-2 py-1 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10px] font-bold rounded shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <RefreshCw size={10} />
                          更新母版
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onUpdateProject((prev) => detachInstance(prev, selectedElement.id), '分离组件副本')}
                        title="断开母版链接，变成普通图层组"
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] font-semibold rounded flex items-center gap-1"
                      >
                        <Unlink size={10} />
                        分离
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                    {master
                      ? `状态：${variant?.name || '默认'}。改母版会同步所有副本；个别文字/颜色可在左侧「组件」面板单独覆盖。`
                      : '母版已被删除，这个副本仍可正常使用，建议分离为普通图层组。'}
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                    {(selectedElement.children || []).map((child, i) => (
                      <div key={child.id} className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded text-[10px] text-slate-300">
                        <span className="text-slate-500 shrink-0">{i + 1}.</span>
                        <Layers size={10} className="text-cyan-400 shrink-0" />
                        <span className="truncate flex-1">{child.sourceName || child.content || child.id}</span>
                        <span className="text-slate-500 font-mono shrink-0">{child.type.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {elementInspectorTab === 'base' && selectedElement.type === 'group' && !selectedElement.componentInstance && (
              <div className="p-3 bg-indigo-950/40 rounded-lg border border-indigo-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Layers size={12} />
                    合并图层组（{(selectedElement.children || []).length} 个图层）
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnmergeElement?.(selectedElement.id)}
                    title="拆开合并图层组，恢复为独立图层"
                    className="px-2 py-1 bg-amber-500/90 hover:bg-amber-400 text-slate-950 text-[11px] font-bold rounded shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Unlink size={11} />
                    拆开
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                  已合并为一个整体图层，可整体移动 / 缩放 / 旋转；点「拆开」恢复为独立图层（保留原有外观与位置）。
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                  {(selectedElement.children || []).map((child, i) => (
                    <div key={child.id} className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded text-[10px] text-slate-300">
                      <span className="text-slate-500 shrink-0">{i + 1}.</span>
                      <Layers size={10} className="text-indigo-400 shrink-0" />
                      <span className="truncate flex-1">{child.sourceName || child.content || child.id}</span>
                      <span className="text-slate-500 font-mono shrink-0">{child.type.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Layer Group & Label Color Assignment */}
            {elementInspectorTab === 'base' && (() => {
              const currentGroup = (activeScene.groups || []).find((g) => g.id === selectedElement.groupId);
              const groupColorDef = currentGroup ? getGroupColorConfig(currentGroup.color) : null;

              return (
                <div className={`p-2.5 rounded-lg border transition-colors ${
                  currentGroup && groupColorDef
                    ? `${groupColorDef.border} ${groupColorDef.bg}`
                    : 'bg-white/[0.03] border-white/10'
                } space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      {groupColorDef ? (
                        <span
                          className="w-2.5 h-2.5 rounded-full ring-2 ring-white/30 shrink-0 shadow-xs"
                          style={{ backgroundColor: groupColorDef.tag }}
                        />
                      ) : (
                        <Folder size={12} className="text-slate-400" />
                      )}
                      <span>所属图层组</span>
                    </span>

                    {currentGroup && (
                      <span className="text-[10px] font-medium text-slate-300 flex items-center gap-1">
                        <span>标记: {groupColorDef?.label}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedElement.groupId || ''}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        onUpdateElement(selectedElement.id, { groupId: val });
                      }}
                      className="flex-1 bg-black/50 border border-white/15 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-sky-400"
                    >
                      <option value="">🚫 未分配分组 (独立图层)</option>
                      {(activeScene.groups || []).map((grp) => {
                        const cd = getGroupColorConfig(grp.color);
                        return (
                          <option key={grp.id} value={grp.id}>
                            📁 {grp.name} ({cd.label})
                          </option>
                        );
                      })}
                    </select>

                    {currentGroup && (
                      <button
                        type="button"
                        onClick={() => onUpdateElement(selectedElement.id, { groupId: undefined })}
                        title="移出此分组"
                        className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded border border-rose-500/30 transition-colors"
                      >
                        <Unlink size={13} />
                      </button>
                    )}
                  </div>

                  {/* If in group, offer quick color picker right here */}
                  {currentGroup && (
                    <div className="pt-1.5 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">切换组颜色标记:</span>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {Object.entries(FOLDER_COLORS).map(([cKey, cVal]) => (
                          <button
                            key={cKey}
                            type="button"
                            onClick={() => {
                              onUpdateProject((prev) => ({
                                ...prev,
                                scenes: {
                                  ...prev.scenes,
                                  [activeSceneId]: {
                                    ...activeScene,
                                    groups: (activeScene.groups || []).map((g) =>
                                      g.id === currentGroup.id ? { ...g, color: cKey } : g
                                    ),
                                  },
                                },
                              }));
                            }}
                            title={`${cVal.label} (${cVal.tag})`}
                            style={{ backgroundColor: cVal.tag }}
                            className={`w-3.5 h-3.5 rounded-full border border-white/20 hover:scale-125 transition-transform ${
                              (currentGroup.color || 'sky') === cKey ? 'ring-2 ring-white scale-110 shadow-xs' : ''
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* UI 组件（Galaxy）属性：文字、颜色等可编辑 */}
            {elementInspectorTab === 'base' && selectedElement.type === 'ui-component' && (
              <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-500/30 space-y-2.5">
                <UiItemsEditor element={selectedElement} onUpdateElement={onUpdateElement} />
                <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Box size={12} />
                  <span>UI 组件设置 ({selectedElement.uiComponentType || 'unknown'})</span>
                </div>

                {/* 组件文字（卡片使用标题字段，其他组件继续使用 label） */}
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    {UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') ? '卡片标题' : '组件文字'}
                  </label>
                  <input
                    type="text"
                    value={UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '')
                      ? ((selectedElement.uiComponentData && (selectedElement.uiComponentData.title || selectedElement.uiComponentData.label)) || '')
                      : selectedElement.uiComponentType === 'official-modao'
                        ? getOfficialPrimaryTextValue(selectedElement.uiComponentData || {})
                        : ((selectedElement.uiComponentData && selectedElement.uiComponentData.label) || '')}
                    placeholder={UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') ? '输入卡片标题...' : '输入组件文字...'}
                    onChange={(e) => {
                      const currentData = selectedElement.uiComponentData || {};
                      if (UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '')) {
                        onUpdateElement(selectedElement.id, { uiComponentData: { ...currentData, title: e.target.value, label: e.target.value } });
                        return;
                      }
                      if (selectedElement.uiComponentType === 'official-modao') {
                        const primaryKey = getOfficialPrimaryTextKey(currentData);
                        onUpdateElement(selectedElement.id, { uiComponentData: { ...currentData, label: e.target.value, [primaryKey]: e.target.value } }, '编辑官方组件文字');
                        return;
                      }
                      onUpdateElement(selectedElement.id, { uiComponentData: { ...currentData, label: e.target.value } });
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>

                {UI_TEXT_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') && (
                  <>
                    {selectedElement.uiComponentType === 'auth-toggle-button' && <div>
                      <label className="block text-[10px] text-slate-400 mb-1">注册文字</label>
                      <input
                        type="text"
                        value={selectedElement.uiComponentData?.secondaryLabel ?? 'SIGN UP'}
                        onChange={(e) => onUpdateElement(selectedElement.id, {
                          uiComponentData: { ...(selectedElement.uiComponentData || {}), secondaryLabel: e.target.value },
                        })}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                      />
                    </div>}
                    {!['pattern-prediction-chart', 'data-trend-chart', 'data-trend-cyber-chart', 'data-trend-area-chart', 'data-trend-dual-area-chart', 'cyber-bubble-chart', 'cyber-ring-chart', 'cyber-multi-ring-chart', 'cyber-radar-chart', 'cyber-3d-donut-chart', 'distribution-stat-chart', 'pyramid-distribution-chart'].includes(selectedElement.uiComponentType || '') && <div>
                      <label className="block text-[10px] text-slate-400 mb-1">缩放数字（可选）</label>
                      <input
                        type="number"
                        value={selectedElement.uiComponentData?.value ?? ''}
                        onChange={(e) => onUpdateElement(selectedElement.id, {
                          uiComponentData: {
                            ...(selectedElement.uiComponentData || {}),
                            value: e.target.value === '' ? '' : Number(e.target.value),
                          },
                        })}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-cyan-400"
                        placeholder="从文字中自动识别数字"
                      />
                    </div>}
                    <UiComponentTextStyleControls element={selectedElement} onUpdateElement={onUpdateElement} />
                  </>
                )}

                {UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">卡片正文</label>
                      <textarea
                        rows={2}
                        value={(selectedElement.uiComponentData && selectedElement.uiComponentData.content) || ''}
                        placeholder="输入补充说明或指标数值..."
                        onChange={(e) => onUpdateElement(selectedElement.id, {
                          uiComponentData: { ...(selectedElement.uiComponentData || {}), content: e.target.value }
                        })}
                        className="w-full resize-y bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white leading-relaxed outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">内容对齐</label>
                      <div className="grid grid-cols-2 gap-1 rounded bg-black/30 p-1">
                        {(['center', 'left'] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => onUpdateElement(selectedElement.id, {
                              uiComponentData: { ...(selectedElement.uiComponentData || {}), align }
                            })}
                            className={`rounded px-2 py-1.5 text-[10px] transition-colors ${((selectedElement.uiComponentData && selectedElement.uiComponentData.align) || 'center') === align ? 'bg-cyan-500/25 text-cyan-100' : 'text-slate-400 hover:bg-white/10'}`}
                          >
                            {align === 'center' ? '居中' : '左对齐'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {HOLOGRAPHIC_GAUGE_TYPES.has(selectedElement.uiComponentType as any) && (
                  <div className="space-y-2 border-t border-cyan-400/20 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-cyan-200">数据图标数值</label>
                      <span className="text-[9px] text-slate-500">悬停仅模拟波动，不会覆盖此数值</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'value', label: '当前值', fallback: 0 },
                        { key: 'min', label: '最小值', fallback: 0 },
                        { key: 'max', label: '最大值', fallback: 100 },
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="mb-1 block text-[9px] text-slate-500">{field.label}</label>
                          <input
                            type="number"
                            step="any"
                            value={selectedElement.uiComponentData?.[field.key] ?? ''}
                            placeholder={String(field.fallback)}
                            onChange={(e) => onUpdateElement(selectedElement.id, {
                              uiComponentData: {
                                ...(selectedElement.uiComponentData || {}),
                                [field.key]: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-cyan-400"
                            aria-label={`编辑仪表${field.label}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">单位</label>
                      <input
                        type="text"
                        value={selectedElement.uiComponentData?.unit ?? ''}
                        placeholder="%"
                        onChange={(e) => onUpdateElement(selectedElement.id, {
                          uiComponentData: { ...(selectedElement.uiComponentData || {}), unit: e.target.value },
                        })}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                        aria-label="编辑仪表单位"
                      />
                    </div>
                  </div>
                )}

                {selectedElement.uiComponentType === 'cyber-3d-donut-chart' && (() => {
                  const donutData = Array.isArray(selectedElement.uiComponentData?.donutData) && selectedElement.uiComponentData.donutData.length
                    ? selectedElement.uiComponentData.donutData
                    : [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }];
                  const updateDonut = (index: number, patch: Record<string, unknown>) => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), donutData: donutData.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item) } });
                  return <div className="space-y-2 border-t border-violet-400/20 pt-2" data-testid="cyber-3d-donut-inspector">
                    <div className="flex items-center justify-between"><label className="text-[10px] font-medium text-violet-200">3D 环形图</label><span className="text-[9px] text-slate-500">可调厚度与分区</span></div>
                    <label className="block text-[10px] text-slate-400">立体厚度：{Number(selectedElement.uiComponentData?.depth ?? 24)} px<input type="range" min="8" max="42" value={Math.max(8, Math.min(42, Number(selectedElement.uiComponentData?.depth ?? 24)))} onChange={(e) => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), depth: Number(e.target.value) } })} className="mt-1 w-full accent-violet-400" aria-label="3D 环形图厚度" /></label>
                    <div className="max-h-32 space-y-1 overflow-y-auto">{donutData.map((item: any, index: number) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_56px_26px] gap-1"><input value={String(item.name || '')} onChange={(e) => updateDonut(index, { name: e.target.value })} className="min-w-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" aria-label={`3D环形分区${index + 1}名称`} /><input type="number" min="0" value={Number(item.value ?? 0)} onChange={(e) => updateDonut(index, { value: Number(e.target.value) || 0 })} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" aria-label={`3D环形分区${index + 1}数值`} /><button type="button" disabled={donutData.length <= 1} onClick={() => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), donutData: donutData.filter((_: unknown, itemIndex: number) => itemIndex !== index) } })} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30" aria-label={`删除3D环形分区${index + 1}`}>×</button></div>)}</div>
                    <button type="button" onClick={() => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), donutData: [...donutData, { name: `分区${donutData.length + 1}`, value: 10 }] } })} className="rounded border border-violet-400/30 px-2 py-1 text-[10px] text-violet-200">+ 添加分区</button>
                  </div>;
                })()}

                {/* 组件颜色 */}
                {!UI_TEXT_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') && <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    {UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') ? '强调色' : '主题颜色'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(selectedElement.uiComponentData && selectedElement.uiComponentData.color) || '#06b6d4'}
                      onChange={(e) => onUpdateElement(selectedElement.id, {
                        uiComponentData: {
                          ...(selectedElement.uiComponentData || {}),
                          color: e.target.value,
                          ...(UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') ? { accentColor: e.target.value } : {}),
                        }
                      })}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                    <input
                      type="text"
                      value={(selectedElement.uiComponentData && selectedElement.uiComponentData.color) || '#06b6d4'}
                      onChange={(e) => onUpdateElement(selectedElement.id, {
                        uiComponentData: {
                          ...(selectedElement.uiComponentData || {}),
                          color: e.target.value,
                          ...(UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') ? { accentColor: e.target.value } : {}),
                        }
                      })}
                      className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>}

                {UI_CARD_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') && (
                  <div className="space-y-2 border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-cyan-200">卡片配色</label>
                      <span className="text-[9px] text-slate-500">强调 / 表面 / 文字分层</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'accentColor', label: '强调色', fallback: (selectedElement.uiComponentData && selectedElement.uiComponentData.color) || '#38bdf8' },
                        { key: 'surfaceColor', label: '卡片底色', fallback: '#111827' },
                        { key: 'borderColor', label: '边框色', fallback: (selectedElement.uiComponentData && selectedElement.uiComponentData.color) || '#38bdf8' },
                        { key: 'textColor', label: '主文字', fallback: '#f8fafc' },
                        { key: 'mutedTextColor', label: '辅助文字', fallback: '#cbd5e1' },
                      ].map((field) => {
                        const value = (selectedElement.uiComponentData && selectedElement.uiComponentData[field.key]) || field.fallback;
                        return (
                          <div key={field.key} className="min-w-0">
                            <label className="block text-[9px] text-slate-500 mb-1">{field.label}</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={value}
                                onChange={(e) => onUpdateElement(selectedElement.id, {
                                  uiComponentData: { ...(selectedElement.uiComponentData || {}), [field.key]: e.target.value }
                                })}
                                className="h-7 w-7 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent"
                                aria-label={`编辑${field.label}`}
                              />
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => onUpdateElement(selectedElement.id, {
                                  uiComponentData: { ...(selectedElement.uiComponentData || {}), [field.key]: e.target.value }
                                })}
                                className="min-w-0 flex-1 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white font-mono outline-none focus:border-cyan-400"
                                aria-label={`${field.label}色值`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 字体选择 */}
                {!UI_TEXT_COMPONENT_TYPES.has(selectedElement.uiComponentType || '') && <div>
                  <label className="block text-[10px] text-slate-400 mb-1">字体</label>
                  <FontFamilyPicker
                    value={(selectedElement.uiComponentData && selectedElement.uiComponentData.fontFamily) || ''}
                    onChange={(fontFamily) => onUpdateElement(selectedElement.id, {
                      uiComponentData: { ...(selectedElement.uiComponentData || {}), fontFamily }
                    })}
                    placeholder="系统默认"
                  />
                </div>}

                {selectedElement.uiComponentType === 'official-modao' && (
                  <OfficialModaoInspector
                    element={selectedElement}
                    onUpdateElement={onUpdateElement}
                  />
                )}
                <div className="mt-3">
                  <CustomCodeDynamicControls
                    element={selectedElement}
                    onUpdateElement={onUpdateElement}
                    title="UI组件智能控制项"
                  />
                </div>
                {selectedElement.uiComponentType === 'factory-floor' && (() => {
                  const devices = Array.isArray(selectedElement.uiComponentData?.devices) ? selectedElement.uiComponentData.devices : [];
                  const updateDevices = (next: any[]) => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), devices: next } }, '编辑工厂设备');
                  return <div className="space-y-2 border-t border-emerald-400/20 pt-2" data-testid="factory-floor-inspector">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-emerald-200">设备图层（可增删与编辑）</span><button type="button" onClick={() => updateDevices([...devices, { id: `device-${Date.now()}`, name: `设备 ${devices.length + 1}`, status: '运行', x: 65, y: 28, value: 60, unit: '件/min', color: '#3978ed' }])} className="flex items-center gap-1 rounded border border-emerald-400/30 px-2 py-1 text-[10px] text-emerald-200"><Plus size={11} /> 添加设备</button></div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">{devices.map((device: any, index: number) => <div key={device.id || index} className="space-y-1 rounded border border-white/10 bg-black/20 p-2">
                      <div className="grid grid-cols-[1fr_80px_28px] gap-1"><input value={String(device.name || '')} onChange={(e) => updateDevices(devices.map((item: any, i: number) => i === index ? { ...item, name: e.target.value } : item))} aria-label={`设备${index + 1}名称`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /><select value={String(device.status || '运行')} onChange={(e) => updateDevices(devices.map((item: any, i: number) => i === index ? { ...item, status: e.target.value } : item))} aria-label={`设备${index + 1}状态`} className="rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white"><option>运行</option><option>待机</option><option>异常</option><option>维护</option></select><button type="button" disabled={devices.length <= 1} onClick={() => updateDevices(devices.filter((_: any, i: number) => i !== index))} aria-label={`删除设备${index + 1}`} className="rounded border border-rose-400/20 text-rose-300 disabled:opacity-30"><Trash2 size={11} /></button></div>
                      <div className="grid grid-cols-4 gap-1"><label className="text-[9px] text-slate-500">X<input type="number" min="0" max="100" value={Number(device.x ?? 50)} onChange={(e) => updateDevices(devices.map((item: any, i: number) => i === index ? { ...item, x: Number(e.target.value) } : item))} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white" /></label><label className="text-[9px] text-slate-500">Y<input type="number" min="0" max="100" value={Number(device.y ?? 50)} onChange={(e) => updateDevices(devices.map((item: any, i: number) => i === index ? { ...item, y: Number(e.target.value) } : item))} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white" /></label><label className="text-[9px] text-slate-500">产能<input type="number" min="0" value={Number(device.value ?? 0)} onChange={(e) => updateDevices(devices.map((item: any, i: number) => i === index ? { ...item, value: Number(e.target.value) } : item))} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white" /></label><label className="text-[9px] text-slate-500">颜色<input type="color" value={String(device.color || '#3978ed')} onChange={(e) => updateDevices(devices.map((item: any, i: number) => i === index ? { ...item, color: e.target.value } : item))} className="mt-1 h-6 w-full rounded border border-white/10 bg-black/40" /></label></div>
                    </div>)}</div>
                    <div className="text-[9px] text-slate-500">设备点击后会在画布中显示状态、产能与单位；拖动图层外框仍可调整整个工厂图的尺寸。</div>
                  </div>;
                })()}
              </div>
            )}

            {elementInspectorTab === 'base' && selectedElement.type === 'ui-component' && !isContinuousInteractionComponent(selectedElement.uiComponentType) && (
              <div className="mt-3 border-t border-cyan-400/15 pt-3 space-y-2">
                {selectedElement.uiComponentType !== 'custom-visual' && <div className="text-[9px] text-amber-300/80">当前组件是数据图；素材引用只对自定义视觉生效。数量是上限，不会凭空生成设备数据。</div>}
                <div className="text-[10px] font-semibold text-cyan-200">项目数量与显示方式</div>
                <div className="grid grid-cols-2 gap-2"><input type="number" min="1" value={selectedElement.uiComponentData?.repeat?.maxItems ?? ''} onChange={(e) => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), repeat: { ...(selectedElement.uiComponentData?.repeat || {}), maxItems: e.target.value === '' ? undefined : Number(e.target.value) } } })} className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white" placeholder="最多显示条数" aria-label="最大显示条数" /><select value={selectedElement.uiComponentData?.repeat?.overflow || 'adaptive'} onChange={(e) => onUpdateElement(selectedElement.id, { uiComponentData: { ...(selectedElement.uiComponentData || {}), repeat: { ...(selectedElement.uiComponentData?.repeat || {}), overflow: e.target.value } } })} className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white" aria-label="超出数量处理"><option value="adaptive">自适应</option><option value="scroll">滚动</option><option value="clip">截断</option></select></div>
                <SimpleDataBindingEditor element={selectedElement} onUpdateElement={onUpdateElement} />
              </div>
            )}

            {/* Transform & Geometry */}
            <div className={`space-y-2 ${elementInspectorTab === 'base' ? '' : 'hidden'}`}>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Move size={12} className="text-sky-400" />
                <span>位置与尺寸 (TRANSFORM)</span>
              </span>

              <div className="grid grid-cols-2 gap-2">
                <ScrubbableNumberInput
                  label="X"
                  unit="%"
                  step={0.5}
                  precision={1}
                  value={animatedValues?.x ?? selectedElement.x}
                  onChange={(val) => updateAnimatable('x', val, { x: val })}
                  title="拖拽微调 X 轴坐标 (按住 Shift 加速10倍 / Alt 精细0.1倍)"
                />

                <ScrubbableNumberInput
                  label="Y"
                  unit="%"
                  step={0.5}
                  precision={1}
                  value={animatedValues?.y ?? selectedElement.y}
                  onChange={(val) => updateAnimatable('y', val, { y: val })}
                  title="拖拽微调 Y 轴坐标 (按住 Shift 加速10倍 / Alt 精细0.1倍)"
                />
                <div className="col-span-2 flex justify-end -mt-1">
                  <KeyframeActions
                    element={selectedElement}
                    property="x"
                    properties={['x', 'y']}
                    values={{ x: animatedValues?.x ?? selectedElement.x, y: animatedValues?.y ?? selectedElement.y }}
                    value={animatedValues?.x ?? selectedElement.x}
                    currentTime={currentTime}
                    onSeek={onSeek}
                    onUpdateElement={onUpdateElement}
                  />
                </div>

                <ScrubbableNumberInput
                  label="W"
                  unit="%"
                  step={0.5}
                  precision={1}
                  min={1}
                  value={animatedValues?.w ?? selectedElement.w}
                  onChange={(width) => {
                    const patch: { width: number; height?: number } = isAspectRatioResizeLocked(selectedElement.lockAspectRatio)
                      ? resizeBoundsWithAspect({
                        width,
                        height: selectedElement.h,
                        editedDimension: 'width',
                        aspectRatio: getBoundsAspectRatio(selectedElement.w, selectedElement.h, canvasSpec.width, canvasSpec.height),
                        canvasWidth: canvasSpec.width,
                        canvasHeight: canvasSpec.height,
                      })
                      : { width };
                    const nextWidth = patch.width;
                    const nextHeight = patch.height;
                    if (getPropertyTrack(selectedElement, 'w')) {
                      onUpdateElement(selectedElement.id, {
                        w: nextWidth,
                        ...(nextHeight !== undefined ? { h: nextHeight } : {}),
                        keyframes: upsertKeyframe(selectedElement, 'w', currentTime, nextWidth),
                      });
                    } else {
                      onUpdateElement(selectedElement.id, { w: nextWidth, ...(nextHeight !== undefined ? { h: nextHeight } : {}) });
                    }
                  }}
                  title="拖拽微调宽度 (按住 Shift 加速10倍 / Alt 精细0.1倍)"
                />

                <ScrubbableNumberInput
                  label="H"
                  unit="%"
                  step={0.5}
                  precision={1}
                  min={1}
                  value={animatedValues?.h ?? selectedElement.h}
                  onChange={(height) => {
                    const patch: { height: number; width?: number } = isAspectRatioResizeLocked(selectedElement.lockAspectRatio)
                      ? resizeBoundsWithAspect({
                        width: selectedElement.w,
                        height,
                        editedDimension: 'height',
                        aspectRatio: getBoundsAspectRatio(selectedElement.w, selectedElement.h, canvasSpec.width, canvasSpec.height),
                        canvasWidth: canvasSpec.width,
                        canvasHeight: canvasSpec.height,
                      })
                      : { height };
                    const nextHeight = patch.height;
                    const nextWidth = patch.width;
                    if (getPropertyTrack(selectedElement, 'h')) {
                      onUpdateElement(selectedElement.id, {
                        h: nextHeight,
                        ...(nextWidth !== undefined ? { w: nextWidth } : {}),
                        keyframes: upsertKeyframe(selectedElement, 'h', currentTime, nextHeight),
                      });
                    } else {
                      onUpdateElement(selectedElement.id, { h: nextHeight, ...(nextWidth !== undefined ? { w: nextWidth } : {}) });
                    }
                  }}
                  title="拖拽微调高度 (按住 Shift 加速10倍 / Alt 精细0.1倍)"
                />
                <div className="col-span-2 flex justify-end -mt-1">
                  <KeyframeActions
                    element={selectedElement}
                    property="w"
                    properties={['w', 'h']}
                    values={{ w: animatedValues?.w ?? selectedElement.w, h: animatedValues?.h ?? selectedElement.h }}
                    value={animatedValues?.w ?? selectedElement.w}
                    currentTime={currentTime}
                    onSeek={onSeek}
                    onUpdateElement={onUpdateElement}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                    {isAspectRatioResizeLocked(selectedElement.lockAspectRatio) ? <Lock size={11} className="text-sky-400" /> : <Unlock size={11} className="text-slate-500" />}
                    <span>等比例缩放</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAspectRatioResizeLocked(selectedElement.lockAspectRatio)}
                    aria-label="等比例缩放"
                    title="控制拖拽缩放时是否保持宽高比"
                    onClick={() => onUpdateElement(selectedElement.id, { lockAspectRatio: !isAspectRatioResizeLocked(selectedElement.lockAspectRatio) })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${isAspectRatioResizeLocked(selectedElement.lockAspectRatio) ? 'bg-sky-500' : 'bg-white/15'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isAspectRatioResizeLocked(selectedElement.lockAspectRatio) ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div>
                  <ScrubbableNumberInput
                    label="旋转"
                    unit="°"
                    step={1}
                    precision={0}
                    value={animatedValues?.rot ?? (selectedElement.rot || 0)}
                    onChange={(val) => updateAnimatable('rot', val, { rot: val })}
                    title="拖拽微调旋转角度 (按住 Shift 加速10倍 / Alt 精细0.1倍)"
                  />
                  <KeyframeActions element={selectedElement} property="rot" value={animatedValues?.rot ?? (selectedElement.rot || 0)} currentTime={currentTime} onSeek={onSeek} onUpdateElement={onUpdateElement} />
                </div>

                <ScrubbableNumberInput
                  label="层级"
                  step={1}
                  precision={0}
                  value={selectedElement.zIndex}
                  onChange={(val) => onUpdateElement(selectedElement.id, { zIndex: Math.round(val) || 1 })}
                  title="拖拽微调图层层级深度 Z-Index"
                />
              </div>
            </div>

            {/* Appearance & FX */}
            <div className={`border-t border-white/10 pt-3 space-y-2 ${elementInspectorTab === 'base' ? '' : 'hidden'}`}>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette size={12} className="text-emerald-400" />
                <span>外观与滤镜 (APPEARANCE)</span>
              </span>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400">不透明度 (Opacity)</label>
                  <span className="text-[10px] font-mono text-slate-400">{animatedValues?.opacity ?? (selectedElement.opacity ?? 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={animatedValues?.opacity ?? (selectedElement.opacity ?? 100)}
                  onChange={(e) => updateAnimatable('opacity', parseInt(e.target.value) || 0, { opacity: parseInt(e.target.value) || 0 })}
                  className="w-full accent-sky-500"
                />
                <KeyframeActions element={selectedElement} property="opacity" value={animatedValues?.opacity ?? (selectedElement.opacity ?? 100)} currentTime={currentTime} onSeek={onSeek} onUpdateElement={onUpdateElement} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">混合模式 (Blend)</label>
                  <select
                    value={selectedElement.blendMode || 'normal'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { blendMode: e.target.value as BlendMode })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="normal">正常 (Normal)</option>
                    <option value="screen">滤色发光 (Screen)</option>
                    <option value="multiply">正片叠底 (Multiply)</option>
                    <option value="overlay">叠加 (Overlay)</option>
                    <option value="lighten">变亮 (Lighten)</option>
                    <option value="color-dodge">颜色减淡 (Color Dodge)</option>
                  </select>
                </div>

                <ScrubbableNumberInput
                  label="圆角"
                  unit="px"
                  min={0}
                  max={100}
                  step={1}
                  precision={0}
                  value={selectedElement.borderRadius || 0}
                  onChange={(val) => onUpdateElement(selectedElement.id, { borderRadius: Math.max(0, Math.round(val)) })}
                  title="拖拽微调圆角半径 (按住 Shift 加速10倍 / Alt 精细0.1倍)"
                />
              </div>

              {/* Replace Media button for images and videos */}
              {(selectedElement.type === 'img' || selectedElement.type === 'vid' || selectedElement.type === 'panorama-img' || selectedElement.type === 'panorama-vid') && (
                <button
                  type="button"
                  onClick={() => mediaReplaceInputRef.current?.click()}
                  className="w-full py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/15 rounded text-[11px] text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={11} />
                  <span>替换{selectedElement.type === 'img' ? '图片' : selectedElement.type === 'vid' ? '视频' : selectedElement.type === 'panorama-img' ? '全景图' : '全景视频'}素材...</span>
                </button>
              )}

              {/* 全景图 / 全景视频 属性控制（可折叠） */}
              {(selectedElement.type === 'vid' || selectedElement.type === 'panorama-vid') && (
                <div className="mt-2 space-y-2 rounded border border-sky-400/20 bg-sky-400/5 p-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-200"><Video size={12} /> 视频播放器</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[10px] text-slate-400"><span>播放器样式</span><select value={selectedElement.videoPlayerStyle || 'none'} onChange={(e) => onUpdateElement(selectedElement.id, { videoPlayerStyle: e.target.value as SceneElement['videoPlayerStyle'], videoPlayerCustomized: true })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white"><option value="none">无边框（默认）</option><option value="minimal">极简蓝</option><option value="classic">经典黑</option><option value="cinema">影院粉</option></select></label>
                    <label className="flex items-end gap-1.5 pb-1 text-[10px] text-slate-300"><input type="checkbox" checked={selectedElement.videoControls === true} onChange={(e) => onUpdateElement(selectedElement.id, { videoControls: e.target.checked, videoPlayerCustomized: true })} />显示播放/音量控件</label>
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-300"><input type="checkbox" checked={selectedElement.muted === true} onChange={(e) => onUpdateElement(selectedElement.id, { muted: e.target.checked })} />静音（关闭后可调节音量）</label>
                </div>
              )}
              {(selectedElement.type === 'panorama-img' || selectedElement.type === 'panorama-vid') && (
                <div className="border-t border-white/10 pt-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection('el-pano')}
                    className="w-full flex items-center justify-between group"
                  >
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass size={12} className="text-teal-400" />
                      <span>全景设置 (PANORAMA)</span>
                    </span>
                    <ChevronDown size={12} className={`transition-transform ${collapsedSections['el-pano'] ? '' : 'rotate-180'} text-slate-500 group-hover:text-slate-300`} />
                  </button>
                  <div className={`pt-2.5 space-y-2.5 ${collapsedSections['el-pano'] ? 'hidden' : ''}`}>

                  {/* FOV 视角 */}
                  <div>
                    <label className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>视角 FOV</span>
                      <span className="text-slate-300 font-mono">{selectedElement.panoramaFov || 75}°</span>
                    </label>
                    <input
                      type="range"
                      min={30}
                      max={120}
                      value={selectedElement.panoramaFov || 75}
                      onChange={(e) => onUpdateElement(selectedElement.id, { panoramaFov: Number(e.target.value) })}
                      className="w-full accent-teal-500"
                    />
                  </div>

                  {/* 自动旋转开关 */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">自动旋转</span>
                    <button
                      type="button"
                      onClick={() => onUpdateElement(selectedElement.id, { panoramaAutoRotate: !selectedElement.panoramaAutoRotate })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${selectedElement.panoramaAutoRotate ? 'bg-teal-500' : 'bg-white/15'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedElement.panoramaAutoRotate ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* 自动旋转速度 */}
                  {selectedElement.panoramaAutoRotate && (
                    <div>
                      <label className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>旋转速度</span>
                        <span className="text-slate-300 font-mono">{selectedElement.panoramaAutoRotateSpeed || 1}x</span>
                      </label>
                      <input
                        type="range"
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={selectedElement.panoramaAutoRotateSpeed || 1}
                        onChange={(e) => onUpdateElement(selectedElement.id, { panoramaAutoRotateSpeed: Number(e.target.value) })}
                        className="w-full accent-teal-500"
                      />
                    </div>
                  )}

                  <div className="text-[9px] text-slate-500 leading-relaxed bg-white/5 rounded p-2">
                    提示：预览模式下拖动旋转视角，滚轮缩放。建议使用 2:1 等距柱状投影素材。
                  </div>
                  </div>
                </div>
              )}
            </div>

            {/* Type Specific: TEXT */}
            {elementInspectorTab === 'base' && supportsTypography && (
              <div className="border-t border-white/10 pt-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Type size={12} className="text-sky-400" />
                  <span>文字排版 (TYPOGRAPHY)</span>
                </span>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">文字内容</label>
                  <textarea
                    value={selectedElement.type === 'custom-code' && selectedElement.customCode ? getPrimaryCustomCodeText(selectedElement.customCode.html) : (selectedElement.content || '')}
                    onChange={(e) => {
                      if (selectedElement.type === 'custom-code' && selectedElement.customCode) {
                        onUpdateElement(selectedElement.id, {
                          content: e.target.value,
                          customCode: {
                            ...selectedElement.customCode,
                            html: replacePrimaryCustomCodeText(selectedElement.customCode.html, e.target.value),
                            version: selectedElement.customCode.version + 1,
                            updatedAt: new Date().toISOString(),
                          },
                        });
                        return;
                      }
                      onUpdateElement(selectedElement.id, { content: e.target.value });
                    }}
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-xs text-white outline-none focus:border-sky-500 font-sans"
                  />
                </div>

                <TextStyleControls element={selectedElement} onUpdateElement={onUpdateElement} />
              </div>
            )}

            {/* Type Specific: SHAPE / INTERACTIVE CARD */}
            {elementInspectorTab === 'base' && selectedElement.type === 'shape' && (
              <ShapeInspector
                element={selectedElement}
                onUpdateElement={onUpdateElement}
              />
            )}

            {/* Type Specific: SABER LIGHT EFFECT */}
            {elementInspectorTab === 'base' && selectedElement.type === 'saber' && (
              <SaberInspector
                element={selectedElement}
                onUpdateElement={onUpdateElement}
                onOpenDrawMode={onOpenDrawMode}
                currentTime={currentTime}
                onSeek={onSeek}
              />
            )}

            {/* Type Specific: VFX MOTION（科技简约动效库） */}
            {elementInspectorTab === 'base' && selectedElement.type === 'vfx' && (
              <React.Suspense fallback={null}>
                <VfxInspector
                  element={selectedElement}
                  onUpdateElement={onUpdateElement}
                />
              </React.Suspense>
            )}

            {/* Layer interaction feedback effects: independent from navigation/popups. */}
            {elementInspectorTab === 'effects' && (
              <div className="space-y-3 rounded-lg border border-sky-400/20 bg-sky-950/20 p-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-sky-300" />
                  <span className="text-[11px] font-bold text-sky-200">交互特效</span>
                </div>
                <p className="text-[10px] leading-4 text-slate-500">
                  编辑态可预演视觉效果，但不会执行跳转、弹窗或变量修改；按 E 后才执行真实交互。
                </p>
                <label className="block space-y-1 text-[10px] text-slate-400">
                  <span>效果</span>
                  <select
                    value={selectedElement.interactionEffect || 'none'}
                    onChange={(e) => onUpdateElement(selectedElement.id, {
                      interactionEffect: e.target.value as SceneElement['interactionEffect'],
                    })}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="none">无 (None)</option>
                    <optgroup label="瞬时反馈 (Feedback)">
                      <option value="press-spring">弹性按压 (Press Spring)</option>
                      <option value="focus-halo">聚焦光晕 (Focus Halo)</option>
                      <option value="edge-scan">边缘扫描 (Edge Scan)</option>
                      <option value="blur">高斯模糊 (Gaussian Blur)</option>
                      <option value="chromatic-ripple">波纹色差 (Chromatic Ripple)</option>
                      <option value="liquid-droplet">液态水珠 (Liquid Droplet)</option>
                      <option value="glass-refraction">玻璃折射 (Glass Refraction)</option>
                      <option value="depth-of-field">局部景深 (Depth of Field)</option>
                    </optgroup>
                    <optgroup label="循环氛围 (Loop)">
                      <option value="loop-pulse">脉动 (Pulse)</option>
                      <option value="loop-float">漂浮 (Float)</option>
                      <option value="loop-spin">旋转 (Spin)</option>
                      <option value="loop-shimmer">流光 (Shimmer)</option>
                      <option value="loop-breathe">呼吸 (Breathe)</option>
                      <option value="loop-swing">摇摆 (Swing)</option>
                      <option value="loop-shake">抖动 (Shake)</option>
                      <option value="loop-heartbeat">心跳 (Heartbeat)</option>
                      <option value="loop-blink">闪烁 (Blink)</option>
                      <option value="loop-wave">波浪浮动 (Wave)</option>
                      <option value="loop-neon-pulse">霓虹脉动 (Neon Pulse)</option>
                      <option value="loop-data-flow">数据流动 (Data Flow)</option>
                      <option value="loop-hologram-flicker">全息闪烁 (Hologram Flicker)</option>
                      <option value="loop-orbit-spin">轨道旋转 (Orbit Spin)</option>
                    </optgroup>
                  </select>
                </label>
                {selectedElement.interactionEffect && selectedElement.interactionEffect !== 'none' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-[10px] text-slate-400">
                        <span>触发方式</span>
                        <select
                          value={selectedElement.interactionEffectTrigger || 'click'}
                          onChange={(e) => onUpdateElement(selectedElement.id, { interactionEffectTrigger: e.target.value as InteractionEffectTrigger })}
                          className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white"
                        >
                          <option value="default">默认效果 (Always On)</option>
                          <option value="click">左键 / 点击 (Click)</option>
                          <option value="hover">鼠标悬停 (Hover)</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-[10px] text-slate-400">
                        <span>{selectedElement.interactionEffect.startsWith('loop-') ? '循环周期 (ms)' : selectedElement.interactionEffect === 'press-spring' ? '按压时长 (ms)' : '持续时间 (ms)'}</span>
                        <input
                          type="number"
                          min="120"
                          max="3000"
                          step="20"
                          value={selectedElement.interactionEffectDuration ?? 650}
                          onChange={(e) => onUpdateElement(selectedElement.id, { interactionEffectDuration: Math.max(120, Math.min(3000, Number(e.target.value) || 650)) })}
                          className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] font-mono text-white"
                        />
                      </label>
                    </div>
                    <label className="block space-y-1 text-[10px] text-slate-400">
                      <span className="flex items-center justify-between">
                        <span>{selectedElement.interactionEffect.startsWith('loop-') ? '循环强度' : selectedElement.interactionEffect === 'press-spring' ? '按压强度' : selectedElement.interactionEffect === 'focus-halo' ? '光晕强度' : selectedElement.interactionEffect === 'edge-scan' ? '扫描强度' : selectedElement.interactionEffect === 'blur' ? '模糊强度' : selectedElement.interactionEffect === 'chromatic-ripple' ? '色差强度' : selectedElement.interactionEffect === 'liquid-droplet' ? '水珠强度' : selectedElement.interactionEffect === 'glass-refraction' ? '折射强度' : '景深强度'}</span>
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={selectedElement.interactionEffectIntensity ?? 50}
                            onChange={(e) => onUpdateElement(selectedElement.id, { interactionEffectIntensity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                            className="w-12 rounded border border-white/10 bg-black/40 px-1.5 py-1 text-right font-mono text-[10px] text-white"
                            aria-label="特效强度"
                          />
                          <span>%</span>
                        </span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedElement.interactionEffectIntensity ?? 50}
                        onChange={(e) => onUpdateElement(selectedElement.id, { interactionEffectIntensity: Number(e.target.value) })}
                        className="h-1 w-full cursor-pointer accent-sky-400"
                      />
                    </label>
                    {['focus-halo', 'liquid-droplet', 'glass-refraction', 'depth-of-field'].includes(selectedElement.interactionEffect || '') && (
                      <label className="block space-y-1 text-[10px] text-slate-400">
                        <span className="flex items-center justify-between">
                          <span>{selectedElement.interactionEffect === 'focus-halo' ? '光晕范围' : selectedElement.interactionEffect === 'liquid-droplet' ? '水珠范围' : selectedElement.interactionEffect === 'glass-refraction' ? '折射范围' : '焦点范围'}</span>
                          <span className="font-mono text-slate-300">{selectedElement.interactionEffectRadius ?? 70}%</span>
                        </span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={selectedElement.interactionEffectRadius ?? 70}
                          onChange={(e) => onUpdateElement(selectedElement.id, { interactionEffectRadius: Number(e.target.value) })}
                          className="h-1 w-full cursor-pointer accent-sky-400"
                        />
                      </label>
                    )}
                    {['chromatic-ripple', 'focus-halo', 'edge-scan', 'liquid-droplet', 'glass-refraction', 'loop-data-flow', 'loop-hologram-flicker'].includes(selectedElement.interactionEffect || '') && (
                      <label className="flex items-center gap-2 text-[10px] text-slate-400">
                        <input
                          type="color"
                          value={selectedElement.interactionEffectColor || '#38bdf8'}
                          onChange={(e) => onUpdateElement(selectedElement.id, { interactionEffectColor: e.target.value })}
                          className="h-7 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                          aria-label="特效颜色"
                        />
                        <span>{selectedElement.interactionEffect === 'chromatic-ripple' ? '波纹主色' : selectedElement.interactionEffect === 'focus-halo' ? '光晕主色' : selectedElement.interactionEffect === 'edge-scan' ? '扫描主色' : selectedElement.interactionEffect === 'liquid-droplet' ? '水珠高光' : selectedElement.interactionEffect === 'loop-data-flow' ? '轨迹主色' : selectedElement.interactionEffect === 'loop-hologram-flicker' ? '全息主色' : '玻璃色调'}</span>
                        <code className="ml-auto font-mono text-slate-300">{selectedElement.interactionEffectColor || '#38bdf8'}</code>
                      </label>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Type Specific: AI 3D 模型（分层/爆炸/碰撞控制） */}
            {elementInspectorTab === 'effects' && (
              <div className="space-y-3 rounded-lg border border-violet-400/20 bg-violet-950/15 p-3">
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-violet-100">蒙版</span><label className="flex items-center gap-1.5 text-[10px] text-slate-400"><input type="checkbox" checked={selectedElement.maskEnabled === true} onChange={(e) => { const enabling = e.target.checked; const hasFullCanvasDefaults = (selectedElement.maskX ?? 0) === 0 && (selectedElement.maskY ?? 0) === 0 && (selectedElement.maskWidth ?? 100) === 100 && (selectedElement.maskHeight ?? 100) === 100; onUpdateElement(selectedElement.id, { maskEnabled: enabling, ...(enabling && hasFullCanvasDefaults ? { maskX: 10, maskY: 10, maskWidth: 80, maskHeight: 80 } : {}) }, '切换图层蒙版'); }} className="accent-violet-400" />启用</label></div>
                <div className="flex items-center justify-between gap-2 rounded border border-violet-300/20 bg-violet-400/[0.06] px-2 py-1.5">
                  <span className="text-[10px] leading-4 text-slate-400">直接在画布拖动蒙版边界，或绘制自定义路径</span>
                  <button type="button" onClick={() => onOpenMaskPenMode?.()} className="shrink-0 rounded border border-violet-300/40 bg-violet-400/15 px-2 py-1 text-[10px] font-medium text-violet-100 transition hover:border-violet-200/70 hover:bg-violet-400/25" title="在画布绘制钢笔蒙版">钢笔绘制</button>
                </div>
                <div className="flex items-center justify-end"><button type="button" onClick={() => onUpdateElement(selectedElement.id, { maskEnabled: false, maskType: 'rectangle', maskX: 0, maskY: 0, maskWidth: 100, maskHeight: 100, maskRadius: 0, maskFeather: 0, maskInvert: false, maskSourceElementId: undefined, maskNodes: [], keyframes: clearKeyframeProperties(selectedElement, MASK_ANIMATED_PROPERTIES) }, '重置蒙版')} className="rounded border border-rose-300/30 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-200 transition hover:border-rose-200/60 hover:bg-rose-400/20" title="清除蒙版选区并恢复整层显示">一键重置蒙版</button></div>
                <div className="grid grid-cols-3 gap-1.5">{([['rectangle','矩形'],['ellipse','椭圆'],['rounded','圆角'],['diamond','菱形'],['hexagon','六边形'],['pen','钢笔路径']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={(selectedElement.maskType || 'rectangle') === value} onClick={() => onUpdateElement(selectedElement.id, { maskType: value, maskEnabled: true }, '设置蒙版形状')} className={`rounded border px-1.5 py-1.5 text-[10px] ${(selectedElement.maskType || 'rectangle') === value ? 'border-violet-400/70 bg-violet-500/25 text-violet-100' : 'border-white/10 bg-black/20 text-slate-400'}`}>{label}</button>)}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded border border-white/10 bg-black/20 p-2">
                  {([['maskX', 'X', 10], ['maskY', 'Y', 10], ['maskWidth', '宽度', 80], ['maskHeight', '高度', 80]] as const).map(([property, label, fallback]) => (
                    <AnimatedNumericField
                      key={property}
                      element={selectedElement}
                      property={property}
                      label={`${label} (%)`}
                      value={evaluateAnimatedProperty(selectedElement, property, currentTime, Number(selectedElement[property] ?? fallback))}
                      currentTime={currentTime}
                      step={0.1}
                      min={property === 'maskWidth' || property === 'maskHeight' ? 1 : 0}
                      max={100}
                      onSeek={onSeek}
                      onChange={(value) => {
                        const next = Math.max(property === 'maskWidth' || property === 'maskHeight' ? 1 : 0, Math.min(100, Number(value) || 0));
                        updateAnimatable(property, next, { [property]: next } as Partial<SceneElement>, false);
                      }}
                      onCommitChange={(value) => {
                        const next = Math.max(property === 'maskWidth' || property === 'maskHeight' ? 1 : 0, Math.min(100, Number(value) || 0));
                        updateAnimatable(property, next, { [property]: next } as Partial<SceneElement>, true);
                      }}
                      onUpdateElement={onUpdateElement}
                       showKeyframe={property === 'maskY' || property === 'maskHeight'}
                       keyframeProperties={property === 'maskX' || property === 'maskY' ? ['maskX', 'maskY'] : ['maskWidth', 'maskHeight']}
                       keyframeValues={property === 'maskX' || property === 'maskY'
                         ? {
                           maskX: evaluateAnimatedProperty(selectedElement, 'maskX', currentTime, selectedElement.maskX ?? 10),
                           maskY: evaluateAnimatedProperty(selectedElement, 'maskY', currentTime, selectedElement.maskY ?? 10),
                         }
                         : {
                           maskWidth: evaluateAnimatedProperty(selectedElement, 'maskWidth', currentTime, selectedElement.maskWidth ?? 80),
                           maskHeight: evaluateAnimatedProperty(selectedElement, 'maskHeight', currentTime, selectedElement.maskHeight ?? 80),
                         }}
                    />
                  ))}
                  {(selectedElement.maskType || 'rectangle') === 'rounded' && (
                    <AnimatedNumericField
                      element={selectedElement}
                      property="maskRadius"
                      label="圆角 (%)"
                      value={evaluateAnimatedProperty(selectedElement, 'maskRadius', currentTime, selectedElement.maskRadius ?? 12)}
                      currentTime={currentTime}
                      step={1}
                      min={0}
                      max={50}
                      onSeek={onSeek}
                      onChange={(value) => { const next = Math.max(0, Math.min(50, Number(value) || 0)); updateAnimatable('maskRadius', next, { maskRadius: next }, false); }}
                      onCommitChange={(value) => { const next = Math.max(0, Math.min(50, Number(value) || 0)); updateAnimatable('maskRadius', next, { maskRadius: next }, true); }}
                      onUpdateElement={onUpdateElement}
                    />
                  )}
                  <AnimatedNumericField
                    element={selectedElement}
                    property="maskFeather"
                    label="羽化 (px)"
                    value={evaluateAnimatedProperty(selectedElement, 'maskFeather', currentTime, selectedElement.maskFeather ?? 0)}
                    currentTime={currentTime}
                    step={1}
                    min={0}
                    max={40}
                    onSeek={onSeek}
                    onChange={(value) => { const next = Math.max(0, Math.min(40, Number(value) || 0)); updateAnimatable('maskFeather', next, { maskFeather: next }, false); }}
                    onCommitChange={(value) => { const next = Math.max(0, Math.min(40, Number(value) || 0)); updateAnimatable('maskFeather', next, { maskFeather: next }, true); }}
                    onUpdateElement={onUpdateElement}
                  />
                </div>
                <label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={selectedElement.maskInvert === true} onChange={(e) => onUpdateElement(selectedElement.id, { maskInvert: e.target.checked })} className="accent-violet-400" />反选蒙版区域</label>
                {(selectedElement.maskType || 'rectangle') === 'pen' && <div className="space-y-2 rounded border border-white/10 bg-black/20 p-2"><select value={selectedElement.maskSourceElementId || selectedElement.id} onChange={(e) => { const source = activeScene?.els.find((item) => item.id === e.target.value); onUpdateElement(selectedElement.id, { maskSourceElementId: e.target.value, maskNodes: (source?.saberNodes || []).map((node) => ({ x: node.x, y: node.y })) }); }} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white"><option value={selectedElement.id}>当前图层钢笔路径</option>{(activeScene?.els || []).filter((item) => item.id !== selectedElement.id && Array.isArray(item.saberNodes) && item.saberNodes.length >= 3).map((item) => <option key={item.id} value={item.id}>{item.sourceName || item.id}（钢笔）</option>)}</select><button type="button" onClick={() => onUpdateElement(selectedElement.id, { maskEnabled: true, maskType: 'pen', maskSourceElementId: selectedElement.id, maskNodes: (selectedElement.saberNodes || []).map((node) => ({ x: node.x, y: node.y })) }, '使用当前钢笔路径')} className="w-full rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1.5 text-[10px] text-violet-200">使用当前图层钢笔路径</button></div>}
              </div>
            )}

            {elementInspectorTab === 'effects' && selectedElement.type === 'txt' && (
              <div className="space-y-3 rounded-lg border border-fuchsia-400/20 bg-fuchsia-950/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Palette size={12} className="text-fuchsia-300" />
                    <span className="text-[11px] font-bold text-fuchsia-100">文字样式</span>
                  </div>
                  <span className="rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] text-slate-500">来自附件样式</span>
                </div>
                <p className="text-[10px] leading-4 text-slate-500">
                  仅改变当前文字图层外观；内容、字体和字号仍在“基础”页签编辑。
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TEXT_STYLE_PRESETS.map((preset) => {
                    const activePreset = (selectedElement.textStylePreset || 'none') === preset.id;
                    const previewStyle = preset.id === 'none' ? undefined : getTextStylePresetStyle(preset.id, 0.82);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.sourceTitle ? `${preset.title} · ${preset.sourceTitle}` : preset.title}
                        aria-pressed={activePreset}
                        onClick={() => onUpdateElement(selectedElement.id, { textStylePreset: preset.id === 'none' ? undefined : preset.id })}
                        className={`group relative flex h-14 flex-col items-center justify-center rounded-lg border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                          activePreset
                            ? 'border-cyan-300 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,.35),0_0_18px_rgba(34,211,238,.18)]'
                            : 'border-white/10 bg-white/[0.075] hover:border-white/25 hover:bg-white/[0.11]'
                        }`}
                      >
                        {preset.id === 'none' ? (
                          <span className="relative h-7 w-7 rounded-full border-2 border-slate-400/75 before:absolute before:left-1/2 before:top-1/2 before:h-0.5 before:w-8 before:-translate-x-1/2 before:-translate-y-1/2 before:-rotate-45 before:rounded-full before:bg-slate-400/80" />
                        ) : (
                          <span
                            className="block text-[28px] leading-none"
                            style={{
                              fontFamily: selectedElement.fontFamily || 'Arial Black, Impact, sans-serif',
                              fontWeight: 900,
                              color: preset.accent,
                              ...previewStyle,
                            }}
                          >
                            T
                          </span>
                        )}
                        <span className="mt-1 max-w-full truncate px-1 text-[9px] text-slate-400 group-hover:text-slate-200">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {false && elementInspectorTab === 'effects' && (
              <div className="mt-3 space-y-2 rounded-lg border border-violet-400/20 bg-violet-950/20 p-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-violet-300" />
                  <span className="text-[11px] font-bold text-violet-200">循环动画</span>
                </div>
                <label className="block space-y-1 text-[10px] text-slate-400">
                  <span>效果</span>
                  <select
                    value={selectedElement.loopAnim || 'none'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { loopAnim: e.target.value as LoopAnimType })}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="none">无 (None)</option>
                    <option value="pulse">脉动 (Pulse)</option>
                    <option value="float">漂浮 (Float)</option>
                    <option value="spin">旋转 (Spin)</option>
                    <option value="shimmer">流光 (Shimmer)</option>
                    <option value="breathe">呼吸 (Breathe)</option>
                    <option value="swing">摇摆 (Swing)</option>
                    <option value="shake">抖动 (Shake)</option>
                    <option value="heartbeat">心跳 (Heartbeat)</option>
                    <option value="blink">闪烁 (Blink)</option>
                    <option value="wave">波浪浮动 (Wave)</option>
                    <option value="neon-pulse">霓虹脉动 (Neon Pulse)</option>
                    <option value="data-flow">数据流动 (Data Flow)</option>
                    <option value="hologram-flicker">全息闪烁 (Hologram Flicker)</option>
                    <option value="orbit-spin">轨道旋转 (Orbit Spin)</option>
                  </select>
                </label>
                <label className="block space-y-1 text-[10px] text-slate-400">
                  <span className="flex items-center justify-between"><span>循环速度</span><span className="font-mono text-violet-200">{selectedElement.loopAnimSpeed ?? 1}x</span></span>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={selectedElement.loopAnimSpeed ?? 1}
                    onChange={(e) => onUpdateElement(selectedElement.id, { loopAnimSpeed: Math.max(0.1, Number(e.target.value) || 1) })}
                    disabled={!selectedElement.loopAnim || selectedElement.loopAnim === 'none'}
                    className="h-1 w-full cursor-pointer accent-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </label>
              </div>
            )}

            {elementInspectorTab === 'effects' && selectedElement.type === 'model-3d' && (
              <div className="p-3 bg-gradient-to-br from-cyan-950/40 to-purple-950/40 rounded-xl border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Box size={13} className="text-cyan-400" />
                    <span className="text-[11px] font-bold text-cyan-300">3D 动效控制</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateElement(selectedElement.id, {
                      ai3dLayers: 0,
                      ai3dExplode: 0,
                      ai3dPhysics: false,
                      ai3dLoopEnabled: true,
                      modelViewAzimuth: 0,
                      modelViewElevation: 0,
                      modelCameraDistance: 0,
                      modelScale: 1,
                      ai3dLayerDirection: 'up',
                      ai3dLayerDistance: 1,
                      ai3dExplodeDirection: 'radial',
                      ai3dExplodeDistance: 1,
                      ai3dExplodeSpeed: 1,
                      ai3dExplodeSpin: 0.5,
                      ai3dCollisionDirection: 'radial',
                      ai3dCollisionDistance: 1,
                      ai3dCollisionBounce: 0.5,
                      ai3dCollisionSpeed: 1,
                    })}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] transition-colors"
                    title="重置动效与展示视角"
                  >
                    <RefreshCw size={10} /> 重置
                  </button>
                </div>

                {/* 展示姿态：与画布内 OrbitControls 双向同步并保存到工程 */}
                <div className="space-y-2 rounded-lg bg-black/20 p-2 border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <Camera size={11} className="text-sky-300" />
                    <span className="text-[10px] font-semibold text-slate-200">展示视角</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      ['正面', 0, 0], ['右侧', 90, 0], ['背面', 180, 0], ['顶部', 0, 80], ['等距', 45, 28],
                    ].map(([label, azimuth, elevation]) => (
                      <button
                        key={label as string}
                        type="button"
                        onClick={() => onUpdateElement(selectedElement.id, {
                          modelViewAzimuth: azimuth as number,
                          modelViewElevation: elevation as number,
                        })}
                        className="min-w-0 rounded bg-white/5 px-1 py-1.5 text-[9px] text-slate-300 hover:bg-sky-400/20 hover:text-sky-100 transition-colors"
                        title={`切换至${label}视角`}
                      >
                        {label as string}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[10px] text-slate-400">
                      水平 {Math.round(selectedElement.modelViewAzimuth ?? 0)}°
                      <input type="range" min={-180} max={180} step={1} value={selectedElement.modelViewAzimuth ?? 0}
                        onChange={(e) => onUpdateElement(selectedElement.id, { modelViewAzimuth: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                    <label className="space-y-1 text-[10px] text-slate-400">
                      俯仰 {Math.round(selectedElement.modelViewElevation ?? 0)}°
                      <input type="range" min={-80} max={80} step={1} value={selectedElement.modelViewElevation ?? 0}
                        onChange={(e) => onUpdateElement(selectedElement.id, { modelViewElevation: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[10px] text-slate-400">
                      距离 {(selectedElement.modelCameraDistance && selectedElement.modelCameraDistance > 0 ? selectedElement.modelCameraDistance : 6).toFixed(1)}
                      <input type="range" min={0.5} max={50} step={0.1}
                        value={selectedElement.modelCameraDistance && selectedElement.modelCameraDistance > 0 ? selectedElement.modelCameraDistance : 6}
                        onChange={(e) => onUpdateElement(selectedElement.id, { modelCameraDistance: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                    <label className="space-y-1 text-[10px] text-slate-400">
                      缩放 {(selectedElement.modelScale ?? 1).toFixed(1)}x
                      <input type="range" min={0.3} max={3} step={0.1} value={selectedElement.modelScale ?? 1}
                        onChange={(e) => onUpdateElement(selectedElement.id, { modelScale: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">自动旋转</span>
                    <button
                      type="button"
                      onClick={() => onUpdateElement(selectedElement.id, { modelAutoRotate: !selectedElement.modelAutoRotate })}
                      aria-label="切换自动旋转"
                      aria-pressed={!!selectedElement.modelAutoRotate}
                      className={`relative h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${selectedElement.modelAutoRotate ? 'bg-sky-500' : 'bg-white/15'}`}
                      title="切换自动旋转"
                    >
                      <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${selectedElement.modelAutoRotate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <label className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[10px] text-slate-400">
                    <span>速度</span>
                    <input type="range" min={0.2} max={3} step={0.1} value={selectedElement.modelAutoRotateSpeed ?? 1}
                      onChange={(e) => onUpdateElement(selectedElement.id, { modelAutoRotateSpeed: Number(e.target.value) })}
                      className="min-w-0 w-full h-1 accent-sky-400" aria-label="自动旋转速度" />
                    <output className="w-7 text-right font-mono text-sky-200">{(selectedElement.modelAutoRotateSpeed ?? 1).toFixed(1)}x</output>
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-300">循环动画</span>
                    <span className="block text-[9px] text-slate-500">控制爆炸与碰撞的循环</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateElement(selectedElement.id, { ai3dLoopEnabled: selectedElement.ai3dLoopEnabled === false })}
                    aria-label="切换 3D 循环动画"
                    aria-pressed={selectedElement.ai3dLoopEnabled !== false}
                    className={`relative h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${selectedElement.ai3dLoopEnabled !== false ? 'bg-cyan-500' : 'bg-white/15'}`}
                  >
                    <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${selectedElement.ai3dLoopEnabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* 分层展开 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers size={11} className="text-cyan-400" />
                      <span className="text-[10px] font-semibold text-slate-300">分层展开</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                      {Math.round((selectedElement.ai3dLayers || 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedElement.ai3dLayers || 0}
                    onChange={(e) => onUpdateElement(selectedElement.id, { ai3dLayers: parseFloat(e.target.value), ai3dExplode: 0, ai3dPhysics: false })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400"
                    style={{
                      background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${(selectedElement.ai3dLayers || 0) * 100}%, rgba(255,255,255,0.15) ${(selectedElement.ai3dLayers || 0) * 100}%, rgba(255,255,255,0.15) 100%)`,
                    }}
                  />
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <select value={selectedElement.ai3dLayerDirection || 'up'} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dLayerDirection: e.target.value as SceneElement['ai3dLayerDirection'] })} className="min-w-0 rounded bg-black/30 border border-white/10 px-1.5 py-1 text-[10px] text-slate-300" aria-label="分层方向">
                      {['up:上', 'down:下', 'left:左', 'right:右', 'front:前', 'back:后', 'radial:径向'].map((item) => { const [value, label] = item.split(':'); return <option key={value} value={value}>方向：{label}</option>; })}
                    </select>
                    <label className="text-[10px] text-slate-400 whitespace-nowrap">距离 {Math.round((selectedElement.ai3dLayerDistance ?? 1) * 100)}%
                      <input type="range" min={0} max={2} step={0.05} value={selectedElement.ai3dLayerDistance ?? 1} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dLayerDistance: Number(e.target.value) })} className="ml-1 w-14 h-1 align-middle accent-cyan-400" aria-label="分层距离" />
                    </label>
                  </div>
                  {renderAi3DActionControls('layers', '分层', 'cyan')}
                </div>

                {/* 爆炸飞散 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={11} className="text-orange-400" />
                      <span className="text-[10px] font-semibold text-slate-300">爆炸飞散</span>
                    </div>
                    <span className="text-[10px] font-mono text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded">
                      {Math.round((selectedElement.ai3dExplode || 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedElement.ai3dExplode || 0}
                    onChange={(e) => onUpdateElement(selectedElement.id, { ai3dExplode: parseFloat(e.target.value), ai3dLayers: 0, ai3dPhysics: false })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-orange-400"
                    style={{
                      background: `linear-gradient(to right, #fb923c 0%, #fb923c ${(selectedElement.ai3dExplode || 0) * 100}%, rgba(255,255,255,0.15) ${(selectedElement.ai3dExplode || 0) * 100}%, rgba(255,255,255,0.15) 100%)`,
                    }}
                  />
                  <p className="text-[10px] text-orange-200/70">以模型中心为原点向外飞散</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-slate-400">范围 {Math.round((selectedElement.ai3dExplodeDistance ?? 1) * 100)}%
                      <input type="range" min={0} max={2} step={0.05} value={selectedElement.ai3dExplodeDistance ?? 1} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dExplodeDistance: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-orange-400" aria-label="爆炸飞散范围" />
                    </label>
                    <label className="text-[10px] text-slate-400">节奏 {(selectedElement.ai3dExplodeSpeed ?? 1).toFixed(1)}x
                      <input type="range" min={0.3} max={3} step={0.1} value={selectedElement.ai3dExplodeSpeed ?? 1} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dExplodeSpeed: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-orange-400" aria-label="爆炸节奏" />
                    </label>
                    <label className="col-span-2 text-[10px] text-slate-400">旋转 {Math.round((selectedElement.ai3dExplodeSpin ?? 0.5) * 100)}%
                      <input type="range" min={0} max={1} step={0.05} value={selectedElement.ai3dExplodeSpin ?? 0.5} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dExplodeSpin: Number(e.target.value) })} className="ml-2 w-20 h-1 align-middle accent-orange-400" aria-label="爆炸旋转幅度" />
                    </label>
                  </div>
                  {renderAi3DActionControls('explode', '爆炸', 'orange')}
                </div>

                {/* 物理碰撞 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${selectedElement.ai3dPhysics ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-semibold text-slate-300">物理碰撞</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !selectedElement.ai3dPhysics;
                      onUpdateElement(selectedElement.id, {
                        ai3dPhysics: next,
                        ...(next ? { ai3dLayers: 0, ai3dExplode: 0 } : {}),
                      });
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors ${selectedElement.ai3dPhysics ? 'bg-purple-500' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedElement.ai3dPhysics ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <p className="text-[10px] text-purple-200/70">以模型中心为原点径向冲击与回弹</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-slate-400">范围 {Math.round((selectedElement.ai3dCollisionDistance ?? 1) * 100)}%
                    <input type="range" min={0} max={2} step={0.05} value={selectedElement.ai3dCollisionDistance ?? 1} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dCollisionDistance: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-purple-400" aria-label="碰撞冲击范围" />
                  </label>
                  <label className="text-[10px] text-slate-400">频率 {(selectedElement.ai3dCollisionSpeed ?? 1).toFixed(1)}x
                    <input type="range" min={0.3} max={3} step={0.1} value={selectedElement.ai3dCollisionSpeed ?? 1} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dCollisionSpeed: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-purple-400" aria-label="碰撞频率" />
                  </label>
                  <label className="col-span-2 text-[10px] text-slate-400">回弹 {Math.round((selectedElement.ai3dCollisionBounce ?? 0.5) * 100)}%
                    <input type="range" min={0} max={1} step={0.05} value={selectedElement.ai3dCollisionBounce ?? 0.5} onChange={(e) => onUpdateElement(selectedElement.id, { ai3dCollisionBounce: Number(e.target.value) })} className="ml-2 w-20 h-1 align-middle accent-purple-400" aria-label="碰撞回弹幅度" />
                  </label>
                </div>
                {renderAi3DActionControls('physics', '碰撞', 'purple')}

                {/* 分隔线 */}
                <div className="border-t border-white/10" />

                {/* 显示浮动控制面板 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MousePointer size={11} className="text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-300">画布显示控制按钮</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateElement(selectedElement.id, { ai3dShowPanel: !selectedElement.ai3dShowPanel })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${selectedElement.ai3dShowPanel !== false ? 'bg-cyan-500' : 'bg-white/15'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedElement.ai3dShowPanel !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 leading-relaxed">关闭后画布上不再显示浮动控制面板，仅在此处调整参数。</p>

              </div>
            )}


            {/* Timing & Animations（可折叠） */}
            {elementInspectorTab === 'animation' && selectedElement.type === 'img' && onOpenBackgroundRemoval && (
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-950/20 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200">
                  <Eraser size={12} className="text-cyan-300" />
                  <span>AI 抠图</span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-500">从图片中移除背景，并将结果作为新的图片图层插入。</p>
                <button
                  type="button"
                  onClick={onOpenBackgroundRemoval}
                  className="flex min-h-8 w-full items-center justify-center gap-1.5 rounded border border-cyan-400/30 bg-cyan-400/10 px-2 text-[10px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
                >
                  <Eraser size={12} />
                  打开 AI 抠图工具
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => toggleSection('el-timing')}
              className={`w-full flex items-center justify-between border-t border-white/10 pt-3 group ${elementInspectorTab === 'animation' ? '' : 'hidden'}`}
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                <span>时间线与出入动效 (TIMING & ANIMATION)</span>
              </span>
              <ChevronDown size={12} className={`transition-transform ${collapsedSections['el-timing'] ? '' : 'rotate-180'} text-slate-500 group-hover:text-slate-300`} />
            </button>
            <div className={`pt-3 space-y-2 ${elementInspectorTab !== 'animation' || collapsedSections['el-timing'] ? 'hidden' : ''}`}>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">入场时间 (s)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={selectedElement.startTime}
                    onChange={(e) => onUpdateElement(selectedElement.id, { startTime: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">持续时间 (s)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={selectedElement.duration}
                    onChange={(e) => onUpdateElement(selectedElement.id, { duration: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">播放次数</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_LAYER_PLAYBACK_COUNT}
                    step="1"
                    disabled={layerPlayback?.infinite}
                    value={layerPlayback?.count ?? 1}
                    onChange={(e) => onUpdateElement(selectedElement.id, {
                      playbackCount: Math.min(MAX_LAYER_PLAYBACK_COUNT, Math.max(1, Math.floor(Number(e.target.value) || 1))),
                      playbackInfinite: false,
                    })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="图层播放次数"
                  />
                </div>

                <div className="flex items-end">
                  <div className="flex w-full items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <span className="text-[10px] text-slate-300">无限循环播放</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={layerPlayback?.infinite === true}
                      aria-label="无限循环播放"
                      onClick={() => onUpdateElement(selectedElement.id, { playbackInfinite: !layerPlayback?.infinite })}
                      className={`relative h-5 w-9 rounded-full transition-colors ${layerPlayback?.infinite ? 'bg-sky-500' : 'bg-white/15'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${layerPlayback?.infinite ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">入场动画</label>
                  <select
                    value={selectedElement.animType || 'none'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { animType: e.target.value as InAnimType })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="none">无 (None)</option>
                    <option value="fade-in">淡入 (Fade In)</option>
                    <option value="slide-up">上浮 (Slide Up)</option>
                    <option value="slide-down">下落 (Slide Down)</option>
                    <option value="slide-left">左滑 (Slide Left)</option>
                    <option value="slide-right">右滑 (Slide Right)</option>
                    <option value="zoom-in">放大进入 (Zoom In)</option>
                    <option value="zoom-out">缩小进入 (Zoom Out)</option>
                    <option value="elastic-pop">弹性弹出 (Elastic Pop)</option>
                    <option value="flip-3d">3D 翻转 (Flip 3D)</option>
                    <option value="rotate-in">旋转进入 (Rotate In)</option>
                    <option value="bounce-in">弹跳进入 (Bounce In)</option>
                    <option value="blur-in">模糊显现 (Blur In)</option>
                    <option value="tilt-in">倾斜进入 (Tilt In)</option>
                    <option value="fade-blur-in">模糊淡入 (Fade & Blur In)</option>
                    <option value="glitch">故障闪烁 (Glitch)</option>
                    <option value="neon-glow-in">霓虹辉光 (Neon Glow)</option>
                    <option value="scan-reveal">扫描显现 (Scan Reveal)</option>
                    <option value="hologram-in">全息投影 (Hologram)</option>
                    <option value="stardust-in">星尘聚拢 (Stardust)</option>
                    <option value="energy-pop">能量迸发 (Energy Pop)</option>
                    <option value="perspective-in">纵深拉近 (Perspective)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">出场动画</label>
                  <select
                    value={selectedElement.exitAnimType || 'none'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { exitAnimType: e.target.value as OutAnimType })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="none">无 (None)</option>
                    <option value="fade-out">淡出 (Fade Out)</option>
                    <option value="slide-down">下沉 (Slide Down)</option>
                    <option value="slide-up">上滑 (Slide Up)</option>
                    <option value="slide-left">左滑出 (Slide Left)</option>
                    <option value="slide-right">右滑出 (Slide Right)</option>
                    <option value="zoom-out">缩小淡出 (Zoom Out)</option>
                    <option value="zoom-in">放大淡出 (Zoom In)</option>
                    <option value="fade-zoom">缩放淡出 (Fade Zoom)</option>
                    <option value="rotate-out">旋转退出 (Rotate Out)</option>
                    <option value="blur-out">模糊消散 (Blur Out)</option>
                    <option value="bounce-out">弹跳退出 (Bounce Out)</option>
                    <option value="flip-out">3D 翻转退出 (Flip Out)</option>
                    <option value="dissolve-out">溶解消失 (Dissolve)</option>
                    <option value="neon-out">霓虹消散 (Neon Out)</option>
                    <option value="particle-out">粒子瓦解 (Particle Out)</option>
                    <option value="hologram-out">全息关闭 (Hologram Out)</option>
                    <option value="scan-out">上扫退出 (Scan Out)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">循环动画</label>
                  <select
                    value={selectedElement.loopAnim || 'none'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { loopAnim: e.target.value as LoopAnimType })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="none">无 (None)</option>
                    <option value="pulse">脉动 (Pulse)</option>
                    <option value="float">漂浮 (Float)</option>
                    <option value="spin">旋转 (Spin)</option>
                    <option value="shimmer">流光 (Shimmer)</option>
                    <option value="breathe">呼吸 (Breathe)</option>
                    <option value="swing">摇摆 (Swing)</option>
                    <option value="shake">抖动 (Shake)</option>
                    <option value="heartbeat">心跳 (Heartbeat)</option>
                    <option value="blink">闪烁 (Blink)</option>
                    <option value="wave">波浪浮动 (Wave)</option>
                    <option value="neon-pulse">霓虹脉动 (Neon Pulse)</option>
                    <option value="data-flow">数据流动 (Data Flow)</option>
                    <option value="hologram-flicker">全息闪烁 (Hologram Flicker)</option>
                    <option value="orbit-spin">轨道旋转 (Orbit Spin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">循环速度</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={selectedElement.loopAnimSpeed || 1}
                    onChange={(e) => onUpdateElement(selectedElement.id, { loopAnimSpeed: Math.max(0.1, parseFloat(e.target.value) || 1) })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                  </div>
                </div>

                {elementInspectorTab === 'animation' && selectedElement.type === 'txt' && (
                <div className="space-y-2">
                <div className="border-t border-sky-400/20 pt-3 text-[10px] font-bold uppercase tracking-wider text-sky-300">高级文字样式</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[10px] text-slate-400">
                    <span className="mb-0.5 block">字间距 (px)</span>
                    <input type="number" min="-20" max="80" step="0.5" value={selectedElement.letterSpacing ?? 0} onChange={(e) => onUpdateElement(selectedElement.id, { letterSpacing: Number(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" />
                  </label>
                  <label className="block text-[10px] text-slate-400">
                    <span className="mb-0.5 block">行间距</span>
                    <input type="number" min="0.6" max="4" step="0.05" value={selectedElement.lineHeight ?? 1.625} onChange={(e) => onUpdateElement(selectedElement.id, { lineHeight: Math.max(0.6, Number(e.target.value) || 1.625) })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" />
                  </label>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <label className="block text-[10px] text-slate-400">
                    <span className="mb-0.5 flex justify-between"><span>文字不透明度</span><span className="font-mono text-slate-300">{selectedElement.textOpacity ?? 100}%</span></span>
                    <input type="range" min="0" max="100" value={selectedElement.textOpacity ?? 100} onChange={(e) => onUpdateElement(selectedElement.id, { textOpacity: Number(e.target.value) })} className="w-full accent-sky-500" />
                  </label>
                  <div className="flex gap-1 rounded border border-white/10 bg-black/30 p-0.5" aria-label="文字样式">
                    <button type="button" title="粗体" onClick={() => onUpdateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`w-7 h-6 rounded text-xs font-bold ${selectedElement.fontWeight === 'bold' || !selectedElement.fontWeight ? 'bg-sky-500/25 text-white' : 'text-slate-400 hover:text-white'}`}>B</button>
                    <button type="button" title="斜体" onClick={() => onUpdateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`w-7 h-6 rounded text-xs italic ${selectedElement.fontStyle === 'italic' ? 'bg-sky-500/25 text-white' : 'text-slate-400 hover:text-white'}`}>I</button>
                    <button type="button" title="下划线" onClick={() => onUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })} className={`w-7 h-6 rounded text-xs underline ${selectedElement.textDecoration === 'underline' ? 'bg-sky-500/25 text-white' : 'text-slate-400 hover:text-white'}`}>U</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 rounded border border-white/10 bg-black/30 p-0.5" aria-label="文字对齐">
                  {(['left', 'center', 'right'] as const).map((align) => <button key={align} type="button" title={align === 'left' ? '左对齐' : align === 'center' ? '居中对齐' : '右对齐'} onClick={() => onUpdateElement(selectedElement.id, { textAlign: align })} className={`h-6 rounded text-[10px] ${selectedElement.textAlign === align || (!selectedElement.textAlign && align === 'center') ? 'bg-sky-500/25 text-white' : 'text-slate-400 hover:text-white'}`}>{align === 'left' ? '左' : align === 'center' ? '中' : '右'}</button>)}
                </div>

                <div className="space-y-2 rounded border border-cyan-400/15 bg-cyan-950/10 p-2">
                  <label className="flex items-center justify-between text-[10px] text-slate-300">
                    <span>文字发光</span><input type="checkbox" checked={selectedElement.textGlowEnabled || false} onChange={(e) => onUpdateElement(selectedElement.id, { textGlowEnabled: e.target.checked })} className="accent-cyan-400" />
                  </label>
                  {selectedElement.textGlowEnabled && <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] text-slate-400"><span className="mb-0.5 block">颜色</span><input type="color" value={selectedElement.textGlowColor || selectedElement.color || '#ffffff'} onChange={(e) => onUpdateElement(selectedElement.id, { textGlowColor: e.target.value })} className="h-7 w-full rounded border border-white/20 bg-transparent" /></label>
                    <label className="block text-[10px] text-slate-400"><span className="mb-0.5 block">范围</span><input type="number" min="0" max="120" value={selectedElement.textGlowBlur ?? 24} onChange={(e) => onUpdateElement(selectedElement.id, { textGlowBlur: Number(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /></label>
                    <label className="col-span-2 block text-[10px] text-slate-400"><span className="mb-0.5 flex justify-between"><span>强度</span><span>{selectedElement.textGlowIntensity ?? 50}%</span></span><input type="range" min="0" max="100" value={selectedElement.textGlowIntensity ?? 50} onChange={(e) => onUpdateElement(selectedElement.id, { textGlowIntensity: Number(e.target.value) })} className="w-full accent-cyan-400" /></label>
                  </div>}
                </div>

                <div className="space-y-2 rounded border border-white/10 bg-white/[0.02] p-2">
                  <label className="flex items-center justify-between text-[10px] text-slate-300">
                    <span>文字阴影</span><input type="checkbox" checked={selectedElement.textShadowEnabled || false} onChange={(e) => onUpdateElement(selectedElement.id, { textShadowEnabled: e.target.checked })} className="accent-sky-500" />
                  </label>
                  {selectedElement.textShadowEnabled && <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] text-slate-400"><span className="mb-0.5 block">颜色</span><input type="color" value={selectedElement.textShadowColor || '#000000'} onChange={(e) => onUpdateElement(selectedElement.id, { textShadowColor: e.target.value })} className="h-7 w-full rounded border border-white/20 bg-transparent" /></label>
                    <label className="block text-[10px] text-slate-400"><span className="mb-0.5 block">不透明度</span><input type="number" min="0" max="100" value={selectedElement.textShadowOpacity ?? 65} onChange={(e) => onUpdateElement(selectedElement.id, { textShadowOpacity: Number(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /></label>
                    <label className="block text-[10px] text-slate-400"><span className="mb-0.5 block">模糊度</span><input type="number" min="0" max="120" value={selectedElement.textShadowBlur ?? 8} onChange={(e) => onUpdateElement(selectedElement.id, { textShadowBlur: Number(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /></label>
                    <label className="block text-[10px] text-slate-400"><span className="mb-0.5 block">距离 / 角度</span><div className="grid grid-cols-2 gap-1"><input type="number" min="0" max="100" value={selectedElement.textShadowDistance ?? 4} onChange={(e) => onUpdateElement(selectedElement.id, { textShadowDistance: Number(e.target.value) || 0 })} className="min-w-0 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /><input type="number" min="-180" max="180" value={selectedElement.textShadowAngle ?? 45} onChange={(e) => onUpdateElement(selectedElement.id, { textShadowAngle: Number(e.target.value) || 0 })} className="min-w-0 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /></div></label>
                  </div>}
                </div>
                </div>
                )}
              </div>


            {/* Data Visualization Chart Config（可折叠） */}
            {elementInspectorTab === 'base' && selectedElement?.type === 'chart' && (
              <div className="border-t border-white/10 pt-2.5">
                <button
                  type="button"
                  onClick={() => toggleSection('el-chart')}
                  className="w-full flex items-center justify-between group"
                >
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3Icon size={12} className="text-cyan-400" />
                    <span>数据可视化组件 (CHART)</span>
                  </span>
                  <ChevronDown size={12} className={`transition-transform ${collapsedSections['el-chart'] ? '' : 'rotate-180'} text-slate-500 group-hover:text-slate-300`} />
                </button>
                <div className={`pt-2.5 space-y-2 ${collapsedSections['el-chart'] ? 'hidden' : ''}`}>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">组件类型</label>
                  <select
                    value={selectedElement.chartKind || 'bar'}
                    onChange={(e) => onUpdateElement(selectedElement.id, { chartKind: e.target.value as any })}
                    className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60"
                  >
                    <option value="bar">柱状图</option>
                    <option value="line">折线图</option>
                    <option value="pie">饼图</option>
                    <option value="donut">环形图</option>
                    <option value="counter">数字翻牌器</option>
                    <option value="clock">时钟 / 日期</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">图表标题（可选）</label>
                  <input
                    value={selectedElement.chartTitle || ''}
                    onChange={(e) => onUpdateElement(selectedElement.id, { chartTitle: e.target.value })}
                    placeholder="例如：年度产量"
                    className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60"
                  />
                </div>

                {(selectedElement.chartKind === 'bar' || selectedElement.chartKind === 'line' || selectedElement.chartKind === 'pie' || selectedElement.chartKind === 'donut' || !selectedElement.chartKind) && (
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">数据（每行一个：名称,数值）</label>
                    <textarea
                      value={chartDataText}
                      onChange={(e) => handleChartDataText(e.target.value)}
                      rows={6}
                      spellCheck={false}
                      placeholder={'华东,8600\n华南,5400\n华北,7200'}
                      className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400/60 resize-y leading-relaxed"
                    />
                  </div>
                )}

                {(() => {
                  const enabled = selectedElement.chartInteractions?.enabled || CHART_INTERACTION_IDS;
                  const toggleChartInteraction = (id: typeof CHART_INTERACTION_IDS[number]) => {
                    const next = enabled.includes(id) ? enabled.filter((item) => item !== id) : [...enabled, id];
                    onUpdateElement(selectedElement.id, { chartInteractions: { ...selectedElement.chartInteractions, enabled: next } });
                  };
                  return (
                    <div className="space-y-2 border-t border-white/10 pt-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-slate-400">图表交互（可叠加）</label>
                        <span className="font-mono text-[9px] text-cyan-300">{enabled.length}/7</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CHART_INTERACTION_IDS.map((id) => (
                          <label key={id} className="flex min-h-7 cursor-pointer items-center gap-1.5 rounded border border-white/10 bg-black/20 px-1.5 text-[10px] text-slate-300 hover:border-cyan-400/40">
                            <input type="checkbox" checked={enabled.includes(id)} onChange={() => toggleChartInteraction(id)} className="accent-cyan-400" />
                            <span>{CHART_INTERACTION_LABELS[id]}</span>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] text-slate-500">过渡 ms<input type="number" min="80" max="1200" step="20" value={selectedElement.chartInteractions?.duration ?? 220} onChange={(e) => onUpdateElement(selectedElement.id, { chartInteractions: { ...selectedElement.chartInteractions, duration: Math.max(80, Math.min(1200, Number(e.target.value) || 220)) } })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /></label>
                        <label className="text-[10px] text-slate-500">高亮倍数<input type="number" min="1" max="3" step="0.1" value={selectedElement.chartInteractions?.highlightSize ?? 1.7} onChange={(e) => onUpdateElement(selectedElement.id, { chartInteractions: { ...selectedElement.chartInteractions, highlightSize: Math.max(1, Math.min(3, Number(e.target.value) || 1.7)) } })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /></label>
                        <label className="text-[10px] text-slate-500">选区透明度<input type="number" min="0.05" max="0.6" step="0.01" value={selectedElement.chartInteractions?.brushOpacity ?? 0.18} onChange={(e) => onUpdateElement(selectedElement.id, { chartInteractions: { ...selectedElement.chartInteractions, brushOpacity: Math.max(0.05, Math.min(0.6, Number(e.target.value) || 0.18)) } })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /></label>
                        <label className="text-[10px] text-slate-500">最小缩放<input type="number" min="0.08" max="1" step="0.05" value={selectedElement.chartInteractions?.minZoom ?? 0.25} onChange={(e) => onUpdateElement(selectedElement.id, { chartInteractions: { ...selectedElement.chartInteractions, minZoom: Math.max(0.08, Math.min(1, Number(e.target.value) || 0.25)) } })} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" /></label>
                      </div>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400"><input type="checkbox" checked={selectedElement.chartInteractions?.snap ?? true} onChange={(e) => onUpdateElement(selectedElement.id, { chartInteractions: { ...selectedElement.chartInteractions, snap: e.target.checked } })} className="accent-cyan-400" />准线吸附最近数据点</label>
                    </div>
                  );
                })()}

                {selectedElement.chartKind === 'counter' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">目标数值</label>
                      <input
                        type="number"
                        value={selectedElement.counterValue ?? 0}
                        onChange={(e) => onUpdateElement(selectedElement.id, { counterValue: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">前缀</label>
                      <input
                        value={selectedElement.counterPrefix || ''}
                        onChange={(e) => onUpdateElement(selectedElement.id, { counterPrefix: e.target.value })}
                        placeholder="¥"
                        className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">后缀</label>
                      <input
                        value={selectedElement.counterSuffix || ''}
                        onChange={(e) => onUpdateElement(selectedElement.id, { counterSuffix: e.target.value })}
                        placeholder="%"
                        className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60"
                      />
                    </div>
                  </div>
                )}

                {selectedElement.chartKind === 'clock' && (
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">显示格式</label>
                    <select
                      value={selectedElement.clockFormat || 'time'}
                      onChange={(e) => onUpdateElement(selectedElement.id, { clockFormat: e.target.value as any })}
                      className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/60"
                    >
                      <option value="time">时间（时:分:秒）</option>
                      <option value="date">日期（年-月-日）</option>
                      <option value="datetime">日期 + 时间</option>
                    </select>
                  </div>
                )}
                  </div>
                </div>
              )}

            {/* Data Binding (变量绑定)：当前分类只有一个区块，固定展开 */}
            <div className={`w-full flex items-center justify-between border-t border-white/10 pt-3 group ${elementInspectorTab === 'data' ? '' : 'hidden'}`}>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon size={12} className="text-emerald-400" />
                <span>数据绑定 (BIND)</span>
              </span>
            </div>
            <div className={`pt-3 space-y-2 ${elementInspectorTab !== 'data' ? 'hidden' : ''}`}>
              {(projectData.variables || []).length === 0 ? (
                <p className="text-[10px] text-slate-500">请先在场景设置中新增全局变量，再将属性绑定到变量实现动态数据。</p>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">文本绑定（内容/标题）</label>
                    <select
                      value={selectedElement.bindText || ''}
                      onChange={(e) => onUpdateElement(selectedElement.id, { bindText: e.target.value || undefined })}
                      className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400/60"
                    >
                      <option value="">不绑定（使用静态内容）</option>
                      {(projectData.variables || []).map((v) => (
                        <option key={v.id} value={v.name}>{v.name}（当前：{String(v.value)}）</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">数值绑定（翻牌器/数值型）</label>
                    <select
                      value={selectedElement.bindValue || ''}
                      onChange={(e) => onUpdateElement(selectedElement.id, { bindValue: e.target.value || undefined })}
                      className="w-full bg-slate-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400/60"
                    >
                      <option value="">不绑定</option>
                      {(projectData.variables || []).map((v) => (
                        <option key={v.id} value={v.name}>{v.name}（当前：{String(v.value)}）</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Interactive Actions：当前分类只有一个区块，固定展开 */}
            <div className={`w-full flex items-center justify-between border-t border-white/10 pt-3 group ${selectedElement.interactionArea || elementInspectorTab !== 'interaction' ? 'hidden' : ''}`}>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon size={12} className="text-pink-400" />
                <span>交互路由与响应 (INTERACTIONS)</span>
              </span>
            </div>
            <div className={`pt-3 space-y-2 ${selectedElement.interactionArea || elementInspectorTab !== 'interaction' ? 'hidden' : ''}`}>
              {selectedElement.type === 'ui-component' && isContinuousInteractionComponent(selectedElement.uiComponentType) ? (
                <ContinuousInteractionEditor element={selectedElement} scenes={projectData.scenes} canvasAspect={canvasSpec.width / canvasSpec.height} onUpdateElement={onUpdateElement} />
              ) : (
                <>

              <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-cyan-100">多动作编排</div>
                    <div className="mt-0.5 text-[9px] text-slate-400">
                      改数据、切组件状态、跳转可以串成一套流程
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                    {(selectedElement.interaction?.steps?.length || 0)} 步
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setInteractionComposerOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-400/10 py-1.5 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  <GitBranch size={11} />
                  {selectedElement.interaction?.steps?.length ? '编辑动作流程' : '打开动作编排'}
                </button>
                {Boolean(selectedElement.interaction?.steps?.length) && (
                  <p className="text-[9px] leading-4 text-slate-500">
                    已启用多动作，会优先执行编排步骤；下面的单动作设置仅作兼容保留。
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">点击触发跳转类型</label>
                <select
                  value={selectedElement.interaction?.action || selectedElement.linkType || (selectedElement.link ? 'jump' : '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      onUpdateElement(selectedElement.id, { link: undefined, linkType: undefined, linkUrl: undefined });
                    } else if (v === 'url') {
                      onUpdateElement(selectedElement.id, { linkType: 'url', link: undefined });
                    } else if (v === 'set-variable') {
                      onUpdateElement(selectedElement.id, { link: undefined, linkType: undefined, linkUrl: undefined, interaction: { ...selectedElement.interaction, action: 'set-variable', trigger: selectedElement.trigger || 'click', variableName: selectedElement.variableName || '', variableValue: selectedElement.variableValue ?? '' } });
                    } else {
                      onUpdateElement(selectedElement.id, { linkType: v as 'jump' | 'popup', linkUrl: undefined });
                    }
                  }}
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                >
                  <option value="">(无目标 - 纯静态元素)</option>
                  <option value="jump">跳转场景</option>
                  <option value="url">跳转网页链接</option>
                </select>
              </div>

              {(selectedElement.interaction?.action || selectedElement.linkType || selectedElement.link || selectedElement.linkUrl) && (
                <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">触发方式</label>
                    <select
                      value={selectedElement.interaction?.trigger || selectedElement.trigger || 'click'}
                      onChange={(e) => {
                        const trigger = e.target.value as SceneElement['trigger'];
                        onUpdateElement(selectedElement.id, {
                          trigger,
                          interaction: selectedElement.interaction
                            ? { ...selectedElement.interaction, trigger }
                            : selectedElement.interaction,
                        });
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    >
                      {INTERACTION_TRIGGER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {selectedElement.type !== 'chart' && (selectedElement.trigger === 'hover' ? (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">悬停延迟 (秒)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={selectedElement.hoverDelay ?? 0.3}
                        onChange={(e) => onUpdateElement(selectedElement.id, { hoverDelay: Math.max(0, parseFloat(e.target.value) || 0.3) })}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">悬停特效</label>
                      <select
                        value={selectedElement.hoverEffect || 'none'}
                        onChange={(e) => onUpdateElement(selectedElement.id, { hoverEffect: e.target.value as SceneElement['hoverEffect'] })}
                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="morph-circle-pill">Circle to Pill</option>
                        <option value="morph-size">Size Morph</option>
                        <option value="morph-reverse-collapse">Reverse Collapse</option>
                        <option value="none">无 (None)</option>
                        <option value="glow">发光 (Glow)</option>
                        <option value="outline">描边高亮 (Outline)</option>
                        <option value="scale">放大 (Scale)</option>
                        <option value="float">上浮 (Float)</option>
                        <option value="brighten">提亮 (Brighten)</option>
                      </select>
                    </div>
                  ))}
                </div>

                {/* 点击触发 + 选择了悬停特效时，显示颜色和强度设置 */}
                {selectedElement.type !== 'chart' && selectedElement.trigger !== 'hover' && selectedElement.hoverEffect && selectedElement.hoverEffect !== 'none' && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">特效颜色</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedElement.hoverColor || '#38bdf8'}
                          onChange={(e) => onUpdateElement(selectedElement.id, { hoverColor: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/10"
                        />
                        <input
                          type="text"
                          value={selectedElement.hoverColor || '#38bdf8'}
                          onChange={(e) => onUpdateElement(selectedElement.id, { hoverColor: e.target.value })}
                          className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] text-slate-400">特效强度</label>
                        <span className="text-[10px] font-mono text-amber-300">{selectedElement.hoverIntensity ?? 50}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedElement.hoverIntensity ?? 50}
                        onChange={(e) => onUpdateElement(selectedElement.id, { hoverIntensity: parseInt(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                      编辑时选中元素会即时预览强度；演示时仅鼠标悬停触发。素材自身已有的发光不受此项影响。
                    </p>
                  </div>
                )}
                </>
              )}

              {selectedElement.interaction?.action === 'set-variable' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={selectedElement.interaction.variableName || selectedElement.variableName || ''}
                    onChange={(e) => onUpdateElement(selectedElement.id, { variableName: e.target.value, interaction: { ...selectedElement.interaction, action: 'set-variable', variableName: e.target.value } })}
                    placeholder="变量名"
                    className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  />
                  <input
                    value={String(selectedElement.interaction.variableValue ?? selectedElement.variableValue ?? '')}
                    onChange={(e) => onUpdateElement(selectedElement.id, { variableValue: e.target.value, interaction: { ...selectedElement.interaction, action: 'set-variable', variableValue: e.target.value } })}
                    placeholder="变量值"
                    className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
              )}

              {selectedElement.linkType === 'url' ? (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">网页链接 URL（点击元素时新窗口打开）</label>
                  <input
                    type="url"
                    value={selectedElement.linkUrl || ''}
                    placeholder="https://www.example.com"
                    onChange={(e) => onUpdateElement(selectedElement.id, { linkUrl: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono"
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">支持 http:// / https:// 链接，点击元素时将打开网页</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">点击触发跳转目标场景</label>
                    <select
                      value={selectedElement.link || ''}
                      onChange={(e) => onUpdateElement(selectedElement.id, { link: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                    >
                      <option value="">(选择目标场景)</option>
                      {(Object.values(projectData.scenes) as Scene[]).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.alias} ({isPopupScene(s) ? '模态弹窗' : '独立场景'})
                          {isPopupScene(s) ? ' 🚫不轮播' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedElement.link && (
                    <div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">交互呈现模式</label>
                        <select
                          value={selectedElement.linkType === 'popup' ? 'popup' : 'jump'}
                          onChange={(e) => onUpdateElement(selectedElement.id, { linkType: e.target.value as 'jump' | 'popup' })}
                          className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="jump">直接切换场景</option>
                          <option value="popup">模态悬浮弹窗</option>
                        </select>
                      </div>

                      {/* 【新增】元素级场景切换进出场动画（交互呈现模式下方；仅「直接切换场景」模式显示，
                          弹窗模式请使用下方弹窗自定义设置中的入场动画/动画时长，避免重复） */}
                      {selectedElement.linkType !== 'popup' && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">场景切换进出场动效</span>
                          <span className="text-[8px] text-slate-600">直接切换场景时生效，可覆盖场景转场设置</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* 入场动画 */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">入场动画</label>
                            <select
                              value={selectedElement.linkEnterAnim || ''}
                              onChange={(e) => onUpdateElement(selectedElement.id, { linkEnterAnim: (e.target.value || undefined) as SceneTransitionType | undefined })}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="">跟随场景设置</option>
                              <option value="none">无动画（硬切）</option>
                              <option value="fade">淡入 (Fade)</option>
                              <option value="slide-left">左滑入</option>
                              <option value="slide-right">右滑入</option>
                              <option value="slide-up">上滑入</option>
                              <option value="slide-down">下滑入</option>
                              <option value="zoom-in">镜头推近</option>
                              <option value="zoom-out">景深后撤</option>
                              <option value="dissolve">模糊溶解</option>
                              <option value="flip-3d">3D 翻转</option>
                              <option value="cube-3d">3D 立方体</option>
                              <option value="glitch">赛博故障</option>
                              <option value="wipe-right">光幕划过</option>
                              <option value="soft-wipe">柔光擦拭</option>
                              <option value="radial-reveal">径向扩散</option>
                              <option value="diagonal-curtain">斜切光幕</option>
                              <option value="blur-dissolve">模糊溶解（静态推荐）</option>
                            </select>
                          </div>

                          {/* 出场动画 */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">出场动画</label>
                            <select
                              value={selectedElement.linkExitAnim || ''}
                              onChange={(e) => onUpdateElement(selectedElement.id, { linkExitAnim: (e.target.value || undefined) as SceneTransitionType | undefined })}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="">跟随场景设置</option>
                              <option value="none">无动画（硬切）</option>
                              <option value="fade">淡出 (Fade)</option>
                              <option value="slide-left">左滑出</option>
                              <option value="slide-right">右滑出</option>
                              <option value="slide-up">上滑出</option>
                              <option value="slide-down">下滑出</option>
                              <option value="zoom-out">缩放退场</option>
                              <option value="dissolve">模糊溶解</option>
                              <option value="flip-3d">3D 翻转</option>
                              <option value="cube-3d">3D 立方体</option>
                              <option value="soft-wipe">柔光擦拭</option>
                              <option value="radial-reveal">径向扩散</option>
                              <option value="diagonal-curtain">斜切光幕</option>
                              <option value="blur-dissolve">模糊溶解（静态推荐）</option>
                            </select>
                          </div>
                        </div>

                        {/* 进出场动画时长 */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] text-slate-400">动画时长</label>
                            <span className="text-[10px] font-mono text-sky-300">
                              {(selectedElement.linkAnimDuration ?? 0.6).toFixed(2)}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="2.5"
                            step="0.05"
                            value={selectedElement.linkAnimDuration ?? 0.6}
                            onChange={(e) => onUpdateElement(selectedElement.id, { linkAnimDuration: parseFloat(e.target.value) })}
                            className="w-full accent-sky-500"
                          />
                        </div>
                      </div>
                      )}

                    {/* 【新增】弹窗呈现动画与位置大小控制 */}
                    {selectedElement.linkType === 'popup' && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                        {(() => {
                          const popups = getPopups(selectedElement);
                          const selectedId = selectedElement.popupActiveId || popups[0].id;
                          const activeIndex = Math.max(0, popups.findIndex((popup) => popup.id === selectedId));
                          const activePopup = popups[activeIndex];
                          const updatePopup = (patch: Partial<typeof activePopup>) => {
                            const next = popups.map((popup, index) => index === activeIndex ? { ...popup, ...patch } : popup);
                            onUpdateElement(selectedElement.id, { ...popupCollectionPatch(next), popupActiveId: activePopup.id });
                          };
                          return <div className="space-y-2 rounded-md border border-sky-400/25 bg-sky-400/[0.045] p-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] font-semibold text-sky-100">同时打开的弹窗</label>
                              <select value={popups.length} onChange={(event) => {
                                const next = resizePopups(selectedElement, Number(event.target.value));
                                onUpdateElement(selectedElement.id, { ...popupCollectionPatch(next), popupActiveId: next[Math.min(activeIndex, next.length - 1)].id });
                              }} className="w-16 rounded border border-sky-400/30 bg-[#10151f] px-1.5 py-1 text-[11px] text-white outline-none focus:border-sky-300" aria-label="弹窗数量">
                                {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} 个</option>)}
                              </select>
                            </div>
                            <label className="block">
                              <span className="mb-1 block text-[9px] text-slate-400">打开方式</span>
                              <select value={selectedElement.popupOpenMode || 'simultaneous'} onChange={(event) => onUpdateElement(selectedElement.id, { popupOpenMode: event.target.value as SceneElement['popupOpenMode'] })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400">
                                <option value="simultaneous">同时弹出</option>
                                <option value="sequence">依次弹出</option>
                              </select>
                            </label>
                            <div className="grid grid-cols-5 gap-1" role="tablist" aria-label="选择要配置的弹窗">
                              {popups.map((popup, index) => {
                                const color = popup.color || POPUP_COLORS[index];
                                const active = popup.id === activePopup.id;
                                return <button key={popup.id} type="button" role="tab" aria-selected={active} onClick={() => onUpdateElement(selectedElement.id, { popupActiveId: popup.id })}
                                  className={`h-7 rounded border text-[10px] font-bold transition-colors ${active ? 'bg-white/15 text-white' : 'bg-black/20 text-slate-400 hover:text-white'}`}
                                  style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}55` } : { borderColor: `${color}66` }}>{index + 1}</button>;
                              })}
                            </div>
                            <label className="block">
                              <span className="mb-1 block text-[9px] text-slate-400">弹窗 {activeIndex + 1} 显示的场景</span>
                              <select value={activePopup.target || ''} onChange={(event) => updatePopup({ target: event.target.value })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400">
                                <option value="">选择场景</option>
                                {Object.values(projectData.scenes).map((scene) => <option key={scene.id} value={scene.id}>{scene.alias || scene.id}</option>)}
                              </select>
                            </label>
                            <p className="text-[9px] leading-4 text-slate-500">每个颜色虚线框对应一个弹窗。点选框或编号后，拖动即可调整它的位置。</p>
                          </div>;
                        })()}
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">弹窗自定义设置</span>

                        {/* 呈现方式 */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">呈现方式</label>
                          <select
                            value={popupEditor?.popupDisplay || 'modal'}
                            onChange={(e) => updatePopupEditor({ popupDisplay: e.target.value as PopupConfig['popupDisplay'] })}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="modal">弹窗（Modal）</option>
                            <option value="popover">浮层卡片（Popover）</option>
                            <option value="inline">原地展开（Inline）</option>
                          </select>
                          <p className="text-[8px] text-slate-600 mt-0.5">浮层卡片：热点附近弹出紧凑卡片，保留上下文；原地展开：热点自身放大上浮展示</p>
                        </div>

                        {/* 入场动画 */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">入场动画</label>
                          <select
                            value={popupEditor?.popupAnimationType || 'fadeIn'}
                            onChange={(e) => updatePopupEditor({ popupAnimationType: e.target.value as PopupConfig['popupAnimationType'] })}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="none">无动画</option>
                            <option value="fadeIn">淡入</option>
                            <option value="slideUp">上浮</option>
                            <option value="slideDown">下落</option>
                            <option value="slideLeft">左滑</option>
                            <option value="slideRight">右滑</option>
                            <option value="zoomIn">放大</option>
                            <option value="zoomOut">缩小</option>
                            <option value="bounce">弹性</option>
                            <option value="rotate">旋转</option>
                          </select>
                        </div>

                        {/* 出场动画 */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">出场动画</label>
                          <select
                            value={popupEditor?.popupExitAnimationType ?? 'fadeOut'}
                            onChange={(e) => updatePopupEditor({ popupExitAnimationType: e.target.value as PopupConfig['popupExitAnimationType'] })}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="none">无动画</option>
                            <option value="fadeOut">淡出</option>
                            <option value="slideUp">向上滑出</option>
                            <option value="slideDown">向下滑出</option>
                            <option value="slideLeft">向左滑出</option>
                            <option value="slideRight">向右滑出</option>
                            <option value="zoomOut">缩小退出</option>
                            <option value="zoomIn">放大退出</option>
                            <option value="bounce">弹性退出</option>
                            <option value="rotate">旋转退出</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">停留方式</label>
                          <select
                            value={popupEditor?.popupStayMode || 'short'}
                            onChange={(e) => updatePopupEditor({ popupStayMode: e.target.value as PopupConfig['popupStayMode'] })}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="short">短期停留（可关闭）</option>
                            <option value="long">长期停留（不退出）</option>
                          </select>
                          <p className="text-[8px] text-slate-600 mt-0.5">长期停留会保留至主场景切换，不显示关闭入口。</p>
                        </div>

                        {/* 动画时长 */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            动画时长: {popupEditor?.popupAnimationDuration || 500}ms
                          </label>
                          <input
                            type="range"
                            min="100"
                            max="1000"
                            step="50"
                            value={popupEditor?.popupAnimationDuration || 500}
                            onChange={(e) => updatePopupEditor({ popupAnimationDuration: parseInt(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-500"
                          />
                        </div>

                        {/* 弹窗位置（鼠标拖拽虚线框控制） */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">弹窗位置（拖拽画布虚线框调整）</label>
                          {/* 九宫格快速定位 */}
                          <div className="space-y-1.5">
                            <div>
                              <label className="block text-[9px] text-slate-500 mb-1">快速定位（点击格子）</label>
                              <div className="grid grid-cols-3 gap-1 p-1.5 bg-black/30 rounded-lg border border-white/10">
                                {[
                                  { x: 8, y: 8, label: '↖' },
                                  { x: 50, y: 8, label: '↑' },
                                  { x: 92, y: 8, label: '↗' },
                                  { x: 8, y: 50, label: '←' },
                                  { x: 50, y: 50, label: '●' },
                                  { x: 92, y: 50, label: '→' },
                                  { x: 8, y: 92, label: '↙' },
                                  { x: 50, y: 92, label: '↓' },
                                  { x: 92, y: 92, label: '↘' },
                                ].map((pos, i) => {
                                  const isActive = Math.abs((popupEditor?.popupX ?? 50) - pos.x) < 5 && Math.abs((popupEditor?.popupY ?? 50) - pos.y) < 5;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => updatePopupEditor({ popupX: pos.x, popupY: pos.y, popupPosition: 'custom' })}
                                      className={`aspect-square rounded text-[12px] font-bold transition-all ${
                                        isActive
                                          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                                          : 'bg-white/[0.06] text-slate-400 hover:bg-sky-500/20 hover:text-sky-300'
                                      }`}
                                    >
                                      {pos.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <p className="text-[8px] text-slate-600 leading-tight">在画布上拖拽虚线框可精确调整弹窗位置</p>
                          </div>
                        </div>

                        {/* 弹窗大小（鼠标拖拽虚线框控制） */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">弹窗大小（拖拽虚线框边角调整）</label>
                          <div className="space-y-1.5">
                            {/* 常用尺寸：宽度预设，高度按「宽高比」自动联动 */}
                            <div>
                              <label className="block text-[9px] text-slate-500 mb-1">常用尺寸</label>
                              <div className="grid grid-cols-4 gap-1">
                                {[
                                  { w: 40, label: '小' },
                                  { w: 60, label: '中' },
                                  { w: 80, label: '大' },
                                  { w: 95, label: '全屏' },
                                ].map((size) => {
                                  const isActive = Math.abs((popupEditor?.popupWidth ?? 60) - size.w) < 2;
                                  return (
                                    <button
                                      key={size.label}
                                      type="button"
                                      onClick={() => updatePopupEditor({ popupWidth: size.w, popupSize: 'custom' })}
                                      className={`py-1 rounded text-[9px] font-bold transition-all ${
                                        isActive
                                          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                                          : 'bg-white/[0.06] text-slate-400 hover:bg-sky-500/20 hover:text-sky-300'
                                      }`}
                                    >
                                      {size.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 宽高比：真正控制弹窗形状（1:1 = 正方形，4:3 / 9:16 等按比例） */}
                            <div>
                              <label className="block text-[9px] text-slate-500 mb-1">宽高比</label>
                              <div className="grid grid-cols-6 gap-1">
                                {[
                                  { key: 'free', label: '自由' },
                                  { key: '16:9', label: '16:9' },
                                  { key: '4:3', label: '4:3' },
                                  { key: '1:1', label: '1:1' },
                                  { key: '9:16', label: '9:16' },
                                  { key: 'custom', label: '自定义' },
                                ].map((r) => {
                                  const isActive = (popupEditor?.popupRatio || '16:9') === r.key;
                                  return (
                                    <button
                                      key={r.key}
                                      type="button"
                                      onClick={() => updatePopupEditor(getPopupRatioPatch(popupEditor || {}, r.key as PopupConfig['popupRatio'], canvasSpec.width / canvasSpec.height))}
                                      className={`py-1 rounded text-[9px] font-bold transition-all ${
                                        isActive
                                          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                                          : 'bg-white/[0.06] text-slate-400 hover:bg-sky-500/20 hover:text-sky-300'
                                      }`}
                                    >
                                      {r.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 自定义比例：W : H */}
                            {popupEditor?.popupRatio === 'custom' && (
                              <div className="flex items-center gap-2 px-1 py-1 bg-black/30 rounded border border-white/10">
                                <span className="text-[9px] text-slate-500">比例</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={popupEditor?.popupRatioW || 16}
                                  onChange={(e) => updatePopupEditor({ popupRatioW: Math.max(1, Math.min(30, parseInt(e.target.value) || 16)) })}
                                  className="w-12 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs text-white text-center"
                                />
                                <span className="text-slate-500 text-xs">:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={popupEditor?.popupRatioH || 9}
                                  onChange={(e) => updatePopupEditor({ popupRatioH: Math.max(1, Math.min(30, parseInt(e.target.value) || 9)) })}
                                  className="w-12 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs text-white text-center"
                                />
                                <span className="text-[9px] text-slate-600 ml-auto">如 3:2 / 2:1</span>
                              </div>
                            )}

                            <p className="text-[8px] text-slate-600 leading-tight">自由模式可独立调整宽高；其他比例会保持宽高比联动。</p>
                          </div>
                        </div>

                        {/* 点击遮罩关闭 */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">点击遮罩关闭</span>
                          <button
                            type="button"
                            onClick={() => updatePopupEditor({ popupCloseOnOverlay: !(popupEditor?.popupCloseOnOverlay ?? true) })}
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                              (popupEditor?.popupCloseOnOverlay ?? true) ? 'bg-sky-500' : 'bg-white/20'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              (popupEditor?.popupCloseOnOverlay ?? true) ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>

                        {/* 弹窗款式（主题） */}
                        <div className="pt-1 border-t border-white/10 space-y-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">弹窗款式</label>
                            <select
                              value={normalizePopupTheme(popupEditor?.popupTheme)}
                              onChange={(e) => updatePopupEditor({ popupTheme: e.target.value as PopupConfig['popupTheme'] })}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="default">默认深色</option>
                              <option value="immersive">无弹窗样式（全屏沉浸）</option>
                              <option value="neon">霓虹 (Neon)</option>
                              <option value="cyberpunk">赛博朋克 (Cyberpunk)</option>
                              <option value="glass">全息玻璃 (Glass)</option>
                              <option value="hologram">全息投影 (Hologram)</option>
                              <option value="luxury">奢华金 (Luxury)</option>
                              <option value="minimal">极简白 (Minimal)</option>
                              <option value="corporate">商务蓝 (Corporate)</option>
                              
                              
                              
                              
                              
                              
                              
                              
                              
                            </select>
                          </div>

                          {/* 自定义外观（高级） */}
                          <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer list-none text-[10px] text-slate-400 hover:text-slate-200 py-0.5">
                              <span className="flex items-center gap-1">
                                <SlidersHorizontal size={11} className="text-sky-400" />
                                自定义外观（高级）
                              </span>
                              <ChevronDown size={11} className="transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="pt-1.5 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[9px] text-slate-500">背景色</span>
                                  <input
                                    type="color"
                                    value={(popupEditor?.popupBgColor || '#111420').replace(/rgba?\(/g, '#')}
                                    onChange={(e) => updatePopupEditor({ popupBgColor: e.target.value + 'f0' })}
                                    className="w-7 h-6 rounded bg-transparent border border-white/10 cursor-pointer"
                                    title="背景色（含透明度）"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[9px] text-slate-500">边框色</span>
                                  <input
                                    type="color"
                                    value={(popupEditor?.popupBorderColor || '#ffffff').replace(/rgba?\(/g, '#')}
                                    onChange={(e) => updatePopupEditor({ popupBorderColor: e.target.value })}
                                    className="w-7 h-6 rounded bg-transparent border border-white/10 cursor-pointer"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[9px] text-slate-500">发光色</span>
                                  <input
                                    type="color"
                                    value={(popupEditor?.popupGlowColor || '#38bdf8').replace(/rgba?\(/g, '#')}
                                    onChange={(e) => updatePopupEditor({ popupGlowColor: e.target.value })}
                                    className="w-7 h-6 rounded bg-transparent border border-white/10 cursor-pointer"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[9px] text-slate-500">标题色</span>
                                  <input
                                    type="color"
                                    value={(popupEditor?.popupTitleColor || '#ffffff').replace(/rgba?\(/g, '#')}
                                    onChange={(e) => updatePopupEditor({ popupTitleColor: e.target.value })}
                                    className="w-7 h-6 rounded bg-transparent border border-white/10 cursor-pointer"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-[9px] text-slate-500">强调色</span>
                                  <input
                                    type="color"
                                    value={(popupEditor?.popupAccentColor || '#38bdf8').replace(/rgba?\(/g, '#')}
                                    onChange={(e) => updatePopupEditor({ popupAccentColor: e.target.value })}
                                    className="w-7 h-6 rounded bg-transparent border border-white/10 cursor-pointer"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9px] text-slate-500 mb-0.5">
                                  圆角: {selectedElement.popupRadius ?? 16}px
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="40"
                                  step="2"
                                  value={popupEditor?.popupRadius ?? 16}
                                  onChange={(e) => updatePopupEditor({ popupRadius: parseInt(e.target.value) })}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 mb-0.5">
                                  遮罩模糊: {selectedElement.popupOverlayBlur ?? 24}px
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="60"
                                  step="2"
                                  value={popupEditor?.popupOverlayBlur ?? 24}
                                  onChange={(e) => updatePopupEditor({ popupOverlayBlur: parseInt(e.target.value) })}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 mb-0.5">
                                  遮罩透明度: {Math.round((selectedElement.popupOverlayOpacity ?? 0.8) * 100)}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={Math.round((popupEditor?.popupOverlayOpacity ?? 0.8) * 100)}
                                  onChange={(e) => updatePopupEditor({ popupOverlayOpacity: parseInt(e.target.value) / 100 })}
                                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    )}
                    </div>
                  )}
                </>
              )}
                </>
              )}
            </div>

            {/* 3D Depth Parallax（可折叠） */}
            <div className={`border-t border-white/10 pt-3 ${elementInspectorTab === 'effects' ? '' : 'hidden'}`}>
              <button
                type="button"
                onClick={() => toggleSection('el-3d')}
                className="w-full flex items-center justify-between group"
              >
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Box size={12} className="text-purple-400" />
                  <span>3D 视差景深 (PARALLAX)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onUpdateElement(selectedElement.id, { is3dLayer: !(selectedElement.is3dLayer || false) }); }}
                    className="flex items-center gap-1 text-[11px] text-purple-300 font-semibold cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedElement.is3dLayer || false}
                      onChange={(e) => onUpdateElement(selectedElement.id, { is3dLayer: e.target.checked })}
                      className="accent-purple-500 rounded pointer-events-none"
                    />
                    <span>启用 3D 景深</span>
                  </span>
                  <ChevronDown size={12} className={`transition-transform ${collapsedSections['el-3d'] ? '' : 'rotate-180'} text-slate-500 group-hover:text-slate-300`} />
                </span>
              </button>

              {!collapsedSections['el-3d'] && selectedElement.is3dLayer && (
                <div className="grid grid-cols-2 gap-2 bg-purple-950/20 p-2 rounded-lg border border-purple-500/20">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5" title="控制 3D 视差位移深度；图层视觉上下遮挡仍由图层层级(Z-Index)决定">
                      Z 轴视差景深 (Depth)
                    </label>
                    <input
                      type="number"
                      step="5"
                      min="-100"
                      max="100"
                      value={selectedElement.depthZ || 0}
                      onChange={(e) => onUpdateElement(selectedElement.id, { depthZ: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">鼠标视差响应比</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="0.3"
                      value={selectedElement.parallaxFactor || 0.05}
                      onChange={(e) => onUpdateElement(selectedElement.id, { parallaxFactor: parseFloat(e.target.value) || 0.05 })}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  {/* 3D 投影阴影开关：预览/演示模式是否显示动态投影（编辑模式恒不显示） */}
                  <label className="col-span-2 flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!selectedElement.enable3DShadow}
                      onChange={(e) => onUpdateElement(selectedElement.id, { enable3DShadow: e.target.checked })}
                      className="accent-purple-500 rounded"
                    />
                    <span>显示投影阴影（预览时）</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
    {selectedElement && (
      <InteractionComposerModal
        isOpen={interactionComposerOpen}
        onClose={() => setInteractionComposerOpen(false)}
        steps={selectedElement.interaction?.steps || []}
        scenes={projectData.scenes}
        variables={projectData.variables}
        components={projectData.components}
        elements={activeScene?.els || []}
        onSave={(steps) => {
          onUpdateElement(selectedElement.id, {
            interaction: {
              ...(selectedElement.interaction || {}),
              action: selectedElement.interaction?.action || 'none',
              trigger: selectedElement.interaction?.trigger || selectedElement.trigger || 'click',
              hoverDelay: selectedElement.interaction?.hoverDelay ?? selectedElement.hoverDelay ?? 0.3,
              steps,
            },
          }, '编辑交互动作流程');
        }}
      />
    )}
    </>
  );
};
