import { describe, expect, it } from 'vitest';
import { GALAXY_COMPONENT_BASE_SIZE, getUiComponentAspect } from '../src/components/ui/GalaxyComponents';
import { OFFICIAL_PLUGIN_REGISTRY } from '../src/plugins/registry';

describe('official plugin renderer layout contract', () => {
  it('keeps a stable intrinsic size for every official plugin', () => {
    expect(OFFICIAL_PLUGIN_REGISTRY).toHaveLength(33);
    for (const plugin of OFFICIAL_PLUGIN_REGISTRY) {
      const size = GALAXY_COMPONENT_BASE_SIZE[plugin.componentType];
      expect(size, plugin.id).toMatchObject({ w: expect.any(Number), h: expect.any(Number) });
      expect(size.w, plugin.id).toBeGreaterThan(0);
      expect(size.h, plugin.id).toBeGreaterThan(0);
      expect(getUiComponentAspect(undefined, plugin.componentType), plugin.id).toBeCloseTo(size.w / size.h, 6);
    }
  });
});
