import { describe, expect, it } from 'vitest';
import { isExportPlayerMode } from '../src/utils/exportPlayerMode';

describe('export player mode', () => {
  it('recognizes the embedded export-player flag used by file exports', () => {
    expect(isExportPlayerMode('', true)).toBe(true);
  });

  it('retains query-string support for hosted export players', () => {
    expect(isExportPlayerMode('?aether-player=1', false)).toBe(true);
    expect(isExportPlayerMode('', false)).toBe(false);
  });
});
