import { describe, expect, it } from 'vitest';
import { buildPluginAiMessages, parsePluginAiResponse } from '../server/plugin-ai-contract.js';

describe('plugin AI contract', () => {
  it('accepts only safe metadata and MQTT field paths from a model response', () => {
    const result = parsePluginAiResponse(JSON.stringify({ name: '冷却回路压力', description: '监控压力与异常状态', dataContract: 'cooling.pressure.v1', tags: ['冷却', '压力'], telemetry: { value: 'metrics.pressurePercent', unit: 'metrics.pressureUnit', status: 'status', ignored: 'https://example.com' } }), 'gauge');
    expect(result).toMatchObject({ name: '冷却回路压力', telemetry: { value: 'metrics.pressurePercent', status: 'status' } });
    expect(result.telemetry).not.toHaveProperty('ignored');
  });
  it('rejects code and an unsupported component type', () => {
    expect(() => parsePluginAiResponse('export default () => {}', 'gauge')).toThrow();
    expect(() => buildPluginAiMessages({ prompt: '状态卡', styleName: '控制室', componentType: 'script' })).toThrow();
  });
});
