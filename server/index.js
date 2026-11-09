/**
 * 鲸动交互平台 - AI 3D 生成代理服务器
 *
 * 职责：
 *   1. 转发前端的图片转3D请求到各 API 提供商（火山引擎 Seed3D / Tripo / Meshy / 自定义端点）
 *   2. 保护 API Key 不直接暴露在浏览器网络请求中
 *   3. 代理下载生成的 3D 文件，规避 CORS 限制
 *
 * 启动：node server/index.js  （默认端口 8080）
 * 环境变量：PORT=8080
 */

import express from 'express';
import https from 'https';
import dns from 'dns/promises';
import { isIP } from 'net';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { URL, fileURLToPath } from 'url';
import crypto from 'crypto';
import http from 'http';
import os from 'os';
import tls from 'tls';
import dotenv from 'dotenv';
import { generateImg2ThreeJs, Img2ThreeJsValidationError } from './img2threejs-service.js';
import { buildPluginAiMessages, parsePluginAiResponse, PluginAiValidationError } from './plugin-ai-contract.js';
import { buildHarnessInterviewMessages, buildHarnessReviewMessages, buildSceneAiMessages, extractSceneAiText, isImageGenerationModel, isLikelyVisionModel, normalizeHarnessAttachments, parseHarnessInterviewResponse, parseHarnessReviewResponse, parseSceneAiResponse } from './scene-ai-contract.js';
import { createShareStore } from './share-store.js';
import { installRealtimeService } from './realtime-service.js';
import { installControlBridge } from './control-bridge.js';
import { LicenseService, LicenseServiceError } from './license-service.js';

dotenv.config();
const app = express();
app.disable('x-powered-by');

// 桌面端（AETHER_LICENSE_MODE=disabled）不提供授权能力：卡密签发只应发生在远端服务，
// 本机进程不注册任何签发/兑换/后台接口，避免密钥与后台随安装包下发。
const LICENSE_ROUTE_PREFIXES = ['/api/v1/license', '/api/v1/subscription', '/api/v1/export', '/api/v1/checkout', '/api/admin/', '/admin/licenses'];
const isLicensePath = (p) => LICENSE_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
app.use((req, res, next) => {
  if (!LICENSE_ROUTES_ENABLED && isLicensePath(req.path)) return res.status(404).json({ error: 'Not found' });
  return next();
});

// 管理接口默认只允许本机访问；确需远程管理时显式设置 AETHER_ALLOW_REMOTE_ADMIN=1。
const isLoopbackRequest = (req) => {
  const address = String(req.socket?.remoteAddress || '');
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
};
app.use((req, res, next) => {
  const adminPath = req.path === '/admin/licenses' || req.path.startsWith('/api/admin/');
  if (!adminPath) return next();
  if (process.env.AETHER_ALLOW_REMOTE_ADMIN === '1' || isLoopbackRequest(req)) return next();
  return res.status(404).json({ error: 'Not found' });
});
const PORT = process.env.PORT || 8080;
const MAX_REQUEST_BODY_BYTES = 25 * 1024 * 1024;
const MAX_UPSTREAM_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
// Keep the standalone proxy aligned with the img2threejs UI/service contract.
const MAX_IMAGES_PER_REQUEST = 5;
const licenseService = new LicenseService();
const useHttpOnlyLicenseCookie = process.env.LICENSE_HTTP_ONLY_COOKIE === 'true';
const LICENSE_COOKIE_NAME = 'aether_license_token';
const configuredLicenseSameSite = String(process.env.LICENSE_COOKIE_SAMESITE || 'Lax');

// ---- LAN share snapshots (in-memory, short lived) ----
const SHARE_TTL_MS = 2 * 60 * 60 * 1000;
const SHARE_MAX_BYTES = 20 * 1024 * 1024;
const SHARE_MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const SHARE_MAX_ITEMS = 100;
const shareStore = createShareStore({
  ttlMs: SHARE_TTL_MS,
  maxBytes: SHARE_MAX_BYTES,
  maxTotalBytes: SHARE_MAX_TOTAL_BYTES,
  maxItems: SHARE_MAX_ITEMS,
});

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  const preferred = [];
  const fallback = [];
  // 虚拟网卡（VMware/Hyper-V/WSL/VPN）经常也有 192.168 地址，
  // 优先使用真实 Wi-Fi/以太网，选不到时再退回全部候选。
  const virtualName = /vmware|virtualbox|vbox|hyper-v|vethernet|wsl|docker|tailscale|zerotier|loopback/i;
  for (const [name, entries] of Object.entries(interfaces)) {
    const target = virtualName.test(name) ? fallback : preferred;
    for (const entry of entries || []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (/^169\.254\./.test(entry.address)) continue;
      target.push(entry.address);
    }
  }
  const pick = (candidates) => candidates.find((address) => /^192\.168\./.test(address))
    || candidates.find((address) => /^10\./.test(address))
    || candidates.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address))
    || candidates[0];
  return pick(preferred) || pick(fallback) || '127.0.0.1';
}
const licenseCookieSameSite = ['Strict', 'Lax', 'None'].includes(configuredLicenseSameSite) ? configuredLicenseSameSite : 'Lax';

const LICENSE_MODE = String(process.env.AETHER_LICENSE_MODE || 'local').toLowerCase();
const LICENSE_ROUTES_ENABLED = LICENSE_MODE !== 'disabled';
if (!LICENSE_ROUTES_ENABLED && process.env.NODE_ENV !== 'production') {
  console.warn('[aether] AETHER_LICENSE_MODE=disabled：本进程不提供任何授权/兑换/导出签发接口。');
}
if (LICENSE_ROUTES_ENABLED && process.env.NODE_ENV === 'production' && !licenseService.isConfigured()) {
  throw new Error('Production startup requires LICENSE_SECRET and LICENSE_ADMIN_PASSWORD');
}

class RequestValidationError extends Error {}

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  configuredOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001');
}

function isAllowedOrigin(origin) {
  if (configuredOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
  }

  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe80:');
}

function isLocalLlmTarget(parsed) {
  if (!parsed || !parsed.hostname) return false;
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return isLoopback && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
}

async function parseSafeExternalUrl(value, allowLocalLlm = false) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new RequestValidationError('URL is invalid');
  }

  const parsed = new URL(value);
  if (allowLocalLlm && isLocalLlmTarget(parsed)) {
    return parsed;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
    throw new RequestValidationError('Only HTTPS external URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new RequestValidationError('Local network targets are not allowed');
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new RequestValidationError('Private network targets are not allowed');
  }

  return parsed;
}

function safeLookup(hostname, options, callback) {
  const done = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'object' && options !== null ? options : {};
  dns.lookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      const filtered = addresses.filter(({ address: candidate }) => !isPrivateAddress(candidate));
      if (filtered.length === 0) {
        done(new Error('Private network targets are not allowed'));
        return;
      }
      if (opts.all) {
        done(null, filtered);
      } else {
        done(null, filtered[0].address, filtered[0].family);
      }
    })
    .catch((error) => done(error));
}

