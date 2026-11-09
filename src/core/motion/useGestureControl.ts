import { useEffect, useRef, useState, useCallback } from 'react';
import type { Scene, GestureBinding, GestureType } from '../../types';

/**
 * 页面级体感手势控制 Hook。
 * 负责：MediaPipe Hands 动态加载 → 摄像头帧识别 → 手势判定 →
 *       查当前场景 gestureBindings → 驱动页面级场景切换。
 * 输入与鼠标/键盘平级，属于全局交互输入总线的一部分。
 */

export type GestureStatus =
  | 'idle'      // 未启用
  | 'loading'   // 加载中
  | 'ready'     // 识别中
  | 'no-camera' // 无摄像头/被拒绝
  | 'error';    // 加载失败

export interface GestureControlOptions {
  enabled: boolean;
  sensitivity: number; // 0.2-2
  deadZone?: number;
  reverse?: boolean;
  disconnectTimeout?: number;
  activeScene: Scene | undefined;
  scenes: Record<string, Scene>;
  startSceneId: string;
  onSelectScene: (sceneId: string) => void;
  /** 外部回调：手势被触发时通知（用于 UI 提示） */
  onTrigger?: (gesture: GestureType, action: string) => void;
}

interface MlGlobals {
  FilesetResolver: any;
  HandLandmarker: any;
}

// 手指关键点索引
const TIP_IDS = [8, 12, 16, 20]; // 食指/中指/无名指/小指
const PIP_IDS = [6, 10, 14, 18];
const THUMB_TIP = 4;
const THUMB_PIP = 2;

