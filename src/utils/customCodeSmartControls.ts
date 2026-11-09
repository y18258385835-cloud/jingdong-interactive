import type { CustomCodeControl, CustomCodePlugin } from '../types';

/**
 * 本地结构识别：不依赖大模型，直接从自定义代码里找出“真实可调”的目标。
 *
 * - 文本/数值：给 HTML 文本叶子加 data-aether-text-key="text-N"，
 *   运行时把 text-N 的 props 直接写回该文本节点（不重建 iframe）。
 * - 颜色/字号/圆角：把 CSS 里的真实字面量替换成 var/calc 变量，
 *   运行时本来就会把 props 写成根节点 CSS 变量，因此天然生效。
 *
 * 这样生成的每个参数都有明确落点，不会出现“AI 生成了参数但拖了没反应”。
 */

export interface SmartCustomCodeControlsResult {
  html: string;
  css: string;
  controls: CustomCodeControl[];
}

const MAX_TEXT_CONTROLS = 10;
const MAX_COLOR_CONTROLS = 4;
const MAX_FONT_CONTROLS = 3;

const SKIP_TAGS = new Set([
  'script', 'style', 'option', 'textarea', 'input', 'select', 'svg', 'path', 'canvas', 'iframe', 'link', 'meta',
]);

const truncate = (text: string, max = 14) => (text.length > max ? `${text.slice(0, max)}…` : text);

const normalizeColor = (value: string) => value.toLowerCase().replace(/\s+/g, '');

interface TextHit {
  index: number;
  tag: string;
  text: string;
  score: number;
  headerLike: boolean;
  numeric: boolean;
  key: string;
  hasKey: boolean;
}

const collectTextHits = (html: string): TextHit[] => {
  const hits: TextHit[] = [];
  const reservedKeys = new Set<string>();
  const regex = /<([a-zA-Z][\w:-]*)((?:\s[^>]*)?)>([^<>]+)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    const existingKey = match[2].match(/\bdata-aether-text-key\s*=\s*["']([^"']+)["']/i)?.[1];
    // 任何已存在的 key 都要预留，包括超长文本/未入选的叶子，避免新 key 撞车。
    if (existingKey) reservedKeys.add(existingKey);
    const text = match[3].replace(/\s+/g, ' ').trim();
    if (!text || text.length > 80) continue;
    const className = `${match[2].match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || ''}`.toLowerCase();
    const headerLike = tag === 'th'
      || /^(h[1-6])$/.test(tag)
      || /(title|header|heading|label|caption|subtitle|eyebrow)/.test(className);
    const numeric = /^[+-]?[\d,]+(?:\.\d+)?%?$/.test(text);
    let score = 0;
    if (tag === 'th') score += 120;
    if (headerLike) score += 70;
    if (numeric) score += 45;
    if (tag === 'td') score += 25;
    if (/(value|num|stat|metric|count|amount|rate|percent|number)/.test(className)) score += 35;
    if (/(table|row|cell|col|list|grid)/.test(className)) score += 15;
    hits.push({
      index: match.index,
      tag,
      text,
      score,
      headerLike,
      numeric,
      // 已有 key（来自内联编辑/旧版本）保持稳定，其余稍后分配不冲突的 text-N。
      key: existingKey || '',
      hasKey: Boolean(existingKey),
    });
  }

  let nextKey = 0;
  hits.forEach((hit) => {
    if (hit.key) return;
    while (reservedKeys.has(`text-${nextKey}`)) nextKey += 1;
    hit.key = `text-${nextKey}`;
    reservedKeys.add(hit.key);
    nextKey += 1;
  });
  return hits;
};

const instrumentText = (html: string): { html: string; controls: CustomCodeControl[] } => {
  const hits = collectTextHits(html);
  if (hits.length === 0) return { html, controls: [] };
  const selected = hits
    .slice()
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_TEXT_CONTROLS)
    .sort((a, b) => a.index - b.index);
  if (selected.length === 0) return { html, controls: [] };

  const tableLike = /<(?:table|thead|tbody|tr|th|td)\b/i.test(html)
    || /class\s*=\s*["'][^"']*(?:table|grid|row|list|cell)/i.test(html);
  const controls = selected.map((hit) => {
    const prefix = hit.headerLike
      ? (hit.tag === 'th' ? '表头' : '标题')
      : hit.numeric ? '数值' : '文字';
    return {
      key: hit.key,
      label: `${prefix} · ${truncate(hit.text)}`,
      type: 'text' as const,
      default: hit.text,
      group: tableLike ? '表格内容' : '内容文字',
    };
  });

  const byIndex = new Map<number, TextHit>(hits.map((hit) => [hit.index, hit]));
  const nextHtml = html.replace(/<([a-zA-Z][\w:-]*)((?:\s[^>]*)?)>([^<>]+)<\/\1>/g, (full, tag: string, attrs: string, text: string, offset: number) => {
    const hit = byIndex.get(offset);
    if (!hit) return full;
    if (hit.hasKey) return full;
    return `<${tag}${attrs} data-aether-text-key="${hit.key.replace(/"/g, '')}">${text}</${tag}>`;
  });

  return { html: nextHtml, controls };
};

