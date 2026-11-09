#!/usr/bin/env node
/**
 * AETHER MCP 服务器（stdio，无第三方依赖）。
 *
 * 让 Claude / Codex / Cursor 等 MCP 客户端直接读写「工程源数据 (JSON)」：
 * 查看场景与图层、批量改文案、校验结构、写入新工程文件。
 *
 * 注册方式（示例）：
 *   {
 *     "mcpServers": {
 *       "aether": {
 *         "command": "node",
 *         "args": ["<仓库绝对路径>/tools/aether-cli/mcp.mjs"]
 *       }
 *     }
 *   }
 */
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadProject, saveProject, summarize, listScenes, listLayers,
  setLayerText, validate, renameScene, setDuration,
} from './core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTROL_FILE = path.join(ROOT, 'data', 'control-token.json');

/** 调用本地编辑器控制桥（server/control-bridge.js）。 */
async function controlRequest(pathname, init = {}, retried = false) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
  } catch {
    throw new Error('本地控制桥未启动：请先打开软件（或运行 node server/index.js）');
  }
  const response = await fetch(`http://127.0.0.1:${config.port || 8080}/api/control/${pathname}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Control-Token': config.token, ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  // 服务重启会轮换令牌：401 时重新读取 discovery 文件并重试一次。
  if (response.status === 401 && !retried) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return controlRequest(pathname, init, true);
  }
  if (!response.ok) throw new Error(data.error || `控制桥返回 ${response.status}`);
  return data;
}

const SERVER_INFO = { name: 'aether-project', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';

const text = (value) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

const tools = [
  {
    name: 'project_inspect',
    description: '查看 AETHER 工程概览：场景数、图层数、总时长、图层类型分布、外链资源。',
    inputSchema: { type: 'object', properties: { file: { type: 'string', description: '工程 JSON 绝对路径' } }, required: ['file'] },
    run: ({ file }) => text(summarize(loadProject(file).project)),
  },
  {
    name: 'scene_list',
    description: '列出工程内所有场景（id、名称、时长、图层数、是否起始场景）。',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] },
    run: ({ file }) => text(listScenes(loadProject(file).project)),
  },
  {
    name: 'layer_list',
    description: '列出图层。可选 sceneId 过滤，返回 id、类型、名称、文本与矩形。',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, sceneId: { type: 'string' } }, required: ['file'] },
    run: ({ file, sceneId }) => text(listLayers(loadProject(file).project, sceneId)),
  },
  {
    name: 'project_validate',
    description: '校验工程结构（场景/图层/尺寸/媒体引用/自定义代码长度），返回错误与警告。',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] },
    run: ({ file }) => text(validate(loadProject(file).project)),
  },
  {
    name: 'layer_set_text',
    description: '修改文本图层（txt）或自定义代码图层（custom-code）的文案/HTML。默认写回原文件，可用 outFile 另存。',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        layerId: { type: 'string' },
        text: { type: 'string' },
        sceneId: { type: 'string', description: '图层 id 重复时用于消歧' },
        outFile: { type: 'string', description: '可选：另存为新文件' },
      },
      required: ['file', 'layerId', 'text'],
    },
    run: ({ file, layerId, text: value, sceneId, outFile }) => {
      const { project, file: resolved } = loadProject(file);
      const result = setLayerText(project, { sceneId, layerId, text: value });
      const target = saveProject(project, outFile || resolved);
      return text({ ...result, writtenTo: target });
    },
  },
  {
    name: 'scene_rename',
    description: '重命名场景（alias）。',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string' }, sceneId: { type: 'string' }, alias: { type: 'string' }, outFile: { type: 'string' } },
      required: ['file', 'sceneId', 'alias'],
    },
    run: ({ file, sceneId, alias, outFile }) => {
      const { project, file: resolved } = loadProject(file);
      const result = renameScene(project, { sceneId, alias });
      return text({ ...result, writtenTo: saveProject(project, outFile || resolved) });
    },
  },
  {
    name: 'scene_set_duration',
    description: '设置场景时长（秒，必须大于 0）。',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string' }, sceneId: { type: 'string' }, seconds: { type: 'number' }, outFile: { type: 'string' } },
      required: ['file', 'sceneId', 'seconds'],
    },
    run: ({ file, sceneId, seconds, outFile }) => {
      const { project, file: resolved } = loadProject(file);
      const result = setDuration(project, { sceneId, seconds });
      return text({ ...result, writtenTo: saveProject(project, outFile || resolved) });
    },
  },
  {
    name: 'editor_status',
    description: '读取正在运行的编辑器：当前工程、场景列表、图层与文本。需要软件已打开且本地控制桥可用。',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const data = await controlRequest('state');
      return text({
        connected: data.connected,
        revision: data.revision,
        updatedAt: data.updatedAt,
        title: data.project?.title,
        activeSceneId: data.project?.activeSceneId,
        scenes: (data.project?.scenes || []).map((scene) => ({
          id: scene.id,
          alias: scene.alias,
          layers: (scene.layers || []).length,
        })),
      });
    },
  },
  {
    name: 'editor_wait_for_change',
    description: '等待编辑器内容发生变化（长轮询，默认 25 秒）。传入上次的 revision 可避免漏掉变更。',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'number', description: '上次拿到的 revision；不传则以当前 revision 为起点' },
        timeoutMs: { type: 'number', description: '最长等待时间（500-60000ms，默认 25000）' },
      },
    },
    run: async ({ since, timeoutMs = 25000 }) => {
      let from = typeof since === 'number' ? since : undefined;
      if (from === undefined) {
        const state = await controlRequest('state');
        from = Number(state.revision) || 0;
      }
      const data = await controlRequest(`events?since=${from}&timeoutMs=${timeoutMs}`);
      return text({
        changed: data.changed,
        revision: data.revision,
        title: data.project?.title,
        activeSceneId: data.project?.activeSceneId,
        updatedAt: data.updatedAt,
      });
    },
  },
  {
    name: 'editor_select_scene',
    description: '让正在运行的编辑器切换到指定场景。',
    inputSchema: {
      type: 'object',
      properties: { sceneId: { type: 'string' } },
      required: ['sceneId'],
    },
    run: async ({ sceneId }) => text(await controlRequest('command', {
      method: 'POST',
      body: JSON.stringify({ type: 'select_scene', sceneId }),
    })),
  },
  {
    name: 'editor_set_layer_text',
    description: '实时修改正在运行的编辑器里某个文本图层的文案（不需要导出/导入）。',
    inputSchema: {
      type: 'object',
      properties: { sceneId: { type: 'string' }, layerId: { type: 'string' }, text: { type: 'string' } },
      required: ['sceneId', 'layerId', 'text'],
    },
    run: async ({ sceneId, layerId, text: value }) => text(await controlRequest('command', {
      method: 'POST',
      body: JSON.stringify({ type: 'set_layer_text', sceneId, layerId, text: value }),
    })),
  },
  {
    name: 'editor_add_text_layer',
    description: '在当前工程里实时新建一个文本图层，可指定文案与位置（百分比 0-100）。',
    inputSchema: {
      type: 'object',
      properties: {
        sceneId: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' }, y: { type: 'number' },
        w: { type: 'number' }, h: { type: 'number' },
        fontSize: { type: 'number' },
      },
      required: ['sceneId', 'text'],
    },
    run: async (args) => text(await controlRequest('command', {
      method: 'POST',
      body: JSON.stringify({ type: 'add_text_layer', ...args }),
    })),
  },
  {
    name: 'editor_delete_element',
    description: '实时删除正在运行的编辑器里的指定图层。',
    inputSchema: {
      type: 'object',
      properties: { sceneId: { type: 'string' }, elementId: { type: 'string' } },
      required: ['sceneId', 'elementId'],
    },
    run: async ({ sceneId, elementId }) => text(await controlRequest('command', {
      method: 'POST',
      body: JSON.stringify({ type: 'delete_element', sceneId, elementId }),
    })),
  },
  {
    name: 'editor_export',
    description: '让正在运行的编辑器执行一次导出。saveToHost=true 时写入本机 data/exports 并返回路径，否则触发浏览器下载。',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['zip', 'single-html', 'json'], description: '默认 zip' },
        saveToHost: { type: 'boolean', description: 'true = 写本机目录并由 MCP 返回路径；false = 浏览器下载' },
      },
    },
    run: async ({ format = 'zip', saveToHost = false }) => text(await controlRequest('command', {
      method: 'POST',
      body: JSON.stringify({ type: 'export_project', format, saveToBridge: Boolean(saveToHost), timeoutMs: 120000 }),
    })),
  },
];

const byName = new Map(tools.map((tool) => [tool.name, tool]));

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(request) {
  const { id, method, params } = request;
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === 'notifications/initialized' || method === 'initialized') return undefined;
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') {
    return reply(id, {
      tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const tool = byName.get(name);
    if (!tool) return replyError(id, -32602, `未知工具：${name}`);
    try {
      return reply(id, await tool.run(params?.arguments || {}));
    } catch (error) {
      return reply(id, {
        content: [{ type: 'text', text: `执行失败：${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      });
    }
  }
  if (id !== undefined) return replyError(id, -32601, `未实现的方法：${method}`);
  return undefined;
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    replyError(null, -32700, 'JSON 解析失败');
    return;
  }
  handle(request).catch((error) => {
    replyError(request?.id ?? null, -32603, error instanceof Error ? error.message : String(error));
  });
});
rl.on('close', () => process.exit(0));
