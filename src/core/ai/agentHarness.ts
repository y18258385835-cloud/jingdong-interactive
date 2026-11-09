import type { AiSceneOperation, AiSceneProposal, ApplyAiSceneResult } from './sceneBuilder';

export type HarnessToolId =
  | 'workspace.inspect'
  | 'scene.create'
  | 'scene.update'
  | 'scene.configure'
  | 'scene.navigate'
  | 'layer.create'
  | 'layer.update'
  | 'layer.delete'
  | 'layer.reorder'
  | 'layer.group'
  | 'media.import'
  | 'media.transform'
  | 'shape.create'
  | 'pen.draw'
  | 'saber.create'
  | 'vfx.create'
  | 'ui.create'
  | 'chart.create'
  | 'three.create'
  | 'panorama.create'
  | 'timeline.animate'
  | 'interaction.bind'
  | 'data.mqtt.bind'
  | 'layout.audit'
  | 'project.export'
  | 'history.commit';

export type HarnessStepStatus = 'queued' | 'running' | 'succeeded' | 'skipped' | 'failed';

export interface HarnessToolDefinition {
  id: HarnessToolId;
  name: string;
  group: 'workspace' | 'scene' | 'layer' | 'media' | 'visual' | 'motion' | 'data' | 'audit' | 'project' | 'history';
  description: string;
  writesProject: boolean;
}

export interface HarnessStep {
  id: string;
  operationIndex: number;
  toolId: HarnessToolId;
  label: string;
  detail: string;
  status: HarnessStepStatus;
}

export interface HarnessRun {
  id: string;
  status: 'ready' | 'running' | 'succeeded' | 'partial' | 'failed';
  steps: HarnessStep[];
  createdAt: string;
  completedAt?: string;
}

export const HARNESS_TEMPLATE_CAPABILITY_GROUPS = [
  { id: 'workspace', label: '工程理解', tools: ['workspace.inspect', 'layout.audit'] as HarnessToolId[] },
  { id: 'scene', label: '场景编排', tools: ['scene.create', 'scene.update', 'scene.configure', 'scene.navigate'] as HarnessToolId[] },
  { id: 'layer', label: '图层编辑', tools: ['layer.create', 'layer.update', 'layer.delete', 'layer.reorder', 'layer.group'] as HarnessToolId[] },
  { id: 'visual', label: '视觉生成', tools: ['shape.create', 'pen.draw', 'saber.create', 'vfx.create', 'three.create', 'panorama.create'] as HarnessToolId[] },
  { id: 'motion', label: '动效交互', tools: ['timeline.animate', 'interaction.bind'] as HarnessToolId[] },
  { id: 'data', label: '数据组件', tools: ['ui.create', 'chart.create', 'data.mqtt.bind'] as HarnessToolId[] },
  { id: 'delivery', label: '交付记录', tools: ['project.export', 'history.commit'] as HarnessToolId[] },
] as const;

export const AETHER_HARNESS_TOOLS: HarnessToolDefinition[] = [
  { id: 'workspace.inspect', name: '读取工程', group: 'workspace', description: '读取当前场景、图层、素材和可用能力', writesProject: false },
  { id: 'scene.create', name: '创建场景', group: 'scene', description: '创建可编辑的 AETHER 场景容器', writesProject: true },
  { id: 'scene.update', name: '调整场景', group: 'scene', description: '修改场景时长、背景和转场属性', writesProject: true },
  { id: 'scene.configure', name: '设置场景', group: 'scene', description: '修改画布、场景设置和展示参数', writesProject: true },
  { id: 'scene.navigate', name: '切换场景', group: 'scene', description: '定位或调整场景顺序', writesProject: true },
  { id: 'layer.create', name: '创建图层', group: 'layer', description: '调用已有元素类型创建图层', writesProject: true },
  { id: 'layer.update', name: '修改图层', group: 'layer', description: '修改位置、尺寸、样式和属性', writesProject: true },
  { id: 'layer.delete', name: '删除图层', group: 'layer', description: '删除用户明确指定的图层', writesProject: true },
  { id: 'layer.reorder', name: '排列图层', group: 'layer', description: '调整层级、对齐和分组关系', writesProject: true },
  { id: 'layer.group', name: '组织图层', group: 'layer', description: '创建或拆分图层组', writesProject: true },
  { id: 'media.import', name: '导入素材', group: 'media', description: '使用工程已有或用户提供的图片、视频、音频素材', writesProject: true },
  { id: 'media.transform', name: '变换素材', group: 'media', description: '控制素材裁切、非等比缩放、旋转和透明度', writesProject: true },
  { id: 'shape.create', name: '生成形状', group: 'visual', description: '调用形状库或钢笔路径创建可编辑形状', writesProject: true },
  { id: 'pen.draw', name: '钢笔绘制', group: 'visual', description: '创建闭合自定义路径并生成 Shape 图层', writesProject: true },
  { id: 'saber.create', name: '生成 Saber', group: 'visual', description: '调用 Saber 预设、路径和光效参数', writesProject: true },
  { id: 'vfx.create', name: '生成 VFX', group: 'visual', description: '调用动效库和颜色主题生成视觉特效', writesProject: true },
  { id: 'ui.create', name: '生成 UI 组件', group: 'layer', description: '调用已安装 UI 组件和插件', writesProject: true },
  { id: 'chart.create', name: '生成图表', group: 'data', description: '创建图表并配置数据字段与展示样式', writesProject: true },
  { id: 'three.create', name: '调用 3D', group: 'visual', description: '调用 3D 模型、分层和高斯泼溅能力', writesProject: true },
  { id: 'panorama.create', name: '调用全景', group: 'visual', description: '调用全景图、全景视频和自动巡航参数', writesProject: true },
  { id: 'timeline.animate', name: '编排时间线', group: 'motion', description: '配置入场、出场、循环动效和时间段', writesProject: true },
  { id: 'interaction.bind', name: '绑定交互', group: 'motion', description: '绑定点击、热点、场景跳转和体感交互', writesProject: true },
  { id: 'data.mqtt.bind', name: '绑定 MQTT', group: 'data', description: '绑定已有 mqtt.realtime 样例数据', writesProject: true },
  { id: 'layout.audit', name: '审计布局', group: 'audit', description: '检查边界、重叠和视觉硬约束', writesProject: false },
  { id: 'project.export', name: '导出工程', group: 'project', description: '执行工程校验并导出 ZIP、HTML 或渲染结果', writesProject: false },
  { id: 'history.commit', name: '提交历史', group: 'history', description: '将已确认变更写入 AETHER 历史记录', writesProject: true },
];

