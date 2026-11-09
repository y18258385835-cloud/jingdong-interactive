import { describe, expect, it } from 'vitest';
import type { InteractionStep } from '../src/types';
import { evaluateInteractionCondition, runInteractionSteps } from '../src/utils/interactionRuntime';

describe('interactionRuntime', () => {
  it('evaluates variable conditions', () => {
    const variables = new Map<string, unknown>([['status', '预警'], ['count', 3], ['empty', '']]);
    const get = (name: string) => variables.get(name);
    expect(evaluateInteractionCondition({ variableName: 'status', operator: 'equals', value: '预警' }, get)).toBe(true);
    expect(evaluateInteractionCondition({ variableName: 'status', operator: 'not-equals', value: '正常' }, get)).toBe(true);
    expect(evaluateInteractionCondition({ variableName: 'count', operator: 'greater', value: 2 }, get)).toBe(true);
    expect(evaluateInteractionCondition({ variableName: 'count', operator: 'less', value: 2 }, get)).toBe(false);
    expect(evaluateInteractionCondition({ variableName: 'empty', operator: 'falsy' }, get)).toBe(true);
    expect(evaluateInteractionCondition({ variableName: 'status', operator: 'truthy' }, get)).toBe(true);
    expect(evaluateInteractionCondition(undefined, get)).toBe(true);
  });

  it('runs actions in order and stops after a jump', async () => {
    const calls: string[] = [];
    const variables = new Map<string, unknown>();
    const steps: InteractionStep[] = [
      { id: '1', type: 'set-variable', variableName: 'mode', variableValue: 'VIP' },
      { id: '2', type: 'switch-variant', componentId: 'grp_card', variantId: 'hover' },
      { id: '3', type: 'jump', target: 'detail' },
      { id: '4', type: 'url', url: 'https://example.com' },
    ];
    await runInteractionSteps(steps, {
      getVariableValue: (name) => variables.get(name),
      jump: (target) => calls.push(`jump:${target}`),
      popup: (target) => calls.push(`popup:${target}`),
      openUrl: (url) => calls.push(`url:${url}`),
      setVariable: (name, value) => { variables.set(name, value); calls.push(`set:${name}=${value}`); },
      switchVariant: (componentId, variantId) => calls.push(`variant:${componentId}:${variantId}`),
      wait: async () => {},
    });
    expect(calls).toEqual(['set:mode=VIP', 'variant:grp_card:hover', 'jump:detail']);
  });

  it('skips steps whose condition is false and honors wait', async () => {
    const calls: string[] = [];
    const waits: number[] = [];
    const variables = new Map<string, unknown>([['ready', false]]);
    await runInteractionSteps([
      { id: '1', type: 'set-variable', variableName: 'skipped', variableValue: 'x', condition: { variableName: 'ready', operator: 'truthy' } },
      { id: '2', type: 'wait', delay: 0.2 },
      { id: '3', type: 'url', url: 'https://aether.local' },
    ], {
      getVariableValue: (name) => variables.get(name),
      jump: () => {},
      popup: () => {},
      openUrl: (url) => calls.push(`url:${url}`),
      setVariable: (name, value) => calls.push(`set:${name}=${value}`),
      switchVariant: () => {},
      wait: async (ms) => { waits.push(ms); },
    });
    expect(calls).toEqual(['url:https://aether.local']);
    expect(waits).toEqual([200]);
  });
});
