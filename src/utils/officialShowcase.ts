import type { ProjectData, Scene, SceneElement } from '../types';
import {
  bgVoidIllumination,
  bgChronosOptics,
  bgCyberGrid,
  bgUniversalHorizon,
} from './showcaseBackgrounds';

/**
 * 鲸动交互平台 (AETHER) · 官方旗舰全景工程
 *
 * 核心审美定位：
 * - Apple Pro 极简工程美学 · 工业级深空黑底色 (#03050a) · 钛金霜白与极光流光
 * - 深度融合本软件专属特性：
 *   1. 3D 空间视差分层 (Parallax & Depth-Z)
 *   2. 毫秒级多轨动力时间轴 (Kinetic Timeline & Keyframes)
 *   3. 电影级 Saber 激光流光引擎 (Optics & Beam Flow)
 *   4. VFX 粒子与深渊网格氛围 (Atmosphere Engine)
 *   5. 高斯羽化圆角矢量蒙版 (Vector Masking)
 *   6. 深度承载第三方高性能交互代码 (Custom Code Runtime)
 *   7. 工业级 Galaxy UI 与物联网 MQTT 变量联动 (IoT Living Data)
 *   8. 全端无缝交付 (Universal Horizons)
 */

const element = (
  id: string,
  type: SceneElement['type'],
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<SceneElement> = {}
): SceneElement => ({
  id,
  type,
  refId: '',
  sourceName: id,
  x,
  y,
  w,
  h,
  zIndex: extra.zIndex ?? 1,
  opacity: extra.opacity ?? 100,
  startTime: extra.startTime ?? 0,
  duration: extra.duration ?? 12,
  ...extra,
});

const text = (id: string, content: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}) =>
  element(id, 'txt', x, y, w, h, {
    content,
    color: '#f8fafc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontWeight: '500',
    lineHeight: 1.12,
    ...extra,
  });

const photo = (id: string, refId: string, x = 0, y = 0, w = 100, h = 100, extra: Partial<SceneElement> = {}) =>
  element(id, 'img', x, y, w, h, {
    refId,
    mediaAspect: w / h,
    lockAspectRatio: true,
    zIndex: 2,
    ...extra,
  });

const card = (id: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}) =>
  element(id, 'shape', x, y, w, h, {
    shapeKind: 'rounded-rect',
    backgroundType: 'glass',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 22,
    backdropBlur: 24,
    boxShadow: '0 28px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    zIndex: 3,
    ...extra,
  });

const keyframes = (tracks: Array<{ property: string; values: Array<[number, number]> }>): SceneElement['keyframes'] => ({
  tracks: tracks.map(({ property, values }) => ({
    property,
    keyframes: values.map(([time, value], index) => ({
      id: `k-${property}-${index}`,
      time,
      value,
      easing: 'ease-in-out' as const,
    })),
  })),
});

const scrim = (id: string, color: string, opacity: number, zIndex = 1) =>
  element(id, 'shape', 0, 0, 100, 100, {
    color,
    opacity,
    borderWidth: 0,
    borderRadius: 0,
    zIndex,
  });

const vfx = (id: string, motion: SceneElement['vfxMotionType'], colorA: string, colorB: string, opacity = 18, extra: Partial<SceneElement> = {}) =>
  element(id, 'vfx', 0, 0, 100, 100, {
    vfxMotionType: motion,
    vfxColorA: colorA,
    vfxColorB: colorB,
    vfxSpeed: 0.25,
    opacity,
    zIndex: 0,
    duration: 16,
    ...extra,
  });

const saber = (id: string, x: number, y: number, w: number, h: number, path: string, glow: string, extra: Partial<SceneElement> = {}) =>
  element(id, 'saber', x, y, w, h, {
    saberPreset: 'neon',
    saberEffectType: 'beam',
    saberPath: path,
    saberPathType: 'preset',
    saberCoreColor: '#ffffff',
    saberGlowColor: glow,
    saberSecondaryGlowColor: '#bae6fd',
    saberCoreWidth: 1.6,
    saberGlowSpread: 22,
    saberGlowIntensity: 1.8,
    saberGrowthMode: 'grow-in',
    saberGrowthSpeed: 0.85,
    saberFlickerIntensity: 2,
    saberBlendMode: 'screen',
    zIndex: 8,
    duration: 16,
    ...extra,
  });

const actionBtn = (id: string, label: string, targetScene: string, x: number, y: number, w: number, h = 5.2, extra: Partial<SceneElement> = {}) =>
  text(id, label, x, y, w, h, {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    verticalAlign: 'middle',
    link: targetScene,
    linkType: 'jump',
    trigger: 'click',
    interaction: { trigger: 'click', action: 'jump', target: targetScene },
    hoverEffect: 'brighten',
    interactionEffect: 'chromatic-ripple',
    interactionEffectTrigger: 'click',
    interactionEffectColor: '#38bdf8',
    zIndex: 20,
    ...extra,
  });

const scene = (id: string, alias: string, els: SceneElement[], bgRef: string, options: Partial<Scene> = {}): Scene => ({
  id,
  alias,
  type: 'scene',
  duration: 12,
  cruiseDuration: 12,
  bgColor: '#03050a',
  bgRef,
  backgroundType: 'solid',
  inPoint: 0,
  outPoint: 12,
  transitionIn: 'soft-wipe',
  transitionOut: 'fade',
  transitionDuration: 0.85,
  transitionEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  gestureBindings: [
    { id: `${id}-swipe-left`, gesture: 'swipe_left', action: 'next_scene' },
    { id: `${id}-swipe-right`, gesture: 'swipe_right', action: 'prev_scene' },
  ],
  els,
  ...options,
});

