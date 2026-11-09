/**
 * 导出管理器
 * 统一管理图片/视频/HTML导出，提供进度跟踪和错误处理
 */

import { imageExporter, type RenderContext as ImageRenderContext } from './imageExporter';
import { videoExporter, type VideoRenderContext } from './videoExporter';
import { htmlExporter, type HTMLRenderContext } from './htmlExporter';
import { watermarkService } from './watermark';
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportResult,
  type ExportProgress,
  type ImageExportOptions,
  type VideoExportOptions,
  type HTMLExportOptions,
  type BaseExportOptions,
} from './types';

type ExportOptions = ImageExportOptions | VideoExportOptions | HTMLExportOptions;
type RenderContext = ImageRenderContext | VideoRenderContext | HTMLRenderContext;

class ExportManager {
  private currentExport: {
    format: ExportFormat;
    progress: ExportProgress;
    startTime: number;
  } | null = null;

  private listeners = new Set<(progress: ExportProgress | null) => void>();

  /**
   * 导出（根据格式自动选择导出器）
   */
  async export(
    options: ExportOptions,
    context: RenderContext
  ): Promise<ExportResult> {
    const format = options.format;

    // 检查格式是否支持
    const formatInfo = EXPORT_FORMATS[format];
    if (!formatInfo) {
      return {
        success: false,
        format,
        filename: 'export',
        size: 0,
        duration: 0,
        warnings: [],
        error: `不支持的导出格式: ${format}`,
      };
    }

    // 初始化进度
    this.currentExport = {
      format,
      progress: {
        stage: 'preparing',
        progress: 0,
        message: '准备导出',
      },
      startTime: Date.now(),
    };
    this.notifyListeners();

    // 包装进度回调
    const wrappedOptions = {
      ...options,
      onProgress: (progress: number, stage: string) => {
        if (this.currentExport) {
          this.currentExport.progress = {
            stage: this.mapStage(stage),
            progress,
            message: stage,
          };
          this.notifyListeners();
        }
        options.onProgress?.(progress, stage);
      },
    };

    let result: ExportResult;

    try {
      // 根据格式选择导出器
      if (format === 'png' || format === 'jpg' || format === 'webp') {
        result = await imageExporter.export(
          wrappedOptions as ImageExportOptions,
          context as ImageRenderContext
        );
      } else if (format === 'mp4' || format === 'webm') {
        result = await videoExporter.export(
          wrappedOptions as VideoExportOptions,
          context as VideoRenderContext
        );
      } else if (format === 'html') {
        result = await htmlExporter.export(
          wrappedOptions as HTMLExportOptions,
          context as HTMLRenderContext
        );
      } else {
        result = {
          success: false,
          format,
          filename: 'export',
          size: 0,
          duration: 0,
          warnings: [],
          error: `暂不支持 ${format} 导出`,
        };
      }
    } catch (e) {
      result = {
        success: false,
        format,
        filename: options.filename || 'export',
        size: 0,
        duration: Date.now() - this.currentExport!.startTime,
        warnings: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }

    // 更新最终状态
    if (this.currentExport) {
      this.currentExport.progress = {
        stage: result.success ? 'done' : 'error',
        progress: result.success ? 1 : 0,
        message: result.success ? '导出完成' : result.error || '导出失败',
      };
      this.notifyListeners();
    }

    // 延迟清除当前导出状态
    setTimeout(() => {
      this.currentExport = null;
      this.notifyListeners();
    }, 3000);

    return result;
  }

  /**
   * 取消当前导出
   */
  cancel(): void {
    if (this.currentExport?.format === 'mp4' || this.currentExport?.format === 'webm') {
      videoExporter.cancel();
    }
    this.currentExport = null;
    this.notifyListeners();
  }

  /**
   * 获取当前导出进度
   */
  getCurrentProgress(): ExportProgress | null {
    return this.currentExport?.progress || null;
  }

  /**
   * 检查是否正在导出
   */
  isExporting(): boolean {
    return this.currentExport !== null;
  }

  /**
   * 获取支持的导出格式
   */
  getSupportedFormats(category?: '图片' | '视频' | '网页' | '工程'): typeof EXPORT_FORMATS {
    if (!category) return EXPORT_FORMATS;
    const result: any = {};
    for (const [key, info] of Object.entries(EXPORT_FORMATS)) {
      if (info.category === category) {
        result[key] = info;
      }
    }
    return result;
  }

  /**
   * 添加进度监听器
   */
  addListener(listener: (progress: ExportProgress | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const progress = this.currentExport?.progress || null;
    for (const listener of this.listeners) {
      try {
        listener(progress);
      } catch (e) {
        console.warn('导出进度监听器执行失败:', e);
      }
    }
  }

  /**
   * 映射阶段字符串
   */
  private mapStage(stage: string): ExportProgress['stage'] {
    if (stage.includes('准备')) return 'preparing';
    if (stage.includes('渲染')) return 'rendering';
    if (stage.includes('编码') || stage.includes('录制')) return 'encoding';
    if (stage.includes('水印')) return 'watermarking';
    if (stage.includes('打包') || stage.includes('压缩')) return 'packaging';
    if (stage.includes('完成')) return 'done';
    if (stage.includes('失败') || stage.includes('错误')) return 'error';
    return 'preparing';
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * 格式化导出耗时
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  }
}

/** 单例导出 */
export const exportManager = new ExportManager();

// 重新导出各导出器和类型
export { imageExporter, videoExporter, htmlExporter, watermarkService };
export type {
  RenderContext as ImageRenderContext,
} from './imageExporter';
export type {
  VideoRenderContext,
} from './videoExporter';
export type {
  HTMLRenderContext,
} from './htmlExporter';
