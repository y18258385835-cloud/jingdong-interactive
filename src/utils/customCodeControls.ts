import type { CustomCodeControl, CustomCodeControlType, CustomCodeControlOption } from '../types';

/**
 * Parses inline annotations or JSON schema blocks from custom code (HTML/CSS/JS)
 * to extract configurable controls for the Inspector Panel.
 *
 * Supported formats:
 * 1. Single-line annotation:
 *    // @control slider key=speed label="流动速度" min=0.1 max=10 step=0.1 default=1 unit="x"
 *    // @control color key=glowColor label="光效颜色" default="#00ffcc"
 *    // @control toggle key=enableGlow label="开启辉光" default=true
 *    // @control select key=waveType label="波形类型" options="正弦:sine,余弦:cosine" default="sine"
 *    // @control number key=particleCount label="粒子数量" min=10 max=2000 step=10 default=200
 *    // @control text key=title label="标题文字" default="设备遥测"
 *
 * 2. Block JSON Schema:
 *    /* @schema
 *    {
 *      "controls": [ ... ]
 *    }
 *    *\/
 */

const FRIENDLY_LABEL_MAP: Record<string, string> = {
  speed: '动效速度',
  color: '主题色彩',
  'primary-color': '主色调',
  'accent-color': '强调色',
  'bg-color': '背景颜色',
  glow: '辉光强度',
  blur: '模糊半径',
  size: '尺寸比例',
  scale: '缩放大小',
  radius: '圆角半径',
  opacity: '不透明度',
  width: '宽度',
  height: '高度',
  font: '文字字体',
  'font-size': '字体大小',
  'border-color': '边框颜色',
};

function formatFriendlyLabel(rawKey: string): string {
  const lower = rawKey.toLowerCase().replace(/^(?:aether|theme|ui|custom)[-_]/i, '');
  if (FRIENDLY_LABEL_MAP[lower]) return FRIENDLY_LABEL_MAP[lower];
  return lower.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseTypedValue(raw: string): any {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
  // Strip quotes if any
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseOptions(raw: string): CustomCodeControlOption[] {
  // Format: "label1:val1,label2:val2" or "val1,val2" or JSON array
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return { label: String(item.label || item.value || ''), value: item.value ?? item.label };
          }
          return { label: String(item), value: item };
        });
      }
    } catch {
      // Fallback to comma-separated
    }
  }

  return trimmed.split(',').map((part) => {
    const pair = part.split(':').map((s) => s.trim());
    if (pair.length >= 2) {
      return { label: pair[0], value: parseTypedValue(pair.slice(1).join(':')) };
    }
    return { label: pair[0], value: parseTypedValue(pair[0]) };
  }).filter((opt) => opt.label.length > 0);
}

