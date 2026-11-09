import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Command,
  CornerDownLeft,
  History,
  Search,
  X,
} from 'lucide-react';

export type GlobalSearchCategory = '素材' | '设计' | '动效' | '交互' | '组件' | '空间' | '发布';

export interface GlobalSearchItem {
  id: string;
  title: string;
  description: string;
  category: GlobalSearchCategory;
  keywords: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: string;
  action: () => void;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  items: GlobalSearchItem[];
  onClose: () => void;
}

const RECENT_STORAGE_KEY = 'aether-global-search-recent-v1';
const CATEGORY_ORDER: GlobalSearchCategory[] = ['素材', '设计', '动效', '交互', '组件', '空间', '发布'];

function readRecentIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, items, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>(readRecentIds);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    setRecentIds(readRecentIds());
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const recentItems = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return recentIds.map((id) => byId.get(id)).filter((item): item is GlobalSearchItem => Boolean(item));
  }, [items, recentIds]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items
      .map((item) => {
        const title = item.title.toLocaleLowerCase();
        const haystack = [item.title, item.description, item.category, ...item.keywords].join(' ').toLocaleLowerCase();
        const score = title === normalized ? 100 : title.startsWith(normalized) ? 70 : title.includes(normalized) ? 50 : haystack.includes(normalized) ? 20 : 0;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'zh-CN'))
      .map(({ item }) => item);
  }, [items, query]);

  const groupedItems = useMemo(() => CATEGORY_ORDER
    .map((category) => ({ category, items: filteredItems.filter((item) => item.category === category) }))
    .filter((group) => group.items.length > 0), [filteredItems]);

  const keyboardItems = useMemo(() => groupedItems.flatMap((group) => group.items), [groupedItems]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, keyboardItems.length - 1)));
  }, [keyboardItems.length]);

  if (!isOpen) return null;

  const runItem = (item: GlobalSearchItem) => {
    const nextRecent = [item.id, ...recentIds.filter((id) => id !== item.id)].slice(0, 8);
    setRecentIds(nextRecent);
    try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(nextRecent)); } catch { /* storage is optional */ }
    item.action();
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, keyboardItems.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && keyboardItems[activeIndex]) {
      event.preventDefault();
      runItem(keyboardItems[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let resultIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#11151d]/[.98] shadow-[0_28px_90px_rgba(0,0,0,.6)]" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search size={18} className="shrink-0 text-sky-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="搜索素材、组件、动效和交互能力"
            aria-label="全局搜索"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/[.06] px-2 py-1 text-[10px] text-slate-400 sm:flex"><Command size={11} /> K</kbd>
          <button type="button" onClick={onClose} aria-label="关闭搜索" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>

        <div className="max-h-[min(66vh,560px)] overflow-y-auto px-2 py-3">
          {!query.trim() && recentItems.length > 0 && (
            <section className="mb-3">
              <div className="flex items-center gap-2 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500"><History size={12} /> 最近使用</div>
              <div className="grid gap-0.5">
                {recentItems.slice(0, 4).map((item) => {
                  const Icon = item.icon;
                  return <button key={`recent-${item.id}`} type="button" onClick={() => runItem(item)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[.07]"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[.06]" style={{ color: item.accent || '#7dd3fc' }}><Icon size={14} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-200">{item.title}</span><span className="block truncate text-[10px] text-slate-500">{item.category} · {item.description}</span></span></button>;
                })}
              </div>
            </section>
          )}

          {groupedItems.length === 0 ? (
            <div className="px-4 py-14 text-center"><Search size={22} className="mx-auto mb-3 text-slate-600" /><p className="text-sm text-slate-300">没有找到匹配的能力</p><p className="mt-1 text-xs text-slate-500">试试“光效”“图表”“3D”或“交互”</p></div>
          ) : groupedItems.map((group) => (
            <section key={group.category} className="mb-3 last:mb-0">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{group.category}</div>
              <div className="grid gap-0.5">
                {group.items.map((item) => {
                  resultIndex += 1;
                  const index = resultIndex;
                  const Icon = item.icon;
                  return <button key={item.id} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => runItem(item)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${activeIndex === index ? 'bg-sky-400/10 ring-1 ring-inset ring-sky-300/20' : 'hover:bg-white/[.06]'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[.04]" style={{ color: item.accent || '#7dd3fc' }}><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-slate-100">{item.title}</span><span className="block truncate text-[11px] text-slate-500">{item.description}</span></span>{activeIndex === index && <CornerDownLeft size={14} className="shrink-0 text-sky-300" />}</button>;
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-slate-500"><span>搜索结果会沿用现有工作流执行</span><span className="hidden items-center gap-2 sm:flex"><span className="inline-flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> 选择</span><span className="inline-flex items-center gap-1"><CornerDownLeft size={11} /> 打开</span><span>Esc 关闭</span></span></div>
      </div>
      <h2 id="global-search-title" className="sr-only">全局搜索</h2>
    </div>
  );
};

export default GlobalSearchModal;
