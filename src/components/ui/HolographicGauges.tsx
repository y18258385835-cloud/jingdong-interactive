import React, { useEffect, useId, useMemo, useState } from 'react';

export type HolographicGaugeVariant =
  | 'holo-speedometer'
  | 'holo-cyan-ring'
  | 'holo-orbit-counter'
  | 'holo-micro-dial'
  | 'holo-bronze-dial'
  | 'holo-army-dial'
  | 'holo-ellipse-meter'
  | 'holo-liquid-orb'
  | 'holo-water-fill'
  | 'holo-depth-ring'
  | 'holo-tachometer'
  | 'holo-system-meter';

export const HOLOGRAPHIC_GAUGE_TYPES = new Set<HolographicGaugeVariant>([
  'holo-speedometer', 'holo-cyan-ring', 'holo-orbit-counter', 'holo-micro-dial',
  'holo-bronze-dial', 'holo-army-dial', 'holo-ellipse-meter', 'holo-liquid-orb',
  'holo-water-fill', 'holo-depth-ring', 'holo-tachometer', 'holo-system-meter',
]);

type GaugeData = {
  value?: number | string;
  min?: number | string;
  max?: number | string;
  label?: string;
  unit?: string;
  color?: string;
  lowMotion?: boolean;
  motionEnabled?: boolean;
};

type Spec = { value: number; min: number; max: number; label: string; unit: string; color: string; precision?: number };

const SPECS: Record<HolographicGaugeVariant, Spec> = {
  'holo-speedometer': { value: 65, min: 0, max: 100, label: 'POWER', unit: '%', color: '#14d9ff' },
  'holo-cyan-ring': { value: 82, min: 0, max: 100, label: 'ENERGY', unit: '%', color: '#25ddf6' },
  'holo-orbit-counter': { value: 56, min: 0, max: 100, label: 'NETWORK', unit: '%', color: '#247cff' },
  'holo-micro-dial': { value: 3.5, min: 0, max: 5, label: 'SIGNAL', unit: '', color: '#42e4d1', precision: 1 },
  'holo-bronze-dial': { value: 80, min: 0, max: 100, label: 'LOAD', unit: '%', color: '#e1ad4e' },
  'holo-army-dial': { value: 256, min: 0, max: 300, label: 'RPM', unit: '', color: '#31e09b' },
  'holo-ellipse-meter': { value: 70, min: 0, max: 100, label: 'DATA FLOW', unit: '%', color: '#53e9ff' },
  'holo-liquid-orb': { value: 52, min: 0, max: 100, label: 'LIQUID LEVEL', unit: '%', color: '#6855ff' },
  'holo-water-fill': { value: 84, min: 0, max: 100, label: 'CAPACITY', unit: '%', color: '#69edf1' },
  'holo-depth-ring': { value: 265, min: 0, max: 300, label: 'DEPTH', unit: 'm', color: '#17d9d7' },
  'holo-tachometer': { value: 78, min: 0, max: 100, label: 'SPEED', unit: 'km/h', color: '#269aff' },
  'holo-system-meter': { value: 84, min: 0, max: 100, label: 'SYSTEM', unit: '%', color: '#55f0cf' },
};

const number = (value: number | string | undefined, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const valueText = (value: number, precision = 0) => value.toLocaleString(undefined, {
  minimumFractionDigits: precision,
  maximumFractionDigits: precision,
});

const Arc = ({ percent, color, radius = 72, width = 8, dash, className = '' }: { percent: number; color: string; radius?: number; width?: number; dash?: boolean; className?: string }) => (
  <circle
    className={className}
    cx="100" cy="100" r={radius} fill="none" stroke={color} strokeWidth={width}
    strokeLinecap="round" pathLength="100" strokeDasharray={dash ? `${Math.max(1, percent * .58)} 2.3` : `${percent} 100`}
    transform="rotate(-90 100 100)"
  />
);

const TickRing = ({ radius = 86, count = 28, color = 'rgba(123, 210, 230, .45)' }: { radius?: number; count?: number; color?: string }) => (
  <g stroke={color} strokeWidth="1">
    {Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const x1 = 100 + Math.cos(angle) * radius;
      const y1 = 100 + Math.sin(angle) * radius;
      const x2 = 100 + Math.cos(angle) * (radius - (index % 5 === 0 ? 7 : 4));
      const y2 = 100 + Math.sin(angle) * (radius - (index % 5 === 0 ? 7 : 4));
      return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />;
    })}
  </g>
);

