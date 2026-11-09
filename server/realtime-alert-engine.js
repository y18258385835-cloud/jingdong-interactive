import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const SEVERITIES = ['info', 'warning', 'critical'];
const ACTIVE_STATUSES = new Set(['open', 'acknowledged']);

/** @typedef {{ id: string, version: number, name?: string, enabled?: boolean, condition: { status?: string, metric?: string, operator?: string, value?: number }, severity: string, escalationAfterMs?: number }} AlertRule */

/** @type {AlertRule[]} */
export const DEFAULT_ALERT_RULES = [
  { id: 'device-fault', version: 1, name: 'Device fault', enabled: true, condition: { status: 'fault' }, severity: 'critical', escalationAfterMs: 0 },
  { id: 'device-warning', version: 1, name: 'Device warning', enabled: true, condition: { status: 'warning' }, severity: 'warning', escalationAfterMs: 10 * 60 * 1000 },
  { id: 'device-offline', version: 1, name: 'Device offline', enabled: true, condition: { status: 'offline' }, severity: 'warning', escalationAfterMs: 5 * 60 * 1000 },
  { id: 'high-temperature', version: 1, name: 'High temperature', enabled: true, condition: { metric: 'temperatureC', operator: 'gt', value: 80 }, severity: 'warning', escalationAfterMs: 10 * 60 * 1000 },
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = (value) => value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();
const severityRank = (value) => Math.max(0, SEVERITIES.indexOf(value));

function conditionMatches(rule, event) {
  const condition = rule.condition || {};
  if (condition.status) return event.status === condition.status;
  const actual = Number(event.metrics?.[condition.metric]);
  const expected = Number(condition.value);
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  if (condition.operator === 'gte') return actual >= expected;
  if (condition.operator === 'lte') return actual <= expected;
  if (condition.operator === 'lt') return actual < expected;
  return actual > expected;
}

function validateRules(rules) {
  return (Array.isArray(rules) ? rules : []).filter((rule) => rule && typeof rule.id === 'string' && Number.isInteger(rule.version) && rule.enabled !== false && typeof rule.condition === 'object' && SEVERITIES.includes(rule.severity));
}

function normalizeRules(rules) {
  const normalized = validateRules(rules);
  if (!Array.isArray(rules) || normalized.length !== rules.length || new Set(normalized.map((rule) => `${rule.id}:v${rule.version}`)).size !== normalized.length) throw new Error('invalid alert rules');
  return normalized.map(clone);
}

/** @param {{ rules?: AlertRule[], dbPath?: string }} options */
export function createRealtimeAlertEngine({ rules = DEFAULT_ALERT_RULES, dbPath } = {}) {
  let activeRules = normalizeRules(rules);
  const alerts = new Map();
  const audit = new Map();
  const configAudit = [];
  let db;
  let closed = false;
  if (dbPath) {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_records (
        alert_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS alert_scope_status ON alert_records (tenant_id, source_id, status);
      CREATE TABLE IF NOT EXISTS alert_audit (
        audit_id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS alert_audit_alert ON alert_audit (alert_id, at);
      CREATE TABLE IF NOT EXISTS alert_config_audit (
        audit_id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `);
    for (const row of db.prepare('SELECT payload FROM alert_records').all()) {
      const alert = JSON.parse(row.payload);
      alerts.set(alert.alertId, alert);
    }
    for (const row of db.prepare('SELECT alert_id, payload FROM alert_audit ORDER BY at ASC').all()) {
      const entries = audit.get(row.alert_id) || [];
      entries.push(JSON.parse(row.payload));
      audit.set(row.alert_id, entries);
    }
    for (const row of db.prepare('SELECT payload FROM alert_config_audit ORDER BY at ASC').all()) configAudit.push(JSON.parse(row.payload));
  }

  function persist(alert) {
    if (!db) return;
    db.prepare(`INSERT INTO alert_records (alert_id, tenant_id, source_id, device_id, fingerprint, status, severity, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(alert_id) DO UPDATE SET status = excluded.status, severity = excluded.severity, updated_at = excluded.updated_at, payload = excluded.payload`)
      .run(alert.alertId, alert.tenantId, alert.sourceId, alert.deviceId, alert.fingerprint, alert.status, alert.severity, alert.updatedAt, JSON.stringify(alert));
  }

  function record(alert, action, actor, at, details = {}) {
    const entry = { auditId: randomUUID(), alertId: alert.alertId, action, actor, at, details: clone(details) };
    const entries = audit.get(alert.alertId) || [];
    entries.push(entry);
    audit.set(alert.alertId, entries);
    if (db) db.prepare('INSERT INTO alert_audit (audit_id, alert_id, action, actor, at, payload) VALUES (?, ?, ?, ?, ?, ?)').run(entry.auditId, entry.alertId, entry.action, entry.actor, entry.at, JSON.stringify(entry));
  }

  function findActive(fingerprint) {
    return [...alerts.values()].find((alert) => alert.fingerprint === fingerprint && ACTIVE_STATUSES.has(alert.status));
  }

  function escalate(at, actor = 'rule-engine') {
    const escalated = [];
    const atIso = nowIso(at);
    for (const alert of alerts.values()) {
      if (!ACTIVE_STATUSES.has(alert.status) || !alert.escalationAfterMs || alert.escalatedAt) continue;
      if (Date.parse(atIso) - Date.parse(alert.firstSeenAt) < alert.escalationAfterMs) continue;
      alert.severity = SEVERITIES[Math.min(SEVERITIES.length - 1, severityRank(alert.severity) + 1)];
      alert.escalationLevel = (alert.escalationLevel || 0) + 1;
      alert.escalatedAt = atIso;
      alert.updatedAt = atIso;
      persist(alert);
      record(alert, 'escalated', actor, atIso, { severity: alert.severity, escalationLevel: alert.escalationLevel });
      escalated.push(clone(alert));
    }
    return escalated;
  }

  function evaluate(event, at = event.occurredAt, actor = 'rule-engine') {
    const atIso = nowIso(at);
    const changed = [];
    for (const rule of activeRules) {
      if (!conditionMatches(rule, event)) continue;
      const fingerprint = `${rule.id}:v${rule.version}:${event.tenantId}:${event.sourceId}:${event.deviceId}`;
      const existing = findActive(fingerprint);
      if (existing) {
        existing.occurrences += 1;
        existing.lastSeenAt = atIso;
        existing.lastEventId = event.eventId;
        existing.updatedAt = atIso;
        persist(existing);
        record(existing, 'deduplicated', actor, atIso, { eventId: event.eventId, occurrences: existing.occurrences });
        changed.push(clone(existing));
        continue;
      }
      const alert = {
        alertId: randomUUID(),
        tenantId: event.tenantId,
        sourceId: event.sourceId,
        deviceId: event.deviceId,
        ruleId: rule.id,
        ruleVersion: rule.version,
        ruleName: rule.name,
        fingerprint,
        status: 'open',
        severity: rule.severity,
        firstSeenAt: atIso,
        lastSeenAt: atIso,
        updatedAt: atIso,
        lastEventId: event.eventId,
        occurrences: 1,
        escalationAfterMs: Number(rule.escalationAfterMs) > 0 ? Number(rule.escalationAfterMs) : 0,
        escalationLevel: 0,
        acknowledgedAt: null,
        acknowledgedBy: null,
        closedAt: null,
        closedBy: null,
      };
      alerts.set(alert.alertId, alert);
      persist(alert);
      record(alert, 'opened', actor, atIso, { eventId: event.eventId });
      changed.push(clone(alert));
    }
    return [...changed, ...escalate(at, actor)];
  }

  function get(alertId) {
    const alert = alerts.get(alertId);
    return alert ? clone(alert) : undefined;
  }

  function list({ tenantId, sourceId, status } = {}) {
    return [...alerts.values()]
      .filter((alert) => (!tenantId || alert.tenantId === tenantId) && (!sourceId || alert.sourceId === sourceId) && (!status || alert.status === status))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map(clone);
  }

  function transition(alertId, nextStatus, actor, at) {
    const alert = alerts.get(alertId);
    if (!alert) throw new Error('alert not found');
    if (nextStatus === 'acknowledged' && alert.status !== 'open') throw new Error('only open alerts can be acknowledged');
    if (nextStatus === 'closed' && !ACTIVE_STATUSES.has(alert.status)) throw new Error('only active alerts can be closed');
    const atIso = nowIso(at);
    alert.status = nextStatus;
    alert.updatedAt = atIso;
    if (nextStatus === 'acknowledged') { alert.acknowledgedAt = atIso; alert.acknowledgedBy = actor; }
    if (nextStatus === 'closed') { alert.closedAt = atIso; alert.closedBy = actor; }
    persist(alert);
    record(alert, nextStatus, actor, atIso);
    return clone(alert);
  }

  function auditFor(alertId) { return (audit.get(alertId) || []).map(clone); }
  function publishRules(nextRules, actor, at) {
    const next = normalizeRules(nextRules);
    const atIso = nowIso(at);
    activeRules = next;
    const entry = { auditId: randomUUID(), action: 'rules-published', actor, at: atIso, rules: clone(next) };
    configAudit.push(entry);
    if (db) db.prepare('INSERT INTO alert_config_audit (audit_id, action, actor, at, payload) VALUES (?, ?, ?, ?, ?)').run(entry.auditId, entry.action, entry.actor, entry.at, JSON.stringify(entry));
    return { rules: clone(activeRules), audit: clone(entry) };
  }
  function snapshotAlerts(tenantId, sourceId) {
    return list({ tenantId, sourceId }).filter((alert) => ACTIVE_STATUSES.has(alert.status)).map((alert) => ({
      id: alert.alertId,
      level: alert.severity,
      title: `${alert.deviceId}: ${alert.ruleName}`,
      detail: `${alert.status}; occurrences ${alert.occurrences}${alert.escalatedAt ? '; escalated' : ''}`,
      at: alert.lastSeenAt,
    }));
  }

  return {
    evaluate,
    tick: (at) => escalate(at),
    get,
    list,
    acknowledge: (alertId, actor, at) => transition(alertId, 'acknowledged', actor, at),
    close: (alertId, actor, at) => transition(alertId, 'closed', actor, at),
    audit: auditFor,
    snapshotAlerts,
    rules: () => activeRules.map(clone),
    publishRules,
    configAudit: () => configAudit.map(clone),
    closeStore: () => { if (db && !closed) { db.close(); closed = true; } },
    mode: db ? 'sqlite' : 'memory',
  };
}
