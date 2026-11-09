import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, Clock, Copy, GitBranch, Plus, Trash2, X,
} from 'lucide-react';
import type {
  ComponentPreset,
  GlobalVariable,
  InteractionCondition,
  InteractionConditionOperator,
  InteractionStep,
  InteractionStepType,
  Scene,
  SceneElement,
} from '../types';

interface InteractionComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: InteractionStep[];
  scenes: Record<string, Scene>;
  variables?: GlobalVariable[];
  components?: ComponentPreset[];
  elements: SceneElement[];
  onSave: (steps: InteractionStep[]) => void;
}

const STEP_OPTIONS: Array<{ value: InteractionStepType; label: string; hint: string }> = [
  { value: 'set-variable', label: '修改变量', hint: '写入一个数据值，供条件判断或绑定使用' },
  { value: 'switch-variant', label: '切换组件状态', hint: '把组件副本切到默认/悬停等状态' },
  { value: 'jump', label: '跳转场景', hint: '跳到另一个场景，并结束后续步骤' },
  { value: 'url', label: '打开网页', hint: '在新窗口打开链接' },
  { value: 'wait', label: '等待', hint: '停顿指定秒数，再继续下一步' },
];

const OPERATOR_OPTIONS: Array<{ value: InteractionConditionOperator; label: string }> = [
  { value: 'equals', label: '等于' },
  { value: 'not-equals', label: '不等于' },
  { value: 'greater', label: '大于' },
  { value: 'less', label: '小于' },
  { value: 'truthy', label: '有值 / 为真' },
  { value: 'falsy', label: '无值 / 为假' },
];

const stepLabel = (type: InteractionStepType) => STEP_OPTIONS.find((option) => option.value === type)?.label || type;

const cloneSteps = (steps: InteractionStep[]): InteractionStep[] => steps.map((step, index) => ({
  ...step,
  id: step.id || `step_${Date.now()}_${index}`,
  delay: Number.isFinite(Number(step.delay)) ? Number(step.delay) : 0,
  condition: step.condition ? { ...step.condition } : undefined,
}));

const newStep = (type: InteractionStepType = 'set-variable'): InteractionStep => ({
  id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  type,
  delay: 0,
});

