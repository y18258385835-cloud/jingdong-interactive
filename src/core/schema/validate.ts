/**
 * ProjectData 校验器（zod，唯一校验实现）。
 * 铁律 3：所有外部写入（API/CLI/MCP/AI/导入）必须先过 validateProjectData / normalizeProjectData。
 */

import { z } from 'zod';
import type { Scene } from '../../types';
import { SCHEMA_VERSION } from './version';

/** Schema 允许的版本上下界（必须在使用前声明，避免 TDZ） */
const MIN_SCHEMA_VERSION = 1;
const MAX_SCHEMA_VERSION = SCHEMA_VERSION;

// —— 枚举常量（与 src/types/index.ts 保持一致，勿增删） ——

const ELEMENT_TYPES = [
  'img',
  'vid',
  'txt',
  'shape',
  'saber',
  'vfx',
  '3d_group',
  'chart',
  'panorama-img',
  'panorama-vid',
  'model-3d',
  'gaussian-splat',
  'group',
  'ui-component',
  'custom-code',
] as const;

const BLEND_MODES = ['normal', 'screen', 'multiply', 'overlay', 'lighten', 'color-dodge'] as const;

const IN_ANIMS = [
  'none', 'fade-in', 'slide-up', 'slide-down', 'slide-left', 'slide-right',
  'zoom-in', 'zoom-out', 'elastic-pop', 'flip-3d', 'glitch', 'rotate-in',
  'bounce-in', 'blur-in', 'tilt-in', 'fade-blur-in',
  // 与 src/types/index.ts 的 InAnimType 保持同步，否则官方模板自带的动效
  // （perspective-in 等）会让导出的工程无法重新导入。
  'neon-glow-in', 'scan-reveal', 'hologram-in', 'stardust-in', 'energy-pop', 'perspective-in',
] as const;

const OUT_ANIMS = [
  'none', 'fade-out', 'slide-down', 'slide-up', 'slide-left', 'slide-right',
  'zoom-out', 'zoom-in', 'fade-zoom', 'rotate-out', 'blur-out', 'bounce-out',
  'flip-out', 'dissolve-out', 'neon-out', 'particle-out', 'hologram-out', 'scan-out',
] as const;

const LOOP_ANIMS = [
  'none', 'pulse', 'float', 'spin', 'shimmer', 'breathe', 'swing', 'shake',
  'heartbeat', 'blink', 'wave',
] as const;

const SCENE_TRANSITIONS = [
  'none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'zoom-in', 'zoom-out', 'dissolve', 'flip-3d', 'cube-3d', 'glitch', 'wipe-right',
  'soft-wipe', 'radial-reveal', 'diagonal-curtain', 'blur-dissolve',
] as const;

const SCENE_TYPES = ['scene', 'interface', 'modal'] as const;

const CHART_KINDS = ['bar', 'line', 'pie', 'donut', 'counter', 'clock'] as const;

const SHAPE_KINDS = [
  'rect', 'rounded-rect', 'circle', 'ellipse', 'trapezoid', 'triangle',
  'diamond', 'hexagon', 'parallelogram', 'star', 'pill',
] as const;

const LINK_TYPES = ['jump', 'popup', 'url', 'media'] as const;
const TRIGGERS = ['click', 'hover', 'long-press', 'swipe-direction'] as const;
const INTERACTION_EFFECTS = [
  'none', 'blur', 'chromatic-ripple', 'liquid-droplet', 'glass-refraction', 'depth-of-field',
  'focus-halo', 'edge-scan', 'press-spring',
  'loop-pulse', 'loop-float', 'loop-spin', 'loop-shimmer', 'loop-breathe', 'loop-swing',
  'loop-shake', 'loop-heartbeat', 'loop-blink', 'loop-wave', 'loop-neon-pulse',
  'loop-data-flow', 'loop-hologram-flicker', 'loop-orbit-spin',
] as const;
const INTERACTION_EFFECT_TRIGGERS = ['default', 'click', 'hover'] as const;
const TEXT_STYLE_PRESETS = [
  'none', 'white-3d', 'hollow-glow', 'vhs-glitch', 'ice',
  'frosted-hologram', 'color-fluid', 'gold-neon', 'gold-solid',
] as const;
const HOTSPOT_ICONS = ['plus', 'dot', 'arrow', 'info'] as const;
const COORD_TYPES = ['spherical', 'cartesian'] as const;
const MEDIA_TYPES = ['image', 'video'] as const;
const CUSTOM_CODE_MODES = ['responsive', 'desktop', 'mobile', 'custom'] as const;