// =============================================================================
// 高阶第三方自定义代码组件 1：【AETHER 全息三维空间内核 (Holographic Spatial Core)】
// 纯原生 Canvas 3D 环形光子轨道 + 实时交互视差跟踪 + 状态徽章
// =============================================================================
const spatialCorePlugin = {
  id: 'aether-spatial-core-v4',
  version: 3,
  name: 'AETHER 全息三维空间内核',
  description: '纯原生 Canvas 驱动的全息三维光子环与空间视差动力引擎。',
  preview: { mode: 'desktop' as const, background: 'transparent' as const },
  diagnostics: { status: 'passed' as const, errors: [], warnings: [], checkedAt: new Date().toISOString() },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  controls: [
    { key: 'speed', label: '空间转速', type: 'slider' as const, default: 1.0, min: 0.1, max: 3.0, step: 0.1, unit: 'x', group: '动力内核' },
    { key: 'color', label: '光子色谱', type: 'color' as const, default: '#38bdf8', group: '视觉外观' },
    { key: 'glow', label: '全息光晕', type: 'slider' as const, default: 70, min: 0, max: 100, step: 1, unit: '%', group: '视觉外观' },
    { key: 'size', label: '轨道比例', type: 'slider' as const, default: 100, min: 50, max: 150, step: 5, unit: '%', group: '动力内核' },
    { key: 'enabled', label: '空间运行', type: 'toggle' as const, default: true, group: '动力内核' },
  ],
  controlValues: {
    speed: 1.0,
    color: '#38bdf8',
    glow: 70,
    size: 100,
    enabled: true,
  },
  html: `<div class="spatial-deck" id="spatialDeck">
  <div class="deck-chrome">
    <div class="traffic-lights">
      <span class="light red"></span>
      <span class="light yellow"></span>
      <span class="light green"></span>
    </div>
    <div class="deck-title">AETHER KERNEL // SPATIAL MATRIX</div>
    <div class="live-pill"><span class="live-led"></span>60 FPS · PARALLAX ON</div>
  </div>
  <div class="canvas-wrap">
    <canvas id="spatialCanvas" width="560" height="300"></canvas>
    <div class="canvas-overlay">
      <div class="hud-tag top-left">DEPTH-Z: +128px</div>
      <div class="hud-tag bottom-right">RAYMARCH: GPU ACCELERATED</div>
    </div>
  </div>
  <div class="deck-toolbar">
    <div class="mode-capsules">
      <span class="capsule active" id="btnOrbit">全息轨道</span>
      <span class="capsule" id="btnWave">引力波纹</span>
      <span class="capsule" id="btnPulse">量子脉冲</span>
    </div>
    <div class="sub-stat">LATENCY: <strong id="latencyVal">4.2ms</strong></div>
  </div>
</div>`,
  css: `/* @control slider key=speed label="空间转速" min=0.1 max=3 step=0.1 default=1 unit="x" group="动力内核" */
/* @control color key=color label="光子色谱" default="#38bdf8" group="视觉外观" */
/* @control slider key=glow label="全息光晕" min=0 max=100 step=1 default=70 unit="%" group="视觉外观" */
/* @control slider key=size label="轨道比例" min=50 max=150 step=5 default=100 unit="%" group="动力内核" */
/* @control toggle key=enabled label="空间运行" default=true group="动力内核" */
:host {
  --color: #38bdf8;
  --speed: 1.0;
  --glow: 70;
  --size: 100;
  display: block;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
  color: #f8fafc;
  user-select: none;
}
.spatial-deck {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 18px 22px;
  background: rgba(10, 15, 29, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 26px;
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.16);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.deck-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.traffic-lights {
  display: flex;
  gap: 6px;
}
.light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.light.red { background: #ff5f56; box-shadow: 0 0 8px rgba(255, 95, 86, 0.5); }
.light.yellow { background: #ffbd2e; box-shadow: 0 0 8px rgba(255, 189, 46, 0.5); }
.light.green { background: #27c93f; box-shadow: 0 0 8px rgba(39, 201, 63, 0.5); }
.deck-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--aether-color, var(--color, #38bdf8));
  text-shadow: 0 0 calc(var(--aether-glow, var(--glow, 70)) * 0.18px) var(--aether-color, var(--color, #38bdf8));
}
.live-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--aether-color, var(--color, #38bdf8)) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--aether-color, var(--color, #38bdf8)) 35%, transparent);
  border-radius: 999px;
  font-size: 10px;
  color: var(--aether-color, var(--color, #7dd3fc));
  font-weight: 600;
  letter-spacing: 0.05em;
}
.live-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--aether-color, var(--color, #38bdf8));
  box-shadow: 0 0 calc(var(--aether-glow, var(--glow, 70)) * 0.12px) var(--aether-color, var(--color, #38bdf8));
  animation: ledBlink 2s infinite ease-in-out;
}
.canvas-wrap {
  position: relative;
  flex: 1;
  margin: 14px 0;
  border-radius: 16px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--aether-color, var(--color, #0ea5e9)) 14%, transparent), rgba(2, 6, 23, 0.85));
  border: 1px solid rgba(255, 255, 255, 0.08);
}
#spatialCanvas {
  width: 100%;
  height: 100%;
  display: block;
}
.canvas-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.hud-tag {
  position: absolute;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid color-mix(in srgb, var(--aether-color, var(--color, #38bdf8)) 30%, transparent);
  border-radius: 6px;
  font-size: 9px;
  letter-spacing: 0.08em;
  color: #94a3b8;
}
.hud-tag.top-left { top: 10px; left: 12px; }
.hud-tag.bottom-right { bottom: 10px; right: 12px; }
.deck-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.mode-capsules {
  display: flex;
  gap: 8px;
}
.capsule {
  padding: 5px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}
.capsule:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}
.capsule.active {
  background: color-mix(in srgb, var(--aether-color, var(--color, #38bdf8)) 18%, transparent);
  border-color: color-mix(in srgb, var(--aether-color, var(--color, #38bdf8)) 60%, transparent);
  color: var(--aether-color, var(--color, #38bdf8));
  font-weight: 600;
  box-shadow: 0 0 12px color-mix(in srgb, var(--aether-color, var(--color, #38bdf8)) 30%, transparent);
}
.sub-stat {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.05em;
}
.sub-stat strong {
  color: var(--aether-color, var(--color, #38bdf8));
  font-family: ui-monospace, SFMono-Regular, monospace;
}
@keyframes ledBlink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.85); }
}`,
  js: `(function() {
  var canvas = document.getElementById('spatialCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var currentMode = 'orbit';
  var angle = 0;
  var mouseX = 0;
  var mouseY = 0;
  var targetX = 0;
  var targetY = 0;

  var btnOrbit = document.getElementById('btnOrbit');
  var btnWave = document.getElementById('btnWave');
  var btnPulse = document.getElementById('btnPulse');

  function setMode(mode, activeBtn) {
    currentMode = mode;
    [btnOrbit, btnWave, btnPulse].forEach(function(b) { if(b) b.classList.remove('active'); });
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (btnOrbit) btnOrbit.addEventListener('click', function() { setMode('orbit', btnOrbit); });
  if (btnWave) btnWave.addEventListener('click', function() { setMode('wave', btnWave); });
  if (btnPulse) btnPulse.addEventListener('click', function() { setMode('pulse', btnPulse); });

  window.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    targetX = (e.clientX - rect.left - rect.width / 2) * 0.003;
    targetY = (e.clientY - rect.top - rect.height / 2) * 0.003;
  });

  var particles = [];
  for (var i = 0; i < 90; i++) {
    var theta = Math.random() * Math.PI * 2;
    var phi = (Math.random() - 0.5) * Math.PI;
    var r = 85 + Math.random() * 45;
    particles.push({ theta: theta, phi: phi, r: r, size: 1.2 + Math.random() * 1.8, speed: 0.008 + Math.random() * 0.012 });
  }

  function getProps() {
    var p = (typeof window !== 'undefined' && window.aetherProps) ? window.aetherProps : {};
    return {
      speed: typeof p.speed === 'number' ? p.speed : 1.0,
      color: p.color || '#38bdf8',
      glow: typeof p.glow === 'number' ? p.glow : 70,
      size: typeof p.size === 'number' ? p.size : 100,
      enabled: p.enabled !== false,
    };
  }

  function render() {
    var props = getProps();
    if (props.enabled) {
      angle += 0.012 * props.speed;
    }
    mouseX += (targetX - mouseX) * 0.08;
    mouseY += (targetY - mouseY) * 0.08;

    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var cy = h / 2;
    var scaleMul = (props.size || 100) / 100;

    // 中心微发光核 - 动态响应 color 与 glow
    var glowRadius = Math.max(20, 140 * scaleMul * (0.5 + (props.glow / 100) * 0.7));
    var radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    radGrad.addColorStop(0, props.color);
    radGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.12)');
    radGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = radGrad;
    ctx.globalAlpha = Math.min(1, Math.max(0.08, (props.glow / 100) * 0.45));
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 绘制 3D 旋转光子粒子
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (props.enabled) {
        p.theta += p.speed * props.speed;
      }

      var rotY = p.theta + angle + mouseX;
      var rotX = p.phi + mouseY;

      var x3d = p.r * Math.cos(rotX) * Math.sin(rotY) * scaleMul;
      var y3d = p.r * Math.sin(rotX) * scaleMul;
      var z3d = p.r * Math.cos(rotX) * Math.cos(rotY) + 200;

      if (currentMode === 'wave') {
        y3d += Math.sin(p.theta * 3 + angle * 2) * 18 * scaleMul;
      } else if (currentMode === 'pulse') {
        var s = 1 + Math.sin(angle * 3) * 0.2;
        x3d *= s; y3d *= s;
      }

      var scale = 220 / (z3d || 1);
      var projX = cx + x3d * scale;
      var projY = cy + y3d * scale;
      var alpha = Math.max(0.15, Math.min(1, (z3d - 120) / 160));

      ctx.fillStyle = (i % 3 === 0) ? props.color : (i % 3 === 1) ? '#818cf8' : '#e2e8f0';
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(projX, projY, Math.max(0.8, p.size * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 绘制外环导轨 - 动态响应 color
    ctx.strokeStyle = props.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 140 * scaleMul, (48 + Math.sin(angle * 0.5) * 8) * scaleMul, angle * 0.4 + mouseX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();`,
};

