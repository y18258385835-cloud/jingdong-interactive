export const CURRENT_PROJECT_ID_STORAGE_KEY = 'aether_current_project_id';

type ProjectIdStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Restores the active project ID or creates it once and persists it immediately.
 * Without this write, a refresh assigns a new ID and cannot reopen the project
 * that was just saved under the previous in-memory ID.
 */
export function resolveCurrentProjectId(
  storage: ProjectIdStorage,
  createId: () => string,
): string {
  try {
    const existing = storage.getItem(CURRENT_PROJECT_ID_STORAGE_KEY);
    if (existing) return existing;

    const projectId = createId();
    storage.setItem(CURRENT_PROJECT_ID_STORAGE_KEY, projectId);
    return projectId;
  } catch {
    return createId();
  }
}
