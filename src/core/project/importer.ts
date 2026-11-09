/**
 * 工程导入器
 * 从 .aether 文件（ZIP 包）导入工程
 * 功能：解析ZIP、验证清单、校验完整性、导入素材、保存工程、处理ID映射
 */

import JSZip from 'jszip';
import { aetherDB, opfs } from '../db';
import type { ProjectRecord, AssetRecord, AssetType } from '../db/types';
import { APP_VERSION, IDB_BLOB_PREFIX, PROJECT_FORMAT_VERSION } from '../db/types';
import { normalizeProjectData, isNormalizeOk } from '../schema/normalize';
import { scanProjectHealth } from './healthCheck';
import { collectUnresolvedPackagedAssetReferences, replaceProjectAssetReferences } from './assetReferences';
import { inferMimeTypeFromFileName, isSpecificMimeType, withResolvedMediaMimeType } from '../assets/mime';

interface ImportOptions {
  /** 是否导入素材文件（默认 true） */
  includeAssets?: boolean;
  /** 导入进度回调 */
  onProgress?: (stage: string, progress: number) => void;
  /** 是否覆盖同名工程（默认 false，会创建副本） */
  overwrite?: boolean;
  /** 指定新工程名称（不传则使用原名称） */
  newProjectName?: string;
  signal?: AbortSignal;
}

interface ImportResult {
  projectId: string;
  projectName: string;
  assetCount: number;
  importedAssets: number;
  skippedAssets: number;
  warnings: string[];
  totalSize: number;
}

interface ManifestData {
  formatVersion: string;
  appVersion: string;
  exportedAt: number;
  projectId: string;
  projectName: string;
  assetCount: number;
  totalSize: number;
  assets: Array<{
    id: string;
    name: string;
    type: string;
    mimeType?: string;
    size: number;
    hash: string;
    path: string;
  }>;
  checksum: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Unable to read thumbnail'));
    reader.readAsDataURL(blob);
  });
}

