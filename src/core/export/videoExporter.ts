/**
 * 视频导出器
 * 逐帧渲染场景并录制为 MP4/WebM 视频
 * 使用 Canvas.captureStream + MediaRecorder
 * 支持水印、音频、自定义分辨率/帧率
 */

import { watermarkService } from './watermark';
import {
  RESOLUTIONS,
  DEFAULT_WATERMARK,
  detectSupportedVideoFormats,
  isMediaRecorderSupported,
  isCanvasCaptureSupported,
  type VideoExportOptions,
  type ExportResult,
  type WatermarkConfig,
} from './types';

/** 视频渲染上下文 */
export interface VideoRenderContext {
  /** 渲染指定时间点的帧到 Canvas */
  renderFrame: (canvas: HTMLCanvasElement, time: number, frameIndex: number) => Promise<void>;
  /** 获取总时长（秒） */
  getDuration: () => number;
  /** 获取音频轨道（可选） */
  getAudioTrack?: () => MediaStreamTrack | null;
  /** 当前用户ID（用于隐写水印，视频中不适用，仅记录） */
  userId?: string;
  /** 当前工程ID */
  projectId?: string;
}

/** 导出状态 */
interface ExportState {
  isExporting: boolean;
  shouldCancel: boolean;
  recorder: MediaRecorder | null;
  chunks: Blob[];
}

class VideoExporter {
  private state: ExportState = {
    isExporting: false,
    shouldCancel: false,
    recorder: null,
    chunks: [],
  };

  /**
   * 导出视频
   */
  async export(
    options: VideoExportOptions,
    renderContext: VideoRenderContext
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // 检查浏览器支持
    if (!isMediaRecorderSupported()) {
      return {
        success: false,
        format: options.format,
        filename: 'export',
        size: 0,
        duration: 0,
        warnings: ['当前浏览器不支持 MediaRecorder'],
        error: '浏览器不支持视频录制',
      };
    }

    if (!isCanvasCaptureSupported()) {
      warnings.push('当前浏览器可能不完全支持 Canvas 捕获流');
    }

    // 检查格式支持
    const supported = detectSupportedVideoFormats();
    if (options.format === 'mp4' && !supported.mp4) {
      warnings.push('当前浏览器可能不支持 MP4 录制，将尝试使用 WebM');
    }

    if (this.state.isExporting) {
      return {
        success: false,
        format: options.format,
        filename: 'export',
        size: 0,
        duration: 0,
        warnings,
        error: '已有导出任务正在进行',
      };
    }

    this.state.isExporting = true;
    this.state.shouldCancel = false;
    this.state.chunks = [];

    try {
      options.onProgress?.(0.05, '准备导出');

      // ① 确定导出参数
      const { width, height } = this.getExportDimensions(options);
      const fps = options.fps || 30;
      const duration = options.duration || renderContext.getDuration();
      const totalFrames = Math.floor(duration * fps);

      if (totalFrames <= 0) {
        throw new Error('视频时长为0');
      }

      // ② 创建离屏 Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 上下文');

      // ③ 设置 MediaRecorder
      options.onProgress?.(0.1, '初始化录制器');
      const stream = (canvas as any).captureStream(fps) as MediaStream;

      // 添加音频轨道
      if (options.includeAudio !== false && renderContext.getAudioTrack) {
        const audioTrack = renderContext.getAudioTrack();
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      }

      const mimeType = this.getSupportedMimeType(options.format);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: this.getBitrate(width, height, fps),
      });

