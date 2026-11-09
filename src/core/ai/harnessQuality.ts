import type { ProjectData } from '../../types';
import type { AiSceneOperation, AiSceneProposal } from './sceneBuilder';
import { getHarnessToolId, type HarnessToolId } from './agentHarness';

export interface HarnessImpactItem {
  area: 'scene' | 'layers' | 'data' | 'motion' | 'assets' | 'history';
  action: 'add' | 'modify' | 'remove' | 'review';
  target: string;
  detail: string;
}

export interface HarnessImpactReport {
  summary: string;
  items: HarnessImpactItem[];
  affectedSceneIds: string[];
  affectedElementIds: string[];
}

export interface HarnessQualityDimension {
  key: 'aesthetic' | 'hierarchy' | 'density' | 'overlap' | 'bounds' | 'authenticity' | 'editability' | 'coverage';
  label: string;
  score: number;
  note: string;
}

export interface HarnessQualityReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  dimensions: HarnessQualityDimension[];
  blocking: boolean;
  usedTools: string[];
  uncoveredCapabilities: string[];
}

function operationTarget(operation: AiSceneOperation, index: number) {
  if (operation.kind === 'create-scene') return operation.name;
  if (operation.kind === 'create-element') return operation.element.name || operation.element.sourceName || operation.element.type;
  if (operation.kind === 'bind-mqtt') return operation.targetElementId || operation.pluginId || `operation ${index + 1}`;
  if (operation.kind === 'update-element' || operation.kind === 'delete-element') return operation.elementId || `operation ${index + 1}`;
  return operation.kind;
}

function sceneLabel(sceneId: string | undefined, project: ProjectData, activeSceneId: string) {
  if (!sceneId || sceneId === 'new-scene') return '新建场景';
  if (sceneId === 'active-scene' || sceneId === 'current-scene') return project.scenes[activeSceneId]?.alias || '当前场景';
  return project.scenes[sceneId]?.alias || sceneId;
}

export function analyzeHarnessImpact(proposal: Pick<AiSceneProposal, 'operations'>, project: ProjectData, activeSceneId: string): HarnessImpactReport {
  const items: HarnessImpactItem[] = [];
  const affectedScenes = new Set<string>();
  const affectedElements = new Set<string>();
  proposal.operations.forEach((operation, index) => {
    const scene = sceneLabel(operation.sceneId, project, activeSceneId);
    if (operation.kind === 'create-scene') {
      affectedScenes.add(operation.sceneId || 'new-scene');
      items.push({ area: 'scene', action: 'add', target: operation.name, detail: `创建场景并设置 ${operation.duration || 12}s 时长` });
    } else if (operation.kind === 'create-element') {
      affectedScenes.add(operation.sceneId || activeSceneId);
      if (operation.element.id) affectedElements.add(operation.element.id);
      items.push({ area: operation.element.refId ? 'assets' : 'layers', action: 'add', target: operationTarget(operation, index), detail: `${scene} · ${operation.element.type}${operation.element.refId ? ' · 复用已有素材' : ' · 使用可编辑占位层'}` });
    } else if (operation.kind === 'update-element') {
      if (operation.elementId) affectedElements.add(operation.elementId);
      items.push({ area: 'layers', action: 'modify', target: operationTarget(operation, index), detail: `${scene} · 修改位置、尺寸或视觉属性` });
    } else if (operation.kind === 'delete-element') {
      if (operation.elementId) affectedElements.add(operation.elementId);
      items.push({ area: 'layers', action: 'remove', target: operationTarget(operation, index), detail: `${scene} · 删除前需确认目标图层` });
    } else if (operation.kind === 'bind-mqtt') {
      if (operation.targetElementId) affectedElements.add(operation.targetElementId);
      items.push({ area: 'data', action: 'modify', target: operation.pluginId || 'mqtt.realtime', detail: `${scene} · 更新 MQTT 样例字段映射与空状态` });
    } else if (operation.kind === 'reorder-elements') {
      operation.elementIds.forEach((id) => affectedElements.add(id));
      items.push({ area: 'layers', action: 'modify', target: `${operation.elementIds.length} 个图层`, detail: `${scene} · 调整层级顺序` });
    } else if (operation.kind === 'update-scene') {
      affectedScenes.add(operation.sceneId || activeSceneId);
      items.push({ area: 'scene', action: 'modify', target: scene, detail: '修改场景设置或转场参数' });
    }
    if (operation.kind === 'create-element' && (operation.element.animType || operation.element.loopAnim || operation.element.link)) {
      items.push({ area: 'motion', action: 'modify', target: operationTarget(operation, index), detail: '写入时间线动效或交互触发' });
    }
  });
  items.push({ area: 'history', action: 'review', target: 'AETHER 历史记录', detail: '用户确认后以一次可撤销变更提交' });
  return {
    summary: `预计影响 ${affectedScenes.size || 1} 个场景、${affectedElements.size || proposal.operations.filter((operation) => operation.kind === 'create-element').length} 个图层，并检查数据绑定与动效。`,
    items: items.slice(0, 32),
    affectedSceneIds: [...affectedScenes],
    affectedElementIds: [...affectedElements],
  };
}

