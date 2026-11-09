import { SaberStyleTheme, SABER_STYLE_THEMES } from './saberPresets';

/**
 * 科技·简约 视觉特效元素预设（VFX）
 * —— 借鉴 MetalForge 类 GPU 特效的观感（霓虹扫描 / 全息 / 能量 / 雷达 / 粒子流），
 * 用 SVG 路径 + 多层辉光 + 动态生长在现有渲染管线内实现。
 * 拖入画布即可使用（自带动态效果，无需额外配置）。
 */
export type VfxCategoryId = 'neon_scan' | 'hologram' | 'energy' | 'radar' | 'flow';

export interface VfxPresetItem {
  id: string;
  name: string;
  category: VfxCategoryId;
  icon: string;
  description: string;
  path: string; // SVG path 'd' 属性（基于 0 0 100 100 viewBox）
  defaultThemeId: string;      // 默认配色主题（引用 SABER_STYLE_THEMES）
  defaultCoreWidth?: number;
  defaultGlowSpread?: number;
  defaultGrowthMode?: 'none' | 'grow-in' | 'cycle-flow' | 'pulse-grow' | 'meteor-shoot';
}

export const VFX_CATEGORIES: { id: VfxCategoryId | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部特效', icon: '✨' },
  { id: 'neon_scan', label: '霓虹扫描', icon: '📡' },
  { id: 'hologram', label: '全息投影', icon: '🧊' },
  { id: 'energy', label: '能量核心', icon: '⚡' },
  { id: 'radar', label: '雷达准星', icon: '🎯' },
  { id: 'flow', label: '粒子数据流', icon: '〰️' },
];

