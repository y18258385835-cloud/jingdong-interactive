import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { exportImageSequence } from '../src/utils/imageSequenceExporter';

function createCanvas(width: number, height: number, frameData: string): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    toBlob: (callback: BlobCallback, type?: string) => callback(new Blob([frameData], { type })),
  } as unknown as HTMLCanvasElement;
  return canvas;
}

describe('image sequence export', () => {
  it('packages numbered PNG frames and timing metadata into a ZIP', async () => {
    const signal = new AbortController().signal;
    const renderFrame = vi.fn(async (index: number) => createCanvas(320, 180, `png-${index}`));
    const blob = await exportImageSequence({
      frameCount: 3,
      fps: 24,
      width: 320,
      height: 180,
      format: 'png',
      projectName: 'Fixture',
      signal,
      renderFrame,
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).filter((name) => name.startsWith('frames/')).sort()).toEqual([
      'frames/',
      'frames/frame_000001.png',
      'frames/frame_000002.png',
      'frames/frame_000003.png',
    ]);
    expect(await zip.file('frames/frame_000002.png')!.async('text')).toBe('png-1');
    expect(JSON.parse(await zip.file('sequence.json')!.async('text'))).toMatchObject({
      fps: 24,
      frameCount: 3,
      durationSeconds: 0.125,
      framePattern: 'frames/frame_%06d.png',
    });
    expect(renderFrame).toHaveBeenCalledTimes(3);
  });

  it('encodes JPEG frames with the selected quality and releases each canvas', async () => {
    const signal = new AbortController().signal;
    const canvas = createCanvas(64, 64, 'jpeg');
    const toBlob = vi.spyOn(canvas, 'toBlob');
    const blob = await exportImageSequence({
      frameCount: 1,
      fps: 30,
      width: 64,
      height: 64,
      format: 'jpg',
      quality: 0.7,
      projectName: 'Fixture',
      signal,
      renderFrame: async () => canvas,
    });

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.7);
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('stops before rendering more frames after cancellation', async () => {
    const controller = new AbortController();
    const renderFrame = vi.fn(async () => {
      controller.abort();
      return createCanvas(10, 10, 'frame');
    });

    await expect(exportImageSequence({
      frameCount: 4,
      fps: 24,
      width: 10,
      height: 10,
      format: 'png',
      projectName: 'Fixture',
      signal: controller.signal,
      renderFrame,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(renderFrame).toHaveBeenCalledTimes(1);
  });

  it('stops ZIP generation when cancelled during packaging', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn((_completed, _total, phase) => {
      if (phase === 'package') controller.abort();
    });

    await expect(exportImageSequence({
      frameCount: 1,
      fps: 24,
      width: 10,
      height: 10,
      format: 'png',
      projectName: 'Fixture',
      signal: controller.signal,
      renderFrame: async () => createCanvas(10, 10, 'frame-data'.repeat(1000)),
      onProgress,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(onProgress).toHaveBeenCalledWith(1, 1, 'package', expect.any(Number));
  });
});
