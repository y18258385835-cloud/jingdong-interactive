import { describe, expect, it } from 'vitest';
import type { Scene } from '../src/types';
import { getScenePlaybackRange } from '../src/core/timeline/sceneRange';

const scene = (patch: Partial<Scene> = {}): Scene => ({
  id: 'scene', alias: 'Scene', type: 'scene', duration: 19.6, els: [], ...patch,
});

describe('scene playback range', () => {
  it('honors an explicit out point even when layers continue later', () => {
    expect(getScenePlaybackRange(scene({ outPoint: 16.1, els: [{ id: 'layer', type: 'img', refId: '', sourceName: '', x: 0, y: 0, w: 10, h: 10, zIndex: 1, opacity: 100, startTime: 0, duration: 19.6 }] }))).toMatchObject({
      duration: 19.6, inPoint: 0, outPoint: 16.1,
    });
  });

  it('clamps markers to the authored duration and repairs reversed markers', () => {
    expect(getScenePlaybackRange(scene({ duration: 10, inPoint: 14, outPoint: 3 }))).toMatchObject({
      duration: 10, inPoint: 3, outPoint: 10,
    });
  });

  it('uses the latest nested layer when scene duration is stale', () => {
    expect(getScenePlaybackRange(scene({ duration: 10, els: [{ id: 'group', type: 'group', refId: '', sourceName: '', x: 0, y: 0, w: 10, h: 10, zIndex: 1, opacity: 100, startTime: 2, duration: 3, children: [{ id: 'child', type: 'txt', refId: '', sourceName: '', x: 0, y: 0, w: 10, h: 10, zIndex: 1, opacity: 100, startTime: 4, duration: 8 }] }] }))).toMatchObject({ duration: 14 });
  });
});
