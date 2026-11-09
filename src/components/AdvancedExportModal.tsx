/**
 * 高级导出弹窗
 * P2 导出层：图片/视频/HTML导出
 * 集成水印、分辨率、付费权限检查
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  X, Image, Video, Download, Loader2, Check,
  Crown, AlertCircle, Settings, FileArchive,
} from 'lucide-react';
import { ProjectData } from '../types';
import { formatFileSize, formatDuration } from '../core/integration';
import {
  captureElement,
  getExportCaptureTarget,
  RESOLUTION_MAP,
  downloadBlob,
  waitForExportReadiness,
  waitForExportVideoFrames,
} from '../utils/canvasCapture';
import { getProjectCanvas } from '../utils/canvas';
import { dbManager } from '../utils/db';
import { subscriptionService, type ExportAuthorization } from '../core/auth/subscriptionService';
import { applyCanvasExportProof } from '../utils/exportProof';
import { advancedVideoExportCapabilities, createExportFrameError } from '../core/export/advancedVideoCapabilities';
import { encodeDeterministicWebm } from '../utils/webmEncoder';
import { encodeDeterministicMp4 } from '../utils/mp4Encoder';
import { exportImageSequence, type ImageSequenceFormat } from '../utils/imageSequenceExporter';
import { waitForExportFrame, withExportTimeout } from '../utils/exportAsync';
import { getLoopableSceneKeys } from '../utils/sceneLoop';
import type {
  ExportResult,
  ExportResolution,
} from '../core/export/types';

/** 分辨率从低到高，用于按授权档位放行。 */
const RESOLUTION_ORDER: ExportResolution[] = ['720p', '1080p', '2k', '4k'];

interface AdvancedExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  activeSceneId: string;
  isPaid: boolean;
  plan: string;
  /** 画布容器引用（用于截图导出） */
  canvasContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** 当前时间（用于视频导出时的时间控制） */
  currentTime?: number;
  /** 跳转到指定时间 */
  onSeek?: (time: number) => void;
  /** 在导出过程中切换到指定场景，保持画布与工程时间线同步 */
  onSelectSceneForExport?: (sceneId: string) => void;
  onPrepareExport?: () => (() => void) | void;
  onRequestActivation?: () => void;
  onRequestStandardExport?: () => void;
}

type ExportTab = 'image' | 'video';

const EXPORT_OPERATION_TIMEOUT_MS: Record<ExportTab, number> = {
  image: 30 * 60_000,
  video: 45 * 60_000,
};

function buildExportSceneTimeline(projectData: ProjectData) {
  const sceneIds = getLoopableSceneKeys(projectData.scenes);
  const orderedIds = projectData.start && sceneIds.includes(projectData.start)
    ? [projectData.start, ...sceneIds.filter((sceneId) => sceneId !== projectData.start)]
    : sceneIds;
  let start = 0;
  return orderedIds.map((id) => {
    const duration = Math.max(0.01, projectData.scenes[id]?.duration || 10);
    const segment = { id, start, end: start + duration, duration };
    start = segment.end;
    return segment;
  });
}

