import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_DATA } from '../src/utils/officialShowcase';
import { inspectCustomCodePlugin } from '../src/utils/customCode';
import { getTextStyle } from '../src/utils/typography';
import type { SceneElement } from '../src/types';

describe('Official Showcase Project Integrity', () => {
  it('contains at least 4 bespoke scenes with valid data URL backgrounds', () => {
    const scenes = Object.values(DEFAULT_PROJECT_DATA.scenes);
    expect(scenes.length).toBeGreaterThanOrEqual(4);

    for (const scene of scenes) {
      expect(scene.id).toBeDefined();
      expect(scene.alias).toBeDefined();
      expect(scene.bgRef).toBeDefined();
      expect(scene.bgRef?.startsWith('data:image/svg+xml')).toBe(true);
      expect(scene.els.length).toBeGreaterThan(0);
    }
  });

  it('contains 3 custom-code plugins that all pass inspectCustomCodePlugin with 0 errors', () => {
    const scenes = Object.values(DEFAULT_PROJECT_DATA.scenes);
    const customCodeElements = scenes.flatMap((s) => s.els.filter((el) => el.type === 'custom-code'));

    expect(customCodeElements.length).toBe(3);

    for (const el of customCodeElements) {
      expect(el.customCode).toBeDefined();
      if (!el.customCode) continue;

      const diagnostics = inspectCustomCodePlugin(el.customCode);
      expect(diagnostics.errors).toEqual([]);
      expect(el.customCode.html).toBeTruthy();
      expect(el.customCode.js).toBeTruthy();
    }
  });

  it('guarantees text styling supports break-word overflow wrapping without breaking nowrap mode', () => {
    const baseEl: SceneElement = {
      id: 'txt-test',
      type: 'txt',
      refId: '',
      x: 0,
      y: 0,
      w: 30,
      h: 20,
      zIndex: 1,
      opacity: 100,
      startTime: 0,
      duration: 10,
    };

    const wrappingStyle = getTextStyle(baseEl);
    expect(wrappingStyle.wordBreak).toBe('break-word');
    expect(wrappingStyle.overflowWrap).toBe('break-word');
    expect(wrappingStyle.whiteSpace).toBe('pre-wrap');

    const noWrapStyle = getTextStyle({ ...baseEl, textWrap: 'nowrap' });
    expect(noWrapStyle.wordBreak).toBe('normal');
    expect(noWrapStyle.whiteSpace).toBe('nowrap');
  });
});
