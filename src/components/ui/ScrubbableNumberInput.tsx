import React, { useRef, useState, useEffect, useCallback } from 'react';
import { calculateScrubDelta, clampAndRoundScrubValue } from '../../utils/scrubMath';

export interface ScrubbableNumberInputProps {
  label: React.ReactNode;
  value: number | undefined | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  title?: string;
  dragSpeed?: number;
  'data-testid'?: string;
}

export const ScrubbableNumberInput: React.FC<ScrubbableNumberInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  precision = 1,
  unit = '',
  disabled = false,
  className = '',
  labelClassName = '',
  inputClassName = '',
  title,
  dragSpeed = 1,
  'data-testid': testId,
}) => {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(numericValue));
  const dragStartRef = useRef<{ startX: number; startValue: number }>({ startX: 0, startValue: 0 });

  // Sync draft value when not editing
  useEffect(() => {
    if (!isEditing && !isDragging) {
      const rounded = Number(numericValue.toFixed(precision));
      setDraftValue(String(rounded));
    }
  }, [numericValue, isEditing, isDragging, precision]);

  const clampAndRound = useCallback(
    (val: number) => clampAndRoundScrubValue(val, { min, max, precision }),
    [min, max, precision]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startValue: numericValue,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const delta = calculateScrubDelta(dx, {
        step,
        dragSpeed,
        shiftKey: moveEvent.shiftKey,
        altKey: moveEvent.altKey,
      });
      const next = clampAndRound(dragStartRef.current.startValue + delta);
      onChange(next);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftValue(e.target.value);
  };

  const commitDraft = () => {
    setIsEditing(false);
    const parsed = parseFloat(draftValue);
    if (!Number.isNaN(parsed)) {
      onChange(clampAndRound(parsed));
    } else {
      setDraftValue(String(numericValue));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDraft();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setDraftValue(String(numericValue));
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      onChange(clampAndRound(numericValue + step * mult));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      onChange(clampAndRound(numericValue - step * mult));
    }
  };

  return (
    <div
      data-testid={testId || 'scrubbable-number-input'}
      className={`group/scrub relative flex items-center h-7 rounded border transition-all duration-150 ${
        isDragging
          ? 'border-sky-400/80 bg-sky-500/10 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
          : 'border-white/[0.08] bg-[#0d1117] hover:border-white/20 hover:bg-[#161b22]'
      } ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
      title={title || '拖拽标签平滑微调 (按住 Shift 加速10倍 / Alt 精细0.1倍)'}
    >
      {/* Scrubbable Drag Label */}
      <span
        onPointerDown={handlePointerDown}
        className={`flex items-center justify-center shrink-0 h-full px-2 text-[10px] font-medium tracking-wide text-slate-400 select-none cursor-ew-resize transition-colors group-hover/scrub:text-sky-300 ${
          isDragging ? 'text-sky-300 font-semibold' : ''
        } ${labelClassName}`}
      >
        {label}
      </span>

      {/* Numerical Value Input */}
      <input
        type="text"
        inputMode="decimal"
        value={isEditing ? draftValue : String(Number(numericValue.toFixed(precision)))}
        disabled={disabled}
        onFocus={() => setIsEditing(true)}
        onBlur={commitDraft}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className={`w-full h-full bg-transparent px-1.5 font-mono text-[11px] text-slate-200 outline-none text-right placeholder-slate-600 focus:text-white ${inputClassName}`}
      />

      {/* Optional Unit suffix */}
      {unit && (
        <span className="shrink-0 pr-1.5 text-[9px] font-mono text-slate-500 select-none pointer-events-none">
          {unit}
        </span>
      )}
    </div>
  );
};
