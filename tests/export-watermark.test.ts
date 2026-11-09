import { describe, it, expect } from 'vitest';
import { buildExportWatermarkMarkup } from '../src/utils/exportWatermark';
import { generateStandaloneHTML } from '../src/utils/export';

describe('导出水印', () => {
  it('未开启时不输出任何标记', () => {
    expect(buildExportWatermarkMarkup()).toBe('');
    expect(buildExportWatermarkMarkup({ enabled: false })).toBe('');
  });

  it('开启后输出固定的水印节点', () => {
    const markup = buildExportWatermarkMarkup({ enabled: true });
    expect(markup).toContain('id="aether-watermark"');
    expect(markup).toContain('data-aether-watermark="1"');
    expect(markup).toContain('鲸动交互平台');
  });

  it('转义自定义文案，并限制透明度范围', () => {
    const markup = buildExportWatermarkMarkup({ enabled: true, text: '<img src=x onerror=alert(1)>', opacity: 5 });
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img');
    expect(markup).toContain('rgba(255,255,255,1)');
  });

  it('单文件 HTML 导出会写入水印节点', () => {
    const project = {
      meta: { v: 43, title: '水印测试' },
      start: 's1',
      canvasSize: { width: 1920, height: 1080 },
      scenes: {
        s1: { id: 's1', alias: '场景', type: 'scene', duration: 5, els: [] },
      },
    } as any;
    const withWatermark = generateStandaloneHTML(project, { watermark: { enabled: true } });
    expect(withWatermark).toContain('id="aether-watermark"');
    const withoutWatermark = generateStandaloneHTML(project, { watermark: { enabled: false } });
    expect(withoutWatermark).not.toContain('id="aether-watermark"');
  });
});
