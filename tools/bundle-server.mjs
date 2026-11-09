// 把 server/index.js 及其依赖打包成单文件，安装包不再需要 node_modules。
import { build } from 'esbuild';
import fs from 'node:fs';

const outfile = 'server/bundle.mjs';

await build({
  entryPoints: ['server/index.js'],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  banner: {
    js: "import { createRequire as __aetherCreateRequire } from 'node:module'; const require = __aetherCreateRequire(import.meta.url);",
  },
  logLevel: 'warning',
});

const size = fs.statSync(outfile).size;
console.log(`[server] 打包完成: ${outfile} (${(size / 1024 / 1024).toFixed(2)} MB)`);
