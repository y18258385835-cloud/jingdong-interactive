/**
 * AppProvider - 应用根组件
 * 负责三层核心（P0存储/P1授权/P2导出）的初始化
 * 用 SubscriptionProvider 包裹整个应用
 */

import React, { useEffect, useState, useCallback } from 'react';
import { initStorage } from '../core/storage';
import { initAuth } from '../core/auth';
import { initExport } from '../core/export';
import { useLanguage } from '../i18n/LanguageContext';

interface AppProviderProps {
  children: React.ReactNode;
}

interface InitState {
  storage: boolean;
  auth: boolean;
  export: boolean;
  error: string | null;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const { t } = useLanguage();
  const [initState, setInitState] = useState<InitState>({
    storage: false,
    auth: false,
    export: false,
    error: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const initialize = useCallback(async () => {
    try {
      // P0: 初始化存储层（IndexedDB + OPFS）
      await initStorage();
      setInitState((prev) => ({ ...prev, storage: true }));

      // P1: 初始化授权层（订阅验证）
      await initAuth();
      setInitState((prev) => ({ ...prev, auth: true }));

      // P2: 初始化导出层
      await initExport();
      setInitState((prev) => ({ ...prev, export: true }));

      setIsInitialized(true);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error('[Aether] 初始化失败:', e);
      setInitState((prev) => ({ ...prev, error }));
      // 即使初始化失败也继续渲染，保证应用可用（降级模式）
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 初始化加载界面
  if (!isInitialized) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0e] flex flex-col items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {t('brand')}
              </h1>
              <p className="text-xs text-slate-500">{t('brand')}</p>
            </div>
          </div>

          {/* 初始化进度 */}
          <div className="w-64 space-y-2">
            <InitItem label={t('storage')} done={initState.storage} />
            <InitItem label={t('auth')} done={initState.auth} />
            <InitItem label={t('export')} done={initState.export} />
          </div>

          {/* 加载动画 */}
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <span>{t('initializing')}</span>
          </div>

          {initState.error && (
            <div className="text-amber-400 text-xs text-center max-w-xs">
              {t('initError')}{initState.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * 初始化进度项
 */
const InitItem: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <div className="flex items-center gap-2 text-sm">
    <div
      className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
        done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'
      }`}
    >
      {done ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
      )}
    </div>
    <span className={done ? 'text-slate-300' : 'text-slate-500'}>{label}</span>
  </div>
);
