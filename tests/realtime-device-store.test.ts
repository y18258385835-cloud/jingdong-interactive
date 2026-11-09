import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRealtimeDeviceStore } from '../server/realtime-device-store.js';

const event = (overrides = {}) => ({
  eventId: 'evt-1',
  tenantId: 'tenant-alpha',
  sourceId: 'mqtt-line',
  deviceId: 'device-001',
  protocol: 'mqtt-5',
  sequence: 1,
  occurredAt: '2026-09-12T09:00:00.000Z',
  status: 'running',
  metrics: { throughput: 10, temperatureC: 31, powerKw: 12 },
  location: { siteId: 'North', latitude: 31.2, longitude: 121.5 },
  ...overrides,
});

describe('realtime device event store', () => {
  it('writes current state and history while removing duplicates and stale sequences', () => {
    const store = createRealtimeDeviceStore({ historyLimit: 3 });
    expect(store.ingest(event())).toMatchObject({ accepted: true, reason: 'accepted' });
    expect(store.ingest(event())).toMatchObject({ accepted: false, reason: 'duplicate' });
    expect(store.ingest(event({ eventId: 'evt-old', sequence: 0 }))).toMatchObject({ accepted: false, reason: 'stale' });
    expect(store.ingest(event({ eventId: 'evt-2', sequence: 2, status: 'fault', occurredAt: '2026-09-12T09:01:00.000Z' }))).toMatchObject({ accepted: true });
    expect(store.getCurrentState('tenant-alpha', 'mqtt-line')).toHaveLength(1);
    expect(store.getCurrentState('tenant-alpha', 'mqtt-line')[0]).toMatchObject({ eventId: 'evt-2', status: 'fault' });
    expect(store.getHistory({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line', deviceId: 'device-001' })).toHaveLength(2);
  });

  it('supports time-bounded history and projects abnormal current state into a snapshot', () => {
    const store = createRealtimeDeviceStore();
    store.ingest(event());
    store.ingest(event({ eventId: 'evt-2', sequence: 2, deviceId: 'device-002', status: 'offline', occurredAt: '2026-09-12T09:02:00.000Z', metrics: { throughput: 20, temperatureC: 35, powerKw: 8 } }));
    expect(store.getHistory({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line', from: '2026-09-12T09:01:00.000Z', to: '2026-09-12T09:03:00.000Z' })).toHaveLength(1);
    const snapshot = store.snapshot('tenant-alpha', 'mqtt-line');
    expect(snapshot).toMatchObject({ sourceType: 'mqtt', sequence: 2, metrics: { onlineRate: 50, throughput: 30 }, alerts: [expect.objectContaining({ level: 'warning' })] });
    expect(snapshot.points).toHaveLength(2);
    expect(snapshot.series).toEqual([10, 20]);
  });

  it('keeps current state and snapshots isolated by tenant and source', () => {
    const store = createRealtimeDeviceStore();
    store.ingest(event({ eventId: 'tenant-a', metrics: { throughput: 10 } }));
    store.ingest(event({ eventId: 'tenant-b', tenantId: 'tenant-beta', metrics: { throughput: 90 } }));
    expect(store.getCurrentState('tenant-alpha', 'mqtt-line')).toHaveLength(1);
    expect(store.getCurrentState('tenant-beta', 'mqtt-line')).toHaveLength(1);
    expect(store.snapshot('tenant-alpha', 'mqtt-line').metrics.throughput).toBe(10);
    expect(store.snapshot('tenant-beta', 'mqtt-line').metrics.throughput).toBe(90);
  });

  it('bounds history retention', () => {
    const store = createRealtimeDeviceStore({ historyLimit: 2 });
    store.ingest(event());
    store.ingest(event({ eventId: 'evt-2', sequence: 2, occurredAt: '2026-09-12T09:01:00.000Z' }));
    store.ingest(event({ eventId: 'evt-3', sequence: 3, occurredAt: '2026-09-12T09:02:00.000Z' }));
    expect(store.getHistory({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line' }).map((item) => item.eventId)).toEqual(['evt-2', 'evt-3']);
  });

  it('persists current state, history, sequence, and duplicate protection across reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aether-realtime-'));
    const dbPath = join(directory, 'device-events.sqlite');
    let first;
    let second;
    try {
      first = createRealtimeDeviceStore({ dbPath });
      expect(first.mode).toBe('sqlite');
      first.ingest(event());
      first.close();

      second = createRealtimeDeviceStore({ dbPath });
      expect(second.getCurrentState('tenant-alpha', 'mqtt-line')).toMatchObject([expect.objectContaining({ eventId: 'evt-1', sequence: 1 })]);
      expect(second.getHistory({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line' })).toHaveLength(1);
      expect(second.ingest(event())).toMatchObject({ accepted: false, reason: 'duplicate' });
      expect(second.ingest(event({ eventId: 'evt-2', sequence: 2 }))).toMatchObject({ accepted: true, sequence: 2 });
      second.close();
    } finally {
      first?.close();
      second?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates a backup that can be reopened for recovery', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aether-realtime-backup-'));
    const dbPath = join(directory, 'device-events.sqlite');
    const backupPath = join(directory, 'recovery.sqlite');
    let store;
    let recovered;
    try {
      store = createRealtimeDeviceStore({ dbPath });
      store.ingest(event());
      expect(store.backupTo(backupPath)).toMatchObject({ mode: 'sqlite' });
      expect(statSync(backupPath).size).toBeGreaterThan(0);
      store.close();
      recovered = createRealtimeDeviceStore({ dbPath: backupPath });
      expect(recovered.getCurrentState('tenant-alpha', 'mqtt-line')).toHaveLength(1);
      expect(recovered.ingest(event())).toMatchObject({ accepted: false, reason: 'duplicate' });
    } finally {
      store?.close();
      recovered?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
