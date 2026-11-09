// -*- coding: utf-8 -*-
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';

const PORT = 3000;
const DATA_DIR = path.resolve('/opt/jd-server/data');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
const SITE_CONFIG_FILE = path.join(DATA_DIR, 'site-config.json');
const COMPANY_CONFIG_FILE = path.join(DATA_DIR, 'company-config.json');
const ADMIN_CONFIG_FILE = path.join(DATA_DIR, 'admin.json');
const APP_SETTINGS_FILE = path.join(DATA_DIR, 'app-settings.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const FREE_EXPORTS_FILE = path.join(DATA_DIR, 'free-exports.json');
const FREE_EXPORT_LIMIT = Math.max(1, Number(process.env.FREE_EXPORT_LIMIT || 3));
const UPLOAD_DIR = path.resolve('/var/www/uploads');
if (!fs.existsSync(UPLOAD_DIR)) { try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) {} }

// 授权签名密钥只能来自环境变量。缺失时授权接口整体关闭（站点照常访问），
// 避免把密钥写进仓库、或用一个公开默认值给所有部署签发令牌。
const SECRET = process.env.LICENSE_SECRET || '';
const LICENSE_ENABLED = SECRET.length >= 32;
if (!LICENSE_ENABLED) {
  console.error('[aether] LICENSE_SECRET 未配置或过短（至少 32 位）：授权/兑换/导出接口已禁用，仅提供站点内容。');
}

// Ensure data dir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const safeEqualHex = (a, b) => {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// 1. Admin Password Config
// 优先级：data/admin.json（已改过的密码）> ADMIN_PASSWORD_HASH > ADMIN_PASSWORD。
// 三者都没有时不生成任何默认口令，管理员登录直接返回 503。
let adminConfig = { passwordHash: '' };
if (fs.existsSync(ADMIN_CONFIG_FILE)) {
  try { adminConfig = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8')); } catch (e) { adminConfig = { passwordHash: '' }; }
} else if (process.env.ADMIN_PASSWORD_HASH) {
  adminConfig = { passwordHash: String(process.env.ADMIN_PASSWORD_HASH).trim() };
  fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(adminConfig, null, 2), 'utf8');
} else if (process.env.ADMIN_PASSWORD) {
  adminConfig = { passwordHash: sha256(process.env.ADMIN_PASSWORD) };
  fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(adminConfig, null, 2), 'utf8');
} else {
  console.error('[aether] 未配置管理员口令（ADMIN_PASSWORD / ADMIN_PASSWORD_HASH）：管理后台登录已禁用。');
}
const ADMIN_ENABLED = Boolean(adminConfig.passwordHash);

