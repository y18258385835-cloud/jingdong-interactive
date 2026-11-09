import { describe, expect, it } from 'vitest';
import { snapshotToSource } from '../src/core/realtime/realtimeTelemetry';
import { getOfficialPluginRealtimeMapping, OFFICIAL_PLUGIN_REGISTRY } from '../src/plugins/registry';

const readPath = (source: Record<string, any>, path: string) => path.split('.').reduce((value, key) => value?.[key], source);

describe('official plugin MQTT compatibility', () => {
  it('exposes every field required by all 33 official plugin bindings', () => {
    const source = snapshotToSource({
      tenantId: 'tenant-demo', sourceId: 'mqtt-demo', sourceType: 'mqtt', sequence: 1,
      capturedAt: '2026-09-13T01:00:00.000Z', freshnessMs: 100,
      metrics: { onlineRate: 99, throughput: 8000, temperature: 36, latency: 70, power: 60, levelPercent: 70, rpm: 1500, rpmPercent: 83, torqueNm: 45, co2Ppm: 620 },
      series: [1, 2], alerts: [],
      points: [{ id: 'device', name: 'East Line 2', x: 50, y: 50, latitude: 31.2, longitude: 121.4, status: 'online' }],
    });

    expect(OFFICIAL_PLUGIN_REGISTRY).toHaveLength(33);
    expect(source).toMatchObject({ status: 'normal', location: { latitude: 31.2, longitude: 121.4 } });
    expect(source.metrics).toMatchObject({ levelPercent: 70, rpm: 1500, rpmPercent: 83, torqueNm: 45, co2Ppm: 620 });

    for (const plugin of OFFICIAL_PLUGIN_REGISTRY) {
      const mapping = getOfficialPluginRealtimeMapping(plugin);
      expect(readPath(source, mapping.status), plugin.id).toBeDefined();
      if (mapping.value) expect(readPath(source, mapping.value), plugin.id).toBeDefined();
      for (const field of ['series', 'rows', 'items', 'location', 'topology', 'content']) {
        if (mapping[field]) expect(readPath(source, mapping[field]), `${plugin.id}.${field}`).toBeDefined();
      }
    }
  });
});