export function extractControlsFromCode(code: string): CustomCodeControl[] {
  if (!code || typeof code !== 'string') return [];
  const controls: CustomCodeControl[] = [];
  const seenKeys = new Set<string>();

  // 1. Try block JSON schema first: /* @schema ... */
  const schemaBlockMatch = /\/\*\s*@schema\s*([\s\S]*?)\*\//i.exec(code);
  if (schemaBlockMatch) {
    try {
      const parsed = JSON.parse(schemaBlockMatch[1]);
      const list = Array.isArray(parsed) ? parsed : parsed?.controls;
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && typeof item === 'object' && typeof item.key === 'string' && item.key.trim()) {
            const key = item.key.trim();
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              controls.push({
                key,
                label: typeof item.label === 'string' ? item.label : key,
                type: (['slider', 'number', 'color', 'toggle', 'select', 'text'].includes(item.type) ? item.type : 'text') as CustomCodeControlType,
                default: item.default ?? (item.type === 'toggle' ? false : item.type === 'slider' || item.type === 'number' ? 0 : ''),
                min: typeof item.min === 'number' ? item.min : undefined,
                max: typeof item.max === 'number' ? item.max : undefined,
                step: typeof item.step === 'number' ? item.step : undefined,
                unit: typeof item.unit === 'string' ? item.unit : undefined,
                options: Array.isArray(item.options) ? item.options : undefined,
                group: typeof item.group === 'string' ? item.group : undefined,
              });
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse error and proceed to line-by-line annotations
    }
  }

  // 2. Line-by-line @control annotations
  // e.g. // @control slider key=speed label="旋转速度" min=0.1 max=10 step=0.1 default=1
  const lineRegex = /(?:\/\/|\/\*)\s*@control\s+([a-zA-Z0-9_-]+)\s+([\s\S]*?)(?:\*\/|$)/gmi;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(code)) !== null) {
    const rawType = match[1].toLowerCase();
    const attributesString = match[2];
    const type: CustomCodeControlType = ['slider', 'number', 'color', 'toggle', 'select', 'text'].includes(rawType)
      ? (rawType as CustomCodeControlType)
      : 'text';

    // Parse attributes: key="value" or key=value
    const attrRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\t\r\n,]+))/g;
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
      const attrKey = attrMatch[1];
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      attrs[attrKey] = attrVal;
    }

    const key = attrs.key || attrs.name || attrs.id;
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const label = attrs.label || attrs.title || key;
    let defaultValue = parseTypedValue(attrs.default ?? attrs.value ?? '');
    if (defaultValue === '' || defaultValue === undefined) {
      if (type === 'slider' || type === 'number') defaultValue = attrs.min ? Number(attrs.min) : 0;
      else if (type === 'toggle') defaultValue = false;
      else if (type === 'color') defaultValue = '#38bdf8';
      else defaultValue = '';
    }

    const control: CustomCodeControl = {
      key,
      label,
      type,
      default: defaultValue,
      group: attrs.group,
      unit: attrs.unit,
    };

    if (attrs.min !== undefined && !Number.isNaN(Number(attrs.min))) control.min = Number(attrs.min);
    if (attrs.max !== undefined && !Number.isNaN(Number(attrs.max))) control.max = Number(attrs.max);
    if (attrs.step !== undefined && !Number.isNaN(Number(attrs.step))) control.step = Number(attrs.step);
    if (attrs.options) control.options = parseOptions(attrs.options);

    controls.push(control);
  }

  // 3. Scan CSS custom properties: --key: value; (e.g. in :root, :host, or styles)
  const cssVarRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g;
  let cssMatch: RegExpExecArray | null;
  while ((cssMatch = cssVarRegex.exec(code)) !== null) {
    const rawKey = cssMatch[1].trim();
    const rawVal = cssMatch[2].trim();
    const key = rawKey.replace(/^aether[-_]/i, '');
    if (!key || seenKeys.has(key)) continue;
    if (/^(tw-|webkit-|moz-|ms-|syntax-)/i.test(key)) continue;

    const label = formatFriendlyLabel(key);

    // 3.1 Color check
    if (/^#(?:[0-9a-fA-F]{3,8})$/i.test(rawVal) || /^rgba?\(/i.test(rawVal) || /^hsla?\(/i.test(rawVal)) {
      seenKeys.add(key);
      controls.push({
        key,
        label,
        type: 'color',
        default: rawVal,
        group: '样式与色彩',
      });
      continue;
    }

    // 3.2 Numeric check
    const numMatch = /^([-+]?[0-9]*\.?[0-9]+)(px|rem|em|%|s|ms|deg|x)?$/i.exec(rawVal);
    if (numMatch) {
      seenKeys.add(key);
      const num = parseFloat(numMatch[1]);
      const unit = numMatch[2] || '';
      let min = 0;
      let max = 100;
      let step = 1;

      if (unit === 's' || unit === 'x' || num <= 5) {
        min = 0;
        max = Math.max(5, Math.ceil(num * 2.5));
        step = 0.1;
      } else if (unit === '%') {
        min = 0;
        max = 100;
        step = 1;
      } else if (unit === 'deg') {
        min = 0;
        max = 360;
        step = 1;
      } else {
        min = 0;
        max = Math.max(100, Math.ceil(num * 2));
        step = num < 1 ? 0.05 : 1;
      }

      controls.push({
        key,
        label,
        type: 'slider',
        default: num,
        min,
        max,
        step,
        unit,
        group: '数值调节',
      });
      continue;
    }
  }

  // 4. Fallback scan for standard CSS property declarations in uploaded code
  // Only runs if no explicit @schema, @control, or CSS custom variables were defined
  if (controls.length === 0 && code.trim().length > 0) {
    const stdColorRegex = /(?:background(?:-color)?|border-color|color|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;
    let stdMatch: RegExpExecArray | null;
    while ((stdMatch = stdColorRegex.exec(code)) !== null) {
      const matchedText = stdMatch[0];
      const colonIndex = matchedText.indexOf(':');
      const prop = matchedText.slice(0, colonIndex).trim().toLowerCase();
      const colorVal = stdMatch[1].trim();
      const key = prop.includes('background') ? 'bgColor' : prop.includes('border') ? 'borderColor' : 'themeColor';
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        controls.push({
          key,
          label: key === 'bgColor' ? '背景颜色' : key === 'borderColor' ? '边框颜色' : '主题色彩',
          type: 'color',
          default: colorVal,
          group: '样式与色彩',
        });
      }
    }

    if (/(?:@keyframes|animation\s*:|transition\s*:)/i.test(code) && !seenKeys.has('speed')) {
      seenKeys.add('speed');
      controls.push({
        key: 'speed',
        label: '动效速度',
        type: 'slider',
        default: 1.0,
        min: 0.1,
        max: 3.0,
        step: 0.1,
        unit: 'x',
        group: '基础动效',
      });
    }

    if (controls.length > 0) {
      if (!seenKeys.has('size')) {
        seenKeys.add('size');
        controls.push({
          key: 'size',
          label: '组件缩放',
          type: 'slider',
          default: 100,
          min: 50,
          max: 150,
          step: 5,
          unit: '%',
          group: '基础动效',
        });
      }
      if (!seenKeys.has('enabled')) {
        seenKeys.add('enabled');
        controls.push({
          key: 'enabled',
          label: '动画开启',
          type: 'toggle',
          default: true,
          group: '基础动效',
        });
      }
    }
  }

  return controls;
}

