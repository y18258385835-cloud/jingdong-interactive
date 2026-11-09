import { describe, expect, it, vi, afterEach } from 'vitest';
import { compareVersions, checkForUpdate } from '../src/core/update/updateService';

describe('版本比较', () => {
  it('按语义化版本比较', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
    expect(compareVersions('v1.2', '1.1.9')).toBe(1);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
  });
});

describe('检查更新', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('服务端有更新版本时返回信息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      version: '1.1.0',
      url: 'https://example.com/download',
      notes: '修复若干问题',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const info = await checkForUpdate('1.0.0', { force: true });
    expect(info).toMatchObject({ version: '1.1.0', url: 'https://example.com/download' });
  });

  it('版本相同时返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: '1.0.0' }), { status: 200 })));
    expect(await checkForUpdate('1.0.0', { force: true })).toBeNull();
  });

  it('网络失败时静默返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await checkForUpdate('1.0.0', { force: true })).toBeNull();
  });
});
