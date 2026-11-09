import type { PopupConfig, SceneElement } from '../types';

export const POPUP_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'] as const;

/** Maps themes saved by older projects to the equivalent supported popup theme. */
export function normalizePopupTheme(theme: string | null | undefined): string {
  const value = theme || 'default';
  return value.startsWith('bubble-') ? value.slice('bubble-'.length) : value;
}

const POPUP_ASPECT_MIN = 0.4;
const POPUP_ASPECT_MAX = 4;

export function resolvePopupAspectRatio(popup: Partial<PopupConfig>): number {
  const preset: Record<string, number> = {
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '1:1': 1,
    '9:16': 9 / 16,
  };
  if (popup.popupRatio !== 'custom') return preset[popup.popupRatio || '16:9'] || 16 / 9;

  const width = Number(popup.popupRatioW);
  const height = Number(popup.popupRatioH);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 16 / 9;
  return Math.max(POPUP_ASPECT_MIN, Math.min(POPUP_ASPECT_MAX, width / height));
}

/**
 * Popup sizes are saved as stage percentages, while aspect ratios describe physical
 * pixels. Keep the conversion here so the inspector, canvas frame and runtime use
 * the exact same geometry on every canvas aspect ratio.
 */
export function resolvePopupSizePercent(
  popup: Partial<PopupConfig>,
  stageAspect: number,
): { width: number; height: number } {
  const clamp = (value: number) => Math.max(10, Math.min(96, value));
  const safeStageAspect = Number.isFinite(stageAspect) && stageAspect > 0 ? stageAspect : 16 / 9;
  let width = clamp(Number(popup.popupWidth) || 60);
  let height: number;

  if (popup.popupRatio === 'free') {
    height = clamp(Number(popup.popupHeight) || width);
  } else {
    height = width * safeStageAspect / resolvePopupAspectRatio(popup);
  }

  // Constrain the pair together. Independent min/max clamping distorts 1:1,
  // portrait and custom ratios on a non-square stage.
  const scale = Math.min(1, 96 / width, 96 / height);
  width *= scale;
  height *= scale;
  return { width, height };
}

export interface PopupStageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PopupGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  useCustom: boolean;
}

/**
 * Canonical popup placement for both the editor preview and standalone export.
 * It deliberately has no module dependencies so its source can be embedded in
 * exported HTML without creating a second, drifting implementation.
 */
