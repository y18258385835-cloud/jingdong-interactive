/**
 * 本地编辑器控制桥（MCP / CLI 用）。
 *
 * 设计目标：
 * - 只允许 loopback 访问，外部机器无法调用
 * - 所有接口需要一次性令牌；令牌在启动时生成并写入 data/control-token.json
 *   （只有本机同一用户可读，供 MCP 进程发现）
 * - 浏览器端通过 SSE 接收命令、通过 POST 上报当前工程快照
 *
 * 该桥只做“读状态 / 改文案 / 切场景”这类低风险操作，不暴露文件系统能力。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const isLoopback = (req) => LOOPBACK_ADDRESSES.has(String(req.socket?.remoteAddress || ''));

const isLocalOrigin = (origin) => {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1');
  } catch {
    return false;
  }
};

export function installControlBridge(app, options = {}) {
  const dataDir = path.resolve(options.dataDir || process.env.CONTROL_DATA_DIR || './data');
  const tokenPath = path.join(dataDir, 'control-token.json');
  const token = options.token || crypto.randomBytes(24).toString('hex');
  const subscribers = new Set();
  let snapshot = null;
  let snapshotAt = 0;
  let revision = 0;
  let lastSnapshotHash = '';
  const changeWaiters = new Set();

  const writeDiscovery = () => {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(tokenPath, JSON.stringify({
        token,
        port: Number(options.port) || Number(process.env.PORT) || 8080,
        pid: process.pid,
        startedAt: Date.now(),
      }, null, 2), 'utf8');
    } catch (error) {
      console.error('[aether] 控制令牌写入失败，编辑器控制桥不可用:', error.message);
    }
  };
  // 失败启动（端口被占用）不应覆盖正在运行实例的令牌文件。
  if (!options.deferDiscovery) writeDiscovery();

  // 只允许本机访问
  app.use('/api/control', (req, res, next) => {
    if (!isLoopback(req)) return res.status(404).json({ error: 'Not found' });
    if (!isLocalOrigin(req.get('origin'))) return res.status(403).json({ error: 'Origin not allowed' });
    return next();
  });

  // 浏览器端获取令牌（同机、同源）
  app.get('/api/control/handshake', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ token });
  });

  const requireToken = (req, res, next) => {
    const supplied = String(req.get('x-control-token') || req.query.token || '');
    const expected = Buffer.from(token);
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      return res.status(401).json({ error: '控制令牌无效' });
    }
    return next();
  };

  // 编辑器订阅命令（SSE）
  app.get('/api/control/stream', requireToken, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('event: ready\ndata: {}\n\n');
    subscribers.add(res);
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { /* ignore */ }
    }, 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      subscribers.delete(res);
    });
  });

  // 编辑器上报当前工程快照
  app.post('/api/control/state', requireToken, (req, res) => {
    const body = JSON.stringify(req.body || {});
    if (body.length > MAX_SNAPSHOT_BYTES) return res.status(413).json({ error: '工程快照过大' });
    snapshot = req.body || null;
    snapshotAt = Date.now();
    // 只在内容真正变化时递增版本号，避免 1.5 秒一次的上报刷出假变更。
    const hash = crypto.createHash('sha1').update(body).digest('hex');
    if (hash !== lastSnapshotHash) {
      lastSnapshotHash = hash;
      revision += 1;
      const waiters = [...changeWaiters];
      changeWaiters.clear();
      waiters.forEach((notify) => notify());
    }
    return res.json({ ok: true, revision });
  });

  // MCP 读取当前工程快照
  app.get('/api/control/state', requireToken, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      connected: subscribers.size > 0,
      editors: subscribers.size,
      updatedAt: snapshotAt,
      revision,
      project: snapshot,
    });
  });

  // 长轮询：等待工程内容发生变化（MCP 用它替代定时轮询）
  app.get('/api/control/events', requireToken, (req, res) => {
    const since = Number(req.query.since) || 0;
    const timeoutMs = Math.min(60_000, Math.max(500, Number(req.query.timeoutMs) || 25_000));
    const reply = () => {
      if (res.headersSent) return;
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        revision,
        changed: revision > since,
        updatedAt: snapshotAt,
        project: snapshot,
      });
    };
    if (revision > since) return reply();

    const notify = () => {
      clearTimeout(timer);
      changeWaiters.delete(notify);
      reply();
    };
    const timer = setTimeout(() => {
      changeWaiters.delete(notify);
      reply();
    }, timeoutMs);
    changeWaiters.add(notify);
    req.on('close', () => {
      clearTimeout(timer);
      changeWaiters.delete(notify);
    });
  });

  // 命令回执：MCP 下发命令后等待编辑器确认执行结果
  const pendingCommands = new Map();

  // 编辑器回执
  app.post('/api/control/result', requireToken, (req, res) => {
    const { id, ok, message, error } = req.body || {};
    const pending = pendingCommands.get(id);
    if (pending) {
      pendingCommands.delete(id);
      clearTimeout(pending.timer);
      pending.resolve({ ok: ok !== false, message: message || error || '' });
    }
    return res.json({ received: Boolean(pending) });
  });

  // 导出落盘：编辑器把成品 Blob 传回来，由本机服务写入 data/exports/
  const exportsDir = path.join(dataDir, 'exports');
  const MAX_EXPORT_BYTES = 200 * 1024 * 1024;
  app.post('/api/control/export', requireToken, (req, res) => {
    try {
      const { filename, dataBase64 } = req.body || {};
      if (!filename || typeof dataBase64 !== 'string') return res.status(400).json({ error: '缺少 filename 或 dataBase64' });
      const buffer = Buffer.from(dataBase64, 'base64');
      if (!buffer.length) return res.status(400).json({ error: '导出内容为空' });
      if (buffer.length > MAX_EXPORT_BYTES) return res.status(413).json({ error: '导出文件过大' });
      // 只保留安全文件名，避免路径穿越
      const safeName = String(filename).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').slice(0, 160) || 'export.bin';
      fs.mkdirSync(exportsDir, { recursive: true });
      const target = path.join(exportsDir, safeName);
      fs.writeFileSync(target, buffer);
      // 保留最近 50 个、7 天内的导出，避免长期使用占满磁盘。
      try {
        const now = Date.now();
        fs.readdirSync(exportsDir)
          .map((name) => {
            const filePath = path.join(exportsDir, name);
            return { filePath, mtime: fs.statSync(filePath).mtimeMs };
          })
          .sort((a, b) => b.mtime - a.mtime)
          .forEach((file, index) => {
            if (index >= 50 || now - file.mtime > 7 * 24 * 60 * 60 * 1000) {
              try { fs.rmSync(file.filePath, { force: true }); } catch { /* ignore */ }
            }
          });
      } catch { /* 清理失败不影响本次导出 */ }
      return res.json({ ok: true, path: target, size: buffer.length, filename: safeName });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // MCP 下发命令
  app.post('/api/control/command', requireToken, async (req, res) => {
    if (!subscribers.size) return res.status(409).json({ error: '编辑器未连接（请先打开软件）' });
    const command = { ...(req.body || {}), id: crypto.randomUUID(), issuedAt: Date.now() };
    if (!command.type) return res.status(400).json({ error: '缺少命令类型' });
    const payload = `event: command\ndata: ${JSON.stringify(command)}\n\n`;
    for (const subscriber of subscribers) {
      try { subscriber.write(payload); } catch { subscribers.delete(subscriber); }
    }

    // 等待回执（默认 5 秒），超时不视为失败，只是没有确认
    const timeoutMs = Math.max(500, Math.min(180000, Number(req.body?.timeoutMs) || 5000));
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingCommands.delete(command.id);
        resolve({ ok: true, acknowledged: false, message: '命令已下发，编辑器未在时限内回执' });
      }, timeoutMs);
      pendingCommands.set(command.id, { resolve: (value) => resolve({ ...value, acknowledged: true }), timer, command });
    });

    return res.json({ id: command.id, delivered: subscribers.size, ...result });
  });

  return { token, tokenPath, writeDiscovery };
}
