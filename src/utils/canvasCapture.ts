/**
 * 画布截图工具
 * 基于 html2canvas 实现画布区域的高质量截图
 * 支持图片导出和视频逐帧导出
 */

import html2canvas from 'html2canvas-pro';
import { waitForExportFrame, withExportTimeout } from './exportAsync';

export interface CaptureOptions {
  /** 截图宽度（像素），不填则使用元素实际宽度 */
  width?: number;
  /** 截图高度（像素），不填则使用元素实际高度 */
  height?: number;
  /** 缩放比例，默认2倍（高清） */
  scale?: number;
  /** 背景色，默认透明 */
  backgroundColor?: string | null;
  /** 是否使用CSS缩放，默认true */
  useCORS?: boolean;
  /** 允许跨域图片 */
  allowTaint?: boolean;
  /** 日志 */
  logging?: boolean;
  /** Keep the source document stable; export-only elements are hidden in the clone. */
  mutateSource?: boolean;
  /** Let the browser paint modern CSS functions that html2canvas cannot parse. */
  foreignObjectRendering?: boolean;
  /** PNG serialization is unnecessary for video frames and is expensive at HD resolutions. */
  includeDataUrl?: boolean;
  /** Cancels an in-progress DOM render. */
  signal?: AbortSignal;
}

export interface CaptureResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ExportReadinessOptions {
  timeoutMs?: number;
  waitForVideoFrames?: boolean;
  signal?: AbortSignal;
}

function waitForEventOrTimeout(
  target: EventTarget,
  successEvents: string[],
  failureEvents: string[],
  timeoutMs: number,
  label: string,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      successEvents.forEach((eventName) => target.removeEventListener(eventName, handleSuccess));
      failureEvents.forEach((eventName) => target.removeEventListener(eventName, handleFailure));
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleSuccess = () => finish(resolve);
    const handleFailure = () => finish(() => reject(new Error(`${label}加载失败`)));
    const handleAbort = () => finish(() => reject(new DOMException('Export cancelled', 'AbortError')));
    const timer = window.setTimeout(
      () => finish(() => reject(new Error(`${label}在 ${timeoutMs}ms 内未就绪`))),
      timeoutMs,
    );
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    successEvents.forEach((eventName) => target.addEventListener(eventName, handleSuccess, { once: true }));
    failureEvents.forEach((eventName) => target.addEventListener(eventName, handleFailure, { once: true }));
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

/** Wait until every visible raster source can provide a real export frame. */
export async function waitForExportReadiness(
  element: HTMLElement,
  options: ExportReadinessOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const fontSet = document.fonts;
  if (fontSet?.status !== 'loaded') {
    await Promise.race([
      fontSet.ready.then(() => undefined),
      new Promise<never>((_resolve, reject) => window.setTimeout(
        () => reject(new Error(`字体在 ${timeoutMs}ms 内未加载完成`)),
        timeoutMs,
      )),
    ]);
  }

  const images = Array.from(element.querySelectorAll<HTMLImageElement>('img'))
    .filter((image) => image.getClientRects().length > 0 && Boolean(image.currentSrc || image.src));
  await Promise.all(images.map(async (image, index) => {
    if (!image.complete) {
      await waitForEventOrTimeout(image, ['load'], ['error'], timeoutMs, `图片 ${index + 1}`, options.signal);
    }
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error(`图片 ${index + 1}无法解码`);
    }
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(`图片 ${index + 1}无法验证画面，请检查浏览器支持`);
    try {
      context.drawImage(image, 0, 0, 1, 1);
      context.getImageData(0, 0, 1, 1);
    } catch {
      throw new Error(`图片 ${index + 1}无法读取画面（可能是跨域限制），已停止导出以避免生成缺图文件`);
    }
  }));

  if (options.waitForVideoFrames !== false) {
      await waitForExportVideoFrames(element, timeoutMs, undefined, options.signal);
  }
}