// 免费导出额度：按设备哈希永久累计，单独存一个文件，避免污染卡密账本。
let freeExports = { version: 1, devices: {} };
try {
  if (fs.existsSync(FREE_EXPORTS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(FREE_EXPORTS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.devices) freeExports = { version: 1, devices: parsed.devices };
  }
} catch (error) {
  console.error('[aether] free-exports.json 读取失败，已重置:', error.message);
}

function saveFreeExports() {
  try {
    fs.writeFileSync(FREE_EXPORTS_FILE, JSON.stringify(freeExports, null, 2), 'utf8');
  } catch (error) {
    console.error('[aether] free-exports.json 写入失败:', error.message);
  }
}

function fingerprintKey(fingerprint) {
  if (!fingerprint || typeof fingerprint !== 'string') return null;
  return `fp-${sha256(fingerprint).slice(0, 24)}`;
}

function freeExportQuota(deviceHash, fpKey) {
  const used = Math.max(
    Number(freeExports.devices[deviceHash]?.count || 0),
    fpKey ? Number(freeExports.devices[fpKey]?.count || 0) : 0,
  );
  return { used, limit: FREE_EXPORT_LIMIT, remaining: Math.max(0, FREE_EXPORT_LIMIT - used) };
}

// Active Sessions map
const activeSessions = new Map(); // token -> timestamp

// 2. Default Software Site Config (jd-hub.top)
const defaultSiteConfig = {
  brandName: "鲸动文化传媒",
  brandSub: "Jingdong Media & Interaction",
  logoUrl: "",
  heroBadge: "⚡ 面向新一代智能多媒体 · 微软应用商店生态伙伴",
  heroTitle: "构建沉浸式多感官体验",
  heroHighlight: "鲸动交互平台",
  heroDesc: "鲸动文化传媒自主研发的高性能数字交互中枢。为展览展厅、舞台演艺、数字多媒体与商业空间提供强大的硬件融合、多通道交互与云端授权支撑。",
  msStoreUrl: "https://apps.microsoft.com/",
  msStoreBtnText: "从 Microsoft Store 获取",
  heroImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
  contactEmail: "contact@jd-hub.top",
  seoTitle: "鲸动交互平台 - 官方网站 | 鲸动文化传媒",
  seoKeywords: "鲸动交互平台,鲸动文化传媒,交互软件,展厅多媒体,微软应用商店,雷达互动,大屏融合,多通道中控,一机一码",
  seoDescription: "鲸动文化传媒旗下核心产品——鲸动交互平台，专为创意多媒体、展馆展厅、商业互动与舞台多媒体设计的高性能数字交互中枢。已全面接入微软应用商店生态。",
  ogImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
  baiduToken: "",
  googleToken: "",
  features: [
    { title: "多通道雷达融合", desc: "毫秒级激光雷达点云滤波与触控热区识别，精准响应多人同时互动。" },
    { title: "超高清多屏渲染", desc: "支持 8K+ 超大分辨率硬件消隐与拼接融合，画面无缝平滑过渡。" },
    { title: "企业级安全加密", desc: "内置硬件指纹离线校验与双向通信鉴权，满足商用展览长期稳定运行。" },
    { title: "多协议中控联动", desc: "原生集成 ArtNet、DMX512、OSC、UDP 与串口控制，轻松掌控全场声光电设备。" }
  ],
  aboutTitle: "关于鲸动文化传媒",
  aboutDesc: "我们致力于通过前沿数字科技与创意视觉的深度融合，为客户创造极具沉浸感与震撼力的多维交互体验。从底层软件开发到整体交互策划，提供端到端的技术保障。",
  news: [
    {
      id: "news-1",
      date: "2026年10月25日",
      category: "官方发布",
      title: "鲸动交互平台正式开启微软应用商店 (Microsoft Store) 上架筹备",
      summary: "为进一步拓展全球数字化与 Windows 生态应用场景，鲸动交互平台全面启动商店沙箱规范改造与企业开发者签名认证工作。"
    },
    {
      id: "news-2",
      date: "2026年10月18日",
      category: "产品升级",
      title: "鲸动交互平台 v2.6.4 正式版推送：新增离线加密算法与多屏融合引擎",
      summary: "本次升级重点增强了超大分辨率投影融合的物理边缘消隐算法，并优化了一机一码注册机制，设备兼容性提升 40%。"
    },
    {
      id: "news-3",
      date: "2026年10月10日",
      category: "商业合作",
      title: "鲸动文化传媒携手多家文旅展陈总包商，共建智能交互标杆展馆",
      summary: "通过鲸动交互平台为核心展陈项目提供沉浸式雷达互动与飞屏交互技术支持，现场运行稳定可靠，获客户高度赞誉。"
    }
  ]
};

let siteConfig = defaultSiteConfig;
if (fs.existsSync(SITE_CONFIG_FILE)) {
  try { siteConfig = { ...defaultSiteConfig, ...JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, 'utf8')) }; } catch (e) {}
} else {
  fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(siteConfig, null, 2), 'utf8');
}

// 3. Default Company Config (www.jd-hub.top)
const defaultCompanyConfig = {
  brandName: "浙江鲸动文化传媒有限公司",
  brandSub: "Zhejiang Jingdong Media & Cultural Communication Co., Ltd.",
  logoUrl: "",
  qrCodeUrl: "/assets/contact-qrcode.jpg",
  heroBadge: "⚡ 数字科技 × 商业传媒 · 浙江先锋文化科技企业",
  heroTitle: "用全域内容连接商业价值<br>以<span>数字科技重构空间体验</span>",
  heroDesc: "浙江鲸动文化传媒有限公司，立足浙江创新沃土，专注于短视频全域运营、创始人商业 IP 打造、GEO 生成式 AI 优化、高端官网小程序建设、品牌宣传片制作，以及依托自研软硬件的展厅多媒体交互一体化落地。",
  contactAddr: "浙江省杭州市（浙江鲸动文化传媒有限公司总部）",
  contactEmail: "contact@jd-hub.top",
  contactPhone: "详询商务顾问 / 官方邮箱即时响应",
  aboutText: "浙江鲸动文化传媒有限公司总部位于浙江。我们不仅是一家拥有敏锐市场触觉与创意美学的文化传媒公司，更是一家手握自主知识产权与核心软件引擎的科技型企业。",
  aboutImg: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80",
  seoTitle: "浙江鲸动文化传媒有限公司 · 官方网站 | 短视频运营 · 创始人IP · GEO优化 · 展厅交互设计",
  seoKeywords: "浙江鲸动文化传媒有限公司,短视频运营,创始人IP打造,GEO优化,官网小程序建设,宣传片制作,展厅交互设计,鲸动交互平台",
  seoDesc: "浙江鲸动文化传媒有限公司专注于短视频全域代运营、创始人商业IP打造、GEO生成式AI优化、高端官网小程序定制、商业宣传片拍摄制作及数字展厅声光电交互设计。"
};

