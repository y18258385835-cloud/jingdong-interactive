/**
 * 素材库面板
 * 左侧面板的"素材"Tab内容
 * 已上传素材分类展示、搜索、删除、拖拽到画布
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon, Video, Music, Box, Globe, Search,
  Trash2, Upload, FolderOpen, AlertCircle, FileText, LayoutGrid,
  Eye, Plus, RefreshCw, Pencil, Download, Copy, X,
} from 'lucide-react';
import { dbManager, AssetMetadata } from '../utils/db';
import { SceneElement } from '../types';

interface AssetLibraryPanelProps {
  /** 添加素材到画布（拖拽或点击时触发） */
  onAddAsset?: (assetKey: string, assetType: AssetType) => void;
  /** 素材重命名后同步更新工程中引用该素材的时间线图层。 */
  onRenameAsset?: (assetKey: string, name: string) => void;
  /** 刷新触发器（外部上传新素材后触发刷新） */
  refreshTrigger?: number;
  /** 面板拖入外部文件：仅入库（不自动添加到画布） */
  onImportFiles?: (files: File[]) => Promise<{ imported: number; skipped: number }> | void;
  /** 时间线素材引用，保证没有独立 Blob 的过程化 3D 也能显示在素材库。 */
  timelineElements?: SceneElement[];
  /** 添加没有独立二进制文件的项目素材（例如 img2threejs 过程化模型）。 */
  onAddTimelineAsset?: (element: SceneElement) => void;
  /** Includes scene and timeline references so deleting a library item cannot break an active project. */
  referencedAssetKeys?: string[];
}

export type AssetType = 'image' | 'video' | 'audio' | '3d' | 'gaussian-splat' | 'panorama' | 'panorama-video' | 'other';

interface AssetItem {
  key: string;
  name: string;
  type: AssetType;
  size: number;
  url?: string;
  blob?: Blob;
  metadata?: AssetMetadata | null;
  timelineElement?: SceneElement;
}

