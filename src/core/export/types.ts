/**
 * P2 导出层 - 类型定义与常量
 * 图片/视频/HTML导出、水印机制
 */

// ==================== 导出格式 ====================

/** 导出格式类型 */
export type ExportFormat = 'png' | 'jpg' | 'webp' | 'mp4' | 'webm' | 'html' | 'exe' | 'aether' | 'image-sequence';

/** 导出格式信息 */
export interface ExportFormatInfo {
  format: ExportFormat;
  name: string;
  description: string;
  category: '图片' | '视频' | '网页' | '工程';
  extension: string;
  mimeType: string;
  requiresPro: boolean;
  supportsWatermark: boolean;
  supportsAudio: boolean;
}

/** 支持的导出格式列表 */
export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatInfo> = {
  png: {
    format: 'png',
    name: 'PNG 图片',
    description: '无损压缩图片，支持透明背景',
    category: '图片',
    extension: 'png',
    mimeType: 'image/png',
    requiresPro: false,
    supportsWatermark: true,
    supportsAudio: false,
  },
  jpg: {
    format: 'jpg',
    name: 'JPG 图片',
    description: '有损压缩图片，文件更小',
    category: '图片',
    extension: 'jpg',
    mimeType: 'image/jpeg',
    requiresPro: false,
    supportsWatermark: true,
    supportsAudio: false,
  },
  webp: {
    format: 'webp',
    name: 'WebP 图片',
    description: '现代图片格式，体积更小质量更好',
    category: '图片',
    extension: 'webp',
    mimeType: 'image/webp',
    requiresPro: true,
    supportsWatermark: true,
    supportsAudio: false,
  },
  mp4: {
    format: 'mp4',
    name: 'MP4 视频',
    description: '通用视频格式，兼容性最好',
    category: '视频',
    extension: 'mp4',
    mimeType: 'video/mp4',
    requiresPro: false,
    supportsWatermark: true,
    supportsAudio: true,
  },
  webm: {
    format: 'webm',
    name: 'WebM 视频',
    description: '开源视频格式，浏览器原生支持',
    category: '视频',
    extension: 'webm',
    mimeType: 'video/webm',
    requiresPro: true,
    supportsWatermark: true,
    supportsAudio: true,
  },
  html: {
    format: 'html',
    name: 'HTML 网页',
    description: '可交互网页，支持全景/3D/热点交互',
    category: '网页',
    extension: 'html',
    mimeType: 'text/html',
    requiresPro: true,
    supportsWatermark: true,
    supportsAudio: true,
  },
  exe: {
    format: 'exe',
    name: 'EXE 程序',
    description: 'Windows 可执行文件，离线运行',
    category: '网页',
    extension: 'exe',
    mimeType: 'application/octet-stream',
    requiresPro: true,
    supportsWatermark: true,
    supportsAudio: true,
  },
  aether: {
    format: 'aether',
    name: '鲸动交互平台 工程',
    description: '工程源文件，可再次编辑',
    category: '工程',
    extension: 'aether',
    mimeType: 'application/zip',
    requiresPro: true,
    supportsWatermark: false,
    supportsAudio: true,
  },
  'image-sequence': {
    format: 'image-sequence',
    name: 'PNG/JPG 图片序列',
    description: '按时间轴逐帧导出并打包为 ZIP',
    category: '图片',
    extension: 'zip',
    mimeType: 'application/zip',
    requiresPro: false,
    supportsWatermark: true,
    supportsAudio: false,
  },
};

// ==================== 导出选项 ====================

/** 导出分辨率 */
export type ExportResolution = '720p' | '1080p' | '2k' | '4k' | 'custom';

/** 分辨率映射 */
export const RESOLUTIONS: Record<ExportResolution, { width: number; height: number; label: string }> = {
  '720p': { width: 1280, height: 720, label: '720p (1280×720)' },
  '1080p': { width: 1920, height: 1080, label: '1080p (1920×1080)' },
  '2k': { width: 2560, height: 1440, label: '2K (2560×1440)' },
  '4k': { width: 3840, height: 2160, label: '4K (3840×2160)' },
  'custom': { width: 0, height: 0, label: '自定义' },
};

