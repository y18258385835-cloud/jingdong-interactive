import type { CSSProperties } from 'react';
import type { SceneElement } from '../types';
import { getTextStylePresetStyle } from './textStylePresets';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const colorWithAlpha = (color: string, opacity: number) => {
  const alpha = clamp(opacity, 0, 100) / 100;
  const hex = color.trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex) || /^[0-9a-f]{6}$/i.test(hex)) {
    const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
    const value = Number.parseInt(normalized, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  return color;
};

export const getTextShadow = (element: SceneElement, scale = 1): string | undefined => {
  const shadows: string[] = [];
  if (element.textGlowEnabled) {
    const intensity = clamp(element.textGlowIntensity ?? 50, 0, 100);
    const blur = Math.max(0, (element.textGlowBlur ?? 24) * scale);
    shadows.push(`0 0 ${blur}px ${colorWithAlpha(element.textGlowColor || element.textColor || element.color || '#ffffff', intensity)}`);
  }
  if (element.textShadowEnabled) {
    const angle = ((element.textShadowAngle ?? 45) * Math.PI) / 180;
    const distance = Math.max(0, (element.textShadowDistance ?? 4) * scale);
    const x = (Math.cos(angle) * distance).toFixed(1);
    const y = (Math.sin(angle) * distance).toFixed(1);
    const blur = Math.max(0, (element.textShadowBlur ?? 8) * scale);
    shadows.push(`${x}px ${y}px ${blur}px ${colorWithAlpha(element.textShadowColor || '#000000', element.textShadowOpacity ?? 65)}`);
  }
  return shadows.length ? shadows.join(', ') : undefined;
};

export const getTextStyle = (
  element: SceneElement,
  options: { color?: string; fontSize?: number; scale?: number; defaultLineHeight?: number } = {},
): CSSProperties => {
  const scale = options.scale ?? 1;
  const fontSize = options.fontSize ?? element.fontSize ?? (element.type === 'txt' ? 32 : 24);
  const presetStyle = getTextStylePresetStyle(element.textStylePreset, scale);
  const presetShadow = typeof presetStyle.textShadow === 'string' ? presetStyle.textShadow : undefined;
  const configuredShadow = getTextShadow(element, scale);
  const defaultLineHeight = options.defaultLineHeight ?? (element.type === 'txt' ? 1.25 : 1.625);
  return {
    color: options.color || element.textColor || element.color || '#ffffff',
    fontSize: `${fontSize * scale}px`,
    fontFamily: element.fontFamily || 'sans-serif',
    fontWeight: element.fontWeight || 'bold',
    fontStyle: element.fontStyle || 'normal',
    textDecoration: element.textDecoration || 'none',
    textAlign: element.textAlign || 'center',
    whiteSpace: element.textWrap === 'nowrap' ? 'nowrap' : 'pre-wrap',
    wordBreak: element.textWrap === 'nowrap' ? 'normal' : 'break-word',
    overflowWrap: 'break-word',
    letterSpacing: `${(element.letterSpacing ?? 0) * scale}px`,
    lineHeight: element.lineHeight ?? defaultLineHeight,
    opacity: clamp(element.textOpacity ?? 100, 0, 100) / 100,
    ...presetStyle,
    textShadow: [presetShadow, configuredShadow].filter(Boolean).join(', ') || undefined,
  };
};

export const getTextEditorStyle = (
  element: SceneElement,
  options: {
    color?: string;
    fontSize?: number;
    defaultLineHeight?: number;
    padding?: number | string;
    background?: string;
  } = {},
): CSSProperties => ({
  ...getTextStyle(element, {
    color: options.color,
    fontSize: options.fontSize,
    defaultLineHeight: options.defaultLineHeight,
  }),
  width: '100%',
  height: '100%',
  margin: 0,
  padding: typeof options.padding === 'number' ? `${options.padding}px` : (options.padding ?? 0),
  boxSizing: 'border-box',
  background: options.background ?? 'transparent',
  border: 'none',
  borderRadius: 'inherit',
  outline: 'none',
  resize: 'none',
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'thin',
  whiteSpace: element.textWrap === 'nowrap' ? 'nowrap' : 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  caretColor: options.color || element.textColor || element.color || '#38bdf8',
  alignContent: element.verticalAlign === 'top' ? 'start' : element.verticalAlign === 'bottom' ? 'end' : 'center',
  boxShadow: 'none',
});

/**
 * 测量文字图层的紧凑贴合尺寸（百分比），实现剪映级选框紧密贴合文字轮廓
 */
export function measureSnugTextDimensions(
  text: string,
  options: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    letterSpacing?: number;
    lineHeight?: number;
    textPadding?: number;
    canvasWidth?: number;
    canvasHeight?: number;
  } = {}
): { w: number; h: number; pixelWidth: number; pixelHeight: number } {
  const canvasW = options.canvasWidth ?? 1920;
  const canvasH = options.canvasHeight ?? 1080;
  const fontSize = options.fontSize ?? 32;
  const fontFamily = options.fontFamily || 'sans-serif';
  const fontWeight = options.fontWeight || 'bold';
  const letterSpacing = options.letterSpacing ?? 0;
  const lineHeight = options.lineHeight ?? 1.25;
  const padding = options.textPadding ?? 6;

  const lines = (text || 'NEW TEXT').split('\n');
  let maxLineWidth = 0;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        for (const line of lines) {
          const metrics = ctx.measureText(line);
          const extraSpacing = Math.max(0, line.length - 1) * letterSpacing;
          const lineWidth = metrics.width + extraSpacing;
          if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (maxLineWidth <= 0) {
    for (const line of lines) {
      let lineWidth = 0;
      for (const char of line) {
        lineWidth += char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.58;
      }
      lineWidth += Math.max(0, line.length - 1) * letterSpacing;
      if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
    }
  }

  const pixelWidth = Math.ceil(maxLineWidth + padding * 2);
  const pixelHeight = Math.ceil(lines.length * fontSize * lineHeight + padding * 2);

  const w = Math.max(2, Math.round(((pixelWidth / canvasW) * 100) * 10) / 10);
  const h = Math.max(2, Math.round(((pixelHeight / canvasH) * 100) * 10) / 10);

  return { w, h, pixelWidth, pixelHeight };
}
