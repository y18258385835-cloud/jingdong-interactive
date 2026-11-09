import type { GalaxyComponentType } from '../components/ui/GalaxyComponents';

export type OfficialPluginCategory = '核心指标' | '趋势分析' | '状态告警' | '筛选联动' | '地图空间' | '设备资产' | '用户组件';
export type OfficialPluginStatus = 'installed' | 'available' | 'planned';

export interface OfficialPluginDefinition {
  id: string;
  name: string;
  description: string;
  category: OfficialPluginCategory;
  version: string;
  componentType: GalaxyComponentType;
  status: OfficialPluginStatus;
  tags: string[];
  sample: Record<string, unknown>;
  dataContract: string;
  source?: 'official' | 'community' | 'ai';
  author?: string;
  schemaVersion?: 1;
  createdAt?: string;
  telemetry?: {
    value?: string;
    label?: string;
    unit?: string;
    status?: string;
    freshness?: string;
    series?: string;
    categories?: string;
    rows?: string;
    items?: string;
    content?: string;
    location?: string;
    topology?: string;
  };
}

/** P1 only exposes safe built-in renderers. External connectors stay deferred. */
export const OFFICIAL_PLUGIN_REGISTRY: OfficialPluginDefinition[] = [
  { id: 'aether.metric-card', name: '指标卡', description: '展示当前值、单位与数据新鲜度。', category: '核心指标', version: '1.0.0', componentType: 'metric-card', status: 'installed', tags: ['KPI', '实时'], sample: { title: '设备在线率', content: '98.6%', value: 98.6, color: '#22d3ee', accentColor: '#22d3ee', dataBinding: { sourceId: 'mock.telemetry', refresh: 'realtime' } }, dataContract: 'metric.v1' },
  { id: 'aether.flip-number', name: '实时翻牌数字', description: '数值变化时以位数翻牌表达增量。', category: '核心指标', version: '1.0.0', componentType: 'flip-number', status: 'installed', tags: ['数字', '动效'], sample: { label: '今日流量', value: 12840, unit: '条 / min', color: '#60a5fa', dataBinding: { sourceId: 'mock.telemetry', refresh: 'realtime' } }, dataContract: 'metric.v1' },
  { id: 'aether.progress-ring', name: '百分比环', description: '以环形进度表达容量、完成度或健康度。', category: '核心指标', version: '1.0.0', componentType: 'progress-ring', status: 'installed', tags: ['比例', '健康度'], sample: { value: 76, color: '#34d399', dataBinding: { sourceId: 'mock.telemetry', refresh: 'realtime' } }, dataContract: 'gauge.v1' },
  { id: 'aether.gauge', name: '仪表盘', description: '以弧形刻度呈现负载和健康度。', category: '核心指标', version: '1.0.0', componentType: 'gauge', status: 'installed', tags: ['仪表', '负载'], sample: { label: '系统负载', value: 72, color: '#34d399', dataBinding: { sourceId: 'mock.telemetry', refresh: 'realtime' } }, dataContract: 'gauge.v1' },
  { id: 'aether.progress-bar', name: '图标填充进度', description: '适合电量、负载和资源占用的进度条。', category: '核心指标', version: '1.0.0', componentType: 'gradient-progress', status: 'installed', tags: ['进度', '资源'], sample: { value: 64, color: '#38bdf8' }, dataContract: 'gauge.v1' },
  { id: 'aether.trend-line', name: '折线趋势图', description: '实时序列图，支持平滑补点和新鲜度反馈。', category: '趋势分析', version: '1.0.0', componentType: 'trend-line', status: 'installed', tags: ['趋势', '时间序列'], sample: { label: '功率趋势', series: [32, 46, 41, 58, 52, 68, 64, 78], color: '#22d3ee', dataBinding: { sourceId: 'mock.telemetry', refresh: 'realtime' } }, dataContract: 'series.v1' },
  { id: 'aether.bar-chart', name: '柱状排行图', description: '高密度分类排行与对比。', category: '趋势分析', version: '1.0.0', componentType: 'bar-chart', status: 'installed', tags: ['排行', '对比'], sample: { label: '区域能耗', series: [46, 68, 54, 82, 61, 74], categories: ['一', '二', '三', '四', '五', '六'], color: '#38bdf8' }, dataContract: 'series.v1' },
  { id: 'aether.donut-chart', name: '环形占比图', description: '展示完成率、占比与构成关系。', category: '趋势分析', version: '1.0.0', componentType: 'donut-chart', status: 'installed', tags: ['占比', '完成率'], sample: { label: '任务完成率', value: 76, color: '#22d3ee' }, dataContract: 'gauge.v1' },
  { id: 'aether.stats-table', name: '统计表', description: '站点、设备和指标的紧凑数据表。', category: '趋势分析', version: '1.0.0', componentType: 'stats-table', status: 'installed', tags: ['表格', '站点'], sample: { label: '站点概览', rows: [{ label: '北区站点', value: '98.6%', status: '正常' }, { label: '南区站点', value: '94.2%', status: '预警' }, { label: '边缘网关', value: '1.8s', status: '在线' }] }, dataContract: 'table.v1' },
  { id: 'aether.alert-list', name: '告警列表', description: '以状态灯、时间和层级呈现实时告警。', category: '状态告警', version: '1.0.0', componentType: 'alert-list', status: 'installed', tags: ['告警', '事件'], sample: { label: '告警动态', items: [{ label: '冷却水回路压力偏低', value: '08:42', status: '预警' }, { label: '北斗终端 004 已恢复', value: '08:39', status: '信息' }] }, dataContract: 'alert.v1' },
  { id: 'aether.freshness', name: '数据新鲜度', description: '明确显示实时、延迟和离线反馈。', category: '状态告警', version: '1.0.0', componentType: 'freshness', status: 'installed', tags: ['实时', '断线'], sample: { label: '数据新鲜度', freshnessMs: 1200, color: '#34d399' }, dataContract: 'state.v1' },
  { id: 'aether.status-card', name: '设备状态卡', description: '组合设备状态、摘要和异常提示。', category: '设备资产', version: '1.0.0', componentType: 'outline-panel-card', status: 'installed', tags: ['设备', '状态'], sample: { title: '北斗终端 001', content: '在线 · 延迟 182 ms', color: '#34d399', accentColor: '#34d399' }, dataContract: 'device.v1' },
  { id: 'aether.filter-tabs', name: '全局筛选器', description: '为场景变量预留筛选联动入口。', category: '筛选联动', version: '1.0.0', componentType: 'tabs', status: 'installed', tags: ['筛选', '联动'], sample: { color: '#22d3ee' }, dataContract: 'filter.v1' },
  { id: 'aether.geo-map', name: '地图点位', description: 'GPS/北斗点位与轨迹组件，接收定位坐标和卫星质量。', category: '地图空间', version: '1.0.0', componentType: 'geo-map', status: 'installed', tags: ['GPS', '北斗'], sample: { label: '定位点位', color: '#34d399', accentColor: '#34d399' }, dataContract: 'geo.v1', telemetry: { location: 'location', status: 'status' } },
  { id: 'aether.device-topology', name: '拓扑关系图', description: '显示设备节点与链路状态，接收网关拓扑数据。', category: '设备资产', version: '1.0.0', componentType: 'topology', status: 'installed', tags: ['拓扑', '链路'], sample: { label: '设备拓扑', color: '#a78bfa', accentColor: '#a78bfa' }, dataContract: 'topology.v1', telemetry: { topology: 'topology', status: 'status' } },
  { id: 'aether.temperature-card', name: '温度监测卡', description: '展示工业温度探头的实时值、单位和越限状态。', category: '核心指标', version: '1.0.0', componentType: 'metric-card', status: 'installed', tags: ['温度', '热电偶', 'RTD'], sample: { label: '设备温度', value: 31.8, unit: '°C', color: '#fb923c', accentColor: '#fb923c' }, dataContract: 'temperature.v1', telemetry: { value: 'metrics.temperatureC', unit: 'metrics.temperatureUnit', status: 'status' } },
  { id: 'aether.voltage-card', name: '电压监测卡', description: '适用于电源柜、蓄电池和配电终端的电压监测。', category: '核心指标', version: '1.0.0', componentType: 'metric-card', status: 'installed', tags: ['电压', '电源'], sample: { label: '母线电压', value: 24.2, unit: 'V', color: '#facc15', accentColor: '#facc15' }, dataContract: 'voltage.v1', telemetry: { value: 'metrics.voltageV', unit: 'metrics.voltageUnit', status: 'status' } },
  { id: 'aether.current-card', name: '电流监测卡', description: '展示回路电流和负载状态，支持越限告警。', category: '核心指标', version: '1.0.0', componentType: 'gauge', status: 'installed', tags: ['电流', '负载'], sample: { label: '回路电流', value: 58, unit: 'A', color: '#f97316', accentColor: '#f97316' }, dataContract: 'current.v1', telemetry: { value: 'metrics.currentPercent', unit: 'metrics.currentUnit', status: 'status' } },
  { id: 'aether.pressure-gauge', name: '压力仪表', description: '用于液压、气压和冷却回路的压力显示。', category: '核心指标', version: '1.0.0', componentType: 'gauge', status: 'installed', tags: ['压力', '液压', '气压'], sample: { label: '回路压力', value: 62, unit: 'bar', color: '#38bdf8', accentColor: '#38bdf8' }, dataContract: 'pressure.v1', telemetry: { value: 'metrics.pressurePercent', unit: 'metrics.pressureUnit', status: 'status' } },
  { id: 'aether.humidity-card', name: '湿度监测卡', description: '展示环境或机柜湿度，适用于防潮和机房监测。', category: '核心指标', version: '1.0.0', componentType: 'progress-ring', status: 'installed', tags: ['湿度', '环境'], sample: { label: '环境湿度', value: 54, unit: '%RH', color: '#22d3ee', accentColor: '#22d3ee' }, dataContract: 'humidity.v1', telemetry: { value: 'metrics.humidity', unit: 'metrics.humidityUnit', status: 'status' } },
  { id: 'aether.flow-counter', name: '流量翻牌', description: '展示管路瞬时流量，适合水、气和物料输送终端。', category: '核心指标', version: '1.0.0', componentType: 'flip-number', status: 'installed', tags: ['流量', '管路'], sample: { label: '瞬时流量', value: 128.4, unit: 'm³/h', color: '#60a5fa', accentColor: '#60a5fa' }, dataContract: 'flow.v1', telemetry: { value: 'metrics.flowRate', unit: 'metrics.flowUnit', status: 'status' } },
  { id: 'aether.vibration-trend', name: '振动趋势', description: '展示电机、泵组和风机的振动趋势与健康状态。', category: '趋势分析', version: '1.0.0', componentType: 'trend-line', status: 'installed', tags: ['振动', '设备健康'], sample: { label: '轴承振动', series: [38, 42, 41, 47, 45, 52, 49, 56], color: '#f472b6', accentColor: '#f472b6' }, dataContract: 'vibration.v1', telemetry: { series: 'vibrationSeries', unit: 'metrics.vibrationUnit', status: 'status' } },
  { id: 'aether.energy-card', name: '能耗统计', description: '展示设备累计电能和当前功率，支持能耗趋势分析。', category: '趋势分析', version: '1.0.0', componentType: 'metric-card', status: 'installed', tags: ['能耗', '电能'], sample: { label: '累计能耗', value: 1842.6, unit: 'kWh', color: '#a3e635', accentColor: '#a3e635' }, dataContract: 'energy.v1', telemetry: { value: 'metrics.energyKwh', unit: 'metrics.energyUnit', status: 'status' } },
  { id: 'aether.gnss-map', name: 'GPS / 北斗定位', description: '显示 GPS/北斗终端坐标、卫星数、精度和在线状态。', category: '地图空间', version: '1.0.0', componentType: 'geo-map', status: 'installed', tags: ['GPS', '北斗', '定位'], sample: { label: '车辆定位', color: '#34d399', accentColor: '#34d399' }, dataContract: 'geo.v1', telemetry: { location: 'location', status: 'status' } },
  { id: 'aether.signal-strength', name: '信号强度仪表', description: '展示蜂窝、LoRa 或卫星通信质量。', category: '状态告警', version: '1.0.0', componentType: 'gauge', status: 'installed', tags: ['信号', '通信质量'], sample: { label: '通信信号', value: 78, unit: '%', color: '#c084fc', accentColor: '#c084fc' }, dataContract: 'signal.v1', telemetry: { value: 'metrics.signalStrengthPercent', unit: 'metrics.signalUnit', status: 'status' } },
  { id: 'aether.battery-health', name: '电池健康度', description: '显示电池剩余电量、健康度和充放电状态。', category: '设备资产', version: '1.0.0', componentType: 'progress-ring', status: 'installed', tags: ['电池', '健康度'], sample: { label: '电池剩余', value: 86, unit: '%', color: '#4ade80', accentColor: '#4ade80' }, dataContract: 'battery.v1', telemetry: { value: 'metrics.batteryLevel', unit: 'metrics.batteryUnit', status: 'status' } },
  { id: 'aether.alarm-events', name: '告警事件列表', description: '接收网关告警事件，按严重程度和发生时间展示。', category: '状态告警', version: '1.0.0', componentType: 'alert-list', status: 'installed', tags: ['告警', '事件流'], sample: { label: '实时告警', items: [] }, dataContract: 'alert.v1', telemetry: { items: 'items' } },
  { id: 'aether.device-health', name: '设备健康状态', description: '综合展示设备在线、延迟和健康状态。', category: '设备资产', version: '1.0.0', componentType: 'stats-table', status: 'installed', tags: ['设备', '健康'], sample: { label: '设备健康', rows: [] }, dataContract: 'device.v1', telemetry: { rows: 'rows', status: 'status' } },
  { id: 'aether.device-topology-live', name: '设备拓扑关系', description: '显示设备节点、网关和链路在线状态。', category: '设备资产', version: '1.0.0', componentType: 'topology', status: 'installed', tags: ['拓扑', '链路'], sample: { label: '设备拓扑', color: '#a78bfa', accentColor: '#a78bfa' }, dataContract: 'topology.v1', telemetry: { topology: 'topology', status: 'status' } },
  { id: 'aether.level-card', name: '液位监测卡', description: '用于水箱、油罐和料仓的液位监测。', category: '核心指标', version: '1.0.0', componentType: 'progress-ring', status: 'installed', tags: ['液位', '料仓', '储罐'], sample: { label: '储罐液位', value: 68, unit: '%', color: '#2dd4bf', accentColor: '#2dd4bf' }, dataContract: 'level.v1', telemetry: { value: 'metrics.levelPercent', unit: 'metrics.levelUnit', status: 'status' } },
  { id: 'aether.rpm-gauge', name: '转速仪表', description: '展示电机、风机和泵组的转速状态。', category: '核心指标', version: '1.0.0', componentType: 'gauge', status: 'installed', tags: ['转速', '电机', 'RPM'], sample: { label: '电机转速', value: 82, unit: 'rpm', color: '#818cf8', accentColor: '#818cf8' }, dataContract: 'rpm.v1', telemetry: { value: 'metrics.rpmPercent', unit: 'metrics.rpmUnit', status: 'status' } },
  { id: 'aether.torque-card', name: '扭矩监测卡', description: '展示旋转设备扭矩和机械负载。', category: '核心指标', version: '1.0.0', componentType: 'metric-card', status: 'installed', tags: ['扭矩', '机械负载'], sample: { label: '轴端扭矩', value: 42, unit: 'N·m', color: '#fbbf24', accentColor: '#fbbf24' }, dataContract: 'torque.v1', telemetry: { value: 'metrics.torqueNm', unit: 'metrics.torqueUnit', status: 'status' } },
  { id: 'aether.air-quality', name: '空气质量卡', description: '展示机房或生产环境的 CO₂ 浓度与空气质量状态。', category: '核心指标', version: '1.0.0', componentType: 'metric-card', status: 'installed', tags: ['空气质量', 'CO₂', '环境'], sample: { label: 'CO₂ 浓度', value: 620, unit: 'ppm', color: '#fb7185', accentColor: '#fb7185' }, dataContract: 'air-quality.v1', telemetry: { value: 'metrics.co2Ppm', unit: 'metrics.co2Unit', status: 'status' } },
];