export function computePopupGeometry(
  popup: Partial<PopupConfig>,
  display: string,
  stage: PopupStageRect,
  popoverAnchor?: { x: number; y: number; w: number; h: number } | null,
): PopupGeometry {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const aspectFor = (source: Partial<PopupConfig>) => {
    const preset: Record<string, number> = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '9:16': 9 / 16 };
    if (source.popupRatio !== 'custom') return preset[source.popupRatio || '16:9'] || 16 / 9;
    const width = Number(source.popupRatioW);
    const height = Number(source.popupRatioH);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 16 / 9;
    return clamp(width / height, 0.4, 4);
  };
  const sizePercentFor = (source: Partial<PopupConfig>, stageAspect: number) => {
    const safeStageAspect = Number.isFinite(stageAspect) && stageAspect > 0 ? stageAspect : 16 / 9;
    let width = clamp(Number(source.popupWidth) || 60, 10, 96);
    let height = source.popupRatio === 'free'
      ? clamp(Number(source.popupHeight) || width, 10, 96)
      : width * safeStageAspect / aspectFor(source);
    const scale = Math.min(1, 96 / width, 96 / height);
    width *= scale;
    height *= scale;
    return { width, height };
  };

  const safeStage: PopupStageRect = {
    left: Number.isFinite(stage.left) ? stage.left : 0,
    top: Number.isFinite(stage.top) ? stage.top : 0,
    width: Math.max(1, Number.isFinite(stage.width) ? stage.width : 1),
    height: Math.max(1, Number.isFinite(stage.height) ? stage.height : 1),
  };
  const position = popup.popupPosition || 'center';
  const size = popup.popupSize || 'medium';
  const useCustom = position === 'custom';
  let width: number;
  let height: number;

  if (size === 'custom') {
    const percent = sizePercentFor(popup, safeStage.width / safeStage.height);
    width = (percent.width / 100) * safeStage.width;
    height = (percent.height / 100) * safeStage.height;
  } else if (display === 'popover' || display === 'inline') {
    width = Math.min(340, Math.max(260, popup.popupWidth ? popup.popupWidth * 10 : 320));
    height = Math.min(420, Math.max(280, safeStage.height - 120));
  } else {
    width = (size === 'small' ? 0.4 : size === 'large' ? 0.8 : 0.6) * safeStage.width;
    height = width / aspectFor(popup);
  }

  if (!Number.isFinite(width) || width <= 0) width = Math.max(160, safeStage.width * 0.6);
  if (!Number.isFinite(height) || height <= 0) height = width / (16 / 9);
  const physicalAspect = width / height;
  const maxW = safeStage.width * 0.96;
  const maxH = safeStage.height * 0.96;
  if (height > maxH) { height = maxH; width = height * physicalAspect; }
  if (width > maxW) { width = maxW; height = width / physicalAspect; }

  let left: number;
  let top: number;
  if (useCustom) {
    left = safeStage.left + ((popup.popupX ?? 50) / 100) * safeStage.width;
    top = safeStage.top + ((popup.popupY ?? 50) / 100) * safeStage.height;
  } else if ((display === 'popover' || display === 'inline') && popoverAnchor) {
    const gap = 14;
    const spaceBelow = safeStage.height - (popoverAnchor.y - safeStage.top + popoverAnchor.h);
    const spaceAbove = popoverAnchor.y - safeStage.top;
    left = Math.max(safeStage.left + 14, Math.min(popoverAnchor.x + popoverAnchor.w / 2 - width / 2, safeStage.left + safeStage.width - width - 14));
    if (spaceBelow >= height) top = popoverAnchor.y + popoverAnchor.h + gap;
    else if (spaceAbove >= height) top = popoverAnchor.y - height - gap;
    else top = spaceBelow >= spaceAbove ? popoverAnchor.y + popoverAnchor.h + gap : Math.max(safeStage.top + 14, popoverAnchor.y - height - gap);
  } else {
    const padding = display === 'modal' ? 32 : 24;
    switch (position) {
      case 'top-left': left = safeStage.left + padding; top = safeStage.top + padding; break;
      case 'top-right': left = safeStage.left + safeStage.width - width - padding; top = safeStage.top + padding; break;
      case 'bottom-left': left = safeStage.left + padding; top = safeStage.top + safeStage.height - height - padding; break;
      case 'bottom-right': left = safeStage.left + safeStage.width - width - padding; top = safeStage.top + safeStage.height - height - padding; break;
      default: left = safeStage.left + safeStage.width / 2 - width / 2; top = safeStage.top + safeStage.height / 2 - height / 2; break;
    }
  }
  return { left, top, width, height, useCustom };
}

/** Serialized verbatim into the standalone runner; see computePopupGeometry. */
export function getStandalonePopupGeometryRuntime(): string {
  // esbuild decorates nested functions with __name during dev transforms.
  // The standalone file intentionally has no bundler runtime, so provide its
  // identity equivalent before embedding the transformed function source.
  return `const __name = (value) => value; const computePopupGeometry = ${computePopupGeometry.toString()};`;
}

export function resizePopupPercent(options: {
  startWidth: number;
  startHeight: number;
  deltaX: number;
  deltaY: number;
  handle: string;
  freeAspect: boolean;
  popupAspect: number;
  stageAspect: number;
}): { width: number; height: number } {
  const { startWidth, startHeight, deltaX, deltaY, handle, freeAspect } = options;
  const clamp = (value: number) => Math.max(10, Math.min(96, value));

  if (freeAspect) {
    let width = startWidth;
    let height = startHeight;
    if (handle.includes('e')) width += deltaX;
    if (handle.includes('w')) width -= deltaX;
    if (handle.includes('s')) height += deltaY;
    if (handle.includes('n')) height -= deltaY;
    return { width: clamp(width), height: clamp(height) };
  }

  const popupAspect = Number.isFinite(options.popupAspect) && options.popupAspect > 0 ? options.popupAspect : 16 / 9;
  const stageAspect = Number.isFinite(options.stageAspect) && options.stageAspect > 0 ? options.stageAspect : 16 / 9;
  let widthDelta = 0;
  if (handle.includes('e')) widthDelta += deltaX;
  if (handle.includes('w')) widthDelta -= deltaX;
  if (handle.includes('s')) widthDelta += deltaY * popupAspect / stageAspect;
  if (handle.includes('n')) widthDelta -= deltaY * popupAspect / stageAspect;
  return { width: clamp(startWidth + widthDelta), height: startHeight };
}

