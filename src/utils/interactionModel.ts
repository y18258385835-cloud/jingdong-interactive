import type { Hotspot, Scene, SceneElement, GlobalVariable, InteractionTrigger as SceneInteractionTrigger, InteractionStep } from '../types';

export type InteractionAction = 'none' | 'jump' | 'popup' | 'url' | 'media' | 'set-variable';
export type InteractionTrigger = SceneInteractionTrigger;

export const INTERACTION_TRIGGER_OPTIONS: ReadonlyArray<{ value: InteractionTrigger; label: string }> = [
  { value: 'click', label: '点击触发' },
  { value: 'hover', label: '悬停触发' },
  { value: 'long-press', label: '长按触发' },
  { value: 'swipe-direction', label: '方向滑动' },
];

export interface InteractionConfig {
  trigger: InteractionTrigger;
  action: InteractionAction;
  target?: string;
  url?: string;
  mediaRefId?: string;
  mediaType?: 'image' | 'video';
  variableName?: string;
  variableValue?: string | number | boolean;
  hoverDelay: number;
  /** Advanced multi-step sequence. When present, it runs instead of the single action. */
  steps?: InteractionStep[];
}

type InteractionSource = Omit<Pick<SceneElement, 'linkType' | 'link' | 'linkUrl' | 'trigger' | 'hoverDelay'>, 'linkType'> & { linkType?: 'jump' | 'popup' | 'url' | 'media' } &
  Partial<Pick<Hotspot, 'mediaRefId' | 'mediaType'>> & {
    interaction?: Partial<InteractionConfig>;
    variableName?: string;
    variableValue?: string | number | boolean;
  };

export function resolveInteraction(source: InteractionSource | null | undefined): InteractionConfig {
  const custom = source?.interaction || {};
  const legacyAction: InteractionAction = source?.linkType === 'media'
    ? 'media'
    : source?.linkType === 'url'
      ? 'url'
      : source?.linkType === 'popup'
        ? 'popup'
        : source?.link
          ? 'jump'
          : 'none';
  return {
    trigger: custom.trigger || source?.trigger || 'click',
    action: custom.action || legacyAction,
    target: custom.target || source?.link,
    url: custom.url || source?.linkUrl || (source?.linkType === 'url' ? source?.link : undefined),
    mediaRefId: custom.mediaRefId || source?.mediaRefId,
    mediaType: custom.mediaType || source?.mediaType,
    variableName: custom.variableName || source?.variableName,
    variableValue: custom.variableValue ?? source?.variableValue,
    hoverDelay: Math.max(0, Math.min(10, custom.hoverDelay ?? source?.hoverDelay ?? 0.3)),
    steps: Array.isArray(custom.steps) ? custom.steps : [],
  };
}

export function isSafeInteractionUrl(url?: string): boolean {
  return !!url && /^(https?:\/\/|mailto:)/i.test(url.trim());
}

export function applyVariableMutation(
  variables: GlobalVariable[] | undefined,
  config: InteractionConfig,
): GlobalVariable[] | undefined {
  if (config.action !== 'set-variable' || !config.variableName) return variables;
  const name = config.variableName.trim();
  if (!name) return variables;
  const current = Array.isArray(variables) ? variables : [];
  const nextValue: string | number = typeof config.variableValue === 'boolean' ? String(config.variableValue) : (config.variableValue ?? '');
  const exists = current.some((v) => v.name === name);
  if (!exists) return [...current, { id: `var_${Date.now()}`, name, value: nextValue, type: typeof nextValue === 'number' ? 'number' : 'text' }];
  return current.map((v) => v.name === name ? { ...v, value: nextValue } : v);
}

export interface InteractionConflict {
  type: 'duplicate-hotspot' | 'element-hotspot' | 'overlapping-elements' | 'ambiguous-trigger';
  ids: string[];
  message: string;
}

const isInteractive = (source: InteractionSource): boolean => {
  const config = resolveInteraction(source);
  return config.action !== 'none' || (config.steps?.length || 0) > 0;
};

/** 静态检测编辑器中最常见的抢占问题；坐标均使用舞台百分比。 */
export function detectInteractionConflicts(scene: Scene | undefined): InteractionConflict[] {
  if (!scene) return [];
  const conflicts: InteractionConflict[] = [];
  const interactive = scene.els.filter((el) => el.visible !== false && isInteractive(el));

  for (let i = 0; i < interactive.length; i += 1) {
    const a = interactive[i];
    for (let j = i + 1; j < interactive.length; j += 1) {
      const b = interactive[j];
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlap && a.zIndex === b.zIndex) {
        conflicts.push({
          type: 'overlapping-elements',
          ids: [a.id, b.id],
          message: `交互图层「${a.id}」与「${b.id}」区域重叠且层级相同，点击可能不确定`,
        });
      }
    }
  }

  for (const el of scene.els) {
    const hotspots = Array.isArray(el.hotspots) ? el.hotspots : [];
    for (let i = 0; i < hotspots.length; i += 1) {
      const a = hotspots[i];
      if (isInteractive(el)) {
        conflicts.push({
          type: 'element-hotspot',
          ids: [el.id, a.id],
          message: `元素「${el.id}」与热点「${a.id}」同时可交互，建议关闭其中一层或调整层级`,
        });
      }
      for (let j = i + 1; j < hotspots.length; j += 1) {
        const b = hotspots[j];
        const sameCartesian = a.position.coordType === 'cartesian' && b.position.coordType === 'cartesian' &&
          a.position.x === b.position.x && a.position.y === b.position.y && a.position.z === b.position.z;
        const sameSpherical = a.position.coordType === 'spherical' && b.position.coordType === 'spherical' &&
          a.position.theta === b.position.theta && a.position.phi === b.position.phi;
        if (sameCartesian || sameSpherical) {
          conflicts.push({
            type: 'duplicate-hotspot',
            ids: [a.id, b.id],
            message: `热点「${a.id}」与「${b.id}」位置重合，点击区域会互相抢占`,
          });
        }
      }
    }
  }
  return conflicts;
}

export function summarizeInteractionConflicts(conflicts: InteractionConflict[]): string {
  if (!conflicts.length) return '';
  return conflicts.slice(0, 3).map((item) => item.message).join('；') + (conflicts.length > 3 ? `（另有 ${conflicts.length - 3} 项）` : '');
}
