/**
 * 集成适配层
 * 将 P0存储/P1授权/P2导出 三层核心与现有编辑器代码桥接
 * 提供便捷的 API，保持向后兼容
 */

import { aetherDB, opfs, storageManager } from '../core/storage';
import { featureGate, subscriptionService, useSubscription, useFeature } from '../core/auth';
import { exportManager, imageExporter, videoExporter, htmlExporter, watermarkService } from '../core/export';
import type { ProjectRecord, AssetRecord } from '../core/db/types';
import type {
  ImageExportOptions,
  VideoExportOptions,
  HTMLExportOptions,
  ExportResult,
  WatermarkConfig,
} from '../core/export/types';
import type { RenderContext as ImageRenderContext } from '../core/export/imageExporter';
import type { VideoRenderContext } from '../core/export/videoExporter';
import type { HTMLRenderContext } from '../core/export/htmlExporter';

// ==================== 工程管理桥接 ====================

/**
 * 保存工程到 IndexedDB（同时保留 localStorage 作为降级）
 */
export async function saveProjectToStorage(
  projectId: string,
  projectData: any,
  options?: {
    name?: string;
    thumbnail?: string;
    assetIds?: string[];
  }
): Promise<void> {
  try {
    const existing = await aetherDB.getProject(projectId);
    // Keep the last known-good payload before replacing the authoritative IDB
    // record. This is a bounded recovery path for interrupted/corrupt writes.
    if (existing?.data) {
      try {
        const backup = JSON.stringify({ savedAt: Date.now(), projectData: existing.data });
        if (backup.length <= 4 * 1024 * 1024) {
          localStorage.setItem(`aether_project_backup_${projectId}`, backup);
        }
      } catch (backupError) {
        console.warn('[Integration] 无法写入工程恢复快照:', backupError);
      }
    }
    const record: ProjectRecord = {
      id: projectId,
      name: options?.name || existing?.name || '未命名工程',
      description: existing?.description,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      data: projectData,
      thumbnail: options?.thumbnail || existing?.thumbnail,
      assetIds: options?.assetIds || existing?.assetIds || [],
    };
    await aetherDB.saveProject(record);
    // Keep a current bounded snapshot as well. The next write replaces it
    // with the previous IDB record before committing, preserving one-step undo
    // for storage corruption or a browser crash.
    try {
      const backup = JSON.stringify({ savedAt: Date.now(), projectData });
      if (backup.length <= 4 * 1024 * 1024) {
        localStorage.setItem(`aether_project_backup_${projectId}`, backup);
      }
    } catch (backupError) {
      console.warn('[Integration] 无法更新工程恢复快照:', backupError);
    }

  } catch (e) {
    console.error('[Integration] 工程保存失败:', e);
    throw e;
  }
}

