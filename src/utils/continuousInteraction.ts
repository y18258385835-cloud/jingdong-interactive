import type { ContinuousInteractionConfig, ContinuousInteractionNode, PopupConfig } from '../types';
import { createDefaultPopup } from './popups';

const clamp = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export const createDefaultContinuousInteraction = (): Required<Pick<ContinuousInteractionConfig, 'enabled' | 'mode' | 'axis' | 'resetPolicy' | 'popupPolicy' | 'label'>> & { nodes: ContinuousInteractionNode[] } => ({
  enabled: true,
  mode: 'confirm',
  axis: 'horizontal',
  resetPolicy: 'retain',
  popupPolicy: 'lock',
  label: '向右滑动以继续',
  nodes: [
    { id: 'start', position: 0, role: 'start', label: '起始', retrigger: 'once' },
    { id: 'end', position: 100, role: 'end', label: '完成', interaction: { action: 'none' }, retrigger: 'once' },
  ],
});

/** Default for continuous UI controls that should visibly communicate a journey. */
export const createMultiStageContinuousInteraction = () => {
  const config = createDefaultContinuousInteraction();
  return {
    ...config,
    nodes: [
      config.nodes[0],
      { id: 'checkpoint-mid', position: 50, role: 'checkpoint' as const, label: '中段', interaction: { action: 'none' as const }, retrigger: 'once' as const },
      config.nodes[1],
    ],
  };
};

/** Normalizes malformed or legacy project data without mutating the project. */
export const normalizeContinuousInteraction = (config?: ContinuousInteractionConfig) => {
  const fallback = createDefaultContinuousInteraction();
  const configured = Array.isArray(config?.nodes) ? config.nodes : fallback.nodes;
  const byRole = new Map(configured.map((node) => [node.role, node]));
  const checkpoints = configured
    .filter((node) => node.role === 'checkpoint')
    .slice(0, 6)
    .map((node, index) => ({
      ...node,
      id: node.id || `checkpoint-${index + 1}`,
      position: clamp(node.position),
      retrigger: node.retrigger || 'once' as const,
    }))
    .sort((a, b) => a.position - b.position);
  const start = { ...fallback.nodes[0], ...byRole.get('start'), position: 0, role: 'start' as const };
  const end = { ...fallback.nodes[1], ...byRole.get('end'), position: 100, role: 'end' as const };
  return {
    ...fallback,
    ...config,
    nodes: [start, ...checkpoints, end],
  };
};

/** Returns only the nodes crossed in the current direction, in travel order. */
export const getCrossedContinuousNodes = (
  previous: number,
  next: number,
  config?: ContinuousInteractionConfig,
): ContinuousInteractionNode[] => {
  const nodes = normalizeContinuousInteraction(config).nodes;
  const from = clamp(previous);
  const to = clamp(next);
  if (from === to) return [];
  if (to > from) return nodes.filter((node) => node.role !== 'start' && node.position > from && node.position <= to);
  return nodes.filter((node) => node.role !== 'end' && node.position < from && node.position >= to).reverse();
};

export const nextContinuousCheckpointPosition = (config?: ContinuousInteractionConfig) => {
  const nodes = normalizeContinuousInteraction(config).nodes;
  let best = { start: 0, end: 100, size: -1 };
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const start = nodes[index].position;
    const end = nodes[index + 1].position;
    if (end - start > best.size) best = { start, end, size: end - start };
  }
  return Math.round((best.start + best.end) / 2);
};

/** Removes one editable checkpoint while preserving the fixed start/end anchors. */
export const removeContinuousCheckpoint = (config: ContinuousInteractionConfig | undefined, id: string) => {
  const normalized = normalizeContinuousInteraction(config);
  const target = normalized.nodes.find((node) => node.id === id);
  if (!target || target.role !== 'checkpoint') return normalized;
  return {
    ...normalized,
    activeNodeId: normalized.activeNodeId === id ? undefined : normalized.activeNodeId,
    nodes: normalized.nodes.filter((node) => node.id !== id),
  };
};

/**
 * Resolves one continuous-interaction node to the same complete popup record in
 * both the editor overlay and the preview runtime. Continuous nodes default to
 * free sizing; legacy nodes that only stored a width inherit that width as their
 * height instead of leaking popup fields from the owning UI component.
 */
export const resolveContinuousNodePopup = (
  node: ContinuousInteractionNode,
  popupIndex: number,
): PopupConfig => {
  const defaults = createDefaultPopup(popupIndex);
  const popup = {
    ...defaults,
    popupRatio: 'free' as const,
    popupHeight: defaults.popupWidth,
    id: `continuous-${node.id}`,
    enabled: true,
    ...node.popup,
    target: node.interaction?.target,
  };

  if (popup.popupRatio === 'free' && node.popup?.popupHeight == null) {
    popup.popupHeight = node.popup?.popupWidth ?? defaults.popupWidth;
  }

  return popup;
};
