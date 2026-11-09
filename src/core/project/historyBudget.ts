export interface SnapshotHistoryItem {
  snapshot: string;
}

export const HISTORY_MAX_ENTRIES = 20;
// Projects may legitimately contain embedded custom-code/media metadata well
// above 2 MB. A hard 2 MB cutoff silently discarded every edit from the undo
// stack, which made keyframe edits impossible to undo in real projects.
export const HISTORY_MAX_SNAPSHOT_CHARS = 12_000_000;
export const HISTORY_MAX_TOTAL_CHARS = 48_000_000;

export function canStoreHistorySnapshot(snapshot: string): boolean {
  return snapshot.length <= HISTORY_MAX_SNAPSHOT_CHARS;
}

/**
 * Keeps undo data bounded. Project data itself remains in IndexedDB; only
 * duplicate JSON snapshots used for undo are discarded.
 */
export function trimSnapshotHistory<T extends SnapshotHistoryItem>(items: readonly T[]): T[] {
  const retained = items.filter((item) => canStoreHistorySnapshot(item.snapshot));
  let totalChars = retained.reduce((total, item) => total + item.snapshot.length, 0);

  while (retained.length > HISTORY_MAX_ENTRIES || totalChars > HISTORY_MAX_TOTAL_CHARS) {
    const removed = retained.shift();
    if (!removed) break;
    totalChars -= removed.snapshot.length;
  }

  return retained;
}
