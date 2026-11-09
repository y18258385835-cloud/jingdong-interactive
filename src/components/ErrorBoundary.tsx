import { Component, type ErrorInfo, type ReactNode } from 'react';
import { aetherDB } from '../core/db';
import { dbManager } from '../utils/db';
import { isDynamicModuleLoadError } from '../utils/errorClassification';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * 全局渲染错误边界。
 * 铁律 2：禁静默吞错——任何渲染崩溃都不允许表现为白屏，必须展示错误卡并记录 console。
 * 提供「重置并重载」按钮：清空工程数据回退干净示例工程，用于从持久化坏数据中恢复。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[aether] 渲染崩溃（已由 ErrorBoundary 捕获）:', error);
    if (info && info.componentStack) {
      // eslint-disable-next-line no-console
      console.error('[aether] 组件栈:', info.componentStack);
    }
    this.setState({ componentStack: info && info.componentStack ? info.componentStack : null });
  }

  private handleReset = async (): Promise<void> => {
    try {
      localStorage.removeItem('aether_desktop_project_v43');
      localStorage.removeItem('aether_desktop_project_v42');
      localStorage.removeItem('aether_desktop_project');
      localStorage.removeItem('aether_current_project_id');
      localStorage.removeItem('aether_history_v43');
    } catch {
      /* ignore */
    }
    // 两套存储都清理：新版核心库 + 兼容旧版素材库，避免 reload 后再次读取损坏数据。
    await Promise.allSettled([
      aetherDB.clearProjectData(),
      dbManager.clearAll(),
    ]);
    window.location.reload();
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) {
      return this.props.children;
    }
    const moduleLoadError = isDynamicModuleLoadError(error);

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0e14',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 760, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 12px rgba(239,68,68,0.6)',
              }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: 0.5 }}>
              {moduleLoadError ? '鲸动交互平台 — 页面模块需要重新加载' : '鲸动交互平台 — 渲染崩溃'}
            </h1>
          </div>
          <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
            {moduleLoadError
              ? '开发服务器可能刚重启，当前页面还在使用上一次的模块地址，导致动态组件加载失败。这不代表工程损坏，先重新加载页面即可。'
              : '编辑器遇到未预期的渲染错误。错误已记录到浏览器控制台（F12 → Console）。如果持续出现，请把下方错误信息与控制台红色报错反馈给开发者以便定位。'}
          </p>
          <div
            style={{
              background: '#131722',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              fontFamily: '"Cascadia Code", Consolas, monospace',
              fontSize: 12.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#fca5a5',
              maxHeight: 260,
              overflow: 'auto',
            }}
          >
            {String(error && error.message ? error.message : error)}
            {componentStack ? `\n\n--- 组件栈 ---\n${componentStack}` : ''}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            aria-label="重新加载页面"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重新加载页面
          </button>
          {!moduleLoadError && (
            <button
              type="button"
              onClick={this.handleReset}
              aria-label="清理当前工程数据并重新加载"
              style={{
                marginLeft: 10,
                background: 'rgba(239,68,68,0.10)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              仍无法打开？重置工程
            </button>
          )}
          {moduleLoadError && (
            <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
              重新加载不会清空工程数据。如果刷新后仍然失败，请确认开发服务器正在运行，或清理 Vite 缓存后再试。
            </p>
          )}
        </div>
      </div>
    );
  }
}
