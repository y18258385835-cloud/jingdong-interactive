/**
 * 快捷键管理
 * 快捷键定义、自定义设置、快捷键帮助
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Keyboard, X, Check, RotateCcw, Copy, Trash2,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Layers,
  ZoomIn, ZoomOut, Play, Save, Undo2, Redo2,
} from 'lucide-react';

// 快捷键定义
export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultKey: string;
  customKey?: string;
  enabled: boolean;
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // 文件操作
  { id: 'save', name: '保存工程', description: '保存当前工程到本地', category: '文件', defaultKey: 'Ctrl+S', enabled: true },
  { id: 'new', name: '新建空白工程', description: '创建空白工程并选择画布比例', category: '文件', defaultKey: 'Ctrl+N', enabled: true },
  { id: 'export', name: '导出', description: '打开导出对话框', category: '文件', defaultKey: 'Ctrl+E', enabled: true },

  // 编辑操作
  { id: 'undo', name: '撤销', description: '撤销上一步操作', category: '编辑', defaultKey: 'Ctrl+Z', enabled: true },
  { id: 'redo', name: '重做', description: '重做已撤销的操作', category: '编辑', defaultKey: 'Ctrl+Y', enabled: true },
  { id: 'copy', name: '复制', description: '复制选中的元素', category: '编辑', defaultKey: 'Ctrl+C', enabled: true },
  { id: 'paste', name: '粘贴', description: '粘贴剪贴板内容', category: '编辑', defaultKey: 'Ctrl+V', enabled: true },
  { id: 'duplicate', name: '复制元素', description: '直接复制选中元素', category: '编辑', defaultKey: 'Ctrl+D', enabled: true },
  { id: 'delete', name: '删除', description: '删除选中的元素', category: '编辑', defaultKey: 'Delete', enabled: true },
  { id: 'select-all', name: '全选', description: '选中当前场景所有元素', category: '编辑', defaultKey: 'Ctrl+A', enabled: true },

  // 视图操作
  { id: 'zoom-in', name: '放大', description: '放大画布视图', category: '视图', defaultKey: 'Ctrl+=', enabled: true },
  { id: 'zoom-out', name: '缩小', description: '缩小画布视图', category: '视图', defaultKey: 'Ctrl+-', enabled: true },
  { id: 'fit-canvas', name: '适应画布', description: '自适应画布大小', category: '视图', defaultKey: 'Ctrl+0', enabled: true },
  { id: 'fullscreen', name: '全屏', description: '切换全屏预览模式', category: '视图', defaultKey: 'F11', enabled: true },

  // 播放控制
  { id: 'play-pause', name: '播放/暂停', description: '播放或暂停当前场景', category: '播放', defaultKey: 'Space', enabled: true },
  { id: 'stop', name: '停止', description: '停止播放并回到开头', category: '播放', defaultKey: 'Ctrl+Space', enabled: true },

  // 元素操作
  { id: 'move-up', name: '上移', description: '将选中元素向上移动', category: '元素', defaultKey: 'ArrowUp', enabled: true },
  { id: 'move-down', name: '下移', description: '将选中元素向下移动', category: '元素', defaultKey: 'ArrowDown', enabled: true },
  { id: 'move-left', name: '左移', description: '将选中元素向左移动', category: '元素', defaultKey: 'ArrowLeft', enabled: true },
  { id: 'move-right', name: '右移', description: '将选中元素向右移动', category: '元素', defaultKey: 'ArrowRight', enabled: true },
  { id: 'layer-up', name: '上移图层', description: '将选中元素图层上移', category: '元素', defaultKey: 'Ctrl+]', enabled: true },
  { id: 'layer-down', name: '下移图层', description: '将选中元素图层下移', category: '元素', defaultKey: 'Ctrl+[', enabled: true },
  { id: 'align-left', name: '左对齐', description: '将选中元素左对齐（单选时对齐画布）', category: '对齐', defaultKey: 'Ctrl+Alt+L', enabled: true },
  { id: 'align-center', name: '水平居中', description: '将选中元素水平居中', category: '对齐', defaultKey: 'Ctrl+Alt+C', enabled: true },
  { id: 'align-right', name: '右对齐', description: '将选中元素右对齐', category: '对齐', defaultKey: 'Ctrl+Alt+R', enabled: true },
  { id: 'align-top', name: '顶对齐', description: '将选中元素顶对齐', category: '对齐', defaultKey: 'Ctrl+Alt+T', enabled: true },
  { id: 'align-middle', name: '垂直居中', description: '将选中元素垂直居中', category: '对齐', defaultKey: 'Ctrl+Alt+M', enabled: true },
  { id: 'align-bottom', name: '底对齐', description: '将选中元素底对齐', category: '对齐', defaultKey: 'Ctrl+Alt+B', enabled: true },
  { id: 'distribute-horizontal', name: '水平等距分布', description: '让选中的 3 个以上元素水平间距相等', category: '对齐', defaultKey: 'Ctrl+Alt+H', enabled: true },
  { id: 'distribute-vertical', name: '垂直等距分布', description: '让选中的 3 个以上元素垂直间距相等', category: '对齐', defaultKey: 'Ctrl+Alt+V', enabled: true },

  // 工具
  { id: 'edit-mode', name: '编辑模式', description: '切换到编辑模式', category: '工具', defaultKey: 'E', enabled: true },
  { id: 'preview-mode', name: '预览模式', description: '切换到预览模式', category: '工具', defaultKey: 'P', enabled: true },
  { id: 'shortcuts', name: '快捷键帮助', description: '显示快捷键帮助', category: '工具', defaultKey: 'F1', enabled: true },
];

const SHORTCUTS_STORAGE_KEY = 'aether_custom_shortcuts';

/**
 * 加载自定义快捷键
 */
