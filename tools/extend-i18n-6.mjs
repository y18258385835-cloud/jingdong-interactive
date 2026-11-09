// i18n 第六批：体感手势提示、循环显示等残余标签。
import fs from 'node:fs';

const file = 'src/i18n/locales/en-US.ts';
let source = fs.readFileSync(file, 'utf8');

const additions = {
  '本场景已配置体感手势': 'Motion gestures configured for this scene',
  '循环显示': 'Loop',
  '开启': 'On',
  '关闭': 'Off',
  '开': 'On',
  '关': 'Off',
  '切换': 'Toggle',
  '打开面板': 'Open Panel',
  '收起面板': 'Collapse Panel',
  '展开面板': 'Expand Panel',
};

const existing = new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
const entries = Object.entries(additions).filter(([key]) => !existing.has(key));
if (!entries.length) {
  console.log('没有需要补充的文案');
  process.exit(0);
}

const block = `\n  // 第六批：残余提示与开关\n${entries.map(([zh, en]) => `  '${zh}': '${en}',`).join('\n')}\n`;
const closeIndex = source.lastIndexOf('\n};');
source = `${source.slice(0, closeIndex)}${block}};${source.slice(closeIndex + 3)}`;
fs.writeFileSync(file, source, 'utf8');
console.log(`已补充 ${entries.length} 条英文文案`);
