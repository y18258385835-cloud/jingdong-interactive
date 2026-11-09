import { describe, expect, it } from 'vitest';
import type { ProjectData, Scene, SceneElement } from '../src/types';
import { createPlaybackProject, planVideoPlaybackProxies } from '../src/utils/exportVideoPlaybackOptimization';

function makeProject(elements: SceneElement[]): ProjectData {
  const scene: Scene = { id: 'scene', alias: 'Scene', type: 'scene', duration: 40, els: elements };
  return {
    meta: { v: 1 },
    scenes: { scene },
    start: 'scene',
    canvas: { width: 1920, height: 1080 },
  };
}

function makeVideo(index: number, overrides: Partial<SceneElement> = {}): SceneElement {
  return {
    id: `video-${index}`,
    type: 'vid',
    refId: 'video-asset',
    x: 10,
    y: 10,
    w: 5,
    h: 8,
    zIndex: index,
    opacity: 100,
    startTime: index * 0.5,
    duration: 20,
    ...overrides,
  };
}

describe('export video playback proxy planning', () => {
  it('selects overlapping, muted repeated video layers that render far below source canvas size', () => {
    const plan = planVideoPlaybackProxies(makeProject(Array.from({ length: 7 }, (_, index) => makeVideo(index))));

    expect(plan).toEqual([{
      reference: 'video-asset',
      maxConcurrentLayers: 7,
      maxDisplayDimension: 96,
    }]);
  });

  it('keeps source playback when an instance has audible or click-to-play behavior', () => {
    const muted = Array.from({ length: 3 }, (_, index) => makeVideo(index));
    muted.push(makeVideo(3, { muted: false }));
    expect(planVideoPlaybackProxies(makeProject(muted))).toEqual([]);

    const clickToPlay = Array.from({ length: 3 }, (_, index) => makeVideo(index));
    clickToPlay.push(makeVideo(3, { vidMode: 'click' }));
    expect(planVideoPlaybackProxies(makeProject(clickToPlay))).toEqual([]);
  });

  it('does not proxy non-overlapping layers or full-size video', () => {
    const sequential = Array.from({ length: 3 }, (_, index) => makeVideo(index, {
      startTime: index * 20,
      duration: 10,
    }));
    expect(planVideoPlaybackProxies(makeProject(sequential))).toEqual([]);

    const fullSize = Array.from({ length: 3 }, (_, index) => makeVideo(index, { w: 100, h: 100 }));
    expect(planVideoPlaybackProxies(makeProject(fullSize))).toEqual([]);
  });

  it('keeps a shared source when its display size is unknown in nested groups or other asset fields', () => {
    const elements = Array.from({ length: 3 }, (_, index) => makeVideo(index));
    elements.push(makeVideo(3, { type: 'group', children: [makeVideo(4)] }));
    expect(planVideoPlaybackProxies(makeProject(elements))).toEqual([]);

    const project = makeProject(Array.from({ length: 3 }, (_, index) => makeVideo(index)));
    project.scenes.scene.bgRef = 'video-asset';
    expect(planVideoPlaybackProxies(project)).toEqual([]);
  });

  it('rewrites only the player copy and leaves the source project available for reimport', () => {
    const project = makeProject(Array.from({ length: 3 }, (_, index) => makeVideo(index)));
    const playbackProject = createPlaybackProject(project, new Map([['video-asset', './assets/video/playback.webm']]));

    expect(project.scenes.scene.els[0].refId).toBe('video-asset');
    expect(playbackProject.scenes.scene.els[0].refId).toBe('./assets/video/playback.webm');
  });
});
