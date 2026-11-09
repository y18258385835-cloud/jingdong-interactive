import { describe, expect, it } from 'vitest';
import type { ProjectData, SceneElement } from '../src/types';
import { DEFAULT_THEME, applyThemeToProject, extractThemeFromProject, normalizeTheme } from '../src/utils/theme';

const element = (id: string, type: SceneElement['type'], extra: Partial<SceneElement> = {}): SceneElement => ({
  id, type, refId: '', x: 0, y: 0, w: 10, h: 10, zIndex: 1, opacity: 100, startTime: 0, duration: 5, ...extra,
});

const project = (): ProjectData => ({
  meta: { title: '主题测试' },
  start: 'scene1',
  scenes: {
    scene1: {
      id: 'scene1', alias: '场景 1', duration: 10, bgColor: '#0b1020', bgRef: '',
      els: [
        element('title', 'txt', { content: '标题', color: '#f8fafc', textColor: '#f8fafc', fontSize: 36, fontFamily: 'Inter' }),
        element('body', 'txt', { content: '正文', color: '#e2e8f0', textColor: '#e2e8f0', fontSize: 16, fontFamily: 'Inter' }),
        element('card', 'shape', { content: '卡片', backgroundColor: '#111827', borderColor: '#334155', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.4)', fontFamily: 'Inter' }),
        element('accent', 'shape', { backgroundColor: '#1d4ed8', gradientStart: '#38bdf8', gradientEnd: '#a855f7', borderRadius: 20 }),
        element('chart', 'chart', {}),
      ],
    },
    scene2: {
      id: 'scene2', alias: '场景 2', duration: 10, bgColor: '#111111', bgRef: 'asset-bg',
      els: [element('photo', 'img')],
    },
  },
} as unknown as ProjectData);

describe('theme tokens', () => {
  it('normalizes partial themes with defaults', () => {
    const theme = normalizeTheme({ colors: { primary: '#ff0000' } as any });
    expect(theme.colors.primary).toBe('#ff0000');
    expect(theme.colors.background).toBe(DEFAULT_THEME.colors.background);
    expect(theme.typography.baseSize).toBe(DEFAULT_THEME.typography.baseSize);
  });

  it('extracts common colors, typography and radius from a project', () => {
    const theme = extractThemeFromProject(project());
    expect(theme.colors.background).toBe('#0b1020');
    expect(theme.colors.text).toBe('#f8fafc');
    expect(theme.typography.fontFamily).toBe('Inter');
    expect(theme.typography.baseSize).toBe(16);
    expect(theme.typography.headingSize).toBe(36);
    expect(theme.radius).toBe(12);
  });

  it('applies only the opted-in token groups and respects background images/text effects', () => {
    const source = project();
    const next = applyThemeToProject(source, {
      ...DEFAULT_THEME,
      colors: { ...DEFAULT_THEME.colors, background: '#222222', text: '#ffcc00' },
      radius: 20,
    }, { background: true, text: true, radius: true });

    expect(next.scenes.scene1.bgColor).toBe('#222222');
    expect(next.scenes.scene2.bgColor).toBe('#111111');
    expect((next.scenes.scene1.els.find((item) => item.id === 'title') as SceneElement).textColor).toBe('#ffcc00');
    expect((next.scenes.scene1.els.find((item) => item.id === 'card') as SceneElement).borderRadius).toBe(20);
    expect((next.scenes.scene1.els.find((item) => item.id === 'accent') as SceneElement).borderRadius).toBe(20);
    expect((next.scenes.scene1.els.find((item) => item.id === 'accent') as SceneElement).backgroundColor).toBe('#1d4ed8');
    expect(next.theme?.colors.background).toBe('#222222');
  });

  it('skips text color overrides for effect presets and never touches charts', () => {
    const source = project();
    const title = source.scenes.scene1.els.find((item) => item.id === 'title') as SceneElement;
    title.textStylePreset = 'gold-neon';
    const next = applyThemeToProject(source, { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, text: '#00ff00' } }, { text: true });
    expect((next.scenes.scene1.els.find((item) => item.id === 'title') as SceneElement).textColor).toBe('#f8fafc');
    expect((next.scenes.scene1.els.find((item) => item.id === 'chart') as SceneElement)).toEqual(
      source.scenes.scene1.els.find((item) => item.id === 'chart'),
    );
  });
});
