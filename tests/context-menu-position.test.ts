import { describe, expect, it } from 'vitest';
import { getContextTargetMenuPosition } from '../src/utils/contextMenuPosition';

describe('context target menu position', () => {
  it('keeps a long scene menu inside the viewport when opened near the lower right corner', () => {
    expect(getContextTargetMenuPosition(1900, 1050, 1920, 1080)).toEqual({ left: 1688, top: 552 });
  });

  it('keeps a menu usable in a small viewport', () => {
    expect(getContextTargetMenuPosition(0, 0, 300, 400)).toEqual({ left: 8, top: 8 });
  });
});
