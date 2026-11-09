import { describe, expect, it } from 'vitest';
import { getContextInteractionSummary } from '../src/utils/contextInteractionSummary';

const scenes = {
  scene_2: { alias: '产品介绍' },
};

describe('context interaction summary', () => {
  it('shows the resolved scene name for a scene jump', () => {
    expect(getContextInteractionSummary({
      trigger: 'click', action: 'jump', target: 'scene_2', hoverDelay: 0.3,
    }, scenes)).toEqual({
      text: '当前交互：点击 -> 跳转场景：产品介绍', tone: 'active',
    });
  });

  it('warns when an interaction points to a deleted scene', () => {
    expect(getContextInteractionSummary({
      trigger: 'hover', action: 'popup', target: 'removed_scene', hoverDelay: 0.3,
    }, scenes)).toEqual({
      text: '当前交互：目标场景已删除：removed_scene', tone: 'warning',
    });
  });

  it('reports an unset interaction', () => {
    expect(getContextInteractionSummary({
      trigger: 'click', action: 'none', hoverDelay: 0.3,
    }, scenes)).toEqual({
      text: '当前交互：未设置', tone: 'neutral',
    });
  });
});