export function loadCustomShortcuts(): ShortcutDefinition[] {
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (raw) {
      const custom = JSON.parse(raw);
      return DEFAULT_SHORTCUTS.map((shortcut) => {
        const customShortcut = custom.find((c: any) => c.id === shortcut.id);
        return customShortcut ? { ...shortcut, ...customShortcut } : shortcut;
      });
    }
  } catch (e) {
    console.warn('[Shortcuts] 加载自定义快捷键失败:', e);
  }
  return DEFAULT_SHORTCUTS;
}

/**
 * 保存自定义快捷键
 */
export function saveCustomShortcuts(shortcuts: ShortcutDefinition[]): void {
  try {
    const custom = shortcuts.filter((s) => s.customKey || !s.enabled);
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(custom));
    window.dispatchEvent(new CustomEvent('aether-shortcuts-updated'));
  } catch (e) {
    console.warn('[Shortcuts] 保存自定义快捷键失败:', e);
  }
}

/**
 * 快捷键设置弹窗
 */
interface ShortcutsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: ShortcutDefinition[];
  onShortcutsChange?: (shortcuts: ShortcutDefinition[]) => void;
}

export const ShortcutsSettingsModal: React.FC<ShortcutsSettingsModalProps> = ({
  isOpen,
  onClose,
  shortcuts: externalShortcuts,
  onShortcutsChange,
}) => {
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>(
    externalShortcuts || loadCustomShortcuts()
  );
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShortcuts(externalShortcuts || loadCustomShortcuts());
    }
  }, [isOpen, externalShortcuts]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const categories = ['全部', ...Array.from(new Set(shortcuts.map((s) => s.category)))];

  const filteredShortcuts = shortcuts.filter((s) => {
    const matchCategory = activeCategory === '全部' || s.category === activeCategory;
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleReset = (id: string) => {
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, customKey: undefined, enabled: true } : s))
    );
  };

  const handleResetAll = () => {
    setShortcuts(DEFAULT_SHORTCUTS.map((s) => ({ ...s })));
  };

  const handleToggleEnabled = (id: string) => {
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleSave = () => {
    saveCustomShortcuts(shortcuts);
    onShortcutsChange?.(shortcuts);
    onClose();
  };

  const getKeyDisplay = (shortcut: ShortcutDefinition) => {
    return shortcut.customKey || shortcut.defaultKey;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
      <div className="w-full max-w-3xl h-[80vh] bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-label="快捷键设置">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Keyboard size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">快捷键设置</h2>
              <p className="text-xs text-slate-500">自定义你的快捷键，提升工作效率</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="关闭快捷键设置窗口"
          >
            <X size={20} />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索快捷键..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <RotateCcw size={12} />
              全部重置
            </button>
          </div>
        </div>

        {/* 快捷键列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-1">
            {filteredShortcuts.map((shortcut) => (
              <div
                key={shortcut.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  shortcut.enabled ? 'bg-white/[0.03] hover:bg-white/[0.05]' : 'bg-white/[0.01] opacity-50'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* 启用开关 */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(shortcut.id)}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                      shortcut.enabled ? 'bg-cyan-500' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        shortcut.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  {/* 名称和描述 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{shortcut.name}</p>
                    <p className="text-xs text-slate-500 truncate">{shortcut.description}</p>
                  </div>

                  {/* 分类标签 */}
                  <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-slate-400 shrink-0">
                    {shortcut.category}
                  </span>
                </div>

                {/* 快捷键显示/编辑 */}
                <div className="flex items-center gap-2 ml-4">
                  {editingId === shortcut.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={shortcut.customKey || shortcut.defaultKey}
                        onChange={(e) => {
                          setShortcuts((prev) =>
                            prev.map((s) => (s.id === shortcut.id ? { ...s, customKey: e.target.value } : s))
                          );
                        }}
                        onKeyDown={(e) => {
                          e.preventDefault();
                          const keys = [];
                          if (e.ctrlKey) keys.push('Ctrl');
                          if (e.shiftKey) keys.push('Shift');
                          if (e.altKey) keys.push('Alt');
                          if (e.metaKey) keys.push('Cmd');
                          if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
                            keys.push(e.key === ' ' ? 'Space' : e.key);
                          }
                          if (keys.length > 0) {
                            const keyString = keys.join('+');
                            setShortcuts((prev) =>
                              prev.map((s) => (s.id === shortcut.id ? { ...s, customKey: keyString } : s))
                            );
                          }
                        }}
                        placeholder="按下快捷键..."
                        className="w-32 px-2 py-1 bg-cyan-500/10 border border-cyan-500/50 rounded text-xs text-cyan-300 text-center focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded hover:bg-white/10 text-emerald-400"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <kbd
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border cursor-pointer transition-colors ${
                          shortcut.customKey
                            ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        } hover:border-cyan-500/50`}
                        onClick={() => setEditingId(shortcut.id)}
                        title="点击修改快捷键"
                      >
                        {getKeyDisplay(shortcut)}
                      </kbd>
                      {shortcut.customKey && (
                        <button
                          type="button"
                          onClick={() => handleReset(shortcut.id)}
                          className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                          title="重置为默认"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <p className="text-xs text-slate-500">
            共 {shortcuts.length} 个快捷键 · {shortcuts.filter((s) => s.customKey).length} 个已自定义
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/20"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
