import { ProjectData, Scene, SceneElement } from '../types';

/** Self-contained artwork keeps the official example portable in HTML/ZIP exports. */
const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;

const heroArtwork = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070818"/><stop offset=".52" stop-color="#101c42"/><stop offset="1" stop-color="#071d2e"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#67e8f9" stop-opacity=".9"/><stop offset=".25" stop-color="#22d3ee" stop-opacity=".32"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#132c50" stop-opacity=".05"/><stop offset="1" stop-color="#06101d" stop-opacity=".95"/></linearGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#7dd3fc" stroke-opacity=".09"/></pattern>
    <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/><rect width="1600" height="900" fill="url(#grid)" opacity=".75"/>
  <ellipse cx="1210" cy="310" rx="420" ry="360" fill="url(#glow)" filter="url(#blur)"/>
  <path d="M0 590L310 430 520 565 760 380 1010 540 1290 370 1600 510V900H0Z" fill="#050a18" opacity=".78"/>
  <path d="M0 900L800 515 1600 900Z" fill="url(#road)"/>
  <g fill="none" stroke="#67e8f9" stroke-opacity=".38"><path d="M800 518L380 900M800 518L575 900M800 518L720 900M800 518L880 900M800 518L1060 900M800 518L1330 900"/><path d="M250 720H1350M120 810H1480"/></g>
  <g fill="none" stroke="#c084fc" stroke-opacity=".55"><ellipse cx="1120" cy="360" rx="250" ry="90" transform="rotate(-18 1120 360)"/><ellipse cx="1120" cy="360" rx="320" ry="124" transform="rotate(-18 1120 360)"/></g>
  <circle cx="1120" cy="360" r="72" fill="url(#glow)"/><circle cx="1120" cy="360" r="8" fill="#ecfeff"/>
  <g fill="#a5f3fc"><circle cx="1430" cy="160" r="2"/><circle cx="1310" cy="260" r="3"/><circle cx="1510" cy="460" r="2"/><circle cx="970" cy="180" r="2"/></g>
</svg>`);

const timelineArtwork = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset="1" stop-color="#101a3c"/></linearGradient><linearGradient id="cyan"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#2563eb"/></linearGradient><linearGradient id="violet"><stop stop-color="#a78bfa"/><stop offset="1" stop-color="#7c3aed"/></linearGradient><linearGradient id="green"><stop stop-color="#34d399"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
  <rect width="1200" height="760" rx="36" fill="url(#bg)"/><path d="M0 160H1200M0 290H1200M0 420H1200M0 550H1200M170 0V760M350 0V760M530 0V760M710 0V760M890 0V760M1070 0V760" stroke="#94a3b8" stroke-opacity=".1"/>
  <g fill="#94a3b8" font-family="Arial" font-size="18"><text x="54" y="64">SCENE / TIMELINE</text><text x="180" y="116">00:00</text><text x="465" y="116">00:06</text><text x="750" y="116">00:12</text><text x="1035" y="116">00:18</text></g>
  <path d="M180 145V700" stroke="#67e8f9" stroke-width="3" stroke-dasharray="8 10"/><g><rect x="180" y="185" width="610" height="72" rx="14" fill="url(#cyan)" fill-opacity=".75"/><rect x="245" y="315" width="390" height="72" rx="14" fill="url(#violet)" fill-opacity=".8"/><rect x="210" y="445" width="760" height="72" rx="14" fill="url(#green)" fill-opacity=".68"/><rect x="520" y="575" width="360" height="72" rx="14" fill="#f59e0b" fill-opacity=".66"/></g>
  <g fill="#e0f2fe" font-family="Arial" font-size="22" font-weight="700"><text x="210" y="230">SPATIAL SCENE / IMAGE / VIDEO</text><text x="275" y="360">INTERACTION / UI COMPONENT</text><text x="240" y="490">LIVE SIGNAL / GALAXY UI</text><text x="550" y="620">SOUND &amp; TRANSITION / AUDIO</text></g>
  <g fill="#67e8f9"><circle cx="180" cy="145" r="10"/><circle cx="180" cy="700" r="10"/></g><path d="M180 145H1080" stroke="#67e8f9" stroke-opacity=".25"/>
</svg>`);

