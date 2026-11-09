/**
 * 功能权限门
 * 检查当前订阅计划是否有权使用某个功能
 * 提供统一的权限检查接口，防止绕过
 */

import {
  FEATURES,
  QUOTAS,
  type FeatureKey,
  type SubscriptionPlan,
  type QuotaLimits,
} from './types';

class FeatureGate {
  private currentPlan: SubscriptionPlan = 'free';
  private customFeatures: Record<FeatureKey, boolean> | null = null;
  private customQuotas: QuotaLimits | null = null;

  /**
   * 设置当前订阅计划
   * 由 SubscriptionService 在验证后调用
   */
  setPlan(plan: SubscriptionPlan): void {
    this.currentPlan = plan;
    this.customFeatures = null;
    this.customQuotas = null;
  }

  /**
   * 设置自定义功能权限（从服务端返回的精确权限）
   * 用于覆盖默认计划权限矩阵
   */
  setCustomFeatures(features: Record<FeatureKey, boolean>): void {
    this.customFeatures = features;
  }

  /**
   * 设置自定义配额（从服务端返回的精确配额）
   */
  setCustomQuotas(quotas: QuotaLimits): void {
    this.customQuotas = quotas;
  }

  /**
   * 检查是否有权使用某个功能
   * @param feature 功能键
   * @returns 是否有权使用
   */
  hasFeature(feature: FeatureKey): boolean {
    // 优先使用自定义功能权限
    if (this.customFeatures) {
      return this.customFeatures[feature] ?? false;
    }
    // 否则使用计划默认权限矩阵
    const featureDef = FEATURES[feature];
    if (!featureDef) return false;
    return featureDef.plans[this.currentPlan] ?? false;
  }

  /**
   * 批量检查多个功能
   * @param features 功能键列表
   * @returns 每个功能是否有权使用
   */
  hasFeatures(features: FeatureKey[]): Record<FeatureKey, boolean> {
    const result = {} as Record<FeatureKey, boolean>;
    for (const feature of features) {
      result[feature] = this.hasFeature(feature);
    }
    return result;
  }

