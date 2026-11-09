import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MessageSquarePlus, MessageSquareText, Trash2, X } from 'lucide-react';
import type { Scene, SceneComment } from '../types';

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  comments: SceneComment[];
  scenes: Record<string, Scene>;
  activeSceneId: string;
  onFocus: (comment: SceneComment) => void;
  onUpdate: (id: string, patch: Partial<SceneComment>) => void;
  onDelete: (id: string) => void;
  onStartComment?: () => void;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  comments,
  scenes,
  activeSceneId,
  onFocus,
  onUpdate,
  onDelete,
  onStartComment,
}) => {
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = (comments || []).filter((comment) => !onlyOpen || !comment.resolved);
    return list.slice().sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt - a.createdAt);
  }, [comments, onlyOpen]);
  const openCount = (comments || []).filter((comment) => !comment.resolved).length;

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex justify-end bg-black/45 p-0 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="flex h-full w-full max-w-sm flex-col border-l border-cyan-400/20 bg-[#0d121c] text-slate-200 shadow-2xl" role="dialog" aria-modal="true" aria-label="评论与评审">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <MessageSquareText size={15} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">评论与评审</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">{openCount} 条待处理 · {comments.length} 条总计</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭评论面板">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
            <button type="button" onClick={() => setOnlyOpen(true)} className={`rounded px-2 py-1 text-[10px] ${onlyOpen ? 'bg-cyan-400/20 text-cyan-200' : 'text-slate-500 hover:text-slate-200'}`}>未解决</button>
            <button type="button" onClick={() => setOnlyOpen(false)} className={`rounded px-2 py-1 text-[10px] ${!onlyOpen ? 'bg-cyan-400/20 text-cyan-200' : 'text-slate-500 hover:text-slate-200'}`}>全部</button>
          </div>
          {onStartComment && (
            <button
              type="button"
              onClick={() => { onStartComment(); onClose(); }}
              className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
            >
              <MessageSquarePlus size={11} /> 在画布上评论
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
              <MessageSquareText size={22} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs text-slate-300">{onlyOpen ? '没有待处理的评论' : '还没有评论'}</p>
              <p className="mt-1 text-[10px] text-slate-500">打开评论模式，在画布上点一下就能钉评论。</p>
            </div>
          ) : filtered.map((comment) => {
            const scene = scenes[comment.sceneId];
            const isActiveScene = comment.sceneId === activeSceneId;
            return (
              <div key={comment.id} className={`rounded-xl border p-2.5 ${comment.resolved ? 'border-white/5 bg-white/[0.015] opacity-65' : 'border-white/10 bg-black/25'}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${comment.resolved ? 'bg-emerald-400/15 text-emerald-300' : 'bg-cyan-400/15 text-cyan-200'}`}>
                    {comment.resolved ? <Check size={10} /> : '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-200">{comment.text}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500">
                      <span>{comment.author || '我'}</span>
                      <span>·</span>
                      <span>{new Date(comment.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
                      <span>·</span>
                      <span className={isActiveScene ? 'text-cyan-300/80' : ''}>{scene?.alias || comment.sceneId}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  <button type="button" onClick={() => { onFocus(comment); onClose(); }} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200">定位</button>
                  <button type="button" onClick={() => onUpdate(comment.id, { resolved: !comment.resolved })} className={`rounded border px-1.5 py-0.5 text-[9px] ${comment.resolved ? 'border-white/10 text-slate-400 hover:text-white' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'}`}>
                    {comment.resolved ? '重新打开' : '解决'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === comment.id) {
                        onDelete(comment.id);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(comment.id);
                      }
                    }}
                    className={`grid h-5 w-5 place-items-center rounded ${confirmDeleteId === comment.id ? 'bg-rose-500/20 text-rose-300' : 'text-slate-500 hover:text-rose-300'}`}
                    aria-label={confirmDeleteId === comment.id ? '确认删除评论' : '删除评论'}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );

  return createPortal(modal, document.body);
};
