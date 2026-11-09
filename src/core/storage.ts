/**
 * P0 存储层 - 总入口
 * 纯前端本地存储解决方案：IndexedDB（配置）+ OPFS（大文件）
 *
 * 模块组成：
 * - db:           数据库层（IndexedDB 封装、OPFS 封装、存储容量管理）
 * - assets:       素材管理层（导入器、加载器、垃圾回收器）
 * - project:      工程管理层（导出器、导入器）
 *
 * 使用示例：
 * import { aetherDB, opfs, assetImporter, assetLoader, projectExporter, projectImporter } from '@/core/storage';
 *
 * // 初始化
 * await aetherDB.init();
 * await opfs.init();
 *
 * // 导入素材
 * const asset = await assetImporter.importAsset(file, projectId);
 *
 * // 加载素材URL
 * const url = await assetLoader.loadAssetURL(asset.id);
 *
 * // 导出工程
 * await projectExporter.exportAndDownload(projectId);
 *
 * // 导入工程
 * const result = await projectImporter.importProject(file);
 */

// 数据库层
import { aetherDB } from './db/indexedDB';
import { opfs } from './db/opfs';
import { storageManager } from './db/storageManager';

// 素材管理层
import { assetImporter } from './assets/importer';
import { assetLoader } from './assets/loader';
import { assetGC } from './assets/garbageCollector';

// 工程管理层
import { projectExporter } from './project/exporter';
import { projectImporter } from './project/importer';

// 重新导出
export { aetherDB, opfs, storageManager };
export { assetImporter, assetLoader, assetGC };
export { projectExporter, projectImporter };

// 类型定义
export type {
  ProjectRecord,
  AssetRecord,
  AssetType,
  SubscriptionCache,
  SubscriptionPlan,
  SubscriptionStatus,
  RecentProjectRecord,
  ProjectSummary,
} from './db/types';

// 常量
export {
  DB_NAME,
  DB_VERSION,
  STORES,
  OPFS_PATHS,
  APP_VERSION,
  PROJECT_FORMAT_VERSION,
} from './db/types';

/**
 * P0 存储层初始化
 * 在应用启动时调用一次
 */
export async function initStorage(): Promise<{
  dbReady: boolean;
  opfsReady: boolean;
  opfsSupported: boolean;
  storageInfo?: {
    used: number;
    quota: number;
    usagePercent: number;
  };
}> {
  const results = {
    dbReady: false,
    opfsReady: false,
    opfsSupported: true,
  };

  // 初始化 IndexedDB
  try {
    await aetherDB.init();
    results.dbReady = true;
  } catch (e) {
    console.error('IndexedDB 初始化失败:', e);
    throw new Error('本地数据库初始化失败，请检查浏览器设置');
  }

  // 初始化 OPFS（可能不被支持，需要降级处理）
  try {
    await opfs.init();
    results.opfsReady = true;
  } catch (e) {
    console.warn('OPFS 初始化失败，将使用降级方案:', e);
    results.opfsSupported = false;
    // 降级方案已实现：素材 Blob 改存 IndexedDB blobs store
    // （见 assets/importer.ts 的 OPFS 写入失败分支，opfsPath 以 idb:// 前缀标记）
  }

  // 获取存储信息
  let storageInfo;
  try {
    storageInfo = await storageManager.getStorageDetails();
  } catch (e) {
    console.warn('获取存储信息失败:', e);
  }

  // 启动时自动清理临时文件（异步，不阻塞初始化）
  if (results.opfsReady) {
    storageManager.cleanupTempFiles().catch((e) => {
      console.warn('清理临时文件失败:', e);
    });
  }

  return { ...results, storageInfo };
}

/**
 * P0 存储层健康检查
 * 用于运行时监控和诊断
 */
export async function storageHealthCheck(): Promise<{
  db: {
    connected: boolean;
    projectCount: number;
    assetCount: number;
  };
  opfs: {
    supported: boolean;
    ready: boolean;
    assetsSize: number;
  };
  cache: {
    urlCacheCount: number;
    dataURLCacheCount: number;
    totalRefCount: number;
  };
  storage: {
    used: number;
    quota: number;
    usagePercent: number;
    level: 'ok' | 'warning' | 'critical';
  };
}> {
  const [dbStats, assetsSize, cacheStats, storageWarning] = await Promise.all([
    aetherDB.getStats().catch(() => ({ projectCount: 0, assetCount: 0, recentCount: 0 })),
    opfs.getAssetsSize().catch(() => 0),
    Promise.resolve(assetLoader.getCacheStats()),
    storageManager.checkStorageWarning().catch(() => ({
      level: 'ok' as const,
      message: '',
      used: 0,
      quota: 0,
    })),
  ]);

  return {
    db: {
      connected: !!aetherDB['db'],
      projectCount: dbStats.projectCount,
      assetCount: dbStats.assetCount,
    },
    opfs: {
      supported: opfs.isSupported(),
      ready: !!opfs['root'],
      assetsSize,
    },
    cache: cacheStats,
    storage: {
      used: storageWarning.used,
      quota: storageWarning.quota,
      usagePercent: storageWarning.used > 0 && storageWarning.quota > 0
        ? (storageWarning.used / storageWarning.quota) * 100
        : 0,
      level: storageWarning.level,
    },
  };
}
