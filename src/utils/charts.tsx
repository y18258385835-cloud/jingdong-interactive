import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartInteractionId, ChartInteractionOptions, SceneElement } from '../types';
import { buildChartSVG, CHART_COLORS, CHART_KIND_LABELS } from './chartCore';

export { CHART_COLORS, CHART_KIND_LABELS, buildChartSVG } from './chartCore';

export const CHART_INTERACTION_IDS: ChartInteractionId[] = [
  'brush', 'crosshair', 'highlight', 'tooltip', 'legend', 'zoom', 'drilldown',
];

export const CHART_INTERACTION_LABELS: Record<ChartInteractionId, string> = {
  brush: '框选范围', crosshair: '十字准线', highlight: '数据点高亮',
  tooltip: '数据提示框', legend: '图例筛选', zoom: '图表缩放', drilldown: '数据下钻',
};

interface Point { label: string; value: number; color?: string }
interface Series { id: string; name: string; values: number[]; color: string }
interface PlotBox { left: number; top: number; width: number; height: number; bottom: number }
interface ActivePoint { series: number; index: number }
interface DrillState { index: number; label: string }

const DEFAULT_POINTS: Point[] = [
  { label: '1月', value: 62 }, { label: '2月', value: 74 }, { label: '3月', value: 58 },
  { label: '4月', value: 86 }, { label: '5月', value: 78 }, { label: '6月', value: 92 },
  { label: '7月', value: 84 }, { label: '8月', value: 98 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const ease = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function getOptions(el: SceneElement): Required<ChartInteractionOptions> {
  const options = el.chartInteractions || {};
  return {
    enabled: options.enabled || CHART_INTERACTION_IDS,
    duration: options.duration ?? 220,
    brushOpacity: options.brushOpacity ?? 0.18,
    highlightSize: options.highlightSize ?? 1.7,
    snap: options.snap ?? true,
    minZoom: options.minZoom ?? 0.25,
  };
}

function makeDrillPoints(base: Point[], index: number): Point[] {
  const source = base[index] || base[0] || DEFAULT_POINTS[0];
  const seed = Math.max(20, source.value);
  return ['华东', '华南', '华北', '西部', '海外'].map((label, itemIndex) => ({
    label,
    value: Math.round(seed * (0.58 + itemIndex * 0.09 + ((index + itemIndex) % 3) * 0.04)),
  }));
}

function formatValue(value: number) { return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 }); }

export const ChartElementView: React.FC<{ el: SceneElement; interactive?: boolean }> = ({ el, interactive = false }) => {
  const kind = el.chartKind || 'bar';
  if (kind === 'counter') return <CounterReact el={el} />;
  if (kind === 'clock') return <ClockReact el={el} />;
  if (!interactive) return <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: buildChartSVG(el) }} />;
  return <InteractiveChart el={el} />;
};

