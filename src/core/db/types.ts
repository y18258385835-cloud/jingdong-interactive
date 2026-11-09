/**
 * P0 存储层 - 核心类型定义
 * 工程配置存 IndexedDB，素材文件存 OPFS
 */

// ==================== 工程相关 ====================

/** 工程记录（IndexedDB 存储） */
export interface ProjectRecord {
  id: string;                    // 工程唯一ID，如 'proj_1700000000000'
  name: string;                  // 工程名称
  description?: string;          // 工程描述
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 最后更新时间戳
  version: string;               // 工程格式版本，如 '1.0.0'
  data: any;                     // 完整工程数据（场景、元素、时间线等，复用现有 ProjectData）
  thumbnail?: string;            // 缩略图（OPFS 路径 或 base64）
  assetIds: string[];            // 该工程使用的所有素材ID列表
  isDeleted?: boolean;           // 软删除标记
}

// ==================== 素材相关 ====================

/** 素材类型枚举 */
/** 工程管理列表使用的轻量摘要，避免把完整工程 JSON 批量读入内存。 */
export interface ProjectSummaryRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  thumbnail?: string;
  assetIds: string[];
  isDeleted?: boolean;
  sceneCount: number;
}

export type ProjectSummary = ProjectSummaryRecord;

export type AssetType =
  | 'image'           // 普通图片
  | 'panorama-img'    // 全景图（等距柱状投影）
  | 'video'           // 普通视频
  | 'panorama-vid'    // 全景视频
  | 'model-3d'        // 3D模型（GLB/GLTF）
  | 'gaussian-splat'  // 高斯泼溅（PLY/SPLAT）
  | 'audio'           // 音频
  | 'font';           // 字体

/** 素材记录（IndexedDB 存储，实际文件在 OPFS） */
export interface AssetRecord {
  id: string;                    // 素材唯一ID，如 'asset_1700000000000'
  projectId: string;             // 所属工程ID
  name: string;                  // 原始文件名
  type: AssetType;               // 素材类型
  mimeType: string;              // MIME 类型
  size: number;                  // 文件大小（字节）
  hash: string;                  // 文件内容哈希（SHA-256，用于去重）
  opfsPath: string;              // OPFS 中的文件路径，如 '/assets/asset_xxx.jpg'
  width?: number;                // 图片/视频宽度
  height?: number;               // 图片/视频高度
  duration?: number;             // 视频时长（秒）
  createdAt: number;             // 导入时间戳
  lastUsedAt: number;            // 最后使用时间
  refCount: number;              // 被引用次数（工程中多个元素引用同一素材）
}

// ==================== 订阅相关 ====================

/** 订阅计划 */
export type SubscriptionPlan = 'free' | 'pro' | 'team';

/** 订阅状态 */
export type SubscriptionStatus = 'active' | 'expired' | 'trial' | 'cancelled' | 'grace';

/** 订阅周期 */
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';

/** 配额限制 */
export interface QuotaLimits {
  maxProjects: number;
  maxAssetsPerProject: number;
  maxFileSizeMB: number;
  maxExportResolution: '720p' | '1080p' | '4k';
  maxVideoDurationMinutes: number;
}

/** 订阅状态缓存（IndexedDB 存储，支持7天离线使用） */
export interface SubscriptionCache {
  userId: string;                // 用户ID
  plan: SubscriptionPlan;        // 订阅计划
  status: SubscriptionStatus;    // 状态
  billingCycle: BillingCycle;    // 订阅周期
  expiresAt: number;             // 过期时间戳
  cachedAt: number;              // 缓存时间戳
  gracePeriodEndsAt?: number;    // 宽限期结束时间
  trialEndsAt?: number;          // 试用期结束时间
  features: Record<string, boolean>; // 功能开关
  quotas: QuotaLimits;           // 配额限制
  signature?: string;            // 服务端签名（防篡改）
}

// ==================== 最近工程 ====================

/** 最近工程记录 */
export interface RecentProjectRecord {
  projectId: string;
  name: string;
  thumbnail?: string;
  lastOpenedAt: number;
}

// ==================== 数据库 Schema ====================

/** IndexedDB 数据库名称 */
export const DB_NAME = 'aether_editor';

/** IndexedDB 数据库版本 */
export const DB_VERSION = 3;

/** Object Store 名称 */
export const STORES = {
  PROJECTS: 'projects',
  PROJECT_SUMMARIES: 'projectSummaries',
  ASSETS: 'assets',
  PREFERENCES: 'preferences',
  SUBSCRIPTION: 'subscription',
  RECENT_PROJECTS: 'recentProjects',
  BLOBS: 'blobs',
} as const;

/** OPFS 降级存储的路径前缀：opfsPath 以该前缀开头时，Blob 存储在 IndexedDB blobs store（而非 OPFS） */
export const IDB_BLOB_PREFIX = 'idb://';

/** OPFS 目录结构 */
export const OPFS_PATHS = {
  ASSETS: 'assets',
  EXPORTS: 'exports',
  THUMBNAILS: 'thumbnails',
  TEMP: 'temp',
} as const;

/** 应用版本（用于工程文件）。构建期由 package.json 注入，避免多处硬编码漂移。 */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

/** 工程格式版本 */
export const PROJECT_FORMAT_VERSION = '1.0.0';
