import React, { useEffect } from 'react';
import { Check, ChevronRight, LayoutTemplate, Sparkles, X } from 'lucide-react';
import type { ProjectData } from '../types';

interface TemplateCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  onLoadTemplate: (templateKey: string) => void;
}

export const TemplateCenterModal: React.FC<TemplateCenterModalProps> = ({ isOpen, onClose, projectData, onLoadTemplate }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const templates = [
    { id: 'factory-ops', name: '智能工厂监控中枢', description: '参考墨刀工厂监控页面：浅色运营工作台、产线指标、状态与趋势、可点选的透视设备布局。图表、指标卡和设备图均为独立可编辑图层。', color: 'emerald', meta: '1 个场景 · 5 台示例设备 · 设备可增删改' },
    { id: 'dashboard-pack', name: '通用数据大屏 · 12页行业模板', description: '覆盖充电、电力、医院、储能、楼宇、城市、能耗与电商的深色科技大屏骨架。', color: 'cyan', meta: '12 个页面 · 10 类数据组件 · 模拟实时数据' },
    { id: 'default', name: '鲸动交互 · Living Canvas', description: '一件从空白、素材、时间、空间到发布的完整交互作品。第三方内容与鲸动交互能力在同一条体验里自然发生。', color: 'sky', meta: '6 个场景 · Apple 式极简 · 3D / 数据 / 多格式发布' },
    { id: 'minimal', name: '极简发布 · Minimal Product Keynote', description: '清爽大字排版、高对比节奏和克制的入场/出场动效。', color: 'indigo', meta: '3 个场景 · 极简指标 · 发布页' },
    { id: 'workshop', name: '多媒体工作坊 · Immersive Showcase', description: '适合沉浸式展陈的多媒体工作区与动效组合。', color: 'amber', meta: '工作坊 · 多媒体 · 动效' },
  ];
  const tone: Record<string, { card: string; title: string; button: string; icon: string }> = {
    cyan: { card: 'from-cyan-950/50 border-cyan-500/30', title: 'text-cyan-300', button: 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30', icon: 'text-cyan-300' },
    emerald: { card: 'from-emerald-950/50 border-emerald-500/30', title: 'text-emerald-300', button: 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30', icon: 'text-emerald-300' },
    sky: { card: 'from-sky-950/50 border-sky-500/30', title: 'text-sky-300', button: 'bg-sky-500/20 text-sky-200 hover:bg-sky-500/30', icon: 'text-sky-300' },
    indigo: { card: 'from-indigo-950/50 border-indigo-500/30', title: 'text-indigo-300', button: 'bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30', icon: 'text-indigo-300' },
    amber: { card: 'from-amber-950/50 border-amber-500/30', title: 'text-amber-300', button: 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30', icon: 'text-amber-300' },
  };
  return (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-[min(920px,calc(100vw-32px))] overflow-hidden rounded-xl border border-white/15 bg-[#11151d] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="template-center-title">
        <div className="flex h-12 items-center justify-between border-b border-white/10 bg-[#0d1118] px-4"><div className="flex items-center gap-2"><LayoutTemplate size={16} className="text-amber-300" /><h2 id="template-center-title" className="text-sm font-semibold text-white">预设库</h2><span className="text-[10px] text-slate-500">选择一个起点加载到当前工程</span></div><button type="button" onClick={onClose} aria-label="关闭预设库" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={16} /></button></div>
        <div className="grid max-h-[min(72vh,620px)] gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">{templates.map((template) => { const active = template.id === 'default' ? !!projectData.scenes.blank : template.id === 'minimal' ? !!projectData.scenes.min_hero : template.id === 'factory-ops' ? !!projectData.scenes.factory_ops : false; const colors = tone[template.color]; return <div key={template.id} className={`relative flex min-h-[190px] flex-col rounded-lg border bg-gradient-to-br ${colors.card} via-slate-900 to-slate-900 p-3 ${active ? 'ring-1 ring-white/30' : ''}`}><div className="flex items-start justify-between gap-2"><span className={`text-xs font-semibold ${colors.title}`}>{template.name}</span><Sparkles size={13} className={`shrink-0 ${colors.icon}`} /></div><p className="mt-3 flex-1 text-[11px] leading-relaxed text-slate-400">{template.description}</p><div className="border-t border-white/10 pt-2 text-[10px] text-slate-500">{template.meta}</div><button type="button" onClick={() => { onLoadTemplate(template.id); onClose(); }} className={`mt-3 flex h-8 items-center justify-center gap-1 rounded-md text-[10px] font-semibold transition ${colors.button}`}>{active && <Check size={11} />}加载预设<ChevronRight size={12} /></button></div>; })}</div>
      </div>
    </div>
  );
};

export default TemplateCenterModal;
