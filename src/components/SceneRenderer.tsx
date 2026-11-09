import React from 'react';
import type { SceneElement } from '../types';
import { isTimelineTimeVisible } from '../core/render/timeline';

export interface SceneRenderMeta {
  isInRange: boolean;
  isVideoPrewarm: boolean;
  hasInteraction: boolean;
}

export interface SceneRendererProps {
  elements: SceneElement[];
  renderTime: number;
  isPlaying: boolean;
  isEditing: boolean;
  resolveInteraction: (element: SceneElement) => { action?: string; steps?: unknown[] };
  isParentGroupHidden: (element: SceneElement) => boolean;
  renderElement: (element: SceneElement, meta: SceneRenderMeta) => React.ReactNode;
}

/**
 * Shared layer scheduler for the editor canvas and the export player.
 * It deliberately does not render element internals yet; keeping the policy
 * here makes timeline visibility and video prewarming testable in isolation.
 */
export function getSceneRenderMeta(
  element: SceneElement,
  renderTime: number,
  isPlaying: boolean,
): SceneRenderMeta {
  const startTime = Number.isFinite(element.startTime) ? Math.max(0, element.startTime) : 0;
  const duration = Number.isFinite(element.duration) && (element.duration || 0) > 0
    ? element.duration
    : 5;
  return {
    isInRange: isTimelineTimeVisible(renderTime, startTime, duration),
    isVideoPrewarm: isPlaying
      && element.type === 'vid'
      && renderTime < startTime
      && (startTime - renderTime) <= 2.5,
    hasInteraction: false,
  };
}

export function shouldRenderSceneElement(
  meta: SceneRenderMeta,
  element: SceneElement,
  isPlaying: boolean,
  isEditing: boolean,
): boolean {
  if (element.visible === false) return false;
  if (meta.isInRange || meta.isVideoPrewarm) return true;
  // Keep video nodes mounted for the whole playback pass. Toggling their DOM
  // node at every clip boundary resets decoding and can produce a blank frame.
  if (isPlaying && (element.type === 'vid' || element.type === 'panorama-vid' || element.type === 'vfx')) return true;
  if (isPlaying || isEditing) return false;
  return meta.hasInteraction;
}

export function getOrderedSceneElements(elements: SceneElement[]): SceneElement[] {
  return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({
  elements,
  renderTime,
  isPlaying,
  isEditing,
  resolveInteraction,
  isParentGroupHidden,
  renderElement,
}) => {
  // Keep numeric z-order deterministic while preserving the source order for
  // equal z-index values (modern JS sort is stable).
  const orderedElements = React.useMemo(() => getOrderedSceneElements(elements), [elements]);

  return (
    <>
      {orderedElements.map((element) => {
        const baseMeta = getSceneRenderMeta(element, renderTime, isPlaying);
        const interaction = resolveInteraction(element);
        const meta: SceneRenderMeta = {
          ...baseMeta,
          hasInteraction: interaction.action !== 'none' || (interaction.steps?.length || 0) > 0,
        };
        if (isParentGroupHidden(element) || !shouldRenderSceneElement(meta, element, isPlaying, isEditing)) {
          return null;
        }
        return <React.Fragment key={element.id}>{renderElement(element, meta)}</React.Fragment>;
      })}
    </>
  );
};