let companyConfig = defaultCompanyConfig;
if (fs.existsSync(COMPANY_CONFIG_FILE)) {
  try { companyConfig = { ...defaultCompanyConfig, ...JSON.parse(fs.readFileSync(COMPANY_CONFIG_FILE, 'utf8')) }; } catch (e) {}
} else {
  fs.writeFileSync(COMPANY_CONFIG_FILE, JSON.stringify(companyConfig, null, 2), 'utf8');
}

// 4. Free Experience Settings (for Software Client)
let appSettings = {
  url: "https://jd-hub.top/",
  titleZh: "免费体验",
  descriptionZh: "鲸动交互平台提供免费体验功能，具体使用说明与体验入口请点击下方按钮。",
  buttonZh: "查看免费体验",
  titleEn: "Free Trial",
  descriptionEn: "Jingdong Interaction Engine provides a free trial. Click below for instructions.",
  buttonEn: "View Free Trial"
};
if (fs.existsSync(APP_SETTINGS_FILE)) {
  try { appSettings = JSON.parse(fs.readFileSync(APP_SETTINGS_FILE, 'utf8')); } catch (e) {}
} else {
  fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(appSettings, null, 2), 'utf8');
}

// 5. Notifications Store
let notifications = [
  {
    id: "notif-1",
    titleZh: "欢迎使用鲸动交互平台",
    titleEn: "Welcome to Jingdong Interaction Engine",
    bodyZh: "欢迎体验新一代数字交互中枢！如有任何使用疑问，请联系技术支持。",
    bodyEn: "Welcome to the next-gen interaction engine! For questions, contact support.",
    status: "published",
    updatedAt: Date.now()
  }
];
if (fs.existsSync(NOTIFICATIONS_FILE)) {
  try { notifications = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8')); } catch (e) {}
} else {
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
}

// 6. Licenses Store (Native schema)
let licenses = [];
if (fs.existsSync(LICENSES_FILE)) {
  try { licenses = JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8')); } catch (e) {}
} else {
  licenses = [];
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf8');
}

const TERM_DAYS = {
  trial_1d: 1,
  trial_7d: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
  permanent: 3650
};

// Cryptographic helpers for Client Software
function hmac(value) {
  if (!LICENSE_ENABLED) throw new Error('license service disabled: LICENSE_SECRET missing');
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function issueToken(license, deviceHash, type = 'license', ttlMs = 12 * 3600 * 1000) {
  const now = Date.now();
  const effectiveTtlMs = Math.max(1, Math.min(ttlMs, (license.expiresAt || (now + 30 * 24 * 3600 * 1000)) - now));
  const payload = {
    v: 1,
    iss: 'aether-license-service',
    aud: 'aether-editor',
    iat: now,
    type,
    licenseId: license.id,
    deviceHash,
    ver: 1,
    exp: now + effectiveTtlMs,
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${hmac(`token:${encoded}`)}`;
}

// 授权档位矩阵：服务端是唯一事实源，客户端只用于界面提示。
const PLAN_FEATURES = {
  free: {
    project_export: true,
    export_no_watermark: false,
    export_4k: false,
    export_video: true,
    export_html: true,
    export_zip: true,
    batch_export: false,
    api_access: false,
  },
  pro: {
    project_export: true,
    export_no_watermark: true,
    export_4k: true,
    export_video: true,
    export_html: true,
    export_zip: true,
    batch_export: false,
    api_access: false,
  },
  team: {
    project_export: true,
    export_no_watermark: true,
    export_4k: true,
    export_video: true,
    export_html: true,
    export_zip: true,
    batch_export: true,
    api_access: true,
  },
};

const PLAN_QUOTAS = {
  free: { maxExportResolution: '1080p', maxVideoDurationMinutes: 5 },
  pro: { maxExportResolution: '4k', maxVideoDurationMinutes: 60 },
  team: { maxExportResolution: '4k', maxVideoDurationMinutes: 120 },
};

const RESOLUTION_ORDER = ['720p', '1080p', '2k', '4k'];

function planOf(license) {
  return license?.plan === 'team' ? 'team' : license?.plan === 'pro' ? 'pro' : 'free';
}

function isLicenseExpired(license) {
  return Boolean(license?.expiresAt) && Number(license.expiresAt) < Date.now();
}

function publicLicense(license, deviceHash) {
  const plan = license.plan === 'team' ? 'team' : license.plan === 'pro' ? 'pro' : 'free';
  return {
    userId: license.id,
    plan,
    status: 'active',
    billingCycle: 'monthly',
    expiresAt: license.expiresAt,
    trialEndsAt: null,
    features: PLAN_FEATURES[plan],
    quotas: PLAN_QUOTAS[plan],
    signature: hmac(`license:${license.id}:${license.plan}:${license.expiresAt}:${deviceHash}`),
  };
}

function readToken(token) {
  if (typeof token !== 'string') return null;
  const [encoded, signature, ...rest] = token.split('.');
  if (!encoded || !signature || rest.length) return null;
  const expected = hmac(`token:${encoded}`);
  if (signature !== expected) return null;
  try {
    const payload = fromBase64Url(encoded);
    if (!payload || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateLicenseCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `JDINT-${part(4)}-${part(4)}-${part(4)}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Aether-Device-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !activeSessions.has(token)) return false;
  const created = activeSessions.get(token);
  if (Date.now() - created > 24 * 3600 * 1000) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// SEO & GEO Files Generator
function getRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/

# Generative AI Search Crawlers (GEO / LLMs Friendly)
User-agent: GPTBot
Allow: /
Disallow: /admin/

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Bytespider
Allow: /

Sitemap: https://www.jd-hub.top/sitemap.xml
`;
}

function getLlmsTxt() {
  return `# 浙江鲸动文化传媒有限公司 & 鲸动交互平台 (Jingdong Media)

> 浙江先锋文化传媒与自研数字交互技术企业。业务涵盖全域短视频代运营、创始人商业IP打造、GEO生成式引擎优化、官网小程序建设、宣传片制作与展厅多媒体交互一体化总包。

## 企业与品牌概述 (About Us)
- **企业名称**：浙江鲸动文化传媒有限公司
- **英文标识**：Zhejiang Jingdong Media & Cultural Communication Co., Ltd.
- **企业官网**：https://www.jd-hub.top/
- **自研旗舰软件**：鲸动交互平台 (https://jd-hub.top/)
- **微软开发者认证**：Microsoft Store 生态伙伴

## 六大核心商业业务 (Core Business Matrix)
1. **短视频全域精细化运营**：抖音、快手、视频号全托管代运营、爆款剧本创作、精准算法推流、私域闭环转化。
2. **创始人 / 企业家商业 IP 打造**：深度商业定位、专访录制、人设包装、高端商业圈层连接与知识变现。
3. **GEO 生成式 AI 搜索优化 (Generative Engine Optimization)**：抢占 ChatGPT、Perplexity、Copilot、文心一言等生成式 AI 大模型搜索推荐与引用高地。
4. **高端品牌官网与小程序开发**：定制具备高级微动效与极速加载的响应式门户，微信与抖音生态小程序全端打通。
5. **企业级宣传片与商业影视制作**：4K/8K 电影级画质、企业 TVC 广告、三维工业 CG 动画、招商宣传片。
6. **展厅声光电多媒体交互软硬件总包**：基于自研底层图形引擎，提供激光雷达点云触控、多屏边缘消隐融合与 Art-Net/DMX512 中控联动。

## 自研软件核心参数 (Jingdong Interaction Engine)
- 支持系统：Windows 10, Windows 11 (微软应用商店分发)
- 响应延迟：< 3ms 硬件加速
- 授权机制：企业级一机一码离线指纹加密

## 商务联络 (Contact)
- 邮箱：contact@jd-hub.top
- 隐私合规：https://jd-hub.top/privacy.html
`;
}

function getSitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.jd-hub.top/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://jd-hub.top/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://jd-hub.top/privacy.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;
}

function updateSeoFiles() {
  try {
    ['/var/www/software', '/var/www/company'].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.writeFileSync(path.join(dir, 'robots.txt'), getRobotsTxt(), 'utf8');
        fs.writeFileSync(path.join(dir, 'sitemap.xml'), getSitemapXml(), 'utf8');
        fs.writeFileSync(path.join(dir, 'llms.txt'), getLlmsTxt(), 'utf8');
      }
    });
  } catch (e) {}
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 授权能力整体开关：缺少 LICENSE_SECRET 时只保留站点内容，
  // 所有授权、兑换、导出、后台写接口统一返回 503，绝不用默认密钥签发令牌。
  if (!LICENSE_ENABLED && (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/admin/licenses') || pathname.startsWith('/api/admin/free-experience'))) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: '授权服务未配置' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Aether-Device-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  try {
    // ----------------------------------------------------
    // Public SEO & Config APIs
    // ----------------------------------------------------
    // Public Uploads Static Serving
    if (pathname.startsWith('/uploads/')) {
      const filename = path.basename(pathname);
      const filePath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filename).toLowerCase();
        const mimeMap = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon'
        };
        res.writeHead(200, {
          'Content-Type': mimeMap[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=2592000'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(getRobotsTxt());
      return;
    }

    if (pathname === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(getSitemapXml());
      return;
    }

    if (pathname === '/llms.txt') {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(getLlmsTxt());
      return;
    }

    // Software Site Config (jd-hub.top)
    if (pathname === '/api/news' && req.method === 'GET') {
      sendJson(res, { news: siteConfig.news || [] });
      return;
    }

    if (pathname === '/api/site/config' && req.method === 'GET') {
      sendJson(res, siteConfig);
      return;
    }

    // Company Site Config (www.jd-hub.top)
    if (pathname === '/api/company/config' && req.method === 'GET') {
      sendJson(res, { ...companyConfig, news: siteConfig.news || [] });
      return;
    }

    // 客户端更新检查：运维把 app-update.json 放到 data 目录即可生效。
    if (pathname === '/api/public/app-update' && req.method === 'GET') {
      const updateFile = path.join(DATA_DIR, 'app-update.json');
      if (!fs.existsSync(updateFile)) {
        sendJson(res, { version: null });
        return;
      }
      try {
        const info = JSON.parse(fs.readFileSync(updateFile, 'utf8'));
        if (!info || typeof info.version !== 'string') {
          sendJson(res, { version: null });
          return;
        }
        sendJson(res, {
          version: info.version,
          url: typeof info.url === 'string' && isHttpUrl(info.url) ? info.url : 'https://jd-hub.top/',
          notes: typeof info.notes === 'string' ? info.notes.slice(0, 2000) : '',
          publishedAt: Number(info.publishedAt) || null,
          sha256: typeof info.sha256 === 'string' ? info.sha256 : null,
        });
      } catch (error) {
        sendJson(res, { error: '更新信息格式错误' }, 500);
      }
      return;
    }

    if ((pathname === '/api/free-experience-link' || pathname === '/api/public/free-experience-link') && req.method === 'GET') {
      sendJson(res, appSettings);
      return;
    }

    if ((pathname === '/api/notifications' || pathname === '/api/public/notifications') && req.method === 'GET') {
      const published = notifications.filter(n => n.status === 'published');
      sendJson(res, { notifications: published });
      return;
    }

    if (pathname === '/api/control/handshake' && req.method === 'GET') {
      sendJson(res, { active: false, token: null });
      return;
    }

    // ----------------------------------------------------
    // Admin Auth
    // ----------------------------------------------------
    if (pathname === '/api/admin/licenses/login' && req.method === 'POST') {
      if (!ADMIN_ENABLED) return sendJson(res, { error: '管理后台未配置口令，已禁用' }, 503);
      const { password } = await readJson(req);
      const hash = crypto.createHash('sha256').update(password || '').digest('hex');
      if (safeEqualHex(hash, adminConfig.passwordHash)) {
        const token = crypto.randomBytes(32).toString('hex');
        activeSessions.set(token, Date.now());
        sendJson(res, { success: true, token });
      } else {
        sendJson(res, { error: '管理员密码错误，请核对后重试' }, 401);
      }
      return;
    }

    if (pathname === '/api/admin/licenses/password' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录或会话已超时' }, 401);
      const { currentPassword, newPassword } = await readJson(req);
      const curHash = crypto.createHash('sha256').update(currentPassword || '').digest('hex');
      if (!safeEqualHex(curHash, adminConfig.passwordHash)) {
        return sendJson(res, { error: '当前密码不正确' }, 400);
      }
      if (!newPassword || newPassword.length < 12) {
        return sendJson(res, { error: '新密码长度至少需要 12 位' }, 400);
      }
      adminConfig.passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');
      fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify(adminConfig, null, 2), 'utf8');
      activeSessions.clear();
      sendJson(res, { success: true, message: '密码已修改，请使用新密码重新登录' });
      return;
    }

    // ----------------------------------------------------
    // Admin Licenses APIs (Native format)
    // ----------------------------------------------------
    if (pathname === '/api/admin/licenses/summary' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const total = licenses.length;
      const available = licenses.filter(l => l.status === 'available').length;
      const redeemed = licenses.filter(l => l.status === 'redeemed' || l.status === 'active').length;
      const expired = licenses.filter(l => l.status === 'expired').length;
      const revoked = licenses.filter(l => l.status === 'revoked').length;
      sendJson(res, { total, available, redeemed, expired, revoked });
      return;
    }

    if (pathname === '/api/admin/licenses' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      sendJson(res, { licenses });
      return;
    }

    if (pathname === '/api/admin/licenses/generate' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const { count = 1, plan = 'pro', termCode = 'monthly', deviceLimit = 1 } = await readJson(req);
      const batchId = `batch_${Date.now()}`;
      const durationDays = TERM_DAYS[termCode] || 30;
      const generated = [];

      for (let i = 0; i < count; i++) {
        const item = {
          id: "lic_" + crypto.randomUUID().slice(0, 8),
          code: generateLicenseCode(),
          batchId,
          plan,
          termCode,
          durationDays,
          deviceLimit: Math.max(1, Number(deviceLimit) || 1),
          deviceCount: 0,
          status: 'available',
          redeemedAt: null,
          expiresAt: null,
          exportCount: 0,
          devices: [],
          createdAt: Date.now()
        };
        licenses.unshift(item);
        generated.push(item);
      }

      fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf8');
      sendJson(res, { batchId, codes: generated });
      return;
    }

    if (pathname.startsWith('/api/admin/licenses/') && pathname.endsWith('/revoke') && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const licId = pathname.split('/')[4];
      const target = licenses.find(l => l.id === licId);
      if (target) {
        target.status = 'revoked';
        fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf8');
        sendJson(res, { success: true });
      } else {
        sendJson(res, { error: '未找到该卡密记录' }, 404);
      }
      return;
    }

    // ----------------------------------------------------
    // Admin Software Site Config (jd-hub.top)
    // ----------------------------------------------------
    if (pathname === '/api/admin/site/config' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const newConfig = await readJson(req);
      if (!newConfig.news && siteConfig.news) {
        newConfig.news = siteConfig.news;
      }
      siteConfig = { ...siteConfig, ...newConfig };
      fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(siteConfig, null, 2), 'utf8');
      updateSeoFiles();
      sendJson(res, { success: true, siteConfig });
      return;
    }

    // ----------------------------------------------------
    // Admin Company Site Config (www.jd-hub.top)
    // ----------------------------------------------------
    if (pathname === '/api/admin/company/config' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const newCompanyConfig = await readJson(req);
      companyConfig = { ...companyConfig, ...newCompanyConfig };
      fs.writeFileSync(COMPANY_CONFIG_FILE, JSON.stringify(companyConfig, null, 2), 'utf8');
      sendJson(res, { success: true, companyConfig });
      return;
    }

    // ----------------------------------------------------
    // Admin Image Upload API
    // ----------------------------------------------------
    if (pathname === '/api/admin/upload' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录或会话已过期' }, 401);
      try {
        const body = await readJson(req);
        let base64Data = body.data || '';
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        if (!base64Data) {
          return sendJson(res, { error: '未检测到图片数据' }, 400);
        }

        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length > 20 * 1024 * 1024) {
          return sendJson(res, { error: '图片大小超过 20MB 限制' }, 400);
        }

        const ext = (path.extname(body.name || '') || '.png').toLowerCase().replace(/[^a-z0-9.]/g, '');
        const safeExt = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico'].includes(ext) ? ext : '.png';
        const filename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${safeExt}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        fs.writeFileSync(filePath, buffer);
        sendJson(res, { success: true, url: `/uploads/${filename}`, filename });
        return;
      } catch (err) {
        return sendJson(res, { error: '图片上传失败: ' + err.message }, 500);
      }
    }


    // ----------------------------------------------------
    // Admin News CMS APIs
    // ----------------------------------------------------
    if (pathname === '/api/admin/news' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const newsItem = await readJson(req);
      if (!newsItem.title || !newsItem.summary) {
        return sendJson(res, { error: '新闻标题与正文摘要为必填项' }, 400);
      }
      const newItem = {
        id: newsItem.id || ('news-' + Date.now()),
        date: newsItem.date || new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        category: newsItem.category || '企业动态',
        coverImage: newsItem.coverImage || '',
        title: newsItem.title,
        summary: newsItem.summary
      };

      const existingIndex = siteConfig.news.findIndex(n => n.id === newItem.id);
      if (existingIndex >= 0) {
        siteConfig.news[existingIndex] = newItem;
      } else {
        siteConfig.news.unshift(newItem);
      }
      fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(siteConfig, null, 2), 'utf8');
      sendJson(res, { success: true, item: newItem });
      return;
    }

    if (pathname.startsWith('/api/admin/news/') && req.method === 'DELETE') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const id = pathname.split('/')[4];
      siteConfig.news = siteConfig.news.filter(n => n.id !== id);
      fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(siteConfig, null, 2), 'utf8');
      sendJson(res, { success: true });
      return;
    }

    // ----------------------------------------------------
    // Admin Free Experience & Notifications
    // ----------------------------------------------------
    if (pathname === '/api/admin/free-experience-link' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      sendJson(res, appSettings);
      return;
    }

    if (pathname === '/api/admin/free-experience-link' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const data = await readJson(req);
      appSettings = { ...appSettings, ...data };
      fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(appSettings, null, 2), 'utf8');
      sendJson(res, appSettings);
      return;
    }

    if (pathname === '/api/admin/notifications' && req.method === 'GET') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      sendJson(res, { notifications });
      return;
    }

    if (pathname === '/api/admin/notifications' && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const data = await readJson(req);
      const item = {
        id: "notif-" + Date.now(),
        titleZh: data.titleZh || '',
        titleEn: data.titleEn || '',
        bodyZh: data.bodyZh || '',
        bodyEn: data.bodyEn || '',
        status: 'draft',
        updatedAt: Date.now()
      };
      notifications.unshift(item);
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
      sendJson(res, item);
      return;
    }

    if (pathname.startsWith('/api/admin/notifications/') && req.method === 'PATCH') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const id = pathname.split('/')[4];
      const item = notifications.find(n => n.id === id);
      if (!item) return sendJson(res, { error: '未找到通知' }, 404);
      const data = await readJson(req);
      Object.assign(item, data, { updatedAt: Date.now() });
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
      sendJson(res, item);
      return;
    }

    if (pathname.startsWith('/api/admin/notifications/') && pathname.endsWith('/publish') && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const id = pathname.split('/')[4];
      const item = notifications.find(n => n.id === id);
      if (item) {
        item.status = 'published';
        item.updatedAt = Date.now();
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
        sendJson(res, item);
      } else {
        sendJson(res, { error: '未找到通知' }, 404);
      }
      return;
    }

    if (pathname.startsWith('/api/admin/notifications/') && pathname.endsWith('/withdraw') && req.method === 'POST') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const id = pathname.split('/')[4];
      const item = notifications.find(n => n.id === id);
      if (item) {
        item.status = 'draft';
        item.updatedAt = Date.now();
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
        sendJson(res, item);
      } else {
        sendJson(res, { error: '未找到通知' }, 404);
      }
      return;
    }

    if (pathname.startsWith('/api/admin/notifications/') && req.method === 'DELETE') {
      if (!checkAuth(req)) return sendJson(res, { error: '未登录' }, 401);
      const id = pathname.split('/')[4];
      notifications = notifications.filter(n => n.id !== id);
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf8');
      sendJson(res, { success: true });
      return;
    }

    // ----------------------------------------------------
    // FULL PRODUCTION COMPLIANT CLIENT ACTIVATION ENGINE
    // (Native matching software subscriptionService.ts)
    // ----------------------------------------------------
    if ((pathname === '/api/v1/license/activate' || pathname === '/api/v1/license/redeem') && req.method === 'POST') {
      const { licenseKey, deviceId = 'default_device' } = await readJson(req);
      const cleanKey = (licenseKey || '').trim().toUpperCase();
      const target = licenses.find(l => (l.code || '').trim().toUpperCase() === cleanKey);

      if (!target) {
        return sendJson(res, { error: '兑换码无效或不存在' }, 404);
      }
      if (target.status === 'revoked') {
        return sendJson(res, { error: '兑换码已被撤销' }, 403);
      }

      const now = Date.now();
      if (!target.redeemedAt) {
        target.redeemedAt = now;
        target.expiresAt = now + (target.durationDays * 24 * 3600 * 1000);
        target.status = 'redeemed';
      }
      if (now > target.expiresAt) {
        target.status = 'expired';
        return sendJson(res, { error: '兑换码已过期' }, 403);
      }

      const deviceHash = hmac(`device:${deviceId}`);
      if (!Array.isArray(target.devices)) target.devices = [];
      if (!target.devices.find(d => d.hash === deviceHash)) {
        if (target.devices.length >= (target.deviceLimit || 1)) {
          return sendJson(res, { error: `该授权码绑定的设备数已达上限 (${target.deviceLimit}台)` }, 403);
        }
        target.devices.push({ hash: deviceHash, boundAt: now, lastSeenAt: now, tokenVersion: 1 });
      }
      target.deviceCount = target.devices.length;

      fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf8');

      const token = issueToken(target, deviceHash, 'license');
      const responseData = {
        ...publicLicense(target, deviceHash),
        token
      };
      return sendJson(res, responseData);
    }

    // Verify Subscription
    if ((pathname === '/api/v1/subscription/verify' || pathname === '/api/v1/license/status' || pathname === '/api/v1/license/refresh')) {
      const authHeader = req.headers['authorization'] || '';
      const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      const payload = readToken(rawToken);

      if (!payload) {
        return sendJson(res, { error: '未登录或授权令牌无效' }, 401);
      }

      const target = licenses.find(l => l.id === payload.licenseId);
      if (!target || target.status === 'revoked' || isLicenseExpired(target)) {
        return sendJson(res, { error: '授权已失效' }, 403);
      }

      const deviceHash = payload.deviceHash;
      const responseData = {
        ...publicLicense(target, deviceHash),
        token: issueToken(target, deviceHash, 'license')
      };
      return sendJson(res, responseData);
    }

    // Export Authorization
    if (pathname === '/api/v1/export/authorize' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      const payload = rawToken ? readToken(rawToken) : null;
      const target = payload ? licenses.find(l => l.id === payload.licenseId) : null;

      // 无令牌 = 免费档导出：允许，但强制水印、限制分辨率、按设备限次。
      if (payload && (!target || target.status === 'revoked' || isLicenseExpired(target))) {
        return sendJson(res, { error: '授权已失效' }, 403);
      }

      const { format = 'zip', resolution, watermark } = await readJson(req);
      const plan = target ? planOf(target) : 'free';
      const features = PLAN_FEATURES[plan];
      const quotas = PLAN_QUOTAS[plan];

      // 服务端强制档位约束：前端按钮只是提示，真正放行在这里。
      const allowedFormats = ['zip', 'single-html', 'json', 'image', 'video', 'html'];
      if (!allowedFormats.includes(format)) {
        return sendJson(res, { error: '不支持的导出格式' }, 400);
      }
      if (resolution && RESOLUTION_ORDER.indexOf(String(resolution)) > RESOLUTION_ORDER.indexOf(quotas.maxExportResolution)) {
        return sendJson(res, { error: `当前授权最高支持 ${quotas.maxExportResolution} 导出` }, 403);
      }
      // 免费档不允许关闭水印：即使请求里写 true/false，也以服务端为准。
      const watermarkRequired = !features.export_no_watermark;
      if (watermark === false && watermarkRequired) {
        return sendJson(res, { error: '免费导出必须保留水印，升级专业版可去除' }, 403);
      }

      const now = Date.now();
      const exportTokenTtl = 5 * 60 * 1000;
      const exportExpiresAt = now + exportTokenTtl;
      const exportId = `exp_${crypto.randomUUID()}`;
      const deviceId = String(req.headers['x-aether-device-id'] || 'anonymous');
      const deviceHash = payload?.deviceHash || sha256(`free:${deviceId}`).slice(0, 24);

      // 免费档按设备记账：JSON 备份不占额度，交付物最多 FREE_EXPORT_LIMIT 次。
      // 同时记录设备指纹，避免清空 localStorage 换 deviceId 重置额度。
      const fpKey = fingerprintKey(String(req.headers['x-aether-fingerprint'] || ''));
      let freeExportsInfo;
      if (!target) {
        const consumesQuota = format !== 'json';
        freeExportsInfo = freeExportQuota(deviceHash, fpKey);
        if (consumesQuota && freeExportsInfo.remaining <= 0) {
          return sendJson(res, {
            code: 'FREE_EXPORT_LIMIT_REACHED',
            error: `免费导出次数已用完（${freeExportsInfo.used}/${freeExportsInfo.limit}），请输入授权码升级专业版`,
            ...freeExportsInfo,
          }, 403);
        }
        if (consumesQuota) {
          const bump = (key) => {
            const record = freeExports.devices[key] || { count: 0, firstAt: now };
            record.count += 1;
            record.lastAt = now;
            record.lastFormat = format;
            freeExports.devices[key] = record;
          };
          bump(deviceHash);
          if (fpKey) bump(fpKey);
          saveFreeExports();
          freeExportsInfo = freeExportQuota(deviceHash, fpKey);
        }
      }
      // 免费档没有卡密记录，用设备哈希生成稳定的 licenseRef，便于水印与追溯。
      const licenseRef = target ? target.id : `free-${deviceHash}`;
      const proofSignature = hmac(`export:${exportId}:${licenseRef}:${format}:${exportExpiresAt}`);

      const exportToken = issueToken(
        target || { id: licenseRef, plan: 'free', expiresAt: exportExpiresAt },
        deviceHash,
        'export',
        exportTokenTtl,
      );
      const proof = {
        version: 1,
        exportId,
        licenseRef,
        format,
        signature: proofSignature
      };

      if (target) {
        target.exportCount = (target.exportCount || 0) + 1;
        fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2), 'utf8');
      }

      return sendJson(res, {
        exportToken,
        expiresAt: exportExpiresAt,
        plan,
        watermarkRequired,
        maxResolution: quotas.maxExportResolution,
        ...(freeExportsInfo ? { freeExports: freeExportsInfo } : {}),

        proof
      });
    }

    // 免费导出剩余额度（客户端用于展示，不消耗次数）
    if (pathname === '/api/v1/export/quota' && req.method === 'GET') {
      const deviceId = String(req.headers['x-aether-device-id'] || 'anonymous');
      const deviceHash = sha256(`free:${deviceId}`).slice(0, 24);
      const fpKey = fingerprintKey(String(req.headers['x-aether-fingerprint'] || ''));
      return sendJson(res, freeExportQuota(deviceHash, fpKey));
    }

    // Logout
    if (pathname === '/api/v1/license/logout' && req.method === 'POST') {
      return sendJson(res, { success: true }, 200);
    }

    sendJson(res, { error: 'API Endpoint Not Found' }, 404);
  } catch (err) {
    sendJson(res, { error: 'Internal Server Error: ' + err.message }, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[JD-Server] Running on http://127.0.0.1:${PORT}`);
  updateSeoFiles();
});
