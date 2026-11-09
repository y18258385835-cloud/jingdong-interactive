import React, { useEffect, useId, useMemo, useState } from 'react';

export type DataIconVariant =
  | 'iso-stack-node'
  | 'iso-cube-platform'
  | 'iso-liquid-wave'
  | 'iso-metric-badge'
  | 'iso-tile-metric'
  | 'iso-orbit-energy';

export const DATA_ICON_TYPES = new Set<DataIconVariant>([
  'iso-stack-node',
  'iso-cube-platform',
  'iso-liquid-wave',
  'iso-metric-badge',
  'iso-tile-metric',
  'iso-orbit-energy',
]);

type DataIconData = {
  value?: number | string;
  min?: number | string;
  max?: number | string;
  label?: string;
  unit?: string;
  delta?: number | string;
  color?: string;
  lowMotion?: boolean;
  motionEnabled?: boolean;
};

type IconSpec = { value: number; min: number; max: number; label: string; unit: string; color: string; precision?: number };

const SPECS: Record<DataIconVariant, IconSpec> = {
  'iso-stack-node': { value: 5000, min: 0, max: 8000, label: 'NO.2 产品', unit: '', color: '#35d9ff' },
  'iso-cube-platform': { value: 7000, min: 0, max: 10000, label: 'NO.1 产品', unit: '', color: '#52e9ff' },
  'iso-liquid-wave': { value: 413.4, min: 0, max: 600, label: '人均一吨', unit: 'kg', color: '#25c9ec', precision: 1 },
  'iso-metric-badge': { value: 3876.4, min: 0, max: 5000, label: '产能实时', unit: '万', color: '#a3edff', precision: 1 },
  'iso-tile-metric': { value: 2887, min: 0, max: 5000, label: '全市刑事立案数', unit: '', color: '#c7f5ff' },
  'iso-orbit-energy': { value: 800, min: 0, max: 1200, label: '电能', unit: '', color: '#29d6df' },
};

const number = (value: number | string | undefined, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const valueText = (value: number, precision = 0) => value.toLocaleString(undefined, {
  minimumFractionDigits: precision,
  maximumFractionDigits: precision,
});

const IsoDefs = ({ id, color }: { id: string; color: string }) => (
  <defs>
    <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
      <stop stopColor="#e9ffff" stopOpacity=".92" />
      <stop offset=".36" stopColor={color} stopOpacity=".82" />
      <stop offset="1" stopColor={color} stopOpacity=".2" />
    </linearGradient>
    <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1">
      <stop stopColor={color} stopOpacity=".78" />
      <stop offset="1" stopColor="#07506f" stopOpacity=".42" />
    </linearGradient>
    <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#d9ffff" stopOpacity=".9" />
      <stop offset=".32" stopColor={color} stopOpacity=".78" />
      <stop offset="1" stopColor="#07506f" stopOpacity=".18" />
    </linearGradient>
    <radialGradient id={`${id}-halo`}>
      <stop stopColor={color} stopOpacity=".26" />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
    <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <clipPath id={`${id}-wave-clip`}><path d="M42 101 L150 78 L258 101 L150 131 Z" /></clipPath>
  </defs>
);

const Cube = ({ x, y, scale = 1, id, color }: { x: number; y: number; scale?: number; id: string; color: string }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} className="iso-cube">
    <path d="M0 0 L22 -12 L44 0 L22 13 Z" fill={`url(#${id}-top)`} stroke={color} strokeOpacity=".72" />
    <path d="M0 0 L22 13 L22 39 L0 26 Z" fill={`url(#${id}-side)`} stroke={color} strokeOpacity=".56" />
    <path d="M44 0 L22 13 L22 39 L44 26 Z" fill="#0b4161" fillOpacity=".84" stroke={color} strokeOpacity=".48" />
  </g>
);

const DataText = ({ value, label, unit, color, x = 150, y = 37, anchor = 'middle' as const }: { value: string; label: string; unit: string; color: string; x?: number; y?: number; anchor?: 'middle' | 'start' }) => (
  <g className="iso-data-text" textAnchor={anchor}>
    <text x={x} y={y} className="iso-value">{value}{unit && <tspan dx="4" className="iso-unit" fill={color}>{unit}</tspan>}</text>
    <text x={x} y={y + 17} className="iso-label">{label}</text>
  </g>
);

