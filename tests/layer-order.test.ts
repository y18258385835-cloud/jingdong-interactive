import { describe, expect, it } from 'vitest';
import type { ProjectData } from '../src/types';
import { preserveProjectLayerOrder } from '../src/core/project/layerOrder';
import { exportProjectZip } from '../src/utils/export';

const project: ProjectData = {
  meta: { v: 1 }, start: 'home', scenes: {
    home: {
      id: 'home', alias: 'Home', type: 'scene', duration: 10,
      els: [
        { id: 'foreground', type: 'shape', refId: '', x: 0, y: 0, w: 10, h: 10, zIndex: 90, opacity: 100, startTime: 0, duration: 10, interaction: { action: 'jump', target: 'detail' } },
        { id: 'background', type: 'shape', refId: '', x: 0, y: 0, w: 10, h: 10, zIndex: 10, opacity: 100, startTime: 0, duration: 10 },
        { id: 'middle', type: 'txt', refId: '', x: 0, y: 0, w: 10, h: 10, zIndex: 50, opacity: 100, startTime: 0, duration: 10 },
      ],
    },
  },
};

describe('project layer preservation', () => {
  it('does not reorder layers, rewrite z-index values, or drop interactions while loading a project', () => {
    const preserved = preserveProjectLayerOrder(project);
    expect(preserved.scenes.home.els.map((element) => element.id)).toEqual(['foreground', 'background', 'middle']);
    expect(preserved.scenes.home.els.map((element) => element.zIndex)).toEqual([90, 10, 50]);
    expect(preserved.scenes.home.els[0].interaction).toEqual({ action: 'jump', target: 'detail' });
  });

  it('writes the exact layer sequence and interactions into a ZIP project', async () => {
    const zip = await exportProjectZip(project, undefined, { runtime: 'standalone' });
    const archive = await (await import('jszip')).default.loadAsync(await zip.arrayBuffer());
    const serialized = await archive.file('project.json')?.async('string');
    const exported = JSON.parse(serialized!) as ProjectData;
    expect(exported.scenes.home.els.map((element) => element.id)).toEqual(['foreground', 'background', 'middle']);
    expect(exported.scenes.home.els.map((element) => element.zIndex)).toEqual([90, 10, 50]);
    expect(exported.scenes.home.els[0].interaction?.target).toBe('detail');
  });
});
