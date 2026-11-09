import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, FileText, Globe2, Image as ImageIcon, Music2, PlaySquare, Sparkles } from 'lucide-react';
import { loadRuntimeAssetUrl } from '../utils/runtimeAssetUrl';
import type { VfxCardContentType, VfxCardItem } from '../types';

export type CardLayoutMotionId = 'card-depth-stack' | 'card-fan' | 'card-cylinder' | 'card-sphere' | 'card-spiral' | 'card-wave-grid';

interface CardLayoutVfxProps {
  motionType: CardLayoutMotionId;
  colorA?: string;
  colorB?: string;
  params?: Record<string, number | string>;
  speed?: number;
  /** Timeline playback gate. Library previews omit this and remain live. */
  isPlaying?: boolean;
  cards?: VfxCardItem[];
  selectedId?: string;
  selectionActive?: boolean;
  interactive?: boolean;
  onSelectCard?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const isCardLayoutMotion = (motion: string): motion is CardLayoutMotionId =>
  ['card-depth-stack', 'card-fan', 'card-cylinder', 'card-sphere', 'card-spiral', 'card-wave-grid'].includes(motion);

export const createDefaultVfxCards = (): VfxCardItem[] =>
  ['探索', '故事', '空间', '细节', '连接', '下一页', '灵感', '结构'].map((title, index) => ({
    id: `card_${Date.now()}_${index}`,
    title,
    type: 'text',
    text: index === 0 ? '点击卡片查看内容' : '可替换为任意已支持的素材',
  }));

const typeIcon: Record<VfxCardContentType, React.ReactNode> = {
  text: <FileText size={16} />,
  image: <ImageIcon size={16} />,
  video: <PlaySquare size={16} />,
  panorama: <Globe2 size={16} />,
  'panorama-video': <Globe2 size={16} />,
  'model-3d': <Box size={16} />,
  'gaussian-splat': <Sparkles size={16} />,
  audio: <Music2 size={16} />,
  file: <FileText size={16} />,
};

const CardAsset: React.FC<{ card: VfxCardItem; accent: string; secondary: string; isPlaying: boolean }> = React.memo(({ card, accent, secondary, isPlaying }) => {
  const [url, setUrl] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true;
    if (!card.assetRef) { setUrl(''); return; }
    loadRuntimeAssetUrl(card.assetRef).then((next) => { if (active) setUrl(next); }).catch(() => { if (active) setUrl(''); });
    return () => { active = false; };
  }, [card.assetRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [isPlaying, url]);

  if ((card.type === 'image' || card.type === 'panorama') && url) {
    return <img src={url} alt={card.title} className="absolute inset-0 h-full w-full object-contain" draggable={false} />;
  }
  if ((card.type === 'video' || card.type === 'panorama-video') && url) {
    return <video ref={videoRef} src={url} preload={isPlaying ? 'auto' : 'metadata'} muted loop autoPlay={isPlaying} playsInline className="absolute inset-0 h-full w-full object-contain" />;
  }
  return <div className="absolute inset-0 p-2.5 text-slate-200">
    <div className="flex h-[56%] items-center justify-center overflow-hidden rounded-[4px] border border-white/10" style={{ background: `linear-gradient(135deg, ${accent}18, ${secondary}12)` }}>
      <div className="flex flex-col items-center gap-1.5 opacity-90" style={{ color: accent }}>
        {typeIcon[card.type]}
        <span className="h-1 w-10 rounded-full bg-current opacity-60" />
        <span className="h-1 w-6 rounded-full bg-current opacity-30" />
      </div>
    </div>
    <div className="mt-2 flex items-center justify-between gap-2 text-[8px] text-slate-300/80">
      <span className="truncate">{card.type === 'text' ? card.text || '输入文案' : card.type}</span>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: secondary }} />
    </div>
  </div>;
});

