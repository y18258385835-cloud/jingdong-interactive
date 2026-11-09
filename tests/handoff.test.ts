import { describe, expect, it } from 'vitest';
import type { Scene, SceneElement } from '../src/types';
import {
  buildHandoffHTML,
  buildHandoffSpec,
  buildSceneHandoffSpecs,
  getElementDisplayName,
} from '../src/utils/handoff';

const CANVAS = { width: 1920, height: 1080 };

const element = (id: string, type: SceneElement['type'], extra: Partial<SceneElement> = {}): SceneElement => ({
  id,
  type,
  refId: '',
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  zIndex: 1,
  opacity: 100,
  startTime: 0,
  duration: 5,
  ...extra,
});

const scene = (elements: SceneElement[]): Scene => ({
  id: 'scene1',
  alias: '首屏',
  type: 'scene',
  duration: 10,
  els: elements,
});

const title = element('title', 'txt', {
  sourceName: '主标题',
  x: 10,
  y: 10,
  w: 20,
  h: 10,
  zIndex: 12,
  content: '让每个像素获得生命',
  color: '#ffffff',
  textColor: '#f8fafc',
  fontSize: 48,
  fontWeight: '700',
  fontFamily: 'Inter',
  lineHeight: 1.25,
  letterSpacing: 1,
  textAlign: 'center',
});

const label = element('label', 'shape', {
  sourceName: '标签',
  x: 36,
  y: 10,
  w: 10,
  h: 10,
  backgroundColor: '#111827',
  borderWidth: 1,
  borderColor: '#334155',
  borderRadius: 14,
  boxShadow: '0 12px 30px rgba(0,0,0,.4)',
  content: '标签文字',
  textColor: '#e2e8f0',
});

const card = element('card', 'shape', {
  sourceName: '卡片',
  x: 50,
  y: 30,
  w: 25,
  h: 30,
  backgroundType: 'gradient',
  gradientType: 'linear',
  gradientAngle: 135,
  gradientStart: '#06b6d4',
  gradientVia: '#3b82f6',
  gradientEnd: '#9333ea',
});

const image = element('image', 'img', {
  sourceName: '背景图',
  x: 5,
  y: 60,
  w: 20,
  h: 20,
  refId: 'asset-背景图',
  mediaAspect: 1.7778,
});

const demoScene = () => scene([title, label, card, image]);

describe('handoff specs', () => {
  it('converts percentages to canvas pixels and measures scene edges', () => {
    const spec = buildHandoffSpec(title, demoScene(), CANVAS);
    expect(spec.layout).toMatchObject({ x: 192, y: 108, w: 384, h: 108, zIndex: 12 });
    expect(spec.spacing).toEqual({ left: 192, top: 108, right: 1344, bottom: 864 });
    expect(spec.percent).toEqual({ x: 10, y: 10, w: 20, h: 10 });
  });

  it('finds the nearest layer on each side', () => {
    const spec = buildHandoffSpec(title, demoScene(), CANVAS);
    const right = spec.neighbors.find((neighbor) => neighbor.direction === 'right');
    expect(right?.elementId).toBe('label');
    expect(right?.gap).toBe(115.2);

    const labelSpec = buildHandoffSpec(label, demoScene(), CANVAS);
    expect(labelSpec.neighbors.find((neighbor) => neighbor.direction === 'left')?.gap).toBe(115.2);
  });

  it('collects typography, appearance and CSS for text and shapes', () => {
    const textSpec = buildHandoffSpec(title, demoScene(), CANVAS);
    expect(textSpec.typeLabel).toBe('文本');
    expect(textSpec.typography).toMatchObject({
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: '700',
      color: '#f8fafc',
      content: '让每个像素获得生命',
    });
    expect(textSpec.css).toContain('left: 192px;');
    expect(textSpec.css).toContain('font-size: 48px;');
    expect(textSpec.css).toContain('color: #f8fafc;');

    const shapeSpec = buildHandoffSpec(label, demoScene(), CANVAS);
    expect(shapeSpec.appearance).toMatchObject({
      background: '#111827',
      border: '1px solid #334155',
      radius: 14,
    });
    expect(shapeSpec.css).toContain('border-radius: 14px;');
    expect(shapeSpec.css).toContain('box-shadow: 0 12px 30px rgba(0,0,0,.4);');
    expect(shapeSpec.typography?.content).toBe('标签文字');
  });

  it('describes gradients and asset metadata', () => {
    const cardSpec = buildHandoffSpec(card, demoScene(), CANVAS);
    expect(cardSpec.appearance.background).toBe('linear-gradient(135deg, #06b6d4, #3b82f6, #9333ea)');
    expect(cardSpec.css).toContain('background: linear-gradient(135deg, #06b6d4, #3b82f6, #9333ea);');

    const imageSpec = buildHandoffSpec(image, demoScene(), CANVAS);
    expect(imageSpec.asset).toMatchObject({ refId: 'asset-背景图', sourceName: '背景图', mediaAspect: 1.7778 });
  });

  it('uses a readable layer name and skips hidden layers in scene export', () => {
    expect(getElementDisplayName(title)).toBe('主标题');
    const untitled = element('text-2', 'txt', { content: '第一行标题\n第二行' });
    expect(getElementDisplayName(untitled)).toBe('第一行标题');

    const hidden = element('hidden', 'txt', { visible: false, sourceName: '隐藏图层' });
    const specs = buildSceneHandoffSpecs(scene([title, hidden, label]), CANVAS);
    expect(specs.map((spec) => spec.id)).toEqual(['title', 'label']);
  });
});

describe('handoff HTML export', () => {
  it('renders boxes, selected highlight, screenshot and spec cards', () => {
    const specs = buildSceneHandoffSpecs(demoScene(), CANVAS);
    const html = buildHandoffHTML({
      projectTitle: '银河工程',
      scene: demoScene(),
      canvas: CANVAS,
      specs,
      selectedId: 'title',
      screenshotDataUrl: 'data:image/png;base64,AAAA',
    });

    expect(html).toContain('银河工程 · 交付标注');
    expect(html).toContain('aspect-ratio:1920 / 1080');
    expect(html).toContain("background-image:url('data:image/png;base64,AAAA')");
    expect(html).toContain('layer-box is-selected');
    expect(html).toContain('主标题');
    expect(html).toContain('让每个像素获得生命');
    expect(html).toContain('aether-title');
    expect(html).toContain('主标题');
  });

  it('falls back to a vector canvas when no screenshot is available', () => {
    const specs = buildSceneHandoffSpecs(demoScene(), CANVAS);
    const html = buildHandoffHTML({
      projectTitle: '银河工程',
      scene: demoScene(),
      canvas: CANVAS,
      specs,
      selectedId: null,
      screenshotDataUrl: null,
    });
    expect(html).toContain('canvas no-shot');
    expect(html).not.toContain('background-image:url(');
  });

  it('escapes user content in the exported document', () => {
    const malicious = element('evil', 'txt', {
      sourceName: '<script>alert(1)</script>',
      content: '<img src=x onerror=alert(2)>',
      color: '#fff',
    });
    const specs = buildSceneHandoffSpecs(scene([malicious]), CANVAS);
    const html = buildHandoffHTML({
      projectTitle: '<script>alert(0)</script>',
      scene: scene([malicious]),
      canvas: CANVAS,
      specs,
      selectedId: 'evil',
      screenshotDataUrl: null,
    });
    expect(html).not.toContain('<script>alert(0)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
