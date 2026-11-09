/** Galaxy UI 组件的类型、基础尺寸与判定工具（不含渲染实现）。 */
import type { HolographicGaugeVariant } from './HolographicGauges';
import type { DataIconVariant } from './IsometricDataIcons';

export type GalaxyComponentType =
  | 'green-outline-button'
  | 'cyan-solid-button'
  | 'auth-toggle-button'
  | 'transparent-bubble-button'
  | 'blue-bubble-button'
  | 'back-button'
  | 'next-button'
  | 'play-button'
  | 'pause-button'
  | 'pause-button-alt'
  | 'sci-fi-neon-button'
  | 'sci-fi-neon-frame-button'
  | 'sci-fi-polygon-button'
  | 'sci-fi-node-button'
  | 'sci-fi-glow-button'
  | 'sci-fi-stripe-button'
  | 'data-visualization-header'
  | 'visualization-header'
  | 'tech-blue-header'
  | 'circle-left-arrow'
  | 'circle-right-arrow'
  | 'triangle-left-arrow'
  | 'triangle-right-arrow'
  | 'rect-left-arrow'
  | 'rect-right-arrow'
  | 'sci-fi-glow-left-arrow'
  | 'sci-fi-glow-right-arrow'
  | 'glass-down-arrow'
  | 'people-count-blue'
  | 'people-count-green'
  | 'module-lightning'
  | 'module-star'
  | 'module-bubble'
  | 'module-car'
  | 'module-user'
  | 'module-flask'
  | 'module-user-icon'
  | 'module-flask-icon'
  | 'module-data'
  | 'pattern-prediction-chart'
  | 'data-trend-chart'
  | 'data-trend-cyber-chart'
  | 'data-trend-area-chart'
  | 'data-trend-dual-area-chart'
  | 'cyber-bubble-chart'
  | 'cyber-ring-chart'
  | 'cyber-multi-ring-chart'
  | 'cyber-hud-gauge'
  | 'cyber-radar-chart'
  | 'cyber-3d-donut-chart'
  | 'distribution-stat-chart'
  | 'pyramid-distribution-chart'
  | 'bug-button'
  | 'glow-button'
  | 'neon-button'
  | '3d-button'
  | 'gradient-button'
  | 'glass-button'
  | 'slide-button'
  | 'pulse-button'
  | 'glass-card'
  | 'gradient-card'
  | 'neon-card'
  | 'profile-card'
  | 'metric-card'
  | 'spotlight-card'
  | 'split-feature-card'
  | 'outline-panel-card'
  | 'spinner-loader'
  | 'dots-loader'
  | 'ring-loader'
  | 'double-ring-loader'
  | 'wave-loader'
  | 'success-notification'
  | 'error-notification'
  | 'warning-notification'
  | 'info-notification'
  | 'toggle-switch'
  | 'gradient-progress'
  | 'progress-ring'
  | 'solid-badge'
  | 'outline-badge'
  | 'input'
  | 'slider'
  | 'multi-stage-slider'
  | 'glossy-progress-slider'
  | 'bare-glossy-progress-slider'
  | 'threshold-slider'
  | 'bare-threshold-slider'
  | 'segment-progress-slider'
  | 'bare-timeline-slider'
  | 'checkbox'
  | 'radio'
  | 'avatar'
  | 'rating'
  | 'tabs'
  | 'divider'
  | 'tooltip'
  | 'icon'
  | 'flip-number'
  | 'gauge'
  | 'trend-line'
  | 'bar-chart'
  | 'donut-chart'
  | 'stats-table'
  | 'alert-list'
  | 'freshness'
  | 'geo-map'
  | 'topology'
  | 'factory-floor'
  | 'custom-visual'
  | 'official-modao'
  | HolographicGaugeVariant
  | DataIconVariant;

