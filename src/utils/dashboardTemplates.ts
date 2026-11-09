import type { ProjectData, Scene, SceneElement } from '../types';
import type { GalaxyComponentType } from '../components/ui/GalaxyComponents';

export interface DashboardTemplateInfo { id: string; name: string; description: string; pages: number; }

export const DASHBOARD_TEMPLATE_INFO: DashboardTemplateInfo = {
  id: 'dashboard-pack',
  name: '通用数据大屏 · 12页行业模板',
  description: '覆盖充电、电力、医院、储能、楼宇、城市、能耗与电商场景的高端深色数据大屏骨架。',
  pages: 12,
};

const PAGE_DEFINITIONS = [
  ['1-充电桩数据可视化', '充电桩运行态势', '充电站', '今日充电次数', '功率趋势', '站点排行'],
  ['2-智慧电力运营', '智慧电力运营中心', '电网运行', '实时负荷', '供电趋势', '区域负荷排行'],
  ['3-某医院大数据看板', '医院运营数据中心', '医疗运营', '今日门诊量', '就诊趋势', '科室效率排行'],
  ['4-储能监测平台', '储能监测平台', '储能系统', '当前可放电量', 'SOC 实时曲线', '电站效率排行'],
  ['5-智慧楼宇指挥中心', '智慧楼宇指挥中心', '楼宇设备', '楼宇在线率', '能耗趋势', '楼层能耗排行'],
  ['6-经济运行可视化平台', '经济运行可视化平台', '经济运行', '重点指标完成率', '经济趋势', '区域贡献排行'],
  ['7-城市智慧治理中心可视化', '城市智慧治理中心', '城市治理', '事件闭环率', '事件趋势', '区域事件排行'],
  ['8-能耗大数据可视化', '能耗大数据可视化', '能源消耗', '今日综合能耗', '分时能耗', '用能单位排行'],
  ['9-绿色节能可视化看板', '绿色节能可视化看板', '绿色节能', '累计减碳量', '节能趋势', '节能单位排行'],
  ['10-能源公司运营数据监测', '能源公司运营监测', '能源运营', '在运站点数', '产能趋势', '站点健康排行'],
  ['11-智慧城市管理平台', '智慧城市管理平台', '城市态势', '城市运行指数', '城市态势趋势', '部门协同排行'],
  ['12-电商销售数据检测大屏', '电商销售数据大屏', '销售运营', '今日成交额', '销售趋势', '商品销量排行'],
] as const;

const base = (id: string, type: SceneElement['type'], x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id, type, refId: '', sourceName: id, x, y, w, h, zIndex: extra.zIndex ?? 1, opacity: extra.opacity ?? 100, startTime: 0, duration: 60, ...extra,
});

const ui = (id: string, type: GalaxyComponentType, x: number, y: number, w: number, h: number, data: Record<string, unknown>, extra: Partial<SceneElement> = {}) => base(id, 'ui-component', x, y, w, h, { uiComponentType: type, uiComponentData: { ...data, dataBinding: { sourceId: 'mock.telemetry', refresh: 'realtime', mapping: { value: 'metrics.value', status: 'status' }, freshness: { warningAfterMs: 5000, offlineAfterMs: 15000 } } }, ...extra });

function createScene(index: number, definition: typeof PAGE_DEFINITIONS[number]): Scene {
  const [alias, title, domain, metricLabel, trendLabel, rankLabel] = definition;
  const accent = index % 3 === 0 ? '#22d3ee' : index % 3 === 1 ? '#38bdf8' : '#34d399';
  return {
    id: `dash_${index + 1}`, alias, type: 'scene', duration: 60, cruiseDuration: 60, bgColor: '#061221', inPoint: 0, outPoint: 60, transitionIn: 'fade', transitionOut: 'fade', transitionDuration: 0.5,
    els: [
      base(`dash_${index + 1}_grid`, 'shape', 2, 4, 96, 92, { zIndex: 0, opacity: 32, color: 'rgba(12, 39, 66, 0.55)', borderRadius: 8, borderWidth: 1, borderColor: `${accent}22` }),
      base(`dash_${index + 1}_title`, 'txt', 8, 4, 84, 8, { zIndex: 4, content: title, color: '#e8f6ff', fontSize: 34, fontWeight: '800', textAlign: 'center', letterSpacing: 4, is3dLayer: true, depthZ: 40, parallaxFactor: 0.15 }),
      base(`dash_${index + 1}_domain`, 'txt', 8, 11, 84, 3, { zIndex: 4, content: `${domain}  /  REAL-TIME OPERATION CENTER`, color: accent, fontSize: 11, fontWeight: '700', textAlign: 'center', letterSpacing: 3 }),
      ui(`dash_${index + 1}_metric`, 'metric-card', 6, 19, 20, 18, { title: metricLabel, label: metricLabel, content: `${(82 + index * 1.7).toFixed(1)}%`, value: 82 + index * 1.7, color: accent, accentColor: accent }),
      ui(`dash_${index + 1}_flip`, 'flip-number', 28, 19, 20, 18, { label: '实时数据流', value: 12840 + index * 312, unit: '条 / min', color: '#60a5fa' }),
      ui(`dash_${index + 1}_gauge`, 'gauge', 50, 19, 20, 18, { label: '系统健康度', value: 68 + (index % 4) * 6, color: '#34d399' }),
      ui(`dash_${index + 1}_fresh`, 'freshness', 72, 19, 20, 18, { label: '数据新鲜度', freshnessMs: 900 + index * 180, color: accent }),
      ui(`dash_${index + 1}_trend`, 'trend-line', 6, 40, 43, 26, { label: trendLabel, series: [32 + index, 46, 41 + index, 58, 52 + index, 68, 64, 78], color: accent, accentColor: accent }),
      ui(`dash_${index + 1}_rank`, 'bar-chart', 51, 40, 43, 26, { label: rankLabel, series: [46, 68, 54, 82, 61, 74], categories: ['一', '二', '三', '四', '五', '六'], color: '#38bdf8' }),
      ui(`dash_${index + 1}_table`, 'stats-table', 6, 69, 43, 23, { label: '指标概览', rows: [{ label: '核心指标', value: `${(96 - index * 0.8).toFixed(1)}%`, status: '正常' }, { label: '设备在线', value: `${72 + index}`, status: '在线' }, { label: '异常事件', value: `${index % 4}`, status: index % 4 ? '预警' : '正常' }] }),
      ui(`dash_${index + 1}_alerts`, 'alert-list', 51, 69, 43, 23, { label: '实时告警', items: [{ label: `${domain}运行状态正常`, value: '刚刚', status: '正常' }, { label: '边缘节点延迟波动', value: '08:42', status: '预警' }, { label: '数据连接已同步', value: '08:39', status: '信息' }] }),
    ],
  };
}

export function createDashboardTemplateProject(): ProjectData {
  const scenes = PAGE_DEFINITIONS.reduce<Record<string, Scene>>((acc, definition, index) => { const scene = createScene(index, definition); acc[scene.id] = scene; return acc; }, {});
  return { meta: { v: 42.1, title: DASHBOARD_TEMPLATE_INFO.name, author: '鲸动交互平台', updatedAt: new Date().toISOString() }, start: 'dash_1', canvas: { width: 1920, height: 1080 }, scenes, variables: [] };
}