  /**
   * 获取当前计划的所有功能权限
   */
  getAllFeatures(): Record<FeatureKey, boolean> {
    if (this.customFeatures) {
      return { ...this.customFeatures };
    }
    const result = {} as Record<FeatureKey, boolean>;
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      result[key] = this.hasFeature(key);
    }
    return result;
  }

  /**
   * 获取当前配额
   */
  getQuotas(): QuotaLimits {
    if (this.customQuotas) {
      return { ...this.customQuotas };
    }
    return { ...QUOTAS[this.currentPlan] };
  }

  /**
   * 检查是否超过工程数量限制
   */
  canCreateProject(currentProjectCount: number): boolean {
    const quotas = this.getQuotas();
    return currentProjectCount < quotas.maxProjects;
  }

  /**
   * 检查是否超过单工程素材数量限制
   */
  canAddAsset(currentAssetCount: number): boolean {
    const quotas = this.getQuotas();
    return currentAssetCount < quotas.maxAssetsPerProject;
  }

  /**
   * 检查文件大小是否在限制内
   */
  canUploadFile(fileSizeMB: number): boolean {
    const quotas = this.getQuotas();
    return fileSizeMB <= quotas.maxFileSizeMB;
  }

  /**
   * 检查导出分辨率是否受支持
   */
  canExportResolution(resolution: '720p' | '1080p' | '4k'): boolean {
    const quotas = this.getQuotas();
    const resolutionOrder = ['720p', '1080p', '4k'];
    const requestedIndex = resolutionOrder.indexOf(resolution);
    const allowedIndex = resolutionOrder.indexOf(quotas.maxExportResolution);
    return requestedIndex <= allowedIndex;
  }

  /**
   * 检查视频时长是否在限制内
   */
  canExportVideo(durationMinutes: number): boolean {
    const quotas = this.getQuotas();
    return durationMinutes <= quotas.maxVideoDurationMinutes;
  }

  /**
   * 获取功能被拒绝时的提示信息
   */
  getFeatureDenialMessage(feature: FeatureKey): {
    title: string;
    message: string;
    upgradeUrl?: string;
  } {
    const featureDef = FEATURES[feature];
    if (!featureDef) {
      return {
        title: '功能不可用',
        message: '该功能暂不可用',
      };
    }

    const planNames: Record<SubscriptionPlan, string> = {
      free: '免费版',
      pro: '专业版',
      team: '团队版',
    };

    // 找到支持该功能的最低计划
    let requiredPlan: SubscriptionPlan | null = null;
    if (featureDef.plans.pro) requiredPlan = 'pro';
    if (featureDef.plans.team && !requiredPlan) requiredPlan = 'team';

    if (!requiredPlan) {
      return {
        title: '功能不可用',
        message: `${featureDef.name} 暂未开放`,
      };
    }

    return {
      title: `${featureDef.name} 需要升级`,
      message: `${featureDef.description}。当前为${planNames[this.currentPlan]}，升级到${planNames[requiredPlan]}即可使用。`,
      upgradeUrl: '#/pricing',
    };
  }

  /**
   * 守卫函数：如果没有权限则抛出错误
   * 用于在关键操作前检查
   */
  requireFeature(feature: FeatureKey): void {
    if (!this.hasFeature(feature)) {
      const denial = this.getFeatureDenialMessage(feature);
      throw new FeatureDeniedError(feature, denial.title, denial.message);
    }
  }

  /**
   * 守卫函数：检查配额
   */
  requireQuota(
    type: 'project' | 'asset' | 'fileSize' | 'resolution' | 'duration',
    value: number
  ): void {
    switch (type) {
      case 'project':
        if (!this.canCreateProject(value)) {
          throw new QuotaExceededError(
            'project',
            '工程数量已达上限',
            `免费版最多创建 ${this.getQuotas().maxProjects} 个工程，升级专业版可创建无限工程。`
          );
        }
        break;
      case 'asset':
        if (!this.canAddAsset(value)) {
          throw new QuotaExceededError(
            'asset',
            '素材数量已达上限',
            `免费版每个工程最多 ${this.getQuotas().maxAssetsPerProject} 个素材，升级专业版可使用无限素材。`
          );
        }
        break;
      case 'fileSize':
        if (!this.canUploadFile(value)) {
          throw new QuotaExceededError(
            'fileSize',
            '文件过大',
            `当前计划最大支持 ${this.getQuotas().maxFileSizeMB}MB 文件，升级专业版支持更大文件。`
          );
        }
        break;
    }
  }

  /**
   * 重置为免费版（登出或订阅过期时调用）
   */
  reset(): void {
    this.currentPlan = 'free';
    this.customFeatures = null;
    this.customQuotas = null;
  }

  /**
   * 获取当前计划
   */
  getPlan(): SubscriptionPlan {
    return this.currentPlan;
  }
}

/**
 * 功能被拒绝错误
 */
export class FeatureDeniedError extends Error {
  feature: FeatureKey;
  title: string;
  userMessage: string;

  constructor(feature: FeatureKey, title: string, message: string) {
    super(`Feature denied: ${feature}`);
    this.name = 'FeatureDeniedError';
    this.feature = feature;
    this.title = title;
    this.userMessage = message;
  }
}

/**
 * 配额超限错误
 */
export class QuotaExceededError extends Error {
  quotaType: string;
  title: string;
  userMessage: string;

  constructor(quotaType: string, title: string, message: string) {
    super(`Quota exceeded: ${quotaType}`);
    this.name = 'QuotaExceededError';
    this.quotaType = quotaType;
    this.title = title;
    this.userMessage = message;
  }
}

/** 单例导出 */
export const featureGate = new FeatureGate();
