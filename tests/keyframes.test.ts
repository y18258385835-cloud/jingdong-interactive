import { describe, expect, it } from 'vitest';
import type { SceneElement } from '../src/types';
import {
  clearAllKeyframes,
  clearKeyframeProperties,
  copyKeyframe,
  evaluateElementProperties,
  evaluatePropertyTrack,
  hasKeyframeClipboard,
  moveKeyframe,
  pasteKeyframe,
  shiftKeyframes,
  setKeyframeEasing,
  upsertKeyframe,
  type PropertyTrack,
} from '../src/core/animation/keyframes';

const element = (patch: Partial<SceneElement> = {}): SceneElement => ({
  id: 'layer',
  type: 'img',
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  zIndex: 0,
  ...patch,
} as SceneElement);

describe('property keyframe tracks', () => {
  it('evaluates linear, eased, and hold segments with stable boundary values', () => {
    const track: PropertyTrack = {
      property: 'x',
      keyframes: [
        { id: 'a', time: 1, value: 0, easing: 'ease-in' },
        { id: 'b', time: 3, value: 100, easing: 'hold' },
        { id: 'c', time: 5, value: 50, easing: 'linear' },
      ],
    };

    expect(evaluatePropertyTrack(track, 0, 9)).toBe(0);
    expect(evaluatePropertyTrack(track, 2, 9)).toBe(25);
    expect(evaluatePropertyTrack(track, 4, 9)).toBe(100);
    expect(evaluatePropertyTrack(track, 5, 9)).toBe(50);
    expect(evaluatePropertyTrack(track, 8, 9)).toBe(50);
    expect(evaluatePropertyTrack(undefined, 2, 9)).toBe(9);
  });

  it('returns all supported transform properties from their tracks', () => {
    let animation = { tracks: [] };
    const values: Array<[keyof Pick<SceneElement, 'x' | 'y' | 'w' | 'h' | 'rot' | 'opacity'>, number]> = [
      ['x', 15], ['y', 25], ['w', 35], ['h', 45], ['rot', 90], ['opacity', 60],
    ];
    for (const [property, value] of values) {
      animation = upsertKeyframe({ ...element(), keyframes: animation }, property, 0, value);
    }

    expect(evaluateElementProperties({ ...element(), keyframes: animation }, 0)).toEqual({
      x: 15, y: 25, w: 35, h: 45, rot: 90, opacity: 60,
    });
  });

  it('evaluates opacity keyframes at the preview time', () => {
    let animation = upsertKeyframe(element(), 'opacity', 1, 0, 'linear');
    animation = upsertKeyframe({ ...element(), keyframes: animation }, 'opacity', 3, 100, 'linear');
    const animated = { ...element(), opacity: 100, keyframes: animation };

    expect(evaluateElementProperties(animated, 1).opacity).toBe(0);
    expect(evaluateElementProperties(animated, 2).opacity).toBe(50);
    expect(evaluateElementProperties(animated, 3).opacity).toBe(100);
  });

  it('moves a keyframe and merges collisions while retaining the moved value', () => {
    let animation = upsertKeyframe(element(), 'x', 1, 10);
    animation = upsertKeyframe({ ...element(), keyframes: animation }, 'x', 2, 20);
    const [first] = animation.tracks[0].keyframes;

    const moved = moveKeyframe({ ...element(), keyframes: animation }, 'x', first.id, 2.01);
    expect(moved.tracks[0].keyframes).toHaveLength(1);
    expect(moved.tracks[0].keyframes[0]).toMatchObject({ time: 2, value: 10 });
  });

  it('copies and pastes a property keyframe at the target time with its easing', () => {
    let animation = upsertKeyframe(element(), 'opacity', 1, 35, 'linear');
    const source = animation.tracks[0].keyframes[0];
    copyKeyframe(source, 'opacity');

    expect(hasKeyframeClipboard('opacity')).toBe(true);
    expect(hasKeyframeClipboard('x')).toBe(false);
    animation = pasteKeyframe({ ...element(), keyframes: animation }, 'opacity', 3)!;
    expect(animation.tracks[0].keyframes).toContainEqual(expect.objectContaining({ time: 3, value: 35, easing: 'linear' }));
  });

  it('changes easing on the selected keyframe without mutating the source animation', () => {
    const animation = upsertKeyframe(element(), 'y', 1, 12);
    const frame = animation.tracks[0].keyframes[0];
    const updated = setKeyframeEasing({ ...element(), keyframes: animation }, 'y', frame.id, 'hold');

    expect(frame.easing).toBe('ease-in-out');
    expect(updated.tracks[0].keyframes[0].easing).toBe('hold');
  });

  it('keeps keyframes attached when a layer start time moves', () => {
    const animation = upsertKeyframe(element(), 'x', 1.25, 10);
    const shifted = shiftKeyframes({ ...element({ startTime: 1 }), keyframes: animation }, 1.5);
    expect(shifted?.tracks[0].keyframes[0]).toMatchObject({ time: 2.75, value: 10 });
  });

  it('supports incremental layer moves without compounding the offset', () => {
    const animation = upsertKeyframe(element(), 'x', 1, 10);
    const first = shiftKeyframes({ ...element({ startTime: 0 }), keyframes: animation }, 0.5);
    const second = shiftKeyframes({ ...element({ startTime: 0.5 }), keyframes: first }, 0.25);
    expect(second?.tracks[0].keyframes[0].time).toBe(1.75);
  });

  it('clears every property track in one operation', () => {
    let animation = upsertKeyframe(element(), 'x', 0, 10);
    animation = upsertKeyframe({ ...element(), keyframes: animation }, 'opacity', 0, 50);
    expect(clearAllKeyframes({ ...element(), keyframes: animation }).tracks).toEqual([]);
  });

  it('clears only mask tracks when resetting a mask', () => {
    let animation = upsertKeyframe(element(), 'maskX', 0, 20);
    animation = upsertKeyframe({ ...element(), keyframes: animation }, 'maskFeather', 0, 8);
    animation = upsertKeyframe({ ...element(), keyframes: animation }, 'x', 0, 42);

    const reset = clearKeyframeProperties(
      { ...element(), keyframes: animation },
      ['maskX', 'maskY', 'maskWidth', 'maskHeight', 'maskRadius', 'maskFeather'],
    );

    expect(reset.tracks.map((track) => track.property)).toEqual(['x']);
  });
});
