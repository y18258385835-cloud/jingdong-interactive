import type { Scene, SceneElement } from '../../types';

export interface ScenePlaybackRange {
  duration: number;
  inPoint: number;
  outPoint: number;
}

function getElementEnd(element: SceneElement, parentStart = 0): number {
  const start = parentStart + Math.max(0, Number(element.startTime) || 0);
  const end = start + Math.max(0, Number(element.duration) || 0);
  return (element.children || []).reduce(
    (max, child) => Math.max(max, getElementEnd(child, start)),
    end,
  );
}

export function getSceneTimelineEnd(scene?: Scene | null): number {
  if (!scene) return 0;
  return (scene.els || []).reduce((max, element) => Math.max(max, getElementEnd(element)), 0);
}

/**
 * Resolve one authoritative playback range for the editor and timeline.
 * Explicit IN/OUT markers are respected and clamped to the authored scene
 * duration. Legacy exports with reversed markers are repaired deterministically.
 */
export function getScenePlaybackRange(scene?: Scene | null): ScenePlaybackRange {
  const authoredDuration = Math.max(0, Number(scene?.duration) || 0);
  const layerEnd = getSceneTimelineEnd(scene);
  const duration = Math.max(0.1, authoredDuration, layerEnd);
  const rawIn = typeof scene?.inPoint === 'number' && Number.isFinite(scene.inPoint)
    ? scene.inPoint
    : 0;
  const rawOut = typeof scene?.outPoint === 'number' && Number.isFinite(scene.outPoint)
    ? scene.outPoint
    : duration;
  const boundedIn = Math.max(0, Math.min(duration, rawIn));
  const boundedOut = Math.max(0, Math.min(duration, rawOut));
  return boundedIn <= boundedOut
    ? { duration, inPoint: boundedIn, outPoint: boundedOut }
    : { duration, inPoint: boundedOut, outPoint: boundedIn };
}
