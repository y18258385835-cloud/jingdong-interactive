#!/usr/bin/env node
/**
 * AETHER 工程 CLI（离线、无依赖）。
 *
 * 用法：
 *   node tools/aether-cli/cli.mjs inspect <project.json>
 *   node tools/aether-cli/cli.mjs scenes <project.json>
 *   node tools/aether-cli/cli.mjs layers <project.json> [--scene s1]
 *   node tools/aether-cli/cli.mjs validate <project.json>
 *   node tools/aether-cli/cli.mjs set-text <project.json> --layer <id> --text "新文案" [--scene <id>] [--out out.json]
 *   node tools/aether-cli/cli.mjs rename-scene <project.json> --scene <id> --alias "新名字" [--out out.json]
 *   node tools/aether-cli/cli.mjs set-duration <project.json> --scene <id> --seconds 12 [--out out.json]
 *   node tools/aether-cli/cli.mjs mcp            # 启动 MCP stdio 服务器
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadProject, saveProject, summarize, listScenes, listLayers,
  setLayerText, validate, renameScene, setDuration,
} from './core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args[key] = next; i += 1; }
      else args[key] = true;
    } else {
      args._.push(token);
    }
  }
  return args;
}

function fail(message, code = 1) {
  console.error(`错误：${message}`);
  process.exit(code);
}

const [command, file, ...rest] = process.argv.slice(2);

if (!command || command === '--help' || command === '-h') {
  console.log(`AETHER 工程 CLI

  inspect <file>                     工程概览
  scenes <file>                      场景列表
  layers <file> [--scene <id>]       图层列表
  validate <file>                    结构校验
  set-text <file> --layer <id> --text <t> [--scene <id>] [--out <file>]
  rename-scene <file> --scene <id> --alias <name> [--out <file>]
  set-duration <file> --scene <id> --seconds <n> [--out <file>]
  mcp                                启动 MCP stdio 服务器

工程文件来自编辑器「导出 → 工程源数据 (JSON)」，可离线、免费导出。`);
  process.exit(command ? 0 : 1);
}

if (command === 'mcp') {
  await import('./mcp.mjs');
  process.exit(0);
}

if (!file) fail('缺少工程文件路径');

const args = parseArgs(rest);
const asJson = Boolean(args.json);
const { project, file: resolved } = loadProject(file);
const writeOut = Boolean(args.out);
const outFile = writeOut ? String(args.out) : resolved;

try {
  let result;
  switch (command) {
    case 'inspect':
      result = summarize(project);
      break;
    case 'scenes':
      result = listScenes(project);
      break;
    case 'layers':
      result = listLayers(project, args.scene);
      break;
    case 'validate':
      result = validate(project);
      break;
    case 'set-text':
      if (!args.layer) fail('缺少 --layer');
      if (typeof args.text !== 'string') fail('缺少 --text');
      result = setLayerText(project, { sceneId: args.scene, layerId: String(args.layer), text: args.text });
      saveProject(project, outFile);
      result.writtenTo = outFile;
      break;
    case 'rename-scene':
      if (!args.scene) fail('缺少 --scene');
      if (typeof args.alias !== 'string') fail('缺少 --alias');
      result = renameScene(project, { sceneId: String(args.scene), alias: args.alias });
      saveProject(project, outFile);
      result.writtenTo = outFile;
      break;
    case 'set-duration':
      if (!args.scene) fail('缺少 --scene');
      if (args.seconds === undefined) fail('缺少 --seconds');
      result = setDuration(project, { sceneId: String(args.scene), seconds: args.seconds });
      saveProject(project, outFile);
      result.writtenTo = outFile;
      break;
    default:
      fail(`未知命令：${command}`);
  }

  if (asJson) console.log(JSON.stringify(result, null, 2));
  else if (command === 'inspect') {
    console.log(`工程：${result.title}`);
    console.log(`场景：${result.sceneCount} 个 / 图层：${result.layerCount} 个 / 总时长：${result.durationSeconds}s`);
    console.log(`起始场景：${result.startScene}`);
    console.log(`图层类型：${Object.entries(result.layerTypes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    if (result.externalResources.length) console.log(`外链资源：${result.externalResources.length} 个（离线导出会失败）`);
  } else if (command === 'scenes') {
    for (const scene of result) console.log(`${scene.isStart ? '*' : ' '} ${scene.id}  ${scene.alias}  ${scene.duration}s  ${scene.layers} 图层`);
  } else if (command === 'layers') {
    for (const layer of result) console.log(`${layer.sceneId}  ${layer.id}  ${layer.type}  ${layer.name}${layer.text ? `  "${String(layer.text).slice(0, 40)}"` : ''}`);
  } else if (command === 'validate') {
    console.log(result.ok ? '校验通过' : `校验失败：${result.errors.length} 个错误`);
    result.errors.forEach((message) => console.log(`  [错误] ${message}`));
    result.warnings.forEach((message) => console.log(`  [警告] ${message}`));
    if (!result.ok) process.exitCode = 2;
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
