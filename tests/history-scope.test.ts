import { describe, expect, it } from 'vitest';
import { createProjectHistoryRoot, getProjectHistoryStorageKey } from '../src/core/project/historyScope';

const project = {
  meta: { v: 42.1, title: '导入工程', author: 'test', updatedAt: '2026-01-01T00:00:00.000Z' },
  start: 'scene_1',
  scenes: { scene_1: { id: 'scene_1', alias: '场景 1', type: 'scene' as const, duration: 10, bgColor: '#000', els: [] } },
};

describe('project history scope', () => {
  it('uses distinct persistent history keys for distinct projects', () => {
    expect(getProjectHistoryStorageKey('project-a')).not.toBe(getProjectHistoryStorageKey('project-b'));
  });

  it('creates a single isolated root snapshot for a newly opened project', () => {
    const history = createProjectHistoryRoot(project, {
      projectId: 'project-imported',
      title: '导入工程',
      sceneId: 'scene_1',
      timestamp: new Date('2026-01-01T12:34:56.000Z').getTime(),
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      title: '导入工程', sceneId: 'scene_1', actionType: 'init',
    });
    expect(history[0].timeStr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(JSON.parse(history[0].snapshot)).toEqual(project);
  });
});
