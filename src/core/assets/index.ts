/**
 * 素材管理模块 - 统一导出
 */

export { assetImporter } from './importer';
export { assetLoader } from './loader';
export * from './loadTask';
export { assetGC } from './garbageCollector';
export type { AssetRecord, AssetType } from '../db/types';
