/**
 * Vite 插件：AI 3D 模型生成代理
 * 将代理服务器逻辑直接集成到 Vite dev server，无需单独启动 node 服务
 *
 * 端点：
 *   POST /api/3d/generate  - 创建图片转3D任务
 *   POST /api/3d/task      - 查询任务状态
 *   GET  /api/3d/download  - 下载生成的 GLB
 *   GET  /api/health       - 健康检查
 */
import type { Plugin } from 'vite';
import JSZip from 'jszip';
import { transform } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import dns from 'dns/promises';
import { isIP } from 'net';
import { URL } from 'url';
import { generateImg2ThreeJs, Img2ThreeJsValidationError } from './server/img2threejs-service.js';
import { buildPluginAiMessages, parsePluginAiResponse, PluginAiValidationError } from './server/plugin-ai-contract.js';
import { buildHarnessInterviewMessages, buildHarnessReviewMessages, buildSceneAiMessages, extractSceneAiText, isImageGenerationModel, isLikelyVisionModel, normalizeHarnessAttachments, parseHarnessInterviewResponse, parseHarnessReviewResponse, parseSceneAiResponse } from './server/scene-ai-contract.js';

// 火山引擎 Seed3D 配置
const VOLC_CONFIG = {
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
  model: 'doubao-seed3d-2-0-260328',
};

interface GenerateBody {
  provider: string;
  apiKey: string;
  endpoint?: string;
  model?: string;
  images: string[];
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function upstreamErrorMessage(data: any, rawText: string, fallback: string, secret = '') {
  const message = data?.error?.message || data?.error || data?.message || data?.detail;
  const redact = (value: string) => (secret ? value.replace(secret, '[已隐藏]') : value)
    .replace(/\b(?:sk|rk|pk|key|ep)[-_][A-Za-z0-9._-]{8,}\b/gi, (token) => `${token.slice(0, 3)}***`);
  if (typeof message === 'string' && message.trim()) return `${fallback}（上游：${redact(message.trim()).slice(0, 240)}）`;
  if (rawText.trim()) return `${fallback}（上游返回的不是 JSON）`;
  return fallback;
}

function isParameterCompatibilityError(status: number, data: any, rawText: string) {
  const message = [data?.error?.message, data?.message, rawText].filter(Boolean).join(' ');
  return status === 400 && /temperature|max_tokens|max_completion_tokens|unsupported|不支持|参数/i.test(message);
}

function buildSceneRequest(model: string, messages: unknown[], conservative = false) {
  const reasoningControl = /hy4-preview/i.test(model) ? { reasoning_effort: 'none' } : {};
  return conservative
    ? { model, messages, max_completion_tokens: 2600, stream: false, ...reasoningControl }
    : { model, messages, temperature: 0.25, max_tokens: 2600, stream: false, ...reasoningControl };
}

const SCENE_UPSTREAM_TIMEOUT_MS = 60_000;

async function fetchSceneAttempt(endpoint: string, apiKey: string, requestBody: unknown) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('MODEL_UPSTREAM_TIMEOUT')), SCENE_UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('MODEL_UPSTREAM_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSceneWithRetry(endpoint: string, apiKey: string, requestBody: unknown) {
  let upstream = await fetchSceneAttempt(endpoint, apiKey, requestBody);
  for (let attempt = 0; attempt < 2 && [429, 500, 502, 503, 504].includes(upstream.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });
  }
  return upstream;
}

function json(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

const BACKGROUND_REMOVAL_PROVIDERS = {
  'remove-bg': { endpoint: 'https://api.remove.bg/v1.0/removebg', keyHeader: 'X-Api-Key' },
  clipdrop: { endpoint: 'https://clipdrop-api.co/remove-background/v1', keyHeader: 'x-api-key' },
} as const;

class BackgroundRemovalValidationError extends Error {}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function parseSafeBackgroundUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw new BackgroundRemovalValidationError('Invalid endpoint');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) throw new BackgroundRemovalValidationError('Only HTTPS endpoints are allowed');
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new BackgroundRemovalValidationError('Local network targets are not allowed');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new BackgroundRemovalValidationError('Private network targets are not allowed');
  return parsed;
}