const publishArtwork = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
  <defs><linearGradient id="pbg" x2="1" y2="1"><stop stop-color="#080b1d"/><stop offset=".5" stop-color="#17133c"/><stop offset="1" stop-color="#082b36"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="30"/></filter></defs>
  <rect width="1200" height="760" rx="36" fill="url(#pbg)"/><circle cx="915" cy="160" r="190" fill="#22d3ee" fill-opacity=".18" filter="url(#soft)"/><circle cx="230" cy="620" r="220" fill="#a78bfa" fill-opacity=".17" filter="url(#soft)"/>
  <g font-family="Arial"><rect x="110" y="150" width="400" height="220" rx="22" fill="#0f172a" stroke="#67e8f9" stroke-opacity=".7" stroke-width="3"/><rect x="575" y="150" width="400" height="220" rx="22" fill="#0f172a" stroke="#a78bfa" stroke-opacity=".7" stroke-width="3"/><rect x="110" y="430" width="400" height="220" rx="22" fill="#0f172a" stroke="#34d399" stroke-opacity=".7" stroke-width="3"/><rect x="575" y="430" width="400" height="220" rx="22" fill="#0f172a" stroke="#fbbf24" stroke-opacity=".8" stroke-width="3"/>
  <text x="170" y="255" fill="#67e8f9" font-size="72" font-weight="800">HTML</text><text x="635" y="255" fill="#c4b5fd" font-size="72" font-weight="800">ZIP</text><text x="170" y="535" fill="#86efac" font-size="68" font-weight="800">VIDEO</text><text x="635" y="535" fill="#fde68a" font-size="44" font-weight="800">PNG / JPG</text>
  <text x="175" y="310" fill="#94a3b8" font-size="22">INTERACTIVE / DEPLOYABLE</text><text x="640" y="310" fill="#94a3b8" font-size="22">OFFLINE / ASSET COMPLETE</text><text x="175" y="590" fill="#94a3b8" font-size="22">SMOOTH PLAYBACK / MULTI-SCENE</text><text x="640" y="590" fill="#94a3b8" font-size="22">FRAME SEQUENCE / QUALITY CONTROL</text></g>
  <path d="M510 260H575M510 540H575" stroke="#e0f2fe" stroke-opacity=".55" stroke-width="3" stroke-dasharray="8 10"/>
</svg>`);

const dataArtwork = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
  <defs><linearGradient id="dbg" x2="1" y2="1"><stop stop-color="#06151f"/><stop offset=".55" stop-color="#071c38"/><stop offset="1" stop-color="#10204b"/></linearGradient><linearGradient id="line"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs>
  <rect width="1200" height="760" rx="36" fill="url(#dbg)"/><path d="M0 130H1200M0 260H1200M0 390H1200M0 520H1200M150 0V760M300 0V760M450 0V760M600 0V760M750 0V760M900 0V760M1050 0V760" stroke="#67e8f9" stroke-opacity=".1"/>
  <g fill="none" stroke="#22d3ee" stroke-opacity=".6"><circle cx="900" cy="280" r="170"/><circle cx="900" cy="280" r="110"/><circle cx="900" cy="280" r="46"/></g><path d="M900 280L1030 160M900 280L780 430M900 280L1100 360" stroke="#34d399" stroke-width="5" stroke-linecap="round"/><g fill="#d9faff"><circle cx="1030" cy="160" r="8"/><circle cx="780" cy="430" r="8"/><circle cx="1100" cy="360" r="8"/></g>
  <g fill="none" stroke="url(#line)" stroke-width="6"><path d="M90 610L200 560 300 580 400 470 510 500 620 390 730 430"/><path d="M90 660L200 650 300 630 400 640 510 600 620 610 730 560"/></g><g fill="#a5f3fc" font-family="Arial" font-size="20"><text x="80" y="80">GALAXY UI / LIVE SIGNAL</text><text x="85" y="705">METRICS / TRENDS / STATUS / ALERTS</text></g>
</svg>`);

