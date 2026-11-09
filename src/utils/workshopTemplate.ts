import type { ProjectData, SceneElement } from '../types';

/**
 * 内置预设模板：鲸动 · 多媒体工坊（Multimedia Workshop）
 * 来源：demo-vfx/gesture-demo.html 页面级体感演示，转译为编辑器工程数据。
 * 4 大屏场景：首页 / 产品矩阵 / 核心指标 / 特效墙
 * 已预置工程级体感开关 + 场景手势绑定（页面级输入总线）。
 */
const el = (p: Partial<SceneElement> & { id: string; type: 'txt' | 'shape'; x: number; y: number; w: number; h: number }): SceneElement => ({
  refId: '',
  zIndex: 1,
  opacity: 100,
  startTime: 0,
  duration: 12,
  ...p,
} as SceneElement);

export const MULTIMEDIA_WORKSHOP_DATA: ProjectData = {
  meta: {
    v: 42.1,
    title: '鲸动 · 多媒体工坊',
    author: '鲸动交互平台',
    updatedAt: new Date().toISOString(),
  },
  start: 'ws_home',
  canvas: { width: 1920, height: 1080 },
  // 工程级体感开关（页面级输入总线：手势与鼠标/键盘平级）
  motionInput: { enabled: true, sensitivity: 1 },
  scenes: {
    ws_home: {
      id: 'ws_home',
      alias: '首页',
      type: 'scene',
      duration: 12,
      bgColor: '#0a0f24',
      order: 0,
      transitionIn: 'fade',
      transitionOut: 'fade',
      transitionDuration: 0.6,
      // 手势绑定：右滑/挥手→下一页；左滑→上一页；握拳→回首页
      gestureBindings: [
        { id: 'gb_mat_wave', gesture: 'wave', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_mat_swr', gesture: 'swipe_right', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_mat_swl', gesture: 'swipe_left', action: 'prev_scene', sensitivity: 1 },
        { id: 'gb_mat_fist', gesture: 'fist', action: 'goto_start', sensitivity: 1 },
      ],
      els: [
        el({ id: 'wh_t1', type: 'txt', x: 26, y: 34, w: 48, h: 12, content: '鲸动 · 多媒体工坊', fontSize: 64, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: 6, zIndex: 3, animType: 'fade-in', animDur: 0.8 }),
        el({ id: 'wh_t2', type: 'txt', x: 20, y: 48, w: 60, h: 8, content: '体感交互 · 大屏演示 · 多场景一键漫游', fontSize: 24, color: '#9aa7c8', textAlign: 'center', letterSpacing: 8, zIndex: 2, animType: 'fade-in', animDur: 1 }),
        el({ id: 'wh_t3', type: 'txt', x: 18, y: 62, w: 64, h: 8, content: '👉 右滑 下一页 ｜ 👈 左滑 上一页 ｜ ✊ 握拳 回首页', fontSize: 18, color: '#6b7698', textAlign: 'center', zIndex: 1, animType: 'fade-in', animDur: 1.4 }),
      ],
    },
    ws_matrix: {
      id: 'ws_matrix',
      alias: '产品矩阵',
      type: 'scene',
      duration: 12,
      bgColor: '#1a0a16',
      order: 1,
      transitionIn: 'slide-left',
      transitionOut: 'slide-left',
      transitionDuration: 0.6,
      gestureBindings: [
        { id: 'gb_sta_wave', gesture: 'wave', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_sta_swr', gesture: 'swipe_right', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_sta_swl', gesture: 'swipe_left', action: 'prev_scene', sensitivity: 1 },
        { id: 'gb_sta_fist', gesture: 'fist', action: 'goto_start', sensitivity: 1 },
      ],
      els: [
        el({ id: 'wm_t1', type: 'txt', x: 32, y: 12, w: 36, h: 9, content: '产品矩阵', fontSize: 44, fontWeight: '800', color: '#ffffff', textAlign: 'center', zIndex: 4 }),
        el({ id: 'wm_c1', type: 'shape', x: 8, y: 30, w: 26, h: 40, zIndex: 3, animType: 'fade-in', animDur: 0.6 }),
        el({ id: 'wm_c1t', type: 'txt', x: 10, y: 48, w: 22, h: 6, content: '核心展示', fontSize: 22, fontWeight: '600', color: '#ffffff', textAlign: 'center', zIndex: 4 }),
        el({ id: 'wm_c2', type: 'shape', x: 38, y: 30, w: 26, h: 40, zIndex: 3, animType: 'fade-in', animDur: 0.9 }),
        el({ id: 'wm_c2t', type: 'txt', x: 40, y: 48, w: 22, h: 6, content: '数据可视化', fontSize: 22, fontWeight: '600', color: '#ffffff', textAlign: 'center', zIndex: 4 }),
        el({ id: 'wm_c3', type: 'shape', x: 68, y: 30, w: 26, h: 40, zIndex: 3, animType: 'fade-in', animDur: 1.2 }),
        el({ id: 'wm_c3t', type: 'txt', x: 70, y: 48, w: 22, h: 6, content: '体感交互', fontSize: 22, fontWeight: '600', color: '#ffffff', textAlign: 'center', zIndex: 4 }),
      ],
    },
    ws_stats: {
      id: 'ws_stats',
      alias: '核心指标',
      type: 'scene',
      duration: 12,
      bgColor: '#07201a',
      order: 2,
      transitionIn: 'slide-left',
      transitionOut: 'slide-left',
      transitionDuration: 0.6,
      gestureBindings: [
        { id: 'gb_vfx_wave', gesture: 'wave', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_vfx_swr', gesture: 'swipe_right', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_vfx_swl', gesture: 'swipe_left', action: 'prev_scene', sensitivity: 1 },
        { id: 'gb_vfx_fist', gesture: 'fist', action: 'goto_start', sensitivity: 1 },
      ],
      els: [
        el({ id: 'ws_t1', type: 'txt', x: 32, y: 10, w: 36, h: 9, content: '核心指标', fontSize: 44, fontWeight: '800', color: '#ffffff', textAlign: 'center', zIndex: 4 }),
        el({ id: 'ws_n1', type: 'txt', x: 8, y: 38, w: 26, h: 16, content: '120+', fontSize: 72, fontWeight: '800', color: '#7dffb2', textAlign: 'center', zIndex: 3, animType: 'fade-in', animDur: 0.8 }),
        el({ id: 'ws_l1', type: 'txt', x: 8, y: 56, w: 26, h: 6, content: '核心能力项', fontSize: 18, color: '#7d94a8', textAlign: 'center', zIndex: 2 }),
        el({ id: 'ws_n2', type: 'txt', x: 38, y: 38, w: 26, h: 16, content: '99.9%', fontSize: 72, fontWeight: '800', color: '#2dd4a0', textAlign: 'center', zIndex: 3, animType: 'fade-in', animDur: 1.1 }),
        el({ id: 'ws_l2', type: 'txt', x: 38, y: 56, w: 26, h: 6, content: '稳定可用率', fontSize: 18, color: '#7d94a8', textAlign: 'center', zIndex: 2 }),
        el({ id: 'ws_n3', type: 'txt', x: 68, y: 38, w: 26, h: 16, content: '4K', fontSize: 72, fontWeight: '800', color: '#5eead4', textAlign: 'center', zIndex: 3, animType: 'fade-in', animDur: 1.4 }),
        el({ id: 'ws_l3', type: 'txt', x: 68, y: 56, w: 26, h: 6, content: '超清画质', fontSize: 18, color: '#7d94a8', textAlign: 'center', zIndex: 2 }),
      ],
    },
    ws_vfx: {
      id: 'ws_vfx',
      alias: '特效墙',
      type: 'scene',
      duration: 12,
      bgColor: '#0a1326',
      order: 3,
      transitionIn: 'slide-left',
      transitionOut: 'fade',
      transitionDuration: 0.6,
      gestureBindings: [
        { id: 'gb_x_wave', gesture: 'wave', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_x_swr', gesture: 'swipe_right', action: 'next_scene', sensitivity: 1 },
        { id: 'gb_x_swl', gesture: 'swipe_left', action: 'prev_scene', sensitivity: 1 },
        { id: 'gb_x_fist', gesture: 'fist', action: 'goto_start', sensitivity: 1 },
      ],
      els: [
        el({ id: 'wv_t1', type: 'txt', x: 30, y: 10, w: 40, h: 9, content: '特效墙', fontSize: 44, fontWeight: '800', color: '#ffffff', textAlign: 'center', zIndex: 4 }),
        el({ id: 'wv_t2', type: 'txt', x: 26, y: 20, w: 48, h: 6, content: '动效库实时渲染 · 10+ 特效透明通道', fontSize: 18, color: '#7d94a8', textAlign: 'center', zIndex: 3 }),
        el({ id: 'wv_t3', type: 'txt', x: 14, y: 78, w: 72, h: 7, content: '👉 右滑 下一页 ｜ 👈 左滑 上一页 ｜ ✊ 握拳 回首页', fontSize: 16, color: '#6b7698', textAlign: 'center', zIndex: 1 }),
      ],
    },
  },
};