/** Wait for seek completion/current-frame availability before rasterizing a frame. */
export async function waitForExportVideoFrames(
  element: HTMLElement,
  timeoutMs = 5000,
  expectedTimelineTime?: number,
  signal?: AbortSignal,
): Promise<void> {
  const videos = Array.from(element.querySelectorAll<HTMLVideoElement>('video'))
    .filter((video) => video.getClientRects().length > 0 && Boolean(video.currentSrc || video.src));
  await Promise.all(videos.map(async (video, index) => {
    if (video.error) throw new Error(`视频 ${index + 1}加载失败`);
    if (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await withExportTimeout(waitForEventOrTimeout(
        video,
        ['seeked', 'loadeddata', 'canplay'],
        ['error', 'abort'],
        timeoutMs,
        `视频 ${index + 1}`,
        signal,
      ), timeoutMs + 100, `视频 ${index + 1}画面准备`, signal);
    }
    if (video.error || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error(`视频 ${index + 1}当前帧不可用`);
    }

    if (expectedTimelineTime !== undefined && Number.isFinite(video.duration) && video.duration > 0) {
      const startTime = Number(video.dataset.videoStartTime || 0);
      const localTime = Math.max(0, expectedTimelineTime - (Number.isFinite(startTime) ? startTime : 0));
      if (video.dataset.videoPrewarm === 'true' && expectedTimelineTime < startTime) return;
      const shouldLoop = video.dataset.videoLoop === 'true';
      const playbackCount = Math.max(1, Number(video.dataset.videoPlaybackCount || 1));
      const finished = !shouldLoop && localTime >= video.duration * playbackCount;
      const targetTime = shouldLoop || playbackCount > 1
        ? finished ? video.duration : localTime % video.duration
        : Math.min(localTime, video.duration);
      const deadline = performance.now() + timeoutMs;
      while (video.seeking || Math.abs(video.currentTime - targetTime) > 0.12) {
        if (performance.now() >= deadline) {
          throw new Error(`视频 ${index + 1}未能定位到时间点 ${expectedTimelineTime.toFixed(2)} 秒，已停止导出以避免重复或错误画面`);
        }
        await waitForExportFrame(signal, 1000);
      }
    }

    // Probe the actual decoded frame with the same readback requirement used by
    // html2canvas-pro. That library falls back to a blank canvas when drawing
    // a tainted video, which otherwise looks like a successful black export.
    const probe = document.createElement('canvas');
    probe.width = 2;
    probe.height = 2;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(`视频 ${index + 1}无法验证画面，请检查浏览器支持`);
    try {
      context.drawImage(video, 0, 0, probe.width, probe.height);
      context.getImageData(0, 0, 1, 1);
    } catch {
      throw new Error(`视频 ${index + 1}无法读取当前画面（可能是跨域或编码格式问题），已停止导出以避免生成黑场`);
    }
  }));
}

/** Capture the authored stage only, never the surrounding editor chrome. */
export function getExportCaptureTarget(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[data-export-stage="true"]') || container;
}

/**
 * 截取指定DOM元素为Canvas
 * @param element 要截取的DOM元素
 * @param options 截图选项
 */
export async function captureElement(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const {
    width,
    height,
    scale = 2,
    backgroundColor = null,
    useCORS = true,
    allowTaint = false,
    logging = false,
    mutateSource = true,
    foreignObjectRendering = false,
    includeDataUrl = true,
    signal,
  } = options;

  // 【双重保险方案】导出前直接在原始文档中临时隐藏编辑辅助元素，同时在onclone中再次隐藏
  // 确保html2canvas渲染时这些元素确实不可见
  const hiddenElements: HTMLElement[] = [];
  const hideEditElements = (root: Document | HTMLElement) => {
    const editOnlyElements = root.querySelectorAll('[data-capture-hide="true"], [data-export-hide="true"]');
    editOnlyElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.display = 'none';
    });
  };

  // 在原始文档中隐藏
  if (mutateSource) {
    const editOnlyElements = document.querySelectorAll('[data-capture-hide="true"], [data-export-hide="true"]');
    editOnlyElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      (htmlEl as any)._originalDisplay = htmlEl.style.display;
      htmlEl.style.display = 'none';
      hiddenElements.push(htmlEl);
    });
  }

  // 强制同步布局，确保display:none生效
  if (mutateSource) void document.body.offsetHeight;

  try {
    const sourceWidth = element.offsetWidth || width || 1;
    const sourceHeight = element.offsetHeight || height || 1;
    const requestedWidth = width || Math.round(sourceWidth * scale);
    const requestedHeight = height || Math.round(sourceHeight * scale);
    const renderScale = Math.max(1, Math.min(
      requestedWidth / sourceWidth,
      requestedHeight / sourceHeight,
    ));
    const renderedCanvas = await withExportTimeout(html2canvas(element, {
      scale: renderScale,
      width: sourceWidth,
      height: sourceHeight,
      backgroundColor,
      useCORS,
      allowTaint,
      logging,
      foreignObjectRendering,
      signal,
      // onclone中再次隐藏，双重保险
      onclone: (clonedDoc) => {
        hideEditElements(clonedDoc);
        if (element.matches('[data-export-stage="true"]')) {
          const clonedStage = clonedDoc.querySelector<HTMLElement>('[data-export-stage="true"]');
          if (clonedStage) {
            // html2canvas starts CSS animations again in its cloned document.
            // Scene entry animations begin at opacity: 0, so every exported
            // frame can otherwise capture a transparent/black stage even when
            // the live preview is fully visible. Export timing is driven by the
            // editor playhead; CSS transitions/animations are editor-only here.
            const animatedElements = [clonedStage, ...Array.from(clonedStage.querySelectorAll<HTMLElement>('*'))];
            animatedElements.forEach((animatedElement) => {
              animatedElement.style.setProperty('animation', 'none', 'important');
              animatedElement.style.setProperty('transition', 'none', 'important');
            });
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.width = `${sourceWidth}px`;
            clonedDoc.body.style.height = `${sourceHeight}px`;
            clonedDoc.body.style.overflow = 'visible';
            clonedStage.style.position = 'absolute';
            clonedStage.style.left = '0';
            clonedStage.style.top = '0';
            clonedStage.style.margin = '0';
            clonedStage.style.width = `${sourceWidth}px`;
            clonedStage.style.height = `${sourceHeight}px`;
            clonedStage.style.transform = 'none';
            clonedDoc.body.appendChild(clonedStage);
          }
        }
      },
    }), 60_000, '画面截图', signal);

    let canvas = renderedCanvas;
    if (renderedCanvas.width !== requestedWidth || renderedCanvas.height !== requestedHeight) {
      canvas = document.createElement('canvas');
      canvas.width = requestedWidth;
      canvas.height = requestedHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建导出画布');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(renderedCanvas, 0, 0, requestedWidth, requestedHeight);
      renderedCanvas.width = 1;
      renderedCanvas.height = 1;
    }

    return {
      canvas,
      dataUrl: includeDataUrl ? canvas.toDataURL('image/png') : '',
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    // 恢复所有隐藏的元素
    hiddenElements.forEach((el) => {
      el.style.display = (el as any)._originalDisplay || '';
      delete (el as any)._originalDisplay;
    });
  }
}