const colorPropertyPattern = /((?:^|[;{]\s*)(?:color|background|background-color|border(?:-[a-z]+)?-color|fill|stroke|outline-color)\s*:\s*)(#[0-9a-fA-F]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\))/gi;
const fontPropertyPattern = /((?:^|[;{]\s*)font-size\s*:\s*)(\d+(?:\.\d+)?)(px|rem|em|%)\b/gi;
const radiusPropertyPattern = /((?:^|[;{]\s*)border-radius\s*:\s*)(\d+(?:\.\d+)?)(px|%)\b/gi;

interface CssLiteral {
  value: string;
  unit: string;
  count: number;
  property: string;
}

const collectCssLiterals = (css: string, pattern: RegExp): CssLiteral[] => {
  const map = new Map<string, CssLiteral>();
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    const value = match[2];
    const unit = match[3] || '';
    const id = `${value}${unit}`.toLowerCase();
    const property = match[1].replace(/^[;{]\s*/, '').split(':')[0].trim().toLowerCase();
    const existing = map.get(id);
    if (existing) existing.count += 1;
    else map.set(id, { value, unit, count: 1, property });
  }
  return [...map.values()];
};

const colorLabel = (property: string) => {
  if (property.includes('background')) return '背景颜色';
  if (property.includes('border') || property === 'outline-color') return '边框颜色';
  if (property === 'fill' || property === 'stroke') return '图形颜色';
  if (property === 'color') return '文字颜色';
  return '主题颜色';
};

const SMART_KEY_PATTERN = /^ctl-(?:text|color|font|radius)-/;

/**
 * 重新识别时保留已经落到代码里的控制项，避免第二次点击“AI 生成”后
 * 由于 CSS 已被替换成 var(...) 而丢掉配色/字号控制。
 */
const mergeExistingSmartControls = (
  recognized: CustomCodeControl[],
  existing: CustomCodeControl[] | undefined,
): CustomCodeControl[] => {
  const existingSmart = (existing || []).filter((control) => SMART_KEY_PATTERN.test(control.key));
  if (existingSmart.length === 0) return recognized;
  const recognizedByKey = new Map(recognized.map((control) => [control.key, control]));
  const merged = existingSmart.map((control) => {
    const next = recognizedByKey.get(control.key);
    if (!next) return control;
    return {
      ...next,
      // 保留用户/AI 已经确认过的名称与分组。
      label: control.label || next.label,
      group: control.group || next.group,
    };
  });
  const mergedKeys = new Set(merged.map((control) => control.key));
  recognized.forEach((control) => {
    if (!mergedKeys.has(control.key)) merged.push(control);
  });
  return merged;
};

export function buildSmartCustomCodeControls(
  plugin: Pick<CustomCodePlugin, 'html' | 'css' | 'js'>,
  existingControls?: CustomCodeControl[],
): SmartCustomCodeControlsResult {
  const originalHtml = plugin.html || '';
  const originalCss = plugin.css || '';
  const controls: CustomCodeControl[] = [];

  // 二次识别时，新参数从已有编号之后继续，避免和已落地的 CSS 变量串色。
  const nextControlIndex = (prefix: string) => (existingControls || []).reduce((max, control) => {
    if (!control.key.startsWith(prefix)) return max;
    const index = Number(control.key.slice(prefix.length));
    return Number.isFinite(index) ? Math.max(max, index) : max;
  }, 0);

  const textResult = instrumentText(originalHtml);
  let nextHtml = textResult.html;
  controls.push(...textResult.controls);

  const tableLike = /<(?:table|thead|tbody|tr|th|td)\b/i.test(originalHtml)
    || /class\s*=\s*["'][^"']*(?:table|grid|row|list|cell)/i.test(originalHtml);

  // ---- 颜色：找出真实字面量并替换为可调 CSS 变量 ----
  const colors = collectCssLiterals(originalCss, colorPropertyPattern)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_COLOR_CONTROLS);
  const colorOffset = nextControlIndex('ctl-color-');
  let nextCss = originalCss;
  if (colors.length > 0) {
    const colorKeys = new Map<string, string>();
    colors.forEach((color, index) => colorKeys.set(normalizeColor(color.value), `ctl-color-${colorOffset + index + 1}`));
    nextCss = nextCss.replace(colorPropertyPattern, (full, prefix: string, value: string) => {
      const key = colorKeys.get(normalizeColor(value));
      return key ? `${prefix}var(--${key}, ${value})` : full;
    });
    colors.forEach((color, index) => {
      const key = `ctl-color-${colorOffset + index + 1}`;
      const labelIndex = colorOffset + index + 1;
      controls.push({
        key,
        label: colors.length > 1 || colorOffset > 0 ? `${colorLabel(color.property)} ${labelIndex}` : colorLabel(color.property),
        type: 'color',
        default: color.value,
        group: tableLike ? '表格配色' : '颜色与样式',
      });
    });
  }

  // ---- 字号 ----
  const fonts = collectCssLiterals(originalCss, fontPropertyPattern)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_FONT_CONTROLS);
  const fontOffset = nextControlIndex('ctl-font-');
  if (fonts.length > 0) {
    const fontKeys = new Map<string, string>();
    fonts.forEach((font, index) => fontKeys.set(`${font.value}${font.unit}`.toLowerCase(), `ctl-font-${fontOffset + index + 1}`));
    nextCss = nextCss.replace(fontPropertyPattern, (full, prefix: string, value: string, unit: string) => {
      const key = fontKeys.get(`${value}${unit}`.toLowerCase());
      // CSS 变量下发的是纯数字，必须用 calc 补单位，否则 font-size:12 非法。
      return key ? `${prefix}calc(var(--${key}, ${value}) * 1${unit})` : full;
    });
    fonts.forEach((font, index) => {
      const numeric = Number(font.value);
      const unit = font.unit || 'px';
      controls.push({
        key: `ctl-font-${fontOffset + index + 1}`,
        label: fonts.length > 1 || fontOffset > 0 ? `字体大小 ${fontOffset + index + 1}` : '字体大小',
        type: 'slider',
        default: numeric,
        min: unit === 'px' ? 8 : unit === '%' ? 50 : 0.5,
        max: unit === 'px' ? Math.max(48, Math.ceil(numeric * 2)) : unit === '%' ? 200 : 4,
        step: unit === 'px' || unit === '%' ? 1 : 0.1,
        unit,
        group: tableLike ? '表格样式' : '文字与外形',
      });
    });
  }

  // ---- 圆角 ----
  const radius = collectCssLiterals(originalCss, radiusPropertyPattern)
    .sort((a, b) => b.count - a.count)
    .slice(0, 1);
  const radiusOffset = nextControlIndex('ctl-radius-');
  if (radius.length === 1) {
    const item = radius[0];
    const key = `ctl-radius-${radiusOffset + 1}`;
    nextCss = nextCss.replace(radiusPropertyPattern, (full, prefix: string, value: string, unit: string) => {
      // 同上：数字 + 单位分开下发，calc 负责拼回合法 CSS 长度。
      return `${prefix}calc(var(--${key}, ${value}) * 1${unit})`;
    });
    const numeric = Number(item.value);
    controls.push({
      key,
      label: radiusOffset > 0 ? `圆角 ${radiusOffset + 1}` : '圆角',
      type: 'slider',
      default: numeric,
      min: 0,
      max: item.unit === '%' ? 50 : Math.max(24, Math.ceil(numeric * 2)),
      step: 1,
      unit: item.unit || 'px',
      group: tableLike ? '表格样式' : '文字与外形',
    });
  }

  return { html: nextHtml, css: nextCss, controls: mergeExistingSmartControls(controls, existingControls) };
}

export interface AiControlNamingItem {
  key?: unknown;
  label?: unknown;
  group?: unknown;
}

/**
 * AI 只负责“起名字/分组”：控制项本身必须来自本地识别出的真实 key。
 * AI 返回未知 key 时直接丢弃，保证不会出现拖动无反应的伪参数。
 */
export function mergeAiControlNaming(
  baseControls: CustomCodeControl[],
  aiItems: unknown,
): CustomCodeControl[] {
  if (!Array.isArray(aiItems) || aiItems.length === 0) return baseControls;
  const allowed = new Set(baseControls.map((control) => control.key));
  const namingByKey = new Map<string, { label?: string; group?: string }>();
  aiItems.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as AiControlNamingItem;
    const key = typeof item.key === 'string' ? item.key.trim() : '';
    if (!key || !allowed.has(key)) return;
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 30) : '';
    const group = typeof item.group === 'string' ? item.group.trim().slice(0, 20) : '';
    if (!label && !group) return;
    namingByKey.set(key, { ...(label ? { label } : {}), ...(group ? { group } : {}) });
  });
  if (namingByKey.size === 0) return baseControls;
  return baseControls.map((control) => {
    const naming = namingByKey.get(control.key);
    if (!naming) return control;
    return { ...control, ...naming };
  });
}
