import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Copy, Download, ExternalLink, Link2, Loader2, QrCode, ShieldCheck, Smartphone, X,
} from 'lucide-react';
import type { ProjectData } from '../types';
import { subscriptionService } from '../core/auth/subscriptionService';
import { withExportTimeout } from '../utils/exportAsync';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
}

type SharePhase = 'idle' | 'authorizing' | 'rendering' | 'publishing' | 'ready' | 'error';

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 局域网 HTTP 页面可能没有 clipboard 权限，回退到隐藏 textarea。
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
};

const isNetworkError = (message: string): boolean => /failed to fetch|networkerror|load failed|fetch failed|econnrefused/i.test(message);

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, projectData }) => {
  const [phase, setPhase] = useState<SharePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [error, setError] = useState('');
  const [hasFallback, setHasFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  const fallbackHtmlRef = useRef('');

  const title = projectData.meta?.title || '鲸动交互平台工程';
  const watermarkEnabled = !subscriptionService.hasFeature('export_no_watermark');
  const isBusy = phase === 'authorizing' || phase === 'rendering' || phase === 'publishing';

  useEffect(() => {
    if (!isOpen) return;
    setPhase('idle');
    setProgress(0);
    setStage('');
    setShareUrl('');
    setQrDataUrl('');
    setExpiresAt(0);
    setError('');
    setHasFallback(false);
    setCopied(false);
    fallbackHtmlRef.current = '';
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !expiresAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, expiresAt]);

  const remainingMinutes = expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - now) / 60_000)) : 0;
  const expired = expiresAt > 0 && expiresAt <= now;
  const loopbackShare = /^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(shareUrl);

  const downloadFallback = useCallback(() => {
    const html = fallbackHtmlRef.current;
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || '鲸动交互平台'}_分享单文件.html`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }, [title]);

  const publishShare = useCallback(async (html: string): Promise<{ url: string; expiresAt: number }> => {
    const response = await fetch('/api/share/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, title }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload?.url !== 'string') {
      throw new Error(payload?.error || `分享服务返回异常（HTTP ${response.status}）`);
    }
    return { url: payload.url, expiresAt: Number(payload.expiresAt) || Date.now() + 2 * 60 * 60 * 1000 };
  }, [title]);

  const handleGenerate = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError('');
    setHasFallback(false);
    setShareUrl('');
    setQrDataUrl('');
    setExpiresAt(0);
    setCopied(false);
    setProgress(2);
    setStage('正在验证导出权限…');
    setPhase('authorizing');
    fallbackHtmlRef.current = '';

    try {
      // 分享等同一次「单文件导出」：先用服务端授权，再生成 HTML。
      // 免费档由服务端强制水印并占用免费导出额度，这里不绕过。
      const authorization = await withExportTimeout(
        subscriptionService.authorizeExport('single-html', { watermark: watermarkEnabled }),
        15_000,
        '导出权限验证',
      );

      setPhase('rendering');
      setStage('正在打包工程与素材…');
      setProgress(10);
      const { exportSingleFileHTML } = await import('../utils/export');
      const html = await exportSingleFileHTML(projectData, (message, percent) => {
        setStage(message);
        setProgress(Math.max(10, Math.min(88, Math.round(percent))));
      }, {
        exportProof: authorization.proof,
        watermark: { enabled: watermarkEnabled },
      });

      fallbackHtmlRef.current = html;
      setHasFallback(true);

      setPhase('publishing');
      setStage('正在生成局域网分享链接…');
      setProgress(93);
      const result = await publishShare(html);

      setShareUrl(result.url);
      setExpiresAt(result.expiresAt);
      setNow(Date.now());
      setProgress(100);
      setStage('分享已就绪');
      setPhase('ready');

      try {
        const { default: QRCode } = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(result.url, {
          margin: 1,
          width: 260,
          errorCorrectionLevel: 'M',
          color: { dark: '#071522', light: '#ffffff' },
        });
        setQrDataUrl(dataUrl);
      } catch {
        // 二维码失败不影响链接本身，界面会提示手动复制。
      }
    } catch (caught) {
      const rawMessage = caught instanceof Error ? caught.message : '分享失败，请重试';
      const message = isNetworkError(rawMessage)
        ? '无法连接本地分享服务：请确认后台服务已启动（默认 8080 端口），然后重试。'
        : rawMessage;
      setError(message);
      setStage('分享未完成');
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  }, [projectData, publishShare, watermarkEnabled]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    setError('');
    const ok = await copyText(shareUrl);
    setCopied(ok);
    if (!ok) setError('复制失败，请手动选中链接复制。');
    if (ok) window.setTimeout(() => setCopied(false), 1800);
  }, [shareUrl]);

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation">
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-sky-400/25 bg-[#0d121c] text-slate-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="分享交付"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/25 bg-sky-400/10 text-sky-300">
              <QrCode size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">分享交付</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">生成局域网链接和二维码，同网段手机/电脑直接打开</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="关闭分享交付"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-start gap-2.5">
              <Smartphone size={15} className="mt-0.5 shrink-0 text-sky-300" />
              <div className="min-w-0 text-[10px] leading-relaxed text-slate-400">
                <p className="text-[11px] font-semibold text-slate-200">{title}</p>
                <p className="mt-1">客户手机或电脑需要和这台电脑连接同一个 Wi-Fi / 局域网。</p>
                <p className="mt-0.5">链接 2 小时内有效；后台服务重启后需要重新生成。</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-slate-400">
                <ShieldCheck size={10} />
                {watermarkEnabled ? '免费档：导出带水印，占用一次免费额度' : '专业档：无水印'}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-slate-500">上限 20 MB</span>
            </div>
          </div>

          {isBusy && (
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3" aria-live="polite">
              <div className="flex items-center gap-2 text-[11px] text-sky-200">
                <Loader2 size={13} className="animate-spin" />
                <span>{stage || '正在准备分享…'}</span>
                <span className="ml-auto font-mono text-[10px] text-sky-300">{progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {phase === 'idle' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
                <Link2 size={22} className="mx-auto text-slate-500" />
                <p className="mt-2 text-[11px] text-slate-300">点击生成后，会先验证导出权限，再把工程打成单文件快照。</p>
                <p className="mt-1 text-[9px] text-slate-500">每次生成都会占用一次导出额度；专业版不占免费额度。</p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-[12px] font-bold text-slate-950 hover:bg-sky-300"
              >
                <QrCode size={14} /> 生成分享链接与二维码
              </button>
            </div>
          )}

          {phase === 'ready' && shareUrl && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="分享二维码" className="h-[220px] w-[220px] rounded-lg bg-white p-2" />
                ) : (
                  <div className="grid h-[220px] w-[220px] place-items-center rounded-lg bg-white/5 text-center text-[10px] text-slate-500">
                    二维码生成失败<br />可直接复制下方链接
                  </div>
                )}
                <p className="text-[10px] text-slate-400">手机扫码直接打开；电脑可复制链接访问</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="分享链接"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[10px] text-sky-200 outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 text-[10px] font-semibold text-sky-200 hover:bg-sky-400/20"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制'}
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[10px] text-slate-300 hover:bg-white/5"
                >
                  <ExternalLink size={12} /> 打开
                </a>
              </div>

              {loopbackShare && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-[9px] leading-relaxed text-amber-200">
                  没有检测到局域网 IP，当前链接只能在这台电脑打开。请先连接 Wi-Fi 或网线，再重新生成分享链接。
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500">
                <span>
                  {expired
                    ? '链接已过期，请重新生成'
                    : `约 ${remainingMinutes} 分钟后失效（${new Date(expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}）`}
                </span>
                <span className="flex items-center gap-2">
                  {expired && (
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-sky-200 hover:bg-sky-400/20"
                    >
                      <QrCode size={10} /> 重新生成
                    </button>
                  )}
                  {hasFallback && (
                    <button
                      type="button"
                      onClick={downloadFallback}
                      className="inline-flex items-center gap-1 text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-slate-200"
                    >
                      <Download size={10} /> 下载单文件 HTML
                    </button>
                  )}
                </span>
              </div>
              {error && <p className="text-[10px] text-red-300" role="alert">{error}</p>}
            </div>
          )}

          {phase === 'error' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-3 text-[11px] leading-relaxed text-red-200" role="alert">
                <p className="font-semibold">分享没有生成成功</p>
                <p className="mt-1 text-red-200/80">{error}</p>
              </div>
              {hasFallback && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                  <p className="text-[10px] leading-relaxed text-emerald-100/80">
                    导出权限已经验证通过，工程已打成单文件。可以先把 HTML 发给客户，或保存后重试生成链接。
                  </p>
                  <button
                    type="button"
                    onClick={downloadFallback}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-400/20"
                  >
                    <Download size={13} /> 下载单文件 HTML
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-400/20"
              >
                <QrCode size={14} /> 重试生成分享链接
              </button>
              <p className="text-center text-[9px] text-slate-500">重试会重新验证导出权限，可能再次占用导出额度。</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <span className="text-[9px] text-slate-500">只在局域网内可见，不会上传到公网</span>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ShareModal;
