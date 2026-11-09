import { describe, expect, it } from 'vitest';
import { createHarnessRun, markHarnessExecution, markHarnessRunning } from '../src/core/ai/agentHarness';
import { sanitizeAiSceneProposal } from '../src/core/ai/sceneBuilder';

describe('AETHER agent harness', () => {
  it('maps editable operations to registered tools and audit gates', () => {
    const proposal = sanitizeAiSceneProposal({
      title: 'Harness test',
      summary: 'test',
      operations: [
        { kind: 'create-scene', name: 'Main' },
        { kind: 'create-element', element: { type: 'ui-component', name: 'KPI', uiComponentType: 'metric-card' } },
        { kind: 'bind-mqtt', targetOperation: 1 },
      ],
    });
    expect(proposal).not.toBeNull();
    const run = createHarnessRun(proposal!);
    expect(run.steps.map((step) => step.toolId)).toEqual(['scene.create', 'ui.create', 'data.mqtt.bind', 'layout.audit', 'history.commit']);
  });

  it('records partial execution without hiding skipped operations', () => {
    const proposal = sanitizeAiSceneProposal({ title: 'Harness test', operations: [{ kind: 'create-scene', name: 'Main' }, { kind: 'create-element', sceneId: 'missing', element: { type: 'txt', name: 'Skipped' } }] });
    const ready = createHarnessRun(proposal!);
    const running = markHarnessRunning(ready);
    const completed = markHarnessExecution(running, { project: {} as never, createdElementIds: [], adjustedCount: 0, appliedOperationCount: 1, skippedOperationCount: 1, skippedOperationIndexes: [1] });
    expect(completed.status).toBe('partial');
    expect(completed.steps.find((step) => step.operationIndex === 1)?.status).toBe('skipped');
    expect(completed.steps.at(-1)?.status).toBe('succeeded');
  });
});
