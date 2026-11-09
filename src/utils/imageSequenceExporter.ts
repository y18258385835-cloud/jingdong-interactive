import JSZip from 'jszip';
import { withExportTimeout } from './exportAsync';

export type ImageSequenceFormat = 'png' | 'jpg';

export interface ImageSequenceExportOptions {
  frameCount: number;
  fps: number;
  width: number;
  height: number;
  format: ImageSequenceFormat;
  quality?: number;
  projectName: string;
  signal: AbortSignal;
  renderFrame: (frameIndex: number, timeSeconds: number) => Promise<HTMLCanvasElement>;
  onProgress?: (completed: number, total: number, phase: 'frames' | 'package', packagePercent: number) => void;
}

function canvasToFrameBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0) {
        reject(new Error('帧图像编码失败，请降低分辨率后重试'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

function generateArchive(
  zip: JSZip,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  const stream = zip.generateInternalStream({
    type: 'uint8array',
    compression: 'STORE',
    mimeType: 'application/zip',
    streamFiles: true,
  });

  return new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', handleAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => {
      stream.pause();
      finish(() => reject(new DOMException('Export cancelled', 'AbortError')));
    };
    const timer = setTimeout(() => {
      stream.pause();
      finish(() => reject(new Error('图片序列打包超过900秒，已停止导出，请减少帧数或分辨率')));
    }, 15 * 60_000);

    if (signal.aborted) {
      handleAbort();
      return;
    }
    signal.addEventListener('abort', handleAbort, { once: true });
    stream
      .on('data', (chunk, metadata) => {
        if (settled) return;
        chunks.push(chunk);
        onProgress(metadata.percent);
      })
      .on('error', (error) => finish(() => reject(error)))
      .on('end', () => finish(() => resolve(new Blob(chunks, { type: 'application/zip' }))));
    stream.resume();
  });
}

/** Render and package frames one at a time so full-resolution canvases are not retained. */
export async function exportImageSequence(options: ImageSequenceExportOptions): Promise<Blob> {
  if (!Number.isInteger(options.frameCount) || options.frameCount < 1) {
    throw new Error('图片序列没有可导出的帧');
  }
  if (!Number.isFinite(options.fps) || options.fps <= 0) {
    throw new Error('图片序列帧率无效');
  }

  const zip = new JSZip();
  const framesFolder = zip.folder('frames');
  if (!framesFolder) throw new Error('无法创建图片序列压缩包');
  const mimeType = options.format === 'jpg' ? 'image/jpeg' : 'image/png';

  for (let frameIndex = 0; frameIndex < options.frameCount; frameIndex += 1) {
    throwIfAborted(options.signal);
    const canvas = await withExportTimeout(
      options.renderFrame(frameIndex, frameIndex / options.fps),
      90_000,
      `第 ${frameIndex + 1} 帧渲染`,
      options.signal,
    );
    try {
      if (canvas.width !== options.width || canvas.height !== options.height) {
        throw new Error(`第 ${frameIndex + 1} 帧尺寸错误：${canvas.width}×${canvas.height}`);
      }
      const blob = await withExportTimeout(
        canvasToFrameBlob(canvas, mimeType, options.format === 'jpg' ? options.quality : undefined),
        30_000,
        `第 ${frameIndex + 1} 帧编码`,
        options.signal,
      );
      const number = String(frameIndex + 1).padStart(6, '0');
      // Materialize bytes explicitly: JSZip's Blob support is browser-realm
      // dependent, while ArrayBuffer works consistently in tests and browsers.
      framesFolder.file(`frame_${number}.${options.format}`, await blob.arrayBuffer(), { compression: 'STORE' });
    } finally {
      // Release the full-size backing store before the next frame is rendered.
      canvas.width = 1;
      canvas.height = 1;
    }
    options.onProgress?.(frameIndex + 1, options.frameCount, 'frames', 0);
  }

  throwIfAborted(options.signal);
  zip.file('sequence.json', JSON.stringify({
    project: options.projectName,
    format: options.format,
    width: options.width,
    height: options.height,
    fps: options.fps,
    frameCount: options.frameCount,
    durationSeconds: options.frameCount / options.fps,
    framePattern: `frames/frame_%06d.${options.format}`,
  }, null, 2));
  const archive = await generateArchive(zip, options.signal, (percent) => {
    options.onProgress?.(options.frameCount, options.frameCount, 'package', percent);
  });
  if (archive.size === 0) throw new Error('图片序列压缩包为空');
  throwIfAborted(options.signal);
  return archive;
}
