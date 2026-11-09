import { describe, expect, it } from 'vitest';
import { createAiPlugin, validatePluginDefinition, withRealtimeBinding } from '../src/plugins/pluginStudio';

describe('plugin studio contracts', () => {
  it('generates a safe MQTT-bound plugin definition', () => {
    const plugin = withRealtimeBinding(createAiPlugin('产线能耗', 'signal', 'trend-line'));
    expect(plugin.source).toBe('ai');
    expect(plugin.componentType).toBe('trend-line');
    expect(plugin.sample.dataBinding).toMatchObject({ sourceId: 'mqtt.realtime', refresh: 'realtime' });
    expect(plugin.telemetry).toMatchObject({ value: 'metrics.onlineRate', series: 'series' });
  });

  it('rejects uploaded executable or unknown component definitions', () => {
    expect(validatePluginDefinition({ id: 'x', name: 'bad', componentType: 'script', dataContract: 'x.v1', sample: {} })).toMatchObject({ ok: false });
    expect(validatePluginDefinition({ id: 'community.good', name: 'good', componentType: 'metric-card', dataContract: 'metric.v1', sample: {} })).toMatchObject({ ok: true });
  });
});
