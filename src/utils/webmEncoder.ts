import { ArrayBufferTarget, Muxer } from 'webm-muxer';
import { withExportTimeout } from './exportAsync';

interface ExportAudioSource {
  blob: Blob;
  volume: number;
}

interface EncodeWebmOptions {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  videoBitrate: number;
  audio?: ExportAudioSource;
  signal: AbortSignal;
  captureFrame: (frameIndex: number, timeSeconds: number) => Promise<HTMLCanvasElement>;
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

type EncodedPacket = EncodedVideoPacket | EncodedAudioPacket;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

async function flushEncoder(
  encoder: VideoEncoder | AudioEncoder,
  signal: AbortSignal,
  label: string,
  timeoutMs = 30_000,
): Promise<void> {
  throwIfAborted(signal);
  let timer = 0;
  let abortHandler: (() => void) | undefined;
  try {
    await Promise.race([
      encoder.flush(),
      new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label}超时，请降低分辨率或帧率后重试`)), timeoutMs);
        abortHandler = () => reject(new DOMException('Export cancelled', 'AbortError'));
        signal.addEventListener('abort', abortHandler, { once: true });
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
    if (abortHandler) signal.removeEventListener('abort', abortHandler);
  }
  throwIfAborted(signal);
}

async function yieldToMainThread(signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  throwIfAborted(signal);
}

async function selectVideoConfig(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
  signal: AbortSignal,
): Promise<{ config: VideoEncoderConfig; muxerCodec: string }> {
  const candidates: Array<{ config: VideoEncoderConfig; muxerCodec: string }> = [
    {
      config: { codec: 'vp09.00.10.08', width, height, framerate: fps, bitrate, latencyMode: 'quality' },
      muxerCodec: 'V_VP9',
    },
    {
      config: { codec: 'vp8', width, height, framerate: fps, bitrate, latencyMode: 'quality' },
      muxerCodec: 'V_VP8',
    },
  ];

  for (const candidate of candidates) {
    const support = await withExportTimeout(
      VideoEncoder.isConfigSupported(candidate.config),
      15_000,
      '视频编码器能力检测',
      signal,
    );
    if (support.supported) return candidate;
  }
  throw new Error('当前浏览器不支持 VP9 或 VP8 WebCodecs 视频编码');
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

async function encodeAudio(
  source: ExportAudioSource,
  durationSeconds: number,
  signal: AbortSignal,
): Promise<{ packets: EncodedAudioPacket[]; sampleRate: number; numberOfChannels: number }> {
  const rendered = await renderLoopedAudio(source.blob, durationSeconds, source.volume, signal);
  throwIfAborted(signal);

  const config: AudioEncoderConfig = {
    codec: 'opus',
    sampleRate: rendered.sampleRate,
    numberOfChannels: rendered.numberOfChannels,
    bitrate: 128_000,
  };
  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) throw new Error('当前浏览器不支持 Opus WebCodecs 音频编码');

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
        await flushEncoder(encoder, signal, '音频编码器响应');
        await yieldToMainThread(signal);
      }
    }
    await flushEncoder(encoder, signal, '音频编码器响应');
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

export async function encodeDeterministicWebm(options: EncodeWebmOptions): Promise<Blob> {
  if (!('VideoEncoder' in window) || !('VideoFrame' in window)) {
    throw new Error('当前浏览器不支持 WebCodecs 视频编码，请使用最新版 Chrome 或 Edge');
  }
  if (options.audio && (!('AudioEncoder' in window) || !('AudioData' in window))) {
    throw new Error('当前浏览器不支持 WebCodecs 音频编码，请使用最新版 Chrome 或 Edge');
  }

  const { config, muxerCodec } = await selectVideoConfig(
    options.width,
    options.height,
    options.fps,
    options.videoBitrate,
    options.signal,
  );
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
      if (options.signal.aborted) {
        throwIfAborted(options.signal);
      }
      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
        alpha: 'discard',
      });
      videoEncoder.encode(frame, { keyFrame: frameIndex % Math.max(1, options.fps * 2) === 0 });
      frame.close();
      // VideoEncoder consumes frames asynchronously. Resizing the source
      // canvas here can clear pixels before the encoder has read them,
      // producing black video while the encode still reports progress.
      if (videoEncoder.encodeQueueSize >= 8) {
        await flushEncoder(videoEncoder, options.signal, '视频编码器响应');
      }
      await yieldToMainThread(options.signal);
    }
    options.onPhase?.('finalizing-video');
    await flushEncoder(videoEncoder, options.signal, '视频编码器响应');
    if (encoderError) throw encoderError;
    if (videoPackets.length !== totalFrames) {
      throw new Error(`视频帧编码不完整（应有 ${totalFrames} 帧，实际 ${videoPackets.length} 帧），已取消生成文件`);
    }
  } finally {
    videoEncoder.close();
  }

  options.onPhase?.('encoding-audio');
  const audioResult = options.audio
    ? await encodeAudio(options.audio, options.durationSeconds, options.signal)
    : null;
  throwIfAborted(options.signal);
  options.onPhase?.('muxing');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: muxerCodec,
      width: options.width,
      height: options.height,
      frameRate: options.fps,
    },
    ...(audioResult ? {
      audio: {
        codec: 'A_OPUS',
        sampleRate: audioResult.sampleRate,
        numberOfChannels: audioResult.numberOfChannels,
      },
    } : {}),
    firstTimestampBehavior: 'strict',
  });

  const packets: EncodedPacket[] = [
    ...videoPackets,
    ...(audioResult?.packets || []),
  ].sort((a, b) => a.chunk.timestamp - b.chunk.timestamp || (a.kind === 'video' ? -1 : 1));

  for (let packetIndex = 0; packetIndex < packets.length; packetIndex += 1) {
    const packet = packets[packetIndex];
    if (packet.kind === 'video') muxer.addVideoChunk(packet.chunk, packet.metadata);
    else muxer.addAudioChunk(packet.chunk, packet.metadata);
    if (packetIndex > 0 && packetIndex % 100 === 0) await yieldToMainThread(options.signal);
  }
  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/webm' });
  if (blob.size <= 0) throw new Error('视频封装结果为空，未生成文件');
  return blob;
}
