import React, { useEffect, useRef, useCallback } from 'react';
import { VfxMotionId, drawVfxMotion, isPixelMotion, VfxMouse, VfxParams } from '../utils/vfxMotions';
import type { VfxCardItem } from '../types';
import { CardLayoutVfx, isCardLayoutMotion } from './CardLayoutVfx';
import { isMorphMotion, MorphVfx } from './MorphVfx';

export interface VfxMotionCanvasProps {
  motionType: VfxMotionId;
  colorA?: string;
  colorB?: string;
  colorC?: string;
  speed?: number;
  /** 动效可调参数（MetalForge 风格参数面板） */
  params?: VfxParams;
  paused?: boolean;
  /** Timeline playback gate for embedded VFX. Library previews omit this. */
  isPlaying?: boolean;
  /** 是否启用鼠标交互（hover 跟随/扰动/波源） */
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** 渲染分辨率上限（px），控制性能 */
  maxRes?: number;
  /** 目标帧率限制（如预览模式限制为 20~24 FPS，大幅降低 CPU 负载） */
  fpsLimit?: number;
  cards?: VfxCardItem[];
  selectedCardId?: string;
  cardSelectionActive?: boolean;
  onSelectCard?: (id: string) => void;
}

/**
 * 科技简约动效 Canvas —— requestAnimationFrame 持续渲染，
 * 拖入画布即自动播放，支持鼠标 hover 交互（类似 MetalForge）。
 */
