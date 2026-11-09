// 按文件导出中文字面量（用于分批翻译）。
import fs from 'node:fs';
import path from 'node:path';

const targets = process.argv.slice(2);
const root = process.cwd();
const result = {};

for (const target of targets) {
  const file = path.resolve(root, target);
  const text = fs.readFileSync(file, 'utf8');
  const counts = new Map();
  for (const raw of text.match(/['"`]([^'"`\n]*[\u4e00-\u9fa5][^'"`\n]*)['"`]/g) || []) {
    const value = raw.slice(1, -1).trim();
    if (!value || value.length > 60) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  result[target] = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
}

const out = 'promo/i18n-files.json';
fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
for (const [file, entries] of Object.entries(result)) {
  console.log(`${file}: ${entries.length} 条`);
}
