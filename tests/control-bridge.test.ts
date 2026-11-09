import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { installControlBridge } from '../server/control-bridge.js';

const dirs: string[] = [];

function createApp() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-control-'));
  dirs.push(dataDir);
  const app = express();
  app.use(express.json());
  const bridge = installControlBridge(app, { dataDir, port: 8123 });
  return { app, bridge, dataDir };
}

afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('本地控制桥', () => {
  it('handshake 返回令牌并写入 discovery 文件', async () => {
    const { app, bridge, dataDir } = createApp();
    const response = await request(app).get('/api/control/handshake');
    expect(response.status).toBe(200);
    expect(response.body.token).toBe(bridge.token);

    const discovery = JSON.parse(fs.readFileSync(path.join(dataDir, 'control-token.json'), 'utf8'));
    expect(discovery).toMatchObject({ token: bridge.token, port: 8123 });
  });

  it('所有接口都必须带令牌', async () => {
    const { app } = createApp();
    expect((await request(app).get('/api/control/state')).status).toBe(401);
    expect((await request(app).post('/api/control/command').send({ type: 'select_scene' })).status).toBe(401);
  });

  it('拒绝非本机 Origin', async () => {
    const { app, bridge } = createApp();
    const response = await request(app)
      .get('/api/control/state')
      .set('Origin', 'https://evil.example.com')
      .set('X-Control-Token', bridge.token);
    expect(response.status).toBe(403);
  });

  it('没有编辑器连接时下发命令返回 409', async () => {
    const { app, bridge } = createApp();
    const state = await request(app).get('/api/control/state').set('X-Control-Token', bridge.token);
    expect(state.body.connected).toBe(false);

    const command = await request(app)
      .post('/api/control/command')
      .set('X-Control-Token', bridge.token)
      .send({ type: 'select_scene', sceneId: 's1' });
    expect(command.status).toBe(409);
  });

  it('导出落盘：写入 exports 目录并清洗文件名', async () => {
    const { app, bridge, dataDir } = createApp();
    const content = Buffer.from('hello export').toString('base64');
    const response = await request(app)
      .post('/api/control/export')
      .set('X-Control-Token', bridge.token)
      .send({ filename: '../evil name.zip', dataBase64: content });
    expect(response.status).toBe(200);
    expect(response.body.filename).toBe('_evil name.zip');
    expect(fs.readFileSync(response.body.path, 'utf8')).toBe('hello export');
    expect(response.body.path.startsWith(path.join(dataDir, 'exports'))).toBe(true);
  });

  it('deferDiscovery 时不会在启动前写入令牌文件', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-control-defer-'));
    dirs.push(dataDir);
    const app = express();
    app.use(express.json());
    const bridge = installControlBridge(app, { dataDir, port: 8124, deferDiscovery: true });
    const tokenFile = path.join(dataDir, 'control-token.json');
    expect(fs.existsSync(tokenFile)).toBe(false);
    bridge.writeDiscovery();
    expect(JSON.parse(fs.readFileSync(tokenFile, 'utf8'))).toMatchObject({ token: bridge.token, port: 8124 });
  });

  it('快照内容变化时递增 revision，长轮询能等到变更', async () => {
    const { app, bridge } = createApp();
    const snapshotA = { title: 'A', activeSceneId: 's1', scenes: [] };
    const snapshotB = { title: 'B', activeSceneId: 's2', scenes: [] };
    const pushA = await request(app).post('/api/control/state').set('X-Control-Token', bridge.token).send(snapshotA);
    expect(pushA.body.revision).toBe(1);
    // 相同内容不递增
    await request(app).post('/api/control/state').set('X-Control-Token', bridge.token).send(snapshotA);
    const state = await request(app).get('/api/control/state').set('X-Control-Token', bridge.token);
    expect(state.body.revision).toBe(1);

    // 长轮询：先挂起，再推新快照
    const wait = request(app)
      .get('/api/control/events?since=1&timeoutMs=3000')
      .set('X-Control-Token', bridge.token)
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await request(app).post('/api/control/state').set('X-Control-Token', bridge.token).send(snapshotB);
    const waited = await wait;
    expect(waited.body.changed).toBe(true);
    expect(waited.body.revision).toBe(2);
    expect(waited.body.project.title).toBe('B');
  });

  it('没有变更时长轮询超时返回 changed=false', async () => {
    const { app, bridge } = createApp();
    const response = await request(app)
      .get('/api/control/events?since=0&timeoutMs=500')
      .set('X-Control-Token', bridge.token);
    expect(response.status).toBe(200);
    expect(response.body.changed).toBe(false);
  });

  it('无对应命令的回执返回 received=false', async () => {
    const { app, bridge } = createApp();
    const response = await request(app)
      .post('/api/control/result')
      .set('X-Control-Token', bridge.token)
      .send({ id: 'missing-command', ok: true });
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(false);
  });

  it('接收编辑器上报的工程快照', async () => {
    const { app, bridge } = createApp();
    const snapshot = { title: '测试工程', activeSceneId: 's1', scenes: [{ id: 's1', alias: '首页', layers: [{ id: 't1', type: 'txt', name: 't1', text: 'hi' }] }] };
    const push = await request(app)
      .post('/api/control/state')
      .set('X-Control-Token', bridge.token)
      .send(snapshot);
    expect(push.status).toBe(200);

    const state = await request(app).get('/api/control/state').set('X-Control-Token', bridge.token);
    expect(state.body.project.title).toBe('测试工程');
    expect(state.body.project.scenes[0].layers[0].text).toBe('hi');
  });
});
