/**
 * Legacy layers may omit `visible`; they are visible by default.
 */
export function isLayerVisible(visible: boolean | undefined): boolean {
  return visible !== false;
}

export function getNextLayerVisibility(visible: boolean | undefined): boolean {
  return !isLayerVisible(visible);
}