export function getHarnessToolId(operation: AiSceneOperation): HarnessToolId {
  if (operation.kind === 'create-scene') return 'scene.create';
  if (operation.kind === 'update-scene') return 'scene.update';
  if (operation.kind === 'update-element') return 'layer.update';
  if (operation.kind === 'delete-element') return 'layer.delete';
  if (operation.kind === 'reorder-elements') return 'layer.reorder';
  if (operation.kind === 'bind-mqtt') return 'data.mqtt.bind';
  if (operation.element.link || operation.element.trigger || operation.element.interaction?.action && operation.element.interaction.action !== 'none') return 'interaction.bind';
  if (operation.element.type === 'ui-component') return 'ui.create';
  if (operation.element.type === 'chart') return 'chart.create';
  if (operation.element.type === 'shape') return 'shape.create';
  if (operation.element.type === 'saber') return 'saber.create';
  if (operation.element.type === 'vfx') return 'vfx.create';
  if (['img', 'vid'].includes(operation.element.type)) return 'media.import';
  if (['3d_group', 'model-3d', 'gaussian-splat'].includes(operation.element.type)) return 'three.create';
  if (['panorama-img', 'panorama-vid'].includes(operation.element.type)) return 'panorama.create';
  return 'layer.create';
}

function getDetail(operation: AiSceneOperation): string {
  if (operation.kind === 'create-scene') return operation.name;
  if (operation.kind === 'update-scene') return '场景属性与转场';
  if (operation.kind === 'update-element') return operation.elementId || `操作 ${operation.targetOperation ?? '-'}`;
  if (operation.kind === 'delete-element') return operation.elementId || `操作 ${operation.targetOperation ?? '-'}`;
  if (operation.kind === 'reorder-elements') return `${operation.elementIds.length} 个图层`;
  if (operation.kind === 'bind-mqtt') return operation.pluginId || 'mqtt.realtime';
  return operation.element.name || operation.element.sourceName || operation.element.type;
}

export function getHarnessTool(toolId: HarnessToolId) {
  return AETHER_HARNESS_TOOLS.find((tool) => tool.id === toolId)
    || AETHER_HARNESS_TOOLS.find((tool) => tool.id === 'layer.create')!;
}

export function createHarnessRun(proposal: AiSceneProposal): HarnessRun {
  return {
    id: `harness_${Date.now()}`,
    status: 'ready',
    createdAt: new Date().toISOString(),
    steps: [
      ...proposal.operations.map((operation, operationIndex): HarnessStep => {
        const toolId = getHarnessToolId(operation);
        return {
          id: `step_${operationIndex}_${toolId}`,
          operationIndex,
          toolId,
          label: getHarnessTool(toolId).name,
          detail: getDetail(operation),
          status: 'queued',
        };
      }),
      { id: 'step_layout_audit', operationIndex: -1, toolId: 'layout.audit', label: '审计布局', detail: '边界、重叠、视觉约束', status: 'queued' },
      { id: 'step_history_commit', operationIndex: -1, toolId: 'history.commit', label: '提交历史', detail: '等待用户确认', status: 'queued' },
    ],
  };
}

export function markHarnessExecution(run: HarnessRun, result: ApplyAiSceneResult | void): HarnessRun {
  const skipped = new Set(result && result.skippedOperationIndexes ? result.skippedOperationIndexes : []);
  const steps = run.steps.map((step) => {
    if (step.toolId === 'layout.audit') return { ...step, status: 'succeeded' as const };
    if (step.toolId === 'history.commit') return { ...step, status: result && result.appliedOperationCount > 0 ? 'succeeded' as const : 'failed' as const, detail: result && result.appliedOperationCount > 0 ? '已写入历史栈' : '没有可提交的变更' };
    if (step.operationIndex < 0) return step;
    return { ...step, status: skipped.has(step.operationIndex) ? 'skipped' as const : 'succeeded' as const };
  });
  const hasSkipped = steps.some((step) => step.status === 'skipped');
  const hasFailed = steps.some((step) => step.status === 'failed');
  return { ...run, status: hasFailed ? 'failed' : hasSkipped ? 'partial' : 'succeeded', steps, completedAt: new Date().toISOString() };
}

export function markHarnessRunning(run: HarnessRun): HarnessRun {
  return { ...run, status: 'running', steps: run.steps.map((step) => step.status === 'queued' ? { ...step, status: 'running' } : step) };
}
