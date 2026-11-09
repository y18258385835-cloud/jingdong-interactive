// i18n 第八批：更新提示相关文案。
import fs from 'node:fs';

const file = 'src/i18n/locales/en-US.ts';
let source = fs.readFileSync(file, 'utf8');

const additions = {
  '检查更新': 'Check for Updates',
  '发现新版本': 'New version available',
  '已是最新版本': "You're up to date",
  '立即下载': 'Download',
  '稍后提醒': 'Later',
  '关闭更新提示': 'Dismiss update notice',
};

const existing = new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
const entries = Object.entries(additions).filter(([key]) => !existing.has(key));
if (!entries.length) {
  console.log('没有需要补充的文案');
  process.exit(0);
}

const block = `\n  // 第八批：更新提示\n${entries.map(([zh, en]) => `  '${zh}': '${en}',`).join('\n')}\n`;
const closeIndex = source.lastIndexOf('\n};');
source = `${source.slice(0, closeIndex)}${block}};${source.slice(closeIndex + 3)}`;
fs.writeFileSync(file, source, 'utf8');
console.log(`已补充 ${entries.length} 条英文文案`);
