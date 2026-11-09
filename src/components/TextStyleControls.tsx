import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyStart, AlignVerticalJustifyEnd, WrapText } from 'lucide-react';
import type { SceneElement } from '../types';
import { FontFamilyPicker } from './FontFamilyPicker';
import { measureSnugTextDimensions } from '../utils/typography';

interface TextStyleControlsProps {
  element: SceneElement;
  onUpdateElement: (elId: string, patch: Partial<SceneElement>) => void;
  colorField?: 'color' | 'textColor';
  paddingField?: 'textPadding' | 'shapePadding';
  defaultLineHeight?: number;
}

export const TextStyleControls: React.FC<TextStyleControlsProps> = ({
  element,
  onUpdateElement,
  colorField = 'color',
  paddingField = 'textPadding',
  defaultLineHeight = 1.25,
}) => {
  const textColor = (colorField === 'textColor' ? element.textColor : element.color) || '#ffffff';
  const padding = element[paddingField] ?? (paddingField === 'shapePadding' ? 12 : 6);
  const update = (patch: Partial<SceneElement>) => onUpdateElement(element.id, patch);

  return (
    <div className="space-y-2 rounded border border-sky-400/15 bg-sky-950/10 p-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-slate-400">
          <span className="mb-0.5 block">文字颜色</span>
          <div className="flex gap-1">
            <input type="color" value={textColor.startsWith('#') ? textColor : '#ffffff'} onChange={(e) => update({ [colorField]: e.target.value })} className="h-7 w-8 shrink-0 rounded border border-white/20 bg-transparent" />
            <input value={textColor} onChange={(e) => update({ [colorField]: e.target.value })} className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-1.5 py-1 font-mono text-xs text-white" />
          </div>
        </label>
        <label className="text-[10px] text-slate-400">
          <span className="mb-0.5 flex justify-between">
            <span>字号 (px)</span>
            <span className="flex gap-1 text-[9px] text-sky-400">
              {[16, 24, 32, 48].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update({ fontSize: s })}
                  className="hover:underline opacity-80 hover:opacity-100"
                >
                  {s}
                </button>
              ))}
            </span>
          </span>
          <input type="number" min="8" max="400" value={element.fontSize ?? 32} onChange={(e) => update({ fontSize: Math.max(8, Number(e.target.value) || 32) })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white" />
        </label>
      </div>

      <div className="block text-[10px] text-slate-400">
        <span className="mb-0.5 block">字体</span>
        <FontFamilyPicker value={element.fontFamily} onChange={(fontFamily) => update({ fontFamily })} placeholder="默认字体" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-slate-400"><span className="mb-0.5 block">字间距 (px)</span><input type="number" min="-20" max="80" step="0.5" value={element.letterSpacing ?? 0} onChange={(e) => update({ letterSpacing: Number(e.target.value) || 0 })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white" /></label>
        <label className="text-[10px] text-slate-400"><span className="mb-0.5 block">行间距</span><input type="number" min="0.6" max="4" step="0.05" value={element.lineHeight ?? defaultLineHeight} onChange={(e) => update({ lineHeight: Math.max(0.6, Number(e.target.value) || defaultLineHeight) })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white" /></label>
      </div>
      <label className="block text-[10px] text-slate-400"><span className="mb-0.5 flex justify-between"><span>文字不透明度</span><span>{element.textOpacity ?? 100}%</span></span><input type="range" min="0" max="100" value={element.textOpacity ?? 100} onChange={(e) => update({ textOpacity: Number(e.target.value) })} className="w-full accent-sky-400" /></label>

      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div className="flex rounded border border-white/10 bg-black/30 p-0.5" aria-label="文字样式">
          {(() => {
            const isBold = !element.fontWeight || element.fontWeight === 'bold' || element.fontWeight === '700' || element.fontWeight === '800' || element.fontWeight === '900' || element.fontWeight === '600';
            return (
              <button
                type="button"
                title="粗体"
                onClick={() => update({ fontWeight: isBold ? 'normal' : 'bold' })}
                className={`h-6 flex-1 rounded text-xs font-bold ${isBold ? 'bg-sky-500/25 text-white' : 'text-slate-400'}`}
              >
                B
              </button>
            );
          })()}
          <button type="button" title="斜体" onClick={() => update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`h-6 flex-1 rounded text-xs italic ${element.fontStyle === 'italic' ? 'bg-sky-500/25 text-white' : 'text-slate-400'}`}>I</button>
          <button type="button" title="下划线" onClick={() => update({ textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })} className={`h-6 flex-1 rounded text-xs underline ${element.textDecoration === 'underline' ? 'bg-sky-500/25 text-white' : 'text-slate-400'}`}>U</button>
        </div>
        <label className="text-[10px] text-slate-400"><span className="mb-0.5 block">内边距 (px)</span><input type="number" min="0" max="120" value={padding} onChange={(e) => update({ [paddingField]: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white" /></label>
      </div>

      {/* PPT 级排版对齐控制栏：水平对齐 + 垂直对齐 + 自动折行 */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
        <div>
          <span className="block text-[9px] text-slate-400 mb-1">水平对齐</span>
          <div className="flex gap-0.5 rounded border border-white/10 bg-black/30 p-0.5" aria-label="水平对齐">
            {([['left', AlignLeft, '左对齐'], ['center', AlignCenter, '居中对齐'], ['right', AlignRight, '右对齐']] as const).map(([align, Icon, title]) => (
              <button
                key={align}
                type="button"
                title={title}
                onClick={() => update({ textAlign: align })}
                className={`flex-1 flex h-6 items-center justify-center rounded transition-colors ${
                  element.textAlign === align || (!element.textAlign && align === 'center')
                    ? 'bg-sky-500/30 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={12} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-[9px] text-slate-400 mb-1">垂直对齐 (PPT)</span>
          <div className="flex gap-0.5 rounded border border-white/10 bg-black/30 p-0.5" aria-label="垂直对齐">
            {([['top', AlignVerticalJustifyStart, '顶部对齐'], ['middle', AlignVerticalJustifyCenter, '垂直居中'], ['bottom', AlignVerticalJustifyEnd, '底部对齐']] as const).map(([vAlign, Icon, title]) => (
              <button
                key={vAlign}
                type="button"
                title={title}
                onClick={() => update({ verticalAlign: vAlign })}
                className={`flex-1 flex h-6 items-center justify-center rounded transition-colors ${
                  element.verticalAlign === vAlign || (!element.verticalAlign && vAlign === 'middle')
                    ? 'bg-sky-500/30 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={12} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 文本折行模式与外框贴合 */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
        <span className="flex items-center gap-1"><WrapText size={12} className="text-sky-400" /> 文本框折行模式</span>
        <div className="flex gap-1 rounded border border-white/10 bg-black/30 p-0.5">
          <button
            type="button"
            onClick={() => update({ textWrap: 'wrap' })}
            className={`px-2 py-0.5 rounded text-[10px] ${element.textWrap !== 'nowrap' ? 'bg-sky-500/25 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            自动折行
          </button>
          <button
            type="button"
            onClick={() => update({ textWrap: 'nowrap' })}
            className={`px-2 py-0.5 rounded text-[10px] ${element.textWrap === 'nowrap' ? 'bg-sky-500/25 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            单行展开
          </button>
          <button
            type="button"
            title="按当前文字字号与内容紧密贴合选框（剪映规范）"
            onClick={() => {
              const dims = measureSnugTextDimensions(element.content || '', {
                fontSize: element.fontSize || 32,
                fontFamily: element.fontFamily,
                fontWeight: element.fontWeight,
                letterSpacing: element.letterSpacing,
                lineHeight: element.lineHeight || 1.25,
                textPadding: padding,
              });
              update({ w: dims.w, h: dims.h });
            }}
            className="px-2 py-0.5 rounded text-[10px] text-sky-400 hover:bg-sky-500/20 transition-colors border border-sky-400/20"
          >
            紧凑贴合
          </button>
        </div>
      </div>


      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-cyan-400/15 bg-black/20 p-1.5 text-[10px] text-slate-300"><label className="flex justify-between">发光<input type="checkbox" checked={element.textGlowEnabled || false} onChange={(e) => update({ textGlowEnabled: e.target.checked })} className="accent-cyan-400" /></label>{element.textGlowEnabled && <><input type="color" value={element.textGlowColor || textColor} onChange={(e) => update({ textGlowColor: e.target.value })} className="mt-1 h-6 w-full" /><div className="mt-1 grid grid-cols-2 gap-1"><input type="number" min="0" max="120" value={element.textGlowBlur ?? 24} onChange={(e) => update({ textGlowBlur: Number(e.target.value) || 0 })} className="min-w-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-white" /><input type="number" min="0" max="100" value={element.textGlowIntensity ?? 50} onChange={(e) => update({ textGlowIntensity: Number(e.target.value) || 0 })} className="min-w-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-white" /></div></>}</div>
        <div className="rounded border border-white/10 bg-black/20 p-1.5 text-[10px] text-slate-300"><label className="flex justify-between">阴影<input type="checkbox" checked={element.textShadowEnabled || false} onChange={(e) => update({ textShadowEnabled: e.target.checked })} className="accent-sky-500" /></label>{element.textShadowEnabled && <><input type="color" value={element.textShadowColor || '#000000'} onChange={(e) => update({ textShadowColor: e.target.value })} className="mt-1 h-6 w-full" /><div className="mt-1 grid grid-cols-2 gap-1"><input aria-label="阴影模糊" type="number" min="0" max="120" value={element.textShadowBlur ?? 8} onChange={(e) => update({ textShadowBlur: Number(e.target.value) || 0 })} className="min-w-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-white" /><input aria-label="阴影距离" type="number" min="0" max="100" value={element.textShadowDistance ?? 4} onChange={(e) => update({ textShadowDistance: Number(e.target.value) || 0 })} className="min-w-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-white" /></div><div className="mt-1 grid grid-cols-2 gap-1"><input aria-label="阴影角度" type="number" min="-180" max="180" value={element.textShadowAngle ?? 45} onChange={(e) => update({ textShadowAngle: Number(e.target.value) || 0 })} className="min-w-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-white" /><input aria-label="阴影不透明度" type="number" min="0" max="100" value={element.textShadowOpacity ?? 65} onChange={(e) => update({ textShadowOpacity: Number(e.target.value) || 0 })} className="min-w-0 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-white" /></div></>}</div>
      </div>
    </div>
  );
};
