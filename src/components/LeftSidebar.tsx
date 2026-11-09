import React, { useEffect, useRef, useState, useMemo } from 'react';
// 插件面板依赖 GalaxyComponents（300+ KB），只在切到「插件」标签时加载。
const LazyPluginCenterPanel = React.lazy(() => import('./PluginCenterPanel').then((module) => ({ default: module.PluginCenterPanel })));
import { 
  Layers, Plus, Trash2, 
  Copy, Eye, EyeOff, Lock, Unlock, ArrowUp, ArrowDown,
  Music, Sparkles, ChevronRight, ChevronDown, Check, Zap, Shuffle,
  GripVertical, Flag, Folder, FolderPlus,
  FolderMinus, Palette, Edit2, X, CheckSquare, Square, Unlink,
  Layers2,
  Film, FolderOpen, Shapes, Blocks, History, Scissors, Box, LayoutGrid, Code2
} from 'lucide-react';
import { ProjectData, Scene, SceneElement, SceneTransitionType, HistoryItem, LayerGroup } from '../types';
import { HistoryPanel } from './HistoryPanel';
import { MyComponentsPanel } from './MyComponentsPanel';
import { AssetLibraryPanel, AssetType } from './AssetLibraryPanel';
import { getShapeBackground } from '../utils/shapeStyles';
import { isPopupScene } from '../utils/sceneLoop';
import type { OfficialPluginDefinition } from '../plugins/registry';

export const TRANSITION_LABELS: Record<string, string> = {
  none: '⏹️ 直切',
  fade: '🌫️ 淡入',
  'slide-left': '⬅️ 左滑',
  'slide-right': '➡️ 右滑',
  'slide-up': '⬆️ 上滑',
  'slide-down': '⬇️ 下滑',
  'zoom-in': '🔍 推近',
  'zoom-out': '🔭 拉远',
  dissolve: '🫧 溶解',
  'flip-3d': '🔄 3D翻转',
  'cube-3d': '🎲 3D立方',
  glitch: '⚡ 故障',
  'wipe-right': '✨ 划变',
  'soft-wipe': '柔光擦拭',
  'radial-reveal': '径向扩散',
  'diagonal-curtain': '斜切光幕',
  'blur-dissolve': '模糊溶解',
};

/** 体感手势图标与标签（场景序列卡片徽标用） */
export const GESTURE_ICONS: Record<string, string> = {
  wave: '👋',
  open_palm: '🖐',
  swipe_left: '👈',
  swipe_right: '👉',
  fist: '✊',
  point: '☝️',
};
export const GESTURE_LABELS: Record<string, string> = {
  wave: '挥手',
  open_palm: '手掌',
  swipe_left: '左滑',
  swipe_right: '右滑',
  fist: '握拳',
  point: '指点',
};

export interface GroupColorDef {
  bg: string;
  text: string;
  border: string;
  label: string;
  tag: string;
  ring: string;
}

export const FOLDER_COLORS: Record<string, GroupColorDef> = {
  sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/40', label: '天空蓝', tag: '#38bdf8', ring: 'ring-sky-400' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/40', label: '宝石蓝', tag: '#3b82f6', ring: 'ring-blue-400' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/40', label: '深靛蓝', tag: '#6366f1', ring: 'ring-indigo-400' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/40', label: '幻境紫', tag: '#a855f7', ring: 'ring-purple-400' },
  fuchsia: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/40', label: '洋红色', tag: '#d946ef', ring: 'ring-fuchsia-400' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/40', label: '珊瑚粉', tag: '#ec4899', ring: 'ring-pink-400' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/40', label: '玫瑰红', tag: '#f43f5e', ring: 'ring-rose-400' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/40', label: '琥珀金', tag: '#f59e0b', ring: 'ring-amber-400' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/40', label: '活力橙', tag: '#fb923c', ring: 'ring-orange-400' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/40', label: '翡翠绿', tag: '#10b981', ring: 'ring-emerald-400' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/40', label: '松石青', tag: '#14b8a6', ring: 'ring-teal-400' },
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/40', label: '极光青', tag: '#06b6d4', ring: 'ring-cyan-400' },
  slate: { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/40', label: '钛银灰', tag: '#94a3b8', ring: 'ring-slate-400' },
};

export const getGroupColorConfig = (color?: string): GroupColorDef => {
  if (!color) return FOLDER_COLORS.sky;
  if (FOLDER_COLORS[color]) return FOLDER_COLORS[color];
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return {
      bg: 'bg-white/[0.06]',
      text: 'text-slate-200',
      border: 'border-white/20',
      label: '自定义颜色',
      tag: color,
      ring: 'ring-white/50',
    };
  }
  return FOLDER_COLORS.sky;
};

