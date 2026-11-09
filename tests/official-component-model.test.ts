import { describe, expect, it } from 'vitest';
import { createOfficialComponentData, getOfficialComponentDefaults, getOfficialComponentCanvasSize, inferOfficialModaoId } from '../src/components/ui/officialComponentModel';
import { GalaxyComponentRenderer, OfficialModaoRenderer } from '../src/components/ui/GalaxyComponents';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OFFICIAL_CITY_MAPS } from '../src/components/ui/officialCityMapData';
import { loadCityMaps } from '../src/components/ui/cityMapRegistry';
import { OFFICIAL_COMPONENT_CATALOG } from '../src/components/OfficialComponentsModal';

describe('official component editable defaults', () => {
  it('renders every component in the official catalog with its own editable payload', () => {
    expect(OFFICIAL_COMPONENT_CATALOG.length).toBeGreaterThan(100);
    for (const component of OFFICIAL_COMPONENT_CATALOG) {
      const data = createOfficialComponentData(component);
      expect(data.modaoId, component.id).toBe(component.id);
      expect(getOfficialComponentCanvasSize(component.id).w, component.id).toBeGreaterThan(0);
      const markup = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
      expect(markup, `${component.id} should render`).not.toBe('');
    }
  });

  it('uses one component payload for both library previews and canvas insertion', () => {
    const definition = { id: 'bar-chart', label: 'Bar chart', category: 'Charts', kind: 'chart', accent: '#41ddff', premium: true, previewVariant: 'chart-bar-dynamic' };
    const data = createOfficialComponentData(definition);
    expect(data).toMatchObject({
      modaoId: 'bar-chart', label: 'Bar chart', kind: 'chart', group: 'Charts',
      accentColor: '#41ddff', color: '#41ddff', premium: true, previewVariant: 'chart-bar-dynamic',
      items: expect.any(Array),
    });
    const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
    expect(rendered).toContain('is-chart');
    expect(rendered).toContain('Bar chart');
    expect(rendered).toContain('official-chart');
  });

  it('renders city map thumbnails through the same editable map renderer as canvas items', async () => {
    await loadCityMaps();
    const data = createOfficialComponentData({ id: 'map-shanghai', label: 'Shanghai map', category: 'Maps', kind: 'map', accent: '#75efc3' });
    const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
    expect(data).toMatchObject({ modaoId: 'map-shanghai', region: '上海', mapCenter: '上海', showLabels: true });
    expect(rendered).toContain('aria-label="上海市行政区地图"');
    expect(rendered).toContain('<svg');
  });

  it('ships distinct offline city boundaries and editable map defaults for all six city maps', () => {
    const cityIds = ['map-beijing', 'map-shanghai', 'map-guangzhou', 'map-shenzhen', 'map-chengdu', 'map-chongqing'];
    expect(Object.keys(OFFICIAL_CITY_MAPS)).toEqual(expect.arrayContaining(cityIds));
    expect(new Set(cityIds.map((id) => OFFICIAL_CITY_MAPS[id].outline)).size).toBe(6);
    expect(OFFICIAL_CITY_MAPS['map-guangzhou'].districts.length).toBeGreaterThanOrEqual(10);
    const guangzhou = getOfficialComponentDefaults('map-guangzhou', '广州地图');
    expect(guangzhou).toMatchObject({ region: '广州', mapCenter: '广州', zoom: 10, showLabels: true });
    expect(guangzhou.markers).toEqual([expect.objectContaining({ x: 50, y: 50 })]);
  });

  it('includes the expanded major-city map catalog', () => {
    expect(Object.keys(OFFICIAL_CITY_MAPS).length).toBeGreaterThanOrEqual(38);
    expect(new Set(Object.values(OFFICIAL_CITY_MAPS).map((map) => map.outline)).size).toBe(Object.keys(OFFICIAL_CITY_MAPS).length);
    for (const [id, map] of Object.entries(OFFICIAL_CITY_MAPS)) {
      expect(map.outline, `${id} should have a real boundary`).toMatch(/^M\d/);
      const defaults = getOfficialComponentDefaults(id, `${map.name}地图`);
      expect(defaults).toMatchObject({ modaoId: id, region: map.name.replace(/[市区县]$/, ''), zoom: 10, showLabels: true });
    }
    for (const id of ['map-tianjin', 'map-hangzhou', 'map-wuhan', 'map-xian', 'map-kunming', 'map-dongguan']) {
      expect(OFFICIAL_CITY_MAPS[id]).toBeDefined();
      expect(getOfficialComponentDefaults(id, id)).toMatchObject({ zoom: 10, showLabels: true });
    }
  });

  it('gives popup and special components editable placement and opacity defaults', () => {
    expect(getOfficialComponentDefaults('popup-4', 'Popup')).toMatchObject({
      anchor: 'center',
      showConnector: true,
      opacity: 100,
    });
    expect(getOfficialComponentDefaults('camera-panel', 'Camera')).toMatchObject({ opacity: 100 });
  });

  it('keeps large-number metrics editable without clamping their initial value', () => {
    const metric = getOfficialComponentDefaults('big-number', '访问总量');
    expect(metric).toMatchObject({ value: 1284, min: 0, max: 999999, unit: '人' });
  });

  it('provides editable menu items and a valid active item for navigation components', () => {
    const menu = getOfficialComponentDefaults('dropdown-menu', '下拉菜单');
    expect(menu).toMatchObject({ tabs: ['首页', '产品', '服务'], activeTab: 0, orientation: 'horizontal' });
    for (const id of ['breadcrumb', 'menu-horizontal', 'menu-vertical', 'bottom-nav']) {
      expect(getOfficialComponentDefaults(id, id)).toMatchObject({ tabs: expect.any(Array), activeTab: 0 });
    }
  });

  it('gives the stepper editable nodes and a flow-sized selection frame', () => {
    expect(getOfficialComponentDefaults('stepper', '步骤条')).toMatchObject({ nodes: expect.any(Array), direction: 'horizontal', showArrows: true });
    const size = getOfficialComponentCanvasSize('stepper');
    expect(size.w).toBe(26);
    expect(size.h).toBeGreaterThan(10);
    const data = createOfficialComponentData({ id: 'stepper', label: '步骤条', category: '交互控件', kind: 'flow' });
    const markup = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
    expect(markup).toContain('is-flow');
    expect(markup).toContain('步骤条');
  });

  it('keeps chart points available for inserting and editing advanced chart families', () => {
    for (const id of ['dynamic-bar', '3d-bar', 'bubble-chart', 'wordcloud-chart', 'bar-chart-horizontal']) {
      const chart = getOfficialComponentDefaults(id, id);
      expect(chart).toMatchObject({ max: 100, showGrid: true, showLegend: true });
      expect(Array.isArray(chart.items)).toBe(true);
      expect((chart.items as unknown[])).toHaveLength(6);
    }
  });

  it('renders 3D bars as editable extruded prisms with adjustable perspective settings', () => {
    const data = createOfficialComponentData({ id: '3d-bar', label: '立体柱状图', category: 'Charts', kind: 'chart', accent: '#41ddff' });
    expect(data).toMatchObject({ depth: 16, perspective: 34, showFloor: true, showValues: true, is3d: true });
    const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
    expect(rendered).toContain('aria-label="立体柱状图，立体柱状图"');
    expect(rendered).toContain('is-3d-chart');
    expect(rendered).toContain('一月');
    expect(rendered.match(/color-mix\(in srgb/g)?.length).toBeGreaterThanOrEqual(12);
  });

  it('renders the cyber 3D donut with actual extruded front walls and an editable depth', () => {
    const rendered = renderToStaticMarkup(createElement(GalaxyComponentRenderer, {
      type: 'cyber-3d-donut-chart',
      data: { label: '3D donut', depth: 32, donutData: [{ name: 'Alpha', value: 60, color: '#f0c46a' }, { name: 'Beta', value: 40, color: '#4ea8ff' }] },
    }));
    expect(rendered).toContain('source-donut__sector');
    expect(rendered).toContain('Alpha 60%');
    expect(rendered).toContain('color-mix(in srgb, #f0c46a 54%, #06122d)');
    expect(rendered).toContain('232');
  });

  it('recovers stable ids for legacy official layers that only kept display data', () => {
    expect(inferOfficialModaoId({ label: '广州地图', region: '广州' })).toBe('map-guangzhou');
    expect(inferOfficialModaoId({ kind: 'map', mapCenter: '深圳' })).toBe('map-shenzhen');
    expect(inferOfficialModaoId({ modaoId: 'map-beijing', label: '北京地图' })).toBe('map-beijing');
  });

  it('provides editable defaults for the extended component families', () => {
    expect(getOfficialComponentDefaults('card-stat', '统计卡片')).toMatchObject({ title: '统计卡片', content: '可编辑内容' });
    expect(getOfficialComponentDefaults('rating', '评分')).toMatchObject({ value: 4, min: 0, max: 5, step: 1 });
    expect(getOfficialComponentDefaults('progress-bar', '进度条')).toMatchObject({ value: 58, min: 0, max: 100 });
  });

  it('uses compact insertion bounds for controls and content bounds for media', () => {
    const rating = getOfficialComponentCanvasSize('rating');
    const button = getOfficialComponentCanvasSize('primary-button');
    const video = getOfficialComponentCanvasSize('video-player');
    expect(rating.w).toBeLessThan(16);
    expect(button.w).toBeLessThan(rating.w);
    expect(video.w).toBeGreaterThan(rating.w);
    expect(video.h / video.w).toBeCloseTo(1, 1);
  });

  it('marks content-sized official controls so the editor can fit handles to the painted control', () => {
    for (const id of ['rating', 'avatar', 'avatar-group', 'solid-badge', 'spinner-loader']) {
      const data = getOfficialComponentDefaults(id, id);
      const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
      expect(rendered, id).toContain('data-aether-selection-root="true"');
    }

    const chart = renderToStaticMarkup(createElement(OfficialModaoRenderer, {
      data: getOfficialComponentDefaults('bar-chart', 'Bar chart'),
      interactive: false,
    }));
    expect(chart).not.toContain('data-aether-selection-root="true"');
  });

  it('keeps insertion boxes at each component natural footprint so text and shapes are not stretched', () => {
    const pixels = (id: string) => {
      const size = getOfficialComponentCanvasSize(id);
      return { w: size.w / 100 * 1920, h: size.h / 100 * 1080 };
    };
    const expected: Array<[string, number, number]> = [
      ['button', 120, 48],
      ['checkbox', 70, 24],
      ['switch', 140, 42],
      ['input', 420, 74],
      ['textarea', 420, 146],
      ['progress-bar', 420, 38],
      ['divider', 75, 24],
      ['rating', 125, 30],
      ['avatar', 124, 48],
      ['solid-badge', 82, 32],
      ['circle', 76, 76],
      ['tooltip', 66, 39],
      ['qr-code', 146, 88],
      ['bar-chart', 420, 240],
      ['card-basic', 420, 240],
      ['notification-success', 420, 70],
    ];
    for (const [id, width, height] of expected) {
      const size = pixels(id);
      expect(Math.abs(size.w - width), `${id} width ${size.w}`).toBeLessThanOrEqual(2.2);
      expect(Math.abs(size.h - height), `${id} height ${size.h}`).toBeLessThanOrEqual(2.2);
    }
  });

  it('marks compact official controls as content-sized so they scale uniformly', () => {
    const kinds: Record<string, string> = { button: 'button', checkbox: 'toggle', switch: 'toggle', divider: 'line', circle: 'shape', audio: 'media', 'qr-code': 'media' };
    for (const id of Object.keys(kinds)) {
      const data = createOfficialComponentData({ id, label: id, category: 'Test', kind: kinds[id] });
      const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
      expect(rendered, id).toContain('data-aether-selection-root="true"');
    }
  });

  it('gives skeleton screens editable layout defaults instead of notification fields', () => {
    expect(getOfficialComponentDefaults('skeleton', '骨架屏')).toMatchObject({ lineCount: 4, showAvatar: true, animationEnabled: true, borderRadius: 6 });
    const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data: getOfficialComponentDefaults('skeleton', '骨架屏'), interactive: false }));
    expect(rendered).toContain('special-skeleton-content');
    expect(rendered).toContain('aether-shimmer');
  });

  it('treats progress bars as display components with progress-specific properties', () => {
    const data = createOfficialComponentData({ id: 'progress-bar', label: '项目进度', category: '交互控件', kind: 'slider' });
    expect(data).toMatchObject({ value: 58, min: 0, max: 100, unit: '%', showLabel: true, showValue: true, trackHeight: 8 });
    const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: true }));
    expect(rendered).toContain('role="progressbar"');
    expect(rendered).toContain('aria-valuenow="58"');
    expect(rendered).not.toContain('type="range"');
  });

  it('gives loaders real motion controls and keeps them transparent by default', () => {
    expect(getOfficialComponentDefaults('spinner-loader', 'Spinner')).toMatchObject({ speed: 1, loaderSize: 34, motionEnabled: true, surface: 'transparent' });
    const data = createOfficialComponentData({ id: 'spinner-loader', label: 'Spinner', category: 'Loaders', kind: 'panel' });
    const rendered = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data, interactive: false }));
    expect(rendered).toContain('official-loader-spinner');
    expect(rendered).toContain('animation-duration:1s');
    expect(rendered).toContain('background:transparent');
    expect(rendered).toContain('border:0');
  });

  it('gives notifications explicit semantics and makes dismissed state actually hide them', () => {
    expect(getOfficialComponentDefaults('notification-warning', 'Warning')).toMatchObject({ notificationType: 'warning', dismissible: true, showIcon: true, dismissed: false, duration: 0, surface: 'card' });
    const visible = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data: { ...getOfficialComponentDefaults('toast', 'Toast'), modaoId: 'toast', dismissible: false }, interactive: true }));
    expect(visible).toContain('special-notification-info');
    expect(visible).not.toContain('aria-label="关闭通知"');
    const dismissed = renderToStaticMarkup(createElement(OfficialModaoRenderer, { data: { modaoId: 'toast', dismissed: true } }));
    expect(dismissed).toBe('');
  });

  it('exposes semantic editable defaults for shapes, swimlanes, and media players', () => {
    expect(getOfficialComponentDefaults('star', '星形')).toMatchObject({ content: '星形', sides: 5, rotation: 0, strokeWidth: 2, showLabel: true });
    expect(getOfficialComponentDefaults('vertical-swimlane', '垂直泳道')).toMatchObject({ orientation: 'vertical', lanes: [{ id: 'lane-1', label: 'Lane 1' }, { id: 'lane-2', label: 'Lane 2' }, { id: 'lane-3', label: 'Lane 3' }] });
    expect(getOfficialComponentDefaults('video-player', '视频播放器')).toMatchObject({ assetUrl: '', posterUrl: '', autoplay: false, loop: false, controls: true, muted: false });
  });

  it('keeps first-batch basic components editable instead of falling back to empty data', () => {
    expect(getOfficialComponentDefaults('qr-code', '二维码')).toMatchObject({ qrValue: 'https://aether.local', qrSize: 9, qrErrorCorrection: 'M' });
    expect(getOfficialComponentDefaults('annotation', '批注')).toMatchObject({ author: 'AETHER', severity: 'info', content: 'Editable component content' });
    expect(getOfficialComponentDefaults('primary-button', '主按钮')).toMatchObject({ buttonLabel: '主按钮', disabled: false, pressed: false, action: 'none' });
  });

  it('provides structural fields for container families', () => {
    expect(getOfficialComponentDefaults('dynamic-component', '动态组件')).toMatchObject({ componentRef: '', expanded: true, items: ['Content 1', 'Content 2', 'Content 3'] });
    expect(getOfficialComponentDefaults('scroll-panel', '滚动面板')).toMatchObject({ scrollable: true, scrollDirection: 'vertical', borderRadius: 8 });
    expect(getOfficialComponentDefaults('code-component', '代码组件')).toMatchObject({ language: 'html', code: '' });
  });
  it('provides semantic fields for document, pointer annotation, and dynamic props', () => {
    expect(getOfficialComponentDefaults('document', '文档')).toMatchObject({ pageTitle: '文档', headerText: 'AETHER DOCUMENT', footerText: 'Page 1', showHeader: true, showFooter: true });
    expect(getOfficialComponentDefaults('point-annotation', '批注')).toMatchObject({ pointerX: 50, pointerY: 50, pointerDirection: 'bottom' });
    expect(getOfficialComponentDefaults('dynamic-component', '动态')).toMatchObject({ propsJson: '{\n  "variant": "default"\n}' });
  });
  it('provides semantic editing fields for avatar and divider components', () => {
    expect(getOfficialComponentDefaults('avatar', 'User avatar')).toMatchObject({ avatarText: 'A', avatarUrl: '', avatarSize: 42, subtitle: 'Online', showSubtitle: true });
    expect(getOfficialComponentDefaults('avatar-group', 'Avatar group')).toMatchObject({ maxVisible: 4, showOverflow: true, avatarSize: 32, overlap: 8 });
    expect(getOfficialComponentDefaults('divider', 'Divider')).toMatchObject({ orientation: 'horizontal', lineStyle: 'solid', lineWidth: 1, showLabel: true, gap: 10 });
  });
});
