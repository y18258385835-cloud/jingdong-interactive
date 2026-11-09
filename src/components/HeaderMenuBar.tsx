import React, { useState, useRef, useEffect } from 'react';
import { apiUrl } from '../core/api/url';
import { 
  FolderOpen, Save, Download, Play, Eye, Edit3, 
  Plus, Undo2, Redo2, Box, HelpCircle, 
  Maximize2, Grid, Sparkles, FileText, Film, Image as ImageIcon,
  ChevronDown, History, Plug, LayoutTemplate, Search, KeyRound, Languages, Check, Bell, X, RefreshCw
} from 'lucide-react';
import { ProjectData, HistoryItem } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface HeaderMenuBarProps {
  projectData: ProjectData;
  onUpdateProject: (updater: (prev: ProjectData) => ProjectData) => void;
  isEditing: boolean;
  onToggleEditing: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saveStatus?: 'saved' | 'unsaved' | 'saving' | 'error';
  canUndo: boolean;
  canRedo: boolean;
  historyList?: HistoryItem[];
  currentIndex?: number;
  onOpenHistoryModal: () => void;
  onOpenExportModal: () => void;
  onOpenAdvancedExportModal?: () => void;
  onOpenProjectManager?: () => void;
  onOpenShortcutsModal: () => void;
  onOpenActivationModal?: () => void;
  onNewScene: () => void;
  onAddElement: (type: 'txt' | 'img' | 'vid' | 'shape' | 'chart') => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetDefault: () => void;
  onNewBlankProject: () => void;
  onOpenTemplates?: () => void;
  onOpenPlugins?: () => void;
  onOpenGlobalSearch?: () => void;
  toggleFullscreen: () => void;
}