function validateGenerationInput(provider, apiKey, images, prompt) {
  if (!Object.hasOwn(PROVIDERS, provider)) {
    throw new RequestValidationError('Unsupported provider');
  }
  if (typeof apiKey !== 'string' || apiKey.length === 0 || apiKey.length > 2048) {
    throw new RequestValidationError('Invalid API key');
  }
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES_PER_REQUEST) {
    throw new RequestValidationError(`Provide between 1 and ${MAX_IMAGES_PER_REQUEST} images`);
  }
  if (images.some((image) => typeof image !== 'string' || image.length > MAX_REQUEST_BODY_BYTES || !/^data:image\/(png|jpe?g|webp);base64,/i.test(image))) {
    throw new RequestValidationError('Images must be PNG, JPEG, or WebP data URLs within the size limit');
  }
  if (prompt !== undefined && (typeof prompt !== 'string' || prompt.length > 4000)) {
    throw new RequestValidationError('Prompt is too long');
  }
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// 极简 CORS 中间件（不依赖 cors 包）
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Aether-Device-Id');
    if (useHttpOnlyLicenseCookie) res.header('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 大 body 支持（base64 图片可能较大）
app.use(express.json({ limit: MAX_REQUEST_BODY_BYTES }));
app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_BODY_BYTES }));

// 健康检查
app.get('/api/health', (req, res) => {
  const licensingReady = process.env.NODE_ENV !== 'production' || (licenseService.isConfigured() && (process.env.LICENSE_MULTI_INSTANCE !== 'true' || licenseService.isSharedStoreConfigured()));
  res.status(licensingReady ? 200 : 503).json({
    status: licensingReady ? 'ok' : 'degraded',
    service: 'aether-3d-proxy',
    licensing: licensingReady ? 'ready' : 'misconfigured',
    time: new Date().toISOString(),
  });
});

// License authority is server-side. Browser flags are only UX hints and cannot grant exports.
const requestBuckets = new Map();
const REQUEST_BUCKET_LIMIT = 5000;
function rateLimit(bucket, maxRequests, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${bucket}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const current = requestBuckets.get(key);
    if (requestBuckets.size > REQUEST_BUCKET_LIMIT) {
      for (const [bucketKey, bucketValue] of requestBuckets) {
        if (bucketValue.resetAt <= now) requestBuckets.delete(bucketKey);
      }
    }
    const entry = !current || now >= current.resetAt ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    requestBuckets.set(key, entry);
    if (entry.count > maxRequests) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    next();
  };
}
function bearerToken(req) {
  return (req.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

// Publish a self-contained presentation snapshot for LAN review.
app.post('/api/share/publish', rateLimit('share-publish', 30, 60_000), (req, res) => {
  const result = shareStore.publish(req.body?.html, req.body?.title);
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  const url = `http://${getLanAddress()}:${PORT}/share/${result.token}`;
  return res.json({ success: true, token: result.token, url, expiresAt: result.expiresAt });
});

app.get('/share/:token', (req, res) => {
  const item = shareStore.get(String(req.params.token || ''));
  if (!item) return res.status(404).send('分享链接不存在或已过期');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.type('html').send(item.html);
});
function cookieToken(req) {
  if (!useHttpOnlyLicenseCookie) return '';
  const item = (req.get('Cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${LICENSE_COOKIE_NAME}=`));
  if (!item) return '';
  const encoded = item.slice(LICENSE_COOKIE_NAME.length + 1);
  if (encoded.length > 4096) return '';
  try {
    return decodeURIComponent(encoded);
  } catch {
    // Malformed client-controlled cookies must behave like an absent token,
    // never turn into an internal server error or bypass the auth path.
    return '';
  }
}
function licenseToken(req) { return bearerToken(req) || cookieToken(req); }
function requireLicenseBrowserOrigin(req, res, next) {
  // HttpOnly cookies remove script access to the token, so mutating endpoints
  // must also reject cross-site browser requests (CSRF). Bearer-authenticated
  // integrations are unaffected, and non-browser requests may omit Origin.
  if (useHttpOnlyLicenseCookie) {
    const origin = req.get('Origin');
    const sameOrigin = origin && `${req.protocol}://${req.get('host')}` === origin;
    if (origin && !sameOrigin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ error: '请求来源未获授权' });
    }
  }
  return next();
}
function setLicenseCookie(res, token, expiresAt) {
  if (!useHttpOnlyLicenseCookie || typeof token !== 'string') return;
  const maxAge = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === 'production' || licenseCookieSameSite === 'None' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${LICENSE_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=${licenseCookieSameSite}${secure}`);
}
function clearLicenseCookie(res) {
  if (!useHttpOnlyLicenseCookie) return;
  const secure = process.env.NODE_ENV === 'production' || licenseCookieSameSite === 'None' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${LICENSE_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${licenseCookieSameSite}${secure}`);
}
function sendLicenseError(res, error) {
  const status = error instanceof LicenseServiceError ? error.status : 500;
  if (status >= 500) console.error('[license]', error.message);
  return res.status(status).json({ error: status >= 500 ? '授权服务暂时不可用' : error.message });
}
function requireAdmin(req, res, next) {
  try {
    licenseService.verifyAdmin(bearerToken(req));
    next();
  } catch (error) {
    sendLicenseError(res, error);
  }
}

app.get('/admin/licenses', (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'license-admin.html'));
});
app.post('/api/admin/licenses/login', rateLimit('admin-login', 10, 15 * 60 * 1000), (req, res) => {
  try {
    return res.json(licenseService.loginAdmin(req.body?.password));
  } catch (error) {
    return sendLicenseError(res, error);
  }
});
app.post('/api/admin/licenses/password', requireAdmin, (req, res) => {
  try {
    return res.json({ success: true, ...licenseService.changeAdminPassword(req.body?.currentPassword, req.body?.newPassword) });
  } catch (error) {
    return sendLicenseError(res, error);
  }
});
app.get('/api/admin/licenses', requireAdmin, (req, res) => res.json({ licenses: licenseService.list() }));
app.get('/api/admin/licenses/summary', requireAdmin, (req, res) => res.json(licenseService.summary()));
app.get('/api/public/app-update', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const updatePath = process.env.APP_UPDATE_PATH || path.resolve('./data/app-update.json');
  try {
    if (!fs.existsSync(updatePath)) return res.json({ version: null });
    const info = JSON.parse(fs.readFileSync(updatePath, 'utf8'));
    if (!info || typeof info.version !== 'string') return res.json({ version: null });
    return res.json({
      version: info.version,
      url: typeof info.url === 'string' && /^https?:\/\//i.test(info.url) ? info.url : 'https://jd-hub.top/',
      notes: typeof info.notes === 'string' ? info.notes.slice(0, 2000) : '',
      publishedAt: Number(info.publishedAt) || null,
      sha256: typeof info.sha256 === 'string' ? info.sha256 : null,
    });
  } catch {
    return res.status(500).json({ error: '更新信息格式错误' });
  }
});
app.get('/api/public/notifications', (req, res) => { res.setHeader('Cache-Control', 'no-store'); return res.json({ notifications: licenseService.listPublishedNotifications() }); });
app.get('/api/admin/notifications', requireAdmin, (req, res) => res.json({ notifications: licenseService.listNotifications() }));
app.post('/api/admin/notifications', requireAdmin, (req, res) => { try { return res.status(201).json({ notification: licenseService.createNotification(req.body || {}) }); } catch (error) { return sendLicenseError(res, error); } });
app.patch('/api/admin/notifications/:id', requireAdmin, (req, res) => { try { return res.json({ notification: licenseService.updateNotification(req.params.id, req.body || {}) }); } catch (error) { return sendLicenseError(res, error); } });
app.post('/api/admin/notifications/:id/publish', requireAdmin, (req, res) => { try { return res.json({ notification: licenseService.publishNotification(req.params.id) }); } catch (error) { return sendLicenseError(res, error); } });
app.post('/api/admin/notifications/:id/withdraw', requireAdmin, (req, res) => { try { return res.json({ notification: licenseService.withdrawNotification(req.params.id) }); } catch (error) { return sendLicenseError(res, error); } });
app.delete('/api/admin/notifications/:id', requireAdmin, (req, res) => { try { return res.json(licenseService.deleteNotification(req.params.id)); } catch (error) { return sendLicenseError(res, error); } });
app.get('/api/public/free-experience-link', (req, res) => res.json(licenseService.getFreeExperienceConfig()));
app.get('/api/admin/free-experience-link', requireAdmin, (req, res) => res.json(licenseService.getFreeExperienceConfig()));
app.post('/api/admin/free-experience-link', requireAdmin, (req, res) => {
  try { return res.json(licenseService.setFreeExperienceConfig(req.body || {})); } catch (error) { return sendLicenseError(res, error); }
});
app.post('/api/admin/licenses/generate', requireAdmin, (req, res) => {
  try {
    return res.json(licenseService.generate(req.body || {}));
  } catch (error) {
    return sendLicenseError(res, error);
  }
});
app.post('/api/admin/licenses/:id/revoke', requireAdmin, (req, res) => {
  try {
    return res.json({ license: licenseService.revoke(req.params.id) });
  } catch (error) {
    return sendLicenseError(res, error);
  }
});

