// i18n 第三批：画布工具栏与场景卡片上的高频标签。
import fs from 'node:fs';

const file = 'src/i18n/locales/en-US.ts';
let source = fs.readFileSync(file, 'utf8');

const additions = {
  '光线钢笔': 'Saber Pen',
  '交互绘制': 'Interaction Draw',
  '蒙版钢笔': 'Mask Pen',
  '抓手工具': 'Hand Tool',
  '选择工具': 'Select Tool',
  '画笔工具': 'Pen Tool',
  '文字工具': 'Text Tool',
  '矩形工具': 'Rectangle Tool',
  '画布场景': 'Canvas Scene',
  '场景类型': 'Scene Type',
  '转场': 'Transition',
  '入场': 'Enter',
  '出场': 'Exit',
  '停留': 'Dwell',
  '画布比例': 'Canvas Ratio',
  '画面比例': 'Aspect Ratio',
  '安全框': 'Safe Area',
  '参考网格': 'Grid',
  '标尺': 'Rulers',
  '吸附': 'Snap',
  '缩放': 'Zoom',
  '适应窗口': 'Fit Window',
  '全屏演示': 'Fullscreen',
  '播放控制': 'Playback Controls',
  '时间轴': 'Timeline',
  '轨道': 'Tracks',
  '关键帧': 'Keyframes',
  '预览': 'Preview',
  '实时预览': 'Live Preview',
};

const existing = new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
const entries = Object.entries(additions).filter(([key]) => !existing.has(key));
if (!entries.length) {
  console.log('没有需要补充的文案');
  process.exit(0);
}

const block = `\n  // 第三批：画布工具栏与场景卡片\n${entries.map(([zh, en]) => `  '${zh}': '${en}',`).join('\n')}\n`;
const closeIndex = source.lastIndexOf('\n};');
source = `${source.slice(0, closeIndex)}${block}};${source.slice(closeIndex + 3)}`;
fs.writeFileSync(file, source, 'utf8');
console.log(`已补充 ${entries.length} 条英文文案`);
