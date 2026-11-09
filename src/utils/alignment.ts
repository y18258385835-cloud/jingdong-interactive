import type { SceneElement } from '../types';

export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom';
export type DistributeMode = 'horizontal' | 'vertical';

export interface AlignBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AlignResult {
  id: string;
  x: number;
  y: number;
}

const CANVAS_MIN = 0;
const CANVAS_MAX = 100;

const round = (value: number) => Math.round(value * 100) / 100;

const clampPosition = (value: number, size: number) => {
  const max = Math.max(CANVAS_MIN, CANVAS_MAX - Math.max(0, size));
  return Math.max(CANVAS_MIN, Math.min(max, value));
};

const readBox = (element: Pick<SceneElement, 'id' | 'x' | 'y' | 'w' | 'h'>): AlignBox | null => {
  const x = Number(element.x);
  const y = Number(element.y);
  const w = Number(element.w);
  const h = Number(element.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { id: element.id, x, y, w: Math.max(0, w), h: Math.max(0, h) };
};

/**
 * 把多选图层的 x/y 对齐到选区包围盒（单选时对齐到画布）。
 * 只返回位置发生变化的图层，方便一次性批量提交。
 */
export function alignElements(
  elements: Array<Pick<SceneElement, 'id' | 'x' | 'y' | 'w' | 'h'>>,
  mode: AlignMode,
  canvasWidth = CANVAS_MAX,
  canvasHeight = CANVAS_MAX,
): AlignResult[] {
  const boxes = elements.map(readBox).filter((box): box is AlignBox => Boolean(box));
  if (boxes.length === 0) return [];

  const multi = boxes.length > 1;
  const left = multi ? Math.min(...boxes.map((box) => box.x)) : 0;
  const top = multi ? Math.min(...boxes.map((box) => box.y)) : 0;
  const right = multi ? Math.max(...boxes.map((box) => box.x + box.w)) : canvasWidth;
  const bottom = multi ? Math.max(...boxes.map((box) => box.y + box.h)) : canvasHeight;
  const boundsWidth = Math.max(0, right - left);
  const boundsHeight = Math.max(0, bottom - top);

  const results: AlignResult[] = [];
  boxes.forEach((box) => {
    let x = box.x;
    let y = box.y;
    if (mode === 'left') x = left;
    else if (mode === 'center-h') x = left + (boundsWidth - box.w) / 2;
    else if (mode === 'right') x = right - box.w;
    else if (mode === 'top') y = top;
    else if (mode === 'middle-v') y = top + (boundsHeight - box.h) / 2;
    else if (mode === 'bottom') y = bottom - box.h;

    const nextX = round(clampPosition(x, box.w));
    const nextY = round(clampPosition(y, box.h));
    if (Math.abs(nextX - box.x) < 0.01 && Math.abs(nextY - box.y) < 0.01) return;
    results.push({ id: box.id, x: nextX, y: nextY });
  });
  return results;
}

/**
 * 等距分布：保持首尾图层不动，把中间图层按相等间距排开。
 * 少于 3 个图层时没有可分布的对象，返回空数组。
 */
export function distributeElements(
  elements: Array<Pick<SceneElement, 'id' | 'x' | 'y' | 'w' | 'h'>>,
  mode: DistributeMode,
): AlignResult[] {
  const boxes = elements.map(readBox).filter((box): box is AlignBox => Boolean(box));
  if (boxes.length < 3) return [];

  const horizontal = mode === 'horizontal';
  const sorted = boxes.slice().sort((a, b) => {
    const delta = horizontal ? a.x - b.x : a.y - b.y;
    return Math.abs(delta) > 0.001 ? delta : a.id.localeCompare(b.id);
  });
  const start = horizontal ? sorted[0].x : sorted[0].y;
  const end = horizontal
    ? Math.max(...sorted.map((box) => box.x + box.w))
    : Math.max(...sorted.map((box) => box.y + box.h));
  const total = sorted.reduce((sum, box) => sum + (horizontal ? box.w : box.h), 0);
  const gap = (end - start - total) / (sorted.length - 1);

  const results: AlignResult[] = [];
  let cursor = start;
  sorted.forEach((box) => {
    const nextX = horizontal ? round(clampPosition(cursor, box.w)) : round(box.x);
    const nextY = horizontal ? round(box.y) : round(clampPosition(cursor, box.h));
    if (Math.abs(nextX - box.x) >= 0.01 || Math.abs(nextY - box.y) >= 0.01) {
      results.push({ id: box.id, x: nextX, y: nextY });
    }
    cursor += (horizontal ? box.w : box.h) + gap;
  });
  return results;
}
