import React, { useMemo, useState } from 'react';
import {
  Blocks, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Layers,
  Plus, RefreshCw, RotateCcw, Trash2, Unplug,
} from 'lucide-react';
import type { ProjectData, SceneElement } from '../types';
import {
  createInstanceGroup,
  createMasterFromSelection,
  deleteMaster,
  detachInstance,
  getMasterVariants,
  resolveMasterDataset,
  resetInstanceOverride,
  saveInstanceAsVariant,
  setInstanceOverride,
  switchInstanceVariant,
  updateMasterFromInstance,
} from '../utils/componentMasters';

interface MyComponentsPanelProps {
  projectData: ProjectData;
  activeSceneId: string;
  currentTime?: number;
  selectedElementId: string | null;
  multiSelectedIds: string[];
  onUpdateProject: (updater: (prev: ProjectData) => ProjectData, actionTitle?: string) => void;
  onSelectElement: (id: string | null) => void;
  onToast?: (message: string, type?: 'info' | 'warning' | 'error') => void;
}

export const MyComponentsPanel: React.FC<MyComponentsPanelProps> = ({
  projectData,
  activeSceneId,
  currentTime = 0,
  selectedElementId,
  multiSelectedIds,
  onUpdateProject,
  onSelectElement,
  onToast,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [masterName, setMasterName] = useState('');
  const [variantName, setVariantName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const scene = projectData.scenes[activeSceneId];
  const masters = projectData.components || [];
  const selected = scene?.els.find((element) => element.id === selectedElementId) || null;
  const selectedInstance = selected?.type === 'group' && selected.componentInstance ? selected : null;
  const selectedMaster = selectedInstance?.componentInstance
    ? masters.find((master) => master.id === selectedInstance.componentInstance?.masterId) || null
    : null;
  const instanceOverrides = selectedInstance?.componentInstance?.overrides || {};

  const selectedIds = useMemo(() => {
    if (multiSelectedIds.length > 0) return multiSelectedIds;
    return selectedElementId ? [selectedElementId] : [];
  }, [multiSelectedIds, selectedElementId]);
  const selectedElements = useMemo(() => {
    const supported = new Set(['txt', 'shape', 'img', 'vid', 'chart', 'ui-component', 'saber', 'vfx']);
    return (scene?.els || []).filter((element) => (
      selectedIds.includes(element.id) && supported.has(element.type) && element.visible !== false && element.locked !== true
    ));
  }, [scene?.els, selectedIds]);

  const handleCreateMaster = () => {
    if (!scene || selectedElements.length === 0) {
      onToast?.('请先选择文字、图形或组件图层（暂不支持直接把组存为母版）', 'warning');
      return;
    }
    const ids = selectedElements.map((element) => element.id);
    const minStart = Math.min(...selectedElements.map((element) => Number(element.startTime) || 0));
    const maxEnd = Math.max(...selectedElements.map((element) => (Number(element.startTime) || 0) + (Number(element.duration) || 5)));
    const zIndex = Math.max(0, ...scene.els.map((element) => element.zIndex || 0)) + 1;
    const result = createMasterFromSelection(selectedElements, masterName.trim() || `组件 ${masters.length + 1}`, {
      zIndex,
      startTime: minStart,
      duration: Math.max(5, maxEnd - minStart),
    });
    if (!result) {
      onToast?.('没有可保存的图层', 'warning');
      return;
    }
    result.group.sourceName = `${result.master.name} · 副本 1`;
    onUpdateProject((prev) => {
      const currentScene = prev.scenes[activeSceneId];
      if (!currentScene) return prev;
      return {
        ...prev,
        components: [...(prev.components || []), result.master],
        scenes: {
          ...prev.scenes,
          [activeSceneId]: {
            ...currentScene,
            els: [...currentScene.els.filter((element) => !ids.includes(element.id)), result.group],
          },
        },
      };
    }, `创建组件母版「${result.master.name}」`);
    onSelectElement(result.group.id);
    setMasterName('');
    onToast?.(`已创建母版「${result.master.name}」，当前图层已转为副本`, 'info');
  };

  const handleInsert = (masterId: string) => {
    const master = masters.find((item) => item.id === masterId);
    if (!master || !scene) return;
    const resolved = resolveMasterDataset(master);
    const zIndex = Math.max(0, ...scene.els.map((element) => element.zIndex || 0)) + 1;
    const offset = (scene.els.filter((element) => element.componentInstance).length % 5) * 2;
    const group = createInstanceGroup(master, {
      x: 34 + offset,
      y: 32 + offset,
      w: resolved.width,
      h: resolved.height,
      zIndex,
      startTime: Math.max(0, currentTime),
      duration: 5,
    });
    const instanceNumber = scene.els.filter((element) => element.componentInstance?.masterId === master.id).length + 1;
    group.sourceName = `${master.name} · 副本 ${instanceNumber}`;
    onUpdateProject((prev) => {
      const currentScene = prev.scenes[activeSceneId];
      if (!currentScene) return prev;
      return {
        ...prev,
        scenes: {
          ...prev.scenes,
          [activeSceneId]: { ...currentScene, els: [...currentScene.els, group] },
        },
      };
    }, `插入组件副本「${master.name}」`);
    onSelectElement(group.id);
    onToast?.(`已插入「${master.name}」的副本`, 'info');
  };

  const handleUpdateMaster = () => {
    if (!selectedInstance || !selectedMaster) return;
    onUpdateProject((prev) => {
      const result = updateMasterFromInstance(prev, selectedInstance.id);
      if (!result) return prev;
      return result.projectData;
    }, `更新组件母版「${selectedMaster.name}」`);
    onToast?.('母版已更新，工程内所有副本已同步', 'info');
  };

  const handleDetach = () => {
    if (!selectedInstance) return;
    onUpdateProject((prev) => detachInstance(prev, selectedInstance.id), '分离组件副本');
    onToast?.('已分离为普通图层组，可自由修改', 'info');
  };

  const handleDeleteMaster = (masterId: string) => {
    if (confirmDeleteId !== masterId) {
      setConfirmDeleteId(masterId);
      return;
    }
    onUpdateProject((prev) => deleteMaster(prev, masterId), '删除组件母版');
    setConfirmDeleteId(null);
    onToast?.('母版已删除，原有副本已转为普通图层组', 'info');
  };

  const handleOverride = (sourceId: string, patch: Partial<SceneElement>) => {
    if (!selectedInstance) return;
    onUpdateProject((prev) => setInstanceOverride(prev, selectedInstance.id, sourceId, patch), '修改组件副本');
  };

  const handleResetOverride = (sourceId: string) => {
    if (!selectedInstance) return;
    onUpdateProject((prev) => resetInstanceOverride(prev, selectedInstance.id, sourceId), '重置组件副本覆盖');
  };

  const handleVariantChange = (variantId: string) => {
    if (!selectedInstance) return;
    onUpdateProject((prev) => switchInstanceVariant(prev, selectedInstance.id, variantId), '切换组件状态');
  };

  const handleSaveVariant = () => {
    if (!selectedInstance) return;
    const saved = saveInstanceAsVariant(projectData, selectedInstance.id, variantName);
    if (!saved) {
      onToast?.('保存状态失败', 'warning');
      return;
    }
    onUpdateProject((prev) => {
      const result = saveInstanceAsVariant(prev, selectedInstance.id, variantName);
      return result?.projectData || prev;
    }, '保存组件状态');
    setVariantName('');
    onToast?.(`已保存状态「${variantName.trim() || '新状态'}」`, 'info');
  };

  const variantList = selectedMaster ? getMasterVariants(selectedMaster) : [];

  return (
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/[0.04] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-cyan-400/35 bg-cyan-400/15 text-cyan-300">
            <Blocks size={13} />
          </span>
          <span>
            <span className="block text-xs font-bold text-white">我的组件（母版）</span>
            <span className="block text-[10px] text-slate-400">改母版，所有副本同步</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
            {masters.length}
          </span>
          {expanded ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-cyan-400/15 px-3 pb-3 pt-3">
          <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-cyan-100">把当前选中存为母版</span>
              <span className="font-mono text-slate-500">{selectedElements.length} 个图层</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={masterName}
                onChange={(event) => setMasterName(event.target.value)}
                placeholder="如：数据卡片"
                className="min-w-0 flex-1 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400"
                aria-label="组件母版名称"
              />
              <button
                type="button"
                onClick={handleCreateMaster}
                disabled={selectedElements.length === 0}
                className="flex shrink-0 items-center gap-1 rounded bg-cyan-400 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Plus size={12} />
                存为母版
              </button>
            </div>
            <p className="text-[9px] leading-4 text-slate-500">
              选中文字/图形后保存；之后插入的都是副本，改母版会一起更新。
            </p>
          </div>

          {selectedInstance && selectedMaster && (
            <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.05] p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold text-violet-100">当前副本 · {selectedMaster.name}</div>
                  <div className="mt-0.5 text-[9px] text-slate-400">
                    v{selectedMaster.version || 1} · {variantList.length} 个状态 · {selectedInstance.children?.length || 0} 个图层
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={handleUpdateMaster}
                    title="把当前副本的外观写回母版，并同步所有副本"
                    className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-1 text-[9px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
                  >
                    <RefreshCw size={10} />
                    更新母版
                  </button>
                  <button
                    type="button"
                    onClick={handleDetach}
                    title="断开母版链接，变成普通图层组"
                    className="grid h-6 w-6 place-items-center rounded border border-white/10 text-slate-400 hover:border-rose-400/40 hover:text-rose-300"
                    aria-label="分离副本"
                  >
                    <Unplug size={11} />
                  </button>
                </div>
              </div>

              <p className="text-[9px] leading-4 text-slate-500">
                下面的文字/颜色只改当前副本；改完点「更新母版」才会同步所有副本。
              </p>

              <div className="flex items-center gap-1.5">
                <select
                  value={selectedInstance.componentInstance?.variantId || 'default'}                  onChange={(event) => handleVariantChange(event.target.value)}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white outline-none focus:border-violet-400"
                  aria-label="组件状态"
                >
                  {variantList.map((variant) => (
                    <option key={variant.id} value={variant.id}>{variant.name}</option>
                  ))}
                </select>
                <input
                  value={variantName}
                  onChange={(event) => setVariantName(event.target.value)}
                  placeholder="新状态名，如：悬停"
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white outline-none focus:border-violet-400"
                  aria-label="新状态名称"
                />
                <button
                  type="button"
                  onClick={handleSaveVariant}
                  className="shrink-0 rounded border border-violet-400/30 bg-violet-400/10 px-2 py-1.5 text-[9px] font-semibold text-violet-200 hover:bg-violet-400/20"
                >
                  存为状态
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>副本覆盖（只影响当前副本）</span>
                  <span className="font-mono text-[9px]">{Object.keys(instanceOverrides).length} 项</span>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
                  {(selectedInstance.children || []).map((child) => {
                    const sourceId = child.componentSourceId || child.id;
                    const override = instanceOverrides[sourceId];
                    const isText = child.type === 'txt';
                    const hasEditableText = isText || (child.type === 'shape' && Boolean(child.content));
                    const canColor = child.type === 'txt' || child.type === 'shape';
                    const colorValue = isText
                      ? (child.textColor || child.color || '#ffffff')
                      : (child.backgroundColor || child.color || '#38bdf8');
                    return (
                      <div key={child.id} className="rounded border border-white/10 bg-black/40 p-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="min-w-0 truncate text-[10px] text-slate-300">
                            {child.sourceName || child.content || child.type}
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOverride(sourceId, { visible: child.visible === false })}
                              title={child.visible === false ? '显示此图层' : '隐藏此图层'}
                              className="grid h-5 w-5 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white"
                              aria-label={child.visible === false ? '显示图层' : '隐藏图层'}
                            >
                              {child.visible === false ? <EyeOff size={10} /> : <Eye size={10} />}
                            </button>
                            {override && (
                              <button
                                type="button"
                                onClick={() => handleResetOverride(sourceId)}
                                title="重置此图层的覆盖"
                                className="grid h-5 w-5 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-amber-300"
                                aria-label="重置覆盖"
                              >
                                <RotateCcw size={10} />
                              </button>
                            )}
                          </span>
                        </div>
                        {hasEditableText && (
                          <input
                            value={child.content || ''}
                            onChange={(event) => handleOverride(sourceId, { content: event.target.value })}
                            className="mt-1 w-full rounded border border-white/10 bg-black/50 px-1.5 py-1 text-[10px] text-white outline-none focus:border-cyan-400"
                            aria-label={`${child.sourceName || '文字'}内容`}
                          />
                        )}
                        {canColor && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <input
                              type="color"
                              value={colorValue}
                              onChange={(event) => handleOverride(sourceId, isText
                                ? { color: event.target.value, textColor: event.target.value }
                                : { backgroundColor: event.target.value, color: event.target.value })}
                              className="h-5 w-6 rounded border border-white/10 bg-black/50"
                              aria-label={`${child.sourceName || '图层'}颜色`}
                            />
                            <span className="font-mono text-[9px] text-slate-500">{colorValue}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {masters.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-3 text-center">
              <Layers size={18} className="mx-auto mb-1 text-slate-600" />
              <p className="text-[10px] text-slate-400">还没有母版组件</p>
              <p className="mt-0.5 text-[9px] text-slate-500">选中几个图层，保存为母版后就能反复插入副本。</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {masters.map((master) => {
                const resolved = resolveMasterDataset(master);
                const variants = getMasterVariants(master);
                const isCurrent = selectedMaster?.id === master.id;
                return (
                  <div key={master.id} className={`rounded-lg border p-2 transition ${isCurrent ? 'border-violet-400/40 bg-violet-500/[0.06]' : 'border-white/10 bg-black/30 hover:border-white/20'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-slate-100">{master.name}</div>
                        <div className="mt-0.5 text-[9px] text-slate-500">
                          v{master.version || 1} · {variants.length} 个状态 · {resolved.elements.length} 个图层
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleInsert(master.id)}
                          title="插入一个副本"
                          className="flex h-6 items-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/10 px-1.5 text-[9px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
                          aria-label={`插入组件 ${master.name}`}
                        >
                          <Copy size={10} />
                          插入
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaster(master.id)}
                          title={confirmDeleteId === master.id ? '再次点击确认删除' : '删除母版（副本会保留为普通组）'}
                          className={`grid h-6 w-6 place-items-center rounded border text-[9px] ${confirmDeleteId === master.id ? 'border-rose-400/50 bg-rose-500/20 text-rose-200' : 'border-white/10 text-slate-500 hover:border-rose-400/40 hover:text-rose-300'}`}
                          aria-label={confirmDeleteId === master.id ? '确认删除母版' : '删除母版'}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    {variants.length > 1 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {variants.map((variant) => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => {
                              if (isCurrent) handleVariantChange(variant.id);
                            }}
                            disabled={!isCurrent}
                            title={isCurrent ? `切换副本到「${variant.name}」` : variant.name}
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] ${selectedInstance?.componentInstance?.variantId === variant.id && isCurrent ? 'border-violet-400/50 bg-violet-400/20 text-violet-100' : 'border-white/10 text-slate-500'} ${isCurrent ? 'cursor-pointer hover:border-violet-400/40' : 'cursor-default'}`}
                          >
                            {variant.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {isCurrent && (
                      <button
                        type="button"
                        onClick={handleUpdateMaster}
                        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/10 py-1 text-[9px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
                      >
                        <RefreshCw size={10} />
                        用当前副本更新母版
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
