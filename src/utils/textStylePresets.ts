import type { CSSProperties } from 'react';
import type { TextStylePresetId } from '../types';

export interface TextStylePreset {
  id: TextStylePresetId;
  label: string;
  title: string;
  sourceTitle?: string;
  accent: string;
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  { id: 'none', label: '无', title: '无样式', accent: '#22d3ee' },
  { id: 'white-3d', label: '3D 白', title: '白色立体', sourceTitle: '3D White Numbers', accent: '#f8fafc' },
  { id: 'hollow-glow', label: '空心', title: '空心发光', sourceTitle: 'Hollow Glow Numbers', accent: '#ffffff' },
  { id: 'vhs-glitch', label: 'VHS', title: '故障描边', sourceTitle: 'VHS Glitch Numbers', accent: '#ff3b5c' },
  { id: 'ice', label: '冰晶', title: '冰晶高光', sourceTitle: 'Ice Numbers', accent: '#a9e8ff' },
  { id: 'frosted-hologram', label: '全息', title: '磨砂全息', sourceTitle: 'Frosted Holographic Numbers', accent: '#b794f6' },
  { id: 'color-fluid', label: '流体', title: '彩色流体', sourceTitle: 'Colorful Fluid Numbers', accent: '#22f6b1' },
  { id: 'gold-neon', label: '金霓虹', title: '金色霓虹', sourceTitle: 'Golden Neon Numbers', accent: '#ffd166' },
  { id: 'gold-solid', label: '金实心', title: '金色实心', sourceTitle: 'Golden Solid Numbers', accent: '#f8b84e' },
];

const px = (value: number, scale: number) => `${(value * scale).toFixed(2)}px`;

const layeredShadow = (layers: Array<[number, number, number, string]>, scale: number) =>
  layers.map(([x, y, blur, color]) => `${px(x, scale)} ${px(y, scale)} ${px(blur, scale)} ${color}`).join(', ');

export const getTextStylePresetStyle = (id?: TextStylePresetId, scale = 1): CSSProperties => {
  switch (id) {
    case 'white-3d':
      return {
        color: '#ffffff',
        fontWeight: 900,
        textShadow: layeredShadow([
          [0, 1.2, 0, '#d9dde4'],
          [0, 2.4, 0, '#b8bec9'],
          [0, 3.6, 0, '#8b929f'],
          [0, 5.2, 0, '#4d535e'],
          [0, 9, 12, 'rgba(0,0,0,.78)'],
          [-1.5, -1.5, 0, 'rgba(255,255,255,.55)'],
        ], scale),
      };
    case 'hollow-glow':
      return {
        color: '#ffffff',
        fontWeight: 900,
        WebkitTextFillColor: 'transparent',
        WebkitTextStroke: `${px(1.7, scale)} rgba(255,255,255,.94)`,
        textShadow: layeredShadow([
          [0, 0, 6, 'rgba(255,255,255,.95)'],
          [0, 0, 18, 'rgba(255,255,255,.56)'],
          [0, 0, 34, 'rgba(120,220,255,.22)'],
        ], scale),
      };
    case 'vhs-glitch':
      return {
        color: '#ffffff',
        fontWeight: 900,
        WebkitTextStroke: `${px(1.2, scale)} rgba(255,255,255,.88)`,
        textShadow: layeredShadow([
          [2.6, 0, 0, 'rgba(255,0,72,.9)'],
          [-2.2, 0, 0, 'rgba(0,225,255,.86)'],
          [0, 0, 8, 'rgba(255,255,255,.72)'],
          [0, 6, 16, 'rgba(0,0,0,.75)'],
        ], scale),
      };
    case 'ice':
      return {
        color: '#dff8ff',
        fontWeight: 900,
        backgroundImage: 'linear-gradient(180deg,#ffffff 0%,#d7f5ff 28%,#87d8ff 62%,#1f79c7 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        WebkitTextStroke: `${px(0.8, scale)} rgba(220,250,255,.72)`,
        textShadow: layeredShadow([
          [0, -1, 0, 'rgba(255,255,255,.9)'],
          [0, 0, 10, 'rgba(120,210,255,.72)'],
          [0, 8, 18, 'rgba(0,30,80,.62)'],
        ], scale),
      };
    case 'frosted-hologram':
      return {
        color: '#e9f7ff',
        fontWeight: 900,
        backgroundImage: 'linear-gradient(110deg,#ffffff 0%,#9cf6ff 22%,#d6b8ff 48%,#8af7d3 70%,#ffffff 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        WebkitTextStroke: `${px(0.7, scale)} rgba(255,255,255,.62)`,
        textShadow: layeredShadow([
          [0, 0, 8, 'rgba(177,232,255,.7)'],
          [0, 0, 22, 'rgba(177,139,255,.45)'],
          [0, 10, 18, 'rgba(0,0,0,.5)'],
        ], scale),
      };
    case 'color-fluid':
      return {
        color: '#ffffff',
        fontWeight: 900,
        backgroundImage: 'linear-gradient(135deg,#ff3f8e 0%,#ffd166 24%,#2ee6a6 50%,#38bdf8 74%,#a855f7 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        WebkitTextStroke: `${px(0.8, scale)} rgba(255,255,255,.32)`,
        textShadow: layeredShadow([
          [0, 0, 10, 'rgba(56,189,248,.5)'],
          [0, 0, 18, 'rgba(255,63,142,.35)'],
          [0, 8, 16, 'rgba(0,0,0,.58)'],
        ], scale),
      };
    case 'gold-neon':
      return {
        color: '#ffe7a3',
        fontWeight: 900,
        WebkitTextStroke: `${px(1, scale)} rgba(255,244,205,.72)`,
        textShadow: layeredShadow([
          [0, 0, 6, 'rgba(255,234,150,.95)'],
          [0, 0, 18, 'rgba(255,174,51,.72)'],
          [0, 0, 34, 'rgba(255,132,0,.42)'],
          [0, 8, 18, 'rgba(0,0,0,.7)'],
        ], scale),
      };
    case 'gold-solid':
      return {
        color: '#ffd56a',
        fontWeight: 900,
        backgroundImage: 'linear-gradient(180deg,#fff3b0 0%,#ffd166 32%,#c47a18 72%,#6c3600 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        WebkitTextStroke: `${px(0.6, scale)} rgba(95,49,0,.45)`,
        textShadow: layeredShadow([
          [0, 1.5, 0, '#9b5a0a'],
          [0, 3, 0, '#6f3900'],
          [0, 8, 14, 'rgba(0,0,0,.66)'],
          [0, -1, 0, 'rgba(255,255,230,.8)'],
        ], scale),
      };
    default:
      return {};
  }
};
