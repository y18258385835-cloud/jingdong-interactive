import { SceneElement } from '../types';

export interface BezierNode {
  x: number; // 0 to 100 in canvas/stage or local space
  y: number; // 0 to 100
  handleIn?: { x: number; y: number };  // Control handle pulling into node
  handleOut?: { x: number; y: number }; // Control handle pushing out of node
}

export interface SaberShapePreset {
  id: string;
  name: string;
  category: 'geometric' | '3d_wireframe' | 'laser_beam' | 'cyber_hud' | 'symbol';
  icon: string;
  description: string;
  path: string; // SVG path 'd' attribute (based on 0 0 100 100 viewBox)
  defaultCoreWidth?: number;
  defaultGlowSpread?: number;
  defaultGrowthMode?: 'none' | 'grow-in' | 'cycle-flow' | 'pulse-grow' | 'meteor-shoot';
}

export interface SaberStyleTheme {
  id: string;
  name: string;
  subtitle: string;
  glowColor: string;
  secondaryGlowColor?: string;
  coreColor: string;
  coreWidth: number;
  glowIntensity: number;
  glowSpread: number;
  flickerIntensity: number;
  blendMode: 'screen' | 'normal' | 'lighten' | 'color-dodge';
  previewGradient: string;
}

export type SaberEffectType = 'standard' | 'wave' | 'blade' | 'ribbon' | 'beam' | 'neon';

/** Shared optical contract consumed by both the editor canvas and live previews. */
export interface SaberEffectProfile {
  trackOffsets: number[];
  coreScale: number;
  haloScale: number;
  ambientScale: number;
  trailOpacity: number;
  trailDash: string;
  outerBlurScale: number;
  innerBlurScale: number;
  turbulence: number;
  particles: number;
}

export const SABER_EFFECT_PROFILES: Record<SaberEffectType, SaberEffectProfile> = {
  standard: {
    trackOffsets: [0], coreScale: 1.55, haloScale: 2.5, ambientScale: 4.2,
    trailOpacity: 0.16, trailDash: 'none', outerBlurScale: 0.055, innerBlurScale: 0.022,
    turbulence: 0.18, particles: 0,
  },
  wave: {
    trackOffsets: [-1.8, 1.8], coreScale: 1.35, haloScale: 2.8, ambientScale: 4.8,
    trailOpacity: 0.22, trailDash: '14 9', outerBlurScale: 0.075, innerBlurScale: 0.028,
    turbulence: 0.32, particles: 0,
  },
  blade: {
    trackOffsets: [-2.2, 0, 2.2], coreScale: 0.78, haloScale: 4.8, ambientScale: 7.4,
    trailOpacity: 0.28, trailDash: 'none', outerBlurScale: 0.11, innerBlurScale: 0.03,
    turbulence: 0.08, particles: 0,
  },
  ribbon: {
    trackOffsets: [-2.4, -1.2, 1.2, 2.4], coreScale: 1.05, haloScale: 2.2, ambientScale: 3.8,
    trailOpacity: 0.3, trailDash: '18 12', outerBlurScale: 0.065, innerBlurScale: 0.026,
    turbulence: 0.42, particles: 12,
  },
  beam: {
    trackOffsets: [0], coreScale: 1.3, haloScale: 4.4, ambientScale: 9.5,
    trailOpacity: 0.34, trailDash: 'none', outerBlurScale: 0.14, innerBlurScale: 0.04,
    turbulence: 0.1, particles: 0,
  },
  neon: {
    trackOffsets: [0], coreScale: 1.1, haloScale: 3.2, ambientScale: 5.5,
    trailOpacity: 0.24, trailDash: 'none', outerBlurScale: 0.085, innerBlurScale: 0.03,
    turbulence: 0.26, particles: 4,
  },
};

export function getSaberEffectProfile(effectType?: SaberEffectType): SaberEffectProfile {
  return SABER_EFFECT_PROFILES[effectType || 'standard'] || SABER_EFFECT_PROFILES.standard;
}

export interface SaberEffectStyle {
  id: SaberEffectType;
  name: string;
  description: string;
}

