import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// ZIP files are opened directly from file://. A classic IIFE avoids the
// browser's ES-module/CORS restrictions that cause a blank offline page.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The generated player is later copied into public/export-player. Copying
  // public here would recursively embed the previous player on every build.
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: '.export-player-build',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      name: 'AetherExportPlayer',
      formats: ['iife'],
      fileName: () => 'assets/aether-player.js',
      cssFileName: 'aether-player',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
