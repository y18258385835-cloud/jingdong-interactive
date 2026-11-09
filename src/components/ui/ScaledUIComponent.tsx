import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, memo } from 'react';
import { GALAXY_COMPONENT_BASE_SIZE, GalaxyComponentRenderer, GalaxyComponentType } from './GalaxyComponents';
import { useMockTelemetrySignal } from '../../core/realtime/mockTelemetry';
import { isMqttRealtimeSource, useRealtimeTelemetrySignal } from '../../core/realtime/realtimeTelemetry';
import type { ContinuousInteractionNode } from '../../types';
import { applyTextOverrides, collectEditableTextElements } from '../../utils/textEditing';

type RuntimeSource = Record<string, any>;

const readPath = (source: RuntimeSource, path?: string): any => {
  if (!path) return undefined;
  return path.split(/[.[\]]+/).filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], source);
};

const normalizeStatus = (status: any): 'normal' | 'info' | 'warning' | 'critical' | 'offline' | 'unknown' => {
  const value = String(status ?? '').toLowerCase();
  if (['normal', 'running', 'online', 'connected', 'ok', 'healthy', '正常', '运行中', '在线'].includes(value)) return 'normal';
  if (['info', 'information', '信息'].includes(value)) return 'info';
  if (['warning', 'warn', 'alert', '预警', '警告'].includes(value)) return 'warning';
  if (['critical', 'error', 'fault', '严重', '故障'].includes(value)) return 'critical';
  if (['offline', 'disconnected', '离线'].includes(value)) return 'offline';
  return 'unknown';
};

/** 将模拟/录制源数据按绑定映射投影为组件数据，编辑器和导出运行时共用同一契约。 */
const projectRuntimeData = (base: any, source: RuntimeSource) => {
  const binding = base?.dataBinding || {};
  const mapping = binding.mapping || {};
  const value = readPath(source, mapping.value) ?? source.value ?? base.value;
  const label = readPath(source, mapping.label) ?? source.label ?? base.label;
  const unit = readPath(source, mapping.unit) ?? source.unit ?? base.unit;
  const color = readPath(source, mapping.color) ?? source.color ?? base.color;
  const statusValue = readPath(source, mapping.status) ?? source.status ?? base.status;
  const freshnessMs = Number(readPath(source, mapping.freshness) ?? source.freshnessMs ?? base.freshnessMs ?? 1200);
  const thresholds = binding.thresholds || {};
  // 未绑定实时数据源的组件（卡片、状态徽章、摄像头等）保留作者填写的中文状态文案；
  // 只有接入遥测/数据绑定的组件才归一化为 normal/warning 等运行时枚举。
  const hasDataBinding = Boolean(binding && (binding.sourceId || binding.mapping));
  let status = hasDataBinding ? normalizeStatus(statusValue) : String(statusValue ?? normalizeStatus(statusValue));
  if (hasDataBinding && Number.isFinite(Number(value)) && !statusValue) {
    const numeric = Number(value);
    const warning = Number(thresholds.warning);
    const critical = Number(thresholds.critical);
    const direction = thresholds.direction === 'below' ? 'below' : 'above';
    const hit = (threshold: number) => Number.isFinite(threshold) && (direction === 'below' ? numeric <= threshold : numeric >= threshold);
    if (hit(critical)) status = 'critical';
    else if (hit(warning)) status = 'warning';
    else status = 'normal';
  }
  const offlineAfterMs = Number(binding.freshness?.offlineAfterMs ?? 15000);
  const warningAfterMs = Number(binding.freshness?.warningAfterMs ?? 5000);
  if (hasDataBinding) {
    if (freshnessMs >= offlineAfterMs) status = 'offline';
    else if (freshnessMs >= warningAfterMs && status === 'normal') status = 'warning';
  }
  return {
    ...base,
    value: Number.isFinite(Number(value)) ? Number(value) : base.value,
    label,
    unit,
    color,
    status,
    freshnessMs,
    content: readPath(source, mapping.content) ?? source.content ?? base.content,
    series: (readPath(source, mapping.series) ?? source.series ?? readPath(source, 'metrics.series') ?? base.series),
    categories: (readPath(source, mapping.categories) ?? source.categories ?? readPath(source, 'metrics.categories') ?? base.categories),
    rows: (readPath(source, mapping.rows) ?? source.rows ?? readPath(source, 'data.rows') ?? base.rows),
    items: (readPath(source, mapping.items) ?? source.items ?? readPath(source, 'data.items') ?? base.items),
    location: readPath(source, mapping.location) ?? source.location ?? base.location,
    topology: readPath(source, mapping.topology) ?? source.topology ?? base.topology,
    dataBinding: binding,
  };
};

