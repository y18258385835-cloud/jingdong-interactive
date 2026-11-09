import { describe, expect, it } from 'vitest';
import { isMqttRealtimeSource, snapshotToSource } from '../src/core/realtime/realtimeTelemetry';

describe('realtime telemetry source routing', () => {
  it('keeps the server source id in the UI source payload', () => {
    const source = snapshotToSource({
      tenantId: 'tenant-demo', sourceId: 'line-b', sourceType: 'mqtt', sequence: 4,
      capturedAt: '2026-09-13T01:00:00.000Z', freshnessMs: 200, metrics: { onlineRate: 99, throughput: 10, temperature: 30, latency: 2, power: 4 },
      series: [10], alerts: [{ id: 'warning-1', level: 'warning', title: 'warning', detail: 'test', at: 'now' }], points: [{ id: 'east-device', name: 'East Line 2', x: 50, y: 50, status: 'warning' }],
    });
    expect(source.sourceId).toBe('line-b');
    expect(source.topology).toMatchObject({
      nodes: [
        { id: 'gateway', label: 'MQTT 网关 · line-b' },
        { id: 'east-device', label: 'East Line 2', status: 'warning' },
        { id: 'telemetry', label: '遥测序列 #4', status: 'warning' },
      ],
    });
  });

  it('recognizes the MQTT binding alias and configured source id', () => {
    expect(isMqttRealtimeSource('mqtt.realtime')).toBe(true);
    expect(isMqttRealtimeSource('mqtt-demo')).toBe(true);
    expect(isMqttRealtimeSource('other-source')).toBe(false);
  });

  it('uses an explicit offline device node when no MQTT point is available', () => {
    const source = snapshotToSource({
      tenantId: 'tenant-demo', sourceId: 'line-b', sourceType: 'mqtt', sequence: 0,
      capturedAt: '2026-09-13T01:00:00.000Z', freshnessMs: 16000, metrics: { onlineRate: 0, throughput: 0, temperature: 0, latency: 0, power: 0 },
      series: [], alerts: [], points: [],
    });
    expect(source.topology.nodes[1]).toMatchObject({ id: 'device', label: '等待设备信号', status: 'offline' });
  });
});
