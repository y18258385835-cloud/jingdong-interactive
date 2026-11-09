import { describe, expect, it } from 'vitest';
import { getBoundsAspectRatio, getTextResizeFontSize, isAspectRatioResizeLocked, resizeBoundsWithAspect, resizeRectWithAspect } from '../src/core/render/resize';

describe('aspect ratio resize lock', () => {
  it('is off by default and only locks when explicitly enabled', () => {
    expect(isAspectRatioResizeLocked(undefined)).toBe(false);
    expect(isAspectRatioResizeLocked(false)).toBe(false);
    expect(isAspectRatioResizeLocked(true)).toBe(true);
  });

  it('uses the current frame aspect ratio in physical canvas coordinates', () => {
    const aspect = getBoundsAspectRatio(40, 20, 1920, 1080);
    expect(aspect).toBeCloseTo(3.5555555556);
    expect(resizeBoundsWithAspect({
      width: 50,
      height: 20,
      editedDimension: 'width',
      aspectRatio: getBoundsAspectRatio(40, 20, 1920, 1080),
      canvasWidth: 1920,
      canvasHeight: 1080,
    })).toEqual({ width: 50, height: 25 });
  });

  it.each(['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'])('preserves the current ratio while dragging the %s handle', (handle) => {
    const initial = { x: 10, y: 20, width: 30, height: 20 };
    const aspect = getBoundsAspectRatio(initial.width, initial.height, 1920, 1080);
    const result = resizeRectWithAspect({
      ...initial,
      deltaX: 5,
      deltaY: 4,
      handle,
      aspectRatio: aspect,
      canvasWidth: 1920,
      canvasHeight: 1080,
      minDimension: 2,
    });

    expect(getBoundsAspectRatio(result.width, result.height, 1920, 1080)).toBeCloseTo(aspect);
    if (handle.includes('w')) expect(result.x + result.width).toBeCloseTo(initial.x + initial.width);
    if (handle.includes('e')) expect(result.x).toBeCloseTo(initial.x);
    if (handle.includes('n')) expect(result.y + result.height).toBeCloseTo(initial.y + initial.height);
    if (handle.includes('s')) expect(result.y).toBeCloseTo(initial.y);
    if (handle === 'e' || handle === 'w') expect(result.y + result.height / 2).toBeCloseTo(initial.y + initial.height / 2);
    if (handle === 'n' || handle === 's') expect(result.x + result.width / 2).toBeCloseTo(initial.x + initial.width / 2);
  });
});

describe('text resize font scaling', () => {
  it('uses width scale for horizontal handles', () => {
    expect(getTextResizeFontSize({
      handle: 'e',
      startWidth: 20,
      startHeight: 10,
      nextWidth: 30,
      nextHeight: 10,
      startFontSize: 24,
    })).toBe(36);
  });

  it('uses height scale for vertical handles', () => {
    expect(getTextResizeFontSize({
      handle: 's',
      startWidth: 20,
      startHeight: 10,
      nextWidth: 20,
      nextHeight: 15,
      startFontSize: 24,
    })).toBe(36);
  });

  it('uses the smaller scale for corner handles so text stays inside the box', () => {
    expect(getTextResizeFontSize({
      handle: 'se',
      startWidth: 20,
      startHeight: 10,
      nextWidth: 40,
      nextHeight: 12.5,
      startFontSize: 24,
    })).toBe(30);
  });

  it('scales font size up proportionally on corner resize', () => {
    // 2x scale: start 20x10 -> next 40x20
    expect(getTextResizeFontSize({
      handle: 'se',
      startWidth: 20,
      startHeight: 10,
      nextWidth: 40,
      nextHeight: 20,
      startFontSize: 24,
    })).toBe(48);
  });

  it('scales font size down proportionally on corner resize', () => {
    // 0.5x scale: start 40x20 -> next 20x10
    expect(getTextResizeFontSize({
      handle: 'nw',
      startWidth: 40,
      startHeight: 20,
      nextWidth: 20,
      nextHeight: 10,
      startFontSize: 32,
    })).toBe(16);
  });

  it('clamps the result to editor limits', () => {
    expect(getTextResizeFontSize({
      handle: 'se',
      startWidth: 20,
      startHeight: 10,
      nextWidth: 1,
      nextHeight: 1,
      startFontSize: 24,
    })).toBe(8);

    expect(getTextResizeFontSize({
      handle: 'se',
      startWidth: 20,
      startHeight: 10,
      nextWidth: 800,
      nextHeight: 800,
      startFontSize: 24,
    })).toBe(400);
  });

  it('CapCut-level: vertical handles (n, s) scale font size proportionally with height', () => {
    // Top handle 'n' or bottom handle 's' scaling height by 1.5x (10 -> 15)
    expect(getTextResizeFontSize({
      handle: 's',
      startWidth: 30,
      startHeight: 10,
      nextWidth: 30,
      nextHeight: 15,
      startFontSize: 20,
    })).toBe(30);

    // Height reduced by half (10 -> 5)
    expect(getTextResizeFontSize({
      handle: 'n',
      startWidth: 30,
      startHeight: 10,
      nextWidth: 30,
      nextHeight: 5,
      startFontSize: 20,
    })).toBe(10);
  });

  it('safely handles NaN and non-finite inputs without throwing or returning NaN', () => {
    expect(getTextResizeFontSize({
      handle: 'se',
      startWidth: NaN,
      startHeight: 10,
      nextWidth: 40,
      nextHeight: 20,
      startFontSize: 24,
    })).toBeGreaterThanOrEqual(8);

    expect(getTextResizeFontSize({
      handle: 's',
      startWidth: 20,
      startHeight: 0,
      nextWidth: 20,
      nextHeight: NaN,
      startFontSize: NaN,
    })).toBe(24);
  });
});

