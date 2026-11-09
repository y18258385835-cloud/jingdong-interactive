import { describe, expect, it } from 'vitest';
import { getNextLayerVisibility, isLayerVisible } from '../src/core/timeline/layerVisibility';

describe('timeline layer visibility', () => {
  it('keeps legacy layers visible and toggles visibility without changing other layer data', () => {
    expect(isLayerVisible(undefined)).toBe(true);
    expect(getNextLayerVisibility(undefined)).toBe(false);
    expect(getNextLayerVisibility(false)).toBe(true);
  });
});
