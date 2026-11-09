import { describe, it, expect } from 'vitest';
import {
  buildSmartCustomCodeControls,
  mergeAiControlNaming,
} from '../src/utils/customCodeSmartControls';
import type { CustomCodeControl } from '../src/types';

const STATS_TABLE_HTML = `
<table class="stats-table">
  <thead>
    <tr><th>姓名</th><th>部门</th><th>绩效</th></tr>
  </thead>
  <tbody>
    <tr><td>陈晓</td><td>产品部</td><td class="value">98.6%</td></tr>
    <tr><td>李明</td><td>研发部</td><td class="value">94.2%</td></tr>
  </tbody>
</table>`;

const STATS_TABLE_CSS = `
.stats-table {
  width: 100%;
  border-collapse: collapse;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  border-radius: 12px;
}
.stats-table th {
  color: #94a3b8;
  font-size: 11px;
}
.stats-table .value {
  color: #38bdf8;
  font-size: 14px;
}`;

describe('customCodeSmartControls', () => {
  it('identifies real table headers, values, colors, font sizes and radius', () => {
    const result = buildSmartCustomCodeControls({ html: STATS_TABLE_HTML, css: STATS_TABLE_CSS, js: '' });

    const textControls = result.controls.filter((control) => control.key.startsWith('text-'));
    expect(textControls).toHaveLength(9);
    expect(textControls.map((control) => control.default)).toEqual([
      '姓名', '部门', '绩效',
      '陈晓', '产品部', '98.6%',
      '李明', '研发部', '94.2%',
    ]);
    expect(textControls[0].label).toBe('表头 · 姓名');
    expect(textControls[5].label).toBe('数值 · 98.6%');
    expect(textControls[0].group).toBe('表格内容');

    const colorControls = result.controls.filter((control) => /^ctl-color-\d+$/.test(control.key));
    expect(colorControls.map((control) => control.default)).toEqual(['#0f172a', '#e2e8f0', '#94a3b8', '#38bdf8']);
    expect(colorControls.every((control) => control.type === 'color')).toBe(true);
    expect(colorControls.some((control) => control.label.includes('背景'))).toBe(true);
    expect(colorControls.some((control) => control.label.includes('文字'))).toBe(true);

    const fontControls = result.controls.filter((control) => /^ctl-font-\d+$/.test(control.key));
    expect(fontControls.map((control) => control.default).sort((a, b) => a - b)).toEqual([11, 12, 14]);
    expect(fontControls.every((control) => control.type === 'slider' && control.unit === 'px')).toBe(true);

    const radiusControl = result.controls.find((control) => control.key === 'ctl-radius-1');
    expect(radiusControl).toMatchObject({ type: 'slider', default: 12, unit: 'px' });

    // HTML 文本叶子拿到与运行时一致的 key，而不是只在面板里“假调节”。
    for (let index = 0; index < 9; index += 1) {
      expect(result.html).toContain(`data-aether-text-key="text-${index}"`);
    }
    // CSS 字面量真正被替换成可下发的变量，并保留原值兜底。
    expect(result.css).toContain('background: var(--ctl-color-1, #0f172a)');
    expect(result.css).toContain('color: var(--ctl-color-2, #e2e8f0)');
    expect(result.css).toContain('font-size: calc(var(--ctl-font-');
    expect(result.css).toContain('border-radius: calc(var(--ctl-radius-1, 12) * 1px)');
    expect(result.css).not.toContain('background: #0f172a');

    const keys = result.controls.map((control) => control.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never reuses an existing text key when assigning new ones', () => {
    const result = buildSmartCustomCodeControls({
      html: '<div><span>第一项</span><span data-aether-text-key="text-0">已有项</span></div>',
      css: '',
      js: '',
    });
    const textControls = result.controls.filter((control) => control.key.startsWith('text-'));
    expect(textControls.map((control) => control.key)).toEqual(['text-1', 'text-0']);
    expect(textControls.map((control) => control.default)).toEqual(['第一项', '已有项']);
    expect(result.html).toContain('data-aether-text-key="text-1">第一项');
    expect(result.html.match(/data-aether-text-key="text-0"/g)).toHaveLength(1);
  });

  it('continues numbering when new CSS literals are added later', () => {
    const first = buildSmartCustomCodeControls({ html: STATS_TABLE_HTML, css: STATS_TABLE_CSS, js: '' });
    const second = buildSmartCustomCodeControls(
      { html: first.html, css: `${first.css}\n.stats-table tfoot { background: #222222; }`, js: '' },
      first.controls,
    );
    const added = second.controls.find((control) => control.default === '#222222');
    expect(added?.key).toBe('ctl-color-5');
    expect(second.css).toContain('var(--ctl-color-5, #222222)');
    expect(second.controls.filter((control) => control.key.startsWith('ctl-color-')).length).toBe(5);
  });

  it('is idempotent and keeps user/AI renamed labels when re-run', () => {
    const first = buildSmartCustomCodeControls({ html: STATS_TABLE_HTML, css: STATS_TABLE_CSS, js: '' });
    const renamed: CustomCodeControl[] = first.controls.map((control) =>
      control.key === 'ctl-color-1' ? { ...control, label: '表格背景', group: '我的配色' } : control,
    );

    const second = buildSmartCustomCodeControls(
      { html: first.html, css: first.css, js: '' },
      renamed,
    );

    expect(second.controls).toHaveLength(first.controls.length);
    expect(second.controls.find((control) => control.key === 'ctl-color-1')).toMatchObject({
      label: '表格背景',
      group: '我的配色',
    });
    expect(second.css).toBe(first.css);
    expect((second.css.match(/var\(--ctl-font-/g) || [])).toHaveLength(
      (first.css.match(/var\(--ctl-font-/g) || []).length,
    );
    expect(second.html).toBe(first.html);
  });
});

describe('mergeAiControlNaming', () => {
  const base: CustomCodeControl[] = [
    { key: 'text-0', label: '表头 · 姓名', type: 'text', default: '姓名', group: '表格内容' },
    { key: 'text-5', label: '数值 · 98.6%', type: 'text', default: '98.6%', group: '表格内容' },
    { key: 'ctl-color-1', label: '背景颜色 1', type: 'color', default: '#0f172a', group: '表格配色' },
  ];

  it('only renames keys that exist in the local plan', () => {
    const merged = mergeAiControlNaming(base, [
      { key: 'text-0', label: '员工姓名', group: '表格内容' },
      { key: 'text-5', label: '绩效数值', group: '表格内容' },
      { key: 'speed', label: '动画速度', group: '动画参数' },
      { key: 'ctl-color-1', label: '表格背景' },
    ]);

    expect(merged).toHaveLength(3);
    expect(merged.map((control) => control.key)).toEqual(['text-0', 'text-5', 'ctl-color-1']);
    expect(merged[0].label).toBe('员工姓名');
    expect(merged[1].label).toBe('绩效数值');
    expect(merged[2].label).toBe('表格背景');
    expect(merged[2].group).toBe('表格配色');
    expect(merged.some((control) => control.key === 'speed')).toBe(false);
  });

  it('keeps local labels when AI returns nothing usable', () => {
    expect(mergeAiControlNaming(base, [])).toBe(base);
    expect(mergeAiControlNaming(base, null)).toBe(base);
    expect(mergeAiControlNaming(base, [{ key: 'unknown', label: '伪参数' }])).toEqual(base);
  });
});
