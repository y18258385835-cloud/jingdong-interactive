// 英文覆盖度报告：扫描 src 里的中文字面量，统计在语言包中的覆盖比例。
import fs from 'node:fs';
import path from 'node:path';
import { interfaceTranslations } from '../src/i18n/LanguageContext';

const root = process.cwd();
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
};
walk(path.join(root, 'src'));

const counts = new Map<string, number>();
const perFile = new Map<string, number>();

// 这些文件是「内容/预设数据」（城市名、动效名、组件目录），不属于界面文案。
const DATA_FILES = [
  'officialCityMapData.ts',
  'cityMapIndex.ts',
  'vfxMotions.ts',
  'vfxMotionIndex.ts',
  'officialShowcase.ts',
  'defaultData.ts',
  'dashboardTemplates.ts',
  'plugins/registry.ts',
  'plugins/pluginStudio.ts',
];

for (const file of files) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  if (DATA_FILES.some((name) => file.endsWith(name))) continue;
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.match(/['"`]([^'"`\n]*[\u4e00-\u9fa5][^'"`\n]*)['"`]/g) || [];
  for (const raw of matches) {
    const value = raw.slice(1, -1).trim();
    if (!value || value.length > 80) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
    perFile.set(file, (perFile.get(file) || 0) + 1);
  }
}

const unique = [...counts.keys()];
const covered = unique.filter((entry) => interfaceTranslations[entry]);
const ratio = unique.length ? Math.round((covered.length / unique.length) * 100) : 100;

console.log(`扫描文件: ${files.length}`);
console.log(`唯一中文字符串: ${unique.length}`);
console.log(`已有英文映射: ${covered.length}（${ratio}%）`);

// 高频文案更能反映「界面骨架」的完成度：组件目录/预设名称大多只出现 1 次。
console.log('\n按出现频次统计:');
for (const min of [10, 5, 3, 2]) {
  const bucket = unique.filter((entry) => (counts.get(entry) || 0) >= min);
  const hit = bucket.filter((entry) => interfaceTranslations[entry]).length;
  const percent = bucket.length ? Math.round((hit / bucket.length) * 100) : 100;
  console.log(`  出现 ≥${String(min).padStart(2)} 次: ${hit}/${bucket.length}（${percent}%）`);
}
console.log('\n缺口最大的文件:');
[...perFile.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([file, count]) => console.log(`  ${String(count).padStart(4)}  ${path.relative(root, file)}`));

console.log('\n未翻译的高频文案:');
unique
  .filter((entry) => !interfaceTranslations[entry])
  .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
  .slice(0, 20)
  .forEach((entry) => console.log(`  ×${counts.get(entry)}  ${entry}`));
