import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Code2, Copy, Eye, History, Play, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { CustomCodeLibraryItem, CustomCodePlugin } from '../types';
import {
  buildCustomCodeSrcDoc,
  createCustomCodePlugin,
  inspectCustomCode,
  splitCustomCodeDocument,
} from '../utils/customCode';
import { formatRuntimeDiagnosticMessage, parseRuntimeDiagnostic, type CustomCodeRuntimeDiagnostic } from '../utils/customCodeRuntimeDiagnostics';
import { TransparentCustomCodeFrame } from './TransparentCustomCodeFrame';

interface CustomCodePluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (plugin: CustomCodePlugin) => void;
  embedded?: boolean;
  initialPlugin?: CustomCodePlugin;
  historyItems?: CustomCodeLibraryItem[];
  onInsertHistory?: (plugin: CustomCodePlugin) => void;
  onDeleteHistory?: (itemId: string) => void;
}

type EditorTab = 'html' | 'css' | 'js';

const EMPTY_CODE = {
  name: '自定义代码组件',
  description: '',
  html: '<div class="plugin-card">在这里预览你的组件</div>',
  css: '.plugin-card {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-height: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 24px;\n  color: #e2e8f0;\n  background: linear-gradient(135deg, #0f172a, #164e63);\n  border: 1px solid rgba(103, 232, 249, .35);\n  border-radius: 14px;\n  font: 600 18px/1.4 system-ui, sans-serif;\n}',
  js: '',
};

const editorLabels: Record<EditorTab, string> = { html: 'HTML', css: 'CSS', js: 'JavaScript' };

