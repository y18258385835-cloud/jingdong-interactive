// i18n 第五批：属性面板残余标签与画布安全框。
import fs from 'node:fs';

const file = 'src/i18n/locales/en-US.ts';
let source = fs.readFileSync(file, 'utf8');

const additions = {
  '所属图层组': 'Layer Group',
  '未分配分组': 'Ungrouped',
  '未分配分组（独立图层）': 'Ungrouped (independent layer)',
  '等比例缩放': 'Lock Aspect Ratio',
  '切换到场景设置': 'Switch to Scene Settings',
  '切换到图层属性': 'Switch to Layer Properties',
  '图层属性': 'Layer Properties',
  '图层属性分类': 'Layer property tabs',
  '场景结束': 'Scene End',
  '磁吸开启': 'Snap On',
  '磁吸关闭': 'Snap Off',
  '动作安全': 'Action Safe',
  '标题安全': 'Title Safe',
  '字幕安全': 'Caption Safe',
  '画面安全': 'Frame Safe',
  '当前时间': 'Current Time',
  '总帧数': 'Total Frames',
  '添加图层': 'Add Layer',
  '删除所选': 'Delete Selected',
  '图层操作': 'Layer Actions',
  '场景设置面板': 'Scene settings panel',
  '图层属性面板': 'Layer properties panel',
};

const existing = new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
const entries = Object.entries(additions).filter(([key]) => !existing.has(key));
if (!entries.length) {
  console.log('没有需要补充的文案');
  process.exit(0);
}

const block = `\n  // 第五批：属性面板残余与安全框\n${entries.map(([zh, en]) => `  '${zh}': '${en}',`).join('\n')}\n`;
const closeIndex = source.lastIndexOf('\n};');
source = `${source.slice(0, closeIndex)}${block}};${source.slice(closeIndex + 3)}`;
fs.writeFileSync(file, source, 'utf8');
console.log(`已补充 ${entries.length} 条英文文案`);
