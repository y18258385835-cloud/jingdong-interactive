export type ElementType = 'img' | 'vid' | 'txt' | 'shape' | 'saber' | 'vfx' | '3d_group' | 'chart' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat' | 'group' | 'ui-component' | 'custom-code';

export type CustomCodeExportCategory = 'shapes' | 'effects' | 'ai' | `custom-${string}`;
export type CustomCodeExportSlot =
  | 'shape-library'
  | 'dashboard'
  | 'galaxy-ui'
  | 'interaction-controls'
  | 'vfx-library'
  | 'card-layout'
  | 'ai-scene'
  | 'ai-3d'
  | 'ai-cutout'
  | 'custom-code'
  | `custom-${string}`;

export type CustomCodeCategoryIcon = 'layers' | 'chart' | 'sparkles' | 'palette' | 'database' | 'cube' | 'radar' | 'folder';

export interface CustomCodeCategory {
  id: `custom-${string}`;
  label: string;
  icon: CustomCodeCategoryIcon;
  slot: `custom-${string}`;
  createdAt: string;
}

export interface CustomCodeExportTarget {
  category: CustomCodeExportCategory;
  slot: CustomCodeExportSlot;
}

export interface CustomCodeDiagnostic {
  level: 'error' | 'warning';
  source: 'html' | 'css' | 'js' | 'sandbox' | 'performance';
  message: string;
  line?: number;
  column?: number;
  stack?: string;
}

export type CustomCodeControlType = 'slider' | 'number' | 'color' | 'toggle' | 'select' | 'text';

export interface CustomCodeControlOption {
  label: string;
  value: string | number;
}

export interface CustomCodeControl {
  key: string;
  label: string;
  type: CustomCodeControlType;
  default: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: CustomCodeControlOption[];
  group?: string;
}

export interface CustomCodePlugin {
  id: string;
  version: number;
  name: string;
  description?: string;
  html: string;
  css: string;
  js: string;
  /** Per-instance editable text values. Kept apart from authored HTML so a
   * runtime chart rebuild cannot replace user edits with its default data. */
  textOverrides?: Record<string, string>;
  /** Configurable controls exposed to the Inspector Panel. */
  controls?: CustomCodeControl[];
  /** Control values instantiated for this plugin. */
  controlValues?: Record<string, any>;
  preview: {
    mode: 'responsive' | 'desktop' | 'mobile' | 'custom';
    width?: number;
    height?: number;
    background: 'scene' | 'transparent' | string;
  };
  diagnostics?: {
    status: 'idle' | 'passed' | 'warning' | 'error';
    errors: CustomCodeDiagnostic[];
    warnings: CustomCodeDiagnostic[];
    checkedAt?: string;
  };
  exportTarget?: CustomCodeExportTarget;
  createdAt: string;
  updatedAt: string;
}

export interface CustomCodeLibraryItem {
  id: string;
  plugin: CustomCodePlugin;
  target: CustomCodeExportTarget;
  createdAt: string;
  updatedAt: string;
}

export type Ai3DControlKind = 'layers' | 'explode' | 'physics';
export type Ai3DControlVariant = 'glass' | 'solid' | 'outline' | 'minimal';
export interface Ai3DControlButtonConfig {
  visible?: boolean;
  label?: string;
  variant?: Ai3DControlVariant;
}
export type Ai3DControlConfig = Partial<Record<Ai3DControlKind, Ai3DControlButtonConfig>>;

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'lighten' | 'color-dodge';

/** Card-layout content references existing local-library assets instead of embedding large files in project JSON. */
export type VfxCardContentType = 'text' | 'image' | 'video' | 'panorama' | 'panorama-video' | 'model-3d' | 'gaussian-splat' | 'audio' | 'file';
export interface VfxCardItem {
  id: string;
  title: string;
  type: VfxCardContentType;
  text?: string;
  assetRef?: string;
  /** Per-card display scale within a fixed card layout. */
  scale?: number;
}

export type InAnimType = 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'elastic-pop' | 'flip-3d' | 'glitch' | 'rotate-in' | 'bounce-in' | 'blur-in' | 'tilt-in' | 'fade-blur-in' | 'neon-glow-in' | 'scan-reveal' | 'hologram-in' | 'stardust-in' | 'energy-pop' | 'perspective-in';

export type OutAnimType = 'none' | 'fade-out' | 'slide-down' | 'slide-up' | 'slide-left' | 'slide-right' | 'zoom-out' | 'zoom-in' | 'fade-zoom' | 'rotate-out' | 'blur-out' | 'bounce-out' | 'flip-out' | 'dissolve-out' | 'neon-out' | 'particle-out' | 'hologram-out' | 'scan-out';

export type LoopAnimType = 'none' | 'pulse' | 'float' | 'spin' | 'shimmer' | 'breathe' | 'swing' | 'shake' | 'heartbeat' | 'blink' | 'wave' | 'neon-pulse' | 'data-flow' | 'hologram-flicker' | 'orbit-spin';

export type HoverEffect = 'none' | 'glow' | 'sweep' | 'outline' | 'scale' | 'float' | 'brighten'
  | 'morph-circle-pill' | 'morph-size' | 'morph-reverse-collapse';

/** 图层级交互反馈特效；与跳转/弹窗等 interaction action 相互独立。 */
export type InteractionEffect = 'none' | 'blur' | 'chromatic-ripple' | 'liquid-droplet' | 'glass-refraction' | 'depth-of-field'
  | 'focus-halo' | 'edge-scan' | 'press-spring'
  | 'loop-pulse' | 'loop-float' | 'loop-spin' | 'loop-shimmer' | 'loop-breathe' | 'loop-swing'
  | 'loop-shake' | 'loop-heartbeat' | 'loop-blink' | 'loop-wave' | 'loop-neon-pulse'
  | 'loop-data-flow' | 'loop-hologram-flicker' | 'loop-orbit-spin';
