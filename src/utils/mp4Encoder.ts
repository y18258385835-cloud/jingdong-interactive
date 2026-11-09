import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { withExportTimeout } from './exportAsync';

/** MP4（H.264 + AAC）导出器：与 webmEncoder 相同的逐帧捕获流程。 */
export interface Mp4AudioSource {
  blob: Blob;
  volume: number;
}

export interface EncodeMp4Options {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  videoBitrate: number;
  signal: AbortSignal;
  audio?: Mp4AudioSource;
  captureFrame: (frameIndex: number, time: number) => Promise<HTMLCanvasElement>;
  onPhase?: (phase: 'finalizing-video' | 'encoding-audio' | 'muxing') => void;
}

interface EncodedVideoPacket {
  kind: 'video';
  chunk: EncodedVideoChunk;
  metadata?: EncodedVideoChunkMetadata;
}

interface EncodedAudioPacket {
  kind: 'audio';
  chunk: EncodedAudioChunk;
  metadata?: EncodedAudioChunkMetadata;
}

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
};

async function yieldToMainThread(signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  throwIfAborted(signal);
}

async function flushVideoEncoder(encoder: VideoEncoder, signal: AbortSignal, label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const abortHandler = () => reject(new DOMException('Export cancelled', 'AbortError'));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abortHandler);
      reject(new Error(`${label}超时`));
    }, 30_000);
    signal.addEventListener('abort', abortHandler, { once: true });
    encoder.flush()
      .then(() => { clearTimeout(timer); signal.removeEventListener('abort', abortHandler); resolve(); })
      .catch((error) => { clearTimeout(timer); signal.removeEventListener('abort', abortHandler); reject(error); });
  });
}

async function selectAvcConfig(width: number, height: number, fps: number, bitrate: number): Promise<VideoEncoderConfig> {
  const candidates: VideoEncoderConfig[] = [
    { codec: 'avc1.42001f', width, height, bitrate, framerate: fps, avc: { format: 'avc' } },
    { codec: 'avc1.4d002a', width, height, bitrate, framerate: fps, avc: { format: 'avc' } },
    { codec: 'avc1.640033', width, height, bitrate, framerate: fps, avc: { format: 'avc' } },
  ];
  for (const candidate of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported(candidate);
      if (support.supported) return candidate;
    } catch { /* try next */ }
  }
  throw new Error('当前浏览器不支持 H.264 视频编码，请改用 WebM 导出或使用最新版 Chrome/Edge');
}

async function renderLoopedAudio(
  sourceBlob: Blob,
  durationSeconds: number,
  volume: number,
  signal: AbortSignal,
): Promise<AudioBuffer> {
  const context = new AudioContext();
  try {
    const audioBytes = await withExportTimeout(sourceBlob.arrayBuffer(), 30_000, 'BGM 文件读取', signal);
    const decoded = await withExportTimeout(context.decodeAudioData(audioBytes), 60_000, 'BGM 解码', signal);
    if (!decoded.duration) throw new Error('场景 BGM 时长无效');

    const sampleRate = 48_000;
    const channels = Math.max(1, Math.min(2, decoded.numberOfChannels));
    const frameCount = Math.max(1, Math.ceil(durationSeconds * sampleRate));
    const offline = new OfflineAudioContext(channels, frameCount, sampleRate);
    const source = offline.createBufferSource();
    const gain = offline.createGain();
    source.buffer = decoded;
    source.loop = true;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(offline.destination);
    source.start(0);
    return await withExportTimeout(offline.startRendering(), 120_000, 'BGM 音频处理', signal);
  } finally {
    await context.close();
  }
}

