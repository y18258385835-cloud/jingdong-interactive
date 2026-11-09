import { describe, expect, it } from 'vitest';
import { sanitizeExportData } from '../src/core/realtime/sanitizeExportData';
import { exportProjectZip, generateStandaloneHTML } from '../src/utils/export';
import type { ProjectData } from '../src/types';

const projectWithSecrets = {
  meta: { v: 1, title: 'Export test' },
  start: 'home',
  scenes: {
    home: {
      id: 'home', alias: 'Home', type: 'scene', duration: 1, cruiseDuration: 1,
      bgColor: '#000000', bgRef: '', bgmRef: '', inPoint: 0, outPoint: 1,
      transitionIn: 'none', transitionOut: 'none', transitionDuration: 0, els: [
        {
          id: 'binding', type: 'ui', refId: '', x: 0, y: 0, w: 10, h: 10,
          zIndex: 1, opacity: 100, startTime: 0, duration: 1,
          uiComponentData: { endpoint: 'http://10.0.0.5:8080', token: 'export-token-should-not-appear', sourceId: 'keep-source' },
        },
      ],
    },
  },
} as unknown as ProjectData;

describe('sanitizeExportData', () => {
  it('removes credentials and private connection details from exported projects', () => {
    const input = {
      name: '生产看板',
      sourceId: 'factory-line-a',
      mapping: { throughput: 'metrics.throughput' },
      secretRef: 'vault/realtime-token',
      dataBinding: {
        endpoint: 'https://telemetry.example.com/api/snapshot',
        internalUrl: 'http://192.168.1.20:8080/api',
        token: 'token-must-not-export',
        password: 'password-must-not-export',
        apiKey: 'api-key-must-not-export',
        broker: 'mqtt://10.0.0.8:1883',
        headers: { Authorization: 'Bearer private-token' },
      },
      metadata: [{ sourceId: 'keep-this-id', value: 42 }],
    };

    const output = sanitizeExportData(input);
    const serialized = JSON.stringify(output);

    expect(serialized).not.toContain('token-must-not-export');
    expect(serialized).not.toContain('password-must-not-export');
    expect(serialized).not.toContain('api-key-must-not-export');
    expect(serialized).not.toContain('192.168.1.20');
    expect(serialized).not.toContain('10.0.0.8');
    expect(output.sourceId).toBe('factory-line-a');
    expect(output.mapping).toEqual({ throughput: 'metrics.throughput' });
    expect(output.secretRef).toBe('vault/realtime-token');
    expect(output.metadata).toEqual([{ sourceId: 'keep-this-id', value: 42 }]);
  });

  it('keeps public URLs while removing internal URLs', () => {
    const output = sanitizeExportData({ publicDocs: 'https://docs.example.com/realtime', localDocs: 'http://localhost:3000/docs' });
    expect(output).toEqual({ publicDocs: 'https://docs.example.com/realtime' });
  });

  it('removes review comments from exported payloads', () => {
    const output = sanitizeExportData({
      ...projectWithSecrets,
      comments: [{ id: 'comment_1', sceneId: 'home', x: 10, y: 10, text: '客户内部意见', createdAt: 1 }],
    });
    expect(output.comments).toBeUndefined();
    expect(JSON.stringify(output)).not.toContain('客户内部意见');
  });

  it('sanitizes the generated HTML and ZIP artifacts', async () => {
    const html = generateStandaloneHTML(projectWithSecrets);
    expect(html).not.toContain('export-token-should-not-appear');
    expect(html).not.toContain('10.0.0.5');

    const zip = await exportProjectZip(projectWithSecrets, undefined, { runtime: 'standalone' });
    const archive = await (await import('jszip')).default.loadAsync(await zip.arrayBuffer());
    const exportedProject = await archive.file('project.json')?.async('string');
    const exportedHtml = await archive.file('index.html')?.async('string');
    expect(exportedProject).toBeDefined();
    expect(exportedHtml).toBeDefined();
    expect(`${exportedProject}\n${exportedHtml}`).not.toContain('export-token-should-not-appear');
    expect(`${exportedProject}\n${exportedHtml}`).not.toContain('10.0.0.5');
    expect(exportedProject).toContain('keep-source');
  });

  it('embeds the signed export proof in HTML and ZIP artifacts', async () => {
    const proof = {
      version: 1 as const,
      exportId: 'exp_test-export-id',
      licenseRef: 'test-license-reference',
      issuedAt: 1_700_000_000_000,
      format: 'zip',
      signature: 'a'.repeat(64),
    };
    const html = generateStandaloneHTML(projectWithSecrets, { exportProof: proof });
    expect(html).toContain('aether-export-proof');
    expect(html).toContain(proof.exportId);

    const zip = await exportProjectZip(projectWithSecrets, undefined, { runtime: 'standalone', exportProof: proof });
    const archive = await (await import('jszip')).default.loadAsync(await zip.arrayBuffer());
    const receipt = await archive.file('aether-export-proof.json')?.async('string');
    expect(receipt).toBe(JSON.stringify(proof));
  });

  it('uses the standalone runtime without a Three.js CDN dependency', () => {
    const html = generateStandaloneHTML(projectWithSecrets);
    expect(html).not.toContain('cdn.jsdelivr.net/npm/three');
    expect(html).not.toContain('GLTFLoader.js');
  });
});
