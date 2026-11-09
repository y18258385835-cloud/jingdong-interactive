/**
 * 图片导出器
 * 将当前场景渲染为 PNG/JPG/WebP 图片
 * 支持水印、隐写水印、自定义分辨率
 */

import { watermarkService } from './watermark';
import {
  RESOLUTIONS,
  DEFAULT_WATERMARK,
  type ImageExportOptions,
  type ExportResult,
  type WatermarkConfig,
  type SteganographyConfig,
} from './types';

/** 渲染上下文：由调用方提供，用于将场景渲染到指定 Canvas */
export interface RenderContext {
  /** 渲染到指定 Canvas 的函数 */
  renderToCanvas: (canvas: HTMLCanvasElement, width: number, height: number) => Promise<void>;
  /** 当前用户ID（用于隐写水印） */
  userId?: string;
  /** 当前工程ID（用于隐写水印） */
  projectId?: string;
}

class ImageExporter {
  /**
   * 导出图片
   * @param options 导出选项
   * @param renderContext 渲染上下文
   */
  async export(
    options: ImageExportOptions,
    renderContext: RenderContext
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      options.onProgress?.(0.1, '准备导出');

      // ① 确定导出尺寸
      const { width, height } = this.getExportDimensions(options);

      // ② 创建离屏 Canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      // ③ 渲染场景到 Canvas
      options.onProgress?.(0.3, '渲染场景');
      await renderContext.renderToCanvas(canvas, width, height);

      // ④ 应用水印
      if (options.includeWatermark !== false) {
        options.onProgress?.(0.6, '添加水印');
        const watermarkConfig = this.getWatermarkConfig(options);
        watermarkService.applyWatermark(canvas, watermarkConfig);

        // ⑤ 嵌入隐写水印（用于盗版追溯）
        if (renderContext.userId && renderContext.projectId) {
          const stegoConfig: SteganographyConfig = {
            enabled: true,
            userId: renderContext.userId,
            projectId: renderContext.projectId,
            timestamp: Date.now(),
          };
          try {
            watermarkService.embedSteganography(canvas, stegoConfig);
          } catch (e) {
            console.warn('隐写水印嵌入失败:', e);
          }
        }
      }

      // ⑥ 转换为 Blob
      options.onProgress?.(0.8, '生成图片');
      const blob = await this.canvasToBlob(canvas, options);

      // ⑦ 生成下载 URL 并触发下载
      options.onProgress?.(0.9, '保存文件');
      const filename = this.getFilename(options);
      const url = URL.createObjectURL(blob);
      this.triggerDownload(url, filename);

      // ⑧ 延迟释放 URL
      setTimeout(() => URL.revokeObjectURL(url), 10000);

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
        warnings,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('图片导出失败:', e);
      return {
        success: false,
        format: options.format,
        filename: options.filename || 'export',
        size: 0,
        duration: Date.now() - startTime,
        warnings,
        error,
      };
    }
  }

  /**
   * 导出为 Blob（不触发下载）
   */
  async exportToBlob(
    options: ImageExportOptions,
    renderContext: RenderContext
  ): Promise<Blob> {
    const { width, height } = this.getExportDimensions(options);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    await renderContext.renderToCanvas(canvas, width, height);

    if (options.includeWatermark !== false) {
      const watermarkConfig = this.getWatermarkConfig(options);
      watermarkService.applyWatermark(canvas, watermarkConfig);
    }

    return this.canvasToBlob(canvas, options);
  }

  /**
   * 批量导出多个场景为图片
   */
  async exportBatch(
    optionsList: ImageExportOptions[],
    renderContext: RenderContext,
    onBatchProgress?: (current: number, total: number, result: ExportResult) => void
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    for (let i = 0; i < optionsList.length; i++) {
      const result = await this.export(optionsList[i], renderContext);
      results.push(result);
      onBatchProgress?.(i + 1, optionsList.length, result);
    }
    return results;
  }

  // ==================== 内部方法 ====================

  /**
   * 获取导出尺寸
   */
  private getExportDimensions(options: ImageExportOptions): { width: number; height: number } {
    if (options.width && options.height) {
      return { width: options.width, height: options.height };
    }

    const resolution = options.resolution || '1080p';
    const res = RESOLUTIONS[resolution];
    if (res && res.width > 0) {
      return { width: res.width, height: res.height };
    }

    // 默认 1080p
    return { width: 1920, height: 1080 };
  }

  /**
   * 获取水印配置
   */
  private getWatermarkConfig(options: ImageExportOptions): WatermarkConfig {
    // 可以根据导出选项自定义水印，这里使用默认配置
    return { ...DEFAULT_WATERMARK };
  }

  /**
   * Canvas 转 Blob
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement,
    options: ImageExportOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = this.getMimeType(options.format);
      const quality = options.quality ?? 0.92;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas 转 Blob 失败'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * 获取 MIME 类型
   */
  private getMimeType(format: 'png' | 'jpg' | 'webp'): string {
    const map: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp',
    };
    return map[format] || 'image/png';
  }

  /**
   * 获取文件名
   */
  private getFilename(options: ImageExportOptions): string {
    const base = options.filename || `export_${Date.now()}`;
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
   * 复制图片到剪贴板
   */
  async copyToClipboard(
    options: ImageExportOptions,
    renderContext: RenderContext
  ): Promise<boolean> {
    try {
      const blob = await this.exportToBlob(options, renderContext);
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ [blob.type]: blob }),
        ]);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('复制到剪贴板失败:', e);
      return false;
    }
  }
}

/** 单例导出 */
export const imageExporter = new ImageExporter();