export function useGestureControl(opts: GestureControlOptions) {
  const { enabled, sensitivity, deadZone = 0.06, reverse = false, disconnectTimeout = 900, activeScene, scenes, startSceneId, onSelectScene, onTrigger } = opts;

  const [status, setStatus] = useState<GestureStatus>('idle');
  const [mlReady, setMlReady] = useState(false); // MediaPipe 模型已就绪（等待用户点击启动）
  const [gestureLabel, setGestureLabel] = useState<string>('');
  const [camError, setCamError] = useState<string | null>(null);
  const [trackingLost, setTrackingLost] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  // 防重入：摄像头/识别启动过程中忽略再次点击，杜绝多流多 RAF 泄漏
  const startingRef = useRef<boolean>(false);

  // 手势判定状态
  const lastPalmX = useRef<number | null>(null);
  const lastPalmY = useRef<number | null>(null);
  const waveDir = useRef<number>(0);
  const waveFlips = useRef<number>(0);
  const cooldownRef = useRef<number>(0);
  // 连续帧确认防抖：同一手势连续 N 帧一致才触发，消除单帧抖动误触发
  const gestureStreak = useRef<{ g: string; n: number }>({ g: '', n: 0 });
  const noHandSince = useRef<number | null>(null);

  // 动作执行（读取最新绑定）
  const activeSceneRef = useRef(opts.activeScene);
  activeSceneRef.current = activeScene;
  const scenesRef = useRef(opts.scenes);
  scenesRef.current = scenes;
  const startRef = useRef(opts.startSceneId);
  startRef.current = startSceneId;
  const selectRef = useRef(onSelectScene);
  selectRef.current = onSelectScene;

  const sceneOrder = useCallback((): string[] => {
    const list = Object.values(scenesRef.current);
    const ordered = list
      .slice()
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || (a.alias || a.id).localeCompare(b.alias || b.id));
    return ordered.map((s) => s.id);
  }, []);

  const applyGesture = useCallback(
    (g: GestureType) => {
      const sc = activeSceneRef.current;
      const bindings: GestureBinding[] = (sc && sc.gestureBindings) || [];
      const b = bindings.find((x) => x.gesture === g);
      if (!b || b.action === 'none') return;
      const now = Date.now();
      if (now - cooldownRef.current < 800) return; // 冷却 800ms
      const order = sceneOrder();
      const idx = order.indexOf(sc ? sc.id : '');
      switch (b.action) {
        case 'next_scene': {
          if (order.length > 0) {
            const next = order[(idx + 1) % order.length];
            cooldownRef.current = now;
            selectRef.current(next);
            onTrigger && onTrigger(g, 'next_scene');
          }
          break;
        }
        case 'prev_scene': {
          if (order.length > 0) {
            const prev = order[(idx - 1 + order.length) % order.length];
            cooldownRef.current = now;
            selectRef.current(prev);
            onTrigger && onTrigger(g, 'prev_scene');
          }
          break;
        }
        case 'goto_scene': {
          if (b.targetSceneId && scenesRef.current[b.targetSceneId]) {
            cooldownRef.current = now;
            selectRef.current(b.targetSceneId);
            onTrigger && onTrigger(g, 'goto_scene');
          }
          break;
        }
        case 'show_menu': {
          cooldownRef.current = now;
          onTrigger && onTrigger(g, 'show_menu');
          break;
        }
        case 'goto_start': {
          cooldownRef.current = now;
          selectRef.current(startRef.current);
          onTrigger && onTrigger(g, 'goto_start');
          break;
        }
        case 'show_menu':
        default:
          break;
      }
    },
    [onTrigger, sceneOrder]
  );

  // 手势判定（MediaPipe 21 点）：挥手优先（路径反转检测），滑动次之（速度+位移），静态手势最后。
  // 【挥手重构】用手掌位置历史路径检测方向反转，不依赖单帧速度，避免被滑动判定拦截。
  const smoothVx = useRef(0);
  const smoothVy = useRef(0);
  const swipeAccumX = useRef(0);
  const swipeAccumTime = useRef(0);
  // 挥手路径历史：记录最近的手掌位置和时间，用于检测方向反转
  const wavePath = useRef<{ x: number; t: number }[]>([]);
  const waveSegStart = useRef<{ x: number; t: number } | null>(null);

  const classifyGesture = useCallback(
    (lm: any, dtSec: number): GestureType | null => {
      const lms = lm.landmarks && lm.landmarks[0];
      if (!lms || lms.length < 21) return null;
      // 灵敏度语义：数值越大越灵敏。内部换算成“阈值倍率”，1.0 保持原行为。
      const globalSensitivity = Math.max(0.2, Math.min(2, Number(sensitivity) || 1));
      const effectiveSensitivity = (g: GestureType) => {
        const bindings = activeSceneRef.current?.gestureBindings || [];
        const binding = bindings.find((item) => item.gesture === g);
        const factor = Number.isFinite(binding?.sensitivity) && (binding?.sensitivity ?? 0) > 0 ? Number(binding?.sensitivity) : 1;
        return Math.max(0.2, Math.min(2, globalSensitivity * factor));
      };
      const thresholdScale = (g: GestureType) => 1 / effectiveSensitivity(g);
      const extended = (tip: number, pip: number) => lms[tip].y < lms[pip].y;
      // 使用与手掌方向无关的距离判断，左右手及镜像摄像头都能识别拇指张开。
      const wrist = lms[0];
      const thumbExtended = () => {
        const tip = lms[THUMB_TIP];
        const pip = lms[THUMB_PIP];
        const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
        return dist(tip, wrist) > dist(pip, wrist) * 1.08;
      };
      let count = 0;
      for (let i = 0; i < 4; i++) if (extended(TIP_IDS[i], PIP_IDS[i])) count++;
      const thumb = thumbExtended() ? 1 : 0;
      const total = count + thumb;

      // 手腕(0)+中指根(9)平均点
      const palmX = (lms[0].x + lms[9].x) / 2;
      const palmY = (lms[0].y + lms[9].y) / 2;
      const now = Date.now();
      let dx = 0, dy = 0;
      if (lastPalmX.current !== null) {
        dx = palmX - lastPalmX.current;
        dy = palmY - lastPalmY.current;
      }
      lastPalmX.current = palmX;
      lastPalmY.current = palmY;

      const dt = Math.max(dtSec, 0.01);
      const rawVx = dx / dt;
      const rawVy = dy / dt;
      smoothVx.current = smoothVx.current * 0.3 + rawVx * 0.7;
      smoothVy.current = smoothVy.current * 0.3 + rawVy * 0.7;
      const vx = smoothVx.current;
      const vy = smoothVy.current;

      // 2指以上可做动态手势
      const canDynamic = count >= 2;

      if (canDynamic) {
        const movementFloor = Math.max(0.01, Math.min(0.3, deadZone));
        // 按“最终触发的手势”取对应绑定的灵敏度；reverse 时左右互换。
        const scaleRight = thresholdScale(reverse ? 'swipe_left' : 'swipe_right');
        const scaleLeft = thresholdScale(reverse ? 'swipe_right' : 'swipe_left');
        // ========== 判定1：瞬时速度（快速滑动）优先，避免被挥手拦截 ==========
        const horizOk = Math.abs(vx) > Math.abs(vy) * 1.1;
        if (vx > (1.2 * scaleRight + movementFloor * 3) && horizOk) {
          smoothVx.current = 0; smoothVy.current = 0;
          swipeAccumX.current = 0; swipeAccumTime.current = 0;
          wavePath.current = [];
          return reverse ? 'swipe_left' : 'swipe_right';
        }
        if (vx < -(1.2 * scaleLeft + movementFloor * 3) && horizOk) {
          smoothVx.current = 0; smoothVy.current = 0;
          swipeAccumX.current = 0; swipeAccumTime.current = 0;
          wavePath.current = [];
          return reverse ? 'swipe_right' : 'swipe_left';
        }

        // ========== 判定2：位移累积（慢速滑动）==========
        swipeAccumTime.current += dt;
        if (swipeAccumTime.current > 0.6) {
          swipeAccumX.current = 0;
          swipeAccumTime.current = 0;
        }
        if (Math.abs(dx) > 0.001) {
          if (Math.abs(swipeAccumX.current) < 0.008 ||
              (swipeAccumX.current >= 0 && dx > 0) ||
              (swipeAccumX.current <= 0 && dx < 0)) {
            swipeAccumX.current += dx;
          } else {
            swipeAccumX.current = dx;
          }
        }
        if (swipeAccumX.current > (0.08 * scaleRight + movementFloor) && Math.abs(swipeAccumX.current) > Math.abs(dy) * 1.2) {
          smoothVx.current = 0; smoothVy.current = 0;
          swipeAccumX.current = 0; swipeAccumTime.current = 0;
          wavePath.current = [];
          return reverse ? 'swipe_left' : 'swipe_right';
        }
        if (swipeAccumX.current < -(0.08 * scaleLeft + movementFloor) && Math.abs(swipeAccumX.current) > Math.abs(dy) * 1.2) {
          smoothVx.current = 0; smoothVy.current = 0;
          swipeAccumX.current = 0; swipeAccumTime.current = 0;
          wavePath.current = [];
          return reverse ? 'swipe_right' : 'swipe_left';
        }

        // ========== 判定3：挥手（极值点法，仅在未触发滑动时检测）==========
        // 要求：极值点不在路径端点（排除单向滑动），且间距>7%屏宽
        while (wavePath.current.length > 0 && now - wavePath.current[0].t > 600) {
          wavePath.current.shift();
        }
        wavePath.current.push({ x: palmX, t: now });

        if (wavePath.current.length >= 5) {
          const pts = wavePath.current;
          let maxX = -Infinity, minX = Infinity, maxIdx = 0, minIdx = 0;
          for (let i = 0; i < pts.length; i++) {
            if (pts[i].x > maxX) { maxX = pts[i].x; maxIdx = i; }
            if (pts[i].x < minX) { minX = pts[i].x; minIdx = i; }
          }
          const range = maxX - minX;
          // 关键：最大值和最小值都不能在路径的第一个或最后一个点
          // 单向滑动时极值在端点，挥手时极值在中间
          const maxInMiddle = maxIdx > 0 && maxIdx < pts.length - 1;
          const minInMiddle = minIdx > 0 && minIdx < pts.length - 1;
          if (range > (0.07 * thresholdScale('wave') + movementFloor) && maxInMiddle && minInMiddle) {
            wavePath.current = [];
            smoothVx.current = 0; smoothVy.current = 0;
            swipeAccumX.current = 0; swipeAccumTime.current = 0;
            return 'wave';
          }
        }
      } else {
        swipeAccumX.current = 0;
        swipeAccumTime.current = 0;
        wavePath.current = [];
      }

      if (total >= 5) return 'open_palm';
      if (total <= 1) return 'fist';
      if (count === 1 && extended(8, 6)) return 'point';
      return null;
    },
    [deadZone, reverse, sensitivity]
  );

  // 渲染骨架到 overlay
  const drawSkeleton = useCallback((lm: any) => {
    const cv = overlayRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const lms = lm.landmarks && lm.landmarks[0];
    if (!lms) return;
    const W = cv.width;
    const H = cv.height;
    const connections: [number, number][] = [
      [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
    ];
    ctx.strokeStyle = 'rgba(124, 92, 255, 0.9)';
    ctx.lineWidth = 2;
    connections.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(lms[a].x * W, lms[a].y * H);
      ctx.lineTo(lms[b].x * W, lms[b].y * H);
      ctx.stroke();
    });
    ctx.fillStyle = '#ffffff';
    lms.forEach((p: any) => {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  // 帧循环（~30fps 检测；连续帧确认防抖后执行动作）
  const detectLoop = useCallback(() => {
    const video = videoRef.current;
    const lm = landmarkerRef.current;
    if (!video || !lm || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }
    const now = performance.now();
    if (lastTimeRef.current < 0) lastTimeRef.current = now;
    const dtMs = now - lastTimeRef.current;
    if (dtMs > 33) {
      try {
        const res = lm.detectForVideo(video, now);
        drawSkeleton(res || { landmarks: [] });
        if (res && res.landmarks && res.landmarks.length > 0) {
          noHandSince.current = null;
          setTrackingLost(false);
          const g = classifyGesture(res, dtMs / 1000);
          if (g) {
            setGestureLabel(g);
            // 动态手势（挥手/滑动）是瞬时动作，立即触发，不需要连续帧确认
            // 静态手势（握拳/张手/指点）保留连续3帧确认防抖
            const isDynamic = g === 'wave' || g === 'swipe_left' || g === 'swipe_right';
            if (isDynamic) {
              gestureStreak.current = { g: '', n: 0 };
              applyGesture(g);
            } else {
              if (gestureStreak.current.g === g) gestureStreak.current.n++;
              else gestureStreak.current = { g, n: 1 };
              if (gestureStreak.current.n >= 3) {
                gestureStreak.current = { g: '', n: 0 };
                applyGesture(g);
              }
            }
          } else {
            gestureStreak.current = { g: '', n: 0 };
          }
        } else {
          if (noHandSince.current === null) noHandSince.current = Date.now();
          if (Date.now() - noHandSince.current >= disconnectTimeout) setTrackingLost(true);
          // 手离开画面后清空上一帧手势，避免残留手势继续显示或影响下一次识别。
          lastPalmX.current = null;
          lastPalmY.current = null;
          smoothVx.current = 0;
          smoothVy.current = 0;
          swipeAccumX.current = 0;
          swipeAccumTime.current = 0;
          wavePath.current = [];
          gestureStreak.current = { g: '', n: 0 };
          setGestureLabel('');
        }
        lastTimeRef.current = now;
      } catch (e) {
        /* 单帧失败忽略 */
      }
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [applyGesture, classifyGesture, drawSkeleton, disconnectTimeout]);

  // 【离线优先】体感引擎与模型随应用一起分发（public/mediapipe），
  // 本地失败再降级到 CDN。国内网络/离线环境下不再依赖 jsdelivr。
  const LOCAL_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
  const ML_CDN_SOURCES = [
    { js: `${LOCAL_ORIGIN}/mediapipe/vision_bundle.js`, wasm: `${LOCAL_ORIGIN}/mediapipe/wasm` },
    { js: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.js', wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm' },
    { js: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.0/vision_bundle.js', wasm: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.0/wasm' },
    { js: 'https://cdn.npmmirror.com/packages/@mediapipe/tasks-vision/0.10.0/vision_bundle.js', wasm: 'https://cdn.npmmirror.com/packages/@mediapipe/tasks-vision/0.10.0/wasm' },
  ];
  // 手部关键点模型多源：本地优先，CDN 兜底。
  const MODEL_SOURCES = [
    `${LOCAL_ORIGIN}/mediapipe/hand_landmarker.task`,
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    'https://cdn.jsdelivr.net/gh/google/mediapipe@v0.10.9/tasks/web/vision/testdata/hand_landmarker.task',
  ];

  const loadMlWithFallback = useCallback(async () => {
    let lastErr: any = null;
    // 逐个 CDN 源尝试加载 JS 库 + WASM
    for (let si = 0; si < ML_CDN_SOURCES.length; si++) {
      const src = ML_CDN_SOURCES[si];
      try {
        setCamError(`正在加载体感识别引擎（源 ${si + 1}/${ML_CDN_SOURCES.length}）…`);
        const mod: MlGlobals = (await import(
          /* @vite-ignore */
          // @ts-ignore 外部 URL 运行时 import
          src.js
        )) as MlGlobals;
        const fileset = await mod.FilesetResolver.forVisionTasks(src.wasm);
        // 模型文件多源尝试
        for (let mi = 0; mi < MODEL_SOURCES.length; mi++) {
          const modelUrl = MODEL_SOURCES[mi];
          try {
            // 先尝试 GPU，失败则降级 CPU
            for (const delegate of ['GPU', 'CPU'] as const) {
              try {
                const landmarker = await mod.HandLandmarker.createFromOptions(fileset, {
                  baseOptions: { modelAssetPath: modelUrl, delegate },
                  runningMode: 'VIDEO',
                  numHands: 1,
                });
                return landmarker;
              } catch (delegateErr: any) {
                lastErr = delegateErr;
                if (delegate === 'GPU') continue; // GPU 失败降级 CPU
                throw delegateErr; // CPU 也失败则抛出，尝试下一个模型源
              }
            }
          } catch (modelErr: any) {
            lastErr = modelErr;
            continue; // 尝试下一个模型源
          }
        }
      } catch (cdnErr: any) {
        lastErr = cdnErr;
        continue; // 尝试下一个 CDN 源
      }
    }
    throw lastErr || new Error('所有 CDN 源均加载失败');
  }, []);

  // 初始化：开启后仅预加载 MediaPipe（不请求摄像头，权限在用户点击启动后请求）
  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setGestureLabel('');
      // 关闭体感时只停摄像头/识别循环，保留已加载的模型，避免每次重新下载 CDN。
      stopInternal(false);
      return;
    }
    // 已经加载过模型：直接恢复就绪状态，秒开，不再走网络。
    if (landmarkerRef.current) {
      setMlReady(true);
      setStatus('idle');
      setCamError(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setCamError(null);
      try {
        const landmarker = await loadMlWithFallback();
        if (cancelled) { landmarker.close && landmarker.close(); return; }
        landmarkerRef.current = landmarker;
        setMlReady(true);
        setCamError(null);
        setStatus('idle'); // 就绪，等待用户点击「启动体感」
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e && e.message ? e.message : e);
        setCamError(
          `体感引擎加载失败：${msg.slice(0, 80)}。` +
          `可能原因：网络无法访问 MediaPipe CDN（国内网络需科学上网），或浏览器不支持 WebGPU。` +
          `请检查网络后点击「重试」。`
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadMlWithFallback]);

  // 启动：用户点击后请求摄像头权限（浏览器在此弹出授权窗）
  // 注：setStatus('loading') 触发重渲染挂载 video 元素，
  // 随后 await getUserMedia() 等待用户授权期间 React 已完成渲染，videoRef 可用。
  const start = useCallback(async () => {
    if (!mlReady) return;
    // 已在运行 / 正在启动：直接忽略，避免重复 getUserMedia 与多条 RAF 链（内存泄漏/多摄像头）
    if (startingRef.current) return;
    // 内联清理上一轮残留（stopInternal 定义在后方，避免 TDZ），杜绝多流/多 RAF
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    startingRef.current = true;
    setStatus('loading');
    setCamError(null);
    let acquired: MediaStream | null = null;
    const waitForVideo = async (): Promise<HTMLVideoElement | null> => {
      // 摄像头预览可能比 getUserMedia 晚一帧挂载；等最多 20 帧，避免误报 no-video。
      for (let i = 0; i < 20; i += 1) {
        if (videoRef.current) return videoRef.current;
        if (!startingRef.current) return null;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return videoRef.current;
    };
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      // 启动期间若已被停止（用户快速关闭），立即释放，避免悬空占用摄像头
      if (!startingRef.current) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = acquired;
      const video = await waitForVideo();
      if (!video) throw new Error('摄像头预览组件未挂载，请重新点击启动');
      video.srcObject = acquired;
      await video.play().catch(() => undefined);
      setStatus('ready');
      lastTimeRef.current = -1;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (e: any) {
      if (acquired) acquired.getTracks().forEach((t) => t.stop());
      setCamError(String(e && e.message ? e.message : e));
      setStatus(e && e.name === 'NotAllowedError' ? 'no-camera' : 'error');
    } finally {
      startingRef.current = false;
    }
  }, [mlReady, detectLoop]); // eslint-disable-line react-hooks/exhaustive-deps

  // 重试加载 MediaPipe（加载失败时用户可点击重试）
  const retry = useCallback(async () => {
    if (!enabled) return;
    setStatus('loading');
    setCamError(null);
    setMlReady(false);
    try {
      // 释放上一个识别器，避免 MediaPipe WASM 堆实例堆积导致 Out of Memory
      if (landmarkerRef.current) {
        try { landmarkerRef.current.close && landmarkerRef.current.close(); } catch (err) { /* ignore */ }
        landmarkerRef.current = null;
      }
      const landmarker = await loadMlWithFallback();
      landmarkerRef.current = landmarker;
      setMlReady(true);
      setCamError(null);
      setStatus('idle');
    } catch (e: any) {
      const msg = String(e && e.message ? e.message : e);
      setCamError(
        `体感引擎加载失败：${msg.slice(0, 80)}。可能原因：网络无法访问 MediaPipe CDN（国内网络需科学上网），或浏览器不支持 WebGPU。请检查网络后再次重试。`
      );
      setStatus('error');
    }
  }, [enabled, loadMlWithFallback]);

  // 停止：关闭摄像头与识别
  const stopInternal = useCallback((disposeModel = false) => {
    startingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (disposeModel && landmarkerRef.current) {
      try { landmarkerRef.current.close && landmarkerRef.current.close(); } catch (e) { /* ignore */ }
      landmarkerRef.current = null;
      setMlReady(false);
    }
    lastPalmX.current = null;
    lastPalmY.current = null;
    waveDir.current = 0;
    waveFlips.current = 0;
    gestureStreak.current = { g: '', n: 0 };
    setGestureLabel('');
    setTrackingLost(false);
    noHandSince.current = null;
  }, []);

  const stop = useCallback(() => {
    setStatus('idle');
    stopInternal();
  }, [stopInternal]);

  // 组件卸载时才释放 MediaPipe 模型，开关体感不重复下载。
  useEffect(() => () => { stopInternal(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 页面切入后台时释放摄像头，回到页面后由用户主动重新启动，避免后台持续耗电/占用设备。
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && streamRef.current) {
        setStatus('idle');
        stopInternal();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [stopInternal]);

  return {
    status,
    gestureLabel,
    camError,
    videoRef,
    overlayRef,
    gestureMap: activeScene?.gestureBindings || [],
    mlReady,
    start,
    stop,
    retry,
    trackingLost,
  };
}
