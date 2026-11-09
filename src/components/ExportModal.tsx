import React, { useEffect, useState } from 'react';
import { Download, Package, FileCode, Code, X, Check, Loader2 } from 'lucide-react';
import { ProjectData } from '../types';
import { exportProjectZip, exportSingleFileHTML, getStandaloneExportCompatibilityIssues } from '../utils/export';
import { subscriptionService, type ExportAuthorization } from '../core/auth/subscriptionService';
import { SCHEMA_VERSION } from '../core/schema/version';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  onError?: (message: string) => void;
  onRequestActivation?: () => void;
  /** 免费导出完成后的「免费体验」入口 */
  onRequestFreeExperience?: () => void;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the browser's asynchronous download start.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  projectData,
  onError,
  onRequestActivation,
  onRequestFreeExperience,
}) => {
  const [exportMode, setExportMode] = useState<'zip' | 'single-html' | 'json'>('zip');
  const [isExporting, setIsExporting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [freeQuota, setFreeQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const freeExportLocked = Boolean(freeQuota && freeQuota.remaining <= 0);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    if (!subscriptionService.hasFeature('export_no_watermark')) {
      subscriptionService.getExportQuota()
        .then((quota) => { if (!cancelled) setFreeQuota(quota); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isOpen]);
  const [statusMsg, setStatusMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  // HUD 控制栏配置：默认沿用工程内已选款式（编辑器所见即所得）
  const [hudStyle, setHudStyle] = useState<'default' | 'minimal' | 'tech' | 'hidden'>(projectData.hudConfig?.style || 'default');
  const [showSceneDots, setShowSceneDots] = useState(projectData.hudConfig?.showDots ?? true);
  const [showSceneTitle, setShowSceneTitle] = useState(projectData.hudConfig?.showTitle ?? true);

  useEffect(() => {
    if (!isOpen || isExporting) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (exportMode === 'single-html') {
      const compatibilityIssues = getStandaloneExportCompatibilityIssues(projectData);
      if (compatibilityIssues.length) {
        const preview = compatibilityIssues.slice(0, 3).map((issue) => issue.message).join('\n');
        const remaining = compatibilityIssues.length > 3 ? `\n另有 ${compatibilityIssues.length - 3} 个图层。` : '';
        onError?.(`已中止导出，避免生成与编辑器不一致的文件：\n${preview}${remaining}\n请移除或栅格化这些图层后再导出。`);
        return;
      }
    }
    // 工程 JSON 是用户自己的数据备份，永久免费且不需要联网授权；
    // 打包交付物（zip / 单文件 HTML）才需要服务端短期导出许可。
    const isProjectBackup = exportMode === 'json';
    const canExportWithoutWatermark = subscriptionService.hasFeature('export_no_watermark');
    const watermark = { enabled: !canExportWithoutWatermark };
    let authorization: ExportAuthorization | null = null;
    if (!isProjectBackup) {
      try {
        authorization = await subscriptionService.authorizeExport(exportMode, { watermark: watermark.enabled });
      } catch (error) {
        onRequestActivation?.();
        onError?.(error instanceof Error ? error.message : '导出授权验证失败');
        return;
      }
    }
    setIsExporting(true);
    setCompleted(false);
    setStatusMsg('正在准备工程数据...');
    setProgressPct(10);

    try {
      const fileNamePrefix = `鲸动交互平台_PROJ_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

      if (exportMode === 'zip') {
        const zipBlob = await exportProjectZip(projectData, (msg, pct) => {
          setStatusMsg(msg);
          setProgressPct(pct);
        }, { hudStyle, showSceneDots, showSceneTitle, runtime: 'editor-player', exportProof: authorization?.proof, watermark });
        downloadBlob(zipBlob, `${fileNamePrefix}.zip`);
      } else if (exportMode === 'single-html') {
        const htmlContent = await exportSingleFileHTML(projectData, (msg, pct) => {
          setStatusMsg(msg);
          setProgressPct(pct);
        }, { hudStyle, showSceneDots, showSceneTitle, exportProof: authorization?.proof, watermark });
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        downloadBlob(blob, `${fileNamePrefix}_STANDALONE.html`);
      } else if (exportMode === 'json') {
        setStatusMsg('生成 JSON 数据...');
        setProgressPct(80);
        const payload = {
          ...projectData,
          // 导出的源数据带上 schema 版本，重新导入时不再依赖缺省推断。
          schemaVersion: SCHEMA_VERSION,
          ...(authorization?.proof ? { __aether_export_proof: authorization.proof } : {}),
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        downloadBlob(blob, `${fileNamePrefix}_DATA.json`);
      }

      setStatusMsg('导出完成！');
      setProgressPct(100);
      setIsExporting(false);
      if (watermark.enabled && !isProjectBackup) {
        // 免费导出带水印：停留在弹窗，给出升级与免费体验入口。
        setCompleted(true);
        subscriptionService.getExportQuota().then(setFreeQuota).catch(() => {});
      } else {
        setTimeout(onClose, 800);
      }
    } catch (err) {
      console.error(err);
      onError?.('导出失败: ' + (err as Error).message);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4" role="presentation">
      <div className="bg-[#141622] border border-white/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 text-slate-200" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-sky-950/20">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/20 rounded-lg text-sky-300">
              <Download size={18} />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-sm font-bold text-white">打包导出 (Export Presentation)</h2>
              <p className="text-[11px] text-slate-400">选择适合您的导出格式进行离线展示或代码分发</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md"
            aria-label="关闭导出窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {!subscriptionService.hasFeature('export_no_watermark') && (
            <div className={`rounded-lg border px-3.5 py-2.5 text-[11px] leading-5 ${freeExportLocked ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span>
                  {freeExportLocked
                    ? `免费导出次数已用完（${freeQuota?.used ?? 0}/${freeQuota?.limit ?? 3}），工程 JSON 备份仍可继续导出。`
                    : `当前为免费导出：成品保留水印，最高 1080p${freeQuota ? `（剩余 ${freeQuota.remaining}/${freeQuota.limit} 次）` : ''}。`}
                </span>
                <button
                  type="button"
                  onClick={() => onRequestActivation?.()}
                  className="shrink-0 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] transition shadow flex items-center gap-1"
                >
                  去水印/获取注册码 (¥29.9起) ↗
                </button>
              </div>
            </div>
          )}
          {/* Option 1: Standalone ZIP */}
          <div
            onClick={() => !isExporting && setExportMode('zip')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              exportMode === 'zip'
                ? 'bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/50'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="p-2 bg-sky-500/20 text-sky-300 rounded-lg shrink-0 mt-0.5">
              <Package size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">独立工程离线包 (Zip Bundle)</span>
                {exportMode === 'zip' && <Check size={14} className="text-sky-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                包含纯净 <code className="text-sky-300">index.html</code> 与独立的 <code className="text-sky-300">/assets/</code> 资源文件夹，解压即用，性能极佳。
              </p>
            </div>
          </div>

          {/* Option 2: Single-File HTML */}
          <div
            onClick={() => !isExporting && setExportMode('single-html')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              exportMode === 'single-html'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/50'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg shrink-0 mt-0.5">
              <FileCode size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">兼容单文件 HTML (基础 2D)</span>
                {exportMode === 'single-html' && <Check size={14} className="text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                适用于基础 2D 素材的单文件兼容格式；包含 3D、全景、Saber、Galaxy UI 或组合图层时请使用 ZIP 同版播放器。
              </p>
            </div>
          </div>

          {/* Option 3: JSON Data */}
          <div
            onClick={() => !isExporting && setExportMode('json')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
              exportMode === 'json'
                ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-950/50'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-lg shrink-0 mt-0.5">
              <Code size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">工程源数据 (JSON)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">免费 · 离线</span>
                {exportMode === 'json' && <Check size={14} className="text-purple-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                导出结构化数据配置文件，可随时在其他鲸动交互平台中重新导入。此格式不需要授权码，断网也可备份。
              </p>
            </div>
          </div>

          {/* HUD 控制栏配置（仅 ZIP / 单文件 HTML） */}
          {exportMode !== 'json' && (
            <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">控制栏 (HUD) 款式</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { v: 'default', label: '默认', desc: '深色胶囊' },
                  { v: 'minimal', label: '极简', desc: '底部半透' },
                  { v: 'tech', label: '科技', desc: '发光边框' },
                  { v: 'hidden', label: '隐藏', desc: '不显示' },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setHudStyle(opt.v)}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      hudStyle === opt.v
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/25'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{opt.label}</div>
                    <div className="text-[8px] opacity-70 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
              {hudStyle !== 'hidden' && (
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSceneDots}
                      onChange={(e) => setShowSceneDots(e.target.checked)}
                      className="accent-sky-500"
                    />
                    <span className="text-[10px] text-slate-400">场景进度点</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSceneTitle}
                      onChange={(e) => setShowSceneTitle(e.target.checked)}
                      className="accent-sky-500"
                    />
                    <span className="text-[10px] text-slate-400">场景标题</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Progress bar during export */}
          {isExporting && (
            <div className="p-3 bg-black/50 border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sky-300 font-medium flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-sky-400" />
                  {statusMsg}
                </span>
                <span className="font-mono text-slate-400">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-200"
                />
              </div>
            </div>
          )}

          {completed && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
              <div className="text-xs font-bold text-emerald-200">导出完成（免费版带水印）</div>
              <p className="text-[11px] leading-5 text-slate-300">
                成品右下角保留了「鲸动交互平台」水印。激活专业版可去除水印并解锁 4K；也可以先了解免费体验内容。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onRequestActivation?.()} className="rounded-md bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500">激活专业版</button>
                <button type="button" onClick={() => onRequestFreeExperience?.()} className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/15">了解免费体验</button>
                <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[11px] text-slate-400 hover:text-white">完成</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2 bg-[#12141c]">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-semibold text-slate-300"
          >
            取消
          </button>

          <button
            type="button"
            disabled={isExporting || (freeExportLocked && exportMode !== 'json')}
            onClick={handleExport}
            className={`px-5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all ${
              freeExportLocked && exportMode !== 'json'
                ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
            }`}
          >
            <Download size={14} />
            <span>{isExporting ? '正在打包...' : freeExportLocked && exportMode !== 'json' ? '免费次数已用完' : '开始导出'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