export type InteractionEffectTrigger = 'default' | 'click' | 'hover';
export type InteractionTrigger = 'click' | 'hover' | 'long-press' | 'swipe-direction';

export type InteractionConditionOperator = 'equals' | 'not-equals' | 'greater' | 'less' | 'truthy' | 'falsy';

export interface InteractionCondition {
  variableName?: string;
  operator: InteractionConditionOperator;
  value?: string | number | boolean;
}

export type InteractionStepType =
  | 'jump'
  | 'popup'
  | 'url'
  | 'set-variable'
  | 'switch-variant'
  | 'wait';

/** One step in an advanced interaction sequence. */
export interface InteractionStep {
  id: string;
  type: InteractionStepType;
  /** Seconds to wait before running this step. */
  delay?: number;
  /** Optional condition; the step is skipped when it evaluates false. */
  condition?: InteractionCondition;
  target?: string;
  url?: string;
  variableName?: string;
  variableValue?: string | number | boolean;
  /** Component instance group id. */
  componentId?: string;
  /** Master variant id. */
  variantId?: string;
}

export type TextStylePresetId =
  | 'none'
  | 'white-3d'
  | 'hollow-glow'
  | 'vhs-glitch'
  | 'ice'
  | 'frosted-hologram'
  | 'color-fluid'
  | 'gold-neon'
  | 'gold-solid';

/** A hotspot attached to a character range inside a rendered text layer. */
export interface TextHotspot {
  id: string;
  textKey: string;
  start: number;
  end: number;
  label?: string;
  interaction?: {
    trigger?: InteractionTrigger;
    action?: 'none' | 'jump' | 'popup' | 'url' | 'media' | 'set-variable';
    target?: string;
    url?: string;
    mediaRefId?: string;
    mediaType?: 'image' | 'video';
    variableName?: string;
    variableValue?: string | number | boolean;
    hoverDelay?: number;
    steps?: InteractionStep[];
  };
}

/**
 * A reusable progress-based interaction contract. UI components only need to
 * report a normalized 0-100 value; the runtime owns node crossing semantics.
 */
export type ContinuousInteractionMode = 'confirm' | 'staged' | 'explore';
export type ContinuousInteractionAxis = 'horizontal' | 'vertical' | 'path';
export type ContinuousInteractionResetPolicy = 'retain' | 'reset-on-close' | 'reset-on-replay';
export type ContinuousInteractionPopupPolicy = 'lock' | 'continue';
export type ContinuousInteractionRetrigger = 'once' | 'on-reenter' | 'every-crossing';
export type ContinuousInteractionNodeRole = 'start' | 'checkpoint' | 'end';

export interface ContinuousInteractionAction {
  action?: 'none' | 'jump' | 'popup' | 'url' | 'media' | 'set-variable';
  target?: string;
  url?: string;
  mediaRefId?: string;
  mediaType?: 'image' | 'video';
  variableName?: string;
  variableValue?: string | number | boolean;
}

export interface ContinuousInteractionNode {
  id: string;
  position: number;
  role: ContinuousInteractionNodeRole;
  label?: string;
  interaction?: ContinuousInteractionAction;
  /** Node-local popup presentation. The action target remains the source of truth. */
  popup?: Omit<Partial<PopupConfig>, 'id' | 'target' | 'enabled'>;
  retrigger?: ContinuousInteractionRetrigger;
}

export interface ContinuousInteractionConfig {
  enabled?: boolean;
  mode?: ContinuousInteractionMode;
  axis?: ContinuousInteractionAxis;
  resetPolicy?: ContinuousInteractionResetPolicy;
  popupPolicy?: ContinuousInteractionPopupPolicy;
  label?: string;
  /** The popup node currently being edited on the canvas. */
  activeNodeId?: string;
  nodes?: ContinuousInteractionNode[];
}

/** A single scene popup owned by one interactive element. Kept separate from the
 * trigger so one click target can open several independently positioned scenes. */
export interface PopupConfig {
  id: string;
  target?: string;
  color?: string;
  enabled?: boolean;
  popupAnimationType?: 'none' | 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'zoomOut' | 'bounce' | 'rotate';
  popupExitAnimationType?: 'none' | 'fadeOut' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomOut' | 'zoomIn' | 'bounce' | 'rotate';
  /** Short popups can be dismissed; long popups stay visible until the main scene changes. */
  popupStayMode?: 'short' | 'long';
  popupAnimationDuration?: number;
  popupPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  popupSize?: 'small' | 'medium' | 'large' | 'custom';
  popupX?: number;
  popupY?: number;
  popupWidth?: number;
  popupHeight?: number;
  popupRatio?: 'free' | '16:9' | '4:3' | '1:1' | '9:16' | 'custom';
  popupRatioW?: number;
  popupRatioH?: number;
  popupOverlayOpacity?: number;
  popupOverlayBlur?: number;
  popupCloseOnOverlay?: boolean;
  popupDisplay?: 'modal' | 'popover' | 'inline';
  popupTheme?: 'default' | 'immersive' | 'neon' | 'cyberpunk' | 'glass' | 'hologram' | 'luxury' | 'minimal' | 'corporate';
  popupBgColor?: string;
  popupBorderColor?: string;
  popupGlowColor?: string;
  popupTitle?: string;
  popupTitleColor?: string;
  popupAccentColor?: string;
  popupRadius?: number;
}

