import type { SceneElement } from '../../types';
import { shiftKeyframes } from '../animation/keyframes';

const roundTime = (value: number) => Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);

/** Clone an element tree without retaining references to editable nested data. */
export function cloneSceneElement(element: SceneElement): SceneElement {
  // structuredClone is substantially faster for large custom-code/keyframe
  // payloads and avoids the intermediate JSON string allocation. Keep the
  // JSON fallback for older embedded browsers.
  if (typeof structuredClone === 'function') return structuredClone(element);
  return JSON.parse(JSON.stringify(element)) as SceneElement;
}

/**
 * Create pasted copies while keeping the selection's relative timing. Group
 * children receive fresh IDs as well, and scene-time keyframes follow each
 * element when its start time changes.
 */
export function createPastedElements(
  sources: SceneElement[],
  insertionTime: number,
  topZIndex: number,
  positionOffset = 4,
): SceneElement[] {
  if (sources.length === 0) return [];
  const baseStart = Math.min(...sources.map((source) => Number(source.startTime) || 0));
  const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const cloneTree = (
    source: SceneElement,
    startTime: number,
    parentId?: string,
    isRoot = false,
    rootIndex = 0,
  ): SceneElement => {
    const cloned = cloneSceneElement(source);
    const id = makeId(source.type === 'group' ? 'grp' : 'el');
    const originalStart = Number(source.startTime) || 0;
    const nextStart = roundTime(startTime);
    const delta = nextStart - originalStart;

    cloned.id = id;
    cloned.startTime = nextStart;
    if (isRoot) {
      cloned.x = Math.max(0, Math.min(95, (source.x ?? 20) + positionOffset));
      cloned.y = Math.max(0, Math.min(90, (source.y ?? 20) + positionOffset));
      cloned.zIndex = topZIndex + rootIndex * 10;
    }
    if (parentId) cloned.groupId = parentId;
    if (cloned.keyframes?.tracks?.length) cloned.keyframes = shiftKeyframes(source, delta);
    if (Array.isArray(source.children)) {
      cloned.children = source.children.map((child) => cloneTree(
        child,
        insertionTime + ((Number(child.startTime) || 0) - baseStart),
        id,
      ));
    }
    return cloned;
  };

  return sources.map((source, index) => cloneTree(
    source,
    insertionTime + ((Number(source.startTime) || 0) - baseStart),
    undefined,
    true,
    index,
  ));
}
