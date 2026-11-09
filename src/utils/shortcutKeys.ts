const MODIFIER_ALIASES: Record<string, 'Ctrl' | 'Alt' | 'Shift'> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmd: 'Ctrl',
  command: 'Ctrl',
  meta: 'Ctrl',
  win: 'Ctrl',
  super: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
};

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  space: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  del: 'Delete',
  delete: 'Delete',
  backspace: 'Backspace',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
};

const normalizeKeyName = (value: string): string => {
  if (value === ' ') return 'Space';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
  if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase();
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * Normalizes a user-entered shortcut ("Ctrl + Shift + L", "cmd+shift+l")
 * to the canonical form used for matching ("Ctrl+Shift+L").
 */
export function normalizeShortcutKey(value: string): string {
  const parts = String(value || '').replace(/＋/g, '+').split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const modifiers = new Set<'Ctrl' | 'Alt' | 'Shift'>();
  let key = '';
  parts.forEach((part) => {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) modifiers.add(modifier);
    else key = normalizeKeyName(part);
  });
  return [...(['Ctrl', 'Alt', 'Shift'] as const).filter((modifier) => modifiers.has(modifier)), key]
    .filter(Boolean)
    .join('+');
}

/** Converts a live KeyboardEvent into the same canonical shortcut string. */
export function keyboardEventToShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) modifiers.push('Ctrl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  const key = normalizeKeyName(event.key);
  if (!key) return '';
  return [...modifiers, key].join('+');
}
