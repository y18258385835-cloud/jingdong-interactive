import { aetherDB } from '../core/storage';
import type { ProjectData } from '../types';

export interface ProjectVersion {
  id: string;
  name: string;
  createdAt: number;
  snapshot: ProjectData;
  sceneCount: number;
  elementCount: number;
}

export const MAX_PROJECT_VERSIONS = 12;

const versionKey = (projectId: string) => `project_versions:${projectId}`;

const projectStats = (project: ProjectData) => {
  const scenes = Object.values(project.scenes || {});
  return {
    sceneCount: scenes.length,
    elementCount: scenes.reduce((sum, scene) => sum + (scene.els?.length || 0), 0),
  };
};

export function createProjectVersion(project: ProjectData, name: string): ProjectVersion {
  const snapshot = JSON.parse(JSON.stringify(project)) as ProjectData;
  return {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `版本 ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    snapshot,
    ...projectStats(snapshot),
  };
}

export function trimProjectVersions(versions: ProjectVersion[]): ProjectVersion[] {
  return versions.slice(0, MAX_PROJECT_VERSIONS);
}

export async function loadProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  try {
    const stored = await aetherDB.getPreference<ProjectVersion[]>(versionKey(projectId), []);
    if (!Array.isArray(stored)) return [];
    return stored.filter((version) => version && version.id && version.snapshot).slice(0, MAX_PROJECT_VERSIONS);
  } catch {
    return [];
  }
}

export async function saveProjectVersions(projectId: string, versions: ProjectVersion[]): Promise<void> {
  await aetherDB.setPreference(versionKey(projectId), trimProjectVersions(versions));
}
