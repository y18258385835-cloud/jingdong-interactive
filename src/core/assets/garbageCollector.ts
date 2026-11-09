/**
 * 素材垃圾回收器
 * 自动清理未被引用的素材文件，释放存储空间
 * 策略：引用计数为0 + 工程数据中确实没有引用 + 超过宽限期
 */

import { aetherDB, opfs, storageManager } from '../db';
import { IDB_BLOB_PREFIX } from '../db/types';
import type { AssetRecord, ProjectRecord } from '../db/types';

interface GCOptions {
  /** 宽限期（毫秒），素材最后使用后多久才允许被回收，默认7天 */
  gracePeriodMs?: number;
  /** 是否模拟运行（只报告不实际删除） */
  dryRun?: boolean;
  /** 进度回调 */
  onProgress?: (current: number, total: number, asset?: AssetRecord) => void;
}

interface GCResult {
  scanned: number;
  candidates: number;
  cleaned: number;
  freedBytes: number;
  failed: Array<{ asset: AssetRecord; error: string }>;
  skipped: Array<{ asset: AssetRecord; reason: string }>;
}

class AssetGarbageCollector {
  private isRunning = false;

  /** 检查素材文件是否存在（兼容 OPFS 与 IndexedDB 降级） */
  private async assetFileExists(asset: AssetRecord): Promise<boolean> {
    if (asset.opfsPath.startsWith(IDB_BLOB_PREFIX)) {
      return aetherDB.hasBlob(asset.opfsPath.slice(IDB_BLOB_PREFIX.length));
    }
    return opfs.fileExists(asset.opfsPath);
  }

  /** 删除素材文件（兼容 OPFS 与 IndexedDB 降级） */
  private async deleteAssetFile(asset: AssetRecord): Promise<void> {
    if (asset.opfsPath.startsWith(IDB_BLOB_PREFIX)) {
      await aetherDB.deleteBlob(asset.opfsPath.slice(IDB_BLOB_PREFIX.length));
      return;
    }
    await opfs.deleteFile(asset.opfsPath);
  }

