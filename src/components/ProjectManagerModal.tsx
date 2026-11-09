/**
 * 工程管理弹窗
 * 新建/打开/删除/重命名工程
 * 工程缩略图预览、最近打开列表
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Plus, FolderOpen, Trash2, Edit3, Clock, Image as ImageIcon,
  Layers, Calendar, Search, Check, AlertCircle, FileText, Upload,
} from 'lucide-react';
import { aetherDB, opfs } from '../core/storage';
import type { ProjectSummary } from '../core/db/types';
import { ErrorNoticePanel } from './ErrorRecovery';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  onOpenProject: (projectId: string, projectData: any) => boolean | void;
  onNewProject: () => void;
  onImportProject: (file: File) => Promise<void> | void;
}

type ViewMode = 'all' | 'recent';

const isDirectThumbnailUrl = (value: string) => /^(data:|blob:|https?:)/i.test(value);

const mergeProjectSummaries = (current: ProjectSummary[], incoming: ProjectSummary[]) => {
  const projects = new Map(current.map((project) => [project.id, project]));
  for (const project of incoming) projects.set(project.id, project);
  return [...projects.values()].sort((a, b) => b.updatedAt - a.updatedAt);
};

const ProjectThumbnail: React.FC<{ project: ProjectSummary }> = ({ project }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = previewRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !project.thumbnail) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    const load = async () => {
      try {
        const nextUrl = isDirectThumbnailUrl(project.thumbnail!)
          ? project.thumbnail!
          : await opfs.readFileAsURL(project.thumbnail!);
        if (cancelled) {
          if (nextUrl.startsWith('blob:')) URL.revokeObjectURL(nextUrl);
          return;
        }
        objectUrl = nextUrl.startsWith('blob:') ? nextUrl : null;
        setUrl(nextUrl);
      } catch (error) {
        if (!cancelled) {
          console.warn('[project-manager] Unable to read project thumbnail', project.id, error);
          setFailed(true);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isVisible, project.id, project.thumbnail]);

  return (
    <div ref={previewRef} className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500">
      {url && !failed ? (
        <img src={url} alt={project.name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <>
          <ImageIcon size={28} className="text-slate-600" />
          <span className="text-[11px]">
            {failed ? '预览加载失败' : project.thumbnail && isVisible ? '正在读取预览' : '打开工程后生成预览'}
          </span>
        </>
      )}
    </div>
  );
};

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  currentProjectId,
  onOpenProject,
  onNewProject,
  onImportProject,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [recentProjects, setRecentProjects] = useState<Array<{ projectId: string; name: string; lastOpenedAt: number }>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const loadRequestRef = useRef(0);
  const [visibleProjectCount, setVisibleProjectCount] = useState(24);
  // 加载工程列表
  const loadProjects = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [allProjects, recent] = await Promise.all([
        aetherDB.listProjectSummaries(),
        aetherDB.getRecentProjects(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      setProjects(allProjects);
      setRecentProjects(recent);
      setIsLoading(false);

      void aetherDB.hydrateProjectSummaries((batch) => {
        if (requestId !== loadRequestRef.current) return;
        setProjects((current) => mergeProjectSummaries(current, batch));
      }).catch((migrationError) => {
        if (requestId === loadRequestRef.current) {
          setError(migrationError instanceof Error ? migrationError.message : String(migrationError));
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadProjects();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [isOpen, loadProjects]);

  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((item) => item.getAttribute('aria-hidden') !== 'true');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    setVisibleProjectCount(24);
    if (projectListRef.current) projectListRef.current.scrollTop = 0;
  }, [searchQuery, viewMode]);

  if (!isOpen) return null;

  // 打开工程
  const handleOpenProject = async (project: ProjectSummary) => {
    if (openingProjectId) return;
    setOpeningProjectId(project.id);
    setError(null);
    try {
      const fullProject = await aetherDB.getProject(project.id);
      if (fullProject) {
        // 添加到最近打开
        await aetherDB.addRecentProject({
          projectId: project.id,
          name: project.name,
          lastOpenedAt: Date.now(),
        });
        const opened = onOpenProject(project.id, fullProject.data);
        if (opened === false) {
          setError('工程数据格式不完整或已损坏，未进入编辑器。');
          return;
        }
        onClose();
      } else {
        setError('工程数据不存在或已损坏，请删除后重新导入。');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpeningProjectId(null);
    }
  };

  const handleImportProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting) return;
    setIsImporting(true);
    setImportFileName(file.name);
    setError(null);
    try {
      await onImportProject(file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsImporting(false);
    }
  };

  // 删除工程
  const handleDeleteProject = async (projectId: string) => {
    try {
      await aetherDB.deleteProject(projectId);
      await aetherDB.removeRecentProject(projectId);
      setDeleteConfirmId(null);
      await loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 重命名工程
  const handleRenameProject = async (projectId: string) => {
    if (!editingName.trim()) return;
    try {
      const project = await aetherDB.getProject(projectId);
      if (project) {
        await aetherDB.saveProject({
          ...project,
          name: editingName.trim(),
          updatedAt: Date.now(),
        });
        setEditingId(null);
        setEditingName('');
        await loadProjects();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 格式化文件大小
  const formatSize = (bytes?: number) => {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 过滤工程
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 最近工程的完整信息
  const recentProjectDetails = recentProjects
    .map((r) => projects.find((p) => p.id === r.projectId))
    .filter((p): p is ProjectSummary => !!p);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const displayProjects = (viewMode === 'recent' ? recentProjectDetails : filteredProjects)
    .filter((project) => !normalizedQuery || project.name.toLowerCase().includes(normalizedQuery));
  const visibleProjects = displayProjects.slice(0, visibleProjectCount);

  const handleProjectListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight > 480) return;
    setVisibleProjectCount((count) => Math.min(displayProjects.length, count + 24));
  };

  return (
    <div className="project-manager-overlay fixed inset-x-0 top-11 bottom-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" role="presentation">
      <div ref={dialogRef} className="project-manager-dialog w-full max-w-4xl h-[80vh] bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="project-manager-title">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h2 id="project-manager-title" className="text-xl font-semibold text-white">工程管理</h2>
              <p className="text-xs text-slate-500">共 {projects.length} 个工程</p>
              <p className="mt-1 text-[11px] text-slate-400">新建从空白画布开始；已有工程可导入或从列表继续编辑，模板可在工作台打开预设库。</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              className="hidden"
              accept=".aether,.zip,.json,.html"
              onChange={handleImportProject}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 text-sm font-medium hover:border-cyan-400/50 hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-60 transition-colors"
            >
              <Upload size={16} />
              {isImporting ? '正在导入…' : '导入工程'}
            </button>
            <button
              type="button"
              onClick={() => {
                onNewProject();
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-medium hover:from-cyan-400 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Plus size={16} />
              新建空白工程
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="关闭工程管理窗口"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {isImporting && (
          <div className="flex items-center gap-2 border-b border-sky-400/15 bg-sky-400/[0.05] px-6 py-2 text-xs text-sky-100" role="status" aria-live="polite">
            <span className="h-3 w-3 animate-spin rounded-full border border-sky-200/30 border-t-sky-200" aria-hidden="true" />
            <span>正在读取并校验工程：{importFileName}</span>
          </div>
        )}

        {/* 工具栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers size={14} className="inline mr-1.5" />
              全部工程
            </button>
            <button
              type="button"
              onClick={() => setViewMode('recent')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'recent'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={14} className="inline mr-1.5" />
              最近打开
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="搜索工程..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <ErrorNoticePanel
            className="mx-6 mt-4"
            title="工程操作失败"
            message={error}
            details={`视图: ${viewMode}\n搜索: ${searchQuery || '无'}\n当前工程: ${currentProjectId}\n正在打开: ${openingProjectId || '无'}\n正在导入: ${isImporting ? '是' : '否'}`}
            onRetry={() => void loadProjects()}
            onDismiss={() => setError(null)}
          />
        )}

        {/* 工程列表 */}
        <div ref={projectListRef} onScroll={handleProjectListScroll} className="project-manager-list flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-3" />
              <span className="text-sm">加载工程列表...</span>
            </div>
          ) : displayProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <FolderOpen size={48} className="mb-4 opacity-30" />
              <p className="text-sm mb-2">
                {normalizedQuery ? '没有匹配的工程' : viewMode === 'recent' ? '暂无最近打开的工程' : '暂无工程'}
              </p>
              <p className="text-xs text-slate-600">
                {normalizedQuery ? '请调整搜索关键词后重试' : '可新建空白工程开始创作，或导入已有工程继续编辑。'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProjects.map((project) => (
                <div
                  key={project.id}
                  className={`project-manager-card group relative bg-white/[0.03] border rounded-xl overflow-hidden transition-all hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 ${
                    project.id === currentProjectId ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' : 'border-white/10'
                  }`}
                >
                  {/* 缩略图 */}
                  <div
                    className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden cursor-pointer"
                    onClick={() => handleOpenProject(project)}
                  >
                    <ProjectThumbnail project={project} />
                    {/* 当前工程标记 */}
                    {project.id === currentProjectId && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-cyan-500/90 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Check size={10} />
                        当前
                      </div>
                    )}
                    {openingProjectId === project.id && (
                      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center gap-2 text-sm text-cyan-200">
                        <span className="w-4 h-4 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                        正在打开
                      </div>
                    )}
                    {/* 悬浮遮罩 */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
                        点击打开
                      </span>
                    </div>
                  </div>

                  {/* 工程信息 */}
                  <div className="p-3">
                    {editingId === project.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameProject(project.id);
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditingName('');
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 bg-white/10 border border-cyan-500/50 rounded text-sm text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameProject(project.id)}
                          className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-sm font-medium text-white truncate mb-1" title={project.name}>
                        {project.name}
                      </h3>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers size={11} />
                        {project.sceneCount} 场景
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {formatDate(project.updatedAt).slice(5, 16)}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(project.id);
                        setEditingName(project.name);
                      }}
                      className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:bg-cyan-500/50 transition-colors"
                      title="重命名"
                      aria-label={`重命名工程：${project.name}`}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(project.id);
                      }}
                      className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:bg-rose-500/50 transition-colors"
                      title="删除"
                      aria-label={`删除工程：${project.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* 删除确认 */}
                  {deleteConfirmId === project.id && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-10">
                      <AlertCircle size={24} className="text-rose-400 mb-2" />
                      <p className="text-sm text-white text-center mb-1">确定删除此工程？</p>
                      <p className="text-xs text-slate-400 text-center mb-4">删除后无法恢复</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(project.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs hover:bg-rose-400 transition-colors"
                        >
                          确认删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-white/[0.02]">
          <span className="text-xs text-slate-500">
            显示 {displayProjects.length} / {projects.length} 个工程
          </span>
          <span className="text-xs text-slate-600">
            数据存储于本地 IndexedDB，不会上传到服务器
          </span>
        </div>
      </div>
    </div>
  );
};
