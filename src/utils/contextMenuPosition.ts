export const CONTEXT_TARGET_MENU_WIDTH = 224;
export const CONTEXT_TARGET_MENU_MAX_HEIGHT = 520;

export function getContextTargetMenuPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  menuWidth = CONTEXT_TARGET_MENU_WIDTH,
  menuMaxHeight = CONTEXT_TARGET_MENU_MAX_HEIGHT,
): { left: number; top: number } {
  const gutter = 8;
  return {
    left: Math.max(gutter, Math.min(x, Math.max(gutter, viewportWidth - menuWidth - gutter))),
    top: Math.max(gutter, Math.min(y, Math.max(gutter, viewportHeight - menuMaxHeight - gutter))),
  };
}
