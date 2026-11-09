import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Code2, Copy, Download, Loader2, Ruler, X } from 'lucide-react';
import type { ProjectData, Scene, SceneElement } from '../types';
import {
  buildHandoffHTML,
  buildHandoffSpec,
  buildSceneHandoffSpecs,
  type HandoffCanvas,
  type HandoffSpec,
} from '../utils/handoff';

interface HandoffPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  scene: Scene | null;
  selectedElement: SceneElement | null;
  canvas: HandoffCanvas;
  multiSelectedCount?: number;
  onCaptureStage?: () => Promise<string | null>;
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // LAN/HTTP contexts may not expose the async clipboard API.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
};

const sanitizeFileName = (value: string): string => value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '标注';

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-1 text-[10px] last:border-b-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-slate-200">{value}</span>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
    <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
    {children}
  </section>
);

const Metric: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`rounded-lg border px-2 py-1.5 ${accent ? 'border-pink-400/25 bg-pink-400/10' : 'border-white/10 bg-black/25'}`}>
    <div className="text-[8px] text-slate-500">{label}</div>
    <div className={`mt-0.5 font-mono text-[12px] font-bold ${accent ? 'text-pink-200' : 'text-slate-100'}`}>{value}</div>
  </div>
);

const HandoffPanel: React.FC<HandoffPanelProps> = ({
  isOpen,
  onClose,
  project,
  scene,
  selectedElement,
  canvas,
  multiSelectedCount = 0,
  onCaptureStage,
}) => {
  const [copied, setCopied] = useState<'css' | 'json' | null>(null);
  const [copyError, setCopyError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [exportError, setExportError] = useState('');

  const spec = useMemo<HandoffSpec | null>(() => (
    scene && selectedElement ? buildHandoffSpec(selectedElement, scene, canvas) : null
  ), [canvas.height, canvas.width, scene, selectedElement]);

  const sceneSpecs = useMemo<HandoffSpec[]>(() => (
    scene ? buildSceneHandoffSpecs(scene, canvas) : []
  ), [canvas.height, canvas.width, scene]);

  useEffect(() => {
    setCopied(null);
    setCopyError('');
    setExportNote('');
    setExportError('');
  }, [selectedElement?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(null);
    setCopyError('');
    setExportNote('');
    setExportError('');
  }, [isOpen]);

  const handleCopy = useCallback(async (text: string, kind: 'css' | 'json') => {
    setCopyError('');
    const ok = await copyText(text);
    if (!ok) {
      setCopyError('复制失败，请手动选中文本复制。');
      return;
    }
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }, []);

  const handleExport = useCallback(async () => {
    if (!scene || exporting) return;
    setExporting(true);
    setExportNote('');
    setExportError('');
    let screenshotDataUrl: string | null = null;
    try {
      screenshotDataUrl = onCaptureStage ? await onCaptureStage() : null;
    } catch {
      screenshotDataUrl = null;
    }
    try {
      const html = buildHandoffHTML({
        projectTitle: project.meta?.title || '鲸动交互平台工程',
        scene,
        canvas,
        specs: sceneSpecs,
        selectedId: selectedElement?.id || null,
        screenshotDataUrl,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${sanitizeFileName(project.meta?.title || '鲸动交互平台')}_${sanitizeFileName(scene.alias || scene.id)}_交付标注.html`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setExportNote(screenshotDataUrl ? '已导出标注页（含画布截图）。' : '已导出标注页（截图不可用，已保留坐标与样式）。');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出标注页失败，请重试。');
    } finally {
      setExporting(false);
    }
  }, [canvas, exporting, onCaptureStage, project.meta?.title, scene, sceneSpecs, selectedElement?.id]);

  if (!isOpen) return null;

  const panel = (
    <div
      role="dialog"
      aria-label="交付标注"
      className="fixed right-3 top-[88px] z-[9000] flex max-h-[calc(100vh-110px)] w-[380px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-pink-400/25 bg-[#0d121c] text-slate-200 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-pink-400/25 bg-pink-400/10 text-pink-300">
            <Ruler size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">交付标注</h2>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">选中图层查看尺寸、间距与样式</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="关闭交付标注"
        >
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="truncate text-slate-300">{scene?.alias || '当前场景'}</span>
            <span className="shrink-0 font-mono text-[9px] text-slate-500">{canvas.width} × {canvas.height}</span>
          </div>
          <div className="mt-1 text-[9px] text-slate-500">粉色尺寸线已叠加在画布上；所有数值按画布像素换算。</div>
        </div>

        {!spec ? (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center">
            <Ruler size={24} className="mx-auto text-slate-600" />
            <p className="mt-2 text-[11px] text-slate-300">
              {multiSelectedCount > 1 ? `当前选中 ${multiSelectedCount} 个图层` : '还没有选中图层'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              {multiSelectedCount > 1
                ? '交付标注一次只看一个图层，请单独点选其中一个。'
                : '在画布或图层面板点选一个图层，这里会显示它的尺寸、间距、颜色、字体和 CSS。'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-pink-400/20 bg-pink-400/[0.06] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12px] font-bold text-white">{spec.name}</span>
                <span className="shrink-0 rounded-full border border-pink-400/25 bg-pink-400/10 px-1.5 py-0.5 text-[8px] text-pink-200">{spec.typeLabel}</span>
              </div>
              <div className="mt-1 truncate font-mono text-[9px] text-slate-500">{spec.id}</div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Metric label="X 坐标" value={`${spec.layout.x} px`} />
              <Metric label="Y 坐标" value={`${spec.layout.y} px`} />
              <Metric label="宽度" value={`${spec.layout.w} px`} accent />
              <Metric label="高度" value={`${spec.layout.h} px`} accent />
            </div>

            {Math.abs(spec.layout.rotation) >= 0.05 && (
              <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1.5 text-[9px] leading-relaxed text-amber-200/80">
                旋转图层的粉色框按外接矩形显示；宽高和 X/Y 仍是图层自身数值。
              </p>
            )}

            <Section title="间距">
              <Row label="到左 / 上边缘" value={`${spec.spacing.left} / ${spec.spacing.top} px`} />
              <Row label="到右 / 下边缘" value={`${spec.spacing.right} / ${spec.spacing.bottom} px`} />
              {spec.neighbors.map((neighbor) => (
                <Row
                  key={`${neighbor.direction}-${neighbor.elementId}`}
                  label={`距${neighbor.direction === 'left' ? '左' : neighbor.direction === 'top' ? '上' : neighbor.direction === 'right' ? '右' : '下'}侧图层`}
                  value={`${neighbor.gap} px · ${neighbor.name}`}
                />
              ))}
            </Section>

            <Section title="布局">
              <Row label="旋转" value={`${spec.layout.rotation}°`} />
              <Row label="不透明度" value={`${spec.layout.opacity}%`} />
              <Row label="层级" value={spec.layout.zIndex} />
              <Row label="开始 / 时长" value={`${spec.timing.startTime}s / ${spec.timing.duration}s`} />
              <Row label="入场 / 出场" value={[spec.timing.inAnimation, spec.timing.outAnimation].filter(Boolean).join(' → ')} />
            </Section>

            <Section title="外观">
              <Row label="背景" value={spec.appearance.background} />
              <Row label="描边" value={spec.appearance.border} />
              <Row label="圆角" value={spec.appearance.radius !== undefined ? `${spec.appearance.radius} px` : undefined} />
              <Row label="阴影" value={spec.appearance.shadow} />
              <Row label="混合模式" value={spec.appearance.blendMode} />
              <Row label="背景模糊" value={spec.appearance.backdropBlur ? `${spec.appearance.backdropBlur} px` : undefined} />
              <Row label="形状" value={spec.appearance.shapeKind} />
            </Section>

            {spec.typography && (
              <Section title="文字">
                <Row label="字体" value={spec.typography.fontFamily} />
                <Row label="字号 / 字重" value={`${spec.typography.fontSize} px / ${spec.typography.fontWeight}`} />
                <Row label="行高 / 字间距" value={`${spec.typography.lineHeight} / ${spec.typography.letterSpacing} px`} />
                <Row label="颜色" value={spec.typography.color} />
                <Row label="对齐" value={`${spec.typography.align} / ${spec.typography.verticalAlign}`} />
                <Row label="内容" value={spec.typography.content} />
              </Section>
            )}

            {spec.asset && (
              <Section title="素材">
                <Row label="素材名" value={spec.asset.sourceName} />
                <Row label="素材 ID" value={spec.asset.refId} />
                <Row label="原始宽高比" value={spec.asset.mediaAspect ? String(spec.asset.mediaAspect) : undefined} />
              </Section>
            )}

            {spec.component && (
              <Section title="组件">
                <Row label="母版 ID" value={spec.component.masterId} />
                <Row label="变体 ID" value={spec.component.variantId} />
                <Row label="覆盖字段" value={spec.component.overrides.join(', ')} />
              </Section>
            )}

            {spec.interaction && (
              <Section title="交互">
                <Row label="触发" value={spec.interaction.trigger} />
                <Row label="动作" value={spec.interaction.action} />
                <Row label="目标" value={spec.interaction.target} />
                <Row label="URL" value={spec.interaction.url} />
              </Section>
            )}

            <section className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">CSS</h3>
                <button
                  type="button"
                  onClick={() => handleCopy(spec.css, 'css')}
                  className="flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-white/10"
                >
                  {copied === 'css' ? <Check size={10} /> : <Copy size={10} />}
                  {copied === 'css' ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#080b12] p-2 font-mono text-[9px] leading-relaxed text-slate-300">{spec.css}</pre>
            </section>

            {copyError && <p className="text-[10px] text-red-300" role="alert">{copyError}</p>}
          </>
        )}
      </div>

      <footer className="space-y-2 border-t border-white/10 px-3 py-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={!spec}
            onClick={() => spec && handleCopy(JSON.stringify(spec, null, 2), 'json')}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied === 'json' ? <Check size={11} /> : <Code2 size={11} />}
            {copied === 'json' ? '已复制 JSON' : '复制 JSON'}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!scene || exporting}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-pink-400/30 bg-pink-400/10 px-2 py-1.5 text-[10px] font-semibold text-pink-100 hover:bg-pink-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            {exporting ? '正在导出…' : '导出场景标注'}
          </button>
        </div>
        {exportNote && <p className="text-[9px] text-emerald-300">{exportNote}</p>}
        {exportError && <p className="text-[9px] text-red-300" role="alert">{exportError}</p>}
        <p className="text-center text-[9px] text-slate-600">标注页包含画布截图、图层边框和完整 CSS，可直接发给开发。</p>
      </footer>
    </div>
  );

  return createPortal(panel, document.body);
};

export default HandoffPanel;
