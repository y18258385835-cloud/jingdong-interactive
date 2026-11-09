import {
  DB_NAME,
  DB_VERSION,
  STORES,
  type ProjectRecord,
  type ProjectSummaryRecord,
} from './types';

type WorkerMessage =
  | { type: 'summaries'; summaries: ProjectSummaryRecord[] }
  | { type: 'complete' }
  | { type: 'error'; message: string };

const workerScope = self as unknown as {
  postMessage(message: WorkerMessage): void;
  close(): void;
  onmessage: (() => void) | null;
};

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const getAllKeys = (
  db: IDBDatabase,
  storeName: string,
  indexName?: string,
): Promise<string[]> => new Promise((resolve, reject) => {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const request = indexName ? store.index(indexName).getAllKeys() : store.getAllKeys();
  request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
  request.onerror = () => reject(request.error);
  tx.onerror = () => reject(tx.error);
});

const toProjectSummary = (project: ProjectRecord): ProjectSummaryRecord => {
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
};

const createSummary = (db: IDBDatabase, id: string): Promise<ProjectSummaryRecord | undefined> => (
  new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.PROJECTS, STORES.PROJECT_SUMMARIES], 'readwrite');
    const request = tx.objectStore(STORES.PROJECTS).get(id);
    let summary: ProjectSummaryRecord | undefined;

    request.onsuccess = () => {
      const project = request.result as ProjectRecord | undefined;
      if (!project) return;
      summary = toProjectSummary(project);
      tx.objectStore(STORES.PROJECT_SUMMARIES).put(summary);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(summary);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Project summary migration aborted'));
  })
);

const migrate = async () => {
  const db = await openDatabase();
  try {
    const [projectIdsAscending, summaryIds] = await Promise.all([
      getAllKeys(db, STORES.PROJECTS, 'by-updatedAt'),
      getAllKeys(db, STORES.PROJECT_SUMMARIES),
    ]);
    const knownIds = new Set(summaryIds);
    let batch: ProjectSummaryRecord[] = [];

    for (const id of projectIdsAscending.reverse()) {
      if (knownIds.has(id)) continue;
      const summary = await createSummary(db, id);
      if (!summary) continue;
      batch.push(summary);
      if (batch.length >= 20) {
        workerScope.postMessage({ type: 'summaries', summaries: batch });
        batch = [];
      }
    }
    if (batch.length > 0) workerScope.postMessage({ type: 'summaries', summaries: batch });
  } finally {
    db.close();
  }
};

workerScope.onmessage = () => {
  void migrate()
    .then(() => workerScope.postMessage({ type: 'complete' }))
    .catch((error) => workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }))
    .finally(() => workerScope.close());
};
