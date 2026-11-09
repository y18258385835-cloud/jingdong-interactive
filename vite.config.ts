import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defineConfig, type UserConfig} from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { vite3DProxyPlugin } from './vite-plugin-3d-proxy';

// 版本号唯一事实源：package.json。构建时注入到前端，避免源码里再写死一份。
const APP_VERSION = String(
  JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version || '0.0.0'
);

export default defineConfig(({ command }): UserConfig => {
  const isBuild = command === 'build';
  const base = process.env.VITE_BASE || (isBuild ? '/app/' : '/');
  return {
    base,
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    },
    plugins: [
      react(),
      tailwindcss(),
      vite3DProxyPlugin(),
      ...(process.env.ANALYZE === '1'
        ? [visualizer({ filename: 'promo/bundle-stats.json', template: 'raw-data', gzipSize: true })]
        : []),
      {
        name: 'serve-export-player-runtime',
        configureServer(server) {
          server.middlewares.use('/export-player', async (req, res, next) => {
            const pathname = (req.url || '/').split('?')[0].replace(/^\/+/, '');
            if (!pathname) {
              next();
              return;
            }
            const file = path.resolve(__dirname, 'public', 'export-player', pathname);
            if (pathname === 'project.json' || pathname === 'manifest.json') {
              try {
                const fs = await import('node:fs/promises');
                const data = await fs.readFile(file);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(data);
              } catch { next(); }
              return;
            }
            try {
              const fs = await import('node:fs/promises');
              const data = await fs.readFile(file);
              const ext = path.extname(file).toLowerCase();
              const types: Record<string, string> = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.svg': 'image/svg+xml',
              };
              res.statusCode = 200;
              res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
              res.end(data);
            } catch {
              next();
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      manifest: 'manifest.json',
      rollupOptions: {
        output: {
          manualChunks: {
            // 3D 娓叉煋閲嶅簱鐙珛鍒嗗寘锛堥厤鍚?Element3DView 鎳掑姞杞斤紝浠呭湪鐢ㄥ埌 3D 鍏冪礌鏃跺姞杞斤級
            three: ['three'],
            'gaussian-splats': ['@mkkellogg/gaussian-splats-3d'],
            // 閫氱敤澶т緷璧栧垎鍖咃紝鍒╀簬娴忚鍣ㄩ暱鏈熺紦瀛橈紝鍑忓皯涓诲寘浣撶Н
            vendor: ['react', 'react-dom', 'motion'],
            charts: ['html2canvas-pro', 'jszip'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    server: {
      // Derive HMR from the active frontend port. A fixed clientPort made
      // the :3000 editor connect to an unrelated :3001 process.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // 打包产物、运行时分发目录、导出的工程文件不需要 HMR；
        // 尤其是 runtime/node.exe 会被杀毒/文件锁占用，触发 EBUSY 导致 dev 崩溃。
        ignored: ['**/runtime/**', '**/release/**', '**/data/**', '**/promo/out/**', '**/public/mediapipe/**'],
      },
      // Keep browser licensing calls on the editor origin. This avoids a
      // `Failed to fetch` error when the editor is opened on a fallback Vite
      // port while the license service remains on its backend port.
      proxy: {
        '^/api/(share|v1/(license|subscription|export)|admin/(licenses|notifications)|public/(free-experience-link|notifications|app-update)|llm/extract-controls|control)': {
          target: process.env.VITE_LICENSE_SERVER_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});


