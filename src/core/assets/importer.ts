/**
 * 素材导入器
 * 负责将用户选择的文件导入到本地存储（OPFS + IndexedDB）
 * 支持：类型校验、哈希去重、元数据提取、进度回调、批量导入
 */

import { aetherDB, opfs, storageManager } from '../db';
import { IDB_BLOB_PREFIX } from '../db/types';
import type { AssetRecord, AssetType } from '../db/types';

class AssetImporter {
  /** 支持的文件类型白名单 */
  private readonly ACCEPTED_TYPES: Record<AssetType, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
    'panorama-img': ['image/jpeg', 'image/png', 'image/webp'],
    video: ['video/mp4', 'video/x-m4v', 'video/webm', 'video/ogg', 'video/quicktime'],
    'panorama-vid': ['video/mp4', 'video/webm'],
    'model-3d': ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'],
    'gaussian-splat': ['application/octet-stream', 'text/plain', 'application/x-ply'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac'],
    font: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2'],
  };

  /** 文件扩展名到 MIME 类型的映射（用于检测不标准的 MIME） */
  private readonly EXTENSION_TO_MIME: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    ply: 'application/x-ply',
    splat: 'application/octet-stream',
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
  };

  /**
   * 导入单个素材文件
   * @param file 原始文件
   * @param projectId 所属工程ID
   * @param expectedType 期望的素材类型（可选，自动检测）
   * @param onProgress 进度回调（0-1）
   */
  async importAsset(
    file: File,
    projectId: string,
    expectedType?: AssetType,
    onProgress?: (progress: number) => void
  ): Promise<AssetRecord> {
    onProgress?.(0);

    // ① 规范化 MIME 类型（某些浏览器对不常见文件返回空 MIME）
    const mimeType = this.normalizeMimeType(file);
    onProgress?.(0.05);

    // ② 检测素材类型
    const detectedType = expectedType || this.detectAssetType(mimeType, file.name);
    onProgress?.(0.1);

    // ③ 文件类型校验
    if (!this.isTypeAccepted(detectedType, mimeType)) {
      throw new Error(`不支持的文件类型: ${mimeType}（${file.name}）`);
    }
    onProgress?.(0.15);

    // ④ 存储空间检查
    const hasSpace = await storageManager.hasEnoughSpace(file.size);
    if (!hasSpace) {
      const granted = await storageManager.requestMoreSpace();
      if (!granted) {
        throw new Error('存储空间不足，请清理旧素材或授权更多存储空间');
      }
    }
    onProgress?.(0.2);

    // ⑤ 计算文件哈希（SHA-256，用于去重）
    const hash = await this.calculateHash(file);
    onProgress?.(0.4);

    // ⑥ 哈希去重检查（同工程内相同文件复用）
    const existing = await aetherDB.getAssetByHash(hash);
    if (existing && existing.projectId === projectId) {
      // 同工程内已存在相同文件，增加引用计数并复用
      existing.refCount++;
      existing.lastUsedAt = Date.now();
      await aetherDB.saveAsset(existing);
      onProgress?.(1);
      return existing;
    }
    onProgress?.(0.5);

    // ⑦ 生成素材ID和OPFS路径
    const assetId = this.generateAssetId();
    const extension = this.getExtension(file.name, mimeType);
    const opfsPath = opfs.generateAssetPath(assetId, extension);
    onProgress?.(0.55);

    // ⑧ 写入存储：优先 OPFS，失败时降级到 IndexedDB blobs store
    let actualPath = opfsPath;
    try {
      await opfs.writeFileWithProgress(opfsPath, file, (loaded, total) => {
        const writeProgress = 0.55 + (loaded / total) * 0.25;
        onProgress?.(Math.min(writeProgress, 0.8));
      });
    } catch (e) {
      console.warn('[Importer] OPFS 写入失败，降级到 IndexedDB 存储 Blob:', e);
      await aetherDB.putBlob(assetId, file);
      actualPath = `${IDB_BLOB_PREFIX}${assetId}`;
    }
    onProgress?.(0.8);

    // ⑨ 提取元数据（图片尺寸、视频尺寸/时长等）
    const metadata = await this.extractMetadata(file, detectedType);
    onProgress?.(0.9);

    // ⑩ 创建素材记录并保存到 IndexedDB
    const asset: AssetRecord = {
      id: assetId,
      projectId,
      name: file.name,
      type: detectedType,
      mimeType,
      size: file.size,
      hash,
      opfsPath: actualPath,
      ...metadata,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      refCount: 1,
    };
    await aetherDB.saveAsset(asset);
    onProgress?.(1);

    return asset;
  }

  /**
   * 批量导入素材
   * @param files 文件列表
   * @param projectId 所属工程ID
   * @param onProgress 总进度回调（当前/总数）
   * @param onItemComplete 单个文件完成回调
   */
  async importAssets(
    files: FileList | File[],
    projectId: string,
    onProgress?: (current: number, total: number, asset?: AssetRecord) => void,
    onItemComplete?: (asset: AssetRecord, index: number) => void,
    onItemError?: (error: Error, file: File, index: number) => void
  ): Promise<AssetRecord[]> {
    const fileArray = Array.from(files);
    const results: AssetRecord[] = [];
    const total = fileArray.length;

    for (let i = 0; i < total; i++) {
      const file = fileArray[i];
      try {
        const asset = await this.importAsset(file, projectId, undefined, (itemProgress) => {
          // 总进度 = 已完成数 + 当前文件进度
          const totalProgress = (i + itemProgress) / total;
          onProgress?.(i + 1, total, asset);
        });
        results.push(asset);
        onItemComplete?.(asset, i);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`素材导入失败 [${file.name}]:`, error);
        onItemError?.(error, file, i);
      }
      onProgress?.(i + 1, total);
    }

    return results;
  }

  // ==================== 内部方法 ====================

  /** 规范化 MIME 类型（处理不标准的 MIME） */
  private normalizeMimeType(file: File): string {
    if (file.type && file.type !== 'application/octet-stream') {
      return file.type;
    }
    // 从扩展名推断
    const ext = this.getFileExtension(file.name).toLowerCase();
    return this.EXTENSION_TO_MIME[ext] || file.type || 'application/octet-stream';
  }

  /** 检测素材类型 */
  private detectAssetType(mimeType: string, fileName: string): AssetType {
    const ext = this.getFileExtension(fileName).toLowerCase();

    // 全景图：宽高比接近 2:1 的图片（这里只按类型判断，具体在使用时验证）
    if (mimeType.startsWith('image/')) {
      // 文件名包含 panorama/pano/全景 等关键词时自动识别为全景图
      if (/panorama|pano|全景|equirectangular/i.test(fileName)) {
        return 'panorama-img';
      }
      return 'image';
    }

    if (mimeType.startsWith('video/')) {
      if (/panorama|pano|全景|equirectangular/i.test(fileName)) {
        return 'panorama-vid';
      }
      return 'video';
    }

    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('font/')) return 'font';

    // 3D模型
    if (ext === 'glb' || ext === 'gltf' || mimeType.includes('gltf')) {
      return 'model-3d';
    }

    // 高斯泼溅
    if (ext === 'ply' || ext === 'splat' || /splat|gaussian|高斯/i.test(fileName)) {
      return 'gaussian-splat';
    }

    // 默认按图片处理
    return 'image';
  }

  /** 检查文件类型是否被接受 */
  private isTypeAccepted(type: AssetType, mimeType: string): boolean {
    const accepted = this.ACCEPTED_TYPES[type];
    if (!accepted) return false;
    // 精确匹配
    if (accepted.includes(mimeType)) return true;
    // 通配匹配（如 image/*）
    const category = mimeType.split('/')[0];
    return accepted.some((t) => t.startsWith(`${category}/`));
  }

  /** 计算文件 SHA-256 哈希（用于去重） */
  private async calculateHash(file: File): Promise<string> {
    try {
      // 使用 Web Crypto API
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('SHA-256 计算失败，使用文件名+大小作为替代哈希:', e);
      // 降级方案：使用文件名+大小+修改时间作为哈希
      return `fallback_${file.name}_${file.size}_${file.lastModified}`;
    }
  }

  /** 提取素材元数据 */
  private async extractMetadata(file: File, type: AssetType): Promise<Partial<AssetRecord>> {
    const meta: Partial<AssetRecord> = {};

    try {
      if (type === 'image' || type === 'panorama-img') {
        const img = await this.loadImage(file);
        meta.width = img.width;
        meta.height = img.height;
      }

      if (type === 'video' || type === 'panorama-vid') {
        const video = await this.loadVideo(file);
        meta.width = video.videoWidth;
        meta.height = video.videoHeight;
        meta.duration = video.duration;
      }
    } catch (e) {
      console.warn('元数据提取失败:', e);
    }

    return meta;
  }

  /** 加载图片获取尺寸 */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };
      img.src = url;
    });
  }

  /** 加载视频获取尺寸和时长 */
  private loadVideo(file: File): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('视频加载失败'));
      };
      video.src = url;
    });
  }

  /** 生成唯一素材ID */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /** 获取文件扩展名 */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()! : '';
  }

  /** 获取文件扩展名（带默认值） */
  private getExtension(fileName: string, mimeType: string): string {
    const ext = this.getFileExtension(fileName).toLowerCase();
    if (ext) return ext;
    return opfs.getExtensionFromMime(mimeType);
  }

  /** 获取可接受的文件类型字符串（用于 input accept 属性） */
  getAcceptString(types?: AssetType[]): string {
    const targetTypes = types || Object.keys(this.ACCEPTED_TYPES) as AssetType[];
    const mimeTypes = new Set<string>();
    for (const type of targetTypes) {
      for (const mime of this.ACCEPTED_TYPES[type]) {
        mimeTypes.add(mime);
      }
    }
    return Array.from(mimeTypes).join(',');
  }
}

/** 单例导出 */
export const assetImporter = new AssetImporter();
