import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Palette, ArrowRight, Wand2 } from 'lucide-react';
import {
  VFX_MOTIONS,
  VFX_MOTION_CATEGORIES,
  VfxMotionDef,
  VfxMotionId,
} from '../utils/vfxMotions';
import { COLOR_THEME_PRESETS_ALIGNED } from '../utils/shapeStyles';
import { VfxMotionCanvas } from './VfxMotionCanvas';
import { isCardLayoutMotion } from './CardLayoutVfx';
import { isMorphMotion } from './MorphVfx';

interface VfxPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVfxPreset: (motion: VfxMotionDef, colorA: string, colorB: string, speed: number) => void;
}

/** 科技·简约 动效配色方案 */
const VFX_THEME_LEGACY: { name: string; colorA: string; colorB: string }[] = [
  { name: '霓虹青紫', colorA: '#22d3ee', colorB: '#a855f7' },
  { name: '深空蓝紫', colorA: '#a78bfa', colorB: '#0ea5e9' },
  { name: '能量绿青', colorA: '#34d399', colorB: '#22d3ee' },
  { name: '熔岩炽橙', colorA: '#fb923c', colorB: '#9a3412' },
  { name: '冷白电蓝', colorA: '#e0f2fe', colorB: '#38bdf8' },
  { name: '霓虹玫紫', colorA: '#f472b6', colorB: '#818cf8' },
];

const VFX_THEME_PRESETS = COLOR_THEME_PRESETS_ALIGNED;

export const VfxPresetModal: React.FC<VfxPresetModalProps> = ({
  isOpen,
  onClose,
  onSelectVfxPreset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [themeIdx, setThemeIdx] = useState(0);

  const filteredMotions = useMemo(() => {
    return selectedCategory === 'all'
      ? VFX_MOTIONS.filter((m) => !isCardLayoutMotion(m.id) && !isMorphMotion(m.id))
      : VFX_MOTIONS.filter((m) => m.category === selectedCategory && !isCardLayoutMotion(m.id) && !isMorphMotion(m.id));
  }, [selectedCategory]);
  const availableCategories = useMemo(() => VFX_MOTION_CATEGORIES.filter((cat) =>
    cat.id === 'all' || VFX_MOTIONS.some((motion) => motion.category === cat.id && !isCardLayoutMotion(motion.id) && !isMorphMotion(motion.id)),
  ), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const theme = VFX_THEME_PRESETS[themeIdx] || VFX_THEME_PRESETS[0];

  const handleApply = (motion: VfxMotionDef) => {
    onSelectVfxPreset(motion, theme.colorA, theme.colorB, 1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200" role="presentation">
      <div className="bg-[#121520] border border-white/15 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden text-slate-200" role="dialog" aria-modal="true" aria-label="特效预设">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300 shadow-[0_0_20px_rgba(217,70,239,0.3)]">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">科技简约动效库</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 font-mono font-medium">
                  GPU-Style Motion
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                数字网格地球 · 光速隧道 · 星轨 · 数字星尘 · 霓虹波 —— 借鉴 MetalForge 动效精髓，拖入画布即持续播放，支持鼠标交互
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5">
              <Palette size={12} className="text-fuchsia-400" />
              <span>配色：</span>
              {VFX_THEME_PRESETS.map((th, i) => (
                <button
                  key={th.name}
                  type="button"
                  title={th.name}
                  aria-label={th.name}
                  onClick={() => setThemeIdx(i)}
                  className={`h-5 w-5 rounded-full border transition-transform hover:scale-125 ${
                    themeIdx === i ? 'border-white ring-2 ring-white/80 ring-offset-2 ring-offset-[#121520] scale-110' : 'border-white/25'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${th.colorA}, ${th.colorB})` }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="关闭特效预设窗口"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/10 overflow-x-auto no-scrollbar">
          {availableCategories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Motion Grid —— 实时动效预览卡片 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMotions.map((motion) => (
              <div
                key={motion.id}
                onClick={() => handleApply(motion)}
                className="group bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-fuchsia-400/50 rounded-xl p-3 flex flex-col cursor-pointer transition-all duration-200 hover:shadow-xl"
              >
                {/* 实时播放的动效预览 */}
                <div className="relative h-24 rounded-lg overflow-hidden border border-white/5">
                  <VfxMotionCanvas
                    motionType={motion.id as VfxMotionId}
                    colorA={theme.colorA}
                    colorB={theme.colorB}
                    interactive
                    maxRes={100}
                    fpsLimit={20}
                  />
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5 text-[10px] text-white/80 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    实时播放
                  </div>
                </div>
                <div className="mt-2.5 flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-fuchsia-300 transition-colors flex items-center gap-1.5">
                      <span>{motion.icon}</span>
                      <span className="truncate">{motion.name}</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                      {motion.desc}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-fuchsia-300 font-semibold group-hover:text-white">
                  <span>拖入/点击添加</span>
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/30 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Wand2 size={13} className="text-cyan-400" />
            <span>添加后可在右侧属性面板调整动效类型、配色与速度；渲染采用低分辨率 Canvas 保证流畅。</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            关闭 (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
