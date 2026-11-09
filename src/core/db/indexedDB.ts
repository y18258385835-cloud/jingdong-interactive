/**
 * IndexedDB 封装
 * 工程配置、素材元数据、订阅缓存、用户偏好存储
 * 使用原生 IndexedDB API，无外部依赖
 */

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  ProjectRecord,
  AssetRecord,
  SubscriptionCache,
  RecentProjectRecord,
  ProjectSummary,
  ProjectSummaryRecord,
} from './types';

class AetherDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private summaryHydrationPromise: Promise<void> | null = null;
  private summaryHydrationListeners = new Set<(summaries: ProjectSummary[]) => void>();

  /** 初始化数据库（单例，多次调用只初始化一次） */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`IndexedDB 打开失败: ${request.error?.message}`));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });

    return this.initPromise;
  }

  /** 创建 Object Stores 和索引 */
  private createStores(db: IDBDatabase): void {
    // projects store
    if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
      const store = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
      store.createIndex('by-updatedAt', 'updatedAt');
      store.createIndex('by-name', 'name');
    }

    // Project cards only need this small record, never the complete scene data.
    if (!db.objectStoreNames.contains(STORES.PROJECT_SUMMARIES)) {
      const store = db.createObjectStore(STORES.PROJECT_SUMMARIES, { keyPath: 'id' });
      store.createIndex('by-updatedAt', 'updatedAt');
    }

    // assets store
    if (!db.objectStoreNames.contains(STORES.ASSETS)) {
      const store = db.createObjectStore(STORES.ASSETS, { keyPath: 'id' });
      store.createIndex('by-projectId', 'projectId');
      store.createIndex('by-hash', 'hash');
    }

    // preferences store
    if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
      db.createObjectStore(STORES.PREFERENCES);
    }

    // subscription store
    if (!db.objectStoreNames.contains(STORES.SUBSCRIPTION)) {
      db.createObjectStore(STORES.SUBSCRIPTION);
    }

    // recentProjects store
    if (!db.objectStoreNames.contains(STORES.RECENT_PROJECTS)) {
      const store = db.createObjectStore(STORES.RECENT_PROJECTS, { keyPath: 'projectId' });
      store.createIndex('by-lastOpenedAt', 'lastOpenedAt');
    }

    // blobs store（OPFS 降级通道：OPFS 不可用时将素材 Blob 存入 IndexedDB）
    if (!db.objectStoreNames.contains(STORES.BLOBS)) {
      db.createObjectStore(STORES.BLOBS);
    }
  }

  /** 确保数据库已初始化 */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) throw new Error('IndexedDB 未初始化');
    return this.db;
  }

  /** 通用事务执行器 */
  private async transaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
  ): Promise<T> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = operation(store);

      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        result.then(resolve).catch(reject);
      }

      tx.onerror = () => reject(tx.error);
    });
  }

  // ==================== 工程操作 ====================

  /** 保存工程（新增或更新） */
  private toProjectSummary(project: ProjectRecord): ProjectSummaryRecord {
    const scenes = project.data?.scenes;
    return {
      id: project.id,
      name: project.name || '未命名工程',
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      version: project.version,
      thumbnail: typeof project.thumbnail === 'string' && project.thumbnail.length <= 512 * 1024
        ? project.thumbnail
        : undefined,
      assetIds: Array.isArray(project.assetIds) ? project.assetIds : [],
      isDeleted: project.isDeleted,
      sceneCount: scenes && typeof scenes === 'object' ? Object.keys(scenes).length : 0,
    };
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    project.updatedAt = Date.now();
    const summary = this.toProjectSummary(project);
    const db = await this.ensureDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.PROJECTS, STORES.PROJECT_SUMMARIES], 'readwrite');
      tx.objectStore(STORES.PROJECTS).put(project);
      tx.objectStore(STORES.PROJECT_SUMMARIES).put(summary);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Project save aborted'));
    });
  }

  /** 获取工程 */
  async getProject(id: string): Promise<ProjectRecord | undefined> {
    return this.transaction(STORES.PROJECTS, 'readonly', (store) => store.get(id));
  }

  /** Update only the preview pointer so a late thumbnail capture cannot overwrite newer project data. */
  async updateProjectThumbnail(id: string, thumbnail: string): Promise<void> {
    const db = await this.ensureDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.PROJECTS, STORES.PROJECT_SUMMARIES], 'readwrite');
      const store = tx.objectStore(STORES.PROJECTS);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const project = request.result as ProjectRecord | undefined;
        if (!project) {
          reject(new Error(`Project not found: ${id}`));
          return;
        }
        const updatedProject = { ...project, thumbnail };
        store.put(updatedProject);
        tx.objectStore(STORES.PROJECT_SUMMARIES).put(this.toProjectSummary(updatedProject));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Thumbnail update aborted'));
    });
  }

  /** 获取所有工程（按更新时间倒序） */
  async listProjects(): Promise<ProjectRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROJECTS, 'readonly');
      const store = tx.objectStore(STORES.PROJECTS);
      const index = store.index('by-updatedAt');
      const request = index.getAll();
      request.onsuccess = () => {
        // 倒序排列（最新的在前）
        resolve((request.result as ProjectRecord[]).reverse());
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** 删除工程 */
  async deleteProject(id: string): Promise<void> {
    const db = await this.ensureDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.PROJECTS, STORES.PROJECT_SUMMARIES], 'readwrite');
      tx.objectStore(STORES.PROJECTS).delete(id);
      tx.objectStore(STORES.PROJECT_SUMMARIES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Project delete aborted'));
    });
  }

  /** 工程数量 */
  async countProjects(): Promise<number> {
    return this.transaction(STORES.PROJECTS, 'readonly', (store) => store.count());
  }

  // ==================== 素材操作 ====================

  /** 保存素材 */
  async saveAsset(asset: AssetRecord): Promise<void> {
    await this.transaction(STORES.ASSETS, 'readwrite', (store) => store.put(asset));
  }

  /** 获取素材 */
  async getAsset(id: string): Promise<AssetRecord | undefined> {
    return this.transaction(STORES.ASSETS, 'readonly', (store) => store.get(id));
  }

  /** 获取所有素材记录，供遗留编辑器素材库兼容读取新存储层。 */
  async listAssets(): Promise<AssetRecord[]> {
    return this.transaction(STORES.ASSETS, 'readonly', (store) => store.getAll());
  }

  /** 获取工程的所有素材 */
  async getAssetsByProject(projectId: string): Promise<AssetRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ASSETS, 'readonly');
      const store = tx.objectStore(STORES.ASSETS);
      const index = store.index('by-projectId');
      const request = index.getAll(projectId);
      request.onsuccess = () => resolve(request.result as AssetRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  /** 按哈希查找素材（去重用） */
  async getAssetByHash(hash: string): Promise<AssetRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ASSETS, 'readonly');
      const store = tx.objectStore(STORES.ASSETS);
      const index = store.index('by-hash');
      const request = index.get(hash);
      request.onsuccess = () => resolve(request.result as AssetRecord | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /** 删除素材 */
  async deleteAsset(id: string): Promise<void> {
    await this.transaction(STORES.ASSETS, 'readwrite', (store) => store.delete(id));
  }

  /** 更新素材引用计数 */
  async updateAssetRefCount(id: string, delta: number): Promise<void> {
    const asset = await this.getAsset(id);
    if (!asset) return;
    asset.refCount = Math.max(0, asset.refCount + delta);
    asset.lastUsedAt = Date.now();
    await this.saveAsset(asset);
  }

  // ==================== Blob 存储（OPFS 降级通道） ====================

  /** 存储 Blob（key 一般为素材 ID，OPFS 不可用时使用） */
  async putBlob(key: string, blob: Blob): Promise<void> {
    await this.transaction(STORES.BLOBS, 'readwrite', (store) => store.put(blob, key));
  }

  /** 读取 Blob */
  async getBlob(key: string): Promise<Blob | undefined> {
    return this.transaction(STORES.BLOBS, 'readonly', (store) => store.get(key));
  }

  /** 删除 Blob */
  async deleteBlob(key: string): Promise<void> {
    await this.transaction(STORES.BLOBS, 'readwrite', (store) => store.delete(key));
  }

  /** 检查 Blob 是否存在 */
  async hasBlob(key: string): Promise<boolean> {
    const blob = await this.getBlob(key);
    return !!blob;
  }

  // ==================== 订阅缓存操作 ====================

  /** 保存订阅缓存 */
  async saveSubscription(sub: SubscriptionCache): Promise<void> {
    await this.transaction(STORES.SUBSCRIPTION, 'readwrite', (store) => store.put(sub, 'current'));
  }

  /** 获取订阅缓存 */
  async getSubscription(): Promise<SubscriptionCache | undefined> {
    return this.transaction(STORES.SUBSCRIPTION, 'readonly', (store) => store.get('current'));
  }

  /** 清除订阅缓存（登出时） */
  async clearSubscription(): Promise<void> {
    await this.transaction(STORES.SUBSCRIPTION, 'readwrite', (store) => store.delete('current'));
  }

  // ==================== 偏好设置操作 ====================

  /** 设置偏好 */
  async setPreference(key: string, value: any): Promise<void> {
    await this.transaction(STORES.PREFERENCES, 'readwrite', (store) => store.put(value, key));
  }

  /** 获取偏好 */
  async getPreference<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const val = await this.transaction(STORES.PREFERENCES, 'readonly', (store) => store.get(key));
    return val !== undefined ? (val as T) : defaultValue;
  }

  /** 删除偏好 */
  async deletePreference(key: string): Promise<void> {
    await this.transaction(STORES.PREFERENCES, 'readwrite', (store) => store.delete(key));
  }

  // ==================== 最近工程操作 ====================

  /** 添加到最近工程 */
  async addRecentProject(record: RecentProjectRecord): Promise<void> {
    record.lastOpenedAt = Date.now();
    await this.transaction(STORES.RECENT_PROJECTS, 'readwrite', (store) => store.put(record));
    // 只保留最近20个
    await this.trimRecentProjects(20);
  }

  /** 获取最近工程列表 */
  async getRecentProjects(limit = 10): Promise<RecentProjectRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RECENT_PROJECTS, 'readonly');
      const store = tx.objectStore(STORES.RECENT_PROJECTS);
      const index = store.index('by-lastOpenedAt');
      const request = index.getAll();
      request.onsuccess = () => {
        const all = request.result as RecentProjectRecord[];
        resolve(all.reverse().slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** 清理最近工程（只保留指定数量） */
  private async trimRecentProjects(maxCount: number): Promise<void> {
    const all = await this.getRecentProjects(100);
    if (all.length <= maxCount) return;
    const toDelete = all.slice(maxCount);
    for (const record of toDelete) {
      await this.transaction(STORES.RECENT_PROJECTS, 'readwrite', (store) =>
        store.delete(record.projectId)
      );
    }
  }

  /** 从最近工程移除 */
  async removeRecentProject(projectId: string): Promise<void> {
    await this.transaction(STORES.RECENT_PROJECTS, 'readwrite', (store) => store.delete(projectId));
  }

  // ==================== 数据库维护 ====================

  /** 清空所有数据（谨慎使用，用于重置） */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    const stores = Object.values(STORES);
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  /** 只读取工程管理需要的摘要，避免一次性把所有完整工程 JSON 放入内存。 */
  private async listLegacyProjectSummaries(): Promise<ProjectSummary[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROJECTS, 'readonly');
      const store = tx.objectStore(STORES.PROJECTS);
      const index = store.index('by-updatedAt');
      const summaries: ProjectSummary[] = [];
      const request = index.openCursor(null, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(summaries);
          return;
        }
        const value = cursor.value as ProjectRecord;
        const data = value?.data;
        summaries.push({
          id: value.id,
          name: value.name || '未命名工程',
          description: value.description,
          createdAt: value.createdAt,
          updatedAt: value.updatedAt,
          version: value.version,
          thumbnail: typeof value.thumbnail === 'string' && value.thumbnail.length <= 512 * 1024
            ? value.thumbnail
            : undefined,
          assetIds: Array.isArray(value.assetIds) ? value.assetIds : [],
          isDeleted: value.isDeleted,
          sceneCount: data?.scenes && typeof data.scenes === 'object'
            ? Object.keys(data.scenes).length
            : 0,
        });
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** 清除可能导致渲染崩溃的工程、素材及二进制数据，保留订阅和用户偏好。 */
  /** Reads only records from the dedicated lightweight summary store. */
  async listProjectSummaries(): Promise<ProjectSummary[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PROJECT_SUMMARIES, 'readonly');
      const request = tx.objectStore(STORES.PROJECT_SUMMARIES).index('by-updatedAt').getAll();
      request.onsuccess = () => resolve((request.result as ProjectSummary[]).reverse());
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Migrates pre-v3 projects off the UI thread and streams back tiny records. */
  async hydrateProjectSummaries(onBatch?: (summaries: ProjectSummary[]) => void): Promise<void> {
    if (onBatch) this.summaryHydrationListeners.add(onBatch);

    if (!this.summaryHydrationPromise) {
      this.summaryHydrationPromise = this.runProjectSummaryWorker().finally(() => {
        this.summaryHydrationPromise = null;
      });
    }

    try {
      await this.summaryHydrationPromise;
    } finally {
      if (onBatch) this.summaryHydrationListeners.delete(onBatch);
    }
  }

  private runProjectSummaryWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./projectSummary.worker.ts', import.meta.url), { type: 'module' });
      const finish = (error?: Error) => {
        worker.terminate();
        if (error) reject(error);
        else resolve();
      };

      worker.onmessage = (event: MessageEvent<
        | { type: 'summaries'; summaries: ProjectSummary[] }
        | { type: 'complete' }
        | { type: 'error'; message: string }
      >) => {
        if (event.data.type === 'summaries') {
          for (const listener of this.summaryHydrationListeners) listener(event.data.summaries);
          return;
        }
        if (event.data.type === 'error') {
          finish(new Error(event.data.message));
          return;
        }
        finish();
      };
      worker.onerror = (event) => finish(new Error(event.message || 'Project summary worker failed'));
      worker.postMessage({ type: 'start' });
    });
  }

  async clearProjectData(): Promise<void> {
    const db = await this.ensureDB();
    const stores = [STORES.PROJECTS, STORES.PROJECT_SUMMARIES, STORES.ASSETS, STORES.RECENT_PROJECTS, STORES.BLOBS];
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const request = tx.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  /** 获取数据库使用统计 */
  async getStats(): Promise<{
    projectCount: number;
    assetCount: number;
    recentCount: number;
  }> {
    const [projectCount, assetCount, recentCount] = await Promise.all([
      this.countProjects(),
      this.transaction(STORES.ASSETS, 'readonly', (store) => store.count()),
      this.transaction(STORES.RECENT_PROJECTS, 'readonly', (store) => store.count()),
    ]);
    return { projectCount, assetCount, recentCount };
  }

  /** 关闭数据库连接 */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

/** 单例导出 */
export const aetherDB = new AetherDB();
