/**
 * 素材加载器
 * 负责从 OPFS 加载素材并生成可用的 URL（ObjectURL）
 * 管理 URL 生命周期：创建、缓存、引用计数、释放
 * 防止内存泄漏：ObjectURL 必须显式释放
 */

import { aetherDB, opfs } from '../db';
import { IDB_BLOB_PREFIX } from '../db/types';
import type { AssetRecord } from '../db/types';
import { createLoadTask, type LoadTask, type LoadTaskOptions } from './loadTask';
import { withResolvedMediaMimeType } from './mime';

interface CachedURL {
  url: string;
  refCount: number;
  assetId: string;
  createdAt: number;
}

class AssetLoader {
  private urlCache = new Map<string, CachedURL>();
  private dataURLCache = new Map<string, string>();
  private pendingLoads = new Map<string, Promise<string>>();

  /**
   * 读取素材 Blob：兼容 OPFS 与 IndexedDB 降级两种存储位置。
   * opfsPath 以 "idb://" 开头时从 IndexedDB blobs store 读取，否则从 OPFS 读取。
   */
  private async readAssetBlob(asset: AssetRecord): Promise<Blob> {
    if (asset.opfsPath.startsWith(IDB_BLOB_PREFIX)) {
      const key = asset.opfsPath.slice(IDB_BLOB_PREFIX.length);
      const blob = await aetherDB.getBlob(key);
      if (!blob) {
        throw new Error(`素材数据丢失（IndexedDB）: ${asset.name}`);
      }
      return withResolvedMediaMimeType(blob, asset.mimeType);
    }
    return withResolvedMediaMimeType(await opfs.readFile(asset.opfsPath), asset.mimeType);
  }

  /**
   * 加载素材为 ObjectURL（用于 img/video/audio 标签）
   * 同一素材多次调用会复用 URL 并增加引用计数
   * @param assetId 素材ID
   * @returns ObjectURL 字符串
   */
  async loadAssetURL(assetId: string): Promise<string> {
    // 检查缓存
    const cached = this.urlCache.get(assetId);
    if (cached) {
      cached.refCount++;
      return cached.url;
    }

    const pending = this.pendingLoads.get(assetId);
    if (pending) {
      const url = await pending;
      const ready = this.urlCache.get(assetId);
      if (ready) ready.refCount++;
      return url;
    }

    const task = this.loadAssetURLInternal(assetId);
    this.pendingLoads.set(assetId, task);
    try {
      return await task;
    } finally {
      if (this.pendingLoads.get(assetId) === task) this.pendingLoads.delete(assetId);
    }
  }

  private async loadAssetURLInternal(assetId: string): Promise<string> {

    // 获取素材记录
    const asset = await aetherDB.getAsset(assetId);
    if (!asset) {
      throw new Error(`素材不存在: ${assetId}`);
    }

    // 检查素材文件是否存在（兼容 OPFS 与 IndexedDB 降级）
    const isIdbBlob = asset.opfsPath.startsWith(IDB_BLOB_PREFIX);
    const exists = isIdbBlob
      ? await aetherDB.hasBlob(asset.opfsPath.slice(IDB_BLOB_PREFIX.length))
      : await opfs.fileExists(asset.opfsPath);
    if (!exists) {
      throw new Error(`素材文件丢失: ${asset.name}（${asset.opfsPath}）`);
    }

    // 读取素材并创建 ObjectURL
    const blob = await this.readAssetBlob(asset);
    const url = URL.createObjectURL(blob);

    // 缓存
    this.urlCache.set(assetId, {
      url,
      refCount: 1,
      assetId,
      createdAt: Date.now(),
    });

    return url;
  }

  /** 可观测的资源加载入口，适用于视频、3D、全景等需要进度/取消/超时的场景。 */
  loadAssetURLTask(assetId: string, options: LoadTaskOptions = {}): LoadTask<string> {
    return createLoadTask(async ({ report }) => {
      report(0.1);
      const url = await this.loadAssetURL(assetId);
      report(1);
      return url;
    }, options);
  }

  loadAssetBlobTask(assetId: string, options: LoadTaskOptions = {}): LoadTask<Blob> {
    return createLoadTask(async ({ report }) => {
      report(0.1);
      const blob = await this.loadAssetAsBlob(assetId);
      report(1);
      return blob;
    }, options);
  }

  /**
   * 加载素材为 DataURL（base64，用于小文件/缩略图/工程导出）
   * 大文件不建议使用此方法，会占用大量内存
   * @param assetId 素材ID
   * @returns DataURL 字符串
   */
  async loadAssetAsDataURL(assetId: string): Promise<string> {
    // 检查缓存
    const cached = this.dataURLCache.get(assetId);
    if (cached) return cached;

    const asset = await aetherDB.getAsset(assetId);
    if (!asset) {
      throw new Error(`素材不存在: ${assetId}`);
    }

    const dataURL = await this.blobToDataURL(await this.readAssetBlob(asset));
    this.dataURLCache.set(assetId, dataURL);
    return dataURL;
  }

