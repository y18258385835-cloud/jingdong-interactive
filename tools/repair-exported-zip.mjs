import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Usage: node tools/repair-exported-zip.mjs <input.zip> <output.zip>');
}

const root = resolve(import.meta.dirname, '..');
const sourceArchive = await JSZip.loadAsync(await readFile(inputPath));
const legacyIndex = await sourceArchive.file('index.html')?.async('text');
const projectMatch = legacyIndex?.match(/window\.__AETHER_EXPORT_PROJECT__=([\s\S]*?);<\/script>/);
if (!projectMatch) {
  throw new Error('The ZIP does not contain an embedded AETHER project payload.');
}
const project = JSON.parse(projectMatch[1]);

const dataAssetRefs = new Map();
let embeddedAssetCount = 0;
const dataUrlToAsset = (dataUrl) => {
  const existing = dataAssetRefs.get(dataUrl);
  if (existing) return existing;
  const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) return dataUrl;
  const mimeType = match[1] || 'application/octet-stream';
  const payload = match[2];
  const bytes = dataUrl.includes(';base64,')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  const extension = ({
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav',
  })[mimeType] || 'bin';
  const folder = mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('audio/') ? 'audio' : 'img';
  const ref = `./assets/${folder}/embedded_${++embeddedAssetCount}.${extension}`;
  const asset = { ref, bytes };
  dataAssetRefs.set(dataUrl, asset);
  return asset;
};

const replaceDataRefs = (value) => {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(replaceDataRefs);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && child.startsWith('data:') && /(?:Ref|refId)$/i.test(key)) {
      const asset = dataUrlToAsset(child);
      if (typeof asset !== 'string') value[key] = asset.ref;
    } else {
      replaceDataRefs(child);
    }
  }
};
replaceDataRefs(project);

const repaired = new JSZip();
for (const [name, entry] of Object.entries(sourceArchive.files)) {
  if (entry.dir || name === 'index.html' || name === 'favicon.svg' || /^assets\/[^/]+\.(?:js|css)$/i.test(name)) continue;
  repaired.file(name, await entry.async('nodebuffer'));
}

const runtimeRoot = resolve(root, 'public', 'export-player');
repaired.file('favicon.svg', await readFile(resolve(root, 'public', 'favicon.svg')));
repaired.file('assets/aether-player.css', await readFile(resolve(runtimeRoot, 'assets', 'aether-player.css')));
repaired.file('assets/aether-player.js', await readFile(resolve(runtimeRoot, 'assets', 'aether-player.js')));
for (const asset of dataAssetRefs.values()) repaired.file(asset.ref.slice(2), asset.bytes);
repaired.file('project.json', JSON.stringify(project, null, 2));
const projectScript = `<script>window.__AETHER_EXPORT_PLAYER__=true;window.__AETHER_EXPORT_PROJECT__=${JSON.stringify(project).replace(/</g, '\\u003c')};</script>`;
repaired.file('index.html', `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./assets/aether-player.css" />
    <title>AETHER Player</title>
    ${projectScript}
  </head>
  <body>
    <div id="root"></div>
    <script src="./assets/aether-player.js"></script>
  </body>
</html>
`);

await writeFile(outputPath, await repaired.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
