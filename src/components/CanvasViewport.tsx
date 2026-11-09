import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { 
  Play, Pause, Rewind, FastForward, Maximize2, Minimize2,
  X, RefreshCw, Volume2, VolumeX, Eye, Zap, Compass, Sparkles, Flame,
  PenTool, Check, CircleDot, Undo2, Upload, Image as ImageIcon, Video as VideoIcon,
  Music, Box, Globe, Hand, ArrowRight, MessageSquare, ChevronDown, ChevronUp,
  Magnet, Grid, Shield, Maximize, ZoomOut, ZoomIn, RotateCw,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter
} from 'lucide-react';
import { ProjectData, Scene, SceneElement, ViewportState, Hotspot, SceneTransitionType, SceneTransitionOverride, type ContinuousInteractionConfig, type ContinuousInteractionNode, type InteractionEffect, type LoopAnimType, type SceneComment } from '../types';
import { isSafeInteractionUrl, resolveInteraction, type InteractionConfig } from '../utils/interactionModel';
import { dbManager } from '../utils/db';
import { getShapeBackground } from '../utils/shapeStyles';
import { getGradientBackground } from '../utils/shapeStyles';
import { getTextEditorStyle, getTextStyle } from '../utils/typography';
import { getLayerMaskClipPath, normalizeLayerMask } from '../utils/layerMask';
// 3D/鍏ㄦ櫙娓叉煋缁勪欢鎳掑姞杞斤細浠呭湪宸ョ▼瀛樺湪 3D 鍏冪礌鏃舵墠鎷夊彇 three.js / gaussian-splats-3d锛?
// 鏄捐憲闄嶄綆棣栧睆鍔犺浇浣撶Н锛堥粯璁ゅ伐绋嬩笉鍚?3D 鍏冪礌鏃跺畬鍏ㄤ笉鍔犺浇閲嶅簱锛?
const Element3DView = lazy(() =>
  import('./Element3DView').then((m) => ({ default: m.Element3DView }))
);
// VFX 绘制实现（含 200+ KB 动效代码）只在存在 VFX 图层时加载。
const VfxMotionCanvas = lazy(() =>
  import('./VfxMotionCanvas').then((m) => ({ default: m.VfxMotionCanvas }))
);
// UI 组件渲染器依赖 GalaxyComponents（300+ KB），只在存在 UI 组件时加载。
const ScaledUIComponent = lazy(() =>
  import('./ui/ScaledUIComponent').then((m) => ({ default: m.ScaledUIComponent }))
);

const LazyScaledUIComponent: React.FC<React.ComponentProps<typeof ScaledUIComponent>> = (props) => (
  <Suspense fallback={null}>
    <ScaledUIComponent {...props} />
  </Suspense>
);
import { 
  calculateSaberMotion, 
  getSaberEffectProfile,
  SABER_STYLE_THEMES,
  splitSvgSubpaths,
  BezierNode, 
  bezierNodesToSvgPath, 
  normalizePenNodes 
} from '../utils/saberPresets';
import { ChartElementView } from '../utils/charts';
import { GalaxyComponentType, GALAXY_COMPONENT_BASE_SIZE, isContinuousInteractionComponent } from './ui/galaxyComponentMeta';

import { PresentationStage } from './PresentationStage';
import { SceneRenderer } from './SceneRenderer';
import { resolveBindings } from '../utils/bindings';
import { getLoopableSceneKeys } from '../utils/sceneLoop';
import { getProjectCanvas } from '../utils/canvas';
import type { VfxMotionId } from '../utils/vfxMotions';
import { isCardLayoutMotion } from './CardLayoutVfx';
import { isDirectMorphMotion, isMorphMotion, type DirectMorphMotionId } from './MorphVfx';
import { buildCustomCodeSrcDoc, getCustomCodeAspectRatio, inspectCustomCodePlugin } from '../utils/customCode';
import { TransparentCustomCodeFrame, type CustomCodeFrameBounds } from './TransparentCustomCodeFrame';
import type { CustomCodeTextStyle } from '../utils/customCode';
import { computePopupGeometry, createDefaultPopup, getPopups, isLongLivedPopup, normalizePopupTheme, popupCollectionPatch, POPUP_COLORS, resizePopupPercent, resolvePopupAspectRatio, shouldUseFreePopupResize } from '../utils/popups';
import { normalizeContinuousInteraction, resolveContinuousNodePopup } from '../utils/continuousInteraction';
import { getTextAreaSelection, type TextSelectionInfo } from '../utils/textEditing';
import { alignElements, distributeElements, type AlignMode } from '../utils/alignment';
import { keyboardEventToShortcut, normalizeShortcutKey } from '../utils/shortcutKeys';
import { loadCustomShortcuts } from './ShortcutsManager';
import { runInteractionSteps } from '../utils/interactionRuntime';
import { switchInstanceVariant } from '../utils/componentMasters';
import { usePlaybackClockTime } from '../core/playbackClock';
import { isTimelineTimeVisible } from '../core/render/timeline';
import { getLayerPlaybackConfig, getLoopAnimationTime, shouldRepeatVideo } from '../core/render/layerPlayback';
import { evaluateAnimatedProperty, evaluateElementProperties, getPropertyTrack, upsertKeyframe } from '../core/animation/keyframes';
import { getBoundsAspectRatio, getTextResizeFontSize, isAspectRatioResizeLocked, resizeRectWithAspect } from '../core/render/resize';
import { getContextTargetMenuPosition } from '../utils/contextMenuPosition';
import { getSceneBackgroundStyle } from '../utils/sceneBackground';
import { getContextInteractionSummary } from '../utils/contextInteractionSummary';
import { captureStageThumbnail } from '../core/project/thumbnail';
import { loadRuntimeAssetUrl, resolveExportPlayerAssetUrl } from '../utils/runtimeAssetUrl';

const ELEMENT_RESIZE_MIN = 2;

// Shared screen-space selection chrome for every canvas element type.
// Handles stay usable and visually consistent while the canvas zooms.
const SELECTION_CHROME = {
  handleHitSize: 16,
  handleVisualSize: 8,
  rotateOffset: 28,
  accent: '#38bdf8',
} as const;

const ALIGNMENT_TOOLBAR_ACTIONS = [
  { id: 'align-left', label: '左对齐', icon: AlignStartVertical },
  { id: 'align-center', label: '水平居中', icon: AlignCenterVertical },
  { id: 'align-right', label: '右对齐', icon: AlignEndVertical },
  { id: 'align-top', label: '顶对齐', icon: AlignStartHorizontal },
  { id: 'align-middle', label: '垂直居中', icon: AlignCenterHorizontal },
  { id: 'align-bottom', label: '底对齐', icon: AlignEndHorizontal },
  { id: 'distribute-horizontal', label: '水平等距', icon: AlignHorizontalDistributeCenter },
  { id: 'distribute-vertical', label: '垂直等距', icon: AlignVerticalDistributeCenter },
] as const;

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)
    || element.isContentEditable
    || !!element.closest?.('[contenteditable="true"]');
};

type ContextTargetAction = 'jump' | 'popup' | 'transition';

const ContextTargetMenu: React.FC<{
  x: number;
  y: number;
  activeSceneId: string;
  scenes: ProjectData['scenes'];
  onAssign: (action: ContextTargetAction, targetSceneId: string) => void;
  onClose: () => void;
  heading?: string;
  currentInteraction?: InteractionConfig;
}> = ({ x, y, activeSceneId, scenes, onAssign, onClose, heading = '快捷指定交互目标', currentInteraction }) => {
  const targets = Object.entries(scenes).filter(([sceneId]) => sceneId !== activeSceneId);
  const position = getContextTargetMenuPosition(x, y, window.innerWidth, window.innerHeight);
  const interactionSummary = currentInteraction
    ? getContextInteractionSummary(currentInteraction, scenes)
    : null;
  return (
    <div
      data-testid="context-target-menu"
      className="fixed z-[10060] flex max-h-[min(70vh,32.5rem)] w-56 flex-col overflow-hidden rounded-lg border border-sky-400/25 bg-[#161822] py-1 shadow-2xl"
      style={position}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div aria-label={heading} className="px-3 py-2 text-[0px] text-slate-400 font-medium border-b border-white/5 flex items-center gap-1.5">
        <span className="text-[10px]">{heading}</span>
        <ArrowRight size={12} className="text-sky-400" /> 快捷指定交互目标
      </div>
      {interactionSummary && (
        <div className={`border-b border-white/5 px-3 py-2 text-[10px] leading-4 ${
          interactionSummary.tone === 'warning'
            ? 'text-amber-300'
            : interactionSummary.tone === 'active'
              ? 'text-sky-200'
              : 'text-slate-500'
        }`}>
          {interactionSummary.text}
        </div>
      )}
      {targets.length === 0 ? (
        <div className="px-3 py-3 text-[11px] text-slate-500">请先创建另一个场景</div>
      ) : (
        <div data-testid="context-target-menu-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500">跳转到场景</div>
          {targets.map(([sceneId, scene]) => (
            <button key={`jump-${sceneId}`} type="button" onClick={() => onAssign('jump', sceneId)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-sky-500/20 hover:text-sky-200 transition-colors">
              <ArrowRight size={12} className="text-sky-400" /> <span className="truncate">{scene.alias || sceneId}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-white/5" />
          <div className="px-3 pt-1 pb-1 text-[10px] text-slate-500">转场 / 弹窗</div>
          {targets.map(([sceneId, scene]) => (
            <div key={`actions-${sceneId}`} className="flex items-center gap-1 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{scene.alias || sceneId}</span>
              <button type="button" onClick={() => onAssign('transition', sceneId)} className="rounded px-1.5 py-1 text-[10px] text-violet-300 hover:bg-violet-500/20" title="使用淡入淡出转场">转场</button>
              <button type="button" onClick={() => onAssign('popup', sceneId)} className="rounded px-1.5 py-1 text-[10px] text-fuchsia-300 hover:bg-fuchsia-500/20" title="以弹窗方式打开场景"><MessageSquare size={11} /></button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={onClose} className="w-full mt-1 border-t border-white/5 px-3 py-1.5 text-left text-[10px] text-slate-500 hover:text-slate-300">取消</button>
    </div>
  );
};

/** Each popup instance owns its target, geometry and presentation. Trigger fields are
 * only a fallback for legacy projects that predate the popup collection. */
function resolvePopupPresentation(trigger: SceneElement, popup: Record<string, any>): SceneElement {
  return {
    ...trigger,
    ...popup,
    // Node/popup values are explicit overrides. The trigger remains the fallback
    // for legacy one-to-many popups and unconfigured continuous-interaction nodes.
    popupAnimationType: popup.popupAnimationType ?? trigger.popupAnimationType,
    popupExitAnimationType: popup.popupExitAnimationType ?? trigger.popupExitAnimationType,
    popupStayMode: popup.popupStayMode ?? trigger.popupStayMode,
    popupAnimationDuration: popup.popupAnimationDuration ?? trigger.popupAnimationDuration,
    popupDisplay: popup.popupDisplay ?? trigger.popupDisplay,
    popupOverlayOpacity: popup.popupOverlayOpacity ?? trigger.popupOverlayOpacity,
    popupOverlayBlur: popup.popupOverlayBlur ?? trigger.popupOverlayBlur,
    popupCloseOnOverlay: popup.popupCloseOnOverlay ?? trigger.popupCloseOnOverlay,
    popupTheme: popup.popupTheme ?? trigger.popupTheme,
    popupBgColor: popup.popupBgColor ?? trigger.popupBgColor,
    popupBorderColor: popup.popupBorderColor ?? trigger.popupBorderColor,
    popupGlowColor: popup.popupGlowColor ?? trigger.popupGlowColor,
    popupTitleColor: popup.popupTitleColor ?? trigger.popupTitleColor,
    popupAccentColor: popup.popupAccentColor ?? trigger.popupAccentColor,
    popupRadius: popup.popupRadius ?? trigger.popupRadius,
  } as SceneElement;
}

function getPopupEnterAnimationClass(animation?: string): string {
  const classes: Record<string, string> = {
    fadeIn: 'aether-popup-anim aether-popup-ease-cubic aether-popup-fade-in',
    slideUp: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-up-in',
    slideDown: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-down-in',
    slideLeft: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-left-in',
    slideRight: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-right-in',
    zoomIn: 'aether-popup-anim aether-popup-ease-quint aether-popup-zoom-in-in',
    zoomOut: 'aether-popup-anim aether-popup-ease-quint aether-popup-zoom-out-in',
    bounce: 'aether-popup-anim aether-popup-bounce-in',
    rotate: 'aether-popup-anim aether-popup-ease-quint aether-popup-rotate-in',
  };
  return animation && animation !== 'none' ? classes[animation] || '' : '';
}

function getPopupExitAnimationClass(animation?: string): string {
  const classes: Record<string, string> = {
    fadeOut: 'aether-popup-anim aether-popup-ease-cubic aether-popup-fade-out',
    slideUp: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-up-out',
    slideDown: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-down-out',
    slideLeft: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-left-out',
    slideRight: 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-right-out',
    zoomOut: 'aether-popup-anim aether-popup-ease-quint aether-popup-zoom-in-out',
    zoomIn: 'aether-popup-anim aether-popup-ease-quint aether-popup-zoom-out-out',
    bounce: 'aether-popup-anim aether-popup-bounce-out',
    rotate: 'aether-popup-anim aether-popup-ease-quint aether-popup-rotate-out',
  };
  return animation && animation !== 'none' ? classes[animation] || '' : '';
}

function getPopupExitDuration(config: Record<string, any>, scene?: Scene): number {
  const exitAnimation = config.popupExitAnimationType ?? 'fadeOut';
  const cardDuration = exitAnimation === 'none'
    ? 0
    : Math.round((config.popupAnimationDuration || 500) * 0.72);
  // A card-level exit is the visible transition. Running the popup scene's
  // own transition beneath it creates a second, unsynchronised animation.
  if (cardDuration > 0) return cardDuration;
  const sceneDuration = scene?.transitionOut && scene.transitionOut !== 'none'
    ? (scene.transitionDuration ?? 0.6) * 1000
    : 0;
  return sceneDuration;
}

const INTERACTION_LOOP_ANIMS: Partial<Record<InteractionEffect, LoopAnimType>> = {
  'loop-pulse': 'pulse',
  'loop-float': 'float',
  'loop-spin': 'spin',
  'loop-shimmer': 'shimmer',
  'loop-breathe': 'breathe',
  'loop-swing': 'swing',
  'loop-shake': 'shake',
  'loop-heartbeat': 'heartbeat',
  'loop-blink': 'blink',
  'loop-wave': 'wave',
  'loop-neon-pulse': 'neon-pulse',
  'loop-data-flow': 'data-flow',
  'loop-hologram-flicker': 'hologram-flicker',
  'loop-orbit-spin': 'orbit-spin',
};

function getInteractionLoopAnim(effect?: InteractionEffect): LoopAnimType | null {
  return effect ? INTERACTION_LOOP_ANIMS[effect] || null : null;
}

type DirectMorphTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotateZ: number;
  skewX: number;
};

const getDirectMorphProgress = (elapsed: number, startProgress: number) => {
  const value = Math.max(0, Math.min(1, elapsed));
  if (value < 0.44) {
    const eased = 1 - Math.pow(1 - value / 0.44, 3);
    return startProgress + (1 - startProgress) * eased;
  }
  return Math.pow(1 - (value - 0.44) / 0.56, 3);
};

const getDirectMorphTransform = (motion: DirectMorphMotionId | null, progress: number, intensity: number): DirectMorphTransform => {
  const pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
  const strength = Math.max(0, Math.min(1, intensity / 100));
  const transform: DirectMorphTransform = { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotateZ: 0, skewX: 0 };
  if (motion === 'morph-circle-pill') {
    transform.scaleX += 0.18 * strength * pulse;
    transform.scaleY -= 0.12 * strength * pulse;
  } else if (motion === 'morph-size') {
    const scale = 1 + 0.14 * strength * pulse;
    transform.scaleX = scale;
    transform.scaleY = scale;
  } else if (motion === 'morph-reverse-collapse') {
    transform.scaleX -= 0.14 * strength * pulse;
    transform.scaleY -= 0.2 * strength * pulse;
  }
  return transform;
};

const getDirectMorphBorderRadius = (motion: DirectMorphMotionId | null, progress: number, baseRadius: number) => {
  if (motion !== 'morph-reverse-collapse') return baseRadius;
  const pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
  const targetRadius = baseRadius >= 999 ? 18 : Math.max(16, baseRadius * 1.8);
  return baseRadius + (targetRadius - baseRadius) * pulse;
};

function getElementResizeAspect(element: SceneElement, canvasWidth: number, canvasHeight: number): number {
  if (element.type === 'ui-component' && element.uiComponentType === 'official-modao') {
    // 官方组件以首次测量得到的真实绘制比例为准，避免旧工程里外框比例
    // 与组件内容比例不一致时，拖动控制点产生跳变。
    const officialAspect = Number(element.uiComponentData?.officialAspect);
    if (Number.isFinite(officialAspect) && officialAspect > 0) return officialAspect;
  }
  if (element.type === 'custom-code') {
    if (Number(element.w) > 0 && Number(element.h) > 0) {
      return getBoundsAspectRatio(Number(element.w), Number(element.h), canvasWidth, canvasHeight);
    }
    if (element.customCode) {
      return getCustomCodeAspectRatio(element.customCode);
    }
  }
  if ((element.type === 'img' || element.type === 'vid')
    && Number.isFinite(element.mediaAspect)
    && (element.mediaAspect || 0) > 0) {
    return element.mediaAspect!;
  }
  return getBoundsAspectRatio(Number(element.w) || 0, Number(element.h) || 0, canvasWidth, canvasHeight);
}

const AutoFitText: React.FC<{
  children: React.ReactNode;
  className?: string;
  textBounds?: boolean;
  autoFit?: boolean;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textAlign?: 'left' | 'center' | 'right';
}> = ({
  children,
  className,
  textBounds,
  autoFit = false,
  verticalAlign = 'middle',
  textAlign = 'center',
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [scale, setScale] = useState(1);
  const lastScaleRef = useRef(1);

  useEffect(() => {
    if (!autoFit) {
      if (lastScaleRef.current !== 1) {
        lastScaleRef.current = 1;
        setScale(1);
      }
      return;
    }
    const node = ref.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;

    let rafId: number | null = null;
    const measure = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!node || !parent) return;
        const pw = parent.clientWidth || 0;
        const ph = parent.clientHeight || 0;
        if (pw <= 0 || ph <= 0) return;
        const nw = node.offsetWidth || 0;
        const nh = node.offsetHeight || 0;
        if (nw <= 0 || nh <= 0) return;
        const currentScale = lastScaleRef.current;
        const unscaledW = nw / (currentScale || 1);
        const unscaledH = nh / (currentScale || 1);
        if (unscaledW <= 0 || unscaledH <= 0) return;
        const targetScale = Math.min(1, Math.min(pw / unscaledW, ph / unscaledH));
        const safeScale = Number.isFinite(targetScale) && targetScale > 0.05 ? Math.round(targetScale * 100) / 100 : 1;
        if (Math.abs(safeScale - lastScaleRef.current) > 0.04) {
          lastScaleRef.current = safeScale;
          setScale(safeScale);
        }
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [children, autoFit]);

  const originX = textAlign === 'left' ? 'left' : textAlign === 'right' ? 'right' : 'center';
  const originY = verticalAlign === 'top' ? 'top' : verticalAlign === 'bottom' ? 'bottom' : 'center';

  return (
    <span
      ref={ref}
      data-aether-text-bounds={textBounds ? 'true' : undefined}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        transform: autoFit && scale < 0.99 ? `scale(${scale})` : undefined,
        transformOrigin: `${originX} ${originY}`,
        backgroundImage: 'inherit',
        backgroundClip: 'inherit',
        WebkitBackgroundClip: 'inherit',
        WebkitTextFillColor: 'inherit',
        WebkitTextStroke: 'inherit',
      }}
    >
      {children}
    </span>
  );
};


interface CanvasViewportProps {
  projectData: ProjectData;
  /** Prevent renderer measurements from mutating the pre-hydration fallback project. */
  projectHydrated?: boolean;
  activeSceneId: string;
  onSelectScene: (id: string, override?: SceneTransitionOverride) => void;
  selectedElementId: string | null;
  /** When selected from the timeline, isolate this layer as the sole canvas edit target. */
  timelineEditTargetId?: string | null;
  multiSelectedIds: string[];
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>, actionTitle?: string, recordHistory?: boolean) => void;
  /** 鎷栨嫿/缂╂斁/鏃嬭浆绛夐珮棰戞搷浣滅粨鏉熷悗锛屾妸鏁存鎿嶄綔鍚堝苟涓轰竴鏉″巻鍙茶褰曪紙App 渚ф彁浜わ級 */
  onCommitHistory?: (title: string, actionType?: string, details?: string) => void;
  onAddDrawnSaberElement?: (
    path: string, 
    bbox: { x: number; y: number; w: number; h: number },
    nodes?: BezierNode[],
    shapeName?: string
  ) => void;
  onAddDrawnShapeElement?: (
    path: string,
    bbox: { x: number; y: number; w: number; h: number },
    nodes?: BezierNode[],
  ) => void;
  onAddDrawnInteractionArea?: (
    path: string,
    bbox: { x: number; y: number; w: number; h: number },
    nodes?: BezierNode[],
  ) => void;
  viewport: ViewportState;
  onUpdateViewport: (updater: (prev: ViewportState) => ViewportState) => void;
  currentTime: number;
  isPlaying: boolean;
  /** 鏃堕棿绾挎挱鏀炬椂浠呭垏鎹㈢敾甯冧负涓?E 閿瑙堜竴鑷寸殑浜や簰鎬侊紝淇濈暀鏃堕棿绾垮拰缂栬緫闈㈡澘銆?*/
  isTimelinePreview?: boolean;
  onTogglePlay: () => void;
  isEditing: boolean;
  onToggleEditing: () => void;
  showExitPreviewButton?: boolean;
  bgmAudioRef: React.RefObject<HTMLAudioElement | null>;
  isCruising: boolean;
  onToggleCruise: () => void;
  autoAdvance: boolean;
  onToggleAutoAdvance: () => void;
  /** 浣撴劅鎵嬪娍鏄惁宸插惎鐢紙涓庡鍑?HUD 鐨勪綋鎰熷渾鐐瑰搴旓級 */
  motionEnabled?: boolean;
  /** 鍒囨崲浣撴劅寮€鍏?*/
  onToggleMotion?: () => void;
  /** 浣撴劅寮曟搸鐘舵€侊細idle/loading/ready/error锛岀敤浜庡渾鐐瑰姞杞芥€?*/
  gestureStatus?: string;
  /** 体感“呼出菜单”动作的递增信号：切换底部播放控制栏显隐。 */
  gestureHudToggleNonce?: number;
  transitionAnimKey?: number;
  /** A request from App to preserve the currently visible stage while the target scene mounts. */
  sceneTransitionRequest?: {
    id: number;
    targetSceneId: string;
    exitAnimation?: SceneTransitionType;
    duration: number;
    easing: string;
  } | null;
  /** Always resolves a request, including capture failures, so scene navigation cannot get stuck. */
  onSceneTransitionSnapshot?: (requestId: number) => void;
  /** 鍦烘櫙閫€鍦哄姩鐢讳腑锛歵rue 鏃惰垶鍙扮户缁覆鏌撳綋鍓嶅満鏅苟搴旂敤鍏?transitionOut 鍑哄満鍔ㄧ敾 */
  sceneExiting?: boolean;
  /** 鍏冪礌绾у満鏅垏鎹㈣繘鍑哄満鍔ㄧ敾瑕嗙洊锛堜粎鏈鐢卞厓绱犺Е鍙戠殑鍒囨崲鐢熸晥锛屽叆鍦哄姩鐢荤粨鏉熷悗鐢?App 娓呴櫎锛?*/
  sceneTransitionOverride?: SceneTransitionOverride | null;
  isFullscreenPreview?: boolean;
  onToggleFullscreenPreview?: () => void;
  /** 銆愰鍒ゆ€х紪杈戙€戠紪杈戞ā寮忔槸鍚﹀凡鎶樺彔宸﹀彸闈㈡澘锛堟姌鍙犲悗鐢诲竷鍏ㄥ锛岃櫄绾挎=寮圭獥鍍忕礌涓€鑷达級 */
  panelsCollapsed?: boolean;
  onTogglePanelsCollapsed?: () => void;
  /** 婕旂ず妯″紡涓嬬偣鍑?3D/鍏ㄦ櫙鐢婚潰鍐呯儹鐐规椂瑙﹀彂锛堣烦杞?寮圭獥/URL/濯掍綋锛?*/
  onHotspotTrigger?: (hotspot: Hotspot) => void;
  /** 鏅€氬浘灞備笌鐑偣鍏辩敤鐨勫彉閲忎慨鏀瑰搷搴斻€?*/
  onVariableMutation?: (config: InteractionConfig) => void;
  /** Feedback for component-level actions such as submit or a missing navigation target. */
  onToast?: (message: string) => void;
  /** 褰撳墠閫変腑鐨勭儹鐐癸紙缂栬緫妯″紡锛?*/
  selectedHotspot?: { elementId: string; hotspotId: string } | null;
  /** 閫変腑/鍙栨秷閫変腑鐑偣 */
  onSelectHotspot?: (elementId: string, hotspotId: string | null) => void;
  /** 鍒犻櫎鐑偣 */
  onDeleteHotspot?: (elementId: string, hotspotId: string) => void;
  /** 鏇存柊鐑偣灞炴€?*/
  onUpdateHotspot?: (elementId: string, hotspotId: string, patch: Partial<Hotspot>) => void;
  /** 銆愬彸閿笂浼犮€戠紪杈戞ā寮忕敾甯冪┖鐧藉鍙抽敭涓婁紶绱犳潗锛堜笂浼犲苟娣诲姞鍒扮敾甯冿級 */
  onImportMediaToCanvas?: (files: File[]) => void;
  /** Adds a starter element from the empty-canvas creation prompt. */
  onAddElement?: (type: 'txt' | 'img' | 'shape') => void;
  /** Opens the app's shared media importer from the empty-canvas entry point. */
  onRequestImportMedia?: () => void;
  /** Gives the app a best-effort capture of the real authored stage for project previews. */
  onThumbnailCaptureReady?: (capture: (() => Promise<Blob | null>) | null) => void;
  /** Review comments pinned to the active scene. */
  comments?: SceneComment[];
  commentMode?: boolean;
  focusedCommentId?: string | null;
  onAddComment?: (x: number, y: number, text: string) => void;
  onUpdateComment?: (id: string, patch: Partial<SceneComment>) => void;
  onDeleteComment?: (id: string) => void;
  onFocusComment?: (id: string | null) => void;
  /** Draw developer handoff measurements over the selected layer. */
  handoffMode?: boolean;
}

// ===== HUD 鎾斁鏍忔寮忥紙妯″潡绾э紝閬垮厤鎾斁 60fps 閲嶆覆鏌撴椂鍙嶅閲嶅缓瀵硅薄/缁勪欢閫犳垚鍐呭瓨鎶栧姩锛?====
// 鏁板€间笌 src/utils/export.ts 鐨?generateHudCSS/generateHudHTML 瀹屽叏瀵归綈锛屼繚璇佺紪杈戝櫒棰勮=瀵煎嚭
const HUD_THEMES: Record<string, any> = {
  default: {
    bar: { position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:12, background:'rgba(15,23,42,0.85)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', padding:'8px 18px', borderRadius:40, border:'1px solid rgba(255,255,255,0.15)', boxShadow:'0 10px 30px rgba(0,0,0,0.6)', color:'#fff', zIndex:50 },
    btn: { background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6, cursor:'pointer' },
    icon: { background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', padding:6, borderRadius:20, cursor:'pointer', display:'flex', alignItems:'center' },
    time: { fontFamily:'monospace', fontWeight:'bold', color:'#38bdf8', minWidth:65, textAlign:'center', fontSize:13 },
    title: { fontSize:13, fontWeight:'bold', color:'#e2e8f0', maxWidth:200, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
    dotSize: 8, dotActiveW: 18, dotRound: '50%', dotColor:'rgba(255,255,255,0.2)', dotActive:'#38bdf8', dotRotate:0, divider:true,
  },
  minimal: {
    bar: { position:'absolute', bottom:0, left:0, right:0, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding:'16px 20px 14px', color:'#fff', zIndex:50 },
    btn: { background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', padding:'5px 12px', borderRadius:16, fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:6, cursor:'pointer' },
    icon: { background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', padding:5, borderRadius:16, cursor:'pointer', display:'flex', alignItems:'center' },
    time: { fontFamily:'monospace', color:'rgba(255,255,255,0.6)', minWidth:50, textAlign:'center', fontSize:11 },
    title: { fontSize:11, color:'rgba(255,255,255,0.5)', maxWidth:160, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
    dotSize: 6, dotActiveW: 18, dotRound: 3, dotColor:'rgba(255,255,255,0.25)', dotActive:'#fff', dotRotate:0, divider:false,
  },
  tech: {
    bar: { position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:10, background:'rgba(8,12,24,0.92)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', padding:'10px 20px', borderRadius:4, border:'1px solid rgba(56,189,248,0.4)', boxShadow:'0 0 30px rgba(56,189,248,0.15), inset 0 1px 0 rgba(56,189,248,0.2)', color:'#fff', zIndex:50 },
    btn: { background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', color:'#7dd3fc', padding:'5px 14px', borderRadius:2, fontSize:12, fontWeight:600, fontFamily:"'Courier New', monospace", letterSpacing:0.5, display:'flex', alignItems:'center', gap:6, cursor:'pointer' },
    icon: { background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', color:'#7dd3fc', padding:5, borderRadius:2, cursor:'pointer', display:'flex', alignItems:'center' },
    time: { fontFamily:"'Courier New', monospace", fontWeight:'bold', color:'#38bdf8', minWidth:60, textAlign:'center', fontSize:12, textShadow:'0 0 8px rgba(56,189,248,0.6)' },
    title: { fontSize:12, fontWeight:'bold', color:'#e0f2fe', maxWidth:180, fontFamily:"'Courier New', monospace", letterSpacing:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
    dotSize: 8, dotActiveW: 8, dotRound: 2, dotColor:'transparent', dotActive:'#38bdf8', dotRotate:45, divider:true,
  },
};
const HUD_PULSE_KEYFRAMES = `@keyframes hudpulse{0%,100%{box-shadow:0 0 4px rgba(167,139,250,.4)}50%{box-shadow:0 0 14px rgba(167,139,250,.95)}}`;

type CustomCodeBounds = CustomCodeFrameBounds;

const CustomCodeFrame: React.FC<{
  plugin: NonNullable<SceneElement['customCode']>;
  instanceId: string;
  interactive: boolean;
  inlineTextEditing?: boolean;
  focusTextKey?: string;
  typography?: CustomCodeTextStyle;
  onBounds?: (bounds: CustomCodeBounds) => void;
  onContentChange?: (html: string, textKey?: string, value?: string) => void;
  onTextChange?: (textKey: string, value: string) => void;
  textOverrides?: Record<string, string>;
  hoverEffect?: string;
  hoverActive?: boolean;
  hoverColor?: string;
  textHotspots?: SceneElement['textHotspots'];
  onTextContextMenu?: (selection: TextSelectionInfo & { x: number; y: number }) => void;
  onTextHotspotTrigger?: (hotspotId: string) => void;
}> = ({ plugin, instanceId, interactive, inlineTextEditing = false, focusTextKey, typography, onBounds, onContentChange, onTextChange, textOverrides, hoverEffect = 'none', hoverActive = false, hoverColor = '#38bdf8' }) => {
  const typographySignature = JSON.stringify(typography || {});
  const safePlugin = React.useMemo(() => {
    const diagnostics = inspectCustomCodePlugin(plugin);
    return diagnostics.errors.length
      ? { ...plugin, html: '<div class="aether-custom-code-missing">组件代码未通过安全检查</div>', css: '', js: '' }
      : plugin;
  }, [plugin]);
  const srcDoc = React.useMemo(
    // Do not replace a transparent plugin surface with the scene colour. That
    // turns the unused iframe area into a visible rectangular backdrop.
    () => buildCustomCodeSrcDoc({ ...safePlugin, textOverrides }, instanceId, 'transparent', inlineTextEditing, typography, focusTextKey, true),
    [focusTextKey, inlineTextEditing, instanceId, safePlugin, textOverrides, typographySignature],
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastBoundsRef = useRef('');
  const hoverFilter = hoverActive && hoverEffect !== 'none'
    ? hoverEffect === 'outline'
      ? `drop-shadow(-1px 0 0 ${hoverColor}) drop-shadow(1px 0 0 ${hoverColor}) drop-shadow(0 -1px 0 ${hoverColor}) drop-shadow(0 1px 0 ${hoverColor}) drop-shadow(0 0 8px ${hoverColor})`
      : hoverEffect === 'brighten'
        ? 'brightness(1.16) saturate(1.06)'
        : `drop-shadow(0 0 8px ${hoverColor}) drop-shadow(0 0 20px ${hoverColor}88)`
    : 'none';

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'aether-custom-code' || data.instanceId !== instanceId) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (data.type === 'content') {
        if (typeof data.html === 'string') {
          onContentChange?.(
            data.html,
            typeof data.textKey === 'string' ? data.textKey : undefined,
            typeof data.value === 'string' ? data.value : undefined,
          );
        }
        return;
      }
      if (data.type === 'text') {
        if (typeof data.textKey === 'string' && typeof data.value === 'string') onTextChange?.(data.textKey, data.value);
        return;
      }
      if (data.type !== 'bounds') return;
      const bounds = data as CustomCodeBounds;
      if (![bounds.x, bounds.y, bounds.width, bounds.height, bounds.viewportWidth, bounds.viewportHeight].every(Number.isFinite)) return;
      const signature = [bounds.x, bounds.y, bounds.width, bounds.height, bounds.viewportWidth, bounds.viewportHeight].map((value) => value.toFixed(2)).join(':');
      if (signature === lastBoundsRef.current) return;
      lastBoundsRef.current = signature;
      onBounds?.(bounds);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [instanceId, onBounds, onContentChange, onTextChange]);

  return (
    <iframe
      ref={iframeRef}
      title={plugin.name}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      {...({ allowtransparency: 'true' } as any)}
      tabIndex={interactive || inlineTextEditing ? 0 : -1}
      className="h-full w-full border-0 bg-transparent"
      style={{
        display: 'block',
        pointerEvents: interactive || inlineTextEditing ? 'auto' : 'none',
        backgroundColor: 'transparent',
        border: '0',
        outline: '0',
        boxShadow: 'none',
        // 防止继承应用根节点的 dark color-scheme，导致沙箱 iframe 白底。
        colorScheme: 'normal',
        filter: hoverFilter,
      }}
    />
  );
};

function collectSceneAssetRefs(scene: Scene | undefined, refs: Set<string>) {
  if (!scene) return;
  if (scene.bgRef) refs.add(scene.bgRef);

  const collectElement = (element: SceneElement) => {
    if (element.refId) refs.add(element.refId);
    const uiAssetRef = element.uiComponentData?.assetRefId;
    if (uiAssetRef) refs.add(uiAssetRef);
    for (const child of element.children || []) collectElement(child);
  };

  for (const element of scene.els || []) collectElement(element);
}

function getSceneAssetRefSignature(...scenes: Array<Scene | undefined>) {
  const refs = new Set<string>();
  scenes.forEach((scene) => collectSceneAssetRefs(scene, refs));
  return Array.from(refs).sort().join('\u001f');
}

/** Resolve local media in a small pool so opening a media-heavy scene does not
 * start one IndexedDB/blob conversion for every video at the same time. */
async function loadRuntimeAssetUrlsWithConcurrency(refs: string[], concurrency = 3) {
  const entries: Array<readonly [string, string]> = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < refs.length) {
      const index = nextIndex++;
      const ref = refs[index];
      try {
        entries[index] = [ref, await loadRuntimeAssetUrl(ref)] as const;
      } catch {
        entries[index] = [ref, ''] as const;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), refs.length || 1) }, worker));
  return entries.filter((entry): entry is readonly [string, string] => Boolean(entry));
}

function getSceneVideoSyncSignature(scene: Scene | undefined) {
  if (!scene) return '';
  const videos: string[] = [];
  const collectElement = (element: SceneElement) => {
    if (element.type === 'vid') {
      videos.push([element.id, element.refId, element.startTime, element.duration, element.loop, element.vidMode, element.playbackCount, element.playbackInfinite].join('\u001f'));
    }
    for (const child of element.children || []) collectElement(child);
  };
  for (const element of scene.els || []) collectElement(element);
  return videos.join('\u001e');
}
// 鍦烘櫙杩涘害鐐癸紙妯″潡绾хǔ瀹氱粍浠讹紝閬垮厤姣忓抚鍗歌浇閲嶅缓锛?
function getScenePlaybackRate(scene: Scene | undefined): number {
  let elementCount = 0;
  let videoCount = 0;
  let hasTimeDrivenEffect = false;
  let hasExpensiveLayer = false;
  const inspect = (element: SceneElement) => {
    elementCount += 1;
    if (element.type === 'vid' || element.type === 'panorama-vid') videoCount += 1;
    // Native video decoding proceeds independently. Static video layers do not
    // need React to recompute layout on each playhead tick.
    if (element.type === 'saber' || element.type === 'vfx' || element.type === 'panorama-vid') hasTimeDrivenEffect = true;
    if (element.loopAnim && element.loopAnim !== 'none') hasTimeDrivenEffect = true;
    // Entry/exit transforms are also time-driven. Keeping these scenes at the
    // heavy-scene 8fps fallback makes fades and slides visibly jump even when
    // the video decoder itself is running smoothly.
    if ((element.animType && element.animType !== 'none') || (element.exitAnimType && element.exitAnimType !== 'none')) {
      hasTimeDrivenEffect = true;
    }
    if (element.type === 'custom-code' || element.type === 'chart' || element.backdropBlur) {
      hasExpensiveLayer = true;
    }
    (element.children || []).forEach(inspect);
  };
  (scene?.els || []).forEach(inspect);
  if (hasTimeDrivenEffect) return 30;
  // Native videos remain smooth at any React update rate. For legacy scenes
  // with several videos or many layers, keep React out of the decoder's way.
  if (videoCount >= 3 || elementCount >= 8 || hasExpensiveLayer) return 8;
  return 20;
}

type VideoFrameCallbackElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Mirrors a decoded frame from an equivalent, muted video layer. Old projects
 * commonly duplicate the same source three or more times for layout effects;
 * decoding every copy is substantially more expensive than copying its frame.
 */
const SharedVideoMirror: React.FC<{ masterId: string; className: string }> = ({ masterId, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    let videoFrameId: number | null = null;
    let activeVideo: VideoFrameCallbackElement | null = null;
    let context: CanvasRenderingContext2D | null = null;
    let canvasWidth = 0;
    let canvasHeight = 0;

    const resizeCanvasToDisplay = (canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const aspect = video.videoWidth / video.videoHeight;
      const targetWidth = Math.max(1, Math.min(video.videoWidth, Math.round(Math.max(1, rect.width) * dpr)));
      const targetHeight = Math.max(1, Math.min(video.videoHeight, Math.round(targetWidth / aspect)));
      if (targetWidth === canvasWidth && targetHeight === canvasHeight) return;
      canvasWidth = targetWidth;
      canvasHeight = targetHeight;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    };
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          const canvas = canvasRef.current;
          if (canvas && activeVideo) resizeCanvasToDisplay(canvas, activeVideo);
        })
      : null;

    const draw = () => {
      const canvas = canvasRef.current;
      const video = activeVideo?.isConnected
        ? activeVideo
        : Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-aether-video-master]'))
          .find((candidate) => candidate.dataset.aetherVideoMaster === masterId) as VideoFrameCallbackElement | undefined;
      if (!canvas || !video) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      activeVideo = video;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        resizeCanvasToDisplay(canvas, video);
        context?.drawImage(video, 0, 0, canvasWidth, canvasHeight);
      }
      if (video.requestVideoFrameCallback) {
        videoFrameId = video.requestVideoFrameCallback(draw);
      } else {
        rafId = requestAnimationFrame(draw);
      }
    };

    if (canvasRef.current) resizeObserver?.observe(canvasRef.current);
    draw();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (videoFrameId !== null) activeVideo?.cancelVideoFrameCallback?.(videoFrameId);
      resizeObserver?.disconnect();
    };
  }, [masterId]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

const HudDot: React.FC<{ active:boolean; theme:any; tech:boolean; onClick:()=>void }> = ({ active, theme, tech, onClick }) => (
  <button type="button" onClick={onClick} style={{
    width: active ? theme.dotActiveW : theme.dotSize, height: theme.dotSize,
    borderRadius: active ? theme.dotRound : '50%', background: active ? theme.dotActive : theme.dotColor,
    border: tech ? '1px solid rgba(56,189,248,0.5)' : 'none',
    transform: `rotate(${theme.dotRotate}deg)`, cursor:'pointer', transition:'all .2s', padding:0,
    boxShadow: active && tech ? '0 0 10px rgba(56,189,248,0.8)' : 'none',
  }} />
);
// 宸¤埅/浣撴劅鍙戝厜鍦嗙偣锛堟ā鍧楃骇绋冲畾缁勪欢锛?
const HudSpecialDot: React.FC<{ on?:boolean; loading?:boolean; danger?:boolean; onClick:()=>void; title:string; children:React.ReactNode }> = ({ on, loading, danger, onClick, title, children }) => (
  <button type="button" onClick={onClick} title={title} style={{
    width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', transition:'all .2s', border:'none',
    background: on ? (danger ? 'rgba(248,113,113,0.15)' : loading ? 'rgba(167,139,250,0.15)' : 'rgba(16,185,129,0.16)') : 'rgba(255,255,255,0.1)',
    color: on ? (danger ? '#f87171' : loading ? '#c4b5fd' : '#6ee7b7') : '#cbd5e1',
    boxShadow: on ? (danger ? '0 0 10px rgba(248,113,113,0.7)' : loading ? '0 0 10px rgba(167,139,250,0.75)' : '0 0 10px rgba(16,185,129,0.75)') : 'none',
    animation: on && loading ? 'hudpulse 1s ease-in-out infinite' : 'none',
  }}>{children}</button>
);

const CanvasViewportBase: React.FC<CanvasViewportProps> = ({
  projectData,
  projectHydrated = true,
  activeSceneId,
  onSelectScene,
  selectedElementId,
  timelineEditTargetId = null,
  multiSelectedIds,
  onSelectElement,
  onUpdateElement,
  onCommitHistory,
  onAddDrawnSaberElement,
  onAddDrawnShapeElement,
  onAddDrawnInteractionArea,
  viewport,
  onUpdateViewport,
  currentTime,
  isPlaying,
  isTimelinePreview = false,
  onTogglePlay,
  isEditing,
  onToggleEditing,
  showExitPreviewButton = true,
  bgmAudioRef,
  isCruising,
  onToggleCruise,
  autoAdvance,
  onToggleAutoAdvance,
  motionEnabled = false,
  onToggleMotion,
  gestureStatus = 'idle',
  gestureHudToggleNonce = 0,
  transitionAnimKey,
  sceneTransitionRequest = null,
  onSceneTransitionSnapshot,
  sceneExiting = false,
  sceneTransitionOverride = null,
  isFullscreenPreview = false,
  onToggleFullscreenPreview,
  panelsCollapsed = false,
  onTogglePanelsCollapsed,
  onHotspotTrigger,
  onVariableMutation,
  onToast,
  selectedHotspot,
  onSelectHotspot,
  onDeleteHotspot,
  onUpdateHotspot,
  onImportMediaToCanvas,
  onAddElement,
  onRequestImportMedia,
  onThumbnailCaptureReady,
  comments = [],
  commentMode = false,
  focusedCommentId = null,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onFocusComment,
  handoffMode = false,
}) => {
  const isInteractionAreaTool = viewport.activeTool === 'interaction-draw';
  const isMaskPenTool = viewport.activeTool === 'mask-pen';
  const isDrawingTool = viewport.activeTool === 'saber-draw' || viewport.activeTool === 'shape-draw' || isInteractionAreaTool || isMaskPenTool;
  // E 閿瑙堝拰鏃堕棿绾挎挱鏀鹃瑙堝叡鐢ㄥ悓涓€濂楃敾甯冧氦浜掕涔夈€?
  const isTimelinePreviewMode = isTimelinePreview && isEditing && !isFullscreenPreview;

  // 快捷键设置面板保存后，画布命令立即按新键位生效。
  const [customShortcuts, setCustomShortcuts] = useState(() => loadCustomShortcuts());
  useEffect(() => {
    const refresh = () => {
      setCustomShortcuts(loadCustomShortcuts());
    };
    window.addEventListener('aether-shortcuts-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('aether-shortcuts-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const shortcutCommandMap = useMemo(() => {
    const map = new Map<string, string>();
    customShortcuts.forEach((shortcut) => {
      if (!shortcut.enabled) return;
      const key = normalizeShortcutKey(shortcut.customKey || shortcut.defaultKey);
      if (key) map.set(key, shortcut.id);
    });
    return map;
  }, [customShortcuts]);
  const isInteractionPreview = !isEditing || isTimelinePreviewMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const transitionOverlayHostRef = useRef<HTMLDivElement>(null);

  const handledSceneTransitionRef = useRef<number>(0);
  const [transitionOverlay, setTransitionOverlay] = useState<{
    requestId: number;
    sourceSceneId: string;
    clone: HTMLDivElement;
    exitAnimation?: SceneTransitionType;
    duration: number;
    easing: string;
  } | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  // 体感动作「呼出菜单」：切换底部播放控制栏显隐。
  const gestureHudNonceRef = useRef(gestureHudToggleNonce);
  useEffect(() => {
    if (gestureHudToggleNonce === gestureHudNonceRef.current) return;
    gestureHudNonceRef.current = gestureHudToggleNonce;
    setHudCollapsed((value) => !value);
  }, [gestureHudToggleNonce]);
  const saberPathLengthsRef = useRef(new Map<string, number[]>());
  const saberPathEndpointsRef = useRef(new Map<string, Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>>());
  const [, setSaberPathMeasureVersion] = useState(0);
  const measureSaberPath = useCallback((elementId: string, index: number, subpathCount: number, path: SVGPathElement | null) => {
    if (!path) return;
    const length = path.getTotalLength();
    const stored = saberPathLengthsRef.current.get(elementId) || [];
    const previous = stored.length === subpathCount ? stored : [];
    const oldEndpoints = saberPathEndpointsRef.current.get(elementId) || [];
    const start = path.getPointAtLength(0);
    const end = path.getPointAtLength(length);
    const last = oldEndpoints[index];
    const endpointsChanged = !last || Math.abs(last.start.x - start.x) > 0.01 || Math.abs(last.start.y - start.y) > 0.01
      || Math.abs(last.end.x - end.x) > 0.01 || Math.abs(last.end.y - end.y) > 0.01;
    if (length > 0 && (Math.abs((previous[index] || 0) - length) > 0.01 || endpointsChanged)) {
      const next = [...previous];
      next[index] = length;
      saberPathLengthsRef.current.set(elementId, next);
      const nextEndpoints = oldEndpoints.length === subpathCount ? [...oldEndpoints] : [];
      nextEndpoints[index] = { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
      saberPathEndpointsRef.current.set(elementId, nextEndpoints);
      setSaberPathMeasureVersion((version) => version + 1);
    }
  }, []);
  // Prevent a text-hotspot click from bubbling into the owning element and
  // firing its own interaction a second time.
  const textHotspotClickRef = useRef<{ elementId: string; hotspotId: string } | null>(null);
  const activeScene = projectData.scenes[activeSceneId] || Object.values(projectData.scenes)[0];
  const playbackRenderFps = React.useMemo(
    () => getScenePlaybackRate(activeScene),
    [activeScene],
  );
  // Keep the render budget below native multi-video compositing on static
  // legacy scenes. Time-driven VFX and saber layers keep the existing 30fps.
  const renderTime = usePlaybackClockTime(
    currentTime,
    isPlaying,
    playbackRenderFps,
  );
  // Resolve variable bindings and z-order once per project/scene change. During
  // playback only currentTime changes; repeating these read-only operations for
  // every playhead frame is needlessly expensive for large timelines.
  const resolvedSceneElements = React.useMemo(() => (
    [...(activeScene?.els || [])]
      .map((el) => resolveBindings(el, projectData))
      // Keep DOM order aligned with the standalone exporter. Numeric z-index
      // still determines stacking; ascending order makes equal-z layers stable.
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  ), [activeScene?.els, projectData]);
  const sharedVideoMasterIds = React.useMemo(() => {
    const masters = new Map<string, { id: string; startTime: number; duration: number }>();
    const mirrors = new Map<string, string>();
    resolvedSceneElements.forEach((element) => {
      // Preserve independent audio, controls and intentionally staggered clips.
      if (element.type !== 'vid' || !element.refId || element.muted !== true || element.vidMode === 'click') return;
      const startTime = element.startTime || 0;
      const duration = element.duration || 0;
      const key = `${element.refId}\u001f${element.loop !== 'false'}`;
      const master = masters.get(key);
      if (master && Math.abs(master.startTime - startTime) <= 0.05 && Math.abs(master.duration - duration) <= 0.05) {
        mirrors.set(element.id, master.id);
      } else {
        masters.set(key, { id: element.id, startTime, duration });
      }
    });
    return mirrors;
  }, [resolvedSceneElements]);
  const selectedElement = activeScene?.els.find((e) => e.id === selectedElementId);
  const timelineEditTarget = isEditing && !isInteractionPreview && timelineEditTargetId
    ? activeScene?.els.find((element) => element.id === timelineEditTargetId)
    : undefined;
  const selectedHotspotOwner = selectedHotspot
    ? activeScene?.els.find((e) => e.id === selectedHotspot.elementId)
    : undefined;
  const selectedHotspotData = selectedHotspotOwner?.hotspots?.find((h) => h.id === selectedHotspot?.hotspotId);
  const elementPopups = selectedElement && resolveInteraction(selectedElement).action === 'popup' ? getPopups(selectedElement) : [];
  const activePopupIndex = selectedElement ? Math.max(0, elementPopups.findIndex((popup) => popup.id === (selectedElement.popupActiveId || elementPopups[0]?.id))) : 0;
  const continuousConfig = selectedElement?.type === 'ui-component' && isContinuousInteractionComponent(selectedElement.uiComponentType)
    ? normalizeContinuousInteraction(selectedElement.uiComponentData?.continuousInteraction as ContinuousInteractionConfig | undefined)
    : null;
  const continuousPopupNodes = (continuousConfig?.nodes || [])
    .filter((node) => node.interaction?.action === 'popup' && node.interaction.target)
    .map((node, index) => ({
      node,
      index,
      source: resolveContinuousNodePopup(node, index),
    }));
  const activeContinuousPopup = continuousPopupNodes.find((item) => item.node.id === continuousConfig?.activeNodeId) || continuousPopupNodes[0];
  const popupEditTarget = selectedHotspotData && resolveInteraction(selectedHotspotData).action === 'popup'
    ? { kind: 'hotspot' as const, source: selectedHotspotData }
    : selectedElement && resolveInteraction(selectedElement).action === 'popup'
      ? { kind: 'element' as const, source: elementPopups[activePopupIndex], owner: selectedElement, index: activePopupIndex }
      : selectedElement && activeContinuousPopup
        ? {
          kind: 'continuous-node' as const,
          owner: selectedElement,
          node: activeContinuousPopup.node,
          index: activeContinuousPopup.index,
          source: activeContinuousPopup.source,
        }
      : null;
  const updatePopupTarget = useCallback((patch: Record<string, unknown>) => {
    if (!popupEditTarget) return;
    if (popupEditTarget.kind === 'hotspot') {
      onUpdateHotspot?.(selectedHotspot!.elementId, selectedHotspot!.hotspotId, patch as Partial<Hotspot>);
    } else if (popupEditTarget.kind === 'element') {
      const next = getPopups(popupEditTarget.owner).map((popup, index) => index === popupEditTarget.index ? { ...popup, ...patch } : popup);
      onUpdateElement(popupEditTarget.owner.id, { ...popupCollectionPatch(next), popupActiveId: popupEditTarget.source.id });
    } else {
      const config = normalizeContinuousInteraction(popupEditTarget.owner.uiComponentData?.continuousInteraction as ContinuousInteractionConfig | undefined);
      onUpdateElement(popupEditTarget.owner.id, {
        uiComponentData: {
          ...(popupEditTarget.owner.uiComponentData || {}),
          continuousInteraction: {
            ...config,
            activeNodeId: popupEditTarget.node.id,
            nodes: config.nodes.map((node) => node.id === popupEditTarget.node.id ? { ...node, popup: { ...node.popup, ...patch } } : node),
          },
        },
      });
    }
  }, [onUpdateElement, onUpdateHotspot, popupEditTarget, selectedHotspot]);
  // 銆愬伐绋嬬骇鐢诲竷銆戜粠宸ョ▼鏁版嵁瑙ｆ瀽鐢诲竷灏哄锛堥粯璁?1920x1080 / 16:9锛夛紝鎵€鏈夋覆鏌?缂╂斁璺熼殢
  const canvasSpec = getProjectCanvas(projectData);
  const CANVAS_W = canvasSpec.width;
  const CANVAS_H = canvasSpec.height;
  const GRID_COLUMNS = 40;
  const GRID_ROWS = 20;
  // 銆愬彸閿笂浼犮€戠紪杈戞ā寮忕敾甯冪┖鐧藉鍙抽敭涓婁紶绱犳潗
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; elementId?: string } | null>(null);
  const contextMenuElement = ctxMenu?.elementId
    ? activeScene?.els.find((element) => element.id === ctxMenu.elementId)
    : undefined;
  const [textContextMenu, setTextContextMenu] = useState<({ x: number; y: number; elementId: string } & TextSelectionInfo) | null>(null);
  const [commentDraft, setCommentDraft] = useState<{ x: number; y: number; text: string } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentDeleteConfirmId, setCommentDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedCommentId) return;
    setActiveCommentId(focusedCommentId);
    setCommentDraft(null);
  }, [focusedCommentId]);
  useEffect(() => {
    if (!commentMode) setCommentDraft(null);
  }, [commentMode]);
  const ctxImgRef = useRef<HTMLInputElement>(null);
  const ctxVidRef = useRef<HTMLInputElement>(null);
  const ctxAudRef = useRef<HTMLInputElement>(null);
  const ctxModelRef = useRef<HTMLInputElement>(null);
  const ctxPanoRef = useRef<HTMLInputElement>(null);
  // 鍏抽棴鍙抽敭鑿滃崟锛堢偣鍑诲叾浠栧尯鍩?/ Esc锛?

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [ctxMenu]);

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    // PS/AE 涔犳儻锛氬彸閿粨鏉熷綋鍓嶅紑鏀捐矾寰勫苟鎻愪氦锛涙病鏈夎冻澶熻妭鐐规椂鎵嶅彇娑堛€?
    if (isDrawingTool && !isInteractionPreview) {
      e.preventDefault();
      e.stopPropagation();
      if (penNodesRef.current.length >= 2) handleFinishPenPath(false);
      else handleCancelPenDrawing();
      return;
    }
    // 缂栬緫妯″紡涓嬫墠寮€鏀惧彸閿笂浼狅紱婕旂ず/宸¤埅妯″紡淇濇寔娴忚鍣ㄩ粯璁よ涓?

    if (isInteractionPreview || isFullscreenPreview) return;
    // The editable custom-code iframe reports text selections through
    // postMessage. Its native contextmenu also reaches the canvas wrapper, so
    // suppress the element-level menu while that editing session is active.
    if (inlineCustomCodeEditId) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const elementNode = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-canvas-element="true"]');
    const elementId = elementNode?.dataset.canvasElementId;
    if (elementId && activeScene?.els.some((element) => element.id === elementId)) {
      onSelectElement(elementId);
      setCtxMenu({ x: e.clientX, y: e.clientY, elementId });
      return;
    }
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const assignContextInteraction = (action: 'jump' | 'popup' | 'transition', targetSceneId: string) => {
    if (!ctxMenu?.elementId) return;
    const target = activeScene?.els.find((element) => element.id === ctxMenu.elementId);
    if (!target || target.locked) return;
    const interactionAction = action === 'popup' ? 'popup' : 'jump';
    const interaction = {
      ...(target.interaction || {}),
      trigger: target.interaction?.trigger || target.trigger || 'click',
      action: interactionAction,
      target: targetSceneId,
    } as SceneElement['interaction'];
    onUpdateElement(target.id, {
      link: targetSceneId,
      linkType: interactionAction,
      interaction,
      ...(action === 'transition'
        ? { linkEnterAnim: 'fade', linkExitAnim: 'fade', linkAnimDuration: 0.6 }
        : {}),
    }, action === 'popup' ? '右键绑定弹窗场景' : action === 'transition' ? '右键绑定转场场景' : '右键绑定跳转场景');
    setCtxMenu(null);
  };

  const assignTextContextInteraction = (action: ContextTargetAction, targetSceneId: string) => {
    if (!textContextMenu?.elementId) return;
    const target = activeScene?.els.find((element) => element.id === textContextMenu.elementId);
    if (!target || target.locked) return;
    const hotspot = {
      id: `text-hotspot-${Date.now()}`,
      textKey: textContextMenu.textKey,
      start: textContextMenu.start,
      end: textContextMenu.end,
      label: textContextMenu.text,
      interaction: {
        trigger: 'click' as const,
        action: action === 'popup' ? 'popup' as const : 'jump' as const,
        target: targetSceneId,
      },
    };
    onUpdateElement(target.id, {
      textHotspots: [...(target.textHotspots || []), hotspot],
      ...(action === 'transition' ? { linkEnterAnim: 'fade', linkExitAnim: 'fade', linkAnimDuration: 0.6 } : {}),
    }, action === 'popup' ? '绑定文字弹窗场景' : action === 'transition' ? '绑定文字转场场景' : '绑定文字跳转场景');
    setTextContextMenu(null);
  };

  const openTextContextMenu = (elementId: string, selection: TextSelectionInfo & { x: number; y: number }) => {
    if (!selection.text.trim() || selection.end <= selection.start) return;
    setTextContextMenu({ elementId, ...selection });
  };

  const handleTextAreaContextMenu = (event: React.MouseEvent<HTMLTextAreaElement>, elementId: string) => {
    const selection = getTextAreaSelection(event.currentTarget);
    if (!selection) return;
    event.preventDefault();
    event.stopPropagation();
    openTextContextMenu(elementId, { ...selection, x: event.clientX, y: event.clientY });
  };

  const handleCtxFileChosen = (input: HTMLInputElement | null) => {
    if (!input || !input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    input.value = '';
    setCtxMenu(null);
    onImportMediaToCanvas?.(files);
  };
  // 銆愪慨澶嶃€戝灞傜缉鏀惧鍣?ref锛歠itCanvas 鐨?translate/scale 绉诲埌姝ゅ锛?
  // 涓庡唴灞傝垶鍙扮殑銆屽満鏅浆鍦哄姩鐢汇€嶈В鑰︹€斺€攕lide/zoom 绛夎浆鍦?keyframes 鍚?transform锛?
  // 鑻ョ洿鎺ヤ綔鐢ㄨ垶鍙颁細瑕嗙洊澶栧眰 scale(0.27)锛屽鑷磋垶鍙板洖鍒?1920x1080 鍘熷灏哄銆?
  // 鍏冪礌婧㈠嚭鐢诲竷琚鍓紙鏃犳硶鐐瑰嚮浜や簰鍏冪礌锛夈€?

  const scaleRef = useRef<HTMLDivElement>(null);

  const [activePopupSceneId, setActivePopupSceneId] = useState<string | null>(null);
  const [secondaryPopups, setSecondaryPopups] = useState<Array<{ id: string; target: string; config: Record<string, any>; closing?: boolean }>>([]);
  const [activePopupTriggerElement, setActivePopupTriggerElement] = useState<SceneElement | null>(null);
  const popupSequenceTimersRef = useRef<number[]>([]);
  const clearPopupSequenceTimers = useCallback(() => {
    popupSequenceTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    popupSequenceTimersRef.current = [];
  }, []);
  const secondaryPopupCloseTimersRef = useRef<Record<string, number>>({});
  const clearSecondaryPopupCloseTimers = useCallback(() => {
    Object.values(secondaryPopupCloseTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    secondaryPopupCloseTimersRef.current = {};
  }, []);
  // 銆愭柊澧炪€戝脊绐楅€€鍑哄姩鐢荤姸鎬侊細true 鏃舵挱鏀炬贰鍑?婊戝嚭鍔ㄧ敾锛屽姩鐢荤粨鏉熷悗鍐嶇湡姝ｅ嵏杞?

  const [popupClosing, setPopupClosing] = useState(false);
  const popupCloseTimerRef = useRef<number | null>(null);
  // 銆愭柊澧炪€戞诞灞傚崱鐗囷紙Popover锛夛細鐑偣閿氱偣浣嶇疆
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // 銆愭柊澧炪€戝師鍦板睍寮€锛圛nline锛夛細褰撳墠灞曞紑鐨勭儹鐐瑰厓绱?id
  const [inlineActiveElementId, setInlineActiveElementId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [inlineUiEditId, setInlineUiEditId] = useState<string | null>(null);
  // Custom-code text editing is an explicit mode. Keeping the iframe inert until
  // double-click preserves the canvas drag, resize, and rotate gesture surface.
  const [inlineCustomCodeEditId, setInlineCustomCodeEditId] = useState<string | null>(null);
  const [inlineCustomCodeTextKey, setInlineCustomCodeTextKey] = useState<string | null>(null);
  const [tempTextValue, setTempTextValue] = useState('');

  // 銆愭柊澧炪€戝脊绐楀唴瀹圭瓑姣斾緥缂╂斁锛氬浐瀹?1920x1080 鍐呴儴鐢诲竷锛岀敤 transform:scale() 缂╂斁鍒板脊绐楃獥鍙?

  const [popupContentScale, setPopupContentScale] = useState(1);
  const popupContentRef = useRef<HTMLDivElement>(null);

  // 銆愪慨澶嶃€戝満鏅垏鎹㈡椂鑷姩鍏抽棴寮圭獥锛氬脊绐楁槸銆屽綋鍓嶄富鍦烘櫙銆嶇殑鍛堢幇灞傦紝
  // 褰?activeSceneId 鍙樺寲锛堝厓绱犺烦杞?/ 宸¤埅 / 鍒囬〉 / 鍦烘櫙鍒楄〃鍒囨崲锛夋椂蹇呴』鍏抽棴锛?
  // 鍚﹀垯閫€鍦轰腑瑙﹀彂寮圭獥銆佹垨寮圭獥鎵撳紑鏃跺垏鎹㈠満鏅細瀵艰嚧寮圭獥娈嬬暀銆佸唴瀹逛笌涓诲満鏅劚鑺傘€?

  const prevActiveSceneRef = useRef(activeSceneId);
  useEffect(() => {
    if (prevActiveSceneRef.current !== activeSceneId) {
      prevActiveSceneRef.current = activeSceneId;
      if (popupCloseTimerRef.current) window.clearTimeout(popupCloseTimerRef.current);
      popupCloseTimerRef.current = null;
      clearPopupSequenceTimers();
      clearSecondaryPopupCloseTimers();
      setPopupClosing(false);
      setActivePopupSceneId(null);
      setActivePopupTriggerElement(null);
      setSecondaryPopups([]);
      setPopoverAnchor(null);
      setInlineActiveElementId(null);
      setPopupContentScale(1);
    }
  }, [activeSceneId, clearPopupSequenceTimers, clearSecondaryPopupCloseTimers]);

  // 銆愭柊澧炪€戝脊绐楀彲瑙嗗寲缂栬緫鍣細鎷栨嫿绉诲姩 / 鎵嬫焺缂╂斁 / 鏅鸿兘瀵归綈杈呭姪绾?

  const [popupDragState, setPopupDragState] = useState<{
    type: 'move' | 'resize';
    handle?: string; // nw, n, ne, e, se, s, sw, w
    pointerId: number;
    startMouseX: number;
    startMouseY: number;
    startX: number; // popupX (%)
    startY: number; // popupY (%)
    startW: number; // popupWidth (%)
    startH: number; // popupHeight (%)
    aspect?: number;
    freeAspect?: boolean;
  } | null>(null);
  const [popupAlignLines, setPopupAlignLines] = useState<{ h: number | null; v: number | null }>({ h: null, v: null });

  // 銆愪慨澶嶃€戠粺涓€鑸炲彴灞忓箷鐭╁舰锛氬脊绐?/ 铏氱嚎妗?/ 鎷栨嫿璁＄畻鍏辩敤鍚屼竴鍩哄噯銆?
  // 鑸炲彴閫氳繃 fitCanvas 閫傞厤瀹瑰櫒锛堝叏灞忛摵婊?/ 闈炲叏灞忓甫杈硅窛锛夛紝蹇呴』鐩稿鑸炲彴鑰岄潪瑙嗗彛瀹氫綅锛?
  // 鍚﹀垯寮圭獥鐩稿鐢诲竷鐨勪綅缃湪鍏ㄥ睆 / 闈炲叏灞忔椂鍙戠敓鍋忕Щ銆?
  // 浣跨敤澶栧眰缂╂斁瀹瑰櫒锛坰caleRef锛夛細鍐呭眰鑸炲彴鐨勮浆鍦哄姩鐢?transform 涓嶄細褰卞搷鍑犱綍鍩哄噯锛?
  // 淇濊瘉杞満鍔ㄧ敾鎾斁涓?/ 缁撴潫鍚庡脊绐椾笌铏氱嚎妗嗕綅缃ǔ瀹氫竴鑷淬€?

  const getStageRect = useCallback(() => {
    if (scaleRef.current) {
      const r = scaleRef.current.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    }
    if (stageRef.current) {
      const r = stageRef.current.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    }
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }, []);

  // 寮圭獥瀹介珮姣旓紙aspect ratio锛夎В鏋愶細棰勮 16:9/4:3/1:1/9:16 涓庤嚜瀹氫箟锛坧opupRatioW:popupRatioH锛夛紝
  // 榛樿 16:9锛堜笌 1920x1080 鍦烘櫙涓€鑷达級銆傚脊绐楀嚑浣曘€佽櫄绾挎銆佹嫋鎷界缉鏀惧叡鐢ㄣ€?

  const resolvePopupAspect = useCallback((triggerEl: any): number => {
    return resolvePopupAspectRatio(triggerEl);
  }, []);

  // ========== 銆愭牳蹇冦€戝叡浜脊绐楀嚑浣曡绠?==========
  // 婕旂ず寮圭獥涓庣紪杈戣櫄绾挎蹇呴』浣跨敤銆愬悓涓€鍑芥暟銆戣绠椾綅缃笌灏哄锛屼繚璇併€岄鍒ゆ€х紪杈戙€嶅儚绱犵骇涓€鑷达細
  // 钃濊壊铏氱嚎妗嗗湪鍝€佷粈涔堝昂瀵革紝婕旂ず寮圭獥灏卞湪鍝€佸氨鏄粈涔堝昂瀵搞€?
  // 浠讳綍寮圭獥浣嶇疆/澶у皬閫昏緫鍙湪姝ゅ缁存姢锛屽脊绐椾笌铏氱嚎妗嗗悓姝ョ敓鏁堬紝鏉滅粷涓ゅ閫昏緫鍒嗗弶銆?

  // 鍒囨崲鍒伴瑙堟ā寮忔椂锛岃嚜鍔ㄤ繚瀛樻鍦ㄧ紪杈戠殑鏂囧瓧骞堕€€鍑虹紪杈戠姸鎬?

  useEffect(() => {
    if (!isEditing && editingTextId) {
      onUpdateElement(editingTextId, { content: tempTextValue });
      setEditingTextId(null);
    }
  }, [isEditing, editingTextId, tempTextValue, onUpdateElement]);

  useEffect(() => {
    if (
      inlineCustomCodeEditId
      && (!isEditing || isInteractionPreview || selectedElementId !== inlineCustomCodeEditId)
    ) {
      setInlineCustomCodeEditId(null);
      setInlineCustomCodeTextKey(null);
    }
  }, [inlineCustomCodeEditId, isEditing, isInteractionPreview, selectedElementId]);

  useEffect(() => {
    if (inlineUiEditId && (!isEditing || isInteractionPreview || selectedElementId !== inlineUiEditId)) {
      setInlineUiEditId(null);
    }
  }, [inlineUiEditId, isEditing, isInteractionPreview, selectedElementId]);

  // Bezier Pen Tool State for Saber light paths
  const [penNodes, setPenNodes] = useState<BezierNode[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPenHandle, setIsDraggingPenHandle] = useState(false);
  const isDraggingPenHandleRef = useRef(false);
  const [isNearStartPoint, setIsNearStartPoint] = useState(false);
  const penNodesRef = useRef<BezierNode[]>([]);
  const penHudRef = useRef<HTMLDivElement>(null);
  const penHudDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [penHudPosition, setPenHudPosition] = useState<{ left: number; top: number } | null>(null);
  const [penHudCompact, setPenHudCompact] = useState(false);
  const [penHudHidden, setPenHudHidden] = useState(false);

  // 閽㈢瑪鎻愮ず妗嗘敮鎸佹嫋鍔紝骞堕檺鍒跺湪褰撳墠鐢诲竷瑙嗗彛鍐咃紝閬垮厤閬尅璺緞鎴栬窇鍑哄睆骞曘€?
  useEffect(() => {
    const handlePenHudMove = (e: PointerEvent) => {
      const drag = penHudDragRef.current;
      const parent = containerRef.current?.getBoundingClientRect();
      const hud = penHudRef.current?.getBoundingClientRect();
      if (!drag || !parent || !hud || e.pointerId !== drag.pointerId) return;

      const maxLeft = Math.max(8, parent.width - hud.width - 8);
      const maxTop = Math.max(8, parent.height - hud.height - 8);
      const left = Math.max(8, Math.min(maxLeft, e.clientX - parent.left - drag.offsetX));
      const top = Math.max(8, Math.min(maxTop, e.clientY - parent.top - drag.offsetY));
      setPenHudPosition({ left, top });
    };
    const handlePenHudUp = (e: PointerEvent) => {
      if (penHudDragRef.current?.pointerId === e.pointerId) penHudDragRef.current = null;
    };

    window.addEventListener('pointermove', handlePenHudMove);
    window.addEventListener('pointerup', handlePenHudUp);
    window.addEventListener('pointercancel', handlePenHudUp);
    return () => {
      window.removeEventListener('pointermove', handlePenHudMove);
      window.removeEventListener('pointerup', handlePenHudUp);
      window.removeEventListener('pointercancel', handlePenHudUp);
    };
  }, []);

  const handlePenHudPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const parent = containerRef.current?.getBoundingClientRect();
    const hud = penHudRef.current?.getBoundingClientRect();
    if (!parent || !hud) return;

    penHudDragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - hud.left,
      offsetY: e.clientY - hud.top,
    };
    setPenHudPosition({ left: hud.left - parent.left, top: hud.top - parent.top });
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isDrawingTool || !isEditing) {
      setPenHudPosition(null);
      setPenHudCompact(false);
      setPenHudHidden(false);
      penHudDragRef.current = null;
    }
  }, [isDrawingTool, isEditing]);

  // 銆愭柊澧炪€戝脊绐楀彲瑙嗗寲缂栬緫鍣細鍏ㄥ眬鎷栨嫿浜嬩欢鐩戝惉
  useEffect(() => {
    if (!popupDragState) return;

    const finishDragWithoutPointer = () => {
      if (popupDragMovedRef.current) {
        popupDragMovedRef.current = false;
        const isResize = popupDragState.type === 'resize';
        onCommitHistory?.(isResize ? '调整弹窗大小' : '移动弹窗位置', 'element_update', undefined);
      }
      setPopupDragState(null);
      setPopupAlignLines({ h: null, v: null });
    };

    const handleMove = (e: PointerEvent) => {
      const ds = popupDragState;
      if (e.pointerId !== ds.pointerId) return;
      if ((e.buttons & 1) !== 1) {
        finishDragWithoutPointer();
        return;
      }
      // 銆愪慨澶嶃€戜互鑸炲彴涓哄熀鍑嗚绠楃櫨鍒嗘瘮浣嶇Щ锛堣€岄潪瑙嗗彛锛夛紝淇濊瘉缂栬緫鎵嬫劅涓庨瑙堜竴鑷?

      const stage = getStageRect();
      const dx = ((e.clientX - ds.startMouseX) / stage.width) * 100;
      const dy = ((e.clientY - ds.startMouseY) / stage.height) * 100;

      if (ds.type === 'move') {
        let newX = ds.startX + dx;
        let newY = ds.startY + dy;
        // 鏅鸿兘瀵归綈锛氭帴杩戜腑蹇冩椂鍚搁檮锛堥槇鍊?2%锛?

        let alignH: number | null = null;
        let alignV: number | null = null;
        if (Math.abs(newX - 50) < 2) { newX = 50; alignV = 50; }
        if (Math.abs(newY - 50) < 2) { newY = 50; alignH = 50; }
        setPopupAlignLines({ h: alignH, v: alignV });
        // 闄愬埗鍦ㄨ鍙ｈ寖鍥村唴
        newX = Math.max(5, Math.min(95, newX));
        newY = Math.max(5, Math.min(95, newY));
        if (popupEditTarget) {
          popupDragMovedRef.current = true;
          updatePopupTarget({ popupX: Math.round(newX * 10) / 10, popupY: Math.round(newY * 10) / 10 });
        }
      } else if (ds.type === 'resize') {
        const handle = ds.handle || '';
        const resized = resizePopupPercent({
          startWidth: ds.startW,
          startHeight: ds.startH,
          deltaX: dx,
          deltaY: dy,
          handle,
          freeAspect: Boolean(ds.freeAspect),
          popupAspect: ds.aspect || 16 / 9,
          stageAspect: stage.width / Math.max(1, stage.height),
        });
        setPopupAlignLines({ h: null, v: null });
        if (popupEditTarget) {
          popupDragMovedRef.current = true;
          updatePopupTarget({
            popupWidth: Math.round(resized.width * 10) / 10,
            ...(ds.freeAspect ? { popupHeight: Math.round(resized.height * 10) / 10 } : {}),
          });
        }
      }
    };

    const handleUp = () => {
      // 寮圭獥铏氱嚎妗嗘嫋鎷界粨鏉燂細鍚堝苟涓轰竴鏉″巻鍙茶褰?

      if (popupDragMovedRef.current) {
        popupDragMovedRef.current = false;
        const isResize = popupDragState.type === 'resize';
        onCommitHistory?.(isResize ? '调整弹窗大小' : '移动弹窗位置', 'element_update', undefined);
      }
      setPopupDragState(null);
      setPopupAlignLines({ h: null, v: null });
    };

    const handlePointerEnd = (e: PointerEvent) => {
      if (e.pointerId === popupDragState.pointerId) handleUp();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handleUp);
    };
  }, [popupDragState, popupEditTarget, updatePopupTarget, onCommitHistory, getStageRect]);

  // Do not carry a previous popup drag into another selection or out of edit mode.
  useEffect(() => {
    if (!isEditing || !popupEditTarget) {
      setPopupDragState(null);
      setPopupAlignLines({ h: null, v: null });
      popupDragMovedRef.current = false;
    }
  }, [isEditing, popupEditTarget?.kind, popupEditTarget?.source.id, selectedHotspot?.hotspotId]);

  // 銆愭柊澧炪€戝脊绐楀唴瀹圭瓑姣斾緥缂╂斁锛氱洃鍚脊绐楀唴瀹瑰鍣ㄥ昂瀵革紝鍔ㄦ€佽绠?scale = min(w/1920, h/1080)
  // 浣跨敤 useLayoutEffect 纭繚 DOM 鏇存柊鍚庛€佹祻瑙堝櫒缁樺埗鍓嶅悓姝ヨ繍琛岋紝ref 宸茬粦瀹氬埌鏂板厓绱?

  useLayoutEffect(() => {
    if (!activePopupSceneId) {
      setPopupContentScale(1);
      return;
    }
    const el = popupContentRef.current;
    if (!el) return;

    const calcScale = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        // 銆愪慨澶嶃€慶ontain 瀹屾暣鍛堢幇锛歮in 浣垮満鏅瓑姣旂缉鏀惧畬鏁存樉绀猴紝缁濅笉瑁佸壀鍦烘櫙銆?
        // modal 寮圭獥宸插己鍒朵繚鎸佸満鏅瘮渚嬶紝contain 鏃舵棤鐣欑櫧鏃犺鍓紱
        // popover/inline 鍗＄墖鍐呭満鏅畬鏁存樉绀猴紙灏忓崱鐗囧唴鍙兘鐣ユ湁鐣欑櫧锛屼絾淇濊瘉鍦烘櫙瀹屾暣锛夈€?
        setPopupContentScale(Math.min(w / CANVAS_W, h / CANVAS_H));
      }
    };
    calcScale();
    // 寤惰繜鍐嶇畻涓€娆★紝纭繚 flex 甯冨眬鍜岃繃娓″姩鐢诲畬鎴愬悗灏哄绋冲畾
    const t = setTimeout(calcScale, 50);
    const t2 = setTimeout(calcScale, 200);

    const ro = new ResizeObserver(calcScale);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [activePopupSceneId, CANVAS_W, CANVAS_H]);

  // Mouse Parallax with Smooth RAF Interpolation
  const [targetParallax, setTargetParallax] = useState({ x: 0, y: 0 });
  const [smoothParallax, setSmoothParallax] = useState({ x: 0, y: 0 });

  // Smooth lerp frame loop for 3D physics feeling
  useEffect(() => {
    let animId: number | null = null;
    const loop = () => {
      let moving = false;
      setSmoothParallax((prev) => {
        const dx = targetParallax.x - prev.x;
        const dy = targetParallax.y - prev.y;
        if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return prev;
        moving = true;
        return { x: prev.x + dx * 0.12, y: prev.y + dy * 0.12 };
      });
      animId = moving ? requestAnimationFrame(loop) : null;
    };
    animId = requestAnimationFrame(loop);
    return () => { if (animId !== null) cancelAnimationFrame(animId); };
  }, [targetParallax]);

  // Dragging & Resizing States
  const [isDraggingEl, setIsDraggingEl] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  type MaskDragState = { kind: 'move' | 'resize' | 'node'; handle?: string; nodeIndex?: number; startX: number; startY: number; maskX: number; maskY: number; maskWidth: number; maskHeight: number; nodes: Array<{ x: number; y: number }>; visualPatch?: Partial<SceneElement>; moved?: boolean };
  const maskDragRef = useRef<MaskDragState | null>(null);
  const maskUpdateFrameRef = useRef<number | null>(null);
  const pendingMaskUpdateRef = useRef<Partial<SceneElement> | null>(null);
  const lastMaskPointerEventRef = useRef<{ type: 'pointer' | 'mouse'; time: number; x: number; y: number } | null>(null);
  // Chromium can emit both pointermove and the compatibility mousemove for
  // one physical drag. Keep one event stream and cache geometry for the
  // gesture so every move does not force a layout read.
  const lastTransformPointerEventRef = useRef<{ type: 'pointer' | 'mouse'; time: number; x: number; y: number } | null>(null);
  const gestureStageRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const snapTargetsRef = useRef<SceneElement[]>([]);
  const [interactionNodeDrag, setInteractionNodeDrag] = useState<{ elementId: string; index: number } | null>(null);
  const interactionNodeDragRef = useRef(interactionNodeDrag);
  const [dragStart, setDragStart] = useState({
    mouseX: 0,
    mouseY: 0,
    elX: 0,
    elY: 0,
    elW: 0,
    elH: 0,
    elRot: 0,
    elFontSize: 24,
    authoredX: 0,
    authoredY: 0,
    authoredW: 0,
    authoredH: 0,
    resizeVisual: false,
    resizeAspect: 0,
  });
  const selectedElementRef = useRef<SceneElement | undefined>(undefined);
  // Freeze the layer that received pointerdown for the lifetime of the
  // gesture. React selection updates can otherwise race pointermove.
  const gestureElementRef = useRef<SceneElement | undefined>(undefined);
  const gestureElementIdRef = useRef<string | null>(null);
  // The host is stable for the lifetime of a transform gesture. Reusing it
  // avoids a selector walk on every pointer frame, which is noticeable on
  // scenes containing video or custom-code layers.
  const gestureHostRef = useRef<HTMLElement | null>(null);
  const activeSceneRef = useRef<typeof activeScene>(activeScene);
  const currentTimeRef = useRef(currentTime);
  const dragStartRef = useRef(dragStart);
  const viewportRef = useRef(viewport);
  const onUpdateElementRef = useRef(onUpdateElement);
  const onUpdateViewportRef = useRef(onUpdateViewport);
  const onCommitHistoryRef = useRef(onCommitHistory);
  const pendingTransformRef = useRef<{ elementId: string; patch: Partial<SceneElement> } | null>(null);
  const transformFrameRef = useRef<number | null>(null);
  // Keep the latest patch for the active pointer gesture synchronously. The
  // RAF only paints it; it must not be the source of truth for pointerup,
  // because pointerup can arrive before that frame runs.
  const gestureLatestPatchRef = useRef<{ elementId: string; patch: Partial<SceneElement> } | null>(null);
  // A committed preview remains separate until React renders the same
  // geometry. It must never be used as the fallback for a later gesture.
  const gestureCommittedPatchRef = useRef<{ elementId: string; patch: Partial<SceneElement> } | null>(null);
  // The selection effect installs the latest geometry reader here so a
  // pointer frame can update the blue chrome immediately after its CSS preview
  // is painted, without waiting for MutationObserver's next task.
  const selectionMeasureRef = useRef<(() => void) | null>(null);
  // Pointer gestures are written before React can render the next frame. The
  // window listeners read this ref so a resize cannot lose its first move
  // while resizeHandle/isDraggingEl state is settling.
  const transformGestureRef = useRef<{
    kind: 'move' | 'resize' | 'rotate' | null;
    handle?: string;
    pointerId?: number;
  }>({ kind: null });
  const transformGestureActiveRef = useRef(false);
  // Fitting is a renderer lifecycle concern, not persisted project state. A
  // project saved by an older build may claim it was fitted even though its
  // rectangle is still oversized. Track the current plugin version locally so
  // every mounted version gets exactly one measurement pass.
  const customCodeFittedKeysRef = useRef<Set<string>>(new Set());
  transformGestureActiveRef.current = transformGestureRef.current.kind !== null;
  selectedElementRef.current = selectedElement;
  activeSceneRef.current = activeScene;
  currentTimeRef.current = currentTime;
  dragStartRef.current = dragStart;
  viewportRef.current = viewport;
  interactionNodeDragRef.current = interactionNodeDrag;
  onUpdateElementRef.current = onUpdateElement;
  onUpdateViewportRef.current = onUpdateViewport;
  onCommitHistoryRef.current = onCommitHistory;

  const clearGesturePreview = (elementId?: string) => {
    const stage = stageRef.current;
    const resetCustomCodeStage = (host: HTMLElement | null) => {
      const inner = host?.querySelector<HTMLElement>('[data-aether-custom-code-stage]');
      if (!inner) return;
      inner.style.removeProperty('position');
      inner.style.removeProperty('left');
      inner.style.removeProperty('top');
      inner.style.removeProperty('width');
      inner.style.removeProperty('height');
      inner.style.removeProperty('transform');
      inner.style.removeProperty('transform-origin');
    };
    if (elementId) {
      const host = gestureHostRef.current?.dataset.canvasElementId === elementId
        ? gestureHostRef.current
        : stage?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(elementId)}"]`);
      if (host) {
        host.style.removeProperty('--aether-gesture-left');
        host.style.removeProperty('--aether-gesture-top');
        host.style.removeProperty('--aether-gesture-width');
        host.style.removeProperty('--aether-gesture-height');
        host.style.removeProperty('--aether-gesture-rotate');
        host.style.removeProperty('--aether-gesture-font-size');
        host.removeAttribute('data-aether-transform-gesture');
        resetCustomCodeStage(host);
      }
    }
    // Also sweep any stale gesture variables left on the stage or other hosts
    if (stage) {
      stage.querySelectorAll<HTMLElement>('[data-aether-transform-gesture]').forEach((node) => {
        if (!elementId || node.dataset.canvasElementId === elementId) {
          node.style.removeProperty('--aether-gesture-left');
          node.style.removeProperty('--aether-gesture-top');
          node.style.removeProperty('--aether-gesture-width');
          node.style.removeProperty('--aether-gesture-height');
          node.style.removeProperty('--aether-gesture-rotate');
          node.style.removeProperty('--aether-gesture-font-size');
          node.removeAttribute('data-aether-transform-gesture');
          resetCustomCodeStage(node);
        }
      });
    }
  };

  const setGestureVisualState = (elementId: string, active: boolean) => {
    const host = gestureHostRef.current?.dataset.canvasElementId === elementId
      ? gestureHostRef.current
      : stageRef.current?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(elementId)}"]`);
    if (!host) return;
    if (active) host.setAttribute('data-aether-transform-gesture', 'true');
    else {
      host.removeAttribute('data-aether-transform-gesture');
    }
  };

  const renderGesturePreview = (elementId: string, patch: Partial<SceneElement>) => {
    const host = gestureHostRef.current?.dataset.canvasElementId === elementId
      ? gestureHostRef.current
      : stageRef.current?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(elementId)}"]`);
    if (!host) return;
    if (typeof patch.x === 'number') host.style.setProperty('--aether-gesture-left', `${patch.x}%`);
    if (typeof patch.y === 'number') host.style.setProperty('--aether-gesture-top', `${patch.y}%`);
    if (typeof patch.w === 'number') host.style.setProperty('--aether-gesture-width', `${patch.w}%`);
    if (typeof patch.h === 'number') host.style.setProperty('--aether-gesture-height', `${patch.h}%`);
    if (typeof patch.fontSize === 'number') {
      host.style.setProperty('--aether-gesture-font-size', `${patch.fontSize}px`);
    }
    if (typeof patch.rot === 'number') {
      const element = activeSceneRef.current?.els.find((item) => item.id === elementId) || gestureElementRef.current;
      const baseRotation = element ? evaluateElementProperties(element, currentTimeRef.current).rot || 0 : 0;
      host.style.setProperty('--aether-gesture-rotate', `${patch.rot - baseRotation}deg`);
    }

    // 内容与选框同帧更新：缩放时外框走 CSS 预览，UI 组件内部等比缩放原本要等
    // ResizeObserver 下一帧才更新，视觉上会“框先走、组件后追”，手感发飘。
    // 这里直接按最新外框尺寸写一次内部 transform，让组件与选框严格同步。
    const renderLayer = host.querySelector<HTMLElement>('[data-aether-ui-render-layer]');
    if (renderLayer) {
      const contentWidth = parseFloat(renderLayer.style.width) || 0;
      const contentHeight = parseFloat(renderLayer.style.height) || 0;
      const element = activeSceneRef.current?.els.find((item) => item.id === elementId) || gestureElementRef.current;
      const nextW = typeof patch.w === 'number' ? patch.w : Number(element?.w);
      const nextH = typeof patch.h === 'number' ? patch.h : Number(element?.h);
      if (contentWidth > 0 && contentHeight > 0 && Number.isFinite(nextW) && Number.isFinite(nextH)) {
        const boxWidth = (nextW / 100) * CANVAS_W;
        const boxHeight = (nextH / 100) * CANVAS_H;
        const scaleX = boxWidth / contentWidth;
        const scaleY = boxHeight / contentHeight;
        if (renderLayer.dataset.aetherScaleMode === 'uniform') {
          const uniform = Math.max(0.01, Math.min(scaleX, scaleY));
          renderLayer.style.transform = `scale(${uniform}, ${uniform})`;
        } else {
          renderLayer.style.transform = `scale(${Math.max(0.01, scaleX)}, ${Math.max(0.01, scaleY)})`;
        }
      }
    }

    // 自定义代码（iframe）在缩放时逐帧修改尺寸会触发内部重排/重绘，容易出现长帧卡顿。
    // 手势期间保持起始尺寸、用 transform 跟随外框，松手后再真正 reflow 一次。
    if (transformGestureRef.current.kind === 'resize') {
      const stage = host.querySelector<HTMLElement>('[data-aether-custom-code-stage]');
      const startW = Number(dragStartRef.current?.elW);
      const startH = Number(dragStartRef.current?.elH);
      const element = activeSceneRef.current?.els.find((item) => item.id === elementId) || gestureElementRef.current;
      const nextW = typeof patch.w === 'number' ? patch.w : Number(element?.w);
      const nextH = typeof patch.h === 'number' ? patch.h : Number(element?.h);
      const startPxW = (startW / 100) * CANVAS_W;
      const startPxH = (startH / 100) * CANVAS_H;
      if (stage && startPxW > 0 && startPxH > 0 && Number.isFinite(nextW) && Number.isFinite(nextH)) {
        stage.style.position = 'absolute';
        stage.style.left = '0';
        stage.style.top = '0';
        stage.style.width = `${startPxW}px`;
        stage.style.height = `${startPxH}px`;
        stage.style.transformOrigin = 'top left';
        stage.style.transform = `scale(${((nextW / 100) * CANVAS_W) / startPxW}, ${((nextH / 100) * CANVAS_H) / startPxH})`;
      }
    }

    // 实时同步更新底部 HUD 数值，确保拖拽缩放时提供毫秒级精准反馈（使用 innerHTML 绝不破坏 React TextNode 引用）
    const hud = document.querySelector<HTMLElement>('[data-transform-hud="true"]');
    if (hud) {
      if (typeof patch.x === 'number') {
        const elX = hud.querySelector<HTMLElement>('[data-hud-x]');
        if (elX) elX.innerHTML = `${patch.x.toFixed(2)}%`;
      }
      if (typeof patch.y === 'number') {
        const elY = hud.querySelector<HTMLElement>('[data-hud-y]');
        if (elY) elY.innerHTML = `${patch.y.toFixed(2)}%`;
      }
      if (typeof patch.w === 'number') {
        const elW = hud.querySelector<HTMLElement>('[data-hud-w]');
        if (elW) elW.innerHTML = `${patch.w.toFixed(2)}%`;
      }
      if (typeof patch.h === 'number') {
        const elH = hud.querySelector<HTMLElement>('[data-hud-h]');
        if (elH) elH.innerHTML = `${patch.h.toFixed(2)}%`;
      }
      if (typeof patch.fontSize === 'number') {
        const elFont = hud.querySelector<HTMLElement>('[data-hud-font]');
        if (elFont) elFont.innerHTML = `${Math.round(patch.fontSize)}px`;
      }
      if (typeof patch.rot === 'number') {
        const elRot = hud.querySelector<HTMLElement>('[data-hud-rot]');
        if (elRot) elRot.innerHTML = `${patch.rot.toFixed(1)}°`;
      }
    }

    // The DOM preview is already up to date. Read its transformed quad once
    // in this same animation frame so the handles never trail the layer by an
    // additional MutationObserver frame.
    selectionMeasureRef.current?.();
  };

  const queueTransformUpdate = (elementId: string, patch: Partial<SceneElement>) => {
    const next = { elementId, patch };
    pendingTransformRef.current = next;
    // Capture this before scheduling RAF. A fast pointerup can otherwise
    // flush the previous frame and cause a visible snap.
    gestureLatestPatchRef.current = next;
    if (transformFrameRef.current !== null) return;
    transformFrameRef.current = window.requestAnimationFrame(() => {
      transformFrameRef.current = null;
      const pending = pendingTransformRef.current;
      pendingTransformRef.current = null;
      // Keep pointer feedback on the layer host. Updating project state here
      // would rebuild the full scene and expensive media/UI component subtree
      // on every animation frame.
      if (pending) {
        renderGesturePreview(pending.elementId, pending.patch);
      }
    });
  };

  const flushTransformUpdate = () => {
    if (transformFrameRef.current !== null) {
      window.cancelAnimationFrame(transformFrameRef.current);
      transformFrameRef.current = null;
    }
    const pending = pendingTransformRef.current || gestureLatestPatchRef.current;
    pendingTransformRef.current = null;
    gestureLatestPatchRef.current = null;
    if (pending) {
      renderGesturePreview(pending.elementId, pending.patch);
      gestureCommittedPatchRef.current = pending;
      onUpdateElementRef.current(pending.elementId, pending.patch, undefined, false);
    }
  };

  useLayoutEffect(() => {
    // A previous pointerup can commit React state while a new pointer gesture
    // is already active. Its reconciliation must not remove the new gesture's
    // CSS preview and make the layer visibly jump back for one frame.
    if (transformGestureRef.current.kind !== null) return;
    const pending = gestureCommittedPatchRef.current;
    if (!pending) return;
    const committed = activeScene?.els.find((element) => element.id === pending.elementId);
    if (!committed) return;
    const animated = pending.patch.keyframes ? evaluateElementProperties(committed, currentTimeRef.current) : null;
    const applied = Object.entries(pending.patch).every(([key, value]) => {
      if (key === 'keyframes') return true;
      const targetVal = animated && ['x', 'y', 'w', 'h', 'rot'].includes(key)
        ? animated[key as keyof typeof animated]
        : committed[key as keyof SceneElement];
      if (typeof value === 'number' && typeof targetVal === 'number') {
        return Math.abs(value - targetVal) < 0.05;
      }
      return targetVal === value;
    });
    if (!applied) return;
    clearGesturePreview(pending.elementId);
    gestureCommittedPatchRef.current = null;
  }, [activeScene]);
  // 鎷栨嫿/缂╂斁/鏃嬭浆鏄惁鍙戠敓瀹為檯浣嶇Щ锛歮ouseup 鏃舵嵁姝ゅ悎骞舵彁浜や竴鏉″巻鍙诧紙閬垮厤璇偣涔熺敓鎴愮┖鍘嗗彶锛?

  const elDragMovedRef = useRef(false);
  // A fast click can release before the state-driven window listener is mounted.
  // Arm a synchronous release guard on every transform gesture so a missed
  // mouseup can never leave an element following the cursor.
  const transformReleaseGuardRef = useRef<(() => void) | null>(null);
  const armTransformReleaseGuard = useCallback((action: string, label: string) => {
    transformReleaseGuardRef.current?.();
    const release = () => {
      if (transformReleaseGuardRef.current !== release) return;
      transformReleaseGuardRef.current = null;
      const completedElementId = gestureElementIdRef.current;
      // Clear the visual gesture state while the stable host ref is still
      // available. This avoids a release-frame DOM lookup and keeps the
      // selection chrome in sync with the committed patch.
      if (completedElementId) {
        setGestureVisualState(completedElementId, false);
        if (!elDragMovedRef.current) {
          clearGesturePreview(completedElementId);
        }
      }
      gestureElementRef.current = undefined;
      gestureElementIdRef.current = null;
      gestureHostRef.current = null;
      transformGestureRef.current = { kind: null };
      gestureStageRectRef.current = null;
      snapTargetsRef.current = [];
      if (elDragMovedRef.current) {
        flushTransformUpdate();
        elDragMovedRef.current = false;
        onCommitHistoryRef.current?.(action, 'element_update', label ? `图层: ${label}` : undefined);
      }
      setIsDraggingEl(false);
      setResizeHandle(null);
      setIsRotating(false);
      setIsPanning(false);
      setSmartGuides([]);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('blur', release);
    };
    transformReleaseGuardRef.current = release;
    window.addEventListener('mouseup', release, { once: true });
    window.addEventListener('blur', release, { once: true });
  }, [onCommitHistory]);
  // 寮圭獥铏氱嚎妗嗘嫋鎷斤紙绉诲姩/缂╂斁锛夋槸鍚﹀彂鐢熷疄闄呬綅绉?

  const popupDragMovedRef = useRef(false);

  // Smart Snap Alignment Guides
  interface SmartGuide {
    type: 'vertical' | 'horizontal';
    pos: number; // Percentage
    label?: string;
  }
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([]);
  const smartGuidesRef = useRef<SmartGuide[]>([]);
  const updateSmartGuides = (next: SmartGuide[]) => {
    const previous = smartGuidesRef.current;
    const same = previous.length === next.length && previous.every((guide, index) => {
      const candidate = next[index];
      return guide.type === candidate.type && guide.pos === candidate.pos && guide.label === candidate.label;
    });
    if (same) return;
    smartGuidesRef.current = next;
    setSmartGuides(next);
  };

function isValidSelectionOverlay(overlay: any): overlay is { points: Array<{ x: number; y: number }>; rotate: { x: number; y: number } } {
  if (!overlay || !Array.isArray(overlay.points) || overlay.points.length < 4) return false;
  for (let i = 0; i < 4; i++) {
    const pt = overlay.points[i];
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
  }
  if (!overlay.rotate || !Number.isFinite(overlay.rotate.x) || !Number.isFinite(overlay.rotate.y)) return false;
  return true;
}

  // 视口层安全框定位（舞台相对容器的屏幕矩形，用于在不受舞台 transform 缩放影响的视口层绘制安全框）
  const [stageScreen, setStageScreen] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [selectionOverlay, setSelectionOverlay] = useState<{
    points: Array<{ x: number; y: number }>;
    rotate: { x: number; y: number };
  } | null>(null);
  const selectionChromeRef = useRef<HTMLDivElement | null>(null);
  const selectionOverlayRef = useRef<{
    points: Array<{ x: number; y: number }>;
    rotate: { x: number; y: number };
  } | null>(null);
  // Geometry cannot be reused across selected layers. Keeping the owner id
  // beside the cached points prevents rapid clicks from treating a different
  // layer with a coincident rectangle as unchanged.
  const selectionOverlayElementIdRef = useRef<string | null>(null);

  // 当前选框尺寸（画布像素，不是屏幕像素）。手势期间优先读最新 patch，
  // 保证选框旁的尺寸徽标实时、准确。
  const getSelectionBadgeSize = () => {
    const patch = gestureLatestPatchRef.current?.patch;
    const current = selectedElementRef.current;
    const width = typeof patch?.w === 'number' ? patch.w : Number(current?.w);
    const height = typeof patch?.h === 'number' ? patch.h : Number(current?.h);
    return {
      w: Math.round(((Number.isFinite(width) ? width : 0) / 100) * CANVAS_W * 10) / 10,
      h: Math.round(((Number.isFinite(height) ? height : 0) / 100) * CANVAS_H * 10) / 10,
    };
  };

  // Paint an already-mounted selection chrome before React finishes the
  // parent selection update. Selecting a different layer otherwise waits for
  // the full canvas subtree (video/custom-code/UI renderers) to reconcile.
  // This is visual-only; the actual selected id and timeline priority still
  // come from onSelectElement/onSelectTimelineElement.
  const paintImmediateSelectionChrome = (elementId: string) => {
    const chrome = selectionChromeRef.current;
    const stage = stageRef.current;
    const scene = activeSceneRef.current;
    const element = scene?.els.find((item) => item.id === elementId);
    if (!chrome || !stage || !element || element.locked) return;
    const target = Array.from(stage.querySelectorAll<HTMLElement>('[data-canvas-element-id]'))
      .find((node) => node.dataset.canvasElementId === elementId);
    if (!target) return;
    const stageRect = stage.getBoundingClientRect();
    const geometry = getSelectionGeometry(target);
    const points = geometry.quad
      ? [geometry.quad.p1, geometry.quad.p2, geometry.quad.p3, geometry.quad.p4]
        .map((point) => ({ x: point.x - stageRect.left, y: point.y - stageRect.top }))
      : [
        { x: geometry.rect.left - stageRect.left, y: geometry.rect.top - stageRect.top },
        { x: geometry.rect.right - stageRect.left, y: geometry.rect.top - stageRect.top },
        { x: geometry.rect.right - stageRect.left, y: geometry.rect.bottom - stageRect.top },
        { x: geometry.rect.left - stageRect.left, y: geometry.rect.bottom - stageRect.top },
      ];
    if (!points || points.length < 4 || points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    const topMid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    const center = { x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4 };
    const length = Math.hypot(topMid.x - center.x, topMid.y - center.y) || 1;
    const rotate = {
      x: topMid.x + ((topMid.x - center.x) / length) * SELECTION_CHROME.rotateOffset,
      y: topMid.y + ((topMid.y - center.y) / length) * SELECTION_CHROME.rotateOffset,
    };
    if (!Number.isFinite(rotate.x) || !Number.isFinite(rotate.y)) return;
    chrome.dataset.selectionElementId = elementId;
    const polygon = chrome.querySelector<SVGPolygonElement>('svg polygon');
    if (polygon) polygon.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
    const line = chrome.querySelector<SVGLineElement>('svg line');
    if (line) {
      line.setAttribute('x1', String(topMid.x));
      line.setAttribute('y1', String(topMid.y));
      line.setAttribute('x2', String(rotate.x));
      line.setAttribute('y2', String(rotate.y));
    }
    const handles = Array.from(chrome.querySelectorAll<HTMLElement>('[data-resize-handle]'));
    const handlePoints = [
      points[0],
      { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
      points[1],
      { x: (points[1].x + points[2].x) / 2, y: (points[1].y + points[2].y) / 2 },
      points[2],
      { x: (points[2].x + points[3].x) / 2, y: (points[2].y + points[3].y) / 2 },
      points[3],
      { x: (points[3].x + points[0].x) / 2, y: (points[3].y + points[0].y) / 2 },
    ];
    handles.forEach((handle, index) => {
      const point = handlePoints[index];
      if (point) {
        handle.style.left = `${point.x}px`;
        handle.style.top = `${point.y}px`;
      }
    });
    const rotateHandle = chrome.querySelector<HTMLElement>('[data-rotate-handle]');
    if (rotateHandle) {
      rotateHandle.style.left = `${rotate.x}px`;
      rotateHandle.style.top = `${rotate.y}px`;
    }
    const badge = chrome.querySelector<HTMLElement>('[data-selection-badge]');
    if (badge) {
      badge.style.left = `${(points[2].x + points[3].x) / 2}px`;
      badge.style.top = `${Math.max(points[2].y, points[3].y) + 16}px`;
      const badgeText = badge.querySelector<HTMLElement>('[data-selection-badge-text]');
      if (badgeText) {
        const { w: wPx, h: hPx } = getSelectionBadgeSize();
        const patch = gestureLatestPatchRef.current?.patch;
        const currentRot = typeof patch?.rot === 'number' ? patch.rot : (selectedElementRef.current?.rot || 0);
        const currentFontSize = typeof patch?.fontSize === 'number' ? patch.fontSize : selectedElementRef.current?.fontSize;
        const rotStr = Math.abs(currentRot) >= 0.05 ? ` | ${currentRot.toFixed(1)}°` : '';
        const fontStr = typeof currentFontSize === 'number' && selectedElementRef.current?.type === 'txt' ? ` | 字号 ${Math.round(currentFontSize)}px` : '';
        badgeText.innerHTML = `${wPx.toFixed(1)} × ${hPx.toFixed(1)} px${rotStr}${fontStr}`;
      }
    }
    // Keep React's next render on the same geometry. Without this, a rapid
    // second click can reconcile the previous layer's cached points back over
    // the immediate DOM paint before the layout measurement runs.
    selectionOverlayRef.current = { points, rotate };
    selectionOverlayElementIdRef.current = elementId;
    setSelectionOverlay({ points, rotate });
  };

  const getSelectionGeometry = useCallback((target: HTMLElement) => {
    // Transform chrome follows the object's layout bounds. Shadows, blur and
    // glow are visual effects, so they must not push resize handles away from
    // the object itself (the same rule applies to every canvas element type).
    type Point = { x: number; y: number };
    type Quad = { p1: Point; p2: Point; p3: Point; p4: Point };
    const measuredQuad = (target as HTMLElement & { getBoxQuads?: () => Quad[] }).getBoxQuads?.()[0] || null;
    const rect = target.getBoundingClientRect();
    let quad: Quad | null = measuredQuad;
    if (!quad) {
      // Chromium builds without getBoxQuads still need a rotated selection
      // outline. Rebuild its corners from the computed affine transform and
      // the transformed DOMRect center rather than silently skipping effects.
      // Include the canvas stage's scale as well as the element's own rotation.
      // getBoundingClientRect already includes ancestor transforms, while the
      // computed transform on target alone does not.
      let a = 1; let b = 0; let c = 0; let d = 1;
      for (let node: HTMLElement | null = target; node; node = node.parentElement) {
        const current = new DOMMatrixReadOnly(window.getComputedStyle(node).transform);
        const nextA = current.a * a + current.c * b;
        const nextB = current.b * a + current.d * b;
        const nextC = current.a * c + current.c * d;
        const nextD = current.b * c + current.d * d;
        a = nextA; b = nextB; c = nextC; d = nextD;
      }
      const halfWidth = target.offsetWidth / 2;
      const halfHeight = target.offsetHeight / 2;
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const corner = (x: number, y: number) => ({ x: center.x + a * x + c * y, y: center.y + b * x + d * y });
      quad = {
        p1: corner(-halfWidth, -halfHeight),
        p2: corner(halfWidth, -halfHeight),
        p3: corner(halfWidth, halfHeight),
        p4: corner(-halfWidth, halfHeight),
      };
    }
    return { rect, points: null, quad };
  }, []);

  const measureStageScreen = useCallback(() => {
    if (!stageRef.current || !containerRef.current) return;
    const s = stageRef.current.getBoundingClientRect();
    const c = containerRef.current.getBoundingClientRect();
    const next = {
      left: s.left - c.left,
      top: s.top - c.top,
      width: s.width,
      height: s.height,
    };
    setStageScreen((previous) => (
      previous
      && Math.abs(previous.left - next.left) < 0.1
      && Math.abs(previous.top - next.top) < 0.1
      && Math.abs(previous.width - next.width) < 0.1
      && Math.abs(previous.height - next.height) < 0.1
        ? previous
        : next
    ));
  }, []);

  // 鑸炲彴灞忓箷鐭╁舰娴嬮噺锛氱敾甯冩湁鏁堝尯鍩熻竟鐣屽父鏄?+ 瀹夊叏妗嗗叡鐢紙缂栬緫鎬佸缁堟祴閲忥紝涓嶄緷璧栧畨鍏ㄦ寮€鍏筹級
  useEffect(() => {
    if (!isEditing) return;
    measureStageScreen();
    const t1 = setTimeout(measureStageScreen, 60);
    const t2 = setTimeout(measureStageScreen, 200);
    const ro = new ResizeObserver(() => measureStageScreen());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measureStageScreen);
    // The editor scrolls inside nested workspace containers. The canvas stage
    // can move on screen without changing its size, so ResizeObserver alone
    // leaves selection chrome at its previous viewport position.
    window.addEventListener('scroll', measureStageScreen, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener('resize', measureStageScreen);
      window.removeEventListener('scroll', measureStageScreen, true);
    };
  }, [isEditing, viewport.zoom, viewport.panX, viewport.panY, measureStageScreen]);

  // Keep selection chrome outside the transformed element tree. Handles stay
  // screen-sized while the outline follows the element's transformed corners.
  // Measure once in the layout phase so a click has selection chrome on its
  // first painted frame. During a transform, the pointer RAF uses the same
  // reader directly and observers stay quiet.
  useLayoutEffect(() => {
    if (!isEditing || !selectedElementId || selectedElement?.locked || isDrawingTool) {
      selectionOverlayRef.current = null;
      selectionOverlayElementIdRef.current = null;
      setSelectionOverlay(null);
      selectionMeasureRef.current = null;
      return;
    }
    let disposed = false;
    let frameId: number | null = null;
    let selectedLayer: HTMLElement | null = null;
    const publish = (next: { points: Array<{ x: number; y: number }>; rotate: { x: number; y: number } } | null) => {
      const previous = selectionOverlayRef.current;
      if (!next || !isValidSelectionOverlay(next)) {
        if (previous === null) return;
        selectionOverlayRef.current = null;
        selectionOverlayElementIdRef.current = null;
        setSelectionOverlay(null);
        return;
      }
      const unchanged = selectionOverlayElementIdRef.current === selectedElementId && previous
        && previous.points.length === next.points.length
        && previous.points.every((point, index) => Math.abs(point.x - next.points[index].x) < 0.05 && Math.abs(point.y - next.points[index].y) < 0.05)
        && Math.abs(previous.rotate.x - next.rotate.x) < 0.05
        && Math.abs(previous.rotate.y - next.rotate.y) < 0.05;
      if (unchanged) return;
      selectionOverlayRef.current = next;
      selectionOverlayElementIdRef.current = selectedElementId;
      // During a transform, updating React state here would rebuild the whole
      // viewport for every pointer frame. The chrome is already mounted, so
      // paint only its geometry in place and keep the expensive scene tree out
      // of the gesture's critical path.
      if (transformGestureRef.current.kind !== null && selectionChromeRef.current) {
        const chrome = selectionChromeRef.current;
        const polygon = chrome.querySelector<SVGPolygonElement>('svg polygon');
        if (polygon) polygon.setAttribute('points', next.points.map((point) => `${point.x},${point.y}`).join(' '));
        const line = chrome.querySelector<SVGLineElement>('svg line');
        if (line) {
          line.setAttribute('x1', String((next.points[0].x + next.points[1].x) / 2));
          line.setAttribute('y1', String((next.points[0].y + next.points[1].y) / 2));
          line.setAttribute('x2', String(next.rotate.x));
          line.setAttribute('y2', String(next.rotate.y));
        }
        const handles = Array.from(chrome.querySelectorAll<HTMLElement>('[data-resize-handle]'));
        const points = [
          next.points[0],
          { x: (next.points[0].x + next.points[1].x) / 2, y: (next.points[0].y + next.points[1].y) / 2 },
          next.points[1],
          { x: (next.points[1].x + next.points[2].x) / 2, y: (next.points[1].y + next.points[2].y) / 2 },
          next.points[2],
          { x: (next.points[2].x + next.points[3].x) / 2, y: (next.points[2].y + next.points[3].y) / 2 },
          next.points[3],
          { x: (next.points[3].x + next.points[0].x) / 2, y: (next.points[3].y + next.points[0].y) / 2 },
        ];
        handles.forEach((handle, index) => {
          const point = points[index];
          if (point) {
            handle.style.left = `${point.x}px`;
            handle.style.top = `${point.y}px`;
          }
        });
        const rotate = chrome.querySelector<HTMLElement>('[data-rotate-handle]');
        if (rotate) {
          rotate.style.left = `${next.rotate.x}px`;
          rotate.style.top = `${next.rotate.y}px`;
        }
        // 手势期间底部 HUD 和选框旁的尺寸徽标都要实时更新，否则徽标会停在
        // 拖动开始前的数值，看起来像“尺寸卡住了”。
        const liveBadge = chrome.querySelector<HTMLElement>('[data-selection-badge]');
        if (liveBadge) {
          liveBadge.style.left = `${(next.points[2].x + next.points[3].x) / 2}px`;
          liveBadge.style.top = `${Math.max(next.points[2].y, next.points[3].y) + 16}px`;
          const liveBadgeText = liveBadge.querySelector<HTMLElement>('[data-selection-badge-text]');
          if (liveBadgeText) {
            const { w: wPx, h: hPx } = getSelectionBadgeSize();
            const patch = gestureLatestPatchRef.current?.patch;
            const currentRot = typeof patch?.rot === 'number' ? patch.rot : (selectedElementRef.current?.rot || 0);
            const rotStr = Math.abs(currentRot) >= 0.05 ? ` | ${currentRot.toFixed(1)}°` : '';
            const fontStr = selectedElementRef.current?.type === 'txt' && selectedElementRef.current.fontSize
              ? ` | 字号 ${Math.round(selectedElementRef.current.fontSize)}px` : '';
            liveBadgeText.innerHTML = `${wPx.toFixed(1)} × ${hPx.toFixed(1)} px${rotStr}${fontStr}`;
          }
        }
        // The chrome node can be remounted when a media/UI renderer updates.
        // If it no longer belongs to this selected layer, React must receive
        // the geometry so the replacement node is mounted with fresh points.
        if (chrome.dataset.selectionElementId === selectedElementId) return;
      }
      setSelectionOverlay(next);
    };
    const measure = () => {
      const host = containerRef.current;
      const stage = stageRef.current;
      const currentElement = selectedElementRef.current;
      if (!currentElement || currentElement.id !== selectedElementId) {
        publish(null);
        return;
      }
      // A selected layer can be remounted while media metadata or a renderer
      // changes. Never measure a detached node: doing so leaves the blue
      // selection chrome behind at the old position until another resize.
      const layer = selectedLayer && selectedLayer.isConnected
        && selectedLayer.dataset.canvasElementId === selectedElementId
        ? selectedLayer
        : stage
        ? (Array.from(stage.querySelectorAll<HTMLElement>('[data-canvas-element-id]'))
          .find((node) => node.dataset.canvasElementId === selectedElementId) || null)
        : null;
      selectedLayer = layer;
      if (!host || !stage || !layer) {
        publish(null);
        return;
      }
      const stageRect = stage.getBoundingClientRect();
      // Every editable layer uses the same authored rectangle for selection
      // chrome. UI components render inside this host but do not get a second
      // selection coordinate system.
      const geometry = getSelectionGeometry(layer);
      const quad = geometry.quad;
      const rect = geometry.rect;
      const points = geometry.points
        ? geometry.points.map((point) => ({ x: point.x - stageRect.left, y: point.y - stageRect.top }))
        : quad
        ? [quad.p1, quad.p2, quad.p3, quad.p4].map((point) => ({ x: point.x - stageRect.left, y: point.y - stageRect.top }))
        : [
          { x: rect.left - stageRect.left, y: rect.top - stageRect.top },
          { x: rect.right - stageRect.left, y: rect.top - stageRect.top },
          { x: rect.right - stageRect.left, y: rect.bottom - stageRect.top },
          { x: rect.left - stageRect.left, y: rect.bottom - stageRect.top },
        ];
      if (!points || points.length < 4 || points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
        publish(null);
        return;
      }
      const topMid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const center = { x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4 };
      const length = Math.hypot(topMid.x - center.x, topMid.y - center.y) || 1;
      const rotate = {
        x: topMid.x + ((topMid.x - center.x) / length) * SELECTION_CHROME.rotateOffset,
        y: topMid.y + ((topMid.y - center.y) / length) * SELECTION_CHROME.rotateOffset,
      };
      if (!Number.isFinite(rotate.x) || !Number.isFinite(rotate.y)) {
        publish(null);
        return;
      }
      publish({ points, rotate });
    };
    // Expose the reader to the pointer-frame renderer. This is deliberately
    // assigned before the first measurement so a resize can refresh chrome in
    // the same RAF as the layer's CSS preview.
    selectionMeasureRef.current = measure;
    selectedLayer = Array.from(stageRef.current?.querySelectorAll<HTMLElement>('[data-canvas-element-id]') || [])
      .find((node) => node.dataset.canvasElementId === selectedElementId) || null;
    measure();
    const layer = selectedLayer;
    // CSS transforms do not always trigger ResizeObserver because the layer's
    // layout size is unchanged. The mutation observer below therefore also
    // measures style changes while a transform gesture is active.
    const observer = new ResizeObserver(() => {
      // Mask gestures only change the clip geometry. Re-reading the selected
      // layer's transformed DOM bounds on the first mask update forces a
      // synchronous layout on complex media and causes the initial hitch.
      // Transform gestures refresh the chrome directly from the same RAF as
      // the CSS preview, so an observer callback would only add a second
      // layout pass and a visible hitch.
      if (maskDragRef.current || transformGestureRef.current.kind !== null) return;
      measure();
    });
    if (layer) observer.observe(layer);
    const mutationObserver = new MutationObserver((records) => {
      if (maskDragRef.current || transformGestureRef.current.kind !== null) return;
      // UI selection chrome follows the authored layer. Internal renderer
      // styles cannot change its rectangle, so do not force a layout read for
      // every component content update during a resize gesture.
      if (selectedElement?.type === 'ui-component' && records.length > 0 && records.every((record) => {
        const target = record.target instanceof Element ? record.target : null;
        return Boolean(target?.closest('[data-aether-ui-render-layer="true"]'));
      })) return;
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
      if (!disposed) measure();
      });
    });
    if (layer) mutationObserver.observe(layer, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    // A renderer may replace the selected layer node (for example while a
    // video element recovers from a decode error). The old node cannot observe
    // its own removal, so watch direct stage children to rebind the chrome.
    if (stageRef.current) mutationObserver.observe(stageRef.current, { childList: true });
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      disposed = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      mutationObserver.disconnect();
      selectedLayer = null;
      if (selectionMeasureRef.current === measure) selectionMeasureRef.current = null;
      window.removeEventListener('resize', measure);
    };
  }, [getSelectionGeometry, isEditing, selectedElementId, selectedElement?.locked, selectedElement?.type, viewport.zoom, viewport.panX, viewport.panY, isDrawingTool]);

  // Pan State
  const [isPanning, setIsPanning] = useState(false);
  const panSessionRef = useRef<{ mouseX: number; mouseY: number; startPanX: number; startPanY: number; source: 'space' | 'pointer' } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const spacePressedRef = useRef(false);
  const spaceShortcutArmedRef = useRef(false);
  const spacePanUsedRef = useRef(false);
  const isPointerOverViewportRef = useRef(false);
  const panGestureRef = useRef<'space' | 'pointer' | null>(null);

  const beginViewportPan = useCallback((e: React.MouseEvent, source: 'space' | 'pointer') => {
    if (source === 'space') spacePanUsedRef.current = true;
    panSessionRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
      source,
    };
    setIsPanning(true);
    panGestureRef.current = source;
  }, [viewport.panX, viewport.panY]);


  // 銆怳I 缁勪欢鎺у埗鐐硅创鍚堛€戞櫘閫?ui-component 鍏冪礌鑻ョ洅瀛愭瘮渚嬩笌缁勪欢鍘熷姣斾緥鍋忓樊瓒呰繃 10%锛?  // 鑷姩淇鐩掑瓙楂樺害锛堜繚鎸佸搴?浣嶇疆涓嶅彉锛夛紝淇濊瘉鍐呭 100% 閾烘弧銆佹帶鍒剁偣璐村悎鍐呭杈圭紭銆?  // AI 璁捐绯荤粺鎵樼鐨勭洅瀛愯烦杩囨淇锛岄伩鍏嶆寕杞芥祴閲忕牬鍧?AI 缃戞牸甯冨眬銆?

  const handleCustomCodeBounds = useCallback((elementId: string, bounds: CustomCodeBounds) => {
    // The canvas iframe can mount at 1×1 for one frame before the stage lays it
    // out. Fitting to that measurement would lock the layer to a bogus size and
    // make the real measurement below look like a "manual" resize.
    if (
      !projectHydrated || !isEditing || !activeScene
      || bounds.viewportWidth < 24 || bounds.viewportHeight < 24
      || bounds.width < 4 || bounds.height < 4
    ) return;
    const element = activeScene.els.find((item) => item.id === elementId);
    if (!element || element.type !== 'custom-code') return;
    // A completed freeform fit is persisted on the layer. Do not re-fit it on
    // every page refresh; that would overwrite a user's manual dimensions.
    // Legacy layers that were marked fitted while still ratio-locked are the
    // only ones eligible for the one-time compatibility repair below.
    // v2 also repairs older projects that were fitted to the iframe viewport
    // instead of the component's actually painted content.
    const fitVersion = Number(element.customCodeFitVersion) || 0;
    if (element.customCodeAutoFitted && !element.lockAspectRatio && fitVersion >= 2) return;
    const fitKey = `${element.id}:${element.customCode?.version ?? 0}:${element.customCode?.updatedAt ?? ''}`;
    // After the first successful measurement the user owns the rectangle. A
    // versioned key also repairs legacy saved layers whose boolean marker was
    // written before visible-bounds fitting actually worked.
    if (customCodeFittedKeysRef.current.has(fitKey)) return;
    const leftRatio = Math.max(0, Math.min(1, bounds.x / bounds.viewportWidth));
    const topRatio = Math.max(0, Math.min(1, bounds.y / bounds.viewportHeight));
    const widthRatio = Math.max(0.01, Math.min(1, bounds.width / bounds.viewportWidth));
    const heightRatio = Math.max(0.01, Math.min(1, bounds.height / bounds.viewportHeight));
    const nextW = Math.max(1, Math.round(element.w * widthRatio * 10) / 10);
    const nextH = Math.max(1, Math.round(element.h * heightRatio * 10) / 10);
    const nextX = Math.max(0, Math.min(100 - nextW, Math.round((element.x + element.w * leftRatio) * 10) / 10));
    const nextY = Math.max(0, Math.min(100 - nextH, Math.round((element.y + element.h * topRatio) * 10) / 10));
    const aspect = (nextW * CANVAS_W) / Math.max(0.01, nextH * CANVAS_H);
    // ResizeObserver can report the same painted bounds more than once while
    // the component is mounting. Do not write an identical geometry back into
    // project state: that creates a render -> measure -> update loop and can
    // surface React's "Maximum update depth exceeded" error.
    const sameGeometry = Math.abs(element.x - nextX) < 0.05
      && Math.abs(element.y - nextY) < 0.05
      && Math.abs(element.w - nextW) < 0.05
      && Math.abs(element.h - nextH) < 0.05
      && Math.abs((element.mediaAspect || 0) - aspect) < 0.01;
    if (sameGeometry) {
      // The visible bounds can equal the initial rectangle (for example a
      // full-bleed SVG). Still commit the completion marker so the measurement
      // is not retried forever and the component owns its geometry from now on.
      customCodeFittedKeysRef.current.add(fitKey);
      if (!element.customCodeAutoFitted || element.lockAspectRatio || fitVersion < 2) {
        onUpdateElement(elementId, { customCodeAutoFitted: true, lockAspectRatio: false, customCodeFitVersion: 2 }, '贴合代码组件边界', false);
      }
      return;
    }
    customCodeFittedKeysRef.current.add(fitKey);
    onUpdateElement(elementId, {
      x: nextX,
      y: nextY,
      w: nextW,
      h: nextH,
      mediaAspect: aspect,
      lockAspectRatio: false,
      customCodeAutoFitted: true,
      customCodeFitVersion: 2,
    }, '贴合代码组件边界', false);
  }, [activeScene, CANVAS_H, CANVAS_W, isEditing, onUpdateElement, projectHydrated]);

  // A native shadow component can mount before the SceneElement state reaches
  // this render. Consume its cached bounds on the next canvas pass so the
  // first measurement cannot be lost.
  useEffect(() => {
    if (!projectHydrated || !isEditing || !activeScene) return;
    const consume = () => {
      activeScene.els.filter((element) => element.type === 'custom-code').forEach((element) => {
        const host = stageRef.current?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(element.id)}"] [data-aether-visible-bounds]`);
        const raw = host?.dataset.aetherVisibleBounds;
        if (!raw) return;
        try { handleCustomCodeBounds(element.id, JSON.parse(raw) as CustomCodeBounds); } catch { /* ignore malformed cache */ }
      });
    };
    const timers = [0, 100, 300, 700, 1200, 2000].map((delay) => window.setTimeout(consume, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeScene, handleCustomCodeBounds, isEditing, projectHydrated]);

  const handleCustomCodeTextChange = useCallback((elementId: string, html: string, textKey?: string, value?: string) => {
    // The iframe has just lost focus, so hand pointer ownership back to the canvas
    // even when the generated HTML was unchanged or fails validation.
    setInlineCustomCodeEditId(null);
    setInlineCustomCodeTextKey(null);
    if (!isEditing || !activeScene || !html || html.length > 100_000) return;
    const element = activeScene.els.find((item) => item.id === elementId);
    if (!element?.customCode) return;
    const htmlChanged = element.customCode.html !== html;
    const textChanged = typeof textKey === 'string' && typeof value === 'string';
    if (!htmlChanged && !textChanged) return;

    const controls = element.customCodeControls?.length
      ? element.customCodeControls
      : element.customCode.controls || [];
    const hasTextControl = textChanged && controls.some((control) => control.key === textKey);
    const nextProps = hasTextControl
      ? { ...(element.customCodeProps || {}), [textKey as string]: value }
      : undefined;
    onUpdateElement(elementId, {
      customCode: {
        ...element.customCode,
        ...(htmlChanged ? { html, version: element.customCode.version + 1 } : {}),
        ...(textChanged ? { textOverrides: { ...(element.customCode.textOverrides || {}), [textKey as string]: value as string } } : {}),
        ...(nextProps ? { controlValues: nextProps } : {}),
        updatedAt: new Date().toISOString(),
      },
      ...(nextProps ? { customCodeProps: nextProps } : {}),
    }, '编辑代码组件文字');
  }, [activeScene, isEditing, onUpdateElement]);

  const handleCustomCodeTextOverride = useCallback((elementId: string, textKey: string, value: string) => {
    setInlineCustomCodeEditId(null);
    setInlineCustomCodeTextKey(null);
    if (!isEditing || !activeScene) return;
    const element = activeScene.els.find((item) => item.id === elementId);
    if (!element?.customCode || element.customCode.textOverrides?.[textKey] === value) return;
    onUpdateElement(elementId, {
      customCode: {
        ...element.customCode,
        textOverrides: { ...(element.customCode.textOverrides || {}), [textKey]: value },
        version: element.customCode.version + 1,
        updatedAt: new Date().toISOString(),
      },
    }, '编辑代码组件文字');
  }, [activeScene, isEditing, onUpdateElement]);

  const handleUiTextChange = useCallback((elementId: string, textKey: string, value: string) => {
    if (!isEditing || !activeScene) return;
    const element = activeScene.els.find((item) => item.id === elementId);
    if (!element) return;
    const textOverrides = { ...(element.uiComponentData?.textOverrides || {}), [textKey]: value };
    onUpdateElement(elementId, { uiComponentData: { ...(element.uiComponentData || {}), textOverrides } }, '编辑UI组件文字');
  }, [activeScene, isEditing, onUpdateElement]);
  // Asset URLs Cache
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [videoLoadErrors, setVideoLoadErrors] = useState<Record<string, string>>({});
  const videoRetryRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!onThumbnailCaptureReady) return;
    onThumbnailCaptureReady(async () => {
      const stage = stageRef.current;
      if (!stage) return null;
      return captureStageThumbnail(stage, activeScene, (ref) => assetUrls[ref] || ref);
    });
    return () => onThumbnailCaptureReady(null);
  }, [activeScene, assetUrls, onThumbnailCaptureReady]);

  const popupAssetScene = activePopupSceneId ? projectData.scenes[activePopupSceneId] : undefined;
  const secondaryPopupSignature = React.useMemo(
    () => secondaryPopups.map((popup) => popup.target).join('|'),
    [secondaryPopups],
  );
  const assetRefSignature = React.useMemo(
    () => getSceneAssetRefSignature(activeScene, popupAssetScene),
    [activeScene, popupAssetScene],
  );
  const videoSyncSignature = React.useMemo(
    () => getSceneVideoSyncSignature(activeScene),
    [activeScene],
  );

  // 绱犳潗閿笉鏄祻瑙堝櫒鍙挱鏀惧湴鍧€銆傝祫婧愬紓姝ヨВ鏋愭湡闂翠笉瑕佹妸 res_* 鐩存帴浜ょ粰 video锛?  // 鍚﹀垯娴忚鍣ㄤ細鍙戣捣鐩稿璺緞璇锋眰骞舵案涔呭仠鍦ㄩ粦鑹?鎹熷潖鐘舵€併€?
  const resolveVideoUrl = useCallback((refId?: string) => {
    if (!refId) return '';
    if (assetUrls[refId]) return assetUrls[refId];
    const cachedUrl = dbManager.getCachedUrl(refId);
    if (cachedUrl) return cachedUrl;
    return resolveExportPlayerAssetUrl(refId) || (/^(data:|blob:|https?:\/\/)/i.test(refId) ? refId : '');
  }, [assetUrls]);

  // Asset references are usually IndexedDB keys, not browser URLs. Returning
  // an empty string while the cache is warming prevents the browser from
  // issuing a bogus request for the key itself (which briefly shows a broken
  // image or a white fallback box in the editor).
  const resolveImageUrl = useCallback((refId?: string) => {
    if (!refId) return '';
    if (assetUrls[refId]) return assetUrls[refId];
    const cachedUrl = dbManager.getCachedUrl(refId);
    if (cachedUrl) return cachedUrl;
    return resolveExportPlayerAssetUrl(refId) || (/^(data:|blob:|https?:\/\/)/i.test(refId) ? refId : '');
  }, [assetUrls]);

  // 元数据只记录素材比例并保持视频播放状态，不覆盖用户编辑过的外框和位置。
  const handleVideoMetadata = useCallback((elementId: string, video: HTMLVideoElement) => {
    if (!isEditing || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const element = activeScene?.els.find((item) => item.id === elementId);
    if (!element || element.type !== 'vid') return;

    delete videoRetryRef.current[`${elementId}:${element.refId}`];
    setVideoLoadErrors((current) => current[elementId] === element.refId
      ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== elementId))
      : current);

    if (isPlaying && video.dataset.videoMode !== 'click') {
      void video.play().catch(() => {});
    }

    const mediaAspect = video.videoWidth / video.videoHeight;
    if (Math.abs((element.mediaAspect || 0) - mediaAspect) >= 0.001) {
      onUpdateElement(elementId, { mediaAspect }, '读取视频素材比例', false);
    }
  }, [activeScene, isEditing, isPlaying, onUpdateElement]);

  const handleVideoError = useCallback((elementId: string, refId: string, video: HTMLVideoElement) => {
    const retryKey = `${elementId}:${refId}`;
    const retryCount = videoRetryRef.current[retryKey] || 0;
    if (retryCount < 2) {
      videoRetryRef.current[retryKey] = retryCount + 1;
      window.setTimeout(() => {
        if (!video.isConnected || video.dataset.videoRef !== refId) return;
        video.load();
        if (isPlaying && video.dataset.videoMode !== 'click') void video.play().catch(() => {});
      }, 250 * (retryCount + 1));
      return;
    }
    setVideoLoadErrors((current) => current[elementId] === refId ? current : ({ ...current, [elementId]: refId }));
  }, [isPlaying]);

  const handleVideoStalled = useCallback((elementId: string, refId: string, video: HTMLVideoElement) => {
    if (!isPlaying || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || video.ended) return;
    const retryKey = `${elementId}:${refId}`;
    const retryCount = videoRetryRef.current[retryKey] || 0;
    if (video.dataset.videoRetryPending === 'true') return;
    // waiting/stalled can be a normal buffering transition. Do not call
    // load(): reloading discards the decoder buffer and was the reason that
    // timeline videos stopped after playing for a short time.
    video.dataset.videoRetryPending = 'true';
    window.setTimeout(() => {
      delete video.dataset.videoRetryPending;
      if (!video.isConnected || video.dataset.videoRef !== refId) return;
      if (isPlaying && video.paused && !video.ended) void video.play().catch(() => {});
    }, Math.min(1200, 250 * Math.max(1, retryCount + 1)));
  }, [isPlaying]);

  // 图片加载完成后只记录素材比例，不根据原图尺寸重设图层外框。
  const handleImageMetadata = useCallback((elementId: string, image: HTMLImageElement) => {
    if (!isEditing || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    const element = activeScene?.els.find((item) => item.id === elementId);
    if (!element || element.type !== 'img') return;

    const mediaAspect = image.naturalWidth / image.naturalHeight;
    if (Math.abs((element.mediaAspect || 0) - mediaAspect) >= 0.001) {
      onUpdateElement(elementId, { mediaAspect }, '读取图片素材比例', false);
    }
  }, [activeScene, isEditing, onUpdateElement]);

  // Load asset URLs when scene changes
  // 銆愪慨澶嶃€戝悓鏃跺姞杞?popup 寮圭獥鍦烘櫙锛坅ctivePopupSceneId锛夌殑绱犳潗璧勪骇锛?
  // 鍚﹀垯寮圭獥鍦烘櫙鍐呯殑鍥剧墖/瑙嗛 refId 鏃犳硶瑙ｆ瀽锛屽鑷村脊绐楀唴瀹规樉绀轰负绌虹櫧 / broken 鍥炬爣銆?

  useEffect(() => {
    let isMounted = true;
    const loadAssets = async () => {
      // 銆愪慨澶嶃€戠瓑寰?IndexedDB 灏辩华鍚庡啀鍔犺浇绱犳潗锛氶伩鍏?init 鏈畬鎴愭椂 loadUrl 杩斿洖 refId 鏈韩锛屽鑷寸礌鏉愭樉绀轰负 broken 鍗犱綅
      await dbManager.ensureReady();
      const refs = new Set<string>();
      const collectElement = (element: SceneElement) => {
        if (element.refId) refs.add(element.refId);
        const uiAssetRef = element.uiComponentData?.assetRefId;
        if (uiAssetRef) refs.add(uiAssetRef);
        // 鍚堝苟鍥惧眰鐨勫瓙瑙嗛涓嶅湪鍦烘櫙椤跺眰 els 涓紝蹇呴』閫掑綊瑙ｆ瀽鍏剁礌鏉愰敭銆?
        for (const child of element.children || []) {
          collectElement(child);
        }
      };
      const collect = (scene?: Scene) => {
        if (!scene) return;
        if (scene.bgRef) refs.add(scene.bgRef);
        for (const el of scene.els || []) {
          collectElement(el);
        }
      };
      const sceneIds = Array.from(new Set([
        activeSceneId,
        activePopupSceneId,
        ...secondaryPopups.map((popup) => popup.target),
      ].filter((id): id is string => Boolean(id))));
      sceneIds.forEach((id) => collect(projectData.scenes[id]));
      const loaded = await loadRuntimeAssetUrlsWithConcurrency(Array.from(refs), 3);
      // 寮圭獥鍦烘櫙璧勪骇锛堣法鍦烘櫙鐑偣寮圭獥锛?

      if (isMounted) {
        // loadUrl 鍦ㄧ礌鏉愪笉瀛樺湪鏃朵細鍥為€€杩斿洖 refId锛涜繖涓€间笉鑳戒綔涓哄獟浣?src銆?
        const resolvedUrls = Object.fromEntries(
          loaded.filter(([ref, url]) =>
            Boolean(url) && (url !== ref || /^(data:|blob:|https?:\/\/)/i.test(ref))
          )
        );
        setAssetUrls((current) => ({ ...current, ...resolvedUrls }));
      }
    };
    loadAssets();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneId, activePopupSceneId, secondaryPopupSignature, assetRefSignature]);

  // Preserve the outgoing stage as a DOM clone until the incoming scene paints.
  // Canvas rasterization was too expensive for media-heavy projects, while a
  // detached clone is immediate and leaves the authored project untouched.
  useEffect(() => {
    if (!sceneTransitionRequest || sceneTransitionRequest.id === handledSceneTransitionRef.current) return;
    handledSceneTransitionRef.current = sceneTransitionRequest.id;
    let cancelled = false;
    const request = sceneTransitionRequest;

    const preloadTargetAssets = async () => {
      await dbManager.ensureReady();
      const refs = new Set<string>();
      collectSceneAssetRefs(projectData.scenes[request.targetSceneId], refs);
      const loaded = await loadRuntimeAssetUrlsWithConcurrency(Array.from(refs), 3);
      if (cancelled) return;
      const urls = Object.fromEntries(loaded.filter(([ref, url]) => (
        Boolean(url) && (url !== ref || /^(data:|blob:|https?:\/\/)/i.test(ref))
      )));
      if (Object.keys(urls).length > 0) setAssetUrls((previous) => ({ ...previous, ...urls }));
    };

    const preserveOutgoingFrame = async () => {
      const target = stageRef.current;
      try {
        if (!target) throw new Error('stage unavailable');
        const clone = target.cloneNode(true) as HTMLDivElement;
        clone.removeAttribute('data-export-stage');
        clone.style.position = 'absolute';
        clone.style.inset = '0';
        clone.style.width = '100%';
        clone.style.height = '100%';
        clone.style.margin = '0';
        clone.style.pointerEvents = 'none';
        clone.style.animation = 'none';
        clone.style.boxShadow = 'none';
        clone.style.contain = 'layout paint style';
        clone.style.willChange = 'transform, opacity, clip-path, filter';
        clone.style.backfaceVisibility = 'hidden';
        clone.style.transform = 'translateZ(0)';
        clone.querySelectorAll<HTMLElement>('[data-export-hide="true"], [data-capture-hide="true"], .aether-scene-transition-overlay, .aether-scene-transition-seam').forEach((node) => node.remove());
        const liveVideos = Array.from(target.querySelectorAll<HTMLVideoElement>('video'));
        const clonedVideos = Array.from(clone.querySelectorAll<HTMLVideoElement>('video'));
        clonedVideos.forEach((clonedVideo, index) => {
          const liveVideo = liveVideos[index];
          if (!liveVideo) return;
          if (liveVideo.videoWidth > 0 && liveVideo.videoHeight > 0) {
            try {
              const snapCanvas = document.createElement('canvas');
              snapCanvas.width = liveVideo.videoWidth;
              snapCanvas.height = liveVideo.videoHeight;
              snapCanvas.className = clonedVideo.className;
              snapCanvas.style.cssText = clonedVideo.style.cssText;
              const ctx = snapCanvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(liveVideo, 0, 0, snapCanvas.width, snapCanvas.height);
                clonedVideo.replaceWith(snapCanvas);
                return;
              }
            } catch {
              // fallback to video element
            }
          }
          clonedVideo.muted = true;
          if (Number.isFinite(liveVideo.currentTime) && liveVideo.currentTime > 0) {
            try { clonedVideo.currentTime = liveVideo.currentTime; } catch { /* media may not be seekable yet */ }
          }
          void clonedVideo.play().catch(() => undefined);
        });

        // 关键修复：HTML5 cloneNode(true) 规范不会复制 <canvas> 的像素缓冲！
        // 同步将源场景中所有的 WebGL/2D canvas (ThreeCanvas 3D, VFX粒子, Saber光线, 图表等)
        // 渲染帧绘制到克隆 canvas 上，彻底消除转场首帧 3D/特效 闪黑或空白导致的跳帧！
        const liveCanvases = Array.from(target.querySelectorAll<HTMLCanvasElement>('canvas'));
        const clonedCanvases = Array.from(clone.querySelectorAll<HTMLCanvasElement>('canvas'));
        clonedCanvases.forEach((clonedCanvas, index) => {
          const liveCanvas = liveCanvases[index];
          if (!liveCanvas || liveCanvas.width === 0 || liveCanvas.height === 0) return;
          try {
            clonedCanvas.width = liveCanvas.width;
            clonedCanvas.height = liveCanvas.height;
            const ctx = clonedCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(liveCanvas, 0, 0);
            }
          } catch {
            // ignore context / cross-origin errors
          }
        });

        clone.querySelectorAll<HTMLIFrameElement>('iframe').forEach((frame) => { frame.style.visibility = 'hidden'; });
        if (!cancelled) {
          setTransitionOverlay({
            requestId: request.id,
            sourceSceneId: activeSceneId,
            clone,
            exitAnimation: request.exitAnimation,
            duration: request.duration,
            easing: request.easing,
          });
          // Commit the destination immediately after the cheap DOM clone is
          // ready. The old frame is already above it; expensive media work
          // must never delay the scene switch.
          onSceneTransitionSnapshot?.(request.id);
        }
      } catch {
        // The live target scene remains a valid fallback for unsupported media,
        // cross-origin frames, or a browser that cannot snapshot the stage.
        if (!cancelled) onSceneTransitionSnapshot?.(request.id);
      }
      // Asset hydration continues after the new scene is committed. This keeps
      // navigation responsive when a scene contains large local media.
      void preloadTargetAssets();
    };

    void preserveOutgoingFrame();
    return () => { cancelled = true; };
  }, [activeSceneId, onSceneTransitionSnapshot, projectData.scenes, sceneTransitionRequest]);

  useLayoutEffect(() => {
    const host = transitionOverlayHostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (transitionOverlay) {
      host.style.contain = 'layout paint style';
      host.style.willChange = 'contents';
      host.appendChild(transitionOverlay.clone);
    } else {
      host.style.willChange = 'auto';
    }
  }, [transitionOverlay]);

  useEffect(() => {
    if (!transitionOverlay || transitionOverlay.sourceSceneId === activeSceneId) return;
    const timer = window.setTimeout(
      () => setTransitionOverlay((current) => current?.requestId === transitionOverlay.requestId ? null : current),
      Math.max(0, transitionOverlay.duration * 1000) + 80,
    );
    return () => window.clearTimeout(timer);
  }, [activeSceneId, transitionOverlay]);

  // autoplay 灞炴€у湪瑙嗛宸茬粡鍔犺浇鍚庝粠 false 鍒囨崲涓?true 鏃讹紝涓嶄繚璇佷細瑙﹀彂鎾斁銆?  // 鎾斁鎸夐挳鎺у埗鐨勬槸宸ヤ綔鍙扮姸鎬侊紝鍥犳杩欓噷鏄惧紡鍚屾鐢诲竷鍐呯殑瑙嗛濯掍綋鐘舵€併€?
  useEffect(() => {
    const videos = stageRef.current?.querySelectorAll<HTMLVideoElement>('video[data-aether-video]');
    if (!videos) return;

    videos.forEach((video) => {
      const startTime = Number(video.dataset.videoStartTime || 0);
      // Use the canvas playback clock rather than the editor shell's throttled
      // currentTime. This keeps videos mounted later in a heavy scene aligned
      // with the real playhead and prevents them remaining paused after mount.
      const timelineTime = Math.max(0, renderTime - (Number.isFinite(startTime) ? startTime : 0));
      const isPrewarming = video.dataset.videoPrewarm === 'true' && renderTime < startTime;
      if (isPrewarming) {
        video.pause();
        return;
      }
      const mediaDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const shouldLoop = video.dataset.videoLoop === 'true';
      const playbackCount = Math.max(1, Number(video.dataset.videoPlaybackCount || 1));
      const playbackFinished = !shouldLoop && mediaDuration > 0 && timelineTime >= mediaDuration * playbackCount;
      const targetTime = mediaDuration > 0 && (shouldLoop || playbackCount > 1)
        ? playbackFinished ? mediaDuration : timelineTime % mediaDuration
        : mediaDuration > 0 ? Math.min(timelineTime, mediaDuration) : timelineTime;
      const lastTimelineTime = Number(video.dataset.videoLastTimelineTime);
      const didTimelineWrap = Number.isFinite(lastTimelineTime) && timelineTime + 0.1 < lastTimelineTime;
      if (didTimelineWrap) {
        video.dataset.videoCompletedLoops = '0';
        video.dataset.videoSeeded = 'false';
      }
      video.dataset.videoLastTimelineTime = String(timelineTime);

      // In playback, native video timing is smoother than repeatedly forcing
      // currentTime. Seeking restarts decoder work and was causing visible
      // stutter on older projects. Only correct a true discontinuity; scrubbing
      // and pause still seek precisely for frame-accurate editing.
      // Let the native media clock carry continuous playback. A one-second
      // correction is still visible and can restart keyframe decoding on
      // long-GOP legacy MP4s, so only repair a real discontinuity while
      // playing. Pause/scrub remains frame-accurate.
      const seekThreshold = isPlaying ? 2.5 : 0.08;
      // Once native playback has started, never chase the React clock with
      // seeks. Even a small correction can discard decoded frames on long-GOP
      // MP4s. Only seed a newly mounted video once; pause/scrub remains exact.
      const needsInitialSeed = isPlaying
        && video.dataset.videoSeeded !== 'true'
        && video.currentTime < 0.05
        && targetTime > 0.05;
      const canSeek = !isPlaying || needsInitialSeed || (didTimelineWrap && (shouldLoop || playbackCount > 1));
      const shouldSeek = needsInitialSeed || didTimelineWrap || Math.abs(video.currentTime - targetTime) > seekThreshold;
      if (canSeek && !video.seeking && shouldSeek) {
        try {
          video.currentTime = targetTime;
          if (needsInitialSeed) video.dataset.videoSeeded = 'true';
        } catch {
          // 濯掍綋鍒氬垏鎹?source 鏃?currentTime 鍙兘鏆傛椂涓嶅彲鍐欙紝涓嬩竴娆＄姸鎬佹洿鏂颁細閲嶈瘯銆?
        }
      }
      if (!isPlaying || playbackFinished) {
        video.pause();
        return;
      }
      // A native finite video can remain in `ended` after the editor clock
      // loops back to the IN point. For looping layers, explicitly reseed the
      // decoded position before calling play(); otherwise the paused/ended
      // guard leaves the layer frozen on its last frame.
      if (isPlaying && video.ended && !playbackFinished && (shouldLoop || playbackCount > 1)) {
        try { video.currentTime = Math.max(0, targetTime); } catch { /* wait for metadata */ }
        void video.play().catch(() => {});
      } else if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.paused && !video.ended) {
        void video.play().catch(() => {});
      }
    });
  }, [activeSceneId, videoSyncSignature, assetUrls, renderTime, isPlaying]);

  // Popup scenes live outside the timeline stage, so they are not covered by
  // the scene video clock above. Keep their media ownership explicit: opening
  // a popup while the editor is paused must not start a hidden autoplay task,
  // and resuming playback should wake an already-mounted popup video.
  useEffect(() => {
    const videos = containerRef.current?.querySelectorAll<HTMLVideoElement>('video[data-aether-popup-video]');
    if (!videos) return;
    videos.forEach((video) => {
      if (!isPlaying) {
        video.pause();
        return;
      }
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.paused && !video.ended) {
        void video.play().catch(() => {});
      }
    });
  }, [activePopupSceneId, secondaryPopupSignature, assetUrls, isPlaying]);

  const handleLayerVideoEnded = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (!isPlaying || video.dataset.videoLoop === 'true') return;
    const playbackCount = Math.max(1, Number(video.dataset.videoPlaybackCount || 1));
    const completedLoops = Math.max(0, Number(video.dataset.videoCompletedLoops || 0)) + 1;
    video.dataset.videoCompletedLoops = String(completedLoops);
    if (completedLoops >= playbackCount) return;
    video.currentTime = 0;
    void video.play().catch(() => {});
  }, [isPlaying]);

  // Handle stage mouse move for 3D parallax
  const handleMouseMoveParallax = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = (e.clientX - rect.left - cx) / (cx || 1);
    const y = (e.clientY - rect.top - cy) / (cy || 1);
    setTargetParallax({
      x: Math.max(-1.5, Math.min(1.5, x)),
      y: Math.max(-1.5, Math.min(1.5, y)),
    });
  }, []);

  const handleMouseLeaveParallax = useCallback(() => {
    setTargetParallax({ x: 0, y: 0 });
  }, []);

  const handleViewportMouseEnter = useCallback(() => {
    isPointerOverViewportRef.current = true;
  }, []);

  const handleViewportMouseLeave = useCallback(() => {
    isPointerOverViewportRef.current = false;
    handleMouseLeaveParallax();
  }, [handleMouseLeaveParallax]);

  // Fit canvas calculation
  const fitCanvas = useCallback(() => {
    if (!containerRef.current) return;
    const c = containerRef.current;
    // 鍏ㄥ睆绾噣棰勮鏃讹細闆惰竟璺濄€佹棤鏈€澶х缉鏀鹃檺鍒讹紝璁╃敾甯冭垶鍙伴摵婊℃暣涓睆骞?

    const padding = isFullscreenPreview ? 0 : 40;
    const maxScale = isFullscreenPreview ? 10 : 1.2;
    const availableW = c.clientWidth - padding;
    const availableH = c.clientHeight - padding;
    const scale = Math.min(availableW / CANVAS_W, availableH / CANVAS_H, maxScale);
    // 缂╂斁涓嬮檺鏀惧鍒?0.05锛氫繚璇佺獥鍙?棰勮鍖鸿緝绐勬椂鑸炲彴涔熻兘瀹屾暣鏄剧ず锛堜笉琚?overflow 瑁佸壀锛夛紝
    // 瀹夊叏妗嗚鍙ｅ眰璐村悎瀹屾暣鑸炲彴锛屽乏鍙宠竟妗嗙嚎濮嬬粓鍙銆?
    onUpdateViewport((v) => ({ ...v, zoom: Math.max(0.05, scale), panX: 0, panY: 0 }));
  }, [onUpdateViewport, isFullscreenPreview, CANVAS_W, CANVAS_H]);

  // Auto fit on mount and on window resize / fullscreen / editing-mode change
  // 銆愪慨澶嶃€戜緷璧栧姞鍏?isEditing锛氬垏鎹㈢紪杈?婕旂ず妯″紡鏃讹紝宸﹀彸闈㈡澘鐨勬樉绀?闅愯棌浼氭敼鍙?
  // 鐢诲竷瀹瑰櫒灏哄锛岃垶鍙板繀椤婚噸鏂伴€傞厤锛屽惁鍒欐紨绀烘ā寮忎細娌跨敤缂栬緫妯″紡鐨勬棫缂╂斁鍩哄噯锛?
  // 瀵艰嚧寮圭獥/铏氱嚎妗嗕綅缃ぇ灏忓け鐪熴€?

  useEffect(() => {
    fitCanvas();

    const container = containerRef.current;
    let rafId: number | null = null;
    const scheduleFit = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fitCanvas();
      });
    };

    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        scheduleFit();
      });
      resizeObserver.observe(container);
    }

    const handleResize = () => scheduleFit();
    window.addEventListener('resize', handleResize);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [fitCanvas, isFullscreenPreview, isEditing, panelsCollapsed]);

  // 銆愭柊澧炪€慍trl + 婊氳疆缂╂斁棰勮绐楀彛锛堜互榧犳爣浣嶇疆涓洪敋鐐癸紝鍓槧寮忕敾甯冪缉鏀撅級
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // 浠?Ctrl/Cmd + 婊氳疆瑙﹀彂
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      onUpdateViewport((prev) => {
        const nextZoom = Math.max(0.05, Math.min(5, prev.zoom * factor));
        if (nextZoom === prev.zoom) return prev;
        // 浠ラ紶鏍囦负閿氱偣锛氫繚鎸侀紶鏍囨寚鍚戠殑鍐呭鍧愭爣涓嶅姩
        const cw = rect.width;
        const ch = rect.height;
        const innerX = (mx - cw / 2 - prev.panX) / prev.zoom;
        const innerY = (my - ch / 2 - prev.panY) / prev.zoom;
        return {
          ...prev,
          zoom: nextZoom,
          panX: mx - cw / 2 - innerX * nextZoom,
          panY: my - ch / 2 - innerY * nextZoom,
        };
      });
    };

    // React 鐨?onWheel 涓?passive锛屾棤娉?preventDefault 闃绘娴忚鍣ㄦ暣椤电缉鏀撅紝闇€鐢ㄥ師鐢熺洃鍚?
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [onUpdateViewport]);

  // Pen Tool Finish / Commit Action
  const handleFinishPenPath = useCallback((forceClose: boolean = false) => {
    const nodes = penNodesRef.current;
    if (nodes.length < 2) {
      setPenNodes([]);
      penNodesRef.current = [];
      setCursorPos(null);
      setIsNearStartPoint(false);
      onUpdateViewport((v) => ({ ...v, activeTool: 'select' }));
      return;
    }

    const isCustomShape = viewport.activeTool === 'shape-draw';
    const isClosedPolygon = isCustomShape || isInteractionAreaTool;
    if (isClosedPolygon && nodes.length < 3) return;
    const isClosed = isClosedPolygon || forceClose || (nodes.length >= 3 && isNearStartPoint);
    const { path, bbox, normalizedNodes } = normalizePenNodes(nodes, isClosed);

    if (isMaskPenTool && selectedElement) {
      const elementW = Math.max(0.1, selectedElement.w);
      const elementH = Math.max(0.1, selectedElement.h);
      const localNodes = nodes.map((node) => ({
        ...node,
        x: Math.max(0, Math.min(100, ((node.x - selectedElement.x) / elementW) * 100)),
        y: Math.max(0, Math.min(100, ((node.y - selectedElement.y) / elementH) * 100)),
        handleIn: node.handleIn ? {
          x: Math.max(0, Math.min(100, ((node.handleIn.x - selectedElement.x) / elementW) * 100)),
          y: Math.max(0, Math.min(100, ((node.handleIn.y - selectedElement.y) / elementH) * 100)),
        } : undefined,
        handleOut: node.handleOut ? {
          x: Math.max(0, Math.min(100, ((node.handleOut.x - selectedElement.x) / elementW) * 100)),
          y: Math.max(0, Math.min(100, ((node.handleOut.y - selectedElement.y) / elementH) * 100)),
        } : undefined,
      }));
      const xs = localNodes.map((node) => node.x);
      const ys = localNodes.map((node) => node.y);
      const maskX = Math.min(...xs);
      const maskY = Math.min(...ys);
      const maskWidth = Math.max(1, Math.max(...xs) - maskX);
      const maskHeight = Math.max(1, Math.max(...ys) - maskY);
      onUpdateElement(selectedElement.id, {
        maskEnabled: true,
        maskType: 'pen',
        maskX: Number(maskX.toFixed(2)),
        maskY: Number(maskY.toFixed(2)),
        maskWidth: Number(maskWidth.toFixed(2)),
        maskHeight: Number(maskHeight.toFixed(2)),
        maskNodes: localNodes,
        maskSourceElementId: selectedElement.id,
      }, '创建钢笔蒙版');
    } else if (isInteractionAreaTool && onAddDrawnInteractionArea) {
      onAddDrawnInteractionArea(
        path,
        { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h },
        normalizedNodes,
      );
    } else if (viewport.activeTool === 'shape-draw' && onAddDrawnShapeElement) {
      onAddDrawnShapeElement(
        path,
        { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h },
        normalizedNodes,
      );
    } else if (onAddDrawnSaberElement) {
      onAddDrawnSaberElement(
        path,
        { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h },
        normalizedNodes,
        isClosed ? '钢笔闭合光线' : '钢笔矢量光线'
      );
    }

    setPenNodes([]);
    penNodesRef.current = [];
    setCursorPos(null);
    setIsNearStartPoint(false);
    onUpdateViewport((v) => ({ ...v, activeTool: 'select' }));
  }, [isInteractionAreaTool, isMaskPenTool, isNearStartPoint, onAddDrawnInteractionArea, onAddDrawnSaberElement, onAddDrawnShapeElement, onUpdateElement, onUpdateViewport, selectedElement, viewport.activeTool]);

  const handleCancelPenDrawing = useCallback(() => {
    setPenNodes([]);
    penNodesRef.current = [];
    setCursorPos(null);
    setIsNearStartPoint(false);
    isDraggingPenHandleRef.current = false;
    setIsDraggingPenHandle(false);
    setCtxMenu(null);
    onUpdateViewport((v) => ({ ...v, activeTool: 'select' }));
  }, [onUpdateViewport]);

  const handleUndoPenNode = useCallback(() => {
    setPenNodes((prev) => {
      const next = prev.slice(0, -1);
      penNodesRef.current = next;
      return next;
    });
  }, []);

  // Keyboard Shortcuts for Pen Tool & Viewport Navigation
  useEffect(() => {
    const clearSpacePan = () => {
      spacePressedRef.current = false;
      spaceShortcutArmedRef.current = false;
      spacePanUsedRef.current = false;
      setIsSpacePressed(false);
      if (panGestureRef.current === 'space') {
        panGestureRef.current = null;
        panSessionRef.current = null;
        setIsPanning(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // A Space tap toggles playback. Space + pointer drag remains a temporary
      // hand tool, preserving both timeline and canvas workflows.
      if (e.code === 'Space' && isEditing && !isEditableKeyboardTarget(e.target)) {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (spacePressedRef.current) return;
        spacePressedRef.current = true;
        spaceShortcutArmedRef.current = true;
        spacePanUsedRef.current = false;
        setIsSpacePressed(true);
        return;
      }

      // Keep browser/editor modifier shortcuts available. In particular,
      // Ctrl/Cmd+V must reach the workspace paste handler instead of being
      // consumed by the V (select tool) shortcut.
      if (isEditing && !isEditableKeyboardTarget(e.target)
        && !e.ctrlKey && !e.metaKey && !e.altKey
        && ['KeyH', 'KeyV', 'KeyP'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        const activeTool = e.code === 'KeyH' ? 'pan' : e.code === 'KeyP' ? 'saber-draw' : 'select';
        onUpdateViewport((v) => ({ ...v, activeTool }));
        return;
      }

      if (isDrawingTool) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancelPenDrawing();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleFinishPenPath(false);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          handleUndoPenNode();
        }
        return;
      }

      // Arrow Keys Nudge: PPT/Figma-style layer positioning micro-adjustments
      if (isEditing && !isEditableKeyboardTarget(e.target)
        && !document.querySelector('[role="dialog"]')
        && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selected = selectedElementRef.current;
        const current = selected ? (activeSceneRef.current?.els.find((item) => item.id === selected.id) || selected) : null;
        if (current && !current.locked) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const step = e.shiftKey ? 1.0 : 0.1; // Shift: 1.0% (~19px on 1080p), normal: 0.1% (~2px)
          // Alt + 方向键 = 精确改尺寸（与位置微调分开，方便做像素级对齐）。
          if (e.altKey) {
            let dw = 0;
            let dh = 0;
            if (e.key === 'ArrowUp') dh = -step;
            else if (e.key === 'ArrowDown') dh = step;
            else if (e.key === 'ArrowLeft') dw = -step;
            else if (e.key === 'ArrowRight') dw = step;
            const nextW = Math.max(1, Math.round(((Number(current.w) || 0) + dw) * 100) / 100);
            const nextH = Math.max(1, Math.round(((Number(current.h) || 0) + dh) * 100) / 100);
            onUpdateElementRef.current(current.id, { w: nextW, h: nextH }, '微调元素尺寸');
            return;
          }
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          else if (e.key === 'ArrowDown') dy = step;
          else if (e.key === 'ArrowLeft') dx = -step;
          else if (e.key === 'ArrowRight') dx = step;

          const nextX = Math.round((current.x + dx) * 100) / 100;
          const nextY = Math.round((current.y + dy) * 100) / 100;
          onUpdateElementRef.current(current.id, { x: nextX, y: nextY }, '微调元素位置');
          return;
        }
      }

    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !spacePressedRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const shouldTogglePlayback = spaceShortcutArmedRef.current
        && !spacePanUsedRef.current
        && !document.querySelector('[role="dialog"]');
      clearSpacePan();
      if (shouldTogglePlayback) onTogglePlay();
    };
    const handleWindowBlur = () => clearSpacePan();

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      clearSpacePan();
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    isEditing, 
    viewport.activeTool, 
    handleCancelPenDrawing, 
    handleFinishPenPath,
    handleUndoPenNode,
    onTogglePlay,
    onUpdateViewport,
  ]);

  const isParentGroupHidden = (el: SceneElement) => {
    if (!el.groupId || !activeScene?.groups) return false;
    const grp = activeScene.groups.find((g) => g.id === el.groupId);
    return grp ? grp.visible === false : false;
  };

  const isParentGroupLocked = (el: SceneElement) => {
    if (!el.groupId || !activeScene?.groups) return false;
    const grp = activeScene.groups.find((g) => g.id === el.groupId);
    return grp ? !!grp.locked : false;
  };

  // 閽㈢瑪宸ュ叿浣跨敤鐙崰缁樺埗妯″紡锛氱敾甯冧笂鐨勭偣鍑绘案杩滃彧浼氳惤涓嬮挗绗旈敋鐐癸紝
  // 涓嶅厑璁稿懡涓厓绱犲悗瑙﹀彂閫夋嫨/鎷栧姩閫昏緫銆?
  const addPenAnchorFromMouse = useCallback((e: React.MouseEvent) => {
    if (!isDrawingTool || !isEditing || !stageRef.current) return false;
    if (e.button !== 0) return true;

    e.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const relX = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const relY = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    if (penNodesRef.current.length >= 3 && isNearStartPoint) {
      handleFinishPenPath(true);
      return true;
    }

    const nextNodes = [...penNodesRef.current, { x: relX, y: relY } as BezierNode];
    penNodesRef.current = nextNodes;
    setPenNodes(nextNodes);
    // Interaction regions are intentionally polygonal: a click adds one corner
    // and never starts Bezier-handle editing.
    isDraggingPenHandleRef.current = !isInteractionAreaTool;
    setIsDraggingPenHandle(!isInteractionAreaTool);
    return true;
  }, [isDrawingTool, isEditing, isInteractionAreaTool, isNearStartPoint, handleFinishPenPath]);

  // Match CapCut-style keyframe editing: once a property has an animation
  // track, direct canvas transforms edit the keyframe at the current time.
  const applyAnimatedTransformPatch = (element: SceneElement, patch: Partial<SceneElement>): Partial<SceneElement> => {
    const animatedProperties = ['x', 'y', 'w', 'h', 'rot'] as const;
    let animation = element.keyframes;
    let changed = false;
    for (const property of animatedProperties) {
      const nextValue = patch[property];
      if (typeof nextValue !== 'number' || !getPropertyTrack(element, property)) continue;
      animation = upsertKeyframe({ ...element, keyframes: animation }, property, currentTimeRef.current, nextValue);
      changed = true;
    }
    return changed ? { ...patch, keyframes: animation } : patch;
  };

  const applyAlignmentCommand = useCallback((command: string) => {
    if (!activeScene) return;
    const ids = multiSelectedIds.length > 0
      ? multiSelectedIds
      : (selectedElementId ? [selectedElementId] : []);
    const selected = ids
      .map((id) => activeScene.els.find((element) => element.id === id))
      .filter((element): element is SceneElement => Boolean(element) && element.visible !== false);
    const movable = selected.filter((element) => !element.locked);
    if (movable.length === 0) {
      onToast?.('请先选择可移动的图层');
      return;
    }

    const alignModes: Record<string, AlignMode> = {
      'align-left': 'left',
      'align-center': 'center-h',
      'align-right': 'right',
      'align-top': 'top',
      'align-middle': 'middle-v',
      'align-bottom': 'bottom',
    };
    const isAlign = command.startsWith('align-');
    const isDistribute = command.startsWith('distribute-');
    if (!isAlign && !isDistribute) return;
    if (isDistribute && movable.length < 3) {
      onToast?.('等距分布至少需要 3 个未锁定图层');
      return;
    }

    const changes = isAlign
      ? alignElements(movable, alignModes[command] || 'left', 100, 100)
      : distributeElements(movable, command === 'distribute-horizontal' ? 'horizontal' : 'vertical');
    if (changes.length === 0) {
      onToast?.(isAlign ? '已经对齐，无需调整' : '已经等距，无需调整');
      return;
    }

    changes.forEach((change) => {
      const element = activeScene.els.find((item) => item.id === change.id);
      if (!element) return;
      onUpdateElement(
        change.id,
        applyAnimatedTransformPatch(element, { x: change.x, y: change.y }),
        isAlign ? '对齐图层' : '等距分布图层',
        false,
      );
    });
    // 批量更新会在同一事件里排队；等 React 提交完再记一条历史，避免快照落后。
    window.requestAnimationFrame(() => {
      onCommitHistory?.(isAlign ? '对齐图层' : '等距分布图层', 'element_transform', `${changes.length} 个图层`);
    });
    onToast?.(isAlign ? `已对齐 ${changes.length} 个图层` : `已等距分布 ${changes.length} 个图层`);
  }, [activeScene, multiSelectedIds, selectedElementId, onUpdateElement, onCommitHistory, onToast]);

  // 快捷键统一走命令表：用户在“快捷键设置”里改键后立即生效。
  useEffect(() => {
    if (!isEditing || isInteractionPreview) return;
    const handleAlignmentKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target) || document.querySelector('[role="dialog"]')) return;
      const eventKey = keyboardEventToShortcut(event);
      const command = shortcutCommandMap.get(eventKey);
      if (!command || (!command.startsWith('align-') && !command.startsWith('distribute-'))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyAlignmentCommand(command);
    };
    window.addEventListener('keydown', handleAlignmentKey, true);
    return () => window.removeEventListener('keydown', handleAlignmentKey, true);
  }, [applyAlignmentCommand, isEditing, isInteractionPreview, shortcutCommandMap]);

  const applyAnimatedMaskPatch = (element: SceneElement, patch: Partial<SceneElement>): Partial<SceneElement> => {
    const animatedProperties = ['maskX', 'maskY', 'maskWidth', 'maskHeight', 'maskRadius', 'maskFeather'] as const;
    let animation = element.keyframes;
    let changed = false;
    for (const property of animatedProperties) {
      const nextValue = patch[property];
      if (typeof nextValue !== 'number' || !getPropertyTrack(element, property)) continue;
      animation = upsertKeyframe({ ...element, keyframes: animation }, property, currentTimeRef.current, nextValue);
      changed = true;
    }
    return changed ? { ...patch, keyframes: animation } : patch;
  };

  // Element interaction in Edit Mode
  const handleElementMouseDown = (e: React.MouseEvent, el: SceneElement) => {
    if (spacePressedRef.current && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      beginViewportPan(e, 'space');
      return;
    }

    // Element handlers stop propagation, so the persistent hand tool must start
    // its gesture here instead of relying on the viewport's bubble handler.
    if (viewport.activeTool === 'pan' && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      beginViewportPan(e, 'pointer');
      return;
    }

    // 閽㈢瑪妯″紡涓嬪厓绱犲彧鏄敾甯冭儗鏅殑涓€閮ㄥ垎锛岀姝㈤€夋嫨銆佹嫋鍔ㄦ垨鍒囨崲宸ュ叿銆?    // 浜嬩欢鍦ㄦ澶勮鎴柇鍚庣敱鏈鐞嗗櫒鐩存帴杞氦缁欓挗绗旇惤鐐归€昏緫銆?
    if (isDrawingTool && !isInteractionPreview) {
      e.preventDefault();
      e.stopPropagation();
      addPenAnchorFromMouse(e);
      return;
    }
    if (isInteractionPreview || el.locked || isParentGroupLocked(el)) return;
    if ((el.type === 'ui-component' || el.type === 'custom-code')
      && e.target instanceof Element
      && e.target.closest('button,input,select,textarea,[role="button"],[data-aether-ui-control="true"]')) {
      e.preventDefault();
      e.stopPropagation();
      paintImmediateSelectionChrome(el.id);
      onSelectElement(el.id);
      return;
    }
    if (e.button !== 0) {
      e.preventDefault();
      e.stopPropagation();
      paintImmediateSelectionChrome(el.id);
      onSelectElement(el.id);
      return;
    }
    e.stopPropagation();
    clearGesturePreview(el.id);
    paintImmediateSelectionChrome(el.id);
    onSelectElement(el.id);

    // 鍏ㄦ櫙鍥?鍏ㄦ櫙瑙嗛/3D妯″瀷/楂樻柉娉兼簠鍏冪礌锛氶紶鏍囨嫋鍔ㄧ敱 ThreeCanvas 鍐呴儴鎺у埗锛堟棆杞瑙?缂╂斁FOV/娣诲姞鐑偣锛夛紝
    // 涓嶇Щ鍔ㄥ厓绱犲湪鐢诲竷涓婄殑浣嶇疆锛堝弬鑰?720yun 鍏ㄦ櫙缂栬緫鍣ㄤ氦浜掗€昏緫锛?

    const is3DElement = el.type === 'panorama-img' || el.type === 'panorama-vid' || el.type === 'model-3d' || el.type === 'gaussian-splat';
    if (is3DElement) return;

    const animated = evaluateElementProperties(el, currentTime);
    gestureElementRef.current = el;
    gestureElementIdRef.current = el.id;
    gestureHostRef.current = stageRef.current?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(el.id)}"]`) || null;
    setGestureVisualState(el.id, true);
    gestureStageRectRef.current = getStageRect();
    snapTargetsRef.current = activeScene?.els.filter((item) => item.id !== el.id) || [];
    transformGestureRef.current = {
      kind: 'move',
      pointerId: 'pointerId' in e ? Number((e as React.PointerEvent).pointerId) : undefined,
    };
    setIsDraggingEl(true);
    armTransformReleaseGuard('移动图层', el.content || el.sourceName || el.id);
    const nextDragStart = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elX: animated.x,
      elY: animated.y,
      elW: animated.w,
      elH: animated.h,
      elRot: animated.rot || 0,
      elFontSize: el.fontSize || (el.type === 'txt' ? 32 : 24),
      authoredX: el.x,
      authoredY: el.y,
      authoredW: el.w,
      authoredH: el.h,
      resizeVisual: false,
      resizeAspect: 0,
    };
    dragStartRef.current = nextDragStart;
    setDragStart(nextDragStart);
  };

  // Resize Handle Mouse Down
  const handleResizeMouseDown = (e: React.MouseEvent | React.PointerEvent, handle: string) => {
    if (isInteractionPreview || !selectedElement || selectedElement.locked) return;
    e.preventDefault();
    e.stopPropagation();
    if ('pointerId' in e && typeof e.currentTarget.setPointerCapture === 'function') {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer may already have left the handle */ }
    }
    gestureElementRef.current = selectedElement;
    gestureElementIdRef.current = selectedElement.id;
    gestureHostRef.current = stageRef.current?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(selectedElement.id)}"]`) || null;
    setGestureVisualState(selectedElement.id, true);
    gestureStageRectRef.current = getStageRect();
    snapTargetsRef.current = activeScene?.els.filter((item) => item.id !== selectedElement.id) || [];
    transformGestureRef.current = {
      kind: 'resize',
      handle,
      pointerId: 'pointerId' in e ? Number((e as React.PointerEvent).pointerId) : undefined,
    };
    setResizeHandle(handle);
    armTransformReleaseGuard('调整图层大小', selectedElement.content || selectedElement.sourceName || selectedElement.id);
    const animated = evaluateElementProperties(selectedElement, currentTime);
    if (selectedElement.type === 'custom-code') {
      // A user gesture always wins over a pending first-mount measurement.
      // Mark this plugin version consumed before the first pointer move so a
      // late ResizeObserver callback cannot overwrite manual dimensions.
      const fitKey = `${selectedElement.id}:${selectedElement.customCode?.version ?? 0}:${selectedElement.customCode?.updatedAt ?? ''}`;
      customCodeFittedKeysRef.current.add(fitKey);
    }
    let startX = animated.x;
    let startY = animated.y;
    let startW = animated.w;
    let startH = animated.h;
    const nextDragStart = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elX: startX,
      elY: startY,
      elW: startW,
      elH: startH,
      elRot: animated.rot || 0,
      elFontSize: selectedElement.fontSize || (selectedElement.type === 'txt' ? 32 : 24),
      authoredX: selectedElement.x,
      authoredY: selectedElement.y,
      authoredW: selectedElement.w,
      authoredH: selectedElement.h,
      resizeVisual: false,
      resizeAspect: 0,
    };
    dragStartRef.current = nextDragStart;
    setDragStart(nextDragStart);
  };
  // Rotation Handle Mouse Down
  const handleRotateMouseDown = (e: React.MouseEvent | React.PointerEvent) => {
    if (isInteractionPreview || !selectedElement || selectedElement.locked) return;
    e.preventDefault();
    e.stopPropagation();
    if ('pointerId' in e && typeof e.currentTarget.setPointerCapture === 'function') {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer may already have left the handle */ }
    }
    gestureElementRef.current = selectedElement;
    gestureElementIdRef.current = selectedElement.id;
    gestureHostRef.current = stageRef.current?.querySelector<HTMLElement>(`[data-canvas-element-id="${CSS.escape(selectedElement.id)}"]`) || null;
    setGestureVisualState(selectedElement.id, true);
    gestureStageRectRef.current = getStageRect();
    snapTargetsRef.current = activeScene?.els.filter((item) => item.id !== selectedElement.id) || [];
    transformGestureRef.current = {
      kind: 'rotate',
      pointerId: 'pointerId' in e ? Number((e as React.PointerEvent).pointerId) : undefined,
    };
    setIsRotating(true);
    const animated = evaluateElementProperties(selectedElement, currentTime);
    armTransformReleaseGuard('旋转图层', selectedElement.content || selectedElement.sourceName || selectedElement.id);
    const nextDragStart = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elX: animated.x,
      elY: animated.y,
      elW: animated.w,
      elH: animated.h,
      elRot: animated.rot || 0,
      elFontSize: selectedElement.fontSize || (selectedElement.type === 'txt' ? 32 : 24),
      authoredX: selectedElement.x,
      authoredY: selectedElement.y,
      authoredW: selectedElement.w,
      authoredH: selectedElement.h,
      resizeVisual: false,
      resizeAspect: 0,
    };
    dragStartRef.current = nextDragStart;
    setDragStart(nextDragStart);
  };

  // Canvas Viewport Pan & Saber Pen Mouse Down
  const handleViewportPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || isInteractionPreview || e.button !== 0 || isDrawingTool || spacePressedRef.current) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-resize-handle], [data-rotate-handle], [data-mask-control], [data-selection-element-id], [data-aether-editor-hit-area], [data-aether-multi-toolbar], [data-canvas-element-id]')) return;
    const stage = stageRef.current;
    const scene = activeSceneRef.current;
    if (!stage || !scene || transformGestureRef.current.kind) return;
    const layers = Array.from(stage.querySelectorAll<HTMLElement>('[data-canvas-element-id]'))
      .map((node, order) => {
        const id = node.dataset.canvasElementId;
        const element = id ? scene.els.find((item) => item.id === id) : undefined;
        if (!element || element.visible === false || element.locked || isParentGroupLocked(element)) return null;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0) return null;
        const rect = node.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return null;
        return { element, order, zIndex: Number(style.zIndex) || element.zIndex || 0 };
      })
      .filter((item): item is { element: SceneElement; order: number; zIndex: number } => Boolean(item))
      .sort((a, b) => b.zIndex - a.zIndex || b.order - a.order);
    const hit = layers[0]?.element;
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    handleElementMouseDown(e as unknown as React.MouseEvent, hit);
  };

  const handleViewportMouseDownCapture = (e: React.MouseEvent) => {
    // Capture phase keeps the temporary hand tool ahead of nested interactive
    // components that stop bubbling mouse events of their own.
    if (spacePressedRef.current && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      beginViewportPan(e, 'space');
    }
  };

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    if (spacePressedRef.current && e.button === 0) {
      e.preventDefault();
      beginViewportPan(e, 'space');
      return;
    }

    if (isDrawingTool && !isInteractionPreview && stageRef.current) {
      if (isMaskPenTool && !selectedElement) return;
      e.preventDefault();
      // 鍙抽敭鐢辩敾甯?contextmenu 澶勭悊涓哄畬鎴愬紑鏀捐矾寰勶紱杩欓噷浠呮嫤鎴紝閬垮厤璇惤鐐广€?
      if (e.button === 2) {
        if (penNodesRef.current.length >= 2) handleFinishPenPath(false);
        else handleCancelPenDrawing();
        return;
      }
      if (e.button !== 0) return;
      const rect = stageRef.current.getBoundingClientRect();
      const relX = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
      const relY = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

      // If user clicked near the starting point to close the path
      if (penNodesRef.current.length >= 3 && isNearStartPoint) {
        handleFinishPenPath(true);
        return;
      }

      // Add a new Bezier anchor node
      const newNode: BezierNode = { x: relX, y: relY };
      const nextNodes = [...penNodesRef.current, newNode];
      penNodesRef.current = nextNodes;
      setPenNodes(nextNodes);

      // Start handle drag
      isDraggingPenHandleRef.current = true;
      setIsDraggingPenHandle(true);
      return;
    }

    if (e.button === 1 || viewport.activeTool === 'pan') {
      e.preventDefault();
      beginViewportPan(e, 'pointer');
    } else {
      // A timeline selection remains the active edit target until the timeline
      // selection is cleared. Clicking empty canvas must not silently switch it.
      if (timelineEditTarget) return;
      if (!isInteractionPreview) {
        onSelectElement(null);
      }
    }
  };

  // 鈥斺€?瑙︽懜鏀寔锛氭妸瑙︽懜浜嬩欢鏄犲皠鍒扮幇鏈夐紶鏍囦氦浜掔姸鎬佹満 鈥斺€?
  // 浠呯紪杈戞ā寮忓鐞嗭紙鎷栧姩/缂╂斁/鏃嬭浆/骞崇Щ/鍏夊墤缁樺埗锛夛紱棰勮妯″紡璁╀綅缁欏師鐢?click锛堣Е灞忕偣鎸?= 鐐瑰嚮璺宠浆锛?

  const touchToMouse = (e: React.TouchEvent): React.MouseEvent | null => {
    const t = e.touches[0];
    if (!t) return null;
    e.preventDefault();
    e.stopPropagation();
    return {
      clientX: t.clientX,
      clientY: t.clientY,
      button: 0,
      stopPropagation: () => {},
      preventDefault: () => {},
      nativeEvent: { stopPropagation: () => {}, preventDefault: () => {} },
    } as unknown as React.MouseEvent;
  };

  const onElementTouchStart = (e: React.TouchEvent, el: SceneElement) => {
    if (!isEditing || isInteractionPreview) return;
    const m = touchToMouse(e);
    if (m) handleElementMouseDown(m, el);
  };

  const onResizeHandleTouchStart = (e: React.TouchEvent, h: string) => {
    if (!isEditing || isInteractionPreview) return;
    const m = touchToMouse(e);
    if (m) handleResizeMouseDown(m, h);
  };

  const onRotateHandleTouchStart = (e: React.TouchEvent) => {
    if (!isEditing || isInteractionPreview) return;
    const m = touchToMouse(e);
    if (m) handleRotateMouseDown(m);
  };

  const onViewportTouchStart = (e: React.TouchEvent) => {
    if (!isEditing || isInteractionPreview) return;
    // 鍏夊墤缁樺埗宸ュ叿锛氳Е鎽哥偣娣诲姞璐濆灏旈敋鐐?

      if (isDrawingTool) {
      const m = touchToMouse(e);
      if (m) handleViewportMouseDown(m);
      return;
    }
    // 瑙︽懜绌虹櫧鍖哄煙 鈫?骞崇Щ鐢诲竷锛堣Е鎽哥敤鎴烽鏈燂細鍗曟寚鎷栫┖鐧?= 骞崇Щ锛岀瓑浠烽紶鏍囦腑閿級
    const m = touchToMouse(e);
    if (m) handleViewportMouseDown({ ...m, button: 1 } as unknown as React.MouseEvent);
  };

  // Global mouse move & mouse up for element transform, pan, and Saber pen drawing
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!stageRef.current) return;
      const gesture = transformGestureRef.current;
      if (gesture.pointerId != null && 'pointerId' in e && (e as PointerEvent).pointerId !== gesture.pointerId) return;
      const activeDrag = gesture.kind === 'move';
      const activeResizeHandle = gesture.kind === 'resize' ? gesture.handle || null : null;
      const activeRotate = gesture.kind === 'rotate';
      const eventType = e.type === 'pointermove' ? 'pointer' : 'mouse';
      const previousPointerEvent = lastTransformPointerEventRef.current;
      const now = performance.now();
      // Ignore the synthetic compatibility mousemove Chromium dispatches
      // immediately after pointermove. Touch events are converted to a plain
      // mouse-shaped event and therefore remain supported by this path.
      if (previousPointerEvent
        && previousPointerEvent.type !== eventType
        && now - previousPointerEvent.time < 80
        && previousPointerEvent.x === e.clientX
        && previousPointerEvent.y === e.clientY) return;
      lastTransformPointerEventRef.current = { type: eventType, time: now, x: e.clientX, y: e.clientY };
      // Keep the gesture listener stable while keyframe writes update React
      // state. Mutable refs provide the latest editor values per event.
      const activeScene = activeSceneRef.current;
      const gestureElementId = gestureElementIdRef.current;
      const selectedElement = (gestureElementId
        ? activeScene?.els.find((element) => element.id === gestureElementId)
        : undefined) || gestureElementRef.current || selectedElementRef.current;
      const currentTime = currentTimeRef.current;
      const dragStart = dragStartRef.current;
      const viewport = viewportRef.current;

      // Handle Bezier Pen Handle Drag or Cursor Tracking
      if (isDrawingTool) {
        const rect = stageRef.current.getBoundingClientRect();
        const relX = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
        const relY = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

        setCursorPos({ x: relX, y: relY });

        // If dragging handle of the active node
        if (!isInteractionAreaTool && isDraggingPenHandleRef.current && penNodesRef.current.length > 0) {
          const lastIdx = penNodesRef.current.length - 1;
          const node = penNodesRef.current[lastIdx];
          const dx = relX - node.x;
          const dy = relY - node.y;

          if (Math.hypot(dx, dy) > 0.4) {
            const updatedNode: BezierNode = {
              ...node,
              handleOut: { x: Number(relX.toFixed(2)), y: Number(relY.toFixed(2)) },
              handleIn: { x: Number((node.x - dx).toFixed(2)), y: Number((node.y - dy).toFixed(2)) },
            };
            const nextNodes = [...penNodesRef.current];
            nextNodes[lastIdx] = updatedNode;
            penNodesRef.current = nextNodes;
            setPenNodes(nextNodes);
          }
          return;
        }

        // Check proximity to first point for closing loop
        if (penNodesRef.current.length >= 3) {
          const firstNode = penNodesRef.current[0];
          const dist = Math.hypot(relX - firstNode.x, relY - firstNode.y);
          setIsNearStartPoint(dist < 3.2);
        } else {
          setIsNearStartPoint(false);
        }
        return;
      }

      const activeInteractionNodeDrag = interactionNodeDragRef.current;
      if (activeInteractionNodeDrag) {
        const svg = document.querySelector<SVGSVGElement>(`svg[data-interaction-area-path="${activeInteractionNodeDrag.elementId}"]`);
        const area = activeScene?.els.find((el) => el.id === activeInteractionNodeDrag.elementId);
        if (!svg || !area?.saberNodes?.length) return;
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const local = svg.getScreenCTM()?.inverse()
          ? point.matrixTransform(svg.getScreenCTM()!.inverse())
          : { x: ((e.clientX - svg.getBoundingClientRect().left) / svg.getBoundingClientRect().width) * 100, y: ((e.clientY - svg.getBoundingClientRect().top) / svg.getBoundingClientRect().height) * 100 };
        const nodes = area.saberNodes.map((node, index) => index === activeInteractionNodeDrag.index
          ? { ...node, x: Number(Math.max(0, Math.min(100, local.x)).toFixed(2)), y: Number(Math.max(0, Math.min(100, local.y)).toFixed(2)), handleIn: undefined, handleOut: undefined }
          : node);
        onUpdateElement(area.id, { saberNodes: nodes, shapePath: bezierNodesToSvgPath(nodes, true) }, undefined, false);
        elDragMovedRef.current = true;
        return;
      }

      // Handle Viewport Pan
      const panSession = panSessionRef.current;
      if (panSession) {
        const dx = e.clientX - panSession.mouseX;
        const dy = e.clientY - panSession.mouseY;
        onUpdateViewportRef.current((v) => ({
          ...v,
          panX: panSession.startPanX + dx,
          panY: panSession.startPanY + dy,
        }));
        return;
      }

      if (!selectedElement) return;

      // Click vs Drag threshold guard:
      // A pure click or micro-movement (< 3px) must never trigger element move,
      // resize, rotation or font-size updates.
      const DRAG_THRESHOLD = 3;
      const pointerDistance = Math.hypot(e.clientX - dragStart.mouseX, e.clientY - dragStart.mouseY);
      if (!elDragMovedRef.current && pointerDistance < DRAG_THRESHOLD) {
        return;
      }

      // Always convert pointer movement against the rendered stage. The CSS
      // layout can differ from CANVAS_* when panels, fullscreen, or browser
      // zoom are active.
      const stageRect = gestureStageRectRef.current || getStageRect();
      const stageW = Math.max(1, stageRect.width);
      const stageH = Math.max(1, stageRect.height);

      // Handle Element Drag
      if (activeDrag) {
        let dxPct = ((e.clientX - dragStart.mouseX) / stageW) * 100;
        let dyPct = ((e.clientY - dragStart.mouseY) / stageH) * 100;

        // Shift key: Axis lock (lock to straight horizontal or vertical movement)
        if (e.shiftKey) {
          if (Math.abs(dxPct) >= Math.abs(dyPct)) {
            dyPct = 0;
          } else {
            dxPct = 0;
          }
        }

        let nextX = dragStart.elX + dxPct;
        let nextY = dragStart.elY + dyPct;

        // Smart Guides Snapping logic
        const activeSmartGuides: SmartGuide[] = [];
        if (viewport.snapEnabled && activeScene) {
          const currentW = selectedElement.w;
          const currentH = selectedElement.h;
          const currentLeft = nextX;
          const currentRight = nextX + currentW;
          const currentCenterX = nextX + currentW / 2;

          const currentTop = nextY;
          const currentBottom = nextY + currentH;
          const currentCenterY = nextY + currentH / 2;

          const SNAP_THRESHOLD = 0.8;

          let snappedX: number | null = null;
          let snappedY: number | null = null;

          // 1. Check Canvas Center & Edges
          if (Math.abs(currentCenterX - 50) < SNAP_THRESHOLD) {
            snappedX = 50 - currentW / 2;
            activeSmartGuides.push({ type: 'vertical', pos: 50, label: '画布中心 X (50%)' });
          }
          if (Math.abs(currentCenterY - 50) < SNAP_THRESHOLD) {
            snappedY = 50 - currentH / 2;
            activeSmartGuides.push({ type: 'horizontal', pos: 50, label: '画布中心 Y (50%)' });
          }

          // 2. Element-to-Element Snapping
          const otherElements = snapTargetsRef.current;

          for (const target of otherElements) {
            const targetLeft = target.x;
            const targetRight = target.x + target.w;
            const targetCenterX = target.x + target.w / 2;

            const targetTop = target.y;
            const targetBottom = target.y + target.h;
            const targetCenterY = target.y + target.h / 2;

            if (snappedX === null) {
              if (Math.abs(currentCenterX - targetCenterX) < SNAP_THRESHOLD) {
                snappedX = targetCenterX - currentW / 2;
                activeSmartGuides.push({
                  type: 'vertical',
                  pos: targetCenterX,
                  label: `中心对齐 / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentLeft - targetLeft) < SNAP_THRESHOLD) {
                snappedX = targetLeft;
                activeSmartGuides.push({
                  type: 'vertical',
                  pos: targetLeft,
                  label: `左对齐 / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentRight - targetRight) < SNAP_THRESHOLD) {
                snappedX = targetRight - currentW;
                activeSmartGuides.push({
                  type: 'vertical',
                  pos: targetRight,
                  label: `右对齐 / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentLeft - targetRight) < SNAP_THRESHOLD) {
                snappedX = targetRight;
                activeSmartGuides.push({
                  type: 'vertical',
                  pos: targetRight,
                  label: `边缘吸附 (左贴右) / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentRight - targetLeft) < SNAP_THRESHOLD) {
                snappedX = targetLeft - currentW;
                activeSmartGuides.push({
                  type: 'vertical',
                  pos: targetLeft,
                  label: `边缘吸附 (右贴左) / ${target.sourceName || '目标图层'}`,
                });
              }
            }

            if (snappedY === null) {
              if (Math.abs(currentCenterY - targetCenterY) < SNAP_THRESHOLD) {
                snappedY = targetCenterY - currentH / 2;
                activeSmartGuides.push({
                  type: 'horizontal',
                  pos: targetCenterY,
                  label: `垂直居中对齐 / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentTop - targetTop) < SNAP_THRESHOLD) {
                snappedY = targetTop;
                activeSmartGuides.push({
                  type: 'horizontal',
                  pos: targetTop,
                  label: `顶部对齐 / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentBottom - targetBottom) < SNAP_THRESHOLD) {
                snappedY = targetBottom - currentH;
                activeSmartGuides.push({
                  type: 'horizontal',
                  pos: targetBottom,
                  label: `底部对齐 / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentTop - targetBottom) < SNAP_THRESHOLD) {
                snappedY = targetBottom;
                activeSmartGuides.push({
                  type: 'horizontal',
                  pos: targetBottom,
                  label: `边缘吸附 (顶贴底) / ${target.sourceName || '目标图层'}`,
                });
              } else if (Math.abs(currentBottom - targetTop) < SNAP_THRESHOLD) {
                snappedY = targetTop - currentH;
                activeSmartGuides.push({
                  type: 'horizontal',
                  pos: targetTop,
                  label: `边缘吸附 (底贴顶) / ${target.sourceName || '目标图层'}`,
                });
              }
            }
          }

          if (snappedX !== null) nextX = snappedX;
          if (snappedY !== null) nextY = snappedY;
        }

        updateSmartGuides(activeSmartGuides);

        elDragMovedRef.current = true;
        queueTransformUpdate(selectedElement.id, applyAnimatedTransformPatch(selectedElement, {
          x: Math.round(nextX * 100) / 100,
          y: Math.round(nextY * 100) / 100,
        }));
      }

      // Handle Element Resize
      if (activeResizeHandle) {
        const resizeHandle = activeResizeHandle;
        const rawDx = e.clientX - dragStart.mouseX;
        const rawDy = e.clientY - dragStart.mouseY;
        const angle = ((dragStart.elRot || 0) * Math.PI) / 180;
        // Project pointer movement into the element's local axes. This keeps
        // corner handles intuitive after an element has been rotated.
        const localDx = rawDx * Math.cos(angle) + rawDy * Math.sin(angle);
        const localDy = -rawDx * Math.sin(angle) + rawDy * Math.cos(angle);
        const dxPct = (localDx / stageW) * 100;
        const dyPct = (localDy / stageH) * 100;

        let nextX = dragStart.elX;
        let nextY = dragStart.elY;
        let nextW = dragStart.elW;
        let nextH = dragStart.elH;

        // 銆怳I 缁勪欢銆戠瓑姣旈攣瀹氱缉鏀撅細浠ョ粍浠跺師濮嬪楂樻瘮涓哄熀鍑嗭紝
        // 鍐呭鍦?ScaledUIComponent 涓缁?100% 閾烘弧瀹瑰櫒 鈫?鎺у埗鐐硅创鍚堝唴瀹硅竟缂樸€?
        // 鍐呭闅忓鍣ㄧ瓑姣斾緥缂╂斁锛堜换鎰忔柟鍚戞嫋鎷芥帶鍒剁偣鍧囩敓鏁堬級銆?
        // 绛夋瘮閿佸畾姣斾緥锛氫紭鍏堢敤 ScaledUIComponent 杩愯鏃跺疄娴嬬殑缁勪欢瀹為檯瀹介珮姣旓紙鏇村噯纭級锛?
        // 鏃犲疄娴嬫椂鍥為€€鍒?GALAXY_COMPONENT_BASE_SIZE 浼扮畻鍊笺€?

        // 剪映 / PPT 级多媒体交互规范：
        // 1. 角手柄（nw, ne, se, sw）：默认等比锁定缩放（按住 Shift 可自由拉伸），文字字号与外框实时同步。
        // 2. 上下手柄（n, s）：文字图层自适应垂直字号；普通图层与自定义代码自由调整高度（杜绝强制等比拉扯变形）。
        // 3. 左右手柄（e, w）：文字图层调整折行宽度，字号保持不变；普通图层与自定义代码自由调整宽度。
        const cornerResize = resizeHandle.length === 2;
        const isText = selectedElement.type === 'txt';
        const isVerticalHandle = resizeHandle === 'n' || resizeHandle === 's';

        const isOfficialUiComponent = selectedElement.type === 'ui-component' && selectedElement.uiComponentType === 'official-modao';
        const shouldLockAspect = isOfficialUiComponent
          ? true
          : (((cornerResize ? !e.shiftKey : e.shiftKey) || isAspectRatioResizeLocked(selectedElement.lockAspectRatio))
            || (isText && (cornerResize || isVerticalHandle)));

        const lockAspect = shouldLockAspect
          ? getElementResizeAspect(selectedElement, CANVAS_W, CANVAS_H)
          : null;

        if (lockAspect) {
          const resized = resizeRectWithAspect({
            x: dragStart.elX,
            y: dragStart.elY,
            width: dragStart.elW,
            height: dragStart.elH,
            deltaX: dxPct,
            deltaY: dyPct,
            handle: resizeHandle,
            aspectRatio: lockAspect,
            canvasWidth: CANVAS_W,
            canvasHeight: CANVAS_H,
            minDimension: ELEMENT_RESIZE_MIN,
          });
          nextX = resized.x;
          nextY = resized.y;
          nextW = resized.width;
          nextH = resized.height;
        } else {
          if (resizeHandle.includes('e')) nextW = Math.max(2, dragStart.elW + dxPct);
          if (resizeHandle.includes('s')) nextH = Math.max(2, dragStart.elH + dyPct);
          if (resizeHandle.includes('w')) {
            const w = Math.max(2, dragStart.elW - dxPct);
            nextX = dragStart.elX + (dragStart.elW - w);
            nextW = w;
          }
          if (resizeHandle.includes('n')) {
            const h = Math.max(2, dragStart.elH - dyPct);
            nextY = dragStart.elY + (dragStart.elH - h);
            nextH = h;
          }
        }

        // Keep the opposite edge/corner stationary for rotated elements.
        if (Math.abs(dragStart.elRot || 0) > 0.001) {
          const hasW = resizeHandle.includes('w');
          const hasE = resizeHandle.includes('e');
          const hasN = resizeHandle.includes('n');
          const hasS = resizeHandle.includes('s');
          const anchorX = hasW ? dragStart.elW : hasE ? 0 : dragStart.elW / 2;
          const anchorY = hasN ? dragStart.elH : hasS ? 0 : dragStart.elH / 2;
          const rotateOffset = (xPct: number, yPct: number) => ({
            x: (xPct * stageW / 100) * Math.cos(angle) - (yPct * stageH / 100) * Math.sin(angle),
            y: (xPct * stageW / 100) * Math.sin(angle) + (yPct * stageH / 100) * Math.cos(angle),
          });
          const startCenter = {
            x: stageRect.left + ((dragStart.elX + dragStart.elW / 2) / 100) * stageW,
            y: stageRect.top + ((dragStart.elY + dragStart.elH / 2) / 100) * stageH,
          };
          const startAnchorOffset = rotateOffset(anchorX - dragStart.elW / 2, anchorY - dragStart.elH / 2);
          const anchorScreen = { x: startCenter.x + startAnchorOffset.x, y: startCenter.y + startAnchorOffset.y };
          const nextAnchorOffset = rotateOffset(anchorX - nextW / 2, anchorY - nextH / 2);
          nextX = ((anchorScreen.x - nextAnchorOffset.x - stageRect.left) / stageW) * 100 - nextW / 2;
          nextY = ((anchorScreen.y - nextAnchorOffset.y - stageRect.top) / stageH) * 100 - nextH / 2;
        }

        const patchX = nextX;
        const patchY = nextY;
        const patchW = nextW;
        const patchH = nextH;
        const resizePatch: Partial<SceneElement> = {
          x: Math.round(patchX * 100) / 100,
          y: Math.round(patchY * 100) / 100,
          w: Math.round(patchW * 100) / 100,
          h: Math.round(patchH * 100) / 100,
        };
        if (selectedElement.type === 'custom-code') {
          resizePatch.customCodeAutoFitted = true;
          if (!selectedElement.lockAspectRatio) {
            resizePatch.lockAspectRatio = false;
          }
        }

        const isHorizontalOnly = (resizeHandle === 'e' || resizeHandle === 'w');
        if (selectedElement.type === 'txt' && !isHorizontalOnly && (cornerResize || isVerticalHandle)) {
          resizePatch.fontSize = getTextResizeFontSize({
            handle: resizeHandle,
            startWidth: dragStart.elW,
            startHeight: dragStart.elH,
            nextWidth: nextW,
            nextHeight: nextH,
            startFontSize: dragStart.elFontSize,
          });
        }

        elDragMovedRef.current = true;
        queueTransformUpdate(selectedElement.id, applyAnimatedTransformPatch(selectedElement, resizePatch));
      }

      // Handle Element Rotate
      if (activeRotate && stageRef.current) {
        const stageRect = stageRef.current.getBoundingClientRect();
        const elCenterX = stageRect.left + ((dragStart.elX + dragStart.elW / 2) / 100) * stageRect.width;
        const elCenterY = stageRect.top + ((dragStart.elY + dragStart.elH / 2) / 100) * stageRect.height;
        const rad = Math.atan2(e.clientY - elCenterY, e.clientX - elCenterX);
        let deg = (rad * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;

        if (e.shiftKey) {
          // Standard PowerPoint / Figma Shift modifier: 15-degree stepping snap
          deg = Math.round(deg / 15) * 15;
          if (deg >= 360) deg = 0;
        } else if (viewport.snapEnabled) {
          if (Math.abs(deg - 0) < 5 || Math.abs(deg - 360) < 5) deg = 0;
          else if (Math.abs(deg - 90) < 5) deg = 90;
          else if (Math.abs(deg - 180) < 5) deg = 180;
          else if (Math.abs(deg - 270) < 5) deg = 270;
        }

        elDragMovedRef.current = true;
        queueTransformUpdate(selectedElement.id, applyAnimatedTransformPatch(selectedElement, {
          rot: Math.round(deg),
        }));
      }
    };

    const handleWindowMouseUp = (event?: MouseEvent) => {
      const completedElementId = gestureElementIdRef.current;
      const activePointerId = transformGestureRef.current.pointerId;
      if (activePointerId != null && event && 'pointerId' in event
        && Number((event as PointerEvent).pointerId) !== activePointerId) return;
      if (event?.type === 'pointerup' && transformGestureRef.current.kind && elDragMovedRef.current) {
        // pointerup can carry a position newer than the last delivered move.
        // Consume it before flushing so the final visible frame is committed.
        lastTransformPointerEventRef.current = null;
        handleWindowMouseMove(event);
      }
      if (isDraggingPenHandleRef.current) {
        isDraggingPenHandleRef.current = false;
        setIsDraggingPenHandle(false);
      }

      // 拖拽/缩放/旋转结束：整段操作合并为一条历史记录（高频 mousemove 不逐帧记录）
      if (elDragMovedRef.current) {
        flushTransformUpdate();
        elDragMovedRef.current = false;
        const completedGesture = transformGestureRef.current;
        const action = interactionNodeDragRef.current ? '编辑交互区域' : completedGesture.kind === 'resize' ? '调整图层大小' : completedGesture.kind === 'rotate' ? '旋转图层' : '移动图层';
        const gestureElement = gestureElementRef.current;
        const elLabel = gestureElement?.content || gestureElement?.sourceName || gestureElement?.id || '';
        onCommitHistoryRef.current?.(action, 'element_update', elLabel ? `图层: ${elLabel}` : undefined);
      } else {
        // A pure click or sub-threshold drag did not move: clean up any gesture CSS preview
        if (completedElementId) {
          clearGesturePreview(completedElementId);
        }
      }

      // Remove the gesture attribute before releasing the stable host ref so
      // the final frame never needs to query the scene tree again.
      if (completedElementId) {
        setGestureVisualState(completedElementId, false);
      }
      gestureElementRef.current = undefined;
      gestureElementIdRef.current = null;
      gestureHostRef.current = null;
      transformGestureRef.current = { kind: null };
      lastTransformPointerEventRef.current = null;
      gestureStageRectRef.current = null;
      snapTargetsRef.current = [];
      setInteractionNodeDrag(null);
      setIsDraggingEl(false);
      setResizeHandle(null);
      setIsRotating(false);
      panGestureRef.current = null;
      panSessionRef.current = null;
      setIsPanning(false);
      updateSmartGuides([]);
      transformReleaseGuardRef.current?.();
    };

    // Pointer events cover mouse, pen and touch in supported browsers. The
    // previous parallel mouse listeners caused one physical drag to enter the
    // transform path twice (pointermove + compatibility mousemove).
    window.addEventListener('pointermove', handleWindowMouseMove);
    window.addEventListener('pointerup', handleWindowMouseUp);
    window.addEventListener('pointercancel', handleWindowMouseUp);
    window.addEventListener('lostpointercapture', handleWindowMouseUp);

    // 瑙︽懜鎷栧姩鏀寔锛堢紪杈戝櫒锛夛細瑙︽懜绉诲姩/缁撴潫鏄犲皠鍒板悓涓€鐘舵€佹満
    const handleWindowTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (!(transformGestureRef.current.kind || panSessionRef.current)) return;
      e.preventDefault();
      handleWindowMouseMove({ clientX: t.clientX, clientY: t.clientY } as unknown as MouseEvent);
    };
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowMouseUp);
    window.addEventListener('touchcancel', handleWindowMouseUp);

    return () => {
      flushTransformUpdate();
      transformGestureRef.current = { kind: null };
      window.removeEventListener('pointermove', handleWindowMouseMove);
      window.removeEventListener('pointerup', handleWindowMouseUp);
      window.removeEventListener('pointercancel', handleWindowMouseUp);
      window.removeEventListener('lostpointercapture', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowMouseUp);
      window.removeEventListener('touchcancel', handleWindowMouseUp);
    };
  }, [
    isDrawingTool,
    isInteractionAreaTool,
    isInteractionPreview,
    viewport.activeTool,
  ]);

  // Mask editing has its own gesture layer so the magenta mask handles never
  // compete with the layer's standard transform handles.
  useEffect(() => {
    const renderMaskVisual = (drag: MaskDragState, patch: Partial<SceneElement>) => {
      const overlay = selectionOverlayRef.current;
      const svg = document.querySelector<SVGSVGElement>('svg [data-mask-control]')?.ownerSVGElement;
      if (!overlay || !svg) return;
      const x = typeof patch.maskX === 'number' ? patch.maskX : drag.maskX;
      const y = typeof patch.maskY === 'number' ? patch.maskY : drag.maskY;
      const width = typeof patch.maskWidth === 'number' ? patch.maskWidth : drag.maskWidth;
      const height = typeof patch.maskHeight === 'number' ? patch.maskHeight : drag.maskHeight;
      const nodes = Array.isArray(patch.maskNodes) ? patch.maskNodes : drag.nodes.length >= 3 ? drag.nodes : [
        { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
      ];
      const topLeft = overlay.points[0];
      const topRight = overlay.points[1];
      const bottomLeft = overlay.points[3];
      const mapPoint = (px: number, py: number) => ({
        x: topLeft.x + (topRight.x - topLeft.x) * (px / 100) + (bottomLeft.x - topLeft.x) * (py / 100),
        y: topLeft.y + (topRight.y - topLeft.y) * (px / 100) + (bottomLeft.y - topLeft.y) * (py / 100),
      });
      const points = nodes.map((node) => mapPoint(node.x, node.y));
      const group = svg.querySelector<SVGGElement>('[data-mask-control]');
      const polygon = group?.querySelector<SVGPolygonElement>('polygon');
      if (polygon) polygon.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
      group?.querySelectorAll<SVGCircleElement>('circle').forEach((circle, index) => {
        const point = points[index];
        if (!point) return;
        circle.setAttribute('cx', String(point.x));
        circle.setAttribute('cy', String(point.y));
      });
    };
    const queueMaskUpdate = (patch: Partial<SceneElement>) => {
      const element = selectedElementRef.current;
      if (!element) return;
      const nextPatch = applyAnimatedMaskPatch(element, patch);
      pendingMaskUpdateRef.current = nextPatch;
      const drag = maskDragRef.current;
      if (drag) {
        drag.visualPatch = nextPatch;
        renderMaskVisual(drag, nextPatch);
      }
    };
    const flushMaskUpdate = () => {
      const nextPatch = pendingMaskUpdateRef.current;
      pendingMaskUpdateRef.current = null;
      const currentElement = selectedElementRef.current;
      if (nextPatch && currentElement) onUpdateElementRef.current(currentElement.id, nextPatch, undefined, false);
    };
    const handleMove = (event: PointerEvent | MouseEvent) => {
      const now = performance.now();
      const isPointerEvent = 'pointerId' in event;
      const lastEvent = lastMaskPointerEventRef.current;
      // Chrome emits a synthetic mousemove after pointermove. Ignore that
      // duplicate while retaining the mouse fallback for non-Pointer hosts.
      if (!isPointerEvent && lastEvent?.type === 'pointer' && now - lastEvent.time < 40
        && lastEvent.x === event.clientX && lastEvent.y === event.clientY) return;
      lastMaskPointerEventRef.current = {
        type: isPointerEvent ? 'pointer' : 'mouse',
        time: now,
        x: event.clientX,
        y: event.clientY,
      };
      const maskDrag = maskDragRef.current;
      const selectedElement = selectedElementRef.current;
      const selectionOverlay = selectionOverlayRef.current;
      if (!maskDrag || !selectedElement || !selectionOverlay) return;
      maskDrag.moved = true;
      const boxWidth = Math.max(1, Math.hypot(selectionOverlay.points[1].x - selectionOverlay.points[0].x, selectionOverlay.points[1].y - selectionOverlay.points[0].y));
      const boxHeight = Math.max(1, Math.hypot(selectionOverlay.points[3].x - selectionOverlay.points[0].x, selectionOverlay.points[3].y - selectionOverlay.points[0].y));
      // Project screen movement onto the selected layer's local axes. Using
      // raw clientX/clientY makes a rotated layer's mask drift diagonally.
      const screenDx = event.clientX - maskDrag.startX;
      const screenDy = event.clientY - maskDrag.startY;
      const topEdge = {
        x: selectionOverlay.points[1].x - selectionOverlay.points[0].x,
        y: selectionOverlay.points[1].y - selectionOverlay.points[0].y,
      };
      const leftEdge = {
        x: selectionOverlay.points[3].x - selectionOverlay.points[0].x,
        y: selectionOverlay.points[3].y - selectionOverlay.points[0].y,
      };
      // Project onto the normalized local axes, then convert screen pixels to
      // the mask's 0..100 coordinate space. The previous calculation stopped
      // after the first projection and multiplied pixels by 100, so a small
      // pointer movement could resize the mask by the entire layer width.
      const localDx = (screenDx * topEdge.x + screenDy * topEdge.y) / (boxWidth * boxWidth);
      const localDy = (screenDx * leftEdge.x + screenDy * leftEdge.y) / (boxHeight * boxHeight);
      const dx = localDx * 100;
      const dy = localDy * 100;
      let x = maskDrag.maskX;
      let y = maskDrag.maskY;
      let width = maskDrag.maskWidth;
      let height = maskDrag.maskHeight;
      if (maskDrag.kind === 'node' && maskDrag.nodeIndex !== undefined) {
        const nodes = maskDrag.nodes.map((node, index) => index === maskDrag.nodeIndex
          ? { x: Math.max(0, Math.min(100, node.x + dx)), y: Math.max(0, Math.min(100, node.y + dy)) }
          : node);
        queueMaskUpdate({ maskEnabled: true, maskNodes: nodes });
        return;
      }
      if (maskDrag.kind === 'move' && maskDrag.nodes.length >= 3) {
        // Move the whole path as one unit so clamping never distorts its shape.
        const minX = Math.min(...maskDrag.nodes.map((node) => node.x));
        const maxX = Math.max(...maskDrag.nodes.map((node) => node.x));
        const minY = Math.min(...maskDrag.nodes.map((node) => node.y));
        const maxY = Math.max(...maskDrag.nodes.map((node) => node.y));
        const safeDx = Math.max(-minX, Math.min(100 - maxX, dx));
        const safeDy = Math.max(-minY, Math.min(100 - maxY, dy));
        const nodes = maskDrag.nodes.map((node) => ({ x: node.x + safeDx, y: node.y + safeDy }));
        queueMaskUpdate({ maskEnabled: true, maskNodes: nodes });
        return;
      }
      if (maskDrag.kind === 'move') {
        x = Math.max(0, Math.min(100 - width, maskDrag.maskX + dx));
        y = Math.max(0, Math.min(100 - height, maskDrag.maskY + dy));
      } else {
        const handle = maskDrag.handle || '';
        const right = maskDrag.maskX + maskDrag.maskWidth;
        const bottom = maskDrag.maskY + maskDrag.maskHeight;
        if (handle.includes('w')) { x = Math.max(0, Math.min(right - 1, maskDrag.maskX + dx)); width = right - x; }
        if (handle.includes('e')) width = Math.max(1, Math.min(100 - x, maskDrag.maskWidth + dx));
        if (handle.includes('n')) { y = Math.max(0, Math.min(bottom - 1, maskDrag.maskY + dy)); height = bottom - y; }
        if (handle.includes('s')) height = Math.max(1, Math.min(100 - y, maskDrag.maskHeight + dy));
      }
      const scaleX = maskDrag.maskWidth ? width / maskDrag.maskWidth : 1;
      const scaleY = maskDrag.maskHeight ? height / maskDrag.maskHeight : 1;
      const nodes = maskDrag.nodes.map((node) => ({ x: Math.max(0, Math.min(100, x + (node.x - maskDrag.maskX) * scaleX)), y: Math.max(0, Math.min(100, y + (node.y - maskDrag.maskY) * scaleY)) }));
      queueMaskUpdate({ maskEnabled: true, maskX: Math.round(x * 10) / 10, maskY: Math.round(y * 10) / 10, maskWidth: Math.round(width * 10) / 10, maskHeight: Math.round(height * 10) / 10, ...(nodes.length ? { maskNodes: nodes } : {}) });
    };
    const handleUp = () => {
      const currentDrag = maskDragRef.current;
      flushMaskUpdate();
      if (currentDrag?.moved) {
        const currentElement = selectedElementRef.current;
        onCommitHistoryRef.current?.(
          currentDrag.kind === 'node' ? '编辑钢笔蒙版' : currentDrag.kind === 'resize' ? '调整蒙版' : '移动蒙版',
          'element_update',
          currentElement?.content || currentElement?.sourceName || currentElement?.id,
        );
      }
      maskDragRef.current = null;
    };
    const supportsPointerEvents = 'PointerEvent' in window;
    if (supportsPointerEvents) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
      window.addEventListener('lostpointercapture', handleUp);
    } else {
      // Legacy hosts without Pointer Events still get mouse-based mask editing.
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      flushMaskUpdate();
      if (supportsPointerEvents) {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        window.removeEventListener('lostpointercapture', handleUp);
      } else {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      }
      if (maskUpdateFrameRef.current !== null) window.cancelAnimationFrame(maskUpdateFrameRef.current);
      maskUpdateFrameRef.current = null;
    };
  }, []);

  // Handle Element Trigger in Preview Mode (Interactions: click / hover)
  const hoverTimerRef = useRef<any>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressElementRef = useRef<string | null>(null);
  const gestureRef = useRef<{ pointerId: number; elementId: string; x: number; y: number; trigger: string } | null>(null);
  const suppressClickRef = useRef(false);
  // 銆愭柊澧炪€戝厓绱犳偓鍋滃弽棣堢壒鏁堬細褰撳墠鎮仠鐨勫厓绱?id锛堢紪杈?棰勮鍧囩敓鏁堬紝鍓槧寮?hover 鍙嶉锛?

  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [directMorphState, setDirectMorphState] = useState<{ elementId: string | null; motion: DirectMorphMotionId | null; progress: number }>({ elementId: null, motion: null, progress: 0 });
  const directMorphProgressRef = useRef(0);
  const directMorphRafRef = useRef<number | null>(null);
  const directMorphRunRef = useRef<{ resolve: () => void } | null>(null);
  const triggerRunRef = useRef(0);
  const [interactionEffectState, setInteractionEffectState] = useState<{
    elementId: string | null;
    effect: InteractionEffect | null;
    progress: number;
    runId: number;
    originX: number;
    originY: number;
  }>({ elementId: null, effect: null, progress: 0, runId: 0, originX: 50, originY: 50 });
  const interactionEffectRafRef = useRef<number | null>(null);
  const interactionEffectTimerRef = useRef<number | null>(null);
  const interactionEffectRunRef = useRef(0);
  const [interactionLoopClock, setInteractionLoopClock] = useState(0);

  useEffect(() => {
    const hasContinuousLoop = activeScene?.els.some((el) => {
      const isContinuousEffect = getInteractionLoopAnim(el.interactionEffect) !== null
        || el.interactionEffect === 'press-spring';
      if (!isContinuousEffect) return false;
      const trigger = el.interactionEffectTrigger || 'click';
      if (trigger === 'hover') return hoveredElementId === el.id;
      return trigger === 'default'
        && (isInteractionPreview || selectedElementId === el.id || multiSelectedIds.includes(el.id));
    });
    if (!hasContinuousLoop) return;

    let frameId = 0;
    let lastTick = 0;
    const targetInterval = 1000 / 30; // 限制在 30 FPS，防止高刷屏（144Hz/240Hz）每秒触发上百次全画布 React 重新渲染
    const tick = (now: number) => {
      if (now - lastTick >= targetInterval) {
        lastTick = now;
        setInteractionLoopClock(now);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [activeScene, hoveredElementId, isInteractionPreview, multiSelectedIds, selectedElementId]);

  // Keep interaction feedback local to the canvas. It never enters the project history.
  const playInteractionEffect = useCallback((el: SceneElement, originX = 50, originY = 50) => {
    const effect = el.interactionEffect;
    if (!effect || effect === 'none') return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const runId = ++interactionEffectRunRef.current;
    const duration = Math.max(120, Math.min(3000, el.interactionEffectDuration ?? 650));
    const safeOriginX = Math.max(0, Math.min(100, originX));
    const safeOriginY = Math.max(0, Math.min(100, originY));
    if (interactionEffectRafRef.current !== null) cancelAnimationFrame(interactionEffectRafRef.current);
    if (interactionEffectTimerRef.current !== null) window.clearTimeout(interactionEffectTimerRef.current);

    const isAnimatedInteraction = effect === 'blur'
      || getInteractionLoopAnim(effect) !== null
      || effect === 'press-spring';
    setInteractionEffectState({ elementId: el.id, effect, progress: isAnimatedInteraction ? 0 : 1, runId, originX: safeOriginX, originY: safeOriginY });
    if (isAnimatedInteraction) {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.max(0, Math.min(1, (now - startedAt) / duration));
        const progress = effect === 'blur' ? Math.sin(Math.PI * elapsed) : elapsed;
        setInteractionEffectState({ elementId: el.id, effect, progress, runId, originX: safeOriginX, originY: safeOriginY });
        if (elapsed < 1 && runId === interactionEffectRunRef.current) {
          interactionEffectRafRef.current = requestAnimationFrame(tick);
        } else {
          interactionEffectRafRef.current = null;
          setInteractionEffectState((current) => current.runId === runId
            ? { ...current, elementId: null, effect: null, progress: 0 }
            : current);
        }
      };
      interactionEffectRafRef.current = requestAnimationFrame(tick);
      return;
    }

    interactionEffectTimerRef.current = window.setTimeout(() => {
      interactionEffectTimerRef.current = null;
      setInteractionEffectState((current) => current.runId === runId
        ? { ...current, elementId: null, effect: null, progress: 0 }
        : current);
    }, duration);
  }, []);

  useEffect(() => () => {
    if (interactionEffectRafRef.current !== null) cancelAnimationFrame(interactionEffectRafRef.current);
    if (interactionEffectTimerRef.current !== null) window.clearTimeout(interactionEffectTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
  }, []);

  const playDirectMorph = useCallback((el: SceneElement): Promise<void> => {
    const motion = el.hoverEffect;
    if (!motion || !isDirectMorphMotion(motion)) return Promise.resolve();

    const startProgress = directMorphProgressRef.current;
    if (directMorphRafRef.current !== null) cancelAnimationFrame(directMorphRafRef.current);
    directMorphRunRef.current?.resolve();

    return new Promise((resolve) => {
      directMorphRunRef.current = { resolve };
      const startedAt = performance.now();
      const duration = 560;
      setDirectMorphState({ elementId: el.id, motion, progress: startProgress });

      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - startedAt) / duration);
        const next = getDirectMorphProgress(elapsed, startProgress);
        directMorphProgressRef.current = next;
        setDirectMorphState({ elementId: el.id, motion, progress: next });

        if (elapsed < 1) {
          directMorphRafRef.current = requestAnimationFrame(tick);
          return;
        }
        directMorphRafRef.current = null;
        directMorphProgressRef.current = 0;
        setDirectMorphState({ elementId: null, motion: null, progress: 0 });
        directMorphRunRef.current = null;
        resolve();
      };
      directMorphRafRef.current = requestAnimationFrame(tick);
    });
  }, []);

  useEffect(() => () => {
    if (directMorphRafRef.current !== null) cancelAnimationFrame(directMorphRafRef.current);
    directMorphRunRef.current?.resolve();
  }, []);

  const closePopup = useCallback(() => {
    if (popupClosing) return; // 闃叉閲嶅瑙﹀彂
    const triggerEl = activePopupTriggerElement;
    if (!triggerEl || !activePopupSceneId || isLongLivedPopup(triggerEl)) return;
    const popupScene = projectData.scenes[activePopupSceneId];
    const dur = getPopupExitDuration(triggerEl, popupScene);
    const finishClose = () => {
      setActivePopupSceneId(null);
      setActivePopupTriggerElement(null);
      setPopoverAnchor(null);
      setInlineActiveElementId(null);
      setPopupContentScale(1);
    };
    if (dur <= 0) { finishClose(); return; }
    setPopupClosing(true);
    if (popupCloseTimerRef.current) window.clearTimeout(popupCloseTimerRef.current);
    popupCloseTimerRef.current = window.setTimeout(() => {
      finishClose();
      setPopupClosing(false);
      popupCloseTimerRef.current = null;
    }, dur);
  }, [activePopupSceneId, activePopupTriggerElement, popupClosing, projectData.scenes]);

  const closeSecondaryPopup = useCallback((popupId: string) => {
    const popup = secondaryPopups.find((item) => item.id === popupId);
    if (!popup || popup.closing || popupClosing || isLongLivedPopup(popup.config)) return;
    const duration = getPopupExitDuration(popup.config, projectData.scenes[popup.target]);
    if (duration <= 0) {
      setSecondaryPopups((current) => current.filter((item) => item.id !== popupId));
      return;
    }
    setSecondaryPopups((current) => current.map((item) => item.id === popupId ? { ...item, closing: true } : item));
    const existingTimer = secondaryPopupCloseTimersRef.current[popupId];
    if (existingTimer) window.clearTimeout(existingTimer);
    secondaryPopupCloseTimersRef.current[popupId] = window.setTimeout(() => {
      setSecondaryPopups((current) => current.filter((item) => item.id !== popupId));
      delete secondaryPopupCloseTimersRef.current[popupId];
    }, duration);
  }, [popupClosing, projectData.scenes, secondaryPopups]);

  const handleElementTrigger = (el: SceneElement) => {
    // 銆愪慨澶嶃€戠紪杈戞ā寮忎笉鎵ц浠讳綍璺敱璺宠浆锛堢偣鍑诲彧璐熻矗閫変腑/缂栬緫锛夛紝浠呭湪婕旂ず/棰勮妯″紡瑙﹀彂銆?
    // 涓?HotspotOverlay 鐨?isEditing 瀹堝崼淇濇寔涓€鑷达紝閬垮厤缂栬緫鏃惰璺宠浆鍦烘櫙 / 璇紑寮圭獥 / 璇紑缃戦〉銆?

    if (!isInteractionPreview) return;
    const interaction = resolveInteraction(el);
    if (interaction.steps && interaction.steps.length > 0) {
      const variableValues = new Map<string, unknown>((projectData.variables || []).map((variable) => [variable.name, variable.value]));
      void runInteractionSteps(interaction.steps, {
        getVariableValue: (name) => variableValues.get(name),
        jump: (target) => {
          if (projectData.scenes[target]) onSelectScene(target);
        },
        popup: (target) => {
          if (projectData.scenes[target]) onSelectScene(target);
        },
        openUrl: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
        setVariable: (name, value) => {
          variableValues.set(name, value);
          onVariableMutation?.({
            trigger: interaction.trigger,
            action: 'set-variable',
            variableName: name,
            variableValue: typeof value === 'boolean' ? String(value) : value,
            hoverDelay: interaction.hoverDelay,
          });
        },
        switchVariant: (componentId, variantId) => {
          const nextProject = switchInstanceVariant(projectData, componentId, variantId);
          const nextGroup = Object.values(nextProject.scenes)
            .flatMap((scene) => scene.els)
            .find((element) => element.id === componentId);
          if (!nextGroup) return;
          onUpdateElement(componentId, {
            children: nextGroup.children,
            componentInstance: nextGroup.componentInstance,
          }, '切换组件状态', false);
        },
      });
      return;
    }
    if (interaction.action === 'set-variable') {
      onVariableMutation?.(interaction);
      return;
    }
    // 缃戦〉閾炬帴璺宠浆锛坙inkType='url'锛夛細鍦ㄦ柊绐楀彛鎵撳紑缃戦〉锛孶RL 鍙兘瀛樹簬 linkUrl 鎴栧吋瀹圭殑 link
    if (interaction.action === 'url' && isSafeInteractionUrl(interaction.url)) {
      window.open(interaction.url!.trim(), '_blank', 'noopener,noreferrer');
      return;
    }
    const hasConfiguredPopup = interaction.action === 'popup' && getPopups(el).some((popup) => popup.enabled !== false && popup.target && projectData.scenes[popup.target]);
    if (interaction.target || hasConfiguredPopup) {
      if (interaction.action === 'popup') {
        // 銆愪慨澶嶃€戦€€鍦哄姩鐢昏繘琛屼腑蹇界暐寮圭獥瑙﹀彂锛氭棫鍦烘櫙姝ｅ湪娑堝け锛屾鏃舵墦寮€寮圭獥浼氳
        // 闅忓悗鐨勫満鏅垏鎹㈢珛鍗冲叧闂紙B2 鑱斿姩锛夛紝閫犳垚銆屽垰鎵撳紑灏辫鍏炽€嶇殑绐佸厐浣撻獙銆?
        // 绛夊緟鏈鍒囨崲瀹屾垚鍚庡啀瑙﹀彂鍗冲彲姝ｅ父鎵撳紑銆?

        if (sceneExiting) return;
        const configuredPopups = getPopups(el).filter((popup) => popup.enabled !== false && popup.target && projectData.scenes[popup.target]);
        const primaryPopup = configuredPopups[0];
        if (!primaryPopup) return;
        const primaryConfig = resolvePopupPresentation(el, primaryPopup);
        const display = primaryConfig.popupDisplay || 'modal';
        // 銆愭柊澧炪€戞墦寮€鏂板脊绐楁椂閲嶇疆閫€鍑哄姩鐢荤姸鎬侊紝闃叉涓婁竴寮圭獥鐨勯€€鍑哄姩鐢绘畫鐣?
        setPopupClosing(false);
        if (popupCloseTimerRef.current) {
          window.clearTimeout(popupCloseTimerRef.current);
          popupCloseTimerRef.current = null;
        }
        clearPopupSequenceTimers();
        clearSecondaryPopupCloseTimers();
        const primaryRuntimeId = `${el.id}:${primaryPopup.id}`;
        const retainedPopups = [
          ...(activePopupSceneId && activePopupTriggerElement && isLongLivedPopup(activePopupTriggerElement)
            ? [{
              id: String((activePopupTriggerElement as SceneElement & { popupRuntimeId?: string }).popupRuntimeId || activePopupTriggerElement.id),
              target: activePopupSceneId,
              config: activePopupTriggerElement as unknown as Record<string, any>,
            }]
            : []),
          ...secondaryPopups.filter((popup) => isLongLivedPopup(popup.config)),
        ].filter((popup, index, all) =>
          popup.id !== primaryRuntimeId && all.findIndex((item) => item.id === popup.id) === index,
        );
        setActivePopupSceneId(primaryPopup.target!);
        setActivePopupTriggerElement({ ...primaryConfig, link: primaryPopup.target, popupRuntimeId: primaryRuntimeId } as SceneElement);
        const additionalPopups = configuredPopups.slice(1).map((popup) => {
          const runtimeId = `${el.id}:${popup.id}`;
          return {
            id: runtimeId,
            target: popup.target!,
            config: { ...resolvePopupPresentation(el, popup), popupRuntimeId: runtimeId },
          };
        }).filter((popup) => !retainedPopups.some((retained) => retained.id === popup.id));
        setSecondaryPopups(retainedPopups);
        if (el.popupOpenMode === 'sequence') {
          additionalPopups.forEach((popup, index) => {
            const timer = window.setTimeout(() => {
              setSecondaryPopups((current) => current.some((item) => item.id === popup.id) ? current : [...current, popup]);
            }, (index + 1) * 350);
            popupSequenceTimersRef.current.push(timer);
          });
        } else {
          setSecondaryPopups([...retainedPopups, ...additionalPopups]);
        }
        if (display === 'popover' || display === 'inline') {
          // 璁板綍鐑偣閿氱偣浣嶇疆锛堟诞灞傚崱鐗?/ 鍘熷湴灞曞紑瀹氫綅鐢級
          const dom = document.getElementById(el.id);
          if (dom) {
            const r = dom.getBoundingClientRect();
            setPopoverAnchor({ x: r.left, y: r.top, w: r.width, h: r.height });
          }
          if (display === 'inline') {
            setInlineActiveElementId(el.id);
          }
        }

      } else {
        // 銆愭柊澧炪€戝厓绱犵骇鍦烘櫙鍒囨崲杩涘嚭鍦哄姩鐢昏鐩栵紙鐩存帴鍒囨崲鍦烘櫙鏃剁敓鏁堬級
        const override: SceneTransitionOverride | undefined =
          el.linkEnterAnim !== undefined || el.linkExitAnim !== undefined || el.linkAnimDuration !== undefined
            ? { enterAnim: el.linkEnterAnim, exitAnim: el.linkExitAnim, duration: el.linkAnimDuration }
            : undefined;
        onSelectScene(interaction.target, override);
      }
    } else if (interaction.url) {
      // 鍏煎锛氫粎璁剧疆 linkUrl 鐨勫満鏅?

      if (isSafeInteractionUrl(interaction.url)) {
        window.open(interaction.url.trim(), '_blank', 'noopener,noreferrer');
      }
    }
  };

  // 鎮仠瑙﹀彂锛氱Щ鍏ュ厓绱犲悗鍋滅暀 hoverDelay 绉掓墽琛岃烦杞紙闃茶瑙︼級锛岀Щ鍑哄嵆鍙栨秷
  /** Execute a preset action configured on an official UI button. */
  const handleUiComponentAction = (el: SceneElement, action: string) => {
    if (!isInteractionPreview || !action || action === 'none') return;
    const data = el.uiComponentData || {};
    const updateActionState = (status: string, extra: Record<string, unknown> = {}) => {
      onUpdateElement(el.id, {
        uiComponentData: {
          ...data,
          ...extra,
          pressed: !Boolean(data.pressed),
          lastAction: action,
          actionStatus: status,
          actionAt: Date.now(),
        },
      }, '执行组件预设动作', false);
    };

    if (action === 'navigate') {
      const target = String(data.actionTarget || resolveInteraction(el).target || el.link || '').trim();
      if (target && projectData.scenes[target]) {
        updateActionState(`正在跳转至 ${projectData.scenes[target].alias || target}`);
        onSelectScene(target);
      } else {
        updateActionState('未配置跳转目标');
        onToast?.('按钮动作“跳转”未配置有效的目标场景');
      }
      return;
    }

    if (action === 'submit') {
      const feedback = String(data.submitFeedback || '已提交');
      updateActionState(feedback, { submittedAt: Date.now() });
      onToast?.(feedback);
      return;
    }

    if (action === 'close') {
      const primaryCanClose = Boolean(activePopupSceneId && activePopupTriggerElement && !isLongLivedPopup(activePopupTriggerElement));
      if (primaryCanClose) {
        updateActionState('已关闭');
        closePopup();
        return;
      }
      const secondary = [...secondaryPopups].reverse().find((popup) => !isLongLivedPopup(popup.config));
      if (secondary) {
        updateActionState('已关闭');
        closeSecondaryPopup(secondary.id);
        return;
      }
      updateActionState('当前没有可关闭的弹窗');
      onToast?.('当前没有可关闭的弹窗');
      return;
    }

    if (action === 'toggle') {
      updateActionState(Boolean(data.pressed) ? '已切换为开启' : '已切换为关闭');
      return;
    }

    updateActionState(`已执行：${action}`);
  };

  const triggerElement = (el: SceneElement) => {
    if (!isInteractionPreview) return;
    const motion = el.hoverEffect;
    if (!motion || !isDirectMorphMotion(motion)) {
      handleElementTrigger(el);
      return;
    }

    const run = ++triggerRunRef.current;
    void playDirectMorph(el).then(() => {
      if (run === triggerRunRef.current) handleElementTrigger(el);
    });
  };

  const handleTextHotspotTrigger = (element: SceneElement, hotspotId: string) => {
    if (!isInteractionPreview) return;
    const hotspot = element.textHotspots?.find((item) => item.id === hotspotId);
    if (!hotspot) return;
    const interaction = resolveInteraction(hotspot);
    if (interaction.action === 'none') return;
    triggerElement({
      ...element,
      link: interaction.target,
      linkType: interaction.action === 'popup' ? 'popup' : interaction.action === 'url' ? 'url' : 'jump',
      linkUrl: interaction.url,
      interaction,
      popups: interaction.action === 'popup' && interaction.target
        ? [{ id: `text-hotspot-popup-${hotspot.id}`, target: interaction.target, enabled: true }]
      : element.popups,
    });
  };

  const handleTextHotspotTriggerFromSurface = (element: SceneElement, hotspotId: string) => {
    textHotspotClickRef.current = { elementId: element.id, hotspotId };
    queueMicrotask(() => {
      if (textHotspotClickRef.current?.elementId === element.id && textHotspotClickRef.current.hotspotId === hotspotId) {
        textHotspotClickRef.current = null;
      }
    });
    handleTextHotspotTrigger(element, hotspotId);
  };

  const handleCanvasMouseUp = useCallback(() => {
    // This bubbles even when the state-driven window listener was mounted too
    // late for a short click released inside the canvas.
    transformReleaseGuardRef.current?.();
    if (panGestureRef.current) {
      panGestureRef.current = null;
      panSessionRef.current = null;
      setIsPanning(false);
    }
  }, []);

  const clearPointerGesture = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressElementRef.current = null;
    gestureRef.current = null;
  }, []);

  const handleElementPointerDown = (event: React.PointerEvent<HTMLDivElement>, el: SceneElement) => {
    if (!isInteractionPreview) return;
    const interaction = resolveInteraction(el);
    if (interaction.trigger !== 'long-press' && interaction.trigger !== 'swipe-direction') return;
    event.stopPropagation();
    if (event.pointerType !== 'mouse') event.preventDefault();
    clearPointerGesture();
    gestureRef.current = {
      pointerId: event.pointerId,
      elementId: el.id,
      x: event.clientX,
      y: event.clientY,
      trigger: interaction.trigger,
    };
    if (interaction.trigger === 'long-press') {
      longPressElementRef.current = el.id;
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        longPressElementRef.current = null;
        suppressClickRef.current = true;
        gestureRef.current = null;
        triggerElement(el);
      }, 520);
    }
  };

  const handleElementPointerMove = (event: React.PointerEvent<HTMLDivElement>, el: SceneElement) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.elementId !== el.id || gesture.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    if (gesture.trigger === 'long-press' && distance > 12) clearPointerGesture();
  };

  const handleElementPointerEnd = (event: React.PointerEvent<HTMLDivElement>, el: SceneElement) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.elementId !== el.id || gesture.pointerId !== event.pointerId) return;
    if (gesture.trigger === 'swipe-direction') {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= 36) {
        suppressClickRef.current = true;
        triggerElement(el);
      }
    }
    clearPointerGesture();
  };

  /** Adapts a progress node into the existing scene action and popup runtime. */
  const handleContinuousInteractionNode = (element: SceneElement, node: ContinuousInteractionNode) => {
    const action = node.interaction;
    if (!action || !action.action || action.action === 'none') return;
    const continuousConfig = normalizeContinuousInteraction(element.uiComponentData?.continuousInteraction as ContinuousInteractionConfig | undefined);
    const popupIndex = Math.max(0, continuousConfig.nodes
      .filter((item) => item.interaction?.action === 'popup' && item.interaction.target)
      .findIndex((item) => item.id === node.id));
    const popup = action.action === 'popup' && action.target
      ? [resolveContinuousNodePopup(node, popupIndex)]
      : element.popups;
    handleElementTrigger({
      ...element,
      link: action.target,
      linkType: action.action === 'popup' ? 'popup' : action.action === 'jump' ? 'jump' : action.action === 'url' ? 'url' : element.linkType,
      popups: popup,
      interaction: {
        trigger: 'click',
        action: action.action,
        target: action.target,
        url: action.url,
        mediaRefId: action.mediaRefId,
        mediaType: action.mediaType,
        variableName: action.variableName,
        variableValue: action.variableValue,
      },
    });
  };

  const handleElementHoverIn = (el: SceneElement) => {
    // 銆愭柊澧炪€戣褰曟偓鍋滃厓绱狅紝鐢ㄤ簬 hover 鍙嶉鐗规晥锛堢紪杈?棰勮鍧囩敓鏁堬級
    setHoveredElementId(el.id);
    if (el.interactionEffect && el.interactionEffect !== 'none' && el.interactionEffectTrigger === 'hover') {
      playInteractionEffect(el);
    }
    const interaction = resolveInteraction(el);
    if (isDirectMorphMotion(el.hoverEffect || '') && (!isInteractionPreview || (interaction.trigger === 'hover' && interaction.action === 'none'))) {
      void playDirectMorph(el);
    }
    if (!isInteractionPreview) return;
    if (interaction.trigger !== 'hover') return;
    if (interaction.action === 'none') return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      triggerElement(el);
    }, interaction.hoverDelay * 1000);
  };

  const handleElementHoverOut = (el?: SceneElement) => {
    // 銆愭柊澧炪€戞竻闄ゆ偓鍋滃弽棣堢姸鎬?    setHoveredElementId(null);
    if (el?.interactionEffect && el.interactionEffect !== 'none' && el.interactionEffectTrigger === 'hover') {
      interactionEffectRunRef.current += 1;
      if (interactionEffectRafRef.current !== null) cancelAnimationFrame(interactionEffectRafRef.current);
      interactionEffectRafRef.current = null;
      if (interactionEffectTimerRef.current !== null) window.clearTimeout(interactionEffectTimerRef.current);
      interactionEffectTimerRef.current = null;
      setInteractionEffectState((current) => current.elementId === el.id
        ? { ...current, elementId: null, effect: null, progress: 0 }
        : current);
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 銆愪慨澶嶃€慼over 瑙﹀彂鎵撳紑鐨?popover / inline 寮圭獥锛氶紶鏍囩Щ鍑鸿Е鍙戝厓绱犲嵆鑷姩鍏抽棴锛坱ooltip 寮忛棴鐜級锛?
    // 浠呭 trigger === 'hover' 鐨勫厓绱犵敓鏁堚€斺€旂偣鍑昏Е鍙戠殑寮圭獥涓嶅彈褰卞搷锛屽惁鍒欏脊绐楁墦寮€鍚?fixed 瑕嗙洊灞?
    // 瑕嗙洊灞忓箷瀵艰嚧娴忚鍣ㄩ噸绠?hit-test銆佽Е鍙?mouseleave锛屼細鎶婂垰鐐瑰紑鐨勫脊绐楃珛鍗宠鍏筹紙鐪熷疄鐐瑰嚮 BUG锛夈€?
    // modal锛堟湁閬僵鐨勬ā鎬佹锛変笉鑷姩鍏筹紝淇濈暀鐐归伄缃?/ 鍏抽棴鎸夐挳鎵嬪姩鍏抽棴锛岄伩鍏嶈鍏炽€?

    const triggerEl = activePopupTriggerElement;
    if (isInteractionPreview && triggerEl && el && triggerEl.id === el.id && triggerEl.trigger === 'hover') {
      const display = triggerEl.popupDisplay || 'modal';
      if (display === 'popover' || display === 'inline') {
        closePopup();
      }
    }
  };

  // Next / Prev scene navigation锛堝彧鍦ㄣ€岀敾甯冨満鏅€嶅簭鍒椾腑缈婚〉锛屽脊绐?UI 鍦烘櫙涓嶅弬涓庯級
  const loopSceneKeys = getLoopableSceneKeys(projectData.scenes);
  const currentSceneIndex = loopSceneKeys.indexOf(activeSceneId);

  const goToNextScene = () => {
    if (loopSceneKeys.length === 0) return;
    // currentSceneIndex=-1锛堝綋鍓嶄负寮圭獥鍦烘櫙锛夆啋 浠庣涓€涓敾甯冨満鏅紑濮?

    const nextIdx = (currentSceneIndex + 1 + loopSceneKeys.length) % loopSceneKeys.length;
    onSelectScene(loopSceneKeys[nextIdx]);
  };

  const goToPrevScene = () => {
    if (loopSceneKeys.length === 0) return;
    // currentSceneIndex=-1锛堝綋鍓嶄负寮圭獥鍦烘櫙锛夆啋 缈诲埌鏈€鍚庝竴涓敾甯冨満鏅?

    const idx = currentSceneIndex === -1 ? loopSceneKeys.length : currentSceneIndex;
    const prevIdx = (idx - 1 + loopSceneKeys.length) % loopSceneKeys.length;
    onSelectScene(loopSceneKeys[prevIdx]);
  };

  // Helper to compute scene-level transition animation styles
  const getSceneTransitionAnimation = (scene?: typeof activeScene, isExiting: boolean = false, useOverride: boolean = true) => {
    if (!scene) return 'none';
    // 鍏冪礌绾ц繘鍑哄満鍔ㄧ敾瑕嗙洊锛坙inkEnterAnim / linkExitAnim / linkAnimDuration锛変紭鍏堜簬鍦烘櫙绾ц浆鍦鸿缃€?
    // 寮圭獥鍐呭灞備紶 useOverride=false锛氬脊绐楄浆鍦哄彧璺熼殢寮圭獥鍦烘櫙鑷韩璁剧疆锛屼笉鍙椾富鑸炲彴瑕嗙洊姹℃煋銆?

    const ovr = useOverride ? sceneTransitionOverride : null;
    const duration = ovr?.duration ?? scene.transitionDuration ?? 0.6;
    const easing = scene.transitionEasing || 'cubic-bezier(0.25, 0.1, 0.25, 1)';
    if (isExiting) {
      const transOut = ovr && ovr.exitAnim !== undefined ? ovr.exitAnim : scene.transitionOut;
      // 銆愪慨澶嶃€戝彧鏈夋樉寮忚缃负 'none' 鎵嶈〃绀烘棤閫€鍦哄姩鐢伙紱鏈厤缃紙undefined锛夋椂榛樿娣″嚭锛?
      // 淇濊瘉鎵€鏈夊満鏅垏鎹㈤兘鏈夈€屽嚭鍦鸿浆鍦恒€嶅姩鐢伙紙鏃у伐绋嬫暟鎹?鏈缃浆鍦虹殑鍦烘櫙鍚屾牱鐢熸晥锛?

      if (transOut === 'none') return 'none';
      const effTransOut = transOut || 'fade';
      switch (effTransOut) {
        case 'fade':
          return `scene-trans-fade-out ${duration}s ${easing} forwards`;
        case 'slide-left':
          return `scene-trans-slide-left-out ${duration}s ${easing} forwards`;
        case 'slide-right':
          return `scene-trans-slide-right-out ${duration}s ${easing} forwards`;
        case 'slide-up':
          return `scene-trans-slide-up-out ${duration}s ${easing} forwards`;
        case 'slide-down':
          return `scene-trans-slide-down-out ${duration}s ${easing} forwards`;
        case 'zoom-out':
          return `scene-trans-zoom-out-exit ${duration}s ${easing} forwards`;
        case 'dissolve':
          return `scene-trans-dissolve-out ${duration}s ${easing} forwards`;
        case 'flip-3d':
          return `scene-trans-flip-3d-out ${duration}s ${easing} forwards`;
        case 'cube-3d':
          return `scene-trans-cube-3d-out ${duration}s ${easing} forwards`;
        case 'soft-wipe':
          return `scene-trans-soft-wipe-out ${duration}s ${easing} forwards`;
        case 'radial-reveal':
          return `scene-trans-radial-reveal-out ${duration}s ${easing} forwards`;
        case 'diagonal-curtain':
          return `scene-trans-diagonal-curtain-out ${duration}s ${easing} forwards`;
        case 'blur-dissolve':
          return `scene-trans-blur-dissolve-out ${duration}s ${easing} forwards`;
        default:
          return 'none';
      }
    }

    const transIn = ovr && ovr.enterAnim !== undefined ? ovr.enterAnim : (scene.transitionIn || 'fade');
    if (transIn === 'none') return 'none';

    switch (transIn) {
      case 'fade':
        return `scene-trans-fade-in ${duration}s ${easing} forwards`;
      case 'slide-left':
        return `scene-trans-slide-left-in ${duration}s ${easing} forwards`;
      case 'slide-right':
        return `scene-trans-slide-right-in ${duration}s ${easing} forwards`;
      case 'slide-up':
        return `scene-trans-slide-up-in ${duration}s ${easing} forwards`;
      case 'slide-down':
        return `scene-trans-slide-down-in ${duration}s ${easing} forwards`;
      case 'zoom-in':
        return `scene-trans-zoom-in ${duration}s ${easing} forwards`;
      case 'zoom-out':
        return `scene-trans-zoom-out ${duration}s ${easing} forwards`;
      case 'dissolve':
        return `scene-trans-dissolve-in ${duration}s ${easing} forwards`;
      case 'flip-3d':
        return `scene-trans-flip-3d-in ${duration}s ${easing} forwards`;
      case 'cube-3d':
        return `scene-trans-cube-3d-in ${duration}s ${easing} forwards`;
      case 'glitch':
        return `scene-trans-glitch ${duration}s steps(5, end) forwards`;
      case 'wipe-right':
        return `scene-trans-wipe-right-in ${duration}s ${easing} forwards`;
      case 'soft-wipe':
        return `scene-trans-soft-wipe-in ${duration}s ${easing} forwards`;
      case 'radial-reveal':
        return `scene-trans-radial-reveal-in ${duration}s ${easing} forwards`;
      case 'diagonal-curtain':
        return `scene-trans-diagonal-curtain-in ${duration}s ${easing} forwards`;
      case 'blur-dissolve':
        return `scene-trans-blur-dissolve-in ${duration}s ${easing} forwards`;
      default:
        return 'none';
    }
  };

  const getTransitionOverlayAnimation = () => {
    if (!transitionOverlay || transitionOverlay.sourceSceneId === activeSceneId) return 'none';
    const duration = transitionOverlay.duration;
    const easing = transitionOverlay.easing || 'cubic-bezier(0.25, 0.1, 0.25, 1)';
    switch (transitionOverlay.exitAnimation || 'fade') {
      case 'slide-left': return `scene-trans-slide-left-out ${duration}s ${easing} forwards`;
      case 'slide-right': return `scene-trans-slide-right-out ${duration}s ${easing} forwards`;
      case 'slide-up': return `scene-trans-slide-up-out ${duration}s ${easing} forwards`;
      case 'slide-down': return `scene-trans-slide-down-out ${duration}s ${easing} forwards`;
      case 'zoom-out': return `scene-trans-zoom-out-exit ${duration}s ${easing} forwards`;
      case 'dissolve': return `scene-trans-dissolve-out ${duration}s ${easing} forwards`;
      case 'flip-3d': return `scene-trans-flip-3d-out ${duration}s ${easing} forwards`;
      case 'cube-3d': return `scene-trans-cube-3d-out ${duration}s ${easing} forwards`;
      case 'soft-wipe': return `scene-trans-soft-wipe-out ${duration}s ${easing} forwards`;
      case 'radial-reveal': return `scene-trans-radial-reveal-out ${duration}s ${easing} forwards`;
      case 'diagonal-curtain': return `scene-trans-diagonal-curtain-out ${duration}s ${easing} forwards`;
      case 'blur-dissolve': return `scene-trans-blur-dissolve-out ${duration}s ${easing} forwards`;
      default: return `scene-trans-fade-out ${duration}s ${easing} forwards`;
    }
  };

  // 銆愮粺涓€銆戝厓绱犵骇杩涘嚭鍦?+ 寰幆鍔ㄧ敾璁＄畻銆?
  // 椤跺眰鍏冪礌涓庡悎骞跺浘灞傜粍鐨勫瓙鍥惧眰鍏辩敤姝ゅ嚱鏁帮細瀛愬浘灞傛部鐢ㄨ嚜韬?startTime/duration/animType/exitAnimType/loopAnim锛?
  // 淇濊瘉"鍚堝苟鍚庢挱鏀鹃€昏緫涓庢媶寮€鍓嶅畬鍏ㄤ竴鑷?锛堝悇瀛愬浘灞備粛鎸夎嚜宸辩殑鏃堕棿杞村叆鍦?鍑哄満/寰幆锛夈€?

  const computeElementAnim = (el: SceneElement, t: number, inRange: boolean) => {
    const hasAnim = (el.animType && el.animType !== 'none') || (el.exitAnimType && el.exitAnimType !== 'none') || (el.loopAnim && el.loopAnim !== 'none');
    const hasKeyframes = Boolean(el.keyframes?.tracks?.length);
    if (!hasAnim && !hasKeyframes) {
      return {
        computedOpacity: inRange ? Math.max(0, Math.min(1, (el.opacity ?? 100) / 100)) : 0,
        scale: 1,
        brightness: 1,
        slideX: 0,
        slideY: 0,
        animRotY: 0,
        animBlur: 0,
      };
    }

    // Keep interaction preview in sync with the editor renderer. Opacity is a
    // scene-time property, so evaluate it at the actual render time before
    // applying entrance/exit/loop animation multipliers below.
    const animatedOpacity = evaluateAnimatedProperty(
      el,
      'opacity',
      t,
      el.opacity ?? 100,
    );
    let computedOpacity = Math.max(0, Math.min(1, animatedOpacity / 100));
    let scale = 1;
    let brightness = 1;
    let slideX = 0;
    let slideY = 0;
    let animRotY = 0;
    let animBlur = 0;

    // A paused interaction preview is still a usable surface.  Its first
    // frame must show authored text, controls and custom-code layers instead
    // of leaving every entrance animation at progress 0 until Play is pressed.
    const previewTime = !isEditing && !isPlaying
      ? Math.max(t, (el.startTime || 0) + (el.animDur || 0.6))
      : t;

    if (inRange) {
      const elStart = Number.isFinite(el.startTime) ? Math.max(0, el.startTime) : 0;
      // Older nested/imported layers can omit duration. Match the scheduler's
      // resilient default instead of turning their exit opacity into zero.
      const elDur = Number.isFinite(el.duration) && (el.duration || 0) > 0
        ? el.duration
        : 5;
      const relTime = previewTime - elStart;
      const inDur = el.animDur || 0.6;
      const outDur = el.exitAnimDur || 0.5;
      const relOut = elStart + elDur - previewTime;
      // Exit animation takes priority when the element is about to leave
      if (relOut < outDur && el.exitAnimType && el.exitAnimType !== 'none') {
        const p = Math.max(0, Math.min(1, relOut / outDur));
        switch (el.exitAnimType) {
          case 'fade-out':
            computedOpacity *= p;
            break;
          case 'slide-down':
            slideY = (1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'slide-up':
            slideY = -(1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'slide-left':
            slideX = -(1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'slide-right':
            slideX = (1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'zoom-out':
            scale = 0.6 + 0.4 * p;
            computedOpacity *= p;
            break;
          case 'zoom-in':
            scale = 1.4 - 0.4 * p;
            computedOpacity *= p;
            break;
          case 'fade-zoom':
            scale = 0.7 + 0.3 * p;
            computedOpacity *= p;
            break;
          case 'rotate-out':
            animRotY += (1 - p) * 140;
            computedOpacity *= p;
            break;
          case 'blur-out':
            animBlur = (1 - p) * 16;
            computedOpacity *= p;
            break;
          case 'bounce-out':
            if (p > 0.55) {
              const q = (p - 0.55) / 0.45;
              scale = 1 - q * 0.35;
              computedOpacity *= Math.max(0, 1 - q * 1.3);
            } else {
              const q = p / 0.55;
              slideY = -Math.sin(q * Math.PI) * 42 * (1 - p);
            }
            break;
          case 'flip-out':
            animRotY += (1 - p) * 180;
            computedOpacity *= p;
            break;
          case 'dissolve-out':
            computedOpacity *= Math.pow(p, 2.2);
            break;
          /* ===== 绉戞妧路绠€绾?鍑哄満鍔ㄦ晥 ===== */
          case 'neon-out':
            // 闇撹櫣娑堟暎锛氭ā绯婂澶?+ 鍙樻殫 + 娑堟暎锛岄湏铏圭伅鐔勭伃鎰?
            animBlur = (1 - p) * 18;
            brightness *= (0.3 + 0.7 * p);
            computedOpacity *= p;
            break;
          case 'particle-out':
            // 绮掑瓙鐡﹁В锛氭斁澶?+ 妯＄硦 + 閫忔槑锛屽儚绮掑瓙鏁ｅ紑
            scale = 1 + (1 - p) * 0.35;
            animBlur = (1 - p) * 14;
            computedOpacity *= Math.pow(p, 1.6);
            break;
          case 'hologram-out':
            // 鍏ㄦ伅鍏抽棴锛氫笅娌?+ 闂儊 + 妯＄硦娑堟暎
            slideY = (1 - p) * 40;
            animBlur = (1 - p) * 10;
            computedOpacity *= p * (0.7 + 0.3 * Math.abs(Math.sin(p * Math.PI * 6)));
            break;
          case 'scan-out':
            // 涓婃壂閫€鍑猴細鍚戜笂鎵嚭 + 鍙樻殫锛屾壂鎻忔敹鍦?
            slideY = -(1 - p) * 80;
            brightness *= (0.6 + 0.4 * p);
            computedOpacity *= p;
            break;
        }
      } else if (relTime < inDur && el.animType && el.animType !== 'none') {
        const p = Math.max(0, Math.min(1, relTime / inDur));
        switch (el.animType) {
          case 'fade-in':
            computedOpacity *= p;
            break;
          case 'zoom-in':
            scale = 0.4 + 0.6 * p;
            computedOpacity *= p;
            break;
          case 'zoom-out':
            scale = 1.3 - 0.3 * p;
            computedOpacity *= p;
            break;
          case 'slide-up':
            slideY = (1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'slide-down':
            slideY = -(1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'slide-left':
            slideX = -(1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'slide-right':
            slideX = (1 - p) * 60;
            computedOpacity *= p;
            break;
          case 'elastic-pop':
            scale = 0.4 + 0.9 * (1 - Math.pow(1 - p, 3)) * (1 + Math.sin(p * Math.PI * 4) * 0.15);
            break;
          case 'flip-3d':
            animRotY = (1 - p) * 90;
            computedOpacity *= p;
            break;
          case 'glitch':
            computedOpacity *= Math.random() > 0.3 ? 1 : 0.4;
            break;
          case 'rotate-in':
            animRotY = -(1 - p) * 180;
            computedOpacity *= p;
            break;
          case 'bounce-in':
            if (p < 0.7) {
              const q = p / 0.7;
              scale = 0.3 + 0.9 * (1 - Math.pow(1 - q, 2));
            } else {
              const q = (p - 0.7) / 0.3;
              scale = 1 + Math.sin(q * Math.PI * 2) * 0.08 * (1 - q);
            }
            computedOpacity *= p;
            break;
          case 'blur-in':
            animBlur = (1 - p) * 16;
            computedOpacity *= p;
            break;
          case 'tilt-in':
            animRotY = (1 - p) * 45;
            scale = 0.75 + 0.25 * p;
            computedOpacity *= p;
            break;
          case 'fade-blur-in':
            animBlur = (1 - p) * 12;
            computedOpacity *= p;
            break;
          /* ===== 绉戞妧路绠€绾?鍔ㄦ晥锛堝€熼壌閲戝睘璐ㄦ劅/闇撹櫣/鍏ㄦ伅/绮掑瓙瑙傛劅锛?===== */
          case 'neon-glow-in':
            // 闇撹櫣杈夊厜锛氱敱鏆楀埌浜?+ 妯＄硦鍒版竻鏅?+ 杞诲井鏀惧ぇ锛岄湏铏圭伅绠＄偣浜劅
            animBlur = (1 - p) * 14;
            brightness *= (0.35 + 0.65 * p);
            scale *= (0.96 + 0.04 * p);
            computedOpacity *= p;
            break;
          case 'scan-reveal':
            // 鎵弿鏄剧幇锛氶《閮ㄦ壂鎻忕嚎鍘嬩笅 + 鐢辨殫鍒颁寒锛岀鎶€鎵弿寮€鍦?
            slideY = -(1 - p) * 90;
            brightness *= (0.55 + 0.45 * p);
            computedOpacity *= p;
            break;
          case 'hologram-in':
            // 鍏ㄦ伅鎶曞奖锛氬簳閮ㄥ崌璧?+ 绉戞妧闂儊 + 寰ā绯婏紝鍏ㄦ伅鎴愬儚鎰?
            slideY = (1 - p) * 40;
            animBlur = (1 - p) * 8;
            computedOpacity *= p * (0.7 + 0.3 * Math.abs(Math.sin(p * Math.PI * 5)));
            break;
          case 'stardust-in':
            // 鏄熷皹鑱氭嫝锛氫粠鏀惧ぇ妯＄硦鐨勬暎鐐硅仛鎷㈡垚娓呮櫚瀹炲儚锛岀矑瀛愭眹鑱氭劅
            scale *= (1.28 - 0.28 * p);
            animBlur = (1 - p) * 12;
            computedOpacity *= p;
            break;
          case 'energy-pop':
            // 鑳介噺杩稿彂锛氬脊鎬ф斁澶?+ 楂樹寒闂厜锛岄€傚悎鎸夐挳/閲嶇偣鍏冪礌
            scale *= 0.5 + 0.9 * (1 - Math.pow(1 - p, 3)) * (1 + Math.sin(p * Math.PI * 4) * 0.12);
            brightness *= (1.7 - 0.7 * p);
            computedOpacity *= p;
            break;
          case 'perspective-in':
            // 绾垫繁鎷夎繎锛?D 閫忚鏃嬭浆 + 缂╂斁浠庤繙澶勬媺杩戯紝绾垫繁鎰熷己
            animRotY += (1 - p) * 30;
            scale *= (1.3 - 0.3 * p);
            animBlur = (1 - p) * 6;
            computedOpacity *= p;
            break;
        }
      }

      // Loop Animation
      if (el.loopAnim && el.loopAnim !== 'none') {
        const speed = el.loopAnimSpeed || 1;
        const phase = (getLoopAnimationTime(el, t) * speed * Math.PI * 2);
        switch (el.loopAnim) {
          case 'pulse':
            scale *= (1 + Math.sin(phase) * 0.06);
            break;
          case 'float':
            scale *= (1 + Math.sin(phase * 0.5) * 0.04);
            break;
          case 'spin':
            animRotY += Math.sin(phase * 0.5) * 8;
            break;
          case 'shimmer':
            brightness *= (1 + Math.sin(phase) * 0.4);
            break;
          case 'breathe':
            scale *= (1 + Math.sin(phase * 0.5) * 0.05);
            computedOpacity *= (1 + Math.sin(phase * 0.5) * 0.1);
            break;
          case 'swing':
            animRotY += Math.sin(phase * 0.5) * 11;
            break;
          case 'shake':
            slideX += Math.sin(phase * 3) * 6;
            break;
          case 'heartbeat':
            scale *= (1 + Math.pow(Math.abs(Math.sin(phase)), 2) * 0.14);
            break;
          case 'blink':
            computedOpacity *= (0.45 + 0.55 * Math.abs(Math.sin(phase * 2)));
            break;
          case 'wave':
            slideY += Math.sin(phase) * 8;
            break;
          /* ===== 绉戞妧路绠€绾?寰幆鍔ㄦ晥 ===== */
          case 'neon-pulse':
            // 闇撹櫣鑴夊姩锛氫寒搴﹀己鑴夊啿 + 杞诲井缂╂斁锛岄湏铏圭伅鍛煎惛鎰?
            brightness *= (1 + Math.sin(phase) * 0.25);
            scale *= (1 + Math.sin(phase) * 0.04);
            break;
          case 'data-flow':
            // 鏁版嵁娴佸姩锛氫寒搴︾紦鎱㈡祦鍔紝鑳介噺鍦ㄥ厓绱犲唴缂撶紦绌胯
            brightness *= (1 + Math.sin(phase * 0.5) * 0.15);
            break;
          case 'hologram-flicker':
            // 鍏ㄦ伅闂儊锛氬揩閫熼棯鐑?+ 寰紓绉伙紝鍏ㄦ伅鎶曞奖涓嶇ǔ瀹氭劅
            computedOpacity *= (0.72 + 0.28 * Math.abs(Math.sin(phase * 3)));
            slideY += Math.sin(phase * 1.5) * 2;
            break;
          case 'orbit-spin':
            // 杞ㄩ亾鏃嬭浆锛氭寔缁?3D 鏃嬭浆
            animRotY += phase * 0.9;
            break;
        }
      }
    }
    return { computedOpacity, scale, brightness, slideX, slideY, animRotY, animBlur };
  };

  // 銆愬祵濂楀悎骞躲€戞覆鏌撳悎骞跺浘灞傜粍锛坱ype='group'锛夊唴閮ㄧ殑瀛愬浘灞傘€?
  // 瀛愬浘灞傚潗鏍?= 鐩稿瀹瑰櫒宸︿笂瑙掔殑鐧惧垎姣旓紱鍍忕礌鍊硷紙瀛楀彿绛夛級鎸夊鍣ㄧ缉鏀炬瘮渚嬭窡闅忥紝
  // 淇濊瘉缂栫粍鏃惰瑙変笌鎷嗗紑鍚庡畬鍏ㄤ竴鑷淬€佸鍣ㄦ暣浣撶缉鏀炬椂鍐呭绛夋瘮缂╂斁銆?

  const renderGroupContent = (g: SceneElement) => {
    const children = g.children || [];
    const scaleK = g.w && g.mergeBaseW ? Math.max(0.01, g.w / g.mergeBaseW) : 1;
    return (
      <>
        {isEditing && (
          <div
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{ border: `1px dashed ${g.componentInstance ? 'rgba(34, 211, 238, 0.5)' : 'rgba(129,140,248,0.45)'}`, boxShadow: 'inset 0 0 0 1px rgba(129,140,248,0.12)' }}
          />
        )}
        {children.map((child) => {
          if (child.visible === false) return null;
          // 瀛愬浘灞傛部鐢ㄨ嚜韬椂闂寸獥锛坈hildren 淇濈暀鍚堝苟鍓嶇殑缁濆 startTime/duration锛夛細
          // 鎾斁/棰勮妯″紡涓ユ牸鎸夊悇鑷?[startTime, startTime+duration] 鏄剧ず/闅愯棌锛屼笌鎷嗗紑鍓嶄竴鑷淬€?

          const cStart = Number.isFinite(child.startTime)
            ? Math.max(0, child.startTime)
            : (Number.isFinite(g.startTime) ? Math.max(0, g.startTime) : 0);
          const cDur = Number.isFinite(child.duration) && (child.duration || 0) > 0
            ? child.duration
            : (Number.isFinite(g.duration) && (g.duration || 0) > 0
              ? g.duration
              : (Number.isFinite(activeScene?.duration) && (activeScene?.duration || 0) > 0 ? activeScene!.duration : 5));
          const childInRange = isTimelineTimeVisible(renderTime, cStart, cDur);
          const isPlayback = isInteractionPreview;
          if (!childInRange) return null;
          // 瀛愬浘灞傚叆鍦?鍑哄満/寰幆鍔ㄧ敾锛氫笌椤跺眰鍏冪礌鍏辩敤鍚屼竴濂楄绠?

          const cProperties = evaluateElementProperties(child, renderTime);
          const cAnim = computeElementAnim(child, renderTime, isPlayback ? childInRange : true);
          let cOpacity = Math.max(0, Math.min(1, cAnim.computedOpacity));
          // 缂栬緫妯″紡锛氳寖鍥村瀛愬浘灞傝交閲忓急鍖栨彁绀猴紙涓庨《灞傚厓绱?outOfRange 琛屼负涓€鑷达級
          if (!isInteractionPreview && !childInRange) cOpacity = Math.max(0.15, cOpacity * 0.55);
          const cTransform = `translate3d(${cAnim.slideX}px, ${cAnim.slideY}px, 0px) scale(${cAnim.scale}) rotateY(${cAnim.animRotY}deg) rotateZ(${cProperties.rot || 0}deg)`;
          const cFilter = [
            cAnim.brightness !== 1 ? `brightness(${cAnim.brightness})` : '',
            cAnim.animBlur > 0 ? `blur(${cAnim.animBlur}px)` : '',
          ].filter(Boolean).join(' ') || 'none';
          return (
            <div
              key={child.id}
              style={{
                position: 'absolute',
                left: `${cProperties.x}%`,
                top: `${cProperties.y}%`,
                width: `${cProperties.w}%`,
                height: `${cProperties.h}%`,
                transform: cTransform,
                transformOrigin: 'center center',
                zIndex: child.zIndex ?? 0,
                opacity: cOpacity,
                filter: cFilter,
                mixBlendMode: child.blendMode || 'normal',
                ...(child.type === 'txt' ? getTextStyle(child, { scale: scaleK }) : {}),
              }}
              className="flex items-center justify-center text-center select-none pointer-events-none"
            >
              {child.type === 'img' && child.refId && resolveImageUrl(child.refId) ? (
                <img src={resolveImageUrl(child.refId)} alt="" draggable={false}
                  className="block w-full h-full object-fill select-none rounded-[inherit]"
                  style={{ background: 'transparent', objectPosition: 'center center' }}
                  onError={(e) => { const t = e.target as HTMLImageElement; if (!t.dataset.failed) { t.dataset.failed = '1'; t.style.display = 'none'; } }} />
              ) : null}
              {child.type === 'vid' && child.refId && resolveVideoUrl(child.refId) ? (
                <video data-aether-video data-video-ref={child.refId} data-video-mode={child.vidMode || 'auto'} data-video-start-time={String(cStart)} data-video-loop={String(shouldRepeatVideo(child))} data-video-playback-count={String(getLayerPlaybackConfig(child).count)} src={resolveVideoUrl(child.refId)} preload="metadata" autoPlay={isPlaying} loop={shouldRepeatVideo(child)} muted={child.muted === true} controls={child.videoControls === true} data-player-style={child.videoPlayerStyle || 'none'} playsInline
                  onCanPlay={(event) => { if (isPlaying && event.currentTarget.paused && !event.currentTarget.ended) void event.currentTarget.play().catch(() => {}); }}
                  onPlay={(event) => { if (!isPlaying) event.currentTarget.pause(); }}
                  onEnded={handleLayerVideoEnded}
                  className={`w-full h-full object-fill rounded-[inherit] pointer-events-auto aether-video-player-${child.videoPlayerStyle || 'none'}`} />
              ) : null}
              {child.type === 'txt' && (
                <div className="w-full h-full flex items-center justify-center whitespace-pre-wrap" style={{ padding: `${((child.textPadding ?? 8) * scaleK).toFixed(1)}px` }}>
                  {child.content || ''}
                </div>
              )}
              {child.type === 'shape' && (
                <div className="relative w-full h-full" style={{
                  background: getShapeBackground(child),
                  clipPath: child.clipPath || undefined,
                  WebkitClipPath: child.clipPath || undefined,
                  padding: child.shapePadding !== undefined ? `${(child.shapePadding * scaleK).toFixed(1)}px` : undefined,
                }}>
                  {child.content && <div className="absolute inset-0 grid place-items-center whitespace-pre-wrap" style={{ ...getTextStyle(child, { color: child.textColor || child.color || '#ffffff', scale: scaleK, fontSize: child.fontSize || 16, defaultLineHeight: 1.1 }), padding: `${((child.shapePadding ?? 12) * scaleK).toFixed(1)}px`, boxSizing: 'border-box' }}>{child.content}</div>}
                </div>
              )}
              {(child.type === 'saber' || child.type === 'vfx') && (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${child.color || '#ff2d95'}, transparent)`, opacity: 0.75 }} />
              )}
              {child.type === 'chart' && <ChartElementView el={child} />}
               {child.type === 'ui-component' && (() => {
                 const childCustomProps = child.uiComponentData?.customProps || child.customCodeProps;
                 const childScale = childCustomProps?.size != null ? Number(childCustomProps.size) / 100 : 1;
                 const childGlow = childCustomProps?.glow != null ? Number(childCustomProps.glow) : 0;
                 const childGlowColor = childCustomProps?.color || child.uiComponentData?.color || '#38bdf8';
                 const childIsEnabled = childCustomProps?.enabled !== false;

                 const childStyle: React.CSSProperties = {
                   width: '100%',
                   height: '100%',
                   transform: childScale !== 1 ? `scale(${childScale})` : undefined,
                   transformOrigin: 'center center',
                   filter: childGlow > 0 ? `drop-shadow(0 0 ${childGlow * 0.18}px ${childGlowColor})` : undefined,
                   opacity: childIsEnabled ? 1 : 0.45,
                 };

                 const childData = {
                   ...(child.uiComponentData || {}),
                   ...(childCustomProps?.color ? { color: childCustomProps.color, accentColor: childCustomProps.color } : {}),
                   ...(childCustomProps?.value !== undefined ? { value: childCustomProps.value } : {}),
                   ...(childCustomProps?.label !== undefined ? { label: childCustomProps.label } : {}),
                   ...(childCustomProps?.speed !== undefined ? { speed: childCustomProps.speed } : {}),
                   ...(childCustomProps?.enabled !== undefined ? { motionEnabled: Boolean(childCustomProps.enabled) } : {}),
                 };

                 return (
                   <div style={childStyle}>
                     <LazyScaledUIComponent
                       type={child.uiComponentType as any}
                       data={childData}
                       assetUrl={child.uiComponentData?.assetRefId ? assetUrls[child.uiComponentData.assetRefId] : undefined}
                       onDataChange={(patch) => onUpdateElement(child.id, { uiComponentData: { ...(child.uiComponentData || {}), ...patch } }, '编辑仪表盘数据')}
                       onAction={(action) => handleUiComponentAction(child, action)}
                     />
                   </div>
                 );
               })()}
            </div>
          );
        })}
      </>
    );
  };

  const multiSelectionSummary = useMemo(() => {
    if (!isEditing || isTimelinePreviewMode || !activeScene || multiSelectedIds.length < 2) return null;
    const selected = activeScene.els.filter((element) => (
      multiSelectedIds.includes(element.id) && element.visible !== false
    ));
    if (selected.length < 2) return null;
    const left = Math.max(0, Math.min(...selected.map((element) => Number(element.x) || 0)));
    const top = Math.max(0, Math.min(...selected.map((element) => Number(element.y) || 0)));
    const right = Math.min(100, Math.max(...selected.map((element) => (Number(element.x) || 0) + Math.max(0, Number(element.w) || 0))));
    const bottom = Math.min(100, Math.max(...selected.map((element) => (Number(element.y) || 0) + Math.max(0, Number(element.h) || 0))));
    if (right - left <= 0 || bottom - top <= 0) return null;
    return { left, top, width: right - left, height: bottom - top, count: selected.length };
  }, [activeScene, isEditing, isTimelinePreviewMode, multiSelectedIds]);

  const multiToolbarAlignRight = Boolean(
    stageScreen
    && multiSelectionSummary
    && stageScreen.left + stageScreen.width * (multiSelectionSummary.left + multiSelectionSummary.width) / 100 > window.innerWidth - 320,
  );

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handleViewportPointerDownCapture}
      onMouseEnter={handleViewportMouseEnter}
      onMouseMove={handleMouseMoveParallax}
      onMouseLeave={handleViewportMouseLeave}
      onMouseDownCapture={handleViewportMouseDownCapture}
      onMouseDown={handleViewportMouseDown}
      onMouseUpCapture={handleCanvasMouseUp}
      onMouseUp={handleCanvasMouseUp}
      onTouchStart={onViewportTouchStart}
      onContextMenu={handleCanvasContextMenu}
      style={{ touchAction: 'none' }}
      onDoubleClick={(e) => {
        if (isDrawingTool && penNodesRef.current.length >= 2) {
          e.preventDefault();
          e.stopPropagation();
          handleFinishPenPath(false);
        }
      }}
      className={`aether-canvas-viewport relative flex-1 bg-[#090a0f] overflow-hidden flex items-center justify-center select-none ${isEditing && !isFullscreenPreview ? 'aether-canvas-viewport--editor' : 'aether-canvas-viewport--preview'} ${
        viewport.activeTool === 'pan' || isPanning || isSpacePressed
          ? 'cursor-grab active:cursor-grabbing' 
          : isDrawingTool 
          ? 'cursor-crosshair' 
          : 'cursor-default'
      }`}
    >
      {/* 銆愰鍒ゆ€х紪杈戙€戞姌鍙?灞曞紑宸﹀彸闈㈡澘锛氭姌鍙犲悗鐢诲竷鍏ㄥ锛岃櫄绾挎=婕旂ず寮圭獥鍍忕礌绾т竴鑷?*/}
      {isEditing && !isFullscreenPreview && onTogglePanelsCollapsed && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePanelsCollapsed(); }}
            onMouseDown={(e) => e.stopPropagation()}
            data-export-hide="true"
            title={panelsCollapsed ? '展开左右面板' : '折叠左右面板'}
            className="absolute z-[40] left-3 top-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 border border-slate-600/60 text-slate-200 text-[11px] font-medium hover:bg-slate-800/80 hover:border-sky-500/60 transition-colors cursor-pointer shadow-lg"
          >
            {panelsCollapsed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
            )}
            {panelsCollapsed ? '展开面板' : '折叠面板'}
          </button>
          {!panelsCollapsed && (
            <div className="aether-compact-workspace-hint" role="status">
              <span>窗口较窄，折叠侧栏可扩大画布</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); onTogglePanelsCollapsed(); }}>折叠侧栏</button>
            </div>
          )}
        </>
      )}

      {/* 3D Parallax Canvas Root Stage锛堝伐绋嬬敾甯冨昂瀵?Coordinate Base锛?*/}
      {/* 澶栧眰缂╂斁瀹瑰櫒锛歠itCanvas 鐨?translate/scale 鍦ㄦ锛岀ǔ瀹氫笉鍙楀満鏅浆鍦哄姩鐢诲奖鍝?鈥斺€?
          slide/zoom 绛夎浆鍦?keyframes 鍚?transform锛岃嫢鐩存帴浣滅敤鑸炲彴浼氳鐩栧灞?scale()锛?
          瀵艰嚧鑸炲彴鍥炲埌鐢诲竷鍘熷灏哄銆佸厓绱犳孩鍑虹敾甯冭瑁佸壀锛堟棤娉曠偣鍑讳氦浜掑厓绱狅級銆?*/}
      <PresentationStage
        canvasWidth={CANVAS_W}
        canvasHeight={CANVAS_H}
        zoom={viewport.zoom}
        panX={viewport.panX}
        panY={viewport.panY}
        scaleRef={scaleRef}
        stageRef={stageRef}
        stageKey={`stage-anim-${transitionAnimKey || 0}-${sceneExiting ? 'out' : 'in'}`}
        backdropStyle={getSceneBackgroundStyle(activeScene, (ref) => assetUrls[ref] || ref, getGradientBackground)}
        transitionOverlay={transitionOverlay ? { hostRef: transitionOverlayHostRef, animation: getTransitionOverlayAnimation(), mask: transitionOverlay.exitAnimation } : null}
        stageStyle={{
          ...getSceneBackgroundStyle(activeScene, (ref) => assetUrls[ref] || ref, getGradientBackground),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          animation: sceneExiting
            ? getSceneTransitionAnimation(activeScene, true)
            : getSceneTransitionAnimation(activeScene),
        }}
      >
        {/* Layer Group Elements */}
        {/* 娉ㄦ剰锛氬繀椤讳娇鐢?flat锛堥粯璁わ級锛屼笉鑳戒娇鐢?preserve-3d銆?
            鍘熷洜锛歱reserve-3d 浼氳鎵€鏈夊厓绱犲叡浜悓涓€涓?3D 娓叉煋涓婁笅鏂囧苟鎸?translateZ(depthZ)
            娣卞害鎺掑簭锛屽鑷?depthZ 楂樼殑鏃у厓绱狅紙涓绘爣/鍗＄墖/鎸夐挳锛宒epthZ 45~85锛夊湪 3D 绌洪棿涓?
            閬尅 depthZ=0 鐨勬柊澧炲厓绱狅紙鐢ㄦ埛涓婁紶鐨勫浘鐗?瑙嗛/鍏夊墤锛夛紝鍗充娇鍚庤€?zIndex 鏇撮珮锛?
            閫犳垚鏂板绱犳潗鏃犳硶琚紶鏍囩偣鍑婚€変腑/鎷栨嫿/缂╂斁銆?
            flat 涓嬫瘡涓厓绱犲悇鑷繚鐣?translate3d/rotateX/rotateY 鐨?3D 瑙嗗樊鏁堟灉锛?
            浣嗗厓绱犱箣闂存寜 z-index 姝ｅ父鍫嗗彔锛屾柊澧炵礌鏉愭案杩滃彲鐐广€?*/}
        <div className="w-full h-full relative">
          {/* 鎸?zIndex 闄嶅簭娓叉煋锛屼繚璇佺敾甯冮伄鎸￠『搴?= 鍥惧眰鍒楄〃椤哄簭锛堥《閮ㄥ浘灞傞伄鎸″簳閮ㄥ浘灞傦級锛?
              涓庡壀鏄犲浘灞傚師鐞嗕竴鑷淬€傞厤鍚?App.tsx 鐨?zIndex 褰掍竴鍖栵紙鍞竴 zIndex锛変娇鐢ㄣ€?*/}
          <SceneRenderer
            elements={resolvedSceneElements}
            renderTime={renderTime}
            isPlaying={isPlaying}
            isEditing={isEditing}
            resolveInteraction={resolveInteraction}
            isParentGroupHidden={isParentGroupHidden}
            renderElement={(el, renderMeta) => {
            // Timeline selection seeds the current selection, but a click on a
            // visible canvas layer is allowed to switch it. The actual DOM
            // stacking order (SceneRenderer's z-index order) determines which
            // layer receives the click when layers overlap.
            const isSelected = (selectedElementId === el.id || multiSelectedIds.includes(el.id)) && !isInteractionPreview;
            const { isInRange, isVideoPrewarm, hasInteraction } = renderMeta;
            const outOfRange = !isInRange;
            // Video layers are kept mounted during playback so their decoder
            // can stay warm, but they must never paint outside their authored
            // time window. Interactive layers are intentionally retained while
            // paused; media is the exception because a stale frame looks like
            // an unsolicited video appearance.
            const hideVideoOutsideRange = outOfRange && (el.type === 'vid' || el.type === 'panorama-vid' || el.type === 'vfx');
            // 浜や簰鍏冪礌锛堥厤缃簡鍦烘櫙璺宠浆 / 寮圭獥 / 缃戦〉閾炬帴锛夊湪婕旂ず妯″紡涓嬪父鏄惧彲鐐癸紝
            // 淇濊瘉灞曞巺鐜板満銆岃繘鍦哄嵆瑙併€佸嵆鐐瑰嵆鏈夈€嶏紝涓嶅彈鏃堕棿绾?startTime 瑁佸壀褰卞搷銆?

            // 鏃堕棿绾挎寚閽堢寮€绱犳潗鏃堕棿鑼冨洿鐨勬樉绀虹瓥鐣ワ紙鍓緫杞欢閫昏緫锛氳寖鍥村绱犳潗涓嶅弬涓庣敾闈㈠悎鎴愶級
            // - 鎾斁涓細鑼冨洿澶栫礌鏉愬畬鍏ㄩ殣钘?
            // - 闈炵紪杈戦瑙堬紙婕旂ず妯″紡锛夛細浜や簰鍏冪礌甯告樉鍙偣锛堢幇鍦哄繀椤昏兘鐐瑰嚮锛夛紝闈炰氦浜掕楗板厓绱犻殣钘?
            // - 缂栬緫妯″紡锛氳寖鍥村绱犳潗涔熶笉鍙備笌鐢婚潰鍚堟垚锛岄瑙堜笌鎴愮墖淇濇寔涓€鑷淬€?
            if (outOfRange && !isVideoPrewarm && !(isPlaying && (el.type === 'vid' || el.type === 'panorama-vid' || el.type === 'vfx'))) {
              if (isPlaying) return null;
              if (isEditing) return null;
              if (!isEditing) {
                if (!hasInteraction) return null;
                // 浜や簰鍏冪礌锛氳烦杩囨椂闂寸嚎绐楀彛瑁佸壀锛屾寜鍩虹灞炴€ч潤鎬佹覆鏌擄紙涓嶆挱鏀炬椂闂寸嚎鍔ㄧ敾锛?
              }
            }

            // Compute Base Properties (鍏抽敭甯у姛鑳藉凡绉婚櫎锛岀洿鎺ヤ娇鐢ㄥ厓绱犲熀纭€灞炴€?

            const animatedProperties = evaluateElementProperties(el, renderTime);
            let currentBaseX = animatedProperties.x;
            let currentBaseY = animatedProperties.y;
            let currentBaseW = animatedProperties.w;
            let currentBaseH = animatedProperties.h;
            let currentBaseRot = animatedProperties.rot;
            let currentBaseOpacity = animatedProperties.opacity;
            let currentBaseBrightness = 100;
            let currentBaseContrast = 100;
            let currentBaseBlur = 0;
            let currentBaseGlow = 0;
            let currentBaseHueRotate = 0;
            let currentBaseSaturate = 100;

            // 3D Parallax & Depth Calculation
            const is3D = projectData.is3DParallaxEnabled !== false;
            const intensity = projectData.parallaxIntensity !== undefined ? projectData.parallaxIntensity : 1.0;
            const depthZ = is3D ? (el.depthZ || 0) : 0;
            const factor = is3D ? (el.parallaxFactor !== undefined ? el.parallaxFactor : depthZ / 50) : 0;

            const transX = is3D ? -smoothParallax.x * factor * intensity * 60 : 0;
            const transY = is3D ? -smoothParallax.y * factor * intensity * 60 : 0;
            const rotX = is3D ? smoothParallax.y * intensity * (depthZ > 0 ? 5 : -5) : 0;
            const rotY = is3D ? -smoothParallax.x * intensity * (depthZ > 0 ? 5 : -5) : 0;
            const rotZ = currentBaseRot;

            // In & Out & Loop Animations calculation锛堢粺涓€璁＄畻锛氫笌鍚堝苟缁勫瓙鍥惧眰鍏辩敤锛?
            // 缂栬緫鍣ㄧ敾甯冨睍绀哄畬鏁撮潤鎬佺増寮忥紱杩涘嚭鍦轰綅绉诲拰閫忔槑搴﹀彧鍦ㄦ挱鏀?婕旂ず鏃剁敓鏁堬紝
            // 閬垮厤鏂扮敓鎴愬伐绋嬪湪鏃堕棿杞?0 绉掓墦寮€鏃惰鍔ㄧ敾钘忎綇鎴栨帹绂诲師甯冨眬銆?
            const followsPluginPreview = el.type === 'custom-code' && Boolean(el.customCode);
            const baseAnim = !isInteractionPreview
              ? { computedOpacity: currentBaseOpacity / 100, scale: 1, brightness: 1, slideX: 0, slideY: 0, animRotY: 0, animBlur: 0 }
              : computeElementAnim(el, renderTime, isInRange);
            let computedOpacity = baseAnim.computedOpacity;
            let scale = baseAnim.scale;
            let brightness = baseAnim.brightness;
            let slideX = baseAnim.slideX;
            let slideY = baseAnim.slideY;
            let animRotY = baseAnim.animRotY;
            let animBlur = baseAnim.animBlur;


            // 銆愭柊澧炪€戝厓绱犳偓鍋滃弽棣堢壒鏁堬細scale/float 骞跺叆 transform 璁＄畻
            // 缂栬緫妯″紡鎷栨嫿/缂╂斁/鏃嬭浆涓笉搴旂敤锛岄伩鍏嶆姈鍔紱3D/鍏ㄦ櫙鍏冪礌涓嶅簲鐢ㄤ綅绉荤被鐗规晥锛堥伩鍏嶅共鎵板唴閮ㄦ嫋鎷斤級
            const isHovering = hoveredElementId === el.id;
            const isThreeDPane = el.type === 'panorama-img' || el.type === 'panorama-vid' || el.type === 'model-3d' || el.type === 'gaussian-splat';
            // The modal preview is the source of truth for authored custom-code motion.
            // Canvas-level hover effects would otherwise stack on the plugin's own CSS/JS.
            const hoverEff = followsPluginPreview ? 'none' : (el.hoverEffect || 'none');
            const hoverInten = Math.max(0, Math.min(100, el.hoverIntensity !== undefined ? el.hoverIntensity : 50));
            const hoverStrength = hoverInten / 100;
            const hoverEnabled = isHovering && hoverEff !== 'none' && !(isDraggingEl || resizeHandle || isRotating);
            // 缂栬緫鎬佽閫変腑鐨勫浘灞傛寔缁睍绀轰氦浜掔壒鏁堬紝婊戝姩寮哄害鏃跺彲绔嬪嵆姣旇緝 0% 鍜?100%銆?            // 婕旂ず鎬佷粛涓ユ牸淇濇寔鈥滈紶鏍囨偓鍋滃悗瑙﹀彂鈥濈殑浜や簰璇箟銆?
            const previewHoverEffect = !isInteractionPreview
              && isSelected
              && hoverEff !== 'none'
              && !isDirectMorphMotion(hoverEff)
              && !(isDraggingEl || resizeHandle || isRotating);
            const hoverVisualActive = hoverEnabled || previewHoverEffect;
            const hoverColor = el.hoverColor || '#38bdf8';
            const hoverEffectFilter = !hoverVisualActive ? ''
              : hoverEff === 'glow'
                ? `drop-shadow(0 0 ${(18 * hoverStrength).toFixed(1)}px color-mix(in srgb, ${hoverColor} ${Math.min(100, 100 * hoverStrength)}%, transparent)) drop-shadow(0 0 ${(52 * hoverStrength).toFixed(1)}px color-mix(in srgb, ${hoverColor} ${Math.min(100, 86 * hoverStrength)}%, transparent))`
                : hoverEff === 'outline'
                  ? `drop-shadow(${(4 * hoverStrength).toFixed(1)}px 0 0 ${hoverColor}) drop-shadow(${(-4 * hoverStrength).toFixed(1)}px 0 0 ${hoverColor}) drop-shadow(0 ${(4 * hoverStrength).toFixed(1)}px 0 ${hoverColor}) drop-shadow(0 ${(-4 * hoverStrength).toFixed(1)}px 0 ${hoverColor})`
                  : hoverEff === 'brighten'
                    ? `brightness(${(1 + 0.4 * hoverStrength).toFixed(2)}) saturate(${(1 + 0.18 * hoverStrength).toFixed(2)})`
                    : '';
            const interactionEffect = followsPluginPreview ? 'none' : (el.interactionEffect || 'none');
            const interactionEffectTrigger = el.interactionEffectTrigger || 'click';
            const interactionEffectIntensity = Math.max(0, Math.min(100, el.interactionEffectIntensity ?? 50));
            const interactionEffectActive = interactionEffectState.elementId === el.id
              && interactionEffectState.effect === interactionEffect;
            const interactionEffectDefault = interactionEffectTrigger === 'default';
            const hoverInteractionEffectActive = interactionEffectTrigger === 'hover'
              && isHovering
              && !(isDraggingEl || resizeHandle || isRotating);
            // 缂栬緫鎬佷粎棰勬紨瑙嗚灞傦細榛樿鐗规晥闇€閫変腑鍚庡睍绀猴紝鎮仠/鐐瑰嚮鐗规晥浠嶈窡闅忓搴旀墜鍔裤€?            // 璺宠浆銆佸脊绐椼€佸彉閲忓啓鍏ュ缁堢敱 isInteractionPreview 涓嬬殑鍔ㄤ綔鍒嗘敮鐙珛鎺у埗銆?
            const interactionEffectPreviewable = isInteractionPreview || isSelected || isHovering || interactionEffectActive;
            const interactionEffectContinuous = (interactionEffectDefault && (isInteractionPreview || isSelected)) || hoverInteractionEffectActive;
            const interactionEffectVisible = interactionEffectContinuous || interactionEffectActive;
            const hoverBlurActive = interactionEffect === 'blur'
              && hoverInteractionEffectActive;
            const interactionBlur = interactionEffect === 'blur'
              ? (((isInteractionPreview || isSelected) && interactionEffectDefault)
                ? 1
                : (hoverBlurActive ? 1 : (interactionEffectActive ? interactionEffectState.progress : 0)))
                * (2 + interactionEffectIntensity * 0.16)
              : 0;
            const rippleContinuous = interactionEffectContinuous;
            const rippleVisible = interactionEffect === 'chromatic-ripple'
              && interactionEffectPreviewable
              && interactionEffectIntensity > 0
              && (rippleContinuous || interactionEffectActive);
            const liquidVisible = interactionEffect === 'liquid-droplet'
              && interactionEffectPreviewable
              && interactionEffectIntensity > 0
              && interactionEffectVisible;
            const glassVisible = interactionEffect === 'glass-refraction'
              && interactionEffectPreviewable
              && interactionEffectIntensity > 0
              && interactionEffectVisible;
            const depthVisible = interactionEffect === 'depth-of-field'
              && interactionEffectPreviewable
              && interactionEffectIntensity > 0
              && interactionEffectVisible;
            const focusHaloVisible = interactionEffect === 'focus-halo'
              && interactionEffectPreviewable
              && interactionEffectIntensity > 0
              && interactionEffectVisible;
            const edgeScanVisible = interactionEffect === 'edge-scan'
              && interactionEffectPreviewable
              && interactionEffectIntensity > 0
              && interactionEffectVisible;
            const interactionEffectRadius = Math.max(10, Math.min(100, el.interactionEffectRadius ?? 70));
            const liquidFieldRadius = Math.max(10, Math.round(interactionEffectRadius * 0.62));
            const glassFieldRadius = Math.max(10, Math.round(interactionEffectRadius * 0.7));
            const depthFocusRadius = Math.max(8, Math.round(interactionEffectRadius * 0.34));
            const depthFocusDiameter = Math.min(100, Math.max(16, Math.round(interactionEffectRadius * 0.7)));
            const configuredEffectDuration = Math.max(120, Math.min(3000, el.interactionEffectDuration ?? 650));
            const liquidDuration = interactionEffectContinuous ? Math.max(1200, configuredEffectDuration) : configuredEffectDuration;
            const glassDuration = interactionEffectContinuous ? Math.max(1800, configuredEffectDuration) : configuredEffectDuration;
            const depthDuration = interactionEffectContinuous ? Math.max(1600, configuredEffectDuration) : configuredEffectDuration;
            const interactionLoopAnim = getInteractionLoopAnim(interactionEffect);
            const interactionLoopActive = interactionLoopAnim !== null && interactionEffectVisible;
            const dataFlowVisible = interactionEffect === 'loop-data-flow'
              && interactionEffectIntensity > 0
              && interactionLoopActive;
            const hologramFlickerVisible = interactionEffect === 'loop-hologram-flicker'
              && interactionEffectIntensity > 0
              && interactionLoopActive;
            const interactionPressActive = interactionEffect === 'press-spring'
              && interactionEffectIntensity > 0
              && interactionEffectVisible;
            if (interactionLoopActive) {
              const cycle = interactionEffectActive
                ? interactionEffectState.progress
                : interactionLoopClock / configuredEffectDuration;
              const phase = cycle * Math.PI * 2;
              const strength = interactionEffectIntensity / 100;
              const sine = Math.sin(phase);

              switch (interactionLoopAnim) {
                case 'pulse':
                  scale *= 1 + sine * (strength * 0.14);
                  break;
                case 'float':
                  slideY += -sine * (strength * 22);
                  break;
                case 'spin':
                  animRotY += cycle * 360 * strength;
                  break;
                case 'shimmer':
                  brightness *= 1 + Math.max(0, sine) * (strength * 0.5);
                  break;
                case 'breathe':
                  scale *= 1 + sine * (strength * 0.1);
                  computedOpacity *= 1 - Math.max(0, sine) * (strength * 0.22);
                  break;
                case 'swing':
                  animRotY += sine * (strength * 18);
                  break;
                case 'shake':
                  slideX += Math.sin(phase * 4) * (strength * 10);
                  break;
                case 'heartbeat':
                  scale *= 1 + Math.pow(Math.max(0, sine), 2) * (strength * 0.22);
                  break;
                case 'blink':
                  computedOpacity *= 1 - Math.max(0, sine) * (strength * 0.85);
                  break;
                case 'wave':
                  slideY += sine * (strength * 18);
                  break;
                case 'neon-pulse':
                  brightness *= 1 + Math.max(0, sine) * (strength * 0.55);
                  scale *= 1 + sine * (strength * 0.09);
                  break;
                case 'data-flow':
                  brightness *= 1 + Math.max(0, sine) * (strength * 0.34);
                  break;
                case 'hologram-flicker':
                  // Keep the source layer intact. The hologram treatment is rendered by a
                  // full-size overlay below; only a small luminance/jitter cue belongs here.
                  brightness *= 1 + (1 - Math.abs(Math.sin(phase * 3))) * (strength * 0.16);
                  slideY += Math.sin(phase * 1.5) * (strength * 1.5);
                  break;
                case 'orbit-spin':
                  animRotY += cycle * 360 * strength;
                  slideX += Math.cos(phase) * (strength * 8);
                  slideY += Math.sin(phase) * (strength * 8);
                  break;
              }
            }
            if (interactionPressActive) {
              const cycle = interactionEffectActive
                ? interactionEffectState.progress
                : interactionLoopClock / configuredEffectDuration;
              const strength = interactionEffectIntensity / 100;
              const envelope = interactionEffectActive
                ? Math.sin(Math.PI * Math.max(0, Math.min(1, cycle)))
                : Math.max(0, Math.sin(cycle * Math.PI * 2));
              const rebound = Math.sin(cycle * Math.PI * 3) * (interactionEffectActive ? (1 - cycle) : 1);
              scale *= 1 - envelope * strength * 0.1 + Math.max(0, rebound) * strength * 0.08;
              slideY += envelope * strength * 8;
            }
            let hoverScaleBoost = 1;
            let hoverLiftY = 0;
            if (hoverEnabled && !isThreeDPane && hoverEff === 'scale') {
              hoverScaleBoost = 1 + (hoverInten / 100) * 0.22; // 寮哄害0-100 鈫?鏈€澶ф斁澶?2%
            } else if (hoverEnabled && !isThreeDPane && hoverEff === 'float') {
              hoverLiftY = -(hoverInten / 100) * 18; // 寮哄害0-100 鈫?鏈€澶т笂娴?8px
            }

            const directMorphActive = !isThreeDPane && isDirectMorphMotion(hoverEff)
              && directMorphState.elementId === el.id;
            const directMorphProgress = directMorphActive ? directMorphState.progress : 0;
            const directMorphHovering = !isThreeDPane && isDirectMorphMotion(hoverEff) && isHovering;
            const directMorphTransform = getDirectMorphTransform(
              directMorphActive ? directMorphState.motion : null,
              directMorphProgress,
              hoverInten,
            );
            const directMorphPulse = directMorphActive
              ? Math.sin(Math.PI * Math.max(0, Math.min(1, directMorphProgress)))
              : 0;
            const directMorphHighlight = directMorphHovering
              ? 7 + directMorphPulse * (3 + hoverInten * 0.05)
              : 0;

            const isInlineExpanded = isInteractionPreview && inlineActiveElementId === el.id;
            // Custom code always uses the isolated iframe renderer. Keeping one
            // execution path prevents authored scripts from ever reaching the
            // host React document.
            // Native Shadow DOM rendering keeps custom-code alpha transparent;
            // sandboxed iframes are composited as opaque white by Chromium.
            const usesCustomCodeIframe = false;
            const customCodeTypography: CustomCodeTextStyle | undefined = el.type === 'custom-code' ? {
              color: el.color,
              fontSize: el.fontSize,
              fontFamily: el.fontFamily,
              fontWeight: el.fontWeight,
              fontStyle: el.fontStyle,
              textDecoration: el.textDecoration,
              textAlign: el.textAlign,
              letterSpacing: el.letterSpacing,
              lineHeight: el.lineHeight,
              textOpacity: el.textOpacity,
              textGlowEnabled: el.textGlowEnabled,
              textGlowColor: el.textGlowColor,
              textGlowIntensity: el.textGlowIntensity,
              textGlowBlur: el.textGlowBlur,
              textShadowEnabled: el.textShadowEnabled,
              textShadowColor: el.textShadowColor,
              textShadowOpacity: el.textShadowOpacity,
              textShadowBlur: el.textShadowBlur,
              textShadowDistance: el.textShadowDistance,
              textShadowAngle: el.textShadowAngle,
            } : undefined;

            // 銆愭帶鍒剁偣璐村悎浼樺寲銆戠紪杈戞ā寮忛€変腑鍏冪礌鏃剁鐢?3D 瑙嗗樊鍙樻崲锛坮otX/rotY/浣嶇Щ锛夛紝
            // 閬垮厤閫忚瀵艰嚧鎺у埗鐐瑰亸绂诲厓绱犺瑙夎竟缂橈紝淇濊瘉鎺у埗鐐?100% 璐村悎銆?

            const parallaxDisabled = isSelected && !isInteractionPreview;
            const pTransX = parallaxDisabled ? 0 : transX;
            const pTransY = parallaxDisabled ? 0 : transY;
            const pRotX = parallaxDisabled ? 0 : rotX;
            const pRotY = parallaxDisabled ? 0 : rotY;

            const transformStr = `translate3d(${pTransX + slideX}px, ${pTransY + slideY + hoverLiftY}px, ${depthZ}px) scale(${scale * hoverScaleBoost * (isInlineExpanded ? 1.5 : 1)}) scaleX(${directMorphTransform.scaleX}) scaleY(${directMorphTransform.scaleY}) rotateX(${pRotX}deg) rotateY(${pRotY + animRotY}deg) rotateZ(${rotZ}deg)${isInlineExpanded ? ' translateY(-22px)' : ''}`;
            const hasInternalVfxInteraction = el.type === 'vfx';
            const hasChartInteraction = el.type === 'chart' && isInteractionPreview;
            const hasDirectMorphInteraction = isInteractionPreview && isDirectMorphMotion(hoverEff);
            const hasInteractionEffect = interactionEffect !== 'none';
            const resolvedInteraction = resolveInteraction(el);
            const hasValidInteractionTarget = !el.interactionArea || (resolvedInteraction.action === 'url'
              ? isSafeInteractionUrl(resolvedInteraction.url)
              : Boolean(resolvedInteraction.target));
            const hasInteractionSequence = (resolvedInteraction.steps?.length || 0) > 0;
            const isInteractive = isInteractionPreview && ((resolvedInteraction.action !== 'none' && hasValidInteractionTarget) || hasInteractionSequence || hasInternalVfxInteraction || hasChartInteraction || hasDirectMorphInteraction || hasInteractionEffect);
            // Non-rectangular shapes own their outline inside the silhouette. A CSS
            // border on this wrapper would draw an unrelated rectangle around them.
            const isSilhouetteShape = el.type === 'shape' && Boolean(el.clipPath || el.shapePath);
            const shapeBackdropFilter = el.type === 'shape' && el.backgroundType === 'glass' && el.backdropBlur
              ? `blur(${el.backdropBlur}px)`
              : 'none';
            // 蒙版是编辑器里相对昂贵的渲染路径。普通图层完全跳过它，
            // 启用蒙版但没有对应关键帧时也直接复用静态值，避免时间线每帧
            // 为所有图层创建对象并重复查找关键帧。
            const layerMaskEnabled = el.maskEnabled === true;
            let layerMaskClip: string | undefined;
            if (layerMaskEnabled) {
              const maskElement = {
                ...el,
                maskX: getPropertyTrack(el, 'maskX')
                  ? evaluateAnimatedProperty(el, 'maskX', renderTime, el.maskX ?? 10)
                  : (el.maskX ?? 10),
                maskY: getPropertyTrack(el, 'maskY')
                  ? evaluateAnimatedProperty(el, 'maskY', renderTime, el.maskY ?? 10)
                  : (el.maskY ?? 10),
                maskWidth: getPropertyTrack(el, 'maskWidth')
                  ? evaluateAnimatedProperty(el, 'maskWidth', renderTime, el.maskWidth ?? 80)
                  : (el.maskWidth ?? 80),
                maskHeight: getPropertyTrack(el, 'maskHeight')
                  ? evaluateAnimatedProperty(el, 'maskHeight', renderTime, el.maskHeight ?? 80)
                  : (el.maskHeight ?? 80),
                maskRadius: getPropertyTrack(el, 'maskRadius')
                  ? evaluateAnimatedProperty(el, 'maskRadius', renderTime, el.maskRadius ?? 12)
                  : (el.maskRadius ?? 12),
                maskFeather: getPropertyTrack(el, 'maskFeather')
                  ? evaluateAnimatedProperty(el, 'maskFeather', renderTime, el.maskFeather ?? 0)
                  : (el.maskFeather ?? 0),
              };
              layerMaskClip = getLayerMaskClipPath(maskElement);
            }
            const interactionClip = isInteractionPreview && el.interactionArea && (el.saberNodes || []).length >= 3
              ? `polygon(${(el.saberNodes || []).map((node) => `${node.x}% ${node.y}%`).join(', ')})`
              : undefined;

            // Dynamic Physical 3D Drop-Shadow
            // 浠呭湪銆岄瑙?婕旂ず妯″紡 + 鍏冪礌鏄惧紡寮€鍚?enable3DShadow銆嶆椂鍚敤锛?
            // 缂栬緫妯″紡涓嬫亽涓嶆樉绀猴紝閬垮厤鍒涘缓/缂栬緫鏃跺嚭鐜板共鎵伴槾褰便€?

            let computedBoxShadow = el.boxShadow || 'none';
            if (isInteractionPreview && is3D && intensity > 0 && depthZ !== 0 && el.enable3DShadow) {
              const shadowX = -smoothParallax.x * (20 + Math.abs(depthZ) * 0.25);
              const shadowY = -smoothParallax.y * (20 + Math.abs(depthZ) * 0.25) + Math.max(12, depthZ * 0.45);
              const shadowBlur = Math.max(20, Math.abs(depthZ) * 0.9 + 28);
              const shadowAlpha = Math.min(0.75, 0.25 + Math.abs(depthZ) / 200);
              const s3d = `${shadowX.toFixed(1)}px ${shadowY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0, 0, 0, ${shadowAlpha.toFixed(2)})`;
              computedBoxShadow = computedBoxShadow && computedBoxShadow !== 'none' ? `${computedBoxShadow}, ${s3d}` : s3d;
            }

            return (
              <div
                key={el.id}
                id={el.id}
                data-canvas-element="true"
                data-canvas-element-id={el.id}
                onMouseDownCapture={(e) => {
                  // Native controls inside UI components may stop bubbling.
                  // Capture selection before they consume the event, but leave
                  // the actual move gesture to the bubble handler. Starting
                  // both phases used to reset the gesture and cause jumps.
                  if (!isInteractionPreview && (el.type === 'ui-component' || el.type === 'custom-code')
                    && !(e.target instanceof Element && e.target.closest('[data-aether-ui-text-layer="true"]'))) {
                    onSelectElement(el.id);
                  }
                }}
                onMouseDown={(e) => handleElementMouseDown(e, el)}
                onTouchStart={(e) => onElementTouchStart(e, el)}
                onPointerDown={(e) => handleElementPointerDown(e, el)}
                onPointerMove={(e) => handleElementPointerMove(e, el)}
                onPointerUp={(e) => handleElementPointerEnd(e, el)}
                onPointerCancel={() => clearPointerGesture()}
                onClick={(e) => {
                  if (isDrawingTool && !isInteractionPreview) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (textHotspotClickRef.current?.elementId === el.id) {
                    textHotspotClickRef.current = null;
                    return;
                  }
                  if (el.interactionEffect && el.interactionEffect !== 'none' && el.interactionEffectTrigger === 'click') {
                    const rect = e.currentTarget.getBoundingClientRect();
                    playInteractionEffect(
                      el,
                      rect.width ? ((e.clientX - rect.left) / rect.width) * 100 : 50,
                      rect.height ? ((e.clientY - rect.top) / rect.height) * 100 : 50,
                    );
                  }
                  if (isInteractionPreview && resolveInteraction(el).trigger === 'click') {
                    triggerElement(el);
                  }
                }}
                onKeyDown={(e) => {
                  if (!isInteractive) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (el.interactionEffect && el.interactionEffect !== 'none' && el.interactionEffectTrigger === 'click') {
                      playInteractionEffect(el);
                    }
                    if (resolveInteraction(el).trigger === 'click') triggerElement(el);
                  }
                }}
                onMouseEnter={() => handleElementHoverIn(el)}
                onMouseLeave={() => handleElementHoverOut(el)}
                onDoubleClick={() => {
                  if (isDrawingTool) return;
                  if (!isInteractionPreview && el.type === 'custom-code' && el.customCode) {
                    setInlineCustomCodeEditId(el.id);
                    return;
                  }
                  if (!isInteractionPreview && el.type === 'ui-component') {
                    setInlineUiEditId(el.id);
                    return;
                  }
                  if (!isInteractionPreview && !el.interactionArea && (el.type === 'txt' || el.type === 'shape')) {
                    setEditingTextId(el.id);
                    setTempTextValue(el.content !== undefined ? el.content : '双击编辑文字');
                  }
                }}
                style={{
                  left: `var(--aether-gesture-left, ${currentBaseX}%)`,
                  top: `var(--aether-gesture-top, ${currentBaseY}%)`,
                  width: `var(--aether-gesture-width, ${currentBaseW}%)`,
                  height: `var(--aether-gesture-height, ${currentBaseH}%)`,
                  zIndex: isInlineExpanded ? Math.max(el.zIndex, 9000) : el.zIndex,
                  transform: `${transformStr} rotate(var(--aether-gesture-rotate, 0deg))`,
                  transformOrigin: 'center center',
                  willChange: directMorphActive || directMorphHovering ? 'transform, filter' : 'auto',
                  // 閽㈢瑪妯″紡涓嬬礌鏉愪笉鍙備笌鍛戒腑娴嬭瘯锛屾墍鏈夌偣鍑荤粺涓€浜ょ粰鐢诲竷钀界偣閫昏緫銆?                  pointerEvents: isDrawingTool && !isInteractionPreview ? 'none' : undefined,
                  mixBlendMode: el.blendMode || 'normal',
                  // 銆愭柊澧炪€戞偓鍋滅壒鏁堥鑹?CSS 鍙橀噺锛坓low/sweep/outline/brighten 鍏辩敤锛?
                  ...(hoverEff !== 'none'
                    ? {
                      ['--hover-color' as any]: el.hoverColor || '#38bdf8',
                      ['--hover-intensity' as any]: hoverStrength,
                      ['--hover-glow-near' as any]: `${18 * hoverStrength}px`,
                      ['--hover-glow-far' as any]: `${52 * hoverStrength}px`,
                      ['--hover-glow-near-mix' as any]: `${Math.min(100, 110 * hoverStrength)}%`,
                      ['--hover-glow-far-mix' as any]: `${Math.min(100, 94 * hoverStrength)}%`,
                      ['--hover-outline-color' as any]: `color-mix(in srgb, ${el.hoverColor || '#38bdf8'} ${Math.min(100, 100 * hoverStrength)}%, transparent)`,
                      ['--hover-outline-width' as any]: `${4 * hoverStrength}px`,
                      ['--hover-outline-width-neg' as any]: `${-4 * hoverStrength}px`,
                      ['--hover-outline-glow' as any]: `${16 * hoverStrength}px`,
                      ['--hover-outline-mix' as any]: `${Math.min(100, 88 * hoverStrength)}%`,
                      ['--hover-brightness' as any]: 1 + 0.4 * hoverStrength,
                      ['--hover-saturate' as any]: 1 + 0.18 * hoverStrength,
                    }
                    : {}),
                  // 编辑和播放预览都先按时间线裁剪，这里只处理时间窗内的静态编辑透明度。
                  opacity: !isInteractionPreview
                    ? Math.max(0.15, Math.min(1, currentBaseOpacity / 100))
                    : (isVideoPrewarm || hideVideoOutsideRange || (isPlaying && outOfRange)) ? 0 : Math.max(0, Math.min(1, computedOpacity)),
                  visibility: (isVideoPrewarm || hideVideoOutsideRange || (isPlaying && outOfRange)) ? 'hidden' : 'visible',
                  // Keep transparent custom-code and UI layers hit-testable in
                  // the editor. Their rendered content can be fully
                  // transparent, which otherwise makes Chromium return the
                  // canvas underneath and prevents a drag from starting.
                  backgroundColor: !isInteractionPreview && (el.type === 'saber' || el.type === 'vfx' || el.type === 'custom-code' || el.type === 'ui-component')
                    ? 'rgba(0, 0, 0, 0.001)'
                    : undefined,
                  filter: (
                    brightness !== 1 || currentBaseBrightness !== 100 || (currentBaseBlur + animBlur) > 0
                    || interactionBlur > 0 || currentBaseContrast !== 100 || currentBaseGlow > 0
                    || currentBaseHueRotate !== 0 || currentBaseSaturate !== 100 || hoverEffectFilter
                    || directMorphHovering || directMorphHighlight > 0 || (edgeScanVisible && el.type !== 'txt')
                  ) ? [
                    brightness !== 1 ? `brightness(${brightness * (currentBaseBrightness / 100)})` : (currentBaseBrightness !== 100 ? `brightness(${currentBaseBrightness}%)` : ''),
                    (currentBaseBlur + animBlur) > 0 ? `blur(${currentBaseBlur + animBlur}px)` : '',
                    interactionBlur > 0 ? `blur(${interactionBlur.toFixed(2)}px)` : '',
                    currentBaseContrast !== 100 ? `contrast(${currentBaseContrast}%)` : '',
                    currentBaseGlow > 0 ? `drop-shadow(0 0 ${currentBaseGlow}px rgba(255,255,255,0.85))` : '',
                    currentBaseHueRotate !== 0 ? `hue-rotate(${currentBaseHueRotate}deg)` : '',
                    currentBaseSaturate !== 100 ? `saturate(${currentBaseSaturate}%)` : '',
                    hoverEffectFilter,
                    directMorphHovering ? 'brightness(1.08)' : '',
                    directMorphHighlight > 0 ? `drop-shadow(0 0 ${directMorphHighlight.toFixed(1)}px ${el.hoverColor || '#38bdf8'})` : '',
                    edgeScanVisible && el.type !== 'txt'
                      ? `drop-shadow(0 0 ${(3 * (interactionEffectIntensity / 100)).toFixed(1)}px ${el.interactionEffectColor || '#38bdf8'}) drop-shadow(0 0 ${(10 * (interactionEffectIntensity / 100)).toFixed(1)}px ${el.interactionEffectColor || '#38bdf8'})`
                      : '',
                  ].filter(Boolean).join(' ') || 'none' : 'none',
                  borderRadius: el.borderRadius ? `${el.borderRadius}px` : '0px',
                  // 多选时给每个图层一个细轮廓；单选框和手柄在多选时隐藏，避免误改单个图层。
                  outline: isSelected && multiSelectedIds.length > 1
                    ? '1px solid rgba(56, 189, 248, 0.55)'
                    : undefined,
                  outlineOffset: 1,
                  border: el.type === 'custom-code'
                    ? 'none'
                    : isSilhouetteShape
                    ? 'none'
                    : el.borderWidth
                        ? `${el.borderWidth}px solid ${el.borderColor || '#fff'}`
                        : 'none',
                  // Polygon edges must not inherit a blurred rectangular shadow
                  // from the outer element box.
                  boxShadow: el.type === 'custom-code' || (el.type === 'shape' && (el.clipPath || el.shapePath)) ? 'none' : computedBoxShadow,
                  backdropFilter: isSilhouetteShape
                    ? 'none'
                    : el.type === 'shape'
                      ? shapeBackdropFilter
                      : el.backdropBlur
                        ? `blur(${el.backdropBlur}px)`
                        : 'none',
                  WebkitBackdropFilter: isSilhouetteShape
                    ? 'none'
                    : el.type === 'shape'
                      ? shapeBackdropFilter
                      : el.backdropBlur
                        ? `blur(${el.backdropBlur}px)`
                        : 'none',
                  // The transparent SVG only supplies the visible editor outline.
                  // Preview hit testing follows the authored polygon rather than its box.
                  clipPath: interactionClip || layerMaskClip,
                  WebkitClipPath: interactionClip || layerMaskClip,


                }}
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                aria-label={isInteractive ? (el.content || el.sourceName || '交互元素') : undefined}
                  className={`absolute flex items-center justify-center select-none ${
                  !isInteractionPreview
                    ? 'cursor-grab active:cursor-grabbing'
                    : (isInteractive || el.type === 'model-3d')
                      ? `pointer-events-auto${isInteractive ? ' cursor-pointer' : ''}`
                      : 'pointer-events-none'
                } ${
                  el.type !== 'custom-code' && hoverEff !== 'none' && !isDirectMorphMotion(hoverEff) ? `aether-hover aether-hover-${hoverEff}` : ''
                }${previewHoverEffect ? ' aether-hover-preview' : ''
                }${isDirectMorphMotion(hoverEff) ? ' aether-direct-morph-hover' : ''
                }${
                  isInlineExpanded ? ' inline-expanded-popup' : ''
                }`}
              >
                {/* 合并图层组（嵌套容器）：整体渲染内部子图层 */}
                {isEditing && !isInteractionPreview && (
                  (el.type === 'custom-code' && inlineCustomCodeEditId !== el.id) ||
                  (el.type === 'ui-component' && inlineUiEditId !== el.id)
                ) && (
                  <span
                    data-aether-editor-hit-area="true"
                    aria-hidden="true"
                    style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'block', background: 'rgba(0, 0, 0, 0.001)', pointerEvents: 'auto' }}
                  />
                )}
                {el.type === 'group' && renderGroupContent(el)}

                {/* Image Element */}
                {el.type === 'img' && (el.refId && resolveImageUrl(el.refId) ? (
                  <div className="w-full h-full relative rounded-[inherit]">
                    <img
                      src={resolveImageUrl(el.refId)}
                      alt={el.sourceName || 'image'}
                      draggable={false}
                      onLoad={(event) => handleImageMetadata(el.id, event.currentTarget)}
                      onError={(event) => {
                        // A stale remote/asset reference must never paint the
                        // browser's opaque broken-image box over the canvas.
                        event.currentTarget.style.visibility = 'hidden';
                      }}
                      className="block w-full h-full object-fill pointer-events-none select-none rounded-[inherit]"
                      style={{ background: 'transparent', objectPosition: 'center center' }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/20 rounded-[inherit]">
                    鏈坊鍔犵礌鏉?
                  </div>
                ))}

                {/* Video Element */}
                {el.type === 'vid' && (el.refId ? (
                  (() => {
                    const videoSrc = resolveVideoUrl(el.refId);
                    const videoError = videoLoadErrors[el.id] === el.refId;
                    if (!videoSrc || videoError) {
                      return (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/20 rounded-[inherit]">
                          {videoError ? '视频加载失败' : '正在加载视频...'}
                        </div>
                      );
                    }
                    const sharedMasterId = sharedVideoMasterIds.get(el.id);
                    return (
                      <div className="w-full h-full relative rounded-[inherit]">
                        {sharedMasterId ? (
                          <SharedVideoMirror
                            masterId={sharedMasterId}
                            className="w-full h-full object-fill pointer-events-auto rounded-[inherit]"
                          />
                        ) : <video
                          key={el.id}
                          data-aether-video
                          data-aether-video-master={el.id}
                          data-video-ref={el.refId}
                          data-video-mode={el.vidMode || 'auto'}
                          data-video-start-time={String(el.startTime || 0)}
                          data-video-loop={String(shouldRepeatVideo(el))}
                          data-video-playback-count={String(getLayerPlaybackConfig(el).count)}
                          data-video-prewarm={String(isVideoPrewarm)}
                          src={videoSrc}
                          // Prewarm only container metadata. Fetch media payload when the
                          // layer enters its timeline range so several upcoming videos
                          // do not compete with the currently visible clip.
                          preload="metadata"
                          autoPlay={false}
                          loop={shouldRepeatVideo(el)}
                          muted={el.muted === true}
                          playsInline
                          style={{ contain: 'layout paint' }}
                          onCanPlay={(event) => {
                            if (isPlaying && event.currentTarget.dataset.videoPrewarm !== 'true' && event.currentTarget.paused && !event.currentTarget.ended) {
                              void event.currentTarget.play().catch(() => {});
                            }
                          }}
                          controls={el.videoControls === true}
                          onPlay={(event) => { if (!isPlaying) event.currentTarget.pause(); }}
                  onEnded={handleLayerVideoEnded}
                  // `suspend` is a normal browser event: the resource loader
                  // intentionally paused fetching after buffering enough data.
                  // Treating it as a stall called load() repeatedly and made
                  // timeline videos stop after a short period of playback.
                  onStalled={(event) => handleVideoStalled(el.id, el.refId, event.currentTarget)}
                  onWaiting={(event) => handleVideoStalled(el.id, el.refId, event.currentTarget)}
                  onLoadedMetadata={(event) => handleVideoMetadata(el.id, event.currentTarget)}
                          onError={(event) => handleVideoError(el.id, el.refId, event.currentTarget)}
                          className={`w-full h-full object-fill pointer-events-auto rounded-[inherit] aether-video-player-${el.videoPlayerStyle || 'none'}`}
                        />}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-white/20 rounded-[inherit]">
                    未添加素材
                  </div>
                ))}

                {/* Data Visualization Chart Element */}
                {el.type === 'chart' && (
                  <ChartElementView el={el} interactive={isInteractionPreview} />
                )}

                {/* UI Component Element (Galaxy UI 缁勪欢) */}
                {/* The authored layer box is only a layout host. The actual
                    painted UI root inside ScaledUIComponent owns hit testing;
                    keeping this full-size wrapper transparent prevents a
                    selected component from blocking neighbouring layers. */}
                {el.type === 'ui-component' && (() => {
                  const customProps = el.uiComponentData?.customProps || el.customCodeProps;
                  const customVars: Record<string, string> = {};
                  if (customProps && typeof customProps === 'object') {
                    for (const [k, v] of Object.entries(customProps)) {
                      customVars[`--aether-${k}`] = String(v);
                      customVars[`--comp-${k}`] = String(v);
                      customVars[`--${k}`] = String(v);
                    }
                  }
                  const scale = customProps?.size != null ? Number(customProps.size) / 100 : 1;
                  const glow = customProps?.glow != null ? Number(customProps.glow) : 0;
                  const glowColor = customProps?.color || el.uiComponentData?.color || '#38bdf8';
                  const isEnabled = customProps?.enabled !== false;

                  const dynamicWrapperStyle: React.CSSProperties = {
                    pointerEvents: 'none',
                    width: '100%',
                    height: '100%',
                    transform: scale !== 1 ? `scale(${scale})` : undefined,
                    transformOrigin: 'center center',
                    filter: glow > 0 ? `drop-shadow(0 0 ${glow * 0.18}px ${glowColor})` : undefined,
                    opacity: isEnabled ? 1 : 0.45,
                    transition: 'transform 0.15s ease-out, filter 0.15s ease-out, opacity 0.15s ease-out',
                    ...customVars,
                  };

                  const effectiveData = {
                    ...(el.uiComponentData || {}),
                    ...(customProps?.color ? { color: customProps.color, accentColor: customProps.color } : {}),
                    ...(customProps?.textColor ? { textColor: customProps.textColor } : {}),
                    ...(customProps?.value !== undefined ? { value: customProps.value } : {}),
                    ...(customProps?.label !== undefined ? { label: customProps.label } : {}),
                    ...(customProps?.title !== undefined ? { title: customProps.title, label: customProps.title } : {}),
                    ...(customProps?.speed !== undefined ? { speed: customProps.speed } : {}),
                    ...(customProps?.enabled !== undefined ? { motionEnabled: Boolean(customProps.enabled) } : {}),
                  };

                  return (
                    <div style={dynamicWrapperStyle}>
                      <LazyScaledUIComponent
                      type={el.uiComponentType as any}
                      data={effectiveData}
                      assetUrl={el.uiComponentData?.assetRefId ? assetUrls[el.uiComponentData.assetRefId] : undefined}
                      onDataChange={(patch) => onUpdateElement(el.id, { uiComponentData: { ...(el.uiComponentData || {}), ...patch } }, '编辑仪表盘数据')}
                      onAction={(action) => handleUiComponentAction(el, action)}
                      interactive={isInteractionPreview}
                      textEditing={!isInteractionPreview && inlineUiEditId === el.id}
                      textHotspots={el.textHotspots}
                      onTextChange={(textKey, value) => handleUiTextChange(el.id, textKey, value)}
                      onTextContextMenu={(selection) => openTextContextMenu(el.id, selection)}
                      onTextHotspotTrigger={(hotspotId) => handleTextHotspotTriggerFromSurface(el, hotspotId)}
                      onRequestTextEditing={() => setInlineUiEditId(el.id)}
                      locked={el.uiComponentData?.continuousInteraction?.popupPolicy === 'lock' && Boolean(activePopupSceneId)}
                      onContinuousNodeTrigger={(node) => handleContinuousInteractionNode(el, node)}
                      onIntrinsicSize={el.uiComponentType === 'official-modao' && el.uiComponentData?.__autoFit
                        ? (size) => {
                          // 首次渲染后把图层外框贴合组件真实绘制尺寸：选框不再比组件大一圈，
                          // 等比缩放时也不会出现“先不变、再突然跳一下”。
                          const fittedW = Math.max(1, Math.round((size.width / CANVAS_W) * 10000) / 100);
                          const fittedH = Math.max(1, Math.round((size.height / CANVAS_H) * 10000) / 100);
                          onUpdateElement(el.id, {
                            w: fittedW,
                            h: fittedH,
                            uiComponentData: {
                              ...(el.uiComponentData || {}),
                              __autoFit: false,
                              officialAspect: size.width / Math.max(1, size.height),
                            },
                          }, '贴合官方组件尺寸', false);
                        }
                        : undefined}
                    />
                  </div>
                  );
                })()}
                {el.type === 'custom-code' && el.customCode && (
                  <div className="h-full w-full overflow-visible rounded-[inherit]" data-aether-custom-code-stage="true" style={{
                    pointerEvents: isInteractionPreview || inlineCustomCodeEditId === el.id ? 'auto' : 'none',
                    background: 'transparent',
                    border: '0',
                    outline: '0',
                    boxShadow: 'none',
                  }}>
                    {usesCustomCodeIframe
                      ? <CustomCodeFrame
                          plugin={el.customCode}
                          instanceId={`${activeSceneId}-${el.id}-${el.customCode.version}-${el.customCode.updatedAt}`}
                          interactive={isInteractionPreview || inlineCustomCodeEditId === el.id}
                          inlineTextEditing={!isInteractionPreview && inlineCustomCodeEditId === el.id}
                          focusTextKey={inlineCustomCodeEditId === el.id ? inlineCustomCodeTextKey || undefined : undefined}
                          typography={customCodeTypography}
                          hoverEffect={hoverEff}
                          hoverActive={hoverEnabled}
                          hoverColor={el.hoverColor || '#38bdf8'}
                          textHotspots={el.textHotspots}
                          textOverrides={el.customCode.textOverrides}
                          onBounds={(bounds) => handleCustomCodeBounds(el.id, bounds)}
                          onContentChange={(html, textKey, value) => handleCustomCodeTextChange(el.id, html, textKey, value)}
                          onTextChange={(textKey, value) => handleCustomCodeTextOverride(el.id, textKey, value)}
                          onTextContextMenu={(selection) => openTextContextMenu(el.id, selection)}
                          onTextHotspotTrigger={(hotspotId) => handleTextHotspotTriggerFromSurface(el, hotspotId)}
                        />
                      : <TransparentCustomCodeFrame
                          html={el.customCode.html}
                          css={el.customCode.css}
                          js={el.customCode.js}
                          surfaceBackground="transparent"
                          fitContent
                          // 自定义代码现在运行在 sandbox iframe 里：iframe 会吞掉所有指针事件，
                          // 因此编辑态默认不拦截点击，让画布仍能选中/拖动该图层；
                          // 进入交互预览或内联文字编辑时才把事件交给组件。
                          interactive={isInteractionPreview}
                          textEditing={!isInteractionPreview && inlineCustomCodeEditId === el.id}
                          focusTextKey={inlineCustomCodeEditId === el.id ? inlineCustomCodeTextKey || undefined : undefined}
                          textHotspots={el.textHotspots}
                          hoverEffect={hoverEff}
                          hoverActive={hoverEnabled}
                          hoverColor={el.hoverColor || '#38bdf8'}
                          typography={customCodeTypography}
                          textOverrides={el.customCode.textOverrides}
                          props={el.customCodeProps || el.customCode.controlValues}
                          onBounds={(bounds) => handleCustomCodeBounds(el.id, bounds)}
                          onContentChange={(html, textKey, value) => handleCustomCodeTextChange(el.id, html, textKey, value)}
                          onTextChange={(textKey, value) => handleCustomCodeTextOverride(el.id, textKey, value)}
                          onTextContextMenu={(selection) => openTextContextMenu(el.id, selection)}
                          onTextHotspotTrigger={(hotspotId) => handleTextHotspotTriggerFromSurface(el, hotspotId)}
                          onRequestTextEditing={(textKey) => {
                            setInlineCustomCodeTextKey(textKey || null);
                            setInlineCustomCodeEditId(el.id);
                          }}
                        />}
                  </div>
                )}
                {/* 3D / 鍏ㄦ櫙鍏冪礌锛圵ebGL 娓叉煋 + 鐑偣鍙犲姞灞傦級 */}
                {(el.type === 'panorama-img' || el.type === 'panorama-vid' || el.type === 'model-3d' || el.type === 'gaussian-splat') && (
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 bg-black/40">
                      姝ｅ湪鍔犺浇 3D 娓叉煋寮曟搸鈥?
                    </div>
                  }>
                    <Element3DView
                      el={el}
                      availableModelElements={(projectData.scenes[activeSceneId]?.els || []).filter((item) => item.type === 'model-3d')}
                      assetUrl={el.refId ? (assetUrls[el.refId] || el.refId) : undefined}
                      isEditing={!isInteractionPreview}
                      isSelected={isSelected}
                      isPlaying={isPlaying}
                      onUpdateElement={onUpdateElement}
                      onHotspotTrigger={(h) => onHotspotTrigger?.(h)}
                      defaultLinkSceneId={Object.keys(projectData.scenes).find((id) => id !== activeSceneId)}
                      selectedHotspotId={selectedHotspot && selectedHotspot.elementId === el.id ? selectedHotspot.hotspotId : null}
                      onSelectHotspot={(hotspotId) => onSelectHotspot?.(el.id, hotspotId)}
                      onDeleteHotspot={(hotspotId) => onDeleteHotspot?.(el.id, hotspotId)}
                      onUpdateHotspot={(hotspotId, patch) => onUpdateHotspot?.(el.id, hotspotId, patch)}
                    />
                  </Suspense>
                )}

                {/* Text Element */}
                {el.type === 'txt' && (() => {
                  const baseTextStyle = getTextStyle(el);
                  return (
                    <div
                      data-aether-text-layer="true"
                      style={{
                        ...baseTextStyle,
                        fontSize: `var(--aether-gesture-font-size, ${baseTextStyle.fontSize})`,
                        padding: editingTextId === el.id ? 0 : `${el.textPadding ?? 6}px`,
                        alignItems: el.verticalAlign === 'top' ? 'flex-start' : el.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                        justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                        whiteSpace: el.textWrap === 'nowrap' ? 'nowrap' : 'pre-wrap',
                        ['--edge-color' as string]: el.interactionEffectColor || '#38bdf8',
                        ['--edge-intensity' as string]: `${interactionEffectIntensity / 100}`,
                        ['--effect-duration' as string]: `${configuredEffectDuration}ms`,
                      }}
                      className={`w-full h-full flex ${editingTextId === el.id ? 'select-text' : 'select-none'} ${edgeScanVisible ? 'aether-text-edge-scan' : ''}`}
                    >
                      {editingTextId === el.id ? (
                        <textarea
                          value={tempTextValue}
                          onChange={(e) => setTempTextValue(e.target.value)}
                          onContextMenu={(e) => handleTextAreaContextMenu(e, el.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onFocus={(e) => {
                            if (tempTextValue === '双击编辑文字' || tempTextValue === 'NEW TEXT') {
                              e.currentTarget.select();
                            }
                          }}
                          onBlur={() => {
                            onUpdateElement(el.id, { content: tempTextValue });
                            setEditingTextId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                              e.preventDefault();
                              onUpdateElement(el.id, { content: tempTextValue });
                              setEditingTextId(null);
                            }
                          }}
                          autoFocus
                          style={{
                            ...getTextEditorStyle(el, { padding: `${el.textPadding ?? 6}px` }),
                            fontSize: `var(--aether-gesture-font-size, ${baseTextStyle.fontSize})`,
                          }}
                          className="w-full h-full"
                        />
                      ) : (
                        <AutoFitText
                          textBounds
                          autoFit={el.autoFitText === true}
                          verticalAlign={el.verticalAlign || 'middle'}
                          textAlign={el.textAlign || 'center'}
                          className={`w-full ${el.textWrap === 'nowrap' ? 'whitespace-nowrap' : 'break-words'}`}
                        >
                          {el.content || '双击编辑文字'}
                        </AutoFitText>
                      )}
                    </div>
                  );
                })()}

                {/* Shape / Interactive Card Element */}
                {el.type === 'shape' && (
                  <div
                    style={{
                      background: el.shapePath ? 'transparent' : getShapeBackground(el),
                      clipPath: el.shapePath ? undefined : (el.clipPath || undefined),
                      WebkitClipPath: el.shapePath ? undefined : (el.clipPath || undefined),
                      boxSizing: 'border-box',
                      backdropFilter: el.clipPath ? shapeBackdropFilter : 'none',
                      WebkitBackdropFilter: el.clipPath ? shapeBackdropFilter : 'none',
                    }}
                    className={`relative w-full h-full rounded-[inherit] overflow-hidden select-none ${!el.shapePath ? 'aether-shape-surface' : ''} ${el.clipPath ? 'aether-shape-surface--clipped' : ''}`}
                  >
                    {el.shapePath && (
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        data-interaction-area-path={el.interactionArea ? el.id : undefined}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient id={`custom-shape-gradient-${el.id}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={el.gradientStart || '#22d3ee'} />
                            <stop offset="55%" stopColor={el.gradientVia || el.gradientStart || '#3b82f6'} />
                            <stop offset="100%" stopColor={el.gradientEnd || '#9333ea'} />
                          </linearGradient>
                        </defs>
                        <path
                          d={el.shapePath}
                          fill={el.interactionArea ? (isInteractionPreview ? 'transparent' : 'rgba(52, 211, 153, 0.10)') : (el.backgroundType === 'solid' ? (el.backgroundColor || '#1e293b') : `url(#custom-shape-gradient-${el.id})`)}
                          stroke={el.interactionArea ? (isInteractionPreview ? 'transparent' : '#34d399') : (el.borderColor || 'rgba(255,255,255,0.28)')}
                          strokeWidth={el.interactionArea ? 1.5 : Math.max(0.5, el.borderWidth || 1)}
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                        />
                        {el.interactionArea && isSelected && isEditing && !isInteractionPreview && (el.saberNodes || []).map((node, index) => (
                          <circle
                            key={`interaction-area-node-${index}`}
                            cx={node.x}
                            cy={node.y}
                            r="2.2"
                            fill="#ffffff"
                            stroke="#34d399"
                            strokeWidth="1.25"
                            className="cursor-move pointer-events-auto"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setInteractionNodeDrag({ elementId: el.id, index });
                              elDragMovedRef.current = false;
                            }}
                            aria-label={`编辑交互区域节点 ${index + 1}`}
                          />
                        ))}
                      </svg>
                    )}
                    {editingTextId === el.id ? (
                      <textarea
                        value={tempTextValue}
                        onChange={(e) => setTempTextValue(e.target.value)}
                        onContextMenu={(e) => handleTextAreaContextMenu(e, el.id)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          if (tempTextValue === '双击编辑文字' || tempTextValue === 'CARD TITLE\n双击编辑卡片内容') {
                            e.currentTarget.select();
                          }
                        }}
                        onBlur={() => {
                          onUpdateElement(el.id, { content: tempTextValue });
                          setEditingTextId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                            e.preventDefault();
                            onUpdateElement(el.id, { content: tempTextValue });
                            setEditingTextId(null);
                          }
                        }}
                        autoFocus
                        style={getTextEditorStyle(el, {
                          color: el.textColor || el.color || '#ffffff',
                          fontSize: el.fontSize || 16,
                          defaultLineHeight: 1.1,
                          padding: el.shapePadding !== undefined ? el.shapePadding : 12,
                        })}
                        className="absolute inset-0 z-10"
                      />
                    ) : (
                      el.content && (
                        <div
                          style={{
                            boxSizing: 'border-box',
                            padding: el.shapePadding !== undefined ? `${el.shapePadding}px` : '12px',
                            ...getTextStyle(el, { color: el.textColor || el.color || '#ffffff', fontSize: el.fontSize || 16, defaultLineHeight: 1.1 }),
                            display: 'flex',
                            alignItems: el.verticalAlign === 'top' ? 'flex-start' : el.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                            justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                            whiteSpace: el.textWrap === 'nowrap' ? 'nowrap' : 'pre-line',
                          }}
                          className="absolute inset-0 min-w-0 min-h-0 overflow-hidden pointer-events-none"
                        >
                          <AutoFitText
                            autoFit={true}
                            verticalAlign={el.verticalAlign || 'middle'}
                            textAlign={el.textAlign || 'center'}
                            className={`relative z-10 w-full max-h-full overflow-hidden ${el.textWrap === 'nowrap' ? 'whitespace-nowrap' : 'break-words'}`}
                          >
                            {el.content}
                          </AutoFitText>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Saber Light Effect Element (AE Saber Multi-Layer Laser Engine) */}
                {el.type === 'saber' && (() => {
                  const saberMotion = calculateSaberMotion(el, renderTime);
                  const startP = saberMotion.startPercent;
                  const endP = saberMotion.endPercent;
                  const glowMult = saberMotion.glowMultiplier;
                  const flickerA = saberMotion.flickerAlpha;

                  const glowCol = el.saberGlowColor || '#f3ca7e';
                  const secGlowCol = el.saberSecondaryGlowColor || '#925216';
                  const coreCol = el.saberCoreColor || '#fffff5';
                  const effectType = el.saberEffectType || 'standard';
                  const profile = getSaberEffectProfile(effectType);
                  const coreW = evaluateAnimatedProperty(el, 'saberCoreWidth', renderTime, el.saberCoreWidth ?? 1.0);
                  const spread = evaluateAnimatedProperty(el, 'saberGlowSpread', renderTime, el.saberGlowSpread ?? 18);
                  const intensity = evaluateAnimatedProperty(el, 'saberGlowIntensity', renderTime, el.saberGlowIntensity ?? 1.4);
                  const pathD = el.saberPath || 'M 10 50 L 90 50';
                  const capStyle = el.saberCapStyle || 'round';
                  const taper = el.saberTaper || 'both';
                  const falloff = el.saberGlowFalloff || 'normal';
                  const falloffProfile = {
                    sharp: { edgeFade: 0.14, curve: 0.82, opacityCurve: 0.72, blur: 0.86 },
                    normal: { edgeFade: 0.22, curve: 1, opacityCurve: 0.92, blur: 1 },
                    soft: { edgeFade: 0.3, curve: 1.22, opacityCurve: 1.12, blur: 1.18 },
                    dreamy: { edgeFade: 0.38, curve: 1.48, opacityCurve: 1.36, blur: 1.38 },
                  }[falloff];
                  // Closed geometry has no meaningful head or tail. Applying a
                  // taper to a rectangle/circle would create an arbitrary seam.
                  const canTaper = taper !== 'none' && !/\bz\s*$/i.test(pathD.trim());

                  const outerGlowFilterId = `saber-glow-outer-${el.id}`;
                  const innerGlowFilterId = `saber-glow-inner-${el.id}`;
                  const trimMaskId = `saber-trim-${el.id}`;
                  // Keep subpaths independent in the mask. Connecting M commands with
                  // L creates invisible bridge geometry that can advance the dash and
                  // leak light at later subpath starts.
                  const trimSubpaths = splitSvgSubpaths(pathD);
                  const measuredSubpathLengths = saberPathLengthsRef.current.get(el.id) || [];
                  const trimPathLength = measuredSubpathLengths.length === trimSubpaths.length
                    ? measuredSubpathLengths.reduce((sum, value) => sum + value, 0)
                    : 0;
                  // Do not render any optical layer before the real SVG length is known.
                  // Falling back to a normalized 100-unit dash is what caused first-frame
                  // flashes at circle ends and at later subpath starts.
                  const hasMeasuredStroke = Boolean(trimPathLength > 0);
                  const hasVisibleStroke = hasMeasuredStroke && endP > startP;
                  const isDashed = el.saberDashed === true;
                  const dashLength = Math.min(24, Math.max(1, el.saberDashLength ?? 8));
                  const dashGap = Math.min(24, Math.max(1, el.saberDashGap ?? 6));
                  const dashPattern = isDashed && hasMeasuredStroke
                    ? `${(dashLength / 100) * trimPathLength!} ${(dashGap / 100) * trimPathLength!}`
                    : undefined;
                  const dashOffset = isDashed
                    ? -((el.saberDashOffset ?? 0) + renderTime * (el.saberGrowthSpeed ?? 1) * 8)
                    : undefined;
                  const profileDashOffset = hasMeasuredStroke
                    ? -((renderTime * (el.saberGrowthSpeed ?? 1) * 12) % 100) / 100 * trimPathLength!
                    : 0;
                  // Use an explicit user-space filter region. The usual
                  // objectBoundingBox region collapses to zero height for a
                  // horizontal Saber path, silently clipping the glow.
                  const outerBlur = Math.min(8, Math.max(2.2, spread * profile.outerBlurScale * 3 * falloffProfile.blur));
                  const innerBlur = Math.min(4, Math.max(0.75, spread * profile.innerBlurScale * 2.4 * falloffProfile.blur));
                  // The Saber layer is commonly much wider than it is tall. With
                  // preserveAspectRatio="none", normal SVG strokes are vertically
                  // squashed and their round caps become flat. All optical strokes
                  // below therefore use non-scaling-stroke: the width and cap stay
                  // in screen pixels regardless of the layer's aspect ratio.
                  const coreStroke = Math.max(coreW * profile.coreScale, 1.25);
                  const ambientWidth = Math.max(coreW * profile.ambientScale, 3.2, coreStroke * 3.2);
                  const haloWidth = Math.max(coreW * profile.haloScale, 2.0, coreStroke * 1.8);
                  const coreMaskId = `${trimMaskId}-core`;
                  const haloMaskId = `${trimMaskId}-halo`;

                  const renderTrimMask = (id: string, strokeWidth: number) => {
                    let subpathOffset = 0;
                    return (
                      <mask key={id} id={id} maskUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
                        {trimSubpaths.map((subpath, index) => {
                          const measuredLength = measuredSubpathLengths[index] || 0;
                          const segmentStart = subpathOffset;
                          subpathOffset += measuredLength;
                          const segmentVisibleStart = Math.max(segmentStart, (startP / 100) * trimPathLength);
                          const segmentVisibleEnd = Math.min(subpathOffset, (endP / 100) * trimPathLength);
                          const segmentSpan = Math.max(0, segmentVisibleEnd - segmentVisibleStart);
                          if (!canTaper || !measuredLength || /\bz\s*$/i.test(subpath)) {
                            return (
                              <path key={index} d={subpath} fill="none" stroke="white" strokeWidth={strokeWidth}
                                strokeLinecap={capStyle} strokeLinejoin="round" pathLength={measuredLength || undefined}
                                strokeDasharray={measuredLength && segmentSpan > 0 ? `${segmentSpan} ${measuredLength + 2}` : undefined}
                                strokeDashoffset={measuredLength ? -(segmentVisibleStart - segmentStart) : 0}
                                opacity={segmentSpan > 0 && hasVisibleStroke ? 1 : 0} />
                            );
                          }
                          const slices = 48;
                          return Array.from({ length: slices }, (_, sliceIndex) => {
                            const sliceStart = (sliceIndex / slices) * measuredLength;
                            const sliceEnd = ((sliceIndex + 1) / slices) * measuredLength;
                            const visibleStart = Math.max(sliceStart, segmentVisibleStart - segmentStart);
                            const visibleEnd = Math.min(sliceEnd, segmentVisibleEnd - segmentStart);
                            const visibleSpan = Math.max(0, visibleEnd - visibleStart);
                            const progress = (segmentStart + (sliceIndex + 0.5) / slices * measuredLength) / trimPathLength;
                            const startFactor = taper === 'end' ? 1 : Math.min(1, Math.pow(progress / falloffProfile.edgeFade, falloffProfile.curve));
                            const endFactor = taper === 'start' ? 1 : Math.min(1, Math.pow((1 - progress) / falloffProfile.edgeFade, falloffProfile.curve));
                            const factor = Math.max(0.012, Math.min(startFactor, endFactor));
                            return (
                              <path key={`${index}-${sliceIndex}`} d={subpath} fill="none" stroke="white"
                                strokeWidth={strokeWidth * factor} strokeLinecap="round" strokeLinejoin="round"
                                pathLength={measuredLength}
                                strokeDasharray={`${visibleSpan} ${measuredLength + 2}`}
                                strokeDashoffset={-visibleStart}
                                opacity={visibleSpan > 0 && hasVisibleStroke ? Math.pow(factor, falloffProfile.opacityCurve) : 0} />
                            );
                          });
                        })}
                      </mask>
                    );
                  };

                  return (
                    <div
                      style={{
                        mixBlendMode: (el.blendMode || 'screen') as any,
                      }}
                      className="w-full h-full relative overflow-visible pointer-events-none"
                    >
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="w-full h-full overflow-visible"
                      >
                        <defs>
                          {/* Cinema-Grade Multi-tier Optical Glow & Dispersion Shader */}
                          <filter id={outerGlowFilterId} filterUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300" colorInterpolationFilters="sRGB">
                            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="2" seed="8" result="noise" />
                            <feDisplacementMap in="SourceGraphic" in2="noise" scale={profile.turbulence} result="distorted" />
                            <feGaussianBlur in="distorted" stdDeviation={outerBlur} />
                          </filter>
                          <filter id={innerGlowFilterId} filterUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300" colorInterpolationFilters="sRGB">
                            <feGaussianBlur stdDeviation={innerBlur} />
                          </filter>
                          <linearGradient id={`${outerGlowFilterId}-beam`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0" stopColor={secGlowCol} stopOpacity="0" />
                            <stop offset="0.2" stopColor={glowCol} stopOpacity="0.9" />
                            <stop offset="0.5" stopColor={coreCol} />
                            <stop offset="0.8" stopColor={glowCol} stopOpacity="0.9" />
                            <stop offset="1" stopColor={secGlowCol} stopOpacity="0" />
                          </linearGradient>
                          {/* Keep measurement current after taper switches on. */}
                          {trimSubpaths.map((subpath, index) => (
                            <path
                              key={`measure-${index}`}
                              ref={(path) => measureSaberPath(el.id, index, trimSubpaths.length, path)}
                              d={subpath}
                              fill="none"
                              stroke="none"
                            />
                          ))}
                          {renderTrimMask(trimMaskId, ambientWidth)}
                          {renderTrimMask(haloMaskId, haloWidth)}
                          {renderTrimMask(coreMaskId, coreStroke)}
                        </defs>

                        {/* 1. Deep Atmospheric Aura & Wide Light Bloom (瀹藉煙娣辩┖鏌斿厜鎵╂暎) */}
                        {effectType === 'wave' && (
                          <g mask={`url(#${trimMaskId})`} fill="none" strokeLinecap={capStyle} strokeLinejoin="round">
                            <path d={pathD} transform="translate(0 -1.8)" vectorEffect="non-scaling-stroke" stroke={glowCol} strokeWidth={Math.max(0.7, coreW * 0.72)} strokeOpacity="0.7" pathLength={trimPathLength || undefined} strokeDasharray={hasMeasuredStroke ? `${14 / 100 * trimPathLength!} ${9 / 100 * trimPathLength!}` : undefined} strokeDashoffset={profileDashOffset} filter={`url(#${innerGlowFilterId})`} />
                            <path d={pathD} transform="translate(0 1.8)" vectorEffect="non-scaling-stroke" stroke={secGlowCol} strokeWidth={Math.max(0.55, coreW * 0.58)} strokeOpacity="0.62" pathLength={trimPathLength || undefined} strokeDasharray={hasMeasuredStroke ? `${9 / 100 * trimPathLength!} ${13 / 100 * trimPathLength!}` : undefined} strokeDashoffset={-profileDashOffset * 0.72} filter={`url(#${outerGlowFilterId})`} />
                          </g>
                        )}

                        {effectType === 'blade' && (
                          <g mask={`url(#${trimMaskId})`} fill="none" stroke={glowCol} strokeOpacity={Math.min(0.62, 0.3 * (intensity / 1.4))} strokeLinecap={capStyle} strokeLinejoin="round" filter={`url(#${outerGlowFilterId})`}>
                            {profile.trackOffsets.map((shift) => (
                              <path key={`blade-${shift}`} d={pathD} transform={`translate(${shift} 0)`} vectorEffect="non-scaling-stroke" strokeWidth={Math.max(4, coreW * profile.haloScale)} pathLength={trimPathLength || undefined} />
                            ))}
                          </g>
                        )}

                        {effectType === 'ribbon' && (
                          <g mask={`url(#${trimMaskId})`} fill="none" strokeLinecap={capStyle} strokeLinejoin="round">
                            {profile.trackOffsets.map((shift, index) => (
                              <path key={`ribbon-${shift}`} d={pathD} transform={`translate(0 ${shift})`} vectorEffect="non-scaling-stroke" stroke={index % 2 ? glowCol : secGlowCol} strokeWidth={Math.max(0.35, coreW * 0.42)} strokeOpacity={0.24 - index * 0.025} pathLength={trimPathLength || undefined} strokeDasharray={hasMeasuredStroke ? `${(18 + index * 3) / 100 * trimPathLength!} ${(12 + index * 2) / 100 * trimPathLength!}` : undefined} strokeDashoffset={profileDashOffset * (index % 2 ? 0.8 : 1.1)} />
                            ))}
                          </g>
                        )}

                        {effectType === 'beam' && (
                          <g mask={`url(#${trimMaskId})`} fill="none" strokeLinecap={capStyle} strokeLinejoin="round">
                            <path d={pathD} vectorEffect="non-scaling-stroke" pathLength={trimPathLength || undefined} stroke={secGlowCol} strokeWidth={Math.max(8, spread * 0.62)} strokeOpacity={0.16} filter={`url(#${outerGlowFilterId})`} />
                            <path d={pathD} vectorEffect="non-scaling-stroke" pathLength={trimPathLength || undefined} stroke={`url(#${outerGlowFilterId}-beam)`} strokeWidth={Math.max(3, spread * 0.2)} strokeOpacity={0.5} filter={`url(#${innerGlowFilterId})`} />
                          </g>
                        )}

                        {effectType === 'neon' && (
                          <path d={pathD} fill="none" vectorEffect="non-scaling-stroke" stroke={glowCol} strokeWidth={Math.max(3.4, coreW * profile.haloScale)} strokeOpacity={0.88} strokeLinecap={capStyle} strokeLinejoin="round" pathLength={trimPathLength || undefined} mask={`url(#${trimMaskId})`} filter={`url(#${innerGlowFilterId})`} />
                        )}

                        <g filter={`url(#${outerGlowFilterId})`}>
                          <path
                            d={pathD}
                            vectorEffect="non-scaling-stroke"
                            fill="none"
                            stroke={secGlowCol}
                            strokeWidth={ambientWidth}
                            strokeOpacity={Math.min(0.5, 0.24 * glowMult * (intensity / 1.4))}
                            strokeLinecap={capStyle}
                            strokeLinejoin="round"
                            pathLength={trimPathLength || undefined}
                            strokeDasharray={dashPattern}
                            strokeDashoffset={dashOffset}
                            mask={`url(#${trimMaskId})`}
                          />
                        </g>

                        {/* 2. Secondary Chromatic Dispersion Halo (鍙岃壊鐩哥數绂昏壊鏁ｉ灅) */}
                        <g filter={`url(#${innerGlowFilterId})`}>
                          <path
                            d={pathD}
                            vectorEffect="non-scaling-stroke"
                            fill="none"
                            stroke={glowCol}
                            strokeWidth={haloWidth}
                            strokeOpacity={Math.min(0.68, 0.38 * glowMult * (intensity / 1.4))}
                            strokeLinecap={capStyle}
                            strokeLinejoin="round"
                            pathLength={trimPathLength || undefined}
                            strokeDasharray={dashPattern}
                            strokeDashoffset={dashOffset}
                            mask={`url(#${haloMaskId})`}
                          />
                        </g>

                        {/* 3. Primary High-Density Quantum Plasma Bloom (楂樿兘閲忓瓙绛夌瀛愪富杈夊厜) */}
                        <path
                          d={pathD}
                          vectorEffect="non-scaling-stroke"
                          fill="none"
                          stroke={glowCol}
                          strokeWidth={coreStroke}
                          strokeOpacity={Math.min(0.96, 0.68 * glowMult * (intensity / 1.4))}
                          strokeLinecap={capStyle}
                          strokeLinejoin="round"
                          pathLength={trimPathLength || undefined}
                          strokeDasharray={dashPattern}
                          strokeDashoffset={dashOffset}
                          mask={`url(#${coreMaskId})`}
                        />

                        {/* 4. Specular Core Bloom (鐧界儹鍏夋牳鍏夋檿) */}
                        <path
                          d={pathD}
                          vectorEffect="non-scaling-stroke"
                          fill="none"
                          stroke={coreCol}
                          strokeWidth={Math.max(coreStroke * 0.48, coreW * 0.62)}
                          strokeOpacity={Math.min(0.98, 0.92 * glowMult)}
                          strokeLinecap={capStyle}
                          strokeLinejoin="round"
                          pathLength={trimPathLength || undefined}
                          strokeDasharray={dashPattern}
                          strokeDashoffset={dashOffset}
                          mask={`url(#${coreMaskId})`}
                        />

                        {/* 5. Razor-Sharp Ultra-Fine White Hot Core Filament (瓒呯簿缁嗙櫧鐑厜涓? */}
                        <path
                          d={pathD}
                          vectorEffect="non-scaling-stroke"
                          fill="none"
                          stroke={coreCol}
                          strokeWidth={Math.max(coreStroke * 0.28, coreW * 0.45)}
                          strokeOpacity={Math.min(1.0, 0.98 * flickerA)}
                          strokeLinecap={capStyle}
                          strokeLinejoin="round"
                          pathLength={trimPathLength || undefined}
                          strokeDasharray={dashPattern}
                          strokeDashoffset={dashOffset}
                          mask={`url(#${coreMaskId})`}
                        />
                      </svg>
                    </div>
                  );
                })()}

                {/* VFX Motion Element锛堢鎶€绠€绾﹀姩鏁堝簱锛屽€熼壌 MetalForge 鍍忕礌鐫€鑹插櫒鍔ㄦ晥锛屾嫋鍏ュ嵆鎾?+ 榧犳爣浜や簰锛?*/}
                {el.type === 'vfx' && (
                  <div
                    className="w-full h-full relative overflow-hidden"
                    style={{
                      mixBlendMode: (el.blendMode || 'normal') as any,
                      borderRadius: 0,
                    }}
                  >
                    <Suspense fallback={null}>
                      <VfxMotionCanvas
                        motionType={(el.vfxMotionType || 'plasma') as VfxMotionId}
                        colorA={el.vfxColorA}
                        colorB={el.vfxColorB}
                        colorC={el.vfxColorC}
                        speed={el.vfxSpeed || 1}
                        isPlaying={isPlaying && isInRange}
                        paused={!isInRange}
                        params={el.vfxParams}
                        cards={el.vfxCards}
                        selectedCardId={el.vfxCardSelectedId}
                        cardSelectionActive={el.vfxCardSelectionActive}
                        // Static editing gives pointer ownership to the outer canvas so the
                        // whole VFX layer can move. Timeline playback and E-preview share
                        // isInteractionPreview, so both restore the card's native gestures.
                        interactive={!isDrawingTool && isInteractionPreview}
                        onSelectCard={(id) => onUpdateElement(el.id, { vfxCardSelectedId: id, vfxCardSelectionActive: true }, '选择卡片')}
                        className="w-full h-full"
                        maxRes={240}
                        fpsLimit={30}
                      />
                    </Suspense>
                  </div>
                )}

                {rippleVisible && (
                  <span
                    key={rippleContinuous ? `${el.id}-ripple-continuous` : `${el.id}-ripple-${interactionEffectState.runId}`}
                    className={`aether-interaction-ripple${rippleContinuous ? ' aether-interaction-ripple--continuous' : ''}`}
                    aria-hidden="true"
                    style={{
                      ['--ripple-color' as string]: el.interactionEffectColor || '#38bdf8',
                      ['--ripple-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--ripple-duration' as string]: `${Math.max(120, Math.min(3000, el.interactionEffectDuration ?? 650))}ms`,
                      ['--effect-origin-x' as string]: `${interactionEffectState.originX}%`,
                      ['--effect-origin-y' as string]: `${interactionEffectState.originY}%`,
                    }}
                  />
                )}

                {focusHaloVisible && (
                  <span
                    key={interactionEffectContinuous ? `${el.id}-focus-halo-continuous` : `${el.id}-focus-halo-${interactionEffectState.runId}`}
                    className={`aether-focus-halo${interactionEffectContinuous ? ' aether-focus-halo--continuous' : ''}`}
                    aria-hidden="true"
                    style={{
                      ['--focus-color' as string]: el.interactionEffectColor || '#38bdf8',
                      ['--focus-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--focus-radius' as string]: `${interactionEffectRadius}%`,
                      ['--effect-duration' as string]: `${configuredEffectDuration}ms`,
                      ['--effect-origin-x' as string]: `${interactionEffectState.originX}%`,
                      ['--effect-origin-y' as string]: `${interactionEffectState.originY}%`,
                    }}
                  />
                )}

                {edgeScanVisible && el.type !== 'txt' && (
                  <span
                    key={interactionEffectContinuous ? `${el.id}-edge-scan-continuous` : `${el.id}-edge-scan-${interactionEffectState.runId}`}
                    className={`aether-edge-scan${interactionEffectContinuous ? ' aether-edge-scan--continuous' : ''}`}
                    aria-hidden="true"
                    style={{
                      ['--edge-color' as string]: el.interactionEffectColor || '#38bdf8',
                      ['--edge-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--effect-duration' as string]: `${configuredEffectDuration}ms`,
                    }}
                  />
                )}

                {liquidVisible && (
                  <span
                    key={interactionEffectContinuous ? `${el.id}-liquid-continuous` : `${el.id}-liquid-${interactionEffectState.runId}`}
                    className={`aether-liquid-droplets${interactionEffectContinuous ? ' aether-liquid-droplets--continuous' : ''}`}
                    aria-hidden="true"
                    style={{
                      ['--liquid-color' as string]: el.interactionEffectColor || '#b7f3ff',
                      ['--liquid-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--liquid-radius' as string]: `${liquidFieldRadius}%`,
                      ['--effect-duration' as string]: `${liquidDuration}ms`,
                    }}
                  >
                    {Array.from({ length: 4 }, (_, index) => <i key={index} />)}
                  </span>
                )}

                {glassVisible && (
                  <span
                    key={interactionEffectContinuous ? `${el.id}-glass-continuous` : `${el.id}-glass-${interactionEffectState.runId}`}
                    className={`aether-glass-refraction${interactionEffectContinuous ? ' aether-glass-refraction--continuous' : ''}`}
                    aria-hidden="true"
                    style={{
                      ['--glass-color' as string]: el.interactionEffectColor || '#b7f3ff',
                      ['--glass-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--glass-radius' as string]: `${glassFieldRadius}%`,
                      ['--effect-duration' as string]: `${glassDuration}ms`,
                    }}
                  />
                )}

                {depthVisible && (
                  <span
                    key={interactionEffectContinuous ? `${el.id}-depth-continuous` : `${el.id}-depth-${interactionEffectState.runId}`}
                    className={`aether-depth-focus${interactionEffectContinuous ? ' aether-depth-focus--continuous' : ''}`}
                    aria-hidden="true"
                    style={{
                      ['--depth-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--depth-radius' as string]: `${depthFocusRadius}%`,
                      ['--depth-diameter' as string]: `${depthFocusDiameter}%`,
                      ['--effect-duration' as string]: `${depthDuration}ms`,
                    }}
                  />
                )}

                {dataFlowVisible && (
                  <span
                    className="aether-data-flow"
                    aria-hidden="true"
                    style={{
                      ['--data-flow-color' as string]: el.interactionEffectColor || '#38bdf8',
                      ['--data-flow-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--effect-duration' as string]: `${configuredEffectDuration}ms`,
                    }}
                  >
                    <i /><i /><i />
                  </span>
                )}

                {hologramFlickerVisible && (
                  <span
                    className="aether-hologram-flicker"
                    aria-hidden="true"
                    style={{
                      ['--hologram-color' as string]: el.interactionEffectColor || '#38bdf8',
                      ['--hologram-intensity' as string]: `${interactionEffectIntensity / 100}`,
                      ['--effect-duration' as string]: `${configuredEffectDuration}ms`,
                    }}
                  />
                )}

                {/* Floating Drag & Selection Header Pill for Saber / VFX */}
                {isSelected && isEditing && (el.type === 'saber' || el.type === 'vfx') && (
                  <div
                    className="absolute -top-7 left-0 flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 text-[10px] font-bold shadow-[0_0_12px_rgba(6,182,212,0.6)] cursor-grab active:cursor-grabbing pointer-events-auto select-none border border-cyan-200/40 z-50 whitespace-nowrap"
                    onMouseDown={(e) => handleElementMouseDown(e, el)}
                onTouchStart={(e) => onElementTouchStart(e, el)}
                    title="按住拖动光效图层"
                  >
                    <Zap size={11} className="fill-current text-slate-950" />
                    <span>{el.sourceName || (el.type === 'vfx' ? '动效' : 'Saber 光线')}</span>
                  </div>
                )}

                {/* Bounding Box Transform Handles in Edit Mode */}
                {false && isSelected && !isDrawingTool && !el.locked && (
                  <div data-export-hide="true" className="contents">
                    {/* Rotation Pin */}
                    <div
                      onMouseDown={handleRotateMouseDown}
                      onTouchStart={onRotateHandleTouchStart}
                      className="absolute -top-7 left-1/2 -translate-x-1/2 w-4 h-4 bg-sky-500 border-2 border-white rounded-full cursor-grab active:cursor-grabbing shadow-md z-50 flex items-center justify-center"
                      title="按住旋转"
                    >
                      <div className="w-1 h-1 bg-white rounded-full" />
                    </div>
                    <div className="absolute -top-7 left-1/2 w-[1px] h-7 bg-sky-500 pointer-events-none" />

                    {/* 8-Point Resize Handles */}
                    {(() => {
                      const zoom = Math.max(0.05, viewport.zoom || 1);
                      const size = 16 / zoom;
                      const offset = -size / 2;
                      const borderWidth = Math.max(1, 2 / zoom);
                      const baseStyle: React.CSSProperties = {
                        width: size,
                        height: size,
                        borderWidth,
                        zIndex: 100000,
                        pointerEvents: 'auto',
                        willChange: 'transform',
                      };
                      const lift = (transform = '') => `${transform} translateZ(10000px)`.trim();
                      const handles: Array<{ key: string; className: string; style: React.CSSProperties }> = [
                        { key: 'nw', className: 'cursor-nwse-resize', style: { top: offset, left: offset, transform: lift() } },
                        { key: 'n', className: 'cursor-ns-resize', style: { top: offset, left: '50%', transform: lift('translateX(-50%)') } },
                        { key: 'ne', className: 'cursor-nesw-resize', style: { top: offset, right: offset, transform: lift() } },
                        { key: 'w', className: 'cursor-ew-resize', style: { top: '50%', left: offset, transform: lift('translateY(-50%)') } },
                        { key: 'e', className: 'cursor-ew-resize', style: { top: '50%', right: offset, transform: lift('translateY(-50%)') } },
                        { key: 'sw', className: 'cursor-nesw-resize', style: { bottom: offset, left: offset, transform: lift() } },
                        { key: 's', className: 'cursor-ns-resize', style: { bottom: offset, left: '50%', transform: lift('translateX(-50%)') } },
                        { key: 'se', className: 'cursor-nwse-resize', style: { bottom: offset, right: offset, transform: lift() } },
                      ];
                      return handles.map((handle) => (
                        <div
                          key={handle.key}
                          data-resize-handle={handle.key}
                          onMouseDown={(e) => handleResizeMouseDown(e, handle.key)}
                          onTouchStart={(e) => onResizeHandleTouchStart(e, handle.key)}
                          className={`absolute box-border rounded-md border-sky-500 bg-white shadow-lg ${handle.className}`}
                          style={{ ...baseStyle, ...handle.style }}
                          title="拖动调整大小"
                        />
                      ));
                    })()}
                  </div>
                )}
              </div>
            );
            }}
          />

        {/* Live Interactive Bezier Pen Tool Overlay */}
        {isDrawingTool && isEditing && (
          <div className="editing-assistance-layer absolute inset-0 pointer-events-none z-30 overflow-visible" data-export-hide="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <filter id="pen-live-glow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300">
                  <feGaussianBlur stdDeviation="0.8" />
                </filter>
              </defs>

              {/* 1. Established Path between existing pen nodes */}
              {penNodes.length >= 2 && (() => {
                const pathStr = bezierNodesToSvgPath(penNodes, false);
                const isSaberPen = viewport.activeTool === 'saber-draw';
                const theme = SABER_STYLE_THEMES[0];
                return (
                  <>
                    {isSaberPen && (
                      <path
                        d={pathStr}
                        fill="none"
                        stroke={theme.glowColor}
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                        strokeOpacity="0.65"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#pen-live-glow)"
                      />
                    )}
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={isSaberPen ? theme.coreColor : '#38bdf8'}
                      strokeWidth={isSaberPen ? 1.5 : 1.25}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={isSaberPen ? undefined : '4 3'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
              })()}

              {/* 2. Rubberband Preview Path to Mouse Cursor */}
              {penNodes.length > 0 && cursorPos && !isDraggingPenHandle && (() => {
                const lastNode = penNodes[penNodes.length - 1];
                let previewD = '';
                if (isNearStartPoint && penNodes.length >= 3) {
                  // Connect to starting node (preview closed contour)
                  const firstNode = penNodes[0];
                  if (lastNode.handleOut || firstNode.handleIn) {
                    const cp1 = lastNode.handleOut || { x: lastNode.x, y: lastNode.y };
                    const cp2 = firstNode.handleIn || { x: firstNode.x, y: firstNode.y };
                    previewD = `M ${lastNode.x} ${lastNode.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${firstNode.x} ${firstNode.y}`;
                  } else {
                    previewD = `M ${lastNode.x} ${lastNode.y} L ${firstNode.x} ${firstNode.y}`;
                  }
                } else {
                  // Connect to mouse cursor
                  if (lastNode.handleOut) {
                    previewD = `M ${lastNode.x} ${lastNode.y} C ${lastNode.handleOut.x} ${lastNode.handleOut.y}, ${cursorPos.x} ${cursorPos.y}, ${cursorPos.x} ${cursorPos.y}`;
                  } else {
                    previewD = `M ${lastNode.x} ${lastNode.y} L ${cursorPos.x} ${cursorPos.y}`;
                  }
                }

                return (
                  <path
                    d={previewD}
                    fill="none"
                    stroke={isNearStartPoint ? '#34d399' : '#38bdf8'}
                    strokeWidth="1.25"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="3 3"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                );
              })()}

              {/* 3. Render Tangent Control Handles */}
              {penNodes.map((node, idx) => (
                <g key={`handle-${idx}`}>
                  {node.handleOut && (
                    <>
                      <line
                        x1={node.x}
                        y1={node.y}
                        x2={node.handleOut.x}
                        y2={node.handleOut.y}
                        stroke="#00f0ff"
                        strokeWidth="0.6"
                        strokeDasharray="1.5 1.5"
                      />
                      <circle
                        cx={node.handleOut.x}
                        cy={node.handleOut.y}
                        r="1.2"
                        fill="#00f0ff"
                        stroke="#ffffff"
                        strokeWidth="0.4"
                      />
                    </>
                  )}
                  {node.handleIn && (
                    <>
                      <line
                        x1={node.x}
                        y1={node.y}
                        x2={node.handleIn.x}
                        y2={node.handleIn.y}
                        stroke="#00f0ff"
                        strokeWidth="0.6"
                        strokeDasharray="1.5 1.5"
                      />
                      <circle
                        cx={node.handleIn.x}
                        cy={node.handleIn.y}
                        r="1.2"
                        fill="#00f0ff"
                        stroke="#ffffff"
                        strokeWidth="0.4"
                      />
                    </>
                  )}
                </g>
              ))}
            </svg>

            {/* 4. HTML Anchor Point Visual Nodes */}
            {penNodes.map((node, idx) => {
              const isFirst = idx === 0;
              return (
                <div
                  key={`node-${idx}`}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${
                    isFirst && isNearStartPoint ? 'scale-150' : ''
                  }`}
                >
                  {isFirst && isNearStartPoint && (
                    <div className="absolute inset-0 -m-2 rounded-full border-2 border-emerald-400 animate-ping" />
                  )}
                  <div
                    className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center text-[8px] font-bold shadow-md ${
                      isFirst
                        ? isNearStartPoint
                          ? 'bg-emerald-500 border-white text-black shadow-[0_0_12px_#34d399]'
                          : 'bg-cyan-500 border-white text-black shadow-[0_0_10px_#00f0ff]'
                        : 'bg-[#0f172a] border-cyan-400 text-cyan-300'
                    }`}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Visual Overlay: Grid */}
        {false && isEditing && viewport.showGrid && (
          <div
            className="absolute inset-0 pointer-events-none z-20 opacity-70"
            data-export-hide="true"
            style={{
              backgroundImage: [
                'linear-gradient(to right, rgba(56,189,248,0.22) 1px, transparent 1px)',
                'linear-gradient(to bottom, rgba(56,189,248,0.22) 1px, transparent 1px)',
                'linear-gradient(to right, rgba(56,189,248,0.48) 1px, transparent 1px)',
                'linear-gradient(to bottom, rgba(56,189,248,0.48) 1px, transparent 1px)',
              ].join(', '),
              // 使用百分比网格，随舞台缩放保持稳定密度。
              backgroundSize: [
                `${100 / GRID_COLUMNS}% 100%`,
                `100% ${100 / GRID_ROWS}%`,
                `${100 / (GRID_COLUMNS / 5)}% 100%`,
                `100% ${100 / (GRID_ROWS / 5)}%`,
              ].join(', '),
            }}
          />
        )}

        {/* Visual Overlay: Smart Alignment Guides */}
        {smartGuides.map((guide, idx) => (
          <div
            key={idx}
            className="absolute pointer-events-none z-20"
            data-export-hide="true"
            style={
              guide.type === 'vertical'
                ? {
                    left: `${guide.pos}%`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    backgroundColor: '#38bdf8',
                    boxShadow: '0 0 8px #38bdf8',
                  }
                : {
                    top: `${guide.pos}%`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#38bdf8',
                    boxShadow: '0 0 8px #38bdf8',
                  }
            }
          >
            {guide.label && (
              <div
                className={`absolute bg-sky-500/90 text-black text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${
                  guide.type === 'vertical'
                    ? 'top-2 left-1.5'
                    : 'left-2 -top-4'
                }`}
              >
                {guide.label}
              </div>
            )}
          </div>
        ))}
      </div>
      </PresentationStage>

      {isEditing && stageScreen && isValidSelectionOverlay(selectionOverlay) && selectedElement && !isTimelinePreviewMode && multiSelectedIds.length <= 1 && (
          <div ref={selectionChromeRef} className="absolute pointer-events-none overflow-visible" data-export-hide="true" data-selection-element-id={selectedElement.id} aria-hidden="true" style={{ left: stageScreen.left, top: stageScreen.top, width: stageScreen.width, height: stageScreen.height, zIndex: 70 }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" style={{ pointerEvents: 'none', touchAction: 'none', zIndex: 2 }}>
            <polygon points={selectionOverlay.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={SELECTION_CHROME.accent} strokeWidth="1.5" strokeDasharray={editingTextId === selectedElement.id ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />
            {editingTextId !== selectedElement.id && (
              <line x1={(selectionOverlay.points[0].x + selectionOverlay.points[1].x) / 2} y1={(selectionOverlay.points[0].y + selectionOverlay.points[1].y) / 2} x2={selectionOverlay.rotate.x} y2={selectionOverlay.rotate.y} stroke={SELECTION_CHROME.accent} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
            {selectedElement.maskEnabled === true && (() => {
              const baseMask = normalizeLayerMask(selectedElement);
              const mask = {
                ...baseMask,
                x: evaluateAnimatedProperty(selectedElement, 'maskX', renderTime, baseMask.x),
                y: evaluateAnimatedProperty(selectedElement, 'maskY', renderTime, baseMask.y),
                width: evaluateAnimatedProperty(selectedElement, 'maskWidth', renderTime, baseMask.width),
                height: evaluateAnimatedProperty(selectedElement, 'maskHeight', renderTime, baseMask.height),
                radius: evaluateAnimatedProperty(selectedElement, 'maskRadius', renderTime, baseMask.radius),
                feather: evaluateAnimatedProperty(selectedElement, 'maskFeather', renderTime, baseMask.feather),
              };
              const topLeft = selectionOverlay.points[0];
              const topRight = selectionOverlay.points[1];
              const bottomRight = selectionOverlay.points[2];
              const bottomLeft = selectionOverlay.points[3];
              const mapPoint = (x: number, y: number) => ({
                x: topLeft.x + (topRight.x - topLeft.x) * (x / 100) + (bottomLeft.x - topLeft.x) * (y / 100),
                y: topLeft.y + (topRight.y - topLeft.y) * (x / 100) + (bottomLeft.y - topLeft.y) * (y / 100),
              });
              const rawNodes = mask.type === 'pen' && mask.nodes.length >= 2 ? mask.nodes : [
                { x: mask.x, y: mask.y }, { x: mask.x + mask.width, y: mask.y },
                { x: mask.x + mask.width, y: mask.y + mask.height }, { x: mask.x, y: mask.y + mask.height },
              ];
              const points = rawNodes.map((node) => mapPoint(node.x, node.y));
              const beginMaskDrag = (event: React.PointerEvent<SVGElement> | React.MouseEvent<SVGElement>, kind: 'move' | 'resize' | 'node', index?: number, handle?: string) => {
                const now = performance.now();
                const isPointerEvent = 'pointerId' in event;
                const lastEvent = lastMaskPointerEventRef.current;
                if (!isPointerEvent && lastEvent?.type === 'pointer' && now - lastEvent.time < 80
                  && lastEvent.x === event.clientX && lastEvent.y === event.clientY) return;
                lastMaskPointerEventRef.current = {
                  type: isPointerEvent ? 'pointer' : 'mouse',
                  time: now,
                  x: event.clientX,
                  y: event.clientY,
                };
                event.preventDefault();
                event.stopPropagation();
                if ('pointerId' in event && typeof event.currentTarget.setPointerCapture === 'function') {
                  event.currentTarget.setPointerCapture(event.pointerId);
                }
                const nextDrag = { kind, handle, nodeIndex: index, startX: event.clientX, startY: event.clientY, maskX: mask.x, maskY: mask.y, maskWidth: mask.width, maskHeight: mask.height, nodes: mask.nodes, moved: false };
                maskDragRef.current = nextDrag;
                // Keep the first pointermove on the ref-only path. Updating
                // React state here remounts expensive canvas content before
                // the gesture has moved and causes the visible first-frame hitch.
              };
              return <g data-mask-control="true" style={{ pointerEvents: 'auto' }}>
                <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(190,80,255,.08)" stroke="#d946ef" strokeWidth="2" strokeDasharray={mask.type === 'pen' ? '5 3' : undefined} vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'auto', cursor: 'move' }} onPointerDown={(event) => beginMaskDrag(event, 'move')} onMouseDown={(event) => beginMaskDrag(event, 'move')} />
                {(mask.type === 'pen' ? points : [0, 1, 2, 3].map((index) => points[index])).map((point, index) => <circle key={`mask-handle-${index}`} cx={point.x} cy={point.y} r="7" fill="#d946ef" stroke="#fff" strokeWidth="1.5" style={{ pointerEvents: 'auto', cursor: mask.type === 'pen' ? 'move' : 'nwse-resize' }} onPointerDown={(event) => beginMaskDrag(event, mask.type === 'pen' ? 'node' : 'resize', index, ['nw', 'ne', 'se', 'sw'][index])} onMouseDown={(event) => beginMaskDrag(event, mask.type === 'pen' ? 'node' : 'resize', index, ['nw', 'ne', 'se', 'sw'][index])} />)}
              </g>;
            })()}
          </svg>
          {selectedElement.maskEnabled === true && <button type="button" data-export-hide="true" onMouseDown={(event) => event.stopPropagation()} onClick={() => { onUpdateElement(selectedElement.id, { maskEnabled: false }, '关闭蒙版'); }} className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-lg" style={{ left: selectionOverlay.points[0].x - 18, top: selectionOverlay.points[0].y - 18, pointerEvents: 'auto', background: '#d946ef', color: '#fff' }} aria-label="关闭蒙版" title="关闭蒙版"><PenTool size={14} /></button>}
          {editingTextId !== selectedElement.id && ([
            ['nw', selectionOverlay.points[0]],
            ['n', { x: (selectionOverlay.points[0].x + selectionOverlay.points[1].x) / 2, y: (selectionOverlay.points[0].y + selectionOverlay.points[1].y) / 2 }],
            ['ne', selectionOverlay.points[1]],
            ['e', { x: (selectionOverlay.points[1].x + selectionOverlay.points[2].x) / 2, y: (selectionOverlay.points[1].y + selectionOverlay.points[2].y) / 2 }],
            ['se', selectionOverlay.points[2]],
            ['s', { x: (selectionOverlay.points[2].x + selectionOverlay.points[3].x) / 2, y: (selectionOverlay.points[2].y + selectionOverlay.points[3].y) / 2 }],
            ['sw', selectionOverlay.points[3]],
            ['w', { x: (selectionOverlay.points[3].x + selectionOverlay.points[0].x) / 2, y: (selectionOverlay.points[3].y + selectionOverlay.points[0].y) / 2 }],
          ] as Array<[string, { x: number; y: number }]>).map(([handle, point]) => {
            const isCorner = handle.length === 2;
            const isHorizontalEdge = handle === 'n' || handle === 's';
            return (
              <div
                key={handle}
                data-resize-handle={handle}
                onPointerDown={(event) => handleResizeMouseDown(event, handle)}
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-transparent group"
                style={{
                  width: SELECTION_CHROME.handleHitSize,
                  height: SELECTION_CHROME.handleHitSize,
                  left: point.x,
                  top: point.y,
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  cursor: isCorner ? (handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize') : isHorizontalEdge ? 'ns-resize' : 'ew-resize'
                }}
                title={
                  selectedElement.type === 'ui-component' && selectedElement.uiComponentType === 'official-modao'
                    ? '拖动等比缩放（官方组件保持固定比例）'
                    : isCorner
                      ? '拖动等比缩放大小 (Shift 自由比例)'
                      : '拖动单向拉伸比例 (Shift 锁定比例)'
                }
              >
                {isCorner ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-white border-[1.5px] border-sky-500 shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-125" />
                ) : isHorizontalEdge ? (
                  <span className="w-3.5 h-1.5 rounded-full bg-white border border-sky-500 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform group-hover:scale-125" />
                ) : (
                  <span className="w-1.5 h-3.5 rounded-full bg-white border border-sky-500 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform group-hover:scale-125" />
                )}
              </div>
            );
          })}
          {editingTextId !== selectedElement.id && (
            <div
              data-rotate-handle="true"
              onPointerDown={handleRotateMouseDown}
              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
              className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow-md hover:scale-110 active:scale-95 transition-transform"
              style={{ left: selectionOverlay.rotate.x, top: selectionOverlay.rotate.y, pointerEvents: 'auto', touchAction: 'none' }}
              title="按住旋转 (按住 Shift 15° 吸附)"
            >
              <RotateCw size={10} strokeWidth={2.5} />
            </div>
          )}
          {/* PPT / Figma Follower Badge */}
          {editingTextId !== selectedElement.id && (
            <div
              data-selection-badge="true"
              className="absolute -translate-x-1/2 pointer-events-none select-none flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/90 backdrop-blur-md border border-white/10 text-[11px] font-mono text-sky-300 shadow-xl z-20"
              style={{
                left: (selectionOverlay.points[2].x + selectionOverlay.points[3].x) / 2,
                top: Math.max(selectionOverlay.points[2].y, selectionOverlay.points[3].y) + 16,
              }}
            >
              <span
                data-selection-badge-text="true"
                dangerouslySetInnerHTML={{
                  __html: `${(((Number.isFinite(selectedElement.w) ? selectedElement.w : 0) / 100) * CANVAS_W).toFixed(1)} × ${(((Number.isFinite(selectedElement.h) ? selectedElement.h : 0) / 100) * CANVAS_H).toFixed(1)} px${Math.abs(selectedElement.rot || 0) >= 0.05 ? ` | ${(selectedElement.rot || 0).toFixed(1)}°` : ''}${selectedElement.type === 'txt' && selectedElement.fontSize ? ` | 字号 ${Math.round(selectedElement.fontSize)}px` : ''}`
                }}
              />
            </div>
          )}
        </div>
      )}

      {handoffMode && isEditing && stageScreen && selectedElement && !isTimelinePreviewMode && multiSelectedIds.length <= 1 && editingTextId !== selectedElement.id && isValidSelectionOverlay(selectionOverlay) && (() => {
        const points = selectionOverlay.points;
        const left = Math.min(...points.map((point) => point.x));
        const top = Math.min(...points.map((point) => point.y));
        const right = Math.max(...points.map((point) => point.x));
        const bottom = Math.max(...points.map((point) => point.y));
        const boxWidth = Math.max(1, right - left);
        const boxHeight = Math.max(1, bottom - top);
        const widthPx = (Number(selectedElement.w) / 100) * CANVAS_W;
        const heightPx = (Number(selectedElement.h) / 100) * CANVAS_H;
        const xPx = (Number(selectedElement.x) / 100) * CANVAS_W;
        const yPx = (Number(selectedElement.y) / 100) * CANVAS_H;
        const widthAbove = top >= 38;
        const widthLineY = widthAbove ? top - 18 : bottom + 18;
        const heightOnLeft = left >= 60;
        const heightLineX = heightOnLeft ? left - 18 : right + 18;
        const badgeY = widthAbove ? Math.max(9, top - 40) : bottom + 40;
        const badgeX = Math.max(0, Math.min(left, stageScreen.width - 82));
        const tick = 5;
        const corners = [
          { x: left, y: top, sx: 1, sy: 1 },
          { x: right, y: top, sx: -1, sy: 1 },
          { x: right, y: bottom, sx: -1, sy: -1 },
          { x: left, y: bottom, sx: 1, sy: -1 },
        ];
        return (
          <div
            className="absolute pointer-events-none overflow-visible"
            data-export-hide="true"
            data-handoff-overlay="true"
            style={{ left: stageScreen.left, top: stageScreen.top, width: stageScreen.width, height: stageScreen.height, zIndex: 71 }}
          >
            <svg className="absolute inset-0 h-full w-full overflow-visible" style={{ pointerEvents: 'none' }}>
              <rect
                x={left}
                y={top}
                width={boxWidth}
                height={boxHeight}
                fill="none"
                stroke="#f472b6"
                strokeWidth="1"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
              {corners.map((corner, index) => (
                <path
                  key={`handoff-corner-${index}`}
                  d={`M ${corner.x} ${corner.y + corner.sy * tick} L ${corner.x} ${corner.y} L ${corner.x + corner.sx * tick} ${corner.y}`}
                  fill="none"
                  stroke="#f472b6"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line x1={left} y1={widthLineY} x2={right} y2={widthLineY} stroke="#f472b6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={left} y1={widthLineY - tick} x2={left} y2={widthLineY + tick} stroke="#f472b6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={right} y1={widthLineY - tick} x2={right} y2={widthLineY + tick} stroke="#f472b6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={heightLineX} y1={top} x2={heightLineX} y2={bottom} stroke="#f472b6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={heightLineX - tick} y1={top} x2={heightLineX + tick} y2={top} stroke="#f472b6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={heightLineX - tick} y1={bottom} x2={heightLineX + tick} y2={bottom} stroke="#f472b6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-pink-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-950 shadow-md"
              style={{ left: (left + right) / 2, top: widthLineY }}
            >
              {Math.round(widthPx)} px
            </div>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-pink-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-950 shadow-md"
              style={{ left: heightLineX, top: (top + bottom) / 2 }}
            >
              {Math.round(heightPx)} px
            </div>
            <div
              className="absolute -translate-y-1/2 whitespace-nowrap rounded border border-pink-400/30 bg-slate-950/90 px-1.5 py-0.5 font-mono text-[9px] text-pink-200 shadow"
              style={{ left: badgeX, top: badgeY }}
            >
              X {Math.round(xPx)} · Y {Math.round(yPx)}
            </div>
          </div>
        );
      })()}

      {/* ===== 鐢诲竷鏈夋晥鍖哄煙杈圭晫甯告樉灞傦紙鍓槧寮忥級=====
          鍩轰簬 stageScreen锛坓etBoundingClientRect 娴嬮噺锛夊湪瑙嗗彛灞傜粯鍒讹紝涓嶅彈鑸炲彴 transform 缂╂斁褰卞搷锛?
          浠绘剰缂╂斁/骞崇Щ绾у埆涓嬬敾甯冩湁鏁堝尯鍩熺殑杈圭晫濮嬬粓娓呮櫚鍙锛堜慨澶?鏃犳硶纭鏈夋晥鍖哄煙"闂锛夈€?*/}
      {multiSelectionSummary && stageScreen && (
        <div
          className="absolute pointer-events-none"
          data-export-hide="true"
          style={{
            left: stageScreen.left + stageScreen.width * multiSelectionSummary.left / 100,
            top: stageScreen.top + stageScreen.height * multiSelectionSummary.top / 100,
            width: stageScreen.width * multiSelectionSummary.width / 100,
            height: stageScreen.height * multiSelectionSummary.height / 100,
            zIndex: 69,
          }}
        >
          <div className="absolute inset-0 rounded-[2px] border border-sky-400/90 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]" />
          <div
            data-aether-multi-toolbar="true"
            className="absolute pointer-events-auto flex items-center gap-0.5 rounded-lg border border-sky-400/30 bg-slate-950/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
            style={{
              left: multiToolbarAlignRight ? 'auto' : 0,
              right: multiToolbarAlignRight ? 0 : 'auto',
              top: stageScreen.top + stageScreen.height * multiSelectionSummary.top / 100 < 44 ? 4 : -36,
              whiteSpace: 'nowrap',
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="px-1.5 text-[10px] font-semibold text-sky-200">{multiSelectionSummary.count} 项</span>
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            {ALIGNMENT_TOOLBAR_ACTIONS.map((action, index) => {
              const Icon = action.icon;
              const needsThree = action.id.startsWith('distribute-');
              const disabled = needsThree && multiSelectionSummary.count < 3;
              const shortcut = customShortcuts.find((item) => item.id === action.id && item.enabled);
              const shortcutText = shortcut ? (shortcut.customKey || shortcut.defaultKey) : '';
              return (
                <React.Fragment key={action.id}>
                  {index === 6 && <span className="mx-0.5 h-4 w-px bg-white/10" />}
                  <button
                    type="button"
                    disabled={disabled}
                    title={disabled ? `${action.label}（至少选择 3 个图层）` : shortcutText ? `${action.label}（${shortcutText}）` : action.label}
                    aria-label={action.label}
                    onClick={(event) => {
                      event.stopPropagation();
                      applyAlignmentCommand(action.id);
                    }}
                    className="grid h-6 w-6 place-items-center rounded text-slate-300 transition hover:bg-sky-400/20 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Icon size={13} strokeWidth={2} />
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {isEditing && !isTimelinePreviewMode && stageScreen && (
        <>
          {commentMode && (
            <div
              className="absolute z-[60] cursor-crosshair"
              data-export-hide="true"
              style={{
                left: stageScreen.left,
                top: stageScreen.top,
                width: stageScreen.width,
                height: stageScreen.height,
                background: 'rgba(34, 211, 238, 0.035)',
                boxShadow: 'inset 0 0 0 1px rgba(34,211,238,.28)',
              }}
              onClick={(event) => {
                const rect = stageRef.current?.getBoundingClientRect();
                if (!rect || rect.width <= 0 || rect.height <= 0) return;
                const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
                const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
                setActiveCommentId(null);
                setCommentDraft({ x, y, text: '' });
              }}
            />
          )}

          {(comments || []).filter((comment) => comment.sceneId === activeSceneId).map((comment, index) => {
            const left = stageScreen.left + stageScreen.width * comment.x / 100;
            const top = stageScreen.top + stageScreen.height * comment.y / 100;
            const active = activeCommentId === comment.id;
            return (
              <button
                key={comment.id}
                type="button"
                data-export-hide="true"
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveCommentId(active ? null : comment.id);
                  setCommentDraft(null);
                }}
                aria-label={`评论 ${index + 1}：${comment.text.slice(0, 30)}`}
                title={comment.resolved ? '已解决评论' : comment.text}
                className={`absolute z-[66] grid h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 px-1 font-mono text-[9px] font-bold shadow-lg transition-transform hover:scale-110 ${
                  comment.resolved
                    ? 'border-emerald-300/70 bg-emerald-500/80 text-white'
                    : active
                      ? 'border-white bg-cyan-400 text-slate-950 ring-4 ring-cyan-400/25'
                      : 'border-white/80 bg-cyan-500 text-white'
                }`}
                style={{ left, top }}
              >
                {comment.resolved ? '✓' : index + 1}
              </button>
            );
          })}

          {(() => {
            const activeComment = (comments || []).find((comment) => comment.id === activeCommentId && comment.sceneId === activeSceneId);
            if (!activeComment) return null;
            const left = stageScreen.left + stageScreen.width * activeComment.x / 100;
            const top = stageScreen.top + stageScreen.height * activeComment.y / 100;
            return (
              <div
                data-export-hide="true"
                className="absolute z-[68] w-64 rounded-xl border border-cyan-400/25 bg-[#0b111a]/98 p-3 text-slate-200 shadow-2xl backdrop-blur-md"
                style={{
                  left: Math.max(8, Math.min(window.innerWidth - 280, left + 18)),
                  top: Math.max(8, Math.min(window.innerHeight - 210, top + 18)),
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-200">
                    <span>评论 {activeComment.resolved ? '· 已解决' : ''}</span>
                  </div>
                  <button type="button" onClick={() => setActiveCommentId(null)} className="grid h-5 w-5 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white" aria-label="关闭评论">
                    ×
                  </button>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-200">{activeComment.text}</p>
                <div className="mt-1.5 text-[9px] text-slate-500">
                  {activeComment.author || '我'} · {new Date(activeComment.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateComment?.(activeComment.id, { resolved: !activeComment.resolved })}
                    className={`rounded border px-1.5 py-0.5 text-[9px] ${activeComment.resolved ? 'border-white/10 text-slate-400 hover:text-white' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'}`}
                  >
                    {activeComment.resolved ? '重新打开' : '标为已解决'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (commentDeleteConfirmId === activeComment.id) {
                        onDeleteComment?.(activeComment.id);
                        setCommentDeleteConfirmId(null);
                        setActiveCommentId(null);
                      } else {
                        setCommentDeleteConfirmId(activeComment.id);
                      }
                    }}
                    className={`rounded px-1.5 py-0.5 text-[9px] ${commentDeleteConfirmId === activeComment.id ? 'bg-rose-500/20 text-rose-200' : 'text-slate-500 hover:text-rose-300'}`}
                  >
                    {commentDeleteConfirmId === activeComment.id ? '确认删除' : '删除'}
                  </button>
                </div>
              </div>
            );
          })()}

          {commentDraft && (() => {
            const left = stageScreen.left + stageScreen.width * commentDraft.x / 100;
            const top = stageScreen.top + stageScreen.height * commentDraft.y / 100;
            return (
              <div
                data-export-hide="true"
                className="absolute z-[69] w-64 rounded-xl border border-cyan-400/30 bg-[#0b111a]/98 p-2.5 text-slate-200 shadow-2xl backdrop-blur-md"
                style={{
                  left: Math.max(8, Math.min(window.innerWidth - 280, left + 14)),
                  top: Math.max(8, Math.min(window.innerHeight - 190, top + 14)),
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-cyan-200">
                  <span>在这里钉一条评论</span>
                  <button type="button" onClick={() => setCommentDraft(null)} className="text-slate-500 hover:text-white" aria-label="取消评论">×</button>
                </div>
                <textarea
                  autoFocus
                  value={commentDraft.text}
                  onChange={(event) => setCommentDraft((current) => current ? { ...current, text: event.target.value } : current)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setCommentDraft(null);
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                      event.preventDefault();
                      if (commentDraft.text.trim()) {
                        onAddComment?.(commentDraft.x, commentDraft.y, commentDraft.text);
                        setCommentDraft(null);
                      }
                    }
                  }}
                  rows={3}
                  placeholder="例如：这里的标题再大一点"
                  aria-label="评论内容"
                  className="w-full resize-none rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400"
                />
                <div className="mt-1.5 flex items-center justify-end gap-1.5">
                  <button type="button" onClick={() => setCommentDraft(null)} className="rounded px-2 py-1 text-[10px] text-slate-400 hover:text-white">取消</button>
                  <button
                    type="button"
                    disabled={!commentDraft.text.trim()}
                    onClick={() => {
                      onAddComment?.(commentDraft.x, commentDraft.y, commentDraft.text);
                      setCommentDraft(null);
                    }}
                    className="rounded bg-cyan-400 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-35"
                  >
                    发布评论
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {isEditing && viewport.showGrid && stageScreen && (
        <div
          className="absolute pointer-events-none"
          data-export-hide="true"
          style={{
            left: stageScreen.left,
            top: stageScreen.top,
            width: stageScreen.width,
            height: stageScreen.height,
            zIndex: 20,
            opacity: 0.78,
            backgroundImage: [
              'linear-gradient(to right, rgba(56,189,248,0.24) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(56,189,248,0.24) 1px, transparent 1px)',
              'linear-gradient(to right, rgba(56,189,248,0.58) 1px, transparent 1px)',
              'linear-gradient(to bottom, rgba(56,189,248,0.58) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: [
              `${stageScreen.width / GRID_COLUMNS}px 100%`,
              `100% ${stageScreen.height / GRID_ROWS}px`,
              `${stageScreen.width / (GRID_COLUMNS / 5)}px 100%`,
              `100% ${stageScreen.height / (GRID_ROWS / 5)}px`,
            ].join(', '),
          }}
        />
      )}

      {isEditing && !isFullscreenPreview && !isTimelinePreviewMode && !isDrawingTool
        && activeScene && activeScene.els.length === 0 && onAddElement && stageScreen && (
        <div className="aether-empty-canvas" role="region" aria-label="开始创建" style={{ inset: 'auto', left: stageScreen.left, top: stageScreen.top, width: stageScreen.width, height: stageScreen.height }}>
          <div className="aether-empty-canvas__card">
            <button
              type="button"
              className="aether-empty-canvas__import"
              onClick={() => {
                if (onRequestImportMedia) onRequestImportMedia();
                else onAddElement('img');
              }}
              aria-label="导入素材"
            >
              <span className="aether-empty-canvas__plus" aria-hidden="true">+</span>
              <span className="aether-empty-canvas__title">导入</span>
            </button>
            <p className="aether-empty-canvas__description">
              支持图片、视频、音频、3D模型、全景图、全景视频、高斯泼溅
            </p>
            <div className="aether-empty-canvas__actions" aria-label="快速添加">
              <button type="button" onClick={() => onAddElement('txt')}>
                <MessageSquare size={14} aria-hidden="true" />
                <span>文字</span>
              </button>
              <button type="button" onClick={() => onAddElement('shape')}>
                <Box size={14} aria-hidden="true" />
                <span>图形</span>
              </button>
            </div>
            <span className="aether-empty-canvas__hint">也可以将文件拖到画布中</span>
          </div>
        </div>
      )}

      {isEditing && stageScreen && (
        <div
          className="absolute pointer-events-none"
          data-export-hide="true"
          style={{
            left: stageScreen.left,
            top: stageScreen.top,
            width: stageScreen.width,
            height: stageScreen.height,
            // 杈呭姪绾垮彧灞炰簬鐢诲竷棰勮灞傦紝蹇呴』浣庝簬宸ヤ綔鍙板伐鍏锋爮/涓嬫媺鑿滃崟鍜屽簳閮?HUD銆?            zIndex: 30,
          }}
        >
          {/* 浜壊鎻忚竟 + 澶栧彂鍏?+ 寰急鍐呰‖锛岃鐢诲竷浠庢繁鑹茶儗鏅腑娴嚭 */}
          <div
            className="absolute inset-0"
            style={{
              border: '1.5px solid rgba(255,255,255,0.85)',
              boxShadow:
                '0 0 0 1px rgba(0,0,0,0.7), 0 0 24px rgba(56,189,248,0.22), 0 0 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          />
          {/* 鍥涜 L 瑙掓爣锛堥珮浜己璋冭竟鐣岋級 */}
          <div className="absolute" style={{ left: 0, top: 0, width: 18, height: 18, borderLeft: '3px solid #7dd3fc', borderTop: '3px solid #7dd3fc', marginLeft: -3, marginTop: -3 }} />
          <div className="absolute" style={{ right: 0, top: 0, width: 18, height: 18, borderRight: '3px solid #7dd3fc', borderTop: '3px solid #7dd3fc', marginRight: -3, marginTop: -3 }} />
          <div className="absolute" style={{ left: 0, bottom: 0, width: 18, height: 18, borderLeft: '3px solid #7dd3fc', borderBottom: '3px solid #7dd3fc', marginLeft: -3, marginBottom: -3 }} />
          <div className="absolute" style={{ right: 0, bottom: 0, width: 18, height: 18, borderRight: '3px solid #7dd3fc', borderBottom: '3px solid #7dd3fc', marginRight: -3, marginBottom: -3 }} />
          {/* 画布尺寸标识（顶中，移出边框并留出呼吸间距） */}
          <span
            className="absolute text-[10px] font-mono bg-black/85 text-sky-200 border border-sky-400/50 px-2 py-0.5 rounded-full leading-none tracking-wide shadow-md pointer-events-none select-none"
            style={{ top: -10, left: '50%', transform: 'translate(-50%, -100%)', whiteSpace: 'nowrap' }}
          >
            画布 {CANVAS_W}x{CANVAS_H}
          </span>
          {/* 底部提示：超出画布即不可见（移至左下方安全位置，避免遮挡与压线） */}
          <span
            className="absolute text-[9px] font-mono bg-black/80 text-white/70 border border-white/10 px-2 py-0.5 rounded leading-none pointer-events-none select-none"
            style={{ bottom: -24, left: 12, whiteSpace: 'nowrap' }}
          >
            画布外为无效区域
          </span>
        </div>
      )}

      {/* 瑙嗗彛灞傚畨鍏ㄦ锛堝壀鏄犻鏍煎畨鍏ㄥ尯锛夛細
          浣嶄簬 stage 涔嬪鐨勮鍙ｅ眰锛岄€氳繃 stageScreen锛坓etBoundingClientRect 娴嬮噺锛夌簿纭创鍚堣垶鍙般€?
          杈规/瑙掓爣/鏍囩鍏ㄩ儴浣跨敤鏅€?HTML 鍍忕礌鍗曚綅锛屼笉闅忚垶鍙?transform 缂╂斁鍙樼粏鎴栧け鐪燂紝
          浠绘剰缂╂斁/骞崇Щ绾у埆涓嬪畨鍏ㄥ尯濮嬬粓娓呮櫚鍙锛堜慨澶?瀹夊叏鍖轰笉鏄庢樉"闂锛夈€?*/}
      {viewport.showSafeArea && isEditing && stageScreen && (
        <div
          className="absolute pointer-events-none"
          data-export-hide="true"
          style={{
            left: stageScreen.left,
            top: stageScreen.top,
            width: stageScreen.width,
            height: stageScreen.height,
            // 瀹夊叏妗嗕笉搴旇鐩栧伐鍏锋爮鑿滃崟銆丠UD 鎴栧叾浠栫紪杈戞诞灞傘€?            zIndex: 40,
          }}
        >
          {/* 涓績鍗佸瓧鍙傝€冪嚎 */}
          <div className="absolute" style={{ left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.16)' }} />
          <div className="absolute" style={{ top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.16)' }} />

          {/* 澶栧眰锛氬姩浣滃畨鍏ㄥ尯 Action Safe (90%) 鈥?瀹炵嚎妗?*/}
          <div
            className="absolute"
            style={{
              left: '5%', top: '5%', width: '90%', height: '90%',
              border: '1.5px solid rgba(255,255,255,0.9)',
              boxShadow: '0 0 3px rgba(0,0,0,0.7), inset 0 0 0 rgba(255,255,255,0.2)',
            }}
          />
          {/* 鍥涜 L 瑙掓爣锛堥珮浜己璋冿紝鍙傝€冪嚎閲嶅彔澶勪篃娓呮櫚锛?*/}
          <div className="absolute" style={{ left: '5%', top: '5%', width: 15, height: 15, borderLeft: '3px solid #ffffff', borderTop: '3px solid #ffffff', marginLeft: -2, marginTop: -2 }} />
          <div className="absolute" style={{ right: '5%', top: '5%', width: 15, height: 15, borderRight: '3px solid #ffffff', borderTop: '3px solid #ffffff', marginRight: -2, marginTop: -2 }} />
          <div className="absolute" style={{ left: '5%', bottom: '5%', width: 15, height: 15, borderLeft: '3px solid #ffffff', borderBottom: '3px solid #ffffff', marginLeft: -2, marginBottom: -2 }} />
          <div className="absolute" style={{ right: '5%', bottom: '5%', width: 15, height: 15, borderRight: '3px solid #ffffff', borderBottom: '3px solid #ffffff', marginRight: -2, marginBottom: -2 }} />

          {/* 鍐呭眰锛氭爣棰樺畨鍏ㄥ尯 Title Safe (80%) 鈥?铏氱嚎 */}
          <div
            className="absolute"
            style={{
              left: '10%', top: '10%', width: '80%', height: '80%',
              border: '1.5px dashed rgba(255,255,255,0.55)',
            }}
          />

          {/* 瀛楀箷瀹夊叏绾匡紙搴曢儴 95% 澶勶級 */}
          <div className="absolute" style={{ left: '5%', right: '5%', bottom: '5%', height: 1.5, background: 'rgba(255,255,255,0.55)' }} />

          {/* 鏍囩锛堣鍙ｅ眰姝ｅ父瀛楀彿锛屾案涓嶅け鐪燂級 */}
          <span className="absolute text-[11px] font-mono bg-black/80 px-1.5 py-0.5 rounded text-white leading-none tracking-wide shadow" style={{ left: '5%', top: '5%', marginLeft: 4, marginTop: 4 }}>
            动作安全 90%
          </span>
          <span className="absolute text-[11px] font-mono bg-black/80 px-1.5 py-0.5 rounded text-white/90 leading-none tracking-wide shadow" style={{ right: '10%', top: '10%', marginRight: 4, marginTop: 4 }}>
            标题安全 80%
          </span>
          <span className="absolute text-[10px] font-mono bg-black/80 px-1.5 py-0.5 rounded text-white/85 leading-none tracking-wide shadow" style={{ right: '5%', bottom: '5%', marginRight: 4, marginBottom: 4 }}>
            字幕安全
          </span>
        </div>
      )}

      {/* 剪映式：拖拽/缩放/旋转时显示实时数值 HUD（固定视口层，不受画布缩放影响） */}
      {(isDraggingEl || resizeHandle || isRotating) && selectedElement && isEditing && (
        <div data-transform-hud="true" data-export-hide="true" className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 bg-[#0d111c]/90 border border-sky-500/40 px-4 py-2 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] backdrop-blur-md text-xs font-mono select-none pointer-events-none animate-in fade-in">
          <span className="text-sky-300">X <b data-hud-x="true" className="text-white" dangerouslySetInnerHTML={{ __html: `${Number((selectedElement.x || 0).toFixed(2))}%` }} /></span>
          <span className="text-sky-300">Y <b data-hud-y="true" className="text-white" dangerouslySetInnerHTML={{ __html: `${Number((selectedElement.y || 0).toFixed(2))}%` }} /></span>
          <span className="text-emerald-300">W <b data-hud-w="true" className="text-white" dangerouslySetInnerHTML={{ __html: `${Number((selectedElement.w || 0).toFixed(2))}%` }} /></span>
          <span className="text-emerald-300">H <b data-hud-h="true" className="text-white" dangerouslySetInnerHTML={{ __html: `${Number((selectedElement.h || 0).toFixed(2))}%` }} /></span>
          {selectedElement.type === 'txt' && <span className="text-violet-300">字号 <b data-hud-font="true" className="text-white" dangerouslySetInnerHTML={{ __html: `${Math.round(selectedElement.fontSize || 24)}px` }} /></span>}
          {isRotating && <span className="text-amber-300">旋转 <b data-hud-rot="true" className="text-white" dangerouslySetInnerHTML={{ __html: `${Number((selectedElement.rot || 0).toFixed(1))}°` }} /></span>}
        </div>
      )}

      {/* Floating Bottom HUD during Bezier Pen Mode */}
      {isDrawingTool && isEditing && (
        <>
        {penHudHidden ? (
          <button
            type="button"
            data-export-hide="true"
            onClick={() => setPenHudHidden(false)}
            className="absolute right-4 top-4 z-[200] flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/40 bg-[#0d111c]/90 text-cyan-200 shadow-lg backdrop-blur-md transition hover:bg-cyan-500/20"
            title="显示钢笔工具提示"
            aria-label="显示钢笔工具提示"
          >
            <PenTool size={15} />
          </button>
        ) : <div
          ref={penHudRef}
          data-export-hide="true"
          onPointerDown={handlePenHudPointerDown}
          className={`absolute z-[200] flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 bg-[#0d111c]/90 border border-cyan-500/40 px-4 py-2.5 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-md text-xs select-none cursor-move animate-in fade-in slide-in-from-top-2 ${penHudPosition ? '' : 'right-4 top-4'}`}
          style={penHudPosition ? { left: penHudPosition.left, top: penHudPosition.top } : undefined}
          title="拖动此处移动钢笔提示框"
        >
          <div className="flex min-w-0 items-center gap-2 pr-3 border-r border-white/10">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center">
              <PenTool size={13} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>{isMaskPenTool ? '钢笔蒙版' : isInteractionAreaTool ? '交互区域' : viewport.activeTool === 'shape-draw' ? '钢笔自定义形状' : 'Saber 钢笔矢量绘制'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                  {penNodes.length} {isInteractionAreaTool ? '边界点' : '锚点'}
                </span>
              </div>
              {!penHudCompact && (
                <>
                  <div className="text-[10px] text-cyan-200/80">
                    {isInteractionAreaTool
                      ? '依次点击区域边界；点击起点、双击或回车完成闭合。Esc 取消。'
                      : isMaskPenTool
                      ? '点击添加蒙版点，拖拽拉出手柄，双击或回车完成'
                      : viewport.activeTool === 'shape-draw'
                      ? '左键添加锚点并拖拽曲线；点击起点、回车或闭合路径生成形状，Esc 取消。'
                      : '左键添加锚点并拖拽曲线；双击、回车或右键完成开放路径，Esc 取消。'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {penNodes.length === 0 ? '在画布任意处点击设置第一个锚点' : '点击添加点，拖拽拉出手柄，双击或回车完成'}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPenHudCompact((value) => !value)}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
              title={penHudCompact ? '展开提示框' : '缩小提示框'}
              aria-label={penHudCompact ? '展开提示框' : '缩小提示框'}
            >
              {penHudCompact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setPenHudHidden(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200"
              title="隐藏提示框，继续绘制"
              aria-label="隐藏提示框，继续绘制"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleFinishPenPath(false)}
              disabled={penNodes.length < ((viewport.activeTool === 'shape-draw' || isInteractionAreaTool || isMaskPenTool) ? 3 : 2)}
              title={isInteractionAreaTool ? '完成交互区域（Enter）' : '完成开放路径（Enter）'}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black font-bold shadow-sm transition-all cursor-pointer"
            >
              <Check size={13} strokeWidth={3} />
            <span>{isMaskPenTool ? '应用蒙版 (Enter)' : isInteractionAreaTool ? '完成区域 (Enter)' : viewport.activeTool === 'shape-draw' ? '生成形状 (Enter)' : '完成绘制 (Enter)'}</span>
            </button>

            {penNodes.length >= 3 && (
              <button
                type="button"
                onClick={() => handleFinishPenPath(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold transition-all cursor-pointer"
              >
                <CircleDot size={13} />
                <span>闭合路径</span>
              </button>
            )}

            {penNodes.length > 0 && (
              <button
                type="button"
                onClick={handleUndoPenNode}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-medium transition-colors cursor-pointer"
              title={isInteractionAreaTool ? '撤销上一个边界点 (Backspace)' : '撤销上一个锚点 (Backspace)'}
            >
              {isInteractionAreaTool ? '撤销边界点 (Backspace)' : '撤销点 (Backspace)'}
              </button>
            )}

            <button
              type="button"
              onClick={handleCancelPenDrawing}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 text-slate-400 border border-white/10 font-medium transition-colors cursor-pointer"
              title="取消退出 (Esc)"
            >
              退出 (Esc)
            </button>
          </div>
        </div>}
        </>
      )}

      {/* Floating Bottom Preview Mode Playback Bar */}
      {!isEditing && (() => {
        // HUD 娆惧紡锛氭暟鍊间笌 src/utils/export.ts 鐨?generateHudCSS/generateHudHTML 瀹屽叏瀵归綈锛屼繚璇佺紪杈戝櫒棰勮=瀵煎嚭
        const hudStyle = projectData.hudConfig?.style || 'default';
        const showDots = projectData.hudConfig?.showDots !== false;
        const showTitle = projectData.hudConfig?.showTitle !== false;
        const hudCollapsible = projectData.hudConfig?.collapsible !== false;
        // 缂栬緫鍣ㄥ缁堥渶瑕佷竴涓€€鍑洪瑙堢殑鍏ュ彛
        const exitBtn = showExitPreviewButton ? (
          <button type="button" onClick={onToggleEditing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={{ background:'rgba(255,255,255,0.15)', color:'#fff' }}
            title="返回工作台 (E)">
            <span>返回工作台</span>
          </button>
        ) : null;
        if (hudStyle === 'hidden') {
          return exitBtn
            ? <div className="absolute bottom-5 right-5 z-50 opacity-20 hover:opacity-100 transition-opacity">{exitBtn}</div>
            : null;
        }
        const T = HUD_THEMES[hudStyle] || HUD_THEMES.default;
        const gestureOn = !!motionEnabled;
        const gestureLoading = gestureStatus === 'loading';
        const gestureDanger = gestureStatus === 'error' || gestureStatus === 'no-camera';
        if (hudCollapsed && hudCollapsible) {
          return <button type="button" data-testid="hud-expand" onClick={() => setHudCollapsed(false)}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[5000] flex items-center justify-center"
            style={{ width: 56, height: 16, borderRadius: '8px 8px 0 0', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.18)', borderBottom: 'none', color: 'rgba(255,255,255,0.8)' }}
            title="展开播放控制栏" aria-label="展开播放控制栏"><ChevronUp size={14} /></button>;
        }
        return (
            <>
            <style>{HUD_PULSE_KEYFRAMES}</style>
            <div style={T.bar} className="select-none">
              <button type="button" onClick={goToPrevScene} style={T.icon} title="上一场景"><Rewind size={16} /></button>
              <button type="button" onClick={onTogglePlay} style={T.btn} title="播放 / 暂停 (Space)">
                {isPlaying ? (<><Pause size={15} /><span>暂停</span></>) : (<><Play size={15} /><span>播放</span></>)}
              </button>
              <button type="button" onClick={goToNextScene} style={T.icon} title="下一场景"><FastForward size={16} /></button>
              {showDots && (
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {loopSceneKeys.map((sId) => <HudDot key={sId} active={activeSceneId === sId} theme={T} tech={hudStyle==='tech'} onClick={() => onSelectScene(sId)} />)}
                </div>
              )}
              <div style={T.time}>{renderTime.toFixed(2)}s</div>
              {T.divider && showTitle && <div style={{ width:1, height:16, background:'rgba(255,255,255,0.2)' }} />}
              {showTitle && <div style={T.title}>{projectData.scenes[activeSceneId]?.alias || 'Scene'}</div>}
              <HudSpecialDot on={isCruising} onClick={onToggleCruise}
                title={isCruising ? '巡航中（点击关闭）' : '巡航：播完自动切换下一个场景'}>
                <RefreshCw size={15} strokeWidth={2.2} />
              </HudSpecialDot>
              {onToggleMotion && (
                <HudSpecialDot on={gestureOn} loading={gestureLoading} danger={gestureDanger} onClick={onToggleMotion}
                  title={!gestureOn ? '体感手势控制：点击开启' : gestureStatus === 'ready' ? '体感运行中（点击关闭）' : gestureStatus === 'loading' ? '体感引擎加载中...' : '体感（点击切换）'}>
                  <Hand size={15} strokeWidth={2.2} />
                </HudSpecialDot>
              )}
              {onToggleFullscreenPreview && (
                <button type="button" onClick={onToggleFullscreenPreview} style={T.btn}
                  title={isFullscreenPreview ? '退出全屏 (Esc)' : '全屏 (F)'}>
                  {isFullscreenPreview ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  <span>全屏</span>
                </button>
              )}
              {hudCollapsible && <button type="button" data-testid="hud-collapse" onClick={() => setHudCollapsed(true)} style={T.icon}
                title="折叠播放控制栏" aria-label="折叠播放控制栏"><ChevronDown size={15} /></button>}
              {exitBtn}
            </div>
          </>
        );
      })()}

      {/* ==================== 缁熶竴寮圭獥娓叉煋锛坢odal / popover / inline 鍚堝苟锛?==================== */}
      {!isEditing && secondaryPopups.map((item, index) => {
        const popupScene = projectData.scenes[item.target];
        if (!popupScene) return null;
        const config = item.config;
        const geo = computePopupGeometry(config, config.popupDisplay || 'modal', getStageRect(), popoverAnchor);
        const popupTheme = normalizePopupTheme(config.popupTheme);
        const immersive = popupTheme === 'immersive';
        const scale = Math.min(geo.width / CANVAS_W, geo.height / CANVAS_H);
        const isClosing = item.closing === true;
        const longStay = isLongLivedPopup(config);
        const enterAnimation = config.popupAnimationType || 'fadeIn';
        const exitAnimation = config.popupExitAnimationType ?? 'fadeOut';
        const animationClass = isClosing
          ? getPopupExitAnimationClass(exitAnimation)
          : getPopupEnterAnimationClass(enterAnimation);
        const activeAnimation = isClosing ? exitAnimation : enterAnimation;
        const glowClass = !isClosing && enterAnimation !== 'none' && !immersive
          ? ' aether-popup-glow'
          : '';
        const animationStyle = activeAnimation === 'none' ? undefined : {
          animationDuration: `${isClosing ? Math.round((config.popupAnimationDuration || 500) * 0.72) : (config.popupAnimationDuration || 500)}ms`,
          animationFillMode: 'both' as const,
        };
        return <div key={item.id} className="fixed" style={{ zIndex: 10000 + index, pointerEvents: 'none' }}>
          <div className="fixed" style={{
            left: geo.left, top: geo.top, width: geo.width, height: geo.height,
            transform: geo.useCustom ? 'translate(-50%, -50%)' : undefined,
            pointerEvents: 'auto',
          }} onClick={(event) => event.stopPropagation()}>
            <div className={`popup-theme-popup popup-theme-${popupTheme} ${immersive ? '' : 'shadow-2xl'} ${animationClass}${glowClass}`} style={{
              width: '100%',
              height: '100%',
              background: immersive ? 'transparent' : config.popupBgColor || undefined,
              border: immersive ? 'none' : (config.popupBorderColor ? `1px solid ${config.popupBorderColor}` : undefined),
              borderRadius: immersive ? 0 : (config.popupRadius != null ? `${config.popupRadius}px` : 14),
              boxShadow: immersive
                ? 'none'
                : (config.popupGlowColor
                  ? `0 18px 50px rgba(0,0,0,0.55), 0 0 36px ${config.popupGlowColor}55`
                  : '0 18px 50px rgba(0,0,0,0.55)'),
              ['--popup-accent' as string]: config.popupAccentColor || undefined,
              ...(animationStyle || {}),
            }}>
              <div className="overflow-hidden" style={{ position: 'relative', width: '100%', height: '100%' }}>
                <div style={{
                  width: '100%', height: '100%',
                  animation: activeAnimation === 'none'
                    ? getSceneTransitionAnimation(popupScene, isClosing, false)
                    : 'none',
                }}>
                  <div className="absolute" style={{
                    left: '50%', top: '50%', width: CANVAS_W, height: CANVAS_H,
                    transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center',
                  }}>
                    <div className="absolute inset-0" style={{
                      ...getSceneBackgroundStyle(popupScene, (ref) => assetUrls[ref] || ref, getGradientBackground),
                      backgroundSize: 'cover', backgroundPosition: 'center',
                    }} />
                    {popupScene.els.map((popupElement) => <div key={popupElement.id} className="flex items-center justify-center text-center select-none" style={{
                      position: 'absolute', left: `${popupElement.x}%`, top: `${popupElement.y}%`, width: `${popupElement.w}%`, height: `${popupElement.h}%`,
                      transform: `rotate(${popupElement.rot || 0}deg)`, transformOrigin: 'center center',
                      opacity: popupElement.opacity !== undefined ? Math.max(0, Math.min(1, popupElement.opacity / 100)) : 1,
                      mixBlendMode: popupElement.blendMode || 'normal', zIndex: popupElement.zIndex,
                      ...(popupElement.type === 'txt' ? { ...getTextStyle(popupElement), padding: `${popupElement.textPadding ?? 8}px` } : {}),
                    }}>
                      {popupElement.type === 'txt' && (popupElement.content || '')}
                      {popupElement.type === 'img' && (popupElement.refId && resolveImageUrl(popupElement.refId) ? <img src={resolveImageUrl(popupElement.refId)} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} className="block w-full h-full object-contain" style={{ background: 'transparent' }} /> : <span className="text-xs text-slate-500">暂无素材</span>)}
                      {popupElement.type === 'shape' && <div className="relative w-full h-full" style={{ background: getShapeBackground(popupElement), clipPath: popupElement.clipPath || undefined, WebkitClipPath: popupElement.clipPath || undefined }}>
                        {popupElement.content && <div className="absolute inset-0 grid place-items-center whitespace-pre-wrap" style={{ ...getTextStyle(popupElement, { color: popupElement.textColor || popupElement.color || '#ffffff', fontSize: popupElement.fontSize || 16, defaultLineHeight: 1.1 }), padding: `${popupElement.shapePadding ?? 12}px`, boxSizing: 'border-box' }}>{popupElement.content}</div>}
                      </div>}
                      {popupElement.type === 'vid' && popupElement.refId && resolveVideoUrl(popupElement.refId) && <video
                        data-aether-popup-video
                        src={resolveVideoUrl(popupElement.refId)}
                        autoPlay={isPlaying}
                        muted
                        loop
                        playsInline
                        onCanPlay={(event) => { if (isPlaying && event.currentTarget.paused && !event.currentTarget.ended) void event.currentTarget.play().catch(() => {}); }}
                        onPlay={(event) => { if (!isPlaying) event.currentTarget.pause(); }}
                        className="w-full h-full object-contain"
                      />}
                      {(popupElement.type === 'saber' || popupElement.type === 'vfx') && <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${popupElement.color || '#ff2d95'}, transparent)`, opacity: 0.75 }} />}
                    </div>)}
                  </div>
                </div>
              </div>
              {!longStay && <button type="button" onClick={() => closeSecondaryPopup(item.id)} disabled={isClosing}
                className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white/80 hover:bg-black/70 disabled:pointer-events-none disabled:opacity-50" title="关闭弹窗"><X size={14} /></button>}
            </div>
          </div>
        </div>;
      })}
      {activePopupSceneId && !isEditing && (() => {
        const triggerEl = activePopupTriggerElement;
        if (!triggerEl) return null;

        const display = triggerEl.popupDisplay || 'modal';
        const popupTheme = normalizePopupTheme(triggerEl.popupTheme);
        const isImmersive = popupTheme === 'immersive';
        const closeOnOverlay = triggerEl.popupCloseOnOverlay ?? true;
        const longStay = isLongLivedPopup(triggerEl);
        const animType = triggerEl.popupAnimationType || 'fadeIn';
        const exitAnimType = triggerEl.popupExitAnimationType ?? 'fadeOut';
        const animDuration = triggerEl.popupAnimationDuration || 500;
        // 寮圭獥瀵瑰簲鐨勩€屽満鏅€嶏紝鐢ㄤ簬鍏跺満鏅骇杞満鍔ㄧ敾锛坱ransitionIn/transitionOut锛?

        const popupScene = projectData.scenes[activePopupSceneId];

        // 缁熶竴鍏抽棴锛堝脊绐?/ 娴眰鍗＄墖 / 鍘熷湴灞曞紑锛夌敱缁勪欢椤跺眰 closePopup 澶勭悊銆?
        // ========== 缁熶竴鍑犱綍璁＄畻锛氭墍鏈夊憟鐜版柟寮忓叡浜悓涓€濂椾綅缃?澶у皬閫昏緫 ==========
        // 銆愪慨澶嶃€戝脊绐椾綅缃?澶у皬蹇呴』鐩稿銆岃垶鍙般€嶏紙1920x1080 鍦烘櫙鐢诲竷锛夊畾浣嶏紝鑰岄潪娴忚鍣ㄨ鍙ｃ€?
        // 鑸炲彴閫氳繃 fitCanvas 閫傞厤瀹瑰櫒锛氬叏灞忔椂閾烘弧銆侀潪鍏ㄥ睆鏃跺甫杈硅窛缂╂斁锛岃鍙ｇ櫨鍒嗘瘮浼氬鑷?
        // 寮圭獥鐩稿鐢诲竷鐨勪綅缃湪鍏ㄥ睆/闈炲叏灞忔椂鍙戠敓鍋忕Щ銆傜粺涓€鐢?getStageRect() 浣滀负鍩哄噯銆?
        // 鍑犱綍鐢辩粍浠剁骇鍏变韩鍑芥暟 computePopupGeometry 璁＄畻 鈥斺€?涓庣紪杈戣櫄绾挎鏄悓涓€鍑芥暟锛屼繚璇佸儚绱犵骇涓€鑷淬€?

        const calcGeometry = () => computePopupGeometry(triggerEl, display, getStageRect(), popoverAnchor);


        const geo = calcGeometry();
        const hasOverlay = display === 'modal';
        const zIndex = hasOverlay ? 9999 : 9998;

        // 銆愭柟妗圓銆戝叆鍦哄姩鐢伙細鑷畾涔夐珮绾?keyframes锛堝畾鍒剁紦鍔?+ 澶嶅悎鍙樻崲 + 杞诲井妯＄硦銆屼粠铏氬埌瀹炪€嶏級锛?
        // 姣忎釜鍔ㄧ敾鍙犲姞 opacity + 浣嶇Щ/缂╂斁 + blur锛岃鎰熷悜銆屾垚鐗囩骇銆嶉潬鎷紱鏃堕暱鐢ㄥ唴鑱?animationDuration銆?

        const enterAnimClass = animType === 'none' ? '' :
          animType === 'fadeIn' ? 'aether-popup-anim aether-popup-ease-cubic aether-popup-fade-in' :
          animType === 'slideUp' ? 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-up-in' :
          animType === 'slideDown' ? 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-down-in' :
          animType === 'slideLeft' ? 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-left-in' :
          animType === 'slideRight' ? 'aether-popup-anim aether-popup-ease-expo aether-popup-slide-right-in' :
          animType === 'zoomIn' ? 'aether-popup-anim aether-popup-ease-quint aether-popup-zoom-in-in' :
          animType === 'zoomOut' ? 'aether-popup-anim aether-popup-ease-quint aether-popup-zoom-out-in' :
          animType === 'bounce' ? 'aether-popup-anim aether-popup-bounce-in' :
          animType === 'rotate' ? 'aether-popup-anim aether-popup-ease-quint aether-popup-rotate-in' : '';
        const exitAnimClass = getPopupExitAnimationClass(exitAnimType);
        const animClass = popupClosing ? exitAnimClass : enterAnimClass;
        // 鍏ュ満闄勫甫鐨勭鎶€鍏夎竟锛氫粎闈?immersive锛堟棤杈规绾満鏅級鏃跺姞锛岄棯鐜板悗娑堝け锛屼笉鏀瑰彉涓婚璇箟
        const glowClass = (!popupClosing && !isImmersive && animType !== 'none') ? ' aether-popup-glow' : '';
        // fillMode 'both'锛氬叆鍦哄墠搴旂敤鍒濆鎬併€佺粨鏉熸椂淇濇寔缁堟€侊紱閫€鍑哄姩鐢荤粨鏉熷悗淇濇寔娑堝け鎬侊紝閰嶅悎寤舵椂鍗歌浇
        const activeAnimType = popupClosing ? exitAnimType : animType;
        const cardAnimationDuration = popupClosing ? Math.round((animDuration || 500) * 0.72) : (animDuration || 500);
        const animStyle = activeAnimType === 'none' ? undefined : { animationDuration: `${cardAnimationDuration}ms`, animationFillMode: 'both' as const };

        // ========== 缁熶竴鍦烘櫙鍐呭娓叉煋锛氬伐绋嬬敾甯冨昂瀵稿唴閮ㄧ敾甯?+ transform:scale 绛夋瘮渚嬬缉鏀?==========
        // 銆愭柊澧炪€戝満鏅骇杞満鍔ㄧ敾灞傦細鎵撳紑寮圭獥鏃跺満鏅唴瀹瑰簲鐢ㄥ脊绐楀満鏅殑銆屽叆鍦鸿浆鍦恒€嶏紙transitionIn锛夛紝
        // 鍏抽棴寮圭獥锛坧opupClosing锛夋椂搴旂敤銆屽嚭鍦鸿浆鍦恒€嶏紙transitionOut锛夛紝涓庡満鏅垏鎹㈠姩鐢昏鍒欏畬鍏ㄤ竴鑷淬€?

        const renderSceneContent = (containerClass = '') => (
          <div ref={popupContentRef} className={containerClass} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
            <div style={{
              width: '100%', height: '100%',
              animation: popupClosing
                ? (activeAnimType === 'none' ? getSceneTransitionAnimation(popupScene, true, false) : 'none')
                : (activeAnimType === 'none' ? getSceneTransitionAnimation(popupScene, false, false) : 'none'),
            }}>
              <div style={{
                position: 'absolute', left: '50%', top: '50%',
                width: CANVAS_W, height: CANVAS_H,
                transform: `translate(-50%, -50%) scale(${popupContentScale})`,
                transformOrigin: 'center center',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  ...getSceneBackgroundStyle(popupScene, (ref) => assetUrls[ref] || ref, getGradientBackground),
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
                {projectData.scenes[activePopupSceneId]?.els?.map((popEl) => (
                  <div key={popEl.id} style={{
                    position: 'absolute',
                    left: `${popEl.x}%`, top: `${popEl.y}%`,
                    width: `${popEl.w}%`, height: `${popEl.h}%`,
                    transform: `rotate(${popEl.rot || 0}deg)`,
                    transformOrigin: 'center center',
                    opacity: popEl.opacity !== undefined ? Math.max(0, Math.min(1, popEl.opacity / 100)) : 1,
                    mixBlendMode: popEl.blendMode || 'normal',
                    zIndex: popEl.zIndex,
                    ...(popEl.type === 'txt' ? { ...getTextStyle(popEl), padding: `${popEl.textPadding ?? 8}px` } : {}),
                  }} className="flex items-center justify-center text-center select-none">
                    {popEl.type === 'txt' && (popEl.content || '双击编辑文字')}
                    {popEl.type === 'img' && (popEl.refId ? (
                      <img src={resolveImageUrl(popEl.refId)} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} className="block w-full h-full object-contain" style={{ background: 'transparent' }} />
                    ) : <span className="text-xs text-slate-500">暂无素材</span>)}
                    {popEl.type === 'shape' && (
                      <div className="relative w-full h-full" style={{ background: getShapeBackground(popEl), clipPath: popEl.clipPath || undefined, WebkitClipPath: popEl.clipPath || undefined }}>
                        {popEl.content && <div className="absolute inset-0 grid place-items-center whitespace-pre-wrap" style={{ ...getTextStyle(popEl, { color: popEl.textColor || popEl.color || '#ffffff', fontSize: popEl.fontSize || 16, defaultLineHeight: 1.1 }), padding: `${popEl.shapePadding ?? 12}px`, boxSizing: 'border-box' }}>{popEl.content}</div>}
                      </div>
                    )}
                    {popEl.type === 'vid' && popEl.refId && resolveVideoUrl(popEl.refId) && (
                      <video
                        data-aether-popup-video
                        src={resolveVideoUrl(popEl.refId)}
                        autoPlay={isPlaying}
                        muted
                        loop
                        playsInline
                        onCanPlay={(event) => { if (isPlaying && event.currentTarget.paused && !event.currentTarget.ended) void event.currentTarget.play().catch(() => {}); }}
                        onPlay={(event) => { if (!isPlaying) event.currentTarget.pause(); }}
                        className="w-full h-full object-contain"
                      />
                    )}
                    {(popEl.type === 'saber' || popEl.type === 'vfx') && (
                      <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${popEl.color || '#ff2d95'}, transparent)`, opacity: 0.75 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

        // ========== 缁熶竴寮圭獥鍗＄墖锛氬畾浣嶅眰涓庡姩鐢诲眰鍒嗙锛屽姩鐢讳綔鐢ㄤ簬鏁翠釜寮圭獥瑙嗚涓讳綋 ==========
        // 澶栧眰锛氫粎瀹氫綅锛坧osition:fixed + left/top + translate 灞呬腑锛夛紝鏃犺儗鏅€佹棤鍔ㄧ敾
        // 鍐呭眰锛氬脊绐楄瑙変富浣擄紙鑳屾櫙/杈规/闃村奖/鍦嗚/鍐呭锛? 鍏ュ満鍔ㄧ敾 鈥斺€?鍔ㄧ敾浣滅敤浜庢暣涓脊绐楋紝
        //       鑰屼笉鏄脊绐楀唴閮ㄧ殑鍏冪礌锛涘悓鏃跺姩鐢?transform 涓嶄細瑕嗙洊澶栧眰鐨勫畾浣?transform
        const popupCard = (
          <div
            style={{
              position: 'fixed',
              left: geo.left, top: geo.top,
              width: geo.width, height: geo.height,
              // 銆愪慨澶嶃€戣嚜瀹氫箟浣嶇疆鐢?translate(-50%,-50%) 璁╀腑蹇冪偣钀藉湪 (popupX,popupY)锛?
              // 鍔ㄧ敾 transform 鍦ㄥ唴灞傦紝涓嶄細瑕嗙洊姝ゅ畾浣嶃€?
              transform: geo.useCustom ? 'translate(-50%, -50%)' : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 鍐呭眰锛氬姩鐢诲眰 = 鏁翠釜寮圭獥锛堝惈鑳屾櫙/杈规/闃村奖/鍐呭锛?*/}
            <div
              className={`popup-theme-popup popup-theme-${popupTheme} ${isImmersive ? '' : 'shadow-2xl'} ${animClass}${glowClass}`}
              style={{
                width: '100%',
                height: '100%',
                // 鏃犲脊绐楁牱寮忥紙immersive锛夛細鑳屾櫙寮哄埗鍏ㄩ€忔槑锛堝儚 PNG 涓€鏍峰彧鏄剧ず鍦烘櫙鍐呭锛夛紝
                // 蹇界暐鐢ㄦ埛璁剧疆鐨勮嚜瀹氫箟鑳屾櫙鑹诧紱鍏朵粬娆惧紡鎵嶄娇鐢ㄨ嚜瀹氫箟鑳屾櫙鑹?
                background: isImmersive ? 'transparent' : (triggerEl.popupBgColor || undefined),
                // 浠呭綋鐢ㄦ埛鏄惧紡璁剧疆杈规鑹叉椂鎵嶅姞 1px 杈规锛屽惁鍒欎笉璁捐竟妗?
                // 锛堥粯璁ゆ寮忓凡鏃犺竟妗嗭紝寮圭獥浠ョ函鍦烘櫙鍛堢幇锛涢湏铏?璧涘崥绛夋寮忎繚鐣欎富棰樿嚜甯﹁竟妗嗭級
                border: isImmersive ? 'none' : (triggerEl.popupBorderColor ? `1px solid ${triggerEl.popupBorderColor}` : undefined),
                borderRadius: isImmersive ? 0 : (triggerEl.popupRadius != null ? `${triggerEl.popupRadius}px` : 14),
                // 鏃犲脊绐楁牱寮忥紙immersive锛夛細鏃犻槾褰憋紝閬垮厤鍑虹幇鈥滄瘺鐜荤拑/鏂瑰舰鎶曞奖杈圭紭鈥?
                boxShadow: isImmersive
                  ? 'none'
                  : (triggerEl.popupGlowColor
                    ? `0 18px 50px rgba(0,0,0,0.55), 0 0 36px ${triggerEl.popupGlowColor}55`
                    : '0 18px 50px rgba(0,0,0,0.55)'),
                ['--popup-accent' as string]: triggerEl.popupAccentColor || undefined,
                ...(animStyle || {}),
              }}
            >
              {/* 鍦烘櫙鍐呭鍗犳弧鏁翠釜寮圭獥 */}
              {renderSceneContent('absolute inset-0 overflow-hidden')}
              {/* 鍏抽棴鎸夐挳锛氶€忔槑灏忔寜閽紝涓嶉伄鎸″満鏅€佷笉鍙犲姞浠讳綍娣辫壊娓愬彉/鏍囬鏍?*/}
              {!longStay && <button
                type="button"
                onClick={closePopup}
                className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-black/30 text-white/70 hover:bg-black/60 hover:text-white transition-colors"
                style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                title="关闭弹窗"
              >
                <X size={14} />
              </button>}
            </div>
          </div>
        );

        // ========== 澶栧眰瀹瑰櫒锛歮odal 鏈夐伄缃╋紝popover/inline 鏃犻伄缃?==========
        if (hasOverlay) {
          return (
            <div
              className="fixed inset-0"
              style={{
                zIndex,
                backgroundColor: `rgba(0,0,0,${triggerEl.popupOverlayOpacity ?? 0.8})`,
                backdropFilter: `blur(${triggerEl.popupOverlayBlur ?? 24}px)`,
                WebkitBackdropFilter: `blur(${triggerEl.popupOverlayBlur ?? 24}px)`,
                animation: activeAnimType === 'none'
                  ? undefined
                  : `${popupClosing ? 'aether-popup-overlay-out' : 'aether-popup-overlay-in'} ${cardAnimationDuration}ms ${popupClosing ? 'cubic-bezier(0.4, 0, 1, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)'} both`,
              }}
              onClick={() => { if (!longStay && closeOnOverlay) closePopup(); }}
            >
              {popupCard}
            </div>
          );
        }

        return (
          <div className="fixed inset-0" style={{ zIndex }} onClick={longStay ? undefined : closePopup}>
            {popupCard}
          </div>
        );
      })()}

      {/* 缂栬緫妯″紡锛氬脊绐楀彲瑙嗗寲缂栬緫鍣?鈥斺€?鎷栨嫿绉诲姩 + 鎵嬫焺缂╂斁 + 鏅鸿兘瀵归綈 */}
      {/* 銆愪慨澶嶃€戝彧瑕佷綅缃垨澶у皬浠讳竴鏄嚜瀹氫箟灏辨樉绀鸿櫄绾挎锛屼綅缃ぇ灏忓畬鍏ㄧ敱铏氱嚎妗嗘帶鍒?*/}
      {isEditing && popupEditTarget && (() => {
        const popupSource = popupEditTarget.source;
        const pl = popupSource.popupX || 50;
        const pt = popupSource.popupY || 50;
        const isDragging = popupDragState !== null;
        // 銆愭牳蹇冦€戣櫄绾挎鍑犱綍 = 婕旂ず寮圭獥鍑犱綍锛堝悓涓€ computePopupGeometry 鍏变韩鍑芥暟锛夛紝
        // 淇濊瘉銆岄鍒ゆ€х紪杈戙€嶅儚绱犵骇涓€鑷达細铏氱嚎妗嗗湪鍝€佷粈涔堝昂瀵革紝寮圭獥灏卞湪鍝€佸氨鏄粈涔堝昂瀵搞€?

        const stage = getStageRect();
        const popupDisplay = popupSource.popupDisplay || 'modal';
        const dashGeo = computePopupGeometry(popupSource, popupDisplay, stage, null);
        const dashLeft = dashGeo.left;
        const dashTop = dashGeo.top;
        const dashWidth = dashGeo.width;
        const dashHeight = dashGeo.height;
        // 鏍囩鏄剧ず瀹為檯鐢熸晥鐨勫嚑浣曪紙鐩稿鑸炲彴鐧惧垎姣旓級锛屼笌寮圭獥瀹屽叏瀵瑰簲銆?
        // 娉ㄦ剰锛歝ustom 浣嶇疆鏃?left/top 鏄€屼腑蹇冨畾浣嶅€笺€嶏紙閰嶅悎 translate(-50%,-50%)锛夛紝
        // 闈?custom 鏃?left/top 鏄€屽乏涓婅銆嶏紝涓績闇€ + 鍗婂/鍗婇珮銆?

        const dashCenterX = dashGeo.useCustom ? dashLeft : dashLeft + dashWidth / 2;
        const dashCenterY = dashGeo.useCustom ? dashTop : dashTop + dashHeight / 2;
        const labelCX = Math.round((dashCenterX - stage.left) / stage.width * 100);
        const labelCY = Math.round((dashCenterY - stage.top) / stage.height * 100);
        const labelW = Math.round(dashWidth / stage.width * 100);
        const labelH = Math.round(dashHeight / stage.height * 100);
        // 姣斾緥鏍囩锛氫笌 InspectorPanel銆屽楂樻瘮銆嶄竴鑷达紙鑷畾涔夋椂鏄剧ず W:H锛?

        const ratioLabel = popupSource.popupRatio === 'free'
          ? '自由'
          : (popupSource.popupRatio || '16:9') === 'custom'
            ? `${popupSource.popupRatioW || 16}:${popupSource.popupRatioH || 9}`
            : (popupSource.popupRatio || '16:9');

        // 鎷栧姩铏氱嚎妗?= 鐢ㄦ埛瑕佽嚜瀹氫箟浣嶇疆/灏哄锛氳嚜鍔ㄦ妸 position/size 鍒囦负 custom锛屼娇 popupX/Y/W/H 鐢熸晥
        const ensureCustom = () => {
          const next: Record<string, string> = {};
          if ((popupSource.popupPosition || 'center') !== 'custom') next.popupPosition = 'custom';
          if ((popupSource.popupSize || 'medium') !== 'custom') next.popupSize = 'custom';
          if (Object.keys(next).length > 0) updatePopupTarget(next);
        };

        const startMove = (e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.button !== 0) return;
          ensureCustom();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setPopupDragState({
            type: 'move', pointerId: e.pointerId, startMouseX: e.clientX, startMouseY: e.clientY,
            startX: pl, startY: pt, startW: labelW, startH: labelH,
          });
        };

        const startResize = (handle: string) => (e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.button !== 0) return;
          const freeAspect = shouldUseFreePopupResize(popupSource.popupRatio, handle);
          const resizePatch: Record<string, unknown> = {};
          if ((popupSource.popupPosition || 'center') !== 'custom') resizePatch.popupPosition = 'custom';
          if ((popupSource.popupSize || 'medium') !== 'custom') resizePatch.popupSize = 'custom';
          // A side handle changes one dimension by definition. Persist the
          // transition to free sizing so legacy locked nodes become editable
          // without discarding explicit ratios when a corner is dragged.
          if (freeAspect && popupSource.popupRatio !== 'free') {
            resizePatch.popupRatio = 'free';
            resizePatch.popupHeight = labelH;
          }
          if (Object.keys(resizePatch).length > 0) updatePopupTarget(resizePatch);
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setPopupDragState({
            type: 'resize', handle, pointerId: e.pointerId,
            startMouseX: e.clientX, startMouseY: e.clientY,
            startX: pl, startY: pt, startW: labelW, startH: labelH,
            aspect: resolvePopupAspect(popupSource),
            freeAspect,
          });
        };

        const handles = [
          { key: 'nw', style: { top: -6, left: -6, cursor: 'nwse-resize' } },
          { key: 'n', style: { top: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
          { key: 'ne', style: { top: -6, right: -6, cursor: 'nesw-resize' } },
          { key: 'e', style: { top: '50%', right: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
          { key: 'se', style: { bottom: -6, right: -6, cursor: 'nwse-resize' } },
          { key: 's', style: { bottom: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
          { key: 'sw', style: { bottom: -6, left: -6, cursor: 'nesw-resize' } },
          { key: 'w', style: { top: '50%', left: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
        ];
        const activePopupColor = popupEditTarget.kind === 'hotspot'
          ? '#38bdf8'
          : popupSource.color || POPUP_COLORS[popupEditTarget.index % POPUP_COLORS.length];

        return (
          <>
            {popupEditTarget.kind === 'element' && elementPopups.map((popup, index) => {
              if (index === popupEditTarget.index) return null;
              const color = popup.color || POPUP_COLORS[index];
              const geometry = computePopupGeometry(popup, popup.popupDisplay || 'modal', stage, null);
              return <button
                key={popup.id}
                type="button"
                data-export-hide="true"
                title={`编辑弹窗 ${index + 1}`}
                className="fixed z-[8990] cursor-pointer"
                style={{
                  left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height,
                  transform: geometry.useCustom ? 'translate(-50%, -50%)' : undefined,
                  border: `2px dashed ${color}`,
                  background: `${color}12`,
                  boxShadow: `0 0 18px ${color}35`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onUpdateElement(popupEditTarget.owner.id, { popupActiveId: popup.id });
                }}
              >
                <span className="absolute -top-6 left-0 rounded px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>弹窗 {index + 1}</span>
              </button>;
            })}
            {popupEditTarget.kind === 'continuous-node' && continuousPopupNodes.map(({ node, index, source }) => {
              if (node.id === popupEditTarget.node.id) return null;
              const color = source.color || POPUP_COLORS[index % POPUP_COLORS.length];
              const geometry = computePopupGeometry(source, source.popupDisplay || 'modal', stage, null);
              return <button
                key={source.id}
                type="button"
                data-export-hide="true"
                title={`编辑节点 ${index + 1} 的弹窗`}
                className="fixed z-[8990] cursor-pointer"
                style={{
                  left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height,
                  transform: geometry.useCustom ? 'translate(-50%, -50%)' : undefined,
                  border: `2px dashed ${color}`,
                  background: `${color}12`,
                  boxShadow: `0 0 18px ${color}35`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const config = normalizeContinuousInteraction(popupEditTarget.owner.uiComponentData?.continuousInteraction as ContinuousInteractionConfig | undefined);
                  onUpdateElement(popupEditTarget.owner.id, {
                    uiComponentData: {
                      ...(popupEditTarget.owner.uiComponentData || {}),
                      continuousInteraction: { ...config, activeNodeId: node.id },
                    },
                  });
                }}
              >
                <span className="absolute -top-6 left-0 rounded px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>节点 {index + 1}</span>
              </button>;
            })}
            {popupAlignLines.v !== null && (
              <div data-export-hide="true" className="editing-assistance-layer fixed z-[80] pointer-events-none" style={{ left: stage.left + (popupAlignLines.v / 100) * stage.width, top: 0, width: 1, height: '100vh', background: 'rgba(239,68,68,0.7)', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
            )}
            {popupAlignLines.h !== null && (
              <div data-export-hide="true" className="editing-assistance-layer fixed z-[80] pointer-events-none" style={{ top: stage.top + (popupAlignLines.h / 100) * stage.height, left: 0, height: 1, width: '100vw', background: 'rgba(239,68,68,0.7)', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
            )}

            <div
              data-export-hide="true"
              className={`fixed z-[9000] rounded-xl flex items-center justify-center select-none ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
              style={{
                left: dashLeft, top: dashTop, width: dashWidth, height: dashHeight,
                transform: dashGeo.useCustom ? 'translate(-50%, -50%)' : undefined,
                background: isDragging ? `${activePopupColor}22` : `${activePopupColor}12`,
                border: `2px solid ${activePopupColor}`,
                boxShadow: isDragging ? `0 0 32px ${activePopupColor}88` : `0 0 20px ${activePopupColor}55`,
                transition: isDragging ? 'none' : 'background 0.15s, box-shadow 0.15s',
              }}
              onPointerDown={startMove}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-500 text-white text-[11px] font-bold rounded-md whitespace-nowrap shadow-lg flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                拖动移动 / 边角缩放 / {labelCX}%,{labelCY}% / {labelW}x{labelH} / {ratioLabel}
              </div>
              <div className="absolute pointer-events-none" style={{ width: 20, height: 20, opacity: 0.4 }}>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-sky-400" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-sky-400" />
              </div>
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-sky-500/80 text-white text-[10px] font-mono rounded">
                {labelW}% x {labelH}% / {ratioLabel}
              </div>
              {handles.map((h) => (
                <div
                  key={h.key}
                  className="absolute w-3 h-3 bg-white border-2 border-sky-500 rounded-sm shadow-md hover:bg-sky-100 hover:scale-125 transition-transform z-10"
                  style={{ ...h.style, cursor: h.style.cursor as string }}
                  onPointerDown={startResize(h.key)}
                />
              ))}
            </div>
          </>
        );
      })()}

      {/* 銆愬彸閿笂浼犮€戠紪杈戞ā寮忕敾甯冪┖鐧藉鍙抽敭涓婁紶鍚勭被鍨嬬礌鏉愶紙涓婁紶骞舵坊鍔犲埌鐢诲竷锛?*/}
      {textContextMenu && isEditing && (
        <div data-export-hide="true">
          <div className="fixed inset-0 z-[10050]" onMouseDown={() => setTextContextMenu(null)} />
          <ContextTargetMenu
            x={textContextMenu.x}
            y={textContextMenu.y}
            activeSceneId={activeSceneId}
            scenes={projectData.scenes}
            heading="绑定选中文字热点"
            onAssign={(action, targetSceneId) => assignTextContextInteraction(action, targetSceneId)}
            onClose={() => setTextContextMenu(null)}
          />
        </div>
      )}


      {ctxMenu && isEditing && (
        <div data-export-hide="true">
          <div className="fixed inset-0 z-[10050]" onMouseDown={() => setCtxMenu(null)} />
          {ctxMenu.elementId ? (
            <ContextTargetMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              activeSceneId={activeSceneId}
              scenes={projectData.scenes}
              currentInteraction={contextMenuElement ? resolveInteraction(contextMenuElement) : undefined}
              onAssign={(action, targetSceneId) => assignContextInteraction(action, targetSceneId)}
              onClose={() => setCtxMenu(null)}
            />
          ) : (<div
            className="fixed z-[10060] w-44 py-1 rounded-lg bg-[#161822] border border-white/10 shadow-2xl"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 190), top: Math.min(ctxMenu.y, window.innerHeight - 240) }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] text-slate-500 font-medium border-b border-white/5 flex items-center gap-1.5">
              <Upload size={11} /> 上传素材到画布
            </div>
            <button type="button" onClick={() => ctxImgRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-sky-500/20 hover:text-sky-200 transition-colors">
              <ImageIcon size={13} className="text-sky-400" /> 上传图片
            </button>
            <button type="button" onClick={() => ctxVidRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-sky-500/20 hover:text-sky-200 transition-colors">
              <VideoIcon size={13} className="text-cyan-400" /> 上传视频
            </button>
            <button type="button" onClick={() => ctxAudRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-sky-500/20 hover:text-sky-200 transition-colors">
              <Music size={13} className="text-fuchsia-400" /> 上传音频
            </button>
            <button type="button" onClick={() => ctxModelRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-sky-500/20 hover:text-sky-200 transition-colors">
              <Box size={13} className="text-amber-400" /> 上传 3D 模型
            </button>
            <button type="button" onClick={() => ctxPanoRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-sky-500/20 hover:text-sky-200 transition-colors">
              <Globe size={13} className="text-emerald-400" /> 上传全景图
            </button>
          </div>)}
        </div>
      )}
      {/* 闅愯棌鏂囦欢閫夋嫨鍣紙鍙抽敭鑿滃崟瑙﹀彂锛?*/}
      <input ref={ctxImgRef} type="file" accept="image/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxImgRef.current)} />
      <input ref={ctxVidRef} type="file" accept="video/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxVidRef.current)} />
      <input ref={ctxAudRef} type="file" accept="audio/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxAudRef.current)} />
      <input ref={ctxModelRef} type="file" accept=".glb,.gltf,.obj,.fbx,.stl,.3mf,.dae,.ply,model/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxModelRef.current)} />
      <input ref={ctxPanoRef} type="file" accept="image/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxPanoRef.current)} />
    </div>
  );
};

// During playback, parent UI clock updates must not force an extra canvas render.
// The canvas subscribes to playbackClock directly while all editing props remain
// compared normally, so selecting, dragging and property changes stay immediate.
export const CanvasViewport = React.memo(CanvasViewportBase, (previous, next) => {
  const keys = Object.keys(previous) as Array<keyof CanvasViewportProps>;
  return keys.every((key) => (
    key === 'currentTime' && previous.isPlaying && next.isPlaying
      ? true
      : Object.is(previous[key], next[key])
  ));
});