/**
 * 截取指定DOM元素并下载为图片
 * @param element 要截取的DOM元素
 * @param filename 文件名
 * @param options 截图选项
 */
export async function captureAndDownload(
  element: HTMLElement,
  filename: string,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const result = await captureElement(element, options);

  // 下载图片
  const link = document.createElement('a');
  link.download = filename;
  link.href = result.dataUrl;
  link.click();

  return result;
}

/**
 * Canvas转Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas转Blob失败'));
      },
      type,
      quality
    );
  });
}

/**
 * 下载Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Large image-sequence ZIPs may take longer for the browser to start saving.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * 视频帧捕获器
 * 用于逐帧截取动画内容，合成视频
 */
export class VideoFrameCapturer {
  private element: HTMLElement;
  private frames: HTMLCanvasElement[] = [];
  private fps: number;
  private width: number;
  private height: number;
  private scale: number;

  constructor(
    element: HTMLElement,
    options: {
      fps?: number;
      width?: number;
      height?: number;
      scale?: number;
    } = {}
  ) {
    this.element = element;
    this.fps = options.fps || 30;
    this.width = options.width || element.offsetWidth;
    this.height = options.height || element.offsetHeight;
    this.scale = options.scale || 1;
  }

  /**
   * 捕获一帧
   * @param renderFrame 渲染该帧的回调（例如设置currentTime）
   */
  async captureFrame(renderFrame?: () => Promise<void> | void): Promise<HTMLCanvasElement> {
    if (renderFrame) {
      await renderFrame();
      // 等待一帧渲染完成
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const result = await captureElement(this.element, {
      width: this.width,
      height: this.height,
      scale: this.scale,
      backgroundColor: '#000000',
    });

    this.frames.push(result.canvas);
    return result.canvas;
  }

  /**
   * 批量捕获帧
   * @param totalFrames 总帧数
   * @param onRenderFrame 渲染指定帧的回调 (frameIndex) => Promise<void>
   * @param onProgress 进度回调 (progress, frameIndex) => void
   */
  async captureFrames(
    totalFrames: number,
    onRenderFrame: (frameIndex: number) => Promise<void>,
    onProgress?: (progress: number, frameIndex: number) => void
  ): Promise<HTMLCanvasElement[]> {
    this.frames = [];

    for (let i = 0; i < totalFrames; i++) {
      await this.captureFrame(() => onRenderFrame(i));
      if (onProgress) {
        onProgress((i + 1) / totalFrames, i);
      }
    }

    return this.frames;
  }

  /**
   * 获取已捕获的帧
   */
  getFrames(): HTMLCanvasElement[] {
    return this.frames;
  }

  /**
   * 清空帧
   */
  clear(): void {
    this.frames = [];
  }

  /**
   * 使用MediaRecorder录制视频（实时录制，不支持逐帧控制）
   * @param duration 录制时长（秒）
   * @param onProgress 进度回调
   */
  async recordWithMediaRecorder(
    duration: number,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // 创建一个隐藏的canvas用于录制
    const canvas = document.createElement('canvas');
    canvas.width = this.width * this.scale;
    canvas.height = this.height * this.scale;
    const ctx = canvas.getContext('2d')!;

    // 获取MediaStream
    const stream = canvas.captureStream(this.fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: 'video/webm' }));
      };
      recorder.onerror = (e) => reject(e);

      recorder.start();

      const startTime = Date.now();
      const totalMs = duration * 1000;

      // 实时绘制元素内容到canvas
      const drawFrame = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalMs, 1);

        // 使用html2canvas截取当前帧
        captureElement(this.element, {
          width: this.width,
          height: this.height,
          scale: this.scale,
          backgroundColor: '#000000',
        }).then((result) => {
          ctx.drawImage(result.canvas, 0, 0);
        }).catch(() => {
          // 忽略单帧错误
        });

        if (onProgress) onProgress(progress);

        if (elapsed < totalMs) {
          requestAnimationFrame(drawFrame);
        } else {
          setTimeout(() => recorder.stop(), 100);
        }
      };

      drawFrame();
    });
  }
}

/**
 * 分辨率映射
 */
export const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 },
};
