import crypto from 'crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMqtt5Adapter } from './realtime-mqtt-adapter.js';
import { createRealtimeDeviceStore } from './realtime-device-store.js';
import { createRealtimeAlertEngine, DEFAULT_ALERT_RULES } from './realtime-alert-engine.js';
import { createRealtimeLogger, createRealtimeMetrics } from './realtime-observability.js';

const REALTIME_ROLES = ['viewer', 'operator', 'admin'];
const roleRank = (role) => Math.max(0, REALTIME_ROLES.indexOf(role));
const normalizeRole = (role) => REALTIME_ROLES.includes(role) ? role : 'viewer';
const TOKEN_TTL_MS = Number(process.env.REALTIME_TOKEN_TTL_MS || 5 * 60 * 1000);
const PUSH_INTERVAL_MS = Number(process.env.REALTIME_PUSH_INTERVAL_MS || 2000);
const MAX_REALTIME_CLIENTS = Number(process.env.REALTIME_MAX_CLIENTS || 100);
const isProduction = () => process.env.NODE_ENV === 'production';
const getRealtimeSecret = () => process.env.REALTIME_TOKEN_SECRET || process.env.LICENSE_SECRET || (isProduction() ? '' : 'development-only-realtime-secret');
const getMetricsToken = () => process.env.METRICS_TOKEN || '';
const clients = new Set();
const snapshots = new Map();
const sequences = new Map();
const deviceStore = createRealtimeDeviceStore({ historyLimit: Number(process.env.REALTIME_DEVICE_HISTORY_LIMIT || 1000), dbPath: process.env.REALTIME_DEVICE_DB_PATH });
const alertRules = (() => {
  if (!process.env.REALTIME_ALERT_RULES_JSON) return DEFAULT_ALERT_RULES;
  try { const parsed = JSON.parse(process.env.REALTIME_ALERT_RULES_JSON); return Array.isArray(parsed) ? parsed : DEFAULT_ALERT_RULES; } catch { return DEFAULT_ALERT_RULES; }
})();
const alertEngine = createRealtimeAlertEngine({ rules: alertRules, dbPath: process.env.REALTIME_DEVICE_DB_PATH });
const realtimeMetrics = createRealtimeMetrics();
const realtimeLogger = createRealtimeLogger();
const nextSequence = (tenantId, sourceId) => {
  const sequenceKey = `${tenantId}:${sourceId}`;
  const sequence = (sequences.get(sequenceKey) || 0) + 1;
  sequences.set(sequenceKey, sequence);
  return sequence;
};

const mqttSourceConfig = process.env.REALTIME_MQTT_URL ? {
  tenantId: process.env.REALTIME_MQTT_TENANT_ID || 'tenant-demo',
  sourceId: process.env.REALTIME_MQTT_SOURCE_ID || 'mqtt-demo',
  endpoint: process.env.REALTIME_MQTT_URL,
  topicPrefix: process.env.REALTIME_MQTT_TOPIC_PREFIX || 'aether',
} : null;

const sourceDirectory = [{
  id: 'demo-rest', name: '演示 REST 遥测', type: 'rest', status: 'ready',
  endpointConfigured: Boolean(process.env.REALTIME_REST_URL), refreshMs: PUSH_INTERVAL_MS,
}, ...(mqttSourceConfig ? [{ id: mqttSourceConfig.sourceId, name: 'MQTT 5 device telemetry', type: 'mqtt', status: 'starting', endpointConfigured: true, refreshMs: PUSH_INTERVAL_MS }] : [])];

const encode = (value) => Buffer.from(value).toString('base64url');
const signWithSecret = (value, secret) => crypto.createHmac('sha256', secret).update(value).digest('base64url');
const sign = (value) => signWithSecret(value, getRealtimeSecret());

