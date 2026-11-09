import { SceneElement } from '../types';

// —— 数据可视化组件库 · 纯函数核心（无 React，供编辑器与导出运行器共用）——

export const CHART_COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#c084fc', '#f97316', '#84cc16'];

export const CHART_KIND_LABELS: Record<string, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  donut: '环形图',
  counter: '数字翻牌器',
  clock: '时钟 / 日期',
};

const DEFAULT_DATA = [
  { label: 'A', value: 80 },
  { label: 'B', value: 55 },
  { label: 'C', value: 95 },
  { label: 'D', value: 40 },
  { label: 'E', value: 70 },
];

function normData(el: SceneElement): { label: string; value: number; color?: string }[] {
  const raw = el.chartData && el.chartData.length ? el.chartData : DEFAULT_DATA;
  return raw.slice(0, 12);
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildChartSVG(el: SceneElement): string {
  const kind = el.chartKind || 'bar';
  if (kind === 'counter') return buildCounterSVG(el);
  if (kind === 'clock') return buildClockSVG(el);
  const data = normData(el);
  const colors = el.chartColors && el.chartColors.length ? el.chartColors : CHART_COLORS;
  const title = el.chartTitle ? `<text x="50" y="6" text-anchor="middle" font-size="4.5" fill="rgba(255,255,255,0.85)" font-weight="bold" font-family="sans-serif">${esc(el.chartTitle)}</text>` : '';
  if (kind === 'line') return buildLineSVG(data, colors, title);
  if (kind === 'pie' || kind === 'donut') return buildPieSVG(data, colors, kind === 'donut', title);
  return buildBarSVG(data, colors, title);
}

function buildBarSVG(data: { label: string; value: number; color?: string }[], colors: string[], title: string): string {
  const W = 100, H = 60, top = title ? 10 : 6, pad = 4;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const bw = (W - pad * 2) / data.length;
  const chartH = H - top - 8;
  let bars = '';
  data.forEach((d, i) => {
    const x = pad + i * bw + bw * 0.18;
    const h = (d.value / maxV) * chartH;
    const y = top + (chartH - h);
    const color = d.color || colors[i % colors.length];
    bars += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(bw * 0.64).toFixed(2)}" height="${h.toFixed(2)}" rx="1.2" fill="${color}" fill-opacity="0.92"/>`;
    bars += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(bw * 0.64).toFixed(2)}" height="${h.toFixed(2)}" rx="1.2" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.25"/>`;
    if (d.value > maxV * 0.12) {
      bars += `<text x="${(x + bw * 0.32).toFixed(2)}" y="${(y - 0.8).toFixed(2)}" text-anchor="middle" font-size="3.2" fill="rgba(255,255,255,0.9)" font-family="sans-serif" font-weight="bold">${esc(String(d.value))}</text>`;
    }
    bars += `<text x="${(x + bw * 0.32).toFixed(2)}" y="${(H - 1.5).toFixed(2)}" text-anchor="middle" font-size="2.8" fill="rgba(255,255,255,0.65)" font-family="sans-serif">${esc(d.label)}</text>`;
  });
  bars += `<line x1="${pad}" y1="${(top + chartH).toFixed(2)}" x2="${(W - pad).toFixed(2)}" y2="${(top + chartH).toFixed(2)}" stroke="rgba(255,255,255,0.25)" stroke-width="0.4"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;background:rgba(2,8,23,0.45);border-radius:6px">${title}${bars}</svg>`;
}

function buildLineSVG(data: { label: string; value: number; color?: string }[], colors: string[], title: string): string {
  const W = 100, H = 60, top = title ? 10 : 6, pad = 5;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const chartW = W - pad * 2, chartH = H - top - 8;
  const pts = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * chartW;
    const y = top + chartH - (d.value / maxV) * chartH;
    return { x, y, d };
  });
  const color = colors[0] || '#38bdf8';
  let s = '';
  for (let g = 1; g <= 3; g++) {
    const gy = top + (chartH / 4) * g;
    s += `<line x1="${pad}" y1="${gy.toFixed(2)}" x2="${(W - pad).toFixed(2)}" y2="${gy.toFixed(2)}" stroke="rgba(255,255,255,0.1)" stroke-width="0.3"/>`;
  }
  const poly = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  s += `<polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  const areaPts = `${pad},${(top + chartH).toFixed(2)} ${poly} ${(W - pad).toFixed(2)},${(top + chartH).toFixed(2)}`;
  s += `<polygon points="${areaPts}" fill="${color}" opacity="0.16"/>`;
  pts.forEach((p, i) => {
    s += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.7" fill="${color}" stroke="white" stroke-width="0.4"/>`;
    s += `<text x="${p.x.toFixed(2)}" y="${(p.y - 1.8).toFixed(2)}" text-anchor="middle" font-size="3" fill="rgba(255,255,255,0.9)" font-family="sans-serif" font-weight="bold">${esc(String(p.d.value))}</text>`;
    s += `<text x="${p.x.toFixed(2)}" y="${(H - 1.5).toFixed(2)}" text-anchor="middle" font-size="2.8" fill="rgba(255,255,255,0.65)" font-family="sans-serif">${esc(p.d.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;background:rgba(2,8,23,0.45);border-radius:6px">${title}${s}</svg>`;
}

