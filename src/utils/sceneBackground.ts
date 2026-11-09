import type { Scene } from '../types';
import type { CSSProperties } from 'react';

type SceneBackgroundSource = Pick<
  Scene,
  'backgroundType' | 'bgColor' | 'bgRef' | 'gradientType' | 'gradientStart' | 'gradientVia' | 'gradientEnd' | 'gradientAngle'
>;

export function isTransparentSceneBackground(scene?: SceneBackgroundSource | null): boolean {
  return scene?.backgroundType === 'transparent';
}

export function getSceneBackgroundStyle(
  scene: SceneBackgroundSource | null | undefined,
  resolveAsset: (ref: string) => string,
  resolveGradient: (scene: SceneBackgroundSource) => string,
): Pick<CSSProperties, 'backgroundColor' | 'backgroundImage'> {
  if (isTransparentSceneBackground(scene)) {
    return { backgroundColor: 'transparent', backgroundImage: 'none' };
  }

  if (scene?.backgroundType === 'gradient') {
    return { backgroundColor: 'transparent', backgroundImage: resolveGradient(scene) };
  }

  return {
    backgroundColor: scene?.bgColor || '#000000',
    backgroundImage: scene?.bgRef ? `url(${resolveAsset(scene.bgRef)})` : 'none',
  };
}