const InteractiveChart: React.FC<{ el: SceneElement }> = ({ el }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const brushStartRef = useRef<number | null>(null);
  const zoomDragRef = useRef<{ mode: 'start' | 'end' | 'whole'; x: number; start: number; end: number } | null>(null);
  const legendHitRef = useRef<Array<{ id: string; x: number; y: number; w: number; h: number }>>([]);
  const backHitRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const focusRef = useRef(0);
  const focusTargetRef = useRef(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState<ActivePoint | null>(null);
  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null);
  const [brushDraft, setBrushDraft] = useState<{ start: number; end: number } | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState({ start: 0, end: 1 });
  const [drill, setDrill] = useState<DrillState | null>(null);

  const options = useMemo(() => getOptions(el), [el]);
  const rootPoints = useMemo(() => el.chartData?.length ? el.chartData : DEFAULT_POINTS, [el.chartData]);
  const points = useMemo(() => drill ? makeDrillPoints(rootPoints, drill.index) : rootPoints, [drill, rootPoints]);
  const series = useMemo<Series[]>(() => {
    const base = points.map((point) => Math.max(0, Number(point.value) || 0));
    return [
      { id: 'current', name: '当前值', values: base, color: el.chartColors?.[0] || CHART_COLORS[0] },
      { id: 'previous', name: '上期', values: base.map((value, index) => Math.round(value * (0.78 + (index % 4) * 0.035))), color: el.chartColors?.[1] || CHART_COLORS[1] },
      { id: 'target', name: '目标', values: base.map((value, index) => Math.round(value * (1.04 + (index % 3) * 0.025))), color: el.chartColors?.[2] || CHART_COLORS[2] },
    ];
  }, [el.chartColors, points]);
  const visibleSeries = useMemo(() => series.filter((item) => visible[item.id] !== false), [series, visible]);
  const has = useCallback((id: ChartInteractionId) => options.enabled.includes(id), [options.enabled]);
  const getPlot = useCallback((width: number, height: number): PlotBox => {
    const left = Math.max(36, Math.min(58, width * 0.1));
    return { left, top: 50, width: Math.max(40, width - left - 18), height: Math.max(40, height - 96), bottom: Math.max(40, height - 46) };
  }, []);
  const toLocal = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);
  const getRangeIndex = useCallback((x: number, plot: PlotBox) => {
    const ratio = clamp((x - plot.left) / Math.max(1, plot.width), 0, 1);
    return clamp(Math.round((zoom.start + ratio * (zoom.end - zoom.start)) * Math.max(1, points.length - 1)), 0, Math.max(0, points.length - 1));
  }, [points.length, zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const width = size.width;
    const height = size.height;
    const plot = getPlot(width, height);
    const visibleIds = new Set(visibleSeries.map((item) => item.id));
    const max = Math.max(1, ...visibleSeries.flatMap((item) => item.values));
    const isRadial = el.chartKind === 'pie' || el.chartKind === 'donut';
    const activeIndex = active?.index ?? -1;
    const activeSeriesIndex = active?.series ?? 0;
    const focus = ease(focusRef.current);
    const currentBrush = brushDraft || brush;

    ctx.fillStyle = 'rgba(2, 8, 23, .42)';
    roundedRect(ctx, 0, 0, width, height, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, .16)'; ctx.lineWidth = 1;
    roundedRect(ctx, 0.5, 0.5, width - 1, height - 1, 6); ctx.stroke();
    ctx.fillStyle = '#f8fafc'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(drill ? `区域明细 · ${drill.label}` : (el.chartTitle || '趋势分析'), 14, 18);
    ctx.fillStyle = 'rgba(148, 163, 184, .8)'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText(drill ? '下钻层级 / 明细数据' : '交互数据视图', 14, 35);
    if (drill) {
      backHitRef.current = { x: width - 68, y: 9, w: 54, h: 20 };
      ctx.fillStyle = 'rgba(34, 211, 238, .12)'; roundedRect(ctx, width - 68, 8, 54, 22, 4); ctx.fill();
      ctx.fillStyle = '#67e8f9'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('返回上层', width - 41, 19);
    } else backHitRef.current = null;

    legendHitRef.current = [];
    let legendX = Math.max(plot.left, width * 0.42);
    series.forEach((item) => {
      const textW = ctx.measureText(item.name).width + 28;
      if (legendX + textW > width - 8) return;
      legendHitRef.current.push({ id: item.id, x: legendX, y: 7, w: textW, h: 24 });
      ctx.globalAlpha = visibleIds.has(item.id) ? 1 : 0.4; ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(legendX + 6, 18, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(item.name, legendX + 15, 18);
      ctx.globalAlpha = 1; legendX += textW + 4;
    });

    if (has('brush') && currentBrush && !isRadial) {
      const start = Math.min(currentBrush.start, currentBrush.end); const end = Math.max(currentBrush.start, currentBrush.end);
      const x1 = plot.left + (start / Math.max(1, points.length - 1)) * plot.width; const x2 = plot.left + (end / Math.max(1, points.length - 1)) * plot.width;
      ctx.fillStyle = `rgba(34, 211, 238, ${options.brushOpacity})`; ctx.fillRect(x1, plot.top, Math.max(2, x2 - x1), plot.height);
      ctx.strokeStyle = 'rgba(103, 232, 249, .9)'; ctx.setLineDash([4, 4]); ctx.strokeRect(x1, plot.top, Math.max(2, x2 - x1), plot.height); ctx.setLineDash([]);
    }

    if (!isRadial) {
      ctx.strokeStyle = 'rgba(148, 163, 184, .12)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(148, 163, 184, .66)'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right';
      for (let step = 0; step <= 4; step += 1) {
        const y = plot.bottom - (step / 4) * plot.height; ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.left + plot.width, y); ctx.stroke(); ctx.fillText(formatValue((max * step) / 4), plot.left - 7, y);
      }
      ctx.save(); ctx.beginPath(); ctx.rect(plot.left, plot.top, plot.width, plot.height); ctx.clip();
      const start = Math.floor(zoom.start * Math.max(0, points.length - 1)); const end = Math.ceil(zoom.end * Math.max(0, points.length - 1));
      const xForIndex = (index: number) => plot.left + ((index - start) / Math.max(1, end - start)) * plot.width;
      if (el.chartKind === 'bar') {
        const count = Math.max(1, visibleSeries.length); const groupW = plot.width / Math.max(1, end - start + 1);
        visibleSeries.forEach((item, visibleIndex) => {
          const originalIndex = series.findIndex((candidate) => candidate.id === item.id); const barW = Math.min(28, Math.max(4, groupW * 0.62 / count));
          item.values.slice(start, end + 1).forEach((value, localIndex) => {
            const index = start + localIndex; const x = xForIndex(index) - (count * barW) / 2 + visibleIndex * barW; const y = plot.bottom - (value / max) * plot.height;
            ctx.globalAlpha = has('highlight') && activeIndex >= 0 && (activeSeriesIndex !== originalIndex || activeIndex !== index) ? 0.3 : 1; ctx.fillStyle = item.color;
            roundedRect(ctx, x, y, Math.max(2, barW - 2), plot.bottom - y, 3); ctx.fill();
          });
        });
      } else {
        visibleSeries.forEach((item) => {
          const originalIndex = series.findIndex((candidate) => candidate.id === item.id); ctx.beginPath();
          item.values.slice(start, end + 1).forEach((value, localIndex) => { const index = start + localIndex; const x = xForIndex(index); const y = plot.bottom - (value / max) * plot.height; if (localIndex === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
          ctx.globalAlpha = has('highlight') && activeIndex >= 0 && activeSeriesIndex !== originalIndex ? 0.22 : 0.9; ctx.strokeStyle = item.color; ctx.lineWidth = originalIndex === 0 ? 2.1 : 1.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
          item.values.slice(start, end + 1).forEach((value, localIndex) => {
            const index = start + localIndex; const x = xForIndex(index); const y = plot.bottom - (value / max) * plot.height; const isActive = activeIndex === index && activeSeriesIndex === originalIndex;
            ctx.globalAlpha = has('highlight') && activeIndex >= 0 && !isActive ? 0.25 : 1; ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(x, y, isActive ? 4.5 * options.highlightSize : 2.7, 0, Math.PI * 2); ctx.fill();
            if (isActive) { ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8 * options.highlightSize * (0.92 + focus * 0.08), 0, Math.PI * 2); ctx.stroke(); ctx.shadowColor = item.color; ctx.shadowBlur = 12 + focus * 8; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
          });
        });
      }
      ctx.globalAlpha = 1; ctx.restore();
      ctx.fillStyle = 'rgba(148, 163, 184, .75)'; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'center';
      const labelStep = Math.max(1, Math.ceil((end - start + 1) / 7));
      for (let index = start; index <= end; index += labelStep) { ctx.fillText(points[index]?.label || '', xForIndex(index), plot.bottom + 17); }
      if (has('crosshair') && activeIndex >= start && activeIndex <= end) {
        const activeItem = series[activeSeriesIndex] || series[0]; const x = xForIndex(activeIndex); const y = plot.bottom - ((activeItem?.values[activeIndex] || 0) / max) * plot.height;
        ctx.strokeStyle = 'rgba(103, 232, 249, .65)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, plot.top); ctx.lineTo(x, plot.bottom); ctx.moveTo(plot.left, y); ctx.lineTo(plot.left + plot.width, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#67e8f9'; roundedRect(ctx, clamp(x - 25, plot.left - 4, plot.left + plot.width - 46), plot.bottom + 25, 50, 16, 3); ctx.fill();
        ctx.fillStyle = '#082f49'; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(points[activeIndex]?.label || '', clamp(x, plot.left + 22, plot.left + plot.width - 22), plot.bottom + 33);
        ctx.fillStyle = 'rgba(103, 232, 249, .12)'; roundedRect(ctx, clamp(x - 54, plot.left, plot.left + plot.width - 108), plot.top - 1, 108, 18, 3); ctx.fill(); ctx.fillStyle = '#a5f3fc'; ctx.fillText(`${points[activeIndex]?.label || ''}  ${formatValue(activeItem?.values[activeIndex] || 0)}`, clamp(x, plot.left + 54, plot.left + plot.width - 54), plot.top + 8);
      }
    } else {
      const centerX = plot.left + plot.width / 2; const centerY = plot.top + plot.height / 2; const radius = Math.min(plot.width, plot.height) * 0.32; const radial = visibleSeries[0] || series[0]; const total = radial.values.reduce((sum, value) => sum + value, 0) || 1; let angle = -Math.PI / 2;
      radial.values.forEach((value, index) => { const next = angle + (value / total) * Math.PI * 2; ctx.globalAlpha = has('highlight') && activeIndex >= 0 && activeIndex !== index ? 0.28 : 1; ctx.fillStyle = points[index]?.color || el.chartColors?.[index % (el.chartColors?.length || 1)] || CHART_COLORS[index % CHART_COLORS.length]; ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius + (activeIndex === index ? 5 * options.highlightSize : 0), angle, next); ctx.closePath(); ctx.fill(); angle = next; });
      if (el.chartKind === 'donut') { ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(2, 8, 23, .9)'; ctx.beginPath(); ctx.arc(centerX, centerY, radius * 0.56, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#f8fafc'; ctx.font = '700 16px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(activeIndex >= 0 ? formatValue(radial.values[activeIndex]) : formatValue(total), centerX, centerY); ctx.font = '9px system-ui, sans-serif'; ctx.fillStyle = 'rgba(148, 163, 184, .8)'; ctx.fillText(activeIndex >= 0 ? (points[activeIndex]?.label || '') : '总量', centerX, centerY + 16);
    }

    if (has('brush') && currentBrush) {
      const start = Math.min(currentBrush.start, currentBrush.end); const end = Math.max(currentBrush.start, currentBrush.end); const values = series[0].values.slice(start, end + 1); const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      ctx.fillStyle = '#67e8f9'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`已选 ${values.length} 项  ·  均值 ${formatValue(average)}`, width - 14, 35);
    }
    if (has('tooltip') && active && points[active.index]) {
      const current = series[active.series]?.values[active.index] || 0; const previous = series[1]?.values[active.index] || current; const change = previous ? ((current - previous) / previous) * 100 : 0; const tx = clamp(plot.left + (active.index / Math.max(1, points.length - 1)) * plot.width + 12, 6, width - 162); const ty = clamp(isRadial ? plot.top + 10 : plot.bottom - (current / max) * plot.height - 68, 44, height - 74);
      ctx.fillStyle = 'rgba(8, 18, 32, .96)'; ctx.strokeStyle = 'rgba(103, 232, 249, .45)'; ctx.lineWidth = 1; roundedRect(ctx, tx, ty, 156, 64, 5); ctx.fill(); ctx.stroke(); ctx.textAlign = 'left'; ctx.fillStyle = '#cbd5e1'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText(points[active.index].label, tx + 10, ty + 14); ctx.fillStyle = '#f8fafc'; ctx.font = '700 13px ui-monospace, monospace'; ctx.fillText(formatValue(current), tx + 10, ty + 33); ctx.fillStyle = change >= 0 ? '#6ee7b7' : '#fb7185'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(1)}% 对比上期`, tx + 10, ty + 51);
    }
    if (has('zoom')) {
      const railY = height - 16; ctx.strokeStyle = 'rgba(148, 163, 184, .25)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(plot.left, railY); ctx.lineTo(plot.left + plot.width, railY); ctx.stroke(); ctx.strokeStyle = 'rgba(34, 211, 238, .7)'; ctx.beginPath(); ctx.moveTo(plot.left + zoom.start * plot.width, railY); ctx.lineTo(plot.left + zoom.end * plot.width, railY); ctx.stroke(); ctx.fillStyle = '#67e8f9'; [zoom.start, zoom.end].forEach((position) => { ctx.beginPath(); ctx.arc(plot.left + position * plot.width, railY, 5, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = 'rgba(148, 163, 184, .7)'; ctx.font = '8px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('范围', 8, railY);
    }
    ctx.globalAlpha = 1;
  }, [active, brush, brushDraft, el.chartColors, el.chartKind, el.chartTitle, getPlot, has, options.brushOpacity, options.highlightSize, options.minZoom, points, series, size.height, size.width, visibleSeries, zoom, drill]);

  drawRef.current = draw;
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { const host = hostRef.current; if (!host) return; const observer = new ResizeObserver(() => setSize({ width: host.clientWidth, height: host.clientHeight })); observer.observe(host); setSize({ width: host.clientWidth, height: host.clientHeight }); return () => observer.disconnect(); }, []);
  useEffect(() => { focusTargetRef.current = active ? 1 : 0; const blend = Math.min(0.35, 120 / Math.max(80, options.duration)); let frame = 0; const tick = () => { const current = focusRef.current; const target = focusTargetRef.current; focusRef.current = Math.abs(target - current) < 0.02 ? target : current + (target - current) * blend; drawRef.current(); if (focusRef.current !== target) frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [active, options.duration]);
  useEffect(() => { setActive(null); setBrush(null); setBrushDraft(null); setZoom({ start: 0, end: 1 }); setDrill(null); }, [el.id, el.chartData, el.chartKind]);

  const nearest = (x: number, y: number) => {
    const plot = getPlot(size.width, size.height); if (x < plot.left || x > plot.left + plot.width || y < plot.top || y > plot.bottom) return null;
    const index = getRangeIndex(x, plot); const candidates = visibleSeries.map((item) => ({ series: series.findIndex((candidate) => candidate.id === item.id), index }));
    if (!options.snap) return candidates[0] || null;
    if (el.chartKind === 'bar') { const max = Math.max(1, ...visibleSeries.flatMap((item) => item.values)); const candidate = candidates.find((item) => Math.abs(y - (plot.bottom - ((series[item.series]?.values[item.index] || 0) / max) * plot.height)) < 32); return candidate || candidates[0] || null; }
    return candidates[0] || null;
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); event.stopPropagation(); const { x, y } = toLocal(event); lastPointerRef.current = { x, y };
    if (zoomDragRef.current) { const plot = getPlot(size.width, size.height); const delta = (x - zoomDragRef.current.x) / Math.max(1, plot.width); const drag = zoomDragRef.current; if (drag.mode === 'start') setZoom({ start: clamp(drag.start + delta, 0, drag.end - options.minZoom), end: drag.end }); else if (drag.mode === 'end') setZoom({ start: drag.start, end: clamp(drag.end + delta, drag.start + options.minZoom, 1) }); else { const range = drag.end - drag.start; const start = clamp(drag.start + delta, 0, 1 - range); setZoom({ start, end: start + range }); } return; }
    if (brushStartRef.current !== null) { const plot = getPlot(size.width, size.height); setBrushDraft({ start: brushStartRef.current, end: getRangeIndex(x, plot) }); }
    setActive(nearest(x, y));
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); event.stopPropagation(); const { x, y } = toLocal(event); event.currentTarget.setPointerCapture?.(event.pointerId); const plot = getPlot(size.width, size.height);
    if (has('zoom') && y > size.height - 32) { const position = clamp((x - plot.left) / Math.max(1, plot.width), 0, 1); const hit = 0.035; const mode = Math.abs(position - zoom.start) < hit ? 'start' : Math.abs(position - zoom.end) < hit ? 'end' : 'whole'; zoomDragRef.current = { mode, x, start: zoom.start, end: zoom.end }; return; }
    if (has('brush') && x >= plot.left && x <= plot.left + plot.width && y >= plot.top && y <= plot.bottom) { brushStartRef.current = getRangeIndex(x, plot); setBrushDraft({ start: brushStartRef.current, end: brushStartRef.current }); }
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault(); event.stopPropagation(); const { x, y } = toLocal(event);
    if (zoomDragRef.current) { zoomDragRef.current = null; return; }
    const brushStart = brushStartRef.current;
    if (brushStart !== null) { const end = getRangeIndex(x, getPlot(size.width, size.height)); brushStartRef.current = null; setBrushDraft(null); if (Math.abs(end - brushStart) > 0) { setBrush({ start: brushStart, end }); return; } }
    const legend = legendHitRef.current.find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h); if (has('legend') && legend) { setVisible((current) => ({ ...current, [legend.id]: current[legend.id] === false })); return; }
    if (drill && backHitRef.current && x >= backHitRef.current.x && x <= backHitRef.current.x + backHitRef.current.w && y >= backHitRef.current.y && y <= backHitRef.current.y + backHitRef.current.h) { setDrill(null); return; }
    if (has('drilldown')) { const point = nearest(x, y); if (point) setDrill({ index: point.index, label: points[point.index]?.label || '' }); }
  };
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!has('zoom')) return; event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left; const plot = getPlot(size.width, size.height); const center = clamp((x - plot.left) / Math.max(1, plot.width), 0, 1); const factor = event.deltaY > 0 ? 1.16 : 0.86; const currentWidth = zoom.end - zoom.start; const nextWidth = clamp(currentWidth * factor, options.minZoom, 1); const ratio = currentWidth ? (center - zoom.start) / currentWidth : 0.5; const start = clamp(center - nextWidth * ratio, 0, 1 - nextWidth); setZoom({ start, end: start + nextWidth });
  };

  return <div ref={hostRef} style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}><canvas ref={canvasRef} aria-label={`${el.chartTitle || '图表'}，支持 7 项图表交互`} style={{ display: 'block', width: '100%', height: '100%', cursor: has('brush') || has('zoom') ? 'crosshair' : 'default' }} onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={() => { if (brushStartRef.current === null) setActive(null); }} onWheel={handleWheel} onClick={(event) => event.stopPropagation()} /></div>;
};

function CounterReact({ el }: { el: SceneElement }) {
  const target = el.counterValue ?? 0; const [val, setVal] = useState(0);
  useEffect(() => { let raf = 0; const start = performance.now(); const tick = (now: number) => { const p = Math.min(1, (now - start) / 1200); setVal(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [target]);
  return <div style={{ width: '100%', height: '100%', background: 'rgba(2,8,23,0.45)', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: '12%', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>{el.chartTitle}</div><div style={{ fontSize: '34%', color: '#38bdf8', fontWeight: 900, fontFamily: 'monospace', textShadow: '0 0 12px rgba(56,189,248,0.55)' }}>{el.counterPrefix || ''}{val.toLocaleString()}{el.counterSuffix || ''}</div></div>;
}

function ClockReact({ el }: { el: SceneElement }) {
  const fmt = el.clockFormat || 'time'; const [now, setNow] = useState(new Date()); useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const pad = (value: number) => String(value).padStart(2, '0'); const text = fmt === 'date' ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` : fmt === 'datetime' ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}` : `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return <div style={{ width: '100%', height: '100%', background: 'rgba(2,8,23,0.45)', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: '12%', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>{el.chartTitle}</div><div style={{ fontSize: '16%', color: '#fbbf24', fontWeight: 900, fontFamily: 'monospace', textShadow: '0 0 12px rgba(251,191,36,0.55)' }}>{text}</div></div>;
}