const GRADIENT_TYPES = ['linear', 'radial'] as const;
const BACKGROUND_TYPES = ['solid', 'gradient', 'glass'] as const;
const LAYER_MASK_TYPES = ['rectangle', 'ellipse', 'rounded', 'diamond', 'hexagon', 'pen'] as const;
const GROWTH_MODES = ['none', 'grow-in', 'cycle-flow', 'pulse-grow', 'meteor-shoot'] as const;
const TAPERS = ['none', 'both', 'start', 'end'] as const;
const CAP_STYLES = ['round', 'butt', 'square'] as const;
const FALLOFFS = ['sharp', 'normal', 'soft', 'dreamy'] as const;
const CLOCK_FORMATS = ['time', 'date', 'datetime'] as const;

// —— 数值范围约束（与优化文档 §1.4 字段约束表一致） ——

const pct = () => z.number().min(0).max(100);
const positive = () => z.number().min(0);
const finite = () => z.number().finite();

/** Hotspot 3D 空间定位 */
const HotspotPositionSchema = z
  .object({
    coordType: z.enum(COORD_TYPES),
    theta: z.number().finite().optional(),
    phi: z.number().finite().optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    z: z.number().finite().optional(),
  })
  .passthrough();

/** Shared interaction payload used by ordinary layers and panorama/3D hotspots. */
const InteractionSchema = z.object({
  trigger: z.enum(TRIGGERS).optional(),
  action: z.enum(['none', 'jump', 'popup', 'url', 'media', 'set-variable']).optional(),
  target: z.string().optional(),
  url: z.string().optional(),
  mediaRefId: z.string().optional(),
  mediaType: z.enum(MEDIA_TYPES).optional(),
  variableName: z.string().optional(),
  variableValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  hoverDelay: z.number().min(0).max(10).optional(),
}).passthrough();

