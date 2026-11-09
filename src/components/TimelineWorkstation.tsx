import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  Play, Pause, Square, SkipBack, SkipForward, ChevronDown, 
  ChevronUp, ZoomIn, ZoomOut, Lock, Unlock,
  Music, Volume2, Magnet, Scissors, Copy, Trash2, CheckSquare, X, Layers, Unlink, Eye, EyeOff, Diamond, Search
} from 'lucide-react';
import { ProjectData, SceneElement, HistoryActionType, ViewportState } from '../types';
import { ViewportToolButtons } from './WorkstationToolbar';
import { getPlaybackClockTime, subscribePlaybackClock, usePlaybackClockTime } from '../core/playbackClock';
import { getNextLayerVisibility, isLayerVisible } from '../core/timeline/layerVisibility';
import { moveKeyframe, shiftKeyframes, type KeyframeProperty } from '../core/animation/keyframes';
import { createPastedElements } from '../core/timeline/elementClipboard';
import { getScenePlaybackRange } from '../core/timeline/sceneRange';

interface TimelineWorkstationProps {
  projectData: ProjectData;
  activeSceneId: string;
  selectedElementId: string | null;
  multiSelectedIds: string[];
  onSelectElement: (id: string | null) => void;
  onMultiSelectionChange: (ids: string[], primaryId: string | null) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteElements: (ids: string[]) => void;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>, actionTitle?: string, recordHistory?: boolean) => void;
  onCommitHistory?: (title: string, actionType?: HistoryActionType, details?: string) => void;
  onUpdateProject: (updater: (prev: ProjectData) => ProjectData, actionTitle?: string, actionType?: HistoryActionType, details?: string, recordHistory?: boolean) => void;
  onDeleteElement?: (elId: string) => void;
  onSplitElement?: (elId: string) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  isTimelineCollapsed: boolean;
  onToggleTimelineCollapse: () => void;
  /** 合并选中图层为嵌套容器（可拆开） */
  onMergeElements?: (targetIds?: string[]) => void;
  /** 拆开合并图层组 */
  onUnmergeElement?: (elId: string) => void;
  viewport: ViewportState;
  onUpdateViewport: (updater: (prev: ViewportState) => ViewportState) => void;
  timelineHeight?: number;
  isResizingTimeline?: boolean;
}

const TimelinePlayhead: React.FC<{
  fallbackTime: number;
  isPlaying: boolean;
  zoom: number;
  rangeStart: number;
  rangeEnd: number;
  onPointerDown: (event: React.PointerEvent) => void;
}> = ({ fallbackTime, isPlaying, zoom, rangeStart, rangeEnd, onPointerDown }) => {
  const playheadRef = useRef<HTMLDivElement>(null);
  const applyPosition = (time: number) => {
    const node = playheadRef.current;
    if (node) node.style.transform = `translate3d(${time * zoom}px, 0, 0)`;
  };

  useEffect(() => {
    const node = playheadRef.current;
    if (!node || !isPlaying) {
      applyPosition(fallbackTime);
      return;
    }

    const span = Math.max(0, rangeEnd - rangeStart);
    const clockTime = getPlaybackClockTime();
    const normalizedTime = span > 0
      ? rangeStart + ((((clockTime - rangeStart) % span) + span) % span)
      : clockTime;
    applyPosition(normalizedTime);

    // Web Animations can keep transform interpolation on the compositor even
    // while React or media setup briefly occupies the main thread.
    if (span > 0 && typeof node.animate === 'function') {
      const animation = node.animate(
        [
          { transform: `translate3d(${rangeStart * zoom}px, 0, 0)` },
          { transform: `translate3d(${rangeEnd * zoom}px, 0, 0)` },
        ],
        {
          duration: span * 1000,
          iterations: Infinity,
          easing: 'linear',
        },
      );
      animation.currentTime = Math.max(0, (normalizedTime - rangeStart) * 1000);
      return () => animation.cancel();
    }

    return subscribePlaybackClock(() => applyPosition(getPlaybackClockTime()));
  }, [fallbackTime, isPlaying, rangeEnd, rangeStart, zoom]);

  return (
    <div
      ref={playheadRef}
      className="absolute left-0 top-0 bottom-0 w-[1px] bg-rose-500 shadow-[0_0_8px_#f43f5e] z-30 pointer-events-none will-change-transform"
    >
      <div
        onPointerDown={onPointerDown}
        className="absolute -top-1.5 -left-3 w-6 h-8 flex flex-col items-center justify-start cursor-grab active:cursor-grabbing pointer-events-auto group z-40"
        title="时间指针（按住自由拖动）"
      >
        <div className="w-3.5 h-3.5 bg-rose-500 rotate-45 border-2 border-white shadow-lg group-hover:scale-125 transition-transform group-hover:bg-rose-400 ring-2 ring-rose-500/50" />
        <div className="absolute -top-6 bg-rose-950/95 text-rose-200 border border-rose-500/60 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {fallbackTime.toFixed(2)}s
        </div>
      </div>
    </div>
  );
};

const TimelineClockText: React.FC<{ fallbackTime: number; isPlaying: boolean }> = ({ fallbackTime, isPlaying }) => {
  const time = usePlaybackClockTime(fallbackTime, isPlaying, 12);
  return <span className="font-mono font-bold text-sky-400">{time.toFixed(2)}s</span>;
};

const TimelineClockSlider: React.FC<{
  fallbackTime: number;
  isPlaying: boolean;
  max: number;
  onSeek: (time: number) => void;
}> = ({ fallbackTime, isPlaying, max, onSeek }) => {
  const time = usePlaybackClockTime(fallbackTime, isPlaying, 12);
  return (
    <input
      type="range"
      min="0"
      max={max}
      step="0.05"
      value={Math.max(0, Math.min(max, time))}
      onChange={(event) => onSeek(parseFloat(event.target.value))}
      className="w-32 accent-sky-400 h-1.5 cursor-pointer bg-white/10 rounded-full"
      title="自由拖动时间指针 (无上限限制)"
    />
  );
};

