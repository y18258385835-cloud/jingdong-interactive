import React, { useEffect, useRef, useState } from 'react';
import {
  Hand, Camera, Eye, EyeOff, Power, X, Loader2,
  AlertCircle, ChevronDown, RefreshCw, Sparkles
} from 'lucide-react';
import type { useGestureControl } from '../../core/motion/useGestureControl';

const GESTURE_NAME: Record<string, string> = {
  wave: '挥手',
  open_palm: '张开手掌',
  swipe_left: '向左划',
  swipe_right: '向右划',
  fist: '握拳',
  point: '食指指向',
};

const GESTURE_EMOJI: Record<string, string> = {
  wave: '👋',
  open_palm: '✋',
  swipe_left: '👈',
  swipe_right: '👉',
  fist: '✊',
  point: '👆',
};

export interface MotionGestureOverlayProps {
  motionEnabled: boolean;
  /** 工程数据是否已完成水合。用于区分“打开已开启体感的工程”和“用户刚点开启”。 */
  projectHydrated?: boolean;
  gesture: ReturnType<typeof useGestureControl>;
  activeSceneHasGesture: boolean;
  onEnableMotion: () => void;
  onDisableMotion: () => void;
}

export const MotionGestureOverlay: React.FC<MotionGestureOverlayProps> = ({
  motionEnabled,
  projectHydrated = true,
  gesture,
  activeSceneHasGesture,
  onEnableMotion,
  onDisableMotion,
}) => {
  const [isCameraExpanded, setIsCameraExpanded] = useState(false);
  const [isHintDismissed, setIsHintDismissed] = useState(false);
  const wasEnabledRef = useRef<boolean | null>(null);
  const pendingAutoStartRef = useRef(false);
  const motionEnabledRef = useRef(motionEnabled);
  motionEnabledRef.current = motionEnabled;

  const beginGesture = () => {
    // 先展开画中画再请求摄像头：保证 video 节点在 getUserMedia 返回前已经挂载。
    setIsCameraExpanded(true);
    window.setTimeout(() => {
      // 80ms 内用户可能已经关闭体感，别在关闭后还把摄像头打开。
      if (motionEnabledRef.current) void gesture.start();
    }, 80);
  };

  // 只有“水合完成后用户刚开启体感”才自动请求摄像头；
  // 打开一个已开启体感的工程时保持手动启动，避免加载即调用摄像头。
  useEffect(() => {
    if (!projectHydrated) return;
    if (wasEnabledRef.current === null) {
      // 水合后的第一次观察只作为基线，不视为用户操作。
      wasEnabledRef.current = motionEnabled;
      return;
    }
    if (!motionEnabled) {
      wasEnabledRef.current = false;
      pendingAutoStartRef.current = false;
      return;
    }
    if (!wasEnabledRef.current) pendingAutoStartRef.current = true;
    wasEnabledRef.current = true;
  }, [motionEnabled, projectHydrated]);

  useEffect(() => {
    if (!pendingAutoStartRef.current) return;
    if (gesture.mlReady && gesture.status === 'idle') {
      pendingAutoStartRef.current = false;
      beginGesture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture.mlReady, gesture.status]);

  // 1. 未开启状态，但本场景预置了手势绑定：展示极简提示胶囊
  if (!motionEnabled) {
    if (!activeSceneHasGesture || isHintDismissed) return null;
    return (
      <div className="absolute bottom-3 right-3 z-30 pointer-events-auto select-none">
        <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-violet-500/35 text-violet-200 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          <span className="text-[11px] font-medium tracking-wide">本场景已配置体感手势</span>
          <button
            type="button"
            onClick={onEnableMotion}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-500/30 hover:bg-violet-500 text-white font-medium text-[10px] transition-all"
          >
            <Sparkles size={11} className="text-violet-200" />
            <span>开启</span>
          </button>
          <button
            type="button"
            onClick={() => setIsHintDismissed(true)}
            className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="忽略提示"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // 2. 体感已开启状态：精致微型胶囊 + 按需展开的画中画
  const isReady = gesture.status === 'ready';
  const isLoading = gesture.status === 'loading';
  const isIdle = gesture.status === 'idle';
  const isError = gesture.status === 'error';
  const isNoCamera = gesture.status === 'no-camera';

  const currentGestureLabel = gesture.gestureLabel ? (GESTURE_NAME[gesture.gestureLabel] || gesture.gestureLabel) : '';
  const currentGestureEmoji = gesture.gestureLabel ? (GESTURE_EMOJI[gesture.gestureLabel] || '👋') : '';

  return (
    <div className="absolute bottom-3 right-3 z-30 flex flex-col items-end pointer-events-auto select-none">
      {(isError || isNoCamera) && gesture.camError && (
        <div className="mb-2 max-h-24 w-56 overflow-auto rounded-lg border border-rose-400/30 bg-rose-950/90 px-2.5 py-2 text-[10px] leading-4 text-rose-200 shadow-xl">
          {gesture.camError}
        </div>
      )}
      {/* 摄像头节点常驻：收起画中画也不能卸载 video，否则识别循环会失去帧源。
          收起时放到屏幕外保持 2×2 渲染，展开时再回到胶囊上方。 */}
      <div
        className={isCameraExpanded
          ? 'mb-2 w-44 rounded-xl overflow-hidden border border-cyan-400/30 bg-slate-950/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150'
          : 'pointer-events-none fixed left-[-9999px] top-[-9999px] h-2 w-2 overflow-hidden opacity-0'}
        aria-hidden={!isCameraExpanded}
      >
        {isCameraExpanded && (
          <div className="h-6 px-2.5 bg-white/[0.04] border-b border-white/5 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
              <Camera size={11} />
              <span>体感镜头画面</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCameraExpanded(false)}
              className="w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="收起画面"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        )}
        <div className={isCameraExpanded ? 'relative w-full h-28 bg-black/80' : 'relative h-2 w-2 overflow-hidden'}>
          <video
            ref={gesture.videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            muted
            playsInline
          />
          <canvas
            ref={gesture.overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
          />
          {isCameraExpanded && isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-amber-300 gap-1.5">
              <Loader2 size={16} className="animate-spin text-amber-400" />
              <span className="text-[10px]">初始化摄像头中...</span>
            </div>
          )}
        </div>
      </div>

      {/* 精致悬浮状态胶囊 (仅 28px 高度，不遮挡画布与时间线) */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/10 shadow-[0_6px_24px_rgba(0,0,0,0.6)] text-xs text-slate-300 transition-all">
        {/* 状态指示点 */}
        {isLoading && <Loader2 size={12} className="animate-spin text-amber-400 shrink-0" />}
        {isReady && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        )}
        {isIdle && <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />}
        {(isError || isNoCamera) && <AlertCircle size={12} className="text-rose-400 shrink-0" />}

        {/* 状态说明与手势反馈 */}
        <div className="text-[11px] font-medium flex items-center gap-1 pr-1">
          {isLoading && <span className="text-amber-200">体感加载中...</span>}
          {isReady && (
            gesture.trackingLost ? (
              <span className="text-slate-400">移入镜头手势区</span>
            ) : currentGestureLabel ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-300 bg-emerald-400/15 px-1.5 py-0.5 rounded border border-emerald-400/30">
                <span>{currentGestureEmoji}</span>
                <span>{currentGestureLabel}</span>
              </span>
            ) : (
              <span className="text-slate-300">体感就绪 · 监听中</span>
            )
          )}
          {isIdle && (
            <button
              type="button"
              onClick={beginGesture}
              className="text-sky-300 hover:text-white transition-colors"
            >
              点击启动摄像头
            </button>
          )}
          {isNoCamera && (
            <span className="text-amber-300 flex items-center gap-1" title={gesture.camError || undefined}>
              <span>需摄像头权限</span>
              <button
                type="button"
                onClick={beginGesture}
                className="underline hover:text-white"
              >
                授权
              </button>
            </span>
          )}
          {isError && (
            <span className="text-rose-300 flex items-center gap-1" title={gesture.camError || undefined}>
              <span>{gesture.mlReady ? '摄像头异常' : '引擎加载异常'}</span>
              <button
                type="button"
                onClick={() => { if (gesture.mlReady) beginGesture(); else void gesture.retry(); }}
                className="underline hover:text-white"
              >
                重试
              </button>
            </span>
          )}
        </div>

        {/* 按钮群组：画中画切换 + 关闭/退出 */}
        <div className="flex items-center gap-0.5 border-l border-white/10 pl-1.5 ml-0.5">
          {(isReady || isLoading) && (
            <button
              type="button"
              onClick={() => setIsCameraExpanded((prev) => !prev)}
              title={isCameraExpanded ? '收起摄像头画面' : '展开摄像头画面'}
              className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                isCameraExpanded ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {isCameraExpanded ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}

          <button
            type="button"
            onClick={onDisableMotion}
            title="退出体感控制"
            className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <Power size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
