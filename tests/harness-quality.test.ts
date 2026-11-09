import { describe, expect, it } from 'vitest';
import { createLocalAiSceneProposal } from '../src/core/ai/sceneBuilder';
import { analyzeHarnessImpact, scoreHarnessProposal } from '../src/core/ai/harnessQuality';

const project = {
  schemaVersion: 1,
  meta: { v: 1, title: 'same-name', author: 'test', updatedAt: new Date().toISOString() },
  start: 'home',
  canvas: { width: 1920, height: 1080 },
  scenes: { home: { id: 'home', alias: 'main', type: 'scene', duration: 10, bgColor: '#000', els: [] } },
} as any;

describe('Harness quality and impact reports', () => {
  it('reports concrete scene, layer, data and history impact', () => {
    const proposal = createLocalAiSceneProposal('create an equipment dashboard with MQTT');
    const report = analyzeHarnessImpact(proposal, project, 'home');
    expect(report.items.some((item) => item.area === 'scene')).toBe(true);
    expect(report.items.some((item) => item.area === 'data')).toBe(true);
    expect(report.items.some((item) => item.area === 'history')).toBe(true);
  });

  it('scores the proposal across the required quality dimensions', () => {
    const proposal = createLocalAiSceneProposal('create an equipment dashboard with MQTT');
    const report = scoreHarnessProposal(proposal, project, 'home');
    expect(report.score).toBeGreaterThan(0);
    expect(report.dimensions.map((item) => item.key)).toEqual([
      'aesthetic', 'hierarchy', 'density', 'overlap', 'bounds', 'authenticity', 'editability', 'coverage',
    ]);
    expect(report.usedTools).toContain('ui.create');
    expect(report.usedTools).toContain('data.mqtt.bind');
  });

  it('does not mark auto-resolvable overlap as a blocking quality failure', () => {
    const proposal = {
      ...createLocalAiSceneProposal('create a dashboard'),
      layout: {
        ...createLocalAiSceneProposal('create a dashboard').layout,
        overlaps: [{ sceneId: 'home', first: 'one', second: 'two' }],
      },
    };
    expect(scoreHarnessProposal(proposal, project, 'home').blocking).toBe(false);
  });
});
