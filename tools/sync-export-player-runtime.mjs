import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, '.export-player-build');
const destination = resolve(root, 'public', 'export-player');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, {
  recursive: true,
});
await copyFile(resolve(root, 'public', 'favicon.svg'), resolve(destination, 'favicon.svg'));

await writeFile(resolve(destination, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./assets/aether-player.css" />
    <title>AETHER Player</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="./assets/aether-player.js"></script>
  </body>
</html>
`);