function verifyIdentityToken(token) {
  const secret = process.env.REALTIME_IDENTITY_SECRET || '';
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const expected = signWithSecret(`${encodedHeader}.${encodedPayload}`, secret);
    if (header.alg !== 'HS256' || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const scopes = Array.isArray(claims.scope) ? claims.scope : typeof claims.scope === 'string' ? claims.scope.split(' ') : [];
    if (typeof claims.sub !== 'string' || !/^tenant-[a-z0-9-]{2,64}$/i.test(claims.tenantId) || !scopes.includes('realtime:read') || Number(claims.exp) <= Date.now()) return null;
    const claimRoles = Array.isArray(claims.roles) ? claims.roles : typeof claims.role === 'string' ? [claims.role] : [];
    return { sub: claims.sub, tenantId: claims.tenantId, role: claimRoles.map(normalizeRole).sort((a, b) => roleRank(b) - roleRank(a))[0] || 'viewer', sourceIds: Array.isArray(claims.sourceIds) ? claims.sourceIds.filter((value) => typeof value === 'string') : null };
  } catch {
    return null;
  }
}

function issueToken({ tenantId, sourceId, role = 'viewer', sub }) {
  const payload = encode(JSON.stringify({ tenantId, sourceId, scope: 'realtime:read', role: normalizeRole(role), ...(sub ? { sub } : {}), exp: Date.now() + TOKEN_TTL_MS, nonce: crypto.randomBytes(8).toString('hex') }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!getRealtimeSecret()) return null;
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.scope === 'realtime:read' && typeof claims.tenantId === 'string' && typeof claims.sourceId === 'string' && claims.exp > Date.now() ? { ...claims, role: normalizeRole(claims.role) } : null;
  } catch { return null; }
}

function getBearer(req) { return (req.get?.('Authorization') || req.headers?.authorization || '').replace(/^Bearer\s+/i, ''); }
function demoSnapshot(tenantId, sourceId) {
  const sequence = nextSequence(tenantId, sourceId);
  const wave = Math.sin(sequence / 4);
  const throughput = Math.round(12840 + wave * 620 + (sequence % 5) * 43);
  const now = new Date();
  return {
    tenantId, sourceId, sourceType: 'mock', source: 'demo', dataLatencyMs: 0, sequence, capturedAt: now.toISOString(), freshnessMs: 0,
    metrics: { onlineRate: Number((98.6 + wave * .45).toFixed(1)), throughput, temperature: Number((31.8 + wave * 1.3).toFixed(1)), latency: Math.round(182 - wave * 18), power: Math.round(76 + wave * 5) },
    series: Array.from({ length: 12 }, (_, index) => Math.round(58 + Math.sin((sequence + index) / 2.2) * 14 + index * 1.4)),
    alerts: [
      { id: 'gateway-delay', level: sequence % 9 === 0 ? 'warning' : 'info', title: sequence % 9 === 0 ? '边缘网关响应波动' : '北区网关同步完成', detail: sequence % 9 === 0 ? 'P95 延迟已超过预警阈值' : '最近一批遥测已入库', at: now.toLocaleTimeString('zh-CN', { hour12: false }) },
      { id: 'cooling', level: 'warning', title: '冷却回路压力偏低', detail: '建议检查 2 号泵组运行状态', at: new Date(now.getTime() - 74000).toLocaleTimeString('zh-CN', { hour12: false }) },
      { id: 'battery', level: 'info', title: '电池组温度正常', detail: '温控回路运行稳定', at: new Date(now.getTime() - 146000).toLocaleTimeString('zh-CN', { hour12: false }) },
    ],
    points: [{ id: 'north', name: '北区站点', x: 27, y: 35, status: 'online' }, { id: 'east', name: '东侧网关', x: 69, y: 29, status: sequence % 9 === 0 ? 'warning' : 'online' }, { id: 'south', name: '南区站点', x: 61, y: 71, status: 'online' }, { id: 'west', name: '西侧终端', x: 22, y: 74, status: 'offline' }],
  };
}

function normalizeRestSnapshot(value, tenantId, sourceId, dataLatencyMs) {
  const source = value && typeof value === 'object' ? value : {};
  const rawMetrics = source.metrics || source;
  const metric = (name) => Number.isFinite(Number(rawMetrics[name])) ? Number(rawMetrics[name]) : 0;
  const capturedAt = typeof source.capturedAt === 'string' ? source.capturedAt : typeof source.timestamp === 'string' ? source.timestamp : new Date().toISOString();
  return {
    tenantId, sourceId, sourceType: 'rest', source: 'rest', dataLatencyMs: Math.max(0, Number(dataLatencyMs) || 0),
    sequence: nextSequence(tenantId, sourceId), capturedAt, freshnessMs: Math.max(0, Date.now() - new Date(capturedAt).getTime()),
    metrics: { onlineRate: metric('onlineRate'), throughput: metric('throughput'), temperature: metric('temperature'), latency: metric('latency'), power: metric('power') },
    series: Array.isArray(source.series) ? source.series.map(Number).filter(Number.isFinite).slice(-240) : [],
    alerts: Array.isArray(source.alerts) ? source.alerts.slice(0, 20) : [],
    points: Array.isArray(source.points) ? source.points.slice(0, 100) : [],
  };
}

