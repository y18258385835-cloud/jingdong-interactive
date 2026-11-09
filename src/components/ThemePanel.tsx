import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Palette, Paintbrush, X } from 'lucide-react';
import type { ThemeTokens } from '../types';
import { DEFAULT_THEME, normalizeTheme, type ApplyThemeOptions } from '../utils/theme';

interface ThemePanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: ThemeTokens;
  onSave: (theme: ThemeTokens) => void;
  onApply: (theme: ThemeTokens, options: ApplyThemeOptions) => void;
  onExtract: () => ThemeTokens;
}

const COLOR_FIELDS: Array<{ key: keyof ThemeTokens['colors']; label: string; hint: string }> = [
  { key: 'background', label: '画布背景', hint: '场景底色' },
  { key: 'surface', label: '卡片底色', hint: '面板/卡片' },
  { key: 'primary', label: '主色', hint: '按钮/强调' },
  { key: 'accent', label: '辅助色', hint: '高亮/渐变' },
  { key: 'text', label: '主文字', hint: '标题/正文' },
  { key: 'textSecondary', label: '次文字', hint: '说明/注释' },
  { key: 'border', label: '边框', hint: '分隔线/描边' },
];

export const ThemePanel: React.FC<ThemePanelProps> = ({
  isOpen,
  onClose,
  theme,
  onSave,
  onApply,
  onExtract,
}) => {
  const [draft, setDraft] = useState<ThemeTokens>(() => normalizeTheme(theme));
  const [options, setOptions] = useState<ApplyThemeOptions>({
    background: true,
    text: true,
    typography: true,
    radius: true,
    shadow: false,
  });

  useEffect(() => {
    if (isOpen) setDraft(normalizeTheme(theme));
  }, [isOpen, theme]);

  if (!isOpen) return null;

  const updateColor = (key: keyof ThemeTokens['colors'], value: string) => {
    setDraft((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
  };
  const updateTypography = <K extends keyof ThemeTokens['typography']>(key: K, value: ThemeTokens['typography'][K]) => {
    setDraft((current) => ({ ...current, typography: { ...current.typography, [key]: value } }));
  };
  const toggleOption = (key: keyof ApplyThemeOptions) => {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-[#0d121c] text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-label="设计主题">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300">
              <Palette size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">设计主题</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">统一颜色、字体、圆角和阴影；保存后作为工程主题</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭设计主题">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <input
              value={draft.name || ''}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="主题名称，如：深空蓝"
              aria-label="主题名称"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white outline-none focus:border-fuchsia-400"
            />
            <button
              type="button"
              onClick={() => setDraft(onExtract())}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-2 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
            >
              <Paintbrush size={11} /> 从工程提取
            </button>
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_THEME)}
              className="shrink-0 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white"
            >
              恢复默认
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key} className="rounded-lg border border-white/10 bg-black/25 p-2">
                <span className="mb-1 block text-[9px] text-slate-400">{field.label}</span>
                <span className="mb-1.5 block text-[8px] text-slate-600">{field.hint}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={draft.colors[field.key]}
                    onChange={(event) => updateColor(field.key, event.target.value)}
                    className="h-6 w-7 shrink-0 rounded border border-white/10 bg-black/40"
                    aria-label={`${field.label}颜色`}
                  />
                  <input
                    value={draft.colors[field.key]}
                    onChange={(event) => updateColor(field.key, event.target.value)}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-1 py-1 font-mono text-[9px] text-slate-200 outline-none focus:border-fuchsia-400"
                    aria-label={`${field.label}色值`}
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="col-span-2 rounded-lg border border-white/10 bg-black/25 p-2">
              <span className="mb-1 block text-[9px] text-slate-400">字体</span>
              <input
                value={draft.typography.fontFamily}
                onChange={(event) => updateTypography('fontFamily', event.target.value)}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-fuchsia-400"
                aria-label="主题字体"
              />
            </label>
            <label className="rounded-lg border border-white/10 bg-black/25 p-2">
              <span className="mb-1 block text-[9px] text-slate-400">正文字号</span>
              <input
                type="number"
                min="8"
                max="80"
                value={draft.typography.baseSize}
                onChange={(event) => updateTypography('baseSize', Math.max(8, Number(event.target.value) || 16))}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-fuchsia-400"
                aria-label="正文字号"
              />
            </label>
            <label className="rounded-lg border border-white/10 bg-black/25 p-2">
              <span className="mb-1 block text-[9px] text-slate-400">标题字号</span>
              <input
                type="number"
                min="8"
                max="160"
                value={draft.typography.headingSize}
                onChange={(event) => updateTypography('headingSize', Math.max(8, Number(event.target.value) || 32))}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-fuchsia-400"
                aria-label="标题字号"
              />
            </label>
            <label className="rounded-lg border border-white/10 bg-black/25 p-2">
              <span className="mb-1 block text-[9px] text-slate-400">圆角</span>
              <input
                type="number"
                min="0"
                max="200"
                value={draft.radius}
                onChange={(event) => setDraft((current) => ({ ...current, radius: Math.max(0, Number(event.target.value) || 0) }))}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white outline-none focus:border-fuchsia-400"
                aria-label="主题圆角"
              />
            </label>
            <label className="col-span-3 rounded-lg border border-white/10 bg-black/25 p-2">
              <span className="mb-1 block text-[9px] text-slate-400">阴影</span>
              <input
                value={draft.shadow}
                onChange={(event) => setDraft((current) => ({ ...current, shadow: event.target.value }))}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[9px] text-slate-200 outline-none focus:border-fuchsia-400"
                aria-label="主题阴影"
              />
            </label>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-slate-200">应用到现有工程</div>
                <div className="mt-0.5 text-[9px] text-slate-500">只改勾选的项；应用后可用 Ctrl+Z 撤销</div>
              </div>
              <button
                type="button"
                onClick={() => onSave(draft)}
                className="flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] font-semibold text-fuchsia-200 hover:bg-fuchsia-400/20"
              >
                <Check size={11} /> 保存主题
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([
                ['background', '背景'],
                ['text', '文字颜色'],
                ['typography', '字体/字号'],
                ['radius', '圆角'],
                ['shadow', '阴影'],
              ] as Array<[keyof ApplyThemeOptions, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleOption(key)}
                  className={`rounded-full border px-2 py-1 text-[9px] ${options[key] ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
                >
                  {options[key] ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-slate-500">有背景图的场景会保留原背景图；文字特效预设不会被强制改色。</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <span className="text-[9px] text-slate-500">主色 / 辅助色也会用于之后新建的图层</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/5">关闭</button>
            <button
              type="button"
              onClick={() => onApply(draft, options)}
              className="rounded-lg bg-fuchsia-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-fuchsia-300"
            >
              应用到工程
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
