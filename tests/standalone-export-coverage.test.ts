import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { ProjectData } from '../src/types';
import { exportProjectZip, exportSingleFileHTML, generateStandaloneHTML, getStandaloneExportCompatibilityIssues } from '../src/utils/export';

const nestedAssetProject = {
  meta: { v: 1 },
  start: 'main',
  scenes: {
    main: {
      id: 'main', alias: 'Main', type: 'scene', duration: 5, inPoint: 0, outPoint: 5, els: [{
        id: 'group', type: 'group', refId: '', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
        children: [{ id: 'nested-image', type: 'img', refId: 'nested-image-ref', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5 }],
      }],
    },
  },
} as unknown as ProjectData;

describe('standalone export coverage', () => {
  it('embeds single-file video assets with a video MIME even when stored metadata is stale', async () => {
    const videoProject = structuredClone(nestedAssetProject);
    videoProject.scenes.main.els = [{
      id: 'video', type: 'vid', refId: 'legacy-video.png',
      x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
    }] as any;
    const mp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    ]);
    const staleBlob = Object.assign(mp4Header, { type: 'image/png' });
    const { dbManager } = await import('../src/utils/db');
    const getAsset = vi.spyOn(dbManager, 'get').mockResolvedValue(staleBlob as unknown as Blob);
    const runtimeHtml = '<link rel="stylesheet" href="./assets/aether-player.css"><script src="./assets/aether-player.js"></script>';
    class TestDomParser {
      parseFromString() {
        return { querySelector: (selector: string) => selector === 'script[src]'
          ? { getAttribute: () => './assets/aether-player.js' }
          : { getAttribute: () => './assets/aether-player.css' } };
      }
    }
    class TestFileReader {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      readAsDataURL(blob: Blob) {
        void blob.arrayBuffer().then((buffer) => {
          let binary = '';
          new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte); });
          this.result = `data:${blob.type};base64,${btoa(binary)}`;
          this.onloadend?.();
        });
      }
    }
    vi.stubGlobal('window', { location: { href: 'http://editor.test/' } });
    vi.stubGlobal('DOMParser', TestDomParser);
    vi.stubGlobal('FileReader', TestFileReader);
    vi.stubGlobal('fetch', vi.fn(async (input: URL | string) => {
      const url = String(input);
      const body = url.endsWith('index.html') ? runtimeHtml
        : url.endsWith('aether-player.js') ? 'window.sharedPlayerRuntime=true;'
          : 'body{background:#000}';
      return new Response(body, { status: 200 });
    }));

    try {
      const html = await exportSingleFileHTML(videoProject);
      expect(html).toContain('"refId":"data:video/mp4;base64,');
      expect(html).not.toContain('data:image/png;base64,');
    } finally {
      getAsset.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('packs and rewrites an asset referenced only by a nested group layer', async () => {
    // JSZip's Node runtime accepts Uint8Array, while the browser receives a Blob.
    const binary = Object.assign(new Uint8Array([137, 80, 78, 71]), { type: 'image/png' });
    const { dbManager } = await import('../src/utils/db');
    const getAsset = vi.spyOn(dbManager, 'get').mockResolvedValue(binary as unknown as Blob);
    try {
      const archive = await JSZip.loadAsync(await (await exportProjectZip(nestedAssetProject, undefined, { runtime: 'standalone' })).arrayBuffer());
      const project = JSON.parse(await archive.file('project.json')!.async('text')) as ProjectData;
      const refId = project.scenes.main.els[0].children?.[0].refId;
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as { assets: Array<{ id: string; path: string }> };

      expect(refId).toMatch(/^\.\/assets\/img\/nested-image-ref\.png$/);
      expect(archive.file('assets/img/nested-image-ref.png')).toBeTruthy();
      expect(manifest.assets).toContainEqual(expect.objectContaining({
        id: refId,
        path: 'assets/img/nested-image-ref.png',
      }));
    } finally {
      getAsset.mockRestore();
    }
  });

  it('materializes inline image data as a ZIP asset instead of bloating the player HTML', async () => {
    const inlineProject = structuredClone(nestedAssetProject);
    inlineProject.scenes.main.els = [{
      id: 'inline-image', type: 'img',
      refId: 'data:image/png;base64,iVBORw0KGgo=',
      x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
    }];

    const archive = await JSZip.loadAsync(await (await exportProjectZip(inlineProject, undefined, { runtime: 'standalone' })).arrayBuffer());
    const project = JSON.parse(await archive.file('project.json')!.async('text')) as ProjectData;
    const refId = project.scenes.main.els[0].refId;

    expect(refId).toBe('./assets/img/embedded_1.png');
    expect(archive.file('assets/img/embedded_1.png')).toBeTruthy();
    expect(await archive.file('project.json')!.async('text')).not.toContain('data:image/png;base64');
  });

  it('packs deep interaction and component-preset asset references for re-import', async () => {
    const project = structuredClone(nestedAssetProject) as any;
    project.scenes.main.els = [{
      id: 'interactive', type: 'text', refId: '', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
      textHotspots: [{ id: 'hotspot', textKey: 'label', start: 0, end: 1, interaction: { action: 'media', mediaRefId: 'deep-text-media' } }],
      uiComponentData: { continuousInteraction: { nodes: [{ id: 'node', position: 50, role: 'checkpoint', interaction: { action: 'media', mediaRefId: 'deep-node-media' } }] } },
    }];
    project.components = [{ id: 'preset', name: 'Preset', createdAt: 0, elements: [{
      id: 'preset-image', type: 'img', refId: 'preset-media', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
    }] }];
    const binary = Object.assign(new Uint8Array([137, 80, 78, 71]), { type: 'image/png' });
    const { dbManager } = await import('../src/utils/db');
    const getAsset = vi.spyOn(dbManager, 'get').mockResolvedValue(binary as unknown as Blob);
    try {
      const archive = await JSZip.loadAsync(await (await exportProjectZip(project, undefined, { runtime: 'standalone' })).arrayBuffer());
      const exported = JSON.parse(await archive.file('project.json')!.async('text')) as any;
      const refs = [
        exported.scenes.main.els[0].textHotspots[0].interaction.mediaRefId,
        exported.scenes.main.els[0].uiComponentData.continuousInteraction.nodes[0].interaction.mediaRefId,
        exported.components[0].elements[0].refId,
      ];
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as { assets: Array<{ id: string; path: string }> };

      expect(refs).toEqual([
        './assets/img/deep-text-media.png',
        './assets/img/deep-node-media.png',
        './assets/img/preset-media.png',
      ]);
      for (const ref of refs) {
        expect(manifest.assets).toContainEqual(expect.objectContaining({ id: ref, path: ref.slice(2) }));
        expect(archive.file(ref.slice(2))).toBeTruthy();
      }
    } finally {
      getAsset.mockRestore();
    }
  });

  it('gives same-named assets distinct ZIP paths so re-import cannot overwrite either one', async () => {
    const project = structuredClone(nestedAssetProject) as any;
    project.scenes.main.els = [
      { id: 'first', type: 'img', refId: 'folder-a/shared', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5 },
      { id: 'second', type: 'img', refId: 'folder-b/shared', x: 0, y: 0, w: 100, h: 100, zIndex: 2, opacity: 100, startTime: 0, duration: 5 },
    ];
    const binary = Object.assign(new Uint8Array([137, 80, 78, 71]), { type: 'image/png' });
    const { dbManager } = await import('../src/utils/db');
    const getAsset = vi.spyOn(dbManager, 'get').mockResolvedValue(binary as unknown as Blob);
    try {
      const archive = await JSZip.loadAsync(await (await exportProjectZip(project, undefined, { runtime: 'standalone' })).arrayBuffer());
      const exported = JSON.parse(await archive.file('project.json')!.async('text')) as any;

      expect(exported.scenes.main.els.map((element: any) => element.refId)).toEqual([
        './assets/img/shared.png',
        './assets/img/shared_2.png',
      ]);
      expect(archive.file('assets/img/shared.png')).toBeTruthy();
      expect(archive.file('assets/img/shared_2.png')).toBeTruthy();
    } finally {
      getAsset.mockRestore();
    }
  });

  it('fails instead of exporting a ZIP that still depends on an unavailable remote asset', async () => {
    const project = structuredClone(nestedAssetProject) as any;
    project.scenes.main.els = [{
      id: 'remote-image', type: 'img', refId: 'https://assets.example.com/missing.png', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
    }];
    const fetchAsset = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    try {
      await expect(exportProjectZip(project, undefined, { runtime: 'standalone' })).rejects.toThrow();
    } finally {
      fetchAsset.mockRestore();
    }
  });

  it('allows editor layers handled by the shared player runtime', () => {
    const issues = getStandaloneExportCompatibilityIssues(nestedAssetProject);
    expect(issues).toEqual([]);
  });

  it('embeds the shared player runtime and sanitized project in single-file HTML', async () => {
    const project = structuredClone(nestedAssetProject) as any;
    project.scenes.main.els = [{ id: 'group', type: 'group', refId: '', children: [] }];
    const runtimeHtml = '<link rel="stylesheet" href="./assets/aether-player.css"><script src="./assets/aether-player.js"></script>';
    class TestDomParser {
      parseFromString() {
        return { querySelector: (selector: string) => selector === 'script[src]'
          ? { getAttribute: () => './assets/aether-player.js' }
          : { getAttribute: () => './assets/aether-player.css' } };
      }
    }
    vi.stubGlobal('window', { location: { href: 'http://editor.test/' } });
    vi.stubGlobal('DOMParser', TestDomParser);
    vi.stubGlobal('fetch', vi.fn(async (input: URL | string) => {
      const url = String(input);
      const body = url.endsWith('index.html') ? runtimeHtml
        : url.endsWith('aether-player.js') ? 'window.sharedPlayerRuntime=true; new Worker(new URL("/assets/projectSummary.worker-test.js", import.meta.url), {type:"module"});'
          : url.endsWith('projectSummary.worker-test.js') ? 'self.onmessage=()=>self.postMessage("ready");'
          : 'body{background:#000}';
      return new Response(body, { status: 200 });
    }));

    const html = await exportSingleFileHTML(project, undefined, { autoPlay: false });
    expect(html).toContain('window.__AETHER_EXPORT_PLAYER__=true');
    expect(html).toContain('window.__AETHER_EXPORT_AUTOPLAY__=false');
    expect(html).toContain('window.sharedPlayerRuntime=true');
    expect(html).toContain('URL.createObjectURL(new Blob');
    expect(html).toContain(encodeURIComponent('self.onmessage=()=>self.postMessage("ready");'));
    expect(html).toContain('body{background:#000}');
    expect(html).toContain('"type":"group"');
    expect(html).not.toContain('src="./assets/');
    vi.unstubAllGlobals();
  });

  it('keeps standalone image and video fitting consistent with the editor', () => {
    const project = structuredClone(nestedAssetProject);
    project.scenes.main.els = [];
    const html = generateStandaloneHTML(project);

    expect(html).toContain('.element img, .element video { width: 100%; height: 100%; object-fit: contain;');
    expect(html).not.toContain('.element img, .element video { width: 100%; height: 100%; object-fit: fill;');
  });
});