export interface LayerGroup {
  id: string;
  name: string;
  collapsed?: boolean;
  locked?: boolean;
  visible?: boolean;
  color?: string; // e.g., 'sky' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo'
}

/**
 * 3D/全景画面内的交互热点（Hotspot）。
 * 锚定在 3D 空间坐标上，叠加在 WebGL 画面之上渲染，支持点击/悬停触发转场或媒体弹窗。
 * "+号跟踪点" = icon:'plus' + linkType:'media' + mediaRefId 关联图片/视频。
 * 仅对 panorama-img / panorama-vid / model-3d / gaussian-splat 元素有意义。
 */
export interface Hotspot {
  id: string;
  // 3D 空间定位：全景图用球面坐标，3D模型/高斯泼溅用笛卡尔世界坐标
  position: {
    coordType: 'spherical' | 'cartesian';
    theta?: number;  // spherical: 水平角（弧度）
    phi?: number;    // spherical: 垂直角（弧度）
    x?: number; y?: number; z?: number;  // cartesian: 世界坐标
  };
  // 视觉样式
  label?: string;
  /** 图标类型：preset=预设图标，image=自定义图片，video=自定义视频 */
  iconType?: 'preset' | 'image' | 'video' | 'model';
  /** 3D 图标资源：上传的 GLB/GLTF 或工程内可复用的模型元素。 */
  iconModelRefId?: string;
  iconModelElementId?: string;
  icon?: 'plus' | 'dot' | 'arrow' | 'info';  // preset 类型的预设图标
  iconImageRefId?: string;   // image 类型的图片素材 refId
  iconVideoRefId?: string;   // video 类型的视频素材 refId
  color?: string;
  size?: number;    // px（预设图标的基础尺寸）
  // 自定义图标尺寸（image/video 类型，覆盖 size）
  iconWidth?: number;
  iconHeight?: number;
  // 自定义图标样式
  iconShape?: 'circle' | 'square' | 'rounded';  // 图标形状
  iconBorderRadius?: number;  // 圆角半径（px，rounded 形状时有效）
  iconBorder?: string;        // 边框 CSS（如 "2px solid #fff"）
  iconShadow?: string;        // 阴影 CSS
  iconOpacity?: number;       // 透明度 0-1
  iconAutoPlay?: boolean;     // 视频图标是否自动播放
  iconLoop?: boolean;         // 视频图标是否循环播放
  iconMuted?: boolean;        // 视频图标是否静音
  // 交互行为（复用元素级 link 体系，扩展 'media' 类型）
  linkType?: 'jump' | 'popup' | 'url' | 'media';
  link?: string;         // 目标场景 id（jump / popup）
  linkUrl?: string;      // 外部 URL（url 类型）
  mediaRefId?: string;   // 关联媒体素材 refId（media 类型：图片/视频）
  mediaType?: 'image' | 'video';
  trigger?: InteractionTrigger;
  hoverDelay?: number;
  /** 与普通图层一致的悬停反馈与弹窗呈现设置 */
  hoverEffect?: HoverEffect;
  popupAnimationType?: 'none' | 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'zoomOut' | 'bounce' | 'rotate';
  popupExitAnimationType?: 'none' | 'fadeOut' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomOut' | 'zoomIn' | 'bounce' | 'rotate';
  popupStayMode?: 'short' | 'long';
  popupAnimationDuration?: number;
  popupDisplay?: 'modal' | 'popover' | 'inline';
  popupRatio?: 'free' | '16:9' | '4:3' | '1:1' | '9:16' | 'custom';
  popupRatioW?: number;
  popupRatioH?: number;
  popupOverlayBlur?: number;
  popupTheme?: 'default' | 'immersive' | 'neon' | 'cyberpunk' | 'glass' | 'hologram' | 'luxury' | 'minimal' | 'corporate';
  popupBgColor?: string;
  popupBorderColor?: string;
  popupGlowColor?: string;
  /** 弹窗标题；为空时不渲染标题栏或场景标题。 */
  popupTitle?: string;
  popupTitleColor?: string;
  popupRadius?: number;
  popupAccentColor?: string;
  visible?: boolean;
  // 【新增】交互呈现动画效果
  animationType?: 'none' | 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'zoomOut' | 'bounce' | 'rotate';
  animationDuration?: number;  // 动画时长（毫秒，默认300）
  animationEasing?: string;    // 动画缓动函数（如 'ease-out', 'cubic-bezier(...)'）
  // 【新增】弹窗/媒体呈现位置与大小控制
  popupPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  popupSize?: 'small' | 'medium' | 'large' | 'custom';
  popupX?: number;    // 自定义位置X（百分比 0-100，popupPosition='custom'时有效）
  popupY?: number;    // 自定义位置Y（百分比 0-100）
  popupWidth?: number;  // 自定义宽度（百分比 0-100，popupSize='custom'时有效）
  popupHeight?: number; // 自定义高度（百分比 0-100）
  popupOverlayOpacity?: number; // 背景遮罩透明度（0-1，默认0.7）
  popupCloseOnOverlay?: boolean; // 点击遮罩是否关闭（默认true）
  /** 与图片/按钮图层共用的交互响应配置；旧 linkType/link 字段仍保持兼容。 */
  interaction?: {
    trigger?: InteractionTrigger;
    action?: 'none' | 'jump' | 'popup' | 'url' | 'media' | 'set-variable';
    target?: string;
    url?: string;
    mediaRefId?: string;
    mediaType?: 'image' | 'video';
    variableName?: string;
    variableValue?: string | number | boolean;
    hoverDelay?: number;
    steps?: InteractionStep[];
  };
  variableName?: string;
  variableValue?: string | number | boolean;
}

