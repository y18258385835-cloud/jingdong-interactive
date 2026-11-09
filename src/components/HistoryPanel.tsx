import React, { useState, useMemo } from 'react';
import { 
  History, Clock, Undo2, Redo2, RotateCcw, FastForward, 
  Trash2, Search, Sparkles, Film, Layers, FileText, 
  Image as ImageIcon, Box, LayoutTemplate, Move, CheckCircle2,
  ArrowDown, ArrowUp, ArrowRight, CornerDownRight, X, Folder, FolderPlus, FolderMinus, Unlink
} from 'lucide-react';
import { HistoryItem, HistoryActionType } from '../types';

interface HistoryPanelProps {
  historyList: HistoryItem[];
  currentIndex: number;
  onJumpToHistory: (index: number) => void;
  onClearHistory: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClose?: () => void;
  isFloating?: boolean;
}

const ACTION_ICONS: Record<HistoryActionType, React.ElementType> = {
  init: Sparkles,
  scene_new: Film,
  scene_delete: Trash2,
  scene_duplicate: Film,
  scene_reorder: Move,
  scene_update: Film,
  scene_transition: Sparkles,
  element_new: Layers,
  element_delete: Trash2,
  element_duplicate: Layers,
  element_transform: Move,
  element_update: Layers,
  element_order: Move,
  group_create: FolderPlus,
  group_delete: Trash2,
  group_update: Folder,
  group_ungroup: Unlink,
  template_load: LayoutTemplate,
  import: Box,
  general: History,
};

