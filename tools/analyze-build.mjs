#!/usr/bin/env node
/** 构建并生成 bundle 体积报告（promo/bundle-stats.json + 控制台 Top 模块）。 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const build = spawnSync(npx, ['vite', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ANALYZE: '1' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const report = spawnSync(process.execPath, ['tools/report-bundle.mjs'], { cwd: root, stdio: 'inherit' });
process.exit(report.status ?? 0);
