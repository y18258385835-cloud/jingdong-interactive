import type { ProjectData, SceneElement, ThemeTokens } from '../types';

export const DEFAULT_THEME: ThemeTokens = {
  name: 'AETHER 深空',
  colors: {
    background: '#080b16',
    surface: '#111827',
    primary: '#38bdf8',
    accent: '#a855f7',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.14)',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    baseSize: 16,
    headingSize: 32,
  },
  radius: 14,
  shadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
};

export interface ApplyThemeOptions {
  background?: boolean;
  text?: boolean;
  typography?: boolean;
  radius?: boolean;
  shadow?: boolean;
}

const isColor = (value: unknown): value is string => (
  typeof value === 'string'
  && value.trim().length > 0
  && value !== 'transparent'
  && value !== 'none'
  && !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(value.trim())
);

const isNeutralColor = (value: string): boolean => {
  const hex = value.trim().replace('#', '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) return false;
  const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max - min < 24 || max > 238 || max < 18;
};

const mostCommon = (values: Array<unknown>, fallback: string): string => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    if (!isColor(value)) return;
    const key = value.trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let winner = fallback;
  let max = 0;
  counts.forEach((count, value) => {
    if (count > max) { max = count; winner = value; }
  });
  return winner;
};

const mostCommonNumber = (values: Array<unknown>, fallback: number): number => {
  const counts = new Map<number, number>();
  values.forEach((value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return;
    counts.set(number, (counts.get(number) || 0) + 1);
  });
  let winner = fallback;
  let max = 0;
  counts.forEach((count, value) => {
    if (count > max) { max = count; winner = value; }
  });
  return winner;
};

export function normalizeTheme(input?: Partial<ThemeTokens> | null): ThemeTokens {
  return {
    ...DEFAULT_THEME,
    ...(input || {}),
    colors: { ...DEFAULT_THEME.colors, ...(input?.colors || {}) },
    typography: { ...DEFAULT_THEME.typography, ...(input?.typography || {}) },
  };
}

/** Extract a practical theme from the most common colors/sizes in the project. */
export function extractThemeFromProject(project: ProjectData): ThemeTokens {
  const scenes = Object.values(project.scenes || {});
  const elements = scenes.flatMap((scene) => scene.els || []);
  const textElements = elements.filter((element) => element.type === 'txt');
  const shapes = elements.filter((element) => element.type === 'shape');

  const background = mostCommon(
    scenes.filter((scene) => !scene.bgRef).map((scene) => scene.bgColor),
    DEFAULT_THEME.colors.background,
  );
  const text = mostCommon(textElements.map((element) => element.textColor || element.color), DEFAULT_THEME.colors.text);
  const surface = mostCommon(shapes.map((element) => element.backgroundColor), DEFAULT_THEME.colors.surface);
  const border = mostCommon(shapes.map((element) => element.borderColor), DEFAULT_THEME.colors.border);
  const candidates = mostCommon(
    elements.flatMap((element) => [
      element.color,
      element.gradientStart,
      element.gradientVia,
      element.gradientEnd,
      element.borderColor,
    ].filter((value) => value && value !== text && value !== background && value !== surface && value !== border && !isNeutralColor(value))),
    DEFAULT_THEME.colors.primary,
  );
  const accent = mostCommon(
    elements.flatMap((element) => [element.gradientEnd, element.gradientVia].filter((value) => value && value !== candidates && !isNeutralColor(value))),
    DEFAULT_THEME.colors.accent,
  );
  const baseSize = mostCommonNumber(
    textElements.filter((element) => Number(element.fontSize) < 24).map((element) => element.fontSize),
    DEFAULT_THEME.typography.baseSize,
  );
  const headingSize = mostCommonNumber(
    textElements.filter((element) => Number(element.fontSize) >= 24).map((element) => element.fontSize),
    DEFAULT_THEME.typography.headingSize,
  );
  const fontFamily = mostCommon(
    textElements.map((element) => element.fontFamily),
    DEFAULT_THEME.typography.fontFamily,
  );
  const radius = mostCommonNumber(shapes.map((element) => element.borderRadius), DEFAULT_THEME.radius);
  const shadow = shapes.map((element) => element.boxShadow).find((value) => typeof value === 'string' && value !== 'none') || DEFAULT_THEME.shadow;

  return normalizeTheme({
    name: '从当前工程提取',
    colors: {
      background,
      surface,
      primary: candidates,
      accent,
      text,
      textSecondary: mostCommon(textElements.map((element) => element.color), DEFAULT_THEME.colors.textSecondary),
      border,
    },
    typography: { fontFamily, baseSize, headingSize },
    radius,
    shadow,
  });
}

const applyText = (element: SceneElement, theme: ThemeTokens): SceneElement => {
  if (element.type === 'txt') {
    if (element.textStylePreset && element.textStylePreset !== 'none') return element;
    return { ...element, color: theme.colors.text, textColor: theme.colors.text };
  }
  if (element.type === 'shape' && element.content) {
    return { ...element, textColor: theme.colors.text };
  }
  return element;
};

const applyTypography = (element: SceneElement, theme: ThemeTokens): SceneElement => {
  if (element.type === 'txt') {
    const previousSize = Number(element.fontSize) || theme.typography.baseSize;
    return {
      ...element,
      fontFamily: theme.typography.fontFamily,
      fontSize: previousSize >= 24 ? theme.typography.headingSize : theme.typography.baseSize,
    };
  }
  if (element.type === 'shape' && element.content) {
    return { ...element, fontFamily: theme.typography.fontFamily };
  }
  return element;
};

const applyRadius = (element: SceneElement, theme: ThemeTokens): SceneElement => {
  if (element.type !== 'shape') return element;
  if (!Number(element.borderRadius)) return element;
  return { ...element, borderRadius: theme.radius };
};

const applyShadow = (element: SceneElement, theme: ThemeTokens): SceneElement => {
  if (element.type !== 'shape' || !element.boxShadow || element.boxShadow === 'none') return element;
  return { ...element, boxShadow: theme.shadow };
};

/** Applies selected token groups to existing layers. Only edits fields the user opted into. */
export function applyThemeToProject(
  project: ProjectData,
  themeInput: Partial<ThemeTokens>,
  options: ApplyThemeOptions,
): ProjectData {
  const theme = normalizeTheme(themeInput);
  const scenes = Object.fromEntries(Object.entries(project.scenes).map(([sceneId, scene]) => {
    const nextElements = (scene.els || []).map((element) => {
      let next = element;
      if (options.text) next = applyText(next, theme);
      if (options.typography) next = applyTypography(next, theme);
      if (options.radius) next = applyRadius(next, theme);
      if (options.shadow) next = applyShadow(next, theme);
      return next;
    });
    return [sceneId, {
      ...scene,
      ...(options.background && !scene.bgRef ? { bgColor: theme.colors.background } : {}),
      els: nextElements,
    }];
  }));
  return { ...project, theme, scenes };
}
