// Desktop Asset & IndexedDB Storage System
import { DB_NAME, LEGACY_DB_NAME } from '../core/schema/version';
import { aetherDB, opfs } from '../core/db';
import { IDB_BLOB_PREFIX } from '../core/db/types';
import { inferMimeTypeFromFileName, withResolvedMediaMimeType } from '../core/assets/mime';

export interface AssetMetadata {
  key: string;
  name: string;
  /** Byte size cached for list views so they do not need to read every Blob. */
  size?: number;
  originalName?: string;
  /** AI-generated asset keys do not include an extension, so the UI needs an explicit type. */
  kind?: 'image' | 'video' | 'audio' | '3d' | 'gaussian-splat' | 'panorama' | 'panorama-video' | 'other';
  /** Import-time identity used to collapse repeated references to one source file. */
  fingerprint?: string;
  sourcePath?: string;
  sourceFolder?: string;
  importedAt: number;
  source: 'local-file' | 'generated' | 'project' | 'unknown';
  proceduralModel?: {
    ai3dCode: string;
    ai3dCodeSource?: 'seed3d' | 'img2threejs';
    ai3dTexture?: string;
    modelAutoRotate?: boolean;
    modelAutoRotateSpeed?: number;
    modelCameraDistance?: number;
    modelViewAzimuth?: number;
    modelViewElevation?: number;
    modelScale?: number;
    ai3dLayerDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
    ai3dLayerDistance?: number;
    ai3dExplodeDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
    ai3dExplodeDistance?: number;
    ai3dExplodeSpeed?: number;
    ai3dExplodeSpin?: number;
    ai3dCollisionDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
    ai3dCollisionDistance?: number;
    ai3dCollisionBounce?: number;
    ai3dCollisionSpeed?: number;
    ai3dLayers?: number;
    ai3dExplode?: number;
    ai3dPhysics?: boolean;
    ai3dLoopEnabled?: boolean;
    ai3dPreviewControls?: import('../types').SceneElement['ai3dPreviewControls'];
    ai3dExportControls?: import('../types').SceneElement['ai3dExportControls'];
    ai3dControlVariant?: import('../types').SceneElement['ai3dControlVariant'];
  };
}

class AssetDatabase {
  private db: IDBDatabase | null = null;
  private isSupported: boolean = typeof window !== 'undefined' && 'indexedDB' in window;
  private cache: Map<string, string> = new Map(); // refId -> objectUrl
  private blobs: Map<string, Blob> = new Map();  // refId -> Blob
  private pendingLoads: Map<string, Promise<string>> = new Map();
  private loadVersions: Map<string, number> = new Map();
  private initPromise: Promise<boolean> | null = null;