  /**
   * 执行垃圾回收
   * @param projectId 工程ID（不传则扫描所有工程）
   * @param options 回收选项
   */
  async collect(projectId?: string, options: GCOptions = {}): Promise<GCResult> {
    if (this.isRunning) {
      throw new Error('垃圾回收正在进行中，请稍候');
    }

    this.isRunning = true;
    const {
      gracePeriodMs = 7 * 24 * 60 * 60 * 1000,
      dryRun = false,
      onProgress,
    } = options;

    const result: GCResult = {
      scanned: 0,
      candidates: 0,
      cleaned: 0,
      freedBytes: 0,
      failed: [],
      skipped: [],
    };

    try {
      // 获取所有待扫描素材
      let assets: AssetRecord[];
      if (projectId) {
        assets = await aetherDB.getAssetsByProject(projectId);
      } else {
        // 扫描所有工程的素材（需要遍历所有工程）
        const projects = await aetherDB.listProjects();
        const allAssets: AssetRecord[] = [];
        for (const project of projects) {
          const projectAssets = await aetherDB.getAssetsByProject(project.id);
          allAssets.push(...projectAssets);
        }
        assets = allAssets;
      }

      result.scanned = assets.length;
      const now = Date.now();

      // 获取工程数据用于双重验证
      const projectDataCache = new Map<string, any>();
      const getProjectData = async (pid: string) => {
        if (projectDataCache.has(pid)) return projectDataCache.get(pid);
        const project = await aetherDB.getProject(pid);
        const data = project?.data;
        projectDataCache.set(pid, data);
        return data;
      };

      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        onProgress?.(i + 1, assets.length, asset);

        // 检查1：引用计数是否为0
        if (asset.refCount > 0) {
          result.skipped.push({ asset, reason: `引用计数为 ${asset.refCount}` });
          continue;
        }

        // 检查2：是否在宽限期内
        if (now - asset.lastUsedAt < gracePeriodMs) {
          const daysLeft = Math.ceil((gracePeriodMs - (now - asset.lastUsedAt)) / (24 * 60 * 60 * 1000));
          result.skipped.push({ asset, reason: `宽限期内（还剩 ${daysLeft} 天）` });
          continue;
        }

        // 检查3：工程数据中是否真的没有引用（双重验证）
        const projectData = await getProjectData(asset.projectId);
        if (projectData && this.isAssetReferenced(asset.id, projectData)) {
          // 引用计数与实际不符，修正引用计数
          asset.refCount = 1;
          await aetherDB.saveAsset(asset);
          result.skipped.push({ asset, reason: '工程数据中存在引用，已修正引用计数' });
          continue;
        }

        // 检查4：素材文件是否存在
        const fileExists = await this.assetFileExists(asset);
        if (!fileExists) {
          // 文件已丢失，直接删除数据库记录
          if (!dryRun) {
            await aetherDB.deleteAsset(asset.id);
          }
          result.candidates++;
          result.cleaned++;
          continue;
        }

        // 通过所有检查，可以回收
        result.candidates++;

        if (!dryRun) {
          try {
            // 删除素材文件（OPFS 或 IndexedDB 降级）
            await this.deleteAssetFile(asset);
            // 删除数据库记录
            await aetherDB.deleteAsset(asset.id);
            result.freedBytes += asset.size;
            result.cleaned++;
          } catch (e) {
            result.failed.push({
              asset,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 模拟运行（只报告不删除）
   */
  async dryRun(projectId?: string, gracePeriodMs?: number): Promise<GCResult> {
    return this.collect(projectId, { dryRun: true, gracePeriodMs });
  }

  /**
   * 检查素材是否被工程数据引用
   */
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

  /**
   * 重新计算所有素材的引用计数（用于修复引用计数不一致）
   */
  async recalculateRefCounts(projectId: string): Promise<{
    total: number;
    updated: number;
    fixed: number;
  }> {
    const assets = await aetherDB.getAssetsByProject(projectId);
    const project = await aetherDB.getProject(projectId);
    if (!project) throw new Error(`工程不存在: ${projectId}`);

    let updated = 0;
    let fixed = 0;

    for (const asset of assets) {
      const actualRefCount = this.countReferences(asset.id, project.data);
      if (asset.refCount !== actualRefCount) {
        if (asset.refCount === 0 && actualRefCount > 0) {
          fixed++; // 修复了被错误标记为未引用的素材
        }
        asset.refCount = actualRefCount;
        await aetherDB.saveAsset(asset);
        updated++;
      }
    }

    return { total: assets.length, updated, fixed };
  }

  /**
   * 统计素材在工程数据中的引用次数
   */
  private countReferences(assetId: string, projectData: any): number {
    let count = 0;
    try {
      const scenes = projectData.scenes || {};
      for (const scene of Object.values(scenes) as any[]) {
        const elements = scene.els || [];
        for (const element of elements) {
          if (element.refId === assetId) count++;
          if (element.hotspots && Array.isArray(element.hotspots)) {
            for (const hotspot of element.hotspots) {
              if (hotspot.mediaRefId === assetId) count++;
              if (hotspot.iconImageRefId === assetId) count++;
              if (hotspot.iconVideoRefId === assetId) count++;
              if (hotspot.iconModelRefId === assetId) count++;
            }
          }
        }
      }
      if (projectData.globalAssets && Array.isArray(projectData.globalAssets)) {
        for (const ga of projectData.globalAssets) {
          if (ga.refId === assetId) count++;
        }
      }
    } catch (e) {
      console.warn('统计引用次数失败:', e);
    }
    return count;
  }

  /**
   * 获取可回收素材列表（不删除，只展示）
   */
  async getOrphanedAssets(projectId: string, gracePeriodMs?: number): Promise<Array<{
    asset: AssetRecord;
    reason: string;
    canRecover: boolean;
  }>> {
    const assets = await aetherDB.getAssetsByProject(projectId);
    const project = await aetherDB.getProject(projectId);
    const now = Date.now();
    const grace = gracePeriodMs || 7 * 24 * 60 * 60 * 1000;
    const result: Array<{ asset: AssetRecord; reason: string; canRecover: boolean }> = [];

    for (const asset of assets) {
      if (asset.refCount > 0) continue;

      let reason = '引用计数为0';
      let canRecover = true;

      // 检查宽限期
      if (now - asset.lastUsedAt < grace) {
        const daysLeft = Math.ceil((grace - (now - asset.lastUsedAt)) / (24 * 60 * 60 * 1000));
        reason = `宽限期内（还剩 ${daysLeft} 天）`;
        canRecover = false;
      }

      // 双重验证
      if (project && this.isAssetReferenced(asset.id, project.data)) {
        reason = '工程数据中存在引用（引用计数可能不准确）';
        canRecover = false;
      }

      // 检查文件是否存在（兼容 OPFS 与 IndexedDB 降级）
      const fileExists = await this.assetFileExists(asset);
      if (!fileExists) {
        reason = '文件已丢失（仅数据库记录）';
        canRecover = true; // 可以清理数据库记录
      }

      result.push({ asset, reason, canRecover });
    }

    return result;
  }

  /**
   * 自动清理（在应用启动和空闲时调用）
   * 策略：只清理超过30天未使用且引用计数为0的素材
   */
  async autoCleanup(): Promise<GCResult> {
    return this.collect(undefined, {
      gracePeriodMs: 30 * 24 * 60 * 60 * 1000,
      dryRun: false,
    });
  }

  /**
   * 检查垃圾回收是否正在运行
   */
  isGCing(): boolean {
    return this.isRunning;
  }
}

/** 单例导出 */
export const assetGC = new AssetGarbageCollector();
