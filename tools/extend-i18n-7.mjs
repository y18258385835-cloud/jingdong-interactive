// i18n 第七批：转场、分组与场景切换文案。
import fs from 'node:fs';

const file = 'src/i18n/locales/en-US.ts';
let source = fs.readFileSync(file, 'utf8');

const additions = {
  '出:': 'Out:',
  '入:': 'In:',
  '直接切换场景': 'Instant scene switch',
  '场景切换进出场动效': 'Scene transition effects',
  '场景切换': 'Scene Transition',
  '进出场动效': 'Enter / Exit Effects',
  '切换场景': 'Switch Scene',
  '未分配分组 (独立图层)': 'Ungrouped (independent layer)',
  '未分配分组（独立图层）': 'Ungrouped (independent layer)',
  '未分配分组 (独立图层) ': 'Ungrouped (independent layer)',
  '分组': 'Group',
  '添加分组': 'Add Group',
  '删除分组': 'Delete Group',
  '重命名分组': 'Rename Group',
  '场景轮播间隔': 'Carousel Interval',
  '自动进入下一场景': 'Auto-advance to next scene',
  '停留时长（秒）': 'Dwell time (s)',
  '总时长（秒）': 'Total duration (s)',
};

const existing = new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
const entries = Object.entries(additions).filter(([key]) => !existing.has(key));
if (!entries.length) {
  console.log('没有需要补充的文案');
  process.exit(0);
}

const block = `\n  // 第七批：转场 / 分组 / 场景切换\n${entries.map(([zh, en]) => `  '${zh}': '${en}',`).join('\n')}\n`;
const closeIndex = source.lastIndexOf('\n};');
source = `${source.slice(0, closeIndex)}${block}};${source.slice(closeIndex + 3)}`;
fs.writeFileSync(file, source, 'utf8');
console.log(`已补充 ${entries.length} 条英文文案`);