interface ScaledUIComponentProps {
  type: GalaxyComponentType;
  data?: any;
  /** 可选：显式指定组件原始设计尺寸（px）。不传时运行时实测内容原始尺寸。 */
  baseWidth?: number;
  baseHeight?: number;
  assetUrl?: string;
  interactive?: boolean;
  locked?: boolean;
  onContinuousNodeTrigger?: (node: ContinuousInteractionNode) => void;
  textEditing?: boolean;
  onTextChange?: (textKey: string, value: string) => void;
  onRequestTextEditing?: () => void;
  textHotspots?: any[];
  onTextContextMenu?: (selection: any) => void;
  onTextHotspotTrigger?: (hotspotId: string) => void;
  onDataChange?: (patch: Record<string, any>) => void;
  /** Runs a component-level preset action in interaction preview mode. */
  onAction?: (action: string) => void;
  /** 首次测量完成后回报组件实际绘制尺寸（设计像素），用于把官方组件选框贴合内容。 */
  onIntrinsicSize?: (size: { width: number; height: number }) => void;
}

const EMPTY_UI_COMPONENT_DATA: Record<string, unknown> = {};

/**
 * UI 组件自适应缩放容器。
 *
 * 行为：内容按「自身原始尺寸」等比 contain 缩放到容器内，无 2x 上限 ——
 * 容器（元素盒子）被拖拽控制点改变大小时，组件内容按 X/Y 两个方向分别跟随，
 * 使组件本身与选框保持一致。
 *
 * 关键实现细节：
 * - 容器尺寸用 offsetWidth/offsetHeight（布局尺寸，不受 transform:scale 影响），
 *   避免元素入场/出场动画的 scale 干扰缩放计算，导致内容被错误缩小、留白巨大；
 * - 原始尺寸用 inner 的 offsetWidth/offsetHeight（布局尺寸，不受 transform:scale 影响），
 *   因此可在缩放后安全实测，避免固定基准与组件实际大小不符导致的比例偏差；
 * - 容器外框由图层属性和用户操作控制，内容测量只影响内部 contain 缩放；
 * - 分别应用 scaleX / scaleY，侧边控制点才能实际拉伸组件，而不是只改变外框。
 */
