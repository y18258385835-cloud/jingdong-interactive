import React, { useRef } from 'react';
import { Wand2, Play, Zap, Palette, RefreshCw, Plus, Trash2, Upload } from 'lucide-react';
import { SceneElement, VfxCardContentType, VfxCardItem } from '../types';
import { dbManager } from '../utils/db';
import { createDefaultVfxCards, isCardLayoutMotion } from './CardLayoutVfx';
import {
  VFX_MOTIONS,
  VFX_MOTION_CATEGORIES,
  VFX_COLOR_THEMES,
  VfxColorTheme,
  VfxMotionId,
  getVfxMotion,
} from '../utils/vfxMotions';
import { VfxMotionCanvas } from './VfxMotionCanvas';

interface VfxInspectorProps {
  element: SceneElement;
  onUpdateElement: (elId: string, updater: Partial<SceneElement>) => void;
}

/**
 * 科技简约动效属性面板：类型切换 / 预设配色主题 / 三色自定义 / 速度 / 实时预览
 */
export const VfxInspector: React.FC<VfxInspectorProps> = ({ element, onUpdateElement }) => {
  const cardUploadRef = useRef<HTMLInputElement>(null);
  const motionType = (element.vfxMotionType || 'plasma') as VfxMotionId;
  const colorA = element.vfxColorA || '#22d3ee';
  const colorB = element.vfxColorB || '#a855f7';
  const colorC = element.vfxColorC || colorA;
  const speed = element.vfxSpeed !== undefined ? element.vfxSpeed : 1;
  const current = getVfxMotion(motionType);
  const isCardLayout = isCardLayoutMotion(motionType);
  const cards = element.vfxCards?.length ? element.vfxCards : createDefaultVfxCards();
  const selectedCardId = element.vfxCardSelectedId || cards[0]?.id;

  const patch = (updater: Partial<SceneElement>) =>
    onUpdateElement(element.id, updater);

  const pickMotion = (id: VfxMotionId) => {
    const def = getVfxMotion(id);
    patch({ vfxMotionType: id });
    // 切换动效时重置为该动效的参数默认值（MetalForge 风格：每个 effect 独立参数）
    if (def.params && def.params.length) {
      const dv: Record<string, number | string> = {};
      def.params.forEach((p) => { dv[p.key] = p.def; });
      patch({ vfxParams: dv });
    } else {
      patch({ vfxParams: undefined });
    }
    // 未手动改过配色时，使用该动效的默认配色（含第三色）
    if (!element.vfxColorA && !element.vfxColorB && !element.vfxColorC) {
      patch({ vfxColorA: def.colorA, vfxColorB: def.colorB, vfxColorC: def.colorC });
    }
    if (isCardLayoutMotion(id) && !element.vfxCards?.length) {
      const initialCards = createDefaultVfxCards();
      patch({ vfxCards: initialCards, vfxCardSelectedId: initialCards[0].id });
    }
  };

  const updateCard = (cardId: string, updater: Partial<VfxCardItem>) => {
    patch({ vfxCards: cards.map((card) => card.id === cardId ? { ...card, ...updater } : card) });
  };
  const detectCardType = (file: File): VfxCardContentType => {
    const name = file.name.toLowerCase();
    if (/\.(glb|gltf)$/.test(name)) return 'model-3d';
    if (/\.(ply|splat)$/.test(name)) return 'gaussian-splat';
    const panorama = /(pano|panorama|360|equirect)/.test(name);
    if (file.type.startsWith('video/')) return panorama ? 'panorama-video' : 'video';
    if (file.type.startsWith('image/')) return panorama ? 'panorama' : 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  };
  const uploadCardFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const cardId = selectedCardId;
    event.target.value = '';
    if (!file || !cardId) return;
    const refId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const type = detectCardType(file);
    await dbManager.put(refId, file);
    const kind: 'image' | 'video' | 'audio' | '3d' | 'gaussian-splat' | 'panorama' | 'panorama-video' | 'other' = type === 'model-3d' ? '3d' : type === 'file' || type === 'text' ? 'other' : type;
    await dbManager.setMetadata({ key: refId, name: file.name, originalName: file.name, kind, importedAt: Date.now(), source: 'local-file' });
    updateCard(cardId, { title: file.name, type, assetRef: refId, text: undefined });
  };

  // 应用配色主题（一键三色切换，仿 Saber 光剑 Style Themes）
  const applyTheme = (theme: VfxColorTheme) => {
    patch({ vfxColorA: theme.colorA, vfxColorB: theme.colorB, vfxColorC: theme.colorC || theme.colorA });
  };

  const themeSwatch = (t: VfxColorTheme) =>
    `linear-gradient(135deg, ${t.colorA} 0%, ${t.colorB} 50%, ${t.colorC || t.colorA} 100%)`;

  return (
    <div className="space-y-3">
      {/* 实时预览（透明棋盘格背景，直观展示动效透明无黑边） */}
      <div
        className="relative h-32 rounded-xl overflow-hidden border border-white/10"
        style={{
          backgroundColor: '#1a1e28',
          backgroundImage:
            'linear-gradient(45deg, #232833 25%, transparent 25%, transparent 75%, #232833 75%), linear-gradient(45deg, #232833 25%, transparent 25%, transparent 75%, #232833 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 8px 8px',
        }}
      >
        <VfxMotionCanvas
          motionType={motionType}
          colorA={colorA}
          colorB={colorB}
          colorC={colorC}
          speed={speed}
          params={element.vfxParams}
          cards={element.vfxCards}
          selectedCardId={element.vfxCardSelectedId}
          cardSelectionActive={element.vfxCardSelectionActive}
          onSelectCard={(id) => patch({ vfxCardSelectedId: id, vfxCardSelectionActive: true })}
          maxRes={220}
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] text-white/80 bg-black/50 rounded px-2 py-0.5 pointer-events-none">
          <Play size={9} className="fill-current text-emerald-400" />
          实时播放 · 鼠标可交互
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-white/90 bg-black/50 rounded px-2 py-0.5 pointer-events-none">
          <Wand2 size={9} className="text-fuchsia-300" />
          {current.icon} {current.name}
        </div>
      </div>

      {isCardLayout && (
        <div className="space-y-2 border-y border-white/10 py-3">
          <input ref={cardUploadRef} type="file" className="hidden" onChange={uploadCardFile} />
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-medium text-slate-400">卡片内容</label>
            <div className="flex items-center gap-1">
              <button type="button" title="新增卡片" aria-label="新增卡片" onClick={() => { const item: VfxCardItem = { id: `card_${Date.now()}`, title: `卡片 ${cards.length + 1}`, type: 'text', text: '输入文案', scale: 1 }; patch({ vfxCards: [...cards, item], vfxCardSelectedId: item.id }); }} className="grid h-6 w-6 place-items-center rounded border border-white/10 text-cyan-300 hover:bg-cyan-400/10"><Plus size={13} /></button>
              <button type="button" title="删除当前卡片" aria-label="删除当前卡片" disabled={cards.length <= 1} onClick={() => { const next = cards.filter((card) => card.id !== selectedCardId); patch({ vfxCards: next, vfxCardSelectedId: next[0]?.id }); }} className="grid h-6 w-6 place-items-center rounded border border-white/10 text-slate-400 hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
            {cards.map((card, index) => <button key={card.id} type="button" onClick={() => patch({ vfxCardSelectedId: card.id, vfxCardSelectionActive: true })} className={`h-7 min-w-7 rounded border px-1.5 text-[9px] ${card.id === selectedCardId ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>{index + 1}</button>)}
          </div>
          {cards.filter((card) => card.id === selectedCardId).map((card) => <div key={card.id} className="space-y-1.5">
            <input value={card.title} onChange={(event) => updateCard(card.id, { title: event.target.value })} maxLength={120} aria-label="卡片标题" className="h-7 w-full rounded border border-white/10 bg-black/20 px-2 text-[10px] text-white outline-none focus:border-cyan-300/60" placeholder="卡片标题" />
            {card.type === 'text' ? <textarea value={card.text || ''} onChange={(event) => updateCard(card.id, { text: event.target.value })} maxLength={4000} rows={2} aria-label="卡片文案" className="w-full resize-y rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-cyan-300/60" placeholder="输入文案" /> : <div className="truncate rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-slate-400">{card.type} · {card.title}</div>}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400"><label htmlFor={`card-scale-${card.id}`}>卡片大小</label><output className="font-mono text-cyan-200">{Math.round((card.scale ?? 1) * 100)}%</output></div>
              <input id={`card-scale-${card.id}`} type="range" min="0.4" max="2.5" step="0.05" value={card.scale ?? 1} onChange={(event) => updateCard(card.id, { scale: Number(event.target.value) })} aria-label={`${card.title} 卡片大小`} className="h-5 w-full cursor-pointer accent-cyan-400" />
            </div>
            <button type="button" onClick={() => cardUploadRef.current?.click()} className="flex h-7 w-full items-center justify-center gap-1 rounded border border-white/10 text-[10px] text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"><Upload size={12} />上传或替换素材</button>
          </div>)}
          <p className="text-[9px] leading-4 text-slate-500">文案直接编辑；上传可识别图片、视频、全景、GLB/GLTF、PLY/SPLAT、音频及其他文件，并保存至现有素材库。</p>
        </div>
      )}

      {/* 预设配色主题（仿 MetalForge，一键切换） */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
            <Palette size={12} className="text-fuchsia-400" />
            <span>配色主题 (MetalForge Style Themes)</span>
          </label>
          <button
            type="button"
            onClick={() => {
              patch({ vfxColorA: current.colorA, vfxColorB: current.colorB, vfxColorC: current.colorC });
            }}
            title="恢复当前动效默认配色"
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1.5 py-0.5 transition-colors"
          >
            <RefreshCw size={9} />
            默认
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {VFX_COLOR_THEMES.map((t) => {
            const isActive =
              (colorA.toLowerCase() === t.colorA.toLowerCase() && colorB.toLowerCase() === t.colorB.toLowerCase()) ||
              (colorA.toLowerCase() === t.colorA.toLowerCase() && colorB.toLowerCase() === t.colorB.toLowerCase() && colorC.toLowerCase() === (t.colorC || t.colorA).toLowerCase());
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTheme(t)}
                title={t.desc}
                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/15 border-fuchsia-400 text-white ring-1 ring-fuchsia-400/40 font-semibold'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/25 text-slate-300'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                  style={{ background: themeSwatch(t), boxShadow: `0 0 8px ${t.colorA}66` }}
                />
                <span className="text-[10px] truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 类型切换（按分类分组） */}
      <div>
        <label className="block text-[10px] text-slate-400 mb-1 font-medium">动效类型 (MOTION)</label>
        <div className="space-y-1.5">
          {VFX_MOTION_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
            const items = VFX_MOTIONS.filter((m) => m.category === cat.id && !isCardLayoutMotion(m.id));
            if (!items.length) return null;
            return (
              <div key={cat.id}>
                <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {items.map((m) => {
                    const active = motionType === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMotion(m.id)}
                        className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 border transition-all cursor-pointer ${
                          active
                            ? 'bg-fuchsia-500/20 border-fuchsia-400/50 text-white shadow-sm'
                            : 'border-white/10 text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-sm leading-none">{m.icon}</span>
                        <span className="text-[9px] leading-tight text-center truncate w-full">
                          {m.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 三色自定义配色 */}
      <div>
        <label className="block text-[10px] text-slate-400 mb-1.5 font-medium">自定义配色 (COLORS)</label>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorA}
                onChange={(e) => patch({ vfxColorA: e.target.value })}
                className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-[9px] text-slate-500">主色</div>
                <div className="text-[10px] text-white font-mono truncate">{colorA}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorB}
                onChange={(e) => patch({ vfxColorB: e.target.value })}
                className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-[9px] text-slate-500">副色</div>
                <div className="text-[10px] text-white font-mono truncate">{colorB}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorC}
              onChange={(e) => patch({ vfxColorC: e.target.value })}
              className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
            />
            <div className="min-w-0">
              <div className="text-[9px] text-slate-500">第三色 / 大气色（点阵地球大气 · 等离子中间色）</div>
              <div className="text-[10px] text-white font-mono truncate">{colorC}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 动效参数（MetalForge 风格参数面板，按 MOTION/SHAPE/LIGHT/GRADE/EDGE 分组，仅当该动效定义了 params schema） */}
      {current.params && current.params.length > 0 && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-1.5 font-medium">动效参数 (PARAMS · MetalForge 风格)</label>
          {(() => {
            // 按 group 分组渲染（保持参数定义顺序，无 group 归入 PARAMS）
            const order: string[] = [];
            const groups: { name: string; items: typeof current.params }[] = [];
            current.params.forEach((p) => {
              const g = p.group || 'PARAMS';
              if (!order.includes(g)) {
                order.push(g);
                groups.push({ name: g, items: [] });
              }
              groups[order.indexOf(g)].items.push(p);
            });
            return (
              <div className="space-y-2.5">
                {groups.map((grp) => (
                  <div key={grp.name}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-bold tracking-wider text-fuchsia-300/90">{grp.name}</span>
                      <span className="flex-1 h-px bg-gradient-to-r from-fuchsia-400/40 to-transparent" />
                    </div>
                    <div className="space-y-1.5">
                      {grp.items.map((p) => {
                        const rawVal = element.vfxParams?.[p.key] ?? p.def;
                        if (p.type === 'color') {
                          return (
                            <div key={p.key}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] text-slate-300">{p.label}</span>
                                <span className="text-[10px] text-white font-mono uppercase">{String(rawVal)}</span>
                              </div>
                              <input
                                type="color"
                                value={String(rawVal)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  patch({ vfxParams: { ...(element.vfxParams || {}), [p.key]: v } });
                                }}
                                className="w-full h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                              />
                            </div>
                          );
                        }
                        const val = Number(rawVal);
                        return (
                          <div key={p.key}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-slate-300">{p.label}</span>
                              <span className="text-[10px] text-white font-mono">{val.toFixed(p.step >= 1 ? 0 : 2)}</span>
                            </div>
                            <input
                              type="range"
                              min={p.min}
                              max={p.max}
                              step={p.step}
                              value={val}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                patch({ vfxParams: { ...(element.vfxParams || {}), [p.key]: v } });
                              }}
                              className="w-full accent-fuchsia-400"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* 速度 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-400 font-medium">播放速度</label>
          <span className="text-[10px] text-white font-mono">{speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={speed}
          onChange={(e) => patch({ vfxSpeed: parseFloat(e.target.value) })}
          className="w-full accent-fuchsia-400"
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2">
        <Zap size={12} className="text-cyan-300 mt-0.5 shrink-0" />
        <p className="text-[10px] text-cyan-100/80 leading-relaxed">
          动效配色主题借鉴 MetalForge 像素着色器配色，可一键切换或自定义主 / 副 / 大气三色。拖入画布后持续自动播放，鼠标悬停可交互（扰动 / 跟随 / 波源）。
        </p>
      </div>
    </div>
  );
};
