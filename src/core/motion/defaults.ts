import type { GestureBinding } from '../../types';

/**
 * 体感手势默认预设（新建场景 / 一键填充时使用）
 * 约定与内置「多媒体工坊」模板一致：
 *   挥手 / 右滑 → 下一场景；左滑 → 上一场景；握拳 → 回到起始场景
 * 每次调用生成全新唯一 id，避免多场景共享引用。
 */
export function createDefaultGestureBindings(): GestureBinding[] {
  const uid = () => 'gb-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return [
    { id: uid(), gesture: 'wave', action: 'next_scene', sensitivity: 1 },
    { id: uid(), gesture: 'swipe_right', action: 'next_scene', sensitivity: 1 },
    { id: uid(), gesture: 'swipe_left', action: 'prev_scene', sensitivity: 1 },
    { id: uid(), gesture: 'fist', action: 'goto_start', sensitivity: 1 },
  ];
}