export const HeaderMenuBar: React.FC<HeaderMenuBarProps> = ({
  projectData,
  onUpdateProject,
  isEditing,
  onToggleEditing,
  onUndo,
  onRedo,
  onSave,
  saveStatus = 'saved',
  canUndo,
  canRedo,
  historyList = [],
  currentIndex = 0,
  onOpenHistoryModal,
  onOpenExportModal,
  onOpenAdvancedExportModal,
  onOpenProjectManager,
  onOpenShortcutsModal,
  onOpenActivationModal,
  onNewScene,
  onAddElement,
  onImportFile,
  onResetDefault,
  onNewBlankProject,
  onOpenTemplates,
  onOpenPlugins,
  onOpenGlobalSearch,
  toggleFullscreen,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const cancelTitleEditRef = useRef(false);
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; titleZh: string; titleEn: string; bodyZh: string; bodyEn: string; publishedAt: number }>>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('aether_read_notifications') || '[]'); } catch { return []; }
  });
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  useEffect(() => {
    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const response = await fetch(apiUrl('/api/public/notifications'), { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && Array.isArray(data.notifications)) setNotifications(data.notifications);
      } catch { /* Notifications are optional and must not interrupt editing. */ }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((current) => {
      const next = current.includes(id) ? current : [...current, id].slice(-200);
      window.localStorage.setItem('aether_read_notifications', JSON.stringify(next));
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    const next = notifications.map((item) => item.id).slice(-200);
    setReadNotificationIds(next);
    window.localStorage.setItem('aether_read_notifications', JSON.stringify(next));
  };

  const askForConfirmation = (message: string, action: () => void) => {
    setActiveMenu(null);
    setConfirmation({ message, action });
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.menu-dropdown-container')) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        setConfirmation(null);
        setIsEditingTitle(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const menuItems = [
    {
      id: 'file',
      label: '文件',
      items: [
        { label: '新建空白工程', icon: Plus, action: () => askForConfirmation('确定创建新的空白工程吗？未导出的修改将重置。', onNewBlankProject) },
        { label: '导入工程包 / Zip / JSON...', icon: FolderOpen, action: () => fileInputRef.current?.click(), shortcut: 'Ctrl+O' },
        ...(onOpenProjectManager ? [{ label: '工程管理', icon: FolderOpen, action: onOpenProjectManager }] : []),
        { label: '保存工程', icon: Save, action: onSave, shortcut: 'Ctrl+S' },
        { type: 'divider' },
        { label: '打包导出独立工程 (Zip)...', icon: Download, action: onOpenExportModal, shortcut: 'Ctrl+E' },
        { label: '重置为官方示例工程', icon: Sparkles, action: () => askForConfirmation('确定加载官方示例工程吗？当前未导出的修改将被替换。', onResetDefault) },
      ]
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        { label: '撤销 (Undo)', icon: Undo2, action: onUndo, disabled: !canUndo, shortcut: 'Ctrl+Z' },
        { label: '重做 (Redo)', icon: Redo2, action: onRedo, disabled: !canRedo, shortcut: 'Ctrl+Y' },
        { label: '操作历史记录面板...', icon: History, action: onOpenHistoryModal, shortcut: 'Ctrl+H' },
        { type: 'divider' },
        { label: '添加文字图层', icon: FileText, action: () => onAddElement('txt'), shortcut: 'T' },
        { label: '添加矩形 / 交互卡片', icon: Box, action: () => onAddElement('shape'), shortcut: 'R' },
        { label: '添加图片素材', icon: ImageIcon, action: () => onAddElement('img'), shortcut: 'I' },
        { label: '添加视频素材', icon: Film, action: () => onAddElement('vid'), shortcut: 'M' },
      ]
    },
    {
      id: 'scene',
      label: '场景',
      items: [
        { label: '新建场景 (New Scene)', icon: Plus, action: onNewScene },
      ]
    },
    {
      id: 'help',
      // Help menu also hosts the two workspace libraries.
      label: '帮助',
      items: [
        { label: '快捷键一览 (Shortcuts)', icon: HelpCircle, action: onOpenShortcutsModal, shortcut: '?' },
        ...(onOpenActivationModal ? [{ label: '激活', icon: KeyRound, action: onOpenActivationModal }] : []),
        { label: '检查更新', icon: RefreshCw, action: () => window.dispatchEvent(new Event('aether:check-update')) },
      ]
    }
  ];

  // Keep the existing menu actions intact while exposing a locale-aware label layer.
  const localizedMenuItems = menuItems.map((menu) => {
    const labels = menu.id === 'file'
      ? [t('newBlankProject'), t('importProject'), ...(onOpenProjectManager ? [t('projectManager')] : []), t('saveProject'), t('exportProject'), t('resetOfficial')]
      : menu.id === 'edit'
        ? [t('undo'), t('redo'), t('history'), t('addText'), t('addShape'), t('addImage'), t('addVideo')]
        : menu.id === 'scene'
          ? [t('newScene')]
          : [t('shortcuts'), ...(onOpenActivationModal ? [t('activate')] : []), t('checkUpdate')];
    let labelIndex = 0;
    return {
      ...menu,
      label: menu.id === 'file' ? t('file') : menu.id === 'edit' ? t('edit') : menu.id === 'scene' ? t('scene') : t('help'),
      items: menu.items.map((item) => {
        if (item.type === 'divider') return item;
        return { ...item, label: labels[labelIndex++] };
      }),
    };
  });

  return (
    <header className="aether-chrome-header relative z-[1100] h-11 min-h-11 bg-[#0f1117] border-b border-white/10 flex items-center justify-between gap-1 px-2 sm:px-3 select-none text-xs text-slate-200 overflow-visible">
      <input
        type="file"
        ref={fileInputRef}
        aria-label="导入工程文件"
        className="hidden"
        accept=".aether,.zip,.json,.html"
        onChange={onImportFile}
      />

      {/* Left: Brand & Menu items */}
      <div className="flex min-w-0 shrink items-center gap-1">
        {/* Brand logo badge */}
        <div className="hidden xl:flex shrink-0 items-center gap-2 mr-3 px-2 py-1 bg-gradient-to-r from-sky-500/20 to-blue-600/20 border border-sky-500/30 rounded-md">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-black tracking-widest text-sky-400 text-[11px]">{t('brand')}</span>
          <span className="text-[9px] px-1 bg-sky-500/30 text-sky-300 font-mono rounded">DESKTOP</span>
        </div>

        {/* Dropdown menus */}
        <div className="flex items-center menu-dropdown-container">
          {localizedMenuItems.map((menu) => (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === menu.id ? null : menu.id);
                }}
                aria-label={menu.label}
                className={`h-8 px-2.5 rounded hover:bg-white/10 transition-colors flex items-center justify-center gap-1 whitespace-nowrap leading-none select-none ${
                  activeMenu === menu.id ? 'bg-white/15 text-white' : 'text-slate-300'
                }`}
              >
                <span className="whitespace-nowrap">{menu.label}</span>
                <ChevronDown size={12} className="opacity-50" />
              </button>

              {activeMenu === menu.id && (
                <div className="aether-menu-surface absolute left-0 top-full mt-1 w-56 bg-[#161822] border border-white/15 rounded-lg shadow-2xl py-1 z-[100] backdrop-blur-xl animate-in fade-in-50 zoom-in-95 duration-100">
                  {menu.items.map((item, idx) => {
                    if (item.type === 'divider') {
                      return <div key={`div-${idx}`} className="my-1 border-t border-white/10" />;
                    }
                    const Icon = item.icon!;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          setActiveMenu(null);
                          item.action?.();
                        }}
                        className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-sky-600/20 hover:text-sky-300 transition-colors text-xs ${
                          item.disabled ? 'opacity-30 cursor-not-allowed' : 'text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-slate-400" />
                          <span>{item.label}</span>
                        </div>
                        {item.shortcut && (
                          <kbd className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                  {menu.id === 'help' && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                        <Languages size={13} className="text-slate-400" />
                        <span>{t('language')}</span>
                      </div>
                      {(['zh-CN', 'en-US'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => { setLanguage(option); setActiveMenu(null); }}
                          className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-sky-600/20 hover:text-sky-300 transition-colors text-xs text-slate-200"
                        >
                          <span>{option === 'zh-CN' ? t('languageChinese') : t('languageEnglish')}</span>
                          {language === option && <Check size={14} className="text-cyan-300" />}
                        </button>
                      ))}
                    </>
                  )}
                  {false && menu.id === 'help' && (onOpenTemplates || onOpenPlugins) && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      {onOpenTemplates && <button type="button" onClick={() => { setActiveMenu(null); onOpenTemplates(); }} className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs text-slate-200 hover:bg-sky-600/20 hover:text-sky-300"><LayoutTemplate size={14} className="text-amber-300" /><span>预设库</span></button>}
                      {onOpenPlugins && <button type="button" onClick={() => { setActiveMenu(null); onOpenPlugins(); }} className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs text-slate-200 hover:bg-cyan-600/20 hover:text-cyan-300"><Plug size={14} className="text-cyan-300" /><span>物联网组件</span></button>}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {false && (onOpenTemplates || onOpenPlugins) && (
            <div className="ml-1 flex items-center gap-0.5 border-l border-white/10 pl-1">
              {onOpenTemplates && (
                <button type="button" onClick={onOpenTemplates} title="打开预设" className="min-h-10 rounded px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white flex items-center gap-1">
                  <LayoutTemplate size={13} className="text-amber-300" />
                  <span className="hidden sm:inline">预设</span>
                </button>
              )}
              {onOpenPlugins && (
                <button type="button" onClick={onOpenPlugins} title="打开物联网组件" className="min-h-10 rounded px-2 py-1 text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200 flex items-center gap-1">
                  <Plug size={13} className="text-cyan-300" />
                  <span className="hidden sm:inline">插件</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Editable Project Title */}
      <div className="hidden xl:flex shrink-0 items-center gap-2">
        {isEditingTitle ? (
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => {
              if (cancelTitleEditRef.current) {
                cancelTitleEditRef.current = false;
                return;
              }
              const nextTitle = draftTitle.trim() || projectData.meta?.title?.trim() || '未命名工程';
              if (nextTitle !== (projectData.meta?.title || '')) {
                onUpdateProject((p) => ({
                  ...p,
                  meta: { ...p.meta, title: nextTitle, updatedAt: new Date().toISOString() },
                }));
              }
              setIsEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                cancelTitleEditRef.current = true;
                setDraftTitle(projectData.meta?.title || '');
                setIsEditingTitle(false);
                e.currentTarget.blur();
              }
            }}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            autoFocus
            className="bg-black/50 border border-sky-500/50 rounded px-2 py-0.5 text-center text-xs font-semibold text-white outline-none w-64"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              cancelTitleEditRef.current = false;
              setDraftTitle(projectData.meta?.title || '');
              setIsEditingTitle(true);
            }}
            title="点击重命名工程"
            className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
          >
            <span className="font-semibold">{projectData.meta?.title || '未命名工程'}</span>
            <Edit3 size={11} className="opacity-40" />
          </button>
        )}
      </div>

      {/* Right: Workstation Mode & Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="relative menu-dropdown-container">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setActiveMenu(activeMenu === 'notifications' ? null : 'notifications'); }}
            title={language === 'en-US' ? 'Notifications' : '通知'}
            aria-label={language === 'en-US' ? 'Notifications' : '通知'}
            className={`relative min-w-10 min-h-10 flex items-center justify-center rounded-md border border-white/10 bg-white/[.04] text-slate-300 transition hover:bg-sky-300/10 hover:text-sky-200 ${unreadCount > 0 ? 'animate-pulse' : ''}`}
          >
            <Bell size={15} className={unreadCount > 0 ? 'text-amber-300' : 'text-slate-300'} />
            {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 rounded-full bg-rose-500 px-1 text-[9px] leading-4 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {activeMenu === 'notifications' && (
            <div className="aether-menu-surface absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-1rem)] bg-[#161822] border border-white/15 rounded-lg shadow-2xl z-50 p-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <strong className="text-xs text-slate-100">{language === 'en-US' ? 'Notifications' : '通知'}</strong>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-[10px] text-sky-300 hover:text-white">{language === 'en-US' ? 'Mark all read' : '全部已读'}</button>}
                  <button type="button" onClick={() => setActiveMenu(null)} aria-label={language === 'en-US' ? 'Close' : '关闭'} className="p-1 text-slate-400 hover:text-white"><X size={13} /></button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">{language === 'en-US' ? 'No notifications' : '暂无通知'}</p> : notifications.map((item) => {
                  const title = language === 'en-US' ? item.titleEn : item.titleZh;
                  const body = language === 'en-US' ? item.bodyEn : item.bodyZh;
                  return <button key={item.id} type="button" onClick={() => markNotificationRead(item.id)} className={`w-full border-b border-white/5 px-1 py-3 text-left last:border-0 hover:bg-white/5 ${!readNotificationIds.includes(item.id) ? 'bg-sky-500/[.06]' : ''}`}><div className="flex items-start gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${!readNotificationIds.includes(item.id) ? 'bg-amber-300' : 'bg-slate-600'}`} /><span className="min-w-0"><strong className="block text-xs text-slate-100">{title}</strong><span className="mt-1 block whitespace-pre-wrap text-[11px] leading-4 text-slate-400">{body}</span><time className="mt-1 block text-[10px] text-slate-600">{new Date(item.publishedAt).toLocaleString(language === 'en-US' ? 'en-US' : 'zh-CN', { hour12: false })}</time></span></div></button>;
                })}
              </div>
            </div>
          )}
        </div>
        {onOpenGlobalSearch && (
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            title="全局搜索 (Ctrl/Cmd+K)"
            aria-label="打开全局搜索"
            className="hidden min-h-10 min-w-10 items-center gap-2 rounded-md border border-white/10 bg-white/[.04] px-2.5 text-slate-400 transition hover:border-sky-300/30 hover:bg-sky-300/10 hover:text-sky-200 sm:flex"
          >
            <Search size={14} />
            <span className="hidden lg:inline text-xs">搜索</span>
            <kbd className="hidden xl:inline rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">⌘K</kbd>
          </button>
        )}
        <span
          className={`hidden md:inline text-[10px] ${saveStatus === 'error' ? 'text-rose-300' : saveStatus === 'saving' ? 'text-amber-200' : saveStatus === 'unsaved' ? 'text-slate-300' : 'text-emerald-300'}`}
          role="status"
          aria-live="polite"
        >
          {saveStatus === 'error' ? '保存失败 · 可重试' : saveStatus === 'saving' ? '保存中…' : saveStatus === 'unsaved' ? '有未保存更改' : '已保存'}
        </span>
        {/* 保存工程（手动保存，自动保存仍持续开启） */}
        <button
          type="button"
          onClick={onSave}
          title="保存工程 (Ctrl+S)"
          aria-label="保存工程"
          className="min-w-10 min-h-10 flex items-center justify-center gap-1 px-2 py-1 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 rounded-md font-medium transition-all"
        >
          <Save size={13} className="text-sky-400" />
          <span className="hidden xl:inline">保存</span>
        </button>

        {/* Undo / Redo & History Timeline Button */}
        <div className="flex items-center border border-white/10 rounded-md bg-white/5 p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
            aria-label="撤销"
            className={`hidden sm:flex min-w-10 min-h-10 items-center justify-center p-1 rounded hover:bg-white/10 ${!canUndo ? 'opacity-30 cursor-not-allowed' : 'text-slate-200'}`}
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="重做 (Ctrl+Y)"
            aria-label="重做"
            className={`hidden sm:flex min-w-10 min-h-10 items-center justify-center p-1 rounded hover:bg-white/10 ${!canRedo ? 'opacity-30 cursor-not-allowed' : 'text-slate-200'}`}
          >
            <Redo2 size={13} />
          </button>
          <div className="hidden sm:block w-[1px] h-3.5 bg-white/15 mx-0.5" />
          <button
            type="button"
            onClick={onOpenHistoryModal}
            title="查看操作历史记录面板 (Ctrl+H)"
            aria-label="打开操作历史"
            className="min-w-10 min-h-10 flex items-center justify-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-sky-300 transition-colors"
          >
            <History size={13} className="text-sky-400" />
            <span className="text-[10px] font-mono font-semibold text-slate-300">
              {currentIndex + 1}/{historyList.length}
            </span>
          </button>
        </div>

        {/* Mode Switcher: Edit vs Preview */}
        <button
          type="button"
          onClick={onToggleEditing}
          aria-label={isEditing ? '切换到演示模式' : '切换到创作工作台'}
          className={`min-w-10 min-h-10 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1 rounded-md font-medium transition-all shadow-sm ${
            isEditing
              ? 'bg-sky-500 text-white shadow-sky-500/30 hover:bg-sky-400'
              : 'bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-emerald-500'
          }`}
        >
          {isEditing ? (
            <>
              <Edit3 size={13} />
              <span className="hidden lg:inline">创作工作台</span>
            </>
          ) : (
            <>
              <Eye size={13} />
              <span className="hidden lg:inline">交互演示中 (按E返回)</span>
            </>
          )}
        </button>

        {/* Project Manager Button */}
        {onOpenProjectManager && (
          <button
            type="button"
            onClick={() => {
              setActiveMenu(null);
              onOpenProjectManager();
            }}
            aria-haspopup="dialog"
            className="hidden sm:flex min-w-10 min-h-10 items-center justify-center gap-1.5 px-2 lg:px-3 py-1 bg-cyan-400/[0.06] hover:bg-cyan-400/[0.12] border border-cyan-300/20 rounded-md font-medium text-slate-200 hover:text-white transition-all"
            title="打开工程管理"
          >
            <FolderOpen size={13} className="text-cyan-300" />
            <span className="hidden lg:inline">工程管理</span>
          </button>
        )}

        {/* Export Button with Dropdown */}
        <div className="relative menu-dropdown-container">
          <button
            type="button"
            onClick={() => setActiveMenu(activeMenu === 'export' ? null : 'export')}
            aria-label="打开发布与导出菜单"
            className={`min-w-10 min-h-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-white transition-all shadow-md ${
              activeMenu === 'export'
                ? 'bg-sky-400 border border-sky-300 shadow-sky-500/40'
                : 'bg-sky-500 hover:bg-sky-400 border border-sky-400/60 shadow-[0_0_14px_rgba(14,165,233,0.25)]'
            }`}
          >
            <Download size={13} className="text-white" />
            <span className="hidden sm:inline">导出发布</span>
            <ChevronDown size={12} className={`transition-transform duration-150 ${activeMenu === 'export' ? 'rotate-180' : ''}`} />
          </button>

          {activeMenu === 'export' && (
            <div className="aether-menu-surface absolute right-0 top-full mt-1 w-56 bg-[#1a1d28] border border-white/15 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  onOpenExportModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <FileText size={14} className="text-slate-400" />
                <div className="text-left">
                  <div>导出工程文件</div>
                  <div className="text-xs text-slate-500">ZIP / 单文件HTML / JSON</div>
                </div>
              </button>

              {onOpenAdvancedExportModal && (
                <>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenu(null);
                      onOpenAdvancedExportModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Film size={14} className="text-purple-400" />
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-1.5">
                        <span>高级导出</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 rounded-full">NEW</span>
                      </div>
                      <div className="text-xs text-slate-500">图片 / 视频 / HTML网页</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title="全屏演示 (F11)"
          aria-label="全屏演示"
          className="flex min-w-10 min-h-10 items-center justify-center p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-[#171a24] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="header-confirm-title">
            <h2 id="header-confirm-title" className="text-sm font-semibold text-white">请确认操作</h2>
            <p className="mt-2 text-xs leading-5 text-slate-300">{confirmation.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="min-h-10 rounded-lg bg-white/10 px-4 text-xs text-slate-300 hover:bg-white/15" onClick={() => setConfirmation(null)}>取消</button>
              <button type="button" autoFocus className="min-h-10 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-500" onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>继续</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
