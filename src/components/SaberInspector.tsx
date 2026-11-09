import React from 'react';
import { 
  Zap, Flame, Play, Activity, Sparkles, Sliders, 
  RotateCcw, Compass, Scissors, Eye, Layers, Shield,
  PenTool, CircleDot, Disc, Box, SunMedium, MoreHorizontal, ChevronLeft, ChevronRight, Copy, ClipboardPaste
} from 'lucide-react';
import { SceneElement } from '../types';
import { 
  SABER_SHAPE_PRESETS, 
  SABER_EFFECT_STYLES,
  SABER_STYLE_THEMES, 
  SaberStyleTheme 
} from '../utils/saberPresets';
import { SaberEffectPreview } from './SaberEffectPreview';
import { copyKeyframe, evaluateAnimatedProperty, getKeyframeAt, getNeighborKeyframe, getPropertyTrack, hasKeyframeClipboard, pasteKeyframe, removeKeyframe, setKeyframeEasing, upsertKeyframe, type KeyframeEasing, type KeyframeProperty } from '../core/animation/keyframes';

interface SaberInspectorProps {
  element: SceneElement;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void;
  onOpenDrawMode?: () => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

const SaberAnimatedNumber: React.FC<{
  element: SceneElement;
  property: KeyframeProperty;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  currentTime: number;
  onSeek?: (time: number) => void;
  onUpdateElement: (id: string, patch: Partial<SceneElement>) => void;
}> = ({ element, property, label, value, min, max, step, unit, currentTime, onSeek, onUpdateElement }) => {
  const track = getPropertyTrack(element, property);
  const activeFrame = getKeyframeAt(track, currentTime);
  const [clipboardTick, setClipboardTick] = React.useState(0);
  const commit = (next: ReturnType<typeof upsertKeyframe>) => onUpdateElement(element.id, { keyframes: next });
  const toggle = () => commit(activeFrame ? removeKeyframe(element, property, currentTime) : upsertKeyframe(element, property, currentTime, value));
  const jump = (direction: -1 | 1) => { const frame = getNeighborKeyframe(track, currentTime, direction); if (frame) onSeek?.(frame.time); };
  const canPaste = clipboardTick >= 0 && hasKeyframeClipboard(property);
  return <div className="space-y-1.5" data-animated-property={property}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="font-mono text-[10px] font-bold text-cyan-300">{value.toFixed(step < 1 ? 2 : 1)} {unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => {
      const nextValue = Number(event.target.value);
      const patch: Partial<SceneElement> = { [property]: nextValue } as Partial<SceneElement>;
      const next = getPropertyTrack(element, property) ? upsertKeyframe(element, property, currentTime, nextValue) : undefined;
      onUpdateElement(element.id, next ? { ...patch, keyframes: next } : patch);
    }} className="w-full cursor-pointer accent-cyan-400" aria-label={label} />
    <div className="flex items-center justify-end gap-0.5 text-slate-500" aria-label={`${label}关键帧控制`}>
      <button type="button" className={`grid h-7 w-7 place-items-center rounded-md ${activeFrame ? 'text-cyan-300' : 'hover:bg-white/10'}`} onClick={toggle} aria-label={activeFrame ? '删除关键帧' : '添加关键帧'} title={activeFrame ? '删除关键帧' : '添加关键帧'}>◆</button>
      <details className="relative">
        <summary className="grid h-7 w-6 cursor-pointer list-none place-items-center rounded-md hover:bg-white/10" aria-label="更多关键帧操作" title="更多关键帧操作"><MoreHorizontal size={14} /></summary>
        <div className="absolute right-0 top-8 z-30 min-w-[150px] rounded-md border border-white/10 bg-[#1b1e27] p-1.5 shadow-xl">
          <div className="flex items-center gap-1">
            <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={() => jump(-1)} disabled={!getNeighborKeyframe(track, currentTime, -1)} title="上一关键帧"><ChevronLeft size={13} /></button>
            <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={() => jump(1)} disabled={!getNeighborKeyframe(track, currentTime, 1)} title="下一关键帧"><ChevronRight size={13} /></button>
            <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" disabled={!activeFrame} onClick={() => { if (activeFrame) { copyKeyframe(activeFrame, property); setClipboardTick((tick) => tick + 1); } }} title="复制关键帧"><Copy size={12} /></button>
            <button type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 disabled:opacity-25" disabled={!canPaste} onClick={() => { const next = pasteKeyframe(element, property, currentTime); if (next) commit(next); }} title="粘贴关键帧"><ClipboardPaste size={12} /></button>
          </div>
          {activeFrame && <select value={activeFrame.easing || 'ease-in-out'} onChange={(event) => onUpdateElement(element.id, { keyframes: setKeyframeEasing(element, property, activeFrame.id, event.target.value as KeyframeEasing) })} className="mt-1 h-6 w-full rounded border border-white/10 bg-black/30 px-1 text-[10px] text-slate-300" aria-label="关键帧缓动"><option value="linear">线性</option><option value="ease-in">缓入</option><option value="ease-out">缓出</option><option value="ease-in-out">缓入缓出</option><option value="hold">保持</option></select>}
        </div>
      </details>
      {/* Detailed controls stay available from the compact menu above. */}
      {false && (<>
      <button type="button" className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={() => jump(-1)} disabled={!getNeighborKeyframe(track, currentTime, -1)} aria-label="上一关键帧" title="上一关键帧">‹</button>
      <button type="button" className={`grid h-5 w-5 place-items-center rounded ${activeFrame ? 'text-cyan-300' : 'hover:bg-white/10'}`} onClick={toggle} aria-label={activeFrame ? '删除关键帧' : '添加关键帧'} title={activeFrame ? '删除关键帧' : '添加关键帧'}>◇</button>
      <button type="button" className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 disabled:opacity-25" onClick={() => jump(1)} disabled={!getNeighborKeyframe(track, currentTime, 1)} aria-label="下一关键帧" title="下一关键帧">›</button>
      <button type="button" className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 disabled:opacity-25" disabled={!activeFrame} onClick={() => { if (activeFrame) { copyKeyframe(activeFrame, property); setClipboardTick((tick) => tick + 1); } }} aria-label="复制关键帧" title="复制关键帧">⧉</button>
      <button type="button" className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 disabled:opacity-25" disabled={!canPaste} onClick={() => { const next = pasteKeyframe(element, property, currentTime); if (next) commit(next); }} aria-label="粘贴关键帧" title="粘贴关键帧">↳</button>
      {activeFrame && <select value={activeFrame.easing || 'ease-in-out'} onChange={(event) => onUpdateElement(element.id, { keyframes: setKeyframeEasing(element, property, activeFrame.id, event.target.value as KeyframeEasing) })} className="h-5 max-w-[62px] rounded border border-white/10 bg-black/30 px-0.5 text-[9px] text-slate-300" aria-label="关键帧缓动"><option value="linear">线性</option><option value="ease-in">缓入</option><option value="ease-out">缓出</option><option value="ease-in-out">缓入缓出</option><option value="hold">保持</option></select>}
      </>)}
    </div>
  </div>;
};

export const SaberInspector: React.FC<SaberInspectorProps> = ({
  element,
  onUpdateElement,
  onOpenDrawMode,
  currentTime = 0,
  onSeek,
}) => {
  const currentThemeId = element.saberPreset || 'neon';
  const currentGrowthMode = element.saberGrowthMode || 'grow-in';
  const currentEffectType = element.saberEffectType || 'standard';

  // Apply a style preset
  const handleApplyTheme = (theme: SaberStyleTheme) => {
    onUpdateElement(element.id, {
      saberPreset: theme.id,
      saberGlowColor: theme.glowColor,
      saberSecondaryGlowColor: theme.secondaryGlowColor || theme.glowColor,
      saberCoreColor: theme.coreColor,
      saberCoreWidth: theme.coreWidth,
      saberGlowIntensity: theme.glowIntensity,
      saberGlowSpread: theme.glowSpread,
      saberFlickerIntensity: theme.flickerIntensity,
      blendMode: theme.blendMode,
    });
  };

  // Switch to a preset shape
  const handleSelectShape = (shapeId: string) => {
    const shape = SABER_SHAPE_PRESETS.find((s) => s.id === shapeId);
    if (!shape) return;
    onUpdateElement(element.id, {
      saberPath: shape.path,
      saberShapeName: shape.name,
      saberPathType: 'preset',
      sourceName: `Saber: ${shape.name}`,
      saberCoreWidth: shape.defaultCoreWidth || element.saberCoreWidth || 1,
      saberGlowSpread: shape.defaultGlowSpread || element.saberGlowSpread || 18,
    });
  };

  return (
    <div className="border-t border-white/10 pt-3 space-y-4 text-xs text-slate-300 select-none">
      
      {/* Header Badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap size={13} className="text-cyan-400 animate-pulse" />
          <span>AE Saber 极光引擎</span>
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono flex items-center gap-1">
          {element.saberPathType === 'pen' ? (
            <><PenTool size={10} /> 钢笔矢量路径</>
          ) : (
            <><Shield size={10} /> 几何预设形状</>
          )}
        </span>
      </div>

      {/* 1. Quick Color & Style Themes */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
          <Flame size={12} className="text-amber-400" />
          <span>光效风格主题 (Style Themes)</span>
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          {SABER_STYLE_THEMES.map((theme) => {
            const isSelected = currentThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleApplyTheme(theme)}
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-white/15 border-cyan-400 text-white ring-1 ring-cyan-400/40 shadow-xs font-semibold'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-slate-300'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: theme.glowColor, boxShadow: `0 0 6px ${theme.glowColor}` }}
                />
                <span className="text-[11px] truncate">{theme.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Shape Preset Selector & Bezier Pen Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
            <Box size={12} className="text-sky-400" />
            <span>几何形状与路径 (Shape & Path)</span>
          </label>
          {onOpenDrawMode && (
            <button
              type="button"
              onClick={onOpenDrawMode}
              className="text-[10px] text-cyan-300 hover:text-cyan-100 flex items-center gap-1 bg-cyan-500/15 hover:bg-cyan-500/25 px-2 py-0.5 rounded border border-cyan-500/40 transition-all font-medium cursor-pointer"
            >
              <PenTool size={11} />
              <span>钢笔绘制 (P)</span>
            </button>
          )}
        </div>

        <select
          value={element.saberPathType === 'pen' ? 'custom_pen' : (SABER_SHAPE_PRESETS.find(s => s.path === element.saberPath)?.id || 'geo_rect')}
          onChange={(e) => {
            if (e.target.value !== 'custom_pen') {
              handleSelectShape(e.target.value);
            }
          }}
          className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400 cursor-pointer"
        >
          {element.saberPathType === 'pen' && (
            <option value="custom_pen">🖊️ 钢笔贝塞尔矢量路径 (当前自定义)</option>
          )}
          <optgroup label="基础几何形状 (Geometric Primitives)">
            {SABER_SHAPE_PRESETS.filter(s => s.category === 'geometric').map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="3D透视线框 (3D Wireframe)">
            {SABER_SHAPE_PRESETS.filter(s => s.category === '3d_wireframe').map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="科幻HUD与仪表 (Cyber HUD)">
            {SABER_SHAPE_PRESETS.filter(s => s.category === 'cyber_hud').map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="能量光束与图腾 (Beams & Symbols)">
            {SABER_SHAPE_PRESETS.filter(s => s.category === 'laser_beam' || s.category === 'symbol').map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* 3. Pen Light Profile */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
          <Activity size={12} className="text-fuchsia-400" />
          <span>钢笔光线类型 (Light Profile)</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {SABER_EFFECT_STYLES.map((style) => {
            const isSelected = currentEffectType === style.id;
            return (
              <button
                key={style.id}
                type="button"
                title={style.description}
                onClick={() => onUpdateElement(element.id, { saberEffectType: style.id })}
                className={`px-2 py-1.5 rounded-md border text-left transition-colors ${
                  isSelected
                    ? 'border-fuchsia-400/80 bg-fuchsia-500/15 text-fuchsia-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                }`}
              >
                <SaberEffectPreview
                  effectType={style.id}
                  glowColor={element.saberGlowColor || '#f3ca7e'}
                  secondaryColor={element.saberSecondaryGlowColor || '#925216'}
                  coreColor={element.saberCoreColor || '#ffffff'}
                  coreWidth={element.saberCoreWidth ?? 1}
                  glowSpread={element.saberGlowSpread ?? 18}
                  animated
                  className="w-full h-9 mb-1 rounded bg-black/30"
                />
                <span className="block text-[10px] font-semibold">{style.name}</span>
                <span className="block mt-0.5 text-[9px] text-slate-500 truncate">{style.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Core Optics & Aesthetic Detail Controls */}
      <div className="space-y-3 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={12} className="text-cyan-400" />
          <span>光学审美细节调节 (Aesthetic & Optics)</span>
        </span>

        {/* Color Matrix: Primary Glow, Secondary Dispersion, Core */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">主波段光晕 (Primary Glow)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={element.saberGlowColor || '#f3ca7e'}
                  onChange={(e) => onUpdateElement(element.id, { saberGlowColor: e.target.value })}
                  className="w-7 h-7 bg-transparent border border-white/20 rounded cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={element.saberGlowColor || '#f3ca7e'}
                  onChange={(e) => onUpdateElement(element.id, { saberGlowColor: e.target.value })}
                  className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">色散辅光晕 (Secondary/Ambient)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={element.saberSecondaryGlowColor || '#925216'}
                  onChange={(e) => onUpdateElement(element.id, { saberSecondaryGlowColor: e.target.value })}
                  className="w-7 h-7 bg-transparent border border-white/20 rounded cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={element.saberSecondaryGlowColor || '#925216'}
                  onChange={(e) => onUpdateElement(element.id, { saberSecondaryGlowColor: e.target.value })}
                  className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">内部白热光芯 (Core Laser)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={element.saberCoreColor || '#fffff5'}
                onChange={(e) => onUpdateElement(element.id, { saberCoreColor: e.target.value })}
                className="w-7 h-7 bg-transparent border border-white/20 rounded cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={element.saberCoreColor || '#fffff5'}
                onChange={(e) => onUpdateElement(element.id, { saberCoreColor: e.target.value })}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs font-mono text-white"
              />
            </div>
          </div>
        </div>

        {/* Core Thickness (光芯粗细) & Glow Spread (光晕羽化) */}
        <div className="space-y-2">
          <SaberAnimatedNumber element={element} property="saberCoreWidth" label="光芯粗细 (Core Thickness)" value={evaluateAnimatedProperty(element, 'saberCoreWidth', currentTime, element.saberCoreWidth ?? 1)} min={0.1} max={30} step={0.05} unit="px" currentTime={currentTime} onSeek={onSeek} onUpdateElement={onUpdateElement} />
          <SaberAnimatedNumber element={element} property="saberGlowSpread" label="光晕羽化扩散 (Glow Spread)" value={evaluateAnimatedProperty(element, 'saberGlowSpread', currentTime, element.saberGlowSpread ?? 18)} min={2} max={100} step={1} unit="px" currentTime={currentTime} onSeek={onSeek} onUpdateElement={onUpdateElement} />
          <SaberAnimatedNumber element={element} property="saberGlowIntensity" label="辉光强度倍率 (Intensity)" value={evaluateAnimatedProperty(element, 'saberGlowIntensity', currentTime, element.saberGlowIntensity ?? 1.4)} min={0.2} max={5} step={0.1} unit="x" currentTime={currentTime} onSeek={onSeek} onUpdateElement={onUpdateElement} />
        </div>

        <div className="pt-2 border-t border-white/5 space-y-2">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-[10px] text-slate-300">发光虚线</span>
            <input
              type="checkbox"
              checked={element.saberDashed === true}
              onChange={(e) => onUpdateElement(element.id, { saberDashed: e.target.checked })}
              className="h-4 w-4 accent-cyan-400 cursor-pointer"
              aria-label="启用发光虚线"
            />
          </label>
          {element.saberDashed === true && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[10px] text-slate-400">段长 {element.saberDashLength ?? 8}</span>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={element.saberDashLength ?? 8}
                  onChange={(e) => onUpdateElement(element.id, { saberDashLength: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] text-slate-400">间隔 {element.saberDashGap ?? 6}</span>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={element.saberDashGap ?? 6}
                  onChange={(e) => onUpdateElement(element.id, { saberDashGap: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* Taper & cap controls: custom controls keep the visual language consistent. */}
        <div className="space-y-2.5 pt-2 border-t border-white/5">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-300">首尾渐细 <span className="text-slate-600">Taper</span></span>
              <span className="text-[9px] text-cyan-300/80">开放路径生效</span>
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-black/25 p-1 shadow-inner shadow-black/30">
              {([
                ['both', '双端', '◀━▶'],
                ['start', '头部', '◀━━'],
                ['end', '尾部', '━━▶'],
                ['none', '等宽', '━━━━'],
              ] as const).map(([value, label, glyph]) => {
                const active = (element.saberTaper || 'both') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onUpdateElement(element.id, { saberTaper: value })}
                    aria-pressed={active}
                    title={`${label}渐细`}
                    className={`group flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 transition-all duration-150 ${active
                      ? 'border-cyan-300/45 bg-cyan-400/[0.14] text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.14)]'
                      : 'border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200'}`}
                  >
                    <span className="font-mono text-[11px] tracking-[-0.16em]">{glyph}</span>
                    <span className="mt-0.5 text-[9px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-300">端点样式 <span className="text-slate-600">Cap</span></span>
              <span className="text-[9px] text-slate-500">影响光线末端轮廓</span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/25 p-1 shadow-inner shadow-black/30">
              {([
                ['round', '圆头'],
                ['butt', '平头'],
                ['square', '方头'],
              ] as const).map(([value, label]) => {
                const active = (element.saberCapStyle || 'round') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onUpdateElement(element.id, { saberCapStyle: value })}
                    aria-pressed={active}
                    title={label}
                    className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 transition-all duration-150 ${active
                      ? 'border-violet-300/40 bg-violet-400/[0.13] text-violet-100 shadow-[0_0_14px_rgba(167,139,250,0.13)]'
                      : 'border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200'}`}
                  >
                    <span className="mb-1 flex h-2.5 w-10 items-center justify-center">
                      <span className={`block h-[3px] w-7 bg-current ${value === 'round' ? 'rounded-full' : value === 'square' ? 'rounded-[1px]' : ''}`} />
                    </span>
                    <span className="text-[9px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Endpoint feathering controls the lengthwise brightness decay as well as blur. */}
        <div className="pt-2 border-t border-white/5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-medium text-slate-300">光晕羽化 <span className="text-slate-600">Falloff</span></span>
            <span className="text-[9px] text-cyan-300/80">沿路径连续衰减</span>
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-black/25 p-1 shadow-inner shadow-black/30">
            {([
              ['sharp', '锐利'],
              ['normal', '标准'],
              ['soft', '柔和'],
              ['dreamy', '梦幻'],
            ] as const).map(([value, label]) => {
              const active = (element.saberGlowFalloff || 'normal') === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdateElement(element.id, { saberGlowFalloff: value })}
                  aria-pressed={active}
                  title={`${label}羽化`}
                  className={`flex min-h-10 flex-col items-center justify-center rounded-lg border px-1 transition-all duration-150 ${active
                    ? 'border-amber-300/45 bg-amber-300/[0.12] text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.12)]'
                    : 'border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200'}`}
                >
                  <span className={`mb-1 block h-[3px] w-8 bg-current ${value === 'sharp' ? '' : value === 'normal' ? 'opacity-80 blur-[0.2px]' : value === 'soft' ? 'opacity-60 blur-[1px]' : 'opacity-45 blur-[2px]'}`} />
                  <span className="text-[9px] font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Energy Jitter / Flicker */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">电弧能量高频跳动 (Flicker)</span>
            <span className="text-[10px] font-mono text-amber-300">{element.saberFlickerIntensity ?? 0}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={element.saberFlickerIntensity ?? 0}
            onChange={(e) => onUpdateElement(element.id, { saberFlickerIntensity: parseInt(e.target.value) || 0 })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>
      </div>

      {/* 4. Growth & Flow Motion Parameters (AE Saber Growth / Trim) */}
      <div className="space-y-3 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Play size={12} className="text-emerald-400" />
          <span>生长与流动动效 (Growth & Trim)</span>
        </span>

        {/* Growth Mode */}
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">生长模式 (Growth Mode)</label>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'grow-in', label: '从头生长' },
              { id: 'cycle-flow', label: '循环流光' },
              { id: 'pulse-grow', label: '呼吸律动' },
              { id: 'meteor-shoot', label: '流星飞掠' },
              { id: 'none', label: '静态高光' },
            ].map((m) => {
              const isSelected = currentGrowthMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateElement(element.id, { saberGrowthMode: m.id as any })}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start & End Trim / Offset */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400">起始修剪 (Start Trim)</span>
              <span className="text-[10px] font-mono text-cyan-300">{element.saberStartOffset ?? 0}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={element.saberStartOffset ?? 0}
              onChange={(e) => onUpdateElement(element.id, { saberStartOffset: parseInt(e.target.value) || 0 })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400">结束修剪 (End Trim)</span>
              <span className="text-[10px] font-mono text-cyan-300">{element.saberEndOffset ?? 100}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={element.saberEndOffset ?? 100}
              onChange={(e) => onUpdateElement(element.id, { saberEndOffset: parseInt(e.target.value) || 0 })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Speed */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">流光速度倍率</span>
            <span className="text-[10px] font-mono text-cyan-300">{element.saberGrowthSpeed ?? 1.0}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="4.0"
            step="0.1"
            value={element.saberGrowthSpeed ?? 1.0}
            onChange={(e) => onUpdateElement(element.id, { saberGrowthSpeed: parseFloat(e.target.value) || 1 })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

    </div>
  );
};
