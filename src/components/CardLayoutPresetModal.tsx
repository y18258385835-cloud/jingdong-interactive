import React, { useEffect, useMemo, useState } from 'react';
import { Check, Grid3X3, Palette, Sparkles, X } from 'lucide-react';
import { COLOR_THEME_PRESETS_ALIGNED } from '../utils/shapeStyles';
import { VFX_MOTIONS, type VfxMotionDef } from '../utils/vfxMotions';
import { VfxMotionCanvas } from './VfxMotionCanvas';
import type { CardLayoutMotionId } from './CardLayoutVfx';

interface CardLayoutPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (motion: VfxMotionDef, colorA: string, colorB: string, speed: number, params: Record<string, number | string>) => void;
}

const IDS: CardLayoutMotionId[] = ['card-depth-stack', 'card-fan', 'card-cylinder', 'card-sphere', 'card-spiral', 'card-wave-grid'];

export const CardLayoutPresetModal: React.FC<CardLayoutPresetModalProps> = ({ isOpen, onClose, onSelect }) => {
  const motions = useMemo(() => VFX_MOTIONS.filter((motion) => IDS.includes(motion.id as CardLayoutMotionId)), []);
  const [activeId, setActiveId] = useState<CardLayoutMotionId>('card-depth-stack');
  const [themeIdx, setThemeIdx] = useState(0);
  const [colorA, setColorA] = useState(COLOR_THEME_PRESETS_ALIGNED[0]?.colorA || '#38bdf8');
  const [colorB, setColorB] = useState(COLOR_THEME_PRESETS_ALIGNED[0]?.colorB || '#8b5cf6');
  const [speed, setSpeed] = useState(1);
  const [spread, setSpread] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const active = motions.find((motion) => motion.id === activeId) || motions[0];
  const params = { spread, ...(active.id === 'card-wave-grid' ? { wave: 0.55 } : {}), ...(active.id !== 'card-fan' && active.id !== 'card-depth-stack' ? { rotate: 0.18 } : {}) };
  const applyTheme = (index: number) => { const theme = COLOR_THEME_PRESETS_ALIGNED[index]; if (!theme) return; setThemeIdx(index); setColorA(theme.colorA); setColorB(theme.colorB); };
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="presentation">
    <div className="flex h-[min(88vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#10151e] text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-label="卡片编排库">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[.025] px-6 py-4">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"><Grid3X3 size={20} /></div><div><h2 className="text-lg font-semibold text-white">卡片编排库</h2><p className="mt-0.5 text-xs text-slate-400">固定空间结构 · 强毛玻璃卡片 · 滑动切换</p></div></div>
        <button type="button" onClick={onClose} aria-label="关闭卡片编排库" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 overflow-y-auto border-b border-white/10 p-4 lg:w-64 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200"><Sparkles size={12} />编排方式</div>
          <div className="space-y-1">{motions.map((motion) => <button type="button" key={motion.id} onClick={() => setActiveId(motion.id as CardLayoutMotionId)} className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition ${active.id === motion.id ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-transparent hover:border-white/15 hover:bg-white/5'}`}><span className="mt-0.5 text-cyan-200">{motion.icon}</span><span className="min-w-0"><strong className="block truncate text-[11px] text-white">{motion.name}</strong><small className="mt-0.5 block text-[9px] leading-4 text-slate-400">{motion.desc}</small></span>{active.id === motion.id && <Check size={13} className="ml-auto shrink-0 text-cyan-300" />}</button>)}</div>
        </aside>
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#080b13] lg:min-h-[390px]"><VfxMotionCanvas motionType={active.id as CardLayoutMotionId} colorA={colorA} colorB={colorB} speed={speed} params={params} maxRes={520} /><span className="pointer-events-none absolute left-3 top-3 rounded bg-black/50 px-2 py-1 text-[10px] text-slate-300">实时预览 · 左右滑动切换 · 滚轮或双指缩放</span></div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
            <section><label className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><Palette size={12} />颜色主题</label><div className="flex flex-wrap gap-2">{COLOR_THEME_PRESETS_ALIGNED.slice(0, 8).map((theme, index) => <button type="button" key={theme.name} title={theme.name} aria-label={theme.name} onClick={() => applyTheme(index)} className={`h-7 w-7 rounded-full border ${themeIdx === index ? 'border-white ring-2 ring-cyan-300/70' : 'border-white/20'}`} style={{ background: `linear-gradient(135deg,${theme.colorA},${theme.colorB})` }} />)}</div><div className="mt-2 flex gap-2"><input type="color" value={colorA} onChange={(event) => setColorA(event.target.value)} aria-label="主色" className="h-7 w-7 cursor-pointer rounded border border-white/20 bg-transparent" /><input type="color" value={colorB} onChange={(event) => setColorB(event.target.value)} aria-label="辅色" className="h-7 w-7 cursor-pointer rounded border border-white/20 bg-transparent" /><span className="self-center text-[9px] text-slate-500">主色 / 辅色</span></div></section>
            <section><div className="mb-2 flex items-center justify-between"><label className="text-[10px] font-semibold text-slate-400">卡片间距</label><span className="font-mono text-[10px] text-cyan-200">{spread.toFixed(2)}x</span></div><input type="range" min="0.5" max="2" step="0.05" value={spread} onChange={(event) => setSpread(Number(event.target.value))} className="w-full accent-cyan-300" /><div className="mt-3 flex items-center justify-between"><label className="text-[10px] font-semibold text-slate-400">运动速度</label><span className="font-mono text-[10px] text-cyan-200">{speed.toFixed(1)}x</span></div><input type="range" min="0.2" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-full accent-cyan-300" /></section>
            <section className="rounded-lg border border-white/10 bg-white/[.025] p-3 text-[10px] leading-5 text-slate-400"><strong className="text-slate-200">交互策略</strong><p className="mt-1">卡片保持稳定的水平编排；点击仅用于选择，不改变卡片大小或位置。右滑切下一张，左滑切上一张；滚轮或双指可缩放整体观察尺度。</p></section>
          </div>
        </main>
      </div>
      <footer className="flex items-center justify-between border-t border-white/10 bg-black/20 px-6 py-3"><span className="text-[10px] text-slate-500">{active.name} · {Math.round(spread * 100)}% 间距 · {speed.toFixed(1)}x 速度</span><button type="button" onClick={() => onSelect(active, colorA, colorB, speed, params)} className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200">添加到画布</button></footer>
    </div>
  </div>;
};