function redeemLicense(req, res) {
  try {
    const headerDeviceId = req.get('X-Aether-Device-Id');
    if (headerDeviceId && req.body?.deviceId && headerDeviceId !== req.body.deviceId) {
      throw new LicenseServiceError('设备标识不一致', 400);
    }
    const { token, license } = licenseService.redeem(req.body || {});
    res.setHeader('Cache-Control', 'no-store');
    const response = { ...licenseService.publicLicense(license, licenseService.deviceHash(req.body.deviceId)) };
    setLicenseCookie(res, token, license.expiresAt);
    if (!useHttpOnlyLicenseCookie) response.token = token;
    return res.json(response);
  } catch (error) {
    return sendLicenseError(res, error);
  }
}
app.post('/api/v1/license/redeem', requireLicenseBrowserOrigin, rateLimit('license-redeem', 20, 15 * 60 * 1000), redeemLicense);
// Retain the original endpoint so existing editor clients continue to work.
app.post('/api/v1/license/activate', requireLicenseBrowserOrigin, rateLimit('license-redeem', 20, 15 * 60 * 1000), redeemLicense);
function verifyLicense(req, res) {
  try {
    const result = licenseService.verifyLicenseToken(licenseToken(req), { rotate: req.method === 'POST', deviceId: req.get('X-Aether-Device-Id') });
    res.setHeader('Cache-Control', 'no-store');
    if (result.token) setLicenseCookie(res, result.token, result.license.expiresAt);
    return res.json(result.token && !useHttpOnlyLicenseCookie ? { ...result.response, token: result.token } : result.response);
  } catch (error) {
    return sendLicenseError(res, error);
  }
}
app.get('/api/v1/license/status', verifyLicense);
app.post('/api/v1/license/refresh', requireLicenseBrowserOrigin, verifyLicense);
app.get('/api/v1/subscription/verify', verifyLicense);
app.post('/api/v1/subscription/verify', requireLicenseBrowserOrigin, verifyLicense);
app.post('/api/v1/license/logout', requireLicenseBrowserOrigin, (req, res) => {
  try {
    const token = licenseToken(req);
    if (token) licenseService.invalidateToken(token, req.get('X-Aether-Device-Id'));
  } catch {
    // Logout must clear the browser session even when the token already expired.
  }
  clearLicenseCookie(res);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(204).end();
});
app.get('/api/v1/export/quota', requireLicenseBrowserOrigin, (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(licenseService.freeExportQuota(req.get('X-Aether-Device-Id'), req.get('X-Aether-Fingerprint')));
  } catch (error) {
    return sendLicenseError(res, error);
  }
});
app.post('/api/v1/export/authorize', requireLicenseBrowserOrigin, rateLimit('export-authorize', 120, 15 * 60 * 1000), (req, res) => {
  try {
    const token = licenseToken(req);
    // 无令牌 = 免费档导出（强制水印 + 1080p）；有令牌按卡密档位放行。
    const authorization = token
      ? licenseService.authorizeExport(token, req.body?.format, req.get('X-Aether-Device-Id'))
      : licenseService.authorizeFreeExport(req.body?.format, req.get('X-Aether-Device-Id'), req.get('X-Aether-Fingerprint'));
    res.setHeader('Cache-Control', 'no-store');
    return res.json(authorization);
  } catch (error) {
    return sendLicenseError(res, error);
  }
});

// 在本机打开已存在的素材目录。仅接受绝对路径且必须是目录，避免执行任意命令。
app.post('/api/open-folder', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, error: '该能力仅限本地开发模式' });
    }
    const folder = typeof req.body?.folder === 'string' ? req.body.folder : '';
    if (!folder || !path.isAbsolute(folder) || folder.length > 4096) {
      return res.status(400).json({ success: false, error: '无效的文件夹路径' });
    }
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
      return res.status(404).json({ success: false, error: '文件夹不存在或不可访问' });
    }
    if (process.platform === 'win32') spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [folder], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [folder], { detached: true, stdio: 'ignore' }).unref();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || '无法打开文件夹' });
  }
});

// POST /api/3d/img2threejs - 视觉模型生成可执行的 Three.js 过程化模型代码
app.post('/api/3d/img2threejs', async (req, res) => {
  try {
    const result = await generateImg2ThreeJs(req.body || {});
    res.json({ success: true, code: result.code, spec: result.spec });
  } catch (error) {
    const isValidationError = error instanceof RequestValidationError || error instanceof Img2ThreeJsValidationError;
    const status = isValidationError ? 400 : 502;
    console.error('[img2threejs] generation failed:', error.message);
    res.status(status).json({
      success: false,
      error: error.message || '视觉模型生成失败',
    });
  }
});

async function createTunneledSocket(targetHostname, targetPort = 443) {
  const candidateProxies = [];
  const env = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (env) {
    try {
      const u = new URL(env);
      candidateProxies.push({ host: u.hostname, port: Number(u.port) || 7890 });
    } catch {}
  }
  candidateProxies.push({ host: '127.0.0.1', port: 7890 });
  candidateProxies.push({ host: '127.0.0.1', port: 7897 });
  candidateProxies.push({ host: '127.0.0.1', port: 10809 });
  candidateProxies.push({ host: '127.0.0.1', port: 10808 });

  for (const proxy of candidateProxies) {
    try {
      const socket = await new Promise((resolve, reject) => {
        const req = http.request({
          host: proxy.host,
          port: proxy.port,
          method: 'CONNECT',
          path: `${targetHostname}:${targetPort}`,
          timeout: 1000,
        });
        req.on('connect', (res, sock) => {
          if (res.statusCode === 200) resolve(sock);
          else { sock.destroy(); reject(new Error(`Proxy status: ${res.statusCode}`)); }
        });
        req.on('timeout', () => { req.destroy(new Error('Proxy timeout')); });
        req.on('error', reject);
        req.end();
      });
      return socket;
    } catch {
      // try next proxy candidate
    }
  }
  return null;
}

