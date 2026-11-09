// 解析 visualizer 的 raw-data，输出主 chunk 里体积最大的模块。
import fs from 'node:fs';

const stats = JSON.parse(fs.readFileSync('promo/bundle-stats.json', 'utf8'));
const parts = stats.nodeParts || {};

const chunk = stats.tree.children.find((child) => /assets\/index-.*\.js$/.test(child.name));
if (!chunk) {
  console.error('未找到主 chunk');
  process.exit(1);
}

const walk = (node, trail, out) => {
  const nextTrail = [...trail, node.name];
  if (node.uid && parts[node.uid]) {
    out.push({ size: parts[node.uid].renderedLength || 0, gzip: parts[node.uid].gzipLength || 0, path: nextTrail.join('/') });
    return;
  }
  for (const child of node.children || []) walk(child, nextTrail, out);
};

const leaves = [];
walk(chunk, [], leaves);
leaves.sort((a, b) => b.size - a.size);

const total = leaves.reduce((sum, leaf) => sum + leaf.size, 0);
console.log(`主 chunk: ${chunk.name} (${(total / 1024 / 1024).toFixed(2)} MB)\n`);
for (const leaf of leaves.slice(0, 25)) {
  const path = leaf.path.replace(/^assets\/index-[^/]*\//, '').replace(/.*node_modules\//, 'node_modules/');
  console.log(`${(leaf.size / 1024).toFixed(0).padStart(6)} KB  ${path}`);
}
