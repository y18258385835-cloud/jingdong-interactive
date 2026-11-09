import type { SceneElement } from '../../types';
import type { AiSceneDesign, AiElementRole } from './sceneDesignGrammar';
import {
  AI_SCENE_DESIGN_CONTRACT,
  AI_SCENE_VISUAL_TOKENS,
  inferAiElementRole,
  normalizeAiElementRole,
} from './sceneDesignGrammar';
import type { AiElementDraft, AiSceneOperation } from './sceneBuilder';

type LayoutBox = Pick<SceneElement, 'x' | 'y' | 'w' | 'h'>;

const CONTROL_ROOM_LAYOUT: Partial<Record<AiElementRole, LayoutBox>> = {
  background: { x: 0, y: 0, w: 100, h: 100 },
  'page-title': { x: 6, y: 6, w: 88, h: 7 },
  'page-subtitle': { x: 6, y: 14, w: 72, h: 3.5 },
  divider: { x: 6, y: 20, w: 88, h: 0.5 },
  'primary-metric': { x: 6, y: 25, w: 27, h: 28 },
  'secondary-metric': { x: 36, y: 25, w: 27, h: 28 },
  'status-summary': { x: 66, y: 25, w: 28, h: 28 },
  'trend-analysis': { x: 6, y: 58, w: 58, h: 29 },
  'event-list': { x: 66, y: 58, w: 28, h: 29 },
  footer: { x: 6, y: 91, w: 88, h: 3 },
};

function clampBox(box: LayoutBox): LayoutBox {
  const x = Math.max(0, Math.min(96, box.x));
  const y = Math.max(0, Math.min(96, box.y));
  return {
    x,
    y,
    w: Math.max(1, Math.min(box.w, 100 - x)),
    h: Math.max(1, Math.min(box.h, 100 - y)),
  };
}

function withRole(element: AiElementDraft, role: AiElementRole): AiElementDraft {
  return { ...element, role };
}

function inferRoleWithCounts(element: AiElementDraft, counts: Map<AiElementRole, number>): AiElementRole | undefined {
  const explicit = normalizeAiElementRole(element.role);
  if (explicit) return explicit;
  const inferred = inferAiElementRole(element);
  if (inferred) return inferred;
  return undefined;
}

function applyRoleStyle(element: AiElementDraft, role: AiElementRole): AiElementDraft {
  if (role === 'page-title') return { ...element, fontSize: Math.min(element.fontSize ?? 32, 36), textAlign: element.textAlign || 'left', color: AI_SCENE_VISUAL_TOKENS.textPrimary, textColor: AI_SCENE_VISUAL_TOKENS.textPrimary };
  if (role === 'page-subtitle') return { ...element, fontSize: Math.max(12, Math.min(element.fontSize ?? 13, 14)), textAlign: element.textAlign || 'left', color: AI_SCENE_VISUAL_TOKENS.textSecondary, textColor: AI_SCENE_VISUAL_TOKENS.textSecondary };
  if (role === 'divider') return { ...element, backgroundColor: AI_SCENE_VISUAL_TOKENS.accentPrimary };
  if (role === 'footer') return { ...element, fontSize: Math.max(12, Math.min(element.fontSize ?? 12, 12)), textAlign: element.textAlign || 'left', color: AI_SCENE_VISUAL_TOKENS.textMuted, textColor: AI_SCENE_VISUAL_TOKENS.textMuted };
  if (role === 'background') return { ...element, opacity: Math.min(element.opacity ?? 18, 24), zIndex: 0, vfxColorA: AI_SCENE_VISUAL_TOKENS.accentPrimary, vfxColorB: AI_SCENE_VISUAL_TOKENS.accentSecondary };
  return element;
}

function snapToGrid(value: number | undefined, fallback: number): number {
  const next = Number.isFinite(value) ? value as number : fallback;
  const unit = AI_SCENE_DESIGN_CONTRACT.gridUnit;
  return Math.round(next / unit) * unit;
}