/**
 * Extracts all controls from a complete CustomCodePlugin (HTML, CSS, JS)
 */
export function extractPluginControls(plugin: { html?: string; css?: string; js?: string; controls?: CustomCodeControl[] }): CustomCodeControl[] {
  if (Array.isArray(plugin.controls) && plugin.controls.length > 0) {
    return plugin.controls;
  }
  const combinedCode = `${plugin.html || ''}\n${plugin.css || ''}\n${plugin.js || ''}`;
  return extractControlsFromCode(combinedCode);
}

/**
 * Resolves current active prop values by merging declared defaults with element-level overrides.
 */
export function resolveControlValues(
  controls: CustomCodeControl[],
  overrides?: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const ctrl of controls) {
    result[ctrl.key] = overrides && overrides[ctrl.key] !== undefined
      ? overrides[ctrl.key]
      : ctrl.default;
  }
  return result;
}

/**
 * Generates CSS custom property string from key-value props
 * e.g. "--aether-speed: 2; --aether-color: #00ffcc;"
 */
export function buildCssVariablesFromProps(props: Record<string, any>): string {
  if (!props || typeof props !== 'object') return '';
  const entries = Object.entries(props).map(([key, val]) => {
    // Sanitize key name for CSS variable
    const cssKey = `--aether-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return `${cssKey}: ${val};`;
  });
  return entries.join(' ');
}
