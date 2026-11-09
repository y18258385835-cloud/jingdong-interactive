import type { InteractionCondition, InteractionStep } from '../types';

export interface InteractionRuntimeContext {
  getVariableValue: (name: string) => unknown;
  jump: (target: string) => void;
  popup: (target: string) => void;
  openUrl: (url: string) => void;
  setVariable: (name: string, value: string | number | boolean) => void;
  switchVariant: (componentId: string, variantId: string) => void;
  wait?: (ms: number) => Promise<void>;
  safeUrl?: (url: string) => boolean;
}

const defaultWait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, Math.max(0, ms));
});

const isTruthy = (value: unknown) => (
  value !== undefined
  && value !== null
  && value !== ''
  && value !== false
  && value !== 0
  && value !== '0'
  && value !== 'false'
);

export function evaluateInteractionCondition(
  condition: InteractionCondition | undefined,
  getVariableValue: (name: string) => unknown,
): boolean {
  if (!condition || !condition.variableName) return true;
  const actual = getVariableValue(condition.variableName);
  const expected = condition.value;
  switch (condition.operator) {
    case 'equals':
      return String(actual ?? '') === String(expected ?? '');
    case 'not-equals':
      return String(actual ?? '') !== String(expected ?? '');
    case 'greater':
      return Number(actual) > Number(expected);
    case 'less':
      return Number(actual) < Number(expected);
    case 'truthy':
      return isTruthy(actual);
    case 'falsy':
      return !isTruthy(actual);
    default:
      return true;
  }
}

/**
 * Runs an ordered interaction sequence. A jump ends the sequence because the
 * current scene is no longer the active surface. Other actions keep going.
 */
export async function runInteractionSteps(
  steps: InteractionStep[] | undefined,
  context: InteractionRuntimeContext,
): Promise<void> {
  if (!Array.isArray(steps) || steps.length === 0) return;
  const wait = context.wait || defaultWait;
  const safeUrl = context.safeUrl || ((url: string) => /^(https?:\/\/|mailto:)/i.test(url.trim()));

  for (const step of steps) {
    if (!step) continue;
    const delay = Math.max(0, Number(step.delay) || 0);
    if (!evaluateInteractionCondition(step.condition, context.getVariableValue)) continue;
    if (delay > 0) await wait(delay * 1000);

    try {
      if (step.type === 'jump') {
        if (step.target) context.jump(step.target);
        return;
      }
      if (step.type === 'popup') {
        if (step.target) context.popup(step.target);
      } else if (step.type === 'url') {
        if (step.url && safeUrl(step.url)) context.openUrl(step.url.trim());
      } else if (step.type === 'set-variable') {
        if (step.variableName) context.setVariable(step.variableName, step.variableValue ?? '');
      } else if (step.type === 'switch-variant') {
        if (step.componentId && step.variantId) context.switchVariant(step.componentId, step.variantId);
      }
      // wait steps are fully handled by the delay above.
    } catch (error) {
      console.warn('[interaction] step failed', step.type, error);
    }
  }
}