function applyDesignContract(element: AiElementDraft, role: AiElementRole | undefined, design: AiSceneDesign): AiElementDraft {
  const accent = role === 'status-summary' ? AI_SCENE_VISUAL_TOKENS.accentSecondary : AI_SCENE_VISUAL_TOKENS.accentPrimary;
  let next: AiElementDraft = {
    ...element,
    x: snapToGrid(element.x, 10),
    y: snapToGrid(element.y, 10),
    w: snapToGrid(element.w, 24),
    h: snapToGrid(element.h, 16),
  };

  // A visual reference is an explicit design authority. Preserve model-observed
  // composition and colors; only enforce editor-safe coordinates and dimensions.
  if (design.style === 'reference-led') {
    if (next.type === 'txt') {
      next = {
        ...next,
        fontSize: Math.max(AI_SCENE_DESIGN_CONTRACT.minTextSize, Math.min(next.fontSize ?? AI_SCENE_DESIGN_CONTRACT.bodyTextSize, 72)),
        letterSpacing: Math.max(0, Math.min(next.letterSpacing ?? 0, 2)),
      };
    }
    if (next.type === 'shape' || next.type === 'ui-component') {
      next = {
        ...next,
        borderRadius: Math.max(0, Math.min(next.borderRadius ?? 0, 24)),
        borderWidth: Math.max(0, Math.min(next.borderWidth ?? 0, 4)),
      };
    }
    return next;
  }

  if (next.type === 'txt') {
    const minimum = role === 'page-title' ? AI_SCENE_DESIGN_CONTRACT.titleMinSize : AI_SCENE_DESIGN_CONTRACT.bodyTextSize;
    const maximum = role === 'page-title' ? 36 : 24;
    const fontSize = Math.max(minimum, Math.min(next.fontSize ?? minimum, maximum));
    next = {
      ...next,
      fontSize,
      color: role === 'page-subtitle' ? AI_SCENE_VISUAL_TOKENS.textSecondary : AI_SCENE_VISUAL_TOKENS.textPrimary,
      textColor: role === 'page-subtitle' ? AI_SCENE_VISUAL_TOKENS.textSecondary : AI_SCENE_VISUAL_TOKENS.textPrimary,
      fontWeight: role === 'page-title' ? '700' : next.fontWeight || '500',
      letterSpacing: role === 'page-title' ? 0 : Math.max(-0.1, Math.min(next.letterSpacing ?? 0, 0.4)),
    };
  }

  if (next.type === 'shape' || next.type === 'ui-component') {
    next = {
      ...next,
      borderRadius: Math.max(0, Math.min(next.borderRadius ?? AI_SCENE_DESIGN_CONTRACT.maxSurfaceRadius, AI_SCENE_DESIGN_CONTRACT.maxSurfaceRadius)),
      borderWidth: Math.max(0, Math.min(next.borderWidth ?? 1, 2)),
      borderColor: next.borderColor || 'rgba(148, 163, 184, 0.22)',
    };
  }

  if (next.type === 'shape' && role !== 'divider' && !next.shapePath) {
    next = {
      ...next,
      backgroundType: next.backgroundType || 'glass',
      backgroundColor: AI_SCENE_VISUAL_TOKENS.surface,
      gradientStart: AI_SCENE_VISUAL_TOKENS.surface,
      gradientEnd: '#172B42',
      textColor: AI_SCENE_VISUAL_TOKENS.textPrimary,
    };
  }

  if (next.type === 'shape' && next.shapePath) {
    next = {
      ...next,
      backgroundType: next.backgroundType === 'solid' ? 'solid' : 'gradient',
      backgroundColor: AI_SCENE_VISUAL_TOKENS.surface,
      gradientStart: AI_SCENE_VISUAL_TOKENS.surface,
      gradientVia: AI_SCENE_VISUAL_TOKENS.accentPrimary,
      gradientEnd: AI_SCENE_VISUAL_TOKENS.accentSecondary,
      borderColor: 'rgba(148, 163, 184, 0.22)',
    };
  }

  if (next.type === 'ui-component') {
    const data = next.uiComponentData && typeof next.uiComponentData === 'object' ? next.uiComponentData : {};
    next = {
      ...next,
      uiComponentData: {
        ...data,
        color: accent,
        accentColor: accent,
        surfaceColor: AI_SCENE_VISUAL_TOKENS.surface,
        textColor: AI_SCENE_VISUAL_TOKENS.textPrimary,
        mutedColor: AI_SCENE_VISUAL_TOKENS.textSecondary,
        borderColor: 'rgba(148, 163, 184, 0.22)',
        radius: AI_SCENE_DESIGN_CONTRACT.maxSurfaceRadius,
        density: design.density,
        aiDesignContract: 'industrial-instrument-v1',
      },
    };
  }

  if (next.type === 'chart') {
    const chartColors = [AI_SCENE_VISUAL_TOKENS.accentPrimary, AI_SCENE_VISUAL_TOKENS.accentSecondary, '#38BDF8', '#F59E0B'];
    next = {
      ...next,
      chartColors,
      chartData: Array.isArray(next.chartData)
        ? next.chartData.map((point, index) => ({ ...point, color: chartColors[index % chartColors.length] }))
        : next.chartData,
    };
  }

  if (next.type === 'vfx' || next.type === 'saber') {
    next = {
      ...next,
      opacity: Math.min(next.opacity ?? 18, AI_SCENE_DESIGN_CONTRACT.maxBackgroundEffectOpacity),
      vfxColorA: AI_SCENE_VISUAL_TOKENS.accentPrimary,
      vfxColorB: AI_SCENE_VISUAL_TOKENS.accentSecondary,
      saberGlowColor: AI_SCENE_VISUAL_TOKENS.accentPrimary,
      saberSecondaryGlowColor: AI_SCENE_VISUAL_TOKENS.accentSecondary,
      saberCoreColor: AI_SCENE_VISUAL_TOKENS.textPrimary,
    };
  }

  return next;
}

export function layoutAiOperations(operations: AiSceneOperation[], design: AiSceneDesign): AiSceneOperation[] {
  const layout = CONTROL_ROOM_LAYOUT;
  const counts = new Map<AiElementRole, number>();
  return operations.map((operation) => {
    if (operation.kind === 'create-scene') {
      return design.style === 'reference-led'
        ? { ...operation }
        : { ...operation, bgColor: AI_SCENE_VISUAL_TOKENS.background };
    }
    if (operation.kind !== 'create-element') return operation;
    const role = inferRoleWithCounts(operation.element, counts);
    if (!role) return { ...operation, element: applyDesignContract(operation.element, undefined, design) };
    counts.set(role, (counts.get(role) || 0) + 1);
    const box = layout[role];
    const styledElement = design.style === 'reference-led'
      ? withRole(operation.element, role)
      : applyRoleStyle(withRole(operation.element, role), role);
    const nextElement = applyDesignContract(styledElement, role, design);
    if (!box || design.layoutTemplate !== 'control-room-overview') return { ...operation, element: nextElement };
    return { ...operation, element: { ...nextElement, ...clampBox(box) } };
  });
}
