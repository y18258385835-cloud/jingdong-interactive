/**
 * 科技·简约 动效渲染引擎（VFX Motion · 动效库）
 * —— 借鉴 MetalForge 动效分类体系（Glass / Progress / Orbs / Loaders /
 *    Character / Gradient / Cards / Metal）与像素着色器动效精髓，
 * 用 Canvas 2D 逐像素 / 图形绘制实现"画面内容本身持续流动"的动态效果，
 * 支持鼠标交互（hover 跟随 / 扰动 / 波源 / 吸引），拖入画布即自动播放。
 */

export type VfxMotionId =
  // Progress 进度
  | 'progress-scan' // 流光进度条
  | 'progress-orbit'// 轨道进度
  | 'progress-threads' // 丝线进度（MetalForge Progress/Threads 1:1 复刻）
  | 'progress-liquid' // 液体进度（MetalForge Progress/Liquid 1:1 复刻）
  | 'progress-slosh'  // 晃动液体（MetalForge Progress/Slosh 1:1 复刻）
  | 'wallpaper-abyss' // 深渊壁纸（MetalForge Wallpaper/Abyss 1:1 复刻）
  | 'thinking-orbs-ribbon' // 思考彩带（MetalForge Thinking Orbs/Ribbon 1:1 复刻）
  | 'thinking-orbs-ping'  // 思考脉冲（MetalForge Thinking Orbs/Ping 1:1 复刻）
  | 'spinning-earth-metal' // 金属点阵地球（MetalForge Spinning Earth/Metal Dots 1:1 复刻）
  | 'glow-card'          // 发光卡片（MetalForge Glow 1:1 复刻）
  | 'abyss-grid'        // 深渊网格（MetalForge Abyss Grid 1:1 复刻）
  | 'filament'          // 丝状粒子（MetalForge Filament 1:1 复刻）
  | 'character-umbra'  // UMBRA 3D 角色（MetalForge Character/UMBRA 视觉复刻）
  // Orbs 光球
  | 'orbs'          // 漂浮光球
  | 'halo'          // 能量光环
  | 'particles'     // 粒子星尘
  | 'orb-metal'     // 金属光球（MetalForge orb-magenta 1:1 复刻）
  // Loaders 加载
  | 'rings'         // 雷达扫描
  | 'vortex'        // 能量漩涡
  | 'hyperspace'    // 超空间穿越
  | 'dotloader'     // 点阵呼吸
  | 'orbital'       // 星轨环绕
  | 'neonwave'      // 霓虹波形
  // Character 字符
  | 'datarain'      // 数字星尘
  | 'charflow'      // 激光数字流
  // Gradient 渐变
  | 'plasma'        // 等离子流
  | 'aurora'        // 极光光带
  | 'nebula'        // 深空星云
  | 'gradientflow'  // 流光渐变
  | 'iridescent'    // 镭射流光
  // Cards 卡片
  | 'cardscan'      // 卡片扫描
  | 'cardshine'     // 卡片光泽
  | 'card-depth-stack'
  | 'card-fan'
  | 'card-cylinder'
  | 'card-sphere'
  | 'card-spiral'
  | 'card-wave-grid'
  // Morphing content surfaces
  | 'morph-circle-pill'
  | 'morph-size'
  | 'morph-reverse-collapse';

export interface VfxMotionDef {
  id: VfxMotionId;
  name: string;
  category: string;
  icon: string;
  desc: string;
  colorA: string; // 主色
  colorB: string; // 副色
  colorC?: string; // 第三色（大气 / 中间色，可选，默认取 colorA）
  /** 可调参数定义（仿 MetalForge 右侧参数面板），属性面板据此渲染滑块 */
  params?: VfxParamDef[];
}

/** 单个动效的可调参数定义（MetalForge 风格参数面板） */
export interface VfxParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number | string;
  /** 参数类型：默认 range 数值滑块；'color' 为颜色选择器（hex） */
  type?: 'color';
  /** 参数分组（MetalForge 风格：MOTION / SHAPE / LIGHT / GRADE / EDGE / FINISH / COLOURS），
   *  面板按此分组渲染小标题；缺省归入「PARAMS」组 */
  group?: string;
}

/** 动效参数值集合（key → 数值或颜色 hex） */
export type VfxParams = Record<string, number | string>;

export interface VfxMotionConfig {
  colorA: string;
  colorB: string;
  colorC?: string; // 第三色（可选，默认取 colorA）
  speed: number; // 0.5 - 2
}

/** 鼠标交互状态（归一化坐标 0-1，active = 鼠标是否在元素内） */
export interface VfxMouse {
  x: number;
  y: number;
  active: boolean;
}

/** 动效分类（参照 MetalForge 分类体系） */
export const VFX_MOTION_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all', label: '全部动效', icon: '✨' },
  { id: 'progress', label: '进度 Progress', icon: '📊' },
  { id: 'orbs', label: '光球 Orbs', icon: '🔮' },
  { id: 'loaders', label: '加载 Loaders', icon: '⏳' },
  { id: 'char', label: '字符 Character', icon: '🔤' },
  { id: 'gradient', label: '渐变 Gradient', icon: '🌈' },
  { id: 'cards', label: '卡片 Cards', icon: '🃏' },
  { id: 'wallpaper', label: '壁纸 Wallpaper', icon: '🖼️' },
];