  async init(): Promise<boolean> {
    if (!this.isSupported) return false;
    if (this.db) return true;
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 3);
        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('assets')) {
            db.createObjectStore('assets');
          }
          if (!db.objectStoreNames.contains('projects')) {
            db.createObjectStore('projects');
          }
          if (!db.objectStoreNames.contains('assetMetadata')) {
            db.createObjectStore('assetMetadata');
          }
        };
        req.onsuccess = async (e) => {
          this.db = (e.target as IDBOpenDBRequest).result;
          // 一次性迁移旧版素材库（失败不阻塞）
          await this.migrateLegacyDB();
          resolve(true);
        };
        req.onerror = () => {
          console.warn('IndexedDB open error, fallback to memory');
          resolve(false);
        };
      } catch (err) {
        console.warn('IndexedDB not supported or permission denied', err);
        resolve(false);
      }
    });
  }

  /** 确保 IndexedDB 已就绪（幂等；渲染/素材加载链路在读取素材前调用，避免与 init 竞态） */
  async ensureReady(): Promise<boolean> {
    return this.init();
  }

  /**
   * 旧版数据库（AetherDesktopDB_v42）一次性迁移：
   * 把旧库 assets 中尚未存在于新库的素材复制到新库，成功后删除旧库。
   * 铁律 4：失败不静默——保留旧库并记录日志，后续可重试。
   */
  private async migrateLegacyDB(): Promise<void> {
    try {
      const legacy = await this.openLegacyDB();
      if (!legacy) return;
      const keys = await this.getAllKeysOf(legacy, 'assets');
      const current = this.db;
      for (const key of keys) {
        const blob = await this.getValueOf(legacy, 'assets', key);
        if (blob && current) {
          const existing = await this.getValueOf(current, 'assets', key);
          if (!existing) {
            await this.putValueOf(current, 'assets', key, blob);
          }
        }
      }
      legacy.close();
      indexedDB.deleteDatabase(LEGACY_DB_NAME);
    } catch (err) {
      console.warn('[aether] 旧版素材库迁移失败（保留旧库，不影响使用）', err);
    }
  }

  private openLegacyDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        // 先探测旧库是否真实存在，避免 open() 在旧库缺失时误建空库
        const detect = (): Promise<boolean> => {
          if (typeof indexedDB.databases === 'function') {
            return indexedDB.databases().then(
              (dbs) => dbs.some((d) => d.name === LEGACY_DB_NAME),
              () => true // 探测失败时保守按存在处理，交给后续空库校验兜底
            );
          }
          return Promise.resolve(true);
        };
        detect().then((exists) => {
          if (!exists) {
            resolve(null);
            return;
          }
          const req = indexedDB.open(LEGACY_DB_NAME);
          req.onsuccess = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            // 空库兜底：无 assets store 视为无旧数据，关闭并删除，避免残留垃圾库
            if (!db.objectStoreNames.contains('assets')) {
              db.close();
              indexedDB.deleteDatabase(LEGACY_DB_NAME);
              resolve(null);
              return;
            }
            resolve(db);
          };
          req.onerror = () => resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  private getAllKeysOf(db: IDBDatabase, store: string): Promise<string[]> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  private getValueOf(db: IDBDatabase, store: string, key: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as Blob) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private putValueOf(db: IDBDatabase, store: string, key: string, value: Blob): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async put(key: string, data: Blob): Promise<boolean> {
    // 所有来源（特别是 AI 生成弹窗）都可能早于 App 初始化完成写入。
    // 必须等待数据库可用，否则素材只存在于内存，素材面板重载后会丢失。
    await this.ensureReady();
    this.register(key, data);
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(data, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async get(key: string): Promise<Blob | null> {
    if (this.blobs.has(key)) return this.blobs.get(key)!;
    // 页面重开后内存缓存为空，读取前必须等待 IndexedDB 打开完成。
    await this.ensureReady();
    if (!this.db) return this.getP0Asset(key);
    const legacyBlob = await new Promise<Blob | null>((resolve) => {
      try {
        const tx = this.db!.transaction('assets', 'readonly');
        const req = tx.objectStore('assets').get(key);
        req.onsuccess = () => {
          const res = req.result as Blob | undefined;
          if (res) {
            this.blobs.set(key, res);
            resolve(res);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (legacyBlob) return legacyBlob;
    return this.getP0Asset(key);
  }

  async loadUrl(ref: string): Promise<string> {
    const pending = this.pendingLoads.get(ref);
    if (pending) return pending;
    const task = this.loadUrlInternal(ref);
    this.pendingLoads.set(ref, task);
    try {
      return await task;
    } finally {
      if (this.pendingLoads.get(ref) === task) this.pendingLoads.delete(ref);
    }
  }

  private async loadUrlInternal(ref: string): Promise<string> {
    if (!ref) return '';
    const version = this.loadVersions.get(ref) || 0;
    // Historical projects may embed MP4/WebM as a very large data URL. Passing
    // that string straight to several <video> nodes repeatedly parses Base64
    // on the renderer thread. Materialize it once as a Blob URL so native media
    // loading and hardware decoding can use the normal byte-stream path.
    if (/^data:(video|audio)\//i.test(ref)) {
      if (this.cache.has(ref)) return this.cache.get(ref)!;
      try {
        const response = await fetch(ref);
        const blob = await withResolvedMediaMimeType(
          await response.blob(),
          response.headers.get('content-type') ?? undefined,
          ref.slice(5, ref.indexOf(';') > 0 ? ref.indexOf(';') : ref.indexOf(',')),
        );
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          this.cache.set(ref, url);
          return url;
        }
      } catch {
        // Keep the legacy URL as a compatibility fallback for malformed data.
      }
      return ref;
    }
    if (ref.startsWith('data:') || ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('blob:')) {
      return ref;
    }
    if (this.cache.has(ref)) {
      const cachedBlob = this.blobs.get(ref);
      if (!cachedBlob) return this.cache.get(ref)!;
      const typedBlob = await withResolvedMediaMimeType(
        cachedBlob,
        cachedBlob.type,
        inferMimeTypeFromFileName(ref),
      );
      if (typedBlob !== cachedBlob) {
        try { URL.revokeObjectURL(this.cache.get(ref)!); } catch {}
        const url = URL.createObjectURL(typedBlob);
        this.cache.set(ref, url);
        this.blobs.set(ref, typedBlob);
        return url;
      }
      return this.cache.get(ref)!;
    }
    const storedBlob = await this.get(ref);
    const blob = storedBlob
      ? await withResolvedMediaMimeType(storedBlob, storedBlob.type, inferMimeTypeFromFileName(ref))
      : null;
    if (blob) {
      const url = URL.createObjectURL(blob);
      // A delete/replace may have happened while the Blob was being read.
      // Never publish a stale object URL after that invalidation.
      if ((this.loadVersions.get(ref) || 0) !== version) {
        URL.revokeObjectURL(url);
        return ref;
      }
      this.cache.set(ref, url);
      this.blobs.set(ref, blob);
      return url;
    }
    return ref;
  }

  register(key: string, blob: Blob): string {
    this.loadVersions.set(key, (this.loadVersions.get(key) || 0) + 1);
    if (this.cache.has(key)) {
      try {
        URL.revokeObjectURL(this.cache.get(key)!);
      } catch {}
    }
    const url = URL.createObjectURL(blob);
    this.cache.set(key, url);
    this.blobs.set(key, blob);
    return url;
  }

  /** Return an object URL already materialized in this session without I/O. */
  getCachedUrl(key: string): string {
    return this.cache.get(key) || '';
  }

  getBlob(key: string): Blob | undefined {
    return this.blobs.get(key);
  }

  async getAllKeys(): Promise<string[]> {
    // 素材面板可能早于 App 的初始化 effect 执行，不能在 db 尚未就绪时返回空列表。
    await this.ensureReady();
    const legacyKeys = !this.db ? Array.from(this.blobs.keys()) : await new Promise<string[]>((resolve) => {
      try {
        const tx = this.db!.transaction('assets', 'readonly');
        const req = tx.objectStore('assets').getAllKeys();
        req.onsuccess = () => {
          // 内存缓存中可能包含刚生成、正在完成持久化的素材，合并后确保面板立即可见。
          resolve(Array.from(new Set([...(req.result as string[]), ...this.blobs.keys()])));
        };
        req.onerror = () => resolve(Array.from(this.blobs.keys()));
      } catch {
        resolve(Array.from(this.blobs.keys()));
      }
    });
    try {
      const p0Assets = await aetherDB.listAssets();
      return Array.from(new Set([...legacyKeys, ...this.blobs.keys(), ...p0Assets.map((asset) => asset.id)]));
    } catch {
      return Array.from(new Set([...legacyKeys, ...this.blobs.keys()]));
    }
  }

  async delete(key: string): Promise<boolean> {
    // Invalidate in-flight readers before awaiting OPFS/IndexedDB cleanup.
    // The UI must never publish a URL for an item the user already deleted.
    this.loadVersions.set(key, (this.loadVersions.get(key) || 0) + 1);
    this.pendingLoads.delete(key);
    // 素材库同时兼容旧版 assets 表和 P0 素材表。先清理 P0 记录及其文件，
    // 否则 getAllKeys() 会在刷新后把已删除素材重新带回列表。
    try {
      const p0Asset = await aetherDB.getAsset(key);
      if (p0Asset) {
        if (p0Asset.opfsPath.startsWith(IDB_BLOB_PREFIX)) {
          await aetherDB.deleteBlob(p0Asset.opfsPath.slice(IDB_BLOB_PREFIX.length));
        } else {
          try {
            await opfs.deleteFile(p0Asset.opfsPath);
          } catch {
            // 文件可能已被清理，只要索引记录删除即可。
          }
        }
        await aetherDB.deleteAsset(key);
      }
    } catch (error) {
      console.warn('[aether] P0 素材清理失败，继续清理兼容素材库:', error);
    }
    if (this.cache.has(key)) {
      try {
        URL.revokeObjectURL(this.cache.get(key)!);
      } catch {}
      this.cache.delete(key);
    }
    this.blobs.delete(key);
    if (!this.db) return true;
    return new Promise((resolve) => {
      try {
        const stores = this.db!.objectStoreNames.contains('assetMetadata')
          ? ['assets', 'assetMetadata']
          : ['assets'];
        const tx = this.db!.transaction(stores, 'readwrite');
        tx.objectStore('assets').delete(key);
        if (this.db!.objectStoreNames.contains('assetMetadata')) {
          tx.objectStore('assetMetadata').delete(key);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async setMetadata(metadata: AssetMetadata): Promise<boolean> {
    await this.ensureReady();
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('assetMetadata', 'readwrite');
        tx.objectStore('assetMetadata').put(metadata, metadata.key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async getMetadata(key: string): Promise<AssetMetadata | null> {
    await this.ensureReady();
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('assetMetadata', 'readonly');
        const req = tx.objectStore('assetMetadata').get(key);
        req.onsuccess = () => resolve((req.result as AssetMetadata | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /** Resolves assets imported into the P0 OPFS/IndexedDB storage layer. */
  private async getP0Asset(key: string): Promise<Blob | null> {
    try {
      const asset = await aetherDB.getAsset(key);
      if (!asset) return null;
      const blob = asset.opfsPath.startsWith(IDB_BLOB_PREFIX)
        ? await aetherDB.getBlob(asset.opfsPath.slice(IDB_BLOB_PREFIX.length))
        : await opfs.readFile(asset.opfsPath);
      if (!blob) return null;
      // ZIP entries keep bytes but may lose their browser MIME. Recover it
      // before this compatibility bridge returns a blob: URL to the canvas.
      const typedBlob = await withResolvedMediaMimeType(blob, asset.mimeType);
      this.blobs.set(key, typedBlob);
      return typedBlob;
    } catch (error) {
      console.warn('[aether] Unable to read imported project asset:', key, error);
      return null;
    }
  }

  async getAllMetadata(): Promise<AssetMetadata[]> {
    await this.ensureReady();
    if (!this.db) return [];
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('assetMetadata', 'readonly');
        const req = tx.objectStore('assetMetadata').getAll();
        req.onsuccess = () => resolve((req.result as AssetMetadata[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  /** 清空旧版素材库，供崩溃恢复时移除损坏的二进制缓存。 */
  async clearAll(): Promise<void> {
    for (const url of this.cache.values()) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    this.cache.clear();
    this.blobs.clear();
    this.pendingLoads.clear();
    this.loadVersions.clear();
    if (!this.db) return;
    await new Promise<void>((resolve, reject) => {
      try {
        const stores = this.db!.objectStoreNames.contains('assetMetadata')
          ? ['assets', 'projects', 'assetMetadata']
          : ['assets', 'projects'];
        const tx = this.db!.transaction(stores, 'readwrite');
        tx.objectStore('assets').clear();
        tx.objectStore('projects').clear();
        if (this.db!.objectStoreNames.contains('assetMetadata')) {
          tx.objectStore('assetMetadata').clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) { reject(e); }
    });
  }
}

export const dbManager = new AssetDatabase();

export async function processImageFile(file: File, maxDimension: number = 2560): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w <= 0 || h <= 0) {
        reject(new Error(`Image has invalid dimensions: ${file.name}`));
        return;
      }
      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round(h * (maxDimension / w));
          w = maxDimension;
        } else {
          w = Math.round(w * (maxDimension / h));
          h = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        // 检测透明通道以决定输出格式，避免 PNG/WebP 等带透明素材转 JPEG 后透明丢失
        let hasAlpha = false;
        try {
          const imgData = ctx.getImageData(0, 0, w, h).data;
          for (let i = 3; i < imgData.length; i += 4) {
            if (imgData[i] < 255) {
              hasAlpha = true;
              break;
            }
          }
        } catch {
          // canvas 被污染无法读取像素，保守按来源格式处理
          hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
        }
        const mimeType = (file.type === 'image/png' || file.type === 'image/webp' || hasAlpha) ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`Failed to encode image: ${file.name}`));
        }, mimeType, 0.92);
      } else {
        reject(new Error(`Canvas 2D context is unavailable: ${file.name}`));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };
    img.src = tempUrl;
  });
}