// ============================================================
// 工具函数：通用 HTTPS/HTTP 请求
// ============================================================
async function makeRequest(method, urlStr, headers, body) {
  return new Promise(async (resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = await parseSafeExternalUrl(urlStr, true);
    } catch (e) {
      reject(e instanceof RequestValidationError ? e : new Error('无效的 URL'));
      return;
    }

    const isLocal = isLocalLlmTarget(parsedUrl);
    const isHttps = parsedUrl.protocol === 'https:';

    let customCreateConnection = undefined;
    if (!isLocal && isHttps) {
      try {
        const tunneledSocket = await createTunneledSocket(parsedUrl.hostname, parsedUrl.port || 443);
        if (tunneledSocket) {
          customCreateConnection = () => tls.connect({ socket: tunneledSocket, servername: parsedUrl.hostname });
        }
      } catch {}
    }

    const lib = parsedUrl.protocol === 'http:' ? http : https;
    const options = {
      method,
      hostname: parsedUrl.hostname,
      lookup: isLocal || customCreateConnection ? undefined : safeLookup,
      createConnection: customCreateConnection,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      let receivedBytes = 0;
      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
          req.destroy(new Error('Upstream response exceeds the size limit'));
          return;
        }
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('请求超时（60秒）')); });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function upstreamErrorMessage(result, fallback, secret = '') {
  const upstream = Array.isArray(result?.data) ? result.data[0] : result?.data;
  const message = upstream?.error?.message || upstream?.error || upstream?.message || upstream?.detail;
  const redact = (value) => (secret ? value.replace(secret, '[已隐藏]') : value)
    .replace(/\b(?:sk|rk|pk|key|ep)[-_][A-Za-z0-9._-]{8,}\b/gi, (token) => `${token.slice(0, 3)}***`);
  if (typeof message === 'string' && message.trim()) {
    if (/exceeded your current quota|resource_exhausted/i.test(message)) {
      return `${fallback}（当前模型超出配额限制。Pro/Preview 模型需要绑定账单，请直接切换为每天免费 1500 次的 gemini-1.5-flash！）`;
    }
    return `${fallback}（上游：${redact(message.trim()).slice(0, 240)}）`;
  }
  if (result?.raw && result.raw.trim()) return `${fallback}（上游返回的不是 JSON）`;
  return fallback;
}

function normalizeChatEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() === 'generativelanguage.googleapis.com') {
      url.pathname = '/v1beta/openai/chat/completions';
      return url.toString();
    }
    if ((url.protocol === 'https:' || url.protocol === 'http:') && (url.pathname === '/' || url.pathname === '')) {
      url.pathname = '/v1/chat/completions';
      return url.toString();
    }
    if ((url.protocol === 'https:' || url.protocol === 'http:') && /\/v1\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
      return url.toString();
    }
  } catch {
    // makeRequest keeps the final URL validation and returns its normal error.
  }
  return value;
}