export const getPluginById = (id: string) => OFFICIAL_PLUGIN_REGISTRY.find((plugin) => plugin.id === id);

export function getOfficialPluginRealtimeMapping(plugin: OfficialPluginDefinition): Record<string, string> {
  return {
    value: plugin.telemetry?.value || (plugin.id === 'aether.flip-number' ? 'metrics.throughput' : plugin.dataContract === 'gauge.v1' ? 'metrics.power' : 'metrics.value'),
    status: plugin.telemetry?.status || 'status',
    ...(plugin.telemetry?.label ? { label: plugin.telemetry.label } : {}),
    ...(plugin.telemetry?.unit ? { unit: plugin.telemetry.unit } : {}),
    ...(plugin.telemetry?.freshness ? { freshness: plugin.telemetry.freshness } : {}),
    ...(plugin.telemetry?.series ? { series: plugin.telemetry.series } : plugin.dataContract === 'series.v1' ? { series: 'series' } : {}),
    ...(plugin.telemetry?.categories ? { categories: plugin.telemetry.categories } : {}),
    ...(plugin.telemetry?.rows ? { rows: plugin.telemetry.rows } : plugin.dataContract === 'table.v1' ? { rows: 'rows' } : {}),
    ...(plugin.telemetry?.items ? { items: plugin.telemetry.items } : plugin.dataContract === 'alert.v1' ? { items: 'items' } : {}),
    ...(plugin.telemetry?.content ? { content: plugin.telemetry.content } : plugin.dataContract === 'device.v1' ? { content: 'content' } : {}),
    ...(plugin.telemetry?.location ? { location: plugin.telemetry.location } : {}),
    ...(plugin.telemetry?.topology ? { topology: plugin.telemetry.topology } : {}),
  };
}