// 科技·简约 特效预设库
export const VFX_PRESETS: VfxPresetItem[] = [
  // ===== 霓虹扫描（neon_scan）=====
  {
    id: 'vfx_scan_h',
    name: '霓虹横扫描',
    category: 'neon_scan',
    icon: '➖',
    description: '水平居中霓虹能量扫描线，简约利落的科技光标',
    path: 'M 5 50 L 95 50',
    defaultThemeId: 'cyber_cyan',
    defaultCoreWidth: 1.1,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'vfx_scan_v',
    name: '霓虹竖扫描',
    category: 'neon_scan',
    icon: '┃',
    description: '垂直霓虹能量扫描线，数据加密与安全扫描感',
    path: 'M 50 5 L 50 95',
    defaultThemeId: 'emerald_matrix',
    defaultCoreWidth: 1.1,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'vfx_scan_dual',
    name: '双轨平行扫描',
    category: 'neon_scan',
    icon: '≣',
    description: '上下双轨平行霓虹光带，动态流光穿梭',
    path: 'M 5 32 L 95 32 M 5 68 L 95 68',
    defaultThemeId: 'luxury_champagne',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'vfx_slash',
    name: '斜切流光条',
    category: 'neon_scan',
    icon: '╱',
    description: '三线斜切霓虹光条，电竞速度感与动势',
    path: 'M 22 78 L 78 22 M 36 92 L 92 36 M 8 64 L 64 8',
    defaultThemeId: 'molten_solar',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'cycle-flow',
  },

  // ===== 全息投影（hologram）=====
  {
    id: 'vfx_holo_grid',
    name: '全息透视网格',
    category: 'hologram',
    icon: '📐',
    description: '向纵深延伸的全息透视网格，空间定位感极强',
    path: 'M 12 88 L 88 88 M 12 88 L 50 12 M 88 88 L 50 12 M 28 88 L 50 12 M 72 88 L 50 12 M 12 88 L 24 58 M 88 88 L 76 58',
    defaultThemeId: 'ethereal_amethyst',
    defaultCoreWidth: 0.8,
    defaultGlowSpread: 24,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'vfx_holo_cube',
    name: '全息立方体',
    category: 'hologram',
    icon: '🧊',
    description: '透明全息立体方块线框，硬核三维透视结构',
    path: 'M 32 28 L 68 28 L 68 64 L 32 64 Z M 42 20 L 78 20 L 78 56 L 42 56 Z M 32 28 L 42 20 M 68 28 L 78 20 M 68 64 L 78 56 M 32 64 L 42 56',
    defaultThemeId: 'cyber_cyan',
    defaultCoreWidth: 0.8,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'grow-in',
  },
  {
    id: 'vfx_holo_frame',
    name: '全息定位角框',
    category: 'hologram',
    icon: '⌖',
    description: '四角全息取景框，AI 识别 / 目标锁定感',
    path: 'M 18 40 L 18 18 L 40 18 M 60 18 L 82 18 L 82 40 M 82 60 L 82 82 L 60 82 M 40 82 L 18 82 L 18 60',
    defaultThemeId: 'diamond_white',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'pulse-grow',
  },

  // ===== 能量核心（energy）=====
  {
    id: 'vfx_energy_rings',
    name: '能量脉冲环',
    category: 'energy',
    icon: '🎯',
    description: '三重同心能量脉冲环，核聚变与护盾充能感',
    path: 'M 50 14 A 36 36 0 1 1 49.99 14 Z M 50 26 A 24 24 0 1 1 49.99 26 Z M 50 36 A 14 14 0 1 1 49.99 36 Z',
    defaultThemeId: 'emerald_matrix',
    defaultCoreWidth: 0.8,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'vfx_energy_core',
    name: '能量核心枢纽',
    category: 'energy',
    icon: '🔆',
    description: '核心光球 + 四向射线 + 对角光柱，高能枢纽',
    path: 'M 50 38 A 12 12 0 1 1 49.99 38 Z M 50 6 L 50 26 M 50 74 L 50 94 M 6 50 L 26 50 M 74 50 L 94 50 M 19 19 L 33 33 M 67 67 L 81 81 M 19 81 L 33 67 M 67 33 L 81 19',
    defaultThemeId: 'molten_solar',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'vfx_energy_bolt',
    name: '电弧闪电',
    category: 'energy',
    icon: '⚡',
    description: '折线电弧高能闪电，高电压等离子感',
    path: 'M 58 12 L 34 52 L 50 52 L 40 88 L 72 40 L 54 40 Z',
    defaultThemeId: 'electric_arc',
    defaultCoreWidth: 1.2,
    defaultGlowSpread: 34,
    defaultGrowthMode: 'grow-in',
  },

  // ===== 雷达准星（radar）=====
  {
    id: 'vfx_radar_sweep',
    name: '雷达扇形扫描',
    category: 'radar',
    icon: '📡',
    description: '扇形雷达扫描弧面，雷达探测与信号追踪',
    path: 'M 50 50 L 50 12 A 38 38 0 0 1 88 50 Z',
    defaultThemeId: 'electric_arc',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'vfx_target',
    name: '十字瞄准框',
    category: 'radar',
    icon: '✛',
    description: '十字瞄准 + 双层准环，精确锁定目标感',
    path: 'M 50 10 L 50 34 M 50 66 L 50 90 M 10 50 L 34 50 M 66 50 L 90 50 M 50 36 A 14 14 0 1 1 49.99 36 Z M 50 44 A 6 6 0 1 1 49.99 44 Z',
    defaultThemeId: 'rose_gold',
    defaultCoreWidth: 0.9,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'pulse-grow',
  },
  {
    id: 'vfx_corner_target',
    name: '四角取景框',
    category: 'radar',
    icon: '▣',
    description: '四角开放取景边框，相机取景与构图辅助',
    path: 'M 20 40 L 20 20 L 40 20 M 80 20 L 60 20 M 80 60 L 80 80 L 60 80 M 20 80 L 40 80 M 20 60 L 20 40 M 80 40 L 80 60',
    defaultThemeId: 'diamond_white',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'grow-in',
  },

  // ===== 粒子数据流（flow）=====
  {
    id: 'vfx_flow_wave',
    name: '数据粒子流',
    category: 'flow',
    icon: '〰️',
    description: 'S 形流畅数据波，数据穿行与信号传输',
    path: 'M 8 65 Q 28 35 48 58 T 92 42',
    defaultThemeId: 'cyber_cyan',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 30,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'vfx_spectrum',
    name: '声波频谱',
    category: 'flow',
    icon: '📊',
    description: '高低起伏声波频谱柱，音乐律动与数据可视化',
    path: 'M 12 50 L 20 50 L 20 22 L 28 22 L 28 50 L 36 50 L 36 78 L 44 78 L 44 50 L 52 50 L 52 32 L 60 32 L 60 50 L 68 50 L 68 68 L 76 68 L 76 50 L 84 50 L 84 38 L 88 38',
    defaultThemeId: 'cyber_cyan',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 26,
    defaultGrowthMode: 'cycle-flow',
  },
  {
    id: 'vfx_sine',
    name: '正弦声波',
    category: 'flow',
    icon: '≈',
    description: '连续正弦光波，音频波形与光子振幅',
    path: 'M 8 50 Q 26 20 44 50 T 80 50 T 92 50',
    defaultThemeId: 'emerald_matrix',
    defaultCoreWidth: 1.0,
    defaultGlowSpread: 28,
    defaultGrowthMode: 'cycle-flow',
  },
];

// 主题选择：复用光剑同款科技配色主题
export { SABER_STYLE_THEMES };
export type { SaberStyleTheme };

// 便捷：按 id 取主题
export function getVfxTheme(themeId: string): SaberStyleTheme {
  return SABER_STYLE_THEMES.find((t) => t.id === themeId) || SABER_STYLE_THEMES[1];
}