function decodeHtml(value) {
  return value.replace(/&(?:amp|quot|#39|lt|gt);/gi, (entity) => ({ '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }[entity.toLowerCase()] || ' '));
}

function extractReferenceSignals(rawHtml, url) {
  const html = rawHtml.slice(0, 1_500_000);
  const pick = (pattern) => decodeHtml((html.match(pattern)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 500);
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i) || pick(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const description = pick(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeHtml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))
    .filter(Boolean)
    .slice(0, 12);
  return { url, title: title || new URL(url).hostname, description, headings };
}

function isParameterCompatibilityError(result) {
  const message = [result?.data?.error?.message, result?.data?.message, result?.raw].filter(Boolean).join(' ');
  return result?.status === 400 && /temperature|max_tokens|max_completion_tokens|unsupported|不支持|参数/i.test(message);
}

function buildSceneRequest(model, messages, conservative = false) {
  let cleanModel = model.replace(/^models\//, '');
  if (/gemini-2\.5-pro/i.test(cleanModel)) {
    cleanModel = 'gemini-1.5-flash';
  }
  const reasoningControl = /hy4-preview/i.test(cleanModel) ? { reasoning_effort: 'none' } : {};
  return conservative
    ? { model: cleanModel, messages, max_completion_tokens: 2600, stream: false, ...reasoningControl }
    : { model: cleanModel, messages, temperature: 0.25, max_tokens: 2600, stream: false, ...reasoningControl };
}

async function makeSceneRequest(endpoint, apiKey, model, messages) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  let result = await makeRequest('POST', endpoint, headers, buildSceneRequest(model, messages));
  // 短暂的容量/限流错误不应立即让一次 Harness 运行失败。
  for (let attempt = 0; attempt < 2 && [429, 500, 502, 503, 504].includes(result.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    result = await makeRequest('POST', endpoint, headers, buildSceneRequest(model, messages));
  }
  if (isParameterCompatibilityError(result)) {
    return makeRequest('POST', endpoint, headers, buildSceneRequest(model, messages, true));
  }
  return result;
}

async function makeMultipartRequest(urlStr, headers, body, contentType) {
  const parsedUrl = await parseSafeExternalUrl(urlStr);
  return new Promise((resolve, reject) => {
    const request = https.request({
      method: 'POST',
      hostname: parsedUrl.hostname,
      lookup: safeLookup,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { 'Content-Type': contentType, 'Content-Length': body.length, ...headers },
    }, (response) => {
      const chunks = [];
      let receivedBytes = 0;
      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
          request.destroy(new Error('Upstream response exceeds the size limit'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status: response.statusCode || 502, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.setTimeout(60000, () => request.destroy(new Error('Upstream request timed out')));
    request.end(body);
  });
}

const BACKGROUND_REMOVAL_PROVIDERS = {
  'remove-bg': {
    endpoint: 'https://api.remove.bg/v1.0/removebg',
    keyHeader: 'X-Api-Key',
  },
  clipdrop: {
    endpoint: 'https://clipdrop-api.co/remove-background/v1',
    keyHeader: 'x-api-key',
  },
};

function decodeImageDataUrl(value) {
  if (typeof value !== 'string' || value.length > 16 * 1024 * 1024) {
    throw new RequestValidationError('Image is missing or exceeds the 12 MB limit');
  }
  const match = value.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new RequestValidationError('Only PNG, JPEG, or WebP images are supported');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new RequestValidationError('Image is missing or exceeds the 12 MB limit');
  return { mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase(), buffer };
}

app.post('/api/image/remove-background', async (req, res) => {
  try {
    const { provider = 'remove-bg', apiKey, endpoint, imageDataUrl, outputFormat = 'png' } = req.body || {};
    if (!['remove-bg', 'clipdrop', 'custom'].includes(provider)) throw new RequestValidationError('Unsupported background removal provider');
    if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 2048) throw new RequestValidationError('A valid API key is required');
    const image = decodeImageDataUrl(imageDataUrl);
    const target = provider === 'custom' ? endpoint : BACKGROUND_REMOVAL_PROVIDERS[provider].endpoint;
    if (typeof target !== 'string' || !target.trim()) throw new RequestValidationError('A compatible endpoint is required');
    await parseSafeExternalUrl(target.trim());

    const boundary = `----AetherImageLab${crypto.randomBytes(12).toString('hex')}`;
    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image_file"; filename="aether-input"\r\nContent-Type: ${image.mimeType}\r\n\r\n`),
      image.buffer,
      Buffer.from('\r\n'),
    ];
    if (provider === 'remove-bg') {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\nauto\r\n`));
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="format"\r\n\r\npng\r\n`));
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const upstream = await makeMultipartRequest(target.trim(), {
      [provider === 'custom' ? 'Authorization' : BACKGROUND_REMOVAL_PROVIDERS[provider].keyHeader]: provider === 'custom' ? `Bearer ${apiKey.trim()}` : apiKey.trim(),
    }, Buffer.concat(parts), `multipart/form-data; boundary=${boundary}`);
    if (upstream.status < 200 || upstream.status >= 300) return res.status(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502).json({ success: false, error: 'Background removal provider request failed' });
    const result = upstream.body;
    if (!result.length || result.length > MAX_UPSTREAM_RESPONSE_BYTES) throw new Error('Background removal result exceeds the size limit');
    const contentType = 'image/png';
    return res.json({ success: true, mimeType: contentType, dataUrl: `data:${contentType};base64,${result.toString('base64')}` });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 502;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Background removal failed' });
  }
});

// User-provided keys are forwarded for this request only. They are never persisted or logged.
app.post('/api/llm/plugin-generate', async (req, res) => {
  try {
    const { apiKey, endpoint, model, prompt, styleName, componentType } = req.body || {};
    if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 2048) throw new RequestValidationError('请填写有效的 API Key');
    if (typeof endpoint !== 'string' || !endpoint.trim() || endpoint.length > 2048) throw new RequestValidationError('请填写有效的 API 端点');
    if (typeof model !== 'string' || !model.trim() || model.length > 256) throw new RequestValidationError('请填写模型名称');
    const messages = buildPluginAiMessages({ prompt, styleName, componentType });
    const result = await makeRequest('POST', endpoint.trim(), { Authorization: `Bearer ${apiKey.trim()}` }, {
      model: model.trim(), messages, temperature: 0.35, max_tokens: 700,
    });
    if (result.status < 200 || result.status >= 300) return res.status(result.status || 502).json({ success: false, error: upstreamErrorMessage(result, '模型服务请求失败', apiKey.trim()) });
    const content = extractSceneAiText(result.data);
    if (!content.trim()) {
      throw new Error('模型返回为空：请确认端点是 OpenAI 兼容的 chat/completions 地址，并检查模型名称是否支持文本输出。');
    }
    const draft = parsePluginAiResponse(content, componentType);
    return res.json({ success: true, draft });
  } catch (error) {
    const status = error instanceof RequestValidationError || error instanceof PluginAiValidationError ? 400 : 502;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'AI 组件生成失败' });
  }
});

function getEffectiveApiKey(apiKey, endpoint) {
  const trimmed = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (trimmed) return trimmed;
  try {
    const url = new URL(endpoint);
    if (isLocalLlmTarget(url)) return 'ollama';
  } catch {}
  return '';
}

// AI Introspect Controls: extracts customizable UI controls from interactive code
app.post('/api/llm/extract-controls', async (req, res) => {
  try {
    const { config, html = '', css = '', js = '', name = '', componentType = '', componentData = null, candidates = null } = req.body || {};
    const endpoint = config?.customEndpoint?.trim() || config?.endpoint || '';
    const apiKey = getEffectiveApiKey(config?.apiKey, endpoint);
    const model = config?.model?.trim() || 'deepseek-chat';

    // 本地结构识别出的候选参数：AI 只能改名/分组，不能发明 key。
    const validTypes = new Set(['slider', 'number', 'color', 'toggle', 'select', 'text']);
    const candidateList = Array.isArray(candidates)
      ? candidates
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            key: String(item.key || '').replace(/[^a-zA-Z0-9_-]/g, ''),
            label: String(item.label || '').slice(0, 40),
            type: validTypes.has(item.type) ? item.type : 'text',
            default: item.default,
            min: typeof item.min === 'number' ? item.min : undefined,
            max: typeof item.max === 'number' ? item.max : undefined,
            step: typeof item.step === 'number' ? item.step : undefined,
            unit: typeof item.unit === 'string' ? item.unit.slice(0, 10) : undefined,
            group: typeof item.group === 'string' ? item.group.slice(0, 20) : undefined,
          }))
          .filter((item) => item.key.length > 0)
          .slice(0, 40)
      : [];

    const codeSnippet = [
      html ? `<!-- HTML -->\n${html.slice(0, 3000)}` : '',
      css ? `/* CSS */\n${css.slice(0, 1500)}` : '',
      js ? `// JavaScript\n${js.slice(0, 3000)}` : '',
    ].filter(Boolean).join('\n\n');

    if (!endpoint || (!codeSnippet.trim() && !componentType && !componentData && candidateList.length === 0)) {
      return res.json({ success: true, controls: [] });
    }

    let systemContent = '';
    let userContent = '';

    if (candidateList.length > 0) {
      systemContent = `You are a Chinese UI copywriter for a visual design tool.
You will receive a list of controls that ALREADY work and are bound to real DOM/CSS targets. Your ONLY job is to give each control a concise, specific Chinese label and group.

Rules:
- Return one entry for EVERY candidate key, using the EXACT key string. Never invent, rename, merge, or drop keys.
- Labels must describe the real content, not generic words. For table components, use labels like "表头 · 姓名", "数值 · 98.6%", "文字颜色", "表头字号".
- Groups should be short Chinese category names such as "表格内容", "表格配色", "表格样式", "文字与外形".
- Do NOT change types/defaults/min/max. Only output key, label, group.
Return ONLY valid JSON with this schema:
{"controls":[{"key":"exact-candidate-key","label":"中文名称","group":"分组"}]}
Do not use markdown backticks or explain anything.`;
      userContent = `Component name: ${name || '自定义组件'}\n\nControls to name:\n${JSON.stringify(candidateList, null, 2)}\n\nCode context:\n${codeSnippet.slice(0, 4000)}`;
    } else if (componentType || (!codeSnippet.trim() && componentData)) {
      systemContent = `You are an expert creative UI and animation controls architect.
Analyze the provided UI component (type: ${componentType || 'UI Component'}, config: ${JSON.stringify(componentData || {})}) and generate 2 to 6 high-value interactive tunable parameters (such as theme colors, glow intensities, border radiuses, animation speeds, toggle states, metric thresholds, label texts) that a user would want to customize in an Inspector Panel.
Return ONLY a valid JSON object matching this exact schema:
{
  "controls": [
    {
      "key": "paramKey",
      "label": "参数中文描述",
      "type": "slider" | "number" | "color" | "toggle" | "select" | "text",
      "default": 1.0,
      "min": 0.1,
      "max": 10,
      "step": 0.1,
      "unit": "x",
      "group": "视觉控制"
    }
  ]
}
Do NOT return markdown backticks or any explanatory text. Return JSON only.`;
      userContent = `Component Type: ${componentType || 'UI Component'}\nComponent Name: ${name || componentType}\nComponent Config: ${JSON.stringify(componentData || {}, null, 2).slice(0, 2000)}`;
    } else {
      systemContent = `You are an expert creative UI and animation controls architect.
Analyze the provided interactive component code (HTML/CSS/JS) and identify 2 to 7 tunable parameters (such as speeds, colors, text labels, sizes, particle counts, toggles, easing types) that a user would want to customize in an Inspector Panel.
Return ONLY a valid JSON object matching this exact schema:
{
  "controls": [
    {
      "key": "paramKey",
      "label": "参数中文描述",
      "type": "slider" | "number" | "color" | "toggle" | "select" | "text",
      "default": 1.0,
      "min": 0.1,
      "max": 10,
      "step": 0.1,
      "unit": "x",
      "group": "动画参数"
    }
  ]
}
Do NOT return markdown backticks or any explanatory text. Return JSON only.`;
      userContent = `Component name: ${name}\n\nCode snippet:\n${codeSnippet}`;
    }

    const messages = [
      {
        role: 'system',
        content: systemContent,
      },
      {
        role: 'user',
        content: userContent,
      }
    ];

    const sceneEndpoint = normalizeChatEndpoint(endpoint.trim());
    let result = await makeRequest('POST', sceneEndpoint, { Authorization: `Bearer ${apiKey}` }, {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 1000,
    });

    if (result.status < 200 || result.status >= 300) {
      return res.status(result.status || 502).json({ success: false, error: upstreamErrorMessage(result, 'AI 提参请求失败', apiKey) });
    }

    const content = extractSceneAiText(result.data);
    let parsed;
    try {
      const clean = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) {
        parsed = JSON.parse(content.slice(start, end + 1));
      }
    }

    const list = Array.isArray(parsed?.controls) ? parsed.controls : [];

    if (candidateList.length > 0) {
      // 只接受候选里真实存在的 key；AI 发明的 key 一律丢弃。
      const allowed = new Set(candidateList.map((item) => item.key));
      const named = new Map();
      list.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const key = String(item.key || '').trim();
        if (!allowed.has(key)) return;
        const label = typeof item.label === 'string' ? item.label.trim().slice(0, 30) : '';
        const group = typeof item.group === 'string' ? item.group.trim().slice(0, 20) : '';
        if (!label && !group) return;
        named.set(key, { key, ...(label ? { label } : {}), ...(group ? { group } : {}) });
      });
      return res.json({ success: true, mode: 'naming', controls: [...named.values()] });
    }

    const controls = list.map((item) => ({
      key: String(item.key || '').replace(/[^a-zA-Z0-9_-]/g, ''),
      label: String(item.label || item.key || '参数').slice(0, 30),
      type: validTypes.has(item.type) ? item.type : 'slider',
      default: item.default ?? (item.type === 'toggle' ? false : item.type === 'color' ? '#38bdf8' : 1),
      min: typeof item.min === 'number' ? item.min : undefined,
      max: typeof item.max === 'number' ? item.max : undefined,
      step: typeof item.step === 'number' ? item.step : undefined,
      unit: typeof item.unit === 'string' ? item.unit.slice(0, 10) : undefined,
      group: typeof item.group === 'string' ? item.group.slice(0, 20) : undefined,
      options: Array.isArray(item.options) ? item.options : undefined,
    })).filter((item) => item.key.length > 0);

    return res.json({ success: true, controls });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '提参失败' });
  }
});

