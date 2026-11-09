import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { exportProjectZip } from '../src/utils/export';
import { inferMimeTypeFromFileName, withResolvedMediaMimeType } from '../src/core/assets/mime';

const MP4_HEADER = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
]);

describe('asset MIME round-trip', () => {
  it('treats M4V uploads as MP4 video sources', () => {
    expect(inferMimeTypeFromFileName('FormatFactory-final.m4v')).toBe('video/mp4');
  });

  it('restores a media MIME from bytes when a ZIP entry lost it', async () => {
    const restored = await withResolvedMediaMimeType(
      new Blob([MP4_HEADER], { type: 'application/octet-stream' }),
      'image/png',
    );

    expect(restored.type).toBe('video/mp4');
    expect(restored.size).toBe(MP4_HEADER.byteLength);
  });

  it('creates an editor playback URL with the detected MIME for a cached historical video', async () => {
    const { dbManager } = await import('../src/utils/db');
    const createUrl = vi.spyOn(URL, 'createObjectURL');
    const key = `legacy-video-${Date.now()}.png`;
    const mislabeledBlob = new Blob([MP4_HEADER], { type: 'image/png' });

    try {
      dbManager.register(key, mislabeledBlob);
      await dbManager.loadUrl(key);

      const finalBlob = createUrl.mock.calls.at(-1)?.[0] as Blob | undefined;
      expect(finalBlob?.type).toBe('video/mp4');
    } finally {
      createUrl.mockRestore();
    }
  });

  it('re-exports a historical mislabelled MP4 as a video asset', async () => {
    const project = {
      start: 'main',
      scenes: {
        main: {
          id: 'main', type: 'scene', duration: 5, els: [{
            id: 'video', type: 'vid', refId: 'legacy-wrong-extension.png',
            x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
          }],
        },
      },
    } as any;
    const staleBlob = Object.assign(MP4_HEADER, { type: 'image/png' });
    const { dbManager } = await import('../src/utils/db');
    const getAsset = vi.spyOn(dbManager, 'get').mockResolvedValue(staleBlob as unknown as Blob);

    try {
      const archive = await JSZip.loadAsync(await (await exportProjectZip(project, undefined, { runtime: 'standalone' })).arrayBuffer());
      const exported = JSON.parse(await archive.file('project.json')!.async('text')) as any;
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as { assets: Array<{ path: string; mimeType?: string; type: string }> };

      expect(exported.scenes.main.els[0].refId).toBe('./assets/video/legacy-wrong-extension.mp4');
      expect(archive.file('assets/video/legacy-wrong-extension.mp4')).toBeTruthy();
      expect(manifest.assets).toContainEqual(expect.objectContaining({
        path: 'assets/video/legacy-wrong-extension.mp4', mimeType: 'video/mp4', type: 'video',
      }));
    } finally {
      getAsset.mockRestore();
    }
  });
});
