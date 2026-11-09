import type {
  ComponentInstanceMeta,
  ComponentPreset,
  ComponentVariant,
  ProjectData,
  SceneElement,
} from '../types';

const DEFAULT_VARIANT_ID = 'default';
const round = (value: number) => Math.round(value * 100) / 100;

const cloneElement = (element: SceneElement): SceneElement => JSON.parse(JSON.stringify(element)) as SceneElement;

const numberOr = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const computeBounds = (elements: SceneElement[]) => {
  if (elements.length === 0) return { x: 0, y: 0, width: 10, height: 10 };
  const left = Math.min(...elements.map((element) => numberOr(element.x, 0)));
  const top = Math.min(...elements.map((element) => numberOr(element.y, 0)));
  const right = Math.max(...elements.map((element) => numberOr(element.x, 0) + Math.max(0.1, numberOr(element.w, 1))));
  const bottom = Math.max(...elements.map((element) => numberOr(element.y, 0) + Math.max(0.1, numberOr(element.h, 1))));
  return {
    x: left,
    y: top,
    width: Math.max(0.1, right - left),
    height: Math.max(0.1, bottom - top),
  };
};

const normalizeToBounds = (
  elements: SceneElement[],
  bounds: { x: number; y: number; width: number; height: number },
): SceneElement[] => elements.map((element, index) => {
  const sourceId = element.componentSourceId || element.id || `src_${index}`;
  return {
    ...cloneElement(element),
    id: sourceId,
    componentSourceId: sourceId,
    x: round(((numberOr(element.x, bounds.x) - bounds.x) / bounds.width) * 100),
    y: round(((numberOr(element.y, bounds.y) - bounds.y) / bounds.height) * 100),
    w: round((Math.max(0.1, numberOr(element.w, 1)) / bounds.width) * 100),
    h: round((Math.max(0.1, numberOr(element.h, 1)) / bounds.height) * 100),
    startTime: undefined,
    duration: undefined,
    componentInstance: undefined,
  };
});

export const COMPONENT_DEFAULT_VARIANT = DEFAULT_VARIANT_ID;

/**
 * Legacy presets stored absolute scene coordinates. New masters store a frame
 * size and child coordinates relative to that frame. This returns a normalized
 * copy without mutating the stored project.
 */
export function resolveMasterDataset(master: ComponentPreset): ComponentPreset {
  const hasFrame = Number.isFinite(master.width) && Number.isFinite(master.height)
    && Number(master.width) > 0 && Number(master.height) > 0;
  const baseElements = Array.isArray(master.elements) ? master.elements : [];
  const variants = Array.isArray(master.variants) ? master.variants : [];
  if (hasFrame && variants.length > 0) return master;

  if (hasFrame) {
    return {
      ...master,
      elements: baseElements,
      variants: [{ id: DEFAULT_VARIANT_ID, name: '默认', elements: baseElements }],
    };
  }

  const bounds = computeBounds(baseElements.length > 0 ? baseElements : (variants[0]?.elements || []));
  const normalizedBase = normalizeToBounds(baseElements, bounds);
  const normalizedVariants = variants.length > 0
    ? variants.map((variant) => ({
      ...variant,
      elements: normalizeToBounds(variant.elements || [], bounds),
    }))
    : [{ id: DEFAULT_VARIANT_ID, name: '默认', elements: normalizedBase }];
  const defaultVariant = normalizedVariants.find((variant) => variant.id === DEFAULT_VARIANT_ID) || normalizedVariants[0];
  return {
    ...master,
    width: bounds.width,
    height: bounds.height,
    elements: defaultVariant?.elements || normalizedBase,
    variants: normalizedVariants,
  };
}

export function getMasterVariants(master: ComponentPreset): ComponentVariant[] {
  return resolveMasterDataset(master).variants || [];
}

export function getMasterVariant(master: ComponentPreset, variantId?: string): ComponentVariant {
  const resolved = resolveMasterDataset(master);
  const variants = resolved.variants || [];
  return variants.find((variant) => variant.id === variantId) || variants[0] || {
    id: DEFAULT_VARIANT_ID,
    name: '默认',
    elements: resolved.elements || [],
  };
}

const createInstanceChildren = (elements: SceneElement[], groupId: string): SceneElement[] => elements.map((element, index) => ({
  ...cloneElement(element),
  id: `${groupId}_child_${index}`,
  componentSourceId: element.componentSourceId || element.id,
  startTime: undefined,
  duration: undefined,
  componentInstance: undefined,
}));