/** Hotspot 交互热点（3D/全景画面内） */
const HotspotSchema = z
  .object({
    id: z.string().min(1).max(128),
    position: HotspotPositionSchema,
    label: z.string().optional(),
    iconType: z.enum(['preset', 'image', 'video', 'model']).optional(),
    icon: z.enum(HOTSPOT_ICONS).optional(),
    iconImageRefId: z.string().optional(),
    iconVideoRefId: z.string().optional(),
    iconModelRefId: z.string().optional(),
    iconModelElementId: z.string().optional(),
    color: z.string().optional(),
    size: z.number().min(8).max(120).optional(),
    iconWidth: z.number().min(8).max(500).optional(),
    iconHeight: z.number().min(8).max(500).optional(),
    iconShape: z.enum(['circle', 'square', 'rounded']).optional(),
    iconBorderRadius: z.number().min(0).max(100).optional(),
    iconBorder: z.string().optional(),
    iconShadow: z.string().optional(),
    iconOpacity: z.number().min(0).max(1).optional(),
    iconAutoPlay: z.boolean().optional(),
    iconLoop: z.boolean().optional(),
    iconMuted: z.boolean().optional(),
    linkType: z.enum(LINK_TYPES).optional(),
    link: z.string().optional(),
    linkUrl: z.string().optional(),
    mediaRefId: z.string().optional(),
    mediaType: z.enum(MEDIA_TYPES).optional(),
    trigger: z.enum(TRIGGERS).optional(),
    hoverDelay: z.number().min(0).max(10).optional(),
    interactionEffect: z.enum(INTERACTION_EFFECTS).optional(),
    interactionEffectTrigger: z.enum(INTERACTION_EFFECT_TRIGGERS).optional(),
    interactionEffectIntensity: z.number().min(0).max(100).optional(),
    interactionEffectDuration: z.number().min(80).max(3000).optional(),
    interactionEffectColor: z.string().optional(),
    interactionEffectRadius: z.number().min(10).max(100).optional(),
    hoverEffect: z.enum(['none', 'glow', 'sweep', 'outline', 'scale', 'float', 'brighten', 'morph-circle-pill', 'morph-size', 'morph-reverse-collapse']).optional(),
    popupDisplay: z.enum(['modal', 'popover', 'inline']).optional(),
    popupAnimationType: z.enum(['none', 'fadeIn', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'bounce', 'rotate']).optional(),
    popupExitAnimationType: z.enum(['none', 'fadeOut', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoomOut', 'zoomIn', 'bounce', 'rotate']).optional(),
    popupStayMode: z.enum(['short', 'long']).optional(),
    popupAnimationDuration: z.number().min(0).max(10000).optional(),
    popupPosition: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom']).optional(),
    popupSize: z.enum(['small', 'medium', 'large', 'custom']).optional(),
    popupX: pct().optional(),
    popupY: pct().optional(),
    popupWidth: z.number().min(10).max(100).optional(),
    popupHeight: z.number().min(10).max(100).optional(),
    popupRatio: z.enum(['free', '16:9', '4:3', '1:1', '9:16', 'custom']).optional(),
    popupRatioW: z.number().min(1).max(30).optional(),
    popupRatioH: z.number().min(1).max(30).optional(),
    popupOverlayOpacity: z.number().min(0).max(1).optional(),
    popupOverlayBlur: z.number().min(0).max(100).optional(),
    popupCloseOnOverlay: z.boolean().optional(),
    popupTheme: z.preprocess(
      (value) => typeof value === 'string' && value.startsWith('bubble-') ? value.slice('bubble-'.length) : value,
      z.enum(['default', 'immersive', 'neon', 'cyberpunk', 'glass', 'hologram', 'luxury', 'minimal', 'corporate']),
    ).optional(),
    popupBgColor: z.string().optional(),
    popupBorderColor: z.string().optional(),
    popupGlowColor: z.string().optional(),
    popupTitle: z.string().max(200).optional(),
    popupTitleColor: z.string().optional(),
    popupAccentColor: z.string().optional(),
    popupRadius: z.number().min(0).max(100).optional(),
    interaction: InteractionSchema.optional(),
    visible: z.boolean().optional(),
  })
  .passthrough();

/** Character-range hotspot for text rendered inside UI/plugin elements. */
const TextHotspotSchema = z
  .object({
    id: z.string().min(1).max(128),
    textKey: z.string().min(1).max(128),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
    label: z.string().max(200).optional(),
    interaction: InteractionSchema.optional(),
  })
  .passthrough();

/** SceneElement 校验。passthrough 保留未来/未知字段，防止字段被 strip。 */
const SceneElementSchema = z
  .object({
    id: z.string().min(1).max(128).refine((v) => !/[/\\]/.test(v), { message: 'id 禁止包含 / 或 \\' }),
    type: z.enum(ELEMENT_TYPES),
    refId: z.string().optional(),
    sourceName: z.string().optional(),
    lockAspectRatio: z.boolean().optional(),
    groupId: z.string().optional(),
    x: pct(),
    y: pct(),
    w: z.number().min(0).max(100),
    h: z.number().min(0).max(100),
    rot: finite().optional(),
    zIndex: z.number().int().min(1).max(10000),
    opacity: z.number().min(0).max(100),
    blendMode: z.enum(BLEND_MODES).optional(),
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),

    // 文本
    content: z.string().optional(),
    color: z.string().optional(),
    fontSize: z.number().min(1).max(1000).optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.string().optional(),
    fontStyle: z.enum(['normal', 'italic']).optional(),
    textDecoration: z.enum(['none', 'underline']).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    letterSpacing: z.number().optional(),
    lineHeight: z.number().min(0.1).max(10).optional(),
    textPadding: z.number().min(0).max(500).optional(),
    textOpacity: z.number().min(0).max(100).optional(),
    textStylePreset: z.enum(TEXT_STYLE_PRESETS).optional(),

    // 自定义代码插件
    customCode: z.object({
      id: z.string().min(1).max(128),
      version: z.number().int().min(1),
      name: z.string().min(1).max(40),
      description: z.string().max(200).optional(),
      html: z.string().max(100000),
      css: z.string().max(100000),
      js: z.string().max(100000),
      textOverrides: z.record(z.string(), z.string().max(10000)).optional(),
      preview: z.object({
        mode: z.enum(CUSTOM_CODE_MODES),
        width: z.number().int().min(160).max(3840).optional(),
        height: z.number().int().min(90).max(2160).optional(),
        background: z.string().max(120),
      }),
      diagnostics: z.object({
        status: z.enum(['idle', 'passed', 'warning', 'error']),
        errors: z.array(z.object({ level: z.literal('error'), source: z.enum(['html', 'css', 'js', 'sandbox', 'performance']), message: z.string(), line: z.number().int().positive().optional(), column: z.number().int().positive().optional() })),
        warnings: z.array(z.object({ level: z.literal('warning'), source: z.enum(['html', 'css', 'js', 'sandbox', 'performance']), message: z.string(), line: z.number().int().positive().optional(), column: z.number().int().positive().optional() })),
        checkedAt: z.string().optional(),
      }).optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }).optional(),

    // 视频
    vidMode: z.enum(['auto', 'click']).optional(),
    loop: z.enum(['true', 'false']).optional(),
    muted: z.boolean().optional(),
    videoControls: z.boolean().optional(),
    videoPlayerCustomized: z.boolean().optional(),
    videoPlayerStyle: z.enum(['none', 'minimal', 'classic', 'cinema']).optional(),
    playbackRate: z.number().min(0.1).max(16).optional(),

    // 时间轴
    startTime: positive(),
    duration: positive(),

    // 动画
    animType: z.enum(IN_ANIMS).optional(),
    animDur: z.number().min(0).max(60).optional(),
    exitAnimType: z.enum(OUT_ANIMS).optional(),
    exitAnimDur: z.number().min(0).max(60).optional(),
    loopAnim: z.enum(LOOP_ANIMS).optional(),
    loopAnimSpeed: z.number().min(0.1).max(5).optional(),

    // 交互
    link: z.string().optional(),
    linkType: z.enum(LINK_TYPES).optional(),
    linkUrl: z.string().optional(),
    popupOpenMode: z.enum(['simultaneous', 'sequence']).optional(),
    popupStayMode: z.enum(['short', 'long']).optional(),
    interaction: InteractionSchema.optional(),
    glow: z.enum(['true', 'false']).optional(),
    glowColor: z.string().optional(),
    trigger: z.enum(TRIGGERS).optional(),
    hoverDelay: z.number().min(0).max(10).optional(),

    // 3D 视差
    is3dLayer: z.boolean().optional(),
    depthZ: z.number().min(-100).max(100).optional(),
    parallaxFactor: z.number().min(0).max(1).optional(),

    // 样式
    borderRadius: z.number().min(0).optional(),
    borderWidth: z.number().min(0).optional(),
    borderColor: z.string().optional(),
    boxShadow: z.string().optional(),
    backdropBlur: z.number().min(0).optional(),
    interactionEffect: z.enum(INTERACTION_EFFECTS).optional(),
    interactionEffectTrigger: z.enum(INTERACTION_EFFECT_TRIGGERS).optional(),
    interactionEffectIntensity: z.number().min(0).max(100).optional(),
    interactionEffectDuration: z.number().min(80).max(3000).optional(),
    interactionEffectColor: z.string().optional(),
    interactionEffectRadius: z.number().min(10).max(100).optional(),

    // 形状
    shapeKind: z.string().optional(),
    clipPath: z.string().optional(),
    shapePath: z.string().optional(),
    interactionArea: z.boolean().optional(),
    backgroundColor: z.string().optional(),
    backgroundType: z.enum(BACKGROUND_TYPES).optional(),
    gradientType: z.enum(GRADIENT_TYPES).optional(),
    gradientStart: z.string().optional(),
    gradientEnd: z.string().optional(),
    gradientVia: z.string().optional(),
    gradientAngle: z.number().min(0).max(360).optional(),
    textColor: z.string().optional(),
    shapePadding: z.number().min(0).optional(),

    // Saber 光效
    saberPreset: z.string().optional(),
    saberEffectType: z.enum(['standard', 'wave', 'blade', 'ribbon', 'beam', 'neon']).optional(),
    saberPath: z.string().optional(),
    saberPathType: z.enum(['preset', 'freehand', 'pen']).optional(),
    saberShapeName: z.string().optional(),
    saberGlowColor: z.string().optional(),
    saberSecondaryGlowColor: z.string().optional(),
    saberCoreColor: z.string().optional(),
    saberCoreWidth: z.number().min(0.1).max(40).optional(),
    saberGlowIntensity: z.number().min(0.2).max(5).optional(),
    saberGlowSpread: z.number().min(2).max(100).optional(),
    saberStartOffset: z.number().min(0).max(100).optional(),
    saberEndOffset: z.number().min(0).max(100).optional(),
    saberGrowthMode: z.enum(GROWTH_MODES).optional(),
    saberGrowthSpeed: z.number().min(0.1).max(5).optional(),
    saberFlickerIntensity: z.number().min(0).max(100).optional(),
    saberTaper: z.enum(TAPERS).optional(),
    saberCapStyle: z.enum(CAP_STYLES).optional(),
    saberGlowFalloff: z.enum(FALLOFFS).optional(),
    saberDashed: z.boolean().optional(),
    saberDashLength: z.number().min(1).max(24).optional(),
    saberDashGap: z.number().min(1).max(24).optional(),
    saberDashOffset: z.number().min(0).max(100).optional(),
    saberBlendMode: z.enum(BLEND_MODES).optional(),
    saberNodes: z.array(z.any()).optional(),
    maskEnabled: z.boolean().optional(),
    maskType: z.enum(LAYER_MASK_TYPES).optional(),
    maskInvert: z.boolean().optional(),
    maskFeather: z.number().min(0).max(40).optional(),
    maskX: z.number().min(0).max(100).optional(),
    maskY: z.number().min(0).max(100).optional(),
    maskWidth: z.number().min(1).max(100).optional(),
    maskHeight: z.number().min(1).max(100).optional(),
    maskRadius: z.number().min(0).max(50).optional(),
    maskNodes: z.array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })).max(256).optional(),
    maskSourceElementId: z.string().max(128).optional(),

    // 科技简约动效（vfx 元素）
    vfxMotionType: z.enum(['plasma', 'nebula', 'aurora', 'hyperspace', 'particles', 'vortex', 'rings', 'halo', 'datarain', 'progress-scan', 'progress-orbit', 'progress-threads', 'progress-liquid', 'progress-slosh', 'orbs', 'charflow', 'gradientflow', 'cardscan', 'cardshine', 'spinning-earth', 'dotloader', 'iridescent', 'lightlines', 'orbital', 'neonwave', 'orb-metal', 'wallpaper-abyss', 'thinking-orbs-ribbon', 'thinking-orbs-ping', 'spinning-earth-metal', 'glow-card', 'abyss-grid', 'filament', 'character-umbra', 'card-depth-stack', 'card-fan', 'card-cylinder', 'card-sphere', 'card-spiral', 'card-wave-grid', 'morph-circle-pill', 'morph-size', 'morph-reverse-collapse']).optional(),
    vfxColorA: z.string().optional(),
    vfxColorB: z.string().optional(),
    vfxColorC: z.string().optional(),
    vfxSpeed: z.number().min(0.2).max(5).optional(),
    vfxParams: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    vfxCards: z.array(z.object({ id: z.string(), title: z.string().max(120), type: z.enum(['text', 'image', 'video', 'panorama', 'panorama-video', 'model-3d', 'gaussian-splat', 'audio', 'file']), text: z.string().max(4000).optional(), assetRef: z.string().max(256).optional(), scale: z.number().min(0.4).max(2.5).optional() })).max(48).optional(),
    vfxCardSelectedId: z.string().max(128).optional(),
    vfxCardSelectionActive: z.boolean().optional(),

    // 图表
    chartKind: z.enum(CHART_KINDS).optional(),
    chartData: z.array(z.object({ label: z.string(), value: z.number(), color: z.string().optional() })).optional(),
    chartTitle: z.string().optional(),
    chartColors: z.array(z.string()).optional(),
    chartInteractions: z.object({
      enabled: z.array(z.enum(['brush', 'crosshair', 'highlight', 'tooltip', 'legend', 'zoom', 'drilldown'])).optional(),
      duration: z.number().min(80).max(1200).optional(),
      brushOpacity: z.number().min(0.05).max(0.6).optional(),
      highlightSize: z.number().min(1).max(3).optional(),
      snap: z.boolean().optional(),
      minZoom: z.number().min(0.08).max(1).optional(),
    }).optional(),
    counterValue: z.number().optional(),
    counterPrefix: z.string().optional(),
    counterSuffix: z.string().optional(),
    clockFormat: z.enum(CLOCK_FORMATS).optional(),

    // 3D/全景/模型/高斯泼溅
    panoramaFov: z.number().min(30).max(120).optional(),
    panoramaAutoRotate: z.boolean().optional(),
    panoramaAutoRotateSpeed: z.number().min(0.1).max(5).optional(),
    modelAutoRotate: z.boolean().optional(),
    modelAutoRotateSpeed: z.number().min(0.1).max(5).optional(),
    // 0 表示按模型包围盒自动适配镜头距离。
    modelCameraDistance: z.number().min(0).optional(),
    modelViewAzimuth: z.number().min(-180).max(180).optional(),
    modelViewElevation: z.number().min(-85).max(85).optional(),
    modelScale: z.number().min(0.3).max(3).optional(),
    ai3dLayerDirection: z.enum(['up', 'down', 'left', 'right', 'front', 'back', 'radial']).optional(),
    ai3dLayerDistance: z.number().min(0).max(2).optional(),
    ai3dExplodeDirection: z.enum(['up', 'down', 'left', 'right', 'front', 'back', 'radial']).optional(),
    ai3dExplodeDistance: z.number().min(0).max(2).optional(),
    ai3dExplodeSpeed: z.number().min(0.3).max(3).optional(),
    ai3dExplodeSpin: z.number().min(0).max(1).optional(),
    ai3dCollisionDirection: z.enum(['up', 'down', 'left', 'right', 'front', 'back', 'radial']).optional(),
    ai3dCollisionDistance: z.number().min(0).max(2).optional(),
    ai3dCollisionBounce: z.number().min(0).max(1).optional(),
    ai3dCollisionSpeed: z.number().min(0.3).max(3).optional(),
    ai3dLoopEnabled: z.boolean().optional(),
    ai3dControlVariant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional(),
    ai3dPreviewControls: z.object({
      layers: z.object({ visible: z.boolean().optional(), label: z.string().max(24).optional(), variant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional() }).optional(),
      explode: z.object({ visible: z.boolean().optional(), label: z.string().max(24).optional(), variant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional() }).optional(),
      physics: z.object({ visible: z.boolean().optional(), label: z.string().max(24).optional(), variant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional() }).optional(),
    }).optional(),
    ai3dExportControls: z.object({
      layers: z.object({ visible: z.boolean().optional(), label: z.string().max(24).optional(), variant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional() }).optional(),
      explode: z.object({ visible: z.boolean().optional(), label: z.string().max(24).optional(), variant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional() }).optional(),
      physics: z.object({ visible: z.boolean().optional(), label: z.string().max(24).optional(), variant: z.enum(['glass', 'solid', 'outline', 'minimal']).optional() }).optional(),
    }).optional(),
    splatSize: z.number().min(0.5).max(5).optional(),

    // 全局变量绑定
    bindText: z.string().optional(),
    bindValue: z.string().optional(),

    // 3D/全景画面内交互热点
    hotspots: z.array(HotspotSchema).optional(),
    textHotspots: z.array(TextHotspotSchema).optional(),
  })
  .passthrough();

