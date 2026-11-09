export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | string;

export function isAspectRatioResizeLocked(lockAspectRatio?: boolean): boolean {
  return lockAspectRatio === true;
}

export function getBoundsAspectRatio(width: number, height: number, canvasWidth: number, canvasHeight: number): number {
  const physicalAspect = (width * canvasWidth) / Math.max(0.1, height * canvasHeight);
  return Number.isFinite(physicalAspect) && physicalAspect > 0 ? physicalAspect : 1;
}

export function resizeBoundsWithAspect(params: {
  width: number;
  height: number;
  editedDimension: 'width' | 'height';
  aspectRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  minDimension?: number;
}): { width: number; height: number } {
  const { editedDimension, canvasWidth, canvasHeight } = params;
  const minDimension = params.minDimension ?? 1;
  const aspectRatio = Number.isFinite(params.aspectRatio) && params.aspectRatio > 0 ? params.aspectRatio : 1;
  const width = Math.max(minDimension, params.width);
  const height = Math.max(minDimension, params.height);
  if (editedDimension === 'width') {
    return {
      width,
      height: Math.max(minDimension, Math.round((width * canvasWidth / aspectRatio / canvasHeight) * 10) / 10),
    };
  }
  return {
    width: Math.max(minDimension, Math.round((height * canvasHeight * aspectRatio / canvasWidth) * 10) / 10),
    height,
  };
}

export function resizeRectWithAspect(params: {
  x: number;
  y: number;
  width: number;
  height: number;
  deltaX: number;
  deltaY: number;
  handle: ResizeHandle;
  aspectRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  minDimension?: number;
}): { x: number; y: number; width: number; height: number } {
  const {
    x, y, width, height, deltaX, deltaY, handle,
    canvasWidth, canvasHeight,
  } = params;
  const minDimension = params.minDimension ?? 1;
  const aspectRatio = Number.isFinite(params.aspectRatio) && params.aspectRatio > 0 ? params.aspectRatio : 1;
  const widthPerHeight = aspectRatio * canvasHeight / Math.max(0.1, canvasWidth);
  const hasE = handle.includes('e');
  const hasW = handle.includes('w');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');
  const isHorizontal = hasE || hasW;
  const isVertical = hasN || hasS;
  const isCorner = isHorizontal && isVertical;

  let nextWidth: number;
  let nextHeight: number;
  if (isCorner) {
    const horizontalDelta = hasE ? deltaX : -deltaX;
    const verticalDelta = hasS ? deltaY : -deltaY;
    const widthFromVertical = (height + verticalDelta) * widthPerHeight;
    const widthFromHorizontal = width + horizontalDelta;
    nextWidth = Math.max(minDimension,
      Math.abs(verticalDelta * widthPerHeight) > Math.abs(horizontalDelta)
        ? widthFromVertical
        : widthFromHorizontal);
    nextHeight = nextWidth / widthPerHeight;
  } else if (isHorizontal) {
    nextWidth = Math.max(minDimension, width + (hasE ? deltaX : -deltaX));
    nextHeight = nextWidth / widthPerHeight;
  } else if (isVertical) {
    nextHeight = Math.max(minDimension, height + (hasS ? deltaY : -deltaY));
    nextWidth = nextHeight * widthPerHeight;
  } else {
    return { x, y, width, height };
  }

  let nextX = x;
  let nextY = y;
  if (hasW) nextX = x + width - nextWidth;
  else if (!isCorner && isVertical) nextX = x + (width - nextWidth) / 2;
  if (hasN) nextY = y + height - nextHeight;
  else if (!isCorner && isHorizontal) nextY = y + (height - nextHeight) / 2;

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight };
}

export function getTextResizeFontSize(params: {
  handle: ResizeHandle;
  startWidth: number;
  startHeight: number;
  nextWidth: number;
  nextHeight: number;
  startFontSize: number;
  minFontSize?: number;
  maxFontSize?: number;
}): number {
  const {
    handle,
    startWidth,
    startHeight,
    nextWidth,
    nextHeight,
    startFontSize,
    minFontSize = 8,
    maxFontSize = 400,
  } = params;
  const safeStartFontSize = Number.isFinite(startFontSize) && startFontSize > 0 ? startFontSize : 24;
  const hasE = handle.includes('e');
  const hasW = handle.includes('w');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');
  const safeStartW = Math.max(0.1, Number.isFinite(startWidth) && startWidth > 0 ? startWidth : 1);
  const safeStartH = Math.max(0.1, Number.isFinite(startHeight) && startHeight > 0 ? startHeight : 1);

  // Micro-delta guard: if dimensions barely changed, strictly preserve starting font size
  if (Math.abs(nextWidth - safeStartW) < 0.05 && Math.abs(nextHeight - safeStartH) < 0.05) {
    return safeStartFontSize;
  }

  const widthScale = Number.isFinite(nextWidth) ? nextWidth / safeStartW : 1;
  const heightScale = Number.isFinite(nextHeight) ? nextHeight / safeStartH : 1;
  const isHorizontalOnly = (hasE || hasW) && !(hasN || hasS);
  const isVerticalOnly = (hasN || hasS) && !(hasE || hasW);
  const fontScale = isHorizontalOnly ? widthScale : isVerticalOnly ? heightScale : Math.min(widthScale, heightScale);
  const safeFontScale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  if (Math.abs(safeFontScale - 1) < 0.005) {
    return safeStartFontSize;
  }
  const nextFontSize = Math.round(safeStartFontSize * safeFontScale);

  return Math.max(minFontSize, Math.min(maxFontSize, Number.isFinite(nextFontSize) ? nextFontSize : safeStartFontSize));
}