// =============================================================================
// 高阶第三方自定义代码组件 2：【动力光子发生器与多轨混音时间台 (Kinetic Waveform Rack)】
// 实时多正弦光子波形综合渲染 + 关键帧跳变刻度 + 动态频谱条
// =============================================================================
const kineticWaveformPlugin = {
  id: 'aether-kinetic-synth-v4',
  version: 3,
  name: 'AETHER 光子动力合成仪',
  description: '毫秒级弹性光子波形与多轨道时间轴交互控制台。',
  preview: { mode: 'desktop' as const, background: 'transparent' as const },
  diagnostics: { status: 'passed' as const, errors: [], warnings: [], checkedAt: new Date().toISOString() },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  controls: [
    { key: 'speed', label: '波形频速', type: 'slider' as const, default: 1.0, min: 0.1, max: 3.0, step: 0.1, unit: 'x', group: '动力合成' },
    { key: 'color', label: '极光色调', type: 'color' as const, default: '#38bdf8', group: '视觉外观' },
    { key: 'glow', label: '辉光强度', type: 'slider' as const, default: 75, min: 0, max: 100, step: 1, unit: '%', group: '视觉外观' },
    { key: 'size', label: '振幅比例', type: 'slider' as const, default: 100, min: 50, max: 150, step: 5, unit: '%', group: '动力合成' },
    { key: 'enabled', label: '合成运转', type: 'toggle' as const, default: true, group: '动力合成' },
  ],
  controlValues: {
    speed: 1.0,
    color: '#38bdf8',
    glow: 75,
    size: 100,
    enabled: true,
  },
  html: `<div class="synth-station">
  <div class="synth-head">
    <div class="brand-row"><span class="glow-disc"></span><span class="txt">AETHER CHRONOS // WAVEFORM SYNTHESIZER</span></div>
    <div class="freq-tag">TIMECODE: <span id="timeReadout">00:04.28</span></div>
  </div>
  <div class="synth-canvas-box">
    <canvas id="waveformCanvas" width="560" height="230"></canvas>
  </div>
  <div class="timeline-scrubber">
    <div class="scrub-track"><div class="scrub-fill" id="scrubFill"></div><div class="scrub-thumb" id="scrubThumb"></div></div>
    <div class="keyframe-markers">
      <span class="kf">◆ 0.0s</span>
      <span class="kf">◆ 3.2s</span>
      <span class="kf active">◆ 6.0s (BEAM MAX)</span>
      <span class="kf">◆ 12.0s</span>
    </div>
  </div>
  <div class="equalizer-bars" id="eqBars"></div>
</div>`,
  css: `:host {
  display: block;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  color: #f1f5f9;
  user-select: none;
}
.synth-station {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 18px 22px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 26px;
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.synth-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.glow-disc {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a855f7;
  box-shadow: 0 0 10px #a855f7;
}
.brand-row .txt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #c084fc;
}
.freq-tag {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #94a3b8;
}
.freq-tag span {
  color: #38bdf8;
  font-weight: 700;
}
.synth-canvas-box {
  position: relative;
  height: 160px;
  margin: 10px 0;
  border-radius: 14px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.12), rgba(3, 7, 18, 0.9));
  border: 1px solid rgba(255, 255, 255, 0.08);
}
#waveformCanvas {
  width: 100%;
  height: 100%;
  display: block;
}
.timeline-scrubber {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.scrub-track {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: visible;
}
.scrub-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 50%;
  border-radius: 999px;
  background: linear-gradient(90deg, #38bdf8, #a855f7);
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.6);
}
.scrub-thumb {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.4), 0 0 14px #a855f7;
  transform: translateX(-50%);
}
.keyframe-markers {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}
.keyframe-markers .kf.active {
  color: #38bdf8;
  font-weight: 700;
}
.equalizer-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 24px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.eq-bar {
  flex: 1;
  background: linear-gradient(0deg, #38bdf8, #a855f7);
  border-radius: 2px 2px 0 0;
  transition: height 0.08s ease;
  min-height: 3px;
}`,
  js: `(function() {
  var canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var eqContainer = document.getElementById('eqBars');
  var eqBars = [];
  if (eqContainer) {
    for (var i = 0; i < 28; i++) {
      var bar = document.createElement('div');
      bar.className = 'eq-bar';
      eqContainer.appendChild(bar);
      eqBars.push(bar);
    }
  }

  var phase = 0;
  var scrubFill = document.getElementById('scrubFill');
  var scrubThumb = document.getElementById('scrubThumb');
  var timeReadout = document.getElementById('timeReadout');

  function getProps() {
    var p = (typeof window !== 'undefined' && window.aetherProps) ? window.aetherProps : {};
    return {
      speed: typeof p.speed === 'number' ? p.speed : 1.0,
      color: p.color || '#38bdf8',
      glow: typeof p.glow === 'number' ? p.glow : 75,
      size: typeof p.size === 'number' ? p.size : 100,
      enabled: p.enabled !== false,
    };
  }

  function render() {
    var props = getProps();
    if (props.enabled) {
      phase += 0.04 * props.speed;
    }
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var ampScale = (props.size || 100) / 100;

    // 动态时间戳与进度
    var progress = (Math.sin(phase * 0.4) * 0.5 + 0.5);
    if (scrubFill) scrubFill.style.width = (progress * 100) + '%';
    if (scrubThumb) scrubThumb.style.left = (progress * 100) + '%';
    if (timeReadout) {
      var s = (progress * 12).toFixed(2);
      timeReadout.textContent = (s < 10 ? '00:0' : '00:') + s;
    }

    // 绘制 3 条不同频段的平滑正弦波
    var waves = [
      { color: props.color, freq: 0.015, amp: 38 * ampScale, speed: phase * 1.2 },
      { color: 'rgba(168, 85, 247, 0.8)', freq: 0.022, amp: 26 * ampScale, speed: -phase * 1.5 },
      { color: 'rgba(236, 72, 153, 0.65)', freq: 0.035, amp: 16 * ampScale, speed: phase * 2.0 }
    ];

    waves.forEach(function(wave) {
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (var x = 0; x < w; x += 4) {
        var y = h / 2 + Math.sin(x * wave.freq + wave.speed) * wave.amp * Math.sin(x / w * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // 动态更新均衡器频谱柱
    for (var j = 0; j < eqBars.length; j++) {
      var hRatio = Math.abs(Math.sin(phase * 2 + j * 0.35)) * 0.8 + 0.2;
      eqBars[j].style.height = (hRatio * 20) + 'px';
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();`,
};

