import { describe, expect, it } from 'vitest';
import {
  HISTORY_MAX_ENTRIES,
  HISTORY_MAX_SNAPSHOT_CHARS,
  HISTORY_MAX_TOTAL_CHARS,
  canStoreHistorySnapshot,
  trimSnapshotHistory,
} from '../src/core/project/historyBudget';

describe('history memory budget', () => {
  it('rejects a snapshot that would retain an oversized duplicate project copy', () => {
    expect(canStoreHistorySnapshot('x'.repeat(HISTORY_MAX_SNAPSHOT_CHARS))).toBe(true);
    expect(canStoreHistorySnapshot('x'.repeat(HISTORY_MAX_SNAPSHOT_CHARS + 1))).toBe(false);
  });

  it('keeps the newest snapshots within both count and memory budgets', () => {
    const items = Array.from({ length: HISTORY_MAX_ENTRIES + 4 }, (_, index) => ({
      id: index,
      snapshot: 'x'.repeat(800_000),
    }));
    const retained = trimSnapshotHistory(items);
    expect(retained.length).toBeLessThanOrEqual(HISTORY_MAX_ENTRIES);
    expect(retained.reduce((total, item) => total + item.snapshot.length, 0)).toBeLessThanOrEqual(HISTORY_MAX_TOTAL_CHARS);
    expect(retained.at(-1)?.id).toBe(items.at(-1)?.id);
    expect(items).toHaveLength(HISTORY_MAX_ENTRIES + 4);
  });

  it('drops old oversized snapshots before they can be restored from storage', () => {
    const retained = trimSnapshotHistory([
      { id: 'oversized', snapshot: 'x'.repeat(HISTORY_MAX_SNAPSHOT_CHARS + 1) },
      { id: 'current', snapshot: '{}' },
    ]);
    expect(retained.map((item) => item.id)).toEqual(['current']);
  });
});
