import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, Check, Circle, Maximize2, Minimize2, RotateCcw, Sparkles } from 'lucide-react';
import type { VfxMotionId, VfxParams } from '../utils/vfxMotions';

export type MorphMotionId = Extract<VfxMotionId, `morph-${string}`>;

export const isMorphMotion = (motion: string): motion is MorphMotionId => [
  'morph-circle-pill', 'morph-size', 'morph-reverse-collapse',
].includes(motion as MorphMotionId);

export type DirectMorphMotionId = Extract<MorphMotionId, 'morph-circle-pill' | 'morph-size' | 'morph-reverse-collapse'>;

export const isDirectMorphMotion = (motion: string): motion is DirectMorphMotionId => [
  'morph-circle-pill', 'morph-size', 'morph-reverse-collapse',
].includes(motion as DirectMorphMotionId);

interface MorphVfxProps {
  motionType: MorphMotionId;
  colorA?: string;
  colorB?: string;
  speed?: number;
  params?: VfxParams;
  paused?: boolean;
  interactive?: boolean;
  /** When provided, the preview is driven by an external interaction. */
  controlledProgress?: number;
  /** Library previews expose a toggle; embedded hover previews do not. */
  showToggle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface MorphShellMetrics {
  width: number;
  height: number;
  left: number;
  top: number;
  radius: number;
  direction: 'column' | 'row';
}

/** Shared shell geometry for the library preview and element hover playback. */
export const getMorphShellMetrics = (
  motionType: MorphMotionId,
  progress: number,
  params?: VfxParams,
): MorphShellMetrics => {
  const p = clamp01(progress);
  const travel = Number(params?.travel ?? 1);
  const shell: MorphShellMetrics = { width: 58, height: 42, left: 21, top: 29, radius: 16, direction: 'column' };
  if (motionType === 'morph-circle-pill') { shell.width = 14 + 48 * p * travel; shell.height = 14; shell.left = 50 - shell.width / 2; shell.top = 43; shell.radius = 999; }
  else if (motionType === 'morph-size') { shell.width = 24 + 50 * p * travel; shell.height = 18 + 42 * p; shell.left = 18; shell.top = 22; shell.radius = 14; }
  else if (motionType === 'morph-reverse-collapse') { shell.width = 14 + 54 * p * travel; shell.height = 14 + 42 * p; shell.left = 50 - shell.width / 2; shell.top = 43 - 21 * p; shell.radius = 999 - 983 * p; }
  return shell;
};

/** A reversible, stateful surface. Each morph keeps one anchor while its own content geometry changes. */
export const MorphVfx: React.FC<MorphVfxProps> = ({ motionType, colorA = '#22d3ee', colorB = '#8b5cf6', speed = 1, params, paused = false, interactive = true, controlledProgress, showToggle = true, className, style }) => {
  const reverse = motionType === 'morph-reverse-collapse';
  const [expanded, setExpanded] = useState(reverse);
  const [animatedProgress, setAnimatedProgress] = useState(reverse ? 1 : 0);
  const progressRef = useRef(reverse ? 1 : 0);
  const targetRef = useRef(reverse ? 1 : 0);
  const detail = clamp01(Number(params?.detail ?? 1));
  const isControlled = controlledProgress !== undefined;

  useEffect(() => {
    if (isControlled || paused) return;
    targetRef.current = expanded ? 1 : 0;
    let raf = 0;
    const tick = () => {
      const current = progressRef.current;
      const target = targetRef.current;
      const next = Math.abs(target - current) < 0.002 ? target : current + (target - current) * Math.min(0.22, 0.09 * Math.max(0.5, speed));
      progressRef.current = next;
      setAnimatedProgress(next);
      if (next !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [expanded, speed, isControlled, paused]);

  const progress = isControlled ? clamp01(controlledProgress as number) : animatedProgress;
  const metrics = useMemo(() => getMorphShellMetrics(motionType, progress, params), [motionType, params, progress]);

  const reveal = clamp01((progress - 0.2) / 0.8) * detail;
  const details = clamp01((progress - 0.48) / 0.52) * detail;
  const compact = progress < 0.28;
  const fade = (value: number, y = 8): React.CSSProperties => ({ opacity: value, transform: `translateY(${(1 - value) * y}px)`, transition: 'opacity 140ms linear, transform 180ms ease-out' });
  const bar = (width: string, color = colorA): React.ReactNode => <span style={{ display: 'block', height: 3, width, borderRadius: 4, background: `linear-gradient(90deg, ${color}, ${colorB})` }} />;

  const renderBody = () => {
    if (motionType === 'morph-circle-pill') return <><span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: '50%', color: colorA, background: `${colorA}28`, boxShadow: `0 0 16px ${colorA}66` }}><Circle size={10} fill="currentColor" /></span><span style={{ ...fade(reveal), whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600 }}>同步完成</span><span style={{ ...fade(details, 0), width: 38 }}>{bar('100%')}</span></>;
    if (motionType === 'morph-size') return <><span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: colorA, background: `${colorA}24`, borderRadius: 8 }}><ArrowDownRight size={15} /></span><span style={{ ...fade(reveal), minWidth: 74 }}><small style={{ display: 'block', color: '#a8b8ca', fontSize: 8 }}>主要数值</small><strong style={{ display: 'block', color: '#f8fafc', fontSize: 22, lineHeight: 1.05 }}>86<span style={{ color: colorA, fontSize: 11 }}>%</span></strong></span><span style={{ ...fade(details), color: '#86efac', fontSize: 9 }}>+12.4%</span></>;
    return <><span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: '50%', color: '#86efac', background: '#22c55e24' }}><Check size={15} /></span><span style={{ ...fade(reveal), minWidth: 84 }}><strong style={{ display: 'block', fontSize: 11 }}>任务已完成</strong><small style={{ color: '#a8b8ca', fontSize: 8 }}>点击收回至入口</small></span><span style={{ ...fade(details), color: colorA }}><RotateCcw size={13} /></span></>;
  };

  const label = expanded ? '收回动效' : '展开动效';
  const expandedVisual = progress >= 0.5;
  const toggle = () => { if (interactive) setExpanded((value) => !value); };
  return <div className={className} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={label} aria-expanded={interactive ? expandedVisual : undefined} onClick={toggle} onKeyDown={(event) => { if (interactive && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggle(); } }} style={{ position: 'relative', width: '100%', height: '100%', overflow: controlledProgress !== undefined ? 'visible' : 'hidden', cursor: interactive ? 'pointer' : 'default', ...style }}>
    <div style={{ position: 'absolute', left: `${metrics.left}%`, top: `${metrics.top}%`, width: `${metrics.width}%`, height: `${metrics.height}%`, borderRadius: `${metrics.radius}px`, border: `1px solid ${colorA}${progress > 0.08 ? 'b5' : '75'}`, background: `linear-gradient(135deg, ${colorA}1d, ${colorB}14)`, backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)', boxShadow: `0 14px 34px ${colorA}${progress > 0.1 ? '36' : '1c'}, inset 0 1px 0 rgba(255,255,255,.22)`, display: 'flex', flexDirection: metrics.direction, alignItems: 'center', justifyContent: 'center', gap: 9, padding: `${Math.max(6, progress * 14)}px`, color: '#f8fafc', transformOrigin: motionType === 'morph-size' ? 'top left' : 'center', willChange: 'width, height, border-radius', contain: 'layout paint' }}>
      {renderBody()}
      {compact && <Sparkles size={11} style={{ position: 'absolute', right: 7, top: 7, color: colorB, opacity: 0.75 }} />}
      {motionType === 'morph-reverse-collapse' && progress < 0.22 && <Check size={13} style={{ color: '#86efac' }} />}
    </div>
    {interactive && showToggle && <button type="button" aria-label={label} title={label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggle(); }} style={{ position: 'absolute', right: '12%', bottom: '12%', width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: '50%', border: `1px solid ${colorA}99`, background: `${colorA}24`, color: colorA, boxShadow: `0 4px 16px ${colorA}44`, cursor: 'pointer', zIndex: 2 }}>{expandedVisual ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>}
  </div>;
};
