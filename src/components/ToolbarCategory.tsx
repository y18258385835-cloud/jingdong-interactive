import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface ToolbarCategoryProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
}

/**
 * 工具栏分类下拉菜单
 * 点击展开，显示该分类下的所有工具按钮
 */
export const ToolbarCategory: React.FC<ToolbarCategoryProps> = ({
  label,
  icon,
  active = false,
  color = 'slate',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render the menu outside scroll containers so the toolbar's horizontal
  // scrolling cannot clip a panel that opens below it.
  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = containerRef.current?.querySelector('button');
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.min(rect.left, Math.max(8, window.innerWidth - 228)),
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    document.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  const colorClasses: Record<string, string> = {
    slate: 'text-slate-300 hover:text-white hover:bg-white/10',
    cyan: 'text-cyan-300 hover:bg-cyan-500/15 border-cyan-500/30',
    emerald: 'text-emerald-300 hover:bg-emerald-500/15 border-emerald-500/30',
    purple: 'text-purple-300 hover:bg-purple-500/15 border-purple-500/30',
    amber: 'text-amber-300 hover:bg-amber-500/15 border-amber-500/30',
    blue: 'text-blue-300 hover:bg-blue-500/15 border-blue-500/30',
  };

  const activeColorClasses: Record<string, string> = {
    slate: 'bg-white/10 text-white',
    cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50',
    emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50',
    purple: 'bg-purple-500/20 text-purple-200 border-purple-500/50',
    amber: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
    blue: 'bg-blue-500/20 text-blue-200 border-blue-500/50',
  };

  return (
    <div ref={containerRef} className="aether-toolbar-category relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`aether-toolbar-category__trigger flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all ${
          active
            ? activeColorClasses[color] || activeColorClasses.slate
            : colorClasses[color] || colorClasses.slate
        } ${isOpen ? 'bg-white/10' : ''}`}
      >
        {icon}
        <span className="font-medium text-xs">{label}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="aether-menu-surface fixed z-[1100] min-w-[180px] max-w-[calc(100vw-16px)] bg-[#1a1d28] border border-white/15 rounded-xl shadow-2xl shadow-black/50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
          style={menuPosition}
          role="menu"
        >
          <div className="flex flex-col gap-0.5">{children}</div>
        </div>,
        document.body,
      )}
    </div>
  );
};

interface ToolbarItemProps {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  color?: string;
}

/**
 * 下拉菜单项
 */
export const ToolbarItem: React.FC<ToolbarItemProps> = ({
  icon,
  label,
  shortcut,
  onClick,
  active = false,
  disabled = false,
  badge,
  color = 'slate',
}) => {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-300',
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    pink: 'text-pink-400',
    teal: 'text-teal-400',
    orange: 'text-orange-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`aether-menu-item flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : active
          ? 'bg-sky-500/20 text-white'
          : 'hover:bg-white/10 text-slate-200'
      }`}
    >
      {icon && <span className={colorMap[color] || colorMap.slate}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 font-medium">
          {badge}
        </span>
      )}
      {shortcut && (
        <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">
          {shortcut}
        </span>
      )}
    </button>
  );
};

interface ToolbarDividerProps {
  label?: string;
}

/**
 * 下拉菜单分隔线（可选标签）
 */
export const ToolbarDivider: React.FC<ToolbarDividerProps> = ({ label }) => {
  if (label) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
          {label}
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
    );
  }
  return <div className="h-px bg-white/10 my-1 mx-1" />;
};
