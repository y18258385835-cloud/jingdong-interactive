/**
 * P2 导出层 - 统一导出
 * 图片/视频/HTML导出、水印机制、React Hooks
 */

// 实际导入（用于 initExport 函数）
import {
  detectSupportedVideoFormats,
  isMediaRecorderSupported,
  isCanvasCaptureSupported,
} from './types';

// 类型与常量
export {
  EXPORT_FORMATS,
  RESOLUTIONS,
  DEFAULT_WATERMARK,
  VIDEO_CODECS,
  detectSupportedVideoFormats,
  isMediaRecorderSupported,
  isCanvasCaptureSupported,
} from './types';

export type {
  ExportFormat,
  ExportFormatInfo,
  ExportResolution,
  BaseExportOptions,
  ImageExportOptions,
  VideoExportOptions,
  HTMLExportOptions,
  WatermarkConfig,
  WatermarkPosition,
  WatermarkType,
  SteganographyConfig,
  ExportResult,
  ExportProgress,
} from './types';

// 水印服务
export { watermarkService } from './watermark';

// 导出器
export { imageExporter } from './imageExporter';
export type { RenderContext as ImageRenderContext } from './imageExporter';

export { videoExporter } from './videoExporter';
export type { VideoRenderContext } from './videoExporter';

export { htmlExporter } from './htmlExporter';
export type { HTMLRenderContext } from './htmlExporter';

// 导出管理器
export { exportManager } from './manager';

// React Hooks
export {
  useExport,
  useImageExport,
  useVideoExport,
  useHTMLExport,
  useExportDialog,
} from './hooks';

/**
 * P2 导出层初始化
 * 在应用启动时调用（目前无需特殊初始化，预留接口）
 */
export async function initExport(): Promise<void> {
  // 预留：检测浏览器支持、预加载水印图片等
  if (import.meta.env.DEV) {
    console.info('[Aether] 导出层已初始化');
    console.info('[Aether] 视频格式支持:', detectSupportedVideoFormats());
    console.info('[Aether] MediaRecorder 支持:', isMediaRecorderSupported());
    console.info('[Aether] Canvas 捕获流支持:', isCanvasCaptureSupported());
  }
}