export type ChartInteractionId = 'brush' | 'crosshair' | 'highlight' | 'tooltip' | 'legend' | 'zoom' | 'drilldown';

export interface ChartInteractionOptions {
  enabled?: ChartInteractionId[];
  duration?: number;
  brushOpacity?: number;
  highlightSize?: number;
  snap?: boolean;
  minZoom?: number;
}

export interface SceneElement {
  id: string;
  type: ElementType;
  refId: string;          // Asset DB key or relative path or data URL
  sourceName?: string;
  /** 原始媒体宽高比（width / height），用于保持画布边界与真实素材一致。 */
  mediaAspect?: number;
  /** 鼠标角点缩放时是否保持宽高比；缺失时按开启处理以兼容旧工程。 */
  lockAspectRatio?: boolean;
  groupId?: string;       // Folder group container ID
  x: number;              // percentage (0-100)
  y: number;              // percentage (0-100)
  w: number;              // percentage (0-100)
  h: number;              // percentage (0-100)
  rot?: number;           // degrees
  zIndex: number;
  opacity: number;        // 0-100
  /** Unified property animation tracks. Times are absolute scene seconds. */
  keyframes?: import('../core/animation/keyframes').ElementAnimation;
  blendMode?: BlendMode;
  locked?: boolean;
  visible?: boolean;

  // Text specific
  content?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textWrap?: 'wrap' | 'nowrap';
  autoFitText?: boolean;
  scaleFontSizeOnResize?: boolean;
  letterSpacing?: number;
  /** Unitless CSS line-height. Kept separate from element opacity so card backgrounds remain unaffected. */
  lineHeight?: number;
  /** Text-only inset for plain text layers. Card text continues to use shapePadding. */
  textPadding?: number;
  textOpacity?: number;
  textGlowEnabled?: boolean;
  textGlowColor?: string;
  textGlowIntensity?: number;
  textGlowBlur?: number;
  textShadowEnabled?: boolean;
  textShadowColor?: string;
  textShadowOpacity?: number;
  textShadowBlur?: number;
  textShadowDistance?: number;
  textShadowAngle?: number;
  textStylePreset?: TextStylePresetId;

  // UI Component specific (Galaxy UI 组件)
  uiComponentType?: string;   // Galaxy 组件类型
  uiComponentData?: any;      // 组件配置数据
  /** 受控 iframe 中运行的用户自定义 HTML/CSS/原生 JS 插件。 */
  customCode?: CustomCodePlugin;
  /** 自定义代码插件当前的属性值映射。 */
  customCodeProps?: Record<string, any>;
  /** 显式声明的自定义控制项定义。 */
  customCodeControls?: CustomCodeControl[];
  /** Internal one-time marker after fitting a ratio-less custom-code layer to its visible bounds. */
  customCodeAutoFitted?: boolean;
  /** Visible-bounds fitting algorithm version. 2 measures painted content instead of the iframe viewport. */
  customCodeFitVersion?: number;
  /** When this group is an instance of a reusable component master. */
  componentInstance?: ComponentInstanceMeta;
  /** On a child of a component instance: the stable source element id in the master. */
  componentSourceId?: string;

  // Video specific
  vidMode?: 'auto' | 'click';
  loop?: 'true' | 'false';
  muted?: boolean;
  /** Show native video controls, including play/pause, seek and volume. */
  videoControls?: boolean;
  /** Set when the user explicitly changes the player appearance or controls. */
  videoPlayerCustomized?: boolean;
  /** Visual treatment for the native video player surface. */
  videoPlayerStyle?: 'none' | 'minimal' | 'classic' | 'cinema';
  playbackRate?: number;
  /** Number of complete dynamic playback cycles before the layer holds its last frame. */
  playbackCount?: number;
  /** Overrides playbackCount and keeps a dynamic layer cycling for its timeline duration. */
  playbackInfinite?: boolean;

  // Timeline
  startTime: number;      // in seconds
  duration: number;       // in seconds

  // Animations
  animType?: InAnimType;
  animDur?: number;
  exitAnimType?: OutAnimType;
  exitAnimDur?: number;
  loopAnim?: LoopAnimType;
  loopAnimSpeed?: number;

  // Interactions
  link?: string;          // target scene id
  linkType?: 'jump' | 'popup' | 'url';
  linkUrl?: string;
  /** 1-5 popup instances. Older projects use the legacy popup fields as popup 1. */
  popups?: PopupConfig[];
  /** Whether configured popups enter together or one after another. */
  popupOpenMode?: 'simultaneous' | 'sequence';
  /** Editor-only selection used to keep the canvas frame and inspector in sync. */
  popupActiveId?: string;
  /** 与全景热点统一的交互响应配置。 */
  interaction?: {
    trigger?: InteractionTrigger;
    action?: 'none' | 'jump' | 'popup' | 'url' | 'media' | 'set-variable';
    target?: string;
    url?: string;
    mediaRefId?: string;
    mediaType?: 'image' | 'video';
    variableName?: string;
    variableValue?: string | number | boolean;
    hoverDelay?: number;
    steps?: InteractionStep[];
  };
  variableName?: string;
  variableValue?: string | number | boolean;
  glow?: 'true' | 'false';
  glowColor?: string;
  trigger?: InteractionTrigger;  // 交互触发方式：点击（默认）/ 悬停及扩展手势
  hoverDelay?: number;          // 悬停触发延迟（秒，防误触，默认 0.3）