export const SABER_EFFECT_STYLES: SaberEffectStyle[] = [
  { id: 'standard', name: '核心光线', description: '清晰的核心线与柔和光晕' },
  { id: 'wave', name: '双波干涉', description: '双层错位波纹光线' },
  { id: 'blade', name: '垂直光刃', description: '高亮、锐利、带长尾的光刃' },
  { id: 'ribbon', name: '弧形光带', description: '多层轨迹叠加的丝带光' },
  { id: 'beam', name: '水平光束', description: '宽幅中心光束与远场辉光' },
  { id: 'neon', name: '霓虹曲线', description: '高饱和圆头霓虹管' },
];

// 1. High-Aesthetic Geometric & Wireframe Preset Shapes (0 0 100 100 coordinate grid)
export const SABER_SHAPE_PRESETS: SaberShapePreset[] = [
  // --- Geometric Primitives (几何基础图形) ---
  {
    id: 'geo_line',
    name: '直线光束 (Line)',
    category: 'geometric',
    icon: '➖',
    description: '水平居中的极简高能直线光束，纯粹利落',
    path: 'M 10 50 L 90 50',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_rect',
    name: '长方形框架 (Rectangle)',
    category: 'geometric',
    icon: '▭',
    description: '标准直角长方形几何光框，适合科幻卡片高亮与焦点边界',
    path: 'M 12 20 L 88 20 L 88 80 L 12 80 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 24,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_rounded_rect',
    name: '圆角长方形 (Rounded Rect)',
    category: 'geometric',
    icon: '▢',
    description: '微倒角圆润矩形发光边框，柔和且充满现代科技感',
    path: 'M 22 18 L 78 18 A 10 10 0 0 1 88 28 L 88 72 A 10 10 0 0 1 78 82 L 22 82 A 10 10 0 0 1 12 72 L 12 28 A 10 10 0 0 1 22 18 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 24,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_circle',
    name: '正圆形光环 (Circle)',
    category: 'geometric',
    icon: '⭕',
    description: '极简正圆闭合光圈，适合作为中心核聚变光环与仪表罗盘',
    path: 'M 50 10 A 40 40 0 1 1 49.99 10 Z',
    defaultCoreWidth: 1.1,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_ellipse',
    name: '透视椭圆形 (Ellipse)',
    category: 'geometric',
    icon: '⬭',
    description: '扁平透视轨道椭圆，呈现行星公转与星环美感',
    path: 'M 50 25 A 40 22 0 1 1 49.99 25 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_triangle',
    name: '正三角形 (Triangle)',
    category: 'geometric',
    icon: '△',
    description: '等边正立三角形能量棱镜，具备稳定的几何张力',
    path: 'M 50 14 L 88 82 L 12 82 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_inv_triangle',
    name: '倒三角形 (Inverted Triangle)',
    category: 'geometric',
    icon: '▽',
    description: '倒立锐角聚能三角，强烈的视觉引导与下沉动势',
    path: 'M 12 18 L 88 18 L 50 86 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'geo_cylinder',
    name: '3D圆柱形线框 (3D Cylinder)',
    category: '3d_wireframe',
    icon: '🛢️',
    description: '全息透视立体圆柱体线框（顶部椭圆+两侧母线+底部弧面），极富空间深度',
    path: 'M 15 25 A 35 12 0 1 1 85 25 A 35 12 0 1 1 15 25 M 15 25 L 15 75 A 35 12 0 0 0 85 75 L 85 25',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_cube_3d',
    name: '3D等距立方体 (Isometric Cube)',
    category: '3d_wireframe',
    icon: '📦',
    description: '等距立体六面立方体透明线框，呈现硬核三维透视结构',
    path: 'M 50 12 L 85 30 L 50 48 L 15 30 Z M 15 30 L 15 70 L 50 88 L 85 70 L 85 30 M 50 48 L 50 88',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_hexagon',
    name: '正六边形蜂巢 (Hexagon)',
    category: 'geometric',
    icon: '⬡',
    description: '正六边形防御屏障能量光阵，经典科幻护盾形态',
    path: 'M 50 12 L 85 31 L 85 69 L 50 88 L 15 69 L 15 31 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'geo_diamond',
    name: '菱形晶体 (Diamond)',
    category: 'geometric',
    icon: '◇',
    description: '对称钻石菱形切面，凌厉优雅的晶体反光美感',
    path: 'M 50 12 L 88 50 L 50 88 L 12 50 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_capsule',
    name: '胶囊药丸形 (Capsule)',
    category: 'geometric',
    icon: '💊',
    description: '水平拉伸两端半圆的胶囊跑道形态，UI极简流光焦点',
    path: 'M 32 25 L 68 25 A 25 25 0 0 1 68 75 L 32 75 A 25 25 0 0 1 32 25 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_trapezoid',
    name: '科幻透视梯形 (Trapezoid)',
    category: 'cyber_hud',
    icon: '⏢',
    description: '上窄下宽透视科技梯形，HUD战斗机座舱瞄准界面风格',
    path: 'M 28 20 L 72 20 L 88 80 L 12 80 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_concentric_rings',
    name: '双同心光环 (Concentric Rings)',
    category: 'cyber_hud',
    icon: '🎯',
    description: '内外双层同心能量环，层次分明的光学聚焦',
    path: 'M 50 12 A 38 38 0 1 1 49.99 12 Z M 50 26 A 24 24 0 1 1 49.99 26 Z',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 24,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_gauge_arc',
    name: '环形分段仪表弧 (Gauge Arc)',
    category: 'cyber_hud',
    icon: '⏱️',
    description: '270度开口科技仪表盘光弧，流光充能动画极佳',
    path: 'M 22 78 A 38 38 0 1 1 78 78',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_star_cross',
    name: '四芒星极光 (4-Point Star)',
    category: 'symbol',
    icon: '✨',
    description: '四角向外锐利延展的高阶星芒耀斑，镜头高光反射',
    path: 'M 50 10 Q 50 50 90 50 Q 50 50 50 90 Q 50 50 10 50 Q 50 50 50 10 Z',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'geo_sine_wave',
    name: '正弦波浪线 (Sine Wave)',
    category: 'laser_beam',
    icon: '〰️',
    description: '平滑流畅的正弦声波与光子振幅，优雅流体美感',
    path: 'M 8 50 Q 29 18 50 50 T 92 50',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'geo_diagonal_blade',
    name: '对角光剑 (Diagonal Blade)',
    category: 'laser_beam',
    icon: '🗡️',
    description: '经典的对角破空光剑光束，两侧带柔和粒子光晕',
    path: 'M 12 88 L 88 12',
    defaultCoreWidth: 1.1,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'geo_infinity',
    name: '无限莫比乌斯环 (Infinity Loop)',
    category: 'symbol',
    icon: '♾️',
    description: '莫比乌斯无限循环双涡流光路，视觉张力极强',
    path: 'M 50 50 C 35 20, 10 20, 10 50 C 10 80, 35 80, 50 50 C 65 20, 90 20, 90 50 C 90 80, 65 80, 50 50 Z',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'hud_corner_brackets',
    name: '取景角标',
    category: 'cyber_hud',
    icon: '⌜',
    description: '四角开放式取景框，适合产品聚焦与界面高亮。',
    path: 'M 12 34 L 12 12 L 34 12 M 66 12 L 88 12 L 88 34 M 88 66 L 88 88 L 66 88 M 34 88 L 12 88 L 12 66',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 17,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'hud_data_connector',
    name: '数据连接线',
    category: 'cyber_hud',
    icon: '⌁',
    description: '双端节点的平滑连接线，适合信息关系与产品动线。',
    path: 'M 10 70 C 28 70 30 30 50 30 S 72 70 90 70',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 17,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'hud_orbit_arc',
    name: '双轨道弧',
    category: 'cyber_hud',
    icon: '◌',
    description: '两条开放轨道弧，适合环绕、扫描和空间感动效。',
    path: 'M 15 60 A 38 38 0 0 1 78 22 M 28 78 A 38 38 0 0 0 90 40',
    defaultCoreWidth: 0.85,
    defaultGlowSpread: 18,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'product_callout',
    name: '产品标注引线',
    category: 'laser_beam',
    icon: '↗',
    description: '带分叉箭头的开放标注线，适合突出产品特征。',
    path: 'M 12 78 L 35 55 L 66 55 M 66 55 L 78 43 M 66 55 L 78 67',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 16,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'scan_line',
    name: '精密扫描线',
    category: 'laser_beam',
    icon: '─',
    description: '克制的水平扫描光带，适合画面切换和信息扫描。',
    path: 'M 10 50 L 76 50 M 82 50 L 90 50',
    defaultCoreWidth: 0.8,
    defaultGlowSpread: 16,
    defaultGrowthMode: 'meteor-shoot',
  },
  {
    id: 'audio_pulse_line',
    name: '节律脉冲线',
    category: 'laser_beam',
    icon: '⌁',
    description: '清晰克制的节律脉冲，适合音频、科技和数据场景。',
    path: 'M 8 50 L 24 50 L 32 32 L 40 68 L 48 22 L 56 78 L 64 40 L 72 50 L 92 50',
    defaultCoreWidth: 0.85,
    defaultGlowSpread: 17,
    defaultGrowthMode: 'cycle-flow',
  },
];