/** Reads the last known-good snapshot captured before an IndexedDB write. */
export function loadProjectBackup(projectId: string): any | null {
  try {
    const raw = localStorage.getItem(`aether_project_backup_${projectId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('projectData' in parsed)) return null;
    return (parsed as { projectData?: unknown }).projectData ?? null;
  } catch (error) {
    console.warn('[Integration] 工程恢复快照读取失败:', error);
    return null;
  }
}

/**
 * 从 IndexedDB 加载工程（失败时降级到 localStorage）
 */
export async function loadProjectFromStorage(projectId: string): Promise<any | null> {
  try {
    const record = await aetherDB.getProject(projectId);
    if (record) {
      return record.data;
    }
  } catch (e) {
    console.warn('[Integration] IndexedDB 加载失败，尝试 localStorage:', e);
  }

  // 降级到 localStorage
  try {
    const raw = localStorage.getItem(`aether_project_backup_${projectId}`);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'projectData' in parsed) {
        return (parsed as { projectData?: unknown }).projectData ?? null;
      }
      // Backward compatibility with the pre-snapshot fallback format.
      return parsed;
    }
  } catch (e) {
    console.warn('[Integration] localStorage 加载失败:', e);
  }

  return null;
}

/**
 * 获取所有工程列表
 */
export async function listProjects(): Promise<ProjectRecord[]> {
  return aetherDB.listProjects();
}

/**
 * 删除工程
 */
export async function deleteProject(projectId: string): Promise<void> {
  await aetherDB.deleteProject(projectId);
  await aetherDB.removeRecentProject(projectId);
}

// ==================== 素材管理桥接 ====================

/**
 * 导入素材到 OPFS + IndexedDB
 */
export async function importAsset(
  file: File,
  projectId: string,
  onProgress?: (progress: number) => void
): Promise<AssetRecord> {
  const { assetImporter } = await import('../core/assets/importer');
  return assetImporter.importAsset(file, projectId, undefined, onProgress);
}

/**
 * 加载素材 URL（用于 img/video 标签）
 */
export async function loadAssetURL(assetId: string): Promise<string> {
  const { assetLoader } = await import('../core/assets/loader');
  return assetLoader.loadAssetURL(assetId);
}

/**
 * 释放素材 URL（组件卸载时调用）
 */
export function releaseAssetURL(assetId: string): void {
  import('../core/assets/loader').then(({ assetLoader }) => {
    assetLoader.releaseAssetURL(assetId);
  });
}

/**
 * 获取素材信息
 */
export async function getAssetInfo(assetId: string): Promise<AssetRecord | undefined> {
  return aetherDB.getAsset(assetId);
}

// ==================== 授权检查桥接 ====================

/**
 * 检查功能权限（非组件环境使用）
 */
export function hasFeature(feature: Parameters<typeof featureGate.hasFeature>[0]): boolean {
  return featureGate.hasFeature(feature);
}

/**
 * 功能权限守卫（无权限时抛出错误）
 */
export function requireFeature(feature: Parameters<typeof featureGate.requireFeature>[0]): void {
  featureGate.requireFeature(feature);
}

/**
 * 获取当前订阅计划
 */
export function getCurrentPlan() {
  return subscriptionService.getPlan();
}

/**
 * 检查是否为付费用户
 */
export function isPaidUser(): boolean {
  return subscriptionService.isPaid();
}

/**
 * 获取功能被拒绝时的提示信息
 */
export function getFeatureDenialMessage(feature: Parameters<typeof featureGate.getFeatureDenialMessage>[0]) {
  return featureGate.getFeatureDenialMessage(feature);
}

// ==================== 导出功能桥接 ====================

/**
 * 导出图片
 */
export async function exportImage(
  options: ImageExportOptions,
  context: ImageRenderContext
): Promise<ExportResult> {
  return imageExporter.export(options, context);
}

/**
 * 导出视频
 */
export async function exportVideo(
  options: VideoExportOptions,
  context: VideoRenderContext
): Promise<ExportResult> {
  return videoExporter.export(options, context);
}

/**
 * 导出 HTML
 */
export async function exportHTML(
  options: HTMLExportOptions,
  context: HTMLRenderContext
): Promise<ExportResult> {
  return htmlExporter.export(options, context);
}

/**
 * 取消视频导出
 */
export function cancelVideoExport(): void {
  videoExporter.cancel();
}

/**
 * 检查是否正在导出
 */
export function isExporting(): boolean {
  return exportManager.isExporting();
}

// ==================== 水印桥接 ====================

/**
 * 应用水印到 Canvas
 */
export function applyWatermark(
  canvas: HTMLCanvasElement,
  config?: Partial<WatermarkConfig>
): void {
  const defaultConfig = {
    enabled: true,
    type: 'text' as const,
    text: '鲸动交互平台',
    fontSize: 32,
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    opacity: 0.3,
    position: 'bottom-right' as const,
    margin: 20,
    rotation: 0,
  };
  watermarkService.applyWatermark(canvas, { ...defaultConfig, ...config });
}

// ==================== 存储信息桥接 ====================

/**
 * 获取存储使用信息
 */
export async function getStorageInfo() {
  return storageManager.getStorageDetails();
}

/**
 * 清理临时文件
 */
export async function cleanupTempFiles() {
  return storageManager.cleanupTempFiles();
}

/**
 * 检查存储空间警告
 */
export async function checkStorageWarning() {
  return storageManager.checkStorageWarning();
}

// ==================== React Hooks 重新导出 ====================

export { useSubscription, useFeature };

// ==================== 兼容性工具 ====================

/**
 * 从旧版 localStorage 迁移工程到 IndexedDB
 */
export async function migrateFromLocalStorage(
  localStorageKey: string,
  projectName: string = '迁移的工程'
): Promise<string | null> {
  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return null;

    const projectData = JSON.parse(raw);
    const projectId = `proj_migrated_${Date.now()}`;

    await saveProjectToStorage(projectId, projectData, { name: projectName });
    await aetherDB.addRecentProject({
      projectId,
      name: projectName,
      lastOpenedAt: Date.now(),
    });

    console.log(`[Integration] 工程已从 localStorage 迁移: ${projectId}`);
    return projectId;
  } catch (e) {
    console.error('[Integration] 迁移失败:', e);
    return null;
  }
}

/**
 * 品牌名称迁移：
 * 将历史工程中遗留的旧品牌名（AETHER / Aether 相关）统一替换为「鲸动交互平台」。
 * 仅替换工程名与 meta.title 中确含旧品牌字样的部分，保留用户自定义后缀。
 * 每次启动扫描执行（成本低），以覆盖从旧 localStorage 反复恢复产生的旧名工程。
 */
export async function migrateLegacyBrandNames(): Promise<number> {
  try {
    // 先读取摘要，避免启动时将所有完整工程 JSON 一次性克隆到内存。
    const projects = await aetherDB.listProjectSummaries();
    let migrated = 0;

    for (const project of projects) {
      const oldName = project.name;
      const newName = sanitizeBrandName(oldName);
      const fullProject = newName === oldName ? null : await aetherDB.getProject(project.id);

      if (fullProject) {
        fullProject.name = newName;
        if (fullProject.data?.meta?.title) {
          fullProject.data.meta.title = sanitizeBrandName(String(fullProject.data.meta.title));
        }
        await aetherDB.saveProject(fullProject);
        migrated++;
      } else {
        // 名称/标题无变化时，仍检查场景元素中的品牌占位文字
        continue;
      }
    }

    if (migrated > 0) {
      console.log(`[Integration] 品牌迁移完成，共更新 ${migrated} 个工程`);
    }
    return migrated;
  } catch (e) {
    console.warn('[Integration] 品牌迁移失败（不影响使用）:', e);
    return 0;
  }
}

/**
 * 修正单个工程数据中的品牌名（用于当前工程从 localStorage 恢复时同步处理）。
 * 原地修改并返回，供 App 层在加载当前工程时调用。
 * 处理范围：meta.title、工程 name、以及默认工程特有的品牌文字元素（精确匹配旧品牌字样）。
 */
export function sanitizeProjectBrandName(projectData: any): any {
  if (!projectData) return projectData;
  if (projectData.meta?.title) {
    projectData.meta.title = sanitizeBrandName(String(projectData.meta.title));
  }
  if (projectData.name) {
    projectData.name = sanitizeBrandName(String(projectData.name));
  }
  // 默认工程画布中的品牌占位文字元素（精确匹配，避免误改用户自定义文字）
  const scenes = projectData.scenes || {};
  for (const scene of Object.values(scenes) as any[]) {
    const els = scene.els || [];
    for (const el of els) {
      if (typeof el.content === 'string' && BRAND_EXACT_MATCHES.has(el.content.trim())) {
        el.content = '鲸动交互平台';
      }
    }
  }
  return projectData;
}

/** 默认品牌占位文字元素的精确匹配集合 */
const BRAND_EXACT_MATCHES = new Set([
  'AETHER STUDIO',
  'AETHER ARCHITECTURE WHITEPAPER',
  'AETHER Desktop // Precision Studio',
  'Aether Studio',
  'AETHER STUDIO DESKTOP',
]);

/** 将字符串中的旧品牌名替换为「鲸动交互平台」 */
export function sanitizeBrandName(input: string): string {
  if (!input) return input;
  // 覆盖默认工程名的多种旧写法
  return input
    .replace(/AETHER Desktop\s*\/\/\s*Precision Studio/gi, '鲸动交互平台')
    .replace(/AETHER Desktop/gi, '鲸动交互平台')
    .replace(/AETHER Minimal Studio/gi, '鲸动交互平台')
    .replace(/Aether Studio Desktop/gi, '鲸动交互平台')
    .replace(/AETHER Studio/gi, '鲸动交互平台')
    .replace(/Aether Editor/gi, '鲸动交互平台')
    .replace(/\bAETHER\b/gi, '鲸动交互平台');
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  return exportManager.formatFileSize(bytes);
}

/**
 * 格式化导出耗时
 */
export function formatDuration(ms: number): string {
  return exportManager.formatDuration(ms);
}
