/**
 * AETHER 工程文件工具核心。
 *
 * 只处理「工程源数据 (JSON)」（导出面板里免费、可离线的那一份），
 * 不依赖浏览器、不依赖授权服务，可被 CLI 与 MCP 服务器共用。
 */
import fs from 'node:fs';
import path from 'node:path';

export const MEDIA_TYPES = new Set([
  'img', 'video', 'audio', 'model-3d', 'panorama-img', 'panorama-vid', 'gaussian-splat', 'sequence',
]);

export function loadProject(file) {
  const resolved = path.resolve(file);
  const raw = fs.readFileSync(resolved, 'utf8');
  const project = JSON.parse(raw);
  if (!project || typeof project !== 'object') throw new Error('工程文件不是有效的 JSON 对象');
  if (!project.scenes || typeof project.scenes !== 'object') throw new Error('工程文件缺少 scenes 字段');
  return { project, file: resolved };
}

export function saveProject(project, file) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  return resolved;
}

export function sceneEntries(project) {
  return Object.entries(project.scenes || {});
}

export function layerEntries(project, sceneId) {
  const scenes = sceneId ? [[sceneId, project.scenes[sceneId]]] : sceneEntries(project);
  const out = [];
  for (const [sid, scene] of scenes) {
    if (!scene) continue;
    for (const el of scene.els || []) out.push({ sceneId: sid, scene, el });
  }
  return out;
}

export function summarize(project) {
  const scenes = sceneEntries(project);
  const layers = layerEntries(project);
  const byType = {};
  for (const { el } of layers) byType[el.type] = (byType[el.type] || 0) + 1;
  const external = collectExternalRefs(project);
  return {
    title: project.meta?.title || '(未命名工程)',
    schemaVersion: project.meta?.v ?? null,
    appVersion: project.meta?.appVersion ?? null,
    startScene: project.start ?? null,
    sceneCount: scenes.length,
    layerCount: layers.length,
    durationSeconds: Math.round(scenes.reduce((sum, [, scene]) => sum + (Number(scene.duration) || 0), 0) * 10) / 10,
    layerTypes: byType,
    externalResources: external,
    canvas: project.canvasSize || project.canvas || null,
  };
}

export function listScenes(project) {
  return sceneEntries(project).map(([id, scene]) => ({
    id,
    alias: scene.alias || scene.name || id,
    duration: Number(scene.duration) || 0,
    layers: (scene.els || []).length,
    isStart: project.start === id,
  }));
}

export function listLayers(project, sceneId) {
  return layerEntries(project, sceneId).map(({ sceneId: sid, el }) => ({
    sceneId: sid,
    id: el.id,
    type: el.type,
    name: el.name || el.sourceName || el.id,
    // 文本图层的规范字段是 content；少数旧工程用的是 text。
    text: typeof el.content === 'string' ? el.content : (typeof el.text === 'string' ? el.text : undefined),
    rect: { x: el.x, y: el.y, w: el.w, h: el.h },
    hidden: Boolean(el.hidden),
  }));
}

/** 文本图层或自定义代码图层改文案。返回被修改的图层，便于确认。 */
export function setLayerText(project, { sceneId, layerId, text }) {
  const targets = layerEntries(project, sceneId).filter(({ el }) => el.id === layerId);
  if (!targets.length) throw new Error(`未找到图层 ${layerId}${sceneId ? `（场景 ${sceneId}）` : ''}`);
  if (targets.length > 1) throw new Error(`图层 ${layerId} 在多个场景中重复，请用 --scene 指定场景`);
  const { el } = targets[0];
  if (el.type === 'txt') {
    // 编辑器渲染的是 content；text 只存在于旧工程/卡片数据里。
    if (typeof el.content === 'string' || el.text === undefined) el.content = String(text);
    else el.text = String(text);
    return { id: el.id, type: el.type, text: el.content ?? el.text };
  }
  if (el.type === 'custom-code' && el.customCode) {
    el.customCode.html = String(text);
    el.customCode.version = (Number(el.customCode.version) || 0) + 1;
    el.customCode.updatedAt = new Date().toISOString();
    return { id: el.id, type: el.type, text: el.customCode.html };
  }
  throw new Error(`图层 ${layerId} 类型为 ${el.type}，不支持直接改文案（仅支持 txt / custom-code）`);
}