/** LayerGroup */
const LayerGroupSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string(),
    collapsed: z.boolean().optional(),
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),
    color: z.string().optional(),
  })
  .passthrough();

/** 体感手势绑定 */
const GestureBindingSchema = z
  .object({
    id: z.string().min(1).max(128),
    gesture: z.enum(['wave', 'open_palm', 'swipe_left', 'swipe_right', 'fist', 'point']),
    action: z.enum(['next_scene', 'prev_scene', 'goto_scene', 'goto_start', 'show_menu', 'none']),
    targetSceneId: z.string().optional(),
    sensitivity: z.number().min(0.2).max(2).optional(),
  })
  .passthrough();

/** Scene */
const SceneSchema = z
  .object({
    id: z.string().min(1).max(128).refine((v) => !/[/\\]/.test(v), { message: 'id 禁止包含 / 或 \\' }),
    alias: z.string(),
    type: z.enum(SCENE_TYPES),
    duration: z.number().min(0.01),
    cruiseDuration: z.number().min(0).optional(),
    autoAdvanceDelay: z.number().min(0).optional(),
    bgRef: z.string().optional(),
    bgColor: z.string().optional(),
    backgroundType: z.enum(['solid', 'gradient', 'transparent', 'glass']).optional(),
    gradientType: z.enum(GRADIENT_TYPES).optional(),
    gradientStart: z.string().optional(),
    gradientVia: z.string().optional(),
    gradientEnd: z.string().optional(),
    gradientAngle: z.number().min(0).max(360).optional(),
    bgmRef: z.string().optional(),
    bgmVolume: z.number().min(0).max(1).optional(),
    inPoint: z.number().min(0).optional(),
    outPoint: z.number().min(0).optional(),
    transitionIn: z.enum(SCENE_TRANSITIONS).optional(),
    transitionOut: z.enum(SCENE_TRANSITIONS).optional(),
    transitionDuration: z.number().min(0).max(10).optional(),
    transitionEasing: z.string().optional(),
    order: z.number().int().min(0).optional(),
    gestureBindings: z.array(GestureBindingSchema).optional(),
    groups: z.array(LayerGroupSchema).optional(),
    els: z.array(SceneElementSchema).min(0),
  })
  .passthrough();

