import { describe, expect, it } from 'vitest';
import { isTimelineTimeVisible } from '../src/core/render/timeline';

describe('timeline visibility', () => {
  it('uses start-inclusive and end-exclusive layer windows', () => {
    expect(isTimelineTimeVisible(0.99, 1, 2)).toBe(false);
    expect(isTimelineTimeVisible(1, 1, 2)).toBe(true);
    expect(isTimelineTimeVisible(2.5, 1, 2)).toBe(true);
    expect(isTimelineTimeVisible(3, 1, 2)).toBe(false);
    expect(isTimelineTimeVisible(3.01, 1, 2)).toBe(false);
  });

  it('hides zero or negative duration layers', () => {
    expect(isTimelineTimeVisible(1, 1, 0)).toBe(false);
    expect(isTimelineTimeVisible(1, 1, -1)).toBe(false);
  });

  it('supports intentionally long-lived layers', () => {
    expect(isTimelineTimeVisible(0.99, 1, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isTimelineTimeVisible(1, 1, Number.POSITIVE_INFINITY)).toBe(true);
    expect(isTimelineTimeVisible(999, 1, Number.POSITIVE_INFINITY)).toBe(true);
  });
});
