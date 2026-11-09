import { aetherDB, opfs } from '../db';
import type { Scene, SceneElement } from '../../types';

const THUMBNAIL_MAX_WIDTH = 480;

function addRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function createGradient(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  start: string,
  end: string,
  via?: string,
  angle = 135,
): CanvasGradient {
  const radians = angle * Math.PI / 180;
  const centerX = width / 2;
  const centerY = height / 2;
  const distance = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const dx = Math.cos(radians) * distance / 2;
  const dy = Math.sin(radians) * distance / 2;
  const gradient = context.createLinearGradient(centerX - dx, centerY - dy, centerX + dx, centerY + dy);
  gradient.addColorStop(0, start);
  if (via) gradient.addColorStop(0.5, via);
  gradient.addColorStop(1, end);
  return gradient;
}

function loadThumbnailImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), 600);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    if (/^https?:/i.test(source)) image.crossOrigin = 'anonymous';
    image.src = source;
  });
}

function drawSceneElement(
  context: CanvasRenderingContext2D,
  element: SceneElement,
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  images: Map<string, HTMLImageElement>,
  parentBounds?: { x: number; y: number; width: number; height: number },
): void {
  if (element.visible === false) return;
  const baseX = parentBounds?.x || 0;
  const baseY = parentBounds?.y || 0;
  const baseWidth = parentBounds?.width || canvasWidth;
  const baseHeight = parentBounds?.height || canvasHeight;
  const x = baseX + (element.x / 100) * baseWidth;
  const y = baseY + (element.y / 100) * baseHeight;
  const width = (element.w / 100) * baseWidth;
  const height = (element.h / 100) * baseHeight;
  if (width <= 0 || height <= 0) return;

  const pixelScale = canvasWidth / sourceWidth;
  const radius = Math.max(0, (element.borderRadius || 0) * pixelScale);
  const opacity = Math.max(0, Math.min(1, (element.opacity ?? 100) / 100));
  context.save();
  context.globalAlpha = opacity;
  context.translate(x + width / 2, y + height / 2);
  if (element.rot) context.rotate(element.rot * Math.PI / 180);
  context.translate(-width / 2, -height / 2);

  if (element.type === 'img' || element.type === 'panorama-img') {
    const image = images.get(element.refId);
    if (image) {
      context.drawImage(image, 0, 0, width, height);
    } else {
      context.fillStyle = createGradient(context, width, height, '#172033', '#0b1020', '#1d4ed8');
      context.fillRect(0, 0, width, height);
    }
  } else if (element.type === 'chart') {
    context.fillStyle = element.backgroundColor || 'rgba(15, 23, 42, 0.88)';
    addRoundedRect(context, 0, 0, width, height, radius || 4);
    context.fill();
    const values = (element.chartData || []).slice(0, 8);
    const maxValue = Math.max(1, ...values.map((item) => item.value));
    values.forEach((item, index) => {
      const barWidth = width / Math.max(1, values.length) * 0.55;
      const barHeight = height * 0.62 * item.value / maxValue;
      context.fillStyle = item.color || element.chartColors?.[index % (element.chartColors?.length || 1)] || '#38bdf8';
      context.fillRect(width * 0.08 + index * (width * 0.84 / Math.max(1, values.length)), height * 0.84 - barHeight, barWidth, barHeight);
    });
  } else if (element.type !== 'txt') {
    if (element.backgroundType === 'gradient' || element.gradientStart || element.gradientEnd) {
      context.fillStyle = createGradient(
        context,
        width,
        height,
        element.gradientStart || '#0f172a',
        element.gradientEnd || '#1d4ed8',
        element.gradientVia,
        element.gradientAngle,
      );
    } else if (element.type === 'saber' || element.type === 'vfx') {
      context.fillStyle = createGradient(context, width, height, element.vfxColorA || element.saberGlowColor || '#22d3ee', element.vfxColorB || element.saberSecondaryGlowColor || '#7c3aed');
    } else {
      context.fillStyle = element.backgroundColor || element.color || 'rgba(30, 41, 59, 0.85)';
    }
    if (element.shapeKind === 'circle' || element.shapeKind === 'ellipse') {
      context.beginPath();
      context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    } else {
      addRoundedRect(context, 0, 0, width, height, radius);
    }
    context.fill();
  }

  if ((element.borderWidth || 0) > 0 && element.borderColor) {
    addRoundedRect(context, 0, 0, width, height, radius);
    context.strokeStyle = element.borderColor;
    context.lineWidth = Math.max(0.5, (element.borderWidth || 0) * pixelScale);
    context.stroke();
  }

  const text = element.content?.trim();
  if (text) {
    const fontSize = Math.max(5, (element.fontSize || (element.type === 'txt' ? 24 : 14)) * pixelScale);
    const padding = Math.max(2, (element.type === 'txt' ? element.textPadding : element.shapePadding || 8) || 0) * pixelScale;
    context.fillStyle = element.type === 'txt' ? element.color || '#ffffff' : element.textColor || '#ffffff';
    context.font = `${element.fontStyle || 'normal'} ${element.fontWeight || '500'} ${fontSize}px ${element.fontFamily || 'system-ui, sans-serif'}`;
    context.textBaseline = 'top';
    context.textAlign = element.textAlign || 'left';
    const textX = context.textAlign === 'center' ? width / 2 : context.textAlign === 'right' ? width - padding : padding;
    const lines = text.split(/\r?\n/).slice(0, 8);
    const lineHeight = fontSize * (element.lineHeight || 1.25);
    const blockHeight = lines.length * lineHeight;
    const startY = element.textAlign === 'center' ? Math.max(padding, (height - blockHeight) / 2) : padding;
    lines.forEach((line, index) => context.fillText(line, textX, startY + index * lineHeight, Math.max(1, width - padding * 2)));
  }

  context.restore();

  if (element.type === 'group' && element.children?.length) {
    [...element.children]
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0))
      .forEach((child) => drawSceneElement(context, child, canvasWidth, canvasHeight, sourceWidth, images, { x, y, width, height }));
  }
}