const CardLayoutVfxImpl: React.FC<CardLayoutVfxProps> = ({
  motionType, colorA = '#38bdf8', colorB = '#8b5cf6', params, speed = 1, isPlaying = true, cards, selectedId, selectionActive = false, interactive = true, onSelectCard, className, style,
}) => {
  const fallbackCards = useMemo(createDefaultVfxCards, []);
  const resolvedCards = cards?.length ? cards : fallbackCards;
  const phaseRef = useRef(0);
  const [localSelectedId, setLocalSelectedId] = useState<string | undefined>();
  const [hoveredCardId, setHoveredCardId] = useState<string | undefined>();
  const [zoom, setZoom] = useState(1);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const swipeRef = useRef<{ id: number; x: number; y: number; pinched: boolean } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const suppressClickRef = useRef(false);
  // The canvas parent advances the timeline every frame. Keep the latest
  // selection handler without making that unrelated update recreate cards.
  const onSelectCardRef = useRef(onSelectCard);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  onSelectCardRef.current = onSelectCard;
  const spread = Number(params?.spread ?? 1);
  const rotate = Number(params?.rotate ?? 0);
  const wave = Number(params?.wave ?? 0.55);
  const lift = Number(params?.lift ?? 0.7);
  const selected = selectionActive ? selectedId : localSelectedId;
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) cancelAnimationFrame(hoverFrameRef.current);
  }, []);

  const geometry = (index: number, count: number, currentPhase: number) => {
    const centered = index - (count - 1) / 2;
    let x = 50; let y = 50; let z = 0; let rx = 0; let ry = 0; let rz = 0;
    if (motionType === 'card-depth-stack') {
      x += centered * 5.7 * spread;
      // Keep the stack on a level horizontal baseline. Depth is conveyed by
      // overlap and translateZ instead of a diagonal vertical drift.
      y = 50;
      // The stack advances in one direction: the last card is the front face,
      // while earlier cards recede behind it like a physical card fan.
      z = (index - (count - 1)) * 30 * Number(params?.depth ?? 0.65);
      rz = 0;
    }
    if (motionType === 'card-fan') {
      const angle = centered * 13 * spread;
      const radians = angle * Math.PI / 180;
      x += Math.sin(radians) * 27 * spread;
      y += Math.abs(centered) * 2.8;
      rz = angle;
      z = -Math.abs(centered) * 18;
    }
    if (motionType === 'card-cylinder') {
      const a = index / count * Math.PI * 2 + currentPhase * rotate * speed;
      x += Math.sin(a) * 31 * spread;
      y += (1 - Math.cos(a)) * 2.5;
      z = Math.cos(a) * 155;
      ry = -Math.sin(a) * 52;
    }
    if (motionType === 'card-sphere') {
      // 地球式圆形排布：卡片沿同一条圆形轨道均匀分布，
      // 前后层次由 Z 深度表达，避免经纬度散点造成“不像球”的视觉结果。
      const a = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2 + currentPhase * rotate * speed;
      const radiusX = 34 * spread;
      const radiusY = 30 * spread;
      x += Math.cos(a) * radiusX;
      y += Math.sin(a) * radiusY;
      z = Math.cos(a) * 145;
      ry = -Math.sin(a) * 32;
    }
    if (motionType === 'card-spiral') {
      const a = index * 0.88 + currentPhase * rotate * speed;
      const r = (8 + index * 3.2) * spread;
      x += Math.cos(a) * r;
      y += centered * 10 * spread + Math.sin(a) * 7;
      z = Math.sin(a) * 125;
      ry = -Math.cos(a) * 34;
      rz = Math.sin(a) * 8;
    }
    if (motionType === 'card-wave-grid') { const cols = Math.ceil(Math.sqrt(count)); const row = Math.floor(index / cols); const col = index % cols; x = 50 + (col - (cols - 1) / 2) * 20 * spread; y = 50 + (row - (Math.ceil(count / cols) - 1) / 2) * 25 * spread; z = Math.sin(currentPhase * 2.5 * speed - index * 0.7) * 75 * wave; rx = Math.sin(currentPhase * 2.5 * speed - index * 0.7) * 10 * wave; }
    // 卡片编排中的点击仅用于选择，不再改变卡片的深度、位置或姿态。
    // 这样可避免选中卡片被放大后超出预览容器而产生裁切。
    return { x, y, z, rx, ry, rz };
  };

  const cardWidth = motionType === 'card-wave-grid' ? `${Math.min(20, 58 / Math.ceil(Math.sqrt(resolvedCards.length)))}%` : `${Math.min(18, 48 / Math.sqrt(resolvedCards.length))}%`;
  const cardWidthPercent = motionType === 'card-wave-grid' ? Math.min(20, 58 / Math.ceil(Math.sqrt(resolvedCards.length))) : Math.min(18, 48 / Math.sqrt(resolvedCards.length));
  const perspective = 900;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
  const getCardPose = (card: VfxCardItem, index: number, currentPhase: number) => {
    const active = selected === card.id;
    const hovered = hoveredCardId === card.id;
    const g = geometry(index, resolvedCards.length, currentPhase);
    const cardScale = Math.max(0.4, Math.min(2.5, card.scale ?? 1));
    const perspectiveScale = motionType === 'card-cylinder' || motionType === 'card-sphere' || motionType === 'card-spiral'
      ? 0.82 + ((g.z + 155) / 310) * 0.22
      : 1;
    const interactionScale = hovered ? 1.16 : 1;
    const depth = g.z + (hovered ? 90 : 0);
    const projectedDepthScale = perspective / Math.max(240, perspective - depth);
    const projectedCardScale = cardScale * perspectiveScale * interactionScale * projectedDepthScale;
    const halfCardWidth = cardWidthPercent * projectedCardScale * zoom / 2;
    const halfCardHeight = (cardWidthPercent / 0.78) * projectedCardScale * zoom / 2;
    const zoomedX = 50 + (g.x - 50) * zoom;
    const zoomedY = 50 + (g.y - 50) * zoom;
    const safeX = hovered ? clamp(zoomedX, halfCardWidth + 1, 100 - halfCardWidth - 1) : zoomedX;
    const safeY = hovered ? clamp(zoomedY, halfCardHeight + 1, 100 - halfCardHeight - 1) : zoomedY;
    const poseX = hovered && zoom > 0 ? 50 + (safeX - 50) / zoom : g.x;
    const poseY = hovered && zoom > 0 ? 50 + (safeY - 50) / zoom : g.y;
    const focusPoint = hoverPointRef.current;
    const focusX = focusPoint ? Math.max(15, Math.min(85, ((focusPoint.x - g.x) / cardWidthPercent) * 100)) : 50;
    const focusY = focusPoint ? Math.max(15, Math.min(85, ((focusPoint.y - g.y) / (cardWidthPercent / 0.78)) * 100)) : 50;
    return {
      active,
      hovered,
      left: `${poseX}%`,
      top: `${poseY}%`,
      transformOrigin: motionType === 'card-fan' ? '50% 92%' : hovered ? `${focusX}% ${focusY}%` : 'center',
      transform: `translate(-50%, -50%) translate3d(0, 0, ${depth}px) rotateX(${g.rx}deg) rotateY(${g.ry}deg) rotateZ(${g.rz}deg) scale(${cardScale * perspectiveScale * interactionScale})`,
      zIndex: Math.round(500 + depth),
    };
  };

  // Animate card transforms directly so timeline ticks do not reconcile the
  // card subtree or recreate media layers.
  useEffect(() => {
    const applyPoses = (currentPhase: number) => {
      phaseRef.current = currentPhase;
      resolvedCards.forEach((card, index) => {
        const node = cardRefs.current.get(card.id);
        if (!node) return;
        const pose = getCardPose(card, index, currentPhase);
        node.style.left = pose.left;
        node.style.top = pose.top;
        node.style.transformOrigin = pose.transformOrigin;
        node.style.transform = pose.transform;
        node.style.zIndex = String(pose.zIndex);
      });
    };

    applyPoses(0);
    const shouldAnimate = isPlaying && !reducedMotion && (motionType === 'card-wave-grid' || rotate > 0);
    if (!shouldAnimate) return undefined;

    let frame = 0;
    const start = performance.now();
    let lastPaint = start;
    const tick = (now: number) => {
      if (now - lastPaint >= 32) {
        lastPaint = now;
        applyPoses((now - start) / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, reducedMotion, motionType, rotate, speed, spread, wave, resolvedCards, selected, hoveredCardId, zoom]);

  const updateHover = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    hoverPointRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
    if (hoverFrameRef.current !== null) return;
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const point = hoverPointRef.current;
      if (!point) return;
      let nearestId: string | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;
      resolvedCards.forEach((card, index) => {
        const g = geometry(index, resolvedCards.length, phaseRef.current);
        const distance = Math.hypot(point.x - g.x, point.y - g.y);
        if (distance < nearestDistance) { nearestDistance = distance; nearestId = card.id; }
      });
      setHoveredCardId(nearestDistance <= Math.max(12, cardWidthPercent * 0.8) ? nearestId : undefined);
    });
  };
  const chooseCard = (id: string) => { setLocalSelectedId(id); onSelectCardRef.current?.(id); };
  const stepCard = (direction: 1 | -1) => {
    const currentIndex = selected ? resolvedCards.findIndex((card) => card.id === selected) : direction === 1 ? -1 : 0;
    const nextIndex = (currentIndex + direction + resolvedCards.length) % resolvedCards.length;
    chooseCard(resolvedCards[nextIndex].id);
  };
  const pointerDistance = () => {
    const points = Array.from(pointersRef.current.values());
    return points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) { pinchRef.current = { distance: pointerDistance(), zoom }; swipeRef.current = null; }
    else swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, pinched: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (interactive && event.pointerType === 'mouse' && pointersRef.current.size === 0) {
      updateHover(event);
      return;
    }
    if (!interactive || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const distance = pointerDistance();
      if (distance > 0) setZoom(Math.max(0.7, Math.min(1.8, pinchRef.current.zoom * distance / Math.max(1, pinchRef.current.distance))));
      return;
    }
    const swipe = swipeRef.current;
    if (swipe?.id === event.pointerId && Math.abs(event.clientX - swipe.x) > 8) suppressClickRef.current = true;
  };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    const wasPinching = !!pinchRef.current;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (!wasPinching && swipe?.id === event.pointerId) {
      const dx = event.clientX - swipe.x; const dy = event.clientY - swipe.y;
      if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        stepCard(dx > 0 ? 1 : -1);
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
    }
    swipeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return <div className={className} onMouseDown={(event) => { if (interactive) event.stopPropagation(); }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerLeave={() => { hoverPointRef.current = null; setHoveredCardId(undefined); }} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onWheel={(event) => { if (!interactive) return; setZoom((value) => Math.max(0.7, Math.min(1.8, value * Math.exp(-event.deltaY * 0.001)))); }} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', perspective: '900px', touchAction: 'none', cursor: interactive ? 'grab' : 'default', background: 'transparent', ...style }}>
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: 'center', transformStyle: 'preserve-3d', willChange: 'transform', transition: 'transform 160ms ease-out' }}>
    {resolvedCards.map((card, index) => {
      const pose = getCardPose(card, index, phaseRef.current);
      const { active, hovered } = pose;
      const hasContinuousMotion = isPlaying && (motionType === 'card-wave-grid' || rotate > 0);
      const cardStyle: React.CSSProperties = {
        left: pose.left,
        top: pose.top,
        width: cardWidth,
        aspectRatio: '0.78 / 1',
        transformOrigin: pose.transformOrigin,
        transform: pose.transform,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        zIndex: pose.zIndex,
        cursor: interactive ? 'pointer' : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        borderRadius: 6,
        borderColor: active || hovered ? colorA : 'rgba(255,255,255,.18)',
        boxShadow: active ? `0 20px 46px ${colorA}55, inset 0 0 0 1px ${colorA}55` : hovered ? `0 16px 36px ${colorA}44, inset 0 0 0 1px ${colorA}44` : `0 8px 20px ${colorA}22`,
        // A transform transition is useful for static selection, but it queues
        // 300ms interpolations behind each 30fps pose update during playback.
        transition: hasContinuousMotion
          ? 'box-shadow 160ms ease-out, border-color 160ms ease-out'
          : 'transform 300ms cubic-bezier(.16,1,.3,1), box-shadow 220ms ease-out, border-color 220ms ease-out',
        // Backdrop sampling on several transformed 3D layers is a common
        // source of frame drops and transient black tiles on Chromium GPUs.
        // Keep the glass treatment while editing; use an opaque light surface
        // while the timeline is moving so the media stays stable.
        backdropFilter: isPlaying ? 'none' : 'blur(18px) saturate(155%)',
        WebkitBackdropFilter: isPlaying ? 'none' : 'blur(18px) saturate(155%)',
        background: isPlaying ? 'rgba(8, 15, 28, 0.82)' : 'transparent',
      };
      return <button key={card.id} ref={(node) => { if (node) cardRefs.current.set(card.id, node); else cardRefs.current.delete(card.id); }} type="button" onMouseDown={(event) => event.stopPropagation()} onPointerDown={() => { if (interactive) chooseCard(card.id); }} onClick={(event) => { event.stopPropagation(); if (suppressClickRef.current) return; chooseCard(card.id); }} className="absolute overflow-hidden border text-left outline-none" aria-label={`选择卡片 ${card.title}`} style={cardStyle}>
        <CardAsset card={card} accent={colorA} secondary={colorB} isPlaying={isPlaying} />
        <span className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 [text-shadow:0_1px_8px_rgba(0,0,0,.9)]"><strong className="block truncate text-[10px] text-white">{card.title}</strong>{card.type === 'text' && <small className="block truncate text-[8px] text-slate-200">{card.text || '输入文案'}</small>}</span>
      </button>;
    })}</div>
  </div>;
};

// 时间线播放会让画布以高频率更新 currentTime。卡片编排自身只依赖播放开关、
// 动效参数和卡片数据，隔离这些无关更新可避免重复创建卡片 DOM 与媒体节点。
export const CardLayoutVfx = React.memo(CardLayoutVfxImpl, (prev, next) => (
  prev.motionType === next.motionType &&
  prev.colorA === next.colorA &&
  prev.colorB === next.colorB &&
  prev.speed === next.speed &&
  prev.params === next.params &&
  prev.isPlaying === next.isPlaying &&
  prev.cards === next.cards &&
  prev.selectedId === next.selectedId &&
  prev.selectionActive === next.selectionActive &&
  prev.interactive === next.interactive &&
  prev.className === next.className &&
  prev.style === next.style
));
