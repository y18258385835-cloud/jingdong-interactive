import React, { useEffect } from 'react';
import { X, Plug } from 'lucide-react';
import { PluginCenterPanel } from './PluginCenterPanel';
import type { OfficialPluginDefinition } from '../plugins/registry';

interface PluginCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (plugin: OfficialPluginDefinition) => void;
}

export const PluginCenterModal: React.FC<PluginCenterModalProps> = ({ isOpen, onClose, onInsert }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex h-[min(680px,calc(100vh-32px))] w-[min(860px,calc(100vw-32px))] min-w-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-[#11151d] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="plugin-center-title">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1118] px-4">
          <div className="flex items-center gap-2"><Plug size={16} className="text-cyan-300" /><h2 id="plugin-center-title" className="text-sm font-semibold text-white">物联网组件</h2><span className="text-[10px] text-slate-500">组件市场 · MQTT 数据绑定</span></div>
          <button type="button" onClick={onClose} aria-label="关闭物联网组件" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1"><PluginCenterPanel onInsert={(plugin) => { onInsert(plugin); onClose(); }} /></div>
      </div>
    </div>
  );
};

export default PluginCenterModal;
