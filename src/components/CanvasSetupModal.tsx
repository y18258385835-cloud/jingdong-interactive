import React, { useEffect, useRef, useState } from 'react';
import { CANVAS_PRESETS, getCanvasRatioLabel } from '../utils/canvas';

interface CanvasSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 确认创建：返回所选画布尺寸 */
  onCreate: (canvas: { width: number; height: number }) => void;
}

/** 新建空白工程时的「画布设置」：选择播放媒介比例，决定整个工程的画布尺寸与输出比例 */
export const CanvasSetupModal: React.FC<CanvasSetupModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [presetIdx, setPresetIdx] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [cw, setCw] = useState('1080');
  const [ch, setCh] = useState('1920');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolveCanvas = (): { width: number; height: number } | null => {
    if (useCustom) {
      const w = parseInt(cw, 10);
      const h = parseInt(ch, 10);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 100 || w > 8000 || h > 8000) return null;
      return { width: w, height: h };
    }
    const p = CANVAS_PRESETS[presetIdx];
    return { width: p.width, height: p.height };
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="w-[520px] max-w-[92vw] rounded-2xl bg-[#151721] border border-white/10 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-setup-title"
      >
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 id="canvas-setup-title" className="text-sm font-semibold text-white">新建空白工程 · 画布设置</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">选择播放媒介比例，画布尺寸与导出输出将跟随此比例</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭画布设置" className="w-10 h-10 rounded-md text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">✕</button>
        </div>

        <div className="px-5 py-4">
          {/* 预设比例 */}
          <div className="grid grid-cols-3 gap-2">
            {CANVAS_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={!useCustom && presetIdx === i}
                onClick={() => { setPresetIdx(i); setUseCustom(false); }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  !useCustom && presetIdx === i
                    ? 'border-sky-500 bg-sky-500/15'
                    : 'border-white/10 bg-white/[0.03] hover:border-sky-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{p.label}</span>
                  {/* 比例缩略示意 */}
                  <span
                    className="inline-block rounded-[2px] border border-sky-400/70"
                    style={{
                      width: p.width >= p.height ? 18 : 11,
                      height: p.width >= p.height ? 11 : 18,
                    }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{p.sub}</div>
                <div className="text-[10px] font-mono text-slate-300 mt-0.5">{p.width} × {p.height}</div>
              </button>
            ))}

            {/* 自定义 */}
            <button
              type="button"
              aria-pressed={useCustom}
              onClick={() => setUseCustom(true)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                useCustom ? 'border-sky-500 bg-sky-500/15' : 'border-white/10 bg-white/[0.03] hover:border-sky-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">自定义</span>
                <span className="inline-block rounded-[2px] border border-sky-400/70" style={{ width: 14, height: 14 }} />
              </div>
              <div className="text-[10px] text-slate-400 mt-1">异形屏 / 拼接屏</div>
            </button>
          </div>

          {/* 自定义输入 */}
          {useCustom && (
            <div className="mt-3 flex items-center gap-3 bg-black/30 rounded-xl p-3">
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                宽
                <input
                  type="number" aria-label="自定义画布宽度" value={cw} min={100} max={8000}
                  onChange={(e) => setCw(e.target.value)}
                  className="w-20 px-2 py-1 rounded bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </label>
              <span className="text-slate-400">×</span>
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                高
                <input
                  type="number" aria-label="自定义画布高度" value={ch} min={100} max={8000}
                  onChange={(e) => setCh(e.target.value)}
                  className="w-20 px-2 py-1 rounded bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </label>
              <span className="ml-auto text-[11px] font-mono text-slate-300">
                {useCustom ? getCanvasRatioLabel(parseInt(cw, 10) || 1, parseInt(ch, 10) || 1) : ''}
              </span>
            </div>
          )}

          {/* 说明 */}
          <p className="mt-3 text-[10px] text-slate-300 leading-relaxed">
            元素坐标均为百分比，切换画布比例后元素自动等比适配；演示/导出输出分辨率将保持该比例（如 9:16 竖屏导出 1080×1920）。
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
            取消
          </button>
          <button
            type="button"
            disabled={!resolveCanvas()}
            onClick={() => {
              const c = resolveCanvas();
              if (c) onCreate(c);
            }}
            className="min-h-10 px-4 py-2 rounded-lg bg-[#075985] hover:bg-[#0369a1] text-white text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200"
          >
            创建工程
          </button>
        </div>
      </div>
    </div>
  );
};
