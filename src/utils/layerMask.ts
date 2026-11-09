import type { SceneElement } from '../types';

export type LayerMaskType = 'rectangle' | 'ellipse' | 'rounded' | 'diamond' | 'hexagon' | 'pen';

export interface LayerMaskNode {
  x: number;
  y: number;
}

export interface LayerMaskConfig {
  enabled?: boolean;
  type?: LayerMaskType;
  invert?: boolean;
  feather?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  nodes?: LayerMaskNode[];
  sourceElementId?: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const normalizeLayerMask = (element: Pick<SceneElement, 'maskEnabled' | 'maskType' | 'maskInvert' | 'maskFeather' | 'maskX' | 'maskY' | 'maskWidth' | 'maskHeight' | 'maskRadius' | 'maskNodes' | 'maskSourceElementId'>): Required<Pick<LayerMaskConfig, 'enabled' | 'type' | 'invert' | 'feather' | 'x' | 'y' | 'width' | 'height' | 'radius'>> & { nodes: LayerMaskNode[]; sourceElementId: string } => {
  // A newly enabled mask should be visibly editable. Keep legacy rectangles
  // inside the layer so a stale edge value cannot collapse on resize.
  const x = clamp(Number(element.maskX ?? 10), 0, 99);
  const y = clamp(Number(element.maskY ?? 10), 0, 99);
  const width = clamp(Number(element.maskWidth ?? 80), 1, Math.max(1, 100 - x));
  const height = clamp(Number(element.maskHeight ?? 80), 1, Math.max(1, 100 - y));
  return {
    enabled: element.maskEnabled === true,
    type: element.maskType || 'rectangle',
    invert: element.maskInvert === true,
    feather: clamp(Number(element.maskFeather ?? 0), 0, 40),
    x,
    y,
    width,
    height,
    radius: clamp(Number(element.maskRadius ?? 12), 0, 50),
    nodes: Array.isArray(element.maskNodes) ? element.maskNodes.map((node) => ({ x: clamp(Number(node.x) || 0, 0, 100), y: clamp(Number(node.y) || 0, 0, 100) })) : [],
    sourceElementId: String(element.maskSourceElementId || ''),
  };
};

export function layerMaskPolygon(mask: LayerMaskConfig): string {
  const x = Number(mask.x ?? 0);
  const y = Number(mask.y ?? 0);
  const w = Number(mask.width ?? 100);
  const h = Number(mask.height ?? 100);
  if (mask.type === 'pen' && mask.nodes && mask.nodes.length >= 3) {
    return mask.nodes.map((node) => `${clamp(Number(node.x), 0, 100)}% ${clamp(Number(node.y), 0, 100)}%`).join(', ');
  }
  if (mask.type === 'diamond') return `${x + w / 2}% ${y}%, ${x + w}% ${y + h / 2}%, ${x + w / 2}% ${y + h}%, ${x}% ${y + h / 2}%`;
  if (mask.type === 'hexagon') return `${x + w * .22}% ${y}%, ${x + w * .78}% ${y}%, ${x + w}% ${y + h / 2}%, ${x + w * .78}% ${y + h}%, ${x + w * .22}% ${y + h}%, ${x}% ${y + h / 2}%`;
  return `${x}% ${y}%, ${x + w}% ${y}%, ${x + w}% ${y + h}%, ${x}% ${y + h}%`;
}

export function getLayerMaskClipPath(element: SceneElement): string | undefined {
  const mask = normalizeLayerMask(element);
  if (!mask.enabled) return undefined;
  if (mask.type === 'ellipse') return `ellipse(${mask.width / 2}% ${mask.height / 2}% at ${mask.x + mask.width / 2}% ${mask.y + mask.height / 2}%)`;
  if (mask.type === 'rounded') {
    const radius = clamp(mask.radius, 0, 50);
    return `inset(${mask.y}% ${100 - mask.x - mask.width}% ${100 - mask.y - mask.height}% ${mask.x}% round ${radius}%)`;
  }
  return `polygon(${layerMaskPolygon(mask)})`;
}

export function getLayerMaskId(elementId: string): string {
  return `aether-layer-mask-${elementId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}