  // 【新增】元素悬停反馈特效（编辑与预览均生效，剪映式交互反馈）
  hoverEffect?: HoverEffect;
  hoverColor?: string;      // 特效颜色（默认 #38bdf8）
  hoverIntensity?: number;  // 特效强度 0-100（默认 50）
  /** 图层交互反馈特效（不改变原有点击路由）。 */
  interactionEffect?: InteractionEffect;
  interactionEffectTrigger?: InteractionEffectTrigger;
  interactionEffectIntensity?: number; // 0-100，默认 50
  interactionEffectDuration?: number; // 毫秒，默认 650
  interactionEffectColor?: string; // 色差波纹/水珠/玻璃色调，默认 #38bdf8
  interactionEffectRadius?: number; // 效果覆盖范围 10-100，默认 70
  // 【新增】弹窗呈现动画与位置大小控制（linkType='popup' 时有效）
  popupAnimationType?: 'none' | 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'zoomOut' | 'bounce' | 'rotate';
  popupExitAnimationType?: 'none' | 'fadeOut' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomOut' | 'zoomIn' | 'bounce' | 'rotate';
  popupStayMode?: 'short' | 'long';
  popupAnimationDuration?: number;  // 动画时长（毫秒，默认300）
  popupPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  popupSize?: 'small' | 'medium' | 'large' | 'custom';
  popupX?: number;    // 自定义位置X（百分比 0-100）
  popupY?: number;    // 自定义位置Y（百分比 0-100）
  popupWidth?: number;  // 自定义宽度（百分比 0-100）
  popupHeight?: number; // 自定义高度（百分比 0-100）
  // 【新增】弹窗宽高比（aspect ratio）：真正控制弹窗形状比例。
  // '16:9'/'4:3'/'1:1'/'9:16' 为预设比例；'custom' 使用 popupRatioW:popupRatioH；
  // 不设置时默认 '16:9'（与 1920x1080 场景一致，内容铺满）。
  popupRatio?: 'free' | '16:9' | '4:3' | '1:1' | '9:16' | 'custom';
  popupRatioW?: number;  // 自定义比例宽（如 3:2 时 = 3）

  // 【新增】嵌套容器（合并图层）：type='group' 时，把多个图层合并为单个图层。
  // children 存子图层，坐标为「相对容器左上角的百分比」（0-100）；
  // 解组（拆开）时按容器当前几何换算回舞台绝对坐标。
  children?: SceneElement[];
  // 编组时的容器基准尺寸（舞台百分比），用于子元素文字等像素值随容器缩放保持等比
  mergeBaseW?: number;
  mergeBaseH?: number;
  popupRatioH?: number;  // 自定义比例高（如 3:2 时 = 2）
  popupOverlayOpacity?: number; // 背景遮罩透明度（0-1，默认0.7）
  popupCloseOnOverlay?: boolean; // 点击遮罩是否关闭（默认true）
  // 【新增】弹窗主题与外观自定义（linkType='popup' 时有效）
  popupTheme?: 'default' | 'immersive' | 'neon' | 'cyberpunk' | 'glass' | 'hologram' | 'luxury' | 'minimal' | 'corporate';
  // 【新增】弹窗呈现方式：弹窗（modal，默认）/ 浮层卡片（popover）/ 原地展开（inline）
  popupDisplay?: 'modal' | 'popover' | 'inline';
  popupBgColor?: string;      // 自定义背景色（可带透明度，如 rgba()）
  popupBorderColor?: string;  // 自定义边框颜色
  popupGlowColor?: string;    // 自定义外发光颜色
  popupTitleColor?: string;   // 自定义标题文字颜色
  popupRadius?: number;       // 自定义圆角（px，默认 16）
  popupOverlayBlur?: number;  // 遮罩背景模糊强度（px，默认 24）
  popupAccentColor?: string;  // 强调色（标题装饰线 / 主题点缀）

  // 【新增】元素级场景切换进出场动画覆盖（linkType='jump' 直接切换场景触发时生效，
  // 覆盖当前场景「出场转场」与目标场景「入场转场」的场景级设置；不设置则跟随场景）
  linkEnterAnim?: SceneTransitionType;  // 入场动画：跳转目标场景时的进场转场
  linkExitAnim?: SceneTransitionType;   // 出场动画：离开当前场景时的退场转场
  linkAnimDuration?: number;            // 进出场动画时长（秒，默认跟随场景 transitionDuration）

  // 3D Parallax settings
  is3dLayer?: boolean;
  depthZ?: number;        // -100 to 100
  parallaxFactor?: number;
  /** 3D 景深是否显示动态投影阴影（默认 false；仅在预览/演示模式生效，编辑模式恒不显示） */
  enable3DShadow?: boolean;

  // Styling & effects
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  boxShadow?: string;
  backdropBlur?: number;

  // Shape / Card & Gradient Customization
  shapeKind?: 'rect' | 'rounded-rect' | 'circle' | 'ellipse' | 'trapezoid' | 'triangle' | 'diamond' | 'hexagon' | 'parallelogram' | 'star' | 'pill' | 'custom-path' | string;
  clipPath?: string;
  /** Normalized SVG path (0..100 viewBox) for a user-drawn filled shape. */
  shapePath?: string;
  /** A transparent polygon layer used only as an interaction hit target. */
  interactionArea?: boolean;
  backgroundColor?: string;
  backgroundType?: 'solid' | 'gradient' | 'glass';
  gradientType?: 'linear' | 'radial';
  gradientStart?: string;
  gradientEnd?: string;
  gradientVia?: string;
  gradientAngle?: number;      // 0 - 360 degrees
  textColor?: string;
  shapePadding?: number;

