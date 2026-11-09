import React, { useState, useEffect } from 'react';
import { 
  X, Zap, Sparkles, Sliders, Play, Check, Flame, 
  Activity, Circle, Shield, Box, Compass, PenTool, Layers
} from 'lucide-react';
import { 
  SABER_SHAPE_PRESETS, 
  SABER_EFFECT_STYLES,
  SABER_STYLE_THEMES, 
  SaberShapePreset, 
  SaberStyleTheme,
  SaberEffectType,
} from '../utils/saberPresets';
import { SaberEffectPreview } from './SaberEffectPreview';

interface SaberPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSaberPreset: (
    shape: SaberShapePreset,
    theme: SaberStyleTheme,
    effectType: SaberEffectType,
    growthMode: 'grow-in' | 'cycle-flow' | 'pulse-grow' | 'meteor-shoot' | 'none'
  ) => void;
  onOpenDrawMode: () => void;
}

export const SaberPresetModal: React.FC<SaberPresetModalProps> = ({
  isOpen,
  onClose,
  onSelectSaberPreset,
  onOpenDrawMode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedShapeId, setSelectedShapeId] = useState<string>('geo_rect');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('luxury_champagne');
  const [selectedEffectType, setSelectedEffectType] = useState<SaberEffectType>('standard');
  const [selectedGrowthMode, setSelectedGrowthMode] = useState<'grow-in' | 'cycle-flow' | 'pulse-grow' | 'meteor-shoot' | 'none'>('grow-in');

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

  const currentShape = SABER_SHAPE_PRESETS.find((s) => s.id === selectedShapeId) || SABER_SHAPE_PRESETS[0];
  const currentTheme = SABER_STYLE_THEMES.find((t) => t.id === selectedThemeId) || SABER_STYLE_THEMES[0];

  const categories = [
    { id: 'all', label: '全部形状', icon: Sparkles },
    { id: 'geometric', label: '基础几何 (长方/圆/线/三角)', icon: Circle },
    { id: '3d_wireframe', label: '3D透视线框 (圆柱/立方体)', icon: Box },
    { id: 'cyber_hud', label: '科幻HUD (梯形/双环/仪表)', icon: Shield },
    { id: 'laser_beam', label: '能量光束 (直线/光剑/波浪)', icon: Zap },
    { id: 'symbol', label: '星芒与无限环', icon: Flame },
  ];

  const filteredShapes = selectedCategory === 'all'
    ? SABER_SHAPE_PRESETS
    : SABER_SHAPE_PRESETS.filter((s) => s.category === selectedCategory);

  const handleApply = () => {
    onSelectSaberPreset(currentShape, currentTheme, selectedEffectType, selectedGrowthMode);
    onClose();
  };

  const handleStartDraw = () => {
    onClose();
    onOpenDrawMode();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200" role="presentation">
      <div className="bg-[#121520] border border-white/15 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden text-slate-200" role="dialog" aria-modal="true" aria-label="Saber 预设">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35)]">
              <Zap size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">AE Saber 几何形状与光效库</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-medium">
                  AE Saber 极光引擎
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                高审美纯几何形状（长方形/正圆/3D圆柱体/三角形/六边形等），支持光线生长、循环流光与细腻参数调节
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleStartDraw}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold shadow-sm transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <PenTool size={14} />
              <span>钢笔工具自由绘制 (P)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="关闭 Saber 预设窗口"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body: Left Shapes Grid + Right Live Preview & Optics Settings */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Shape Categories & Shapes Grid */}
          <div className="w-3/5 border-r border-white/10 flex flex-col bg-[#0e111a]">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/10 overflow-x-auto no-scrollbar">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Shape Grid */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-3 gap-3.5 content-start">
              {filteredShapes.map((shape) => {
                const isSelected = selectedShapeId === shape.id;
                return (
                  <div
                    key={shape.id}
                    onClick={() => {
                      setSelectedShapeId(shape.id);
                      if (shape.defaultGrowthMode) {
                        setSelectedGrowthMode(shape.defaultGrowthMode);
                      }
                    }}
                    className={`group relative p-3.5 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    {/* SVG Shape Thumbnail */}
                    <div className="w-full h-24 rounded-lg bg-[#07090e] border border-white/5 flex items-center justify-center p-2 mb-2.5 relative overflow-hidden group-hover:border-cyan-500/30 transition-colors">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <defs>
                          <filter id={`thumb-glow-${shape.id}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        {/* Glow halo */}
                        <path
                          d={shape.path}
                          fill="none"
                          stroke={currentTheme.glowColor}
                          strokeWidth={isSelected ? "3.2" : "2.2"}
                          strokeOpacity={isSelected ? "0.85" : "0.55"}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          filter={`url(#thumb-glow-${shape.id})`}
                        />
                        {/* Core beam */}
                        <path
                          d={shape.path}
                          fill="none"
                          stroke={currentTheme.coreColor}
                          strokeWidth={isSelected ? "0.9" : "0.7"}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[10px] font-bold shadow-md">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <div className="w-full flex items-center justify-center gap-1.5">
                      <span className="text-sm">{shape.icon}</span>
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-cyan-200 font-bold' : 'text-slate-200'}`}>
                        {shape.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {shape.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Live Glowing Preview & Optical Parameters */}
          <div className="w-2/5 flex flex-col bg-[#141824] overflow-y-auto p-6 space-y-6">
            
            {/* 1. Big Live Interactive Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={13} className="text-cyan-400" />
                  实时光效预览
                </span>
                <span className="text-[11px] text-cyan-300 font-mono">
                  {currentShape.name} × {currentTheme.name}
                </span>
              </div>

              <div className="w-full h-52 rounded-xl bg-[#080a10] border border-cyan-500/30 flex items-center justify-center relative overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">
                {/* Background grid */}
                <div 
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />

                <SaberEffectPreview
                  effectType={selectedEffectType}
                  glowColor={currentTheme.glowColor}
                  secondaryColor={currentTheme.secondaryGlowColor}
                  coreColor={currentTheme.coreColor}
                  coreWidth={currentTheme.coreWidth}
                  glowSpread={currentTheme.glowSpread}
                  path={currentShape.path}
                  animated
                  className="w-4/5 h-4/5 relative z-10"
                />

                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-slate-400 bg-black/60 px-2.5 py-1 rounded-md border border-white/10 backdrop-blur-sm">
                  <span>光晕: <strong className="text-white">{currentTheme.glowColor}</strong></span>
                  <span>光芯: <strong className="text-white">{currentTheme.coreColor}</strong></span>
                  <span>动效: <strong className="text-cyan-300">
                    {selectedGrowthMode === 'grow-in' ? '从头生长' : selectedGrowthMode === 'cycle-flow' ? '循环流光' : selectedGrowthMode === 'pulse-grow' ? '呼吸律动' : selectedGrowthMode === 'meteor-shoot' ? '流星穿梭' : '静态'}
                  </strong></span>
                </div>
              </div>
            </div>

            {/* 2. Light Profile */}
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={13} className="text-fuchsia-400" />
                钢笔光线类型 (Light Profile)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {SABER_EFFECT_STYLES.map((style) => {
                  const active = selectedEffectType === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedEffectType(style.id)}
                      className={`p-1.5 rounded-lg border text-left transition-all ${active ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100 ring-1 ring-fuchsia-400/30' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'}`}
                    >
                      <SaberEffectPreview effectType={style.id} glowColor={currentTheme.glowColor} secondaryColor={currentTheme.secondaryGlowColor} coreColor={currentTheme.coreColor} coreWidth={currentTheme.coreWidth} glowSpread={currentTheme.glowSpread} animated className="w-full h-14 rounded bg-[#07090e]" />
                      <span className="block mt-1 text-[10px] font-semibold truncate">{style.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Color & Energy Style Themes */}
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={13} className="text-amber-400" />
                光束色彩主题预设 (Theme)
              </span>

              <div className="grid grid-cols-3 gap-2">
                {SABER_STYLE_THEMES.map((theme) => {
                  const isThemeSelected = selectedThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setSelectedThemeId(theme.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                        isThemeSelected
                          ? 'bg-white/15 border-white text-white ring-1 ring-white/50 shadow-sm'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div 
                        className="w-4 h-4 rounded-full border border-white/40 shadow-sm shrink-0" 
                        style={{ backgroundColor: theme.glowColor, boxShadow: `0 0 10px ${theme.glowColor}` }}
                      />
                      <div className="overflow-hidden">
                        <div className="text-xs font-medium truncate">{theme.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Growth & Flow Motion Modes */}
            <div className="space-y-2.5">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Play size={13} className="text-emerald-400" />
                光线生长与流动模式 (Growth Mode)
              </span>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'grow-in', label: '从头生长 (Grow In)', desc: '从 0% 光线延伸至 100% 全貌' },
                  { id: 'cycle-flow', label: '循环流光 (Cycle Flow)', desc: '光芒沿路径持续循环穿梭跑马' },
                  { id: 'pulse-grow', label: '呼吸生长 (Pulse)', desc: '柔和舒张往返律动' },
                  { id: 'meteor-shoot', label: '流星飞掠 (Meteor)', desc: '高能光弹高速掠过' },
                  { id: 'none', label: '静态高光 (Static)', desc: '完整全长保持恒定光亮' },
                ].map((mode) => {
                  const isModeActive = selectedGrowthMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSelectedGrowthMode(mode.id as any)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isModeActive
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/30 font-semibold'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">{mode.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={15} />
                <span>立即插入形状光效</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
