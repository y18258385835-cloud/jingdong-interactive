import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { projectExporter } from '../src/core/project/exporter';
import { aetherDB } from '../src/core/db';
import { assetLoader } from '../src/core/assets';

describe('project exporter shared asset coverage', () => {
  it('packs a referenced asset even when deduplication assigned it to another project', async () => {
    const project = {
      id: 'project_current', name: 'Current project', createdAt: 0, updatedAt: 0, version: '1.0.0', assetIds: ['asset_owned'],
      data: {
        start: 'main',
        scenes: {
          main: {
            id: 'main', type: 'scene', duration: 5, els: [{
              id: 'image', type: 'img', refId: 'asset_shared', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
            }],
          },
        },
      },
    } as any;
    const ownedAsset = { id: 'asset_owned', projectId: 'project_current', name: 'owned.png', type: 'image', mimeType: 'image/png', size: 1, hash: 'owned', opfsPath: 'assets/owned.png', createdAt: 0, lastUsedAt: 0, refCount: 1 } as any;
    const sharedAsset = { id: 'asset_shared', projectId: 'project_previous', name: 'shared.mp4', type: 'video', mimeType: 'video/mp4', size: 1, hash: 'shared', opfsPath: 'assets/shared.mp4', createdAt: 0, lastUsedAt: 0, refCount: 2 } as any;
    const getProject = vi.spyOn(aetherDB, 'getProject').mockResolvedValue(project);
    const getAssetsByProject = vi.spyOn(aetherDB, 'getAssetsByProject').mockResolvedValue([ownedAsset]);
    const getAsset = vi.spyOn(aetherDB, 'getAsset').mockImplementation(async (id) => id === 'asset_shared' ? sharedAsset : undefined);
    const binary = Object.assign(new Uint8Array([0, 1, 2]), { type: 'video/mp4' });
    const loadAssetAsBlob = vi.spyOn(assetLoader, 'loadAssetAsBlob').mockResolvedValue(binary as unknown as Blob);
    try {
      const archive = await JSZip.loadAsync(await (await projectExporter.exportProject('project_current')).arrayBuffer());
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as { assets: Array<{ id: string }> };

      expect(manifest.assets.map((asset) => asset.id)).toContain('asset_shared');
      expect(archive.file('assets/asset_shared.mp4')).toBeTruthy();
    } finally {
      getProject.mockRestore();
      getAssetsByProject.mockRestore();
      getAsset.mockRestore();
      loadAssetAsBlob.mockRestore();
    }
  });
});