async function encodeAacAudio(
  source: Mp4AudioSource,
  durationSeconds: number,
  signal: AbortSignal,
): Promise<{ packets: EncodedAudioPacket[]; sampleRate: number; numberOfChannels: number }> {
  const rendered = await renderLoopedAudio(source.blob, durationSeconds, source.volume, signal);
  throwIfAborted(signal);

  const config: AudioEncoderConfig = {
    codec: 'mp4a.40.2',
    sampleRate: rendered.sampleRate,
    numberOfChannels: rendered.numberOfChannels,
    bitrate: 128_000,
  };
  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) throw new Error('当前浏览器不支持 AAC 音频编码，请改用 WebM 导出');

  const packets: EncodedAudioPacket[] = [];
  let encoderError: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => packets.push({ kind: 'audio', chunk, metadata }),
    error: (error) => { encoderError = error; },
  });

  try {
    encoder.configure(config);
    const packetFrames = 960;
    for (let offset = 0; offset < rendered.length; offset += packetFrames) {
      throwIfAborted(signal);
      const numberOfFrames = Math.min(packetFrames, rendered.length - offset);
      const data = new Float32Array(numberOfFrames * rendered.numberOfChannels);
      for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
        data.set(
          rendered.getChannelData(channel).subarray(offset, offset + numberOfFrames),
          channel * numberOfFrames,
        );
      }
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: rendered.sampleRate,
        numberOfFrames,
        numberOfChannels: rendered.numberOfChannels,
        timestamp: Math.round(offset * 1_000_000 / rendered.sampleRate),
        data,
      });
      encoder.encode(audioData);
      audioData.close();
      if (encoder.encodeQueueSize >= 32) {
        await flushVideoEncoder(encoder as unknown as VideoEncoder, signal, '音频编码器响应');
        await yieldToMainThread(signal);
      }
    }
    await flushVideoEncoder(encoder as unknown as VideoEncoder, signal, '音频编码器响应');
    if (encoderError) throw encoderError;
    return {
      packets,
      sampleRate: rendered.sampleRate,
      numberOfChannels: rendered.numberOfChannels,
    };
  } finally {
    encoder.close();
  }
}

export async function encodeDeterministicMp4(options: EncodeMp4Options): Promise<Blob> {
  if (!('VideoEncoder' in window) || !('VideoFrame' in window)) {
    throw new Error('当前浏览器不支持 WebCodecs 视频编码，请使用最新版 Chrome 或 Edge');
  }
  if (options.audio && (!('AudioEncoder' in window) || !('AudioData' in window))) {
    throw new Error('当前浏览器不支持 WebCodecs 音频编码，请使用最新版 Chrome 或 Edge');
  }

  const config = await selectAvcConfig(options.width, options.height, options.fps, options.videoBitrate);
  const videoPackets: EncodedVideoPacket[] = [];
  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => videoPackets.push({ kind: 'video', chunk, metadata }),
    error: (error) => { encoderError = error; },
  });

  try {
    videoEncoder.configure(config);
    const totalFrames = Math.ceil(options.durationSeconds * options.fps);
    const frameDuration = Math.round(1_000_000 / options.fps);
    await yieldToMainThread(options.signal);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      throwIfAborted(options.signal);
      const canvas = await options.captureFrame(frameIndex, frameIndex / options.fps);
      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
      });
      videoEncoder.encode(frame, { keyFrame: frameIndex % Math.max(1, options.fps * 2) === 0 });
      frame.close();
      if (videoEncoder.encodeQueueSize >= 8) {
        await flushVideoEncoder(videoEncoder, options.signal, '视频编码器响应');
      }
      await yieldToMainThread(options.signal);
    }

    options.onPhase?.('finalizing-video');
    await flushVideoEncoder(videoEncoder, options.signal, '视频编码器响应');
    if (encoderError) throw encoderError;
    if (videoPackets.length !== totalFrames) {
      throw new Error(`视频帧编码不完整（应有 ${totalFrames} 帧，实际 ${videoPackets.length} 帧），已取消生成文件`);
    }
  } finally {
    videoEncoder.close();
  }

  options.onPhase?.('encoding-audio');
  const audioResult = options.audio
    ? await encodeAacAudio(options.audio, options.durationSeconds, options.signal)
    : null;
  throwIfAborted(options.signal);
  options.onPhase?.('muxing');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: options.width,
      height: options.height,
      frameRate: options.fps,
    },
    ...(audioResult ? {
      audio: {
        codec: 'aac',
        sampleRate: audioResult.sampleRate,
        numberOfChannels: audioResult.numberOfChannels,
      },
    } : {}),
    fastStart: 'in-memory',
  });

  const packets: Array<EncodedVideoPacket | EncodedAudioPacket> = [
    ...videoPackets,
    ...(audioResult?.packets || []),
  ].sort((a, b) => a.chunk.timestamp - b.chunk.timestamp || (a.kind === 'video' ? -1 : 1));

  for (let index = 0; index < packets.length; index += 1) {
    const packet = packets[index];
    if (packet.kind === 'video') muxer.addVideoChunk(packet.chunk, packet.metadata);
    else muxer.addAudioChunk(packet.chunk, packet.metadata);
    if (index > 0 && index % 120 === 0) await yieldToMainThread(options.signal);
  }
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  if (blob.size <= 0) throw new Error('视频封装结果为空，未生成文件');
  return blob;
}