// 2. Preset Saber Optical & Color Themes (High-Tech & Quiet Luxury Aesthetics)
export const SABER_STYLE_THEMES: SaberStyleTheme[] = [
  {
    id: 'luxury_champagne',
    name: '香槟钛金',
    subtitle: 'Champagne Titanium Luxury',
    glowColor: '#f3ca7e',
    secondaryGlowColor: '#925216',
    coreColor: '#fffff5',
    coreWidth: 1.0,
    glowIntensity: 1.4,
    glowSpread: 18,
    flickerIntensity: 1,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #f3ca7e 0%, #925216 100%)',
  },
  {
    id: 'cyber_cyan',
    name: '深空铂蓝',
    subtitle: 'Deep Space Platinum Cyan',
    glowColor: '#38bdf8',
    secondaryGlowColor: '#1e3a8a',
    coreColor: '#ffffff',
    coreWidth: 1.0,
    glowIntensity: 1.5,
    glowSpread: 18,
    flickerIntensity: 2,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #38bdf8 0%, #1e3a8a 100%)',
  },
  {
    id: 'emerald_matrix',
    name: '量子祖母绿',
    subtitle: 'Quantum Emerald Royale',
    glowColor: '#10b981',
    secondaryGlowColor: '#064e3b',
    coreColor: '#f0fdf4',
    coreWidth: 1.0,
    glowIntensity: 1.4,
    glowSpread: 17,
    flickerIntensity: 2,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
  },
  {
    id: 'rose_gold',
    name: '暮光玫瑰金',
    subtitle: 'Rose Gold Twilight Luxury',
    glowColor: '#fb7185',
    secondaryGlowColor: '#831843',
    coreColor: '#fff1f2',
    coreWidth: 1.1,
    glowIntensity: 1.5,
    glowSpread: 18,
    flickerIntensity: 2,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #fb7185 0%, #831843 100%)',
  },
  {
    id: 'ethereal_amethyst',
    name: '星云幻曜紫',
    subtitle: 'Amethyst Nebula Void',
    glowColor: '#c084fc',
    secondaryGlowColor: '#3b0764',
    coreColor: '#faf5ff',
    coreWidth: 1.0,
    glowIntensity: 1.6,
    glowSpread: 20,
    flickerIntensity: 3,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #c084fc 0%, #3b0764 100%)',
  },
  {
    id: 'diamond_white',
    name: '白钻透镜',
    subtitle: 'White Diamond Prism Laser',
    glowColor: '#e2e8f0',
    secondaryGlowColor: '#475569',
    coreColor: '#ffffff',
    coreWidth: 0.7,
    glowIntensity: 1.5,
    glowSpread: 18,
    flickerIntensity: 1,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #ffffff 0%, #64748b 100%)',
  },
  {
    id: 'molten_solar',
    name: '日冕金曜',
    subtitle: 'Solar Corona Amber Flare',
    glowColor: '#f59e0b',
    secondaryGlowColor: '#b91c1c',
    coreColor: '#fffbeb',
    coreWidth: 1.2,
    glowIntensity: 1.7,
    glowSpread: 20,
    flickerIntensity: 5,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #f59e0b 0%, #b91c1c 100%)',
  },
  {
    id: 'electric_arc',
    name: '高能电弧',
    subtitle: 'High Voltage Plasma Arc',
    glowColor: '#818cf8',
    secondaryGlowColor: '#3730a3',
    coreColor: '#eef2ff',
    coreWidth: 0.9,
    glowIntensity: 1.8,
    glowSpread: 22,
    flickerIntensity: 8,
    blendMode: 'screen',
    previewGradient: 'linear-gradient(135deg, #818cf8 0%, #3730a3 100%)',
  }
];