      this.state.recorder = recorder;
      this.state.chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.state.chunks.push(e.data);
        }
      };

      const recorderPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(this.state.chunks, { type: mimeType });
          resolve(blob);
        };
        recorder.onerror = (e) => reject(e);
      });

      // ④ 开始录制
      recorder.start(100); // 每100ms收集一次数据

      // ⑤ 逐帧渲染
      options.onProgress?.(0.15, '渲染视频帧');
      const watermarkConfig = this.getWatermarkConfig(options);

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.state.shouldCancel) {
          break;
        }

        const time = frameIndex / fps;

        // 渲染帧
        await renderContext.renderFrame(canvas, time, frameIndex);

        // 应用水印
        if (options.includeWatermark !== false) {
          watermarkService.applyVideoFrameWatermark(
            canvas,
            watermarkConfig,
            frameIndex,
            totalFrames
          );
        }

        // 报告进度
        const progress = 0.15 + (frameIndex / totalFrames) * 0.75;
        options.onProgress?.(
          progress,
          `渲染帧 ${frameIndex + 1}/${totalFrames} (${Math.round(time * 10) / 10}s)`
        );

        // 等待下一帧（控制帧率）
        await this.waitForNextFrame(fps);
      }

      // ⑥ 停止录制
      options.onProgress?.(0.92, '完成录制');
      recorder.stop();

      // 等待录制完成
      const blob = await recorderPromise;

      // ⑦ 保存文件
      options.onProgress?.(0.95, '保存视频');
      const filename = this.getFilename(options);
      const url = URL.createObjectURL(blob);
      this.triggerDownload(url, filename);

      setTimeout(() => URL.revokeObjectURL(url), 60000);

      options.onProgress?.(1, '导出完成');

      return {
        success: true,
        format: options.format,
        filename,
        size: blob.size,
        blob,
        url,
        duration: Date.now() - startTime,
        width,
        height,
        fps,
        frames: totalFrames,
        warnings,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('视频导出失败:', e);
      return {
        success: false,
        format: options.format,
        filename: options.filename || 'export',
        size: 0,
        duration: Date.now() - startTime,
        warnings,
        error,
      };
    } finally {
      this.state.isExporting = false;
      this.state.recorder = null;
    }
  }

  /**
   * 取消导出
   */
  cancel(): void {
    if (this.state.isExporting) {
      this.state.shouldCancel = true;
      if (this.state.recorder && this.state.recorder.state !== 'inactive') {
        this.state.recorder.stop();
      }
    }
  }

  /**
   * 检查是否正在导出
   */
  isExporting(): boolean {
    return this.state.isExporting;
  }

  // ==================== 内部方法 ====================

  /**
   * 获取导出尺寸
   */
  private getExportDimensions(options: VideoExportOptions): { width: number; height: number } {
    if (options.width && options.height) {
      return { width: options.width, height: options.height };
    }

    const resolution = options.resolution || '1080p';
    const res = RESOLUTIONS[resolution];
    if (res && res.width > 0) {
      return { width: res.width, height: res.height };
    }

    return { width: 1920, height: 1080 };
  }

  /**
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(format: 'mp4' | 'webm'): string {
    const candidates: Record<string, string[]> = {
      mp4: [
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264',
        'video/mp4',
      ],
      webm: [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ],
    };

    const list = candidates[format] || candidates.webm;
    for (const mime of list) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    // 降级到浏览器默认
    return '';
  }

  /**
   * 根据分辨率和帧率计算比特率
   */
  private getBitrate(width: number, height: number, fps: number): number {
    // 基础比特率：1080p30 = 8Mbps
    const base = 8 * 1024 * 1024;
    const resolutionFactor = (width * height) / (1920 * 1080);
    const fpsFactor = fps / 30;
    return Math.round(base * resolutionFactor * fpsFactor);
  }

  /**
   * 获取水印配置
   */
  private getWatermarkConfig(options: VideoExportOptions): WatermarkConfig {
    return { ...DEFAULT_WATERMARK };
  }

  /**
   * 等待下一帧
   */
  private waitForNextFrame(fps: number): Promise<void> {
    const frameTime = 1000 / fps;
    return new Promise((resolve) => setTimeout(resolve, frameTime * 0.9));
  }

  /**
   * 获取文件名
   */
  private getFilename(options: VideoExportOptions): string {
    const base = options.filename || `video_${Date.now()}`;
    return `${base}.${options.format}`;
  }

  /**
   * 触发浏览器下载
   */
  private triggerDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * 估算导出文件大小
   */
  estimateFileSize(
    width: number,
    height: number,
    fps: number,
    durationSeconds: number,
    hasAudio = true
  ): number {
    const videoBitrate = this.getBitrate(width, height, fps);
    const audioBitrate = hasAudio ? 128 * 1024 : 0; // 128kbps
    const totalBitrate = videoBitrate + audioBitrate;
    return Math.round((totalBitrate * durationSeconds) / 8);
  }
}

/** 单例导出 */
export const videoExporter = new VideoExporter();