const GaugeDefs = ({ id, color }: { id: string; color: string }) => (
  <defs>
    <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#d8fbff" stopOpacity=".82" />
      <stop offset=".25" stopColor={color} stopOpacity=".8" />
      <stop offset="1" stopColor={color} stopOpacity=".12" />
    </linearGradient>
    <radialGradient id={`${id}-glass`}>
      <stop stopColor="#c9fbff" stopOpacity=".34" />
      <stop offset=".55" stopColor={color} stopOpacity=".12" />
      <stop offset="1" stopColor="#020913" stopOpacity=".08" />
    </radialGradient>
    <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.3" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id={`${id}-soft`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9" /></filter>
    <clipPath id={`${id}-clip`}><circle cx="100" cy="100" r="62" /></clipPath>
    <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#d7ffff" stopOpacity=".9" />
      <stop offset=".16" stopColor={color} stopOpacity=".78" />
      <stop offset="1" stopColor={color} stopOpacity=".28" />
    </linearGradient>
  </defs>
);

const Readout = ({ value, spec, label, unit }: { value: number; spec: Spec; label: string; unit: string }) => (
  <div className="holo-readout" style={{ '--holo-color': spec.color } as React.CSSProperties}>
    <strong>{valueText(value, spec.precision)}</strong>
    {unit && <span>{unit}</span>}
    <small>{label}</small>
  </div>
);

const Liquid = ({ id, level, color, animated }: { id: string; level: number; color: string; animated: boolean }) => {
  // The clipped liquid chamber is 124 units tall (y: 38 to 162).
  // Map the normalized percentage to that exact visible height so the waterline
  // corresponds to the numeric readout instead of only filling the lower half.
  const top = 162 - level * 1.24;
  return <g clipPath={`url(#${id}-clip)`} className={`holo-liquid ${animated ? '' : 'is-static'}`}>
    <rect x="36" y={top + 4} width="128" height={168 - top} fill={`url(#${id}-liquid)`} opacity=".78" />
    <g className="holo-liquid__wave holo-liquid__wave--back">
      <path d={`M-60 ${top + 7} C-24 ${top - 5} 12 ${top + 19} 48 ${top + 7} S120 ${top - 5} 156 ${top + 7} S228 ${top + 19} 264 ${top + 7} V180 H-60Z`} fill={color} opacity=".32" />
    </g>
    <g className="holo-liquid__wave holo-liquid__wave--front">
      <path d={`M-60 ${top} C-24 ${top - 13} 12 ${top + 13} 48 ${top} S120 ${top - 13} 156 ${top} S228 ${top + 13} 264 ${top} V180 H-60Z`} fill={`url(#${id}-liquid)`} />
    </g>
    <path className="holo-liquid__highlight" d={`M-60 ${top - 1} C-24 ${top - 14} 12 ${top + 12} 48 ${top - 1} S120 ${top - 14} 156 ${top - 1} S228 ${top + 12} 264 ${top - 1}`} fill="none" stroke="#e9ffff" strokeOpacity=".72" strokeWidth="1.3" />
    <ellipse cx="100" cy={top + 20} rx="54" ry="19" fill={color} opacity=".18" filter={`url(#${id}-soft)`} />
  </g>;
};

