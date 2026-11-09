import { describe, expect, it } from 'vitest';
import { resolveExportPlayerAssetUrl } from '../src/utils/runtimeAssetUrl';

describe('export player asset URLs', () => {
  it('resolves packaged relative assets against the player document', () => {
    expect(resolveExportPlayerAssetUrl('./assets/audio/bgm.wav', {
      isExportPlayer: true,
      baseUrl: 'http://127.0.0.1:8767/index.html',
    })).toBe('http://127.0.0.1:8767/assets/audio/bgm.wav');
  });

  it('does not reinterpret IndexedDB keys outside export-player mode', () => {
    expect(resolveExportPlayerAssetUrl('asset_123', {
      isExportPlayer: false,
      baseUrl: 'http://localhost:3000/',
    })).toBe('');
  });

  it('keeps external and embedded URLs unchanged in export-player mode', () => {
    expect(resolveExportPlayerAssetUrl('https://cdn.example.com/image.png', {
      isExportPlayer: true,
    })).toBe('https://cdn.example.com/image.png');
    expect(resolveExportPlayerAssetUrl('data:image/png;base64,AA==', {
      isExportPlayer: true,
    })).toBe('data:image/png;base64,AA==');
  });
});
