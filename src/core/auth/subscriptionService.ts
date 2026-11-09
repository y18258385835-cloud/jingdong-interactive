/**
 * 订阅验证服务
 * 负责与服务端验证订阅状态、缓存到本地、处理离线场景
 * 支持7天离线缓存，防止绕过付费验证
 */

import { aetherDB } from '../db';
import { featureGate } from './featureGate';
import {
  API_BASE_URL,
  API_ENDPOINTS,
  OFFLINE_CACHE_TTL,
  VERIFY_INTERVAL,
  GRACE_PERIOD,
  FEATURES,
  QUOTAS,
  type SubscriptionCache,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type FeatureKey,
  type QuotaLimits,
} from './types';
import type { ExportProof } from '../../utils/exportProof';

export interface ExportAuthorization {
  exportToken: string;
  expiresAt: number;
  proof: ExportProof;
}

class SubscriptionService {
  private readonly useHttpOnlyLicenseCookie = import.meta.env.VITE_LICENSE_HTTP_ONLY_COOKIE === 'true';
  /**
   * 授权服务在官网域名（跨域）时，带 credentials 的请求会被浏览器 CORS 拦截
   * （服务端返回 Access-Control-Allow-Origin: *）。默认使用 Bearer 令牌，
   * 只有显式开启 HttpOnly Cookie 模式才需要 include。
   */
  private get credentialsMode(): RequestCredentials {
    return this.useHttpOnlyLicenseCookie ? 'include' : 'omit';
  }
  private cache: SubscriptionCache | null = null;
  // IndexedDB is display-only until the current process revalidates with the server.
  private serverVerified = false;
  private lastVerifyTime = 0;
  private verifyPromise: Promise<SubscriptionCache | null> | null = null;
  private listeners = new Set<(cache: SubscriptionCache | null) => void>();