export const TimelineWorkstation = React.memo<TimelineWorkstationProps>(function TimelineWorkstation({
  projectData,
  activeSceneId,
  selectedElementId,
  multiSelectedIds,
  onSelectElement,
  onMultiSelectionChange,
  onSelectAll,
  onClearSelection,
  onDeleteElements,
  onUpdateElement,
  onCommitHistory,
  onUpdateProject,
  onDeleteElement,
  onSplitElement,
  currentTime,
  onSeek,
  isPlaying,
  onTogglePlay,
  onStop,
  isTimelineCollapsed,
  onToggleTimelineCollapse,
  onMergeElements,
  onUnmergeElement,
  viewport,
  onUpdateViewport,
  timelineHeight = 288,
  isResizingTimeline = false,
}) {
  const [zoom, setZoom] = useState(25); // pixels per second
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true); // Magnetic snapping toggle
  const [snapGuide, setSnapGuide] = useState<{ 
    time: number; 
    label: string; 
    type: 'out' | 'in' | 'playhead' | 'scene' | 'clip';
    edge?: 'start' | 'end';
  } | null>(null);

  const [draggingClip, setDraggingClip] = useState<{
    id: string;
    mode: 'move' | 'trim-left' | 'trim-right';
    startX: number;
    origStartTime: number;
    origDuration: number;
    origKeyframes?: SceneElement['keyframes'];
    previewStartTime: number;
    previewDuration: number;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackCanvasRef = useRef<HTMLDivElement>(null);
  // 批量拖动时跟随的组（多选元素原始时间快照）
  const draggingGroupRef = useRef<{ id: string; origStart: number }[]>([]);
  const clipSelectionHandledRef = useRef(false);
  // 防止 clip 上 mousedown 与冒泡 click 重复处理多选

  // 剪映式时间线编辑：拖动换轨 + 右键菜单
  const [contextMenu, setContextMenu] = useState<{ elId: string; x: number; y: number } | null>(null);
  const [dragOverTrackIndex, setDragOverTrackIndex] = useState<number | null>(null);
  const dragOverTrackIndexRef = useRef<number | null>(null);

  const activeScene = projectData.scenes[activeSceneId] || Object.values(projectData.scenes)[0];
  // Playback moves the playhead frequently, but track sorting and duration scans
  // only need to run when the scene data itself changes.
  const timelineMetrics = useMemo(() => {
    const elements = activeScene ? [...activeScene.els].sort((a, b) => b.zIndex - a.zIndex) : [];
    const duration = activeScene?.duration || 10;
    const maxEnd = elements.reduce((max, el) => Math.max(max, el.startTime + el.duration), 0);
    const effectiveDuration = Math.max(duration, maxEnd, 10);

    return {
      sortedElements: elements,
      sceneDuration: duration,
      effectiveMaxDuration: effectiveDuration,
      totalRulerDuration: Math.max(effectiveDuration + 20, 60),
    };
  }, [activeScene]);
  const { sortedElements, sceneDuration, effectiveMaxDuration, totalRulerDuration } = timelineMetrics;
  const [trackSearchQuery, setTrackSearchQuery] = useState('');

  const displayedElements = useMemo(() => {
    const query = trackSearchQuery.trim().toLowerCase();
    if (!query) return sortedElements;
    return sortedElements.filter((el) => {
      const name = (el.sourceName || '').toLowerCase();
      const content = (el.content || '').toLowerCase();
      const type = el.type.toLowerCase();
      const id = el.id.toLowerCase();
      return name.includes(query) || content.includes(query) || type.includes(query) || id.includes(query);
    });
  }, [sortedElements, trackSearchQuery]);

  // 当用户在画布或列表中选中图层时，自动平滑滚动时间轴聚焦该图层轨道
  useEffect(() => {
    if (!selectedElementId || isTimelineCollapsed) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetRow = container.querySelector<HTMLElement>(`[data-header-track-id="${CSS.escape(selectedElementId)}"]`);
    if (targetRow) {
      targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedElementId, isTimelineCollapsed]);

  // In / Out Reference points
  const sceneRange = useMemo(() => getScenePlaybackRange(activeScene), [activeScene]);
  // Keep marker visibility tied to authored values. The normalized range is
  // used for playback and playhead motion, while an unset marker stays hidden.
  const inPoint = activeScene && typeof activeScene.inPoint === 'number' && Number.isFinite(activeScene.inPoint)
    ? Math.max(0, Math.min(sceneRange.duration, activeScene.inPoint))
    : null;
  const outPoint = activeScene && typeof activeScene.outPoint === 'number' && Number.isFinite(activeScene.outPoint)
    ? Math.max(0, Math.min(sceneRange.duration, activeScene.outPoint))
    : null;

  // —— 全局拖拽/scrub 的 ref 镜像：让 window 级 mousemove/mouseup 监听器保持常驻，
  //    避免因 currentTime 等高频 state 变化导致 listener 反复重注册、mouseup 丢失，
  //    从而出现"指针拖拽后仍自动跟随鼠标"的问题 ——
  const isScrubbingRef = useRef(false);
  const draggingClipRef = useRef<{
    id: string;
    mode: 'move' | 'trim-left' | 'trim-right';
    startX: number;
    origStartTime: number;
    origDuration: number;
    origKeyframes?: SceneElement['keyframes'];
    previewStartTime: number;
    previewDuration: number;
    previewSceneDuration?: number;
    moved: boolean;
  } | null>(null);
  const draggingKeyframeRef = useRef<{
    elementId: string;
    properties: Array<{ property: KeyframeProperty; keyframeId: string }>;
    startX: number;
    origTime: number;
    origKeyframes?: SceneElement['keyframes'];
    moved: boolean;
  } | null>(null);
  // Coalesce high-frequency clip drag events to one project update per frame.
  const clipDragFrameRef = useRef<number | null>(null);
  const pendingClipPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const processingClipDragRef = useRef(false);
  const publishedClipPreviewRef = useRef<{ id: string; start: number; duration: number } | null>(null);
  const scrubFrameRef = useRef<number | null>(null);
  const pendingScrubTimeRef = useRef<number | null>(null);
  const lastSnapGuideRef = useRef<typeof snapGuide>(null);
  const keyframeDragFrameRef = useRef<number | null>(null);
  const pendingKeyframeTimeRef = useRef<number | null>(null);
  const markerDragRef = useRef<{ type: 'in' | 'out'; startX: number; origTime: number; moved: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const isSnapEnabledRef = useRef(isSnapEnabled);
  isSnapEnabledRef.current = isSnapEnabled;
  const activeSceneRef = useRef(activeScene);
  activeSceneRef.current = activeScene;
  const totalRulerDurationRef = useRef(totalRulerDuration);
  totalRulerDurationRef.current = totalRulerDuration;
  const outPointRef = useRef(outPoint);
  outPointRef.current = outPoint;
  const inPointRef = useRef(inPoint);
  inPointRef.current = inPoint;
  // IN/OUT markers follow the authored timeline end (including layers that
  // extend beyond the legacy scene.duration field). Using sceneDuration here
  // made markers appear locked to the old fixed scene length.
  const sceneDurationRef = useRef(sceneRange.duration);
  sceneDurationRef.current = sceneRange.duration;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const getLivePlayheadTime = () => (
    isPlayingRef.current ? getPlaybackClockTime() : currentTimeRef.current
  );
  // 回调与 activeSceneId 的 ref 镜像：让 window 级监听器只注册一次（空依赖），
  // 彻底消除拖拽中因回调引用变化导致监听器反复重注册、mouseup 丢失的问题。
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const onUpdateElementRef = useRef(onUpdateElement);
  onUpdateElementRef.current = onUpdateElement;
  const onCommitHistoryRef = useRef(onCommitHistory);
  onCommitHistoryRef.current = onCommitHistory;
  const onUpdateProjectRef = useRef(onUpdateProject);
  onUpdateProjectRef.current = onUpdateProject;
  const activeSceneIdRef = useRef(activeSceneId);
  activeSceneIdRef.current = activeSceneId;

  const publishSnapGuide = (next: typeof snapGuide) => {
    const previous = lastSnapGuideRef.current;
    const unchanged = previous === next
      || (previous === null && next === null)
      || (!!previous && !!next && previous.type === next.type && previous.time === next.time && previous.label === next.label);
    if (unchanged) return;
    lastSnapGuideRef.current = next;
    setSnapGuide(next);
  };

  // Timeline scrub click/drag - unrestricted across the entire ruler length
  const handleRulerMouseDown = (e: React.PointerEvent) => {
    if (!trackCanvasRef.current) return;
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    const rect = trackCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    let targetTime = Math.max(0, Math.min(totalRulerDuration, x / zoom));

    // Optional Snap on Scrub
    if (isSnapEnabled && activeScene) {
      const snapThreshold = Math.max(0.12, 10 / zoom);
      const snapTargets: { time: number; label: string; type: 'out' | 'in' | 'playhead' | 'scene' | 'clip' }[] = [];
      if (outPoint !== null && outPoint !== undefined) snapTargets.push({ time: outPoint, label: `出点 OUT (${outPoint.toFixed(2)}s)`, type: 'out' });
      if (inPoint !== null && inPoint !== undefined) snapTargets.push({ time: inPoint, label: `入点 IN (${inPoint.toFixed(2)}s)`, type: 'in' });
      snapTargets.push({ time: 0, label: `起点 (0.00s)`, type: 'scene' });
      snapTargets.push({ time: sceneDuration, label: `场景终点 (${sceneDuration.toFixed(2)}s)`, type: 'scene' });
      
      let matched: typeof snapTargets[0] | null = null;
      let minDiff = snapThreshold;
      for (const st of snapTargets) {
        const diff = Math.abs(targetTime - st.time);
        if (diff < minDiff) {
          minDiff = diff;
          matched = st;
        }
      }
      if (matched) {
        targetTime = matched.time;
        publishSnapGuide(matched);
      } else {
        publishSnapGuide(null);
      }
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSeek(targetTime);
    // 点击时间线空白区域（刻度/轨道背景）→ 取消选中素材，右侧面板回到场景设置
    onSelectElement(null);
  };

  // Set In/Out Points (strictly visual marking, never blocks pointer movement)
  const handleSetIO = (type: 'in' | 'out' | 'reset') => {
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;

      let nextIn = scene.inPoint;
      let nextOut = scene.outPoint;

      if (type === 'reset') {
        nextIn = undefined;
        nextOut = undefined;
      } else if (type === 'in') {
        const time = Math.max(0, Math.min(sceneDurationRef.current, getLivePlayheadTime()));
        nextIn = time;
        if (typeof nextOut === 'number' && nextOut < time) nextOut = time;
      } else if (type === 'out') {
        const time = Math.max(0, Math.min(sceneDurationRef.current, getLivePlayheadTime()));
        nextOut = time;
        if (typeof nextIn === 'number' && nextIn > time) nextIn = time;
      }

      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            inPoint: nextIn,
            outPoint: nextOut,
          },
        },
      };
    });
  };

  // 剪映式多选：普通点击=单选，Ctrl/Cmd=追加/取消，Shift=范围选择（按轨道排列顺序）
  const handleRowSelect = (e: React.MouseEvent, el: SceneElement) => {
    e.stopPropagation();
    e.preventDefault();

    // clip 的 mousedown 已处理过多选，避免 click 冒泡重复 toggle
    const targetElement = e.target as Element | null;
    if (clipSelectionHandledRef.current && targetElement?.closest('[data-timeline-clip="true"]')) {
      clipSelectionHandledRef.current = false;
      return;
    }

    // Shift 范围选择：从当前主项到点击项之间的全部轨道
    if (e.shiftKey) {
      const anchorId = selectedElementId || multiSelectedIds[multiSelectedIds.length - 1] || null;
      const idx1 = anchorId ? sortedElements.findIndex((x) => x.id === anchorId) : -1;
      const idx2 = sortedElements.findIndex((x) => x.id === el.id);
      if (idx1 >= 0 && idx2 >= 0) {
        const [lo, hi] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        const ids = sortedElements.slice(lo, hi + 1).map((x) => x.id);
        onMultiSelectionChange(ids, el.id);
        return;
      }
    }

    // Ctrl / Cmd 追加选择（再次点击取消）
    if (e.ctrlKey || e.metaKey) {
      const isIn = multiSelectedIds.includes(el.id);
      const next = isIn
        ? multiSelectedIds.filter((id) => id !== el.id)
        : [...multiSelectedIds, el.id];
      onMultiSelectionChange(next, el.id);
      return;
    }

    // 普通点击：单选
    onSelectElement(el.id);
  };

  // Clip Drag & Trim mouse down
  const handleClipMouseDown = (
    e: React.PointerEvent,
    el: SceneElement,
    mode: 'move' | 'trim-left' | 'trim-right'
  ) => {
    if (el.locked) return;
    // 仅处理左键：右键（button=2）交给 contextmenu 处理。
    // 必须 stopPropagation，否则右键 mousedown 冒泡会触发外层清空选择逻辑，清掉多选。
    if (e.button !== 0) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isScrubbingRef.current = false;

    // 修饰键按下时仅做多选，不启动拖动（剪映式 Ctrl/Shift 多选）
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      handleRowSelect(e, el);
      clipSelectionHandledRef.current = true;
      return;
    }

    clipSelectionHandledRef.current = true;
    onSelectElement(el.id);
    closeContextMenu();
    const dragInfo = {
      id: el.id,
      mode,
      startX: e.clientX,
      origStartTime: el.startTime,
      origDuration: el.duration,
      origKeyframes: el.keyframes,
      previewStartTime: el.startTime,
      previewDuration: el.duration,
      moved: false,
    };
    draggingClipRef.current = dragInfo;
    setDraggingClip(dragInfo);
    // 记录同组（多选）元素的原始时间，用于拖动时整组跟随（基于原始值计算，避免累积偏移）
    draggingGroupRef.current = multiSelectedIds.includes(el.id)
      ? multiSelectedIds
          .filter((id) => id !== el.id)
          .map((id) => {
            const g = activeScene.els.find((x) => x.id === id);
            return g ? { id, origStart: g.startTime } : null;
          })
          .filter((x): x is { id: string; origStart: number } => !!x)
      : [];
  };

  const handleKeyframeMouseDown = (
    e: React.PointerEvent,
    element: SceneElement,
    property: KeyframeProperty,
    keyframeId: string,
    time: number,
    linked?: Array<{ property: KeyframeProperty; keyframeId: string }>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isScrubbingRef.current = false;
    onSelectElement(element.id);
    draggingKeyframeRef.current = {
      elementId: element.id,
      properties: [{ property, keyframeId }, ...(linked || [])],
      startX: e.clientX,
      origTime: time,
      origKeyframes: element.keyframes,
      moved: false,
    };
  };

  // 剪映式右键菜单：分割 / 复制 / 删除 / 合并（多选）
  const handleContextMenu = (e: React.MouseEvent, el: SceneElement) => {
    e.preventDefault();
    e.stopPropagation();
    // 右键：若点击片段不在当前多选内 → 单选该片段；在多选内 → 保留多选（用于多选合并/删除）
    if (!multiSelectedIds.includes(el.id)) {
      onSelectElement(el.id);
    }
    setContextMenu({ elId: el.id, x: e.clientX, y: e.clientY });
  };

  // 多选合并图层（右键菜单，选中的 clip 数 >= 2）
  const handleMergeFromTimeline = () => {
    if (!contextMenu) return;
    const elId = contextMenu.elId;
    const targetIds = multiSelectedIds.includes(elId) && multiSelectedIds.length > 1
      ? multiSelectedIds
      : undefined;
    closeContextMenu();
    onMergeElements?.(targetIds);
  };

  // 拆开合并图层组（右键菜单）
  const handleUnmergeFromTimeline = () => {
    if (!contextMenu) return;
    const elId = contextMenu.elId;
    closeContextMenu();
    onUnmergeElement?.(elId);
  };

  const closeContextMenu = () => setContextMenu(null);

  // 按时间指针分割片段（剪映分割功能，委托给 App 统一逻辑，支持 C 键快捷键）
  const handleSplitClip = () => {
    if (!contextMenu) return;
    const elId = contextMenu.elId;
    closeContextMenu();
    onSplitElement?.(elId);
  };

  // 复制片段（剪映复制，时间错开 0.5s 避免完全重叠）
  const handleDuplicateClip = () => {
    if (!contextMenu || !activeScene) return;
    const el = activeScene.els.find((e) => e.id === contextMenu.elId);
    closeContextMenu();
    if (!el) return;
    const topZIndex = Math.max(0, ...activeScene.els.map((item) => item.zIndex || 0)) + 10;
    const newEl = createPastedElements([el], Math.round((el.startTime + 0.5) * 100) / 100, topZIndex, 0)[0];
    if (!newEl) return;
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: [...scene.els, newEl],
          },
        },
      };
    }, '复制片段', 'element_duplicate', el.sourceName || el.content || '片段');
    onSelectElement(newEl.id);
    onMultiSelectionChange([newEl.id], newEl.id);
  };

  // 删除片段
  const handleDeleteClip = () => {
    if (!contextMenu) return;
    const elId = contextMenu.elId;
    closeContextMenu();
    // 多选状态：若右键片段在多选集合中，则批量删除全部选中；否则仅删除该片段
    if (multiSelectedIds.length > 1 && multiSelectedIds.includes(elId)) {
      onDeleteElements(multiSelectedIds);
    } else {
      onDeleteElement?.(elId);
    }
  };

  // Global mouse move & up for scrubbing and clip dragging
  useEffect(() => {
    const flushKeyframeDrag = () => {
      if (keyframeDragFrameRef.current !== null) {
        window.cancelAnimationFrame(keyframeDragFrameRef.current);
        keyframeDragFrameRef.current = null;
      }
      const time = pendingKeyframeTimeRef.current;
      pendingKeyframeTimeRef.current = null;
      const drag = draggingKeyframeRef.current;
      const scene = activeSceneRef.current;
      const element = drag && scene?.els.find((item) => item.id === drag.elementId);
      if (!drag || time === null || !element) return;
      const source = drag.origKeyframes ? { ...element, keyframes: drag.origKeyframes } : element;
      const moved = drag.properties.reduce((current: SceneElement, item) => ({ ...current, keyframes: moveKeyframe(current, item.property, item.keyframeId, time) }), source).keyframes;
      onUpdateElementRef.current(element.id, {
        keyframes: moved,
      }, '绉诲姩鍏抽敭甯?', false);
    };

    const flushScrubSeek = () => {
      if (scrubFrameRef.current !== null) {
        window.cancelAnimationFrame(scrubFrameRef.current);
        scrubFrameRef.current = null;
      }
      const pending = pendingScrubTimeRef.current;
      pendingScrubTimeRef.current = null;
      if (pending !== null) onSeekRef.current(pending);
    };
    const handlePointerMove = (e: PointerEvent) => {
      const markerDrag = markerDragRef.current;
      if (markerDrag && trackCanvasRef.current) {
        if (Math.abs(e.clientX - markerDrag.startX) > 2) markerDrag.moved = true;
        const rect = trackCanvasRef.current.getBoundingClientRect();
        const rangeEnd = Math.max(sceneDurationRef.current, totalRulerDurationRef.current);
        let nextTime = Math.max(0, Math.min(rangeEnd, (e.clientX - rect.left) / Math.max(1, zoomRef.current)));
        const otherPoint = markerDrag.type === 'in' ? outPointRef.current : inPointRef.current;
        if (markerDrag.type === 'in' && typeof otherPoint === 'number') nextTime = Math.min(nextTime, otherPoint);
        if (markerDrag.type === 'out' && typeof otherPoint === 'number') nextTime = Math.max(nextTime, otherPoint);
        if (isSnapEnabledRef.current) {
          const snapThreshold = Math.max(0.08, 6 / zoomRef.current);
          const targets = [0, sceneDurationRef.current, getLivePlayheadTime()]
            .filter((value) => Number.isFinite(value))
            .filter((value) => markerDrag.type === 'in' ? value <= (outPointRef.current ?? rangeEnd) : value >= (inPointRef.current ?? 0));
          const match = targets.reduce<number | null>((best, value) => {
            if (Math.abs(value - nextTime) > snapThreshold) return best;
            return best === null || Math.abs(value - nextTime) < Math.abs(best - nextTime) ? value : best;
          }, null);
          if (match !== null) nextTime = match;
        }
        const sid = activeSceneIdRef.current;
        onUpdateProjectRef.current((prev) => {
          const scene = prev.scenes[sid];
          if (!scene) return prev;
          return { ...prev, scenes: { ...prev.scenes, [sid]: { ...scene, [markerDrag.type === 'in' ? 'inPoint' : 'outPoint']: nextTime } } };
        }, undefined, 'scene_update', undefined, false);
        return;
      }
      // Handle playhead scrubber dragging - unrestricted across total timeline
      if (isScrubbingRef.current && trackCanvasRef.current) {
        const rect = trackCanvasRef.current.getBoundingClientRect();
        const x = Math.max(0, e.clientX - rect.left);
        let targetTime = Math.max(0, Math.min(totalRulerDurationRef.current, x / zoomRef.current));

        if (isSnapEnabledRef.current && activeSceneRef.current) {
          const snapThreshold = Math.max(0.12, 10 / zoomRef.current);
          const snapTargets: { time: number; label: string; type: 'out' | 'in' | 'playhead' | 'scene' | 'clip' }[] = [];
          if (outPointRef.current !== null && outPointRef.current !== undefined) snapTargets.push({ time: outPointRef.current, label: `出点 OUT (${outPointRef.current.toFixed(2)}s)`, type: 'out' });
          if (inPointRef.current !== null && inPointRef.current !== undefined) snapTargets.push({ time: inPointRef.current, label: `入点 IN (${inPointRef.current.toFixed(2)}s)`, type: 'in' });
          snapTargets.push({ time: 0, label: `起点 (0.00s)`, type: 'scene' });
          snapTargets.push({ time: sceneDurationRef.current, label: `场景终点 (${sceneDurationRef.current.toFixed(2)}s)`, type: 'scene' });

          let matched: typeof snapTargets[0] | null = null;
          let minDiff = snapThreshold;
          for (const st of snapTargets) {
            const diff = Math.abs(targetTime - st.time);
            if (diff < minDiff) {
              minDiff = diff;
              matched = st;
            }
          }
          if (matched) {
            targetTime = matched.time;
            publishSnapGuide(matched);
          } else {
            publishSnapGuide(null);
          }
        }

        pendingScrubTimeRef.current = targetTime;
        if (scrubFrameRef.current === null) {
          scrubFrameRef.current = window.requestAnimationFrame(() => {
            scrubFrameRef.current = null;
            const pending = pendingScrubTimeRef.current;
            pendingScrubTimeRef.current = null;
            if (pending !== null && isScrubbingRef.current) onSeekRef.current(pending);
          });
        }
        return;
      }

      const dk = draggingKeyframeRef.current;
      const keyframeScene = activeSceneRef.current;
      if (dk && keyframeScene && trackCanvasRef.current) {
        if (Math.abs(e.clientX - dk.startX) > 2) dk.moved = true;
        const rect = trackCanvasRef.current.getBoundingClientRect();
        const rawTime = (e.clientX - rect.left) / Math.max(1, zoomRef.current);
        const nextTime = Math.max(0, Math.min(totalRulerDurationRef.current, rawTime));
        pendingKeyframeTimeRef.current = nextTime;
        if (keyframeDragFrameRef.current === null) {
          keyframeDragFrameRef.current = window.requestAnimationFrame(() => {
            keyframeDragFrameRef.current = null;
            const drag = draggingKeyframeRef.current;
            const time = pendingKeyframeTimeRef.current;
            pendingKeyframeTimeRef.current = null;
            const scene = activeSceneRef.current;
            const current = drag && scene?.els.find((item) => item.id === drag.elementId);
            if (!drag || time === null || !current) return;
            const source = drag.origKeyframes ? { ...current, keyframes: drag.origKeyframes } : current;
            const moved = drag.properties.reduce((item: SceneElement, keyframe) => ({ ...item, keyframes: moveKeyframe(item, keyframe.property, keyframe.keyframeId, time) }), source).keyframes;
            onUpdateElementRef.current(current.id, {
              keyframes: moved,
            }, '移动关键帧', false);
          });
        }
        return;
        /*
        if (false) {
          onUpdateElementRef.current(
            element.id,
            { keyframes: moveKeyframe(element, dk.property, dk.keyframeId, nextTime) },
            '移动关键帧',
            false,
          );
        }
        return;
      }

        */
      }

      // Handle clip dragging / trimming with Magnetic Snapping
      const dc = draggingClipRef.current;
      const sc = activeSceneRef.current;
      if (dc && sc) {
        if (Math.abs(e.clientX - dc.startX) > 2) dc.moved = true;
        if (!processingClipDragRef.current) {
          pendingClipPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
          if (clipDragFrameRef.current === null) {
            clipDragFrameRef.current = window.requestAnimationFrame(() => {
              clipDragFrameRef.current = null;
              const pointer = pendingClipPointerRef.current;
              pendingClipPointerRef.current = null;
              if (!pointer || !draggingClipRef.current) return;
              processingClipDragRef.current = true;
              try {
                handlePointerMove({ clientX: pointer.clientX, clientY: pointer.clientY } as PointerEvent);
              } finally {
                processingClipDragRef.current = false;
              }
            });
          }
          return;
        }
        const dxSeconds = (e.clientX - dc.startX) / zoomRef.current;
        const el = sc.els.find((item) => item.id === dc.id);
        if (!el) return;

        let nextStart = dc.origStartTime;
        let nextDur = dc.origDuration;

        // Build list of Snap Targets (Out Point, In Point, Playhead, 0s, Scene Duration, and other clip edges)
        const snapThreshold = Math.max(0.18, 14 / zoomRef.current);
        const snapTargets: { 
          time: number; 
          label: string; 
          type: 'out' | 'in' | 'playhead' | 'scene' | 'clip';
          edge?: 'start' | 'end';
        }[] = [];
        
        // 1. Scene Duration target (Magnetic Snap to scene end)
        snapTargets.push({ 
          time: sc.duration, 
          label: `场景总时长 (${sc.duration.toFixed(2)}s)`, 
          type: 'scene' 
        });

        // 2. Out & In points
        if (outPointRef.current !== null && outPointRef.current !== undefined) {
          snapTargets.push({ time: outPointRef.current, label: `出点 OUT (${outPointRef.current.toFixed(2)}s)`, type: 'out' });
        }
        if (inPointRef.current !== null && inPointRef.current !== undefined) {
          snapTargets.push({ time: inPointRef.current, label: `入点 IN (${inPointRef.current.toFixed(2)}s)`, type: 'in' });
        }

        // 3. Playhead & Timeline Origin
        const playheadTime = getLivePlayheadTime();
        snapTargets.push({ time: playheadTime, label: `时间指针 (${playheadTime.toFixed(2)}s)`, type: 'playhead' });
        snapTargets.push({ time: 0, label: `时间线起点 (0.00s)`, type: 'scene' });

        // 4. Other Elements start and end boundaries
        sc.els.forEach((other) => {
          if (other.id === dc.id) return;
          const otherName = other.sourceName || (other.type === 'txt' ? (other.content?.slice(0, 8) || '文字') : other.type.toUpperCase());
          snapTargets.push({ 
            time: other.startTime, 
            label: `【${otherName}】开始点 (${other.startTime.toFixed(2)}s)`, 
            type: 'clip' 
          });
          snapTargets.push({ 
            time: other.startTime + other.duration, 
            label: `【${otherName}】结束点 (${(other.startTime + other.duration).toFixed(2)}s)`, 
            type: 'clip' 
          });
        });

        let currentActiveSnap: { 
          time: number; 
          label: string; 
          type: 'out' | 'in' | 'playhead' | 'scene' | 'clip';
          edge?: 'start' | 'end';
        } | null = null;

        if (dc.mode === 'move') {
          let rawStart = Math.max(0, dc.origStartTime + dxSeconds);
          let rawEnd = rawStart + dc.origDuration;

          if (isSnapEnabledRef.current) {
            let minDiff = snapThreshold;
            let bestSnappedStart = rawStart;

            for (const st of snapTargets) {
              // Check end alignment snap (e.g. snapping clip end directly to Scene Duration, OUT point or other clips)
              const diffEnd = Math.abs(rawEnd - st.time);
              if (diffEnd < minDiff) {
                minDiff = diffEnd;
                bestSnappedStart = Math.max(0, st.time - dc.origDuration);
                currentActiveSnap = { ...st, edge: 'end' };
              }

              // Check start alignment snap
              const diffStart = Math.abs(rawStart - st.time);
              if (diffStart < minDiff) {
                minDiff = diffStart;
                bestSnappedStart = st.time;
                currentActiveSnap = { ...st, edge: 'start' };
              }
            }
            rawStart = bestSnappedStart;
          }

          nextStart = rawStart;

          // 剪映式拖动换轨：拖动片段时检测鼠标所在轨道行，实时预览目标层级
          if (trackCanvasRef.current) {
            const rows = trackCanvasRef.current.querySelectorAll<HTMLElement>('[data-track-row]');
            let targetIdx: number | null = null;
            for (let i = 0; i < rows.length; i++) {
              const r = rows[i].getBoundingClientRect();
              if (e.clientY >= r.top && e.clientY <= r.bottom) {
                targetIdx = i;
                break;
              }
            }
            if (targetIdx !== dragOverTrackIndexRef.current) {
              dragOverTrackIndexRef.current = targetIdx;
              setDragOverTrackIndex(targetIdx);
            }
          }
        } else if (dc.mode === 'trim-right') {
          // Trimming right edge (extending/shortening to Scene Duration, OUT point, playhead, or other clips)
          let rawEnd = dc.origStartTime + Math.max(0.2, dc.origDuration + dxSeconds);

          if (isSnapEnabledRef.current) {
            let minDiff = snapThreshold;
            let bestSnappedEnd = rawEnd;

            for (const st of snapTargets) {
              const diff = Math.abs(rawEnd - st.time);
              if (diff < minDiff && st.time > nextStart + 0.1) {
                minDiff = diff;
                bestSnappedEnd = st.time;
                currentActiveSnap = { ...st, edge: 'end' };
              }
            }
            rawEnd = bestSnappedEnd;
          }

          nextDur = Math.max(0.2, rawEnd - nextStart);
        } else if (dc.mode === 'trim-left') {
          let rawStart = Math.max(0, dc.origStartTime + dxSeconds);

          if (isSnapEnabledRef.current) {
            let minDiff = snapThreshold;
            let bestSnappedStart = rawStart;

            for (const st of snapTargets) {
              const diff = Math.abs(rawStart - st.time);
              const maxAllowedStart = dc.origStartTime + dc.origDuration - 0.2;
              if (diff < minDiff && st.time <= maxAllowedStart) {
                minDiff = diff;
                bestSnappedStart = st.time;
                currentActiveSnap = { ...st, edge: 'start' };
              }
            }
            rawStart = bestSnappedStart;
          }

          const diff = rawStart - dc.origStartTime;
          if (dc.origDuration - diff >= 0.2) {
            nextStart = rawStart;
            nextDur = dc.origDuration - diff;
          }
        }

        publishSnapGuide(currentActiveSnap);

        const calculatedEndTime = nextStart + nextDur;
        // If an element is dragged or expanded beyond current scene duration, automatically expand scene duration dynamically
        if (calculatedEndTime > sceneDurationRef.current) {
          const expandedDuration = Math.max(sceneDurationRef.current, Math.ceil(calculatedEndTime * 10) / 10);
          // Keep the ref in sync immediately so every pointer event does not
          // enqueue the same scene-duration update before React renders.
          dc.previewSceneDuration = expandedDuration;
          const sid = activeSceneIdRef.current;
        onUpdateProjectRef.current((prev) => ({
            ...prev,
            scenes: {
              ...prev.scenes,
              [sid]: {
                ...prev.scenes[sid],
                duration: expandedDuration,
              },
            },
          }), '扩展场景时长', 'scene_update', undefined, false);
        }

        // Derive from the mousedown snapshot so rapid mousemove events do not
        // compound the keyframe offset while React state is catching up.
          dc.previewStartTime = Math.round(nextStart * 100) / 100;
          dc.previewDuration = Math.round(nextDur * 100) / 100;
          const previousPreview = publishedClipPreviewRef.current;
          if (!previousPreview
            || previousPreview.id !== dc.id
            || previousPreview.start !== dc.previewStartTime
            || previousPreview.duration !== dc.previewDuration) {
            publishedClipPreviewRef.current = { id: dc.id, start: dc.previewStartTime, duration: dc.previewDuration };
            setDraggingClip((previous) => previous && previous.id === dc.id ? { ...previous, previewStartTime: dc.previewStartTime, previewDuration: dc.previewDuration } : previous);
          }
          const startDelta = nextStart - dc.origStartTime;
        const keyframeSource = dc.origKeyframes ? { ...el, keyframes: dc.origKeyframes } : el;
        onUpdateElementRef.current(el.id, {
          startTime: Math.round(nextStart * 100) / 100,
          duration: Math.round(nextDur * 100) / 100,
          ...(Math.abs(startDelta) > 0.001 && (dc.mode === 'move' || dc.mode === 'trim-left')
            ? { keyframes: shiftKeyframes(keyframeSource, startDelta) }
            : {}),
        }, undefined, false);

        // 批量拖动：同组（多选）其他片段跟随主片段一起水平移动（基于各自原始时间，避免累积偏移）
        if (dc.mode === 'move' && draggingGroupRef.current.length > 0) {
          const delta = nextStart - dc.origStartTime;
          if (Math.abs(delta) > 0.001) {
            draggingGroupRef.current.forEach((g) => {
              if (sc.els.some((x) => x.id === g.id)) {
                onUpdateElementRef.current(g.id, {
                  startTime: Math.round(Math.max(0, g.origStart + delta) * 100) / 100,
                }, undefined, false);
              }
            });
          }
        }
      }
    };

    const flushClipDragFrame = () => {
      if (clipDragFrameRef.current !== null) window.cancelAnimationFrame(clipDragFrameRef.current);
      clipDragFrameRef.current = null;
      const pointer = pendingClipPointerRef.current;
      pendingClipPointerRef.current = null;
      if (pointer && draggingClipRef.current) {
        processingClipDragRef.current = true;
        try {
          handlePointerMove({ clientX: pointer.clientX, clientY: pointer.clientY } as PointerEvent);
        } finally {
          processingClipDragRef.current = false;
        }
      }
    };

    const handlePointerUp = () => {
      flushKeyframeDrag();
      flushScrubSeek();
      flushClipDragFrame();
      pendingClipPointerRef.current = null;
      processingClipDragRef.current = false;
      const dcUp = draggingClipRef.current;
      const markerUp = markerDragRef.current;
      const scUp = activeSceneRef.current;
      const dkUp = draggingKeyframeRef.current;
      try {
        if (markerUp?.moved) {
          onCommitHistoryRef.current?.(markerUp.type === 'in' ? '设置入点' : '设置出点', 'scene_update');
        }
        if (dkUp && !dkUp.moved) onSeekRef.current(dkUp.origTime);
        if (dkUp?.moved) {
          const element = scUp?.els.find((item) => item.id === dkUp.elementId);
          onCommitHistoryRef.current?.(
            '移动关键帧',
            'element_update',
            element?.content || element?.sourceName || element?.id,
          );
        }
        if (dcUp?.moved) {
          const element = scUp?.els.find((item) => item.id === dcUp.id);
          if (element) {
            const startDelta = dcUp.previewStartTime - dcUp.origStartTime;
            const keyframeSource = dcUp.origKeyframes ? { ...element, keyframes: dcUp.origKeyframes } : element;
            onUpdateElementRef.current(element.id, {
              startTime: dcUp.previewStartTime,
              duration: dcUp.previewDuration,
              ...(Math.abs(startDelta) > 0.001 && (dcUp.mode === 'move' || dcUp.mode === 'trim-left')
                ? { keyframes: shiftKeyframes(keyframeSource, startDelta) }
                : {}),
            }, undefined, false);
            if (dcUp.mode === 'move' && draggingGroupRef.current.length > 0) {
              const delta = dcUp.previewStartTime - dcUp.origStartTime;
              draggingGroupRef.current.forEach((group) => {
                if (Math.abs(delta) <= 0.001 || !scUp.els.some((item) => item.id === group.id)) return;
                onUpdateElementRef.current(group.id, {
                  startTime: Math.round(Math.max(0, group.origStart + delta) * 100) / 100,
                }, undefined, false);
              });
            }
            if (dcUp.previewSceneDuration && dcUp.previewSceneDuration > sceneDurationRef.current) {
              const sid = activeSceneIdRef.current;
              onUpdateProjectRef.current((prev) => ({
                ...prev,
                scenes: { ...prev.scenes, [sid]: { ...prev.scenes[sid], duration: dcUp.previewSceneDuration } },
              }), '鎵╁睍鍦烘櫙鏃堕暱', 'scene_update', undefined, false);
            }
          }
          onCommitHistoryRef.current?.(
            dcUp.mode === 'move' ? '移动素材' : '调整素材时长',
            'element_update',
            element?.content || element?.sourceName || element?.id,
          );
        }
        // 剪映式换轨：松开时把拖动的片段移动到目标轨道（调整图层顺序）
        if (dcUp && dragOverTrackIndexRef.current !== null && scUp) {
          const targetIdx = dragOverTrackIndexRef.current;
          const draggedId = dcUp.id;
          const sid = activeSceneIdRef.current;
          onUpdateProjectRef.current((prev) => {
            const scene = prev.scenes[sid];
            if (!scene) return prev;
            const sorted = [...scene.els].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
            const fromIdx = sorted.findIndex((el) => el.id === draggedId);
            if (fromIdx < 0) return prev;
            const [movedEl] = sorted.splice(fromIdx, 1);
            let toIdx = targetIdx;
            if (fromIdx < toIdx) toIdx -= 1;
            toIdx = Math.max(0, Math.min(sorted.length, toIdx));
            sorted.splice(toIdx, 0, movedEl);
            const total = sorted.length;
            const els = sorted.map((el, idx) => ({ ...el, zIndex: (total - idx) * 10 }));
            return { ...prev, scenes: { ...prev.scenes, [sid]: { ...scene, els } } };
          }, '时间线调整图层顺序', 'element_order', `移动到第 ${targetIdx + 1} 层`);
        }
      } finally {
        window.setTimeout(() => { clipSelectionHandledRef.current = false; }, 0);
        // 无论换轨逻辑是否抛错，都必须清理所有拖拽状态，防止指针残留吸附鼠标
        isScrubbingRef.current = false;
        draggingClipRef.current = null;
        markerDragRef.current = null;
        draggingKeyframeRef.current = null;
        publishedClipPreviewRef.current = null;
        setIsScrubbing(false);
        setDraggingClip(null);
        draggingGroupRef.current = [];
        publishSnapGuide(null);
        setDragOverTrackIndex(null);
        dragOverTrackIndexRef.current = null;
      }
    };

    // 窗口失焦（鼠标在窗口外松开 / 切换应用 / Alt-Tab）时强制清理拖拽状态，
    // 这是 mouseup 丢失的经典兜底：鼠标移出浏览器窗口后松开不会触发 window mouseup。
    const handleWindowBlur = () => {
      flushKeyframeDrag();
      flushScrubSeek();
      flushClipDragFrame();
      pendingClipPointerRef.current = null;
      processingClipDragRef.current = false;
      const keyframeDrag = draggingKeyframeRef.current;
      const scene = activeSceneRef.current;
      if (keyframeDrag?.moved) {
        const element = scene?.els.find((item) => item.id === keyframeDrag.elementId);
        onCommitHistoryRef.current?.(
          '移动关键帧',
          'element_update',
          element?.content || element?.sourceName || element?.id,
        );
      }
      const clipDrag = draggingClipRef.current;
      if (clipDrag?.moved) {
        const element = scene?.els.find((item) => item.id === clipDrag.id);
        onCommitHistoryRef.current?.(
          clipDrag.mode === 'move' ? '移动素材' : '调整素材时长',
          'element_update',
          element?.content || element?.sourceName || element?.id,
        );
      }
      isScrubbingRef.current = false;
      draggingClipRef.current = null;
      markerDragRef.current = null;
      draggingKeyframeRef.current = null;
      publishedClipPreviewRef.current = null;
      setIsScrubbing(false);
      setDraggingClip(null);
      draggingGroupRef.current = [];
      publishSnapGuide(null);
      setDragOverTrackIndex(null);
      dragOverTrackIndexRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('visibilitychange', handleWindowBlur);
    return () => {
      flushKeyframeDrag();
      flushScrubSeek();
      flushClipDragFrame();
      pendingClipPointerRef.current = null;
      processingClipDragRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('visibilitychange', handleWindowBlur);
    };
    // 空依赖：所有回调与高频 state 均通过 ref 读取，监听器只注册一次，
    // 彻底消除拖拽中因回调引用变化导致 listener 反复重注册、mouseup 丢失的根因。
  }, []);

  // Clip color by type
  const getClipBg = (type: string) => {
    switch (type) {
      case 'saber':
        return 'from-cyan-500/90 to-blue-700/90 border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]';
      case 'vid':
        return 'from-teal-600/80 to-teal-800/80 border-teal-400/50';
      case 'img':
        return 'from-blue-600/80 to-blue-800/80 border-blue-400/50';
      case 'txt':
        return 'from-rose-600/80 to-rose-800/80 border-rose-400/50';
      case 'shape':
        return 'from-emerald-600/80 to-emerald-800/80 border-emerald-400/50';
      case 'group':
        return 'from-indigo-600/80 to-indigo-800/80 border-indigo-400/50';
      default:
        return 'from-purple-600/80 to-purple-800/80 border-purple-400/50';
    }
  };

  return (
    <div
      className={`aether-timeline bg-[#0e1017] flex flex-col select-none z-40 overflow-hidden ${
        isResizingTimeline ? 'transition-none pointer-events-auto' : 'transition-[height] duration-200 ease-out'
      }`}
      style={{ height: isTimelineCollapsed ? 40 : timelineHeight }}
    >
      {/* Timeline Master Transport Bar */}
      <div className="aether-timeline__transport h-10 bg-[#141620] border-b border-white/10 flex items-center justify-between px-3 text-xs text-slate-300 shrink-0">
        {/* Left: Playback Controls */}
        <div className="aether-timeline__transport-group flex items-center gap-2">
          {/* Frame Step Back */}
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 0.04))}
            title="上一帧"
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          >
            <SkipBack size={13} />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            title="播放/暂停 (Space)"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
              isPlaying
                ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/20'
                : 'bg-sky-500 text-white shadow-md shadow-sky-500/20 hover:bg-sky-400'
            }`}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            <span>{isPlaying ? '暂停' : '播放'}</span>
          </button>

          {/* Stop & Reset */}
          <button
            type="button"
            onClick={onStop}
            title="停止并归零"
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          >
            <Square size={12} />
          </button>

          {/* Frame Step Forward */}
          <button
            type="button"
            onClick={() => onSeek(Math.min(sceneDuration, currentTime + 0.04))}
            title="下一帧"
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          >
            <SkipForward size={13} />
          </button>

          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* Precision Timecode Display & Quick Duration Modifier */}
          <div className="flex items-center gap-2 bg-black/40 px-2.5 py-0.5 rounded border border-white/10 text-xs">
            <TimelineClockText fallbackTime={currentTime} isPlaying={isPlaying} />
            <span className="text-slate-500 text-[10px]">/</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">场景时长:</span>
              <input
                type="number"
                min="1"
                max="600"
                step="1"
                value={sceneDuration}
                onChange={(e) => {
                  const val = Math.max(1, parseFloat(e.target.value) || 10);
                  onUpdateProject((prev) => ({
                    ...prev,
                    scenes: {
                      ...prev.scenes,
                      [activeSceneId]: {
                        ...prev.scenes[activeSceneId],
                        duration: val,
                      },
                    },
                  }));
                }}
                className="w-12 bg-white/10 hover:bg-white/15 focus:bg-black border border-white/10 rounded px-1 text-center font-mono text-xs text-amber-300 outline-none"
                title="修改当前场景总时长 (秒)"
              />
              <span className="text-slate-400 text-[10px]">s</span>
            </div>
          </div>

          {/* Direct Mini Progress Scrubber */}
          <div className="hidden sm:flex items-center gap-1 px-1">
            <TimelineClockSlider
              fallbackTime={currentTime}
              isPlaying={isPlaying}
              max={Math.max(sceneDuration, effectiveMaxDuration, totalRulerDuration)}
              onSeek={onSeek}
            />
          </div>

          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* In / Out Markers (Non-blocking reference markers) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSetIO('in')}
              title={`标记入点参考 (当前: ${inPoint !== null && inPoint !== undefined ? inPoint.toFixed(2) + 's' : '未设置'})`}
              className={`px-2 py-0.5 font-mono font-bold rounded border text-[11px] transition-colors ${
                inPoint !== null && inPoint !== undefined
                  ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/50'
                  : 'text-emerald-400/80 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
              }`}
            >
              [ IN {inPoint !== null && inPoint !== undefined ? `(${inPoint.toFixed(1)}s)` : ''}
            </button>

            <button
              type="button"
              onClick={() => handleSetIO('out')}
              title={`标记出点参考 (当前: ${outPoint !== null && outPoint !== undefined ? outPoint.toFixed(2) + 's' : '未设置'})`}
              className={`px-2 py-0.5 font-mono font-bold rounded border text-[11px] transition-colors ${
                outPoint !== null && outPoint !== undefined
                  ? 'text-rose-300 bg-rose-500/20 border-rose-400/50'
                  : 'text-rose-400/80 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30'
              }`}
            >
              OUT ] {outPoint !== null && outPoint !== undefined ? `(${outPoint.toFixed(1)}s)` : ''}
            </button>

            {(inPoint !== null && inPoint !== undefined || outPoint !== null && outPoint !== undefined) && (
              <button
                type="button"
                onClick={() => handleSetIO('reset')}
                title="清除出入点标记"
                className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
              >
                清除标记
              </button>
            )}
            <ViewportToolButtons viewport={viewport} onUpdateViewport={onUpdateViewport} />
          </div>
        </div>

        {/* Right: Magnet Snap Toggle, Zoom slider & Collapse toggle */}
        <div className="aether-timeline__transport-group flex items-center gap-3">
          {/* Magnetic Snapping Toggle */}
          <button
            type="button"
            onClick={() => setIsSnapEnabled(!isSnapEnabled)}
            title={isSnapEnabled ? '磁吸对齐已开启 (自动吸附出点/入点/时间指针/素材边缘)' : '磁吸对齐已关闭'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all border ${
              isSnapEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <Magnet size={12} className={isSnapEnabled ? 'text-amber-400 animate-pulse' : 'text-slate-400'} />
            <span>{isSnapEnabled ? '磁吸开启' : '磁吸关闭'}</span>
          </button>

          <div className="w-[1px] h-4 bg-white/15" />

          {/* 多选控制：全选 / 取消选择 / 选中计数（剪映式） */}
          <button
            type="button"
            onClick={onSelectAll}
            title="全选所有图层轨道"
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-sky-500/20 hover:text-sky-300 rounded text-slate-300 transition-colors"
          >
            <CheckSquare size={12} className="text-sky-400" />
            <span className="text-[11px]">全选</span>
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            title="取消全部选择"
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-slate-300 transition-colors"
          >
            <X size={12} />
            <span className="text-[11px]">取消</span>
          </button>
          {multiSelectedIds.length > 1 && (
            <span className="flex items-center px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono font-semibold">
              已选 {multiSelectedIds.length}
            </span>
          )}

          <div className="w-[1px] h-4 bg-white/15" />

          {/* Zoom Slider */}
          <div className="flex items-center gap-1.5">
            <ZoomOut size={12} className="text-slate-500" />
            <input
              type="range"
              min="10"
              max="80"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="w-20 accent-sky-500 h-1 cursor-pointer"
              title="缩放时间轴刻度"
            />
            <ZoomIn size={12} className="text-slate-500" />
          </div>

          <div className="w-[1px] h-4 bg-white/15" />

          {/* Expand / Collapse Button */}
          <button
            type="button"
            onClick={onToggleTimelineCollapse}
            title={isTimelineCollapsed ? '展开时间轴' : '折叠时间轴'}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-slate-300 transition-colors"
          >
            {isTimelineCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="text-[11px]">{isTimelineCollapsed ? '展开时间轴' : '折叠'}</span>
          </button>
        </div>
      </div>

      {/* Main Track Workspace (When Not Collapsed) */}
      {!isTimelineCollapsed && (
        <div ref={scrollContainerRef} className="flex-1 flex overflow-auto relative">
          {/* Left Sticky Column: Layer / Track Headers */}
          <div className="w-56 bg-[#12141c] border-r border-white/10 shrink-0 sticky left-0 z-30 flex flex-col self-start">
            {/* Header Corner for Ruler */}
            <div className="h-7 bg-[#161822] border-b border-white/10 px-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1.5 bg-black/30 rounded px-1.5 py-0.5 border border-white/5 focus-within:border-sky-500/50">
                <Search size={10} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={trackSearchQuery}
                  onChange={(e) => setTrackSearchQuery(e.target.value)}
                  placeholder={`搜索轨道 (${displayedElements.length}/${sortedElements.length})`}
                  className="bg-transparent border-0 text-slate-200 text-[10px] placeholder:text-slate-500 focus:outline-none w-full min-w-0"
                />
                {trackSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTrackSearchQuery('')}
                    className="text-slate-500 hover:text-white shrink-0 p-0.5"
                    title="清除搜索"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
              <span className="flex items-center gap-1 text-slate-500 font-medium shrink-0" title="各图层独立锁定保护">
                <Lock size={10} />
              </span>
            </div>

            {/* Audio Track Header */}
            {activeScene?.bgmRef && (
              <div className="h-9 px-3 flex items-center justify-between border-b border-white/5 bg-pink-950/20 text-pink-300 text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Music size={12} className="text-pink-400 shrink-0" />
                  <span className="truncate font-medium">BGM 音频轨道</span>
                </div>
                <Volume2 size={12} className="text-pink-400 shrink-0" />
              </div>
            )}

            {/* Element Track Headers */}
            <div className="flex-1 flex flex-col">
              {displayedElements.map((el) => {
                const isSelected = multiSelectedIds.includes(el.id);
                const isVisible = isLayerVisible(el.visible);

                return (
                  <div
                    key={el.id}
                    data-header-track-id={el.id}
                    onClick={(e) => handleRowSelect(e, el)}
                    className={`h-[36px] min-h-[36px] max-h-[36px] box-border px-3 flex items-center justify-between border-b border-white/5 cursor-pointer text-xs transition-colors shrink-0 group ${
                      isSelected
                        ? 'bg-sky-500/20 text-white font-semibold border-l-2 border-l-sky-400'
                        : 'text-slate-300 hover:bg-white/[0.04]'
                    } ${!isVisible ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden mr-1">
                      <span 
                        className={`text-[9px] px-1 py-0.2 rounded font-mono font-semibold uppercase shrink-0 ${
                          el.type === 'group'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : el.type === 'saber'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                            : el.type === 'shape' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : el.type === 'txt' 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : el.type === 'vid'
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {el.type === 'group' ? (el.componentInstance ? '组件' : 'GROUP') : el.type}
                      </span>
                      <span className="truncate text-[11px]" title={el.type === 'group' ? (el.componentInstance ? (el.sourceName || '组件副本') : `合并图层组（${(el.children || []).length} 个图层）`) : (el.sourceName || el.content || '图层')}>
                        {el.type === 'group'
                          ? (el.componentInstance ? (el.sourceName || '组件副本') : `合并图层组（${(el.children || []).length}）`)
                          : (el.sourceName || el.content || (el.type === 'txt' ? '文字图层' : '视觉元素'))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateElement(
                            el.id,
                            { visible: getNextLayerVisibility(el.visible) },
                            isVisible ? '隐藏图层' : '显示图层',
                          );
                        }}
                        aria-label={isVisible ? '隐藏图层' : '显示图层'}
                        aria-pressed={isVisible}
                        className={`p-1 rounded transition-colors ${
                          isVisible ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'
                        }`}
                        title={isVisible ? '隐藏图层' : '显示图层'}
                      >
                        {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>

                      {/* Lock Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateElement(el.id, { locked: !el.locked });
                        }}
                        className={`p-1 rounded transition-colors ${el.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                        title={el.locked ? '已锁定' : '未锁定'}
                      >
                        {el.locked ? <Lock size={11} /> : <Unlock size={11} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Scrollable Column: Timeline Ruler & Clip Tracks */}
          <div
            ref={trackCanvasRef}
            data-timeline-canvas="true"
            data-timeline-zoom={zoom}
            style={{ width: `${totalRulerDuration * zoom}px` }}
            onPointerDown={handleRulerMouseDown}
            className="relative flex flex-col shrink-0 min-w-full cursor-pointer self-start"
          >
            {/* Timeline Ruler */}
            <div
              className="h-7 bg-[#161822] border-b border-white/10 relative cursor-ew-resize sticky top-0 z-20"
            >
              {/* Seconds Ticks */}
              {Array.from({ length: Math.ceil(totalRulerDuration) + 1 }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * zoom}px` }}
                  className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-end"
                >
                  <div className={`w-[1px] bg-white/20 ${sec % 5 === 0 ? 'h-3 bg-white/40' : 'h-1.5'}`} />
                  {sec % 5 === 0 && (
                    <span className="absolute left-1 bottom-1 text-[9px] font-mono text-slate-400 pointer-events-none">
                      {sec}s
                    </span>
                  )}
                </div>
              ))}

              {/* Scene Total Duration Reference Visual Line */}
              <div
                style={{ left: `${sceneDuration * zoom}px` }}
                className="absolute top-0 bottom-0 w-[2px] bg-amber-400/60 pointer-events-none z-10 flex flex-col justify-end items-center"
              >
                <div className="bg-amber-500 text-slate-950 text-[9px] font-mono font-bold px-1.5 rounded-t shadow whitespace-nowrap pointer-events-none mb-0 select-none">
                  场景结束 {sceneDuration.toFixed(1)}s
                </div>
              </div>

              {/* In Point & Out Point Subtle Reference Visual Lines (Non-blocking) */}
              {inPoint !== null && inPoint !== undefined && (
                <div
                  style={{ left: `${inPoint * zoom}px` }}
                  className="absolute top-0 bottom-0 w-[8px] -ml-[3px] bg-emerald-400/80 pointer-events-auto z-20 flex flex-col justify-start items-center cursor-ew-resize"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    markerDragRef.current = { type: 'in', startX: event.clientX, origTime: inPoint, moved: false };
                  }}
                >
                  <div className="bg-emerald-500 text-black text-[9px] font-mono font-bold px-1.5 rounded-b shadow pointer-events-none whitespace-nowrap select-none">
                    [ IN {inPoint.toFixed(1)}s
                  </div>
                </div>
              )}
              {outPoint !== null && outPoint !== undefined && (
                <div
                  style={{ left: `${outPoint * zoom}px` }}
                  className="absolute top-0 bottom-0 w-[8px] -ml-[3px] bg-rose-400/80 pointer-events-auto z-20 flex flex-col justify-start items-center cursor-ew-resize"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    markerDragRef.current = { type: 'out', startX: event.clientX, origTime: outPoint, moved: false };
                  }}
                >
                  <div className="bg-rose-500 text-white text-[9px] font-mono font-bold px-1.5 rounded-b shadow pointer-events-none whitespace-nowrap select-none">
                    OUT {outPoint.toFixed(1)}s ]
                  </div>
                </div>
              )}
            </div>

            {/* Live Magnetic Snap Alignment Guide Line & Tooltip */}
            {snapGuide && (
              <div
                style={{ left: `${snapGuide.time * zoom}px` }}
                className={`absolute top-0 bottom-0 w-[2px] z-30 pointer-events-none flex flex-col items-center ${
                  snapGuide.type === 'scene'
                    ? 'bg-amber-400 shadow-[0_0_16px_#f59e0b]'
                    : snapGuide.type === 'clip'
                    ? 'bg-purple-400 shadow-[0_0_16px_#c084fc]'
                    : snapGuide.type === 'out'
                    ? 'bg-rose-400 shadow-[0_0_16px_#f43f5e]'
                    : snapGuide.type === 'in'
                    ? 'bg-emerald-400 shadow-[0_0_16px_#10b981]'
                    : 'bg-sky-400 shadow-[0_0_16px_#0ea5e9]'
                }`}
              >
                <div 
                  className={`sticky top-8 text-[10px] font-bold px-2 py-0.5 rounded shadow-2xl flex items-center gap-1.5 whitespace-nowrap mt-1 border z-50 animate-bounce ${
                    snapGuide.type === 'scene'
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : snapGuide.type === 'clip'
                      ? 'bg-purple-500 text-white border-purple-300'
                      : snapGuide.type === 'out'
                      ? 'bg-rose-500 text-white border-rose-300'
                      : snapGuide.type === 'in'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                      : 'bg-sky-500 text-slate-950 border-sky-300'
                  }`}
                >
                  <Magnet size={11} className="shrink-0" />
                  <span>
                    🧲 已对齐{snapGuide.edge === 'end' ? '出点/尾部' : snapGuide.edge === 'start' ? '入点/头部' : ''}: {snapGuide.label}
                  </span>
                </div>
              </div>
            )}

            {/* Dedicated playback-clock subscriber: updates only this composited
                playhead, never the full ruler or all clip tracks. */}
            <TimelinePlayhead
              fallbackTime={currentTime}
              isPlaying={isPlaying}
              zoom={zoom}
              rangeStart={inPoint ?? 0}
              rangeEnd={outPoint ?? Math.max(sceneDuration, effectiveMaxDuration)}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                isScrubbingRef.current = true;
                setIsScrubbing(true);
              }}
            />

            {/* Audio Waveform Row (If scene has BGM) */}
            {activeScene?.bgmRef && (
              <div className="h-[36px] min-h-[36px] max-h-[36px] box-border border-b border-white/5 relative bg-pink-950/10 flex items-center px-1 shrink-0">
                <div
                  style={{
                    left: 0,
                    width: `${activeScene.duration * zoom}px`,
                  }}
                  className="absolute top-1.5 bottom-1.5 bg-pink-900/40 border border-pink-500/40 rounded flex items-center px-2 text-[10px] text-pink-300 font-mono"
                >
                  🎵 背景音乐波形轨道 · 循环播放
                </div>
              </div>
            )}

            {/* Element Clip Tracks */}
            <div className="flex-1 flex flex-col relative">
              {/* Background Grid Lines for 1s / 5s Marks */}
              <div className="absolute inset-0 pointer-events-none flex">
                {Array.from({ length: Math.ceil(totalRulerDuration) + 1 }).map((_, sec) => (
                  <div
                    key={sec}
                    style={{ left: `${sec * zoom}px` }}
                    className={`absolute top-0 bottom-0 w-[1px] ${
                      sec === 0
                        ? 'bg-white/20'
                        : sec % 5 === 0
                        ? 'bg-white/10'
                        : 'bg-white/[0.03]'
                    }`}
                  />
                ))}
              </div>

              {displayedElements.map((el, trackIdx) => {
                const isSelected = multiSelectedIds.includes(el.id);
                const isVisible = isLayerVisible(el.visible);
                const isCurrentlyDragging = draggingClip?.id === el.id;
                const isSnapped = isCurrentlyDragging && !!snapGuide;
                const isDragOverTrack = dragOverTrackIndex === trackIdx && draggingClip && draggingClip.id !== el.id;
                 const preview = draggingClip?.id === el.id ? draggingClip : null;
                 const clipLeft = (preview?.previewStartTime ?? el.startTime) * zoom;
                 const clipWidth = (preview?.previewDuration ?? el.duration) * zoom;

                return (
                  <div 
                    key={el.id}
                    data-track-row="true"
                    data-track-index={trackIdx}
                    data-element-id={el.id}
                    onClick={(e) => handleRowSelect(e, el)}
                    className={`h-[36px] min-h-[36px] max-h-[36px] box-border border-b border-white/5 relative flex items-center shrink-0 transition-colors ${
                      isSelected ? 'bg-sky-500/10' : 'hover:bg-white/[0.02]'
                    } ${isDragOverTrack ? 'bg-sky-500/15 ring-1 ring-inset ring-sky-400/50' : ''}`}
                  >
                    {/* 换轨目标指示（剪映式）：拖动其他片段悬停到本行时显示插入高亮 */}
                    {isDragOverTrack && (
                      <div className="absolute inset-y-0 left-0 w-[3px] bg-sky-400 shadow-[0_0_10px_#38bdf8] z-30 pointer-events-none" />
                    )}
                    {/* Draggable & Trimmable Clip Box */}
                    <div
                      data-timeline-clip="true"
                      onPointerDown={(e) => handleClipMouseDown(e, el, 'move')}
                      onContextMenu={(e) => handleContextMenu(e, el)}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                      }}
                      className={`absolute top-1.5 bottom-1.5 bg-gradient-to-r ${getClipBg(el.type)} border rounded shadow-md flex items-center px-2 text-[11px] text-white font-medium cursor-move overflow-hidden transition-shadow select-none group ${
                        isSnapped
                          ? 'ring-2 ring-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.8)] z-20 scale-[1.01]'
                          : isSelected
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-black z-10'
                          : ''
                      } ${el.locked || !isVisible ? 'opacity-50' : ''} ${el.locked ? 'cursor-not-allowed' : ''}`}
                      title={`【${el.type.toUpperCase()}】${el.sourceName || el.content || '元素'} (${el.startTime.toFixed(2)}s - ${(el.startTime + el.duration).toFixed(2)}s) - 水平拖动调位置，上下拖动换轨道，左右边缘裁剪时长，右键更多操作`}
                    >
                      {/* Left Trim Handle */}
                      {!el.locked && (
                        <div
                          onPointerDown={(e) => handleClipMouseDown(e, el, 'trim-left')}
                          className={`absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-20 transition-all ${
                            isCurrentlyDragging && preview?.mode === 'trim-left'
                              ? 'bg-amber-400 text-black shadow-[0_0_10px_#f59e0b]'
                              : isSelected
                              ? 'bg-white/90 hover:bg-white text-slate-900 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                              : 'bg-white/25 hover:bg-white/70 opacity-0 group-hover:opacity-100'
                          }`}
                          title="拖动调整图层入场时间 (In-Point)"
                        >
                          <div className={`w-[2px] h-3.5 rounded-full ${isCurrentlyDragging && preview?.mode === 'trim-left' ? 'bg-black' : isSelected ? 'bg-slate-800' : 'bg-white'}`} />
                        </div>
                      )}

                      {/* Real-time Trimming / Moving Badge */}
                      {isCurrentlyDragging && (
                        <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 bg-slate-950/95 text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded shadow-xl border border-amber-500/50 pointer-events-none z-30 whitespace-nowrap flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100">
                          {preview?.mode === 'trim-left' && <span>入点: {preview.previewStartTime.toFixed(2)}s</span>}
                          {preview?.mode === 'trim-right' && <span>时长: {preview.previewDuration.toFixed(2)}s</span>}
                          {preview?.mode === 'move' && <span>起点: {preview.previewStartTime.toFixed(2)}s</span>}
                        </div>
                      )}

                      {/* Clip Label */}
                      <span className="truncate flex-1 pointer-events-none px-2 text-slate-100/90 drop-shadow">
                        {el.type === 'group'
                          ? (el.componentInstance ? (el.sourceName || '组件副本') : `合并图层组（${(el.children || []).length}）`)
                          : (el.sourceName || el.content || el.type.toUpperCase())}
                      </span>

                      {/* Right Trim Handle */}
                      {!el.locked && (
                        <div
                          onPointerDown={(e) => handleClipMouseDown(e, el, 'trim-right')}
                          className={`absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-20 transition-all ${
                            isCurrentlyDragging && preview?.mode === 'trim-right'
                              ? 'bg-amber-400 text-black shadow-[0_0_10px_#f59e0b]'
                              : isSelected
                              ? 'bg-white/90 hover:bg-white text-slate-900 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                              : 'bg-white/25 hover:bg-white/70 opacity-0 group-hover:opacity-100'
                          }`}
                          title="拖动调整图层持续时长 (Duration)"
                        >
                          <div className={`w-[2px] h-3.5 rounded-full ${isCurrentlyDragging && preview?.mode === 'trim-right' ? 'bg-black' : isSelected ? 'bg-slate-800' : 'bg-white'}`} />
                        </div>
                      )}
                    </div>
                    {isSelected && (() => {
                      const visibleKeyframes = new Map<string, { track: any; keyframe: any; linked: Array<{ property: KeyframeProperty; keyframeId: string }> }>();
                      el.keyframes?.tracks.forEach((track) => track.keyframes.forEach((keyframe) => {
                        const pair = track.property === 'x' || track.property === 'y' ? 'position'
                          : track.property === 'w' || track.property === 'h' ? 'size'
                          : track.property;
                        const timeKey = `${keyframe.time.toFixed(2)}:${pair}`;
                        const existing = visibleKeyframes.get(timeKey);
                        if (!existing) visibleKeyframes.set(timeKey, { track, keyframe, linked: [] });
                        else existing.linked.push({ property: track.property, keyframeId: keyframe.id });
                      }));
                      return Array.from(visibleKeyframes.values()).map(({ track, keyframe, linked }) => (
                      <button
                        key={`${keyframe.time.toFixed(2)}-${track.property}-${keyframe.id}`}
                        type="button"
                        data-keyframe-id={keyframe.id}
                        onPointerDown={(event) => handleKeyframeMouseDown(event, el, track.property, keyframe.id, keyframe.time, linked)}
                        className="absolute z-40 grid h-2 w-2 -translate-x-1/2 rotate-45 place-items-center rounded-[1px] border border-amber-100/90 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.65)] hover:scale-150"
                        style={{ left: `${keyframe.time * zoom}px`, top: `${4 + el.keyframes!.tracks.indexOf(track) * 5}px` }}
                        title={`${track.property} · ${keyframe.time.toFixed(2)}s`}
                        aria-label={`${track.property} ${keyframe.time.toFixed(2)}s`}
                      >
                        <Diamond size={7} className="-rotate-45 text-amber-950" />
                      </button>
                      ));
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 剪映式片段右键菜单：分割 / 复制 / 删除 */}
      {contextMenu && (
        <div
          className="fixed z-[9999] w-44 bg-[#1a1d29] border border-white/15 rounded-lg shadow-2xl overflow-hidden text-xs"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 160) }}
          onClick={closeContextMenu}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSplitClip(); }}
            className="w-full text-left px-3 py-2 hover:bg-white/10 text-slate-200 flex items-center gap-2"
            title="在时间指针位置将片段切成两段"
          >
            <Scissors size={12} className="text-amber-400" />
            <span>按指针分割</span>
            <span className="ml-auto text-[9px] text-slate-500 font-mono">{currentTime.toFixed(1)}s</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDuplicateClip(); }}
            className="w-full text-left px-3 py-2 hover:bg-white/10 text-slate-200 flex items-center gap-2"
            title="复制该片段到其后 0.5s"
          >
            <Copy size={12} className="text-sky-400" />
            <span>复制片段</span>
          </button>

          {/* 合并图层（多选 >= 2） */}
          {(() => {
            const mergeCount = multiSelectedIds.includes(contextMenu.elId) ? multiSelectedIds.length : 0;
            if (mergeCount < 2) return null;
            return (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleMergeFromTimeline(); }}
                className="w-full text-left px-3 py-2 hover:bg-indigo-500/15 text-indigo-300 flex items-center gap-2"
                title={`将选中的 ${mergeCount} 个片段合并为一个图层（可随时拆开）`}
              >
                <Layers size={12} />
                <span>合并图层（{mergeCount}）</span>
              </button>
            );
          })()}

          {/* 拆开合并图层组 */}
          {(() => {
            const el = activeScene?.els.find((e) => e.id === contextMenu.elId);
            if (!el || el.type !== 'group' || el.componentInstance) return null;
            return (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleUnmergeFromTimeline(); }}
                className="w-full text-left px-3 py-2 hover:bg-amber-500/15 text-amber-300 flex items-center gap-2"
                title="拆开合并图层组，恢复为独立图层（保留原有外观与位置）"
              >
                <Unlink size={12} />
                <span>拆开合并图层组</span>
              </button>
            );
          })()}

          <div className="h-px bg-white/10" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDeleteClip(); }}
            className="w-full text-left px-3 py-2 hover:bg-red-500/15 text-red-300 flex items-center gap-2"
            title="删除该片段"
          >
            <Trash2 size={12} />
            <span>删除片段</span>
          </button>
        </div>
      )}
    </div>
  );
});

