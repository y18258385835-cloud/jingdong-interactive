/**
 * normalizeProjectData 单元测试（对应优化文档 §1.7 DoD）
 */
import { describe, it, expect } from 'vitest';
import { normalizeProjectData, isNormalizeOk } from '../../src/core/schema/normalize';
import { SCHEMA_VERSION } from '../../src/core/schema/version';
import { validateProjectData, isValidateOk } from '../../src/core/schema/validate';

function makeValidData(overrides: Record<string, unknown> = {}) {
  return {
    meta: { v: 1, title: '测试工程' },
    scenes: {
      home: {
        id: 'home',
        alias: '首页',
        type: 'scene',
        duration: 10,
        els: [
          {
            id: 'el1',
            type: 'txt',
            x: 10,
            y: 20,
            w: 50,
            h: 30,
            content: 'hi',
            startTime: 0,
            duration: 5,
            zIndex: 10,
            opacity: 100,
          },
        ],
      },
    },
    start: 'home',
    ...overrides,
  };
}

describe('normalizeProjectData', () => {
  it('空数据返回 E_VALIDATION', () => {
    expect(normalizeProjectData(null).ok).toBe(false);
    expect(normalizeProjectData(undefined).ok).toBe(false);
    const r = normalizeProjectData(null);
    if (!isNormalizeOk(r)) expect(r.error.code).toBe('E_VALIDATION');
  });

  it('非对象返回 E_VALIDATION', () => {
    for (const bad of [42, 'str', [], true]) {
      const r = normalizeProjectData(bad);
      expect(r.ok).toBe(false);
      if (!isNormalizeOk(r)) expect(r.error.code).toBe('E_VALIDATION');
    }
  });

  it('缺 schemaVersion 按旧版 42 迁移，补上 43 与 assets', () => {
    const r = normalizeProjectData(makeValidData());
    expect(r.ok).toBe(true);
    if (isNormalizeOk(r)) {
      expect(r.data.schemaVersion).toBe(SCHEMA_VERSION);
      expect(r.data.assets).toEqual({ version: 1, items: {} });
    }
  });

  it('合法 v43 数据原样通过', () => {
    const data = makeValidData({ schemaVersion: SCHEMA_VERSION });
    const r = normalizeProjectData(data);
    expect(r.ok).toBe(true);
    if (isNormalizeOk(r)) expect(r.data.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('marks unsafe custom code during normalization before any runtime mount', () => {
    const data = makeValidData({
      scenes: {
        home: {
          ...makeValidData().scenes.home,
          els: [{
            ...makeValidData().scenes.home.els[0],
            type: 'custom-code',
            customCode: {
              id: 'unsafe-plugin', version: 1, name: 'Unsafe', html: '<div>Demo</div>', css: '',
              js: 'fetch("https://example.com")',
              preview: { mode: 'responsive', background: 'transparent' },
              createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
            },
          }],
        },
      },
    });
    const result = normalizeProjectData(data);
    expect(result.ok).toBe(true);
    if (isNormalizeOk(result)) {
      expect(result.data.scenes.home.els[0].customCode?.diagnostics?.status).toBe('error');
      expect(result.warnings.some((warning) => warning.includes('安全检查'))).toBe(true);
    }
  });

  it('保留透明场景背景设置', () => {
    const data = makeValidData({
      scenes: {
        home: {
          ...makeValidData().scenes.home,
          backgroundType: 'transparent',
          bgColor: '#123456',
          bgRef: 'stored-background',
        },
      },
    });
    const result = normalizeProjectData(data);
    expect(result.ok).toBe(true);
    if (isNormalizeOk(result)) {
      expect(result.data.scenes.home.backgroundType).toBe('transparent');
      expect(result.data.scenes.home.bgRef).toBe('stored-background');
    }
  });

  it('循环交互特效及其参数可以保存', () => {
    const data = makeValidData({
      scenes: {
        home: {
          ...makeValidData().scenes.home,
          els: [{
            ...makeValidData().scenes.home.els[0],
            interactionEffect: 'loop-pulse',
            interactionEffectTrigger: 'hover',
            interactionEffectDuration: 900,
            interactionEffectIntensity: 75,
          }],
        },
      },
    });
    const r = normalizeProjectData(data);
    expect(r.ok).toBe(true);
    if (isNormalizeOk(r)) {
      const element = r.data.scenes.home.els[0];
      expect(element.interactionEffect).toBe('loop-pulse');
      expect(element.interactionEffectTrigger).toBe('hover');
      expect(element.interactionEffectDuration).toBe(900);
      expect(element.interactionEffectIntensity).toBe(75);
    }
  });

  it('保留透明交互区域及其点击跳转设置', () => {
    const data = makeValidData({
      scenes: {
        home: {
          ...makeValidData().scenes.home,
          els: [{
            ...makeValidData().scenes.home.els[0],
            type: 'shape',
            interactionArea: true,
            shapeKind: 'custom-path',
            shapePath: 'M 10 10 L 90 10 L 50 90 Z',
            interaction: { trigger: 'click', action: 'jump', target: 'home' },
          }],
        },
      },
    });
    const result = normalizeProjectData(data);
    expect(result.ok).toBe(true);
    if (isNormalizeOk(result)) {
      expect(result.data.scenes.home.els[0]).toMatchObject({
        interactionArea: true,
        shapePath: 'M 10 10 L 90 10 L 50 90 Z',
        interaction: { trigger: 'click', action: 'jump', target: 'home' },
      });
    }
  });

  it('多段滑动 UI 组件及节点弹窗配置可以保存', () => {
    const data = makeValidData({
      scenes: {
        home: {
          ...makeValidData().scenes.home,
          els: [{
            ...makeValidData().scenes.home.els[0],
            type: 'ui-component',
            uiComponentType: 'multi-stage-slider',
            uiComponentData: {
              continuousInteraction: {
                mode: 'sequence',
                nodes: [
                  { id: 'start', position: 0, role: 'start' },
                  {
                    id: 'detail',
                    position: 100,
                    role: 'end',
                    interaction: { action: 'popup', target: 'home' },
                    popup: { popupX: 83, popupY: 54, popupWidth: 28, popupHeight: 20 },
                  },
                ],
              },
            },
          }],
        },
      },
    });

    const result = normalizeProjectData(data);
    expect(result.ok).toBe(true);
    if (isNormalizeOk(result)) {
      expect(result.data.scenes.home.els[0].uiComponentData.continuousInteraction.nodes[1].popup).toMatchObject({
        popupX: 83,
        popupY: 54,
        popupWidth: 28,
        popupHeight: 20,
      });
    }
  });

  it('版本超前返回 E_SCHEMA_NEWER', () => {
    const r = normalizeProjectData(makeValidData({ schemaVersion: SCHEMA_VERSION + 1 }));
    expect(r.ok).toBe(false);
    if (!isNormalizeOk(r)) expect(r.error.code).toBe('E_SCHEMA_NEWER');
  });

  it('越界数值被温和修复并记录 warning', () => {
    const r = normalizeProjectData(
      makeValidData({
        schemaVersion: 42,
        scenes: {
          home: {
            id: 'home',
            alias: '首页',
            type: 'scene',
            duration: 10,
            els: [
              {
                id: 'el1',
                type: 'txt',
                x: 150, // 越界
                y: -5, // 越界
                w: 50,
                h: 30,
                startTime: 0,
                duration: 5,
                zIndex: 10,
                opacity: 100,
              },
            ],
          },
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (isNormalizeOk(r)) {
      expect(r.data.scenes.home.els[0].x).toBe(100);
      expect(r.data.scenes.home.els[0].y).toBe(0);
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });

  it('start 指向缺失场景被修正为第一个场景', () => {
    const r = normalizeProjectData(makeValidData({ start: 'nope' }));
    expect(r.ok).toBe(true);
    if (isNormalizeOk(r)) expect(r.data.start).toBe('home');
  });

  it('非法枚举类型返回 E_VALIDATION', () => {
    const bad = makeValidData({
      scenes: {
        home: {
          id: 'home',
          alias: '首页',
          type: 'scene',
          duration: 10,
          els: [{ id: 'el1', type: 'not-a-type', x: 10, y: 10, w: 10, h: 10, startTime: 0, duration: 1, zIndex: 1, opacity: 100 }],
        },
      },
    });
    const r = normalizeProjectData(bad);
    expect(r.ok).toBe(false);
    if (!isNormalizeOk(r)) expect(r.error.code).toBe('E_VALIDATION');
  });

  it('空 scenes 返回 E_VALIDATION', () => {
    const r = normalizeProjectData({ meta: {}, scenes: {}, start: 'x' });
    expect(r.ok).toBe(false);
    if (!isNormalizeOk(r)) expect(r.error.code).toBe('E_VALIDATION');
  });

  it('validateProjectData 报告带路径的 issue', () => {
    const bad = makeValidData({
      scenes: {
        home: {
          id: 'home',
          alias: '首页',
          type: 'scene',
          duration: 10,
          els: [{ id: 'el1', type: 'txt', x: 10, y: 10, w: 'wide', h: 10, startTime: 0, duration: 1, zIndex: 1, opacity: 100 }],
        },
      },
    });
    const v = validateProjectData(bad);
    expect(v.ok).toBe(false);
    if (!isValidateOk(v)) {
      const hit = v.issues.find((i) => i.path.includes('w'));
      expect(hit).toBeDefined();
    }
  });

  it('接受官方模板使用的全部入场动效（schema 枚举需与 InAnimType 同步）', () => {
    const anims = ['neon-glow-in', 'scan-reveal', 'hologram-in', 'stardust-in', 'energy-pop', 'perspective-in'];
    for (const animType of anims) {
      const data = makeValidData();
      (data.scenes.home.els[0] as Record<string, unknown>).animType = animType;
      const result = normalizeProjectData({ ...data, schemaVersion: SCHEMA_VERSION });
      expect(result.ok, `animType=${animType}`).toBe(true);
    }
  });
});
