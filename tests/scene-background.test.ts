import { describe, expect, it } from 'vitest';
import { getSceneBackgroundStyle, isTransparentSceneBackground } from '../src/utils/sceneBackground';
import { generateStandaloneHTML } from '../src/utils/export';
import type { ProjectData, Scene } from '../src/types';

const transparentScene: Scene = {
  id: 'transparent', alias: '透明场景', type: 'scene', duration: 10, els: [],
  backgroundType: 'transparent', bgColor: '#123456', bgRef: 'background-image',
};

describe('transparent scene backgrounds', () => {
  it('does not leak a stored color or background image into the renderer', () => {
    const style = getSceneBackgroundStyle(transparentScene, (ref) => `asset://${ref}`, () => 'linear-gradient(red, blue)');
    expect(isTransparentSceneBackground(transparentScene)).toBe(true);
    expect(style).toEqual({ backgroundColor: 'transparent', backgroundImage: 'none' });
  });

  it('keeps the transparent branch in the standalone export runtime', () => {
    const project: ProjectData = { meta: { v: 1 }, scenes: { transparent: transparentScene }, start: 'transparent' };
    expect(generateStandaloneHTML(project)).toContain("s.backgroundType === 'transparent'");
  });
});