export interface CreateMasterOptions {
  masterId?: string;
  groupId?: string;
  zIndex?: number;
  startTime?: number;
  duration?: number;
}

export interface CreateMasterResult {
  master: ComponentPreset;
  group: SceneElement;
}

export function createMasterFromSelection(
  elements: SceneElement[],
  name: string,
  options: CreateMasterOptions = {},
): CreateMasterResult | null {
  const source = elements.filter((element) => element.type !== 'group' && element.visible !== false);
  if (source.length === 0) return null;
  const bounds = computeBounds(source);
  const masterId = options.masterId || `cmp_${Date.now().toString(36)}`;
  const groupId = options.groupId || `grp_${Date.now().toString(36)}`;
  const masterElements = normalizeToBounds(
    source.map((element, index) => ({
      ...cloneElement(element),
      id: `src_${masterId}_${index}`,
      componentSourceId: `src_${masterId}_${index}`,
    })),
    bounds,
  );
  const variant: ComponentVariant = { id: DEFAULT_VARIANT_ID, name: '默认', elements: masterElements };
  const master: ComponentPreset = {
    id: masterId,
    name: name.trim() || `组件 ${Date.now().toString(36)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    width: bounds.width,
    height: bounds.height,
    elements: masterElements,
    variants: [variant],
  };
  const group = createInstanceGroup(master, {
    groupId,
    x: bounds.x,
    y: bounds.y,
    w: bounds.width,
    h: bounds.height,
    zIndex: options.zIndex,
    startTime: options.startTime,
    duration: options.duration,
  });
  return { master, group };
}

export interface CreateInstanceOptions {
  groupId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  zIndex?: number;
  startTime?: number;
  duration?: number;
  variantId?: string;
}

export function createInstanceGroup(master: ComponentPreset, options: CreateInstanceOptions = {}): SceneElement {
  const resolved = resolveMasterDataset(master);
  const variant = getMasterVariant(resolved, options.variantId);
  const groupId = options.groupId || `grp_${Date.now().toString(36)}`;
  const x = clamp(numberOr(options.x, 34), 0, 100);
  const y = clamp(numberOr(options.y, 32), 0, 100);
  const w = Math.max(1, numberOr(options.w, resolved.width || 30));
  const h = Math.max(1, numberOr(options.h, resolved.height || 20));
  return {
    id: groupId,
    type: 'group',
    refId: '',
    sourceName: resolved.name,
    x: round(Math.min(100 - Math.min(w, 100), x)),
    y: round(Math.min(100 - Math.min(h, 100), y)),
    w: round(Math.min(100, w)),
    h: round(Math.min(100, h)),
    rot: 0,
    zIndex: options.zIndex ?? 1,
    opacity: 100,
    startTime: options.startTime ?? 0,
    duration: Math.max(0.5, options.duration ?? 5),
    mergeBaseW: round(Math.min(100, w)),
    mergeBaseH: round(Math.min(100, h)),
    children: createInstanceChildren(variant.elements, groupId),
    visible: true,
    componentInstance: {
      masterId: resolved.id,
      variantId: variant.id,
      overrides: {},
    },
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const updateGroupInProject = (
  projectData: ProjectData,
  groupId: string,
  updater: (group: SceneElement) => SceneElement,
): ProjectData => ({
  ...projectData,
  scenes: Object.fromEntries(Object.entries(projectData.scenes).map(([sceneId, scene]) => [
    sceneId,
    {
      ...scene,
      els: scene.els.map((element) => element.id === groupId ? updater(element) : element),
    },
  ])),
});

const resolveInstanceChildren = (
  master: ComponentPreset,
  group: SceneElement,
  variantId?: string,
  overrides?: ComponentInstanceMeta['overrides'],
): SceneElement[] => {
  const resolved = resolveMasterDataset(master);
  const variant = getMasterVariant(resolved, variantId);
  const existingBySource = new Map((group.children || []).map((child) => [child.componentSourceId || child.id, child]));
  return variant.elements.map((masterElement, index) => {
    const sourceId = masterElement.componentSourceId || masterElement.id;
    const existing = existingBySource.get(sourceId);
    const override = overrides?.[sourceId];
    const merged: SceneElement = {
      ...cloneElement(masterElement),
      ...(existing ? { id: existing.id } : {}),
      ...(override || {}),
      id: existing?.id || `${group.id}_child_${index}`,
      componentSourceId: sourceId,
      componentInstance: undefined,
      // Geometry always follows the master; overrides are for content/colour/visibility.
      x: masterElement.x,
      y: masterElement.y,
      w: masterElement.w,
      h: masterElement.h,
      startTime: undefined,
      duration: undefined,
    };
    return merged;
  });
};

const pruneOverrides = (
  master: ComponentPreset,
  variantId: string | undefined,
  overrides: ComponentInstanceMeta['overrides'],
): ComponentInstanceMeta['overrides'] => {
  if (!overrides) return {};
  const allowed = new Set(getMasterVariant(master, variantId).elements.map((element) => element.componentSourceId || element.id));
  return Object.fromEntries(Object.entries(overrides).filter(([sourceId]) => allowed.has(sourceId)));
};

/** Apply the current master variant to every linked instance in the project. */
export function syncInstancesForMaster(projectData: ProjectData, master: ComponentPreset): ProjectData {
  const resolved = resolveMasterDataset(master);
  return {
    ...projectData,
    scenes: Object.fromEntries(Object.entries(projectData.scenes).map(([sceneId, scene]) => [
      sceneId,
      {
        ...scene,
        els: scene.els.map((element) => {
          const meta = element.componentInstance;
          if (element.type !== 'group' || !meta || meta.masterId !== resolved.id) return element;
          const variantId = meta.variantId || resolved.variants?.[0]?.id || DEFAULT_VARIANT_ID;
          const nextOverrides = pruneOverrides(resolved, variantId, meta.overrides);
          return {
            ...element,
            sourceName: element.sourceName || resolved.name,
            mergeBaseW: element.mergeBaseW ?? element.w,
            mergeBaseH: element.mergeBaseH ?? element.h,
            children: resolveInstanceChildren(resolved, element, variantId, nextOverrides),
            componentInstance: { ...meta, overrides: nextOverrides },
          };
        }),
      },
    ])),
  };
}

export interface UpdateMasterResult {
  projectData: ProjectData;
  master: ComponentPreset;
}

/**
 * Take the selected instance as the new definition of its master and update
 * every other instance in the project. The source instance's overrides are
 * cleared because its current state is now the master itself.
 */
export function updateMasterFromInstance(projectData: ProjectData, groupId: string): UpdateMasterResult | null {
  const group = Object.values(projectData.scenes)
    .flatMap((scene) => scene.els)
    .find((element) => element.id === groupId && element.type === 'group' && element.componentInstance);
  if (!group || !group.componentInstance) return null;
  const storedMaster = (projectData.components || []).find((master) => master.id === group.componentInstance?.masterId);
  if (!storedMaster) return null;

  const resolved = resolveMasterDataset(storedMaster);
  const variantId = group.componentInstance.variantId || resolved.variants?.[0]?.id || DEFAULT_VARIANT_ID;
  const nextElements = (group.children || []).map((child, index) => {
    const sourceId = child.componentSourceId || `src_${resolved.id}_${index}`;
    const clone = cloneElement(child);
    return {
      ...clone,
      id: sourceId,
      componentSourceId: sourceId,
      startTime: undefined,
      duration: undefined,
      componentInstance: undefined,
    };
  });
  const variants = (resolved.variants || []).map((variant) => (
    variant.id === variantId ? { ...variant, elements: nextElements } : variant
  ));
  const defaultVariant = variants.find((variant) => variant.id === DEFAULT_VARIANT_ID);
  const master: ComponentPreset = {
    ...resolved,
    elements: defaultVariant?.elements || resolved.elements,
    variants,
    width: group.w,
    height: group.h,
    version: (resolved.version || 1) + 1,
    updatedAt: Date.now(),
  };
  let nextProject: ProjectData = {
    ...projectData,
    components: (projectData.components || []).map((item) => item.id === master.id ? master : item),
  };
  // Clear the source instance's overrides before syncing so it becomes the master.
  nextProject = updateGroupInProject(nextProject, groupId, (item) => ({
    ...item,
    componentInstance: item.componentInstance
      ? { ...item.componentInstance, overrides: {} }
      : item.componentInstance,
  }));
  nextProject = syncInstancesForMaster(nextProject, master);
  return { projectData: nextProject, master };
}

export function setInstanceOverride(
  projectData: ProjectData,
  groupId: string,
  sourceId: string,
  patch: Partial<SceneElement>,
): ProjectData {
  return updateGroupInProject(projectData, groupId, (group) => {
    const meta = group.componentInstance;
    if (!meta) return group;
    const safePatch = { ...patch };
    delete safePatch.id;
    delete safePatch.x;
    delete safePatch.y;
    delete safePatch.w;
    delete safePatch.h;
    delete safePatch.rot;
    delete safePatch.componentInstance;
    const nextChildren = (group.children || []).map((child) => (
      (child.componentSourceId || child.id) === sourceId
        ? { ...child, ...safePatch, id: child.id, componentSourceId: sourceId }
        : child
    ));
    return {
      ...group,
      children: nextChildren,
      componentInstance: {
        ...meta,
        overrides: {
          ...(meta.overrides || {}),
          [sourceId]: { ...(meta.overrides?.[sourceId] || {}), ...safePatch },
        },
      },
    };
  });
}

export function resetInstanceOverride(projectData: ProjectData, groupId: string, sourceId: string): ProjectData {
  return updateGroupInProject(projectData, groupId, (group) => {
    const meta = group.componentInstance;
    if (!meta) return group;
    const master = (projectData.components || []).find((item) => item.id === meta.masterId);
    if (!master) return group;
    const nextOverrides = { ...(meta.overrides || {}) };
    delete nextOverrides[sourceId];
    return {
      ...group,
      children: resolveInstanceChildren(master, group, meta.variantId, nextOverrides),
      componentInstance: { ...meta, overrides: nextOverrides },
    };
  });
}

export function switchInstanceVariant(projectData: ProjectData, groupId: string, variantId: string): ProjectData {
  return updateGroupInProject(projectData, groupId, (group) => {
    const meta = group.componentInstance;
    if (!meta) return group;
    const master = (projectData.components || []).find((item) => item.id === meta.masterId);
    if (!master) return group;
    const variant = getMasterVariant(master, variantId);
    const nextOverrides = pruneOverrides(master, variant.id, meta.overrides);
    return {
      ...group,
      children: resolveInstanceChildren(master, group, variant.id, nextOverrides),
      componentInstance: { ...meta, variantId: variant.id, overrides: nextOverrides },
    };
  });
}

export function saveInstanceAsVariant(
  projectData: ProjectData,
  groupId: string,
  name: string,
): { projectData: ProjectData; variantId: string } | null {
  const group = Object.values(projectData.scenes)
    .flatMap((scene) => scene.els)
    .find((element) => element.id === groupId && element.type === 'group' && element.componentInstance);
  if (!group || !group.componentInstance) return null;
  const storedMaster = (projectData.components || []).find((master) => master.id === group.componentInstance?.masterId);
  if (!storedMaster) return null;
  const resolved = resolveMasterDataset(storedMaster);
  const variantId = `var_${Date.now().toString(36)}`;
  const elements = (group.children || []).map((child, index) => {
    const sourceId = child.componentSourceId || `src_${resolved.id}_${index}`;
    const clone = cloneElement(child);
    return {
      ...clone,
      id: sourceId,
      componentSourceId: sourceId,
      startTime: undefined,
      duration: undefined,
      componentInstance: undefined,
    };
  });
  const variant: ComponentVariant = { id: variantId, name: name.trim() || `状态 ${(resolved.variants?.length || 0) + 1}`, elements };
  const master: ComponentPreset = {
    ...resolved,
    variants: [...(resolved.variants || []), variant],
    updatedAt: Date.now(),
    version: (resolved.version || 1) + 1,
  };
  let nextProject: ProjectData = {
    ...projectData,
    components: (projectData.components || []).map((item) => item.id === master.id ? master : item),
  };
  nextProject = updateGroupInProject(nextProject, groupId, (item) => ({
    ...item,
    children: resolveInstanceChildren(master, item, variantId, {}),
    componentInstance: item.componentInstance
      ? { ...item.componentInstance, variantId, overrides: {} }
      : item.componentInstance,
  }));
  return { projectData: nextProject, variantId };
}

export function detachInstance(projectData: ProjectData, groupId: string): ProjectData {
  return updateGroupInProject(projectData, groupId, (group) => {
    if (!group.componentInstance) return group;
    return {
      ...group,
      componentInstance: undefined,
      children: (group.children || []).map((child) => {
        const next = { ...child };
        delete next.componentSourceId;
        return next;
      }),
    };
  });
}

export function deleteMaster(projectData: ProjectData, masterId: string): ProjectData {
  let nextProject: ProjectData = {
    ...projectData,
    components: (projectData.components || []).filter((master) => master.id !== masterId),
  };
  Object.values(nextProject.scenes).forEach((scene) => {
    scene.els.forEach((element) => {
      if (element.componentInstance?.masterId === masterId) {
        nextProject = detachInstance(nextProject, element.id);
      }
    });
  });
  return nextProject;
}