  // Saber / Laser Light Beam Customization (AE Saber effect)
  saberPreset?: 'neon' | 'laser' | 'cyberpunk' | 'plasma' | 'solar' | 'ghost' | 'toxic' | 'arc' | 'golden' | 'rainbow' | 'ice' | string;
  saberEffectType?: 'standard' | 'wave' | 'blade' | 'ribbon' | 'beam' | 'neon';
  saberPath?: string;             // SVG path 'd' string (normalized 0-100 or coordinate space)
  saberPathType?: 'preset' | 'freehand' | 'pen';
  saberShapeName?: string;        // Preset name e.g. "矩形框架", "正圆光环", "3D圆柱线框"
  saberGlowColor?: string;        // Primary glow aura color (e.g. #00f0ff, #ff0055)
  saberSecondaryGlowColor?: string; // Secondary ambient aura glow color
  saberCoreColor?: string;        // Inner intense beam core color (e.g. #ffffff)
  saberCoreWidth?: number;        // Core stroke thickness in px (0.1 - 40px)
  saberGlowIntensity?: number;    // Glow brightness multiplier (0.2 - 5.0)
  saberGlowSpread?: number;       // Glow blur radius in px (2 - 100px)
  saberStartOffset?: number;      // 0 - 100% (Trim Start / Growth Start)
  saberEndOffset?: number;        // 0 - 100% (Trim End / Growth End)
  saberGrowthMode?: 'none' | 'grow-in' | 'cycle-flow' | 'pulse-grow' | 'meteor-shoot';
  saberGrowthSpeed?: number;      // Speed multiplier (0.1 - 5.0)
  saberFlickerIntensity?: number; // 0 - 100% (Energy jitter/flicker)
  saberTaper?: 'none' | 'both' | 'start' | 'end'; // Head/tail taper softening
  saberCapStyle?: 'round' | 'butt' | 'square';    // Stroke line cap
  saberGlowFalloff?: 'sharp' | 'normal' | 'soft' | 'dreamy'; // Optical decay gamma
  saberDashed?: boolean;             // Render the beam as a visible illuminated dashed line
  saberDashLength?: number;          // Dash length in normalized path units (1 - 24)
  saberDashGap?: number;             // Gap length in normalized path units (1 - 24)
  saberDashOffset?: number;          // Dash phase offset (0 - 100)
  saberBlendMode?: BlendMode;     // 'screen' | 'normal' | 'lighten' | 'color-dodge'
  saberNodes?: Array<{ x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }>;

  // Layer mask shared by every timeline layer.
  maskEnabled?: boolean;
  maskType?: 'rectangle' | 'ellipse' | 'rounded' | 'diamond' | 'hexagon' | 'pen';
  maskInvert?: boolean;
  maskFeather?: number;
  maskX?: number;
  maskY?: number;
  maskWidth?: number;
  maskHeight?: number;
  maskRadius?: number;
  maskNodes?: Array<{ x: number; y: number }>;
  maskSourceElementId?: string;

  // 科技简约动效（vfx 元素，借鉴 MetalForge 像素着色器动效）
  vfxMotionType?: 'plasma' | 'nebula' | 'aurora' | 'hyperspace' | 'particles' | 'vortex' | 'rings' | 'halo' | 'datarain' | 'progress-scan' | 'progress-orbit' | 'progress-threads' | 'progress-liquid' | 'progress-slosh' | 'orbs' | 'charflow' | 'gradientflow' | 'cardscan' | 'cardshine' | 'spinning-earth' | 'dotloader' | 'iridescent' | 'lightlines' | 'orbital' | 'neonwave' | 'orb-metal' | 'wallpaper-abyss' | 'thinking-orbs-ribbon' | 'thinking-orbs-ping' | 'spinning-earth-metal' | 'glow-card' | 'abyss-grid' | 'filament' | 'character-umbra' | 'card-depth-stack' | 'card-fan' | 'card-cylinder' | 'card-sphere' | 'card-spiral' | 'card-wave-grid' | 'morph-circle-pill' | 'morph-size' | 'morph-reverse-collapse';
  vfxColorA?: string;  // 主色
  vfxColorB?: string;  // 副色
  vfxColorC?: string;  // 第三色（大气/中间色，可选）
  vfxSpeed?: number;   // 播放速度 0.5 - 2
  vfxParams?: Record<string, number | string>;  // 动效可调参数（MetalForge 风格：globeSize/tilt/rotateSpeed/detail 等，含 COLOURS 颜色 hex）
  vfxCards?: VfxCardItem[];
  vfxCardSelectedId?: string;
  /** Only explicit click/swipe selection may enlarge a card; legacy selected IDs remain inactive. */
  vfxCardSelectionActive?: boolean;

  // Data Visualization (Chart / Counter / Clock)
  chartKind?: 'bar' | 'line' | 'pie' | 'donut' | 'counter' | 'clock';
  chartData?: { label: string; value: number; color?: string }[];
  chartTitle?: string;
  chartColors?: string[];
  chartInteractions?: ChartInteractionOptions;
  counterValue?: number;          // 翻牌器目标数值
  counterPrefix?: string;         // 数值前缀（如 ¥、$）
  counterSuffix?: string;         // 数值后缀（如 %、台）
  clockFormat?: 'time' | 'date' | 'datetime';  // 时钟显示格式