/**
 * Capture the authored stage, rather than the editor shell, for project cards.
 * This runs only after a project save and is intentionally best-effort: a
 * preview failure must never block the actual project data from being stored.
 */
export async function captureStageThumbnail(
  stage: HTMLElement,
  scene?: Scene,
  resolveAsset: (ref: string) => string = (ref) => ref,
): Promise<Blob | null> {
  const width = Math.max(1, stage.offsetWidth);
  const height = Math.max(1, stage.offsetHeight);
  const outputWidth = Math.min(THUMBNAIL_MAX_WIDTH, width);
  const outputHeight = Math.max(1, Math.round(height * outputWidth / width));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;

    if (scene?.backgroundType === 'gradient') {
      context.fillStyle = createGradient(context, outputWidth, outputHeight, scene.gradientStart || '#020617', scene.gradientEnd || '#172554', scene.gradientVia, scene.gradientAngle);
    } else {
      context.fillStyle = scene?.bgColor || '#0a0a12';
    }
    context.fillRect(0, 0, outputWidth, outputHeight);

    const mediaRefs = [scene?.bgRef, ...(scene?.els || []).filter((element) => element.type === 'img' || element.type === 'panorama-img').map((element) => element.refId)]
      .filter((ref): ref is string => !!ref)
      .filter((ref, index, refs) => refs.indexOf(ref) === index)
      .slice(0, 8);
    const images = new Map<string, HTMLImageElement>();
    await Promise.all(mediaRefs.map(async (ref) => {
      const image = await loadThumbnailImage(resolveAsset(ref));
      if (image) images.set(ref, image);
    }));

    if (scene?.bgRef && images.has(scene.bgRef)) {
      context.drawImage(images.get(scene.bgRef)!, 0, 0, outputWidth, outputHeight);
    }
    [...(scene?.els || [])]
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0))
      .forEach((element) => drawSceneElement(context, element, outputWidth, outputHeight, width, images));

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
  } catch (error) {
    console.warn('[thumbnail] Stage capture failed; project data was saved normally.', error);
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Unable to read thumbnail'));
    reader.readAsDataURL(blob);
  });
}

/** Persist a thumbnail without rewriting the complete project document. */
export async function storeProjectThumbnail(projectId: string, thumbnail: Blob): Promise<void> {
  let storedThumbnail: string;

  try {
    const path = opfs.generateThumbnailPath(projectId);
    await opfs.writeFile(path, thumbnail);
    storedThumbnail = path;
  } catch (error) {
    // OPFS is unavailable in a small number of embedded browsers. Keep the
    // preview functional there too, while still treating the project record as
    // the source of truth.
    console.warn('[thumbnail] OPFS write failed; falling back to IndexedDB data URL.', error);
    storedThumbnail = await blobToDataUrl(thumbnail);
  }

  await aetherDB.updateProjectThumbnail(projectId, storedThumbnail);
}
