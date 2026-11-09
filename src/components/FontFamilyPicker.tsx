import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Database, RefreshCw, Search, X } from 'lucide-react';
import {
  CATEGORY_NAMES,
  COMMON_CHINESE_FONTS,
  COMMON_ENGLISH_FONTS,
  DESIGN_FONTS,
  isLocalFontsAPISupported,
  queryLocalFonts,
  searchFonts,
  type FontItem,
} from '../utils/fontManager';

interface FontFamilyPickerProps {
  value?: string;
  onChange: (fontFamily: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

type PopupRect = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

const uniqueFonts = (fonts: FontItem[]) =>
  fonts.filter((font, index, list) => list.findIndex((item) => item.family === font.family) === index);

const getPopupRect = (anchor: HTMLElement): PopupRect => {
  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 12;
  const minWidth = 260;
  const width = Math.max(rect.width, minWidth);
  const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
  const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
  const availableAbove = rect.top - viewportPadding;
  const openAbove = availableBelow < 260 && availableAbove > availableBelow;
  const maxHeight = Math.max(220, Math.min(420, openAbove ? availableAbove - 4 : availableBelow - 4));
  const top = openAbove ? Math.max(viewportPadding, rect.top - maxHeight - 6) : rect.bottom + 6;
  return { left, top, width, maxHeight };
};

export const FontFamilyPicker: React.FC<FontFamilyPickerProps> = ({
  value,
  onChange,
  placeholder = '默认字体',
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [systemFonts, setSystemFonts] = useState<FontItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popupRect, setPopupRect] = useState<PopupRect | null>(null);

  const fonts = useMemo(
    () => uniqueFonts([...COMMON_CHINESE_FONTS, ...COMMON_ENGLISH_FONTS, ...DESIGN_FONTS, ...systemFonts]),
    [systemFonts],
  );
  const filteredFonts = useMemo(() => searchFonts(fonts, keyword), [fonts, keyword]);
  const groupedFonts = useMemo(
    () =>
      filteredFonts.reduce((acc, font) => {
        const category = font.category || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(font);
        return acc;
      }, {} as Record<string, FontItem[]>),
    [filteredFonts],
  );

  const updatePopupRect = () => {
    if (!rootRef.current) return;
    setPopupRect(getPopupRect(rootRef.current));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePopupRect();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleLayoutChange = () => updatePopupRect();
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [open]);

  const loadFonts = async () => {
    setLoading(true);
    setError(null);
    try {
      setSystemFonts(await queryLocalFonts());
      setOpen(true);
    } catch (loadError: any) {
      setError(loadError.message || '读取系统字体失败');
    } finally {
      setLoading(false);
    }
  };

  const applyFont = (fontFamily: string | undefined) => {
    onChange(fontFamily);
    setOpen(false);
    setKeyword('');
  };

  const popup = open && popupRect ? (
    <div
      ref={popupRef}
      className="fixed z-[10080] overflow-hidden rounded-lg border border-white/15 bg-[#151827] shadow-2xl shadow-black/50"
      style={{ left: popupRect.left, top: popupRect.top, width: popupRect.width }}
    >
      <div className="space-y-2 border-b border-white/10 p-2">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && keyword.trim()) applyFont(keyword.trim());
            if (event.key === 'Escape') setOpen(false);
          }}
          placeholder="搜索或输入字体名称..."
          className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60"
          autoFocus
        />
        <button
          type="button"
          disabled={loading || !isLocalFontsAPISupported()}
          onClick={loadFonts}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-sky-400/30 bg-sky-500/15 px-2 py-1.5 text-[10px] text-sky-200 transition-colors hover:bg-sky-500/25 disabled:opacity-45"
          title={isLocalFontsAPISupported() ? '读取系统所有字体' : '当前浏览器不支持读取系统字体'}
        >
          {loading ? <RefreshCw size={11} className="animate-spin" /> : <Database size={11} />}
          {loading ? '读取中' : isLocalFontsAPISupported() ? '读取系统所有字体' : '浏览器不支持读取系统字体'}
        </button>
        {error && <p className="text-[9px] text-rose-300">{error}</p>}
      </div>

      <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: Math.max(160, popupRect.maxHeight - 96) }}>
        {Object.keys(groupedFonts).length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">未找到匹配字体</div>
        ) : (
          Object.entries(groupedFonts).map(([category, items]) => (
            <div key={category}>
              <div className="sticky top-0 bg-white/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {CATEGORY_NAMES[category] || category}
              </div>
              {items.map((font) => (
                <button
                  key={font.family}
                  type="button"
                  onClick={() => applyFont(font.family)}
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-sky-500/20 ${
                    value === font.family ? 'bg-sky-500/15 text-white' : 'text-slate-200'
                  }`}
                >
                  <span className="min-w-0 truncate" style={{ fontFamily: `"${font.family}", sans-serif` }}>
                    {font.family}
                  </span>
                  {value === font.family && <Check size={12} className="shrink-0 text-sky-300" />}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => applyFont(keyword.trim() || undefined)}
          className="rounded bg-sky-500/15 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-500/25"
        >
          应用输入
        </button>
        <button
          type="button"
          onClick={() => applyFont(undefined)}
          className="flex items-center justify-center gap-1 rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X size={10} />
          默认字体
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          window.setTimeout(updatePopupRect, 0);
        }}
        className="flex w-full items-center justify-between gap-2 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-left text-xs text-white transition-colors hover:border-sky-400/50 focus:outline-none focus:ring-1 focus:ring-sky-400/60"
        style={{ fontFamily: value || 'sans-serif' }}
      >
        <span className="min-w-0 truncate">{value || placeholder}</span>
        <Search size={12} className="shrink-0 text-slate-400" />
      </button>
      {typeof document !== 'undefined' && popup ? createPortal(popup, document.body) : popup}
    </div>
  );
};
