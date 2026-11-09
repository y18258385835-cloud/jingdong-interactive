import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_DATA } from '../src/utils/defaultData';
import { exportProjectZip } from '../src/utils/export';
import { collectProjectAssetReferences } from '../src/core/project/assetReferences';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('export player runtime', () => {
  it('rewrites built asset URLs for a portable development runtime', () => {
    const html = '<script type="module" src="/assets/index.js"></script><link href="/assets/index.css"><link href="/favicon.svg">';
    const relative = html
      .replace(/\b(src|href)="\/(assets\/[^\"]+)"/g, '$1="./$2"')
      .replace(/\b(src|href)="\/favicon\.svg"/g, '$1="./favicon.svg"');

    expect(relative).toContain('src="./assets/index.js"');
    expect(relative).toContain('href="./assets/index.css"');
    expect(relative).toContain('href="./favicon.svg"');
    expect(relative).not.toContain('="/assets/');
  });

  it('packages the built development runtime without Vite source URLs', async () => {
    const runtimeHtml = '<!doctype html><html><head><script src="./assets/aether-player.js"></script><link href="./assets/aether-player.css"><link href="./favicon.svg"></head><body><div id="root"></div></body></html>';
    const runtimeNodes = [
      { getAttribute: () => './assets/aether-player.js' },
      { getAttribute: () => './assets/aether-player.css' },
      { getAttribute: () => './favicon.svg' },
    ];
    class TestDomParser {
      parseFromString() {
        return { querySelectorAll: () => runtimeNodes };
      }
    }
    const files = new Map<string, string>([
      ['http://editor.test/export-player/index.html', runtimeHtml],
      ['http://editor.test/export-player/manifest.json', JSON.stringify({
        'index.html': { file: 'assets/aether-player.js', css: ['assets/aether-player.css'] },
      })],
      ['http://editor.test/export-player/assets/aether-player.js', 'window.AetherExportPlayer = {}'],
      ['http://editor.test/export-player/assets/aether-player.css', '#root{min-height:100vh}'],
      ['http://editor.test/export-player/favicon.svg', '<svg/>'],
    ]);
    vi.stubGlobal('window', { location: { href: 'http://editor.test/', origin: 'http://editor.test' } });
    vi.stubGlobal('document', {
      querySelector: () => ({}),
      documentElement: { outerHTML: '' },
      querySelectorAll: () => [],
    });
    vi.stubGlobal('DOMParser', TestDomParser);
    vi.stubGlobal('fetch', vi.fn(async (input: URL | string) => {
      const url = String(input);
      const body = files.get(url);
      return new Response(body ?? '', {
        status: body === undefined ? 404 : 200,
        headers: { 'content-type': url.endsWith('.svg') ? 'image/svg+xml' : 'text/plain' },
      });
    }));

    const archive = await JSZip.loadAsync(await (await exportProjectZip(DEFAULT_PROJECT_DATA)).arrayBuffer());
    const indexHtml = await archive.file('index.html')!.async('text');
    const packagedProject = JSON.parse(await archive.file('project.json')!.async('text'));
    const packagedReferences = collectProjectAssetReferences(packagedProject);

    expect(indexHtml).toContain('window.__AETHER_EXPORT_PLAYER__=true');
    expect(indexHtml).toContain('src="./assets/aether-player.js"');
    expect(indexHtml).not.toContain('type="module"');
    expect(indexHtml).not.toContain('export-player/');
    expect(indexHtml).not.toContain('/src/');
    expect(Object.keys(archive.files)).toEqual(expect.arrayContaining(['assets/aether-player.js', 'assets/aether-player.css']));
    expect(archive.file('export-player/assets/aether-player.js')).toBeNull();
    expect(Array.from(packagedReferences).every((reference) => reference.startsWith('./assets/'))).toBe(true);
    expect(Array.from(packagedReferences).every((reference) => archive.file(reference.slice(2)) !== null)).toBe(true);
    expect(Object.keys(archive.files).filter((path) => path.startsWith('assets/img/embedded_') && path.endsWith('.svg')).length).toBeGreaterThanOrEqual(5);
    const packagedArtwork = Object.keys(archive.files).filter((path) => path.startsWith('assets/img/embedded_') && path.endsWith('.svg'));
    const packagedArtworkSources = await Promise.all(packagedArtwork.map((path) => archive.file(path)!.async('text')));
    expect(packagedArtworkSources.some((source) => source.includes('SPATIAL SCENE'))).toBe(true);
    const projectEntry = archive.file('project.json') as unknown as { _data: { compression: { magic: string } } };
    const runtimeEntry = archive.file('assets/aether-player.js') as unknown as { _data: { compression: { magic: string } } };
    expect(projectEntry._data.compression.magic).toBe('\x08\x00');
    expect(runtimeEntry._data.compression.magic).toBe('\x08\x00');
  });
});
