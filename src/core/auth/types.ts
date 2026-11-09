/**
 * P1 授权层 - 类型定义与常量
 * 订阅计划、功能权限、配额限制
 */

// 从 db 层导入基础类型（避免重复定义）
import type {
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  QuotaLimits,
  SubscriptionCache,
} from '../db/types';

// 重新导出
export type {
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  QuotaLimits,
  SubscriptionCache,
};

// ==================== 订阅计划 ====================

/** 订阅计划信息 */
export interface PlanInfo {
  id: SubscriptionPlan;
  name: string;
  nameEn: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  priceLifetime?: number;
  color: string;
  features: string[];
  popular?: boolean;
}

/** 订阅计划列表（用于展示和定价） */
export const PLANS: Record<SubscriptionPlan, PlanInfo> = {
  free: {
    id: 'free',
    name: '免费版',
    nameEn: 'Free',
    description: '适合个人体验和小型项目',
    priceMonthly: 0,
    priceYearly: 0,
    color: 'slate',
    features: [
      '最多 3 个工程',
      '每个工程最多 10 个素材',
      '导出带水印',
      '720p 视频导出',
      '基础元素（文本/图片/视频/音频）',
      '社区支持',
    ],
  },
  pro: {
    id: 'pro',
    name: '专业版',
    nameEn: 'Pro',
    description: '适合专业创作者和 freelancer',
    priceMonthly: 39,
    priceYearly: 390,
    color: 'cyan',
    popular: true,
    features: [
      '无限工程数量',
      '无限素材数量',
      '无水印导出',
      '4K 视频导出',
      '全部元素（全景/3D/高斯泼溅/特效）',
      'AI 3D 分层生成',
      '工程文件导入导出（.aether）',
      '云端同步（可选）',
      '优先技术支持',
    ],
  },
  team: {
    id: 'team',
    name: '团队版',
    nameEn: 'Team',
    description: '适合团队协作和企业使用',
    priceMonthly: 99,
    priceYearly: 990,
    color: 'purple',
    features: [
      '包含专业版全部功能',
      '最多 10 个成员',
      '团队素材库共享',
      '团队工程协作',
      '品牌素材管理',
      '批量导出',
      'API 访问权限',
      '专属客户经理',
      'SLA 服务保障',
    ],
  },
};

// ==================== 功能权限 ====================

/** 功能权限键 */
export type FeatureKey =
  // 工程相关
  | 'unlimited_projects'
  | 'project_export'
  | 'project_import'
  // 素材相关
  | 'unlimited_assets'
  | 'large_file_upload'
  // 导出相关
  | 'export_no_watermark'
  | 'export_4k'
  | 'export_video'
  | 'export_html'
  | 'export_exe'
  // 元素相关
  | 'element_panorama'
  | 'element_3d_model'
  | 'element_gaussian_splat'
  | 'element_saber'
  | 'element_chart'
  // AI 相关
  | 'ai_3d_layering'
  | 'ai_generation'
  // 协作相关
  | 'cloud_sync'
  | 'team_collaboration'
  | 'shared_asset_library'
  // 高级功能
  | 'api_access'
  | 'batch_export'
  | 'brand_assets'
  | 'priority_support';

/** 功能权限定义 */
export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  category: '工程' | '素材' | '导出' | '元素' | 'AI' | '协作' | '高级';
  plans: Record<SubscriptionPlan, boolean>;
}

