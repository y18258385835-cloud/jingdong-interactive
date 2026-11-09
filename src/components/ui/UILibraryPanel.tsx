import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code2 } from 'lucide-react';
import type { CustomCodePlugin } from '../../types';
import { getContainPreviewScale } from '../../core/render/previewScale';
import { buildCustomCodeSrcDoc, inspectCustomCodePlugin } from '../../utils/customCode';
import { parseRuntimeDiagnostic, type CustomCodeRuntimeDiagnostic } from '../../utils/customCodeRuntimeDiagnostics';
import { Icon } from './Icon';
import { GALAXY_COMPONENT_BASE_SIZE, GALAXY_COMPONENT_LIST, GalaxyComponentType, GalaxyComponentRenderer } from './GalaxyComponents';

interface UILibraryPanelProps {
  onInsert?: (type: string, data: any) => void;
  className?: string;
  includedCategories?: string[];
  includedTypes?: GalaxyComponentType[];
  includedTypesByCategory?: Partial<Record<string, GalaxyComponentType[]>>;
  excludedCategories?: string[];
  excludedTypes?: GalaxyComponentType[];
  categoryOverrides?: Partial<Record<GalaxyComponentType, string>>;
  title?: string;
  description?: string;
  showHeader?: boolean;
  customPlugins?: CustomCodePlugin[];
  customPluginSectionTitle?: string;
  onInsertCustomPlugin?: (plugin: CustomCodePlugin) => void;
  onOpenCustomCodePlugin?: () => void;
}

const HIDDEN_COMPONENT_TYPES = new Set([
  'holo-speedometer', 'holo-cyan-ring', 'holo-orbit-counter', 'holo-micro-dial',
  'holo-bronze-dial', 'holo-army-dial', 'holo-ellipse-meter', 'holo-liquid-orb',
  'holo-water-fill', 'holo-depth-ring', 'holo-tachometer', 'holo-system-meter',
]);

const dashboardPreviewScale = (type: GalaxyComponentType, maxWidth: number, maxHeight: number, cap = 0.7) => {
  const size = GALAXY_COMPONENT_BASE_SIZE[type] || { w: 280, h: 180 };
  return getContainPreviewScale({
    contentWidth: size.w,
    contentHeight: size.h,
    viewportWidth: maxWidth,
    viewportHeight: maxHeight,
    maxScale: cap,
  });
};

const CUSTOM_PLUGIN_VIEWPORT = { w: 1280, h: 720 };

const customPluginPreviewScale = (plugin: CustomCodePlugin, maxWidth: number, maxHeight: number) => getContainPreviewScale({
  contentWidth: Number(plugin.preview?.width) > 0 ? Number(plugin.preview?.width) : CUSTOM_PLUGIN_VIEWPORT.w,
  contentHeight: Number(plugin.preview?.height) > 0 ? Number(plugin.preview?.height) : CUSTOM_PLUGIN_VIEWPORT.h,
  viewportWidth: maxWidth,
  viewportHeight: maxHeight,
  maxScale: 1,
});

const CustomPluginPreviewFrame: React.FC<{ plugin: CustomCodePlugin; instanceId: string; title: string; width: number; height: number }> = ({ plugin, instanceId, title, width, height }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<CustomCodeRuntimeDiagnostic[]>([]);
  const contentWidth = Number(plugin.preview?.width) > 0 ? Number(plugin.preview?.width) : CUSTOM_PLUGIN_VIEWPORT.w;
  const contentHeight = Number(plugin.preview?.height) > 0 ? Number(plugin.preview?.height) : CUSTOM_PLUGIN_VIEWPORT.h;
  const scale = customPluginPreviewScale(plugin, width, height);
  const safePlugin = useMemo(() => {
    const diagnostics = inspectCustomCodePlugin(plugin);
    return diagnostics.errors.length
      ? { ...plugin, html: '<div class="aether-custom-code-missing">组件代码未通过安全检查</div>', css: '', js: '' }
      : plugin;
  }, [plugin]);
  const srcDoc = useMemo(() => buildCustomCodeSrcDoc(safePlugin, instanceId, '#07111d'), [instanceId, safePlugin]);
  const diagnosticErrors = plugin.diagnostics?.errors.map((item) => item.message) || [];
  const previewErrors = [...diagnosticErrors, ...runtimeDiagnostics.filter((item) => item.blocking).map((item) => item.message)].slice(0, 3);
  const previewNotices = runtimeDiagnostics.filter((item) => !item.blocking).slice(-2);
  const isCompact = width <= 180;

  useEffect(() => {
    setIsReady(false);
    setRuntimeDiagnostics([]);
  }, [srcDoc]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'aether-custom-code' || data.instanceId !== instanceId) return;
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
      if (data.type === 'ready') {
        setIsReady(true);
        return;
      }
      if (data.type === 'error') {
        setIsReady(true);
        setRuntimeDiagnostics((current) => [...current, parseRuntimeDiagnostic(data, { category: 'runtime-error', blocking: true })].slice(-5));
        return;
      }
      if (data.type === 'unhandledrejection') {
        setIsReady(true);
        setRuntimeDiagnostics((current) => [...current, parseRuntimeDiagnostic(data, { category: 'unhandled-rejection', blocking: true })].slice(-5));
        return;
      }
      if (data.type === 'diagnostic') {
        setRuntimeDiagnostics((current) => [...current, parseRuntimeDiagnostic(data, { category: 'console', blocking: false, level: 'warning' })].slice(-5));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceId]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#07111d]">
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="shrink-0 border-0"
        style={{
          width: contentWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      />
      {!isReady && previewErrors.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#07111d]/65 text-cyan-100/80">
          <div className={`flex items-center gap-1.5 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
            <Icon name="loader-circle" size={isCompact ? 11 : 13} className="animate-spin" />
            <span>{isCompact ? '预览中' : '正在生成预览'}</span>
          </div>
        </div>
      )}
      {previewErrors.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-red-950/80 p-2 text-center">
          <div className="max-w-full text-red-100">
            <div className={`mb-1 flex items-center justify-center gap-1 font-semibold ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
              <Icon name="alert-circle" size={isCompact ? 11 : 13} />
              <span>预览异常</span>
            </div>
            {!isCompact && <p className="line-clamp-3 text-[10px] leading-4 text-red-100/85">{previewErrors[0]}</p>}
          </div>
        </div>
      )}
      {previewErrors.length === 0 && previewNotices.length > 0 && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded border border-amber-300/20 bg-amber-950/80 px-2 py-1 text-center text-[9px] text-amber-100">
          运行提示：{previewNotices[previewNotices.length - 1].message}
        </div>
      )}
    </div>
  );
};

