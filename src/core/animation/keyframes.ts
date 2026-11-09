import type { SceneElement } from '../../types';

export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';
export type KeyframeProperty = 'x' | 'y' | 'w' | 'h' | 'rot' | 'opacity' | string;

export interface PropertyKeyframe {
  id: string;
  time: number;
  value: number;
  easing?: KeyframeEasing;
}

export interface PropertyTrack {
  property: KeyframeProperty;
  keyframes: PropertyKeyframe[];
}

export interface ElementAnimation {
  tracks: PropertyTrack[];
}

/** Numeric properties use the same timeline track regardless of which inspector owns them. */
export type AnimatedNumericProperty =
  | 'x' | 'y' | 'w' | 'h' | 'rot' | 'opacity'
  | 'maskX' | 'maskY' | 'maskWidth' | 'maskHeight' | 'maskRadius' | 'maskFeather'
  | 'saberCoreWidth' | 'saberGlowSpread' | 'saberGlowIntensity';

export const MASK_ANIMATED_PROPERTIES = [
  'maskX', 'maskY', 'maskWidth', 'maskHeight', 'maskRadius', 'maskFeather',
] as const satisfies readonly AnimatedNumericProperty[];

export interface KeyframeClipboard {
  property: KeyframeProperty;
  value: number;
  easing: KeyframeEasing;
}

let keyframeClipboard: KeyframeClipboard | null = null;

export const ANIMATABLE_PROPERTIES: Array<{ property: KeyframeProperty; label: string; min?: number; max?: number; step?: number; unit?: string }> = [
  { property: 'x', label: 'X 位置', min: 0, max: 100, step: 0.1, unit: '%' },
  { property: 'y', label: 'Y 位置', min: 0, max: 100, step: 0.1, unit: '%' },
  { property: 'w', label: '宽度', min: 0.1, max: 100, step: 0.1, unit: '%' },
  { property: 'h', label: '高度', min: 0.1, max: 100, step: 0.1, unit: '%' },
  { property: 'rot', label: '旋转', step: 1, unit: '°' },
  { property: 'opacity', label: '透明度', min: 0, max: 100, step: 1, unit: '%' },
];

const clampTime = (time: number) => Math.max(0, Math.round((Number.isFinite(time) ? time : 0) * 100) / 100);

export function getElementAnimation(element: SceneElement): ElementAnimation {
  return element.keyframes && Array.isArray(element.keyframes.tracks) ? element.keyframes : { tracks: [] };
}

export function getPropertyTrack(element: SceneElement, property: KeyframeProperty): PropertyTrack | undefined {
  return getElementAnimation(element).tracks.find((track) => track.property === property);
}

export function getKeyframeAt(track: PropertyTrack | undefined, time: number, epsilon = 0.035): PropertyKeyframe | undefined {
  if (!track) return undefined;
  return track.keyframes.find((keyframe) => Math.abs(keyframe.time - time) <= epsilon);
}

export function getNeighborKeyframe(track: PropertyTrack | undefined, time: number, direction: -1 | 1): PropertyKeyframe | undefined {
  if (!track) return undefined;
  const frames = [...track.keyframes].sort((a, b) => a.time - b.time);
  return direction < 0
    ? [...frames].reverse().find((keyframe) => keyframe.time < time - 0.035)
    : frames.find((keyframe) => keyframe.time > time + 0.035);
}

