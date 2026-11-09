import React from 'react';

// 图标类型定义
export type IconName =
  // 箭头类
  | 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  | 'arrow-up-right' | 'arrow-up-left' | 'arrow-down-right' | 'arrow-down-left'
  | 'chevron-up' | 'chevron-down' | 'chevron-left' | 'chevron-right'
  | 'double-arrow-up' | 'double-arrow-down' | 'double-arrow-left' | 'double-arrow-right'
  | 'arrow-circle-up' | 'arrow-circle-down' | 'arrow-circle-left' | 'arrow-circle-right'
  // 播放控制
  | 'play' | 'pause' | 'stop' | 'rewind' | 'forward'
  | 'skip-back' | 'skip-forward' | 'volume' | 'volume-mute'
  // 状态指示
  | 'check' | 'check-circle' | 'x' | 'x-circle'
  | 'alert' | 'alert-circle' | 'info' | 'info-circle'
  | 'help' | 'help-circle' | 'loader' | 'loader-circle'
  // 数据可视化
  | 'bar-chart' | 'line-chart' | 'pie-chart' | 'donut-chart'
  | 'area-chart' | 'scatter-chart' | 'radar-chart' | 'funnel-chart'
  | 'counter' | 'clock' | 'calendar' | 'trending-up' | 'trending-down'
  // 常用UI
  | 'settings' | 'search' | 'delete' | 'edit' | 'copy'
  | 'plus' | 'minus' | 'more' | 'menu' | 'grid'
  | 'list' | 'eye' | 'eye-off' | 'lock' | 'unlock'
  | 'download' | 'upload' | 'share' | 'link' | 'image'
  | 'video' | 'audio' | 'file' | 'folder' | 'star'
  | 'heart' | 'bookmark' | 'tag' | 'filter' | 'sort'
  | 'zoom-in' | 'zoom-out' | 'maximize' | 'minimize' | 'refresh'
  | 'rotate' | 'crop' | 'layers' | 'box' | 'globe'
  | 'user' | 'users' | 'message' | 'bell' | 'mail'
  | 'phone' | 'map-pin' | 'navigation' | 'compass' | 'target';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

