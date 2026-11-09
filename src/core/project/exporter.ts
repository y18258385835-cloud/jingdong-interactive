/**
 * 工程导出器
 * 将工程导出为 .aether 文件格式（ZIP 包）
 * 文件结构：
 *   manifest.json    - 文件清单和校验信息
 *   project.json     - 完整工程数据
 *   assets/          - 所有素材文件
 *   thumbnail.png    - 缩略图（可选）
 */

import JSZip from 'jszip';
import { aetherDB, opfs } from '../db';
import { assetLoader } from '../assets';
import { scanProjectHealth } from './healthCheck';
import type { ProjectRecord, AssetRecord } from '../db/types';
import { APP_VERSION, PROJECT_FORMAT_VERSION } from '../db/types';
import { sanitizeExportData } from '../realtime/sanitizeExportData';
import { collectProjectAssetReferences, isPackagedAssetReference } from './assetReferences';

interface ExportOptions {
  /** 是否包含素材文件（默认 true，false 时只导出工程配置） */
  includeAssets?: boolean;
  /** 是否包含缩略图（默认 true） */
  includeThumbnail?: boolean;
  /** 导出进度回调 */
  onProgress?: (stage: string, progress: number) => void;
  /** 素材过滤函数（返回 true 才导出该素材） */
  assetFilter?: (asset: AssetRecord) => boolean;
  signal?: AbortSignal;
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

class ProjectExporter {
  /**
   * 导出工程为 .aether 文件（Blob）
   * @param projectId 工程ID
   * @param options 导出选项
   * @returns Blob 对象（ZIP 格式）
   */
  async exportProject(projectId: string, options: ExportOptions = {}): Promise<Blob> {
    const {
      includeAssets = true,
      includeThumbnail = true,
      onProgress,
      assetFilter,
    } = options;

    onProgress?.('读取工程数据', 0.05);

    // ① 读取工程数据
    const project = await aetherDB.getProject(projectId);
    if (!project) {
      throw new Error(`工程不存在: ${projectId}`);
    }

    onProgress?.('读取素材列表', 0.1);

    // ② 获取工程使用的所有素材
    const ownedAssets = await aetherDB.getAssetsByProject(projectId);
    // Deduplicated assets may be owned by another project. Export by actual
    // references so a round-trip never loses a shared image or video.
    const assetsById = new Map(ownedAssets.map((asset) => [asset.id, asset]));
    for (const reference of collectProjectAssetReferences(project.data)) {
      if (!isPackagedAssetReference(reference) || assetsById.has(reference)) continue;
      const asset = await aetherDB.getAsset(reference);
      if (asset) assetsById.set(asset.id, asset);
    }
    let assets = Array.from(assetsById.values());
    if (assetFilter) {
      assets = assets.filter(assetFilter);
    }

    const health = scanProjectHealth(project.data, assets);
    if (!health.ok) {
      const summary = health.issues.slice(0, 3).map((issue) => issue.message).join('；');
      onProgress?.(`工程修复提示：${summary}`, 0.12);
    }

    // ③ 创建 ZIP
    const zip = new JSZip();
    const manifestAssets: ManifestData['assets'] = [];
    let totalAssetSize = 0;

    if (includeAssets) {
      onProgress?.('打包素材文件', 0.2);

      // ④ 将素材文件写入 ZIP
      for (let i = 0; i < assets.length; i++) {
        if (options.signal?.aborted) throw new Error('工程导出已取消');
        const asset = assets[i];
        const progress = 0.2 + (i / assets.length) * 0.5;
        onProgress?.(`打包素材: ${asset.name}`, progress);

        try {
          // 从 OPFS 读取素材文件
          const blob = await assetLoader.loadAssetAsBlob(asset.id);
          const extension = this.getExtensionFromName(asset.name);
          const assetPath = `assets/${asset.id}.${extension}`;

          zip.file(assetPath, blob);

          manifestAssets.push({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            mimeType: blob.type || asset.mimeType,
            size: asset.size,
            hash: asset.hash,
            path: assetPath,
          });
          totalAssetSize += asset.size;
        } catch (e) {
          console.warn(`素材打包失败: ${asset.name}`, e);
          // 继续打包其他素材，不中断
        }
      }
    }

    onProgress?.('写入工程配置', 0.75);

    // ⑤ 写入工程数据
    const projectData = sanitizeExportData({
      ...project.data,
      // 确保工程数据中的素材引用与实际导出的素材一致
      _exportedAssetIds: includeAssets ? assets.map((a) => a.id) : [],
    });
    zip.file('project.json', JSON.stringify(projectData, null, 2));

    // ⑥ 写入缩略图（如果有）
    if (includeThumbnail && project.thumbnail) {
      try {
        onProgress?.('写入缩略图', 0.8);
        if (project.thumbnail.startsWith('data:')) {
          // base64 缩略图
          const base64Data = project.thumbnail.split(',')[1];
          zip.file('thumbnail.png', base64Data, { base64: true });
        } else {
          // OPFS uses origin-private relative paths such as
          // "thumbnails/proj_123.png", not public HTTP paths.
          const thumbBlob = await opfs.readFile(project.thumbnail);
          zip.file('thumbnail.png', thumbBlob);
        }
      } catch (e) {
        console.warn('缩略图写入失败:', e);
      }
    }

    onProgress?.('生成清单文件', 0.85);

    // ⑦ 生成 manifest.json
    const projectJsonStr = JSON.stringify(projectData);
    const checksum = await this.calculateChecksum(projectJsonStr);

    const manifest: ManifestData = {
      formatVersion: PROJECT_FORMAT_VERSION,
      appVersion: APP_VERSION,
      exportedAt: Date.now(),
      projectId: project.id,
      projectName: project.name,
      assetCount: manifestAssets.length,
      totalSize: totalAssetSize,
      assets: manifestAssets,
      checksum,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    onProgress?.('压缩文件', 0.9);

    // ⑧ 生成 ZIP Blob
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }, (metadata) => {
      onProgress?.('压缩文件', 0.9 + metadata.percent / 1000);
    });