export function upsertKeyframe(element: SceneElement, property: KeyframeProperty, time: number, value: number, easing: KeyframeEasing = 'ease-in-out'): ElementAnimation {
  const animation = getElementAnimation(element);
  const nextTracks = animation.tracks.map((track) => ({ ...track, keyframes: [...track.keyframes] }));
  const normalizedTime = clampTime(time);
  let track = nextTracks.find((item) => item.property === property);
  if (!track) {
    track = { property, keyframes: [] };
    nextTracks.push(track);
  }
  const existing = getKeyframeAt(track, normalizedTime);
  if (existing) {
    existing.time = normalizedTime;
    existing.value = value;
    existing.easing = easing;
  } else {
    track.keyframes.push({ id: `kf_${property}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, time: normalizedTime, value, easing });
  }
  track.keyframes.sort((a, b) => a.time - b.time);
  return { tracks: nextTracks.filter((item) => item.keyframes.length > 0) };
}

export function removeKeyframe(element: SceneElement, property: KeyframeProperty, time: number): ElementAnimation {
  const normalizedTime = clampTime(time);
  return { tracks: getElementAnimation(element).tracks
    .map((track) => ({ ...track, keyframes: track.keyframes.filter((keyframe) => Math.abs(keyframe.time - normalizedTime) > 0.035) }))
    .filter((track) => track.keyframes.length > 0) };
}

export function clearAllKeyframes(element: SceneElement): ElementAnimation {
  return { tracks: [] };
}

/** Remove only mask animation tracks while preserving the layer's other animation. */
export function clearKeyframeProperties(element: SceneElement, properties: readonly KeyframeProperty[]): ElementAnimation {
  const propertySet = new Set(properties);
  return {
    tracks: getElementAnimation(element).tracks
      .filter((track) => !propertySet.has(track.property))
      .map((track) => ({ ...track, keyframes: [...track.keyframes] })),
  };
}

export function moveKeyframe(element: SceneElement, property: KeyframeProperty, keyframeId: string, time: number): ElementAnimation {
  const next = getElementAnimation(element).tracks.map((track) => ({ ...track, keyframes: [...track.keyframes] }));
  const track = next.find((item) => item.property === property);
  if (!track) return { tracks: next };
  const keyframe = track.keyframes.find((item) => item.id === keyframeId);
  if (!keyframe) return { tracks: next };
  keyframe.time = clampTime(time);
  const collision = track.keyframes.find((item) => item.id !== keyframeId && Math.abs(item.time - keyframe.time) <= 0.035);
  if (collision) {
    collision.value = keyframe.value;
    collision.easing = keyframe.easing;
    track.keyframes = track.keyframes.filter((item) => item.id !== keyframeId);
  }
  track.keyframes.sort((a, b) => a.time - b.time);
  return { tracks: next.filter((item) => item.keyframes.length > 0) };
}

/** Keep scene-time keyframes attached to their layer when the layer start moves. */
export function shiftKeyframes(element: SceneElement, delta: number): ElementAnimation | undefined {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.0001 || !element.keyframes?.tracks?.length) return element.keyframes;
  const offset = Number(delta.toFixed(2));
  return {
    tracks: element.keyframes.tracks.map((track) => ({
      ...track,
      keyframes: track.keyframes.map((keyframe) => ({
        ...keyframe,
        time: clampTime(keyframe.time + offset),
      })),
    })),
  };
}

export function setKeyframeEasing(element: SceneElement, property: KeyframeProperty, keyframeId: string, easing: KeyframeEasing): ElementAnimation {
  const next = getElementAnimation(element).tracks.map((track) => ({ ...track, keyframes: track.keyframes.map((keyframe) => ({ ...keyframe })) }));
  const track = next.find((item) => item.property === property);
  const keyframe = track?.keyframes.find((item) => item.id === keyframeId);
  if (keyframe) keyframe.easing = easing;
  return { tracks: next };
}

export function copyKeyframe(keyframe: PropertyKeyframe, property: KeyframeProperty): void {
  keyframeClipboard = { property, value: keyframe.value, easing: keyframe.easing || 'ease-in-out' };
}

export function hasKeyframeClipboard(property?: KeyframeProperty): boolean {
  return Boolean(keyframeClipboard && (!property || keyframeClipboard.property === property));
}

export function pasteKeyframe(element: SceneElement, property: KeyframeProperty, time: number): ElementAnimation | undefined {
  if (!keyframeClipboard || keyframeClipboard.property !== property) return undefined;
  return upsertKeyframe(element, property, time, keyframeClipboard.value, keyframeClipboard.easing);
}

function easingProgress(progress: number, easing: KeyframeEasing = 'linear'): number {
  const p = Math.max(0, Math.min(1, progress));
  if (easing === 'hold') return 0;
  if (easing === 'ease-in') return p * p;
  if (easing === 'ease-out') return 1 - (1 - p) * (1 - p);
  if (easing === 'ease-in-out') return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return p;
}

export function evaluatePropertyTrack(track: PropertyTrack | undefined, time: number, fallback: number): number {
  if (!track || track.keyframes.length === 0) return fallback;
  // Tracks are kept sorted by every mutation path. Avoid allocating and
  // sorting a new array on every playback frame; only repair legacy or
  // externally-authored unsorted tracks when detected.
  let frames = track.keyframes;
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index - 1].time > frames[index].time) {
      frames = [...frames].sort((a, b) => a.time - b.time);
      break;
    }
  }
  if (time <= frames[0].time) return frames[0].value;
  const last = frames[frames.length - 1];
  if (time >= last.time) return last.value;
  const nextIndex = frames.findIndex((frame) => frame.time >= time);
  const next = frames[Math.max(1, nextIndex)];
  const previous = frames[Math.max(0, nextIndex - 1)];
  if (previous.easing === 'hold') return previous.value;
  const span = Math.max(0.0001, next.time - previous.time);
  const progress = easingProgress((time - previous.time) / span, previous.easing || 'linear');
  return previous.value + (next.value - previous.value) * progress;
}

export function evaluateAnimatedProperty(
  element: SceneElement,
  property: KeyframeProperty,
  time: number,
  fallback: number,
): number {
  return evaluatePropertyTrack(getPropertyTrack(element, property), time, fallback);
}

export function evaluateElementProperties(element: SceneElement, time: number): Pick<SceneElement, 'x' | 'y' | 'w' | 'h' | 'rot' | 'opacity'> {
  if (!element.keyframes?.tracks?.length) {
    return {
      x: element.x,
      y: element.y,
      w: element.w,
      h: element.h,
      rot: element.rot || 0,
      opacity: element.opacity ?? 100,
    };
  }
  const animation = getElementAnimation(element);
  const value = (property: KeyframeProperty, fallback: number) => evaluatePropertyTrack(animation.tracks.find((track) => track.property === property), time, fallback);
  return {
    x: value('x', element.x),
    y: value('y', element.y),
    w: value('w', element.w),
    h: value('h', element.h),
    rot: value('rot', element.rot || 0),
    opacity: value('opacity', element.opacity ?? 100),
  };
}
