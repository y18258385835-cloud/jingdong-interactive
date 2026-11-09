import type { Scene, SceneElement } from '../types';

export interface HandoffCanvas {
  width: number;
  height: number;
}

export interface HandoffSpacing {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface HandoffNeighbor {
  direction: 'left' | 'top' | 'right' | 'bottom';
  gap: number;
  name: string;
  elementId: string;
}

export interface HandoffTypography {
  content?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  align: string;
  verticalAlign: string;
  textWrap: string;
}

export interface HandoffAppearance {
  background?: string;
  border?: string;
  radius?: number;
  shadow?: string;
  blendMode?: string;
  backdropBlur?: number;
  shapeKind?: string;
}

export interface HandoffSpec {
  id: string;
  name: string;
  type: SceneElement['type'];
  typeLabel: string;
  sceneId: string;
  sceneName: string;
  canvas: HandoffCanvas;
  percent: { x: number; y: number; w: number; h: number };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
    opacity: number;
    zIndex: number;
  };
  spacing: HandoffSpacing;
  neighbors: HandoffNeighbor[];
  appearance: HandoffAppearance;
  typography?: HandoffTypography;
  asset?: {
    refId: string;
    sourceName?: string;
    mediaAspect?: number;
  };
  component?: {
    masterId: string;
    variantId?: string;
    overrides: string[];
  };
  timing: {
    startTime: number;
    duration: number;
    inAnimation?: string;
    outAnimation?: string;
  };
  interaction?: {
    trigger?: string;
    action?: string;
    target?: string;
    url?: string;
  };
  meta: {
    groupChildren: number;
    uiComponentType?: string;
    customCodeName?: string;
    hotspotCount: number;
    maskEnabled: boolean;
  };
  css: string;
}

const TYPE_LABELS: Record<SceneElement['type'], string> = {
  img: '图片',
  vid: '视频',
  txt: '文本',
  shape: '图形 / 卡片',
  saber: '光效',
  vfx: '视觉特效',
  '3d_group': '3D 组合',
  chart: '图表',
  'panorama-img': '全景图',
  'panorama-vid': '全景视频',
  'model-3d': '3D 模型',
  'gaussian-splat': '高斯泼溅',
  group: '编组',
  'ui-component': 'UI 组件',
  'custom-code': '自定义代码',
};

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const firstLine = (value?: string): string => (value || '').split('\n')[0].trim();

export function getElementDisplayName(element: SceneElement): string {
  const sourceName = (element.sourceName || '').trim();
  if (sourceName) return sourceName;
  const content = firstLine(element.content);
  if (content) return content.slice(0, 40);
  return element.id;
}

const getElementRect = (element: SceneElement, canvas: HandoffCanvas) => {
  const x = round((numberValue(element.x) / 100) * canvas.width);
  const y = round((numberValue(element.y) / 100) * canvas.height);
  const w = round((numberValue(element.w) / 100) * canvas.width);
  const h = round((numberValue(element.h) / 100) * canvas.height);
  return { x, y, w, h, right: round(x + w), bottom: round(y + h) };
};

const findNeighbors = (element: SceneElement, scene: Scene, canvas: HandoffCanvas): HandoffNeighbor[] => {
  const own = getElementRect(element, canvas);
  const candidates = scene.els
    .filter((item) => item.id !== element.id && item.visible !== false)
    .map((item) => ({ item, rect: getElementRect(item, canvas) }));

  const found: Partial<Record<HandoffNeighbor['direction'], HandoffNeighbor>> = {};
  const consider = (direction: HandoffNeighbor['direction'], gap: number, item: SceneElement) => {
    if (!Number.isFinite(gap) || gap < -0.5) return;
    const next: HandoffNeighbor = {
      direction,
      gap: Math.max(0, round(gap)),
      name: getElementDisplayName(item),
      elementId: item.id,
    };
    if (!found[direction] || next.gap < found[direction]!.gap) found[direction] = next;
  };

  candidates.forEach(({ item, rect }) => {
    const overlapsVertically = rect.y < own.bottom && rect.bottom > own.y;
    const overlapsHorizontally = rect.x < own.right && rect.right > own.x;
    if (overlapsVertically && rect.right <= own.x + 0.5) consider('left', own.x - rect.right, item);
    if (overlapsVertically && rect.x >= own.right - 0.5) consider('right', rect.x - own.right, item);
    if (overlapsHorizontally && rect.bottom <= own.y + 0.5) consider('top', own.y - rect.bottom, item);
    if (overlapsHorizontally && rect.y >= own.bottom - 0.5) consider('bottom', rect.y - own.bottom, item);
  });

  return (['left', 'top', 'right', 'bottom'] as const)
    .map((direction) => found[direction])
    .filter((item): item is HandoffNeighbor => Boolean(item));
};