// Helper: Convert Bezier Pen Nodes to SVG path string
export function bezierNodesToSvgPath(nodes: BezierNode[], closed: boolean): string {
  if (!nodes || nodes.length === 0) return 'M 10 50 L 90 50';
  if (nodes.length === 1) return `M ${nodes[0].x.toFixed(2)} ${nodes[0].y.toFixed(2)}`;

  let d = `M ${nodes[0].x.toFixed(2)} ${nodes[0].y.toFixed(2)}`;

  for (let i = 0; i < nodes.length - 1; i++) {
    const curr = nodes[i];
    const next = nodes[i + 1];

    if (!curr.handleOut && !next.handleIn) {
      // Linear segment
      d += ` L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    } else {
      // Cubic Bezier segment
      const cp1 = curr.handleOut ? curr.handleOut : { x: curr.x, y: curr.y };
      const cp2 = next.handleIn ? next.handleIn : { x: next.x, y: next.y };
      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }
  }

  if (closed && nodes.length > 2) {
    const last = nodes[nodes.length - 1];
    const first = nodes[0];
    if (!last.handleOut && !first.handleIn) {
      d += ' Z';
    } else {
      const cp1 = last.handleOut ? last.handleOut : { x: last.x, y: last.y };
      const cp2 = first.handleIn ? first.handleIn : { x: first.x, y: first.y };
      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${first.x.toFixed(2)} ${first.y.toFixed(2)} Z`;
    }
  }

  return d;
}