/** Side handles express one-axis resizing and therefore enter free-size mode. */
export function shouldUseFreePopupResize(popupRatio: PopupConfig['popupRatio'], handle: string): boolean {
  return popupRatio === 'free' || handle.length === 1;
}

const legacyKeys = [
  'popupAnimationType', 'popupExitAnimationType', 'popupStayMode', 'popupAnimationDuration', 'popupPosition', 'popupSize', 'popupX', 'popupY',
  'popupWidth', 'popupHeight', 'popupRatio', 'popupRatioW', 'popupRatioH', 'popupOverlayOpacity',
  'popupOverlayBlur', 'popupCloseOnOverlay', 'popupDisplay', 'popupTheme', 'popupBgColor',
  'popupBorderColor', 'popupGlowColor', 'popupTitle', 'popupTitleColor', 'popupAccentColor', 'popupRadius',
] as const;

type PopupOwner = Pick<SceneElement, 'link'> & Partial<SceneElement>;

export function createDefaultPopup(index: number): PopupConfig {
  const positions = [
    { x: 50, y: 50 }, { x: 28, y: 30 }, { x: 72, y: 30 }, { x: 28, y: 70 }, { x: 72, y: 70 },
  ];
  const position = positions[index] || positions[0];
  return {
    id: `popup-${index + 1}`,
    color: POPUP_COLORS[index % POPUP_COLORS.length],
    enabled: true,
    popupPosition: 'custom',
    popupSize: 'custom',
    popupX: position.x,
    popupY: position.y,
    popupWidth: index === 0 ? 60 : 36,
    popupRatio: '16:9',
    popupDisplay: 'modal',
    popupAnimationType: 'fadeIn',
    popupExitAnimationType: 'fadeOut',
    popupStayMode: 'short',
    popupAnimationDuration: 500,
    popupCloseOnOverlay: true,
    popupTheme: 'default',
  };
}

export function isLongLivedPopup(popup: Pick<PopupConfig, 'popupStayMode'> | Record<string, unknown>): boolean {
  return popup.popupStayMode === 'long';
}

/** Reads old one-popup projects as a one-item collection without mutating them. */
export function getPopups(owner: PopupOwner): PopupConfig[] {
  if (owner.popups?.length) {
    return owner.popups.slice(0, 5).map((popup) =>
      popup.target === undefined && owner.link ? { ...popup, target: owner.link } : popup,
    );
  }
  const legacy: PopupConfig = createDefaultPopup(0);
  legacy.target = owner.link;
  legacyKeys.forEach((key) => {
    const value = owner[key];
    if (value !== undefined) (legacy as unknown as Record<string, unknown>)[key] = value;
  });
  return [legacy];
}

/** Synchronise popup 1 with legacy fields so older preview/export paths remain compatible. */
export function popupCollectionPatch(popups: PopupConfig[]): Partial<SceneElement> {
  const first = popups[0] || createDefaultPopup(0);
  const patch: Record<string, unknown> = { popups };
  patch.link = first.target || '';
  const firstValues = first as unknown as Record<string, unknown>;
  legacyKeys.forEach((key) => { patch[key] = firstValues[key]; });
  return patch as Partial<SceneElement>;
}

export function resizePopups(owner: PopupOwner, count: number): PopupConfig[] {
  const nextCount = Math.max(1, Math.min(5, count));
  const current = getPopups(owner);
  const inheritedTarget = current[0]?.target || owner.link;
  return Array.from({ length: nextCount }, (_, index) => ({
    ...createDefaultPopup(index),
    ...current[index],
    id: current[index]?.id || `popup-${index + 1}`,
    color: current[index]?.color || POPUP_COLORS[index],
    target: current[index]?.target ?? inheritedTarget,
  }));
}