export function collectExternalRefs(project) {
  const urls = new Set();
  const visit = (ref) => {
    if (typeof ref === 'string' && /^https?:\/\//i.test(ref)) urls.add(ref);
  };
  visit(project.bgRef);
  for (const [, scene] of sceneEntries(project)) {
    visit(scene.bgRef);
    visit(scene.bgmRef);
    for (const el of scene.els || []) {
      visit(el.refId);
      for (const child of el.children || []) visit(child.refId);
    }
  }
  for (const asset of Object.values(project.assets || {})) {
    if (asset && typeof asset === 'object') visit(asset.url || asset.src);
  }
  return [...urls];
}

export function validate(project) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const scenes = sceneEntries(project);
  if (!scenes.length) errors.push('工程没有任何场景');
  if (!project.start) warnings.push('未设置 start（起始场景）');
  else if (!project.scenes[project.start]) errors.push(`start 指向不存在的场景：${project.start}`);

  for (const [sid, scene] of scenes) {
    if (!scene || typeof scene !== 'object') { errors.push(`场景 ${sid} 不是对象`); continue; }
    if (!(Number(scene.duration) > 0)) errors.push(`场景 ${sid} 的 duration 必须大于 0`);
    const els = scene.els || [];
    if (!Array.isArray(els)) { errors.push(`场景 ${sid} 的 els 不是数组`); continue; }
    for (const el of els) {
      if (!el || typeof el !== 'object') { errors.push(`场景 ${sid} 存在非法图层`); continue; }
      if (!el.id) errors.push(`场景 ${sid} 存在缺少 id 的图层`);
      else if (ids.has(el.id)) errors.push(`图层 id 重复：${el.id}`);
      else ids.add(el.id);
      if (!el.type) errors.push(`图层 ${el.id || '(无 id)'} 缺少 type`);
      for (const key of ['x', 'y', 'w', 'h']) {
        if (el[key] !== undefined && !Number.isFinite(Number(el[key]))) errors.push(`图层 ${el.id} 的 ${key} 不是数字`);
      }
      if (Number(el.w) <= 0 || Number(el.h) <= 0) warnings.push(`图层 ${el.id} 尺寸为 0，导出后不可见`);
      if (Number(el.x) < 0 || Number(el.y) < 0 || Number(el.x) + Number(el.w) > 100.5 || Number(el.y) + Number(el.h) > 100.5) {
        warnings.push(`图层 ${el.id} 超出画布范围（${el.x}, ${el.y}, ${el.w}, ${el.h}）`);
      }
      if (MEDIA_TYPES.has(el.type) && !el.refId) errors.push(`媒体图层 ${el.id} 缺少 refId`);
      if (el.type === 'txt' && typeof el.content !== 'string' && typeof el.text !== 'string') {
        warnings.push(`文本图层 ${el.id} 没有内容字段（content/text）`);
      }
      if (el.customCode && (String(el.customCode.html || '').length > 100000 || String(el.customCode.js || '').length > 100000)) {
        errors.push(`图层 ${el.id} 的自定义代码超出 100000 字符上限`);
      }
    }
  }
  const external = collectExternalRefs(project);
  if (external.length) warnings.push(`存在 ${external.length} 个外链资源，单文件 HTML 离线导出会失败`);
  return { ok: errors.length === 0, errors, warnings, externalResources: external };
}

export function renameScene(project, { sceneId, alias }) {
  const scene = project.scenes[sceneId];
  if (!scene) throw new Error(`未找到场景 ${sceneId}`);
  scene.alias = String(alias);
  return { id: sceneId, alias: scene.alias };
}

export function setDuration(project, { sceneId, seconds }) {
  const scene = project.scenes[sceneId];
  if (!scene) throw new Error(`未找到场景 ${sceneId}`);
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) throw new Error('时长必须是大于 0 的数字');
  scene.duration = value;
  return { id: sceneId, duration: scene.duration };
}