  // 3D / 全景 / 模型 / 高斯泼溅
  panoramaFov?: number;         // 全景视角 FOV (30-120, 默认 75)
  panoramaAutoRotate?: boolean; // 全景自动旋转
  panoramaAutoRotateSpeed?: number; // 自动旋转速度 (0.1-5, 默认 1)
  modelAutoRotate?: boolean;    // 3D模型自动旋转
  modelAutoRotateSpeed?: number;// 模型旋转速度
  modelCameraDistance?: number; // 模型相机距离
  /** 3D 展示姿态：绕模型中心的水平/俯仰角（度），用于保存画布拖拽后的视角。 */
  modelViewAzimuth?: number;
  modelViewElevation?: number;
  /** 3D 模型在自身容器内的显示缩放，1 为原始适配尺寸。 */
  modelScale?: number;
  /** 3D 拆解效果的方向与距离控制。radial 表示从模型中心向外。 */
  ai3dLayerDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
  ai3dLayerDistance?: number;
  ai3dExplodeDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
  ai3dExplodeDistance?: number;
  ai3dExplodeSpeed?: number;
  ai3dExplodeSpin?: number;
  ai3dCollisionDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
  ai3dCollisionDistance?: number;
  ai3dCollisionBounce?: number;
  ai3dCollisionSpeed?: number;
  // AI 3D 模型控制参数（分层/爆炸/碰撞）
  ai3dLayers?: number;    // 分层程度 0-1（0=合并，1=完全展开）
  ai3dExplode?: number;   // 爆炸程度 0-1（0=原状，1=完全爆炸）
  ai3dPhysics?: boolean;  // 物理碰撞开关
  /** 爆炸/碰撞的循环动画开关；未设置时兼容旧工程，默认循环。 */
  ai3dLoopEnabled?: boolean;
  ai3dCode?: string;      // img2threejs 生成的过程化代码（ES Module），有此字段则用代码创建模型而非加载GLB
  ai3dCodeSource?: 'seed3d' | 'img2threejs'; // 模型来源
  ai3dTexture?: string;    // img2threejs 模式的纹理图片 base64 数据，传递给 createModel(textureData)
  ai3dShowPanel?: boolean; // 是否在画布上显示浮动控制面板（分层/爆炸/碰撞），默认 true
  /** 预览/导出界面各自显示哪些 3D 动效按钮；未配置时三个按钮全部显示。 */
  ai3dPreviewControls?: Ai3DControlConfig;
  ai3dExportControls?: Ai3DControlConfig;
  /** 按钮的默认视觉组件风格，可被单个按钮 variant 覆盖。 */
  ai3dControlVariant?: Ai3DControlVariant;
  splatSize?: number;            // 高斯泼溅点大小 (0.5-5, 默认 1)

  // 全局变量绑定（动态数据接入）
  bindText?: string;   // 绑定变量名 → 文本内容（txt 内容 / 翻牌器标题 / 图表标题）
  bindValue?: string;  // 绑定变量名 → 数值（翻牌器目标值 / 图表数据源）

  // 3D/全景画面内交互热点（仅 panorama-img / panorama-vid / model-3d / gaussian-splat 有意义）
  hotspots?: Hotspot[];
  /** Character-range hotspots used by UI and custom-code text layers. */
  textHotspots?: TextHotspot[];
}

export type SceneTransitionType = 
  | 'none'          // 无转场 (直接硬切)
  | 'fade'          // 平滑淡入 (Crossfade)
  | 'slide-left'    // 向左滑入 (Slide Left)
  | 'slide-right'   // 向右滑入 (Slide Right)
  | 'slide-up'      // 向上滑入 (Slide Up)
  | 'slide-down'    // 向下滑入 (Slide Down)
  | 'zoom-in'       // 镜头推近 (Zoom In)
  | 'zoom-out'      // 镜头拉远 (Zoom Out)
  | 'dissolve'      // 模糊溶解 (Blur Dissolve)
  | 'flip-3d'       // 3D 空间翻转 (3D Flip)
  | 'cube-3d'       // 3D 立方体旋转 (3D Cube)
  | 'glitch'        // 赛博故障 (Glitch Wipe)
  | 'wipe-right'    // 光幕对角划过 (Wipe)
  | 'soft-wipe'     // 柔光擦拭 (Soft Wipe)
  | 'radial-reveal' // 径向扩散 (Radial Reveal)
  | 'diagonal-curtain' // 斜切光幕 (Diagonal Curtain)
  | 'blur-dissolve'; // 模糊溶解 (Blur Dissolve)

/** 元素级场景切换进出场动画覆盖：元素触发跳转时临时覆盖场景级转场设置（仅本次切换生效） */
export interface SceneTransitionOverride {
  enterAnim?: SceneTransitionType;  // 入场动画（覆盖目标场景 transitionIn）
  exitAnim?: SceneTransitionType;   // 出场动画（覆盖当前场景 transitionOut）
  duration?: number;                // 动画时长（秒，覆盖场景 transitionDuration）
}

export interface Scene {
  id: string;
  alias: string;
  type: 'scene' | 'interface' | 'modal';
  duration: number;       // total duration in seconds
  cruiseDuration?: number;// auto cruise linger duration (0 = default to duration)
  autoAdvanceDelay?: number; // 自动轮播停留秒数（默认回退 cruiseDuration / duration）
  bgRef?: string;         // background image / video ref
  bgColor?: string;       // background color fallback
  backgroundType?: 'solid' | 'gradient' | 'transparent' | 'glass';
  gradientType?: 'linear' | 'radial';
  gradientStart?: string;
  gradientVia?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  bgmRef?: string;        // background music audio ref
  bgmVolume?: number;     // 0-1
  inPoint?: number;       // timeline in point (s)
  outPoint?: number;      // timeline out point (s)
  
  // Scene Transition properties
  transitionIn?: SceneTransitionType;   // 进入转场类型
  transitionOut?: SceneTransitionType;  // 退出转场类型
  transitionDuration?: number;          // 转场时长 (秒, 默认 0.6s)
  transitionEasing?: string;            // 缓动曲线

