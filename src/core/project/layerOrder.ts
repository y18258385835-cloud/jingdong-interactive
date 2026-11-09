import type { ProjectData, Scene } from '../../types';

/** Loading must not rewrite the editor's layer sequence or z-index values. */
export function preserveProjectLayerOrder(projectData: ProjectData): ProjectData {
  const scenes: Record<string, Scene> = {};
  for (const [sceneId, scene] of Object.entries(projectData.scenes)) {
    scenes[sceneId] = { ...scene, els: Array.isArray(scene.els) ? [...scene.els] : [] };
  }
  return { ...projectData, scenes };
}
