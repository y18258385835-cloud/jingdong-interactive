import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { X, Minus, Plus, RotateCcw, Download, Upload, Image, Video, Music, Type, Shapes, Gauge, Sparkles, PenTool, LayoutGrid, MousePointer2, Box, Code2, Wand2, Layers, Globe2, Table2, Plug } from 'lucide-react';
import JSZip from 'jszip';
import { 
  ProjectData, Scene, SceneElement, ViewportState, PlaybackState, PopupConfig,
  HistoryItem, HistoryActionType, BlendMode, Hotspot, SceneTransitionType, SceneTransitionOverride, CustomCodePlugin, CustomCodeLibraryItem, SceneComment, ThemeTokens
} from './types';
import { dbManager, processImageFile } from './utils/db';
import { MINIMAL_KEYNOTE_DATA } from './utils/defaultData';
import { DEFAULT_PROJECT_DATA } from './utils/officialShowcase';
import { createDashboardTemplateProject } from './utils/dashboardTemplates';
import { createFactoryOpsTemplateProject } from './utils/factoryOpsTemplate';
import { MULTIMEDIA_WORKSHOP_DATA } from './utils/workshopTemplate';
import { normalizeProjectData, isNormalizeOk } from './core/schema/normalize';
import { SCHEMA_VERSION, CURRENT_STORAGE_KEY, LEGACY_STORAGE_KEY } from './core/schema/version';
import { HeaderMenuBar } from './components/HeaderMenuBar';
import { WorkstationToolbar, type WorkspaceNavKey } from './components/WorkstationToolbar';
import { LeftSidebar, TabType } from './components/LeftSidebar';
import { CanvasViewport } from './components/CanvasViewport';
import { InspectorPanel } from './components/InspectorPanel';
import { TimelineWorkstation } from './components/TimelineWorkstation';
import { GlobalSearchModal, type GlobalSearchItem } from './components/GlobalSearchModal';
import { ThreeDLayerModal } from './components/ThreeDLayerModal';
import { AiBackgroundRemovalModal } from './components/AiBackgroundRemovalModal';
import type { WorkToolMode } from './components/AiAgentChatWorkspace';
import { TemplateCenterModal } from './components/TemplateCenterModal';
import { GALAXY_COMPONENT_BASE_SIZE, isContinuousInteractionComponent, type GalaxyComponentType } from './components/ui/galaxyComponentMeta';
import { LicenseActivationModal } from './components/LicenseActivationModal';
import { FreeExperienceModal } from './components/FreeExperienceModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { CanvasSetupModal } from './components/CanvasSetupModal';
import { useGestureControl } from './core/motion/useGestureControl';
import { MotionGestureOverlay } from './components/ui/MotionGestureOverlay';
import { OnboardingGuide, shouldShowOnboarding, markOnboardingCompleted } from './components/OnboardingGuide';
import { ErrorRecoveryModal, FriendlyErrorToast, saveCrashBackup } from './components/ErrorRecovery';
import { ShortcutsModal } from './components/ShortcutsModal';
import { HistoryPanel } from './components/HistoryPanel';
import { ShapePresetModal } from './components/ShapePresetModal';
import { ShapePresetItem, getShapeBackground, ColorThemeId, getColorThemePreset, getColorThemeTextColor, getColorThemeBorderColor } from './utils/shapeStyles';
import { SaberPresetModal } from './components/SaberPresetModal';
import { SaberShapePreset, SaberStyleTheme, SaberEffectType, SABER_SHAPE_PRESETS, SABER_STYLE_THEMES, BezierNode } from './utils/saberPresets';
import { createDefaultVfxCards, isCardLayoutMotion } from './components/CardLayoutVfx';
import { VFX_MOTION_INDEX, type VfxMotionMeta } from './utils/vfxMotionIndex';
import { useSubscription, hasFeature, requireFeature, saveProjectToStorage, loadProjectBackup, migrateLegacyBrandNames, sanitizeProjectBrandName } from './core/integration';
import { aetherDB, projectImporter } from './core/storage';
import { storeProjectThumbnail } from './core/project/thumbnail';
import { CURRENT_PROJECT_ID_STORAGE_KEY, resolveCurrentProjectId } from './core/project/currentProjectId';
import { setPlaybackClockTime } from './core/playbackClock';
import { getLoopableSceneKeys } from './utils/sceneLoop';
import { computeMediaAspect, computeProportionalSize } from './utils/mediaAspect';
import { getProjectCanvas } from './utils/canvas';
import { measureSnugTextDimensions } from './utils/typography';
import { hasExternalGltfDependencies } from './utils/gltfDependencies';
import { createDefaultGestureBindings } from './core/motion/defaults';
import { applyVariableMutation, isSafeInteractionUrl, resolveInteraction } from './utils/interactionModel';
import { runInteractionSteps } from './utils/interactionRuntime';
import { switchInstanceVariant } from './utils/componentMasters';
import { getOfficialPluginRealtimeMapping, getPluginById, OFFICIAL_PLUGIN_REGISTRY, type OfficialPluginDefinition } from './plugins/registry';
import { deserializePluginDrag, PLUGIN_DRAG_ID_MIME, PLUGIN_DRAG_MIME } from './plugins/dragPayload';
import { applyAiSceneProposal, type AiSceneProposal } from './core/ai/sceneBuilder';
import { createMultiStageContinuousInteraction } from './utils/continuousInteraction';
import { normalizePopupTheme, resolvePopupAspectRatio } from './utils/popups';
import { createCustomCodeCategory, loadCustomCodeCategories, loadCustomCodeLibrary, sanitizeCustomCodeLibraryItems, saveCustomCodeCategories, saveCustomCodeLibrary, upsertCustomCodeLibraryItem } from './utils/customCodeLibrary';
import { getCustomCodeAspectRatio, getCustomCodeDeclaredAspectRatio } from './utils/customCode';
import { useEditorControlBridge, getControlToken } from './core/control/editorBridge';
import { UpdateNotice } from './components/UpdateNotice';
import { subscriptionService } from './core/auth/subscriptionService';
import { isTransparentSceneBackground } from './utils/sceneBackground';
import { preserveProjectLayerOrder } from './core/project/layerOrder';
import { canStoreHistorySnapshot, trimSnapshotHistory } from './core/project/historyBudget';
import { createProjectHistoryRoot, getProjectHistoryStorageKey } from './core/project/historyScope';
import { EXPORT_PLAYER_GLOBAL, isExportPlayerMode } from './utils/exportPlayerMode';
import { loadRuntimeAssetUrl, resolveExportPlayerAssetUrl } from './utils/runtimeAssetUrl';
import { inferOfficialModaoId, getOfficialComponentCanvasSize } from './components/ui/officialComponentModel';
import { clearKeyframeProperties, MASK_ANIMATED_PROPERTIES, shiftKeyframes } from './core/animation/keyframes';
import { cloneSceneElement, createPastedElements } from './core/timeline/elementClipboard';
import { getScenePlaybackRange } from './core/timeline/sceneRange';
import { VersionHistoryPanel } from './components/VersionHistoryPanel';
import { CommentsPanel } from './components/CommentsPanel';
import { ThemePanel } from './components/ThemePanel';
import ShareModal from './components/ShareModal';
import HandoffPanel from './components/HandoffPanel';
import { createProjectVersion, loadProjectVersions, saveProjectVersions, trimProjectVersions, type ProjectVersion } from './utils/projectVersions';
import { createSceneComment, deleteSceneComment, unresolvedCommentCount, updateSceneComment } from './utils/comments';
import { applyThemeToProject, extractThemeFromProject, normalizeTheme, type ApplyThemeOptions } from './utils/theme';

const IS_EXPORT_PLAYER = typeof window !== 'undefined' && isExportPlayerMode(
  window.location.search,
  (window as Window & { [EXPORT_PLAYER_GLOBAL]?: unknown })[EXPORT_PLAYER_GLOBAL],
);

const AiModel3DModal = React.lazy(() => import('./components/AiModel3DModal').then((module) => ({ default: module.AiModel3DModal })));
const AiSceneBuilderModal = React.lazy(() => import('./components/AiSceneBuilderModal').then((module) => ({ default: module.AiSceneBuilderModal })));
const CustomCodePluginModal = React.lazy(() => import('./components/CustomCodePluginModal').then((module) => ({ default: module.CustomCodePluginModal })));
const AdvancedExportModal = React.lazy(() => import('./components/AdvancedExportModal').then((module) => ({ default: module.AdvancedExportModal })));
const ExportModal = React.lazy(() => import('./components/ExportModal').then((module) => ({ default: module.ExportModal })));
const VfxPresetModal = React.lazy(() => import('./components/VfxPresetModal').then((module) => ({ default: module.VfxPresetModal })));
const CardLayoutPresetModal = React.lazy(() => import('./components/CardLayoutPresetModal').then((module) => ({ default: module.CardLayoutPresetModal })));
const UILibraryModal = React.lazy(() => import('./components/UILibraryModal').then((module) => ({ default: module.UILibraryModal })));
const OfficialComponentsModal = React.lazy(() => import('./components/OfficialComponentsModal').then((module) => ({ default: module.OfficialComponentsModal })));
const PluginCenterModal = React.lazy(() => import('./components/PluginCenterModal').then((module) => ({ default: module.PluginCenterModal })));

const ModalLoadingFallback = () => (
  <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70" role="status" aria-label="正在加载">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
  </div>
);

function isPreviousOfficialShowcase(data: unknown): data is ProjectData {
  if (!data || typeof data !== 'object') return false;
  const project = data as Partial<ProjectData>;
  const templateId = project.meta?.templateId;
  const templateRevision = Number(project.meta?.templateRevision || 0);
  if (templateId === 'official-showcase') return templateRevision < 4;
  const title = project.meta?.title?.toLowerCase() || '';
  const legacyScenes = ['blank', 'material', 'timeline', 'space', 'signal', 'release'];
  const oldOfficial = title.includes('living canvas')
    && Boolean(project.scenes)
    && legacyScenes.every((id) => Boolean(project.scenes?.[id]));
  const earlierShowcase = title.includes('潮汐之间') || title.includes('spatial showcase') || (title.includes('光场编排') && !title.includes('v3'));
  return oldOfficial || earlierShowcase;
}

const ACTION_TYPE_NAMES: Record<HistoryActionType, string> = {
  init: '初始就绪',
  scene_new: '新建场景',
  scene_delete: '删除场景',
  scene_duplicate: '复制场景',
  scene_reorder: '场景排序',
  scene_update: '场景配置',
  scene_transition: '转场动效',
  element_new: '新建图层',
  element_delete: '删除图层',
  element_duplicate: '复制图层',
  element_transform: '图层变换',
  element_update: '修改属性',
  element_order: '调整层级',
  group_create: '图层编组',
  group_delete: '删除分组',
  group_update: '修改分组',
  group_ungroup: '解散分组',
  template_load: '加载模板',
  import: '导入文件',
  general: '常规编辑',
};

type AppToastType = 'error' | 'warning' | 'info';
type AppToastState = {
  message: string;
  type: AppToastType;
};

// 数据图表、仪表盘和看板组件统一收敛到 Galaxy UI 组件库中。
const DASHBOARD_COMPONENT_CATEGORIES: Partial<Record<GalaxyComponentType, string>> = {
  gauge: '数据图表',
  'pattern-prediction-chart': '数据图表',
  'pyramid-distribution-chart': '数据图表',
  'green-outline-button': '操作按钮',
  'cyan-solid-button': '操作按钮',
  'auth-toggle-button': '操作按钮',
  'transparent-bubble-button': '操作按钮',
  'blue-bubble-button': '操作按钮',
  'play-button': '操作按钮',
  'pause-button': '操作按钮',
  'pause-button-alt': '操作按钮',
  'sci-fi-neon-button': '操作按钮',
  'sci-fi-neon-frame-button': '操作按钮',
  'sci-fi-polygon-button': '操作按钮',
  'sci-fi-node-button': '操作按钮',
  'sci-fi-glow-button': '操作按钮',
  'sci-fi-stripe-button': '操作按钮',
  'back-button': '导航控件',
  'next-button': '导航控件',
  'circle-left-arrow': '导航控件',
  'circle-right-arrow': '导航控件',
  'triangle-left-arrow': '导航控件',
  'triangle-right-arrow': '导航控件',
  'rect-left-arrow': '导航控件',
  'rect-right-arrow': '导航控件',
  'sci-fi-glow-left-arrow': '导航控件',
  'sci-fi-glow-right-arrow': '导航控件',
};

// 工程数据统一经 normalizeProjectData 读取（schema 校验 + 版本迁移 + 温和修复）
// 存储 key 从 core/schema/version 统一管理（当前 v43，旧 v42 一次性迁移）

/** 外部拖入文件类型检测（素材库/时间线拖拽导入共用） */
/** Keep runtime popup geometry in physical pixels, not independent vw/vh percentages. */
function getRuntimePopupSizeStyle(popup: Partial<PopupConfig>): React.CSSProperties {
  const size = popup.popupSize || 'medium';
  const widthPercent = size === 'small' ? 40 : size === 'large' ? 80 : size === 'custom' ? (popup.popupWidth || 60) : 60;

  if (popup.popupRatio === 'free') {
    const heightPercent = popup.popupHeight || widthPercent;
    return {
      width: `${widthPercent}vw`,
      height: `${heightPercent}vh`,
      maxWidth: '96vw',
      maxHeight: '96vh',
    };
  }

  const ratio = resolvePopupAspectRatio(popup);
  return {
    width: `min(${widthPercent}vw, calc(96vh * ${ratio}))`,
    height: `min(calc(${widthPercent}vw / ${ratio}), 96vh)`,
    maxWidth: '96vw',
    maxHeight: '96vh',
    aspectRatio: ratio,
  };
}

function detectDroppedFileType(file: File): 'image' | 'video' | 'audio' | '3d' | 'gaussian-splat' | 'panorama' | 'panorama-video' | 'other' {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (name.endsWith('.ply') || name.endsWith('.splat') || /gaussian|splat/.test(name)) return 'gaussian-splat';
  if (name.endsWith('.glb') || name.endsWith('.gltf') || name.endsWith('.aether-3d.json') || mime.includes('model/')) return '3d';
  if (name.includes('pano') || name.includes('360') || name.includes('equirect')) {
    if (mime.startsWith('video/')) return 'panorama-video';
    if (mime.startsWith('image/')) return 'panorama';
  }
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac)$/.test(name)) return 'audio';
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/.test(name)) return 'image';
  return 'other';
}

/** New timeline items are always inserted above every existing scene layer. */
function getNextTopLayerZIndex(elements: readonly SceneElement[]): number {
  return Math.max(0, ...elements.map((element) => element.zIndex ?? 0)) + 10;
}

/** 控制桥/程序化导出共用：把 Blob 交给浏览器下载。 */
function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 把导出成品回传到本机控制桥，落在 data/exports/ 下，返回绝对路径。 */
async function uploadExportToBridge(blob: Blob, fileName: string): Promise<string | null> {
  const token = getControlToken();
  if (!token) return null;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    const response = await fetch('/api/control/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Control-Token': token },
      body: JSON.stringify({ filename: fileName, dataBase64: btoa(binary) }),
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return typeof data?.path === 'string' ? data.path : null;
  } catch {
    return null;
  }
}

/**
 * Return the authored end of a scene without trusting its legacy duration.
 * Older exports often keep the scene duration at 10s while a video layer (or
 * a nested group child) continues well past that point. The player must keep
 * the clock alive until the last authored layer has finished.
 */
const timelineAssetSignatureCache = new WeakMap<Scene, string>();

function getTimelineAssetSignature(scene: Scene): string {
  const cached = timelineAssetSignatureCache.get(scene);
  if (cached !== undefined) return cached;
  const refs = [scene.bgmRef, ...scene.els.map((element) => element.refId)]
    .filter((ref): ref is string => Boolean(ref))
    .sort();
  const signature = refs.join('\u001f');
  timelineAssetSignatureCache.set(scene, signature);
  return signature;
}

function getProjectTimelineAssetSignature(project: ProjectData): string {
  return Object.entries(project.scenes)
    .map(([sceneId, scene]) => `${sceneId}\u001e${getTimelineAssetSignature(scene)}`)
    .join('\u001d');
}

function getPlayheadInsertTime(currentTime: number): number {
  return Math.max(0, Math.round(currentTime * 10) / 10);
}

interface Procedural3DPackage {
  format: 'aether-procedural-3d';
  version: number;
  model: {
    ai3dCode: string;
    ai3dCodeSource?: 'seed3d' | 'img2threejs';
    ai3dTexture?: string;
    sourceName?: string;
    modelAutoRotate?: boolean;
    modelAutoRotateSpeed?: number;
    modelCameraDistance?: number;
    modelViewAzimuth?: number;
    modelViewElevation?: number;
    modelScale?: number;
    ai3dLayerDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
    ai3dLayerDistance?: number;
    ai3dExplodeDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
    ai3dExplodeDistance?: number;
    ai3dExplodeSpeed?: number;
    ai3dExplodeSpin?: number;
    ai3dCollisionDirection?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back' | 'radial';
    ai3dCollisionDistance?: number;
    ai3dCollisionBounce?: number;
    ai3dCollisionSpeed?: number;
    ai3dLayers?: number;
    ai3dExplode?: number;
    ai3dPhysics?: boolean;
    ai3dLoopEnabled?: boolean;
    ai3dPreviewControls?: SceneElement['ai3dPreviewControls'];
    ai3dExportControls?: SceneElement['ai3dExportControls'];
    ai3dControlVariant?: SceneElement['ai3dControlVariant'];
  };
}

async function readProcedural3DPackage(file: File): Promise<Procedural3DPackage> {
  const data = JSON.parse(await file.text()) as Procedural3DPackage;
  if (data.format !== 'aether-procedural-3d' || data.version !== 1 || !data.model?.ai3dCode) {
    throw new Error('不是有效的 Aether 过程化 3D 模型包');
  }
  if (data.model.ai3dCode.length > 2_000_000) {
    throw new Error('过程化 3D 模型代码过大');
  }
  return data;
}

/**
 * 归一化场景内所有图层的 zIndex，使其唯一且与图层列表顺序严格一致。
 * 规则：按 zIndex 降序稳定排序后，从高到低重新分配唯一 zIndex（top*10, (top-1)*10, …, 10）。
 * 这样"图层列表顶部（zIndex 最高）始终遮挡底部（zIndex 最低）"，
 * 与剪映的上图层遮挡下图层原理一致，消除同 zIndex 导致的遮挡歧义。
 * 相对顺序保持不变（幂等），只消除重复值。
 */
function normalizeSceneZIndices(projectData: ProjectData): ProjectData {
  return preserveProjectLayerOrder(projectData);
  /* Legacy z-index rewriting intentionally disabled: imported projects retain their authored order.
  const scenes: Record<string, Scene> = { ...projectData.scenes };
  Object.keys(scenes).forEach((sid) => {
    const scene = scenes[sid];
    if (!scene || !Array.isArray(scene.els) || scene.els.length === 0) return;
    // 稳定排序：zIndex 降序，同 zIndex 保持数组原始顺序（即列表顺序）
    const sorted = [...scene.els].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    const total = sorted.length;
    scenes[sid] = {
      ...scene,
      els: sorted.map((el, idx) => ({ ...el, zIndex: (total - idx) * 10 })),
    };
  });
  return { ...projectData, scenes }; */
}

