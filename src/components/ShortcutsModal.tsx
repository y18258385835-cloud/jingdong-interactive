import React, { useEffect } from 'react';
import { HelpCircle, X, Keyboard } from 'lucide-react';
import { loadCustomShortcuts, type ShortcutDefinition } from './ShortcutsManager';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [liveShortcuts, setLiveShortcuts] = React.useState<ShortcutDefinition[]>(() => loadCustomShortcuts());

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

  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => setLiveShortcuts(loadCustomShortcuts());
    refresh();
    window.addEventListener('aether-shortcuts-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('aether-shortcuts-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizeKey = (value: string) => value.toLowerCase().replace(/\s+/g, '').replace(/＋/g, '+');
  const findLiveShortcut = (displayKey: string) => {
    const candidates = displayKey.split('/').map((candidate) => normalizeKey(candidate));
    return liveShortcuts.find((shortcut) => candidates.includes(normalizeKey(shortcut.defaultKey)))
      || liveShortcuts.find((shortcut) => candidates.includes(normalizeKey(shortcut.customKey || '')));
  };

  const shortcuts = [
    { category: '播放与时间轴', items: [
      { key: 'Space', desc: '短按播放 / 暂停；按住并拖动画布时临时启用抓手' },
      { key: 'Left / Right', desc: '向前 / 向后微调 1 帧' },
      { key: '[ 或 I', desc: '设置入点 (In-Point)' },
      { key: '] 或 O', desc: '设置出点 (Out-Point)' },
      { key: 'Tab', desc: '展开 / 折叠底部时间轴' },
    ]},
    { category: '视图与编辑', items: [
      { key: 'ESC', desc: '退出全屏预览模式 / 退出预览' },
      { key: 'E', desc: '创作工作台 / 交互演示模式切换' },
      { key: 'Ctrl + H', desc: '打开操作历史记录时间轴面板' },
      { key: 'Ctrl + Z', desc: '撤销上一步操作' },
      { key: 'Ctrl + Y', desc: '重做下一步操作' },
      { key: 'Ctrl + S', desc: '保存工程' },
      { key: 'Ctrl + C', desc: '复制选中图层' },
      { key: 'Ctrl + X', desc: '剪切选中图层' },
      { key: 'Ctrl + V', desc: '粘贴图层（偏移 4% 防止重叠）' },
      { key: 'Ctrl + D', desc: '复制选中图层到新位置' },
      { key: 'Ctrl + A', desc: '全选当前场景全部图层' },
      { key: 'Delete / Backspace', desc: '删除当前选中的图层' },
      { key: 'S', desc: '开启 / 关闭磁性智能吸附' },
      { key: 'F', desc: '进入 / 退出全屏纯净预览' },
      { key: 'F11', desc: '浏览器原生全屏切换' },
    ]},
    { category: '对齐与分布', items: [
      { key: 'Ctrl+Alt+L', desc: '左对齐（单选时对齐画布）' },
      { key: 'Ctrl+Alt+C', desc: '水平居中' },
      { key: 'Ctrl+Alt+R', desc: '右对齐' },
      { key: 'Ctrl+Alt+T', desc: '顶对齐' },
      { key: 'Ctrl+Alt+M', desc: '垂直居中' },
      { key: 'Ctrl+Alt+B', desc: '底对齐' },
      { key: 'Ctrl+Alt+H', desc: '水平等距分布（至少 3 个图层）' },
      { key: 'Ctrl+Alt+V', desc: '垂直等距分布（至少 3 个图层）' },
    ]},
    { category: '工具与快捷插入', items: [
      { key: 'V', desc: '选择指针工具' },
      { key: 'H 或 Space+拖动', desc: '抓手平移画布工具' },
      { key: 'P', desc: 'Saber 钢笔矢量光线工具' },
      { key: 'T', desc: '快速添加文字图层' },
      { key: 'R', desc: '快速添加矩形交互卡片' },
      { key: '3', desc: '打开 AI 3D 景深分层生成器' },
      { key: '双击文字', desc: '在画布上直接编辑文字内容' },
    ]}
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4" role="presentation">
      <div className="bg-[#141622] border border-white/15 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 text-slate-200" role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-sky-950/20">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/20 rounded-lg text-sky-300">
              <Keyboard size={18} />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-sm font-bold text-white">快捷键指南 (Keyboard Shortcuts)</h2>
              <p className="text-[11px] text-slate-400">熟练使用快捷键让多媒体编排效率提升数倍</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((sec) => (
            <div key={sec.category} className="space-y-2">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">{sec.category}</h3>
              <div className="grid grid-cols-1 gap-1.5">
                {sec.items.map((it) => {
                  const live = findLiveShortcut(it.key);
                  if (live && !live.enabled) return null;
                  return (
                  <div key={it.key} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                    <span className="text-slate-300">{it.desc}</span>
                    <kbd className="px-2 py-0.5 bg-black/50 border border-white/15 rounded text-[11px] font-mono text-sky-300">
                      {live?.customKey || live?.defaultKey || it.key}
                    </kbd>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end bg-[#12141c]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
