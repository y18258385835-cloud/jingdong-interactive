import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Shapes, Sparkles, Search, Check, Layers, Square, Palette, 
  Circle as CircleIcon, ArrowRight, Wand2, Shield, Info, PenTool
} from 'lucide-react';
import { BASE_SHAPE_PRESETS, ShapePresetItem, GRADIENT_PRESETS, SOLID_COLOR_PRESETS, COLOR_THEME_PRESETS_ALIGNED, ColorThemeId, getColorThemePreset, getColorThemeTextColor, getColorThemeBorderColor } from '../utils/shapeStyles';
import { SceneElement } from '../types';

interface ShapePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShapePreset: (preset: ShapePresetItem, colorTheme?: ColorThemeId) => void;
  onOpenCustomShapePen: () => void;
}

export const ShapePresetModal: React.FC<ShapePresetModalProps> = ({
  isOpen,
  onClose,
  onSelectShapePreset,
  onOpenCustomShapePen,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedColorTheme, setSelectedColorTheme] = useState<ColorThemeId>('cyber');
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  // Filtered shapes
  const filteredPresets = useMemo(() => {
    return BASE_SHAPE_PRESETS.filter((item) => {
      const matchesCategory = 
        selectedCategory === 'all' 
          ? true 
          : selectedCategory === 'core' 
          ? !!item.isCore 
          : item.category === selectedCategory;
      
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = 
        !query || 
        item.name.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query) || 
        item.shapeKind.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Core 4 shapes
  const coreFourShapes = useMemo(() => {
    return BASE_SHAPE_PRESETS.filter((p) => p.isCore);
  }, []);

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

  // Render SVG / CSS geometric shape preview
  const renderShapeVisual = (shape: ShapePresetItem, size = 'w-full h-24') => {
    let backgroundStyle: string = 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #9333ea 100%)';
    let textColor = shape.textColor || '#ffffff';
    let borderColor = shape.defaultBorderColor || 'rgba(255, 255, 255, 0.3)';

    const theme = getColorThemePreset(selectedColorTheme);
    if (theme) {
      backgroundStyle = `linear-gradient(135deg, ${theme.colorA} 0%, ${theme.colorB} 100%)`;
      backgroundStyle = `linear-gradient(135deg, ${theme.colorA} 0%, ${theme.colorB} 100%)`;
      textColor = getColorThemeTextColor(theme.id);
      borderColor = getColorThemeBorderColor(theme.id);
    } else {
      // Default from preset
      if (shape.defaultBackgroundType === 'gradient') {
        const start = shape.defaultGradientStart || '#06b6d4';
        const end = shape.defaultGradientEnd || '#9333ea';
        const via = shape.defaultGradientVia;
        const angle = shape.defaultGradientAngle ?? 135;
        backgroundStyle = via
          ? `linear-gradient(${angle}deg, ${start} 0%, ${via} 50%, ${end} 100%)`
          : `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
      } else {
        backgroundStyle = shape.defaultBackgroundColor || 'rgba(30, 41, 59, 0.9)';
      }
    }

    // 【等比例】按每个形状自身的自然比例（defaultW / defaultH）等比缩放预览尺寸，
    // 与插入画布后的初始尺寸比例完全一致，避免正六边形/菱形/三角形等被统一压成扁形
    const natW = shape.defaultW || 28;
    const natH = shape.defaultH || 18;
    const MAX_PREVIEW_W = 96;
    const MAX_PREVIEW_H = 56;
    let pw = natW;
    let ph = natH;
    if (natW / natH > MAX_PREVIEW_W / MAX_PREVIEW_H) {
      pw = MAX_PREVIEW_W;
      ph = (MAX_PREVIEW_W * natH) / natW;
    } else {
      ph = MAX_PREVIEW_H;
      pw = (MAX_PREVIEW_H * natW) / natH;
    }

    return (
      <div className={`relative flex items-center justify-center p-3 ${size} overflow-hidden bg-black/40 rounded-lg border border-white/5`}>
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '12px 12px'
          }}
        />

        {/* Geometry element */}
        <div
          style={{
            background: backgroundStyle,
            borderRadius: shape.borderRadius !== undefined ? `${shape.borderRadius}px` : '0px',
            clipPath: shape.clipPath || undefined,
            WebkitClipPath: shape.clipPath || undefined,
            border: shape.clipPath ? 'none' : `1px solid ${borderColor}`,
            boxShadow: shape.defaultBoxShadow || '0 8px 20px rgba(0,0,0,0.3)',
            width: `${Math.round(pw)}px`,
            height: `${Math.round(ph)}px`,
          }}
          className={`aether-shape-surface relative flex items-center justify-center p-1 transition-transform duration-300 group-hover:scale-105 shadow-lg ${shape.clipPath ? 'aether-shape-surface--clipped' : ''}`}
        >
          <span 
            className="relative z-10 w-full text-[9px] font-bold tracking-wider leading-none truncate text-center select-none"
            style={{ color: textColor }}
          >
            {shape.name}
          </span>
        </div>
      </div>
    );
  };

  const handleApply = (shape: ShapePresetItem) => {
    onSelectShapePreset(shape, selectedColorTheme);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200" role="presentation">
      <div 
        className="bg-[#12141e] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="形状预设"
      >
        {/* Modal Header */}
        <div className="relative px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-sky-950/40 via-purple-950/30 to-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
              <Shapes size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">预设基础形状库</h2>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full">
                  Shape Presets
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                快速插入圆角矩形、圆形、椭圆形、梯形等基础几何形态与智能卡片
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="关闭窗口 (ESC)"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={onOpenCustomShapePen}
            title="钢笔绘制自定义形状"
            aria-label="钢笔绘制自定义形状"
            className="absolute right-14 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)] transition-colors hover:border-cyan-200/80 hover:bg-cyan-400/20 sm:right-16"
          >
            <PenTool size={15} />
            <span>钢笔自定义形状</span>
            <span className="rounded border border-cyan-200/30 bg-cyan-200/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-cyan-200">NEW</span>
          </button>
        </div>

        {/* Toolbar: Category Tabs, Search & Color Theme Selector */}
        <div className="px-6 py-3 border-b border-white/10 bg-black/30 flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {[
              { id: 'all', label: '全部图形' },
              { id: 'core', label: '⭐ 四大核心基础形', highlight: true },
              { id: 'base', label: '常用基础形' },
              { id: 'polygon', label: '多边形与科技' },
              { id: 'badge', label: '标签与徽章' },
              { id: 'arrow', label: '指示与箭头' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20'
                    : cat.highlight
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索形状名称 (如: 梯形, 椭圆, 圆角)..."
              className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Global Color Theme Preset Picker for inserted shapes */}
        <div className="px-6 py-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Palette size={13} className="text-fuchsia-400" />
            <span>配色：</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5">
            {COLOR_THEME_PRESETS_ALIGNED.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedColorTheme(theme.id)}
                title={theme.name}
                aria-label={theme.name}
                className={`h-5 w-5 rounded-full border transition-transform hover:scale-125 ${
                  selectedColorTheme === theme.id
                    ? 'border-white ring-2 ring-white/80 ring-offset-2 ring-offset-[#12141e] scale-110'
                    : 'border-white/25'
                }`}
                style={{ background: `linear-gradient(135deg, ${theme.colorA}, ${theme.colorB})` }}
              />
            ))}
          </div>
        </div>
        <div className="hidden px-6 py-2.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Wand2 size={13} className="text-pink-400" />
            <span>初始填充配色方案：</span>
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: 'default', label: '默认预设色' },
              { id: 'cyber', label: '🌈 赛博霓光' },
              { id: 'sunset', label: '🌅 落日熔金' },
              { id: 'aurora', label: '🌌 极地极光' },
              { id: 'royal', label: '👑 皇家幻紫' },
              { id: 'dark', label: '🖤 暗夜极客' },
              { id: 'glass', label: '🫧 磨砂毛玻璃' },
            ].map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedColorTheme(theme.id as any)}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  selectedColorTheme === theme.id
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/50 font-bold shadow-xs'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCustomShapePen}
          className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-3 text-left transition-colors hover:border-cyan-300/60 hover:bg-cyan-400/[0.12]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <PenTool size={16} />
            </span>
            <span>
              <span className="block text-xs font-semibold text-white">钢笔绘制自定义形状</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">闭合路径后生成可编辑填充图形，可自由缩放与改色</span>
            </span>
          </span>
          <ArrowRight size={15} className="text-cyan-300" />
        </button>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Highlight Section: 4 Core Base Shapes */}
          {selectedCategory === 'all' && !searchQuery && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                    四大核心基础几何形 (Core Base Shapes)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  圆角矩形 · 正圆形 · 椭圆形 · 等腰梯形
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {coreFourShapes.map((shape) => (
                  <div
                    key={shape.id}
                    onClick={() => handleApply(shape)}
                    onMouseEnter={() => setHoveredShapeId(shape.id)}
                    onMouseLeave={() => setHoveredShapeId(null)}
                    className="group bg-gradient-to-b from-white/[0.08] to-white/[0.02] hover:from-sky-500/20 hover:to-purple-500/10 border border-white/10 hover:border-sky-400/60 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-[9px] font-bold text-sky-300 uppercase">
                      推荐核心
                    </div>

                    <div className="space-y-2">
                      {renderShapeVisual(shape, 'w-full h-28')}

                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors flex items-center gap-1.5">
                          <span>{shape.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {shape.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-sky-300 font-semibold group-hover:text-white">
                      <span>插入画布</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Filtered Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {selectedCategory === 'core' 
                  ? '核心基础几何' 
                  : selectedCategory === 'polygon'
                  ? '多边形与科技形状'
                  : selectedCategory === 'badge'
                  ? '标签与徽章轮廓'
                  : selectedCategory === 'arrow'
                  ? '方向与流程箭头'
                  : '全部图形预设清单'} ({filteredPresets.length})
              </h3>
            </div>

            {filteredPresets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Info size={28} className="mx-auto text-slate-500" />
                <p className="text-sm">未找到与「{searchQuery}」匹配的形状</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="text-xs text-sky-400 hover:underline"
                >
                  清除搜索筛选
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredPresets.map((shape) => (
                  <div
                    key={shape.id}
                    onClick={() => handleApply(shape)}
                    className="group bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-sky-400/50 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-lg"
                  >
                    <div className="space-y-2">
                      {renderShapeVisual(shape, 'w-full h-24')}

                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                            {shape.name}
                          </h4>
                          {shape.isCore && (
                            <span className="text-[9px] px-1 py-0.2 bg-purple-500/20 text-purple-300 rounded font-mono">
                              CORE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                          {shape.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-2.5 w-full py-1.5 bg-white/5 group-hover:bg-sky-500 text-slate-300 group-hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    >
                      <span>一键插入</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">提示:</span>
            <span>插入图形后，可在右侧属性面板随时切换纯色/渐变、调整圆角、边框、投影与内部文字。</span>
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
