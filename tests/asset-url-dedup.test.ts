import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbManager } from '../src/utils/db';

describe('asset URL loading', () => {
  afterEach(() => vi.restoreAllMocks());

  it('deduplicates concurrent reads and object URL creation for one asset', async () => {
    const blob = new Blob(['video-bytes'], { type: 'video/mp4' });
    const get = vi.spyOn(dbManager, 'get').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return blob;
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:aether-dedup');

    const [first, second, third] = await Promise.all([
      dbManager.loadUrl('asset-video'),
      dbManager.loadUrl('asset-video'),
      dbManager.loadUrl('asset-video'),
    ]);

    expect(first).toBe('blob:aether-dedup');
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(get).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does not publish a URL after the asset is deleted during an in-flight read', async () => {
    const blob = new Blob(['late-video-bytes'], { type: 'video/mp4' });
    let releaseRead!: () => void;
    let readStarted!: () => void;
    const readStartedPromise = new Promise<void>((resolve) => { readStarted = resolve; });
    const get = vi.spyOn(dbManager, 'get').mockImplementation(async () => {
      readStarted();
      await new Promise<void>((resolve) => { releaseRead = resolve; });
      return blob;
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stale');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const pending = dbManager.loadUrl('asset-deleted-during-read');
    await readStartedPromise;
    await dbManager.delete('asset-deleted-during-read');
    releaseRead();

    await expect(pending).resolves.toBe('asset-deleted-during-read');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stale');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('returns valid object URL when loading an asset stored in IndexedDB without self-invalidation', async () => {
    const blob = new Blob(['sample-image-bytes'], { type: 'image/png' });
    const mockDB = {
      transaction: () => ({
        objectStore: () => ({
          get: () => {
            const req: any = {};
            setTimeout(() => {
              req.result = blob;
              req.onsuccess();
            }, 5);
            return req;
          },
        }),
      }),
    } as any;
    // @ts-ignore
    dbManager.db = mockDB;
    // @ts-ignore
    dbManager.blobs.clear();
    // @ts-ignore
    dbManager.cache.clear();
    // @ts-ignore
    dbManager.loadVersions.clear();

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:second-open-success');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');

    const result = await dbManager.loadUrl('asset_photo_123');
    expect(result).toBe('blob:second-open-success');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(dbManager.getCachedUrl('asset_photo_123')).toBe('blob:second-open-success');
    expect(dbManager.getBlob('asset_photo_123')).toBeDefined();
  });
});
