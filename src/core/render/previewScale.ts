export function getContainPreviewScale(params: {
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  maxScale?: number;
}): number {
  const {
    contentWidth,
    contentHeight,
    viewportWidth,
    viewportHeight,
    maxScale = 1,
  } = params;

  if (
    !Number.isFinite(contentWidth) || contentWidth <= 0 ||
    !Number.isFinite(contentHeight) || contentHeight <= 0 ||
    !Number.isFinite(viewportWidth) || viewportWidth <= 0 ||
    !Number.isFinite(viewportHeight) || viewportHeight <= 0
  ) {
    return Math.max(0, maxScale);
  }

  return Math.max(0, Math.min(maxScale, viewportWidth / contentWidth, viewportHeight / contentHeight));
}
