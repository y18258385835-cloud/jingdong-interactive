import React, { useRef } from 'react';
import {
  Type, Image, Video, Music, Layers, Box, Compass, Sparkles, Upload,
  Eraser, Shapes, PenTool, LayoutGrid, MousePointer2, MousePointer,
  Code2, Blocks,
} from 'lucide-react';
import { ViewportState } from '../types';

export type WorkspaceToolCategory = 'asset-tools' | 'interaction' | 'design' | 'components';

const ToolOption: React.FC<{
  icon: React.ReactNode;
  label: string;
  color?: string;
  badge?: string;
  onClick: () => void;
}> = ({ icon, label, color = 'text-slate-200', badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-[#141a23] px-3 text-[11px] text-slate-200 transition-colors hover:border-cyan-400/45 hover:bg-cyan-400/10 hover:text-white"
  >
    <span className={color}>{icon}</span>
    <span>{label}</span>
    {badge && <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-300">{badge}</span>}
  </button>
);

interface WorkspaceToolsPanelProps {
  category: WorkspaceToolCategory;
  viewport: ViewportState;
  onUpdateViewport: (updater: (prev: ViewportState) => ViewportState) => void;
  onAddElement: (type: 'txt' | 'img' | 'vid' | 'shape' | 'saber' | 'chart' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat') => void;
  onAddAudio: (file: File) => void;
  onImportMedia: (files: File[]) => void | Promise<unknown>;
  onOpen3DModal: () => void;
  onOpenShapePresetModal: () => void;
  onOpenSaberPresetModal: () => void;
  onOpenVfxModal: () => void;
  onOpenCardLayoutModal: () => void;
  onOpenUILibraryModal: () => void;
  onOpenOfficialComponents: () => void;
  onOpenPluginCenter: () => void;
  onOpenInteractionControlsModal: () => void;
  onOpenBackgroundRemoval: () => void;
  onOpenAiSceneBuilder: () => void;
  onOpenCustomCodePlugin: () => void;
}

export const WorkspaceToolsPanel: React.FC<WorkspaceToolsPanelProps> = ({
  category,
  viewport,
  onUpdateViewport,
  onAddElement,
  onAddAudio,
  onImportMedia,
  onOpen3DModal,
  onOpenShapePresetModal,
  onOpenSaberPresetModal,
  onOpenVfxModal,
  onOpenCardLayoutModal,
  onOpenUILibraryModal,
  onOpenOfficialComponents,
  onOpenPluginCenter,
  onOpenInteractionControlsModal,
  onOpenBackgroundRemoval,
  onOpenAiSceneBuilder,
  onOpenCustomCodePlugin,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const options = category === 'asset-tools' ? (
    <>
      <ToolOption icon={<Type size={14} />} label="文字" color="text-sky-300" onClick={() => onAddElement('txt')} />
      <ToolOption icon={<Image size={14} />} label="图片" color="text-blue-300" onClick={() => onAddElement('img')} />
      <ToolOption icon={<Video size={14} />} label="视频" color="text-amber-300" onClick={() => onAddElement('vid')} />
      <ToolOption icon={<Music size={14} />} label="音频" color="text-pink-300" onClick={() => audioInputRef.current?.click()} />
      <ToolOption icon={<Box size={14} />} label="3D 模型" color="text-violet-300" onClick={() => onAddElement('model-3d')} />
      <ToolOption icon={<Layers size={14} />} label="AI 生成 3D" badge="AI" color="text-violet-300" onClick={onOpen3DModal} />
      <ToolOption icon={<Compass size={14} />} label="全景图片" color="text-teal-300" onClick={() => onAddElement('panorama-img')} />
      <ToolOption icon={<Compass size={14} />} label="全景视频" color="text-orange-300" onClick={() => onAddElement('panorama-vid')} />
      <ToolOption icon={<Sparkles size={14} />} label="高斯泼溅" color="text-pink-300" onClick={() => onAddElement('gaussian-splat')} />
      <ToolOption icon={<Upload size={14} />} label="导入素材" color="text-cyan-300" onClick={() => mediaInputRef.current?.click()} />
      <ToolOption icon={<Eraser size={14} />} label="AI 抠图" badge="AI" color="text-cyan-300" onClick={onOpenBackgroundRemoval} />
    </>
  ) : category === 'design' ? (
    <>
      <ToolOption icon={<Shapes size={14} />} label="基础图形" color="text-emerald-300" onClick={onOpenShapePresetModal} />
      <ToolOption icon={<Sparkles size={14} />} label="VFX 动效" badge="NEW" color="text-fuchsia-300" onClick={onOpenVfxModal} />
      <ToolOption icon={<PenTool size={14} />} label="Saber 光线" badge="NEW" color="text-cyan-300" onClick={onOpenSaberPresetModal} />
      <ToolOption icon={<LayoutGrid size={14} />} label="卡片布局" color="text-amber-300" onClick={onOpenCardLayoutModal} />
  </>
  ) : category === 'interaction' ? (
    <>
      <ToolOption icon={<Sparkles size={14} />} label="Work 工作助手" badge="AI" color="text-violet-300" onClick={onOpenAiSceneBuilder} />
    </>
  ) : (
    <>
      <ToolOption icon={<LayoutGrid size={14} />} label="Galaxy UI" color="text-fuchsia-300" onClick={onOpenUILibraryModal} />
      <ToolOption icon={<Blocks size={14} />} label="官方组件" color="text-violet-300" onClick={onOpenOfficialComponents} />
      <ToolOption icon={<MousePointer size={14} />} label="交互组件" badge="NEW" color="text-cyan-300" onClick={onOpenInteractionControlsModal} />
      <ToolOption icon={<Code2 size={14} />} label="自定义代码" badge="NEW" color="text-cyan-300" onClick={onOpenCustomCodePlugin} />
    </>
  );

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-white/10 bg-[#12141c] text-slate-300">
      <div className="border-b border-white/10 px-3 py-2">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          {category === 'asset-tools' ? '素材工具' : category === 'interaction' ? '交互工具' : category === 'design' ? '设计工具' : '组件工具'}
        </div>
        <div className="flex flex-wrap gap-1.5">{options}</div>
      </div>
      <div className="flex-1 bg-[#0f131b]" />
      <input ref={audioInputRef} type="file" className="hidden" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAddAudio(file); event.target.value = ''; }} />
      <input ref={mediaInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,.glb,.gltf,.ply,.splat,.aether-3d.json" multiple onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) void onImportMedia(files); event.target.value = ''; }} />
    </aside>
  );
};