const PixelVfxMotionCanvas: React.FC<VfxMotionCanvasProps> = ({
  motionType,
  colorA,
  colorB,
  colorC,
  speed = 1,
  params,
  paused = false,
  interactive = true,
  className,
  style,
  maxRes,
  fpsLimit,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<VfxMouse>({ x: 0.5, y: 0.5, active: false });
  const propsRef = useRef({ motionType, colorA, colorB, colorC, speed, params, paused, interactive });
  propsRef.current = { motionType, colorA, colorB, colorC, speed, params, paused, interactive };

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 1 || h < 1) return;
    const r = wrap.getBoundingClientRect();
    mouseRef.current = {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / w)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / h)),
      active: true,
    };
  }, []);

  const handleLeave = useCallback(() => {
    mouseRef.current = { ...mouseRef.current, active: false };
  }, []);

  const isPausedRef = useRef(paused);
  isPausedRef.current = paused;
  const startRafRef = useRef<() => void>(() => {});

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let isVisible = true;
    const cap = isPixelMotion(motionType) ? Math.min(maxRes || 180, 180) : (maxRes || 320);
    const targetInterval = fpsLimit && fpsLimit > 0 ? 1000 / fpsLimit : 0;
    let lastRenderTime = 0;
    let animStartTime = performance.now();
    let pausedTime = 0;
    let lastPauseTimestamp = 0;

    const drawFrame = (now: number) => {
      const p = propsRef.current;
      if (cv.width <= 0 || cv.height <= 0) return;
      drawVfxMotion(
        ctx,
        p.motionType,
        cv.width,
        cv.height,
        (now - animStartTime - pausedTime) / 1000,
        { colorA: p.colorA || '#22d3ee', colorB: p.colorB || '#a855f7', colorC: p.colorC || p.colorA || '#22d3ee', speed: p.speed || 1 },
        p.interactive ? mouseRef.current : null,
        p.params || null,
      );
    };

    let lastW = 0;
    let lastH = 0;
    const setSize = (rectW?: number, rectH?: number) => {
      let rw = rectW ?? 0;
      let rh = rectH ?? 0;
      if (rw <= 0 || rh <= 0) {
        rw = wrap.clientWidth;
        rh = wrap.clientHeight;
      }
      if (rw <= 0 || rh <= 0) {
        const r = wrap.getBoundingClientRect();
        rw = r.width;
        rh = r.height;
      }
      if (rw < 1 || rh < 1) return;
      if (Math.abs(rw - lastW) < 0.5 && Math.abs(rh - lastH) < 0.5) return;
      lastW = rw;
      lastH = rh;
      const ratio = rh / rw;
      let cw = Math.min(rw, cap);
      let ch = cw * ratio;
      if (ch > cap) { ch = cap; cw = ch / ratio; }
      cw = Math.max(1, Math.round(cw));
      ch = Math.max(1, Math.round(ch));
      const changed = cv.width !== cw || cv.height !== ch;
      if (changed) {
        cv.width = cw;
        cv.height = ch;
        drawFrame(performance.now());
      }
    };
    setSize();

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && entry.contentRect && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setSize(entry.contentRect.width, entry.contentRect.height);
        } else {
          setSize();
        }
      });
      ro.observe(wrap);
    } catch { /* ResizeObserver fallback */ }

    let io: IntersectionObserver | null = null;
    let lastVisibleTime = performance.now();
    try {
      io = new IntersectionObserver((entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !isVisible) {
          pausedTime += performance.now() - lastVisibleTime;
          isVisible = true;
          if (!raf && !isPausedRef.current) raf = requestAnimationFrame(tick);
        } else if (!visible && isVisible) {
          isVisible = false;
          lastVisibleTime = performance.now();
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
        }
      }, { threshold: 0.05 });
      io.observe(wrap);
    } catch { /* IntersectionObserver fallback */ }

    const tick = (now: number) => {
      if (!running) { raf = 0; return; }
      if (!isPausedRef.current && isVisible) {
        if (!targetInterval || now - lastRenderTime >= targetInterval - 3) {
          lastRenderTime = now;
          drawFrame(now);
        }
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const triggerRaf = () => {
      if (!running) return;
      if (!isPausedRef.current && isVisible) {
        if (lastPauseTimestamp > 0) {
          pausedTime += performance.now() - lastPauseTimestamp;
          lastPauseTimestamp = 0;
        }
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        if (lastPauseTimestamp === 0) lastPauseTimestamp = performance.now();
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
    };
    startRafRef.current = triggerRaf;

    if (!paused) {
      raf = requestAnimationFrame(tick);
    } else {
      lastPauseTimestamp = performance.now();
    }

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
    };
  }, [motionType, maxRes, fpsLimit]);

  useEffect(() => {
    startRafRef.current();
  }, [paused]);

  return (
    <div
      ref={wrapRef}
      className={className}
      onMouseMove={interactive ? handleMove : undefined}
      onMouseLeave={interactive ? handleLeave : undefined}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

const VfxMotionCanvasImpl: React.FC<VfxMotionCanvasProps> = (props) => {
  if (isCardLayoutMotion(props.motionType)) {
    return <CardLayoutVfx motionType={props.motionType} colorA={props.colorA} colorB={props.colorB} speed={props.speed} isPlaying={props.isPlaying !== undefined ? props.isPlaying : !props.paused} params={props.params} cards={props.cards} selectedId={props.selectedCardId} selectionActive={props.cardSelectionActive} interactive={props.interactive} onSelectCard={props.onSelectCard} className={props.className} style={props.style} />;
  }
  if (isMorphMotion(props.motionType)) {
    return <MorphVfx motionType={props.motionType} colorA={props.colorA} colorB={props.colorB} speed={props.speed} params={props.params} paused={props.isPlaying === false} interactive={props.interactive} className={props.className} style={props.style} />;
  }
  return <PixelVfxMotionCanvas {...props} paused={props.isPlaying === false || props.paused} />;
};

function areVfxPropsEqual(prev: VfxMotionCanvasProps, next: VfxMotionCanvasProps): boolean {
  if (prev.motionType !== next.motionType) return false;
  if (prev.colorA !== next.colorA || prev.colorB !== next.colorB || prev.colorC !== next.colorC) return false;
  if (prev.speed !== next.speed) return false;
  if (prev.paused !== next.paused) return false;
  if (prev.isPlaying !== next.isPlaying) return false;
  if (prev.interactive !== next.interactive) return false;
  if (prev.maxRes !== next.maxRes) return false;
  if (prev.fpsLimit !== next.fpsLimit) return false;
  if (prev.selectedCardId !== next.selectedCardId) return false;
  if (prev.cardSelectionActive !== next.cardSelectionActive) return false;
  if (prev.className !== next.className) return false;
  if (prev.cards !== next.cards) return false;
  if (prev.params !== next.params) return false;
  return true;
}

export const VfxMotionCanvas = React.memo(VfxMotionCanvasImpl, areVfxPropsEqual);