// BYOK structured scene generation. The key is forwarded for this request only.
app.post('/api/llm/models', async (req, res) => {
  try {
    const { apiKey, modelsEndpoint } = req.body || {};
    const effectiveKey = getEffectiveApiKey(apiKey, modelsEndpoint);
    if (!effectiveKey) throw new RequestValidationError('请填写有效的 API Key');
    if (typeof modelsEndpoint !== 'string' || !modelsEndpoint.trim() || modelsEndpoint.length > 2048) throw new RequestValidationError('请填写有效的模型端点');
    let targetEndpoint = modelsEndpoint.trim();
    const reqHeaders = { Authorization: `Bearer ${effectiveKey}` };
    try {
      const u = new URL(targetEndpoint);
      if (u.hostname.toLowerCase() === 'generativelanguage.googleapis.com') {
        targetEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(effectiveKey)}`;
        reqHeaders['x-goog-api-key'] = effectiveKey;
        delete reqHeaders['Authorization'];
      }
    } catch {}
    const result = await makeRequest('GET', targetEndpoint, reqHeaders);
    if (result.status < 200 || result.status >= 300) return res.status(result.status || 502).json({ success: false, models: [], error: upstreamErrorMessage(result, '模型列表读取失败', apiKey.trim()) });
    const candidates = Array.isArray(result.data?.data) ? result.data.data : Array.isArray(result.data?.models) ? result.data.models : [];
    let models = candidates
      .map((item) => typeof item === 'string' ? item : item?.id || item?.name)
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim().replace(/^models\//, ''))
      .filter((m) => !/gemini-2\.5-pro|gemini-1\.0|embedding|aqa|bison/i.test(m))
      .slice(0, 200);
    if (models.length === 0 && /generativelanguage\.googleapis\.com/i.test(targetEndpoint)) {
      models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    }
    return res.json({ success: true, models, message: `已读取 ${models.length} 个模型` });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 502;
    return res.status(status).json({ success: false, models: [], error: error instanceof Error ? error.message : '模型列表读取失败' });
  }
});

app.post('/api/llm/test', async (req, res) => {
  try {
    const { apiKey, endpoint, model } = req.body || {};
    const effectiveKey = getEffectiveApiKey(apiKey, endpoint);
    if (!effectiveKey) throw new RequestValidationError('请填写有效的 API Key');
    if (typeof endpoint !== 'string' || !endpoint.trim() || endpoint.length > 2048) throw new RequestValidationError('请填写有效的 API 端点');
    if (typeof model !== 'string' || !model.trim() || model.length > 256) throw new RequestValidationError('请填写模型名称');
    if (isImageGenerationModel(model)) throw new RequestValidationError('当前模型仅用于图片生成，不支持 AETHER 的 Chat Completions 场景编排，请选择视觉对话模型。');
    const sceneEndpoint = normalizeChatEndpoint(endpoint.trim());
    let targetModel = model.trim().replace(/^models\//, '');
    if (/generativelanguage\.googleapis\.com/i.test(sceneEndpoint) && /gemini-2\.5-pro/i.test(targetModel)) {
      targetModel = 'gemini-1.5-flash';
    }
    const testHeaders = { Authorization: `Bearer ${effectiveKey}` };
    if (/generativelanguage\.googleapis\.com/i.test(sceneEndpoint)) {
      testHeaders['x-goog-api-key'] = effectiveKey;
    }
    const probeMessages = [{ role: 'user', content: 'Reply with OK.' }];
    let result = await makeRequest('POST', sceneEndpoint, testHeaders, {
      model: targetModel, messages: probeMessages, temperature: 0, max_tokens: 16,
    });
    if (isParameterCompatibilityError(result)) {
      result = await makeRequest('POST', sceneEndpoint, { Authorization: `Bearer ${effectiveKey}` }, {
        model: targetModel, messages: probeMessages, max_completion_tokens: 16,
      });
    }
    if (result.status < 200 || result.status >= 300) return res.status(result.status || 502).json({ success: false, error: upstreamErrorMessage(result, '模型端点返回错误', apiKey.trim()) });
    const content = extractSceneAiText(result.data);
    if (!content.trim()) return res.status(502).json({ success: false, error: '模型端点未返回有效文本响应' });
    const returnModels = /generativelanguage\.googleapis\.com/i.test(sceneEndpoint)
      ? ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
      : [];
    return res.json({ success: true, message: '连接成功', models: returnModels });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 502;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : '连接失败' });
  }
});

// Extract only public page structure for the Harness. Redirects are deliberately
// not followed so a public URL cannot pivot this endpoint into a private network.
app.post('/api/reference/analyze', async (req, res) => {
  try {
    const { url } = req.body || {};
    const parsed = await parseSafeExternalUrl(url);
    const result = await makeRequest('GET', parsed.toString(), { Accept: 'text/html,application/xhtml+xml' });
    if (result.status < 200 || result.status >= 300) throw new Error(`网页返回 ${result.status || 502}`);
    if (result.raw.length > 1_500_000) throw new Error('网页内容过大，无法安全解析');
    return res.json({ success: true, reference: extractReferenceSignals(result.raw, parsed.toString()) });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 502;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : '网页信息读取失败' });
  }
});

app.post('/api/llm/interview', async (req, res) => {
  try {
    const { apiKey, endpoint, model, prompt, conversation, context, attachments } = req.body || {};
    const effectiveKey = getEffectiveApiKey(apiKey, endpoint);
    if (!effectiveKey) throw new RequestValidationError('API key is required');
    if (typeof endpoint !== 'string' || !endpoint.trim() || endpoint.length > 2048) throw new RequestValidationError('Endpoint is required');
    if (typeof model !== 'string' || !model.trim() || model.length > 256) throw new RequestValidationError('Model is required');
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new RequestValidationError('Prompt is required');
    if (attachments !== undefined && !Array.isArray(attachments)) throw new RequestValidationError('Attachments must be an array');
    const normalizedAttachments = normalizeHarnessAttachments(attachments);
    if (normalizedAttachments.some((attachment) => attachment.category === 'image' && attachment.dataUrl) && !isLikelyVisionModel(model)) {
      throw new RequestValidationError('VISION_MODEL_REQUIRED: 当前模型未声明视觉输入能力。请选择名称包含 vision、VL、4o 或 omni 的视觉模型后再分析参考图。');
    }
    const result = await makeSceneRequest(normalizeChatEndpoint(endpoint.trim()), effectiveKey, model.trim(), buildHarnessInterviewMessages({ prompt, conversation, context, attachments: normalizedAttachments }));
    if (result.status < 200 || result.status >= 300) return res.status(result.status || 502).json({ success: false, error: upstreamErrorMessage(result, 'Interview model request failed', apiKey.trim()) });
    return res.json({ success: true, interview: parseHarnessInterviewResponse(extractSceneAiText(result.data)) });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 502;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Interview request failed' });
  }
});
app.post('/api/llm/scene-generate', async (req, res) => {
  try {
    const { apiKey, endpoint, model, prompt, context, attachments, evaluate = false } = req.body || {};
    const effectiveKey = getEffectiveApiKey(apiKey, endpoint);
    if (!effectiveKey) throw new RequestValidationError('请填写有效的 API Key');
    if (typeof endpoint !== 'string' || !endpoint.trim() || endpoint.length > 2048) throw new RequestValidationError('请填写有效的 API 端点');
    if (typeof model !== 'string' || !model.trim() || model.length > 256) throw new RequestValidationError('请填写模型名称');
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new RequestValidationError('请输入场景需求');
    const sceneEndpoint = normalizeChatEndpoint(endpoint.trim());
    if (attachments !== undefined && !Array.isArray(attachments)) throw new RequestValidationError('Attachments must be an array');
    const normalizedAttachments = normalizeHarnessAttachments(attachments);
    if (normalizedAttachments.some((attachment) => attachment.category === 'image' && attachment.dataUrl) && !isLikelyVisionModel(model)) {
      throw new RequestValidationError('VISION_MODEL_REQUIRED: 当前模型未声明视觉输入能力。请选择名称包含 vision、VL、4o 或 omni 的视觉模型后再生成场景。');
    }
    const sceneMessages = buildSceneAiMessages({ prompt, context, attachments: normalizedAttachments });
    const result = await makeSceneRequest(sceneEndpoint, effectiveKey, model.trim(), sceneMessages);
    if (result.status < 200 || result.status >= 300) return res.status(result.status || 502).json({ success: false, error: upstreamErrorMessage(result, '模型服务请求失败', effectiveKey) });
    const content = extractSceneAiText(result.data);
    if (!content.trim()) {
      throw new Error('模型返回为空：请确认端点是 OpenAI 兼容的 chat/completions 地址，并检查模型名称是否支持文本输出。');
    }
    let proposal;
    let repaired = false;
    try {
      proposal = parseSceneAiResponse(content);
    } catch (parseError) {
      const repairMessages = [
        ...sceneMessages,
        { role: 'assistant', content: content.slice(0, 12_000) },
        { role: 'user', content: 'Your previous response could not be executed by AETHER. Return corrected JSON only. Include a non-empty operations array using only the allowed operation kinds and element types from the system instruction. Do not explain the correction.' },
      ];
      const repairResult = await makeSceneRequest(sceneEndpoint, effectiveKey, model.trim(), repairMessages);
      if (repairResult.status < 200 || repairResult.status >= 300) {
        throw new Error(`模型方案修复失败：${upstreamErrorMessage(repairResult, '模型服务请求失败', effectiveKey)}`);
      }
      const repairedContent = extractSceneAiText(repairResult.data);
      proposal = parseSceneAiResponse(repairedContent);
      proposal.warnings.unshift('模型首次输出未通过 AETHER 协议，Harness 已自动修复为可执行方案。');
      repaired = true;
    }
    let evaluation = { source: 'unavailable', status: 'deferred', summary: '独立 AI 评测未执行。', issues: [], repairInstructions: [] };
    if (evaluate === true) {
      try {
        const reviewResult = await makeSceneRequest(sceneEndpoint, apiKey.trim(), model.trim(), buildHarnessReviewMessages({ prompt, context, proposal }));
        if (reviewResult.status < 200 || reviewResult.status >= 300) {
          throw new Error(upstreamErrorMessage(reviewResult, 'Harness review request failed', apiKey.trim()));
        }
        evaluation = parseHarnessReviewResponse(extractSceneAiText(reviewResult.data));
      } catch (reviewError) {
        evaluation = {
          source: 'unavailable',
          status: 'deferred',
          summary: '独立 AI 评测暂不可用，已转为本地 Harness 审计。',
          issues: [reviewError instanceof Error ? reviewError.message.slice(0, 240) : '评测服务暂不可用'],
          repairInstructions: ['稍后重试评测；确认写入前检查本地结构、布局和可编辑性审计。'],
        };
      }
    }
    proposal.evaluation = evaluation;
    return res.json({ success: true, proposal, repaired, evaluation });
  } catch (error) {
    const status = error instanceof RequestValidationError ? 400 : 502;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'AI 场景生成失败' });
  }
});

// ============================================================
// 提供商配置
// ============================================================
const PROVIDERS = {
  volcengine: {
    name: '火山引擎 Seed3D',
    defaultEndpoint: 'https://ark.cn-beijing.volces.com',
    defaultModel: 'doubao-seed3d-2-0-260328',
  },
  tripo: {
    name: 'Tripo3D',
    defaultEndpoint: 'https://api.tripo3d.ai',
    defaultModel: 'v2.5-20250123',
  },
  meshy: {
    name: 'Meshy AI',
    defaultEndpoint: 'https://api.meshy.ai',
    defaultModel: 'meshy-6',
  },
  custom: {
    name: '自定义端点',
    defaultEndpoint: '',
    defaultModel: '',
  },
};

// ============================================================
// POST /api/3d/generate - 创建 3D 生成任务
// ============================================================
// body: {
//   provider: 'volcengine' | 'tripo' | 'meshy' | 'custom',
//   endpoint: string (可选，覆盖默认),
//   model: string (可选，覆盖默认),
//   apiKey: string,
//   images: string[] (base64 dataURL 数组),
//   prompt: string (可选),
// }
app.post('/api/3d/generate', async (req, res) => {
  try {
    const { provider = 'volcengine', endpoint, model, apiKey, images = [], prompt } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: '缺少 API Key' });
    }
    if (!images || images.length === 0) {
      return res.status(400).json({ error: '请至少上传一张图片' });
    }

    validateGenerationInput(provider, apiKey, images, prompt);
    const providerConfig = PROVIDERS[provider];
    const baseUrl = (endpoint || providerConfig.defaultEndpoint).replace(/\/$/, '');
    await parseSafeExternalUrl(baseUrl);
    const modelId = model || providerConfig.defaultModel;

    let result;

    if (provider === 'volcengine' || provider === 'custom') {
      // 火山引擎 Seed3D 格式（兼容 OpenAI 风格的 tasks API）
      const content = images.map((img) => ({
        type: 'image_url',
        image_url: { url: img },
      }));
      if (prompt) {
        content.unshift({ type: 'text', text: prompt });
      }

      result = await makeRequest(
        'POST',
        `${baseUrl}/api/v3/contents/generations/tasks`,
        { Authorization: `Bearer ${apiKey}` },
        { model: modelId, content }
      );
    } else if (provider === 'tripo') {
      // Tripo3D API
      result = await makeRequest(
        'POST',
        `${baseUrl}/v2/openapi/task`,
        { Authorization: `Bearer ${apiKey}` },
        {
          type: 'image_to_model',
          file: images[0],
          model_version: modelId,
          ...(prompt ? { prompt } : {}),
        }
      );
    } else if (provider === 'meshy') {
      // Meshy API
      result = await makeRequest(
        'POST',
        `${baseUrl}/openapi/v1/image-to-3d`,
        { Authorization: `Bearer ${apiKey}` },
        {
          image_url: images[0],
          should_remesh: true,
          ...(prompt ? { prompt } : {}),
        }
      );
    }

    if (result.status >= 400) {
      return res.status(result.status).json({
        error: `API 返回错误 (${result.status})`,
        details: result.data || result.raw,
      });
    }

    // 统一返回格式：{ taskId, provider, raw }
    const taskId = result.data?.id || result.data?.task_id || result.data?.result?.task_id;
    res.json({
      success: true,
      taskId,
      provider,
      raw: result.data,
    });
  } catch (err) {
    console.error('[3D Generate] 错误:', err.message);
    const status = err instanceof RequestValidationError ? 400 : 502;
    res.status(status).json({ error: status === 400 ? err.message : '上游服务暂时不可用', details: err.message });
  }
});

// ============================================================
// POST /api/3d/task - 查询任务状态
// ============================================================
// body: { provider, endpoint, apiKey, taskId }
app.post('/api/3d/task', async (req, res) => {
  try {
    const { provider = 'volcengine', endpoint, apiKey, taskId } = req.body;

    if (typeof apiKey !== 'string' || apiKey.length === 0 || apiKey.length > 2048 ||
        typeof taskId !== 'string' || taskId.length === 0 || taskId.length > 512) {
      return res.status(400).json({ error: '缺少 apiKey 或 taskId' });
    }

    if (!Object.hasOwn(PROVIDERS, provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }
    const providerConfig = PROVIDERS[provider];
    const baseUrl = (endpoint || providerConfig.defaultEndpoint).replace(/\/$/, '');
    await parseSafeExternalUrl(baseUrl);

    let result;

    if (provider === 'volcengine' || provider === 'custom') {
      result = await makeRequest(
        'GET',
        `${baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`,
        { Authorization: `Bearer ${apiKey}` }
      );
    } else if (provider === 'tripo') {
      result = await makeRequest(
        'GET',
        `${baseUrl}/v2/openapi/task/${encodeURIComponent(taskId)}`,
        { Authorization: `Bearer ${apiKey}` }
      );
    } else if (provider === 'meshy') {
      result = await makeRequest(
        'GET',
        `${baseUrl}/openapi/v1/image-to-3d/${encodeURIComponent(taskId)}`,
        { Authorization: `Bearer ${apiKey}` }
      );
    }

    if (result.status >= 400) {
      return res.status(result.status).json({
        error: `API 返回错误 (${result.status})`,
        details: result.data || result.raw,
      });
    }

    // 统一状态映射
    const raw = result.data || {};
    let status = 'unknown';
    let modelUrl = null;
    let progress = 0;

    if (provider === 'volcengine' || provider === 'custom') {
      status = raw.status || 'unknown'; // queued / running / succeeded / failed
      if (status === 'succeeded') {
        modelUrl = raw.content?.[0]?.url || raw.model_url || raw.url || null;
      }
      progress = status === 'succeeded' ? 100 : (status === 'running' ? 50 : 10);
    } else if (provider === 'tripo') {
      status = raw.status || raw.data?.status || 'unknown';
      if (status === 'success' || status === 'succeeded') {
        modelUrl = raw.model?.url || raw.data?.model?.url || null;
        status = 'succeeded';
      }
      progress = status === 'succeeded' ? 100 : 30;
    } else if (provider === 'meshy') {
      status = raw.status || 'unknown';
      if (status === 'SUCCEEDED' || status === 'succeeded') {
        modelUrl = raw.model_urls?.glb || raw.model_url || null;
        status = 'succeeded';
      }
      progress = status === 'succeeded' ? 100 : 30;
    }

    res.json({
      success: true,
      taskId,
      status,
      progress,
      modelUrl,
      outputUrl: modelUrl,
      isCompleted: status === 'succeeded',
      isFailed: status === 'failed' || status === 'cancelled',
      raw,
    });
  } catch (err) {
    console.error('[3D Task] 错误:', err.message);
    const status = err instanceof RequestValidationError ? 400 : 502;
    res.status(status).json({ error: status === 400 ? err.message : '上游服务暂时不可用', details: err.message });
  }
});

// ============================================================
// GET /api/3d/download - 代理下载 3D 文件（规避 CORS）
// ============================================================
// query: { url }
app.get('/api/3d/download', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: '缺少 url 参数' });
  }

  let parsedUrl;
  try {
    parsedUrl = await parseSafeExternalUrl(url);
  } catch (e) {
    return res.status(400).json({ error: '无效的 URL' });
  }

  const lib = https;
  const options = {
    method: 'GET',
    hostname: parsedUrl.hostname,
    lookup: safeLookup,
    port: parsedUrl.port || 443,
    path: parsedUrl.pathname + parsedUrl.search,
    headers: { 'User-Agent': 'Aether-3D-Proxy/1.0' },
  };

  const proxyReq = lib.request(options, (proxyRes) => {
    const contentLength = Number(proxyRes.headers['content-length'] || 0);
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      proxyRes.resume();
      res.status(413).json({ error: 'Download exceeds the size limit' });
      return;
    }
    // 透传状态码和 Content-Type
    res.status(proxyRes.statusCode || 200);
    const contentType = proxyRes.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    let receivedBytes = 0;
    proxyRes.on('data', (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_DOWNLOAD_BYTES) {
        proxyReq.destroy(new Error('Download exceeds the size limit'));
        res.destroy();
      }
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(500).json({ error: '下载失败', details: err.message });
  });
  proxyReq.setTimeout(120000, () => { proxyReq.destroy(new Error('下载超时')); });
  proxyReq.end();
});

const httpServer = http.createServer(app);
installRealtimeService(app, httpServer);
// 本地编辑器控制桥（MCP / CLI）：仅 loopback + 一次性令牌。
const controlBridge = installControlBridge(app, { dataDir: process.env.CONTROL_DATA_DIR || path.resolve('./data'), port: PORT, deferDiscovery: true });

// Keep fallback handlers after every feature router, including realtime.
// Do not expose Express' default HTML 404/error pages in API deployments.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[server]', error?.message || error);
  return res.status(500).json({ error: 'Internal server error' });
});

// 启动
export { app, httpServer };
if (process.env.NODE_ENV !== 'test') {
httpServer.once('error', (error) => {
  console.error(`[server] Unable to listen on port ${PORT}: ${error.message}`);
  process.exitCode = 1;
});
httpServer.listen(PORT, () => {
  // 只有真正监听成功后才写控制令牌，避免失败启动覆盖运行中实例的令牌。
  controlBridge.writeDiscovery();
  console.log('');
  console.log('  ================================================');
  console.log('  鲸动交互平台 - AI 3D 生成代理服务器');
  console.log('  ================================================');
  console.log(`  本地地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log('  支持提供商: 火山引擎 Seed3D / Tripo3D / Meshy / 自定义端点');
  console.log('  ================================================');
  console.log('');
});
}
