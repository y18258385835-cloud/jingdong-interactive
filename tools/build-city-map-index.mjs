// 从 officialCityMapData.ts 提取「城市 ID → 城市名」的轻量索引，
// 让主包不必为了一个下拉框加载 1.8 MB 的几何数据。
import fs from 'node:fs';

const source = fs.readFileSync('src/components/ui/officialCityMapData.ts', 'utf8');
const entries = [];
const pattern = /"(map-[a-z0-9-]+)":\s*\{\s*"name":\s*"([^"]*)"/g;
let match;
while ((match = pattern.exec(source))) entries.push([match[1], match[2]]);

if (!entries.length) {
  console.error('未提取到城市地图索引');
  process.exit(1);
}

const ids = entries.map(([id]) => `'${id}'`);
const names = entries.map(([id, name]) => `  '${id}': '${name}',`).join('\n');

const output = `/**
 * 城市地图的轻量索引（仅 ID 与名称，不含 SVG 几何数据）。
 *
 * 几何数据在 \`officialCityMapData.ts\`（约 1.8 MB），只在真正渲染城市地图时
 * 通过 \`cityMapRegistry\` 动态加载，避免进入首屏主包。
 *
 * 该文件由 tools/build-city-map-index.mjs 生成，请勿手工编辑。
 */
export const CITY_MAP_IDS = [
${ids.join(',\n')},
] as const;

export type CityMapId = (typeof CITY_MAP_IDS)[number];

export const CITY_MAP_NAMES: Record<string, string> = {
${names}
};

const CITY_MAP_ID_SET = new Set<string>(CITY_MAP_IDS);

export const isCityMapId = (id: string): boolean => CITY_MAP_ID_SET.has(id);
`;

fs.writeFileSync('src/components/ui/cityMapIndex.ts', output, 'utf8');
console.log(`已生成 ${entries.length} 个城市索引`);