const describeBackground = (element: SceneElement): string | undefined => {
  if (element.backgroundType === 'gradient') {
    const stops = [element.gradientStart, element.gradientVia, element.gradientEnd].filter(Boolean);
    if (!stops.length) return element.backgroundColor;
    const position = element.gradientType === 'radial' ? 'circle at center' : `${numberValue(element.gradientAngle, 135)}deg`;
    return `${element.gradientType === 'radial' ? 'radial' : 'linear'}-gradient(${position}, ${stops.join(', ')})`;
  }
  if (element.backgroundType === 'glass') {
    return element.backgroundColor || 'rgba(255, 255, 255, 0.08)';
  }
  return element.backgroundColor || (element.type === 'shape' ? element.color : undefined);
};

const buildCss = (element: SceneElement, spec: HandoffSpec): string => {
  const className = `aether-${element.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const lines = [
    `/* ${spec.name} · ${spec.typeLabel} */`,
    `.${className} {`,
    '  position: absolute;',
    '  box-sizing: border-box;',
    `  left: ${spec.layout.x}px;`,
    `  top: ${spec.layout.y}px;`,
    `  width: ${spec.layout.w}px;`,
    `  height: ${spec.layout.h}px;`,
  ];

  if (Math.abs(spec.layout.rotation) >= 0.05) lines.push(`  transform: rotate(${spec.layout.rotation}deg);`);
  if (spec.layout.opacity !== 100) lines.push(`  opacity: ${round(spec.layout.opacity / 100, 2)};`);
  lines.push(`  z-index: ${spec.layout.zIndex};`);
  if (spec.appearance.background) lines.push(`  background: ${spec.appearance.background};`);
  if (spec.appearance.border) lines.push(`  border: ${spec.appearance.border};`);
  if (spec.appearance.radius) lines.push(`  border-radius: ${spec.appearance.radius}px;`);
  if (spec.appearance.shadow) lines.push(`  box-shadow: ${spec.appearance.shadow};`);
  if (spec.appearance.backdropBlur) lines.push(`  backdrop-filter: blur(${spec.appearance.backdropBlur}px);`);
  if (spec.appearance.blendMode && spec.appearance.blendMode !== 'normal') lines.push(`  mix-blend-mode: ${spec.appearance.blendMode};`);

  if (spec.typography) {
    lines.push(`  color: ${spec.typography.color};`);
    lines.push(`  font-family: ${spec.typography.fontFamily};`);
    lines.push(`  font-size: ${spec.typography.fontSize}px;`);
    lines.push(`  font-weight: ${spec.typography.fontWeight};`);
    lines.push(`  line-height: ${spec.typography.lineHeight};`);
    lines.push(`  letter-spacing: ${spec.typography.letterSpacing}px;`);
    lines.push(`  text-align: ${spec.typography.align};`);
    if (spec.typography.textWrap === 'nowrap') lines.push('  white-space: nowrap;');
  }

  lines.push('}');
  if (spec.asset?.refId) lines.splice(1, 0, `/* asset: ${spec.asset.refId} */`);
  return lines.join('\n');
};

export function buildHandoffSpec(element: SceneElement, scene: Scene, canvas: HandoffCanvas): HandoffSpec {
  const rect = getElementRect(element, canvas);
  const spacing: HandoffSpacing = {
    left: Math.max(0, rect.x),
    top: Math.max(0, rect.y),
    right: Math.max(0, round(canvas.width - rect.right)),
    bottom: Math.max(0, round(canvas.height - rect.bottom)),
  };

  const textLike = element.type === 'txt' || (element.type === 'shape' && Boolean(element.content));
  const typography: HandoffTypography | undefined = textLike
    ? {
      content: element.content ? element.content.slice(0, 240) : undefined,
      fontFamily: element.fontFamily || 'Inter, system-ui, sans-serif',
      fontSize: round(numberValue(element.fontSize, 16), 1),
      fontWeight: String(element.fontWeight || (element.type === 'shape' ? '700' : '400')),
      lineHeight: round(numberValue(element.lineHeight, 1.2), 2),
      letterSpacing: round(numberValue(element.letterSpacing), 1),
      color: element.textColor || element.color || '#ffffff',
      align: element.textAlign || 'left',
      verticalAlign: element.verticalAlign || 'top',
      textWrap: element.textWrap || 'wrap',
    }
    : undefined;

  const assetLike = ['img', 'vid', 'panorama-img', 'panorama-vid', 'model-3d', 'gaussian-splat'].includes(element.type);
  const asset = assetLike || element.refId
    ? {
      refId: element.refId || '',
      sourceName: element.sourceName,
      mediaAspect: element.mediaAspect,
    }
    : undefined;

  const borderWidth = numberValue(element.borderWidth, 0);
  const appearance: HandoffAppearance = {
    background: describeBackground(element),
    border: borderWidth > 0 ? `${round(borderWidth, 1)}px solid ${element.borderColor || 'transparent'}` : undefined,
    radius: numberValue(element.borderRadius, 0) || undefined,
    shadow: element.boxShadow && element.boxShadow !== 'none' ? element.boxShadow : undefined,
    blendMode: element.blendMode && element.blendMode !== 'normal' ? element.blendMode : undefined,
    backdropBlur: numberValue(element.backdropBlur, 0) || undefined,
    shapeKind: element.shapeKind,
  };

  const spec: HandoffSpec = {
    id: element.id,
    name: getElementDisplayName(element),
    type: element.type,
    typeLabel: TYPE_LABELS[element.type] || element.type,
    sceneId: scene.id,
    sceneName: scene.alias || scene.id,
    canvas,
    percent: {
      x: round(numberValue(element.x), 2),
      y: round(numberValue(element.y), 2),
      w: round(numberValue(element.w), 2),
      h: round(numberValue(element.h), 2),
    },
    layout: {
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      rotation: round(numberValue(element.rot), 1),
      opacity: round(clamp(numberValue(element.opacity, 100), 0, 100), 0),
      zIndex: numberValue(element.zIndex),
    },
    spacing,
    neighbors: findNeighbors(element, scene, canvas),
    appearance,
    typography,
    asset,
    component: element.componentInstance
      ? {
        masterId: element.componentInstance.masterId,
        variantId: element.componentInstance.variantId,
        overrides: Object.keys(element.componentInstance.overrides || {}),
      }
      : undefined,
    timing: {
      startTime: round(numberValue(element.startTime), 2),
      duration: round(numberValue(element.duration), 2),
      inAnimation: element.animType,
      outAnimation: element.exitAnimType,
    },
    interaction: element.linkType || element.interaction
      ? {
        trigger: element.trigger || element.interaction?.trigger,
        action: element.linkType || element.interaction?.action,
        target: element.link || element.interaction?.target,
        url: element.linkUrl || element.interaction?.url,
      }
      : undefined,
    meta: {
      groupChildren: element.children?.length || 0,
      uiComponentType: element.uiComponentType,
      customCodeName: element.customCode?.name,
      hotspotCount: element.hotspots?.length || 0,
      maskEnabled: element.maskEnabled === true,
    },
    css: '',
  };

  spec.css = buildCss(element, spec);
  return spec;
}

export function buildSceneHandoffSpecs(scene: Scene, canvas: HandoffCanvas): HandoffSpec[] {
  return (scene.els || [])
    .filter((element) => element.visible !== false)
    .map((element) => buildHandoffSpec(element, scene, canvas));
}

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const directionLabel: Record<HandoffNeighbor['direction'], string> = {
  left: '左',
  top: '上',
  right: '右',
  bottom: '下',
};

const row = (label: string, value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  return `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
};

const section = (title: string, rows: string): string => (
  rows ? `<h3>${escapeHtml(title)}</h3><div class="grid">${rows}</div>` : ''
);

const buildCard = (spec: HandoffSpec, index: number, selected: boolean): string => {
  const spacingRows = [
    row('到左边缘', `${spec.spacing.left} px`),
    row('到上边缘', `${spec.spacing.top} px`),
    row('到右边缘', `${spec.spacing.right} px`),
    row('到下边缘', `${spec.spacing.bottom} px`),
    ...spec.neighbors.map((neighbor) => row(`距${directionLabel[neighbor.direction]}侧图层`, `${neighbor.gap} px · ${neighbor.name}`)),
  ].join('');

  const appearanceRows = [
    row('背景', spec.appearance.background),
    row('描边', spec.appearance.border),
    row('圆角', spec.appearance.radius !== undefined ? `${spec.appearance.radius} px` : undefined),
    row('阴影', spec.appearance.shadow),
    row('混合模式', spec.appearance.blendMode),
    row('背景模糊', spec.appearance.backdropBlur ? `${spec.appearance.backdropBlur} px` : undefined),
    row('形状', spec.appearance.shapeKind),
  ].join('');

  const typographyRows = spec.typography ? [
    row('字体', spec.typography.fontFamily),
    row('字号', `${spec.typography.fontSize} px`),
    row('字重', spec.typography.fontWeight),
    row('行高', spec.typography.lineHeight),
    row('字间距', `${spec.typography.letterSpacing} px`),
    row('颜色', spec.typography.color),
    row('对齐', `${spec.typography.align} / ${spec.typography.verticalAlign}`),
    row('内容', spec.typography.content),
  ].join('') : '';

  const assetRows = spec.asset ? [
    row('素材名', spec.asset.sourceName),
    row('素材 ID', spec.asset.refId),
    row('原始宽高比', spec.asset.mediaAspect ? `${round(spec.asset.mediaAspect, 3)}` : undefined),
  ].join('') : '';

  const componentRows = spec.component ? [
    row('母版 ID', spec.component.masterId),
    row('变体 ID', spec.component.variantId),
    row('覆盖字段', spec.component.overrides.join(', ')),
  ].join('') : '';

  const interactionRows = spec.interaction ? [
    row('触发', spec.interaction.trigger),
    row('动作', spec.interaction.action),
    row('目标', spec.interaction.target),
    row('URL', spec.interaction.url),
  ].join('') : '';

  const timingRows = [
    row('开始时间', `${spec.timing.startTime} s`),
    row('时长', `${spec.timing.duration} s`),
    row('入场动画', spec.timing.inAnimation),
    row('出场动画', spec.timing.outAnimation),
  ].join('');

  const metaRows = [
    row('图层 ID', spec.id),
    row('场景', spec.sceneName),
    row('编组子图层', spec.meta.groupChildren || undefined),
    row('UI 组件类型', spec.meta.uiComponentType),
    row('自定义代码', spec.meta.customCodeName),
    row('热点数量', spec.meta.hotspotCount || undefined),
    row('蒙版', spec.meta.maskEnabled ? '已启用' : undefined),
  ].join('');

  return `<article class="card${selected ? ' is-selected' : ''}">
    <header>
      <span class="num">${String(index + 1).padStart(2, '0')}</span>
      <h2>${escapeHtml(spec.name)}</h2>
      <span class="badge">${escapeHtml(spec.typeLabel)}</span>
    </header>
    ${section('布局', [
      row('X', `${spec.layout.x} px`),
      row('Y', `${spec.layout.y} px`),
      row('宽度', `${spec.layout.w} px`),
      row('高度', `${spec.layout.h} px`),
      row('旋转', spec.layout.rotation ? `${spec.layout.rotation}°` : '0°'),
      row('不透明度', `${spec.layout.opacity}%`),
      row('层级', spec.layout.zIndex),
    ].join(''))}
    ${section('间距', spacingRows)}
    ${section('外观', appearanceRows)}
    ${section('文字', typographyRows)}
    ${section('素材', assetRows)}
    ${section('组件', componentRows)}
    ${section('交互', interactionRows)}
    ${section('时间轴', timingRows)}
    ${section('图层信息', metaRows)}
    <h3>CSS</h3>
    <pre>${escapeHtml(spec.css)}</pre>
  </article>`;
};

export interface HandoffHTMLInput {
  projectTitle: string;
  scene: Scene;
  canvas: HandoffCanvas;
  specs: HandoffSpec[];
  selectedId?: string | null;
  screenshotDataUrl?: string | null;
}

export function buildHandoffHTML(input: HandoffHTMLInput): string {
  const { projectTitle, scene, canvas, specs, selectedId, screenshotDataUrl } = input;
  const selectedIndex = specs.findIndex((spec) => spec.id === selectedId);
  const generatedAt = new Date().toLocaleString('zh-CN');
  const boxes = specs.map((spec, index) => {
    const selected = spec.id === selectedId;
    return `<div class="layer-box${selected ? ' is-selected' : ''}" style="left:${spec.percent.x}%;top:${spec.percent.y}%;width:${spec.percent.w}%;height:${spec.percent.h}%;transform:rotate(${spec.layout.rotation}deg)">
      <span class="layer-index">${String(index + 1).padStart(2, '0')}</span>
    </div>`;
  }).join('');
  const cards = specs.map((spec, index) => buildCard(spec, index, spec.id === selectedId)).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(projectTitle)} · ${escapeHtml(scene.alias || scene.id)} · 交付标注</title>
<style>
  :root { --accent:#ec4899; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --surface:#ffffff; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f1f5f9; color:var(--ink); font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; }
  .page { max-width:1080px; margin:0 auto; padding:32px 20px 60px; }
  .head { display:flex; justify-content:space-between; gap:16px; align-items:flex-end; border-bottom:2px solid var(--ink); padding-bottom:14px; }
  .head h1 { margin:0; font-size:24px; letter-spacing:-.02em; }
  .head p { margin:4px 0 0; color:var(--muted); font-size:12px; }
  .head .stamp { text-align:right; color:var(--muted); font-size:11px; white-space:nowrap; }
  .toolbar { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 12px; }
  .pill { border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:4px 10px; font-size:11px; color:#334155; }
  .pill strong { color:var(--accent); }
  .canvas { position:relative; width:100%; overflow:hidden; border-radius:12px; background:#0b1020 center/100% 100% no-repeat; box-shadow:0 18px 40px rgba(15,23,42,.18); margin:0 0 10px; }
  .canvas.no-shot { background-image:linear-gradient(rgba(148,163,184,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.13) 1px,transparent 1px),radial-gradient(circle at 50% 40%,#1e293b,#0b1020 70%); background-size:40px 40px,40px 40px,100% 100%; }
  .layer-box { position:absolute; border:1px dashed rgba(236,72,153,.55); background:rgba(236,72,153,.025); transform-origin:center center; }
  .layer-box.is-selected { border:2px solid var(--accent); background:rgba(236,72,153,.1); box-shadow:0 0 0 3px rgba(236,72,153,.16); }
  .layer-index { position:absolute; left:-1px; top:-19px; display:inline-block; min-width:20px; padding:1px 4px; border-radius:3px 3px 0 0; background:rgba(15,23,42,.85); color:#f8fafc; font:700 10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; text-align:center; }
  .layer-box.is-selected .layer-index { background:var(--accent); color:#fff; }
  .hint { color:var(--muted); font-size:11px; margin:0 0 26px; }
  .cards { display:grid; gap:16px; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px 20px; box-shadow:0 6px 20px rgba(15,23,42,.05); break-inside:avoid; }
  .card.is-selected { border-color:rgba(236,72,153,.5); box-shadow:0 8px 26px rgba(236,72,153,.12); }
  .card header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .card .num { font:700 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--accent); }
  .card h2 { margin:0; font-size:16px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .card .badge { margin-left:auto; font-size:10px; color:#9d174d; background:#fce7f3; border-radius:999px; padding:2px 8px; white-space:nowrap; }
  .card h3 { margin:16px 0 6px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
  .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 22px; }
  .row { display:flex; justify-content:space-between; gap:14px; border-bottom:1px dashed var(--line); padding:4px 0; font-size:12px; min-width:0; }
  .row span { color:var(--muted); flex:0 0 auto; }
  .row strong { font-weight:500; text-align:right; overflow-wrap:anywhere; min-width:0; }
  pre { margin:0; padding:12px 14px; border-radius:9px; background:#0f172a; color:#e2e8f0; font:11px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
  .foot { margin-top:28px; color:var(--muted); font-size:10px; text-align:center; }
  @media (max-width:720px) { .head { flex-direction:column; align-items:flex-start; } .head .stamp { text-align:left; } .grid { grid-template-columns:1fr; } }
  @media print { body { background:#fff; } .page { max-width:none; padding:0; } .card { box-shadow:none; } .canvas { box-shadow:none; } .hint { display:none; } }
</style>
</head>
<body>
<main class="page">
  <header class="head">
    <div>
      <h1>${escapeHtml(projectTitle)} · 交付标注</h1>
      <p>场景：${escapeHtml(scene.alias || scene.id)} · 画布：${canvas.width} × ${canvas.height} px · ${specs.length} 个图层</p>
    </div>
    <div class="stamp">生成于 ${escapeHtml(generatedAt)}<br>鲸动交互平台 AETHER</div>
  </header>
  <div class="toolbar">
    <span class="pill">画布 <strong>${canvas.width} × ${canvas.height}</strong></span>
    <span class="pill">选中图层 <strong>${selectedIndex >= 0 ? String(selectedIndex + 1).padStart(2, '0') : '—'}</strong></span>
    <span class="pill">单位 <strong>px</strong></span>
    <span class="pill">尺寸按画布坐标换算</span>
  </div>
  <div class="canvas${screenshotDataUrl ? '' : ' no-shot'}" style="aspect-ratio:${canvas.width} / ${canvas.height};${screenshotDataUrl ? `background-image:url('${escapeHtml(screenshotDataUrl)}');` : ''}">
    ${boxes}
  </div>
  <p class="hint">粉色框为图层边界，粗框为当前选中图层；编号与下方标注卡片一一对应。尺寸、间距均按 ${canvas.width} × ${canvas.height} 画布换算。</p>
  <section class="cards">${cards}</section>
  <div class="foot">由鲸动交互平台生成 · 标注页可直接发给开发，也可打印为 PDF</div>
</main>
</body>
</html>`;
}
