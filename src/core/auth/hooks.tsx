/**
 * 订阅相关 React Hook 和上下文
 * 方便在组件中使用订阅状态和功能权限检查
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { subscriptionService } from './subscriptionService';
import { featureGate, FeatureDeniedError, QuotaExceededError } from './featureGate';
import type {
  SubscriptionCache,
  SubscriptionPlan,
  FeatureKey,
  QuotaLimits,
} from './types';

// ==================== 上下文 ====================

interface SubscriptionContextValue {
  cache: SubscriptionCache | null;
  plan: SubscriptionPlan;
  isPaid: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  features: Record<FeatureKey, boolean>;
  quotas: QuotaLimits;
  hasFeature: (feature: FeatureKey) => boolean;
  requireFeature: (feature: FeatureKey) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  daysRemaining: number;
  isInGracePeriod: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ==================== Provider ====================

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [cache, setCache] = useState<SubscriptionCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const initialCache = await subscriptionService.init();
        if (mounted) {
          setCache(initialCache);
        }
      } catch (e) {
        console.warn('订阅服务初始化失败:', e);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    // 监听订阅状态变更
    const unsubscribe = subscriptionService.addListener((newCache) => {
      if (mounted) {
        setCache(newCache);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // 刷新订阅状态
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const newCache = await subscriptionService.refresh();
      setCache(newCache);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    await subscriptionService.logout();
    setCache(null);
  }, []);

  // 功能权限检查
  const hasFeature = useCallback((feature: FeatureKey) => {
    return featureGate.hasFeature(feature);
  }, []);

  // 功能权限守卫
  const requireFeature = useCallback((feature: FeatureKey) => {
    featureGate.requireFeature(feature);
  }, []);

  // 计算值
  const plan = cache?.plan || 'free';
  const isPaid = plan === 'pro' || plan === 'team';
  const isLoggedIn = subscriptionService.isLoggedIn();
  const features = useMemo(() => featureGate.getAllFeatures(), [cache]);
  const quotas = useMemo(() => featureGate.getQuotas(), [cache]);
  const daysRemaining = subscriptionService.getDaysRemaining();
  const isInGracePeriod = subscriptionService.isInGracePeriod();

  const value: SubscriptionContextValue = {
    cache,
    plan,
    isPaid,
    isLoggedIn,
    isLoading,
    features,
    quotas,
    hasFeature,
    requireFeature,
    refresh,
    logout,
    daysRemaining,
    isInGracePeriod,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// ==================== Hooks ====================

/**
 * 使用订阅上下文
 */
export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription 必须在 SubscriptionProvider 内使用');
  }
  return context;
}

/**
 * 检查单个功能权限
 */
export function useFeature(feature: FeatureKey): boolean {
  const { hasFeature } = useSubscription();
  return hasFeature(feature);
}

/**
 * 检查多个功能权限
 */
export function useFeatures(features: FeatureKey[]): Record<FeatureKey, boolean> {
  const { hasFeature } = useSubscription();
  return useMemo(() => {
    const result = {} as Record<FeatureKey, boolean>;
    for (const feature of features) {
      result[feature] = hasFeature(feature);
    }
    return result;
  }, [features, hasFeature]);
}

// ==================== 高阶组件 ====================

interface WithFeatureGateProps {
  feature: FeatureKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 功能门控组件
 * 有权限时渲染 children，无权限时渲染 fallback
 */
export const FeatureGate: React.FC<WithFeatureGateProps> = ({
  feature,
  fallback = null,
  children,
}) => {
  const hasAccess = useFeature(feature);
  return <>{hasAccess ? children : fallback}</>;
};

// ==================== 工具函数 ====================

/**
 * 捕获功能权限错误并显示友好提示
 */
export function handleAuthError(error: unknown): {
  title: string;
  message: string;
  isAuthError: boolean;
} {
  if (error instanceof FeatureDeniedError) {
    return {
      title: error.title,
      message: error.userMessage,
      isAuthError: true,
    };
  }

  if (error instanceof QuotaExceededError) {
    return {
      title: error.title,
      message: error.userMessage,
      isAuthError: true,
    };
  }

  return {
    title: '操作失败',
    message: error instanceof Error ? error.message : String(error),
    isAuthError: false,
  };
}
