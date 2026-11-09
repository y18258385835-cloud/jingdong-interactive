/**
 * 存储容量管理
 * 检查存储空间、请求更多空间、清理临时文件
 */

import { opfs } from './opfs';
import { aetherDB } from './indexedDB';
import { IDB_BLOB_PREFIX } from './types';

class StorageManager {
  /** 获取当前已使用存储空间（字节） */
  async getUsedSpace(): Promise<number> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
    } catch (e) {
      console.warn('获取存储空间使用量失败:', e);
    }
    // 降级方案：遍历 OPFS 计算
    try {
      return await opfs.getDirectorySize('');
    } catch {
      return 0;
    }
  }

  /** 获取可用存储空间配额（字节） */
  async getQuota(): Promise<number> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return estimate.quota || 0;
      }
    } catch (e) {
      console.warn('获取存储空间配额失败:', e);
    }
    return -1; // 未知
  }

  /** 获取存储使用详情 */
  async getStorageDetails(): Promise<{
    used: number;
    quota: number;
    usagePercent: number;
    assetsSize: number;
    indexedDBSize: number;
  }> {
    const [used, quota, assetsSize] = await Promise.all([
      this.getUsedSpace(),
      this.getQuota(),
      opfs.getAssetsSize().catch(() => 0),
    ]);

    const usagePercent = quota > 0 ? (used / quota) * 100 : 0;

    return {
      used,
      quota,
      usagePercent,
      assetsSize,
      indexedDBSize: used - assetsSize, // 近似值
    };
  }

  /** 检查是否有足够空间 */
  async hasEnoughSpace(requiredBytes: number, margin = 0.1): Promise<boolean> {
    const used = await this.getUsedSpace();
    const quota = await this.getQuota();
    if (quota <= 0) return true; // 无法获取配额时假设足够
    return used + requiredBytes < quota * (1 - margin); // 保留 margin 余量
  }

  /** 请求更多存储空间（Chrome 下会弹权限提示） */
  async requestMoreSpace(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const granted = await navigator.storage.persist();
        return granted;
      }
    } catch (e) {
      console.warn('请求持久化存储失败:', e);
    }
    return false;
  }

  /** 检查是否已持久化存储 */
  async isPersisted(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        return await navigator.storage.persisted();
      }
    } catch (e) {
      console.warn('检查持久化状态失败:', e);
    }
    return false;
  }

  /** 清理临时文件 */
  async cleanupTempFiles(): Promise<{
    tempCleaned: number;
    exportCleaned: number;
    freedBytes: number;
  }> {
    const beforeSize = await this.getUsedSpace();
    const [tempCleaned, exportCleaned] = await Promise.all([
      opfs.cleanupTempFiles(),
      opfs.cleanupExportFiles(),
    ]);
    const afterSize = await this.getUsedSpace();
    return {
      tempCleaned,
      exportCleaned,
      freedBytes: Math.max(0, beforeSize - afterSize),
    };
  }

  /** 清理未被引用的素材（垃圾回收） */
  async cleanupOrphanedAssets(projectId: string): Promise<{
    cleanedCount: number;
    freedBytes: number;
  }> {
    const assets = await aetherDB.getAssetsByProject(projectId);
    let cleanedCount = 0;
    let freedBytes = 0;

    for (const asset of assets) {
      if (asset.refCount <= 0) {
        // 双重验证：检查工程数据中是否真的没有引用
        const project = await aetherDB.getProject(projectId);
        if (project && !this.isAssetReferenced(asset.id, project.data)) {
          try {
            // 删除素材文件（兼容 OPFS 与 IndexedDB 降级）
            if (asset.opfsPath.startsWith(IDB_BLOB_PREFIX)) {
              await aetherDB.deleteBlob(asset.opfsPath.slice(IDB_BLOB_PREFIX.length));
            } else {
              await opfs.deleteFile(asset.opfsPath);
            }
            freedBytes += asset.size;
            // 删除数据库记录
            await aetherDB.deleteAsset(asset.id);
            cleanedCount++;
          } catch (e) {
            console.warn(`清理素材失败: ${asset.name}`, e);
          }
        }
      }
    }

    return { cleanedCount, freedBytes };
  }

  /** 检查素材是否被工程数据引用 */
  private isAssetReferenced(assetId: string, projectData: any): boolean {
    try {
      const scenes = projectData.scenes || {};
      for (const scene of Object.values(scenes) as any[]) {
        const elements = scene.els || [];
        for (const element of elements) {
          if (element.refId === assetId) return true;
          // 检查热点中的媒体引用
          if (element.hotspots && Array.isArray(element.hotspots)) {
            for (const hotspot of element.hotspots) {
              if (hotspot.mediaRefId === assetId) return true;
              if (hotspot.iconImageRefId === assetId) return true;
              if (hotspot.iconVideoRefId === assetId) return true;
              if (hotspot.iconModelRefId === assetId) return true;
            }
          }
        }
      }
      // 检查全局素材
      if (projectData.globalAssets && Array.isArray(projectData.globalAssets)) {
        for (const ga of projectData.globalAssets) {
          if (ga.refId === assetId) return true;
        }
      }
    } catch (e) {
      console.warn('检查素材引用失败:', e);
    }
    return false;
  }

  /** 获取工程素材使用统计 */
  async getAssetStats(projectId: string): Promise<{
    total: number;
    referenced: number;
    orphaned: number;
    totalSize: number;
    orphanedSize: number;
  }> {
    const assets = await aetherDB.getAssetsByProject(projectId);
    let referenced = 0;
    let orphaned = 0;
    let totalSize = 0;
    let orphanedSize = 0;

    for (const asset of assets) {
      totalSize += asset.size;
      if (asset.refCount > 0) {
        referenced++;
      } else {
        orphaned++;
        orphanedSize += asset.size;
      }
    }

    return {
      total: assets.length,
      referenced,
      orphaned,
      totalSize,
      orphanedSize,
    };
  }

  /** 格式化字节数为人类可读格式 */
  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  /** 存储空间警告阈值检查 */
  async checkStorageWarning(): Promise<{
    level: 'ok' | 'warning' | 'critical';
    message: string;
    used: number;
    quota: number;
  }> {
    const { used, quota, usagePercent } = await this.getStorageDetails();

    if (quota <= 0) {
      return { level: 'ok', message: '无法获取存储空间信息', used, quota };
    }

    if (usagePercent >= 90) {
      return {
        level: 'critical',
        message: `存储空间严重不足（已使用 ${this.formatBytes(used)} / ${this.formatBytes(quota)}），请清理旧素材或请求更多存储空间`,
        used,
        quota,
      };
    }

    if (usagePercent >= 75) {
      return {
        level: 'warning',
        message: `存储空间使用较多（已使用 ${this.formatBytes(used)} / ${this.formatBytes(quota)}），建议及时清理`,
        used,
        quota,
      };
    }

    return {
      level: 'ok',
      message: `存储空间充足（已使用 ${this.formatBytes(used)} / ${this.formatBytes(quota)}）`,
      used,
      quota,
    };
  }
}

/** 单例导出 */
export const storageManager = new StorageManager();
