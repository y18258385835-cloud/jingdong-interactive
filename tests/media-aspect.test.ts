import { describe, expect, it } from 'vitest';
import { computeProportionalSize } from '../src/utils/mediaAspect';

describe('media layer aspect sizing', () => {
  it.each([
    { aspect: 16 / 9, width: 40, height: 40 },
    { aspect: 4 / 3, width: 40, height: 53.3 },
    { aspect: 1, width: 40, height: 71.1 },
    { aspect: 9 / 16, width: 25.3, height: 80 },
  ])('preserves physical aspect $aspect on a 1920x1080 canvas', ({ aspect, width, height }) => {
    const size = computeProportionalSize(aspect);
    expect(size.w).toBeCloseTo(width, 1);
    expect(size.h).toBeCloseTo(height, 1);
    expect((size.w * 1920) / (size.h * 1080)).toBeCloseTo(aspect, 2);
  });

  it('uses the supplied canvas dimensions when sizing percentages', () => {
    const size = computeProportionalSize(16 / 9, 40, 80, 8, 90, 5, 1000, 1000);
    expect(size.w).toBe(40);
    expect(size.h).toBe(22.5);
    expect(size.w / size.h).toBeCloseTo(16 / 9, 2);
  });
});
