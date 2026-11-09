// 追加一批高频界面文案的英文映射（只补充缺失项，不改已有翻译）。
import fs from 'node:fs';

const file = 'src/i18n/locales/en-US.ts';
let source = fs.readFileSync(file, 'utf8');

const additions = {
  '数据大屏': 'Data Wall',
  '其他': 'Other',
  '核心指标': 'Key Metrics',
  '标题': 'Title',
  '按钮': 'Button',
  '图片': 'Image',
  '视频': 'Video',
  '卡片': 'Card',
  '表单': 'Form',
  '模块标题': 'Module Title',
  '标题文字': 'Title Text',
  '按钮文字': 'Button Text',
  '在线': 'Online',
  '运行': 'Running',
  '操作按钮': 'Action Button',
  '交互控件': 'Interaction Controls',
  '颗粒': 'Particles',
  '数据源': 'Data Source',
  '数据绑定': 'Data Binding',
  '刷新间隔': 'Refresh Interval',
  '显示标签': 'Show Labels',
  '显示图例': 'Show Legend',
  '显示数值': 'Show Values',
  '数值': 'Value',
  '单位': 'Unit',
  '趋势': 'Trend',
  '颜色': 'Color',
  '主题': 'Theme',
  '深色': 'Dark',
  '浅色': 'Light',
  '字号': 'Font Size',
  '圆角': 'Corner Radius',
  '边框': 'Border',
  '阴影': 'Shadow',
  '背景': 'Background',
  '透明度': 'Opacity',
  '动画': 'Animation',
  '时长': 'Duration',
  '速度': 'Speed',
  '方向': 'Direction',
  '循环': 'Loop',
  '播放': 'Play',
  '暂停': 'Pause',
  '上一页': 'Previous',
  '下一页': 'Next',
  '打开': 'Open',
  '编辑': 'Edit',
  '设置': 'Settings',
  '关于': 'About',
  '版本': 'Version',
  '语言': 'Language',
  '全屏': 'Fullscreen',
  '退出': 'Exit',
  '应用': 'Apply',
  '重置': 'Reset',
  '缩放数字（可选）': 'Scale value (optional)',
  '件/min': 'pcs/min',
};

const existing = new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
const entries = Object.entries(additions).filter(([key]) => !existing.has(key));
if (!entries.length) {
  console.log('没有需要补充的文案');
  process.exit(0);
}

const block = `\n  // 高频界面文案（第二批）\n${entries.map(([zh, en]) => `  '${zh}': '${en}',`).join('\n')}\n`;
const closeIndex = source.lastIndexOf('\n};');
source = `${source.slice(0, closeIndex)}${block}};${source.slice(closeIndex + 3)}`;
fs.writeFileSync(file, source, 'utf8');
console.log(`已补充 ${entries.length} 条英文文案`);
