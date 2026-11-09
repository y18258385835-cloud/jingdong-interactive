import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TERM_DURATIONS = Object.freeze({
  trial_1d: 1,
  trial_7d: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
});
const MIN_ADMIN_PASSWORD_LENGTH = 12;
const DEFAULT_FREE_EXPERIENCE_URL = 'https://www.capcut.cn/';
const DEFAULT_FREE_EXPERIENCE_CONTENT = Object.freeze({
  titleZh: '免费体验',
  descriptionZh: '本软件提供免费体验功能，具体使用说明与体验入口请点击下方按钮。',
  buttonZh: '查看免费体验',
  titleEn: 'Free Trial',
  descriptionEn: 'This software provides a free trial. Click the button below for instructions and access.',
  buttonEn: 'View Free Trial',
});

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function isNonEmptyString(value, max = 256) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function matchesSecret(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export class LicenseServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * File-backed license store for a single Node process. Deployments with multiple
 * app instances should replace this adapter with a shared database/Redis store.
 */
export class LicenseService {
  constructor(options = {}) {
    // Fail closed: 开发默认密钥只在显式开关打开且非生产环境时可用，
    // 避免打包分发后所有人都拿到同一把可签发卡密的密钥。
    const allowDevDefaults = process.env.AETHER_ALLOW_DEV_LICENSE === '1' && process.env.NODE_ENV !== 'production';
    this.secret = options.secret || process.env.LICENSE_SECRET || (allowDevDefaults ? 'local-development-license-secret' : '');
    this.adminPassword = options.adminPassword || process.env.LICENSE_ADMIN_PASSWORD || (allowDevDefaults ? 'local-development-admin-password' : '');
    this.dataPath = path.resolve(options.dataPath || process.env.LICENSE_DATA_PATH || './data/licenses.json');
    this.envPath = path.resolve(options.envPath || process.env.LICENSE_ENV_PATH || './.env');
    this.sessionTtlMs = Number(options.sessionTtlMs || process.env.LICENSE_ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000);
    this.licenseTokenTtlMs = Number(options.licenseTokenTtlMs || process.env.LICENSE_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
    this.exportTokenTtlMs = Number(options.exportTokenTtlMs || process.env.LICENSE_EXPORT_TOKEN_TTL_MS || 5 * 60 * 1000);
    // A URL alone is not an adapter. Keep this false until a real shared
    // database/Redis implementation is wired in, so multi-instance deploys
    // fail closed instead of silently losing license updates.
    this.sharedStoreConfigured = options.sharedStoreConfigured === true;
    if (process.env.NODE_ENV === 'production' && process.env.LICENSE_MULTI_INSTANCE === 'true' && !this.sharedStoreConfigured) {
      throw new Error('Multi-instance production licensing requires LICENSE_SHARED_STORE_URL');
    }
    this.adminSessions = new Map();
    this.data = { version: 1, licenses: [], notifications: [], settings: { freeExperienceUrl: DEFAULT_FREE_EXPERIENCE_URL } };
    this.load();
    if (!this.data.freeExports || typeof this.data.freeExports !== 'object') this.data.freeExports = { version: 1, devices: {} };
    if (!this.data.freeExports.devices || typeof this.data.freeExports.devices !== 'object') this.data.freeExports.devices = {};
    this.freeExportLimit = Math.max(1, Number(options.freeExportLimit || process.env.FREE_EXPORT_LIMIT || 3));
  }

  isConfigured() {
    return Boolean(this.secret && this.adminPassword);
  }

  /** The JSON adapter is intentionally single-process; expose this to health checks. */
  getFreeExperienceUrl() {
    const value = this.data.settings?.freeExperienceUrl;
    return isHttpUrl(value) ? value : DEFAULT_FREE_EXPERIENCE_URL;
  }

  getFreeExperienceConfig() {
    const settings = this.data.settings || {};
    return { url: this.getFreeExperienceUrl(), ...DEFAULT_FREE_EXPERIENCE_CONTENT, ...Object.fromEntries(Object.keys(DEFAULT_FREE_EXPERIENCE_CONTENT).map((key) => [key, isNonEmptyString(settings[key], key.startsWith('description') ? 1000 : 200) ? settings[key].trim() : DEFAULT_FREE_EXPERIENCE_CONTENT[key]])) };
  }

  setFreeExperienceUrl(url) {
    if (!isNonEmptyString(url, 2048) || !isHttpUrl(url)) {
      throw new LicenseServiceError('体验链接必须是 http 或 https 地址', 400);
    }
    this.data.settings = { ...(this.data.settings || {}), freeExperienceUrl: url.trim() };
    this.save();
    return { url: this.getFreeExperienceUrl(), updatedAt: Date.now() };
  }

  setFreeExperienceConfig(input = {}) {
    if (!isNonEmptyString(input.url, 2048) || !isHttpUrl(input.url)) {
      throw new LicenseServiceError('体验链接必须是 http 或 https 地址', 400);
    }
    const content = {};
    Object.keys(DEFAULT_FREE_EXPERIENCE_CONTENT).forEach((key) => {
      const max = key.startsWith('description') ? 1000 : 200;
      if (!isNonEmptyString(input[key], max)) throw new LicenseServiceError(`${key}不能为空且长度不能超过${max}字符`, 400);
      content[key] = input[key].trim();
    });
    this.data.settings = { ...(this.data.settings || {}), freeExperienceUrl: input.url.trim(), ...content };
    this.save();
    return { ...this.getFreeExperienceConfig(), updatedAt: Date.now() };
  }

  isSharedStoreConfigured() {
    return this.sharedStoreConfigured;
  }

  load() {
    if (!fs.existsSync(this.dataPath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
      if (!parsed || !Array.isArray(parsed.licenses)) throw new Error('Invalid license ledger');
      this.data = { version: 1, settings: { freeExperienceUrl: DEFAULT_FREE_EXPERIENCE_URL, ...DEFAULT_FREE_EXPERIENCE_CONTENT }, notifications: [], ...parsed, notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [], settings: { freeExperienceUrl: DEFAULT_FREE_EXPERIENCE_URL, ...DEFAULT_FREE_EXPERIENCE_CONTENT, ...(parsed.settings || {}) } };
    } catch (error) {
      throw new Error(`Unable to load license ledger: ${error.message}`);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
    const temporaryPath = `${this.dataPath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, this.dataPath);
  }

  hmac(value) {
    return crypto.createHmac('sha256', this.secret).update(value).digest('hex');
  }

  normalizeCode(code) {
    if (!isNonEmptyString(code, 128)) throw new LicenseServiceError('请输入有效兑换码');
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  codeHash(code) {
    return this.hmac(`code:${this.normalizeCode(code)}`);
  }

  deviceHash(deviceId) {
    if (!isNonEmptyString(deviceId, 256) || deviceId.length < 8) throw new LicenseServiceError('设备标识无效');
    return this.hmac(`device:${deviceId}`);
  }

  createCode() {
    const groups = [];
    for (let group = 0; group < 4; group += 1) {
      let fragment = '';
      const bytes = crypto.randomBytes(4);
      for (const byte of bytes) fragment += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      groups.push(fragment);
    }
    return `AETHER-${groups.join('-')}`;
  }

  generate({ count, durationDays = 30, termCode, plan = 'pro', deviceLimit = 1 }) {
    if (!Number.isInteger(count) || count < 1 || count > 10000) throw new LicenseServiceError('生成数量必须在 1 到 10000 之间');
    if (termCode !== undefined && (!Object.hasOwn(TERM_DURATIONS, termCode))) throw new LicenseServiceError('不支持的授权档位');
    const resolvedDurationDays = termCode ? TERM_DURATIONS[termCode] : durationDays;
    if (!Number.isInteger(resolvedDurationDays) || resolvedDurationDays < 1 || resolvedDurationDays > 3650) throw new LicenseServiceError('授权天数必须在 1 到 3650 之间');
    if (!['pro', 'team'].includes(plan)) throw new LicenseServiceError('不支持的套餐');
    if (!Number.isInteger(deviceLimit) || deviceLimit < 1 || deviceLimit > 20) throw new LicenseServiceError('设备数必须在 1 到 20 之间');

    const batchId = `batch_${crypto.randomUUID()}`;
    const createdAt = Date.now();
    const codes = [];
    for (let index = 0; index < count; index += 1) {
      let code = this.createCode();
      while (this.findByCodeHash(this.codeHash(code))) code = this.createCode();
      const id = `lic_${crypto.randomUUID()}`;
      this.data.licenses.push({
        id,
        codeHash: this.codeHash(code),
        batchId,
        plan,
        durationDays: resolvedDurationDays,
        termCode: termCode || null,
        deviceLimit,
        status: 'active',
        createdAt,
        redeemedAt: null,
        expiresAt: null,
        devices: [],
        revokedAt: null,
        exportCount: 0,
        lastExportAt: null,
        exportReceipts: [],
      });
      codes.push({ id, code, plan, durationDays: resolvedDurationDays, termCode: termCode || null, deviceLimit, batchId });
    }
    this.save();
    return { batchId, createdAt, codes };
  }

  findByCodeHash(codeHash) {
    return this.data.licenses.find((license) => license.codeHash === codeHash);
  }

  findById(id) {
    return this.data.licenses.find((license) => license.id === id);
  }

  isLicenseUsable(license, now = Date.now()) {
    if (!license || license.status === 'revoked') return false;
    if (!license.redeemedAt || !license.expiresAt) return false;
    if (now >= license.expiresAt) {
      if (license.status !== 'expired') {
        license.status = 'expired';
        this.save();
      }
      return false;
    }
    return license.status === 'active' || license.status === 'redeemed';
  }

  addDevice(license, deviceHash) {
    const devices = Array.isArray(license.devices) ? license.devices : [];
    if (devices.some((entry) => entry.hash === deviceHash)) return;
    if (devices.length >= license.deviceLimit) throw new LicenseServiceError('该兑换码已绑定其他设备', 409);
    devices.push({ hash: deviceHash, boundAt: Date.now(), lastSeenAt: Date.now(), tokenVersion: 1 });
    license.devices = devices;
  }

  redeem({ licenseKey, deviceId }) {
    if (!this.secret) throw new LicenseServiceError('授权服务未配置', 503);
    const license = this.findByCodeHash(this.codeHash(licenseKey));
    if (!license) throw new LicenseServiceError('兑换码无效或不存在', 404);
    if (license.status === 'revoked') throw new LicenseServiceError('兑换码已被撤销', 403);
    const deviceHash = this.deviceHash(deviceId);
    const now = Date.now();
    if (!license.redeemedAt) {
      license.redeemedAt = now;
      license.expiresAt = now + license.durationDays * DAY_MS;
      license.status = 'redeemed';
    }
    if (!this.isLicenseUsable(license, now)) throw new LicenseServiceError('兑换码已过期', 403);
    this.addDevice(license, deviceHash);
    const device = license.devices.find((entry) => entry.hash === deviceHash);
    device.lastSeenAt = now;
    this.save();
    return { token: this.issueToken(license, deviceHash, 'license'), license };
  }

  issueToken(license, deviceHash, type, ttlMs) {
    // A browser may retain its license token until the redemption itself expires.
    // Every request still consults the ledger, so revocation is effective immediately.
    const now = Date.now();
    const configuredTtlMs = ttlMs ?? (type === 'license' ? this.licenseTokenTtlMs : this.exportTokenTtlMs);
    const effectiveTtlMs = Math.max(1, Math.min(configuredTtlMs, license.expiresAt - now));
    const device = license.devices?.find((entry) => entry.hash === deviceHash);
    const payload = {
      v: 1,
      iss: 'aether-license-service',
      aud: 'aether-editor',
      iat: now,
      type,
      licenseId: license.id,
      deviceHash,
      ver: Number.isInteger(device?.tokenVersion) ? device.tokenVersion : 1,
      exp: now + effectiveTtlMs,
      nonce: crypto.randomBytes(12).toString('hex'),
    };
    const encoded = toBase64Url(JSON.stringify(payload));
    return `${encoded}.${this.hmac(`token:${encoded}`)}`;
  }

  readToken(token, expectedType = 'license', expectedDeviceId) {
    if (typeof token !== 'string' || token.length > 4096) throw new LicenseServiceError('未登录或授权令牌无效', 401);
    const [encoded, signature, ...rest] = token.split('.');
    if (!encoded || !signature || rest.length || !this.secret) throw new LicenseServiceError('未登录或授权令牌无效', 401);
    const expected = this.hmac(`token:${encoded}`);
    const actualBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) throw new LicenseServiceError('未登录或授权令牌无效', 401);
    let payload;
    try { payload = fromBase64Url(encoded); } catch { throw new LicenseServiceError('未登录或授权令牌无效', 401); }
    const legacyToken = payload && payload.iss === undefined && payload.aud === undefined && payload.iat === undefined && payload.ver === undefined;
    const validEnvelope = legacyToken
      ? payload.v === 1
      : payload.v === 1 && payload.iss === 'aether-license-service' && payload.aud === 'aether-editor' && Number.isFinite(payload.iat) && payload.iat <= Date.now() + 30_000;
    if (!payload || !validEnvelope || payload.type !== expectedType || typeof payload.licenseId !== 'string' || typeof payload.deviceHash !== 'string' || !Number.isFinite(payload.exp) || (Number.isFinite(payload.iat) && payload.exp <= payload.iat) || Date.now() >= payload.exp) {
      throw new LicenseServiceError('授权令牌已过期', 401);
    }
    const license = this.findById(payload.licenseId);
    const device = license?.devices?.find((entry) => entry.hash === payload.deviceHash);
    if (!this.isLicenseUsable(license) || !device) {
      throw new LicenseServiceError('授权已失效', 403);
    }
    if (Number.isInteger(device.tokenVersion) && device.tokenVersion !== (Number.isInteger(payload.ver) ? payload.ver : 1)) {
      throw new LicenseServiceError('授权设备已失效', 403);
    }
    if (expectedDeviceId !== undefined && this.deviceHash(expectedDeviceId) !== payload.deviceHash) throw new LicenseServiceError('设备与授权不匹配', 403);
    return { payload, license, device };
  }

  publicLicense(license, deviceHash) {
    return {
      userId: license.id,
      plan: license.plan,
      status: 'active',
      billingCycle: 'monthly',
      expiresAt: license.expiresAt,
      trialEndsAt: null,
      features: undefined,
      quotas: undefined,
      signature: this.hmac(`license:${license.id}:${license.plan}:${license.expiresAt}:${deviceHash}`),
    };
  }

  verifyLicenseToken(token, options = {}) {
    const { payload, license, device } = this.readToken(token, 'license', options.deviceId);
    device.lastSeenAt = Date.now();
    let nextToken;
    if (options.rotate) {
      device.tokenVersion = (Number.isInteger(device.tokenVersion) ? device.tokenVersion : 1) + 1;
      nextToken = this.issueToken(license, payload.deviceHash, 'license');
    }
    this.save();
    const response = this.publicLicense(license, payload.deviceHash);
    return { license, deviceHash: payload.deviceHash, response, token: nextToken };
  }

  invalidateToken(token, deviceId) {
    const { license, device } = this.readToken(token, 'license', deviceId);
    device.tokenVersion = (Number.isInteger(device.tokenVersion) ? device.tokenVersion : 1) + 1;
    device.lastSeenAt = Date.now();
    this.save();
    return { licenseId: license.id, deviceHash: device.hash };
  }

  authorizeExport(token, format, deviceId) {
    if (!['zip', 'single-html', 'json', 'image', 'video', 'html'].includes(format)) throw new LicenseServiceError('不支持的导出格式');
    const { payload, license } = this.readToken(token, 'license', deviceId);
    const issuedAt = Date.now();
    const proof = {
      version: 1,
      exportId: `exp_${crypto.randomUUID()}`,
      licenseRef: this.hmac(`export-ref:${license.id}`).slice(0, 20),
      issuedAt,
      format,
    };
    proof.signature = this.hmac(`export-proof:${proof.exportId}:${proof.licenseRef}:${proof.issuedAt}:${proof.format}`);
    license.exportCount = (license.exportCount || 0) + 1;
    license.lastExportAt = issuedAt;
    const receipts = Array.isArray(license.exportReceipts) ? license.exportReceipts : [];
    receipts.push(proof);
    license.exportReceipts = receipts.slice(-500);
    this.save();
    return {
      exportToken: this.issueToken(license, payload.deviceHash, 'export', this.exportTokenTtlMs),
      expiresAt: Math.min(Date.now() + this.exportTokenTtlMs, license.expiresAt),
      proof,
    };
  }

  /**
   * 免费档导出：没有卡密也允许导出，但强制水印、锁 1080p。
   * 与官网授权服务（website/server.js）保持同一策略。
   */
  authorizeFreeExport(format, deviceId, fingerprint) {
    if (!['zip', 'single-html', 'json', 'image', 'video', 'html'].includes(format)) throw new LicenseServiceError('不支持的导出格式');
    const deviceHash = this.deviceHash(deviceId);
    // JSON 是工程备份，不占用免费额度。
    const consumesQuota = format !== 'json';
    const quota = this.freeExportQuota(deviceId, fingerprint);
    if (consumesQuota && quota.remaining <= 0) {
      throw new LicenseServiceError(`免费导出次数已用完（${quota.used}/${quota.limit}），请输入授权码升级专业版`, 403);
    }
    const issuedAt = Date.now();
    const expiresAt = issuedAt + this.exportTokenTtlMs;
    const licenseRef = `free-${this.hmac(`free:${deviceHash}`).slice(0, 20)}`;
    const proof = {
      version: 1,
      exportId: `exp_${crypto.randomUUID()}`,
      licenseRef,
      issuedAt,
      format,
    };
    proof.signature = this.hmac(`export-proof:${proof.exportId}:${proof.licenseRef}:${proof.issuedAt}:${proof.format}`);
    const synthetic = { id: licenseRef, plan: 'free', expiresAt, devices: [{ hash: deviceHash, tokenVersion: 1 }] };
    if (consumesQuota) {
      const bump = (key) => {
        const record = this.data.freeExports.devices[key] || { count: 0, firstAt: issuedAt };
        record.count += 1;
        record.lastAt = issuedAt;
        record.lastFormat = format;
        this.data.freeExports.devices[key] = record;
      };
      bump(deviceHash);
      // 同时按设备指纹记账：清空 localStorage 换一个 deviceId 也无法重置额度。
      const fpKey = this.fingerprintKey(fingerprint);
      if (fpKey) bump(fpKey);
      this.save();
    }
    return {
      exportToken: this.issueToken(synthetic, deviceHash, 'export', this.exportTokenTtlMs),
      expiresAt,
      plan: 'free',
      watermarkRequired: true,
      maxResolution: '1080p',
      freeExports: this.freeExportQuota(deviceId, fingerprint),
      proof,
    };
  }

  /** 设备指纹键（弱指纹，仅用于防止「清缓存重置额度」）。 */
  fingerprintKey(fingerprint) {
    if (!isNonEmptyString(fingerprint, 200)) return null;
    return `fp-${this.hmac(`fp:${fingerprint}`).slice(0, 20)}`;
  }

  /** 免费导出额度（设备哈希 + 设备指纹取较大者，永久累计）。 */
  freeExportQuota(deviceId, fingerprint) {
    const deviceHash = this.deviceHash(deviceId);
    const fpKey = this.fingerprintKey(fingerprint);
    const used = Math.max(
      Number(this.data.freeExports?.devices?.[deviceHash]?.count || 0),
      fpKey ? Number(this.data.freeExports?.devices?.[fpKey]?.count || 0) : 0,
    );
    const limit = this.freeExportLimit;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  loginAdmin(password) {
    if (!this.isConfigured()) throw new LicenseServiceError('后台未配置管理员密码或授权密钥', 503);
    if (!isNonEmptyString(password, 1024)) throw new LicenseServiceError('账号或密码错误', 401);
    if (!matchesSecret(password, this.adminPassword)) throw new LicenseServiceError('账号或密码错误', 401);
    const token = crypto.randomBytes(32).toString('base64url');
    this.adminSessions.set(token, Date.now() + this.sessionTtlMs);
    return { token, expiresAt: Date.now() + this.sessionTtlMs };
  }

  persistAdminPassword(password) {
    const lines = fs.existsSync(this.envPath) ? fs.readFileSync(this.envPath, 'utf8').split(/\r?\n/) : [];
    const replacement = `LICENSE_ADMIN_PASSWORD=${JSON.stringify(password)}`;
    let replaced = false;
    const nextLines = lines.map((line) => {
      if (/^\s*LICENSE_ADMIN_PASSWORD\s*=/.test(line)) {
        replaced = true;
        return replacement;
      }
      return line;
    });
    if (!replaced) nextLines.push(replacement);
    const nextContents = `${nextLines.join('\n').replace(/\n+$/, '')}\n`;
    const temporaryPath = `${this.envPath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.mkdirSync(path.dirname(this.envPath), { recursive: true });
    try {
      fs.writeFileSync(temporaryPath, nextContents, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temporaryPath, this.envPath);
    } catch (error) {
      // Windows can reject rename-overwrite while .env is observed by another
      // process. A direct replacement remains safe enough for this small file.
      try {
        fs.writeFileSync(this.envPath, nextContents, { encoding: 'utf8', mode: 0o600 });
      } catch {
        throw new LicenseServiceError('无法保存新密码，请检查 .env 文件是否可写', 409);
      } finally {
        try { fs.unlinkSync(temporaryPath); } catch {}
      }
    }
  }

  changeAdminPassword(currentPassword, nextPassword) {
    if (!this.isConfigured()) throw new LicenseServiceError('后台未配置管理员密码或授权密钥', 503);
    if (!isNonEmptyString(currentPassword, 1024) || !matchesSecret(currentPassword, this.adminPassword)) {
      throw new LicenseServiceError('当前密码错误', 401);
    }
    if (!isNonEmptyString(nextPassword, 256) || nextPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      throw new LicenseServiceError(`新密码至少需要 ${MIN_ADMIN_PASSWORD_LENGTH} 个字符`, 400);
    }
    if (nextPassword === currentPassword) throw new LicenseServiceError('新密码不能与当前密码相同', 400);
    this.persistAdminPassword(nextPassword);
    this.adminPassword = nextPassword;
    process.env.LICENSE_ADMIN_PASSWORD = nextPassword;
    this.adminSessions.clear();
    return { changedAt: Date.now() };
  }

  verifyAdmin(token) {
    const expiresAt = this.adminSessions.get(token);
    if (!expiresAt || Date.now() >= expiresAt) {
      this.adminSessions.delete(token);
      throw new LicenseServiceError('管理员会话已过期', 401);
    }
  }

  list() {
    const now = Date.now();
    let changed = false;
    const licenses = this.data.licenses.map((license) => {
      if (license.redeemedAt && license.expiresAt && now >= license.expiresAt && license.status !== 'revoked' && license.status !== 'expired') {
        license.status = 'expired';
        changed = true;
      }
      return {
        id: license.id,
        batchId: license.batchId,
        plan: license.plan,
        durationDays: license.durationDays,
        termCode: license.termCode || null,
        deviceLimit: license.deviceLimit,
        status: license.status,
        createdAt: license.createdAt,
        redeemedAt: license.redeemedAt,
        expiresAt: license.expiresAt,
        deviceCount: license.devices?.length || 0,
        exportCount: license.exportCount || 0,
        lastExportAt: license.lastExportAt,
        revokedAt: license.revokedAt,
      };
    });
    if (changed) this.save();
    return licenses.sort((a, b) => b.createdAt - a.createdAt);
  }

  revoke(id) {
    const license = this.findById(id);
    if (!license) throw new LicenseServiceError('兑换码不存在', 404);
    license.status = 'revoked';
    license.revokedAt = Date.now();
    this.save();
    return this.list().find((item) => item.id === id);
  }

  summary() {
    const licenses = this.list();
    return {
      total: licenses.length,
      available: licenses.filter((item) => item.status === 'active' && !item.redeemedAt).length,
      redeemed: licenses.filter((item) => item.redeemedAt && item.status !== 'revoked' && item.status !== 'expired').length,
      expired: licenses.filter((item) => item.status === 'expired').length,
      revoked: licenses.filter((item) => item.status === 'revoked').length,
      exports: licenses.reduce((sum, item) => sum + item.exportCount, 0),
    };
  }

  normalizeNotificationInput(input = {}, partial = false) {
    const fields = ['titleZh', 'titleEn', 'bodyZh', 'bodyEn'];
    const result = {};
    fields.forEach((field) => {
      if (partial && input[field] === undefined) return;
      const value = input[field];
      const max = field.startsWith('body') ? 5000 : 200;
      if (!isNonEmptyString(value, max)) throw new LicenseServiceError(`${field}不能为空且长度不能超过${max}字符`, 400);
      result[field] = value.trim();
    });
    if (!partial && fields.some((field) => result[field] === undefined)) throw new LicenseServiceError('通知需要完整的中英文标题和正文', 400);
    return result;
  }

  listNotifications() {
    return [...this.data.notifications].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  listPublishedNotifications() {
    return this.listNotifications()
      .filter((item) => item.status === 'published')
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
      .map(({ id, titleZh, titleEn, bodyZh, bodyEn, publishedAt, updatedAt }) => ({ id, titleZh, titleEn, bodyZh, bodyEn, publishedAt, updatedAt }));
  }

  createNotification(input) {
    const now = Date.now();
    const notification = { id: `notice_${crypto.randomUUID()}`, ...this.normalizeNotificationInput(input), status: 'draft', createdAt: now, updatedAt: now, publishedAt: null, withdrawnAt: null };
    this.data.notifications.push(notification);
    this.save();
    return notification;
  }

  updateNotification(id, input) {
    const item = this.data.notifications.find((entry) => entry.id === id);
    if (!item) throw new LicenseServiceError('通知不存在', 404);
    Object.assign(item, this.normalizeNotificationInput(input, true), { updatedAt: Date.now() });
    this.save();
    return item;
  }

  publishNotification(id) {
    const item = this.data.notifications.find((entry) => entry.id === id);
    if (!item) throw new LicenseServiceError('通知不存在', 404);
    item.status = 'published'; item.publishedAt = Date.now(); item.withdrawnAt = null; item.updatedAt = item.publishedAt;
    this.save();
    return item;
  }

  withdrawNotification(id) {
    const item = this.data.notifications.find((entry) => entry.id === id);
    if (!item) throw new LicenseServiceError('通知不存在', 404);
    item.status = 'withdrawn'; item.withdrawnAt = Date.now(); item.updatedAt = item.withdrawnAt;
    this.save();
    return item;
  }

  deleteNotification(id) {
    const index = this.data.notifications.findIndex((entry) => entry.id === id);
    if (index === -1) throw new LicenseServiceError('通知不存在', 404);
    this.data.notifications.splice(index, 1);
    this.save();
    return { id };
  }
}