/** 全局变量 */
const GlobalVariableSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  type: z.enum(['text', 'number']),
  unit: z.string().optional(),
  mqttTopic: z.string().optional(),
  mockSimulated: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
}).passthrough();

/** 组件预设 */
const ComponentPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  version: z.number().optional(),
  elements: z.array(SceneElementSchema),
  width: z.number().optional(),
  height: z.number().optional(),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    elements: z.array(SceneElementSchema),
  })).optional(),
});

const AssetEntrySchema = z.object({
  refId: z.string(),
  kind: z.enum(['image', 'video', 'audio', 'model', 'splat']),
  mime: z.string(),
  size: z.number().min(0),
  sha256: z.string().optional(),
  createdAt: z.string(),
});

const AssetManifestSchema = z.object({
  version: z.number().int().min(1),
  items: z.record(z.string(), AssetEntrySchema),
});

const BrandingSchema = z
  .object({
    license: z.enum(['free', 'pro', 'enterprise']),
    watermark: z.object({ enabled: z.boolean(), text: z.string() }).optional(),
    brand: z.object({ name: z.string().optional(), primaryColor: z.string().optional() }).optional(),
  })
  .passthrough();

const EditorSettingsSchema = z
  .object({
    lastActiveSceneId: z.string().optional(),
    viewport: z.any().optional(),
    timelineCollapsed: z.boolean().optional(),
    recentProjects: z.array(z.object({ id: z.string(), title: z.string(), updatedAt: z.string() })).optional(),
  })
  .passthrough();