/** 功能权限矩阵 */
export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  // 工程
  unlimited_projects: {
    key: 'unlimited_projects',
    name: '无限工程',
    description: '可创建无限数量的工程',
    category: '工程',
    plans: { free: false, pro: true, team: true },
  },
  project_export: {
    key: 'project_export',
    name: '工程导出',
    description: '导出 .aether 工程文件',
    category: '工程',
    plans: { free: true, pro: true, team: true },
  },
  project_import: {
    key: 'project_import',
    name: '工程导入',
    description: '导入 .aether 工程文件',
    category: '工程',
    plans: { free: false, pro: true, team: true },
  },

  // 素材
  unlimited_assets: {
    key: 'unlimited_assets',
    name: '无限素材',
    description: '每个工程可使用无限数量的素材',
    category: '素材',
    plans: { free: false, pro: true, team: true },
  },
  large_file_upload: {
    key: 'large_file_upload',
    name: '大文件上传',
    description: '支持上传超过 100MB 的大文件',
    category: '素材',
    plans: { free: false, pro: true, team: true },
  },

  // 导出
  export_no_watermark: {
    key: 'export_no_watermark',
    name: '无水印导出',
    description: '导出内容不带水印',
    category: '导出',
    plans: { free: false, pro: true, team: true },
  },
  export_4k: {
    key: 'export_4k',
    name: '4K 导出',
    description: '支持 4K 分辨率视频导出',
    category: '导出',
    plans: { free: false, pro: true, team: true },
  },
  export_video: {
    key: 'export_video',
    name: '视频导出',
    description: '导出为 MP4 视频文件',
    category: '导出',
    plans: { free: true, pro: true, team: true },
  },
  export_html: {
    key: 'export_html',
    name: 'HTML 导出',
    description: '导出为可交互 HTML 网页',
    category: '导出',
    plans: { free: true, pro: true, team: true },
  },
  export_exe: {
    key: 'export_exe',
    name: 'EXE 导出',
    description: '导出为 Windows 可执行文件',
    category: '导出',
    plans: { free: false, pro: true, team: true },
  },

  // 元素
  element_panorama: {
    key: 'element_panorama',
    name: '全景元素',
    description: '使用全景图和全景视频元素',
    category: '元素',
    plans: { free: false, pro: true, team: true },
  },
  element_3d_model: {
    key: 'element_3d_model',
    name: '3D模型',
    description: '使用 3D 模型元素',
    category: '元素',
    plans: { free: false, pro: true, team: true },
  },
  element_gaussian_splat: {
    key: 'element_gaussian_splat',
    name: '高斯泼溅',
    description: '使用高斯泼溅元素',
    category: '元素',
    plans: { free: false, pro: true, team: true },
  },
  element_saber: {
    key: 'element_saber',
    name: 'Saber光效',
    description: '使用 Saber 能量光效',
    category: '元素',
    plans: { free: true, pro: true, team: true },
  },
  element_chart: {
    key: 'element_chart',
    name: '数据图表',
    description: '使用数据可视化图表',
    category: '元素',
    plans: { free: true, pro: true, team: true },
  },

  // AI
  ai_3d_layering: {
    key: 'ai_3d_layering',
    name: 'AI 3D分层',
    description: 'AI 自动生成 3D 景深分层',
    category: 'AI',
    plans: { free: false, pro: true, team: true },
  },
  ai_generation: {
    key: 'ai_generation',
    name: 'AI 生成',
    description: 'AI 内容生成功能',
    category: 'AI',
    plans: { free: false, pro: true, team: true },
  },

  // 协作
  cloud_sync: {
    key: 'cloud_sync',
    name: '云端同步',
    description: '工程云端同步与备份',
    category: '协作',
    plans: { free: false, pro: true, team: true },
  },
  team_collaboration: {
    key: 'team_collaboration',
    name: '团队协作',
    description: '多人实时协作编辑',
    category: '协作',
    plans: { free: false, pro: false, team: true },
  },
  shared_asset_library: {
    key: 'shared_asset_library',
    name: '共享素材库',
    description: '团队共享素材库',
    category: '协作',
    plans: { free: false, pro: false, team: true },
  },

  // 高级
  api_access: {
    key: 'api_access',
    name: 'API 访问',
    description: 'REST API 和 MCP 接口访问',
    category: '高级',
    plans: { free: false, pro: false, team: true },
  },
  batch_export: {
    key: 'batch_export',
    name: '批量导出',
    description: '批量导出多个工程',
    category: '高级',
    plans: { free: false, pro: false, team: true },
  },
  brand_assets: {
    key: 'brand_assets',
    name: '品牌素材',
    description: '品牌素材管理与模板',
    category: '高级',
    plans: { free: false, pro: false, team: true },
  },
  priority_support: {
    key: 'priority_support',
    name: '优先支持',
    description: '优先技术支持与响应',
    category: '高级',
    plans: { free: false, pro: true, team: true },
  },
};

// ==================== 配额限制 ====================

/** 各计划配额 */
export const QUOTAS: Record<SubscriptionPlan, QuotaLimits> = {
  free: {
    maxProjects: 3,
    maxAssetsPerProject: 10,
    maxFileSizeMB: 100,
    maxExportResolution: '1080p',
    maxVideoDurationMinutes: 5,
  },
  pro: {
    maxProjects: Infinity,
    maxAssetsPerProject: Infinity,
    maxFileSizeMB: 2048,
    maxExportResolution: '4k',
    maxVideoDurationMinutes: 60,
  },
  team: {
    maxProjects: Infinity,
    maxAssetsPerProject: Infinity,
    maxFileSizeMB: 4096,
    maxExportResolution: '4k',
    maxVideoDurationMinutes: 120,
  },
};

// ==================== 订阅缓存常量 ====================

/** 离线缓存有效期（7天） */
export const OFFLINE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/** 订阅验证间隔（1小时） */
export const VERIFY_INTERVAL = 60 * 60 * 1000;

/** 宽限期（订阅过期后3天内仍可使用） */
export const GRACE_PERIOD = 3 * 24 * 60 * 60 * 1000;

// ==================== 服务端配置 ====================

/** API 基础地址：优先构建期注入；开发环境走同源代理，生产构建指向官网授权服务 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  // 桌面端不再具备本地签发能力，生产构建必须指向远端授权服务。
  (import.meta.env.PROD
    ? 'https://jd-hub.top'
    : (typeof window !== 'undefined' ? window.location.origin : ''));

/** API 端点 */
export const API_ENDPOINTS = {
  VERIFY_SUBSCRIPTION: '/api/v1/subscription/verify',
  ACTIVATE_LICENSE: '/api/v1/license/activate',
  LICENSE_STATUS: '/api/v1/license/status',
  REFRESH_LICENSE: '/api/v1/license/refresh',
  GET_PLANS: '/api/v1/plans',
  CREATE_CHECKOUT: '/api/v1/checkout/create',
  GET_USER: '/api/v1/user/info',
  VERIFY_TOKEN: '/api/v1/auth/verify',
  AUTHORIZE_EXPORT: '/api/v1/export/authorize',
  EXPORT_QUOTA: '/api/v1/export/quota',
  LOGOUT: '/api/v1/license/logout',
} as const;