export default function App() {
  // P1 授权层：订阅状态
  const { plan, isPaid } = useSubscription();

  // P0 存储层：工程ID（用于IndexedDB存储）
  const [projectId, setProjectId] = useState<string>(() => {
    return resolveCurrentProjectId(localStorage, () => `proj_${Date.now()}`);
  });
  const historyStorageKey = getProjectHistoryStorageKey(projectId);
  // 撤回栈改存 IndexedDB：容量远大于 localStorage，不会因 900KB 直接清空。
  const historyPrefKey = `project-history:${projectId}`;

  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(null);
  const activeProjectIdRef = useRef(projectId);
  activeProjectIdRef.current = projectId;

  // Project Core State
  const [projectData, setProjectData] = useState<ProjectData>(() => {
    // Do not briefly expose the host editor's local project while an exported
    // player is waiting for its embedded project payload.
    if (!IS_EXPORT_PLAYER) try {
      // 优先读新版本 key，其次读旧 v42 做一次性迁移
      const saved = localStorage.getItem(CURRENT_STORAGE_KEY);
      const legacy = !saved ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
      const raw = saved ?? legacy;
      if (raw) {
        const result = normalizeProjectData(JSON.parse(raw));
        if (isNormalizeOk(result)) {
          // 修正历史工程中的旧品牌名（AETHER → 鲸动交互平台）
          sanitizeProjectBrandName(result.data);
          return normalizeSceneZIndices(result.data as unknown as ProjectData);
        }
        console.warn('[aether] 工程数据校验失败，回退示例工程', result.error);
      }
    } catch (e) {
      console.warn('[aether] 读取工程失败，回退示例工程', e);
    }
    const fallback = normalizeProjectData(DEFAULT_PROJECT_DATA);
    return normalizeSceneZIndices((isNormalizeOk(fallback) ? fallback.data : DEFAULT_PROJECT_DATA) as unknown as ProjectData);
  });

  const [activeSceneId, setActiveSceneId] = useState<string>(() => {
    return projectData.start || Object.keys(projectData.scenes)[0] || 'home';
  });

  // 本地控制桥：MCP / CLI 可以读取当前工程并改文案、切场景（仅 loopback + 令牌）。
  useEditorControlBridge({
    buildSnapshot: () => ({
      title: projectData.meta?.title,
      activeSceneId,
      scenes: Object.values(projectData.scenes).map((scene) => ({
        id: scene.id,
        alias: scene.alias,
        layers: scene.els.map((el) => ({
          id: el.id,
          type: el.type,
          name: el.sourceName || el.id,
          text: el.type === 'txt' ? el.content : undefined,
        })),
      })),
    }),
    onCommand: async (command) => {
      if (command.type === 'select_scene' && command.sceneId && projectData.scenes[command.sceneId]) {
        setActiveSceneId(command.sceneId);
        return `已切换到场景 ${command.sceneId}`;
      }
      if (command.type === 'set_layer_text' && command.sceneId && command.layerId && typeof command.text === 'string') {
        setProjectData((prev) => {
          const scene = prev.scenes[command.sceneId!];
          const target = scene?.els.find((el) => el.id === command.layerId);
          if (!scene || !target) return prev;
          return {
            ...prev,
            scenes: {
              ...prev.scenes,
              [scene.id]: {
                ...scene,
                els: scene.els.map((el) => (el.id === command.layerId ? { ...el, content: command.text } : el)),
              },
            },
          };
        });
        setActiveSceneId(command.sceneId);
        return `已更新图层 ${command.layerId}`;
      }
      if (command.type === 'add_text_layer' && command.sceneId) {
        const scene = projectData.scenes[command.sceneId];
        if (!scene) throw new Error(`场景不存在：${command.sceneId}`);
        const element: SceneElement = {
          id: `el_${Date.now()}`,
          type: 'txt',
          refId: '',
          sourceName: 'MCP 文本',
          x: command.x ?? 20,
          y: command.y ?? 35,
          w: command.w ?? 60,
          h: command.h ?? 15,
          zIndex: getNextTopLayerZIndex(scene.els),
          opacity: 100,
          content: command.text || 'MCP 文本',
          color: '#ffffff',
          fontSize: command.fontSize ?? 48,
          fontWeight: '700',
          textAlign: 'center',
          startTime: 0,
          duration: scene.duration || 10,
        };
        setProjectData((prev) => ({
          ...prev,
          scenes: {
            ...prev.scenes,
            [scene.id]: { ...prev.scenes[scene.id], els: [...prev.scenes[scene.id].els, element] },
          },
        }));
        setActiveSceneId(scene.id);
        setSelectedElementId(element.id);
        return `已添加文本图层 ${element.id}`;
      }
      if (command.type === 'delete_element' && command.sceneId && command.elementId) {
        setProjectData((prev) => {
          const scene = prev.scenes[command.sceneId!];
          if (!scene) return prev;
          return {
            ...prev,
            scenes: {
              ...prev.scenes,
              [scene.id]: { ...scene, els: scene.els.filter((el) => el.id !== command.elementId) },
            },
          };
        });
        setSelectedElementId((current) => (current === command.elementId ? null : current));
        return `已删除图层 ${command.elementId}`;
      }
      if (command.type === 'export_project') {
        return await (async () => {
          const format = command.format === 'single-html' ? 'single-html' : command.format === 'json' ? 'json' : 'zip';
          const prefix = `鲸动交互平台_PROJ_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
          /** 优先写入本机 exports 目录（MCP 可直接拿到路径），失败则回退浏览器下载。 */
          const deliver = async (blob: Blob, fileName: string) => {
            if (command.saveToBridge) {
              const savedPath = await uploadExportToBridge(blob, fileName);
              if (savedPath) return `已导出到 ${savedPath}`;
            }
            downloadFile(blob, fileName);
            return `已导出 ${fileName}`;
          };

          if (format === 'json') {
            const payload = { ...projectData, schemaVersion: SCHEMA_VERSION };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            return await deliver(blob, `${prefix}_DATA.json`);
          }
          const watermark = { enabled: !subscriptionService.hasFeature('export_no_watermark') };
          const authorization = await subscriptionService.authorizeExport(format, { watermark: watermark.enabled });
          const { exportProjectZip, exportSingleFileHTML } = await import('./utils/export');
          if (format === 'zip') {
            const blob = await exportProjectZip(projectData, undefined, {
              runtime: 'editor-player',
              exportProof: authorization.proof,
              watermark,
            });
            return await deliver(blob, `${prefix}.zip`);
          }
          const html = await exportSingleFileHTML(projectData, undefined, {
            exportProof: authorization.proof,
            watermark,
          });
          return await deliver(new Blob([html], { type: 'text/html;charset=utf-8' }), `${prefix}_STANDALONE.html`);
        })();
      }
      throw new Error(`不支持的命令：${command.type}`);
    },
  });

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [timelineEditTargetId, setTimelineEditTargetId] = useState<string | null>(null);

  // 热点选中（3D/全景画面内的热点，独立于元素选中）
  const [selectedHotspot, setSelectedHotspot] = useState<{ elementId: string; hotspotId: string } | null>(null);

  // 多选集合（时间线 & 图层面板共享，剪映式 Ctrl/Shift 多选 + 全选）
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);

  // 命名版本与评论评审（版本存 IndexedDB 偏好区，评论随工程保存）
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isHandoffPanelOpen, setIsHandoffPanelOpen] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProjectVersions([]);
    loadProjectVersions(projectId).then((versions) => {
      if (!cancelled) setProjectVersions(versions);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  // 素材库刷新触发器（外部拖入/上传新素材后递增，触发素材库重新加载）
  const [assetRefreshTrigger, setAssetRefreshTrigger] = useState(0);
  // 外部文件拖入窗口的拖拽高亮遮罩
  const [isFileDragOver, setIsFileDragOver] = useState(false);

  // 选中热点（同时清除元素选中，避免 Inspector 面板冲突）
  const handleSelectHotspot = useCallback((elementId: string, hotspotId: string | null) => {
    setSelectedHotspot(hotspotId ? { elementId, hotspotId } : null);
    if (hotspotId) {
      setSelectedElementId(null);
      setMultiSelectedIds([]);
    }
  }, []);

  // 单选（画布/普通点击）：重置多选为仅该元素
  const handlePrimarySelect = useCallback((id: string | null) => {
    setTimelineEditTargetId((previous) => previous === null ? previous : null);
    setSelectedElementId((previous) => previous === id ? previous : id);
    setMultiSelectedIds((previous) => {
      const next = id ? [id] : [];
      return previous.length === next.length && previous.every((value, index) => value === next[index])
        ? previous
        : next;
    });
  }, []);

  const handleTimelineSelectElement = useCallback((id: string | null) => {
    handlePrimarySelect(id);
    setTimelineEditTargetId(id);
  }, [handlePrimarySelect]);

  // 面板内完成多选计算后统一设置（时间线/图层面板传入选中的 ids 与主项）
  const handleMultiSelectionChange = useCallback((ids: string[], primaryId: string | null) => {
    setTimelineEditTargetId(null);
    setMultiSelectedIds(ids);
    setSelectedElementId(primaryId);
  }, []);

  const handleTimelineMultiSelectionChange = useCallback((ids: string[], primaryId: string | null) => {
    handleMultiSelectionChange(ids, primaryId);
    setTimelineEditTargetId(primaryId);
  }, [handleMultiSelectionChange]);

  // 全选当前场景所有图层
  const handleSelectAllElements = useCallback(() => {
    setTimelineEditTargetId(null);
    const scene = projectData.scenes[activeSceneId];
    const els = scene?.els || [];
    if (els.length === 0) {
      setMultiSelectedIds([]);
      setSelectedElementId(null);
      return;
    }
    const ids = els.map((e) => e.id);
    setMultiSelectedIds(ids);
    setSelectedElementId(ids[ids.length - 1]);
  }, [projectData, activeSceneId]);

  const handleTimelineSelectAllElements = useCallback(() => {
    const ids = projectData.scenes[activeSceneId]?.els.map((element) => element.id) || [];
    handleSelectAllElements();
    setTimelineEditTargetId(ids[ids.length - 1] || null);
  }, [projectData, activeSceneId, handleSelectAllElements]);

  // 清空全部选择
  const handleClearSelection = useCallback(() => {
    setTimelineEditTargetId(null);
    setMultiSelectedIds([]);
    setSelectedElementId(null);
  }, []);

  // Operation History State Stack
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return [
      {
        id: 'hist_init',
        timestamp: Date.now(),
        timeStr,
        title: '载入初始工程',
        details: '工作台初始化就绪',
        actionType: 'init',
        snapshot: JSON.stringify(projectData),
      },
    ];
  });
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [leftSidebarTab, setLeftSidebarTab] = useState<TabType>('scenes');
  const [activeWorkspaceNav, setActiveWorkspaceNav] = useState<WorkspaceNavKey>('scenes');
  // 新建空白工程前的「画布设置」弹窗
  const [isCanvasSetupOpen, setIsCanvasSetupOpen] = useState(false);
  // —— 侧栏可拖拽宽度（持久化到 localStorage，避免刷新丢失） ——
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem('aether_left_panel_w'));
    return v >= 180 && v <= 560 ? v : 240;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem('aether_right_panel_w'));
    return v >= 220 && v <= 560 ? v : 256;
  });
  const startPanelResize = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = side === 'left' ? leftPanelWidth : rightPanelWidth;
    let latestW = startW;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (side === 'left') {
        const w = Math.max(180, Math.min(560, startW + dx));
        latestW = w;
        setLeftPanelWidth(w);
      } else {
        const w = Math.max(220, Math.min(560, startW - dx));
        latestW = w;
        setRightPanelWidth(w);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        if (side === 'left') {
          localStorage.setItem('aether_left_panel_w', String(latestW));
        } else {
          localStorage.setItem('aether_right_panel_w', String(latestW));
        }
      } catch {}
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    const v = Number(localStorage.getItem('aether_timeline_h'));
    return v >= 120 && v <= 750 ? v : 288;
  });
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  const startTimelineResize = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      if ('setPointerCapture' in e.currentTarget && 'pointerId' in e) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch {}

    setIsResizingTimeline(true);

    const startY = e.clientY;
    const startH = isTimelineCollapsed ? 40 : timelineHeight;
    let latestH = startH;
    let rafId: number | null = null;

    const timelineEl = document.querySelector('.aether-timeline') as HTMLElement | null;

    const updateDOM = () => {
      rafId = null;
      if (timelineEl) {
        timelineEl.style.height = `${latestH}px`;
      }
    };

    const onMove = (ev: PointerEvent | MouseEvent) => {
      const dy = ev.clientY - startY;
      const nextH = Math.max(120, Math.min(window.innerHeight * 0.75, startH - dy));
      latestH = Math.round(nextH);

      if (isTimelineCollapsed && latestH > 80) {
        setIsTimelineCollapsed(false);
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(updateDOM);
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      setIsResizingTimeline(false);
      setTimelineHeight(latestH);
      try {
        localStorage.setItem('aether_timeline_h', String(latestH));
      } catch {}
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyList.length - 1;

  // —— 历史栈持久化：刷新/关闭后仍可撤回 ——
  // 内存中保留完整撤回栈；用 IndexedDB 持久化最近 20 条快照。
  const historyListRef = useRef<HistoryItem[]>(historyList);
  useEffect(() => { historyListRef.current = historyList; }, [historyList]);
  const historyIndexRef = useRef<number>(historyIndex);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  const persistHistoryTimerRef = useRef<number | null>(null);
  const persistHistory = useCallback(() => {
    if (persistHistoryTimerRef.current) window.clearTimeout(persistHistoryTimerRef.current);
    persistHistoryTimerRef.current = window.setTimeout(() => {
      try {
        const persistedList = historyListRef.current.slice(-20);
        const persistedIndex = Math.max(0, Math.min(
          historyIndexRef.current - Math.max(0, historyListRef.current.length - persistedList.length),
          persistedList.length - 1,
        ));
        const payload = { list: persistedList, index: persistedIndex, savedAt: Date.now() };
        void aetherDB.setPreference(historyPrefKey, payload).catch(() => {});
        // 迁移完成后不再使用 localStorage（旧版本可能残留大对象）。
        try { localStorage.removeItem(historyStorageKey); } catch { /* ignore */ }
      } catch {
        // 撤回仍可在内存中使用，持久化失败不打断编辑。
      }
    }, 300);
  }, [historyPrefKey, historyStorageKey]);

  // 载入时恢复上次会话的撤回栈（IndexedDB 优先，localStorage 仅作一次性迁移）
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const applyRestore = (list: unknown[], index: unknown) => {
        if (cancelled || historyListRef.current.length > 1) return;
        const restoredHistory = trimSnapshotHistory<HistoryItem>(list.filter((item: unknown): item is HistoryItem => (
          typeof item === 'object' && item !== null && typeof (item as HistoryItem).snapshot === 'string'
        )));
        if (restoredHistory.length === 0) return;
        setHistoryList(restoredHistory);
        setHistoryIndex(Math.max(0, Math.min(Number(index) || 0, restoredHistory.length - 1)));
      };
      try {
        const stored = await aetherDB.getPreference<{ list: HistoryItem[]; index: number }>(historyPrefKey);
        if (stored && Array.isArray(stored.list) && stored.list.length) applyRestore(stored.list, stored.index);
      } catch { /* ignore */ }
      try {
        const raw = localStorage.getItem(historyStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.list)) applyRestore(parsed.list, parsed.index);
          localStorage.removeItem(historyStorageKey);
        }
      } catch { /* ignore */ }
    };
    void restore();
    return () => { cancelled = true; };
  }, [historyPrefKey, historyStorageKey]);

  // 历史栈任何变化（push/undo/redo/clear）→ 防抖持久化
  useEffect(() => {
    persistHistory();
  }, [historyList, historyIndex, persistHistory]);

  // Workstation Mode & Viewport
  // The desktop app opens in the editable workstation. Exported players remain
  // read-only previews; the official showcase is still fully editable here.
  const [isEditing, setIsEditing] = useState<boolean>(() => !IS_EXPORT_PLAYER);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(() => IS_EXPORT_PLAYER);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState<boolean>(false);
  const toggleTimelineCollapse = useCallback(() => {
    setIsTimelineCollapsed((previous) => !previous);
  }, []);
  // 桌面端默认显示完整工作台；窄屏会按响应式规则自动收起，用户仍可
  // 通过画布左上角按钮随时折叠或恢复左右面板。
  const [panelsCollapsed, setPanelsCollapsed] = useState<boolean>(false);
  const panelsAutoCollapsedForNarrowViewportRef = useRef(false);

  useEffect(() => {
    // Keep the full workstation visible on common 1024px desktop windows;
    // collapse automatically only when the canvas can no longer remain usable.
    const mediaQuery = window.matchMedia('(max-width: 960px)');
    const syncNarrowViewportPanels = () => {
      if (mediaQuery.matches) {
        setPanelsCollapsed((current) => {
          if (current) return current;
          panelsAutoCollapsedForNarrowViewportRef.current = true;
          return true;
        });
      } else if (panelsAutoCollapsedForNarrowViewportRef.current) {
        panelsAutoCollapsedForNarrowViewportRef.current = false;
        setPanelsCollapsed(false);
      }
    };

    syncNarrowViewportPanels();
    mediaQuery.addEventListener('change', syncNarrowViewportPanels);
    return () => mediaQuery.removeEventListener('change', syncNarrowViewportPanels);
  }, []);

  const [viewport, setViewport] = useState<ViewportState>({
    zoom: 0.85,
    panX: 0,
    panY: 0,
    showGrid: false,
    showSafeArea: true,
    snapEnabled: true,
    activeTool: 'select',
  });

  // Playback State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCruising, setIsCruising] = useState<boolean>(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);
  const [transitionAnimKey, setTransitionAnimKey] = useState<number>(0);
  // Kept for the legacy stage key. New scene changes use an overlapping frozen
  // outgoing frame instead of waiting for this scene to disappear first.
  const [sceneExiting, setSceneExiting] = useState<boolean>(false);
  const sceneExitTimerRef = useRef<number | null>(null);
  const pendingSceneRef = useRef<string | null>(null);
  // 【新增】元素级场景切换进出场动画覆盖：由元素「入场动画/出场动画/动画时长」触发，仅本次切换生效
  const [sceneTransitionOverride, setSceneTransitionOverride] = useState<SceneTransitionOverride | null>(null);
  const transitionOverrideRef = useRef<SceneTransitionOverride | null>(null);
  const pendingOverrideRef = useRef<SceneTransitionOverride | null>(null);
  const sceneOverrideClearTimerRef = useRef<number | null>(null);
  const [sceneTransitionRequest, setSceneTransitionRequest] = useState<{
    id: number;
    targetSceneId: string;
    exitAnimation?: SceneTransitionType;
    duration: number;
    easing: string;
  } | null>(null);
  const sceneTransitionRequestRef = useRef<{ id: number } | null>(null);
  const nextSceneTransitionRequestRef = useRef(0);

  // Preview transition trigger
  const handlePreviewTransition = useCallback(() => {
    setTransitionAnimKey((prev) => prev + 1);
    playbackTimeRef.current = 0;
    playStartWallTimeRef.current = performance.now();
    playStartTimelineTimeRef.current = 0;
    setPlaybackClockTime(0);
    setCurrentTime(0);
  }, []);

  // Dialogs
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [isAiModel3DModalOpen, setIsAiModel3DModalOpen] = useState(false);
  const [isUILibraryModalOpen, setIsUILibraryModalOpen] = useState(false);
  // 专业看板组件的内嵌 HTML 约 256 KB，只在第一次打开组件库时加载。
  const [embeddedDashboardPlugins, setEmbeddedDashboardPlugins] = useState<CustomCodePlugin[]>([]);
  useEffect(() => {
    if (!isUILibraryModalOpen || embeddedDashboardPlugins.length) return;
    let cancelled = false;
    import('./utils/embeddedDashboardComponents')
      .then((module) => { if (!cancelled) setEmbeddedDashboardPlugins(module.EMBEDDED_DASHBOARD_COMPONENTS); })
      .catch(() => { /* 看板组件加载失败不影响其他组件 */ });
    return () => { cancelled = true; };
  }, [isUILibraryModalOpen, embeddedDashboardPlugins.length]);
  const [isOfficialComponentsOpen, setIsOfficialComponentsOpen] = useState(false);
  const [gestureHudToggleNonce, setGestureHudToggleNonce] = useState(0);
  const [isInteractionControlsModalOpen, setIsInteractionControlsModalOpen] = useState(false);
  const [isPluginCenterModalOpen, setIsPluginCenterModalOpen] = useState(false);
  const [isAiSceneBuilderOpen, setIsAiSceneBuilderOpen] = useState(false);
  const [workToolMode, setWorkToolMode] = useState<WorkToolMode>('none');
  const [isCustomCodePluginOpen, setIsCustomCodePluginOpen] = useState(false);
  const [customCodeEditElementId, setCustomCodeEditElementId] = useState<string | null>(null);
  const [customCodeLibrary, setCustomCodeLibrary] = useState<CustomCodeLibraryItem[]>([]);
  const [customCodeCategories, setCustomCodeCategories] = useState<import('./types').CustomCodeCategory[]>([]);
  const [isTemplateCenterModalOpen, setIsTemplateCenterModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAdvancedExportModalOpen, setIsAdvancedExportModalOpen] = useState(false);
  const [isLicenseActivationOpen, setIsLicenseActivationOpen] = useState(false);
  const [isFreeExperienceOpen, setIsFreeExperienceOpen] = useState(false);
  // Open the editor directly on startup. The manager remains
  // available from the toolbar and should not obscure the first authored frame.
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isErrorRecoveryOpen, setIsErrorRecoveryOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isShapePresetModalOpen, setIsShapePresetModalOpen] = useState(false);
  const [isSaberPresetModalOpen, setIsSaberPresetModalOpen] = useState(false);
  const [isVfxModalOpen, setIsVfxModalOpen] = useState(false);
  const [isCardLayoutModalOpen, setIsCardLayoutModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isAiBackgroundRemovalOpen, setIsAiBackgroundRemovalOpen] = useState(false);
  // 热点媒体弹窗（+号跟踪点关联的图片/视频查看器）
  const [activeMediaHotspot, setActiveMediaHotspot] = useState<{
    mediaRefId: string;
    mediaType: 'image' | 'video';
    label?: string;
    animationType?: Hotspot['animationType'];
    animationDuration?: number;
    popupPosition?: Hotspot['popupPosition'];
    popupSize?: Hotspot['popupSize'];
    popupX?: number;
    popupY?: number;
    popupWidth?: number;
    popupHeight?: number;
    popupOverlayOpacity?: number;
    popupOverlayBlur?: number;
    popupCloseOnOverlay?: boolean;
    popupDisplay?: Hotspot['popupDisplay'];
    popupRatio?: Hotspot['popupRatio'];
    popupRatioW?: number;
    popupRatioH?: number;
    popupTheme?: Hotspot['popupTheme'];
    popupBgColor?: string;
    popupBorderColor?: string;
    popupGlowColor?: string;
    popupTitle?: string;
    popupTitleColor?: string;
    popupAccentColor?: string;
    popupRadius?: number;
  } | null>(null);
  // 场景预览弹窗（popup 类型热点点击后弹出，用户可选择进入或关闭）
  const [popupSceneId, setPopupSceneId] = useState<string | null>(null);
  const [popupSceneConfig, setPopupSceneConfig] = useState<Pick<Hotspot, 'popupPosition' | 'popupSize' | 'popupX' | 'popupY' | 'popupWidth' | 'popupHeight' | 'popupOverlayOpacity' | 'popupOverlayBlur' | 'popupCloseOnOverlay' | 'popupAnimationType' | 'popupAnimationDuration' | 'popupRadius' | 'popupBgColor' | 'popupBorderColor' | 'popupGlowColor' | 'popupTitle' | 'popupTitleColor' | 'popupAccentColor' | 'popupDisplay' | 'popupRatio' | 'popupRatioW' | 'popupRatioH' | 'popupTheme'> | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  // 图片查看器状态（+号跟踪点图片弹窗的缩放/拖拽）
  const [imgViewerScale, setImgViewerScale] = useState(1);
  const [imgViewerOffset, setImgViewerOffset] = useState({ x: 0, y: 0 });
  const imgViewerDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<AppToastState | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const cancelImportRef = useRef(false);
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((msg: string, type: AppToastType = msg.startsWith('⚠️') ? 'warning' : 'info', duration = 3200) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ message: msg, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  // Audio Player Ref
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeRef = useRef(0);
  const playStartWallTimeRef = useRef<number>(performance.now());
  const playStartTimelineTimeRef = useRef(0);
  const cruiseIdleTimerRef = useRef<any>(null);
  // P2导出层：画布容器引用（用于截图导出）
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Hidden File Inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const panoramaImgInputRef = useRef<HTMLInputElement>(null);
  const panoramaVidInputRef = useRef<HTMLInputElement>(null);
  const model3dInputRef = useRef<HTMLInputElement>(null);
  const splatInputRef = useRef<HTMLInputElement>(null);
  const globalAudioInputRef = useRef<HTMLInputElement>(null);
  const importShortcutInputRef = useRef<HTMLInputElement>(null);
  const mediaImportInputRef = useRef<HTMLInputElement>(null);
  // 连续编辑合并：同一元素同一类型操作在窗口期(800ms)内合并为一条历史
  const lastEditRef = useRef<{ elId: string; title: string; time: number } | null>(null);
  // 最新 projectData 实时引用：供「拖拽/缩放结束后合并提交历史」读取最新快照
  const projectDataRef = useRef<ProjectData>(projectData);
  projectDataRef.current = projectData;
  const persistedProjectDataRef = useRef<{ projectId: string; data: ProjectData } | null>(null);
  const thumbnailCaptureRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const thumbnailCaptureInFlightRef = useRef(false);
  const queuedThumbnailCaptureRef = useRef<{ projectId: string; force: boolean } | null>(null);
  const lastThumbnailCaptureAtRef = useRef(0);

  const handleThumbnailCaptureReady = useCallback((capture: (() => Promise<Blob | null>) | null) => {
    thumbnailCaptureRef.current = capture;
  }, []);

  const requestProjectThumbnail = useCallback((targetProjectId: string, force = false) => {
    if (IS_EXPORT_PLAYER || targetProjectId !== activeProjectIdRef.current) return;
    if (thumbnailCaptureInFlightRef.current) {
      queuedThumbnailCaptureRef.current = { projectId: targetProjectId, force };
      return;
    }
    if (!force && Date.now() - lastThumbnailCaptureAtRef.current < 1500) return;

    thumbnailCaptureInFlightRef.current = true;
    void (async () => {
      try {
        // Wait for the save-triggered React update to reach the real stage.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (targetProjectId !== activeProjectIdRef.current) return;
        const thumbnail = await thumbnailCaptureRef.current?.();
        if (!thumbnail || targetProjectId !== activeProjectIdRef.current) return;
        await storeProjectThumbnail(targetProjectId, thumbnail);
        lastThumbnailCaptureAtRef.current = Date.now();
      } catch (error) {
        // The document save has already completed. Preview generation is never
        // allowed to make a project unsavable.
        console.warn('[aether] Project thumbnail update failed', error);
      } finally {
        thumbnailCaptureInFlightRef.current = false;
        const queued = queuedThumbnailCaptureRef.current;
        queuedThumbnailCaptureRef.current = null;
        if (queued && queued.projectId === activeProjectIdRef.current) {
          requestProjectThumbnail(queued.projectId, queued.force);
        }
      }
    })();
  }, []);

  // Exported ZIPs boot this same presentation runtime in read-only mode.
  useEffect(() => {
    if (!IS_EXPORT_PLAYER) return;
    let cancelled = false;
    setIsProjectManagerOpen(false);
    setIsEditing(false);
    setIsFullscreenPreview(true);
    const embedded = (window as Window & { __AETHER_EXPORT_PROJECT__?: unknown }).__AETHER_EXPORT_PROJECT__;
    const projectPromise = embedded
      ? Promise.resolve(embedded)
      : fetch('./project.json', { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error(`project.json ${response.status}`);
        return response.json();
      });
    projectPromise
      .then((raw) => {
        if (cancelled) return;
        const normalized = normalizeProjectData(raw);
        const next = isNormalizeOk(normalized) ? normalized.data as unknown as ProjectData : raw as ProjectData;
        // Keep legacy exports visually compatible with editor preview defaults.
        next.hudConfig = { ...next.hudConfig, collapsible: next.hudConfig?.collapsible !== false };
        setProjectData(next);
        projectDataRef.current = next;
        setActiveSceneId(next.start || Object.keys(next.scenes || {})[0] || 'home');
        setIsPlaying((window as Window & { __AETHER_EXPORT_AUTOPLAY__?: boolean }).__AETHER_EXPORT_AUTOPLAY__ === true);
      })
      .catch((error) => console.error('[aether] export player project load failed', error));
    return () => { cancelled = true; };
  }, []);

  const synchronizedTimelineAssetRefs = useRef<Set<string>>(new Set());
  // Asset synchronization only depends on immutable project edits. Rebuilding
  // signatures from legacy base64 media on every playback tick creates tens of
  // megabytes of temporary strings and forces avoidable GC pauses.
  const timelineAssetSignature = useMemo(
    () => getProjectTimelineAssetSignature(projectData),
    [projectData],
  );

  // Older projects can contain generic clip labels from before asset names
  // were copied onto timeline elements. Reconcile those labels from the same
  // IndexedDB metadata used by the asset library whenever referenced assets
  // change or the library refreshes.
  useEffect(() => {
    let cancelled = false;
    const mediaTypes = new Set<SceneElement['type']>([
      'img', 'vid', 'panorama-img', 'panorama-vid', 'model-3d', 'gaussian-splat',
    ]);
    const refs = [...new Set(Object.values(projectDataRef.current.scenes)
      .flatMap((scene) => scene.els)
      .filter((element) => mediaTypes.has(element.type) && element.refId)
      .map((element) => element.refId as string))];
    if (!refs.length) return;

    void Promise.all(refs.map(async (key) => [key, await dbManager.getMetadata(key)] as const))
      .then((entries) => {
        if (cancelled) return;
        const names = new Map(entries.map(([key, metadata]) => [key, metadata?.name?.trim() || metadata?.originalName?.trim()]).filter((entry): entry is [string, string] => Boolean(entry[1])));
        if (!names.size) return;
        setProjectData((previous) => {
          let changed = false;
          const scenes = Object.fromEntries(Object.entries(previous.scenes).map(([sceneId, scene]) => {
            let sceneChanged = false;
            const els = scene.els.map((element) => {
              const name = element.refId ? names.get(element.refId) : undefined;
              if (!name || !mediaTypes.has(element.type) || element.sourceName === name) return element;
              changed = true;
              sceneChanged = true;
              return { ...element, sourceName: name };
            });
            return [sceneId, sceneChanged ? { ...scene, els } : scene];
          }));
          if (!changed) return previous;
          const next = { ...previous, scenes };
          projectDataRef.current = next;
          return next;
        });
      })
      .catch((error) => console.warn('[aether] Failed to sync timeline asset names', error));

    return () => { cancelled = true; };
  }, [projectId, timelineAssetSignature, assetRefreshTrigger]);

  // Initialize DB & load project
  useEffect(() => {
    dbManager.init();
    // 一次性迁移历史工程中的旧品牌名称（AETHER → 鲸动交互平台）
    migrateLegacyBrandNames().catch(() => {
      /* 迁移失败不影响使用 */
    });
    // 检查是否显示新手引导（首次使用）
    if (IS_EXPORT_PLAYER || isProjectManagerOpen || !shouldShowOnboarding()) return;
    const timer = window.setTimeout(() => {
      // The project manager may open during the delay. Do not let onboarding
      // cover a modal that is already active and steal its pointer events.
      if (shouldShowOnboarding() && !isProjectManagerOpen) setIsOnboardingOpen(true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [isProjectManagerOpen]);

  // Modal surfaces own pointer and keyboard input. Close onboarding as soon
  // as one opens so a previously visible guide cannot intercept their events.
  useEffect(() => {
    if (isProjectManagerOpen || isCanvasSetupOpen) setIsOnboardingOpen(false);
  }, [isProjectManagerOpen, isCanvasSetupOpen]);

  // 自定义代码组件库是跨工程复用的本地资产，存入 IndexedDB preferences。
  useEffect(() => {
    let cancelled = false;
    loadCustomCodeLibrary().then((items) => {
      if (cancelled) return;
      setCustomCodeLibrary(items);
    }).catch(() => {});
    loadCustomCodeCategories().then((categories) => {
      if (!cancelled) setCustomCodeCategories(categories);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // IndexedDB is the authoritative full-project store. Wait for hydration before
  // autosaving so the initial fallback state cannot overwrite an existing project.
  useEffect(() => {
    // Exported ZIPs are self-contained read-only players. Never hydrate them
    // from, or persist them into, the host editor's IndexedDB project.
    if (IS_EXPORT_PLAYER) return;
    // The project manager is the startup surface. Loading and normalizing the
    // previous full project here can freeze its scroll for several seconds.
    if (isProjectManagerOpen) return;
    // ProjectManager already supplied this project's full data in memory.
    if (hydratedProjectId === projectId) return;
    let cancelled = false;
    setHydratedProjectId(null);

    (async () => {
      try {
        const stored = await aetherDB.getProject(projectId);
        if (!stored || cancelled) return;
        const normalized = normalizeProjectData(stored.data);
        let normalizedData: ProjectData;
        let recoveredFromBackup = false;
        if (!isNormalizeOk(normalized)) {
          const backup = loadProjectBackup(projectId);
          const recovered = backup ? normalizeProjectData(backup) : null;
          if (!recovered || !isNormalizeOk(recovered)) {
            console.warn('[aether] IndexedDB project validation failed', normalized.error);
            return;
          }
          normalizedData = recovered.data as unknown as ProjectData;
          recoveredFromBackup = true;
          showToast('检测到工程数据异常，已从最近可用快照恢复', 'warning', 7000);
        } else {
          normalizedData = normalized.data as unknown as ProjectData;
        }
        const shouldMigrateShowcase = isPreviousOfficialShowcase(normalizedData);
        const sourceData = shouldMigrateShowcase
          ? normalizeProjectData(DEFAULT_PROJECT_DATA)
          : null;
        const project = sourceData && isNormalizeOk(sourceData)
          ? sourceData.data as unknown as ProjectData
          : normalizedData;
        const data = normalizeSceneZIndices(project);
        // Force the repaired/recovered payload through the normal save path so
        // the next startup does not hit the same corrupt IndexedDB record.
        persistedProjectDataRef.current = shouldMigrateShowcase || recoveredFromBackup ? null : { projectId, data };
        projectDataRef.current = data;
        setProjectData(data);
        setActiveSceneId(data.start || Object.keys(data.scenes)[0] || 'home');
        if (shouldMigrateShowcase) console.info('[aether] Updated the saved Living Canvas sample to the current official showcase.');
      } catch (error) {
        console.warn('[aether] Failed to load IndexedDB project', error);
        const backup = loadProjectBackup(projectId);
        const recovered = backup ? normalizeProjectData(backup) : null;
        if (recovered && isNormalizeOk(recovered) && !cancelled) {
          projectDataRef.current = normalizeSceneZIndices(recovered.data as ProjectData);
          persistedProjectDataRef.current = null;
          setProjectData(projectDataRef.current);
          setActiveSceneId(projectDataRef.current.start || Object.keys(projectDataRef.current.scenes)[0] || 'home');
          showToast('工程读取失败，已从最近可用快照恢复', 'warning', 7000);
        }
      } finally {
        if (!cancelled) setHydratedProjectId(projectId);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, isProjectManagerOpen, hydratedProjectId]);

  // Persist full projects in IndexedDB only. localStorage is reserved for small pointers.
  useEffect(() => {
    if (IS_EXPORT_PLAYER) return;
    if (hydratedProjectId !== projectId) return;
    const persisted = persistedProjectDataRef.current;
    if (persisted?.projectId === projectId && persisted.data === projectData) return;
    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      setSaveStatus('saving');
      try {
        const toSave = { ...projectData, schemaVersion: SCHEMA_VERSION } as unknown;
        saveProjectToStorage(projectId, toSave, {
          name: projectData.meta?.title || '未命名工程',
        }).then(() => {
          if (activeProjectIdRef.current === projectId && projectDataRef.current === projectData) {
            persistedProjectDataRef.current = { projectId, data: projectData };
            setSaveStatus('saved');
            localStorage.removeItem(CURRENT_STORAGE_KEY);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }).catch((e) => {
          console.warn('[aether] IndexedDB自动保存失败', e);
          if (activeProjectIdRef.current === projectId && projectDataRef.current === projectData) setSaveStatus('error');
        });
      } catch (e) {
        console.warn('[aether] 自动保存失败', e);
        if (activeProjectIdRef.current === projectId && projectDataRef.current === projectData) setSaveStatus('error');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [projectData, projectId, hydratedProjectId]);

  // Push history snapshot
  const pushHistoryItem = useCallback((
    title: string,
    options?: {
      details?: string;
      actionType?: HistoryActionType;
      sceneId?: string;
      overrideSnapshot?: ProjectData;
    }
  ) => {
    const targetData = options?.overrideSnapshot || projectData;
    const snapshotStr = JSON.stringify(targetData);
    if (!canStoreHistorySnapshot(snapshotStr)) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    setHistoryList((prevList) => {
      // Truncate any redo branch ahead of current index
      const truncated = prevList.slice(0, historyIndexRef.current + 1);
      const newItem: HistoryItem = {
        id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
        timeStr,
        title,
        details: options?.details,
        actionType: options?.actionType || 'general',
        sceneId: options?.sceneId || activeSceneId,
        snapshot: snapshotStr,
      };

      const nextList = trimSnapshotHistory([...truncated, newItem]);
      const nextIndex = Math.max(0, nextList.length - 1);
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return nextList;
    });
  }, [projectData, activeSceneId]);

  const resetHistoryForProject = useCallback((
    data: ProjectData,
    scopeProjectId: string,
    title: string,
    details?: string,
  ) => {
    const sceneId = data.start || Object.keys(data.scenes)[0];
    const nextHistory = createProjectHistoryRoot(data, {
      projectId: scopeProjectId,
      title,
      details,
      sceneId,
    });
    lastEditRef.current = null;
    setHistoryList(() => {
      historyListRef.current = nextHistory;
      historyIndexRef.current = 0;
      return nextHistory;
    });
    setHistoryIndex(0);
  }, []);

  // Jump / Time-Travel directly to a specific historical snapshot
  const handleJumpToHistory = useCallback((targetIndex: number, mode?: 'undo' | 'redo' | 'jump') => {
    if (targetIndex < 0 || targetIndex >= historyList.length) return;
    const targetRecord = historyList[targetIndex];
    if (!targetRecord) return;

    try {
      const restored = JSON.parse(targetRecord.snapshot) as ProjectData;
      setProjectData(restored);
      projectDataRef.current = restored;
      historyIndexRef.current = targetIndex;
      setHistoryIndex(targetIndex);

      // If active scene is missing in restored state, fall back to start scene
      if (!restored.scenes[activeSceneId]) {
        setActiveSceneId(restored.start || Object.keys(restored.scenes)[0] || 'home');
      }
      setSelectedElementId(null);
      setMultiSelectedIds([]);
      
      const actionName = ACTION_TYPE_NAMES[targetRecord.actionType] || '编辑操作';
      if (mode === 'undo') {
        showToast(`↩️ 撤销成功: 「${targetRecord.title}」 [${actionName}] · ${targetRecord.timeStr}`);
      } else if (mode === 'redo') {
        showToast(`↪️ 重做成功: 「${targetRecord.title}」 [${actionName}] · ${targetRecord.timeStr}`);
      } else {
        showToast(`⏱️ 已回滚至历史记录: 「${targetRecord.title}」 [${actionName}] · ${targetRecord.timeStr}`);
      }
    } catch (err) {
      console.error('Failed to restore history snapshot:', err);
      showToast('历史记录恢复失败，请尝试打开工程管理中的备份工程', 'error');
    }
  }, [historyList, activeSceneId, showToast]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      handleJumpToHistory(historyIndex - 1, 'undo');
    } else {
      showToast('⚠️ 已是最初始状态，无更多可撤销步骤');
    }
  }, [historyIndex, handleJumpToHistory, showToast]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (historyIndex < historyList.length - 1) {
      handleJumpToHistory(historyIndex + 1, 'redo');
    } else {
      showToast('⚠️ 已是最新状态，无更多可重做步骤');
    }
  }, [historyIndex, historyList.length, handleJumpToHistory, showToast]);

  // Clear History Stack (Keep current state)
  const handleClearHistory = useCallback(() => {
    if (historyList.length <= 1) return;
    const currentRecord = historyList[historyIndex] || {
      id: 'hist_' + Date.now(),
      timestamp: Date.now(),
      timeStr: '当前',
      title: '当前工作状态',
      actionType: 'general' as HistoryActionType,
      snapshot: JSON.stringify(projectData),
    };
    setHistoryList([currentRecord]);
    setHistoryIndex(0);
    historyListRef.current = [currentRecord];
    historyIndexRef.current = 0;
    showToast('🧹 已清空历史记录 (保留当前工作状态)');
  }, [historyList, historyIndex, projectData, showToast]);

  // 合并历史提交：拖拽/缩放/旋转等高频操作结束后调用一次，把整段操作合并为一条历史
  const commitHistoryItem = useCallback((title: string, actionType: HistoryActionType = 'element_update', details?: string) => {
    const snapshotStr = JSON.stringify(projectDataRef.current);
    if (!canStoreHistorySnapshot(snapshotStr)) return;
    const nowTs = Date.now();
    const now = new Date(nowTs);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setHistoryList((prevList) => {
      const truncated = prevList.slice(0, historyIndexRef.current + 1);
      const newItem: HistoryItem = {
        id: 'h_' + nowTs + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: nowTs,
        timeStr,
        title,
        details,
        actionType,
        sceneId: activeSceneId,
        snapshot: snapshotStr,
      };
      const nextList = trimSnapshotHistory([...truncated, newItem]);
      const nextIndex = Math.max(0, nextList.length - 1);
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return nextList;
    });
  }, [activeSceneId]);

  // Only report success after IndexedDB has completed the write.
  const handleManualSave = useCallback(async () => {
    if (IS_EXPORT_PLAYER) return;
    setSaveStatus('saving');
    const dataToSave = projectDataRef.current;
    try {
      const toSave = { ...dataToSave, schemaVersion: SCHEMA_VERSION } as unknown;
      await saveProjectToStorage(projectId, toSave, {
        name: dataToSave.meta?.title || '未命名工程',
      });
      if (activeProjectIdRef.current === projectId && projectDataRef.current === dataToSave) {
        persistedProjectDataRef.current = { projectId, data: dataToSave };
        setSaveStatus('saved');
      }
      if (activeProjectIdRef.current === projectId && projectDataRef.current === dataToSave) {
        requestProjectThumbnail(projectId, true);
        localStorage.removeItem(CURRENT_STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        showToast('💾 工程已保存', 'info', 5600);
      }
    } catch (e) {
      console.warn('[aether] 手动保存失败', e);
      if (activeProjectIdRef.current === projectId && projectDataRef.current === dataToSave) setSaveStatus('error');
      const isQuotaError = e instanceof DOMException && e.name === 'QuotaExceededError';
      if (activeProjectIdRef.current === projectId && projectDataRef.current === dataToSave) {
        showToast(isQuotaError ? '存储空间不足，请删除未使用素材或旧工程后重试' : '保存失败：本地工程库暂不可用，请稍后重试', 'error', 7000);
      }
    }
  }, [projectId, requestProjectThumbnail, showToast]);

  // Update Project Data wrapper with auto history record
  const handleUpdateProject = useCallback((
    updater: (prev: ProjectData) => ProjectData,
    actionTitle: string = '更新工程配置',
    actionType: HistoryActionType = 'general',
    details?: string,
    // 连续拖拽（如滑块）时传 false：实时更新但不做全量 JSON.stringify、不压历史，松手时再提交一次，避免大工程卡顿
    recordHistory: boolean = true
  ) => {
    setProjectData((prev) => {
      const next = updater(prev);
      projectDataRef.current = next;
      if (!recordHistory) return next; // 轻量路径：无序列化、无历史
      const snapshotStr = JSON.stringify(next);
      if (!canStoreHistorySnapshot(snapshotStr)) return next;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      setHistoryList((prevList) => {
        const truncated = prevList.slice(0, historyIndexRef.current + 1);
        const newItem: HistoryItem = {
          id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
          timeStr,
          title: actionTitle,
          details,
          actionType,
          sceneId: activeSceneId,
          snapshot: snapshotStr,
        };
        const nextList = trimSnapshotHistory([...truncated, newItem]);
        const nextIndex = Math.max(0, nextList.length - 1);
        historyIndexRef.current = nextIndex;
        setHistoryIndex(nextIndex);
        return nextList;
      });
      return next;
    });
  }, [activeSceneId]);

  const persistProjectVersions = useCallback((versions: ProjectVersion[]) => {
    const next = trimProjectVersions(versions);
    setProjectVersions(next);
    saveProjectVersions(projectId, next).catch((error) => console.warn('[aether] 保存版本失败', error));
  }, [projectId]);

  const handleSaveVersion = useCallback((name: string) => {
    const version = createProjectVersion(projectDataRef.current, name);
    persistProjectVersions([version, ...projectVersions]);
    showToast(`已保存版本「${version.name}」`, 'info');
  }, [persistProjectVersions, projectVersions, showToast]);

  const handleRestoreVersion = useCallback((versionId: string) => {
    const version = projectVersions.find((item) => item.id === versionId);
    if (!version) return;
    // 恢复前自动备份当前状态，避免误点丢内容。
    const backup = createProjectVersion(projectDataRef.current, `自动备份 · 恢复前 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
    persistProjectVersions([backup, ...projectVersions]);
    const normalized = normalizeProjectData(JSON.parse(JSON.stringify(version.snapshot)));
    const snapshot = (isNormalizeOk(normalized) ? normalized.data : version.snapshot) as ProjectData;
    handleUpdateProject(() => snapshot, `恢复版本「${version.name}」`, 'general');
    setSelectedElementId(null);
    setMultiSelectedIds([]);
    setTimelineEditTargetId(null);
    setSelectedHotspot(null);
    setActiveSceneId(snapshot.start || Object.keys(snapshot.scenes)[0] || 'home');
    setCurrentTime(0);
    setIsPlaying(false);
    setIsVersionPanelOpen(false);
    showToast(`已恢复到「${version.name}」，恢复前状态已自动备份`, 'info', 5000);
  }, [handleUpdateProject, persistProjectVersions, projectVersions, showToast]);

  const handleDeleteVersion = useCallback((versionId: string) => {
    persistProjectVersions(projectVersions.filter((item) => item.id !== versionId));
    showToast('版本已删除', 'info');
  }, [persistProjectVersions, projectVersions, showToast]);

  const handleAddComment = useCallback((x: number, y: number, text: string) => {
    const comment = createSceneComment(activeSceneId, x, y, text);
    handleUpdateProject((prev) => ({
      ...prev,
      comments: [...(prev.comments || []), comment],
    }), '添加评论', 'general');
    setFocusedCommentId(comment.id);
  }, [activeSceneId, handleUpdateProject]);

  const handleUpdateComment = useCallback((commentId: string, patch: Partial<SceneComment>) => {
    handleUpdateProject((prev) => ({
      ...prev,
      comments: updateSceneComment(prev.comments, commentId, patch),
    }), '更新评论', 'general', undefined, false);
  }, [handleUpdateProject]);

  const handleDeleteComment = useCallback((commentId: string) => {
    handleUpdateProject((prev) => ({
      ...prev,
      comments: deleteSceneComment(prev.comments, commentId),
    }), '删除评论', 'general');
    setFocusedCommentId((current) => current === commentId ? null : current);
  }, [handleUpdateProject]);

  const handleSaveTheme = useCallback((theme: ThemeTokens) => {
    handleUpdateProject((prev) => ({ ...prev, theme: normalizeTheme(theme) }), '保存工程主题', 'general');
    showToast('工程主题已保存', 'info');
  }, [handleUpdateProject, showToast]);

  const handleApplyTheme = useCallback((theme: ThemeTokens, options: ApplyThemeOptions) => {
    handleUpdateProject((prev) => applyThemeToProject(prev, theme, options), '应用工程主题', 'general');
    showToast('主题已应用到工程，可用 Ctrl+Z 撤销', 'info');
  }, [handleUpdateProject, showToast]);

  const handleExtractTheme = useCallback(() => extractThemeFromProject(projectDataRef.current), []);

  /** 交付标注页优先带真实画布截图；失败时仍导出坐标与样式清单。 */
  const handleCaptureHandoffStage = useCallback(async (): Promise<string | null> => {
    const container = canvasContainerRef.current;
    if (!container) return null;
    try {
      const { captureElement, getExportCaptureTarget } = await import('./utils/canvasCapture');
      const result = await captureElement(getExportCaptureTarget(container), {
        scale: 1,
        backgroundColor: null,
        includeDataUrl: true,
        mutateSource: false,
      });
      return result.dataUrl || null;
    } catch {
      return null;
    }
  }, []);

  const handleRenameAssetInProject = useCallback((assetKey: string, name: string) => {
    handleUpdateProject((previous) => {
      let changed = false;
      const scenes = Object.fromEntries(Object.entries(previous.scenes).map(([sceneId, scene]) => {
        let sceneChanged = false;
        const els = scene.els.map((element) => {
          if (element.refId !== assetKey || element.sourceName === name) return element;
          changed = true;
          sceneChanged = true;
          return { ...element, sourceName: name };
        });
        return [sceneId, sceneChanged ? { ...scene, els } : scene];
      }));
      return changed ? { ...previous, scenes } : previous;
    }, '同步素材名称', 'element_update', `素材名称已更新为「${name}」`);
  }, [handleUpdateProject]);

  const handleVariableMutation = useCallback((config: Parameters<typeof applyVariableMutation>[1]) => {
    handleUpdateProject((prev) => ({
      ...prev,
      variables: applyVariableMutation(prev.variables, config),
    }), '更新交互变量', 'general', undefined, false);
  }, [handleUpdateProject]);

  // Update Element wrapper
  const handleUpdateElement = useCallback((
    elId: string, 
    updates: Partial<SceneElement>,
    actionTitle?: string,
    recordHistory: boolean = true
  ) => {
    setProjectData((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      const targetEl = scene.els.find((el) => el.id === elId);
      const elLabel = targetEl?.content || targetEl?.sourceName || elId;
      const nextUpdates: Partial<SceneElement> = { ...updates };
      // A mask reset must also remove mask tracks, otherwise playback can
      // immediately restore the old animated selection when the mask is enabled.
      if (
        targetEl &&
        updates.maskEnabled === false &&
        updates.maskType === 'rectangle' &&
        updates.maskX === 0 &&
        updates.maskY === 0 &&
        updates.maskWidth === 100 &&
        updates.maskHeight === 100 &&
        Array.isArray(updates.maskNodes) &&
        updates.maskNodes.length === 0
      ) {
        nextUpdates.maskRadius = 0;
        nextUpdates.maskFeather = 0;
        nextUpdates.maskInvert = false;
        nextUpdates.keyframes = clearKeyframeProperties(targetEl, MASK_ANIMATED_PROPERTIES);
      }
      // Keyframes use scene time. Keep them attached when a layer start is
      // edited outside the timeline (for example in the inspector input).
      if (targetEl && updates.startTime !== undefined && updates.keyframes === undefined) {
        const delta = Number(updates.startTime) - Number(targetEl.startTime || 0);
        if (Math.abs(delta) > 0.001) nextUpdates.keyframes = shiftKeyframes(targetEl, delta);
      }

      // Numeric inspector fields intentionally emit a live update followed by
      // a history commit on blur. If the committed value is unchanged, avoid
      // rebuilding the project and re-rendering the whole canvas a second time.
      if (targetEl) {
        const hasActualChange = Object.entries(nextUpdates).some(([key, value]) => (
          value !== targetEl[key as keyof SceneElement]
        ));
        if (!hasActualChange) return prev;
      }

      const nextProject = {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.map((el) => (el.id === elId ? { ...el, ...nextUpdates } : el)),
          },
        },
      };
      projectDataRef.current = nextProject;

      const historyTitle = actionTitle || '修改图层属性';
      if (recordHistory) {
        const snapshotStr = JSON.stringify(nextProject);
        if (!canStoreHistorySnapshot(snapshotStr)) return nextProject;
        const nowTs = Date.now();
        const now = new Date(nowTs);
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const prevEdit = lastEditRef.current;
        const shouldMerge = !!prevEdit && prevEdit.elId === elId && prevEdit.title === historyTitle && (nowTs - prevEdit.time) < 800;
        setHistoryList((prevList) => {
          const truncated = prevList.slice(0, historyIndexRef.current + 1);
          const last = truncated[truncated.length - 1];
          if (shouldMerge && last && last.title === historyTitle && last.actionType === 'element_update') {
            // 合并连续编辑：仅更新最后一条历史的快照，避免拖拽滑块产生海量历史
            const merged = trimSnapshotHistory([...truncated.slice(0, -1), { ...last, snapshot: snapshotStr, timestamp: nowTs, timeStr }]);
            historyIndexRef.current = Math.max(0, merged.length - 1);
            setHistoryIndex(historyIndexRef.current);
            return merged;
          }
          const newItem: HistoryItem = {
            id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: nowTs,
            timeStr,
            title: historyTitle,
            details: `图层: ${elLabel}`,
            actionType: 'element_update',
            sceneId: activeSceneId,
            snapshot: snapshotStr,
          };
          const nextList = trimSnapshotHistory([...truncated, newItem]);
          historyIndexRef.current = Math.max(0, nextList.length - 1);
          setHistoryIndex(historyIndexRef.current);
          return nextList;
        });
        lastEditRef.current = { elId, title: historyTitle, time: nowTs };
      }

      return nextProject;
    });
  }, [activeSceneId]);

  // Repair legacy timeline entries whose embedded plugin HTML was lost while
  // keeping the plugin in the reusable library. This runs without a history
  // entry because it is data migration, not a user edit.
  useEffect(() => {
    if (IS_EXPORT_PLAYER) return;
    const validItems = sanitizeCustomCodeLibraryItems(customCodeLibrary);
    if (!validItems.length) return;
    const candidates = validItems.map((item) => item.plugin);
    setProjectData((previous) => {
      let changed = false;
      const scenes = Object.fromEntries(Object.entries(previous.scenes).map(([sceneId, scene]) => {
        const els = scene.els.map((element) => {
          if (element.type !== 'custom-code' || element.customCode?.html?.trim()) return element;
          const match = candidates.find((plugin) =>
            plugin.id === element.customCode?.id ||
            plugin.name === element.customCode?.name ||
            plugin.name === element.sourceName,
          );
          if (!match) return element;
          changed = true;
          return {
            ...element,
            sourceName: match.name,
            customCode: { ...match, version: Math.max(1, (element.customCode?.version || 0) + 1), updatedAt: new Date().toISOString() },
          };
        });
        return [sceneId, els === scene.els ? scene : { ...scene, els }];
      }));
      if (!changed) return previous;
      const next = { ...previous, scenes };
      projectDataRef.current = next;
      return next;
    });
  }, [customCodeLibrary]);

  // 删除指定热点
  const handleDeleteHotspot = useCallback((elementId: string, hotspotId: string) => {
    const scene = projectData.scenes[activeSceneId];
    if (!scene) return;
    const el = scene.els.find((e) => e.id === elementId);
    if (!el || !Array.isArray(el.hotspots)) return;
    const remaining = el.hotspots.filter((h) => h.id !== hotspotId);
    handleUpdateElement(elementId, { hotspots: remaining });
    setSelectedHotspot((prev) => (prev && prev.hotspotId === hotspotId ? null : prev));
  }, [projectData.scenes, activeSceneId, handleUpdateElement]);

  // 更新热点属性（局部更新单个热点）
  const handleUpdateHotspot = useCallback((elementId: string, hotspotId: string, patch: Partial<Hotspot>) => {
    const scene = projectData.scenes[activeSceneId];
    if (!scene) return;
    const el = scene.els.find((e) => e.id === elementId);
    if (!el || !Array.isArray(el.hotspots)) return;
    const updated = el.hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h));
    handleUpdateElement(elementId, { hotspots: updated });
  }, [projectData.scenes, activeSceneId, handleUpdateElement]);

  // Delete Element
  const handleDeleteElement = useCallback((elId: string) => {
    setProjectData((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      const targetEl = scene.els.find((el) => el.id === elId);
      const elLabel = targetEl?.content || targetEl?.sourceName || elId;
      const deletedRefs: string[] = [];
      if (targetEl?.refId) deletedRefs.push(targetEl.refId);

      const nextProject = {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.filter((el) => el.id !== elId),
          },
        },
      };

      // 清理不再被任何场景/元素引用的素材资源，防止 IndexedDB 存储泄漏
      // 【修复】素材引用检查必须把「剪贴板」也算进去：剪切（Ctrl+X）= 复制 + 删除，
      // 删除时元素虽已从场景移除，但剪贴板仍持有其引用（用户随后粘贴需要素材仍在）。
      // 否则剪切后粘贴会出现素材占位符（素材被误删，assetUrls 加载不到）。
      if (deletedRefs.length > 0) {
        setTimeout(() => {
          deletedRefs.forEach((ref) => {
            const sceneHasRef = (sc: any) => (sc.els || []).some((el: any) =>
              el.refId === ref || (el.children && el.children.some((c: any) => c.refId === ref))
            ) || sc.bgRef === ref || sc.bgmRef === ref;
            const clipHasRef = clipboardRef.current.some((el: any) =>
              el.refId === ref || (el.children && el.children.some((c: any) => c.refId === ref))
            );
            const stillUsed = Object.values(nextProject.scenes).some(sceneHasRef) || clipHasRef;
            if (!stillUsed) {
              dbManager.delete(ref).catch(() => {});
            }
          });
        }, 0);
      }

      const snapshotStr = JSON.stringify(nextProject);
      if (!canStoreHistorySnapshot(snapshotStr)) return nextProject;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setHistoryList((prevList) => {
        const truncated = prevList.slice(0, historyIndexRef.current + 1);
        const newItem: HistoryItem = {
          id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
          timeStr,
          title: '删除图层',
          details: `图层: ${elLabel}`,
          actionType: 'element_delete',
          sceneId: activeSceneId,
          snapshot: snapshotStr,
        };
        const nextList = trimSnapshotHistory([...truncated, newItem]);
        const nextIndex = Math.max(0, nextList.length - 1);
        historyIndexRef.current = nextIndex;
        setHistoryIndex(nextIndex);
        return nextList;
      });

      return nextProject;
    });
    setSelectedElementId(null);
    setMultiSelectedIds([]);
  }, [activeSceneId]);

  // 批量删除多个图层（多选后使用，合并为一条历史记录）
  const handleDeleteElements = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setProjectData((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      const toDelete = scene.els.filter((el) => idSet.has(el.id));
      const deletedRefs: string[] = [];
      toDelete.forEach((el) => { if (el.refId) deletedRefs.push(el.refId); });
      const elLabels = toDelete.map((el) => el.content || el.sourceName || el.id).join('、');

      const nextProject = {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.filter((el) => !idSet.has(el.id)),
          },
        },
      };

      // 清理不再被任何场景/元素引用的素材资源
      // 【修复】引用检查加入剪贴板：剪切后粘贴需要素材仍在，防止误删导致粘贴占位符
      if (deletedRefs.length > 0) {
        setTimeout(() => {
          deletedRefs.forEach((ref) => {
            const sceneHasRef = (sc: any) => (sc.els || []).some((el: any) =>
              el.refId === ref || (el.children && el.children.some((c: any) => c.refId === ref))
            ) || sc.bgRef === ref || sc.bgmRef === ref;
            const clipHasRef = clipboardRef.current.some((el: any) =>
              el.refId === ref || (el.children && el.children.some((c: any) => c.refId === ref))
            );
            const stillUsed = Object.values(nextProject.scenes).some(sceneHasRef) || clipHasRef;
            if (!stillUsed) {
              dbManager.delete(ref).catch(() => {});
            }
          });
        }, 0);
      }

      const snapshotStr = JSON.stringify(nextProject);
      if (!canStoreHistorySnapshot(snapshotStr)) return nextProject;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setHistoryList((prevList) => {
        const truncated = prevList.slice(0, historyIndexRef.current + 1);
        const newItem: HistoryItem = {
          id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
          timeStr,
          title: ids.length > 1 ? `删除 ${ids.length} 个图层` : '删除图层',
          details: `图层: ${elLabels}`,
          actionType: 'element_delete',
          sceneId: activeSceneId,
          snapshot: snapshotStr,
        };
        const nextList = trimSnapshotHistory([...truncated, newItem]);
        const nextIndex = Math.max(0, nextList.length - 1);
        historyIndexRef.current = nextIndex;
        setHistoryIndex(nextIndex);
        return nextList;
      });

      return nextProject;
    });
    setMultiSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    setSelectedElementId((prev) => (prev && idSet.has(prev) ? null : prev));
  }, [activeSceneId]);

  // —— 剪贴板：Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+D 复制 / 剪切 / 粘贴 / 重复 ——
  const clipboardRef = useRef<SceneElement[]>([]);
  const selectionRef = useRef<{ selectedElementId: string | null; multiSelectedIds: string[] }>({ selectedElementId: null, multiSelectedIds: [] });
  selectionRef.current = { selectedElementId, multiSelectedIds };

  const getSelectedElementIds = useCallback((scene: Scene | undefined) => {
    if (!scene) return [];
    const ids = multiSelectedIds.length > 0 ? multiSelectedIds : (selectedElementId ? [selectedElementId] : []);
    return ids.filter((id, index) => ids.indexOf(id) === index && scene.els.some((element) => element.id === id));
  }, [multiSelectedIds, selectedElementId]);

  const copyElementsToClipboard = useCallback((scene: Scene | undefined, ids: string[]) => {
    if (!scene || ids.length === 0) return false;
    const elements = scene.els.filter((element) => ids.includes(element.id));
    if (elements.length === 0) return false;
    clipboardRef.current = elements.map(cloneSceneElement);
    return true;
  }, []);

  const handleCopyElements = useCallback(() => {
    const scene = projectDataRef.current.scenes[activeSceneId];
    const selected = selectionRef.current;
    const ids = (selected.multiSelectedIds.length > 0 ? selected.multiSelectedIds : (selected.selectedElementId ? [selected.selectedElementId] : []))
      .filter((id, index, values) => values.indexOf(id) === index && scene?.els.some((element) => element.id === id));
    if (!copyElementsToClipboard(scene, ids)) return;
    const els = ids;
    showToast(`📋 已复制 ${els.length} 个图层`);
  }, [projectData, activeSceneId, getSelectedElementIds, copyElementsToClipboard, showToast]);

  const handleCutElements = useCallback(() => {
    const scene = projectDataRef.current.scenes[activeSceneId];
    const selected = selectionRef.current;
    const ids = (selected.multiSelectedIds.length > 0 ? selected.multiSelectedIds : (selected.selectedElementId ? [selected.selectedElementId] : []))
      .filter((id, index, values) => values.indexOf(id) === index && scene?.els.some((element) => element.id === id));
    if (!copyElementsToClipboard(scene, ids)) return;
    if (ids.length > 1) handleDeleteElements(ids);
    else if (ids[0]) handleDeleteElement(ids[0]);
  }, [projectData, activeSceneId, getSelectedElementIds, copyElementsToClipboard, handleDeleteElements, handleDeleteElement]);

  const handlePasteElements = useCallback(() => {
    const scene = projectDataRef.current.scenes[activeSceneId];
    if (!scene || clipboardRef.current.length === 0) return;
    if (isPlaying) setIsPlaying(false);
    const startTime = getPlayheadInsertTime(currentTime);
    const topZIndex = getNextTopLayerZIndex(scene.els);
    const newEls = createPastedElements(clipboardRef.current, startTime, topZIndex);
    if (newEls.length === 0) return;
    const pastedProject = {
      ...projectDataRef.current,
      scenes: {
        ...projectDataRef.current.scenes,
        [activeSceneId]: { ...scene, els: [...scene.els, ...newEls] },
      },
    };
    // Apply the visible paste immediately. Serializing a large project for
    // history is deferred so big media projects do not freeze before render.
    handleUpdateProject(() => pastedProject, `粘贴图层 (${newEls.length} 个)`, 'element_duplicate', undefined, false);
    window.setTimeout(() => {
      pushHistoryItem(`粘贴图层 (${newEls.length} 个)`, {
        actionType: 'element_duplicate',
        overrideSnapshot: pastedProject,
      });
    }, 0);
    setSelectedElementId(newEls[0]?.id ?? null);
    setMultiSelectedIds(newEls.map((e) => e.id));
    showToast(`📄 已粘贴 ${newEls.length} 个图层`);
  }, [projectData, activeSceneId, currentTime, handleUpdateProject, isPlaying, pushHistoryItem, showToast]);

  // —— 嵌套合并：把多个图层合并为一个「容器图层」，可随时拆开 ——
  const handleMergeElements = useCallback((targetIds?: string[]) => {
    const scene = projectData.scenes[activeSceneId];
    if (!scene) return;
    const ids = targetIds || (multiSelectedIds.length > 0 ? multiSelectedIds : (selectedElementId ? [selectedElementId] : []));
    const toMerge = scene.els.filter((e) => ids.includes(e.id) && e.type !== 'group' && !e.locked);
    if (toMerge.length < 2) { showToast('⚠️ 请先选中至少 2 个图层（可多选）再合并'); return; }
    // 计算包围盒
    const minX = Math.min(...toMerge.map((e) => e.x));
    const minY = Math.min(...toMerge.map((e) => e.y));
    const maxX = Math.max(...toMerge.map((e) => e.x + e.w));
    const maxY = Math.max(...toMerge.map((e) => e.y + e.h));
    const gx = Math.round(minX * 100) / 100;
    const gy = Math.round(minY * 100) / 100;
    const gw = Math.max(1, Math.round((maxX - minX) * 100) / 100);
    const gh = Math.max(1, Math.round((maxY - minY) * 100) / 100);
    const minStart = Math.min(...toMerge.map((e) => e.startTime || 0));
    const maxEnd = Math.max(...toMerge.map((e) => (e.startTime || 0) + (e.duration || 5)));
    // 子图层坐标 → 相对容器左上角的百分比
    const children: SceneElement[] = toMerge.map((e) => ({
      ...e,
      x: Math.round(((e.x - gx) / gw) * 10000) / 100,
      y: Math.round(((e.y - gy) / gh) * 10000) / 100,
      w: Math.round((e.w / gw) * 10000) / 100,
      h: Math.round((e.h / gh) * 10000) / 100,
    }));
    const groupEl: SceneElement = {
      id: 'grp_' + Date.now(),
      type: 'group',
      refId: '',
      sourceName: '合并图层组',
      x: gx, y: gy, w: gw, h: gh,
      rot: 0,
      zIndex: Math.max(...toMerge.map((e) => e.zIndex || 0)),
      opacity: 100,
      startTime: minStart,
      duration: Math.max(0.5, Math.round((maxEnd - minStart) * 100) / 100),
      mergeBaseW: gw,
      mergeBaseH: gh,
      children,
      visible: true,
    };
    handleUpdateProject((prev) => {
      const sc = prev.scenes[activeSceneId];
      if (!sc) return prev;
      return {
        ...prev,
        scenes: { ...prev.scenes, [activeSceneId]: { ...sc, els: [...sc.els.filter((e) => !ids.includes(e.id)), groupEl] } },
      };
    }, `合并图层组（${toMerge.length} 个图层）`, 'group_create', `子图层: ${toMerge.map((e) => e.sourceName || e.content || e.id).join('、')}`);
    setSelectedElementId(groupEl.id);
    setMultiSelectedIds([]);
  }, [projectData, activeSceneId, multiSelectedIds, selectedElementId, handleUpdateProject, showToast]);

  const handleUnmergeElement = useCallback((elId: string) => {
    const scene = projectData.scenes[activeSceneId];
    if (!scene) return;
    const g = scene.els.find((e) => e.id === elId && e.type === 'group');
    if (!g || !g.children || g.children.length === 0) { showToast('⚠️ 该图层无法拆开'); return; }
    const gx = g.x, gy = g.y, gw = g.w, gh = g.h;
    const restored: SceneElement[] = g.children.map((c) => {
      const { mergeBaseW: _mw, mergeBaseH: _mh, ...rest } = c;
      return {
        ...rest,
        x: Math.round((gx + (c.x / 100) * gw) * 100) / 100,
        y: Math.round((gy + (c.y / 100) * gh) * 100) / 100,
        w: Math.max(0.5, Math.round(((c.w / 100) * gw) * 100) / 100),
        h: Math.max(0.5, Math.round(((c.h / 100) * gh) * 100) / 100),
        zIndex: c.zIndex ?? g.zIndex,
      };
    });
    handleUpdateProject((prev) => {
      const sc = prev.scenes[activeSceneId];
      if (!sc) return prev;
      return {
        ...prev,
        scenes: { ...prev.scenes, [activeSceneId]: { ...sc, els: [...sc.els.filter((e) => e.id !== elId), ...restored] } },
      };
    }, `拆开合并图层组（${restored.length} 个图层）`, 'group_ungroup');
    setSelectedElementId(restored[0]?.id ?? null);
    setMultiSelectedIds([]);
  }, [projectData, activeSceneId, handleUpdateProject, showToast]);

  // Split element at playhead (剪映式按指针分割，供时间线右键菜单与 C 键快捷键共用)
  const handleSplitElement = useCallback((elId: string) => {
    const scene = projectData.scenes[activeSceneId];
    if (!scene) return;
    const el = scene.els.find((e) => e.id === elId);
    if (!el || el.locked || el.type === 'group') return; // 合并图层组不可按指针分割
    const splitTime = Math.round(currentTime * 100) / 100;
    const elEnd = el.startTime + el.duration;
    if (splitTime <= el.startTime + 0.1 || splitTime >= elEnd - 0.1) return;
    const firstDur = Math.round((splitTime - el.startTime) * 100) / 100;
    const newId = 'el_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const newEl: SceneElement = {
      ...el,
      id: newId,
      startTime: splitTime,
      duration: Math.round((elEnd - splitTime) * 100) / 100,
    };
    handleUpdateProject((prev) => {
      const s = prev.scenes[activeSceneId];
      if (!s) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...s,
            els: s.els.map((e) => (e.id === elId ? { ...e, duration: firstDur } : e)).concat(newEl),
          },
        },
      };
    }, '分割片段', 'element_update', `${el.sourceName || el.content || '片段'} @ ${splitTime.toFixed(2)}s`);
    setSelectedElementId(newId);
    setMultiSelectedIds([newId]);
  }, [projectData, activeSceneId, currentTime, handleUpdateProject]);

  // Active scene accessor
  const activeScene = projectData.scenes[activeSceneId] || Object.values(projectData.scenes)[0];
  useEffect(() => {
    if (timelineEditTargetId && !activeScene?.els.some((element) => element.id === timelineEditTargetId)) {
      setTimelineEditTargetId(null);
    }
  }, [activeScene, timelineEditTargetId]);

  const playbackRange = useMemo(() => {
    return getScenePlaybackRange(activeScene);
  }, [activeScene]);

  useEffect(() => {
    if (!isPlaying) {
      playbackTimeRef.current = currentTime;
      setPlaybackClockTime(currentTime);
    }
  }, [currentTime, isPlaying]);

  // Switch Scene
  const commitSelectScene = useCallback((sceneId: string, override?: SceneTransitionOverride | null) => {
    // 元素级进出场动画覆盖：本次切换带有覆盖则应用到新场景「入场动画」；普通切换则清除残留覆盖
    const effOverride = override ?? transitionOverrideRef.current ?? null;
    if (effOverride && (effOverride.enterAnim !== undefined || effOverride.duration !== undefined)) {
      transitionOverrideRef.current = effOverride;
      setSceneTransitionOverride(effOverride);
    } else {
      transitionOverrideRef.current = null;
      setSceneTransitionOverride(null);
    }
    setActiveSceneId(sceneId);
    setSelectedElementId(null);
    setTimelineEditTargetId(null);
    setMultiSelectedIds([]);
    setSelectedHotspot(null); // 切换场景时重置热点选中
    setPopupSceneId(null);    // 【修复】切换场景时关闭热点「场景预览」弹窗，避免残留
    setTransitionAnimKey((k) => k + 1);
    playbackTimeRef.current = 0;
    playStartWallTimeRef.current = performance.now();
    playStartTimelineTimeRef.current = 0;
    setPlaybackClockTime(0);
    setCurrentTime(0);
    // 入场动画结束后清除覆盖，避免影响后续（巡航/切页/自动轮播等）普通切换
    if (sceneOverrideClearTimerRef.current) window.clearTimeout(sceneOverrideClearTimerRef.current);
    const enterDurMs = ((effOverride?.duration ?? projectData.scenes[sceneId]?.transitionDuration ?? 0.6) + 0.1) * 1000;
    sceneOverrideClearTimerRef.current = window.setTimeout(() => {
      transitionOverrideRef.current = null;
      setSceneTransitionOverride(null);
      sceneOverrideClearTimerRef.current = null;
    }, enterDurMs);
  }, [projectData.scenes, isPlaying]);

  const finishSceneTransition = useCallback((requestId: number) => {
    if (sceneTransitionRequestRef.current?.id !== requestId) return;
    if (sceneExitTimerRef.current) window.clearTimeout(sceneExitTimerRef.current);
    sceneExitTimerRef.current = null;
    sceneTransitionRequestRef.current = null;
    setSceneTransitionRequest(null);
    setSceneExiting(false);
    const target = pendingSceneRef.current;
    const override = pendingOverrideRef.current;
    pendingSceneRef.current = null;
    pendingOverrideRef.current = null;
    if (target) commitSelectScene(target, override);
  }, [commitSelectScene]);

  const handleSceneTransitionSnapshot = useCallback((requestId: number) => {
    finishSceneTransition(requestId);
  }, [finishSceneTransition]);

  const handleSelectScene = useCallback((sceneId: string, override?: SceneTransitionOverride) => {
    if (!projectData.scenes[sceneId]) return;
    if (sceneId === activeSceneId) return;
    const fromScene = projectData.scenes[activeSceneId];
    // 元素级进出场动画覆盖：只有显式配置了任一项才生成覆盖，否则跟随场景级转场设置
    const effOverride = override && (override.enterAnim !== undefined || override.exitAnim !== undefined || override.duration !== undefined)
      ? override
      : null;
    // Keep editor, preview, presentation and export navigation on the same
    // transition path. The bounded snapshot fallback below still commits the
    // scene when a heavy or unsupported stage cannot be captured.
    transitionOverrideRef.current = effOverride;
    setSceneTransitionOverride(effOverride);
    if (sceneTransitionRequestRef.current) {
      // The source frame is already being captured. Preserve it and send the
      // latest destination when capture completes, rather than queueing fades.
      pendingSceneRef.current = sceneId;
      pendingOverrideRef.current = effOverride;
      return;
    }
    // 【修复】只有显式 'none' 才无退场；未配置（undefined）默认淡出，保证总有出场动画。
    // 元素「出场动画」优先于当前场景 transitionOut。
    const transOut = effOverride && effOverride.exitAnim !== undefined ? effOverride.exitAnim : fromScene?.transitionOut;
    const hasExitAnim = transOut !== 'none';
    const durMs = (hasExitAnim ? (effOverride?.duration ?? fromScene?.transitionDuration ?? 0.6) : 0) * 1000;
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (durMs <= 0 || reducedMotion) {
      commitSelectScene(sceneId);
      return;
    }
    const requestId = ++nextSceneTransitionRequestRef.current;
    pendingSceneRef.current = sceneId;
    pendingOverrideRef.current = effOverride;
    sceneTransitionRequestRef.current = { id: requestId };
    setSceneExiting(false);
    setSceneTransitionRequest({
      id: requestId,
      targetSceneId: sceneId,
      exitAnimation: transOut || 'fade',
      duration: durMs / 1000,
      easing: fromScene?.transitionEasing || 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    });
    if (sceneExitTimerRef.current) window.clearTimeout(sceneExitTimerRef.current);
    sceneExitTimerRef.current = window.setTimeout(() => {
      // html2canvas can be unavailable for a browser/embedded frame. Navigation
      // remains live after a bounded wait; the incoming stage becomes the fallback.
      finishSceneTransition(requestId);
    }, Math.max(900, durMs + 350));
  }, [projectData.scenes, activeSceneId, commitSelectScene, finishSceneTransition, isEditing, isFullscreenPreview]);

  const handleFocusComment = useCallback((comment: SceneComment) => {
    if (comment.sceneId !== activeSceneId) handleSelectScene(comment.sceneId);
    setFocusedCommentId(comment.id);
    setCommentMode(false);
  }, [activeSceneId, handleSelectScene]);

  // 3D/全景画面内热点触发（演示模式点击热点）：跳转场景 / 打开URL / 媒体弹窗
  // A scaled 1920x1080 stage keeps its unscaled layout dimensions. Browsers can
  // preserve an overflow scroll offset when a scene remounts, clipping the top.
  useLayoutEffect(() => {
    if (isEditing && !isFullscreenPreview) return;
    const workspace = document.querySelector<HTMLElement>('.aether-workspace-scroll');
    if (!workspace) return;
    for (const element of workspace.querySelectorAll<HTMLElement>('*')) {
      if (element.scrollTop) element.scrollTop = 0;
    }
  }, [activeSceneId, isEditing, isFullscreenPreview]);

  const handleHotspotTrigger = useCallback((hotspot: Hotspot) => {
    const interaction = resolveInteraction(hotspot);
    if (interaction.steps && interaction.steps.length > 0) {
      const variableValues = new Map<string, unknown>((projectData.variables || []).map((variable) => [variable.name, variable.value]));
      void runInteractionSteps(interaction.steps, {
        getVariableValue: (name) => variableValues.get(name),
        jump: (target) => {
          if (projectData.scenes[target]) handleSelectScene(target);
        },
        popup: (target) => {
          if (projectData.scenes[target]) setPopupSceneId(target);
        },
        openUrl: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
        setVariable: (name, value) => {
          variableValues.set(name, value);
          handleUpdateProject((prev) => ({
            ...prev,
            variables: applyVariableMutation(prev.variables, {
              trigger: interaction.trigger,
              action: 'set-variable',
              variableName: name,
              variableValue: typeof value === 'boolean' ? String(value) : value,
              hoverDelay: interaction.hoverDelay,
            }),
          }), '更新交互变量', 'general', undefined, false);
        },
        switchVariant: (componentId, variantId) => {
          handleUpdateProject((prev) => switchInstanceVariant(prev, componentId, variantId), '切换组件状态', 'general', undefined, false);
        },
      });
      return;
    }
    if (interaction.action === 'set-variable') {
      handleUpdateProject((prev) => ({
        ...prev,
        variables: applyVariableMutation(prev.variables, interaction),
      }), '更新交互变量', 'general');
      return;
    }
    if (interaction.action === 'url' && isSafeInteractionUrl(interaction.url)) {
      window.open(interaction.url!.trim(), '_blank', 'noopener,noreferrer');
      return;
    }
    if (interaction.action === 'media' && interaction.mediaRefId) {
      setActiveMediaHotspot({
        mediaRefId: interaction.mediaRefId,
        mediaType: interaction.mediaType || 'image',
        label: hotspot.label,
        animationType: hotspot.popupAnimationType || hotspot.animationType,
        animationDuration: hotspot.popupAnimationDuration || hotspot.animationDuration,
        popupPosition: hotspot.popupPosition,
        popupSize: hotspot.popupSize,
        popupX: hotspot.popupX,
        popupY: hotspot.popupY,
        popupWidth: hotspot.popupWidth,
        popupHeight: hotspot.popupHeight,
        popupOverlayOpacity: hotspot.popupOverlayOpacity,
        popupOverlayBlur: hotspot.popupOverlayBlur,
        popupCloseOnOverlay: hotspot.popupCloseOnOverlay,
        popupDisplay: hotspot.popupDisplay,
        popupRatio: hotspot.popupRatio,
        popupRatioW: hotspot.popupRatioW,
        popupRatioH: hotspot.popupRatioH,
        popupTheme: hotspot.popupTheme,
        popupBgColor: hotspot.popupBgColor,
        popupBorderColor: hotspot.popupBorderColor,
        popupGlowColor: hotspot.popupGlowColor,
        popupTitle: hotspot.popupTitle,
        popupTitleColor: hotspot.popupTitleColor,
        popupAccentColor: hotspot.popupAccentColor,
        popupRadius: hotspot.popupRadius,
      });
      return;
    }
    // jump：直接跳转目标场景
    if (interaction.action === 'jump' && interaction.target && projectData.scenes[interaction.target]) {
      handleSelectScene(interaction.target);
      return;
    }
    // popup：弹出场景预览弹窗，用户可选择"进入场景"或"关闭返回"
    if (interaction.action === 'popup' && interaction.target && projectData.scenes[interaction.target]) {
      setPopupSceneConfig({
        popupPosition: hotspot.popupPosition,
        popupSize: hotspot.popupSize,
        popupX: hotspot.popupX,
        popupY: hotspot.popupY,
        popupWidth: hotspot.popupWidth,
        popupHeight: hotspot.popupHeight,
        popupOverlayOpacity: hotspot.popupOverlayOpacity,
        popupOverlayBlur: hotspot.popupOverlayBlur,
        popupCloseOnOverlay: hotspot.popupCloseOnOverlay,
        popupAnimationType: hotspot.popupAnimationType || hotspot.animationType,
        popupAnimationDuration: hotspot.popupAnimationDuration || hotspot.animationDuration,
        popupDisplay: hotspot.popupDisplay,
        popupRatio: hotspot.popupRatio,
        popupRatioW: hotspot.popupRatioW,
        popupRatioH: hotspot.popupRatioH,
        popupTheme: hotspot.popupTheme,
        popupRadius: hotspot.popupRadius,
        popupBgColor: hotspot.popupBgColor,
        popupBorderColor: hotspot.popupBorderColor,
        popupGlowColor: hotspot.popupGlowColor,
        popupTitle: hotspot.popupTitle,
        popupTitleColor: hotspot.popupTitleColor,
      });
      setPopupSceneId(interaction.target);
      return;
    }
  }, [handleSelectScene, projectData.scenes, handleUpdateProject]);

  // 场景预览弹窗：获取目标场景的预览信息（标题、预览图、背景色）
  const popupScene = popupSceneId ? projectData.scenes[popupSceneId] : null;
  const getScenePreview = (scene: typeof projectData.scenes[string]) => {
    const title = scene.alias || scene.id || '未命名场景';
    // 优先找全景图/图片元素作为预览图
    // 场景级背景只使用 bgRef；图层资源由 renderPopupSceneElements 统一合成。
    const previewUrl = isTransparentSceneBackground(scene) ? '' : scene.bgRef || '';
    const previewType = 'image';
    const bgColor = isTransparentSceneBackground(scene) ? 'transparent' : scene.bgColor || '#1a1a2e';
    return { title, previewUrl, previewType, bgColor };
  };
  const popupPreview = popupScene ? getScenePreview(popupScene) : null;
  const [popupSceneAssetUrls, setPopupSceneAssetUrls] = useState<Record<string, string>>({});

  // 场景预览中的 refId 通常是 IndexedDB key，不能直接交给 img/video，否则会显示“暂无预览图”。
  useEffect(() => {
    let cancelled = false;
    if (!popupScene) {
      setPopupSceneAssetUrls({});
      return;
    }
    const refs = Array.from(new Set([
      popupScene.bgRef,
      ...(popupScene.els || []).map((el) => el.refId),
    ].filter((ref): ref is string => Boolean(ref))));
    if (refs.length === 0) {
      setPopupSceneAssetUrls({});
      return;
    }
    (async () => {
      await dbManager.ensureReady();
      const entries = await Promise.all(refs.map(async (ref) => {
        const direct = /^(data:|blob:|https?:\/\/)/i.test(ref);
        const url = await loadRuntimeAssetUrl(ref);
        return url && (url !== ref || direct) ? [ref, url] as const : null;
      }));
      if (!cancelled) setPopupSceneAssetUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
    })();
    return () => { cancelled = true; };
  }, [popupScene?.id, popupScene?.bgRef, popupScene?.els]);

  const resolvePopupSceneAsset = (refId?: string) => {
    if (!refId) return '';
    return popupSceneAssetUrls[refId] || resolveExportPlayerAssetUrl(refId) || (/^(data:|blob:|https?:\/\/)/i.test(refId) ? refId : '');
  };

  const renderPopupSceneElements = (scene: Scene) => (scene.els || []).map((popEl) => {
    const src = resolvePopupSceneAsset(popEl.refId);
    return (
      <div
        key={popEl.id}
        className="absolute flex items-center justify-center overflow-hidden"
        style={{
          left: `${popEl.x}%`,
          top: `${popEl.y}%`,
          width: `${popEl.w}%`,
          height: `${popEl.h}%`,
          zIndex: popEl.zIndex ?? 0,
          opacity: (popEl.opacity ?? 100) / 100,
          transform: `rotate(${popEl.rot || 0}deg)`,
          color: popEl.color || '#fff',
          fontSize: `${Math.max(10, (popEl.fontSize || 18) * 0.45)}px`,
          fontWeight: popEl.fontWeight || '600',
          textAlign: popEl.textAlign || 'center',
          whiteSpace: 'pre-wrap',
        }}
      >
        {popEl.type === 'shape' && (
          <div className="absolute inset-0 flex items-center justify-center px-2" style={{
            background: getShapeBackground(popEl),
            borderRadius: `${popEl.borderRadius || 0}px`,
            border: popEl.borderWidth ? `${popEl.borderWidth}px solid ${popEl.borderColor || '#fff'}` : undefined,
            boxShadow: popEl.boxShadow,
          }}>
            {popEl.content || ''}
          </div>
        )}
        {popEl.type === 'txt' && <span className="relative w-full px-1">{popEl.content || ''}</span>}
        {(popEl.type === 'img' || popEl.type === 'panorama-img') && src && <img src={src} alt="" className="w-full h-full object-contain" />}
        {(popEl.type === 'vid' || popEl.type === 'panorama-vid') && src && <video src={src} autoPlay muted loop playsInline className="w-full h-full object-contain" />}
        {(popEl.type === 'model-3d' || popEl.type === 'gaussian-splat') && (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.22),transparent_68%)]">
            <span className="text-xs font-medium tracking-widest text-cyan-200/80">3D MODEL</span>
          </div>
        )}
      </div>
    );
  });

  // 热点媒体弹窗：加载媒体 URL
  useEffect(() => {
    if (!activeMediaHotspot) {
      setMediaUrl('');
      return;
    }
    let cancelled = false;
    (async () => {
      const url = await loadRuntimeAssetUrl(activeMediaHotspot.mediaRefId);
      if (!cancelled) setMediaUrl(url || '');
    })();
    return () => { cancelled = true; };
  }, [activeMediaHotspot]);

  // Playback Loop (RAF)
  useEffect(() => {
    let animId: number;

    if (isPlaying) {
      // Anchor the editor clock to wall time. Accumulating a clamped RAF delta
      // loses real playback time whenever React or media setup blocks a frame.
      playStartWallTimeRef.current = performance.now();
      playStartTimelineTimeRef.current = playbackTimeRef.current;
    }

    const loop = (timestamp: number) => {
      if (isPlaying && activeScene) {
        let nextTime = playStartTimelineTimeRef.current
          + Math.max(0, timestamp - playStartWallTimeRef.current) / 1000;
          // 播放时长 = 场景时长 与 所有图层结束时间的最大值，确保指针能覆盖每个图层的完整时间范围
          // 入点/出点：定义播放循环范围（未设置入点=0、出点=场景时长）。出点<=入点视为非法回退到场景时长
          const inT = playbackRange.inPoint;
          const outT = playbackRange.outPoint;

          // 指针落在入点之前（如场景切换/停止后从 0 起播）→ 直接跳到入点
          if (nextTime < inT) nextTime = inT;

          if (nextTime >= outT) {
            if (isCruising) {
              // 巡航只在「画布场景」序列中循环，弹窗/UI 场景不参与自动轮播
              const loopKeys = getLoopableSceneKeys(projectData.scenes);
              if (loopKeys.length > 0) {
                const idx = loopKeys.indexOf(activeSceneId); // popup scene fallback
                const nextIdx = (idx + 1) % loopKeys.length;
                handleSelectScene(loopKeys[nextIdx]);
              }
              nextTime = inT;
              playStartWallTimeRef.current = timestamp;
              playStartTimelineTimeRef.current = inT;
            } else {
              // Loop within [in, out] seamlessly while preserving elapsed time
              // if a busy frame crossed the loop boundary.
              const span = Math.max(0.001, outT - inT);
              nextTime = inT + ((((nextTime - inT) % span) + span) % span);
              playStartWallTimeRef.current = timestamp;
              playStartTimelineTimeRef.current = nextTime;
              if (bgmAudioRef.current) {
                bgmAudioRef.current.currentTime = nextTime;
              }
            }
          }
        playbackTimeRef.current = nextTime;
        // Publish every RAF. Each subscriber keeps its own budget: the
        // playhead stays fluid while a heavy canvas yields to video compositing.
        setPlaybackClockTime(nextTime);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, activeScene, activeSceneId, isCruising, playbackRange, projectData.scenes, handleSelectScene]);

  // 自动轮播：全局开关开启后，每个场景停留 autoAdvanceDelay（回退 cruiseDuration/duration）秒自动切到下一场景。
  // 不依赖手动播放，适合展厅无人值守。仅在预览/非编辑模式生效，避免干扰编辑。
  useEffect(() => {
    if (!autoAdvance || isEditing || !activeScene) return;
    const hold = activeScene.autoAdvanceDelay || activeScene.cruiseDuration || activeScene.duration || 10;
    const timer = setTimeout(() => {
      // 自动轮播只在「画布场景」序列中循环，弹窗/UI 场景不参与
      const loopKeys = getLoopableSceneKeys(projectData.scenes);
      if (loopKeys.length <= 1) return;
      const idx = loopKeys.indexOf(activeSceneId); // -1（当前为弹窗场景）→ 从第一个画布场景开始
      const nextIdx = (idx + 1) % loopKeys.length;
      handleSelectScene(loopKeys[nextIdx]);
    }, Math.max(0.5, hold) * 1000);
    return () => clearTimeout(timer);
  }, [autoAdvance, isEditing, activeScene, activeSceneId, projectData.scenes, handleSelectScene]);

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;
    const bgmRef = activeScene?.bgmRef;
    let cancelled = false;

    if (!bgmRef) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    void loadRuntimeAssetUrl(bgmRef).then((url) => {
      if (cancelled || !url || !bgmAudioRef.current) return;
      const currentAudio = bgmAudioRef.current;
      if (currentAudio.src !== url) {
        currentAudio.src = url;
        currentAudio.currentTime = Math.min(playbackTimeRef.current, Number.isFinite(currentAudio.duration) ? currentAudio.duration : playbackTimeRef.current);
      }
      if (isPlaying) void currentAudio.play().catch(() => {});
    });

    return () => { cancelled = true; };
  }, [activeScene?.bgmRef, isPlaying]);

  // Transport Handlers
  const handleTogglePlay = useCallback(() => {
    const next = !isPlaying;
    if (next) {
      playStartWallTimeRef.current = performance.now();
      playStartTimelineTimeRef.current = playbackTimeRef.current;
    } else {
      // Commit the live clock before React falls back to the throttled shell
      // state, preventing a visible backwards jump on pause.
      const pausedTime = playbackTimeRef.current;
      setCurrentTime(pausedTime);
      setPlaybackClockTime(pausedTime);
    }
    if (bgmAudioRef.current && activeScene?.bgmRef) {
      if (next) {
        // Sync once when playback starts. Re-seeking a paused audio element on
        // every timeline mousemove forces decoder work and makes scrubbing lag.
        bgmAudioRef.current.currentTime = playbackTimeRef.current;
        bgmAudioRef.current.play().catch(() => {});
      }
      else bgmAudioRef.current.pause();
    }
    setIsPlaying(next);
  }, [activeScene?.bgmRef, isPlaying]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    playbackTimeRef.current = 0;
    playStartWallTimeRef.current = performance.now();
    playStartTimelineTimeRef.current = 0;
    setPlaybackClockTime(0);
    setCurrentTime(0);
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
    }
  }, []);

  const handleSeek = useCallback((t: number) => {
    playbackTimeRef.current = t;
    playStartWallTimeRef.current = performance.now();
    playStartTimelineTimeRef.current = t;
    setPlaybackClockTime(t);
    setCurrentTime(t);
    // While editing, the audio element is paused. Avoid issuing a media seek
    // for every scrub sample; playback start performs the authoritative sync.
    if (bgmAudioRef.current && !bgmAudioRef.current.paused) {
      bgmAudioRef.current.currentTime = t;
    }
  }, []);

  // Add Element Handlers
  const handleAddElement = (type: 'txt' | 'img' | 'vid' | 'shape' | 'saber' | 'chart' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat') => {
    if (type === 'img') {
      imageInputRef.current?.click();
      return;
    }
    if (type === 'vid') {
      videoInputRef.current?.click();
      return;
    }
    if (type === 'panorama-img') {
      panoramaImgInputRef.current?.click();
      return;
    }
    if (type === 'panorama-vid') {
      panoramaVidInputRef.current?.click();
      return;
    }
    if (type === 'model-3d') {
      model3dInputRef.current?.click();
      return;
    }
    if (type === 'gaussian-splat') {
      splatInputRef.current?.click();
      return;
    }
    if (type === 'saber') {
      // Quick insert default Laser Saber
      const defaultShape = SABER_SHAPE_PRESETS[0];
      handleSelectSaberPreset(defaultShape);
      return;
    }

    // 添加元素时暂停播放，确保新元素在当前指针范围内立即可见、可拖拽缩放
    if (isPlaying) setIsPlaying(false);

    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = 5;
    const sceneDur = Math.max(activeScene?.duration || 10, startT + dur);
    const theme = normalizeTheme(projectData.theme);

    const defaultText = 'NEW TEXT';
    const defaultFontSize = theme.typography.baseSize;
    const defaultTextPadding = 6;
    const canvasSpec = getProjectCanvas(projectData);
    const canvasW = canvasSpec.width || 1920;
    const canvasH = canvasSpec.height || 1080;
    const textDims = type === 'txt'
      ? measureSnugTextDimensions(defaultText, {
          fontSize: defaultFontSize,
          textPadding: defaultTextPadding,
          lineHeight: 1.25,
          canvasWidth: canvasW,
          canvasHeight: canvasH,
        })
      : null;

    const elW = textDims ? textDims.w : type === 'chart' ? 32 : 25;
    const elH = textDims ? textDims.h : type === 'chart' ? 22 : 20;
    const elX = textDims ? Math.round((50 - elW / 2) * 10) / 10 : 35;
    const elY = textDims ? Math.round((50 - elH / 2) * 10) / 10 : 35;

    const newEl: SceneElement = {
      id,
      type,
      refId: '',
      sourceName: type === 'txt' ? '文字图层' : type === 'chart' ? '数据可视化' : '矩形卡片',
      x: elX,
      y: elY,
      w: elW,
      h: elH,
      zIndex: getNextTopLayerZIndex(activeScene?.els || []),
      opacity: 100,
      blendMode: 'normal',
      content: type === 'txt' ? defaultText : type === 'chart' ? 'CHART' : 'CARD TITLE\n双击编辑卡片内容',
      color: type === 'txt' ? theme.colors.text : undefined,
      textColor: theme.colors.text,
      backgroundType: type === 'shape' ? 'gradient' : 'solid',
      gradientType: 'linear',
      gradientAngle: 135,
      gradientStart: theme.colors.primary,
      gradientVia: theme.colors.accent,
      gradientEnd: theme.colors.surface,
      backgroundColor: theme.colors.surface,
      // 画布常以较小缩放比例显示，15px 会让新建卡片文字不可读。
      fontSize: type === 'txt' ? theme.typography.baseSize : type === 'shape' ? theme.typography.headingSize : 18,
      lineHeight: type === 'txt' ? 1.25 : undefined,
      textPadding: type === 'txt' ? defaultTextPadding : undefined,
      fontWeight: type === 'shape' ? '700' : undefined,
      fontFamily: type === 'txt' || type === 'shape' ? theme.typography.fontFamily : undefined,
      borderRadius: type === 'shape' ? theme.radius : 0,
      borderWidth: type === 'shape' ? 1 : 0,
      borderColor: theme.colors.border,
      boxShadow: type === 'shape' ? theme.shadow : 'none',
      backdropBlur: 0,
      shapePadding: 14,
      // 图表组件默认配置
      chartKind: type === 'chart' ? 'bar' : undefined,
      chartData: type === 'chart' ? [
        { label: '华东', value: 8600 },
        { label: '华南', value: 5400 },
        { label: '华北', value: 7200 },
        { label: '西南', value: 4100 },
      ] : undefined,
      startTime: startT,
      duration: dur,
      animType: 'zoom-in',
      animDur: 0.5,
      exitAnimType: 'fade-out',
      exitAnimDur: 0.4,
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };

    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    pushHistoryItem(type === 'txt' ? '添加文字图层' : '添加矩形/交互卡片', {
      details: type === 'txt' ? '内容: NEW TEXT' : '新建交互卡片',
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  };

  const handleToggleEditing = useCallback(() => {
    if (IS_EXPORT_PLAYER) return;
    setIsEditing((previous) => !previous);
  }, []);

  const handleToggleCruise = useCallback(() => {
    setIsCruising((previous) => !previous);
  }, []);

  const handleToggleAutoAdvance = useCallback(() => {
    setAutoAdvance((previous) => !previous);
  }, []);

  const handleToggleMotion = useCallback(() => {
    const nextEnabled = !projectData.motionInput?.enabled;
    handleUpdateProject((previous) => ({
      ...previous,
      motionInput: { ...previous.motionInput, enabled: nextEnabled, sensitivity: previous.motionInput?.sensitivity ?? 1 },
    }), nextEnabled ? '开启体感交互' : '关闭体感交互', 'scene_update');
  }, [handleUpdateProject, projectData.motionInput?.enabled]);

  const handleTogglePanelsCollapsed = useCallback(() => {
    setPanelsCollapsed((previous) => {
      const next = !previous;
      setIsTimelineCollapsed(next);
      return next;
    });
  }, []);

  const openWorkTool = useCallback((mode: WorkToolMode) => {
    setWorkToolMode(mode);
    setIsAiSceneBuilderOpen(true);
    // Close legacy standalone states before mounting the embedded tool panel.
    setIsAiModel3DModalOpen(false);
    setIsAiBackgroundRemovalOpen(false);
    setIsCustomCodePluginOpen(false);
  }, []);

  const handleOpenCustomCodePlugin = useCallback((elementId?: string) => {
    setCustomCodeEditElementId(elementId || null);
    openWorkTool('custom-code');
  }, [openWorkTool]);

  const handleExportCustomCodePlugin = useCallback((plugin: CustomCodePlugin) => {
    const storageTarget = { category: 'ai' as const, slot: 'custom-code' as const };
    const nextPlugin = { ...plugin, exportTarget: storageTarget, updatedAt: new Date().toISOString() };
    const nextLibrary = upsertCustomCodeLibraryItem(customCodeLibrary, nextPlugin, storageTarget);
    setCustomCodeLibrary(nextLibrary);
    saveCustomCodeLibrary(nextLibrary).catch((error) => {
      console.warn('[aether] 自定义代码组件库保存失败', error);
      showToast('自定义代码已导出，但本地持久化失败', 'warning');
    });

    if (customCodeEditElementId) {
      handleUpdateElement(customCodeEditElementId, {
        customCode: { ...nextPlugin, version: (activeScene?.els.find((element) => element.id === customCodeEditElementId)?.customCode?.version || 0) + 1 },
        sourceName: nextPlugin.name,
        mediaAspect: getCustomCodeAspectRatio(plugin),
        // Custom-code layers use freeform resizing like native UI layers.
        // The authored/visible ratio is metadata only and must not lock handles.
        lockAspectRatio: false,
        // Updating a plugin invalidates its previous visible footprint. The
        // next mount must measure the rendered content again, even when the
        // plugin declares an authored preview ratio.
        customCodeAutoFitted: false,
      }, '更新自定义代码插件');
      setSelectedElementId(customCodeEditElementId);
      setMultiSelectedIds([customCodeEditElementId]);
      setIsCustomCodePluginOpen(false);
      setCustomCodeEditElementId(null);
      showToast(`已导出并更新「${nextPlugin.name}」`);
      return;
    }

    setIsCustomCodePluginOpen(false);
    handleInsertCustomCodePlugin(nextPlugin);
    showToast('插件已保存到本地插件库并插入当前时间线');
    return;
  }, [activeScene, customCodeEditElementId, customCodeLibrary, handleUpdateElement, showToast]);

  const handleCreateCustomCodeCategory = useCallback((label: string) => {
    const created = createCustomCodeCategory(label, customCodeCategories);
    if (!created) {
      showToast('请输入有效的栏目名称', 'warning');
      return null;
    }
    const nextCategories = [...customCodeCategories, created];
    setCustomCodeCategories(nextCategories);
    saveCustomCodeCategories(nextCategories).catch(() => showToast('栏目已创建，但持久化保存失败', 'warning'));
    showToast(`已创建栏目“${created.label}”，已自动分配图标`);
    return created;
  }, [customCodeCategories, showToast]);

  const handleInsertCustomCodePlugin = useCallback((plugin: CustomCodePlugin) => {
    if (!plugin.html?.trim()) {
      showToast('该自定义组件缺少 HTML 内容，请先在代码插件中补全并重新导出', 'warning');
      return;
    }
    if (customCodeEditElementId) {
      handleUpdateElement(customCodeEditElementId, {
        customCode: { ...plugin, version: (activeScene?.els.find((element) => element.id === customCodeEditElementId)?.customCode?.version || 0) + 1, updatedAt: new Date().toISOString() },
        sourceName: plugin.name,
        // A revised plugin can have different intrinsic bounds. Let CanvasViewport fit it once again.
        mediaAspect: undefined,
        lockAspectRatio: false,
        customCodeAutoFitted: false,
      }, '更新自定义代码插件');
      setSelectedElementId(customCodeEditElementId);
      setMultiSelectedIds([customCodeEditElementId]);
      setIsCustomCodePluginOpen(false);
      setCustomCodeEditElementId(null);
      showToast('自定义代码插件已更新');
      return;
    }
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = `custom_code_${Date.now()}`;
    const startT = getPlayheadInsertTime(currentTime);
    const duration = 5;
    const declaredCustomCodeAspect = getCustomCodeDeclaredAspectRatio(plugin);
    const customCodeAspect = declaredCustomCodeAspect || getCustomCodeAspectRatio(plugin);
    const canvas = getProjectCanvas(projectData);
    const initialWidth = 32;
    const initialHeight = Math.max(2, Math.round((initialWidth * canvas.width / (customCodeAspect * canvas.height)) * 10) / 10);
    const newElement: SceneElement = {
      id,
      type: 'custom-code',
      refId: '',
      sourceName: plugin.name,
      customCode: plugin,
      x: 34,
      y: 32,
      w: initialWidth,
      h: initialHeight,
      // The declared ratio is only an initial placement hint. All custom-code
      // layers remain freely resizable after insertion, including authored SVG
      // and preview ratios.
      mediaAspect: declaredCustomCodeAspect,
      lockAspectRatio: false,
      // A declared ratio is only an initial canvas hint. It does not prove
      // that the rendered content fills that rectangle, so the canvas must
      // still fit the first measured visible bounds.
      customCodeAutoFitted: false,
      zIndex: getNextTopLayerZIndex(activeScene.els || []),
      opacity: 100,
      blendMode: 'normal',
      startTime: startT,
      duration,
      animType: 'fade-in',
      animDur: 0.35,
      exitAnimType: 'fade-out',
      exitAnimDur: 0.25,
    };
    const nextProject: ProjectData = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: Math.max(activeScene.duration || 10, startT + duration),
          els: [...activeScene.els, newElement],
        },
      },
    };
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsCustomCodePluginOpen(false);
    pushHistoryItem('加入自定义代码插件', { actionType: 'element_new', details: plugin.name, overrideSnapshot: nextProject });
  }, [activeScene, activeSceneId, currentTime, customCodeEditElementId, handleUpdateElement, isPlaying, projectData, pushHistoryItem, showToast]);

  const handleInsertCustomCodeLibrary = useCallback((plugin: CustomCodePlugin) => {
    handleInsertCustomCodePlugin({
      ...plugin,
      id: `custom-code-${Date.now()}`,
      version: 1,
      updatedAt: new Date().toISOString(),
    });
  }, [handleInsertCustomCodePlugin]);

  const handleDeleteCustomCodeLibrary = useCallback((itemId: string) => {
    const nextLibrary = customCodeLibrary.filter((item) => item.id !== itemId);
    setCustomCodeLibrary(nextLibrary);
    saveCustomCodeLibrary(nextLibrary).catch((error) => console.warn('[aether] 自定义代码组件删除失败', error));
  }, [customCodeLibrary]);

  // Add Saber Preset Light Effect from Modal
  const handleSelectSaberPreset = useCallback((
    shape: SaberShapePreset,
    theme?: SaberStyleTheme,
    effectType?: SaberEffectType,
    growthMode?: 'grow-in' | 'cycle-flow' | 'pulse-grow' | 'meteor-shoot' | 'none'
  ) => {
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    const w = 40;
    const h = 30;
    const x = Math.max(5, Math.round((100 - w) / 2));
    const y = Math.max(5, Math.round((100 - h) / 2));
    const activeTheme = theme || SABER_STYLE_THEMES[0];
    const coreColor = activeTheme.coreColor || '#fffff5';
    const glowColor = activeTheme.glowColor || '#f3ca7e';
    const secGlowColor = activeTheme.secondaryGlowColor || '#925216';
    const coreWidth = shape.defaultCoreWidth || activeTheme.coreWidth || 3.5;
    const glowSpread = shape.defaultGlowSpread || activeTheme.glowSpread || 18;
    const blendMode = (activeTheme.blendMode || 'screen') as BlendMode;
    const flickerIntensity = activeTheme.flickerIntensity !== undefined ? activeTheme.flickerIntensity : 4;

    const newEl: SceneElement = {
      id,
      type: 'saber',
      refId: '',
      sourceName: `Saber: ${shape.name}`,
      x,
      y,
      w,
      h,
      zIndex: getNextTopLayerZIndex(activeScene.els),
      opacity: 100,
      blendMode,
      startTime: startT,
      duration: dur,
      saberEffectType: effectType || 'standard',
      saberPreset: activeTheme.id,
      saberShapeName: shape.name,
      saberPath: shape.path,
      saberPathType: 'preset',
      saberCoreColor: coreColor,
      saberGlowColor: glowColor,
      saberSecondaryGlowColor: secGlowColor,
      saberCoreWidth: coreWidth,
      saberGlowSpread: glowSpread,
      saberGlowIntensity: activeTheme.glowIntensity || 1.4,
      saberStartOffset: 0,
      saberEndOffset: 100,
      saberGrowthMode: growthMode || shape.defaultGrowthMode || 'grow-in',
      saberGrowthSpeed: 1.0,
      saberFlickerIntensity: flickerIntensity,
      animType: 'none',
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };

    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    showToast(`⚡ 已插入 Saber 光效: 「${shape.name}」(${activeTheme.name})`);
    pushHistoryItem(`插入 Saber 光效: ${shape.name}`, {
      details: `风格: ${activeTheme.name} · 色彩: ${glowColor}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  }, [activeScene, activeSceneId, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  // Add VFX Tech Motion Preset from Modal（科技简约动效库，拖入即用，持续播放 + 鼠标交互）
  const handleSelectVfxPreset = useCallback((
    motion: VfxMotionMeta,
    colorA: string,
    colorB: string,
    speed: number,
    customParams?: Record<string, number | string>
  ) => {
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    // 动效元素默认正方形（1:1），贴近"动效贴纸"直觉
    const w = 40;
    const h = 40;
    const x = Math.max(5, Math.round((100 - w) / 2));
    const y = Math.max(5, Math.round((100 - h) / 2));
    const initialCards = isCardLayoutMotion(motion.id) ? createDefaultVfxCards() : undefined;

    const newEl: SceneElement = {
      id,
      type: 'vfx',
      refId: '',
      sourceName: `动效: ${motion.name}`,
      x,
      y,
      w,
      h,
      zIndex: getNextTopLayerZIndex(activeScene.els),
      opacity: 100,
      blendMode: 'normal' as BlendMode,
      startTime: startT,
      duration: dur,
      vfxMotionType: motion.id,
      vfxColorA: colorA,
      vfxColorB: colorB,
      vfxSpeed: speed,
      vfxParams: customParams || (motion.params && motion.params.length
        ? motion.params.reduce((acc, p) => { acc[p.key] = p.def; return acc; }, {} as Record<string, number | string>)
        : undefined),
      vfxCards: initialCards,
      animType: 'none',
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };

    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    showToast(`✨ 已插入科技动效: 「${motion.name}」`);
    pushHistoryItem(`插入科技动效: ${motion.name}`, {
      details: `风格: ${motion.category} · 主色: ${colorA}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  }, [activeScene, activeSceneId, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  // Add Bezier Pen Drawn Saber Light Effect
  const handleAddDrawnSaberElement = useCallback((
    path: string,
    bbox: { x: number; y: number; w: number; h: number },
    nodes?: BezierNode[],
    shapeName?: string
  ) => {
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    const activeTheme = SABER_STYLE_THEMES[0];

    const newEl: SceneElement = {
      id,
      type: 'saber',
      refId: '',
      sourceName: shapeName || '钢笔矢量光线',
      x: bbox.x,
      y: bbox.y,
      w: bbox.w,
      h: bbox.h,
      zIndex: getNextTopLayerZIndex(activeScene.els),
      opacity: 100,
      blendMode: 'screen',
      startTime: startT,
      duration: dur,
      saberEffectType: 'standard',
      saberPreset: activeTheme.id,
      saberShapeName: shapeName || '钢笔自定义路径',
      saberPath: path,
      saberPathType: 'pen',
      saberNodes: nodes,
      saberCoreColor: activeTheme.coreColor,
      saberGlowColor: activeTheme.glowColor,
      saberSecondaryGlowColor: activeTheme.secondaryGlowColor,
      saberCoreWidth: activeTheme.coreWidth,
      saberGlowSpread: activeTheme.glowSpread,
      saberGlowIntensity: activeTheme.glowIntensity,
      saberStartOffset: 0,
      saberEndOffset: 100,
      saberGrowthMode: 'grow-in',
      saberGrowthSpeed: 1.0,
      saberFlickerIntensity: activeTheme.flickerIntensity,
      animType: 'none',
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };

    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    showToast(`🖊️ 钢笔光线创建成功，已切换至选择工具`);
    pushHistoryItem(`创建钢笔光线: ${shapeName || '自定义'}`, {
      details: `路径锚点数: ${nodes?.length || 0}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  }, [activeScene, activeSceneId, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  // Add a closed Bezier path as a normal filled shape so it remains editable.
  const handleAddDrawnShapeElement = useCallback((
    path: string,
    bbox: { x: number; y: number; w: number; h: number },
    nodes?: BezierNode[],
  ) => {
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);
    const newEl: SceneElement = {
      id,
      type: 'shape',
      refId: '',
      sourceName: '钢笔自定义形状',
      shapeKind: 'custom-path',
      shapePath: path,
      x: Math.max(0, Math.min(100, bbox.x)),
      y: Math.max(0, Math.min(100, bbox.y)),
      w: Math.max(0.1, Math.min(bbox.w, 100 - Math.max(0, bbox.x))),
      h: Math.max(0.1, Math.min(bbox.h, 100 - Math.max(0, bbox.y))),
      zIndex: getNextTopLayerZIndex(activeScene.els),
      opacity: 100,
      blendMode: 'normal',
      content: '',
      textColor: '#ffffff',
      backgroundType: 'gradient',
      gradientType: 'linear',
      gradientAngle: 135,
      gradientStart: '#22d3ee',
      gradientVia: '#3b82f6',
      gradientEnd: '#a855f7',
      borderWidth: 1,
      borderColor: 'rgba(186, 230, 253, 0.78)',
      boxShadow: '0 10px 24px rgba(14, 165, 233, 0.18)',
      backdropBlur: 0,
      shapePadding: 14,
      saberNodes: nodes,
      startTime: startT,
      duration: dur,
      animType: 'zoom-in',
      animDur: 0.35,
      exitAnimType: 'fade-out',
      exitAnimDur: 0.3,
    };
    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    showToast('已创建钢笔自定义形状');
    pushHistoryItem('创建钢笔自定义形状', {
      details: `路径锚点数: ${nodes?.length || 0}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  }, [activeScene, activeSceneId, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  const handleAddDrawnInteractionArea = useCallback((
    path: string,
    bbox: { x: number; y: number; w: number; h: number },
    nodes?: BezierNode[],
  ) => {
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = Math.max(0.1, (activeScene.duration || 10) - startT);
    const newEl: SceneElement = {
      id,
      type: 'shape',
      refId: '',
      sourceName: '交互区域',
      interactionArea: true,
      shapeKind: 'custom-path',
      shapePath: path,
      saberNodes: nodes,
      x: bbox.x,
      y: bbox.y,
      w: bbox.w,
      h: bbox.h,
      zIndex: getNextTopLayerZIndex(activeScene.els),
      opacity: 100,
      blendMode: 'normal',
      content: '',
      borderWidth: 0,
      backgroundType: 'solid',
      backgroundColor: 'transparent',
      startTime: startT,
      duration: dur,
      interaction: { trigger: 'click', action: 'jump' },
    };
    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: { ...activeScene, els: [...activeScene.els, newEl] },
      },
    };
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    showToast('已创建交互区域，请在右侧选择目标场景');
    pushHistoryItem('创建交互区域', {
      details: `边界点：${nodes?.length || 0}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  }, [activeScene, activeSceneId, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  // Add Preset Geometric Shape from Library
  const handleSelectShapePreset = useCallback((
    preset: ShapePresetItem,
    colorTheme?: ColorThemeId
  ) => {
    if (!activeScene) return;
    if (isPlaying) setIsPlaying(false);
    const id = 'el_' + Date.now();

    let bgType: 'solid' | 'gradient' | 'glass' = preset.defaultBackgroundType || 'gradient';
    let gStart = preset.defaultGradientStart || '#06b6d4';
    let gVia = preset.defaultGradientVia || '#3b82f6';
    let gEnd = preset.defaultGradientEnd || '#9333ea';
    let gAngle = preset.defaultGradientAngle ?? 135;
    let bgColor = preset.defaultBackgroundColor || 'rgba(30, 41, 59, 0.85)';
    let txtColor = preset.textColor || '#ffffff';
    let bColor = preset.defaultBorderColor || 'rgba(255, 255, 255, 0.25)';
    let bWidth = preset.defaultBorderWidth !== undefined ? preset.defaultBorderWidth : 1;
    let bBlur = bgType === 'glass' ? 16 : 0;

    const selectedTheme = getColorThemePreset(colorTheme);
    if (selectedTheme) {
      bgType = 'gradient';
      bBlur = 0;
      gStart = selectedTheme.colorA;
      gVia = undefined;
      gEnd = selectedTheme.colorB;
      txtColor = getColorThemeTextColor(selectedTheme.id);
      bColor = getColorThemeBorderColor(selectedTheme.id);
    }

    const startT = getPlayheadInsertTime(currentTime);
    const dur = 5;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    const newEl: SceneElement = {
      id,
      type: 'shape',
      refId: '',
      sourceName: preset.name,
      shapeKind: preset.shapeKind,
      clipPath: preset.clipPath,
      x: 35,
      y: 35,
      w: preset.defaultW || 28,
      h: preset.defaultH || 18,
      zIndex: getNextTopLayerZIndex(activeScene.els),
      opacity: 100,
      blendMode: 'normal',
      content: preset.defaultContent || `${preset.name.toUpperCase()}\n双击编辑文本内容`,
      color: txtColor,
      textColor: txtColor,
      backgroundType: bgType,
      gradientType: 'linear',
      gradientAngle: gAngle,
      gradientStart: gStart,
      gradientVia: gVia,
      gradientEnd: gEnd,
      backgroundColor: bgColor,
      // 预设卡片保持与基础卡片一致的可读性，同时给低矮按钮形状留下安全空间。
      fontSize: 28,
      fontWeight: '700',
      borderRadius: preset.borderRadius !== undefined ? preset.borderRadius : 14,
      borderWidth: bWidth,
      borderColor: bColor,
      boxShadow: preset.defaultBoxShadow || '0 12px 30px rgba(0, 0, 0, 0.4)',
      backdropBlur: bBlur,
      shapePadding: 14,
      startTime: startT,
      duration: dur,
      animType: 'zoom-in',
      animDur: 0.5,
      exitAnimType: 'fade-out',
      exitAnimDur: 0.4,
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };

    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    showToast(`✨ 已插入基础形状: 「${preset.name}」`);
    pushHistoryItem(`插入形状: ${preset.name}`, {
      details: `类型: ${preset.shapeKind}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  }, [activeScene, activeSceneId, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  // 统一登记素材：写入二进制、保存原始文件信息并刷新素材面板。
  // 浏览器通常不会暴露绝对路径；在 Electron/桌面壳提供 file.path 时才记录可定位目录。
  const persistImportedAsset = useCallback(async (key: string, data: Blob, file: File, source: 'local-file' | 'generated' = 'local-file', kind?: ReturnType<typeof detectDroppedFileType>, refreshPanel = true) => {
    await dbManager.ensureReady();
    await dbManager.put(key, data);
    const rawPath = String((file as File & { path?: string }).path || '');
    const sourceFolder = rawPath
      ? rawPath.replace(/[\\/][^\\/]*$/, '')
      : undefined;
    await dbManager.setMetadata({
      key,
      name: file.name || key,
      size: data.size,
      originalName: file.name || key,
      kind: kind || detectDroppedFileType(file),
      sourcePath: rawPath || undefined,
      sourceFolder,
      importedAt: Date.now(),
      source,
    });
    if (refreshPanel) setAssetRefreshTrigger((t) => t + 1);
  }, []);

  const handleInsertBackgroundRemovedAsset = useCallback(async (blob: Blob, fileName: string) => {
    const baseProject = projectDataRef.current;
    const scene = baseProject.scenes[activeSceneId];
    if (!scene) throw new Error('当前场景不存在');
    if (isPlaying) setIsPlaying(false);
    const refKey = `res_cutout_${Date.now()}`;
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    await persistImportedAsset(refKey, blob, file, 'generated', 'image');
    const aspect = await computeMediaAspect(blob, 'image');
    const size = computeProportionalSize(aspect, 40, 80, 8, 90, 5, baseProject.canvas?.width, baseProject.canvas?.height);
    const id = `el_${Date.now()}`;
    const startTime = getPlayheadInsertTime(currentTime);
    const duration = 5;
    const newEl: SceneElement = {
      id,
      type: 'img',
      refId: refKey,
      sourceName: fileName,
      mediaAspect: aspect,
      x: Math.max(5, Math.round((100 - size.w) / 2)),
      y: Math.max(5, Math.round((100 - size.h) / 2)),
      w: size.w,
      h: size.h,
      zIndex: getNextTopLayerZIndex(scene.els),
      opacity: 100,
      blendMode: 'normal',
      startTime,
      duration,
      animType: 'fade-in',
      animDur: 0.35,
      exitAnimType: 'fade-out',
      exitAnimDur: 0.3,
    };
    const nextProject = {
      ...baseProject,
      scenes: {
        ...baseProject.scenes,
        [activeSceneId]: { ...scene, duration: Math.max(scene.duration || 10, startTime + duration), els: [...scene.els, newEl] },
      },
    };
    projectDataRef.current = nextProject;
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    pushHistoryItem('插入 AI 抠图', { details: `素材: ${fileName}`, actionType: 'element_new', overrideSnapshot: nextProject });
    showToast('已插入 AI 抠图图片图层');
  }, [activeSceneId, currentTime, isPlaying, persistImportedAsset, pushHistoryItem, showToast]);

  // 兼容历史工程与绕过主导入入口的插件：时间线仍引用且能读取到 Blob 的素材，
  // 自动补齐素材库元数据。这样已生成的 3D/分层资源无需重新生成即可显示在素材栏目。
  useEffect(() => {
    if (IS_EXPORT_PLAYER) return;
    let cancelled = false;
    const synchronizeTimelineAssets = async () => {
      await dbManager.ensureReady();
      const references = new Map<string, string>();
      Object.values(projectData.scenes).forEach((scene) => {
        if (scene.bgmRef) references.set(scene.bgmRef, scene.bgmRef);
        scene.els.forEach((element) => {
          if (element.refId) references.set(element.refId, element.sourceName || element.refId);
        });
      });
      let changed = false;
      for (const [key, name] of references) {
        if (cancelled || synchronizedTimelineAssetRefs.current.has(key)) continue;
        if (/^(data:|blob:|https?:)/.test(key)) continue;
        const blob = dbManager.getBlob(key) || await dbManager.get(key);
        if (!blob) continue;
        synchronizedTimelineAssetRefs.current.add(key);
        const metadata = await dbManager.getMetadata(key);
        if (!metadata) {
          await dbManager.put(key, blob);
          await dbManager.setMetadata({
            key,
            name,
            originalName: name,
            importedAt: Date.now(),
            source: 'project',
          });
          changed = true;
        }
      }
      if (!cancelled && changed) setAssetRefreshTrigger((value) => value + 1);
    };
    synchronizeTimelineAssets().catch((error) => console.warn('[aether] 时间线素材同步失败', error));
    return () => { cancelled = true; };
  }, [timelineAssetSignature]);

  // Add Image/Video/Panorama from file
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isVid: boolean,
    asPanorama: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeScene) return;
    if (isPlaying) setIsPlaying(false);

    const refKey = 'res_' + Date.now();
    let mediaBlob: Blob;
    if (!isVid) {
      const blob = await processImageFile(file);
      mediaBlob = blob;
      await persistImportedAsset(refKey, blob, file, 'local-file', asPanorama ? 'panorama' : undefined);
    } else {
      mediaBlob = file;
      await persistImportedAsset(refKey, file, file, 'local-file', asPanorama ? 'panorama-video' : undefined);
    }

    // 【等比例】读取素材原始宽高比，元素尺寸严格保持素材原始比例（原素材什么比例，预览就是什么比例）
    let elW = 40;
    let elH = 45;
    let mediaAspect: number | undefined;
    if (asPanorama) {
      elW = 80;
      elH = 80;
    } else {
      const aspect = await computeMediaAspect(mediaBlob, isVid ? 'video' : 'image');
      mediaAspect = aspect;
      const size = computeProportionalSize(aspect, 40, 80, 8, 90, 5, projectData.canvas?.width, projectData.canvas?.height);
      elW = size.w;
      elH = size.h;
    }

    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    const id = 'el_' + Date.now();
    const elType: SceneElement['type'] = asPanorama
      ? (isVid ? 'panorama-vid' : 'panorama-img')
      : (isVid ? 'vid' : 'img');
    const newEl: SceneElement = {
      id,
      type: elType,
      refId: refKey,
      sourceName: file.name,
      mediaAspect,
      lockAspectRatio: !asPanorama,
      x: asPanorama ? 10 : 30,
      y: asPanorama ? 10 : 25,
      w: elW,
      h: elH,
      zIndex: getNextTopLayerZIndex(activeScene.els || []),
      opacity: 100,
      blendMode: 'normal',
      loop: 'true',
      muted: isVid ? false : true,
      videoControls: isVid ? false : undefined,
      videoPlayerStyle: isVid ? 'none' : undefined,
      startTime: startT,
      duration: dur,
      animType: 'fade-in',
      animDur: 0.5,
      panoramaFov: asPanorama ? 75 : undefined,
      panoramaAutoRotate: asPanorama ? false : undefined,
      panoramaAutoRotateSpeed: asPanorama ? 1 : undefined,
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          duration: sceneDur,
          els: [...activeScene.els, newEl],
        },
      },
    };

    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    pushHistoryItem(`添加${isVid ? '视频' : '图片'}素材`, {
      details: `文件名: ${file.name}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
    e.target.value = '';
  };

  // 3D模型导入
  const handleModel3DUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScene) return;
    if (await hasExternalGltfDependencies(file)) {
      showToast('此 .gltf 引用了外部模型或纹理文件，请先打包导出为 .glb 再上传。');
      e.target.value = '';
      return;
    }
    if (isPlaying) setIsPlaying(false);

    const refKey = 'res_' + Date.now();
    await persistImportedAsset(refKey, file, file, 'local-file', '3d');

    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    const id = 'el_' + Date.now();
    const newEl: SceneElement = {
      id,
      type: 'model-3d',
      refId: refKey,
      sourceName: file.name,
      mediaAspect: undefined,
      // 3D 元素以舞台中心为锚点，避免导入后因模型自身包围盒造成视觉偏移。
      x: 25,
      y: 25,
      w: 50,
      h: 50,
      zIndex: getNextTopLayerZIndex(activeScene.els || []),
      opacity: 100,
      blendMode: 'normal',
      loop: 'true',
      muted: true,
      startTime: startT,
      duration: dur,
      animType: 'fade-in',
      animDur: 0.5,
      modelAutoRotate: false,
      modelAutoRotateSpeed: 1,
      modelCameraDistance: 0,
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          els: [...(activeScene.els || []), newEl],
          duration: sceneDur,
        },
      },
    };
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    pushHistoryItem('添加3D模型', {
      details: `文件名: ${file.name}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
    e.target.value = '';
  };

  // 高斯泼溅导入
  const handleSplatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScene) return;
    if (isPlaying) setIsPlaying(false);

    const refKey = 'res_' + Date.now();
    await persistImportedAsset(refKey, file, file, 'local-file', 'gaussian-splat');

    const startT = getPlayheadInsertTime(currentTime);
    const dur = 6;
    const sceneDur = Math.max(activeScene.duration || 10, startT + dur);

    const id = 'el_' + Date.now();
    const newEl: SceneElement = {
      id,
      type: 'gaussian-splat',
      refId: refKey,
      sourceName: file.name,
      mediaAspect: undefined,
      x: 25,
      y: 25,
      w: 50,
      h: 50,
      zIndex: getNextTopLayerZIndex(activeScene.els || []),
      opacity: 100,
      blendMode: 'normal',
      loop: 'true',
      muted: true,
      startTime: startT,
      duration: dur,
      animType: 'fade-in',
      animDur: 0.5,
      splatSize: 1,
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          els: [...(activeScene.els || []), newEl],
          duration: sceneDur,
        },
      },
    };
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    setIsEditing(true);
    setViewport((v) => ({ ...v, activeTool: 'select' }));
    pushHistoryItem('添加高斯泼溅', {
      details: `文件名: ${file.name}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
    e.target.value = '';
  };

  // Add Audio from toolbar
  const handleAddAudio = async (file: File) => {
    if (!activeScene) return;
    const refKey = 'bgm_' + Date.now();
    await persistImportedAsset(refKey, file, file);
    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [activeSceneId]: {
          ...activeScene,
          bgmRef: refKey,
        },
      },
    };
    setProjectData(nextProject);
    pushHistoryItem('设置场景背景音乐 (BGM)', {
      details: `音频: ${file.name}`,
      actionType: 'scene_update',
      overrideSnapshot: nextProject,
    });
    if (bgmAudioRef.current) {
      const url = await dbManager.loadUrl(refKey);
      bgmAudioRef.current.src = url;
    }
  };

  // Add 3D Layers from 3D Modal
  const handleAdd3DLayers = async (layers: SceneElement[], asset?: { key: string; blob: Blob; name: string }) => {
    if (asset) {
      await dbManager.ensureReady();
      await dbManager.put(asset.key, asset.blob);
      await dbManager.setMetadata({
        key: asset.key,
        name: asset.name,
        originalName: asset.name,
        importedAt: Date.now(),
        source: 'generated',
      });
    }
    setAssetRefreshTrigger((t) => t + 1);
    const baseProject = projectDataRef.current;
    const baseScene = baseProject.scenes[activeSceneId];
    if (!baseScene) return;
    const startTime = getPlayheadInsertTime(currentTime);
    const topZIndex = getNextTopLayerZIndex(baseScene.els);
    const placedLayers = layers.map((layer, index) => ({
      ...layer,
      startTime,
      zIndex: topZIndex + index * 10,
    }));
    const nextProject = {
      ...baseProject,
      scenes: {
        ...baseProject.scenes,
        [activeSceneId]: {
          ...baseScene,
          els: [...baseScene.els, ...placedLayers],
          duration: Math.max(baseScene.duration || 10, ...placedLayers.map((layer) => layer.startTime + layer.duration)),
        },
      },
    };
    projectDataRef.current = nextProject;
    setProjectData(nextProject);
    setSelectedElementId(placedLayers[placedLayers.length - 1]?.id ?? null);
    setMultiSelectedIds(placedLayers.map((layer) => layer.id));
    pushHistoryItem('生成 3D 景深分层', {
      details: `新增 ${layers.length} 个景深分层`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  };


  // Add AI-generated 3D model from AiModel3DModal
  const handleAddModel3D = async (element: SceneElement, asset?: { key: string; blob: Blob; name: string }) => {
    if (asset) {
      await dbManager.ensureReady();
      await dbManager.put(asset.key, asset.blob);
      await dbManager.setMetadata({
        key: asset.key,
        name: asset.name,
        originalName: asset.name,
        importedAt: Date.now(),
        source: 'generated',
      });
    }
    setAssetRefreshTrigger((t) => t + 1);
    const baseProject = projectDataRef.current;
    const baseScene = baseProject.scenes[activeSceneId];
    if (!baseScene) return;
    const startTime = getPlayheadInsertTime(currentTime);
    const placedElement: SceneElement = {
      ...element,
      startTime,
      zIndex: getNextTopLayerZIndex(baseScene.els),
    };
    const nextProject = {
      ...baseProject,
      scenes: {
        ...baseProject.scenes,
        [activeSceneId]: {
          ...baseScene,
          els: [...baseScene.els, placedElement],
          duration: Math.max(baseScene.duration || 10, startTime + placedElement.duration),
        },
      },
    };
    projectDataRef.current = nextProject;
    setProjectData(nextProject);
    setSelectedElementId(placedElement.id);
    setMultiSelectedIds([placedElement.id]);
    pushHistoryItem('AI 生成 3D 模型', {
      details: '新增 AI 生成 3D 模型: ' + (element.sourceName || '未命名'),
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
  };
  // New Scene
  const handleNewScene = () => {
    const sceneCount = Object.keys(projectData.scenes).length + 1;
    const sceneName = `0${sceneCount}. 新建场景 (Scene ${sceneCount})`;

    const newId = 's_' + Date.now();
    const newScene: Scene = {
      id: newId,
      alias: sceneName,
      type: 'scene',
      duration: 10,
      cruiseDuration: 7,
      bgColor: '#08080c',
      // 【修复】新建场景默认启用「入场 + 出场」转场动画（淡入 / 淡出 / 0.6s），
      // 避免新建场景在「直接切换场景」时完全没有入场/出场动画。
      transitionIn: 'fade',
      transitionOut: 'fade',
      transitionDuration: 0.6,
      // 体感默认预设：挥手/右滑→下一页、左滑→上一页、握拳→回起始页（可在右侧体感控制中改）
      gestureBindings: createDefaultGestureBindings(),
      els: [
        {
          id: 'el_' + Date.now(),
          type: 'txt',
          refId: '',
          sourceName: '场景主标题',
          x: 20,
          y: 35,
          w: 60,
          h: 15,
          zIndex: 1,
          opacity: 100,
          content: sceneName,
          color: '#ffffff',
          fontSize: 42,
          fontWeight: 'bold',
          textAlign: 'center',
          startTime: 0,
          duration: 10,
          animType: 'zoom-in',
          animDur: 0.6,
        },
        {
          id: 'el_' + (Date.now() + 1),
          type: 'txt',
          refId: '',
          sourceName: '副标题提示',
          x: 25,
          y: 52,
          w: 50,
          h: 10,
          zIndex: 2,
          opacity: 80,
          content: '双击编辑文字，或从顶部工具栏添加组件与动效',
          color: '#94a3b8',
          fontSize: 16,
          fontWeight: 'normal',
          textAlign: 'center',
          startTime: 0.3,
          duration: 9.7,
          animType: 'fade-in',
          animDur: 0.5,
        },
      ],
    };

    const nextProject = {
      ...projectData,
      scenes: {
        ...projectData.scenes,
        [newId]: newScene,
      },
    };

    setProjectData(nextProject);
    setActiveSceneId(newId);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedElementId(null);
    setMultiSelectedIds([]);
    setSelectedHotspot(null); // 重置热点选中状态，避免指向旧场景元素导致渲染异常
    showToast(`✨ 已创建新场景: 「${sceneName}」 (在右侧属性面板可随时更名)`);
    pushHistoryItem('新建场景', {
      details: `场景: ${sceneName}`,
      actionType: 'scene_new',
      sceneId: newId,
      overrideSnapshot: nextProject,
    });
  };

  // Import Project (Zip, JSON, or HTML)
  const handleImportFile = async (input: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = input instanceof File ? input : input.target.files?.[0];
    if (!file) return;

    const normalizeImportedProject = (raw: unknown): ProjectData => {
      const result = normalizeProjectData(raw);
      if (!isNormalizeOk(result)) {
        throw new Error(`工程数据校验失败：${result.error.message}`);
      }
      return normalizeSceneZIndices(result.data as ProjectData);
    };

    const openLegacyImportedProject = async (parsed: ProjectData) => {
      const importedProjectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const importedTitle = parsed.meta?.title?.trim() || file.name.replace(/\.(zip|json|html)$/i, '') || '导入工程';
      await saveProjectToStorage(importedProjectId, {
        ...parsed,
        schemaVersion: SCHEMA_VERSION,
      }, { name: importedTitle });
      handleOpenProject(importedProjectId, parsed);
    };

    try {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.aether') || fileName.endsWith('.zip')) {
        const archive = await JSZip.loadAsync(file);
        // Standard .aether exports use the P0 importer, which stores assets in
        // OPFS/IndexedDB and remaps asset IDs. This avoids the legacy dbManager
        // path that left imported projects partially readable.
        if (fileName.endsWith('.aether') || (archive.file('project.json') && archive.file('manifest.json'))) {
          const result = await projectImporter.importProject(file, {
            newProjectName: file.name.replace(/\.(aether|zip)$/i, ''),
          });
          const imported = await aetherDB.getProject(result.projectId);
          if (!imported) throw new Error('工程已导入，但无法从本地工程库读取结果');
          handleOpenProject(result.projectId, imported.data);
          showToast(`✅ 工程导入成功：${result.projectName}${result.warnings.length ? `（${result.warnings.length} 项提示）` : ''}`);
          return;
        }
        const zip = archive;
        let projectJson = '';

        if (zip.file('project.json')) {
          projectJson = await zip.file('project.json')!.async('text');
        } else {
          // Look for index.html data anchor
          const htmlFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('index.html') && !f.dir);
          if (htmlFile) {
            const htmlText = await htmlFile.async('text');
            const match = htmlText.match(/\/\*__DATA__\*\/ let projectData = "([^"]+)"; \/\*__END__\*\//);
            if (match && match[1]) {
              projectJson = decodeURIComponent(escape(atob(match[1])));
            }
          }
        }

        if (projectJson) {
          const parsed = normalizeImportedProject(JSON.parse(projectJson));
          // Extract assets
          const assetFiles = Object.keys(zip.files).filter((k) => k.startsWith('assets/') && !zip.files[k].dir);
          let manifestAssets: Array<{ id?: string; path?: string }> = [];
          const manifestFile = zip.file('manifest.json');
          if (manifestFile) {
            try {
              const manifest = JSON.parse(await manifestFile.async('text'));
              if (Array.isArray(manifest.assets)) manifestAssets = manifest.assets;
            } catch {
              // Manifest is optional for legacy ZIP exports.
            }
          }
          for (const path of assetFiles) {
            const blob = await zip.file(path)!.async('blob');
            await dbManager.put('./' + path, blob);
            const baseName = path.split('/').pop()?.split('.')[0];
            if (baseName) await dbManager.put(baseName, blob);
            const manifestAsset = manifestAssets.find((asset) => asset.path === path);
            if (manifestAsset?.id) await dbManager.put(manifestAsset.id, blob);
          }
          await openLegacyImportedProject(parsed);
          projectDataRef.current = parsed;
          setProjectData(parsed);
          setActiveSceneId(parsed.start || Object.keys(parsed.scenes)[0]);
          showToast('✅ Zip 工程解包导入成功');
        } else {
          throw new Error('工程压缩包缺少 project.json，无法导入');
        }
      } else if (fileName.endsWith('.json')) {
        const txt = await file.text();
          const parsed = normalizeImportedProject(JSON.parse(txt));
        await openLegacyImportedProject(parsed);
        projectDataRef.current = parsed;
        setProjectData(parsed);
        setActiveSceneId(parsed.start || Object.keys(parsed.scenes)[0]);
        showToast('✅ JSON 工程导入成功');
      } else if (fileName.endsWith('.html')) {
        const txt = await file.text();
        const match = txt.match(/\/\*__DATA__\*\/ let projectData = "([^"]+)"; \/\*__END__\*\//);
        if (match && match[1]) {
          const jsonStr = decodeURIComponent(escape(atob(match[1])));
          const parsed = normalizeImportedProject(JSON.parse(jsonStr));
          await openLegacyImportedProject(parsed);
          projectDataRef.current = parsed;
          setProjectData(parsed);
          setActiveSceneId(parsed.start || Object.keys(parsed.scenes)[0]);
          showToast('✅ HTML 独立工程导入成功');
        } else {
          throw new Error('HTML 工程缺少可识别的项目数据');
        }
      } else {
        throw new Error('不支持的文件格式，请选择 .aether、.zip、.json 或 .html 文件');
      }
    } catch (err) {
      console.error(err);
      if (!(input instanceof File)) input.target.value = '';
      const message = err instanceof Error ? err.message : '未知错误';
      showToast('导入失败: ' + message, 'error');
      throw err;
    }
    if (!(input instanceof File)) input.target.value = '';
  };

  // Load Built-in Templates
  const handleLoadTemplate = (templateKey: string) => {
    setIsPlaying(false);
    setCurrentTime(0);
    setSelectedElementId(null);
    setMultiSelectedIds([]);
    // Loading the official sample from the editor should return to the full
    // workstation so its editable layers and controls are immediately visible.
    if (templateKey === 'default') {
      setIsEditing(true);
      setIsFullscreenPreview(false);
    }

    // 加载模板时生成新的projectId，确保模板作为新工程保存
    const newProjectId = `proj_${Date.now()}`;
    setProjectId(newProjectId);
    try { localStorage.setItem('aether_current_project_id', newProjectId); } catch {}

    if (templateKey === 'factory-ops') {
      const cloned = createFactoryOpsTemplateProject();
      projectDataRef.current = cloned;
      setProjectData(cloned);
      setActiveSceneId(cloned.start || 'factory_ops');
      pushHistoryItem('加载“智能工厂监控中枢”模板', { details: '含可编辑设备透视图、状态、产线指标与产能趋势', actionType: 'template_load', overrideSnapshot: cloned });
      resetHistoryForProject(cloned, newProjectId, '加载模板', '智能工厂监控中枢');
      showToast('已加载智能工厂监控中枢，可在图层属性中编辑指标与设备');
    } else if (templateKey === 'dashboard-pack') {
      const cloned = createDashboardTemplateProject();
      projectDataRef.current = cloned;
      setProjectData(cloned);
      setActiveSceneId(cloned.start || 'dash_1');
      pushHistoryItem('加载“通用数据大屏 · 12页行业模板”', { details: '充电、电力、医院、储能、楼宇、城市、能耗与电商场景骨架', actionType: 'template_load', overrideSnapshot: cloned });
      resetHistoryForProject(cloned, newProjectId, '加载模板', '通用数据大屏 · 12页行业模板');
      showToast('已加载通用数据大屏 12 页行业模板');
    } else if (templateKey === 'default') {
      const cloned = JSON.parse(JSON.stringify(DEFAULT_PROJECT_DATA));
      projectDataRef.current = cloned;
      setProjectData(cloned);
      setActiveSceneId(cloned.start || 'blank');
      pushHistoryItem('载入「鲸动交互 · 官方旗舰示例」', {
        details: '4 大篇章：空间觉醒、灵动掌控、智能共生与极境交付',
        actionType: 'template_load',
        overrideSnapshot: cloned,
      });
      resetHistoryForProject(cloned, newProjectId, '加载模板', '鲸动交互 · 官方旗舰示例');
      showToast('已成功载入「鲸动交互 · 官方旗舰示例」：4 大篇章可直接体验');
    } else if (templateKey === 'workshop') {
      const cloned = JSON.parse(JSON.stringify(MULTIMEDIA_WORKSHOP_DATA));
      projectDataRef.current = cloned;
      setProjectData(cloned);
      setActiveSceneId(cloned.start || 'ws_home');
      pushHistoryItem('载入「多媒体工坊」预设模板', {
        details: '全套 4 场景体感大屏演示（已开启体感交互）',
        actionType: 'template_load',
        overrideSnapshot: cloned,
      });
      resetHistoryForProject(cloned, newProjectId, '加载模板', '多媒体工坊');
      showToast('✨ 已载入「多媒体工坊」预设：4 场景体感大屏演示，已预置手势控制');
    } else {
      const cloned = JSON.parse(JSON.stringify(MINIMAL_KEYNOTE_DATA));
      projectDataRef.current = cloned;
      setProjectData(cloned);
      setActiveSceneId(cloned.start || 'min_hero');
      pushHistoryItem('载入「极简发布 · Keynote」模板', {
        details: '全套 3 场景极简白皮书演示',
        actionType: 'template_load',
        overrideSnapshot: cloned,
      });
      resetHistoryForProject(cloned, newProjectId, '加载模板', '极简发布 · Keynote');
      showToast('✨ 已成功载入「极简发布 · Keynote」全套模板 (可在历史面板随时回滚)');
    }
  };

  // Create a brand-new blank project (not a template)
  // 【工程级画布】先弹出画布设置（选择播放媒介比例），确认后创建
  const handleNewBlankProject = () => {
    setIsCanvasSetupOpen(true);
  };

  // 画布设置确认 → 创建空白工程（带 canvas 尺寸）
  const confirmNewBlankProject = (canvas: { width: number; height: number }) => {
    setIsCanvasSetupOpen(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setSelectedElementId(null);
    setMultiSelectedIds([]);
    const blankId = 'scene_' + Date.now();
    const blank: ProjectData = {
      meta: {
        v: 42.1,
        title: '未命名工程',
        author: '鲸动交互平台',
        updatedAt: new Date().toISOString(),
      },
      start: blankId,
      canvas: { width: canvas.width, height: canvas.height },
      scenes: {
        [blankId]: {
          id: blankId,
          alias: '场景 1',
          type: 'scene',
          duration: 10,
          bgColor: '#0a0a12',
          els: [],
        },
      },
    };
    projectDataRef.current = blank;
    setProjectData(blank);
    setActiveSceneId(blankId);
    // P0存储层：新建工程时生成新的projectId
    const newProjectId = `proj_${Date.now()}`;
    setProjectId(newProjectId);
    // This project is already fully materialized in memory. Mark it hydrated
    // immediately so the projectId effect cannot load an older record and
    // overwrite edits made before the first IndexedDB write completes.
    setHydratedProjectId(newProjectId);
    persistedProjectDataRef.current = { projectId: newProjectId, data: blank };
    try { localStorage.setItem('aether_current_project_id', newProjectId); } catch {}
    void (async () => {
      try {
        await saveProjectToStorage(newProjectId, { ...blank, schemaVersion: SCHEMA_VERSION }, {
          name: blank.meta?.title || '未命名工程',
        });
        await aetherDB.addRecentProject({
          projectId: newProjectId,
          name: blank.meta?.title || '未命名工程',
          lastOpenedAt: Date.now(),
        });
      } catch (error) {
        console.warn('[aether] Failed to initialize new project storage', error);
      }
    })();
    resetHistoryForProject(blank, newProjectId, '新建空白工程', '全新空白工程（含一个空白场景）');
    showToast('🆕 已创建空白工程');
  };

  // 打开工程（从工程管理弹窗）
  const handleOpenProject = useCallback((projectId: string, projectData: any) => {
    setIsPlaying(false);
    setCurrentTime(0);
    setSelectedElementId(null);
    setMultiSelectedIds([]);

    // 规范化工程数据
    const normalized = normalizeProjectData(projectData);
    if (!isNormalizeOk(normalized)) {
      console.warn('[aether] Refused to open invalid project', normalized.error);
      showToast('工程数据格式不完整或已损坏，未打开该工程', 'error');
      return false;
    }
    const data = normalized.data;

    const openedProject = data as unknown as ProjectData;
    persistedProjectDataRef.current = { projectId, data: openedProject };
    setProjectData(openedProject);
    projectDataRef.current = openedProject;
    setProjectId(projectId);
    setHydratedProjectId(projectId);
    try { localStorage.setItem('aether_current_project_id', projectId); } catch {}

    // 设置活动场景
    const firstSceneId = data.start || Object.keys(data.scenes || {})[0];
    if (firstSceneId) {
      setActiveSceneId(firstSceneId);
    }

    resetHistoryForProject(
      data as ProjectData,
      projectId,
      '打开工程',
      `从工程管理打开: ${projectId}`,
    );
    showToast('📂 已打开工程');
  }, [resetHistoryForProject, showToast]);

  // 从素材库添加素材到画布
  const handleAddAssetFromLibrary = useCallback(async (assetKey: string, assetType: string) => {
    if (isPlaying) setIsPlaying(false);
    // Match the asset library's current display name, including user renames.
    const assetMetadata = await dbManager.getMetadata(assetKey);
    const assetDisplayName = assetMetadata?.name?.trim() || assetMetadata?.originalName?.trim();

    // 音频没有可视化图层类型，添加到场景时设置为背景音乐，避免生成空白视频图层。
    if (assetType === 'audio') {
      const nextProject = {
        ...projectData,
        scenes: {
          ...projectData.scenes,
          [activeSceneId]: { ...activeScene, bgmRef: assetKey },
        },
      };
      setProjectData(nextProject);
      pushHistoryItem('设置场景背景音乐 (BGM)', {
        details: `从素材库添加音频: ${assetKey}`,
        actionType: 'scene_update',
        overrideSnapshot: nextProject,
      });
      showToast('已将音频设为当前场景背景音乐');
      return;
    }

    const id = 'el_' + Date.now();
    const startT = getPlayheadInsertTime(currentTime);
    const dur = 5;
    const sceneDur = Math.max(activeScene?.duration || 10, startT + dur);

    // 根据素材类型确定元素类型
    let elementType: SceneElement['type'] = 'img';
    let sourceName = assetDisplayName || '图片素材';
    let w = 40;
    let h = 30;
    let mediaAspect: number | undefined;

    if (assetType === 'video') {
      elementType = 'vid';
      sourceName = assetDisplayName || '视频素材';
      // 【等比例】读取素材原始宽高比，保持原始比例
      const blob = dbManager.getBlob(assetKey) || await dbManager.get(assetKey);
      const aspect = blob ? await computeMediaAspect(blob, 'video') : 1;
      mediaAspect = aspect;
      const size = computeProportionalSize(aspect, 50, 80, 8, 90, 5, projectData.canvas?.width, projectData.canvas?.height);
      w = size.w;
      h = size.h;
    } else if (assetType === 'image') {
      // 【等比例】图片按原始比例显示
      const blob = dbManager.getBlob(assetKey) || await dbManager.get(assetKey);
      const aspect = blob ? await computeMediaAspect(blob, 'image') : 1;
      mediaAspect = aspect;
      const size = computeProportionalSize(aspect, 40, 80, 8, 90, 5, projectData.canvas?.width, projectData.canvas?.height);
      w = size.w;
      h = size.h;
    } else if (assetType === '3d' || assetType === 'gaussian-splat') {
      elementType = assetType === 'gaussian-splat' ? 'gaussian-splat' : 'model-3d';
      sourceName = assetDisplayName || (assetType === 'gaussian-splat' ? '高斯泼溅' : '3D模型');
      w = 50;
      h = 50;
    } else if (assetType === 'panorama' || assetType === 'panorama-video') {
      elementType = assetType === 'panorama-video' ? 'panorama-vid' : 'panorama-img';
      sourceName = assetDisplayName || (assetType === 'panorama-video' ? 'VR全景视频' : '全景图');
      w = 100;
      h = 100;
    }

    const newEl: SceneElement = {
      id,
      type: elementType,
      refId: assetKey,
      sourceName,
      mediaAspect,
      lockAspectRatio: assetType === 'image' || assetType === 'video' ? true : undefined,
      x: assetType === '3d' || assetType === 'gaussian-splat' ? 25 : 30,
      y: assetType === '3d' || assetType === 'gaussian-splat' ? 25 : 30,
      w,
      h,
      zIndex: getNextTopLayerZIndex(activeScene?.els || []),
      opacity: 100,
      blendMode: 'normal',
      ...(elementType === 'vid' || elementType === 'panorama-vid' ? {
        muted: false,
        videoControls: false,
        videoPlayerStyle: 'none' as const,
      } : {}),
      startTime: startT,
      duration: dur,
    };

    const baseProject = projectDataRef.current;
    const baseScene = baseProject.scenes[activeSceneId];
    if (!baseScene) return;
    const nextProject = {
      ...baseProject,
      scenes: {
        ...baseProject.scenes,
        [activeSceneId]: {
          ...baseScene,
          els: [...baseScene.els, newEl],
          duration: Math.max(baseScene.duration || 10, sceneDur),
        },
      },
    };
    projectDataRef.current = nextProject;
    setProjectData(nextProject);

    setSelectedElementId(id);
    pushHistoryItem(`添加${sourceName}`, {
      details: `从素材库添加: ${sourceName}`,
      actionType: 'element_new',
      overrideSnapshot: nextProject,
    });
    showToast(`✨ 已添加${sourceName}`);
  }, [activeSceneId, activeScene, currentTime, isPlaying, projectData, pushHistoryItem, showToast]);

  // 过程化 3D 没有 Blob/key；从素材栏复用时必须完整复制模型代码与配置。
  const handleAddTimelineAsset = useCallback((source: SceneElement) => {
    const baseProject = projectDataRef.current;
    const scene = baseProject.scenes[activeSceneId];
    if (!scene) return;
    const id = `el_${Date.now()}`;
    const startTime = Math.max(0, Math.round(currentTime * 10) / 10);
    const copy: SceneElement = {
      ...source,
      id,
      startTime,
      duration: source.duration || 6,
      zIndex: Math.max(0, ...scene.els.map((element) => element.zIndex ?? 0)) + 10,
    };
    const nextProject = {
      ...baseProject,
      scenes: {
        ...baseProject.scenes,
        [activeSceneId]: {
          ...scene,
          els: [...scene.els, copy],
          duration: Math.max(scene.duration || 10, startTime + copy.duration),
        },
      },
    };
    projectDataRef.current = nextProject;
    setProjectData(nextProject);
    setSelectedElementId(id);
    setMultiSelectedIds([id]);
    pushHistoryItem('从素材库添加项目 3D 模型', { actionType: 'element_new', overrideSnapshot: nextProject });
  }, [activeSceneId, currentTime, pushHistoryItem]);

  // 外部文件拖拽导入：统一入库（IndexedDB），addToCanvas=true 时同时添加到当前场景时间线
  const handleImportFiles = useCallback(async (files: File[], addToCanvas: boolean): Promise<{ imported: number; skipped: number }> => {
    if (!files || files.length === 0) return { imported: 0, skipped: 0 };
    if (isPlaying) setIsPlaying(false);

    let ok = 0;
    let skipped = 0;
    let audioAssigned = false;
    cancelImportRef.current = false;
    setImportProgress({ current: 0, total: files.length, fileName: '' });
    let extraAudioCount = 0;
    let importedAudioRefKey: string | null = null;
    const importedElements: SceneElement[] = [];
    const importedElementIds: string[] = [];
    const skippedNames: string[] = [];
    const failedNames: string[] = [];
    for (const [fileIndex, file] of files.entries()) {
      if (cancelImportRef.current) break;
      setImportProgress({ current: fileIndex + 1, total: files.length, fileName: file.name });
      if (file.size > 512 * 1024 * 1024) {
        skipped++;
        skippedNames.push(`${file.name}（超过 512MB）`);
        continue;
      }
      const type = detectDroppedFileType(file);
      if (type === 'other') {
        skipped++;
        skippedNames.push(file.name);
        continue;
      }
      if (type === '3d' && await hasExternalGltfDependencies(file)) {
        skipped++;
        skippedNames.push(`${file.name}（缺少外部依赖，请打包为 .glb）`);
        continue;
      }
      const refKey = 'res_' + Date.now() + Math.random().toString(36).slice(2, 7);
      try {
        const isProcedural3D = file.name.toLowerCase().endsWith('.aether-3d.json');
        const proceduralModel = isProcedural3D ? await readProcedural3DPackage(file) : null;
        if (proceduralModel) {
          await dbManager.ensureReady();
          await dbManager.setMetadata({
            key: refKey,
            name: proceduralModel.model.sourceName || file.name.replace(/\.aether-3d\.json$/i, ''),
            originalName: file.name,
            importedAt: Date.now(),
            source: 'local-file',
            proceduralModel: proceduralModel.model,
          });
        } else if (type === 'image' || type === 'panorama') {
          const blob = await processImageFile(file);
      await persistImportedAsset(refKey, blob, file, 'local-file', type, false);
        } else {
      await persistImportedAsset(refKey, file, file, 'local-file', type, false);
        }
        // 音频没有可视化图层：导入到画布时设置为当前场景 BGM，避免生成空白视频层。
        if (addToCanvas) {
          if (type === 'audio') {
            if (!audioAssigned) {
              audioAssigned = true;
              importedAudioRefKey = refKey;
            } else {
              extraAudioCount++;
            }
            ok++;
            continue;
          }
          const startT = getPlayheadInsertTime(currentTime);
          const dur = 6;
          const id = 'el_' + Date.now() + Math.random().toString(36).slice(2, 6);
          const isVid = type === 'video' || type === 'panorama-video';
          const is3D = type === '3d' || type === 'gaussian-splat';
          const isPano = type === 'panorama' || type === 'panorama-video';
          const isSplat = type === 'gaussian-splat';
          const elType: SceneElement['type'] = isSplat
            ? 'gaussian-splat'
            : is3D
            ? 'model-3d'
            : isPano
            ? (isVid ? 'panorama-vid' : 'panorama-img')
            : (isVid ? 'vid' : 'img');
          // 【优化】等比例上传：读取图片/视频原始宽高比，元素尺寸严格保持素材原始比例（原素材什么比例，进程序就是什么比例）
          let aspect = isVid || type === 'image' || type === 'panorama'
            ? await computeMediaAspect(file, isVid ? 'video' : 'image')
            : 1;
          const size = computeProportionalSize(aspect, 40, 80, 8, 90, 5, projectData.canvas?.width, projectData.canvas?.height);
          const wVal = isPano ? 80 : is3D ? 50 : size.w;
          const hVal = isPano ? 80 : is3D ? 50 : size.h;
          const newEl: SceneElement = {
            id,
            type: elType,
            refId: refKey,
            sourceName: file.name,
            mediaAspect: !is3D && !isPano ? aspect : undefined,
            lockAspectRatio: !is3D && !isPano ? true : undefined,
            x: isPano ? 10 : (is3D ? 25 : 30),
            y: isPano ? 10 : 25,
            w: wVal,
            h: hVal,
            zIndex: 0,
            opacity: 100,
            blendMode: 'normal',
            loop: 'true',
            muted: isVid ? false : true,
            videoControls: isVid ? false : undefined,
            videoPlayerStyle: isVid ? 'none' : undefined,
            startTime: startT,
            duration: dur,
            animType: 'fade-in',
            animDur: 0.5,
            modelAutoRotate: is3D ? false : undefined,
            modelAutoRotateSpeed: is3D ? 1 : undefined,
            splatSize: isSplat ? 1 : undefined,
            panoramaFov: isPano ? 75 : undefined,
            panoramaAutoRotate: isPano ? false : undefined,
            panoramaAutoRotateSpeed: isPano ? 1 : undefined,
            ...(proceduralModel ? {
              sourceName: proceduralModel.model.sourceName || file.name.replace(/\.aether-3d\.json$/i, ''),
              refId: '',
              modelAutoRotate: proceduralModel.model.modelAutoRotate ?? true,
              modelAutoRotateSpeed: proceduralModel.model.modelAutoRotateSpeed ?? 1,
              modelCameraDistance: proceduralModel.model.modelCameraDistance ?? 0,
              modelViewAzimuth: proceduralModel.model.modelViewAzimuth ?? 0,
              modelViewElevation: proceduralModel.model.modelViewElevation ?? 0,
              modelScale: proceduralModel.model.modelScale ?? 1,
              ai3dLayerDirection: proceduralModel.model.ai3dLayerDirection ?? 'up',
              ai3dLayerDistance: proceduralModel.model.ai3dLayerDistance ?? 1,
              ai3dExplodeDirection: proceduralModel.model.ai3dExplodeDirection ?? 'radial',
              ai3dExplodeDistance: proceduralModel.model.ai3dExplodeDistance ?? 1,
              ai3dExplodeSpeed: proceduralModel.model.ai3dExplodeSpeed ?? 1,
              ai3dExplodeSpin: proceduralModel.model.ai3dExplodeSpin ?? 0.5,
              ai3dCollisionDirection: proceduralModel.model.ai3dCollisionDirection ?? 'radial',
              ai3dCollisionDistance: proceduralModel.model.ai3dCollisionDistance ?? 1,
              ai3dCollisionBounce: proceduralModel.model.ai3dCollisionBounce ?? 0.5,
              ai3dCollisionSpeed: proceduralModel.model.ai3dCollisionSpeed ?? 1,
              ai3dCode: proceduralModel.model.ai3dCode,
              ai3dCodeSource: proceduralModel.model.ai3dCodeSource || 'img2threejs',
              ai3dTexture: proceduralModel.model.ai3dTexture,
              ai3dLayers: proceduralModel.model.ai3dLayers ?? 0,
              ai3dExplode: proceduralModel.model.ai3dExplode ?? 0,
              ai3dPhysics: proceduralModel.model.ai3dPhysics ?? false,
              ai3dLoopEnabled: proceduralModel.model.ai3dLoopEnabled !== false,
              ai3dPreviewControls: proceduralModel.model.ai3dPreviewControls,
              ai3dExportControls: proceduralModel.model.ai3dExportControls,
              ai3dControlVariant: proceduralModel.model.ai3dControlVariant,
            } : {}),
          };
          importedElements.push(newEl);
          importedElementIds.push(id);
        }
        ok++;
      } catch (e) {
        console.error('[Import] 导入文件失败:', file.name, e);
        skipped++;
        failedNames.push(file.name);
      }
    }
    const wasCancelled = cancelImportRef.current;
    cancelImportRef.current = false;
    setImportProgress(null);
    // persistImportedAsset 已为每个成功素材触发刷新；这里再触发一次确保批量导入完成后立即重载。
    setAssetRefreshTrigger((t) => t + 1);
    if (ok > 0) {
      const details = [...skippedNames, ...failedNames].slice(0, 2);
      const suffix = skipped ? `，跳过 ${skipped} 个文件${details.length ? `（${details.join('、')}${skipped > details.length ? ' 等' : ''}）` : ''}` : '';
      const audioNotice = addToCanvas && extraAudioCount > 0
        ? `；其中仅第一个音频设为当前场景 BGM，另外 ${extraAudioCount} 个已保存在素材库`
        : '';
      showToast(`✅ 已导入 ${ok} 个素材${addToCanvas ? ' 并添加到时间线' : ' 到素材库'}${audioNotice}${suffix}`, 'info', 5600);
    } else if (skipped > 0) {
      const details = [...skippedNames, ...failedNames].slice(0, 2);
      showToast(`⚠️ 没有可导入的文件${details.length ? `：${details.join('、')}` : ''}（支持图片、视频、音频、3D、全景）`);
    }
    if (wasCancelled) showToast(`已取消后续导入；已完成 ${ok} 个素材`, 'warning', 5600);
    if (addToCanvas && (importedElements.length > 0 || importedAudioRefKey)) {
      const baseProject = projectDataRef.current;
      const scene = baseProject.scenes[activeSceneId];
      if (scene) {
        const nextZIndex = getNextTopLayerZIndex(scene.els);
        const elementsWithZIndex = importedElements.map((element, index) => ({
          ...element,
          zIndex: nextZIndex + index * 10,
        }));
        const nextScene = {
          ...scene,
          els: [...scene.els, ...elementsWithZIndex],
          ...(importedAudioRefKey ? { bgmRef: importedAudioRefKey } : {}),
          duration: Math.max(scene.duration || 10, ...elementsWithZIndex.map((element) => element.startTime + element.duration)),
        };
        const nextProject = {
          ...baseProject,
          scenes: { ...baseProject.scenes, [activeSceneId]: nextScene },
        };
        projectDataRef.current = nextProject;
        setProjectData(nextProject);
        pushHistoryItem(`批量导入 ${ok} 个素材`, {
          details: importedElementIds.length > 0 ? `新增 ${importedElementIds.length} 个时间线元素${importedAudioRefKey ? '，设置背景音乐' : ''}` : '设置背景音乐',
          actionType: 'element_new',
          overrideSnapshot: nextProject,
        });
      }
    }
    if (addToCanvas && importedElementIds.length > 0) {
      setSelectedElementId(importedElementIds[importedElementIds.length - 1]);
      setMultiSelectedIds(importedElementIds);
      setIsEditing(true);
    }
    return { imported: ok, skipped };
  }, [activeScene, activeSceneId, currentTime, isPlaying, persistImportedAsset, pushHistoryItem, showToast]);

  // 素材库面板拖入文件：仅入库（不自动添加到画布）
  const handleImportFilesToLibrary = useCallback((files: File[]) => {
    return handleImportFiles(files, false);
  }, [handleImportFiles]);

  const handleImportMediaToCanvas = useCallback((files: File[]) => {
    handleImportFiles(files, true);
  }, [handleImportFiles]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleToggleFullscreenPreview = useCallback(() => {
    setIsFullscreenPreview((prev) => {
      const next = !prev;
      if (next) {
        setSelectedElementId(null);
        setMultiSelectedIds([]);
        showToast('已进入全屏纯净预览模式，按 ESC 键随时退出');
      }
      return next;
    });
  }, [showToast]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input / textarea
      const tagName = (e.target as HTMLElement | null)?.tagName;
      const target = e.target as HTMLElement | null;
      // Dialog shortcuts must not mutate the workspace underneath.
      if (document.querySelector('[role="dialog"]')) return;
      if (tagName && /INPUT|TEXTAREA|SELECT/.test(tagName)) return;
      if (target?.isContentEditable || target?.closest('[contenteditable="true"]')) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        // 优先关闭热点媒体弹窗（+号跟踪点的图片/视频查看器）
        if (activeMediaHotspot) {
          e.preventDefault();
          setActiveMediaHotspot(null);
          return;
        }
        // 其次关闭场景预览弹窗（popup 类型热点）
        if (popupSceneId) {
          e.preventDefault();
          setPopupSceneId(null);
          return;
        }
        if (isFullscreenPreview) {
          e.preventDefault();
          setIsFullscreenPreview(false);
          return;
        } else if (!isEditing) {
          e.preventDefault();
          setIsEditing(true);
          return;
        }
      }

      if (ctrl && key === 'h') {
        e.preventDefault();
        setIsHistoryModalOpen((prev) => !prev);
      } else if (ctrl && key === 'o' && !isFullscreenPreview) {
        e.preventDefault();
        importShortcutInputRef.current?.click();
      } else if (ctrl && key === 'e' && !isFullscreenPreview) {
        e.preventDefault();
        setIsExportModalOpen(true);
      } else if (key === 'f') {
        e.preventDefault();
        handleToggleFullscreenPreview();
      } else if (key === 'e') {
        e.preventDefault();
        if (isFullscreenPreview) {
          setIsFullscreenPreview(false);
          setIsEditing(true);
        } else {
          setIsEditing((prev) => !prev);
        }
      } else if (key === ' ' && !isEditing) {
        e.preventDefault();
        handleTogglePlay();
      } else if ((key === 'arrowleft' || key === 'arrowright') && !isEditing) {
        // 展厅遥控器翻页：预览/全屏模式下左右方向键切换上/下一场景（只在画布场景序列中翻页，弹窗/UI 场景不参与）
        e.preventDefault();
        const loopKeys = getLoopableSceneKeys(projectData.scenes);
        if (loopKeys.length <= 1) return;
        const delta = key === 'arrowright' ? 1 : -1;
        let curIdx = loopKeys.indexOf(activeSceneId);
        if (curIdx === -1) curIdx = delta === 1 ? -1 : loopKeys.length; // 当前为弹窗场景：→ 从第一个 / ← 到最后一个画布场景
        const nextIdx = (curIdx + delta + loopKeys.length) % loopKeys.length;
        handleSelectScene(loopKeys[nextIdx]);
      } else if (key === 'tab' && !isFullscreenPreview) {
        e.preventDefault();
        setIsTimelineCollapsed((prev) => !prev);
      } else if (ctrl && key === 'z' && !isFullscreenPreview) {
        e.preventDefault();
        handleUndo();
      } else if (ctrl && key === 's' && !isFullscreenPreview) {
        e.preventDefault();
        handleManualSave();
      } else if (ctrl && key === 'y' && !isFullscreenPreview) {
        e.preventDefault();
        handleRedo();
      } else if (ctrl && key === 'c' && isEditing && !isFullscreenPreview) {
        e.preventDefault();
        handleCopyElements();
      } else if (ctrl && key === 'x' && isEditing && !isFullscreenPreview) {
        e.preventDefault();
        handleCutElements();
      } else if (ctrl && key === 'v' && isEditing && !isFullscreenPreview) {
        e.preventDefault();
        handlePasteElements();
      } else if (ctrl && key === 'd' && isEditing && !isFullscreenPreview) {
        // 剪映式：Ctrl+D 复制当前选中到新位置
        e.preventDefault();
        handleCopyElements();
        handlePasteElements();
      } else if (ctrl && key === 'a' && isEditing && !isFullscreenPreview) {
        // 剪映式：Ctrl+A 全选当前场景全部图层
        e.preventDefault();
        handleSelectAllElements();
      } else if (/^(arrowup|arrowdown|arrowleft|arrowright)$/.test(key) && isEditing && !isFullscreenPreview) {
        // 剪映式：方向键微调选中元素位置（Shift=精细0.1%，默认=1%，Alt=大步5%）
        if (selectedElementId || multiSelectedIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 0.1 : e.altKey ? 5 : 1;
          const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
          const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
          const ids = multiSelectedIds.length > 0 ? multiSelectedIds : (selectedElementId ? [selectedElementId] : []);
          const scene = projectData.scenes[activeSceneId];
          if (!scene) return;
          ids.forEach((id) => {
            const el = scene.els.find((x) => x.id === id);
            if (!el) return;
            const nx = Math.max(0, Math.min(100, Math.round(((el.x || 0) + dx) * 10) / 10));
            const ny = Math.max(0, Math.min(100, Math.round(((el.y || 0) + dy) * 10) / 10));
            handleUpdateElement(id, { x: nx, y: ny }, '方向键微调');
          });
        }
      } else if (key === 'delete' || key === 'backspace') {
        if (isEditing && !isFullscreenPreview) {
          // 优先删除选中的热点
          if (selectedHotspot) {
            e.preventDefault();
            handleDeleteHotspot(selectedHotspot.elementId, selectedHotspot.hotspotId);
          } else if (multiSelectedIds.length > 0 || selectedElementId) {
            e.preventDefault();
            if (multiSelectedIds.length > 0) {
              handleDeleteElements(multiSelectedIds);
            } else if (selectedElementId) {
              handleDeleteElement(selectedElementId);
            }
          }
        }
      } else if (key === 'c' && !ctrl && isEditing && !isFullscreenPreview && selectedElementId) {
        // 剪映式：C 键按指针分割当前选中片段
        e.preventDefault();
        handleSplitElement(selectedElementId);
      } else if (key === 't' && isEditing && !isFullscreenPreview) {
        handleAddElement('txt');
      } else if (key === 'r' && isEditing && !isFullscreenPreview) {
        handleAddElement('shape');
      } else if (key === 'i' && isEditing && !isFullscreenPreview) {
        e.preventDefault();
        imageInputRef.current?.click();
      } else if (key === 'm' && isEditing && !isFullscreenPreview) {
        e.preventDefault();
        videoInputRef.current?.click();
      } else if ((key === '?' || (e.code === 'Slash' && e.shiftKey)) && !isFullscreenPreview) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (key === '3' && isEditing && !isFullscreenPreview) {
        setIs3DModalOpen(true);
      } else if (key === 's' && isEditing && !isFullscreenPreview) {
        setViewport((v) => ({ ...v, snapEnabled: !v.snapEnabled }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, isFullscreenPreview, activeMediaHotspot, popupSceneId, selectedElementId, multiSelectedIds, selectedHotspot, handleToggleFullscreenPreview, handleTogglePlay, handleUndo, handleRedo, handleManualSave, handleSelectAllElements, handleDeleteElement, handleDeleteElements, handleDeleteHotspot, handleSplitElement, activeSceneId, projectData, handleUpdateElement, handleCopyElements, handleCutElements, handlePasteElements]);

  // ===== 体感手势控制（页面级交互输入总线：与鼠标/键盘平级）=====
  const motionEnabled = !!projectData.motionInput?.enabled;
  const motionSensitivity = projectData.motionInput?.sensitivity ?? 1;
  const GESTURE_NAME: Record<string, string> = { wave: '挥手', open_palm: '手掌张开', swipe_left: '左滑', swipe_right: '右滑', fist: '握拳', point: '指点' };
  const GESTURE_ACTION_NAME: Record<string, string> = { next_scene: '切到下一场景', prev_scene: '切到上一场景', goto_scene: '跳到指定场景', goto_start: '返回起始场景', show_menu: '呼出/收起控制栏' };
  const gesture = useGestureControl({
    enabled: motionEnabled,
    sensitivity: motionSensitivity,
    activeScene: projectData.scenes[activeSceneId],
    scenes: projectData.scenes,
    startSceneId: projectData.start,
    onSelectScene: handleSelectScene,
    onTrigger: (g, action) => {
      showToast(`👋 体感「${GESTURE_NAME[g] || g}」→ ${GESTURE_ACTION_NAME[action] || action}`);
      if (action === 'show_menu') setGestureHudToggleNonce((value) => value + 1);
    },
  });

  const handleInsertOfficialPlugin = (plugin: OfficialPluginDefinition, insertAt?: number) => {
    if (isPlaying) setIsPlaying(false);
    const id = `plugin_${Date.now()}`;
    const startT = getPlayheadInsertTime(insertAt ?? currentTime);
    const dur = 5;
    const sceneForSizing = projectDataRef.current.scenes[activeSceneId] || activeScene;
    const sceneDur = Math.max(sceneForSizing?.duration || 10, startT + dur);
    const baseSize = GALAXY_COMPONENT_BASE_SIZE[plugin.componentType] || { w: 280, h: 180 };
    const insertW = 16;
    const insertH = Math.max(4, Math.round((insertW / 100 * 1920 / (baseSize.w / baseSize.h)) / 1080 * 100 * 10) / 10);
    const mapping = getOfficialPluginRealtimeMapping(plugin);
    const data = { ...plugin.sample, pluginId: plugin.id, pluginVersion: plugin.version, dataBinding: { sourceId: 'mqtt.realtime', queryId: plugin.dataContract, refresh: 'realtime', mapping, freshness: { warningAfterMs: 5000, offlineAfterMs: 15000 }, emptyState: 'placeholder' } };
    const newEl: SceneElement = {
      id, type: 'ui-component', refId: '', sourceName: `插件: ${plugin.name}`, x: 35, y: 35, w: insertW, h: insertH,
      zIndex: getNextTopLayerZIndex(activeScene?.els || []), opacity: 100, blendMode: 'normal',
      uiComponentType: plugin.componentType, uiComponentData: data, startTime: startT, duration: dur,
      animType: 'zoom-in', animDur: 0.5, exitAnimType: 'fade-out', exitAnimDur: 0.4, visible: true, locked: false,
    };
    handleUpdateProject((prev) => ({ ...prev, scenes: { ...prev.scenes, [activeSceneId]: { ...prev.scenes[activeSceneId], duration: sceneDur, els: [...(prev.scenes[activeSceneId]?.els || []), newEl] } } }), `插入插件: ${plugin.name}`);
    setSelectedElementId(id);
    showToast(`已插入插件“${plugin.name}”，MQTT 实时数据绑定已启用`);
  };

  const handleInsertUiComponent = (type: string, data: Record<string, unknown>) => {
    if (isPlaying) setIsPlaying(false);
    const id = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startT = getPlayheadInsertTime(currentTime);
    const duration = 5;
    const sceneForSizing = projectDataRef.current.scenes[activeSceneId] || activeScene;
    const sceneDuration = Math.max(sceneForSizing?.duration || 10, startT + duration);
    const baseSize = GALAXY_COMPONENT_BASE_SIZE[type as keyof typeof GALAXY_COMPONENT_BASE_SIZE] || { w: 280, h: 180 };
    const placement = data.__placement && typeof data.__placement === 'object' ? data.__placement as { x?: number; y?: number; w?: number; h?: number } : undefined;
    const officialIdForSizing = type === 'official-modao' ? inferOfficialModaoId(data) : '';
    const officialCanvasSize = officialIdForSizing ? getOfficialComponentCanvasSize(officialIdForSizing) : undefined;
    const width = Number.isFinite(placement?.w) ? Number(placement?.w) : officialCanvasSize?.w || 16;
    const height = Number.isFinite(placement?.h) ? Number(placement?.h) : officialCanvasSize?.h || Math.max(4, Math.round((width / 100 * 1920 / (baseSize.w / baseSize.h)) / 1080 * 100 * 10) / 10);
    const officialId = type === 'official-modao' ? inferOfficialModaoId(data) : '';
    const officialData = type === 'official-modao'
      ? { ...Object.fromEntries(Object.entries(data).filter(([key]) => key !== '__placement')), ...(officialId ? { modaoId: officialId } : {}) }
      : data;
    // 连续插入时避免所有组件叠在同一个坐标上：显式给了 __placement 的组合保持原布局，
    // 单件插入则从 35,35 开始按 3% 步进寻找空位（最多 8 次）。
    const requestedX = Number.isFinite(placement?.x) ? Number(placement!.x) : 35;
    const requestedY = Number.isFinite(placement?.y) ? Number(placement!.y) : 35;
    let placeX = requestedX;
    let placeY = requestedY;
    const hasExplicitPlacement = Boolean(placement && (Number.isFinite(placement.x) || Number.isFinite(placement.y)));
    if (!hasExplicitPlacement) {
      const existing = sceneForSizing?.els || [];
      const isTaken = (x: number, y: number) => existing.some((el) => Math.abs(Number(el.x) - x) < 2 && Math.abs(Number(el.y) - y) < 2);
      for (let step = 1; step <= 8 && isTaken(placeX, placeY); step += 1) {
        placeX = Math.min(88, requestedX + step * 3);
        placeY = Math.min(85, requestedY + step * 3);
      }
    }
    const layerLabel = String(data.label || data.title || '').trim() || type;
    const element: SceneElement = {
      id,
      type: 'ui-component',
      refId: '',
      sourceName: type === 'official-modao' ? `官方组件: ${layerLabel}` : `UI组件: ${type}`,
      x: placeX,
      y: placeY,
      w: width,
      h: height,
      zIndex: getNextTopLayerZIndex(activeScene?.els || []),
      opacity: 100,
      blendMode: 'normal',
      uiComponentType: type,
      uiComponentData: {
        ...officialData,
        ...(type === 'official-modao' && !hasExplicitPlacement ? { __autoFit: true } : {}),
        ...(isContinuousInteractionComponent(type) ? { continuousInteraction: createMultiStageContinuousInteraction() } : {}),
      },
      startTime: startT,
      duration,
      animType: 'zoom-in',
      animDur: 0.5,
      exitAnimType: 'fade-out',
      exitAnimDur: 0.4,
      visible: true,
      locked: false,
    };
    handleUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...prev.scenes[activeSceneId],
          duration: sceneDuration,
          els: [...(prev.scenes[activeSceneId]?.els || []), element],
        },
      },
    }), '添加UI组件');
    setSelectedElementId(id);
  };

  const handleApplyAiSceneProposal = useCallback((proposal: AiSceneProposal) => {
    const baseProject = projectDataRef.current;
    const result = applyAiSceneProposal(baseProject, proposal, activeSceneId);
    const normalized = normalizeProjectData(result.project);
    const nextProject = isNormalizeOk(normalized) ? normalized.data as unknown as ProjectData : result.project;
    projectDataRef.current = nextProject;
    setProjectData(nextProject);
    if (result.createdSceneId && nextProject.scenes[result.createdSceneId]) setActiveSceneId(result.createdSceneId);
    // 写入后先展示干净的最终版式，避免所有新图层同时出现控制点和选中框。
    // 用户仍可从画布或图层面板选择任意图层继续编辑。
    setSelectedElementId(null);
    setMultiSelectedIds([]);
    setIsEditing(true);
    setIsAiSceneBuilderOpen(false);
    pushHistoryItem('AI scene generation', {
      details: `${proposal.title} | ${result.createdElementIds.length} elements${result.adjustedCount ? ` | auto-adjusted ${result.adjustedCount}` : ''}`,
      actionType: 'general',
      sceneId: result.createdSceneId || activeSceneId,
      overrideSnapshot: nextProject,
    });
    showToast(`AI plan applied: ${result.createdElementIds.length} elements${result.adjustedCount ? `, adjusted ${result.adjustedCount}` : ''}`);
    return result;
  }, [activeSceneId, pushHistoryItem, showToast]);

  const globalSearchActionsRef = useRef({
    addElement: handleAddElement,
    openMediaImport: () => mediaImportInputRef.current?.click(),
    addAudio: handleAddAudio,
    openCustomCode: handleOpenCustomCodePlugin,
    insertCustomCode: handleInsertCustomCodeLibrary,
    selectSaber: handleSelectSaberPreset,
    selectVfx: handleSelectVfxPreset,
    insertOfficialPlugin: handleInsertOfficialPlugin,
  });
  globalSearchActionsRef.current = {
    addElement: handleAddElement,
    openMediaImport: () => mediaImportInputRef.current?.click(),
    addAudio: handleAddAudio,
    openCustomCode: handleOpenCustomCodePlugin,
    insertCustomCode: handleInsertCustomCodeLibrary,
    selectSaber: handleSelectSaberPreset,
    selectVfx: handleSelectVfxPreset,
    insertOfficialPlugin: handleInsertOfficialPlugin,
  };

  const globalSearchItems = useMemo<GlobalSearchItem[]>(() => {
    const results: GlobalSearchItem[] = [];
    const add = (item: GlobalSearchItem) => results.push(item);

    activeScene?.els.forEach((element) => {
      const title = element.sourceName || element.content || element.type;
      const typeLabel = element.type === 'vfx' ? '动效' : element.type === 'saber' ? 'Saber 光效' : element.type === 'ui-component' ? 'UI 组件' : element.type === 'vid' ? '视频素材' : element.type === 'img' ? '图片素材' : '图层';
      const Icon = element.type === 'vid' ? Video : element.type === 'img' ? Image : element.type === 'saber' || element.type === 'vfx' ? Sparkles : Layers;
      add({
        id: `layer:${element.id}`,
        title: String(title).slice(0, 64),
        description: `当前场景 · ${typeLabel}`,
        category: '素材',
        keywords: [element.id, element.type, String(element.content || '')],
        icon: Icon,
        accent: element.type === 'vfx' || element.type === 'saber' ? '#67e8f9' : '#93c5fd',
        action: () => {
          setSelectedElementId(element.id);
          setMultiSelectedIds([element.id]);
          setTimelineEditTargetId(element.id);
          setIsEditing(true);
        },
      });
    });

    [
      ['添加文字', '创建可编辑文字图层', Type, () => globalSearchActionsRef.current.addElement('txt'), '#93c5fd'],
      ['添加图片图层', '在当前场景新建图片图层', Image, () => globalSearchActionsRef.current.addElement('img'), '#7dd3fc'],
      ['添加视频图层', '在当前场景新建视频图层', Video, () => globalSearchActionsRef.current.addElement('vid'), '#fbbf24'],
      ['添加音频', '为当前场景导入背景音频', Music, () => globalAudioInputRef.current?.click(), '#f9a8d4'],
      ['导入素材', '选择图片、视频、音频、全景或 3D 文件', Upload, () => globalSearchActionsRef.current.openMediaImport(), '#7dd3fc'],
      ['形状预设', '打开形状与卡片预设库', Shapes, () => setIsShapePresetModalOpen(true), '#6ee7b7'],
      ['Galaxy UI 组件', '打开可插入的 UI 组件库', LayoutGrid, () => setIsUILibraryModalOpen(true), '#c4b5fd'],
      ['官方组件', '打开官方组件目录', Box, () => setIsOfficialComponentsOpen(true), '#a78bfa'],
      ['图表图层', '快速插入一个图表图层', Table2, () => globalSearchActionsRef.current.addElement('chart'), '#34d399'],
      ['VFX 动效库', '打开科技动效与实时参数库', Wand2, () => setIsVfxModalOpen(true), '#67e8f9'],
      ['Saber 光效库', '打开 Saber 光线与钢笔路径库', PenTool, () => setIsSaberPresetModalOpen(true), '#22d3ee'],
      ['卡片编排动效', '打开卡片布局与转场动效', LayoutGrid, () => setIsCardLayoutModalOpen(true), '#fbbf24'],
      ['交互控制', '打开交互区域与触发器组件', MousePointer2, () => setIsInteractionControlsModalOpen(true), '#6ee7b7'],
      ['自定义代码组件', '创建可编辑的 HTML / CSS / JS 组件', Code2, () => globalSearchActionsRef.current.openCustomCode(), '#67e8f9'],
      ['官方插件中心', '打开实时数据插件目录', Plug, () => setIsPluginCenterModalOpen(true), '#22d3ee'],
      ['模板中心', '浏览可复用的场景模板', LayoutGrid, () => setIsTemplateCenterModalOpen(true), '#fbbf24'],
      ['AI 场景生成', '根据描述生成可编辑场景', Sparkles, () => { setWorkToolMode('none'); setIsAiSceneBuilderOpen(true); }, '#c4b5fd'],
      ['AI 3D 模型', '打开图生 3D 工作流', Box, () => openWorkTool('model3d'), '#c4b5fd'],
      ['AI 抠图', '移除图片背景并生成新素材', Wand2, () => openWorkTool('cutout'), '#67e8f9'],
      ['全景图片', '导入全景图片场景素材', Globe2, () => globalSearchActionsRef.current.addElement('panorama-img'), '#2dd4bf'],
      ['全景视频', '导入全景视频场景素材', Globe2, () => globalSearchActionsRef.current.addElement('panorama-vid'), '#2dd4bf'],
      ['3D 模型', '导入 GLB / GLTF 模型', Box, () => globalSearchActionsRef.current.addElement('model-3d'), '#a78bfa'],
      ['发布与导出', '导出工程、视频、图片或网页', Download, () => setIsExportModalOpen(true), '#7dd3fc'],
    ].forEach(([title, description, icon, action, accent]) => add({
      id: `feature:${String(title)}`,
      title: String(title),
      description: String(description),
      category: ['添加文字', '添加图片图层', '添加视频图层', '添加音频', '导入素材'].includes(String(title)) ? '素材' : ['发布与导出'].includes(String(title)) ? '发布' : ['VFX 动效库', 'Saber 光效库', '卡片编排动效'].includes(String(title)) ? '动效' : ['交互控制', 'AI 场景生成'].includes(String(title)) ? '交互' : ['AI 3D 模型', '全景图片', '全景视频', '3D 模型'].includes(String(title)) ? '空间' : ['自定义代码组件', '官方组件', '官方插件中心', 'Galaxy UI 组件', '模板中心'].includes(String(title)) ? '组件' : '设计',
      keywords: [String(title), String(description)],
      icon: icon as GlobalSearchItem['icon'],
      accent: String(accent),
      action: action as () => void,
    }));

    VFX_MOTION_INDEX.forEach((motion) => add({
      id: `vfx:${motion.id}`,
      title: motion.name,
      description: `${motion.category} · ${motion.desc}`,
      category: '动效',
      keywords: [motion.id, motion.category, motion.desc, 'VFX'],
      icon: Wand2,
      accent: motion.colorA,
      action: () => globalSearchActionsRef.current.selectVfx(motion, motion.colorA, motion.colorB, 1),
    }));

    SABER_SHAPE_PRESETS.forEach((shape) => add({
      id: `saber:${shape.id}`,
      title: shape.name,
      description: `Saber · ${shape.description}`,
      category: '动效',
      keywords: [shape.id, shape.category, shape.description, 'Saber', '光效'],
      icon: PenTool,
      accent: '#67e8f9',
      action: () => globalSearchActionsRef.current.selectSaber(shape),
    }));

    OFFICIAL_PLUGIN_REGISTRY.forEach((plugin) => add({
      id: `plugin:${plugin.id}`,
      title: plugin.name,
      description: `${plugin.category} · ${plugin.description}`,
      category: '组件',
      keywords: [plugin.id, plugin.name, plugin.description, ...plugin.tags],
      icon: Gauge,
      accent: '#a78bfa',
      action: () => globalSearchActionsRef.current.insertOfficialPlugin(plugin),
    }));

    customCodeLibrary.forEach((item) => add({
      id: `custom:${item.id}`,
      title: item.plugin.name,
      description: `自定义代码组件 · ${item.plugin.description || '可复用交互组件'}`,
      category: '组件',
      keywords: [item.plugin.name, item.plugin.description || '', 'HTML', 'CSS', 'JS'],
      icon: Code2,
      accent: '#67e8f9',
      action: () => globalSearchActionsRef.current.insertCustomCode(item.plugin),
    }));

    return results;
  }, [activeScene?.els, customCodeLibrary]);

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !isFullscreenPreview) {
        event.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalSearchShortcut);
    return () => window.removeEventListener('keydown', handleGlobalSearchShortcut);
  }, [isFullscreenPreview]);

  return (
    <div
      className="aether-app-shell w-screen h-screen overflow-hidden bg-[#0a0a0e] text-slate-100 flex flex-col font-sans select-none antialiased"
      onDropCapture={() => setIsFileDragOver(false)}
      onDragEndCapture={() => setIsFileDragOver(false)}
      onDragOver={(e) => {
        const isTimelineDropTarget = (e.target as HTMLElement).closest('[data-timeline-canvas]');
        if (isTimelineDropTarget && (e.dataTransfer?.types?.includes(PLUGIN_DRAG_ID_MIME) || e.dataTransfer?.types?.includes(PLUGIN_DRAG_MIME))) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
        // 外部文件拖入：允许放置并显示拖拽高亮（区分素材库内部拖拽与外部文件）
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          if (!isFileDragOver) setIsFileDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFileDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsFileDragOver(false);
        const pluginId = e.dataTransfer?.getData(PLUGIN_DRAG_ID_MIME);
        const pluginPayload = e.dataTransfer?.getData(PLUGIN_DRAG_MIME);
        const plugin = (pluginId ? getPluginById(pluginId) : undefined) || (pluginPayload ? deserializePluginDrag(pluginPayload) : undefined);
        if (plugin?.status === 'installed') {
          const timeline = (e.target as HTMLElement).closest<HTMLElement>('[data-timeline-canvas]');
          if (!timeline) {
            showToast('请将组件拖放到时间线');
            return;
          }
          const zoom = Number(timeline?.dataset.timelineZoom);
          const insertAt = Number.isFinite(zoom) && zoom > 0
            ? Math.max(0, (e.clientX - timeline.getBoundingClientRect().left) / zoom)
            : undefined;
          handleInsertOfficialPlugin(plugin, insertAt);
          setIsPluginCenterModalOpen(false);
          return;
        }
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          // 外部文件拖入：导入并添加到当前场景时间线
          handleImportFiles(Array.from(files), true);
        }
      }}
    >
      {/* 外部文件拖拽导入遮罩 */}
      {isFileDragOver && (
        <div className="fixed inset-0 z-[99999] pointer-events-none bg-cyan-500/10 backdrop-blur-[2px] flex items-center justify-center border-4 border-dashed border-cyan-400/70 rounded-none">
          <div className="bg-black/75 backdrop-blur px-10 py-8 rounded-2xl border border-cyan-400/40 shadow-2xl text-center">
            <Upload size={44} className="text-cyan-400 mx-auto mb-3" />
            <p className="text-white text-lg font-semibold">松手导入素材</p>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              支持 图片 / 视频 / 音频 / 3D模型 / 全景图
              <br />
              拖到素材库仅入库 · 拖到画布/时间线自动添加
            </p>
          </div>
        </div>
      )}
      {/* Hidden File Pickers */}
      <input
        type="file"
        ref={imageInputRef}
        aria-label="导入图片素材"
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileUpload(e, false)}
      />
      <input
        type="file"
        ref={videoInputRef}
        aria-label="导入视频素材"
        className="hidden"
        accept="video/*"
        onChange={(e) => handleFileUpload(e, true)}
      />
      <input
        type="file"
        ref={globalAudioInputRef}
        aria-label="导入音频素材"
        className="hidden"
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAddAudio(file);
          e.target.value = '';
        }}
      />
      {/* 全景图 / 全景视频 / 3D模型 / 高斯泼溅 */}
      <input
        type="file"
        ref={panoramaImgInputRef}
        aria-label="导入全景图片"
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileUpload(e, false, true)}
      />
      <input
        type="file"
        ref={panoramaVidInputRef}
        aria-label="导入全景视频"
        className="hidden"
        accept="video/*"
        onChange={(e) => handleFileUpload(e, true, true)}
      />
      <input
        type="file"
        ref={model3dInputRef}
        aria-label="导入 3D 模型"
        className="hidden"
        accept=".glb,.gltf,.aether-3d.json"
        onChange={(e) => handleModel3DUpload(e)}
      />
      <input
        type="file"
        ref={splatInputRef}
        aria-label="导入高斯泼溅模型"
        className="hidden"
        accept=".ply,.splat"
        onChange={(e) => handleSplatUpload(e)}
      />
      <input
        type="file"
        ref={importShortcutInputRef}
        aria-label="导入工程文件"
        className="hidden"
        accept=".aether,.zip,.json,.html"
        onChange={handleImportFile}
      />
      <input
        type="file"
        ref={mediaImportInputRef}
        aria-label="导入媒体素材"
        className="hidden"
        accept="image/*,video/*,audio/*,.glb,.gltf,.ply,.splat,.aether-3d.json"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length) void handleImportFiles(files, true);
          event.target.value = '';
        }}
      />
      <audio ref={bgmAudioRef} loop />

      {!isFullscreenPreview && <UpdateNotice />}

      {/* Top Workstation Header (Hidden in Fullscreen Preview) */}
      {!isFullscreenPreview && (
        <HeaderMenuBar
          projectData={projectData}
          onUpdateProject={handleUpdateProject}
          isEditing={isEditing}
          onToggleEditing={() => setIsEditing(!isEditing)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleManualSave}
          saveStatus={saveStatus}
          canUndo={canUndo}
          canRedo={canRedo}
          historyList={historyList}
          currentIndex={historyIndex}
          onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenAdvancedExportModal={() => setIsAdvancedExportModalOpen(true)}
          onOpenProjectManager={() => setIsProjectManagerOpen(true)}
           onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
           onOpenActivationModal={() => setIsLicenseActivationOpen(true)}
          onNewScene={handleNewScene}
          onAddElement={handleAddElement}
          onImportFile={handleImportFile}
          onResetDefault={() => handleLoadTemplate('default')}
          onNewBlankProject={handleNewBlankProject}
          onOpenTemplates={() => setIsTemplateCenterModalOpen(true)}
          onOpenPlugins={() => setIsPluginCenterModalOpen(true)}
          onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
          toggleFullscreen={toggleFullscreen}
        />
      )}

      {/* Secondary Workstation Toolbar (Only in Edit Mode and Not Fullscreen Preview)
          折叠面板时隐藏：画布占满全高，编辑舞台与演示舞台屏幕位置完全一致（虚线框=弹窗像素级一致） */}
      {!isFullscreenPreview && isEditing && !panelsCollapsed && (
        <WorkstationToolbar
          viewport={viewport}
          onUpdateViewport={setViewport}
          onFitCanvas={() => {
            const container = canvasContainerRef.current;
            const canvas = getProjectCanvas(projectData);
            if (!container) {
              setViewport((v) => ({ ...v, zoom: 0.85, panX: 0, panY: 0 }));
              return;
            }
            const padding = 40;
            const scale = Math.min(
              (container.clientWidth - padding) / canvas.width,
              (container.clientHeight - padding) / canvas.height,
              1.2,
            );
            setViewport((v) => ({ ...v, zoom: Math.max(0.05, scale), panX: 0, panY: 0 }));
          }}
          activeSceneAlias={projectData.scenes[activeSceneId]?.alias}
          canvasSpec={getProjectCanvas(projectData)}
          activeSidebarTab={leftSidebarTab}
          onSidebarTabChange={setLeftSidebarTab}
          onOpen3DModal={() => openWorkTool('model3d')}
          onOpenShapePresetModal={() => setIsShapePresetModalOpen(true)}
          onOpenSaberPresetModal={() => setIsSaberPresetModalOpen(true)}
          onOpenVfxModal={() => setIsVfxModalOpen(true)}
          onOpenCardLayoutModal={() => setIsCardLayoutModalOpen(true)}
          onOpenUILibraryModal={() => setIsUILibraryModalOpen(true)}
          onOpenOfficialComponents={() => setIsOfficialComponentsOpen(true)}
          onOpenPluginCenter={() => setIsPluginCenterModalOpen(true)}
          onOpenInteractionControlsModal={() => setIsInteractionControlsModalOpen(true)}
          onOpenBackgroundRemoval={() => openWorkTool('cutout')}
          onOpenAiSceneBuilder={() => { setWorkToolMode('none'); setIsAiSceneBuilderOpen(true); }}
          onOpenCustomCodePlugin={() => handleOpenCustomCodePlugin()}
          onAddElement={handleAddElement}
          commentMode={commentMode}
          commentCount={unresolvedCommentCount(projectData.comments)}
          versionCount={projectVersions.length}
          onToggleCommentMode={() => {
            setCommentMode((value) => !value);
            setIsCommentsPanelOpen(false);
          }}
          onOpenComments={() => setIsCommentsPanelOpen(true)}
          onOpenVersions={() => setIsVersionPanelOpen(true)}
          onOpenTheme={() => setIsThemePanelOpen(true)}
          onOpenShare={() => setIsSharePanelOpen(true)}
          handoffMode={isHandoffPanelOpen}
          onOpenHandoff={() => setIsHandoffPanelOpen((value) => !value)}
        />
      )}

      {/* Main Workspace Area (3 Columns: Left Sidebar, Canvas Stage, Right Inspector) */}
      <div className="aether-workspace-scroll flex-1 relative">
        <div className={`aether-workspace h-full flex relative ${panelsCollapsed ? '' : 'aether-workspace--expanded'}`}>
        {/* Left Sidebar (Scenes / Layers / Assets / Design / Components / AI / History) */}
        {!isFullscreenPreview && isEditing && !panelsCollapsed && (
          <LeftSidebar
            projectData={projectData}
            activeSceneId={activeSceneId}
            onSelectScene={handleSelectScene}
            onUpdateProject={handleUpdateProject}
            selectedElementId={selectedElementId}
            multiSelectedIds={multiSelectedIds}
            onSelectElement={handlePrimarySelect}
            onMultiSelectionChange={handleMultiSelectionChange}
            onSelectAll={handleSelectAllElements}
            onClearSelection={handleClearSelection}
            onNewScene={handleNewScene}
            onLoadTemplate={handleLoadTemplate}
            historyList={historyList}
            currentIndex={historyIndex}
            onJumpToHistory={handleJumpToHistory}
            onClearHistory={handleClearHistory}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            currentTime={currentTime}
            onToast={showToast}
            activeTab={leftSidebarTab}
            onTabChange={(tab) => {
              setLeftSidebarTab(tab);
              setActiveWorkspaceNav(tab as WorkspaceNavKey);
            }}
            onInsertPlugin={handleInsertOfficialPlugin}
            onAddAsset={handleAddAssetFromLibrary}
            onRenameAsset={handleRenameAssetInProject}
            assetRefreshTrigger={assetRefreshTrigger}
            onImportFiles={handleImportFilesToLibrary}
            timelineElements={Object.values(projectData.scenes).flatMap((scene) => scene.els)}
            onAddTimelineAsset={handleAddTimelineAsset}
            onMergeElements={handleMergeElements}
            onUnmergeElement={handleUnmergeElement}
            onOpen3DModal={() => openWorkTool('model3d')}
            onOpenShapePresetModal={() => setIsShapePresetModalOpen(true)}
            onOpenSaberPresetModal={() => setIsSaberPresetModalOpen(true)}
            onOpenVfxModal={() => setIsVfxModalOpen(true)}
            onOpenCardLayoutModal={() => setIsCardLayoutModalOpen(true)}
            onOpenUILibraryModal={() => setIsUILibraryModalOpen(true)}
            onOpenOfficialComponents={() => setIsOfficialComponentsOpen(true)}
            onOpenPluginCenter={() => setIsPluginCenterModalOpen(true)}
            onOpenInteractionControlsModal={() => setIsInteractionControlsModalOpen(true)}
            onOpenBackgroundRemoval={() => openWorkTool('cutout')}
            onOpenAiSceneBuilder={() => { setWorkToolMode('none'); setIsAiSceneBuilderOpen(true); }}
            onOpenCustomCodePlugin={() => handleOpenCustomCodePlugin()}
            onAddElement={handleAddElement}
            width={leftPanelWidth}
          />
        )}

        {/* 左侧面板拖拽分隔条 */}
        {!isFullscreenPreview && isEditing && !panelsCollapsed && (
          <div
            onMouseDown={(e) => startPanelResize(e, 'left')}
            title="拖动调整面板宽度"
            className="w-1.5 shrink-0 cursor-col-resize relative z-20 group/rzl"
            style={{ marginLeft: -1 }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-transparent transition-colors group-hover/rzl:bg-sky-400/50" />
          </div>
        )}

        {/* Center Canvas Viewport */}
        <div
          ref={canvasContainerRef}
          className={`flex-1 relative overflow-hidden flex ${isFullscreenPreview ? 'aether-canvas-container--preview' : 'aether-canvas-container--editor'}`}
        >
          <CanvasViewport
            projectData={projectData}
            projectHydrated={hydratedProjectId === projectId}
            activeSceneId={activeSceneId}
            onSelectScene={handleSelectScene}
            selectedElementId={selectedElementId}
            timelineEditTargetId={timelineEditTargetId}
            multiSelectedIds={multiSelectedIds}
            onSelectElement={handlePrimarySelect}
            onUpdateElement={handleUpdateElement}
            onCommitHistory={commitHistoryItem}
            onAddDrawnSaberElement={handleAddDrawnSaberElement}
            onAddDrawnShapeElement={handleAddDrawnShapeElement}
            onAddDrawnInteractionArea={handleAddDrawnInteractionArea}
            viewport={viewport}
            onUpdateViewport={setViewport}
            currentTime={currentTime}
            isPlaying={isPlaying}
            isTimelinePreview={isPlaying}
            onTogglePlay={handleTogglePlay}
            isEditing={isFullscreenPreview ? false : isEditing}
            onToggleEditing={handleToggleEditing}
            showExitPreviewButton={!IS_EXPORT_PLAYER}
            bgmAudioRef={bgmAudioRef}
            isCruising={isCruising}
            onToggleCruise={handleToggleCruise}
            autoAdvance={autoAdvance}
            onToggleAutoAdvance={handleToggleAutoAdvance}
            motionEnabled={motionEnabled}
            gestureStatus={gesture.status}
            gestureHudToggleNonce={gestureHudToggleNonce}
            onToggleMotion={handleToggleMotion}
            transitionAnimKey={transitionAnimKey}
            sceneTransitionRequest={sceneTransitionRequest}
            onSceneTransitionSnapshot={handleSceneTransitionSnapshot}
            sceneExiting={sceneExiting}
            sceneTransitionOverride={sceneTransitionOverride}
            isFullscreenPreview={isFullscreenPreview}
            onToggleFullscreenPreview={handleToggleFullscreenPreview}
            panelsCollapsed={panelsCollapsed}
            onTogglePanelsCollapsed={handleTogglePanelsCollapsed}
            onHotspotTrigger={handleHotspotTrigger}
            onVariableMutation={handleVariableMutation}
            onToast={(message) => showToast(message)}
            comments={projectData.comments}
            commentMode={commentMode}
            focusedCommentId={focusedCommentId}
            onAddComment={handleAddComment}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
            onFocusComment={setFocusedCommentId}
            handoffMode={isHandoffPanelOpen}
            selectedHotspot={selectedHotspot}
            onSelectHotspot={handleSelectHotspot}
            onDeleteHotspot={handleDeleteHotspot}
            onUpdateHotspot={handleUpdateHotspot}
            onImportMediaToCanvas={handleImportMediaToCanvas}
            onAddElement={handleAddElement}
            onRequestImportMedia={() => mediaImportInputRef.current?.click()}
            onThumbnailCaptureReady={handleThumbnailCaptureReady}
          />
          {/* 精致非侵入式体感手势浮层（紧凑胶囊 + 按需展开画中画，不遮挡时间线与面板） */}
          <MotionGestureOverlay
            motionEnabled={motionEnabled}
            projectHydrated={hydratedProjectId === projectId}
            gesture={gesture}
            activeSceneHasGesture={Boolean(activeScene?.gestureBindings && activeScene.gestureBindings.length > 0)}
            onEnableMotion={() => {
              handleUpdateProject((prev) => ({
                ...prev,
                motionInput: { ...prev.motionInput, enabled: true, sensitivity: prev.motionInput?.sensitivity ?? 1 },
              }), '开启体感交互', 'scene_update');
            }}
            onDisableMotion={() => {
              gesture.stop();
              handleUpdateProject((prev) => ({
                ...prev,
                motionInput: { ...prev.motionInput, enabled: false },
              }), '关闭体感交互', 'scene_update');
            }}
          />
        </div>

        {/* 右侧面板拖拽分隔条 */}
        {!isFullscreenPreview && isEditing && !panelsCollapsed && (
          <div
            onMouseDown={(e) => startPanelResize(e, 'right')}
            title="拖动调整面板宽度"
            className="w-1.5 shrink-0 cursor-col-resize relative z-20 group/rzr"
            style={{ marginRight: -1 }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-transparent transition-colors group-hover/rzr:bg-sky-400/50" />
          </div>
        )}

        {/* Right Inspector Panel */}
        {!isFullscreenPreview && isEditing && !panelsCollapsed && (
          <InspectorPanel
            projectData={projectData}
            activeSceneId={activeSceneId}
            selectedElementId={selectedElementId}
            onUpdateProject={handleUpdateProject}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onSelectElement={handlePrimarySelect}
            onPreviewTransition={handlePreviewTransition}
            currentTime={currentTime}
            onSeek={handleSeek}
            onOpenDrawMode={() => setViewport((v) => ({ ...v, activeTool: 'saber-draw' }))}
            onOpenMaskPenMode={() => {
              if (!selectedElementId) {
                showToast('请先选中需要添加蒙版的图层');
                return;
              }
              setViewport((v) => ({ ...v, activeTool: 'mask-pen' }));
            }}
            onOpenBackgroundRemoval={() => openWorkTool('cutout')}
            onOpenCustomCodePlugin={handleOpenCustomCodePlugin}
            selectedHotspot={selectedHotspot}
            onUpdateHotspot={handleUpdateHotspot}
            onDeleteHotspot={handleDeleteHotspot}
            onSelectHotspot={handleSelectHotspot}
            onUnmergeElement={handleUnmergeElement}
            width={rightPanelWidth}
          />
        )}
        </div>
      </div>

      {/* 时间线顶部拖拽分割线（与左右侧边栏分割线完全一致，如题图3所示） */}
      {!isFullscreenPreview && isEditing && !panelsCollapsed && (
        <div
          onPointerDown={startTimelineResize}
          onDoubleClick={toggleTimelineCollapse}
          title="拖拽调整时间线高度 (双击折叠/展开)"
          className="h-1.5 w-full shrink-0 cursor-row-resize relative z-40 group/tline-rz bg-[#0c1017] border-t border-white/[0.08] select-none"
          style={{ marginBottom: -1 }}
        >
          {/* 隐形扩展抓取热区 (上下各延伸 6px，共 18px 安全操作热区，彻底杜绝快速拖拽脱手) */}
          <div className="absolute -inset-y-1.5 inset-x-0 cursor-row-resize z-10" />

          {/* 高亮蓝线：hover 或拖拽激活时显现 */}
          <div
            className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 transition-colors ${
              isResizingTimeline
                ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)] opacity-100'
                : 'bg-transparent group-hover/tline-rz:bg-sky-400/50'
            }`}
          />

          {/* 居中拖拽把手胶囊微指示器 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <div
              className={`w-8 h-1 rounded-full transition-all duration-150 ${
                isResizingTimeline
                  ? 'bg-sky-400 scale-110 shadow-[0_0_6px_rgba(56,189,248,0.9)]'
                  : 'bg-white/20 group-hover/tline-rz:bg-sky-400/80 group-hover/tline-rz:w-10'
              }`}
            />
          </div>
        </div>
      )}

      {/* Bottom Precision Multi-Track Timeline (Only in Edit Mode and Not Fullscreen Preview) */}
      {!isFullscreenPreview && isEditing && !panelsCollapsed && (
        <div className="aether-timeline-scroll">
          <div className="aether-timeline-workspace">
            <TimelineWorkstation
              timelineHeight={timelineHeight}
              isResizingTimeline={isResizingTimeline}
              projectData={projectData}
              activeSceneId={activeSceneId}
              selectedElementId={selectedElementId}
              multiSelectedIds={multiSelectedIds}
              onSelectElement={handleTimelineSelectElement}
              onMultiSelectionChange={handleTimelineMultiSelectionChange}
              onSelectAll={handleTimelineSelectAllElements}
              onClearSelection={handleClearSelection}
              onDeleteElements={handleDeleteElements}
              onUpdateElement={handleUpdateElement}
              onCommitHistory={commitHistoryItem}
              onUpdateProject={handleUpdateProject}
              onDeleteElement={handleDeleteElement}
              onSplitElement={handleSplitElement}
              currentTime={currentTime}
              onSeek={handleSeek}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onStop={handleStop}
              isTimelineCollapsed={isTimelineCollapsed}
              onToggleTimelineCollapse={toggleTimelineCollapse}
              onMergeElements={handleMergeElements}
              onUnmergeElement={handleUnmergeElement}
              viewport={viewport}
              onUpdateViewport={setViewport}
            />
          </div>
        </div>
      )}

      {/* Preset Shape Library Modal */}
      <ShapePresetModal
        isOpen={isShapePresetModalOpen}
        onClose={() => setIsShapePresetModalOpen(false)}
        onSelectShapePreset={handleSelectShapePreset}
        onOpenCustomShapePen={() => {
          setIsShapePresetModalOpen(false);
          setViewport((v) => ({ ...v, activeTool: 'shape-draw' }));
        }}
      />

      {/* Saber Light Effect & Preset Library Modal */}
      <SaberPresetModal
        isOpen={isSaberPresetModalOpen}
        onClose={() => setIsSaberPresetModalOpen(false)}
        onSelectSaberPreset={handleSelectSaberPreset}
        onOpenDrawMode={() => {
          setIsSaberPresetModalOpen(false);
          setViewport((v) => ({ ...v, activeTool: 'saber-draw' }));
        }}
      />

      {/* 科技简约特效库 Modal（VFX Presets，拖入即用） */}
      {isVfxModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <VfxPresetModal
            isOpen
            onClose={() => setIsVfxModalOpen(false)}
            onSelectVfxPreset={handleSelectVfxPreset}
          />
        </React.Suspense>
      )}

      {/* 3D Parallax Layer Generator Modal */}
      <ThreeDLayerModal
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        onAdd3DLayers={handleAdd3DLayers}
        sceneDuration={activeScene?.duration || 10}
        onError={(message) => showToast(message, 'error')}
      />

      {isCardLayoutModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <CardLayoutPresetModal
            isOpen
            onClose={() => setIsCardLayoutModalOpen(false)}
            onSelect={(motion, colorA, colorB, speed, params) => {
              handleSelectVfxPreset(motion, colorA, colorB, speed, params);
              setIsCardLayoutModalOpen(false);
            }}
          />
        </React.Suspense>
      )}

      {/* AI 图片转 3D 模型生成器 */}
      {isAiModel3DModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <AiModel3DModal
            isOpen
            onClose={() => setIsAiModel3DModalOpen(false)}
            onAddModel3D={handleAddModel3D}
            sceneDuration={activeScene?.duration || 10}
          />
        </React.Suspense>
      )}

      {/* Galaxy UI 组件库：包含原有 UI、图表、仪表盘和专业看板组件 */}
      {isUILibraryModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <UILibraryModal
            isOpen
            onClose={() => setIsUILibraryModalOpen(false)}
            excludedCategories={['交互控件']}
            categoryOverrides={DASHBOARD_COMPONENT_CATEGORIES}
            customPlugins={embeddedDashboardPlugins}
            customPluginSectionTitle="专业看板"
            onOpenCustomCodePlugin={() => {
              setIsUILibraryModalOpen(false);
              handleOpenCustomCodePlugin();
            }}
            onInsertCustomPlugin={handleInsertCustomCodePlugin}
            onInsert={handleInsertUiComponent}
          />
        </React.Suspense>
      )}
      {isOfficialComponentsOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <OfficialComponentsModal
            isOpen
            onClose={() => setIsOfficialComponentsOpen(false)}
            onInsert={handleInsertUiComponent}
            onOpenCustomCodePlugin={() => handleOpenCustomCodePlugin()}
            customCodeLibrary={customCodeLibrary}
            onInsertCustomCodeLibrary={handleInsertCustomCodeLibrary}
            onDeleteCustomCodeLibrary={handleDeleteCustomCodeLibrary}
            onInsertPlugin={handleInsertOfficialPlugin}
          />
        </React.Suspense>
      )}
      {isInteractionControlsModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <UILibraryModal
            isOpen
            onClose={() => setIsInteractionControlsModalOpen(false)}
            title="交互控件库"
            description="多段连续交互控件，支持节点、触发动作与场景弹窗配置"
            includedCategories={['交互控件']}
            onInsert={handleInsertUiComponent}
          />
        </React.Suspense>
      )}
      {isPluginCenterModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <PluginCenterModal
            isOpen
            onClose={() => setIsPluginCenterModalOpen(false)}
            onInsert={handleInsertOfficialPlugin}
          />
        </React.Suspense>
      )}
      {isAiSceneBuilderOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <AiSceneBuilderModal
            isOpen
            onClose={() => {
              setIsAiSceneBuilderOpen(false);
              setWorkToolMode('none');
              setCustomCodeEditElementId(null);
            }}
            projectData={projectData}
            projectId={projectId}
            activeSceneId={activeSceneId}
            onApply={handleApplyAiSceneProposal}
            onUndo={handleUndo}
            canUndo={canUndo}
            onUpdateProject={handleUpdateProject}
            toolMode={workToolMode}
            onToolModeChange={setWorkToolMode}
            onLoadPresetDemo={() => handleLoadTemplate('default')}
            toolPanel={workToolMode === 'model3d' ? (
              <React.Suspense fallback={<ModalLoadingFallback />}>
                <AiModel3DModal
                  isOpen
                  embedded
                  onClose={() => setWorkToolMode('none')}
                  onAddModel3D={handleAddModel3D}
                  sceneDuration={activeScene?.duration || 10}
                />
              </React.Suspense>
            ) : workToolMode === 'cutout' ? (
              <AiBackgroundRemovalModal
                isOpen
                embedded
                onClose={() => setWorkToolMode('none')}
                onInsert={handleInsertBackgroundRemovedAsset}
                onLoadPresetDemo={() => handleLoadTemplate('default')}
              />
            ) : workToolMode === 'custom-code' ? (
              <React.Suspense fallback={<ModalLoadingFallback />}>
                <CustomCodePluginModal
                  isOpen
                  embedded
                  onClose={() => {
                    setWorkToolMode('none');
                    setCustomCodeEditElementId(null);
                  }}
                  initialPlugin={customCodeEditElementId ? activeScene?.els.find((element) => element.id === customCodeEditElementId)?.customCode : undefined}
                  onExport={handleExportCustomCodePlugin}
                  historyItems={customCodeLibrary}
                  onInsertHistory={handleInsertCustomCodeLibrary}
                  onDeleteHistory={handleDeleteCustomCodeLibrary}
                />
              </React.Suspense>
            ) : null}
          />
        </React.Suspense>
      )}
      {isCustomCodePluginOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <CustomCodePluginModal
            isOpen
            onClose={() => { setIsCustomCodePluginOpen(false); setCustomCodeEditElementId(null); }}
            initialPlugin={customCodeEditElementId ? activeScene?.els.find((element) => element.id === customCodeEditElementId)?.customCode : undefined}
            onExport={handleExportCustomCodePlugin}
            historyItems={customCodeLibrary}
            onInsertHistory={handleInsertCustomCodeLibrary}
            onDeleteHistory={handleDeleteCustomCodeLibrary}
          />
        </React.Suspense>
      )}
      <AiBackgroundRemovalModal
        isOpen={isAiBackgroundRemovalOpen}
        onClose={() => setIsAiBackgroundRemovalOpen(false)}
        onInsert={handleInsertBackgroundRemovedAsset}
        onLoadPresetDemo={() => handleLoadTemplate('default')}
      />
      <TemplateCenterModal
        isOpen={isTemplateCenterModalOpen}
        onClose={() => setIsTemplateCenterModalOpen(false)}
        projectData={projectData}
        onLoadTemplate={handleLoadTemplate}
      />
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        items={globalSearchItems}
        onClose={() => setIsGlobalSearchOpen(false)}
      />
      {/* Export Standalone Modal */}
      {isExportModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <ExportModal
            isOpen
            onClose={() => setIsExportModalOpen(false)}
            projectData={projectData}
            onError={(message) => showToast(message, 'error')}
            onRequestActivation={() => setIsLicenseActivationOpen(true)}
            onRequestFreeExperience={() => setIsFreeExperienceOpen(true)}
          />
        </React.Suspense>
      )}

      {/* Advanced Export Modal (P2 导出层：图片/视频/HTML) */}
      {isAdvancedExportModalOpen && (
        <React.Suspense fallback={<ModalLoadingFallback />}>
          <AdvancedExportModal
            isOpen
            onClose={() => setIsAdvancedExportModalOpen(false)}
            projectData={projectData}
            activeSceneId={activeSceneId}
            isPaid={isPaid}
            plan={plan}
            canvasContainerRef={canvasContainerRef}
            currentTime={currentTime}
            onSeek={handleSeek}
            onSelectSceneForExport={(sceneId) => {
              commitSelectScene(sceneId, { enterAnim: 'none', exitAnim: 'none', duration: 0 });
            }}
            onPrepareExport={() => {
              const resumePlayback = isPlaying;
              const restoreSceneId = activeSceneId;
              setIsPlaying(false);
              return () => {
                if (projectData.scenes[restoreSceneId]) {
                  commitSelectScene(restoreSceneId, { enterAnim: 'none', exitAnim: 'none', duration: 0 });
                }
                if (resumePlayback) setIsPlaying(true);
              };
            }}
            onRequestActivation={() => setIsLicenseActivationOpen(true)}
            onRequestStandardExport={() => {
              setIsAdvancedExportModalOpen(false);
              setIsExportModalOpen(true);
            }}
          />
        </React.Suspense>
      )}

      <LicenseActivationModal
        isOpen={isLicenseActivationOpen}
        onClose={() => setIsLicenseActivationOpen(false)}
        onActivated={() => setIsLicenseActivationOpen(false)}
      />
      <FreeExperienceModal
        isOpen={isFreeExperienceOpen}
        onClose={() => setIsFreeExperienceOpen(false)}
      />

      {/* Project Manager Modal (工程管理：新建/打开/删除/重命名) */}
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        currentProjectId={projectId}
        onOpenProject={handleOpenProject}
        onNewProject={handleNewBlankProject}
        onImportProject={handleImportFile}
      />

      {/* 【工程级画布】新建空白工程时选择播放媒介比例 */}
      <CanvasSetupModal
        isOpen={isCanvasSetupOpen}
        onClose={() => setIsCanvasSetupOpen(false)}
        onCreate={confirmNewBlankProject}
      />

      {/* 命名版本存档 */}
      <VersionHistoryPanel
        isOpen={isVersionPanelOpen}
        onClose={() => setIsVersionPanelOpen(false)}
        projectName={projectData.meta?.title}
        versions={projectVersions}
        onSave={handleSaveVersion}
        onRestore={handleRestoreVersion}
        onDelete={handleDeleteVersion}
      />

      {/* 设计主题 */}
      <ThemePanel
        isOpen={isThemePanelOpen}
        onClose={() => setIsThemePanelOpen(false)}
        theme={projectData.theme}
        onSave={handleSaveTheme}
        onApply={handleApplyTheme}
        onExtract={handleExtractTheme}
      />

      {/* 分享交付 */}
      <ShareModal
        isOpen={isSharePanelOpen}
        onClose={() => setIsSharePanelOpen(false)}
        projectData={projectData}
      />

      {/* 交付标注 / 开发交接 */}
      {isHandoffPanelOpen && (
        <HandoffPanel
          isOpen
          onClose={() => setIsHandoffPanelOpen(false)}
          project={projectData}
          scene={activeScene || null}
          selectedElement={multiSelectedIds.length > 1 ? null : (activeScene?.els.find((element) => element.id === selectedElementId) || null)}
          canvas={getProjectCanvas(projectData)}
          multiSelectedCount={multiSelectedIds.length}
          onCaptureStage={handleCaptureHandoffStage}
        />
      )}

      {/* 评论与评审 */}
      <CommentsPanel
        isOpen={isCommentsPanelOpen}
        onClose={() => setIsCommentsPanelOpen(false)}
        comments={projectData.comments || []}
        scenes={projectData.scenes}
        activeSceneId={activeSceneId}
        onFocus={handleFocusComment}
        onUpdate={handleUpdateComment}
        onDelete={handleDeleteComment}
        onStartComment={() => {
          setIsCommentsPanelOpen(false);
          setCommentMode(true);
        }}
      />

      {/* Onboarding Guide (新手引导) */}
      <OnboardingGuide
        isOpen={isOnboardingOpen && !isProjectManagerOpen && !isCanvasSetupOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => markOnboardingCompleted()}
      />

      {/* Error Recovery (错误恢复) */}
      <ErrorRecoveryModal
        isOpen={isErrorRecoveryOpen}
        onClose={() => setIsErrorRecoveryOpen(false)}
        onRecover={(backup) => {
          handleOpenProject(backup.projectId, backup.projectData);
        }}
        onReset={handleNewBlankProject}
      />

      {/* Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Floating / Popover History Panel */}
      {isHistoryModalOpen && (
        <div 
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center sm:justify-end p-4 sm:pr-8 animate-in fade-in duration-150"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div 
            className="w-full max-w-md h-[82vh] shadow-2xl rounded-2xl overflow-hidden border border-white/10 animate-in slide-in-from-right-8 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <HistoryPanel
              historyList={historyList}
              currentIndex={historyIndex}
              onJumpToHistory={handleJumpToHistory}
              onClearHistory={handleClearHistory}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onClose={() => setIsHistoryModalOpen(false)}
              isFloating
            />
          </div>
        </div>
      )}

      {/* Floating Action / Toast Notification */}
      {toastMessage && (
        <FriendlyErrorToast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* 热点媒体弹窗（+号跟踪点关联的图片/视频查看器） */}
      {activeMediaHotspot && (() => {
        // 计算弹窗位置样式
        const getPositionStyle = (): React.CSSProperties => {
          const pos = activeMediaHotspot.popupPosition || 'center';
          switch (pos) {
            case 'top-left': return { alignItems: 'flex-start', justifyContent: 'flex-start', padding: '24px' };
            case 'top-right': return { alignItems: 'flex-start', justifyContent: 'flex-end', padding: '24px' };
            case 'bottom-left': return { alignItems: 'flex-end', justifyContent: 'flex-start', padding: '24px' };
            case 'bottom-right': return { alignItems: 'flex-end', justifyContent: 'flex-end', padding: '24px' };
            case 'custom': return {
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              padding: 0,
            };
            default: return { alignItems: 'center', justifyContent: 'center', padding: '16px' };
          }
        };

        // 计算弹窗大小样式
        const getSizeStyle = (): React.CSSProperties => getRuntimePopupSizeStyle(activeMediaHotspot);

        // 计算自定义位置偏移
        const getCustomOffset = (): React.CSSProperties => {
          if (activeMediaHotspot.popupPosition !== 'custom') return {};
          return {
            marginLeft: `${activeMediaHotspot.popupX || 50}vw`,
            marginTop: `${activeMediaHotspot.popupY || 50}vh`,
            transform: 'translate(-50%, -50%)',
          };
        };

        // 生成动画类名
        const getAnimationClass = (): string => {
          const anim = activeMediaHotspot.animationType || 'fadeIn';
          const duration = activeMediaHotspot.animationDuration || 300;
          const base = 'animate-in duration-';
          switch (anim) {
            case 'none': return '';
            case 'fadeIn': return `${base}${duration} fade-in`;
            case 'slideUp': return `${base}${duration} fade-in slide-in-from-bottom-4`;
            case 'slideDown': return `${base}${duration} fade-in slide-in-from-top-4`;
            case 'slideLeft': return `${base}${duration} fade-in slide-in-from-right-4`;
            case 'slideRight': return `${base}${duration} fade-in slide-in-from-left-4`;
            case 'zoomIn': return `${base}${duration} fade-in zoom-in-95`;
            case 'zoomOut': return `${base}${duration} fade-in zoom-in-105`;
            case 'bounce': return `${base}${duration} fade-in zoom-in-95`;
            case 'rotate': return `${base}${duration} fade-in`;
            default: return `${base}${duration} fade-in`;
          }
        };

        const closeOnOverlay = activeMediaHotspot.popupCloseOnOverlay ?? true;
        const mediaDisplay = activeMediaHotspot.popupDisplay || 'modal';
        const mediaTheme = normalizePopupTheme(activeMediaHotspot.popupTheme);
        const mediaRatio = activeMediaHotspot.popupRatio === 'free'
          ? undefined
          : resolvePopupAspectRatio(activeMediaHotspot);

        return (
          <div
            className={`fixed inset-0 z-[200] flex ${getAnimationClass()} ${mediaDisplay === 'modal' ? 'bg-black/85 backdrop-blur-sm' : 'pointer-events-none'}`}
            style={{
              ...getPositionStyle(),
              backgroundColor: mediaDisplay === 'modal' ? `rgba(0,0,0,${activeMediaHotspot.popupOverlayOpacity ?? 0.85})` : 'transparent',
              backdropFilter: mediaDisplay === 'modal' ? `blur(${activeMediaHotspot.popupOverlayBlur ?? 12}px)` : undefined,
              WebkitBackdropFilter: mediaDisplay === 'modal' ? `blur(${activeMediaHotspot.popupOverlayBlur ?? 12}px)` : undefined,
            }}
            onClick={() => {
              if (mediaDisplay === 'modal' && closeOnOverlay) {
                setActiveMediaHotspot(null);
                setImgViewerScale(1);
                setImgViewerOffset({ x: 0, y: 0 });
              }
            }}
          >
            <div
              className={`relative flex flex-col items-center pointer-events-auto overflow-hidden popup-theme-popup popup-theme-${mediaTheme}`}
              style={{ ...getSizeStyle(), ...getCustomOffset(), borderRadius: `${activeMediaHotspot.popupRadius ?? 14}px`, background: activeMediaHotspot.popupBgColor || undefined, border: activeMediaHotspot.popupBorderColor ? `1px solid ${activeMediaHotspot.popupBorderColor}` : undefined, boxShadow: activeMediaHotspot.popupGlowColor ? `0 18px 50px rgba(0,0,0,.55), 0 0 36px ${activeMediaHotspot.popupGlowColor}66` : undefined, ['--popup-accent' as string]: activeMediaHotspot.popupAccentColor || undefined }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* 标题栏 */}
            <div className="hidden w-full flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  activeMediaHotspot.mediaType === 'video' ? 'bg-rose-500/20 text-rose-300' : 'bg-sky-500/20 text-sky-300'
                }`}>
                  {activeMediaHotspot.mediaType === 'video' ? '视频' : '图片'}
                </span>
                <span className="text-sm font-medium truncate" style={{ color: activeMediaHotspot.popupTitleColor || '#cbd5e1' }}>
                  {activeMediaHotspot.label || (activeMediaHotspot.mediaType === 'video' ? '视频文件' : '图片文件')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveMediaHotspot(null);
                  setImgViewerScale(1);
                  setImgViewerOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                title="关闭 (ESC)"
              >
                <X size={18} />
              </button>
            </div>
            {/* 媒体内容 */}
            {activeMediaHotspot.popupTitle?.trim() && (
              <div className="absolute top-3 left-4 z-10 popup-theme-title" style={{ color: activeMediaHotspot.popupTitleColor || '#fff' }}>
                {activeMediaHotspot.popupTitle.trim()}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveMediaHotspot(null);
                setImgViewerScale(1);
                setImgViewerOffset({ x: 0, y: 0 });
              }}
              className="popup-theme-close absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/35 hover:bg-black/60 text-white transition-colors"
              title="关闭 (ESC)"
            >
              <X size={18} />
            </button>
            <div
              className="w-full flex items-center justify-center overflow-hidden bg-black relative"
              style={{ maxHeight: 'calc(90vh - 88px)', minHeight: '300px', aspectRatio: mediaRatio }}
            >
              {mediaUrl ? (
                activeMediaHotspot.mediaType === 'video' ? (
                  <video
                    src={mediaUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
                    onWheel={(e) => {
                      const delta = e.deltaY > 0 ? -0.15 : 0.15;
                      setImgViewerScale((s) => Math.min(5, Math.max(0.5, +(s + delta).toFixed(2))));
                    }}
                    onMouseDown={(e) => {
                      if (imgViewerScale <= 1) return;
                      imgViewerDragRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: imgViewerOffset.x,
                        origY: imgViewerOffset.y,
                      };
                    }}
                    onMouseMove={(e) => {
                      if (!imgViewerDragRef.current) return;
                      const dx = e.clientX - imgViewerDragRef.current.startX;
                      const dy = e.clientY - imgViewerDragRef.current.startY;
                      setImgViewerOffset({
                        x: imgViewerDragRef.current.origX + dx,
                        y: imgViewerDragRef.current.origY + dy,
                      });
                    }}
                    onMouseUp={() => { imgViewerDragRef.current = null; }}
                    onMouseLeave={() => { imgViewerDragRef.current = null; }}
                    onDoubleClick={() => {
                      setImgViewerScale(1);
                      setImgViewerOffset({ x: 0, y: 0 });
                    }}
                  >
                    <img
                      src={mediaUrl}
                      alt={activeMediaHotspot.label || '热点媒体'}
                      className="w-full h-full object-cover transition-transform duration-75"
                      style={{
                        transform: `translate(${imgViewerOffset.x}px, ${imgViewerOffset.y}px) scale(${imgViewerScale})`,
                      }}
                      draggable={false}
                    />
                  </div>
                )
              ) : (
                <div className="p-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
                  <span>加载中...</span>
                </div>
              )}
              {/* 图片查看器缩放比例提示 */}
              {activeMediaHotspot.mediaType === 'image' && mediaUrl && imgViewerScale !== 1 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur rounded-full text-xs text-white font-mono">
                  {Math.round(imgViewerScale * 100)}%
                </div>
              )}
            </div>
            {/* 底部工具栏 */}
            {mediaUrl && (
              <div className="w-full flex items-center justify-center px-4 pt-3 pb-4 bg-black/35 border-t border-white/10">
                <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] p-1 shadow-inner shadow-black/30">
                  {activeMediaHotspot.mediaType === 'image' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setImgViewerScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                        className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 transition-colors"
                        title="缩小"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-xs text-slate-400 font-mono w-12 text-center">
                        {Math.round(imgViewerScale * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setImgViewerScale((s) => Math.min(5, +(s + 0.25).toFixed(2)))}
                        className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 transition-colors"
                        title="放大"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImgViewerScale(1);
                          setImgViewerOffset({ x: 0, y: 0 });
                        }}
                        className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 text-slate-300 transition-colors ml-1"
                        title="重置视图 (双击)"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </>
                  )}
                  <span className="hidden text-xs text-slate-500 ml-2">
                    {activeMediaHotspot.mediaType === 'image' ? '滚轮缩放 · 拖拽平移 · 双击重置' : '视频循环播放中'}
                  </span>
                </div>
                <a
                  href={mediaUrl}
                  download={activeMediaHotspot.label || (activeMediaHotspot.mediaType === 'video' ? 'media.mp4' : 'media.jpg')}
                  className="hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-medium transition-colors"
                  title="下载原始文件"
                >
                  <Download size={14} />
                  下载
                </a>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* 场景预览弹窗（popup 类型热点点击后弹出，用户可选择进入或关闭） */}
      {popupScene && popupPreview && (
        <div
          className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${popupSceneConfig?.popupDisplay === 'modal' || !popupSceneConfig?.popupDisplay ? 'bg-black/80 backdrop-blur-sm' : 'pointer-events-none'} ${popupSceneConfig?.popupAnimationType === 'none' ? '' : popupSceneConfig?.popupAnimationType === 'slideUp' ? 'animate-in fade-in slide-in-from-bottom-4' : popupSceneConfig?.popupAnimationType === 'slideDown' ? 'animate-in fade-in slide-in-from-top-4' : popupSceneConfig?.popupAnimationType === 'slideLeft' ? 'animate-in fade-in slide-in-from-right-4' : popupSceneConfig?.popupAnimationType === 'slideRight' ? 'animate-in fade-in slide-in-from-left-4' : popupSceneConfig?.popupAnimationType === 'zoomOut' ? 'animate-in fade-in zoom-in-105' : popupSceneConfig?.popupAnimationType === 'bounce' ? 'animate-in fade-in zoom-in-95' : popupSceneConfig?.popupAnimationType === 'rotate' ? 'animate-in fade-in' : 'animate-in fade-in zoom-in-95'}`}
          style={{
            backgroundColor: popupSceneConfig?.popupDisplay === 'modal' || !popupSceneConfig?.popupDisplay ? `rgba(0,0,0,${popupSceneConfig?.popupOverlayOpacity ?? 0.8})` : 'transparent',
            backdropFilter: popupSceneConfig?.popupDisplay === 'modal' || !popupSceneConfig?.popupDisplay ? `blur(${popupSceneConfig?.popupOverlayBlur ?? 24}px)` : undefined,
            WebkitBackdropFilter: popupSceneConfig?.popupDisplay === 'modal' || !popupSceneConfig?.popupDisplay ? `blur(${popupSceneConfig?.popupOverlayBlur ?? 24}px)` : undefined,
            animationDuration: `${popupSceneConfig?.popupAnimationDuration ?? 300}ms`,
            alignItems: popupSceneConfig?.popupPosition?.startsWith('bottom') ? 'flex-end' : popupSceneConfig?.popupPosition?.startsWith('top') ? 'flex-start' : 'center',
            justifyContent: popupSceneConfig?.popupPosition?.endsWith('left') ? 'flex-start' : popupSceneConfig?.popupPosition?.endsWith('right') ? 'flex-end' : 'center',
            padding: popupSceneConfig?.popupPosition === 'custom' ? 0 : 16,
          }}
          onClick={() => { if ((popupSceneConfig?.popupDisplay === 'modal' || !popupSceneConfig?.popupDisplay) && (popupSceneConfig?.popupCloseOnOverlay ?? true)) setPopupSceneId(null); }}
        >
          <div
            className={`relative w-full overflow-hidden border shadow-2xl popup-theme-popup popup-theme-${normalizePopupTheme(popupSceneConfig?.popupTheme)} ${popupSceneConfig?.popupDisplay === 'popover' ? 'popup-popover-card' : popupSceneConfig?.popupDisplay === 'inline' ? 'popup-inline-card' : ''}`}
            style={{
              ...getRuntimePopupSizeStyle(popupSceneConfig || {}),
              borderRadius: `${popupSceneConfig?.popupRadius ?? 16}px`,
              borderColor: popupSceneConfig?.popupBorderColor || 'rgba(255,255,255,0.1)',
              backgroundColor: popupSceneConfig?.popupBgColor || 'rgba(15,23,42,0.95)',
              boxShadow: popupSceneConfig?.popupGlowColor ? `0 18px 50px rgba(0,0,0,0.55), 0 0 36px ${popupSceneConfig.popupGlowColor}66` : undefined,
              animationDuration: `${popupSceneConfig?.popupAnimationDuration ?? 300}ms`,
              pointerEvents: 'auto',
              ['--popup-accent' as string]: popupSceneConfig?.popupAccentColor || undefined,
              ...(popupSceneConfig?.popupPosition === 'custom' ? {
                position: 'absolute',
                left: `${popupSceneConfig.popupX ?? 50}%`,
                top: `${popupSceneConfig.popupY ?? 50}%`,
                transform: 'translate(-50%, -50%)',
              } : {}),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 预览图区域 */}
            <div
              className={`relative w-full overflow-hidden ${popupSceneConfig?.popupRatio === 'free' ? 'h-full' : ''}`}
              style={{
                backgroundColor: popupPreview.bgColor,
                aspectRatio: popupSceneConfig?.popupRatio === 'free'
                  ? undefined
                  : resolvePopupAspectRatio(popupSceneConfig || {}),
              }}
            >
              {resolvePopupSceneAsset(popupPreview.previewUrl) && popupPreview.previewType === 'video' ? (
                <video
                  src={resolvePopupSceneAsset(popupPreview.previewUrl)}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : resolvePopupSceneAsset(popupPreview.previewUrl) ? (
                <img
                  src={resolvePopupSceneAsset(popupPreview.previewUrl)}
                  alt={popupPreview.title}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="absolute inset-0 overflow-hidden">
                  {renderPopupSceneElements(popupScene)}
                  {(popupScene.els || []).length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">暂无预览内容</div>}
                </div>
              )}
              {/* 渐变遮罩 */}
              <div className="hidden absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* 场景标题 */}
              {popupSceneConfig?.popupTitle?.trim() && (
              <div className="absolute bottom-4 left-5 right-5">
                <h3 className="text-xl font-bold drop-shadow-lg" style={{ color: popupSceneConfig?.popupTitleColor || '#fff' }}>
                  {popupSceneConfig.popupTitle.trim()}
                </h3>
                <p className="text-white/70 text-xs mt-1">点击下方按钮进入该场景</p>
              </div>
              )}
              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={() => setPopupSceneId(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm"
                title="关闭 (ESC)"
              >
                <X size={18} />
              </button>
              {/* popup 标签 */}
              <div className="hidden absolute top-3 left-3 px-2.5 py-1 rounded-full bg-sky-500/80 text-white text-xs font-medium backdrop-blur-sm">
                场景预览
              </div>
            </div>
            {/* 底部操作栏 */}
            <div className="hidden flex items-center justify-between px-5 py-4 bg-slate-900/80">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <span>场景 ID: {popupScene.id}</span>
                <span className="text-slate-600">·</span>
                <span>时长: {popupScene.duration?.toFixed(1) || '—'}s</span>
                <span className="text-slate-600">·</span>
                <span>元素: {popupScene.els?.length || 0}个</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPopupSceneId(null)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectScene(popupScene.id);
                    setPopupSceneId(null);
                  }}
                  className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-sky-500/30"
                >
                  进入场景
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importProgress && (
        <div className="fixed top-16 right-4 z-[11000] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-sky-400/30 bg-slate-950/95 p-3 text-slate-100 shadow-xl" role="status" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold">正在导入 {importProgress.current}/{importProgress.total}</div>
              <div className="mt-1 truncate text-[11px] text-slate-400" title={importProgress.fileName}>{importProgress.fileName || '准备文件…'}</div>
              <div className="mt-2 h-1 overflow-hidden rounded bg-white/10" role="progressbar" aria-label="素材导入进度" aria-valuemin={0} aria-valuemax={importProgress.total} aria-valuenow={importProgress.current}>
                <div className="h-full bg-sky-400 transition-[width]" style={{ width: `${Math.round(importProgress.current / importProgress.total * 100)}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-slate-500">停止后续导入会在当前文件处理完成后生效。</div>
            </div>
            <button type="button" onClick={() => { cancelImportRef.current = true; }} className="shrink-0 rounded border border-white/15 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">停止后续导入</button>
          </div>
        </div>
      )}
    </div>
  );
}
