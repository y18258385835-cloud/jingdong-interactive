import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, RotateCcw, Save, Trash2, X } from 'lucide-react';
import type { ProjectVersion } from '../utils/projectVersions';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  versions: ProjectVersion[];
  onSave: (name: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', { hour12: false });

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  isOpen,
  onClose,
  projectName,
  versions,
  onSave,
  onRestore,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d121c] text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-label="版本存档">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <Clock size={15} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">版本存档</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">{projectName || '当前工程'} · 最多保留 12 个版本</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭版本存档">
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSave(name.trim() || `版本 ${versions.length + 1}`);
                  setName('');
                }
              }}
              placeholder={`版本名称，如：给客户的第 3 版`}
              aria-label="版本名称"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => {
                onSave(name.trim() || `版本 ${versions.length + 1}`);
                setName('');
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-amber-300"
            >
              <Save size={12} />
              保存当前版本
            </button>
          </div>
          <p className="mt-1.5 text-[9px] text-slate-500">恢复旧版本前会自动保存当前状态，避免误操作丢内容。</p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {versions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
              <Clock size={22} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs text-slate-300">还没有保存过版本</p>
              <p className="mt-1 text-[10px] text-slate-500">改到关键节点时点「保存当前版本」，之后可以随时回来。</p>
            </div>
          ) : versions.map((version) => (
            <div key={version.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-white">{version.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
                    <span>{formatTime(version.createdAt)}</span>
                    <span>·</span>
                    <span>{version.sceneCount} 个场景</span>
                    <span>·</span>
                    <span>{version.elementCount} 个图层</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmRestoreId === version.id) {
                        onRestore(version.id);
                        setConfirmRestoreId(null);
                      } else {
                        setConfirmRestoreId(version.id);
                        setConfirmDeleteId(null);
                      }
                    }}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-semibold ${confirmRestoreId === version.id ? 'border-amber-400/50 bg-amber-400/20 text-amber-100' : 'border-white/10 text-slate-300 hover:border-amber-400/40 hover:text-amber-200'}`}
                    aria-label={confirmRestoreId === version.id ? '确认恢复版本' : '恢复版本'}
                  >
                    <RotateCcw size={10} />
                    {confirmRestoreId === version.id ? '确认恢复' : '恢复'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === version.id) {
                        onDelete(version.id);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(version.id);
                        setConfirmRestoreId(null);
                      }
                    }}
                    className={`grid h-6 w-6 place-items-center rounded-lg border ${confirmDeleteId === version.id ? 'border-rose-400/50 bg-rose-500/20 text-rose-200' : 'border-white/10 text-slate-500 hover:border-rose-400/40 hover:text-rose-300'}`}
                    aria-label={confirmDeleteId === version.id ? '确认删除版本' : '删除版本'}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-right">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/5">关闭</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