export const CONTINUOUS_INTERACTION_COMPONENT_TYPES = new Set<GalaxyComponentType>([
  'multi-stage-slider',
  'glossy-progress-slider',
  'bare-glossy-progress-slider',
  'threshold-slider',
  'bare-threshold-slider',
  'segment-progress-slider',
  'bare-timeline-slider',
]);

export const isContinuousInteractionComponent = (type?: string): boolean =>
  CONTINUOUS_INTERACTION_COMPONENT_TYPES.has(type as GalaxyComponentType);

export const GALAXY_COMPONENT_BASE_SIZE: Record<GalaxyComponentType, { w: number; h: number }> = {
  'green-outline-button': { w: 260, h: 60 },
  'cyan-solid-button': { w: 260, h: 60 },
  'auth-toggle-button': { w: 330, h: 64 },
  'transparent-bubble-button': { w: 250, h: 86 },
  'blue-bubble-button': { w: 250, h: 86 },
  'back-button': { w: 260, h: 72 },
  'next-button': { w: 260, h: 72 },
  'play-button': { w: 110, h: 125 },
  'pause-button': { w: 110, h: 125 },
  'pause-button-alt': { w: 110, h: 125 },
  'sci-fi-neon-button': { w: 288, h: 88 },
  'sci-fi-neon-frame-button': { w: 320, h: 120 },
  'sci-fi-polygon-button': { w: 420, h: 180 },
  'sci-fi-node-button': { w: 420, h: 180 },
  'sci-fi-glow-button': { w: 420, h: 180 },
  'sci-fi-stripe-button': { w: 420, h: 180 },
  'data-visualization-header': { w: 1000, h: 120 },
  'visualization-header': { w: 1000, h: 120 },
  'tech-blue-header': { w: 1000, h: 120 },
  'circle-left-arrow': { w: 160, h: 160 },
  'circle-right-arrow': { w: 160, h: 160 },
  'triangle-left-arrow': { w: 160, h: 160 },
  'triangle-right-arrow': { w: 160, h: 160 },
  'rect-left-arrow': { w: 160, h: 160 },
  'rect-right-arrow': { w: 160, h: 160 },
  'sci-fi-glow-left-arrow': { w: 160, h: 160 },
  'sci-fi-glow-right-arrow': { w: 160, h: 160 },
  'glass-down-arrow': { w: 220, h: 180 },
  'people-count-blue': { w: 280, h: 90 },
  'people-count-green': { w: 280, h: 90 },
  'module-lightning': { w: 360, h: 140 },
  'module-star': { w: 360, h: 140 },
  'module-bubble': { w: 360, h: 140 },
  'module-car': { w: 360, h: 140 },
  'module-user': { w: 360, h: 140 },
  'module-flask': { w: 360, h: 140 },
  'module-user-icon': { w: 360, h: 140 },
  'module-flask-icon': { w: 360, h: 140 },
  'module-data': { w: 520, h: 180 },
  'pattern-prediction-chart': { w: 1000, h: 560 },
  'data-trend-chart': { w: 1000, h: 500 },
  'data-trend-cyber-chart': { w: 1100, h: 520 },
  'data-trend-area-chart': { w: 1100, h: 520 },
  'data-trend-dual-area-chart': { w: 1100, h: 520 },
  'cyber-bubble-chart': { w: 780, h: 825 },
  'cyber-ring-chart': { w: 780, h: 825 },
  'cyber-multi-ring-chart': { w: 780, h: 860 },
  'cyber-hud-gauge': { w: 600, h: 640 },
  'cyber-radar-chart': { w: 900, h: 560 },
  'cyber-3d-donut-chart': { w: 880, h: 540 },
  'distribution-stat-chart': { w: 880, h: 550 },
  'pyramid-distribution-chart': { w: 880, h: 550 },
  'holo-speedometer': { w: 260, h: 200 },
  'holo-cyan-ring': { w: 260, h: 200 },
  'holo-orbit-counter': { w: 260, h: 200 },
  'holo-micro-dial': { w: 260, h: 200 },
  'holo-bronze-dial': { w: 260, h: 200 },
  'holo-army-dial': { w: 260, h: 200 },
  'holo-ellipse-meter': { w: 280, h: 180 },
  'holo-liquid-orb': { w: 260, h: 200 },
  'holo-water-fill': { w: 260, h: 200 },
  'holo-depth-ring': { w: 260, h: 200 },
  'holo-tachometer': { w: 260, h: 200 },
  'holo-system-meter': { w: 260, h: 200 },
  'iso-stack-node': { w: 300, h: 170 },
  'iso-cube-platform': { w: 300, h: 170 },
  'iso-liquid-wave': { w: 300, h: 170 },
  'iso-metric-badge': { w: 300, h: 170 },
  'iso-tile-metric': { w: 300, h: 170 },
  'iso-orbit-energy': { w: 300, h: 170 },
  'flip-number': { w: 280, h: 150 },
  'gauge': { w: 280, h: 170 },
  'trend-line': { w: 360, h: 190 },
  'bar-chart': { w: 360, h: 190 },
  'donut-chart': { w: 280, h: 170 },
  'stats-table': { w: 360, h: 190 },
  'alert-list': { w: 360, h: 190 },
  'freshness': { w: 280, h: 150 },
  'geo-map': { w: 360, h: 190 },
  'topology': { w: 360, h: 190 },
  'factory-floor': { w: 1000, h: 650 },
  'custom-visual': { w: 280, h: 180 },
  'official-modao': { w: 420, h: 240 },
  'bug-button': { w: 118, h: 40 },
  'glow-button': { w: 132, h: 44 },
  'neon-button': { w: 134, h: 46 },
  '3d-button': { w: 132, h: 44 },
  'gradient-button': { w: 132, h: 44 },
  'glass-button': { w: 132, h: 44 },
  'slide-button': { w: 132, h: 46 },
  'pulse-button': { w: 132, h: 44 },
  'glass-card': { w: 280, h: 180 },
  'gradient-card': { w: 280, h: 180 },
  'neon-card': { w: 280, h: 180 },
  'profile-card': { w: 260, h: 260 },
  'metric-card': { w: 280, h: 180 },
  'spotlight-card': { w: 280, h: 180 },
  'split-feature-card': { w: 280, h: 180 },
  'outline-panel-card': { w: 280, h: 180 },
  'spinner-loader': { w: 48, h: 48 },
  'dots-loader': { w: 56, h: 16 },
  'ring-loader': { w: 48, h: 48 },
  'double-ring-loader': { w: 48, h: 48 },
  'wave-loader': { w: 50, h: 40 },
  'success-notification': { w: 300, h: 70 },
  'error-notification': { w: 300, h: 70 },
  'warning-notification': { w: 300, h: 70 },
  'info-notification': { w: 300, h: 70 },
  'toggle-switch': { w: 52, h: 28 },
  'gradient-progress': { w: 260, h: 30 },
  'progress-ring': { w: 80, h: 80 },
  'solid-badge': { w: 70, h: 28 },
  'outline-badge': { w: 70, h: 30 },
  'input': { w: 220, h: 60 },
  'slider': { w: 240, h: 30 },
  'glossy-progress-slider': { w: 340, h: 72 },
  'bare-glossy-progress-slider': { w: 340, h: 58 },
  'threshold-slider': { w: 340, h: 82 },
  'bare-threshold-slider': { w: 340, h: 64 },
  'segment-progress-slider': { w: 340, h: 88 },
  'multi-stage-slider': { w: 340, h: 106 },
  'bare-timeline-slider': { w: 340, h: 106 },
  'checkbox': { w: 90, h: 24 },
  'radio': { w: 90, h: 24 },
  'avatar': { w: 48, h: 48 },
  'rating': { w: 110, h: 22 },
  'tabs': { w: 180, h: 40 },
  'divider': { w: 240, h: 20 },
  'tooltip': { w: 100, h: 40 },
  'icon': { w: 48, h: 48 },
};
