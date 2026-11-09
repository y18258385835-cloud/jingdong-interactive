import type { HistoryActionType, HistoryItem, ProjectData } from '../../types';
import { canStoreHistorySnapshot } from './historyBudget';

const HISTORY_STORAGE_KEY_PREFIX = 'aether_history_v44';

export function getProjectHistoryStorageKey(projectId: string): string {
  return `${HISTORY_STORAGE_KEY_PREFIX}:${encodeURIComponent(projectId)}`;
}

export function createProjectHistoryRoot(
  projectData: ProjectData,
  options: {
    projectId: string;
    title: string;
    details?: string;
    sceneId?: string;
    actionType?: HistoryActionType;
    timestamp?: number;
  },
): HistoryItem[] {
  const snapshot = JSON.stringify(projectData);
  if (!canStoreHistorySnapshot(snapshot)) return [];

  const timestamp = options.timestamp ?? Date.now();
  const date = new Date(timestamp);
  return [{
    id: `hist_${options.projectId}_${timestamp}`,
    timestamp,
    timeStr: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`,
    title: options.title,
    details: options.details,
    actionType: options.actionType ?? 'init',
    sceneId: options.sceneId,
    snapshot,
  }];
}
