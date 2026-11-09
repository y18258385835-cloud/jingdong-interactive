import { GlobalVariable, ProjectData, SceneElement } from '../types';

// —— 全局变量 / 动态数据接入（第 3 项）——

export function getVarValue(vars: GlobalVariable[] | undefined, name: string): string | number | undefined {
  const v = (vars || []).find((x) => x.name === name);
  return v ? v.value : undefined;
}

export function getVarNumber(vars: GlobalVariable[] | undefined, name: string, fallback = 0): number {
  const v = getVarValue(vars, name);
  if (v === undefined) return fallback;
  const n = parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

/** 解析元素绑定：变量文本/数值。返回浅拷贝，不改动原对象 */
export function resolveBindings(el: SceneElement, project: ProjectData | undefined): SceneElement {
  const out: SceneElement = { ...el };
  const vars = project?.variables;
  // 文本变量绑定 → txt/shape 内容、图表/翻牌器标题
  if (el.bindText) {
    const v = getVarValue(vars, el.bindText);
    if (v !== undefined) {
      const s = String(v);
      if (el.type === 'txt' || el.type === 'shape') out.content = s;
      out.chartTitle = s;
    }
  }
  // 内联占位符替换 {{变量名}}
  if (out.content && typeof out.content === 'string' && out.content.includes('{{') && vars && vars.length > 0) {
    out.content = out.content.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const v = getVarValue(vars, varName.trim());
      return v !== undefined ? String(v) : match;
    });
  }
  // 数值绑定 → 翻牌器目标值
  if (el.bindValue) {
    const v = getVarValue(vars, el.bindValue);
    if (v !== undefined) {
      const n = parseFloat(String(v));
      if (!isNaN(n)) out.counterValue = n;
    }
  }

  // —— UI 组件（自带/官方/Galaxy/交互控件）与 MQTT 变量联动 ——
  if (el.type === 'ui-component' && vars && vars.length > 0) {
    let uiData = out.uiComponentData ? { ...out.uiComponentData } : {};
    let hasChanged = false;

    // 1. 数值变量绑定 (bindValue) → 仪表盘/数字卡片/进度环/滑块/水波图
    if (el.bindValue) {
      const boundVar = vars.find((x) => x.name === el.bindValue);
      if (boundVar && boundVar.value !== undefined) {
        const val = boundVar.value;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        const effectiveNum = !isNaN(num) ? num : val;

        uiData.value = effectiveNum;
        uiData.currentValue = effectiveNum;
        uiData.counterValue = typeof effectiveNum === 'number' ? effectiveNum : 0;
        if (boundVar.unit) uiData.unit = boundVar.unit;
        if (boundVar.min !== undefined && uiData.min === undefined) uiData.min = boundVar.min;
        if (boundVar.max !== undefined && uiData.max === undefined) uiData.max = boundVar.max;
        hasChanged = true;
      }
    }

    // 2. 文本/状态变量绑定 (bindText) → 状态徽章/卡片内容/标题
    if (el.bindText) {
      const boundVar = vars.find((x) => x.name === el.bindText);
      if (boundVar && boundVar.value !== undefined) {
        const strVal = String(boundVar.value);
        uiData.status = strVal;
        uiData.content = strVal;
        if (uiData.value === undefined || typeof uiData.value === 'string') {
          uiData.value = strVal;
        }
        hasChanged = true;
      }
    }

    // 3. 递归替换 uiComponentData 字符字段中的 {{变量名}}
    const replaceTemplates = (val: any): any => {
      if (typeof val === 'string' && val.includes('{{')) {
        return val.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
          const v = getVarValue(vars, varName.trim());
          return v !== undefined ? String(v) : match;
        });
      }
      return val;
    };

    const textKeys = ['title', 'label', 'content', 'value', 'unit', 'status', 'caption', 'subtitle', 'eyebrow', 'footer', 'buttonLabel'];
    for (const key of textKeys) {
      if (uiData[key] !== undefined && typeof uiData[key] === 'string') {
        const next = replaceTemplates(uiData[key]);
        if (next !== uiData[key]) {
          uiData[key] = next;
          hasChanged = true;
        }
      }
    }

    if (hasChanged) {
      out.uiComponentData = uiData;
    }
  }
  return out;
}

export const DEFAULT_VARIABLES: GlobalVariable[] = [
  { id: 'var_visitors', name: '今日访客数', value: 1280, type: 'number' },
  { id: 'var_status', name: '运营状态', value: '运行中', type: 'text' },
  { id: 'var_uptime', name: '设备在线时长', value: 99.9, type: 'number' },
];
