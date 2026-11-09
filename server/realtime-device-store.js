import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const STATUS_VALUES = new Set(['online', 'running', 'idle', 'warning', 'fault', 'offline']);
const ONLINE_STATUSES = new Set(['online', 'running', 'idle', 'warning']);

const scopeKey = (tenantId, sourceId) => `${tenantId}:${sourceId}`;
const deviceKey = (event) => `${scopeKey(event.tenantId, event.sourceId)}:${event.deviceId}`;
const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : undefined;
const clone = (value) => JSON.parse(JSON.stringify(value));

function eventMetric(event, names) {
  for (const name of names) {
    const value = finiteNumber(event.metrics?.[name]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function eventTime(event) {
  const time = Date.parse(event.occurredAt);
  return Number.isFinite(time) ? time : Date.now();
}

function pointForEvent(event, index, total) {
  const latitude = finiteNumber(event.location?.latitude);
  const longitude = finiteNumber(event.location?.longitude);
  if (latitude === undefined || longitude === undefined) return null;
  return {
    id: event.deviceId,
    name: event.location?.siteId || event.deviceId,
    x: Math.max(4, Math.min(96, ((longitude + 180) / 360) * 100)),
    y: Math.max(4, Math.min(96, ((90 - latitude) / 180) * 100)),
    latitude,
    longitude,
    status: event.status === 'offline' ? 'offline' : event.status === 'warning' || event.status === 'fault' ? 'warning' : 'online',
    index,
    total,
  };
}

/**
 * In-memory implementation of the current-state/history boundary.
 * Replace this factory with a database-backed implementation when deployment storage is selected.
 * @param {{ historyLimit?: number, dbPath?: string }} options
 */
export function createRealtimeDeviceStore({ historyLimit = 1000, dbPath } = {}) {
  historyLimit = Math.max(1, Math.min(100000, Number(historyLimit) || 1000));
  const db = dbPath ? (() => {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    const database = new DatabaseSync(dbPath);
    database.exec(`
      PRAGMA journal_mode = DELETE;
      CREATE TABLE IF NOT EXISTS device_events (
        tenant_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        sequence REAL,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (tenant_id, source_id, device_id, event_id)
      );
      CREATE INDEX IF NOT EXISTS device_events_scope_time ON device_events (tenant_id, source_id, occurred_at);
      CREATE TABLE IF NOT EXISTS device_current (
        tenant_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        sequence REAL,
        occurred_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (tenant_id, source_id, device_id)
      );
      CREATE TABLE IF NOT EXISTS device_source_counters (
        tenant_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, source_id)
      );
    `);
    return database;
  })() : null;
  let closed = false;
  const current = new Map();
  const history = new Map();
  const seenEventIds = new Set();
  const seenEventOrder = [];
  const sourceSequences = new Map();

  function ingest(event) {
    if (!event || typeof event !== 'object' || typeof event.tenantId !== 'string' || typeof event.sourceId !== 'string' || typeof event.deviceId !== 'string' || typeof event.eventId !== 'string') {
      return { accepted: false, reason: 'invalid' };
    }
    if (!STATUS_VALUES.has(event.status) || !event.occurredAt || !event.metrics || typeof event.metrics !== 'object') {
      return { accepted: false, reason: 'invalid' };
    }
    const eventKey = `${deviceKey(event)}:${event.eventId}`;
    const duplicate = db
      ? db.prepare('SELECT 1 FROM device_events WHERE tenant_id = ? AND source_id = ? AND device_id = ? AND event_id = ?').get(event.tenantId, event.sourceId, event.deviceId, event.eventId)
      : seenEventIds.has(eventKey);
    if (duplicate) return { accepted: false, reason: 'duplicate' };
    const key = deviceKey(event);
    const previous = db
      ? db.prepare('SELECT sequence FROM device_current WHERE tenant_id = ? AND source_id = ? AND device_id = ?').get(event.tenantId, event.sourceId, event.deviceId)
      : current.get(key);
    if (previous?.sequence !== undefined && event.sequence !== undefined && event.sequence <= previous.sequence) {
      return { accepted: false, reason: 'stale' };
    }
    const stored = clone(event);
    if (db) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare(`INSERT OR IGNORE INTO device_events (tenant_id, source_id, device_id, event_id, sequence, occurred_at, received_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(event.tenantId, event.sourceId, event.deviceId, event.eventId, event.sequence ?? null, event.occurredAt, new Date().toISOString(), JSON.stringify(stored));
        if (result.changes !== 1) {
          db.exec('ROLLBACK');
          return { accepted: false, reason: 'duplicate' };
        }
        db.prepare(`INSERT INTO device_current (tenant_id, source_id, device_id, sequence, occurred_at, payload) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (tenant_id, source_id, device_id) DO UPDATE SET sequence = excluded.sequence, occurred_at = excluded.occurred_at, payload = excluded.payload`)
          .run(event.tenantId, event.sourceId, event.deviceId, event.sequence ?? null, event.occurredAt, JSON.stringify(stored));
        const counter = db.prepare('INSERT INTO device_source_counters (tenant_id, source_id, sequence) VALUES (?, ?, 1) ON CONFLICT (tenant_id, source_id) DO UPDATE SET sequence = sequence + 1 RETURNING sequence').get(event.tenantId, event.sourceId);
        const rows = db.prepare('SELECT rowid FROM device_events WHERE tenant_id = ? AND source_id = ? ORDER BY occurred_at ASC, received_at ASC').all(event.tenantId, event.sourceId);
        const remove = Math.max(0, rows.length - historyLimit);
        for (const row of rows.slice(0, remove)) db.prepare('DELETE FROM device_events WHERE rowid = ?').run(row.rowid);
        db.exec('COMMIT');
        return { accepted: true, reason: 'accepted', sequence: counter.sequence, event: clone(stored) };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    seenEventIds.add(eventKey);
    seenEventOrder.push(eventKey);
    while (seenEventOrder.length > historyLimit * 10) seenEventIds.delete(seenEventOrder.shift());
    current.set(key, stored);
    const sourceHistory = history.get(scopeKey(event.tenantId, event.sourceId)) || [];
    sourceHistory.push(stored);
    if (sourceHistory.length > historyLimit) sourceHistory.splice(0, sourceHistory.length - historyLimit);
    history.set(scopeKey(event.tenantId, event.sourceId), sourceHistory);
    const sourceKey = scopeKey(event.tenantId, event.sourceId);
    const sequence = (sourceSequences.get(sourceKey) || 0) + 1;
    sourceSequences.set(sourceKey, sequence);
    return { accepted: true, reason: 'accepted', sequence, event: clone(stored) };
  }

  function getCurrentState(tenantId, sourceId) {
    if (db) return db.prepare('SELECT payload FROM device_current WHERE tenant_id = ? AND source_id = ? ORDER BY occurred_at DESC').all(tenantId, sourceId).map((row) => JSON.parse(row.payload));
    return [...current.values()]
      .filter((event) => event.tenantId === tenantId && event.sourceId === sourceId)
      .sort((a, b) => eventTime(b) - eventTime(a))
      .map(clone);
  }

  /** @param {{ tenantId: string, sourceId: string, deviceId?: string, from?: string, to?: string, limit?: number|string }} options */
  function getHistory({ tenantId, sourceId, deviceId, from, to, limit = 1000 }) {
    const fromTime = from ? Date.parse(from) : -Infinity;
    const toTime = to ? Date.parse(to) : Infinity;
    if (Number.isNaN(fromTime) || Number.isNaN(toTime) || fromTime > toTime) return [];
    const boundedLimit = Math.max(1, Math.min(1000, Number(limit) || 1000));
    const sourceHistory = db
      ? db.prepare(`SELECT payload FROM device_events WHERE tenant_id = ? AND source_id = ?${deviceId ? ' AND device_id = ?' : ''} ORDER BY occurred_at ASC, received_at ASC`).all(...(deviceId ? [tenantId, sourceId, deviceId] : [tenantId, sourceId])).map((row) => JSON.parse(row.payload))
      : (history.get(scopeKey(tenantId, sourceId)) || []);
    return sourceHistory
      .filter((event) => (!deviceId || event.deviceId === deviceId) && eventTime(event) >= fromTime && eventTime(event) <= toTime)
      .sort((a, b) => eventTime(a) - eventTime(b))
      .slice(-boundedLimit)
      .map(clone);
  }

  function snapshot(tenantId, sourceId) {
    const states = getCurrentState(tenantId, sourceId);
    const events = getHistory({ tenantId, sourceId, limit: historyLimit });
    const throughputValues = states.map((event) => eventMetric(event, ['throughput', 'throughputPerMinute', 'value'])).filter((value) => value !== undefined);
    const temperatureValues = states.map((event) => eventMetric(event, ['temperature', 'temperatureC'])).filter((value) => value !== undefined);
    const latencyValues = states.map((event) => eventMetric(event, ['latency', 'latencyMs'])).filter((value) => value !== undefined);
    const powerValues = states.map((event) => eventMetric(event, ['power', 'powerKw'])).filter((value) => value !== undefined);
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const optionalMetric = (names) => {
      const values = states.map((event) => eventMetric(event, names)).filter((value) => value !== undefined);
      return values.length ? Number(average(values).toFixed(2)) : undefined;
    };
    const levelPercent = optionalMetric(['levelPercent', 'level', 'tankLevelPercent']);
    const rpm = optionalMetric(['rpm']);
    const rpmPercent = optionalMetric(['rpmPercent']);
    const torqueNm = optionalMetric(['torqueNm', 'torque']);
    const co2Ppm = optionalMetric(['co2Ppm', 'co2', 'carbonDioxidePpm']);
    const capturedAt = states.length ? states.reduce((latest, event) => eventTime(event) > eventTime(latest) ? event : latest).occurredAt : new Date().toISOString();
    const alerts = states.filter((event) => event.status === 'warning' || event.status === 'fault' || event.status === 'offline').slice(0, 20).map((event) => ({
      id: event.eventId,
      level: event.status === 'fault' ? 'critical' : 'warning',
      title: `${event.deviceId} abnormal status`,
      detail: event.status === 'fault' ? 'Device reported a fault; inspect the device.' : event.status === 'offline' ? 'Device is offline; check its network and power.' : 'Device reported a warning; monitor the next readings.',
      at: event.occurredAt,
    }));
    const points = states.map((event, index) => pointForEvent(event, index, states.length)).filter(Boolean).map(({ index, total, ...point }) => point);
    const series = events.map((event) => eventMetric(event, ['throughput', 'throughputPerMinute', 'value', 'powerKw'])).filter((value) => value !== undefined).slice(-240);
    const sourceSequence = db
      ? (db.prepare('SELECT sequence FROM device_source_counters WHERE tenant_id = ? AND source_id = ?').get(tenantId, sourceId)?.sequence || 0)
      : (sourceSequences.get(scopeKey(tenantId, sourceId)) || 0);
    return {
      tenantId,
      sourceId,
      sourceType: 'mqtt',
      source: 'mqtt-5',
      dataLatencyMs: Math.max(0, Date.now() - Date.parse(capturedAt)),
      sequence: sourceSequence,
      capturedAt,
      freshnessMs: Math.max(0, Date.now() - Date.parse(capturedAt)),
      metrics: {
        onlineRate: states.length ? Number((states.filter((event) => ONLINE_STATUSES.has(event.status)).length / states.length * 100).toFixed(1)) : 0,
        throughput: Number(throughputValues.reduce((sum, value) => sum + value, 0).toFixed(2)),
        temperature: Number(average(temperatureValues).toFixed(2)),
        latency: Number(average(latencyValues).toFixed(2)),
        power: Number(average(powerValues).toFixed(2)),
        ...(levelPercent === undefined ? {} : { levelPercent }),
        ...(rpm === undefined ? {} : { rpm }),
        ...(rpmPercent === undefined ? {} : { rpmPercent }),
        ...(torqueNm === undefined ? {} : { torqueNm }),
        ...(co2Ppm === undefined ? {} : { co2Ppm }),
      },
      series,
      alerts,
      points,
    };
  }

  function backupTo(destination) {
    if (!db) throw new Error('backup requires a SQLite store');
    if (typeof destination !== 'string' || !destination.trim()) throw new Error('backup destination is required');
    const serialized = db.serialize();
    writeFileSync(destination, serialized);
    return { destination, mode: 'sqlite', bytes: serialized.byteLength };
  }

  return { ingest, getCurrentState, getHistory, snapshot, backupTo, close: () => { if (db && !closed) { db.close(); closed = true; } }, mode: db ? 'sqlite' : 'memory' };
}
