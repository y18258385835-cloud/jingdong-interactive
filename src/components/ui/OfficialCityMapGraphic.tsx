import React from 'react';
import { useCityMaps } from './cityMapRegistry';

interface OfficialCityMapGraphicProps {
  cityId: string;
  showLabels?: boolean;
  className?: string;
  zoom?: number;
}

export const OfficialCityMapGraphic: React.FC<OfficialCityMapGraphicProps> = ({ cityId, showLabels = true, className, zoom = 10 }) => {
  const maps = useCityMaps();
  const map = maps[cityId];
  if (!map) return null;
  const scale = Math.max(0.65, Math.min(1.45, 1 + (zoom - 10) * 0.04));

  return <svg className={className} style={{ width: '100%', height: '100%', display: 'block', fill: 'none', stroke: 'none' }} viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${map.name}行政区地图`}>
    <defs>
      <linearGradient id="official-city-map-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2495ff" />
        <stop offset="1" stopColor="#1262d5" />
      </linearGradient>
      <pattern id="official-city-map-grid" width="44" height="44" patternUnits="userSpaceOnUse">
        <path d="M44 0H0V44" fill="none" stroke="#4c91cf" strokeOpacity=".12" strokeWidth="1" />
      </pattern>
      <filter id="official-city-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#061426" floodOpacity=".48" />
      </filter>
    </defs>
    <rect width="1000" height="640" fill="url(#official-city-map-grid)" />
    <g transform={`translate(${(500 * (1 - scale)).toFixed(1)} ${(320 * (1 - scale)).toFixed(1)}) scale(${scale})`} filter="url(#official-city-map-shadow)">
      <path d={map.outline} fill="url(#official-city-map-fill)" stroke="#69bdff" strokeWidth="3" strokeLinejoin="round" />
      {map.districts.map((district) => <path key={`${district.name}-border`} d={district.path} fill="none" stroke="#073d83" strokeOpacity=".74" strokeWidth="2.2" strokeLinejoin="round" />)}
    </g>
    {showLabels && <g transform={`translate(${(500 * (1 - scale)).toFixed(1)} ${(320 * (1 - scale)).toFixed(1)}) scale(${scale})`}>{map.districts.filter((district) => district.label && district.area >= 0.0012).map((district) => <text
      key={`${district.name}-label`}
      x={district.label!.x}
      y={district.label!.y}
      fill="#f4fbff"
      stroke="#1262d5"
      strokeWidth="3"
      paintOrder="stroke"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="19"
      fontWeight="650"
      letterSpacing="1"
    >{district.name}</text>)}</g>}
  </svg>;
};
