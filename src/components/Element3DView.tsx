import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SceneElement, Hotspot, type Ai3DControlKind, type Ai3DControlVariant } from '../types';
import { ThreeCanvas, type Ai3DPreviewAction, type HotspotProjector, type HotspotScreenTo3D } from './ThreeCanvas';
import { HotspotOverlay } from './HotspotOverlay';
import { Layers, Zap, Atom, GripVertical, ChevronDown, ChevronUp, RotateCcw, Camera, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface Element3DViewProps {
  el: SceneElement;
  availableModelElements?: SceneElement[];
  assetUrl?: string;
  isEditing: boolean;
  isSelected?: boolean;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void;
  onHotspotTrigger: (hotspot: Hotspot) => void;
  defaultLinkSceneId?: string;
  selectedHotspotId?: string | null;
  onSelectHotspot?: (hotspotId: string | null) => void;
  onDeleteHotspot?: (hotspotId: string) => void;
  onUpdateHotspot?: (hotspotId: string, patch: Partial<Hotspot>) => void;
  isPlaying?: boolean;
}

export const Element3DView: React.FC<Element3DViewProps> = ({
  el,
  availableModelElements = [],
  assetUrl,
  isEditing,
  isSelected = false,
  onUpdateElement,
  onHotspotTrigger,
  defaultLinkSceneId,
  selectedHotspotId,
  onSelectHotspot,
  onDeleteHotspot,
  onUpdateHotspot,
  isPlaying = false,
}) => {
  const projectionRef = useRef<HotspotProjector | null>(null);
  const screenTo3DRef = useRef<HotspotScreenTo3D | null>(null);
  const panoramaVideoRef = useRef<HTMLVideoElement | null>(null);
  const [previewAction, setPreviewAction] = useState<Ai3DPreviewAction | null>(null);
  const [panoramaVideoPlaying, setPanoramaVideoPlaying] = useState(isPlaying);
  const [panoramaVideoVolume, setPanoramaVideoVolume] = useState(1);
  const previewActionTokenRef = useRef(0);

  useEffect(() => {
    setPanoramaVideoPlaying(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    const video = panoramaVideoRef.current;
    if (!video) return;
    video.muted = el.muted === true;
    video.volume = panoramaVideoVolume;
  }, [el.muted, panoramaVideoVolume]);

  const togglePanoramaVideoPlayback = () => {
    const video = panoramaVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPanoramaVideoPlaying(true)).catch(() => setPanoramaVideoPlaying(false));
    } else {
      video.pause();
      setPanoramaVideoPlaying(false);
    }
  };

  const togglePanoramaVideoMute = () => {
    const nextMuted = !(el.muted === true);
    const video = panoramaVideoRef.current;
    if (video) video.muted = nextMuted;
    onUpdateElement(el.id, { muted: nextMuted });
  };

  const updatePanoramaVideoVolume = (value: number) => {
    const nextVolume = Math.max(0, Math.min(1, value));
    setPanoramaVideoVolume(nextVolume);
    const video = panoramaVideoRef.current;
    if (video) {
      video.volume = nextVolume;
      if (nextVolume > 0 && video.muted && el.muted !== true) video.muted = false;
    }
  };

  const handleCanvasClick = (
    _screenX: number,
    _screenY: number,
    coords: Hotspot['position']
  ) => {
    if (!isEditing) return;
    const newId = `hs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newHotspot: Hotspot = {
      id: newId,
      position: coords,
      icon: 'dot',
      color: '#38bdf8',
      size: 28,
      linkType: defaultLinkSceneId ? 'jump' : undefined,
      link: defaultLinkSceneId,
      trigger: 'click',
      visible: true,
    };
    const current = Array.isArray(el.hotspots) ? el.hotspots : [];
    onUpdateElement(el.id, { hotspots: [...current, newHotspot] });
  };

  const handleHotspotDrag = (hotspotId: string, screenX: number, screenY: number) => {
    if (!isEditing) return;
    const screenTo3D = screenTo3DRef.current;
    if (!screenTo3D) return;
    const coords = screenTo3D(screenX, screenY);
    if (coords) {
      onUpdateHotspot?.(hotspotId, { position: coords });
    }
  };

  const handleHotspotClick = (hotspot: Hotspot) => {
    if (isEditing) {
      onSelectHotspot?.(hotspot.id);
      return;
    }
    onHotspotTrigger(hotspot);
  };

  const autoRotate =
    el.type === 'panorama-img' || el.type === 'panorama-vid'
      ? el.panoramaAutoRotate
      : el.modelAutoRotate;
  const autoRotateSpeed =
    el.type === 'panorama-img' || el.type === 'panorama-vid'
      ? el.panoramaAutoRotateSpeed || 1
      : el.modelAutoRotateSpeed || 1;

  const hotspots = Array.isArray(el.hotspots) ? el.hotspots : [];

  const handleFovChange = (newFov: number) => {
    if (!isEditing) return;
    onUpdateElement(el.id, { panoramaFov: newFov });
  };

  // AI 3D 控制
  const isAi3DModel = el.type === 'model-3d';
  const layersValue = el.ai3dLayers || 0;
  const explodeValue = el.ai3dExplode || 0;
  const physicsActive = !!el.ai3dPhysics;
  const modelScale = el.modelScale ?? 1;
  const modelDistance = el.modelCameraDistance && el.modelCameraDistance > 0 ? el.modelCameraDistance : 6;

  const playPreviewAction = (kind: Ai3DPreviewAction['kind']) => {
    setPreviewAction((current) => {
      const active = !current || current.kind !== kind || !current.active;
      return { kind, token: ++previewActionTokenRef.current, active };
    });
  };
  const previewControlDefs: Array<{ kind: Ai3DControlKind; label: string; icon: typeof Layers; color: string }> = [
    { kind: 'layers', label: '分层', icon: Layers, color: 'cyan' },
    { kind: 'explode', label: '爆炸', icon: Zap, color: 'orange' },
    { kind: 'physics', label: '碰撞', icon: Atom, color: 'purple' },
  ];
  const previewControls = previewControlDefs.filter(({ kind }) => el.ai3dPreviewControls?.[kind]?.visible !== false);
  const controlVariant = (kind: Ai3DControlKind): Ai3DControlVariant =>
    el.ai3dPreviewControls?.[kind]?.variant || el.ai3dControlVariant || 'glass';
  const viewPresets = [
    { label: '正面', azimuth: 0, elevation: 0 },
    { label: '右侧', azimuth: 90, elevation: 0 },
    { label: '背面', azimuth: 180, elevation: 0 },
    { label: '顶部', azimuth: 0, elevation: 80 },
    { label: '等距', azimuth: 45, elevation: 28 },
  ];
  const effectDirections = [
    { value: 'radial', label: '径向' }, { value: 'up', label: '上' }, { value: 'down', label: '下' },
    { value: 'left', label: '左' }, { value: 'right', label: '右' }, { value: 'front', label: '前' }, { value: 'back', label: '后' },
  ] as const;

  // 控制面板状态
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // 从 localStorage 恢复面板位置
  useEffect(() => {
    const saved = localStorage.getItem(`aether_3d_panel_pos_${el.id}`);
    if (saved) {
      try { setPanelPos(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [el.id]);

  const handlePanelDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).closest('.ai3d-control-panel')?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: panelPos?.x ?? rect.left,
      origY: panelPos?.y ?? rect.top,
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPanelPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (panelPos) localStorage.setItem(`aether_3d_panel_pos_${el.id}`, JSON.stringify(panelPos));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [panelPos, el.id]);

  // 三种模型动效共用同一组参数：调整一种动效时清零其它动效，避免
  // “分层 + 爆炸 + 碰撞”同时残留导致预览和导出状态不一致。
  const handleLayersChange = (v: number) => onUpdateElement(el.id, {
    ai3dLayers: v,
    ai3dExplode: 0,
    ai3dPhysics: false,
  });
  const handleExplodeChange = (v: number) => onUpdateElement(el.id, {
    ai3dExplode: v,
    ai3dLayers: 0,
    ai3dPhysics: false,
  });
  const handleTogglePhysics = () => {
    const next = !physicsActive;
    onUpdateElement(el.id, {
      ai3dPhysics: next,
      ...(next ? { ai3dLayers: 0, ai3dExplode: 0 } : {}),
    });
  };
  const handleReset = () => {
    onUpdateElement(el.id, {
      ai3dLayers: 0,
      ai3dExplode: 0,
      ai3dPhysics: false,
      ai3dLoopEnabled: true,
      modelViewAzimuth: 0,
      modelViewElevation: 0,
      modelCameraDistance: 0,
      modelScale: 1,
      ai3dLayerDirection: 'up',
      ai3dLayerDistance: 1,
      ai3dExplodeDirection: 'radial',
      ai3dExplodeDistance: 1,
      ai3dExplodeSpeed: 1,
      ai3dExplodeSpin: 0.5,
      ai3dCollisionDirection: 'radial',
      ai3dCollisionDistance: 1,
      ai3dCollisionBounce: 0.5,
      ai3dCollisionSpeed: 1,
    });
  };

  const panelStyle: React.CSSProperties = panelPos
    ? { position: 'fixed', left: panelPos.x, top: panelPos.y, zIndex: 50 }
    : {};

  return (
    <div className="relative w-full h-full">
      <ThreeCanvas
        element={el}
        assetUrl={assetUrl}
        isEditing={isEditing}
        isSelected={isSelected}
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
        isPlaying={isPlaying}
        previewAction={!isEditing && isAi3DModel ? previewAction : null}
        fov={el.panoramaFov || 75}
        onFovChange={handleFovChange}
        onModelViewChange={(view) => onUpdateElement(el.id, {
          modelViewAzimuth: view.azimuth,
          modelViewElevation: view.elevation,
          modelCameraDistance: view.distance,
        })}
        onCanvasClick={handleCanvasClick}
        projectionRef={projectionRef}
        screenTo3DRef={screenTo3DRef}
        videoElementRef={panoramaVideoRef}
      />
      {el.type === 'panorama-vid' && el.videoControls === true && (
        <div
          className={`absolute inset-x-3 bottom-3 z-30 flex items-center gap-2 rounded-lg border px-2 py-1.5 shadow-xl backdrop-blur-md aether-panorama-controls aether-video-player-${el.videoPlayerStyle || 'none'}`}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={togglePanoramaVideoPlayback}
            aria-label={panoramaVideoPlaying ? '暂停全景视频' : '播放全景视频'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {panoramaVideoPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={togglePanoramaVideoMute}
            aria-label={el.muted === true ? '取消静音' : '静音'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {el.muted === true ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={panoramaVideoVolume}
            onChange={(event) => updatePanoramaVideoVolume(Number(event.target.value))}
            aria-label="全景视频音量"
            className="h-1 min-w-0 flex-1 accent-sky-400"
          />
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-slate-300">{Math.round(panoramaVideoVolume * 100)}%</span>
        </div>
      )}
      {hotspots.length > 0 && !(isAi3DModel && !isEditing && previewAction?.kind === 'layers' && previewAction.active) && (
        <HotspotOverlay
          hotspots={hotspots}
          projectionRef={projectionRef}
          isEditing={isEditing}
          isSelected={isSelected}
          onHotspotClick={handleHotspotClick}
          selectedHotspotId={selectedHotspotId || null}
          onHotspotDrag={handleHotspotDrag}
          modelElements={availableModelElements}
        />
      )}

      {!isEditing && isAi3DModel && previewControls.length > 0 && (
        <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/65 p-1.5 shadow-xl backdrop-blur-md">
            {previewControls.map(({ kind, label, icon: Icon, color }) => {
              const selected = previewAction?.kind === kind && previewAction.active;
              const variant = controlVariant(kind);
              const active = color === 'cyan' ? 'bg-cyan-500/30 text-cyan-100 border-cyan-300/40' : color === 'orange' ? 'bg-orange-500/30 text-orange-100 border-orange-300/40' : 'bg-purple-500/30 text-purple-100 border-purple-300/40';
              const idle = color === 'cyan' ? 'text-slate-200 hover:bg-cyan-400/15 hover:text-cyan-100' : color === 'orange' ? 'text-slate-200 hover:bg-orange-400/15 hover:text-orange-100' : 'text-slate-200 hover:bg-purple-400/15 hover:text-purple-100';
              const variantClass = variant === 'solid' ? 'bg-white/15 border-white/20' : variant === 'outline' ? 'bg-transparent border-white/25' : variant === 'minimal' ? 'bg-transparent border-transparent' : 'bg-black/25 border-white/15';
              return (
                <button
                  key={kind}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    playPreviewAction(kind);
                  }}
                  aria-pressed={selected}
                  className={`flex h-10 min-w-20 touch-manipulation select-none items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selected ? `${active} shadow-lg` : `${variantClass} ${idle}`}`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{el.ai3dPreviewControls?.[kind]?.label || label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI 3D 模型控制面板（可拖拽、可折叠、滑块控制）*/}
      {isAi3DModel && isEditing && isSelected && el.ai3dShowPanel !== false && (
        <div
          className="ai3d-control-panel"
          style={panelStyle}
        >
          <div className={`w-64 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden transition-all ${panelCollapsed ? '' : ''}`}>
            {/* 标题栏（可拖拽）*/}
            <div
              className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={handlePanelDragStart}
            >
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-white tracking-wide">3D 动效控制</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="重置动效与展示视角"
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setPanelCollapsed(!panelCollapsed)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  {panelCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>
            </div>

            {/* 控制内容*/}
            {!panelCollapsed && (
              <div className="p-3 space-y-3">
                <div className="space-y-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-1.5">
                    <Camera size={14} className="text-sky-300" />
                    <span className="text-xs font-semibold text-slate-200">展示视角</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {viewPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onUpdateElement(el.id, {
                          modelViewAzimuth: preset.azimuth,
                          modelViewElevation: preset.elevation,
                        })}
                        className="min-w-0 rounded bg-white/5 px-1 py-1.5 text-[9px] text-slate-300 transition-colors hover:bg-sky-400/20 hover:text-sky-100"
                        title={`切换至${preset.label}视角`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[10px] text-slate-400">
                      水平 {Math.round(el.modelViewAzimuth ?? 0)}°
                      <input type="range" min={-180} max={180} step={1} value={el.modelViewAzimuth ?? 0}
                        onChange={(e) => onUpdateElement(el.id, { modelViewAzimuth: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                    <label className="space-y-1 text-[10px] text-slate-400">
                      俯仰 {Math.round(el.modelViewElevation ?? 0)}°
                      <input type="range" min={-80} max={80} step={1} value={el.modelViewElevation ?? 0}
                        onChange={(e) => onUpdateElement(el.id, { modelViewElevation: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[10px] text-slate-400">
                      距离 {modelDistance.toFixed(1)}
                      <input type="range" min={0.5} max={50} step={0.1} value={modelDistance}
                        onChange={(e) => onUpdateElement(el.id, { modelCameraDistance: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                    <label className="space-y-1 text-[10px] text-slate-400">
                      缩放 {modelScale.toFixed(1)}x
                      <input type="range" min={0.3} max={3} step={0.1} value={modelScale}
                        onChange={(e) => onUpdateElement(el.id, { modelScale: Number(e.target.value) })}
                        className="w-full h-1 accent-sky-400" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-400">自动旋转</span>
                    <button
                      type="button"
                      onClick={() => onUpdateElement(el.id, { modelAutoRotate: !el.modelAutoRotate })}
                      aria-label="切换自动旋转"
                      aria-pressed={!!el.modelAutoRotate}
                      className={`relative h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${el.modelAutoRotate ? 'bg-sky-500' : 'bg-white/15'}`}
                      title="切换自动旋转"
                    >
                      <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${el.modelAutoRotate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <label className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[10px] text-slate-400">
                    <span>速度</span>
                    <input type="range" min={0.2} max={3} step={0.1} value={el.modelAutoRotateSpeed ?? 1}
                      onChange={(e) => onUpdateElement(el.id, { modelAutoRotateSpeed: Number(e.target.value) })}
                      className="min-w-0 w-full h-1 accent-sky-400" aria-label="自动旋转速度" />
                    <output className="w-7 text-right font-mono text-sky-200">{(el.modelAutoRotateSpeed ?? 1).toFixed(1)}x</output>
                  </label>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-300">循环动画</span>
                    <span className="block text-[9px] text-slate-500">控制爆炸与碰撞的循环</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateElement(el.id, { ai3dLoopEnabled: el.ai3dLoopEnabled === false })}
                    aria-label="切换 3D 循环动画"
                    aria-pressed={el.ai3dLoopEnabled !== false}
                    className={`relative h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${el.ai3dLoopEnabled !== false ? 'bg-cyan-500' : 'bg-white/15'}`}
                  >
                    <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${el.ai3dLoopEnabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {/* 分层滑块 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers size={14} className="text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-200">分层展开</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                      {Math.round(layersValue * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={layersValue}
                    onChange={(e) => handleLayersChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400"
                    style={{
                      background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${layersValue * 100}%, rgba(255,255,255,0.15) ${layersValue * 100}%, rgba(255,255,255,0.15) 100%)`,
                    }}
                  />
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <select value={el.ai3dLayerDirection || 'up'} onChange={(e) => onUpdateElement(el.id, { ai3dLayerDirection: e.target.value as SceneElement['ai3dLayerDirection'] })} className="min-w-0 rounded bg-black/30 border border-white/10 px-1.5 py-1 text-[10px] text-slate-300" aria-label="分层方向">
                      {effectDirections.map((item) => <option key={item.value} value={item.value}>方向：{item.label}</option>)}
                    </select>
                    <label className="text-[10px] text-slate-400 whitespace-nowrap">距离 {Math.round((el.ai3dLayerDistance ?? 1) * 100)}%
                      <input type="range" min={0} max={2} step={0.05} value={el.ai3dLayerDistance ?? 1} onChange={(e) => onUpdateElement(el.id, { ai3dLayerDistance: Number(e.target.value) })} className="ml-1 w-16 h-1 align-middle accent-cyan-400" aria-label="分层距离" />
                    </label>
                  </div>
                </div>

                {/* 爆炸滑块 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap size={14} className="text-orange-400" />
                      <span className="text-xs font-semibold text-slate-200">爆炸飞散</span>
                    </div>
                    <span className="text-[10px] font-mono text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded">
                      {Math.round(explodeValue * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={explodeValue}
                    onChange={(e) => handleExplodeChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-orange-400"
                    style={{
                      background: `linear-gradient(to right, #fb923c 0%, #fb923c ${explodeValue * 100}%, rgba(255,255,255,0.15) ${explodeValue * 100}%, rgba(255,255,255,0.15) 100%)`,
                    }}
                  />
                  <p className="text-[10px] text-orange-200/70">以模型中心为原点向外飞散</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-slate-400">范围 {Math.round((el.ai3dExplodeDistance ?? 1) * 100)}%
                      <input type="range" min={0} max={2} step={0.05} value={el.ai3dExplodeDistance ?? 1} onChange={(e) => onUpdateElement(el.id, { ai3dExplodeDistance: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-orange-400" aria-label="爆炸飞散范围" />
                    </label>
                    <label className="text-[10px] text-slate-400">节奏 {(el.ai3dExplodeSpeed ?? 1).toFixed(1)}x
                      <input type="range" min={0.3} max={3} step={0.1} value={el.ai3dExplodeSpeed ?? 1} onChange={(e) => onUpdateElement(el.id, { ai3dExplodeSpeed: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-orange-400" aria-label="爆炸节奏" />
                    </label>
                    <label className="col-span-2 text-[10px] text-slate-400">旋转 {Math.round((el.ai3dExplodeSpin ?? 0.5) * 100)}%
                      <input type="range" min={0} max={1} step={0.05} value={el.ai3dExplodeSpin ?? 0.5} onChange={(e) => onUpdateElement(el.id, { ai3dExplodeSpin: Number(e.target.value) })} className="ml-2 w-24 h-1 align-middle accent-orange-400" aria-label="爆炸旋转幅度" />
                    </label>
                  </div>
                </div>

                {/* 碰撞开关 */}
                <button
                  type="button"
                  onClick={handleTogglePhysics}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                    physicsActive
                      ? 'bg-purple-500/30 border border-purple-400/50 shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Atom size={15} className={physicsActive ? 'text-purple-300' : 'text-slate-400'} />
                    <span className={`text-xs font-semibold ${physicsActive ? 'text-purple-200' : 'text-slate-300'}`}>
                      物理碰撞
                    </span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${physicsActive ? 'bg-purple-500' : 'bg-white/20'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${physicsActive ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </button>
                <p className="text-[10px] text-purple-200/70">以模型中心为原点径向冲击与回弹</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-slate-400">范围 {Math.round((el.ai3dCollisionDistance ?? 1) * 100)}%
                    <input type="range" min={0} max={2} step={0.05} value={el.ai3dCollisionDistance ?? 1} onChange={(e) => onUpdateElement(el.id, { ai3dCollisionDistance: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-purple-400" aria-label="碰撞冲击范围" />
                  </label>
                  <label className="text-[10px] text-slate-400">频率 {(el.ai3dCollisionSpeed ?? 1).toFixed(1)}x
                    <input type="range" min={0.3} max={3} step={0.1} value={el.ai3dCollisionSpeed ?? 1} onChange={(e) => onUpdateElement(el.id, { ai3dCollisionSpeed: Number(e.target.value) })} className="mt-1 block w-full h-1 accent-purple-400" aria-label="碰撞频率" />
                  </label>
                  <label className="col-span-2 text-[10px] text-slate-400">回弹 {Math.round((el.ai3dCollisionBounce ?? 0.5) * 100)}%
                    <input type="range" min={0} max={1} step={0.05} value={el.ai3dCollisionBounce ?? 0.5} onChange={(e) => onUpdateElement(el.id, { ai3dCollisionBounce: Number(e.target.value) })} className="ml-2 w-24 h-1 align-middle accent-purple-400" aria-label="碰撞回弹幅度" />
                  </label>
                </div>

                {/* 提示 */}
                <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                  爆炸为受限开合循环 · 碰撞为小范围回弹循环
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 透明选中层 */}
      {isEditing && !isSelected && (
        <div className="absolute inset-0 z-10 cursor-grab bg-transparent" />
      )}
    </div>
  );
};
