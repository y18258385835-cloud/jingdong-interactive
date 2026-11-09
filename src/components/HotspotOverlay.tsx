import React, { useRef, useEffect, useState } from 'react';
import { Plus, Circle, ArrowRight, Info, Box } from 'lucide-react';
import { Hotspot, SceneElement } from '../types';
import type { HotspotProjector, HotspotScreenPos } from './ThreeCanvas';
import { ThreeCanvas } from './ThreeCanvas';
import { resolveInteraction } from '../utils/interactionModel';
import { loadRuntimeAssetUrl } from '../utils/runtimeAssetUrl';

interface HotspotOverlayProps {
  /** 热点列表（来自父元素的 hotspots 字段） */
  hotspots: Hotspot[];
  /** ThreeCanvas 暴露的投影函数 ref（每帧读取 current，无需触发重渲染） */
  projectionRef: React.MutableRefObject<HotspotProjector | null>;
  /** 是否编辑模式（编辑模式热点可选中/拖动，演示模式点击触发） */
  isEditing: boolean;
  /** 当前 3D 元素是否被选中（选中时热点才可交互；未选中时仅显示） */
  isSelected?: boolean;
  /** 点击热点回调（编辑模式选中，演示模式触发转场/媒体） */
  onHotspotClick: (hotspot: Hotspot) => void;
  /** 当前选中的热点 id（编辑模式高亮） */
  selectedHotspotId?: string | null;
  /** 拖动热点回调（编辑模式，传递屏幕绝对坐标，由上层反投影更新位置） */
  onHotspotDrag?: (hotspotId: string, screenX: number, screenY: number) => void;
  /** 可被热点复用的工程模型（包括 AI 过程化模型）。 */
  modelElements?: SceneElement[];
}

/**
 * 3D/全景画面热点叠加层。
 * 每帧（rAF）通过 projectionRef 将热点的 3D 坐标投影到屏幕像素坐标，
 * 用绝对定位 div 渲染在 WebGL canvas 之上。
 *
 * 编辑模式：热点可点击选中、可拖动（pointer 事件实时反投影更新位置）。
 * 演示模式：点击热点触发 onHotspotClick（跳转场景/弹窗/URL/媒体）。
 */