type AssetPanelNotice = {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

// 根据文件扩展名和MIME类型判断素材类型
function detectAssetType(key: string, blob?: Blob): AssetType {
  const lowerKey = key.toLowerCase();
  const mime = blob?.type?.toLowerCase() || '';

  // 高斯泼溅（PLY/SPLAT 文件经常没有标准 MIME）
  if (lowerKey.endsWith('.ply') || lowerKey.endsWith('.splat') || /gaussian|splat/.test(lowerKey)) {
    return 'gaussian-splat';
  }
  // 3D模型
  if (lowerKey.endsWith('.glb') || lowerKey.endsWith('.gltf') || mime.includes('model/')) {
    return '3d';
  }
  // 全景图（通常是equirectangular格式，文件名可能包含pano/360）
  if (lowerKey.includes('pano') || lowerKey.includes('360') || lowerKey.includes('equirect')) {
    if (mime.startsWith('video/')) return 'panorama-video';
    if (mime.startsWith('image/')) return 'panorama';
  }
  // 视频
  if (mime.startsWith('video/') || lowerKey.match(/\.(mp4|webm|mov|avi|mkv)$/)) {
    return 'video';
  }
  // 音频
  if (mime.startsWith('audio/') || lowerKey.match(/\.(mp3|wav|ogg|flac|aac)$/)) {
    return 'audio';
  }
  // 图片
  if (mime.startsWith('image/') || lowerKey.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/)) {
    return 'image';
  }
  return 'other';
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 素材类型配置
const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  image: { label: '图片', icon: <ImageIcon size={14} />, color: 'text-sky-400', bgColor: 'bg-sky-500/15' },
  video: { label: '视频', icon: <Video size={14} />, color: 'text-rose-400', bgColor: 'bg-rose-500/15' },
  audio: { label: '音频', icon: <Music size={14} />, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15' },
  '3d': { label: '3D模型', icon: <Box size={14} />, color: 'text-purple-400', bgColor: 'bg-purple-500/15' },
  'gaussian-splat': { label: '高斯泼溅', icon: <Box size={14} />, color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/15' },
  panorama: { label: '全景', icon: <Globe size={14} />, color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
  'panorama-video': { label: 'VR全景视频', icon: <Globe size={14} />, color: 'text-orange-400', bgColor: 'bg-orange-500/15' },
  other: { label: '其他', icon: <FileText size={14} />, color: 'text-slate-400', bgColor: 'bg-slate-500/15' },
};

/**
 * 同一过程化模型可被复制到多个时间线图层，但它们仍是同一个素材。
 * 使用模型代码、纹理和来源得到稳定标识，绝不使用图层 id。
 */
function getProjectAssetKey(element: SceneElement): string {
  if (element.refId) return element.refId;
  const source = `${element.ai3dCodeSource || ''}\u0000${element.ai3dCode || ''}\u0000${element.ai3dTexture || ''}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `project-model:${(hash >>> 0).toString(36)}`;
}

// Canvas transforms update the whole timeline array on every pointer frame.
// The asset library only needs to reload when project-only asset identities
// change; video/image position changes must not restart IndexedDB enumeration.
function getTimelineAssetSignature(elements: SceneElement[]) {
  return elements
    .filter((element) => element.type === 'model-3d' || element.type === 'gaussian-splat')
    .map((element) => `${getProjectAssetKey(element)}\u0000${element.sourceName || ''}`)
    .sort()
    .join('\u001f');
}

function getAssetFingerprint(key: string, blob?: Blob, metadata?: AssetMetadata | null): string {
  if (metadata?.fingerprint) return metadata.fingerprint;
  return `${metadata?.originalName || metadata?.name || key}\u0000${blob?.size || 0}\u0000${blob?.type || ''}`;
}

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({
  onAddAsset,
  onRenameAsset,
  refreshTrigger = 0,
  onImportFiles,
  timelineElements = [],
  onAddTimelineAsset,
  referencedAssetKeys = [],
}) => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<AssetType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  // 剪映式素材多选：Ctrl/Cmd 追加、Shift 范围选择、Ctrl+A 全选、Delete 批量删除
  const [multiSelectedKeys, setMultiSelectedKeys] = useState<string[]>([]);
  const [lastClickedKey, setLastClickedKey] = useState<string | null>(null);
  const [isPanelDragOver, setIsPanelDragOver] = useState(false);
  const [isPanelImporting, setIsPanelImporting] = useState(false);
  // 右键上传菜单：在素材窗口右键可选择上传各类型素材（仅入库到素材库）
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxImgRef = useRef<HTMLInputElement>(null);
  const ctxVidRef = useRef<HTMLInputElement>(null);
  const ctxAudRef = useRef<HTMLInputElement>(null);
  const ctxModelRef = useRef<HTMLInputElement>(null);
  const ctxPanoRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // 单个素材右键操作菜单
  const [assetCtxMenu, setAssetCtxMenu] = useState<{ x: number; y: number; asset: AssetItem } | null>(null);
  // 素材预览弹窗
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  // 替换素材
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  // 重命名素材
  const [renameState, setRenameState] = useState<{ key: string; name: string } | null>(null);
  const [notice, setNotice] = useState<AssetPanelNotice | null>(null);
  const noticeTimerRef = useRef<any>(null);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const timelineElementsRef = useRef(timelineElements);
  timelineElementsRef.current = timelineElements;
  const timelineAssetSignature = getTimelineAssetSignature(timelineElements);
  const showNotice = useCallback((type: AssetPanelNotice['type'], message: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ type, message });
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 4500);
  }, []);
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [ctxMenu]);
  const handleLibraryContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };
  const handleCtxFileChosen = (input: HTMLInputElement | null) => {
    if (!input || !input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    input.value = '';
    setCtxMenu(null);
    onImportFiles?.(files);
  };
  const handleImportCardChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) void onImportFiles?.(files);
  };
  // 素材缩略图尺寸：small=3列 / medium=2列 / large=1列（面板变宽时可放大预览图）
  const [thumbSize, setThumbSize] = useState<'small' | 'medium' | 'large'>(() => {
    const v = localStorage.getItem('aether_asset_thumb');
    return v === 'small' || v === 'large' ? v : 'medium';
  });
  const gridCols = thumbSize === 'small' ? 'grid-cols-3' : thumbSize === 'large' ? 'grid-cols-1' : 'grid-cols-2';

  // 加载素材列表
  const loadAssets = useCallback(async () => {
    // Keep an already rendered list visible during refresh. Clearing it first
    // creates a white/empty flash while large video blobs are enumerated.
    setIsLoading((current) => current || assetsRef.current.length === 0);
    try {
      const keys = await dbManager.getAllKeys();
      const assetItems: AssetItem[] = [];
      const processedKeys = new Set<string>();
      const processedFingerprints = new Set<string>();

      for (const key of keys) {
        try {
          // Metadata is enough to render the library. Avoid reading every
          // video Blob during a refresh; the thumbnail loads its bytes only
          // after it enters the viewport.
          const metadata = await dbManager.getMetadata(key);
          const needsBlob = !metadata || (!metadata.kind && !metadata.proceduralModel);
          const blob = needsBlob ? (dbManager.getBlob(key) || await dbManager.get(key)) : undefined;
          if (metadata || blob) {
            const fingerprint = getAssetFingerprint(key, blob, metadata);
            if (processedFingerprints.has(fingerprint)) continue;
            const sourceName = metadata?.originalName || metadata?.name || key;
            const type = metadata?.kind || (metadata?.proceduralModel ? '3d' : detectAssetType(sourceName, blob));
            // 从key中提取文件名（去掉前缀和时间戳）
            const name = key.replace(/^asset_/, '').replace(/^img_/, '').replace(/^vid_/, '').replace(/^audio_/, '').replace(/^model_/, '').replace(/^pano_/, '');
            assetItems.push({
              key,
              name: metadata?.name || name || key,
              type,
              size: metadata?.size ?? blob?.size ?? 0,
              metadata,
            });
            processedKeys.add(key);
            processedFingerprints.add(fingerprint);
          }
        } catch (e) {
          // 忽略单个素材加载错误
        }
      }

      // 过程化 3D 没有独立 Blob，历史工程也可能只剩时间线引用；仍将其作为项目素材展示。
      for (const element of timelineElementsRef.current) {
        const assetKey = getProjectAssetKey(element);
        if (processedKeys.has(assetKey)) continue;
        if (element.type !== 'model-3d' && element.type !== 'gaussian-splat') continue;
        assetItems.push({
          key: assetKey,
          name: element.sourceName || '3D 模型',
          type: '3d',
          size: 0,
          metadata: { key: assetKey, name: element.sourceName || '3D 模型', importedAt: 0, source: 'project' },
          timelineElement: element,
        });
        processedKeys.add(assetKey);
        processedFingerprints.add(getAssetFingerprint(assetKey, undefined, assetItems[assetItems.length - 1].metadata));
      }

      // 过程化 3D 模型包只有元数据（代码/纹理），没有 GLB Blob，也应作为独立素材显示。
      const metadataItems = await dbManager.getAllMetadata();
      for (const metadata of metadataItems) {
        if (processedKeys.has(metadata.key) || !metadata.proceduralModel || processedFingerprints.has(getAssetFingerprint(metadata.key, undefined, metadata))) continue;
        assetItems.push({
          key: metadata.key,
          name: metadata.name,
          type: '3d',
          size: 0,
          metadata,
        });
        processedKeys.add(metadata.key);
        processedFingerprints.add(getAssetFingerprint(metadata.key, undefined, metadata));
      }

      // 按类型和名称排序
      assetItems.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      });

      setAssets(assetItems);
    } catch (e) {
      console.error('[AssetLibrary] 加载素材失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, [timelineAssetSignature]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets, refreshTrigger]);

  // 删除素材
  const handleDelete = async (key: string) => {
    if (referencedAssetKeys.includes(key)) {
      showNotice('warning', '该素材正在被工程引用。请先删除或替换对应图层，再从素材库删除，避免工程出现丢失素材。');
      setDeleteConfirmKey(null);
      return;
    }
    try {
      await dbManager.delete(key);
      setDeleteConfirmKey(null);
      await loadAssets();
    } catch (e) {
      console.error('[AssetLibrary] 删除素材失败:', e);
    }
  };


  // ==================== 单个素材右键操作 ====================

  // 素材卡片右键菜单
  const handleAssetContextMenu = (e: React.MouseEvent, asset: AssetItem) => {
    e.preventDefault();
    e.stopPropagation();
    setAssetCtxMenu({ x: e.clientX, y: e.clientY, asset });
  };

  // 关闭素材右键菜单的监听
  useEffect(() => {
    if (!assetCtxMenu) return;
    const close = () => setAssetCtxMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [assetCtxMenu]);

  // 预览素材
  const handlePreviewAsset = (asset: AssetItem) => {
    setPreviewAsset(asset);
    setAssetCtxMenu(null);
  };

  // 触发替换素材文件选择器
  const handleReplaceAsset = (key: string) => {
    setReplacingKey(key);
    setAssetCtxMenu(null);
    setTimeout(() => replaceInputRef.current?.click(), 50);
  };

  // 处理替换素材文件
  const handleReplaceFileChosen = async (input: HTMLInputElement | null) => {
    if (!input || !input.files || input.files.length === 0 || !replacingKey) return;
    const file = input.files[0];
    input.value = '';
    const key = replacingKey;
    setReplacingKey(null);
    try {
      // 读取新文件为 Blob
      const blob = file.slice(0, file.size, file.type);
      // 保持原 key 不变，覆盖存入 IndexedDB（引用该素材的元素会自动更新）
      await dbManager.put(key, blob);
      // 同时更新内存缓存
      dbManager.register(key, blob);
      const previous = await dbManager.getMetadata(key);
      const fingerprint = `${file.name}\u0000${file.size}\u0000${file.type}\u0000${file.lastModified || 0}`;
      await dbManager.setMetadata({
        key,
        name: file.name,
        size: file.size,
        originalName: previous?.originalName || file.name,
        kind: detectAssetType(key, file),
        fingerprint,
        sourcePath: previous?.sourcePath,
        sourceFolder: previous?.sourceFolder,
        importedAt: previous?.importedAt || Date.now(),
        source: previous?.source || 'local-file',
        proceduralModel: previous?.proceduralModel,
      });
      // 刷新素材列表
      await loadAssets();
    } catch (e) {
      console.error('[AssetLibrary] 替换素材失败:', e);
    }
  };

  // 重命名素材
  const handleRenameAsset = (asset: AssetItem) => {
    setRenameState({ key: asset.key, name: asset.name });
    setAssetCtxMenu(null);
  };

  // 确认重命名
  const handleConfirmRename = async () => {
    if (!renameState) return;
    try {
      const name = renameState.name.trim();
      if (!name) return;
      const asset = assets.find((item) => item.key === renameState.key);
      const metadata = asset?.metadata || await dbManager.getMetadata(renameState.key);
      await dbManager.setMetadata({
        key: renameState.key,
        name,
        size: metadata?.size ?? asset?.size,
        originalName: metadata?.originalName || asset?.name || renameState.key,
        kind: metadata?.kind || asset?.type,
        fingerprint: metadata?.fingerprint,
        sourcePath: metadata?.sourcePath,
        sourceFolder: metadata?.sourceFolder,
        importedAt: metadata?.importedAt || Date.now(),
        source: metadata?.source || 'unknown',
        proceduralModel: metadata?.proceduralModel,
      });
      onRenameAsset?.(renameState.key, name);
      setRenameState(null);
      await loadAssets();
    } catch (e) {
      console.error('[AssetLibrary] 重命名失败:', e);
    }
  };

  // 导出/下载素材到本地
  const handleExportAsset = async (asset: AssetItem) => {
    try {
      let blob = await dbManager.get(asset.key);
      let filename = asset.name;

      // img2threejs 是过程化模型，不存在 GLB Blob；导出完整代码、纹理与参数为可复用模型包。
      if (!blob && asset.timelineElement?.ai3dCode) {
        const modelPackage = {
          format: 'aether-procedural-3d',
          version: 1,
          exportedAt: new Date().toISOString(),
          model: {
            ai3dCode: asset.timelineElement.ai3dCode,
            ai3dCodeSource: asset.timelineElement.ai3dCodeSource,
            ai3dTexture: asset.timelineElement.ai3dTexture,
            sourceName: asset.timelineElement.sourceName,
            modelAutoRotate: asset.timelineElement.modelAutoRotate,
            modelAutoRotateSpeed: asset.timelineElement.modelAutoRotateSpeed,
            modelCameraDistance: asset.timelineElement.modelCameraDistance,
            modelViewAzimuth: asset.timelineElement.modelViewAzimuth,
            modelViewElevation: asset.timelineElement.modelViewElevation,
            modelScale: asset.timelineElement.modelScale,
            ai3dLayerDirection: asset.timelineElement.ai3dLayerDirection,
            ai3dLayerDistance: asset.timelineElement.ai3dLayerDistance,
            ai3dExplodeDirection: asset.timelineElement.ai3dExplodeDirection,
            ai3dExplodeDistance: asset.timelineElement.ai3dExplodeDistance,
            ai3dExplodeSpeed: asset.timelineElement.ai3dExplodeSpeed,
            ai3dExplodeSpin: asset.timelineElement.ai3dExplodeSpin,
            ai3dCollisionDirection: asset.timelineElement.ai3dCollisionDirection,
            ai3dCollisionDistance: asset.timelineElement.ai3dCollisionDistance,
            ai3dCollisionBounce: asset.timelineElement.ai3dCollisionBounce,
            ai3dCollisionSpeed: asset.timelineElement.ai3dCollisionSpeed,
            ai3dLayers: asset.timelineElement.ai3dLayers,
            ai3dExplode: asset.timelineElement.ai3dExplode,
            ai3dPhysics: asset.timelineElement.ai3dPhysics,
            ai3dLoopEnabled: asset.timelineElement.ai3dLoopEnabled,
            ai3dPreviewControls: asset.timelineElement.ai3dPreviewControls,
            ai3dExportControls: asset.timelineElement.ai3dExportControls,
            ai3dControlVariant: asset.timelineElement.ai3dControlVariant,
          },
        };
        blob = new Blob([JSON.stringify(modelPackage, null, 2)], { type: 'application/json' });
        filename = `${asset.name.replace(/\.[^.]+$/, '') || 'procedural-3d-model'}.aether-3d.json`;
      }

      if (!blob) {
        showNotice('warning', '此项目引用未保留原始文件，无法导出。请从原文件重新导入后再导出。');
        setAssetCtxMenu(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAssetCtxMenu(null);
    } catch (e) {
      console.error('[AssetLibrary] 导出素材失败:', e);
    }
  };

  // 复制素材 Key 到剪贴板
  const handleCopyAssetKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setAssetCtxMenu(null);
    } catch (e) {
      console.error('[AssetLibrary] 复制Key失败:', e);
    }
  };

  // 打开原文件所在目录：仅在桌面壳提供真实路径时可用；网页沙箱环境下自动降级为导出到本地下载文件夹
  const handleOpenAssetFolder = async (asset: AssetItem) => {
    setAssetCtxMenu(null);
    const folder = asset.metadata?.sourceFolder;
    if (!folder) {
      // 浏览器环境由于安全沙箱限制无法获取本地完整路径，素材存储在 IndexedDB 本地数据库中
      // 自动触发导出到本地，并给用户明确反馈
      handleExportAsset(asset);
      showNotice('info', '浏览器受安全沙箱限制无法直接调起系统资源管理器，已为您自动「导出到本地」下载文件夹。');
      return;
    }
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || '无法打开文件夹');
      }
      showNotice('success', '已在本地文件管理器中打开所在文件夹');
    } catch (error) {
      handleExportAsset(asset);
      showNotice('warning', error instanceof Error ? `${error.message}，已为您自动导出文件到本地` : '无法打开文件夹，已为您自动导出文件到本地。');
    }
  };

  // 添加素材到画布
  const handleAddToCanvas = (asset: AssetItem) => {
    if (asset.timelineElement) {
      onAddTimelineAsset?.(asset.timelineElement);
      setAssetCtxMenu(null);
      return;
    }
    if (asset.metadata?.proceduralModel) {
      const model = asset.metadata.proceduralModel;
      onAddTimelineAsset?.({
        id: `el_procedural_${Date.now()}`,
        type: 'model-3d',
        refId: '',
        sourceName: asset.name,
        x: 20,
        y: 15,
        w: 60,
        h: 65,
        zIndex: 10,
        opacity: 100,
        startTime: 0,
        duration: 6,
        modelAutoRotate: model.modelAutoRotate ?? true,
        modelAutoRotateSpeed: model.modelAutoRotateSpeed ?? 1,
        modelCameraDistance: model.modelCameraDistance ?? 0,
        modelViewAzimuth: model.modelViewAzimuth ?? 0,
        modelViewElevation: model.modelViewElevation ?? 0,
        modelScale: model.modelScale ?? 1,
        ai3dLayerDirection: model.ai3dLayerDirection ?? 'up',
        ai3dLayerDistance: model.ai3dLayerDistance ?? 1,
        ai3dExplodeDirection: model.ai3dExplodeDirection ?? 'radial',
        ai3dExplodeDistance: model.ai3dExplodeDistance ?? 1,
        ai3dExplodeSpeed: model.ai3dExplodeSpeed ?? 1,
        ai3dExplodeSpin: model.ai3dExplodeSpin ?? 0.5,
        ai3dCollisionDirection: model.ai3dCollisionDirection ?? 'radial',
        ai3dCollisionDistance: model.ai3dCollisionDistance ?? 1,
        ai3dCollisionBounce: model.ai3dCollisionBounce ?? 0.5,
        ai3dCollisionSpeed: model.ai3dCollisionSpeed ?? 1,
        ai3dCode: model.ai3dCode,
        ai3dCodeSource: model.ai3dCodeSource || 'img2threejs',
        ai3dTexture: model.ai3dTexture,
        ai3dLayers: model.ai3dLayers ?? 0,
        ai3dExplode: model.ai3dExplode ?? 0,
        ai3dPhysics: model.ai3dPhysics ?? false,
        ai3dLoopEnabled: model.ai3dLoopEnabled !== false,
        ai3dPreviewControls: model.ai3dPreviewControls,
        ai3dExportControls: model.ai3dExportControls,
        ai3dControlVariant: model.ai3dControlVariant,
      });
      setAssetCtxMenu(null);
      return;
    }
    onAddAsset?.(asset.key, asset.type);
    setAssetCtxMenu(null);
  };

  // 拖拽开始（多选时批量拖拽）
  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    setDraggedKey(asset.key);
    const keys =
      multiSelectedKeys.includes(asset.key) && multiSelectedKeys.length > 1
        ? multiSelectedKeys
        : [asset.key];
    e.dataTransfer.setData('application/x-aether-asset', JSON.stringify({
      keys,
      key: asset.key,
      type: asset.type,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedKey(null);
  };

  // 剪映式素材多选：普通点击=单选+添加画布；Ctrl/Cmd=追加/取消；Shift=范围选择
  const handleAssetClick = (e: React.MouseEvent, asset: AssetItem) => {
    e.stopPropagation();

    if (e.shiftKey && lastClickedKey) {
      const keys = filteredAssets.map((a) => a.key);
      const i1 = keys.indexOf(lastClickedKey);
      const i2 = keys.indexOf(asset.key);
      if (i1 >= 0 && i2 >= 0) {
        const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
        setMultiSelectedKeys(keys.slice(lo, hi + 1));
        setLastClickedKey(asset.key);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      const isIn = multiSelectedKeys.includes(asset.key);
      setMultiSelectedKeys((prev) =>
        isIn ? prev.filter((k) => k !== asset.key) : [...prev, asset.key]
      );
      setLastClickedKey(asset.key);
      return;
    }

    // 普通点击：单选，并添加到画布（保留原有行为）
    setMultiSelectedKeys([asset.key]);
    setLastClickedKey(asset.key);
    if (asset.timelineElement) {
      onAddTimelineAsset?.(asset.timelineElement);
    } else if (asset.metadata?.proceduralModel) {
      handleAddToCanvas(asset);
    } else if (onAddAsset) {
      onAddAsset(asset.key, asset.type);
    }
  };

  // 全选当前过滤结果
  const handleSelectAll = () => {
    const keys = filteredAssets.map((a) => a.key);
    setMultiSelectedKeys(keys);
    if (keys.length > 0) setLastClickedKey(keys[keys.length - 1]);
  };

  // 批量删除选中素材
  const handleBatchDelete = async () => {
    if (multiSelectedKeys.length === 0) return;
    let ok = 0;
    for (const key of multiSelectedKeys) {
      if (referencedAssetKeys.includes(key)) continue;
      try {
        await dbManager.delete(key);
        ok++;
      } catch (e) {
        console.error('[AssetLibrary] 删除素材失败:', key, e);
      }
    }
    setMultiSelectedKeys([]);
    setLastClickedKey(null);
    setDeleteConfirmKey(null);
    await loadAssets();
    if (ok > 0) {
      showNotice('success', `已删除 ${ok} 个素材`);
    }
  };

  // 面板键盘快捷键：Ctrl+A 全选、Delete/Backspace 批量删除
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      e.stopPropagation();
      // 阻止 App 全局 Ctrl+A（全选图层）与素材库全选同时触发
      try { e.nativeEvent.stopImmediatePropagation(); } catch {}
      handleSelectAll();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && multiSelectedKeys.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      try { e.nativeEvent.stopImmediatePropagation(); } catch {}
      handleBatchDelete();
    }
  };

  // 面板拖入外部文件：仅入库
  const handlePanelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPanelDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0 && onImportFiles) {
      setIsPanelImporting(true);
      showNotice('info', `正在导入 ${files.length} 个素材…`);
      Promise.resolve(onImportFiles(Array.from(files)))
        .then((summary) => {
          if (summary && summary.imported > 0) {
            showNotice(summary.skipped > 0 ? 'warning' : 'success', `已入库 ${summary.imported} 个素材${summary.skipped > 0 ? `，跳过 ${summary.skipped} 个不支持或导入失败的文件` : ''}`);
          } else {
            showNotice('warning', '未识别可导入素材。支持图片、视频、音频、3D 模型和全景文件。');
          }
        })
        .catch(() => showNotice('error', '素材导入失败，请检查文件格式或存储空间。'))
        .finally(() => setIsPanelImporting(false));
    }
  };

  const handlePanelDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanelDragOver(true);
    }
  };

  // 过滤素材
  const filteredAssets = assets.filter((asset) => {
    const matchType = activeFilter === 'all' || asset.type === activeFilter;
    const matchSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  // 按类型分组
  const groupedAssets = filteredAssets.reduce((acc, asset) => {
    if (!acc[asset.type]) acc[asset.type] = [];
    acc[asset.type].push(asset);
    return acc;
  }, {} as Record<AssetType, AssetItem[]>);

  // 统计各类型数量
  const typeCounts = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filterOptions: Array<{ id: AssetType | 'all'; label: string; count: number }> = [
    { id: 'all', label: '全部', count: assets.length },
    { id: 'image', label: '图片', count: typeCounts.image || 0 },
    { id: 'video', label: '视频', count: typeCounts.video || 0 },
    { id: 'audio', label: '音频', count: typeCounts.audio || 0 },
    { id: '3d', label: '3D', count: typeCounts['3d'] || 0 },
    { id: 'panorama', label: '全景', count: typeCounts.panorama || 0 },
  ];
  const noticeClassName = notice?.type === 'error'
    ? 'border-rose-400/30 bg-rose-400/[.08] text-rose-100'
    : notice?.type === 'warning'
      ? 'border-amber-400/30 bg-amber-400/[.08] text-amber-100'
      : notice?.type === 'success'
        ? 'border-emerald-400/30 bg-emerald-400/[.08] text-emerald-100'
        : 'border-cyan-400/30 bg-cyan-400/[.08] text-cyan-100';

  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative"
      tabIndex={0}
      onKeyDown={handlePanelKeyDown}
      onDragOver={handlePanelDragOver}
      onDragLeave={() => setIsPanelDragOver(false)}
      onDrop={handlePanelDrop}
      style={{ outline: 'none' }}
    >
      {/* 面板拖入文件高亮 */}
      {isPanelDragOver && (
        <div className="absolute inset-0 z-20 bg-cyan-500/15 border-2 border-dashed border-cyan-400/70 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 px-5 py-4 rounded-xl text-center">
            <Upload size={26} className="text-cyan-400 mx-auto mb-1.5" />
            <p className="text-white text-sm font-semibold">{isPanelImporting ? '正在导入素材…' : '松手导入素材库'}</p>
            <p className="text-slate-400 text-[10px] mt-0.5">仅入库 · 拖到画布可自动添加</p>
          </div>
        </div>
      )}

      {notice && (
        <div className={`sticky top-0 z-30 mx-3 mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-5 shadow-xl backdrop-blur-md ${noticeClassName}`} role="status" aria-live="polite">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 rounded p-0.5 opacity-70 transition hover:bg-white/10 hover:opacity-100" aria-label="关闭素材库提示">
            <X size={13} />
          </button>
        </div>
      )}

      {/* 多选工具栏 */}
      {multiSelectedKeys.length > 0 && (
        <div className="px-3 py-1.5 border-b border-cyan-500/30 bg-cyan-500/10 flex items-center justify-between gap-2">
          <span className="text-[10px] text-cyan-300 font-semibold">
            已选 {multiSelectedKeys.length} 个素材
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 text-[9px]"
              title="全选 (Ctrl+A)"
            >
              全选
            </button>
            <button
              type="button"
              onClick={() => { setMultiSelectedKeys([]); setLastClickedKey(null); }}
              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 text-[9px]"
              title="取消选择"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              className="px-1.5 py-0.5 rounded bg-rose-500/80 hover:bg-rose-500 text-white text-[9px] flex items-center gap-0.5"
              title={`删除选中的 ${multiSelectedKeys.length} 个素材`}
            >
              <Trash2 size={9} /> 删除
            </button>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜索素材..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        {/* 缩略图尺寸控制：面板变宽后可放大素材预览图，便于寻找素材 */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1 whitespace-nowrap">
            <LayoutGrid size={10} /> 预览大小
          </span>
          <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
            {([
              { v: 'small' as const, label: '小', icon: 'grid-3' },
              { v: 'medium' as const, label: '中', icon: 'grid-2' },
              { v: 'large' as const, label: '大', icon: 'grid-1' },
            ]).map((opt) => (
              <button
                key={opt.v}
                type="button"
                title={opt.label}
                onClick={() => { setThumbSize(opt.v); localStorage.setItem('aether_asset_thumb', opt.v); }}
                className={`px-1.5 py-0.5 rounded text-[9px] leading-none transition-colors ${
                  thumbSize === opt.v ? 'bg-cyan-500/30 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="px-3 py-2 border-b border-white/10 flex flex-wrap gap-1">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setActiveFilter(option.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
              activeFilter === option.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {option.label}
            <span className={`px-1 rounded text-[9px] ${
              activeFilter === option.id ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/10 text-slate-500'
            }`}>
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {/* 素材列表（右键可上传各类型素材） */}
      <div
        className="p-3"
        onContextMenu={handleLibraryContextMenu}
      >
        <input
          ref={importInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.glb,.gltf,.ply,.splat,.aether-3d.json"
          multiple
          onChange={handleImportCardChange}
          aria-label="导入素材"
        />
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-2" />
            <span className="text-xs">加载素材...</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-full items-start justify-center pt-2">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="w-full rounded-xl border border-white/10 bg-[#242a35] px-3 py-4 text-center transition-colors hover:border-cyan-400/55 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <span className="flex items-center justify-center gap-2 text-sm font-medium text-slate-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-slate-950">
                  <Plus size={16} strokeWidth={2.5} />
                </span>
                <span>导入</span>
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-400">
                支持图片、视频、音频、3D模型、全景图、全景视频、高斯泼溅
              </span>
            </button>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
            <FolderOpen size={32} className="mb-3 opacity-30" />
            <p className="text-xs mb-1">
              {searchQuery || activeFilter !== 'all' ? '未找到匹配的素材' : '暂无素材'}
            </p>
            <p className="text-[10px] text-slate-600">
              尝试调整搜索词或筛选条件
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 按类型分组显示 */}
            {(Object.keys(groupedAssets) as AssetType[]).map((type) => (
              <div key={type}>
                {/* 类型标题 */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`${ASSET_TYPE_CONFIG[type].color}`}>
                    {ASSET_TYPE_CONFIG[type].icon}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {ASSET_TYPE_CONFIG[type].label}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {groupedAssets[type].length}
                  </span>
                </div>

                {/* 素材网格（列数随缩略图尺寸档位变化） */}
                <div className={`grid ${gridCols} gap-2`}>
                  {groupedAssets[type].map((asset) => {
                    const isMultiSelected = multiSelectedKeys.includes(asset.key);
                    return (
                    <div
                      key={asset.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleAssetClick(e, asset)}
                      onContextMenu={(e) => handleAssetContextMenu(e, asset)}
                      className={`group relative bg-white/[0.03] border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-cyan-500/40 hover:shadow-md ${
                        isMultiSelected
                          ? 'border-cyan-400 ring-1 ring-cyan-400/60 bg-cyan-500/15'
                          : draggedKey === asset.key ? 'opacity-50 border-cyan-500' : 'border-white/10'
                      }`}
                      title={`${asset.name} (${formatSize(asset.size)}) - 点击添加 · Ctrl/Shift 多选 · 拖拽到画布`}
                    >
                      {/* 多选角标 */}
                      {isMultiSelected && (
                        <div className="absolute top-1 left-1 z-10 w-4 h-4 rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center shadow">
                          {multiSelectedKeys.indexOf(asset.key) + 1}
                        </div>
                      )}
                      {/* 缩略图 */}
                      <div className={`aspect-square ${ASSET_TYPE_CONFIG[type].bgColor} flex items-center justify-center relative overflow-hidden`}>
                        {asset.type === 'image' || asset.type === 'panorama' ? (
                          <AssetThumbnail assetKey={asset.key} assetType="image" />
                        ) : asset.type === 'video' || asset.type === 'panorama-video' ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <AssetThumbnail assetKey={asset.key} assetType="video" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                                <Video size={14} className="text-white ml-0.5" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className={`${ASSET_TYPE_CONFIG[type].color} flex items-center justify-center`}>
                            {ASSET_TYPE_CONFIG[type].icon}
                          </span>
                        )}

                        {/* 悬浮添加提示 */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-[9px] text-white font-medium">
                            点击添加
                          </span>
                        </div>
                      </div>

                      {/* 素材信息 */}
                      <div className="p-1.5">
                        <p className="text-[10px] text-slate-300 truncate" title={asset.name}>
                          {asset.name}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {formatSize(asset.size)}
                        </p>
                      </div>

                      {/* 删除按钮 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmKey(asset.key);
                        }}
                        className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-rose-500/50 transition-all"
                        title="删除素材"
                      >
                        <Trash2 size={10} />
                      </button>

                      {/* 删除确认 */}
                      {deleteConfirmKey === asset.key && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 z-10">
                          <AlertCircle size={16} className="text-rose-400 mb-1" />
                          <p className="text-[9px] text-white text-center mb-2">确定删除？</p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmKey(null);
                              }}
                              className="px-2 py-0.5 rounded bg-white/10 text-white text-[9px] hover:bg-white/20"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(asset.key);
                              }}
                              className="px-2 py-0.5 rounded bg-rose-500 text-white text-[9px] hover:bg-rose-400"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02]">
        <p className="text-[9px] text-slate-600 text-center">
          点击添加 · Ctrl/Shift 多选 · 右键素材操作 · 空白处右键上传 · 拖文件入库 · 共 {assets.length} 个素材
        </p>
      </div>

      {/* 【右键上传】素材窗口右键选择上传各类型素材（仅入库素材库） */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[10050]" onMouseDown={() => setCtxMenu(null)} />
          <div
            className="fixed z-[10060] w-44 py-1 rounded-lg bg-[#161822] border border-white/10 shadow-2xl"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 190), top: Math.min(ctxMenu.y, window.innerHeight - 240) }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] text-slate-500 font-medium border-b border-white/5 flex items-center gap-1.5">
              <Upload size={11} /> 上传素材
            </div>
            <button type="button" onClick={() => ctxImgRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <ImageIcon size={13} className="text-cyan-400" /> 上传图片
            </button>
            <button type="button" onClick={() => ctxVidRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Video size={13} className="text-sky-400" /> 上传视频
            </button>
            <button type="button" onClick={() => ctxAudRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Music size={13} className="text-fuchsia-400" /> 上传音频
            </button>
            <button type="button" onClick={() => ctxModelRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Box size={13} className="text-amber-400" /> 上传3D模型
            </button>
            <button type="button" onClick={() => ctxPanoRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Globe size={13} className="text-emerald-400" /> 上传全景图
            </button>
          </div>
        </>
      )}
      {/* 隐藏文件选择器（右键菜单触发） */}
      <input ref={ctxImgRef} type="file" accept="image/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxImgRef.current)} />
      <input ref={ctxVidRef} type="file" accept="video/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxVidRef.current)} />
      <input ref={ctxAudRef} type="file" accept="audio/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxAudRef.current)} />
      <input ref={ctxModelRef} type="file" accept=".glb,.gltf,.aether-3d.json,.obj,.fbx,.stl,.3mf,.dae,.ply,model/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxModelRef.current)} />
      <input ref={ctxPanoRef} type="file" accept="image/*" multiple className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleCtxFileChosen(ctxPanoRef.current)} />

      {/* 替换素材的隐藏文件选择器 */}
      <input ref={replaceInputRef} type="file" className="absolute left-[-9999px] top-0 w-px h-px opacity-0" onChange={() => handleReplaceFileChosen(replaceInputRef.current)} />

      {/* ==================== 单个素材右键操作菜单 ==================== */}
      {assetCtxMenu && (
        <>
          <div className="fixed inset-0 z-[10070]" onMouseDown={() => setAssetCtxMenu(null)} />
          <div
            className="fixed z-[10080] w-48 py-1 rounded-lg bg-[#161822] border border-white/10 shadow-2xl"
            style={{ left: Math.min(assetCtxMenu.x, window.innerWidth - 210), top: Math.min(assetCtxMenu.y, window.innerHeight - 380) }}
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 素材信息头 */}
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-[11px] text-slate-200 font-medium truncate" title={assetCtxMenu.asset.name}>
                {assetCtxMenu.asset.name}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {ASSET_TYPE_CONFIG[assetCtxMenu.asset.type].label} · {formatSize(assetCtxMenu.asset.size)}
              </p>
            </div>

            {/* 查看 */}
            <button type="button" onClick={() => handlePreviewAsset(assetCtxMenu.asset)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Eye size={13} className="text-cyan-400" /> 查看素材
            </button>

            {/* 添加到画布 */}
            <button type="button" onClick={() => handleAddToCanvas(assetCtxMenu.asset)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Plus size={13} className="text-emerald-400" /> 添加到画布
            </button>

            <div className="my-1 border-t border-white/5" />

            {/* 替换素材 */}
            <button type="button" onClick={() => handleReplaceAsset(assetCtxMenu.asset.key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <RefreshCw size={13} className="text-sky-400" /> 替换素材
            </button>

            {/* 重命名 */}
            <button type="button" onClick={() => handleRenameAsset(assetCtxMenu.asset)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Pencil size={13} className="text-amber-400" /> 重命名
            </button>

            <div className="my-1 border-t border-white/5" />

            {/* 导出/下载 */}
            <button type="button" onClick={() => handleExportAsset(assetCtxMenu.asset)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Download size={13} className="text-fuchsia-400" /> 导出到本地
            </button>

            <button type="button" onClick={() => handleOpenAssetFolder(assetCtxMenu.asset)}
              title={assetCtxMenu.asset.metadata?.sourceFolder ? '在系统文件管理器中打开' : '浏览器沙箱模式：将自动导出至本地下载文件夹'}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <span className="flex items-center gap-2">
                <FolderOpen size={13} className="text-cyan-400" /> 打开所在文件夹
              </span>
              {!assetCtxMenu.asset.metadata?.sourceFolder && (
                <span className="text-[9px] text-slate-400 font-normal">导出</span>
              )}
            </button>

            {/* 复制素材Key */}
            <button type="button" onClick={() => handleCopyAssetKey(assetCtxMenu.asset.key)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors">
              <Copy size={13} className="text-slate-400" /> 复制素材ID
            </button>

            <div className="my-1 border-t border-white/5" />

            {/* 删除 */}
            <button type="button" onClick={() => { setDeleteConfirmKey(assetCtxMenu.asset.key); setAssetCtxMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors">
              <Trash2 size={13} /> 删除素材
            </button>
          </div>
        </>
      )}

      {/* ==================== 素材预览弹窗 ==================== */}
      {previewAsset && (
        <div className="fixed inset-0 z-[10090] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onMouseDown={() => setPreviewAsset(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh] bg-[#161822] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}>
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                {ASSET_TYPE_CONFIG[previewAsset.type].icon}
                <span className="text-sm text-slate-200 font-medium truncate" title={previewAsset.name}>
                  {previewAsset.name}
                </span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {ASSET_TYPE_CONFIG[previewAsset.type].label} · {formatSize(previewAsset.size)}
                </span>
              </div>
              <button type="button" onClick={() => setPreviewAsset(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            {/* 预览内容 */}
            <div className="flex items-center justify-center bg-black/40" style={{ minWidth: '320px', minHeight: '240px', maxWidth: '80vw', maxHeight: '70vh' }}>
              {previewAsset.type === 'image' || previewAsset.type === 'panorama' ? (
                <AssetPreviewImage assetKey={previewAsset.key} />
              ) : previewAsset.type === 'video' || previewAsset.type === 'panorama-video' ? (
                <AssetPreviewVideo assetKey={previewAsset.key} />
              ) : previewAsset.type === 'audio' ? (
                <AssetPreviewAudio assetKey={previewAsset.key} />
              ) : (
                <div className="flex flex-col items-center gap-3 p-8">
                  <div className={`w-16 h-16 rounded-2xl ${ASSET_TYPE_CONFIG[previewAsset.type].bgColor} flex items-center justify-center`}>
                    {ASSET_TYPE_CONFIG[previewAsset.type].icon}
                  </div>
                  <p className="text-sm text-slate-400">该类型素材暂不支持预览</p>
                  <p className="text-[11px] text-slate-600">可导出到本地后查看</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 重命名弹窗 ==================== */}
      {renameState && (
        <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onMouseDown={() => setRenameState(null)}>
          <div className="w-80 bg-[#161822] rounded-xl border border-white/10 shadow-2xl p-4"
            onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-sm text-slate-200 font-medium mb-3">重命名素材</h3>
            <input
              type="text"
              value={renameState.name}
              onChange={(e) => setRenameState({ ...renameState, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenameState(null); }}
              autoFocus
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
              placeholder="输入新名称"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRenameState(null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs hover:bg-white/10 transition-colors">
                取消
              </button>
              <button type="button" onClick={handleConfirmRename}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-xs hover:bg-cyan-400 transition-colors">
                确认
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/**
 * 素材缩略图组件
 * 懒加载图片缩略图
 */
const AssetThumbnail: React.FC<{ assetKey: string; assetType: 'image' | 'video' }> = ({ assetKey, assetType }) => {
  const [url, setUrl] = useState<string | null>(() => {
    const cached = dbManager.getCachedUrl(assetKey);
    return cached && cached !== assetKey ? cached : null;
  });
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevAssetKeyRef = useRef(assetKey);

  // A material panel can contain dozens of videos. Only hydrate thumbnails
  // close to the viewport; otherwise every card creates a decoder and reads a
  // Blob URL while the user is still scrolling through the list.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { root: null, rootMargin: '160px 0px', threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (prevAssetKeyRef.current !== assetKey) {
      prevAssetKeyRef.current = assetKey;
      const cached = dbManager.getCachedUrl(assetKey);
      setUrl(cached && cached !== assetKey ? cached : null);
    }
    if (!isVisible) {
      return () => { cancelled = true; };
    }
    const cached = dbManager.getCachedUrl(assetKey);
    if (cached && cached !== assetKey) {
      setUrl(cached);
      return () => { cancelled = true; };
    }
    (async () => {
      await dbManager.ensureReady();
      const u = await dbManager.loadUrl(assetKey);
      if (!cancelled) setUrl(u && u !== assetKey ? u : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [assetKey, isVisible]);

  if (!isVisible || !url) {
    return <div ref={containerRef} className="w-full h-full bg-slate-800 animate-pulse" />;
  }

  if (assetType === 'video') {
    return (
      <div ref={containerRef} className="w-full h-full">
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          data-aether-asset-thumbnail="true"
          onMouseEnter={(event) => {
            // Keep at most one library preview decoding at a time. Canvas and
            // export videos are intentionally outside this selector.
            document.querySelectorAll<HTMLVideoElement>('video[data-aether-asset-thumbnail="true"]').forEach((other) => {
              if (other !== event.currentTarget) other.pause();
            });
            void event.currentTarget.play().catch(() => {});
          }}
          onMouseLeave={(event) => {
            event.currentTarget.pause();
            try { event.currentTarget.currentTime = 0; } catch {}
          }}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full"><img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" draggable={false} /></div>;
};

/**
 * 图片预览组件
 */
const AssetPreviewImage: React.FC<{ assetKey: string }> = ({ assetKey }) => {
  const [url, setUrl] = useState<string | null>(() => {
    const cached = dbManager.getCachedUrl(assetKey);
    return cached && cached !== assetKey ? cached : null;
  });
  useEffect(() => {
    let cancelled = false;
    const cached = dbManager.getCachedUrl(assetKey);
    if (cached && cached !== assetKey) {
      setUrl(cached);
      return () => { cancelled = true; };
    }
    setUrl(null);
    (async () => {
      await dbManager.ensureReady();
      const u = await dbManager.loadUrl(assetKey);
      if (!cancelled) setUrl(u && u !== assetKey ? u : null);
    })();
    return () => { cancelled = true; };
  }, [assetKey]);
  if (!url) return <div className="w-64 h-48 bg-slate-800 animate-pulse" />;
  return <img src={url} alt="preview" className="max-w-full max-h-[65vh] object-contain" />;
};

/**
 * 视频预览组件
 */
const AssetPreviewVideo: React.FC<{ assetKey: string }> = ({ assetKey }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    (async () => {
      await dbManager.ensureReady();
      const u = await dbManager.loadUrl(assetKey);
      if (!cancelled) setUrl(u && u !== assetKey ? u : null);
    })();
    return () => { cancelled = true; };
  }, [assetKey]);
  if (!url) return <div className="w-64 h-48 bg-slate-800 animate-pulse" />;
  return <video src={url} controls autoPlay muted playsInline className="max-w-full max-h-[65vh]" />;
};

/**
 * 音频预览组件
 */
const AssetPreviewAudio: React.FC<{ assetKey: string }> = ({ assetKey }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    (async () => {
      await dbManager.ensureReady();
      const u = await dbManager.loadUrl(assetKey);
      if (!cancelled) setUrl(u && u !== assetKey ? u : null);
    })();
    return () => { cancelled = true; };
  }, [assetKey]);
  if (!url) return <div className="w-64 h-24 bg-slate-800 animate-pulse" />;
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <Music size={32} className="text-emerald-400" />
      </div>
      <audio src={url} controls autoPlay className="w-72" />
    </div>
  );
};

