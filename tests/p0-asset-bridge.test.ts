import { describe, expect, it, vi } from 'vitest';
import { dbManager } from '../src/utils/db';
import { aetherDB, opfs } from '../src/core/db';

describe('legacy asset resolver bridge', () => {
  it('loads an imported asset from OPFS when the legacy store has no key', async () => {
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    const ensureReady = vi.spyOn(dbManager, 'ensureReady').mockResolvedValue(false);
    const getAsset = vi.spyOn(aetherDB, 'getAsset').mockResolvedValue({
      id: 'asset_opfs', projectId: 'project', name: 'image.png', type: 'image',
      mimeType: 'image/png', size: blob.size, hash: 'hash', opfsPath: 'assets/asset_opfs.png',
      createdAt: 0, lastUsedAt: 0, refCount: 1,
    });
    const readFile = vi.spyOn(opfs, 'readFile').mockResolvedValue(blob);
    try {
      await expect(dbManager.get('asset_opfs')).resolves.toBe(blob);
      expect(readFile).toHaveBeenCalledWith('assets/asset_opfs.png');
    } finally {
      ensureReady.mockRestore();
      getAsset.mockRestore();
      readFile.mockRestore();
    }
  });

  it('loads an imported asset from the IndexedDB Blob fallback path', async () => {
    const blob = new Blob(['video-bytes'], { type: 'video/mp4' });
    const ensureReady = vi.spyOn(dbManager, 'ensureReady').mockResolvedValue(false);
    const getAsset = vi.spyOn(aetherDB, 'getAsset').mockResolvedValue({
      id: 'asset_idb', projectId: 'project', name: 'video.mp4', type: 'video',
      mimeType: 'video/mp4', size: blob.size, hash: 'hash', opfsPath: 'idb://asset_idb',
      createdAt: 0, lastUsedAt: 0, refCount: 1,
    });
    const getBlob = vi.spyOn(aetherDB, 'getBlob').mockResolvedValue(blob);
    try {
      await expect(dbManager.get('asset_idb')).resolves.toBe(blob);
      expect(getBlob).toHaveBeenCalledWith('asset_idb');
    } finally {
      ensureReady.mockRestore();
      getAsset.mockRestore();
      getBlob.mockRestore();
    }
  });
});
