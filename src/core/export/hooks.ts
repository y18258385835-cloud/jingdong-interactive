/**
 * 导出相关 React Hook
 * 方便在组件中使用导出功能和进度跟踪
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { exportManager } from './manager';
import {
  imageExporter,
  type RenderContext as ImageRenderContext,
} from './imageExporter';
import {
  videoExporter,
  type VideoRenderContext,
} from './videoExporter';
import {
  htmlExporter,
  type HTMLRenderContext,
} from './htmlExporter';
import type {
  ExportFormat,
  ExportResult,
  ExportProgress,
  ImageExportOptions,
  VideoExportOptions,
  HTMLExportOptions,
} from './types';

type ExportOptions = ImageExportOptions | VideoExportOptions | HTMLExportOptions;
type RenderContext = ImageRenderContext | VideoRenderContext | HTMLRenderContext;

/**
 * 使用导出管理器
 */
export function useExport() {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastResult, setLastResult] = useState<ExportResult | null>(null);

  useEffect(() => {
    const unsubscribe = exportManager.addListener((p) => {
      setProgress(p);
      setIsExporting(p !== null);
    });
    return unsubscribe;
  }, []);

  const exportFile = useCallback(
    async (options: ExportOptions, context: RenderContext): Promise<ExportResult> => {
      const result = await exportManager.export(options, context);
      setLastResult(result);
      return result;
    },
    []
  );

  const cancel = useCallback(() => {
    exportManager.cancel();
  }, []);

  return {
    progress,
    isExporting,
    lastResult,
    exportFile,
    cancel,
  };
}

/**
 * 使用图片导出
 */
export function useImageExport() {
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const exportImage = useCallback(
    async (
      options: ImageExportOptions,
      context: ImageRenderContext
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setProgress(0);
      try {
        const wrappedOptions = {
          ...options,
          onProgress: (p: number, stage: string) => {
            setProgress(p);
            options.onProgress?.(p, stage);
          },
        };
        const res = await imageExporter.export(wrappedOptions, context);
        setResult(res);
        return res;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const copyToClipboard = useCallback(
    async (
      options: ImageExportOptions,
      context: ImageRenderContext
    ): Promise<boolean> => {
      return imageExporter.copyToClipboard(options, context);
    },
    []
  );

  return {
    progress,
    isExporting,
    result,
    exportImage,
    copyToClipboard,
  };
}

/**
 * 使用视频导出
 */
export function useVideoExport() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  const exportVideo = useCallback(
    async (
      options: VideoExportOptions,
      context: VideoRenderContext
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setProgress(0);
      try {
        const wrappedOptions = {
          ...options,
          onProgress: (p: number, s: string) => {
            setProgress(p);
            setStage(s);
            // 从阶段信息中提取帧信息
            const frameMatch = s.match(/(\d+)\/(\d+)/);
            if (frameMatch) {
              setCurrentFrame(parseInt(frameMatch[1], 10));
              setTotalFrames(parseInt(frameMatch[2], 10));
            }
            options.onProgress?.(p, s);
          },
        };
        const res = await videoExporter.export(wrappedOptions, context);
        setResult(res);
        return res;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const cancel = useCallback(() => {
    videoExporter.cancel();
  }, []);

  return {
    progress,
    stage,
    isExporting,
    result,
    currentFrame,
    totalFrames,
    exportVideo,
    cancel,
  };
}

/**
 * 使用 HTML 导出
 */
export function useHTMLExport() {
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const exportHTML = useCallback(
    async (
      options: HTMLExportOptions,
      context: HTMLRenderContext
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setProgress(0);
      try {
        const wrappedOptions = {
          ...options,
          onProgress: (p: number, stage: string) => {
            setProgress(p);
            options.onProgress?.(p, stage);
          },
        };
        const res = await htmlExporter.export(wrappedOptions, context);
        setResult(res);
        return res;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const exportAsZip = useCallback(
    async (
      options: HTMLExportOptions,
      context: HTMLRenderContext
    ): Promise<ExportResult> => {
      setIsExporting(true);
      setProgress(0);
      try {
        const wrappedOptions = {
          ...options,
          onProgress: (p: number, stage: string) => {
            setProgress(p);
            options.onProgress?.(p, stage);
          },
        };
        const res = await htmlExporter.exportAsZip(wrappedOptions, context);
        setResult(res);
        return res;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    progress,
    isExporting,
    result,
    exportHTML,
    exportAsZip,
  };
}

/**
 * 导出对话框状态管理
 */
export function useExportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportOptions['format']>('png');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '2k' | '4k'>('1080p');
  const [quality, setQuality] = useState(0.92);
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [fps, setFps] = useState(30);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const getOptions = useCallback((): Partial<ExportOptions> => {
    return {
      format: selectedFormat,
      resolution,
      quality,
      includeWatermark,
      fps,
    };
  }, [selectedFormat, resolution, quality, includeWatermark, fps]);

  return {
    isOpen,
    selectedFormat,
    resolution,
    quality,
    includeWatermark,
    fps,
    setSelectedFormat,
    setResolution,
    setQuality,
    setIncludeWatermark,
    setFps,
    open,
    close,
    getOptions,
  };
}