// SVG 路径映射
const iconPaths: Record<IconName, React.ReactNode> = {
  // 箭头类
  'arrow-up': <path d="M12 19V5M5 12l7-7 7 7" />,
  'arrow-down': <path d="M12 5v14M19 12l-7 7-7-7" />,
  'arrow-left': <path d="M19 12H5M12 19l-7-7 7-7" />,
  'arrow-right': <path d="M5 12h14M12 5l7 7-7 7" />,
  'arrow-up-right': <path d="M7 17L17 7M7 7h10v10" />,
  'arrow-up-left': <path d="M17 17L7 7M17 7H7v10" />,
  'arrow-down-right': <path d="M7 7l10 10M7 17h10V7" />,
  'arrow-down-left': <path d="M17 7L7 17M17 17H7V7" />,
  'chevron-up': <path d="M18 15l-6-6-6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-left': <path d="M15 18l-6-6 6-6" />,
  'chevron-right': <path d="M9 18l6-6-6-6" />,
  'double-arrow-up': <><path d="M7 11l5-5 5 5" /><path d="M7 18l5-5 5 5" /></>,
  'double-arrow-down': <><path d="M7 6l5 5 5-5" /><path d="M7 13l5 5 5-5" /></>,
  'double-arrow-left': <><path d="M11 6l-5 6 5 6" /><path d="M18 6l-5 6 5 6" /></>,
  'double-arrow-right': <><path d="M13 6l5 6-5 6" /><path d="M6 6l5 6-5 6" /></>,
  'arrow-circle-up': <><circle cx="12" cy="12" r="10" /><path d="M12 16V8M8 12l4-4 4 4" /></>,
  'arrow-circle-down': <><circle cx="12" cy="12" r="10" /><path d="M12 8v8M16 12l-4 4-4-4" /></>,
  'arrow-circle-left': <><circle cx="12" cy="12" r="10" /><path d="M16 12H8M12 8l-4 4 4 4" /></>,
  'arrow-circle-right': <><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8l4 4-4 4" /></>,
  // 播放控制
  'play': <polygon points="6 3 20 12 6 21 6 3" />,
  'pause': <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
  'stop': <rect x="5" y="5" width="14" height="14" rx="2" />,
  'rewind': <><polygon points="11 19 2 12 11 5 11 19" /><polygon points="22 19 13 12 22 5 22 19" /></>,
  'forward': <><polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" /></>,
  'skip-back': <><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></>,
  'skip-forward': <><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></>,
  'volume': <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>,
  'volume-mute': <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>,
  // 状态指示
  'check': <polyline points="20 6 9 17 4 12" />,
  'check-circle': <><circle cx="12" cy="12" r="10" /><polyline points="16 8 10 14 8 12" /></>,
  'x': <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  'x-circle': <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
  'alert': <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  'alert-circle': <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
  'info': <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  'info-circle': <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  'help': <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  'help-circle': <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  'loader': <><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></>,
  'loader-circle': <><path d="M21 12a9 9 0 1 1-6.219-8.56" /></>,
  // 数据可视化
  'bar-chart': <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
  'line-chart': <><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></>,
  'pie-chart': <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
  'donut-chart': <><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 10 10h-10z" /></>,
  'area-chart': <><path d="M3 3v18h18" /><path d="M7 12l3-3 4 4 5-6" /><path d="M7 12v6h12v-6l-5 6-4-4-3 3z" /></>,
  'scatter-chart': <><circle cx="6" cy="18" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="9" cy="15" r="1.5" /><circle cx="15" cy="10" r="1.5" /></>,
  'radar-chart': <><polygon points="12 2 19 7 19 17 12 22 5 17 5 7 12 2" /><polygon points="12 6 16 9 16 15 12 18 8 15 8 9 12 6" /></>,
  'funnel-chart': <><path d="M3 3h18l-7 8v10l-4-2V11z" /></>,
  'counter': <><rect x="3" y="5" width="18" height="14" rx="2" /><text x="12" y="15" textAnchor="middle" fontSize="8" fill="currentColor">00</text></>,
  'clock': <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  'calendar': <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  'trending-down': <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>,
  // 常用UI
  'settings': <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  'search': <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  'delete': <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  'edit': <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  'copy': <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  'plus': <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  'minus': <line x1="5" y1="12" x2="19" y2="12" />,
  'more': <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
  'menu': <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  'grid': <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  'list': <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  'eye': <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
  'lock': <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  'unlock': <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>,
  'download': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  'upload': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  'share': <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>,
  'link': <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  'image': <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  'video': <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  'audio': <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  'file': <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></>,
  'folder': <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  'star': <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  'heart': <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  'bookmark': <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  'tag': <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>,
  'filter': <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  'sort': <><path d="M3 6h13M3 12h9M3 18h5" /><path d="M17 8l4 4-4 4M21 12H11" /></>,
  'zoom-in': <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></>,
  'zoom-out': <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></>,
  'maximize': <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></>,
  'minimize': <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />,
  'refresh': <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
  'rotate': <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>,
  'crop': <><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" /><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" /></>,
  'layers': <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  'box': <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  'globe': <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  'user': <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  'users': <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  'message': <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  'bell': <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  'mail': <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  'phone': <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  'map-pin': <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  'navigation': <polygon points="3 11 22 2 13 21 11 13 3 11" />,
  'compass': <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>,
  'target': <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
};

// 统一图标组件
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = 'currentColor',
  className = '',
  strokeWidth = 2,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {iconPaths[name]}
    </svg>
  );
};

// 图标分类
export const ICON_CATEGORIES = {
  arrows: {
    name: '箭头',
    icons: ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'double-arrow-up', 'double-arrow-down', 'arrow-circle-up', 'arrow-circle-down'] as IconName[],
  },
  player: {
    name: '播放控制',
    icons: ['play', 'pause', 'stop', 'rewind', 'forward', 'skip-back', 'skip-forward', 'volume', 'volume-mute'] as IconName[],
  },
  status: {
    name: '状态指示',
    icons: ['check', 'check-circle', 'x', 'x-circle', 'alert', 'alert-circle', 'info', 'info-circle', 'help', 'help-circle', 'loader', 'loader-circle'] as IconName[],
  },
  charts: {
    name: '数据可视化',
    icons: ['bar-chart', 'line-chart', 'pie-chart', 'donut-chart', 'area-chart', 'scatter-chart', 'radar-chart', 'funnel-chart', 'counter', 'clock', 'calendar', 'trending-up', 'trending-down'] as IconName[],
  },
  ui: {
    name: '常用UI',
    icons: ['settings', 'search', 'delete', 'edit', 'copy', 'plus', 'minus', 'more', 'menu', 'grid', 'list', 'eye', 'eye-off', 'lock', 'unlock', 'download', 'upload', 'share', 'link'] as IconName[],
  },
  media: {
    name: '媒体文件',
    icons: ['image', 'video', 'audio', 'file', 'folder', 'star', 'heart', 'bookmark', 'tag', 'filter', 'sort'] as IconName[],
  },
  tools: {
    name: '工具操作',
    icons: ['zoom-in', 'zoom-out', 'maximize', 'minimize', 'refresh', 'rotate', 'crop', 'layers', 'box', 'globe'] as IconName[],
  },
  social: {
    name: '社交联系',
    icons: ['user', 'users', 'message', 'bell', 'mail', 'phone', 'map-pin', 'navigation', 'compass', 'target'] as IconName[],
  },
};

export default Icon;
