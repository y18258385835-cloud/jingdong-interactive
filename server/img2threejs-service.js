import { transform } from 'esbuild';
import dns from 'dns/promises';
import { isIP } from 'net';
import { URL } from 'url';

const MAX_IMAGES = 5;
const MAX_IMAGE_DATA_URL_LENGTH = 25 * 1024 * 1024;
const MAX_CODE_LENGTH = 120_000;
const REQUEST_TIMEOUT_MS = 180_000;

export class Img2ThreeJsValidationError extends Error {}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
  }

  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function validateEndpoint(endpoint) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Img2ThreeJsValidationError('API 端点地址无效');
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
    throw new Img2ThreeJsValidationError('API 端点必须是公开的 HTTPS 地址');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Img2ThreeJsValidationError('不允许请求本机或局域网 API 地址');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Img2ThreeJsValidationError('API 端点域名无法解析');
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Img2ThreeJsValidationError('不允许请求私有网络 API 地址');
  }

  return parsed.toString();
}

function validateInput(body) {
  const apiKey = body?.apiKey;
  const endpoint = body?.endpoint || 'https://api.openai.com/v1/chat/completions';
  const model = body?.model;
  const images = body?.images;

  if (typeof apiKey !== 'string' || apiKey.trim().length === 0 || apiKey.length > 2048) {
    throw new Img2ThreeJsValidationError('请填写有效的 API Key');
  }
  if (typeof model !== 'string' || model.trim().length === 0 || model.length > 256) {
    throw new Img2ThreeJsValidationError('请填写支持图片理解的模型名称');
  }
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    throw new Img2ThreeJsValidationError(`请上传 1 至 ${MAX_IMAGES} 张产品图片`);
  }
  if (images.some((image) => typeof image !== 'string' || image.length > MAX_IMAGE_DATA_URL_LENGTH || !/^data:image\/(png|jpe?g|webp);base64,/i.test(image))) {
    throw new Img2ThreeJsValidationError('图片仅支持 PNG、JPG、WebP，且不能超过大小限制');
  }

  return { apiKey: apiKey.trim(), endpoint, model: model.trim(), images };
}

function getTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === 'string' ? part : part?.text || part?.content || '')
      .filter((part) => typeof part === 'string')
      .join('\n');
  }
  return '';
}

function extractCode(content) {
  const text = getTextContent(content).trim();
  const block = text.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/i);
  return (block ? block[1] : text).trim();
}

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const output = Array.isArray(data?.output) ? data.output : [];
  return output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((part) => part?.text || part?.content || '')
    .filter((part) => typeof part === 'string')
    .join('\n');
}

function assertSafeModule(code) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new Img2ThreeJsValidationError('模型没有返回 Three.js 代码');
  }
  if (code.length > MAX_CODE_LENGTH) {
    throw new Img2ThreeJsValidationError('生成代码过长，已拒绝执行');
  }
  const hasFactoryExport = /export\s+(?:async\s+)?function\s+createModel\s*\(/.test(code) || /export\s*\{[^}]*\bcreateModel\b[^}]*\}/.test(code);
  if (!hasFactoryExport || !/\bfunction\s+createModel\s*\(/.test(code)) {
    throw new Img2ThreeJsValidationError('生成代码必须导出 createModel(textureData) 函数');
  }
  if (/\basync\s+function\s+createModel\s*\(/.test(code)) {
    throw new Img2ThreeJsValidationError('createModel 不能是异步函数');
  }
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|importScripts|eval)\s*\(|\b(?:Function|require)\s*\(|document\s*\.\s*cookie|\b(?:localStorage|sessionStorage|indexedDB)\b|\bprocess\s*\./.test(code)) {
    throw new Img2ThreeJsValidationError('生成代码包含不允许的浏览器或网络访问能力');
  }
  if (/\bimport\s*\(/.test(code)) {
    throw new Img2ThreeJsValidationError('生成代码不允许动态导入模块');
  }

  const imports = [...code.matchAll(/\bimport[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g)];
  for (const match of imports) {
    const source = match[1];
    if (source !== 'three' && !source.startsWith('three/examples/jsm/')) {
      throw new Img2ThreeJsValidationError('生成代码只能导入 three 或 three/examples/jsm 模块');
    }
  }
}

async function compileModule(code) {
  try {
    const result = await transform(code, {
      loader: 'ts',
      format: 'esm',
      target: 'es2020',
      legalComments: 'none',
    });
    return result.code.trim();
  } catch (error) {
    throw new Img2ThreeJsValidationError(`生成的 Three.js 代码无法编译: ${error.message}`);
  }
}

const SYSTEM_PROMPT = `You generate procedural Three.js product models following the img2threejs workflow. A single image supports an approximate, visible-side reconstruction only; do not claim hidden geometry is known.

Return only a JavaScript ES module. It must export exactly this synchronous factory:
export function createModel(textureData) { ... return group; }

Rules:
- Use only Three.js classes. Import only from 'three' or 'three/examples/jsm/...'; if no import is included, THREE is provided at runtime.
- Return a THREE.Group and set names on the root and every logical product part.
- Build a clear hierarchy of independent meshes/groups for product body, panels, buttons, fasteners and other visible parts. Prefer suitable primitives, Shape/ExtrudeGeometry, curves and instancing instead of a single flat box.
- If textureData exists, load it with THREE.TextureLoader, set texture.colorSpace = THREE.SRGBColorSpace, and apply it to the image-visible front surface. Infer other surfaces conservatively with PBR materials.
- Keep real-time browser performance reasonable. Do not use more than 20,000 segments/instances in total.
- Do not use network APIs, browser storage, timers, eval, dynamic imports, external URLs, or code outside the model factory that has side effects.
- Do not include Markdown fences, explanations, TypeScript types, or any text outside the module.`;

function buildMessages(images) {
  const imageContent = images.map((image) => ({ type: 'image_url', image_url: { url: image } }));
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analyze these product reference views. Build the best browser-ready procedural Three.js model possible. Use the first image as the texture source for its visible face. The result must be an approximate reconstruction, not photogrammetry.',
        },
        ...imageContent,
      ],
    },
  ];
}

export async function generateImg2ThreeJs(body) {
  const input = validateInput(body);
  const endpoint = await validateEndpoint(input.endpoint);
  const isResponsesEndpoint = /\/responses(?:\?|$)/i.test(new URL(endpoint).pathname);
  const requestBody = isResponsesEndpoint
    ? {
        model: input.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Analyze these product reference views and build the best browser-ready procedural Three.js model possible. Return only the JavaScript module.' },
              ...input.images.map((image) => ({ type: 'input_image', image_url: image })),
            ],
          },
        ],
        temperature: 0.2,
        max_output_tokens: 8192,
      }
    : {
        model: input.model,
        messages: buildMessages(input.images),
        temperature: 0.2,
        max_tokens: 8192,
      };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // The upstream response remains available as a short diagnostic below.
  }

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || raw.slice(0, 500) || `HTTP ${response.status}`;
    throw new Error(`视觉模型请求失败 (HTTP ${response.status}): ${detail}`);
  }

  const code = extractCode(isResponsesEndpoint
    ? extractResponseText(data)
    : data?.choices?.[0]?.message?.content);
  assertSafeModule(code);
  const compiledCode = await compileModule(code);
  assertSafeModule(compiledCode);

  return {
    code: compiledCode,
    spec: {
      generatedAt: new Date().toISOString(),
      referenceViews: input.images.length,
      approximation: 'single-view or multi-view procedural reconstruction',
    },
  };
}
