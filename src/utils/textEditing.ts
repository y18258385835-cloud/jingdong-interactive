const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CANVAS']);

export type TextSelectionInfo = {
  text: string;
  textKey: string;
  start: number;
  end: number;
};

export const getTextAreaSelection = (element: HTMLTextAreaElement): TextSelectionInfo | null => {
  const start = element.selectionStart ?? 0;
  const end = element.selectionEnd ?? start;
  const text = element.value.slice(start, end);
  if (!text.trim() || end <= start) return null;
  return { text, textKey: element.dataset.aetherTextKey || 'text-0', start, end };
};

const isTextCandidate = (element: HTMLElement) => {
  if (SKIP_TAGS.has(element.tagName) || element.closest('svg, style, script, input, textarea, select, option, canvas')) return false;
  if (!element.textContent?.trim()) return false;
  return element.children.length === 0;
};

/**
 * Finds text leaves without renumbering labels that a running component has
 * already registered. Chart scripts often append labels after startup; keeping
 * their existing keys prevents a saved value from being applied to another
 * label after a redraw.
 */
export const collectEditableTextElements = (root: Element): HTMLElement[] => {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('*')).filter(isTextCandidate);
  const assigned = new Set<string>();
  const reserved = new Set(elements
    .map((element) => element.dataset.aetherTextKey)
    .filter((key): key is string => /^text-\d+$/.test(key || '')));
  let nextIndex = 0;

  elements.forEach((element) => {
    const existing = element.dataset.aetherTextKey;
    if (existing && /^text-\d+$/.test(existing) && !assigned.has(existing)) {
      assigned.add(existing);
      return;
    }
    while (reserved.has(`text-${nextIndex}`) || assigned.has(`text-${nextIndex}`)) nextIndex += 1;
    const key = `text-${nextIndex}`;
    element.dataset.aetherTextKey = key;
    reserved.add(key);
    assigned.add(key);
    nextIndex += 1;
  });

  return elements;
};

export const applyTextOverrides = (elements: HTMLElement[], overrides?: Record<string, string>) => {
  if (!overrides) return;
  elements.forEach((element) => {
    const value = overrides[element.dataset.aetherTextKey || ''];
    if (typeof value === 'string' && element.textContent !== value) element.textContent = value;
  });
};