export const HotspotOverlay: React.FC<HotspotOverlayProps> = ({
  hotspots,
  projectionRef,
  isEditing,
  isSelected = false,
  onHotspotClick,
  selectedHotspotId,
  onHotspotDrag,
  modelElements = [],
}) => {
  const [positions, setPositions] = useState<Record<string, HotspotScreenPos>>({});
  // 拖拽中的热点临时屏幕位置（本地实时更新，不经过 App 层 setState，保证拖拽流畅）
  const [dragScreenPos, setDragScreenPos] = useState<Record<string, { x: number; y: number }>>({});
  // 自定义图标 URL 映射（热点ID → 加载后的图片/视频 URL）
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});
  const [modelUrls, setModelUrls] = useState<Record<string, string>>({});
  const rafRef = useRef<number | null>(null);
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  // 容器 ref，用于将视口坐标转换为容器内坐标
  const containerRef = useRef<HTMLDivElement>(null);

  // 拖动状态（用 ref 避免每步触发重渲染）
  const dragRef = useRef<{ hotspotId: string; pointerId: number } | null>(null);
  const hoverTimersRef = useRef<Record<string, number>>({});

  // 每帧更新所有热点的屏幕位置（相机自动旋转/手动旋转时热点跟随画面移动）
  // 加载自定义图标 URL（图片/视频类型的热点图标）
  useEffect(() => {
    let cancelled = false;
    const customIcons = hotspots.filter(
      (h) => (h.iconType === 'image' && h.iconImageRefId) || (h.iconType === 'video' && h.iconVideoRefId)
    );
    const modelIcons = hotspots.filter((h) => h.iconType === 'model');
    (async () => {
      const urlMap: Record<string, string> = {};
      const modelUrlMap: Record<string, string> = {};
      for (const h of customIcons) {
        const refId = h.iconType === 'image' ? h.iconImageRefId : h.iconVideoRefId;
        if (refId) {
          try {
            const url = await loadRuntimeAssetUrl(refId);
            if (url && !cancelled) urlMap[h.id] = url;
          } catch (e) {
            console.warn('[HotspotOverlay] 加载图标失败:', h.id, e);
          }
        }
      }
      for (const h of modelIcons) {
        const linked = h.iconModelElementId ? modelElements.find((item) => item.id === h.iconModelElementId) : undefined;
        const refId = h.iconModelRefId || linked?.refId;
        if (refId) {
          try {
            const url = await loadRuntimeAssetUrl(refId);
            if (url && !cancelled) modelUrlMap[h.id] = url;
          } catch (e) {
            console.warn('[HotspotOverlay] 3D 图标加载失败:', h.id, e);
          }
        }
      }
      if (!cancelled) {
        setIconUrls(urlMap);
        setModelUrls(modelUrlMap);
      }
    })();
    return () => { cancelled = true; };
  }, [hotspots, modelElements]);

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      const projector = projectionRef.current;
      if (projector) {
        const next: Record<string, HotspotScreenPos> = {};
        for (const h of hotspotsRef.current) {
          if (h.visible === false) continue;
          const pos = projector(h.position);
          if (pos) next[h.id] = pos;
        }
        setPositions((prev) => {
          // 浅比较：仅当位置实际变化时才 setState，避免不必要的重渲染
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(next);
          if (prevKeys.length !== nextKeys.length) return next;
          for (const k of nextKeys) {
            const p = prev[k];
            const n = next[k];
            if (!p || Math.abs(p.x - n.x) > 0.5 || Math.abs(p.y - n.y) > 0.5 || p.visible !== n.visible) {
              return next;
            }
          }
          return prev;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    // 立即调用 tick()：同步更新一次热点位置（确保首帧/后台时也能渲染），并启动 rAF 循环
    tick();
    return () => {
      mounted = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      Object.values(hoverTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      hoverTimersRef.current = {};
    };
  }, [projectionRef]);

  const handleHotspotHover = (hotspot: Hotspot, entering: boolean) => {
    const interaction = resolveInteraction(hotspot);
    if (isEditing || interaction.trigger !== 'hover') return;
    const existing = hoverTimersRef.current[hotspot.id];
    if (existing) {
      window.clearTimeout(existing);
      delete hoverTimersRef.current[hotspot.id];
    }
    if (!entering) return;
    const delay = Math.max(0, Math.min(3000, interaction.hoverDelay * 1000));
    if (delay === 0) {
      onHotspotClick(hotspot);
      return;
    }
    hoverTimersRef.current[hotspot.id] = window.setTimeout(() => {
      delete hoverTimersRef.current[hotspot.id];
      onHotspotClick(hotspot);
    }, delay);
  };

  // 全局 pointermove / pointerup（拖动时监听，确保拖出热点区域仍能跟踪）
  useEffect(() => {
    if (!isEditing) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      // 实时更新本地拖拽位置（容器内 CSS 像素坐标），保证拖拽流畅跟随鼠标
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        // 关键：容器可能被父元素 transform: scale 缩放（1920x1080 → 显示大小），
        // 需要将视口坐标转换为容器内 CSS 坐标（用于 left/top 定位）
        const scaleX = rect.width > 0 ? container.clientWidth / rect.width : 1;
        const scaleY = rect.height > 0 ? container.clientHeight / rect.height : 1;
        const localX = (e.clientX - rect.left) * scaleX;
        const localY = (e.clientY - rect.top) * scaleY;
        setDragScreenPos((prev) => ({ ...prev, [drag.hotspotId]: { x: localX, y: localY } }));
      }
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      try {
        (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      // 拖拽结束时，将最终位置提交到工程数据（反投影为 3D 坐标存储）
      onHotspotDrag?.(drag.hotspotId, e.clientX, e.clientY);
      // 清除本地拖拽临时位置
      setDragScreenPos((prev) => {
        const next = { ...prev };
        delete next[drag.hotspotId];
        return next;
      });
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isEditing, onHotspotDrag]);

  /** 热点 pointerdown：编辑模式开始拖动，阻止冒泡避免触发 canvas 点击添加 */
  const handleHotspotPointerDown = (e: React.PointerEvent, hotspot: Hotspot) => {
    // 编辑模式下热点始终拥有独立的选择优先级：即使所属 3D 图层尚未选中，
    // 第一次点击也必须先选中热点，否则事件会冒泡到父层，弹窗编辑框永远不会出现。
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    onHotspotClick(hotspot);

    // 只有所属元素已经处于选中态时才进入拖动状态；第一次点击只负责选中，
    // 避免轻触热点时意外改变其 3D 坐标。
    if (isSelected) {
      dragRef.current = { hotspotId: hotspot.id, pointerId: e.pointerId };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  /** 热点 click：演示模式触发；编辑模式已在 pointerdown 选中，这里不重复处理 */
  const handleHotspotClick = (e: React.MouseEvent, hotspot: Hotspot) => {
    e.stopPropagation();
    if (resolveInteraction(hotspot).trigger !== 'click') return;
    if (isEditing) return; // 编辑模式选中已在 pointerdown 处理
    onHotspotClick(hotspot);
  };

  /** 渲染热点图标（支持预设图标/自定义图片/自定义视频） */
  const renderIcon = (h: Hotspot, isSelected: boolean) => {
    const size = h.size || 28;
    const color = h.color || '#38bdf8';
    const icon = h.icon || 'dot';
    const iconType = h.iconType || 'preset';
    // 选中时用更亮的颜色 + 白色边框
    const displayColor = isSelected ? '#fbbf24' : color;

    if (iconType === 'model') {
      const linkedModel = h.iconModelElementId ? modelElements.find((item) => item.id === h.iconModelElementId) : undefined;
      const modelElement = linkedModel || (h.iconModelRefId ? ({ id: `hotspot-model-${h.id}`, type: 'model-3d', refId: h.iconModelRefId, sourceName: h.label || '热点模型', x: 0, y: 0, w: 100, h: 100, zIndex: 0, opacity: 100, startTime: 0, duration: 0 } as unknown as SceneElement) : undefined);
      const w = h.iconWidth || Math.max(48, size * 2.2);
      const hgt = h.iconHeight || w;
      const modelUrl = modelUrls[h.id];
      return (
        <div
          style={{
            width: w,
            height: hgt,
            borderRadius: h.iconShape === 'circle' ? '50%' : h.iconShape === 'square' ? 0 : `${h.iconBorderRadius || 8}px`,
            overflow: 'hidden',
            border: h.iconBorder || (isSelected ? '2px solid #fff' : `1px solid ${displayColor}99`),
            boxShadow: h.iconShadow || (isSelected ? `0 0 ${w * 0.3}px ${displayColor}` : '0 2px 8px rgba(0,0,0,0.4)'),
            opacity: h.iconOpacity ?? 1,
            background: '#08111c',
            position: 'relative',
          }}
        >
          {modelElement && (modelUrl || modelElement.ai3dCode) ? (
            <ThreeCanvas element={modelElement} assetUrl={modelUrl} isEditing={false} isSelected={false} interactive={false} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 text-[10px]"><Box size={18} />模型加载中</div>
          )}
        </div>
      );
    }

    // —— 自定义图片图标 ——
    if (iconType === 'image') {
      const imgUrl = iconUrls[h.id];
      const w = h.iconWidth || size * 2;
      const hgt = h.iconHeight || size * 2;
      const shape = h.iconShape || 'rounded';
      const borderRadius = shape === 'circle' ? '50%' : shape === 'square' ? '0' : `${h.iconBorderRadius || 8}px`;
      return (
        <div
          style={{
            width: w,
            height: hgt,
            borderRadius,
            overflow: 'hidden',
            border: h.iconBorder || (isSelected ? '2px solid #fff' : 'none'),
            boxShadow: h.iconShadow || (isSelected ? `0 0 ${w * 0.3}px ${displayColor}` : '0 2px 8px rgba(0,0,0,0.4)'),
            opacity: h.iconOpacity ?? 1,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
          }}
          className={isSelected ? '' : 'hotspot-pulse'}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={h.label || '热点图标'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              draggable={false}
            />
          ) : (
            <div className="text-slate-500 text-[10px]">加载中...</div>
          )}
        </div>
      );
    }

    // —— 自定义视频图标 ——
    if (iconType === 'video') {
      const videoUrl = iconUrls[h.id];
      const w = h.iconWidth || size * 2.5;
      const hgt = h.iconHeight || size * 2;
      const shape = h.iconShape || 'rounded';
      const borderRadius = shape === 'circle' ? '50%' : shape === 'square' ? '0' : `${h.iconBorderRadius || 8}px`;
      return (
        <div
          style={{
            width: w,
            height: hgt,
            borderRadius,
            overflow: 'hidden',
            border: h.iconBorder || (isSelected ? '2px solid #fff' : 'none'),
            boxShadow: h.iconShadow || (isSelected ? `0 0 ${w * 0.3}px ${displayColor}` : '0 2px 8px rgba(0,0,0,0.4)'),
            opacity: h.iconOpacity ?? 1,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            background: '#000',
          }}
        >
          {videoUrl ? (
            <video
              src={videoUrl}
              autoPlay={h.iconAutoPlay !== false}
              loop={h.iconLoop !== false}
              muted={h.iconMuted !== false}
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">加载中...</div>
          )}
        </div>
      );
    }

    // —— 预设图标（preset）——
    const baseStyle: React.CSSProperties = {
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${displayColor} 0%, ${displayColor}cc 60%, ${displayColor}66 100%)`,
      boxShadow: isSelected
        ? `0 0 ${size * 0.8}px ${displayColor}, 0 0 0 3px #fff, 0 0 ${size * 0.4}px ${displayColor}`
        : `0 0 ${size * 0.6}px ${displayColor}99, 0 0 ${size * 0.3}px ${displayColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      border: `2px solid ${isSelected ? '#fff' : displayColor}`,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    };

    if (icon === 'plus') {
      return (
        <div style={baseStyle} className={isSelected ? '' : 'hotspot-pulse'}>
          <Plus size={size * 0.55} strokeWidth={3} />
        </div>
      );
    }
    if (icon === 'arrow') {
      return (
        <div style={baseStyle}>
          <ArrowRight size={size * 0.5} strokeWidth={2.5} />
        </div>
      );
    }
    if (icon === 'info') {
      return (
        <div style={baseStyle}>
          <Info size={size * 0.5} strokeWidth={2.5} />
        </div>
      );
    }
    // dot（默认）：实心圆点 + 外环脉冲
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        {!isSelected && (
          <div
            className="hotspot-pulse-ring"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid ${displayColor}`,
              opacity: 0.6,
            }}
          />
        )}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px dashed #fff`,
              opacity: 0.8,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: size * 0.25,
            borderRadius: '50%',
            background: displayColor,
            boxShadow: `0 0 ${size * 0.4}px ${displayColor}`,
          }}
        />
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-20"
      style={{ overflow: 'hidden' }}
    >
      {hotspots.map((h) => {
        const pos = positions[h.id];
        // 拖拽中的热点优先使用本地实时位置（保证拖拽流畅跟随鼠标）
        const dragPos = dragScreenPos[h.id];
        const finalX = dragPos ? dragPos.x : (pos ? pos.x : 0);
        const finalY = dragPos ? dragPos.y : (pos ? pos.y : 0);
        // 编辑态保留被遮挡热点，避免热点进入模型内部后无法再次选中调整；预览态严格遵循模型深度。
        if (!pos || (!pos.visible && !isEditing)) return null;
        const size = h.size || 28;
        const isHotspotSelected = isEditing && selectedHotspotId === h.id;

        return (
          <div
            key={h.id}
            className={`absolute ${isEditing && isSelected ? 'pointer-events-auto cursor-move' : isEditing ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'} group hotspot-hover-${h.hoverEffect || 'none'}`}
            style={{
              left: finalX,
              top: finalY,
              ['--hotspot-color' as string]: h.color || '#38bdf8',
              transform: 'translate(-50%, -50%)',
              zIndex: isHotspotSelected ? 40 : 30,
              touchAction: 'none',
            }}
            onPointerDown={(e) => handleHotspotPointerDown(e, h)}
            onClick={(e) => handleHotspotClick(e, h)}
            onMouseEnter={() => handleHotspotHover(h, true)}
            onMouseLeave={() => handleHotspotHover(h, false)}
            title={h.label || (resolveInteraction(h).action === 'media' ? '查看媒体' : resolveInteraction(h).action === 'url' ? '打开链接' : resolveInteraction(h).action === 'popup' ? '打开弹窗' : '跳转')}
          >
            {renderIcon(h, isHotspotSelected)}
            {/* 热点 label（悬停显示，选中时常显） */}
            {(h.label || isHotspotSelected) && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-medium pointer-events-none ${isHotspotSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                style={{
                  top: size + 4,
                  background: isHotspotSelected ? 'rgba(251,191,36,0.9)' : 'rgba(0,0,0,0.8)',
                  color: isHotspotSelected ? '#000' : '#fff',
                  border: `1px solid ${isHotspotSelected ? '#fff' : (h.color || '#38bdf8') + '66'}`,
                }}
              >
                {h.label || (isHotspotSelected ? '已选中 · 拖动移动 / Delete删除' : '')}
              </div>
            )}
          </div>
        );
      })}

      {/* 热点脉冲动画样式（内联注入一次） */}
      <style>{`
        @keyframes hotspot-pulse-anim {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .hotspot-pulse {
          animation: hotspot-pulse-anim 2s ease-in-out infinite;
        }
        @keyframes hotspot-ring-anim {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .hotspot-pulse-ring {
          animation: hotspot-ring-anim 1.8s ease-out infinite;
        }
        .hotspot-hover-glow:hover { filter: drop-shadow(0 0 12px var(--hotspot-color)); }
        .hotspot-hover-scale:hover { transform: translate(-50%, -50%) scale(1.12); }
        .hotspot-hover-float:hover { animation: hotspot-hover-float 0.9s ease-in-out infinite alternate; }
        .hotspot-hover-brighten:hover { filter: brightness(1.35) saturate(1.15); }
        .hotspot-hover-outline:hover { outline: 2px solid var(--hotspot-color); outline-offset: 4px; border-radius: 999px; }
        @keyframes hotspot-hover-float { from { margin-top: 0; } to { margin-top: -5px; } }
      `}</style>
    </div>
  );
};
