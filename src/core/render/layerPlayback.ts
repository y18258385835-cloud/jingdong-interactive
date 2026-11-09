import type { SceneElement } from '../../types';

export const MAX_LAYER_PLAYBACK_COUNT = 100;

export interface LayerPlaybackConfig {
  count: number;
  infinite: boolean;
}

export function getLayerPlaybackConfig(element: SceneElement): LayerPlaybackConfig {
  const count = Math.min(MAX_LAYER_PLAYBACK_COUNT, Math.max(1, Math.floor(element.playbackCount ?? 1)));
  const legacyInfinite = element.loop === 'true' || Boolean(element.loopAnim && element.loopAnim !== 'none');
  return {
    count,
    infinite: element.playbackInfinite ?? legacyInfinite,
  };
}

export function getLoopAnimationTime(element: SceneElement, timelineTime: number): number {
  const { count, infinite } = getLayerPlaybackConfig(element);
  if (infinite) return timelineTime;

  const speed = Math.max(0.1, element.loopAnimSpeed ?? 1);
  const start = element.startTime ?? 0;
  const elapsed = Math.max(0, timelineTime - start);
  return start + Math.min(elapsed, count / speed);
}

export function shouldRepeatVideo(element: SceneElement): boolean {
  return getLayerPlaybackConfig(element).infinite;
}
