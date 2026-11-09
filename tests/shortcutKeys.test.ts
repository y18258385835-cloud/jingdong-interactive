import { describe, expect, it } from 'vitest';
import { keyboardEventToShortcut, normalizeShortcutKey } from '../src/utils/shortcutKeys';

describe('shortcutKeys', () => {
  it('normalizes modifier order and aliases', () => {
    expect(normalizeShortcutKey('shift + ctrl + l')).toBe('Ctrl+Shift+L');
    expect(normalizeShortcutKey('cmd+alt+r')).toBe('Ctrl+Alt+R');
    expect(normalizeShortcutKey('Ctrl+Shift+Space')).toBe('Ctrl+Shift+Space');
    expect(normalizeShortcutKey('Ctrl+Shift+ArrowLeft')).toBe('Ctrl+Shift+ArrowLeft');
  });

  it('converts keyboard events to canonical keys', () => {
    expect(keyboardEventToShortcut({ key: 'L', ctrlKey: true, altKey: true, shiftKey: true, metaKey: false })).toBe('Ctrl+Alt+Shift+L');
    expect(keyboardEventToShortcut({ key: 'ArrowUp', ctrlKey: false, altKey: false, shiftKey: true, metaKey: false })).toBe('Shift+ArrowUp');
    expect(keyboardEventToShortcut({ key: ' ', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false })).toBe('Space');
    expect(keyboardEventToShortcut({ key: 'Meta', ctrlKey: false, altKey: false, shiftKey: false, metaKey: true })).toBe('Ctrl+Meta');
  });
});
