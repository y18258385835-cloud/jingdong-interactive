import { ArrayBufferTarget, Muxer } from 'webm-muxer';
import type { ProjectData, SceneElement } from '../types';
import { getProjectCanvas } from './canvas';
import { replaceProjectAssetReferences } from '../core/project/assetReferences';

export interface VideoPlaybackProxyPlan {
  reference: string;
  maxConcurrentLayers: number;
  maxDisplayDimension: number;
}

/** Keep the editable/reimport project pristine and rewrite only player refs. */
export function createPlaybackProject(
  project: ProjectData,
  replacements: ReadonlyMap<string, string>,
): ProjectData {
  const playbackProject = JSON.parse(JSON.stringify(project)) as ProjectData;
  return replaceProjectAssetReferences(playbackProject, replacements);
}

const VIDEO_REFERENCE_KEYS = new Set(['bgRef', 'bgmRef', 'refId', 'mediaRefId', 'assetRefId', 'assetRef', 'iconVideoRefId']);
// Proxy generation is optional. Keep it short so exports never appear frozen
// while decoding a long source clip in real time; longer clips keep the
// original asset and still export normally.
const MAX_TRANSCODE_DURATION_SECONDS = 6;
const DISPLAY_OVERSAMPLE = 2.5;
const PROXY_MAX_WIDTH = 720;

function evenDimension(value: number): number {
  return Math.max(2, Math.ceil(value / 2) * 2);
}

function countReferenceOccurrences(value: unknown, counts: Map<string, number>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => countReferenceOccurrences(item, counts));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && VIDEO_REFERENCE_KEYS.has(key) && child.trim()) {
      counts.set(child, (counts.get(child) || 0) + 1);
    } else {
      countReferenceOccurrences(child, counts);
    }
  }
}

function collectNestedVideoReferences(elements: SceneElement[], result: Set<string>): void {
  elements.forEach((element) => {
    if (element.type === 'vid' && element.refId) result.add(element.refId);
    if (element.children?.length) collectNestedVideoReferences(element.children, result);
  });
}

function maxConcurrentIntervals(elements: SceneElement[]): number {
  const events: Array<{ time: number; delta: number }> = [];
  elements.forEach((element) => {
    const start = Math.max(0, Number(element.startTime) || 0);
    const duration = Math.max(0, Number(element.duration) || 0);
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return;
    events.push({ time: start, delta: 1 }, { time: start + duration, delta: -1 });
  });
  // End an interval before starting another at the same time; adjacent clips
  // do not decode concurrently at the boundary.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0;
  let maximum = 0;
  events.forEach((event) => {
    active += event.delta;
    maximum = Math.max(maximum, active);
  });
  return maximum;
}

/**
 * Find repeated muted top-level video layers that overlap and render much
 * smaller than their source. Their source files stay untouched for reimport;
 * the standalone ZIP player can use a viewport-sized decode proxy instead.
 */
export function planVideoPlaybackProxies(project: ProjectData): VideoPlaybackProxyPlan[] {
  const canvas = getProjectCanvas(project);
  const perReference = new Map<string, { uses: SceneElement[]; maxDisplayDimension: number; ineligible: boolean; maxConcurrent: number }>();
  const nestedReferences = new Set<string>();

  Object.values(project.scenes || {}).forEach((scene) => {
    const byReference = new Map<string, SceneElement[]>();
    (scene.els || []).forEach((element) => {
      if (element.type !== 'vid' || !element.refId || element.visible === false) return;
      const entry = perReference.get(element.refId) || {
        uses: [], maxDisplayDimension: 0, ineligible: false, maxConcurrent: 0,
      };
      entry.uses.push(element);
      entry.maxDisplayDimension = Math.max(
        entry.maxDisplayDimension,
        Math.abs(element.w / 100 * canvas.width),
        Math.abs(element.h / 100 * canvas.height),
      );
      if (element.muted === false || element.vidMode === 'click') entry.ineligible = true;
      perReference.set(element.refId, entry);
      const sceneUses = byReference.get(element.refId) || [];
      sceneUses.push(element);
      byReference.set(element.refId, sceneUses);
    });
    byReference.forEach((elements, reference) => {
      const entry = perReference.get(reference)!;
      entry.maxConcurrent = Math.max(entry.maxConcurrent, maxConcurrentIntervals(elements));
    });
    (scene.els || []).forEach((element) => {
      if (element.children?.length) collectNestedVideoReferences(element.children, nestedReferences);
    });
    if (scene.bgRef) nestedReferences.add(scene.bgRef);
  });

  const referenceCounts = new Map<string, number>();
  countReferenceOccurrences(project, referenceCounts);

  return Array.from(perReference, ([reference, entry]) => {
    if (nestedReferences.has(reference)) entry.ineligible = true;
    // Exclude references also used by component data, popup media, audio, or
    // another non-layer field; their intended presentation size is unknown.
    if ((referenceCounts.get(reference) || 0) > entry.uses.length) entry.ineligible = true;
    if (entry.ineligible || entry.maxConcurrent < 3 || entry.uses.length < 3) return null;
    // Only proxy when the largest layer is genuinely small on the project
    // canvas. Full-screen and near-full-screen videos retain their source.
    if (entry.maxDisplayDimension > Math.min(canvas.width, canvas.height) * 0.22) return null;
    return { reference, maxConcurrentLayers: entry.maxConcurrent, maxDisplayDimension: entry.maxDisplayDimension };
  }).filter((plan): plan is VideoPlaybackProxyPlan => Boolean(plan));
}

