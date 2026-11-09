import { describe, expect, it } from 'vitest';
import { GALAXY_COMPONENT_BASE_SIZE, GALAXY_COMPONENT_LIST, getUiComponentAspect } from '../src/components/ui/GalaxyComponents';

describe('内置仪表盘组件注册', () => {
  it('注册动态数据看板并保留独立尺寸', () => {
    const component = GALAXY_COMPONENT_LIST.find((item) => item.type === 'pattern-prediction-chart');
    expect(component).toMatchObject({
      type: 'pattern-prediction-chart',
      name: '规律预判 - 动态数据看板',
      category: '数据大屏',
    });
    expect(GALAXY_COMPONENT_BASE_SIZE['pattern-prediction-chart']).toEqual({ w: 1000, h: 560 });
    expect(getUiComponentAspect(undefined, 'pattern-prediction-chart')).toBeCloseTo(1000 / 560, 6);
  });

  it('批量注册新增图形图表仪表盘组件并保留独立尺寸', () => {
    const expected = [
      ['data-trend-chart', '数据趋势', { w: 1000, h: 500 }],
      ['data-trend-cyber-chart', '数据趋势 · 科幻图表', { w: 1100, h: 520 }],
      ['data-trend-area-chart', '数据趋势 · 面积图', { w: 1100, h: 520 }],
      ['data-trend-dual-area-chart', '数据趋势 · 双曲线面积图', { w: 1100, h: 520 }],
      ['cyber-bubble-chart', '数据趋势 · 赛博发光气泡图', { w: 780, h: 825 }],
      ['cyber-ring-chart', '数据趋势 · 赛博发光圆环图', { w: 780, h: 825 }],
      ['cyber-multi-ring-chart', '数据趋势 · 赛博发光圆环图（多环版本）', { w: 780, h: 860 }],
      ['cyber-hud-gauge', '数据趋势 · 赛博 HUD 仪表盘', { w: 600, h: 640 }],
      ['cyber-radar-chart', '数据趋势 · 赛博雷达图', { w: 900, h: 560 }],
      ['cyber-3d-donut-chart', '数据趋势 · 赛博3D环形图', { w: 880, h: 540 }],
      ['distribution-stat-chart', '数据分布统计', { w: 880, h: 550 }],
      ['pyramid-distribution-chart', '3D 金字塔分布图', { w: 880, h: 550 }],
    ] as const;

    for (const [type, name, size] of expected) {
      expect(GALAXY_COMPONENT_LIST).toContainEqual({ type, name, category: '数据大屏' });
      expect(GALAXY_COMPONENT_BASE_SIZE[type]).toEqual(size);
      expect(getUiComponentAspect(undefined, type)).toBeCloseTo(size.w / size.h, 6);
    }
  });
});
