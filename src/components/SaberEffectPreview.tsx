import React from 'react';
import { getSaberEffectProfile, type SaberEffectType } from '../utils/saberPresets';

interface SaberEffectPreviewProps {
  effectType: SaberEffectType;
  glowColor: string;
  secondaryColor?: string;
  coreColor?: string;
  path?: string;
  animated?: boolean;
  className?: string;
  coreWidth?: number;
  glowSpread?: number;
}

const PREVIEW_PATHS: Record<SaberEffectType, string[]> = {
  standard: ['M 8 70 C 24 18 42 82 60 34 S 82 24 94 58'],
  wave: ['M 6 54 C 18 12 30 96 44 54 S 70 12 94 54', 'M 6 62 C 18 20 30 104 44 62 S 70 20 94 62'],
  blade: ['M 28 86 L 28 20', 'M 50 92 L 50 10', 'M 72 82 L 72 28'],
  ribbon: ['M 10 88 C 32 70 28 30 52 12 C 69 0 73 30 90 12', 'M 10 96 C 34 78 30 38 54 20 C 70 8 76 38 94 20', 'M 16 80 C 36 62 34 26 56 10'],
  beam: ['M 6 50 L 94 50'],
  neon: ['M 16 84 C 28 26 54 18 84 74'],
};

export const SaberEffectPreview: React.FC<SaberEffectPreviewProps> = ({
  effectType,
  glowColor,
  secondaryColor = glowColor,
  coreColor = '#ffffff',
  path,
  animated = false,
  className = '',
  coreWidth = 1,
  glowSpread = 18,
}) => {
  const id = React.useId().replace(/:/g, '');
  const profile = getSaberEffectProfile(effectType);
  const isBeam = effectType === 'beam';
  const isBlade = effectType === 'blade';
  const basePaths = path ? [path] : PREVIEW_PATHS[effectType];
  const tracks = path
    ? profile.trackOffsets.map((offset) => ({ d: path, offset }))
    : basePaths.map((d, index) => ({ d, offset: profile.trackOffsets[index] ?? 0 }));
  const blurOuter = Math.max(1.2, glowSpread * profile.outerBlurScale * 2.2);
  const blurInner = Math.max(0.6, glowSpread * profile.innerBlurScale * 1.8);
  const ambientWidth = Math.max(coreWidth * profile.ambientScale, isBeam ? 11 : 4);
  const haloWidth = Math.max(coreWidth * profile.haloScale, isBeam ? 5 : 2.2);
  const primaryWidth = Math.max(coreWidth * profile.coreScale, isBeam ? 2.4 : 1.15);
  const dash = effectType === 'wave' || effectType === 'ribbon' ? profile.trailDash : undefined;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <filter id={`${id}-outer`} x="-80%" y="-120%" width="260%" height="340%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="2" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={profile.turbulence} result="distorted" />
          <feGaussianBlur in="distorted" stdDeviation={blurOuter} />
        </filter>
        <filter id={`${id}-inner`} x="-60%" y="-100%" width="220%" height="300%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={blurInner} />
        </filter>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={secondaryColor} stopOpacity="0" />
          <stop offset="0.2" stopColor={glowColor} stopOpacity="0.9" />
          <stop offset="0.5" stopColor={coreColor} />
          <stop offset="0.8" stopColor={glowColor} stopOpacity="0.9" />
          <stop offset="1" stopColor={secondaryColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {tracks.map(({ d, offset }, index) => {
        const transform = offset ? `translate(0 ${offset})` : undefined;
        const opacity = Math.max(0.18, 0.62 - index * 0.09);
        return (
          <g key={`${d}-${index}`} transform={transform} fill="none" strokeLinecap={isBlade ? 'square' : 'round'} strokeLinejoin="round">
            <path d={d} stroke={secondaryColor} strokeWidth={ambientWidth} strokeOpacity={isBeam ? 0.16 : profile.trailOpacity * 0.95} filter={`url(#${id}-outer)`} />
            <path d={d} stroke={glowColor} strokeWidth={haloWidth} strokeOpacity={isBeam ? 0.38 : opacity} filter={`url(#${id}-inner)`} />
            <path d={d} stroke={isBeam ? `url(#${id}-beam)` : glowColor} strokeWidth={primaryWidth} strokeOpacity={isBlade ? 0.74 : 0.92} strokeDasharray={dash}>
              {animated && dash && <animate attributeName="stroke-dashoffset" values="0;-38" dur="2.2s" repeatCount="indefinite" />}
            </path>
            {!isBlade && <path d={d} stroke={coreColor} strokeWidth={Math.max(0.38, coreWidth * 0.62)} strokeOpacity="0.98" />}
            {effectType === 'neon' && <path d={d} stroke={coreColor} strokeWidth={Math.max(0.2, coreWidth * 0.32)} strokeOpacity="0.9" />}
          </g>
        );
      })}

      {profile.particles > 0 && (
        <g fill={coreColor} opacity="0.72">
          {Array.from({ length: profile.particles }, (_, index) => {
            const x = 18 + ((index * 37) % 70);
            const y = 20 + ((index * 19) % 58);
            return <circle key={index} cx={x} cy={y} r={0.35 + (index % 3) * 0.16} />;
          })}
        </g>
      )}
    </svg>
  );
};
