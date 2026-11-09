/**
 * P1 授权层 - 统一导出
 * 订阅验证、功能权限门、配额限制、React Hooks
 */

// 实际导入（用于 initAuth 函数）
import { subscriptionService } from './subscriptionService';

// 类型与常量
export {
  PLANS,
  FEATURES,
  QUOTAS,
  OFFLINE_CACHE_TTL,
  VERIFY_INTERVAL,
  GRACE_PERIOD,
  API_BASE_URL,
  API_ENDPOINTS,
} from './types';

export type {
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  PlanInfo,
  FeatureKey,
  FeatureDefinition,
  QuotaLimits,
  SubscriptionCache,
} from './types';

// 功能权限门
export { featureGate, FeatureDeniedError, QuotaExceededError } from './featureGate';

// 订阅验证服务
export { subscriptionService };

// React Hooks 和上下文
export {
  SubscriptionProvider,
  useSubscription,
  useFeature,
  useFeatures,
  FeatureGate,
  handleAuthError,
} from './hooks';

/**
 * P1 授权层初始化
 * 在应用启动时调用
 */
export async function initAuth(): Promise<void> {
  await subscriptionService.init();
}
