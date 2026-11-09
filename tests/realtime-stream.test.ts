import { describe, expect, it } from 'vitest';
import { decideSnapshot } from '../src/core/realtime/stream';
import type { RealtimeSnapshot } from '../src/core/realtime/types';

const snapshot = (sequence: number, tenantId = 'tenant-demo'): RealtimeSnapshot => ({
  tenantId, sourceId: 'demo-rest', sourceType: 'mock', source: 'demo', dataLatencyMs: 0, sequence, capturedAt: new Date(sequence * 1000).toISOString(), freshnessMs: 0,
  metrics: { onlineRate: 98, throughput: 100, temperature: 30, latency: 100, power: 70 }, series: [1], alerts: [], points: [],
});

describe('realtime stream ordering', () => {
  it('replaces a mock placeholder when the authorized source becomes available', () => {
    const mock = snapshot(0);
    const mqtt = { ...snapshot(1), sourceId: 'mqtt-demo', sourceType: 'mqtt' as const };
    expect(decideSnapshot(mock, mqtt)).toMatchObject({ accepted: true, snapshot: mqtt, needsCompensation: false });
  });

  it('accepts newer snapshots and requests compensation for a sequence gap', () => {
    const result = decideSnapshot(snapshot(4), snapshot(7));
    expect(result).toMatchObject({ accepted: true, needsCompensation: true, snapshot: { sequence: 7 } });
  });

  it('drops duplicates, old frames, and another tenant scope', () => {
    expect(decideSnapshot(snapshot(4), snapshot(4))).toEqual({ accepted: false, reason: 'duplicate' });
    expect(decideSnapshot(snapshot(4), snapshot(3))).toEqual({ accepted: false, reason: 'duplicate' });
    expect(decideSnapshot(snapshot(4), snapshot(5, 'tenant-other'))).toEqual({ accepted: false, reason: 'out-of-scope' });
  });

  it('accepts 1,000 sequential updates and rejects a late frame', () => {
    let current = snapshot(0);
    for (let sequence = 1; sequence <= 1000; sequence += 1) {
      const result = decideSnapshot(current, snapshot(sequence));
      expect(result.accepted).toBe(true);
      if (!result.accepted) throw new Error(`snapshot ${sequence} was rejected`);
      current = result.snapshot;
    }
    expect(current.sequence).toBe(1000);
    expect(decideSnapshot(current, snapshot(999))).toEqual({ accepted: false, reason: 'duplicate' });
  });
});
