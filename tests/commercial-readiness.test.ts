import { describe, expect, it } from 'vitest';
import { createLoadTask } from '../src/core/assets/loadTask';
import { scanProjectHealth } from '../src/core/project/healthCheck';
import type { ProjectData } from '../src/types';

const project: ProjectData = {
  meta: { v: 1, title: '回归工程' },
  start: 'home',
  scenes: {
    home: {
      id: 'home', alias: '首页', type: 'scene', duration: 3,
      bgRef: 'missing-bg',
      els: [{ id: 'button', type: 'shape', refId: 'shape', x: 0, y: 0, w: 20, h: 20, zIndex: 1, opacity: 100, startTime: 0, duration: 3, linkType: 'jump', link: 'missing-scene' }],
    },
  },
};

describe('commercial readiness', () => {
  it('reports missing resources and scene links before publishing', () => {
    const report = scanProjectHealth(project, new Set(['shape']));
    expect(report.ok).toBe(false);
    expect(report.missingAssetIds).toContain('missing-bg');
    expect(report.missingSceneIds).toContain('missing-scene');
  });

  it('supports progress and cancellation', async () => {
    const task = createLoadTask(async ({ signal, report }) => {
      report(0.4);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      signal.throwIfAborted();
      return 'ok';
    });
    task.cancel();
    await expect(task.promise).rejects.toMatchObject({ code: 'E_CANCELLED' });
    expect(task.getSnapshot().status).toBe('cancelled');
  });

  it('times out a stalled resource task', async () => {
    const task = createLoadTask(() => new Promise(() => undefined), { timeoutMs: 5 });
    await expect(task.promise).rejects.toMatchObject({ code: 'E_TIMEOUT' });
    expect(task.getSnapshot().status).toBe('timed-out');
  });
});