const SceneCommentSchema = z.object({
  id: z.string().min(1).max(128),
  sceneId: z.string().min(1).max(128),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  text: z.string().min(1).max(4000),
  author: z.string().max(80).optional(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  resolved: z.boolean().optional(),
});

const ThemeTokensSchema = z.object({
  name: z.string().max(80).optional(),
  colors: z.object({
    background: z.string().max(80),
    surface: z.string().max(80),
    primary: z.string().max(80),
    accent: z.string().max(80),
    text: z.string().max(80),
    textSecondary: z.string().max(80),
    border: z.string().max(80),
  }),
  typography: z.object({
    fontFamily: z.string().max(200),
    baseSize: z.number().min(1).max(200),
    headingSize: z.number().min(1).max(400),
  }),
  radius: z.number().min(0).max(200),
  shadow: z.string().max(400),
});

/** ProjectData 完整 Schema */
export const ProjectDataSchema = z
  .object({
    schemaVersion: z.number().int().min(MIN_SCHEMA_VERSION).max(MAX_SCHEMA_VERSION),
    meta: z.object({ v: z.number().optional(), title: z.string().optional(), author: z.string().optional(), updatedAt: z.string().optional() }).passthrough(),
    scenes: z.record(z.string(), SceneSchema),
    start: z.string(),
    comments: z.array(SceneCommentSchema).optional(),
    theme: ThemeTokensSchema.optional(),
    is3DParallaxEnabled: z.boolean().optional(),
    parallaxIntensity: z.number().min(0).max(2.5).optional(),
    variables: z.array(GlobalVariableSchema).optional(),
    components: z.array(ComponentPresetSchema).optional(),
    assets: AssetManifestSchema.optional(),
    branding: BrandingSchema.optional(),
    settings: EditorSettingsSchema.optional(),
    motionInput: z.object({
      enabled: z.boolean().optional(),
      sensitivity: z.number().min(0.2).max(2).optional(),
      deadZone: z.number().min(0).max(0.3).optional(),
      reverse: z.boolean().optional(),
      disconnectTimeout: z.number().min(200).max(5000).optional(),
    }).optional(),
  })
  .passthrough();

// —— 校验结果 ——

export interface ValidationIssue {
  path: string; // 如 scenes.home.els[3].w
  message: string;
}

export type ValidateResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

/** 类型守卫：ValidateResult 是否为成功分支 */
export function isValidateOk(v: ValidateResult): v is Extract<ValidateResult, { ok: true }> {
  return v.ok === true;
}

/** 把 zod issue path 数组转为点路径字符串 */
function issuePath(path: readonly (string | number | symbol)[]): string {
  return path
    .map((p) => (typeof p === 'symbol' ? String(p) : p))
    .join('.')
    .replace(/\.\[/g, '[');
}

/** 校验（不修复，只报告）。空 scenes → E_VALIDATION。 */
export function validateProjectData(data: unknown): ValidateResult {
  // B1：空工程（无 scenes）显式报错（在 zod safeParse 之前独立检查，避免提前 return 绕过）
  if (typeof data === 'object' && data !== null && 'scenes' in data) {
    const scenes = (data as { scenes?: Record<string, unknown> }).scenes;
    if (scenes && typeof scenes === 'object' && Object.keys(scenes).length === 0) {
      return { ok: false, issues: [{ path: 'scenes', message: '工程不能为空（至少需要一个场景）' }] };
    }
  }
  const parsed = ProjectDataSchema.safeParse(data);
  if (parsed.success) {
    return { ok: true };
  }
  return { ok: false, issues: parsed.error.issues.map((i) => ({ path: issuePath(i.path), message: i.message })) };
}

/** 便捷导出：供 UI 层判断是否合法 */
export function isValidProjectData(data: unknown): data is ProjectDataLike {
  return validateProjectData(data).ok;
}

export type ProjectDataLike = {
  schemaVersion: number;
  scenes: Record<string, Scene>;
  start: string;
  [k: string]: unknown;
};