export const IsometricDataIcon: React.FC<{ variant: DataIconVariant; data?: DataIconData }> = ({ variant, data = {} }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spec = SPECS[variant];
  const min = number(data.min, spec.min);
  const max = Math.max(min + 0.01, number(data.max, spec.max));
  const baseValue = Math.min(max, Math.max(min, number(data.value, spec.value)));
  const label = data.label?.trim() || spec.label;
  const unit = data.unit ?? spec.unit;
  const color = data.color || spec.color;
  const delta = number(data.delta, 2.8);
  const [hovered, setHovered] = useState(false);
  const [drift, setDrift] = useState(0);
  const motionEnabled = data.motionEnabled !== false && !data.lowMotion;

  useEffect(() => {
    if (!hovered || !motionEnabled) { setDrift(0); return; }
    const range = max - min;
    let direction = 1;
    const update = () => {
      const magnitude = Math.max(range * 0.012, Math.min(range * 0.045, Math.max(1, Math.abs(baseValue) * 0.025)));
      setDrift(direction * magnitude * (0.7 + Math.random() * 0.3));
      direction *= -1;
    };
    update();
    const timer = window.setInterval(update, 620);
    return () => window.clearInterval(timer);
  }, [baseValue, hovered, max, min, motionEnabled]);

  const liveValue = Math.min(max, Math.max(min, baseValue + drift));
  const percent = (liveValue - min) / (max - min);
  const commonProps = {
    className: `iso-data-icon iso-data-icon--${variant} ${hovered ? 'is-active' : ''} ${motionEnabled ? '' : 'is-static'}`,
    style: { '--iso-color': color } as React.CSSProperties,
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
    onFocus: () => setHovered(true),
    onBlur: () => setHovered(false),
    tabIndex: 0,
    role: 'img' as const,
    'aria-label': `${label}: ${valueText(liveValue, spec.precision)}${unit}`,
  };

  const face = useMemo(() => {
    if (variant === 'iso-stack-node') return <svg viewBox="0 0 300 170" aria-hidden="true"><IsoDefs id={id} color={color} /><ellipse cx="150" cy="145" rx="92" ry="12" fill={`url(#${id}-halo)`} /><path d="M58 137 L150 102 L242 137 L150 157 Z" fill="#082c48" fillOpacity=".75" stroke={color} strokeOpacity=".48" /><Cube x={103} y={96} scale={1.05} id={id} color={color} /><Cube x={125} y={72} scale={.82} id={id} color={color} /><Cube x={147} y={48} scale={.62} id={id} color={color} /><DataText value={valueText(liveValue, spec.precision)} label={label} unit={unit} color={color} x={52} y={39} anchor="start" /></svg>;
    if (variant === 'iso-cube-platform') return <svg viewBox="0 0 300 170" aria-hidden="true"><IsoDefs id={id} color={color} /><ellipse cx="150" cy="145" rx="104" ry="13" fill={`url(#${id}-halo)`} /><path d="M43 122 L150 83 L257 122 L150 157 Z" fill="#062640" fillOpacity=".84" stroke={color} strokeOpacity=".62" /><path d="M78 118 L150 92 L222 118 L150 142 Z" fill="none" stroke={color} strokeOpacity=".32" /><Cube x={128} y={69} scale={1.04} id={id} color={color} /><Cube x={151} y={44} scale={.64} id={id} color={color} /><DataText value={valueText(liveValue, spec.precision)} label={label} unit={unit} color={color} x={54} y={39} anchor="start" /></svg>;
    if (variant === 'iso-liquid-wave') return <svg viewBox="0 0 300 170" aria-hidden="true"><IsoDefs id={id} color={color} /><ellipse cx="150" cy="143" rx="115" ry="14" fill={`url(#${id}-halo)`} /><path d="M42 101 L150 78 L258 101 L150 131 Z" fill="#082b47" stroke={color} strokeOpacity=".42" /><g clipPath={`url(#${id}-wave-clip)`} className="iso-liquid" transform={`translate(0 ${(0.5 - percent) * 18})`}><path className="iso-liquid__back" d="M-60 106 C-12 84 14 119 59 98 S136 80 202 105 S284 119 360 96 V155 H-60Z" fill={color} opacity=".3" /><path className="iso-liquid__front" d="M-60 101 C-12 80 14 115 59 93 S136 77 202 100 S284 114 360 91 V155 H-60Z" fill={`url(#${id}-liquid)`} /><path className="iso-liquid__shine" d="M-60 99 C-12 78 14 113 59 91 S136 75 202 98 S284 112 360 89" fill="none" stroke="#d9ffff" strokeOpacity=".78" strokeWidth="1.6" /></g><path d="M42 101 L150 78 L258 101 L150 131 Z" fill="none" stroke="#9af5ff" strokeOpacity=".45" /><DataText value={valueText(liveValue, spec.precision)} label={label} unit={unit} color={color} x={150} y={40} /></svg>;
    if (variant === 'iso-metric-badge') return <svg viewBox="0 0 300 170" aria-hidden="true"><IsoDefs id={id} color={color} /><path d="M42 119 L150 83 L258 119 L150 154 Z" fill="#071d34" stroke={color} strokeOpacity=".5" /><path d="M62 115 L150 91 L238 115 L150 141 Z" fill="none" stroke={color} strokeOpacity=".25" /><path d="M75 111 L150 91 L225 111 L150 132 Z" fill={`url(#${id}-top)`} fillOpacity=".24" /><DataText value={valueText(liveValue, spec.precision)} label={label} unit={unit} color={color} x={150} y={48} /><text x="218" y="43" className="iso-delta" fill={delta >= 0 ? '#54edb1' : '#ff7a9d'}>{delta >= 0 ? '+' : ''}{valueText(delta, 1)}%</text></svg>;
    if (variant === 'iso-tile-metric') return <svg viewBox="0 0 300 170" aria-hidden="true"><IsoDefs id={id} color={color} /><ellipse cx="150" cy="148" rx="112" ry="12" fill={`url(#${id}-halo)`} /><g className="iso-tile-grid">{Array.from({ length: 9 }, (_, index) => { const col = index % 3; const row = Math.floor(index / 3); const x = 63 + col * 43 - row * 22; const y = 104 + col * 14 + row * 14; return <path key={index} d={`M${x} ${y} L${x + 22} ${y - 8} L${x + 44} ${y} L${x + 22} ${y + 9} Z`} fill={index === 4 ? `url(#${id}-top)` : '#0c3852'} fillOpacity={index === 4 ? '.84' : '.58'} stroke={color} strokeOpacity={index === 4 ? '.78' : '.28'} />; })}</g><DataText value={valueText(liveValue, spec.precision)} label={label} unit={unit} color={color} x={150} y={40} /><text x="211" y="40" className="iso-delta" fill={delta >= 0 ? '#58e89e' : '#ff7a9d'}>{delta >= 0 ? '↑' : '↓'}{valueText(Math.abs(delta), 1)}%</text></svg>;
    return <svg viewBox="0 0 300 170" aria-hidden="true"><IsoDefs id={id} color={color} /><ellipse cx="150" cy="131" rx="104" ry="17" fill="none" stroke={color} strokeOpacity=".55" strokeWidth="3" strokeDasharray="18 8 3 8" className="iso-orbit iso-orbit--slow" /><ellipse cx="150" cy="131" rx="82" ry="12" fill="none" stroke="#50e8ff" strokeOpacity=".38" strokeWidth="2" strokeDasharray="12 7" className="iso-orbit iso-orbit--reverse" /><ellipse cx="150" cy="131" rx="59" ry="9" fill="none" stroke="#a4fbff" strokeOpacity=".28" strokeDasharray="4 6" className="iso-orbit" /><path d="M150 130 L150 94" stroke="#d9ffff" strokeWidth="2" filter={`url(#${id}-glow)`} /><circle cx="150" cy="130" r="5" fill={color} filter={`url(#${id}-glow)`} /><DataText value={valueText(liveValue, spec.precision)} label={label} unit={unit} color={color} x={150} y={40} /></svg>;
  }, [color, delta, id, label, liveValue, percent, spec.precision, unit, variant]);

  return <div {...commonProps}>
    <div className="iso-data-icon__aura" />
    {face}
    <style>{`
      .iso-data-icon{position:relative;width:300px;height:170px;display:grid;place-items:center;isolation:isolate;outline:none;cursor:default;font-family:Inter,"Microsoft YaHei",sans-serif;color:#e9ffff;touch-action:manipulation;--iso-color:${color}}
      .iso-data-icon>svg{position:absolute;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--iso-color) 46%,transparent));transition:transform 260ms ease-out,filter 260ms ease-out}
      .iso-data-icon__aura{position:absolute;inset:30px 20px;border-radius:50%;background:radial-gradient(ellipse,color-mix(in srgb,var(--iso-color) 17%,transparent),transparent 70%);filter:blur(10px);opacity:.65;pointer-events:none;transition:opacity .2s ease,transform .2s ease}
      .iso-data-icon:hover>svg,.iso-data-icon:focus-visible>svg,.iso-data-icon.is-active>svg{transform:translateY(-2px) scale(1.018);filter:drop-shadow(0 0 11px color-mix(in srgb,var(--iso-color) 75%,transparent))}
      .iso-data-icon:hover .iso-data-icon__aura,.iso-data-icon:focus-visible .iso-data-icon__aura{opacity:1;transform:scale(1.07)}
      .iso-value{font-size:22px;font-weight:800;letter-spacing:.01em;fill:#efffff;font-variant-numeric:tabular-nums;paint-order:stroke;stroke:#042238;stroke-width:3px}
      .iso-unit{font-size:10px;font-weight:800}.iso-label{font-size:9px;font-weight:700;letter-spacing:.06em;fill:#a9d2dd}.iso-delta{font-size:11px;font-weight:800}
      .iso-orbit{transform-box:fill-box;transform-origin:center;animation:iso-orbit 5.5s linear infinite}.iso-orbit--reverse{animation-direction:reverse;animation-duration:3.8s}.iso-orbit--slow{animation-duration:7.5s}.iso-liquid__back{animation:iso-liquid-flow-back 4s linear infinite}.iso-liquid__front,.iso-liquid__shine{animation:iso-liquid-flow 2.4s linear infinite}
      .iso-data-icon.is-static .iso-orbit,.iso-data-icon.is-static .iso-liquid__back,.iso-data-icon.is-static .iso-liquid__front,.iso-data-icon.is-static .iso-liquid__shine{animation:none}
      @keyframes iso-orbit{to{transform:rotate(360deg)}}@keyframes iso-liquid-flow{from{transform:translateX(0)}to{transform:translateX(-42px)}}@keyframes iso-liquid-flow-back{from{transform:translateX(-34px)}to{transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.iso-data-icon *{animation:none!important;transition:none!important}}
    `}</style>
  </div>;
};

export default IsometricDataIcon;