interface LeftSidebarProps {
  projectData: ProjectData;
  activeSceneId: string;
  onSelectScene: (id: string) => void;
  onUpdateProject: (updater: (prev: ProjectData) => ProjectData, actionTitle?: string) => void;
  selectedElementId: string | null;
  multiSelectedIds: string[];
  onSelectElement: (id: string | null) => void;
  onMultiSelectionChange: (ids: string[], primaryId: string | null) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onNewScene: () => void;
  onLoadTemplate: (templateKey: string) => void;
  historyList?: HistoryItem[];
  currentIndex?: number;
  onJumpToHistory?: (index: number) => void;
  onClearHistory?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  /** 素材库：点击或拖拽素材到画布时触发 */
  onAddAsset?: (assetKey: string, assetType: AssetType) => void;
  /** 素材重命名后同步时间线图层名称 */
  onRenameAsset?: (assetKey: string, name: string) => void;
  /** 素材库刷新触发器（外部拖入新素材后递增） */
  assetRefreshTrigger?: number;
  /** 素材库面板拖入文件：仅入库 */
  onImportFiles?: (files: File[]) => void;
  timelineElements?: SceneElement[];
  onAddTimelineAsset?: (element: SceneElement) => void;
  referencedAssetKeys?: string[];
  /** 合并选中图层为嵌套容器 / 拆开容器 */
  onMergeElements?: (targetIds?: string[]) => void;
  onUnmergeElement?: (elId: string) => void;
  onInsertPlugin?: (plugin: OfficialPluginDefinition) => void;
  /** 面板宽度（由外部拖拽分隔条控制） */
  width?: number;
  /** 当前时间线指针（插入组件副本时作为起始时间） */
  currentTime?: number;
  /** 统一提示出口 */
  onToast?: (message: string, type?: 'info' | 'warning' | 'error') => void;
  onOpen3DModal?: () => void;
  onOpenShapePresetModal?: () => void;
  onOpenSaberPresetModal?: () => void;
  onOpenVfxModal?: () => void;
  onOpenCardLayoutModal?: () => void;
  onOpenUILibraryModal?: () => void;
  onOpenOfficialComponents?: () => void;
  onOpenPluginCenter?: () => void;
  onOpenInteractionControlsModal?: () => void;
  onOpenBackgroundRemoval?: () => void;
  onOpenAiSceneBuilder?: () => void;
  onOpenCustomCodePlugin?: () => void;
  onAddElement?: (type: 'txt' | 'img' | 'vid' | 'shape' | 'saber' | 'chart' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat') => void;
}

export type TabType = 'scenes' | 'layers' | 'assets' | 'design' | 'components' | 'ai' | 'history' | 'templates' | 'plugins';

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  projectData,
  activeSceneId,
  onSelectScene,
  onUpdateProject,
  selectedElementId,
  multiSelectedIds,
  onSelectElement,
  onMultiSelectionChange,
  onSelectAll,
  onClearSelection,
  onNewScene,
  onLoadTemplate,
  historyList = [],
  currentIndex = 0,
  onJumpToHistory = () => {},
  onClearHistory = () => {},
  onUndo = () => {},
  onRedo = () => {},
  canUndo = false,
  canRedo = false,
  activeTab: controlledTab,
  onTabChange,
  onAddAsset,
  onRenameAsset,
  assetRefreshTrigger = 0,
  onImportFiles,
  timelineElements = [],
  onAddTimelineAsset,
  referencedAssetKeys = [],
  onMergeElements,
  onUnmergeElement,
  onInsertPlugin,
  onOpen3DModal,
  onOpenShapePresetModal,
  onOpenSaberPresetModal,
  onOpenVfxModal,
  onOpenCardLayoutModal,
  onOpenUILibraryModal,
  onOpenOfficialComponents,
  onOpenPluginCenter,
  onOpenInteractionControlsModal,
  onOpenBackgroundRemoval,
  onOpenAiSceneBuilder,
  onOpenCustomCodePlugin,
  onAddElement,
  width = 240,
  currentTime = 0,
  onToast,
}) => {
  const [internalTab, setInternalTab] = useState<TabType>('scenes');
  const requestedTab = controlledTab !== undefined ? controlledTab : internalTab;
  const activeTab = (requestedTab || 'scenes') as TabType;
  const setActiveTab = (tab: TabType) => {
    if (onTabChange) onTabChange(tab);
    setInternalTab(tab);
  };

  const RAIL_TABS: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'scenes', label: '场景', icon: <Film size={17} /> },
    { id: 'layers', label: '图层', icon: <Layers size={17} /> },
    { id: 'assets', label: '素材', icon: <FolderOpen size={17} /> },
    { id: 'design', label: '设计', icon: <Shapes size={17} /> },
    { id: 'components', label: '组件', icon: <Blocks size={17} /> },
    { id: 'ai', label: 'AI', icon: <Sparkles size={17} className="text-amber-400" /> },
    { id: 'history', label: '历史', icon: <History size={17} /> },
  ];

  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sceneListRef = useRef<HTMLDivElement>(null);

  // Layer Multi-Select & Group Folder States
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [activeColorPickerGroupId, setActiveColorPickerGroupId] = useState<string | null>(null);
  const [groupDropdownId, setGroupDropdownId] = useState<string | null>(null);
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);
  const [customHex, setCustomHex] = useState<string>('#38bdf8');

  // Layer & Group Drag & Drop Reordering States
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [layerDropPosition, setLayerDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  useEffect(() => {
    const list = sceneListRef.current;
    if (!list) return;

    const handleWheel = (event: WheelEvent) => {
      if (list.scrollHeight <= list.clientHeight) return;
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * list.clientHeight
          : event.deltaY;
      if (!delta) return;

      list.scrollTop += delta;
      event.preventDefault();
      event.stopPropagation();
    };

    list.addEventListener('wheel', handleWheel, { passive: false });
    return () => list.removeEventListener('wheel', handleWheel);
  }, [activeTab]);

  const activeScene = projectData.scenes[activeSceneId] || Object.values(projectData.scenes)[0];
  const sortedElements = activeScene ? [...activeScene.els].sort((a, b) => b.zIndex - a.zIndex) : [];
  const sceneGroups = activeScene?.groups || [];

  // Group helper: elements in a group
  const getGroupElements = (groupId: string) => {
    return sortedElements.filter((el) => el.groupId === groupId);
  };

  // Ungrouped elements
  const ungroupedElements = sortedElements.filter((el) => !el.groupId || !sceneGroups.some((g) => g.id === el.groupId));

  // Scene management handlers
  const handleDuplicateScene = (sceneId: string) => {
    const src = projectData.scenes[sceneId];
    if (!src) return;
    const newId = 's_' + Date.now();
    const newScene: Scene = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId,
      alias: `${src.alias} (副本)`,
    };
    onUpdateProject((prev) => ({
      ...prev,
      scenes: { ...prev.scenes, [newId]: newScene },
    }));
    onSelectScene(newId);
  };

  const handleDeleteScene = (sceneId: string) => {
    const keys = Object.keys(projectData.scenes);
    if (keys.length <= 1) {
      return;
    }

    const deletedIndex = keys.indexOf(sceneId);
    const remainingKeys = keys.filter((k) => k !== sceneId);
    const replacementSceneId = remainingKeys[Math.min(deletedIndex, remainingKeys.length - 1)] || remainingKeys[0];

    onUpdateProject((prev) => {
      const nextScenes = { ...prev.scenes };
      delete nextScenes[sceneId];
      const remainingKeys = Object.keys(nextScenes);
      const nextStart = prev.start === sceneId ? (replacementSceneId || remainingKeys[0]) : prev.start;
      return {
        ...prev,
        scenes: nextScenes,
        start: nextStart,
      };
    });

    if (activeSceneId === sceneId && replacementSceneId) {
      onSelectScene(replacementSceneId);
    }
    setConfirmDeleteId(null);
  };

  // Set as start scene
  const handleSetStartScene = (sceneId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      start: sceneId,
    }));
  };

  // Move scene order with quick arrows
  const handleMoveSceneOrder = (sceneId: string, direction: 'up' | 'down') => {
    onUpdateProject((prev) => {
      const keys = Object.keys(prev.scenes);
      const currIdx = keys.indexOf(sceneId);
      if (currIdx < 0) return prev;

      const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
      if (targetIdx < 0 || targetIdx >= keys.length) return prev;

      const newKeys = [...keys];
      const [removed] = newKeys.splice(currIdx, 1);
      newKeys.splice(targetIdx, 0, removed);

      const reordered: Record<string, Scene> = {};
      newKeys.forEach((k, idx) => {
        reordered[k] = {
          ...prev.scenes[k],
          order: idx,
        };
      });

      return {
        ...prev,
        scenes: reordered,
      };
    });
  };

  // Reordering scenes with drag & drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSceneId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedSceneId || draggedSceneId === targetId) {
      if (dragOverSceneId !== null) setDragOverSceneId(null);
      if (dropPosition !== null) setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const pos: 'before' | 'after' = (e.clientY - rect.top < rect.height / 2) ? 'before' : 'after';

    if (dragOverSceneId !== targetId || dropPosition !== pos) {
      setDragOverSceneId(targetId);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSceneId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedSceneId || draggedSceneId === targetId) {
      setDraggedSceneId(null);
      setDragOverSceneId(null);
      setDropPosition(null);
      return;
    }

    const pos = dropPosition || 'before';

    onUpdateProject((prev) => {
      const keys = Object.keys(prev.scenes);
      const fromIdx = keys.indexOf(draggedSceneId);
      if (fromIdx < 0) return prev;

      keys.splice(fromIdx, 1);
      let toIdx = keys.indexOf(targetId);
      if (toIdx < 0) return prev;

      if (pos === 'after') {
        toIdx += 1;
      }

      keys.splice(toIdx, 0, draggedSceneId);

      const reordered: Record<string, Scene> = {};
      keys.forEach((k, idx) => {
        reordered[k] = {
          ...prev.scenes[k],
          order: idx,
        };
      });

      return {
        ...prev,
        scenes: reordered,
      };
    });

    setDraggedSceneId(null);
    setDragOverSceneId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedSceneId(null);
    setDragOverSceneId(null);
    setDropPosition(null);
  };

  // --- LAYER MULTI-SELECTION & FOLDER GROUP HANDLERS ---

  // Toggle layer checkbox for batch selection
  const handleToggleLayerSelect = (elId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLayerIds((prev) =>
      prev.includes(elId) ? prev.filter((id) => id !== elId) : [...prev, elId]
    );
  };

  // Select all or clear
  const handleSelectAllLayers = () => {
    if (selectedLayerIds.length === sortedElements.length) {
      setSelectedLayerIds([]);
    } else {
      setSelectedLayerIds(sortedElements.map((el) => el.id));
    }
  };

  // Create a new Layer Group Folder
  const handleCreateGroup = (targetIds?: string[]) => {
    if (!activeScene) return;
    const targetElementIds = targetIds || (selectedLayerIds.length > 0 ? selectedLayerIds : (selectedElementId ? [selectedElementId] : []));
    const newGroupId = `grp_${Date.now()}`;
    const existingGroups = activeScene.groups || [];
    const colorKeys = Object.keys(FOLDER_COLORS);
    const color = colorKeys[existingGroups.length % colorKeys.length] || 'sky';
    const groupName = `文件夹组 ${existingGroups.length + 1}`;

    const newGroup: LayerGroup = {
      id: newGroupId,
      name: groupName,
      collapsed: false,
      visible: true,
      locked: false,
      color,
    };

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: [...(scene.groups || []), newGroup],
            els: scene.els.map((el) =>
              targetElementIds.includes(el.id) ? { ...el, groupId: newGroupId } : el
            ),
          },
        },
      };
    }, `新建图层分组「${groupName}」`);

    setSelectedLayerIds([]);
  };

  // Ungroup a group folder
  const handleUngroup = (groupId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeScene) return;
    const group = activeScene.groups?.find((g) => g.id === groupId);
    const groupName = group?.name || '组';

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: (scene.groups || []).filter((g) => g.id !== groupId),
            els: scene.els.map((el) => (el.groupId === groupId ? { ...el, groupId: undefined } : el)),
          },
        },
      };
    }, `解散分组「${groupName}」`);
  };

  // Toggle group collapse
  const handleToggleGroupCollapse = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: (scene.groups || []).map((g) =>
              g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
            ),
          },
        },
      };
    });
  };

  // Toggle group visibility (propagates to elements in group)
  const handleToggleGroupVisibility = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeScene) return;
    const group = activeScene.groups?.find((g) => g.id === groupId);
    if (!group) return;
    const nextVis = group.visible === false ? true : false;

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: (scene.groups || []).map((g) =>
              g.id === groupId ? { ...g, visible: nextVis } : g
            ),
            els: scene.els.map((el) =>
              el.groupId === groupId ? { ...el, visible: nextVis } : el
            ),
          },
        },
      };
    }, `${nextVis ? '显示' : '隐藏'}分组「${group.name}」`);
  };

  // Toggle group lock (propagates to elements in group)
  const handleToggleGroupLock = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeScene) return;
    const group = activeScene.groups?.find((g) => g.id === groupId);
    if (!group) return;
    const nextLock = !group.locked;

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: (scene.groups || []).map((g) =>
              g.id === groupId ? { ...g, locked: nextLock } : g
            ),
            els: scene.els.map((el) =>
              el.groupId === groupId ? { ...el, locked: nextLock } : el
            ),
          },
        },
      };
    }, `${nextLock ? '锁定' : '解锁'}分组「${group.name}」`);
  };

  // Rename group
  const handleSaveGroupName = (groupId: string) => {
    if (!editingGroupName.trim()) {
      setEditingGroupId(null);
      return;
    }
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: (scene.groups || []).map((g) =>
              g.id === groupId ? { ...g, name: editingGroupName.trim() } : g
            ),
          },
        },
      };
    }, `重命名分组「${editingGroupName.trim()}」`);
    setEditingGroupId(null);
  };

  // Change group color tag
  const handleChangeGroupColor = (groupId: string, color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            groups: (scene.groups || []).map((g) =>
              g.id === groupId ? { ...g, color } : g
            ),
          },
        },
      };
    });
    setActiveColorPickerGroupId(null);
  };

  // Move element into / out of group
  const handleAssignElementToGroup = (elId: string, targetGroupId: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.map((el) =>
              el.id === elId ? { ...el, groupId: targetGroupId || undefined } : el
            ),
          },
        },
      };
    }, targetGroupId ? '移入图层分组' : '从分组中移出');
  };

  // Helper to normalize Z-Index strictly and deterministically based on visual order
  const normalizeZIndices = (elements: SceneElement[]): SceneElement[] => {
    const total = elements.length;
    return elements.map((el, idx) => ({
      ...el,
      zIndex: (total - idx) * 10,
    }));
  };

  // Reset all layer/group drag states
  const resetLayerDragState = () => {
    setDraggedLayerId(null);
    setDraggedGroupId(null);
    setDragOverLayerId(null);
    setDragOverGroupId(null);
    setLayerDropPosition(null);
  };

  // Layer Drag Start
  const handleLayerDragStart = (e: React.DragEvent, elId: string) => {
    e.stopPropagation();
    setDraggedLayerId(elId);
    setDraggedGroupId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `layer:${elId}`);
  };

  // Layer Drag Over
  const handleLayerDragOver = (e: React.DragEvent, targetElId: string, targetGroupId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (draggedLayerId === targetElId) {
      if (dragOverLayerId !== null) setDragOverLayerId(null);
      if (layerDropPosition !== null) setLayerDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const pos: 'before' | 'after' = (e.clientY - rect.top < rect.height / 2) ? 'before' : 'after';

    if (dragOverLayerId !== targetElId || layerDropPosition !== pos) {
      setDragOverLayerId(targetElId);
      setDragOverGroupId(targetGroupId || null);
      setLayerDropPosition(pos);
    }
  };

  // Layer Drop onto another Layer
  const handleLayerDropOnLayer = (e: React.DragEvent, targetElId: string, targetGroupId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeScene) {
      resetLayerDragState();
      return;
    }

    // Case 1: Dragging a Layer onto another Layer
    if (draggedLayerId && draggedLayerId !== targetElId) {
      const pos = layerDropPosition || 'before';

      onUpdateProject((prev) => {
        const scene = prev.scenes[activeSceneId];
        if (!scene) return prev;

        const currentSorted = [...scene.els].sort((a, b) => b.zIndex - a.zIndex);
        const fromIdx = currentSorted.findIndex((el) => el.id === draggedLayerId);
        if (fromIdx < 0) return prev;

        const [movedEl] = currentSorted.splice(fromIdx, 1);
        // If target is in a group, adopt group; if target is ungrouped, clear group
        movedEl.groupId = targetGroupId || undefined;

        let toIdx = currentSorted.findIndex((el) => el.id === targetElId);
        if (toIdx < 0) {
          currentSorted.push(movedEl);
        } else {
          if (pos === 'after') {
            toIdx += 1;
          }
          currentSorted.splice(toIdx, 0, movedEl);
        }

        const normalizedEls = normalizeZIndices(currentSorted);
        return {
          ...prev,
          scenes: {
            ...prev.scenes,
            [activeSceneId]: {
              ...scene,
              els: normalizedEls,
            },
          },
        };
      }, '拖拽调整图层层级');
    }
    // Case 2: Dragging a Group onto a Layer
    else if (draggedGroupId) {
      const pos = layerDropPosition || 'before';

      onUpdateProject((prev) => {
        const scene = prev.scenes[activeSceneId];
        if (!scene) return prev;

        const currentSorted = [...scene.els].sort((a, b) => b.zIndex - a.zIndex);
        const groupEls = currentSorted.filter((el) => el.groupId === draggedGroupId);
        const remainingEls = currentSorted.filter((el) => el.groupId !== draggedGroupId);

        let toIdx = remainingEls.findIndex((el) => el.id === targetElId);
        if (toIdx < 0) {
          remainingEls.push(...groupEls);
        } else {
          if (pos === 'after') {
            toIdx += 1;
          }
          remainingEls.splice(toIdx, 0, ...groupEls);
        }

        const normalizedEls = normalizeZIndices(remainingEls);
        return {
          ...prev,
          scenes: {
            ...prev.scenes,
            [activeSceneId]: {
              ...scene,
              els: normalizedEls,
            },
          },
        };
      }, '拖拽调整分组层级');
    }

    resetLayerDragState();
  };

  // Group Drag Handlers
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.stopPropagation();
    setDraggedGroupId(groupId);
    setDraggedLayerId(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `group:${groupId}`);
  };

  const handleGroupDragOver = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // If dragging a layer over a group folder header, set inside
    if (draggedLayerId) {
      setDragOverGroupId(targetGroupId);
      setDragOverLayerId(null);
      setLayerDropPosition('inside');
      return;
    }

    if (draggedGroupId === targetGroupId) {
      if (dragOverGroupId !== null) setDragOverGroupId(null);
      if (layerDropPosition !== null) setLayerDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const pos: 'before' | 'after' = (e.clientY - rect.top < rect.height / 2) ? 'before' : 'after';

    if (dragOverGroupId !== targetGroupId || layerDropPosition !== pos) {
      setDragOverGroupId(targetGroupId);
      setDragOverLayerId(null);
      setLayerDropPosition(pos);
    }
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeScene) {
      resetLayerDragState();
      return;
    }

    // Case 1: Dropping a Layer inside a Group Folder
    if (draggedLayerId) {
      onUpdateProject((prev) => {
        const scene = prev.scenes[activeSceneId];
        if (!scene) return prev;

        const currentSorted = [...scene.els].sort((a, b) => b.zIndex - a.zIndex);
        const fromIdx = currentSorted.findIndex((el) => el.id === draggedLayerId);
        if (fromIdx < 0) return prev;

        const [movedEl] = currentSorted.splice(fromIdx, 1);
        movedEl.groupId = targetGroupId;

        // Place at the top of that group's elements
        const firstGroupElIdx = currentSorted.findIndex((el) => el.groupId === targetGroupId);
        if (firstGroupElIdx >= 0) {
          currentSorted.splice(firstGroupElIdx, 0, movedEl);
        } else {
          currentSorted.unshift(movedEl);
        }

        const normalizedEls = normalizeZIndices(currentSorted);
        return {
          ...prev,
          scenes: {
            ...prev.scenes,
            [activeSceneId]: {
              ...scene,
              groups: (scene.groups || []).map((g) =>
                g.id === targetGroupId ? { ...g, collapsed: false } : g
              ),
              els: normalizedEls,
            },
          },
        };
      }, '图层移入分组');
    }
    // Case 2: Dropping a Group above/below another Group
    else if (draggedGroupId && draggedGroupId !== targetGroupId) {
      const pos = layerDropPosition === 'after' ? 'after' : 'before';

      onUpdateProject((prev) => {
        const scene = prev.scenes[activeSceneId];
        if (!scene) return prev;

        const currentSorted = [...scene.els].sort((a, b) => b.zIndex - a.zIndex);
        const groupEls = currentSorted.filter((el) => el.groupId === draggedGroupId);
        const remainingEls = currentSorted.filter((el) => el.groupId !== draggedGroupId);

        const targetGroupIndices = remainingEls
          .map((el, i) => (el.groupId === targetGroupId ? i : -1))
          .filter((i) => i !== -1);

        let insertIdx = 0;
        if (targetGroupIndices.length > 0) {
          if (pos === 'before') {
            insertIdx = targetGroupIndices[0];
          } else {
            insertIdx = targetGroupIndices[targetGroupIndices.length - 1] + 1;
          }
        } else {
          insertIdx = 0;
        }

        remainingEls.splice(insertIdx, 0, ...groupEls);
        const normalizedEls = normalizeZIndices(remainingEls);

        // Reorder groups metadata array as well
        const groups = [...(scene.groups || [])];
        const gFrom = groups.findIndex((g) => g.id === draggedGroupId);
        if (gFrom >= 0) {
          const [movedGroup] = groups.splice(gFrom, 1);
          let gTo = groups.findIndex((g) => g.id === targetGroupId);
          if (gTo >= 0) {
            if (pos === 'after') gTo += 1;
            groups.splice(gTo, 0, movedGroup);
          } else {
            groups.push(movedGroup);
          }
        }

        return {
          ...prev,
          scenes: {
            ...prev.scenes,
            [activeSceneId]: {
              ...scene,
              groups,
              els: normalizedEls,
            },
          },
        };
      }, '拖拽调整分组顺序');
    }

    resetLayerDragState();
  };

  const handleDropToUngrouped = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeScene || !draggedLayerId) {
      resetLayerDragState();
      return;
    }

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;

      const currentSorted = [...scene.els].sort((a, b) => b.zIndex - a.zIndex);
      const fromIdx = currentSorted.findIndex((el) => el.id === draggedLayerId);
      if (fromIdx < 0) return prev;

      const [movedEl] = currentSorted.splice(fromIdx, 1);
      movedEl.groupId = undefined;
      currentSorted.push(movedEl);

      const normalizedEls = normalizeZIndices(currentSorted);
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: normalizedEls,
          },
        },
      };
    }, '移出图层分组');

    resetLayerDragState();
  };

  // Move Group Z-index with single-click arrow buttons (100% deterministic)
  const handleMoveGroupZ = (groupId: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeScene) return;
    const currentSorted = [...activeScene.els].sort((a, b) => b.zIndex - a.zIndex);
    const groupEls = currentSorted.filter((el) => el.groupId === groupId);
    if (groupEls.length === 0) return;

    const remainingEls = currentSorted.filter((el) => el.groupId !== groupId);
    const firstGroupElIdx = currentSorted.findIndex((el) => el.groupId === groupId);
    let lastGroupElIdx = -1;
    for (let i = currentSorted.length - 1; i >= 0; i--) {
      if (currentSorted[i].groupId === groupId) {
        lastGroupElIdx = i;
        break;
      }
    }

    let newInsertIdx = 0;
    if (direction === 'up') {
      if (firstGroupElIdx <= 0) return; // already at top
      const aboveEl = currentSorted[firstGroupElIdx - 1];
      const aboveIdxInRemaining = remainingEls.findIndex((e) => e.id === aboveEl.id);
      newInsertIdx = Math.max(0, aboveIdxInRemaining);
    } else {
      if (lastGroupElIdx >= currentSorted.length - 1 || lastGroupElIdx === -1) return; // already at bottom
      const belowEl = currentSorted[lastGroupElIdx + 1];
      const belowIdxInRemaining = remainingEls.findIndex((e) => e.id === belowEl.id);
      newInsertIdx = Math.min(remainingEls.length, belowIdxInRemaining + 1);
    }

    remainingEls.splice(newInsertIdx, 0, ...groupEls);
    const normalizedEls = normalizeZIndices(remainingEls);

    onUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...activeScene,
          els: normalizedEls,
        },
      },
    }), `整体${direction === 'up' ? '上移' : '下移'}分组`);
  };

  // Batch delete selected layers
  const handleBatchDeleteSelected = () => {
    if (selectedLayerIds.length === 0 || !activeScene) return;
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.filter((el) => !selectedLayerIds.includes(el.id)),
          },
        },
      };
    }, `批量删除 ${selectedLayerIds.length} 个图层`);
    setSelectedLayerIds([]);
    if (selectedElementId && selectedLayerIds.includes(selectedElementId)) {
      onSelectElement(null);
    }
  };

  // Batch toggle visibility
  const handleBatchToggleVisibility = () => {
    if (selectedLayerIds.length === 0 || !activeScene) return;
    const anyVisible = selectedLayerIds.some((id) => {
      const el = activeScene.els.find((e) => e.id === id);
      return el && el.visible !== false;
    });
    const nextVis = !anyVisible;

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.map((el) =>
              selectedLayerIds.includes(el.id) ? { ...el, visible: nextVis } : el
            ),
          },
        },
      };
    }, `批量${nextVis ? '显示' : '隐藏'}选中图层`);
  };

  // Batch toggle lock
  const handleBatchToggleLock = () => {
    if (selectedLayerIds.length === 0 || !activeScene) return;
    const anyLocked = selectedLayerIds.some((id) => {
      const el = activeScene.els.find((e) => e.id === id);
      return el && el.locked;
    });
    const nextLock = !anyLocked;

    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.map((el) =>
              selectedLayerIds.includes(el.id) ? { ...el, locked: nextLock } : el
            ),
          },
        },
      };
    }, `批量${nextLock ? '锁定' : '解锁'}选中图层`);
  };

  // Layer ordering with single-click arrow buttons (100% deterministic & normalized)
  const handleMoveLayerZ = (elId: string, direction: 'up' | 'down') => {
    if (!activeScene) return;
    const currentSorted = [...activeScene.els].sort((a, b) => b.zIndex - a.zIndex);
    const currIdx = currentSorted.findIndex((e) => e.id === elId);
    if (currIdx < 0) return;

    // Moving UP in visual layer tree means moving closer to index 0 (higher zIndex)
    // Moving DOWN in visual layer tree means moving closer to index N-1 (lower zIndex)
    const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
    if (targetIdx < 0 || targetIdx >= currentSorted.length) return;

    const temp = currentSorted[currIdx];
    currentSorted[currIdx] = currentSorted[targetIdx];
    currentSorted[targetIdx] = temp;

    const normalizedEls = normalizeZIndices(currentSorted);

    onUpdateProject((prev) => ({
      ...prev,
      scenes: {
        ...prev.scenes,
        [activeSceneId]: {
          ...activeScene,
          els: normalizedEls,
        },
      },
    }), `调整图层层级 (${direction === 'up' ? '上移' : '下移'})`);
  };

  const handleToggleLayerVisibility = (elId: string) => {
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.map((el) =>
              el.id === elId ? { ...el, visible: el.visible === false ? true : false } : el
            ),
          },
        },
      };
    });
  };

  const handleToggleLayerLock = (elId: string) => {
    onUpdateProject((prev) => {
      const scene = prev.scenes[activeSceneId];
      if (!scene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...scene,
            els: scene.els.map((el) =>
              el.id === elId ? { ...el, locked: !el.locked } : el
            ),
          },
        },
      };
    });
  };

  // 剪映式图层多选：普通点击=单选，Ctrl/Cmd=追加/取消，Shift=范围选择（按图层排列顺序）
  const handleLayerItemClick = (e: React.MouseEvent, el: SceneElement) => {
    e.stopPropagation();

    if (e.shiftKey) {
      const anchorId = selectedElementId || multiSelectedIds[multiSelectedIds.length - 1] || null;
      const idx1 = anchorId ? sortedElements.findIndex((x) => x.id === anchorId) : -1;
      const idx2 = sortedElements.findIndex((x) => x.id === el.id);
      if (idx1 >= 0 && idx2 >= 0) {
        const [lo, hi] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        const ids = sortedElements.slice(lo, hi + 1).map((x) => x.id);
        onMultiSelectionChange(ids, el.id);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      const isIn = multiSelectedIds.includes(el.id);
      const next = isIn
        ? multiSelectedIds.filter((id) => id !== el.id)
        : [...multiSelectedIds, el.id];
      onMultiSelectionChange(next, el.id);
      return;
    }

    onSelectElement(el.id);
  };

  // Render a single layer item row
  const renderLayerItem = (el: SceneElement, inGroup: boolean = false, groupColor?: string) => {
    const isSelected = multiSelectedIds.includes(el.id);
    const isChecked = selectedLayerIds.includes(el.id);
    const isVisible = el.visible !== false;
    const colorDef = groupColor ? getGroupColorConfig(groupColor) : null;
    const isBeingDragged = draggedLayerId === el.id;
    const isDragOver = dragOverLayerId === el.id;

    const currIdx = sortedElements.findIndex((e) => e.id === el.id);
    const isTop = currIdx === 0;
    const isBottom = currIdx === sortedElements.length - 1;

    return (
      <div
        key={el.id}
        draggable={!el.locked}
        onDragStart={(e) => handleLayerDragStart(e, el.id)}
        onDragOver={(e) => handleLayerDragOver(e, el.id, el.groupId)}
        onDrop={(e) => handleLayerDropOnLayer(e, el.id, el.groupId)}
        onDragEnd={resetLayerDragState}
        onClick={(e) => handleLayerItemClick(e, el)}
        className={`relative flex items-center justify-between px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-all group/item ${
          isSelected
            ? 'bg-sky-500/20 border-sky-500/60 text-white font-medium shadow-sm ring-1 ring-sky-500/30'
            : isChecked
            ? 'bg-sky-950/40 border-sky-600/40 text-slate-200'
            : inGroup
            ? 'bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/[0.07] text-slate-300'
            : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/[0.08] text-slate-300'
        } ${!isVisible ? 'opacity-40' : ''} ${isBeingDragged ? 'opacity-30 ring-1 ring-sky-400 scale-[0.98]' : ''}`}
      >
        {/* Drop Insertion Visual Guides */}
        {isDragOver && layerDropPosition === 'before' && (
          <div className="absolute -top-[2px] left-0 right-0 h-[3px] bg-sky-400 z-30 rounded shadow-[0_0_8px_#38bdf8] pointer-events-none flex items-center">
            <div className="w-2 h-2 rounded-full bg-sky-400 -ml-1 ring-2 ring-black" />
          </div>
        )}
        {isDragOver && layerDropPosition === 'after' && (
          <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-sky-400 z-30 rounded shadow-[0_0_8px_#38bdf8] pointer-events-none flex items-center">
            <div className="w-2 h-2 rounded-full bg-sky-400 -ml-1 ring-2 ring-black" />
          </div>
        )}

        <div className="flex items-center gap-1 overflow-hidden flex-1 mr-1.5">
          {/* Drag Handle */}
          <span 
            title={el.locked ? '图层已锁定，无法拖拽' : '按住拖拽调整图层层级或移入/移出分组'} 
            className={`p-0.5 -ml-0.5 rounded transition-colors ${el.locked ? 'text-slate-700 cursor-not-allowed' : 'text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing'}`}
          >
            <GripVertical size={13} />
          </span>

          {/* Multi-select Checkbox */}
          <button
            type="button"
            onClick={(e) => handleToggleLayerSelect(el.id, e)}
            title={isChecked ? '取消勾选' : '勾选此图层用于多选编组'}
            className="p-0.5 text-slate-400 hover:text-sky-400 rounded transition-colors"
          >
            {isChecked ? (
              <CheckSquare size={13} className="text-sky-400 fill-sky-400/20" />
            ) : (
              <Square size={13} className="text-slate-500 hover:text-slate-300" />
            )}
          </button>

          {/* Group Label Color Dot Indicator */}
          {inGroup && colorDef && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: colorDef.tag }}
              title={`所属组颜色标记: ${colorDef.label} (${colorDef.tag})`}
            />
          )}

          {/* Element Type Indicator */}
          {el.type === 'group' ? (
            <span
              className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center bg-indigo-500/30 text-indigo-300"
              title={`合并图层组（${(el.children || []).length} 个图层）`}
            >
              <Layers2 size={10} />
            </span>
          ) : el.type === 'shape' ? (
            <span 
              className="w-3.5 h-3.5 shrink-0 border border-white/20 shadow-2xs inline-block"
              style={{ 
                background: getShapeBackground(el),
                borderRadius: el.borderRadius ? `${Math.min(4, el.borderRadius)}px` : '2px',
                clipPath: el.clipPath || undefined,
              }}
              title={`形状: ${el.shapeKind || '卡片'}`}
            />
          ) : (
            <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-400 font-mono">
              {el.type.toUpperCase()}
            </span>
          )}

          <span className="truncate text-xs font-normal" title={el.type === 'group' ? (el.componentInstance ? (el.sourceName || '组件副本') : `合并图层组（${(el.children || []).length} 个图层）`) : (el.sourceName || el.content)}>
            {el.type === 'group'
              ? (el.componentInstance ? (el.sourceName || `组件副本（${(el.children || []).length}）`) : `合并图层组（${(el.children || []).length}）`)
              : (el.sourceName || el.content || (el.type === 'txt' ? '文字图层' : '视觉元素'))}
          </span>

          {el.is3dLayer && (
            <span className="text-[9px] px-1 bg-purple-500/30 text-purple-300 rounded font-mono shrink-0">3D</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* 合并图层组：拆开恢复独立图层；组件副本请在右侧检查器分离 */}
          {el.type === 'group' && !el.componentInstance && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUnmergeElement?.(el.id); }}
              title="拆开合并图层组，恢复为独立图层"
              className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-all"
            >
              <Unlink size={11} />
            </button>
          )}

          {/* If in group, offer remove from group button */}
          {inGroup && (
            <button
              type="button"
              onClick={(e) => handleAssignElementToGroup(el.id, null, e)}
              title="移出此分组"
              className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
            >
              <Unlink size={11} />
            </button>
          )}

          {/* If ungrouped and groups exist, quick add to group */}
          {!inGroup && sceneGroups.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setGroupDropdownId(groupDropdownId === el.id ? null : el.id);
                }}
                title="加入图层分组"
                className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10 rounded transition-all"
              >
                <FolderPlus size={11} />
              </button>

              {groupDropdownId === el.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 w-36 bg-[#181b26] border border-white/20 rounded-lg shadow-2xl z-50 p-1 text-xs space-y-0.5 animate-in fade-in-50 zoom-in-95"
                >
                  <div className="px-2 py-1 text-[10px] text-slate-400 font-semibold border-b border-white/10">
                    移入分组:
                  </div>
                  {sceneGroups.map((grp) => {
                    const cDef = getGroupColorConfig(grp.color);
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={(e) => {
                          handleAssignElementToGroup(el.id, grp.id, e);
                          setGroupDropdownId(null);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-sky-600/30 hover:text-sky-200 text-slate-300 truncate text-[11px] flex items-center gap-1.5"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: cDef.tag }}
                        />
                        <span className="truncate flex-1">{grp.name}</span>
                        <span className="text-[9px] text-slate-500">{cDef.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Layer Move Up/Down */}
          <button
            type="button"
            disabled={isTop}
            onClick={(e) => {
              e.stopPropagation();
              handleMoveLayerZ(el.id, 'up');
            }}
            title={isTop ? '已在最顶层' : '上移一层 (升高层级)'}
            className={`p-1 rounded transition-colors ${
              isTop ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ArrowUp size={11} />
          </button>
          <button
            type="button"
            disabled={isBottom}
            onClick={(e) => {
              e.stopPropagation();
              handleMoveLayerZ(el.id, 'down');
            }}
            title={isBottom ? '已在最底层' : '下移一层 (降低层级)'}
            className={`p-1 rounded transition-colors ${
              isBottom ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ArrowDown size={11} />
          </button>

          {/* Lock */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleLayerLock(el.id);
            }}
            title={el.locked ? '解锁图层' : '锁定图层'}
            className={`p-1 rounded ${el.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {el.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>

          {/* Visibility */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleLayerVisibility(el.id);
            }}
            title={isVisible ? '隐藏图层' : '显示图层'}
            className={`p-1 rounded ${isVisible ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
          >
            {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside
      style={{ width: width ? width + 52 : 312 }}
      className="bg-[#0e121a] border-r border-white/10 flex h-full select-none text-xs text-slate-300 min-w-0 shrink-0"
    >
      {/* 剪映风格 52px 垂直主功能大中枢 (Left Rail) */}
      <div className="w-[52px] shrink-0 bg-[#0a0d14] border-r border-white/[0.08] flex flex-col items-center py-2 gap-1 z-10">
        {RAIL_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-[44px] h-[48px] rounded-lg flex flex-col items-center justify-center gap-1 transition-all relative group ${
                isActive
                  ? 'bg-sky-500/15 text-sky-400 font-semibold shadow-inner'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
              title={`${tab.label}面板`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-sky-500 rounded-r" />
              )}
              <div className="transition-transform group-hover:scale-110">
                {tab.icon}
              </div>
              <span className="text-[10px] tracking-tight leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 右侧抽屉内容区 (Drawer Panel) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#10141d] min-w-0">
      {/* Tab Content 1: SCENES LIST */}
      {activeTab === 'scenes' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider">场景序列与路由</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white/10 text-slate-400 rounded-full">
                {Object.keys(projectData.scenes).length}
              </span>
            </div>
            <button
              type="button"
              onClick={onNewScene}
              className="flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-[11px] transition-colors shadow-sm"
            >
              <Plus size={12} />
              <span>新建场景</span>
            </button>
          </div>

          <div ref={sceneListRef} className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-2.5">
            {(Object.values(projectData.scenes) as Scene[]).map((scene, idx, arr) => {
              const isActive = scene.id === activeSceneId;
              const isStart = scene.id === projectData.start;
              const isBeingDragged = draggedSceneId === scene.id;
              const isDropBefore = dragOverSceneId === scene.id && dropPosition === 'before';
              const isDropAfter = dragOverSceneId === scene.id && dropPosition === 'after';

              return (
                <div
                  key={scene.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, scene.id)}
                  onDragOver={(e) => handleDragOver(e, scene.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, scene.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectScene(scene.id)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer group relative ${
                    isBeingDragged
                      ? 'opacity-30 scale-[0.98] border-dashed border-sky-400 bg-sky-950/20'
                      : isActive
                      ? 'bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/50 ring-1 ring-sky-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                  }`}
                >
                  {/* Top Drop Indicator Bar */}
                  {isDropBefore && (
                    <div className="absolute -top-1.5 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 rounded-full shadow-[0_0_12px_#38bdf8] z-30 pointer-events-none flex items-center justify-between px-0.5">
                      <span className="w-2 h-2 rounded-full bg-white shadow-md -ml-1 ring-2 ring-sky-400" />
                      <span className="w-2 h-2 rounded-full bg-white shadow-md -mr-1 ring-2 ring-sky-400" />
                    </div>
                  )}

                  {/* Bottom Drop Indicator Bar */}
                  {isDropAfter && (
                    <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 rounded-full shadow-[0_0_12px_#38bdf8] z-30 pointer-events-none flex items-center justify-between px-0.5">
                      <span className="w-2 h-2 rounded-full bg-white shadow-md -ml-1 ring-2 ring-sky-400" />
                      <span className="w-2 h-2 rounded-full bg-white shadow-md -mr-1 ring-2 ring-sky-400" />
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-1">
                      {/* Drag Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-sky-400 p-0.5 -ml-1 rounded transition-colors"
                        title="按住拖拽调整播放顺序"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={13} />
                      </div>

                      <span className="font-mono text-[10px] text-slate-400 font-bold">#{idx + 1}</span>

                      {editingSceneId === scene.id ? (
                        <input
                          type="text"
                          value={editingAlias}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingAlias(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onUpdateProject((prev) => ({
                                ...prev,
                                scenes: {
                                  ...prev.scenes,
                                  [scene.id]: { ...scene, alias: editingAlias.trim() || scene.alias },
                                },
                              }));
                              setEditingSceneId(null);
                            } else if (e.key === 'Escape') {
                              setEditingSceneId(null);
                            }
                          }}
                          onBlur={() => {
                            onUpdateProject((prev) => ({
                              ...prev,
                              scenes: {
                                ...prev.scenes,
                                [scene.id]: { ...scene, alias: editingAlias.trim() || scene.alias },
                              },
                            }));
                            setEditingSceneId(null);
                          }}
                          className="bg-black/60 border border-sky-400 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full"
                        />
                      ) : (
                        <span 
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingSceneId(scene.id);
                            setEditingAlias(scene.alias || '');
                          }}
                          title="双击直接重命名场景"
                          className={`font-semibold truncate text-xs cursor-text ${isActive ? 'text-sky-300' : 'text-slate-200'}`}
                        >
                          {scene.alias || '未命名场景'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isStart ? (
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] rounded font-mono font-semibold flex items-center gap-0.5">
                          <Flag size={9} />
                          <span>START</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetStartScene(scene.id);
                          }}
                          title="设为初始播放场景"
                          className="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-[9px] text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-all"
                        >
                          设为起始
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                    <div className="flex items-center gap-3">
                      <span>⏱️ {scene.duration}s</span>
                      <span>{isPopupScene(scene) ? '🪟 模态界面' : '🎬 画布场景'}</span>
                      {scene.gestureBindings && scene.gestureBindings.length > 0 && (
                        <span
                          title={'体感手势：' + scene.gestureBindings.map((b) => (GESTURE_LABELS[b.gesture] || b.gesture)).join('、')}
                          className="flex items-center gap-0.5 px-1 py-0.5 bg-violet-500/15 border border-violet-500/30 rounded text-[10px]"
                        >
                          {scene.gestureBindings.map((b) => (
                            <span key={b.id}>{GESTURE_ICONS[b.gesture] || '🖐'}</span>
                          ))}
                        </span>
                      )}
                      {isPopupScene(scene) && (
                        <span
                          title="仅作为弹窗内容 / UI 界面层，不参与自动轮播与巡航"
                          className="text-[9px] text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded px-1"
                        >
                          🚫 不轮播
                        </span>
                      )}
                      {scene.bgmRef && <Music size={11} className="text-pink-400" />}
                    </div>

                    {/* Quick Action Controls */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSceneOrder(scene.id, 'up');
                        }}
                        title="上移场景"
                        className="p-1 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-300"
                      >
                        <ArrowUp size={11} />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSceneOrder(scene.id, 'down');
                        }}
                        title="下移场景"
                        className="p-1 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-300"
                      >
                        <ArrowDown size={11} />
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateScene(scene.id);
                        }}
                        title="复制场景"
                        className="p-1 hover:bg-white/10 rounded text-slate-300"
                      >
                        <Copy size={11} />
                      </button>

                      {/* Delete */}
                      {confirmDeleteId === scene.id ? (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-rose-950/90 border border-rose-500/80 px-1 py-0.5 rounded text-[10px]"
                        >
                          <span className="text-rose-200">删?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteScene(scene.id)}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-1 rounded font-bold"
                          >
                            是
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-400 hover:text-white px-0.5"
                          >
                            否
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (Object.keys(projectData.scenes).length <= 1) return;
                            setConfirmDeleteId(scene.id);
                          }}
                          disabled={Object.keys(projectData.scenes).length <= 1}
                          title={Object.keys(projectData.scenes).length <= 1 ? '至少需要保留一个场景' : '删除场景'}
                          className="p-1 hover:bg-rose-500/20 text-rose-400 disabled:opacity-20 disabled:hover:bg-transparent rounded"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Transition Info Pill */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px]">
                    <div className="flex items-center gap-1 text-amber-400/90 font-medium">
                      <Sparkles size={10} className="text-amber-400" />
                      <span>{TRANSITION_LABELS[scene.transitionIn || 'fade'] || '🌫️ 淡入'}</span>
                      <span className="text-slate-500 font-mono">({(scene.transitionDuration ?? 0.6).toFixed(1)}s)</span>
                    </div>

                    {scene.transitionOut && scene.transitionOut !== 'none' && (
                      <span className="text-indigo-300/80 font-mono">
                        出: {TRANSITION_LABELS[scene.transitionOut] || scene.transitionOut}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Helper Tip */}
            <div className="pt-2">
              <div className="px-2.5 py-2 text-[10px] text-slate-400/80 bg-white/[0.03] border border-white/5 rounded-md flex items-center gap-2">
                <GripVertical size={13} className="text-sky-400 shrink-0" />
                <span>按住手柄或卡片拖拽可调整场景播放顺序与路由</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: LAYERS & FOLDER GROUPS TREE */}
      {activeTab === 'layers' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Bar */}
          <div className="p-2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider">图层与分组</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white/10 text-slate-400 rounded-full">
                {sortedElements.length}
              </span>
              {sceneGroups.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  {sceneGroups.length} 组
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onSelectAll}
                title="多选全选所有图层 (Ctrl+A)"
                className="flex items-center gap-1 px-1.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded font-medium text-[10px] transition-colors"
              >
                <Layers size={11} />
                <span>多选全选</span>
                {multiSelectedIds.length > 1 && (
                  <span className="text-[9px] font-mono bg-sky-500/30 px-1 rounded">{multiSelectedIds.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                title="取消多选"
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={13} />
              </button>

              <button
                type="button"
                onClick={handleSelectAllLayers}
                title={selectedLayerIds.length === sortedElements.length ? '取消全选' : '全选图层'}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-slate-200 transition-colors"
              >
                {selectedLayerIds.length > 0 && selectedLayerIds.length === sortedElements.length ? (
                  <CheckSquare size={13} className="text-sky-400" />
                ) : (
                  <Square size={13} />
                )}
              </button>

              <button
                type="button"
                onClick={() => { onMergeElements?.(selectedLayerIds.length > 0 ? selectedLayerIds : undefined); setSelectedLayerIds([]); }}
                title="将选中图层合并为一个图层（嵌套容器，可随时拆开）"
                className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded font-medium text-[11px] transition-all shadow-sm active:scale-95"
              >
                <Layers2 size={12} />
                <span>合并图层</span>
              </button>
            </div>
          </div>

          {/* Multi-selection Batch Actions Banner */}
          {selectedLayerIds.length > 0 && (
            <div className="p-2 bg-sky-950/60 border-b border-sky-500/30 flex items-center justify-between text-xs text-sky-200 animate-in fade-in-50 slide-in-from-top-1">
              <span className="text-[11px] font-semibold text-sky-300 flex items-center gap-1">
                <CheckSquare size={12} className="text-sky-400" />
                <span>已选 {selectedLayerIds.length} 项</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { onMergeElements?.(selectedLayerIds); setSelectedLayerIds([]); }}
                  title="将已选中的图层合并为一个图层（可随时拆开）"
                  className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Layers2 size={10} />
                  <span>合并</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchToggleVisibility}
                  title="批量切换显隐"
                  className="p-1 hover:bg-sky-900/60 rounded text-sky-200"
                >
                  <Eye size={11} />
                </button>
                <button
                  type="button"
                  onClick={handleBatchToggleLock}
                  title="批量切换锁定"
                  className="p-1 hover:bg-sky-900/60 rounded text-sky-200"
                >
                  <Lock size={11} />
                </button>
                <button
                  type="button"
                  onClick={handleBatchDeleteSelected}
                  title="批量删除已选图层"
                  className="p-1 hover:bg-red-500/30 rounded text-rose-300"
                >
                  <Trash2 size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLayerIds([])}
                  title="清除多选"
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Group Filter Bar (Quick Navigation) */}
          {sceneGroups.length > 0 && (
            <div className="px-2 pt-2 pb-1 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/5 bg-black/20">
              <button
                type="button"
                onClick={() => setFilterGroupId(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all shrink-0 flex items-center gap-1 ${
                  filterGroupId === null
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>全部</span>
                <span className="text-[9px] opacity-70">({sortedElements.length})</span>
              </button>

              {sceneGroups.map((grp) => {
                const cDef = getGroupColorConfig(grp.color);
                const count = getGroupElements(grp.id).length;
                const isSelected = filterGroupId === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setFilterGroupId(isSelected ? null : grp.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all shrink-0 flex items-center gap-1.5 border ${
                      isSelected
                        ? `${cDef.bg} ${cDef.text} ${cDef.border} font-semibold ring-1 ${cDef.ring}`
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: cDef.tag }}
                    />
                    <span className="truncate max-w-[70px]">{grp.name}</span>
                    <span className="text-[9px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Layer & Group Tree List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sortedElements.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                当前场景暂无图层元素<br />
                点击顶部工具栏添加
              </div>
            ) : (
              <>
                {/* 1. RENDER FOLDER GROUPS */}
                {sceneGroups
                  .filter((group) => !filterGroupId || filterGroupId === group.id)
                  .map((group) => {
                  const groupElements = getGroupElements(group.id);
                  const isCollapsed = group.collapsed;
                  const isVisible = group.visible !== false;
                  const isLocked = !!group.locked;
                  const colorConfig = getGroupColorConfig(group.color);
                  const isBeingDraggedGroup = draggedGroupId === group.id;
                  const isDragOverGroup = dragOverGroupId === group.id;

                  return (
                    <div
                      key={group.id}
                      draggable={!isLocked}
                      onDragStart={(e) => handleGroupDragStart(e, group.id)}
                      onDragOver={(e) => handleGroupDragOver(e, group.id)}
                      onDrop={(e) => handleGroupDrop(e, group.id)}
                      onDragEnd={resetLayerDragState}
                      className={`relative rounded-lg border transition-all ${colorConfig.border} ${colorConfig.bg} overflow-hidden shadow-sm ${
                        isBeingDraggedGroup ? 'opacity-30 ring-1 ring-sky-400 scale-[0.98]' : ''
                      } ${
                        isDragOverGroup && layerDropPosition === 'inside'
                          ? 'ring-2 ring-sky-400 bg-sky-500/30'
                          : ''
                      }`}
                    >
                      {/* Group Drop Insertion Line (Before/After) */}
                      {isDragOverGroup && layerDropPosition === 'before' && (
                        <div className="absolute -top-[2px] left-0 right-0 h-[3px] bg-sky-400 z-30 rounded shadow-[0_0_8px_#38bdf8] pointer-events-none flex items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 -ml-1 ring-2 ring-black" />
                        </div>
                      )}
                      {isDragOverGroup && layerDropPosition === 'after' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-sky-400 z-30 rounded shadow-[0_0_8px_#38bdf8] pointer-events-none flex items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 -ml-1 ring-2 ring-black" />
                        </div>
                      )}

                      {/* Group Folder Header */}
                      <div
                        onClick={(e) => handleToggleGroupCollapse(group.id, e)}
                        className="px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors group/hdr relative"
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-1">
                          {/* Drag Handle for Group */}
                          <span 
                            title={isLocked ? '文件夹已锁定' : '按住拖拽调整文件夹顺序，或将图层拖入此文件夹'}
                            className={`p-0.5 -ml-1 rounded transition-colors ${
                              isLocked ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-slate-200 cursor-grab active:cursor-grabbing'
                            }`}
                          >
                            <GripVertical size={13} />
                          </span>

                          {/* Expand/Collapse Chevron */}
                          <span className="text-slate-400 hover:text-white transition-transform">
                            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          </span>

                          {/* Label Color Dot Indicator */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveColorPickerGroupId(activeColorPickerGroupId === group.id ? null : group.id);
                            }}
                            title={`颜色标记: ${colorConfig.label} (${colorConfig.tag})\n点击修改颜色标记`}
                            className="relative p-0.5 rounded-full hover:scale-125 transition-transform flex items-center justify-center shrink-0"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full block ring-1 ring-white/30 shadow-xs"
                              style={{ backgroundColor: colorConfig.tag }}
                            />
                          </button>

                          {/* Colored Folder Icon */}
                          <Folder size={13} className={colorConfig.text} />

                          {/* Editable Group Name */}
                          {editingGroupId === group.id ? (
                            <input
                              type="text"
                              value={editingGroupName}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveGroupName(group.id);
                                else if (e.key === 'Escape') setEditingGroupId(null);
                              }}
                              onBlur={() => handleSaveGroupName(group.id)}
                              className="bg-black/80 border border-sky-400 rounded px-1.5 py-0.2 text-xs text-white outline-none w-full font-semibold"
                            />
                          ) : (
                            <span
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingGroupId(group.id);
                                setEditingGroupName(group.name);
                              }}
                              title="双击直接重命名分组"
                              className="font-bold text-xs text-slate-100 truncate cursor-text"
                            >
                              {group.name}
                            </span>
                          )}

                          {/* Count Badge */}
                          <span className="text-[9px] font-mono px-1 py-0.2 bg-black/40 text-slate-300 rounded shrink-0">
                            {groupElements.length}
                          </span>
                        </div>

                        {/* Group Quick Actions */}
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Color Picker & Group Settings Toggle */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveColorPickerGroupId(activeColorPickerGroupId === group.id ? null : group.id);
                              }}
                              title="图层组设置与颜色标记 (Label Color)"
                              className={`p-1 rounded transition-colors ${
                                activeColorPickerGroupId === group.id
                                  ? 'bg-sky-500 text-white'
                                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Palette size={11} />
                            </button>

                            {/* Label Color Popover */}
                            {activeColorPickerGroupId === group.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                              >
                                <div 
                                  className="w-72 bg-[#181b26] border border-white/20 rounded-xl shadow-2xl p-3 space-y-3 text-xs animate-in fade-in-50 zoom-in-95"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Popover Header */}
                                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white/20"
                                        style={{ backgroundColor: colorConfig.tag }}
                                      />
                                      <span className="font-bold text-white text-xs">
                                        图层组颜色标记 (Label Color)
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setActiveColorPickerGroupId(null)}
                                      className="p-1 text-slate-400 hover:text-white rounded"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>

                                  {/* Active Color Info */}
                                  <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
                                    <span className="text-[11px] text-slate-400">当前标记:</span>
                                    <span className="text-[11px] font-medium text-white flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full inline-block"
                                        style={{ backgroundColor: colorConfig.tag }}
                                      />
                                      <span>{colorConfig.label}</span>
                                      <span className="text-[10px] font-mono text-slate-400">({colorConfig.tag})</span>
                                    </span>
                                  </div>

                                  {/* Color Swatches Grid */}
                                  <div>
                                    <label className="block text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
                                      选择预设颜色:
                                    </label>
                                    <div className="grid grid-cols-6 gap-1.5">
                                      {Object.entries(FOLDER_COLORS).map(([cKey, cVal]) => {
                                        const isCurrent = (group.color || 'sky') === cKey;
                                        return (
                                          <button
                                            key={cKey}
                                            type="button"
                                            onClick={(e) => handleChangeGroupColor(group.id, cKey, e)}
                                            title={`${cVal.label} (${cVal.tag})`}
                                            style={{ backgroundColor: cVal.tag }}
                                            className={`w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition-transform flex items-center justify-center relative ${
                                              isCurrent ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-lg' : ''
                                            }`}
                                          >
                                            {isCurrent && <Check size={13} className="text-white drop-shadow" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Custom Color Input */}
                                  <div className="border-t border-white/10 pt-2 space-y-1.5">
                                    <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                      自定义 HEX 颜色:
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={customHex}
                                        onChange={(e) => setCustomHex(e.target.value)}
                                        className="w-8 h-7 bg-transparent border border-white/20 rounded cursor-pointer"
                                      />
                                      <input
                                        type="text"
                                        value={customHex}
                                        onChange={(e) => setCustomHex(e.target.value)}
                                        placeholder="#38bdf8"
                                        className="flex-1 bg-black/50 border border-white/15 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-sky-400"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => handleChangeGroupColor(group.id, customHex, e)}
                                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold"
                                      >
                                        应用
                                      </button>
                                    </div>
                                  </div>

                                  {/* Group Quick Operations */}
                                  <div className="border-t border-white/10 pt-2 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedLayerIds(groupElements.map((el) => el.id));
                                        setActiveColorPickerGroupId(null);
                                      }}
                                      className="flex-1 py-1 px-2 bg-white/5 hover:bg-white/10 text-slate-200 rounded text-[11px] font-medium transition-colors"
                                    >
                                      全选组内图层 ({groupElements.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        handleUngroup(group.id, e);
                                        setActiveColorPickerGroupId(null);
                                      }}
                                      className="py-1 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded text-[11px] font-medium transition-colors"
                                    >
                                      解散分组
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Move Group Z-index */}
                          <button
                            type="button"
                            onClick={(e) => handleMoveGroupZ(group.id, 'up', e)}
                            title="整体上移一层"
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleMoveGroupZ(group.id, 'down', e)}
                            title="整体下移一层"
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                          >
                            <ArrowDown size={11} />
                          </button>

                          {/* Group Lock */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleGroupLock(group.id, e)}
                            title={isLocked ? '解锁整组' : '锁定整组'}
                            className={`p-1 rounded ${isLocked ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
                          >
                            {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
                          </button>

                          {/* Group Visibility */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleGroupVisibility(group.id, e)}
                            title={isVisible ? '隐藏整组' : '显示整组'}
                            className={`p-1 rounded ${isVisible ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
                          >
                            {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>

                          {/* Ungroup */}
                          <button
                            type="button"
                            onClick={(e) => handleUngroup(group.id, e)}
                            title="解散此文件夹分组 (保留图层)"
                            className="p-1 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded"
                          >
                            <Unlink size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Group Children (when expanded) */}
                      {!isCollapsed && (
                        <div className="px-2 pb-2 pt-0.5 space-y-1 ml-2 border-l border-white/10">
                          {groupElements.length === 0 ? (
                            <div 
                              onDragOver={(e) => handleGroupDragOver(e, group.id)}
                              onDrop={(e) => handleGroupDrop(e, group.id)}
                              className={`text-[10px] italic py-2 px-2 text-center rounded border border-dashed transition-all ${
                                isDragOverGroup && layerDropPosition === 'inside'
                                  ? 'border-sky-400 bg-sky-500/20 text-sky-300 font-semibold'
                                  : 'border-white/10 text-slate-500'
                              }`}
                            >
                              {isDragOverGroup && layerDropPosition === 'inside'
                                ? '📥 松开鼠标将图层移入此分组'
                                : '📂 拖拽图层到此处加入分组'}
                            </div>
                          ) : (
                            groupElements.map((el) => renderLayerItem(el, true, group.color))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 2. RENDER UNGROUPED LAYERS */}
                {(!filterGroupId || filterGroupId === 'ungrouped') && ungroupedElements.length > 0 && (
                  <div 
                    onDragOver={(e) => {
                      if (draggedLayerId) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={handleDropToUngrouped}
                    className="space-y-1 pt-1"
                  >
                    {sceneGroups.length > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider px-1 pt-1 border-t border-white/5">
                        <span>未分组图层 ({ungroupedElements.length})</span>
                        <span className="text-[9px] text-slate-600 font-normal">可拖拽图层到此处移出分组</span>
                      </div>
                    )}

                    {ungroupedElements.map((el) => renderLayerItem(el, false))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: TEMPLATES PRESETS */}
      {activeTab === 'templates' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              内置多媒体工坊模板
            </span>
            <span className="text-[10px] text-slate-500 font-mono">点击即时载入</span>
          </div>

          {/* Template 1: Living Canvas */}
          <div
            onClick={() => onLoadTemplate('default')}
            className={`p-3 bg-gradient-to-br from-sky-950/50 via-slate-900 to-slate-900 border rounded-xl cursor-pointer transition-all group relative overflow-hidden ${
              projectData.scenes['blank']
                ? 'border-sky-500 shadow-lg shadow-sky-950/50'
                : 'border-sky-500/30 hover:border-sky-400 hover:shadow-md'
            }`}
          >
            {projectData.scenes['blank'] && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-sky-500/20 border border-sky-500/40 rounded text-[9px] text-sky-300 font-mono flex items-center gap-0.5">
                <Check size={10} /> 当前使用中
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-1.5 pr-14">
              <span className="font-bold text-sky-300 text-xs">鲸动交互 · Living Canvas</span>
              <Sparkles size={12} className="text-sky-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              六个章节：空白、素材、时间、空间、信号与发布。
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-[10px] text-slate-500">6 个场景 · 极简排版 · 3D / 数据 / 多格式发布</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadTemplate('default');
                }}
                className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
              >
                载入模板 <ChevronRight size={11} />
              </button>
            </div>
          </div>

          {/* Template 2: Minimal Product Keynote */}
          <div
            onClick={() => onLoadTemplate('minimal')}
            className={`p-3 bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-900 border rounded-xl cursor-pointer transition-all group relative overflow-hidden ${
              projectData.scenes['min_hero']
                ? 'border-indigo-500 shadow-lg shadow-indigo-950/50'
                : 'border-indigo-500/30 hover:border-indigo-400 hover:shadow-md'
            }`}
          >
            {projectData.scenes['min_hero'] && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-indigo-500/20 border border-indigo-500/40 rounded text-[9px] text-indigo-300 font-mono flex items-center gap-0.5">
                <Check size={10} /> 当前使用中
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-1.5 pr-14">
              <span className="font-bold text-indigo-300 text-xs">极简发布 · Minimal Product Keynote</span>
              <Sparkles size={12} className="text-indigo-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              清爽大字排版、高对比度视觉节奏、微动效淡入淡出与按钮交互。
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-[10px] text-slate-500">3 场景 · 极简指标 · 白皮书</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadTemplate('minimal');
                }}
                className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors"
              >
                载入模板 <ChevronRight size={11} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: ASSET LIBRARY (素材库) */}
      {activeTab === 'assets' && (
        <AssetLibraryPanel
          onAddAsset={onAddAsset}
          onRenameAsset={onRenameAsset}
          refreshTrigger={assetRefreshTrigger}
          onImportFiles={onImportFiles}
          timelineElements={timelineElements}
          onAddTimelineAsset={onAddTimelineAsset}
          referencedAssetKeys={referencedAssetKeys}
        />
      )}

      {activeTab === 'plugins' && (
        <React.Suspense fallback={null}>
          <LazyPluginCenterPanel onInsert={onInsertPlugin || (() => undefined)} />
        </React.Suspense>
      )}

      {/* Tab Content 5: OPERATION HISTORY */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <HistoryPanel
            historyList={historyList}
            currentIndex={currentIndex}
            onJumpToHistory={onJumpToHistory}
            onClearHistory={onClearHistory}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      )}

      {/* Tab Content 6: DESIGN TOOLS (设计与特效工坊) */}
      {activeTab === 'design' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
              <Shapes size={15} />
              <span>设计与视觉特效</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">即插即用</span>
          </div>

          {/* Quick Direct Add Elements */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">基础图元快速插入</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onAddElement?.('shape')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-sky-500/40 text-slate-300 hover:text-white transition-all group"
              >
                <div className="w-5 h-5 rounded border border-sky-400/50 bg-sky-500/20 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-medium">几何矩形</span>
              </button>
              <button
                type="button"
                onClick={() => onAddElement?.('saber')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all group"
              >
                <Zap size={18} className="text-cyan-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-medium">能量光线</span>
              </button>
              <button
                type="button"
                onClick={() => onAddElement?.('panorama-img')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all group"
              >
                <Box size={18} className="text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-medium">全景空间</span>
              </button>
            </div>
          </div>

          {/* 4 Feature Cards */}
          <div className="space-y-2.5 pt-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">高级视觉工坊</div>
            
            {/* Card 1: Shape Preset Library */}
            <div
              onClick={onOpenShapePresetModal}
              className="p-3 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-900 hover:border-sky-400/50 hover:shadow-lg hover:shadow-sky-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                    <Shapes size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">几何形状与预设库</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">50+ 预设</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                包含圆角卡片、多边形、星形、胶囊与带渐变阴影的常用界面元素。
              </p>
            </div>

            {/* Card 2: VFX Particles & Effects */}
            <div
              onClick={onOpenVfxModal}
              className="p-3 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-900 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <Sparkles size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">视觉动态光效 (VFX)</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">GPU加速</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                电影级流光、极光、火花闪烁与氛围粒子流，一键营造高端视觉氛围。
              </p>
            </div>

            {/* Card 3: Saber Neon Light */}
            <div
              onClick={onOpenSaberPresetModal}
              className="p-3 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-900 to-slate-900 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <Zap size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">Saber 霓虹能量光线</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">赛博光辉</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                赛博朋克光辉轮廓、能量回路与脉冲动态光弧，支持自由绘制骨骼。
              </p>
            </div>

            {/* Card 4: Card Layout */}
            <div
              onClick={onOpenCardLayoutModal}
              className="p-3 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <LayoutGrid size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">智能卡片与自适应容器</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">毛玻璃</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                毛玻璃磨砂容器、多栏数据栅格与标题卡片，自动对齐与布局规范。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 7: COMPONENTS (交互组件与空间库) */}
      {activeTab === 'components' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
              <Blocks size={15} />
              <span>交互组件与空间库</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">即插即用</span>
          </div>

          <MyComponentsPanel
            projectData={projectData}
            activeSceneId={activeSceneId}
            currentTime={currentTime}
            selectedElementId={selectedElementId}
            multiSelectedIds={multiSelectedIds}
            onUpdateProject={onUpdateProject}
            onSelectElement={onSelectElement}
            onToast={onToast}
          />

          <div className="space-y-2.5">
            {/* Card 1: UI Library */}
            <div
              onClick={onOpenUILibraryModal}
              className="p-3 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <Blocks size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">基础 UI 交互控件库</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">UI组件</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                精选按钮、滑块、开关、进度条与微动效交互，带悬浮声效与高光回馈。
              </p>
            </div>

            {/* Card 2: Official Components */}
            <div
              onClick={onOpenOfficialComponents}
              className="p-3 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-900 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Layers2 size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">官方业务与交互组件</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">业务套件</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                数据看板、仪表盘、时间天气卡片与物联网指标展示组件。
              </p>
            </div>

            {/* Card 3: Interaction Controls */}
            <div
              onClick={onOpenInteractionControlsModal}
              className="p-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                    <Zap size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">手势联动与事件触发</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">体感联动</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                支持点击跳场、悬停触发、按键快捷键与 AI 体感手势隔空互动。
              </p>
            </div>

            {/* Card 4: 3D Models */}
            <div
              onClick={onOpen3DModal}
              className="p-3 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-900 to-slate-900 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <Box size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">3D 三维模型与空间</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">Three.js</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                导入 GLTF / OBJ / Splat 三维资产，支持环境光影、自动旋转与视角手势交互。
              </p>
            </div>

            {/* Card 5: Custom Code Plugins */}
            <div
              onClick={onOpenCustomCodePlugin}
              className="p-3 rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-950/30 via-slate-900 to-slate-900 hover:border-teal-400/50 hover:shadow-lg hover:shadow-teal-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                    <Code2 size={13} />
                  </div>
                  <span className="font-bold text-white text-xs">自定义代码微组件</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">极客扩展</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                直接引入 WebGL / Canvas 自定义动态特效，支持智能滑块参数与数据联动。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 8: AI CREATIVE STUDIO (AI 智能创作与扩展) */}
      {activeTab === 'ai' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
              <Sparkles size={15} />
              <span>AI 智能创作与扩展</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">大模型驱动</span>
          </div>

          <div className="space-y-2.5">
            {/* Card 1: AI Scene Builder */}
            <div
              onClick={onOpenAiSceneBuilder}
              className="p-3.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-950/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">AI 一键生成完整场景</span>
                    <span className="text-[10px] text-amber-300/80">对话式生成多媒体交互</span>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">推荐体验</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                输入一段设计需求，AI 自动生成多图层排版、颜色搭配、粒子动效与交互逻辑。
              </p>
            </div>

            {/* Card 2: Background Removal */}
            <div
              onClick={onOpenBackgroundRemoval}
              className="p-3.5 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-900 hover:border-sky-400/50 hover:shadow-lg hover:shadow-sky-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                    <Scissors size={15} />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">智能一键抠图 / 去背景</span>
                    <span className="text-[10px] text-sky-300/80">高精度主体提取</span>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">自配密钥</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                自动识别前景主体，毫秒级剔除图片杂乱背景并生成透明通道 PNG 图层。
              </p>
            </div>

            {/* Card 3: Plugin Center */}
            <div
              onClick={onOpenPluginCenter}
              className="p-3.5 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-950/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <Blocks size={15} />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">官方与社区插件市场</span>
                    <span className="text-[10px] text-indigo-300/80">生态模块库</span>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">扩展能力</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                浏览并安装图表增强、3D 渲染器、特殊滤镜与第三方物联网驱动插件包。
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </aside>
  );
};
