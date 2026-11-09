import { describe, expect, it } from 'vitest';
import { getContainPreviewScale } from '../src/core/render/previewScale';

describe('preview scale', () => {
  it('contains a wide component inside the preview viewport', () => {
    expect(getContainPreviewScale({
      contentWidth: 1000,
      contentHeight: 120,
      viewportWidth: 300,
      viewportHeight: 160,
      maxScale: 1,
    })).toBeCloseTo(0.3, 6);
  });

  it('contains a tall component inside the preview viewport', () => {
    expect(getContainPreviewScale({
      contentWidth: 600,
      contentHeight: 640,
      viewportWidth: 300,
      viewportHeight: 160,
      maxScale: 1,
    })).toBeCloseTo(0.25, 6);
  });

  it('respects the configured maximum scale', () => {
    expect(getContainPreviewScale({
      contentWidth: 100,
      contentHeight: 50,
      viewportWidth: 300,
      viewportHeight: 160,
      maxScale: 0.72,
    })).toBe(0.72);
  });
});
