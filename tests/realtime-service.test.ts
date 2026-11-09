import crypto from 'crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../server/index.js';
import { realtimeInternals } from '../server/realtime-service.js';

describe('realtime BFF', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.REALTIME_REST_URL;
    delete process.env.REALTIME_IDENTITY_SECRET;
    delete process.env.REALTIME_TOKEN_SECRET;
    delete process.env.METRICS_TOKEN;
    process.env.NODE_ENV = 'test';
  });

  it('issues a short-lived, source-scoped read token and returns a snapshot', async () => {
    const tokenResponse = await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-alpha', sourceId: 'demo-rest' }).expect(200);
    expect(tokenResponse.body.token).toMatch(/^[^.]+\.[^.]+$/);
    expect(tokenResponse.body.expiresIn).toBeGreaterThan(0);
    expect(tokenResponse.body.expiresIn).toBeLessThanOrEqual(300);
    expect(tokenResponse.body.role).toBe('viewer');

    const snapshotResponse = await request(app).get('/api/v1/realtime/snapshot?sourceId=demo-rest').set('Authorization', `Bearer ${tokenResponse.body.token}`).expect(200);
    expect(snapshotResponse.body.tenantId).toBe('tenant-alpha');
    expect(snapshotResponse.body.sourceId).toBe('demo-rest');
    expect(snapshotResponse.body.sourceType).toBe('mock');
    expect(snapshotResponse.body.metrics.throughput).toBeTypeOf('number');
    expect(snapshotResponse.body.points.length).toBeGreaterThan(0);
  });

  it('rejects missing, tampered, and cross-source access', async () => {
    await request(app).get('/api/v1/realtime/snapshot').expect(401);
    const tokenResponse = await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-beta', sourceId: 'demo-rest' }).expect(200);
    await request(app).get('/api/v1/realtime/snapshot').set('Authorization', `Bearer ${tokenResponse.body.token}x`).expect(401);
    await request(app).get('/api/v1/realtime/snapshot?sourceId=other-source').set('Authorization', `Bearer ${tokenResponse.body.token}`).expect(403);
  });

  it('returns a source directory only for a valid short-lived token', async () => {
    await request(app).get('/api/v1/data-sources').expect(401);
    const tokenResponse = await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-gamma', sourceId: 'demo-rest' }).expect(200);
    const response = await request(app).get('/api/v1/data-sources').set('Authorization', `Bearer ${tokenResponse.body.token}`).expect(200);
    expect(response.body.tenantId).toBe('tenant-gamma');
    expect(response.body.sources).toHaveLength(1);
  });

  it('decodes masked visibility frames from browser clients', () => {
    const payload = Buffer.from(JSON.stringify({ type: 'visibility', hidden: true }));
    const mask = Buffer.from([7, 19, 29, 31]);
    const masked = Buffer.from(payload.map((value, index) => value ^ mask[index % 4]));
    const frame = Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
    const result = realtimeInternals.readClientTextFrames(frame);
    expect(result.messages).toEqual(['{"type":"visibility","hidden":true}']);
    expect(result.remaining).toHaveLength(0);
  });

  it('allows mock data outside production and blocks it in production', async () => {
    const developmentSnapshot = await realtimeInternals.readSnapshot('tenant-dev-check', 'demo-rest');
    expect(developmentSnapshot.sourceType).toBe('mock');

    process.env.NODE_ENV = 'production';
    delete process.env.REALTIME_REST_URL;
    await expect(realtimeInternals.readSnapshot('tenant-production-check', 'demo-rest')).rejects.toThrow('REALTIME_REST_URL is not configured');
  });

  it('does not replace a failed production upstream with mock data', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REALTIME_REST_URL = 'https://telemetry.example.com/api/snapshot';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('upstream unavailable'));

    await expect(realtimeInternals.readSnapshot('tenant-upstream-check', 'demo-rest')).rejects.toThrow('upstream unavailable');
  });

  it('marks REST data and cached data explicitly without demo defaults', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REALTIME_REST_URL = 'https://telemetry.example.com/api/snapshot';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ metrics: { throughput: 42 } }), { status: 200 }))
      .mockRejectedValueOnce(new Error('temporary upstream failure'));

    const live = await realtimeInternals.readSnapshot('tenant-rest-check', 'demo-rest');
    expect(live).toMatchObject({ sourceType: 'rest', source: 'rest', metrics: { throughput: 42, onlineRate: 0 }, series: [] });
    expect(live.dataLatencyMs).toBeGreaterThanOrEqual(0);

    const cached = await realtimeInternals.readSnapshot('tenant-rest-check', 'demo-rest');
    expect(cached).toMatchObject({ sourceType: 'rest-cache', source: 'rest-cache', sequence: live.sequence });
  });

  it('lists, acknowledges, closes, and audits scoped alerts through the API', async () => {
    const event = {
      eventId: 'api-alert-1', tenantId: 'tenant-alert-api', sourceId: 'demo-rest', deviceId: 'device-api', protocol: 'mqtt-5',
      occurredAt: new Date().toISOString(), status: 'fault', metrics: {},
    };
    const [alert] = realtimeInternals.alertEngine.evaluate(event);
    const token = await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-alert-api', sourceId: 'demo-rest', role: 'operator' }).expect(200);
    const headers = { Authorization: `Bearer ${token.body.token}` };
    await request(app).get('/api/v1/realtime/alerts?sourceId=demo-rest&status=open').set(headers).expect(200).expect((response) => {
      expect(response.body.alerts).toEqual([expect.objectContaining({ alertId: alert.alertId, status: 'open' })]);
    });
    await request(app).post(`/api/v1/realtime/alerts/${alert.alertId}/acknowledge`).set(headers).expect(200).expect((response) => expect(response.body.alert.status).toBe('acknowledged'));
    await request(app).post(`/api/v1/realtime/alerts/${alert.alertId}/close`).set(headers).expect(200).expect((response) => expect(response.body.alert.status).toBe('closed'));
    await request(app).get(`/api/v1/realtime/alerts/${alert.alertId}/audit`).set(headers).expect(200).expect((response) => expect(response.body.audit.map((entry) => entry.action)).toEqual(['opened', 'acknowledged', 'closed']));
  });

  it('exposes process metrics with and without the authenticated JSON view', async () => {
    const token = await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-metrics-api', sourceId: 'demo-rest' }).expect(200);
    await request(app).get('/metrics').expect(200).expect('Content-Type', /text\/plain/).expect((response) => expect(response.text).toContain('aether_realtime_uptime_seconds'));
    await request(app).get('/api/v1/realtime/metrics').set('Authorization', `Bearer ${token.body.token}`).expect(200).expect((response) => expect(response.body).toHaveProperty('counters'));
  });

  it('protects Prometheus metrics and disables desktop folder access in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 'metrics-test-token';
    await request(app).get('/metrics').expect(401);
    await request(app).get('/metrics').set('Authorization', 'Bearer wrong').expect(401);
    await request(app).get('/metrics').set('Authorization', 'Bearer metrics-test-token').expect(200).expect('Content-Type', /text\/plain/);
    await request(app).post('/api/open-folder').send({ folder: 'C:\\' }).expect(404);
  });

  it('enforces viewer, operator, and admin permissions for alert operations', async () => {
    const [alert] = realtimeInternals.alertEngine.evaluate({
      eventId: 'role-alert-1', tenantId: 'tenant-role-api', sourceId: 'demo-rest', deviceId: 'device-role', protocol: 'mqtt-5',
      occurredAt: new Date().toISOString(), status: 'fault', metrics: {},
    });
    const issue = async (role: string) => (await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-role-api', sourceId: 'demo-rest', role }).expect(200)).body.token;
    const viewer = await issue('viewer');
    const operator = await issue('operator');
    const admin = await issue('admin');
    await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-role-api', sourceId: 'demo-rest', role: 'unknown' }).expect(400);

    await request(app).post(`/api/v1/realtime/alerts/${alert.alertId}/acknowledge`).set('Authorization', `Bearer ${viewer}`).expect(403);
    await request(app).post(`/api/v1/realtime/alerts/${alert.alertId}/acknowledge`).set('Authorization', `Bearer ${operator}`).expect(200);
    await request(app).post('/api/v1/realtime/alert-rules/publish').set('Authorization', `Bearer ${operator}`).send({ rules: [] }).expect(403);
    await request(app).post('/api/v1/realtime/alert-rules/publish').set('Authorization', `Bearer ${admin}`).send({ rules: [{ id: 'role-rule', version: 1, name: 'Role rule', enabled: true, condition: { status: 'warning' }, severity: 'warning' }] }).expect(200);
    await request(app).get('/api/v1/realtime/alert-rules/audit').set('Authorization', `Bearer ${viewer}`).expect(403);
    await request(app).get('/api/v1/realtime/alert-rules/audit').set('Authorization', `Bearer ${admin}`).expect(200).expect((response) => expect(response.body.audit.at(-1).action).toBe('rules-published'));
  });

  it('requires a trusted identity and binds issued tokens to its tenant in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REALTIME_TOKEN_SECRET = 'test-realtime-secret';
    process.env.REALTIME_IDENTITY_SECRET = 'test-identity-secret';
    await request(app).post('/api/v1/realtime/token').send({ tenantId: 'tenant-alpha', sourceId: 'demo-rest' }).expect(401);

    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({ sub: 'user-alpha', tenantId: 'tenant-alpha', roles: ['viewer'], sourceIds: ['demo-rest'], scope: 'realtime:read', exp: Date.now() + 60_000 });
    const unsigned = `${header}.${payload}`;
    const identityToken = `${unsigned}.${crypto.createHmac('sha256', process.env.REALTIME_IDENTITY_SECRET).update(unsigned).digest('base64url')}`;
    await request(app).post('/api/v1/realtime/token').set('Authorization', `Bearer ${identityToken}`).send({ tenantId: 'tenant-beta', sourceId: 'demo-rest' }).expect(403);
    await request(app).post('/api/v1/realtime/token').set('Authorization', `Bearer ${identityToken}`).send({ tenantId: 'tenant-alpha', sourceId: 'demo-rest', role: 'admin' }).expect(403);
    const response = await request(app).post('/api/v1/realtime/token').set('Authorization', `Bearer ${identityToken}`).send({ tenantId: 'tenant-alpha', sourceId: 'demo-rest' }).expect(200);
    expect(response.body.role).toBe('viewer');
  });
});