  order?: number;                       // 场景播放序列索引 (0-based)
  /** 体感手势绑定（页面级手势→动作，编辑器场景属性面板配置） */
  gestureBindings?: GestureBinding[];
  groups?: LayerGroup[];                // 场景图层文件夹分组
  els: SceneElement[];
}

export interface ProjectMeta {
  v: number;
  title?: string;
  author?: string;
  updatedAt?: string;
  /** Stable identifier for first-party templates; titles remain user-editable. */
  templateId?: string;
  templateRevision?: number;
}

export interface SceneComment {
  id: string;
  sceneId: string;
  /** Position relative to the scene (0-100). */
  x: number;
  y: number;
  text: string;
  author?: string;
  createdAt: number;
  updatedAt?: number;
  resolved?: boolean;
}

export interface ThemeTokens {
  name?: string;
  colors: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    baseSize: number;
    headingSize: number;
  };
  radius: number;
  shadow: string;
}

export interface ProjectData {
  meta: ProjectMeta;
  scenes: Record<string, Scene>;
  start: string;
  /** Review comments pinned to scene coordinates. */
  comments?: SceneComment[];
  /** Project-level design tokens used by new layers and theme application. */
  theme?: ThemeTokens;
  is3DParallaxEnabled?: boolean; // 全局 3D 视差开关 (默认开启)
  parallaxIntensity?: number;    // 全局视差强度 (0 - 2.5, 默认 1.0)
  variables?: GlobalVariable[];  // 全局变量（动态数据接入）
  components?: ComponentPreset[]; // 组件预设库（元素组复用）
  /** 工程级画布尺寸（默认 1920x1080 / 16:9；缺失时回退默认） */
  canvas?: { width: number; height: number };
  /** 工程级体感交互开关与全局灵敏度 */
  motionInput?: {
    enabled?: boolean;
    sensitivity?: number;
    deadZone?: number;
    reverse?: boolean;
    disconnectTimeout?: number;
  };
  /** 播放控制栏 HUD 款式配置（编辑器预览与导出共用，保证所见即所得） */
  hudConfig?: HudConfig;
}

/** HUD 控制栏款式：default 深色胶囊 / minimal 底部半透 / tech 科技发光 / hidden 不显示 */
export type HudStyle = 'default' | 'minimal' | 'tech' | 'hidden';
export interface HudConfig {
  style?: HudStyle;
  showDots?: boolean;   // 场景进度点
  showTitle?: boolean;  // 当前场景名
  /** 播放时是否允许用户将控制栏折叠到画面底部 */
  collapsible?: boolean;
}

// 体感手势类型（MediaPipe 识别语义）
export type GestureType = 'wave' | 'open_palm' | 'swipe_left' | 'swipe_right' | 'fist' | 'point';
// 体感触发动作（页面级）
export type GestureAction =
  | 'next_scene'   // 切换下一场景
  | 'prev_scene'   // 切换上一场景
  | 'goto_scene'   // 跳到指定场景
  | 'goto_start'   // 返回起始场景
  | 'show_menu'    // 呼出菜单（预留）
  | 'none';        // 无动作

/** 单条体感手势绑定（场景级） */
export interface GestureBinding {
  id: string;
  gesture: GestureType;
  action: GestureAction;
  targetSceneId?: string; // goto_scene 目标场景
  sensitivity?: number;   // 灵敏度 0.2-2，默认 1
}

// 全局变量（可用于元素属性绑定 / 动态数据接入）
export interface GlobalVariable {
  id: string;
  name: string;
  value: string | number;
  type: 'text' | 'number';
  unit?: string;
  mqttTopic?: string;
  mockSimulated?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

// 组件预设：把一组元素保存为可复用组件
export interface ComponentVariant {
  id: string;
  name: string;
  /** Elements use coordinates relative to the component frame (0-100). */
  elements: SceneElement[];
}

export interface ComponentInstanceMeta {
  masterId: string;
  variantId?: string;
  /** Per child override keyed by the master element's componentSourceId. */
  overrides?: Record<string, Partial<SceneElement>>;
}

export interface ComponentPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  version?: number;
  /** Default variant elements; kept for backward compatibility with old presets. */
  elements: SceneElement[];
  variants?: ComponentVariant[];
  /** Frame size in canvas percent, captured when the master was created. */
  width?: number;
  height?: number;
}

export interface ViewportState {
  zoom: number;           // 0.25 to 2.0
  panX: number;
  panY: number;
  showGrid: boolean;
  showSafeArea: boolean;
  snapEnabled: boolean;
  activeTool: 'select' | 'pan' | 'saber-draw' | 'shape-draw' | 'interaction-draw' | 'mask-pen';
  parallaxIntensity?: number; // 0 (off), 1.0 (standard), 1.8 (enhanced), 2.5 (extreme)
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  zoom: number;           // timeline px per second (10-150)
  isCruising: boolean;
  volume: number;
  isMuted: boolean;
  loop: boolean;
}

export type HistoryActionType =
  | 'init'
  | 'scene_new'
  | 'scene_delete'
  | 'scene_duplicate'
  | 'scene_reorder'
  | 'scene_update'
  | 'scene_transition'
  | 'element_new'
  | 'element_delete'
  | 'element_duplicate'
  | 'element_transform'
  | 'element_update'
  | 'element_order'
  | 'group_create'
  | 'group_delete'
  | 'group_update'
  | 'group_ungroup'
  | 'template_load'
  | 'import'
  | 'general';

export interface HistoryItem {
  id: string;
  timestamp: number;
  timeStr: string;
  title: string;
  details?: string;
  actionType: HistoryActionType;
  sceneId?: string;
  snapshot: string;
}
