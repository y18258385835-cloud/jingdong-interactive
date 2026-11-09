import { describe, expect, it } from 'vitest';
import { advancedVideoExportCapabilities, createExportFrameError } from '../src/core/export/advancedVideoCapabilities';

describe('advanced video export capabilities', () => {
  it('advertises scene BGM after the export mixer is available', () => {
    expect(advancedVideoExportCapabilities.includesAudio).toBe(true);
    expect(advancedVideoExportCapabilities.audioStatusLabel).toBeTruthy();
    expect(advancedVideoExportCapabilities.audioStatusDescription).toBeTruthy();
  });

  it('turns a failed capture into an explicit export-stopping error', () => {
    const error = createExportFrameError(4, 120, new Error('video frame unavailable'));
    expect(error.message).toContain('5/120');
    expect(error.message).toContain('已中止导出');
    expect(error.message).toContain('video frame unavailable');
  });
});
