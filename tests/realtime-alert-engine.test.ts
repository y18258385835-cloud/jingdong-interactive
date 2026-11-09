import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRealtimeAlertEngine } from '../server/realtime-alert-engine.js';

const event = (overrides = {}) => ({
  eventId: 'event-1', tenantId: 'tenant-alpha', sourceId: 'mqtt-line', deviceId: 'device-001',
  status: 'fault', occurredAt: '2026-09-12T09:00:00.000Z', metrics: { temperatureC: 30 }, ...overrides,
});

describe('realtime alert engine', () => {
  it('opens a versioned alert and deduplicates repeated matching events', () => {
    const engine = createRealtimeAlertEngine({ rules: [{ id: 'fault-rule', version: 3, name: 'Fault', enabled: true, condition: { status: 'fault' }, severity: 'critical' }] });
    const [opened] = engine.evaluate(event());
    expect(opened).toMatchObject({ ruleId: 'fault-rule', ruleVersion: 3, status: 'open', severity: 'critical', occurrences: 1 });
    const [deduplicated] = engine.evaluate(event({ eventId: 'event-2', occurredAt: '2026-09-12T09:01:00.000Z' }));
    expect(deduplicated).toMatchObject({ alertId: opened.alertId, occurrences: 2, status: 'open' });
    expect(engine.list({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line' })).toHaveLength(1);
    expect(engine.audit(opened.alertId).map((entry) => entry.action)).toEqual(['opened', 'deduplicated']);
  });

  it('matches metric rules, escalates after a duration, and exposes active snapshot alerts', () => {
    const engine = createRealtimeAlertEngine({ rules: [{ id: 'temperature-rule', version: 1, name: 'High temperature', enabled: true, condition: { metric: 'temperatureC', operator: 'gte', value: 80 }, severity: 'warning', escalationAfterMs: 60_000 }] });
    const [alert] = engine.evaluate(event({ status: 'running', metrics: { temperatureC: 85 } }), '2026-09-12T09:00:00.000Z');
    expect(alert).toMatchObject({ severity: 'warning', escalationLevel: 0 });
    const [escalated] = engine.tick('2026-09-12T09:01:00.000Z');
    expect(escalated).toMatchObject({ alertId: alert.alertId, severity: 'critical', escalationLevel: 1 });
    expect(engine.snapshotAlerts('tenant-alpha', 'mqtt-line')).toMatchObject([{ id: alert.alertId, level: 'critical' }]);
  });

  it('supports acknowledge and close with an auditable lifecycle', () => {
    const engine = createRealtimeAlertEngine({ rules: [{ id: 'fault-rule', version: 1, name: 'Fault', enabled: true, condition: { status: 'fault' }, severity: 'critical' }] });
    const [alert] = engine.evaluate(event());
    expect(engine.acknowledge(alert.alertId, 'operator-1', '2026-09-12T09:02:00.000Z')).toMatchObject({ status: 'acknowledged', acknowledgedBy: 'operator-1' });
    expect(() => engine.acknowledge(alert.alertId, 'operator-1')).toThrow('only open');
    expect(engine.close(alert.alertId, 'operator-1', '2026-09-12T09:03:00.000Z')).toMatchObject({ status: 'closed', closedBy: 'operator-1' });
    expect(engine.snapshotAlerts('tenant-alpha', 'mqtt-line')).toEqual([]);
    expect(engine.audit(alert.alertId).map((entry) => entry.action)).toEqual(['opened', 'acknowledged', 'closed']);
  });

  it('keeps tenant/source boundaries and rejects invalid rule matches', () => {
    const engine = createRealtimeAlertEngine({ rules: [{ id: 'fault-rule', version: 1, name: 'Fault', enabled: true, condition: { status: 'fault' }, severity: 'critical' }] });
    engine.evaluate(event());
    expect(engine.list({ tenantId: 'tenant-beta', sourceId: 'mqtt-line' })).toEqual([]);
    expect(engine.evaluate(event({ status: 'running' }))).toEqual([]);
  });

  it('persists alert lifecycle and audit across reopen', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aether-alerts-'));
    const dbPath = join(directory, 'device-events.sqlite');
    const rules = [{ id: 'fault-rule', version: 1, name: 'Fault', enabled: true, condition: { status: 'fault' }, severity: 'critical' }];
    let first;
    let second;
    try {
      first = createRealtimeAlertEngine({ rules, dbPath });
      const [alert] = first.evaluate(event());
      first.closeStore();
      second = createRealtimeAlertEngine({ rules, dbPath });
      expect(second.get(alert.alertId)).toMatchObject({ status: 'open', ruleId: 'fault-rule' });
      expect(second.audit(alert.alertId)).toHaveLength(1);
      expect(second.close(alert.alertId, 'operator-2')).toMatchObject({ status: 'closed' });
    } finally {
      first?.closeStore();
      second?.closeStore();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
