import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sliders,
  Check,
  X,
  Zap,
  Palette,
  Gauge,
  Power,
  Type as TypeIcon,
  Link as LinkIcon,
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import type { CustomCodeControl, CustomCodeControlType, SceneElement, GlobalVariable } from '../types';
import { extractPluginControls, resolveControlValues } from '../utils/customCodeControls';
import { buildSmartCustomCodeControls, mergeAiControlNaming } from '../utils/customCodeSmartControls';
import { apiUrl } from '../core/api/url';
import { loadLLMConfig } from './LLMApiConfigPanel';

interface CustomCodeDynamicControlsProps {
  element: SceneElement;
  onUpdateElement: (elementId: string, patch: Partial<SceneElement>, actionDescription?: string) => void;
  showToast?: (message: string, type?: 'info' | 'warning' | 'error') => void;
  title?: string;
  projectVariables?: GlobalVariable[];
}

// 4 种新手常用预设向导类型
const WIZARD_TYPES = [
  { id: 'speed', label: '动效速度', icon: Gauge, type: 'slider' as CustomCodeControlType, default: 1, min: 0.1, max: 3, step: 0.1, unit: 'x', hint: '调节组件旋转或变换快慢' },
  { id: 'color', label: '主题颜色', icon: Palette, type: 'color' as CustomCodeControlType, default: '#38bdf8', unit: '', hint: '调节主发光或背景颜色' },
  { id: 'intensity', label: '发光/强度', icon: Zap, type: 'slider' as CustomCodeControlType, default: 80, min: 0, max: 100, step: 1, unit: '%', hint: '调节辉光、透明度或粒子强度' },
  { id: 'toggle', label: '启用开关', icon: Power, type: 'toggle' as CustomCodeControlType, default: true, unit: '', hint: '开启或关闭特效/阴影' },
  { id: 'text', label: '文字标题', icon: TypeIcon, type: 'text' as CustomCodeControlType, default: '标题内容', unit: '', hint: '修改组件内展示的文字' },
];

// 一键小白通用预设控制包
const DEFAULT_PRESET_CONTROLS: CustomCodeControl[] = [
  { key: 'speed', label: '动效运行速度', type: 'slider', default: 1.0, min: 0.1, max: 3.0, step: 0.1, unit: 'x', group: '基础动效' },
  { key: 'color', label: '主题核心色彩', type: 'color', default: '#38bdf8', group: '视觉外观' },
  { key: 'glow', label: '发光辉光强度', type: 'slider', default: 70, min: 0, max: 100, step: 1, unit: '%', group: '视觉外观' },
  { key: 'size', label: '图元缩放比例', type: 'slider', default: 100, min: 50, max: 150, step: 5, unit: '%', group: '基础动效' },
  { key: 'enabled', label: '动画循环开启', type: 'toggle', default: true, group: '基础动效' },
];