const prismArtwork = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <defs><radialGradient id="a"><stop stop-color="#e0f2fe" stop-opacity=".9"/><stop offset=".22" stop-color="#67e8f9" stop-opacity=".4"/><stop offset="1" stop-color="#67e8f9" stop-opacity="0"/></radialGradient><linearGradient id="dark" x2="1" y2="1"><stop stop-color="#050816"/><stop offset="1" stop-color="#151039"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="28"/></filter></defs>
  <rect width="1600" height="900" fill="url(#dark)"/><circle cx="800" cy="420" r="400" fill="url(#a)" filter="url(#blur)"/><g fill="none" stroke="#a5f3fc" stroke-opacity=".42"><path d="M800 80L1350 720 250 720Z" stroke-width="2"/><path d="M800 180L1190 670 410 670Z" stroke-width="2"/><path d="M800 300L1040 610 560 610Z" stroke-width="3"/></g><path d="M800 80L800 720M250 720L1350 720" stroke="#c4b5fd" stroke-opacity=".35"/><g fill="#fff"><circle cx="800" cy="80" r="5"/><circle cx="250" cy="720" r="5"/><circle cx="1350" cy="720" r="5"/></g>
</svg>`);

const element = (id: string, type: SceneElement['type'], x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id, type, refId: '', sourceName: id, x, y, w, h, zIndex: extra.zIndex ?? 1, opacity: extra.opacity ?? 100,
  startTime: extra.startTime ?? 0, duration: extra.duration ?? 18, ...extra,
});
const text = (id: string, content: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}) => element(id, 'txt', x, y, w, h, {
  content, color: '#e8f7ff', fontFamily: 'Inter, Microsoft YaHei, sans-serif', fontWeight: '600', lineHeight: 1.2, ...extra,
});
const shape = (id: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}) => element(id, 'shape', x, y, w, h, {
  color: 'rgba(8, 19, 36, 0.72)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(126, 231, 255, 0.2)', boxShadow: '0 22px 70px rgba(0, 0, 0, 0.36)', ...extra,
});
const button = (id: string, label: string, target: string, x: number, y: number, w = 17) => element(id, 'ui-component', x, y, w, 6, {
  uiComponentType: 'glow-button', uiComponentData: { label, color: '#7de7ff' }, link: target, linkType: 'jump', trigger: 'click', interaction: { trigger: 'click', action: 'jump', target }, hoverEffect: 'glow', interactionEffect: 'press-spring', interactionEffectTrigger: 'click', zIndex: 30, is3dLayer: true, depthZ: 80, parallaxFactor: 0.4,
});
const image = (id: string, refId: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}) => element(id, 'img', x, y, w, h, {
  refId, mediaAspect: w / h, lockAspectRatio: true, zIndex: 3, is3dLayer: true, depthZ: 20, parallaxFactor: 0.2, ...extra,
});
const background = (id: string, motion: SceneElement['vfxMotionType'], colorA: string, colorB: string) => element(id, 'vfx', 0, 0, 100, 100, {
  vfxMotionType: motion, vfxColorA: colorA, vfxColorB: colorB, vfxSpeed: 0.18, opacity: 20, zIndex: 0, duration: 18,
});
const scene = (id: string, alias: string, els: SceneElement[], options: Partial<Scene> = {}): Scene => ({
  id, alias, type: 'scene', duration: 18, cruiseDuration: 18, bgColor: '#050b14', backgroundType: 'solid', inPoint: 0, outPoint: 18, transitionIn: 'fade', transitionOut: 'fade', transitionDuration: 0.7, transitionEasing: 'cubic-bezier(0.22, 1, 0.36, 1)', els, ...options,
});

export const DEFAULT_PROJECT_DATA: ProjectData = {
  meta: { v: 42.1, title: '鲸动交互平台 · Spatial Showcase', author: '鲸动交互平台', updatedAt: new Date().toISOString() },
  start: 'home', canvas: { width: 1920, height: 1080 }, is3DParallaxEnabled: true, parallaxIntensity: 1,
  hudConfig: { style: 'tech', collapsible: true, showDots: true, showTitle: true },
  variables: [{ id: 'showcase_realtime', name: '实时状态', value: 'LIVE', type: 'text' }, { id: 'showcase_fps', name: '播放帧率', value: 60, type: 'number' }], components: [],
  scenes: {
    home: scene('home', '01 · 空间叙事', [
      background('home_vfx', 'abyss-grid', '#0ea5e9', '#6d28d9'), shape('home_scrim', 5, 7, 47, 82, { color: 'rgba(3, 10, 24, 0.78)', borderColor: 'rgba(125, 231, 255, 0.18)', borderRadius: 28, zIndex: 1 }), image('home_art', heroArtwork, 57, 13, 38, 66, { opacity: 84, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(125, 231, 255, 0.35)', boxShadow: '0 30px 100px rgba(34, 211, 238, .18)', zIndex: 2, depthZ: 18 }),
      text('home_kicker', '鲸动交互平台  /  AETHER INTERACTION ENGINE', 9, 14, 42, 4, { color: '#7de7ff', fontSize: 12, fontWeight: '800', letterSpacing: 2.5, zIndex: 5 }), text('home_title', '让每个画面\n都能被点亮', 9, 23, 42, 22, { color: '#f4fbff', fontSize: 58, fontWeight: '900', letterSpacing: 1, zIndex: 5, is3dLayer: true, depthZ: 70, parallaxFactor: 0.46 }), text('home_desc', '从第三方素材到实时数据，从空间编排到多格式发布，把创意写进一条可交互的时间线。', 10, 51, 37, 10, { color: '#b5cada', fontSize: 17, zIndex: 5 }), shape('home_pills', 9, 66, 40, 10, { color: 'rgba(11, 31, 55, .72)', borderColor: 'rgba(125, 231, 255, .24)', borderRadius: 12, zIndex: 6 }), text('home_pills_text', '第三方素材  ·  实时交互  ·  多格式交付', 11, 69, 36, 4, { color: '#b9f4ff', fontSize: 13, fontWeight: '800', letterSpacing: .8, zIndex: 7, textAlign: 'center' }), button('home_edit', '进入编排空间', 'studio', 10, 80, 17), button('home_output', '查看发布能力', 'output', 29, 80, 17),
    ], { bgRef: heroArtwork, bgColor: '#050816' }),
    studio: scene('studio', '02 · 编排空间', [
      background('studio_vfx', 'particles', '#22d3ee', '#1e3a8a'), shape('studio_scrim', 5, 7, 39, 82, { color: 'rgba(3, 10, 24, .8)', borderColor: 'rgba(125, 231, 255, .18)', borderRadius: 28, zIndex: 1 }), image('studio_timeline_art', timelineArtwork, 48, 14, 45, 65, { opacity: 92, borderRadius: 24, borderColor: 'rgba(125, 231, 255, .32)', borderWidth: 1, zIndex: 2, depthZ: 30 }),
      text('studio_kicker', 'WORKSPACE  /  EDIT WITH INTENT', 9, 14, 34, 4, { color: '#7de7ff', fontSize: 12, fontWeight: '800', letterSpacing: 2.5 }), text('studio_title', '不是堆素材，\n而是编排空间。', 9, 23, 34, 20, { fontSize: 43, fontWeight: '900', is3dLayer: true, depthZ: 58, parallaxFactor: .4 }), text('studio_copy', '图层、时间、转场和交互动作共享一套可视化逻辑。图片、视频、音频、3D、全景素材，都能进入同一个场景。', 10, 50, 31, 14, { color: '#b5cada', fontSize: 15 }), text('studio_note', '拖入素材  →  编排节奏  →  立即预览', 10, 69, 32, 4, { color: '#67e8f9', fontSize: 13, fontWeight: '800', letterSpacing: 1 }), button('studio_next', '看一次创作，多种交付', 'output', 10, 80, 22), button('studio_home', '返回首页', 'home', 34, 80, 12),
    ], { bgRef: timelineArtwork, bgColor: '#07111f' }),
    output: scene('output', '03 · 一次创作，多种交付', [
      background('output_vfx', 'cardscan', '#38bdf8', '#7c3aed'), shape('output_scrim', 5, 7, 40, 82, { color: 'rgba(3, 10, 24, .82)', borderColor: 'rgba(125, 231, 255, .18)', borderRadius: 28, zIndex: 1 }), image('output_publish_art', publishArtwork, 49, 12, 46, 70, { opacity: 94, borderRadius: 26, borderColor: 'rgba(196, 181, 253, .32)', borderWidth: 1, zIndex: 2, depthZ: 28 }),
      text('output_kicker', 'PUBLISH  /  SAME PROJECT, EVERYWHERE', 9, 14, 36, 4, { color: '#7de7ff', fontSize: 12, fontWeight: '800', letterSpacing: 2.5 }), text('output_title', '一次创作，\n多种交付。', 9, 23, 34, 19, { fontSize: 45, fontWeight: '900', is3dLayer: true, depthZ: 60, parallaxFactor: .42 }), text('output_desc', '同一个工程，沿着同一条时间线进入 HTML、ZIP、视频与 PNG / JPG 序列。资源、交互和场景关系保持一致。', 10, 50, 32, 14, { color: '#b5cada', fontSize: 15 }), text('output_note', 'HTML  ·  ZIP  ·  VIDEO  ·  PNG / JPG', 10, 69, 34, 4, { color: '#c4b5fd', fontSize: 13, fontWeight: '800', letterSpacing: 1 }), button('output_next', '进入实时数据', 'realtime', 10, 80, 18), button('output_home', '返回首页', 'home', 30, 80, 12),
    ], { bgRef: publishArtwork, bgColor: '#080b1d' }),
    realtime: scene('realtime', '04 · Galaxy UI 实时数据', [
      background('realtime_vfx', 'nebula', '#14b8a6', '#1d4ed8'), shape('realtime_scrim', 5, 7, 39, 82, { color: 'rgba(3, 10, 24, .82)', borderColor: 'rgba(125, 231, 255, .18)', borderRadius: 28, zIndex: 1 }), image('realtime_data_art', dataArtwork, 48, 13, 46, 69, { opacity: 88, borderRadius: 26, borderColor: 'rgba(52, 211, 153, .32)', borderWidth: 1, zIndex: 2, depthZ: 24 }),
      text('realtime_kicker', 'GALAXY UI  /  DATA COMPONENTS', 9, 14, 34, 4, { color: '#7de7ff', fontSize: 12, fontWeight: '800', letterSpacing: 2.5 }), text('realtime_title', '把数据变成\n可操作的现场。', 9, 23, 34, 19, { fontSize: 41, fontWeight: '900', is3dLayer: true, depthZ: 58, parallaxFactor: .38 }), text('realtime_desc', '指标、趋势、状态与告警组件可绑定数据源，在同一空间内联动呈现。示例使用本地演示数据，替换数据源即可复用。', 10, 50, 32, 15, { color: '#b5cada', fontSize: 15 }),
      element('realtime_metric', 'ui-component', 49, 14, 20, 17, { uiComponentType: 'metric-card', uiComponentData: { label: '实时在线率', value: 98.6, unit: '%' }, zIndex: 4, is3dLayer: true, depthZ: 42, parallaxFactor: .25 }), element('realtime_gauge', 'ui-component', 71, 14, 20, 17, { uiComponentType: 'gauge', uiComponentData: { label: '系统健康度', value: 92, unit: '%' }, zIndex: 4, is3dLayer: true, depthZ: 50, parallaxFactor: .3 }), element('realtime_trend', 'ui-component', 49, 34, 42, 25, { uiComponentType: 'trend-line', uiComponentData: { label: '过去 60 分钟', series: [36, 44, 42, 58, 54, 69, 64, 78], categories: ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50', '11:00', '现在'] }, zIndex: 4, is3dLayer: true, depthZ: 30, parallaxFactor: .22 }), element('realtime_alert', 'ui-component', 49, 65, 42, 20, { uiComponentType: 'alert-list', uiComponentData: { label: '现场动态', items: [{ label: '边缘节点已同步', value: '刚刚', status: '正常' }, { label: '渲染队列保持稳定', value: '08:42', status: '信息' }, { label: '素材缓存命中率提升', value: '08:39', status: '正常' }] }, zIndex: 4 }), button('realtime_next', '查看结论', 'manifesto', 10, 80, 16), button('realtime_home', '返回首页', 'home', 28, 80, 12),
    ], { bgRef: dataArtwork, bgColor: '#06151f' }),
    manifesto: scene('manifesto', '05 · 现在开始创作', [
      background('manifesto_vfx', 'aurora', '#38bdf8', '#a855f7'), image('manifesto_art', prismArtwork, 12, 13, 76, 72, { opacity: 44, borderRadius: 32, borderColor: 'rgba(165, 243, 252, .24)', borderWidth: 1, zIndex: 1, depthZ: 18 }), shape('manifesto_card', 19, 19, 62, 58, { color: 'rgba(7, 16, 35, .78)', borderColor: 'rgba(125, 231, 255, .32)', borderRadius: 28, backdropBlur: 18, zIndex: 2, is3dLayer: true, depthZ: 24, parallaxFactor: .2 }),
      text('manifesto_kicker', '鲸动交互平台  /  AETHER INTERACTION ENGINE', 26, 29, 48, 4, { color: '#7de7ff', fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 3, zIndex: 5 }), text('manifesto_title', '让创意拥有\n空间、节奏与回应。', 24, 38, 52, 17, { fontSize: 40, fontWeight: '900', textAlign: 'center', zIndex: 5, is3dLayer: true, depthZ: 72, parallaxFactor: .42 }), text('manifesto_desc', '用可视化编排器，把真实素材、实时数据和交互行为变成可发布的作品。', 28, 59, 44, 7, { color: '#b4cedd', fontSize: 15, textAlign: 'center', zIndex: 5 }), button('manifesto_restart', '重新体验', 'home', 35, 70, 16),
    ], { bgRef: prismArtwork, bgColor: '#050816' }),
  },
};

export const MINIMAL_KEYNOTE_DATA: ProjectData = {
  meta: { v: 42.1, title: 'Minimal Product Keynote', author: '鲸动交互平台', updatedAt: new Date().toISOString() }, start: 'min_hero', canvas: { width: 1920, height: 1080 }, hudConfig: { style: 'minimal', collapsible: true, showDots: true, showTitle: true },
  scenes: {
    min_hero: scene('min_hero', '01 · 极简序章', [text('min_title', 'THE NEXT GENERATION\nSPATIAL INTERACTION', 10, 27, 80, 22, { color: '#ffffff', fontSize: 52, fontWeight: '900', textAlign: 'center', is3dLayer: true, depthZ: 70, parallaxFactor: .5 }), text('min_desc', '用清晰的时间线，把空间、数据和互动编排成一条可发布的故事线。', 25, 55, 50, 9, { color: '#a1a1aa', fontSize: 16, textAlign: 'center' }), button('min_next', '查看结构', 'min_detail', 42, 70, 16)]),
    min_detail: scene('min_detail', '02 · 结构说明', [shape('min_panel', 18, 18, 64, 60, { color: 'rgba(15, 23, 42, .9)', borderColor: 'rgba(255,255,255,.16)', borderRadius: 20 }), text('min_detail_title', 'DESIGNED TO SHIP', 25, 27, 50, 7, { color: '#ffffff', fontSize: 26, fontWeight: '800', textAlign: 'center', zIndex: 3 }), text('min_detail_body', '1. 可编辑的图层与时间线\n2. 可交互的场景与组件\n3. 可复用的 HTML、ZIP、视频与图片输出', 28, 39, 44, 22, { color: '#cbd5e1', fontSize: 17, zIndex: 3 }), button('min_back', '返回序章', 'min_hero', 42, 70, 16)]),
  },
};
