import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { APP_VERSION } from '../core/db/types';
import { checkForUpdate, type AppUpdateInfo } from '../core/update/updateService';

/** 帮助菜单「检查更新」通过该事件触发手动检查。 */
export const UPDATE_CHECK_EVENT = 'aether:check-update';

export const UpdateNotice: React.FC = () => {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'latest'>('idle');

  useEffect(() => {
    let cancelled = false;
    const run = async (force: boolean) => {
      if (force) setStatus('checking');
      const next = await checkForUpdate(APP_VERSION, { force });
      if (cancelled) return;
      setInfo(next);
      if (force) {
        setStatus(next ? 'idle' : 'latest');
        if (!next) window.setTimeout(() => { if (!cancelled) setStatus('idle'); }, 3200);
      }
    };
    void run(false);
    const handler = () => { void run(true); };
    window.addEventListener(UPDATE_CHECK_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(UPDATE_CHECK_EVENT, handler);
    };
  }, []);

  if (status === 'latest') {
    return (
      <div className="fixed left-1/2 top-[72px] z-[9998] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-emerald-950/90 px-4 py-2 text-xs text-emerald-200 shadow-xl backdrop-blur">
        已是最新版本 v{APP_VERSION}
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="fixed left-1/2 top-[72px] z-[9998] w-[420px] max-w-[92vw] -translate-x-1/2 rounded-xl border border-cyan-400/30 bg-[#101a2b]/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-2">
        <ArrowUpCircle size={18} className="mt-0.5 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white">发现新版本 v{info.version}</div>
          {info.notes ? (
            <p className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-300">{info.notes}</p>
          ) : (
            <p className="mt-1 text-[11px] leading-5 text-slate-400">当前版本 v{APP_VERSION}，建议更新以获得最新修复。</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.open(info.url, '_blank', 'noopener,noreferrer')}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500"
            >
              立即下载
            </button>
            <button
              type="button"
              onClick={() => setInfo(null)}
              className="rounded-md px-2 py-1.5 text-[11px] text-slate-400 hover:text-white"
            >
              稍后提醒
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setInfo(null)} aria-label="关闭更新提示" className="p-1 text-slate-500 hover:text-white">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