export const CustomCodeDynamicControls: React.FC<CustomCodeDynamicControlsProps> = ({
  element,
  onUpdateElement,
  showToast,
  title,
  projectVariables = [],
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isAddingControl, setIsAddingControl] = useState(false);
  const [selectedWizardType, setSelectedWizardType] = useState(WIZARD_TYPES[0]);
  const [customLabel, setCustomLabel] = useState('');
  const [activeBindControlKey, setActiveBindControlKey] = useState<string | null>(null);

  const isCustomCode = element.type === 'custom-code' && Boolean(element.customCode);

  // Active controls list
  const controls: CustomCodeControl[] = useMemo(() => {
    if (element.customCodeControls && element.customCodeControls.length > 0) {
      return element.customCodeControls;
    }
    if (element.customCode?.controls && element.customCode.controls.length > 0) {
      return element.customCode.controls;
    }
    if (element.uiComponentData?.customControls && Array.isArray(element.uiComponentData.customControls)) {
      return element.uiComponentData.customControls;
    }
    if (isCustomCode && element.customCode) {
      return extractPluginControls(element.customCode);
    }
    return [];
  }, [element.customCodeControls, element.customCode, element.uiComponentData, isCustomCode]);

  // Current values
  const currentProps = useMemo(() => {
    const raw =
      element.customCodeProps ||
      element.uiComponentData?.customProps ||
      element.customCode?.controlValues ||
      {};
    return resolveControlValues(controls, raw);
  }, [controls, element.customCodeProps, element.uiComponentData, element.customCode]);

  // 本地结构识别：给文本/数值加 text-N key，把 CSS 字面量换成可调变量。
  // 每一项都有明确落点，不依赖 AI 猜测。
  const applyCustomCodeControls = (
    nextControls: CustomCodeControl[],
    nextHtml?: string,
    nextCss?: string,
    action = '应用控制项',
  ) => {
    if (!element.customCode) return false;
    const initialValues = resolveControlValues(nextControls, currentProps);
    onUpdateElement(element.id, {
      customCode: {
        ...element.customCode,
        ...(nextHtml !== undefined ? { html: nextHtml } : {}),
        ...(nextCss !== undefined ? { css: nextCss } : {}),
        controls: nextControls,
        controlValues: initialValues,
      },
      customCodeControls: nextControls,
      customCodeProps: initialValues,
    }, action);
    return true;
  };

  const getSmartCustomCodePlan = (): { controls: CustomCodeControl[]; html?: string; css?: string } | null => {
    if (!isCustomCode || !element.customCode) return null;
    const plugin = element.customCode;
    const combined = `${plugin.html || ''}\n${plugin.css || ''}\n${plugin.js || ''}`;
    // 作者已经写了 @control / @schema：尊重作者声明，不再改代码。
    if (/@control|@schema/i.test(combined)) {
      const explicit = extractPluginControls(plugin);
      return explicit.length ? { controls: explicit } : null;
    }
    const smart = buildSmartCustomCodeControls(
      plugin,
      element.customCodeControls?.length ? element.customCodeControls : plugin.controls,
    );
    return smart.controls.length ? smart : null;
  };

  const handleSmartExtract = () => {
    const plan = getSmartCustomCodePlan();
    if (!plan) {
      showToast?.('没有识别到可调参数，可尝试 AI 或手动添加', 'warning');
      return;
    }
    applyCustomCodeControls(plan.controls, plan.html, plan.css, '本地智能识别控制项');
    showToast?.(`已识别 ${plan.controls.length} 项真实可调参数`, 'info');
  };

  // Handle single property adjustment
  const handlePropChange = (key: string, value: any) => {
    const nextProps = { ...currentProps, [key]: value };
    const patch: Partial<SceneElement> = {
      customCodeProps: nextProps,
    };
    if (element.customCode) {
      patch.customCode = {
        ...element.customCode,
        controlValues: nextProps,
      };
    }
    if (element.uiComponentData) {
      patch.uiComponentData = {
        ...element.uiComponentData,
        customProps: nextProps,
        // 将通用调节项直接同步至 UI 组件对应核心字段，确保 ScaledUIComponent 立刻重绘生效
        ...(key === 'color' ? { color: value, accentColor: value } : {}),
        ...(key === 'textColor' ? { textColor: value } : {}),
        ...(key === 'value' ? { value: value } : {}),
        ...(key === 'label' ? { label: value } : {}),
        ...(key === 'title' ? { title: value, label: value } : {}),
        ...(key === 'speed' ? { speed: value } : {}),
        ...(key === 'enabled' ? { motionEnabled: Boolean(value) } : {}),
      };
    }
    onUpdateElement(element.id, patch, `调整属性: ${key}`);
  };

  // 一键装配常用调节滑块（小白救星，零代码秒级生效）
  const handleApplyDefaultPreset = () => {
    // 自定义代码优先使用本地结构识别：参数直接绑定真实 DOM/CSS，
    // 而不是一律塞速度/缩放这类对统计表无效的通用滑块。
    const smartPlan = getSmartCustomCodePlan();
    if (smartPlan) {
      applyCustomCodeControls(smartPlan.controls, smartPlan.html, smartPlan.css, '一键识别真实可调参数');
      showToast?.(`已识别 ${smartPlan.controls.length} 项与组件内容直接关联的参数`, 'info');
      return;
    }
    const initialValues = resolveControlValues(DEFAULT_PRESET_CONTROLS, currentProps);
    const patch: Partial<SceneElement> = {
      customCodeControls: DEFAULT_PRESET_CONTROLS,
      customCodeProps: initialValues,
    };
    if (element.customCode) {
      patch.customCode = {
        ...element.customCode,
        controls: DEFAULT_PRESET_CONTROLS,
        controlValues: initialValues,
      };
    }
    if (element.uiComponentData) {
      patch.uiComponentData = {
        ...element.uiComponentData,
        customControls: DEFAULT_PRESET_CONTROLS,
        customProps: initialValues,
        ...(initialValues.color ? { color: initialValues.color, accentColor: initialValues.color } : {}),
        ...(initialValues.speed !== undefined ? { speed: initialValues.speed } : {}),
        ...(initialValues.enabled !== undefined ? { motionEnabled: Boolean(initialValues.enabled) } : {}),
      };
    }
    onUpdateElement(element.id, patch, '一键装配常用调节滑块');
    showToast?.('已为您装配速度、色彩、发光等通用调节滑块，拖动即可生效！', 'info');
  };

  // 从代码自动扫描识别
  const handleScanFromCode = () => {
    let found: CustomCodeControl[] = [];
    if (isCustomCode && element.customCode) {
      const plan = getSmartCustomCodePlan();
      if (plan) {
        applyCustomCodeControls(plan.controls, plan.html, plan.css, '本地智能识别控制项');
        showToast?.(`已识别 ${plan.controls.length} 项真实可调参数`, 'info');
        return;
      }
      found = extractPluginControls(element.customCode);
    } else if (element.type === 'ui-component') {
      const data = element.uiComponentData || {};
      found = [
        { key: 'color', label: '主题颜色', type: 'color', default: data.color || data.accentColor || '#38bdf8', group: '视觉外观' },
        { key: 'size', label: '组件缩放', type: 'slider', default: 100, min: 50, max: 150, step: 5, unit: '%', group: '基础动效' },
        { key: 'glow', label: '辉光强度', type: 'slider', default: 70, min: 0, max: 100, step: 1, unit: '%', group: '视觉外观' },
        ...(data.value !== undefined ? [{ key: 'value', label: '指标数值', type: 'number' as const, default: data.value, group: '业务数据' }] : []),
        ...(data.label ? [{ key: 'label', label: '标题文案', type: 'text' as const, default: data.label, group: '业务数据' }] : []),
        { key: 'speed', label: '动效速度', type: 'slider', default: 1.0, min: 0.1, max: 3.0, step: 0.1, unit: 'x', group: '基础动效' },
        { key: 'enabled', label: '动效运转', type: 'toggle', default: true, group: '基础动效' },
      ];
    }
    if (found.length === 0) {
      showToast?.('源码中未找到额外声明，推荐点击“一键装配常用滑块”或“AI 智能生成”', 'info');
      return;
    }
    const initialValues = resolveControlValues(found, currentProps);
    const patch: Partial<SceneElement> = {
      customCodeControls: found,
      customCodeProps: initialValues,
    };
    if (element.customCode) {
      patch.customCode = {
        ...element.customCode,
        controls: found,
        controlValues: initialValues,
      };
    }
    if (element.uiComponentData) {
      patch.uiComponentData = {
        ...element.uiComponentData,
        customControls: found,
        customProps: initialValues,
        ...(initialValues.color ? { color: initialValues.color, accentColor: initialValues.color } : {}),
      };
    }
    onUpdateElement(element.id, patch, '从代码提取控制项');
    showToast?.(`已成功识别 ${found.length} 项可调节属性！`, 'info');
  };

  // AI 智能分析提参：
  // 自定义代码先做本地结构识别，拿到“真实存在、拖动一定生效”的候选参数；
  // AI 只负责给这些 key 起中文名和分组，绝不凭空发明新 key。
  const handleAiExtract = async () => {
    const config = loadLLMConfig();
    const smartPlan = getSmartCustomCodePlan();
    const explicitOnly = Boolean(smartPlan && smartPlan.html === undefined && smartPlan.css === undefined);
    if (smartPlan && explicitOnly) {
      applyCustomCodeControls(smartPlan.controls, undefined, undefined, '应用代码内 @control 参数');
      showToast?.(`代码内已声明 ${smartPlan.controls.length} 项参数，已直接启用`, 'info');
      return;
    }
    const smartCandidates = isCustomCode && smartPlan ? smartPlan.controls : [];
    setIsExtracting(true);
    // 防止第三方 LLM 长时间无响应让面板一直转圈；超时后直接回退本地识别。
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);
    try {
      const payload: Record<string, any> = { config };
      if (isCustomCode && element.customCode) {
        payload.html = element.customCode.html;
        payload.css = element.customCode.css;
        payload.js = element.customCode.js;
        payload.name = element.customCode.name;
        if (smartCandidates.length > 0) {
          // 只把真实 key 交给 AI 命名，服务端会丢弃任何不在候选里的 key。
          payload.candidates = smartCandidates.map((control) => ({
            key: control.key,
            label: control.label,
            type: control.type,
            default: control.default,
            min: control.min,
            max: control.max,
            step: control.step,
            unit: control.unit,
            group: control.group,
          }));
        }
      } else {
        payload.componentType = element.uiComponentType || 'official-modao';
        payload.componentData = element.uiComponentData || {};
        payload.name = element.content || element.sourceName || element.uiComponentType || 'UI组件';
      }

      const response = await fetch(apiUrl('/api/llm/extract-controls'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败 (${response.status})`);
      }

      const data = await response.json();

      if (smartCandidates.length > 0 && smartPlan) {
        const merged = mergeAiControlNaming(smartCandidates, data?.controls);
        const renamedCount = merged.reduce((count, control) => {
          const base = smartCandidates.find((candidate) => candidate.key === control.key);
          const changed = Boolean(base && (base.label !== control.label || base.group !== control.group));
          return count + (changed ? 1 : 0);
        }, 0);
        applyCustomCodeControls(merged, smartPlan.html, smartPlan.css, 'AI 智能识别控制项');
        showToast?.(
          renamedCount > 0
            ? `AI 已为 ${renamedCount} 项真实参数命名，拖动即可生效`
            : `AI 未返回可用命名，已保留本地识别的 ${merged.length} 项参数`,
          'info',
        );
        return;
      }

      if (Array.isArray(data.controls) && data.controls.length > 0) {
        const initialValues = resolveControlValues(data.controls, currentProps);
        const patch: Partial<SceneElement> = {
          customCodeControls: data.controls,
          customCodeProps: initialValues,
        };
        if (element.customCode) {
          patch.customCode = {
            ...element.customCode,
            controls: data.controls,
            controlValues: initialValues,
          };
        }
        if (element.uiComponentData) {
          patch.uiComponentData = {
            ...element.uiComponentData,
            customControls: data.controls,
            customProps: initialValues,
            ...(initialValues.color ? { color: initialValues.color, accentColor: initialValues.color } : {}),
            ...(initialValues.speed !== undefined ? { speed: initialValues.speed } : {}),
            ...(initialValues.enabled !== undefined ? { motionEnabled: Boolean(initialValues.enabled) } : {}),
          };
        }
        onUpdateElement(element.id, patch, 'AI 生成交互控制项');
        showToast?.(`AI 已智能解析并生成 ${data.controls.length} 项调节滑块！`, 'info');
      } else if (smartPlan && isCustomCode) {
        applyCustomCodeControls(smartPlan.controls, smartPlan.html, smartPlan.css, '本地智能识别控制项');
        showToast?.(`AI 未返回命名，已保留本地识别的 ${smartPlan.controls.length} 项参数`, 'info');
      } else {
        // 非自定义代码组件：AI 未提取出特殊参数时，保底应用通用预设。
        handleApplyDefaultPreset();
      }
    } catch {
      if (smartCandidates.length > 0 && smartPlan) {
        // AI 不可用/没配置 Key 时，本地识别结果依然可用，绝不退化成速度/缩放。
        applyCustomCodeControls(smartPlan.controls, smartPlan.html, smartPlan.css, '本地智能识别控制项');
        showToast?.('AI 暂不可用，已用本地结构识别生成真实可调参数', 'info');
      } else {
        handleApplyDefaultPreset();
        showToast?.('未能连接到云端 AI，已自动为您装配通用调节滑块', 'info');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsExtracting(false);
    }
  };

  // 向导式新增调节项（无需填写英文 Key，0门槛）
  const handleAddWizardControl = () => {
    const label = customLabel.trim() || selectedWizardType.label;
    const key = `param_${Date.now().toString(36)}`;
    const newControl: CustomCodeControl = {
      key,
      label,
      type: selectedWizardType.type,
      default: selectedWizardType.default,
      min: selectedWizardType.min,
      max: selectedWizardType.max,
      step: selectedWizardType.step,
      unit: selectedWizardType.unit,
      group: '自定义调节',
    };

    const nextControls = [...controls, newControl];
    const nextProps = { ...currentProps, [key]: selectedWizardType.default };

    const patch: Partial<SceneElement> = {
      customCodeControls: nextControls,
      customCodeProps: nextProps,
    };
    if (element.customCode) {
      patch.customCode = {
        ...element.customCode,
        controls: nextControls,
        controlValues: nextProps,
      };
    }
    if (element.uiComponentData) {
      patch.uiComponentData = {
        ...element.uiComponentData,
        customControls: nextControls,
        customProps: nextProps,
      };
    }

    onUpdateElement(element.id, patch, `添加控制项: ${newControl.label}`);
    setIsAddingControl(false);
    setCustomLabel('');
    showToast?.(`已添加调节项「${label}」`, 'info');
  };

  // 删除单项控制
  const handleDeleteControl = (keyToDelete: string) => {
    const nextControls = controls.filter((c) => c.key !== keyToDelete);
    const nextProps = { ...currentProps };
    delete nextProps[keyToDelete];

    const patch: Partial<SceneElement> = {
      customCodeControls: nextControls,
      customCodeProps: nextProps,
    };
    if (element.customCode) {
      patch.customCode = {
        ...element.customCode,
        controls: nextControls,
        controlValues: nextProps,
      };
    }
    if (element.uiComponentData) {
      patch.uiComponentData = {
        ...element.uiComponentData,
        customControls: nextControls,
        customProps: nextProps,
      };
    }
    onUpdateElement(element.id, patch, `删除控制项: ${keyToDelete}`);
  };

  // 清空重置所有控制项
  const handleClearAllControls = () => {
    const patch: Partial<SceneElement> = {
      customCodeControls: [],
      customCodeProps: {},
    };
    if (element.customCode) {
      patch.customCode = {
        ...element.customCode,
        controls: [],
        controlValues: {},
      };
    }
    if (element.uiComponentData) {
      patch.uiComponentData = {
        ...element.uiComponentData,
        customControls: [],
        customProps: {},
      };
    }
    onUpdateElement(element.id, patch, '重置控制项');
  };

  // Group controls by group name
  const groupedControls = useMemo(() => {
    const groups: Record<string, CustomCodeControl[]> = {};
    for (const ctrl of controls) {
      const groupName = ctrl.group || '通用调节项';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(ctrl);
    }
    return groups;
  }, [controls]);

  return (
    <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-950/15 p-3 text-slate-200 shadow-sm" data-testid="smart-dynamic-controls-panel">
      {/* 头部标题与快捷按钮 */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
          <SlidersHorizontal size={14} className="text-cyan-400" />
          <span>{title || '可视化动态参数调节'}</span>
          {controls.length > 0 && (
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[9px] text-cyan-200 font-mono">
              {controls.length} 项
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {controls.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllControls}
              title="清空当前所有调节项"
              className="flex h-6 items-center gap-1 rounded bg-white/[0.05] hover:bg-red-500/20 hover:text-red-300 px-1.5 text-[10px] text-slate-400 transition-colors"
            >
              <RotateCcw size={10} />
              <span>重置</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddingControl((prev) => !prev)}
            title="添加自定义调节项"
            className="flex h-6 items-center gap-1 rounded bg-white/[0.06] hover:bg-white/[0.12] px-2 text-[10px] text-slate-200 font-medium transition-colors"
          >
            <Plus size={11} className="text-cyan-400" />
            <span>添加</span>
          </button>

          <button
            type="button"
            onClick={handleAiExtract}
            disabled={isExtracting}
            title="利用 AI 智能读懂代码并生成全套中文滑块"
            className="flex h-6 items-center gap-1 rounded bg-gradient-to-r from-violet-600 to-cyan-600 px-2 text-[10px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <Sparkles size={11} className={isExtracting ? 'animate-spin' : ''} />
            <span>{isExtracting ? '正在生成…' : 'AI 生成'}</span>
          </button>
        </div>
      </div>

      {/* 向导式新增调节项（0门槛，无代码填空） */}
      {isAddingControl && (
        <div className="space-y-2.5 rounded-xl border border-cyan-400/40 bg-black/60 p-3 text-xs shadow-md animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-200 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Plus size={13} className="text-cyan-400" />
              <span>选择您想要调节的属性类型</span>
            </span>
            <button type="button" onClick={() => setIsAddingControl(false)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>

          {/* 5 个图形化向导卡片 */}
          <div className="grid grid-cols-5 gap-1">
            {WIZARD_TYPES.map((wt) => {
              const Icon = wt.icon;
              const isSelected = selectedWizardType.id === wt.id;
              return (
                <button
                  key={wt.id}
                  type="button"
                  onClick={() => {
                    setSelectedWizardType(wt);
                    if (!customLabel) setCustomLabel(wt.label);
                  }}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/25 text-white shadow-sm ring-1 ring-cyan-400/40'
                      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon size={14} className={isSelected ? 'text-cyan-300' : 'text-slate-400'} />
                  <span className="text-[10px] mt-1 font-medium">{wt.label}</span>
                </button>
              );
            })}
          </div>

          {/* 自定义名称输入 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>中文名称:</span>
              <span className="text-[10px] text-slate-500">{selectedWizardType.hint}</span>
            </div>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={`如：${selectedWizardType.label}`}
              className="w-full rounded-lg border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsAddingControl(false)}
              className="px-2.5 py-1 rounded-md text-[11px] text-slate-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleAddWizardControl}
              className="px-3 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition-colors shadow-sm"
            >
              立即添加
            </button>
          </div>
        </div>
      )}

      {/* 空状态：三层傻瓜式解药 */}
      {controls.length === 0 ? (
        <div className="space-y-3 py-3 text-center">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-200">当前组件尚未配置调节滑块</p>
            <p className="text-[10px] text-slate-400">
              点击下方任一绿色按钮，1 秒即可拥有像剪映一样的可视化调节滑块：
            </p>
          </div>

          <div className="space-y-2 max-w-xs mx-auto">
            {/* 按钮 1：一键装配常用特效滑块（小白救星） */}
            <button
              type="button"
              onClick={handleApplyDefaultPreset}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/25 via-sky-500/20 to-blue-500/20 hover:from-cyan-500/35 hover:to-blue-500/30 px-3 py-2 text-xs font-bold text-cyan-200 shadow-md transition-all group"
            >
              <Zap size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>⚡ 一键装配常用调节滑块 (推荐小白)</span>
            </button>

            {/* 按钮 2：AI 深度识别 */}
            <button
              type="button"
              onClick={handleAiExtract}
              disabled={isExtracting}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/15 hover:bg-violet-500/25 px-3 py-1.5 text-xs font-medium text-violet-200 transition-all"
            >
              <Sparkles size={13} className={isExtracting ? 'animate-spin text-amber-400' : 'text-violet-400'} />
              <span>{isExtracting ? 'AI 正在解析组件代码…' : '✨ 让 AI 智能分析代码并生成控制项'}</span>
            </button>

            {/* 按钮 3：从源码/组件自动识别 */}
            {(isCustomCode || element.type === 'ui-component') && (
              <button
                type="button"
                onClick={handleScanFromCode}
                className="w-full flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw size={11} />
                <span>从源码/组件自动识别调节参数</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 有调节项时：剪映级极速调节卡片流 */
        <div className="space-y-3 pt-1">
          {Object.entries(groupedControls).map(([groupName, items]) => {
            const isCollapsed = collapsedGroups[groupName];
            return (
              <div key={groupName} className="space-y-2">
                {Object.keys(groupedControls).length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))}
                    className="flex w-full items-center justify-between text-[11px] font-bold text-slate-300 hover:text-white"
                  >
                    <span>{groupName}</span>
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}

                {!isCollapsed && (
                  <div className="space-y-2.5">
                    {items.map((ctrl) => {
                      const val = currentProps[ctrl.key] ?? ctrl.default;
                      const hasUnit = Boolean(ctrl.unit);

                      return (
                        <div
                          key={ctrl.key}
                          className="rounded-xl border border-white/10 bg-black/40 p-2.5 space-y-1.5 hover:border-cyan-400/30 transition-all"
                        >
                          {/* 标签行与删除/绑定 */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                              <span>{ctrl.label}</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              {/* 与 MQTT 全局变量快速绑定 */}
                              {projectVariables.length > 0 && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveBindControlKey((k) => (k === ctrl.key ? null : ctrl.key))
                                    }
                                    title="绑定全局变量 (如 MQTT 实时跳动数据)"
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 transition-colors ${
                                      activeBindControlKey === ctrl.key
                                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50'
                                        : 'bg-white/5 text-slate-400 hover:text-emerald-300 hover:bg-white/10'
                                    }`}
                                  >
                                    <LinkIcon size={9} />
                                    <span>绑定数据</span>
                                  </button>

                                  {activeBindControlKey === ctrl.key && (
                                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-emerald-500/40 bg-slate-900 p-1.5 shadow-xl space-y-1 text-left animate-in fade-in duration-100">
                                      <div className="text-[10px] text-emerald-400 font-bold px-1">
                                        选择要绑定的全局变量:
                                      </div>
                                      <div className="max-h-36 overflow-y-auto space-y-0.5">
                                        {projectVariables.map((pv) => (
                                          <button
                                            key={pv.id}
                                            type="button"
                                            onClick={() => {
                                              handlePropChange(ctrl.key, pv.value);
                                              setActiveBindControlKey(null);
                                              showToast?.(`已将「${ctrl.label}」绑定至变量「${pv.name}」`, 'info');
                                            }}
                                            className="w-full text-left px-1.5 py-1 rounded hover:bg-emerald-500/20 text-[10px] text-slate-200 flex items-center justify-between truncate"
                                          >
                                            <span className="truncate">{pv.name}</span>
                                            <span className="font-mono text-emerald-300 ml-1">{String(pv.value)}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 删除此项 */}
                              <button
                                type="button"
                                onClick={() => handleDeleteControl(ctrl.key)}
                                title="删除此调节项"
                                className="text-slate-500 hover:text-red-400 p-0.5 transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* 滑块类型 */}
                          {(ctrl.type === 'slider' || ctrl.type === 'number') && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const min = ctrl.min ?? 0;
                                    const step = ctrl.step ?? 0.1;
                                    const n = Number(val);
                                    const next = Math.max(min, Number((n - step).toFixed(step < 1 ? 2 : 0)));
                                    handlePropChange(ctrl.key, next);
                                  }}
                                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0"
                                >
                                  -
                                </button>

                                <input
                                  type="range"
                                  min={ctrl.min ?? 0}
                                  max={ctrl.max ?? 100}
                                  step={ctrl.step ?? 1}
                                  value={Number(val)}
                                  onChange={(e) => handlePropChange(ctrl.key, Number(e.target.value))}
                                  className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                                />

                                <button
                                  type="button"
                                  onClick={() => {
                                    const max = ctrl.max ?? 100;
                                    const step = ctrl.step ?? 0.1;
                                    const n = Number(val);
                                    const next = Math.min(max, Number((n + step).toFixed(step < 1 ? 2 : 0)));
                                    handlePropChange(ctrl.key, next);
                                  }}
                                  className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0"
                                >
                                  +
                                </button>

                                <div className="min-w-12 text-right font-mono text-xs font-bold text-cyan-300">
                                  {Number(val)}
                                  {ctrl.unit && <span className="text-[10px] text-slate-400 ml-0.5">{ctrl.unit}</span>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 颜色类型 */}
                          {ctrl.type === 'color' && (
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                {['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#f43f5e', '#ffffff'].map((hex) => (
                                  <button
                                    key={hex}
                                    type="button"
                                    onClick={() => handlePropChange(ctrl.key, hex)}
                                    style={{ backgroundColor: hex }}
                                    className={`w-4 h-4 rounded-full border border-white/20 transition-transform ${
                                      String(val).toLowerCase() === hex ? 'ring-2 ring-white scale-110 shadow-sm' : 'opacity-80 hover:scale-110'
                                    }`}
                                  />
                                ))}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="color"
                                  value={String(val || '#38bdf8')}
                                  onChange={(e) => handlePropChange(ctrl.key, e.target.value)}
                                  className="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/20 p-0"
                                />
                                <span className="font-mono text-[10px] text-slate-300 uppercase">
                                  {String(val || '')}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 开关类型 */}
                          {ctrl.type === 'toggle' && (
                            <div className="flex items-center justify-between pt-0.5">
                              <span className="text-[11px] text-slate-400">
                                {val ? '已开启' : '已停用'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handlePropChange(ctrl.key, !val)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  val ? 'bg-cyan-500' : 'bg-white/15'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    val ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          )}

                          {/* 文本类型 */}
                          {ctrl.type === 'text' && (
                            <div className="pt-0.5">
                              <input
                                type="text"
                                value={String(val ?? '')}
                                onChange={(e) => handlePropChange(ctrl.key, e.target.value)}
                                className="w-full rounded-md border border-white/10 bg-black/60 px-2 py-1 text-xs text-white outline-none focus:border-cyan-400"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
