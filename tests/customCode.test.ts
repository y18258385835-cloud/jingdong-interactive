import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCustomCodeSrcDoc, buildTransparentCustomCodeMarkup, createCustomCodePlugin, getPrimaryCustomCodeText, getPrimaryEditableCustomCodeText, getRenderableCustomCodeHtml, hasCustomCodeTextLayer, inspectCustomCode, replacePrimaryCustomCodeText, replacePrimaryEditableCustomCodeText, splitCustomCodeDocument } from '../src/utils/customCode';
import { sanitizeCustomCodeLibraryItems } from '../src/utils/customCodeLibrary';
import { formatRuntimeDiagnosticMessage, parseRuntimeDiagnostic, parseRuntimeStackLocation } from '../src/utils/customCodeRuntimeDiagnostics';
import { TransparentCustomCodeFrame } from '../src/components/TransparentCustomCodeFrame';

describe('custom code plugin sandbox', () => {
  it('keeps a visible fallback when legacy HTML is missing', () => {
    expect(getRenderableCustomCodeHtml('   ')).toContain('aether-custom-code-missing');
    expect(buildTransparentCustomCodeMarkup('   ', '')).toContain('自定义代码组件内容为空');
  });

  it('keeps sandboxed frames transparent and fits oversized previews', () => {
    const base = buildCustomCodeSrcDoc({ html: '<div>透明</div>', css: '', js: '', preview: { mode: 'responsive', background: 'transparent' } }, 'ccf_test');
    // 宿主是 color-scheme: dark 时，iframe 会继承并合成成白底，必须显式 normal。
    expect(base).toContain('color-scheme:normal');
    expect(base).toContain('if (false)');
    const fitted = buildCustomCodeSrcDoc({ html: '<div>透明</div>', css: '', js: '', preview: { mode: 'responsive', background: 'transparent' } }, 'ccf_test', 'transparent', false, undefined, undefined, true);
    expect(fitted).toContain('if (true)');
    expect(fitted).toContain('fitScale');
    const markup = renderToStaticMarkup(createElement(TransparentCustomCodeFrame, { html: '<div>透明</div>', css: '', js: '', interactive: false, fitContent: true }));
    expect(markup).toContain('color-scheme:normal');
  });

  it('filters library entries that cannot render', () => {
    const valid = { id: 'item-1', plugin: { id: 'p-1', name: 'Valid', html: '<b>ok</b>' }, target: { category: 'ai', slot: 'custom-code' } };
    const invalid = { id: 'item-2', plugin: { id: 'p-2', name: 'Empty', html: ' ' }, target: { category: 'ai', slot: 'custom-code' } };
    expect(sanitizeCustomCodeLibraryItems([valid, invalid])).toHaveLength(1);
  });
  it('rejects privileged and network APIs', () => {
    const result = inspectCustomCode('<div></div>', '', 'fetch("https://example.com"); localStorage.setItem("x", "1");');
    expect(result.errors.map((item) => item.source)).toContain('js');
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('allows clipboard writes while blocking reads and sandbox bypasses', () => {
    expect(inspectCustomCode('<div></div>', '', 'if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText("copy");').errors).toEqual([]);

    const blocked = inspectCustomCode('<div></div>', '', 'navigator.clipboard.readText(); globalThis.navigator.clipboard.writeText("copy");');
    expect(blocked.errors).toHaveLength(2);
    expect(blocked.errors.every((item) => item.message.includes('剪贴板'))).toBe(true);
  });

  it('allows normal function declarations without allowing dynamic Function execution', () => {
    const safe = inspectCustomCode('<div></div>', '', 'function render() { return 1; } const handler = () => render();');
    expect(safe.errors).toEqual([]);

    const blocked = inspectCustomCode('<div></div>', '', 'const render = Function("return 1");');
    expect(blocked.errors.some((item) => item.source === 'js')).toBe(true);
  });

  it('rejects external HTML and CSS resources', () => {
    const result = inspectCustomCode('<img src="https://example.com/a.png">', 'body{background:url(https://example.com/a.png)}', '');
    expect(result.errors.some((item) => item.source === 'html')).toBe(true);
    expect(result.errors.some((item) => item.source === 'css')).toBe(true);
  });

  it('rejects script tags and module imports from pasted code', () => {
    const result = inspectCustomCode('<script>alert(1)</script>', '', 'import React from "react";');
    expect(result.errors.some((item) => item.source === 'html')).toBe(true);
    expect(result.errors.some((item) => item.source === 'js')).toBe(true);
  });

  it('does not apply HTML-only checks to the CSS and JavaScript panes', () => {
    const result = inspectCustomCode('<div></div>', '/* <script> */', '// <script>');
    expect(result.errors).toEqual([]);
  });

  it('places runtime and user JavaScript in executable script tags', () => {
    const srcDoc = buildCustomCodeSrcDoc({ html: '<button id="button">OK</button>', css: '', js: 'document.querySelector("#button").dataset.ready = "yes";', preview: { mode: 'responsive', background: 'transparent' } }, 'test-instance');
    expect(srcDoc).toContain('<script>');
    expect(srcDoc).toContain('document.querySelector');
    expect(srcDoc).toContain('test-instance');
    expect(srcDoc.indexOf('document.querySelector')).toBeGreaterThan(srcDoc.indexOf('window.addEventListener'));
    expect(srcDoc).toContain('html body{background:transparent !important');
    expect(srcDoc).toContain('background-color:transparent !important');
    expect(srcDoc).toContain('border:0;outline:0;box-shadow:none');
    expect(srcDoc).toContain('iframe{display:block;border:0!important;outline:0!important;box-shadow:none!important;}');
    expect(srcDoc).toContain("send('bounds'");
    expect(srcDoc).toContain('id="aether-custom-code-root"');
    expect(srcDoc).toContain('scaleToViewport');
  });

  it('uses the host surface as the transparent component backdrop when requested', () => {
    const srcDoc = buildCustomCodeSrcDoc({ html: '<div></div>', css: '', js: '', preview: { mode: 'responsive', background: 'transparent' } }, 'test-instance', '#07111d');
    expect(srcDoc).toContain('html body{background:#07111d !important');
    expect(srcDoc).toContain('background-color:#07111d !important');
  });

  it('keeps transparent plugins transparent when no explicit preview colour is requested', () => {
    const srcDoc = buildCustomCodeSrcDoc({ html: '<div></div>', css: '', js: '', preview: { mode: 'responsive', background: 'transparent' } }, 'test-instance');
    expect(srcDoc).toContain('html body{background:transparent !important');
    expect(srcDoc).not.toContain('background:#000000 !important');
  });

  it('ignores legacy solid preview backgrounds for custom-code exports', () => {
    const srcDoc = buildCustomCodeSrcDoc({ html: '<div>Legacy</div>', css: '', js: '', preview: { mode: 'responsive', background: '#ffffff' } }, 'legacy-export');
    expect(srcDoc).toContain('html body{background:transparent !important');
    expect(srcDoc).not.toContain('background:#ffffff');
  });

  it('enables inline text editing only when explicitly requested by the canvas editor', () => {
    const srcDoc = buildCustomCodeSrcDoc({ html: '<span>Editable</span>', css: '', js: '', preview: { mode: 'responsive', background: 'transparent' } }, 'test-instance', undefined, true);
    expect(srcDoc).toContain('const inlineTextEditing = true');
    expect(srcDoc).toContain("send('content'");
    expect(srcDoc).toContain('data-aether-inline-editable');
    expect(srcDoc).toContain("event.key === 'Escape'");
    expect(srcDoc).toContain("active.blur()");
  });

  it('keeps runtime-created text layers editable and focuses the clicked text key', () => {
    const srcDoc = buildCustomCodeSrcDoc(
      { html: '<div class="label">Ready</div>', css: '', js: '', preview: { mode: 'responsive', background: 'transparent' } },
      'test-instance',
      undefined,
      true,
      undefined,
      'text-3',
    );
    expect(srcDoc).toContain('const focusTextKey = "text-3"');
    expect(srcDoc).toContain('new MutationObserver(() => markInlineEditableText())');
    expect(srcDoc).toContain('focusRequestedText()');
  });

  it('keeps the Shadow DOM renderer contract ready for dynamically created text layers', async () => {
    const source = await import('../src/components/TransparentCustomCodeFrame');
    expect(source.TransparentCustomCodeFrame).toBeTypeOf('function');
  });

  it('maps a component editable label into the native layer property without touching its structure', () => {
    const html = '<div class="btn"><span class="btn-text" contenteditable="true">READ MORE 72</span><svg></svg></div>';
    expect(getPrimaryEditableCustomCodeText(html)).toBe('READ MORE 72');
    expect(replacePrimaryEditableCustomCodeText(html, 'READ MORE 86')).toBe('<div class="btn"><span class="btn-text" contenteditable="true">READ MORE 86</span><svg></svg></div>');
  });

  it('enables native typography only for a detected code text layer', () => {
    const html = '<div class="card"><span class="label">STATUS 72</span><svg></svg></div>';
    expect(hasCustomCodeTextLayer(html)).toBe(true);
    expect(getPrimaryCustomCodeText(html)).toBe('STATUS 72');
    expect(replacePrimaryCustomCodeText(html, 'STATUS 86')).toContain('STATUS 86');

    const markup = buildTransparentCustomCodeMarkup(html, '', { fontSize: 30, color: '#22d3ee', textAlign: 'left' });
    expect(markup).toContain('data-aether-text-layer="true"');
    expect(markup).toContain('font-size:30px!important');
    expect(markup).toContain('text-align:left!important');
    expect(hasCustomCodeTextLayer('<svg><path d="M0 0"/></svg>')).toBe(false);
  });

  it('scopes CSS-only plugins into a transparent component surface', () => {
    const markup = buildTransparentCustomCodeMarkup('<div onclick="alert(1)">Ring</div>', 'body { background: transparent; }');
    expect(markup).toContain('#aether-custom-code-root { background: transparent; }');
    expect(markup).toContain('id="aether-custom-code-content"');
    expect(markup).toContain('min-height:0!important');
    expect(markup).toContain('data-aether-effect="outline"');
    expect(markup).toContain(':active{filter:brightness(.9) saturate(1.08);opacity:.92;}');
    expect(markup).not.toContain('onclick=');
  });

  it('uses the resized host as the custom-code viewport without overriding authored body layout', () => {
    const markup = buildTransparentCustomCodeMarkup('<svg viewBox="0 0 800 500"><rect width="800" height="500" /></svg>', 'svg { width: 100%; height: 100%; }');
    expect(markup).toContain('#aether-custom-code-content{display:contents!important;}');
    expect(markup).toContain('#aether-custom-code-root{position:relative!important;width:100%!important;height:100%!important;');
    expect(markup).not.toContain('display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;transform:none!important;');
    expect(markup).not.toContain('transform:scale(');
  });

  it('preserves inline handlers as sandboxed bindings for legacy chart markup', () => {
    const markup = buildTransparentCustomCodeMarkup('<button onclick="addData()">+ Add</button><input oninput="updateChart()">', '');
    expect(markup).toContain('data-aether-inline-event-click="addData()"');
    expect(markup).toContain('data-aether-inline-event-input="updateChart()"');
    expect(markup).not.toContain('onclick=');
    expect(markup).not.toContain('oninput=');
  });

  it('tolerates legacy plugins with omitted HTML or CSS panes', () => {
    expect(buildTransparentCustomCodeMarkup(undefined as unknown as string, undefined as unknown as string)).toContain('aether-custom-code-root');
  });

  it('normalizes a complete HTML document before mounting it in Shadow DOM', () => {
    const markup = buildTransparentCustomCodeMarkup('<!doctype html><html><head><style>.bad{display:none}</style></head><body><div class="ok">Visible</div><script>throw new Error()</script></body></html>', '.ok{color:red}');
    expect(markup).toContain('<div class="ok" data-aether-text-layer="true">Visible</div>');
    expect(markup).not.toContain('<html');
    expect(markup).not.toContain('<script');
  });

  it('splits a pasted HTML document into editor panes', () => {
    const result = splitCustomCodeDocument('<!doctype html><html><head><style>.a{color:red}</style></head><body><div class="a">A</div><script>console.log("ok")</script></body></html>');
    expect(result.html).toBe('<div class="a">A</div>');
    expect(result.css).toContain('.a{color:red}');
    expect(result.js).toContain('console.log');
  });

  it('persists an SVG viewBox ratio in custom-code preview metadata', () => {
    const plugin = createCustomCodePlugin('pyramid', '', '<svg viewBox="0 0 800 500"></svg>', '', '', { status: 'passed', errors: [], warnings: [] });
    expect(plugin.preview).toMatchObject({ width: 800, height: 500, background: 'transparent' });
  });

  it('merges every style, script, and body when multiple complete documents are pasted', () => {
    const source = [
      '<!doctype html><html><head><style>.a{color:red}</style></head><body><div class="a">A</div><script>window.a = 1</script></body></html>',
      '<!doctype html><html><head><style>.b{color:blue}</style></head><body><div class="b">B</div><script>window.b = 2</script></body></html>',
    ].join('\n');
    const result = splitCustomCodeDocument(source);
    expect(result.html).toContain('<div class="a">A</div>');
    expect(result.html).toContain('<div class="b">B</div>');
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('<style');
    expect(result.css).toContain('.a{color:red}');
    expect(result.css).toContain('.b{color:blue}');
    expect(result.js).toContain('window.a = 1');
    expect(result.js).toContain('window.b = 2');
  });

  it('normalizes complete HTML documents inside fenced blocks', () => {
    const result = splitCustomCodeDocument('```html\n<!doctype html><html><head><style>.card{color:red}</style></head><body><div class="card">Card</div><script>render()</script></body></html>\n```');
    expect(result.html).toBe('<div class="card">Card</div>');
    expect(result.css).toContain('.card{color:red}');
    expect(result.js).toContain('render()');
    expect(result.html).not.toContain('<script');
  });

  it('does not retain head metadata that turns a dynamic SVG dashboard into title text', () => {
    const source = '<!doctype html><html><head><meta charset="UTF-8"><title>Dashboard</title><style>.chart{color:#0ff}</style></head><body><svg><g id="gridLines"></g><g id="circleGroup"></g></svg><script>document.getElementById("circleGroup")</script></body></html>';
    const result = splitCustomCodeDocument(source);
    const markup = buildTransparentCustomCodeMarkup(result.html, result.css);
    expect(result.html).toContain('id="circleGroup"');
    expect(result.html).not.toContain('<title>');
    expect(result.html).not.toContain('<meta');
    expect(markup).toContain('id="circleGroup"');
    expect(markup).not.toContain('<title>');
    expect(markup).not.toContain('<meta');
  });

  it('splits Markdown fenced code blocks', () => {
    const result = splitCustomCodeDocument('```html\n<div>card</div>\n```\n```css\ndiv{color:red}\n```\n```js\nconsole.log("ready")\n```');
    expect(result.html).toContain('<div>card</div>');
    expect(result.css).toContain('color:red');
    expect(result.js).toContain('ready');
  });

  it('parses browser stack locations from runtime errors', () => {
    expect(parseRuntimeStackLocation('Error: failed\n    at render (plugin.js:18:7)')).toEqual({ line: 18, column: 7 });
    expect(parseRuntimeStackLocation('render@plugin.js:21:4')).toEqual({ line: 21, column: 4 });
  });

  it('normalizes runtime errors and keeps console notices non-blocking', () => {
    const error = new Error('chart failed');
    const parsedError = parseRuntimeDiagnostic(error, { category: 'runtime-error', blocking: true });
    expect(parsedError.message).toBe('chart failed');
    expect(parsedError.blocking).toBe(true);
    expect(parsedError.source).toBe('sandbox');
    expect(parsedError.stack).toContain('chart failed');

    const notice = parseRuntimeDiagnostic({ message: 'deprecated API', line: 6, column: 2 }, {
      category: 'console',
      blocking: false,
      level: 'warning',
    });
    expect(notice).toMatchObject({ message: 'deprecated API', line: 6, column: 2, blocking: false, category: 'console' });
    expect(formatRuntimeDiagnosticMessage(notice)).toContain('第 6 行，第 2 列');
  });

  it('emits runtime diagnostic hooks in both sandbox renderers', () => {
    const srcDoc = buildCustomCodeSrcDoc({ html: '<div>Ready</div>', css: '', js: 'console.warn("notice");', preview: { mode: 'responsive', background: 'transparent' } }, 'diagnostic-instance');
    expect(srcDoc).toContain("send('diagnostic'");
    expect(srcDoc).toContain("send('unhandledrejection'");
    expect(srcDoc).toContain('window.console = scopedConsole');
  });
});
