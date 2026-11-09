/**
 * 错误处理与恢复
 * 崩溃自动恢复、友好错误提示、导出失败重试
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, RefreshCw, Home, Download, X,
  CheckCircle, Clock, Trash2,
} from 'lucide-react';

interface ErrorRecoveryProps {
  isOpen: boolean;
  onClose: () => void;
  error?: Error | null;
  onRecover?: (backup: CrashBackup) => void;
  onReset?: () => void;
}

interface CrashBackup {
  timestamp: number;
  projectData: any;
  projectId: string;
}

const CRASH_BACKUP_KEY = 'aether_crash_backup';
const MAX_CRASH_BACKUPS = 5;

/**
 * 保存崩溃备份
 */
export function saveCrashBackup(projectData: any, projectId: string): void {
  try {
    const backups = getCrashBackups();
    const newBackup: CrashBackup = {
      timestamp: Date.now(),
      projectData,
      projectId,
    };
    backups.unshift(newBackup);
    // 只保留最近5个备份
    const trimmed = backups.slice(0, MAX_CRASH_BACKUPS);
    localStorage.setItem(CRASH_BACKUP_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[ErrorRecovery] 保存崩溃备份失败:', e);
  }
}

/**
 * 获取所有崩溃备份
 */
export function getCrashBackups(): CrashBackup[] {
  try {
    const raw = localStorage.getItem(CRASH_BACKUP_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[ErrorRecovery] 读取崩溃备份失败:', e);
  }
  return [];
}

/**
 * 获取最新的崩溃备份
 */
export function getLatestCrashBackup(): CrashBackup | null {
  const backups = getCrashBackups();
  return backups.length > 0 ? backups[0] : null;
}

/**
 * 清除所有崩溃备份
 */
export function clearCrashBackups(): void {
  try {
    localStorage.removeItem(CRASH_BACKUP_KEY);
  } catch (e) {
    console.warn('[ErrorRecovery] 清除崩溃备份失败:', e);
  }
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

/**
 * 错误恢复弹窗
 */
export const ErrorRecoveryModal: React.FC<ErrorRecoveryProps> = ({
  isOpen,
  onClose,
  error,
  onRecover,
  onReset,
}) => {
  const [backups, setBackups] = useState<CrashBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<CrashBackup | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBackups(getCrashBackups());
      setSelectedBackup(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRecover = (backup: CrashBackup) => {
    setSelectedBackup(backup);
    if (onRecover) {
      onRecover(backup);
    }
    onClose();
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
      <div className="w-full max-w-lg bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="error-recovery-title">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-rose-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-rose-400" />
            </div>
            <div>
              <h2 id="error-recovery-title" className="text-lg font-semibold text-white">程序异常恢复</h2>
              <p className="text-xs text-slate-500">检测到上次异常退出，可恢复未保存的内容</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="关闭恢复窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="px-6 py-3 bg-rose-500/5 border-b border-white/5">
            <p className="text-xs text-rose-400 font-mono truncate" title={error.message}>
              {error.message}
            </p>
          </div>
        )}

        {/* 备份列表 */}
        <div className="p-6 max-h-80 overflow-y-auto">
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-slate-400">暂无可用的恢复备份</p>
              <p className="text-xs text-slate-600 mt-1">您可以选择重置为空白工程</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-3">
                找到 {backups.length} 个自动备份，选择一个恢复：
              </p>
              {backups.map((backup, index) => (
                <div
                  key={backup.timestamp}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedBackup?.timestamp === backup.timestamp
                      ? 'bg-cyan-500/10 border-cyan-500/40'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                  onClick={() => setSelectedBackup(backup)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBackup(backup); } }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      index === 0 ? 'bg-cyan-500/20' : 'bg-white/5'
                    }`}>
                      {index === 0 ? (
                        <CheckCircle size={14} className="text-cyan-400" />
                      ) : (
                        <Clock size={14} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {index === 0 ? '最新备份' : `备份 ${index + 1}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatTime(backup.timestamp)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRecover(backup);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                  >
                    恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => {
              clearCrashBackups();
              setBackups([]);
            }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={12} />
            清除所有备份
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
            >
              <Home size={14} />
              重置工程
            </button>
            {selectedBackup && (
              <button
                type="button"
                onClick={() => handleRecover(selectedBackup)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-medium hover:from-cyan-400 hover:to-purple-500 transition-all"
              >
                <RefreshCw size={14} />
                恢复选中备份
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 友好错误提示组件
 */
export const FriendlyErrorToast: React.FC<{
  message: string;
  type?: 'error' | 'warning' | 'info';
  onClose?: () => void;
  onRetry?: () => void;
}> = ({ message, type = 'error', onClose, onRetry }) => {
  const colors = {
    error: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
    warning: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    info: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  };

  const icons = {
    error: <AlertTriangle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <CheckCircle size={16} />,
  };

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[500] flex max-w-[min(560px,calc(100vw-32px))] items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${colors[type]}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}>
      {icons[type]}
      <span className="min-w-0 text-sm font-medium leading-5">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
        >
          <RefreshCw size={12} />
          重试
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="关闭错误提示"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export const ErrorNoticePanel: React.FC<{
  title?: string;
  message: string;
  details?: string;
  tone?: 'error' | 'warning';
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ title = '操作失败', message, details, tone = 'error', onRetry, onDismiss, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const isError = tone === 'error';
  const copyText = [
    title,
    message,
    details ? `\n诊断信息:\n${details}` : '',
  ].filter(Boolean).join('\n');

  const copyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = copyText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${isError ? 'border-rose-300/25 bg-rose-300/[.06] text-rose-100' : 'border-amber-300/25 bg-amber-300/[.07] text-amber-100'} ${className}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className={`mt-0.5 shrink-0 ${isError ? 'text-rose-300' : 'text-amber-200'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold">{title}</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-5 opacity-90">{message}</p>
          {details && <details className="mt-2 text-[9px] opacity-80">
            <summary className="cursor-pointer select-none">查看诊断信息</summary>
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono leading-4">{details}</pre>
          </details>}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-current/60 transition hover:bg-white/10 hover:text-current" aria-label="关闭错误提示">
            <X size={13} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        <button type="button" onClick={copyDiagnostic} className="min-h-7 rounded-md border border-white/10 px-2 text-[9px] text-current/85 transition hover:bg-white/10">
          {copied ? '已复制' : '复制诊断'}
        </button>
        {onRetry && (
          <button type="button" onClick={onRetry} className="flex min-h-7 items-center gap-1 rounded-md border border-white/10 px-2 text-[9px] text-current/90 transition hover:bg-white/10">
            <RefreshCw size={11} />
            重试
          </button>
        )}
      </div>
    </div>
  );
};