export const InteractionComposerModal: React.FC<InteractionComposerModalProps> = ({
  isOpen,
  onClose,
  steps,
  scenes,
  variables = [],
  components = [],
  elements,
  onSave,
}) => {
  const [draft, setDraft] = useState<InteractionStep[]>([]);

  useEffect(() => {
    if (isOpen) setDraft(cloneSteps(steps));
    // Reset only when the dialog opens; draft edits must not be replaced by parent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const instances = useMemo(() => (
    elements.filter((element) => element.type === 'group' && element.componentInstance)
  ), [elements]);

  if (!isOpen) return null;

  const updateStep = (id: string, patch: Partial<InteractionStep>) => {
    setDraft((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const updateCondition = (id: string, patch: Partial<InteractionCondition> | null) => {
    setDraft((current) => current.map((step) => {
      if (step.id !== id) return step;
      if (patch === null) return { ...step, condition: undefined };
      const base = step.condition || { variableName: variables[0]?.name || '', operator: 'equals' as const, value: '' };
      return { ...step, condition: { ...base, ...patch } };
    }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    setDraft((current) => {
      const next = current.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const duplicateStep = (index: number) => {
    setDraft((current) => {
      const next = current.slice();
      next.splice(index + 1, 0, { ...current[index], id: newStep().id });
      return next;
    });
  };

  const addStep = () => {
    setDraft((current) => [...current, newStep('set-variable')]);
  };

  const handleSave = () => {
    onSave(draft.filter((step) => Boolean(step.type)));
    onClose();
  };

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0d121c] text-slate-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="交互编排"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <GitBranch size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">交互编排</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">一次触发，按顺序执行多个动作；支持条件、延迟和组件状态切换</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭交互编排">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {draft.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
              <GitBranch size={22} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs text-slate-300">还没有编排步骤</p>
              <p className="mt-1 text-[10px] text-slate-500">点下方「添加步骤」，比如：改数据 → 切状态 → 跳转。</p>
            </div>
          )}

          {draft.map((step, index) => {
            const condition = step.condition;
            const instance = instances.find((element) => element.id === step.componentId);
            const master = components.find((item) => item.id === instance?.componentInstance?.masterId);
            const variants = master?.variants?.length
              ? master.variants
              : [{ id: 'default', name: '默认' }];
            const option = STEP_OPTIONS.find((item) => item.value === step.type);
            return (
              <div key={step.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/15 font-mono text-[10px] font-bold text-cyan-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-white">{stepLabel(step.type)}</div>
                      <div className="truncate text-[9px] text-slate-500">{option?.hint || ''}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="上移步骤">
                      <ArrowUp size={11} />
                    </button>
                    <button type="button" onClick={() => moveStep(index, 1)} disabled={index === draft.length - 1} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="下移步骤">
                      <ArrowDown size={11} />
                    </button>
                    <button type="button" onClick={() => duplicateStep(index)} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white" aria-label="复制步骤">
                      <Copy size={11} />
                    </button>
                    <button type="button" onClick={() => setDraft((current) => current.filter((item) => item.id !== step.id))} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-rose-500/20 hover:text-rose-300" aria-label="删除步骤">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-[10px] text-slate-400">
                    <span className="mb-1 block">动作类型</span>
                    <select
                      aria-label="步骤动作类型"
                      value={step.type}
                      onChange={(event) => updateStep(step.id, { type: event.target.value as InteractionStepType })}
                      className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400"
                    >
                      {STEP_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] text-slate-400">
                    <span className="mb-1 block">执行前等待（秒）</span>
                    <div className="relative">
                      <Clock size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        aria-label="步骤等待时间"
                        type="number"
                        min="0"
                        step="0.1"
                        value={Number(step.delay) || 0}
                        onChange={(event) => updateStep(step.id, { delay: Math.max(0, Number(event.target.value) || 0) })}
                        className="w-full rounded border border-white/10 bg-black/50 pl-6 pr-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400"
                      />
                    </div>
                  </label>
                </div>

                {step.type === 'jump' && (
                  <label className="mt-2 block text-[10px] text-slate-400">
                    <span className="mb-1 block">目标场景</span>
                    <select aria-label="步骤目标场景" value={step.target || ''} onChange={(event) => updateStep(step.id, { target: event.target.value })} className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400">
                      <option value="">-- 选择场景 --</option>
                      {Object.entries(scenes).map(([id, scene]) => <option key={id} value={id}>{scene.alias || id}</option>)}
                    </select>
                  </label>
                )}

                {step.type === 'url' && (
                  <label className="mt-2 block text-[10px] text-slate-400">
                    <span className="mb-1 block">网页地址</span>
                    <input aria-label="步骤网页地址" value={step.url || ''} onChange={(event) => updateStep(step.id, { url: event.target.value })} placeholder="https://example.com" className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" />
                  </label>
                )}

                {step.type === 'set-variable' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-1 block">变量名</span>
                      <input aria-label="步骤变量名" list="interaction-variable-list" value={step.variableName || ''} onChange={(event) => updateStep(step.id, { variableName: event.target.value })} placeholder="如：用户类型" className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" />
                    </label>
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-1 block">写入值</span>
                      <input aria-label="步骤变量值" value={String(step.variableValue ?? '')} onChange={(event) => updateStep(step.id, { variableValue: event.target.value })} placeholder="如：VIP" className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" />
                    </label>
                  </div>
                )}

                {step.type === 'switch-variant' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-1 block">组件副本</span>
                      <select aria-label="步骤组件副本" value={step.componentId || ''} onChange={(event) => updateStep(step.id, { componentId: event.target.value, variantId: '' })} className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400">
                        <option value="">-- 选择副本 --</option>
                        {instances.map((element) => <option key={element.id} value={element.id}>{element.sourceName || element.id}</option>)}
                      </select>
                    </label>
                    <label className="block text-[10px] text-slate-400">
                      <span className="mb-1 block">目标状态</span>
                      <select aria-label="步骤目标状态" value={step.variantId || ''} onChange={(event) => updateStep(step.id, { variantId: event.target.value })} className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-400" disabled={!instance}>
                        <option value="">-- 选择状态 --</option>
                        {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
                      </select>
                    </label>
                  </div>
                )}

                {step.type === 'wait' && (
                  <p className="mt-2 text-[10px] text-slate-500">使用上方「执行前等待」的秒数作为停顿时间。</p>
                )}

                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <label className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><GitBranch size={11} />仅当条件满足时执行</span>
                    <input
                      type="checkbox"
                      checked={Boolean(condition)}
                      onChange={(event) => updateCondition(step.id, event.target.checked ? {} : null)}
                      className="accent-cyan-400"
                    />
                  </label>
                  {condition && (
                    <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <input
                        list="interaction-variable-list"
                        value={condition.variableName || ''}
                        onChange={(event) => updateCondition(step.id, { variableName: event.target.value })}
                        placeholder="变量名"
                        className="min-w-0 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
                      />
                      <select
                        value={condition.operator}
                        onChange={(event) => updateCondition(step.id, { operator: event.target.value as InteractionConditionOperator })}
                        className="rounded border border-white/10 bg-black/50 px-1.5 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
                      >
                        {OPERATOR_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      {condition.operator !== 'truthy' && condition.operator !== 'falsy' ? (
                        <input
                          value={String(condition.value ?? '')}
                          onChange={(event) => updateCondition(step.id, { value: event.target.value })}
                          placeholder="比较值"
                          className="min-w-0 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
                        />
                      ) : <span className="text-[9px] text-slate-500">无需比较值</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-2">
            <button type="button" onClick={addStep} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] py-2 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/10">
              <Plus size={13} /> 添加步骤
            </button>
            <button
              type="button"
              onClick={() => setDraft([
                { ...newStep('set-variable'), variableName: variables[0]?.name || '', variableValue: '1' },
                { ...newStep('switch-variant') },
                { ...newStep('jump') },
              ])}
              className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white"
            >
              插入示例
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={() => { onSave([]); onClose(); }}
            className="text-[10px] text-slate-500 hover:text-rose-300"
          >
            清空编排
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/5">取消</button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-300">保存编排</button>
          </div>
        </div>
      </div>
      <datalist id="interaction-variable-list">
        {variables.map((variable) => <option key={variable.id} value={variable.name} />)}
      </datalist>
    </div>
  );

  return createPortal(modal, document.body);
};