function score(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

export function scoreHarnessProposal(proposal: AiSceneProposal, project: ProjectData, activeSceneId: string): HarnessQualityReport {
  const elements = proposal.operations.filter((operation) => operation.kind === 'create-element').map((operation) => operation.element);
  const visualErrors = proposal.layout.visualIssues.filter((issue) => issue.severity === 'error').length;
  const warnings = proposal.layout.visualIssues.filter((issue) => issue.severity === 'warning').length;
  const overlapCount = proposal.layout.overlaps.length;
  const media = elements.filter((element) => ['img', 'vid', 'model-3d', 'gaussian-splat', 'panorama-img', 'panorama-vid'].includes(element.type));
  const missingAssets = media.filter((element) => !element.refId).length;
  const usedTools = [...new Set(proposal.operations.map((operation) => getHarnessToolId(operation)))];
  const allCapabilityTools: HarnessToolId[] = ['scene.create', 'layer.create', 'shape.create', 'pen.draw', 'saber.create', 'vfx.create', 'ui.create', 'chart.create', 'three.create', 'panorama.create', 'timeline.animate', 'interaction.bind', 'data.mqtt.bind', 'layout.audit', 'history.commit'];
  const relevant = allCapabilityTools.filter((tool) => {
    if (tool === 'layout.audit' || tool === 'history.commit') return true;
    if (tool === 'scene.create') return proposal.operations.some((operation) => operation.kind === 'create-scene');
    if (tool === 'layer.create') return elements.some((element) => !['shape', 'saber', 'vfx', 'ui-component', 'chart', '3d_group', 'model-3d', 'gaussian-splat', 'panorama-img', 'panorama-vid'].includes(element.type));
    if (tool === 'shape.create') return elements.some((element) => element.type === 'shape' && !element.shapePath);
    if (tool === 'pen.draw') return elements.some((element) => element.type === 'shape' && Boolean(element.shapePath));
    if (tool === 'saber.create') return elements.some((element) => element.type === 'saber');
    if (tool === 'vfx.create') return elements.some((element) => element.type === 'vfx');
    if (tool === 'ui.create') return elements.some((element) => element.type === 'ui-component');
    if (tool === 'chart.create') return elements.some((element) => element.type === 'chart');
    if (tool === 'three.create') return elements.some((element) => ['3d_group', 'model-3d', 'gaussian-splat'].includes(element.type));
    if (tool === 'panorama.create') return elements.some((element) => ['panorama-img', 'panorama-vid'].includes(element.type));
    if (tool === 'timeline.animate') return elements.some((element) => Boolean(element.animType || element.loopAnim));
    if (tool === 'interaction.bind') return elements.some((element) => Boolean(element.link || element.trigger || (element.interaction && element.interaction.action && element.interaction.action !== 'none')));
    if (tool === 'data.mqtt.bind') return proposal.operations.some((operation) => operation.kind === 'bind-mqtt');
    return false;
  });
  const uncoveredCapabilities = relevant.filter((tool) => !usedTools.includes(tool));
  const dimensions: HarnessQualityDimension[] = [
    { key: 'aesthetic', label: '审美', score: score(92 - visualErrors * 12 - warnings * 4), note: '基于视觉约束、色彩与效果层级' },
    { key: 'hierarchy', label: '层级', score: score((proposal.layout.visualIssues.some((issue) => issue.code === 'hierarchy') ? 62 : 94) - visualErrors * 4), note: '检查标题、主次信息和背景层' },
    { key: 'density', label: '密度', score: score(elements.length > 12 ? 55 : elements.length < 3 ? 68 : 94 - Math.max(0, elements.length - 9) * 3), note: `${elements.length} 个生成图层` },
    { key: 'overlap', label: '重叠', score: score(100 - overlapCount * 18), note: overlapCount ? `${overlapCount} 组候选重叠` : '未发现明显重叠' },
    { key: 'bounds', label: '边界', score: score(100 - proposal.layout.visualIssues.filter((issue) => issue.code === 'bounds').length * 24), note: '检查图层是否越界' },
    { key: 'authenticity', label: '素材真实性', score: score(media.length ? 100 - missingAssets * 28 : 100), note: missingAssets ? `${missingAssets} 个媒体层缺少已有素材引用` : '没有虚构外部素材' },
    { key: 'editability', label: '可编辑性', score: score(100 - proposal.operations.filter((operation) => operation.kind === 'create-element' && operation.element.type === 'group').length * 8), note: '结果使用 AETHER 原生图层与属性' },
    { key: 'coverage', label: '工具覆盖', score: score(relevant.length ? (relevant.length - uncoveredCapabilities.length) / relevant.length * 100 : 100), note: uncoveredCapabilities.length ? `本次未涉及 ${uncoveredCapabilities.length} 项相关能力` : '相关能力均已路由' },
  ];
  const total = score(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return { score: total, grade: total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 65 ? 'C' : 'D', dimensions, blocking: visualErrors > 0, usedTools, uncoveredCapabilities };
}
