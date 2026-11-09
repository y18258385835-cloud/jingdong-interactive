// ========== 工程级画布尺寸系统 ==========
// 新建空白工程时可选画布比例（不限于 16:9），所有渲染/导出跟随工程画布尺寸。
// 元素坐标全部为百分比，画布比例改变后元素自动等比适配（无需迁移数据）。

export interface CanvasSpec {
  width: number;
  height: number;
}

/** 常用播放媒介预设 */
export const CANVAS_PRESETS: { label: string; sub: string; width: number; height: number }[] = [
  { label: '16:9', sub: '横屏 · 电视/PC', width: 1920, height: 1080 },
  { label: '9:16', sub: '竖屏 · 手机', width: 1080, height: 1920 },
  { label: '1:1', sub: '方形 · 方屏广告', width: 1080, height: 1080 },
  { label: '4:3', sub: '传统屏', width: 1600, height: 1200 },
  { label: '3:4', sub: '竖版海报', width: 1200, height: 1600 },
];

/** 默认画布 = 16:9 1920x1080（旧工程无 canvas 字段时回退此值，保证不破坏现有工程） */
export const DEFAULT_CANVAS: CanvasSpec = { width: 1920, height: 1080 };

/** 从工程数据解析画布尺寸；缺失或非法时回退 16:9 */
export function getProjectCanvas(p?: { canvas?: CanvasSpec }): CanvasSpec {
  const c = p?.canvas;
  if (c && Number.isFinite(c.width) && Number.isFinite(c.height) && c.width > 0 && c.height > 0) {
    return { width: Math.round(c.width), height: Math.round(c.height) };
  }
  return { ...DEFAULT_CANVAS };
}

/** 根据宽高推断最接近的预设标签（用于展示） */
export function getCanvasRatioLabel(w: number, h: number): string {
  const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
  const gd = g(w, h) || 1;
  return `${w / gd}:${h / gd}`;
}
