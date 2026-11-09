/**
 * OPFS (Origin Private File System) 文件系统封装
 * 用于存储大文件（素材、导出临时文件、缩略图）
 * 浏览器私有文件系统，仅同源可访问，性能接近本地文件
 * 兼容性：Chrome 109+, Edge 109+, Safari 16.4+, Firefox 111+
 */

import { OPFS_PATHS } from './types';

class OPFSManager {
  private root: FileSystemDirectoryHandle | null = null;
  private initPromise: Promise<void> | null = null;
  private supported = true;

  /** 检查 OPFS 是否可用 */
  isSupported(): boolean {
    return this.supported && !!navigator.storage?.getDirectory;
  }

  /** 初始化（创建基础目录） */
  async init(): Promise<void> {
    if (this.root) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (!navigator.storage?.getDirectory) {
          this.supported = false;
          throw new Error('当前浏览器不支持 OPFS');
        }
        this.root = await navigator.storage.getDirectory();
        // 确保基础目录存在
        await Promise.all([
          this.ensureDirectory(OPFS_PATHS.ASSETS),
          this.ensureDirectory(OPFS_PATHS.EXPORTS),
          this.ensureDirectory(OPFS_PATHS.THUMBNAILS),
          this.ensureDirectory(OPFS_PATHS.TEMP),
        ]);
      } catch (e) {
        this.supported = false;
        console.warn('OPFS 初始化失败，将降级到 IndexedDB 存储:', e);
        throw e;
      }
    })();

    return this.initPromise;
  }

  /** 确保根目录已初始化 */
  private async ensureRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.root) {
      await this.init();
    }
    if (!this.root) throw new Error('OPFS 未初始化');
    return this.root;
  }

  /** 确保目录存在（递归创建） */
  async ensureDirectory(path: string): Promise<FileSystemDirectoryHandle> {
    const root = await this.ensureRoot();
    const parts = path.split('/').filter(Boolean);
    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    return dir;
  }

  /** 获取目录句柄 */
  private async getDirectory(path: string): Promise<FileSystemDirectoryHandle> {
    const root = await this.ensureRoot();
    const parts = path.split('/').filter(Boolean);
    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    return dir;
  }

  /** 拆分路径为目录和文件名 */
  private splitPath(path: string): { dirPath: string; fileName: string } {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop() || '';
    const dirPath = parts.join('/');
    return { dirPath, fileName };
  }

  // ==================== 文件操作 ====================

  /** 写入文件 */
  async writeFile(path: string, data: Blob | ArrayBuffer | string): Promise<void> {
    const { dirPath, fileName } = this.splitPath(path);
    const dir = await this.getDirectory(dirPath);
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    if (typeof data === 'string') {
      await writable.write(data);
    } else if (data instanceof Blob) {
      await writable.write(data);
    } else {
      await writable.write(data);
    }
    await writable.close();
  }

  /** 写入文件（带进度回调，用于大文件） */
  async writeFileWithProgress(
    path: string,
    data: Blob,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    const { dirPath, fileName } = this.splitPath(path);
    const dir = await this.getDirectory(dirPath);
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    // 分片写入，每片 1MB，报告进度
    const chunkSize = 1024 * 1024;
    let loaded = 0;
    const total = data.size;

    for (let start = 0; start < total; start += chunkSize) {
      const chunk = data.slice(start, Math.min(start + chunkSize, total));
      await writable.write(chunk);
      loaded += chunk.size;
      onProgress?.(loaded, total);
    }

    await writable.close();
  }

  /** 读取文件为 Blob */
  async readFile(path: string): Promise<Blob> {
    const { dirPath, fileName } = this.splitPath(path);
    const dir = await this.getDirectory(dirPath);
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  }

  /** 读取文件为 ArrayBuffer */
  async readFileAsArrayBuffer(path: string): Promise<ArrayBuffer> {
    const blob = await this.readFile(path);
    return await blob.arrayBuffer();
  }

  /** 读取文件为文本 */
  async readFileAsText(path: string): Promise<string> {
    const blob = await this.readFile(path);
    return await blob.text();
  }

  /** 读取文件为 ObjectURL（用于 img/video/audio 标签） */
  async readFileAsURL(path: string): Promise<string> {
    const blob = await this.readFile(path);
    return URL.createObjectURL(blob);
  }

  /** 读取文件为 DataURL（base64，用于小文件/缩略图） */
  async readFileAsDataURL(path: string): Promise<string> {
    const blob = await this.readFile(path);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /** 删除文件 */
  async deleteFile(path: string): Promise<void> {
    const { dirPath, fileName } = this.splitPath(path);
    const dir = await this.getDirectory(dirPath);
    await dir.removeEntry(fileName);
  }

  /** 检查文件是否存在 */
  async fileExists(path: string): Promise<boolean> {
    try {
      const { dirPath, fileName } = this.splitPath(path);
      const dir = await this.getDirectory(dirPath);
      await dir.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }

  /** 获取文件大小 */
  async getFileSize(path: string): Promise<number> {
    const blob = await this.readFile(path);
    return blob.size;
  }

  /** 获取文件元信息 */
  async getFileInfo(path: string): Promise<{
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }> {
    const { dirPath, fileName } = this.splitPath(path);
    const dir = await this.getDirectory(dirPath);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
  }

  // ==================== 目录操作 ====================

  /** 列出目录内容 */
  async listDirectory(path: string): Promise<Array<{
    name: string;
    kind: 'file' | 'directory';
  }>> {
    const dir = await this.getDirectory(path);
    const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
    // 使用类型断言，因为 TypeScript 类型定义可能不包含异步迭代器方法
    for await (const [name, handle] of (dir as any).entries()) {
      entries.push({ name, kind: handle.kind as 'file' | 'directory' });
    }
    return entries;
  }

  /** 清空目录（删除所有内容，保留目录本身） */
  async clearDirectory(path: string): Promise<void> {
    const dir = await this.getDirectory(path);
    for await (const name of (dir as any).keys()) {
      await dir.removeEntry(name, { recursive: true });
    }
  }

  /** 删除目录（递归删除） */
  async deleteDirectory(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return;
    const dirName = parts.pop()!;
    const parentPath = parts.join('/');
    const parentDir = await this.getDirectory(parentPath);
    await parentDir.removeEntry(dirName, { recursive: true });
  }

  // ==================== 存储统计 ====================

  /** 计算目录总大小（递归） */
  async getDirectorySize(path: string): Promise<number> {
    let total = 0;
    const dir = await this.getDirectory(path);
    for await (const [, handle] of (dir as any).entries()) {
      if (handle.kind === 'file') {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          total += file.size;
        } catch (e) {
          console.warn('获取文件大小失败:', e);
        }
      } else if (handle.kind === 'directory') {
        total += await this.getDirectorySize(`${path}/${handle.name}`);
      }
    }
    return total;
  }

  /** 获取所有素材文件总大小 */
  async getAssetsSize(): Promise<number> {
    try {
      return await this.getDirectorySize(OPFS_PATHS.ASSETS);
    } catch {
      return 0;
    }
  }

  /** 清理临时文件（超过24小时的） */
  async cleanupTempFiles(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    let cleanedCount = 0;
    try {
      const entries = await this.listDirectory(OPFS_PATHS.TEMP);
      const now = Date.now();
      for (const entry of entries) {
        // 临时文件名包含时间戳，如 temp_1700000000000_xxx
        const match = entry.name.match(/temp_(\d+)_/);
        if (match) {
          const timestamp = parseInt(match[1], 10);
          if (now - timestamp > maxAgeMs) {
            await this.deleteFile(`${OPFS_PATHS.TEMP}/${entry.name}`);
            cleanedCount++;
          }
        }
      }
    } catch (e) {
      console.warn('清理临时文件失败:', e);
    }
    return cleanedCount;
  }

  /** 清理导出临时文件（超过1小时的） */
  async cleanupExportFiles(maxAgeMs = 60 * 60 * 1000): Promise<number> {
    let cleanedCount = 0;
    try {
      const entries = await this.listDirectory(OPFS_PATHS.EXPORTS);
      const now = Date.now();
      for (const entry of entries) {
        const match = entry.name.match(/export_(\d+)_/);
        if (match) {
          const timestamp = parseInt(match[1], 10);
          if (now - timestamp > maxAgeMs) {
            await this.deleteDirectory(`${OPFS_PATHS.EXPORTS}/${entry.name}`);
            cleanedCount++;
          }
        }
      }
    } catch (e) {
      console.warn('清理导出文件失败:', e);
    }
    return cleanedCount;
  }

  // ==================== 工具方法 ====================

  /** 生成唯一的素材文件路径 */
  generateAssetPath(assetId: string, extension: string): string {
    return `${OPFS_PATHS.ASSETS}/${assetId}.${extension}`;
  }

  /** 生成唯一的临时文件路径 */
  generateTempPath(extension: string): string {
    const id = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${OPFS_PATHS.TEMP}/${id}.${extension}`;
  }

  /** 生成唯一的导出目录路径 */
  generateExportPath(): string {
    const id = `export_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${OPFS_PATHS.EXPORTS}/${id}`;
  }

  /** 生成缩略图路径 */
  generateThumbnailPath(projectId: string): string {
    return `${OPFS_PATHS.THUMBNAILS}/${projectId}.png`;
  }

  /** 从 MIME 类型获取文件扩展名 */
  getExtensionFromMime(mimeType: string, fallback = 'bin'): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'model/gltf-binary': 'glb',
      'model/gltf+json': 'gltf',
      'application/octet-stream': 'bin',
      'text/plain': 'txt',
      'font/ttf': 'ttf',
      'font/otf': 'otf',
      'font/woff': 'woff',
      'font/woff2': 'woff2',
    };
    return map[mimeType] || fallback;
  }
}

/** 单例导出 */
export const opfs = new OPFSManager();