// =============================================================================
// 高阶第三方自定义代码组件 3：【全息数字孪生遥测中枢 (Nexus Telemetry Deck)】
// 实时雷达圆弧扫描 + 动态拓扑节点 + 高频 MQTT 数据包流动日志
// =============================================================================
const telemetryDeckPlugin = {
  id: 'aether-nexus-telemetry-v4',
  version: 3,
  name: 'AETHER 全息数字孪生中枢',
  description: 'MQTT 物联网实时数据流与多节点雷达拓扑遥测中枢。',
  preview: { mode: 'desktop' as const, background: 'transparent' as const },
  diagnostics: { status: 'passed' as const, errors: [], warnings: [], checkedAt: new Date().toISOString() },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  controls: [
    { key: 'speed', label: '雷达扫描速度', type: 'slider' as const, default: 1.0, min: 0.1, max: 3.0, step: 0.1, unit: 'x', group: '雷达引擎' },
    { key: 'color', label: '雷达高亮色', type: 'color' as const, default: '#10b981', group: '视觉外观' },
    { key: 'glow', label: '余辉强度', type: 'slider' as const, default: 80, min: 0, max: 100, step: 1, unit: '%', group: '视觉外观' },
    { key: 'size', label: '雷达半径', type: 'slider' as const, default: 100, min: 50, max: 150, step: 5, unit: '%', group: '雷达引擎' },
    { key: 'enabled', label: '扫描运转', type: 'toggle' as const, default: true, group: '雷达引擎' },
  ],
  controlValues: {
    speed: 1.0,
    color: '#10b981',
    glow: 80,
    size: 100,
    enabled: true,
  },
  html: `<div class="nexus-telemetry">
  <div class="nexus-top">
    <div class="broker-state"><span class="state-dot"></span><span>MQTT BROKER: ONLINE</span></div>
    <div class="cluster-tag">CLUSTER: AETHER-NODE-07 // TLS</div>
  </div>
  <div class="telemetry-mid">
    <div class="radar-box">
      <canvas id="radarCanvas" width="220" height="220"></canvas>
      <div class="radar-hud">RADAR SCAN // 360°</div>
    </div>
    <div class="metric-readouts">
      <div class="stat-tile">
        <div class="stat-l">INGRESS BANDWIDTH</div>
        <div class="stat-v" id="statBandwidth">48.6 MB/s</div>
      </div>
      <div class="stat-tile">
        <div class="stat-l">TELEMETRY LATENCY</div>
        <div class="stat-v accent" id="statLatency">4.2 ms</div>
      </div>
      <div class="stat-tile">
        <div class="stat-l">PACKET INTEGRITY</div>
        <div class="stat-v success">99.998%</div>
      </div>
    </div>
  </div>
  <div class="terminal-stream">
    <div class="stream-head">LIVE MQTT EVENT LOG STREAM</div>
    <div class="stream-body" id="streamLog"></div>
  </div>
</div>`,
  css: `:host {
  display: block;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  color: #f1f5f9;
  user-select: none;
}
.nexus-telemetry {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 18px 22px;
  background: rgba(8, 16, 31, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 26px;
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.nexus-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.broker-state {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
  letter-spacing: 0.08em;
}
.state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
}
.cluster-tag {
  font-size: 10px;
  font-family: ui-monospace, monospace;
  color: #64748b;
  letter-spacing: 0.06em;
}
.telemetry-mid {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 16px;
  margin: 12px 0;
}
.radar-box {
  position: relative;
  height: 160px;
  border-radius: 14px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.12), rgba(2, 6, 23, 0.9));
  border: 1px solid rgba(16, 185, 129, 0.2);
}
#radarCanvas {
  width: 100%;
  height: 100%;
  display: block;
}
.radar-hud {
  position: absolute;
  bottom: 8px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 9px;
  color: #10b981;
  letter-spacing: 0.1em;
  font-weight: 600;
}
.metric-readouts {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
}
.stat-tile {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}
.stat-l {
  font-size: 9px;
  color: #64748b;
  letter-spacing: 0.08em;
  font-weight: 600;
}
.stat-v {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  font-family: ui-monospace, SFMono-Regular, monospace;
  margin-top: 2px;
}
.stat-v.accent { color: #38bdf8; text-shadow: 0 0 10px rgba(56, 189, 248, 0.4); }
.stat-v.success { color: #10b981; text-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
.terminal-stream {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 8px;
}
.stream-head {
  font-size: 9px;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}
.stream-body {
  height: 48px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 9.5px;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.stream-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stream-row .time { color: #475569; margin-right: 6px; }
.stream-row .topic { color: #38bdf8; margin-right: 6px; }
.stream-row .val { color: #cbd5e1; }`,
  js: `(function() {
  var canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var angle = 0;
  var blips = [
    { r: 42, theta: 0.6, life: 1 },
    { r: 68, theta: 2.2, life: 1 },
    { r: 54, theta: 4.1, life: 1 }
  ];

  function getProps() {
    var p = (typeof window !== 'undefined' && window.aetherProps) ? window.aetherProps : {};
    return {
      speed: typeof p.speed === 'number' ? p.speed : 1.0,
      color: p.color || '#10b981',
      glow: typeof p.glow === 'number' ? p.glow : 80,
      size: typeof p.size === 'number' ? p.size : 100,
      enabled: p.enabled !== false,
    };
  }

  function renderRadar() {
    var props = getProps();
    if (props.enabled) {
      angle += 0.035 * props.speed;
    }
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2;
    var cy = h / 2;
    var radarScale = (props.size || 100) / 100;

    // 同心圆圈
    ctx.strokeStyle = props.color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1;
    [30 * radarScale, 60 * radarScale, 90 * radarScale].forEach(function(r) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // 扫描扇形
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    var sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 90 * radarScale);
    sweepGrad.addColorStop(0, props.color);
    sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    ctx.fillStyle = sweepGrad;
    ctx.globalAlpha = Math.min(1, Math.max(0.1, (props.glow / 100) * 0.4));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 90 * radarScale, 0, Math.PI * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // 绘制目标光点
    blips.forEach(function(b) {
      var bx = cx + Math.cos(b.theta) * b.r * radarScale;
      var by = cy + Math.sin(b.theta) * b.r * radarScale;
      ctx.fillStyle = props.color;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(renderRadar);
  }
  requestAnimationFrame(renderRadar);

  // 滚动终端日志
  var logBox = document.getElementById('streamLog');
  var logs = [
    { t: 'aether/robot/arm_pose', v: 'x: 142.5 y: -88.2 z: 204.1' },
    { t: 'aether/vfx/render_pipe', v: '60fps status: optimal' },
    { t: 'aether/sensor/temp_core', v: 'temp: 36.8 C power: 12.4W' },
    { t: 'aether/network/qos', v: 'latency: 4.2ms loss: 0.0%' }
  ];
  var logIndex = 0;

  setInterval(function() {
    if (!logBox) return;
    var item = logs[logIndex % logs.length];
    logIndex++;
    var row = document.createElement('div');
    row.className = 'stream-row';
    var now = new Date();
    var timeStr = now.toTimeString().split(' ')[0] + '.' + Math.floor(now.getMilliseconds() / 100);
    row.innerHTML = '<span class="time">' + timeStr + '</span><span class="topic">' + item.t + '</span><span class="val">' + item.v + '</span>';
    logBox.appendChild(row);
    if (logBox.children.length > 3) logBox.removeChild(logBox.children[0]);
  }, 1600);
})();`,
};

