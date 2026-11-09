import { describe, expect, it } from 'vitest';
import { CURRENT_PROJECT_ID_STORAGE_KEY, resolveCurrentProjectId } from '../src/core/project/currentProjectId';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as Pick<Storage, 'getItem' | 'setItem'>;
}

describe('resolveCurrentProjectId', () => {
  it('persists a generated ID so the next app load restores the same project', () => {
    const storage = createStorage();
    expect(resolveCurrentProjectId(storage, () => 'proj_first')).toBe('proj_first');
    expect(resolveCurrentProjectId(storage, () => 'proj_second')).toBe('proj_first');
    expect(storage.getItem(CURRENT_PROJECT_ID_STORAGE_KEY)).toBe('proj_first');
  });

  it('uses an existing active project ID without replacing it', () => {
    const storage = createStorage({ [CURRENT_PROJECT_ID_STORAGE_KEY]: 'proj_saved' });
    expect(resolveCurrentProjectId(storage, () => 'proj_new')).toBe('proj_saved');
  });

  it('still creates an ID when browser storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => { throw new Error('storage unavailable'); },
    } as Pick<Storage, 'getItem' | 'setItem'>;
    expect(resolveCurrentProjectId(storage, () => 'proj_memory')).toBe('proj_memory');
  });
});