export const VFX_MOTIONS: VfxMotionDef[] = [
  // Card layouts keep fixed spatial compositions and only elevate the selected card.
  { id: 'card-depth-stack', name: '纵深叠排展开', category: 'cards', icon: '▰', desc: '叠牌纵深展开，选中卡片前移，其余层次保持稳定', colorA: '#38bdf8', colorB: '#8b5cf6', params: [{ key: 'spread', label: '展开幅度', min: 0.5, max: 2, step: 0.05, def: 1, group: 'LAYOUT' }, { key: 'depth', label: '纵深层次', min: 0, max: 1, step: 0.05, def: 0.65, group: 'LAYOUT' }] },
  { id: 'card-fan', name: '扇形展开', category: 'cards', icon: '◒', desc: '按固定角度形成扇形，选中卡片独立抬起', colorA: '#f59e0b', colorB: '#ec4899', params: [{ key: 'spread', label: '扇形角度', min: 0.5, max: 2, step: 0.05, def: 1, group: 'LAYOUT' }, { key: 'lift', label: '抬起高度', min: 0, max: 1, step: 0.05, def: 0.7, group: 'LAYOUT' }] },
  { id: 'card-cylinder', name: '圆柱环绕', category: 'cards', icon: '◉', desc: '沿圆柱环绕排列，保持正确的前后遮挡', colorA: '#22d3ee', colorB: '#14b8a6', params: [{ key: 'spread', label: '环绕半径', min: 0.5, max: 2, step: 0.05, def: 1, group: 'LAYOUT' }, { key: 'rotate', label: '自动转动', min: 0, max: 1, step: 0.05, def: 0.18, group: 'MOTION' }] },
  { id: 'card-sphere', name: '球面排布', category: 'cards', icon: '◌', desc: '沿球面分布，选中卡片前移而不放大整个球', colorA: '#60a5fa', colorB: '#a78bfa', params: [{ key: 'spread', label: '球面半径', min: 0.5, max: 2, step: 0.05, def: 1, group: 'LAYOUT' }, { key: 'rotate', label: '自动转动', min: 0, max: 1, step: 0.05, def: 0.12, group: 'MOTION' }] },
  { id: 'card-spiral', name: '螺旋排布', category: 'cards', icon: '◍', desc: '沿螺旋线分层排布，选中卡片单独迁移', colorA: '#f472b6', colorB: '#8b5cf6', params: [{ key: 'spread', label: '螺旋间距', min: 0.5, max: 2, step: 0.05, def: 1, group: 'LAYOUT' }, { key: 'rotate', label: '自动转动', min: 0, max: 1, step: 0.05, def: 0.12, group: 'MOTION' }] },
  { id: 'card-wave-grid', name: '波浪矩阵', category: 'cards', icon: '≈', desc: '矩阵逐卡传递连续波峰，避免整面网格同时摇动', colorA: '#34d399', colorB: '#22d3ee', params: [{ key: 'spread', label: '矩阵间距', min: 0.5, max: 2, step: 0.05, def: 1, group: 'LAYOUT' }, { key: 'wave', label: '波浪强度', min: 0, max: 1, step: 0.05, def: 0.55, group: 'MOTION' }] },
  // Content morphs: the shell keeps its identity while geometry and information reveal progressively.
  { id: 'morph-circle-pill', name: '圆点变胶囊', category: 'cards', icon: '●', desc: '圆点向两侧展开为可读胶囊，图标与文字按顺序出现', colorA: '#22d3ee', colorB: '#8b5cf6', params: [{ key: 'travel', label: '展开幅度', min: 0.7, max: 1.4, step: 0.05, def: 1, group: 'MORPH' }, { key: 'detail', label: '内容显现', min: 0, max: 1, step: 0.05, def: 1, group: 'MORPH' }] },
  { id: 'morph-size', name: '尺寸变形', category: 'cards', icon: '↘', desc: '从原位置向右下扩展，内部比例与锚点稳定并突出主要数值', colorA: '#60a5fa', colorB: '#a78bfa', params: [{ key: 'travel', label: '扩展幅度', min: 0.7, max: 1.4, step: 0.05, def: 1, group: 'MORPH' }, { key: 'detail', label: '数值显现', min: 0, max: 1, step: 0.05, def: 1, group: 'MORPH' }] },
  { id: 'morph-reverse-collapse', name: '反向收回', category: 'cards', icon: '↙', desc: '完成后沿原路径收回次要内容，保留完成标记回到圆点入口', colorA: '#34d399', colorB: '#38bdf8', params: [{ key: 'travel', label: '收回幅度', min: 0.7, max: 1.4, step: 0.05, def: 1, group: 'MORPH' }, { key: 'detail', label: '完成标记', min: 0, max: 1, step: 0.05, def: 1, group: 'MORPH' }] },
  // ===== Progress 进度 =====
  { id: 'progress-scan', name: '流光进度条', category: 'progress', icon: '📊', desc: '进度扫描前进 · 头部光斑', colorA: '#34d399', colorB: '#22d3ee' },
  { id: 'progress-orbit', name: '轨道进度', category: 'progress', icon: '💫', desc: '圆环轨道进度 · 光点游走', colorA: '#38bdf8', colorB: '#a5f3fc' },
  { id: 'progress-threads', name: '丝线进度', category: 'progress', icon: '🪢', desc: 'MetalForge Progress/Threads 1:1 复刻 · 丝线束随进度生长 · 前端光晕/尾部淡出/全局颗粒', colorA: '#FF5EB0', colorB: '#FFD9F2', colorC: '#4794FF',
    params: [
      // COLOURS 配色（原版 URL：background=#170F14 / color1=#290817 / color2=#FF5EB0 / color3=#FFD9F2 / color4=#4794FF / color5=#C7E6FF / color6=#0F3DB2 / color7=#4794FF）
      { key: 'background', label: '背景 Track', min: 0, max: 1, step: 1, def: '#170F14', type: 'color', group: 'COLOURS' },
      { key: 'color1', label: '深色 Deep', min: 0, max: 1, step: 1, def: '#290817', type: 'color', group: 'COLOURS' },
      { key: 'color2', label: '主色 Mid', min: 0, max: 1, step: 1, def: '#FF5EB0', type: 'color', group: 'COLOURS' },
      { key: 'color3', label: '辉光 Glow', min: 0, max: 1, step: 1, def: '#FFD9F2', type: 'color', group: 'COLOURS' },
      { key: 'color4', label: '蓝 Blue', min: 0, max: 1, step: 1, def: '#4794FF', type: 'color', group: 'COLOURS' },
      { key: 'color5', label: '浅蓝 Light Blue', min: 0, max: 1, step: 1, def: '#C7E6FF', type: 'color', group: 'COLOURS' },
      { key: 'color6', label: '深蓝 Deep Blue', min: 0, max: 1, step: 1, def: '#0F3DB2', type: 'color', group: 'COLOURS' },
      { key: 'color7', label: '蓝2 Blue2', min: 0, max: 1, step: 1, def: '#4794FF', type: 'color', group: 'COLOURS' },
      // PROGRESS 进度（URL: progress=60 / speed=1 全局）
      { key: 'progress', label: '进度', min: 0, max: 100, step: 1, def: 0, group: 'PROGRESS' },
      // MOTION 运动（URL: churn=1 / lag=0.55 / echo=0.055 / jitter=0.3）
      { key: 'churn', label: '翻腾', min: 0, max: 4, step: 0.05, def: 1, group: 'MOTION' },
      { key: 'lag', label: '滞后', min: 0, max: 1.5, step: 0.01, def: 0.55, group: 'MOTION' },
      { key: 'echo', label: '回声', min: 0, max: 0.5, step: 0.001, def: 0.055, group: 'MOTION' },
      { key: 'jitter', label: '抖动', min: 0, max: 1, step: 0.01, def: 0.3, group: 'MOTION' },
      // FRONT 前沿（URL: frontIn=-0.1 / frontOut=0.3 / feather=1 / falloff=1 / pulse=0.28 / pulseRate=3 / trails=3 / trailGlow=1）
      { key: 'fillStart', label: '起始端', min: -1, max: 0.4, step: 0.01, def: -0.1, group: 'FRONT' },
      { key: 'fillEnd', label: '结束端', min: 0, max: 1.5, step: 0.01, def: 0.3, group: 'FRONT' },
      { key: 'edge', label: '羽化', min: 0, max: 4, step: 0.05, def: 1, group: 'FRONT' },
      { key: 'falloff', label: '衰减', min: 0.2, max: 3, step: 0.05, def: 1, group: 'FRONT' },
      { key: 'pulse', label: '脉冲', min: 0, max: 1, step: 0.01, def: 0.28, group: 'FRONT' },
      { key: 'pulseRate', label: '脉冲速率', min: 0, max: 6, step: 0.1, def: 3, group: 'FRONT' },
      { key: 'trails', label: '尾迹数', min: 0, max: 8, step: 1, def: 3, group: 'FRONT' },
      { key: 'trailGlow', label: '尾迹辉光', min: 0, max: 2, step: 0.05, def: 1, group: 'FRONT' },
      // PATTERN 图案（URL: scale=64 / cellSize=1 / stagger=0.32 / amount=0.085 / density=1 / turbulence=1 / sparkle=1）
      { key: 'scale', label: '尺度', min: 8, max: 160, step: 1, def: 64, group: 'PATTERN' },
      { key: 'cellSize', label: '单元大小', min: 0.2, max: 2.5, step: 0.05, def: 1, group: 'PATTERN' },
      { key: 'stagger', label: '交错', min: 0, max: 1, step: 0.01, def: 0.32, group: 'PATTERN' },
      { key: 'amount', label: '数量', min: 0, max: 0.5, step: 0.001, def: 0.085, group: 'PATTERN' },
      { key: 'density', label: '密度', min: 0, max: 2, step: 0.05, def: 1, group: 'PATTERN' },
      { key: 'turbulence', label: '湍流', min: 0, max: 2, step: 0.05, def: 1, group: 'PATTERN' },
      { key: 'sparkle', label: '闪烁', min: 0, max: 2, step: 0.05, def: 1, group: 'PATTERN' },
      // FINISH 成片（URL: grain=0.01 / bloom=1 / ripple=1 / haze=1 / vignette=1）
      { key: 'grain', label: '颗粒', min: 0, max: 0.06, step: 0.001, def: 0.01, group: 'FINISH' },
      { key: 'bloom', label: '泛光', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      { key: 'ripple', label: '涟漪', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      { key: 'haze', label: '薄雾', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      { key: 'vignette', label: '暗角', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      // BAR 进度条（URL: aspect=3.6 / corner=0.144 / fill=1）
      { key: 'aspect', label: '宽高比', min: 1.5, max: 9, step: 0.1, def: 3.6, group: 'BAR' },
      { key: 'corner', label: '圆角', min: 0, max: 0.5, step: 0.005, def: 0.145, group: 'BAR' },
      { key: 'fill', label: '填充', min: 0, max: 1, step: 0.05, def: 1, group: 'BAR' },
    ] },
  { id: 'progress-liquid', name: '液体进度', category: 'progress', icon: '💧', desc: 'MetalForge Progress/Liquid 1:1 复刻 · 液体波束随进度生长 · 五层渐变/回声/薄雾/暗角', colorA: '#42B8FA', colorB: '#A3EDFF', colorC: '#4794FF',
    params: [
      // COLOURS 配色（原版 URL：background=#212124 / color1=#090B16 / color2=#0B194A / color3=#0E4FC7 / color4=#42B8FA / color5=#A3EDFF / color6=#1354C2 / color7=#338FE0）
      { key: 'background', label: '背景 Track', min: 0, max: 1, step: 1, def: '#212124', type: 'color', group: 'COLOURS' },
      { key: 'color1', label: '深色 Deep', min: 0, max: 1, step: 1, def: '#090B16', type: 'color', group: 'COLOURS' },
      { key: 'color2', label: '主色 Mid', min: 0, max: 1, step: 1, def: '#0B194A', type: 'color', group: 'COLOURS' },
      { key: 'color3', label: '辉光 Glow', min: 0, max: 1, step: 1, def: '#0E4FC7', type: 'color', group: 'COLOURS' },
      { key: 'color4', label: '蓝 Blue', min: 0, max: 1, step: 1, def: '#42B8FA', type: 'color', group: 'COLOURS' },
      { key: 'color5', label: '浅蓝 Light Blue', min: 0, max: 1, step: 1, def: '#A3EDFF', type: 'color', group: 'COLOURS' },
      { key: 'color6', label: '深蓝 Deep Blue', min: 0, max: 1, step: 1, def: '#1354C2', type: 'color', group: 'COLOURS' },
      { key: 'color7', label: '蓝2 Blue2', min: 0, max: 1, step: 1, def: '#338FE0', type: 'color', group: 'COLOURS' },
      // PROGRESS 进度（URL: progress=60 → 默认 0 无进度数据 / speed=1 全局）
      { key: 'progress', label: '进度', min: 0, max: 100, step: 1, def: 0, group: 'PROGRESS' },
      // MOTION 运动（URL: amount=0.085 / lag=0.55 / echo=0.055 / bloom=1 / jitter=0.3 / churn=1）
      { key: 'amount', label: '数量', min: 0, max: 0.5, step: 0.001, def: 0.085, group: 'MOTION' },
      { key: 'lag', label: '滞后', min: 0, max: 1.5, step: 0.01, def: 0.55, group: 'MOTION' },
      { key: 'echo', label: '回声', min: 0, max: 0.5, step: 0.001, def: 0.055, group: 'MOTION' },
      { key: 'bloom', label: '泛光', min: 0, max: 2, step: 0.05, def: 1, group: 'MOTION' },
      { key: 'jitter', label: '抖动', min: 0, max: 1, step: 0.01, def: 0.3, group: 'MOTION' },
      { key: 'churn', label: '翻腾', min: 0, max: 4, step: 0.05, def: 1, group: 'MOTION' },
      // FRONT 前沿（URL: frontIn=-0.12 / frontOut=0.12 / feather=1 / falloff=1 / trails=3 / trailGlow=1）
      { key: 'fillStart', label: '起始端', min: -1, max: 0.4, step: 0.01, def: -0.12, group: 'FRONT' },
      { key: 'fillEnd', label: '结束端', min: 0, max: 1.5, step: 0.01, def: 0.12, group: 'FRONT' },
      { key: 'edge', label: '羽化', min: 0, max: 4, step: 0.05, def: 1, group: 'FRONT' },
      { key: 'falloff', label: '衰减', min: 0.2, max: 3, step: 0.05, def: 1, group: 'FRONT' },
      { key: 'trails', label: '尾迹数', min: 0, max: 8, step: 1, def: 3, group: 'FRONT' },
      { key: 'trailGlow', label: '尾迹辉光', min: 0, max: 2, step: 0.05, def: 1, group: 'FRONT' },
      // PATTERN 图案（URL: scale=9.5 / ripple=1）
      { key: 'scale', label: '尺度', min: 1, max: 40, step: 0.5, def: 9.5, group: 'PATTERN' },
      { key: 'ripple', label: '涟漪', min: 0, max: 2, step: 0.05, def: 1, group: 'PATTERN' },
      // FINISH 成片（URL: grain=0.01 / haze=1 / vignette=1）
      { key: 'grain', label: '颗粒', min: 0, max: 0.06, step: 0.001, def: 0.01, group: 'FINISH' },
      { key: 'haze', label: '薄雾', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      { key: 'vignette', label: '暗角', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      // BAR 进度条（URL: aspect=3.6 / corner=0.144 / fill=1）
      { key: 'aspect', label: '宽高比', min: 1.5, max: 9, step: 0.1, def: 3.6, group: 'BAR' },
      { key: 'corner', label: '圆角', min: 0, max: 0.5, step: 0.005, def: 0.144, group: 'BAR' },
      { key: 'fill', label: '填充', min: 0, max: 1, step: 0.05, def: 1, group: 'BAR' },
    ] },
  { id: 'progress-slosh', name: '晃动液体', category: 'progress', icon: '🥤', desc: 'MetalForge Progress/Slosh 1:1 复刻 · 晃动液体随进度摇摆 · 五层渐变/回声/薄雾/暗角', colorA: '#4794FF', colorB: '#C7E6FF', colorC: '#0F3DB2',
    params: [
      // COLOURS 配色（原版 URL：background=#10131B / color1=#040819 / color2=#061645 / color3=#0F3DB2 / color4=#4794FF / color5=#C7E6FF / color6=#0F3DB2 / color7=#4794FF）
      { key: 'background', label: '背景 Track', min: 0, max: 1, step: 1, def: '#10131B', type: 'color', group: 'COLOURS' },
      { key: 'color1', label: '深色 Deep', min: 0, max: 1, step: 1, def: '#040819', type: 'color', group: 'COLOURS' },
      { key: 'color2', label: '主色 Mid', min: 0, max: 1, step: 1, def: '#061645', type: 'color', group: 'COLOURS' },
      { key: 'color3', label: '辉光 Glow', min: 0, max: 1, step: 1, def: '#0F3DB2', type: 'color', group: 'COLOURS' },
      { key: 'color4', label: '蓝 Blue', min: 0, max: 1, step: 1, def: '#4794FF', type: 'color', group: 'COLOURS' },
      { key: 'color5', label: '浅蓝 Light Blue', min: 0, max: 1, step: 1, def: '#C7E6FF', type: 'color', group: 'COLOURS' },
      { key: 'color6', label: '深蓝 Deep Blue', min: 0, max: 1, step: 1, def: '#0F3DB2', type: 'color', group: 'COLOURS' },
      { key: 'color7', label: '蓝2 Blue2', min: 0, max: 1, step: 1, def: '#4794FF', type: 'color', group: 'COLOURS' },
      // PROGRESS 进度（URL: progress=60 → 默认 0 无进度数据 / speed=1 全局）
      { key: 'progress', label: '进度', min: 0, max: 100, step: 1, def: 0, group: 'PROGRESS' },
      // MOTION 运动（URL: amount=0.135 / lag=1.4 / echo=0.082 / bloom=0.95 / jitter=0.3 / churn=1）
      { key: 'amount', label: '数量', min: 0, max: 0.5, step: 0.001, def: 0.135, group: 'MOTION' },
      { key: 'lag', label: '滞后', min: 0, max: 1.5, step: 0.01, def: 1.4, group: 'MOTION' },
      { key: 'echo', label: '回声', min: 0, max: 0.5, step: 0.001, def: 0.082, group: 'MOTION' },
      { key: 'bloom', label: '泛光', min: 0, max: 2, step: 0.05, def: 0.95, group: 'MOTION' },
      { key: 'jitter', label: '抖动', min: 0, max: 1, step: 0.01, def: 0.3, group: 'MOTION' },
      { key: 'churn', label: '翻腾', min: 0, max: 4, step: 0.05, def: 1, group: 'MOTION' },
      // FRONT 前沿（URL: frontIn=-0.12 / frontOut=0.12 / feather=1 / falloff=1 / trails=3 / trailGlow=1）
      { key: 'fillStart', label: '起始端', min: -1, max: 0.4, step: 0.01, def: -0.12, group: 'FRONT' },
      { key: 'fillEnd', label: '结束端', min: 0, max: 1.5, step: 0.01, def: 0.12, group: 'FRONT' },
      { key: 'edge', label: '羽化', min: 0, max: 4, step: 0.05, def: 1, group: 'FRONT' },
      { key: 'falloff', label: '衰减', min: 0.2, max: 3, step: 0.05, def: 1, group: 'FRONT' },
      { key: 'trails', label: '尾迹数', min: 0, max: 8, step: 1, def: 3, group: 'FRONT' },
      { key: 'trailGlow', label: '尾迹辉光', min: 0, max: 2, step: 0.05, def: 1, group: 'FRONT' },
      // PATTERN 图案（URL: scale=9.5 / ripple=1）
      { key: 'scale', label: '尺度', min: 1, max: 40, step: 0.5, def: 9.5, group: 'PATTERN' },
      { key: 'ripple', label: '涟漪', min: 0, max: 2, step: 0.05, def: 1, group: 'PATTERN' },
      // FINISH 成片（URL: grain=0.01 / haze=1 / vignette=1）
      { key: 'grain', label: '颗粒', min: 0, max: 0.06, step: 0.001, def: 0.01, group: 'FINISH' },
      { key: 'haze', label: '薄雾', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      { key: 'vignette', label: '暗角', min: 0, max: 2, step: 0.05, def: 1, group: 'FINISH' },
      // BAR 进度条（URL: aspect=3.6 / corner=0.144 / fill=1）
      { key: 'aspect', label: '宽高比', min: 1.5, max: 9, step: 0.1, def: 3.6, group: 'BAR' },
      { key: 'corner', label: '圆角', min: 0, max: 0.5, step: 0.005, def: 0.144, group: 'BAR' },
      { key: 'fill', label: '填充', min: 0, max: 1, step: 0.05, def: 1, group: 'BAR' },
    ] },
  // ===== Orbs 光球 =====
  { id: 'orbs', name: '漂浮光球', category: 'orbs', icon: '🔮', desc: '大小不一的漂浮光点 · 呼吸律动 · 无球体', colorA: '#a78bfa', colorB: '#f0abfc' },
  { id: 'halo', name: '能量光环', category: 'orbs', icon: '💠', desc: '多层旋转流光环 · 环绕粒子', colorA: '#f0abfc', colorB: '#818cf8' },
  { id: 'particles', name: '粒子星尘', category: 'orbs', icon: '✨', desc: '星尘连线 · 光点网格 · 鼠标吸引', colorA: '#e0f2fe', colorB: '#22d3ee' },
  { id: 'orb-metal', name: '金属光球', category: 'orbs', icon: '🪩', desc: 'MetalForge orb-magenta 1:1 复刻 · 大理石金属质感 · 折射/边缘光/内发光', colorA: '#F25AED', colorB: '#FFFFFF', colorC: '#512F7F',
    params: [
      // MOTION 运动（URL: speed=1 / flow=0.3 / turbulence=0.15 / shimmer=0.1 / wobble=0）
      { key: 'flow', label: '纹理流动', min: 0, max: 1.5, step: 0.01, def: 0.3, group: 'MOTION' },
      { key: 'turbulence', label: '扰动', min: 0, max: 1, step: 0.01, def: 0.15, group: 'MOTION' },
      { key: 'shimmer', label: '微光闪烁', min: 0, max: 1, step: 0.01, def: 0.1, group: 'MOTION' },
      { key: 'wobble', label: '摇摆', min: 0, max: 0.6, step: 0.01, def: 0, group: 'MOTION' },
      // SHAPE 形状（URL: radius=0.86 / scale=1.35 / marble=1.7 / refraction=0.55 / seed=0）
      { key: 'radius', label: '球半径', min: 0.4, max: 1.2, step: 0.01, def: 0.86, group: 'SHAPE' },
      { key: 'scale', label: '整体缩放', min: 0.6, max: 2.2, step: 0.01, def: 1.35, group: 'SHAPE' },
      { key: 'marble', label: '大理石纹', min: 0, max: 3, step: 0.01, def: 1.7, group: 'SHAPE' },
      { key: 'refraction', label: '折射', min: 0, max: 1.2, step: 0.01, def: 0.55, group: 'SHAPE' },
      { key: 'seed', label: '随机种子', min: 0, max: 10, step: 1, def: 0, group: 'SHAPE' },
      // LIGHT 光照（URL: light=(-0.62,-0.78) / rim=0.9 / glint=0.5 / innerGlow=0.55 / halo=0）
      { key: 'rim', label: '边缘光', min: 0, max: 2, step: 0.01, def: 0.9, group: 'LIGHT' },
      { key: 'glint', label: '高光', min: 0, max: 2, step: 0.01, def: 0.5, group: 'LIGHT' },
      { key: 'innerGlow', label: '内发光', min: 0, max: 2, step: 0.01, def: 0.55, group: 'LIGHT' },
      { key: 'halo', label: '光晕', min: 0, max: 1.5, step: 0.01, def: 0, group: 'LIGHT' },
      // GRADE 分级（URL: contrast=1.25 / bias=-0.04 / fringe=0.8 / iridescence=0）
      { key: 'contrast', label: '对比度', min: 0.5, max: 2.5, step: 0.01, def: 1.25, group: 'GRADE' },
      { key: 'bias', label: '亮度偏移', min: -0.5, max: 0.5, step: 0.01, def: -0.04, group: 'GRADE' },
      { key: 'fringe', label: '色差', min: 0, max: 2, step: 0.01, def: 0.8, group: 'GRADE' },
      { key: 'iridescence', label: '虹彩', min: 0, max: 1.2, step: 0.01, def: 0, group: 'GRADE' },
      // EDGE / 成片（URL: edgeSoftness=0.005 / edgeGlow=0 / grain=1 / exposure=1）
      { key: 'edgeSoftness', label: '边缘羽化', min: 0, max: 0.05, step: 0.001, def: 0.005, group: 'EDGE' },
      { key: 'edgeGlow', label: '边缘辉光', min: 0, max: 1, step: 0.01, def: 0, group: 'EDGE' },
      { key: 'grain', label: '颗粒', min: 0, max: 1.5, step: 0.01, def: 1, group: 'EDGE' },
      { key: 'exposure', label: '曝光', min: 0.5, max: 2.5, step: 0.01, def: 1, group: 'EDGE' },
    ] },
  // ===== Loaders 加载 =====
  { id: 'rings', name: '雷达扫描', category: 'loaders', icon: '📡', desc: '扩散环 + 旋转扫描扇区 · 从鼠标处脉冲', colorA: '#34d399', colorB: '#0ea5e9' },
  { id: 'vortex', name: '能量漩涡', category: 'loaders', icon: '🌪️', desc: '多螺旋旋转 · 中心内发光 · 跟随鼠标', colorA: '#22d3ee', colorB: '#6366f1' },
  { id: 'hyperspace', name: '超空间穿越', category: 'loaders', icon: '🛸', desc: '星线拉伸 · 发散中心跟随鼠标', colorA: '#38bdf8', colorB: '#e0f2fe' },
  { id: 'dotloader', name: '点阵呼吸', category: 'loaders', icon: '🎯', desc: '逐点呼吸点亮 · skeleton 加载风', colorA: '#34d399', colorB: '#fbbf24' },
  { id: 'orbital', name: '星轨环绕', category: 'loaders', icon: '🪐', desc: '多层椭圆星轨 · 光点环绕拖尾', colorA: '#38bdf8', colorB: '#e0f2fe' },
  { id: 'neonwave', name: '霓虹波形', category: 'loaders', icon: '〰️', desc: '流动正弦光带 · 光点波动', colorA: '#34d399', colorB: '#22d3ee' },
  // ===== Character 字符 =====
  { id: 'datarain', name: '数字星尘', category: 'char', icon: '🌧️', desc: '数字粒子 · 邻近连线网络 · 鼠标吸引', colorA: '#34d399', colorB: '#a7f3d0' },
  { id: 'charflow', name: '激光数字流', category: 'char', icon: '🔤', desc: '发散数字光束 · 粒子光带流动', colorA: '#22d3ee', colorB: '#e0f2fe' },
  // ===== Gradient 渐变 =====
  { id: 'plasma', name: '等离子流', category: 'gradient', icon: '🌀', desc: 'fbm 涡旋等离子 · 三色映射 · 鼠标扰动', colorA: '#22d3ee', colorB: '#a855f7' },
  { id: 'aurora', name: '极光光带', category: 'gradient', icon: '🌈', desc: '多层极光光带 · 光斑粒子 · 鼠标起伏', colorA: '#34d399', colorB: '#818cf8' },
  { id: 'nebula', name: '深空星云', category: 'gradient', icon: '🌌', desc: '多层 fbm 星云 · 旋转层 · 鼠标光斑', colorA: '#a78bfa', colorB: '#0ea5e9' },
  { id: 'gradientflow', name: '流光渐变', category: 'gradient', icon: '🌈', desc: '多彩渐变流动 · 极简光影', colorA: '#22d3ee', colorB: '#a855f7' },
  { id: 'iridescent', name: '镭射流光', category: 'gradient', icon: '💿', desc: '彩虹镭射渐变 · 色相流动 · 鼠标扰动', colorA: '#ec4899', colorB: '#22d3ee' },
  // ===== Cards 卡片 =====
  { id: 'cardscan', name: '卡片扫描', category: 'cards', icon: '🃏', desc: '卡片轮廓 · 扫描线往复', colorA: '#22d3ee', colorB: '#a5f3fc' },
  // ===== Wallpaper 壁纸 =====
  { id: 'wallpaper-abyss', name: '深渊壁纸', category: 'wallpaper', icon: '🖼️', desc: 'MetalForge Wallpaper/Abyss 1:1 复刻 · fbm 域扭曲深渊纹理 · Bloom/Flow 双模式/暗角/电影颗粒（整幅壁纸）', colorA: '#1E5CFF', colorB: '#3FD8FF', colorC: '#EEF1F6',
    params: [
      // COLORS 5 色（原版 URL：color1=#04051A / color2=#08195E / color3=#1E5CFF / color4=#3FD8FF / color5=#EEF1F6）
      { key: 'color1', label: '深渊 Deep', min: 0, max: 1, step: 1, def: '#04051A', type: 'color', group: 'COLORS' },
      { key: 'color2', label: '靛蓝 Indigo', min: 0, max: 1, step: 1, def: '#08195E', type: 'color', group: 'COLORS' },
      { key: 'color3', label: '主蓝 Main', min: 0, max: 1, step: 1, def: '#1E5CFF', type: 'color', group: 'COLORS' },
      { key: 'color4', label: '天青 Cyan', min: 0, max: 1, step: 1, def: '#3FD8FF', type: 'color', group: 'COLORS' },
      { key: 'color5', label: '高光 Hi', min: 0, max: 1, step: 1, def: '#EEF1F6', type: 'color', group: 'COLORS' },
      // DOMAIN 域（URL: scale=1.15 / warp=2.6 / seed=27 / rotation=20 / lift=0.04 / softness=0.5）
      { key: 'scale', label: '尺度', min: 0.5, max: 3, step: 0.05, def: 1.15, group: 'DOMAIN' },
      { key: 'warp', label: '扭曲', min: 0, max: 6, step: 0.1, def: 2.6, group: 'DOMAIN' },
      { key: 'seed', label: '种子', min: 0, max: 100, step: 1, def: 27, group: 'DOMAIN' },
      { key: 'rotation', label: '旋转', min: -180, max: 180, step: 1, def: 20, group: 'DOMAIN' },
      { key: 'lift', label: '抬升', min: -0.3, max: 0.3, step: 0.01, def: 0.04, group: 'DOMAIN' },
      { key: 'softness', label: '柔化', min: 0, max: 1, step: 0.05, def: 0.5, group: 'DOMAIN' },
      // MODE 模式（URL: mode=bloom / bands=1 / contrast=1.35；0=bloom 1=flow）
      { key: 'mode', label: '模式', min: 0, max: 1, step: 1, def: 0, group: 'MODE' },
      { key: 'bands', label: '波段', min: 1, max: 8, step: 1, def: 1, group: 'MODE' },
      { key: 'contrast', label: '对比度', min: 0.2, max: 3, step: 0.05, def: 1.35, group: 'MODE' },
      // FILM 成片（URL: grain=0.5 / vignette=0.85 / aSpeed=1 / aAmount=0.05 / aWaves=6 / animate=wave）
      { key: 'grain', label: '颗粒', min: 0, max: 1, step: 0.05, def: 0.5, group: 'FILM' },
      { key: 'vignette', label: '暗角', min: 0, max: 1, step: 0.05, def: 0.85, group: 'FILM' },
      { key: 'aSpeed', label: '流速', min: 0, max: 3, step: 0.05, def: 1, group: 'FILM' },
      { key: 'aAmount', label: '波幅', min: 0, max: 0.3, step: 0.01, def: 0.05, group: 'FILM' },
      { key: 'aWaves', label: '波数', min: 1, max: 20, step: 1, def: 6, group: 'FILM' },
      { key: 'animate', label: '动画', min: 0, max: 1, step: 1, def: 1, group: 'FILM' },
    ] },
  // ===== Orbs · Thinking 思考光点 =====
  { id: 'thinking-orbs-ribbon', name: '思考彩带', category: 'orbs', icon: '🧠', desc: 'MetalForge Thinking Orbs/Ribbon 1:1 复刻 · 双行光点波浪彩带 · 3D 透视/深度淡出/pill 胶囊', colorA: '#E8853C', colorB: '#F4F1EA', colorC: '#1B1B1D',
    params: [
      // ORBS 光点（URL: dots=1 / spread=1 / dotScale=1 / perspective=1 / depthSize=1 / depthFade=1 / opacity=1）
      { key: 'dots', label: '点数', min: 0.4, max: 2.5, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'spread', label: '间距', min: 0.4, max: 2.5, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'dotScale', label: '点大小', min: 0.3, max: 3, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'perspective', label: '透视', min: 0, max: 2, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'depthSize', label: '深度量', min: 0, max: 2, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'depthFade', label: '深度淡出', min: 0, max: 2, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'opacity', label: '不透明度', min: 0, max: 1, step: 0.05, def: 1, group: 'ORBS' },
      // MOTION 运动（URL: speed=1 / reverse=0 / phase=0 / spin=0 / yaw=0 / pitch=0）
      { key: 'reverse', label: '反向', min: 0, max: 1, step: 1, def: 0, group: 'MOTION' },
      { key: 'phase', label: '相位', min: 0, max: 6.28, step: 0.1, def: 0, group: 'MOTION' },
      { key: 'spin', label: '自旋', min: 0, max: 6.28, step: 0.1, def: 0, group: 'MOTION' },
      { key: 'yaw', label: '偏航', min: -90, max: 90, step: 1, def: 0, group: 'MOTION' },
      { key: 'pitch', label: '俯仰', min: -90, max: 90, step: 1, def: 0, group: 'MOTION' },
      // PILL 胶囊（URL: showsPill=1 / showsLabel=1 / labelScale=1 / pillPad=1 / pillGap=1）
      { key: 'showsPill', label: '胶囊背景', min: 0, max: 1, step: 1, def: 1, group: 'PILL' },
      { key: 'showsLabel', label: '文字标签', min: 0, max: 1, step: 1, def: 1, group: 'PILL' },
      { key: 'labelScale', label: '文字大小', min: 0.4, max: 2.5, step: 0.05, def: 1, group: 'PILL' },
      { key: 'pillPad', label: '胶囊留白', min: 0.2, max: 3, step: 0.05, def: 1, group: 'PILL' },
      { key: 'pillGap', label: '胶囊间距', min: 0.2, max: 3, step: 0.05, def: 1, group: 'PILL' },
      // COLORS 配色（URL：accent=#E8853C / dotColor=#F4F1EA / pill=#1B1B1D / labelColor=#F4F1EA + 亮色主题）
      { key: 'accent', label: '强调色 Accent', min: 0, max: 1, step: 1, def: '#E8853C', type: 'color', group: 'COLORS' },
      { key: 'dotColor', label: '光点 Dot', min: 0, max: 1, step: 1, def: '#F4F1EA', type: 'color', group: 'COLORS' },
      { key: 'pill', label: '胶囊 Pill', min: 0, max: 1, step: 1, def: '#1B1B1D', type: 'color', group: 'COLORS' },
      { key: 'labelColor', label: '文字 Label', min: 0, max: 1, step: 1, def: '#F4F1EA', type: 'color', group: 'COLORS' },
      { key: 'dotColorLight', label: '光点(亮) Dot Light', min: 0, max: 1, step: 1, def: '#25242A', type: 'color', group: 'COLORS' },
      { key: 'pillLight', label: '胶囊(亮) Pill Light', min: 0, max: 1, step: 1, def: '#ECECEF', type: 'color', group: 'COLORS' },
      { key: 'labelColorLight', label: '文字(亮) Label Light', min: 0, max: 1, step: 1, def: '#25242A', type: 'color', group: 'COLORS' },
    ] },
  { id: 'thinking-orbs-ping', name: '思考脉冲', category: 'orbs', icon: '💭', desc: 'MetalForge Thinking Orbs/Ping 1:1 复刻 · 单行光点波浪 + 周期脉冲环 · pill 胶囊', colorA: '#E8853C', colorB: '#F4F1EA', colorC: '#1B1B1D',
    params: [
      { key: 'dots', label: '点数', min: 0.4, max: 2.5, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'spread', label: '间距', min: 0.4, max: 2.5, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'dotScale', label: '点大小', min: 0.3, max: 3, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'perspective', label: '透视', min: 0, max: 2, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'depthSize', label: '深度量', min: 0, max: 2, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'depthFade', label: '深度淡出', min: 0, max: 2, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'opacity', label: '不透明度', min: 0, max: 1, step: 0.05, def: 1, group: 'ORBS' },
      { key: 'reverse', label: '反向', min: 0, max: 1, step: 1, def: 0, group: 'MOTION' },
      { key: 'phase', label: '相位', min: 0, max: 6.28, step: 0.1, def: 0, group: 'MOTION' },
      { key: 'spin', label: '自旋', min: 0, max: 6.28, step: 0.1, def: 0, group: 'MOTION' },
      { key: 'yaw', label: '偏航', min: -90, max: 90, step: 1, def: 0, group: 'MOTION' },
      { key: 'pitch', label: '俯仰', min: -90, max: 90, step: 1, def: 0, group: 'MOTION' },
      { key: 'showsPill', label: '胶囊背景', min: 0, max: 1, step: 1, def: 1, group: 'PILL' },
      { key: 'showsLabel', label: '文字标签', min: 0, max: 1, step: 1, def: 1, group: 'PILL' },
      { key: 'labelScale', label: '文字大小', min: 0.4, max: 2.5, step: 0.05, def: 1, group: 'PILL' },
      { key: 'pillPad', label: '胶囊留白', min: 0.2, max: 3, step: 0.05, def: 1, group: 'PILL' },
      { key: 'pillGap', label: '胶囊间距', min: 0.2, max: 3, step: 0.05, def: 1, group: 'PILL' },
      { key: 'accent', label: '强调色 Accent', min: 0, max: 1, step: 1, def: '#E8853C', type: 'color', group: 'COLORS' },
      { key: 'dotColor', label: '光点 Dot', min: 0, max: 1, step: 1, def: '#F4F1EA', type: 'color', group: 'COLORS' },
      { key: 'pill', label: '胶囊 Pill', min: 0, max: 1, step: 1, def: '#1B1B1D', type: 'color', group: 'COLORS' },
      { key: 'labelColor', label: '文字 Label', min: 0, max: 1, step: 1, def: '#F4F1EA', type: 'color', group: 'COLORS' },
      { key: 'dotColorLight', label: '光点(亮) Dot Light', min: 0, max: 1, step: 1, def: '#25242A', type: 'color', group: 'COLORS' },
      { key: 'pillLight', label: '胶囊(亮) Pill Light', min: 0, max: 1, step: 1, def: '#ECECEF', type: 'color', group: 'COLORS' },
      { key: 'labelColorLight', label: '文字(亮) Label Light', min: 0, max: 1, step: 1, def: '#25242A', type: 'color', group: 'COLORS' },
    ] },
  { id: 'spinning-earth-metal', name: '金属点阵地球', category: 'orbs', icon: '🌍', desc: 'MetalForge Spinning Earth/Metal Dots 1:1 复刻 · 经纬点阵光球 · 大陆/海洋金属光照/大气光晕', colorA: '#D1DBF0', colorB: '#576685', colorC: '#739EFF',
    params: [
      // COLORS 配色（原版 URL：landColor=#D1DBF0 / oceanColor=#576685 / atmosphere=#739EFF / sweepColor=#1AFF59 / gridColor=#0F6B29 / contourLow=#000000 / contourHigh=#FFFFFF）
      { key: 'landColor', label: '陆地 Land', min: 0, max: 1, step: 1, def: '#D1DBF0', type: 'color', group: 'COLORS' },
      { key: 'oceanColor', label: '海洋 Ocean', min: 0, max: 1, step: 1, def: '#576685', type: 'color', group: 'COLORS' },
      { key: 'atmosphere', label: '大气 Atmosphere', min: 0, max: 1, step: 1, def: '#739EFF', type: 'color', group: 'COLORS' },
      { key: 'sweepColor', label: '扫描 Sweep', min: 0, max: 1, step: 1, def: '#1AFF59', type: 'color', group: 'COLORS' },
      { key: 'gridColor', label: '网格 Grid', min: 0, max: 1, step: 1, def: '#0F6B29', type: 'color', group: 'COLORS' },
      { key: 'contourLow', label: '低区 Contour Low', min: 0, max: 1, step: 1, def: '#000000', type: 'color', group: 'COLORS' },
      { key: 'contourHigh', label: '高区 Contour High', min: 0, max: 1, step: 1, def: '#FFFFFF', type: 'color', group: 'COLORS' },
      // GLOBE 球体（URL: speed=0.3 / tilt=0.41 / globeSize=0.41 / detail=74 / dotSize=0.12 / offsetY=0）
      { key: 'speed', label: '转速', min: 0, max: 2, step: 0.05, def: 0.3, group: 'GLOBE' },
      { key: 'tilt', label: '倾斜', min: -1, max: 1, step: 0.01, def: 0.41, group: 'GLOBE' },
      { key: 'globeSize', label: '地球大小', min: 0.3, max: 0.65, step: 0.01, def: 0.41, group: 'GLOBE' },
      { key: 'detail', label: '细节', min: 30, max: 160, step: 1, def: 74, group: 'GLOBE' },
      { key: 'dotSize', label: '点大小', min: 0.04, max: 0.4, step: 0.01, def: 0.12, group: 'GLOBE' },
      { key: 'offsetY', label: '垂直偏移', min: -1, max: 1, step: 0.01, def: 0, group: 'GLOBE' },
      // SWEEP 扫描（URL: sweepSpeed=1.05 / contourBands=7）
      { key: 'sweepSpeed', label: '扫描速度', min: 0, max: 4, step: 0.05, def: 1.05, group: 'SWEEP' },
      { key: 'contourBands', label: '等高带', min: 1, max: 16, step: 1, def: 7, group: 'SWEEP' },
    ] },
  { id: 'glow-card', name: '发光卡片', category: 'orbs', icon: '✨', desc: 'MetalForge Glow 1:1 复刻 · 圆角发光卡片 · 四层内发光带(rim/mid/deep/top) + 轨道光斑 + 颗粒', colorA: '#FFFFFF', colorB: '#6994FF', colorC: '#144CCD',
    params: [
      // COLORS 配色（URL：bgTop=#0A0909 / bgBottom=#09101F / rimColor=#FFFFFF / midColor=#6994FF / deepColor=#144CCD / topColor=#2365FF / shadowColor=#144CCD）
      { key: 'bgTop', label: '背景顶 Bg Top', min: 0, max: 1, step: 1, def: '#0A0909', type: 'color', group: 'COLORS' },
      { key: 'bgBottom', label: '背景底 Bg Bottom', min: 0, max: 1, step: 1, def: '#09101F', type: 'color', group: 'COLORS' },
      { key: 'rimColor', label: '外缘 Rim', min: 0, max: 1, step: 1, def: '#FFFFFF', type: 'color', group: 'COLORS' },
      { key: 'midColor', label: '中带 Mid', min: 0, max: 1, step: 1, def: '#6994FF', type: 'color', group: 'COLORS' },
      { key: 'deepColor', label: '深带 Deep', min: 0, max: 1, step: 1, def: '#144CCD', type: 'color', group: 'COLORS' },
      { key: 'topColor', label: '顶带 Top', min: 0, max: 1, step: 1, def: '#2365FF', type: 'color', group: 'COLORS' },
      { key: 'shadowColor', label: '阴影光 Shadow', min: 0, max: 1, step: 1, def: '#144CCD', type: 'color', group: 'COLORS' },
      // LIGHT 光与动画（URL：anim=orbit / animAmount=0.42 / animShape=0 / speed=1 / light=0.5,1 / intensity=1 / radius=40）
      { key: 'anim', label: '动画模式', min: 0, max: 5, step: 1, def: 0, group: 'LIGHT' },
      { key: 'animAmount', label: '动画幅度', min: 0, max: 1.5, step: 0.01, def: 0.42, group: 'LIGHT' },
      { key: 'animShape', label: '动画形态', min: 0, max: 1, step: 0.01, def: 0, group: 'LIGHT' },
      { key: 'speed', label: '速度', min: 0, max: 4, step: 0.05, def: 1, group: 'LIGHT' },
      { key: 'lightX', label: '光源 X', min: 0, max: 1, step: 0.01, def: 0.5, group: 'LIGHT' },
      { key: 'lightY', label: '光源 Y', min: 0, max: 1, step: 0.01, def: 1, group: 'LIGHT' },
      { key: 'intensity', label: '强度', min: 0, max: 2, step: 0.05, def: 1, group: 'LIGHT' },
      { key: 'radius', label: '圆角半径', min: 0, max: 100, step: 1, def: 40, group: 'LIGHT' },
      // BANDS 光带（URL：rimSize=18 / midSize=34 / deepSize=74 / topSize=6）
      { key: 'rimSize', label: '外缘宽度', min: 0, max: 80, step: 1, def: 18, group: 'BANDS' },
      { key: 'midSize', label: '中带宽度', min: 0, max: 120, step: 1, def: 34, group: 'BANDS' },
      { key: 'deepSize', label: '深带宽度', min: 0, max: 160, step: 1, def: 74, group: 'BANDS' },
      { key: 'topSize', label: '顶带宽度', min: 0, max: 80, step: 1, def: 6, group: 'BANDS' },
      // CARD 卡片与颗粒（URL：card=0.86,0.52 / grainAmt=0.15 / shadowAmt=0.1）
      { key: 'cardX', label: '卡片宽', min: 0.02, max: 1, step: 0.01, def: 0.86, group: 'CARD' },
      { key: 'cardY', label: '卡片高', min: 0.02, max: 1, step: 0.01, def: 0.52, group: 'CARD' },
      { key: 'grainAmt', label: '颗粒', min: 0, max: 1, step: 0.01, def: 0.15, group: 'CARD' },
      { key: 'shadowAmt', label: '阴影光量', min: 0, max: 1, step: 0.01, def: 0.1, group: 'CARD' },
    ] },
  { id: 'abyss-grid', name: '深渊网格', category: 'wall', icon: '🔮', desc: 'MetalForge Abyss Grid 1:1 复刻 · 4x4 网格 16 色渐变 + fbm 流场 + drift 漂移 + film 胶片滤镜', colorA: '#1E5BFD', colorB: '#96E4FB', colorC: '#2D95FF',
    params: [
      // GRID 网格（URL：grid=4 / style=abyss / smooth=1 / anim=drift / animate=1 / speed=1 / drift=0.45 / hue=0 / fixEdges=1）
      { key: 'grid', label: '网格数', min: 2, max: 8, step: 1, def: 4, group: 'GRID' },
      { key: 'smooth', label: '平滑插值', min: 0, max: 1, step: 1, def: 1, group: 'GRID' },
      { key: 'fixEdges', label: '固定边缘', min: 0, max: 1, step: 1, def: 1, group: 'GRID' },
      { key: 'animate', label: '动画', min: 0, max: 1, step: 1, def: 1, group: 'GRID' },
      { key: 'speed', label: '速度', min: 0, max: 4, step: 0.05, def: 1, group: 'GRID' },
      { key: 'drift', label: '漂移', min: 0, max: 2, step: 0.01, def: 0.45, group: 'GRID' },
      { key: 'hue', label: '色相', min: -180, max: 180, step: 1, def: 0, group: 'GRID' },
      // COLOURS 16 色（URL c00..c33）
      { key: 'c00', label: 'C00', min: 0, max: 1, step: 1, def: '#04051A', type: 'color', group: 'COLOURS' },
      { key: 'c01', label: 'C01', min: 0, max: 1, step: 1, def: '#081757', type: 'color', group: 'COLOURS' },
      { key: 'c02', label: 'C02', min: 0, max: 1, step: 1, def: '#1E5BFD', type: 'color', group: 'COLOURS' },
      { key: 'c03', label: 'C03', min: 0, max: 1, step: 1, def: '#050824', type: 'color', group: 'COLOURS' },
      { key: 'c10', label: 'C10', min: 0, max: 1, step: 1, def: '#143EB6', type: 'color', group: 'COLOURS' },
      { key: 'c11', label: 'C11', min: 0, max: 1, step: 1, def: '#D3EDF7', type: 'color', group: 'COLOURS' },
      { key: 'c12', label: 'C12', min: 0, max: 1, step: 1, def: '#071654', type: 'color', group: 'COLOURS' },
      { key: 'c13', label: 'C13', min: 0, max: 1, step: 1, def: '#1D59F8', type: 'color', group: 'COLOURS' },
      { key: 'c20', label: 'C20', min: 0, max: 1, step: 1, def: '#060E3A', type: 'color', group: 'COLOURS' },
      { key: 'c21', label: 'C21', min: 0, max: 1, step: 1, def: '#1237A7', type: 'color', group: 'COLOURS' },
      { key: 'c22', label: 'C22', min: 0, max: 1, step: 1, def: '#96E4FB', type: 'color', group: 'COLOURS' },
      { key: 'c23', label: 'C23', min: 0, max: 1, step: 1, def: '#071551', type: 'color', group: 'COLOURS' },
      { key: 'c30', label: 'C30', min: 0, max: 1, step: 1, def: '#2D95FF', type: 'color', group: 'COLOURS' },
      { key: 'c31', label: 'C31', min: 0, max: 1, step: 1, def: '#060D35', type: 'color', group: 'COLOURS' },
      { key: 'c32', label: 'C32', min: 0, max: 1, step: 1, def: '#103198', type: 'color', group: 'COLOURS' },
      { key: 'c33', label: 'C33', min: 0, max: 1, step: 1, def: '#5ADCFE', type: 'color', group: 'COLOURS' },
      // FILM 胶片（URL：filter=film / fBlur=8 / fFade=0.85 / fAmount=0.65 / fSoft=0.5 / fBrightness=0 / fContrast=1 / fSaturation=1 / fGrain=0.5 / fAngle=20 / fScale=1.15 / fInset=0.08 / fRound=0.45 / fBevel=0.3）
      { key: 'filter', label: '滤镜', min: 0, max: 5, step: 1, def: 0, group: 'FILM' },
      { key: 'fAmount', label: '滤镜强度', min: 0, max: 2, step: 0.01, def: 0.65, group: 'FILM' },
      { key: 'fBlur', label: '模糊', min: 0, max: 30, step: 0.5, def: 8, group: 'FILM' },
      { key: 'fFade', label: '淡出', min: 0, max: 2, step: 0.01, def: 0.85, group: 'FILM' },
      { key: 'fSoft', label: '柔化', min: 0, max: 2, step: 0.01, def: 0.5, group: 'FILM' },
      { key: 'fBrightness', label: '亮度', min: -1, max: 1, step: 0.01, def: 0, group: 'FILM' },
      { key: 'fContrast', label: '对比度', min: 0, max: 2, step: 0.01, def: 1, group: 'FILM' },
      { key: 'fSaturation', label: '饱和度', min: 0, max: 2, step: 0.01, def: 1, group: 'FILM' },
      { key: 'fGrain', label: '颗粒', min: 0, max: 2, step: 0.01, def: 0.5, group: 'FILM' },
      { key: 'fAngle', label: '角度', min: 0, max: 360, step: 1, def: 20, group: 'FILM' },
      { key: 'fScale', label: '缩放', min: 0.2, max: 3, step: 0.01, def: 1.15, group: 'FILM' },
      { key: 'fInset', label: '内缩', min: 0, max: 0.5, step: 0.01, def: 0.08, group: 'FILM' },
      { key: 'fRound', label: '圆角', min: 0, max: 1, step: 0.01, def: 0.45, group: 'FILM' },
      { key: 'fBevel', label: '斜面', min: 0, max: 1, step: 0.01, def: 0.3, group: 'FILM' },
    ] },
  { id: 'character-umbra', name: 'UMBRA角色', category: 'character', icon: '😶', desc: 'MetalForge Character/UMBRA 视觉复刻 · 3D 角色 · 体态/姿势/材质/光照/眼睛 · 暂停图标+双眼 · 透明通道',
    colorA: '#17191C', colorB: '#F5F6F4', colorC: '#FFFFFF',
    params: [
      // THE BODY 体态
      { key: 'size', label: '体型', min: 0.3, max: 2, step: 0.01, def: 1, group: 'THE BODY' },
      { key: 'width', label: '宽度', min: 0.3, max: 2, step: 0.01, def: 1, group: 'THE BODY' },
      { key: 'height', label: '高度', min: 0.3, max: 2, step: 0.01, def: 1, group: 'THE BODY' },
      { key: 'depth', label: '厚度', min: 0.3, max: 2, step: 0.01, def: 1, group: 'THE BODY' },
      // POSE 姿势
      { key: 'turn', label: '转向', min: -90, max: 90, step: 1, def: 0, group: 'POSE' },
      { key: 'tilt', label: '倾斜', min: -90, max: 90, step: 1, def: 0, group: 'POSE' },
      { key: 'lean', label: '偏转', min: -45, max: 45, step: 1, def: 0, group: 'POSE' },
      { key: 'perspective', label: '透视', min: 0, max: 3, step: 0.05, def: 1, group: 'POSE' },
      // SURFACE 材质
      { key: 'matSurface', label: '材质', min: 0, max: 4, step: 1, def: 0, group: 'SURFACE' },
      { key: 'bodyColor', label: '身体色', min: 0, max: 1, step: 0.01, def: '#17191C', type: 'color', group: 'SURFACE' },
      { key: 'lightColor', label: '高光色', min: 0, max: 1, step: 0.01, def: '#FFFFFF', type: 'color', group: 'SURFACE' },
      { key: 'shadowColor', label: '阴影色', min: 0, max: 1, step: 0.01, def: '#000000', type: 'color', group: 'SURFACE' },
      { key: 'lightX', label: '光照X', min: -1, max: 1, step: 0.01, def: -0.2, group: 'SURFACE' },
      { key: 'lightY', label: '光照Y', min: -1, max: 1, step: 0.01, def: -0.26, group: 'SURFACE' },
      { key: 'shine', label: '光泽', min: 0, max: 1, step: 0.01, def: 0.2, group: 'SURFACE' },
      { key: 'shadow', label: '阴影', min: 0, max: 1, step: 0.01, def: 0.06, group: 'SURFACE' },
      { key: 'spread', label: '扩散', min: 0.2, max: 2, step: 0.01, def: 1, group: 'SURFACE' },
      { key: 'gloss', label: '高光', min: 0, max: 1, step: 0.01, def: 0, group: 'SURFACE' },
      { key: 'rim', label: '边缘光', min: 0, max: 1, step: 0.01, def: 0, group: 'SURFACE' },
      // EYES 眼睛
      { key: 'eyeWidth', label: '眼宽', min: 0.3, max: 2, step: 0.01, def: 1, group: 'EYES' },
      { key: 'eyeHeight', label: '眼高', min: 0.3, max: 2, step: 0.01, def: 1, group: 'EYES' },
      { key: 'eyeSpacing', label: '眼距', min: 0.3, max: 2, step: 0.01, def: 1, group: 'EYES' },
      { key: 'eyeRaise', label: '眼高', min: -0.4, max: 0.4, step: 0.01, def: 0, group: 'EYES' },
      { key: 'eyeAngle', label: '眼角', min: -90, max: 90, step: 1, def: 0, group: 'EYES' },
      { key: 'eyeColor', label: '眼色', min: 0, max: 1, step: 0.01, def: '#F5F6F4', type: 'color', group: 'EYES' },
      // MOTION 动作
      { key: 'speed', label: '速度', min: 0, max: 4, step: 0.05, def: 1, group: 'MOTION' },
      { key: 'liveliness', label: '活泼度', min: 0, max: 2, step: 0.01, def: 1, group: 'MOTION' },
      { key: 'blinkRate', label: '眨眼频率', min: 0.2, max: 3, step: 0.01, def: 1, group: 'MOTION' },
    ],
  },
  { id: 'filament', name: '丝状粒子', category: 'wall', icon: '🌌', desc: 'MetalForge Filament 1:1 复刻 · 涡旋丝状粒子流 · swirl/friction/trail 拖尾 · cool-hot-spark 三色', colorA: '#12308F', colorB: '#66E6FF', colorC: '#FFBD57',
    params: [
      // MOTION 运动（URL：speed=1 / swirl=34 / friction=0.25 / trail=0.94 / fade=0.3）
      { key: 'speed', label: '速度', min: 0, max: 4, step: 0.05, def: 1, group: 'MOTION' },
      { key: 'swirl', label: '涡旋', min: 0, max: 120, step: 1, def: 34, group: 'MOTION' },
      { key: 'friction', label: '摩擦', min: 0, max: 1, step: 0.01, def: 0.25, group: 'MOTION' },
      { key: 'trail', label: '拖尾', min: 0, max: 1, step: 0.01, def: 0.94, group: 'MOTION' },
      { key: 'fade', label: '淡出', min: 0, max: 1, step: 0.01, def: 0.3, group: 'MOTION' },
      // LIGHT 光照（URL：size=2 / brightness=0.36 / exposure=1.5 / vignette=0.45 / bloom=1 / glow=0.5 / cutoff=0.35）
      { key: 'size', label: '粒子大小', min: 0.3, max: 8, step: 0.1, def: 2, group: 'LIGHT' },
      { key: 'brightness', label: '亮度', min: 0, max: 2, step: 0.01, def: 0.36, group: 'LIGHT' },
      { key: 'exposure', label: '曝光', min: 0, max: 3, step: 0.05, def: 1.5, group: 'LIGHT' },
      { key: 'vignette', label: '暗角', min: 0, max: 1, step: 0.01, def: 0.45, group: 'LIGHT' },
      { key: 'bloom', label: '泛光', min: 0, max: 2, step: 0.05, def: 1, group: 'LIGHT' },
      { key: 'glow', label: '辉光', min: 0, max: 2, step: 0.01, def: 0.5, group: 'LIGHT' },
      { key: 'cutoff', label: '截止', min: 0, max: 1, step: 0.01, def: 0.35, group: 'LIGHT' },
      // COLORS 配色（URL：cool=#12308F / hot=#66E6FF / spark=#FFBD57）
      { key: 'cool', label: '冷色 Cool', min: 0, max: 1, step: 1, def: '#12308F', type: 'color', group: 'COLORS' },
      { key: 'hot', label: '热色 Hot', min: 0, max: 1, step: 1, def: '#66E6FF', type: 'color', group: 'COLORS' },
      { key: 'spark', label: '星火 Spark', min: 0, max: 1, step: 1, def: '#FFBD57', type: 'color', group: 'COLORS' },
    ] },
];

export function getVfxMotion(id: string): VfxMotionDef {
  return VFX_MOTIONS.find((m) => m.id === id) || VFX_MOTIONS[0];
}

/* ===================== 预设配色主题（仿 MetalForge + 用户偏好） ===================== */
export interface VfxColorTheme {
  id: string;
  name: string;
  desc: string;
  colorA: string; // 主色
  colorB: string; // 副色
  colorC?: string; // 第三色（大气 / 中间色）
}

export const VFX_COLOR_THEMES: VfxColorTheme[] = [
  { id: 'orb-magenta', name: '金属洋红', desc: 'MetalForge orb-magenta 官方 · 洋红大理石 / 白亮纹 / 虹彩紫', colorA: '#F25AED', colorB: '#FFFFFF', colorC: '#512F7F' },
  { id: 'metal-earth', name: '点阵地球', desc: 'MetalForge 官方 · 淡蓝陆地/蓝灰海洋/蓝大气', colorA: '#D1DBF0', colorB: '#576685', colorC: '#739EFF' },
  { id: 'sweep-green', name: '霓虹扫描绿', desc: 'MetalForge 扫描霓虹 · 荧光绿脉冲', colorA: '#1AFF59', colorB: '#0F6B29', colorC: '#739EFF' },
  { id: 'prism-ink', name: '紫蓝红水墨', desc: '三色晕染流体 · 紫→蓝→粉红', colorA: '#8b5cf6', colorB: '#3b82f6', colorC: '#ec4899' },
  { id: 'aurora-teal', name: '极光蓝绿', desc: '蓝绿山水渐变 · 翡翠与湖蓝', colorA: '#34d399', colorB: '#0ea5e9', colorC: '#22d3ee' },
  { id: 'neon-cyan', name: '霓虹青紫', desc: '经典科技风 · 青色主光 + 紫色副光', colorA: '#22d3ee', colorB: '#a855f7', colorC: '#38bdf8' },
  { id: 'molten-solar', name: '熔岩橙', desc: '炽热能量 · 橙红到焦褐', colorA: '#fb923c', colorB: '#7c2d12', colorC: '#fbbf24' },
  { id: 'rose-gold', name: '玫瑰金', desc: '高端轻奢 · 粉金到玫红', colorA: '#f9a8d4', colorB: '#be185d', colorC: '#fbcfe8' },
  { id: 'metal-silver', name: '液态金属银', desc: '镜面金属 · 银白到石墨', colorA: '#e2e8f0', colorB: '#475569', colorC: '#94a3b8' },
  { id: 'matrix-green', name: '矩阵绿', desc: '数字雨 · 荧光绿到暗苔', colorA: '#34d399', colorB: '#052e16', colorC: '#a7f3d0' },
  { id: 'cosmic', name: '深空星云', desc: '宇宙星云 · 紫罗兰到星蓝', colorA: '#a78bfa', colorB: '#0ea5e9', colorC: '#f0abfc' },
];

/* ===================== 颜色工具 ===================== */
export interface RGB { r: number; g: number; b: number; }
export function hexToRgb(hex: string): RGB {
  let h = (hex || '#22d3ee').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return { r: 34, g: 211, b: 238 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgba(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, a))})`;
}
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(Math.min(k, 4 - k), 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}

/* ===================== 确定性伪随机 ===================== */
export function hash01(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ===================== 逐像素 shader 渲染器 ===================== */
interface OffscreenBuffer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
  data: Uint8ClampedArray;
}

const offscreenBuffers = new Map<string, OffscreenBuffer>();

function getOffscreenBuffer(key: string, width: number, height: number): OffscreenBuffer | null {
  if (typeof document === 'undefined') return null;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  let buf = offscreenBuffers.get(key);
  if (!buf) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    buf = { canvas, ctx, img, data: img.data };
    offscreenBuffers.set(key, buf);
  } else if (buf.canvas.width !== w || buf.canvas.height !== h) {
    buf.canvas.width = w;
    buf.canvas.height = h;
    buf.img = buf.ctx.createImageData(w, h);
    buf.data = buf.img.data;
  }
  return buf;
}

function renderPixels(
  img: ImageData,
  fn: (x: number, y: number, u: number, v: number, t: number, mx: number, my: number, mAct: number) => { r: number; g: number; b: number; a: number },
  mouse: VfxMouse | null
): void {
  const data = img.data;
  const w = img.width, h = img.height;
  const mx = mouse ? mouse.x : -1;
  const my = mouse ? mouse.y : -1;
  const mAct = mouse && mouse.active ? 1 : 0;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const i = (y * w + x) * 4;
      const c = fn(x, y, u, v, 0, mx, my, mAct);
      data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = c.a;
    }
  }
}

/* ===================== 各动效实现 ===================== */

/* —— 逐像素流体类 —— */

function drawPlasma(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null, cC: RGB) {
  const bw = Math.min(96, Math.max(2, Math.round(w)));
  const bh = Math.min(96, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('plasma', bw, bh);
  if (!buf) return;
  const img = buf.img;
  const tt = t * speed;
  renderPixels(img, (x, y, u, v) => {
    const px = u * 16, py = v * 16;
    // 涡旋扭曲 + 多层噪声（fbm 风）
    const ang = Math.atan2(py - 8, px - 8);
    const rad = Math.hypot(px - 8, py - 8);
    let val = Math.sin(px * 0.9 + tt * 1.6)
      + Math.sin(py * 0.7 - tt * 1.2 + Math.sin(px * 0.4 + tt * 0.5) * 1.7)
      + Math.sin((px + py) * 0.5 + ang * 2.2 + tt * 0.7)
      + Math.sin(rad * 0.8 - tt * 1.4);
    if (mouse && mouse.active) {
      const md = Math.hypot(u - mouse.x, v - mouse.y);
      val += 1.8 * Math.sin(md * 9 - tt * 5) * Math.exp(-md * 3.0);
    }
    const n = (Math.sin(val * Math.PI) + 1) / 2;
    // 四段映射：暗→cB→cA→cC→白（第三色 cC 作为中间过渡，默认取 cA 时与两段等价）
    let rr: number, gg: number, bb: number;
    if (n < 0.5) {
      const k = n * 2;
      rr = mix(cB.r, cA.r, k); gg = mix(cB.g, cA.g, k); bb = mix(cB.b, cA.b, k);
    } else if (n < 0.75) {
      const k2 = (n - 0.5) * 4;
      rr = mix(cA.r, cC.r, k2); gg = mix(cA.g, cC.g, k2); bb = mix(cA.b, cC.b, k2);
    } else {
      const k3 = (n - 0.75) * 4;
      rr = mix(cC.r, 255, k3); gg = mix(cC.g, 255, k3); bb = mix(cC.b, 255, k3);
    }
    return { r: rr, g: gg, b: bb, a: Math.min(255, n * 255 * 1.6) };
  }, mouse);
  buf.ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf.canvas, 0, 0, bw, bh, 0, 0, w, h);
}

function drawNebula(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  const bw = Math.min(96, Math.max(2, Math.round(w)));
  const bh = Math.min(96, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('nebula', bw, bh);
  if (!buf) return;
  const img = buf.img;
  const tt = t * speed;
  renderPixels(img, (x, y, u, v) => {
    const px = u * 14, py = v * 14;
    // 3 层 fbm 星云（含旋转层）
    const ang = Math.atan2(py - 7, px - 7);
    const rad = Math.hypot(px - 7, py - 7);
    let f = Math.sin(px * 1.1 + tt * 0.8) * 0.5 + Math.sin(py * 1.3 - tt * 0.6) * 0.5
      + Math.sin((px + py) * 0.9 + ang * 1.4 + tt * 0.5) * 0.4
      + Math.sin(rad * 0.7 - tt * 0.9) * 0.45
      + Math.sin(px * 0.35 - py * 0.42 + tt * 0.32) * 0.35;
    if (mouse && mouse.active) {
      const md = Math.hypot(u - mouse.x, v - mouse.y);
      f += 0.55 * (0.5 + 0.5 * Math.sin(tt * 2.2)) * Math.exp(-md * 5);
    }
    const n = Math.max(0, Math.min(1, f * 0.5 + 0.5));
    // 暗处透明显层次，亮处浓
    const a = Math.min(1, Math.pow(n, 1.4) * 1.25);
    return {
      r: mix(cB.r * 0.5, cA.r, n), g: mix(cB.g * 0.5, cA.g, n), b: mix(cB.b * 0.5, cA.b, n),
      a: a * 255,
    };
  }, mouse);
  buf.ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf.canvas, 0, 0, bw, bh, 0, 0, w, h);
}

/* —— 图形绘制类 —— */

function drawProgressScan(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = w / 2;
  const barW = w * 0.76, barH = Math.max(4, h * 0.12);
  const bx = cx - barW / 2, by = h / 2 - barH / 2;
  const ph = (tt * 0.45) % 1.15; // 前进到 115% 后循环
  const fill = Math.min(1, ph) * barW;
  // 底槽
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(bx, by, barW, barH, barH / 2);
  ctx.fill();
  // 填充（渐变）
  const fg = ctx.createLinearGradient(bx, 0, bx + barW, 0);
  fg.addColorStop(0, rgba(cB, 0.9));
  fg.addColorStop(1, rgba(cA, 0.95));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.roundRect(bx, by, Math.max(0, fill), barH, barH / 2);
  ctx.fill();
  // 头部光斑
  if (ph < 1) {
    const hx = bx + fill;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(hx, by + barH / 2, 0, hx, by + barH / 2, barH * 2);
    sg.addColorStop(0, 'rgba(255,255,255,0.85)');
    sg.addColorStop(0.3, rgba(cA, 0.4));
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(hx - barH * 2, by - barH * 1.5, barH * 4, barH * 4);
    ctx.restore();
  }
  // 百分比文字
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `bold ${Math.max(9, barH * 0.8)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(Math.min(1, ph) * 100)}%`, cx, by + barH * 2.1);
}

function drawProgressOrbit(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.3;
  const ph = (tt * 0.4) % 1;
  ctx.save();
  // 轨道
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(2, R * 0.09);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  // 进度弧
  const pg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  pg.addColorStop(0, rgba(cB, 0.9));
  pg.addColorStop(1, rgba(cA, 0.95));
  ctx.strokeStyle = pg;
  ctx.lineWidth = Math.max(2.5, R * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + ph * Math.PI * 2);
  ctx.stroke();
  // 光点游走
  const ang = -Math.PI / 2 + ph * Math.PI * 2;
  const px = cx + Math.cos(ang) * R, py = cy + Math.sin(ang) * R;
  ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(px, py, 0, px, py, R * 0.5);
  sg.addColorStop(0, 'rgba(255,255,255,0.9)');
  sg.addColorStop(0.35, rgba(cA, 0.4));
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(px - R * 0.5, py - R * 0.5, R, R);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(px, py, Math.max(2, R * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOrbs(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const mx = mouse && mouse.active ? mouse.x * w : -1;
  const my = mouse && mouse.active ? mouse.y * h : -1;
  // 固定大小分布：大小不一（小、中、大错落）
  const SIZE_K = [0.3, 0.65, 0.42, 1, 0.52, 0.8, 0.26, 0.6, 0.9, 0.38, 0.72, 0.48];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    let ox = (hash01(i * 1.3) * w + Math.sin(tt * 0.3 + i * 1.7) * w * 0.14 + w) % w;
    let oy = (hash01(i * 2.7) * h + Math.cos(tt * 0.26 + i * 0.8) * h * 0.14 + h) % h;
    if (mouse && mouse.active) {
      const dx = mx - ox, dy = my - oy;
      const d = Math.hypot(dx, dy);
      if (d < Math.max(w, h) * 0.5) {
        const pull = 0.06 * (1 - d / (Math.max(w, h) * 0.5));
        ox += dx * pull; oy += dy * pull;
      }
    }
    const k = SIZE_K[i % SIZE_K.length];
    // 大小不一的漂浮光点：小点几乎纯光点，大点呈柔和光斑；无球体轮廓、无白色高光
    const R = Math.min(w, h) * 0.13 * k * (0.7 + 0.3 * Math.sin(tt * (0.6 + i * 0.15) + i * 2.1));
    const c = i % 2 === 0 ? cA : cB;
    const alpha = 0.28 + 0.3 * Math.abs(Math.sin(tt * (0.8 + i * 0.2) + i * 1.3));
    // 柔和径向光斑（核心亮、边缘渐隐，无硬边球体）
    const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
    halo.addColorStop(0, rgba(c, Math.min(0.9, alpha)));
    halo.addColorStop(0.5, rgba(c, alpha * 0.45));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(ox - R, oy - R, R * 2, R * 2);
  }
  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  const R = Math.min(w, h) * 0.44;
  const br = 0.82 + 0.18 * Math.sin(tt * 1.4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 中心仅留极淡辉光（取消发光球体，环为主体）
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.65);
  core.addColorStop(0, rgba(cA, 0.07));
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(cx - R * 0.65, cy - R * 0.65, R * 1.3, R * 1.3);
  // 多层旋转流光环
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const start = tt * (0.7 + i * 0.25) + i * 2.1;
    const end = start + Math.PI * (0.9 + 0.25 * Math.sin(tt * 1.1 + i));
    ctx.arc(cx, cy, R * (1 + i * 0.22), start, end);
    const col = i % 2 === 0 ? cA : cB;
    const lg = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    lg.addColorStop(0, rgba(col, 0.05));
    lg.addColorStop(0.5, rgba(col, 0.85 * br));
    lg.addColorStop(1, rgba(col, 0.05));
    ctx.strokeStyle = lg;
    ctx.lineWidth = Math.max(1.5, R * 0.055 * (1 - i * 0.18));
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 环绕粒子（大小随呼吸变化）
  for (let i = 0; i < 10; i++) {
    const a = tt * (0.5 + i * 0.08) + i * 0.628;
    const pr = R * (1.15 + 0.5 * Math.sin(tt * 0.6 + i * 1.7));
    const px = cx + Math.cos(a) * pr, py = cy + Math.sin(a) * pr;
    const sz = Math.max(1, R * (0.022 + 0.03 * Math.abs(Math.sin(tt * 1.3 + i * 2.5))));
    ctx.fillStyle = rgba(i % 2 === 0 ? cA : cB, 0.8);
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const mx = mouse && mouse.active ? mouse.x * w : -9999;
  const my = mouse && mouse.active ? mouse.y * h : -9999;
  const N = 46;
  const pts: { x: number; y: number; s: number; a: number }[] = [];
  for (let i = 0; i < N; i++) {
    const px = (hash01(i * 1.7) * w + Math.sin(tt * 0.25 + i * 1.3) * w * 0.05 + w) % w;
    const py = (hash01(i * 2.3) * h + Math.cos(tt * 0.3 + i * 0.9) * h * 0.06 + h) % h;
    const s = 0.8 + hash01(i * 3.1) * 2.2;
    const a = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(tt * 1.2 + i * 2.1));
    pts.push({ x: px, y: py, s, a });
  }
  ctx.save();
  // 连线（邻近粒子）
  const lineDist = Math.max(w, h) * 0.16;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
      const d = Math.hypot(dx, dy);
      if (d < lineDist) {
        const alpha = (1 - d / lineDist) * 0.28;
        ctx.strokeStyle = rgba(i % 3 === 0 ? cB : cA, alpha);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
  }
  // 粒子本体 + 鼠标吸引
  for (let i = 0; i < N; i++) {
    let { x: px, y: py, s, a } = pts[i];
    if (mouse && mouse.active) {
      const dx = mx - px, dy = my - py;
      const d = Math.hypot(dx, dy);
      if (d < Math.max(w, h) * 0.5) {
        const pull = 0.14 * (1 - d / (Math.max(w, h) * 0.5));
        px += dx * pull; py += dy * pull;
      }
    }
    // 光晕
    const glow = ctx.createRadialGradient(px, py, 0, px, py, s * 3);
    glow.addColorStop(0, rgba(i % 3 === 0 ? cB : cA, a * 0.8));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - s * 3, py - s * 3, s * 6, s * 6);
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, a);
    ctx.beginPath();
    ctx.arc(px, py, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRings(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  const maxR = Math.max(w, h) * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 扩散环
  for (let i = 0; i < 5; i++) {
    const ph = (tt * 0.5 + i / 5) % 1;
    const r = ph * maxR;
    const a = (1 - ph);
    ctx.strokeStyle = i % 2 === 0 ? rgba(cA, a * 0.9) : rgba(cB, a * 0.7);
    ctx.lineWidth = 1.5 + (1 - ph) * 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
    ctx.stroke();
  }
  // 旋转扫描扇区（雷达）
  const scanAng = tt * 0.9;
  const sector = ctx.createConicGradient ? ctx.createConicGradient(scanAng, cx, cy) : null;
  if (sector) {
    sector.addColorStop(0, 'rgba(255,255,255,0.001)');
    sector.addColorStop(0.06, rgba(cA, 0.5));
    sector.addColorStop(0.2, 'rgba(255,255,255,0.001)');
    sector.addColorStop(1, 'rgba(255,255,255,0.001)');
    ctx.fillStyle = sector;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  // 扫描端点光点
  const epx = cx + Math.cos(scanAng) * maxR;
  const epy = cy + Math.sin(scanAng) * maxR;
  const eg = ctx.createRadialGradient(epx, epy, 0, epx, epy, maxR * 0.06);
  eg.addColorStop(0, 'rgba(255,255,255,0.95)');
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eg;
  ctx.fillRect(epx - maxR * 0.06, epy - maxR * 0.06, maxR * 0.12, maxR * 0.12);
  ctx.restore();
}

function drawVortex(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 中心内发光
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.2);
  cg.addColorStop(0, 'rgba(255,255,255,0.6)');
  cg.addColorStop(0.4, rgba(cA, 0.3));
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(cx - Math.min(w, h) * 0.2, cy - Math.min(w, h) * 0.2, Math.min(w, h) * 0.4, Math.min(w, h) * 0.4);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6.5; a += 0.12) {
      const rad = a * (Math.min(w, h) / 26) + tt * (14 + i * 9);
      const x = cx + Math.cos(a + tt * 0.7 + i * 2.1) * rad;
      const y = cy + Math.sin(a + tt * 0.7 + i * 2.1) * rad;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, rgba(cA, 0.8));
    g.addColorStop(1, rgba(cB, 0.08));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHyperspace(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  const maxR = Math.max(w, h) * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const ang = i * 2.399963 + hash01(i * 3.7) * 0.4;
    const sp = 0.35 + hash01(i * 7.1) * 0.65;
    const dist = ((tt * sp * 0.9) % 1) * maxR;
    const len = 8 + hash01(i * 1.3) * 26;
    const x1 = cx + Math.cos(ang) * dist;
    const y1 = cy + Math.sin(ang) * dist;
    const x2 = cx + Math.cos(ang) * (dist + len);
    const y2 = cy + Math.sin(ang) * (dist + len);
    const fade = 1 - dist / maxR;
    ctx.strokeStyle = rgba(cA, 0.15 + fade * 0.85);
    ctx.lineWidth = 1.2 + hash01(i * 2.9) * 1.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/** 光速隧道（同心环隧道 + 径向光线，纵深推进，高级线条动效） */
function drawLightLines(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  const maxR = Math.max(w, h) * 0.72;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 径向光线（从中心向外拉伸，纵深推进）
  for (let i = 0; i < 64; i++) {
    const ang = i * 2.399963 + hash01(i * 2.1) * 0.3;
    const prog = (tt * 0.5 + i * 0.13) % 1;
    const dist = prog * maxR;
    const len = 14 + hash01(i * 1.7) * 30;
    const x1 = cx + Math.cos(ang) * dist;
    const y1 = cy + Math.sin(ang) * dist;
    const x2 = cx + Math.cos(ang) * (dist + len);
    const y2 = cy + Math.sin(ang) * (dist + len);
    const fade = Math.sin(prog * Math.PI);
    ctx.strokeStyle = rgba(i % 2 === 0 ? cA : cB, 0.12 + fade * 0.8);
    ctx.lineWidth = 1.2 + fade * 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // 同心环隧道（多层圆环向外扩散）
  for (let i = 0; i < 7; i++) {
    const rr = ((tt * 0.6 + i / 7) % 1) * maxR * 0.9;
    const alpha = 0.75 * (1 - rr / (maxR * 0.9)) + 0.1;
    ctx.strokeStyle = rgba(cB, alpha * 0.5);
    ctx.lineWidth = Math.max(1, rr * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 中心光晕
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.25);
  cg.addColorStop(0, rgba(cA, 0.25));
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(cx - maxR * 0.25, cy - maxR * 0.25, maxR * 0.5, maxR * 0.5);
  ctx.restore();
}

/** 星轨环绕（多层椭圆轨道 + 光点拖尾环绕，高级线条动效） */
function drawOrbital(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  const L = Math.min(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const TRACKS = 4;
  for (let tr = 0; tr < TRACKS; tr++) {
    const rx = L * (0.2 + tr * 0.14);
    const ry = rx * (0.42 + tr * 0.06);
    const tiltA = tr * 0.9 + Math.sin(tt * 0.15 + tr) * 0.08;
    // 轨道椭圆
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, tiltA, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(tr % 2 === 0 ? cA : cB, 0.3);
    ctx.lineWidth = Math.max(1, L * 0.005);
    ctx.stroke();
    // 轨道光点 + 拖尾
    const a = tt * (0.7 + tr * 0.2) + tr * 1.7;
    const sp2 = 0.5 + tr * 0.3;
    for (let k = 0; k < 12; k++) {
      const ta = a - k * 0.055 * sp2;
      const co = Math.cos(ta), si = Math.sin(ta);
      const tx = cx + (rx * co * Math.cos(tiltA) - ry * si * Math.sin(tiltA));
      const ty = cy + (rx * co * Math.sin(tiltA) + ry * si * Math.cos(tiltA));
      const f = 1 - k / 12;
      const sz = Math.max(0.8, L * 0.007 * f + (k === 0 ? L * 0.012 : 0));
      ctx.fillStyle = rgba(tr % 2 === 0 ? cA : cB, f * 0.85);
      ctx.beginPath();
      ctx.arc(tx, ty, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 中心微光
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 0.12);
  cg.addColorStop(0, rgba(cB, 0.12));
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(cx - L * 0.12, cy - L * 0.12, L * 0.24, L * 0.24);
  ctx.restore();
}

/** 霓虹波形（多层流动正弦光带 + 波峰光点，高级线条动效） */
function drawNeonWave(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const L = Math.min(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const LAYERS = 4;
  for (let lyr = 0; lyr < LAYERS; lyr++) {
    const baseY = h * (0.2 + lyr * 0.2);
    const amp = h * (0.06 + lyr * 0.012);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const y = baseY + Math.sin(x * 0.025 + tt * (0.9 + lyr * 0.25) + lyr * 1.9) * amp
        + Math.sin(x * 0.012 - tt * 0.6 + lyr) * amp * 0.5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, rgba(cB, 0.03));
    g.addColorStop(0.5, rgba(lyr % 2 === 0 ? cA : cB, 0.5 + 0.35 * Math.sin(tt * 1.2 + lyr)));
    g.addColorStop(1, rgba(cB, 0.03));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5, L * 0.012 * (1 - lyr * 0.1));
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 波峰光点
  for (let i = 0; i < 14; i++) {
    const lyr = i % LAYERS;
    const x = (i * 0.31 * w + Math.sin(tt * 0.4 + i) * w * 0.08 + w) % w;
    const y = h * (0.2 + lyr * 0.2) + Math.sin(x * 0.025 + tt * (0.9 + lyr * 0.25) + lyr * 1.9) * (h * (0.06 + lyr * 0.012));
    ctx.fillStyle = rgba(lyr % 2 === 0 ? cA : cB, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, L * 0.014), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDatarain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const chars = '0123456789ABCDEF';
  const N = 42;
  const mx = mouse && mouse.active ? mouse.x * w : -1;
  const my = mouse && mouse.active ? mouse.y * h : -1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 稳定数字粒子位置 + 缓慢漂移（节点可连成网络）
  const px: number[] = [], py: number[] = [], pch: string[] = [], ps: number[] = [];
  for (let i = 0; i < N; i++) {
    let x = (hash01(i * 1.7) * w + Math.sin(tt * 0.18 + i * 2.3) * w * 0.06 + w) % w;
    let y = (hash01(i * 3.1) * h + Math.cos(tt * 0.15 + i * 1.1) * h * 0.06 + h) % h;
    if (mouse && mouse.active) {
      const dx = mx - x, dy = my - y;
      const d = Math.hypot(dx, dy);
      if (d < Math.max(w, h) * 0.4) {
        const pull = 0.05 * (1 - d / (Math.max(w, h) * 0.4));
        x += dx * pull; y += dy * pull;
      }
    }
    px.push(x); py.push(y);
    pch.push(chars[Math.floor(hash01(i * 5.7 + Math.floor(tt * 0.6)) * chars.length)]);
    ps.push(0.7 + 1.5 * hash01(i * 7.9));
  }
  // 邻近连线网络（像粒子星尘，节点是数字）
  const maxD = Math.min(w, h) * 0.22;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = px[i] - px[j], dy = py[i] - py[j];
      const d2 = dx * dx + dy * dy;
      if (d2 < maxD * maxD) {
        const k = 1 - Math.sqrt(d2) / maxD;
        ctx.strokeStyle = rgba(cB, k * 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px[i], py[i]); ctx.lineTo(px[j], py[j]);
        ctx.stroke();
      }
    }
  }
  // 数字粒子（大小不一、呼吸辉光）
  ctx.textAlign = 'center';
  for (let i = 0; i < N; i++) {
    const s = Math.max(7, Math.min(w, h) * 0.035 * ps[i]);
    ctx.font = `${s}px ui-monospace, monospace`;
    const glow = 0.5 + 0.5 * Math.sin(tt * 1.4 + i * 2.7);
    ctx.fillStyle = rgba(i % 3 === 0 ? cA : cB, 0.55 + 0.45 * glow);
    ctx.fillText(pch[i], px[i], py[i]);
  }
  ctx.restore();
}

function drawCharflow(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const chars = 'ABCDEF0123456789';
  const cx = mouse && mouse.active ? mouse.x * w : w / 2;
  const cy = mouse && mouse.active ? mouse.y * h : h / 2;
  const L = Math.min(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 从中心向四周发散的数字光束（激光发散）
  const BEAMS = 9;
  const perBeam = 7;
  const baseFont = Math.max(7, L * 0.032);
  ctx.textAlign = 'center';
  for (let b = 0; b < BEAMS; b++) {
    const baseA = (b / BEAMS) * Math.PI * 2 + Math.sin(tt * 0.1 + b) * 0.14;
    for (let j = 0; j < perBeam; j++) {
      const prog = (tt * 0.45 + j / perBeam + b * 0.11) % 1;
      const dist = prog * L * 0.52;
      // 光束发散：越远越散开 + 摆动
      const spread = 0.3 * Math.sin(prog * Math.PI);
      const a = baseA + spread * Math.sin(tt * 0.7 + b * 1.3);
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      const ch = chars[Math.floor(hash01(b * 7.3 + j + Math.floor(tt * 0.8)) * chars.length)];
      const glow = Math.sin(prog * Math.PI);
      ctx.globalAlpha = Math.min(1, glow * 0.95);
      ctx.fillStyle = b % 2 === 0 ? rgba(cA, 1) : rgba(cB, 1);
      ctx.shadowColor = rgba(b % 2 === 0 ? cA : cB, 0.9);
      ctx.shadowBlur = baseFont * 0.7;
      ctx.font = `${baseFont * (0.7 + glow * 0.6)}px ui-monospace, monospace`;
      ctx.fillText(ch, x, y);
    }
  }
  // 中心微光
  ctx.shadowBlur = 0;
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 0.18);
  cg.addColorStop(0, rgba(cB, 0.16));
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(cx - L * 0.18, cy - L * 0.18, L * 0.36, L * 0.36);
  ctx.restore();
}

function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 主光带（粗）+ 细光丝（双层更细腻）
  const bands: { i: number; wMul: number; alpha: number }[] = [
    { i: 0, wMul: 1, alpha: 0.7 }, { i: 1, wMul: 0.55, alpha: 0.9 },
    { i: 2, wMul: 0.35, alpha: 0.9 }, { i: 3, wMul: 0.8, alpha: 0.5 },
  ];
  for (const b of bands) {
    const i = b.i;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) {
      let y = h * 0.5 + Math.sin(x * 0.02 + tt * (0.6 + i * 0.3) + i * 2) * h * 0.22
        + Math.sin(x * 0.008 - tt * 0.4 + i) * h * 0.12;
      if (mouse && mouse.active) {
        const nx = mouse.x * w;
        const d = Math.abs(x - nx) / Math.max(1, w);
        y += (mouse.y * h - h * 0.5) * 0.6 * Math.exp(-d * 3.5);
      }
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, rgba(cB, 0.03));
    g.addColorStop(0.5, rgba(i % 2 === 0 ? cA : cB, b.alpha));
    g.addColorStop(1, rgba(cB, 0.03));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(2, h * 0.09 * b.wMul);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 极光光斑
  for (let i = 0; i < 6; i++) {
    const bx = w * (0.15 + 0.7 * ((hash01(i * 3.1) + Math.sin(tt * 0.3 + i * 1.7) * 0.5 + 1) % 1));
    const by = h * (0.25 + 0.3 * (0.5 + 0.5 * Math.sin(tt * 0.5 + i * 2.3)));
    const br = Math.max(w, h) * 0.06;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0, rgba(i % 2 === 0 ? cA : cB, 0.35));
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  ctx.restore();
}

function drawGradientFlow(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // 多色光斑流动
  const hues = [
    { c: cA, ox: Math.sin(tt * 0.6) * w * 0.3, oy: Math.cos(tt * 0.5) * h * 0.3, r: Math.max(w, h) * 0.55 },
    { c: cB, ox: Math.cos(tt * 0.45 + 2) * w * 0.3, oy: Math.sin(tt * 0.55 + 1) * h * 0.3, r: Math.max(w, h) * 0.5 },
    { c: { r: (cA.r + cB.r) / 2, g: (cA.g + cB.g) / 2, b: (cA.b + cB.b) / 2 }, ox: Math.sin(tt * 0.35 + 4) * w * 0.25, oy: Math.cos(tt * 0.4 + 3) * h * 0.25, r: Math.max(w, h) * 0.45 },
  ];
  for (const hb of hues) {
    const gx = cx + hb.ox, gy = cy + hb.oy;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, hb.r);
    g.addColorStop(0, rgba(hb.c, 0.55));
    g.addColorStop(0.6, rgba(hb.c, 0.18));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - hb.r, gy - hb.r, hb.r * 2, hb.r * 2);
  }
  ctx.restore();
}

function drawCardScan(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cardW = w * 0.72, cardH = h * 0.62;
  const cx = w / 2, cy = h / 2;
  const x = cx - cardW / 2, y = cy - cardH / 2;
  ctx.save();
  // 卡片底
  const g = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
  g.addColorStop(0, 'rgba(255,255,255,0.1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  g.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, Math.min(cardW, cardH) * 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 扫描线（上下往复）
  const scanY = y + ((tt * 0.5) % 1) * cardH;
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createLinearGradient(x, scanY - cardH * 0.1, x, scanY + cardH * 0.1);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(0.5, rgba(cA, 0.8));
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(x, scanY - cardH * 0.1, cardW, cardH * 0.2);
  ctx.strokeStyle = rgba(cA, 0.95);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, scanY);
  ctx.lineTo(x + cardW, scanY);
  ctx.stroke();
  // 角点
  const corner = Math.min(cardW, cardH) * 0.16;
  ctx.strokeStyle = rgba(cA, 0.95);
  ctx.lineWidth = 2;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1], [x + cardW, y, -1, 1], [x, y + cardH, 1, -1], [x + cardW, y + cardH, -1, -1],
  ];
  for (const [px, py, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(px + corner * sx, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + corner * sy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCardShine(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const cardW = w * 0.72, cardH = h * 0.62;
  const cx = w / 2, cy = h / 2;
  const x = cx - cardW / 2, y = cy - cardH / 2;
  ctx.save();
  // 卡片
  const g = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
  g.addColorStop(0, rgba(cA, 0.18));
  g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, rgba(cB, 0.16));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, Math.min(cardW, cardH) * 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 光泽扫过（斜向）
  const shineProg = (tt * 0.45) % 1.3 - 0.15;
  const sx = x - cardW + shineProg * (cardW * 2);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, Math.min(cardW, cardH) * 0.08);
  ctx.clip();
  const sg = ctx.createLinearGradient(sx - cardW * 0.4, y, sx + cardW * 0.4, y + cardH * 0.7);
  sg.addColorStop(0, 'rgba(0,0,0,0)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(x - cardW, y, cardW * 3, cardH);
  ctx.restore();
  // 顶部高光条
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, Math.max(2, cardH * 0.04), Math.min(cardW, cardH) * 0.08);
  ctx.fill();
  ctx.restore();
}

/* ===================== 高端新增动效 ===================== */

/** 镭射流光（当下流行的彩虹镭射渐变，逐像素，透明） */
/** Canvas fallback for morph surfaces used by exported HTML. */
function drawMorphMotion(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, type: VfxMotionId, params: VfxParams) {
  const p = (Math.sin(t * Math.max(0.25, speed) * 1.2 - Math.PI / 2) + 1) / 2;
  const travel = Number(params.travel ?? 1);
  let ww = w * 0.58, hh = h * 0.42, x = w * 0.21, y = h * 0.29, radius = Math.min(w, h) * 0.08;
  if (type === 'morph-circle-pill') { ww = w * (0.14 + 0.48 * p * travel); hh = h * 0.14; x = (w - ww) / 2; y = h * 0.43; radius = hh / 2; }
  else if (type === 'morph-reverse-collapse') { ww = w * (0.18 + 0.54 * p * travel); hh = h * (0.14 + 0.42 * p); x = (w - ww) / 2; y = h * (0.43 - 0.21 * p); radius = Math.max(8, hh * (1 - p) * 0.5); }
  else if (type === 'morph-size') { ww = w * (0.24 + 0.5 * p * travel); hh = h * (0.18 + 0.42 * p); x = w * 0.18; y = h * 0.22; }
  const grad = ctx.createLinearGradient(x, y, x + ww, y + hh);
  grad.addColorStop(0, rgba(cA, 0.16));
  grad.addColorStop(1, rgba(cB, 0.1));
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.roundRect(x, y, ww, hh, radius);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = rgba(cA, 0.35 + p * 0.45);
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.006);
  ctx.stroke();
  const textAlpha = Math.max(0, Math.min(1, (p - 0.28) / 0.72));
  if (textAlpha > 0.01) {
    ctx.globalAlpha = textAlpha;
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 ${Math.max(10, Math.round(h * 0.06))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('系统状态', x + ww / 2, y + hh * 0.42);
    ctx.globalAlpha *= 0.7;
    ctx.font = `${Math.max(8, Math.round(h * 0.042))}px system-ui, sans-serif`;
    ctx.fillText('已完成 · 运行稳定', x + ww / 2, y + hh * 0.65);
  }
  ctx.restore();
}

function drawIridescent(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  const bw = Math.min(96, Math.max(2, Math.round(w)));
  const bh = Math.min(96, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('iridescent', bw, bh);
  if (!buf) return;
  const img = buf.img;
  const tt = t * speed;
  renderPixels(img, (x, y, u, v) => {
    const px = u * 15, py = v * 15;
    let n = Math.sin(px * 0.8 + tt * 0.9) * 0.5 + Math.sin(py * 1.0 - tt * 0.7) * 0.5
      + Math.sin((px + py) * 0.6 + tt * 0.5) * 0.4
      + Math.sin(Math.hypot(px - 7.5, py - 7.5) * 0.7 - tt * 0.8) * 0.35;
    if (mouse && mouse.active) {
      const md = Math.hypot(u - mouse.x, v - mouse.y);
      n += 0.6 * Math.sin(md * 8 - tt * 4) * Math.exp(-md * 3.5);
    }
    const hue = (tt * 0.06 + n * 0.5 + u * 0.15 + v * 0.1) % 1;
    const c = hsvToRgb(hue, 0.65, 1);
    const a = Math.min(1, Math.abs(n) * 1.4);
    return { r: c.r, g: c.g, b: c.b, a: a * 255 };
  }, mouse);
  buf.ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf.canvas, 0, 0, bw, bh, 0, 0, w, h);
}

/** 渐变环形加载（高端旋转渐变弧环） */
/** 点阵呼吸加载（skeleton 风逐点点亮） */
function drawDotLoader(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  const n = 7;
  const gap = Math.min(w, h) * 0.16;
  const total = gap * (n - 1);
  const x0 = (w - total) / 2, y0 = h / 2;
  const R = gap * 0.16;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const prog = ((tt * 0.7) % (n + 1)) - i;
    const a = Math.max(0, 1 - Math.abs(prog)) * 0.95;
    const x = x0 + i * gap;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, y0, 0, x, y0, R * 3.2);
    glow.addColorStop(0, rgba(i % 2 === 0 ? cA : cB, a * 0.9));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - R * 3.2, y0 - R * 3.2, R * 6.4, R * 6.4);
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, a);
    ctx.beginPath();
    ctx.arc(x, y0, R * (0.8 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 世界国家/大陆边界轮廓（自然地球 110m，经纬度坐标 [[lon,lat],...]），用于数字网格地球的陆地边界绘制 */
const EARTH_LAND: number[][][] = [
[[180.0,-16.07],[180.0,-16.56],[178.73,-17.01],[178.6,-16.64],[180.0,-16.07]],
[[178.13,-17.5],[178.72,-17.63],[178.55,-18.15],[177.38,-18.16],[177.67,-17.38],[178.13,-17.5]],
[[-179.79,-16.02],[-180.0,-16.56],[-179.79,-16.02]],
[[33.9,-0.95],[37.7,-3.1],[37.77,-3.68],[39.2,-4.68],[38.74,-5.91],[39.44,-6.84],[39.19,-8.49],[40.32,-10.32],[39.52,-10.9],[36.51,-11.72],[34.56,-11.52],[33.74,-9.42],[30.74,-8.34],[29.62,-6.52],[29.34,-4.5],[30.75,-3.36],[30.42,-1.13],[33.9,-0.95]],
[[-8.67,27.66],[-8.69,25.88],[-11.97,25.93],[-11.94,23.37],[-12.87,23.28],[-12.93,21.33],[-17.06,21.0],[-17.02,21.42],[-14.75,21.5],[-13.89,23.69],[-12.5,24.77],[-11.39,26.88],[-8.79,27.12],[-8.67,27.66]],
[[-122.84,49.0],[-127.44,50.83],[-127.85,52.33],[-129.13,52.76],[-129.31,53.56],[-130.51,54.29],[-130.01,55.92],[-131.71,56.55],[-135.48,59.79],[-137.45,58.91],[-139.04,60.0],[-141.0,60.31],[-140.99,69.71],[-136.5,68.9],[-129.79,70.19],[-129.11,69.78],[-128.14,70.48],[-125.76,69.48],[-124.42,70.16],[-124.29,69.4],[-121.47,69.8],[-115.25,68.91],[-113.9,68.4],[-115.3,67.9],[-113.5,67.69],[-109.95,67.98],[-108.88,67.38],[-107.79,67.89],[-108.81,68.31],[-108.17,68.65],[-106.15,68.8],[-101.45,67.65],[-98.44,67.78],[-98.56,68.4],[-97.67,68.58],[-96.12,68.24],[-96.13,67.29],[-95.49,68.09],[-94.69,68.06],[-94.23,69.07],[-96.47,70.09],[-96.39,71.19],[-95.21,71.92],[-92.88,71.32],[-91.52,70.19],[-92.41,69.7],[-90.55,69.5],[-90.55,68.47],[-89.22,69.26],[-88.02,68.62],[-88.32,67.87],[-87.35,67.2],[-85.58,68.78],[-85.52,69.88],[-82.62,69.66],[-81.28,69.16],[-81.96,68.13],[-81.26,67.6],[-81.39,67.11],[-83.34,66.41],[-85.77,66.56],[-87.32,64.78],[-90.7,63.61],[-90.77,62.96],[-91.93,62.84],[-94.24,60.9],[-94.68,58.95],[-93.22,58.78],[-92.3,57.09],[-90.9,57.28],[-85.01,55.3],[-82.27,55.15],[-82.13,53.28],[-79.91,51.21],[-78.6,52.56],[-79.83,54.67],[-78.23,55.14],[-76.54,56.53],[-77.3,58.05],[-78.52,58.8],[-77.34,59.85],[-78.11,62.32],[-73.84,62.44],[-71.37,61.14],[-69.59,61.06],[-69.29,58.96],[-67.65,58.21],[-66.2,58.77],[-64.58,60.34],[-61.4,56.97],[-61.8,56.34],[-57.33,54.63],[-56.94,53.78],[-55.76,53.27],[-55.68,52.15],[-60.03,50.24],[-66.4,50.23],[-71.1,46.82],[-68.65,48.3],[-65.06,49.23],[-64.17,48.74],[-65.12,48.07],[-64.47,46.24],[-61.52,45.88],[-60.52,47.01],[-59.8,45.92],[-65.36,43.55],[-66.12,43.62],[-66.16,44.47],[-64.43,45.29],[-67.14,45.14],[-67.79,45.7],[-67.79,47.07],[-69.24,47.45],[-71.51,45.01],[-74.87,45.0],[-76.82,43.63],[-78.72,43.63],[-79.17,43.47],[-78.94,42.86],[-82.44,41.68],[-83.14,41.98],[-82.14,43.57],[-82.55,45.35],[-88.38,48.3],[-91.64,48.14],[-94.33,48.67],[-94.82,49.39],[-95.16,49.0],[-122.84,49.0]],
[[-83.99,62.45],[-81.88,62.9],[-83.07,62.16],[-83.99,62.45]],
[[-79.78,72.8],[-80.83,73.69],[-78.06,73.65],[-76.25,72.83],[-79.78,72.8]],
[[-80.32,62.09],[-79.27,62.16],[-79.66,61.63],[-80.32,62.09]],
[[-93.61,74.98],[-94.16,74.59],[-96.82,74.93],[-94.85,75.65],[-93.61,74.98]],
[[-93.84,77.52],[-96.44,77.83],[-93.84,77.52]],
[[-96.75,78.77],[-95.56,78.42],[-97.31,77.85],[-98.63,78.87],[-96.75,78.77]],
[[-88.15,74.39],[-92.42,74.84],[-92.89,75.88],[-93.89,76.32],[-97.12,76.75],[-96.75,77.16],[-91.61,76.78],[-90.74,76.45],[-90.97,76.07],[-89.19,75.61],[-81.13,75.71],[-79.83,74.92],[-88.15,74.39]],
[[-111.26,78.15],[-109.85,78.0],[-112.05,77.41],[-113.53,77.73],[-111.26,78.15]],
[[-110.96,78.8],[-109.66,78.6],[-112.54,78.41],[-110.96,78.8]],
[[-55.6,51.32],[-56.8,49.81],[-56.14,50.15],[-55.47,49.94],[-55.82,49.59],[-53.48,49.25],[-53.79,48.52],[-53.09,48.69],[-52.65,47.54],[-53.07,46.66],[-54.18,46.81],[-54.24,47.75],[-55.4,46.88],[-56.0,46.92],[-55.29,47.39],[-56.25,47.63],[-59.27,47.6],[-58.8,48.25],[-59.23,48.52],[-57.36,50.72],[-55.87,51.63],[-55.6,51.32]],
[[-83.88,65.11],[-80.1,63.73],[-80.99,63.41],[-83.11,64.1],[-85.52,63.05],[-85.87,63.64],[-87.22,63.54],[-86.35,64.04],[-85.88,65.74],[-83.88,65.11]],
[[-78.77,72.35],[-77.82,72.75],[-74.23,71.77],[-74.1,71.33],[-72.24,71.56],[-68.79,70.53],[-66.97,69.19],[-68.81,68.72],[-61.85,66.86],[-63.92,65.0],[-66.72,66.39],[-68.02,66.26],[-68.14,65.69],[-65.32,64.38],[-64.67,63.39],[-65.01,62.67],[-68.78,63.75],[-66.17,61.93],[-68.88,62.33],[-74.83,64.68],[-77.71,64.23],[-78.56,64.57],[-77.9,65.31],[-73.96,65.45],[-73.94,66.31],[-72.65,67.28],[-73.31,68.07],[-76.87,68.89],[-76.23,69.15],[-78.96,70.17],[-81.31,69.74],[-88.68,70.41],[-89.51,70.76],[-88.47,71.22],[-89.89,71.22],[-90.21,72.24],[-88.41,73.54],[-85.83,73.8],[-86.56,73.16],[-85.77,72.53],[-84.85,73.34],[-82.32,73.75],[-80.6,72.72],[-80.75,72.06],[-78.77,72.35]],
[[-94.5,74.13],[-90.51,73.86],[-94.27,72.02],[-95.41,72.06],[-96.02,73.44],[-94.5,74.13]],
[[-122.85,76.12],[-119.1,77.51],[-116.2,77.65],[-116.34,76.88],[-117.11,76.53],[-122.85,76.12]],
[[-132.71,54.04],[-131.75,54.12],[-132.05,52.98],[-131.18,52.18],[-133.05,53.41],[-133.18,54.17],[-132.71,54.04]],
[[-105.49,79.3],[-100.83,78.8],[-99.67,77.91],[-105.18,78.38],[-104.21,78.68],[-105.49,79.3]],
[[-123.51,48.51],[-125.66,48.83],[-128.06,49.99],[-128.36,50.77],[-125.76,50.3],[-123.51,48.51]],
[[-121.54,74.45],[-117.56,74.19],[-115.51,73.48],[-119.22,72.52],[-120.46,71.38],[-123.09,70.9],[-125.93,71.87],[-123.94,73.68],[-124.92,74.29],[-121.54,74.45]],
[[-107.82,75.85],[-105.88,75.97],[-105.7,75.48],[-106.31,75.01],[-112.22,74.42],[-113.87,74.72],[-111.79,75.16],[-117.71,75.22],[-115.4,76.48],[-109.07,75.47],[-110.5,76.43],[-109.58,76.79],[-108.55,76.68],[-107.82,75.85]],
[[-106.52,73.08],[-105.4,72.67],[-104.46,70.99],[-100.98,70.02],[-101.09,69.58],[-102.73,69.5],[-102.09,69.12],[-102.43,68.75],[-105.96,69.18],[-113.31,68.54],[-117.34,69.96],[-112.42,70.37],[-117.9,70.54],[-118.43,70.91],[-116.11,71.31],[-119.4,71.56],[-117.87,72.71],[-115.19,73.31],[-114.17,73.12],[-114.67,72.65],[-112.44,72.96],[-111.05,72.45],[-109.92,72.96],[-108.19,71.65],[-107.69,72.07],[-108.4,73.09],[-106.52,73.08]],
[[-100.44,72.71],[-101.54,73.36],[-100.36,73.84],[-97.38,73.76],[-97.12,73.47],[-98.05,72.99],[-96.54,72.56],[-96.72,71.66],[-98.36,71.27],[-102.5,72.51],[-100.44,72.71]],
[[-106.6,73.6],[-104.5,73.42],[-105.38,72.76],[-106.94,73.46],[-106.6,73.6]],
[[-98.5,76.72],[-97.74,76.26],[-98.16,75.0],[-102.5,75.56],[-102.57,76.34],[-98.5,76.72]],
[[-96.02,80.6],[-94.3,80.98],[-94.74,81.21],[-92.41,81.26],[-87.81,80.32],[-85.81,79.34],[-89.04,78.29],[-92.88,78.34],[-93.95,78.75],[-93.15,79.38],[-94.97,79.37],[-96.71,80.16],[-96.02,80.6]],
[[-91.59,81.89],[-85.5,82.65],[-83.18,82.32],[-82.42,82.86],[-79.31,83.13],[-61.85,82.63],[-67.66,81.5],[-65.48,81.51],[-71.18,79.8],[-76.91,79.32],[-75.53,79.2],[-76.22,79.02],[-75.39,78.53],[-79.76,77.21],[-77.89,76.78],[-80.56,76.18],[-89.49,76.47],[-89.62,76.95],[-87.77,77.18],[-88.26,77.9],[-84.98,77.54],[-87.96,78.37],[-85.09,79.35],[-86.93,80.25],[-81.85,80.46],[-87.6,80.52],[-91.59,81.89]],
[[-75.22,67.44],[-76.99,67.1],[-77.24,67.59],[-75.9,68.29],[-75.11,68.01],[-75.22,67.44]],
[[-96.26,69.49],[-95.65,69.11],[-96.27,68.76],[-99.8,69.4],[-98.22,70.14],[-96.26,69.49]],
[[-64.52,49.87],[-61.81,49.11],[-64.52,49.87]],
[[-64.01,47.04],[-63.66,46.55],[-62.01,46.44],[-62.87,45.97],[-64.14,46.39],[-64.01,47.04]],
[[-122.84,49.0],[-95.16,49.0],[-94.82,49.39],[-94.33,48.67],[-91.64,48.14],[-88.38,48.3],[-82.55,45.35],[-82.14,43.57],[-83.12,42.08],[-82.69,41.68],[-78.94,42.86],[-79.17,43.47],[-78.72,43.63],[-76.82,43.63],[-74.87,45.0],[-71.51,45.01],[-69.24,47.45],[-67.79,47.07],[-67.79,45.7],[-66.96,44.81],[-70.12,43.68],[-70.83,42.34],[-69.97,41.64],[-73.71,40.93],[-71.94,40.93],[-73.95,40.75],[-74.91,38.94],[-75.53,39.5],[-75.06,38.4],[-75.94,37.22],[-75.72,37.94],[-76.35,39.15],[-76.33,38.08],[-76.99,38.24],[-76.3,37.92],[-75.73,35.55],[-81.34,31.44],[-81.31,30.04],[-80.06,26.88],[-80.38,25.21],[-81.17,25.2],[-81.71,25.87],[-83.71,29.94],[-85.11,29.64],[-86.4,30.4],[-89.59,30.16],[-89.41,29.16],[-93.23,29.78],[-94.69,29.48],[-97.14,27.83],[-97.14,25.87],[-97.53,25.84],[-99.02,26.37],[-100.96,29.38],[-102.48,29.76],[-103.11,28.97],[-103.94,29.27],[-106.51,31.75],[-111.02,31.33],[-114.72,32.72],[-117.13,32.54],[-118.52,34.03],[-120.62,34.61],[-124.4,40.31],[-124.53,42.77],[-123.9,45.52],[-124.69,48.18],[-123.12,48.04],[-122.59,47.1],[-122.84,49.0]],
[[-155.4,20.08],[-154.81,19.51],[-155.69,18.92],[-156.07,19.7],[-155.86,20.27],[-155.4,20.08]],
[[-156.0,20.76],[-156.71,20.93],[-156.0,20.76]],
[[-156.76,21.18],[-157.33,21.1],[-156.76,21.18]],
[[-158.03,21.72],[-157.71,21.26],[-158.03,21.72]],
[[-159.37,22.21],[-159.8,22.07],[-159.37,22.21]],
[[-166.47,60.38],[-165.58,59.91],[-167.46,60.21],[-166.47,60.38]],
[[-153.23,57.97],[-152.14,57.59],[-154.01,56.73],[-154.52,56.99],[-154.67,57.46],[-153.23,57.97]],
[[-140.99,69.71],[-141.0,60.31],[-139.04,60.0],[-137.45,58.91],[-135.48,59.79],[-131.71,56.55],[-130.01,55.92],[-130.54,54.8],[-131.97,55.5],[-134.08,58.12],[-136.63,58.21],[-139.87,59.54],[-147.11,60.88],[-148.22,60.67],[-148.02,59.98],[-151.72,59.16],[-151.41,60.73],[-150.35,61.03],[-150.62,61.28],[-154.02,59.35],[-153.29,58.86],[-154.23,58.15],[-158.43,55.99],[-164.94,54.57],[-158.68,57.02],[-157.72,57.57],[-157.04,58.92],[-159.06,58.42],[-160.36,59.07],[-161.97,58.67],[-161.87,59.63],[-162.52,59.99],[-163.82,59.8],[-165.35,60.51],[-166.12,61.5],[-165.73,62.07],[-164.56,63.15],[-160.77,63.77],[-161.52,64.4],[-160.78,64.79],[-164.96,64.45],[-168.11,65.67],[-164.47,66.58],[-163.65,66.58],[-163.79,66.08],[-161.68,66.12],[-166.76,68.36],[-166.2,68.88],[-164.43,68.92],[-161.91,70.33],[-156.58,71.36],[-154.34,70.7],[-140.99,69.71]],
[[-171.73,63.78],[-168.69,63.3],[-169.53,62.98],[-171.55,63.32],[-171.73,63.78]],
[[87.36,49.21],[85.77,48.46],[85.16,47.0],[83.18,47.33],[82.46,45.54],[79.97,44.92],[80.87,43.18],[80.18,42.92],[80.26,42.35],[74.21,43.3],[73.49,42.5],[71.19,42.7],[68.63,40.67],[66.71,41.17],[66.51,41.99],[66.02,41.99],[66.1,43.0],[64.9,43.73],[62.01,43.5],[58.5,45.59],[55.93,45.0],[55.97,41.31],[54.08,42.32],[52.5,41.78],[52.5,42.79],[51.34,43.13],[50.31,44.61],[51.28,44.51],[51.32,45.25],[53.04,45.26],[53.04,46.85],[51.19,47.05],[49.1,46.4],[48.06,47.74],[46.47,48.39],[47.55,50.45],[48.58,49.87],[48.7,50.61],[50.77,51.69],[52.33,51.72],[55.72,50.62],[56.78,51.04],[61.34,50.8],[61.59,51.27],[59.97,51.96],[61.7,52.98],[60.98,53.66],[61.44,54.01],[69.07,55.39],[70.87,55.17],[71.18,54.13],[73.51,54.04],[73.43,53.49],[76.89,54.49],[76.53,54.18],[80.04,50.86],[80.57,51.39],[81.95,50.81],[83.38,51.07],[87.36,49.21]],
[[55.97,41.31],[55.93,45.0],[58.5,45.59],[62.01,43.5],[64.9,43.73],[66.1,43.0],[66.02,41.99],[66.51,41.99],[66.71,41.17],[67.99,41.14],[68.26,40.66],[70.96,42.27],[70.42,41.52],[73.06,40.87],[71.77,40.15],[70.6,40.22],[70.67,40.96],[69.33,40.73],[68.54,39.53],[67.7,39.58],[67.44,39.14],[68.18,38.9],[68.39,38.16],[67.83,37.14],[66.52,37.36],[66.55,37.97],[64.17,38.89],[62.37,40.05],[61.88,41.08],[60.47,41.22],[59.98,42.22],[58.63,42.75],[56.93,41.83],[57.1,41.32],[55.97,41.31]],
[[141.0,-2.6],[144.58,-3.86],[145.98,-5.47],[147.65,-6.08],[147.89,-6.61],[146.97,-6.72],[147.19,-7.39],[150.69,-10.58],[147.91,-10.13],[146.05,-8.07],[144.74,-7.63],[143.29,-8.25],[143.41,-8.98],[142.63,-9.33],[141.03,-9.12],[141.0,-2.6]],
[[152.64,-3.66],[153.14,-4.5],[152.83,-4.77],[152.41,-3.79],[150.66,-2.74],[152.64,-3.66]],
[[151.3,-5.84],[149.71,-6.32],[148.32,-5.75],[149.85,-5.51],[150.14,-5.0],[150.24,-5.53],[150.81,-5.46],[151.65,-4.76],[151.54,-4.17],[152.14,-4.15],[152.32,-4.87],[151.3,-5.84]],
[[154.76,-5.34],[155.88,-6.82],[155.17,-6.54],[154.76,-5.34]],
[[141.0,-2.6],[141.03,-9.12],[140.14,-8.3],[137.61,-8.41],[138.67,-7.32],[137.93,-5.39],[133.66,-3.54],[132.98,-4.11],[131.99,-2.82],[133.7,-2.21],[132.23,-2.21],[130.52,-0.94],[132.38,-0.37],[133.99,-0.78],[134.42,-2.77],[135.46,-3.37],[137.44,-1.7],[141.0,-2.6]],
[[124.97,-8.89],[124.44,-10.14],[123.46,-10.24],[123.98,-9.29],[124.97,-8.89]],
[[134.21,-6.9],[134.5,-5.45],[134.72,-6.21],[134.21,-6.9]],
[[117.88,4.14],[117.31,3.23],[117.88,1.83],[119.0,0.9],[117.81,0.78],[117.52,-0.8],[116.56,-1.49],[116.15,-4.01],[116.0,-3.66],[114.86,-4.11],[113.26,-3.12],[112.07,-3.48],[111.7,-2.99],[110.22,-2.93],[108.95,0.42],[109.66,2.01],[110.51,0.77],[112.86,1.5],[113.81,1.22],[114.62,1.43],[115.87,4.31],[117.88,4.14]],
[[129.37,-2.8],[130.47,-3.09],[130.83,-3.86],[127.9,-3.39],[128.14,-2.84],[129.37,-2.8]],
[[126.87,-3.79],[125.99,-3.18],[127.0,-3.13],[126.87,-3.79]],
[[127.93,2.17],[128.69,1.13],[128.1,-0.9],[127.4,1.01],[127.93,2.17]],
[[122.93,0.88],[125.24,1.42],[123.69,0.24],[120.18,0.24],[120.04,-0.52],[120.94,-1.41],[123.34,-0.62],[121.51,-1.9],[123.16,-5.34],[122.24,-5.28],[122.72,-4.46],[121.49,-4.57],[120.97,-2.63],[120.31,-2.93],[120.43,-5.53],[119.8,-5.67],[119.37,-5.38],[119.5,-3.49],[118.77,-2.8],[119.83,0.15],[120.89,1.31],[122.93,0.88]],
[[120.3,-10.26],[118.97,-9.56],[119.9,-9.36],[120.78,-9.97],[120.3,-10.26]],
[[121.34,-8.54],[122.9,-8.09],[122.76,-8.65],[119.92,-8.81],[120.72,-8.24],[121.34,-8.54]],
[[118.26,-8.36],[119.13,-8.71],[116.74,-9.03],[117.9,-8.1],[118.26,-8.36]],
[[108.49,-6.42],[112.61,-6.95],[112.98,-7.59],[115.71,-8.37],[114.56,-8.75],[105.37,-6.85],[106.05,-5.9],[108.49,-6.42]],
[[104.37,-1.08],[104.89,-2.34],[106.11,-3.06],[105.82,-5.85],[104.71,-5.87],[102.58,-4.22],[98.6,1.82],[95.29,5.48],[97.48,5.25],[100.64,2.1],[102.5,1.4],[103.84,0.1],[103.44,-0.71],[104.37,-1.08]],
[[-68.63,-52.64],[-67.75,-53.85],[-65.05,-54.7],[-66.45,-55.25],[-68.63,-54.87],[-68.63,-52.64]],
[[-57.63,-30.22],[-58.5,-34.43],[-57.23,-35.29],[-56.79,-36.9],[-57.75,-38.18],[-59.23,-38.72],[-62.34,-38.83],[-62.15,-40.68],[-62.75,-41.03],[-65.12,-41.06],[-64.98,-42.06],[-63.76,-42.04],[-63.46,-42.56],[-65.18,-43.5],[-65.57,-45.04],[-67.29,-45.55],[-67.58,-46.3],[-65.64,-47.24],[-65.99,-48.13],[-69.14,-50.73],[-68.15,-52.35],[-71.91,-52.01],[-72.31,-50.68],[-73.33,-50.38],[-73.42,-49.32],[-72.33,-48.24],[-71.66,-44.97],[-71.22,-44.78],[-72.15,-42.25],[-71.41,-38.92],[-70.81,-38.55],[-71.12,-36.66],[-70.36,-36.01],[-69.82,-34.19],[-70.54,-31.37],[-69.66,-28.46],[-68.3,-26.9],[-68.42,-24.52],[-67.33,-24.03],[-67.11,-22.74],[-66.27,-21.83],[-64.96,-22.08],[-64.38,-22.8],[-63.99,-21.99],[-62.85,-22.03],[-60.85,-23.88],[-57.78,-25.16],[-58.62,-27.12],[-55.7,-27.39],[-54.13,-25.55],[-53.65,-26.92],[-57.63,-30.22]],
[[-68.63,-52.64],[-68.63,-54.87],[-66.96,-54.9],[-68.15,-55.61],[-71.01,-55.05],[-74.66,-52.84],[-71.11,-54.07],[-70.27,-52.93],[-68.63,-52.64]],
[[-69.59,-17.58],[-68.44,-19.41],[-68.76,-20.37],[-67.83,-22.87],[-66.99,-22.99],[-67.33,-24.03],[-68.42,-24.52],[-68.3,-26.9],[-69.66,-28.46],[-70.54,-31.37],[-69.82,-34.19],[-70.36,-36.01],[-71.12,-36.66],[-70.81,-38.55],[-71.41,-38.92],[-72.15,-42.25],[-71.22,-44.78],[-71.66,-44.97],[-72.33,-48.24],[-73.42,-49.32],[-73.33,-50.38],[-72.31,-50.68],[-71.91,-52.01],[-68.57,-52.3],[-70.85,-52.9],[-71.43,-53.86],[-74.95,-52.26],[-75.61,-48.67],[-74.13,-46.94],[-75.64,-46.65],[-74.69,-45.76],[-74.35,-44.1],[-73.24,-44.45],[-72.72,-42.38],[-73.39,-42.12],[-73.7,-43.37],[-74.33,-43.22],[-73.22,-39.26],[-73.59,-37.16],[-73.17,-37.12],[-71.44,-32.42],[-71.49,-28.86],[-70.91,-27.64],[-70.09,-21.39],[-70.37,-18.35],[-69.59,-17.58]],
[[29.34,-4.5],[29.62,-6.52],[30.74,-8.34],[28.73,-8.53],[28.37,-11.79],[29.62,-12.18],[29.7,-13.26],[28.93,-13.25],[27.16,-11.61],[26.55,-11.92],[24.26,-10.95],[22.16,-11.08],[21.73,-7.29],[20.09,-6.94],[19.02,-7.99],[17.47,-8.07],[16.33,-5.88],[12.18,-5.79],[13.6,-4.5],[14.58,-4.97],[16.01,-3.54],[16.41,-1.74],[17.64,-0.42],[18.54,4.2],[19.47,5.03],[22.41,4.03],[22.84,4.71],[25.65,5.26],[27.37,5.23],[28.43,4.29],[29.72,4.6],[30.83,3.51],[30.77,2.34],[31.17,2.2],[29.88,0.6],[29.02,-2.84],[29.34,-4.5]],
[[41.59,-1.68],[40.99,-0.86],[40.98,2.78],[42.13,4.23],[44.96,5.0],[48.94,9.45],[48.95,11.41],[51.11,12.02],[50.55,9.2],[48.59,5.34],[41.59,-1.68]],
[[39.2,-4.68],[37.77,-3.68],[37.7,-3.1],[33.9,-0.95],[33.89,0.11],[35.04,1.91],[34.01,4.25],[35.3,5.51],[36.16,4.45],[38.12,3.6],[39.56,3.42],[40.77,4.26],[41.86,3.92],[40.98,2.78],[40.99,-0.86],[41.59,-1.68],[40.26,-2.57],[39.2,-4.68]],
[[24.57,8.23],[23.46,8.95],[23.55,10.09],[21.94,12.59],[23.02,15.68],[23.89,15.61],[23.85,20.0],[25.0,20.0],[25.0,22.0],[36.87,22.0],[37.48,18.61],[38.41,18.0],[36.85,16.96],[36.27,13.56],[34.26,10.63],[33.97,8.68],[33.21,12.18],[32.74,12.25],[32.07,11.97],[32.4,11.08],[31.35,9.81],[30.0,10.29],[28.97,9.4],[26.75,9.47],[25.79,10.41],[25.07,10.27],[24.54,8.92],[23.89,8.62],[24.57,8.23]],
[[23.84,19.58],[23.89,15.61],[23.02,15.68],[21.94,12.59],[22.86,11.14],[21.0,9.48],[18.81,8.98],[17.96,7.89],[15.28,7.42],[14.98,8.8],[13.95,9.55],[14.17,10.02],[15.47,9.98],[14.6,13.33],[13.95,13.35],[13.54,14.37],[13.97,15.68],[15.25,16.63],[15.9,20.39],[15.1,21.31],[14.85,22.86],[15.86,23.41],[23.84,19.58]],
[[-71.71,19.71],[-71.71,18.04],[-74.46,18.34],[-72.33,18.67],[-73.19,19.92],[-71.71,19.71]],
[[-71.71,18.04],[-71.59,19.88],[-69.95,19.65],[-68.32,18.61],[-68.69,18.21],[-70.67,18.43],[-71.4,17.6],[-71.71,18.04]],
[[178.73,71.1],[180.0,71.52],[180.0,70.83],[178.73,71.1]],
[[49.1,46.4],[46.68,44.61],[48.58,41.81],[47.82,41.15],[45.47,42.5],[39.96,43.43],[36.68,45.24],[38.23,46.24],[37.67,46.64],[39.15,47.04],[38.22,47.1],[38.26,47.55],[39.74,47.9],[40.07,49.6],[35.36,50.58],[35.02,51.21],[34.22,51.26],[34.39,51.77],[33.75,52.34],[31.79,52.1],[31.31,53.07],[32.69,53.35],[30.76,54.81],[30.87,55.55],[28.18,56.17],[27.29,57.47],[27.72,57.79],[27.42,58.72],[29.12,60.03],[28.07,60.5],[31.52,62.87],[30.04,63.55],[30.44,64.2],[29.54,64.95],[30.22,65.81],[29.05,66.94],[29.98,67.7],[28.45,68.36],[28.59,69.06],[32.13,69.91],[41.06,67.46],[41.13,66.79],[38.38,66.0],[33.18,66.63],[34.81,65.9],[34.94,64.41],[37.01,63.85],[36.54,64.76],[37.18,65.14],[39.59,64.52],[40.44,64.76],[39.76,65.5],[42.09,66.48],[43.95,66.07],[44.53,66.76],[43.7,67.35],[44.19,67.95],[43.45,68.57],[46.25,68.25],[46.82,67.69],[45.56,67.57],[45.56,67.01],[46.35,66.67],[53.72,68.86],[54.47,68.81],[53.49,68.2],[58.8,68.88],[59.94,68.28],[61.08,68.94],[60.03,69.52],[60.55,69.85],[68.51,68.09],[69.18,68.62],[66.93,69.45],[67.26,69.93],[66.69,71.03],[69.94,73.04],[72.59,72.78],[72.8,72.22],[71.85,71.41],[72.79,70.39],[72.56,69.02],[73.67,68.41],[71.28,66.32],[72.42,66.17],[75.05,67.76],[74.47,68.33],[74.94,68.99],[73.84,69.07],[73.6,69.63],[74.4,70.63],[73.1,71.45],[74.89,72.12],[74.66,72.83],[75.68,72.3],[75.29,71.34],[76.36,71.15],[75.9,71.87],[77.58,72.27],[81.5,71.75],[80.61,72.58],[80.51,73.65],[86.82,73.94],[86.01,74.46],[87.17,75.12],[100.76,76.43],[101.99,77.29],[104.35,77.7],[106.07,77.37],[104.7,77.13],[106.97,76.97],[107.24,76.48],[111.08,76.71],[114.13,75.85],[113.89,75.33],[109.4,74.18],[113.02,73.98],[113.53,73.34],[115.57,73.75],[123.2,72.97],[123.26,73.74],[126.98,73.57],[128.59,73.04],[129.05,72.4],[128.46,71.98],[131.29,70.79],[132.25,71.84],[133.86,71.39],[139.87,71.49],[139.15,72.42],[140.47,72.85],[149.5,72.2],[152.97,70.84],[159.0,70.87],[159.83,70.45],[159.71,69.72],[160.94,69.44],[167.84,69.58],[169.58,68.69],[170.82,69.01],[170.01,69.65],[170.45,70.1],[175.72,69.88],[180.0,68.96],[180.0,64.98],[177.41,64.61],[179.37,62.98],[179.23,62.3],[177.36,62.52],[173.68,61.65],[170.33,59.88],[168.9,60.57],[166.29,59.79],[165.84,60.16],[163.54,59.87],[162.02,58.24],[163.19,57.62],[163.06,56.16],[162.13,56.12],[161.7,55.29],[162.12,54.86],[160.37,54.34],[160.02,53.2],[158.53,52.96],[158.23,51.94],[156.79,51.01],[155.43,55.38],[155.91,56.77],[156.81,57.83],[158.36,58.06],[163.67,61.14],[164.47,62.55],[163.26,62.47],[162.66,61.64],[160.12,60.54],[159.3,61.77],[156.72,61.43],[154.22,59.76],[155.04,59.14],[151.27,58.78],[151.34,59.5],[149.78,59.66],[148.54,59.16],[142.2,59.04],[135.13,54.73],[136.7,54.6],[138.16,53.76],[139.9,54.19],[141.35,53.09],[140.06,48.45],[134.87,43.4],[133.54,42.81],[132.28,43.28],[130.78,42.22],[131.03,44.97],[133.1,45.14],[135.03,48.48],[130.99,47.79],[130.58,48.73],[129.4,49.44],[127.66,49.76],[125.95,52.79],[123.57,53.46],[120.18,52.75],[120.74,51.96],[119.29,50.14],[117.88,49.51],[114.36,50.25],[110.66,49.13],[108.48,49.28],[106.89,50.27],[103.68,50.09],[102.26,50.51],[102.07,51.26],[98.86,52.05],[97.83,51.01],[98.23,50.42],[97.26,49.73],[92.23,50.8],[87.36,49.21],[83.38,51.07],[81.95,50.81],[80.57,51.39],[80.04,50.86],[76.53,54.18],[76.89,54.49],[73.43,53.49],[73.51,54.04],[71.18,54.13],[70.87,55.17],[69.07,55.39],[61.44,54.01],[60.98,53.66],[61.7,52.98],[59.97,51.96],[61.59,51.27],[61.34,50.8],[56.78,51.04],[55.72,50.62],[52.33,51.72],[50.77,51.69],[48.7,50.61],[48.58,49.87],[47.55,50.45],[46.47,48.39],[48.06,47.74],[49.1,46.4]],
[[93.78,81.02],[95.94,81.25],[100.19,79.78],[99.94,78.88],[97.76,78.76],[93.31,79.43],[92.55,80.14],[91.18,80.34],[93.78,81.02]],
[[102.84,79.28],[105.37,78.71],[105.08,78.31],[99.44,77.92],[101.26,79.23],[102.84,79.28]],
[[138.83,76.14],[145.09,75.56],[144.3,74.82],[138.96,74.61],[136.97,75.26],[137.51,75.95],[138.83,76.14]],
[[148.22,75.35],[150.73,75.08],[149.58,74.69],[146.12,75.17],[148.22,75.35]],
[[139.86,73.37],[142.06,73.86],[143.6,73.21],[139.86,73.37]],
[[44.85,80.59],[51.52,80.7],[47.59,80.01],[46.5,80.25],[47.07,80.56],[44.85,80.59]],
[[22.73,54.33],[19.66,54.43],[21.27,55.19],[22.76,54.86],[22.73,54.33]],
[[53.51,73.75],[55.9,74.63],[55.63,75.08],[61.17,76.25],[68.16,76.94],[68.85,76.54],[58.48,74.31],[55.42,72.37],[55.62,71.54],[57.54,70.72],[53.68,70.76],[51.6,71.47],[51.46,72.01],[52.48,72.23],[52.44,72.77],[54.43,73.63],[53.51,73.75]],
[[142.91,53.7],[143.24,51.76],[144.65,48.98],[143.17,49.31],[142.56,47.86],[143.53,46.84],[143.51,46.14],[142.75,46.74],[142.09,45.97],[142.18,50.95],[141.59,51.94],[141.68,53.3],[142.61,53.76],[142.21,54.23],[142.65,54.37],[142.91,53.7]],
[[-174.93,67.21],[-175.01,66.58],[-174.34,66.34],[-174.57,67.06],[-171.86,66.91],[-169.9,65.98],[-172.53,65.44],[-172.96,64.25],[-176.21,65.36],[-178.36,65.39],[-178.9,65.74],[-178.69,66.11],[-179.88,65.87],[-179.43,65.4],[-180.0,64.98],[-180.0,68.96],[-174.93,67.21]],
[[-178.69,70.89],[-180.0,70.83],[-180.0,71.52],[-177.58,71.27],[-178.69,70.89]],
[[33.44,45.97],[36.53,45.47],[33.88,44.36],[33.33,44.56],[33.55,45.03],[32.45,45.33],[33.44,45.97]],
[[-78.98,26.79],[-77.82,26.58],[-78.91,26.42],[-78.98,26.79]],
[[-77.79,27.04],[-77.0,26.59],[-77.17,25.88],[-77.79,27.04]],
[[-78.19,25.21],[-77.53,23.76],[-78.41,24.58],[-78.19,25.21]],
[[-61.2,-51.85],[-58.55,-51.1],[-57.75,-51.55],[-59.4,-52.2],[-61.2,-51.85]],
[[15.14,79.67],[16.99,80.05],[21.54,78.96],[19.03,78.56],[17.12,76.81],[15.91,76.77],[13.76,77.38],[14.67,77.74],[11.22,78.87],[10.44,79.65],[15.14,79.67]],
[[31.1,69.56],[28.59,69.06],[29.02,69.77],[27.73,70.16],[26.18,69.83],[24.74,68.65],[21.24,69.37],[20.03,69.07],[19.88,68.41],[17.99,68.57],[17.73,68.01],[16.77,68.01],[13.56,64.79],[13.92,64.45],[13.57,64.05],[12.58,64.07],[11.93,63.13],[11.99,61.8],[12.63,61.29],[12.3,60.12],[11.03,58.86],[10.36,59.47],[8.38,58.31],[7.05,58.08],[5.67,58.59],[4.99,61.97],[10.53,64.49],[14.76,67.81],[19.18,69.82],[23.02,70.2],[24.55,71.03],[28.17,71.19],[31.29,70.45],[30.01,70.19],[31.1,69.56]],
[[27.41,80.06],[23.02,79.4],[17.37,80.32],[22.92,80.66],[27.41,80.06]],
[[24.72,77.85],[20.73,77.68],[21.42,77.94],[20.81,78.25],[22.88,78.45],[24.72,77.85]],
[[-46.76,82.63],[-38.62,83.55],[-27.1,83.52],[-20.85,82.73],[-31.9,82.2],[-22.07,81.73],[-23.17,81.15],[-15.77,81.91],[-12.21,81.29],[-20.05,80.18],[-17.73,80.13],[-19.7,78.75],[-19.67,77.64],[-18.47,76.99],[-21.68,76.63],[-19.83,76.1],[-19.6,75.25],[-20.67,75.16],[-19.37,74.3],[-21.59,74.22],[-20.43,73.82],[-20.76,73.46],[-23.57,73.31],[-22.3,72.18],[-24.79,72.33],[-22.13,71.47],[-21.75,70.66],[-23.54,70.47],[-25.54,71.43],[-25.2,70.75],[-26.36,70.23],[-22.35,70.13],[-27.75,68.47],[-31.78,68.12],[-34.2,66.68],[-39.81,65.46],[-41.19,63.48],[-42.82,62.68],[-42.42,61.9],[-43.38,60.1],[-48.26,60.86],[-51.63,63.63],[-52.28,65.18],[-53.66,66.1],[-53.3,66.84],[-53.97,67.19],[-52.98,68.36],[-51.48,68.73],[-50.87,69.93],[-53.46,69.28],[-54.68,69.61],[-54.36,70.82],[-51.39,70.57],[-55.83,71.65],[-54.72,72.59],[-58.59,75.52],[-61.27,76.1],[-68.5,76.06],[-71.4,77.01],[-66.76,77.38],[-73.3,78.04],[-73.16,78.43],[-65.71,79.39],[-65.32,79.76],[-68.02,80.12],[-62.23,81.32],[-62.65,81.77],[-57.21,82.19],[-53.04,81.89],[-50.39,82.44],[-44.52,81.66],[-46.9,82.2],[-46.76,82.63]],
[[68.94,-48.62],[70.56,-49.26],[70.28,-49.71],[68.75,-49.77],[68.94,-48.62]],
[[124.97,-8.89],[127.34,-8.4],[125.09,-9.39],[124.97,-8.89]],
[[16.34,-28.58],[16.82,-28.08],[18.46,-29.05],[19.89,-28.46],[19.9,-24.77],[20.89,-26.83],[21.61,-26.73],[23.31,-25.27],[25.66,-25.49],[27.12,-23.57],[29.43,-22.09],[31.19,-22.25],[31.93,-24.37],[31.84,-25.84],[31.04,-25.73],[30.69,-26.74],[31.28,-27.29],[32.83,-26.74],[32.2,-28.75],[28.22,-32.77],[25.78,-33.94],[22.57,-33.86],[20.07,-34.8],[18.38,-34.14],[17.93,-32.61],[18.22,-31.66],[16.34,-28.58]],
[[28.98,-28.96],[28.07,-28.85],[27.0,-29.88],[28.11,-30.55],[29.33,-29.26],[28.98,-28.96]],
[[28.98,-28.96],[29.33,-29.26],[28.11,-30.55],[27.0,-29.88],[28.07,-28.85],[28.98,-28.96]],
[[-117.13,32.54],[-114.72,32.72],[-111.02,31.33],[-106.51,31.75],[-103.94,29.27],[-103.11,28.97],[-102.48,29.76],[-101.66,29.78],[-99.02,26.37],[-97.14,25.87],[-97.87,22.44],[-95.9,18.83],[-94.43,18.14],[-91.41,18.88],[-90.77,19.28],[-90.28,21.0],[-87.05,21.54],[-86.85,20.85],[-87.84,18.26],[-91.0,17.82],[-91.0,17.25],[-91.45,17.25],[-90.46,16.07],[-91.75,16.07],[-92.23,14.54],[-93.88,15.94],[-96.56,15.65],[-103.5,18.29],[-105.49,19.95],[-105.27,21.42],[-106.03,22.77],[-112.23,28.95],[-113.15,31.17],[-114.78,31.8],[-114.94,31.39],[-114.67,30.16],[-111.62,26.66],[-110.66,24.3],[-109.41,23.36],[-109.85,22.82],[-112.18,24.74],[-112.3,26.01],[-115.06,27.72],[-114.16,28.57],[-115.52,29.56],[-117.13,32.54]],
[[-57.63,-30.22],[-56.98,-30.11],[-53.79,-32.05],[-53.21,-32.73],[-53.81,-34.4],[-56.22,-34.86],[-58.43,-33.91],[-57.63,-30.22]],
[[-53.37,-33.77],[-53.65,-33.2],[-53.21,-32.73],[-53.79,-32.05],[-56.98,-30.11],[-57.63,-30.22],[-53.65,-26.92],[-53.63,-26.12],[-54.13,-25.55],[-54.63,-25.74],[-54.29,-24.02],[-55.4,-23.96],[-55.8,-22.36],[-57.94,-22.09],[-58.17,-20.18],[-57.5,-18.17],[-58.28,-17.27],[-58.24,-16.3],[-60.16,-16.26],[-60.5,-13.78],[-64.32,-12.46],[-65.4,-11.57],[-65.34,-9.76],[-66.65,-9.93],[-68.27,-11.01],[-70.55,-11.01],[-70.48,-9.49],[-72.18,-10.05],[-73.23,-9.46],[-73.02,-9.03],[-73.99,-7.52],[-73.12,-6.63],[-72.89,-5.27],[-69.89,-4.3],[-69.42,-1.12],[-70.02,0.54],[-69.22,0.99],[-69.8,1.09],[-69.82,1.71],[-67.54,2.04],[-67.07,1.13],[-65.55,0.79],[-63.37,2.2],[-64.27,2.5],[-64.82,4.06],[-63.09,3.77],[-60.97,4.54],[-60.73,5.2],[-59.98,5.01],[-59.54,3.96],[-59.97,2.76],[-59.03,1.32],[-56.0,1.82],[-55.97,2.51],[-52.94,2.12],[-51.32,4.2],[-50.51,1.9],[-49.97,1.74],[-50.7,0.22],[-50.39,-0.08],[-48.62,-0.24],[-48.58,-1.24],[-47.82,-0.58],[-44.91,-1.55],[-44.58,-2.69],[-43.42,-2.38],[-39.98,-2.87],[-37.22,-4.82],[-35.6,-5.15],[-34.73,-7.34],[-35.13,-9.0],[-38.67,-13.06],[-39.27,-17.87],[-40.94,-21.94],[-41.99,-22.97],[-44.65,-23.35],[-47.65,-24.89],[-48.5,-25.88],[-48.89,-28.67],[-53.37,-33.77]],
[[-69.53,-10.95],[-68.27,-11.01],[-66.65,-9.93],[-65.34,-9.76],[-65.4,-11.57],[-64.32,-12.46],[-60.5,-13.78],[-60.16,-16.26],[-58.24,-16.3],[-58.28,-17.27],[-57.5,-18.17],[-57.85,-19.97],[-59.12,-19.36],[-61.79,-19.63],[-62.69,-22.25],[-63.99,-21.99],[-64.38,-22.8],[-64.96,-22.08],[-66.27,-21.83],[-67.83,-22.87],[-68.76,-20.37],[-68.44,-19.41],[-69.59,-17.58],[-68.96,-16.5],[-69.34,-14.95],[-68.67,-12.56],[-69.53,-10.95]],
[[-69.89,-4.3],[-72.89,-5.27],[-73.12,-6.63],[-73.99,-7.52],[-73.02,-9.03],[-73.23,-9.46],[-72.18,-10.05],[-70.48,-9.49],[-70.55,-11.01],[-69.53,-10.95],[-68.67,-12.56],[-69.34,-14.95],[-68.96,-16.5],[-70.37,-18.35],[-76.01,-14.65],[-79.76,-7.19],[-81.25,-6.14],[-80.93,-5.69],[-81.41,-4.74],[-80.3,-3.4],[-80.44,-4.43],[-79.21,-4.96],[-78.64,-4.55],[-77.84,-3.0],[-75.54,-1.56],[-75.11,-0.06],[-73.07,-2.31],[-70.81,-2.26],[-70.05,-2.73],[-70.69,-3.74],[-69.89,-4.3]],
[[-66.88,1.25],[-67.54,2.04],[-69.82,1.71],[-69.8,1.09],[-69.22,0.99],[-70.02,0.54],[-69.42,-1.12],[-69.89,-4.3],[-70.69,-3.74],[-70.05,-2.73],[-70.81,-2.26],[-73.07,-2.31],[-75.11,-0.06],[-77.42,0.4],[-78.99,1.69],[-77.13,3.85],[-77.88,7.22],[-77.24,7.94],[-77.47,8.52],[-75.67,9.44],[-74.91,11.08],[-73.41,11.23],[-71.4,12.38],[-71.33,11.78],[-72.91,10.45],[-73.3,9.15],[-72.79,9.09],[-71.96,6.99],[-70.09,6.96],[-69.39,6.1],[-67.34,6.1],[-67.82,4.5],[-67.3,3.32],[-67.81,2.82],[-66.88,1.25]],
[[-77.35,8.67],[-77.24,7.94],[-77.88,7.22],[-78.18,8.32],[-79.12,9.0],[-80.38,8.3],[-80.0,7.55],[-80.89,7.22],[-81.72,8.11],[-82.85,8.07],[-82.93,9.48],[-81.44,8.79],[-79.02,9.55],[-77.35,8.67]],
[[-82.55,9.57],[-82.97,8.23],[-84.98,10.09],[-85.11,9.56],[-85.66,9.93],[-85.94,10.9],[-83.66,10.94],[-82.55,9.57]],
[[-83.66,10.94],[-85.71,11.09],[-87.67,12.91],[-84.92,14.79],[-83.15,15.0],[-83.66,10.94]],
[[-83.15,15.0],[-84.92,14.79],[-87.32,12.98],[-87.86,13.89],[-89.35,14.42],[-87.9,15.86],[-84.98,16.0],[-83.15,15.0]],
[[-89.35,14.42],[-87.72,13.79],[-87.9,13.15],[-90.1,13.74],[-89.35,14.42]],
[[-92.23,14.54],[-91.75,16.07],[-90.46,16.07],[-91.45,17.25],[-91.0,17.25],[-91.0,17.82],[-89.14,17.81],[-89.23,15.89],[-88.23,15.73],[-89.35,14.42],[-90.1,13.74],[-92.23,14.54]],
[[-89.14,17.81],[-88.11,18.35],[-88.93,15.89],[-89.14,17.81]],
[[-60.73,5.2],[-60.97,4.54],[-63.09,3.77],[-64.82,4.06],[-64.27,2.5],[-63.37,2.2],[-66.33,0.72],[-67.81,2.82],[-67.3,3.32],[-67.82,4.5],[-67.34,6.1],[-69.39,6.1],[-70.09,6.96],[-71.96,6.99],[-72.79,9.09],[-73.3,9.15],[-72.91,10.45],[-71.33,11.78],[-71.95,11.42],[-71.63,10.45],[-72.07,9.87],[-71.26,9.14],[-71.4,10.97],[-70.16,11.38],[-69.94,12.16],[-68.19,10.55],[-66.23,10.65],[-64.89,10.08],[-64.32,10.64],[-61.88,10.72],[-62.73,10.42],[-59.76,8.37],[-61.41,5.96],[-60.73,5.2]],
[[-56.54,1.9],[-58.54,1.27],[-59.65,1.79],[-59.98,5.01],[-61.41,5.96],[-59.76,8.37],[-57.15,5.97],[-58.04,4.06],[-56.54,1.9]],
[[-54.52,2.31],[-55.97,2.51],[-56.0,1.82],[-56.54,1.9],[-57.6,3.33],[-58.04,4.06],[-57.15,5.97],[-53.96,5.76],[-54.48,4.9],[-54.01,3.62],[-54.52,2.31]],
[[-51.66,4.16],[-52.94,2.12],[-54.52,2.31],[-54.01,3.62],[-54.48,4.9],[-53.96,5.76],[-51.66,4.16]],
[[6.19,49.46],[8.1,49.02],[7.47,47.62],[6.04,46.73],[6.84,45.99],[7.44,43.69],[6.53,43.13],[3.1,43.08],[2.99,42.47],[1.83,42.34],[-1.9,43.42],[-1.19,46.01],[-2.96,47.57],[-4.49,47.95],[-4.59,48.68],[-1.62,48.64],[-1.93,49.78],[-0.99,49.35],[1.34,50.13],[1.64,50.95],[2.51,51.15],[4.29,49.91],[6.19,49.46]],
[[8.75,42.63],[9.39,43.01],[9.23,41.38],[8.75,42.63]],
[[-75.37,-0.15],[-75.54,-1.56],[-77.84,-3.0],[-78.64,-4.55],[-79.21,-4.96],[-80.44,-4.43],[-79.77,-2.66],[-80.97,-2.25],[-80.93,-1.06],[-80.09,0.77],[-78.86,1.38],[-75.37,-0.15]],
[[-66.28,18.51],[-65.59,18.23],[-67.18,17.95],[-67.1,18.52],[-66.28,18.51]],
[[-77.57,18.49],[-76.2,17.89],[-78.34,18.23],[-77.57,18.49]],
[[-82.27,23.19],[-78.35,22.51],[-74.18,20.28],[-77.76,19.86],[-77.09,20.41],[-78.14,20.74],[-78.72,21.6],[-82.17,22.39],[-81.8,22.64],[-84.97,21.9],[-82.27,23.19]],
[[31.19,-22.25],[28.02,-21.49],[25.26,-17.74],[27.04,-17.94],[28.95,-16.04],[30.27,-15.51],[32.85,-16.71],[32.66,-20.3],[31.19,-22.25]],
[[29.43,-22.09],[27.12,-23.57],[25.66,-25.49],[23.31,-25.27],[21.61,-26.73],[20.89,-26.83],[19.9,-24.77],[19.9,-21.85],[20.88,-21.81],[20.91,-18.25],[25.26,-17.74],[28.02,-21.49],[29.43,-22.09]],
[[19.9,-24.77],[19.89,-28.46],[18.46,-29.05],[16.82,-28.08],[16.34,-28.58],[15.21,-27.09],[14.26,-22.11],[11.73,-17.3],[13.46,-16.97],[14.06,-17.42],[18.26,-17.31],[21.38,-17.93],[24.03,-17.3],[25.08,-17.58],[23.58,-18.28],[23.2,-17.87],[20.91,-18.25],[20.88,-21.81],[19.9,-21.85],[19.9,-24.77]],
[[-16.71,13.59],[-17.63,14.73],[-16.12,16.46],[-14.58,16.6],[-12.17,14.62],[-11.51,12.44],[-16.68,12.38],[-16.84,13.15],[-13.84,13.51],[-16.71,13.59]],
[[-11.51,12.44],[-12.17,14.62],[-11.67,15.39],[-5.54,15.5],[-6.45,24.96],[-4.92,24.97],[3.15,19.69],[3.16,19.06],[4.27,19.16],[4.27,16.85],[3.64,15.57],[-1.07,14.97],[-4.01,13.47],[-5.22,11.71],[-5.4,10.37],[-8.03,10.21],[-9.13,12.31],[-10.17,11.84],[-11.51,12.44]],
[[-17.06,21.0],[-12.93,21.33],[-12.87,23.28],[-11.94,23.37],[-11.97,25.93],[-8.69,25.88],[-8.68,27.4],[-4.92,24.97],[-6.45,24.96],[-5.54,15.5],[-11.67,15.39],[-12.17,14.62],[-14.58,16.6],[-16.46,16.14],[-16.28,20.09],[-17.06,21.0]],
[[2.69,6.26],[1.87,6.14],[1.66,9.13],[0.77,10.47],[1.45,11.55],[2.85,12.24],[3.8,10.73],[2.72,8.51],[2.69,6.26]],
[[14.85,22.86],[15.1,21.31],[15.9,20.39],[15.25,16.63],[13.97,15.68],[13.54,14.37],[13.95,13.35],[14.6,13.33],[14.18,12.48],[13.08,13.6],[12.3,13.04],[10.99,13.39],[9.01,12.83],[5.44,13.87],[4.11,13.53],[3.61,11.66],[2.85,12.24],[2.15,11.94],[2.18,12.63],[1.02,12.85],[0.37,14.93],[3.64,15.57],[4.27,16.85],[4.27,19.16],[12.0,23.47],[14.14,22.49],[14.85,22.86]],
[[2.69,6.26],[2.72,8.51],[3.71,10.06],[3.68,12.55],[4.37,13.75],[9.01,12.83],[10.99,13.39],[12.3,13.04],[13.08,13.6],[14.58,12.09],[11.75,6.98],[11.06,6.64],[10.12,7.04],[9.23,6.44],[8.5,4.77],[5.9,4.26],[4.33,6.27],[2.69,6.26]],
[[14.5,12.86],[15.47,9.98],[14.17,10.02],[13.95,9.55],[15.44,7.69],[14.54,6.23],[14.48,4.73],[15.86,3.01],[15.94,1.73],[14.34,2.23],[9.65,2.28],[9.8,3.07],[8.49,4.5],[8.76,5.48],[10.12,7.04],[11.06,6.64],[11.75,6.98],[14.42,11.57],[14.5,12.86]],
[[0.9,11.0],[1.66,9.13],[1.87,6.14],[1.06,5.93],[-0.05,10.71],[0.9,11.0]],
[[0.02,11.02],[1.06,5.93],[-1.96,4.71],[-2.86,4.99],[-3.24,6.25],[-2.56,8.22],[-2.94,10.96],[0.02,11.02]],
[[-8.03,10.21],[-6.21,10.52],[-4.33,9.61],[-2.83,9.64],[-2.56,8.22],[-3.24,6.25],[-2.86,4.99],[-4.65,5.17],[-7.71,4.36],[-7.57,5.71],[-8.6,6.47],[-7.83,8.58],[-8.03,10.21]],
[[-13.7,12.59],[-10.17,11.84],[-9.13,12.31],[-8.03,10.21],[-7.83,8.58],[-8.28,7.69],[-9.21,7.31],[-9.76,8.54],[-10.51,8.35],[-11.12,10.05],[-12.43,9.84],[-13.25,8.9],[-15.13,11.04],[-13.74,11.81],[-13.7,12.59]],
[[-16.68,12.38],[-13.7,12.59],[-13.74,11.81],[-15.13,11.04],[-16.68,12.38]],
[[-8.44,7.69],[-8.6,6.47],[-7.57,5.71],[-7.71,4.36],[-11.44,6.79],[-10.23,8.41],[-9.76,8.54],[-9.21,7.31],[-8.44,7.69]],
[[-13.25,8.9],[-12.43,9.84],[-11.12,10.05],[-10.23,8.41],[-11.44,6.79],[-12.95,7.8],[-13.25,8.9]],
[[-5.4,10.37],[-4.28,13.23],[-1.07,14.97],[0.37,14.93],[1.02,12.85],[2.18,12.63],[1.94,11.64],[0.9,11.0],[-2.94,10.96],[-2.83,9.64],[-4.33,9.61],[-5.4,10.37]],
[[27.37,5.23],[24.41,5.11],[22.84,4.71],[22.41,4.03],[19.47,5.03],[18.45,3.5],[17.13,3.73],[16.01,2.27],[14.46,5.45],[15.28,7.42],[17.96,7.89],[18.81,8.98],[21.0,9.48],[22.86,11.14],[23.55,10.09],[23.46,8.95],[27.37,5.23]],
[[18.45,3.5],[17.64,-0.42],[16.41,-1.74],[16.01,-3.54],[14.58,-4.97],[12.62,-4.44],[11.91,-5.04],[11.09,-3.98],[11.86,-3.43],[11.48,-2.77],[12.58,-1.95],[13.99,-2.47],[14.43,-1.33],[13.84,0.04],[14.28,1.2],[13.28,1.31],[13.08,2.27],[15.94,1.73],[17.13,3.73],[18.45,3.5]],
[[11.28,2.26],[12.95,2.32],[13.28,1.31],[14.28,1.2],[13.84,0.04],[14.43,-1.33],[13.99,-2.47],[12.58,-1.95],[11.48,-2.77],[11.86,-3.43],[11.09,-3.98],[8.8,-1.11],[9.49,1.01],[11.29,1.06],[11.28,2.26]],
[[9.65,2.28],[11.28,2.26],[11.29,1.06],[9.49,1.01],[9.65,2.28]],
[[30.74,-8.34],[33.23,-9.68],[33.31,-12.44],[32.69,-13.71],[33.21,-13.97],[30.18,-14.8],[30.27,-15.51],[28.95,-16.04],[27.04,-17.94],[23.22,-17.52],[21.89,-16.08],[21.93,-12.9],[24.02,-12.91],[23.91,-10.93],[25.75,-11.78],[27.16,-11.61],[28.93,-13.25],[29.7,-13.26],[29.62,-12.18],[28.37,-11.79],[28.45,-9.16],[29.0,-8.41],[30.74,-8.34]],
[[32.76,-9.23],[33.74,-9.42],[34.28,-10.16],[34.56,-13.58],[35.69,-14.61],[35.77,-15.9],[35.03,-16.8],[34.38,-16.18],[34.46,-14.61],[32.69,-13.71],[33.49,-10.53],[32.76,-9.23]],
[[34.56,-11.52],[37.47,-11.57],[40.32,-10.32],[40.78,-14.69],[39.45,-16.72],[37.41,-17.59],[34.79,-19.78],[35.56,-22.09],[35.46,-24.12],[33.01,-25.36],[32.57,-25.73],[32.83,-26.74],[32.07,-26.73],[31.19,-22.25],[32.66,-20.3],[32.85,-16.71],[30.34,-15.88],[30.18,-14.8],[33.21,-13.97],[34.46,-14.61],[34.38,-16.18],[35.03,-16.8],[35.77,-15.9],[35.69,-14.61],[34.56,-13.58],[34.56,-11.52]],
[[32.07,-26.73],[31.28,-27.29],[30.69,-26.74],[31.04,-25.73],[31.84,-25.84],[32.07,-26.73]],
[[13.0,-4.78],[12.18,-5.79],[11.91,-5.04],[12.62,-4.44],[13.0,-4.78]],
[[12.32,-6.1],[16.33,-5.88],[17.47,-8.07],[19.02,-7.99],[20.09,-6.94],[21.73,-7.29],[22.16,-11.08],[24.02,-11.24],[24.02,-12.91],[21.93,-12.9],[21.89,-16.08],[23.22,-17.52],[21.38,-17.93],[18.26,-17.31],[14.06,-17.42],[13.46,-16.97],[11.73,-17.3],[12.18,-14.45],[13.74,-11.3],[12.32,-6.1]],
[[30.47,-2.41],[30.75,-3.36],[29.34,-4.5],[29.02,-2.84],[30.47,-2.41]],
[[35.72,32.71],[34.97,31.87],[35.42,31.1],[34.92,29.5],[34.27,31.22],[35.1,33.08],[35.82,33.28],[35.72,32.71]],
[[35.82,33.28],[35.13,33.09],[36.0,34.64],[36.45,34.59],[35.82,33.28]],
[[49.54,-12.47],[50.38,-15.71],[49.67,-15.71],[49.77,-16.88],[47.1,-24.94],[45.41,-25.6],[44.04,-24.99],[43.35,-22.78],[43.43,-21.34],[44.46,-19.44],[43.96,-17.41],[44.45,-16.22],[46.31,-15.78],[47.71,-14.59],[49.19,-12.04],[49.54,-12.47]],
[[35.4,31.49],[34.93,31.35],[35.18,32.53],[35.4,31.49]],
[[-16.71,13.59],[-13.84,13.51],[-16.84,13.15],[-16.71,13.59]],
[[9.48,30.31],[9.06,32.1],[7.61,33.34],[7.52,34.1],[8.14,34.66],[8.42,36.95],[9.51,37.35],[10.21,37.23],[10.18,36.72],[11.03,37.09],[10.6,36.41],[10.81,34.83],[10.15,34.33],[11.49,33.14],[11.43,32.37],[9.95,31.38],[9.97,30.54],[9.48,30.31]],
[[-8.68,27.4],[-8.67,28.84],[-5.24,30.0],[-3.69,30.9],[-3.65,31.64],[-1.31,32.26],[-2.17,35.17],[-1.21,35.71],[1.47,36.61],[8.42,36.95],[8.14,34.66],[7.52,34.1],[7.61,33.34],[9.06,32.1],[9.81,29.42],[9.32,26.09],[10.3,24.38],[10.77,24.56],[12.0,23.47],[5.68,19.6],[3.16,19.06],[3.15,19.69],[-8.68,27.4]],
[[35.55,32.39],[36.83,32.31],[38.79,33.38],[39.2,32.16],[37.0,31.51],[38.0,30.51],[36.07,29.2],[34.92,29.5],[35.55,32.39]],
[[51.58,24.25],[54.01,24.12],[56.07,26.06],[56.26,25.71],[56.4,24.92],[55.89,24.92],[55.98,24.13],[55.01,22.5],[52.0,23.0],[51.58,24.25]],
[[50.81,24.75],[51.29,26.11],[51.61,25.22],[51.39,24.63],[50.81,24.75]],
[[47.97,29.98],[48.42,28.55],[46.57,29.1],[47.3,30.06],[47.97,29.98]],
[[39.2,32.16],[38.79,33.38],[41.01,34.42],[41.29,36.36],[42.78,37.39],[44.77,37.17],[46.08,35.68],[45.42,33.97],[47.33,32.47],[48.57,29.93],[47.3,30.06],[46.57,29.1],[44.71,29.18],[41.89,31.19],[39.2,32.16]],
[[55.21,22.71],[55.89,24.92],[56.4,24.92],[59.81,22.31],[57.83,20.24],[57.69,18.94],[54.79,16.95],[53.11,16.65],[52.0,19.0],[55.0,20.0],[55.67,22.0],[55.21,22.71]],
[[56.26,25.71],[56.36,26.4],[56.26,25.71]],
[[167.22,-15.89],[167.84,-16.47],[167.22,-15.89]],
[[166.79,-15.67],[166.63,-14.63],[167.27,-15.74],[166.79,-15.67]],
[[102.58,12.19],[102.35,13.39],[102.99,14.23],[106.04,13.88],[106.5,14.57],[107.61,13.54],[107.49,12.34],[105.81,11.57],[106.25,10.96],[103.5,10.63],[102.58,12.19]],
[[105.22,14.27],[102.99,14.23],[102.35,13.39],[102.58,12.19],[100.83,12.63],[100.98,13.41],[100.1,13.41],[99.22,9.24],[99.87,9.21],[100.46,7.43],[102.14,6.22],[101.15,5.69],[98.15,8.35],[99.59,11.89],[98.19,15.12],[98.9,16.18],[97.38,18.45],[98.25,19.71],[100.12,20.42],[100.61,19.51],[101.28,19.46],[101.06,17.51],[103.2,18.31],[104.72,17.43],[104.78,16.44],[105.59,15.57],[105.22,14.27]],
[[107.38,14.2],[106.5,14.57],[106.04,13.88],[105.22,14.27],[105.59,15.57],[103.96,18.24],[101.06,17.51],[101.28,19.46],[100.61,19.51],[100.12,20.42],[101.18,21.44],[101.8,21.17],[101.65,22.32],[102.17,22.46],[103.2,20.77],[104.44,20.76],[104.82,19.89],[103.9,19.27],[105.09,18.67],[107.31,15.91],[107.38,14.2]],
[[100.12,20.42],[98.25,19.71],[97.38,18.45],[98.9,16.18],[98.19,15.12],[99.59,11.89],[98.55,9.93],[98.51,13.12],[97.16,16.93],[95.37,15.71],[94.19,16.04],[94.32,18.21],[93.66,19.73],[92.37,20.67],[92.3,21.48],[93.17,22.28],[93.33,24.08],[94.11,23.85],[95.12,26.57],[96.42,27.26],[97.13,27.08],[97.33,28.26],[98.68,27.51],[98.67,25.92],[97.72,25.08],[97.6,23.9],[98.66,24.06],[98.9,23.14],[99.53,22.95],[99.24,22.12],[100.42,21.56],[101.15,21.85],[100.12,20.42]],
[[104.33,10.49],[106.25,10.96],[105.81,11.57],[107.49,12.34],[107.56,15.2],[105.09,18.67],[103.9,19.27],[104.82,19.89],[104.44,20.76],[103.2,20.77],[102.17,22.46],[105.33,23.35],[108.05,21.55],[106.72,20.7],[105.66,19.06],[108.88,15.28],[109.2,11.67],[105.16,8.6],[105.08,9.92],[104.33,10.49]],
[[130.64,42.4],[129.67,41.6],[129.71,40.88],[127.53,39.76],[127.39,39.21],[128.21,38.37],[125.28,37.67],[124.71,38.11],[125.39,39.39],[124.27,39.93],[125.08,40.57],[126.87,41.82],[128.21,41.47],[128.05,41.99],[129.99,42.99],[130.64,42.4]],
[[126.17,37.75],[128.35,38.61],[129.46,36.78],[129.09,35.08],[126.49,34.39],[126.12,36.73],[126.86,36.89],[126.17,37.75]],
[[87.75,49.3],[92.23,50.8],[97.26,49.73],[98.23,50.42],[97.83,51.01],[98.86,52.05],[102.07,51.26],[102.26,50.51],[103.68,50.09],[106.89,50.27],[108.48,49.28],[110.66,49.13],[114.36,50.25],[116.68,49.89],[115.49,48.14],[115.74,47.73],[118.06,48.07],[119.77,47.05],[117.42,46.67],[113.46,44.81],[111.87,45.1],[111.35,44.46],[111.83,43.74],[110.41,42.87],[104.96,41.6],[100.85,42.66],[96.35,42.73],[95.31,44.24],[90.95,45.29],[90.59,45.72],[90.97,46.89],[90.28,47.69],[88.01,48.6],[87.75,49.3]],
[[97.33,28.26],[97.13,27.08],[96.42,27.26],[95.12,26.57],[94.11,23.85],[93.33,24.08],[93.17,22.28],[92.67,22.04],[92.15,23.63],[91.71,22.99],[91.16,23.5],[92.38,24.98],[89.92,25.27],[89.83,25.97],[88.56,26.45],[88.21,25.77],[88.93,25.24],[88.08,24.5],[88.7,24.23],[88.89,21.69],[86.98,21.5],[86.5,20.15],[85.06,19.48],[82.19,16.56],[80.32,15.9],[79.86,10.36],[77.54,7.97],[76.59,8.9],[73.53,15.99],[72.63,21.36],[70.47,20.88],[69.16,22.09],[69.64,22.45],[69.35,22.84],[68.18,23.69],[68.84,24.36],[71.04,24.36],[69.51,26.94],[70.62,27.99],[71.78,27.91],[75.26,32.27],[74.45,32.76],[73.75,34.32],[74.24,34.75],[76.87,34.65],[77.84,35.49],[78.91,34.32],[79.21,32.99],[79.18,32.48],[78.46,32.62],[78.74,31.52],[81.11,30.18],[80.09,28.79],[83.3,27.36],[88.06,26.41],[88.12,27.88],[88.73,28.09],[88.84,27.1],[89.74,26.72],[92.03,26.84],[91.7,27.77],[94.57,29.28],[96.12,29.45],[96.59,28.83],[96.25,28.41],[97.33,28.26]],
[[92.67,22.04],[92.37,20.67],[91.42,22.77],[90.5,22.81],[90.27,21.84],[89.03,22.06],[88.7,24.23],[88.08,24.5],[88.93,25.24],[88.21,25.77],[88.56,26.45],[89.83,25.97],[89.92,25.27],[92.38,24.98],[91.16,23.5],[91.71,22.99],[92.15,23.63],[92.67,22.04]],
[[91.7,27.77],[92.03,26.84],[88.84,27.1],[90.02,28.3],[91.7,27.77]],
[[88.12,27.88],[88.06,26.41],[87.23,26.4],[80.09,28.79],[81.53,30.42],[85.82,28.2],[88.12,27.88]],
[[77.84,35.49],[76.87,34.65],[74.24,34.75],[73.75,34.32],[74.45,32.76],[75.26,32.27],[71.78,27.91],[70.62,27.99],[69.51,26.94],[71.04,24.36],[68.84,24.36],[68.18,23.69],[66.37,25.43],[61.5,25.08],[61.87,26.24],[63.32,26.76],[62.73,28.26],[60.87,29.83],[62.55,29.32],[66.35,29.89],[66.94,31.3],[69.32,31.9],[69.26,32.5],[70.32,33.36],[69.93,34.02],[70.88,33.99],[71.61,35.15],[71.26,36.07],[71.85,36.51],[75.16,37.13],[76.19,35.9],[77.84,35.49]],
[[66.52,37.36],[69.2,37.15],[70.81,38.49],[71.84,36.74],[73.26,37.5],[75.16,37.13],[71.26,36.07],[71.61,35.15],[70.88,33.99],[69.93,34.02],[70.32,33.36],[69.26,32.5],[69.32,31.9],[66.94,31.3],[66.35,29.89],[62.55,29.32],[60.87,29.83],[61.78,30.74],[60.54,32.98],[61.21,35.65],[62.98,35.4],[64.55,36.31],[64.75,37.11],[65.75,37.66],[66.52,37.36]],
[[67.83,37.14],[68.39,38.16],[68.18,38.9],[67.44,39.14],[67.7,39.58],[68.54,39.53],[69.33,40.73],[70.67,40.96],[70.46,40.5],[71.01,40.24],[69.56,40.1],[69.46,39.53],[73.68,39.43],[73.93,38.51],[74.86,38.38],[74.98,37.42],[73.26,37.5],[71.84,36.74],[70.81,38.49],[69.2,37.15],[67.83,37.14]],
[[70.96,42.27],[71.84,42.85],[73.49,42.5],[74.21,43.3],[80.26,42.35],[76.9,41.07],[76.53,40.43],[74.78,40.37],[73.68,39.43],[69.46,39.53],[69.56,40.1],[71.77,40.15],[73.06,40.87],[70.42,41.52],[70.96,42.27]],
[[52.5,41.78],[54.08,42.32],[55.46,41.26],[57.1,41.32],[56.93,41.83],[58.63,42.75],[59.98,42.22],[60.47,41.22],[61.88,41.08],[62.37,40.05],[64.17,38.89],[66.55,37.97],[66.52,37.36],[65.75,37.66],[64.75,37.11],[64.55,36.31],[62.23,35.27],[61.21,35.65],[61.12,36.49],[57.33,38.03],[55.51,37.96],[53.92,37.2],[53.88,38.95],[53.1,39.29],[53.36,39.98],[52.69,40.03],[52.92,40.88],[54.74,40.95],[53.72,42.12],[52.92,41.87],[52.81,41.14],[52.5,41.78]],
[[48.57,29.93],[47.33,32.47],[45.42,33.97],[46.08,35.68],[44.23,37.97],[44.11,39.43],[44.79,39.71],[46.14,38.74],[48.06,39.58],[48.01,38.79],[49.2,37.58],[50.84,36.87],[53.83,36.97],[56.62,38.12],[61.12,36.49],[60.54,32.98],[61.78,30.74],[60.87,29.83],[62.73,28.26],[63.32,26.76],[61.87,26.24],[61.5,25.08],[57.4,25.74],[56.97,26.97],[54.72,26.48],[53.49,26.81],[51.52,27.87],[50.12,30.15],[48.57,29.93]],
[[35.72,32.71],[36.61,34.2],[35.91,35.41],[36.74,36.82],[42.35,37.23],[41.29,36.36],[41.01,34.42],[36.83,32.31],[35.72,32.71]],
[[46.51,38.77],[43.66,40.25],[43.58,41.09],[45.56,40.81],[46.51,38.77]],
[[11.03,58.86],[12.3,60.12],[12.63,61.29],[11.99,61.8],[11.93,63.13],[12.58,64.07],[13.57,64.05],[13.92,64.45],[13.56,64.79],[16.77,68.01],[17.73,68.01],[17.99,68.57],[19.88,68.41],[20.03,69.07],[20.65,69.11],[23.54,67.94],[23.9,66.01],[22.18,65.72],[21.21,65.03],[21.37,64.41],[17.85,62.75],[17.12,61.34],[18.79,60.08],[17.87,58.95],[16.83,58.72],[15.88,56.1],[14.67,56.2],[14.1,55.41],[12.94,55.36],[11.03,58.86]],
[[28.18,56.17],[30.87,55.55],[30.76,54.81],[32.69,53.35],[31.31,53.07],[31.79,52.1],[30.93,52.04],[30.56,51.32],[25.33,51.91],[23.53,51.58],[23.48,53.91],[25.54,54.28],[26.49,55.62],[28.18,56.17]],
[[31.79,52.1],[33.75,52.34],[34.39,51.77],[34.22,51.26],[35.02,51.21],[35.36,50.58],[40.07,49.6],[39.74,47.9],[34.96,46.27],[35.01,45.74],[31.68,46.71],[30.75,46.58],[29.6,45.29],[28.68,45.3],[28.23,45.49],[28.86,46.44],[30.02,46.42],[28.67,48.12],[27.52,48.47],[24.87,47.74],[22.71,47.88],[22.09,48.42],[22.78,49.03],[22.52,49.48],[23.92,50.42],[23.53,51.58],[25.33,51.91],[30.56,51.32],[30.93,52.04],[31.79,52.1]],
[[23.48,53.91],[23.8,52.69],[23.2,52.49],[24.03,50.71],[22.52,49.48],[22.78,49.03],[21.61,49.47],[19.83,49.22],[17.55,50.36],[16.18,50.42],[15.02,51.11],[14.07,52.98],[14.12,53.76],[17.62,54.85],[23.48,53.91]],
[[16.98,48.12],[16.01,46.68],[14.63,46.43],[12.15,47.12],[11.05,46.75],[9.48,47.1],[9.9,47.58],[12.93,47.47],[12.88,48.29],[13.6,48.88],[16.5,48.79],[16.98,48.12]],
[[22.09,48.42],[22.71,47.88],[21.02,46.32],[18.46,45.76],[16.2,46.85],[16.98,48.12],[17.86,47.76],[20.8,48.62],[22.09,48.42]],
[[26.62,48.22],[28.67,48.12],[30.02,46.42],[28.86,46.44],[28.23,45.49],[28.13,46.81],[26.62,48.22]],
[[28.23,45.49],[29.6,45.29],[28.84,44.91],[28.56,43.71],[27.24,44.18],[22.94,43.82],[22.71,44.58],[21.56,44.77],[20.22,46.13],[23.14,48.1],[24.87,47.74],[26.62,48.22],[28.13,46.81],[28.23,45.49]],
[[26.49,55.62],[25.54,54.28],[23.48,53.91],[22.76,54.86],[21.27,55.19],[21.06,56.03],[24.86,56.37],[26.49,55.62]],
[[27.29,57.47],[28.18,56.17],[26.49,55.62],[24.86,56.37],[21.06,56.03],[21.58,57.41],[22.52,57.75],[23.32,57.01],[24.12,57.03],[24.31,57.79],[25.16,57.97],[27.29,57.47]],
[[27.98,59.48],[27.29,57.47],[24.31,57.79],[24.43,58.38],[23.43,58.61],[23.34,59.19],[27.98,59.48]],
[[14.12,53.76],[15.02,51.11],[12.24,50.27],[13.6,48.88],[12.88,48.29],[12.93,47.47],[7.47,47.62],[8.1,49.02],[6.66,49.2],[6.04,50.13],[5.99,51.85],[6.84,52.23],[7.1,53.69],[8.12,53.53],[8.8,54.02],[8.53,54.96],[9.92,54.98],[10.94,54.01],[12.52,54.47],[14.12,53.76]],
[[22.66,44.23],[22.94,43.82],[27.24,44.18],[28.56,43.71],[27.67,42.58],[28.0,42.01],[26.12,41.83],[26.11,41.33],[22.95,41.34],[22.38,42.32],[22.99,43.21],[22.66,44.23]],
[[26.29,35.3],[24.72,34.92],[23.51,35.28],[23.7,35.71],[26.29,35.3]],
[[22.95,41.34],[26.6,41.56],[26.06,40.82],[23.71,40.69],[24.41,40.12],[22.63,40.26],[24.04,37.66],[23.12,37.92],[23.41,37.41],[22.77,37.31],[23.15,36.42],[22.49,36.41],[21.67,36.84],[20.15,39.62],[21.02,40.84],[22.95,41.34]],
[[44.77,37.17],[36.74,36.82],[36.15,35.82],[35.78,36.27],[36.16,36.65],[34.71,36.8],[34.03,36.22],[30.62,36.68],[29.7,36.14],[27.64,36.66],[26.32,38.21],[26.8,38.99],[26.17,39.46],[27.28,40.42],[28.82,40.46],[29.24,41.22],[31.15,41.09],[33.51,42.02],[35.17,42.04],[38.35,40.95],[42.62,41.58],[44.79,39.71],[44.11,39.43],[44.77,37.17]],
[[26.12,41.83],[28.0,42.01],[28.99,41.3],[26.36,40.15],[26.06,40.82],[26.6,41.56],[26.12,41.83]],
[[21.02,40.84],[20.15,39.62],[19.41,40.25],[19.3,42.2],[19.74,42.69],[20.52,42.22],[21.02,40.84]],
[[16.56,46.5],[18.83,45.91],[19.39,45.24],[19.01,44.86],[15.96,45.23],[15.75,44.82],[18.45,42.48],[16.02,43.51],[14.9,45.08],[13.66,45.14],[15.33,45.45],[16.56,46.5]],
[[9.59,47.53],[10.36,46.48],[7.27,45.78],[6.02,46.27],[6.74,47.54],[9.59,47.53]],
[[6.04,50.13],[6.19,49.46],[5.67,49.53],[6.04,50.13]],
[[6.16,50.8],[5.67,49.53],[2.51,51.15],[4.97,51.48],[6.16,50.8]],
[[6.91,53.48],[6.84,52.23],[5.99,51.85],[6.16,50.8],[4.97,51.48],[3.31,51.35],[4.71,53.09],[6.91,53.48]],
[[-9.03,41.88],[-8.26,42.28],[-6.39,41.38],[-7.5,39.63],[-7.03,38.08],[-7.86,36.84],[-8.9,36.87],[-8.84,38.27],[-9.53,38.74],[-8.77,40.76],[-9.03,41.88]],
[[-7.45,37.1],[-7.03,38.08],[-7.5,39.63],[-6.39,41.38],[-8.26,42.28],[-9.03,41.88],[-9.39,43.03],[-7.98,43.75],[-1.9,43.42],[0.34,42.58],[2.99,42.47],[3.04,41.89],[2.09,41.23],[0.81,41.01],[-0.28,39.31],[0.11,38.74],[-2.15,36.67],[-4.37,36.68],[-5.38,35.95],[-7.45,37.1]],
[[-6.2,53.87],[-6.03,53.15],[-6.79,52.26],[-9.98,51.82],[-9.17,52.86],[-9.69,53.88],[-7.57,55.13],[-7.57,54.06],[-6.2,53.87]],
[[165.78,-21.08],[167.12,-22.16],[165.47,-21.68],[164.03,-20.11],[165.78,-21.08]],
[[162.12,-10.48],[162.4,-10.83],[161.7,-10.82],[161.32,-10.2],[162.12,-10.48]],
[[161.68,-9.6],[160.58,-8.32],[161.68,-9.6]],
[[160.85,-9.87],[159.85,-9.79],[159.7,-9.24],[160.85,-9.87]],
[[159.64,-8.02],[159.92,-8.54],[158.21,-7.42],[159.64,-8.02]],
[[157.14,-7.02],[157.54,-7.35],[156.54,-6.6],[157.14,-7.02]],
[[176.89,-40.07],[176.01,-41.29],[175.24,-41.69],[174.65,-41.28],[175.23,-40.46],[173.82,-39.51],[174.57,-38.8],[174.7,-37.38],[172.64,-34.53],[174.33,-35.27],[175.96,-37.56],[178.52,-37.7],[177.97,-39.17],[177.21,-39.15],[176.89,-40.07]],
[[169.67,-43.56],[172.8,-40.49],[173.25,-41.33],[173.96,-40.93],[174.25,-41.35],[172.71,-43.37],[173.08,-43.85],[171.45,-44.24],[170.62,-45.91],[169.33,-46.64],[166.68,-46.22],[167.05,-45.11],[169.67,-43.56]],
[[147.69,-40.81],[148.29,-40.88],[147.91,-43.21],[146.05,-43.55],[144.74,-40.7],[146.36,-41.14],[147.69,-40.81]],
[[126.15,-32.22],[124.22,-32.96],[123.66,-33.89],[119.89,-33.98],[118.02,-35.06],[116.63,-35.03],[115.03,-34.2],[115.8,-32.21],[113.34,-26.12],[113.78,-26.55],[113.44,-25.62],[114.23,-26.3],[113.39,-24.38],[113.74,-22.48],[114.15,-21.76],[114.23,-22.52],[116.71,-20.7],[120.86,-19.68],[123.01,-16.41],[123.43,-17.27],[123.86,-17.07],[123.5,-16.6],[123.82,-16.11],[124.26,-16.33],[125.69,-14.23],[127.07,-13.82],[128.36,-14.87],[129.62,-14.97],[129.41,-14.42],[130.62,-12.54],[132.58,-12.11],[131.82,-11.27],[132.36,-11.13],[135.3,-12.25],[136.49,-11.86],[136.95,-12.35],[135.96,-13.32],[135.5,-15.0],[140.22,-17.71],[141.27,-16.39],[141.69,-12.41],[142.52,-10.67],[143.92,-14.55],[144.56,-14.17],[145.37,-14.98],[146.39,-18.96],[148.85,-20.39],[149.68,-22.34],[150.73,-22.4],[150.9,-23.46],[152.86,-25.27],[153.57,-28.11],[152.89,-31.64],[150.33,-35.67],[150.0,-37.43],[146.32,-39.04],[144.88,-38.42],[145.03,-37.9],[143.61,-38.81],[140.64,-38.02],[139.57,-36.14],[138.12,-35.61],[138.21,-34.38],[136.83,-35.26],[137.89,-33.64],[137.81,-32.9],[135.99,-34.89],[135.21,-34.48],[134.27,-32.62],[131.33,-31.5],[126.15,-32.22]],
[[81.79,7.52],[81.64,6.48],[80.35,5.97],[79.7,8.2],[80.15,9.82],[81.79,7.52]],
[[109.48,18.2],[108.66,18.51],[108.63,19.37],[110.79,20.08],[110.34,18.68],[109.48,18.2]],
[[80.26,42.35],[80.18,42.92],[80.87,43.18],[79.97,44.92],[82.46,45.54],[83.18,47.33],[85.16,47.0],[85.77,48.46],[87.75,49.3],[88.01,48.6],[90.28,47.69],[90.97,46.89],[90.59,45.72],[90.95,45.29],[95.31,44.24],[96.35,42.73],[100.85,42.66],[104.96,41.6],[109.24,42.52],[111.83,43.74],[111.35,44.46],[111.87,45.1],[113.46,44.81],[117.42,46.67],[119.66,46.69],[118.06,48.07],[115.74,47.73],[115.49,48.14],[116.68,49.89],[117.88,49.51],[119.29,50.14],[120.74,51.96],[120.18,52.75],[122.25,53.43],[125.95,52.79],[127.66,49.76],[129.4,49.44],[130.58,48.73],[130.99,47.79],[135.03,48.48],[133.1,45.14],[131.03,44.97],[131.14,42.93],[130.63,42.9],[130.64,42.4],[129.99,42.99],[128.05,41.99],[128.21,41.47],[126.87,41.82],[124.27,39.93],[121.05,38.9],[122.17,40.42],[121.64,40.95],[117.53,38.74],[119.7,37.16],[120.82,37.87],[122.36,37.45],[122.52,36.93],[121.1,36.65],[119.15,34.91],[120.23,34.36],[121.91,31.69],[121.89,30.95],[121.26,30.68],[122.09,29.83],[121.68,28.23],[121.13,28.14],[118.66,24.55],[115.89,22.78],[110.79,21.4],[110.44,20.34],[109.89,20.28],[109.86,21.4],[107.04,21.81],[106.73,22.79],[105.33,23.35],[101.65,22.32],[101.8,21.17],[101.27,21.2],[101.15,21.85],[100.42,21.56],[99.24,22.12],[99.53,22.95],[98.9,23.14],[98.66,24.06],[97.6,23.9],[97.72,25.08],[98.67,25.92],[98.68,27.51],[97.91,28.34],[96.25,28.41],[96.59,28.83],[96.12,29.45],[94.57,29.28],[92.5,27.9],[90.02,28.3],[88.81,27.3],[88.73,28.09],[85.82,28.2],[78.74,31.52],[78.46,32.62],[79.18,32.48],[79.21,32.99],[78.91,34.32],[77.84,35.49],[76.19,35.9],[74.98,37.42],[74.86,38.38],[73.93,38.51],[73.68,39.43],[74.78,40.37],[76.53,40.43],[76.9,41.07],[80.26,42.35]],
[[121.78,24.39],[120.75,21.97],[120.11,23.56],[121.5,25.3],[121.78,24.39]],
[[10.44,46.89],[12.15,47.12],[13.81,46.51],[13.94,45.59],[12.33,45.38],[12.59,44.09],[15.14,41.96],[15.93,41.96],[15.89,41.54],[18.38,40.36],[18.29,39.81],[16.87,40.44],[16.45,39.8],[17.17,39.42],[17.05,38.9],[15.68,37.91],[16.11,38.96],[15.41,40.05],[11.19,42.36],[10.2,43.92],[8.89,44.37],[7.44,43.69],[6.84,45.99],[8.97,46.04],[10.44,46.89]],
[[14.76,38.14],[15.52,38.23],[15.1,36.62],[12.43,37.61],[12.57,38.13],[14.76,38.14]],
[[8.71,40.9],[9.21,41.21],[9.81,40.5],[9.67,39.18],[8.81,38.91],[8.16,40.95],[8.71,40.9]],
[[9.92,54.98],[8.53,54.96],[8.09,56.54],[10.58,57.73],[10.25,56.89],[10.91,56.46],[9.65,55.47],[9.92,54.98]],
[[12.37,56.11],[12.69,55.61],[12.09,54.8],[11.04,55.36],[10.9,55.78],[12.37,56.11]],
[[-6.2,53.87],[-7.57,54.06],[-7.57,55.13],[-5.66,54.55],[-6.2,53.87]],
[[-3.09,53.4],[-2.95,53.98],[-3.63,54.62],[-5.08,55.06],[-5.05,55.78],[-5.59,55.31],[-6.15,56.79],[-5.01,58.63],[-3.01,58.63],[-4.07,57.55],[-1.96,57.68],[-3.12,55.97],[-2.09,55.91],[0.47,52.93],[1.68,52.74],[1.05,51.81],[1.45,51.29],[0.55,50.77],[-5.78,50.16],[-3.41,51.43],[-5.27,51.99],[-4.22,52.3],[-4.77,52.84],[-4.58,53.5],[-3.09,53.4]],
[[-14.51,66.46],[-14.74,65.81],[-13.61,65.13],[-18.66,63.5],[-22.76,63.96],[-21.78,64.4],[-23.96,64.89],[-22.23,65.38],[-24.33,65.61],[-23.65,66.26],[-22.13,66.41],[-20.58,65.73],[-19.06,66.28],[-14.51,66.46]],
[[46.4,41.86],[47.82,41.15],[48.58,41.81],[50.39,40.26],[49.57,40.18],[48.88,38.32],[48.01,38.79],[48.06,39.58],[46.51,38.77],[46.48,39.46],[45.61,39.9],[45.89,40.22],[44.97,41.25],[46.5,41.06],[46.4,41.86]],
[[46.14,38.74],[44.79,39.71],[45.74,39.47],[46.14,38.74]],
[[39.96,43.43],[45.47,42.5],[46.64,41.18],[41.55,41.54],[41.45,42.65],[39.96,43.43]],
[[120.83,12.7],[120.32,13.47],[121.53,13.07],[121.26,12.21],[120.83,12.7]],
[[122.59,9.98],[122.95,10.88],[123.5,10.94],[123.34,10.27],[124.08,11.23],[123.0,9.02],[122.59,9.98]],
[[126.38,8.41],[126.54,7.19],[126.2,6.27],[125.83,7.29],[125.36,6.79],[125.4,5.58],[124.22,6.16],[124.24,7.36],[123.61,7.83],[121.92,7.19],[123.49,8.69],[123.84,8.24],[125.47,8.99],[125.41,9.76],[126.22,9.29],[126.38,8.41]],
[[118.5,9.32],[117.17,8.37],[119.51,11.37],[119.69,10.55],[118.5,9.32]],
[[122.34,18.22],[122.52,17.09],[121.66,15.93],[121.73,14.33],[123.95,13.78],[124.08,12.54],[122.93,13.55],[122.67,13.19],[122.03,13.78],[120.63,13.86],[120.99,14.53],[120.56,14.4],[119.92,15.41],[120.72,18.51],[122.34,18.22]],
[[122.04,11.42],[121.88,11.89],[123.12,11.58],[122.0,10.44],[122.04,11.42]],
[[125.5,12.16],[125.78,11.05],[125.01,11.31],[125.28,10.36],[124.8,10.13],[124.3,11.5],[124.88,11.79],[124.27,12.56],[125.5,12.16]],
[[100.09,6.46],[101.08,6.2],[101.15,5.69],[102.14,6.22],[102.96,5.52],[104.23,1.29],[103.52,1.23],[101.39,2.76],[100.09,6.46]],
[[117.88,4.14],[115.87,4.31],[114.62,1.43],[110.51,0.77],[109.83,1.34],[109.66,2.01],[111.17,1.85],[111.37,2.7],[113.0,3.1],[114.2,4.53],[114.66,4.01],[115.35,4.32],[115.45,5.45],[116.73,6.92],[119.18,5.41],[117.88,4.14]],
[[115.45,5.45],[115.35,4.32],[114.66,4.01],[114.2,4.53],[115.45,5.45]],
[[13.81,46.51],[16.56,46.5],[15.33,45.45],[13.72,45.5],[13.81,46.51]],
[[28.59,69.06],[28.45,68.36],[29.98,67.7],[29.05,66.94],[30.22,65.81],[29.54,64.95],[30.44,64.2],[30.04,63.55],[31.52,62.87],[31.14,62.36],[28.07,60.5],[22.87,59.85],[21.32,60.72],[21.54,61.71],[21.06,62.61],[21.54,63.19],[25.4,65.11],[23.57,66.4],[23.54,67.94],[20.65,69.11],[24.74,68.65],[26.18,69.83],[27.73,70.16],[29.02,69.77],[28.59,69.06]],
[[22.56,49.09],[21.87,48.32],[20.8,48.62],[17.86,47.76],[16.88,48.47],[18.55,49.5],[22.56,49.09]],
[[15.02,51.11],[18.85,49.5],[16.96,48.6],[15.25,49.04],[14.34,48.56],[12.52,49.55],[12.24,50.27],[15.02,51.11]],
[[36.43,14.42],[36.85,16.96],[38.41,18.0],[39.27,15.92],[43.08,12.7],[42.35,12.54],[40.03,14.52],[37.91,14.96],[37.59,14.21],[36.43,14.42]],
[[141.88,39.18],[140.96,38.17],[140.25,35.14],[137.22,34.61],[135.79,33.46],[135.12,33.85],[135.08,34.6],[130.99,33.89],[132.0,33.15],[131.33,31.45],[130.69,31.03],[130.2,31.42],[130.45,32.32],[129.41,33.3],[132.62,35.43],[135.68,35.53],[136.72,37.3],[137.39,36.83],[139.43,38.22],[140.31,41.2],[141.37,41.38],[141.88,39.18]],
[[144.61,43.96],[145.32,44.38],[145.54,43.26],[144.06,42.99],[143.18,42.0],[141.61,42.68],[141.07,41.58],[139.96,41.57],[139.82,42.56],[140.31,43.33],[141.38,43.39],[141.97,45.55],[144.61,43.96]],
[[132.37,33.46],[133.9,34.36],[134.77,33.81],[134.2,33.2],[133.28,33.29],[133.01,32.7],[132.37,33.46]],
[[-58.17,-20.18],[-57.94,-22.09],[-55.8,-22.36],[-55.4,-23.96],[-54.29,-24.02],[-54.79,-26.62],[-55.7,-27.39],[-58.62,-27.12],[-57.78,-25.16],[-60.85,-23.88],[-62.69,-22.25],[-61.79,-19.63],[-59.12,-19.36],[-58.17,-20.18]],
[[52.0,19.0],[53.11,16.65],[52.39,16.38],[52.17,15.6],[44.99,12.7],[43.48,12.64],[42.6,15.21],[43.38,17.58],[47.0,16.95],[49.12,18.62],[52.0,19.0]],
[[34.96,29.36],[36.07,29.2],[37.5,30.0],[38.0,30.51],[37.0,31.51],[39.2,32.16],[41.89,31.19],[44.71,29.18],[47.46,29.0],[50.15,26.69],[50.24,25.61],[51.39,24.63],[52.0,23.0],[55.21,22.71],[55.67,22.0],[55.0,20.0],[49.12,18.62],[47.0,16.95],[43.38,17.58],[42.78,16.35],[40.94,19.49],[39.14,21.29],[38.49,23.69],[37.48,24.29],[35.13,28.06],[34.63,28.06],[34.96,29.36]],
[[-48.66,-78.05],[-46.66,-77.83],[-43.92,-78.48],[-43.33,-80.03],[-50.48,-81.03],[-54.16,-80.63],[-50.99,-79.61],[-48.66,-78.05]],
[[-66.29,-80.26],[-61.88,-80.39],[-60.61,-79.63],[-59.57,-80.04],[-60.16,-81.0],[-64.49,-80.92],[-66.29,-80.26]],
[[-73.92,-71.27],[-72.07,-71.19],[-71.74,-69.51],[-70.25,-68.88],[-68.33,-71.41],[-68.78,-72.17],[-71.08,-72.5],[-74.95,-72.07],[-75.01,-71.66],[-73.92,-71.27]],
[[-102.33,-71.89],[-96.79,-71.95],[-96.2,-72.52],[-100.78,-72.5],[-102.33,-71.89]],
[[-122.62,-73.66],[-118.72,-73.48],[-120.23,-74.09],[-122.62,-73.66]],
[[-127.28,-73.46],[-124.03,-73.87],[-127.28,-73.46]],
[[-163.71,-78.6],[-161.25,-78.38],[-159.21,-79.5],[-161.13,-79.63],[-163.71,-78.6]],
[[180.0,-84.71],[180.0,-90.0],[-180.0,-90.0],[-180.0,-84.71],[-179.06,-84.14],[-174.38,-84.53],[-169.95,-83.88],[-158.07,-85.37],[-148.53,-85.61],[-143.11,-85.04],[-142.89,-84.57],[-153.59,-83.69],[-152.86,-82.04],[-156.84,-81.1],[-150.65,-81.34],[-146.42,-80.34],[-149.53,-79.36],[-155.33,-79.06],[-158.05,-78.03],[-158.37,-76.89],[-151.33,-77.4],[-146.1,-76.48],[-146.2,-75.38],[-135.21,-74.3],[-121.07,-74.52],[-113.94,-73.71],[-112.3,-74.71],[-111.26,-74.42],[-107.56,-75.18],[-100.65,-75.3],[-100.12,-74.87],[-102.55,-74.11],[-103.68,-72.62],[-96.34,-73.62],[-90.09,-73.32],[-89.23,-72.56],[-81.47,-73.85],[-80.3,-73.13],[-74.89,-73.87],[-67.37,-72.48],[-67.25,-71.64],[-68.54,-69.72],[-67.43,-68.15],[-67.74,-67.33],[-63.63,-64.9],[-57.81,-63.27],[-57.22,-63.53],[-62.02,-64.8],[-62.65,-65.48],[-62.12,-66.19],[-63.75,-66.5],[-65.67,-67.95],[-63.2,-69.23],[-61.81,-70.72],[-60.83,-73.7],[-64.35,-75.26],[-70.6,-76.63],[-77.24,-76.71],[-73.66,-77.91],[-77.93,-78.38],[-78.02,-79.18],[-75.36,-80.26],[-59.69,-82.38],[-58.22,-83.22],[-49.76,-81.73],[-42.81,-82.08],[-40.77,-81.36],[-28.55,-80.34],[-29.69,-79.26],[-35.64,-79.46],[-35.78,-78.34],[-28.88,-76.67],[-17.52,-75.13],[-15.7,-74.5],[-15.41,-74.11],[-16.47,-73.87],[-15.45,-73.15],[-12.29,-72.4],[-10.3,-71.27],[-7.42,-71.7],[-6.87,-70.93],[-4.34,-71.46],[-0.66,-71.23],[-0.23,-71.64],[7.74,-69.89],[9.53,-70.01],[10.82,-70.83],[13.42,-69.97],[15.13,-70.4],[19.26,-69.89],[22.57,-70.7],[27.09,-70.46],[31.99,-69.66],[33.87,-68.5],[38.65,-69.78],[54.53,-65.82],[56.36,-65.97],[58.74,-67.29],[61.43,-67.95],[64.05,-67.41],[68.89,-67.93],[69.67,-69.23],[67.81,-70.31],[69.07,-70.68],[67.95,-71.85],[69.87,-72.26],[71.02,-72.09],[73.86,-69.87],[77.64,-69.46],[79.11,-68.33],[82.78,-67.21],[86.75,-67.15],[87.99,-66.21],[89.67,-67.15],[95.78,-67.39],[99.72,-67.25],[102.83,-65.56],[106.18,-66.93],[113.6,-65.88],[115.6,-66.7],[119.83,-67.27],[123.22,-66.48],[128.8,-66.76],[134.76,-66.21],[135.07,-65.31],[137.46,-66.95],[145.49,-66.92],[146.65,-67.9],[148.84,-68.39],[152.5,-68.87],[154.28,-68.56],[161.57,-70.58],[167.31,-70.83],[171.21,-71.7],[169.29,-73.66],[166.09,-74.38],[163.57,-76.24],[163.49,-77.07],[164.74,-78.18],[167.0,-78.75],[161.77,-79.16],[159.79,-80.95],[169.4,-83.83],[180.0,-84.71]],
[[32.73,35.14],[34.58,35.67],[33.97,35.06],[32.73,35.14]],
[[32.73,35.14],[34.0,34.98],[32.98,34.57],[32.26,35.1],[32.73,35.14]],
[[-2.17,35.17],[-1.31,32.26],[-3.65,31.64],[-3.69,30.9],[-5.24,30.0],[-8.67,28.84],[-8.79,27.12],[-11.39,26.88],[-12.5,24.77],[-13.89,23.69],[-14.75,21.5],[-17.02,21.42],[-14.44,26.25],[-9.56,29.93],[-9.81,31.18],[-8.66,33.24],[-6.91,34.11],[-5.93,35.76],[-2.17,35.17]],
[[36.87,22.0],[25.0,22.0],[24.7,30.04],[25.16,31.57],[28.91,30.87],[30.98,31.56],[31.96,30.93],[34.27,31.22],[34.92,29.5],[34.15,27.82],[32.32,29.76],[35.69,23.93],[35.53,23.1],[36.87,22.0]],
[[25.0,22.0],[25.0,20.0],[23.85,20.0],[23.84,19.58],[15.86,23.41],[14.14,22.49],[10.77,24.56],[10.3,24.38],[9.32,26.09],[9.95,31.38],[11.43,32.37],[11.49,33.14],[15.25,32.27],[15.71,31.38],[19.09,30.27],[20.05,30.99],[19.82,31.75],[20.85,32.71],[24.92,31.9],[25.0,22.0]],
[[47.79,8.0],[44.96,5.0],[43.66,4.96],[41.86,3.92],[40.77,4.26],[39.56,3.42],[36.16,4.45],[34.71,6.59],[32.95,7.78],[33.83,8.38],[34.26,10.63],[35.86,12.58],[36.43,14.42],[37.59,14.21],[37.91,14.96],[40.03,14.52],[41.6,13.45],[42.35,12.54],[41.76,11.05],[42.78,10.93],[42.56,10.57],[43.68,9.18],[47.79,8.0]],
[[42.35,12.54],[43.32,12.39],[42.78,10.93],[41.76,11.05],[42.35,12.54]],
[[48.95,11.41],[48.94,9.45],[47.79,8.0],[43.68,9.18],[42.56,10.57],[43.15,11.46],[44.12,10.45],[48.95,11.41]],
[[33.9,-0.95],[29.58,-1.34],[29.88,0.6],[31.17,2.2],[30.77,2.34],[31.25,3.78],[33.39,3.79],[34.01,4.25],[34.48,3.56],[35.04,1.91],[33.89,0.11],[33.9,-0.95]],
[[30.42,-1.13],[30.76,-2.29],[29.02,-2.84],[29.29,-1.62],[30.42,-1.13]],
[[18.56,42.65],[16.46,44.04],[15.75,44.82],[15.96,45.23],[19.37,44.86],[19.45,43.57],[18.56,42.65]],
[[22.38,42.32],[22.95,41.34],[20.61,41.09],[20.76,42.05],[22.38,42.32]],
[[18.83,45.91],[20.22,46.13],[21.56,44.77],[22.71,44.58],[22.41,44.01],[22.99,43.21],[22.55,42.46],[21.58,42.25],[21.78,42.68],[20.81,43.27],[20.26,42.81],[19.22,43.52],[19.6,44.04],[18.83,45.91]],
[[20.07,42.59],[19.37,41.88],[18.45,42.48],[19.22,43.52],[20.34,42.9],[20.07,42.59]],
[[20.59,41.86],[20.07,42.59],[20.64,43.22],[21.78,42.68],[20.59,41.86]],
[[-61.68,10.76],[-60.9,10.86],[-60.94,10.11],[-61.95,10.09],[-61.68,10.76]],
[[30.83,3.51],[29.72,4.6],[27.98,4.41],[23.89,8.62],[24.54,8.92],[25.07,10.27],[25.79,10.41],[26.75,9.47],[28.97,9.4],[30.0,10.29],[31.35,9.81],[32.4,11.08],[32.07,11.97],[33.21,12.18],[33.97,8.68],[32.95,7.78],[34.08,7.23],[35.3,5.51],[33.39,3.79],[30.83,3.51]]
];

/** 数字网格地球（MetalForge spinning-earth 复刻升级：经纬线框轮廓 + 数字节点 + 霓虹扫描带，无实心点阵/水晶球感） */
function drawSpinningEarth(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, speed: number, mouse: VfxMouse | null, cC: RGB, params: VfxParams | null) {
  ctx.clearRect(0, 0, w, h);
  const tt = t * speed;
  // 可调参数（MetalForge 风格：globeSize / tilt / rotateSpeed / sweepSpeed / detail / nodeSize / land / contour / offsetY）
  const globeSize = Number(params?.globeSize ?? 0.46);
  const tiltBase = Number(params?.tilt ?? 0.38);
  const rotSpeed = Number(params?.rotateSpeed ?? 0.6);
  const sweepSpd = Number(params?.sweepSpeed ?? 0.85);
  const det = Number(params?.detail ?? 1);
  const nodeSz = Number(params?.nodeSize ?? 1);
  const showLand = Number(params?.land ?? 1) >= 0.5;
  const showContour = Number(params?.contour ?? 1) >= 0.5;
  const offY = Number(params?.offsetY ?? 0);
  const cx = w / 2, cy = h / 2 + offY * h;
  const R = Math.min(w, h) * globeSize;
  // 鼠标交互：控制倾斜 + 旋转微调 + 扫描带速度
  const tilt = mouse && mouse.active ? tiltBase - 0.13 + (mouse.y - 0.5) * 0.6 : tiltBase;
  const rot = tt * rotSpeed + (mouse && mouse.active ? (mouse.x - 0.5) * 1.6 : 0);
  const sweepRot = tt * sweepSpd + (mouse && mouse.active ? (mouse.x - 0.5) * 0.8 : 0);
  // 球面投影（绕 X 轴倾斜，返回屏幕坐标 + 深度 z2>0 朝向观察者）
  const proj = (lat: number, lon: number): [number, number, number] => {
    const x3 = Math.cos(lat) * Math.sin(lon);
    const y3 = Math.sin(lat);
    const z3 = Math.cos(lat) * Math.cos(lon);
    const y2 = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
    const z2 = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);
    return [cx + x3 * R, cy + y2 * R, z2];
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // —— 大气辉光（淡）——
  const atm = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.4);
  atm.addColorStop(0, rgba(cC, 0.22));
  atm.addColorStop(0.55, rgba(cC, 0.08));
  atm.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = atm;
  ctx.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);
  // —— 经纬线框（球体轮廓主结构）——
  ctx.strokeStyle = `rgba(${Math.round(cB.r * 0.9)},${Math.round(cB.g * 0.9)},${Math.round(cB.b * 0.9)},0.28)`;
  ctx.lineWidth = Math.max(0.6, R * 0.01);
  for (let i = 0; i < 12; i++) {
    const lat = (i / 11 - 0.5) * Math.PI * 0.92;
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= 56; s++) {
      const lon = (s / 56) * Math.PI * 2 + rot;
      const pr = proj(lat, lon);
      if (pr[2] <= 0.03) { started = false; continue; }
      if (!started) { ctx.moveTo(pr[0], pr[1]); started = true; } else ctx.lineTo(pr[0], pr[1]);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const lon = (i / 20) * Math.PI * 2 + rot;
    ctx.beginPath();
    let started = false;
    for (let s = 0; s <= 56; s++) {
      const lat = (s / 56 - 0.5) * Math.PI * 0.95;
      const pr = proj(lat, lon);
      if (pr[2] <= 0.03) { started = false; continue; }
      if (!started) { ctx.moveTo(pr[0], pr[1]); started = true; } else ctx.lineTo(pr[0], pr[1]);
    }
    ctx.stroke();
  }
  // —— 国家/大陆边界轮廓（真实地理边界：经纬度 → 球面投影，背面裁剪；双层：外发光 + 主边界线）——
  if (showLand) {
    const DEG = Math.PI / 180;
    const drawLand = (alpha: number, width: number, scale: number) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${Math.round(cB.r * scale)},${Math.round(cB.g * scale)},${Math.round(cB.b * scale)},${alpha})`;
      ctx.lineWidth = width;
      for (const ring of EARTH_LAND) {
        const N = ring.length;
        for (let i = 0; i < N; i++) {
          const pA = ring[i], pB = ring[(i + 1) % N];
          const prA = proj(pA[1] * DEG, pA[0] * DEG + rot);
          const prB = proj(pB[1] * DEG, pB[0] * DEG + rot);
          if (prA[2] <= 0.03 && prB[2] <= 0.03) continue;
          let x1 = prA[0], y1 = prA[1], x2 = prB[0], y2 = prB[1];
          if (prA[2] <= 0.03) { const tt0 = prB[2] / (prB[2] - prA[2]); x1 = prB[0] + (prA[0] - prB[0]) * tt0; y1 = prB[1] + (prA[1] - prB[1]) * tt0; }
          else if (prB[2] <= 0.03) { const tt0 = prA[2] / (prA[2] - prB[2]); x2 = prA[0] + (prB[0] - prA[0]) * tt0; y2 = prA[1] + (prB[1] - prA[1]) * tt0; }
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        }
      }
      ctx.stroke();
    };
    drawLand(0.14, Math.max(1, R * 0.035), 0.7);   // 外发光晕
    drawLand(0.62, Math.max(0.8, R * 0.014), 1);   // 主边界线
  }

  // —— 数字节点（数字网格核心：经纬交点布置数字，受光照/扫描带影响）——
  const chars = '0123456789';
  const LON = Math.round(22 * det), LAT = Math.round(12 * det);
  ctx.font = `${Math.max(6, R * 0.055 * nodeSz)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  for (let li = 0; li < LAT; li++) {
    const lat = (li / (LAT - 1) - 0.5) * Math.PI * 0.95;
    for (let lo = 0; lo < LON; lo++) {
      const lon = (lo / LON) * Math.PI * 2 + rot;
      const pr = proj(lat, lon);
      if (pr[2] <= 0.03) continue;
      const px = pr[0], py = pr[1], z2 = pr[2];
      const light = 0.35 + 0.65 * Math.max(0, Math.cos(lat) * Math.cos(lon + 0.6) * 0.85 + Math.sin(lat) * 0.45);
      const shade = Math.min(1, light + z2 * 0.2);
      // 霓虹扫描带：高亮某段经线附近的数字
      const swPhase = (((lon - sweepRot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const sw = Math.exp(-Math.pow(swPhase / (Math.PI * 0.18), 2));
      let cr = cB.r, cg = cB.g, cb = cB.b;
      cr = mix(cr, 26, sw * 0.9); cg = mix(cg, 255, sw * 0.9); cb = mix(cb, 89, sw * 0.9);
      const ch = chars[Math.floor(hash01(li * 29 + lo) * chars.length)];
      ctx.fillStyle = `rgba(${Math.round(Math.min(255, cr * shade))},${Math.round(Math.min(255, cg * shade))},${Math.round(Math.min(255, cb * shade))},${0.45 + sw * 0.55})`;
      ctx.fillText(ch, px, py + R * 0.02);
    }
  }
  // —— 扫描亮弧线（绕球霓虹经线带，加强 sweep 视觉）——
  if (showContour) {
    for (let band = 0; band < 3; band++) {
      const bLon = sweepRot + band * 0.06;
      const bA = 0.75 - band * 0.22;
      ctx.beginPath();
      let started = false;
      ctx.strokeStyle = `rgba(26,255,89,${bA})`;
      ctx.lineWidth = Math.max(1, R * 0.028 * (1 - band * 0.25));
      for (let s = 0; s <= 56; s++) {
        const lat = (s / 56 - 0.5) * Math.PI * 0.95;
        const pr = proj(lat, bLon);
        if (pr[2] <= 0.03) { started = false; continue; }
        if (!started) { ctx.moveTo(pr[0], pr[1]); started = true; } else ctx.lineTo(pr[0], pr[1]);
      }
      ctx.stroke();
    }
  }
  // —— 边缘轮廓微光 ——
  const eg = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.07);
  eg.addColorStop(0, 'rgba(0,0,0,0)');
  eg.addColorStop(1, rgba(cC, 0.25));
  ctx.fillStyle = eg;
  ctx.fillRect(cx - R * 1.07, cy - R * 1.07, R * 2.14, R * 2.14);
  ctx.restore();
}

/* ===================== MetalForge orb-magenta 金属光球（1:1 复刻） ===================== */
/** 3D value noise（确定性，seed 可偏移），大理石纹理基础 */
function vnoise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const h = (i: number, j: number, k: number) => {
    const n = i * 127.1 + j * 311.7 + k * 74.7 + seed * 269.5;
    const s = Math.sin(n) * 43758.5453;
    return s - Math.floor(s);
  };
  const c000 = h(ix, iy, iz), c100 = h(ix + 1, iy, iz);
  const c010 = h(ix, iy + 1, iz), c110 = h(ix + 1, iy + 1, iz);
  const c001 = h(ix, iy, iz + 1), c101 = h(ix + 1, iy, iz + 1);
  const c011 = h(ix, iy + 1, iz + 1), c111 = h(ix + 1, iy + 1, iz + 1);
  const x00 = c000 + (c100 - c000) * ux, x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux, x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy, y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz; // 0..1
}

/** fbm 3D 噪声（3 octaves，大理石纹路） */
function fbm3(x: number, y: number, z: number, seed: number): number {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 3; o++) {
    v += amp * vnoise3(x * f, y * f, z * f, seed + o * 17.31);
    f *= 2.02; amp *= 0.5;
  }
  return v; // 0..~0.875
}

/** drawMetalOrb 离屏渲染缓存（避免每帧新建 canvas） */
let metalOffCache: HTMLCanvasElement | null = null;
let metalOffCtx: CanvasRenderingContext2D | null = null;

/**
 * MetalForge orb-magenta 金属光球 1:1 复刻（逐像素 3D 球体 + 大理石 fbm 纹理 +
 * 折射 / 边缘光 / 内发光 / 色差 / 虹彩 / 颗粒，GPU 像素着色器观感的 Canvas 2D 实现）。
 * 所有参数默认值 = MetalForge URL share link 反解值，与右侧参数面板一一对应。
 * 内部分辨率上限 320 并平滑放大，兼顾质感与 60fps 性能。
 */
function drawMetalOrb(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  // —— 参数（默认值 = orb-magenta URL share link 反解）——
  const flow = Number(params?.flow ?? 0.3);
  const turbulence = Number(params?.turbulence ?? 0.15);
  const shimmer = Number(params?.shimmer ?? 0.1);
  const wobble = Number(params?.wobble ?? 0);
  const radius = Number(params?.radius ?? 0.86);
  const scale = Number(params?.scale ?? 1.35);
  const marble = Number(params?.marble ?? 1.7);
  const refraction = Number(params?.refraction ?? 0.55);
  const seed = Number(params?.seed ?? 0);
  const rim = Number(params?.rim ?? 0.9);
  const glint = Number(params?.glint ?? 0.5);
  const innerGlow = Number(params?.innerGlow ?? 0.55);
  const halo = Number(params?.halo ?? 0);
  const contrast = Number(params?.contrast ?? 1.25);
  const bias = Number(params?.bias ?? -0.04);
  const fringe = Number(params?.fringe ?? 0.8);
  const iridescence = Number(params?.iridescence ?? 0);
  const edgeSoftness = Number(params?.edgeSoftness ?? 0.005);
  const edgeGlow = Number(params?.edgeGlow ?? 0);
  const grain = Number(params?.grain ?? 1);
  const exposure = Number(params?.exposure ?? 1);

  const tt = t * speed;
  // 固定颜色（URL 默认一致）：边缘光/高光 = 白，虹彩紫 = 第三色，内发光/辉光 = 主色
  const rimCol: RGB = { r: 255, g: 255, b: 255 };
  const glintCol: RGB = { r: 255, g: 255, b: 255 };
  const iridCol: RGB = cC;
  const glowCol: RGB = cA;

  // 内部分辨率（上限 320，平滑放大）
  const iw = Math.min(Math.max(64, Math.round(w)), 160);
  const ih = Math.max(1, Math.round(iw * h / w));
  const buf = getOffscreenBuffer('metal-orb', iw, ih);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data } = buf;

  // 光源方向（URL light=-0.62,-0.78 → 提升为 3D 方向光）
  const ll = Math.hypot(-0.62, -0.78, 0.5);
  const Lx = -0.62 / ll, Ly = -0.78 / ll, Lz = 0.5 / ll;

  // 球心（wobble 摇摆）与球半径（radius × scale 综合缩放）
  const cxx = iw / 2 + wobble * Math.sin(tt * 0.7) * iw * 0.08;
  const cyy = ih / 2 + wobble * Math.cos(tt * 0.55) * ih * 0.08;
  const R = radius * scale * Math.min(iw, ih) * 0.5;

  const tFlow = tt * flow;
  const shimmerK = 0.5 + 0.5 * Math.sin(tt * 2.3);

  for (let py = 0; py < ih; py++) {
    for (let px = 0; px < iw; px++) {
      const idx = (py * iw + px) * 4;
      const sx = (px - cxx) / R;
      const sy = (py - cyy) / R;
      const d2 = sx * sx + sy * sy;
      if (d2 >= 1) {
        // 球外：光晕 / 边缘辉光（透明，可叠加）
        const d = Math.sqrt(d2);
        let rr = 0, gg = 0, bb = 0, al = 0;
        if (halo > 0) {
          const hA = halo * Math.max(0, 1 - (d - 1) / 0.5) * 0.55;
          if (hA > 0.002) { rr += glowCol.r * hA; gg += glowCol.g * hA; bb += glowCol.b * hA; al += hA; }
        }
        if (edgeGlow > 0 && d < 1.2) {
          const eA = edgeGlow * Math.max(0, 1 - (d - 1) / 0.2) * 0.6;
          if (eA > 0.002) { rr += glowCol.r * eA; gg += glowCol.g * eA; bb += glowCol.b * eA; al += eA; }
        }
        data[idx] = Math.min(255, rr);
        data[idx + 1] = Math.min(255, gg);
        data[idx + 2] = Math.min(255, bb);
        data[idx + 3] = Math.max(0, Math.min(255, al * 255));
        continue;
      }
      const d = Math.sqrt(d2);
      const z = Math.sqrt(Math.max(0, 1 - d2));
      // 球面法线
      let Nx = sx, Ny = sy, Nz = z;
      const nl = Math.hypot(Nx, Ny, Nz) || 1;
      Nx /= nl; Ny /= nl; Nz /= nl;
      // 大理石纹理坐标（球面 + 折射偏移 + 时间流动 + 扰动）
      let tx = (Nx + sx * refraction * 0.6) * marble + tFlow;
      let ty = (Ny + sy * refraction * 0.6) * marble + tFlow * 0.7;
      let tz = Nz * marble + tFlow * 0.4;
      if (turbulence > 0) {
        const tw = fbm3(tx * 1.3, ty * 1.3, tz * 1.3, seed) - 0.5;
        tx += tw * turbulence * 3.0;
        ty += tw * turbulence * 2.4;
        tz += tw * turbulence * 1.8;
      }
      const nv = Math.max(0, Math.min(1, fbm3(tx, ty, tz, seed)));
      // 色差 fringe：边缘处 RGB 通道分离（免额外噪声采样）
      const ca = (1 - Nz) * fringe * 0.45;
      const nR = Math.max(0, Math.min(1, nv + ca * 0.5));
      const nB = Math.max(0, Math.min(1, nv - ca * 0.5));
      // 基础色：白 ↔ 主色（洋红）大理石过渡
      let baseR = mix(cB.r, cA.r, nR);
      let baseG = mix(cB.g, cA.g, nv);
      let baseB = mix(cB.b, cA.b, nB);
      // 虹彩：叠加第三色（紫）
      if (iridescence > 0) {
        const irA = iridescence * nv * 0.55;
        baseR += iridCol.r * irA; baseG += iridCol.g * irA; baseB += iridCol.b * irA;
      }
      // 漫反射
      const diff = Math.max(0, Nx * Lx + Ny * Ly + Nz * Lz);
      // 镜面高光（反射向量 z 分量，Blinn 近似）
      const dLN = Nx * Lx + Ny * Ly + Nz * Lz;
      const Rfz = 2 * dLN * Nz - Lz;
      const spec = Math.pow(Math.max(0, Rfz), 56) * glint * (0.65 + 0.35 * shimmerK);
      // 菲涅尔边缘光
      const rimL = Math.pow(1 - Nz, 2.6) * rim;
      // 内发光（中心增强）
      const inner = (1 - d) * innerGlow * 0.85;
      // 光照合成（contrast / bias）
      const lum = diff * contrast + bias;
      let rC = baseR * Math.max(0, lum) + glintCol.r * spec + rimCol.r * rimL + glowCol.r * inner;
      let gC = baseG * Math.max(0, lum) + glintCol.g * spec + rimCol.g * rimL + glowCol.g * inner;
      let bC = baseB * Math.max(0, lum) + glintCol.b * spec + rimCol.b * rimL + glowCol.b * inner;
      // 颗粒（确定性，随帧抖动）
      if (grain > 0) {
        const g = (hash01(px * 12.9898 + py * 78.233 + Math.floor(tt * 30)) - 0.5) * grain * 30;
        rC += g; gC += g; bC += g;
      }
      // 曝光
      rC *= exposure; gC *= exposure; bC *= exposure;
      // 边缘羽化
      const soft = Math.max(0.015, edgeSoftness * 400);
      const alpha = Math.max(0, Math.min(1, (1 - d) / soft));
      data[idx] = Math.max(0, Math.min(255, rC));
      data[idx + 1] = Math.max(0, Math.min(255, gC));
      data[idx + 2] = Math.max(0, Math.min(255, bC));
      data[idx + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }
  octx.putImageData(img, 0, 0);
  // 平滑放大到目标画布
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, iw, ih, 0, 0, w, h);
}

/* ===================== MetalForge Progress/Threads 丝线进度（1:1 复刻） ===================== */
/** 圆角矩形路径（兼容，避免依赖 roundRect API） */
function rrPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}
/** rgb 转 rgba 字符串 */
function cssRGBA(c: RGB, a: number): string {
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${Math.max(0, Math.min(1, a))})`;
}
/**
 * MetalForge Progress/Threads 丝线进度 1:1 复刻（粉紫丝线束随进度生长 ·
 * 错落/翻腾弯曲/重影 · 前端脉冲/尾迹 · 泛光/闪烁/颗粒/薄雾/暗角）。
 * 参数默认值 = MetalForge URL share link 反解，与右侧参数面板一一对应。
 */
function drawProgressThreads(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  // —— 参数（默认值 = MetalForge progress/threads URL share link 反解）——
  // threads shader（mfp_threads）实际只读取：scale/cellSize/stagger/churn/frontIn/frontOut/feather/falloff/grain + 4 色；
  // URL 其余参数（amount/lag/echo/bloom/jitter/pulse/pulseRate/density/turbulence/sparkle/ripple/trails/trailGlow/haze/vignette/fill）
  // 为 style 间共享默认值，按 1:1 原版 math 不影响 threads 渲染，保留面板默认值。
  const progress = Number(params?.progress ?? 60);
  const churn = Number(params?.churn ?? 1);
  const frontIn = Number(params?.fillStart ?? -0.1);
  const frontOut = Number(params?.fillEnd ?? 0.3);
  const feather = Number(params?.edge ?? 1);
  const falloff = Number(params?.falloff ?? 1);
  const scale = Number(params?.scale ?? 64);
  const cellSize = Number(params?.cellSize ?? 1);
  const stagger = Number(params?.stagger ?? 0.32);
  const grain = Number(params?.grain ?? 0.01);
  const aspect = Number(params?.aspect ?? 3.6);
  const corner = Number(params?.corner ?? 0.145);

  // 进度条区域（圆角矩形，宽高比 aspect，居中）
  const padX = w * 0.06;
  const barW = w - padX * 2;
  const barH = Math.min(h * 0.9, barW / aspect);
  const bx = (w - barW) / 2;
  const by = (h - barH) / 2;
  const R = corner * barH;

  // 原版 progressBar 坐标空间：asp = res.x/res.y，p.x = uv.x*asp（0..asp），uv.y（0..1）
  const asp = barW / barH;
  const uP = Math.max(0, Math.min(1, progress * 0.01)); // progress/100
  const uA = 1; // alive（前端活跃度）：静态渲染为 1
  const tt = t * speed; // warp 时钟

  // 4 色（原版 threads 只用 background/color1/color2/color3）
  // 1:1：优先读取 params 的 COLOURS 分组（原版 URL 默认 粉紫），缺失时回退 cA/cB/硬编码
  const hex2rgb = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      const n = parseInt(h, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  const bgC: RGB = hex2rgb({ r: 0x17, g: 0x0f, b: 0x14 }, params?.background); // background #170F14
  const c1: RGB = hex2rgb({ r: 0x29, g: 0x08, b: 0x17 }, params?.color1);      // color1 Deep #290817
  const c2: RGB = hex2rgb(cA, params?.color2);                                 // color2 Mid #FF5EB0
  const c3: RGB = hex2rgb(cB, params?.color3);                                 // color3 Glow #FFD9F2

  // 原版二维哈希 mfp_h21
  function h21(x: number, y: number): number {
    let px = x * 123.34; px -= Math.floor(px);
    let py = y * 345.45; py -= Math.floor(py);
    const dot = px * (px + 34.345) + py * (py + 34.345);
    let qx = px + dot; qx -= Math.floor(qx);
    let qy = py + dot; qy -= Math.floor(qy);
    let v = qx * qy; v -= Math.floor(v);
    return v;
  }
  const sstep = (e0: number, e1: number, x: number) => {
    const s = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return s * s * (3 - 2 * s);
  };

  // —— 逐像素渲染（mfp_threads 忠实移植）——
  ctx.clearRect(0, 0, w, h);
  const bw = Math.min(180, Math.max(2, Math.round(barW)));
  const bh = Math.min(60, Math.max(2, Math.round(barH)));
  const buf = getOffscreenBuffer('progress-threads', bw, bh);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data: dta } = buf;
  const pxw = 1.6 * feather / bh; // shader 的 res.y = 像素高度
  const mIn = frontIn;
  const mOut = asp + frontOut;
  for (let py = 0; py < bh; py++) {
    const uvY = (py + 0.5) / bh;
    const ny = uvY * scale;
    const ti = Math.floor(ny);
    const tf = ny - ti - 0.5;
    const strand = 1 - sstep(0.18 * cellSize, 0.42 * cellSize, Math.abs(tf));
    const len = mIn + (mOut - mIn) * uP
      + (h21(ti, 5) - 0.5) * stagger
      + Math.sin(tt * 2.2 * churn + ti * 0.7) * 0.055 * uA;
    for (let px = 0; px < bw; px++) {
      const pX = ((px + 0.5) / bw) * asp;
      const d = pX - len;
      const on = 1 - sstep(-pxw * 2, pxw * 2, d);
      const dd = Math.max(0, -d);
      const os = on * strand;
      const e2 = Math.exp(-dd * 3 * falloff) * os;
      const e3 = Math.exp(-dd * 14 * falloff) * os;
      const dh = (h21(px + 0.5, py + 0.5) - 0.5) * grain * 255; // 全局 dither
      const idx = (py * bw + px) * 4;
      dta[idx] = Math.max(0, Math.min(255, bgC.r + c1.r * os + c2.r * e2 + c3.r * e3 + dh));
      dta[idx + 1] = Math.max(0, Math.min(255, bgC.g + c1.g * os + c2.g * e2 + c3.g * e3 + dh));
      dta[idx + 2] = Math.max(0, Math.min(255, bgC.b + c1.b * os + c2.b * e2 + c3.b * e3 + dh));
      dta[idx + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);

  // 圆角矩形裁剪绘制
  ctx.save();
  rrPath(ctx, bx, by, barW, barH, R);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, bw, bh, Math.round(bx), Math.round(by), barW, barH);
  ctx.restore();
  // 极淡描边（贴合画布边缘）
  rrPath(ctx, bx, by, barW, barH, R);
  ctx.strokeStyle = cssRGBA(cB, 0.06);
  ctx.lineWidth = 1;
  ctx.stroke();
}



/* ===================== MetalForge Progress/Liquid·Slosh 液体进度（1:1 复刻） ===================== */
/**
 * MetalForge progressBar → mfp_liquid（WebGPU WGSL → Canvas ImageData 逐像素忠实移植）。
 * slosh(sid=1) / liquid(sid=0) 共用同一 shader，仅 mfp_wave 波形分支与默认参数不同。
 * 透明通道：bar 区域渲染（轨道底色 + 液体），bar 外 canvas 透明。
 */
function drawProgressLiquid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null,
  sid: number
) {
  // —— 参数（URL 反解：liquid / slosh）——
  const progress = Number(params?.progress ?? 0);
  const amount = Number(params?.amount ?? (sid === 1 ? 0.135 : 0.085));
  const churn = Number(params?.churn ?? 1);
  const ripple = Number(params?.ripple ?? 1);
  const lag = Number(params?.lag ?? (sid === 1 ? 1.4 : 0.55));
  const echo = Number(params?.echo ?? (sid === 1 ? 0.082 : 0.055));
  const bloom = Number(params?.bloom ?? (sid === 1 ? 0.95 : 1));
  const jitter = Number(params?.jitter ?? 0.3);
  const frontIn = Number(params?.fillStart ?? -0.12);
  const frontOut = Number(params?.fillEnd ?? 0.12);
  const feather = Number(params?.edge ?? 1);
  const falloff = Number(params?.falloff ?? 1);
  const scale = Number(params?.scale ?? 9.5);
  const trails = Number(params?.trails ?? 3);
  const trailGlow = Number(params?.trailGlow ?? 1);
  const haze = Number(params?.haze ?? 1);
  const vignette = Number(params?.vignette ?? 1);
  const grain = Number(params?.grain ?? 0.01);
  const aspect = Number(params?.aspect ?? 3.6);
  const corner = Number(params?.corner ?? 0.145);

  // —— 8 色（原版 URL 反解；缺失回退默认）——
  const hex2rgbL = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  const bgC: RGB = hex2rgbL({ r: 0x21, g: 0x21, b: 0x24 }, params?.background); // liquid #212124 / slosh #10131B
  const c1: RGB = hex2rgbL({ r: 0x09, g: 0x0b, b: 0x16 }, params?.color1);
  const c2: RGB = hex2rgbL({ r: 0x0b, g: 0x19, b: 0x4a }, params?.color2);
  const c3: RGB = hex2rgbL({ r: 0x0e, g: 0x4f, b: 0xc7 }, params?.color3);
  const c4: RGB = hex2rgbL({ r: 0x42, g: 0xb8, b: 0xfa }, params?.color4);
  const c5: RGB = hex2rgbL({ r: 0xa3, g: 0xed, b: 0xff }, params?.color5);
  const c6: RGB = hex2rgbL({ r: 0x13, g: 0x54, b: 0xc2 }, params?.color6);
  const c7: RGB = hex2rgbL({ r: 0x33, g: 0x8f, b: 0xe0 }, params?.color7);

  // —— 哈希 / 噪声 / 波形（mfp_h21 · mfp_vn · mfp_fbm · mfp_wave · mfp_sstep）——
  function h21(x: number, y: number): number {
    let px = x * 123.34; px -= Math.floor(px);
    let py = y * 345.45; py -= Math.floor(py);
    const dot = px * (px + 34.345) + py * (py + 34.345);
    let qx = px + dot; qx -= Math.floor(qx);
    let qy = py + dot; qy -= Math.floor(qy);
    let v = qx * qy; v -= Math.floor(v);
    return v;
  }
  function vn(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
    const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
    return a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy;
  }
  function fbm(x: number, y: number): number {
    let v = 0, a = 0.5, px = x, py = y;
    for (let i = 0; i < 4; i++) {
      v += a * vn(px, py);
      px = px * 2.03 + 11.7; py = py * 2.03 + 11.7;
      a *= 0.5;
    }
    return v;
  }
  function sstep(e0: number, e1: number, x: number): number {
    const s = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return s * s * (3 - 2 * s);
  }
  function wave(y: number, tt: number, amp: number): number {
    if (sid === 1) {
      // slosh 波形
      const slosh = Math.sin(y * 3.0 * ripple + tt * 0.50 * churn) * 0.95
        + (y - 0.5) * Math.sin(tt * 0.38 * churn) * 1.30;
      return slosh * amp;
    }
    // liquid 默认波形
    let w = Math.sin(y * 19.0 * ripple + tt * 1.55 * churn) * 0.55
      + Math.sin(y * 31.0 * ripple - tt * 1.05 * churn + 1.3) * 0.24
      + Math.sin(y * 8.5 * ripple + tt * 0.62 * churn) * 0.46;
    w = w + (fbm(y * 2.6 * ripple, tt * 0.42 * churn) - 0.5) * 1.15;
    return w * amp;
  }

  // —— bar 区域（圆角矩形，透明背景）——
  const padX = w * 0.06;
  const barW = w - padX * 2;
  const barH = Math.min(h * 0.9, barW / aspect);
  const bx = (w - barW) / 2;
  const by = (h - barH) / 2;
  const R = corner * barH;
  const asp = barW / barH;
  const uP = Math.max(0, Math.min(1, progress * 0.01));
  const uA = 1; // alive 静态 1
  const tt = t * speed;

  ctx.clearRect(0, 0, w, h);
  const bw = Math.min(180, Math.max(2, Math.round(barW)));
  const bh = Math.min(60, Math.max(2, Math.round(barH)));
  const buf = getOffscreenBuffer('progress-liquid', bw, bh);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data: dta } = buf;
  const pxw = 1.6 * feather / bh;
  const amp = amount * uA;
  const ex = frontIn + (asp + frontOut - frontIn) * uP;
  const ex0 = ex; // 基线前端（无波浪）仅用于 prot 不需要

  for (let py = 0; py < bh; py++) {
    const uvY = (py + 0.5) / bh;
    const off0 = wave(uvY, tt, amp);
    const fprot = Math.max(0, Math.min(1, off0 / Math.max(amp, 1e-4) * 0.5 + 0.5));
    for (let px = 0; px < bw; px++) {
      const pX = ((px + 0.5) / bw) * asp;
      const d = pX - (ex + off0);
      const inside = 1 - sstep(-pxw, pxw, d);
      const dl = Math.max(0, -d);
      const prot = fprot;
      const lum = bloom;

      // 5 层基础渐变
      let r = c1.r, g = c1.g, b = c1.b;
      const m2 = Math.exp(-dl * 2.1 * falloff);
      r += (c2.r - r) * m2; g += (c2.g - g) * m2; b += (c2.b - b) * m2;
      const m3 = Math.exp(-dl * 5.2 * falloff) * 0.9;
      r += (c3.r - r) * m3; g += (c3.g - g) * m3; b += (c3.b - b) * m3;
      const m4 = Math.exp(-dl * 9.0 * falloff) * (0.72 + 0.28 * prot) * lum;
      r += (c4.r - r) * m4; g += (c4.g - g) * m4; b += (c4.b - b) * m4;
      const m5 = Math.exp(-dl * 17.0 * falloff) * (0.55 + 0.45 * prot) * lum;
      r += (c5.r - r) * m5; g += (c5.g - g) * m5; b += (c5.b - b) * m5;

      // 回声 trails（k=1..6）
      for (let k = 1; k < 7; k++) {
        if (k > Math.round(trails)) break;
        const ok = wave(uvY, tt - k * lag, amp * (1.0 + k * 0.22));
        const dk = pX - (ex + ok - k * (echo + 0.030 * uA));
        const e6 = Math.exp(-Math.abs(dk) * Math.max(0.5, 15.0 - k * 3.2) * falloff) * (0.34 / k) * trailGlow;
        const e7 = Math.exp(-Math.abs(dk) * Math.max(0.5, 40.0 - k * 7.0) * falloff) * (0.16 / k) * lum * trailGlow;
        r += c6.r * e6 + c7.r * e7;
        g += c6.g * e6 + c7.g * e7;
        b += c6.b * e6 + c7.b * e7;
      }

      // haze 薄雾
      const hzv = fbm(pX * 1.6 - tt * 0.06 * uA * churn, uvY * 1.9 + tt * 0.05 * uA * churn);
      const hmix = 1 + (0.86 + 0.28 * hzv - 1) * haze;
      r *= hmix; g *= hmix; b *= hmix;

      // vignette 暗角
      const vig = sstep(0, 0.42, uvY) * sstep(1, 0.58, uvY);
      const vmix = 1 + (0.78 + (1.06 - 0.78) * vig - 1) * vignette;
      r *= vmix; g *= vmix; b *= vmix;

      // mix(background, col, inside)
      const fr = bgC.r + (r - bgC.r) * inside;
      const fg = bgC.g + (g - bgC.g) * inside;
      const fb2 = bgC.b + (b - bgC.b) * inside;
      // 全局 dither
      const dh = (h21(px + 0.5, py + 0.5) - 0.5) * grain * 255;
      const idx = (py * bw + px) * 4;
      dta[idx] = Math.max(0, Math.min(255, fr + dh));
      dta[idx + 1] = Math.max(0, Math.min(255, fg + dh));
      dta[idx + 2] = Math.max(0, Math.min(255, fb2 + dh));
      dta[idx + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  // 圆角裁剪绘制
  ctx.save();
  rrPath(ctx, bx, by, barW, barH, R);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, bw, bh, Math.round(bx), Math.round(by), barW, barH);
  ctx.restore();
  rrPath(ctx, bx, by, barW, barH, R);
  ctx.strokeStyle = cssRGBA(c3, 0.06);
  ctx.lineWidth = 1;
  ctx.stroke();
}


/* ===================== MetalForge Wallpaper/Abyss 深渊壁纸（1:1 复刻） ===================== */
/**
 * wallpaperMain（WebGPU WGSL → Canvas ImageData 逐像素忠实移植）。
 * 整幅 fbm 域扭曲 + 5 色调色板 + 暗角 + 电影颗粒。壁纸类特效（整幅纹理）。
 */
function drawWallpaper(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  // —— 参数（URL 反解：scale=1.15 / warp=2.6 / seed=27 / contrast=1.35 / bands=1 / rotation=20 / lift=0.04 / softness=0.5 / grain=0.5 / vignette=0.85 / aSpeed=1 / aAmount=0.05 / aWaves=6）——
  const scale = Number(params?.scale ?? 1.15);
  const warp = Number(params?.warp ?? 2.6);
  const seed = Number(params?.seed ?? 27);
  const contrast = Number(params?.contrast ?? 1.35);
  const bands = Number(params?.bands ?? 1);
  const rotation = Number(params?.rotation ?? 20);
  const lift = Number(params?.lift ?? 0.04);
  const softness = Number(params?.softness ?? 0.5);
  const grain = Number(params?.grain ?? 0.5);
  const vignette = Number(params?.vignette ?? 0.85);
  const aSpeed = Number(params?.aSpeed ?? 1);
  const aAmount = Number(params?.aAmount ?? 0.05);
  const aWaves = Number(params?.aWaves ?? 6);
  const animate = Number(params?.animate ?? 1) !== 0;
  const modeFlow = Number(params?.mode ?? 0) >= 0.5;
  const hex2rgbW = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  // color1=#04051A / color2=#08195E / color3=#1E5CFF / color4=#3FD8FF / color5=#EEF1F6
  const c1: RGB = hex2rgbW({ r: 0x04, g: 0x05, b: 0x1a }, params?.color1);
  const c2: RGB = hex2rgbW({ r: 0x08, g: 0x19, b: 0x5e }, params?.color2);
  const c3: RGB = hex2rgbW({ r: 0x1e, g: 0x5c, b: 0xff }, params?.color3);
  const c4: RGB = hex2rgbW({ r: 0x3f, g: 0xd8, b: 0xff }, params?.color4);
  const c5: RGB = hex2rgbW({ r: 0xee, g: 0xf1, b: 0xf6 }, params?.color5);

  // —— 哈希 / 噪声 / fbm / 调色板（wp_hash1 · wp_hash2 · wp_noise · wp_fbm · wp_pal）——
  function h1(x: number, y: number): number {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }
  function h2(x: number, y: number): [number, number] {
    const qx = x * 127.1 + y * 311.7;
    const qy = x * 269.5 + y * 183.3;
    const sx = Math.sin(qx) * 43758.5453, sy = Math.sin(qy) * 43758.5453;
    return [(sx - Math.floor(sx)) * 2 - 1, (sy - Math.floor(sy)) * 2 - 1];
  }
  function noise(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
    const va = a[0] * fx + a[1] * fy;
    const vb = b[0] * (fx - 1) + b[1] * fy;
    const vc = c[0] * fx + c[1] * (fy - 1);
    const vd = d[0] * (fx - 1) + d[1] * (fy - 1);
    return (va + (vb - va) * ux) + ((vc + (vd - vc) * ux) - (va + (vb - va) * ux)) * uy;
  }
  function fbm(x: number, y: number): number {
    let p0x = x, p0y = y, a = 0.6, s = 0;
    for (let i = 0; i < 3; i++) {
      s += a * noise(p0x, p0y);
      p0x *= 2.1; p0y *= 2.1;
      a *= 0.42;
    }
    return s;
  }
  function sstep(e0: number, e1: number, x: number): number {
    const s = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return s * s * (3 - 2 * s);
  }
  function pal(t0: number): [number, number, number] {
    const tt = Math.max(0, Math.min(1, t0));
    let r = c1.r, g = c1.g, b = c1.b;
    const m2 = sstep(0, 0.46, tt); r += (c2.r - r) * m2; g += (c2.g - g) * m2; b += (c2.b - b) * m2;
    const m3 = sstep(0.44, 0.76, tt); r += (c3.r - r) * m3; g += (c3.g - g) * m3; b += (c3.b - b) * m3;
    const m4 = sstep(0.74, 0.93, tt); r += (c4.r - r) * m4; g += (c4.g - g) * m4; b += (c4.b - b) * m4;
    const m5 = sstep(0.92, 1, tt); r += (c5.r - r) * m5; g += (c5.g - g) * m5; b += (c5.b - b) * m5;
    return [r, g, b];
  }

  ctx.clearRect(0, 0, w, h);
  const bw = Math.min(96, Math.max(2, Math.round(w)));
  const bh = Math.min(96, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('wallpaper', bw, bh);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data: dta } = buf;
  const ts = t * speed * aSpeed;
  const soft = Math.max(0, Math.min(1, softness));
  const sc = scale * (1.05 - soft * 0.55);
  const wa = warp * (0.35 + soft * 0.7);
  const th = rotation * Math.PI / 180;
  const cosT = Math.cos(th), sinT = Math.sin(th);
  const vg = Math.max(0, Math.min(1, vignette));
  const gg = Math.max(0, Math.min(1, grain));
  const gs = 1500 / bh;

  for (let py = 0; py < bh; py++) {
    const fcY = bh - (py + 0.5);
    const uvY = (fcY - 0.5 * bh) / bh;
    for (let px = 0; px < bw; px++) {
      const fcX = px + 0.5;
      const uvX = (fcX - 0.5 * bw) / bh;
      let ux = uvX, uy = uvY;
      if (animate) {
        ux += aAmount * Math.sin(ts + uvY * aWaves);
        uy += aAmount * Math.cos(ts * 0.77 + uvX * aWaves);
      }
      const pX = (cosT * ux + sinT * uy) * sc + seed;
      const pY = (-sinT * ux + cosT * uy) * sc + seed;
      const qx = fbm(pX, pY), qy = fbm(pX + 3.7, pY + 1.3);
      const rx = fbm(pX + wa * qx + 1.7, pY + wa * qy + 9.2);
      const ry = fbm(pX + wa * qx + 8.3, pY + wa * qy + 2.8);
      const f = fbm(pX + wa * rx, pY + wa * ry);
      let tt: number;
      if (!modeFlow) {
        tt = 0.46 + f * contrast * 1.9;
        const k = tt - 0.78;
        if (k > 0) tt = 0.78 + k / (1 + k * 1.6);
        tt = Math.pow(Math.max(0, Math.min(1, tt)), 1.35);
      } else {
        tt = 0.5 + 0.5 * Math.sin(f * 6.2831 * bands * 1.7 + seed * 2);
        tt = Math.pow(Math.max(0, Math.min(1, tt)), contrast);
        const k = tt - 0.72;
        if (k > 0) tt = 0.72 + k / (1 + k * 0.6);
      }
      const pc = pal(tt + lift);
      // vignette 椭圆暗角
      const d = Math.sqrt((uvX * 0.78) * (uvX * 0.78) + (uvY * 0.52) * (uvY * 0.52));
      const vm = 1 + ((1 - sstep(0.1, 1.25, d)) - 1) * vg;
      let r = pc[0] * vm, g2 = pc[1] * vm, b2 = pc[2] * vm;
      // film grain（按亮度加权）
      const gx = Math.floor(fcX * gs) + seed * 37, gy = Math.floor(fcY * gs) + seed * 37;
      const g = h1(gx, gy);
      const lum = (r + g2 + b2) / 3 / 255;
      const gadd = (g - 0.5) * gg * 0.34 * (0.22 + lum) * 255;
      r += gadd; g2 += gadd; b2 += gadd;
      const idx = (py * bw + px) * 4;
      dta[idx] = Math.max(0, Math.min(255, r));
      dta[idx + 1] = Math.max(0, Math.min(255, g2));
      dta[idx + 2] = Math.max(0, Math.min(255, b2));
      // 透明通道：亮度映射（暗色背景→透明，亮色纹理→可见）
      const wmx = Math.max(r, Math.max(g2, b2));
      dta[idx + 3] = Math.max(0, Math.min(255, (Math.max(0, Math.min(1, (wmx / 255 - 0.22) / 0.6)) * 0.95) * 255));
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, bw, bh, 0, 0, w, h);
}


/* ===================== MetalForge Thinking Orbs 思考光点（1:1 复刻） ===================== */
/**
 * Thinking Orbs（SwiftUI 思考动画 · 点阵光点 + pill + label）。
 * CPU 计算 ~150 点阵位置（波浪高度 + 深度透视），按深度排序 source-over 绘制圆点。
 * ribbon（彩带）＝ 双行交错点带；ping（脉冲）＝ 单行点 + 周期脉冲环。
 */
function drawThinkingOrbs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null,
  style: 'ribbon' | 'ping'
) {
  const dots = Number(params?.dots ?? 1);
  const spread = Number(params?.spread ?? 1);
  const dotScale = Number(params?.dotScale ?? 1);
  const perspective = Number(params?.perspective ?? 1);
  const depthSize = Number(params?.depthSize ?? 1);
  const depthFade = Number(params?.depthFade ?? 1);
  const opacity = Number(params?.opacity ?? 1);
  const yaw = Number(params?.yaw ?? 0) * Math.PI / 180;
  const pitch = Number(params?.pitch ?? 0) * Math.PI / 180;
  const spin = Number(params?.spin ?? 0);
  const phase = Number(params?.phase ?? 0);
  const reverse = (Number(params?.reverse ?? 0) >= 0.5) ? -1 : 1;
  const showsPill = (Number(params?.showsPill ?? 1) >= 0.5);
  const showsLabel = (Number(params?.showsLabel ?? 1) >= 0.5);
  const labelScale = Number(params?.labelScale ?? 1);
  const pillPad = Number(params?.pillPad ?? 1);
  const pillGap = Number(params?.pillGap ?? 1);
  const hex2rgbT = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  const accent: RGB = hex2rgbT({ r: 0xe8, g: 0x85, b: 0x3c }, params?.accent);
  const dotCol: RGB = hex2rgbT({ r: 0xf4, g: 0xf1, b: 0xea }, params?.dotColor);
  const pillCol: RGB = hex2rgbT({ r: 0x1b, g: 0x1b, b: 0x1d }, params?.pill);
  const labelCol: RGB = hex2rgbT({ r: 0xf4, g: 0xf1, b: 0xea }, params?.labelColor);

  const cx = w / 2;
  const M = Math.max(6, Math.round(12 + 8 * dots));
  const dotR = Math.max(2, Math.min(w, h) * 0.02 * dotScale);
  const gap = Math.max(dotR * 1.6, Math.min(w, h) * 0.05 * spread);
  const amp = Math.min(w, h) * 0.10 * depthSize;
  const depR = Math.min(w, h) * 0.16;
  const tt = t * speed * 1.7 * reverse;
  const rowOff = style === 'ribbon' ? 0.5 : 0;

  // —— 生成点阵（ribbon 双行交错；ping 单行）——
  const pts: { x: number; y: number; r: number; a: number; z: number }[] = [];
  const rows = style === 'ribbon' ? 2 : 1;
  for (let r0 = 0; r0 < rows; r0++) {
    for (let i = 0; i < M; i++) {
      const fi = i / (M - 1) - 0.5;
      const a = tt + phase + i * 0.55 + r0 * Math.PI;
      const hgt = Math.sin(a) * amp;
      const dep = Math.cos(a * 0.8 + r0 * 1.2) * depR;
      let x = fi * (M - 1) * gap * 0.92 + (r0 === 1 ? gap * 0.5 : 0);
      let y = hgt + (r0 === 1 ? -amp * 0.28 : 0);
      let z = dep;
      // spin 绕 Z
      const cz = Math.cos(spin * 0.5 + tt * 0.05), sz = Math.sin(spin * 0.5 + tt * 0.05);
      const xr = x * cz - y * sz, yr = x * sz + y * cz; x = xr; y = yr;
      // yaw 绕 Y
      const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw);
      const x1 = x * cy2 - z * sy2, z1 = x * sy2 + z * cy2; x = x1; z = z1;
      // pitch 绕 X
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const y1 = y * cp - z * sp, z2 = y * sp + z * cp; y = y1; z = z2;
      const persp = 1 + perspective * (z / depR) * 0.38;
      const sx = cx + x * persp;
      const sy = h * 0.5 + y * persp;
      const zn = z / depR; // -1..1
      const alpha = opacity * (0.4 + 0.6 * Math.max(0, Math.min(1, 1 - depthFade * (zn + 0.5))));
      pts.push({ x: sx, y: sy, r: dotR * persp, a: alpha, z });
    }
  }
  // 深度排序（近 z 大 的后面画 → 覆盖远的）
  pts.sort((a, b) => a.z - b.z);

  // —— pill 尺寸（包裹点阵）——
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x - p.r); maxX = Math.max(maxX, p.x + p.r); minY = Math.min(minY, p.y - p.r); maxY = Math.max(maxY, p.y + p.r); }
  const padW = Math.min(w, h) * 0.045 * pillPad;
  const padH = Math.min(w, h) * 0.03 * pillGap;
  const lblH = showsLabel ? Math.min(w, h) * 0.14 * labelScale : 0;
  const pillW = maxX - minX + padW * 2;
  const pillH = maxY - minY + padH * 2 + lblH;
  const pillX = cx - pillW / 2, pillY = minY - padH;

  ctx.clearRect(0, 0, w, h);
  if (showsPill) {
    rrPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = rgba(pillCol, 0.88);
    ctx.fill();
    rrPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.strokeStyle = rgba(accent, 0.18);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // 光晕底（accent 微弱环境光）
  const glowR = pillW * 0.62;
  const glow = ctx.createRadialGradient(cx, h * 0.5, 0, cx, h * 0.5, glowR);
  glow.addColorStop(0, rgba(accent, 0.06 * opacity));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - glowR, h * 0.5 - glowR, glowR * 2, glowR * 2);

  // —— 绘制圆点（source-over，近覆盖远）——
  for (const p of pts) {
    if (p.a <= 0.01) continue;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.6);
    grad.addColorStop(0, rgba(dotCol, p.a));
    grad.addColorStop(0.55, rgba(dotCol, p.a * 0.75));
    grad.addColorStop(1, rgba(dotCol, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    // 高光核
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, Math.min(1, p.a * 0.9));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // —— ping 脉冲环 ——
  if (style === 'ping') {
    const pul = (tt + phase + Math.PI) % (Math.PI * 2);
    const pr = dotR * 1.4 + (pul / (Math.PI * 2)) * Math.min(w, h) * 0.38;
    ctx.strokeStyle = rgba(accent, (1 - pul / (Math.PI * 2)) * 0.55 * opacity);
    ctx.lineWidth = Math.max(1.5, dotR * 0.4);
    ctx.beginPath();
    ctx.arc(cx, h * 0.5, pr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // —— label ——
  if (showsLabel) {
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.075 * labelScale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(labelCol, 0.92 * opacity);
    ctx.fillText('THINKING', cx, pillY + pillH - lblH * 0.55);
  }
}



/* ===================== MetalForge Glow / 发光卡片（1:1 复刻） ===================== */
/**
 * glow WGSL → Canvas ImageData 逐像素忠实移植（mfSrc 卡片内容 + 4 内发光带 gInsetBand
 * + grain + SDF mask + drop-glow）。orbit 动画重建光源旋转。透明通道：卡片外无光处透明。
 * 常量：GREFX=160/GREFY=210/GK=2.104/GB1B=1/GB1S=-1/3/GB2B=0.8235294/GB2S=-0.2352941/
 * GB3B=0.7567568/GB3S=-0.3783784/GB4B=1/GB4S=-1/3/GA1=0.42/GA2=0.55/GA3=1/GA4=0.22/
 * GGAIN=0.26/GSEED=17/GBF=0.75。
 */
function drawGlowCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  const GREFX = 160, GREFY = 210, GK = 2.104;
  const GB1B = 1.0, GB1S = -0.3333333, GB2B = 0.8235294, GB2S = -0.2352941;
  const GB3B = 0.7567568, GB3S = -0.3783784, GB4B = 1.0, GB4S = -0.3333333;
  const GA1 = 0.42, GA2 = 0.55, GA3 = 1.0, GA4 = 0.22;
  const GGAIN = 0.26, GSEED = 17, GBF = 0.75;
  const hex2rgbG = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  const cardX = Number(params?.cardX ?? 0.86), cardY = Number(params?.cardY ?? 0.52);
  const radius = Number(params?.radius ?? 40);
  const intensity = Number(params?.intensity ?? 1);
  const lightX = Number(params?.lightX ?? 0.5), lightY = Number(params?.lightY ?? 1);
  const animAmount = Number(params?.animAmount ?? 0.42);
  const animShape = Number(params?.animShape ?? 0);
  const grainAmt = Number(params?.grainAmt ?? 0.15);
  const shadowAmt = Number(params?.shadowAmt ?? 0.1);
  const spd = Number(params?.speed ?? 1);
  const kBgTop: RGB = hex2rgbG({ r: 0x0a, g: 0x09, b: 0x09 }, params?.bgTop);
  const kBgBot: RGB = hex2rgbG({ r: 0x09, g: 0x10, b: 0x1f }, params?.bgBottom);
  const kRim: RGB = hex2rgbG({ r: 255, g: 255, b: 255 }, params?.rimColor);
  const kMid: RGB = hex2rgbG({ r: 0x69, g: 0x94, b: 0xff }, params?.midColor);
  const kDeep: RGB = hex2rgbG({ r: 0x14, g: 0x4c, b: 0xcd }, params?.deepColor);
  const kTop: RGB = hex2rgbG({ r: 0x23, g: 0x65, b: 0xff }, params?.topColor);
  const kShadow: RGB = hex2rgbG({ r: 0x14, g: 0x4c, b: 0xcd }, params?.shadowColor);

  // orbit 动画：光源方向绕原点旋转（原版 mfaAnim/anim=orbit 重建）
  const aa = t * spd * 0.7;
  const baseX = (lightX - 0.5) * 2, baseY = (lightY - 0.5) * 2;
  const ox = Math.cos(aa) * animAmount, oy = Math.sin(aa) * animAmount;
  const ddx = baseX + ox, ddy = baseY + oy;
  const dm = Math.hypot(ddx, ddy) || 1;
  const ldx = ddx / dm, ldy = ddy / dm;
  const inten = Math.max(0, intensity); // an.z≈1

  function sdRoundBox(px: number, py: number, ex: number, ey: number, rr: number): number {
    const qx = Math.abs(px) - ex + rr, qy = Math.abs(py) - ey + rr;
    const mx = Math.max(qx, 0), my = Math.max(qy, 0);
    return Math.hypot(mx, my) + Math.min(Math.max(qx, qy), 0) - rr;
  }
  function smoothG(e0: number, e1: number, x: number): number {
    const s = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return s * s * (3 - 2 * s);
  }
  function gOver(dst: RGB, src: RGB, a: number): RGB {
    const aa = Math.max(0, Math.min(1, a));
    return { r: dst.r + (src.r - dst.r) * aa, g: dst.g + (src.g - dst.g) * aa, b: dst.b + (src.b - dst.b) * aa };
  }
  // gInsetBand：SDF 差带光层
  function insetBand(px: number, py: number, ex: number, ey: number, rr: number, ldx: number, ldy: number, dist: number, sigmaRef: number, spreadRef: number, gs: number): number {
    const spread = spreadRef * gs;
    const offX = -ldx * dist * gs, offY = -ldy * dist * gs;
    const dInner = sdRoundBox(px - offX, py - offY, ex - spread, ey - spread, Math.max(rr - spread, 0));
    const sigma = Math.max(sigmaRef * gs, 0.0001);
    const sIn = smoothG(-GK * sigma, GK * sigma, -sdRoundBox(px, py, ex, ey, rr));
    const sOut = smoothG(-GK * sigma, GK * sigma, -dInner);
    return Math.max(sIn - sOut, 0);
  }
  function gHash(x: number, y: number, channel: number): number {
    const v = { x, y, z: channel + GSEED };
    const dotv = v.x * 127.1 + v.y * 311.7 + v.z * 74.7;
    const sv = Math.sin(dotv) * 43758.5453123;
    return sv - Math.floor(sv);
  }
  function valueNoise(x: number, y: number, channel: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
    const a = gHash(ix, iy, channel), b = gHash(ix + 1, iy, channel);
    const c = gHash(ix, iy + 1, channel), d = gHash(ix + 1, iy + 1, channel);
    return (a + (b - a) * wx + (c + (d - c) * wx - (a + (b - a) * wx)) * wy) * 2 - 1;
  }
  function gFractal(px: number, py: number, channel: number): number {
    let sum = 0, amp = 1, freq = 1;
    for (let i = 0; i < 4; i++) {
      sum += valueNoise(px * freq, py * freq, channel + i * 37) * amp;
      freq *= 2; amp *= 0.5;
    }
    return Math.max(0, Math.min(1, 0.5 + GGAIN * sum));
  }
  function gLinearToSRGB(c: number): number {
    if (c <= 0.0031308) return c * 12.92;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }
  function gOverlay(base: number, blend: number): number {
    if (base < 0.5) return 2 * base * blend;
    return 1 - 2 * (1 - base) * (1 - blend);
  }

  ctx.clearRect(0, 0, w, h);
  const bw = Math.min(160, Math.max(2, Math.round(w))), bh = Math.min(160, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('glow-card', bw, bh);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data: dta } = buf;
  // 卡片几何
  const frameX = 393 * Math.max(Math.min(w / 393, h / 851), 0.0001);
  const frameY = 851 * Math.max(Math.min(w / 393, h / 851), 0.0001);
  const halfX = 0.5 * Math.max(0.02, Math.min(1, cardX)) * frameX;
  const halfY = 0.5 * Math.max(0.02, Math.min(1, cardY)) * frameY;
  const gs = Math.max(Math.min(halfX / GREFX, halfY / GREFY), 0.0001);
  const rr = Math.max(0, Math.min(radius * gs, Math.min(halfX, halfY)));
  const cxs = 0.5 * w, cys = 0.5 * h;
  // 阴影光晕（drop glow 近似）
  const glowS = Math.max(4, gs * 20);
  for (let py = 0; py < bh; py++) {
    const qy = py + 0.5 - cys;
    for (let px = 0; px < bw; px++) {
      const qx = px + 0.5 - cxs;
      const dCard = sdRoundBox(qx, qy, halfX, halfY, rr);
      // 背景渐变（卡片内）
      const v01 = Math.max(0, Math.min(1, (qy + halfY) / (2 * halfY)));
      let cr = kBgTop.r + (kBgBot.r - kBgTop.r) * v01;
      let cg = kBgTop.g + (kBgBot.g - kBgTop.g) * v01;
      let cb = kBgTop.b + (kBgBot.b - kBgTop.b) * v01;
      // 4 光层（mfSrc 顺序：top → deep → mid → rim，实际按 alpha 混合）
      const a4 = insetBand(qx, qy, halfX, halfY, rr, -ldx, -ldy, Number(params?.topSize ?? 6), GB4B, GB4S, gs) * GA4 * inten;
      const mix4 = Math.max(0, Math.min(1, a4));
      cr += (kTop.r - cr) * mix4; cg += (kTop.g - cg) * mix4; cb += (kTop.b - cb) * mix4;
      const a3 = insetBand(qx, qy, halfX, halfY, rr, ldx, ldy, Number(params?.deepSize ?? 74), GB3B, GB3S, gs) * GA3 * inten;
      const mix3 = Math.max(0, Math.min(1, a3));
      cr += (kDeep.r - cr) * mix3; cg += (kDeep.g - cg) * mix3; cb += (kDeep.b - cb) * mix3;
      const a2 = insetBand(qx, qy, halfX, halfY, rr, ldx, ldy, Number(params?.midSize ?? 34), GB2B, GB2S, gs) * GA2 * inten;
      const mix2 = Math.max(0, Math.min(1, a2));
      cr += (kMid.r - cr) * mix2; cg += (kMid.g - cg) * mix2; cb += (kMid.b - cb) * mix2;
      const a1 = insetBand(qx, qy, halfX, halfY, rr, ldx, ldy, Number(params?.rimSize ?? 18), GB1B, GB1S, gs) * GA1 * inten;
      const mix1 = Math.max(0, Math.min(1, a1));
      cr += (kRim.r - cr) * mix1; cg += (kRim.g - cg) * mix1; cb += (kRim.b - cb) * mix1;
      // grain（gFractal × overlay）
      if (grainAmt > 0) {
        const npX = (qx / gs) * GBF, npY = (qy / gs) * GBF;
        const nr = gLinearToSRGB(gFractal(npX, npY, 0));
        const ng = gLinearToSRGB(gFractal(npX, npY, 101));
        const nb = gLinearToSRGB(gFractal(npX, npY, 211));
        const na = gFractal(npX, npY, 307);
        const mr = gOverlay(cr / 255, nr), mg = gOverlay(cg / 255, ng), mb = gOverlay(cb / 255, nb);
        const mixg = Math.max(0, Math.min(1, grainAmt * na));
        cr += (mr * 255 - cr) * mixg; cg += (mg * 255 - cg) * mixg; cb += (mb * 255 - cb) * mixg;
      }
      // dither
      const dp = { x: px + 0.5, y: py + 0.5 };
      const dth = ((Math.sin(dp.x * 12.9898 + dp.y * 78.233) * 43758.5453) - Math.floor(Math.sin(dp.x * 12.9898 + dp.y * 78.233) * 43758.5453)) - 0.5;
      cr += dth / 255 * 255; cg += dth; cb += dth;
      // SDF mask + drop glow：卡片内 alpha 1，卡片外仅光晕
      const mask = 1 - smoothG(-1, 1, dCard);
      let alpha;
      if (mask > 0) {
        alpha = 1;
      } else {
        const glow = Math.exp(-Math.max(0, dCard) / glowS) * shadowAmt * 6 * inten;
        alpha = Math.max(0, Math.min(1, glow));
      }
      const idx = (py * bw + px) * 4;
      dta[idx] = Math.max(0, Math.min(255, cr));
      dta[idx + 1] = Math.max(0, Math.min(255, cg));
      dta[idx + 2] = Math.max(0, Math.min(255, cb));
      dta[idx + 3] = Math.max(0, Math.min(255, alpha * 255));
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, bw, bh, 0, 0, w, h);
}


/* ===================== MetalForge Abyss / 深渊网格渐变（1:1 复刻） ===================== */
/**
 * effect=abyss 网格渐变：4x4 控制点 16 色双线性插值 + fbm 域扰动 + drift 漂移动画 +
 * hue 色相旋转 + film 胶片滤镜（对比度/饱和度/颗粒/暗角/斜面边缘）。
 * 透明通道：亮度映射 alpha（暗色背景→透明，亮色纹理→可见），满足"无黑色背景"要求。
 */
function drawAbyssGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  const grid = Math.max(2, Math.min(8, Math.round(Number(params?.grid ?? 4))));
  const smooth = Number(params?.smooth ?? 1) >= 0.5;
  const drift = Number(params?.drift ?? 0.45);
  const hue = Number(params?.hue ?? 0);
  const animSpeed = Number(params?.speed ?? 1);
  const animate = Number(params?.animate ?? 1) >= 0.5;
  const fixEdges = Number(params?.fixEdges ?? 1) >= 0.5;
  // film 参数
  const fBlur = Number(params?.fBlur ?? 8);
  const fFade = Number(params?.fFade ?? 0.85);
  const fAmount = Number(params?.fAmount ?? 0.65);
  const fSoft = Number(params?.fSoft ?? 0.5);
  const fBrightness = Number(params?.fBrightness ?? 0);
  const fContrast = Number(params?.fContrast ?? 1);
  const fSaturation = Number(params?.fSaturation ?? 1);
  const fGrain = Number(params?.fGrain ?? 0.5);
  const fAngle = Number(params?.fAngle ?? 20);
  const fScale = Number(params?.fScale ?? 1.15);
  const fRound = Number(params?.fRound ?? 0.45);
  const fBevel = Number(params?.fBevel ?? 0.3);
  const hex2rgbA = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  // 16 控制色（URL c00..c33）
  const defCols: string[] = ['#04051A', '#081757', '#1E5BFD', '#050824', '#143EB6', '#D3EDF7', '#071654', '#1D59F8', '#060E3A', '#1237A7', '#96E4FB', '#071551', '#2D95FF', '#060D35', '#103198', '#5ADCFE'];
  const cols: RGB[] = [];
  for (let i = 0; i < 16; i++) {
    const key = `c${String(Math.floor(i / 4))}${String(i % 4)}`;
    cols.push(hex2rgbA({ r: 0, g: 0, b: 0 }, params?.[key] ?? defCols[i]));
  }
  // 规则网格点（0..1）
  const pts: [number, number][] = [];
  for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
    pts.push([gx / (grid - 1), gy / (grid - 1)]);
  }
  // 值噪声（fbm 域扰动）
  function hashA(x: number, y: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function noiseA(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
    const a = hashA(ix, iy), b = hashA(ix + 1, iy), c = hashA(ix, iy + 1), d = hashA(ix + 1, iy + 1);
    return a + (b - a) * wx + (c - a + (d - c - b + a) * wx) * wy;
  }
  function fbmA(x: number, y: number): number {
    let sum = 0, amp = 0.5, f = 1;
    for (let i = 0; i < 5; i++) { sum += amp * noiseA(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return sum;
  }
  // hue 旋转（RGB→HSV→RGB 简化为矩阵）
  function hueRotate(r: number, g: number, b: number, hDeg: number): RGB {
    if (hDeg === 0) return { r, g, b };
    const rad = (hDeg * Math.PI) / 180, cosA = Math.cos(rad), sinA = Math.sin(rad);
    const m00 = 0.213 + cosA * 0.787 - sinA * 0.213, m01 = 0.715 - cosA * 0.715 - sinA * 0.715, m02 = 0.072 - cosA * 0.072 + sinA * 0.928;
    const m10 = 0.213 - cosA * 0.213 + sinA * 0.143, m11 = 0.715 + cosA * 0.285 + sinA * 0.140, m12 = 0.072 - cosA * 0.072 - sinA * 0.283;
    const m20 = 0.213 - cosA * 0.213 - sinA * 0.787, m21 = 0.715 - cosA * 0.715 + sinA * 0.715, m22 = 0.072 + cosA * 0.928 + sinA * 0.072;
    return { r: m00 * r + m01 * g + m02 * b, g: m10 * r + m11 * g + m12 * b, b: m20 * r + m21 * g + m22 * b };
  }
  // 双线性插值 4x4（grid=4）
  function sampleGrid(px: number, py: number): RGB {
    const g = grid - 1;
    const fx = Math.max(0, Math.min(g - 0.0001, px * g));
    const fy = Math.max(0, Math.min(g - 0.0001, py * g));
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(g, x0 + 1), y1 = Math.min(g, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const c00 = cols[y0 * grid + x0], c10 = cols[y0 * grid + x1];
    const c01 = cols[y1 * grid + x0], c11 = cols[y1 * grid + x1];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const wx0 = smooth ? tx * tx * (3 - 2 * tx) : tx;
    const wy0 = smooth ? ty * ty * (3 - 2 * ty) : ty;
    const topR = lerp(c00.r, c10.r, wx0), topG = lerp(c00.g, c10.g, wx0), topB = lerp(c00.b, c10.b, wx0);
    const botR = lerp(c01.r, c11.r, wx0), botG = lerp(c01.g, c11.g, wx0), botB = lerp(c01.b, c11.b, wx0);
    return { r: lerp(topR, botR, wy0), g: lerp(topG, botG, wy0), b: lerp(topB, botB, wy0) };
  }
  const tA = animate ? t * animSpeed : 0;
  const driftA = drift * (animate ? 0.8 : 0);

  ctx.clearRect(0, 0, w, h);
  const bw = Math.min(96, Math.max(2, Math.round(w))), bh = Math.min(96, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('abyss-grid', bw, bh);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data: dta } = buf;
  for (let py = 0; py < bh; py++) {
    const y01 = py / (bh - 1);
    for (let px = 0; px < bw; px++) {
      const x01 = px / (bw - 1);
      // fbm 域扰动（drift 漂移 + 慢流动）
      const n1 = fbmA(x01 * 3.1 + driftA + tA * 0.03, y01 * 3.1 - tA * 0.02) * 0.5;
      const n2 = fbmA(x01 * 6.2 - tA * 0.04, y01 * 6.2 + driftA * 1.4 + tA * 0.03) * 0.3;
      const dx = x01 + n1 + n2;
      const dy = y01 + fbmA(x01 * 4.4 + tA * 0.02, y01 * 4.4 + driftA) * 0.45;
      let col = sampleGrid(dx, dy);
      // fixEdges：边缘保持原色（去掉扰动）避免边缘空白
      if (fixEdges) {
        const edge = Math.max(0, Math.min(1, Math.min(Math.min(x01, 1 - x01) * 8, Math.min(y01, 1 - y01) * 8)));
        const cBase = sampleGrid(x01, y01);
        const m = Math.min(1, edge);
        col = { r: cBase.r + (col.r - cBase.r) * m, g: cBase.g + (col.g - cBase.g) * m, b: cBase.b + (col.b - cBase.b) * m };
      }
      // hue 旋转
      if (hue !== 0) col = hueRotate(col.r, col.g, col.b, hue);
      // film：亮度/对比度/饱和度
      let r = col.r, g = col.g, b = col.b;
      r += fBrightness * 255; g += fBrightness * 255; b += fBrightness * 255;
      r = (r - 128) * fContrast + 128; g = (g - 128) * fContrast + 128; b = (b - 128) * fContrast + 128;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * fSaturation; g = lum + (g - lum) * fSaturation; b = lum + (b - lum) * fSaturation;
      // film 颗粒
      if (fGrain > 0) {
        const g01 = noiseA(px * 3.3 + tA * 5, py * 3.3 + tA * 5) - 0.5;
        const gAmt = g01 * fGrain * 90;
        r += gAmt; g += gAmt; b += gAmt;
      }
      // film 暗角（vignette）
      const vx = (x01 - 0.5) / 0.5, vy = (y01 - 0.5) / 0.5;
      const vd = Math.sqrt(vx * vx + vy * vy);
      const vg = 1 - Math.max(0, Math.min(1, vd - 0.7) / 0.5) * fFade * 0.7;
      r *= vg; g *= vg; b *= vg;
      const idx = (py * bw + px) * 4;
      dta[idx] = Math.max(0, Math.min(255, r));
      dta[idx + 1] = Math.max(0, Math.min(255, g));
      dta[idx + 2] = Math.max(0, Math.min(255, b));
      // 透明：亮度映射 alpha（暗色→透明）
      const mx = Math.max(r, Math.max(g, b));
      const al = Math.max(0, Math.min(1, (mx / 255 - 0.28) / 0.55)) * 0.95;
      dta[idx + 3] = Math.max(0, Math.min(255, al * 255));
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, bw, bh, 0, 0, w, h);
}


/* ===================== MetalForge Filament / 丝状粒子流（1:1 复刻） ===================== */
/**
 * display_filament_fragment 多 pass 粒子流 → Canvas CPU 粒子系统忠实移植：
 * swirl 涡旋力场 + friction 摩擦 + trail 拖尾（destination-out 淡化）+ filmic roll-off
 * + glow/bloom + vignette。cool/hot/spark 三色粒子。透明通道：粒子辉光亮度→alpha，背景透明。
 */
const _filamentState = new Map<string, { x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; age: Float32Array; off: HTMLCanvasElement | null; last: number }>();
function drawFilament(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  const swirl = Number(params?.swirl ?? 34);
  const friction = Number(params?.friction ?? 0.25);
  const trail = Number(params?.trail ?? 0.94);
  const fade = Number(params?.fade ?? 0.3);
  const size = Number(params?.size ?? 2);
  const brightness = Number(params?.brightness ?? 0.36);
  const exposure = Number(params?.exposure ?? 1.5);
  const vignette = Number(params?.vignette ?? 0.45);
  const glow = Number(params?.glow ?? 0.5);
  const cutoff = Number(params?.cutoff ?? 0.35);
  const spd = Number(params?.speed ?? 1);
  const hex2rgbF = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  const kCool: RGB = hex2rgbF({ r: 0x12, g: 0x30, b: 0x8f }, params?.cool);
  const kHot: RGB = hex2rgbF({ r: 0x66, g: 0xe6, b: 0xff }, params?.hot);
  const kSpark: RGB = hex2rgbF({ r: 0xff, g: 0xbd, b: 0x57 }, params?.spark);
  const key = `${w}x${h}`;
  let st = _filamentState.get(key);
  const now = performance.now ? performance.now() : t * 1000;
  if (!st) {
    const N = 140;
    st = {
      x: new Float32Array(N), y: new Float32Array(N),
      vx: new Float32Array(N), vy: new Float32Array(N),
      age: new Float32Array(N), off: null, last: now,
    };
    const ox = w * 0.5, oy = h * 0.5;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * Math.min(w, h) * 0.5;
      st.x[i] = ox + Math.cos(a) * rr;
      st.y[i] = oy + Math.sin(a) * rr;
      st.vx[i] = Math.cos(a + Math.PI / 2) * (0.3 + Math.random() * 0.4);
      st.vy[i] = Math.sin(a + Math.PI / 2) * (0.3 + Math.random() * 0.4);
      st.age[i] = Math.random() * 100;
    }
    _filamentState.set(key, st);
  }
  let dt = Math.min(0.05, (now - st.last) / 1000);
  st.last = now;
  // 粒子步进
  const cx = w * 0.5, cy = h * 0.5;
  const swirlK = swirl * 0.06 * spd;
  const gravK = 0.6;
  const N = st.x.length;
  const dx = dt * 60;
  for (let i = 0; i < N; i++) {
    const px = st.x[i] - cx, py = st.y[i] - cy;
    const pr = Math.hypot(px, py) || 1;
    const grav = -gravK / (pr + 30) * 60;
    st.vx[i] = (st.vx[i] + (-py / pr) * swirlK * dx * 0.016 + (px / pr) * grav * dx * 0.016) * (1 - Math.min(0.9, friction * 0.06));
    st.vy[i] = (st.vy[i] + (px / pr) * swirlK * dx * 0.016 + (py / pr) * grav * dx * 0.016) * (1 - Math.min(0.9, friction * 0.06));
    st.x[i] += st.vx[i] * dx * 0.016 * 6 * spd;
    st.y[i] += st.vy[i] * dx * 0.016 * 6 * spd;
    st.age[i] += dx;
    // 越界重生
    const rr2 = Math.hypot(st.x[i] - cx, st.y[i] - cy);
    if (rr2 > Math.min(w, h) * 0.72) {
      const a = Math.random() * Math.PI * 2;
      const r3 = Math.random() * Math.min(w, h) * 0.2;
      st.x[i] = cx + Math.cos(a) * r3;
      st.y[i] = cy + Math.sin(a) * r3;
      st.vx[i] = Math.cos(a + Math.PI / 2) * (0.3 + Math.random() * 0.4);
      st.vy[i] = Math.sin(a + Math.PI / 2) * (0.3 + Math.random() * 0.4);
    }
  }
  // 持久 offscreen：拖尾累积
  if (!st.off || st.off.width !== Math.max(2, Math.round(w)) || st.off.height !== Math.max(2, Math.round(h))) {
    st.off = document.createElement('canvas');
    st.off.width = Math.max(2, Math.round(w));
    st.off.height = Math.max(2, Math.round(h));
  }
  const oc = st.off;
  const octx = oc.getContext('2d')!;
  octx.globalCompositeOperation = 'destination-out';
  octx.fillStyle = `rgba(0,0,0,${Math.min(0.5, fade * 0.95)})`;
  octx.fillRect(0, 0, oc.width, oc.height);
  octx.globalCompositeOperation = 'lighter';
  const sw = oc.width / w, sh = oc.height / h;
  const dotR = Math.max(1.2, size * 2.2) * (sw);
  for (let i = 0; i < N; i++) {
    const dxs = (st.x[i] - cx) * sw + oc.width * 0.5;
    const dys = (st.y[i] - cy) * sh + oc.height * 0.5;
    const pr = Math.hypot(st.x[i] - cx, st.y[i] - cy) / (Math.min(w, h) * 0.5);
    // 颜色：径向 cool→hot，spark 高频
    const spdN = Math.hypot(st.vx[i], st.vy[i]);
    let cr = kCool.r, cg = kCool.g, cb = kCool.b;
    const mixH = Math.max(0, Math.min(1, pr * 1.4 + spdN * 0.8));
    cr += (kHot.r - cr) * mixH; cg += (kHot.g - cg) * mixH; cb += (kHot.b - cb) * mixH;
    const sparkA = Math.max(0, Math.sin(st.age[i] * 0.35 + i * 12.7));
    const sAmt = sparkA * sparkA * 0.85;
    cr += (kSpark.r - cr) * sAmt; cg += (kSpark.g - cg) * sAmt; cb += (kSpark.b - cb) * sAmt;
    const alpha = Math.max(0, Math.min(1, brightness * 3.4 * (0.42 + spdN * 1.3)));
    const rrpx = dotR * (1 + pr * 0.6);
    // 绘制外圈光晕 + 亮核，替代每帧 140 次创建 RadialGradient 的巨大开销与 GC 停顿
    const rOuter = rrpx * 2.2;
    octx.fillStyle = `rgba(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)},${(alpha * 0.22).toFixed(3)})`;
    octx.beginPath();
    octx.arc(dxs, dys, rOuter, 0, Math.PI * 2);
    octx.fill();
    octx.fillStyle = `rgba(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)},${alpha.toFixed(3)})`;
    octx.beginPath();
    octx.arc(dxs, dys, rrpx * 0.85, 0, Math.PI * 2);
    octx.fill();
  }
  // 主画布：透明背景，绘制 offscreen
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(oc, 0, 0, w, h);
  // vignette（可选）
  if (vignette > 0) {
    const vg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, vignette)})`);
    // source-atop：仅压暗已有粒子像素 RGB，不增加透明区域（保持透明通道）
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}


/** UMBRA 3D 角色（MetalForge Character/UMBRA 视觉复刻）
 *  Canvas 2D 版本：深色圆盘角色 + 顶部暂停图标 + 双眼 + 3D 旋转（turn/tilt/lean）+ 材质光照（matte/soft/glossy/rim/flat）+ idle 呼吸/眨眼。
 *  背景透明，仅角色像素。
 */
function umbraMixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * k), g = Math.round(ag + (bg - ag) * k), bl = Math.round(ab + (bb - ab) * k);
  return `rgb(${r},${g},${bl})`;
}
function drawUmbraCharacter(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cA: RGB, cB: RGB, cC: RGB, speed: number, pm: Record<string, number | string>): void {
  const cx = w / 2, cy = h / 2;
  const num = (k: string, d: number) => { const v = pm[k]; return typeof v === 'number' && isFinite(v) ? v : d; };
  const hexc = (k: string, d: string) => { const v = pm[k]; return typeof v === 'string' && /^#/.test(v) ? v : d; };
  const size = num('size', 1) * Math.min(w, h) * 0.34;
  const width = num('width', 1), height = num('height', 1), depth = num('depth', 1);
  const turn = num('turn', 0) * Math.PI / 180, tilt = num('tilt', 0) * Math.PI / 180, lean = num('lean', 0) * Math.PI / 180;
  const persp = num('perspective', 1);
  const matS = Math.max(0, Math.min(4, Math.floor(num('matSurface', 0))));
  const bodyC = hexc('bodyColor', '#17191C'), lightC = hexc('lightColor', '#FFFFFF'), shadowC = hexc('shadowColor', '#000000');
  const eyeC = hexc('eyeColor', '#F5F6F4');
  const lightX = num('lightX', -0.2), lightY = num('lightY', -0.26);
  const shine = num('shine', 0.2), shadowA = num('shadow', 0.06), spread = num('spread', 1), gloss = num('gloss', 0), rim = num('rim', 0);
  const eyeW = num('eyeWidth', 1), eyeH = num('eyeHeight', 1), eyeS = num('eyeSpacing', 1), eyeR = num('eyeRaise', 0), eyeA = num('eyeAngle', 0) * Math.PI / 180;
  const liveliness = num('liveliness', 1), blinkRate = num('blinkRate', 1);
  const breath = 1 + Math.sin(t * 1.3 * Math.max(0.01, speed)) * 0.022 * liveliness;
  const bp = Math.sin(t * 0.7 * Math.max(0.01, blinkRate));
  const blink = bp > 0.9 ? Math.max(0.05, 1 - (bp - 0.9) / 0.1) : 1;
  const ct = Math.cos(turn), st = Math.sin(turn), ct2 = Math.cos(tilt), st2 = Math.sin(tilt);
  const rx = Math.max(2, size * Math.max(0.12, ct) * width * breath);
  const ry = Math.max(2, size * Math.max(0.12, ct2) * height * breath);
  const shift = st * size * 0.16 * persp;
  // 底部椭圆阴影（透明，仅角色脚下）
  const shGrad = ctx.createRadialGradient(cx, cy + ry * 1.06, 0, cx, cy + ry * 1.06, rx * 1.1);
  shGrad.addColorStop(0, `rgba(0,0,0,${Math.min(0.35, shadowA * 1.2)})`);
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 1.07, rx * 1.08, Math.max(2, ry * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();
  // 身体
  ctx.save();
  ctx.translate(cx + shift, cy);
  ctx.rotate(lean);
  const gx = -lightX * rx, gy = -lightY * ry;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (matS === 4) {
    ctx.fillStyle = bodyC;
    ctx.fill();
  } else if (matS === 3) {
    ctx.fillStyle = bodyC;
    ctx.fill();
    if (rim > 0) {
      ctx.strokeStyle = lightC;
      ctx.globalAlpha = Math.min(1, rim * 1.5);
      ctx.lineWidth = Math.max(1.5, rx * 0.07 * rim);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else {
    const hl = gloss > 0.3 ? 0.9 : matS === 2 ? 0.8 : matS === 1 ? 0.55 : 0.35;
    const g2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(4, rx * spread * 1.7));
    g2.addColorStop(0, umbraMixHex(bodyC, lightC, Math.min(1, hl * Math.max(0.05, shine + gloss * 0.6))));
    g2.addColorStop(0.6, bodyC);
    g2.addColorStop(1, umbraMixHex(bodyC, shadowC, Math.min(1, shadowA * 4)));
    ctx.fillStyle = g2;
    ctx.fill();
  }
  // rim 发光：matte/soft/glossy 下的可选 rim 边缘光
  if (matS !== 3 && rim > 0) {
    ctx.strokeStyle = lightC;
    ctx.globalAlpha = Math.min(0.9, rim);
    ctx.lineWidth = Math.max(1, rx * 0.05 * rim);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 暂停图标（两条竖条，绕Y投影）
  const barW = rx * 0.085 * Math.max(0.15, ct);
  const barH = ry * 0.34;
  const barY = -ry * 0.05;
  ctx.fillStyle = lightC;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-rx * 0.1 - barW / 2, barY, barW, barH);
  ctx.fillRect(rx * 0.1 - barW / 2, barY, barW, barH);
  ctx.globalAlpha = 1;
  // 眼睛（两个椭圆点，3D 投影 + 眨眼）
  const eyeR2 = rx * 0.085 * eyeW * Math.max(0.15, ct);
  const eyeRy = ry * 0.15 * eyeH * blink;
  const eyeOff = rx * 0.24 * eyeS;
  const eyeY = -ry * 0.28 + eyeR * ry;
  ctx.fillStyle = eyeC;
  ctx.save();
  ctx.rotate(eyeA);
  ctx.beginPath();
  ctx.ellipse(-eyeOff, eyeY, Math.max(0.5, eyeR2), Math.max(0.5, eyeRy), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(eyeOff, eyeY, Math.max(0.5, eyeR2), Math.max(0.5, eyeRy), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // depth 厚度：底部一层轻微暗边（模拟厚度）
  ctx.save();
  ctx.globalAlpha = Math.min(0.25, shadowA * 2);
  ctx.fillStyle = shadowC;
  ctx.beginPath();
  ctx.ellipse(cx + shift, cy + ry * 0.92, rx * 0.9, Math.max(1, ry * 0.12), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** MetalForge spinning-earth 大陆位图（EARTH_MASK · 256x128 大陆掩码，WGSL 原样提取） */
const EARTH_W = 256, EARTH_H = 128, EARTH_WORDS_PER_ROW = 8;
const EARTH_MASK: number[] = [
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000200, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0xf387fffa, 0x0001ffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x60000000, 0xfffefffb, 0x007fffff, 0x00000000, 0x00000b08, 0x0000001c, 0x00000000,
  0x00000000, 0xf0000000, 0xfffe1fff, 0x0003ffff, 0x0007ff00, 0x00000000, 0x0000017c, 0x00000000,
  0x00000000, 0x89830000, 0xffffe3fd, 0x0001ffff, 0x0000ba00, 0x00000000, 0x00000380, 0x00000000,
  0x00000000, 0xd2047c00, 0xffff80fe, 0x0003ffff, 0x00000800, 0x0000c000, 0x0000ff80, 0x00000000,
  0x00000000, 0xd21fe000, 0xffc0007f, 0x0003ffff, 0x00000000, 0xc0000f00, 0x0001ffff, 0x0000067c,
  0x00000000, 0x76001f00, 0xff0000a6, 0x0003ffff, 0x00000000, 0xfc000380, 0x0105ffff, 0x00000000,
  0x00000000, 0x379fff80, 0xfe0007ff, 0x0000ffff, 0x00000000, 0xff0e00e0, 0x0fffffff, 0x00000078,
  0x00078001, 0x303ff100, 0xfe001fff, 0x0001ffff, 0x00000000, 0xffff00c0, 0xffffffff, 0x0001ffff,
  0x1ffff000, 0x7cffe2bc, 0xfe00fe38, 0x00007fff, 0x007fe000, 0xffff3800, 0xffffffff, 0x3ebbffff,
  0xfffffc03, 0xfc7bffff, 0xfc01fe3b, 0x00000fff, 0x8ffff800, 0xffeffff9, 0xffffffff, 0xffffffff,
  0xfffff03f, 0xffffffff, 0xfc0ff03f, 0x000000ff, 0x9ffffc00, 0xfff7ffff, 0xffffffff, 0xffffffff,
  0xfffffe3e, 0xffffffff, 0xfc04fe1f, 0x003f801f, 0xe1fcfe00, 0xffffffff, 0xffffffff, 0xffffffff,
  0xffffe000, 0xffffffff, 0xf803f039, 0x001f0007, 0xfffe7f80, 0xffffffff, 0xffffffff, 0x7fffffff,
  0xfffff800, 0x7fffffff, 0xf001c200, 0x00000003, 0xffff9ff0, 0xffffffff, 0xffffffff, 0x7fffffff,
  0xfffffc00, 0x1fffffff, 0xe0003e00, 0x00000003, 0xffff8ff0, 0xffffffff, 0xffffffff, 0x07f47fff,
  0xfc37e800, 0x1fffffff, 0x00047e00, 0x00000001, 0xfff71ff0, 0xffffffff, 0xffffffff, 0x001c3fff,
  0xc0070000, 0x3fffffff, 0x000fff00, 0x00000000, 0xffff0f30, 0xffffffff, 0xffffffff, 0x000e001f,
  0x00018000, 0xffffffff, 0x000ffe01, 0x70000000, 0xffff8ec0, 0xffffffff, 0xffffffff, 0x000f8007,
  0x00002000, 0xfffffffe, 0x001ffe07, 0x70000000, 0xffff83c0, 0xffffffff, 0xffffffff, 0x00078001,
  0x00000000, 0xfffffff8, 0x007fff3f, 0xee000000, 0xffffffc0, 0xffffffff, 0xffffffff, 0x0003800b,
  0x00000000, 0xfffffff0, 0x00ffff3f, 0xee000000, 0xfffffff9, 0xffffffff, 0xffffffff, 0x0001803f,
  0x00000000, 0xffffffe0, 0x00ffffff, 0xe2000000, 0xfffffffd, 0xffffffff, 0xffffffff, 0x0000802f,
  0x00000000, 0xffffffc0, 0x008dffff, 0x00000000, 0xfffffffe, 0xffffffff, 0xffffffff, 0x0000002f,
  0x00000000, 0xffffff80, 0x03c3ffff, 0xe0000000, 0xffffffff, 0xffffffff, 0xffffffff, 0x0000002f,
  0x00000000, 0xffffff00, 0x0303ffff, 0xc0000000, 0xffffffff, 0xffffffff, 0xffffffff, 0x00000027,
  0x00000000, 0xffffff00, 0x001fffff, 0x80000000, 0xf9bfffff, 0xffffffe7, 0xffffffff, 0x00000003,
  0x00000000, 0xffffff00, 0x0006ffff, 0x80000000, 0xf81ff9ff, 0xfffffff3, 0xffffffff, 0x00000021,
  0x00000000, 0xffffff00, 0x00003fff, 0xfc000000, 0xe00ff307, 0xffffffe3, 0xffffffff, 0x00000070,
  0x00000000, 0xffffff00, 0x00003fff, 0xfc000000, 0xe38fce03, 0xffffff87, 0x0fffffff, 0x00000000,
  0x00000000, 0xffffff00, 0x00000fff, 0xfc000000, 0xfff9c840, 0xffffffc7, 0x0fbfffff, 0x00000010,
  0x00000000, 0xffffff00, 0x000007ff, 0xfe000000, 0xfff98800, 0xffffffc7, 0x060fffff, 0x00000018,
  0x00000000, 0xfffffe00, 0x000003ff, 0x7c000000, 0xfff98600, 0xffffffcf, 0x0c7fffff, 0x0000000c,
  0x00000000, 0xfffffc00, 0x000003ff, 0x00000000, 0xfe0000ff, 0xffffffff, 0x0c3fffff, 0x0000000e,
  0x00000000, 0xfffffc00, 0x000001ff, 0xf8000000, 0xfe0000ff, 0xffffffff, 0xc41fffff, 0x00000003,
  0x00000000, 0xfffff000, 0x000000ff, 0xfc000000, 0xfe0001ff, 0xffffffff, 0x703fffff, 0x00000000,
  0x00000000, 0xffffe000, 0x0000003f, 0xfe000000, 0xff47c7ff, 0xffffffff, 0x207fffff, 0x00000000,
  0x00000000, 0xffff4000, 0x0000003b, 0xfe000000, 0xffffffff, 0xffffffff, 0x007fffff, 0x00000000,
  0x00000000, 0x0fff8000, 0x00000060, 0xff000000, 0xffffffff, 0xfffffff3, 0x007fffff, 0x00000000,
  0x00000000, 0x07fe8000, 0x00000060, 0xff800000, 0xfeffffff, 0xffffffe7, 0x003fffff, 0x00000000,
  0x00000000, 0x07fd0000, 0x00000040, 0xffc00000, 0xfdffffff, 0xfffffe0f, 0x001fffff, 0x00000000,
  0x00000000, 0x07fb0000, 0x00000000, 0xffe00000, 0xf9ffffff, 0xffff009f, 0x004fffff, 0x00000000,
  0x00000000, 0x07f00000, 0x00000040, 0xffe00000, 0xfbffffff, 0xfffe03ff, 0x0027ffff, 0x00000000,
  0x00000000, 0x07e00000, 0x00000180, 0xfff00000, 0xf3ffffff, 0xfffe03ff, 0x0000fffe, 0x00000000,
  0x00000000, 0x07e00000, 0x00000603, 0xfff00000, 0xf7ffffff, 0x3ff003ff, 0x00004ffc, 0x00000000,
  0x00000000, 0x8fc00000, 0x00007003, 0xfff00000, 0xe7ffffff, 0x0ff001ff, 0x000067f8, 0x00000000,
  0x00000000, 0xff000000, 0x00000003, 0xffe00000, 0xcfffffff, 0x07f000ff, 0x00400ff8, 0x00000000,
  0x00000000, 0xfc000000, 0x00000001, 0xfff00000, 0xcfffffff, 0x03f0003f, 0x00601fe8, 0x00000000,
  0x00000000, 0xc0000000, 0x0000001f, 0xfff00000, 0xdfffffff, 0x01e0000f, 0x00603fc0, 0x00000000,
  0x00000000, 0x00000000, 0x0000001f, 0xfff00000, 0xbfffffff, 0x01e00003, 0x00c03fc0, 0x00000000,
  0x00000000, 0x00000000, 0x0000101c, 0xfff00000, 0x7fffffff, 0x01e00000, 0x00003e40, 0x00000000,
  0x00000000, 0x00000000, 0x0011fc18, 0xffe00000, 0xffffffff, 0x01c0000f, 0x01801c40, 0x00000000,
  0x00000000, 0x00000000, 0x001ffdb0, 0xffc00000, 0xffffffff, 0x02c0000f, 0x02000440, 0x00000000,
  0x00000000, 0x00000000, 0x003fff40, 0xff800000, 0xffffffff, 0x0200000f, 0x038000c0, 0x00000000,
  0x00000000, 0x00000000, 0x007ffe00, 0xff000000, 0xffffffff, 0x02000007, 0x03080180, 0x00000000,
  0x00000000, 0x00000000, 0x07fffe00, 0x5e000000, 0xfffffff0, 0x00000007, 0x000c03b0, 0x00000000,
  0x00000000, 0x00000000, 0x0ffffe00, 0x00000000, 0xffffff80, 0x00000003, 0x000e0360, 0x00000000,
  0x00000000, 0x00000000, 0x0fffff00, 0x00000000, 0xffffff80, 0x00000001, 0x000f83c0, 0x00000000,
  0x00000000, 0x00000000, 0x1fffff80, 0x00000000, 0x7fffff80, 0x00000000, 0x014fe3c0, 0x00000000,
  0x00000000, 0x00000000, 0x7fffff80, 0x00000000, 0x3fffffc0, 0x00000000, 0x600fc380, 0x00000000,
  0x00000000, 0x00000000, 0xffffff80, 0x00000000, 0x1fffff80, 0x00000000, 0xc067c700, 0x00000006,
  0x00000000, 0x00000000, 0xffffff80, 0x0000000f, 0x1fffff00, 0x00000000, 0xd8660f00, 0x0000003f,
  0x00000000, 0x00000000, 0xffffffc0, 0x0000003f, 0x0fffff00, 0x00000000, 0x00200e00, 0x000000fe,
  0x00000000, 0x00000000, 0xffffff80, 0x0000007f, 0x0ffffe00, 0x00000000, 0x00001800, 0x000045fc,
  0x00000000, 0x00000000, 0xffffff80, 0x0000007f, 0x0ffffe00, 0x00000000, 0x0001f000, 0x000001fc,
  0x00000000, 0x00000000, 0xffffff00, 0x0000007f, 0x0ffffe00, 0x00000000, 0x02000000, 0x00000330,
  0x00000000, 0x00000000, 0xfffffe00, 0x0000003f, 0x1ffffc00, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0xfffffe00, 0x0000001f, 0x1ffffc00, 0x00000000, 0xe0000000, 0x00000020,
  0x00000000, 0x00000000, 0xfffffc00, 0x0000001f, 0x1ffffe00, 0x0000000c, 0xf0000000, 0x00000021,
  0x00000000, 0x00000000, 0xfffffc00, 0x0000000f, 0x1ffffe00, 0x0000000c, 0xf6000000, 0x00000061,
  0x00000000, 0x00000000, 0xfffff800, 0x0000000f, 0x1fffff00, 0x0000000f, 0xff000000, 0x000000f3,
  0x00000000, 0x00000000, 0xffffe000, 0x0000000f, 0x87ffff00, 0x00000007, 0xff800000, 0x400000ff,
  0x00000000, 0x00000000, 0xffffc000, 0x0000000f, 0x83fffe00, 0x00000007, 0xffc00000, 0x000000ff,
  0x00000000, 0x00000000, 0xffffc000, 0x0000000f, 0x81fffe00, 0x00000007, 0xfff00000, 0x000003ff,
  0x00000000, 0x00000000, 0xffffc000, 0x00000007, 0x81fffc00, 0x00000003, 0xfffc0000, 0x000003ff,
  0x00000000, 0x00000000, 0xffffc000, 0x00000001, 0x81fffc00, 0x00000003, 0xfffe0000, 0x00000fff,
  0x00000000, 0x00000000, 0x7fffc000, 0x00000000, 0x81fffc00, 0x00000003, 0xfffe0000, 0x00000fff,
  0x00000000, 0x00000000, 0x3fffc000, 0x00000000, 0x00fff800, 0x00000000, 0xfffe0000, 0x00001fff,
  0x00000000, 0x00000000, 0x3fffe000, 0x00000000, 0x007ff800, 0x00000000, 0xfffe0000, 0x00001fff,
  0x00000000, 0x00000000, 0x1fffe000, 0x00000000, 0x007ff000, 0x00000000, 0xfffe0000, 0x00001fff,
  0x00000000, 0x00000000, 0x0fffe000, 0x00000000, 0x003ff000, 0x00000000, 0xfffc0000, 0x00001fff,
  0x00000000, 0x00000000, 0x07ffe000, 0x00000000, 0x001fe000, 0x00000000, 0xfffc0000, 0x00001fff,
  0x00000000, 0x00000000, 0x07ffe000, 0x00000000, 0x000fe000, 0x00000000, 0x81fc0000, 0x00000fff,
  0x00000000, 0x00000000, 0x03ffe000, 0x00000000, 0x0000e000, 0x00000000, 0x001c0000, 0x00000ffd,
  0x00000000, 0x00000000, 0x00fff000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x080007f8,
  0x00000000, 0x00000000, 0x00fff000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x100007f8,
  0x00000000, 0x00000000, 0x007ff000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x70000160,
  0x00000000, 0x00000000, 0x000ff000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x30000000,
  0x00000000, 0x00000000, 0x0003f800, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x0c000380,
  0x00000000, 0x00000000, 0x0003f800, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x06000180,
  0x00000000, 0x00000000, 0x0003f000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x03000000,
  0x00000000, 0x00000000, 0x0000f800, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x03800000,
  0x00000000, 0x00000000, 0x0001f800, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x0001fc00, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x0000f800, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00407800, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00007000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x0000e000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00400000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x000c0000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00070000, 0x00000000, 0x00000000, 0xc00000f0, 0xf783ffff, 0x0000003f,
  0x00000000, 0x00000000, 0x00030000, 0x00000000, 0xc0000000, 0xff03ffff, 0xffffffff, 0x000001ff,
  0x00000000, 0x00000000, 0x000f6000, 0x00000000, 0xf7800000, 0xffc1ffff, 0xffffffff, 0x0003ffff,
  0x00000000, 0x00000000, 0x000fe000, 0x28000000, 0xfffffffe, 0xfff9ffff, 0xffffffff, 0x00ffffff,
  0x00000000, 0x00000000, 0x001f4800, 0xff800000, 0xffffffff, 0xfffeffff, 0xffffffff, 0x01ffffff,
  0x00000000, 0xff800240, 0x001fffff, 0xffe00000, 0xffffffff, 0xffffffff, 0xffffffff, 0x003fffff,
  0xf0000000, 0xffffffff, 0x0007ffff, 0xfff80000, 0xffffffff, 0xffffffff, 0xffffffff, 0x000fffff,
  0xff000000, 0xffffffff, 0x00007fff, 0xfffff800, 0xffffffff, 0xffffffff, 0xffffffff, 0x000fffff,
  0xffff0000, 0xffffffff, 0xe00007ff, 0xffffff80, 0xffffffff, 0xffffffff, 0xffffffff, 0x005fffff,
  0xfff03000, 0xffffffff, 0xf00063ff, 0xfffffe83, 0xffffffff, 0xffffffff, 0xffffffff, 0x0003ffff,
  0xfff80000, 0xffffffff, 0x3c107fff, 0xfffffff0, 0xffffffff, 0xffffffff, 0xffffffff, 0x0003ffff,
  0xfff80000, 0xffffffff, 0x7e0bffff, 0xfffffffe, 0xffffffff, 0xffffffff, 0xffffffff, 0x000fffff,
  0xfffffa00, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0x0fffffff,
  0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
  0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
  0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
  0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
];

/* ===================== MetalForge Spinning Earth / Metal Dots 金属点阵地球（1:1 复刻） ===================== */
/**
 * spinningEarthAnim s==0 Metal Dots 分支（WebGPU WGSL → Canvas ImageData 逐像素忠实移植）。
 * 球面投影 + 经纬点阵光点（大陆/海洋区分）+ 金属光照（diff/spec/rim）+ 大气光晕 + knee 色调曲线。
 * 透明通道：球体亮度 → alpha（球外透明，非原版整幅 alpha=1）。
 */
function drawMetalDots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cA: RGB,
  cB: RGB,
  cC: RGB,
  speed: number,
  params: VfxParams | null
) {
  const globeSize = Number(params?.globeSize ?? 0.41);
  const tilt = Number(params?.tilt ?? 0.41);
  const detail = Number(params?.detail ?? 74);
  const dotSize = Number(params?.dotSize ?? 0.12);
  const offsetY = Number(params?.offsetY ?? 0);
  const spd = Number(params?.speed ?? 0.3);
  const sweepSpeed = Number(params?.sweepSpeed ?? 1.05);
  const contourBands = Number(params?.contourBands ?? 7);
  const hex2rgbM = (fb: RGB, hex?: string | number): RGB => {
    if (typeof hex === 'string') {
      let hx = hex.replace('#', '');
      if (hx.length === 3) hx = hx.split('').map((c) => c + c).join('');
      const n = parseInt(hx, 16);
      if (!isNaN(n)) return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    return fb;
  };
  // landColor=#D1DBF0 / oceanColor=#576685 / atmosphere=#739EFF / sweepColor=#1AFF59 / gridColor=#0F6B29 / contourLow=#000000 / contourHigh=#FFFFFF
  const kLand: RGB = hex2rgbM({ r: 0xd1, g: 0xdb, b: 0xf0 }, params?.landColor);
  const kOcean: RGB = hex2rgbM({ r: 0x57, g: 0x66, b: 0x85 }, params?.oceanColor);
  const kRim: RGB = hex2rgbM({ r: 0x73, g: 0x9e, b: 0xff }, params?.atmosphere);
  const kSweep: RGB = hex2rgbM({ r: 0x1a, g: 0xff, b: 0x59 }, params?.sweepColor);
  const kGrid: RGB = hex2rgbM({ r: 0x0f, g: 0x6b, b: 0x29 }, params?.gridColor);
  const cLo: RGB = hex2rgbM({ r: 0, g: 0, b: 0 }, params?.contourLow);
  const cHi: RGB = hex2rgbM({ r: 255, g: 255, b: 255 }, params?.contourHigh);

  function landPoint(lat: number, lon: number): boolean {
    const uu = (((lon + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
    const vv = Math.max(0, Math.min(0.99999, (Math.PI / 2 - lat) / Math.PI));
    const col = Math.max(0, Math.min(255, Math.floor(uu * 256)));
    const row = Math.max(0, Math.min(127, Math.floor(vv * 128)));
    const widx = row * 8 + Math.floor(col / 32);
    const bit = col % 32;
    return ((EARTH_MASK[widx] >>> bit) & 1) !== 0;
  }
  function landHits(lat: number, lon: number, dLat: number, dLon: number): number {
    let hits = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (landPoint(lat + j * dLat * 0.4, lon + i * dLon * 0.4)) hits++;
    }
    return hits;
  }
  function sstepE(e0: number, e1: number, x: number): number {
    const s = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return s * s * (3 - 2 * s);
  }

  const angle = t * speed * spd;
  const PI = Math.PI;
  const centerX = 0.5 * w, centerY = 0.5 * h + offsetY * 0.5 * h;
  const R = globeSize * Math.min(w, h);
  const bands = Math.max(1, Math.round(detail));
  const dLat = PI / bands;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  // kLight 归一化（-0.45, 0.55, 0.70）
  const kL = (() => {
    const m = Math.sqrt(0.45 * 0.45 + 0.55 * 0.55 + 0.70 * 0.70);
    return { x: -0.45 / m, y: 0.55 / m, z: 0.70 / m };
  })();
  const kLz = (1 / Math.sqrt(1.25)) * 1; // Hh = normalize(kLight + (0,0,1))

  ctx.clearRect(0, 0, w, h);
  const bw = Math.min(100, Math.max(2, Math.round(w))), bh = Math.min(100, Math.max(2, Math.round(h)));
  const buf = getOffscreenBuffer('metal-dots', bw, bh);
  if (!buf) return;
  const { canvas: off, ctx: octx, img, data: dta } = buf;

  for (let py = 0; py < bh; py++) {
    const posY = py + 0.5;
    for (let px = 0; px < bw; px++) {
      const posX = px + 0.5;
      // earthProject
      const dx = (posX - centerX) / R, dy = (posY - centerY) / R;
      const rr = dx * dx + dy * dy;
      let outR = 0, outG = 0, outB = 0;
      if (rr <= 1) {
        const Vz = Math.sqrt(Math.max(0, 1 - rr));
        // T = (V.x, ct*V.y+st*V.z, -st*V.y+ct*V.z), V=(dx,-dy,Vz)
        const Ty = ct * (-dy) + st * Vz;
        const Tz = -st * (-dy) + ct * Vz;
        // M = (ca*T.x - sa*T.z, T.y, sa*T.x + ca*T.z)
        const Mx = ca * dx - sa * Tz;
        const My = Ty;
        const Mz = sa * dx + ca * Tz;
        const lat = Math.asin(Math.max(-1, Math.min(1, My)));
        const lon = Math.atan2(Mx, Mz);
        // graticule 点阵
        const latNode = Math.round(lat / dLat) * dLat;
        const ring = Math.max(1, Math.round((2 * PI * Math.cos(latNode)) / dLat));
        const dLon = (2 * PI) / ring;
        const lonNode = Math.round(lon / dLon) * dLon;
        let dLonOff = lon - lonNode;
        dLonOff = dLonOff - 2 * PI * Math.round(dLonOff / (2 * PI));
        const na = (lat - latNode) / dLat;
        const nb = dLonOff / dLon;
        const dist = Math.sqrt(na * na + nb * nb);
        // aaw 自适应：保证点至少 ~1px 可见（原版 fwidth(dist) 语义），大画布上收敛到 0.012
        const aaw = Math.max(0.012, 1.2 / (R * dLat));
        const dotCore = 1 - sstepE(dotSize - aaw, dotSize + aaw, dist);
        const poleFade = sstepE(PI / 2, PI / 2 - 2 * dLat, Math.abs(latNode));
        const dotBase = dotCore * poleFade;
        // metal dots 着色
        const dotMask = dotBase * sstepE(1, 0.92, rr);
        const V = { x: dx, y: -dy, z: Vz };
        const land = landHits(latNode, lonNode, dLat, dLon) >= 4;
        // diff/spec
        const diff = Math.max(0, V.x * kL.x + V.y * kL.y + V.z * kL.z);
        // Hh = normalize(kLight + (0,0,1))
        const Hxm = kL.x, Hym = kL.y, Hzm = kL.z + 1;
        const hmm = Math.sqrt(Hxm * Hxm + Hym * Hym + Hzm * Hzm);
        const spec = Math.pow(Math.max(0, (V.x * Hxm + V.y * Hym + V.z * Hzm) / hmm), 34);
        const rim = Math.pow(1 - V.z, 3);
        const isLand = land;
        const base = isLand ? kLand : kOcean;
        const lvl = isLand ? 1 : 0.42;
        const specLvl = isLand ? 1 : 0.5;
        // specTint = land? (1,1,1) : mix(1, base, 0.6)
        let stx = 255, sty = 255, stz = 255;
        if (!isLand) { stx = 255 + (base.r - 255) * 0.6; sty = 255 + (base.g - 255) * 0.6; stz = 255 + (base.b - 255) * 0.6; }
        const litR = base.r * (0.18 + 0.92 * diff) * lvl + stx * (spec * 1.25 * specLvl) + kRim.r * (rim * 0.55) * lvl;
        const litG = base.g * (0.18 + 0.92 * diff) * lvl + sty * (spec * 1.25 * specLvl) + kRim.g * (rim * 0.55) * lvl;
        const litB = base.b * (0.18 + 0.92 * diff) * lvl + stz * (spec * 1.25 * specLvl) + kRim.b * (rim * 0.55) * lvl;
        let ocR = litR * dotMask, ocG = litG * dotMask, ocB = litB * dotMask;
        // edge
        const edge = sstepE(0.92, 1, rr) * sstepE(1.02, 1, rr);
        ocR += kRim.r * (edge * 0.16 * (0.4 + 0.6 * diff));
        ocG += kRim.g * (edge * 0.16 * (0.4 + 0.6 * diff));
        ocB += kRim.b * (edge * 0.16 * (0.4 + 0.6 * diff));
        outR = ocR; outG = ocG; outB = ocB;
      } else if (rr < 1.18 * 1.18) {
        // 大气光晕
        const d = Math.sqrt(rr) - 1;
        const halo = Math.exp(-d * 11) * 0.16;
        const dmag = Math.sqrt(dx * dx + dy * dy + 0.35 * 0.35);
        const diff = Math.max(0, (dx * kL.x + (-dy) * kL.y + 0.35 * kL.z) / dmag);
        outR = kRim.r * (halo * (0.35 + 0.65 * diff));
        outG = kRim.g * (halo * (0.35 + 0.65 * diff));
        outB = kRim.b * (halo * (0.35 + 0.65 * diff));
      }
      // knee(outc, 0.75)：暗部线性，亮部压缩
      // knee(outc, 0.75)：原版处理 0-1 归一化颜色，这里在 0-255 域用等价阈值
      const K = 0.75 * 255;
      const knee1 = (v: number) => (v <= K ? v : K + (255 - K) * (1 - Math.exp(-(v - K) / (255 - K))));
      let fR = knee1(outR), fG = knee1(outG), fB = knee1(outB);
      const idx = (py * bw + px) * 4;
      dta[idx] = Math.max(0, Math.min(255, fR));
      dta[idx + 1] = Math.max(0, Math.min(255, fG));
      dta[idx + 2] = Math.max(0, Math.min(255, fB));
      // 透明：球体亮度 → alpha
      const lum = Math.max(fR, Math.max(fG, fB)) / 255;
      dta[idx + 3] = Math.max(0, Math.min(255, lum * 255));
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, bw, bh, 0, 0, w, h);
}

/** 焦散光球（玻璃内部焦散干涉流动，MetalForge orb-caustics 风格） */
/* ===================== 统一入口（支持鼠标交互） ===================== */
export function drawVfxMotion(
  ctx: CanvasRenderingContext2D,
  type: VfxMotionId | 'spinning-earth' | 'lightlines',
  w: number,
  h: number,
  timeSec: number,
  cfg: VfxMotionConfig,
  mouse?: VfxMouse | null,
  params?: VfxParams | null
): void {
  const cA = hexToRgb(cfg.colorA);
  const cB = hexToRgb(cfg.colorB);
  const cC = hexToRgb(cfg.colorC || cfg.colorA);
  const speed = cfg.speed || 1;
  const m = mouse || null;
  // Character presets read parameter keys directly; always provide an object so
  // the preview can render with defaults before an inspector supplies params.
  const pm: VfxParams = params || {};
  switch (type) {
    // Progress 进度
    case 'progress-scan': drawProgressScan(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'progress-orbit': drawProgressOrbit(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'progress-threads': drawProgressThreads(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    case 'progress-liquid': drawProgressLiquid(ctx, w, h, timeSec, cA, cB, cC, speed, pm, 0); break;
    case 'progress-slosh': drawProgressLiquid(ctx, w, h, timeSec, cA, cB, cC, speed, pm, 1); break;
    case 'wallpaper-abyss': drawWallpaper(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    case 'thinking-orbs-ribbon': drawThinkingOrbs(ctx, w, h, timeSec, cA, cB, cC, speed, pm, 'ribbon'); break;
    case 'thinking-orbs-ping': drawThinkingOrbs(ctx, w, h, timeSec, cA, cB, cC, speed, pm, 'ping'); break;
    case 'spinning-earth-metal': drawMetalDots(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    case 'glow-card': drawGlowCard(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    case 'abyss-grid': drawAbyssGrid(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    case 'filament': drawFilament(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    case 'character-umbra': drawUmbraCharacter(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    // Orbs 光球
    case 'orbs': drawOrbs(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'halo': drawHalo(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'particles': drawParticles(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'spinning-earth': drawSpinningEarth(ctx, w, h, timeSec, cA, cB, speed, m, cC, pm); break;
    case 'orb-metal': drawMetalOrb(ctx, w, h, timeSec, cA, cB, cC, speed, pm); break;
    // Loaders 加载
    case 'rings': drawRings(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'vortex': drawVortex(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'hyperspace': drawHyperspace(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'dotloader': drawDotLoader(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'lightlines': drawLightLines(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'orbital': drawOrbital(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'neonwave': drawNeonWave(ctx, w, h, timeSec, cA, cB, speed, m); break;
    // Character 字符
    case 'datarain': drawDatarain(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'charflow': drawCharflow(ctx, w, h, timeSec, cA, cB, speed, m); break;
    // Gradient 渐变
    case 'plasma': drawPlasma(ctx, w, h, timeSec, cA, cB, speed, m, cC); break;
    case 'aurora': drawAurora(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'nebula': drawNebula(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'gradientflow': drawGradientFlow(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'iridescent': drawIridescent(ctx, w, h, timeSec, cA, cB, speed, m); break;
    // Cards 卡片
    case 'cardscan': drawCardScan(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'cardshine': drawCardShine(ctx, w, h, timeSec, cA, cB, speed, m); break;
    case 'morph-circle-pill':
    case 'morph-size':
    case 'morph-reverse-collapse':
      drawMorphMotion(ctx, w, h, timeSec, cA, cB, speed, type, pm); break;
  }
}

/** 逐像素类动效（低分辨率渲染以保性能） */
export function isPixelMotion(type: VfxMotionId | 'spinning-earth' | 'lightlines'): boolean {
  return type === 'plasma' || type === 'nebula' || type === 'iridescent' || type === 'orb-metal'
    || type === 'wallpaper-abyss' || type === 'abyss-grid' || type === 'progress-threads'
    || type === 'progress-liquid' || type === 'glow-card' || type === 'spinning-earth-metal'
    || type === 'spinning-earth' || type === 'filament';
}