const getCustomCodePreviewAspect = (plugin?: Pick<CustomCodePlugin, 'preview'> & Partial<Pick<CustomCodePlugin, 'css' | 'html'>>) => {
  const width = Number(plugin?.preview?.width);
  const height = Number(plugin?.preview?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return `${width} / ${height}`;
  const cssAspect = plugin?.css?.match(/aspect-ratio\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/i);
  if (cssAspect) return `${cssAspect[1]} / ${cssAspect[2]}`;
  const viewBox = plugin?.html?.match(/viewBox\s*=\s*["'][^"']*\s+[^"']*\s+([\d.]+)\s+([\d.]+)["']/i);
  if (viewBox) return `${viewBox[1]} / ${viewBox[2]}`;
  return '16 / 9';
};

const getPreviewMetadata = (html: string, css: string, existing?: CustomCodePlugin['preview']): CustomCodePlugin['preview'] => {
  const aspect = getCustomCodePreviewAspect({ preview: existing || { mode: 'responsive', background: 'transparent' }, html, css });
  const [width, height] = aspect.split('/').map((value) => Number(value.trim()));
  return {
    ...(existing || { mode: 'responsive', background: 'transparent' }),
    ...(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : {}),
  };
};

const CUSTOM_CODE_AI_SAFETY_REQUIREMENTS = `

10. Security restrictions: do not use fetch, XMLHttpRequest, WebSocket, Worker, localStorage, sessionStorage, indexedDB, window.open, window.parent, navigator.geolocation, navigator.mediaDevices, or external URLs. Clipboard reads are forbidden; a button may only call navigator.clipboard.writeText(...) directly from its click handler. Use only component-scoped DOM, CSS, SVG, and ordinary JavaScript.`;

const AI_COMPONENT_PROMPT = `请生成一个可直接嵌入网页的 UI 组件，并严格遵守以下要求：

1. 全文字可编辑：所有可见文字必须加 contenteditable="true"；悬停时提供可见提示（虚线下划线或背景变色）；全局监听 keydown，Enter 时必须 preventDefault() 并 blur()，禁止换行。
2. 禁用 Canvas 图表库：禁止 ECharts、Chart.js 等图表库；仅使用原生 HTML、CSS、SVG 和原生 JavaScript。
3. 图表数据联动：每个数据点必须显示可见数字；修改数字时实时重新计算并更新 SVG 形状，例如 path、rect、stroke-dashoffset。
4. 进度条联动：顶部数字必须实时驱动环形进度条的 stroke-dashoffset，并同步更新百分比文字。
5. UI 布局：使用 CSS Grid 或 Flex 弹性布局；容器必须完全自适应（根容器必须设置 width: 100%; height: 100%; box-sizing: border-box;，保证随画布控制框自由拉伸自适应）；精确提取设计配色；具备圆角、阴影与悬浮上浮反馈；坐标轴数值必须预留间距，不得重叠。
6. 图表实现规范：折线图使用 path、circle 和渐变面积；柱状图使用 rect；环形图使用 circle 配合 stroke-dasharray / stroke-dashoffset；仪表盘使用 path 弧线。
7. JS 逻辑：提供 getNumber() 剥离非数字；监听 oninput，并调用统一渲染函数重绘全部联动数据。
8. 输出格式：提供完整、可直接运行的 index.html，不省略代码；关键数据联动必须写中文注释。
9. 还原要求：按设计图 100% 像素级复刻；不遗漏任何可编辑文字；所有数字和百分比数据均可修改。
10. 参数化控制规范（供右侧属性面板智能识别）：
在 JS 或 CSS 开头使用行内注释声明可由属性面板调节的交互参数（例如速度、颜色、开关、数值）：
// @control slider key=speed label="动效速度" min=0.1 max=5 step=0.1 default=1 unit="x"
// @control color key=themeColor label="主题色" default="#38bdf8"
// @control toggle key=enableGlow label="开启光效" default=true
在样式中通过 var(--aether-themeColor) 或在 JS 中通过 window.aetherProps.speed / window.addEventListener('aether:props', ...) 实现 60FPS 实时响应。`;

export const CustomCodePluginModal: React.FC<CustomCodePluginModalProps> = ({ isOpen, onClose, onExport, embedded = false, initialPlugin, historyItems = [], onInsertHistory, onDeleteHistory }) => {
  const [tab, setTab] = useState<EditorTab>('html');
  const [name, setName] = useState(EMPTY_CODE.name);
  const [description, setDescription] = useState(EMPTY_CODE.description);
  const [html, setHtml] = useState(EMPTY_CODE.html);
  const [css, setCss] = useState(EMPTY_CODE.css);
  const [js, setJs] = useState(EMPTY_CODE.js);
  const [srcDoc, setSrcDoc] = useState('');
  const [diagnostics, setDiagnostics] = useState(() => ({ errors: [], warnings: [] }));
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<CustomCodeRuntimeDiagnostic[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [lastRunSignature, setLastRunSignature] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab('html');
    setName(initialPlugin?.name || EMPTY_CODE.name);
    setDescription(initialPlugin?.description || '');
    setHtml(initialPlugin?.html || EMPTY_CODE.html);
    setCss(initialPlugin?.css || EMPTY_CODE.css);
    setJs(initialPlugin?.js || EMPTY_CODE.js);
    setSrcDoc('');
    setDiagnostics(initialPlugin?.diagnostics ? { errors: initialPlugin.diagnostics.errors, warnings: initialPlugin.diagnostics.warnings } : { errors: [], warnings: [] });
    setRuntimeDiagnostics([]);
    setHasRun(false);
    setLastRunSignature('');
    setPromptCopied(false);
    setPromptExpanded(false);
    setHistoryOpen(false);
    setSelectedHistoryId(historyItems.at(-1)?.id || null);
  }, [initialPlugin, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'aether-custom-code') return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data.type === 'error') {
        const diagnostic = parseRuntimeDiagnostic(event.data, {
          category: 'runtime-error',
          blocking: true,
        });
        setRuntimeDiagnostics((current) => [...current, diagnostic].slice(-8));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  const code = useMemo(() => ({ html, css, js }), [html, css, js]);
  const codeSignature = `${name}\u001f${description}\u001f${html}\u001f${css}\u001f${js}`;
  const runtimeErrors = runtimeDiagnostics.filter((item) => item.blocking);
  const runtimeNotices = runtimeDiagnostics.filter((item) => !item.blocking);
  const allErrors = [...diagnostics.errors, ...runtimeErrors];
  const allWarnings = [...diagnostics.warnings, ...runtimeNotices];
  const historyEntries = useMemo(() => historyItems.slice().reverse(), [historyItems]);
  const selectedHistoryItem = historyItems.find((item) => item.id === selectedHistoryId) || historyEntries[0];
  const diagnosticSourceLabels: Record<string, string> = { html: 'HTML', css: 'CSS', js: 'JavaScript', sandbox: '预览运行时', performance: '性能检查' };
  const diagnosticLocation = (item: { line?: number; column?: number }) => item.line ? ` · 第 ${item.line} 行${item.column ? `，第 ${item.column} 列` : ''}` : '';

  if (!isOpen) return null;

  const updateCode = (value: string) => {
    if (tab === 'html') setHtml(value);
    if (tab === 'css') setCss(value);
    if (tab === 'js') setJs(value);
  };

  const applyParsedDocument = (value: string) => {
    const parsed = splitCustomCodeDocument(value);
    const isDocument = /<(?:html|head|body|style|script)\b/i.test(value) || /```(?:html?|css|javascript|js)?/i.test(value);
    if (!isDocument) return false;
    setHtml(parsed.html || EMPTY_CODE.html);
    setCss(parsed.css);
    setJs(parsed.js);
    setTab(parsed.js ? 'js' : parsed.css ? 'css' : 'html');
    return true;
  };

  const parseDocument = () => {
    const parsed = splitCustomCodeDocument(html);
    if (parsed.html !== html || parsed.css || parsed.js) {
      setHtml(parsed.html || EMPTY_CODE.html);
      setCss(parsed.css);
      setJs(parsed.js);
      setTab(parsed.js ? 'js' : parsed.css ? 'css' : 'html');
    }
  };

  const handleCodePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (tab !== 'html') return;
    const pasted = event.clipboardData.getData('text/plain');
    if (!pasted || !/(?:<(?:html|head|body|style|script)\b|```(?:html?|css|javascript|js)?)/i.test(pasted)) return;
    event.preventDefault();
    applyParsedDocument(pasted);
  };

  const getValidatedCode = () => {
    const isDocument = /<(?:html|head|body|style|script)\b/i.test(html) || /```(?:html?|css|javascript|js)?/i.test(html);
    if (!isDocument) return { html, css, js };
    const parsed = splitCustomCodeDocument(html);
    const next = { html: parsed.html, css: parsed.css || css, js: parsed.js || js };
    setHtml(next.html || EMPTY_CODE.html);
    setCss(next.css);
    setJs(next.js);
    setTab(next.js ? 'js' : next.css ? 'css' : 'html');
    return { ...next, html: next.html || EMPTY_CODE.html };
  };

  const runPreview = () => {
    const normalized = getValidatedCode();
    const nextDiagnostics = inspectCustomCode(normalized.html, normalized.css, normalized.js);
    setDiagnostics(nextDiagnostics);
    setRuntimeDiagnostics([]);
    setHasRun(true);
    setLastRunSignature(codeSignature);
    if (nextDiagnostics.errors.length === 0) {
      const previewPlugin = createCustomCodePlugin(name, description, normalized.html, normalized.css, normalized.js, {
        status: nextDiagnostics.warnings.length ? 'warning' : 'passed',
        ...nextDiagnostics,
        checkedAt: new Date().toISOString(),
      });
      setSrcDoc(buildCustomCodeSrcDoc(previewPlugin, `modal-${Date.now()}`, 'transparent'));
    } else {
      setSrcDoc('');
    }
  };

  const exportPlugin = () => {
    const normalized = getValidatedCode();
    const nextDiagnostics = inspectCustomCode(normalized.html, normalized.css, normalized.js);
    setDiagnostics(nextDiagnostics);
    setHasRun(true);
    setLastRunSignature(codeSignature);
    if (nextDiagnostics.errors.length || runtimeErrors.length) {
      if (!nextDiagnostics.errors.length) {
        const previewPlugin = createCustomCodePlugin(name, description, normalized.html, normalized.css, normalized.js, {
          status: nextDiagnostics.warnings.length ? 'warning' : 'passed',
          ...nextDiagnostics,
          checkedAt: new Date().toISOString(),
        });
        setSrcDoc(buildCustomCodeSrcDoc(previewPlugin, `modal-${Date.now()}`, 'transparent'));
      }
      setHasRun(true);
      return;
    }
    const previewPlugin = createCustomCodePlugin(name, description, normalized.html, normalized.css, normalized.js, {
      status: nextDiagnostics.warnings.length ? 'warning' : 'passed',
      ...nextDiagnostics,
      checkedAt: new Date().toISOString(),
    });
    setSrcDoc(buildCustomCodeSrcDoc(previewPlugin, `modal-${Date.now()}`, 'transparent'));
    const previewWithMetadata = { ...previewPlugin, preview: getPreviewMetadata(normalized.html, normalized.css, previewPlugin.preview) };
    onExport(initialPlugin ? {
      ...previewWithMetadata,
      id: initialPlugin.id,
      version: initialPlugin.version + 1,
      createdAt: initialPlugin.createdAt,
    } : previewWithMetadata);
  };

  const copyAiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(`${AI_COMPONENT_PROMPT}${CUSTOM_CODE_AI_SAFETY_REQUIREMENTS}`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = `${AI_COMPONENT_PROMPT}${CUSTOM_CODE_AI_SAFETY_REQUIREMENTS}`;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1800);
  };

  return (
    <div className={embedded ? 'flex h-full min-h-0 w-full items-center justify-center' : 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm'} role="presentation" onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>
      <div className={embedded ? 'relative flex h-full w-full min-w-0 flex-col overflow-hidden' : 'relative flex h-[min(820px,calc(100vh-32px))] w-[min(1160px,calc(100vw-32px))] min-w-0 flex-col overflow-hidden rounded-xl border border-cyan-400/20 bg-[#0c1119] shadow-2xl'} role="dialog" aria-modal="true" aria-label={embedded ? '自定义代码工作区' : undefined} aria-labelledby={embedded ? undefined : 'custom-code-title'}>
        <div className={embedded ? 'flex h-10 shrink-0 items-center justify-end px-1' : 'flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#101722] px-4'}>
          {!embedded && <div className="flex items-center gap-2"><Code2 size={16} className="text-cyan-300" /><h2 id="custom-code-title" className="text-sm font-semibold text-white">自定义代码插件</h2><span className="text-[10px] text-slate-500">AI 生成 · 预览 · 导出复用</span></div>}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setHistoryOpen((current) => !current)} className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${historyOpen ? 'border-cyan-300/45 bg-cyan-300/15 text-cyan-100' : 'border-white/10 text-slate-300 hover:border-cyan-300/30 hover:bg-white/5'}`} aria-label="打开历史组件">
              <History size={14} />历史组件{historyItems.length ? ` ${historyItems.length}` : ''}
            </button>
            {!embedded && <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="关闭"><X size={16} /></button>}
          </div>
        </div>
        <section className="shrink-0 border-b border-cyan-300/10 bg-[#0d1722] px-4 py-3" aria-label="使用引导">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-200"><Sparkles size={14} /></div>
              <ol className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
                <li className="flex items-center gap-1.5 whitespace-nowrap"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-300 text-[9px] font-bold text-slate-950">1</span>用任意 AI 生成</li>
                <li className="h-px w-5 bg-white/15" aria-hidden="true" />
                <li className="flex items-center gap-1.5 whitespace-nowrap"><span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[9px] text-slate-300">2</span>粘贴完整代码</li>
                <li className="h-px w-5 bg-white/15" aria-hidden="true" />
                <li className="flex items-center gap-1.5 whitespace-nowrap"><span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[9px] text-slate-300">3</span>预览后导出到组件库</li>
              </ol>
            </div>
            <button type="button" onClick={copyAiPrompt} className="flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-300/20" aria-label="复制 AI 生成提示词">
              {promptCopied ? <Check size={13} /> : <Copy size={13} />}{promptCopied ? '已复制提示词' : '复制 AI 提示词'}
            </button>
          </div>
          <div className="mt-2.5 rounded-md border border-white/8 bg-black/20">
            <button
              type="button"
              onClick={() => setPromptExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-2.5 py-2 text-left text-[10px] transition hover:bg-white/[.03]"
              aria-expanded={promptExpanded}
              aria-controls="ai-component-requirements"
            >
              <span className="font-semibold text-cyan-200">给 AI 的要求</span>
              <span className="flex shrink-0 items-center gap-1 text-slate-400">{promptExpanded ? '收起' : '展开完整规范'}{promptExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
            </button>
            {promptExpanded && (
              <ol id="ai-component-requirements" className="grid gap-1.5 border-t border-white/8 px-3 py-2.5 text-[10px] leading-4 text-slate-400 sm:grid-cols-2">
                <li><strong className="text-slate-200">全文字可编辑：</strong>所有可见文字必须使用 <code>contenteditable=&quot;true&quot;</code>；悬停有提示；回车禁止换行并失焦。</li>
                <li><strong className="text-slate-200">禁用 Canvas 图表库：</strong>禁止 ECharts、Chart.js 等；仅用原生 HTML、CSS、SVG。</li>
                <li><strong className="text-slate-200">图表数据联动：</strong>数据点必须显示数字；修改数字时实时重算 SVG 形状。</li>
                <li><strong className="text-slate-200">进度条联动：</strong>顶部数字驱动环形进度条 <code>stroke-dashoffset</code>，同步更新百分比。</li>
                <li><strong className="text-slate-200">UI 布局：</strong>使用 CSS Grid、精确配色、圆角阴影与悬浮反馈；坐标轴数值留间距且不重叠。</li>
                <li><strong className="text-slate-200">图表规范：</strong>折线图用 <code>path</code>、<code>circle</code>、渐变面积；柱状图用 <code>rect</code>；环形图用 <code>circle</code>；仪表盘用弧线路径。</li>
                <li><strong className="text-slate-200">JS 逻辑：</strong>提供 <code>getNumber()</code>；监听 <code>oninput</code>，调用统一渲染函数重绘。</li>
                <li><strong className="text-slate-200">键盘交互：</strong>全局监听 <code>keydown</code>；按 Enter 时执行 <code>preventDefault()</code> 和 <code>blur()</code>。</li>
                <li><strong className="text-slate-200">输出格式：</strong>提供完整可运行的 <code>index.html</code>，关键数据联动写中文注释。</li>
                <li><strong className="text-slate-200">还原要求：</strong>按设计图 100% 像素级复刻，不遗漏任何可编辑文字，所有数字和百分比数据均可修改。</li>
              </ol>
            )}
          </div>
        </section>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <section className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-[1fr_1.4fr] gap-2 border-b border-white/10 p-3">
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} className="rounded border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400" placeholder="插件名称" aria-label="插件名称" />
              <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} className="rounded border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400" placeholder="描述（可选）" aria-label="插件描述" />
            </div>
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div className="flex gap-1">{(['html', 'css', 'js'] as EditorTab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded px-2.5 py-1 text-[10px] font-semibold ${tab === item ? 'bg-cyan-400/20 text-cyan-200' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>{editorLabels[item]}</button>)}</div>
              <button type="button" onClick={parseDocument} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:border-cyan-400/40 hover:text-cyan-200"><Upload size={11} />解析完整代码</button>
            </div>
            <textarea value={code[tab]} onChange={(event) => updateCode(event.target.value)} onPaste={handleCodePaste} spellCheck={false} className="min-h-0 flex-1 resize-none bg-[#080c12] p-4 font-mono text-[12px] leading-5 text-slate-200 outline-none" aria-label={`${editorLabels[tab]}代码`} />
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300"><ShieldCheck size={13} />运行在隔离 iframe 中</div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <span className="text-[10px] text-slate-500">导出后保存到本地插件库，并直接插入当前时间线</span>
                <button type="button" onClick={runPreview} className="flex items-center gap-1.5 rounded-md border border-cyan-400/35 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20"><Play size={13} />预览组件</button>
                <button type="button" onClick={exportPlugin} className="flex items-center gap-1.5 rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300"><Upload size={13} />导出</button>
              </div>
            </div>
          </section>
          <section className="flex min-h-0 flex-col bg-[#0a0f16]">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-3 text-[11px] font-semibold text-slate-300"><Eye size={14} className="text-cyan-300" />预览</div>
            <div className="min-h-0 flex-1 overflow-auto p-4"><div className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-transparent" style={{ aspectRatio: getCustomCodePreviewAspect({ preview: initialPlugin?.preview || { mode: 'responsive', background: 'transparent' }, html, css }) }}>{srcDoc ? <TransparentCustomCodeFrame html={html} css={css} js={js} interactive textEditing fitContent className="absolute inset-0 h-full w-full" onRuntimeDiagnostic={(diagnostic) => setRuntimeDiagnostics((current) => [...current, diagnostic].slice(-8))} /> : <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">点击“预览组件”查看效果</div>}</div></div>
            {hasRun && <div className="max-h-52 shrink-0 overflow-auto border-t border-white/10 px-4 py-3 text-[10px]" role="status">{allErrors.length === 0 && allWarnings.length === 0 ? <div className="text-emerald-300">检查通过，可以加入时间线。</div> : allErrors.map((item, index) => <div key={`error-${item.source}-${index}`} className="mb-1 rounded border border-rose-400/10 bg-rose-400/[.04] px-2 py-1.5 leading-4 text-rose-300"><strong className="font-semibold">{diagnosticSourceLabels[item.source] || item.source}{diagnosticLocation(item)}：</strong><span>{item.message}</span>{item.stack && <details className="mt-1 text-rose-200/70"><summary className="cursor-pointer">查看调用堆栈</summary><pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[9px]">{item.stack}</pre></details>}</div>)}{allErrors.length === 0 && allWarnings.map((item, index) => <div key={`warning-${item.source}-${index}`} className="mb-1 rounded border border-amber-400/10 bg-amber-400/[.04] px-2 py-1.5 leading-4 text-amber-300"><strong className="font-semibold">{item.source === 'performance' ? '性能提示' : '运行提示'}{diagnosticLocation(item)}：</strong><span>{item.message}</span>{item.stack && <details className="mt-1 text-amber-200/70"><summary className="cursor-pointer">查看调用堆栈</summary><pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[9px]">{item.stack}</pre></details>}</div>)}</div>}
            <div className="shrink-0 border-t border-white/10 px-4 py-3 text-[10px] leading-5 text-slate-500">限制：禁止网络请求、外部脚本、存储、设备能力和顶层页面访问。HTML、CSS、JavaScript 各限制 100 KB。</div>
          </section>
        </div>
        {historyOpen && (
          <aside className="absolute inset-y-12 right-0 z-30 flex w-[min(340px,calc(100vw-32px))] flex-col border-l border-cyan-300/20 bg-[#0a1119] shadow-2xl" aria-label="历史组件">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100"><History size={15} className="text-cyan-300" />历史组件 <span className="font-mono text-[10px] text-slate-500">{historyItems.length}</span></div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="flex h-7 w-7 items-center justify-center rounded text-slate-500 transition hover:bg-white/10 hover:text-white" aria-label="关闭历史组件"><X size={14} /></button>
            </div>
            <div className="shrink-0 border-b border-white/10 p-3">
              <div className="relative w-full overflow-hidden rounded-md border border-white/10 bg-transparent" style={{ aspectRatio: getCustomCodePreviewAspect(selectedHistoryItem?.plugin) }}>
                {selectedHistoryItem ? <TransparentCustomCodeFrame html={selectedHistoryItem.plugin.html} css={selectedHistoryItem.plugin.css} js={selectedHistoryItem.plugin.js} interactive fitContent className="absolute inset-0 h-full w-full" /> : <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">暂无历史组件</div>}
              </div>
              {selectedHistoryItem && <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => { onInsertHistory?.(selectedHistoryItem.plugin); onClose(); }} className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-cyan-300/35 bg-cyan-300/10 px-2 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-300/20"><Play size={12} />插入时间线</button>
                <button type="button" onClick={() => { onDeleteHistory?.(selectedHistoryItem.id); setSelectedHistoryId(null); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-400/20 text-rose-300 transition hover:bg-rose-400/10" aria-label={`删除历史组件 ${selectedHistoryItem.plugin.name}`} title="删除历史组件"><Trash2 size={13} /></button>
              </div>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {historyEntries.length ? historyEntries.map((item) => {
                const selected = item.id === selectedHistoryItem?.id;
                return <div key={item.id} className={`mb-1 flex items-center gap-1 rounded-md border p-1 transition ${selected ? 'border-cyan-300/35 bg-cyan-300/10' : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'}`}>
                  <button type="button" onClick={() => setSelectedHistoryId(item.id)} className="min-w-0 flex-1 px-2 py-1.5 text-left" aria-label={`预览历史组件 ${item.plugin.name}`}>
                    <span className="block truncate text-[11px] font-medium text-slate-100">{item.plugin.name}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-slate-500">{item.plugin.description || '自定义代码组件'}</span>
                  </button>
                  <button type="button" onClick={() => { onDeleteHistory?.(item.id); if (selected) setSelectedHistoryId(null); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-300" aria-label={`删除历史组件 ${item.plugin.name}`} title="删除"><Trash2 size={12} /></button>
                </div>;
              }) : <div className="flex h-full min-h-32 items-center justify-center px-6 text-center text-[10px] leading-5 text-slate-500">导出过的自定义代码组件会永久保存在这里，可随时预览、插入或删除。</div>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default CustomCodePluginModal;
