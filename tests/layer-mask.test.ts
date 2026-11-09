import { describe, expect, it } from 'vitest';
import { normalizeLayerMask } from '../src/utils/layerMask';

describe('layer mask bounds', () => {
  it('keeps legacy mask rectangles inside the layer bounds', () => {
    const mask = normalizeLayerMask({
      maskEnabled: true,
      maskType: 'rectangle',
      maskInvert: false,
      maskFeather: 0,
      maskX: 92,
      maskY: 94,
      maskWidth: 80,
      maskHeight: 50,
      maskRadius: 0,
      maskNodes: [],
      maskSourceElementId: '',
    });

    expect(mask.x + mask.width).toBeLessThanOrEqual(100);
    expect(mask.y + mask.height).toBeLessThanOrEqual(100);
    expect(mask.width).toBeGreaterThanOrEqual(1);
    expect(mask.height).toBeGreaterThanOrEqual(1);
  });

  it('uses an editable inset when a newly enabled mask has no geometry', () => {
    const mask = normalizeLayerMask({
      maskEnabled: true,
      maskType: 'rectangle',
      maskInvert: false,
      maskFeather: 0,
      maskRadius: 0,
      maskNodes: [],
      maskSourceElementId: '',
    });

    expect(mask.x).toBe(10);
    expect(mask.y).toBe(10);
    expect(mask.width).toBe(80);
    expect(mask.height).toBe(80);
  });
});
