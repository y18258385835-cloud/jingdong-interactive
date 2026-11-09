/**
 * 城市地图的轻量索引（仅 ID 与名称，不含 SVG 几何数据）。
 *
 * 几何数据在 `officialCityMapData.ts`（约 1.8 MB），只在真正渲染城市地图时
 * 通过 `cityMapRegistry` 动态加载，避免进入首屏主包。
 *
 * 该文件由 tools/build-city-map-index.mjs 生成，请勿手工编辑。
 */
export const CITY_MAP_IDS = [
'map-beijing',
'map-shanghai',
'map-guangzhou',
'map-shenzhen',
'map-chengdu',
'map-chongqing',
'map-tianjin',
'map-shijiazhuang',
'map-taiyuan',
'map-shenyang',
'map-dalian',
'map-changchun',
'map-harbin',
'map-nanjing',
'map-suzhou',
'map-wuxi',
'map-hangzhou',
'map-ningbo',
'map-hefei',
'map-fuzhou',
'map-xiamen',
'map-jinan',
'map-qingdao',
'map-zhengzhou',
'map-wuhan',
'map-changsha',
'map-nanning',
'map-haikou',
'map-guiyang',
'map-kunming',
'map-xian',
'map-lanzhou',
'map-urumqi',
'map-zhuhai',
'map-foshan',
'map-huizhou',
'map-dongguan',
'map-zhongshan',
] as const;

export type CityMapId = (typeof CITY_MAP_IDS)[number];

export const CITY_MAP_NAMES: Record<string, string> = {
  'map-beijing': '北京市',
  'map-shanghai': '上海市',
  'map-guangzhou': '广州市',
  'map-shenzhen': '深圳市',
  'map-chengdu': '成都市',
  'map-chongqing': '重庆市',
  'map-tianjin': '天津市',
  'map-shijiazhuang': '石家庄市',
  'map-taiyuan': '太原市',
  'map-shenyang': '沈阳市',
  'map-dalian': '大连市',
  'map-changchun': '长春市',
  'map-harbin': '哈尔滨市',
  'map-nanjing': '南京市',
  'map-suzhou': '苏州市',
  'map-wuxi': '无锡市',
  'map-hangzhou': '杭州市',
  'map-ningbo': '宁波市',
  'map-hefei': '合肥市',
  'map-fuzhou': '福州市',
  'map-xiamen': '厦门市',
  'map-jinan': '济南市',
  'map-qingdao': '青岛市',
  'map-zhengzhou': '郑州市',
  'map-wuhan': '武汉市',
  'map-changsha': '长沙市',
  'map-nanning': '南宁市',
  'map-haikou': '海口市',
  'map-guiyang': '贵阳市',
  'map-kunming': '昆明市',
  'map-xian': '西安市',
  'map-lanzhou': '兰州市',
  'map-urumqi': '乌鲁木齐市',
  'map-zhuhai': '珠海市',
  'map-foshan': '佛山市',
  'map-huizhou': '惠州市',
  'map-dongguan': '东莞市',
  'map-zhongshan': '中山市',
};

const CITY_MAP_ID_SET = new Set<string>(CITY_MAP_IDS);

export const isCityMapId = (id: string): boolean => CITY_MAP_ID_SET.has(id);
