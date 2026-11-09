import React from 'react';
import {
  MousePointer, Hand, Magnet, Grid, Shield, Maximize,
  PenTool, MousePointer2, MessageSquarePlus, History, Palette, Share2, Ruler
} from 'lucide-react';
import { CustomCodeCategory, ViewportState } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

export type WorkspaceTab = 'scenes' | 'layers' | 'assets' | 'design' | 'components' | 'ai' | 'history' | 'templates' | 'plugins';
export type WorkspaceNavKey = WorkspaceTab;

export interface WorkstationToolbarProps {
  viewport: ViewportState;
  onUpdateViewport: (updater: (prev: ViewportState) => ViewportState) => void;
  onAddElement?: (type: 'txt' | 'img' | 'vid' | 'shape' | 'saber' | 'chart' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat') => void;
  onAddAudio?: (file: File) => void;
  onImportMedia?: (files: File[]) => void | Promise<unknown>;
  onOpen3DModal?: () => void;
  onOpenShapePresetModal?: () => void;
  onOpenSaberPresetModal?: () => void;
  onOpenVfxModal?: () => void;
  onOpenCardLayoutModal?: () => void;
  onOpenUILibraryModal?: () => void;
  onOpenOfficialComponents?: () => void;
  onOpenPluginCenter?: () => void;
  onOpenInteractionControlsModal?: () => void;
  onOpenBackgroundRemoval?: () => void;
  onOpenAiSceneBuilder?: () => void;
  onOpenCustomCodePlugin?: () => void;
  customCodeCategories?: CustomCodeCategory[];
  onFitCanvas: () => void;
  activeSidebarTab?: WorkspaceTab;
  onSidebarTabChange?: (tab: WorkspaceTab) => void;
  activeNav?: WorkspaceNavKey;
  onActiveNavChange?: (nav: WorkspaceNavKey) => void;
  activeSceneAlias?: string;
  canvasSpec?: { width: number; height: number };
  commentMode?: boolean;
  commentCount?: number;
  versionCount?: number;
  onToggleCommentMode?: () => void;
  onOpenComments?: () => void;
  onOpenVersions?: () => void;
  onOpenTheme?: () => void;
  onOpenShare?: () => void;
  handoffMode?: boolean;
  onOpenHandoff?: () => void;
}

export const WorkstationToolbar: React.FC<WorkstationToolbarProps> = ({
  viewport,
  onUpdateViewport,
  onFitCanvas,
  activeSceneAlias,
  canvasSpec,
  commentMode = false,
  commentCount = 0,
  versionCount = 0,
  onToggleCommentMode,
  onOpenComments,
  onOpenVersions,
  onOpenTheme,
  onOpenShare,
  handoffMode = false,
  onOpenHandoff,
}) => {
  const { translateText } = useLanguage();
  const normalizedZoom = Number.isFinite(viewport.zoom) ? Math.max(0.05, Math.min(5, viewport.zoom)) : 1;

  return (
    <div className="aether-workstation-toolbar relative z-[100] shrink-0 bg-[#0c1017] border-b border-white/[0.08] text-xs text-slate-300 select-none">
      <div className="flex h-[38px] items-center justify-between gap-3 px-3 overflow-x-auto no-scrollbar">
        {/* 左侧：场景信息与规格（纯粹视口信息） */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/5">
            <span className="text-sky-400 font-bold">🎬</span>
            <span className="text-xs font-bold text-white truncate max-w-[160px]">
              {activeSceneAlias || translateText('当前主场景')}
            </span>
          </div>

          {canvasSpec && (
            <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
              {canvasSpec.width} × {canvasSpec.height}
            </span>
          )}
        </div>

        {/* 中间：画布交互核心光标工具组（对标剪映/Figma 核心工具切换） */}
        <div className="flex shrink-0 items-center bg-[#10151f] border border-white/10 rounded-lg p-0.5 gap-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'select' }))}
            title={translateText('选择工具 (V)')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewport.activeTool === 'select'
                ? 'bg-sky-500 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MousePointer size={13} />
            <span>{translateText('选择')}</span>
            <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">V</kbd>
          </button>

          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'pan' }))}
            title={translateText('抓手平移画布 (H 或 空格拖动)')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewport.activeTool === 'pan'
                ? 'bg-sky-500 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Hand size={13} />
            <span>{translateText('抓手')}</span>
            <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">H</kbd>
          </button>

          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'saber-draw' }))}
            title={translateText('Saber 钢笔矢量光线工具 (P)')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewport.activeTool === 'saber-draw'
                ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.6)]'
                : 'text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/10'
            }`}
          >
            <PenTool size={13} />
            <span>{translateText('光线钢笔')}</span>
            <kbd className="hidden lg:inline text-[9px] opacity-60 font-mono">P</kbd>
          </button>

          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'interaction-draw' }))}
            title={translateText('交互绘制：依次点击顶点绘制多边形热区 (R)')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewport.activeTool === 'interaction-draw'
                ? 'bg-emerald-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                : 'text-emerald-300 hover:text-emerald-100 hover:bg-emerald-400/10'
            }`}
          >
            <MousePointer2 size={13} />
            <span>{translateText('交互绘制')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'mask-pen' }))}
            title={translateText('钢笔蒙版：在当前选中图层上绘制路径遮罩 (M)')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewport.activeTool === 'mask-pen'
                ? 'bg-violet-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(167,139,250,0.5)]'
                : 'text-violet-300 hover:text-violet-100 hover:bg-violet-400/10'
            }`}
          >
            <PenTool size={13} />
            <span>{translateText('蒙版钢笔')}</span>
          </button>
        </div>

        {/* 右侧：辅助线与视口缩放 */}
        <div className="flex shrink-0 items-center gap-1.5" data-viewport-controls="true">
          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, showSafeArea: !v.showSafeArea }))}
            title={translateText(viewport.showSafeArea ? '隐藏安全框' : '显示安全框')}
            className={`flex h-7 items-center justify-center gap-1 rounded border px-2 text-[10px] transition-colors ${
              viewport.showSafeArea
                ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
                : 'border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield size={11} />
            <span className="hidden sm:inline">{translateText('安全框')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, showGrid: !v.showGrid }))}
            title={translateText(viewport.showGrid ? '隐藏参考网格' : '显示参考网格')}
            className={`flex h-7 items-center justify-center gap-1 rounded border px-2 text-[10px] transition-colors ${
              viewport.showGrid
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid size={11} />
            <span className="hidden sm:inline">{translateText('网格')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateViewport((v) => ({ ...v, snapEnabled: !v.snapEnabled }))}
            title={translateText(viewport.snapEnabled ? '磁吸对齐：已开启 (S)' : '磁吸对齐：已关闭 (S)')}
            className={`flex h-7 items-center gap-1 rounded border px-2 text-[10px] transition-colors ${
              viewport.snapEnabled
                ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                : 'border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Magnet size={11} />
            <span className="hidden sm:inline">{translateText('磁吸')}</span>
          </button>

          <div className="flex h-7 shrink-0 items-center gap-0.5 rounded border border-white/10 bg-[#10151f] p-0.5">
            {[0.5, 0.75, 1].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onUpdateViewport((v) => ({ ...v, zoom: preset, panX: 0, panY: 0 }))}
                className={`h-6 min-w-8 rounded px-1 text-[10px] font-mono transition-colors ${
                  Math.abs(normalizedZoom - preset) < 0.005
                    ? 'bg-sky-500/20 text-sky-200 font-bold'
                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
            <button
              type="button"
              onClick={onFitCanvas}
              title={translateText('自适应窗口大小')}
              className="flex h-6 min-w-8 items-center justify-center gap-1 rounded px-1.5 text-[10px] text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Maximize size={11} />
              <span>{translateText('适应')}</span>
            </button>
          </div>

          <div className="flex h-7 shrink-0 items-center gap-0.5 rounded border border-white/10 bg-[#10151f] p-0.5">
            <button
              type="button"
              onClick={onOpenHandoff}
              title="交付标注 / 查看图层尺寸与样式"
              aria-label="交付标注"
              className={`flex h-6 items-center gap-1 rounded px-1.5 text-[10px] transition-colors ${handoffMode ? 'bg-pink-400/20 text-pink-200' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'}`}
            >
              <Ruler size={11} />
              <span className="hidden sm:inline">标注</span>
            </button>
            <button
              type="button"
              onClick={onOpenTheme}
              title="设计主题 / 全局颜色字体"
              aria-label="设计主题"
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              <Palette size={11} />
              <span className="hidden sm:inline">主题</span>
            </button>
            <button
              type="button"
              onClick={onToggleCommentMode}
              title={commentMode ? '退出评论模式' : '评论模式：在画布上点一下钉评论'}
              aria-label={commentMode ? '退出评论模式' : '进入评论模式'}
              className={`flex h-6 items-center gap-1 rounded px-1.5 text-[10px] transition-colors ${commentMode ? 'bg-cyan-400/25 text-cyan-100' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'}`}
            >
              <MessageSquarePlus size={11} />
              <span className="hidden sm:inline">评论</span>
              {commentCount > 0 && <span className="rounded-full bg-cyan-400/20 px-1 font-mono text-[9px] text-cyan-200">{commentCount}</span>}
            </button>
            <button
              type="button"
              onClick={onOpenComments}
              title="打开评论与评审面板"
              aria-label="打开评论与评审面板"
              className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              <MessageSquarePlus size={11} />
            </button>
            <button
              type="button"
              onClick={onOpenVersions}
              title="版本存档 / 恢复"
              aria-label="版本存档"
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
            >
              <History size={11} />
              <span className="hidden sm:inline">版本</span>
              {versionCount > 0 && <span className="rounded-full bg-white/10 px-1 font-mono text-[9px] text-slate-300">{versionCount}</span>}
            </button>
            <button
              type="button"
              onClick={onOpenShare}
              title="分享到局域网 / 生成二维码"
              aria-label="分享交付"
              className="ml-0.5 flex h-6 items-center gap-1 rounded bg-sky-400/15 px-1.5 text-[10px] font-semibold text-sky-200 hover:bg-sky-400/25"
            >
              <Share2 size={11} />
              <span className="hidden sm:inline">分享</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface ViewportToolButtonsProps {
  viewport?: ViewportState;
  onUpdateViewport?: (updater: (prev: ViewportState) => ViewportState) => void;
}

export const ViewportToolButtons: React.FC<ViewportToolButtonsProps> = ({
  viewport,
  onUpdateViewport,
}) => {
  if (!viewport || !onUpdateViewport) return null;
  return (
    <div className="flex shrink-0 items-center bg-[#10151f] border border-white/10 rounded-lg p-0.5 gap-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'select' }))}
        title="选择工具 (V)"
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
          viewport.activeTool === 'select'
            ? 'bg-sky-500 text-white font-semibold'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <MousePointer size={12} />
        <span>选择</span>
      </button>

      <button
        type="button"
        onClick={() => onUpdateViewport((v) => ({ ...v, activeTool: 'pan' }))}
        title="抓手工具 (H)"
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
          viewport.activeTool === 'pan'
            ? 'bg-sky-500 text-white font-semibold'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Hand size={12} />
        <span>抓手</span>
      </button>
    </div>
  );
};
