import { describe, it, expect } from 'vitest';
import { extractControlsFromCode, extractPluginControls, resolveControlValues, buildCssVariablesFromProps } from '../src/utils/customCodeControls';

describe('customCodeControls parser and resolver', () => {
  it('extracts controls from single-line comment annotations', () => {
    const code = `
      // @control slider key=speed label="旋转速度" min=0.1 max=10 step=0.1 default=1 unit="x"
      // @control color key=glowColor label="光效颜色" default="#00ffcc"
      // @control toggle key=enablePhysics label="开启重力碰撞" default=true
      // @control select key=waveType label="波形类型" options="正弦:sine,余弦:cosine,方波:square" default="sine"
      // @control number key=particleCount label="粒子总数" min=10 max=5000 step=10 default=500
      // @control text key=screenTitle label="大屏标题" default="实时工况监控"
      const x = 100;
    `;

    const controls = extractControlsFromCode(code);
    expect(controls).toHaveLength(6);

    expect(controls[0]).toEqual({
      key: 'speed',
      label: '旋转速度',
      type: 'slider',
      default: 1,
      min: 0.1,
      max: 10,
      step: 0.1,
      unit: 'x',
      group: undefined,
    });

    expect(controls[1]).toEqual({
      key: 'glowColor',
      label: '光效颜色',
      type: 'color',
      default: '#00ffcc',
      group: undefined,
      unit: undefined,
    });

    expect(controls[2]).toEqual({
      key: 'enablePhysics',
      label: '开启重力碰撞',
      type: 'toggle',
      default: true,
      group: undefined,
      unit: undefined,
    });

    expect(controls[3].type).toBe('select');
    expect(controls[3].options).toEqual([
      { label: '正弦', value: 'sine' },
      { label: '余弦', value: 'cosine' },
      { label: '方波', value: 'square' },
    ]);

    expect(controls[4].type).toBe('number');
    expect(controls[4].default).toBe(500);

    expect(controls[5].type).toBe('text');
    expect(controls[5].default).toBe('实时工况监控');
  });

  it('extracts controls from block @schema JSON comments', () => {
    const code = `
      /* @schema
      {
        "controls": [
          { "key": "zoom", "label": "缩放比例", "type": "slider", "min": 1, "max": 5, "default": 2 },
          { "key": "theme", "label": "主题", "type": "select", "options": ["dark", "light"], "default": "dark" }
        ]
      }
      */
      console.log('running');
    `;

    const controls = extractControlsFromCode(code);
    expect(controls).toHaveLength(2);
    expect(controls[0].key).toBe('zoom');
    expect(controls[0].default).toBe(2);
    expect(controls[1].key).toBe('theme');
  });

  it('resolves control values with defaults and overrides', () => {
    const controls = [
      { key: 'speed', label: 'Speed', type: 'slider' as const, default: 1 },
      { key: 'color', label: 'Color', type: 'color' as const, default: '#fff' },
    ];

    const values = resolveControlValues(controls, { speed: 3.5 });
    expect(values).toEqual({
      speed: 3.5,
      color: '#fff',
    });
  });

  it('generates valid CSS custom properties from props', () => {
    const props = {
      speed: 2.5,
      glowColor: '#00e5ff',
    };
    const cssVars = buildCssVariablesFromProps(props);
    expect(cssVars).toContain('--aether-speed: 2.5;');
    expect(cssVars).toContain('--aether-glowColor: #00e5ff;');
  });

  it('handles empty code and graceful fallback in plugin control extraction', () => {
    const emptyResult = extractPluginControls({});
    expect(emptyResult).toEqual([]);

    const partialPlugin = {
      html: '<div>Hello</div>',
      css: '/* @control slider key=size label="大小" min=10 max=100 default=20 */',
      js: '',
    };
    const found = extractPluginControls(partialPlugin);
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe('size');
    expect(found[0].default).toBe(20);
  });

  it('correctly handles boolean toggles and default value fallbacks', () => {
    const controls = [
      { key: 'enableParticle', label: '开启粒子', type: 'toggle' as const, default: true },
      { key: 'blurAmount', label: '模糊度', type: 'number' as const, default: 8 },
    ];
    const resolved = resolveControlValues(controls, { enableParticle: false });
    expect(resolved.enableParticle).toBe(false);
    expect(resolved.blurAmount).toBe(8);
  });

  it('automatically identifies standard CSS custom properties without annotations', () => {
    const css = `
      :host {
        --color: #38bdf8;
        --speed: 1.5s;
        --glow: 80%;
      }
    `;
    const found = extractControlsFromCode(css);
    expect(found).toHaveLength(3);

    const colorCtrl = found.find((c) => c.key === 'color');
    expect(colorCtrl).toBeDefined();
    expect(colorCtrl?.type).toBe('color');
    expect(colorCtrl?.default).toBe('#38bdf8');
    expect(colorCtrl?.label).toBe('主题色彩');

    const speedCtrl = found.find((c) => c.key === 'speed');
    expect(speedCtrl).toBeDefined();
    expect(speedCtrl?.type).toBe('slider');
    expect(speedCtrl?.default).toBe(1.5);
    expect(speedCtrl?.unit).toBe('s');
    expect(speedCtrl?.label).toBe('动效速度');

    const glowCtrl = found.find((c) => c.key === 'glow');
    expect(glowCtrl).toBeDefined();
    expect(glowCtrl?.type).toBe('slider');
    expect(glowCtrl?.default).toBe(80);
    expect(glowCtrl?.unit).toBe('%');
    expect(glowCtrl?.label).toBe('辉光强度');
  });
});
