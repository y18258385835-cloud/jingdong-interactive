import { describe, expect, it } from 'vitest';
import type { SceneElement } from '../src/types';
import {
  getOrderedSceneElements,
  getSceneRenderMeta,
  shouldRenderSceneElement,
} from '../src/components/SceneRenderer';

const element = (patch: Partial<SceneElement> = {}): SceneElement => ({
  id: 'layer',
  type: 'img',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  zIndex: 0,
  ...patch,
} as SceneElement);

describe('SceneRenderer scheduling', () => {
  it('keeps numeric z-order stable for equal z-index values', () => {
    const ordered = getOrderedSceneElements([
      element({ id: 'top', zIndex: 20 }),
      element({ id: 'first', zIndex: 0 }),
      element({ id: 'second', zIndex: 0 }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(['first', 'second', 'top']);
  });

  it('shows a layer only inside its timeline range while playing', () => {
    const layer = element({ startTime: 1, duration: 2 });
    const inside = getSceneRenderMeta(layer, 2, true);
    const outside = getSceneRenderMeta(layer, 4, true);
    expect(inside.isInRange).toBe(true);
    expect(outside.isInRange).toBe(false);
    expect(shouldRenderSceneElement(inside, layer, true, false)).toBe(true);
    expect(shouldRenderSceneElement(outside, layer, true, false)).toBe(false);
  });

  it('prewarms video up to 2.5 seconds before its start without displaying it', () => {
    const video = element({ id: 'video', type: 'vid', startTime: 5, duration: 3 });
    const meta = getSceneRenderMeta(video, 3, true);
    expect(meta.isVideoPrewarm).toBe(true);
    expect(shouldRenderSceneElement(meta, video, true, false)).toBe(true);
    expect(getSceneRenderMeta(video, 2.49, true).isVideoPrewarm).toBe(false);
  });

  it('keeps vfx motion layers mounted across clip boundaries during playback to avoid mount thrashing', () => {
    const vfxLayer = element({ id: 'vfx', type: 'vfx', startTime: 5, duration: 3 });
    const outsideMeta = getSceneRenderMeta(vfxLayer, 1, true);
    expect(outsideMeta.isInRange).toBe(false);
    expect(shouldRenderSceneElement(outsideMeta, vfxLayer, true, false)).toBe(true);
  });

  it('keeps an out-of-range interactive layer available when playback is stopped', () => {
    const layer = element({ startTime: 10, duration: 1 });
    const meta = { ...getSceneRenderMeta(layer, 0, false), hasInteraction: true };
    expect(shouldRenderSceneElement(meta, layer, false, false)).toBe(true);
    expect(shouldRenderSceneElement({ ...meta, hasInteraction: false }, layer, false, false)).toBe(false);
  });

  it('keeps legacy layers with a missing or zero duration visible during playback', () => {
    const legacy = element({ startTime: 0, duration: 0 });
    expect(getSceneRenderMeta(legacy, 2, true).isInRange).toBe(true);
  });
});