/** 基础导出选项 */
export interface BaseExportOptions {
  format: ExportFormat;
  resolution?: ExportResolution;
  width?: number;
  height?: number;
  quality?: number; // 0-1，图片/视频质量
  filename?: string;
  includeWatermark?: boolean;
  onProgress?: (progress: number, stage: string) => void;
}

/** 图片导出选项 */
export interface ImageExportOptions extends BaseExportOptions {
  format: 'png' | 'jpg' | 'webp';
  sceneIndex?: number; // 导出哪个场景，默认当前场景
  transparent?: boolean; // 是否透明背景（仅PNG）
}

/** 视频导出选项 */
export interface VideoExportOptions extends BaseExportOptions {
  format: 'mp4' | 'webm';
  fps?: number; // 帧率，默认30
  duration?: number; // 视频时长（秒），默认工程总时长
  includeAudio?: boolean; // 是否包含音频
  startFrame?: number; // 起始帧
  endFrame?: number; // 结束帧
}

/** HTML导出选项 */
export interface HTMLExportOptions extends BaseExportOptions {
  format: 'html';
  exportProof?: import('../../utils/exportProof').ExportProof;
  includeAssets?: boolean; // 是否内嵌素材（base64）
  autoPlay?: boolean; // 是否自动播放
  loop?: boolean; // 是否循环
  fullscreen?: boolean; // 是否全屏显示
  showControls?: boolean; // 是否显示控制栏
  title?: string; // 网页标题
}

// ==================== 水印 ====================

/** 水印位置 */
export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'tile'; // 平铺

/** 水印类型 */
export type WatermarkType = 'text' | 'image' | 'both';

/** 水印配置 */
export interface WatermarkConfig {
  enabled: boolean;
  type: WatermarkType;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  opacity?: number; // 0-1
  position?: WatermarkPosition;
  margin?: number; // 边距（像素）
  rotation?: number; // 旋转角度
  imageUrl?: string; // 图片水印URL
  imageWidth?: number; // 图片水印宽度
  tileSpacing?: number; // 平铺间距
}

/** 默认水印配置（免费版强制使用） */
export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: true,
  type: 'text',
  text: '鲸动交互平台',
  fontSize: 32,
  fontFamily: 'Arial, sans-serif',
  color: '#ffffff',
  opacity: 0.3,
  position: 'bottom-right',
  margin: 20,
  rotation: 0,
  tileSpacing: 200,
};

/** 隐写水印配置（用于盗版追溯） */
export interface SteganographyConfig {
  enabled: boolean;
  userId: string;
  projectId: string;
  timestamp: number;
}

// ==================== 导出结果 ====================

/** 导出结果 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  filename: string;
  size: number;
  blob?: Blob;
  url?: string;
  duration?: number; // 导出耗时（毫秒）
  width?: number;
  height?: number;
  fps?: number;
  frames?: number;
  warnings: string[];
  error?: string;
}

/** 导出进度状态 */
export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'watermarking' | 'packaging' | 'done' | 'error';
  progress: number; // 0-1
  message: string;
  currentFrame?: number;
  totalFrames?: number;
}

// ==================== 常量 ====================

/** 视频编码支持检测 */
export const VIDEO_CODECS = {
  'video/mp4;codecs=avc1': 'H.264 (MP4)',
  'video/webm;codecs=vp9': 'VP9 (WebM)',
  'video/webm;codecs=vp8': 'VP8 (WebM)',
};

/** 检测浏览器支持的视频格式 */
export function detectSupportedVideoFormats(): { mp4: boolean; webm: boolean } {
  const result = { mp4: false, webm: false };
  try {
    const video = document.createElement('video');
    result.mp4 = video.canPlayType('video/mp4;codecs=avc1') !== '';
    result.webm = video.canPlayType('video/webm;codecs=vp9') !== '' ||
                  video.canPlayType('video/webm;codecs=vp8') !== '';
  } catch (e) {
    console.warn('检测视频格式支持失败:', e);
  }
  return result;
}

/** 检测 MediaRecorder 支持 */
export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

/** 检测 Canvas 捕获流支持 */
export function isCanvasCaptureSupported(): boolean {
  const canvas = document.createElement('canvas');
  return typeof (canvas as any).captureStream === 'function';
}
