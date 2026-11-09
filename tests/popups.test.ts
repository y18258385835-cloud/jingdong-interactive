import { describe, expect, it } from 'vitest';
import { createDefaultPopup, getPopups, isLongLivedPopup, normalizePopupTheme, popupCollectionPatch, resizePopupPercent, resizePopups, resolvePopupAspectRatio, resolvePopupSizePercent, shouldUseFreePopupResize } from '../src/utils/popups';

describe('normalizePopupTheme', () => {
  it('maps saved bubble themes to their plain popup theme for older projects', () => {
    expect(normalizePopupTheme('bubble-corporate')).toBe('corporate');
    expect(normalizePopupTheme('bubble-immersive')).toBe('immersive');
    expect(normalizePopupTheme(undefined)).toBe('default');
  });
});

describe('popupCollectionPatch', () => {
  it('keeps presentation independent for every configured popup', () => {
    const primary = {
      ...createDefaultPopup(0), target: 'scene-primary', popupAnimationType: 'zoomIn' as const,
      popupExitAnimationType: 'slideDown' as const,
      popupStayMode: 'long' as const,
      popupDisplay: 'popover' as const, popupTheme: 'neon' as const, popupBgColor: '#101820',
    };
    const secondary = {
      ...createDefaultPopup(1),
      target: 'scene-secondary',
      popupX: 75,
      popupY: 25,
      popupAnimationType: 'bounce' as const,
      popupExitAnimationType: 'zoomOut' as const,
      popupDisplay: 'modal' as const,
      popupTheme: 'glass' as const,
    };

    const patch = popupCollectionPatch([primary, secondary]);

    expect(patch.link).toBe('scene-primary');
    expect(patch.popupWidth).toBe(primary.popupWidth);
    expect(patch.popupAnimationType).toBe('zoomIn');
    expect(patch.popupExitAnimationType).toBe('slideDown');
    expect(patch.popupStayMode).toBe('long');
    expect(patch.popupDisplay).toBe('popover');
    expect(patch.popupTheme).toBe('neon');
    expect(patch.popupBgColor).toBe('#101820');
    expect(patch.popups?.[1]).toMatchObject({
      target: 'scene-secondary', popupAnimationType: 'bounce', popupExitAnimationType: 'zoomOut', popupDisplay: 'modal', popupTheme: 'glass',
    });
  });

  it('defaults every new popup to a visible fade-out exit', () => {
    expect(createDefaultPopup(0).popupExitAnimationType).toBe('fadeOut');
    expect(createDefaultPopup(0).popupStayMode).toBe('short');
    expect(resizePopups({ link: 'scene-primary' }, 3).map((popup) => popup.popupExitAnimationType))
      .toEqual(['fadeOut', 'fadeOut', 'fadeOut']);
  });

  it('recognizes only explicitly long-lived popups as persistent', () => {
    expect(isLongLivedPopup({ popupStayMode: 'long' })).toBe(true);
    expect(isLongLivedPopup({ popupStayMode: 'short' })).toBe(false);
    expect(isLongLivedPopup({})).toBe(false);
  });

  it('gives newly added popups a usable target scene by default', () => {
    const owner = { link: 'scene-primary', popups: [{ ...createDefaultPopup(0), target: 'scene-primary' }] };
    const popups = resizePopups(owner, 3);

    expect(popups).toHaveLength(3);
    expect(popups.map((popup) => popup.target)).toEqual(['scene-primary', 'scene-primary', 'scene-primary']);
  });

  it('uses the legacy target for existing unassigned popup instances', () => {
    const popups = getPopups({ link: 'scene-primary', popups: [createDefaultPopup(0), createDefaultPopup(1)] });

    expect(popups.map((popup) => popup.target)).toEqual(['scene-primary', 'scene-primary']);
  });

  it('sanitizes invalid or extreme legacy aspect ratios', () => {
    expect(resolvePopupAspectRatio({ popupRatio: 'custom', popupRatioW: 1920, popupRatioH: 1 })).toBe(4);
    expect(resolvePopupAspectRatio({ popupRatio: 'custom', popupRatioW: 1, popupRatioH: 1920 })).toBe(0.4);
    expect(resolvePopupAspectRatio({ popupRatio: 'custom', popupRatioW: 16, popupRatioH: 0 })).toBe(16 / 9);
  });

  it('converts locked ratios to stage percentages without changing their physical aspect', () => {
    const stageAspect = 16 / 9;
    const square = resolvePopupSizePercent({ popupRatio: '1:1', popupWidth: 60 }, stageAspect);
    const landscape = resolvePopupSizePercent({ popupRatio: 'custom', popupRatioW: 3, popupRatioH: 2, popupWidth: 60 }, stageAspect);
    const portrait = resolvePopupSizePercent({ popupRatio: '9:16', popupWidth: 60 }, stageAspect);

    const physicalAspect = (size: { width: number; height: number }) => (size.width * stageAspect) / size.height;
    expect(physicalAspect(square)).toBeCloseTo(1, 6);
    expect(physicalAspect(landscape)).toBeCloseTo(1.5, 6);
    expect(physicalAspect(portrait)).toBeCloseTo(9 / 16, 6);
  });

  it('keeps free width and height independent', () => {
    expect(resolvePopupSizePercent({ popupRatio: 'free', popupWidth: 42, popupHeight: 67 }, 16 / 9))
      .toEqual({ width: 42, height: 67 });
  });

  it('resizes width and height independently in free aspect mode', () => {
    expect(resizePopupPercent({
      startWidth: 40,
      startHeight: 30,
      deltaX: 12,
      deltaY: -8,
      handle: 'ne',
      freeAspect: true,
      popupAspect: 16 / 9,
      stageAspect: 16 / 9,
    })).toEqual({ width: 52, height: 38 });
  });

  it('keeps height derived from width in locked aspect mode', () => {
    expect(resizePopupPercent({
      startWidth: 40,
      startHeight: 30,
      deltaX: 0,
      deltaY: 10,
      handle: 's',
      freeAspect: false,
      popupAspect: 16 / 9,
      stageAspect: 16 / 9,
    })).toEqual({ width: 50, height: 30 });
  });

  it('uses side handles for free resizing while corners preserve an explicit ratio', () => {
    expect(shouldUseFreePopupResize('16:9', 'e')).toBe(true);
    expect(shouldUseFreePopupResize('16:9', 's')).toBe(true);
    expect(shouldUseFreePopupResize('16:9', 'se')).toBe(false);
    expect(shouldUseFreePopupResize('free', 'se')).toBe(true);
  });
});
