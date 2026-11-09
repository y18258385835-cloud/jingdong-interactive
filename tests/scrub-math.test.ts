import { describe, it, expect } from 'vitest';
import { calculateScrubDelta, clampAndRoundScrubValue } from '../src/utils/scrubMath';

describe('scrubMath', () => {
  it('calculates default delta correctly', () => {
    const delta = calculateScrubDelta(20, { step: 1, dragSpeed: 1 });
    expect(delta).toBe(10); // 20 * (1 * 0.5 * 1) * 1
  });

  it('accelerates by 10x when shiftKey is held', () => {
    const delta = calculateScrubDelta(10, { step: 1, shiftKey: true });
    expect(delta).toBe(50); // 10 * 0.5 * 10
  });

  it('fine-tunes by 0.1x when altKey is held', () => {
    const delta = calculateScrubDelta(20, { step: 1, altKey: true });
    expect(delta).toBe(1); // 20 * 0.5 * 0.1
  });

  it('clamps and rounds within min, max and precision limits', () => {
    expect(clampAndRoundScrubValue(125.678, { min: 0, max: 100, precision: 1 })).toBe(100);
    expect(clampAndRoundScrubValue(-15, { min: 0, max: 100, precision: 1 })).toBe(0);
    expect(clampAndRoundScrubValue(42.3456, { precision: 2 })).toBe(42.35);
  });
});
