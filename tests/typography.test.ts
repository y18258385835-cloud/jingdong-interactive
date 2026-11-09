import { describe, expect, it } from 'vitest';
import type { SceneElement } from '../src/types';
import { getTextEditorStyle } from '../src/utils/typography';

const baseElement = {
  id: 'text-1',
  type: 'shape',
  refId: '',
  x: 0,
  y: 0,
  w: 20,
  h: 10,
  zIndex: 1,
  opacity: 100,
  startTime: 0,
  duration: 5,
} as SceneElement;

describe('text editor typography', () => {
  it('keeps shape text editing at the configured live size and alignment', () => {
    const style = getTextEditorStyle({
      ...baseElement,
      content: '标题',
      textColor: '#ffffff',
      fontSize: 36,
      fontFamily: 'Arial',
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 1.1,
      letterSpacing: 2,
    }, {
      color: '#ffffff',
      fontSize: 36,
      defaultLineHeight: 1.1,
      padding: 14,
    });

    expect(style.fontSize).toBe('36px');
    expect(style.fontFamily).toBe('Arial');
    expect(style.fontWeight).toBe('800');
    expect(style.textAlign).toBe('center');
    expect(style.lineHeight).toBe(1.1);
    expect(style.letterSpacing).toBe('2px');
    expect(style.padding).toBe('14px');
    expect(style.alignContent).toBe('center');
  });

  it('does not fall back to a tiny editor font when editing shaped text', () => {
    const style = getTextEditorStyle(baseElement, {
      fontSize: 28,
      defaultLineHeight: 1.1,
    });

    expect(style.fontSize).toBe('28px');
    expect(style.fontSize).not.toBe('12px');
  });
});
