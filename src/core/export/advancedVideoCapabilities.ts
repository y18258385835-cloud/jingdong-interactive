export const advancedVideoExportCapabilities = {
  includesAudio: true,
  audioStatusLabel: '已支持场景 BGM',
  audioStatusDescription: '导出时独立解码场景 BGM，按场景时长循环并混入视频。',
} as const;

export function createExportFrameError(frameIndex: number, totalFrames: number, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`第 ${frameIndex + 1}/${totalFrames} 帧截取失败，已中止导出：${detail}`);
}