export const HolographicGauge: React.FC<{ variant: HolographicGaugeVariant; data?: GaugeData }> = ({ variant, data = {} }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spec = SPECS[variant];
  const min = number(data.min, spec.min);
  const max = Math.max(min + .01, number(data.max, spec.max));
  const baseValue = Math.min(max, Math.max(min, number(data.value, spec.value)));
  const label = data.label?.trim() || spec.label;
  const unit = data.unit ?? spec.unit;
  const [hovered, setHovered] = useState(false);
  const [drift, setDrift] = useState(0);
  const motionEnabled = data.motionEnabled !== false && !data.lowMotion;

  useEffect(() => {
    if (!hovered || !motionEnabled) { setDrift(0); return; }
    let direction = 1;
    const updateDrift = () => {
      const range = max - min;
      const magnitude = Math.max(1, Math.min(range * .06, Math.max(1, baseValue * .045)));
      setDrift(direction * magnitude * (.65 + Math.random() * .35));
      direction *= -1;
    };
    updateDrift();
    const timer = window.setInterval(() => {
      updateDrift();
    }, 520);
    return () => window.clearInterval(timer);
  }, [baseValue, hovered, max, min, motionEnabled]);

  const liveValue = Math.min(max, Math.max(min, baseValue + drift));
  const percent = ((liveValue - min) / (max - min)) * 100;
  const commonProps = {
    className: `holo-gauge holo-gauge--${variant} ${hovered ? 'is-active' : ''}`,
    style: { '--holo-color': data.color || spec.color } as React.CSSProperties,
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
    onFocus: () => setHovered(true),
    onBlur: () => setHovered(false),
    tabIndex: 0,
    role: 'img' as const,
    'aria-label': `${label}: ${valueText(liveValue, spec.precision)}${unit}`,
  };
  const color = data.color || spec.color;

  const face = useMemo(() => {
    if (variant === 'holo-speedometer' || variant === 'holo-tachometer') {
      const angle = -132 + percent * 2.64;
      return <svg viewBox="0 0 200 150" aria-hidden="true"><GaugeDefs id={id} color={color} />
        <path d="M29 124 A77 77 0 0 1 171 124" fill="none" stroke="rgba(103,164,184,.16)" strokeWidth="10" strokeLinecap="round" />
        <path d="M29 124 A77 77 0 0 1 171 124" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`} filter={`url(#${id}-glow)`} />
        {Array.from({ length: 17 }, (_, index) => { const a = (-132 + index * 16.5) * Math.PI / 180; return <line key={index} x1={100 + Math.cos(a) * 66} y1={124 + Math.sin(a) * 66} x2={100 + Math.cos(a) * 74} y2={124 + Math.sin(a) * 74} stroke={index / 16 * 100 <= percent ? color : 'rgba(134,180,197,.32)'} strokeWidth={index % 4 === 0 ? 2 : 1} />; })}
        <g transform={`rotate(${angle} 100 124)`}><line x1="100" y1="124" x2="100" y2="61" stroke="#d6fbff" strokeWidth="2.2" filter={`url(#${id}-glow)`} /><circle cx="100" cy="124" r="5" fill={color} /><circle cx="100" cy="124" r="2" fill="#f3feff" /></g>
      </svg>;
    }
    if (variant === 'holo-cyan-ring') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><circle cx="100" cy="100" r="78" fill={`url(#${id}-glass)`} stroke="rgba(105,221,244,.22)" /><Arc percent={100} color="rgba(105,221,244,.16)" radius={76} width={13} /><Arc percent={percent} color={`url(#${id}-metal)`} radius={76} width={13} /><Arc percent={percent * .65} color="#c9ffff" radius={61} width={2} dash /><circle cx="100" cy="100" r="52" fill="#031422" fillOpacity=".45" stroke={color} strokeOpacity=".26" /></svg>;
    if (variant === 'holo-orbit-counter') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><ellipse cx="100" cy="142" rx="70" ry="17" fill="none" stroke={color} strokeOpacity=".48" strokeWidth="3" className="holo-orbit" /><ellipse cx="100" cy="142" rx="57" ry="12" fill="none" stroke="#43c7ff" strokeOpacity=".42" strokeWidth="2" className="holo-orbit holo-orbit--reverse" /><circle cx="100" cy="90" r="55" fill={`url(#${id}-glass)`} stroke={color} strokeOpacity=".5" /><Arc percent={percent} color={color} radius={55} width={4} dash /></svg>;
    if (variant === 'holo-micro-dial') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><circle cx="100" cy="100" r="80" fill={`url(#${id}-glass)`} stroke={color} strokeOpacity=".5" /><TickRing radius={76} count={24} /><Arc percent={percent} color={color} radius={66} width={3} /><circle cx="100" cy="100" r="51" fill="#061923" fillOpacity=".72" stroke="rgba(221,255,255,.24)" /><circle cx="159" cy="63" r="3" fill="#fa8c5b" filter={`url(#${id}-glow)`} /></svg>;
    if (variant === 'holo-bronze-dial') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><circle cx="100" cy="100" r="84" fill="#1b1711" fillOpacity=".72" stroke="#9b7132" strokeWidth="3" /><circle cx="100" cy="100" r="73" fill={`url(#${id}-glass)`} stroke="#e6c579" strokeOpacity=".42" /><TickRing radius={66} count={32} color="rgba(243,205,127,.48)" /><Arc percent={percent} color="#f1cd77" radius={58} width={4} /><path d="M100 100 L126 55" stroke="#fff4ca" strokeWidth="2" filter={`url(#${id}-glow)`} /><circle cx="100" cy="100" r="6" fill="#e6ba5f" /></svg>;
    if (variant === 'holo-army-dial') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><circle cx="100" cy="100" r="84" fill="#101c15" stroke="#b9892f" strokeWidth="3" /><circle cx="100" cy="100" r="70" fill="none" stroke="#31dc89" strokeOpacity=".35" strokeWidth="6" /><Arc percent={percent} color={color} radius={70} width={7} dash /><circle cx="100" cy="100" r="52" fill={`url(#${id}-glass)`} stroke="#e3bc54" strokeOpacity=".6" /><path d="M33 100 H48 M152 100 H167" stroke="#f1c94f" strokeWidth="2" /></svg>;
    if (variant === 'holo-ellipse-meter') return <svg viewBox="0 0 250 150" aria-hidden="true"><GaugeDefs id={id} color={color} /><ellipse cx="125" cy="84" rx="95" ry="43" fill={`url(#${id}-glass)`} stroke={color} strokeOpacity=".26" /><ellipse cx="125" cy="84" rx="86" ry="34" fill="none" stroke="rgba(71,228,255,.18)" strokeWidth="10" /><path d="M45 84 A80 31 0 0 1 205 84" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`} filter={`url(#${id}-glow)`} />{Array.from({ length: 14 }, (_, index) => <rect key={index} x={47 + index * 11.2} y={106 - (index % 3)} width="7" height="4" rx="1" fill={index / 13 * 100 <= percent ? color : 'rgba(142,220,237,.18)'} />)}</svg>;
    if (variant === 'holo-liquid-orb' || variant === 'holo-water-fill') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><circle cx="100" cy="100" r="82" fill={`url(#${id}-glass)`} stroke={color} strokeOpacity=".42" strokeWidth="2" /><circle cx="100" cy="100" r="63" fill="#071c2b" fillOpacity=".55" /><Liquid id={id} level={percent} color={color} animated={motionEnabled} /><circle cx="100" cy="100" r="63" fill="none" stroke="#cdfdff" strokeOpacity=".3" /><path d="M61 57 Q100 32 139 57" fill="none" stroke="#ecffff" strokeOpacity=".45" strokeWidth="4" strokeLinecap="round" /></svg>;
    if (variant === 'holo-depth-ring') return <svg viewBox="0 0 200 200" aria-hidden="true"><GaugeDefs id={id} color={color} /><circle cx="100" cy="100" r="82" fill={`url(#${id}-glass)`} /><Arc percent={100} color="rgba(62,241,235,.16)" radius={80} width={5} /><Arc percent={percent} color={color} radius={80} width={5} /><Arc percent={percent * .72} color="#bffffc" radius={66} width={2} dash /><circle cx="100" cy="100" r="53" fill="#041622" fillOpacity=".62" stroke={color} strokeOpacity=".25" /></svg>;
    return <svg viewBox="0 0 240 180" aria-hidden="true"><GaugeDefs id={id} color={color} /><path d="M26 137 A94 94 0 0 1 214 137" fill="none" stroke="rgba(67,233,216,.14)" strokeWidth="10" /><path d="M26 137 A94 94 0 0 1 214 137" fill="none" stroke={color} strokeWidth="7" pathLength="100" strokeDasharray={`${percent} 100`} filter={`url(#${id}-glow)`} />{variant === 'holo-system-meter' && <><path d="M48 70 L73 41 M192 70 L167 41" stroke="#4ab4ff" strokeWidth="3" /><circle cx="56" cy="121" r="5" fill="#ed5dca" /><circle cx="184" cy="121" r="5" fill="#60ecdf" /></>}<path d={`M120 137 L${120 + Math.cos((-140 + percent * 2.8) * Math.PI / 180) * 66} ${137 + Math.sin((-140 + percent * 2.8) * Math.PI / 180) * 66}`} stroke="#d9ffff" strokeWidth="2" /><circle cx="120" cy="137" r="5" fill={color} /></svg>;
  }, [color, id, motionEnabled, percent, variant]);

  return <div {...commonProps}>
    <div className="holo-gauge__aura" />
    {face}
    <Readout value={liveValue} spec={{ ...spec, color }} label={label} unit={unit} />
    {(variant === 'holo-speedometer' || variant === 'holo-tachometer') && <div className="holo-scale"><span>{valueText(min)}</span><span>{valueText(max)}</span></div>}
    <style>{`
      .holo-gauge{position:relative;box-sizing:border-box;width:260px;height:200px;display:grid;place-items:center;isolation:isolate;outline:none;cursor:default;color:#e9ffff;font-family:Inter,"Microsoft YaHei",sans-serif;touch-action:manipulation;--holo-color:${color}}
      .holo-gauge>svg{position:absolute;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--holo-color) 40%,transparent));transition:transform 260ms ease-out,filter 260ms ease-out}
      .holo-gauge__aura{position:absolute;inset:25px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--holo-color) 16%,transparent),transparent 67%);filter:blur(9px);opacity:.7;transition:opacity .2s ease,transform .2s ease;pointer-events:none}
      .holo-gauge:hover>svg,.holo-gauge:focus-visible>svg,.holo-gauge.is-active>svg{transform:translateY(-2px) scale(1.018);filter:drop-shadow(0 0 10px color-mix(in srgb,var(--holo-color) 70%,transparent))}
      .holo-gauge:hover .holo-gauge__aura,.holo-gauge:focus-visible .holo-gauge__aura{opacity:1;transform:scale(1.08)}
      .holo-readout{position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:2px;min-width:88px;max-width:142px;text-align:center;text-shadow:0 0 14px color-mix(in srgb,var(--holo-color) 75%,transparent);pointer-events:none;isolation:isolate}
      .holo-readout::before{content:'';position:absolute;z-index:-1;inset:-9px -13px;border-radius:50%;background:radial-gradient(ellipse,rgba(2,12,22,.82) 12%,rgba(2,12,22,.45) 58%,transparent 74%);filter:blur(1px)}.holo-readout strong{font-size:31px;line-height:1;font-weight:760;font-variant-numeric:tabular-nums;letter-spacing:0;color:#efffff}.holo-readout span{font-size:11px;color:var(--holo-color);font-weight:700}.holo-readout small{display:block;flex-basis:100%;max-width:136px;margin-top:4px;overflow-wrap:anywhere;color:#a8d5dd;font-size:9px;font-weight:700;letter-spacing:.08em;line-height:1.15}
      .holo-scale{position:absolute;z-index:1;bottom:24px;left:43px;right:43px;display:flex;justify-content:space-between;color:#a9d1d9;font-size:9px;font-variant-numeric:tabular-nums;pointer-events:none}.holo-orbit{transform-origin:center;animation:holo-orbit 4.8s linear infinite}.holo-orbit--reverse{animation-direction:reverse;animation-duration:3.4s}.holo-liquid__wave{transform-box:fill-box;transform-origin:center}.holo-liquid__wave--back{animation:holo-liquid-flow-back 3.6s linear infinite}.holo-liquid__wave--front{animation:holo-liquid-flow 2.15s linear infinite}.holo-liquid__highlight{transform-box:fill-box;transform-origin:center;animation:holo-liquid-flow 2.15s linear infinite}.holo-liquid.is-static .holo-liquid__wave,.holo-liquid.is-static .holo-liquid__highlight{animation:none}
      /* Keep the readout inside the instrument face instead of floating above the arc. */
      .holo-gauge--holo-speedometer .holo-readout,.holo-gauge--holo-tachometer .holo-readout{transform:translateY(8px)}.holo-gauge--holo-system-meter .holo-readout{transform:translateY(4px)}.holo-gauge--holo-ellipse-meter{width:280px;height:180px}.holo-gauge--holo-ellipse-meter .holo-readout{transform:translateY(-14px)}.holo-gauge--holo-orbit-counter .holo-readout{transform:translateY(-8px)}
      @keyframes holo-orbit{to{transform:rotate(360deg)}}@keyframes holo-liquid-flow{from{transform:translateX(0)}to{transform:translateX(-42px)}}@keyframes holo-liquid-flow-back{from{transform:translateX(-36px)}to{transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.holo-gauge *{animation:none!important;transition:none!important}}
    `}</style>
  </div>;
};

export default HolographicGauge;