function buildPieSVG(data: { label: string; value: number; color?: string }[], colors: string[], donut: boolean, title: string): string {
  const W = 100, H = 62, cx = W / 2, cy = (H + 6) / 2;
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
  const r = 24;
  let ang = -90;
  let segs = '';
  const legend: string[] = [];
  data.forEach((d, i) => {
    const frac = Math.max(0, d.value) / total;
    const a2 = ang + frac * 360;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos((ang * Math.PI) / 180);
    const y1 = cy + r * Math.sin((ang * Math.PI) / 180);
    const x2 = cx + r * Math.cos((a2 * Math.PI) / 180);
    const y2 = cy + r * Math.sin((a2 * Math.PI) / 180);
    const color = d.color || colors[i % colors.length];
    const ox1 = cx + r * Math.cos((ang * Math.PI) / 180);
    const oy1 = cy + r * Math.sin((ang * Math.PI) / 180);
    const ox2 = cx + r * Math.cos((a2 * Math.PI) / 180);
    const oy2 = cy + r * Math.sin((a2 * Math.PI) / 180);
    const path = donut
      ? `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${(r - 11).toFixed(2)} ${(r - 11).toFixed(2)} 0 ${large} 0 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
      : `M ${cx} ${cy} L ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} Z`;
    segs += `<path d="${path}" fill="${color}" fill-opacity="0.9" stroke="rgba(8,12,24,0.6)" stroke-width="0.6"/>`;
    const pct = Math.round(frac * 100);
    if (pct >= 6) legend.push(`<circle cx="${4 + i * 1}" cy="0" r="0.6" fill="${color}"/><text x="${4.9}" y="0.4" font-size="2.4" fill="rgba(255,255,255,0.8)" font-family="sans-serif">${esc(d.label)} ${pct}%</text>`);
    ang = a2;
  });
  let legendSvg = '';
  if (legend.length) {
    legendSvg = `<g transform="translate(0, ${(H - 3).toFixed(2)})">${legend.join('')}</g>`;
  }
  if (donut) {
    segs += `<circle cx="${cx}" cy="${cy}" r="${(r - 11).toFixed(2)}" fill="rgba(2,8,23,0.95)"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;background:rgba(2,8,23,0.45);border-radius:6px">${title}${segs}${legendSvg}</svg>`;
}

function buildCounterSVG(el: SceneElement): string {
  const v = el.counterValue ?? 0;
  const prefix = el.counterPrefix || '';
  const suffix = el.counterSuffix || '';
  const title = el.chartTitle ? `${esc(el.chartTitle)}` : '';
  const t = title ? `<text x="50" y="12" text-anchor="middle" font-size="4.5" fill="rgba(255,255,255,0.85)" font-weight="bold" font-family="sans-serif">${title}</text>` : '';
  const numText = `${esc(prefix)}${esc(String(v))}${esc(suffix)}`;
  const fs = Math.min(14, Math.max(8, 22 - String(v).length * 2));
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="none" style="width:100%;height:100%;display:block;background:rgba(2,8,23,0.45);border-radius:6px">${t}<text x="50" y="38" text-anchor="middle" font-size="${fs}" fill="#38bdf8" font-family="sans-serif" font-weight="bold" style="filter:drop-shadow(0 0 6px rgba(56,189,248,0.5))">${numText}</text></svg>`;
}

function buildClockSVG(el: SceneElement): string {
  const fmt = el.clockFormat || 'time';
  const t = el.chartTitle ? `${esc(el.chartTitle)}` : '';
  const titleS = t ? `<text x="50" y="10" text-anchor="middle" font-size="4.5" fill="rgba(255,255,255,0.85)" font-weight="bold" font-family="sans-serif">${t}</text>` : '';
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="none" style="width:100%;height:100%;display:block;background:rgba(2,8,23,0.45);border-radius:6px">${titleS}<text x="50" y="38" text-anchor="middle" font-size="13" fill="#fbbf24" font-family="monospace" font-weight="bold" style="filter:drop-shadow(0 0 6px rgba(251,191,36,0.5))">--:--:--</text></svg>`;
}

// 导出运行器用的动态渲染脚本（在导出 HTML 中用于翻牌动画与实时时钟）
export const CHART_RUNTIME_JS = `
function renderDynamicChart(el, container) {
  if (el.chartKind === 'clock') {
    var fmt = el.clockFormat || 'time';
    var pad = function(n){ return String(n).padStart(2,'0'); };
    var fs = Math.max(14, Math.min(48, (el.w||40)*0.16));
    var tick = function(){
      var d = new Date();
      var t;
      if (fmt === 'date') t = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
      else if (fmt === 'datetime') t = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
      else t = pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
      container.querySelector('.chart-dyn-text').textContent = t;
    };
    container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(2,8,23,0.45);border-radius:6px"><span class="chart-dyn-text" style="font-family:monospace;font-weight:900;color:#fbbf24;font-size:' + fs + 'px;text-shadow:0 0 12px rgba(251,191,36,0.55)">--:--:--</span></div>';
    tick();
    setInterval(tick, 1000);
  } else if (el.chartKind === 'counter') {
    var target = el.counterValue || 0;
    var fs2 = Math.max(14, Math.min(48, (el.w||40)*0.16));
    container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(2,8,23,0.45);border-radius:6px"><span class="chart-dyn-text" style="font-family:monospace;font-weight:900;color:#38bdf8;font-size:' + fs2 + 'px;text-shadow:0 0 12px rgba(56,189,248,0.55)">' + (el.counterPrefix||'') + '0' + (el.counterSuffix||'') + '</span></div>';
    var start = null, dur = 1200;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min(1, (ts-start)/dur);
      var eased = 1 - Math.pow(1-p, 3);
      var v = Math.round(target * eased);
      container.querySelector('.chart-dyn-text').textContent = (el.counterPrefix||'') + v.toLocaleString() + (el.counterSuffix||'');
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
}
`;
