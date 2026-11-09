/**
 * Utility functions for scrubbable (drag-to-adjust) numeric inputs.
 */

export interface ScrubOptions {
  step?: number;
  dragSpeed?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  min?: number;
  max?: number;
  precision?: number;
}

export function calculateScrubDelta(dx: number, options: ScrubOptions = {}): number {
  const { step = 1, dragSpeed = 1, shiftKey = false, altKey = false } = options;
  const multiplier = shiftKey ? 10 : altKey ? 0.1 : 1;
  return dx * (step * 0.5 * dragSpeed) * multiplier;
}

export function clampAndRoundScrubValue(val: number, options: ScrubOptions = {}): number {
  const { min, max, precision = 1 } = options;
  let result = val;
  if (typeof min === 'number') result = Math.max(min, result);
  if (typeof max === 'number') result = Math.min(max, result);
  return Number(result.toFixed(precision));
}
