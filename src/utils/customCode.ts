import type { CustomCodeDiagnostic, CustomCodePlugin, SceneElement } from '../types';

const MAX_CODE_SIZE = 100_000;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string; sources?: CustomCodeDiagnostic['source'][] }> = [
  // Keep this check case-sensitive: ordinary `function (...)` declarations are safe,
  // while JavaScript's dynamic APIs are specifically lowercase `eval` and uppercase `Function`.
  { pattern: /\b(?:eval|Function)\s*\(/, message: '禁止使用 eval / Function 动态执行代码；请改用普通函数、事件监听或 CSS 动画。' },
  { pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/i, message: '禁止访问网络接口，请改用静态数据或平台数据绑定。' },
  { pattern: /\b(?:Worker|SharedWorker|ServiceWorker)\b/i, message: '禁止创建 Worker 或 Service Worker。' },
  { pattern: /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/i, message: '禁止访问浏览器存储、Cookie 或工程外部数据。' },
  { pattern: /\b(?:window\.open|window\.top|window\.parent|parent\.document)\b/i, message: '禁止访问宿主页面或打开新窗口。' },
  { pattern: /\bnavigator\.geolocation\b/i, message: '检测到 navigator.geolocation：自定义组件不能读取用户位置。请移除该调用。' },
  { pattern: /\bnavigator\.mediaDevices\b/i, message: '检测到 navigator.mediaDevices：自定义组件不能调用摄像头或麦克风。请移除该调用。' },
  { pattern: /(?:javascript:|data:text\/html)/i, message: '禁止使用脚本协议或 HTML 数据 URL。' },
  { pattern: /<\s*script\b/i, message: '脚本请填写在 JavaScript 分栏，HTML 中不允许嵌入 script 标签。', sources: ['html'] },
  { pattern: /\bimport\s+(?:[\w*{]|['"])/i, message: '首期仅支持浏览器原生 JavaScript，不支持 React/Vue 或模块导入。', sources: ['js'] },
];

const lineColumn = (source: string, index: number) => {
  const before = source.slice(0, Math.max(0, index));
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: (lines.at(-1)?.length || 0) + 1 };
};

const diagnostic = (source: CustomCodeDiagnostic['source'], message: string, code: string, index = 0): CustomCodeDiagnostic => ({
  level: 'error',
  source,
  message,
  ...lineColumn(code, index),
});

export const inspectCustomCode = (html: string, css: string, js: string): { errors: CustomCodeDiagnostic[]; warnings: CustomCodeDiagnostic[] } => {
  const errors: CustomCodeDiagnostic[] = [];
  const warnings: CustomCodeDiagnostic[] = [];
  const total = html.length + css.length + js.length;
  if (total === 0) errors.push(diagnostic('html', '至少输入 HTML、CSS 或 JavaScript 代码。', html));
  if (html.length > MAX_CODE_SIZE) errors.push(diagnostic('html', 'HTML 超过 100 KB 限制。', html, MAX_CODE_SIZE));
  if (css.length > MAX_CODE_SIZE) errors.push(diagnostic('css', 'CSS 超过 100 KB 限制。', css, MAX_CODE_SIZE));
  if (js.length > MAX_CODE_SIZE) errors.push(diagnostic('js', 'JavaScript 超过 100 KB 限制。', js, MAX_CODE_SIZE));

  for (const [source, code] of [['html', html], ['css', css], ['js', js]] as const) {
    for (const item of BLOCKED_PATTERNS) {
      if (item.sources && !item.sources.includes(source)) continue;
      const match = item.pattern.exec(code);
      if (match) errors.push(diagnostic(source, item.message, code, match.index));
    }
  }
  // Copy buttons often first check navigator.clipboard before calling writeText.
  // The sandbox exposes only a write-only facade, so that harmless capability
  // check is permitted while reads, assignments and host-global bypasses stay blocked.
  for (const [source, code] of [['html', html], ['css', css], ['js', js]] as const) {
    const clipboardPattern = /\bnavigator\s*\.\s*clipboard\b/gi;
    for (let match = clipboardPattern.exec(code); match; match = clipboardPattern.exec(code)) {
      const previous = code[match.index - 1] || '';
      const remainder = code.slice(match.index + match[0].length);
      const isHostBypass = /[\w$.]/.test(previous);
      const isClipboardRead = /^\s*(?:\?\.|\.)\s*(?:readText|read)\s*\(/i.test(remainder);
      const isClipboardMutation = /^\s*=/.test(remainder);
      if (isHostBypass || isClipboardRead || isClipboardMutation) {
        errors.push(diagnostic(source, '自定义组件仅允许检测 navigator.clipboard 或调用 navigator.clipboard.writeText(...) 写入文本，不能读取、修改或绕过隔离剪贴板。', code, match.index));
      }
    }
  }
  const externalResource = /(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.exec(html);
  if (externalResource) errors.push(diagnostic('html', '默认禁止加载外部网络资源，请使用内联资源或平台素材。', html, externalResource.index));
  if (/url\(\s*["']?(?:https?:)?\/\//i.test(css)) errors.push(diagnostic('css', '默认禁止加载外部 CSS 资源。', css, css.search(/url\(\s*["']?(?:https?:)?\/\//i)));
  if (/while\s*\(\s*true\s*\)|for\s*\(\s*;;/i.test(js)) warnings.push({ level: 'warning', source: 'performance', message: '检测到可能阻塞主线程的无限循环，请确认代码会主动退出。' });
  if ((html.match(/<canvas\b/gi) || []).length > 4) warnings.push({ level: 'warning', source: 'performance', message: 'Canvas 数量较多，展厅大屏运行时可能增加重绘开销。' });
  if (js.length > 50_000) warnings.push({ level: 'warning', source: 'performance', message: 'JavaScript 体积较大，建议拆分初始化逻辑并减少持续计算。' });
  return { errors, warnings };
};

/** Validate persisted/imported plugins at every runtime boundary, not only in the editor modal. */
export const inspectCustomCodePlugin = (plugin: Pick<CustomCodePlugin, 'html' | 'css' | 'js'>) => inspectCustomCode(plugin.html || '', plugin.css || '', plugin.js || '');

const escapeClosingTag = (code: string, tag: string) => code.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

export type CustomCodeTextStyle = Pick<SceneElement,
  'color' | 'fontSize' | 'fontFamily' | 'fontWeight' | 'fontStyle' | 'textDecoration' |
  'textAlign' | 'letterSpacing' | 'lineHeight' | 'textOpacity' | 'textGlowEnabled' |
  'textGlowColor' | 'textGlowIntensity' | 'textGlowBlur' | 'textShadowEnabled' |
  'textShadowColor' | 'textShadowOpacity' | 'textShadowBlur' | 'textShadowDistance' |
  'textShadowAngle'>;

const PRIMARY_EDITABLE_ELEMENT = /<([a-z][\w:-]*)(?=[^>]*\bcontenteditable\s*=\s*(?:"true"|'true'|true))[^>]*>([\s\S]*?)<\/\1\s*>/i;
const PRIMARY_PLAIN_TEXT_ELEMENT = /<(span|div|p|label|button|a|h[1-6]|strong|em|li)([^>]*)>([^<>]*[^\s<>][^<>]*)<\/\1\s*>/i;
const decodeTextEntities = (value: string) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");
const escapeTextHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** The inspector edits only an explicitly editable plugin label, never arbitrary markup. */
export const getPrimaryEditableCustomCodeText = (html: string) => {
  const match = html.match(PRIMARY_EDITABLE_ELEMENT);
  return match ? decodeTextEntities(match[2].replace(/<[^>]*>/g, '')) : '';
};

const getPrimaryCustomCodeTextMatch = (html: string) => html.match(PRIMARY_EDITABLE_ELEMENT) || html.match(PRIMARY_PLAIN_TEXT_ELEMENT);

/** Detect a meaningful authored label or number before enabling native typography controls. */
export const hasCustomCodeTextLayer = (html: string) => Boolean(getPrimaryCustomCodeText(html).trim());

export const getPrimaryCustomCodeText = (html: string) => {
  const editableMatch = html.match(PRIMARY_EDITABLE_ELEMENT);
  const match = editableMatch || html.match(PRIMARY_PLAIN_TEXT_ELEMENT);
  if (!match) return '';
  const contents = editableMatch ? editableMatch[2] : match[3];
  return decodeTextEntities((contents || '').replace(/<[^>]*>/g, ''));
};

export const replacePrimaryEditableCustomCodeText = (html: string, value: string) => {
  const match = html.match(PRIMARY_EDITABLE_ELEMENT);
  if (!match) return html;
  const start = match.index || 0;
  const openingEnd = match[0].indexOf('>') + 1;
  const closingStart = match[0].lastIndexOf(`</${match[1]}`);
  return `${html.slice(0, start + openingEnd)}${escapeTextHtml(value)}${html.slice(start + closingStart)}`;
};

/** Update only the first detected text layer, leaving the component structure and other labels intact. */
export const replacePrimaryCustomCodeText = (html: string, value: string) => {
  const match = getPrimaryCustomCodeTextMatch(html);
  if (!match) return html;
  const start = match.index || 0;
  const openingEnd = match[0].indexOf('>') + 1;
  const closingStart = match[0].lastIndexOf(`</${match[1]}`);
  return `${html.slice(0, start + openingEnd)}${escapeTextHtml(value)}${html.slice(start + closingStart)}`;
};

const markPrimaryCustomCodeTextLayer = (html: string) => {
  const match = getPrimaryCustomCodeTextMatch(html);
  if (!match || !getPrimaryCustomCodeText(html).trim()) return html;
  const start = match.index || 0;
  const openingEnd = match[0].indexOf('>');
  const opening = match[0].slice(0, openingEnd);
  if (/\bdata-aether-text-layer\s*=/i.test(opening)) return html;
  return `${html.slice(0, start)}${opening} data-aether-text-layer="true">${match[0].slice(openingEnd + 1)}${html.slice(start + match[0].length)}`;
};

const clampNumber = (value: number | undefined, fallback: number, min: number, max: number) => {
  const next = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(max, Math.max(min, next));
};

const safeCssColor = (value: string | undefined, fallback: string) => {
  const candidate = value?.trim() || fallback;
  return /^(?:#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{1,24})$/i.test(candidate) ? candidate : fallback;
};

const customCodeTypographyCss = (style?: CustomCodeTextStyle) => {
  if (!style || !Object.values(style).some((value) => value !== undefined)) return '';
  const declarations: string[] = [];
  const color = safeCssColor(style.color, '#ffffff');
  if (style.color !== undefined) declarations.push(`color:${color}!important`);
  if (style.fontFamily !== undefined) declarations.push(`font-family:${style.fontFamily ? JSON.stringify(style.fontFamily) : 'inherit'}!important`);
  if (style.fontSize !== undefined) declarations.push(`font-size:${clampNumber(style.fontSize, 24, 8, 200)}px!important`);
  if (style.fontWeight !== undefined && /^(?:normal|bold|bolder|lighter|[1-9]00)$/i.test(style.fontWeight)) declarations.push(`font-weight:${style.fontWeight}!important`);
  if (style.fontStyle !== undefined) declarations.push(`font-style:${style.fontStyle === 'italic' ? 'italic' : 'normal'}!important`);
  if (style.textDecoration !== undefined) declarations.push(`text-decoration:${style.textDecoration === 'underline' ? 'underline' : 'none'}!important`);
  if (style.textAlign !== undefined) declarations.push(`text-align:${style.textAlign === 'left' || style.textAlign === 'right' ? style.textAlign : 'center'}!important`);
  if (style.letterSpacing !== undefined) declarations.push(`letter-spacing:${clampNumber(style.letterSpacing, 0, -20, 80)}px!important`);
  if (style.lineHeight !== undefined) declarations.push(`line-height:${clampNumber(style.lineHeight, 1.625, 0.6, 4)}!important`);
  if (style.textOpacity !== undefined) declarations.push(`opacity:${clampNumber(style.textOpacity, 100, 0, 100) / 100}!important`);
  const shadows: string[] = [];
  if (style.textGlowEnabled) {
    const blur = clampNumber(style.textGlowBlur, 24, 0, 120);
    const intensity = clampNumber(style.textGlowIntensity, 50, 0, 100) / 100;
    shadows.push(`0 0 ${blur}px color-mix(in srgb, ${safeCssColor(style.textGlowColor, color)} ${(intensity * 100).toFixed(0)}%, transparent)`);
  }
  if (style.textShadowEnabled) {
    const distance = clampNumber(style.textShadowDistance, 4, 0, 100);
    const angle = clampNumber(style.textShadowAngle, 45, -180, 180) * Math.PI / 180;
    const blur = clampNumber(style.textShadowBlur, 8, 0, 120);
    const alpha = clampNumber(style.textShadowOpacity, 65, 0, 100);
    shadows.push(`${(Math.cos(angle) * distance).toFixed(1)}px ${(Math.sin(angle) * distance).toFixed(1)}px ${blur}px color-mix(in srgb, ${safeCssColor(style.textShadowColor, '#000000')} ${alpha.toFixed(0)}%, transparent)`);
  }
  if (shadows.length) declarations.push(`text-shadow:${shadows.join(',')}!important`);
  return `[data-aether-text-layer="true"]{${declarations.join(';')}}`;
};

/** Keep a missing legacy payload visible instead of rendering an empty box. */
export const getRenderableCustomCodeHtml = (html?: string, js?: string) => {
  if (html?.trim() || js?.trim()) return html || '';
  return '<div class="aether-custom-code-missing">自定义代码组件内容为空</div>';
};

export const buildTransparentCustomCodeMarkup = (html: string, css: string, typography?: CustomCodeTextStyle) => {
  // Older exports could persist a complete HTML document in the HTML pane.
  // Shadow DOM needs the body fragment; nested html/head/body nodes are ignored
  // inconsistently by browsers and can make the visible component disappear.
  const documentFragment = getRenderableCustomCodeHtml(html)
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    // A document split by an older version can retain head children after its
    // head tag was removed. A title element treats all following markup as raw
    // text, which prevents dynamically created SVG nodes from being found.
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<(?:meta|base|link)\b[^>]*>/gi, '')
    .replace(/<html[^>]*>|<\/html>|<body[^>]*>|<\/body>/gi, '');
  const safeHtml = documentFragment
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    // Inline handlers are not executed by Shadow DOM innerHTML. Preserve them
    // as inert data attributes; the scoped runner binds them after the authored
    // script has declared functions such as addData/updateChart.
    .replace(/\son([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, eventName, doubleQuoted, singleQuoted, bare) => {
      const handler = String(doubleQuoted ?? singleQuoted ?? bare ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return ` data-aether-inline-event-${String(eventName).toLowerCase()}="${handler}"`;
    })
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, '');
  const textMarkedHtml = markPrimaryCustomCodeTextLayer(safeHtml);
  const scopedCss = escapeClosingTag((css || '').replace(/(^|[,{}])\s*(?:html|body|:root)\b/gim, '$1#aether-custom-code-root'), 'style');

  return `<style>:host{display:block;width:100%;height:100%;background:transparent;overflow:visible;}*,*::before,*::after{box-sizing:border-box;}${scopedCss}${customCodeTypographyCss(typography)}#aether-custom-code-root{position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;background:transparent!important;overflow:visible;}/* The source body/html layout is scoped onto the root. Keep its flex/grid/centering rules intact; forcing display:block here makes authored UI stick to the top of a taller selection box. */#aether-custom-code-content{display:contents!important;}#aether-custom-code-content > :first-child:last-child{box-sizing:border-box;width:100%;min-height:100%;}#aether-custom-code-content > .plugin-card{box-sizing:border-box;width:100%;height:100%;min-height:100%;display:flex;align-items:center;justify-content:center;}/* Generic press feedback stays inside the transparent Shadow DOM and does not replace authored transforms. */#aether-custom-code-content :is(.btn,button,[role="button"]){transition:filter 120ms ease-out,opacity 120ms ease-out;}#aether-custom-code-content :is(.btn,button,[role="button"]):active{filter:brightness(.9) saturate(1.08);opacity:.92;}:host([data-aether-enabled="false"]) *,#aether-custom-code-root[data-aether-enabled="false"] *{animation-play-state:paused!important;}/* Effects stay on the rendered alpha silhouette, never on the plugin's rectangular host. */:host([data-aether-effect-active="true"][data-aether-effect="glow"]) #aether-custom-code-root{filter:drop-shadow(0 0 7px var(--aether-effect-color,#38bdf8)) drop-shadow(0 0 18px color-mix(in srgb,var(--aether-effect-color,#38bdf8) 48%,transparent));}:host([data-aether-effect-active="true"][data-aether-effect="outline"]) #aether-custom-code-root{filter:drop-shadow(-1px 0 0 var(--aether-effect-color,#38bdf8)) drop-shadow(1px 0 0 var(--aether-effect-color,#38bdf8)) drop-shadow(0 -1px 0 var(--aether-effect-color,#38bdf8)) drop-shadow(0 1px 0 var(--aether-effect-color,#38bdf8)) drop-shadow(0 0 6px color-mix(in srgb,var(--aether-effect-color,#38bdf8) 35%,transparent));}:host([data-aether-effect-active="true"][data-aether-effect="brighten"]) #aether-custom-code-root{filter:brightness(1.16) saturate(1.06);}</style><div id="aether-custom-code-root"><div id="aether-custom-code-content">${textMarkedHtml}</div></div>`;
};

const safePreviewBackground = (value: string) => {
  if (value === 'transparent' || value === 'scene') return value === 'scene' ? '#07111d' : 'transparent';
  return /^(?:#[0-9a-f]{3,8}|rgba?\([^)]{1,80}\)|hsla?\([^)]{1,80}\)|[a-z]{1,24})$/i.test(value.trim())
    ? value.trim()
    : 'transparent';
};

export const buildCustomCodeSrcDoc = (plugin: Pick<CustomCodePlugin, 'html' | 'css' | 'js'> & Partial<Pick<CustomCodePlugin, 'preview' | 'textOverrides'>>, instanceId: string, surfaceBackground?: string, inlineTextEditing = false, typography?: CustomCodeTextStyle, focusTextKey?: string, fitContent = false) => {
  // Chromium composites sandboxed iframe documents onto an opaque canvas. Use the host surface
  // as the iframe canvas so a transparent component visually merges with its target surface.
  // Custom-code layers are composited over the authored scene. Legacy plugins
  // may persist a white preview background, which must never become an opaque
  // rectangle in the editor or in exported HTML.
  const background = safePreviewBackground(surfaceBackground || 'transparent');
  const html = escapeClosingTag(escapeClosingTag(escapeClosingTag(markPrimaryCustomCodeTextLayer(getRenderableCustomCodeHtml(plugin.html, plugin.js)), 'script'), 'body'), 'html');
  const runtime = `
    (() => {
      const send = (type, payload = {}) => window.parent.postMessage({ source: 'aether-custom-code', instanceId: ${JSON.stringify(instanceId)}, type, ...payload }, '*');
      const nativeConsole = window.console;
      const stringifyConsoleValue = (value) => {
        if (value instanceof Error) return value.stack || (value.name + ': ' + value.message);
        if (typeof value === 'string') return value;
        try { return JSON.stringify(value); } catch { return String(value); }
      };
      const sendConsoleDiagnostic = (level, args) => {
        if (level !== 'warn' && level !== 'error') return;
        const errorValue = args.find((value) => value instanceof Error);
        send('diagnostic', {
          category: 'console',
          level: 'warning',
          message: args.map(stringifyConsoleValue).join(' '),
          stack: errorValue instanceof Error ? errorValue.stack : undefined,
        });
      };
      const scopedConsole = Object.create(nativeConsole);
      ['log', 'info', 'debug', 'warn', 'error'].forEach((method) => {
        scopedConsole[method] = (...args) => {
          sendConsoleDiagnostic(method, args);
          nativeConsole[method].apply(nativeConsole, args);
        };
      });
      window.console = scopedConsole;
      window.addEventListener('error', (event) => send('error', { message: event.message || '脚本运行错误', line: event.lineno, column: event.colno, stack: event.error?.stack }));
      window.addEventListener('unhandledrejection', (event) => send('unhandledrejection', { reason: stringifyConsoleValue(event.reason), stack: event.reason?.stack }));
      const root = document.getElementById('aether-custom-code-root');
      // A custom document can set a white body/root through inline styles or
      // late script mutations. The component surface is always composited over
      // the scene, so keep only the authored content visible and transparent.
      const enforceTransparentSurface = () => {
        [document.documentElement, document.body, root].forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          node.style.setProperty('background', 'transparent', 'important');
          node.style.setProperty('background-color', 'transparent', 'important');
          node.style.setProperty('background-image', 'none', 'important');
          node.style.setProperty('border', '0', 'important');
          node.style.setProperty('box-shadow', 'none', 'important');
        });
        // Keep authored content surfaces intact. Clearing the first child or
        // large panels exposes the layer below and creates a false rectangle.
      };
      const observeLateSurfaceStyles = () => {
        if (!root) return () => {};
        let frame = 0;
        const observer = new MutationObserver((records) => {
          if (frame || !records.some((record) => record.target instanceof HTMLElement)) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            observer.disconnect();
            enforceTransparentSurface();
            observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
          });
        });
        observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        return () => {
          observer.disconnect();
          if (frame) cancelAnimationFrame(frame);
        };
      };
      const inlineTextEditing = ${inlineTextEditing};
      const focusTextKey = ${JSON.stringify(focusTextKey || '')};
      const textOverrides = ${JSON.stringify(plugin.textOverrides || {})};
      const excludedTags = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CANVAS']);
      const candidates = () => Array.from(root?.querySelectorAll('*') || []).filter((node) => {
        const element = node;
        return !excludedTags.has(element.tagName) && !element.closest('svg,style,script,input,textarea,select,option,canvas')
          && element.children.length === 0 && Boolean(element.textContent?.trim());
      });
      const assignTextKeys = (items) => {
        const usedTextKeys = new Set(items.map((element) => element.dataset.aetherTextKey).filter(Boolean));
        let nextTextKey = 0;
        items.forEach((element) => {
          if (element.dataset.aetherTextKey) return;
          while (usedTextKeys.has('text-' + nextTextKey)) nextTextKey += 1;
          element.dataset.aetherTextKey = 'text-' + nextTextKey;
          usedTextKeys.add('text-' + nextTextKey);
          nextTextKey += 1;
        });
      };
      const markInlineEditableText = () => {
        if (!inlineTextEditing || !root) return;
        const items = candidates();
        assignTextKeys(items);
        items.forEach((element) => {
          element.setAttribute('contenteditable', 'true');
          element.setAttribute('data-aether-inline-editable', 'true');
          element.spellcheck = false;
          element.style.cursor = 'text';
          element.style.userSelect = 'text';
        });
      };
      const applyTextOverrides = () => {
        if (!root || !textOverrides || typeof textOverrides !== 'object') return;
        Object.entries(textOverrides).forEach(([key, value]) => {
          const target = root.querySelector('[data-aether-text-key="' + CSS.escape(key) + '"]');
          if (target && target.textContent !== String(value)) target.textContent = String(value);
        });
      };
      const enableInlineTextEditing = () => {
        markInlineEditableText();
        if (!inlineTextEditing || !root) return;
        root.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
            event.preventDefault();
            const active = document.activeElement;
            if (active instanceof HTMLElement) active.blur();
          }
        });
        root.addEventListener('focusout', (event) => {
          const target = event.target;
          if (!(target instanceof Element) || target.getAttribute('data-aether-inline-editable') !== 'true') return;
          window.setTimeout(() => {
            const snapshot = root.cloneNode(true);
            snapshot.querySelectorAll('[data-aether-inline-editable]').forEach((element) => {
              element.removeAttribute('contenteditable');
              element.removeAttribute('data-aether-inline-editable');
              element.removeAttribute('spellcheck');
              // 保留 data-aether-text-key：智能参数依赖稳定 key 才能继续写回。
            });
            const textKey = target.getAttribute('data-aether-text-key');
            // 一次性把 DOM 快照与文字 key/新值发给宿主，避免两次更新互相覆盖。
            send('content', {
              html: snapshot.innerHTML,
              textKey: textKey || undefined,
              value: textKey ? (target.textContent || '') : undefined,
            });
          }, 0);
        });
        // Custom-code scripts can create labels after DOMContentLoaded (for
        // example SVG chart values). Keep those late nodes editable as well.
        const observer = new MutationObserver(() => markInlineEditableText());
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
      };
      const focusRequestedText = () => {
        if (!inlineTextEditing || !focusTextKey || !root) return;
        const target = candidates().find((element) => element.dataset.aetherTextKey === focusTextKey);
        if (!(target instanceof HTMLElement)) return;
        target.focus({ preventScroll: true });
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
      };
      let contentScale = 1;
      let fitScale = 1;
      const applyRootTransform = () => {
        if (!root) return;
        const scale = contentScale * fitScale;
        root.style.transform = scale !== 1 ? 'scale(' + scale + ')' : 'none';
        root.style.transformOrigin = fitScale < 0.999 ? 'left top' : 'center center';
      };
      const scaleToViewport = () => {
        // The iframe viewport owns the component rectangle. Keep the exported
        // root on that same rectangle so intrinsic HTML sizing cannot change
        // the exported aspect ratio or leave a strip below the artwork.
        if (!root) return;
        root.style.display = 'block';
        root.style.width = '100%';
        root.style.height = '100%';
        root.style.minWidth = '0';
        root.style.minHeight = '0';
        // Preview/history cards are fixed-size. When the authored content is
        // larger than the card, scale it down instead of cropping it.
        if (${fitContent}) {
          const vw = Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1);
          const vh = Math.max(1, document.documentElement.clientHeight || window.innerHeight || 1);
          const cw = Math.max(vw, root.scrollWidth || 0);
          const ch = Math.max(vh, root.scrollHeight || 0);
          fitScale = Math.min(1, vw / cw, vh / ch);
        } else {
          fitScale = 1;
        }
        applyRootTransform();
      };
      // 编辑器通过 postMessage 实时下发控件属性（尺寸/辉光/配色/开关/速度），
      // 不再需要把整段代码重新注入页面。这里与旧 Shadow DOM 行为保持一致。
      const applyProps = (incoming) => {
        if (!root || !incoming || typeof incoming !== 'object') return;
        Object.entries(incoming).forEach(([key, value]) => {
          const text = String(value);
          const textKeyIndex = key.startsWith('text-') ? key.slice(5) : '';
          if (textKeyIndex && /^[0-9]+$/.test(textKeyIndex)) {
            // 智能参数里的文本/数值项：直接写回对应文本叶子，实时生效。
            const target = root.querySelector('[data-aether-text-key="' + CSS.escape(key) + '"]');
            if (target && target.textContent !== text) target.textContent = text;
            return;
          }
          // 同时写到 root / html / body：作者 CSS 可能写在 body 或 :root 上。
          [root, document.documentElement, document.body].forEach((target) => {
            if (!target) return;
            target.style.setProperty('--aether-' + key, text);
            target.style.setProperty('--' + key, text);
          });
        });
        const sizeNumber = Number(incoming.size);
        if (incoming.size !== undefined && Number.isFinite(sizeNumber)) {
          contentScale = sizeNumber / 100;
          root.style.transition = 'transform .15s ease-out';
          applyRootTransform();
        }
        const glow = incoming.glow === undefined ? undefined : Number(incoming.glow);
        const color = incoming.color || '#38bdf8';
        if (glow !== undefined && Number.isFinite(glow) && glow > 0) {
          root.style.filter = 'drop-shadow(0 0 ' + (glow * 0.18) + 'px ' + color + ')';
          root.style.transition = 'filter .15s ease-out, transform .15s ease-out';
        } else if (glow !== undefined) {
          root.style.filter = '';
        }
        if (incoming.color) {
          ['--aether-color', '--color', '--theme-color', '--primary-color', '--accent-color', '--accent', '--primary']
            .forEach((name) => root.style.setProperty(name, String(incoming.color)));
        }
        const enabled = incoming.enabled !== false;
        root.setAttribute('data-aether-enabled', enabled ? 'true' : 'false');
        root.style.opacity = enabled ? '' : '0.5';
        const speed = incoming.speed === undefined ? 1 : Number(incoming.speed);
        try {
          (root.getAnimations?.({ subtree: true }) || []).forEach((animation) => {
            if (!enabled) animation.pause();
            else {
              animation.play();
              if (Number.isFinite(speed) && speed > 0) animation.playbackRate = speed;
            }
          });
        } catch {}
        root.dispatchEvent(new CustomEvent('aether:props', { detail: incoming }));
      };
      window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || data.source !== 'aether-custom-code-host' || data.instanceId !== ${JSON.stringify(instanceId)}) return;
        if (data.type === 'props') { applyProps(data.props); syncLayout(); }
        else if (data.type === 'measure') syncLayout();
        else if (data.type === 'focus-text') focusRequestedText();
      });
      const measureVisibleBounds = () => {
        const viewportWidth = Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1);
        const viewportHeight = Math.max(1, document.documentElement.clientHeight || window.innerHeight || 1);
        const rects = [];
        const ignoredTags = {
          SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TITLE: 1, HEAD: 1,
          DEFS: 1, CLIPPATH: 1, MASK: 1, PATTERN: 1, LINEARGRADIENT: 1,
          RADIALGRADIENT: 1, STOP: 1, FILTER: 1, FOREIGNOBJECT: 1,
        };
        const addBox = (left, top, right, bottom) => {
          const l = Math.max(0, left);
          const t = Math.max(0, top);
          const r = Math.min(viewportWidth, right);
          const b = Math.min(viewportHeight, bottom);
          if (r - l <= 0.5 || b - t <= 0.5) return;
          rects.push({ left: l, top: t, right: r, bottom: b });
        };
        const addElement = (element) => {
          const box = element.getBoundingClientRect();
          if (!box || box.width <= 0 || box.height <= 0) return;
          addBox(box.left, box.top, box.right, box.bottom);
        };
        const addSvg = (svg) => {
          try {
            const bbox = svg.getBBox();
            const matrix = svg.getScreenCTM();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0 || !matrix) { addElement(svg); return; }
            const points = [
              [bbox.x, bbox.y],
              [bbox.x + bbox.width, bbox.y],
              [bbox.x, bbox.y + bbox.height],
              [bbox.x + bbox.width, bbox.y + bbox.height],
            ].map(([x, y]) => {
              const point = new DOMPoint(x, y).matrixTransform(matrix);
              return { x: point.x, y: point.y };
            });
            addBox(
              Math.min(...points.map((point) => point.x)),
              Math.min(...points.map((point) => point.y)),
              Math.max(...points.map((point) => point.x)),
              Math.max(...points.map((point) => point.y)),
            );
          } catch {
            addElement(svg);
          }
        };
        const paints = (element, style) => {
          const tag = element.tagName.toLowerCase();
          if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'iframe') return true;
          if (style.backgroundColor && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)') return true;
          if (style.backgroundImage && style.backgroundImage !== 'none') return true;
          if (style.boxShadow && style.boxShadow !== 'none') return true;
          if (style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth || '0') > 0) return true;
          return element.children.length === 0 && Boolean((element.textContent || '').trim());
        };
        let visited = 0;
        const walk = (node, depth) => {
          if (depth > 24 || visited > 2000) return;
          for (const child of node.children) {
            visited += 1;
            if (visited > 2000) return;
            if (ignoredTags[child.tagName]) continue;
            if (child.getAttribute('data-aether-measure-ignore') === 'true') continue;
            const style = window.getComputedStyle(child);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
            if (child.tagName === 'svg') { addSvg(child); continue; }
            if (paints(child, style)) addElement(child);
            walk(child, depth + 1);
          }
        };
        if (root) walk(root, 0);
        // 没有可绘制子节点时退回 root（例如纯 CSS 背景组件）。
        if (rects.length === 0 && root) addElement(root);
        if (rects.length === 0) return;
        const inset = 2;
        const left = Math.max(0, Math.min(...rects.map((rect) => rect.left)) - inset);
        const top = Math.max(0, Math.min(...rects.map((rect) => rect.top)) - inset);
        const right = Math.min(viewportWidth, Math.max(...rects.map((rect) => rect.right)) + inset);
        const bottom = Math.min(viewportHeight, Math.max(...rects.map((rect) => rect.bottom)) + inset);
        if (right <= left || bottom <= top) return;
        send('bounds', { x: left, y: top, width: right - left, height: bottom - top, viewportWidth, viewportHeight });
      };
      const syncLayout = () => requestAnimationFrame(() => { scaleToViewport(); measureVisibleBounds(); });
      const boot = () => {
        enforceTransparentSurface();
        const stopSurfaceObserver = observeLateSurfaceStyles();
        window.addEventListener('beforeunload', stopSurfaceObserver, { once: true });
        // 保留 HTML 里已标注的 data-aether-text-key（智能参数/手动指定），
        // 其余叶子按运行顺序补 text-N，避免与已有 key 冲突。
        assignTextKeys(candidates());
        applyTextOverrides();
        enableInlineTextEditing();
        send('ready');
        syncLayout();
        requestAnimationFrame(syncLayout);
        // User code registered after this runtime can append chart labels during
        // DOMContentLoaded. Focus after both handlers and the observer have run.
        window.setTimeout(() => { markInlineEditableText(); focusRequestedText(); syncLayout(); }, 0);
        window.setTimeout(() => { markInlineEditableText(); focusRequestedText(); syncLayout(); }, 160);
        window.setTimeout(enforceTransparentSurface, 0);
        window.setTimeout(enforceTransparentSurface, 160);
      };
      window.addEventListener('resize', syncLayout);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
    })();
  `;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none';"/><style>html,body{margin:0;width:100%;height:100%;min-height:100%;overflow:hidden;background:${background};color-scheme:normal;border:0;outline:0;box-shadow:none;}body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}*,*::before,*::after{box-sizing:border-box;}iframe{display:block;border:0!important;outline:0!important;box-shadow:none!important;}.custom-code-empty{width:100%;height:100%;min-height:32px;} ${escapeClosingTag(plugin.css || '', 'style')}${customCodeTypographyCss(typography)}:root,html,html body{background:${background} !important;background-color:${background} !important;background-image:none !important;color-scheme:normal;border:0!important;outline:0!important;box-shadow:none!important;}#aether-custom-code-root{display:inline-block;transform:scale(1);transform-origin:center center;will-change:transform;border:0!important;outline:0!important;box-shadow:none!important;}#aether-custom-code-root > :first-child:last-child{box-sizing:border-box;width:100%;min-height:100%;}#aether-custom-code-root > .plugin-card{box-sizing:border-box;width:100%;height:100%;min-height:100%;display:flex;align-items:center;justify-content:center;}[data-aether-inline-editable="true"]{cursor:text!important;}[data-aether-inline-editable="true"]:focus{outline:1px dashed rgba(56,189,248,.9);outline-offset:3px;}</style></head><body><div id="aether-custom-code-root">${html}</div><script>${escapeClosingTag(runtime, 'script')}</script><script>${escapeClosingTag(plugin.js || '', 'script')}</script></body></html>`;
};

type SplitCustomCode = { html: string; css: string; js: string };

const inferCustomCodePreviewSize = (html: string, css: string) => {
  const viewBox = html.match(/viewBox\s*=\s*["']\s*[-+\d.]+\s+[-+\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return { width, height };
  }
  const cssAspect = css.match(/aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/i);
  if (cssAspect) {
    const width = Number(cssAspect[1]);
    const height = Number(cssAspect[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return { width, height };
  }
  return undefined;
};

export const getCustomCodeAspectRatio = (plugin?: Pick<CustomCodePlugin, 'preview'> & Partial<Pick<CustomCodePlugin, 'html' | 'css'>>) => {
  const width = Number(plugin?.preview?.width);
  const height = Number(plugin?.preview?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return width / height;
  const inferred = inferCustomCodePreviewSize(plugin?.html || '', plugin?.css || '');
  if (inferred) return inferred.width / inferred.height;
  return 16 / 9;
};

/** Returns an authored ratio only when the plugin declares one explicitly. */
export const getCustomCodeDeclaredAspectRatio = (plugin?: Pick<CustomCodePlugin, 'preview'> & Partial<Pick<CustomCodePlugin, 'html' | 'css'>>) => {
  const width = Number(plugin?.preview?.width);
  const height = Number(plugin?.preview?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return width / height;
  const inferred = inferCustomCodePreviewSize(plugin?.html || '', plugin?.css || '');
  return inferred ? inferred.width / inferred.height : undefined;
};

const appendCode = (current: string, next: string) => {
  const value = next.trim();
  if (!value) return current;
  return current ? `${current}\n${value}` : value;
};

const splitHtmlDocument = (source: string): SplitCustomCode => {
  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1].trim()).filter(Boolean);
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => match[1].trim()).filter(Boolean);
  const bodies = [...source.matchAll(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/gi)].map((match) => match[1].trim()).filter(Boolean);
  // For complete documents, preserve every body in paste order. This matters
  // when several generated components are pasted in one operation.
  const htmlSource = bodies.length ? bodies.join('\n') : source;
  const html = htmlSource
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<(?:meta|base|link)\b[^>]*>/gi, '')
    .replace(/<html\b[^>]*>|<\/html\s*>|<body\b[^>]*>|<\/body\s*>/gi, '')
    .trim();
  return { html, css: styles.join('\n'), js: scripts.join('\n') };
};

export const splitCustomCodeDocument = (code: string): SplitCustomCode => {
  const source = code.trim();
  const fenced = [...source.matchAll(/```(?:html?|css|javascript|js)?\s*([\s\S]*?)```/gi)];
  if (fenced.length > 0) {
    const buckets: SplitCustomCode = { html: '', css: '', js: '' };
    for (const match of fenced) {
      const full = match[0];
      const language = (full.match(/^```\s*([\w-]*)/i)?.[1] || '').toLowerCase();
      const value = match[1].trim();
      if (!value) continue;
      if (language === 'css') buckets.css = appendCode(buckets.css, value);
      else if (language === 'js' || language === 'javascript') buckets.js = appendCode(buckets.js, value);
      else if (/<(?:html|head|body|style|script)\b/i.test(value)) {
        const parsed = splitHtmlDocument(value);
        buckets.html = appendCode(buckets.html, parsed.html);
        buckets.css = appendCode(buckets.css, parsed.css);
        buckets.js = appendCode(buckets.js, parsed.js);
      } else buckets.html = appendCode(buckets.html, value);
    }
    return buckets;
  }
  return splitHtmlDocument(source);
};

export const createCustomCodePlugin = (name: string, description: string, html: string, css: string, js: string, diagnostics: CustomCodePlugin['diagnostics']): CustomCodePlugin => {
  const now = new Date().toISOString();
  const inferredSize = inferCustomCodePreviewSize(html, css);
  return { id: `custom-code-${Date.now()}`, version: 1, name: name.trim() || '自定义代码组件', description: description.trim() || undefined, html, css, js, preview: { mode: 'responsive', background: 'transparent', ...inferredSize }, diagnostics, createdAt: now, updatedAt: now };
};
