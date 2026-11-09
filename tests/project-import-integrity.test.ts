import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { projectImporter } from '../src/core/project/importer';

const buildProject = (ref: string) => ({
  meta: { v: 1 },
  start: 'main',
  scenes: {
    main: {
      id: 'main', alias: 'Main', type: 'scene', duration: 5, els: [{
        id: 'image', type: 'img', refId: ref,
        x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
      }],
    },
  },
});

async function createArchive(project: unknown, assets: Array<{ id: string; path: string; data: Uint8Array }>, manifestOverrides: Record<string, unknown> = {}) {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project));
  const manifestAssets = await Promise.all(assets.map(async (asset) => {
    zip.file(asset.path, asset.data);
    const hash = await crypto.subtle.digest('SHA-256', asset.data);
    return {
      id: asset.id,
      path: asset.path,
      name: asset.path.split('/').pop() || 'asset.bin',
      type: 'image',
      size: asset.data.byteLength,
      hash: Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join(''),
    };
  }));
  zip.file('manifest.json', JSON.stringify({
    formatVersion: '1.0.0', appVersion: '1.0.0', exportedAt: 0,
    projectId: 'test', projectName: 'Test', assetCount: manifestAssets.length,
    totalSize: manifestAssets.reduce((total, asset) => total + asset.size, 0), assets: manifestAssets, checksum: '',
    ...manifestOverrides,
  }));
  // JSZip in the Node test runner consumes Uint8Array directly, whereas the
  // browser production path supplies a native File with the same bytes.
  return Object.assign(await zip.generateAsync({ type: 'uint8array' }), {
    name: 'test.zip',
    type: 'application/zip',
  }) as unknown as File;
}

describe('project import integrity validation', () => {
  it('rejects a ZIP whose local project reference is not present in its manifest', async () => {
    const file = await createArchive(buildProject('./assets/img/missing.png'), []);
    const result = await projectImporter.validateProjectFile(file);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('素材引用未映射到清单: ./assets/img/missing.png');
  });

  it('accepts a ZIP only when its reference, file size and SHA-256 agree', async () => {
    const ref = './assets/img/valid.png';
    const file = await createArchive(buildProject(ref), [{
      id: ref,
      path: 'assets/img/valid.png',
      data: new Uint8Array([137, 80, 78, 71]),
    }]);

    await expect(projectImporter.validateProjectFile(file)).resolves.toMatchObject({ valid: true, errors: [] });
  });

  it('rejects an inconsistent manifest before importing any material', async () => {
    const ref = './assets/img/valid.png';
    const file = await createArchive(buildProject(ref), [{
      id: ref,
      path: 'assets/img/valid.png',
      data: new Uint8Array([137, 80, 78, 71]),
    }], { assetCount: 2 });

    await expect(projectImporter.importProject(file)).rejects.toThrow('素材数量声明');
  });
});