type PreviewData = Record<string, any>;

const DEFAULT_DATA: Record<string, PreviewData> = {
  'green-outline-button': {
    label: 'CLICK HERE', value: '', color: '#43e97b', textColor: '#333333', fontSize: 16,
    fontFamily: "'Segoe UI', Arial, sans-serif", fontWeight: 'bold', fontStyle: 'normal',
    textDecoration: 'none', textAlign: 'center', letterSpacing: 0, lineHeight: 1.2,
    textOpacity: 100, textPadding: 0, textGlowEnabled: false, textShadowEnabled: false,
  },
  'cyan-solid-button': { label: 'READ MORE', value: '', color: '#4facfe', textColor: '#4facfe', fontSize: 16, fontWeight: '800', textAlign: 'center', letterSpacing: 0, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'auth-toggle-button': { label: 'SIGN IN', secondaryLabel: 'SIGN UP', value: '', color: '#ff0066', textColor: '#ff0066', secondaryTextColor: '#2b2b2b', fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'transparent-bubble-button': { label: 'CLICK HERE', value: '', color: '#00e5ff', textColor: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'blue-bubble-button': { label: 'CLICK HERE', value: '', color: '#0066ff', textColor: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'back-button': { label: 'BACK', value: '', color: '#ff007f', textColor: '#111111', fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'next-button': { label: 'NEXT', value: '', color: '#00e5ff', textColor: '#111111', fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'play-button': { label: 'PLAY', value: '', color: '#0066ff', textColor: '#666666', fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'pause-button': { label: 'PAUSE', value: '', color: '#ff6b9d', textColor: '#666666', fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'pause-button-alt': { label: 'PAUSE', value: '', color: '#ff6b9d', textColor: '#666666', fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'sci-fi-neon-button': { label: 'BUTTON', value: '', color: '#00e5ff', textColor: '#e6f0ff', fontSize: 26, fontWeight: '700', fontStyle: 'italic', textAlign: 'center', letterSpacing: 6, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true, textGlowColor: '#00aaff', textGlowBlur: 15, textGlowIntensity: 65, textShadowEnabled: true },
  'sci-fi-neon-frame-button': { label: 'BUTTON', value: '', color: '#00e5ff', textColor: '#e6f0ff', fontSize: 26, fontWeight: '700', fontStyle: 'italic', textAlign: 'center', letterSpacing: 6, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'sci-fi-polygon-button': { label: 'BUTTON', value: '', color: '#00e5ff', textColor: '#e6f0ff', fontSize: 28, fontWeight: '800', fontStyle: 'italic', textAlign: 'center', letterSpacing: 6, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'sci-fi-node-button': { label: 'BUTTON', value: '', color: '#00e5ff', textColor: '#e6f0ff', fontSize: 28, fontWeight: '800', fontStyle: 'italic', textAlign: 'center', letterSpacing: 6, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'sci-fi-glow-button': { label: 'BUTTON', value: '', color: '#00e5ff', textColor: '#e6f0ff', fontSize: 28, fontWeight: '800', fontStyle: 'italic', textAlign: 'center', letterSpacing: 6, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'sci-fi-stripe-button': { label: 'BUTTON', value: '', color: '#00e5ff', textColor: '#e6f0ff', fontSize: 28, fontWeight: '800', fontStyle: 'italic', textAlign: 'center', letterSpacing: 6, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'data-visualization-header': { label: 'DATA VISUALIZATION', textColor: '#d9fbff', fontSize: 28, fontWeight: '700', letterSpacing: 5, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'visualization-header': { label: 'VISUAL ANALYTICS', textColor: '#d9fbff', fontSize: 28, fontWeight: '700', letterSpacing: 5, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'tech-blue-header': { label: 'SYSTEM OVERVIEW', textColor: '#d9fbff', fontSize: 24, fontWeight: '700', letterSpacing: 5, lineHeight: 1.2, textOpacity: 100, textPadding: 0, textGlowEnabled: true },
  'circle-left-arrow': { color: '#78eaff' },
  'circle-right-arrow': { color: '#78eaff' },
  'triangle-left-arrow': { color: '#78eaff' },
  'triangle-right-arrow': { color: '#78eaff' },
  'rect-left-arrow': { color: '#78eaff' },
  'rect-right-arrow': { color: '#78eaff' },
  'sci-fi-glow-left-arrow': { color: '#00e5ff' },
  'sci-fi-glow-right-arrow': { color: '#00e5ff' },
  'glass-down-arrow': { color: '#39caff' },
  'people-count-blue': { label: '人员总数', value: 5260, textColor: '#d8edf8', valueColor: '#27b6ff', fontSize: 17, valueFontSize: 30, fontWeight: '600', textAlign: 'left', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'people-count-green': { label: '人员总数', value: 5260, textColor: '#d8edf8', valueColor: '#43e97b', fontSize: 17, valueFontSize: 30, fontWeight: '600', textAlign: 'left', letterSpacing: 1, lineHeight: 1.2, textOpacity: 100, textPadding: 0 },
  'module-lightning': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-star': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-bubble': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-car': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-user': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-flask': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-user-icon': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-flask-icon': { label: '模块标题', value: 1520, textColor: '#8da2b5', valueColor: '#00e5ff', fontSize: 18, valueFontSize: 34, max: 3000, textOpacity: 100, textPadding: 0 },
  'module-data': { label: '我是数据', value: 8888, textColor: '#ffffff', valueColor: '#00e5ff', fontSize: 22, valueFontSize: 44, max: 10000, textOpacity: 100, textPadding: 0 },
  'pattern-prediction-chart': {
    label: '规律预判',
    chartData: [
      { xLabel: '4.1', value: 4000 }, { xLabel: '4.2', value: 1000 }, { xLabel: '4.3', value: 4000 },
      { xLabel: '4.4', value: 2500 }, { xLabel: '4.5', value: 6500 }, { xLabel: '4.6', value: 4500 },
      { xLabel: '4.7', value: 4000 }, { xLabel: '4.8', value: 5500 }, { xLabel: '4.9', value: 4000 },
      { xLabel: '4.10', value: 1500 }, { xLabel: '4.11', value: 4000 },
    ],
    maxY: 8000,
    ySteps: 4,
    textColor: '#00f0ff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    textOpacity: 100,
    textPadding: 0,
  },
  'data-trend-chart': { label: '数据趋势', chartData: [{ xLabel: '4.1', value: 2600 }, { xLabel: '4.2', value: 4200 }, { xLabel: '4.3', value: 3400 }, { xLabel: '4.4', value: 2000 }], maxY: 6000, textColor: '#00f0ff', fontSize: 18, fontWeight: '600', letterSpacing: 3, textOpacity: 100, textPadding: 0 },
  'data-trend-cyber-chart': { label: '数据趋势 · 科幻图表', chartData: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'].map((xLabel, index) => ({ xLabel, value: [8, 10, 12, 16, 25, 32.6, 42.1, 18, 22, 29, 36, 14, 30, 25, 40, 28, 44, 18, 34, 27, 38, 21, 31][index] })), maxY: 50, textColor: '#b96cff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'data-trend-area-chart': { label: '数据趋势 · 面积图', chartData: [22, 28, 36, 42, 52, 62, 48, 56, 68, 45, 38, 46, 52, 60, 42, 34, 48, 58, 36].map((value, index) => ({ xLabel: String(12 + index * 5), value })), maxY: 80, textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'data-trend-dual-area-chart': { label: '数据趋势 · 双曲线面积图', dualData: [{ xLabel: '4.1', valueA: 35, valueB: 52, tag: 'A' }, { xLabel: '4.2', valueA: 68, valueB: 88, tag: 'B' }, { xLabel: '4.3', valueA: 92, valueB: 64, tag: 'C' }, { xLabel: '4.4', valueA: 48, valueB: 56, tag: 'D' }], maxY: 100, textColor: '#ff4fd8', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'cyber-bubble-chart': { label: '数据趋势 · 赛博发光气泡图', bubbles: [{ value: 61, x: 44, y: 40, label: '61%' }, { value: 21, x: 60, y: 75, label: '21%' }, { value: 10, x: 82, y: 50, label: '10%' }, { value: 8, x: 84, y: 82, label: '8%' }, { value: 2, x: 22, y: 72, label: '2%' }], textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'cyber-ring-chart': { label: '数据趋势 · 赛博发光圆环图', rings: [{ value: 68, label: '68°', x: 38, y: 40 }, { value: 16, label: '16%', x: 65, y: 65 }], textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'cyber-multi-ring-chart': { label: '数据趋势 · 赛博发光圆环图（多环版本）', rings: [{ value: 60, label: '60%', x: 38, y: 35, r: 95, strokeWidth: 16 }, { value: 20, label: '20%', x: 72, y: 52, r: 75, strokeWidth: 14 }, { value: 14, label: '14%', x: 55, y: 78, r: 62, strokeWidth: 10, isDashed: true }, { value: 6, label: '6%', x: 28, y: 80, r: 48, strokeWidth: 12 }, { value: 6, label: '6%', x: 84, y: 84, r: 40, strokeWidth: 10 }], textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'cyber-hud-gauge': { label: '数据趋势 · 赛博 HUD 仪表盘', value: 84, unit: '%', min: 0, max: 100, textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'cyber-radar-chart': { label: '数据趋势 · 赛博雷达图', radarData: [{ label: '维度一', valueA: 85, valueB: 65 }, { label: '维度二', valueA: 75, valueB: 50 }, { label: '维度三', valueA: 90, valueB: 70 }, { label: '维度四', valueA: 65, valueB: 80 }, { label: '维度五', valueA: 80, valueB: 60 }, { label: '维度六', valueA: 70, valueB: 55 }], textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'cyber-3d-donut-chart': { label: '数据趋势 · 赛博3D环形图', donutData: [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }], depth: 24, textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'distribution-stat-chart': { label: '数据分布统计', distributionData: [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }], textColor: '#00f0ff', fontSize: 18, textOpacity: 100, textPadding: 0 },
  'pyramid-distribution-chart': { label: '数据分布统计', pyramidData: [{ name: 'XXXXXXXXX', value: 35, c1: '#5eead4', c2: '#2dd4bf', side: 'right' }, { name: 'XXXXXXXXX', value: 30, c1: '#22d3ee', c2: '#0891b2', side: 'left' }, { name: 'XXXXXXXXX', value: 20, c1: '#3b82f6', c2: '#1e40af', side: 'right' }, { name: 'XXXXXXXXX', value: 15, c1: '#1e40af', c2: '#0c2461', side: 'left' }], textColor: '#7fe4ff', textOpacity: 100, textPadding: 0 },
  'flip-number': { label: '实时吞吐量', value: 12840, unit: '条 / min' },
  gauge: { label: '系统负载', value: 72, unit: '%' },
  'trend-line': { label: '趋势分析', series: [32, 46, 41, 58, 52, 68, 64, 78], categories: ['一', '二', '三', '四', '五', '六', '七', '八'] },
  'bar-chart': { label: '排行分析', series: [46, 68, 54, 82, 61, 74], categories: ['一', '二', '三', '四', '五', '六'] },
  'donut-chart': { label: '完成率', value: 76, unit: '%' },
  'factory-floor': {
    label: '生产设备实时布局', theme: 'light', textColor: '#172033', mutedTextColor: '#64748b', surfaceColor: '#ffffff', borderColor: '#dce4ec',
    devices: [
      { id: 'press-01', name: '冲压线 A', status: '运行', x: 26, y: 28, value: 86, unit: '件/min', color: '#3978ed' },
      { id: 'weld-02', name: '焊接单元 B', status: '运行', x: 55, y: 28, value: 74, unit: '件/min', color: '#20b486' },
      { id: 'inspect-03', name: '质检工位 C', status: '待机', x: 55, y: 56, value: 51, unit: '件/min', color: '#f3a324' },
    ],
  },
  'stats-table': { label: '统计表', rows: [{ label: '北区站点', value: '98.6%', status: '正常' }, { label: '南区站点', value: '94.2%', status: '预警' }, { label: '边缘网关', value: '1.8s', status: '在线' }] },
  'alert-list': { label: '告警动态', items: [{ label: '冷却回路压力偏低', value: '08:42', status: '预警' }, { label: '北斗终端已恢复', value: '08:39', status: '信息' }, { label: '电池组温度正常', value: '08:36', status: '正常' }] },
  freshness: { label: '数据新鲜度', freshnessMs: 1200 },
  'gradient-progress': { label: '处理进度', value: 65, unit: '%' },
  'progress-ring': { label: '完成百分比', value: 75, unit: '%' },
  'metric-card': { label: '核心指标', value: 86.4, unit: '%' },
  'glass-card': { title: '玻璃卡片', content: '实时数据与关键说明' },
  'gradient-card': { title: '渐变卡片', content: '聚合后的重要信息' },
  'neon-card': { title: '霓虹卡片', content: '交互提示与状态' },
};

const DATA_FIELDS: Record<string, Array<{ key: string; label: string; type?: 'number' | 'text' | 'textarea' | 'array-number' | 'array-text' | 'chart-points' | 'json' }>> = {
  'green-outline-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'cyan-solid-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'auth-toggle-button': [{ key: 'label', label: '登录文字' }, { key: 'secondaryLabel', label: '注册文字' }],
  'transparent-bubble-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'blue-bubble-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'back-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'next-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'play-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'pause-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'pause-button-alt': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'sci-fi-neon-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'sci-fi-neon-frame-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'sci-fi-polygon-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'sci-fi-node-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'sci-fi-glow-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'sci-fi-stripe-button': [{ key: 'label', label: '按钮文字' }, { key: 'value', label: '缩放数字（可选）', type: 'number' }],
  'data-visualization-header': [{ key: 'label', label: '标题文字' }],
  'visualization-header': [{ key: 'label', label: '标题文字' }],
  'tech-blue-header': [{ key: 'label', label: '标题文字' }],
  'circle-left-arrow': [{ key: 'color', label: '箭头颜色' }],
  'circle-right-arrow': [{ key: 'color', label: '箭头颜色' }],
  'triangle-left-arrow': [{ key: 'color', label: '箭头颜色' }],
  'triangle-right-arrow': [{ key: 'color', label: '箭头颜色' }],
  'rect-left-arrow': [{ key: 'color', label: '箭头颜色' }],
  'rect-right-arrow': [{ key: 'color', label: '箭头颜色' }],
  'sci-fi-glow-left-arrow': [{ key: 'color', label: '箭头颜色' }],
  'sci-fi-glow-right-arrow': [{ key: 'color', label: '箭头颜色' }],
  'glass-down-arrow': [{ key: 'color', label: '箭头颜色' }],
  'people-count-blue': [{ key: 'label', label: '标签文字' }, { key: 'value', label: '人数', type: 'number' }],
  'people-count-green': [{ key: 'label', label: '标签文字' }, { key: 'value', label: '人数', type: 'number' }],
  'module-lightning': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-star': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-bubble': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-car': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-user': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-flask': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-user-icon': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-flask-icon': [{ key: 'label', label: '模块标题' }, { key: 'value', label: '数据值', type: 'number' }],
  'module-data': [{ key: 'label', label: '标签文字' }, { key: 'value', label: '数据值（0-10000）', type: 'number' }],
  'pattern-prediction-chart': [{ key: 'label', label: '标题文字' }, { key: 'chartData', label: '数据点（每行：横轴标签 | 数值）', type: 'chart-points' }, { key: 'maxY', label: '纵轴最大值', type: 'number' }, { key: 'ySteps', label: '纵轴分段数', type: 'number' }],
  'data-trend-chart': [{ key: 'label', label: '标题文字' }, { key: 'chartData', label: '数据点（每行：横轴标签 | 数值）', type: 'chart-points' }, { key: 'maxY', label: '纵轴最大值', type: 'number' }],
  'data-trend-cyber-chart': [{ key: 'label', label: '标题文字' }, { key: 'chartData', label: '数据点（每行：横轴标签 | 数值）', type: 'chart-points' }, { key: 'maxY', label: '纵轴最大值', type: 'number' }],
  'data-trend-area-chart': [{ key: 'label', label: '标题文字' }, { key: 'chartData', label: '数据点（每行：横轴标签 | 数值）', type: 'chart-points' }, { key: 'maxY', label: '纵轴最大值', type: 'number' }],
  'data-trend-dual-area-chart': [{ key: 'label', label: '标题文字' }, { key: 'dualData', label: '双曲线数据（JSON）', type: 'json' }, { key: 'maxY', label: '纵轴最大值', type: 'number' }],
  'cyber-bubble-chart': [{ key: 'label', label: '标题文字' }, { key: 'bubbles', label: '气泡数据（JSON）', type: 'json' }],
  'cyber-ring-chart': [{ key: 'label', label: '标题文字' }, { key: 'rings', label: '圆环数据（JSON）', type: 'json' }],
  'cyber-multi-ring-chart': [{ key: 'label', label: '标题文字' }, { key: 'rings', label: '多环数据（JSON）', type: 'json' }],
  'cyber-hud-gauge': [{ key: 'label', label: '标题文字' }, { key: 'value', label: '仪表数值', type: 'number' }, { key: 'unit', label: '单位' }],
  'cyber-radar-chart': [{ key: 'label', label: '标题文字' }, { key: 'radarData', label: '雷达维度数据（JSON）', type: 'json' }],
  'cyber-3d-donut-chart': [{ key: 'label', label: '标题文字' }, { key: 'donutData', label: '环形分布数据（JSON）', type: 'json' }, { key: 'depth', label: '立体厚度（px）', type: 'number' }],
  'distribution-stat-chart': [{ key: 'label', label: '标题文字' }, { key: 'distributionData', label: '分布数据（JSON）', type: 'json' }],
  'pyramid-distribution-chart': [{ key: 'label', label: '标题文字' }, { key: 'pyramidData', label: '金字塔分层数据（JSON）', type: 'json' }],
  'flip-number': [{ key: 'label', label: '标题' }, { key: 'value', label: '数值', type: 'number' }, { key: 'unit', label: '单位' }],
  gauge: [{ key: 'label', label: '标题' }, { key: 'value', label: '数值 0-100', type: 'number' }, { key: 'unit', label: '单位' }],
  'trend-line': [{ key: 'label', label: '标题' }, { key: 'series', label: '数据序列', type: 'array-number' }, { key: 'categories', label: '横轴标签', type: 'array-text' }],
  'bar-chart': [{ key: 'label', label: '标题' }, { key: 'series', label: '数据序列', type: 'array-number' }, { key: 'categories', label: '横轴标签', type: 'array-text' }],
  'donut-chart': [{ key: 'label', label: '标题' }, { key: 'value', label: '完成率 0-100', type: 'number' }, { key: 'unit', label: '单位' }],
  'stats-table': [{ key: 'label', label: '标题' }, { key: 'rows', label: '表格行（每行：名称 | 数值 | 状态）', type: 'textarea' }],
  'alert-list': [{ key: 'label', label: '标题' }, { key: 'items', label: '告警行（每行：名称 | 时间 | 状态）', type: 'textarea' }],
  freshness: [{ key: 'label', label: '标题' }, { key: 'freshnessMs', label: '延迟毫秒', type: 'number' }],
  'gradient-progress': [{ key: 'label', label: '标题' }, { key: 'value', label: '进度 0-100', type: 'number' }],
  'progress-ring': [{ key: 'label', label: '标题' }, { key: 'value', label: '百分比 0-100', type: 'number' }],
  'metric-card': [{ key: 'label', label: '标题' }, { key: 'value', label: '数值', type: 'number' }, { key: 'unit', label: '单位' }],
  'glass-card': [{ key: 'title', label: '标题' }, { key: 'content', label: '内容', type: 'textarea' }],
  'gradient-card': [{ key: 'title', label: '标题' }, { key: 'content', label: '内容', type: 'textarea' }],
  'neon-card': [{ key: 'title', label: '标题' }, { key: 'content', label: '内容', type: 'textarea' }],
};

const cloneData = (data: PreviewData): PreviewData => ({ ...data, series: data.series ? [...data.series] : undefined, categories: data.categories ? [...data.categories] : undefined, chartData: data.chartData ? data.chartData.map((point: any) => ({ ...point })) : undefined, dualData: data.dualData ? data.dualData.map((point: any) => ({ ...point })) : undefined, bubbles: data.bubbles ? data.bubbles.map((point: any) => ({ ...point })) : undefined, rings: data.rings ? data.rings.map((point: any) => ({ ...point })) : undefined, radarData: data.radarData ? data.radarData.map((point: any) => ({ ...point })) : undefined, donutData: data.donutData ? data.donutData.map((point: any) => ({ ...point })) : undefined, distributionData: data.distributionData ? data.distributionData.map((point: any) => ({ ...point })) : undefined, pyramidData: data.pyramidData ? data.pyramidData.map((point: any) => ({ ...point })) : undefined, rows: data.rows ? data.rows.map((row: any) => ({ ...row })) : undefined, items: data.items ? data.items.map((item: any) => ({ ...item })) : undefined });
const serializeRows = (rows: any[] = []) => rows.map((row) => `${row.label} | ${row.value} | ${row.status || ''}`).join('\n');
const parseRows = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const [label = '', value = '', status = ''] = line.split('|').map((item) => item.trim()); return { label, value, status }; });
const serializeChartPoints = (points: any[] = []) => points.map((point) => `${point.xLabel} | ${point.value}`).join('\n');
const parseChartPoints = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => { const [xLabel = String(index + 1), rawValue = '0'] = line.split('|').map((item) => item.trim()); return { xLabel, value: Number(rawValue) || 0 }; });

export const UILibraryPanel: React.FC<UILibraryPanelProps> = ({ onInsert, className = '', includedCategories, includedTypes, includedTypesByCategory = {}, excludedCategories = [], excludedTypes = [], categoryOverrides = {}, title = 'Galaxy UI 组件库', description = '选择组件并在预览区实时编辑', showHeader = true, customPlugins = [], customPluginSectionTitle = '已保存的自定义组件', onInsertCustomPlugin, onOpenCustomCodePlugin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('#06b6d4');
  const [activeCategory, setActiveCategory] = useState<string>('全部');  const [selectedType, setSelectedType] = useState<GalaxyComponentType | null>(null);
  const [selectedCustomPluginId, setSelectedCustomPluginId] = useState<string | null>(null);
  const skipAutoSelectRef = useRef(false);
  const [previewData, setPreviewData] = useState<PreviewData>({});
  const availableComponents = useMemo(() => GALAXY_COMPONENT_LIST
    .map((component) => ({ ...component, category: categoryOverrides[component.type] || component.category }))
    .filter((component) => {
      const categoryAllowlist = includedTypesByCategory[component.category];
      return !HIDDEN_COMPONENT_TYPES.has(component.type)
        && !['全息仪表', 'Holographic gauges', 'Holographic Gauges'].includes(component.category)
        && (!includedCategories || includedCategories.includes(component.category))
        && (!includedTypes || includedTypes.includes(component.type))
        && (!categoryAllowlist || categoryAllowlist.includes(component.type))
        && !excludedCategories.includes(component.category)
        && !excludedTypes.includes(component.type);
    }), [includedCategories, includedTypes, includedTypesByCategory, excludedCategories, excludedTypes, categoryOverrides]);
  const categories = ['全部', ...Array.from(new Set(availableComponents.map((component) => component.category)))];
  const filteredComponents = availableComponents.filter((component) => (activeCategory === '全部' || component.category === activeCategory) && (!searchQuery || component.name.toLowerCase().includes(searchQuery.toLowerCase()) || component.type.toLowerCase().includes(searchQuery.toLowerCase())));
  const filteredCustomPlugins = customPlugins.filter((plugin) => !searchQuery || `${plugin.name} ${plugin.description || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const showCustomCodeEntry = Boolean(onOpenCustomCodePlugin)
    && activeCategory === '全部'
    && (!searchQuery || '自定义代码组件 html css javascript'.includes(searchQuery.toLowerCase()));
  const selectedComponent = availableComponents.find((component) => component.type === selectedType) || null;
  const selectedCustomPlugin = customPlugins.find((plugin) => plugin.id === selectedCustomPluginId) || null;
  // 精选组件：给组件库一个明确的视觉焦点，避免所有卡片看起来一样。
  const FEATURED_TYPES: GalaxyComponentType[] = ['glass-card', 'metric-card', 'sci-fi-neon-button', 'data-visualization-header'];
  const featuredComponents = activeCategory === '全部' && !searchQuery
    ? FEATURED_TYPES
      .map((type) => availableComponents.find((component) => component.type === type))
      .filter((component): component is (typeof availableComponents)[number] => Boolean(component))
    : [];
  useEffect(() => { if (selectedType && !availableComponents.some((component) => component.type === selectedType)) setSelectedType(null); }, [availableComponents, selectedType]);
  useEffect(() => { if (selectedCustomPluginId && !customPlugins.some((plugin) => plugin.id === selectedCustomPluginId)) setSelectedCustomPluginId(null); }, [customPlugins, selectedCustomPluginId]);
  const selectComponent = (type: GalaxyComponentType) => { setSelectedCustomPluginId(null); setSelectedType(type); setPreviewData({ color: selectedColor, ...cloneData(DEFAULT_DATA[type] || {}), ...(type.includes('card') ? { accentColor: selectedColor, align: 'center' } : {}) }); };
  const selectCustomPlugin = (plugin: CustomCodePlugin) => { setSelectedType(null); setSelectedCustomPluginId(plugin.id); };
  // 打开组件库时自动预览第一个组件（优先精选），让右侧有明确的视觉焦点。
  useEffect(() => {
    if (skipAutoSelectRef.current) { skipAutoSelectRef.current = false; return; }
    const defaultPreview = featuredComponents[0] || filteredComponents[0];
    if (!selectedType && !selectedCustomPluginId && defaultPreview) {
      selectComponent(defaultPreview.type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredComponents, featuredComponents, selectedType, selectedCustomPluginId]);
  const updateField = (key: string, value: string) => { const field = (DATA_FIELDS[selectedType || ''] || []).find((item) => item.key === key); let next: any = value; if (field?.type === 'number') next = value === '' ? '' : Number(value); if (field?.type === 'array-number') next = value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)); if (field?.type === 'array-text') next = value.split(',').map((item) => item.trim()).filter(Boolean); if (field?.type === 'json') { try { next = JSON.parse(value); } catch { return; } } if (key === 'rows' || key === 'items') next = parseRows(value); if (key === 'chartData') { next = parseChartPoints(value); setPreviewData((current) => ({ ...current, chartData: next, series: next.map((point: any) => point.value), categories: next.map((point: any) => point.xLabel) })); return; } setPreviewData((current) => ({ ...current, [key]: next })); };
  const fieldValue = (key: string, type?: string) => { const value = previewData[key]; if (key === 'rows' || key === 'items') return serializeRows(value || []); if (key === 'chartData') return serializeChartPoints(value || []); if (type === 'json') return JSON.stringify(value || [], null, 2); if (Array.isArray(value)) return value.join(type === 'array-number' ? ', ' : ', '); return value ?? ''; };
  const insertCurrent = () => { if (selectedType) onInsert?.(selectedType, { ...previewData, color: selectedColor }); };
  const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];
  const renderComponentCard = (component: (typeof GALAXY_COMPONENT_LIST)[number], featured = false) => {
    const isSelected = selectedType === component.type;
    const isCard = component.category === '卡片';
    const selectOnKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      selectComponent(component.type);
    };
    return <div
      key={component.type}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => selectComponent(component.type)}
      onKeyDown={selectOnKeyDown}
      className={`group relative flex flex-col overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-200 ${isSelected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/15' : 'border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-black/30'}`}
    >
      <div
        className={`relative mb-2.5 flex ${featured ? 'h-36' : 'h-28'} items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-[#0a1422]`}
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.10), transparent 65%)' }}
      >
        <div style={{ transform: `scale(${dashboardPreviewScale(component.type as GalaxyComponentType, featured ? 280 : (isCard ? 230 : 200), featured ? 136 : 104, featured ? 0.62 : (isCard ? 0.34 : 0.72))})`, transformOrigin: 'center' }}>
          <GalaxyComponentRenderer type={component.type as GalaxyComponentType} data={{ color: selectedColor, ...(isCard ? { accentColor: selectedColor, align: 'center' } : {}) }} />
        </div>
        {isSelected && <span className="absolute left-2 top-2 rounded-full bg-cyan-400 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">已选</span>}
        <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[9px] font-medium text-cyan-200/0 transition-colors group-hover:text-cyan-200/90">点击编辑 →</span>
      </div>
      <p title={component.name} className="truncate text-xs font-semibold text-white transition-colors group-hover:text-cyan-200">{component.name}</p>
      <span className="mt-1 w-fit rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-400">{component.category}</span>
    </div>;
  };
  const renderCustomPluginCard = (plugin: CustomCodePlugin) => {
    const isSelected = selectedCustomPluginId === plugin.id;
    return <button
      key={plugin.id}
      type="button"
      onClick={() => selectCustomPlugin(plugin)}
      aria-pressed={isSelected}
      className={`group relative flex flex-col overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-200 ${isSelected ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/15' : 'border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-black/30'}`}
    >
      <div
        className="relative mb-2.5 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-white/[0.06] bg-[#0a1422]"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.10), transparent 65%)' }}
      >
        <div className="pointer-events-none h-full w-full">
          <CustomPluginPreviewFrame plugin={plugin} instanceId={`library-${plugin.id}`} title={`${plugin.name} 缩略预览`} width={200} height={104} />
        </div>
        {isSelected && <span className="absolute left-2 top-2 rounded-full bg-cyan-400 px-1.5 py-0.5 text-[9px] font-bold text-slate-950">已选</span>}
        <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[9px] font-medium text-cyan-200/0 transition-colors group-hover:text-cyan-200/90">点击编辑 →</span>
      </div>
      <p title={plugin.name} className="truncate text-xs font-semibold text-white group-hover:text-cyan-200">{plugin.name}</p>
      <span className="mt-1 w-fit rounded bg-cyan-400/10 px-1.5 py-0.5 text-[9px] text-cyan-300/80">自定义代码</span>
    </button>;
  };
  const renderCustomCodeEntryCard = () => {
    if (!onOpenCustomCodePlugin) return null;
    return <button
      type="button"
      onClick={onOpenCustomCodePlugin}
      className="group relative overflow-hidden rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[.12] via-slate-900/80 to-purple-500/[.12] p-3 text-left transition hover:border-cyan-300/80 hover:shadow-lg hover:shadow-cyan-500/10"
      aria-label="打开自定义代码组件"
    >
      <div className="mb-2.5 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-cyan-300/20 bg-slate-950/70">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 transition-transform group-hover:scale-110">
          <Code2 size={25} strokeWidth={1.8} />
        </div>
      </div>
      <p className="truncate text-xs font-semibold text-white group-hover:text-cyan-200">自定义代码组件</p>
      <span className="mt-1 w-fit rounded bg-cyan-400/10 px-1.5 py-0.5 text-[9px] text-cyan-300/80">HTML · CSS · JS</span>
      <span className="absolute right-2 top-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] text-cyan-200">&lt;/&gt;</span>
    </button>;
  };
  const renderSelectedComponentPanel = () => {
    if (!selectedComponent || !selectedType) return null;
    const fields = DATA_FIELDS[selectedType] || [{ key: 'label', label: '组件文字' }];

    return <>
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">{selectedComponent.name}</p>
            <p className="text-[10px] text-slate-500">实时预览与数据编辑</p>
          </div>
          <button type="button" onClick={() => { skipAutoSelectRef.current = true; setSelectedType(null); }} className="text-slate-500 hover:text-white" aria-label="清除选择">
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>
      <div className="p-3 border-b border-white/10">
        <div
          className="relative flex h-[220px] items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a1422]"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.12), transparent 70%)' }}
        >
          <div style={{ transform: `scale(${dashboardPreviewScale(selectedType, 320, 200, 0.9)})`, transformOrigin: 'center' }}>
            <GalaxyComponentRenderer
              type={selectedType}
              data={{ ...previewData, color: selectedColor }}
              onDataChange={(patch) => setPreviewData((current) => ({ ...current, ...patch }))}
            />
          </div>
          <span className="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 text-[9px] text-cyan-200/80">实时预览</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {fields.map((field) => <label key={field.key} className="block">
          <span className="mb-1 block text-[10px] text-slate-400">{field.label}</span>
          {field.type === 'textarea' || field.type === 'chart-points' || field.type === 'json' ? (
            <textarea
              value={fieldValue(field.key, field.type)}
              onChange={(event) => updateField(field.key, event.target.value)}
              rows={field.type === 'chart-points' ? 6 : field.type === 'json' ? 8 : 3}
              className="w-full resize-y rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400/50"
            />
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={fieldValue(field.key, field.type)}
              onChange={(event) => updateField(field.key, event.target.value)}
              className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400/50"
            />
          )}
        </label>)}
      </div>
      <div className="p-3 border-t border-white/10">
        <button type="button" onClick={insertCurrent} className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors">插入当前组件</button>
      </div>
    </>;
  };
  const renderSelectedCustomPluginPanel = () => {
    if (!selectedCustomPlugin) return null;

    return <>
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{selectedCustomPlugin.name}</p>
            <p className="text-[10px] text-slate-500">{selectedCustomPlugin.description || '自定义代码组件'}</p>
          </div>
          <button type="button" onClick={() => setSelectedCustomPluginId(null)} className="text-slate-500 hover:text-white" aria-label="清除选择">
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>
      <div className="p-3 border-b border-white/10">
        <div className="flex h-[260px] items-center justify-center overflow-hidden rounded-lg border border-cyan-400/20 bg-[#07111d]">
          <CustomPluginPreviewFrame
            plugin={selectedCustomPlugin}
            instanceId={`library-selected-${selectedCustomPlugin.id}`}
            title={`${selectedCustomPlugin.name} 预览`}
            width={330}
            height={240}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="rounded-lg border border-white/10 bg-white/[.03] p-3">
          <p className="text-[10px] leading-5 text-slate-400">预览使用已保存的自定义代码生成，不会修改组件的外观、编辑或动效。</p>
        </div>
      </div>
      <div className="p-3 border-t border-white/10">
        <button type="button" onClick={() => onInsertCustomPlugin?.(selectedCustomPlugin)} className="w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition-colors">插入当前组件</button>
      </div>
    </>;
  };
  const renderPreviewPanel = () => {
    if (selectedComponent) return renderSelectedComponentPanel();
    if (selectedCustomPlugin) return renderSelectedCustomPluginPanel();

    return <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-500">
      <Icon name="target" size={26} className="mb-3 opacity-60" />
      <p className="text-xs text-slate-300">选择一个组件开始编辑</p>
      <p className="text-[10px] mt-1">修改文字或数字，预览会同步更新</p>
    </div>;
  };

  return <div className={`flex flex-col h-full bg-slate-900 ${className}`}>
    {showHeader && <div className="p-3 border-b border-white/10"><h3 className="text-sm font-bold text-white flex items-center gap-2"><Icon name="grid" size={16} className="text-cyan-400" />{title}</h3><p className="text-[10px] text-slate-500 mt-0.5">{description}</p></div>}
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      <section className="flex-1 min-w-0 min-h-0 flex flex-col border-r border-white/10">
        <div className="p-3 border-b border-white/10"><div className="relative"><Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索组件..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50" /></div></div>
        <div className="p-3 border-b border-white/10"><p className="text-[10px] text-slate-400 mb-2">主题色</p><div className="flex gap-2">{colors.map((color) => <button key={color} type="button" onClick={() => { setSelectedColor(color); setPreviewData((data) => ({ ...data, color, ...(data.accentColor ? { accentColor: color } : {}) })); }} className={`w-6 h-6 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110'}`} style={{ background: color }} aria-label={`选择主题色 ${color}`} aria-pressed={selectedColor === color} />)}</div></div>
        {categories.length > 2 && <div className="flex flex-wrap gap-1 p-3 border-b border-white/10">{categories.map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activeCategory === category ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'}`}>{category}</button>)}</div>}
        <div className="flex-1 overflow-y-auto p-3"><div className="grid grid-cols-2 gap-3">{featuredComponents.length > 0 && <div className="col-span-2 mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-200/80"><span className="h-px flex-1 bg-gradient-to-r from-cyan-400/40 to-transparent" />精选组件<span className="h-px flex-1 bg-gradient-to-l from-cyan-400/40 to-transparent" /></div>}{featuredComponents.map((component) => renderComponentCard(component, true))}{showCustomCodeEntry && renderCustomCodeEntryCard()}{filteredComponents.filter((component) => !featuredComponents.some((featured) => featured.type === component.type)).map((component) => renderComponentCard(component))}</div>{activeCategory === '全部' && filteredCustomPlugins.length > 0 && <div className="mt-5"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-cyan-200"><Code2 size={13} />{customPluginSectionTitle}</div><div className="grid grid-cols-2 gap-3">{filteredCustomPlugins.map(renderCustomPluginCard)}</div></div>}{filteredComponents.length === 0 && (activeCategory !== '全部' || filteredCustomPlugins.length === 0) && !showCustomCodeEntry && <div className="flex flex-col items-center justify-center h-40 text-slate-500"><Icon name="search" size={32} className="mb-2 opacity-50" /><p className="text-xs">没有找到匹配的组件</p></div>}</div>
      </section>
      <aside className="w-full lg:w-[360px] shrink-0 min-h-0 flex flex-col bg-slate-950/35">
        {renderPreviewPanel()}
      </aside>
    </div>
    <div className="p-2 border-t border-white/10 bg-white/5"><p className="text-[10px] text-slate-500 text-center">共 {availableComponents.length + customPlugins.length} 个组件 · 全息仪表组件已从组件库移除</p></div>
  </div>;
};

export default UILibraryPanel;