// =============================================================================
// 官方全景旗舰工程数据定义
// 4 大殿堂级联动章节：01 空间觉醒 -> 02 灵动掌控 -> 03 智能共生 -> 04 极境交付
// =============================================================================
export const DEFAULT_PROJECT_DATA: ProjectData = {
  meta: {
    v: 43.0,
    title: '鲸动交互平台 (AETHER) · 官方旗舰全景工程',
    author: 'AETHER Master Design Studio',
    templateId: 'official-master-flagship',
    templateRevision: 6,
    updatedAt: new Date().toISOString(),
  },
  start: 'spatial_canvas',
  canvas: { width: 1920, height: 1080 },
  is3DParallaxEnabled: true,
  parallaxIntensity: 0.8,
  hudConfig: { style: 'minimal', collapsible: true, showDots: true, showTitle: true },
  variables: [
    { id: 'engine_status', name: '引擎运行状态', value: 'OPTIMAL', type: 'text' },
    { id: 'render_fps', name: '实时渲染帧率', value: 60, type: 'number' },
    { id: 'current_chapter', name: '当前游览章节', value: 1, type: 'number' },
  ],
  components: [],
  scenes: {
    // =========================================================================
    // 01 · 空间觉醒 · 活着的数字画布 (Spatial Awakening & The Kinetic Canvas)
    // =========================================================================
    spatial_canvas: scene(
      'spatial_canvas',
      '01 · 空间觉醒 · 活着的数字画布',
      [
        // 暗夜极光粒子氛围底色
        vfx('s1_vfx', 'aurora', '#00f2fe', '#4facfe', 16, { vfxSpeed: 0.22 }),
        scrim('s1_scrim', '#03050a', 58, 1),

        // 顶部 Apple 式极简状态胶囊徽章
        card('s1_top_pill', 6.5, 3.8, 30, 4.4, {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.14)',
          borderRadius: 999,
          zIndex: 15,
        }),
        text('s1_brand_badge', 'AETHER PRO  /  旗舰空间交互创作引擎  ·  2026', 7.5, 4.8, 28, 2.5, {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.8,
          color: '#bae6fd',
          zIndex: 16,
        }),

        // 眉题 Kicker
        text('s1_kicker', 'SPATIAL INTERACTION SUITE  /  NEXT-GEN CANVAS', 6.8, 12, 44, 3, {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 2.8,
          color: '#38bdf8',
          zIndex: 10,
          animType: 'fade-in',
          animDur: 0.8,
        }),

        // 巨幅苹果设计主标题
        text('s1_hero_title', '超越平面。\n让每个像素，获得立体的生命。', 6.5, 17.5, 44, 23, {
          fontSize: 66,
          fontWeight: '700',
          lineHeight: 1.05,
          letterSpacing: -0.5,
          color: '#ffffff',
          zIndex: 10,
          is3dLayer: true,
          depthZ: 64,
          parallaxFactor: 0.28,
          animType: 'slide-up',
          animDur: 0.9,
          keyframes: keyframes([
            { property: 'y', values: [[0, 22], [1.1, 17.5]] },
            { property: 'opacity', values: [[0, 0], [0.8, 100]] },
          ]),
        }),

        // 黄金两段论副标
        text(
          's1_hero_desc',
          '不止于视听剪辑，这是一座活着的数字画布。\n多轨动力时间线、三维视差深度与物理运镜，让每一个静态像素都开始呼吸回应。',
          6.8,
          43.5,
          42,
          8.5,
          {
            fontSize: 16.5,
            lineHeight: 1.4,
            color: '#94a3b8',
            zIndex: 10,
            animType: 'fade-in',
            animDur: 1.1,
          }
        ),

        // 三联特性胶囊卡片（磨砂玻璃质感）
        card('s1_feat_1', 6.8, 55, 12.8, 13.5, {
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          borderColor: 'rgba(56, 189, 248, 0.25)',
          borderRadius: 16,
          zIndex: 5,
        }),
        text('s1_f1_num', '01', 8, 57, 10, 3, { fontSize: 13, fontWeight: '800', color: '#38bdf8', zIndex: 6 }),
        text('s1_f1_title', '三维视差景深', 8, 61, 10.5, 3, { fontSize: 13, fontWeight: '700', color: '#f1f5f9', zIndex: 6 }),
        text('s1_f1_desc', '多层独立 Depth-Z 空间悬浮', 8, 64.5, 10.5, 3, { fontSize: 10.5, color: '#94a3b8', zIndex: 6 }),

        card('s1_feat_2', 20.8, 55, 12.8, 13.5, {
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          borderColor: 'rgba(129, 140, 248, 0.25)',
          borderRadius: 16,
          zIndex: 5,
        }),
        text('s1_f2_num', '02', 22, 57, 10, 3, { fontSize: 13, fontWeight: '800', color: '#818cf8', zIndex: 6 }),
        text('s1_f2_title', '动力时间轴', 22, 61, 10.5, 3, { fontSize: 13, fontWeight: '700', color: '#f1f5f9', zIndex: 6 }),
        text('s1_f2_desc', '0.01 秒关键帧高频微控', 22, 64.5, 10.5, 3, { fontSize: 10.5, color: '#94a3b8', zIndex: 6 }),

        card('s1_feat_3', 34.8, 55, 12.8, 13.5, {
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          borderColor: 'rgba(52, 211, 153, 0.25)',
          borderRadius: 16,
          zIndex: 5,
        }),
        text('s1_f3_num', '03', 36, 57, 10, 3, { fontSize: 13, fontWeight: '800', color: '#34d399', zIndex: 6 }),
        text('s1_f3_title', '触感交互反馈', 36, 61, 10.5, 3, { fontSize: 13, fontWeight: '700', color: '#f1f5f9', zIndex: 6 }),
        text('s1_f3_desc', '点击、悬停、手势即刻响应', 36, 64.5, 10.5, 3, { fontSize: 10.5, color: '#94a3b8', zIndex: 6 }),

        // 右侧核心主视觉：搭载【AETHER 全息三维空间内核】高阶代码组件
        element('s1_spatial_plugin', 'custom-code', 51.5, 14, 42.5, 68, {
          customCode: spatialCorePlugin,
          customCodeControls: spatialCorePlugin.controls,
          customCodeProps: spatialCorePlugin.controlValues,
          zIndex: 14,
          opacity: 100,
          is3dLayer: true,
          depthZ: 46,
          parallaxFactor: 0.2,
          animType: 'perspective-in',
          animDur: 1.1,
        }),

        // 贯穿底部的 Saber 激光能量束
        saber('s1_energy_beam', 6.5, 73, 41, 10, 'M 4 50 C 60 10 160 85 240 45 S 380 15 450 50', '#38bdf8', {
          saberEffectType: 'beam',
          saberGlowSpread: 18,
          saberCoreWidth: 1.6,
          saberGrowthMode: 'cycle-flow',
          saberGrowthSpeed: 0.9,
        }),

        // 底部章节指示与主行动呼吁 CTA 按钮
        text('s1_index_label', 'CHAPTER 01 / 04 · SPATIAL AWAKENING', 6.8, 86.5, 24, 3, {
          fontSize: 11,
          color: '#64748b',
          letterSpacing: 2,
          fontWeight: '600',
          zIndex: 10,
        }),

        card('s1_cta_bg', 31, 85, 17, 5.8, {
          backgroundColor: '#0284c7',
          borderColor: '#38bdf8',
          borderRadius: 999,
          zIndex: 14,
          boxShadow: '0 12px 36px rgba(2, 132, 199, 0.45)',
        }),
        actionBtn('s1_cta_text', '探索光影动力  →', 'motion_dynamics', 31, 85.3, 17, 5.2, {
          fontSize: 13.5,
          fontWeight: '700',
          color: '#ffffff',
        }),
      ],
      bgVoidIllumination
    ),

    // =========================================================================
    // 02 · 灵动掌控 · 电影级光影与微控 (Precision Dynamics & Timeline)
    // =========================================================================
    motion_dynamics: scene(
      'motion_dynamics',
      '02 · 灵动掌控 · 电影级光影与微控',
      [
        vfx('s2_vfx', 'particles', '#f43f5e', '#8b5cf6', 15, { vfxSpeed: 0.28 }),
        scrim('s2_scrim', '#03050a', 62, 1),

        // 眉题
        text('s2_kicker', 'CHRONOS DYNAMICS LAB  /  CINEMATIC OPTICS', 6.8, 12, 44, 3, {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 2.8,
          color: '#a855f7',
          zIndex: 10,
          animType: 'fade-in',
          animDur: 0.8,
        }),

        // 标题
        text('s2_title', '光影澎湃，\n每一帧皆为艺术。', 6.5, 17.5, 45, 23, {
          fontSize: 60,
          fontWeight: '700',
          lineHeight: 1.06,
          letterSpacing: -0.5,
          color: '#ffffff',
          zIndex: 10,
          is3dLayer: true,
          depthZ: 60,
          parallaxFactor: 0.26,
          animType: 'slide-up',
          animDur: 0.9,
        }),

        text(
          's2_desc',
          '内置专业级 Saber 激光流光引擎与毫秒级弹性曲线。\n光线不再是冰冷的像素，而是具有物理重力、能量场与折射呼吸的流体。',
          6.8,
          43.5,
          42,
          8.5,
          {
            fontSize: 16.5,
            lineHeight: 1.4,
            color: '#94a3b8',
            zIndex: 10,
            animType: 'fade-in',
            animDur: 1.1,
          }
        ),

        // 核心性能参数指标卡
        card('s2_metrics_card', 6.8, 55, 41, 14, {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          borderColor: 'rgba(168, 85, 247, 0.25)',
          borderRadius: 18,
          zIndex: 4,
        }),
        text('s2_m1_val', '60 FPS', 9, 58, 11, 4, { fontSize: 24, fontWeight: '800', color: '#f8fafc', zIndex: 6 }),
        text('s2_m1_lbl', '原生流畅物理运镜', 9, 63.5, 11, 3, { fontSize: 10.5, color: '#94a3b8', zIndex: 6 }),

        text('s2_m2_val', '0.01 s', 22.5, 58, 11, 4, { fontSize: 24, fontWeight: '800', color: '#c084fc', zIndex: 6 }),
        text('s2_m2_lbl', '关键帧高频微控', 22.5, 63.5, 11, 3, { fontSize: 10.5, color: '#94a3b8', zIndex: 6 }),

        text('s2_m3_val', 'GPU 光追', 36, 58, 11, 4, { fontSize: 22, fontWeight: '800', color: '#38bdf8', zIndex: 6 }),
        text('s2_m3_lbl', '实时辉光粒子合成', 36, 63.5, 11, 3, { fontSize: 10.5, color: '#94a3b8', zIndex: 6 }),

        // 右侧核心主视觉：搭载【光子动力合成仪】高阶代码组件
        element('s2_synth_plugin', 'custom-code', 51.5, 14, 42.5, 68, {
          customCode: kineticWaveformPlugin,
          customCodeControls: kineticWaveformPlugin.controls,
          customCodeProps: kineticWaveformPlugin.controlValues,
          zIndex: 14,
          opacity: 100,
          is3dLayer: true,
          depthZ: 46,
          parallaxFactor: 0.2,
          animType: 'perspective-in',
          animDur: 1.1,
        }),

        // 贯穿底部的 Saber 激光能量环绕
        saber('s2_arc_beam', 6.5, 73, 41, 10, 'M 10 20 L 90 20 Q 95 20 95 25 L 95 85 Q 95 90 90 90 L 10 90 Q 5 90 5 85 L 5 25 Q 5 20 10 20 Z', '#a855f7', {
          saberEffectType: 'neon',
          saberGlowSpread: 22,
          saberGrowthMode: 'grow-in',
          saberGrowthSpeed: 0.8,
          zIndex: 7,
        }),

        // 底部导航
        text('s2_index_label', 'CHAPTER 02 / 04 · PRECISION DYNAMICS', 6.8, 86.5, 24, 3, {
          fontSize: 11,
          color: '#64748b',
          letterSpacing: 2,
          fontWeight: '600',
          zIndex: 10,
        }),

        card('s2_cta_bg', 31, 85, 17, 5.8, {
          backgroundColor: '#7c3aed',
          borderColor: '#a855f7',
          borderRadius: 999,
          zIndex: 14,
          boxShadow: '0 12px 36px rgba(124, 58, 237, 0.45)',
        }),
        actionBtn('s2_cta_text', '体验数据孪生  →', 'data_intelligence', 31, 85.3, 17, 5.2, {
          fontSize: 13.5,
          fontWeight: '700',
          color: '#ffffff',
        }),
      ],
      bgChronosOptics
    ),

    // =========================================================================
    // 03 · 智能共生 · 数据孪生与物联互联 (Living Data Matrix & IoT)
    // =========================================================================
    data_intelligence: scene(
      'data_intelligence',
      '03 · 智能共生 · 数据孪生与物联互联',
      [
        vfx('s3_vfx', 'abyss-grid', '#06b6d4', '#10b981', 14, { vfxSpeed: 0.24 }),
        scrim('s3_scrim', '#03050a', 65, 1),

        // 眉题
        text('s3_kicker', 'DIGITAL TWIN & LIVING DATA  /  MQTT EVENT BUS', 6.8, 12, 44, 3, {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 2.8,
          color: '#10b981',
          zIndex: 10,
          animType: 'fade-in',
          animDur: 0.8,
        }),

        // 标题
        text('s3_title', '让冷冰的数据，\n涌动成触手可及的生命脉冲。', 6.5, 17.5, 45, 23, {
          fontSize: 58,
          fontWeight: '700',
          lineHeight: 1.06,
          letterSpacing: -0.5,
          color: '#ffffff',
          zIndex: 10,
          is3dLayer: true,
          depthZ: 60,
          parallaxFactor: 0.26,
          animType: 'slide-up',
          animDur: 0.9,
        }),

        text(
          's3_desc',
          '深度集成 MQTT 物联网协议与全双工事件总线。\n工业遥测、环境感知与业务流无缝注入 3D 画布，重构未来数字孪生指挥中枢。',
          6.8,
          43.5,
          42,
          8.5,
          {
            fontSize: 16.5,
            lineHeight: 1.4,
            color: '#94a3b8',
            zIndex: 10,
            animType: 'fade-in',
            animDur: 1.1,
          }
        ),

        // 左侧 Galaxy UI 真实指标卡 1
        element('s3_ui_metric_1', 'ui-component', 6.8, 55, 19.8, 15, {
          uiComponentType: 'metric-card',
          uiComponentData: { label: '核心链路在线率', value: '99.995', unit: '%' },
          zIndex: 8,
          is3dLayer: true,
          depthZ: 38,
          parallaxFactor: 0.18,
        }),

        // 左侧 Galaxy UI 真实指标卡 2
        element('s3_ui_metric_2', 'ui-component', 28, 55, 19.8, 15, {
          uiComponentType: 'gauge',
          uiComponentData: { label: '图形渲染管线负荷', value: 38, unit: '%' },
          zIndex: 8,
          is3dLayer: true,
          depthZ: 42,
          parallaxFactor: 0.22,
        }),

        // 右侧核心主视觉：搭载【全息数字孪生中枢】高阶代码组件
        element('s3_telemetry_plugin', 'custom-code', 51.5, 14, 42.5, 68, {
          customCode: telemetryDeckPlugin,
          customCodeControls: telemetryDeckPlugin.controls,
          customCodeProps: telemetryDeckPlugin.controlValues,
          zIndex: 14,
          opacity: 100,
          is3dLayer: true,
          depthZ: 46,
          parallaxFactor: 0.2,
          animType: 'perspective-in',
          animDur: 1.1,
        }),

        // 贯穿底部的 Saber 能量流
        saber('s3_energy_line', 6.5, 73, 41, 10, 'M 4 50 L 450 50', '#10b981', {
          saberEffectType: 'beam',
          saberGlowSpread: 18,
          saberCoreWidth: 1.6,
          saberGrowthMode: 'cycle-flow',
          zIndex: 7,
        }),

        // 底部导航
        text('s3_index_label', 'CHAPTER 03 / 04 · LIVING DATA TWIN', 6.8, 86.5, 24, 3, {
          fontSize: 11,
          color: '#64748b',
          letterSpacing: 2,
          fontWeight: '600',
          zIndex: 10,
        }),

        card('s3_cta_bg', 31, 85, 17, 5.8, {
          backgroundColor: '#059669',
          borderColor: '#10b981',
          borderRadius: 999,
          zIndex: 14,
          boxShadow: '0 12px 36px rgba(5, 150, 105, 0.45)',
        }),
        actionBtn('s3_cta_text', '步入全端交付  →', 'universal_delivery', 31, 85.3, 17, 5.2, {
          fontSize: 13.5,
          fontWeight: '700',
          color: '#ffffff',
        }),
      ],
      bgCyberGrid
    ),

    // =========================================================================
    // 04 · 极境交付 · 一次构思全端呈现 (Universal Horizon & Full Deployment)
    // =========================================================================
    universal_delivery: scene(
      'universal_delivery',
      '04 · 极境交付 · 一次构思全端呈现',
      [
        vfx('s4_vfx', 'aurora', '#38bdf8', '#ec4899', 16, { vfxSpeed: 0.22 }),
        scrim('s4_scrim', '#03050a', 60, 1),

        // 眉题
        text('s4_kicker', 'UNIVERSAL HORIZON  /  CREATE ONCE, DEPLOY EVERYWHERE', 6.8, 12, 46, 3, {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 2.8,
          color: '#38bdf8',
          zIndex: 10,
          animType: 'fade-in',
          animDur: 0.8,
        }),

        // 标题
        text('s4_title', '一次构想，\n无界驰骋于每个维度。', 6.5, 17.5, 45, 23, {
          fontSize: 62,
          fontWeight: '700',
          lineHeight: 1.05,
          letterSpacing: -0.5,
          color: '#ffffff',
          zIndex: 10,
          is3dLayer: true,
          depthZ: 64,
          parallaxFactor: 0.28,
          animType: 'slide-up',
          animDur: 0.9,
        }),

        text(
          's4_desc',
          '无论是展厅触控大屏、独立免安装单文件、轻量网页交互包，还是 4K 电影级母带。\n告别二次重构的繁琐，同一套空间交互与时间节奏，你的杰作即刻完整通向现实世界的每一个终端。',
          6.8,
          43.5,
          42,
          8.5,
          {
            fontSize: 16.5,
            lineHeight: 1.4,
            color: '#94a3b8',
            zIndex: 10,
            animType: 'fade-in',
            animDur: 1.1,
          }
        ),

        // 四维极简交付卡片（Apple 磨砂玻璃方阵）
        card('s4_box_1', 52, 16, 20.5, 30, {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          borderColor: 'rgba(56, 189, 248, 0.28)',
          borderRadius: 20,
          zIndex: 5,
          is3dLayer: true,
          depthZ: 38,
          parallaxFactor: 0.18,
        }),
        text('s4_b1_badge', '01 / APP', 54, 20, 16, 3, { fontSize: 11, fontWeight: '800', color: '#38bdf8', zIndex: 6 }),
        text('s4_b1_title', '独立可执行程序', 54, 24, 16.5, 4, { fontSize: 16, fontWeight: '700', color: '#ffffff', zIndex: 6 }),
        text('s4_b1_desc', '免运行环境依赖\nWindows 原生大屏一键畅跑', 54, 30, 16.5, 6, {
          fontSize: 11.5,
          color: '#94a3b8',
          lineHeight: 1.4,
          zIndex: 6,
        }),

        card('s4_box_2', 74.5, 16, 20.5, 30, {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          borderColor: 'rgba(129, 140, 248, 0.28)',
          borderRadius: 20,
          zIndex: 5,
          is3dLayer: true,
          depthZ: 44,
          parallaxFactor: 0.22,
        }),
        text('s4_b2_badge', '02 / WEB', 76.5, 20, 16, 3, { fontSize: 11, fontWeight: '800', color: '#818cf8', zIndex: 6 }),
        text('s4_b2_title', '交互式网页工程', 76.5, 24, 16.5, 4, { fontSize: 16, fontWeight: '700', color: '#ffffff', zIndex: 6 }),
        text('s4_b2_desc', '单包离线极速分发\n全主流浏览器丝滑交互浏览', 76.5, 30, 16.5, 6, {
          fontSize: 11.5,
          color: '#94a3b8',
          lineHeight: 1.4,
          zIndex: 6,
        }),

        card('s4_box_3', 52, 49, 20.5, 30, {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          borderColor: 'rgba(52, 211, 153, 0.28)',
          borderRadius: 20,
          zIndex: 5,
          is3dLayer: true,
          depthZ: 32,
          parallaxFactor: 0.16,
        }),
        text('s4_b3_badge', '03 / VIDEO', 54, 53, 16, 3, { fontSize: 11, fontWeight: '800', color: '#34d399', zIndex: 6 }),
        text('s4_b3_title', '广播级视频资产', 54, 57, 16.5, 4, { fontSize: 16, fontWeight: '700', color: '#ffffff', zIndex: 6 }),
        text('s4_b3_desc', '4K 60FPS 逐帧渲染导出\n纯净画质无损保留动效细节', 54, 63, 16.5, 6, {
          fontSize: 11.5,
          color: '#94a3b8',
          lineHeight: 1.4,
          zIndex: 6,
        }),

        card('s4_box_4', 74.5, 49, 20.5, 30, {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          borderColor: 'rgba(251, 191, 36, 0.28)',
          borderRadius: 20,
          zIndex: 5,
          is3dLayer: true,
          depthZ: 40,
          parallaxFactor: 0.2,
        }),
        text('s4_b4_badge', '04 / AI SUITE', 76.5, 53, 16, 3, { fontSize: 11, fontWeight: '800', color: '#fbbf24', zIndex: 6 }),
        text('s4_b4_title', 'AI 场景提参赋能', 76.5, 57, 16.5, 4, { fontSize: 16, fontWeight: '700', color: '#ffffff', zIndex: 6 }),
        text('s4_b4_desc', '大模型驱动自然语言创作\n智能抠图、3D 生成与代码扩展', 76.5, 63, 16.5, 6, {
          fontSize: 11.5,
          color: '#94a3b8',
          lineHeight: 1.4,
          zIndex: 6,
        }),

        // 环绕的大型 Saber 弧光
        saber('s4_arc_light', 6.5, 68, 41, 14, 'M 4 80 C 120 10 320 10 440 80', '#38bdf8', {
          saberEffectType: 'ribbon',
          saberGlowSpread: 26,
          saberGrowthMode: 'grow-in',
          saberGrowthSpeed: 0.7,
          zIndex: 8,
        }),

        // 底部重播体验与章节提示
        text('s4_index_label', 'CHAPTER 04 / 04 · UNIVERSAL HORIZON', 6.8, 86.5, 24, 3, {
          fontSize: 11,
          color: '#64748b',
          letterSpacing: 2,
          fontWeight: '600',
          zIndex: 10,
        }),

        card('s4_cta_bg', 31, 85, 17, 5.8, {
          backgroundColor: '#0284c7',
          borderColor: '#38bdf8',
          borderRadius: 999,
          zIndex: 14,
          boxShadow: '0 12px 36px rgba(2, 132, 199, 0.45)',
        }),
        actionBtn('s4_cta_text', '重温全景漫游  ↺', 'spatial_canvas', 31, 85.3, 17, 5.2, {
          fontSize: 13.5,
          fontWeight: '700',
          color: '#ffffff',
        }),
      ],
      bgUniversalHorizon
    ),
  },
};
