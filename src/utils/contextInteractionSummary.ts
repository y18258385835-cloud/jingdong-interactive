import type { InteractionConfig } from './interactionModel';

type SceneTarget = { alias?: string };

export interface ContextInteractionSummary {
  text: string;
  tone: 'neutral' | 'active' | 'warning';
}

const triggerLabels: Record<InteractionConfig['trigger'], string> = {
  click: '点击',
  hover: '悬停',
  'long-press': '长按',
  'swipe-direction': '滑动',
};

const actionLabels: Record<InteractionConfig['action'], string> = {
  none: '未设置',
  jump: '跳转场景',
  popup: '打开弹窗',
  url: '打开网页',
  media: '打开媒体',
  'set-variable': '设置变量',
};

export function getContextInteractionSummary(
  interaction: InteractionConfig | undefined,
  scenes: Record<string, SceneTarget>,
): ContextInteractionSummary {
  if (!interaction || interaction.action === 'none') {
    return { text: '当前交互：未设置', tone: 'neutral' };
  }

  const trigger = triggerLabels[interaction.trigger] || '点击';
  const action = actionLabels[interaction.action];
  if (interaction.action === 'jump' || interaction.action === 'popup') {
    if (!interaction.target) {
      return { text: `当前交互：${trigger} -> ${action}（未选择目标）`, tone: 'warning' };
    }
    const targetScene = scenes[interaction.target];
    if (!targetScene) {
      return { text: `当前交互：目标场景已删除：${interaction.target}`, tone: 'warning' };
    }
    return { text: `当前交互：${trigger} -> ${action}：${targetScene.alias || interaction.target}`, tone: 'active' };
  }

  return { text: `当前交互：${trigger} -> ${action}`, tone: 'active' };
}