    onProgress?.('导出完成', 1);

    return blob;
  }

  /**
   * 导出工程并触发浏览器下载
   * @param projectId 工程ID
   * @param fileName 文件名（不含扩展名）
   * @param options 导出选项
   */
  async exportAndDownload(
    projectId: string,
    fileName?: string,
    options: ExportOptions = {}
  ): Promise<void> {
    const project = await aetherDB.getProject(projectId);
    const name = fileName || project?.name || '未命名工程';
    const safeName = this.sanitizeFileName(name);

    const blob = await this.exportProject(projectId, options);
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.aether`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  /**
   * 导出工程为 JSON（仅配置，不含素材）
   * 用于快速备份或版本对比
   */
  async exportProjectJSON(projectId: string): Promise<string> {
    const project = await aetherDB.getProject(projectId);
    if (!project) throw new Error(`工程不存在: ${projectId}`);
    return JSON.stringify(sanitizeExportData(project.data), null, 2);
  }

  /**
   * 导出工程素材清单（用于检查和调试）
   */
  async exportAssetManifest(projectId: string): Promise<ManifestData['assets']> {
    const assets = await aetherDB.getAssetsByProject(projectId);
    return assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      size: asset.size,
      hash: asset.hash,
      path: asset.opfsPath,
    }));
  }

  // ==================== 内部方法 ====================

  /** 计算校验和（简单的哈希，用于完整性检查） */
  private async calculateChecksum(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // 降级：使用简单的字符串哈希
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `fallback_${Math.abs(hash).toString(16)}`;
    }
  }

  /** 从文件名获取扩展名 */
  private getExtensionFromName(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()! : 'bin';
  }

  /** 清理文件名中的非法字符 */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100);
  }

  /**
   * 估算导出文件大小（用于显示进度和检查空间）
   */
  async estimateExportSize(projectId: string, includeAssets = true): Promise<{
    projectSize: number;
    assetsSize: number;
    estimatedTotal: number;
    assetCount: number;
  }> {
    const project = await aetherDB.getProject(projectId);
    const projectSize = project ? JSON.stringify(project.data).length : 0;

    let assetsSize = 0;
    let assetCount = 0;
    if (includeAssets) {
      const assets = await aetherDB.getAssetsByProject(projectId);
      assetCount = assets.length;
      assetsSize = assets.reduce((sum, a) => sum + a.size, 0);
    }

    // ZIP 压缩率估算（图片/视频通常压缩率低，配置文件压缩率高）
    const estimatedTotal = projectSize * 0.3 + assetsSize * 0.95 + 1024;

    return {
      projectSize,
      assetsSize,
      estimatedTotal: Math.round(estimatedTotal),
      assetCount,
    };
  }
}

/** 单例导出 */
export const projectExporter = new ProjectExporter();