function waitForEvent(target: EventTarget, successEvent: string, errorEvent: string, timeoutMs?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = timeoutMs === undefined ? undefined : window.setTimeout(
      () => onError(new Error(`Timed out waiting for ${successEvent}.`)),
      timeoutMs,
    );
    const cleanup = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      target.removeEventListener(successEvent, onSuccess);
      target.removeEventListener(errorEvent, onError);
    };
    const onSuccess = () => { cleanup(); resolve(); };
    const onError = (event?: Event | Error) => {
      cleanup();
      reject(event instanceof Error ? event : new Error(`Video playback proxy failed while waiting for ${successEvent}.`));
    };
    target.addEventListener(successEvent, onSuccess, { once: true });
    target.addEventListener(errorEvent, onError, { once: true });
  });
}

/** Transcode one short video to a WebM decode proxy sized for its render area. */
export async function createVideoPlaybackProxy(
  source: Blob,
  maxDisplayDimension: number,
): Promise<Blob | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined'
    || !('VideoEncoder' in window) || !('VideoFrame' in window)) return null;

  const url = URL.createObjectURL(source);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  let encoder: VideoEncoder | null = null;
  let frameCallbackId: number | null = null;
  let cancelled = false;

  try {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      // Cached/local assets can be ready before the event listener is attached.
    } else {
      await waitForEvent(video, 'loadedmetadata', 'error', 8_000);
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > MAX_TRANSCODE_DURATION_SECONDS
      || video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const proxyWidth = Math.min(video.videoWidth, PROXY_MAX_WIDTH, evenDimension(maxDisplayDimension * DISPLAY_OVERSAMPLE));
    const proxyHeight = Math.min(video.videoHeight, evenDimension(proxyWidth * video.videoHeight / video.videoWidth));
    if (proxyWidth >= video.videoWidth * 0.8 || proxyHeight >= video.videoHeight * 0.8) return null;

    const width = evenDimension(proxyWidth);
    const height = evenDimension(proxyHeight);
    const fps = 30;
    const bitrate = Math.max(220_000, Math.min(1_200_000, Math.round(width * height * fps * 0.055)));
    const candidates: Array<{ config: VideoEncoderConfig; codec: 'V_VP9' | 'V_VP8' }> = [
      { config: { codec: 'vp09.00.10.08', width, height, framerate: fps, bitrate, latencyMode: 'quality' }, codec: 'V_VP9' },
      { config: { codec: 'vp8', width, height, framerate: fps, bitrate, latencyMode: 'quality' }, codec: 'V_VP8' },
    ];
    let selected: typeof candidates[number] | undefined;
    for (const candidate of candidates) {
      const support = await VideoEncoder.isConfigSupported(candidate.config);
      if (support.supported) { selected = candidate; break; }
    }
    if (!selected) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: selected.codec, width, height, frameRate: fps },
      firstTimestampBehavior: 'strict',
    });
    let encoderError: Error | null = null;
    encoder = new VideoEncoder({
      output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
      error: (error) => { encoderError = error; },
    });
    encoder.configure(selected.config);

    let frameIndex = 0;
    let lastTimestamp = -1;
    await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => fail(new Error('Video playback proxy capture timed out.')), 8_000);
        const finish = () => { window.clearTimeout(timeout); resolve(); };
        const fail = (error: unknown) => { window.clearTimeout(timeout); reject(error instanceof Error ? error : new Error(String(error))); };
        const handleFrame = async (_now: number, metadata: VideoFrameCallbackMetadata) => {
          if (cancelled) { fail(new Error('Video playback proxy capture timed out.')); return; }
          if (video.ended) { finish(); return; }
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              context.drawImage(video, 0, 0, width, height);
              let timestamp = Math.max(0, Math.round(metadata.mediaTime * 1_000_000));
              if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
              const frame = new VideoFrame(canvas, { timestamp, duration: Math.round(1_000_000 / fps) });
              encoder!.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
              frame.close();
              frameIndex += 1;
              lastTimestamp = timestamp;
              if (encoder!.encodeQueueSize >= 24) {
                video.pause();
                await encoder!.flush();
                if (!video.ended) await video.play();
              }
            } catch (error) {
              fail(error);
              return;
            }
          }
          if (!video.ended) frameCallbackId = video.requestVideoFrameCallback(handleFrame);
          else finish();
        };
        video.addEventListener('ended', finish, { once: true });
        video.addEventListener('error', () => fail(new Error('Source video could not be decoded for the playback proxy.')), { once: true });
        frameCallbackId = video.requestVideoFrameCallback(handleFrame);
        void video.play().catch(fail);
    });

    if (encoderError) throw encoderError;
    // WebM muxers derive the segment duration from the final encoded frame's
    // timestamp. VideoFrame callbacks stop at the last decoded source frame,
    // which can be noticeably earlier than the media duration (especially
    // when the source duration is not an exact multiple of the frame rate).
    // Add a duplicate terminal frame at the source duration so looping proxy
    // playback does not accumulate timing drift against the original asset.
    const sourceDurationUs = Math.round(video.duration * 1_000_000);
    if (lastTimestamp < sourceDurationUs) {
      const terminalFrame = new VideoFrame(canvas, { timestamp: sourceDurationUs });
      encoder.encode(terminalFrame);
      terminalFrame.close();
    }
    await encoder.flush();
    if (encoderError || frameIndex < 2) return null;
    muxer.finalize();
    return new Blob([target.buffer], { type: 'video/webm' });
  } finally {
    cancelled = true;
    if (frameCallbackId !== null) video.cancelVideoFrameCallback(frameCallbackId);
    if (encoder && encoder.state !== 'closed') encoder.close();
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
