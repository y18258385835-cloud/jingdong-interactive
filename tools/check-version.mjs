#!/usr/bin/env node
/**
 * 版本号一致性检查：package.json（唯一事实源）、installer.iss、前端兜底值必须一致。
 * 用法：node tools/check-version.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkgVersion = JSON.parse(read('package.json')).version;
const installerVersion = (read('installer.iss').match(/#define MyAppVersion "([^"]+)"/) || [])[1];
const appVersionFallback = (read('src/core/db/types.ts').match(/APP_VERSION = import\.meta\.env\.VITE_APP_VERSION \|\| '([^']+)'/) || [])[1];

const rows = [
  ['package.json', pkgVersion],
  ['installer.iss', installerVersion],
  ['src/core/db/types.ts (fallback)', appVersionFallback],
];

const mismatched = rows.filter(([, value]) => value !== pkgVersion);
for (const [name, value] of rows) {
  console.log(`${value === pkgVersion ? '✓' : '✗'} ${name}: ${value ?? '(未找到)'}`);
}
if (mismatched.length) {
  console.error('\n版本号不一致，请统一到 package.json 的版本。');
  process.exit(1);
}
console.log(`\n版本一致：${pkgVersion}`);
