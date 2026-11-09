import { SceneElement } from '../types';

export interface GradientPreset {
  id: string;
  name: string;
  type: 'linear' | 'radial';
  angle?: number;
  start: string;
  via?: string;
  end: string;
  textColor: string;
  borderColor?: string;
  css: string;
}

export interface GradientBackgroundConfig {
  gradientType?: 'linear' | 'radial';
  gradientStart?: string;
  gradientVia?: string;
  gradientEnd?: string;
  gradientAngle?: number;
}

export function getGradientBackground(config: GradientBackgroundConfig): string {
  const start = config.gradientStart || '#06b6d4';
  const end = config.gradientEnd || '#9333ea';
  const via = config.gradientVia;
  if (config.gradientType === 'radial') {
    return via
      ? `radial-gradient(circle at center, ${start} 0%, ${via} 50%, ${end} 100%)`
      : `radial-gradient(circle at center, ${start} 0%, ${end} 100%)`;
  }
  const angle = config.gradientAngle ?? 135;
  return via
    ? `linear-gradient(${angle}deg, ${start} 0%, ${via} 50%, ${end} 100%)`
    : `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
}

export interface ColorPreset {
  id: string;
  name: string;
  color: string;
  textColor: string;
  borderColor?: string;
}

export type ColorThemeId = 'cyber' | 'sunset' | 'aurora' | 'royal' | 'dark' | 'glass';

export interface ColorThemePreset {
  id: ColorThemeId;
  name: string;
  colorA: string;
  colorB: string;
  textColor?: string;
  borderColor?: string;
}

// Shared by shape and VFX libraries so palette order, colors, and interaction
// stay consistent across both creation surfaces.
export const COLOR_THEME_PRESETS: ColorThemePreset[] = [
  { id: 'cyber', name: '霓虹青紫', colorA: '#22d3ee', colorB: '#a855f7' },
  { id: 'sunset', name: '熔岩炽橙', colorA: '#fb923c', colorB: '#9a3412' },
  { id: 'aurora', name: '能量绿青', colorA: '#34d399', colorB: '#22d3ee' },
  { id: 'royal', name: '霓虹玫紫', colorA: '#f472b6', colorB: '#818cf8' },
  { id: 'dark', name: '深空蓝紫', colorA: '#a78bfa', colorB: '#0ea5e9' },
  { id: 'glass', name: '冷白电蓝', colorA: '#e0f2fe', colorB: '#38bdf8' },
];

// Keep the picker order identical in the shape and VFX libraries.
export const COLOR_THEME_PRESETS_ALIGNED: ColorThemePreset[] = [
  'cyber', 'dark', 'aurora', 'sunset', 'glass', 'royal',
].map((id) => COLOR_THEME_PRESETS.find((theme) => theme.id === id)!).filter(Boolean);

export function getColorThemePreset(id?: ColorThemeId): ColorThemePreset | undefined {
  return COLOR_THEME_PRESETS.find((theme) => theme.id === id);
}

export function getColorThemeTextColor(id?: ColorThemeId): string {
  return id === 'glass' ? '#082f49' : id === 'dark' ? '#f8fafc' : id === 'sunset' ? '#fff7ed' : '#ffffff';
}

export function getColorThemeBorderColor(id?: ColorThemeId): string {
  const colors: Partial<Record<ColorThemeId, string>> = {
    cyber: 'rgba(167, 139, 250, 0.72)',
    dark: 'rgba(125, 211, 252, 0.58)',
    aurora: 'rgba(94, 234, 212, 0.72)',
    sunset: 'rgba(253, 186, 116, 0.72)',
    glass: 'rgba(186, 230, 253, 0.88)',
    royal: 'rgba(244, 114, 182, 0.72)',
  };
  return colors[id || 'cyber'] || 'rgba(255, 255, 255, 0.3)';
}

export interface ShapePresetItem {
  id: string;
  name: string;
  category: 'base' | 'polygon' | 'badge' | 'arrow';
  description: string;
  shapeKind: string;
  defaultW: number;
  defaultH: number;
  borderRadius?: number;
  clipPath?: string;
  defaultContent?: string;
  defaultBackgroundType?: 'solid' | 'gradient' | 'glass';
  defaultGradientStart?: string;
  defaultGradientVia?: string;
  defaultGradientEnd?: string;
  defaultGradientAngle?: number;
  defaultBackgroundColor?: string;
  defaultBorderColor?: string;
  defaultBorderWidth?: number;
  defaultBoxShadow?: string;
  textColor?: string;
  isCore?: boolean;
}

// Curated Base & Advanced Shape Presets
export const BASE_SHAPE_PRESETS: ShapePresetItem[] = [
  // --- 4 Core Base Shapes Requested by User ---
  {
    id: 'rounded_rect',
    name: '圆角矩形',
    category: 'base',
    description: '现代平滑圆角卡片，具备可调圆角与精致立体投影，适合信息展示与按钮',
    shapeKind: 'rounded-rect',
    defaultW: 28,
    defaultH: 18,
    borderRadius: 18,
    defaultContent: 'ROUNDED CARD\n圆角矩形卡片',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#06b6d4',
    defaultGradientVia: '#3b82f6',
    defaultGradientEnd: '#9333ea',
    defaultGradientAngle: 135,
    defaultBorderColor: 'rgba(255, 255, 255, 0.25)',
    defaultBorderWidth: 1,
    defaultBoxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
    textColor: '#ffffff',
    isCore: true,
  },
  {
    id: 'circle',
    name: '正圆形',
    category: 'base',
    description: '1:1 等比例正圆几何，适合视觉焦点、头像框、核心发光徽标与状态指示',
    shapeKind: 'circle',
    defaultW: 18,
    defaultH: 18,
    borderRadius: 9999,
    clipPath: 'circle(50% at 50% 50%)',
    defaultContent: 'CIRCLE',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#38bdf8',
    defaultGradientVia: '#0284c7',
    defaultGradientEnd: '#0f172a',
    defaultGradientAngle: 135,
    defaultBorderColor: 'rgba(56, 189, 248, 0.5)',
    defaultBorderWidth: 2,
    defaultBoxShadow: '0 0 25px rgba(56, 189, 248, 0.5)',
    textColor: '#ffffff',
    isCore: true,
  },
  {
    id: 'ellipse',
    name: '椭圆形',
    category: 'base',
    description: '扁平流畅长椭圆与弧线轮廓，适合高光底托、胶囊容器与流线型装饰层',
    shapeKind: 'ellipse',
    defaultW: 30,
    defaultH: 16,
    borderRadius: 9999,
    clipPath: 'ellipse(50% 50% at 50% 50%)',
    defaultContent: 'ELLIPSE / 椭圆',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#ff007a',
    defaultGradientVia: '#f97316',
    defaultGradientEnd: '#facc15',
    defaultGradientAngle: 135,
    defaultBorderColor: 'rgba(255, 0, 122, 0.4)',
    defaultBorderWidth: 1,
    defaultBoxShadow: '0 8px 24px rgba(255, 0, 122, 0.3)',
    textColor: '#ffffff',
    isCore: true,
  },
  {
    id: 'trapezoid',
    name: '等腰梯形',
    category: 'base',
    description: '对称科技感梯形切角，适合科幻座舱界面、抬头显示、顶部横幅与底座基石',
    shapeKind: 'trapezoid',
    defaultW: 28,
    defaultH: 18,
    borderRadius: 0,
    clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
    defaultContent: 'TRAPEZOID 梯形',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#4f46e5',
    defaultGradientVia: '#7c3aed',
    defaultGradientEnd: '#c026d3',
    defaultGradientAngle: 135,
    defaultBorderColor: 'rgba(192, 38, 211, 0.5)',
    defaultBorderWidth: 1,
    defaultBoxShadow: '0 10px 25px rgba(124, 58, 237, 0.4)',
    textColor: '#ffffff',
    isCore: true,
  },

  // --- Extended Useful Shapes ---
  {
    id: 'inverted_trapezoid',
    name: '倒梯形 (HUD 顶栏)',
    category: 'polygon',
    description: '上宽下窄的倒梯形，常用于科幻顶部导航条与悬浮 HUD 仪表',
    shapeKind: 'inverted-trapezoid',
    defaultW: 32,
    defaultH: 14,
    borderRadius: 0,
    clipPath: 'polygon(0% 0%, 100% 0%, 85% 100%, 15% 100%)',
    defaultContent: 'HUD HEADER',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: 'rgba(6, 182, 212, 0.9)',
    defaultGradientEnd: 'rgba(15, 23, 42, 0.95)',
    defaultGradientAngle: 180,
    defaultBorderColor: '#38bdf8',
    defaultBorderWidth: 1,
    textColor: '#e0f2fe',
  },
  {
    id: 'rectangle_sharp',
    name: '直角矩形',
    category: 'base',
    description: '干净利落的标准直角几何，适合结构化网格、极客版面与暗黑高对比构图',
    shapeKind: 'rect',
    defaultW: 26,
    defaultH: 18,
    borderRadius: 0,
    defaultContent: 'RECTANGLE',
    defaultBackgroundType: 'solid',
    defaultBackgroundColor: 'rgba(15, 23, 42, 0.9)',
    defaultBorderColor: 'rgba(255, 255, 255, 0.15)',
    defaultBorderWidth: 1,
    textColor: '#f8fafc',
  },
  {
    id: 'pill_capsule',
    name: '胶囊药丸 (Capsule)',
    category: 'badge',
    description: '全圆角药丸胶囊轮廓，适合状态标签、分类 Chip 以及呼唤行动 (CTA) 按钮',
    shapeKind: 'pill',
    defaultW: 22,
    defaultH: 9,
    borderRadius: 9999,
    defaultContent: '⚡ ACTIVE PILL',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#059669',
    defaultGradientVia: '#10b981',
    defaultGradientEnd: '#06b6d4',
    defaultGradientAngle: 90,
    defaultBorderColor: '#34d399',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'parallelogram',
    name: '平行四边形',
    category: 'polygon',
    description: '倾斜动态速度感多边形，适合电竞战队标、竞速动效与动感卡片',
    shapeKind: 'parallelogram',
    defaultW: 28,
    defaultH: 16,
    borderRadius: 0,
    clipPath: 'polygon(18% 0%, 100% 0%, 82% 100%, 0% 100%)',
    defaultContent: 'SPEED SLANTED',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#f97316',
    defaultGradientEnd: '#dc2626',
    defaultGradientAngle: 45,
    defaultBorderColor: '#fb923c',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'hexagon',
    name: '正六边形 (蜂巢网格)',
    category: 'polygon',
    description: '科幻蜂巢多边形，适合数据矩阵、技能星盘与模块化网格',
    shapeKind: 'hexagon',
    defaultW: 20,
    defaultH: 20,
    borderRadius: 0,
    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
    defaultContent: 'HEXAGON',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#022c22',
    defaultGradientVia: '#065f46',
    defaultGradientEnd: '#10b981',
    defaultGradientAngle: 90,
    defaultBorderColor: '#34d399',
    defaultBorderWidth: 1,
    textColor: '#a7f3d0',
  },
  {
    id: 'diamond',
    name: '菱形 / 宝石',
    category: 'polygon',
    description: '旋转45度几何菱形，适合成就徽章、关键节点与警示标记',
    shapeKind: 'diamond',
    defaultW: 20,
    defaultH: 20,
    borderRadius: 0,
    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    defaultContent: 'DIAMOND',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#eab308',
    defaultGradientEnd: '#f97316',
    defaultGradientAngle: 135,
    defaultBorderColor: '#fde047',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'triangle',
    name: '正三角形',
    category: 'polygon',
    description: '向上的经典几何三角，适合方向指示、等级金字塔与警示图标',
    shapeKind: 'triangle',
    defaultW: 20,
    defaultH: 18,
    borderRadius: 0,
    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
    defaultContent: '▲',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#f43f5e',
    defaultGradientEnd: '#9f1239',
    defaultGradientAngle: 180,
    defaultBorderColor: '#fb7185',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'cyber_cutout',
    name: '赛博切角卡片',
    category: 'badge',
    description: '经典机甲/赛博朋克对角切角面板，工业机甲感十足',
    shapeKind: 'cyber-cutout',
    defaultW: 28,
    defaultH: 18,
    borderRadius: 0,
    clipPath: 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)',
    defaultContent: 'CYBER PANEL\n机甲切角',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#0f172a',
    defaultGradientVia: '#1e1b4b',
    defaultGradientEnd: '#312e81',
    defaultGradientAngle: 160,
    defaultBorderColor: '#6366f1',
    defaultBorderWidth: 1,
    textColor: '#e0e7ff',
  },
  {
    id: 'right_arrow',
    name: '引导箭头 (Arrow)',
    category: 'arrow',
    description: '向右流动引导剪头，适合流程图节点、交互提示与步骤导航',
    shapeKind: 'right-arrow',
    defaultW: 26,
    defaultH: 12,
    borderRadius: 0,
    clipPath: 'polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%)',
    defaultContent: 'NEXT ➔',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#06b6d4',
    defaultGradientEnd: '#3b82f6',
    defaultGradientAngle: 90,
    defaultBorderColor: '#67e8f9',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'callout_bubble',
    name: '对话气泡 (Callout)',
    category: 'badge',
    description: '带尾巴的对话气泡，适合人物台词、提示问答与悬浮批注',
    shapeKind: 'callout',
    defaultW: 26,
    defaultH: 18,
    borderRadius: 0,
    clipPath: 'polygon(0% 0%, 100% 0%, 100% 75%, 35% 75%, 20% 100%, 20% 75%, 0% 75%)',
    defaultContent: '💬 对话气泡',
    defaultBackgroundType: 'solid',
    defaultBackgroundColor: 'rgba(30, 41, 59, 0.95)',
    defaultBorderColor: 'rgba(255, 255, 255, 0.25)',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'octagon',
    name: '八边形 / Octagon',
    category: 'polygon',
    description: '切角八边形，适合仪表盘状态、数据节点与科技徽章',
    shapeKind: 'octagon',
    defaultW: 22,
    defaultH: 20,
    clipPath: 'polygon(28% 0%, 72% 0%, 100% 28%, 100% 72%, 72% 100%, 28% 100%, 0% 72%, 0% 28%)',
    defaultContent: 'OCTAGON',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#0ea5e9',
    defaultGradientVia: '#2563eb',
    defaultGradientEnd: '#312e81',
    defaultGradientAngle: 135,
    defaultBorderColor: '#7dd3fc',
    defaultBorderWidth: 1,
    textColor: '#eff6ff',
  },
  {
    id: 'shield',
    name: '盾牌 / Shield',
    category: 'badge',
    description: '垂直盾牌轮廓，适合安全、权限与核心能力标记',
    shapeKind: 'shield',
    defaultW: 20,
    defaultH: 24,
    clipPath: 'polygon(50% 0%, 92% 16%, 86% 62%, 72% 82%, 50% 100%, 28% 82%, 14% 62%, 8% 16%)',
    defaultContent: 'SHIELD',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#14b8a6',
    defaultGradientVia: '#0f766e',
    defaultGradientEnd: '#082f49',
    defaultGradientAngle: 160,
    defaultBorderColor: '#5eead4',
    defaultBorderWidth: 1,
    textColor: '#ecfeff',
  },
  {
    id: 'chevron',
    name: '折线箭头 / Chevron',
    category: 'arrow',
    description: '轻量折线箭头，适合步骤流、导航与进度指示',
    shapeKind: 'chevron',
    defaultW: 28,
    defaultH: 14,
    clipPath: 'polygon(0% 0%, 62% 0%, 100% 50%, 62% 100%, 0% 100%, 38% 50%)',
    defaultContent: 'NEXT',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#38bdf8',
    defaultGradientEnd: '#6366f1',
    defaultGradientAngle: 90,
    defaultBorderColor: '#a5b4fc',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'left_arrow',
    name: '左向箭头 / Left Arrow',
    category: 'arrow',
    description: '反向流程箭头，适合返回、回溯与双向路径',
    shapeKind: 'left-arrow',
    defaultW: 26,
    defaultH: 12,
    clipPath: 'polygon(0% 50%, 35% 0%, 35% 25%, 100% 25%, 100% 75%, 35% 75%, 35% 100%)',
    defaultContent: 'BACK',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#f472b6',
    defaultGradientEnd: '#7c3aed',
    defaultGradientAngle: 270,
    defaultBorderColor: '#f9a8d4',
    defaultBorderWidth: 1,
    textColor: '#ffffff',
  },
  {
    id: 'cross',
    name: '十字标记 / Cross',
    category: 'badge',
    description: '几何十字标记，适合定位、医疗状态与控制台指示',
    shapeKind: 'cross',
    defaultW: 20,
    defaultH: 20,
    clipPath: 'polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)',
    defaultContent: '+',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#fb7185',
    defaultGradientEnd: '#be123c',
    defaultGradientAngle: 135,
    defaultBorderColor: '#fda4af',
    defaultBorderWidth: 1,
    textColor: '#fff1f2',
  },
  {
    id: 'lightning',
    name: '闪电 / Lightning',
    category: 'badge',
    description: '锐利闪电轮廓，适合能量、告警与高性能标签',
    shapeKind: 'lightning',
    defaultW: 18,
    defaultH: 24,
    clipPath: 'polygon(56% 0%, 8% 56%, 42% 56%, 28% 100%, 92% 34%, 58% 34%)',
    defaultContent: '⚡',
    defaultBackgroundType: 'gradient',
    defaultGradientStart: '#fef08a',
    defaultGradientVia: '#f59e0b',
    defaultGradientEnd: '#b45309',
    defaultGradientAngle: 160,
    defaultBorderColor: '#fde68a',
    defaultBorderWidth: 1,
    textColor: '#451a03',
  },
];

export const SOLID_COLOR_PRESETS: ColorPreset[] = [
  { id: 'dark_slate', name: '深邃暗夜', color: 'rgba(15, 23, 42, 0.88)', textColor: '#f8fafc', borderColor: 'rgba(255, 255, 255, 0.15)' },
  { id: 'pure_black', name: '纯黑极客', color: '#090a0f', textColor: '#ffffff', borderColor: '#262626' },
  { id: 'cyber_cyan', name: '霓虹青蓝', color: '#06b6d4', textColor: '#042f2e', borderColor: '#67e8f9' },
  { id: 'electric_blue', name: '电光湛蓝', color: '#0284c7', textColor: '#ffffff', borderColor: '#38bdf8' },
  { id: 'neon_purple', name: '幻影极紫', color: '#8b5cf6', textColor: '#ffffff', borderColor: '#c084fc' },
  { id: 'cyber_magenta', name: '赛博洋红', color: '#ec4899', textColor: '#ffffff', borderColor: '#f472b6' },
  { id: 'sunset_rose', name: '日落落霞', color: '#f43f5e', textColor: '#ffffff', borderColor: '#fda4af' },
  { id: 'blaze_orange', name: '活力赤橙', color: '#f97316', textColor: '#ffffff', borderColor: '#fdba74' },
  { id: 'amber_gold', name: '琥珀金辉', color: '#eab308', textColor: '#422006', borderColor: '#fef08a' },
  { id: 'emerald_green', name: '翡翠荧光', color: '#10b981', textColor: '#022c22', borderColor: '#6ee7b7' },
  { id: 'mint_cyan', name: '清新薄荷', color: '#14b8a6', textColor: '#042f2e', borderColor: '#5eead4' },
  { id: 'frost_white', name: '极简雪白', color: '#ffffff', textColor: '#0f172a', borderColor: '#e2e8f0' },
  { id: 'glass_light', name: '高透冰晶', color: 'rgba(255, 255, 255, 0.12)', textColor: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.25)' },
  { id: 'glass_dark', name: '磨砂炭黑', color: 'rgba(0, 0, 0, 0.55)', textColor: '#e2e8f0', borderColor: 'rgba(255, 255, 255, 0.12)' },
];

// Curated high-aesthetic linear and radial gradients
export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'cyber_fusion',
    name: '赛博霓光 (Cyber Neon)',
    type: 'linear',
    angle: 135,
    start: '#06b6d4',
    via: '#3b82f6',
    end: '#9333ea',
    textColor: '#ffffff',
    borderColor: 'rgba(147, 51, 234, 0.5)',
    css: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #9333ea 100%)',
  },
  {
    id: 'sunset_blaze',
    name: '落日熔金 (Sunset Blaze)',
    type: 'linear',
    angle: 135,
    start: '#ff007a',
    via: '#f97316',
    end: '#facc15',
    textColor: '#ffffff',
    borderColor: 'rgba(255, 0, 122, 0.4)',
    css: 'linear-gradient(135deg, #ff007a 0%, #f97316 50%, #facc15 100%)',
  },
  {
    id: 'aurora_borealis',
    name: '极地极光 (Aurora Glow)',
    type: 'linear',
    angle: 135,
    start: '#059669',
    via: '#06b6d4',
    end: '#3b82f6',
    textColor: '#ffffff',
    borderColor: 'rgba(6, 182, 212, 0.5)',
    css: 'linear-gradient(135deg, #059669 0%, #06b6d4 50%, #3b82f6 100%)',
  },
  {
    id: 'royal_amethyst',
    name: '皇家幻紫 (Royal Violet)',
    type: 'linear',
    angle: 135,
    start: '#4f46e5',
    via: '#7c3aed',
    end: '#c026d3',
    textColor: '#ffffff',
    borderColor: 'rgba(192, 38, 211, 0.4)',
    css: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #c026d3 100%)',
  },
  {
    id: 'deep_space',
    name: '深空幽蓝 (Deep Abyss)',
    type: 'linear',
    angle: 160,
    start: '#0f172a',
    via: '#1e1b4b',
    end: '#312e81',
    textColor: '#e0e7ff',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    css: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
  },
  {
    id: 'holographic',
    name: '全息虹光 (Hologram Prism)',
    type: 'linear',
    angle: 45,
    start: '#ff80bf',
    via: '#9580ff',
    end: '#80ffea',
    textColor: '#0f172a',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    css: 'linear-gradient(45deg, #ff80bf 0%, #9580ff 50%, #80ffea 100%)',
  },
  {
    id: 'glass_frost',
    name: '磨砂冰晶 (Glass Frost)',
    type: 'linear',
    angle: 135,
    start: 'rgba(255, 255, 255, 0.22)',
    end: 'rgba(255, 255, 255, 0.05)',
    textColor: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    css: 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%)',
  },
  {
    id: 'dark_carbon_mesh',
    name: '暗黑碳纤 (Dark Graphite)',
    type: 'linear',
    angle: 180,
    start: 'rgba(30, 41, 59, 0.95)',
    end: 'rgba(15, 23, 42, 0.95)',
    textColor: '#f8fafc',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    css: 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
  },
  {
    id: 'emerald_matrix',
    name: '矩阵数码 (Emerald Matrix)',
    type: 'linear',
    angle: 90,
    start: '#022c22',
    via: '#065f46',
    end: '#10b981',
    textColor: '#a7f3d0',
    borderColor: '#34d399',
    css: 'linear-gradient(90deg, #022c22 0%, #065f46 50%, #10b981 100%)',
  },
  {
    id: 'golden_luxury',
    name: '黑金奢华 (Golden Luxury)',
    type: 'linear',
    angle: 135,
    start: '#1c1917',
    via: '#78350f',
    end: '#d97706',
    textColor: '#fef3c7',
    borderColor: '#f59e0b',
    css: 'linear-gradient(135deg, #1c1917 0%, #78350f 50%, #d97706 100%)',
  },
  {
    id: 'radial_core_cyan',
    name: '核心光球 (Radial Cyan)',
    type: 'radial',
    start: '#38bdf8',
    via: '#0284c7',
    end: '#0f172a',
    textColor: '#ffffff',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    css: 'radial-gradient(circle at center, #38bdf8 0%, #0284c7 50%, #0f172a 100%)',
  },
  {
    id: 'radial_core_magenta',
    name: '暗夜紫晕 (Radial Magenta)',
    type: 'radial',
    start: '#f43f5e',
    via: '#881337',
    end: '#090a0f',
    textColor: '#ffe4e6',
    borderColor: 'rgba(244, 63, 94, 0.4)',
    css: 'radial-gradient(circle at center, #f43f5e 0%, #881337 55%, #090a0f 100%)',
  }
];

/**
 * Computes the exact CSS background property for a SceneElement.
 */
export function getShapeBackground(el: SceneElement): string {
  // If explicitly gradient mode or has gradient start & end configured
  if (el.backgroundType === 'gradient' || el.gradientStart || el.gradientEnd) {
    return getGradientBackground(el);
  }

  // Glass mode
  if (el.backgroundType === 'glass') {
    return el.backgroundColor || 'rgba(255, 255, 255, 0.12)';
  }

  // Default solid color mode
  return el.backgroundColor || el.color || 'rgba(30, 41, 59, 0.85)';
}
