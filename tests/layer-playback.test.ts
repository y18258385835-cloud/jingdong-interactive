import { describe, expect, it } from 'vitest';
import { getLayerPlaybackConfig, getLoopAnimationTime, shouldRepeatVideo } from '../src/core/render/layerPlayback';
import type { SceneElement } from '../src/types';

const layer = (overrides: Partial<SceneElement> = {}): SceneElement => ({
  id: 'layer', type: 'shape', refId: '', x: 0, y: 0, w: 10, h: 10,
  zIndex: 1, opacity: 100, startTime: 2, duration: 10, ...overrides,
});

describe('layer playback controls', () => {
  it('defaults new layers to one playback and respects the configured count', () => {
    expect(getLayerPlaybackConfig(layer())).toEqual({ count: 1, infinite: false });
    expect(getLayerPlaybackConfig(layer({ playbackCount: 4 }))).toEqual({ count: 4, infinite: false });
  });

  it('keeps legacy loop layers looping until a user explicitly disables it', () => {
    expect(getLayerPlaybackConfig(layer({ type: 'vid', loop: 'true' }))).toEqual({ count: 1, infinite: true });
    expect(getLayerPlaybackConfig(layer({ loopAnim: 'pulse' }))).toEqual({ count: 1, infinite: true });
    expect(shouldRepeatVideo(layer({ type: 'vid', loop: 'true', playbackInfinite: false }))).toBe(false);
  });

  it('freezes a finite loop animation after the requested number of cycles', () => {
    const finite = layer({ loopAnim: 'pulse', loopAnimSpeed: 2, playbackCount: 3, playbackInfinite: false });
    expect(getLoopAnimationTime(finite, 2.5)).toBe(2.5);
    expect(getLoopAnimationTime(finite, 4)).toBe(3.5);
    expect(getLoopAnimationTime(layer({ ...finite, playbackInfinite: true }), 9)).toBe(9);
  });
});