  /** Blob 转 DataURL */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 加载素材为 Blob
   * @param assetId 素材ID
   * @returns Blob 对象
   */
  async loadAssetAsBlob(assetId: string): Promise<Blob> {
    const asset = await aetherDB.getAsset(assetId);
    if (!asset) {
      throw new Error(`素材不存在: ${assetId}`);
    }
    return await this.readAssetBlob(asset);
  }

  /**
   * 加载素材为 ArrayBuffer（用于 3D 模型、高斯泼溅等需要二进制解析的场景）
   * @param assetId 素材ID
   * @returns ArrayBuffer
   */
  async loadAssetAsArrayBuffer(assetId: string): Promise<ArrayBuffer> {
    const asset = await aetherDB.getAsset(assetId);
    if (!asset) {
      throw new Error(`素材不存在: ${assetId}`);
    }
    return await (await this.readAssetBlob(asset)).arrayBuffer();
  }

  /**
   * 加载素材为文本（用于 GLTF JSON、配置文件等）
   * @param assetId 素材ID
   * @returns 文本内容
   */
  async loadAssetAsText(assetId: string): Promise<string> {
    const asset = await aetherDB.getAsset(assetId);
    if (!asset) {
      throw new Error(`素材不存在: ${assetId}`);
    }
    return await (await this.readAssetBlob(asset)).text();
  }

  /**
   * 释放素材 URL（减少引用计数，引用计数为0时真正释放）
   * 必须在组件卸载或不再使用时调用，防止内存泄漏
   * @param assetId 素材ID
   */
  releaseAssetURL(assetId: string): void {
    const cached = this.urlCache.get(assetId);
    if (!cached) return;

    cached.refCount--;
    if (cached.refCount <= 0) {
      URL.revokeObjectURL(cached.url);
      this.urlCache.delete(assetId);
    }
  }

  /**
   * 强制释放素材 URL（忽略引用计数）
   * 用于工程切换、全局清理等场景
   * @param assetId 素材ID
   */
  forceReleaseAssetURL(assetId: string): void {
    const cached = this.urlCache.get(assetId);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      this.urlCache.delete(assetId);
    }
  }

  /**
   * 释放所有缓存的 URL（工程切换时调用）
   */
  releaseAllURLs(): void {
    for (const [, cached] of this.urlCache) {
      URL.revokeObjectURL(cached.url);
    }
    this.urlCache.clear();
    this.dataURLCache.clear();
    this.pendingLoads.clear();
  }

  /**
   * 获取素材记录
   * @param assetId 素材ID
   * @returns AssetRecord 或 undefined
   */
  async getAsset(assetId: string): Promise<AssetRecord | undefined> {
    return await aetherDB.getAsset(assetId);
  }

  /**
   * 批量加载素材 URL（用于场景切换时预加载）
   * @param assetIds 素材ID列表
   * @returns Map<assetId, url> 加载成功的映射
   */
  async preloadAssets(assetIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const promises = assetIds.map(async (id) => {
      try {
        const url = await this.loadAssetURL(id);
        result.set(id, url);
      } catch (e) {
        console.warn(`预加载素材失败: ${id}`, e);
      }
    });
    await Promise.all(promises);
    return result;
  }

  /**
   * 获取当前缓存状态（用于调试和内存监控）
   */
  getCacheStats(): {
    urlCacheCount: number;
    dataURLCacheCount: number;
    totalRefCount: number;
    cachedAssetIds: string[];
  } {
    let totalRefCount = 0;
    const cachedAssetIds: string[] = [];
    for (const [id, cached] of this.urlCache) {
      totalRefCount += cached.refCount;
      cachedAssetIds.push(id);
    }
    return {
      urlCacheCount: this.urlCache.size,
      dataURLCacheCount: this.dataURLCache.size,
      totalRefCount,
      cachedAssetIds,
    };
  }

  /**
   * 清理超过指定时间未使用的缓存（自动内存管理）
   * @param maxAgeMs 最大未使用时间（毫秒），默认30分钟
   */
  cleanupStaleCache(maxAgeMs = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, cached] of this.urlCache) {
      if (cached.refCount <= 0 && now - cached.createdAt > maxAgeMs) {
        URL.revokeObjectURL(cached.url);
        this.urlCache.delete(id);
        cleanedCount++;
      }
    }

    // DataURL 缓存全部清理（它们没有引用计数，且占用内存大）
    if (this.dataURLCache.size > 0) {
      cleanedCount += this.dataURLCache.size;
      this.dataURLCache.clear();
    }

    return cleanedCount;
  }

  /**
   * 检查素材是否已加载到缓存
   */
  isAssetCached(assetId: string): boolean {
    return this.urlCache.has(assetId) || this.dataURLCache.has(assetId);
  }

  /**
   * 获取已缓存的 URL（不触发加载）
   */
  getCachedURL(assetId: string): string | undefined {
    return this.urlCache.get(assetId)?.url;
  }
}

/** 单例导出 */
export const assetLoader = new AssetLoader();
