import { Scene } from '../types';

/**
 * 场景序列循环（巡航 / 自动轮播 / 上下页 / 上一&下一场景）的共享判定逻辑。
 * 统一在这里维护「弹窗场景」的识别，避免 App 与 CanvasViewport 多处逻辑分叉。
 */

/** 场景是否为弹窗 / UI 类型（type 标注为 interface 或 modal，不参与主场景序列自动循环） */
export const isPopupScene = (scene: { type?: string } | null | undefined): boolean => {
  if (!scene) return false;
  return scene.type === 'interface' || scene.type === 'modal';
};

/** 收集被「弹窗（popup）」交互引用的场景 id：这类场景只作为弹窗内容，不该参与自动循环 */
export const collectPopupReferencedSceneIds = (scenes: Record<string, Scene>): Set<string> => {
  const ids = new Set<string>();
  Object.values(scenes).forEach((s) => {
    (s.els || []).forEach((el) => {
      if (el.linkType === 'popup' && el.link) ids.add(el.link);
    });
  });
  return ids;
};

/**
 * 可参与「场景序列自动循环」的画布场景 keys（返回数组顺序即场景序列循环顺序）。
 * 排除两类：
 *  1. type 标注为 interface / modal 的弹窗 / UI 场景；
 *  2. 被任意元素以 popup 形式引用的场景（仅作为弹窗内容弹出，不应作为主场景轮播）。
 */
export const getLoopableSceneKeys = (scenes: Record<string, Scene>): string[] => {
  // 仅以「场景呈现类型」为唯一依据：只有显式标注为 interface/modal 的弹窗场景不参与主序列循环。
  // 注意：一个「画布全屏场景」即使被某元素以弹窗形式引用，也仍然参与轮播/巡航（此前被误排除）。
  return Object.keys(scenes).filter((id) => {
    const s = scenes[id];
    if (!s) return false;
    return !isPopupScene(s);
  });
};