function extractReferenceSignals(rawHtml: string, url: string) {
  const html = rawHtml.slice(0, 1_500_000);
  const decode = (value: string) => value.replace(/&(?:amp|quot|#39|lt|gt);/gi, (entity) => ({ '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }[entity.toLowerCase()] || ' '));
  const pick = (pattern: RegExp) => decode((html.match(pattern)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 500);
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i) || pick(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const description = pick(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((match) => decode(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())).filter(Boolean).slice(0, 12);
  return { url, title: title || new URL(url).hostname, description, headings };
}

function decodeBackgroundImage(value: unknown) {
  if (typeof value !== 'string' || value.length > 16 * 1024 * 1024) throw new BackgroundRemovalValidationError('Image is missing or exceeds the 12 MB limit');
  const match = value.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new BackgroundRemovalValidationError('Only PNG, JPEG, or WebP images are supported');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new BackgroundRemovalValidationError('Image is missing or exceeds the 12 MB limit');
  return { mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(), buffer };
}

async function removeBackgroundInDev(body: any) {
  const provider = body?.provider || 'remove-bg';
  if (!['remove-bg', 'clipdrop', 'custom'].includes(provider)) throw new BackgroundRemovalValidationError('Unsupported background removal provider');
  if (typeof body?.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 2048) throw new BackgroundRemovalValidationError('A valid API key is required');
  const image = decodeBackgroundImage(body?.imageDataUrl);
  const target = provider === 'custom' ? body.endpoint : BACKGROUND_REMOVAL_PROVIDERS[provider as keyof typeof BACKGROUND_REMOVAL_PROVIDERS].endpoint;
  const endpoint = await parseSafeBackgroundUrl(target);
  const form = new FormData();
  form.append('image_file', new Blob([image.buffer], { type: image.mimeType }), 'aether-input');
  if (provider === 'remove-bg') {
    form.append('size', 'auto');
    form.append('format', 'png');
  }
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { [provider === 'custom' ? 'Authorization' : BACKGROUND_REMOVAL_PROVIDERS[provider as keyof typeof BACKGROUND_REMOVAL_PROVIDERS].keyHeader]: provider === 'custom' ? `Bearer ${body.apiKey.trim()}` : body.apiKey.trim() },
    body: form,
  });
  const result = Buffer.from(await upstream.arrayBuffer());
  if (!upstream.ok) throw new Error('Background removal provider request failed');
  if (!result.length || result.length > 10 * 1024 * 1024) throw new Error('Background removal result exceeds the size limit');
  return { success: true, mimeType: 'image/png', dataUrl: `data:image/png;base64,${result.toString('base64')}` };
}

/**
 * 火山引擎 Seed3D：创建任务
 */
async function volcCreateTask(body: GenerateBody): Promise<any> {
  const endpoint = body.endpoint || VOLC_CONFIG.endpoint;
  const model = body.model || VOLC_CONFIG.model;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify({
      model,
      content: [
        { type: 'text', text: '--subdivisionlevel medium --fileformat glb' },
        { type: 'image_url', image_url: { url: body.images[0] } },
      ],
    }),
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || `HTTP ${res.status}`);
  }
  return { taskId: data.id || data.task_id, raw: data };
}

/**
 * 火山引擎 Seed3D：查询任务
 */
async function volcQueryTask(taskId: string, apiKey: string, endpoint?: string): Promise<any> {
  const url = `${endpoint || VOLC_CONFIG.endpoint}/${taskId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  const status = data.status;
  const isCompleted = status === 'succeeded' || status === 'completed';
  const isFailed = status === 'failed' || status === 'cancelled';
  const outputUrl = data.content?.file_url || data.output?.[0]?.url || data.content?.[0]?.url || null;
  return { status, isCompleted, isFailed, outputUrl, raw: data };
}

/**
 * Tripo3D：创建任务
 */
async function tripoCreateTask(body: GenerateBody): Promise<any> {
  const res = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${body.apiKey}`,
    },
    body: JSON.stringify({
      type: 'image_to_model',
      file: { type: 'url', url: body.images[0] },
    }),
  });
  const data = await res.json() as any;
  if (!res.ok || data.code !== 0) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return { taskId: data.data.task_id, raw: data };
}

/**
 * Tripo3D：查询任务
 */
async function tripoQueryTask(taskId: string, apiKey: string): Promise<any> {
  const res = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json() as any;
  if (!res.ok || data.code !== 0) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  const status = data.data.status;
  const isCompleted = status === 'success';
  const isFailed = status === 'failed' || status === 'cancelled';
  const outputUrl = data.data.output?.model || null;
  return { status, isCompleted, isFailed, outputUrl, raw: data };
}

/**
 * img2threejs 风格：调用 AI 生成 Three.js 过程化代码
 * 支持 OpenAI 兼容格式（DeepSeek / 火山引擎 / GPT / 中转站）
 * 输入：图片(base64) + API配置
 * 输出：TypeScript 工厂函数代码 createModel(): THREE.Group
 */