const ScaledUIComponentBase: React.FC<ScaledUIComponentProps> = ({
  type,
  data = EMPTY_UI_COMPONENT_DATA,
  baseWidth,
  baseHeight,
  assetUrl,
  interactive,
  locked,
  onContinuousNodeTrigger,
  textEditing = false,
  onTextChange,
  onRequestTextEditing,
  onDataChange,
  onAction,
  onIntrinsicSize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const onIntrinsicSizeRef = useRef(onIntrinsicSize);
  onIntrinsicSizeRef.current = onIntrinsicSize;
  const reportedSizeRef = useRef(false);
  const updateScaleRef = useRef<() => void>(() => {});
  const intrinsicSize = GALAXY_COMPONENT_BASE_SIZE[type] || { w: 280, h: 180 };
  const renderWidth = baseWidth && baseWidth > 0 ? baseWidth : intrinsicSize.w;
  const renderHeight = baseHeight && baseHeight > 0 ? baseHeight : intrinsicSize.h;
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [contentSize, setContentSize] = useState({ w: renderWidth, h: renderHeight });
  const contentSizeRef = useRef(contentSize);
  const binding = data?.dataBinding;
  const isMockRealtime = binding?.sourceId === 'mock.telemetry' && binding.refresh === 'realtime';
  const isMqttRealtime = isMqttRealtimeSource(binding?.sourceId) && binding.refresh === 'realtime';
  const mockSignal = useMockTelemetrySignal(isMockRealtime);
  const mqttSignal = useRealtimeTelemetrySignal(isMqttRealtime, binding?.sourceId);
  const [sourceData, setSourceData] = useState<RuntimeSource>(data || {});

  useEffect(() => {
    setSourceData(isMockRealtime ? mockSignal : isMqttRealtime ? mqttSignal : (data || {}));
  }, [data, isMockRealtime, isMqttRealtime, mockSignal, mqttSignal]);

  // P1 模拟遥测：编辑器内只产生本地预览数据，不访问外部网络。
  useEffect(() => {
    // 录制回放和手动数据源不应被实时模拟器覆盖。
    // 只有折线图使用滚动时序模拟。柱状图、统计表和告警列表的项目由用户
    // 在属性面板维护，不能被预览定时器左移或随机替换。
    if (isMockRealtime || type !== 'trend-line' || !binding || binding.refresh !== 'realtime' || binding.sourceId === 'recorded.demo' || binding.sourceId === 'none') return;
    const timer = window.setInterval(() => {
      setSourceData((current: RuntimeSource) => {
        const next: RuntimeSource = { ...current, metrics: { ...(current.metrics || {}) } };
        const currentValue = Number(next.metrics.value ?? next.value);
        if (Number.isFinite(currentValue)) {
          const drift = Math.max(0.2, Math.abs(currentValue) * 0.012);
          next.metrics.value = Math.max(0, currentValue + (Math.random() - 0.5) * drift);
          next.value = next.metrics.value;
        }
        const series = Array.isArray(next.metrics.series) ? next.metrics.series : next.series;
        if (Array.isArray(series) && series.length) {
          const shifted = [...series.slice(1), Math.max(0, Number(series[series.length - 1]) + (Math.random() - 0.5) * 8)];
          next.metrics.series = shifted;
          next.series = shifted;
        }
        next.freshnessMs = 600 + Math.round(Math.random() * 2800);
        return next;
      });
    }, 2400);
    return () => window.clearInterval(timer);
  }, [data, type, isMockRealtime]);

  const runtimeData = useMemo(() => ({
    ...projectRuntimeData(data || {}, sourceData),
    // A missing resolved local URL must not overwrite a user-entered remote URL.
    assetUrl: assetUrl || data?.assetUrl || '',
  }), [data, sourceData, assetUrl]);

  useEffect(() => {
    const nextSize = { w: renderWidth, h: renderHeight };
    contentSizeRef.current = nextSize;
    setContentSize(nextSize);
  }, [type, renderWidth, renderHeight]);

  useEffect(() => {
    const updateScale = () => {
      const c = containerRef.current;
      const i = innerRef.current;
      if (!c || !i) return;
      // 拖拽/缩放/旋转手势期间由 CanvasViewport 在同一帧直接写内部 transform。
      // 这里不再逐帧 setState，避免整棵组件树在手势热路径上重渲染。
      if (c.closest('[data-aether-transform-gesture]')) return;

      // 容器布局尺寸（不受 transform:scale 影响，动画中也准确）
      const cw = c.offsetWidth || c.clientWidth || 0;
      const ch = c.offsetHeight || c.clientHeight || 0;
      if (cw <= 0 || ch <= 0) return;

      // 组件原始尺寸：优先用显式 base，否则实测内容布局尺寸（不受 transform 影响）
      // Some controls grow beyond their nominal size when text, locale, font, or
      // focus styles change. Measure the rendered root and keep the larger bounds
      // so the scale never hides content at the edge of the timeline element.
      const renderedRoot = i.firstElementChild as HTMLElement | null;
      const isOfficialComponent = type === 'official-modao';
      // Compact official components publish their actual painted footprint.
      // Prefer this explicit contract over a brittle list of renderer classes:
      // new controls then get correct handles without requiring another entry
      // here, while card/chart/media roots keep their authored layer size.
      const selectionRoot = i.querySelector<HTMLElement>('[data-aether-selection-root]');
      // Compact official controls intentionally expose a content-sized root.
      // Do not re-expand those roots to the generic 420x240 official slot;
      // doing so recreates the blank area that detaches the edit handles.
      const contentSizedRoot = Boolean(selectionRoot || (renderedRoot && (
        renderedRoot.classList.contains('is-button')
        || renderedRoot.classList.contains('is-link')
        || renderedRoot.classList.contains('is-toggle')
        || renderedRoot.classList.contains('is-choice')
        || renderedRoot.classList.contains('is-form')
        || renderedRoot.classList.contains('is-control')
        || renderedRoot.classList.contains('is-progress-display')
        || renderedRoot.classList.contains('special-button')
        || renderedRoot.classList.contains('is-shape')
        || renderedRoot.classList.contains('is-placeholder')
        || renderedRoot.classList.contains('is-line')
        || renderedRoot.classList.contains('is-media')
        || renderedRoot.classList.contains('special-divider')
      )));
      const measuredRoot = selectionRoot || renderedRoot;
      // 记录缩放模式，供拖拽预览在同一帧内同步内部 transform（见 CanvasViewport.renderGesturePreview）。
      i.dataset.aetherScaleMode = isOfficialComponent || contentSizedRoot ? 'uniform' : 'stretch';
      // 官方组件以“实际绘制出来的根节点尺寸”为准：卡片/图表是 100% 填满设计槽，
      // 批注/文档这类是 fit-content，必须用真实尺寸，否则选框会明显大于组件本身。
      const measuredWidth = isOfficialComponent
        ? Math.max(1, measuredRoot?.offsetWidth || renderWidth)
        : contentSizedRoot
          ? Math.max(1, measuredRoot?.offsetWidth || renderWidth)
          : Math.max(i.scrollWidth, measuredRoot?.offsetWidth || 0, renderWidth);
      const measuredHeight = isOfficialComponent
        ? Math.max(1, measuredRoot?.offsetHeight || renderHeight)
        : contentSizedRoot
          ? Math.max(1, measuredRoot?.offsetHeight || renderHeight)
          : Math.max(i.scrollHeight, measuredRoot?.offsetHeight || 0, renderHeight);
      const currentContentSize = contentSizeRef.current;
      const nextContentSize = Math.abs(measuredWidth - currentContentSize.w) > 0.5 || Math.abs(measuredHeight - currentContentSize.h) > 0.5
        ? { w: measuredWidth, h: measuredHeight }
        : currentContentSize;
      if (nextContentSize !== currentContentSize) {
        contentSizeRef.current = nextContentSize;
        setContentSize(nextContentSize);
      }
      const nw = nextContentSize.w;
      const nh = nextContentSize.h;
      if (nw <= 0 || nh <= 0) return;
      if (!reportedSizeRef.current && onIntrinsicSizeRef.current) {
        reportedSizeRef.current = true;
        onIntrinsicSizeRef.current({ width: nw, height: nh });
      }

      const scaleX = cw / nw;
      const scaleY = ch / nh;
      // 官方组件与内容尺寸组件按等比缩放绘制，避免文字和圆形被横向/纵向拉伸。
      const nextScale = (isOfficialComponent || contentSizedRoot)
        ? (() => { const uniform = Math.max(0.01, Math.min(scaleX, scaleY)); return { x: uniform, y: uniform }; })()
        : { x: Math.max(0.01, scaleX), y: Math.max(0.01, scaleY) };
      setScale((current) => Math.abs(current.x - nextScale.x) > 0.0001 || Math.abs(current.y - nextScale.y) > 0.0001 ? nextScale : current);
    };

    updateScaleRef.current = updateScale;
    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    // inner 内容尺寸可能随字体加载/异步渲染/文字变化而改变，也监听
    if (innerRef.current) {
      resizeObserver.observe(innerRef.current);
    }
    window.addEventListener('resize', updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [type, renderWidth, renderHeight]);

  // 手势结束时补一次最终测量，让 React 状态与手势期间直接写入的 transform 对齐。
  useEffect(() => {
    const host = containerRef.current?.closest('[data-canvas-element-id]');
    if (!host) return;
    const observer = new MutationObserver(() => {
      if (!host.hasAttribute('data-aether-transform-gesture')) updateScaleRef.current();
    });
    observer.observe(host, { attributes: true, attributeFilter: ['data-aether-transform-gesture'] });
    return () => observer.disconnect();
  }, [type]);

  // The editor must measure the component that is actually painted. The
  // sizing wrapper is an implementation detail and may be larger than a
  // button/card rendered by GalaxyComponentRenderer.
  useLayoutEffect(() => {
    const outerRoot = innerRef.current?.firstElementChild as HTMLElement | null;
    const root = outerRoot?.querySelector<HTMLElement>('[data-aether-selection-root]') || outerRoot;
    if (!root) return;
    root.dataset.aetherEditRoot = 'true';
    // The scaling layer is pointer-transparent, but the painted component
    // root must explicitly opt back in because pointer-events is inherited.
    root.style.pointerEvents = 'auto';
    return () => {
      delete root.dataset.aetherEditRoot;
      root.style.pointerEvents = '';
    };
  }, [type, runtimeData, contentSize]);

  useEffect(() => {
    const root = innerRef.current;
    if (!root) return;
    const elements = collectEditableTextElements(root);
    applyTextOverrides(elements, data?.textOverrides);
    elements.forEach((element) => {
      element.contentEditable = textEditing ? 'true' : 'false';
      element.spellcheck = false;
      element.dataset.aetherUiTextLayer = 'true';
      element.style.cursor = textEditing ? 'text' : '';
      if (textEditing) element.style.userSelect = 'text';
    });
    const handleBlur = (event: FocusEvent) => {
      if (!textEditing || !(event.target instanceof HTMLElement) || event.target.dataset.aetherUiTextLayer !== 'true') return;
      const key = event.target.dataset.aetherTextKey;
      if (key) onTextChange?.(key, event.target.textContent || '');
    };
    const handleTextPointerDown = (event: MouseEvent) => {
      if (!textEditing) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-aether-ui-text-layer]') : null;
      if (target) event.stopPropagation();
    };
    const handleDoubleClick = (event: MouseEvent) => {
      if (textEditing) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-aether-ui-text-layer]') : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      onRequestTextEditing?.();
    };
    root.addEventListener('focusout', handleBlur, true);
    root.addEventListener('mousedown', handleTextPointerDown, true);
    root.addEventListener('dblclick', handleDoubleClick, true);
    return () => {
      root.removeEventListener('focusout', handleBlur, true);
      root.removeEventListener('mousedown', handleTextPointerDown, true);
      root.removeEventListener('dblclick', handleDoubleClick, true);
    };
  }, [data?.textOverrides, textEditing, onTextChange, onRequestTextEditing, runtimeData]);

  // Components from the legacy Galaxy set are intentionally presentational,
  // but their buttons still need to honor the same preset-action contract as
  // native official components. Delegate from the painted root so the
  // scaling wrapper never becomes a hit target.
  useEffect(() => {
    if (!interactive || !onAction) return;
    const root = innerRef.current;
    if (!root) return;
    const handleAction = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button,[role="button"]') : null;
      if (!target) return;
      const action = String(runtimeData?.action || 'none');
      if (action !== 'none') onAction(action);
    };
    root.addEventListener('click', handleAction);
    return () => root.removeEventListener('click', handleAction);
  }, [interactive, onAction, runtimeData?.action]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-visible"
      // The timeline layer remains the positioning box, but only the painted
      // component root should receive pointer hits. Blank authored space must
      // pass through so layers underneath can be selected.
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={innerRef}
        data-aether-ui-render-layer="true"
        style={{
          width: `${contentSize.w}px`,
          height: `${contentSize.h}px`,
          transform: `scale(${scale.x}, ${scale.y})`,
          transformOrigin: 'center center',
          // Center content-sized controls inside the authored component box.
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // This layer only provides scaling/centering. The renderer root and
          // its painted children own pointer events; transparent authored
          // space must remain clickable for layers underneath.
          pointerEvents: 'none',
          flexShrink: 0,
          overflow: 'visible',
          fontFamily: runtimeData?.fontFamily || undefined,
        }}
      >
        <GalaxyComponentRenderer type={type} data={runtimeData} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} onDataChange={onDataChange} onAction={onAction} />
      </div>
    </div>
  );
};

// Geometry changes are delivered through the authored canvas layer. While a
// resize gesture is active, the component data and edit state stay unchanged;
// avoid rebuilding the renderer for every x/y/w/h update. Interactive preview
// keeps the normal render path so action callbacks always stay current.
export const ScaledUIComponent = memo(ScaledUIComponentBase, (previous, next) => {
  if (previous.interactive || next.interactive) return false;
  return previous.type === next.type
    && previous.data === next.data
    && previous.baseWidth === next.baseWidth
    && previous.baseHeight === next.baseHeight
    && previous.assetUrl === next.assetUrl
    && previous.locked === next.locked
    && previous.textEditing === next.textEditing
    && previous.textHotspots === next.textHotspots;
});

export default ScaledUIComponent;
