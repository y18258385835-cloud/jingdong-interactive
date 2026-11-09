// 从 vfxMotions.ts 提取「动效元数据索引」（不含绘制实现），
// 供全局搜索与插入逻辑使用，避免把 200+ KB 的动效实现打进主包。
import fs from 'node:fs';
import { VFX_MOTIONS } from '../src/utils/vfxMotions.ts';

const entries = VFX_MOTIONS.map((motion) => ({
  id: motion.id,
  name: motion.name,
  category: motion.category,
  icon: motion.icon,
  desc: motion.desc,
  colorA: motion.colorA,
  colorB: motion.colorB,
  ...(motion.colorC ? { colorC: motion.colorC } : {}),
  ...(motion.params ? { params: motion.params } : {}),
}));

const body = entries
  .map((entry) => `  ${JSON.stringify(entry)},`)
  .join('\n');

const output = `/**
 * VFX 动效元数据索引（不含绘制实现）。
 *
 * 由 tools/build-vfx-index.mjs 生成，请勿手工编辑。
 */
import type { VfxMotionDef } from './vfxMotions';

export type VfxMotionMeta = Omit<VfxMotionDef, 'params'> & { params?: VfxMotionDef['params'] };

export const VFX_MOTION_INDEX: VfxMotionMeta[] = [
${body}
];
`;

fs.writeFileSync('src/utils/vfxMotionIndex.ts', output, 'utf8');
console.log(`已生成 ${entries.length} 条动效索引`);