async function img2threejsGenerate(body: any): Promise<{ code: string; spec: any }> {
  const apiKey = body.apiKey;
  const endpoint = body.endpoint || 'https://api.deepseek.com/v1/chat/completions';
  const model = body.model || 'deepseek-chat';
  const image = body.images?.[0] || body.image || '';

  if (!apiKey) throw new Error('缺少 API Key');
  if (!image) throw new Error('缺少图片');

  const systemPrompt = `你是一位专业的 Three.js 3D 建模工程师，精通 img2threejs 过程化建模方法，擅长用纹理贴图实现产品的1:1精确还原。

你的任务：根据用户提供的产品图片，用 Three.js 构建一个精确的 3D 模型。**必须使用上传的图片作为纹理贴图**，做到产品外观1:1还原。

严格要求：
1. **纹理贴图（最重要）**：
   - 函数签名为 export function createModel(textureData?: string): THREE.Group
   - textureData 是第一张上传图片的 base64 数据（data:image/png;base64,... 格式）
   - 用 const texture = new THREE.TextureLoader().load(textureData) 加载纹理
   - 设置 texture.colorSpace = THREE.SRGBColorSpace
   - 产品的主要可见面（正面、顶面）必须使用纹理贴图，做到1:1还原产品外观
   - 侧面、背面、底面等不可见面可以用纯色材质（颜色从图片中提取）
   - 纹理需要根据部件大小调整 repeat 和 offset，确保贴图比例正确

2. **部件拆分**：仔细观察图片，将产品拆分为 8-20 个逻辑部件（如外壳、屏幕、按钮、镜头、底座、支架、轮子、拉杆等），每个部件是一个独立的 Mesh，有明确的 name 属性

3. **层级结构**：用 THREE.Group 组织部件，父子关系合理（如"机身"group 包含"前面板"、"侧面"、"顶部"等子部件）

4. **比例精确**：仔细观察图片中的比例关系，尺寸要与原图一致。先测量图片中产品的宽高比，再按比例设置几何体尺寸

5. **几何体精确**：
   - 优先使用 RoundedBoxGeometry（圆角盒子）模拟产品外壳
   - 用 CylinderGeometry 模拟按钮、轮子、圆柱部件
   - 用 ExtrudeGeometry 模拟复杂形状（需要先定义 Shape）
   - 用 TorusGeometry 模拟环形部件
   - 避免只用简单的 BoxGeometry，要根据产品形状选择合适的几何体

6. **材质真实**：
   - 主要可见面用 MeshStandardMaterial({ map: texture }) 贴纹理
   - 金属部件：metalness 0.7-0.9, roughness 0.2-0.4
   - 塑料部件：metalness 0.0-0.1, roughness 0.5-0.8
   - 玻璃/屏幕：用 MeshPhysicalMaterial，transmission 0.9, roughness 0.05
   - 发光部件：emissive + emissiveIntensity

7. **位置合理**：每个部件的 position 要精确，组合起来与原图一致。注意部件之间的间隙和重叠

8. **动画就绪**：每个可动部件（如盖子、轮子、拉杆、支架）设置独立 group，方便后续做爆炸/分层/旋转动画

9. **代码规范**：返回一个完整的 TypeScript 函数，函数签名为 export function createModel(textureData?: string): THREE.Group

输出格式：只返回代码，不要任何解释、markdown 标记或额外文字。代码必须可以直接在浏览器中执行。

示例结构：
\`\`\`typescript
export function createModel(textureData?: string): THREE.Group {
  const group = new THREE.Group();
  group.name = 'product';

  // 加载纹理
  let texture: THREE.Texture | null = null;
  if (textureData) {
    texture = new THREE.TextureLoader().load(textureData);
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  // 机身主体（圆角盒子）
  const body = new THREE.Group();
  body.name = 'body';

  // 前面板（贴纹理，1:1还原产品正面）
  const frontPanel = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 0.05),
    new THREE.MeshStandardMaterial({ map: texture || undefined, color: 0x333333, metalness: 0.3, roughness: 0.6 })
  );
  frontPanel.name = 'front_panel';
  frontPanel.position.set(0, 0, 0.25);
  body.add(frontPanel);

  // 侧面（纯色，颜色从图片提取）
  const sidePanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 3, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5, roughness: 0.4 })
  );
  sidePanel.name = 'side_panel_left';
  sidePanel.position.set(-1, 0, 0);
  body.add(sidePanel);

  // 轮子（圆柱）
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 })
  );
  wheel.name = 'wheel_front_left';
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(-0.8, -1.4, 0.1);
  body.add(wheel);

  group.add(body);
  // ... 更多部件

  return group;
}
\`\`\``;

  const userPrompt = `请根据这张产品图片，生成一个精确的 Three.js 过程化 3D 模型，做到产品外观1:1还原。

核心要求：
- **必须使用纹理贴图**：函数接受 textureData 参数（上传图片的 base64），用 TextureLoader 加载后贴到产品主要可见面，做到1:1还原产品外观
- 仔细观察图片中的产品结构、比例、颜色、材质、细节
- 将产品拆分为 8-20 个逻辑部件，每个部件有明确的 name
- 优先使用 RoundedBoxGeometry、CylinderGeometry、ExtrudeGeometry 等精确几何体
- 主要可见面用纹理贴图，侧面/背面用纯色材质（颜色从图片提取）
- 材质要真实（金属/塑料/玻璃/屏幕发光等）
- 返回完整的 TypeScript 函数 createModel(textureData?: string): THREE.Group
- 只返回代码，不要任何解释`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'text', text: userPrompt },
      { type: 'image_url', image_url: { url: image } },
    ]},
  ];

  // 检测是否是火山引擎 responses 端点（使用不同的请求/响应格式）
  const isResponsesEndpoint = endpoint.includes('/responses');

  console.log('[img2threejs] 调用 AI 生成代码... model=' + model + ', endpoint=' + endpoint + (isResponsesEndpoint ? ' (responses格式)' : ''));

  let res: Response;
  if (isResponsesEndpoint) {
    // 火山引擎 responses 格式：input 数组 + input_image/input_text 内容类型
    const input = [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      { role: 'user', content: [
        { type: 'input_image', image_url: image },
        { type: 'input_text', text: userPrompt },
      ]},
    ];
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input }),
    });
  } else {
    // 标准 OpenAI 兼容格式
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 8000 }),
    });
  }

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || `HTTP ${res.status}`);
  }

  // 解析响应：responses 格式 vs 标准 chat/completions 格式
  let code = '';
  if (isResponsesEndpoint) {
    // 火山引擎 responses 格式：output[0].content[0].text
    code = data.output?.[0]?.content?.[0]?.text || data.output?.[0]?.content?.find((c: any) => c.type === 'output_text')?.text || '';
  } else {
    // 标准 chat/completions 格式
    code = data.choices?.[0]?.message?.content || '';
  }
  if (!code) throw new Error('AI 返回为空');

  // 清理代码：去除 markdown 代码块标记
  code = code.replace(/```typescript\s*/g, '').replace(/```javascript\s*/g, '').replace(/```\s*/g, '');
  code = code.trim();

  // 确保函数签名正确
  if (!code.includes('createModel')) {
    // 尝试提取函数体
    const funcMatch = code.match(/function\s+\w+\s*\([^)]*\)\s*[:\s]*[^{]*\{/);
    if (funcMatch) {
      code = code.replace(funcMatch[0], 'export function createModel(): THREE.Group {');
    }
  }

  console.log('[img2threejs] 代码生成成功, length=' + code.length);

  // 用 esbuild 将 TypeScript 转译为 JavaScript（浏览器可直接执行）
  try {
    const result = await transform(code, {
      loader: 'ts',
      format: 'esm',
      target: 'es2020',
    });
    code = result.code;
    console.log('[img2threejs] esbuild 转译成功, length=' + code.length);
  } catch (e: any) {
    console.warn('[img2threejs] esbuild 转译失败，尝试直接执行原始代码:', e.message);
  }

  return { code, spec: { parts: 0, generatedAt: new Date().toISOString() } };
}


/**
 * LLM API 连通测试
 * 1. 尝试调用 /models 获取模型列表
 * 2. 如果失败，尝试简单的 chat 调用
 */
async function testLLMConnection(body: any): Promise<{ success: boolean; models: string[]; message: string }> {
  const apiKey = body.apiKey;
  const endpoint = body.endpoint || '';
  const modelsEndpoint = body.modelsEndpoint || (endpoint ? endpoint.replace(/\/chat\/completions$/, '/models') : '');

  if (!apiKey) return { success: false, models: [], message: '缺少 API Key' };
  if (!modelsEndpoint && !endpoint) return { success: false, models: [], message: '缺少 API 端点' };
  if (typeof endpoint !== 'string' || !/^https:\/\//i.test(endpoint) || endpoint.length > 2048) {
    return { success: false, models: [], message: 'API 端点必须使用 HTTPS' };
  }
  if (typeof modelsEndpoint !== 'string' || modelsEndpoint.length > 2048 || !/^https:\/\//i.test(modelsEndpoint)) {
    return { success: false, models: [], message: '模型端点必须使用 HTTPS' };
  }

  // 1. 尝试获取模型列表
  if (isImageGenerationModel(body.model)) {
    return { success: false, models: [], message: '当前模型仅用于图片生成，不支持 AETHER 的 Chat Completions 场景编排，请选择视觉对话模型。' };
  }
  if (modelsEndpoint) {
    try {
      const res = await fetch(modelsEndpoint, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        const models = (data.data || []).map((m: any) => m.id || m.name).filter(Boolean);
        return { success: true, models, message: `连接成功，共 ${models.length} 个可用模型` };
      }
      if (res.status === 401 || res.status === 403) {
        let errMsg = `认证失败 (HTTP ${res.status})：API Key 无效或已过期`;
        try {
          const data = await res.json() as any;
          if (data.error?.message) errMsg += ` - ${data.error.message}`;
          else if (data.message) errMsg += ` - ${data.message}`;
        } catch { /* ignore */ }
        return { success: false, models: [], message: errMsg };
      }
    } catch (e) {
      // /models 网络失败，继续尝试 chat 调用
    }
  }

  // 2. 尝试简单的 chat 调用
  if (endpoint) {
    try {
      const isResponsesEndpoint = endpoint.includes('/responses');
      let res: Response;
      if (isResponsesEndpoint) {
        // 火山引擎 responses 格式
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: body.model || 'test',
            input: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }],
          }),
        });
      } else {
        // 标准 OpenAI 兼容格式
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: body.model || 'test',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          }),
        });
      }
      const rawText = await res.text();
      let data: any = {};
      try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* use raw text in the error */ }
      if (res.ok) {
        const responseText = extractSceneAiText(data);
        if (!responseText.trim() && !data?.id) return { success: false, models: [], message: '模型端点返回了空响应，无法确认模型是否可用' };
        return { success: true, models: [], message: '连接成功（API 可用，模型列表需手动填写）' };
      }
      let errMsg = upstreamErrorMessage(data, rawText, `HTTP ${res.status}`);
      if (res.status === 401 || res.status === 403) {
        errMsg = `认证失败：API Key 无效或已过期 - ${errMsg}`;
      } else if (res.status === 404) {
        errMsg = `端点不存在 (404)：请检查 API 端点地址是否正确 - ${errMsg}`;
      } else if (res.status === 429) {
        errMsg = `请求过于频繁 (429)：API 限流，请稍后再试 - ${errMsg}`;
      }
      return { success: false, models: [], message: errMsg };
    } catch (e: any) {
      return { success: false, models: [], message: `网络错误：${e.message || '连接失败，请检查网络或端点地址'}` };
    }
  }

  return { success: false, models: [], message: '无法连接：缺少有效的 API 端点' };
}

export function vite3DProxyPlugin(): Plugin {
  return {
    name: 'vite-plugin-3d-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // CORS 预检
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }

        // 健康检查
        if (url.startsWith('/api/health')) {
          json(res, 200, { status: 'ok', service: 'aether-3d-proxy', time: new Date().toISOString() });
          return;
        }

        if (url.startsWith('/api/reference/analyze') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            const target = await parseSafeBackgroundUrl(body?.url);
            const upstream = await fetch(target, { headers: { Accept: 'text/html,application/xhtml+xml' }, redirect: 'manual' });
            if (!upstream.ok) throw new Error(`网页返回 ${upstream.status}`);
            const html = await upstream.text();
            if (html.length > 1_500_000) throw new Error('网页内容过大，无法安全解析');
            json(res, 200, { success: true, reference: extractReferenceSignals(html, target.toString()) });
          } catch (e: any) {
            const status = e instanceof BackgroundRemovalValidationError ? 400 : 502;
            json(res, status, { success: false, error: e.message || '网页信息读取失败' });
          }
          return;
        }

        if (url.startsWith('/api/open-folder') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            const folder = typeof body.folder === 'string' ? body.folder : '';
            if (!folder || !path.isAbsolute(folder) || folder.length > 4096) {
              json(res, 400, { success: false, error: '无效的文件夹路径' });
              return;
            }
            if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
              json(res, 404, { success: false, error: '文件夹不存在或不可访问' });
              return;
            }
            const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
            spawn(command, [folder], { detached: true, stdio: 'ignore' }).unref();
            json(res, 200, { success: true });
          } catch (e: any) {
            json(res, 500, { success: false, error: e.message || '无法打开文件夹' });
          }
          return;
        }

        // 创建生成任务
        if (url.startsWith('/api/3d/generate') && req.method === 'POST') {
          try {
            const rawBody = await readBody(req);
            const body = JSON.parse(rawBody) as GenerateBody;

            if (!body.apiKey) {
              json(res, 400, { success: false, error: '缺少 API Key' });
              return;
            }
            if (!body.images || body.images.length === 0) {
              json(res, 400, { success: false, error: '缺少图片' });
              return;
            }

            let result;
            if (body.provider === 'tripo') {
              result = await tripoCreateTask(body);
            } else if (body.provider === 'volcengine' || !body.provider) {
              result = await volcCreateTask(body);
            } else {
              json(res, 400, { success: false, error: `不支持的提供商: ${body.provider}` });
              return;
            }

            json(res, 200, { success: true, taskId: result.taskId, provider: body.provider });
          } catch (e: any) {
            console.error('[3D Proxy] 创建任务失败:', e.message);
            json(res, 500, { success: false, error: e.message || '创建任务失败' });
          }
          return;
        }

        // 查询任务状态
        if (url.startsWith('/api/3d/task') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            const taskId = body.taskId || '';
            const provider = body.provider || 'volcengine';
            const apiKey = body.apiKey || '';
            const endpoint = body.endpoint || '';

            if (!taskId) {
              json(res, 400, { success: false, error: '缺少 taskId' });
              return;
            }

            let result;
            if (provider === 'tripo') {
              result = await tripoQueryTask(taskId, apiKey);
            } else {
              result = await volcQueryTask(taskId, apiKey, endpoint || undefined);
            }

            json(res, 200, {
              success: true,
              status: result.status,
              isCompleted: result.isCompleted,
              isFailed: result.isFailed,
              outputUrl: result.outputUrl,
              taskId,
            });
          } catch (e: any) {
            console.error('[3D Proxy] 查询任务失败:', e.message);
            json(res, 500, { success: false, error: e.message || '查询任务失败' });
          }
          return;
        }

        // 下载 GLB（代理转发，避免跨域）
        if (url.startsWith('/api/3d/download')) {
          try {
            const u = new URL(url, 'http://localhost');
            const fileUrl = u.searchParams.get('url') || '';
            if (!fileUrl) {
              json(res, 400, { success: false, error: '缺少下载地址' });
              return;
            }
            const fileRes = await fetch(fileUrl);
            let buffer = Buffer.from(await fileRes.arrayBuffer());

            // 文件头检测：打印前 8 字节十六进制，方便调试
            const headerHex = Array.from(buffer.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const headerStr = buffer.slice(0, 4).toString('ascii').replace(/[^\x20-\x7e]/g, '.');
            console.log('[3D Proxy] 下载文件: size=' + buffer.length + ', headerHex=' + headerHex + ', headerStr="' + headerStr + '", contentType=' + fileRes.headers.get('content-type'));

            // 如果是 ZIP 文件（PK 03 04），自动解压提取 .glb
            if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
              console.log('[3D Proxy] 检测到 ZIP 压缩包，正在解压提取 GLB...');
              const zip = await JSZip.loadAsync(buffer);
              const allFiles = Object.keys(zip.files);
              const glbFiles = allFiles.filter(name => name.toLowerCase().endsWith('.glb'));
              const gltfFiles = allFiles.filter(name => name.toLowerCase().endsWith('.gltf'));
              console.log('[3D Proxy] ZIP 内容: ' + allFiles.join(', ') + ' | GLB: ' + glbFiles.join(', ') + ' | GLTF: ' + gltfFiles.join(', '));
              if (glbFiles.length > 0) {
                const glbBuffer = await zip.files[glbFiles[0]].async('nodebuffer');
                console.log('[3D Proxy] 提取 GLB: ' + glbFiles[0] + ', size=' + glbBuffer.length);
                buffer = glbBuffer;
              } else if (gltfFiles.length > 0) {
                throw new Error('ZIP 中是 .gltf（非自包含格式，引用外部 bin/纹理），暂不支持');
              } else {
                throw new Error('ZIP 中未找到 .glb 或 .gltf 文件');
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Content-Length', buffer.length.toString());
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(buffer);
          } catch (e: any) {
            console.error('[3D Proxy] 下载失败:', e.message);
            json(res, 500, { success: false, error: e.message || '下载失败' });
          }
          return;
        }

        // img2threejs 风格：AI 生成 Three.js 过程化代码
        if (url.startsWith('/api/3d/img2threejs') && req.method === 'POST') {
          try {
            const rawBody = await readBody(req);
            const body = JSON.parse(rawBody);
            const result = await generateImg2ThreeJs(body);
            json(res, 200, { success: true, code: result.code, spec: result.spec });
          } catch (e: any) {
            console.error('[img2threejs] 生成失败:', e.message);
            const status = e instanceof Img2ThreeJsValidationError ? 400 : 502;
            json(res, status, { success: false, error: e.message || '视觉模型生成失败' });
          }
          return;
        }

        // Background removal for local development. Production uses server/index.js.
        if (url.startsWith('/api/image/remove-background') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            json(res, 200, await removeBackgroundInDev(body));
          } catch (e: any) {
            const status = e instanceof BackgroundRemovalValidationError ? 400 : 502;
            json(res, status, { success: false, error: e.message || 'Background removal failed' });
          }
          return;
        }

        // BYOK AI component generation for local development. Production uses server/index.js.
        if (url.startsWith('/api/llm/plugin-generate') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            if (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 2048) throw new PluginAiValidationError('请填写有效的 API Key');
            if (typeof body.endpoint !== 'string' || !/^https:\/\//i.test(body.endpoint) || body.endpoint.length > 2048) throw new PluginAiValidationError('API 端点必须使用 HTTPS');
            if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 256) throw new PluginAiValidationError('请填写模型名称');
            const upstream = await fetch(body.endpoint, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.apiKey.trim()}` },
              body: JSON.stringify({ model: body.model.trim(), messages: buildPluginAiMessages(body), temperature: 0.35, max_tokens: 700 }),
            });
            const data = await upstream.json().catch(() => ({}));
            if (!upstream.ok) { json(res, upstream.status, { success: false, error: '模型服务请求失败' }); return; }
            json(res, 200, { success: true, draft: parsePluginAiResponse(data?.choices?.[0]?.message?.content, body.componentType) });
          } catch (e: any) {
            json(res, e instanceof PluginAiValidationError ? 400 : 502, { success: false, error: e.message || 'AI 组件生成失败' });
          }
          return;
        }

        if (url.startsWith('/api/llm/interview') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            if (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 2048) throw new Error('API key is required');
            if (typeof body.endpoint !== 'string' || !/^https:\/\//i.test(body.endpoint) || body.endpoint.length > 2048) throw new Error('Endpoint must use HTTPS');
            if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 256) throw new Error('Model is required');
            if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 4000) throw new Error('Prompt is required');
            if (isImageGenerationModel(body.model)) throw new Error('当前模型仅用于图片生成，不支持 AETHER 的 Chat Completions 场景编排，请选择视觉对话模型。');
            const normalizedAttachments = normalizeHarnessAttachments(body.attachments);
            if (normalizedAttachments.some((attachment) => attachment.category === 'image' && attachment.dataUrl) && !isLikelyVisionModel(body.model)) {
              throw new Error('VISION_MODEL_REQUIRED: 当前模型未声明视觉输入能力。请选择名称包含 vision、VL、4o 或 omni 的视觉模型后再分析参考图。');
            }
            const interviewMessages = buildHarnessInterviewMessages({
                prompt: body.prompt,
                conversation: body.conversation,
                context: body.context,
                attachments: normalizedAttachments,
              });
            let upstream = await fetchSceneWithRetry(body.endpoint, body.apiKey.trim(), buildSceneRequest(body.model.trim(), interviewMessages));
            let rawText = await upstream.text();
            let data: any = {};
            try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* handled below */ }
            if (!upstream.ok && isParameterCompatibilityError(upstream.status, data, rawText)) {
              upstream = await fetchSceneWithRetry(body.endpoint, body.apiKey.trim(), buildSceneRequest(body.model.trim(), interviewMessages, true));
              rawText = await upstream.text();
              data = {};
              try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* handled below */ }
            }
            if (!upstream.ok) { json(res, upstream.status || 502, { success: false, error: upstreamErrorMessage(data, rawText, 'Interview model request failed') }); return; }
            json(res, 200, { success: true, interview: parseHarnessInterviewResponse(extractSceneAiText(data)) });
          } catch (e: any) {
            json(res, 502, { success: false, error: e.message || 'Interview request failed' });
          }
          return;
        }

        // BYOK structured scene generation for local development.
        if (url.startsWith('/api/llm/scene-generate') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            if (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 2048) throw new Error('请填写有效的 API Key');
            if (typeof body.endpoint !== 'string' || !/^https:\/\//i.test(body.endpoint) || body.endpoint.length > 2048) throw new Error('API 端点必须使用 HTTPS');
            if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 256) throw new Error('请填写模型名称');
            if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 4000) throw new Error('请输入场景需求');
            if (isImageGenerationModel(body.model)) throw new Error('当前模型仅用于图片生成，不支持 AETHER 的 Chat Completions 场景编排，请选择视觉对话模型。');
            if (body.attachments !== undefined && !Array.isArray(body.attachments)) throw new Error('Attachments must be an array');
            const normalizedAttachments = normalizeHarnessAttachments(body.attachments);
            if (normalizedAttachments.some((attachment) => attachment.category === 'image' && attachment.dataUrl) && !isLikelyVisionModel(body.model)) {
              throw new Error('VISION_MODEL_REQUIRED: 当前模型未声明视觉输入能力。请选择名称包含 vision、VL、4o 或 omni 的视觉模型后再生成场景。');
            }
            const sceneMessages = buildSceneAiMessages({
              prompt: body.prompt,
              context: body.context,
              attachments: normalizedAttachments,
            });
            let conservative = false;
            let upstream = await fetchSceneWithRetry(body.endpoint, body.apiKey.trim(), buildSceneRequest(body.model.trim(), sceneMessages));
            let rawText = await upstream.text();
            let data: any = {};
            try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* handled by actionable error below */ }
            if (!upstream.ok && isParameterCompatibilityError(upstream.status, data, rawText)) {
              conservative = true;
              upstream = await fetchSceneWithRetry(body.endpoint, body.apiKey.trim(), buildSceneRequest(body.model.trim(), sceneMessages, true));
              rawText = await upstream.text();
              data = {};
              try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* handled below */ }
            }
            if (!upstream.ok) { json(res, upstream.status, { success: false, error: upstreamErrorMessage(data, rawText, '模型服务请求失败', body.apiKey.trim()) }); return; }
            const content = extractSceneAiText(data);
            if (!content.trim()) throw new Error('Model returned an empty response');
            let proposal;
            let repaired = false;
            try {
              proposal = parseSceneAiResponse(content);
            } catch {
              const repairMessages = [
                ...sceneMessages,
                { role: 'assistant', content: content.slice(0, 12_000) },
                {
                  role: 'user',
                  content: 'Your previous response could not be executed by AETHER. Return corrected JSON only. Include a non-empty operations array using only the allowed operation kinds and element types from the system instruction. Do not explain the correction.',
                },
              ];
              const repairUpstream = await fetchSceneWithRetry(body.endpoint, body.apiKey.trim(), buildSceneRequest(body.model.trim(), repairMessages, conservative));
              const repairRawText = await repairUpstream.text();
              let repairData: any = {};
              try { repairData = repairRawText ? JSON.parse(repairRawText) : {}; } catch { /* handled below */ }
              if (!repairUpstream.ok) {
                throw new Error(`Model output repair failed: ${upstreamErrorMessage(repairData, repairRawText, 'model request failed', body.apiKey.trim())}`);
              }
              proposal = parseSceneAiResponse(extractSceneAiText(repairData));
              proposal.warnings.unshift('模型首次输出未通过 AETHER 协议，Harness 已自动修复为可执行方案。');
              repaired = true;
            }
            let evaluation: any = { source: 'unavailable', status: 'deferred', summary: '独立 AI 评测未执行。', issues: [], repairInstructions: [] };
            if (body.evaluate === true) {
              try {
                const reviewMessages = buildHarnessReviewMessages({ prompt: body.prompt, context: body.context, proposal });
                const reviewUpstream = await fetchSceneWithRetry(body.endpoint, body.apiKey.trim(), buildSceneRequest(body.model.trim(), reviewMessages, conservative));
                const reviewRawText = await reviewUpstream.text();
                let reviewData: any = {};
                try { reviewData = reviewRawText ? JSON.parse(reviewRawText) : {}; } catch { /* handled by parser */ }
                if (!reviewUpstream.ok) throw new Error(upstreamErrorMessage(reviewData, reviewRawText, 'Harness review request failed', body.apiKey.trim()));
                evaluation = parseHarnessReviewResponse(extractSceneAiText(reviewData));
              } catch (reviewError: any) {
                evaluation = {
                  source: 'unavailable',
                  status: 'deferred',
                  summary: '独立 AI 评测暂不可用，已转为本地 Harness 审计。',
                  issues: [String(reviewError?.message || '评测服务暂不可用').slice(0, 240)],
                  repairInstructions: ['稍后重试评测；确认写入前检查本地结构、布局和可编辑性审计。'],
                };
              }
            }
            proposal.evaluation = evaluation;
            json(res, 200, { success: true, proposal, repaired, evaluation });
          } catch (e: any) {
            json(res, 502, { success: false, error: e.message || 'AI 场景生成失败' });
          }
          return;
        }

        // LLM API 连通测试
        if (url.startsWith('/api/llm/models') && req.method === 'POST') {
          try {
            const body = JSON.parse(await readBody(req));
            if (typeof body.apiKey !== 'string' || !body.apiKey.trim() || body.apiKey.length > 2048) throw new Error('请填写有效的 API Key');
            if (typeof body.modelsEndpoint !== 'string' || !/^https:\/\//i.test(body.modelsEndpoint) || body.modelsEndpoint.length > 2048) throw new Error('模型端点必须使用 HTTPS');
            const upstream = await fetch(body.modelsEndpoint, { headers: { Authorization: `Bearer ${body.apiKey.trim()}` } });
            const rawText = await upstream.text();
            let data: any = {};
            try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* handled below */ }
            if (!upstream.ok) { json(res, upstream.status || 502, { success: false, models: [], error: upstreamErrorMessage(data, rawText, '模型列表读取失败', body.apiKey.trim()) }); return; }
            const candidates = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
            const models = candidates.map((item: any) => typeof item === 'string' ? item : item?.id || item?.name).filter((item: any) => typeof item === 'string' && item.trim()).map((item: string) => item.trim()).slice(0, 200);
            json(res, 200, { success: true, models, message: `已读取 ${models.length} 个模型` });
          } catch (e: any) {
            json(res, 502, { success: false, models: [], error: e.message || '模型列表读取失败' });
          }
          return;
        }

        if (url.startsWith('/api/llm/test') && req.method === 'POST') {
          try {
            const rawBody = await readBody(req);
            const body = JSON.parse(rawBody);
            const r = await testLLMConnection(body);
            json(res, 200, { success: r.success, models: r.models, message: r.message });
          } catch (e: any) {
            json(res, 500, { success: false, models: [], error: e.message || '测试失败' });
          }
          return;
        }

        next();
      });
    },
  };
}