async function readSnapshot(tenantId, sourceId) {
  const key = `${tenantId}:${sourceId}`;
  if (mqttSourceConfig && sourceId === mqttSourceConfig.sourceId) {
    if (tenantId !== mqttSourceConfig.tenantId) throw new Error('MQTT data source is outside this tenant');
    const snapshot = deviceStore.snapshot(tenantId, sourceId);
    snapshot.alerts = alertEngine.snapshotAlerts(tenantId, sourceId);
    snapshots.set(key, snapshot);
    return snapshot;
  }
  if (process.env.REALTIME_REST_URL) {
    const startedAt = Date.now();
    try {
      const url = new URL(process.env.REALTIME_REST_URL);
      if (url.protocol !== 'https:') throw new Error('REALTIME_REST_URL must use HTTPS');
      const response = await fetch(url, { headers: process.env.REALTIME_REST_BEARER ? { Authorization: `Bearer ${process.env.REALTIME_REST_BEARER}` } : {}, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`upstream responded ${response.status}`);
      const snapshot = normalizeRestSnapshot(await response.json(), tenantId, sourceId, Date.now() - startedAt);
      snapshots.set(key, snapshot);
      return snapshot;
    } catch (error) {
      const cached = snapshots.get(key);
      if (cached && cached.sourceType !== 'mock') return { ...cached, sourceType: 'rest-cache', source: 'rest-cache', freshnessMs: Math.max(0, Date.now() - new Date(cached.capturedAt).getTime()) };
      throw new Error(`realtime data unavailable: ${error.message}`);
    }
  }
  if (isProduction()) throw new Error('realtime data unavailable: REALTIME_REST_URL is not configured');
  const snapshot = demoSnapshot(tenantId, sourceId);
  snapshots.set(key, snapshot);
  return snapshot;
}

function encodeFrame(payload) {
  const data = Buffer.from(payload);
  const header = data.length < 126 ? Buffer.from([0x81, data.length]) : Buffer.from([0x81, 126, data.length >> 8, data.length & 255]);
  return Buffer.concat([header, data]);
}
function send(socket, message) { if (!socket.destroyed && socket.writable) socket.write(encodeFrame(JSON.stringify(message))); }
function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ error: message })}`);
  socket.destroy();
}

function readClientTextFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    if ((first & 0x80) === 0 || opcode !== 0x1) break;
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127 || (second & 0x80) === 0) {
      break;
    }
    const frameLength = headerLength + 4 + length;
    if (offset + frameLength > buffer.length) break;
    const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
    const payload = buffer.subarray(offset + headerLength + 4, offset + frameLength);
    const decoded = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) decoded[index] = payload[index] ^ mask[index % 4];
    messages.push(decoded.toString('utf8'));
    offset += frameLength;
  }
  return { messages, remaining: buffer.subarray(offset) };
}

export function installRealtimeService(app, server) {
  app.get('/metrics', (req, res) => {
    if (isProduction()) {
      const configured = getMetricsToken();
      const supplied = getBearer(req);
      if (!configured) return res.status(404).type('text/plain').send('metrics unavailable');
      const expected = Buffer.from(configured);
      const actual = Buffer.from(supplied);
      if (!supplied || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return res.status(401).type('text/plain').send('unauthorized');
      }
    }
    return res.type('text/plain').send(realtimeMetrics.prometheus());
  });
  app.post('/api/v1/realtime/token', (req, res) => {
    if (isProduction() && !getRealtimeSecret()) return res.status(503).json({ error: 'realtime token signing is not configured' });
    const identity = isProduction() ? verifyIdentityToken(getBearer(req)) : null;
    if (isProduction() && !identity) return res.status(401).json({ error: 'trusted identity token is required' });
    const requestedTenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : '';
    if (identity && requestedTenantId && requestedTenantId !== identity.tenantId) return res.status(403).json({ error: 'identity cannot access this tenant' });
    const tenantId = identity?.tenantId || requestedTenantId;
    const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId.trim() : 'demo-rest';
    const requestedRoleValue = typeof req.body?.role === 'string' ? req.body.role.trim() : undefined;
    if (requestedRoleValue && !REALTIME_ROLES.includes(requestedRoleValue)) return res.status(400).json({ error: 'invalid realtime role' });
    const requestedRole = requestedRoleValue;
    if (mqttSourceConfig && sourceId === mqttSourceConfig.sourceId && tenantId !== mqttSourceConfig.tenantId) return res.status(403).json({ error: 'tenant cannot access this data source' });
    if (identity && requestedRole && roleRank(requestedRole) > roleRank(identity.role)) return res.status(403).json({ error: 'identity cannot grant this role' });
    if (!/^tenant-[a-z0-9-]{2,64}$/i.test(tenantId) || !sourceDirectory.some((source) => source.id === sourceId) || (identity?.sourceIds && !identity.sourceIds.includes(sourceId))) return res.status(400).json({ error: 'invalid tenantId or sourceId' });
    return res.json({ token: issueToken({ tenantId, sourceId, role: identity?.role || requestedRole || 'viewer', sub: identity?.sub }), expiresIn: Math.floor(TOKEN_TTL_MS / 1000), tokenType: 'Bearer', role: identity?.role || requestedRole || 'viewer' });
  });
  const requireRealtimeToken = (req, res, next) => { const claims = verifyToken(getBearer(req)); if (!claims) return res.status(401).json({ error: 'invalid or expired realtime token' }); req.realtimeClaims = claims; next(); };
  const requireRealtimeRole = (roles) => (req, res, next) => REALTIME_ROLES.includes(req.realtimeClaims.role) && roles.includes(req.realtimeClaims.role) ? next() : res.status(403).json({ error: 'insufficient realtime role' });
  app.get('/api/v1/realtime/metrics', requireRealtimeToken, (req, res) => res.json(realtimeMetrics.snapshot()));
  app.get('/api/v1/data-sources', requireRealtimeToken, (req, res) => res.json({ tenantId: req.realtimeClaims.tenantId, sources: sourceDirectory }));
  app.get('/api/v1/realtime/snapshot', requireRealtimeToken, async (req, res) => {
    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : req.realtimeClaims.sourceId;
    if (sourceId !== req.realtimeClaims.sourceId) return res.status(403).json({ error: 'token cannot access this data source' });
    try {
      return res.json(await readSnapshot(req.realtimeClaims.tenantId, sourceId));
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'realtime data unavailable' });
    }
  });
  app.get('/api/v1/realtime/devices', requireRealtimeToken, (req, res) => {
    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : req.realtimeClaims.sourceId;
    if (sourceId !== req.realtimeClaims.sourceId) return res.status(403).json({ error: 'token cannot access this data source' });
    return res.json({ tenantId: req.realtimeClaims.tenantId, sourceId, devices: deviceStore.getCurrentState(req.realtimeClaims.tenantId, sourceId) });
  });
  app.get('/api/v1/realtime/history', requireRealtimeToken, (req, res) => {
    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : req.realtimeClaims.sourceId;
    if (sourceId !== req.realtimeClaims.sourceId) return res.status(403).json({ error: 'token cannot access this data source' });
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    if ((from && !Number.isFinite(Date.parse(from))) || (to && !Number.isFinite(Date.parse(to)))) return res.status(400).json({ error: 'from and to must be valid timestamps' });
    if (from && to && Date.parse(from) > Date.parse(to)) return res.status(400).json({ error: 'from must not be later than to' });
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
    return res.json({ tenantId: req.realtimeClaims.tenantId, sourceId, ...(deviceId ? { deviceId } : {}), events: deviceStore.getHistory({ tenantId: req.realtimeClaims.tenantId, sourceId, deviceId, from, to, limit: req.query.limit }) });
  });
  app.get('/api/v1/realtime/alerts', requireRealtimeToken, (req, res) => {
    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : req.realtimeClaims.sourceId;
    if (sourceId !== req.realtimeClaims.sourceId) return res.status(403).json({ error: 'token cannot access this data source' });
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    if (status && !['open', 'acknowledged', 'closed'].includes(status)) return res.status(400).json({ error: 'invalid alert status' });
    return res.json({ tenantId: req.realtimeClaims.tenantId, sourceId, alerts: alertEngine.list({ tenantId: req.realtimeClaims.tenantId, sourceId, status }) });
  });
  app.get('/api/v1/realtime/alert-rules', requireRealtimeToken, (req, res) => res.json({ rules: alertEngine.rules() }));
  app.get('/api/v1/realtime/alert-rules/audit', requireRealtimeToken, requireRealtimeRole(['admin']), (req, res) => res.json({ audit: alertEngine.configAudit() }));
  app.post('/api/v1/realtime/alert-rules/publish', requireRealtimeToken, requireRealtimeRole(['admin']), (req, res) => {
    try {
      const result = alertEngine.publishRules(req.body?.rules, req.realtimeClaims.sub || 'realtime-token-holder');
      realtimeMetrics.inc('aether_realtime_rule_publications_total');
      realtimeLogger.info('alert rules published', { actor: req.realtimeClaims.sub || 'realtime-token-holder', ruleCount: result.rules.length });
      return res.json(result);
    } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'invalid alert rules' }); }
  });
  app.post('/api/v1/realtime/backup', requireRealtimeToken, requireRealtimeRole(['admin']), (req, res) => {
    const backupDir = process.env.REALTIME_BACKUP_DIR;
    const filename = typeof req.body?.filename === 'string' ? req.body.filename : `realtime-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.sqlite`;
    if (!backupDir || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,96}\.sqlite$/.test(filename)) return res.status(400).json({ error: 'backup directory or filename is not configured' });
    try {
      mkdirSync(backupDir, { recursive: true });
      const result = deviceStore.backupTo(join(backupDir, filename));
      realtimeMetrics.inc('aether_realtime_backups_total');
      realtimeLogger.info('realtime database backup created', { actor: req.realtimeClaims.sub || 'realtime-token-holder', filename });
      return res.json(result);
    } catch (error) { realtimeLogger.error('realtime database backup failed', { error: error instanceof Error ? error.message : String(error) }); return res.status(503).json({ error: 'realtime database backup unavailable' }); }
  });
  app.get('/api/v1/realtime/alerts/:alertId/audit', requireRealtimeToken, (req, res) => {
    const alert = alertEngine.get(req.params.alertId);
    if (!alert || alert.tenantId !== req.realtimeClaims.tenantId || alert.sourceId !== req.realtimeClaims.sourceId) return res.status(404).json({ error: 'alert not found' });
    return res.json({ alertId: alert.alertId, audit: alertEngine.audit(alert.alertId) });
  });
  const transitionAlert = (nextStatus) => (req, res) => {
    const alert = alertEngine.get(req.params.alertId);
    if (!alert || alert.tenantId !== req.realtimeClaims.tenantId || alert.sourceId !== req.realtimeClaims.sourceId) return res.status(404).json({ error: 'alert not found' });
    try {
      const actor = req.realtimeClaims.sub || 'realtime-token-holder';
      const updated = nextStatus === 'acknowledged' ? alertEngine.acknowledge(alert.alertId, actor) : alertEngine.close(alert.alertId, actor);
      realtimeMetrics.inc(`aether_realtime_alerts_${nextStatus}_total`);
      realtimeLogger.info(`alert ${nextStatus}`, { alertId: alert.alertId, actor, tenantId: alert.tenantId, sourceId: alert.sourceId });
      return res.json({ alert: updated });
    } catch (error) {
      return res.status(409).json({ error: error instanceof Error ? error.message : 'alert transition failed' });
    }
  };
  app.post('/api/v1/realtime/alerts/:alertId/acknowledge', requireRealtimeToken, requireRealtimeRole(['operator', 'admin']), transitionAlert('acknowledged'));
  app.post('/api/v1/realtime/alerts/:alertId/close', requireRealtimeToken, requireRealtimeRole(['operator', 'admin']), transitionAlert('closed'));
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== '/ws/realtime') return socket.destroy();
    const claims = verifyToken(url.searchParams.get('token'));
    if (!claims) return rejectUpgrade(socket, '401 Unauthorized', 'invalid or expired realtime token');
    if (clients.size >= MAX_REALTIME_CLIENTS) return rejectUpgrade(socket, '429 Too Many Requests', 'realtime connection limit reached');
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string') return socket.destroy();
    const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = { socket, claims, hidden: false, frameBuffer: Buffer.alloc(0) }; clients.add(client); send(socket, { type: 'hello' });
    socket.on('data', (chunk) => {
      client.frameBuffer = Buffer.concat([client.frameBuffer, chunk]);
      const result = readClientTextFrames(client.frameBuffer);
      client.frameBuffer = result.remaining;
      for (const text of result.messages) {
        try {
          const message = JSON.parse(text);
          if (message.type === 'visibility') client.hidden = Boolean(message.hidden);
        } catch {
          console.warn('[realtime] invalid client frame');
        }
      }
    });
    socket.on('close', () => clients.delete(client)); socket.on('error', () => clients.delete(client));
  });
  const timer = setInterval(async () => {
    alertEngine.tick();
    const groups = new Map(); for (const client of clients) { const key = `${client.claims.tenantId}:${client.claims.sourceId}`; if (!groups.has(key)) groups.set(key, client.claims); }
    for (const client of clients) if (client.claims.exp <= Date.now()) { client.socket.end(); clients.delete(client); }
    for (const claims of groups.values()) {
      try {
        const snapshot = await readSnapshot(claims.tenantId, claims.sourceId);
        for (const client of clients) if (!client.hidden && client.claims.tenantId === claims.tenantId && client.claims.sourceId === claims.sourceId) send(client.socket, { type: 'snapshot', snapshot });
      } catch (error) {
        for (const client of clients) if (!client.hidden && client.claims.tenantId === claims.tenantId && client.claims.sourceId === claims.sourceId) send(client.socket, { type: 'error', message: error instanceof Error ? error.message : 'realtime data unavailable' });
      }
    }
  }, PUSH_INTERVAL_MS);
  if (mqttSourceConfig) {
    const mqttAdapter = createMqtt5Adapter({
      credentials: {
        ...(process.env.REALTIME_MQTT_USERNAME ? { username: process.env.REALTIME_MQTT_USERNAME } : {}),
        ...(process.env.REALTIME_MQTT_PASSWORD ? { password: process.env.REALTIME_MQTT_PASSWORD } : {}),
      },
      onEvent: (event) => {
        realtimeMetrics.inc('aether_realtime_device_events_received_total', { protocol: event.protocol });
        const startedAt = Date.now();
        const result = deviceStore.ingest(event);
        if (result.accepted) {
          realtimeMetrics.inc('aether_realtime_device_events_accepted_total', { source: event.sourceId });
          const alertChanges = alertEngine.evaluate(event);
          realtimeMetrics.inc('aether_realtime_alert_evaluations_total', {}, alertChanges.length);
          if (alertChanges.length) realtimeLogger.info('alert state evaluated', { tenantId: event.tenantId, sourceId: event.sourceId, deviceId: event.deviceId, changes: alertChanges.length });
          const snapshot = deviceStore.snapshot(event.tenantId, event.sourceId);
          snapshot.alerts = alertEngine.snapshotAlerts(event.tenantId, event.sourceId);
          snapshots.set(`${event.tenantId}:${event.sourceId}`, snapshot);
        } else realtimeMetrics.inc('aether_realtime_device_events_rejected_total', { reason: result.reason });
        realtimeMetrics.observe('aether_realtime_event_processing_seconds', (Date.now() - startedAt) / 1000, { source: event.sourceId });
        if (!result.accepted) realtimeLogger.warn('device event rejected', { tenantId: event.tenantId, sourceId: event.sourceId, deviceId: event.deviceId, reason: result.reason });
      },
    });
    const adapterConfig = { ...mqttSourceConfig, protocol: 'mqtt-5', secretRef: process.env.REALTIME_MQTT_SECRET_REF || 'external-secret-store', enabled: true };
    void mqttAdapter.connect(adapterConfig).catch((error) => console.error('[realtime] MQTT adapter failed to connect:', error.message));
    server.once('close', () => { void mqttAdapter.disconnect(); });
  }
  server.once('close', () => { clearInterval(timer); deviceStore.close?.(); alertEngine.closeStore(); });
}

export const realtimeInternals = { issueToken, verifyToken, verifyIdentityToken, readSnapshot, readClientTextFrames, deviceStore, alertEngine, realtimeMetrics, REALTIME_ROLES };
