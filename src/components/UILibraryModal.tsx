import React, { useEffect } from 'react';
import { UILibraryPanel } from './ui/UILibraryPanel';
import { Icon } from './ui/Icon';
import { GalaxyComponentType } from './ui/GalaxyComponents';
import type { CustomCodePlugin } from '../types';

interface UILibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (type: string, data: any) => void;
  title?: string;
  description?: string;
  includedCategories?: string[];
  includedTypes?: GalaxyComponentType[];
  includedTypesByCategory?: Partial<Record<string, GalaxyComponentType[]>>;
  excludedCategories?: string[];
  excludedTypes?: GalaxyComponentType[];
  categoryOverrides?: Partial<Record<GalaxyComponentType, string>>;
  customPlugins?: CustomCodePlugin[];
  customPluginSectionTitle?: string;
  onInsertCustomPlugin?: (plugin: CustomCodePlugin) => void;
  onOpenCustomCodePlugin?: () => void;
}

export const UILibraryModal: React.FC<UILibraryModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  title = 'Galaxy UI 组件库',
  description = '从 Galaxy 精选组件中选择，在预览区编辑后插入场景',
  includedCategories,
  includedTypes,
  includedTypesByCategory,
  excludedCategories,
  excludedTypes,
  categoryOverrides,
  customPlugins,
  customPluginSectionTitle,
  onInsertCustomPlugin,
  onOpenCustomCodePlugin,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" role="presentation">
      <div className="w-[1040px] max-w-full h-[78vh] max-h-[860px] min-h-[560px] bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="ui-library-title">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <Icon name="grid" size={20} color="white" />
            </div>
            <div>
              <h2 id="ui-library-title" className="text-lg font-bold text-white">{title}</h2>
              <p className="text-xs text-slate-400">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            aria-label="关闭 UI 组件库"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden">
          <UILibraryPanel
            title={title}
            description={description}
            includedCategories={includedCategories}
            includedTypes={includedTypes}
            includedTypesByCategory={includedTypesByCategory}
            excludedCategories={excludedCategories}
            excludedTypes={excludedTypes}
            categoryOverrides={categoryOverrides}
            customPlugins={customPlugins}
            customPluginSectionTitle={customPluginSectionTitle}
            onOpenCustomCodePlugin={onOpenCustomCodePlugin}
            onInsertCustomPlugin={(plugin) => {
              onInsertCustomPlugin?.(plugin);
              onClose();
            }}
            showHeader={false}
            onInsert={(type, data) => {
              onInsert(type, data);
              onClose();
            }}
          />
        </div>

        {/* 底部提示 */}
        <div className="px-5 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between">
          <p className="text-xs text-slate-500">💡 先选择组件并编辑预览，再点击“插入当前组件”写入场景</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">来源：AETHER 内置组件</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UILibraryModal;
