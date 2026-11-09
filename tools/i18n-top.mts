// 导出未翻译文案的 Top N（用于人工筛选界面骨架文案）。
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

const DATA_FILES = [
  'officialCityMapData.ts', 'cityMapIndex.ts', 'vfxMotions.ts', 'vfxMotionIndex.ts',
  'officialShowcase.ts', 'defaultData.ts', 'dashboardTemplates.ts', 'plugins/registry.ts', 'plugins/pluginStudio.ts',
];

const counts = new Map<string, number>();
for (const file of files) {
  if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
  if (DATA_FILES.some((name) => file.endsWith(name))) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.match(/['"`]([^'"`\n]*[\u4e00-\u9fa5][^'"`\n]*)['"`]/g) || []) {
    const value = raw.slice(1, -1).trim();
    if (!value || value.length > 80) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
}

const missing = [...counts.entries()]
  .filter(([value]) => !interfaceTranslations[value])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 150)
  .map(([value, count]) => ({ value, count }));

fs.mkdirSync('promo', { recursive: true });
fs.writeFileSync('promo/i18n-top.json', JSON.stringify(missing, null, 2), 'utf8');
console.log(`已导出 ${missing.length} 条待翻译文案到 promo/i18n-top.json`);
