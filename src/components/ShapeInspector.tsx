import React, { useState } from 'react';
import { 
  Palette, Sparkles, RefreshCw, Shuffle, ArrowRight, 
  Layers, Square, AlignLeft, AlignCenter, AlignRight, 
  Sliders, Wand2, SunMedium, Eye, Check, Shapes, Circle, Hexagon
} from 'lucide-react';
import { SceneElement } from '../types';
import { TextStyleControls } from './TextStyleControls';
import { FontFamilyPicker } from './FontFamilyPicker';
import { 
  SOLID_COLOR_PRESETS, 
  GRADIENT_PRESETS, 
  BASE_SHAPE_PRESETS,
  ShapePresetItem,
  GradientPreset, 
  ColorPreset,
  getShapeBackground 
} from '../utils/shapeStyles';

interface ShapeInspectorProps {
  element: SceneElement;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void;
}

export const ShapeInspector: React.FC<ShapeInspectorProps> = ({
  element,
  onUpdateElement,
}) => {
  // Determine current active mode
  const currentMode: 'solid' | 'gradient' | 'presets' | 'glass' = 
    element.backgroundType === 'glass' ? 'glass' :
    (element.backgroundType === 'gradient' || element.gradientStart || element.gradientEnd) ? 'gradient' : 'solid';

  const [activeTab, setActiveTab] = useState<'solid' | 'gradient' | 'presets' | 'glass'>(currentMode);
  const [showViaColor, setShowViaColor] = useState<boolean>(!!element.gradientVia);

  // Gradient state helpers
  const gradientStart = element.gradientStart || '#06b6d4';
  const gradientEnd = element.gradientEnd || '#9333ea';
  const gradientVia = element.gradientVia || '#3b82f6';
  const gradientAngle = element.gradientAngle ?? 135;
  const gradientType = element.gradientType || 'linear';

  // Apply Geometric Shape
  const handleApplyGeometry = (shape: ShapePresetItem) => {
    onUpdateElement(element.id, {
      shapeKind: shape.shapeKind,
      borderRadius: shape.borderRadius !== undefined ? shape.borderRadius : 0,
      clipPath: shape.clipPath || undefined,
      shapePath: undefined,
    });
  };

  // Apply Solid Color
  const handleApplySolid = (color: string, textColor?: string, borderColor?: string) => {
    onUpdateElement(element.id, {
      backgroundType: 'solid',
      backgroundColor: color,
      color: color,
      textColor: textColor || element.textColor || '#ffffff',
      borderColor: borderColor || element.borderColor,
      gradientStart: undefined,
      gradientEnd: undefined,
      gradientVia: undefined,
    });
  };

  // Apply Gradient Preset
  const handleApplyPreset = (preset: GradientPreset) => {
    onUpdateElement(element.id, {
      backgroundType: 'gradient',
      gradientType: preset.type,
      gradientAngle: preset.angle ?? 135,
      gradientStart: preset.start,
      gradientVia: preset.via,
      gradientEnd: preset.end,
      textColor: preset.textColor,
      borderColor: preset.borderColor || element.borderColor,
    });
    setShowViaColor(!!preset.via);
  };

  // Invert Gradient Colors
  const handleInvertGradient = () => {
    onUpdateElement(element.id, {
      gradientStart: gradientEnd,
      gradientEnd: gradientStart,
    });
  };

  // Randomize Gradient Colors
  const handleRandomGradient = () => {
    const randomHex = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const angle = angles[Math.floor(Math.random() * angles.length)];
    onUpdateElement(element.id, {
      backgroundType: 'gradient',
      gradientType: 'linear',
      gradientStart: randomHex(),
      gradientEnd: randomHex(),
      gradientVia: undefined,
      gradientAngle: angle,
    });
    setShowViaColor(false);
  };

  // Quick Angle Presets
  const ANGLE_PRESETS = [
    { label: '↘ 135°', angle: 135 },
    { label: '→ 90°', angle: 90 },
    { label: '↓ 180°', angle: 180 },
    { label: '↗ 45°', angle: 45 },
    { label: '↖ 315°', angle: 315 },
    { label: '↑ 0°', angle: 0 },
  ];

  return (
    <div className="border-t border-white/10 pt-3 space-y-3">
      {/* Header & Live Preview */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Palette size={13} className="text-pink-400" />
          <span>矩形卡片与渐变定制</span>
        </span>

        <button
          type="button"
          onClick={handleRandomGradient}
          title="随机生成渐变配色"
          className="flex items-center gap-1 text-[10px] text-pink-300 hover:text-pink-200 bg-pink-500/10 hover:bg-pink-500/20 px-2 py-0.5 rounded border border-pink-500/30 transition-colors"
        >
          <Shuffle size={10} />
          <span>灵感渐变</span>
        </button>
      </div>

      {/* Live Swatch Preview Banner */}
      <div 
        className="w-full h-12 rounded-lg border border-white/15 p-2 flex items-center justify-between shadow-inner relative overflow-hidden transition-all duration-300"
        style={{
          background: getShapeBackground(element),
          borderRadius: element.borderRadius ? `${Math.min(12, element.borderRadius)}px` : '8px',
          clipPath: element.clipPath || undefined,
          boxShadow: element.boxShadow || 'none',
        }}
      >
        <div 
          className="text-xs font-semibold px-2 py-1 rounded bg-black/40 backdrop-blur-xs border border-white/10 flex items-center gap-1.5"
          style={{ color: element.textColor || element.color || '#ffffff' }}
        >
          <Square size={12} />
          <span className="truncate max-w-[170px]">
            {element.content || '卡片样式预览 (Card Preview)'}
          </span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-slate-300 border border-white/10 uppercase">
          {element.shapeKind ? `${element.shapeKind}` : element.backgroundType === 'gradient' ? `${element.gradientType || 'linear'} 渐变` : element.backgroundType === 'glass' ? '毛玻璃' : '纯色'}
        </span>
      </div>

      {/* Geometry Shape Selector Chips (Core Base Shapes) */}
      <div className="space-y-1.5 bg-black/30 p-2 rounded-lg border border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <Shapes size={11} className="text-sky-400" />
            <span>基础图形轮廓 (Shape Geometry)</span>
          </span>
          <span className="text-[9px] text-sky-300 font-mono">
            {element.shapeKind === 'circle' ? '正圆形' : element.shapeKind === 'ellipse' ? '椭圆形' : element.shapeKind === 'trapezoid' ? '等腰梯形' : element.shapeKind === 'inverted-trapezoid' ? '倒梯形' : element.shapeKind === 'hexagon' ? '六边形' : element.shapeKind === 'pill' ? '胶囊形' : element.shapeKind === 'rect' ? '直角矩形' : '圆角矩形'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {BASE_SHAPE_PRESETS.slice(0, 8).map((sp) => {
            const isCurrent = 
              (element.shapeKind && element.shapeKind === sp.shapeKind) ||
              (!element.shapeKind && sp.shapeKind === 'rounded-rect' && !element.clipPath);

            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => handleApplyGeometry(sp)}
                title={`${sp.name}: ${sp.description}`}
                className={`py-1 px-1 rounded text-[10px] font-medium border transition-all flex flex-col items-center gap-0.5 ${
                  isCurrent
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold shadow-xs'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                <span className="text-xs">
                  {sp.shapeKind === 'circle' ? '⭕' : sp.shapeKind === 'ellipse' ? '🥚' : sp.shapeKind === 'trapezoid' ? '⏢' : sp.shapeKind === 'inverted-trapezoid' ? '⚡' : sp.shapeKind === 'pill' ? '💊' : sp.shapeKind === 'hexagon' ? '⬡' : sp.shapeKind === 'rect' ? '⬛' : '🔲'}
                </span>
                <span className="truncate max-w-full text-[9px]">{sp.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fill Mode Switcher Tabs */}
      <div className="grid grid-cols-4 gap-1 p-0.5 bg-black/40 rounded-lg border border-white/10">
        <button
          type="button"
          onClick={() => {
            setActiveTab('solid');
            onUpdateElement(element.id, { backgroundType: 'solid' });
          }}
          className={`py-1 text-[10px] font-medium rounded transition-all ${
            activeTab === 'solid'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          🎨 纯色
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('gradient');
            onUpdateElement(element.id, { 
              backgroundType: 'gradient',
              gradientStart: element.gradientStart || '#06b6d4',
              gradientEnd: element.gradientEnd || '#9333ea',
              gradientAngle: element.gradientAngle ?? 135,
            });
          }}
          className={`py-1 text-[10px] font-medium rounded transition-all ${
            activeTab === 'gradient'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          🌈 渐变
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`py-1 text-[10px] font-medium rounded transition-all ${
            activeTab === 'presets'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          ✨ 预设库
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('glass');
            onUpdateElement(element.id, { 
              backgroundType: 'glass',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              backdropBlur: element.backdropBlur || 16,
              borderColor: element.borderColor || 'rgba(255, 255, 255, 0.25)',
              borderWidth: element.borderWidth || 1,
            });
          }}
          className={`py-1 text-[10px] font-medium rounded transition-all ${
            activeTab === 'glass'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          🫧 毛玻璃
        </button>
      </div>

      {/* ================= TAB 1: SOLID COLOR ================= */}
      {activeTab === 'solid' && (
        <div className="space-y-2.5 bg-black/20 p-2.5 rounded-lg border border-white/10">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">主背景色 (Background Color)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={element.backgroundColor?.startsWith('#') ? element.backgroundColor : '#1e293b'}
                onChange={(e) => handleApplySolid(e.target.value)}
                className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={element.backgroundColor || element.color || 'rgba(30, 41, 59, 0.85)'}
                onChange={(e) => handleApplySolid(e.target.value)}
                placeholder="#1e293b 或 rgba(...)"
                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Quick Palette Chips */}
          <div>
            <span className="block text-[10px] text-slate-400 mb-1.5">经典卡片纯色推荐</span>
            <div className="grid grid-cols-7 gap-1.5">
              {SOLID_COLOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplySolid(p.color, p.textColor, p.borderColor)}
                  title={`${p.name} (${p.color})`}
                  className={`h-6 rounded border transition-transform hover:scale-110 flex items-center justify-center ${
                    (element.backgroundColor === p.color || element.color === p.color)
                      ? 'border-white ring-2 ring-pink-500 ring-offset-1 ring-offset-black scale-105'
                      : 'border-white/20'
                  }`}
                  style={{ backgroundColor: p.color }}
                >
                  {(element.backgroundColor === p.color || element.color === p.color) && (
                    <Check size={11} style={{ color: p.textColor }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CUSTOM GRADIENT ================= */}
      {activeTab === 'gradient' && (
        <div className="space-y-3 bg-black/20 p-2.5 rounded-lg border border-white/10">
          {/* Gradient Type (Linear vs Radial) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">渐变形态</label>
              <select
                value={gradientType}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'gradient',
                  gradientType: e.target.value as 'linear' | 'radial' 
                })}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
              >
                <option value="linear">📐 线性渐变 (Linear)</option>
                <option value="radial">🎯 径向渐变 (Radial)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400">渐变角度</label>
                <span className="text-[10px] font-mono text-pink-300 font-bold">{gradientAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                disabled={gradientType === 'radial'}
                value={gradientAngle}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'gradient',
                  gradientAngle: parseInt(e.target.value) || 0 
                })}
                className="w-full accent-pink-500 disabled:opacity-30"
              />
            </div>
          </div>

          {/* Quick Angle Chips */}
          {gradientType === 'linear' && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {ANGLE_PRESETS.map((p) => (
                <button
                  key={p.angle}
                  type="button"
                  onClick={() => onUpdateElement(element.id, { 
                    backgroundType: 'gradient',
                    gradientAngle: p.angle 
                  })}
                  className={`px-1.5 py-0.5 text-[10px] rounded border font-mono transition-colors shrink-0 ${
                    gradientAngle === p.angle
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/50 font-bold'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Color Stops Controls */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">渐变色标控制 (Color Stops)</span>
              <button
                type="button"
                onClick={handleInvertGradient}
                title="翻转起止颜色"
                className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
              >
                <RefreshCw size={10} />
                <span>翻转颜色</span>
              </button>
            </div>

            {/* Stop 1: Start Color */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-14">起始颜色:</span>
              <input
                type="color"
                value={gradientStart.startsWith('#') ? gradientStart : '#06b6d4'}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'gradient',
                  gradientStart: e.target.value 
                })}
                className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={gradientStart}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'gradient',
                  gradientStart: e.target.value 
                })}
                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none"
              />
            </div>

            {/* Optional Stop 2: Via Color */}
            {showViaColor ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-14">过渡中间:</span>
                <input
                  type="color"
                  value={gradientVia.startsWith('#') ? gradientVia : '#3b82f6'}
                  onChange={(e) => onUpdateElement(element.id, { 
                    backgroundType: 'gradient',
                    gradientVia: e.target.value 
                  })}
                  className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={gradientVia}
                  onChange={(e) => onUpdateElement(element.id, { 
                    backgroundType: 'gradient',
                    gradientVia: e.target.value 
                  })}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowViaColor(false);
                    onUpdateElement(element.id, { gradientVia: undefined });
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 px-1 py-1"
                  title="移除中间色"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowViaColor(true);
                  onUpdateElement(element.id, { gradientVia: '#3b82f6' });
                }}
                className="w-full py-1 text-[10px] text-slate-400 hover:text-sky-300 border border-dashed border-white/15 hover:border-sky-500/40 rounded transition-colors"
              >
                + 添加三色渐变中间过渡 (Via Color)
              </button>
            )}

            {/* Stop 3: End Color */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-14">终止颜色:</span>
              <input
                type="color"
                value={gradientEnd.startsWith('#') ? gradientEnd : '#9333ea'}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'gradient',
                  gradientEnd: e.target.value 
                })}
                className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={gradientEnd}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'gradient',
                  gradientEnd: e.target.value 
                })}
                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: PRESET GRADIENT GALLERY ================= */}
      {activeTab === 'presets' && (
        <div className="space-y-2 bg-black/20 p-2.5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">精选顶级视觉渐变卡片 (点击应用)</span>
            <span className="text-[9px] text-slate-500 font-mono">{GRADIENT_PRESETS.length} 款预设</span>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {GRADIENT_PRESETS.map((p) => {
              const isSelected = 
                element.backgroundType === 'gradient' && 
                element.gradientStart === p.start && 
                element.gradientEnd === p.end;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`group text-left p-2 rounded-lg border transition-all duration-200 relative overflow-hidden ${
                    isSelected
                      ? 'border-pink-400 ring-2 ring-pink-500/50 shadow-md scale-[1.02]'
                      : 'border-white/10 hover:border-white/30 hover:scale-[1.01]'
                  }`}
                  style={{ background: p.css }}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors pointer-events-none" />
                  <div className="relative z-10 flex flex-col justify-between h-10">
                    <span 
                      className="text-[10px] font-bold drop-shadow-xs line-clamp-1"
                      style={{ color: p.textColor }}
                    >
                      {p.name}
                    </span>
                    <div className="flex items-center justify-between text-[8px] opacity-85" style={{ color: p.textColor }}>
                      <span>{p.type === 'radial' ? '径向' : `${p.angle}° 线性`}</span>
                      {isSelected && <Check size={11} className="text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 4: GLASSMORPHISM ================= */}
      {activeTab === 'glass' && (
        <div className="space-y-2.5 bg-black/20 p-2.5 rounded-lg border border-white/10">
          <div className="text-[10px] text-slate-400">
            高透毛玻璃卡片质感，自动与背景融合并产生高级虚化折射。
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">玻璃底色色相与透明度</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value="#ffffff"
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'glass',
                  backgroundColor: `${e.target.value}22` 
                })}
                className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={element.backgroundColor || 'rgba(255, 255, 255, 0.12)'}
                onChange={(e) => onUpdateElement(element.id, { 
                  backgroundType: 'glass',
                  backgroundColor: e.target.value 
                })}
                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400">背景模糊度 (Backdrop Blur)</label>
              <span className="text-[10px] font-mono text-pink-300">{element.backdropBlur || 16}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={element.backdropBlur || 16}
              onChange={(e) => onUpdateElement(element.id, { backdropBlur: parseInt(e.target.value) || 0 })}
              className="w-full accent-pink-500"
            />
          </div>
        </div>
      )}

      {/* ================= CARD TEXT & CONTENT ================= */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
          <AlignLeft size={11} className="text-sky-400" />
          <span>卡片文字与排版 (CARD TEXT)</span>
        </span>

        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">文字内容 (可双击画布卡片直接输入)</label>
          <textarea
            value={element.content || ''}
            placeholder="输入卡片文字内容 (支持换行)..."
            rows={2}
            onChange={(e) => onUpdateElement(element.id, { content: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white outline-none focus:border-pink-500"
          />
        </div>

        <TextStyleControls
          element={element}
          onUpdateElement={onUpdateElement}
          colorField="textColor"
          paddingField="shapePadding"
          defaultLineHeight={1.1}
        />

        {false && <>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">文字颜色</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={element.textColor?.startsWith('#') ? element.textColor : (element.color?.startsWith('#') ? element.color : '#ffffff')}
                onChange={(e) => onUpdateElement(element.id, { textColor: e.target.value })}
                className="w-7 h-7 bg-transparent border border-white/20 rounded cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={element.textColor || element.color || '#ffffff'}
                onChange={(e) => onUpdateElement(element.id, { textColor: e.target.value })}
                className="flex-1 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">字号 (px)</label>
            <input
              type="number"
              min="10"
              max="100"
              value={element.fontSize || 16}
              onChange={(e) => onUpdateElement(element.id, { fontSize: parseInt(e.target.value) || 16 })}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5 rounded border border-sky-400/15 bg-sky-950/10 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 text-[10px] text-slate-400">
              <span className="mb-0.5 block">字体</span>
              <FontFamilyPicker value={element.fontFamily} onChange={(fontFamily) => onUpdateElement(element.id, { fontFamily })} placeholder="默认字体" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-slate-400"><span className="mb-0.5 block">字间距 (px)</span><input type="number" min="-20" max="80" step="0.5" value={element.letterSpacing ?? 0} onChange={(e) => onUpdateElement(element.id, { letterSpacing: Number(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /></label>
            <label className="text-[10px] text-slate-400"><span className="mb-0.5 block">行间距</span><input type="number" min="0.6" max="4" step="0.05" value={element.lineHeight ?? 1.1} onChange={(e) => onUpdateElement(element.id, { lineHeight: Math.max(0.6, Number(e.target.value) || 1.1) })} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono" /></label>
          </div>
          <label className="block text-[10px] text-slate-400"><span className="mb-0.5 flex justify-between"><span>文字不透明度</span><span>{element.textOpacity ?? 100}%</span></span><input type="range" min="0" max="100" value={element.textOpacity ?? 100} onChange={(e) => onUpdateElement(element.id, { textOpacity: Number(e.target.value) })} className="w-full accent-sky-500" /></label>
          <div className="flex gap-1 rounded border border-white/10 bg-black/30 p-0.5" aria-label="文字样式">
            <button type="button" title="粗体" onClick={() => onUpdateElement(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`h-6 flex-1 rounded text-xs font-bold ${element.fontWeight === 'bold' || !element.fontWeight ? 'bg-sky-500/25 text-white' : 'text-slate-400'}`}>B</button>
            <button type="button" title="斜体" onClick={() => onUpdateElement(element.id, { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`h-6 flex-1 rounded text-xs italic ${element.fontStyle === 'italic' ? 'bg-sky-500/25 text-white' : 'text-slate-400'}`}>I</button>
            <button type="button" title="下划线" onClick={() => onUpdateElement(element.id, { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })} className={`h-6 flex-1 rounded text-xs underline ${element.textDecoration === 'underline' ? 'bg-sky-500/25 text-white' : 'text-slate-400'}`}>U</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded border border-cyan-400/15 bg-black/20 p-1.5 text-[10px] text-slate-300"><span className="flex justify-between">发光<input type="checkbox" checked={element.textGlowEnabled || false} onChange={(e) => onUpdateElement(element.id, { textGlowEnabled: e.target.checked })} className="accent-cyan-400" /></span>{element.textGlowEnabled && <><input type="color" value={element.textGlowColor || element.textColor || '#ffffff'} onChange={(e) => onUpdateElement(element.id, { textGlowColor: e.target.value })} className="mt-1 h-6 w-full" /><input type="number" min="0" max="120" value={element.textGlowBlur ?? 24} onChange={(e) => onUpdateElement(element.id, { textGlowBlur: Number(e.target.value) || 0 })} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white" /></>}</label>
            <label className="rounded border border-white/10 bg-black/20 p-1.5 text-[10px] text-slate-300"><span className="flex justify-between">阴影<input type="checkbox" checked={element.textShadowEnabled || false} onChange={(e) => onUpdateElement(element.id, { textShadowEnabled: e.target.checked })} className="accent-sky-500" /></span>{element.textShadowEnabled && <><input type="color" value={element.textShadowColor || '#000000'} onChange={(e) => onUpdateElement(element.id, { textShadowColor: e.target.value })} className="mt-1 h-6 w-full" /><div className="mt-1 grid grid-cols-2 gap-1"><input type="number" min="0" max="120" value={element.textShadowBlur ?? 8} onChange={(e) => onUpdateElement(element.id, { textShadowBlur: Number(e.target.value) || 0 })} className="min-w-0 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white" /><input type="number" min="0" max="100" value={element.textShadowDistance ?? 4} onChange={(e) => onUpdateElement(element.id, { textShadowDistance: Number(e.target.value) || 0 })} className="min-w-0 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white" /></div></>}</label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">对齐方式</label>
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
              <button
                type="button"
                onClick={() => onUpdateElement(element.id, { textAlign: 'left' })}
                className={`flex-1 py-0.5 rounded flex items-center justify-center ${
                  (element.textAlign || 'center') === 'left' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlignLeft size={12} />
              </button>
              <button
                type="button"
                onClick={() => onUpdateElement(element.id, { textAlign: 'center' })}
                className={`flex-1 py-0.5 rounded flex items-center justify-center ${
                  (element.textAlign || 'center') === 'center' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlignCenter size={12} />
              </button>
              <button
                type="button"
                onClick={() => onUpdateElement(element.id, { textAlign: 'right' })}
                className={`flex-1 py-0.5 rounded flex items-center justify-center ${
                  (element.textAlign || 'center') === 'right' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlignRight size={12} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">内边距 Padding (px)</label>
            <input
              type="number"
              min="0"
              max="60"
              value={element.shapePadding !== undefined ? element.shapePadding : 12}
              onChange={(e) => onUpdateElement(element.id, { shapePadding: parseInt(e.target.value) || 0 })}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
        </div>
        </>}
      </div>

      {/* ================= BORDER, RADIUS & SHADOW ================= */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
          <Layers size={11} className="text-emerald-400" />
          <span>边框与圆角 (BORDER & RADIUS)</span>
        </span>

        {/* Quick Radius Presets */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-400">圆角弧度</label>
            <span className="text-[10px] font-mono text-emerald-300">{element.borderRadius || 0}px</span>
          </div>
          <div className="flex items-center gap-1 mb-1.5">
            {[0, 8, 16, 24, 9999].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onUpdateElement(element.id, { borderRadius: r })}
                className={`flex-1 py-0.5 text-[10px] rounded border transition-colors ${
                  (element.borderRadius || 0) === r
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {r === 0 ? '直角 0' : r === 9999 ? '胶囊 Pill' : `${r}px`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="60"
            value={element.borderRadius || 0}
            onChange={(e) => onUpdateElement(element.id, { borderRadius: parseInt(e.target.value) || 0 })}
            className="w-full accent-emerald-500"
          />
        </div>

        {/* Border Width & Color */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">边框宽度 (px)</label>
            <input
              type="number"
              min="0"
              max="20"
              value={element.borderWidth || 0}
              onChange={(e) => onUpdateElement(element.id, { borderWidth: parseInt(e.target.value) || 0 })}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">边框颜色</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={element.borderColor?.startsWith('#') ? element.borderColor : '#ffffff'}
                onChange={(e) => onUpdateElement(element.id, { borderColor: e.target.value })}
                className="w-7 h-7 bg-transparent border border-white/20 rounded cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={element.borderColor || 'rgba(255, 255, 255, 0.2)'}
                onChange={(e) => onUpdateElement(element.id, { borderColor: e.target.value })}
                className="flex-1 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs font-mono text-white"
              />
            </div>
          </div>
        </div>

        {/* Box Shadow / Card Elevation Presets */}
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">立体投影与光晕效果</label>
          <select
            value={element.boxShadow || 'none'}
            onChange={(e) => onUpdateElement(element.id, { boxShadow: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
          >
            <option value="none">无阴影 (Flat)</option>
            <option value="0 8px 24px rgba(0, 0, 0, 0.35)">🌫️ 柔和立体悬浮 (Soft Elevation)</option>
            <option value="0 16px 36px rgba(0, 0, 0, 0.6)">🪐 深度立体投影 (Deep Shadow)</option>
            <option value="0 0 25px rgba(6, 182, 212, 0.5)">💠 霓虹青光晕 (Cyber Glow)</option>
            <option value="0 0 25px rgba(236, 72, 153, 0.5)">🌸 幻彩洋红光晕 (Magenta Glow)</option>
            <option value="0 0 30px rgba(147, 51, 234, 0.55)">🔮 极光紫霓虹 (Purple Glow)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
