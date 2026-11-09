/**
 * 媒体素材比例工具
 * 用于在添加素材到画布时，按素材原始宽高比计算元素尺寸，
 * 保证"原素材什么比例，预览窗口就是什么比例"，不拉伸变形。
 */

/**
 * 计算媒体素材的原始宽高比（width / height）
 * @param blob 素材二进制（图片或视频）
 * @param type 素材类型
 * @returns 宽高比，计算失败时回退为 1（正方形）
 */
export async function computeMediaAspect(
  blob: Blob,
  type: 'image' | 'video'
): Promise<number> {
  try {
    if (type === 'image') {
      const bmp = await createImageBitmap(blob);
      const aspect = bmp.width > 0 && bmp.height > 0 ? bmp.width / bmp.height : 1;
      bmp.close();
      return aspect;
    }
    // video：读取视频元数据获取原始分辨率
    const vUrl = URL.createObjectURL(blob);
    const vEl = document.createElement('video');
    vEl.preload = 'metadata';
    vEl.muted = true;
    vEl.src = vUrl;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        vEl.removeEventListener('loadedmetadata', finish);
        vEl.removeEventListener('error', finish);
        resolve();
      };
      const timeoutId = window.setTimeout(finish, 5000);
      vEl.addEventListener('loadedmetadata', finish, { once: true });
      vEl.addEventListener('error', finish, { once: true });
      vEl.load();
    });
    const aspect = vEl.videoWidth > 0 && vEl.videoHeight > 0
      ? vEl.videoWidth / vEl.videoHeight
      : 1;
    vEl.removeAttribute('src');
    vEl.load();
    URL.revokeObjectURL(vUrl);
    return aspect;
  } catch {
    return 1;
  }
}

/**
 * 根据素材原始比例计算画布内等比例尺寸（画布百分比）
 * 以 baseWidth 宽度为基准，高度按比例换算；
 * 高度超出 maxHeight 时反向以高度为基准约束宽度；高度过小时同样反向放大。
 * @param aspect 原始宽高比（width/height）
 * @param baseWidth 基准宽度（画布百分比）
 * @returns 等比例宽高（保留一位小数）
 */
export function computeProportionalSize(
  aspect: number,
  baseWidth = 40,
  maxHeight = 80,
  minHeight = 8,
  maxWidth = 90,
  minWidth = 5,
  canvasWidth = 1920,
  canvasHeight = 1080,
): { w: number; h: number } {
  if (!isFinite(aspect) || aspect <= 0) aspect = 1;
  const safeCanvasWidth = Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 1920;
  const safeCanvasHeight = Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 1080;
  // w/h are percentages, while aspect is a physical pixel ratio. Convert
  // through the canvas dimensions so a 16:9 asset remains 16:9 on a 1920x1080 stage.
  const percentHeightForWidth = (width: number) => width * safeCanvasWidth / (aspect * safeCanvasHeight);
  const percentWidthForHeight = (height: number) => height * aspect * safeCanvasHeight / safeCanvasWidth;
  let w = baseWidth;
  let h = percentHeightForWidth(w);
  // 高度超限：反向以高度为基准（不裁切、不拉伸）
  if (h > maxHeight) {
    h = maxHeight;
    w = percentWidthForHeight(h);
  } else if (h < minHeight) {
    h = minHeight;
    w = percentWidthForHeight(h);
  }
  if (w > maxWidth) {
    w = maxWidth;
    h = percentHeightForWidth(w);
  } else if (w < minWidth) {
    w = minWidth;
    h = percentHeightForWidth(w);
  }
  // A second clamp is only a numerical guard for extreme aspect ratios.
  if (h > maxHeight) {
    h = maxHeight;
    w = Math.min(maxWidth, percentWidthForHeight(h));
  } else if (h < minHeight) {
    h = minHeight;
    w = Math.max(minWidth, percentWidthForHeight(h));
  }
  w = Math.min(maxWidth, Math.max(minWidth, Math.round(w * 10) / 10));
  h = Math.min(maxHeight, Math.max(minHeight, Math.round(h * 10) / 10));
  return { w, h };
}