/** Split an SVG path into independent subpaths without adding connector lines. */
export function splitSvgSubpaths(path: string): string[] {
  return path
    .split(/(?=[Mm])/)
    .map((part) => part.trim())
    .filter((part) => /^[Mm]\s*[-+]?\d/.test(part));
}

// Normalize drawn pen nodes into 0..100 bounding box with padding
export function normalizePenNodes(
  rawNodes: BezierNode[],
  closed: boolean,
  pad: number = 10
): {
  normalizedNodes: BezierNode[];
  path: string;
  bbox: { x: number; y: number; w: number; h: number };
} {
  if (!rawNodes || rawNodes.length === 0) {
    return {
      normalizedNodes: [{ x: 10, y: 50 }, { x: 90, y: 50 }],
      path: 'M 10 50 L 90 50',
      bbox: { x: 30, y: 45, w: 40, h: 10 },
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const checkPt = (pt: { x: number; y: number }) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  };

  for (const n of rawNodes) {
    checkPt({ x: n.x, y: n.y });
    if (n.handleIn) checkPt(n.handleIn);
    if (n.handleOut) checkPt(n.handleOut);
  }

  const rawW = Math.max(4, maxX - minX);
  const rawH = Math.max(4, maxY - minY);

  const availW = 100 - pad * 2;
  const availH = 100 - pad * 2;

  const normX = (xVal: number) => pad + ((xVal - minX) / rawW) * availW;
  const normY = (yVal: number) => pad + ((yVal - minY) / rawH) * availH;

  const normalizedNodes: BezierNode[] = rawNodes.map((n) => ({
    x: Number(normX(n.x).toFixed(2)),
    y: Number(normY(n.y).toFixed(2)),
    handleIn: n.handleIn
      ? {
          x: Number(normX(n.handleIn.x).toFixed(2)),
          y: Number(normY(n.handleIn.y).toFixed(2)),
        }
      : undefined,
    handleOut: n.handleOut
      ? {
          x: Number(normX(n.handleOut.x).toFixed(2)),
          y: Number(normY(n.handleOut.y).toFixed(2)),
        }
      : undefined,
  }));

  const path = bezierNodesToSvgPath(normalizedNodes, closed);

  return {
    normalizedNodes,
    path,
    bbox: {
      x: Number(Math.max(0, Math.min(95, minX)).toFixed(2)),
      y: Number(Math.max(0, Math.min(95, minY)).toFixed(2)),
      w: Number(Math.max(5, Math.min(100, rawW)).toFixed(2)),
      h: Number(Math.max(5, Math.min(100, rawH)).toFixed(2)),
    },
  };
}

// 3. Dynamic Growth & Offset Calculation for Canvas / Preview
export function calculateSaberMotion(
  el: SceneElement,
  currentTime: number
): {
  startPercent: number;  // 0 - 100
  endPercent: number;    // 0 - 100
  flickerAlpha: number;  // 0.7 - 1.3
  glowMultiplier: number;
} {
  const mode = el.saberGrowthMode || 'grow-in';
  const speed = el.saberGrowthSpeed ?? 1.0;
  const baseStart = el.saberStartOffset ?? 0;
  const baseEnd = el.saberEndOffset ?? 100;
  const flickerInt = (el.saberFlickerIntensity ?? 0) / 100;

  const startT = el.startTime || 0;
  const dur = Math.max(0.1, el.duration || 5);
  const relTime = Math.max(0, currentTime - startT);

  let startPercent = baseStart;
  let endPercent = baseEnd;

  // Growth Motion Modes
  if (mode === 'none') {
    startPercent = baseStart;
    endPercent = baseEnd;
  } else if (mode === 'grow-in') {
    // Laser grows smoothly from 0% to 100%
    const growProgress = Math.min(1, (relTime * speed) / Math.min(dur, 2.5));
    // Smooth cubic ease out
    const easeProgress = 1 - Math.pow(1 - growProgress, 3);
    startPercent = baseStart;
    endPercent = baseStart + (baseEnd - baseStart) * easeProgress;
  } else if (mode === 'cycle-flow') {
    // Light beam flows along path indefinitely like neon marquee
    const segmentLen = Math.max(15, baseEnd - baseStart);
    const loopDuration = 3.0 / Math.max(0.2, speed);
    const cycleProgress = (relTime % loopDuration) / loopDuration; // 0 to 1
    
    // Head moves from 0 to 100 + segmentLen
    const head = cycleProgress * (100 + segmentLen);
    const tail = head - segmentLen;
    startPercent = Math.max(0, Math.min(100, tail));
    endPercent = Math.max(0, Math.min(100, head));
  } else if (mode === 'pulse-grow') {
    // Breathes back and forth
    const cycle = Math.sin(relTime * speed * 2.5) * 0.5 + 0.5; // 0 to 1
    startPercent = baseStart * (1 - cycle * 0.3);
    endPercent = baseStart + (baseEnd - baseStart) * (0.2 + 0.8 * cycle);
  } else if (mode === 'meteor-shoot') {
    // High-speed meteor laser shot traversing the path
    const loopDuration = 2.0 / Math.max(0.2, speed);
    const progress = (relTime % loopDuration) / loopDuration;
    const trailLen = 30;
    const head = progress * (100 + trailLen);
    const tail = head - trailLen;
    startPercent = Math.max(0, Math.min(100, tail));
    endPercent = Math.max(0, Math.min(100, head));
  }

  // Calculate High-Frequency Saber Energy Turbulence & Flicker
  let flickerAlpha = 1.0;
  if (flickerInt > 0) {
    const noise = Math.sin(currentTime * 45) * 0.5 + Math.sin(currentTime * 110) * 0.3 + Math.cos(currentTime * 230) * 0.2;
    flickerAlpha = Math.max(0.5, Math.min(1.4, 1.0 + noise * flickerInt * 0.8));
  }

  // Intensity is applied once by the renderer. Applying it here as well squared
  // the perceived bloom and made normal presets look muddy.
  const glowMultiplier = flickerAlpha;

  return {
    startPercent: Math.max(0, Math.min(100, startPercent)),
    endPercent: Math.max(0, Math.min(100, endPercent)),
    flickerAlpha,
    glowMultiplier,
  };
}
