import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import {
  GALAXY_COMPONENT_BASE_SIZE,
  CONTINUOUS_INTERACTION_COMPONENT_TYPES,
  isContinuousInteractionComponent,
  type GalaxyComponentType,
} from './galaxyComponentMeta';

export { GALAXY_COMPONENT_BASE_SIZE, CONTINUOUS_INTERACTION_COMPONENT_TYPES, isContinuousInteractionComponent } from './galaxyComponentMeta';
export type { GalaxyComponentType } from './galaxyComponentMeta';

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, CloudSun, MapPin, Menu, Plus, Search, X } from 'lucide-react';
import QRCode from 'qrcode';
import { SceneElement, type ContinuousInteractionConfig, type ContinuousInteractionNode } from '../../types';
import { getCrossedContinuousNodes, normalizeContinuousInteraction } from '../../utils/continuousInteraction';
import { HolographicGauge, HOLOGRAPHIC_GAUGE_TYPES, type HolographicGaugeVariant } from './HolographicGauges';
import { IsometricDataIcon, DATA_ICON_TYPES, type DataIconVariant } from './IsometricDataIcons';
import { getTextStyle } from '../../utils/typography';
import { inferOfficialModaoId, OFFICIAL_SHAPE_IDS, OFFICIAL_FLOW_NODE_IDS, OFFICIAL_MEDIA_IDS, OFFICIAL_CONTAINER_IDS } from './officialComponentModel';
import { CITY_MAP_NAMES, isCityMapId } from './cityMapIndex';
import { OfficialCityMapGraphic } from './OfficialCityMapGraphic';
import './officialMetrics.css';

const ThreeCanvasPreview = React.lazy(() =>
  import('../ThreeCanvas').then(({ ThreeCanvas }) => ({ default: ThreeCanvas }))
);

const OfficialQrCode: React.FC<{ value: string; foreground?: string; background?: string; errorCorrection?: string }> = ({ value, foreground = '#071522', background = '#ffffff', errorCorrection = 'M' }) => {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value || ' ', { type: 'svg', margin: 1, errorCorrectionLevel: errorCorrection as any, color: { dark: foreground, light: background } })
      .then((nextSvg) => { if (!cancelled) setSvg(nextSvg); })
      .catch(() => { if (!cancelled) setSvg(''); });
    return () => { cancelled = true; };
  }, [value, foreground, background, errorCorrection]);
  if (!svg) return <span aria-label="正在生成二维码">正在生成二维码…</span>;
  return <div aria-label={`二维码：${value}`} style={{ width: 88, height: 88, background }} dangerouslySetInnerHTML={{ __html: svg }} />;
};

export type CardTextAlign = 'left' | 'center';

export interface GalaxyCardData {
  title?: string;
  content?: string;
  label?: string;
  color?: string;
  accentColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  align?: CardTextAlign;
  fontFamily?: string;
}

const cardStyle = (data: GalaxyCardData, fallbackAccent: string, fallbackSurface: string) => ({
  '--card-accent': data.accentColor || data.color || fallbackAccent,
  '--card-surface': data.surfaceColor || fallbackSurface,
  '--card-border': data.borderColor || data.accentColor || data.color || `${fallbackAccent}66`,
  '--card-text': data.textColor || '#f8fafc',
  '--card-muted': data.mutedTextColor || '#cbd5e1',
  '--card-align': data.align === 'left' ? 'left' : 'center',
  '--card-items': data.align === 'left' ? 'flex-start' : 'center',
  fontFamily: data.fontFamily || "Inter, 'Microsoft YaHei', sans-serif",
} as React.CSSProperties);

/** Shrinks only when copy exceeds the card's real content box. */
const AutoFitCardCopy: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const next = Math.max(0.68, Math.min(1, (node.clientHeight / Math.max(node.scrollHeight, 1)) * 0.97));
      setScale((current) => Math.abs(current - next) > 0.01 ? next : current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [children]);

  return <div ref={ref} className={className} style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>{children}</div>;
};

const ProductCard: React.FC<GalaxyCardData & { variant: string; eyebrow?: string; metric?: boolean }> = ({
  title = '产品标题',
  content = '用简洁的信息层级呈现产品价值与关键说明。',
  variant,
  eyebrow = '产品信息',
  metric = false,
  ...data
}) => {
  const fallbackAccent = variant === 'neon' ? '#22d3ee' : variant === 'outline' ? '#a78bfa' : '#38bdf8';
  const fallbackSurface = variant === 'glass' ? 'rgba(15, 23, 42, 0.72)' : '#111827';
  return (
    <div className={`aether-product-card aether-product-card--${variant}`} style={cardStyle(data, fallbackAccent, fallbackSurface)}>
      <AutoFitCardCopy className="aether-product-card__content">
        <span className="aether-product-card__eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p className={metric ? 'aether-product-card__metric' : undefined}>{content}</p>
      </AutoFitCardCopy>
      <style>{`
        .aether-product-card { box-sizing: border-box; width: 280px; height: 180px; position: relative; overflow: hidden; display: flex; align-items: stretch; padding: 1px; color: var(--card-text); background: var(--card-surface); border: 1px solid var(--card-border); font-family: inherit; }
        .aether-product-card__content { box-sizing: border-box; width: 100%; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: var(--card-items); gap: 8px; padding: 22px; text-align: var(--card-align); transition: transform 120ms ease-out; }
        .aether-product-card__eyebrow { display: block; max-width: 100%; color: var(--card-accent); font-size: 10px; font-weight: 700; line-height: 1.2; letter-spacing: 0; text-transform: uppercase; }
        .aether-product-card h3, .aether-product-card p { box-sizing: border-box; width: 100%; max-width: 100%; margin: 0; overflow-wrap: anywhere; }
        .aether-product-card h3 { color: var(--card-text); font-size: 20px; font-weight: 700; line-height: 1.25; }
        .aether-product-card p { color: var(--card-muted); font-size: 15px; font-weight: 400; line-height: 1.48; }
        .aether-product-card__metric { color: var(--card-text) !important; font-size: 31px !important; font-weight: 750 !important; line-height: 1.05 !important; }
        .aether-product-card--glass { border-radius: 12px; backdrop-filter: blur(14px); box-shadow: 0 12px 30px rgba(2, 6, 23, 0.24), inset 0 1px 0 rgba(255,255,255,.12); }
        .aether-product-card--gradient { border-radius: 14px; background: linear-gradient(var(--card-surface), var(--card-surface)) padding-box, linear-gradient(135deg, var(--card-accent), var(--card-border)) border-box; border-color: transparent; }
        .aether-product-card--neon { border-radius: 10px; box-shadow: 0 0 0 1px color-mix(in srgb, var(--card-accent) 20%, transparent), 0 12px 26px color-mix(in srgb, var(--card-accent) 18%, transparent); }
        .aether-product-card--metric { border-radius: 10px 22px 10px 22px; border-left: 4px solid var(--card-accent); }
        .aether-product-card--spotlight { border-radius: 8px 8px 22px 8px; border-top: 3px solid var(--card-accent); }
        .aether-product-card--split { border-radius: 10px; border-left: 4px solid var(--card-accent); }
        .aether-product-card--split::after { content: ''; position: absolute; right: 20px; top: 18px; width: 26px; height: 26px; border: 1px solid var(--card-border); border-radius: 7px 7px 7px 0; opacity: .8; }
        .aether-product-card--outline { border-radius: 4px 18px 4px 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--card-surface) 94%, var(--card-accent)), var(--card-surface)); }
      `}</style>
    </div>
  );
};

const CenteredProfileCard: React.FC<GalaxyCardData> = ({ title, label, content, ...data }) => {
  const name = title || label || '产品团队';
  const role = content || '产品体验设计';
  return (
    <div className="aether-profile-card" style={cardStyle(data, '#38bdf8', '#111827')}>
      <div className="aether-profile-card__avatar">{name.charAt(0)}</div>
      <div className="aether-profile-card__copy">
        <h3>{name}</h3>
        <p>{role}</p>
      </div>
      <div className="aether-profile-card__stats"><span><b>128</b>项目</span><span><b>2.4k</b>关注</span><span><b>96</b>作品</span></div>
      <style>{`
        .aether-profile-card { box-sizing: border-box; width: 260px; height: 260px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 11px; overflow: hidden; background: var(--card-surface); border: 1px solid var(--card-border); border-radius: 14px; color: var(--card-text); font-family: inherit; text-align: center; }
        .aether-profile-card__avatar { width: 58px; height: 58px; display: flex; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: var(--card-accent); font-size: 22px; font-weight: 700; }
        .aether-profile-card__copy { width: 100%; min-width: 0; }
        .aether-profile-card h3, .aether-profile-card p { margin: 0; overflow-wrap: anywhere; }
        .aether-profile-card h3 { color: var(--card-text); font-size: 17px; line-height: 1.3; }
        .aether-profile-card p { margin-top: 3px; color: var(--card-muted); font-size: 12px; line-height: 1.45; }
        .aether-profile-card__stats { width: 100%; display: flex; justify-content: space-between; gap: 8px; padding-top: 12px; border-top: 1px solid var(--card-border); color: var(--card-muted); font-size: 10px; }
        .aether-profile-card__stats span { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
        .aether-profile-card__stats b { color: var(--card-text); font-size: 14px; line-height: 1.1; }
      `}</style>
    </div>
  );
};

// ============================================
// Galaxy 风格 UI 组件库
// 精选自 Galaxy 开源项目的具体 UI 组件
// ============================================

// 通用通知样式
const notifyStyles = `
  .galaxy-notify { display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px; border-radius: 12px; min-width: 280px; max-width: 360px; font-family: 'Inter', sans-serif; }
  .galaxy-notify-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold; flex-shrink: 0; margin-top: 1px; }
  .galaxy-notify-content { flex: 1; min-width: 0; }
  .galaxy-notify-title { margin: 0 0 3px 0; font-size: 13px; font-weight: 700; }
  .galaxy-notify-msg { margin: 0; font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.4; }
`;

// 1. Bug Report 按钮（带 tooltip，复刻自 Galaxy）
/** 绿色轮廓按钮：保持源代码的透明底、可编辑文字和数字联动效果。 */
export const GreenOutlineButton: React.FC<{ data?: any }> = ({ data = {} }) => {
  const { label = 'CLICK HERE', value, color = '#43e97b' } = data;
  const text = typeof label === 'string' ? label : 'CLICK HERE';
  const configuredValue = value === '' || value === undefined || value === null ? undefined : Number(value);
  const getNumber = (input: string) => {
    const match = input.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const textValue = getNumber(text);
  const scaleValue = Number.isFinite(configuredValue) ? configuredValue : textValue;
  const scale = 1 + Math.min(Math.max(scaleValue, 0), 100) / 500;
  const textStyle = getTextStyle({ ...data, color: data.textColor || '#333333', textColor: data.textColor || '#333333' } as SceneElement, { color: data.textColor || '#333333', fontSize: data.fontSize || 16, defaultLineHeight: 1.2 });
  const textPadding = Math.max(0, Number(data.textPadding) || 0);

  return <div className="green-outline-button" style={{ '--green-accent': color, '--green-scale': scale } as React.CSSProperties}>
    <span className="green-outline-button__text" style={{ ...textStyle, padding: `${textPadding}px`, paddingLeft: `${40 + textPadding}px` }} aria-label="按钮文字">{text}</span>
    <span className="green-outline-button__icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 6l6 6-6 6" /></svg></span>
    <style>{`
      .green-outline-button { box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; width:260px; height:60px; padding:0 10px 0 30px; border:2px solid transparent; border-radius:30px; position:relative; user-select:none; background:linear-gradient(transparent,transparent) padding-box,linear-gradient(135deg,#43e97b,#38f9d7) border-box; transition:transform .3s ease,filter .3s ease; transform:translateY(var(--green-hover-y,0)) scale(var(--green-scale)); transform-origin:center; }
      .green-outline-button:hover { --green-hover-y:-3px; filter:drop-shadow(0 8px 15px color-mix(in srgb,var(--green-accent) 24%,transparent)); }
      .green-outline-button__text { min-width:0; flex:1; color:#333; font:700 16px/1.2 'Segoe UI',Arial,sans-serif; text-align:center; text-transform:uppercase; outline:none; cursor:default; }
      .green-outline-button__text[contenteditable="true"] { cursor:text; border-bottom:1px dashed transparent; padding-bottom:2px; transition:border-color .2s ease,background-color .2s ease; }
      .green-outline-button__text[contenteditable="true"]:hover { border-bottom-color:rgba(0,0,0,.4); background:rgba(67,233,123,.08); }
      .green-outline-button__text[contenteditable="true"]:focus { border-bottom-color:var(--green-accent); }
      .green-outline-button__icon { display:flex; flex:0 0 44px; align-items:center; justify-content:center; width:44px; height:44px; border:2px solid var(--green-accent); border-radius:50%; transition:transform .3s ease; }
      .green-outline-button__icon svg { width:16px; height:16px; fill:none; stroke:var(--green-accent); stroke-width:3; }
      @media (prefers-reduced-motion:reduce) { .green-outline-button,.green-outline-button__icon { transition:none; } }
    `}</style>
  </div>;
};

type BatchButtonVariant = 'cyan-solid' | 'auth-toggle' | 'transparent-bubble' | 'blue-bubble' | 'back' | 'next' | 'play' | 'pause' | 'sci-fi-neon';

/** 批量导入的按钮组件：统一使用 uiComponentData 和软件通用文字样式。 */
export const BatchDashboardButton: React.FC<{ variant: BatchButtonVariant; data?: any }> = ({ variant, data = {} }) => {
  const defaults: Record<BatchButtonVariant, { label: string; color: string }> = {
    'cyan-solid': { label: 'READ MORE', color: '#4facfe' },
    'auth-toggle': { label: 'SIGN IN', color: '#ff0066' },
    'transparent-bubble': { label: 'CLICK HERE', color: '#00e5ff' },
    'blue-bubble': { label: 'CLICK HERE', color: '#0066ff' },
    back: { label: 'BACK', color: '#ff007f' },
    next: { label: 'NEXT', color: '#00e5ff' },
    play: { label: 'PLAY', color: '#0066ff' },
    pause: { label: 'PAUSE', color: '#ff6b9d' },
    'sci-fi-neon': { label: 'BUTTON', color: '#00e5ff' },
  };
  const fallback = defaults[variant];
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : fallback.label;
  const secondaryLabel = typeof data.secondaryLabel === 'string' && data.secondaryLabel.trim() ? data.secondaryLabel : 'SIGN UP';
  const configuredValue = data.value === '' || data.value === undefined || data.value === null ? undefined : Number(data.value);
  const numericMatch = label.match(/-?\d+(\.\d+)?/);
  const numericValue = Number.isFinite(configuredValue) ? configuredValue : (numericMatch ? Number(numericMatch[0]) : 0);
  const scale = 1 + Math.min(Math.max(numericValue, 0), 100) / (variant === 'sci-fi-neon' ? 1000 : 500);
  const defaultTextColor = data.textColor || (variant === 'cyan-solid' ? '#4facfe' : variant === 'transparent-bubble' ? '#ffffff' : variant === 'blue-bubble' || variant === 'back' || variant === 'next' ? '#111111' : variant === 'sci-fi-neon' ? '#e6f0ff' : '#666666');
  const textStyle = getTextStyle({ ...data, color: defaultTextColor, textColor: defaultTextColor } as SceneElement, { color: defaultTextColor, fontSize: data.fontSize || (variant === 'sci-fi-neon' ? 26 : variant === 'transparent-bubble' || variant === 'blue-bubble' ? 22 : variant === 'cyan-solid' ? 16 : 18), defaultLineHeight: 1.2 });
  const textPadding = Math.max(0, Number(data.textPadding) || 0);
  const textStyleWithPadding = { ...textStyle, padding: `${textPadding}px`, paddingLeft: `${textPadding}px` };
  const rootStyle = { '--batch-accent': data.color || fallback.color, '--batch-scale': scale } as React.CSSProperties;
  const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;
  const mediaIcon = variant === 'play'
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,5 19,12 8,19" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="7" width="3" height="10" rx="1" /><rect x="13" y="7" width="3" height="10" rx="1" /></svg>;

  let content: React.ReactNode;
  if (variant === 'cyan-solid') content = <div className="batch-cyan-solid"><span className="batch-text" style={textStyleWithPadding}>{label}</span><span className="batch-icon-circle">{arrow}</span></div>;
  else if (variant === 'auth-toggle') content = <div className="batch-auth-toggle"><div className="batch-auth-signin"><span className="batch-text" style={{ ...textStyleWithPadding, color: data.textColor || '#ff0066' }}>{label}</span></div><div className="batch-auth-signup"><span className="batch-text" style={{ ...textStyleWithPadding, color: data.secondaryTextColor || '#2b2b2b' }}>{secondaryLabel}</span></div></div>;
  else if (variant === 'transparent-bubble' || variant === 'blue-bubble') content = <div className={`batch-bubble ${variant === 'transparent-bubble' ? 'is-transparent' : 'is-blue'}`}><span className="batch-text" style={textStyleWithPadding}>{label}</span></div>;
  else if (variant === 'back') content = <div className="batch-split batch-back"><span className="batch-split-icon">{<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>}</span><span className="batch-split-label" style={textStyleWithPadding}>{label}</span></div>;
  else if (variant === 'next') content = <div className="batch-split batch-next"><span className="batch-split-label" style={textStyleWithPadding}>{label}</span><span className="batch-split-icon">{<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18c0-4 3-7 7-7h4" /><path d="M17 8l4 3-4 3" /></svg>}</span></div>;
  else if (variant === 'play' || variant === 'pause') content = <div className="batch-media"><span className="batch-media-button">{mediaIcon}</span><span className="batch-media-label" style={textStyleWithPadding}>{label}</span></div>;
  else content = <div className="batch-sci-fi"><svg className="batch-sci-fi-border" viewBox="0 0 288 88" aria-hidden="true"><defs><linearGradient id="batch-neon-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00ffcc" /><stop offset="50%" stopColor="#0066ff" /><stop offset="100%" stopColor="#00ffcc" /></linearGradient></defs><rect x="4" y="4" width="280" height="80" rx="16" fill="none" stroke="url(#batch-neon-gradient)" strokeWidth="4" strokeDasharray="40 256 40 256" strokeLinecap="round" /></svg><span className="batch-sci-fi-panel"><span className="batch-text" style={{ ...textStyleWithPadding, color: data.textColor || '#e6f0ff' }}>{label}</span></span></div>;

  return <div className={`batch-dashboard-button batch-${variant}`} style={rootStyle}>{content}<style>{`
    .batch-dashboard-button{display:inline-block;position:relative;transform:scale(var(--batch-scale));transform-origin:center;transition:transform .3s cubic-bezier(.25,.8,.25,1),filter .3s ease;filter:drop-shadow(0 10px 15px rgba(0,0,0,.3));font-family:'Segoe UI',Arial,sans-serif;user-select:none}.batch-dashboard-button:hover{transform:translateY(-3px) scale(var(--batch-scale));filter:drop-shadow(0 15px 22px rgba(0,0,0,.4))}.batch-text,.batch-media-label{display:block;position:relative;z-index:2;white-space:nowrap;text-transform:uppercase;outline:none}.batch-icon-circle{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:2px solid var(--batch-accent);border-radius:50%}.batch-icon-circle svg{width:16px;height:16px;fill:none;stroke:var(--batch-accent);stroke-width:3}.batch-cyan-solid{display:flex;align-items:center;justify-content:space-between;width:260px;height:60px;padding:0 25px 0 30px;border-radius:30px;background:transparent}.batch-cyan-solid .batch-text{font-weight:800;text-align:center;flex:1;padding-right:15px}.batch-auth-toggle{display:flex;border-radius:50px;box-shadow:0 4px 15px rgba(0,0,0,.1)}.batch-auth-toggle>div{display:flex;align-items:center;justify-content:center;height:64px;padding:0 40px;font-size:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.batch-auth-signin{color:#ff0066;border:2px solid #ff0066;border-right:0;border-radius:50px 0 0 50px}.batch-auth-signup{position:relative;background:linear-gradient(90deg,#ff0066,#ff8c00);border-radius:0 50px 50px 0}.batch-auth-signup:after{content:'';position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);border-left:10px solid transparent;border-right:10px solid transparent;border-top:10px solid #ff8c00}.batch-bubble{position:relative;display:flex;align-items:center;justify-content:center;padding:18px 50px;border-radius:50px;cursor:pointer}.batch-bubble:after{content:'';position:absolute;bottom:-11px;left:50%;transform:translateX(-50%);border-left:12px solid transparent;border-right:12px solid transparent}.batch-bubble.is-transparent{background:transparent;border:2px solid rgba(0,229,255,.8);box-shadow:inset 0 4px 6px rgba(255,255,255,.5),inset 0 -6px 12px rgba(0,0,0,.2)}.batch-bubble.is-transparent:after{border-top:12px solid rgba(0,229,255,.8)}.batch-bubble.is-blue{background:linear-gradient(180deg,#00e5ff,#0066ff);box-shadow:inset 0 4px 6px rgba(255,255,255,.8),inset 0 -6px 12px rgba(0,0,0,.3)}.batch-bubble.is-blue:after{border-top:12px solid #0066ff}.batch-split{display:flex;border-radius:50px;overflow:visible}.batch-split-icon,.batch-split-label{display:flex;align-items:center;justify-content:center;height:60px}.batch-split-icon{width:70px;border-radius:50px 0 0 50px;background:linear-gradient(135deg,#ff007f,#ff8c00)}.batch-split-icon svg{width:24px;height:24px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.batch-split-label{position:relative;min-width:120px;padding:0 25px 0 20px;background:#fff;border-radius:0 50px 50px 0}.batch-split-label:after{content:'';position:absolute;bottom:-12px;right:30px;border-left:10px solid transparent;border-right:10px solid transparent;border-top:14px solid #fff}.batch-next .batch-split-label{min-width:120px;padding:0 20px;background:#fff;border-radius:50px 0 0 50px}.batch-next .batch-split-label:after{left:30px;right:auto}.batch-next .batch-split-icon{width:70px;border-radius:0 50px 50px 0;background:linear-gradient(135deg,#00e5ff,#007bff)}.batch-split-icon svg{fill:none}.batch-media{display:flex;flex-direction:column;align-items:center;gap:15px}.batch-media-button{display:grid;place-items:center;width:80px;height:80px;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 6px #2a2a2a;background:linear-gradient(135deg,#00e5ff,#0066ff)}.batch-pause .batch-media-button,.batch-pause-button-alt .batch-media-button{background:linear-gradient(135deg,#ff6b9d,#ff8c00)}.batch-media-button svg{width:32px;height:32px;fill:#fff;filter:drop-shadow(0 2px 3px rgba(0,0,0,.2))}.batch-media-label{color:#666;font-size:14px;font-weight:700;letter-spacing:1px}.batch-sci-fi{position:relative;width:288px;height:88px;padding:4px}.batch-sci-fi-border{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}.batch-sci-fi-panel{position:relative;display:flex;align-items:center;justify-content:center;width:280px;height:80px;border:2px solid #1c3d7a;border-radius:16px;background:linear-gradient(180deg,#0a1b3a,#030b1c);box-shadow:inset 0 0 20px rgba(0,100,255,.2),inset 0 2px 5px rgba(255,255,255,.1);z-index:2}.batch-sci-fi .batch-text{font-style:italic}.batch-sci-fi .batch-text{ text-shadow:0 0 8px rgba(0,170,255,.8),0 0 15px rgba(0,170,255,.5),0 2px 4px rgba(0,0,0,.8)}
  `}</style></div>;
};

export const GalaxyBugButton: React.FC<{ children?: React.ReactNode }> = ({ children = '报告 Bug' }) => (
  <div className="galaxy-bug-wrap">
    <button className="galaxy-bug-btn">
      <span className="galaxy-bug-icon">🐛</span>
      {children}
    </button>
    <div className="galaxy-bug-tooltip">点击提交 Bug 报告</div>
    <style>{`
      .galaxy-bug-wrap { position: relative; display: inline-block; }
      .galaxy-bug-btn { display: flex; align-items: center; gap: 8px; padding: 10px 22px; background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(238,90,36,0.4); }
      .galaxy-bug-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(238,90,36,0.5); }
      .galaxy-bug-icon { font-size: 16px; }
      .galaxy-bug-tooltip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); padding: 6px 12px; background: rgba(0,0,0,0.85); color: white; font-size: 11px; border-radius: 6px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
      .galaxy-bug-wrap:hover .galaxy-bug-tooltip { opacity: 1; }
    `}</style>
  </div>
);

// 2. 发光按钮
export const GalaxyGlowButton: React.FC<{ children?: React.ReactNode; color?: string; fullWidth?: boolean; fontSize?: number; appearance?: 'solid' | 'outline' }> = ({ children = '发光按钮', color = '#06b6d4', fullWidth = false, fontSize = 14, appearance = 'solid' }) => (
  <button className={`galaxy-glow-btn${fullWidth ? ' galaxy-glow-btn--full' : ''}${appearance === 'outline' ? ' galaxy-glow-btn--outline' : ''}`} style={{ '--glow-color': color, '--glow-font-size': `${fontSize}px` } as React.CSSProperties}>{children}
    <style>{`
      .galaxy-glow-btn { box-sizing: border-box; padding: 12px 30px; font-size: var(--glow-font-size, 14px); font-weight: 600; color: white; background: var(--glow-color); border: none; border-radius: 10px; cursor: pointer; position: relative; transition: all 0.3s; }
      .galaxy-glow-btn--full { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 44px; white-space: nowrap; }
      .galaxy-glow-btn--outline { color: #f7f6f0; background: rgba(8, 13, 14, .3); border: 1px solid rgba(247, 246, 240, .64); border-radius: 5px; box-shadow: inset 0 1px rgba(255,255,255,.1); }
      .galaxy-glow-btn--outline::before { inset: 0; border-radius: 5px; filter: blur(14px); opacity: 0; }
      .galaxy-glow-btn--outline:hover { background: rgba(247, 246, 240, .94); color: #111714; border-color: rgba(247, 246, 240, .94); }
      .galaxy-glow-btn--outline:hover::before { opacity: .26; }
      .galaxy-glow-btn::before { content: ''; position: absolute; inset: -2px; background: var(--glow-color); border-radius: 12px; filter: blur(12px); opacity: 0.6; z-index: -1; transition: opacity 0.3s; }
      .galaxy-glow-btn:hover { transform: translateY(-2px); }
      .galaxy-glow-btn:hover::before { opacity: 1; }
      @media (prefers-reduced-motion: reduce) { .galaxy-glow-btn, .galaxy-glow-btn::before { transition-duration: .01ms; } }
    `}</style>
  </button>
);

// 3. 霓虹按钮
export const GalaxyNeonButton: React.FC<{ children?: React.ReactNode; color?: string }> = ({ children = '霓虹按钮', color = '#ff00ff' }) => (
  <button className="galaxy-neon-btn" style={{ '--neon-color': color } as React.CSSProperties}>{children}
    <style>{`
      .galaxy-neon-btn { padding: 12px 30px; font-size: 14px; font-weight: 600; color: var(--neon-color); background: transparent; border: 2px solid var(--neon-color); border-radius: 10px; cursor: pointer; position: relative; transition: all 0.3s; text-shadow: 0 0 10px var(--neon-color); box-shadow: 0 0 10px var(--neon-color), inset 0 0 10px rgba(255,0,255,0.1); }
      .galaxy-neon-btn:hover { background: var(--neon-color); color: white; box-shadow: 0 0 30px var(--neon-color), 0 0 60px var(--neon-color); }
    `}</style>
  </button>
);

// 4. 3D 按压按钮
export const Galaxy3DButton: React.FC<{ children?: React.ReactNode; color?: string }> = ({ children = '3D按钮', color = '#10b981' }) => (
  <button className="galaxy-3d-btn" style={{ '--3d-color': color } as React.CSSProperties}>{children}
    <style>{`
      .galaxy-3d-btn { padding: 12px 30px; font-size: 14px; font-weight: 600; color: white; background: var(--3d-color); border: none; border-radius: 10px; cursor: pointer; position: relative; transition: all 0.1s; box-shadow: 0 6px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.2); }
      .galaxy-3d-btn:hover { transform: translateY(2px); box-shadow: 0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.2); }
      .galaxy-3d-btn:active { transform: translateY(6px); box-shadow: 0 0 0 rgba(0,0,0,0.3), 0 2px 5px rgba(0,0,0,0.2); }
    `}</style>
  </button>
);

// 5. 渐变按钮
export const GalaxyGradientButton: React.FC<{ children?: React.ReactNode }> = ({ children = '渐变按钮' }) => (
  <button className="galaxy-gradient-btn">{children}
    <style>{`
      .galaxy-gradient-btn { padding: 12px 28px; font-size: 14px; font-weight: 600; color: white; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 12px; cursor: pointer; position: relative; transition: all 0.3s; overflow: hidden; }
      .galaxy-gradient-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); transition: left 0.5s; }
      .galaxy-gradient-btn:hover::before { left: 100%; }
      .galaxy-gradient-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102,126,234,0.4); }
    `}</style>
  </button>
);

// 6. 玻璃态按钮
export const GalaxyGlassButton: React.FC<{ children?: React.ReactNode }> = ({ children = '玻璃态按钮' }) => (
  <button className="galaxy-glass-btn">{children}
    <style>{`
      .galaxy-glass-btn { padding: 12px 28px; font-size: 14px; font-weight: 600; color: white; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; cursor: pointer; transition: all 0.3s; }
      .galaxy-glass-btn:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    `}</style>
  </button>
);

// 7. 滑动填充按钮
export const GalaxySlideButton: React.FC<{ children?: React.ReactNode; color?: string }> = ({ children = '滑动填充', color = '#f59e0b' }) => (
  <button className="galaxy-slide-btn" style={{ '--slide-color': color } as React.CSSProperties}>
    <span className="galaxy-slide-text">{children}</span>
    <style>{`
      .galaxy-slide-btn { position: relative; padding: 12px 28px; font-size: 14px; font-weight: 600; color: var(--slide-color); background: transparent; border: 2px solid var(--slide-color); border-radius: 10px; cursor: pointer; overflow: hidden; transition: color 0.3s; z-index: 1; }
      .galaxy-slide-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: var(--slide-color); transition: left 0.3s; z-index: -1; }
      .galaxy-slide-btn:hover::before { left: 0; }
      .galaxy-slide-btn:hover { color: white; }
    `}</style>
  </button>
);

// 8. 脉冲按钮
export const GalaxyPulseButton: React.FC<{ children?: React.ReactNode; color?: string }> = ({ children = '脉冲按钮', color = '#ef4444' }) => (
  <button className="galaxy-pulse-btn" style={{ '--pulse-color': color } as React.CSSProperties}>{children}
    <style>{`
      .galaxy-pulse-btn { padding: 12px 28px; font-size: 14px; font-weight: 600; color: white; background: var(--pulse-color); border: none; border-radius: 10px; cursor: pointer; position: relative; }
      .galaxy-pulse-btn::before { content: ''; position: absolute; inset: 0; background: var(--pulse-color); border-radius: 10px; animation: galaxy-pulse 1.5s ease-out infinite; z-index: -1; }
      @keyframes galaxy-pulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.5); opacity: 0; } }
    `}</style>
  </button>
);

// 9. 玻璃态卡片
export const GalaxyGlassCard: React.FC<{ title?: string; content?: string }> = ({ title = '玻璃态卡片', content = '这是一个玻璃态效果的卡片组件，带有模糊背景和半透明边框。' }) => (
  <div className="galaxy-glass-card">
    <h3 className="galaxy-glass-card-title">{title}</h3>
    <p className="galaxy-glass-card-content">{content}</p>
    <style>{`
      .galaxy-glass-card { padding: 20px; background: rgba(255,255,255,0.08); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; min-width: 240px; max-width: 300px; font-family: 'Inter', sans-serif; }
      .galaxy-glass-card-title { margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: white; }
      .galaxy-glass-card-content { margin: 0; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; }
    `}</style>
  </div>
);

// 10. 渐变边框卡片
export const GalaxyGradientCard: React.FC<{ title?: string; content?: string }> = ({ title = '渐变卡片', content = '带有渐变边框效果的卡片，悬停时有光效流动。' }) => (
  <div className="galaxy-gradient-card">
    <div className="galaxy-gradient-card-inner">
      <h3 className="galaxy-gradient-card-title">{title}</h3>
      <p className="galaxy-gradient-card-content">{content}</p>
    </div>
    <style>{`
      .galaxy-gradient-card { position: relative; padding: 2px; border-radius: 16px; background: linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899); min-width: 240px; max-width: 300px; }
      .galaxy-gradient-card-inner { padding: 20px; background: #1a1a2e; border-radius: 14px; font-family: 'Inter', sans-serif; }
      .galaxy-gradient-card-title { margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: white; }
      .galaxy-gradient-card-content { margin: 0; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; }
    `}</style>
  </div>
);

// 11. 霓虹卡片
export const GalaxyNeonCard: React.FC<{ title?: string; content?: string; color?: string }> = ({ title = '霓虹卡片', content = '带有霓虹发光效果的卡片组件。', color = '#00ffff' }) => (
  <div className="galaxy-neon-card" style={{ '--neon-card-color': color } as React.CSSProperties}>
    <h3 className="galaxy-neon-card-title">{title}</h3>
    <p className="galaxy-neon-card-content">{content}</p>
    <style>{`
      .galaxy-neon-card { padding: 20px; background: rgba(0,0,0,0.6); border: 1px solid var(--neon-card-color); border-radius: 12px; min-width: 240px; max-width: 300px; box-shadow: 0 0 20px var(--neon-card-color), inset 0 0 20px rgba(0,255,255,0.05); font-family: 'Inter', sans-serif; }
      .galaxy-neon-card-title { margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: var(--neon-card-color); text-shadow: 0 0 10px var(--neon-card-color); }
      .galaxy-neon-card-content { margin: 0; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; }
    `}</style>
  </div>
);

// 12. 个人资料卡片
export const GalaxyProfileCard: React.FC<{ name?: string; role?: string }> = ({ name = '张三', role = '产品设计师' }) => (
  <div className="galaxy-profile-card">
    <div className="galaxy-profile-avatar">{name.charAt(0)}</div>
    <h3 className="galaxy-profile-name">{name}</h3>
    <p className="galaxy-profile-role">{role}</p>
    <div className="galaxy-profile-stats">
      <div className="galaxy-profile-stat"><span className="galaxy-profile-stat-num">128</span><span className="galaxy-profile-stat-label">项目</span></div>
      <div className="galaxy-profile-stat"><span className="galaxy-profile-stat-num">2.4k</span><span className="galaxy-profile-stat-label">粉丝</span></div>
      <div className="galaxy-profile-stat"><span className="galaxy-profile-stat-num">96</span><span className="galaxy-profile-stat-label">关注</span></div>
    </div>
    <style>{`
      .galaxy-profile-card { padding: 24px; background: linear-gradient(135deg, #1e1e2e, #2d2d44); border-radius: 16px; min-width: 240px; max-width: 280px; text-align: center; font-family: 'Inter', sans-serif; border: 1px solid rgba(255,255,255,0.1); }
      .galaxy-profile-avatar { width: 64px; height: 64px; margin: 0 auto 12px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white; }
      .galaxy-profile-name { margin: 0 0 2px 0; font-size: 18px; font-weight: 700; color: white; }
      .galaxy-profile-role { margin: 0 0 16px 0; font-size: 12px; color: rgba(255,255,255,0.5); }
      .galaxy-profile-stats { display: flex; justify-content: space-around; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); }
      .galaxy-profile-stat { display: flex; flex-direction: column; gap: 2px; }
      .galaxy-profile-stat-num { font-size: 16px; font-weight: 700; color: white; }
      .galaxy-profile-stat-label { font-size: 10px; color: rgba(255,255,255,0.5); }
    `}</style>
  </div>
);

// 13. 旋转加载器
export const GalaxySpinnerLoader: React.FC<{ color?: string; size?: number }> = ({ color = '#06b6d4', size = 48 }) => (
  <div className="galaxy-spinner" style={{ width: size, height: size, '--spinner-color': color } as React.CSSProperties}>
    <style>{`
      .galaxy-spinner { border: 3px solid rgba(6,182,212,0.2); border-top: 3px solid var(--spinner-color); border-radius: 50%; animation: galaxy-spin 1s linear infinite; }
      @keyframes galaxy-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `}</style>
  </div>
);

// 14. 跳动点加载器
export const GalaxyDotsLoader: React.FC<{ color?: string }> = ({ color = '#8b5cf6' }) => (
  <div className="galaxy-dots-loader" style={{ '--dots-color': color } as React.CSSProperties}>
    <div className="galaxy-dot galaxy-dot-1"></div>
    <div className="galaxy-dot galaxy-dot-2"></div>
    <div className="galaxy-dot galaxy-dot-3"></div>
    <style>{`
      .galaxy-dots-loader { display: flex; gap: 8px; align-items: center; }
      .galaxy-dot { width: 12px; height: 12px; background: var(--dots-color); border-radius: 50%; animation: galaxy-bounce 1.4s ease-in-out infinite both; }
      .galaxy-dot-1 { animation-delay: -0.32s; }
      .galaxy-dot-2 { animation-delay: -0.16s; }
      @keyframes galaxy-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    `}</style>
  </div>
);

// 15. 环形加载器
export const GalaxyRingLoader: React.FC<{ color?: string; size?: number }> = ({ color = '#a855f7', size = 48 }) => (
  <div className="galaxy-ring-loader" style={{ width: size, height: size, '--ring-color': color } as React.CSSProperties}>
    <style>{`
      .galaxy-ring-loader { border: 3px solid rgba(168,85,247,0.2); border-top: 3px solid var(--ring-color); border-right: 3px solid var(--ring-color); border-radius: 50%; animation: galaxy-ring-spin 1s linear infinite; }
      @keyframes galaxy-ring-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `}</style>
  </div>
);

// 16. 双环加载器
export const GalaxyDoubleRingLoader: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <div className="galaxy-double-ring" style={{ width: size, height: size }}>
    <div className="galaxy-double-ring-outer"></div>
    <div className="galaxy-double-ring-inner"></div>
    <style>{`
      .galaxy-double-ring { position: relative; }
      .galaxy-double-ring-outer { position: absolute; inset: 0; border: 3px solid transparent; border-top: 3px solid #06b6d4; border-radius: 50%; animation: galaxy-dr-spin 1s linear infinite; }
      .galaxy-double-ring-inner { position: absolute; inset: 6px; border: 3px solid transparent; border-bottom: 3px solid #ec4899; border-radius: 50%; animation: galaxy-dr-spin 0.8s linear infinite reverse; }
      @keyframes galaxy-dr-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `}</style>
  </div>
);

// 17. 波浪加载器
export const GalaxyWaveLoader: React.FC<{ color?: string }> = ({ color = '#10b981' }) => (
  <div className="galaxy-wave-loader" style={{ '--wave-color': color } as React.CSSProperties}>
    <div className="galaxy-wave-bar galaxy-wave-1"></div>
    <div className="galaxy-wave-bar galaxy-wave-2"></div>
    <div className="galaxy-wave-bar galaxy-wave-3"></div>
    <div className="galaxy-wave-bar galaxy-wave-4"></div>
    <div className="galaxy-wave-bar galaxy-wave-5"></div>
    <style>{`
      .galaxy-wave-loader { display: flex; gap: 4px; align-items: center; height: 40px; }
      .galaxy-wave-bar { width: 6px; height: 100%; background: var(--wave-color); border-radius: 3px; animation: galaxy-wave 1.2s ease-in-out infinite; }
      .galaxy-wave-1 { animation-delay: 0s; }
      .galaxy-wave-2 { animation-delay: 0.1s; }
      .galaxy-wave-3 { animation-delay: 0.2s; }
      .galaxy-wave-4 { animation-delay: 0.3s; }
      .galaxy-wave-5 { animation-delay: 0.4s; }
      @keyframes galaxy-wave { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
    `}</style>
  </div>
);

// 18. 成功通知
export const GalaxySuccessNotification: React.FC<{ title?: string; message?: string }> = ({ title = '操作成功', message = '您的操作已成功完成。' }) => (
  <div className="galaxy-notify galaxy-notify-success">
    <div className="galaxy-notify-icon galaxy-notify-icon-success">✓</div>
    <div className="galaxy-notify-content">
      <h4 className="galaxy-notify-title galaxy-notify-title-success">{title}</h4>
      <p className="galaxy-notify-msg">{message}</p>
    </div>
    <style>{notifyStyles + `
      .galaxy-notify-success { background: rgba(16,185,129,0.15); border-left: 4px solid #10b981; }
      .galaxy-notify-icon-success { background: #10b981 !important; }
      .galaxy-notify-title-success { color: #10b981 !important; }
    `}</style>
  </div>
);

// 19. 错误通知
export const GalaxyErrorNotification: React.FC<{ title?: string; message?: string }> = ({ title = '操作失败', message = '操作过程中出现错误，请重试。' }) => (
  <div className="galaxy-notify galaxy-notify-error">
    <div className="galaxy-notify-icon galaxy-notify-icon-error">✕</div>
    <div className="galaxy-notify-content">
      <h4 className="galaxy-notify-title galaxy-notify-title-error">{title}</h4>
      <p className="galaxy-notify-msg">{message}</p>
    </div>
    <style>{notifyStyles + `
      .galaxy-notify-error { background: rgba(239,68,68,0.15); border-left: 4px solid #ef4444; }
      .galaxy-notify-icon-error { background: #ef4444 !important; }
      .galaxy-notify-title-error { color: #ef4444 !important; }
    `}</style>
  </div>
);

// 20. 警告通知
export const GalaxyWarningNotification: React.FC<{ title?: string; message?: string }> = ({ title = '警告', message = '请注意，这是一个警告提示。' }) => (
  <div className="galaxy-notify galaxy-notify-warning">
    <div className="galaxy-notify-icon galaxy-notify-icon-warning">⚠</div>
    <div className="galaxy-notify-content">
      <h4 className="galaxy-notify-title galaxy-notify-title-warning">{title}</h4>
      <p className="galaxy-notify-msg">{message}</p>
    </div>
    <style>{notifyStyles + `
      .galaxy-notify-warning { background: rgba(245,158,11,0.15); border-left: 4px solid #f59e0b; }
      .galaxy-notify-icon-warning { background: #f59e0b !important; }
      .galaxy-notify-title-warning { color: #f59e0b !important; }
    `}</style>
  </div>
);

// 21. 信息通知
export const GalaxyInfoNotification: React.FC<{ title?: string; message?: string }> = ({ title = '信息', message = '这是一条信息提示。' }) => (
  <div className="galaxy-notify galaxy-notify-info">
    <div className="galaxy-notify-icon galaxy-notify-icon-info">ℹ</div>
    <div className="galaxy-notify-content">
      <h4 className="galaxy-notify-title galaxy-notify-title-info">{title}</h4>
      <p className="galaxy-notify-msg">{message}</p>
    </div>
    <style>{notifyStyles + `
      .galaxy-notify-info { background: rgba(59,130,246,0.15); border-left: 4px solid #3b82f6; }
      .galaxy-notify-icon-info { background: #3b82f6 !important; }
      .galaxy-notify-title-info { color: #3b82f6 !important; }
    `}</style>
  </div>
);

// 22. 开关
export const GalaxyToggleSwitch: React.FC<{ defaultOn?: boolean; value?: boolean; onDataChange?: (patch: Record<string, any>) => void; disabled?: boolean }> = ({ defaultOn = true, value, onDataChange, disabled = false }) => {
  const [on, setOn] = React.useState(value ?? defaultOn);
  React.useEffect(() => { if (value !== undefined) setOn(value); }, [value]);
  const toggle = () => { if (disabled) return; const next = !on; setOn(next); onDataChange?.({ checked: next, value: next }); };
  return (
    <div className={`galaxy-toggle ${on ? 'galaxy-toggle-on' : ''}`} role="switch" aria-checked={on} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }}>
      <div className="galaxy-toggle-knob"></div>
      <style>{`
        .galaxy-toggle { width: 52px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 14px; position: relative; cursor: pointer; transition: background 0.3s; }
        .galaxy-toggle-on { background: linear-gradient(135deg, #06b6d4, #8b5cf6); }
        .galaxy-toggle-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; background: white; border-radius: 50%; transition: transform 0.3s; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
        .galaxy-toggle-on .galaxy-toggle-knob { transform: translateX(24px); }
      `}</style>
    </div>
  );
};

// 23. 渐变进度条
export const GalaxyGradientProgress: React.FC<{ value?: number; color?: string }> = ({ value = 65, color = '#06b6d4' }) => (
  <div className="galaxy-progress-wrap">
    <div className="galaxy-progress-bar">
      <div className="galaxy-progress-fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}, #a855f7)` }} />
    </div>
    <span className="galaxy-progress-text">{value}%</span>
    <style>{`
      .galaxy-progress-wrap { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 200px; }
      .galaxy-progress-bar { flex: 1; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; }
      .galaxy-progress-fill { height: 100%; border-radius: 5px; transition: width 0.5s ease; box-shadow: 0 0 10px rgba(6,182,212,0.5); }
      .galaxy-progress-text { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.8); min-width: 40px; text-align: right; }
    `}</style>
  </div>
);

// 24. 进度环
export const GalaxyProgressRing: React.FC<{ value?: number; size?: number; color?: string }> = ({ value = 75, size = 80, color = '#06b6d4' }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="galaxy-ring-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <span className="galaxy-ring-progress-text">{value}%</span>
      <style>{`
        .galaxy-ring-progress { position: relative; display: flex; align-items: center; justify-content: center; }
        .galaxy-ring-progress-text { position: absolute; font-size: 14px; font-weight: 700; color: white; }
      `}</style>
    </div>
  );
};

// 25. 实心徽章
export const GalaxySolidBadge: React.FC<{ children?: React.ReactNode; color?: string }> = ({ children = '新功能', color = '#06b6d4' }) => (
  <span className="galaxy-badge galaxy-badge-solid" style={{ background: color }}>{children}
    <style>{`
      .galaxy-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
      .galaxy-badge-solid { color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    `}</style>
  </span>
);

// 26. 描边徽章
export const GalaxyOutlineBadge: React.FC<{ children?: React.ReactNode; color?: string }> = ({ children = '已完成', color = '#10b981' }) => (
  <span className="galaxy-badge galaxy-badge-outline" style={{ color, borderColor: color }}>{children}
    <style>{`
      .galaxy-badge-outline { background: transparent; border: 2px solid; }
    `}</style>
  </span>
);

// 27. 输入框
export const GalaxyInput: React.FC<{ placeholder?: string; label?: string; value?: string; defaultValue?: string; readOnly?: boolean; onDataChange?: (patch: Record<string, any>) => void }> = ({ placeholder = '请输入...', label, value, defaultValue = '', readOnly = false, onDataChange }) => (
  <div className="galaxy-input-wrap">
    {label && <label className="galaxy-input-label">{label}</label>}
    <input type="text" placeholder={placeholder} className="galaxy-input" value={value ?? undefined} defaultValue={value === undefined ? defaultValue : undefined} readOnly={readOnly} onChange={(event) => onDataChange?.({ content: event.target.value, value: event.target.value })} />
    <style>{`
      .galaxy-input-wrap { width: 100%; min-width: 200px; }
      .galaxy-input-label { display: block; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 6px; }
      .galaxy-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: white; font-size: 13px; outline: none; transition: all 0.3s; box-sizing: border-box; }
      .galaxy-input::placeholder { color: rgba(255,255,255,0.4); }
      .galaxy-input:focus { border-color: #06b6d4; box-shadow: 0 0 0 3px rgba(6,182,212,0.2); }
    `}</style>
  </div>
);

// 28. 滑块
export const GalaxySlider: React.FC<{ value?: number; color?: string; min?: number; max?: number; step?: number; onDataChange?: (patch: Record<string, any>) => void; disabled?: boolean }> = ({ value = 50, color = '#06b6d4', min = 0, max = 100, step = 1, onDataChange, disabled = false }) => {
  const [current, setCurrent] = React.useState(value);
  React.useEffect(() => setCurrent(value), [value]);
  const update = (next: number) => { setCurrent(next); onDataChange?.({ value: next }); };
  return <div className="galaxy-slider-wrap" style={{ '--slider-color': color } as React.CSSProperties}>
    <div className="galaxy-slider-track">
      <div className="galaxy-slider-fill" style={{ width: `${current}%` }}></div>
      <div className="galaxy-slider-thumb" style={{ left: `${current}%` }}></div>
      <input aria-label="slider" type="range" min={min} max={max} step={step} value={current} disabled={disabled} onChange={(event) => update(Number(event.target.value))} style={{ position: 'absolute', inset: '-10px 0', width: '100%', opacity: 0, cursor: disabled ? 'default' : 'pointer' }} />
    </div>
    <span className="galaxy-slider-value">{current}</span>
    <style>{`
      .galaxy-slider-wrap { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 200px; }
      .galaxy-slider-track { flex: 1; height: 6px; background: rgba(255,255,255,0.15); border-radius: 3px; position: relative; }
      .galaxy-slider-fill { height: 100%; background: var(--slider-color); border-radius: 3px; }
      .galaxy-slider-thumb { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; background: white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer; }
      .galaxy-slider-value { font-size: 13px; font-weight: 600; color: white; min-width: 30px; text-align: right; }
    `}</style>
  </div>;
};

// 29. 复选框
export const GalaxyCheckbox: React.FC<{ label?: string; defaultChecked?: boolean; checked?: boolean; onDataChange?: (patch: Record<string, any>) => void }> = ({ label = '选项', defaultChecked = true, checked: checkedProp, onDataChange }) => {
  const [checked, setChecked] = React.useState(checkedProp ?? defaultChecked);
  React.useEffect(() => { if (checkedProp !== undefined) setChecked(checkedProp); }, [checkedProp]);
  const toggle = () => { const next = !checked; setChecked(next); onDataChange?.({ checked: next, value: next }); };
  return (
    <div className="galaxy-checkbox-wrap" role="checkbox" aria-checked={checked} tabIndex={0} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }}>
      <div className={`galaxy-checkbox ${checked ? 'galaxy-checkbox-checked' : ''}`}>
        {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </div>
      <span className="galaxy-checkbox-label">{label}</span>
      <style>{`
        .galaxy-checkbox-wrap { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .galaxy-checkbox { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-radius: 5px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .galaxy-checkbox-checked { background: linear-gradient(135deg, #06b6d4, #8b5cf6); border-color: transparent; }
        .galaxy-checkbox-label { font-size: 13px; color: rgba(255,255,255,0.8); }
      `}</style>
    </div>
  );
};

// 30. 单选按钮
export const GalaxyRadio: React.FC<{ label?: string; defaultChecked?: boolean; checked?: boolean; onDataChange?: (patch: Record<string, any>) => void }> = ({ label = '选项', defaultChecked = true, checked: checkedProp, onDataChange }) => {
  const [checked, setChecked] = React.useState(checkedProp ?? defaultChecked);
  React.useEffect(() => { if (checkedProp !== undefined) setChecked(checkedProp); }, [checkedProp]);
  const toggle = () => { const next = !checked; setChecked(next); onDataChange?.({ checked: next, value: next }); };
  return (
    <div className="galaxy-radio-wrap" role="radio" aria-checked={checked} tabIndex={0} onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }}>
      <div className={`galaxy-radio ${checked ? 'galaxy-radio-checked' : ''}`}>
        {checked && <div className="galaxy-radio-dot"></div>}
      </div>
      <span className="galaxy-radio-label">{label}</span>
      <style>{`
        .galaxy-radio-wrap { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .galaxy-radio { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .galaxy-radio-checked { border-color: #06b6d4; }
        .galaxy-radio-dot { width: 10px; height: 10px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); border-radius: 50%; }
        .galaxy-radio-label { font-size: 13px; color: rgba(255,255,255,0.8); }
      `}</style>
    </div>
  );
};

// 31. 头像
export const GalaxyAvatar: React.FC<{ name?: string; size?: number; color?: string }> = ({ name = '用户', size = 48, color = '#06b6d4' }) => (
  <div className="galaxy-avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${color}, #8b5cf6)` }}>
    {name.charAt(0).toUpperCase()}
    <style>{`
      .galaxy-avatar { border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    `}</style>
  </div>
);

// 32. 评分
export const GalaxyRating: React.FC<{ value?: number; max?: number }> = ({ value = 4, max = 5 }) => (
  <div className="galaxy-rating">
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} className={`galaxy-star ${i < value ? 'galaxy-star-filled' : ''}`}>★</span>
    ))}
    <style>{`
      .galaxy-rating { display: flex; gap: 4px; }
      .galaxy-star { font-size: 20px; color: rgba(255,255,255,0.2); transition: color 0.2s; }
      .galaxy-star-filled { color: #f59e0b; text-shadow: 0 0 8px rgba(245,158,11,0.5); }
    `}</style>
  </div>
);

// 33. 标签页
export const GalaxyTabs: React.FC<{ tabs?: string[] }> = ({ tabs = ['首页', '产品', '关于'] }) => {
  const [active, setActive] = React.useState(0);
  return (
    <div className="galaxy-tabs">
      {tabs.map((tab, i) => (
        <button key={i} className={`galaxy-tab ${i === active ? 'galaxy-tab-active' : ''}`} onClick={() => setActive(i)}>{tab}</button>
      ))}
      <style>{`
        .galaxy-tabs { display: flex; gap: 4px; padding: 4px; background: rgba(255,255,255,0.08); border-radius: 10px; }
        .galaxy-tab { padding: 8px 16px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); background: transparent; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .galaxy-tab-active { color: white; background: linear-gradient(135deg, #06b6d4, #8b5cf6); box-shadow: 0 2px 8px rgba(6,182,212,0.3); }
      `}</style>
    </div>
  );
};

// 34. 分隔线
export const GalaxyDivider: React.FC<{ text?: string }> = ({ text }) => (
  <div className="galaxy-divider">
    {text ? (
      <>
        <div className="galaxy-divider-line"></div>
        <span className="galaxy-divider-text">{text}</span>
        <div className="galaxy-divider-line"></div>
      </>
    ) : (
      <div className="galaxy-divider-line-full"></div>
    )}
    <style>{`
      .galaxy-divider { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 200px; }
      .galaxy-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.15); }
      .galaxy-divider-line-full { width: 100%; height: 1px; background: rgba(255,255,255,0.15); }
      .galaxy-divider-text { font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap; }
    `}</style>
  </div>
);

// 35. 工具提示
export const GalaxyTooltip: React.FC<{ text?: string; children?: React.ReactNode }> = ({ text = '这是一个提示', children = '悬停查看' }) => (
  <div className="galaxy-tooltip-wrap">
    <span className="galaxy-tooltip-trigger">{children}</span>
    <div className="galaxy-tooltip-bubble">{text}</div>
    <style>{`
      .galaxy-tooltip-wrap { position: relative; display: inline-block; }
      .galaxy-tooltip-trigger { font-size: 13px; color: rgba(255,255,255,0.8); cursor: help; border-bottom: 1px dashed rgba(255,255,255,0.3); }
      .galaxy-tooltip-bubble { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); padding: 8px 12px; background: rgba(0,0,0,0.9); color: white; font-size: 12px; border-radius: 8px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
      .galaxy-tooltip-bubble::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: rgba(0,0,0,0.9); }
      .galaxy-tooltip-wrap:hover .galaxy-tooltip-bubble { opacity: 1; }
    `}</style>
  </div>
);

// 36. 图标组件
export const GalaxyIconComponent: React.FC<{ iconName?: string; color?: string; size?: number }> = ({ iconName = 'star', color = '#f59e0b', size = 48 }) => {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  </div>;
};

// ============================================
// UI 组件类型定义与渲染器
// ============================================

/**
 * First consumer of the platform-level continuous interaction contract. The
 * renderer remains independent of scene routing and only emits crossed nodes.
 */
export const GalaxyMultiStageSlider: React.FC<{
  continuousInteraction?: ContinuousInteractionConfig;
  color?: string;
  variant?: 'glossy' | 'glossy-bare' | 'threshold' | 'threshold-bare' | 'segments' | 'timeline' | 'timeline-bare';
  interactive?: boolean;
  locked?: boolean;
  onContinuousNodeTrigger?: (node: ContinuousInteractionNode) => void;
}> = ({ continuousInteraction, color = '#38bdf8', variant = 'timeline', interactive = false, locked = false, onContinuousNodeTrigger }) => {
  const config = normalizeContinuousInteraction(continuousInteraction);
  const configSignature = JSON.stringify(config);
  const [value, setValue] = React.useState(0);
  const [focused, setFocused] = React.useState(false);
  const firedRef = React.useRef(new Set<string>());
  const previousValueRef = React.useRef(0);

  React.useEffect(() => {
    setValue(0);
    previousValueRef.current = 0;
    firedRef.current.clear();
  }, [configSignature]);

  const updateValue = (next: number) => {
    const previous = previousValueRef.current;
    const normalized = Math.max(0, Math.min(100, next));
    if (normalized < previous) {
      // A small hysteresis band prevents a shaky hand from re-triggering a node.
      config.nodes.forEach((node) => {
        if (node.retrigger === 'on-reenter' && normalized < node.position - 3) firedRef.current.delete(node.id);
      });
    }
    if (normalized > previous) {
      getCrossedContinuousNodes(previous, normalized, config).forEach((node) => {
        if (node.role === 'start' || (config.mode === 'confirm' && node.role === 'checkpoint')) return;
        if (!node.interaction || node.interaction.action === 'none') return;
        if (node.retrigger !== 'every-crossing' && firedRef.current.has(node.id)) return;
        firedRef.current.add(node.id);
        onContinuousNodeTrigger?.(node);
      });
    }
    previousValueRef.current = normalized;
    setValue(normalized);
  };

  const currentNode = [...config.nodes].reverse().find((node) => node.position <= value) || config.nodes[0];
  const completed = value >= 100;
  const presentationNodes = config.nodes.length === 2
    ? [config.nodes[0], { id: 'presentation-midpoint', position: 50, role: 'checkpoint' as const, label: '中段' }, config.nodes[1]]
    : config.nodes;
  const railNodes = variant === 'segments'
    ? Array.from({ length: 18 }, (_, index) => ({ id: `segment-${index}`, position: (index / 17) * 100, role: 'checkpoint' as const, label: '' }))
    : presentationNodes;
  return (
    <div
      className={`aether-continuous-slider aether-continuous-slider--${variant} ${focused ? 'is-focused' : ''} ${locked ? 'is-locked' : ''}`}
      style={{ '--continuous-accent': color, '--continuous-progress': `${value}%` } as React.CSSProperties}
    >
      <div className="aether-continuous-slider__copy">
        <span>{completed ? '已完成' : config.label}</span>
        <b>{variant === 'glossy' || variant === 'glossy-bare' ? `${Math.round(value)}%` : currentNode.label || `${Math.round(value)}%`}</b>
      </div>
      <div className="aether-continuous-slider__rail">
        <i className="aether-continuous-slider__fill" />
        {railNodes.map((node) => {
          const active = value >= node.position;
          return <span key={node.id} className={`aether-continuous-slider__node ${active ? 'is-active' : ''} ${node.role}`} style={{ left: `${node.position}%` }} title={node.label || node.role}>
            {(variant === 'timeline' || variant === 'timeline-bare') && <MapPin className="aether-continuous-slider__pin" size={22} strokeWidth={2.4} aria-hidden="true" />}
            {(variant === 'timeline' || variant === 'timeline-bare') && <em>{node.label || (node.role === 'start' ? 'START' : node.role === 'end' ? 'COMPLETE' : `${node.position}%`)}</em>}
          </span>;
        })}
        <span className="aether-continuous-slider__thumb" style={{ left: `${value}%` }} />
        <input
          aria-label={config.label}
          aria-valuetext={`${currentNode.label || Math.round(value)}，${Math.round(value)}%`}
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          disabled={!interactive || locked || config.enabled === false}
          onChange={(event) => updateValue(Number(event.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      <style>{`
        .aether-continuous-slider{box-sizing:border-box;width:340px;height:80px;padding:11px 14px 12px;border:1px solid color-mix(in srgb,var(--continuous-accent) 34%,rgba(148,163,184,.3));border-radius:8px;background:linear-gradient(145deg,rgba(12,22,38,.94),rgba(7,13,24,.92));box-shadow:inset 0 1px rgba(255,255,255,.08),0 10px 22px rgba(0,0,0,.22);font-family:inherit;color:#eaf6ff;user-select:none}.aether-continuous-slider.is-focused{outline:2px solid color-mix(in srgb,var(--continuous-accent) 76%,white);outline-offset:3px}.aether-continuous-slider.is-locked{opacity:.7}.aether-continuous-slider__copy{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;font-size:12px;line-height:1}.aether-continuous-slider__copy span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d8e8}.aether-continuous-slider__copy b{flex:none;color:var(--continuous-accent);font-size:11px}.aether-continuous-slider__rail{position:relative;height:28px;display:flex;align-items:center}.aether-continuous-slider__rail::before,.aether-continuous-slider__fill{position:absolute;left:0;right:0;height:4px;border-radius:99px;content:''}.aether-continuous-slider__rail::before{background:rgba(148,163,184,.2)}.aether-continuous-slider__fill{right:auto;width:var(--continuous-progress);background:var(--continuous-accent);box-shadow:0 0 12px color-mix(in srgb,var(--continuous-accent) 65%,transparent);transition:width 180ms ease-out}.aether-continuous-slider__node{position:absolute;z-index:2;top:50%;width:10px;height:10px;border:2px solid #0c1626;border-radius:50%;background:#718096;transform:translate(-50%,-50%);transition:background 180ms ease,box-shadow 180ms ease}.aether-continuous-slider__node.is-active{background:var(--continuous-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--continuous-accent) 23%,transparent),0 0 10px color-mix(in srgb,var(--continuous-accent) 60%,transparent)}.aether-continuous-slider__node.start,.aether-continuous-slider__node.end{width:12px;height:12px}.aether-continuous-slider__thumb{position:absolute;z-index:3;top:50%;width:22px;height:22px;border:2px solid rgba(255,255,255,.9);border-radius:50%;background:var(--continuous-accent);box-shadow:0 4px 12px rgba(0,0,0,.35),0 0 16px color-mix(in srgb,var(--continuous-accent) 60%,transparent);transform:translate(-50%,-50%);pointer-events:none;transition:left 180ms ease-out}.aether-continuous-slider__rail input{position:absolute;z-index:4;top:-8px;bottom:-8px;width:100%;height:auto;margin:0;cursor:ew-resize;opacity:0}.aether-continuous-slider__rail input:disabled{cursor:not-allowed}.aether-continuous-slider--glossy{height:72px;border-color:color-mix(in srgb,var(--continuous-accent) 60%,white);background:linear-gradient(180deg,rgba(20,42,64,.98),rgba(7,21,35,.98))}.aether-continuous-slider--glossy .aether-continuous-slider__rail::before{height:14px;border:1px solid color-mix(in srgb,var(--continuous-accent) 55%,white);background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,.06))}.aether-continuous-slider--glossy .aether-continuous-slider__fill{height:14px;background:linear-gradient(90deg,color-mix(in srgb,var(--continuous-accent) 65%,#22d3ee),var(--continuous-accent),color-mix(in srgb,var(--continuous-accent) 72%,#2563eb));box-shadow:inset 0 1px rgba(255,255,255,.42),0 0 14px color-mix(in srgb,var(--continuous-accent) 65%,transparent)}.aether-continuous-slider--glossy .aether-continuous-slider__node{display:none}.aether-continuous-slider--glossy .aether-continuous-slider__thumb{width:18px;height:18px}.aether-continuous-slider--threshold{height:82px;background:linear-gradient(145deg,rgba(16,23,43,.97),rgba(13,17,31,.97))}.aether-continuous-slider--threshold .aether-continuous-slider__rail::before{height:6px;background:repeating-linear-gradient(90deg,rgba(148,163,184,.24) 0 24%,transparent 24% 25%)}.aether-continuous-slider--threshold .aether-continuous-slider__fill{height:6px;background:linear-gradient(90deg,#a5b4fc,var(--continuous-accent))}.aether-continuous-slider--threshold .aether-continuous-slider__node{width:2px;height:18px;border:0;border-radius:0;background:rgba(226,232,240,.7);box-shadow:none}.aether-continuous-slider--threshold .aether-continuous-slider__node.is-active{background:var(--continuous-accent);box-shadow:0 0 9px color-mix(in srgb,var(--continuous-accent) 70%,transparent)}.aether-continuous-slider--threshold .aether-continuous-slider__node:not(.start):not(.end)::after{content:attr(title);position:absolute;top:-19px;left:50%;transform:translateX(-50%);font-size:8px;color:#b9c7d9;white-space:nowrap}.aether-continuous-slider--threshold .aether-continuous-slider__thumb{width:0;height:0;border:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:13px solid var(--continuous-accent);border-radius:0;background:transparent;box-shadow:none;transform:translate(-50%,-16px)}.aether-continuous-slider--segments{height:88px;background:linear-gradient(145deg,rgba(5,30,42,.98),rgba(6,20,34,.98))}.aether-continuous-slider--segments .aether-continuous-slider__rail{height:32px;gap:3px}.aether-continuous-slider--segments .aether-continuous-slider__rail::before,.aether-continuous-slider--segments .aether-continuous-slider__fill,.aether-continuous-slider--segments .aether-continuous-slider__thumb{display:none}.aether-continuous-slider--segments .aether-continuous-slider__node{position:relative;left:auto!important;top:auto;flex:1;height:28px;width:auto;border:2px solid color-mix(in srgb,var(--continuous-accent) 68%,#0d5060);border-radius:9px;background:rgba(8,36,49,.82);transform:none;box-shadow:none}.aether-continuous-slider--segments .aether-continuous-slider__node.is-active{background:var(--continuous-accent);box-shadow:0 0 12px color-mix(in srgb,var(--continuous-accent) 65%,transparent)}.aether-continuous-slider--segments .aether-continuous-slider__node.start,.aether-continuous-slider--segments .aether-continuous-slider__node.end{width:auto;height:28px}.aether-continuous-slider--segments .aether-continuous-slider__rail input{top:-6px;bottom:-6px}.aether-continuous-slider--timeline{height:106px;padding:12px 18px 15px;border-color:rgba(73,191,255,.32);background:linear-gradient(145deg,rgba(2,12,22,.98),rgba(5,15,30,.95))}.aether-continuous-slider--timeline .aether-continuous-slider__copy{display:none}.aether-continuous-slider--timeline .aether-continuous-slider__rail{height:76px}.aether-continuous-slider--timeline .aether-continuous-slider__rail::before,.aether-continuous-slider--timeline .aether-continuous-slider__fill{height:10px;border-radius:99px}.aether-continuous-slider--timeline .aether-continuous-slider__rail::before{background:linear-gradient(90deg,rgba(32,223,232,.28),rgba(76,75,255,.28))}.aether-continuous-slider--timeline .aether-continuous-slider__fill{background:linear-gradient(90deg,#2de5e7,var(--continuous-accent),#7c63ff)}.aether-continuous-slider--timeline .aether-continuous-slider__node{top:50%;width:24px;height:24px;border:3px solid #dff7ff;background:#13243b}.aether-continuous-slider--timeline .aether-continuous-slider__node.is-active{background:var(--continuous-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--continuous-accent) 22%,transparent),0 0 18px color-mix(in srgb,var(--continuous-accent) 65%,transparent)}.aether-continuous-slider--timeline .aether-continuous-slider__node.start,.aether-continuous-slider--timeline .aether-continuous-slider__node.end{width:26px;height:26px}.aether-continuous-slider--timeline .aether-continuous-slider__pin{position:absolute;left:50%;bottom:17px;transform:translateX(-50%);color:var(--continuous-accent);filter:drop-shadow(0 0 6px color-mix(in srgb,var(--continuous-accent) 80%,transparent))}.aether-continuous-slider--timeline .aether-continuous-slider__node em{position:absolute;top:25px;left:50%;transform:translateX(-50%);font-size:8px;font-style:normal;font-weight:700;letter-spacing:.13em;color:#c6d8e8;white-space:nowrap}.aether-continuous-slider--timeline .aether-continuous-slider__thumb{display:none}@media(prefers-reduced-motion:reduce){.aether-continuous-slider *{transition:none!important}}
      `}</style>
      <style>{`
        .aether-continuous-slider--timeline .aether-continuous-slider__pin,.aether-continuous-slider--timeline-bare .aether-continuous-slider__pin{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);color:var(--continuous-accent);filter:drop-shadow(0 0 6px color-mix(in srgb,var(--continuous-accent) 80%,transparent))}
        .aether-continuous-slider--timeline-bare{height:106px;padding:12px 18px 15px;border:0;background:transparent;box-shadow:none}
        .aether-continuous-slider--timeline-bare .aether-continuous-slider__copy{display:none}.aether-continuous-slider--timeline-bare .aether-continuous-slider__rail{height:76px}.aether-continuous-slider--timeline-bare .aether-continuous-slider__rail::before,.aether-continuous-slider--timeline-bare .aether-continuous-slider__fill{height:10px;border-radius:99px}.aether-continuous-slider--timeline-bare .aether-continuous-slider__rail::before{background:linear-gradient(90deg,rgba(32,223,232,.28),rgba(76,75,255,.28))}.aether-continuous-slider--timeline-bare .aether-continuous-slider__fill{background:linear-gradient(90deg,#2de5e7,var(--continuous-accent),#7c63ff)}.aether-continuous-slider--timeline-bare .aether-continuous-slider__node{top:50%;width:24px;height:24px;border:3px solid #dff7ff;background:#13243b}.aether-continuous-slider--timeline-bare .aether-continuous-slider__node.is-active{background:var(--continuous-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--continuous-accent) 22%,transparent),0 0 18px color-mix(in srgb,var(--continuous-accent) 65%,transparent)}.aether-continuous-slider--timeline-bare .aether-continuous-slider__node.start,.aether-continuous-slider--timeline-bare .aether-continuous-slider__node.end{width:26px;height:26px}.aether-continuous-slider--timeline-bare .aether-continuous-slider__node em{position:absolute;top:25px;left:50%;transform:translateX(-50%);font-size:8px;font-style:normal;font-weight:700;letter-spacing:.13em;color:#c6d8e8;white-space:nowrap}.aether-continuous-slider--timeline-bare .aether-continuous-slider__thumb{display:none}
        .aether-continuous-slider--glossy-bare{height:58px;padding:3px 0 6px;border:0;background:transparent;box-shadow:none}.aether-continuous-slider--glossy-bare .aether-continuous-slider__copy{margin:0 5px 7px;font-size:12px}.aether-continuous-slider--glossy-bare .aether-continuous-slider__copy span{color:#b9dcff}.aether-continuous-slider--glossy-bare .aether-continuous-slider__copy b{color:var(--continuous-accent);font-size:14px}.aether-continuous-slider--glossy-bare .aether-continuous-slider__rail{height:18px}.aether-continuous-slider--glossy-bare .aether-continuous-slider__rail::before{height:14px;border:1px solid color-mix(in srgb,var(--continuous-accent) 66%,white);background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.04));box-shadow:inset 0 1px rgba(255,255,255,.32),0 0 8px color-mix(in srgb,var(--continuous-accent) 36%,transparent)}.aether-continuous-slider--glossy-bare .aether-continuous-slider__fill{height:14px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 1px,transparent 1px 7px),linear-gradient(90deg,#14c6f5,var(--continuous-accent),#2778e8);box-shadow:inset 0 1px rgba(255,255,255,.48),0 0 10px color-mix(in srgb,var(--continuous-accent) 56%,transparent)}.aether-continuous-slider--glossy-bare .aether-continuous-slider__node,.aether-continuous-slider--glossy-bare .aether-continuous-slider__thumb{display:none}
        .aether-continuous-slider--threshold-bare{height:64px;padding:5px 0;border:0;background:transparent;box-shadow:none}.aether-continuous-slider--threshold-bare .aether-continuous-slider__copy{display:none}.aether-continuous-slider--threshold-bare .aether-continuous-slider__rail{height:50px}.aether-continuous-slider--threshold-bare .aether-continuous-slider__rail::before{height:6px;background:repeating-linear-gradient(90deg,rgba(148,163,184,.22) 0 24%,transparent 24% 25%),rgba(226,232,240,.58)}.aether-continuous-slider--threshold-bare .aether-continuous-slider__fill{height:6px;background:linear-gradient(90deg,#b7c7ff,var(--continuous-accent));box-shadow:0 0 8px color-mix(in srgb,var(--continuous-accent) 28%,transparent)}.aether-continuous-slider--threshold-bare .aether-continuous-slider__node{width:1px;height:18px;border:0;border-radius:0;background:rgba(203,213,225,.8);box-shadow:none}.aether-continuous-slider--threshold-bare .aether-continuous-slider__node.is-active{background:var(--continuous-accent);box-shadow:0 0 8px color-mix(in srgb,var(--continuous-accent) 48%,transparent)}.aether-continuous-slider--threshold-bare .aether-continuous-slider__node:not(.start):not(.end)::after{content:attr(title);position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:8px;color:#cbd5e1;white-space:nowrap}.aether-continuous-slider--threshold-bare .aether-continuous-slider__thumb{width:0;height:0;border:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid var(--continuous-accent);border-radius:0;background:transparent;box-shadow:none;transform:translate(-50%,-15px)}
      `}</style>
    </div>
  );
};

type SciFiDashboardButtonVariant = 'neon-frame' | 'polygon' | 'node' | 'glow' | 'stripe';
type DashboardHeaderVariant = 'data' | 'visual' | 'blue';
type DashboardArrowVariant = 'circle-left' | 'circle-right' | 'triangle-left' | 'triangle-right' | 'rect-left' | 'rect-right' | 'glow-left' | 'glow-right' | 'glass-down';
type DashboardMetricIcon = 'lightning' | 'star' | 'bubble' | 'car' | 'user' | 'flask' | 'user-module' | 'flask-module' | 'hex-data';

export interface PatternPredictionPoint {
  xLabel: string;
  value: number;
}

const dashboardTextStyle = (data: any, fallbackColor: string, fallbackSize: number) => getTextStyle(
  { ...data, color: data.textColor || fallbackColor, textColor: data.textColor || fallbackColor } as SceneElement,
  { color: data.textColor || fallbackColor, fontSize: Number(data.fontSize) || fallbackSize, defaultLineHeight: Number(data.lineHeight) || 1.2 },
);

const DashboardSciFiButton: React.FC<{ variant: SciFiDashboardButtonVariant; data?: any }> = ({ variant, data = {} }) => {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : 'BUTTON';
  const value = Number(data.value);
  const scale = 1 + (Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) / 1000 : 0);
  const id = React.useId().replace(/:/g, '');
  const textStyle = dashboardTextStyle(data, '#e6f7ff', variant === 'polygon' ? 28 : 26);
  const width = variant === 'neon-frame' ? 320 : 420;
  const height = variant === 'neon-frame' ? 120 : 180;
  const shape = variant === 'neon-frame'
    ? <><rect x="20" y="20" width="280" height="80" rx="20" fill="none" stroke="#0066ff" strokeWidth="1.5" opacity=".65" /><rect x="24" y="24" width="272" height="72" rx="16" fill={`url(#${id}-panel)`} stroke="#0a204a" /><rect x="28" y="28" width="264" height="64" rx="12" fill="none" stroke="#00aaff" opacity=".25" /><rect x="24" y="24" width="272" height="72" rx="16" fill="none" stroke="#00d4ff" strokeWidth="3" strokeDasharray="145 20" /></>
    : variant === 'polygon'
      ? <><polygon points="60,20 360,20 400,90 360,160 60,160 20,90" fill="none" stroke="#0066ff" strokeWidth="1.5" opacity=".55" /><polygon points="65,30 355,30 385,90 355,150 65,150 35,90" fill={`url(#${id}-panel)`} stroke="#00baff" strokeWidth="3" /><polygon points="65,30 355,30 385,90 355,150 65,150 35,90" fill="none" stroke="#72f3ff" strokeWidth="1" strokeDasharray="30 12" /></>
      : variant === 'node'
        ? <><polygon points="60,22 360,22 395,90 360,158 60,158 25,90" fill={`url(#${id}-panel)`} stroke="#18dfff" strokeWidth="3" /><path d="M52 90H368M74 43L346 137M74 137L346 43" stroke="#00aaff" strokeWidth="1" opacity=".5" /><g fill="#aefcff" stroke="#00e5ff" strokeWidth="2"><circle cx="58" cy="90" r="7"/><circle cx="362" cy="90" r="7"/><circle cx="94" cy="44" r="5"/><circle cx="326" cy="136" r="5"/></g></>
        : variant === 'glow'
          ? <><rect x="24" y="24" width="372" height="132" rx="28" fill={`url(#${id}-panel)`} stroke="#35e9ff" strokeWidth="4" /><rect x="34" y="34" width="352" height="112" rx="22" fill="none" stroke="#006eff" strokeWidth="2" strokeDasharray="22 12" /><path d="M54 90H366" stroke="#86f8ff" strokeWidth="1" opacity=".55" /></>
          : <><rect x="28" y="28" width="364" height="124" rx="22" fill={`url(#${id}-panel)`} stroke="#0e8cff" strokeWidth="3" /><path d="M34 48H386M34 74H386M34 100H386M34 126H386" stroke="#00d8ff" strokeWidth="2" opacity=".5" strokeDasharray="18 14" /><rect x="40" y="40" width="340" height="100" rx="16" fill="none" stroke="#b3fbff" opacity=".4" /> </>;
  return <div className={`dashboard-scifi-button dashboard-scifi-button--${variant}`} style={{ '--dashboard-scale': scale } as React.CSSProperties}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible" aria-hidden="true" style={{ pointerEvents: 'none' }}><defs><linearGradient id={`${id}-panel`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a2557" stopOpacity=".9"/><stop offset="1" stopColor="#030814" stopOpacity=".82"/></linearGradient></defs><g filter={`url(#${id}-glow)`}>{shape}</g><defs><filter id={`${id}-glow`} x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
    <span className="dashboard-scifi-button__label" style={textStyle}>{label}</span>
    <style>{`.dashboard-scifi-button{position:relative;display:inline-flex;align-items:center;justify-content:center;transform:translateY(0) scale(var(--dashboard-scale));transform-origin:center;transition:transform .3s ease,filter .3s ease;filter:drop-shadow(0 14px 24px rgba(0,0,0,.5));overflow:visible}.dashboard-scifi-button:hover{transform:translateY(-4px) scale(var(--dashboard-scale));filter:drop-shadow(0 18px 30px rgba(0,170,255,.45))}.dashboard-scifi-button__label{position:absolute;max-width:80%;white-space:nowrap;text-transform:uppercase;text-align:center;letter-spacing:6px;font-style:italic;text-shadow:0 0 10px rgba(0,200,255,.9),0 0 22px rgba(0,120,255,.55);outline:none;cursor:default}.dashboard-scifi-button__label[contenteditable=true]{cursor:text;border-bottom:1px dashed transparent}.dashboard-scifi-button__label[contenteditable=true]:hover{border-color:#00e5ff;background:rgba(0,200,255,.08)}@media(prefers-reduced-motion:reduce){.dashboard-scifi-button,.dashboard-scifi-button__label{transition:none}}`}</style>
  </div>;
};

const DashboardHeader: React.FC<{ variant: DashboardHeaderVariant; data?: any }> = ({ variant, data = {} }) => {
  const title = typeof data.label === 'string' && data.label.trim() ? data.label : (variant === 'data' ? 'DATA VISUALIZATION' : variant === 'visual' ? 'VISUAL ANALYTICS' : 'SYSTEM OVERVIEW');
  const textStyle = dashboardTextStyle(data, '#d9fbff', variant === 'blue' ? 24 : 28);
  return <div className={`dashboard-header dashboard-header--${variant}`}><svg viewBox="0 0 1000 120" width="100%" height="100%" overflow="visible" aria-hidden="true" style={{ pointerEvents: 'none' }}><path d="M20 78H260L285 52H715L740 78H980" fill="none" stroke="#18dff5" strokeWidth="2" opacity=".8"/><path d="M80 92H920" fill="none" stroke="#2784ff" strokeWidth="1" opacity=".65"/><path d="M305 52H695" fill="none" stroke="#d5fbff" strokeWidth="4" opacity=".85"/><path d="M24 24H180M820 24H976" fill="none" stroke="#00e5ff" strokeWidth="2"/><path d="M42 20l-18 18 18 18M958 20l18 18-18 18" fill="none" stroke="#00e5ff" strokeWidth="2"/></svg><span style={textStyle}>{title}</span><style>{`.dashboard-header{position:relative;width:1000px;height:120px;display:flex;align-items:center;justify-content:center;overflow:visible}.dashboard-header svg{position:absolute;inset:0}.dashboard-header>span{position:relative;max-width:70%;white-space:nowrap;letter-spacing:5px;text-transform:uppercase;text-shadow:0 0 12px rgba(0,220,255,.65);outline:none}.dashboard-header--visual>svg path{stroke:#7b8bff}.dashboard-header--blue>svg path{stroke:#4fa8ff}.dashboard-header>span[contenteditable=true]{cursor:text;border-bottom:1px dashed transparent}.dashboard-header>span[contenteditable=true]:hover{border-color:#00e5ff;background:rgba(0,229,255,.08)}`}</style></div>;
};

const DashboardArrow: React.FC<{ variant: DashboardArrowVariant; data?: any }> = ({ variant, data = {} }) => {
  const color = data.color || (variant.includes('glow') ? '#00e5ff' : '#78eaff');
  const isDown = variant === 'glass-down';
  const shape = isDown
    ? <><polygon points="110,28 172,28 172,108 204,108 141,182 78,108 110,108" fill="rgba(46,177,255,.22)" stroke="#b5f5ff" strokeWidth="3"/><polygon points="118,38 164,38 164,116 184,116 141,166 98,116 118,116" fill="rgba(23,104,194,.28)" stroke="#39caff" strokeWidth="2"/></>
    : variant.includes('triangle')
      ? <polygon points={variant.endsWith('left') ? '92,18 22,100 92,182' : '48,18 118,100 48,182'} fill={color} opacity=".9" />
      : variant.includes('rect')
        ? <><rect x="32" y="32" width="136" height="136" rx="10" fill="none" stroke={color} strokeWidth="4"/><path d={variant.endsWith('left') ? 'M112 58L68 100l44 42' : 'M88 58l44 42-44 42'} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/></>
        : <><circle cx="100" cy="100" r="74" fill="none" stroke={color} strokeWidth="4" opacity=".7"/><path d={variant.endsWith('left') ? 'M112 58L70 100l42 42' : 'M88 58l42 42-42 42'} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/></>;
  return <div className={`dashboard-arrow dashboard-arrow--${variant}`} style={{ '--dashboard-arrow-color': color } as React.CSSProperties}><svg viewBox={isDown ? '0 0 282 210' : '0 0 200 200'} width={isDown ? 220 : 160} height={isDown ? 170 : 160} overflow="visible" aria-hidden="true" style={{ pointerEvents: 'none' }}>{shape}</svg><style>{`.dashboard-arrow{display:grid;place-items:center;overflow:visible;transition:transform .25s ease,filter .25s ease;filter:drop-shadow(0 0 10px color-mix(in srgb,var(--dashboard-arrow-color) 50%,transparent))}.dashboard-arrow:hover{transform:translateY(-3px) scale(1.03);filter:drop-shadow(0 0 18px color-mix(in srgb,var(--dashboard-arrow-color) 75%,transparent))}.dashboard-arrow--glass-down{width:220px;height:180px}.dashboard-arrow--glow-left svg,.dashboard-arrow--glow-right svg{filter:drop-shadow(0 0 8px var(--dashboard-arrow-color))}`}</style></div>;
};

const DashboardPeopleCount: React.FC<{ variant: 'blue' | 'green'; data?: any }> = ({ variant, data = {} }) => {
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : '人员总数';
  const value = Number.isFinite(Number(data.value)) ? Number(data.value) : 5260;
  const accent = variant === 'green' ? '#43e97b' : '#27b6ff';
  const labelStyle = dashboardTextStyle(data, '#d8edf8', 17);
  const valueStyle = dashboardTextStyle({ ...data, fontSize: Number(data.valueFontSize) || 30, textColor: accent }, accent, 30);
  return <div className={`dashboard-people dashboard-people--${variant}`} style={{ '--dashboard-people-accent': accent } as React.CSSProperties}><svg viewBox="0 0 86 86" width="86" height="86" overflow="visible" aria-hidden="true" style={{ pointerEvents: 'none' }}><circle cx="43" cy="43" r="35" fill="none" stroke={accent} strokeOpacity=".18" strokeWidth="5"/><circle cx="43" cy="43" r="29" fill="none" stroke={accent} strokeWidth="4" strokeDasharray="182" strokeDashoffset={182 - Math.min(Math.max(value, 0), 10000) / 10000 * 182} strokeLinecap="round"/><circle cx="43" cy="34" r="10" fill={accent}/><path d="M22 66c1-14 10-22 21-22s20 8 21 22" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"/></svg><div className="dashboard-people__copy"><span style={labelStyle}>{label}</span><strong style={valueStyle}>{value.toLocaleString('en-US')}</strong></div><style>{`.dashboard-people{display:flex;align-items:center;gap:18px;padding:12px 18px;min-width:280px;min-height:90px;overflow:visible;transition:transform .25s ease,filter .25s ease}.dashboard-people:hover{transform:translateY(-3px);filter:drop-shadow(0 0 14px color-mix(in srgb,var(--dashboard-people-accent) 55%,transparent))}.dashboard-people__copy{display:flex;flex-direction:column;gap:5px}.dashboard-people__copy span,.dashboard-people__copy strong{outline:none;white-space:nowrap}.dashboard-people__copy strong{font-family:'Courier New',monospace;letter-spacing:2px;font-style:italic}.dashboard-people [contenteditable=true]{cursor:text;border-bottom:1px dashed transparent}.dashboard-people [contenteditable=true]:hover{border-color:var(--dashboard-people-accent);background:color-mix(in srgb,var(--dashboard-people-accent) 10%,transparent)}`}</style></div>;
};

const DashboardMetricModule: React.FC<{ icon: DashboardMetricIcon; data?: any }> = ({ icon, data = {} }) => {
  const isHex = icon === 'hex-data';
  const label = typeof data.label === 'string' && data.label.trim() ? data.label : (isHex ? '我是数据' : '模块标题');
  const value = Number.isFinite(Number(data.value)) ? Number(data.value) : (isHex ? 8888 : 1520);
  const max = isHex ? 10000 : 3000;
  const radius = isHex ? 50 : 42;
  const circumference = isHex ? 314.15 : 263.8;
  const offset = circumference - Math.min(Math.max(value / max, 0), 1) * circumference;
  const labelStyle = dashboardTextStyle({ ...data, textColor: data.labelColor || (isHex ? '#fff' : '#8da2b5'), fontSize: Number(data.labelFontSize) || (isHex ? 22 : 18) }, isHex ? '#fff' : '#8da2b5', isHex ? 22 : 18);
  const valueStyle = dashboardTextStyle({ ...data, textColor: data.valueColor || '#00e5ff', fontSize: Number(data.valueFontSize) || (isHex ? 44 : 34) }, '#00e5ff', isHex ? 44 : 34);
  const iconShape = icon === 'lightning' ? <path d="M55 12L27 54h21l-8 34 33-48H52z" fill="#00e5ff"/> : icon === 'star' ? <path d="M50 10l10 25 27 2-21 17 7 28-23-15-23 15 7-28L13 37l27-2z" fill="#00e5ff"/> : icon === 'bubble' ? <path d="M18 30c0-12 13-20 32-20s32 8 32 20-13 20-32 20c-5 0-10-.5-14-2L22 58l3-15c-5-4-7-8-7-13z" fill="#00e5ff"/> : icon === 'car' ? <><path d="M18 58l8-23h48l8 23" fill="none" stroke="#00e5ff" strokeWidth="6"/><rect x="14" y="56" width="72" height="18" rx="7" fill="#00e5ff"/><circle cx="29" cy="76" r="7" fill="#06253d" stroke="#00e5ff" strokeWidth="4"/><circle cx="71" cy="76" r="7" fill="#06253d" stroke="#00e5ff" strokeWidth="4"/></> : icon === 'flask' || icon === 'flask-module' ? <><path d="M42 16v25L26 65c-4 8 2 17 11 17h26c9 0 15-9 11-17L58 41V16" fill="rgba(0,229,255,.2)" stroke="#b9faff" strokeWidth="4"/><path d="M35 16h30M29 58h42" stroke="#00e5ff" strokeWidth="4" strokeLinecap="round"/></> : icon === 'user' || icon === 'user-module' ? <><circle cx="50" cy="31" r="13" fill="#b9faff"/><path d="M24 78c2-18 12-28 26-28s24 10 26 28" fill="#00e5ff"/></> : <><polygon points="50,12 84,32 84,70 50,90 16,70 16,32" fill="rgba(0,80,255,.35)" stroke="#00e5ff" strokeWidth="3"/><polygon points="50,26 70,38 50,50 30,38" fill="#00e5ff"/><polygon points="50,42 70,54 50,66 30,54" fill="#00e5ff"/><polygon points="50,58 70,70 50,82 30,70" fill="#00e5ff"/></>;
  return <div className={`dashboard-metric dashboard-metric--${isHex ? 'hex' : 'ring'}`}><div className="dashboard-metric__icon"><svg viewBox="0 0 100 100" overflow="visible" aria-hidden="true" style={{ pointerEvents: 'none' }}><circle cx="50" cy="50" r={radius} fill="none" stroke="#00e5ff" strokeOpacity=".12" strokeWidth="4"/><circle className="dashboard-metric__ring" cx="50" cy="50" r={radius} fill="none" stroke="#00e5ff" strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"/>{iconShape}</svg></div><div className="dashboard-metric__copy"><span style={labelStyle}>{label}</span><strong style={valueStyle}>{value.toLocaleString('en-US')}</strong></div><style>{`.dashboard-metric{display:flex;align-items:center;gap:24px;padding:20px 30px;min-width:${isHex ? 520 : 360}px;min-height:${isHex ? 180 : 140}px;position:relative;overflow:visible}.dashboard-metric__icon{width:${isHex ? 120 : 90}px;height:${isHex ? 120 : 90}px;flex:none}.dashboard-metric__icon svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 7px rgba(0,229,255,.62));transform:rotate(-90deg)}.dashboard-metric__icon svg>*:not(.dashboard-metric__ring){transform:rotate(90deg);transform-origin:50% 50%}.dashboard-metric__ring{transition:stroke-dashoffset .6s ease-out}.dashboard-metric__copy{display:flex;flex-direction:column;justify-content:center;gap:${isHex ? 5 : 10}px;position:relative;z-index:2}.dashboard-metric__copy span,.dashboard-metric__copy strong{outline:none;white-space:nowrap}.dashboard-metric__copy strong{font-family:'Courier New',monospace;font-style:italic;letter-spacing:2px}.dashboard-metric:hover{filter:drop-shadow(0 0 14px rgba(0,229,255,.45));transform:translateY(-2px)}.dashboard-metric [contenteditable=true]{cursor:text;border-bottom:1px dashed transparent}.dashboard-metric [contenteditable=true]:hover{border-color:#00e5ff;background:rgba(0,229,255,.1)}.dashboard-metric--hex:before{content:'';position:absolute;left:50px;right:80px;top:50%;height:60px;transform:translateY(-50%);border-radius:30px;background:linear-gradient(90deg,rgba(0,229,255,.15),transparent);filter:blur(2px);pointer-events:none}`}</style></div>;
};

const DEFAULT_PATTERN_PREDICTION_POINTS: PatternPredictionPoint[] = [
  { xLabel: '4.1', value: 4000 },
  { xLabel: '4.2', value: 1000 },
  { xLabel: '4.3', value: 4000 },
  { xLabel: '4.4', value: 2500 },
  { xLabel: '4.5', value: 6500 },
  { xLabel: '4.6', value: 4500 },
  { xLabel: '4.7', value: 4000 },
  { xLabel: '4.8', value: 5500 },
  { xLabel: '4.9', value: 4000 },
  { xLabel: '4.10', value: 1500 },
  { xLabel: '4.11', value: 4000 },
];

const readPatternPredictionPoints = (data: any): PatternPredictionPoint[] => {
  if (Array.isArray(data.series) && data.series.length) {
    return data.series.map((value: any, index: number) => ({
      xLabel: String(data.categories?.[index] ?? index + 1),
      value: Number.isFinite(Number(value)) ? Number(value) : 0,
    }));
  }
  if (Array.isArray(data.chartData) && data.chartData.length) {
    return data.chartData.map((point: any, index: number) => ({
      xLabel: String(point?.xLabel ?? index + 1),
      value: Number.isFinite(Number(point?.value)) ? Number(point.value) : 0,
    }));
  }
  return DEFAULT_PATTERN_PREDICTION_POINTS.map((point) => ({ ...point }));
};

const PatternPredictionChart: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const incomingPoints = readPatternPredictionPoints(data);
  const incomingSignature = JSON.stringify({ chartData: data.chartData, series: data.series, categories: data.categories });
  const [points, setPoints] = useState<PatternPredictionPoint[]>(incomingPoints);
  const [barsVisible, setBarsVisible] = useState(false);
  const [lineVisible, setLineVisible] = useState(false);

  useEffect(() => {
    setPoints(incomingPoints);
  }, [incomingSignature]);

  useEffect(() => {
    setBarsVisible(false);
    setLineVisible(false);
    const barTimer = window.setTimeout(() => setBarsVisible(true), 40);
    const lineTimer = window.setTimeout(() => setLineVisible(true), 300);
    return () => {
      window.clearTimeout(barTimer);
      window.clearTimeout(lineTimer);
    };
  }, [incomingSignature, points.length]);

  const padding = { top: 30, right: 20, bottom: 40, left: 60 };
  const svgWidth = 900;
  const svgHeight = 400;
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;
  const maxY = Math.max(1, Number(data.maxY) || 8000);
  const ySteps = Math.max(1, Math.floor(Number(data.ySteps) || 4));
  const valueToY = (value: number) => {
    const safeValue = Math.max(0, Math.min(value, maxY));
    return padding.top + chartHeight - (safeValue / maxY) * chartHeight;
  };
  const indexToX = (index: number) => points.length <= 1
    ? padding.left + chartWidth / 2
    : padding.left + (index / (points.length - 1)) * chartWidth;
  const linePoints = points.map((point, index) => ({ x: indexToX(index), y: valueToY(point.value) }));
  const linePath = linePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = linePoints.length
    ? `${linePath} L ${linePoints[linePoints.length - 1].x} ${valueToY(0)} L ${linePoints[0].x} ${valueToY(0)} Z`
    : '';
  const title = typeof data.label === 'string' && data.label.trim() ? data.label : '规律预判';
  const titleStyle = {
    ...dashboardTextStyle({ ...data, textColor: data.textColor || '#00f0ff', fontSize: Number(data.fontSize) || 18, fontWeight: data.fontWeight || '600', letterSpacing: data.letterSpacing ?? 2 }, '#00f0ff', 18),
    display: 'inline-block',
    color: data.textColor || '#00f0ff',
    textShadow: '0 0 10px rgba(0, 240, 255, 0.4)',
  } as React.CSSProperties;
  const labelStyle = {
    fontFamily: data.fontFamily || 'Arial, sans-serif',
    fontSize: `${Number(data.axisFontSize) || 12}px`,
    lineHeight: 1.2,
    color: data.axisTextColor || '#8899aa',
    whiteSpace: 'nowrap',
    pointerEvents: 'auto',
  } as React.CSSProperties;
  const valueStyle = {
    ...labelStyle,
    color: data.valueTextColor || '#00f0ff',
    fontSize: `${Number(data.valueFontSize) || 13}px`,
    fontWeight: data.valueFontWeight || 'bold',
    background: 'rgba(7, 11, 20, 0.8)',
    border: '1px solid rgba(0, 240, 255, 0.6)',
    borderRadius: 6,
    boxShadow: '0 0 10px rgba(0, 240, 255, 0.2), inset 0 0 5px rgba(0, 240, 255, 0.2)',
    padding: '4px 10px',
    transform: 'translate(-50%, 15px)',
  } as React.CSSProperties;
  const persistPoints = (next: PatternPredictionPoint[]) => {
    setPoints(next);
    onDataChange?.({
      chartData: next,
      series: next.map((point) => point.value),
      categories: next.map((point) => point.xLabel),
    });
  };
  const addPoint = () => {
    const lastLabel = points[points.length - 1]?.xLabel || '4.1';
    const [major = '4', minor = '0'] = lastLabel.split('.');
    const nextLabel = `${major}.${Number.parseInt(minor, 10) + 1}`;
    persistPoints([...points, { xLabel: nextLabel, value: 3000 }]);
  };
  const removePoint = () => {
    if (points.length > 1) persistPoints(points.slice(0, -1));
  };
  const textKeyCounter = { value: 0 };
  const nextTextKey = () => `text-${textKeyCounter.value++}`;

  return <div className="pattern-prediction-chart">
    <div className="pattern-prediction-chart__panel">
      <div className="pattern-prediction-chart__header">
        <div className="pattern-prediction-chart__header-left">
          <span className="pattern-prediction-chart__icon" aria-hidden="true">▶</span>
          <span className="pattern-prediction-chart__title" data-aether-text-key={nextTextKey()} style={titleStyle}>{title}</span>
        </div>
        <div className="pattern-prediction-chart__controls">
          <span
            className="pattern-prediction-chart__action"
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); addPoint(); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); addPoint(); } }}
            aria-label="add data point"
          >+</span>
          <span
            className="pattern-prediction-chart__action"
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); removePoint(); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); removePoint(); } }}
            aria-label="remove data point"
            aria-disabled={points.length <= 1}
            style={{ cursor: points.length <= 1 ? 'not-allowed' : 'pointer' }}
          >-</span>
        </div>
      </div>
      <div className="pattern-prediction-chart__wrapper">
        <svg className="pattern-prediction-chart__svg" viewBox="0 0 900 400" preserveAspectRatio="none" aria-label={title} role="img">
          <defs>
            <linearGradient id="pattern-prediction-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g>
            {Array.from({ length: ySteps + 1 }, (_, index) => {
              const value = (maxY / ySteps) * index;
              const y = valueToY(value);
              return <line key={`grid-${index}`} x1={padding.left} y1={y} x2={svgWidth - padding.right} y2={y} className="pattern-prediction-chart__grid-line" />;
            })}
            <line x1={padding.left} y1={valueToY(0)} x2={svgWidth - padding.right} y2={valueToY(0)} className="pattern-prediction-chart__axis-line" />
          </g>
          <g>
            {points.map((point, index) => {
              const x = indexToX(index);
              const y = valueToY(point.value);
              const barWidth = Math.max(8, Math.min(28, 300 / points.length));
              const barHeight = chartHeight - (y - padding.top);
              return <rect key={`bar-${index}`} className="pattern-prediction-chart__bar" x={x - barWidth / 2} width={barWidth} rx="3" y={barsVisible ? y : valueToY(0)} height={barsVisible ? Math.max(0, barHeight) : 0} style={{ transitionDelay: `${index * 80 + 100}ms` }} />;
            })}
          </g>
          <path className="pattern-prediction-chart__area" d={areaPath} style={{ opacity: lineVisible ? 1 : 0 }} />
          <path className="pattern-prediction-chart__line" d={linePath} style={{ opacity: lineVisible ? 1 : 0 }} />
          <g style={{ opacity: lineVisible ? 1 : 0, transition: 'opacity 0.8s ease' }}>
            {linePoints.map((point, index) => <circle key={`point-${index}`} className="pattern-prediction-chart__circle" cx={point.x} cy={point.y} r="5" />)}
          </g>
        </svg>
        <div className="pattern-prediction-chart__editable-layer">
          {Array.from({ length: ySteps + 1 }, (_, index) => {
            const value = (maxY / ySteps) * index;
            const y = valueToY(value);
            return <span key={`y-label-${index}`} data-aether-text-key={nextTextKey()} className="pattern-prediction-chart__y-label" style={{ ...labelStyle, top: `${(y / svgHeight) * 100}%` }}>{value}</span>;
          })}
          {points.map((point, index) => {
            const x = indexToX(index);
            const y = valueToY(point.value);
            return <React.Fragment key={`labels-${index}`}>
              <span data-aether-text-key={nextTextKey()} className="pattern-prediction-chart__x-label" style={{ ...labelStyle, left: `${(x / svgWidth) * 100}%` }}>{point.xLabel}</span>
              <span data-aether-text-key={nextTextKey()} className="pattern-prediction-chart__value-label" style={{ ...valueStyle, left: `${(x / svgWidth) * 100}%`, top: `${(y / svgHeight) * 100}%` }}>{point.value}</span>
            </React.Fragment>;
          })}
        </div>
      </div>
    </div>
    <style>{`.pattern-prediction-chart{box-sizing:border-box;width:1000px;height:560px;display:grid;place-items:center;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#8899aa}.pattern-prediction-chart__panel{box-sizing:border-box;width:100%;height:100%;padding:24px;background:transparent;border:0;box-shadow:none}.pattern-prediction-chart__header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding-bottom:12px;border-bottom:1px solid rgba(0,240,255,.1);position:relative}.pattern-prediction-chart__header::after{content:'';position:absolute;bottom:-1px;left:0;width:60px;height:2px;background:#00f0ff;box-shadow:0 0 8px #00f0ff}.pattern-prediction-chart__header-left{display:flex;align-items:center}.pattern-prediction-chart__icon{color:#00f0ff;font-size:14px;margin-right:10px;transform:scale(.8)}.pattern-prediction-chart__controls{display:flex;gap:15px}.pattern-prediction-chart__action{background:transparent;border:0;color:#00f0ff;font-size:20px;font-weight:bold;cursor:pointer;padding:0 5px;outline:none;opacity:.6}.pattern-prediction-chart__action:active{opacity:1}.pattern-prediction-chart__action:hover{opacity:.9}.pattern-prediction-chart__action:disabled{cursor:not-allowed;opacity:.25}.pattern-prediction-chart__wrapper{position:relative;width:100%;height:420px;padding:0 0 30px 50px}.pattern-prediction-chart__svg{width:100%;height:100%;overflow:visible}.pattern-prediction-chart__bar{fill:#00f0ff;opacity:.85;filter:drop-shadow(0 0 5px rgba(0,240,255,.5));transition:height .8s cubic-bezier(.25,.46,.45,.94),y .8s cubic-bezier(.25,.46,.45,.94)}.pattern-prediction-chart__line{fill:none;stroke:#00f0ff;stroke-width:3;stroke-linejoin:round;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(0,240,255,.8));transition:opacity .8s ease}.pattern-prediction-chart__area{fill:url(#pattern-prediction-area-gradient);transition:opacity .8s ease}.pattern-prediction-chart__circle{fill:#00f0ff;stroke:#070b14;stroke-width:2;cursor:pointer;filter:drop-shadow(0 0 4px #00f0ff)}.pattern-prediction-chart__grid-line{stroke:rgba(136,153,170,.15);stroke-width:1;stroke-dasharray:4 4}.pattern-prediction-chart__axis-line{stroke:rgba(136,153,170,.3);stroke-width:1}.pattern-prediction-chart__editable-layer{position:absolute;top:0;left:50px;right:0;bottom:30px;pointer-events:none;box-sizing:border-box}.pattern-prediction-chart__editable-layer>*{pointer-events:auto;position:absolute;white-space:nowrap}.pattern-prediction-chart__editable-layer [contenteditable=true]{cursor:text;border-radius:4px;outline:none;display:inline-block}.pattern-prediction-chart__editable-layer [contenteditable=true]:focus{background-color:rgba(0,240,255,.2);color:#fff;box-shadow:0 0 10px rgba(0,240,255,.4);z-index:100}.pattern-prediction-chart__y-label{transform:translate(-100%,-50%);padding-right:8px}.pattern-prediction-chart__x-label{transform:translate(-50%,0);bottom:-25px;padding:0 4px}.pattern-prediction-chart__value-label{white-space:nowrap}@media(prefers-reduced-motion:reduce){.pattern-prediction-chart__bar,.pattern-prediction-chart__line,.pattern-prediction-chart__area,.pattern-prediction-chart__editable-layer{transition:none!important}}`}</style>
  </div>;
};

type DashboardPoint = { xLabel?: string; value?: number; valueA?: number; valueB?: number; tag?: string };
type DashboardBubblePoint = { value: number; x: number; y: number; label?: string };
type DashboardRingPoint = { value: number; label?: string; x?: number; y?: number; r?: number; strokeWidth?: number; isDashed?: boolean };
type DashboardRadarPoint = { label: string; valueA: number; valueB: number };
type DashboardDistributionPoint = { name: string; value: number };

const chartNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const readDashboardPoints = (data: any, fallback: DashboardPoint[]): DashboardPoint[] => {
  const source = Array.isArray(data.dualData) && data.dualData.length
    ? data.dualData
    : Array.isArray(data.chartData) && data.chartData.length
    ? data.chartData
    : Array.isArray(data.series) && data.series.length
      ? data.series.map((value: unknown, index: number) => ({ xLabel: data.categories?.[index] || String(index + 1), value }))
      : fallback;
  return source.map((point: any, index: number) => ({
    xLabel: String(point?.xLabel ?? point?.label ?? index + 1),
    value: chartNumber(point?.value, 0),
    valueA: chartNumber(point?.valueA, 0),
    valueB: chartNumber(point?.valueB, 0),
    tag: point?.tag ? String(point.tag) : undefined,
  }));
};

const dashboardTitle = (data: any, fallback: string) => typeof data.label === 'string' && data.label.trim() ? data.label : fallback;
const dashboardTitleStyle = (data: any, fallback = '#00f0ff', size = 18) => ({
  ...dashboardTextStyle(data, fallback, size),
  display: 'block',
  color: data.textColor || fallback,
  textShadow: data.textGlowEnabled === false ? undefined : `0 0 ${Number(data.textGlowBlur) || 10}px ${data.textGlowColor || fallback}`,
} as React.CSSProperties);

const DashboardChartShell: React.FC<{ className: string; title: string; data: any; children: React.ReactNode }> = ({ className, title, data, children }) => (
  <div className={`aether-dashboard-chart ${className}`}>
    <div className="aether-dashboard-chart__header">
      <span className="aether-dashboard-chart__mark" aria-hidden="true">▶</span>
      <span data-aether-text-key="title" style={dashboardTitleStyle(data)}>{title}</span>
    </div>
     {children}
     <style>{`.aether-dashboard-chart svg *{pointer-events:none}.aether-dashboard-chart svg text{pointer-events:auto}`}</style>
    </div>
  );

const smoothDashboardPath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const t = 0.16;
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    path += ` C ${(p1.x + (p2.x - p0.x) * t).toFixed(2)} ${(p1.y + (p2.y - p0.y) * t).toFixed(2)}, ${(p2.x - (p3.x - p1.x) * t).toFixed(2)} ${(p2.y - (p3.y - p1.y) * t).toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
};

const DashboardSourceShell: React.FC<{
  className: string;
  title: string;
  data: any;
  width: number;
  height: number;
  titleColor?: string;
  titleEditable?: boolean;
  onTitleChange?: (value: string) => void;
  onAdjust?: (delta: number) => void;
  children: React.ReactNode;
}> = ({ className, title, data, width, height, titleColor = '#00f0ff', titleEditable = false, onTitleChange, onAdjust, children }) => (
  <div className={`aether-source-dashboard ${className}`} style={{ width, height }}>
    <div className="aether-source-dashboard__header">
      <span data-aether-text-key="title" contentEditable={titleEditable} suppressContentEditableWarning spellCheck={false} onBlur={(event) => titleEditable && onTitleChange?.(event.currentTarget.textContent?.trim() || title)} style={{ ...dashboardTitleStyle(data, titleColor), outline: 'none', cursor: titleEditable ? 'text' : 'default' }}>{title}</span>
      <div className="aether-source-dashboard__controls">
        <button type="button" aria-label="增加数据" onClick={() => onAdjust?.(1)}>+</button>
        <button type="button" aria-label="减少数据" onClick={() => onAdjust?.(-1)}>−</button>
      </div>
    </div>
    {children}
    <style>{`
      .aether-source-dashboard{box-sizing:border-box;position:relative;background:transparent;border:0;box-shadow:none;color:#8899aa;font-family:-apple-system,"SF Pro Display","Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;overflow:visible}
      .aether-source-dashboard svg *{pointer-events:none}
      .aether-source-dashboard svg text{pointer-events:auto}
      .aether-source-dashboard__header{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2}
      .aether-source-dashboard__controls{display:flex;align-items:center;gap:4px}
      .aether-source-dashboard__controls button{background:none;border:0;box-shadow:none;outline:none;color:${titleColor};font:inherit;font-size:24px;line-height:1;padding:2px 10px;cursor:pointer;opacity:.42;border-radius:4px;transition:none}
      .aether-source-dashboard__controls button:focus{outline:1px solid color-mix(in srgb,${titleColor} 75%,transparent);opacity:1}
    `}</style>
  </div>
);

const DashboardTrendChart: React.FC<{ data?: any; variant: 'base' | 'cyber' | 'area' | 'dual'; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, variant, onDataChange }) => {
  const defaults: DashboardPoint[] = variant === 'dual'
    ? [{ xLabel: '4.1', valueA: 35, valueB: 52, tag: 'A' }, { xLabel: '4.2', valueA: 68, valueB: 88, tag: 'B' }, { xLabel: '4.3', valueA: 92, valueB: 64, tag: 'C' }, { xLabel: '4.4', valueA: 48, valueB: 56, tag: 'D' }]
    : variant === 'area'
      ? [22, 28, 36, 42, 52, 62, 48, 56, 68, 45, 38, 46, 52, 60, 42, 34, 48, 58, 36].map((value, index) => ({ xLabel: String(12 + index * 5), value }))
      : variant === 'cyber'
        ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'].map((xLabel, index) => ({ xLabel, value: [8, 10, 12, 16, 25, 32.6, 42.1, 18, 22, 29, 36, 14, 30, 25, 40, 28, 44, 18, 34, 27, 38, 21, 31][index] }))
        : [{ xLabel: '4.1', value: 2600 }, { xLabel: '4.2', value: 4200 }, { xLabel: '4.3', value: 3400 }, { xLabel: '4.4', value: 2000 }];
  const source = variant === 'dual' && Array.isArray(data.dualData) && data.dualData.length
    ? data.dualData
    : Array.isArray(data.chartData) && data.chartData.length ? data.chartData : defaults;
  const points = source.map((point: any, index: number) => ({
    xLabel: String(point?.xLabel ?? point?.label ?? index + 1),
    value: chartNumber(point?.value),
    valueA: chartNumber(point?.valueA),
    valueB: chartNumber(point?.valueB),
    tag: point?.tag ? String(point.tag) : undefined,
    color: point?.color,
  }));
  const sourceHeight = variant === 'base' || variant === 'dual' ? 500 : 460;
  const pad = variant === 'base' ? { left: 62, right: 62, top: 70, bottom: 100 } : variant === 'dual' ? { left: 70, right: 70, top: 90, bottom: 90 } : { left: 60, right: 60, top: 70, bottom: 80 };
  const maxFactor = variant === 'base' ? 1.25 : variant === 'cyber' ? 1.18 : variant === 'area' ? 1.15 : 1.15;
  const maxY = Math.max(1, chartNumber(data.maxY, Math.max(...points.map((point) => Math.max(point.value || 0, point.valueA || 0, point.valueB || 0)), 1) * maxFactor));
  const title = dashboardTitle(data, variant === 'cyber' ? '数据趋势 · 科幻图表' : variant === 'area' ? '数据趋势 · 面积图' : variant === 'dual' ? '数据趋势 · 双曲线面积图' : '数据趋势');
  const width = 1000;
  const height = sourceHeight;
  const left = pad.left;
  const right = pad.right;
  const top = pad.top;
  const bottom = pad.bottom;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = (index: number) => points.length <= 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth;
  const yFor = (value: number) => top + plotHeight - (Math.max(0, Math.min(value, maxY)) / maxY) * plotHeight;
  const seriesA = points.map((point, index) => ({ x: xFor(index), y: yFor(variant === 'dual' ? point.valueA || 0 : point.value || 0) }));
  const seriesB = variant === 'dual' ? points.map((point, index) => ({ x: xFor(index), y: yFor(point.valueB || 0) })) : [];
  const areaPath = (series: Array<{ x: number; y: number }>) => series.length ? `${smoothDashboardPath(series)} L ${series[series.length - 1].x} ${top + plotHeight} L ${series[0].x} ${top + plotHeight} Z` : '';
  const id = React.useId().replace(/:/g, '');
  const accent = variant === 'dual' ? '#ff4fd8' : '#00f0ff';
  const adjustData = (delta: number) => {
    if (!onDataChange) return;
    const next = points.map((point) => ({ ...point }));
    if (delta > 0) {
      next.push(variant === 'dual' ? { xLabel: `4.${next.length + 1}`, valueA: 30, valueB: 40, tag: String.fromCharCode(65 + next.length) } : { xLabel: String(next.length + 1), value: 20 });
    } else if (next.length > 1) next.pop();
    onDataChange({ [variant === 'dual' ? 'dualData' : 'chartData']: next });
  };
  const widthPx = variant === 'base' ? 1000 : 1100;
  const valueStyle = dashboardTextStyle({ ...data, textColor: data.valueTextColor || accent, fontSize: Number(data.valueFontSize) || 12, fontWeight: '700' }, accent, 12);
  return <DashboardSourceShell className={`aether-trend-chart aether-trend-chart--${variant}`} title={title} data={data} width={widthPx} height={variant === 'base' ? 500 : 520} onAdjust={adjustData}>
    <div className="aether-trend-chart__plot">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" overflow="visible" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity=".32" /><stop offset="100%" stopColor={accent} stopOpacity="0" /></linearGradient>
          <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00f0ff" stopOpacity=".92" /><stop offset="55%" stopColor="#00c8ff" stopOpacity=".45" /><stop offset="100%" stopColor="#00f0ff" stopOpacity=".04" /></linearGradient>
          <linearGradient id={`${id}-cyber`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b96cff" /><stop offset="100%" stopColor="#2d65ff" stopOpacity=".18" /></linearGradient>
        </defs>
        {variant === 'area' && Array.from({ length: 5 }, (_, index) => {
          const y = top + plotHeight - (index / 4) * plotHeight;
          return <line key={index} x1={left} x2={width - right} y1={y} y2={y} stroke="rgba(136,153,170,.15)" strokeDasharray="4 4" />;
        })}
        {variant !== 'area' && points.map((point, index) => {
          const x = xFor(index);
          const y = yFor(variant === 'dual' ? point.valueA || 0 : point.value);
          const barWidth = Math.max(8, Math.min(36, plotWidth / Math.max(points.length, 1) * .55));
          const fill = variant === 'cyber' ? (point.color || '#1a85b8') : variant === 'base' ? `url(#${id}-bar)` : `url(#${id}-area)`;
          return <rect key={`bar-${index}`} className="aether-trend-bar" x={x - barWidth / 2} y={y} width={barWidth} height={top + plotHeight - y} rx={variant === 'base' ? Math.min(barWidth / 2, 16) : 3} fill={fill} style={{ animationDelay: `${index * 45}ms` }} />;
        })}
        {variant !== 'cyber' && <path d={areaPath(seriesA)} fill={`url(#${id}-area)`} className="aether-trend-area" />}
        <path d={smoothDashboardPath(seriesA)} fill="none" stroke={accent} strokeWidth={variant === 'cyber' ? 2 : 3} strokeLinecap="round" strokeLinejoin="round" className="aether-trend-line" />
        {seriesB.length > 0 && <><path d={areaPath(seriesB)} fill="rgba(255,79,216,.13)" className="aether-trend-area" /><path d={smoothDashboardPath(seriesB)} fill="none" stroke="#7de7ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="aether-trend-line aether-trend-line--second" /></>}
        {seriesA.map((point, index) => <circle key={`dot-a-${index}`} cx={point.x} cy={point.y} r="4.5" fill="#07111d" stroke={accent} strokeWidth="2" className="aether-trend-dot" />)}
        {seriesB.map((point, index) => <circle key={`dot-b-${index}`} cx={point.x} cy={point.y} r="4" fill="#07111d" stroke="#7de7ff" strokeWidth="2" className="aether-trend-dot" />)}
      </svg>
      <div className="aether-trend-labels">
        {points.map((point, index) => <span key={`x-${index}`} data-aether-text-key={`x-${index}`} className="aether-trend-x" style={{ left: `${(xFor(index) / width) * 100}%` }}>{point.xLabel}</span>)}
        {points.map((point, index) => <span key={`v-${index}`} data-aether-text-key={`v-${index}`} className="aether-trend-value" style={{ ...valueStyle, left: `${(xFor(index) / width) * 100}%`, top: `${(yFor(variant === 'dual' ? point.valueA || 0 : point.value || 0) / height) * 100}%` }}>{variant === 'dual' ? `${point.valueA}/${point.valueB}` : point.value}</span>)}
      </div>
    </div>
    <style>{`
      .aether-trend-chart--base .aether-source-dashboard__header{padding:0 6px 4px}
      .aether-trend-chart--cyber .aether-source-dashboard__header,.aether-trend-chart--area .aether-source-dashboard__header,.aether-trend-chart--dual .aether-source-dashboard__header{padding:0 10px 4px}
      .aether-trend-chart__plot{position:relative;height:calc(100% - 42px)}
      .aether-trend-chart__plot svg{width:100%;height:100%;overflow:visible}
      .aether-trend-labels{position:absolute;inset:10px 0 0;pointer-events:none}
      .aether-trend-labels>*{position:absolute;white-space:nowrap;pointer-events:none}
      .aether-trend-x{top:91%;transform:translateX(-50%);color:rgba(0,240,255,.68);font-size:12px;letter-spacing:1px}
      .aether-trend-value{transform:translate(-50%,-100%);padding:2px 6px;border-radius:3px;color:#00f0ff;text-shadow:0 0 9px #00f0ff;font-variant-numeric:tabular-nums}
      .aether-trend-bar{opacity:.82;transform-origin:bottom;animation:aether-trend-grow .8s cubic-bezier(.25,.46,.45,.94) both;transition:filter .25s ease,opacity .25s ease}
      .aether-trend-bar:hover{opacity:1;filter:brightness(1.25) drop-shadow(0 0 7px ${accent})}
      .aether-trend-line{filter:drop-shadow(0 0 6px ${accent});transition:d .7s ease}
      .aether-trend-line--second{filter:drop-shadow(0 0 6px #7de7ff)}
      .aether-trend-area{opacity:.92;transition:opacity .4s ease}
      .aether-trend-dot{transition:r .2s ease,filter .2s ease;cursor:pointer}
      .aether-trend-dot:hover{r:7;filter:drop-shadow(0 0 8px ${accent})}
      @keyframes aether-trend-grow{from{transform:scaleY(0);opacity:.15}to{transform:scaleY(1);opacity:.82}}
      @media(prefers-reduced-motion:reduce){.aether-trend-bar{animation:none}.aether-trend-line,.aether-trend-area{transition:none}}
    `}</style>
  </DashboardSourceShell>;
};

const DashboardBubbleChart: React.FC<{ data?: any }> = ({ data = {} }) => {
  const bubbles: DashboardBubblePoint[] = (Array.isArray(data.bubbles) && data.bubbles.length ? data.bubbles : [{ value: 61, x: 44, y: 40, label: '61%' }, { value: 21, x: 60, y: 75, label: '21%' }, { value: 10, x: 82, y: 50, label: '10%' }, { value: 8, x: 84, y: 82, label: '8%' }, { value: 2, x: 22, y: 72, label: '2%' }]).map((point: any) => ({ value: chartNumber(point.value), x: chartNumber(point.x), y: chartNumber(point.y), label: point.label || `${point.value}%` }));
  const title = dashboardTitle(data, '数据趋势 · 赛博发光气泡图');
  return <DashboardChartShell className="aether-bubble-chart" title={title} data={data}>
    <div className="aether-bubble-chart__plot">{bubbles.map((bubble, index) => <div key={index} className="aether-bubble" style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, '--bubble-size': `${Math.max(34, Math.sqrt(Math.max(bubble.value, 1)) * 9)}px`, '--bubble-delay': `${index * 120}ms` } as React.CSSProperties}><span data-aether-text-key={`bubble-${index}`}>{bubble.label}</span></div>)}</div>
    <style>{`.aether-bubble-chart{width:900px;height:520px}.aether-bubble-chart__plot{position:relative;height:420px;margin:16px 8px 0;border:1px solid rgba(0,240,255,.14);background:radial-gradient(circle at center,rgba(0,240,255,.06),transparent 62%);overflow:visible}.aether-bubble{position:absolute;width:var(--bubble-size);height:var(--bubble-size);display:grid;place-items:center;transform:translate(-50%,-50%);border:1px solid rgba(99,242,255,.95);border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.55),rgba(0,228,255,.2) 22%,rgba(15,67,151,.3) 68%,rgba(17,0,80,.45));box-shadow:0 0 10px #00eaff,0 0 28px rgba(0,94,255,.72),inset 0 0 14px rgba(0,240,255,.55);animation:aether-bubble-float 3.2s ease-in-out infinite var(--bubble-delay);transition:transform .25s ease,filter .25s ease}.aether-bubble:hover{transform:translate(-50%,-50%) scale(1.15);filter:brightness(1.25)}.aether-bubble span{color:#e9ffff;font-size:14px;font-weight:700;text-shadow:0 0 8px #00f0ff;font-variant-numeric:tabular-nums}@keyframes aether-bubble-float{50%{margin-top:-6px}}`}</style>
  </DashboardChartShell>;
};

const DashboardRingChart: React.FC<{ data?: any; multi?: boolean }> = ({ data = {}, multi = false }) => {
  const defaults: DashboardRingPoint[] = multi
    ? [{ value: 60, label: '60%', x: 38, y: 35, r: 95, strokeWidth: 16 }, { value: 20, label: '20%', x: 72, y: 52, r: 75, strokeWidth: 14 }, { value: 14, label: '14%', x: 55, y: 78, r: 62, strokeWidth: 10, isDashed: true }, { value: 6, label: '6%', x: 28, y: 80, r: 48, strokeWidth: 12 }, { value: 6, label: '6%', x: 84, y: 84, r: 40, strokeWidth: 10 }]
    : [{ value: 68, label: '68°', x: 38, y: 40 }, { value: 16, label: '16%', x: 65, y: 65 }];
  const rings: DashboardRingPoint[] = (Array.isArray(data.rings) && data.rings.length ? data.rings : defaults).map((ring: any, index: number) => ({ ...ring, value: Math.max(0, Math.min(100, chartNumber(ring.value))), label: ring.label || `${ring.value}%`, x: chartNumber(ring.x, 50), y: chartNumber(ring.y, 50), r: chartNumber(ring.r, multi ? 80 - index * 10 : 62), strokeWidth: chartNumber(ring.strokeWidth, multi ? 14 : 16) }));
  const title = dashboardTitle(data, multi ? '数据趋势 · 赛博发光圆环图（多环版本）' : '数据趋势 · 赛博发光圆环图');
  const colors = ['#00eaff', '#9a6cff', '#ff4fd8', '#49f7a8', '#ffd166'];
  return <DashboardChartShell className={`aether-ring-chart ${multi ? 'aether-ring-chart--multi' : ''}`} title={title} data={data}>
    <div className="aether-ring-chart__plot"><svg viewBox="0 0 900 420" preserveAspectRatio="none" overflow="visible">{rings.map((ring, index) => { const circumference = 2 * Math.PI * ring.r!; const color = colors[index % colors.length]; return <g key={index} transform={`translate(${(ring.x! / 100) * 900} ${(ring.y! / 100) * 420})`} className="aether-ring"><circle r={ring.r} fill="none" stroke="rgba(120,220,255,.12)" strokeWidth={ring.strokeWidth} /><circle r={ring.r} fill="none" stroke={color} strokeWidth={ring.strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ring.value / 100)} transform="rotate(-90)" className="aether-ring__progress" style={{ filter: `drop-shadow(0 0 8px ${color})`, strokeDasharray: ring.isDashed ? '8 8' : undefined }} /><circle r={Math.max(4, ring.r! - ring.strokeWidth! / 2 - 6)} fill="rgba(2,12,28,.34)" /><text x="0" y="5" textAnchor="middle" fill="#eaffff" fontSize={multi ? 18 : 22} fontWeight="700" data-aether-text-key={`ring-${index}`}>{ring.label}</text></g>; })}</svg></div>
    <style>{`.aether-ring-chart{width:900px;height:520px}.aether-ring-chart__plot{height:420px;margin-top:14px;overflow:visible}.aether-ring-chart__plot svg{width:100%;height:100%;overflow:visible}.aether-ring__progress{transition:stroke-dashoffset .8s ease,filter .25s ease}.aether-ring:hover .aether-ring__progress{filter:drop-shadow(0 0 15px currentColor)!important}.aether-ring{animation:aether-ring-in .8s ease both}@keyframes aether-ring-in{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}`}</style>
  </DashboardChartShell>;
};

const DashboardHudGauge: React.FC<{ data?: any }> = ({ data = {} }) => {
  const value = Math.max(0, Math.min(100, chartNumber(data.value, 84)));
  const title = dashboardTitle(data, '数据趋势 · 赛博 HUD 仪表盘');
  const angle = -130 + value * 2.6;
  return <DashboardChartShell className="aether-hud-gauge" title={title} data={data}>
    <div className="aether-hud-gauge__body"><svg viewBox="0 0 520 300" overflow="visible" aria-label={`${value}${data.unit || '%'}`}><path d="M90 235A175 175 0 0 1 430 235" fill="none" stroke="rgba(71,188,255,.12)" strokeWidth="22" /><path d="M90 235A175 175 0 0 1 430 235" fill="none" stroke="#00eaff" strokeWidth="7" strokeLinecap="round" pathLength="100" strokeDasharray={`${value} 100`} className="aether-hud-gauge__arc" /><g transform={`rotate(${angle} 260 235)`}><path d="M260 230L252 84L268 84Z" fill="#dffcff" filter="drop-shadow(0 0 5px #00eaff)" /><circle cx="260" cy="235" r="12" fill="#071827" stroke="#00eaff" strokeWidth="4" /></g><text x="260" y="196" textAnchor="middle" fill="#eaffff" fontSize="52" fontWeight="700" data-aether-text-key="hud-value">{Math.round(value)}</text><text x="260" y="222" textAnchor="middle" fill="#00eaff" fontSize="15" letterSpacing="3" data-aether-text-key="hud-unit">{data.unit || '%'}</text><text x="72" y="264" fill="#7da6bf" fontSize="11">0</text><text x="430" y="264" fill="#7da6bf" fontSize="11">100</text></svg></div>
    <style>{`.aether-hud-gauge{width:720px;height:460px}.aether-hud-gauge__body{height:350px;display:grid;place-items:center}.aether-hud-gauge__body svg{width:100%;height:100%;overflow:visible}.aether-hud-gauge__arc{transition:stroke-dasharray .8s ease;filter:drop-shadow(0 0 8px #00eaff)}.aether-hud-gauge__body:hover .aether-hud-gauge__arc{filter:drop-shadow(0 0 16px #00eaff)}`}</style>
  </DashboardChartShell>;
};

const DashboardRadarChart: React.FC<{ data?: any }> = ({ data = {} }) => {
  const defaults: DashboardRadarPoint[] = [{ label: '维度一', valueA: 85, valueB: 65 }, { label: '维度二', valueA: 75, valueB: 50 }, { label: '维度三', valueA: 90, valueB: 70 }, { label: '维度四', valueA: 65, valueB: 80 }, { label: '维度五', valueA: 80, valueB: 60 }, { label: '维度六', valueA: 70, valueB: 55 }];
  const points: DashboardRadarPoint[] = (Array.isArray(data.radarData) && data.radarData.length ? data.radarData : defaults).map((point: any) => ({ label: String(point.label), valueA: chartNumber(point.valueA), valueB: chartNumber(point.valueB) }));
  const cx = 450; const cy = 218; const radius = 150; const id = React.useId().replace(/:/g, '');
  const polygon = (field: 'valueA' | 'valueB', scale = 1) => points.map((point, index) => { const angle = -Math.PI / 2 + index * (Math.PI * 2 / points.length); const value = (point[field] / 100) * radius * scale; return `${cx + Math.cos(angle) * value},${cy + Math.sin(angle) * value}`; }).join(' ');
  const grid = (scale: number) => points.map((_, index) => { const angle = -Math.PI / 2 + index * (Math.PI * 2 / points.length); return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`; }).join(' ');
  return <DashboardChartShell className="aether-radar-chart" title={dashboardTitle(data, '数据趋势 · 赛博雷达图')} data={data}>
    <div className="aether-radar-chart__plot"><svg viewBox="0 0 900 440" overflow="visible"><defs><radialGradient id={`${id}-a`}><stop offset="0%" stopColor="#00eaff" stopOpacity=".26" /><stop offset="100%" stopColor="#00eaff" stopOpacity=".03" /></radialGradient></defs>{[.25,.5,.75,1].map((scale) => <polygon key={scale} points={grid(scale)} fill="none" stroke="rgba(0,234,255,.2)" strokeDasharray="4 5" />)}{points.map((point, index) => { const angle = -Math.PI / 2 + index * (Math.PI * 2 / points.length); return <line key={`axis-${index}`} x1={cx} y1={cy} x2={cx + Math.cos(angle) * radius} y2={cy + Math.sin(angle) * radius} stroke="rgba(0,234,255,.18)" />; })}<polygon points={polygon('valueA')} fill={`url(#${id}-a)`} stroke="#00eaff" strokeWidth="3" className="aether-radar-polygon" /><polygon points={polygon('valueB')} fill="rgba(255,79,216,.12)" stroke="#ff4fd8" strokeWidth="2" className="aether-radar-polygon" />{points.map((point, index) => { const angle = -Math.PI / 2 + index * (Math.PI * 2 / points.length); return <text key={`label-${index}`} x={cx + Math.cos(angle) * (radius + 30)} y={cy + Math.sin(angle) * (radius + 30)} fill="#bfefff" textAnchor="middle" fontSize="12" data-aether-text-key={`radar-${index}`}>{point.label}</text>; })}</svg></div>
    <style>{`.aether-radar-chart{width:900px;height:540px}.aether-radar-chart__plot{height:430px;margin-top:8px}.aether-radar-chart__plot svg{width:100%;height:100%;overflow:visible}.aether-radar-polygon{transition:opacity .3s ease,filter .3s ease}.aether-radar-polygon:hover{opacity:.9;filter:drop-shadow(0 0 10px #00eaff)}`}</style>
  </DashboardChartShell>;
};

const Dashboard3DDonutChart: React.FC<{ data?: any }> = ({ data = {} }) => {
  const segments = (Array.isArray(data.donutData) && data.donutData.length ? data.donutData : [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }]).map((segment: any, index: number) => ({ name: String(segment.name || `Segment ${index + 1}`), value: Math.max(0, chartNumber(segment.value)), color: segment.color || ['#00eaff', '#ff4fd8', '#9a6cff'][index % 3] }));
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const cx = 390; const cy = 210; const outer = 150; const inner = 76; let current = -90;
  const polar = (angle: number, radius: number) => ({ x: cx + Math.cos(angle * Math.PI / 180) * radius, y: cy + Math.sin(angle * Math.PI / 180) * radius });
  const segmentPath = (start: number, end: number) => { const s = polar(start, outer); const e = polar(end, outer); const is = polar(end, inner); const ie = polar(start, inner); return `M ${s.x} ${s.y} A ${outer} ${outer} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y} L ${is.x} ${is.y} A ${inner} ${inner} 0 ${end - start > 180 ? 1 : 0} 0 ${ie.x} ${ie.y} Z`; };
  return <DashboardChartShell className="aether-3d-donut-chart" title={dashboardTitle(data, '数据趋势 · 赛博3D环形图')} data={data}>
    <div className="aether-3d-donut-chart__body"><svg viewBox="0 0 780 430" overflow="visible"><ellipse cx={cx} cy={cy + 34} rx="178" ry="48" fill="rgba(0,15,45,.55)" filter="blur(18px)" />{segments.map((segment, index) => { const start = current; const end = current + (segment.value / total) * 360; current = end; return <g key={index} className="aether-donut-segment"><path d={segmentPath(start, end)} fill={segment.color} opacity=".86" /><path d={segmentPath(start, end)} fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="5" transform="translate(0 18)" /><text x={polar((start + end) / 2, 184).x} y={polar((start + end) / 2, 184).y} fill="#ecffff" fontSize="14" textAnchor="middle" data-aether-text-key={`donut-${index}`}>{segment.name} {Math.round(segment.value)}%</text></g>; })}<ellipse cx={cx} cy={cy} rx={inner} ry={inner * .7} fill="#06122d" stroke="rgba(0,234,255,.45)" strokeWidth="2" /><text x={cx} y={cy + 8} fill="#eaffff" fontSize="25" textAnchor="middle" fontWeight="700">100%</text></svg></div>
    <style>{`.aether-3d-donut-chart{width:900px;height:540px}.aether-3d-donut-chart__body{height:430px}.aether-3d-donut-chart__body svg{width:100%;height:100%;overflow:visible}.aether-donut-segment{transition:transform .3s ease,filter .3s ease;transform-origin:390px 210px}.aether-donut-segment:hover{transform:translateY(-7px);filter:brightness(1.2) drop-shadow(0 0 10px currentColor)}`}</style>
  </DashboardChartShell>;
};

const DashboardDistributionChart: React.FC<{ data?: any }> = ({ data = {} }) => {
  const points: DashboardDistributionPoint[] = (Array.isArray(data.distributionData) && data.distributionData.length ? data.distributionData : [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }]).map((point: any) => ({ name: String(point.name || ''), value: Math.max(0, chartNumber(point.value)) }));
  const total = Math.max(1, points.reduce((sum, point) => sum + point.value, 0));
  const colors = ['#00eaff', '#ff4fd8', '#9a6cff'];
  return <DashboardChartShell className="aether-distribution-chart" title={dashboardTitle(data, '数据分布统计')} data={data}>
    <div className="aether-distribution-chart__body"><div className="aether-distribution-chart__bar">{points.map((point, index) => <div key={index} className="aether-distribution-chart__segment" style={{ width: `${point.value / total * 100}%`, background: colors[index % colors.length] }} />)}</div>{points.map((point, index) => <div className="aether-distribution-chart__row" key={index}><span className="aether-distribution-chart__dot" style={{ background: colors[index % colors.length] }} /><span data-aether-text-key={`distribution-name-${index}`}>{point.name}</span><b data-aether-text-key={`distribution-value-${index}`}>{point.value}%</b><i style={{ width: `${point.value / total * 100}%`, background: colors[index % colors.length] }} /></div>)}</div>
    <style>{`.aether-distribution-chart{width:760px;height:420px}.aether-distribution-chart__body{padding:38px 30px}.aether-distribution-chart__bar{display:flex;height:18px;overflow:hidden;border-radius:4px;box-shadow:0 0 14px rgba(0,234,255,.25)}.aether-distribution-chart__segment{height:100%;transition:width .7s ease}.aether-distribution-chart__row{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:10px;position:relative;margin-top:22px;color:#bdeeff;font-size:14px}.aether-distribution-chart__dot{width:8px;height:8px;border-radius:50%;box-shadow:0 0 8px currentColor}.aether-distribution-chart__row b{color:#eaffff;font-variant-numeric:tabular-nums}.aether-distribution-chart__row i{position:absolute;left:22px;right:0;bottom:-9px;height:1px;opacity:.5;transition:width .6s ease}`}</style>
  </DashboardChartShell>;
};

/* Source-faithful renderers for the dashboard snippets. These keep the original
   geometry and transparent root while using uiComponentData as the only state. */
const SourceTrendChart: React.FC<{ data?: any; variant: 'base' | 'cyber' | 'area' | 'dual'; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, variant, onDataChange }) => {
  const defaults: DashboardPoint[] = variant === 'dual'
    ? [{ xLabel: '4.1', valueA: 35, valueB: 52, tag: 'A' }, { xLabel: '4.2', valueA: 68, valueB: 88, tag: 'B' }, { xLabel: '4.3', valueA: 92, valueB: 64, tag: 'C' }, { xLabel: '4.4', valueA: 48, valueB: 56, tag: 'D' }]
    : variant === 'area'
      ? [22, 28, 36, 42, 52, 62, 48, 56, 68, 45, 38, 46, 52, 60, 42, 34, 48, 58, 36].map((value, index) => ({ xLabel: String(12 + index * 5), value }))
      : variant === 'cyber'
        ? [8, 10, 12, 16, 25, 32.6, 42.1, 18, 22, 29, 36, 14, 30, 25, 40, 28, 44, 18, 34, 27, 38, 21, 31].map((value, index) => ({ xLabel: String.fromCharCode(65 + index), value, color: index === 4 || index === 5 || index === 6 || index === 16 ? '#00f0ff' : '#1a85b8' }))
        : [{ xLabel: '4.1', value: 2600 }, { xLabel: '4.2', value: 4200 }, { xLabel: '4.3', value: 3400 }, { xLabel: '4.4', value: 2000 }];
  const source = variant === 'dual' ? data.dualData : data.chartData;
  const points = (Array.isArray(source) && source.length ? source : defaults).map((point: any, index: number) => ({ ...point, xLabel: String(point.xLabel ?? index + 1), value: chartNumber(point.value), valueA: chartNumber(point.valueA), valueB: chartNumber(point.valueB) }));
  const W = 1000;
  const H = variant === 'base' || variant === 'dual' ? 500 : 460;
  const pad = variant === 'base' ? [62, 62, 70, 100] : variant === 'dual' ? [70, 70, 90, 90] : [60, 60, 70, 80];
  const [left, right, top, bottom] = pad;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const maxValue = Math.max(...points.map((point) => Math.max(point.value, point.valueA, point.valueB)), 1);
  const maxY = Math.max(1, chartNumber(data.maxY, maxValue * (variant === 'base' ? 1.25 : variant === 'cyber' ? 1.18 : variant === 'area' ? 1.15 : 1.15)));
  const xFor = (index: number) => left + (index + .5) * (plotW / Math.max(points.length, 1));
  const yFor = (value: number) => H - bottom - Math.max(0, value) / maxY * plotH;
  const main = points.map((point, index) => ({ x: xFor(index), y: yFor(variant === 'dual' ? point.valueA : point.value) }));
  const second = variant === 'dual' ? points.map((point, index) => ({ x: xFor(index), y: yFor(point.valueB) })) : [];
  const area = (series: Array<{ x: number; y: number }>) => `${smoothDashboardPath(series)} L ${series[series.length - 1]?.x || left} ${H - bottom} L ${series[0]?.x || left} ${H - bottom} Z`;
  const id = React.useId().replace(/:/g, '');
  const key = variant === 'dual' ? 'dualData' : 'chartData';
  const adjust = (delta: number) => {
    if (!onDataChange) return;
    const next = points.map((point) => ({ ...point }));
    if (delta > 0) next.push(variant === 'dual' ? { xLabel: `4.${next.length + 1}`, valueA: 30, valueB: 40, tag: String.fromCharCode(65 + next.length) } : { xLabel: String(next.length + 1), value: 20 });
    else if (next.length > 1) next.pop();
    onDataChange({ [key]: next });
  };
  const title = dashboardTitle(data, variant === 'base' ? '数据趋势' : variant === 'cyber' ? '数据趋势 · 科幻图表' : variant === 'area' ? '数据趋势 · 面积图' : '数据趋势 · 双曲线面积图');
  return <DashboardSourceShell className={`source-trend source-trend--${variant}`} title={title} data={data} width={variant === 'base' ? 1000 : 1100} height={variant === 'base' ? 500 : 520} onAdjust={adjust}>
    <div className="source-trend__plot"><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" overflow="visible"><defs><linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00f0ff" stopOpacity=".92"/><stop offset="55%" stopColor="#00c8ff" stopOpacity=".45"/><stop offset="100%" stopColor="#00f0ff" stopOpacity=".04"/></linearGradient><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00f0ff" stopOpacity=".42"/><stop offset="100%" stopColor="#00f0ff" stopOpacity="0"/></linearGradient></defs>{variant === 'area' && [0,1,2,3,4].map((level) => <line key={level} x1={left} x2={W - right} y1={top + plotH - level / 4 * plotH} y2={top + plotH - level / 4 * plotH} stroke="rgba(136,153,170,.15)" strokeDasharray="4 4"/>)}{variant !== 'area' && points.map((point, index) => <rect key={index} className="source-trend__bar" x={xFor(index) - Math.min((plotW / points.length) * (variant === 'dual' ? .22 : .42), variant === 'base' ? 92 : variant === 'cyber' ? 60 : 40) / 2} y={main[index].y} width={Math.min((plotW / points.length) * (variant === 'dual' ? .22 : .42), variant === 'base' ? 92 : variant === 'cyber' ? 60 : 40)} height={H - bottom - main[index].y} rx={variant === 'base' ? 16 : 3} fill={variant === 'base' ? `url(#${id}-bar)` : variant === 'cyber' ? (point.color || '#1a85b8') : `url(#${id}-area)`}/>)}{variant !== 'cyber' && <path d={area(main)} fill={`url(#${id}-area)`} className="source-trend__area"/>}<path d={smoothDashboardPath(main)} fill="none" stroke={variant === 'dual' ? '#ff4d6d' : '#00f0ff'} strokeWidth={variant === 'base' ? 3.5 : 3} strokeLinecap="round" strokeLinejoin="round" className="source-trend__line"/>{second.length > 0 && <><path d={area(second)} fill="rgba(255,79,216,.13)" className="source-trend__area"/><path d={smoothDashboardPath(second)} fill="none" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round" className="source-trend__line"/></>}{main.map((point, index) => <circle key={`a-${index}`} cx={point.x} cy={point.y} r={variant === 'base' ? 7 : 4.5} fill={variant === 'base' ? '#061620' : '#070b14'} stroke={variant === 'dual' ? '#ff4d6d' : '#00f0ff'} strokeWidth={variant === 'base' ? 3 : 2} className="source-trend__dot"/>)}{second.map((point, index) => <circle key={`b-${index}`} cx={point.x} cy={point.y} r="4.5" fill="#070b14" stroke="#00f0ff" strokeWidth="2" className="source-trend__dot"/>)}</svg><div className="source-trend__labels">{points.map((point, index) => <span key={`x-${index}`} className="source-trend__x" style={{ left: `${xFor(index) / W * 100}%` }}>{point.xLabel}</span>)}{points.map((point, index) => <span key={`v-${index}`} className="source-trend__v" data-aether-text-key={`value-${index}`} style={{ left: `${xFor(index) / W * 100}%`, top: `${(main[index].y - (variant === 'dual' ? 20 : variant === 'area' ? 16 : 18)) / H * 100}%`, ...dashboardTextStyle(data, variant === 'dual' ? '#ff4d6d' : '#00f0ff', variant === 'base' ? 17 : 14) }}>{variant === 'dual' ? `${point.valueA}/${point.valueB}` : point.value}</span>)}</div></div>
    <style>{`.source-trend .aether-source-dashboard__header{padding:${variant === 'base' ? '0 6px 4px' : '0 10px 4px'}}.source-trend__plot{position:relative;width:100%;height:calc(100% - 42px)}.source-trend__plot svg{display:block;width:100%;height:100%;overflow:visible}.source-trend__labels{position:absolute;inset:0;pointer-events:none}.source-trend__labels>*{position:absolute;white-space:nowrap;pointer-events:auto}.source-trend__x{top:${variant === 'base' ? 84 : 84}%;transform:translateX(-50%);color:rgba(0,240,255,.68);font-size:${variant === 'base' ? 15 : 13}px;letter-spacing:1px}.source-trend__v{transform:translate(-50%,-100%);text-shadow:0 0 12px currentColor;font-variant-numeric:tabular-nums}.source-trend__bar{opacity:.85;filter:drop-shadow(0 0 5px rgba(0,240,255,.5));transform-origin:bottom;animation:source-bar-grow .8s cubic-bezier(.25,.46,.45,.94) both;transition:height .8s ease,y .8s ease,opacity .5s ease}.source-trend__bar:hover{opacity:1}.source-trend__line{filter:drop-shadow(0 0 6px rgba(0,240,255,.8));transition:opacity .65s ease}.source-trend__area{transition:opacity .65s ease}.source-trend__dot{filter:drop-shadow(0 0 4px #00f0ff);cursor:pointer}.source-trend__dot:hover{filter:drop-shadow(0 0 10px #00f0ff)}@keyframes source-bar-grow{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:.85}}`}</style>
  </DashboardSourceShell>;
};

const SourceBubbleChart: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const source = Array.isArray(data.bubbles) && data.bubbles.length ? data.bubbles : [{ value: 61, color: '#00f0ff', x: 44, y: 40, label: '61%' }, { value: 21, color: '#00f0ff', x: 60, y: 75, label: '21%' }, { value: 10, color: '#00f0ff', x: 82, y: 50, label: '10%' }, { value: 8, color: '#00f0ff', x: 84, y: 82, label: '8%' }, { value: 2, color: '#ff4d6d', x: 22, y: 72, label: '2%' }];
  const max = Math.max(...source.map((point: any) => chartNumber(point.value, 1)), 1);
  const bubbles = source.map((point: any) => ({ ...point, value: chartNumber(point.value), x: chartNumber(point.x), y: chartNumber(point.y) }));
  const adjust = (delta: number) => { if (!onDataChange) return; const next = bubbles.map((point) => ({ ...point })); if (delta > 0 && next.length < 9) next.push({ value: 10, color: '#00f0ff', x: 50, y: 50, label: '10%' }); else if (delta < 0 && next.length > 1) next.pop(); onDataChange({ bubbles: next }); };
  return <DashboardSourceShell className="source-bubble" title={dashboardTitle(data, 'Cyber Glow')} data={data} width={780} height={825} onAdjust={adjust}><div className="source-bubble__field">{bubbles.map((bubble, index) => { const radius = Math.max(780 * .06, Math.sqrt(Math.max(bubble.value, 0) / max) * 780 * .25); return <div key={index} className={`source-bubble__bubble${bubble.color === '#ff4d6d' ? ' is-pink' : ''}`} style={{ left: `${bubble.x}%`, top: `${bubble.y}%`, width: radius * 2, height: radius * 2, animationDelay: `${index * 130}ms` }}><span data-aether-text-key={`bubble-${index}`}>{bubble.label || `${bubble.value}%`}</span></div>; })}</div><style>{`.source-bubble .aether-source-dashboard__header{padding:0 10px 12px}.source-bubble__field{position:relative;width:100%;height:780px;overflow:hidden}.source-bubble__bubble{position:absolute;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 30%,#4db8ff 0%,#1a7fff 15%,#0055dd 40%,#002288 70%,#000a33 100%);border:1px solid rgba(0,200,255,.6);box-shadow:0 0 15px rgba(0,200,255,.8),0 0 40px rgba(0,150,255,.5),0 0 80px rgba(0,100,255,.3),inset 0 0 20px rgba(0,240,255,.4);transition:transform .35s ease,filter .35s ease,width 1.05s ease,height 1.05s ease;animation:source-bubble-in .8s ease both}.source-bubble__bubble.is-pink{background:radial-gradient(circle at 35% 30%,#ff9ab0 0%,#ff4d6d 30%,#22000c 100%);box-shadow:0 0 15px rgba(255,77,109,.8),0 0 40px rgba(255,77,109,.5)}.source-bubble__bubble:hover{transform:translate(-50%,-50%) scale(1.08);filter:brightness(1.2)}.source-bubble__bubble span{color:#e9ffff;font-size:clamp(14px,2.4vw,30px);font-weight:700;text-shadow:0 0 10px currentColor;white-space:nowrap}@keyframes source-bubble-in{from{opacity:0;transform:translate(-50%,-50%) scale(0)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style></DashboardSourceShell>;
};

const SourceRingChart: React.FC<{ data?: any; multi?: boolean; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, multi = false, onDataChange }) => {
  const defaults: DashboardRingPoint[] = multi ? [{ value: 60, label: '60%', x: 38, y: 35, r: 95, strokeWidth: 16 }, { value: 20, label: '20%', x: 72, y: 52, r: 75, strokeWidth: 14 }, { value: 14, label: '14%', x: 55, y: 78, r: 62, strokeWidth: 10, isDashed: true }, { value: 6, label: '6%', x: 28, y: 80, r: 48, strokeWidth: 12 }, { value: 6, label: '6%', x: 84, y: 84, r: 40, strokeWidth: 10 }] : [{ value: 68, label: '68°', x: 38, y: 40 }, { value: 16, label: '16%', x: 65, y: 65 }];
  const rings = (Array.isArray(data.rings) && data.rings.length ? data.rings : defaults).map((ring: any, index: number) => ({ ...ring, value: Math.max(0, Math.min(100, chartNumber(ring.value))), x: chartNumber(ring.x, 50), y: chartNumber(ring.y, 50), r: chartNumber(ring.r, multi ? 95 - index * 14 : 80), strokeWidth: chartNumber(ring.strokeWidth, 14) }));
  const adjust = (delta: number) => { if (!onDataChange) return; const next = rings.map((ring) => ({ ...ring })); if (delta > 0 && next.length < (multi ? 8 : 6)) next.push({ value: 30, label: '30%', x: 50, y: 50, r: multi ? 45 : 80, strokeWidth: 14 }); else if (delta < 0 && next.length > 1) next.pop(); onDataChange({ rings: next }); };
  return <DashboardSourceShell className={`source-rings${multi ? ' source-rings--multi' : ''}`} title={dashboardTitle(data, 'Cyber Rings')} data={data} width={780} height={multi ? 860 : 825} onAdjust={adjust}><div className="source-rings__field">{rings.map((ring, index) => { const circumference = 2 * Math.PI * 82; const color = ring.color || ['#00f0ff', '#8a2be2', '#ff4d6d', '#00ffaa'][index % 4]; return <div key={index} className="source-rings__ring" style={{ left: `${ring.x}%`, top: `${ring.y}%`, width: `${(ring.r || 80) * 2}px`, height: `${(ring.r || 80) * 2}px`, color }}><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><circle cx="100" cy="100" r="82" fill="none" stroke={ring.trackColor || `${color}26`} strokeWidth={ring.strokeWidth || 14} strokeDasharray={ring.isDashed ? '5 7' : undefined}/><circle cx="100" cy="100" r="82" fill="none" stroke={color} strokeWidth={ring.strokeWidth || 14} strokeLinecap="round" strokeDasharray={ring.isDashed ? '5 7' : circumference} strokeDashoffset={ring.isDashed ? 0 : circumference * (1 - ring.value / 100)} transform="rotate(-90 100 100)" className="source-rings__progress"/><text x="100" y="106" textAnchor="middle" fill="#eaffff" fontSize={multi ? 18 : 22} fontWeight="700" data-aether-text-key={`ring-${index}`}>{ring.label || `${ring.value}%`}</text></svg></div>; })}</div><style>{`.source-rings .aether-source-dashboard__header{padding:0 10px 12px}.source-rings__field{position:relative;width:100%;height:780px;overflow:hidden}.source-rings__ring{position:absolute;transform:translate(-50%,-50%);transition:transform .35s cubic-bezier(.34,1.56,.64,1),filter .35s ease,opacity .5s ease;animation:source-ring-in .8s ease both}.source-rings__ring svg{display:block;width:100%;height:100%;overflow:visible}.source-rings__ring:hover{transform:translate(-50%,-50%) scale(1.08);filter:brightness(1.2) drop-shadow(0 0 25px currentColor)}.source-rings__progress{transition:stroke-dashoffset 1.2s cubic-bezier(.34,1.56,.64,1),opacity .5s ease;filter:drop-shadow(0 0 6px currentColor)}@keyframes source-ring-in{from{opacity:0;transform:translate(-50%,-50%) scale(.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style></DashboardSourceShell>;
};

const SourceHudGauge: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const value = Math.max(0, Math.min(100, chartNumber(data.value, 84))); const angle = -130 + value * 2.6;
  return <DashboardSourceShell className="source-hud" title={dashboardTitle(data, 'Cyber HUD')} data={data} width={600} height={640} onAdjust={(delta) => onDataChange?.({ value: Math.max(0, Math.min(100, value + delta * 5)) })}><div className="source-hud__body"><svg viewBox="0 0 500 500" preserveAspectRatio="xMidYMid meet"><defs><filter id="source-hud-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="250" cy="250" r="145" fill="none" stroke="rgba(0,240,255,.12)" strokeWidth="16"/><circle cx="250" cy="250" r="110" fill="none" stroke="#00f0ff" strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray={`${value} 100`} transform="rotate(-90 250 250)" className="source-hud__arc" filter="url(#source-hud-glow)"/><circle cx="250" cy="250" r="80" fill="none" stroke="rgba(138,43,226,.38)" strokeWidth="2" strokeDasharray="3 9"/><g transform={`rotate(${angle} 250 250)`}><path d="M250 250 L244 110 L256 110 Z" fill="#e6f7ff"/><circle cx="250" cy="250" r="12" fill="#071827" stroke="#00f0ff" strokeWidth="4"/></g><text x="250" y="246" textAnchor="middle" fill="#fff" fontSize="48" fontWeight="900" data-aether-text-key="hud-value">{Math.round(value)}</text><text x="250" y="275" textAnchor="middle" fill="#00f0ff" fontSize="18" letterSpacing="4" data-aether-text-key="hud-unit">{data.unit || '%'}</text></svg></div><style>{`.source-hud .aether-source-dashboard__header{padding:0 10px 12px}.source-hud__body{width:100%;height:600px;display:flex;align-items:center;justify-content:center}.source-hud__body svg{width:100%;height:100%;overflow:visible;transition:transform .4s cubic-bezier(.34,1.56,.64,1),filter .4s ease}.source-hud__body:hover svg{transform:scale(1.03);filter:brightness(1.15) drop-shadow(0 0 30px rgba(0,240,255,.35))}.source-hud__arc{transition:stroke-dasharray .8s ease}`}</style></DashboardSourceShell>;
};

const SourceRadarChart: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const defaults: DashboardRadarPoint[] = [{ label: '维度一', valueA: 85, valueB: 65 }, { label: '维度二', valueA: 75, valueB: 50 }, { label: '维度三', valueA: 90, valueB: 70 }, { label: '维度四', valueA: 65, valueB: 80 }, { label: '维度五', valueA: 80, valueB: 60 }, { label: '维度六', valueA: 70, valueB: 55 }];
  const points = (Array.isArray(data.radarData) && data.radarData.length ? data.radarData : defaults).map((point: any) => ({ label: String(point.label), valueA: chartNumber(point.valueA), valueB: chartNumber(point.valueB) })); const cx = 330; const cy = 260; const radius = 160;
  const pointString = (field: 'valueA' | 'valueB', scale = 1) => points.map((point, index) => { const angle = index * Math.PI * 2 / points.length; const r = point[field] / 100 * radius * scale; return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`; }).join(' ');
  const gridString = (scale: number) => points.map((_, index) => { const angle = index * Math.PI * 2 / points.length; return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`; }).join(' ');
  return <DashboardSourceShell className="source-radar" title={dashboardTitle(data, '某省总产值统计分析')} data={data} width={900} height={560} onAdjust={() => onDataChange?.({ radarData: [...points, { label: `维度${points.length + 1}`, valueA: 60, valueB: 50 }] })}><div className="source-radar__plot"><svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="source-radar-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0066ff" stopOpacity=".85"/><stop offset="100%" stopColor="#00f0ff" stopOpacity=".65"/></linearGradient></defs>{[1,2,3,4,5].map((level) => <polygon key={level} points={gridString(level / 5)} fill="none" stroke="rgba(0,150,255,.18)"/>)}{points.map((_, index) => { const angle = index * Math.PI * 2 / points.length; return <line key={index} x1={cx} y1={cy} x2={cx + Math.cos(angle) * radius} y2={cy + Math.sin(angle) * radius} stroke="rgba(0,150,255,.18)"/>; })}<polygon points={pointString('valueB')} fill="rgba(0,240,255,.13)" stroke="#00f0ff" strokeWidth="3" className="source-radar__poly"/><polygon points={pointString('valueA')} fill="url(#source-radar-a)" stroke="#0066ff" strokeWidth="2" className="source-radar__poly"/>{points.map((point, index) => { const angle = index * Math.PI * 2 / points.length; return <text key={index} x={cx + Math.cos(angle) * (radius + 30)} y={cy + Math.sin(angle) * (radius + 30)} textAnchor="middle" fill="#8fdcff" fontSize="14" data-aether-text-key={`radar-${index}`}>{point.label}</text>; })}</svg></div><style>{`.source-radar .aether-source-dashboard__header{padding:0 12px 8px}.source-radar__plot{width:100%;height:506px;overflow:hidden}.source-radar__plot svg{display:block;width:100%;height:100%;overflow:visible}.source-radar__poly{transition:filter .3s ease,opacity .3s ease}.source-radar__poly:hover{opacity:.9;filter:drop-shadow(0 0 10px #00f0ff)}`}</style></DashboardSourceShell>;
};

const Source3DDonutChart: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const segments = (Array.isArray(data.donutData) && data.donutData.length ? data.donutData : [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }]).map((segment: any, index: number) => ({ name: String(segment.name || 'XXXXXX'), value: Math.max(0, chartNumber(segment.value)), color: segment.color || ['#f0c46a', '#4ea8ff', '#8fd4d8'][index % 3] })); const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0)); let cursor = -90;
  const depth = Math.max(8, Math.min(42, chartNumber(data.depth, 24)));
  const polar = (angle: number, rx: number, ry: number, dy = 0) => ({ x: 300 + rx * Math.cos(angle * Math.PI / 180), y: 200 + ry * Math.sin(angle * Math.PI / 180) + dy });
  const path = (start: number, end: number) => { const a = polar(start, 170, 100); const b = polar(end, 170, 100); const c = polar(end, 95, 55); const d = polar(start, 95, 55); return `M ${a.x} ${a.y} A 170 100 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A 95 55 0 ${end - start > 180 ? 1 : 0} 0 ${d.x} ${d.y} Z`; };
  const sidePaths = (start: number, end: number) => {
    const paths: string[] = [];
    for (const turn of [-360, 0, 360]) {
      const frontStart = Math.max(start, turn);
      const frontEnd = Math.min(end, turn + 180);
      if (frontEnd - frontStart < 0.5) continue;
      const a = polar(frontStart, 170, 100);
      const b = polar(frontEnd, 170, 100);
      const bottomB = polar(frontEnd, 170, 100, depth);
      const bottomA = polar(frontStart, 170, 100, depth);
      paths.push(`M ${a.x} ${a.y} A 170 100 0 ${frontEnd - frontStart > 180 ? 1 : 0} 1 ${b.x} ${b.y} L ${bottomB.x} ${bottomB.y} A 170 100 0 ${frontEnd - frontStart > 180 ? 1 : 0} 0 ${bottomA.x} ${bottomA.y} Z`);
    }
    return paths;
  };
  return <DashboardSourceShell className="source-donut" title={dashboardTitle(data, '数据分布统计')} data={data} width={880} height={540} onAdjust={(delta) => onDataChange?.({ value: Math.max(0, Math.min(100, chartNumber(data.value, 100) + delta * 5)) })}><div className="source-donut__plot"><svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet"><defs><filter id="source-donut-shadow"><feGaussianBlur stdDeviation="14"/></filter></defs><ellipse cx="300" cy="250" rx="170" ry="42" fill="rgba(0,10,30,.55)" filter="url(#source-donut-shadow)"/>{segments.map((segment, index) => { const start = cursor; const end = cursor + segment.value / total * 360; cursor = end; return <g key={index} className="source-donut__sector">{sidePaths(start, end).map((sidePath, sideIndex) => <path key={sideIndex} d={sidePath} fill={`color-mix(in srgb, ${segment.color} 54%, #06122d)`} stroke="rgba(0,10,30,.35)" strokeWidth="1"/>)}<path d={path(start, end)} fill={segment.color} opacity=".96" stroke="rgba(255,255,255,.28)" strokeWidth="1"/><text x={polar((start + end) / 2, 190, 118).x} y={polar((start + end) / 2, 190, 118).y} textAnchor="middle" fill="#ecffff" fontSize="14" data-aether-text-key={`donut-${index}`}>{segment.name} {Math.round(segment.value)}%</text></g>; })}<ellipse cx="300" cy="200" rx="95" ry="55" fill="#06122d" stroke="rgba(0,234,255,.45)" strokeWidth="2"/><ellipse cx="300" cy={200 + depth} rx="95" ry="55" fill="none" stroke="rgba(0,10,30,.6)" strokeWidth="1"/><text x="300" y="208" textAnchor="middle" fill="#fff" fontSize="25" fontWeight="700">100%</text></svg></div><style>{`.source-donut .aether-source-dashboard__header{padding:0 12px 12px}.source-donut__plot{width:100%;height:440px}.source-donut__plot svg{display:block;width:100%;height:100%;overflow:visible}.source-donut__sector{transition:filter .3s ease;cursor:pointer}.source-donut__sector:hover{filter:brightness(1.2) drop-shadow(0 0 12px currentColor)}`}</style></DashboardSourceShell>;
};

const SourceDistributionChart: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const points = (Array.isArray(data.distributionData) && data.distributionData.length ? data.distributionData : [{ name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 35 }, { name: 'XXXXXX', value: 30 }]).map((point: any) => ({ name: String(point.name || ''), value: Math.max(0, chartNumber(point.value)) })); const total = Math.max(1, points.reduce((sum, point) => sum + point.value, 0)); const colors = ['#f0c46a', '#4ea8ff', '#8fd4d8'];
  return <DashboardSourceShell className="source-distribution" title={dashboardTitle(data, '数据分布统计')} data={data} width={880} height={550} onAdjust={(delta) => onDataChange?.({ distributionData: points.map((point, index) => index === 0 ? { ...point, value: Math.max(0, point.value + delta * 5) } : point) })}><div className="source-distribution__body"><div className="source-distribution__bar">{points.map((point, index) => <div key={index} style={{ width: `${point.value / total * 100}%`, background: colors[index % colors.length] }}/>)}</div>{points.map((point, index) => <div className="source-distribution__row" key={index}><span className="source-distribution__dot" style={{ background: colors[index % colors.length] }}/><span data-aether-text-key={`distribution-name-${index}`}>{point.name}</span><b data-aether-text-key={`distribution-value-${index}`}>{point.value}%</b><i style={{ width: `${point.value / total * 100}%`, background: colors[index % colors.length] }}/></div>)}</div><style>{`.source-distribution .aether-source-dashboard__header{padding:0 12px 12px}.source-distribution__body{height:490px;padding:38px 30px}.source-distribution__bar{display:flex;height:18px;overflow:hidden;border-radius:4px;box-shadow:0 0 14px rgba(0,234,255,.25)}.source-distribution__bar>div{height:100%;transition:width .7s ease}.source-distribution__row{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:10px;position:relative;margin-top:22px;color:#8fdcff;font-size:14px}.source-distribution__dot{width:8px;height:8px;border-radius:50%;box-shadow:0 0 8px currentColor}.source-distribution__row b{color:#fff}.source-distribution__row i{position:absolute;left:22px;right:0;bottom:-9px;height:1px;opacity:.5;transition:width .6s ease}`}</style></DashboardSourceShell>;
};


type TelemetryData = GalaxyCardData & {
  theme?: 'dark' | 'light';
  dataBinding?: { freshness?: { warningAfterMs?: number; offlineAfterMs?: number }; thresholds?: { warning?: number; critical?: number; direction?: 'above' | 'below' }; [key: string]: any };
  visual?: { assetRefId?: string; assetUrl?: string; assetKind?: VisualAssetKind; assetName?: string; fit?: 'contain' | 'cover'; opacity?: number; tint?: string };
  assetKind?: VisualAssetKind;
  assetName?: string;
  assetUrl?: string;
  value?: number;
  unit?: string;
  status?: 'normal' | 'info' | 'warning' | 'critical' | 'offline' | 'unknown';
  freshnessMs?: number;
  series?: number[];
  categories?: string[];
  rows?: Array<{ label: string; value: string | number; status?: string }>;
  items?: Array<{ label: string; value: string; status?: string }>;
  location?: { latitude: number; longitude: number; satellites: number; hdop: number; provider: string };
  topology?: { nodes: Array<{ id: string; label: string; status: string }>; links: Array<{ from: string; to: string; status: string }> };
  repeat?: { maxItems?: number; overflow?: 'adaptive' | 'scroll' | 'clip' };
  lowMotion?: boolean;
  motionEnabled?: boolean;
};

type VisualAssetKind = 'image' | 'video' | 'panorama-img' | 'panorama-vid' | 'model-3d' | 'gaussian-splat' | 'audio' | 'font' | 'other';

const statusTone = (status: TelemetryData['status'] = 'normal') => ({
  normal: '#34d399', info: '#38bdf8', warning: '#f59e0b', critical: '#fb7185', offline: '#94a3b8', unknown: '#a78bfa',
}[status] || '#34d399');

const telemetryValue = (data: TelemetryData, fallback = 72) => Number.isFinite(data.value) ? Number(data.value) : fallback;

const DataShell: React.FC<{ data: TelemetryData; title: string; children: React.ReactNode; className?: string }> = ({ data, title, children, className = '' }) => {
  const tone = statusTone(data.status);
  const freshness = data.dataBinding?.freshness || {};
  const warningAfter = Number(freshness.warningAfterMs ?? 5000);
  const offlineAfter = Number(freshness.offlineAfterMs ?? 15000);
  const stale = (data.freshnessMs ?? 1200) >= offlineAfter;
  const statusLabel = ({ normal: '正常', info: '信息', warning: '预警', critical: '严重', offline: '离线', unknown: '未知' } as Record<string, string>)[data.status || 'normal'] || '未知';
  const delayed = (data.freshnessMs ?? 1200) >= warningAfter;
  return <div className={`aether-data-shell ${className} ${data.theme === 'light' ? 'aether-data-shell--light' : ''}`} style={{ '--data-accent': data.accentColor || data.color || tone, '--data-tone': tone, '--data-text': data.textColor || '#f8fbff', '--data-muted': data.mutedTextColor || '#88a5ba', '--data-surface': data.surfaceColor || '#0b1b2e', '--data-border': data.borderColor || data.accentColor || data.color || tone } as React.CSSProperties}>
    <div className="aether-data-head"><span className="aether-data-kicker">{data.label || title}</span><span className="aether-data-status"><i />{stale ? '离线' : delayed ? '延迟' : statusLabel}</span></div>
    {children}
    <style>{`.aether-data-shell{box-sizing:border-box;position:relative;isolation:isolate;width:100%;height:100%;min-width:180px;min-height:110px;padding:16px 18px;overflow:hidden;color:var(--data-text);background:linear-gradient(145deg,color-mix(in srgb,var(--data-surface) 96%,#091423),color-mix(in srgb,var(--data-surface) 82%,#0c1c30));border:1px solid color-mix(in srgb,var(--data-border) 48%,rgba(148,163,184,.25));border-radius:8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -10px 24px rgba(0,0,0,.16),0 12px 28px rgba(2,8,23,.28);font-family:inherit}.aether-data-shell--light{background:linear-gradient(145deg,#fff,#f6f9fc);border-color:#e2e8f0;box-shadow:0 8px 20px rgba(15,23,42,.06);color:#172033}.aether-data-shell--light::before{background:linear-gradient(118deg,rgba(255,255,255,.8),transparent 34%,transparent 72%,color-mix(in srgb,var(--data-accent) 5%,transparent))}.aether-data-shell--light .aether-data-kicker,.aether-data-shell--light .aether-data-status,.aether-data-shell--light small{color:#64748b}.aether-data-shell--light h3,.aether-data-shell--light .aether-metric-card strong{color:#172033;text-shadow:none}.aether-data-shell--light .aether-donut-ring>div{background:#fff}.aether-data-shell::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.075),transparent 24%,transparent 72%,color-mix(in srgb,var(--data-accent) 11%,transparent));opacity:.7}.aether-data-shell::after{content:'';position:absolute;left:0;top:14px;bottom:14px;width:2px;pointer-events:none;background:linear-gradient(180deg,transparent,var(--data-accent),transparent);box-shadow:0 0 12px color-mix(in srgb,var(--data-accent) 70%,transparent);opacity:.8}.aether-data-shell > *:not(style){position:relative;z-index:1}.aether-data-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.aether-data-kicker{font-size:11px;letter-spacing:.08em;color:var(--data-muted);text-transform:uppercase}.aether-data-status{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--data-muted);white-space:nowrap}.aether-data-status i{width:6px;height:6px;border-radius:50%;background:var(--data-tone);box-shadow:0 0 10px var(--data-tone)}.aether-data-shell h3{margin:0;color:var(--data-text);font-size:24px;line-height:1.1;font-weight:700}.aether-data-shell small{color:var(--data-muted);font-size:11px}.aether-data-shell svg{display:block;width:100%;height:100%}@media(prefers-reduced-motion:reduce){.aether-data-shell *{animation:none!important;transition:none!important}}`}</style>
  </div>;
};

const MetricCard: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const fallback = typeof data.content === 'string' ? Number.parseFloat(data.content.replace(/[^\d.-]/g, '')) : NaN;
  const value = Number.isFinite(Number(data.value)) ? Number(data.value) : fallback;
  const display = Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : (data.content || '--');
  return <DataShell data={data} title="核心指标"><div className="aether-metric-card"><strong>{display}</strong><span>{data.unit || (typeof data.content === 'string' && /[%％]/.test(data.content) ? '%' : '')}</span></div><style>{`.aether-metric-card{display:flex;align-items:baseline;gap:8px;min-height:66px}.aether-metric-card strong{font-size:34px;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--data-text);text-shadow:0 0 18px color-mix(in srgb,var(--data-accent) 48%,transparent);transition:color .25s ease}.aether-metric-card span{font-size:12px;color:var(--data-muted)}`}</style></DataShell>;
};

const FlipNumber: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const [value, setValue] = useState(telemetryValue(data, 12840));
const isRealtime = data.dataBinding?.refresh === 'realtime' && ['mock.telemetry', 'mqtt.realtime'].includes(data.dataBinding?.sourceId);
  useEffect(() => { const next = telemetryValue(data, value); if (Number.isFinite(next)) setValue(next); }, [data.value]);
  useEffect(() => { if (data.lowMotion || isRealtime) return; const id = window.setInterval(() => setValue((v) => v + (Math.random() > .5 ? 1 : -1) * Math.max(1, Math.round(v * .002))), 2200); return () => window.clearInterval(id); }, [data.lowMotion, isRealtime]);
  return <DataShell data={data} title="实时翻牌数字"><div className="aether-flip-value" key={value}><strong>{Math.round(value).toLocaleString()}</strong><span>{data.unit || '条 / min'}</span></div><style>{`.aether-flip-value{display:flex;align-items:baseline;gap:8px}.aether-flip-value strong{font-variant-numeric:tabular-nums;letter-spacing:.03em;color:#f8fbff;font-size:32px;line-height:1.1;text-shadow:0 0 18px color-mix(in srgb,var(--data-accent) 50%,transparent);animation:aether-flip .35s ease-out}.aether-flip-value span{color:#7e9bb0;font-size:11px}@keyframes aether-flip{from{transform:translateY(-5px);opacity:.35}to{transform:none;opacity:1}}`}</style></DataShell>;
};

const Gauge: React.FC<{ data: TelemetryData }> = ({ data }) => { const value = Math.max(0, Math.min(100, telemetryValue(data))); const tone = statusTone(data.status); return <DataShell data={data} title="仪表盘"><div className="aether-gauge"><svg viewBox="0 0 180 100" role="img" aria-label={`${value}${data.unit || '%'}`}><path d="M20 88 A70 70 0 0 1 160 88" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="12" strokeLinecap="round"/><path d="M20 88 A70 70 0 0 1 160 88" fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray={`${value} 100`} style={{ filter: `drop-shadow(0 0 7px ${tone})` }}/></svg><div className="aether-gauge-label"><b>{value.toFixed(0)}</b><span>{data.unit || '%'}</span></div></div><style>{`.aether-gauge{position:relative;height:76px}.aether-gauge-label{position:absolute;inset:34px 0 auto;text-align:center}.aether-gauge-label b{font-size:28px;color:var(--data-text)}.aether-gauge-label span{font-size:12px;color:var(--data-muted);margin-left:2px}`}</style></DataShell>; };

const TrendLine: React.FC<{ data: TelemetryData }> = ({ data }) => { const [tick, setTick] = useState(0); useEffect(() => { if (data.lowMotion) return; const id = window.setInterval(() => setTick((v) => v + 1), 2400); return () => window.clearInterval(id); }, [data.lowMotion]); const configured = data.series?.length ? data.series : [32, 46, 41, 58, 52, 68, 64, 78]; const maxItems = Math.max(1, Math.floor(Number(data.repeat?.maxItems) || configured.length)); const values = configured.slice(0, maxItems).map((v, i) => v + (tick % 2 ? (i % 2 ? 1 : -1) : 0)); const max = Math.max(...values, 1); const min = Math.min(...values, 0); const points = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${88 - ((v - min) / Math.max(1, max - min)) * 68}`).join(' '); return <DataShell data={data} title="趋势分析" className="aether-chart-shell"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="aether-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--data-accent)" stopOpacity=".35"/><stop offset="1" stopColor="var(--data-accent)" stopOpacity="0"/></linearGradient></defs><path d={`M0 88 L${points.replace(/ /g, ' L')} L100 88 Z`} fill="url(#aether-trend-fill)"/><polyline points={points} fill="none" stroke="var(--data-accent)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/><line x1="0" y1="88" x2="100" y2="88" stroke="rgba(148,163,184,.2)" vectorEffect="non-scaling-stroke"/></svg><style>{`.aether-chart-shell{min-height:150px}.aether-chart-shell .aether-data-head{margin-bottom:6px}.aether-chart-shell svg{height:100px}`}</style></DataShell>; };

const BarChart: React.FC<{ data: TelemetryData }> = ({ data }) => { const values = data.series?.length ? data.series : [46, 68, 54, 82, 61, 74]; const labels = data.categories?.length ? data.categories : ['一','二','三','四','五','六']; return <DataShell data={data} title="排行分析" className="aether-chart-shell"><div className="aether-bars">{values.map((v, i) => <div className="aether-bar-col" key={`${labels[i] || i}`}><div className="aether-bar" style={{ height: `${Math.max(8, Math.min(100, v))}%` }} /><span>{labels[i] || i + 1}</span></div>)}</div><style>{`.aether-bars{height:102px;display:flex;align-items:end;gap:10px;padding:0 4px}.aether-bar-col{height:100%;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:5px}.aether-bar{width:100%;max-width:24px;border-radius:3px 3px 1px 1px;background:linear-gradient(180deg,var(--data-accent),color-mix(in srgb,var(--data-accent) 28%,transparent));box-shadow:0 0 14px color-mix(in srgb,var(--data-accent) 35%,transparent);transition:height .5s ease}.aether-bar-col span{font-size:9px;color:#7994aa}`}</style></DataShell>; };

const DonutChart: React.FC<{ data: TelemetryData }> = ({ data }) => { const value = Math.max(0, Math.min(100, telemetryValue(data, 76))); return <DataShell data={data} title="完成率"><div className="aether-donut"><div className="aether-donut-ring" style={{ background: `conic-gradient(var(--data-accent) ${value}%, rgba(148,163,184,.16) 0)` }}><div><b>{value.toFixed(0)}%</b><small>完成</small></div></div><div className="aether-donut-legend"><span><i style={{ background: 'var(--data-accent)' }} />已完成</span><span><i />待处理</span></div></div><style>{`.aether-donut{display:flex;align-items:center;gap:18px}.aether-donut-ring{width:82px;height:82px;border-radius:50%;display:grid;place-items:center}.aether-donut-ring>div{width:58px;height:58px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b1b2e}.aether-donut-ring b{font-size:17px;color:#f8fbff}.aether-donut-ring small{font-size:9px;color:#87a2b8}.aether-donut-legend{display:flex;flex-direction:column;gap:7px;color:#8fa8be;font-size:10px}.aether-donut-legend span{display:flex;align-items:center;gap:6px}.aether-donut-legend i{width:7px;height:7px;border-radius:50%;background:rgba(148,163,184,.35)}`}</style></DataShell>; };

const StatsTable: React.FC<{ data: TelemetryData }> = ({ data }) => { const rows = data.rows?.length ? data.rows : [{ label: '北区站点', value: '98.6%', status: '正常' }, { label: '南区站点', value: '94.2%', status: '预警' }, { label: '边缘网关', value: '1.8s', status: '在线' }]; return <DataShell data={data} title="统计表"><div className="aether-stats-table">{rows.slice(0, 4).map((row) => <div className="aether-stats-row" key={row.label}><span>{row.label}</span><b>{row.value}</b><em>{row.status || '正常'}</em></div>)}</div><style>{`.aether-stats-table{display:flex;flex-direction:column;gap:7px}.aether-stats-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding-bottom:6px;border-bottom:1px solid rgba(148,163,184,.12);font-size:10px;color:#9bb2c4}.aether-stats-row b{font-variant-numeric:tabular-nums;color:#e7f3fb;font-size:12px}.aether-stats-row em{font-style:normal;color:var(--data-tone);font-size:9px}`}</style></DataShell>; };

const AlertList: React.FC<{ data: TelemetryData }> = ({ data }) => { const items = data.items?.length ? data.items : [{ label: '冷却水回路压力偏低', value: '08:42', status: '预警' }, { label: '北斗终端 004 已恢复', value: '08:39', status: '信息' }, { label: '电池组温度正常', value: '08:36', status: '正常' }]; return <DataShell data={data} title="告警动态"><div className="aether-alert-list">{items.slice(0, 4).map((item, i) => { const status = String(item.status || '').toLowerCase(); const alert = ['预警', '严重', 'warning', 'critical', 'error', 'fault'].includes(status); return <div className="aether-alert-row" key={`${item.label}-${i}`}><i className={alert ? 'is-alert' : ''} /><span>{item.label}</span><time>{item.value}</time></div>; })}</div><style>{`.aether-alert-list{display:flex;flex-direction:column;gap:9px}.aether-alert-row{display:grid;grid-template-columns:7px 1fr auto;align-items:center;gap:8px;font-size:10px;color:#b6c8d5}.aether-alert-row i{width:6px;height:6px;border-radius:50%;background:#34d399}.aether-alert-row i.is-alert{background:#f59e0b;box-shadow:0 0 10px #f59e0b;animation:aether-alert-pulse 1.6s infinite}.aether-alert-row time{font-variant-numeric:tabular-nums;color:#6f899e;font-size:9px}@keyframes aether-alert-pulse{50%{transform:scale(1.7);opacity:.55}}`}</style></DataShell>; };

const Freshness: React.FC<{ data: TelemetryData }> = ({ data }) => { const ms = data.freshnessMs ?? 1200; const warningAfter = Number(data.dataBinding?.freshness?.warningAfterMs ?? 5000); const offlineAfter = Number(data.dataBinding?.freshness?.offlineAfterMs ?? 15000); const offline = ms >= offlineAfter; const warning = ms >= warningAfter; return <DataShell data={data} title="数据新鲜度"><div className="aether-freshness"><strong>{offline ? '离线' : `${(ms / 1000).toFixed(1)}s`}</strong><span>{offline ? '等待连接恢复' : warning ? '数据延迟，请关注' : '实时同步中'}</span></div><div className="aether-freshness-track"><i style={{ width: `${offline ? 12 : Math.max(16, 100 - Math.min(80, ms / Math.max(1, offlineAfter / 80)))}%` }} /></div><style>{`.aether-freshness strong{display:block;font-size:27px;color:var(--data-tone)}.aether-freshness span{display:block;margin-top:5px;font-size:10px;color:var(--data-muted)}.aether-freshness-track{height:4px;margin-top:18px;border-radius:4px;background:rgba(148,163,184,.15);overflow:hidden}.aether-freshness-track i{display:block;height:100%;border-radius:inherit;background:var(--data-tone);transition:width .5s ease}`}</style></DataShell>; };

const DataProgressBar: React.FC<{ data: TelemetryData }> = ({ data }) => <DataShell data={data} title="进度"><GalaxyGradientProgress value={Math.max(0, Math.min(100, telemetryValue(data, 65)))} color={data.color || data.accentColor || '#06b6d4'} /></DataShell>;
const DataProgressRing: React.FC<{ data: TelemetryData }> = ({ data }) => <DataShell data={data} title="百分比"><GalaxyProgressRing value={Math.max(0, Math.min(100, telemetryValue(data, 75)))} color={data.color || data.accentColor || '#06b6d4'} size={88} /></DataShell>;

const GeoMap: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const location = data.location || { latitude: 31.2304, longitude: 121.4737, satellites: 18, hdop: 0.8, provider: 'GPS + 北斗' };
  const pointLeft = 50 + Math.sin(location.longitude * 100) * 26;
  const pointTop = 50 + Math.cos(location.latitude * 100) * 25;
  return <DataShell data={data} title="GPS / 北斗定位"><div className="aether-geo-map"><div className="aether-geo-grid" /><div className="aether-geo-route" /><span className="aether-geo-point" style={{ left: `${pointLeft}%`, top: `${pointTop}%` }} /><div className="aether-geo-coords"><b>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</b><span>{location.provider} · {location.satellites} 颗卫星 · HDOP {location.hdop.toFixed(1)}</span></div></div><style>{`.aether-geo-map{position:relative;height:106px;overflow:hidden;border:1px solid rgba(56,189,248,.18);background:#071522}.aether-geo-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(56,189,248,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.12) 1px,transparent 1px);background-size:24px 24px;transform:perspective(180px) rotateX(45deg) scale(1.35);transform-origin:center bottom}.aether-geo-route{position:absolute;left:18%;top:68%;width:66%;height:1px;background:var(--data-accent);transform:rotate(-24deg);box-shadow:0 0 8px var(--data-accent)}.aether-geo-point{position:absolute;width:12px;height:12px;border:2px solid #d1fae5;border-radius:50%;background:var(--data-tone);box-shadow:0 0 0 6px color-mix(in srgb,var(--data-tone) 18%,transparent),0 0 18px var(--data-tone);transform:translate(-50%,-50%)}.aether-geo-coords{position:absolute;left:8px;right:8px;bottom:7px;display:flex;justify-content:space-between;align-items:end;gap:8px;font-size:9px;color:#a8c4d7}.aether-geo-coords b{font-variant-numeric:tabular-nums;color:#e8f7ff}.aether-geo-coords span{text-align:right;color:#7c9aae}`}</style></DataShell>;
};

const Topology: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const topology = data.topology || { nodes: [{ id: 'gateway', label: 'MQTT 网关', status: 'normal' }, { id: 'device', label: '设备终端', status: data.status || 'normal' }, { id: 'sensor', label: '传感器', status: 'normal' }], links: [{ from: 'gateway', to: 'device', status: 'normal' }, { from: 'device', to: 'sensor', status: 'normal' }] };
  const positions = [{ left: '16%', top: '50%' }, { left: '50%', top: '50%' }, { left: '84%', top: '50%' }];
  const tone = (value: string) => statusTone(normalizeTopologyStatus(value));
  return <DataShell data={data} title="设备拓扑"><div className="aether-topology"><div className="aether-topology-line one" /><div className="aether-topology-line two" />{topology.nodes.slice(0, 3).map((node, index) => <div className="aether-topology-node" style={{ ...positions[index], '--node-tone': tone(node.status) } as React.CSSProperties} key={node.id}><span>{index === 0 ? 'GW' : index === 1 ? 'DEV' : 'I/O'}</span><small>{node.label}</small></div>)}</div><style>{`.aether-topology{position:relative;height:108px;background:linear-gradient(145deg,rgba(8,24,42,.92),rgba(3,10,20,.82));border:1px solid rgba(167,139,250,.24);box-shadow:inset 0 1px rgba(255,255,255,.07),inset 0 -12px 18px rgba(0,0,0,.18)}.aether-topology-line{position:absolute;top:50%;height:2px;width:34%;background:linear-gradient(90deg,transparent,var(--data-accent),transparent);opacity:.78;box-shadow:0 0 8px var(--data-accent)}.aether-topology-line.one{left:17%}.aether-topology-line.two{left:50%}.aether-topology-node{position:absolute;display:flex;transform:translate(-50%,-50%);align-items:center;flex-direction:column;gap:5px;color:#b9c8d8}.aether-topology-node span{display:grid;place-items:center;width:35px;height:35px;border:1px solid var(--node-tone);border-radius:50%;background:linear-gradient(145deg,color-mix(in srgb,var(--node-tone) 25%,#081426),color-mix(in srgb,var(--node-tone) 7%,#050d18));box-shadow:inset 0 1px rgba(255,255,255,.18),inset 0 -4px 8px rgba(0,0,0,.32),0 0 16px color-mix(in srgb,var(--node-tone) 38%,transparent);font-size:9px;font-weight:700;color:var(--node-tone)}.aether-topology-node small{display:block;box-sizing:border-box;width:100px;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;font-size:9px;color:#a8bfd0}`}</style></DataShell>;
};

const normalizeTopologyStatus = (value: string): TelemetryData['status'] => {
  const normalized = String(value || '').toLowerCase();
  return normalized === 'fault' || normalized === 'critical' ? 'critical' : normalized === 'warning' || normalized === 'warn' ? 'warning' : normalized === 'offline' ? 'offline' : 'normal';
};

type OfficialDataPoint = { id?: string; label: string; value: number; color?: string };
type OfficialFlowNode = { id?: string; label: string; type?: string; color?: string };
type OfficialTableRow = { id?: string; cells: string[]; status?: string };

const OFFICIAL_PALETTE = ['#36d9ff', '#82f3c4', '#ffb86b', '#a78bfa', '#ff7aa8', '#fbbf24'];
const asNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeDataPoints = (value: unknown, labels = ['A', 'B', 'C', 'D', 'E', 'F']): OfficialDataPoint[] => {
  if (!Array.isArray(value) || value.length === 0) return labels.map((label, index) => ({ id: `point-${index}`, label, value: [38, 62, 48, 78, 56, 88][index] ?? 50, color: OFFICIAL_PALETTE[index % OFFICIAL_PALETTE.length] }));
  return value.map((item, index) => {
    if (typeof item === 'number') return { id: `point-${index}`, label: labels[index] || `Item ${index + 1}`, value: item, color: OFFICIAL_PALETTE[index % OFFICIAL_PALETTE.length] };
    const point = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { id: String(point.id || `point-${index}`), label: String(point.label || point.name || labels[index] || `Item ${index + 1}`), value: asNumber(point.value, 0), color: String(point.color || OFFICIAL_PALETTE[index % OFFICIAL_PALETTE.length]) };
  });
};
const normalizeFlowNodes = (value: unknown, fallbackLabel: string): OfficialFlowNode[] => {
  if (!Array.isArray(value) || value.length === 0) return [
    { id: 'start', label: 'Start', type: 'start' },
    { id: 'process', label: fallbackLabel, type: 'process' },
    { id: 'end', label: 'End', type: 'end' },
  ];
  return value.map((item, index) => {
    const node = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const allowedTypes = new Set([
      'start', 'start-end', 'process', 'decision', 'end', 'document', 'flow-document', 'data', 'flow-data',
      'subprocess', 'external-data', 'internal-storage', 'queue-data', 'database', 'manual-input', 'flow-card',
      'flow-strip', 'display', 'manual-operation', 'prepare', 'loop', 'loop-limit', 'page-reference', 'or-node',
      'sum-node', 'cross-page-reference', 'sort', 'sort-node', 'merge', 'merge-node', 'parallel', 'parallel-node',
      'flow-note', 'remark',
    ]);
    const type = String(node.type || 'process');
    return { id: String(node.id || `node-${index}`), label: String(node.label || `Node ${index + 1}`), type: allowedTypes.has(type) ? type : 'process', color: typeof node.color === 'string' ? node.color : undefined };
  });
};
const normalizeTableRows = (value: unknown, columns: string[]): OfficialTableRow[] => {
  if (!Array.isArray(value) || value.length === 0) return [['Device', '1284', 'Normal'], ['Visits', '923', 'Normal'], ['Load', '42%', 'Warning']].map((cells, index) => ({ id: `row-${index}`, cells }));
  return value.map((item, index) => {
    if (Array.isArray(item)) return { id: `row-${index}`, cells: columns.map((_, columnIndex) => String(item[columnIndex] ?? '')) };
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { id: String(row.id || `row-${index}`), cells: Array.isArray(row.cells) ? row.cells.map(String) : columns.map((column) => String(row[column] ?? '')) };
  });
};

const OFFICIAL_SPECIAL_IDS = new Set(['dynamic-number', 'big-number', 'metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6', 'weather-card', 'camera-panel', 'popup-1', 'popup-2', 'popup-3', 'popup-4', 'popup-5', 'popup-6', 'frame-style-1', 'frame-style-2', 'frame-style-3', 'frame-style-4', 'map-chengdu', 'map-chongqing', 'map-beijing', 'map-shanghai', 'map-guangzhou', 'map-shenzhen', 'dynamic-bar', '3d-bar', 'button-tech-1', 'button-tech-2', 'button-tech-3', 'button-tech-4', 'button-text-1', 'button-text-2', 'button-text-3', 'button-text-4', 'button-text-5', 'button-text-6', 'top-title', 'card-basic', 'card-outline', 'card-media', 'card-profile', 'card-stat', 'card-list', 'notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert', 'spinner-loader', 'dots-loader', 'ring-loader', 'wave-loader', 'solid-badge', 'outline-badge', 'status-badge', 'count-badge', 'avatar', 'avatar-group', 'rating', 'divider', 'tooltip', 'empty-state', 'skeleton']);

function useAnimatedMetricValue(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  useEffect(() => {
    const end = Number.isFinite(target) ? target : 0;
    const start = valueRef.current;
    const delta = end - start;
    if (Math.abs(delta) < 0.001) {
      valueRef.current = end;
      setValue(end);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + delta * eased;
      valueRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

const AnimatedMetricText: React.FC<{ value: number }> = ({ value }) => {
  const animated = useAnimatedMetricValue(value);
  return <>{animated.toLocaleString(undefined, { maximumFractionDigits: 1 })}</>;
};

const AnimatedMetricDigits: React.FC<{ value: number }> = ({ value }) => {
  const animated = useAnimatedMetricValue(value);
  return <>{String(Math.round(animated)).padStart(5, '0').split('').map((digit, index) => <b key={index} style={{ padding: '5px 8px', color: '#f4ffff', background: '#102a50', font: '700 22px monospace' }}>{digit}</b>)}</>;
};

const OfficialSpecialRenderer: React.FC<{ data: any; interactive?: boolean; onDataChange?: (patch: Record<string, any>) => void; onAction?: (action: string) => void }> = ({ data, interactive = true, onDataChange, onAction }) => {
  const id = inferOfficialModaoId(data);
  const accent = String(data.color || data.accentColor || '#41ddff');
  useEffect(() => {
    const notificationIds = ['notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'];
    const duration = asNumber(data.duration, 0);
    if (!interactive || !notificationIds.includes(id) || data.dismissed || duration <= 0) return;
    const timer = window.setTimeout(() => onDataChange?.({ dismissed: true }), Math.max(500, duration));
    return () => window.clearTimeout(timer);
  }, [id, interactive, onDataChange, data.dismissed, data.duration]);
  const usesCardSurface = id.startsWith('card-')
    || ['dynamic-number', 'big-number', 'metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6', 'weather-card', 'camera-panel', 'notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'].includes(id)
    || id.startsWith('popup-')
    || id.startsWith('frame-style-');
  // Components such as buttons, badges, loaders, dividers and charts should sit
  // directly on the canvas. Only semantic cards/windows opt into an outer surface.
  const surface = String(data.surface || (usesCardSurface ? (id === 'toast' ? 'subtle' : 'card') : 'transparent'));
  const shellCard = (children: React.ReactNode, className = '') => <div className={`aether-special-official ${className} surface-${surface}`} data-anchor={String(data.anchor || 'center')} style={{ '--special-accent': accent, boxSizing: 'border-box', width: '100%', height: '100%', minHeight: surface === 'transparent' ? 0 : 108, padding: surface === 'transparent' ? 0 : 14, color: '#e8f9ff', background: surface === 'transparent' ? 'transparent' : surface === 'subtle' ? 'rgba(8,28,43,.52)' : 'linear-gradient(145deg,#0d2638,#071522)', border: surface === 'transparent' ? '0' : surface === 'subtle' ? `1px solid color-mix(in srgb,${accent} 25%,transparent)` : `1px solid color-mix(in srgb,${accent} 52%,#1d3c50)`, borderRadius: surface === 'transparent' ? 0 : `${Math.max(0, Number(data.borderRadius ?? 8))}px`, boxShadow: surface === 'card' ? 'inset 0 1px rgba(255,255,255,.08),0 12px 26px rgba(0,0,0,.24)' : 'none', fontFamily: 'inherit', overflow: 'hidden' } as React.CSSProperties}>{children}</div>;
  if (id === 'card-basic') {
    return shellCard(<>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 8, borderBottom: `1px solid ${accent}45` }}><i style={{ width: 7, height: 24, borderRadius: 4, background: accent, boxShadow: `0 0 12px ${accent}` }} /><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', color: '#f2fbff', fontSize: 14 }}>{String(data.title || '基础卡片')}</strong><small style={{ color: '#7798a8', fontSize: 9 }}>{String(data.subtitle || '通用信息面板')}</small></div><span style={{ color: accent, fontSize: 10 }}>•••</span></div>
      <p style={{ margin: '10px 0 12px', color: '#a7c1cc', fontSize: 11, lineHeight: 1.55 }}>{String(data.content || '可编辑的卡片正文内容，适合承载说明信息。')}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#7f9daa', fontSize: 10 }}><span>{String(data.status || '正常')}</span><button type="button" onClick={() => interactive && onDataChange?.({ lastAction: String(data.action || 'view') })} style={{ border: 0, padding: '4px 8px', borderRadius: 4, color: accent, background: `${accent}18`, cursor: interactive ? 'pointer' : 'default' }}>{String(data.actionLabel || '查看详情')} →</button></div>
    </>, 'special-card special-card-basic');
  }
  if (id === 'card-outline') {
    return shellCard(<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><div><small style={{ display: 'block', color: accent, letterSpacing: 1, fontSize: 9 }}>{String(data.eyebrow || 'OUTLINE')}</small><strong style={{ display: 'block', marginTop: 3, color: '#f1fbff', fontSize: 14 }}>{String(data.title || '描边卡片')}</strong></div><i style={{ width: 18, height: 18, border: `1px solid ${accent}`, transform: 'rotate(45deg)', boxShadow: `0 0 10px ${accent}55` }} /></div>
      <div style={{ display: 'grid', gap: 6, margin: '14px 0 12px' }}><span style={{ height: 5, width: '92%', borderRadius: 3, background: '#2a5266' }} /><span style={{ height: 5, width: '68%', borderRadius: 3, background: '#21465a' }} /><span style={{ height: 5, width: '78%', borderRadius: 3, background: '#21465a' }} /></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${accent}35`, color: '#86a4b0', fontSize: 10 }}><span>{String(data.footer || '更多信息')}</span><button type="button" onClick={() => interactive && onDataChange?.({ lastAction: String(data.action || 'more') })} style={{ border: 0, color: accent, background: 'transparent', cursor: interactive ? 'pointer' : 'default' }}>→</button></div>
    </>, 'special-card special-card-outline');
  }
  if (id === 'card-media') {
    const mediaSrc = String(data.imageUrl || data.mediaUrl || '');
    return shellCard(<>
      <div style={{ position: 'relative', height: 74, overflow: 'hidden', borderRadius: 6, background: mediaSrc ? '#0c2636' : `linear-gradient(135deg, ${accent}55, #0b1c2d 65%)` }}>{mediaSrc ? <img src={mediaSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><i style={{ position: 'absolute', inset: '18px 30px', border: `1px dashed ${accent}99`, borderRadius: 5 }} /><i style={{ position: 'absolute', left: '42%', top: '31%', width: 22, height: 22, border: `2px solid ${accent}`, borderRadius: '50%' }} /></>}<span style={{ position: 'absolute', right: 7, bottom: 6, padding: '2px 5px', borderRadius: 3, color: '#e9fbff', background: '#061522b8', fontSize: 8 }}>{String(data.mediaTag || 'MEDIA')}</span></div>
      <div style={{ paddingTop: 9 }}><strong style={{ display: 'block', color: '#f1fbff', fontSize: 13 }}>{String(data.title || '图文卡片')}</strong><small style={{ display: 'block', marginTop: 5, color: '#91acb8', fontSize: 10, lineHeight: 1.45 }}>{String(data.caption || data.content || '图片与说明内容')}</small></div>
    </>, 'special-card special-card-media');
  }
  if (id === 'card-profile') {
    const avatarSrc = String(data.avatarUrl || '');
    return shellCard(<>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><i style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, overflow: 'hidden', flex: '0 0 auto', border: `2px solid ${accent}`, borderRadius: '50%', color: '#eafcff', background: `linear-gradient(145deg, ${accent}88, #132e44)`, fontStyle: 'normal', fontSize: 16 }}>{avatarSrc ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(data.avatarText || 'A')}</i><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', color: '#f1fbff', fontSize: 13 }}>{String(data.name || data.title || '个人资料卡')}</strong><small style={{ display: 'block', marginTop: 3, color: '#8eaab6', fontSize: 10 }}>{String(data.role || '产品设计师')}</small><span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, color: '#72efc3', fontSize: 9 }}><b style={{ width: 5, height: 5, borderRadius: '50%', background: '#72efc3' }} />{String(data.status || '在线')}</span></div><button type="button" onClick={() => interactive && onDataChange?.({ following: !Boolean(data.following) })} style={{ border: `1px solid ${accent}88`, borderRadius: 4, padding: '4px 7px', color: accent, background: `${accent}16`, fontSize: 9, cursor: interactive ? 'pointer' : 'default' }}>{String(data.following ? '已关注' : data.followLabel || '关注')}</button></div>
      <div style={{ display: 'flex', gap: 18, marginTop: 12, paddingTop: 9, borderTop: '1px solid #23475b', color: '#85a4b0', fontSize: 9 }}><span><b style={{ display: 'block', color: '#dff8ff', fontSize: 12 }}>{String(data.followers || 128)}</b>关注者</span><span><b style={{ display: 'block', color: '#dff8ff', fontSize: 12 }}>{String(data.projects || 24)}</b>项目</span></div>
    </>, 'special-card special-card-profile');
  }
  if (id === 'card-stat') {
    const statValue = asNumber(data.value, 7516.5);
    const statTrend = asNumber(data.trendValue, 12.6);
    const progress = Math.max(0, Math.min(100, asNumber(data.progress, 72)));
    return shellCard(<>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><small style={{ display: 'block', color: '#8aa8b5', fontSize: 10 }}>{String(data.caption || data.title || '统计卡片')}</small><strong style={{ display: 'block', marginTop: 5, color: '#f5fdff', fontSize: 26, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{statValue.toLocaleString()}{String(data.unit || '')}</strong><span style={{ display: 'block', marginTop: 7, color: statTrend >= 0 ? '#72efc3' : '#ff8f9f', fontSize: 10 }}>{statTrend >= 0 ? '↗' : '↘'} {Math.abs(statTrend)}%</span></div><i style={{ width: 42, height: 42, border: `5px solid ${accent}`, borderLeftColor: `${accent}22`, borderRadius: '50%', transform: 'rotate(-35deg)', boxShadow: `0 0 14px ${accent}55` }} /></div>
      <div style={{ marginTop: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between', color: '#7899a8', fontSize: 9 }}><span>{String(data.progressLabel || '目标完成度')}</span><b style={{ color: accent }}>{progress}%</b></div><div style={{ height: 5, marginTop: 5, overflow: 'hidden', borderRadius: 4, background: '#17364a' }}><span style={{ display: 'block', width: `${progress}%`, height: '100%', borderRadius: 4, background: accent }} /></div></div>
    </>, 'special-card special-card-stat');
  }
  if (id === 'card-list') {
    const rows = Array.isArray(data.listItems) ? data.listItems : (Array.isArray(data.items) ? data.items : [{ label: '项目进度', value: '86%', status: 'normal' }, { label: '用户增长', value: '64%', status: 'good' }, { label: '设备状态', value: '98%', status: 'warn' }]);
    return shellCard(<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: `1px solid ${accent}40` }}><strong style={{ color: '#f1fbff', fontSize: 13 }}>{String(data.title || '列表卡片')}</strong><button type="button" onClick={() => interactive && onDataChange?.({ lastAction: 'view-all' })} style={{ border: 0, color: accent, background: 'transparent', fontSize: 9, cursor: interactive ? 'pointer' : 'default' }}>{String(data.viewAllLabel || '查看全部')}</button></div>
      <div style={{ display: 'grid', gap: 7, marginTop: 9, maxHeight: 190, overflowY: 'auto', paddingRight: 3 }}>{rows.map((row: any, index: number) => { const rowLabel = String(row?.label || row?.name || `条目 ${index + 1}`); const rowValue = String(row?.value ?? row?.count ?? '—'); const rowColor = String(row?.color || [accent, '#72efc3', '#ffbd78', '#a78bfa'][index % 4]); return <div key={`${rowLabel}-${index}`} style={{ display: 'grid', gridTemplateColumns: '7px 1fr auto', alignItems: 'center', gap: 7, color: '#9ab5c1', fontSize: 10 }}><i style={{ width: 6, height: 6, borderRadius: '50%', background: rowColor, boxShadow: `0 0 7px ${rowColor}` }} /><span>{rowLabel}</span><b style={{ color: '#d9f5fc', fontVariantNumeric: 'tabular-nums' }}>{rowValue}</b></div>; })}</div>
    </>, 'special-card special-card-list');
  }
  if (isCityMapId(id)) {
    const cityMapName = CITY_MAP_NAMES[id] || '';
    const markers = Array.isArray(data.markers) ? data.markers : [];
    const zoom = Math.max(0, Math.min(20, asNumber(data.zoom, 10)));
    return <div className="aether-special-official special-map" style={{ boxSizing: 'border-box', position: 'relative', width: '100%', height: '100%', minHeight: 0, padding: 0, overflow: 'hidden', color: '#f4faff', background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none', opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}>
      <OfficialCityMapGraphic cityId={id} showLabels={data.showLabels !== false} zoom={zoom} />
      <div style={{ position: 'absolute', top: 12, right: 14, display: 'grid', justifyItems: 'end', gap: 2, padding: '5px 9px', borderRadius: 5, background: 'rgba(5,18,34,.72)', boxShadow: '0 3px 12px rgba(0,0,0,.22)', pointerEvents: 'none' }}>
        <strong style={{ color: '#f6fbff', fontSize: 15, lineHeight: 1.15, letterSpacing: 1 }}>{String(data.region || cityMapName)}</strong>
        <small style={{ color: '#a9c9e5', fontSize: 9 }}>{String(data.mapCenter || cityMapName)} · Z{zoom}</small>
      </div>
      {markers.map((marker: any, index: number) => { const markerColor = String(marker.color || accent); return <span key={String(marker.id || index)} title={String(marker.label || '标记点')} style={{ position: 'absolute', zIndex: 2, left: `${Math.max(0, Math.min(100, Number.isFinite(Number(marker.x)) ? Number(marker.x) : 50 + index * 6))}%`, top: `${Math.max(0, Math.min(100, Number.isFinite(Number(marker.y)) ? Number(marker.y) : 50 + index * 4))}%`, display: 'flex', alignItems: 'center', gap: 5, transform: 'translate(-5px,-50%)', pointerEvents: 'none', whiteSpace: 'nowrap' }}><i style={{ flex: '0 0 auto', width: 11, height: 11, border: '2px solid #fff', borderRadius: '50%', background: markerColor, boxShadow: `0 0 0 4px ${markerColor}45, 0 0 14px ${markerColor}` }} /><small style={{ padding: '2px 5px', color: '#f5fbff', border: `1px solid ${markerColor}80`, borderRadius: 3, background: 'rgba(5,18,34,.82)', fontSize: 9, lineHeight: 1.2 }}>{String(marker.label || `标记 ${index + 1}`)}</small></span>; })}
    </div>;
  }
  const label = String(data.label || data.title || '官方组件');
  const metricMin = asNumber(data.min, 0);
  const metricMax = Math.max(metricMin, asNumber(data.max, 100));
  const value = Math.max(metricMin, Math.min(metricMax, asNumber(data.value, 72)));
  const points = Array.isArray(data.items) ? data.items : [{ label: '一月', value: 38 }, { label: '二月', value: 62 }, { label: '三月', value: 48 }, { label: '四月', value: 78 }, { label: '五月', value: 56 }];
  const opacity = Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100));
  const shellHasSemanticCardSurface = id.startsWith('card-')
    || ['dynamic-number', 'big-number', 'metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6', 'weather-card', 'camera-panel', 'notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'].includes(id)
    || id.startsWith('popup-')
    || id.startsWith('frame-style-');
  const shellDefaultSurface = shellHasSemanticCardSurface ? (id === 'toast' ? 'subtle' : 'card') : 'transparent';
  const shellSurface = String(data.surface || shellDefaultSurface);
  const contentSizedShell = ['avatar', 'avatar-group', 'rating', 'divider', 'tooltip', 'solid-badge', 'outline-badge', 'status-badge', 'count-badge', 'spinner-loader', 'dots-loader', 'ring-loader', 'wave-loader'].includes(id) || id.startsWith('button-') || id === 'button' || id === 'primary-button' || id === 'secondary-button' || id === 'icon-button' || id === 'close-button' || id === 'link-area';
  const shell = (children: React.ReactNode, className = '') => <div className={`aether-special-official ${className}`} data-anchor={String(data.anchor || 'center')} data-connector={data.showConnector ? 'true' : 'false'} data-aether-selection-root={contentSizedShell ? 'true' : undefined} style={{ '--special-accent': accent, opacity, width: contentSizedShell ? 'fit-content' : undefined, height: contentSizedShell ? 'fit-content' : undefined, minHeight: contentSizedShell ? 0 : undefined, padding: shellSurface === 'transparent' ? 0 : undefined, background: shellSurface === 'transparent' ? 'transparent' : undefined, border: shellSurface === 'transparent' ? '0' : undefined, boxShadow: shellSurface === 'card' ? undefined : 'none' } as React.CSSProperties}>{children}<style>{`.aether-special-official{box-sizing:border-box;width:100%;height:100%;min-height:108px;padding:${shellSurface === 'transparent' ? 0 : 16}px;color:#e8f9ff;background:${shellSurface === 'transparent' ? 'transparent' : shellSurface === 'subtle' ? 'rgba(8,28,43,.52)' : 'linear-gradient(145deg,#0d2638,#071522)'};border:${shellSurface === 'transparent' ? '0' : shellSurface === 'subtle' ? '1px solid color-mix(in srgb,var(--special-accent) 25%,transparent)' : '1px solid color-mix(in srgb,var(--special-accent) 52%,#1d3c50)'};border-radius:${Math.max(0, Number(data.borderRadius ?? 8))}px;box-shadow:${shellSurface === 'card' ? 'inset 0 1px rgba(255,255,255,.08),0 12px 26px rgba(0,0,0,.24)' : 'none'};font-family:inherit}.special-metric{position:relative;display:flex;flex-direction:column;gap:5px;justify-content:center;border-left:3px solid var(--special-accent);background:linear-gradient(115deg,color-mix(in srgb,var(--special-accent) 15%,transparent),#081a28)}.special-metric small,.special-weather span,.special-camera small{color:#84a8b8;font-size:11px}.special-metric strong{font-size:34px;line-height:1;color:#f4fcff}.special-metric em{color:var(--special-accent);font-size:11px;font-style:normal}.special-metric i{position:absolute;right:20px;top:25px;width:62px;height:62px;border:6px solid var(--special-accent);border-left-color:transparent;border-radius:50%;opacity:.55;pointer-events:none}.special-popup{position:relative;display:flex;flex-direction:column;gap:8px;padding:20px}.special-popup[data-connector="true"]::after{position:absolute;z-index:2;content:'';width:12px;height:12px;background:#0d2638;border:1px solid var(--special-accent);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);pointer-events:none}.special-popup[data-connector="true"][data-anchor="center"]::after,.special-popup[data-connector="true"][data-anchor="bottom"]::after{left:calc(50% - 7px);bottom:1px;border-top:0;border-left:0}.special-popup[data-connector="true"][data-anchor="top"]::after{left:calc(50% - 7px);top:1px;border-right:0;border-bottom:0}.special-popup[data-connector="true"][data-anchor="left"]::after{right:1px;top:calc(50% - 7px);border-left:0;border-bottom:0}.special-popup[data-connector="true"][data-anchor="right"]::after{left:1px;top:calc(50% - 7px);border-top:0;border-right:0}.special-popup header{display:flex;align-items:center;justify-content:space-between;color:#f5fdff;font-weight:700}.special-popup header i{width:7px;height:7px;border-radius:50%;background:var(--special-accent);box-shadow:0 0 9px var(--special-accent)}.special-popup p{margin:0;color:#9ab5c1;font-size:12px;line-height:1.6}.special-popup footer{display:flex;justify-content:flex-end;gap:7px}.special-popup button,.special-button{border:1px solid var(--special-accent);color:#eafdff;background:color-mix(in srgb,var(--special-accent) 19%,transparent);padding:7px 13px;border-radius:4px;font-size:11px}.special-frame{padding:0;overflow:hidden}.special-frame header{display:flex;align-items:center;gap:5px;height:28px;padding:0 12px;border-bottom:1px solid color-mix(in srgb,var(--special-accent) 38%,transparent);color:#9fc0cb;font-size:11px}.special-frame header i{width:6px;height:6px;border-radius:50%;background:var(--special-accent)}.special-frame header b{margin-left:auto;color:var(--special-accent);font-size:9px}.special-frame main{display:grid;gap:8px;padding:14px}.special-frame main i{height:9px;border:1px solid #2a5870;background:#12354a}.special-frame main i:nth-child(2){width:75%}.special-frame main i:nth-child(3){width:88%}.special-map{position:relative;padding:10px}.special-map svg,.special-map strong,.special-map small,.special-map i{pointer-events:none}.special-map svg{display:block;width:72%;height:100%;fill:color-mix(in srgb,var(--special-accent) 18%,transparent);stroke:var(--special-accent);stroke-width:1}.special-map svg path+path{fill:none;opacity:.45}.special-map strong{position:absolute;right:14px;top:14px;color:var(--special-accent);font-size:16px}.special-map i{position:absolute;width:8px;height:8px;border:1px solid #fff;border-radius:50%;background:var(--special-accent);box-shadow:0 0 10px var(--special-accent)}.special-map i:first-of-type{left:44%;top:40%}.special-map i:last-of-type{left:57%;top:59%;background:#ffbd78}.special-bars{display:flex;align-items:end;gap:12px;height:100%;padding:25px 12px 8px;border-bottom:1px solid #2a5266}.special-bars i{flex:1;background:linear-gradient(180deg,var(--special-accent),color-mix(in srgb,var(--special-accent) 20%,transparent));box-shadow:0 0 12px color-mix(in srgb,var(--special-accent) 25%,transparent)}.special-weather{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px 12px}.special-weather svg{grid-row:span 2;color:var(--special-accent)}.special-weather strong{font-size:34px}.special-weather i{grid-column:2;color:#91aebb;font-size:11px;font-style:normal}.special-camera{position:relative;display:flex;align-items:center;gap:10px;padding:14px;background:linear-gradient(145deg,#162f3b,#071620)}.special-camera svg{color:var(--special-accent)}.special-camera b{position:absolute;right:14px;top:12px;color:#75efc3;font-size:10px}.special-camera footer{position:absolute;bottom:13px;left:14px;display:flex;gap:8px}.special-camera footer i{width:22px;height:14px;border:1px solid color-mix(in srgb,var(--special-accent) 60%,transparent)}.special-button{display:flex;align-items:center;justify-content:space-between;width:100%;height:46px;cursor:pointer}.special-title{display:flex;align-items:center;gap:12px}.special-title i{width:4px;height:36px;background:var(--special-accent);box-shadow:0 0 12px var(--special-accent)}.special-title strong{font-size:25px}.special-title small{display:block;margin-top:3px;color:#7fa1af;font-size:11px}`}</style></div>;
  if (id === 'avatar') return shell(<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><i style={{ display: 'grid', placeItems: 'center', width: Math.max(20, asNumber(data.avatarSize, 42)), height: Math.max(20, asNumber(data.avatarSize, 42)), overflow: 'hidden', borderRadius: '50%', border: `2px solid ${accent}`, background: `linear-gradient(145deg,${accent}55,#071422)`, color: '#e9fbff', fontStyle: 'normal' }}>{data.avatarUrl ? <img src={String(data.avatarUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(data.avatarText || 'A')}</i><div><b>{String(data.label || 'User avatar')}</b>{data.showSubtitle !== false && <small>{String(data.subtitle || 'Online')}</small>}</div></div>, 'special-avatar');
  if (id === 'avatar-group') { const members = Array.isArray(data.members) ? data.members : []; const maxVisible = Math.max(1, Math.min(members.length || 1, asNumber(data.maxVisible, 4))); const size = Math.max(20, Math.min(96, asNumber(data.avatarSize, 32))); const overlap = Math.max(0, Math.min(size - 2, asNumber(data.overlap, 8))); const visible = members.slice(0, maxVisible); const overflow = Math.max(0, members.length - visible.length); const overflowLabel = String(data.overflowLabel || ('+' + overflow)); return shell(<div style={{ display: 'flex', alignItems: 'center' }}>{visible.map((member: any, index: number) => <i key={member.id || index} title={String(member.label || '')} style={{ display: 'grid', placeItems: 'center', marginLeft: index ? -overlap : 0, width: size, height: size, borderRadius: '50%', border: '2px solid #081522', background: `linear-gradient(145deg,${String(member.color || accent)},#17324a)`, color: '#e9fbff', fontStyle: 'normal', fontSize: Math.max(10, size * 0.38) }}>{String(member.label || String.fromCharCode(65 + index))}</i>)}{data.showOverflow !== false && overflow > 0 && <i style={{ display: 'grid', placeItems: 'center', marginLeft: -overlap, width: size, height: size, borderRadius: '50%', border: '2px solid #081522', background: '#17324a', color: '#b9d8e4', fontStyle: 'normal', fontSize: Math.max(10, size * 0.32) }}>{overflowLabel}</i>}</div>, 'special-avatar'); }
  if (id === 'divider') { const vertical = String(data.orientation || 'horizontal') === 'vertical'; const lineStyle = String(data.lineStyle || 'solid'); const lineWidth = Math.max(1, Math.min(8, asNumber(data.lineWidth, 1))); const gap = Math.max(0, asNumber(data.gap, 10)); const line = vertical ? <i style={{ width: lineWidth, height: '100%', minHeight: 48, background: lineStyle === 'solid' ? accent : 'transparent', borderLeft: lineStyle === 'solid' ? undefined : `${lineWidth}px ${lineStyle} ${accent}`, flex: '0 0 auto' }} /> : <i style={{ height: lineWidth, width: '100%', background: lineStyle === 'solid' ? accent : 'transparent', borderTop: lineStyle === 'solid' ? undefined : `${lineWidth}px ${lineStyle} ${accent}`, flex: '1 1 auto' }} />; return shell(<div style={vertical ? { display: 'flex', alignItems: 'center', flexDirection: 'column', gap, height: '100%', color: '#8aaec0' } : { display: 'flex', alignItems: 'center', gap, color: '#8aaec0' }}>{line}{data.showLabel !== false && <span style={{ whiteSpace: 'nowrap' }}>{String(data.label || 'Divider')}</span>}{line}</div>, 'special-divider'); }
  if (['dynamic-number', 'big-number', 'metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'].includes(id)) {
    const metricStyle = String(data.previewVariant || 'metric-panel');
    const digitStyle: React.CSSProperties = { display: 'flex', gap: 4, padding: 8, background: '#063f82', alignSelf: 'center' };
    if (metricStyle === 'metric-counter') return shell(<><small>{String(data.caption || label)}</small><div style={digitStyle}><AnimatedMetricDigits value={value} /></div><em>{String(data.trend || '+12.6%')}</em></>, 'special-metric-counter');
    if (metricStyle === 'metric-circle') return shell(<><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', width: 132, height: 132, margin: 'auto', border: '12px solid #126bdf', borderRadius: '50%', background: 'radial-gradient(circle,#306fca,#07356f)', boxShadow: '0 0 20px #1564c2' }}><strong style={{ fontSize: 30 }}><AnimatedMetricText value={value} />{String(data.unit || '')}</strong><small>{String(data.caption || label)}</small></div></>, 'special-metric-circle');
    if (metricStyle === 'metric-badge') return shell(<><div style={{ display: 'grid', placeItems: 'center', width: 114, height: 114, margin: 'auto', border: '12px solid #104973', borderRadius: '50%', color: '#fff', background: '#1476cb', fontSize: 38, fontWeight: 700, boxShadow: '0 0 0 6px #061b32' }}><AnimatedMetricText value={value} /></div><small style={{ textAlign: 'center' }}>{String(data.caption || label)}</small></>, 'special-metric-badge');
    if (metricStyle === 'metric-strip') return shell(<><strong>{String(data.caption || label)}</strong><span><AnimatedMetricText value={value} />{String(data.unit || '')}</span><em>{String(data.trend || '+12.6%')}</em></>, 'special-metric-strip');
    if (metricStyle === 'metric-wide') return shell(<><small>{String(data.caption || label)}</small><strong><AnimatedMetricText value={value} />{String(data.unit || '')}</strong><em>{String(data.trend || '+12.6%')}</em></>, 'special-metric-wide');
    return shell(<><small>{String(data.caption || label)}</small><strong><AnimatedMetricText value={value} />{String(data.unit || '')}</strong><em>{String(data.trend || '+12.6%')}</em><i /></>, 'special-metric');
  }
  if (id === 'weather-card') return shell(<><CloudSun size={38} color={accent} /><strong>{Number(data.temperature ?? 24)}{String(data.unit || '°C')}</strong><span>{String(data.city || '北京')} · {String(data.condition || '晴朗')}</span><i>湿度 {Number(data.humidity ?? 46)}% · {String(data.wind || '东南风 2 级')}</i></>, 'special-weather');
  if (id === 'camera-panel') return shell(<><Camera size={25} color={accent} /><div><strong>{String(data.cameraName || 'CAM-01')}</strong><small>{String(data.location || '主入口')} · {String(data.timestamp || '实时')}</small></div><b>{String(data.status || '在线')}</b>{data.showControls !== false && <footer><i /><i /><i /></footer>}</>, 'special-camera');
  if (id.startsWith('popup-')) return shell(<><header><i /><span>{String(data.title || label)}</span>{data.showClose !== false && <b>×</b>}</header><p>{String(data.content || '这里是弹窗正文内容，可在属性面板中自定义。')}</p><footer>{(Array.isArray(data.buttons) ? data.buttons : ['取消', '确认']).map((button: string, index: number) => <button key={`${button}-${index}`} type="button" onClick={() => interactive && onDataChange?.({ lastAction: button })}>{button}</button>)}</footer></>, 'special-popup');
  if (id.startsWith('frame-style-')) return shell(<>{data.showHeader !== false && <header><i /><i /><i /><span>{String(data.title || '数据监控中心')}</span><b>{String(data.headerMeta || 'LIVE')}</b></header>}<main><strong>{String(data.content || '窗口内容区域')}</strong><i /><i /><i /></main></>, 'special-frame');
  if (id.startsWith('map-')) return shell(<><svg viewBox="0 0 120 64" style={{ pointerEvents: 'none' }}><path d="M17 14 35 7l15 6 14-5 10 11 22 4-8 11 12 9-21 7-16-7-14 7-9-12-14-5 7-10z" /><path d="m52 16 8 12-3 18m21-25-12 7 13 12" /></svg>{data.showLabels !== false && <strong style={{ pointerEvents: 'none' }}>{String(data.region || label.replace('地图', ''))}</strong>}<small style={{ position: 'absolute', right: 14, top: 35, color: '#9ab5c1', fontSize: 9, pointerEvents: 'none' }}>{String(data.mapCenter || data.region || '中心')} · Z{asNumber(data.zoom, 10)}</small>{(Array.isArray(data.markers) ? data.markers : []).map((marker: any, index: number) => <i key={String(marker.id || index)} title={String(marker.label || '标记点')} style={{ left: `${Number.isFinite(Number(marker.x)) ? Number(marker.x) : 44 + index * 9}%`, top: `${Number.isFinite(Number(marker.y)) ? Number(marker.y) : 40 + index * 7}%`, background: String(marker.color || accent), pointerEvents: 'none' }} />)}</>, 'special-map');
  if (id === 'dynamic-bar' || id === '3d-bar') return shell(<div className="special-bars">{points.map((point: any, index: number) => <i key={point.id || index} title={`${point.label || ''}: ${point.value || 0}`} style={{ height: `${Math.max(10, Math.min(100, Number(point.value || 0)))}%` }} />)}</div>, 'special-bars');
  if (id.startsWith('button-tech-') || id.startsWith('button-text-')) {
    const action = String(data.action || 'none');
    const nextPressed = !Boolean(data.pressed);
    return shell(<>
      <button type="button" className={`special-button ${data.pressed ? 'is-pressed' : ''}`} style={{ background: data.pressed ? `color-mix(in srgb,${accent} 42%,transparent)` : undefined, transform: data.pressed ? 'translateY(1px)' : undefined }} onClick={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        onDataChange?.({ pressed: nextPressed, lastAction: action, action });
        if (action !== 'none') onAction?.(action);
      }} disabled={!interactive || Boolean(data.disabled)} aria-pressed={Boolean(data.pressed)}>{String(data.buttonLabel || label)}<span>{String(data.icon || '↗')}</span></button>
      {data.actionStatus && <span role="status" aria-live="polite" style={{ display: 'block', marginTop: 6, color: accent, fontSize: 10, textAlign: 'center' }}>{String(data.actionStatus)}</span>}
    </>, 'special-button');
  }
  if (id === 'top-title') return shell(<div className="special-title"><i /><div><strong>{String(data.content || label)}</strong><small>{String(data.subtitle || '数据可视化中心')}</small></div></div>, 'special-title');
  if (['card-basic', 'card-outline', 'card-media', 'card-profile', 'card-stat', 'card-list'].includes(id)) return shell(<div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', height: '100%' }}><header style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><i style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${accent}`, background: `${accent}28` }} /><span>{String(data.title || label)}</span></header><p style={{ margin: 0, color: '#88a9b8', fontSize: 11, lineHeight: 1.5 }}>{String(data.content || '可编辑卡片内容')}</p><footer style={{ display: 'flex', justifyContent: 'space-between', color: accent, fontSize: 10 }}><span>{String(data.status || '正常')}</span><span>{String(data.value || '查看详情')} →</span></footer></div>, 'special-card');
  if (['notification-success', 'notification-error', 'notification-warning', 'notification-info', 'toast', 'alert'].includes(id)) {
    if (data.dismissed) return null;
    const notificationType = String(data.notificationType || (id.includes('error') ? 'error' : id.includes('warning') || id === 'alert' ? 'warning' : id.includes('success') ? 'success' : 'info'));
    const typeColor = notificationType === 'success' ? '#72efc3' : notificationType === 'error' ? '#ff7aa8' : notificationType === 'warning' ? '#ffbd78' : accent;
    const icon = notificationType === 'success' ? '✓' : notificationType === 'error' ? '!' : notificationType === 'warning' ? '!' : 'i';
    return <div className={`aether-special-official special-notification special-notification-${notificationType} surface-${surface}`} data-anchor={String(data.anchor || 'center')} data-aether-selection-root="true" style={{ '--special-accent': accent, boxSizing: 'border-box', width: '100%', height: 'fit-content', minHeight: 0, alignSelf: 'center', display: 'flex', alignItems: 'center', color: '#e8f9ff', background: surface === 'transparent' ? 'transparent' : surface === 'subtle' ? 'rgba(8,28,43,.52)' : 'linear-gradient(145deg,#0d2638,#071522)', border: surface === 'transparent' ? '0' : surface === 'subtle' ? `1px solid color-mix(in srgb,${accent} 25%,transparent)` : `1px solid color-mix(in srgb,${accent} 52%,#1d3c50)`, borderRadius: `${Math.max(0, Number(data.borderRadius ?? 8))}px`, padding: '10px 12px', overflow: 'hidden' } as React.CSSProperties}><div role={notificationType === 'error' || notificationType === 'warning' ? 'alert' : 'status'} aria-live={notificationType === 'error' || notificationType === 'warning' ? 'assertive' : 'polite'} style={{ width: '100%', display: 'grid', gridTemplateColumns: data.showIcon === false ? '1fr auto' : '28px minmax(0, 1fr) auto', alignItems: 'center', gap: 9, minHeight: 48, borderLeft: `3px solid ${typeColor}`, paddingLeft: 8 }}><>{data.showIcon !== false && <i style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: '50%', border: `1px solid ${typeColor}`, color: typeColor, background: `${typeColor}2e`, fontStyle: 'normal', fontWeight: 800 }}>{icon}</i>}</><div style={{ minWidth: 0 }}><strong style={{ color: '#effbff', fontSize: 12 }}>{String(data.title || label)}</strong><span style={{ display: 'block', marginTop: 3, color: '#8daab8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{String(data.content || '这是一条可编辑的通知消息')}</span></div>{data.dismissible !== false && <button type="button" onClick={() => interactive && onDataChange?.({ dismissed: true })} style={{ color: '#7895a5', border: 0, background: 'transparent', fontSize: 16, cursor: interactive ? 'pointer' : 'default' }} aria-label="关闭通知">×</button>}</div></div>;
  }
  if (['spinner-loader', 'dots-loader', 'ring-loader', 'wave-loader'].includes(id)) {
    const durationSeconds = Math.max(0.25, Math.min(5, 1 / Math.max(0.2, asNumber(data.speed, 1))));
    const duration = `${durationSeconds}s`;
    const size = Math.max(16, Math.min(96, asNumber(data.loaderSize, data.size === 'small' ? 24 : data.size === 'large' ? 48 : 34)));
    const loader = id === 'spinner-loader'
      ? <i className="official-loader-spinner" style={{ width: size, height: size, borderWidth: Math.max(2, size * 0.09), animationDuration: data.motionEnabled === false ? '0s' : duration }} />
      : id === 'dots-loader'
        ? <span className="official-loader-dots" style={{ gap: Math.max(4, size * 0.14), fontSize: size * 0.28 }}>{[0, 1, 2, 3].map((dot) => <i key={dot} style={{ width: size * 0.2, height: size * 0.2, animationDuration: data.motionEnabled === false ? '0s' : duration, animationDelay: `${dot * -0.14}s` }} />)}</span>
        : id === 'ring-loader'
          ? <span className="official-loader-progress" style={{ width: size, height: size, background: `conic-gradient(${accent} ${Math.max(0, Math.min(100, asNumber(data.value, 72)))}%, ${accent}25 0)`, animationDuration: data.motionEnabled === false ? '0s' : `${Math.max(1, durationSeconds * 1.8)}s` }}><i style={{ animationDuration: data.motionEnabled === false ? '0s' : `${Math.max(1, durationSeconds * 1.8)}s` }}>{Math.round(Math.max(0, Math.min(100, asNumber(data.value, 72))))}%</i></span>
          : <span className="official-loader-wave" style={{ height: size, gap: Math.max(2, size * 0.08) }}>{[0, 1, 2, 3, 4, 5, 6].map((bar) => <i key={bar} style={{ width: Math.max(3, size * 0.1), animationDuration: data.motionEnabled === false ? '0s' : duration, animationDelay: `${bar * 0.09}s` }} />)}</span>;
    return shell(<div className="special-loader-content" style={{ '--loader-accent': accent, color: '#8eaebe' } as React.CSSProperties}>{loader}<span>{String(data.label || '加载中')}</span></div>, `special-loader special-loader-${id}`);
  }
  if (['solid-badge', 'outline-badge', 'status-badge', 'count-badge'].includes(id)) return shell(<span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 82, height: 32, padding: '0 12px', border: `1px solid ${accent}`, borderRadius: 16, color: id === 'solid-badge' ? '#071522' : accent, background: id === 'solid-badge' ? accent : `${accent}26`, fontSize: 11 }}>{String(data.content || data.status || label)}{id === 'count-badge' ? ` ${String(data.value || 12)}` : ''}</span>, 'special-badge');
  if (id === 'avatar' || id === 'avatar-group') return shell(id === 'avatar' ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><i style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: '50%', border: `2px solid ${accent}`, background: `linear-gradient(145deg,${accent}55,#071422)`, color: '#e9fbff' }}>A</i><div><b>{String(data.label || '用户头像')}</b><small>{String(data.subtitle || '在线')}</small></div></div> : <div style={{ display: 'flex', alignItems: 'center' }}>{[0, 1, 2, 3].map((index) => <i key={index} style={{ marginLeft: index ? -8 : 0, width: 32, height: 32, borderRadius: '50%', border: '2px solid #081522', background: `linear-gradient(145deg,${[accent, '#82f3c4', '#ffb86b', '#a78bfa'][index]},#17324a)` }} />)}</div>, 'special-avatar');
  if (id === 'rating') {
    const min = asNumber(data.min, 0);
    const max = Math.max(min + 1, Math.min(20, asNumber(data.max, 5)));
    const step = Math.max(1, asNumber(data.step, 1));
    const starCount = Math.max(1, Math.min(20, Math.ceil(max - min)));
    const value = Math.max(min, Math.min(max, asNumber(data.value, min + Math.min(4, starCount) * step)));
    const selectedCount = Math.max(0, Math.min(starCount, Math.round((value - min) / step)));
    const ratingColor = String(data.ratingColor || accent || '#ffbd78');
    return shell(<div
      data-aether-selection-root="true"
      role="radiogroup"
      aria-label={String(data.label || '评分')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: ratingColor, fontSize: 20, whiteSpace: 'nowrap' }}
    >
      {Array.from({ length: starCount }, (_, index) => {
        const checked = index + 1 === selectedCount;
        const nextValue = Math.min(max, min + (index + 1) * step);
        return <button
          key={index}
          type="button"
          role="radio"
          aria-checked={checked}
          aria-label={`设置评分为 ${nextValue} 星`}
          disabled={Boolean(data.disabled)}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onDataChange?.({ value: nextValue }); }}
          style={{ appearance: 'none', border: 0, padding: 0, margin: 0, lineHeight: 1, color: index < selectedCount ? ratingColor : '#29445a', background: 'transparent', font: 'inherit', cursor: data.disabled ? 'default' : 'pointer', textShadow: index < selectedCount ? `0 0 8px ${ratingColor}80` : 'none' }}
        >{index < selectedCount ? '★' : '☆'}</button>;
      })}
      <small style={{ marginLeft: 6, color: '#8eaebe', fontSize: 10 }}>{selectedCount} / {starCount}</small>
    </div>, 'special-rating');
  }
  if (id === 'divider') return shell(<div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8aaec0' }}><i style={{ height: 1, flex: 1, background: accent }} /><span>{String(data.label || '分隔线')}</span><i style={{ height: 1, flex: 1, background: accent }} /></div>, 'special-divider');
  if (id === 'tooltip') return shell(<div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 10, color: '#dff8ff', background: '#102b3d', border: `1px solid ${accent}`, borderRadius: 6, fontSize: 11 }}>{String(data.content || '提示信息')}</div>, 'special-tooltip');
  if (id === 'empty-state') return shell(<div style={{ display: 'grid', placeItems: 'center', gap: 7, height: '100%', color: '#8ba9b8', textAlign: 'center' }}><i style={{ width: 34, height: 34, border: `1px dashed ${accent}`, borderRadius: 8 }} /><span>{String(data.content || '暂无数据')}</span></div>, 'special-empty');
  if (id === 'skeleton') {
    const lineCount = Math.max(2, Math.min(8, Math.round(asNumber(data.lineCount, 4))));
    const widths = ['78%', '100%', '88%', '64%', '94%', '72%', '84%', '58%'];
    const shimmer = data.animationEnabled === false ? undefined : 'aether-shimmer 1.5s ease-in-out infinite';
    return shell(<div className="special-skeleton-content" aria-label="骨架屏预览" style={{ display: 'grid', gridTemplateColumns: data.showAvatar === false ? '1fr' : '34px minmax(0, 1fr)', gridTemplateRows: `repeat(${lineCount}, minmax(8px, 1fr))`, alignContent: 'center', alignItems: 'center', gap: 8, width: '100%', height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 8 }}>
      {data.showAvatar !== false && <i aria-hidden="true" style={{ gridRow: `span ${lineCount}`, width: 30, height: 30, borderRadius: '50%', background: '#21445a', animation: shimmer }} />}
      {Array.from({ length: lineCount }, (_, index) => <i key={index} aria-hidden="true" style={{ display: 'block', width: widths[index % widths.length], height: index === 0 ? 12 : 9, borderRadius: 4, background: '#21445a', animation: shimmer, animationDelay: `${index * 80}ms` }} />)}
    </div>, 'special-skeleton');
  }
  return null;
};

const OfficialPointAnnotation: React.FC<{ data: any }> = ({ data }) => {
  const direction = String(data.pointerDirection || 'bottom');
  const x = Math.max(0, Math.min(100, asNumber(data.pointerX, 50)));
  const y = Math.max(0, Math.min(100, asNumber(data.pointerY, 50)));
  const pointerStyle: React.CSSProperties = direction === 'left' || direction === 'right'
    ? { position: 'absolute', width: 24, height: 1, top: `${y}%`, left: direction === 'left' ? 0 : `${x}%`, background: data.accentColor || '#ffbd78', transform: direction === 'left' ? 'translateX(-100%)' : 'translateY(-50%)' }
    : { position: 'absolute', width: 1, height: 24, left: `${x}%`, top: direction === 'top' ? 0 : `${y}%`, background: data.accentColor || '#ffbd78', transform: direction === 'top' ? 'translateY(-100%)' : 'translateX(-50%)' };
  return <div className="aether-official-native is-point-annotation" style={{ position: 'relative', minHeight: 110, padding: 14, color: '#e7f8ff', background: '#10283a', border: `1px solid ${data.accentColor || '#ffbd78'}80`, borderRadius: 6, opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><span style={{ ...pointerStyle, boxShadow: `0 0 8px ${data.accentColor || '#ffbd78'}` }} /><span style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 7, height: 7, borderRadius: '50%', background: data.accentColor || '#ffbd78', transform: 'translate(-50%, -50%)' }} /><strong style={{ display: 'block' }}>{String(data.title || data.label || '批注')}</strong><small style={{ display: 'block', marginTop: 8, color: '#9ab5c1' }}>{String(data.content || '批注内容')}</small><em style={{ display: 'block', marginTop: 8, color: '#7394a5', fontSize: 10, fontStyle: 'normal' }}>{String(data.author || 'AETHER')} · {String(data.severity || 'info')}</em></div>;
};

const OfficialDocument: React.FC<{ data: any }> = ({ data }) => {
  const entries = Array.isArray(data.items) ? data.items.map(String) : [];
  return <div className="aether-official-native is-document" style={{ display: 'flex', flexDirection: 'column', minHeight: 110, padding: 14, color: '#dff4fb', background: String(data.backgroundColor || '#0c1c30'), border: '1px solid #31566b', borderRadius: Math.max(0, Number(data.borderRadius || 8)), opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><div style={{ flex: 1 }}>{data.showHeader !== false && <header style={{ paddingBottom: 7, marginBottom: 8, borderBottom: '1px solid #28465a', color: '#8eb5c4', fontSize: 10 }}>{String(data.headerText || 'AETHER DOCUMENT')}</header>}<h4 style={{ margin: '0 0 8px', color: '#f0fbff', fontSize: 14 }}>{String(data.pageTitle || data.title || data.label || 'Document')}</h4><p style={{ margin: '0 0 8px', color: '#9ab5c1', fontSize: 11, lineHeight: 1.5 }}>{String(data.content || '')}</p>{entries.map((entry, index) => <div key={`${index}-${entry}`} style={{ padding: '5px 0', borderTop: '1px solid #203c50', fontSize: 11 }}>{entry}</div>)}</div>{data.showFooter !== false && <footer style={{ paddingTop: 7, marginTop: 8, borderTop: '1px solid #28465a', color: '#7897a7', fontSize: 10 }}>{String(data.footerText || 'Page 1')}</footer>}</div>;
};

const OfficialDynamicComponent: React.FC<{ data: any }> = ({ data }) => {
  let props: Record<string, unknown> = {};
  try { const parsed = JSON.parse(String(data.propsJson || '{}')); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) props = parsed as Record<string, unknown>; } catch { props = { parseError: 'Invalid JSON' }; }
  const entries = Object.entries(props);
  return <div className="aether-official-native is-dynamic-component" style={{ minHeight: 90, padding: 14, color: '#e7f8ff', background: '#0b2132', border: `1px solid ${data.accentColor || '#a78bfa'}80`, borderRadius: 8, opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><strong>{String(data.title || data.label || '动态组件')}</strong><code style={{ color: '#c8afff', fontSize: 10 }}>{String(data.componentRef || '未绑定组件')}</code></div><p style={{ margin: '8px 0', color: '#9ab5c1', fontSize: 11 }}>{String(data.content || '动态内容')}</p>{entries.length ? entries.map(([key, value]) => <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 5, padding: 6, border: '1px solid #2f5268', borderRadius: 4, fontSize: 10 }}><span>{key}</span><b style={{ color: '#c8afff' }}>{String(value)}</b></div>) : <small style={{ color: '#d27aff' }}>属性 JSON 为空或格式错误</small>}</div>;
};

/** Native AETHER renderer for the component families mirrored from Modao. */
const OFFICIAL_CHART_IDS = new Set([
  'bar-chart', 'bar-chart-horizontal', 'line-chart', 'area-chart', 'combo-chart', 'funnel', 'scatter', 'heatmap',
  'tree-chart', 'waterfall-chart', 'rose-chart', 'water-wave', 'bubble-chart', 'yuejue-chart', 'sunburst-chart',
  'boxplot-chart', 'sankey-chart', 'wordcloud-chart', 'dynamic-bar', '3d-bar',
]);
const OFFICIAL_FLOW_IDS = new Set(['flow', 'mindmap', 'swimlane', 'timeline', 'steps', 'stepper', 'decision-node']);
const OFFICIAL_MAP_IDS = new Set(['map', 'map-marker', 'stat-map']);

const OfficialImageContent: React.FC<{ src: string; alt: string; style: React.CSSProperties }> = ({ src, alt, style }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span role="status" style={{ padding: 12, color: '#8aaebe', fontSize: 11, textAlign: 'center' }}>{failed ? '图片无法加载，请使用图片直链或上传本地图片' : '上传图片或输入图片直链'}</span>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} style={style} />;
};

const OfficialVideoContent: React.FC<{ src: string; poster?: string; controls: boolean; autoplay: boolean; loop: boolean; muted: boolean; style: React.CSSProperties }> = ({ src, poster, controls, autoplay, loop, muted, style }) => {
  const [failed, setFailed] = React.useState(false);
  const [hasVideoTrack, setHasVideoTrack] = React.useState<boolean | null>(null);
  React.useEffect(() => { setFailed(false); setHasVideoTrack(null); }, [src]);
  if (!src || failed) return <span role="status" style={{ padding: 12, color: '#8aaebe', fontSize: 11, textAlign: 'center' }}>{failed ? '视频无法播放，请使用媒体直链或上传本地视频' : '上传视频或输入视频直链'}</span>;
  return <div style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#091a29' }}>
    <video key={src} src={src} poster={poster} controls={controls} autoPlay={autoplay} loop={loop} muted={muted} playsInline preload="auto" onLoadedMetadata={(event) => { const video = event.currentTarget; setHasVideoTrack(video.videoWidth > 0 && video.videoHeight > 0); }} onLoadedData={() => setFailed(false)} onError={() => setFailed(true)} style={style} />
    {hasVideoTrack === false && <span role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 12, color: '#fbbf24', background: 'rgba(9,26,41,.82)', fontSize: 11, textAlign: 'center', pointerEvents: 'none' }}>该文件没有可用的视频画面轨道，目前只能播放音频</span>}
  </div>;
};

type PyramidDistributionPoint = { name?: string; value?: number; c1?: string; c2?: string; side?: 'left' | 'right' };

const PyramidDistributionChart: React.FC<{ data?: any; onDataChange?: (patch: Record<string, any>) => void }> = ({ data = {}, onDataChange }) => {
  const fallback: PyramidDistributionPoint[] = [
    { name: 'XXXXXXXXX', value: 35, c1: '#5eead4', c2: '#2dd4bf', side: 'right' },
    { name: 'XXXXXXXXX', value: 30, c1: '#22d3ee', c2: '#0891b2', side: 'left' },
    { name: 'XXXXXXXXX', value: 20, c1: '#3b82f6', c2: '#1e40af', side: 'right' },
    { name: 'XXXXXXXXX', value: 15, c1: '#1e40af', c2: '#0c2461', side: 'left' },
  ];
  const source = Array.isArray(data.pyramidData) && data.pyramidData.length ? data.pyramidData : fallback;
  const points = source.map((point: PyramidDistributionPoint) => ({ name: String(point.name || '未命名'), value: Math.max(0, chartNumber(point.value)), c1: String(point.c1 || '#22d3ee'), c2: String(point.c2 || '#0f4c81'), side: point.side === 'left' ? 'left' as const : 'right' as const }));
  const total = Math.max(1, points.reduce((sum, point) => sum + point.value, 0));
  const width = 880; const height = 550; const viewHeight = 500; const cx = 400; const apexY = 60; const baseCy = 380; const baseHw = 200; const baseDepth = 55;
  const corners = (t: number) => ({ front: { x: cx, y: baseCy + baseDepth + t * (apexY - baseCy - baseDepth) }, left: { x: cx - baseHw + t * baseHw, y: baseCy + t * (apexY - baseCy) }, right: { x: cx + baseHw - t * baseHw, y: baseCy + t * (apexY - baseCy) } });
  const updatePoint = (index: number, patch: Partial<PyramidDistributionPoint>) => onDataChange?.({ pyramidData: points.map((point, itemIndex) => itemIndex === index ? { ...point, ...patch } : point) });
  const updateTitle = (label: string) => onDataChange?.({ label });
  const addLayer = () => onDataChange?.({ pyramidData: [...points, { name: 'XXXXXXXXX', value: 0, c1: '#22d3ee', c2: '#0891b2', side: points.length % 2 ? 'right' : 'left' }] });
  const removeLayer = () => points.length > 1 && onDataChange?.({ pyramidData: points.slice(0, -1) });
  const commitValue = (index: number, raw: string) => { const next = Math.max(0, Math.min(100, Math.round(chartNumber(raw)))); const edited = points.map((point, itemIndex) => itemIndex === index ? { ...point, value: next } : { ...point }); const otherSum = edited.reduce((sum, point, itemIndex) => itemIndex === index ? sum : sum + point.value, 0); const remaining = 100 - next; if (otherSum > 0) edited.forEach((point, itemIndex) => { if (itemIndex !== index) point.value = Math.round(point.value * remaining / otherSum); }); const totalAfter = edited.reduce((sum, point) => sum + point.value, 0); if (edited.length > 1) edited[edited.length - 1].value = Math.max(0, edited[edited.length - 1].value + 100 - totalAfter); onDataChange?.({ pyramidData: edited }); };
  return <DashboardSourceShell className="source-pyramid-distribution" title={dashboardTitle(data, '数据分布统计')} titleEditable onTitleChange={updateTitle} data={data} width={width} height={height} onAdjust={(delta) => delta > 0 ? addLayer() : removeLayer()}>
    <div className="source-pyramid-distribution__body"><svg viewBox={`0 0 ${width} ${viewHeight}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="3D 金字塔分布图"><defs><filter id="pyramid-anchor-glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter><filter id="pyramid-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" /></filter>{points.map((point, index) => <React.Fragment key={`gradients-${index}`}><linearGradient key={`left-${index}`} id={`pyramid-left-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={point.c1} stopOpacity=".98" /><stop offset="100%" stopColor={point.c2} stopOpacity=".92" /></linearGradient><linearGradient key={`right-${index}`} id={`pyramid-right-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={point.c2} stopOpacity=".95" /><stop offset="100%" stopColor={point.c2} stopOpacity=".62" /></linearGradient></React.Fragment>)}</defs><ellipse cx={cx} cy={baseCy + baseDepth + 15} rx={baseHw + 30} ry={baseDepth + 12} fill="rgba(0,30,80,.35)" filter="url(#pyramid-shadow)" />
      {points.map((point, index) => { const n = points.length; const top = corners(1 - index / n); const bottom = corners(1 - (index + 1) / n); const leftPath = `M ${bottom.left.x} ${bottom.left.y} L ${bottom.front.x} ${bottom.front.y} L ${top.front.x} ${top.front.y} L ${top.left.x} ${top.left.y} Z`; const rightPath = `M ${bottom.front.x} ${bottom.front.y} L ${bottom.right.x} ${bottom.right.y} L ${top.right.x} ${top.right.y} L ${top.front.x} ${top.front.y} Z`; return <g key={`${index}-${point.name}`} className="source-pyramid-distribution__layer"><path d={leftPath} fill={`url(#pyramid-left-${index})`} /><path d={rightPath} fill={`url(#pyramid-right-${index})`} /><path d={rightPath} fill="rgba(255,255,255,.08)" /><path d={`M ${top.left.x} ${top.left.y} L ${top.front.x} ${top.front.y} L ${top.right.x} ${top.right.y}`} fill="none" stroke="rgba(180,240,255,.35)" strokeWidth="1" /><line x1={bottom.left.x} y1={bottom.left.y} x2={top.left.x} y2={top.left.y} stroke="rgba(200,245,255,.55)" strokeWidth="1.2" /><line x1={bottom.right.x} y1={bottom.right.y} x2={top.right.x} y2={top.right.y} stroke="rgba(140,220,255,.4)" /><line x1={bottom.front.x} y1={bottom.front.y} x2={top.front.x} y2={top.front.y} stroke="rgba(255,255,255,.2)" strokeWidth=".8" /></g>; })}
      {points.map((point, index) => { const n = points.length; const mid = corners(1 - (index + .5) / n); const left = point.side === 'left'; const labelX = left ? 70 : 730; const labelY = mid.front.y; const anchor = left ? mid.left : mid.right; return <g key={`label-line-${index}`}><polyline points={`${anchor.x},${anchor.y} ${labelX},${anchor.y} ${labelX},${labelY}`} fill="none" stroke="rgba(160,220,255,.6)" strokeWidth="1" /><circle cx={anchor.x} cy={anchor.y} r="3" fill="#fff" filter="url(#pyramid-anchor-glow)" /></g>; })}</svg>
      <div className="source-pyramid-distribution__overlay">{points.map((point, index) => { const n = points.length; const mid = corners(1 - (index + .5) / n); const left = point.side === 'left'; return <div key={`label-${index}`} className={`source-pyramid-distribution__label ${left ? 'is-left' : 'is-right'}`} style={{ left: `${(left ? 70 : 730) / 800 * 100}%`, top: `${mid.front.y / viewHeight * 100}%` }}><span contentEditable suppressContentEditableWarning spellCheck={false} data-aether-text-key={`pyramid-name-${index}`} onBlur={(event) => updatePoint(index, { name: event.currentTarget.textContent?.trim() || point.name })}>{point.name}</span><span contentEditable suppressContentEditableWarning spellCheck={false} data-aether-text-key={`pyramid-value-${index}`} onBlur={(event) => commitValue(index, event.currentTarget.textContent || '')}>{Math.round(point.value / total * 100)}%</span></div>; })}</div>
    </div><style>{`.source-pyramid-distribution .aether-source-dashboard__header{padding:0 12px 12px}.source-pyramid-distribution__body{position:relative;width:100%;aspect-ratio:8/5}.source-pyramid-distribution__body>svg{display:block;width:100%;height:100%;overflow:visible;pointer-events:auto}.source-pyramid-distribution__layer,.source-pyramid-distribution__layer>*{pointer-events:visiblePainted}.source-pyramid-distribution__layer{transition:filter .3s ease,opacity .3s ease;cursor:pointer}.source-pyramid-distribution__layer:hover{filter:brightness(1.16) drop-shadow(0 0 5px rgba(100,235,255,.95)) drop-shadow(0 0 16px rgba(0,185,255,.72)) drop-shadow(0 0 28px rgba(0,120,255,.4));opacity:1}.source-pyramid-distribution__overlay{position:absolute;inset:0;pointer-events:none}.source-pyramid-distribution__label{position:absolute;display:flex;flex-direction:column;gap:3px;pointer-events:auto;transform:translateY(-50%);font-family:inherit}.source-pyramid-distribution__label.is-left{transform:translate(-100%,-50%);align-items:flex-end;text-align:right}.source-pyramid-distribution__label.is-right{align-items:flex-start;text-align:left}.source-pyramid-distribution__label span{outline:none;cursor:text;white-space:nowrap;border-radius:3px;padding:1px 4px}.source-pyramid-distribution__label span:first-child{color:#7dd3fc;font-size:14px;font-weight:500;letter-spacing:1px;text-shadow:0 0 10px rgba(100,200,255,.5)}.source-pyramid-distribution__label span:last-child{color:#fff;font-size:15px;font-weight:600;letter-spacing:.5px;text-shadow:0 0 8px rgba(255,255,255,.6)}.source-pyramid-distribution__label span:focus{outline:1.5px solid rgba(100,200,255,.9);background:rgba(100,200,255,.1)}`}</style>
  </DashboardSourceShell>;
};

const OFFICIAL_ICON_IDS = new Set(['icon-left', 'icon-right', 'icon-up', 'icon-down', 'icon-add', 'icon-close', 'icon-search', 'icon-menu']);
const OFFICIAL_ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'icon-left': ArrowLeft,
  'icon-right': ArrowRight,
  'icon-up': ArrowUp,
  'icon-down': ArrowDown,
  'icon-add': Plus,
  'icon-close': X,
  'icon-search': Search,
  'icon-menu': Menu,
};

const OfficialIconRenderer: React.FC<{ id: string; data: any }> = ({ id, data }) => {
  const Icon = OFFICIAL_ICON_COMPONENTS[id] || Search;
  const accent = String(data.color || data.accentColor || '#41ddff');
  const size = Math.max(18, Math.min(160, asNumber(data.iconSize, asNumber(data.size, 56))));
  return <div
    className="aether-official-native is-official-icon"
    data-aether-selection-root="true"
    style={{ display: 'grid', placeItems: 'center', width: 'fit-content', height: 'fit-content', minWidth: size, minHeight: size, padding: Math.max(4, size * 0.14), color: accent, background: data.surface === 'transparent' ? 'transparent' : `${accent}14`, border: data.showFrame === false ? 0 : `1px solid ${accent}70`, borderRadius: Math.max(0, asNumber(data.borderRadius, 8)), boxSizing: 'border-box', filter: `drop-shadow(0 0 ${Math.max(2, size * 0.12)}px ${accent}45)` }}
  >
    <Icon size={size} strokeWidth={Math.max(1.5, Math.min(3, asNumber(data.strokeWidth, 2)))} aria-hidden="true" />
  </div>;
};

export const OfficialModaoRenderer: React.FC<{ data?: any; interactive?: boolean; onDataChange?: (patch: Record<string, any>) => void; onAction?: (action: string) => void }> = ({ data = {}, interactive = true, onDataChange, onAction }) => {
  const modaoId = inferOfficialModaoId(data);
  const normalizedData = modaoId && !data.modaoId ? { ...data, modaoId } : data;
  if (OFFICIAL_ICON_IDS.has(modaoId)) return <OfficialIconRenderer id={modaoId} data={normalizedData} />;
  if ((OFFICIAL_SPECIAL_IDS.has(modaoId) || isCityMapId(modaoId)) && !['dynamic-bar', '3d-bar'].includes(modaoId)) return <OfficialSpecialRenderer data={normalizedData} interactive={interactive} onDataChange={onDataChange} onAction={onAction} />;
  data = normalizedData;
  if (OFFICIAL_SHAPE_IDS.has(modaoId)) {
    const shapeId = modaoId;
    const polygonPoints = (count: number, star = false) => { const total = Math.max(3, Math.min(star ? 20 : 24, count)) * (star ? 2 : 1); return Array.from({ length: total }, (_, index) => { const radius = star && index % 2 ? 35 : 48; const angle = Math.PI * 2 * index / total - Math.PI / 2; return `${50 + Math.cos(angle) * radius}% ${50 + Math.sin(angle) * radius}%`; }).join(','); };
    const clips: Record<string, string> = { triangle: 'polygon(50% 0,100% 100%,0 100%)', decision: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 'decision-node': 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 'flow-data': 'polygon(18% 0,100% 0,82% 100%,0 100%)', 'external-data': 'polygon(18% 0,100% 0,82% 100%,0 100%)', 'manual-input': 'polygon(0 18%,100% 0,100% 100%,0 100%)', display: 'polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)', 'flow-document': 'polygon(0 0,100% 0,100% 82%,75% 90%,50% 82%,25% 90%,0 82%)', 'start-end': 'ellipse(50% 50% at 50% 50%)', 'queue-data': 'polygon(0 12%,88% 12%,100% 50%,88% 88%,0 88%)', 'page-reference': 'polygon(0 0,78% 0,100% 22%,100% 100%,0 100%)', polygon: `polygon(${polygonPoints(Number(data.sides || 6))})`, star: `polygon(${polygonPoints(Number(data.sides || 5), true)})` };
    const shapeStyle: React.CSSProperties = { display: 'grid', placeItems: 'center', width: shapeId === 'circle' ? 76 : `min(100%, ${Math.max(40, Number(data.symbolWidth || 220))}px)`, height: shapeId === 'circle' ? 76 : undefined, minHeight: shapeId === 'circle' ? 0 : Number(data.symbolHeight || 76), padding: '10px 18px', margin: 'auto', boxSizing: 'border-box', color: '#e5f7ff', background: String(data.fillColor || `${data.accentColor || '#36d9ff'}26`), border: `${Math.max(1, Number(data.strokeWidth || 2))}px solid ${String(data.strokeColor || data.accentColor || '#36d9ff')}`, borderRadius: shapeId === 'circle' ? '50%' : shapeId === 'rounded-rect' || shapeId === 'subprocess' ? `${Math.max(0, Number(data.cornerRadius || 12))}px` : shapeId === 'database' || shapeId === 'internal-storage' ? '50% / 12%' : '3px', clipPath: clips[shapeId], transform: `rotate(${Number(data.rotation || 0)}deg)`, textAlign: 'center', fontSize: 12, lineHeight: 1.4 };
    const shapeLabel = String(data.content || data.label || modaoId);
    return <div className="aether-official-native is-shape" style={{ '--official-accent': data.accentColor || '#36d9ff', width: 'fit-content', height: 'fit-content', minWidth: 0, padding: 0, minHeight: 0, background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none', pointerEvents: 'none', opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) } as React.CSSProperties}><div data-shape-id={shapeId} data-flow-symbol={OFFICIAL_FLOW_NODE_IDS.has(shapeId)} data-aether-selection-root="true" style={{ ...shapeStyle, pointerEvents: 'auto' }}>{data.showLabel === false ? '' : shapeLabel}</div></div>;
  }
  if (['swimlane', 'vertical-swimlane', 'horizontal-swimlane'].includes(modaoId)) {
    const lanes = Array.isArray(data.lanes) && data.lanes.length ? data.lanes : [{ id: 'lane-1', label: 'Lane 1' }, { id: 'lane-2', label: 'Lane 2' }];
    const vertical = modaoId === 'vertical-swimlane' || data.orientation === 'vertical';
    return <div className="aether-official-native is-swimlane" style={{ display: 'grid', gridTemplateColumns: vertical ? `repeat(${lanes.length},minmax(0,1fr))` : '1fr', gridTemplateRows: vertical ? '1fr' : `repeat(${lanes.length},minmax(0,1fr))`, gap: 5, padding: 0, minHeight: 0, background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none', pointerEvents: 'none', opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}>{lanes.map((lane: any, index: number) => <div key={lane.id || index} style={{ display: 'grid', gridTemplateRows: vertical ? 'auto 1fr' : 'auto 1fr', minWidth: 0, border: '1px solid #31556b', background: '#0a1b2b', pointerEvents: 'auto' }}><b style={{ padding: '5px 8px', color: '#9cc4d3', background: '#102b3d', fontSize: 10 }}>{String(lane.label || `Lane ${index + 1}`)}</b><div style={{ padding: 8, color: '#e5f7ff', fontSize: 11 }}>{(Array.isArray(data.nodes) ? data.nodes : []).filter((node: any) => Number(node.lane || 0) === index).map((node: any) => <div key={node.id} style={{ margin: '4px 0', padding: '5px 7px', border: `1px solid ${data.accentColor || '#36d9ff'}70`, borderRadius: 4 }}>{node.label}</div>)}</div></div>)}</div>;
  }
  if (OFFICIAL_MEDIA_IDS.has(modaoId)) {
    const src = String(data.assetUrl || '');
    const mediaLabel = String(data.assetName || data.label || 'Media');
    const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', minHeight: 90, display: 'grid', placeItems: 'center', overflow: 'hidden', color: '#d7eef7', background: '#091a29', borderRadius: Math.max(0, Number(data.borderRadius || 8)) };
    if (['image'].includes(modaoId)) return <div style={mediaStyle}><OfficialImageContent src={src} alt={mediaLabel} style={{ width: '100%', height: '100%', objectFit: data.objectFit === 'cover' ? 'cover' : 'contain' }} /></div>;
    if (['video', 'video-player'].includes(modaoId)) return <div style={mediaStyle}><OfficialVideoContent src={src} poster={data.posterUrl || undefined} controls={data.controls !== false} autoplay={Boolean(data.autoplay)} loop={Boolean(data.loop)} muted={Boolean(data.muted)} style={{ width: '100%', height: '100%', objectFit: data.objectFit === 'cover' ? 'cover' : 'contain' }} /></div>;
    if (['audio', 'audio-player'].includes(modaoId)) return <div style={{ ...mediaStyle, minHeight: 0 }}><div data-aether-selection-root="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' }}>{src ? <audio src={src} controls={data.controls !== false} autoPlay={Boolean(data.autoplay)} loop={Boolean(data.loop)} /> : <span>{mediaLabel} · 添加音频 URL</span>}</div></div>;
    if (modaoId === 'carousel') { const slides = Array.isArray(data.items) && data.items.length ? data.items : ['Slide 1']; const activeIndex = Math.max(0, Math.min(slides.length - 1, Number(data.activeIndex || 0))); return <div style={{ ...mediaStyle, position: 'relative' }}>{src ? <OfficialImageContent src={src} alt={String(slides[activeIndex])} style={{ width: '100%', height: '100%', objectFit: data.objectFit === 'cover' ? 'cover' : 'contain' }} /> : <span>{String(slides[activeIndex])}</span>}<button type="button" aria-label="Previous slide" disabled={!interactive || slides.length < 2} onClick={() => onDataChange?.({ activeIndex: (activeIndex + slides.length - 1) % slides.length })} style={{ position: 'absolute', left: 8 }}>‹</button><button type="button" aria-label="Next slide" disabled={!interactive || slides.length < 2} onClick={() => onDataChange?.({ activeIndex: (activeIndex + 1) % slides.length })} style={{ position: 'absolute', right: 8 }}>›</button></div>; }
    if (modaoId === 'webpage') { const safeUrl = /^https?:\/\//i.test(src) ? src : ''; return <div style={{ ...mediaStyle, display: 'block' }}>{safeUrl ? <iframe title={mediaLabel} src={safeUrl} sandbox="" style={{ width: '100%', height: '100%', minHeight: 100, border: 0 }} /> : <div style={{ padding: 16 }}>{mediaLabel} · 输入 http(s) 页面 URL 后预览</div>}</div>; }
    if (modaoId === 'chat-bubble') return <div style={{ ...mediaStyle, placeItems: 'start', padding: 14 }}><div style={{ maxWidth: '80%', padding: '9px 12px', borderRadius: '12px 12px 12px 2px', background: `${data.accentColor || '#36d9ff'}30`, border: `1px solid ${data.accentColor || '#36d9ff'}70` }}>{String(data.content || mediaLabel)}</div></div>;
    if (modaoId === 'qr-code') return <div style={{ ...mediaStyle, display: 'flex', gap: 10 }}><div data-aether-selection-root="true" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><OfficialQrCode value={String(data.qrValue || data.assetUrl || 'https://aether.local')} foreground={String(data.qrForeground || '#071522')} background={String(data.qrBackground || '#ffffff')} errorCorrection={String(data.qrErrorCorrection || 'M')} /><span>{mediaLabel}</span></div></div>;
  }
  if (modaoId === 'placeholder') return <div className="aether-official-native is-placeholder" style={{ display: 'grid', placeItems: 'center', minHeight: 0, padding: 0, border: 0, borderRadius: 0, boxShadow: 'none', background: 'transparent', color: '#8aaebe', opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><span style={{ padding: 12, border: `1px dashed ${data.accentColor || '#36d9ff'}80`, color: '#8aaebe', background: '#0a1b2b' }}>{String(data.content || data.label || '占位内容')}</span></div>;
  if (modaoId === 'point-annotation') return <OfficialPointAnnotation data={data} />;
  if (modaoId === 'document') return <OfficialDocument data={data} />;
  if (modaoId === 'dynamic-component') return <OfficialDynamicComponent data={data} />;
  if (modaoId === 'annotation' || modaoId === 'point-annotation') return <div className="aether-official-native is-annotation" style={{ position: 'relative', minHeight: 90, padding: 14, color: '#e7f8ff', background: '#10283a', border: `1px solid ${data.accentColor || '#ffbd78'}80`, borderRadius: 6, opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><span style={{ position: 'absolute', left: 10, top: 10, width: 9, height: 9, borderRadius: '50%', background: data.accentColor || '#ffbd78', boxShadow: `0 0 0 4px ${data.accentColor || '#ffbd78'}25` }} /><strong style={{ display: 'block', marginLeft: 14 }}>{String(data.title || data.label || '批注')}</strong><small style={{ display: 'block', marginTop: 8, color: '#9ab5c1' }}>{String(data.content || '批注内容')}</small><em style={{ display: 'block', marginTop: 8, color: '#7394a5', fontSize: 10, fontStyle: 'normal' }}>{String(data.author || 'AETHER')} · {String(data.severity || 'info')}</em></div>;
  if (modaoId === 'code-component') return <div className="aether-official-native is-code" style={{ minHeight: 90, padding: 14, color: '#c9f4ff', background: '#06131f', border: '1px solid #244c63', borderRadius: 6, opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#7ca0b1', fontSize: 10 }}><span>{String(data.title || data.label || '代码组件')}</span><b>{String(data.language || 'html')}</b></div><pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#82f3c4', fontSize: 10 }}>{String(data.code || data.content || '// editable code')}</pre></div>;
  if (modaoId === 'dynamic-component') return <div className="aether-official-native is-dynamic-component" style={{ minHeight: 90, padding: 14, color: '#e7f8ff', background: '#0b2132', border: `1px solid ${data.accentColor || '#a78bfa'}80`, borderRadius: 8, opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><strong>{String(data.title || data.label || '动态组件')}</strong><code style={{ color: '#c8afff', fontSize: 10 }}>{String(data.componentRef || '未绑定组件')}</code></div><p style={{ margin: '8px 0', color: '#9ab5c1', fontSize: 11 }}>{String(data.content || '动态内容')}</p>{(Array.isArray(data.items) ? data.items : []).map((item: any, index: number) => <div key={`${index}-${item}`} style={{ marginTop: 5, padding: 6, border: '1px solid #2f5268', borderRadius: 4, fontSize: 10 }}>{String(item)}</div>)}</div>;
  if (OFFICIAL_CONTAINER_IDS.has(modaoId)) {
    const title = String(data.title || data.label || data.name || modaoId);
    const entries = Array.isArray(data.items) ? data.items.map(String) : [];
    const shellStyle: React.CSSProperties = { width: '100%', height: '100%', minHeight: 90, overflow: 'hidden', color: '#dff4fb', border: '1px solid #31566b', borderRadius: Math.max(0, Number(data.borderRadius || 8)), background: String(data.backgroundColor || '#0c1c30'), opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)) };
    if (modaoId === 'browser-frame' || modaoId === 'phone-frame') return <div style={{ ...shellStyle, display: 'flex', flexDirection: 'column', borderRadius: modaoId === 'phone-frame' ? 18 : shellStyle.borderRadius }}><header style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderBottom: '1px solid #28465a', color: '#9bb7c5', fontSize: 10 }}>{modaoId === 'browser-frame' && <><i style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff718a' }} /><i style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd78' }} /><i style={{ width: 6, height: 6, borderRadius: '50%', background: '#82f3c4' }} /></>}{String(data.headerMeta || title)}</header><div style={{ padding: 12, overflow: data.scrollable ? 'auto' : 'hidden' }}>{String(data.content || '页面内容')}{entries.map((entry, index) => <div key={`${index}-${entry}`} style={{ marginTop: 7, padding: 7, background: '#102b3d' }}>{entry}</div>)}</div></div>;
    if (modaoId === 'drawer' || modaoId === 'popover') return <div style={{ ...shellStyle, padding: 12, boxSizing: 'border-box' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>{title}{data.dismissible !== false && <button type="button" aria-label="Close" onClick={() => interactive && onDataChange?.({ dismissed: true })}>×</button>}</div><p style={{ color: '#9ab5c1', fontSize: 11 }}>{String(data.content || '')}</p>{entries.map((entry, index) => <div key={`${index}-${entry}`} style={{ padding: '5px 0', borderTop: '1px solid #254357', fontSize: 11 }}>{entry}</div>)}</div>;
    return <div style={{ ...shellStyle, padding: 12, boxSizing: 'border-box', overflow: data.scrollable ? 'auto' : 'hidden' }}><strong>{title}</strong><p style={{ color: '#9ab5c1', fontSize: 11, lineHeight: 1.5 }}>{String(data.content || '')}</p><div style={{ display: data.scrollDirection === 'horizontal' ? 'flex' : 'block', gap: 7 }}>{entries.map((entry, index) => <div key={`${index}-${entry}`} style={{ flex: '0 0 auto', marginTop: data.scrollDirection === 'horizontal' ? 0 : 6, padding: 7, border: '1px solid #254357', borderRadius: 4, fontSize: 11 }}>{entry}</div>)}</div></div>;
  }
  const rawKind = String(data.kind || 'text');
  const kind = modaoId === 'table' || modaoId === 'table-chart'
    ? 'table'
    : OFFICIAL_CHART_IDS.has(modaoId) || ['pie-chart', 'ring-chart', 'gauge', 'radar', 'progress-ring'].includes(modaoId)
      ? (['pie-chart', 'ring-chart', 'gauge', 'radar', 'progress-ring'].includes(modaoId) ? modaoId.replace('-chart', '') : 'chart')
      : OFFICIAL_MAP_IDS.has(modaoId)
        ? 'map'
      : ['tabs', 'top-nav', 'side-nav', 'dropdown-menu', 'popup-menu', 'nav-menu', 'vertical-menu', 'horizontal-menu', 'tree-menu', 'mobile-nav', 'segmented', 'collapse-panel', 'pagination', 'pagination-1', 'pagination-2'].includes(modaoId)
      ? 'tabs'
      : OFFICIAL_FLOW_IDS.has(modaoId)
        ? 'flow'
        : modaoId === 'file-input'
          ? 'file-input'
          : modaoId === 'number-stepper'
            ? 'number-stepper'
            : ['ios-switch', 'android-switch'].includes(modaoId)
              ? 'platform-switch'
        : ['input', 'textarea', 'select', 'date-picker', 'time-picker', 'search-input', 'password-input', 'upload'].includes(modaoId)
          ? (['input', 'textarea', 'select'].includes(modaoId) ? modaoId : 'input')
          : ['checkbox', 'radio'].includes(modaoId)
            ? modaoId
        : rawKind;
  const label = String(data.label || data.name || data.title || '官方组件');
  const active = asNumber(data.value, 58);
  const checked = Boolean(data.checked);
  const tab = Math.max(0, asNumber(data.activeTab, 0));
  const input = String(data.content ?? data.defaultValue ?? '');
  const accent = data.color || data.accentColor || '#36d9ff';
  const componentText = String(data.content || label);
  const points = normalizeDataPoints(data.items || data.series || data.chartData, data.categories);
  const columns = Array.isArray(data.columns) && data.columns.length ? data.columns.map(String) : ['Name', 'Value', 'Status'];
  const rows = normalizeTableRows(data.rows, columns);
  const flowNodes = normalizeFlowNodes(data.nodes, label);
  const tabs = Array.isArray(data.tabs) && data.tabs.length ? data.tabs.map(String) : ['Overview', 'Data', 'Settings'];
  const options = Array.isArray(data.options) && data.options.length ? data.options.map(String) : ['Option 1', 'Option 2', 'Option 3'];
  const setValue = (value: number) => onDataChange?.({ value });
  const shell = (children: React.ReactNode, className = '') => {
    // Only compact actionable controls are centered in their layer. Range/forms and
    // multi-row controls keep their natural vertical layout.
    const centeredControl = ['is-button', 'is-link', 'is-toggle', 'is-choice'].includes(className);
    // 表单/滑块/进度条是“内容高度”控件：让根节点贴合实际内容高度，避免把 240px 的设计板
    // 压进 60~80px 的图层外框时，标签与输入框被纵向压扁。
    const compactShell = /is-form|is-control|is-progress-display/.test(className);
    const hasCardSurface = className.includes('is-panel') && !className.includes('is-map') && data.surface !== 'transparent';
    const rootSurface = hasCardSurface
      ? { padding: 18, background: data.surface === 'subtle' ? 'rgba(8,28,43,.52)' : 'linear-gradient(145deg,#0c1c30,#07111f)', border: data.surface === 'subtle' ? '1px solid color-mix(in srgb,var(--official-accent) 25%,transparent)' : '1px solid color-mix(in srgb,var(--official-accent) 48%,#20344d)', borderRadius: `${Math.max(0, asNumber(data.borderRadius, 8))}px`, boxShadow: data.surface === 'subtle' ? 'none' : 'inset 0 1px rgba(255,255,255,.08),0 14px 28px rgba(0,0,0,.26)' }
      : { padding: 0, minHeight: 0, background: 'transparent', border: 0, borderRadius: 0, boxShadow: 'none' };
    return <><div className={`aether-official-native ${className}`} style={{ '--official-accent': accent, '--official-radius': `${Math.max(0, asNumber(data.borderRadius, 8))}px`, opacity: Math.max(0, Math.min(1, asNumber(data.opacity, 100) / 100)), ...rootSurface, ...(compactShell ? { height: 'fit-content', minHeight: 0 } : {}), ...(className.includes('is-progress-display') ? { display: 'flex', flexDirection: 'column', justifyContent: 'center' } : {}), ...(centeredControl ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}) } as unknown as React.CSSProperties}>{children}</div><style>{`.aether-official-native{box-sizing:border-box;width:100%;height:100%;min-height:108px;padding:18px;color:#e5f7ff;background:linear-gradient(145deg,#0c1c30,#07111f);border:1px solid color-mix(in srgb,var(--official-accent) 48%,#20344d);border-radius:var(--official-radius);box-shadow:inset 0 1px rgba(255,255,255,.08),0 14px 28px rgba(0,0,0,.26);font-family:inherit}.aether-official-native small{display:block;color:#87a7bd;font-size:11px;margin-top:8px}.aether-official-native button,.aether-official-native input,.aether-official-native select,.aether-official-native textarea{font:inherit}.aether-official-native button{cursor:pointer}.is-text{display:flex;flex-direction:column;justify-content:center}.is-text strong{font-size:28px;letter-spacing:.03em}.official-shape{display:grid;place-items:center;width:100%;height:100%;border:1px solid var(--official-accent);background:color-mix(in srgb,var(--official-accent) 15%,transparent);box-shadow:0 0 24px color-mix(in srgb,var(--official-accent) 22%,transparent)}.official-shape--circle{border-radius:50%}.official-shape span,.official-link,.official-action,.official-toggle span,.official-control-head,.official-form label,.official-table-title,.official-chart-title,.official-note strong,.official-panel strong{font-size:13px}.official-line{display:flex;align-items:center;gap:12px;height:100%;color:#8aaec0}.official-line i{height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--official-accent),transparent)}.official-media{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;text-align:center}.official-media-icon{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--official-accent);color:var(--official-accent);font-size:26px}.official-action{display:flex;justify-content:space-between;align-items:center;width:auto;min-width:120px;max-width:100%;height:48px;padding:0 18px;border:1px solid var(--official-accent);border-radius:6px;color:#e9fcff;background:linear-gradient(90deg,color-mix(in srgb,var(--official-accent) 30%,transparent),rgba(9,24,40,.4));box-shadow:0 0 18px color-mix(in srgb,var(--official-accent) 22%,transparent)}.official-action.is-secondary{border-color:#6d7f96;background:rgba(255,255,255,.04)}.official-link{height:42px;padding:0 16px;border:1px dashed var(--official-accent);border-radius:6px;color:var(--official-accent);background:transparent}.official-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;width:auto;min-width:140px;max-width:100%;height:42px;padding:0;border:0;color:#d6eef8;background:transparent;text-align:left}.official-toggle i{width:42px;height:22px;border-radius:11px;background:#1e3346;position:relative;transition:.2s}.official-toggle i:after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#7690a2;transition:.2s}.official-toggle.is-on i{background:color-mix(in srgb,var(--official-accent) 45%,#132536)}.official-toggle.is-on i:after{left:23px;background:var(--official-accent);box-shadow:0 0 10px var(--official-accent)}.official-control-head,.official-table-title,.official-chart-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.official-control-head b,.official-table-title span{color:var(--official-accent)}.is-control input[type=range],.is-viz input[type=range]{width:100%;accent-color:var(--official-accent)}.official-progress{height:5px;margin-top:15px;border-radius:3px;background:#1b3043;overflow:hidden}.official-progress i{display:block;height:100%;background:var(--official-accent);box-shadow:0 0 10px var(--official-accent)}.is-form{display:flex;flex-direction:column;justify-content:center;gap:8px}.is-form label{color:#8eaabd}.is-form input,.is-form textarea,.is-form select{box-sizing:border-box;width:100%;min-height:38px;padding:8px 10px;color:#e7f6ff;background:#091a2b;border:1px solid #27465d;border-radius:5px;outline:none}.is-form textarea{min-height:62px;resize:vertical}.official-tabs{display:flex;gap:4px;border-bottom:1px solid #223c53}.official-tabs button{padding:7px 12px;border:0;border-bottom:2px solid transparent;color:#7998ab;background:transparent}.official-tabs button.is-active{color:var(--official-accent);border-color:var(--official-accent)}.official-tab-body{display:flex;flex-direction:column;gap:8px;padding-top:20px}.official-table{display:grid;gap:7px}.official-table>div{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #1c3348;color:#9db7c7;font-size:11px}.official-table b{color:#e8f9ff}.official-table i{font-style:normal;color:#4ade80;font-size:10px}.official-table i.warn{color:#fbbf24}.official-chart{display:flex;align-items:end;gap:10px;height:98px;padding:8px 4px 0;border-bottom:1px solid #28455b}.official-chart i{flex:1;min-width:12px;background:linear-gradient(180deg,var(--official-accent),color-mix(in srgb,var(--official-accent) 22%,transparent));box-shadow:0 0 12px color-mix(in srgb,var(--official-accent) 30%,transparent)}.official-chart-axis{display:flex;justify-content:space-between;color:#6f8da2;font-size:10px;padding-top:5px}.official-viz{display:flex;flex-direction:column;align-items:center;gap:10px}.official-viz-ring{display:grid;place-items:center;width:112px;height:112px;border-radius:50%;background:conic-gradient(var(--official-accent) var(--official-value),#173047 0);position:relative}.official-viz-ring:after{content:'';position:absolute;inset:10px;border-radius:50%;background:#0b1a2b}.official-viz-ring b{position:relative;z-index:1;color:#fff;font-size:20px}.official-note{display:flex;align-items:flex-start;gap:12px;padding:12px;border-left:2px solid var(--official-accent);background:rgba(54,217,255,.06)}.official-note>span{color:var(--official-accent);font-size:20px}.official-note small{margin-top:4px}.official-arrow{display:flex;align-items:center;justify-content:space-between;color:#dff9ff;font-size:13px}.official-arrow b{font-size:32px;color:var(--official-accent);text-shadow:0 0 14px var(--official-accent)}.official-panel>div{display:grid;gap:7px;margin-top:14px;max-height:105px;overflow:auto}.official-panel span{padding:9px 11px;border:1px solid #1d3b52;color:#9fc2d4;background:rgba(255,255,255,.025)}.official-flow{display:flex;align-items:center;gap:6px;height:100%;font-size:11px;overflow:auto}.official-flow span{padding:9px 10px;border:1px solid var(--official-accent);background:color-mix(in srgb,var(--official-accent) 10%,transparent);flex:0 0 auto}.official-flow i{color:var(--official-accent);font-style:normal;font-size:20px;flex:0 0 auto}@media(prefers-reduced-motion:reduce){.aether-official-native *{transition:none!important;animation:none!important}}`}</style></>;
  };
  if (kind === 'text' || kind === 'title') return shell(<><strong>{componentText}</strong><small>{data.subtitle || '可编辑文本组件'}</small></>, 'is-text');
  if (kind === 'rect' || kind === 'circle' || kind === 'shape') return shell(<div className={`official-shape official-shape--${kind}`}><span>{componentText}</span></div>, 'is-shape');
  if (kind === 'line' || kind === 'divider') return shell(<div className="official-line" data-aether-selection-root="true"><i /><span>{label}</span><i /></div>, 'is-line');
  if (kind === 'image' || kind === 'media') return shell(<div className="official-media" data-aether-selection-root="true"><span className="official-media-icon">▧</span><strong>{label}</strong><small>{data.assetName || '媒体占位区，可绑定图片/视频'}</small></div>, 'is-media');
  if (kind === 'link' || kind === 'link-area') return shell(<button type="button" className="official-link" onClick={() => setValue(active === 100 ? 0 : 100)} disabled={!interactive}>↗ {label}</button>, 'is-link');
  if (kind === 'button' || kind === 'button2') {
    const action = String(data.action || 'none');
    const nextPressed = !Boolean(data.pressed);
    return shell(<>
      <button type="button" data-aether-selection-root="true" className={`official-action ${kind === 'button2' || modaoId === 'secondary-button' ? 'is-secondary' : ''} ${modaoId === 'icon-button' ? 'is-icon' : ''} ${modaoId === 'close-button' ? 'is-close' : ''} ${data.pressed ? 'is-pressed' : ''}`} onClick={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        setValue(active === 100 ? 0 : 100);
        onDataChange?.({ pressed: nextPressed, lastAction: action || String(data.buttonLabel || componentText), action });
        if (action !== 'none') onAction?.(action);
      }} disabled={!interactive || Boolean(data.disabled)} aria-pressed={Boolean(data.pressed)}>{String(data.buttonLabel || componentText)}<span>{String(data.icon || (modaoId === 'close-button' ? '×' : '›'))}</span></button>
      {data.actionStatus && <span role="status" aria-live="polite" style={{ display: 'block', marginTop: 6, color: accent, fontSize: 10, textAlign: 'center' }}>{String(data.actionStatus)}</span>}
    </>, 'is-button');
  }
  if (kind === 'toggle' || kind === 'switch' || kind === 'platform-switch') return shell(<button type="button" data-aether-selection-root="true" role="switch" className={`official-toggle ${kind === 'platform-switch' ? `is-${modaoId}` : ''} ${checked ? 'is-on' : ''}`} onClick={() => onDataChange?.({ checked: !checked })} disabled={!interactive || Boolean(data.disabled)} aria-label={label} aria-checked={checked}><span>{label}{data.required ? ' *' : ''}</span><span aria-hidden="true" className="official-toggle-state">{checked ? '开' : '关'}</span><i /></button>, 'is-toggle');
  if (kind === 'checkbox' || kind === 'radio') return shell(<label className="official-choice" data-aether-selection-root="true"><input type={kind} checked={checked} onChange={(event) => onDataChange?.({ checked: event.target.checked })} disabled={!interactive || Boolean(data.disabled)} required={Boolean(data.required)} /><span>{label}{data.required ? ' *' : ''}</span></label>, 'is-choice');
  if (kind === 'slider' || kind === 'progress') {
    const min = asNumber(data.min, 0);
    const max = Math.max(min + 1, asNumber(data.max, 100));
    const boundedValue = Math.min(max, Math.max(min, active));
    const percentage = Math.max(0, Math.min(100, ((boundedValue - min) / (max - min)) * 100));
    if (modaoId === 'progress-bar') {
      const trackHeight = Math.max(2, Math.min(24, asNumber(data.trackHeight, 8)));
      return shell(<div className="official-progress-display" style={{ display: 'grid', gap: 10, width: '100%', alignContent: 'center' }}>
        {(data.showLabel !== false || data.showValue !== false) && <div className="official-control-head" style={{ margin: 0 }}>
          {data.showLabel !== false ? <span>{label}</span> : <span aria-hidden="true" />}
          {data.showValue !== false && <b>{boundedValue}{data.unit || '%'}</b>}
        </div>}
        <div className="official-progress" role="progressbar" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={boundedValue} style={{ height: trackHeight, margin: 0 }}>
          <i style={{ width: `${percentage}%` }} />
        </div>
      </div>, 'is-control is-progress-display');
    }
    const step = Math.max(0.0001, asNumber(data.step, 1));
    return shell(<><div className="official-control-head"><span>{label}</span><b>{boundedValue}{data.unit || '%'}</b></div><input type="range" min={min} max={max} step={step} value={boundedValue} onChange={(e) => setValue(Number(e.target.value))} disabled={!interactive || Boolean(data.disabled)} /><div className="official-progress"><i style={{ width: `${percentage}%` }} /></div></>, 'is-control');
  }
  if (kind === 'number-stepper') { const min = asNumber(data.min, 0); const max = Math.max(min, asNumber(data.max, 100)); const step = Math.max(0.0001, asNumber(data.step, 1)); const stepButtonStyle: React.CSSProperties = { width: 36, height: 34, border: '1px solid #31506a', borderRadius: 5, color: '#dff9ff', background: '#10283b' }; return shell(<><div className="official-control-head"><span>{label}</span><b>{active}{data.unit || ''}</b></div><div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}><button type="button" style={stepButtonStyle} onClick={() => setValue(Math.max(min, active - step))} disabled={!interactive || Boolean(data.disabled) || active <= min} aria-label="减少">−</button><input type="number" min={min} max={max} step={step} value={Math.min(max, Math.max(min, active))} onChange={(event) => setValue(Number(event.target.value))} disabled={!interactive || Boolean(data.disabled)} style={{ width: 90, height: 34, border: '1px solid #31506a', borderRadius: 5, color: '#e7f6ff', background: '#091a2b', textAlign: 'center' }} /><button type="button" style={stepButtonStyle} onClick={() => setValue(Math.min(max, active + step))} disabled={!interactive || Boolean(data.disabled) || active >= max} aria-label="增加">＋</button></div></>, 'is-control'); }
  if (kind === 'file-input') return shell(<><label>{label}{data.required ? ' *' : ''}</label><input type="file" onChange={(event) => onDataChange?.({ assetName: event.target.files?.[0]?.name || '' })} disabled={!interactive || Boolean(data.disabled)} required={Boolean(data.required)} /><small>{data.assetName || data.placeholder || '选择文件'}</small></>, 'is-form');
  if (kind === 'input' || kind === 'textarea' || kind === 'select') return shell(<><label>{label}{data.required ? ' *' : ''}</label>{kind === 'select' ? <select value={input} onChange={(e) => onDataChange?.({ content: e.target.value })} disabled={!interactive || Boolean(data.disabled)} required={Boolean(data.required)}>{options.map((option) => <option key={option}>{option}</option>)}</select> : kind === 'textarea' ? <textarea value={input} placeholder={data.placeholder || ''} onChange={(e) => onDataChange?.({ content: e.target.value })} disabled={!interactive || Boolean(data.disabled)} required={Boolean(data.required)} rows={asNumber(data.rowsCount, 3)} /> : <input type={['date-picker', 'time-picker', 'password-input'].includes(modaoId) ? ({ 'date-picker': 'date', 'time-picker': 'time', 'password-input': 'password' } as Record<string, string>)[modaoId] : 'text'} value={input} placeholder={data.placeholder || '请输入'} onChange={(e) => onDataChange?.({ content: e.target.value })} disabled={!interactive || Boolean(data.disabled)} required={Boolean(data.required)} />}</>, 'is-form');
  if (kind === 'tabs' && ['dropdown-menu', 'popup-menu'].includes(modaoId)) return shell(<><label>{label}</label><select value={String(tab)} onChange={(event) => onDataChange?.({ activeTab: Number(event.target.value) })} disabled={!interactive}>{tabs.map((item, index) => <option key={`${item}-${index}`} value={index}>{item}</option>)}</select></>, 'is-form');
  if (kind === 'tabs' && ['pagination', 'pagination-1', 'pagination-2'].includes(modaoId)) return shell(<><div className="official-chart-title">{label}</div><div className="official-tabs">{tabs.map((item, index) => <button type="button" key={`${item}-${index}`} className={tab === index ? 'is-active' : ''} onClick={() => onDataChange?.({ activeTab: index })} disabled={!interactive} aria-current={tab === index ? 'page' : undefined}>{item}</button>)}</div></>, 'is-tabs');
  if (kind === 'tabs' && modaoId === 'collapse-panel') return shell(<><button type="button" className="official-action" onClick={() => onDataChange?.({ activeTab: tab === 0 ? 1 : 0 })} disabled={!interactive} aria-expanded={tab === 0}>{tabs[0] || label}<span>{tab === 0 ? '−' : '+'}</span></button>{tab === 0 && <div className="official-tab-body"><small>{String(data.content || label)}</small></div>}</>, 'is-tabs');
  if (kind === 'tabs' || kind === 'nav') return shell(<><div className="official-tabs" style={{ flexDirection: data.orientation === 'vertical' ? 'column' : 'row' }}>{tabs.map((item, index) => <button type="button" key={`${item}-${index}`} className={tab === index ? 'is-active' : ''} onClick={() => onDataChange?.({ activeTab: index })} disabled={!interactive} aria-current={tab === index ? 'page' : undefined}>{item}</button>)}</div><div className="official-tab-body"><strong>{tabs[tab] || tabs[0]}</strong><small>{String(data.content || label)}</small></div></>, 'is-tabs');
  if (kind === 'table') return shell(<><div className="official-table-title">{label}<span>{data.showHeader === false ? '' : 'Live'}</span></div><div className="official-table">{data.showHeader !== false && <div className="official-table-header" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}>{columns.map((column) => <b key={column}>{column}</b>)}</div>}{rows.map((row, rowIndex) => <div key={row.id || rowIndex} style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length, row.cells.length)}, minmax(0, 1fr))` }}>{row.cells.map((cell, columnIndex) => <span key={`${row.id}-${columnIndex}`}><b>{cell}</b></span>)}</div>)}</div></>, 'is-table');
  if (kind === 'chart' && modaoId === 'bubble-chart') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Value'}</small></div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', flexWrap: 'wrap', gap: 6, minHeight: 96 }}>{points.map((point) => <span key={point.id} title={`${point.label}: ${point.value}`} style={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: `${Math.max(24, Math.min(62, 24 + point.value / 3))}px`, height: `${Math.max(24, Math.min(62, 24 + point.value / 3))}px`, borderRadius: '50%', color: '#071522', fontSize: 9, background: point.color || accent }}>{point.label}</span>)}</div></>, 'is-chart is-bubble-chart');
  if (kind === 'chart' && modaoId === 'wordcloud-chart') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Keywords'}</small></div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 14px', minHeight: 96 }}>{points.map((point, index) => <span key={point.id} style={{ color: point.color || accent, fontWeight: 700, fontSize: `${Math.max(11, Math.min(27, 11 + point.value / 5))}px`, transform: `rotate(${index % 2 ? -8 : 5}deg)` }}>{point.label}</span>)}</div></>, 'is-chart is-word-cloud');
  if (kind === 'chart') {
    const maxValue = Math.max(1, asNumber(data.max, Math.max(...points.map((item) => item.value), 100)));
    if (modaoId === 'bar-chart-horizontal') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Data'}</small></div><div style={{ display: 'grid', gap: 7 }}>{points.map((point) => <div key={point.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(42px, 1fr) minmax(30px, 3fr) auto', alignItems: 'center', gap: 7, fontSize: 10 }}><span>{point.label}</span><i style={{ display: 'block', height: 12, width: `${Math.max(0, Math.min(100, point.value / maxValue * 100))}%`, borderRadius: 3, background: point.color || accent }} /><b>{point.value}</b></div>)}</div></>, 'is-chart is-horizontal-chart');
    if (['line-chart', 'area-chart'].includes(modaoId)) {
      const coords = points.map((point, index) => `${points.length < 2 ? 50 : (index / (points.length - 1)) * 100},${100 - Math.max(0, Math.min(100, (point.value / maxValue) * 100))}`);
      const line = coords.join(' ');
      const area = `0,100 ${line} 100,100`;
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Data'}</small></div><svg className="official-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label} style={{ pointerEvents: 'none' }}>{data.showGrid !== false && [25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#28455b" strokeDasharray="2 2" />)}{modaoId === 'area-chart' && <polygon points={area} fill={accent} fillOpacity=".2" />}<polyline points={line} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />{coords.map((point, index) => { const [x, y] = point.split(','); return <circle key={index} cx={x} cy={y} r="1.7" fill={points[index].color || accent} />; })}</svg>{data.showLegend !== false && <div className="official-chart-axis">{points.map((point) => <span key={point.id}>{point.label}</span>)}</div>}</>, 'is-chart');
    }
    if (modaoId === 'funnel') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Users'}</small></div><div className="official-funnel">{points.map((point, index) => <div key={point.id} style={{ width: `${Math.max(18, Math.min(100, (point.value / maxValue) * 100))}%`, background: point.color || accent }}><span>{point.label}</span><b>{point.value}</b></div>)}</div></>, 'is-chart');
    if (modaoId === 'heatmap') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Intensity'}</small></div><div className="official-heatmap">{points.map((point) => <div key={point.id} title={`${point.label}: ${point.value}`} style={{ background: point.color || accent, opacity: Math.max(.18, Math.min(1, point.value / maxValue)) }}>{point.label}</div>)}</div></>, 'is-chart');
    if (modaoId === 'scatter') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Distribution'}</small></div><div className="official-scatter">{points.map((point, index) => <i key={point.id} title={`${point.label}: ${point.value}`} style={{ left: `${points.length < 2 ? 50 : (index / (points.length - 1)) * 90 + 5}%`, bottom: `${Math.max(5, Math.min(90, (point.value / maxValue) * 90))}%`, background: point.color || accent, width: `${8 + (point.value / maxValue) * 10}px`, height: `${8 + (point.value / maxValue) * 10}px` }} />)}</div></>, 'is-chart');
    if (modaoId === 'combo-chart') {
      const coords = points.map((point, index) => `${points.length < 2 ? 50 : (index / (points.length - 1)) * 100},${100 - Math.max(0, Math.min(100, (point.value / maxValue) * 100))}`);
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Data'}</small></div><div style={{ position: 'relative', height: 110 }}><div style={{ position: 'absolute', inset: '8px 0 0', display: 'flex', alignItems: 'end', justifyContent: 'space-around' }}>{points.map((point, index) => <i key={point.id} style={{ height: `${Math.max(8, Math.min(90, point.value / maxValue * 90))}%`, width: `${Math.max(8, 52 / points.length)}%`, background: `${point.color || accent}55`, borderTop: `2px solid ${point.color || accent}` }} />)}</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}><polyline points={coords.join(' ')} fill="none" stroke="#f5bd68" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />{coords.map((coord, index) => { const [x, y] = coord.split(','); return <circle key={index} cx={x} cy={y} r="2" fill="#f5bd68" />; })}</svg></div></>, 'is-chart is-combo-chart');
    }
    if (modaoId === 'tree-chart') return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Hierarchy'}</small></div><div style={{ display: 'grid', justifyItems: 'center', gap: 8, minHeight: 100, paddingTop: 6 }}><div style={{ padding: '6px 14px', border: `1px solid ${accent}`, borderRadius: 4, color: '#e8f9ff', background: `${accent}25` }}>{points[0]?.label || label}</div><div style={{ width: 1, height: 10, background: `${accent}90` }} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(58px,1fr))', gap: 5, width: '100%' }}>{points.slice(1).map((point) => <div key={point.id} style={{ minWidth: 0, padding: '7px 3px', border: `1px solid ${point.color || accent}90`, borderRadius: 3, color: '#a9c9d9', background: `${point.color || accent}20`, textAlign: 'center', fontSize: 9 }}>{point.label}</div>)}</div></div></>, 'is-chart is-tree-chart');
    if (modaoId === 'waterfall-chart') {
      const positiveTotal = points.reduce((sum, point) => sum + Math.max(0, point.value), 0) || 1;
      let running = 0;
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Change'}</small></div><div style={{ display: 'flex', alignItems: 'end', gap: 5, height: 104, padding: '8px 4px 0', borderBottom: '1px solid #28455b' }}>{points.map((point, index) => { const start = running; running += point.value; const height = Math.max(8, Math.abs(point.value) / positiveTotal * 82); return <i key={point.id} title={`${point.label}: ${point.value}`} style={{ alignSelf: 'end', flex: 1, minWidth: 7, height, marginBottom: `${Math.min(72, Math.max(0, start / positiveTotal * 72))}%`, background: point.value >= 0 ? point.color || accent : '#fb7185', borderRadius: '2px 2px 0 0' }} />; })}</div>{data.showLegend !== false && <div className="official-chart-axis">{points.map((point) => <span key={point.id}>{point.label}</span>)}</div>}</>, 'is-chart is-waterfall-chart');
    }
    if (modaoId === 'rose-chart') {
      const sector = 100 / Math.max(1, points.length);
      const stops = points.map((point, index) => `${point.color || accent} ${index * sector}% ${(index + 1) * sector}%`).join(',');
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Category'}</small></div><div style={{ display: 'grid', placeItems: 'center', minHeight: 100 }}><div role="img" aria-label={label} style={{ width: 112, height: 88, borderRadius: '50%', background: `repeating-radial-gradient(circle,transparent 0 12px,rgba(160,190,210,.14) 13px 14px),conic-gradient(${stops})`, clipPath: 'ellipse(50% 50% at 50% 50%)', transform: 'scaleY(.78)' }} /></div></>, 'is-chart is-rose-chart');
    }
    if (modaoId === 'water-wave') { const percent = Math.max(0, Math.min(100, active)); return shell(<><div className="official-chart-title">{label}<small>{data.unit || '%'}</small></div><div style={{ display: 'grid', placeItems: 'center', minHeight: 100 }}><div style={{ position: 'relative', width: 94, height: 74, overflow: 'hidden', border: `2px solid ${accent}90`, borderRadius: '4px 4px 28px 28px', background: '#0a1a2a' }}><div style={{ position: 'absolute', top: `${100 - percent}%`, right: '-10%', bottom: 0, left: '-10%', background: `linear-gradient(180deg,${accent}aa,${accent}55)` }} /><strong style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#f0fbff' }}>{percent}{String(data.unit || '%')}</strong></div></div></>, 'is-chart is-water-wave'); }
    if (modaoId === 'yuejue-chart' || modaoId === 'sunburst-chart') {
      const stops = points.map((point, index) => `${point.color || accent} ${index / Math.max(1, points.length) * 100}% ${(index + 1) / Math.max(1, points.length) * 100}%`).join(',');
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Hierarchy'}</small></div><div style={{ display: 'grid', placeItems: 'center', minHeight: 100 }}><div style={{ position: 'relative', width: 92, height: 92, borderRadius: '50%', background: `conic-gradient(${stops})`, boxShadow: `0 0 18px ${accent}20` }}><div style={{ position: 'absolute', inset: modaoId === 'yuejue-chart' ? 22 : 28, border: `1px solid ${accent}99`, borderRadius: '50%', background: '#0b1a2b' }} />{modaoId === 'sunburst-chart' && <div style={{ position: 'absolute', inset: 8, border: '1px dashed rgba(220,240,255,.35)', borderRadius: '50%' }} />}</div></div></>, `is-chart is-${modaoId}`);
    }
    if (modaoId === 'boxplot-chart') {
      const sorted = points.map((point) => point.value).sort((a, b) => a - b);
      const low = sorted[0] ?? 0; const high = sorted[sorted.length - 1] ?? 1; const q1 = sorted[Math.floor(sorted.length * .25)] ?? low; const median = sorted[Math.floor(sorted.length * .5)] ?? low; const q3 = sorted[Math.floor(sorted.length * .75)] ?? high; const range = Math.max(1, high - low);
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Distribution'}</small></div><div style={{ display: 'grid', placeItems: 'center', minHeight: 100 }}><div style={{ position: 'relative', width: '82%', height: 40 }}><i style={{ position: 'absolute', left: `${(low / maxValue) * 100}%`, right: `${100 - (high / maxValue) * 100}%`, top: 19, height: 2, background: accent }} /><i style={{ position: 'absolute', left: `${(q1 / maxValue) * 100}%`, width: `${Math.max(8, ((q3 - q1) / range) * 44)}%`, top: 7, height: 26, border: `1px solid ${accent}`, background: `${accent}35` }} /><b style={{ position: 'absolute', left: `${(median / maxValue) * 100}%`, top: 5, height: 30, borderLeft: '2px solid #f3f8ff' }} /></div><div className="official-chart-axis"><span>{low}</span><span>Median {median}</span><span>{high}</span></div></div></>, 'is-chart is-boxplot-chart');
    }
    if (modaoId === 'sankey-chart') {
      const split = Math.max(1, Math.ceil(points.length / 2));
      const sources = points.slice(0, split);
      const targets = points.slice(split);
      const targetList = targets.length ? targets : sources;
      const sourceY = (index: number) => 16 + (index + 0.5) * (68 / Math.max(1, sources.length));
      const targetY = (index: number) => 16 + (index + 0.5) * (68 / Math.max(1, targetList.length));
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Flow'}</small></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label} style={{ width: '100%', height: 108, pointerEvents: 'none' }}>{sources.map((source, index) => { const targetIndex = index % targetList.length; const y1 = sourceY(index); const y2 = targetY(targetIndex); return <path key={`flow-${source.id}-${targetList[targetIndex]?.id}`} d={`M8 ${y1} C42 ${y1} 50 ${y2} 88 ${y2}`} fill="none" stroke={source.color || accent} strokeOpacity=".5" strokeWidth="8" vectorEffect="non-scaling-stroke" />; })}{sources.map((point, index) => <rect key={`source-${point.id}`} x="5" y={sourceY(index) - 5} width="6" height="10" fill={point.color || accent} />)}{targetList.map((point, index) => <rect key={`target-${point.id}`} x="87" y={targetY(index) - 6} width="7" height="12" fill={point.color || accent} />)}</svg>{data.showLegend !== false && <div className="official-chart-axis" style={{ flexWrap: 'wrap' }}>{points.map((point) => <span key={point.id}>{point.label}</span>)}</div>}</>, 'is-chart is-sankey-chart');
    }
    if (modaoId === '3d-bar') {
      const chartWidth = 320;
      const baseY = 112;
      const plotTop = 16;
      const depth = Math.max(4, Math.min(28, asNumber(data.depth, 16)));
      const perspective = Math.max(12, Math.min(55, asNumber(data.perspective, 34)));
      const extrusionX = depth * Math.cos(perspective * Math.PI / 180);
      const extrusionY = depth * Math.sin(perspective * Math.PI / 180);
      const groupWidth = (chartWidth - 32) / Math.max(1, points.length);
      const barWidth = Math.min(30, groupWidth * 0.52);
      const plotMax = Math.max(1, maxValue);
      return shell(<>
        <div className="official-chart-title">{label}<small>{data.unit || 'Data'}</small></div>
        <svg viewBox={`0 0 ${chartWidth} 145`} preserveAspectRatio="none" role="img" aria-label={`${label}，立体柱状图`} style={{ width: '100%', height: 126, overflow: 'visible', pointerEvents: 'none' }}>
          {data.showGrid !== false && [0, 1, 2, 3].map((index) => {
            const y = plotTop + ((baseY - plotTop) / 3) * index;
            return <line key={index} x1="10" x2="310" y1={y} y2={y} stroke="#315166" strokeOpacity=".52" strokeDasharray="3 5" />;
          })}
          {data.showFloor !== false && <g aria-hidden="true" fill="none" stroke="#40637a" strokeOpacity=".55">
            <path d={`M10 ${baseY - extrusionY} L310 ${baseY - extrusionY} L${310 + extrusionX} ${baseY} L${10 + extrusionX} ${baseY} Z`} fill="rgba(30,67,91,.16)" />
            {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1={10 + extrusionX * fraction} x2={310 + extrusionX * fraction} y1={baseY - extrusionY * fraction} y2={baseY - extrusionY * fraction} />)}
          </g>}
          {points.map((point, index) => {
            const color = String(point.color || accent);
            const value = Math.max(0, Number(point.value) || 0);
            const x = 16 + groupWidth * index + (groupWidth - barWidth) / 2;
            if (value === 0) return <g key={point.id || index}><title>{`${point.label}: 0${data.unit || ''}`}</title>{data.showLegend !== false && <text x={x + barWidth / 2} y={baseY + 20} textAnchor="middle" fill="#8da8b9" fontSize="8">{point.label}</text>}</g>;
            const height = Math.max(value > 0 ? 3 : 0, Math.min(baseY - plotTop, (value / plotMax) * (baseY - plotTop)));
            const y = baseY - height;
            const front = `M${x} ${y} H${x + barWidth} V${baseY} H${x} Z`;
            const side = `M${x + barWidth} ${y} L${x + barWidth + extrusionX} ${y - extrusionY} L${x + barWidth + extrusionX} ${baseY - extrusionY} L${x + barWidth} ${baseY} Z`;
            const top = `M${x} ${y} L${x + extrusionX} ${y - extrusionY} H${x + barWidth + extrusionX} L${x + barWidth} ${y} Z`;
            return <g key={point.id || index}>
              <title>{`${point.label}: ${value}${data.unit || ''}`}</title>
              <path d={side} fill={`color-mix(in srgb, ${color} 58%, #06111e)`} stroke={`${color}aa`} strokeWidth=".7" />
              <path d={top} fill={`color-mix(in srgb, ${color} 78%, white)`} stroke={`${color}dd`} strokeWidth=".7" />
              <path d={front} fill={color} stroke={`${color}dd`} strokeWidth=".7" />
              {data.showValues !== false && <text x={x + barWidth / 2 + extrusionX / 2} y={Math.max(10, y - extrusionY - 4)} textAnchor="middle" fill="#d9edf7" fontSize="8">{value}</text>}
              {data.showLegend !== false && <text x={x + barWidth / 2 + extrusionX / 2} y={baseY + 20} textAnchor="middle" fill="#8da8b9" fontSize="8">{point.label}</text>}
            </g>;
          })}
        </svg>
      </>, 'is-chart is-3d-chart');
    }
    return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Data'}</small></div><div className="official-chart" style={{ backgroundImage: data.showGrid === false ? 'none' : 'repeating-linear-gradient(to top, transparent 0, transparent 23%, rgba(76,113,139,.2) 24%, transparent 25%)' }}>{points.map((point, index) => <i key={point.id || index} title={`${point.label}: ${point.value}`} style={{ height: `${Math.max(8, Math.min(100, point.value / maxValue * 100))}%`, background: point.color || accent }} />)}</div>{data.showLegend !== false && <div className="official-chart-axis">{points.map((point) => <span key={point.id}>{point.label}</span>)}</div>}</>, `is-chart ${modaoId === '3d-bar' ? 'is-3d-chart' : ''}`);
  }
  if (kind === 'pie' || kind === 'gauge' || kind === 'radar') {
    const total = points.reduce((sum, point) => sum + Math.max(0, point.value), 0) || 1;
    const gaugeMin = asNumber(data.min, 0);
    const gaugeMax = Math.max(gaugeMin + 1, asNumber(data.max, 100));
    const percentage = kind === 'pie' ? Math.round((Math.max(0, points[0]?.value || 0) / total) * 100) : Math.round(Math.max(0, Math.min(100, ((active - gaugeMin) / (gaugeMax - gaugeMin)) * 100)));
    const segments = points.reduce<{ start: number; end: number; color: string }[]>((result, point) => { const start = result.length ? result[result.length - 1].end : 0; const end = start + (Math.max(0, point.value) / total) * 360; result.push({ start, end, color: point.color || accent }); return result; }, []);
    const gradient = segments.map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`).join(', ');
    if (modaoId === 'radar') {
      const radarPoints = points.map((point, index) => { const angle = (Math.PI * 2 * index / Math.max(3, points.length)) - Math.PI / 2; const radius = Math.max(0, Math.min(1, point.value / Math.max(1, asNumber(data.max, 100)))) * 38; return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`; }).join(' ');
      return shell(<><div className="official-chart-title">{label}<small>{data.unit || 'Score'}</small></div><svg className="official-radar" viewBox="0 0 100 100" role="img" aria-label={label} style={{ pointerEvents: 'none' }}>{[12, 25, 38].map((radius) => <circle key={radius} cx="50" cy="50" r={radius} fill="none" stroke="#28455b" />)}<polygon points={radarPoints} fill={accent} fillOpacity=".25" stroke={accent} strokeWidth="1.5" />{points.map((point, index) => <text key={point.id} x={50} y={8 + index * (82 / points.length)} fill="#9db7c7" fontSize="5" textAnchor="middle">{point.label}</text>)}</svg></>, 'is-viz');
    }
    return shell(<><style>{`.official-viz-ring.is-pie:after{display:none!important}.official-viz-ring.is-donut:after{display:block}.official-line-chart,.official-radar{display:block;width:100%;height:120px;overflow:visible}.official-funnel{display:flex;flex-direction:column;align-items:center;gap:5px}.official-funnel>div{display:flex;justify-content:space-between;padding:6px 10px;color:#061323;font-size:11px}.official-scatter,.official-heatmap{position:relative;height:110px;border-left:1px solid #28455b;border-bottom:1px solid #28455b}.official-scatter i{position:absolute;border-radius:50%}.official-heatmap{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:3px}.official-heatmap>div{display:grid;place-items:center;color:#07111f;font-size:10px}.official-choice{display:flex;align-items:center;gap:9px;color:#d6eef8}.official-choice input{accent-color:var(--official-accent)}.official-table-header{font-weight:bold;color:var(--official-accent)!important}`}</style><div className={`official-viz official-viz--${kind}`}><div className={`official-viz-ring ${modaoId === 'ring-chart' ? 'is-donut' : 'is-pie'}`} style={{ '--official-value': `${percentage * 3.6}deg`, background: gradient ? `conic-gradient(${gradient})` : undefined } as React.CSSProperties}><b>{percentage}%</b></div><span>{label}</span>{kind === 'pie' && data.showLegend !== false && <small>{points.map((point) => `${point.label} ${Math.round((Math.max(0, point.value) / total) * 100)}%`).join(' · ')}</small>}</div>{kind !== 'pie' && <input type="range" min={asNumber(data.min, 0)} max={Math.max(asNumber(data.min, 0) + 1, asNumber(data.max, 100))} value={Math.min(Math.max(asNumber(data.min, 0), active), Math.max(asNumber(data.min, 0) + 1, asNumber(data.max, 100)))} onChange={(e) => setValue(Number(e.target.value))} disabled={!interactive} />}</>, 'is-viz');
  }
  if (kind === 'map') {
    const markers = Array.isArray(data.markers) ? data.markers : [];
    return shell(<div className="official-panel" style={{ position: 'relative', overflow: 'hidden' }}><strong>{label}</strong><div><span>Center: {String(data.mapCenter || 'Beijing')}</span><span>Zoom: {asNumber(data.zoom, 10)}</span></div><div aria-label="地图标记区域" style={{ position: 'relative', minHeight: 74, marginTop: 8, border: '1px solid #284b61', borderRadius: 6, background: 'radial-gradient(circle at 50% 45%, #17445b, #0a1e31 72%)', overflow: 'hidden' }}>{markers.map((marker: any, index: number) => { const color = String(marker.color || accent); const x = Math.max(0, Math.min(100, Number(marker.x) || 50)); const y = Math.max(0, Math.min(100, Number(marker.y) || 50)); return <span key={String(marker.id || marker.label || index)} title={String(marker.label || 'Marker')} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', color: '#f5fbff', fontSize: 9, whiteSpace: 'nowrap' }}><i style={{ display: 'block', width: 9, height: 9, margin: '0 auto 2px', borderRadius: '50%', background: color, border: '1px solid #fff', boxShadow: `0 0 0 3px ${color}45` }} />{String(marker.label || `Marker ${index + 1}`)}</span>; })}</div></div>, 'is-panel is-map');
  }
  if (kind === 'annotation' || kind === 'note') return shell(<div className="official-note"><span>✦</span><div><strong>{label}</strong><small>{data.content || '批注内容可在检查器中编辑'}</small></div></div>, 'is-note');
  if (kind === 'arrow') return shell(<div className="official-arrow"><span>{label}</span><b>→</b></div>, 'is-arrow');
  if (kind === 'scroll-panel' || kind === 'panel') { const panelItems = Array.isArray(data.items) && data.items.length ? data.items.map(String) : ['Content 1', 'Content 2', 'Content 3']; return shell(<div className="official-panel"><strong>{label}</strong><div>{panelItems.map((item) => <span key={item}>{item}</span>)}</div></div>, 'is-panel'); }
  if (kind === 'flow') { const vertical = data.direction === 'vertical'; return shell(<div className={`official-flow official-flow--${modaoId}`} style={{ flexDirection: vertical ? 'column' : 'row', alignItems: vertical ? 'stretch' : 'center' }}>{flowNodes.map((node, index) => { const nodeStyle: React.CSSProperties = { borderColor: node.color || accent, background: `${node.color || accent}18`, borderRadius: node.type === 'start' || node.type === 'end' ? 999 : node.type === 'decision' ? 0 : 4, clipPath: node.type === 'decision' ? 'polygon(50% 0,100% 50%,50% 100%,0 50%)' : node.type === 'document' ? 'polygon(0 0,100% 0,100% 82%,75% 100%,50% 82%,25% 100%,0 82%)' : node.type === 'data' ? 'polygon(15% 0,100% 0,85% 100%,0 100%)' : undefined }; return <React.Fragment key={node.id || index}><span data-node-type={node.type} style={nodeStyle}>{node.label}</span>{data.showArrows !== false && index < flowNodes.length - 1 && <i>{vertical ? '↓' : '→'}</i>}</React.Fragment>; })}</div>, 'is-flow'); }
  return shell(<><strong>{label}</strong><small>{data.description || '墨刀官方组件 · AETHER 原生交互'}</small></>, 'is-default');
};

export const GALAXY_COMPONENT_LIST: { type: GalaxyComponentType; name: string; category: string }[] = [
  { type: 'custom-visual', name: 'Custom visual', category: 'Data dashboard' },
  { type: 'factory-floor', name: '工厂透视设备图', category: '数据大屏' },
  { type: 'green-outline-button', name: '绿色轮廓按钮', category: '数据大屏' },
  { type: 'cyan-solid-button', name: '青色实心按钮', category: '数据大屏' },
  { type: 'auth-toggle-button', name: '登录注册切换按钮', category: '数据大屏' },
  { type: 'transparent-bubble-button', name: '透明气泡按钮', category: '数据大屏' },
  { type: 'blue-bubble-button', name: '蓝色气泡按钮', category: '数据大屏' },
  { type: 'back-button', name: '返回按钮', category: '数据大屏' },
  { type: 'next-button', name: '下一步按钮', category: '数据大屏' },
  { type: 'play-button', name: '播放按钮', category: '数据大屏' },
  { type: 'pause-button', name: '暂停按钮', category: '数据大屏' },
  { type: 'pause-button-alt', name: '暂停按钮（副本）', category: '数据大屏' },
  { type: 'sci-fi-neon-button', name: '科幻霓虹按钮', category: '数据大屏' },
  { type: 'sci-fi-neon-frame-button', name: '科幻霓虹边框按钮', category: '数据大屏' },
  { type: 'sci-fi-polygon-button', name: '科幻多边形霓虹按钮', category: '数据大屏' },
  { type: 'sci-fi-node-button', name: '科幻发光节点按钮', category: '数据大屏' },
  { type: 'sci-fi-glow-button', name: '科幻霓虹发光按钮', category: '数据大屏' },
  { type: 'sci-fi-stripe-button', name: '科幻条纹霓虹按钮', category: '数据大屏' },
  { type: 'data-visualization-header', name: '数据可视化标题栏', category: '数据大屏' },
  { type: 'visualization-header', name: '可视化标题栏', category: '数据大屏' },
  { type: 'tech-blue-header', name: '科技风蓝色标题栏', category: '数据大屏' },
  { type: 'circle-left-arrow', name: '圆形左箭头', category: '数据大屏' },
  { type: 'circle-right-arrow', name: '圆形右箭头', category: '数据大屏' },
  { type: 'triangle-left-arrow', name: '三角左箭头', category: '数据大屏' },
  { type: 'triangle-right-arrow', name: '三角右箭头', category: '数据大屏' },
  { type: 'rect-left-arrow', name: '矩形左箭头', category: '数据大屏' },
  { type: 'rect-right-arrow', name: '矩形右箭头', category: '数据大屏' },
  { type: 'sci-fi-glow-right-arrow', name: '科幻发光右箭头', category: '数据大屏' },
  { type: 'sci-fi-glow-left-arrow', name: '科幻发光左箭头', category: '数据大屏' },
  { type: 'glass-down-arrow', name: '3D玻璃质感向下箭头', category: '数据大屏' },
  { type: 'people-count-blue', name: '人员总数（蓝）', category: '数据大屏' },
  { type: 'people-count-green', name: '人员总数（绿）', category: '数据大屏' },
  { type: 'module-lightning', name: '模块1 - 闪电', category: '数据大屏' },
  { type: 'module-star', name: '模块2 - 星星', category: '数据大屏' },
  { type: 'module-bubble', name: '模块3 - 气泡', category: '数据大屏' },
  { type: 'module-car', name: '模块4 - 汽车', category: '数据大屏' },
  { type: 'module-user', name: '模块5 - 用户', category: '数据大屏' },
  { type: 'module-flask', name: '模块6 - 烧瓶', category: '数据大屏' },
  { type: 'module-user-icon', name: '模块1 - 用户图标', category: '数据大屏' },
  { type: 'module-flask-icon', name: '模块2 - 烧瓶图标', category: '数据大屏' },
  { type: 'module-data', name: '模块 - 我是数据', category: '数据大屏' },
  { type: 'pattern-prediction-chart', name: '规律预判 - 动态数据看板', category: '数据大屏' },
  { type: 'data-trend-chart', name: '数据趋势', category: '数据大屏' },
  { type: 'data-trend-cyber-chart', name: '数据趋势 · 科幻图表', category: '数据大屏' },
  { type: 'data-trend-area-chart', name: '数据趋势 · 面积图', category: '数据大屏' },
  { type: 'data-trend-dual-area-chart', name: '数据趋势 · 双曲线面积图', category: '数据大屏' },
  { type: 'cyber-bubble-chart', name: '数据趋势 · 赛博发光气泡图', category: '数据大屏' },
  { type: 'cyber-ring-chart', name: '数据趋势 · 赛博发光圆环图', category: '数据大屏' },
  { type: 'cyber-multi-ring-chart', name: '数据趋势 · 赛博发光圆环图（多环版本）', category: '数据大屏' },
  { type: 'cyber-hud-gauge', name: '数据趋势 · 赛博 HUD 仪表盘', category: '数据大屏' },
  { type: 'cyber-radar-chart', name: '数据趋势 · 赛博雷达图', category: '数据大屏' },
  { type: 'cyber-3d-donut-chart', name: '数据趋势 · 赛博3D环形图', category: '数据大屏' },
  { type: 'distribution-stat-chart', name: '数据分布统计', category: '数据大屏' },
  { type: 'pyramid-distribution-chart', name: '3D 金字塔分布图', category: '数据大屏' },
  { type: 'flip-number', name: '实时翻牌数字', category: '数据大屏' },
  { type: 'gauge', name: '仪表盘', category: '数据大屏' },
  { type: 'trend-line', name: '折线趋势图', category: '数据大屏' },
  { type: 'bar-chart', name: '柱状排行图', category: '数据大屏' },
  { type: 'donut-chart', name: '环形占比图', category: '数据大屏' },
  { type: 'stats-table', name: '统计表', category: '数据大屏' },
  { type: 'alert-list', name: '告警列表', category: '数据大屏' },
  { type: 'freshness', name: '数据新鲜度', category: '数据大屏' },
  { type: 'bug-button', name: 'Bug按钮', category: '按钮' },
  { type: 'glow-button', name: '发光按钮', category: '按钮' },
  { type: 'neon-button', name: '霓虹按钮', category: '按钮' },
  { type: '3d-button', name: '3D按钮', category: '按钮' },
  { type: 'gradient-button', name: '渐变按钮', category: '按钮' },
  { type: 'glass-button', name: '玻璃态按钮', category: '按钮' },
  { type: 'slide-button', name: '滑动填充按钮', category: '按钮' },
  { type: 'pulse-button', name: '脉冲按钮', category: '按钮' },
  { type: 'glass-card', name: '玻璃态卡片', category: '卡片' },
  { type: 'gradient-card', name: '渐变卡片', category: '卡片' },
  { type: 'neon-card', name: '霓虹卡片', category: '卡片' },
  { type: 'profile-card', name: '个人资料卡片', category: '卡片' },
  { type: 'metric-card', name: '数据指标卡片', category: '卡片' },
  { type: 'spotlight-card', name: '亮点展示卡片', category: '卡片' },
  { type: 'split-feature-card', name: '功能介绍卡片', category: '卡片' },
  { type: 'outline-panel-card', name: '切角信息面板', category: '卡片' },
  { type: 'spinner-loader', name: '旋转加载器', category: '加载器' },
  { type: 'dots-loader', name: '跳动点加载器', category: '加载器' },
  { type: 'ring-loader', name: '环形加载器', category: '加载器' },
  { type: 'double-ring-loader', name: '双环加载器', category: '加载器' },
  { type: 'wave-loader', name: '波浪加载器', category: '加载器' },
  { type: 'success-notification', name: '成功通知', category: '通知' },
  { type: 'error-notification', name: '错误通知', category: '通知' },
  { type: 'warning-notification', name: '警告通知', category: '通知' },
  { type: 'info-notification', name: '信息通知', category: '通知' },
  { type: 'toggle-switch', name: '开关', category: '控件' },
  { type: 'gradient-progress', name: '渐变进度条', category: '控件' },
  { type: 'progress-ring', name: '进度环', category: '控件' },
  { type: 'slider', name: '滑块', category: '控件' },
  { type: 'glossy-progress-slider', name: '流光进度确认条', category: '交互控件' },
  { type: 'bare-glossy-progress-slider', name: '无外框流光进度条', category: '交互控件' },
  { type: 'threshold-slider', name: '阈值刻度滑动条', category: '交互控件' },
  { type: 'bare-threshold-slider', name: '无外框阈值刻度条', category: '交互控件' },
  { type: 'segment-progress-slider', name: '分段能量进度条', category: '交互控件' },
  { type: 'multi-stage-slider', name: '定位时间轴确认条', category: '交互控件' },
  { type: 'bare-timeline-slider', name: '无边框定位时间轴', category: '交互控件' },
  { type: 'checkbox', name: '复选框', category: '控件' },
  { type: 'radio', name: '单选按钮', category: '控件' },
  { type: 'input', name: '输入框', category: '表单' },
  { type: 'solid-badge', name: '实心徽章', category: '徽章' },
  { type: 'outline-badge', name: '描边徽章', category: '徽章' },
  { type: 'avatar', name: '头像', category: '其他' },
  { type: 'rating', name: '评分', category: '其他' },
  { type: 'tabs', name: '标签页', category: '其他' },
  { type: 'divider', name: '分隔线', category: '其他' },
  { type: 'tooltip', name: '工具提示', category: '其他' },
  { type: 'icon', name: '图标', category: '其他' },
];

type FactoryDevice = { id?: string; name?: string; status?: string; x?: number; y?: number; value?: number; unit?: string; color?: string };

/** Editable isometric factory map used by the industrial operations template. */
const FactoryFloor: React.FC<{ data?: any; interactive?: boolean }> = ({ data = {}, interactive = false }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const devices: FactoryDevice[] = Array.isArray(data.devices) && data.devices.length ? data.devices : [
    { id: 'press-01', name: '冲压线 A', status: '运行', x: 26, y: 28, value: 86, unit: '件/min', color: '#3978ed' },
    { id: 'weld-02', name: '焊接单元 B', status: '运行', x: 55, y: 28, value: 74, unit: '件/min', color: '#20b486' },
    { id: 'assembly-03', name: '装配线 C', status: '待机', x: 26, y: 56, value: 62, unit: '件/min', color: '#8266e8' },
    { id: 'inspect-04', name: '质检工位 D', status: '异常', x: 55, y: 56, value: 51, unit: '件/min', color: '#f3a324' },
    { id: 'pack-05', name: '包装单元 E', status: '运行', x: 40, y: 73, value: 68, unit: '件/min', color: '#62738a' },
  ];
  const selected = devices.find((device, index) => (device.id || String(index)) === selectedId);
  const statusColor = (status?: string) => /异常|停机|故障/.test(status || '') ? '#ef4444' : /待机|维护/.test(status || '') ? '#f59e0b' : '#16b981';
  return <div className="aether-factory-floor" style={{ width: '100%', height: '100%', minHeight: 220, overflow: 'hidden', position: 'relative', borderRadius: 16, background: 'linear-gradient(145deg,#fff 0%,#f6f9fc 100%)', border: '1px solid #e2e8f0', boxShadow: '0 14px 38px rgba(15,23,42,.08)', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <div style={{ position: 'absolute', zIndex: 2, left: 18, top: 14, color: '#64748b', fontSize: 11, fontWeight: 600, letterSpacing: '.04em' }}>{data.label || '生产设备实时布局'} <span style={{ marginLeft: 8, color: '#16a34a' }}>● LIVE</span></div>
    <svg viewBox="0 0 800 540" preserveAspectRatio="xMidYMid meet" role="img" aria-label="可交互的透视工厂设备布局" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs><filter id="factory-shadow" x="-40%" y="-40%" width="180%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dy="10"/><feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><pattern id="factory-grid" width="28" height="28" patternTransform="skewX(-22)" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#d9e2ec" strokeWidth="1" opacity=".55"/></pattern></defs>
      <polygon points="95,115 692,144 718,472 39,437" fill="#e8eef4" opacity=".85"/><polygon points="108,126 680,153 701,451 58,420" fill="#f8fafc" stroke="#d5dee8" strokeWidth="3"/><polygon points="108,126 680,153 701,451 58,420" fill="url(#factory-grid)"/>
      <path d="M165 208 L630 231 M138 315 L650 338 M333 138 L290 423 M498 145 L460 434" stroke="#cbd5e1" strokeWidth="8" opacity=".4" fill="none"/><path d="M164 208 L630 231 M138 315 L650 338" stroke="#fff" strokeWidth="3" strokeDasharray="12 10" opacity=".9" fill="none"/>
      {devices.map((device, index) => {
        const id = device.id || String(index); const x = 120 + (Number(device.x ?? (20 + index % 2 * 30)) / 100) * 490; const y = 128 + (Number(device.y ?? (22 + Math.floor(index / 2) * 22)) / 100) * 280;
        const color = device.color || '#3978ed'; const height = 48 + (index % 3) * 8; const w = 120; const h = 54;
        return <g key={id} transform={`translate(${x} ${y})`} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={`${device.name || `设备 ${index + 1}`}，${device.status || '运行'}`} onClick={() => interactive && setSelectedId(selectedId === id ? null : id)} onKeyDown={(event) => { if (interactive && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedId(selectedId === id ? null : id); } }} style={{ cursor: interactive ? 'pointer' : 'default' }} filter="url(#factory-shadow)">
          <polygon points={`0,${h / 2} ${w / 2},0 ${w},${h / 2} ${w / 2},${h}`} fill={color} stroke="#fff" strokeWidth="1.5"/>
          <polygon points={`0,${h / 2} ${w / 2},${h} ${w / 2},${h + height} 0,${h / 2 + height}`} fill={`color-mix(in srgb, ${color} 82%, #10213b)`}/>
          <polygon points={`${w},${h / 2} ${w / 2},${h} ${w / 2},${h + height} ${w},${h / 2 + height}`} fill={`color-mix(in srgb, ${color} 64%, #071a30)`}/>
          <path d={`M ${w * .18} ${h * .48} L${w / 2} ${h * .17} L${w * .82} ${h * .48} L${w / 2} ${h * .78} Z`} fill="rgba(255,255,255,.14)"/>
          <circle cx={w - 8} cy={12} r="8" fill="#fff"/><circle cx={w - 8} cy={12} r="4.5" fill={statusColor(device.status)}/>
          <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">{device.name || `设备 ${index + 1}`}</text>
          <text x={w / 2} y={h + height - 12} textAnchor="middle" fill="rgba(255,255,255,.86)" fontSize="9">{device.value ?? 0} {device.unit || '件/min'}</text>
        </g>;
      })}
    </svg>
    {selected && <div role="status" style={{ position: 'absolute', right: 16, bottom: 14, zIndex: 3, padding: '9px 12px', borderRadius: 9, color: '#0f172a', background: 'rgba(255,255,255,.96)', boxShadow: '0 6px 20px rgba(15,23,42,.15)', fontSize: 11 }}><b>{selected.name}</b><span style={{ marginLeft: 9, color: statusColor(selected.status) }}>{selected.status}</span><span style={{ marginLeft: 9 }}>{selected.value} {selected.unit || '件/min'}</span></div>}
    <div style={{ position: 'absolute', zIndex: 2, bottom: 12, left: 16, color: '#64748b', fontSize: 10 }}>设备 {devices.length} 台　·　点击设备查看运行数据</div>
  </div>;
};

/**
 * 各 Galaxy 组件的原始设计尺寸（px）。
 * 用途：
 *  - 缩放基准：UI 组件元素按此比例等比缩放，保证内容始终 100% 铺满容器（控制点贴合内容边缘）；
 *  - 默认插入尺寸：按此宽高比换算初始盒子，插入即铺满。
 * 说明：按钮/徽章等组件实际宽度随文案略有浮动，这里取常见默认文案下的近似值即可，
 *      画布内实际渲染由 ScaledUIComponent 运行时实测 offsetWidth/offsetHeight 兜底。
 */
/** 获取组件的设计稿宽高比；运行时测量不会改变图层本身的外框比例。 */
export function getUiComponentAspect(_elementId: string | undefined, componentType: string): number {
  const base = GALAXY_COMPONENT_BASE_SIZE[(componentType || 'glass-card') as GalaxyComponentType]
    || GALAXY_COMPONENT_BASE_SIZE['glass-card'];
  return base.w / base.h;
}

export const GalaxyComponentRenderer: React.FC<{ type: GalaxyComponentType; data?: any; interactive?: boolean; locked?: boolean; onContinuousNodeTrigger?: (node: ContinuousInteractionNode) => void; onDataChange?: (patch: Record<string, any>) => void; onAction?: (action: string) => void }> = ({ type, data = {}, interactive, locked, onContinuousNodeTrigger, onDataChange, onAction }) => {
  // 支持 data.label → children：InspectorPanel 中编辑的「组件文字」通过 label 字段传入，
  // 这里统一映射为 children，让所有按钮/卡片/通知等组件的文字可被编辑。
  const label = typeof data?.label === 'string' && data.label.trim() ? data.label.trim() : undefined;
  const title = typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : label;
  const buttonData = label ? { ...data, children: label } : data;
  const titleData = title ? { ...data, title } : data;
  const identityData = label ? { ...data, name: label } : data;
  const textData = label ? { ...data, text: label } : data;
  if (HOLOGRAPHIC_GAUGE_TYPES.has(type as HolographicGaugeVariant)) {
    return <HolographicGauge variant={type as HolographicGaugeVariant} data={data} />;
  }
  if (DATA_ICON_TYPES.has(type as DataIconVariant)) {
    return <IsometricDataIcon variant={type as DataIconVariant} data={data} />;
  }
  if (type === 'metric-card' && data?.pluginId === 'aether.flip-number') return <FlipNumber data={data} />;
  switch (type) {
    case 'green-outline-button': return <GreenOutlineButton data={{ ...data, color: '#43e97b' }} />;
    case 'cyan-solid-button': return <BatchDashboardButton variant="cyan-solid" data={data} />;
    case 'auth-toggle-button': return <BatchDashboardButton variant="auth-toggle" data={data} />;
    case 'transparent-bubble-button': return <BatchDashboardButton variant="transparent-bubble" data={data} />;
    case 'blue-bubble-button': return <BatchDashboardButton variant="blue-bubble" data={data} />;
    case 'back-button': return <BatchDashboardButton variant="back" data={data} />;
    case 'next-button': return <BatchDashboardButton variant="next" data={data} />;
    case 'play-button': return <BatchDashboardButton variant="play" data={data} />;
    case 'pause-button': return <BatchDashboardButton variant="pause" data={data} />;
    case 'pause-button-alt': return <BatchDashboardButton variant="pause" data={data} />;
    case 'sci-fi-neon-button': return <BatchDashboardButton variant="sci-fi-neon" data={data} />;
    case 'sci-fi-neon-frame-button': return <DashboardSciFiButton variant="neon-frame" data={data} />;
    case 'sci-fi-polygon-button': return <DashboardSciFiButton variant="polygon" data={data} />;
    case 'sci-fi-node-button': return <DashboardSciFiButton variant="node" data={data} />;
    case 'sci-fi-glow-button': return <DashboardSciFiButton variant="glow" data={data} />;
    case 'sci-fi-stripe-button': return <DashboardSciFiButton variant="stripe" data={data} />;
    case 'data-visualization-header': return <DashboardHeader variant="data" data={data} />;
    case 'visualization-header': return <DashboardHeader variant="visual" data={data} />;
    case 'tech-blue-header': return <DashboardHeader variant="blue" data={data} />;
    case 'circle-left-arrow': return <DashboardArrow variant="circle-left" data={data} />;
    case 'circle-right-arrow': return <DashboardArrow variant="circle-right" data={data} />;
    case 'triangle-left-arrow': return <DashboardArrow variant="triangle-left" data={data} />;
    case 'triangle-right-arrow': return <DashboardArrow variant="triangle-right" data={data} />;
    case 'rect-left-arrow': return <DashboardArrow variant="rect-left" data={data} />;
    case 'rect-right-arrow': return <DashboardArrow variant="rect-right" data={data} />;
    case 'sci-fi-glow-left-arrow': return <DashboardArrow variant="glow-left" data={data} />;
    case 'sci-fi-glow-right-arrow': return <DashboardArrow variant="glow-right" data={data} />;
    case 'glass-down-arrow': return <DashboardArrow variant="glass-down" data={data} />;
    case 'people-count-blue': return <DashboardPeopleCount variant="blue" data={data} />;
    case 'people-count-green': return <DashboardPeopleCount variant="green" data={data} />;
    case 'module-lightning': return <DashboardMetricModule icon="lightning" data={data} />;
    case 'module-star': return <DashboardMetricModule icon="star" data={data} />;
    case 'module-bubble': return <DashboardMetricModule icon="bubble" data={data} />;
    case 'module-car': return <DashboardMetricModule icon="car" data={data} />;
    case 'module-user': return <DashboardMetricModule icon="user" data={data} />;
    case 'module-flask': return <DashboardMetricModule icon="flask" data={data} />;
    case 'module-user-icon': return <DashboardMetricModule icon="user-module" data={data} />;
    case 'module-flask-icon': return <DashboardMetricModule icon="flask-module" data={data} />;
    case 'module-data': return <DashboardMetricModule icon="hex-data" data={data} />;
    case 'pattern-prediction-chart': return <PatternPredictionChart data={data} onDataChange={onDataChange} />;
    case 'data-trend-chart': return <SourceTrendChart data={data} variant="base" onDataChange={onDataChange} />;
    case 'data-trend-cyber-chart': return <SourceTrendChart data={data} variant="cyber" onDataChange={onDataChange} />;
    case 'data-trend-area-chart': return <SourceTrendChart data={data} variant="area" onDataChange={onDataChange} />;
    case 'data-trend-dual-area-chart': return <SourceTrendChart data={data} variant="dual" onDataChange={onDataChange} />;
    case 'cyber-bubble-chart': return <SourceBubbleChart data={data} onDataChange={onDataChange} />;
    case 'cyber-ring-chart': return <SourceRingChart data={data} onDataChange={onDataChange} />;
    case 'cyber-multi-ring-chart': return <SourceRingChart data={data} multi onDataChange={onDataChange} />;
    case 'cyber-hud-gauge': return <SourceHudGauge data={data} onDataChange={onDataChange} />;
    case 'cyber-radar-chart': return <SourceRadarChart data={data} onDataChange={onDataChange} />;
    case 'cyber-3d-donut-chart': return <Source3DDonutChart data={data} onDataChange={onDataChange} />;
    case 'distribution-stat-chart': return <SourceDistributionChart data={data} onDataChange={onDataChange} />;
    case 'pyramid-distribution-chart': return <PyramidDistributionChart data={data} onDataChange={onDataChange} />;
    case 'flip-number': return <FlipNumber data={data} />;
    case 'gauge': return <Gauge data={data} />;
    case 'trend-line': return <TrendLine data={data} />;
    case 'bar-chart': return <AnimatedBarChart data={data} />;
    case 'donut-chart': return <DonutChart data={data} />;
    case 'stats-table': return <FlexibleStatsTable data={data} />;
    case 'alert-list': return <FlexibleAlertList data={data} />;
    case 'freshness': return <Freshness data={data} />;
    case 'geo-map': return <GeoMap data={data} />;
    case 'topology': return <Topology data={data} />;
    case 'factory-floor': return <FactoryFloor data={data} interactive={interactive} />;
    case 'custom-visual': return <CustomVisual data={data} />;
    case 'official-modao': return <OfficialModaoRenderer data={data} interactive={interactive} onDataChange={onDataChange} onAction={onAction} />;
    case 'bug-button': return <GalaxyBugButton {...buttonData} />;
    case 'glow-button': return <GalaxyGlowButton {...buttonData} />;
    case 'neon-button': return <GalaxyNeonButton {...buttonData} />;
    case '3d-button': return <Galaxy3DButton {...buttonData} />;
    case 'gradient-button': return <GalaxyGradientButton {...buttonData} />;
    case 'glass-button': return <GalaxyGlassButton {...buttonData} />;
    case 'slide-button': return <GalaxySlideButton {...buttonData} />;
    case 'pulse-button': return <GalaxyPulseButton {...buttonData} />;
    case 'glass-card': return <ProductCard {...titleData} variant="glass" eyebrow="产品信息" />;
    case 'gradient-card': return <ProductCard {...titleData} variant="gradient" eyebrow="视觉重点" />;
    case 'neon-card': return <ProductCard {...titleData} variant="neon" eyebrow="交互提示" />;
    case 'profile-card': return <CenteredProfileCard {...data} title={title || data.name} />;
    case 'metric-card': return <MetricCard data={data} />;
    case 'spotlight-card': return <ProductCard {...titleData} variant="spotlight" eyebrow="重点内容" />;
    case 'split-feature-card': return <ProductCard {...titleData} variant="split" eyebrow="功能亮点" />;
    case 'outline-panel-card': return <ProductCard {...titleData} variant="outline" eyebrow="产品规格" />;
    case 'spinner-loader': return <GalaxySpinnerLoader {...data} />;
    case 'dots-loader': return <GalaxyDotsLoader {...data} />;
    case 'ring-loader': return <GalaxyRingLoader {...data} />;
    case 'double-ring-loader': return <GalaxyDoubleRingLoader {...data} />;
    case 'wave-loader': return <GalaxyWaveLoader {...data} />;
    case 'success-notification': return <GalaxySuccessNotification {...titleData} />;
    case 'error-notification': return <GalaxyErrorNotification {...titleData} />;
    case 'warning-notification': return <GalaxyWarningNotification {...titleData} />;
    case 'info-notification': return <GalaxyInfoNotification {...titleData} />;
    case 'toggle-switch': return <GalaxyToggleSwitch {...data} onDataChange={onDataChange} />;
    case 'gradient-progress': return <DataProgressBar data={data} />;
    case 'progress-ring': return <DataProgressRing data={data} />;
    case 'solid-badge': return <GalaxySolidBadge {...buttonData} />;
    case 'outline-badge': return <GalaxyOutlineBadge {...buttonData} />;
    case 'input': return <GalaxyInput {...data} onDataChange={onDataChange} />;
    case 'slider': return <GalaxySlider {...data} onDataChange={onDataChange} />;
    case 'glossy-progress-slider': return <GalaxyMultiStageSlider variant="glossy" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'bare-glossy-progress-slider': return <GalaxyMultiStageSlider variant="glossy-bare" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'threshold-slider': return <GalaxyMultiStageSlider variant="threshold" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'bare-threshold-slider': return <GalaxyMultiStageSlider variant="threshold-bare" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'segment-progress-slider': return <GalaxyMultiStageSlider variant="segments" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'multi-stage-slider': return <GalaxyMultiStageSlider variant="timeline" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'bare-timeline-slider': return <GalaxyMultiStageSlider variant="timeline-bare" continuousInteraction={data.continuousInteraction} color={data.color} interactive={interactive} locked={locked} onContinuousNodeTrigger={onContinuousNodeTrigger} />;
    case 'checkbox': return <GalaxyCheckbox {...data} onDataChange={onDataChange} />;
    case 'radio': return <GalaxyRadio {...data} onDataChange={onDataChange} />;
    case 'avatar': return <GalaxyAvatar {...identityData} />;
    case 'rating': return <GalaxyRating {...data} />;
    case 'tabs': return <GalaxyTabs {...data} />;
    case 'divider': return <GalaxyDivider {...textData} />;
    case 'tooltip': return <GalaxyTooltip {...buttonData} />;
    case 'icon': return <GalaxyIconComponent {...data} />;
    default: return <div>未知组件类型: {type}</div>;
  }
};

const CustomVisual: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const visual = data.visual || {};
  const src = data.assetUrl || visual.assetUrl;
  const kind = data.assetKind || visual.assetKind || 'image';
  const assetName = data.assetName || visual.assetName || data.label || '视觉素材';
  const tone = statusTone(data.status);
  const opacity = Number(visual.opacity ?? 1);
  const mediaStyle = {
    objectFit: visual.fit || 'contain',
    opacity,
    filter: visual.tint ? `drop-shadow(0 0 10px ${visual.tint})` : undefined,
  } as React.CSSProperties;

  if (!src) return <DataShell data={data} title="自定义 UI 视觉素材"><div className="aether-custom-visual__empty">请在属性面板绑定视觉素材</div></DataShell>;

  const isThreeAsset = kind === 'panorama-img' || kind === 'panorama-vid' || kind === 'model-3d' || kind === 'gaussian-splat';
  const threeType: SceneElement['type'] = kind === 'panorama-img' || kind === 'panorama-vid' || kind === 'model-3d' || kind === 'gaussian-splat' ? kind : 'img';
  const syntheticElement: SceneElement = {
    id: `custom-visual-${kind}`,
    type: threeType,
    refId: '',
    sourceName: assetName,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 0,
    opacity: 100,
    startTime: 0,
    duration: Number.POSITIVE_INFINITY,
    modelAutoRotate: true,
    panoramaAutoRotate: true,
    panoramaAutoRotateSpeed: 0.35,
  };

  return <DataShell data={data} title={data.label || '自定义 UI 视觉素材'}>
    <div className={`aether-custom-visual aether-custom-visual--${kind}`}>
      {isThreeAsset ? <React.Suspense fallback={<div className="aether-custom-visual__loading">正在加载视觉素材…</div>}>
        <ThreeCanvasPreview
          key={`${kind}:${src}`}
          element={syntheticElement}
          assetUrl={src}
          isEditing={false}
          interactive={false}
          autoRotate
          autoRotateSpeed={0.35}
        />
      </React.Suspense> : kind === 'video' ? <video src={src} autoPlay loop muted playsInline style={mediaStyle} aria-label={assetName} />
        : kind === 'image' ? <img src={src} alt={assetName} style={mediaStyle} />
          : <div className="aether-custom-visual__unsupported"><span>{kind === 'audio' ? '音频素材' : kind === 'font' ? '字体素材' : '此格式暂不支持画面预览'}</span><small>{assetName}</small></div>}
      <span className="aether-custom-visual__status" style={{ color: visual.tint || tone }}>{data.status || 'normal'}</span>
    </div>
    <style>{`.aether-custom-visual{height:calc(100% - 28px);min-height:72px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--data-accent) 25%,transparent);background:rgba(0,0,0,.16)}.aether-custom-visual>img,.aether-custom-visual>video{width:100%;height:100%;max-height:108px;display:block}.aether-custom-visual--panorama-img,.aether-custom-visual--panorama-vid,.aether-custom-visual--model-3d,.aether-custom-visual--gaussian-splat{min-height:94px}.aether-custom-visual--panorama-img>div,.aether-custom-visual--panorama-vid>div,.aether-custom-visual--model-3d>div,.aether-custom-visual--gaussian-splat>div{position:absolute;inset:0}.aether-custom-visual__loading,.aether-custom-visual__empty,.aether-custom-visual__unsupported{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--data-muted);font-size:10px;text-align:center;padding:12px}.aether-custom-visual__unsupported small{max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--data-muted);opacity:.7}.aether-custom-visual__status{position:absolute;right:7px;bottom:5px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;text-shadow:0 1px 5px #000}@media(prefers-reduced-motion:reduce){.aether-custom-visual video{animation:none}}`}</style>
  </DataShell>;
};

const AnimatedBarChart: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => { if (data.motionEnabled === false || data.lowMotion) return; const id = window.setInterval(() => setTick((v) => v + 1), 1800); return () => window.clearInterval(id); }, [data.motionEnabled, data.lowMotion]);
  const configured = data.series?.length ? data.series : [46, 68, 54, 82, 61, 74];
  const maxItems = Math.max(1, Math.floor(Number(data.repeat?.maxItems) || configured.length));
  const values = configured.slice(0, maxItems).map((value, index) => Math.max(0, Math.min(100, Number(value) + (tick % 2 ? (index % 2 ? 2 : -2) : 0))));
  const labels = (data.categories?.length ? data.categories : ['一', '二', '三', '四', '五', '六']).slice(0, maxItems);
  return <DataShell data={data} title="排行分析" className="aether-chart-shell"><div className="aether-bars">{values.map((value, index) => <div className="aether-bar-col" key={`${labels[index] || index}-${index}`}><div className="aether-bar" style={{ height: `${Math.max(8, value)}%` }} /><span>{labels[index] || index + 1}</span></div>)}</div><style>{`.aether-chart-shell{min-height:150px}.aether-bars{height:102px;display:flex;align-items:end;gap:10px;padding:0 4px}.aether-bar-col{height:100%;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:5px}.aether-bar{width:100%;max-width:24px;border-radius:3px 3px 1px 1px;background:linear-gradient(180deg,var(--data-accent),color-mix(in srgb,var(--data-accent) 28%,transparent));box-shadow:0 0 14px color-mix(in srgb,var(--data-accent) 35%,transparent);transition:height .55s ease,filter .3s ease}.aether-bar-col span{font-size:9px;color:#7994aa}`}</style></DataShell>;
};

const FlexibleStatsTable: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const fallback = [{ label: 'North', value: '98.6%', status: 'normal' }, { label: 'South', value: '94.2%', status: 'warning' }, { label: 'Gateway', value: '1.8s', status: 'online' }];
  const rows = data.rows?.length ? data.rows : fallback;
  const maxItems = Math.max(1, Math.floor(Number(data.repeat?.maxItems) || rows.length));
  const scroll = data.repeat?.overflow === 'scroll';
  return <DataShell data={data} title="Stats"><div className="aether-stats-table" style={{ maxHeight: scroll ? 146 : undefined, overflowY: scroll ? 'auto' : 'visible' }}>{rows.slice(0, maxItems).map((row, index) => <div className="aether-stats-row" key={`${row.label}-${index}`}><span>{row.label}</span><b>{row.value}</b><em>{row.status || 'normal'}</em></div>)}</div><style>{`.aether-stats-table{display:flex;flex-direction:column;gap:7px}.aether-stats-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding-bottom:6px;border-bottom:1px solid rgba(148,163,184,.12);font-size:10px;color:#9bb2c4}.aether-stats-row b{font-variant-numeric:tabular-nums;color:#e7f3fb;font-size:12px}.aether-stats-row em{font-style:normal;color:var(--data-tone);font-size:9px}`}</style></DataShell>;
};

const FlexibleAlertList: React.FC<{ data: TelemetryData }> = ({ data }) => {
  const fallback = [{ label: 'Cooling pressure', value: '08:42', status: 'warning' }, { label: 'GNSS terminal recovered', value: '08:39', status: 'info' }, { label: 'Battery temperature normal', value: '08:36', status: 'normal' }];
  const items = data.items?.length ? data.items : fallback;
  const maxItems = Math.max(1, Math.floor(Number(data.repeat?.maxItems) || items.length));
  const scroll = data.repeat?.overflow === 'scroll';
  return <DataShell data={data} title="Alerts"><div className="aether-alert-list" style={{ maxHeight: scroll ? 146 : undefined, overflowY: scroll ? 'auto' : 'visible' }}>{items.slice(0, maxItems).map((item, index) => { const status = String(item.status || '').toLowerCase(); const alert = ['warning', 'critical', 'error', 'fault', '预警', '严重'].includes(status); return <div className="aether-alert-row" key={`${item.label}-${index}`}><i className={alert ? 'is-alert' : ''} /><span>{item.label}</span><time>{item.value}</time></div>; })}</div><style>{`.aether-alert-list{display:flex;flex-direction:column;gap:9px}.aether-alert-row{display:grid;grid-template-columns:7px 1fr auto;align-items:center;gap:8px;font-size:10px;color:#b6c8d5}.aether-alert-row i{width:6px;height:6px;border-radius:50%;background:#34d399}.aether-alert-row i.is-alert{background:#f59e0b;box-shadow:0 0 10px #f59e0b;animation:aether-alert-pulse 1.6s infinite}.aether-alert-row time{font-variant-numeric:tabular-nums;color:#6f899e;font-size:9px}@keyframes aether-alert-pulse{50%{transform:scale(1.7);opacity:.55}}`}</style></DataShell>;
};

export default GalaxyComponentRenderer;

