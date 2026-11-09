import type { AiSceneOperation } from './sceneBuilder';
import { AI_SCENE_DESIGN_CONTRACT, AI_SCENE_VISUAL_TOKENS, inferAiElementRole } from './sceneDesignGrammar';

export interface AiVisualIssue {
  code: 'bounds' | 'overlap' | 'typography' | 'contrast' | 'palette' | 'spacing' | 'effects' | 'hierarchy';
  severity: 'error' | 'warning';
  message: string;
  elementIds?: string[];
}

type RGB = [number, number, number];

function parseColor(value: unknown): RGB | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split('').map((part) => `${part}${part}`).join('') : hex[1];
    return [Number.parseInt(raw.slice(0, 2), 16), Number.parseInt(raw.slice(2, 4), 16), Number.parseInt(raw.slice(4, 6), 16)];
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

function relativeLuminance([r, g, b]: RGB): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: RGB, background: RGB): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function isGridAligned(value: number): boolean {
  const unit = AI_SCENE_DESIGN_CONTRACT.gridUnit;
  return Math.abs(value / unit - Math.round(value / unit)) < 0.001;
}

function addColor(colors: Set<string>, value: unknown) {
  const parsed = parseColor(value);
  if (parsed && Math.max(...parsed) - Math.min(...parsed) > 24) colors.add(parsed.join(','));
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
}

export function auditAiOperations(operations: AiSceneOperation[]): AiVisualIssue[] {
  const elements = operations
    .filter((operation): operation is Extract<AiSceneOperation, { kind: 'create-element' }> => operation.kind === 'create-element')
    .map((operation, index) => ({ operation, index, sceneId: operation.sceneId || 'new-scene', element: operation.element }));
  const issues: AiVisualIssue[] = [];
  const visualElements = elements.filter(({ element }) => element.type !== 'vfx' && element.type !== 'saber');
  const accentColors = new Set<string>();
  const titleElements = elements.filter(({ element }) => inferAiElementRole(element) === 'page-title');

  elements.forEach(({ element }) => {
    const id = typeof element.id === 'string' ? element.id : element.name || `element-${elements.findIndex((entry) => entry.element === element) + 1}`;
    const x = element.x ?? 0;
    const y = element.y ?? 0;
    const w = element.w ?? 0;
    const h = element.h ?? 0;
    if (x < 0 || y < 0 || x + w > 100 || y + h > 100) {
      issues.push({ code: 'bounds', severity: 'error', message: '存在超出画布边界的图层。', elementIds: [id] });
    }
    if (element.type === 'txt' && element.fontSize !== undefined && element.fontSize < 12) {
      issues.push({ code: 'typography', severity: 'error', message: '文字字号低于 12px，可能影响可读性。', elementIds: [id] });
    }
    if (element.type === 'txt' || element.type === 'shape' || element.type === 'ui-component') {
      const foreground = parseColor(element.textColor || element.color || (element.uiComponentData && element.uiComponentData.textColor));
      const background = parseColor(element.type === 'txt' ? AI_SCENE_VISUAL_TOKENS.background : element.backgroundColor || (element.uiComponentData && element.uiComponentData.surfaceColor) || AI_SCENE_VISUAL_TOKENS.surface);
      if (foreground && background && contrastRatio(foreground, background) < 4.5) {
        issues.push({ code: 'contrast', severity: 'error', message: '文字与表面背景对比度不足，无法保证阅读清晰度。', elementIds: [id] });
      }
    }
    if (element.type === 'shape' || element.type === 'ui-component' || element.type === 'chart') {
      addColor(accentColors, element.backgroundColor);
      addColor(accentColors, element.borderColor);
      addColor(accentColors, element.color);
      addColor(accentColors, element.uiComponentData && element.uiComponentData.accentColor);
      (element.chartColors || []).forEach((color) => addColor(accentColors, color));
    }
    if (element.type !== 'vfx' && element.type !== 'saber' && ![element.x, element.y, element.w, element.h].every((value) => isGridAligned(value ?? 0))) {
      issues.push({ code: 'spacing', severity: 'warning', message: '图层未对齐 0.5 单位网格，已按设计契约校正。', elementIds: [id] });
    }
    if (element.type === 'vfx' && (element.opacity ?? 100) > AI_SCENE_DESIGN_CONTRACT.maxBackgroundEffectOpacity) {
      issues.push({ code: 'effects', severity: 'error', message: '背景特效透明度过高，会压低内容层级。', elementIds: [id] });
    }
  });

  for (let index = 0; index < visualElements.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < visualElements.length; nextIndex += 1) {
      const first = visualElements[index].element;
      const second = visualElements[nextIndex].element;
      if (visualElements[index].sceneId !== visualElements[nextIndex].sceneId) continue;
      if (overlaps({ x: first.x ?? 0, y: first.y ?? 0, w: first.w ?? 0, h: first.h ?? 0 }, { x: second.x ?? 0, y: second.y ?? 0, w: second.w ?? 0, h: second.h ?? 0 })) {
        const firstId = typeof first.id === 'string' ? first.id : first.name || `element-${index + 1}`;
        const secondId = typeof second.id === 'string' ? second.id : second.name || `element-${nextIndex + 1}`;
        // 应用阶段已有 12 列避让算法；重叠是可修复的布局提示，不应阻塞用户确认。
        issues.push({ code: 'overlap', severity: 'warning', message: '图层之间存在重叠，应用时会自动避让。', elementIds: [firstId, secondId] });
      }
    }
  }

  const effects = elements.filter(({ element }) => element.type === 'vfx');
  if (effects.length > AI_SCENE_DESIGN_CONTRACT.maxBackgroundEffects) issues.push({ code: 'effects', severity: 'error', message: '一个场景最多使用一个背景特效。' });
  if (effects.length === 1) {
    const firstCreateElementIndex = operations.findIndex((operation) => operation.kind === 'create-element');
    const effectIndex = operations.findIndex((operation) => operation.kind === 'create-element' && operation.element.type === 'vfx');
    if (effectIndex !== firstCreateElementIndex) issues.push({ code: 'effects', severity: 'warning', message: '背景特效应作为第一层创建。' });
  }

  const roles = new Set(elements.map(({ element }) => inferAiElementRole(element)).filter(Boolean));
  if (!roles.has('page-title')) issues.push({ code: 'hierarchy', severity: 'warning', message: '方案缺少明确的页面标题。' });
  if (titleElements.length > 1) issues.push({ code: 'hierarchy', severity: 'warning', message: '方案包含多个页面主标题，应保留一个视觉焦点。' });
  if (accentColors.size > AI_SCENE_DESIGN_CONTRACT.maxAccentColors) {
    issues.push({ code: 'palette', severity: 'warning', message: `方案使用了 ${accentColors.size} 种强调色，建议收敛到 ${AI_SCENE_DESIGN_CONTRACT.maxAccentColors} 种以内。` });
  }
  return issues;
}
