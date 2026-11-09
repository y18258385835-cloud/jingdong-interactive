import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../core/api/url';
import {
  Check,
  ChevronDown,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileImage,
  ImagePlus,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Settings,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { ErrorNoticePanel } from './ErrorRecovery';

interface AiBackgroundRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (blob: Blob, fileName: string) => Promise<void> | void;
  onLoadPresetDemo?: () => void;
  embedded?: boolean;
}

type ProviderId = 'remove-bg' | 'clipdrop' | 'custom';
type OutputFormat = 'png';

interface RemovalConfig {
  provider: ProviderId;
  apiKey: string;
  endpoint: string;
  outputFormat: OutputFormat;
}

const STORAGE_KEY = 'aether_background_removal_config_v1';
const DEFAULT_CONFIG: RemovalConfig = {
  provider: 'remove-bg',
  apiKey: '',
  endpoint: '',
  outputFormat: 'png',
};

function loadConfig(): RemovalConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: RemovalConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // The tool remains usable when local storage is unavailable.
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('无法读取图片'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('抠图结果格式无效');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const providerCopy: Record<ProviderId, { name: string; detail: string; placeholder?: string }> = {
  'remove-bg': { name: 'remove.bg', detail: '免费额度 / 需 API Key' },
  clipdrop: { name: 'Clipdrop', detail: '免费额度 / 需 API Key' },
  custom: { name: '自定义兼容端点', detail: 'multipart image_file' , placeholder: 'https://your-endpoint.example/remove' },
};

export const AiBackgroundRemovalModal: React.FC<AiBackgroundRemovalModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  onLoadPresetDemo,
  embedded = false,
}) => {
  const [config, setConfig] = useState<RemovalConfig>(loadConfig);
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [view, setView] = useState<'original' | 'result'>('result');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setConfig(loadConfig());
    setError('');
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  useEffect(() => () => {
    if (originalUrl.startsWith('blob:')) URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  if (!isOpen) return null;

  const updateConfig = (patch: Partial<RemovalConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  const selectFile = async (nextFile: File | undefined) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      setError('请选择 PNG、JPEG 或 WebP 图片');
      return;
    }
    if (nextFile.size > 12 * 1024 * 1024) {
      setError('图片不能超过 12 MB');
      return;
    }
    try {
      setFile(nextFile);
      setOriginalUrl(URL.createObjectURL(nextFile));
      setResultUrl('');
      setView('result');
      setError('');
    } catch {
      setError('图片载入失败，请重试');
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError('请先选择一张图片');
      return;
    }
    if (!config.apiKey.trim()) {
      setError('请填写当前服务商的 API Key');
      return;
    }
    if (config.provider === 'custom' && !config.endpoint.trim()) {
      setError('自定义服务商需要填写兼容端点');
      return;
    }
    setIsProcessing(true);
    setError('');
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const imageDataUrl = await readAsDataUrl(file);
      const response = await fetch(apiUrl('/api/image/remove-background'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
          endpoint: config.endpoint,
          imageDataUrl,
          outputFormat: config.outputFormat,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || typeof data.dataUrl !== 'string') throw new Error(data.error || '抠图服务暂时不可用');
      setResultUrl(data.dataUrl);
      setView('result');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '抠图失败，请检查 Key 和网络');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsProcessing(false);
      }
    }
  };

  const handleDownload = () => {
    if (!resultUrl || !file) return;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `${file.name.replace(/\.[^.]+$/, '')}-cutout.png`;
    link.click();
  };

  const handleInsert = async () => {
    if (!resultUrl || !file) return;
    setIsInserting(true);
    setError('');
    try {
      await onInsert(dataUrlToBlob(resultUrl), `${file.name.replace(/\.[^.]+$/, '')}-cutout.png`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '插入工程失败');
    } finally {
      setIsInserting(false);
    }
  };

  const provider = providerCopy[config.provider];
  return (
    <div className={embedded ? 'flex h-full min-h-0 w-full items-center justify-center' : 'aether-ai-dialog fixed inset-0 z-[2200] flex items-center justify-center bg-[#020509]/85 p-4 backdrop-blur-md'} role="presentation" onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>
      <div className={embedded ? 'aether-ai-dialog__shell flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden text-slate-200' : 'aether-ai-dialog__shell flex max-h-[min(900px,94vh)] w-full max-w-[1180px] flex-col overflow-hidden border border-white/15 bg-[#080d14] text-slate-200 shadow-[0_30px_100px_rgba(0,0,0,.75)]'} role="dialog" aria-modal="true" aria-label={embedded ? 'AI 抠图工作区' : undefined} aria-labelledby={embedded ? undefined : 'ai-cutout-title'}>
        {!embedded && <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0b111a] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-[0_0_26px_rgba(34,211,238,.12)]"><Eraser size={19} /></div>
            <div><div className="font-mono text-[9px] tracking-[.22em] text-cyan-300/70">AETHER IMAGE LAB / 01</div><h2 id="ai-cutout-title" className="mt-1 text-base font-semibold text-white">AI 抠图</h2></div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} title="关闭 AI 抠图" aria-label="关闭 AI 抠图" className="aether-dialog-close flex h-9 w-9 items-center justify-center text-slate-500 transition hover:bg-white/10 hover:text-white"><X size={17} /></button>
        </header>}

        <div className={`grid min-h-0 flex-1 ${embedded ? 'overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]' : 'overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]'}`}>
          <main className={`flex min-h-[320px] min-w-0 flex-col border-b border-white/10 lg:border-b-0 ${embedded ? 'lg:border-r-0' : 'lg:border-r'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-7">
              <div><div className="text-xs font-semibold text-slate-200">预览工作台</div><div className="mt-1 text-[10px] text-slate-500">透明背景结果会保留为可编辑图片图层</div></div>
              <div className="flex border border-white/10 bg-black/20 p-0.5">
                <button type="button" onClick={() => setView('original')} disabled={!originalUrl} className={`min-h-8 px-3 text-[10px] transition ${view === 'original' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200'}`}>原图</button>
                <button type="button" onClick={() => setView('result')} disabled={!resultUrl} className={`min-h-8 px-3 text-[10px] transition ${view === 'result' ? 'bg-cyan-300 text-slate-950' : 'text-slate-500 hover:text-slate-200'}`}>透明结果</button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5 sm:p-8" style={{ backgroundImage: 'linear-gradient(45deg, #101721 25%, transparent 25%), linear-gradient(-45deg, #101721 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #101721 75%), linear-gradient(-45deg, transparent 75%, #101721 75%)', backgroundSize: '28px 28px', backgroundPosition: '0 0, 0 14px, 14px -14px, -14px 0' }}>
              {view === 'original' && originalUrl ? <img src={originalUrl} alt="原始图片" className="max-h-[58vh] max-w-full object-contain shadow-2xl" /> : view === 'result' && resultUrl ? <img src={resultUrl} alt="透明背景抠图结果" className="max-h-[58vh] max-w-full object-contain shadow-2xl" /> : <div className="max-w-sm text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><FileImage size={27} /></div><p className="mt-5 text-sm font-medium text-slate-200">把主体放进画布</p><p className="mt-2 text-[11px] leading-5 text-slate-500">支持 PNG、JPEG、WebP，单张不超过 12 MB</p><button type="button" onClick={() => inputRef.current?.click()} className="mt-5 inline-flex min-h-10 items-center gap-2 bg-cyan-300 px-4 text-[11px] font-semibold text-slate-950 transition hover:bg-cyan-200"><UploadCloud size={14} />选择图片</button></div>}
              {isProcessing && <div className="absolute inset-0 flex items-center justify-center bg-[#05080d]/70 backdrop-blur-sm"><div className="border border-cyan-300/25 bg-[#09131d]/95 px-7 py-6 text-center shadow-2xl"><Loader2 size={24} className="mx-auto animate-spin text-cyan-300" /><p className="mt-3 text-xs text-white">正在移除背景</p><p className="mt-1 text-[10px] text-slate-500">图片只会被转发给你选择的服务商</p></div></div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#070b11]/90 px-5 py-3 text-[10px] sm:px-7">
              <div className="flex min-w-0 items-center gap-2 text-slate-500">{file ? <><ImagePlus size={13} className="shrink-0 text-cyan-300/70" /><span className="max-w-[250px] truncate text-slate-300">{file.name}</span><span>{formatBytes(file.size)}</span></> : <span>尚未选择图片</span>}</div>
              <div className="flex gap-2"><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 border border-white/10 px-3 text-slate-400 transition hover:bg-white/10 hover:text-white"><RefreshCw size={13} />更换图片</button>{resultUrl && <button type="button" onClick={handleDownload} className="inline-flex min-h-9 items-center gap-1.5 border border-white/10 px-3 text-slate-300 transition hover:bg-white/10 hover:text-white"><Download size={13} />下载</button>}</div>
            </div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ''; }} />
          </main>

          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#070b11]/35">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
              <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void selectFile(event.dataTransfer.files?.[0]); }} className={`border border-dashed px-4 py-4 transition ${isDragging ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 bg-white/[.02]'}`}><div className="flex items-center gap-3"><UploadCloud size={17} className="text-cyan-300" /><div className="min-w-0"><div className="text-[11px] font-medium text-slate-200">拖入新图片</div><div className="mt-1 text-[9px] text-slate-500">或点击左侧选择文件</div></div></div></div>
              <details className="group border border-white/10 bg-white/[.02]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-[11px] font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><Settings size={13} className="text-cyan-300" />API 配置<span className="font-normal text-slate-500">{provider.name}{config.apiKey ? ' · 已配置' : ''}</span></span>
                  <ChevronDown size={14} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-white/10 p-3">
              <div><label htmlFor="cutout-provider" className="mb-2 block text-[10px] font-semibold text-slate-400">服务商</label><div className="relative"><select id="cutout-provider" value={config.provider} onChange={(event) => updateConfig({ provider: event.target.value as ProviderId })} className="h-11 w-full appearance-none border border-white/10 bg-[#0b121c] px-3 pr-9 text-[11px] text-white outline-none transition focus:border-cyan-300/60"><option value="remove-bg">remove.bg · {providerCopy['remove-bg'].detail}</option><option value="clipdrop">Clipdrop · {providerCopy.clipdrop.detail}</option><option value="custom">自定义兼容端点</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3.5 text-slate-500" /></div><p className="mt-2 text-[9px] leading-4 text-slate-600">免费额度由第三方服务商提供，不承诺无限量或永久免费。</p></div>
              {config.provider === 'custom' && <div><label htmlFor="cutout-endpoint" className="mb-2 block text-[10px] font-semibold text-slate-400">兼容端点</label><input id="cutout-endpoint" value={config.endpoint} onChange={(event) => updateConfig({ endpoint: event.target.value })} placeholder={provider.placeholder} className="h-11 w-full border border-white/10 bg-[#0b121c] px-3 text-[10px] font-mono text-white outline-none focus:border-cyan-300/60" /></div>}
              <div><label htmlFor="cutout-api-key" className="mb-2 flex items-center justify-between text-[10px] font-semibold text-slate-400"><span className="flex items-center gap-1.5"><KeyRound size={12} />API Key</span><span className="font-mono text-[9px] font-normal text-slate-600">BYOK</span></label><div className="relative"><input id="cutout-api-key" type={showKey ? 'text' : 'password'} autoComplete="off" value={config.apiKey} onChange={(event) => updateConfig({ apiKey: event.target.value })} placeholder="粘贴服务商 API Key" className="h-11 w-full border border-white/10 bg-[#0b121c] px-3 pr-10 text-[11px] font-mono text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60" /><button type="button" onClick={() => setShowKey((value) => !value)} title={showKey ? '隐藏 API Key' : '显示 API Key'} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-slate-500 hover:text-white">{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button></div><p className="mt-2 flex items-start gap-1.5 text-[9px] leading-4 text-slate-600"><LockKeyhole size={11} className="mt-0.5 shrink-0 text-emerald-300/70" />Key 只保存在本机，并通过本地代理按次转发。</p></div>
              <div><label htmlFor="cutout-format" className="mb-2 block text-[10px] font-semibold text-slate-400">输出格式</label><select id="cutout-format" value={config.outputFormat} disabled className="h-11 w-full border border-white/10 bg-[#0b121c] px-3 text-[11px] text-white outline-none disabled:opacity-70"><option value="png">PNG · 透明背景</option></select><p className="mt-2 text-[9px] leading-4 text-slate-600">当前统一输出 PNG，确保透明通道与编辑器兼容。</p></div>
                  {onLoadPresetDemo && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-3 text-left">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200 mb-1">
                        <Sparkles size={13} className="text-cyan-300" />
                        <span>暂无密钥？一键加载预设演示场景</span>
                      </div>
                      <p className="mb-2.5 text-[10px] leading-relaxed text-slate-400">
                        无需联网与自配 API Key，直接向 1920×1080 画布和时间轴加载内置多图层交互预设数据。
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onLoadPresetDemo();
                          onClose();
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded bg-cyan-500 py-2 px-3 text-[11px] font-bold text-slate-950 transition hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                      >
                        <Sparkles size={13} />
                        <span>立即加载预设演示场景</span>
                      </button>
                    </div>
                  )}
                </div>
              </details>
              {error && <ErrorNoticePanel
                title="AI 抠图处理失败"
                message={error}
                details={`服务商: ${provider.name}\n文件: ${file?.name || '未选择'}\n输出格式: ${config.outputFormat}\n自定义端点: ${config.provider === 'custom' ? config.endpoint || '未填写' : '未使用'}`}
                onRetry={file && config.apiKey.trim() ? () => void handleProcess() : undefined}
                onDismiss={() => setError('')}
              />}
            </div>
            <div className="shrink-0 space-y-2 border-t border-white/10 p-4 sm:p-5"><button type="button" onClick={() => void handleProcess()} disabled={!file || isProcessing || isInserting} className="flex min-h-11 w-full items-center justify-center gap-2 bg-cyan-300 px-4 text-[11px] font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">{isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}{isProcessing ? '正在处理' : '开始 AI 抠图'}</button><button type="button" onClick={() => void handleInsert()} disabled={!resultUrl || isProcessing || isInserting} className="flex min-h-11 w-full items-center justify-center gap-2 border border-cyan-300/35 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-35">{isInserting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{isInserting ? '正在插入' : '插入为新图片图层'}</button><p className="pt-1 text-center text-[9px] leading-4 text-slate-600">插入后可在图层、时间线和属性面板中继续编辑</p></div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AiBackgroundRemovalModal;
