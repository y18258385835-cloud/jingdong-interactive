import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, MessageSquare, QrCode, ShieldCheck, Sparkles, X } from 'lucide-react';
import { subscriptionService } from '../core/auth/subscriptionService';
import { useSubscription } from '../core/auth/hooks';

interface LicenseActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivated?: () => void;
}

/** 授权码在第三方平台/客服销售，这里做激活与购买引导 */
const PURCHASE_URL = (import.meta.env.VITE_PURCHASE_URL as string | undefined) || 'https://jd-hub.top/';
const QR_CODE_URL = '/assets/contact-qrcode.jpg';

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  team: '企业商业版',
};

const TIERS = [
  {
    id: 'trial_7d',
    title: '单次项目体验码',
    duration: '7 天卡',
    price: '¥29.9',
    badge: '临时出片',
    features: ['7天内无限次无水印导出 Zip 工程包', '全离线解压即用', '适合作业演示 / 单次公开课'],
    highlight: false,
  },
  {
    id: 'yearly',
    title: '专业创作者年卡',
    duration: '年度码 · 365天',
    price: '¥299',
    unit: '/年',
    badge: '热选推荐',
    features: ['全年无限次无水印极速导出', '解锁全部高阶交互组件与预设模板', '4K 超高清大屏自适应渲染', '适合自媒体/独立设计师/策划'],
    highlight: true,
  },
  {
    id: 'permanent',
    title: '企业/展厅商业买断码',
    duration: '永久离线许可',
    price: '¥999',
    unit: '/永久',
    badge: '商业买断',
    features: ['一机一码离线永久激活 (永久可用)', '支持文旅/展馆展厅大屏工程交付', '无网络环境离线持续稳定运行', '一对一工程师专属技术支持'],
    highlight: false,
  },
];

export const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({ isOpen, onClose, onActivated }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { plan, daysRemaining, refresh } = useSubscription();

  if (!isOpen) return null;

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      await subscriptionService.activateLicense(code);
      await refresh();
      setSuccess(true);
      setMessage('授权已生效：已解锁无限次无水印商业导出与 4K 超清分辨率！');
      setCode('');
      onActivated?.();
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : '激活失败，请检查授权码后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingText = daysRemaining > 0 ? `剩余 ${daysRemaining} 天` : '长期有效';

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto" role="presentation">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-[#10131d] shadow-2xl my-auto animate-in zoom-in-95" role="dialog" aria-modal="true" aria-labelledby="license-activation-title">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-sky-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 id="license-activation-title" className="text-base font-bold text-white flex items-center gap-2">
                商业授权与注册码激活
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium">30秒极速激活</span>
              </h2>
              <p className="text-[11px] text-slate-400">解锁无限制商业导出、去除水印、支持展厅大屏 4K 交付</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition" aria-label="关闭激活窗口">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Current Status Banner */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <ShieldCheck size={16} className="text-cyan-400" />
              当前设备授权状态：<strong className="text-white text-sm">{PLAN_LABELS[plan] || plan}</strong>
            </span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${plan === 'free' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
              {plan === 'free' ? '免费试用版 (带水印 · 最高 1080p)' : `正版已授权 · ${remainingText}`}
            </span>
          </div>

          {/* 3-Tier Pricing Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sparkles size={14} className="text-amber-400" />
                三档授权方案（按需选购 · 永久去水印）
              </div>
              <span className="text-[11px] text-slate-400">支持微信/支付宝咨询直联</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`relative rounded-xl p-4 border flex flex-col justify-between transition-all ${
                    tier.highlight
                      ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-400/60 shadow-lg shadow-cyan-950/60'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  {tier.badge && (
                    <div className={`absolute -top-2.5 right-3 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      tier.highlight
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/40'
                        : 'bg-white/10 text-slate-300 border border-white/15'
                    }`}>
                      {tier.badge}
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-bold text-white">{tier.title}</h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">{tier.duration}</div>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-white">{tier.price}</span>
                      {tier.unit && <span className="text-xs text-slate-400">{tier.unit}</span>}
                    </div>

                    <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-cyan-400 text-xs shrink-0">✓</span>
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Purchase & QR Code Box */}
          <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/30 via-[#131929] to-slate-900 p-4">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="shrink-0 flex flex-col items-center">
                <div className="w-28 h-28 bg-white p-1.5 rounded-xl shadow-lg border border-white/20 flex items-center justify-center">
                  <img
                    src={QR_CODE_URL}
                    alt="官方微信沟通二维码"
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <span className="mt-1.5 text-[10px] text-cyan-300 flex items-center gap-1">
                  <QrCode size={11} /> 扫码添加客服微信
                </span>
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                  <MessageSquare size={13} /> 极速直连客服 · 30秒获取注册码
                </div>
                <h4 className="text-sm font-bold text-white">扫码添加客服 / 点击自助购买，30秒获取商用去水印注册码</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  微信扫码直联商务顾问，付款后即时发送专属注册码；支持对公转账与正规增值税发票。如需批量采购或展厅集成合作，享受专属大客户折扣。
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() => window.open(PURCHASE_URL, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                  >
                    访问官方网站了解更多 <ExternalLink size={12} />
                  </button>
                  <span className="text-[11px] text-slate-500">|</span>
                  <span className="text-[11px] text-slate-400">官方邮箱: contact@jd-hub.top</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activation Form */}
          <form onSubmit={activate} className="space-y-3 pt-1">
            <label className="block text-xs font-bold text-slate-200">
              输入已购买的注册码 (License Key)
              <div className="mt-1.5 flex gap-2">
                <input
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="例如：JDINT-XXXX-XXXX-XXXX 或 AETHER-XXXX-XXXX"
                  className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3.5 py-2.5 font-mono text-sm tracking-wider text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !code.trim()}
                  className="shrink-0 flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-6 py-2.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-cyan-600/30"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {isSubmitting ? '正在验证...' : '立即激活'}
                </button>
              </div>
            </label>

            {message && (
              <div className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
                success ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200'
              }`}>
                {success && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                <span>{message}</span>
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-3 bg-[#0c0e17] text-[11px] text-slate-400">
          <span>安全保障：一机一码离线加密 · 支持企业展厅长期稳定运行</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
