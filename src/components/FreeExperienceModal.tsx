import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Sparkles, X } from 'lucide-react';
import { API_BASE_URL } from '../core/auth/types';
import { useLanguage } from '../i18n/LanguageContext';

interface FreeExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_URL = 'https://www.capcut.cn/';
const DEFAULT_CONTENT = {
  titleZh: '免费体验',
  descriptionZh: '本软件提供免费体验功能，具体使用说明与体验入口请点击下方按钮。',
  buttonZh: '查看免费体验',
  titleEn: 'Free Trial',
  descriptionEn: 'This software provides a free trial. Click the button below for instructions and access.',
  buttonEn: 'View Free Trial',
};

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

export const FreeExperienceModal: React.FC<FreeExperienceModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const [url, setUrl] = useState(FALLBACK_URL);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/public/free-experience-link`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled) {
          if (isHttpUrl(data?.url)) setUrl(data.url);
          setContent((current) => ({ ...current, ...Object.fromEntries(Object.keys(DEFAULT_CONTENT).map((key) => [key, typeof data?.[key] === 'string' && data[key].trim() ? data[key] : current[key]])) }));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;
  const title = language === 'en-US' ? content.titleEn : content.titleZh;
  const description = language === 'en-US' ? content.descriptionEn : content.descriptionZh;
  const button = language === 'en-US' ? content.buttonEn : content.buttonZh;

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/15 bg-[#141622] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="free-experience-title">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2"><Sparkles size={17} className="text-cyan-300" /><h2 id="free-experience-title" className="text-sm font-semibold text-white">{title}</h2></div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white" aria-label="关闭"><X size={17} /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-300">{description}</p>
          <a href={url} target="_blank" rel="noreferrer" onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
            {button}
          </a>
        </div>
      </div>
    </div>
  );
};
