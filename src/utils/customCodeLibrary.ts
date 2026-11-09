import type {
  CustomCodeExportCategory,
  CustomCodeExportSlot,
  CustomCodeCategory,
  CustomCodeCategoryIcon,
  CustomCodeLibraryItem,
  CustomCodePlugin,
} from '../types';
import { aetherDB } from '../core/storage';

export const CUSTOM_CODE_LIBRARY_STORAGE_KEY = 'aether_custom_code_library_v1';
export const CUSTOM_CODE_CATEGORIES_STORAGE_KEY = 'aether_custom_code_categories_v1';

const CUSTOM_CATEGORY_ICONS: CustomCodeCategoryIcon[] = ['layers', 'chart', 'sparkles', 'palette', 'database', 'cube', 'radar', 'folder'];

export interface CustomCodeExportTargetOption {
  category: CustomCodeExportCategory;
  label: string;
  slots: Array<{ slot: CustomCodeExportSlot; label: string }>;
}

/** Drop legacy preference entries that cannot render a component. */
export function sanitizeCustomCodeLibraryItems(value: unknown): CustomCodeLibraryItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CustomCodeLibraryItem => {
    const candidate = item as Partial<CustomCodeLibraryItem> | null;
    const plugin = candidate?.plugin;
    const target = candidate?.target;
    return Boolean(
      candidate &&
      plugin &&
      typeof plugin.id === 'string' &&
      typeof plugin.name === 'string' &&
      plugin.name.trim() &&
      typeof plugin.html === 'string' &&
      plugin.html.trim() &&
      typeof target?.category === 'string' &&
      typeof target?.slot === 'string',
    );
  });
}

export const CUSTOM_CODE_EXPORT_TARGETS: CustomCodeExportTargetOption[] = [
  {
    category: 'shapes',
    label: '图形图表',
    slots: [
      { slot: 'shape-library', label: '形状库' },
      { slot: 'dashboard', label: '仪表盘' },
    ],
  },
  {
    category: 'effects',
    label: '视觉特效',
    slots: [
      { slot: 'galaxy-ui', label: 'Galaxy UI 组件库' },
      { slot: 'interaction-controls', label: '交互控件库' },
      { slot: 'vfx-library', label: '动效库' },
      { slot: 'card-layout', label: '卡片编排库' },
    ],
  },
  {
    category: 'ai',
    label: 'AI 交互',
    slots: [
      { slot: 'ai-scene', label: 'AI 交互' },
      { slot: 'ai-3d', label: '图生 3D 模型' },
      { slot: 'ai-cutout', label: 'AI 抠图' },
      { slot: 'custom-code', label: '自定义代码插件' },
    ],
  },
];

export const getCustomCodeTargetOptions = (customCategories: CustomCodeCategory[] = []): CustomCodeExportTargetOption[] => [
  ...CUSTOM_CODE_EXPORT_TARGETS,
  ...customCategories.map((category) => ({
    category: category.id,
    label: category.label,
    slots: [{ slot: category.slot, label: category.label }],
  })),
];

export const getCustomCodeTargetOption = (category: CustomCodeExportCategory, customCategories: CustomCodeCategory[] = []) =>
  getCustomCodeTargetOptions(customCategories).find((item) => item.category === category) || CUSTOM_CODE_EXPORT_TARGETS[0];

export function createCustomCodeCategory(label: string, existing: CustomCodeCategory[] = []): CustomCodeCategory | null {
  const cleanLabel = label.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!cleanLabel) return null;
  const base = cleanLabel.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'category';
  let suffix = 1;
  let id = `custom-${base}`;
  const used = new Set(existing.map((category) => category.id));
  while (used.has(id as `custom-${string}`)) id = `custom-${base}-${suffix++}`;
  const now = new Date().toISOString();
  return {
    id: id as `custom-${string}`,
    label: cleanLabel,
    icon: CUSTOM_CATEGORY_ICONS[existing.length % CUSTOM_CATEGORY_ICONS.length],
    slot: `custom-${id.slice('custom-'.length)}` as `custom-${string}`,
    createdAt: now,
  };
}

export async function loadCustomCodeCategories(): Promise<CustomCodeCategory[]> {
  try {
    const stored = await aetherDB.getPreference<CustomCodeCategory[]>(CUSTOM_CODE_CATEGORIES_STORAGE_KEY, []);
    if (Array.isArray(stored)) return stored.filter((item) => item?.id?.startsWith('custom-') && item?.label && item?.slot);
  } catch (error) {
    console.warn('[aether] 自定义栏目读取失败', error);
  }
  try {
    const fallback = JSON.parse(localStorage.getItem(CUSTOM_CODE_CATEGORIES_STORAGE_KEY) || '[]');
    return Array.isArray(fallback) ? fallback : [];
  } catch {
    return [];
  }
}

export async function saveCustomCodeCategories(categories: CustomCodeCategory[]): Promise<void> {
  const bounded = categories.slice(-50);
  try {
    await aetherDB.setPreference(CUSTOM_CODE_CATEGORIES_STORAGE_KEY, bounded);
    return;
  } catch (error) {
    try {
      localStorage.setItem(CUSTOM_CODE_CATEGORIES_STORAGE_KEY, JSON.stringify(bounded));
      return;
    } catch {
      throw error;
    }
  }
}

export async function loadCustomCodeLibrary(): Promise<CustomCodeLibraryItem[]> {
  try {
    const stored = await aetherDB.getPreference<CustomCodeLibraryItem[]>(CUSTOM_CODE_LIBRARY_STORAGE_KEY, []);
    if (Array.isArray(stored)) return sanitizeCustomCodeLibraryItems(stored);
  } catch (error) {
    console.warn('[aether] 自定义代码库读取失败', error);
  }
  try {
    const fallback = JSON.parse(localStorage.getItem(CUSTOM_CODE_LIBRARY_STORAGE_KEY) || '[]');
    return sanitizeCustomCodeLibraryItems(fallback);
  } catch {
    return [];
  }
}

export async function saveCustomCodeLibrary(items: CustomCodeLibraryItem[]): Promise<void> {
  const bounded = items.slice(-200);
  let indexedDbError: unknown;
  try {
    await aetherDB.setPreference(CUSTOM_CODE_LIBRARY_STORAGE_KEY, bounded);
    return;
  } catch (error) {
    indexedDbError = error;
  }
  try {
    localStorage.setItem(CUSTOM_CODE_LIBRARY_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    throw indexedDbError || new Error('自定义代码库无法持久化');
  }
}

export function upsertCustomCodeLibraryItem(
  items: CustomCodeLibraryItem[],
  plugin: CustomCodePlugin,
  target: CustomCodeLibraryItem['target'],
): CustomCodeLibraryItem[] {
  const now = new Date().toISOString();
  const existing = items.find((item) => item.plugin.id === plugin.id);
  const nextItem: CustomCodeLibraryItem = {
    id: existing?.id || `custom-library-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    plugin: { ...plugin, exportTarget: target, updatedAt: now },
    target,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return existing
    ? items.map((item) => item.id === existing.id ? nextItem : item)
    : [...items, nextItem];
}