class ProjectImporter {
  /**
   * 从 .aether 文件导入工程
   * @param file .aether 文件（或任意 ZIP 文件）
   * @param options 导入选项
   * @returns 导入结果
   */
  async importProject(file: File, options: ImportOptions = {}): Promise<ImportResult> {
    const {
      includeAssets = true,
      onProgress,
      overwrite = false,
      newProjectName,
    } = options;

    const warnings: string[] = [];
    onProgress?.('解析文件', 0.05);

    // ① 读取并解析 ZIP
    const zip = await JSZip.loadAsync(file);
    onProgress?.('验证文件结构', 0.1);

    // ② 检查必要文件
    const manifestFile = zip.file('manifest.json');
    const projectFile = zip.file('project.json');

    if (!projectFile) {
      throw new Error('无效的工程文件：缺少 project.json');
    }

    // ③ 读取 manifest（可选，旧版本可能没有）
    let manifest: ManifestData | null = null;
    if (manifestFile) {
      try {
        const manifestStr = await manifestFile.async('string');
        manifest = JSON.parse(manifestStr);
      } catch (e) {
        throw new Error('工程包损坏：manifest.json 无法解析');
      }
    } else {
      warnings.push('缺少 manifest.json，可能是旧版本工程文件');
    }

    onProgress?.('读取工程数据', 0.15);

    // ④ 读取工程数据
    const projectJsonStr = await projectFile.async('string');
    let projectData: any;
    try {
      projectData = JSON.parse(projectJsonStr);
    } catch (e) {
      throw new Error('工程数据解析失败：JSON 格式错误');
    }

    const normalized = normalizeProjectData(projectData);
    if (!isNormalizeOk(normalized)) {
      throw new Error(`工程数据校验失败：${normalized.error.message}`);
    }
    projectData = normalized.data;
    warnings.push(...normalized.warnings);

    if (manifest) {
      if (!Array.isArray(manifest.assets)) {
        throw new Error('工程包损坏：manifest.json 缺少素材清单');
      }
      const declaredSize = manifest.assets.reduce((total, asset) => total + Number(asset.size || 0), 0);
      if (manifest.assetCount !== manifest.assets.length) {
        throw new Error(`工程包损坏：素材数量声明为 ${manifest.assetCount}，清单实际为 ${manifest.assets.length}`);
      }
      if (manifest.totalSize !== declaredSize) {
        throw new Error(`工程包损坏：素材总大小声明为 ${manifest.totalSize}，清单实际为 ${declaredSize}`);
      }
      const assetIds = new Set<string>();
      const assetPaths = new Set<string>();
      for (const asset of manifest.assets) {
        if (!asset.id || !asset.path || assetIds.has(asset.id) || assetPaths.has(asset.path)) {
          throw new Error(`工程包损坏：素材清单存在重复或无效项（${asset.name || asset.id || asset.path || '未知素材'}）`);
        }
        assetIds.add(asset.id);
        assetPaths.add(asset.path);
      }
    }

    // Reject incomplete archives before any assets are written. Previously a
    // missing mapping was treated as a warning and opened as a placeholder.
    if (includeAssets) {
      const manifestIds = new Set(manifest?.assets.map((asset) => asset.id) || []);
      const unresolved = collectUnresolvedPackagedAssetReferences(projectData, manifestIds);
      if (unresolved.length) {
        throw new Error(`工程包素材映射不完整：${unresolved.length} 个本地引用无法导入（${unresolved.slice(0, 3).join(', ')}）。`);
      }
      const missingFiles = (manifest?.assets || []).filter((asset) => !zip.file(asset.path));
      if (missingFiles.length) {
        throw new Error(`工程包缺少 ${missingFiles.length} 个素材文件（${missingFiles.slice(0, 3).map((asset) => asset.name).join(', ')}）。`);
      }
    }

    // ⑤ 版本兼容性检查
    if (manifest) {
      const versionCompare = this.compareVersions(manifest.formatVersion, PROJECT_FORMAT_VERSION);
      if (versionCompare > 0) {
        warnings.push(`工程文件版本 (${manifest.formatVersion}) 高于当前应用版本 (${PROJECT_FORMAT_VERSION})，部分功能可能不兼容`);
      }
    }

    onProgress?.('生成新工程ID', 0.2);

    // ⑥ 生成新工程ID（避免与现有工程冲突）
    const newProjectId = this.generateProjectId();
    const projectName = newProjectName || manifest?.projectName || '导入的工程';

    // ⑦ 处理素材导入
    const idMapping = new Map<string, string>(); // 旧素材ID -> 新素材ID
    let importedAssets = 0;
    let skippedAssets = 0;
    let totalSize = 0;
    const createdAssets: Array<{ id: string; path: string }> = [];
    const reusedAssetOriginals = new Map<string, AssetRecord>();
    let projectSaved = false;
    let thumbnailPath: string | undefined;

    const rollback = async () => {
      await Promise.allSettled(createdAssets.map(async (asset) => {
        await aetherDB.deleteAsset(asset.id).catch(() => undefined);
        if (asset.path.startsWith(IDB_BLOB_PREFIX)) {
          await aetherDB.deleteBlob(asset.path.slice(IDB_BLOB_PREFIX.length)).catch(() => undefined);
        } else {
          await opfs.deleteFile(asset.path).catch(() => undefined);
        }
      }));
      await Promise.allSettled(Array.from(reusedAssetOriginals.values()).map((asset) => aetherDB.saveAsset(asset)));
      if (projectSaved) {
        await aetherDB.deleteProject(newProjectId).catch(() => undefined);
        await aetherDB.removeRecentProject(newProjectId).catch(() => undefined);
      }
      if (thumbnailPath) await opfs.deleteFile(thumbnailPath).catch(() => undefined);
    };

    try {
    if (includeAssets && manifest && manifest.assets.length > 0) {
      onProgress?.('导入素材文件', 0.3);

      const assets = manifest.assets;
    for (let i = 0; i < assets.length; i++) {
        if (options.signal?.aborted) throw new Error('工程导入已取消');
        const assetInfo = assets[i];
        const progress = 0.3 + (i / assets.length) * 0.5;
        onProgress?.(`导入素材: ${assetInfo.name}`, progress);

        try {
          // 从 ZIP 中读取素材文件
          const zipFile = zip.file(assetInfo.path);
          if (!zipFile) {
            throw new Error(`素材文件缺失: ${assetInfo.name}`);
          }

          const archivedBlob = await zipFile.async('blob');
          await this.assertBlobIntegrity(archivedBlob, assetInfo);
          // JSZip restores bytes but not the original browser MIME type. A
          // blob: URL without video/* can be present yet fail media decoding.
          const declaredMimeType = isSpecificMimeType(assetInfo.mimeType)
            ? assetInfo.mimeType
            : undefined;
          const blob = await withResolvedMediaMimeType(
            archivedBlob,
            declaredMimeType,
            inferMimeTypeFromFileName(assetInfo.name),
            inferMimeTypeFromFileName(assetInfo.path),
          );
          // The resolved Blob type wins over stale manifest metadata. This is
          // essential for repairing older packages that labelled MP4 as PNG.
          const mimeType = blob.type || declaredMimeType || 'application/octet-stream';

          // 哈希去重检查
          const existing = await aetherDB.getAssetByHash(assetInfo.hash);
          if (existing) {
            await this.assertPersistedAssetIntegrity(existing, assetInfo);
            // 同哈希素材已存在，复用
            if (!reusedAssetOriginals.has(existing.id)) reusedAssetOriginals.set(existing.id, { ...existing });
            idMapping.set(assetInfo.id, existing.id);
            existing.refCount++;
            existing.lastUsedAt = Date.now();
            existing.mimeType = mimeType;
            await aetherDB.saveAsset(existing);
            skippedAssets++;
            continue;
          }

          // 生成新素材ID和OPFS路径
          const newAssetId = this.generateAssetId();
          const extension = this.getExtensionFromPath(assetInfo.path);
          const opfsPath = opfs.generateAssetPath(newAssetId, extension);

          // 写入 OPFS
          let actualPath = opfsPath;
          try {
            await opfs.writeFile(opfsPath, blob);
          } catch (error) {
            console.warn('[ProjectImporter] OPFS write failed; falling back to IndexedDB Blob:', assetInfo.name, error);
            await opfs.deleteFile(opfsPath).catch(() => undefined);
            await aetherDB.putBlob(newAssetId, blob);
            actualPath = `${IDB_BLOB_PREFIX}${newAssetId}`;
          }

          createdAssets.push({ id: newAssetId, path: actualPath });
          await this.assertStoredBlobIntegrity(actualPath, assetInfo);

          // 创建素材记录
          const assetRecord: AssetRecord = {
            id: newAssetId,
            projectId: newProjectId,
            name: assetInfo.name,
            type: assetInfo.type as AssetType,
            mimeType,
            size: assetInfo.size,
            hash: assetInfo.hash,
            opfsPath: actualPath,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            refCount: 1,
          };
          await aetherDB.saveAsset(assetRecord);

          idMapping.set(assetInfo.id, newAssetId);
          importedAssets++;
          totalSize += assetInfo.size;
        } catch (e) {
          throw new Error(`素材导入失败：${assetInfo.name} - ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else if (includeAssets) {
      warnings.push('工程文件中没有素材清单，将只导入工程配置');
    }

    onProgress?.('更新素材引用', 0.8);

    // ⑧ 更新工程数据中的素材引用（旧ID -> 新ID）
    if (idMapping.size > 0) {
      projectData = replaceProjectAssetReferences(projectData, idMapping);
    }

    const unresolvedAfterImport = collectUnresolvedPackagedAssetReferences(projectData, new Set(idMapping.values()));
    if (includeAssets && unresolvedAfterImport.length) {
      throw new Error(`导入已中止：${unresolvedAfterImport.length} 个素材未能完成写入或映射（${unresolvedAfterImport.slice(0, 3).join(', ')}）。`);
    }

    const health = scanProjectHealth(projectData, new Set(idMapping.values()));
    if (!health.ok) {
      throw new Error(`工程健康检查失败：${health.issues.slice(0, 3).map((issue) => issue.message).join('；')}`);
    }

    // 清理导出时添加的临时字段
    delete projectData._exportedAssetIds;

    onProgress?.('保存工程', 0.9);

    // ⑨ 保存工程到 IndexedDB
    const projectRecord: ProjectRecord = {
      id: newProjectId,
      name: projectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: PROJECT_FORMAT_VERSION,
      data: projectData,
      assetIds: Array.from(idMapping.values()),
    };

    // 处理缩略图
    const thumbnailFile = zip.file('thumbnail.png');
    if (thumbnailFile) {
      try {
        const thumbBlob = await thumbnailFile.async('blob');
        const thumbPath = opfs.generateThumbnailPath(newProjectId);
        try {
          await opfs.writeFile(thumbPath, thumbBlob);
          thumbnailPath = thumbPath;
        } catch (storageError) {
          // Preserve the preview in IndexedDB if OPFS is unavailable instead
          // of silently discarding it during an otherwise successful import.
          console.warn('[project-import] OPFS thumbnail write failed; using IndexedDB data URL.', storageError);
          thumbnailPath = await blobToDataUrl(thumbBlob);
          warnings.push('工程预览已使用兼容存储保存');
        }
        projectRecord.thumbnail = thumbnailPath;
      } catch (e) {
        warnings.push('缩略图导入失败');
      }
    }

    await aetherDB.saveProject(projectRecord);
    projectSaved = true;

    // ⑩ 添加到最近工程
    await aetherDB.addRecentProject({
      projectId: newProjectId,
      name: projectName,
      thumbnail: projectRecord.thumbnail,
      lastOpenedAt: Date.now(),
    });

    onProgress?.('导入完成', 1);

    return {
      projectId: newProjectId,
      projectName,
      assetCount: manifest?.assetCount || 0,
      importedAssets,
      skippedAssets,
      warnings,
      totalSize,
    };
    } catch (error) {
      await rollback();
      throw error;
    }
  }

  /**
   * 验证 .aether 文件完整性（不导入，只检查）
   */
  async validateProjectFile(file: File): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    info?: {
      projectName: string;
      formatVersion: string;
      assetCount: number;
      totalSize: number;
      exportedAt: number;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const zip = await JSZip.loadAsync(file);

      // 检查必要文件
      const projectFile = zip.file('project.json');
      if (!projectFile) {
        errors.push('缺少 project.json');
        return { valid: false, errors, warnings };
      }

      // 检查 manifest
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        warnings.push('缺少 manifest.json（旧版本工程文件）');
      }

      let manifest: ManifestData | null = null;
      if (manifestFile) {
        try {
          const manifestStr = await manifestFile.async('string');
          manifest = JSON.parse(manifestStr);
        } catch {
          errors.push('manifest.json 格式错误');
        }
      }

      // 验证工程数据
      let projectData: any = null;
      try {
        const projectJsonStr = await projectFile.async('string');
        projectData = JSON.parse(projectJsonStr);
      } catch {
        errors.push('project.json 格式错误');
      }

      // 验证素材文件存在性
      if (manifest) {
        const manifestIds = new Set(manifest.assets.map((asset) => asset.id));
        if (projectData) {
          for (const reference of collectUnresolvedPackagedAssetReferences(projectData, manifestIds)) {
            errors.push(`素材引用未映射到清单: ${reference}`);
          }
        }
        for (const asset of manifest.assets) {
          const zipAsset = zip.file(asset.path);
          if (!zipAsset) {
            errors.push(`素材文件缺失: ${asset.name}`);
            continue;
          }
          try {
            await this.assertBlobIntegrity(await zipAsset.async('blob'), asset);
          } catch (error) {
            errors.push(`素材完整性校验失败: ${asset.name} - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        info: manifest ? {
          projectName: manifest.projectName,
          formatVersion: manifest.formatVersion,
          assetCount: manifest.assetCount,
          totalSize: manifest.totalSize,
          exportedAt: manifest.exportedAt,
        } : undefined,
      };
    } catch (e) {
      return {
        valid: false,
        errors: [`文件解析失败: ${e instanceof Error ? e.message : String(e)}`],
        warnings,
      };
    }
  }

  // ==================== 内部方法 ====================

  /** 比较版本号（返回正数表示 a > b） */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  /** 生成工程ID */
  private generateProjectId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** 生成素材ID */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async assertPersistedAssetIntegrity(asset: AssetRecord, expected: ManifestData['assets'][number]): Promise<void> {
    await this.assertStoredBlobIntegrity(asset.opfsPath, expected);
  }

  private async assertStoredBlobIntegrity(path: string, expected: ManifestData['assets'][number]): Promise<void> {
    const blob = path.startsWith(IDB_BLOB_PREFIX)
      ? await aetherDB.getBlob(path.slice(IDB_BLOB_PREFIX.length))
      : await opfs.readFile(path);
    if (!blob) throw new Error('素材写入后无法重新读取');
    await this.assertBlobIntegrity(blob, expected);
  }

  private async assertBlobIntegrity(blob: Blob, expected: ManifestData['assets'][number]): Promise<void> {
    if (blob.size !== expected.size) {
      throw new Error(`素材大小不匹配（期望 ${expected.size}，实际 ${blob.size}）`);
    }
    if (!/^[a-f0-9]{64}$/i.test(expected.hash)) return;
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const actualHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
    if (actualHash !== expected.hash.toLowerCase()) throw new Error('SHA-256 校验不匹配');
  }

  /** 从路径获取扩展名 */
  private getExtensionFromPath(path: string): string {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()! : 'bin';
  }

  /**
   * 重新映射工程数据中的素材引用
   * 将旧素材ID替换为新素材ID
   */
  private remapAssetReferences(data: any, idMapping: Map<string, string>): any {
    if (!data || typeof data !== 'object') return data;

    const remapValue = (value: any): any => {
      if (typeof value === 'string' && idMapping.has(value)) {
        return idMapping.get(value);
      }
      if (Array.isArray(value)) {
        return value.map(remapValue);
      }
      if (value && typeof value === 'object') {
        return this.remapAssetReferences(value, idMapping);
      }
      return value;
    };

    if (Array.isArray(data)) {
      return data.map(remapValue);
    }

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = remapValue(value);
    }
    return result;
  }

  /**
   * 从工程数据中提取所有素材引用ID
   * 用于检查工程实际使用了哪些素材
   */
  extractAssetIds(data: any): Set<string> {
    const ids = new Set<string>();
    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach(traverse);
        return;
      }
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'refId' && typeof value === 'string' && value.startsWith('asset_')) {
          ids.add(value);
        }
        if (key === 'mediaRefId' && typeof value === 'string' && value.startsWith('asset_')) {
          ids.add(value);
        }
        if (key === 'iconImageRefId' && typeof value === 'string' && value.startsWith('asset_')) {
          ids.add(value);
        }
        if (key === 'iconVideoRefId' && typeof value === 'string' && value.startsWith('asset_')) {
          ids.add(value);
        }
        if (key === 'iconModelRefId' && typeof value === 'string' && value.startsWith('asset_')) {
          ids.add(value);
        }
        if (value && typeof value === 'object') {
          traverse(value);
        }
      }
    };
    traverse(data);
    return ids;
  }
}

/** 单例导出 */
export const projectImporter = new ProjectImporter();