export const AdvancedExportModal: React.FC<AdvancedExportModalProps> = ({
  isOpen,
  onClose,
  projectData,
  activeSceneId,
  isPaid,
  plan,
  canvasContainerRef,
  currentTime = 0,
  onSeek,
  onSelectSceneForExport,
  onPrepareExport,
  onRequestActivation,
  onRequestStandardExport,
}) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('image');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [quality, setQuality] = useState(0.92);
  const [videoContainer, setVideoContainer] = useState<'mp4' | 'webm'>('mp4');
  const [fps, setFps] = useState(30);
  const [imageFormat, setImageFormat] = useState<ImageSequenceFormat>('png');
  const canRemoveWatermark = subscriptionService.hasFeature('export_no_watermark');
  const maxExportResolution = subscriptionService.maxExportResolution();
  const [includeWatermark, setIncludeWatermark] = useState(!canRemoveWatermark);
  const [isExportingNow, setIsExportingNow] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const exportRunRef = useRef(false);

  const canUseResolution = useCallback(
    (res: ExportResolution) =>
      RESOLUTION_ORDER.indexOf(res) >= 0
      && RESOLUTION_ORDER.indexOf(res) <= RESOLUTION_ORDER.indexOf(maxExportResolution),
    [maxExportResolution],
  );

  // 授权档位下调时立即把水印锁回去，避免界面显示"已关闭"但实际仍受限。
  useEffect(() => {
    if (!canRemoveWatermark) setIncludeWatermark(true);
  }, [canRemoveWatermark]);

  const watermarkEnabled = includeWatermark || !canRemoveWatermark;

  /** 图片与视频共用同一套水印绘制，避免两个导出通道表现不一致。 */
  const applyFrameWatermark = useCallback((canvas: HTMLCanvasElement) => {
    if (!watermarkEnabled) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const fontSize = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
    context.save();
    context.globalAlpha = 0.16;
    context.fillStyle = '#ffffff';
    context.font = `bold ${fontSize}px Arial, "Microsoft YaHei", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 6);
    context.fillText('鲸动交互平台', 0, 0);
    context.restore();
  }, [watermarkEnabled]);

  useEffect(() => {
    if (!canUseResolution(resolution)) setResolution('1080p');
  }, [canUseResolution, resolution]);

  const stopActiveRecording = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  // 处理导出
  const handleExport = useCallback(async () => {
    if (exportRunRef.current) return;
    exportRunRef.current = true;
    setIsExportingNow(true);
    setExportProgress(0);
    setExportStage('正在验证导出权限...');
    setError(null);
    setExportResult(null);
    const abortController = new AbortController();
    exportAbortRef.current = abortController;
    let authorization: ExportAuthorization;
    try {
      authorization = await withExportTimeout(
        subscriptionService.authorizeExport(activeTab, { resolution, watermark: watermarkEnabled }), 15_000, '导出权限验证', abortController.signal,
      );
    } catch (authorizationError) {
      if (!(authorizationError instanceof DOMException && authorizationError.name === 'AbortError')) {
        setError(authorizationError instanceof Error ? authorizationError.message : '导出授权验证失败');
        onRequestActivation?.();
      }
      if (exportAbortRef.current === abortController) exportAbortRef.current = null;
      exportRunRef.current = false;
      setIsExportingNow(false);
      return;
    }
    setExportProgress(0);
    setExportStage('准备中...');
    setError(null);
    setExportResult(null);
    let restorePlayback: (() => void) | void;

    try {
      const rawRes = RESOLUTION_MAP[resolution] || RESOLUTION_MAP['1080p'];
  // 【工程级画布】输出分辨率保持画布比例（长边对齐所选分辨率档的长边）：
  // 16:9 画布 → 1920x1080；9:16 画布 → 1080x1920；1:1 画布 → 1080x1080 等，避免画面变形。
  const canvasSpec = getProjectCanvas(projectData);
  const aspect = canvasSpec.width / canvasSpec.height;
  const baseLong = Math.max(rawRes.width, rawRes.height);
  const targetRes = aspect >= 1
    ? { width: baseLong, height: Math.max(1, Math.round(baseLong / aspect)) }
    : { width: Math.max(1, Math.round(baseLong * aspect)), height: baseLong };
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const projectName = projectData.meta?.title || '鲸动交互平台工程';
      const sceneTimeline = buildExportSceneTimeline(projectData);
      if (sceneTimeline.length === 0) throw new Error('工程没有可导出的场景');
      const totalDuration = sceneTimeline[sceneTimeline.length - 1].end;
      const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));

      const exportContainer = canvasContainerRef?.current;
      if (!exportContainer) {
        throw new Error('画布容器未找到，无法导出');
      }
      const getCurrentExportTarget = () => getExportCaptureTarget(exportContainer);

      let lastExportSceneId: string | null = null;
      const ensureExportScene = async (sceneId: string) => {
        if (lastExportSceneId === sceneId) return;
        if (sceneId !== activeSceneId && !onSelectSceneForExport) {
          throw new Error('导出需要切换场景，但编辑器没有提供场景切换接口');
        }
        onSelectSceneForExport?.(sceneId);
        lastExportSceneId = sceneId;
        await waitForExportFrame(abortController.signal);
        await waitForExportFrame(abortController.signal);
        await waitForExportReadiness(getCurrentExportTarget(), { timeoutMs: 8000, signal: abortController.signal });
      };

      const resolveSceneTime = (time: number) => {
        const clampedTime = Math.max(0, Math.min(time, Math.max(0, totalDuration - 1 / fps)));
        return sceneTimeline.find((segment, index) => (
          clampedTime < segment.end || index === sceneTimeline.length - 1
        )) || sceneTimeline[sceneTimeline.length - 1];
      };

      const captureFrameAtTime = async (time: number): Promise<HTMLCanvasElement> => {
        const segment = resolveSceneTime(time);
        await ensureExportScene(segment.id);
        const localTime = Math.max(0, Math.min(segment.duration, time - segment.start));
        onSeek?.(localTime);
        await waitForExportFrame(abortController.signal);
        const exportTarget = getCurrentExportTarget();
        await waitForExportVideoFrames(exportTarget, 5000, localTime, abortController.signal);
        await waitForExportFrame(abortController.signal);
        if (abortController.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
        const result = await withExportTimeout(captureElement(getCurrentExportTarget(), {
          width: targetRes.width,
          height: targetRes.height,
          scale: 1,
          backgroundColor: activeTab === 'image' && imageFormat === 'png' ? null : '#000000',
          mutateSource: false,
          foreignObjectRendering: false,
          includeDataUrl: false,
          signal: abortController.signal,
        }), 60_000, '画面截图', abortController.signal, () => abortController.abort());
        applyFrameWatermark(result.canvas);
        const proofContext = result.canvas.getContext('2d');
        if (proofContext) applyCanvasExportProof(proofContext, targetRes.width, targetRes.height, authorization.proof);
        return result.canvas;
      };

      restorePlayback = onPrepareExport?.();
      // Pause native media playback first; then React's paused playhead can
      // seek video layers deterministically before every captured frame.
      await waitForExportFrame(abortController.signal);
      await waitForExportFrame(abortController.signal);

      if (activeTab === 'image') {
        setExportStage(`准备图片序列（${totalFrames} 帧，${fps} FPS）...`);
        setExportProgress(0.02);
        const baseName = `${projectName}_${resolution.toUpperCase()}_${fps}fps_${timestamp}`;
        const blob = await withExportTimeout(exportImageSequence({
          frameCount: totalFrames,
          fps,
          width: targetRes.width,
          height: targetRes.height,
          format: imageFormat,
          quality,
          projectName,
          signal: abortController.signal,
          renderFrame: async (frameIndex, time) => {
            try {
              const canvas = await captureFrameAtTime(time);
              setExportProgress(0.05 + ((frameIndex + 1) / totalFrames) * 0.78);
              setExportStage(`正在渲染图片 ${frameIndex + 1}/${totalFrames}（${time.toFixed(2)} 秒）`);
              return canvas;
            } catch (frameError) {
              if (frameError instanceof DOMException && frameError.name === 'AbortError') throw frameError;
              throw createExportFrameError(frameIndex, totalFrames, frameError);
            }
          },
          onProgress: (completed, total, phase, packagePercent) => {
            if (phase === 'package') {
              setExportProgress(0.83 + (packagePercent / 100) * 0.16);
              setExportStage(`正在打包图片序列 ${Math.round(packagePercent)}%`);
            } else {
              setExportStage(`正在渲染图片 ${completed}/${total}`);
            }
          },
        }), EXPORT_OPERATION_TIMEOUT_MS.image, '鍥剧墖搴忓垪瀵煎嚭', abortController.signal, () => abortController.abort());
        const filename = `${baseName}.zip`;
        downloadBlob(blob, filename);
        setExportProgress(1);
        setExportResult({
          success: true,
          format: 'image-sequence',
          filename,
          size: blob.size,
          width: targetRes.width,
          height: targetRes.height,
          duration: totalDuration * 1000,
          fps,
          frames: totalFrames,
          warnings: [],
        });
      } else if (activeTab === 'video') {
        // ========== 视频导出：逐帧截图 + WebCodecs 确定性编码 ========== 
        const exportFps = fps;
        const exportQuality = quality;
        let lastProgressUpdate = 0;

        setExportStage(`准备录制 (${totalFrames}帧 @ ${exportFps}fps)...`);
        setExportProgress(0.05);

        const bgmRefs = Array.from(new Set(sceneTimeline
          .map((segment) => projectData.scenes[segment.id]?.bgmRef)
          .filter((ref): ref is string => Boolean(ref))));
        const bgmRef = bgmRefs.length === 1 ? bgmRefs[0] : undefined;
        const exportWarnings = bgmRefs.length > 1
          ? ['多个场景使用不同 BGM，本次视频已保留画面并跳过场景音频混合']
          : [];
        const bgmBlob = bgmRef
          ? dbManager.getBlob(bgmRef) || await dbManager.get(bgmRef)
          : null;
        if (bgmRef && !bgmBlob) {
          throw new Error('场景 BGM 素材丢失，已中止视频导出');
        }

        const videoOptions = {
          width: targetRes.width,
          height: targetRes.height,
          fps: exportFps,
          durationSeconds: totalDuration,
          videoBitrate: Math.round(8000000 * exportQuality),
          signal: abortController.signal,
          captureFrame: async (frameIndex: number, time: number) => {
            try {
              const canvas = await captureFrameAtTime(time);
              applyFrameWatermark(canvas);
              const now = performance.now();
              if (frameIndex === totalFrames - 1 || now - lastProgressUpdate >= 100) {
                lastProgressUpdate = now;
                setExportProgress(0.05 + ((frameIndex + 1) / totalFrames) * 0.8);
                setExportStage(`正在捕获并编码 ${frameIndex + 1}/${totalFrames}（${time.toFixed(1)} 秒）`);
              }
              return canvas;
            } catch (frameError) {
              if (frameError instanceof DOMException && frameError.name === 'AbortError') throw frameError;
              throw createExportFrameError(frameIndex, totalFrames, frameError);
            }
          },
          onPhase: (phase: 'finalizing-video' | 'encoding-audio' | 'muxing') => {
            if (phase === 'finalizing-video') {
              setExportProgress(0.88);
              setExportStage('正在排空视频编码队列...');
            } else if (phase === 'encoding-audio') {
              setExportProgress(0.91);
              setExportStage(bgmBlob ? '正在编码音频...' : '正在准备封装...');
            } else {
              setExportProgress(0.95);
              setExportStage('正在封装视频文件...');
            }
          },
        };
        const audioSource = bgmBlob
          ? { blob: bgmBlob, volume: projectData.scenes[sceneTimeline[0].id]?.bgmVolume ?? 1 }
          : undefined;
        const videoBlob = videoContainer === 'mp4'
          ? await withExportTimeout(encodeDeterministicMp4({ ...videoOptions, audio: audioSource }), EXPORT_OPERATION_TIMEOUT_MS.video, '视频导出', abortController.signal, () => abortController.abort())
          : await withExportTimeout(encodeDeterministicWebm({
            ...videoOptions,
            audio: audioSource,
          }), EXPORT_OPERATION_TIMEOUT_MS.video, '视频导出', abortController.signal, () => abortController.abort());

        setExportProgress(0.98);
        setExportStage('生成视频文件...');
        const filename = `${projectName}_${resolution.toUpperCase()}_${exportFps}fps_${timestamp}.${videoContainer}`;
        downloadBlob(videoBlob, filename);

        setExportResult({
          success: true,
          format: videoContainer,
          filename,
          size: videoBlob.size,
          width: targetRes.width,
          height: targetRes.height,
          duration: totalDuration * 1000,
          fps: exportFps,
          frames: totalFrames,
          warnings: exportWarnings,
        });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (exportAbortRef.current === abortController) exportAbortRef.current = null;
      if (typeof restorePlayback === 'function') restorePlayback();
      onSeek?.(currentTime);
      exportRunRef.current = false;
      setIsExportingNow(false);
    }
  }, [activeTab, resolution, quality, fps, imageFormat, watermarkEnabled, applyFrameWatermark, projectData, activeSceneId, canvasContainerRef, currentTime, onSeek, onSelectSceneForExport, onPrepareExport, onRequestActivation, onRequestStandardExport]);

  // 取消导出
  const handleCancel = useCallback(() => {
    stopActiveRecording();
    setExportStage('正在取消导出...');
  }, [stopActiveRecording]);

  // 关闭弹窗
  const handleClose = useCallback(() => {
    if (isExportingNow) {
      handleCancel();
      return;
    }
    setExportResult(null);
    setError(null);
    onClose();
  }, [isExportingNow, handleCancel, onClose]);

  useEffect(() => {
    if (!isOpen || isExportingNow) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExportingNow, handleClose]);

  // 所有hooks必须在早期返回之前调用
  if (!isOpen) return null;

  const tabs: Array<{ id: ExportTab; label: string; icon: React.ReactNode }> = [
    { id: 'image', label: '图片序列', icon: <Image size={16} /> },
    { id: 'video', label: '视频', icon: <Video size={16} /> },
  ];
  const exportSceneTimeline = buildExportSceneTimeline(projectData);
  const totalProjectDuration = exportSceneTimeline[exportSceneTimeline.length - 1]?.end || 0;
  const plannedImageFrames = Math.max(1, Math.ceil(totalProjectDuration * fps));

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" role="presentation">
      <div className="w-full max-w-2xl bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="advanced-export-title">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Download size={18} className="text-white" />
            </div>
            <div>
              <h2 id="advanced-export-title" className="text-lg font-semibold text-white">高级导出</h2>
              <p className="text-xs text-slate-500">P2 导出 · 图片序列 / 视频</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="关闭高级导出窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex gap-1 px-5 pt-4 border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              disabled={isExportingNow}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-cyan-300 bg-cyan-500/10 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              } ${isExportingNow ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {/* 导出设置 */}
          <div className="space-y-4">
            {/* 分辨率 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                分辨率
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['720p', '1080p', '2k', '4k'] as ExportResolution[]).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResolution(res)}
                    disabled={isExportingNow || !canUseResolution(res)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      resolution === res
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
                    } ${isExportingNow || !canUseResolution(res) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {res.toUpperCase()}
                    {!canUseResolution(res) && <Crown size={10} className="inline ml-1 text-amber-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 视频专属设置 */}
            {activeTab === 'image' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">图片格式</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['png', 'jpg'] as const).map((format) => (
                      <button key={format} type="button" onClick={() => setImageFormat(format)} disabled={isExportingNow}
                        aria-pressed={imageFormat === format}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${imageFormat === format ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'}`}>
                        {format.toUpperCase()} {format === 'png' ? '无损透明' : '体积更小'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">序列帧率</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[24, 30, 60].map((value) => (
                      <button key={value} type="button" onClick={() => setFps(value)} disabled={isExportingNow} aria-pressed={fps === value}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${fps === value ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'}`}>
                        {value} FPS
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">全部场景·{totalProjectDuration.toFixed(1)} 秒·约 {plannedImageFrames} 帧；导出为含编号帧图和序列信息的 ZIP</p>
                </div>
              </>
            )}

            {activeTab === 'video' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    封装格式
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['mp4', 'webm'] as const).map((container) => (
                      <button
                        key={container}
                        type="button"
                        onClick={() => setVideoContainer(container)}
                        disabled={isExportingNow}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                          videoContainer === container
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
                        } ${isExportingNow ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {container.toUpperCase()}
                        <span className="mt-0.5 block text-[10px] font-normal opacity-70">
                          {container === 'mp4' ? 'H.264 · 通用剪辑' : 'VP9 · 支持 BGM'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {videoContainer === 'mp4' && (
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      MP4（H.264 + AAC）适合后续剪辑；WebM 体积更小、浏览器直接播放更稳。
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    帧率 (FPS)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[24, 30, 60].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFps(f)}
                        disabled={isExportingNow}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          fps === f
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
                        } ${isExportingNow ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {f} FPS
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    全部场景 · {totalProjectDuration.toFixed(1)} 秒 · 约 {Math.ceil(totalProjectDuration * fps)} 帧
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">音频</span>
                    <span className="shrink-0 text-xs text-emerald-300">
                      {advancedVideoExportCapabilities.audioStatusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {advancedVideoExportCapabilities.audioStatusDescription}
                  </p>
                </div>
              </>
            )}

            {/* 输出选项 */}
            {(activeTab === 'video' || imageFormat === 'jpg') && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  画质: {Math.round(quality * 100)}%
                </label>
                <input type="range" min="0.5" max="1" step="0.02" value={quality}
                  onChange={(event) => setQuality(parseFloat(event.target.value))} disabled={isExportingNow}
                  aria-label="画质"
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div>
                <p className="text-sm text-slate-200">单文件 HTML / ZIP 工程</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">这些是工程导出，与帧图或视频不同，请在普通导出中选择。</p>
              </div>
              <button type="button" onClick={() => { onClose(); onRequestStandardExport?.(); }} disabled={isExportingNow}
                className="shrink-0 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50">
                <FileArchive size={15} />普通导出
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-slate-400" />
                <span className="text-sm text-slate-300">导出水印</span>
                {!canRemoveWatermark && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    当前授权强制
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => canRemoveWatermark && setIncludeWatermark(!includeWatermark)}
                disabled={isExportingNow || !canRemoveWatermark}
                aria-label="切换导出水印"
                aria-pressed={watermarkEnabled}
                className={`w-11 h-6 rounded-full transition-colors ${
                  watermarkEnabled ? 'bg-cyan-500' : 'bg-white/20'
                } ${isExportingNow || !canRemoveWatermark ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  watermarkEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* 导出进度 */}
          {isExportingNow && (
            <div className="mt-5 p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                  {exportStage}
                </span>
                <span className="text-sm text-cyan-300 font-mono">
                  {Math.round(exportProgress * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(exportProgress * 100)} aria-label="导出进度">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${exportProgress * 100}%` }}
                />
              </div>
              <button
                  type="button"
                  onClick={handleCancel}
                  disabled={exportStage === '正在取消导出...'}
                  className="mt-3 text-sm text-rose-400 hover:text-rose-300 disabled:opacity-50 disabled:cursor-wait"
                >
                  {exportStage === '正在取消导出...' ? '正在取消...' : '取消导出'}
                </button>
            </div>
          )}

          {/* 导出结果 */}
          {exportResult && !isExportingNow && (
            <div className="mt-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Check size={18} className="text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">导出成功</span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                {exportResult.frames && <div>{exportResult.frames} 帧 · {exportResult.fps} FPS</div>}
                <div>文件名: {exportResult.filename}</div>
                <div>文件大小: {formatFileSize(exportResult.size)}</div>
                {exportResult.duration && (
                  <div>耗时: {formatDuration(exportResult.duration)}</div>
                )}
                {exportResult.width && exportResult.height && (
                  <div>分辨率: {exportResult.width} × {exportResult.height}</div>
                )}
              </div>
            </div>
          )}

          {/* 错误 */}
          {error && !isExportingNow && (
            <div role="alert" className="mt-5 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-rose-400" />
                <span className="text-sm text-rose-300">导出失败</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="text-xs text-slate-500">
            当前计划: <span className={isPaid ? 'text-cyan-400' : 'text-slate-400'}>{plan}</span>
            {!isPaid && (
              <span className="ml-2 text-amber-400">升级专业版可解锁4K/无水印</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExportingNow}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {isExportingNow ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download size={16} />
                  开始导出
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