const ACTION_COLORS: Record<HistoryActionType, { text: string; bg: string; border: string }> = {
  init: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  scene_new: { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  scene_delete: { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  scene_duplicate: { text: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30' },
  scene_reorder: { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  scene_update: { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  scene_transition: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  element_new: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  element_delete: { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  element_duplicate: { text: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30' },
  element_transform: { text: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
  element_update: { text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  element_order: { text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  group_create: { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  group_delete: { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  group_update: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  group_ungroup: { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  template_load: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/30' },
  import: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  general: { text: 'text-slate-300', bg: 'bg-white/10', border: 'border-white/20' },
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  historyList,
  currentIndex,
  onJumpToHistory,
  onClearHistory,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClose,
  isFloating = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  // Filter history records if search query exists
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) {
      return historyList.map((item, originalIndex) => ({ item, originalIndex }));
    }
    const q = searchQuery.toLowerCase().trim();
    return historyList
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => 
        item.title.toLowerCase().includes(q) || 
        (item.details && item.details.toLowerCase().includes(q)) ||
        item.timeStr.includes(q)
      );
  }, [historyList, searchQuery]);

  return (
    <div className={`flex flex-col h-full bg-[#0e1017] select-none ${isFloating ? 'w-96 rounded-xl border border-white/15 shadow-2xl overflow-hidden' : ''}`}>
      {/* Header Toolbar */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <History size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200">操作历史记录</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-sky-950/80 text-sky-300 border border-sky-500/30 rounded-full font-bold">
                {currentIndex + 1} / {historyList.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">点击任意记录直接时光回滚</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Undo / Redo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="撤销一步 (Ctrl+Z)"
            className="p-1.5 hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent rounded text-slate-300"
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="重做一步 (Ctrl+Y)"
            className="p-1.5 hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent rounded text-slate-300"
          >
            <Redo2 size={13} />
          </button>

          {/* Close button for modal/floating mode */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white ml-1 transition-colors"
              title="关闭面板"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Jump & Filter Bar */}
      <div className="p-2.5 border-b border-white/5 bg-white/[0.02] flex flex-col gap-2 shrink-0">
        {/* Search filter input */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索操作记录 (如: 场景/图层/转场)..."
            className="w-full bg-black/40 border border-white/10 rounded-md pl-8 pr-7 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-sky-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Quick Navigation Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => onJumpToHistory(0)}
            title="跳到最初初始状态"
            className="flex-1 py-1 px-2 text-[10px] rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 text-slate-300 flex items-center justify-center gap-1 transition-colors"
          >
            <RotateCcw size={10} />
            <span>最初状态</span>
          </button>

          <button
            type="button"
            disabled={currentIndex === historyList.length - 1}
            onClick={() => onJumpToHistory(historyList.length - 1)}
            title="跳到最新状态"
            className="flex-1 py-1 px-2 text-[10px] rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 text-slate-300 flex items-center justify-center gap-1 transition-colors"
          >
            <FastForward size={10} />
            <span>最新状态</span>
          </button>

          <button
            type="button"
            disabled={historyList.length <= 1}
            onClick={() => setConfirmClear(true)}
            title="清空多余历史记录"
            className="py-1 px-2 text-[10px] rounded bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-25 disabled:hover:bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-center gap-1 transition-colors"
          >
            <Trash2 size={10} />
            <span>清空</span>
          </button>
        </div>
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-[#171a24] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="history-clear-title">
            <h2 id="history-clear-title" className="text-sm font-semibold text-white">清空历史记录？</h2>
            <p className="mt-2 text-xs leading-5 text-slate-300">将删除当前状态之外的历史记录，当前工程内容不会改变。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="min-h-10 rounded-lg bg-white/10 px-4 text-xs text-slate-300" onClick={() => setConfirmClear(false)}>取消</button>
              <button type="button" autoFocus className="min-h-10 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white" onClick={() => { setConfirmClear(false); onClearHistory(); }}>清空记录</button>
            </div>
          </div>
        </div>
      )}

      {/* History Records Timeline List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 relative scrollbar-thin">
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <History size={24} className="mx-auto mb-2 opacity-40" />
            <p>未找到匹配的历史操作记录</p>
          </div>
        ) : (
          <div className="relative pl-3">
            {/* Timeline Vertical Connecting Line */}
            <div className="absolute left-[18px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-sky-500/40 via-white/10 to-indigo-500/30 -translate-x-1/2 pointer-events-none" />

            {filteredRecords.map(({ item, originalIndex }) => {
              const isCurrent = originalIndex === currentIndex;
              const isPast = originalIndex < currentIndex;
              const isFuture = originalIndex > currentIndex;

              const Icon = ACTION_ICONS[item.actionType] || History;
              const colorTheme = ACTION_COLORS[item.actionType] || ACTION_COLORS.general;

              return (
                <div
                  key={item.id || `hist-${originalIndex}`}
                  onClick={() => onJumpToHistory(originalIndex)}
                  className={`group relative flex items-start gap-2.5 p-2 rounded-lg transition-all cursor-pointer border mb-1.5 ${
                    isCurrent
                      ? 'bg-sky-950/60 border-sky-500 shadow-lg shadow-sky-950/60 ring-1 ring-sky-400/50'
                      : isFuture
                      ? 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-90 hover:bg-white/5 hover:border-white/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                  }`}
                >
                  {/* Timeline Node Badge */}
                  <div className="relative shrink-0 mt-0.5 z-10">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-sm transition-transform group-hover:scale-110 ${
                        isCurrent
                          ? 'bg-sky-500 border-white text-white ring-4 ring-sky-500/30 animate-pulse'
                          : isFuture
                          ? 'bg-black/80 border-dashed border-white/30 text-slate-400'
                          : `${colorTheme.bg} ${colorTheme.border} ${colorTheme.text}`
                      }`}
                    >
                      {isCurrent ? (
                        <CheckCircle2 size={13} className="stroke-[2.5]" />
                      ) : (
                        <Icon size={12} />
                      )}
                    </div>
                  </div>

                  {/* Record Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[9px] text-slate-400 font-bold">
                          #{originalIndex + 1}
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            isCurrent
                              ? 'text-sky-300 font-bold'
                              : isFuture
                              ? 'text-slate-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>

                      {/* Time / Badge */}
                      <div className="shrink-0 flex items-center gap-1">
                        {isCurrent ? (
                          <span className="px-1.5 py-0.2 text-[9px] bg-sky-500 text-white font-bold rounded shadow-sm tracking-wide">
                            当前状态
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5">
                            <Clock size={9} className="opacity-60" />
                            {item.timeStr}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details / Action Hint */}
                    {item.details && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.details}
                      </p>
                    )}

                    {/* Rollback Prompt on Hover (for non-current states) */}
                    {!isCurrent && (
                      <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-medium text-sky-400">
                        <CornerDownRight size={10} />
                        <span>{isPast ? '回滚到该状态' : '前进重做到此状态'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-white/10 bg-black/40 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
        <span>已记录 {historyList.length} 个历史节点</span>
        <span className="font-mono text-sky-400/90">按 Ctrl+Z / Y 快速撤销重做</span>
      </div>
    </div>
  );
};