  /**
   * Use the configured service first, then retry through the current editor
   * origin. The second path is handled by Vite in development and by the
   * reverse proxy in production, so a stale port cannot strand activation.
   */
  private async requestApi(path: string, init: RequestInit): Promise<Response> {
    const configuredUrl = `${API_BASE_URL}${path}`;
    try {
      const response = await fetch(configuredUrl, init);
      return response;
    } catch (error) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const fallbackUrl = origin ? `${origin}${path}` : '';
      if (!fallbackUrl || fallbackUrl === configuredUrl) throw error;
      try {
        return await fetch(fallbackUrl, init);
      } catch {
        throw new Error('无法连接授权服务，请确认授权服务已启动后重试');
      }
    }
  }

  /** 弱设备指纹：防止用户清空 localStorage 后重置免费导出额度。 */
  /** 弱设备指纹：防止用户清空 localStorage 后重置免费导出额度。 */
  private getDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'fp_server';
    const nav = window.navigator;
    const screenInfo = [window.screen?.width || 0, window.screen?.height || 0, window.screen?.colorDepth || 0].join('x');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const raw = [nav.userAgent, nav.language, nav.hardwareConcurrency, nav.platform, screenInfo, timezone].join('|');
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return 'fp_' + (hash >>> 0).toString(16) + '_' + raw.length;
  }

  private getDeviceId(): string {
    const key = 'aether_device_id';
    let id = localStorage.getItem(key);
    if (!id) { id = `device_${crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`}`; localStorage.setItem(key, id); }
    return id;
  }

  /**
   * 初始化服务
   * 从 IndexedDB 加载缓存，然后异步验证
   */
  async init(): Promise<SubscriptionCache | null> {
    // 从本地加载缓存
    this.cache = await aetherDB.getSubscription();

    if (this.cache) {
      // 应用缓存到 featureGate
      featureGate.reset();
    } else {
      // 无缓存，使用免费版
      featureGate.reset();
    }

    // 异步验证（不阻塞初始化）
    this.verify(false).catch((e) => {
      console.warn('订阅验证失败，使用本地缓存:', e);
    });

    return this.cache;
  }

  /**
   * 验证订阅状态
   * @param force 是否强制验证（忽略缓存）
   */
  async verify(force = false): Promise<SubscriptionCache | null> {
    // 防止重复验证
    if (this.verifyPromise) return this.verifyPromise;

    // 检查是否需要验证
    if (!force && this.serverVerified && this.cache && this.isCacheValid()) {
      return this.cache;
    }

    this.verifyPromise = this._doVerify(force);
    try {
      return await this.verifyPromise;
    } finally {
      this.verifyPromise = null;
    }
  }

  /**
   * 执行验证
   */
  private async _doVerify(force: boolean): Promise<SubscriptionCache | null> {
    try {
      // 尝试从服务端验证
      const serverCache = await this.verifyWithServer(force);
      if (serverCache) {
        this.cache = serverCache;
        this.serverVerified = true;
        this.lastVerifyTime = Date.now();
        await aetherDB.saveSubscription(serverCache);
        this.applyCache(serverCache);
        this.notifyListeners();
        return serverCache;
      }
    } catch (e) {
      console.warn('服务端验证失败:', e);
    }

    // 服务端验证失败，使用本地缓存
    if (this.cache && this.isCacheValid()) {
      this.serverVerified = false;
      featureGate.reset();
      return this.cache;
    }

    // 无有效缓存，降级为免费版
    this.cache = null;
    featureGate.reset();
    this.notifyListeners();
    return null;
  }

  /**
   * 从服务端验证订阅
   */
  private async verifyWithServer(force = false): Promise<SubscriptionCache | null> {
    const token = this.getAuthToken();
    if (!token && !this.useHttpOnlyLicenseCookie) {
      return null; // 未登录，使用免费版
    }

    const response = await this.requestApi(API_ENDPOINTS.VERIFY_SUBSCRIPTION, {
      method: force ? 'POST' : 'GET',
      credentials: this.credentialsMode,
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        'X-Aether-Device-Id': this.getDeviceId(),
      },
    });

    if (!response.ok) {
      throw new Error(`验证失败: ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.token === 'string' && this.isAuthTokenShapeValid(data.token)) this.setAuthToken(data.token);

    // 验证签名（防篡改）
    if (!this.verifySignature(data)) {
      console.warn('订阅数据签名验证失败，可能被篡改');
      return null;
    }

    // 构建缓存
    const cache: SubscriptionCache = {
      userId: data.userId,
      plan: data.plan as SubscriptionPlan,
      status: data.status as SubscriptionStatus,
      billingCycle: data.billingCycle || 'monthly',
      expiresAt: data.expiresAt,
      cachedAt: Date.now(),
      gracePeriodEndsAt: data.expiresAt ? data.expiresAt + GRACE_PERIOD : undefined,
      features: this.buildFeatures(data.plan as SubscriptionPlan, data.features),
      quotas: this.buildQuotas(data.plan as SubscriptionPlan, data.quotas),
      signature: data.signature,
      trialEndsAt: data.trialEndsAt,
    };

    return cache;
  }

  /**
   * 验证数据签名（防篡改）
   * 简单实现：服务端返回的 signature 与客户端计算的一致
   * 生产环境应使用非对称加密（RSA/ECDSA）
   */
  private verifySignature(data: any): boolean {
    if (!data || typeof data.userId !== 'string' || !['free', 'pro', 'team'].includes(data.plan) || typeof data.status !== 'string' || !Number.isFinite(data.expiresAt) || typeof data.signature !== 'string' || !/^[a-f0-9]{64}$/i.test(data.signature)) return false;
    // 简单验证：检查关键字段是否存在
    // 生产环境应使用 crypto.subtle.verify 验证服务端签名
    return true;
  }

  private isAuthTokenShapeValid(token: unknown): token is string {
    if (typeof token !== 'string' || token.length > 4096) return false;
    const [encoded, signature, ...rest] = token.split('.');
    if (!encoded || !signature || rest.length || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    try {
      const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)), (character) => character.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      return payload?.v === 1 && payload?.iss === 'aether-license-service' && payload?.aud === 'aether-editor' && typeof payload?.licenseId === 'string' && typeof payload?.deviceHash === 'string' && Number.isFinite(payload?.iat) && Number.isFinite(payload?.exp) && payload.exp > payload.iat;
    } catch {
      return false;
    }
  }

  /**
   * 构建功能权限
   */
  private buildFeatures(
    plan: SubscriptionPlan,
    serverFeatures?: Record<string, boolean>
  ): Record<FeatureKey, boolean> {
    const features = {} as Record<FeatureKey, boolean>;
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      // 优先使用服务端返回的精确权限
      if (serverFeatures && key in serverFeatures) {
        features[key] = serverFeatures[key];
      } else {
        features[key] = FEATURES[key].plans[plan] ?? false;
      }
    }
    return features;
  }

  /**
   * 构建配额
   */
  private buildQuotas(
    plan: SubscriptionPlan,
    serverQuotas?: Partial<QuotaLimits>
  ): QuotaLimits {
    return {
      ...QUOTAS[plan],
      ...serverQuotas,
    };
  }

  /**
   * 应用缓存到 featureGate
   */
  private applyCache(cache: SubscriptionCache): void {
    featureGate.setPlan(cache.plan);
    featureGate.setCustomFeatures(cache.features);
    featureGate.setCustomQuotas(cache.quotas);
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;

    const now = Date.now();

    // 检查缓存是否在有效期内（7天）
    if (now - this.cache.cachedAt > OFFLINE_CACHE_TTL) {
      return false;
    }

    // 检查订阅是否过期（含宽限期）
    if (this.cache.expiresAt && now > this.cache.expiresAt) {
      // 在宽限期内仍有效
      if (this.cache.gracePeriodEndsAt && now <= this.cache.gracePeriodEndsAt) {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * 获取当前订阅缓存
   */
  getCache(): SubscriptionCache | null {
    return this.cache;
  }

  /**
   * 获取当前订阅计划
   */
  getPlan(): SubscriptionPlan {
    return this.cache?.plan || 'free';
  }

  /**
   * 获取订阅状态
   */
  getStatus(): SubscriptionStatus {
    return this.cache?.status || 'expired';
  }

  /**
   * 检查是否为付费用户
   */
  isPaid(): boolean {
    return this.serverVerified && (this.cache?.plan === 'pro' || this.cache?.plan === 'team');
  }

  /**
   * 检查是否在试用期
   */
  isTrial(): boolean {
    if (!this.cache?.trialEndsAt) return false;
    return Date.now() < this.cache.trialEndsAt;
  }

  /**
   * 检查是否在宽限期
   */
  isInGracePeriod(): boolean {
    if (!this.cache?.gracePeriodEndsAt) return false;
    const now = Date.now();
    return now > (this.cache.expiresAt || 0) && now <= this.cache.gracePeriodEndsAt;
  }

  /**
   * 获取订阅过期时间
   */
  getExpiresAt(): number | null {
    return this.cache?.expiresAt || null;
  }

  /**
   * 获取剩余天数
   */
  getDaysRemaining(): number {
    if (!this.cache?.expiresAt) return Infinity;
    const ms = this.cache.expiresAt - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  /**
   * 登出（清除订阅缓存）
   */
  async logout(): Promise<void> {
    const token = this.getAuthToken();
    try {
      await this.requestApi(API_ENDPOINTS.LOGOUT, {
        method: 'POST',
        credentials: this.credentialsMode,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Aether-Device-Id': this.getDeviceId(),
        },
      });
    } catch {
      // Local logout must still complete when the network is unavailable.
    }
    this.cache = null;
    this.serverVerified = false;
    this.lastVerifyTime = 0;
    await aetherDB.clearSubscription();
    featureGate.reset();
    this.notifyListeners();
  }

  /**
   * 设置认证 token
   * 简单实现：存储在 localStorage
   * 生产环境应使用更安全的存储方式（HttpOnly Cookie）
   */
  setAuthToken(token: string): void {
    localStorage.setItem('aether_auth_token', token);
  }

  /**
   * 获取认证 token
   */
  getAuthToken(): string | null {
    return localStorage.getItem('aether_auth_token');
  }

  /**
   * 清除认证 token
   */
  clearAuthToken(): void {
    localStorage.removeItem('aether_auth_token');
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    return !!this.getAuthToken();
  }

  /**
   * 添加订阅状态变更监听器
   */
  addListener(listener: (cache: SubscriptionCache | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.cache);
      } catch (e) {
        console.warn('监听器执行失败:', e);
      }
    }
  }

  /**
   * 手动刷新订阅状态
   */
  async refresh(): Promise<SubscriptionCache | null> {
    return this.verify(true);
  }

  /** 使用卡密向服务端激活，前端不进行最终授权判断。 */
  async activateLicense(licenseKey: string): Promise<SubscriptionCache | null> {
    const response = await this.requestApi(API_ENDPOINTS.ACTIVATE_LICENSE, {
      method: 'POST', credentials: this.credentialsMode, headers: { 'Content-Type': 'application/json', 'X-Aether-Device-Id': this.getDeviceId(), 'X-Aether-Fingerprint': this.getDeviceFingerprint() },
      body: JSON.stringify({ licenseKey, deviceId: this.getDeviceId() }),
    });
    if (!response.ok) throw new Error(`授权激活失败: ${response.status}`);
    const data = await response.json();
    if (data.token && this.isAuthTokenShapeValid(data.token)) this.setAuthToken(data.token);
    else if (this.useHttpOnlyLicenseCookie) this.clearAuthToken();
    return this.verify(true);
  }

  /** 当前授权档位是否具备某个功能（来自服务端 features，不允许时回落到计划矩阵）。 */
  hasFeature(feature: FeatureKey): boolean {
    return featureGate.hasFeature(feature);
  }

  /** 当前授权允许的最高导出分辨率。 */
  maxExportResolution(): QuotaLimits['maxExportResolution'] {
    return featureGate.getQuotas().maxExportResolution;
  }

  /**
   * 免费档剩余导出次数（付费档返回 null，表示不限额）。
   * 只用于界面提示，真正的扣减在服务端完成。
   */
  async getExportQuota(): Promise<{ used: number; limit: number; remaining: number } | null> {
    if (this.hasFeature('export_no_watermark')) return null;
    try {
      const response = await this.requestApi(API_ENDPOINTS.EXPORT_QUOTA, {
        method: 'GET',
        credentials: this.credentialsMode,
        headers: { 'X-Aether-Device-Id': this.getDeviceId(), 'X-Aether-Fingerprint': this.getDeviceFingerprint() },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data.remaining !== 'number') return null;
      return {
        used: Number(data.used) || 0,
        limit: Number(data.limit) || 0,
        remaining: Number(data.remaining) || 0,
      };
    } catch {
      return null;
    }
  }

  /** 每次导出前都向服务器申请短期许可，前端状态不构成最终授权。 */
  async authorizeExport(
    format: 'zip' | 'single-html' | 'json' | 'image' | 'video' | 'html',
    options: { resolution?: string; watermark?: boolean } = {},
  ): Promise<ExportAuthorization> {
    const token = this.getAuthToken();
    // 无令牌时走免费档：服务端强制水印并限制分辨率，仍返回完整导出许可。
    const body = {
      format,
      ...options,
      // 免费档不允许关闭水印，避免客户端误导服务端。
      watermark: token ? options.watermark : true,
    };
    const response = await this.requestApi(API_ENDPOINTS.AUTHORIZE_EXPORT, {
      method: 'POST',
      credentials: this.credentialsMode,
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}), 'Content-Type': 'application/json', 'X-Aether-Device-Id': this.getDeviceId() },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || '导出授权验证失败');
    }
    const data = await response.json();
    if (!this.isExportAuthorizationValid(data, format)) throw new Error('服务端返回的导出授权无效');
    return data as ExportAuthorization;
  }

  private isExportAuthorizationValid(value: unknown, format: string): value is ExportAuthorization {
    const data = value as Partial<ExportAuthorization> | null;
    const proof = data?.proof;
    return Boolean(data && typeof data.exportToken === 'string' && this.isAuthTokenShapeValid(data.exportToken) && Number.isFinite(data.expiresAt) && data.expiresAt > Date.now() && proof && proof.version === 1 && typeof proof.exportId === 'string' && /^exp_[a-z0-9-]+$/i.test(proof.exportId) && typeof proof.licenseRef === 'string' && proof.licenseRef.length >= 12 && proof.format === format && typeof proof.signature === 'string' && /^[a-f0-9]{64}$/i.test(proof.signature));
  }

  /**
   * 获取升级链接
   */
  getUpgradeUrl(plan: SubscriptionPlan = 'pro'): string {
    return `${API_BASE_URL}/upgrade?plan=${plan}`;
  }

  /**
   * 开发模式：设置模拟订阅（仅开发环境使用）
   */
  async devSetMockPlan(plan: SubscriptionPlan): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('模拟订阅仅在开发环境可用');
      return;
    }

    const mockCache: SubscriptionCache = {
      userId: 'dev_user',
      plan,
      status: 'active',
      billingCycle: 'monthly',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cachedAt: Date.now(),
      gracePeriodEndsAt: Date.now() + 33 * 24 * 60 * 60 * 1000,
      features: this.buildFeatures(plan),
      quotas: this.buildQuotas(plan),
      signature: 'dev_mock',
    };

    this.cache = mockCache;
    this.serverVerified = true;
    await aetherDB.saveSubscription(mockCache);
    this.applyCache(mockCache);
    this.notifyListeners();
  }
}

/** 单例导出 */
export const subscriptionService = new SubscriptionService();
