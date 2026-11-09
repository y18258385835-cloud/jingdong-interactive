import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../core/api/url';
import { Boxes, Download, FileUp, Layers3, Plug, Radio, Search, Settings, Sparkles, Trash2, UserRound, WandSparkles, Wifi, WifiOff, X } from 'lucide-react';
import { GalaxyComponentRenderer } from './ui/GalaxyComponents';
import { getChatEndpoint, getProvider, LLM_PROVIDERS } from '../utils/llmProviders';
import { getOfficialPluginRealtimeMapping, OFFICIAL_PLUGIN_REGISTRY, type OfficialPluginCategory, type OfficialPluginDefinition } from '../plugins/registry';
import { createAiPlugin, createAiPluginFromDraft, loadUserPlugins, PLUGIN_STYLES, saveUserPlugins, validatePluginDefinition, withRealtimeBinding, type AiPluginDraft, type PluginStyleId } from '../plugins/pluginStudio';
import { loadLLMConfig, saveLLMConfig, type LLMApiConfig } from './LLMApiConfigPanel';
import { useMockTelemetrySignal } from '../core/realtime/mockTelemetry';
import { useRealtimeTelemetrySignal } from '../core/realtime/realtimeTelemetry';
import { PLUGIN_DRAG_ID_MIME, PLUGIN_DRAG_MIME, serializePluginDrag } from '../plugins/dragPayload';

interface PluginCenterPanelProps { onInsert: (plugin: OfficialPluginDefinition) => void; showHeader?: boolean; }
type CenterTab = 'official' | 'ai' | 'mine';
const categories: Array<'全部' | OfficialPluginCategory> = ['全部', '核心指标', '趋势分析', '状态告警', '筛选联动', '地图空间', '设备资产'];
const readPath = (source: Record<string, any>, path?: string): any => path?.split(/[.[\]]+/).filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], source);

function previewData(plugin: OfficialPluginDefinition, source: Record<string, any>, mode: 'mock' | 'mqtt') {
  const mapping = getOfficialPluginRealtimeMapping(plugin);
  const sample = plugin.sample as Record<string, any>;
  return {
    ...sample, ...source,
    dataBinding: { sourceId: mode === 'mqtt' ? 'mqtt.realtime' : 'mock.telemetry', refresh: 'realtime', mapping },
    value: readPath(source, mapping.value) ?? sample.value,
    label: readPath(source, mapping.label) ?? sample.label ?? sample.title,
    unit: readPath(source, mapping.unit) ?? sample.unit,
    content: readPath(source, mapping.content) ?? sample.content,
    series: readPath(source, mapping.series) ?? source.series ?? sample.series,
    items: readPath(source, mapping.items) ?? source.items ?? sample.items,
    rows: readPath(source, mapping.rows) ?? source.rows ?? sample.rows,
    location: readPath(source, mapping.location) ?? source.location ?? sample.location,
    topology: readPath(source, mapping.topology) ?? source.topology ?? sample.topology,
  };
}

export const PluginCenterPanel: React.FC<PluginCenterPanelProps> = ({ onInsert, showHeader = true }) => {
  const [tab, setTab] = useState<CenterTab>('official');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('全部');
  const [selectedId, setSelectedId] = useState(OFFICIAL_PLUGIN_REGISTRY[0]?.id || '');
  const [previewMode, setPreviewMode] = useState<'mock' | 'mqtt'>('mock');
  const [userPlugins, setUserPlugins] = useState<OfficialPluginDefinition[]>(loadUserPlugins);
  const [aiPrompt, setAiPrompt] = useState('生产线实时能耗');
  const [aiStyle, setAiStyle] = useState<PluginStyleId>('control-room');
  const [aiType, setAiType] = useState<OfficialPluginDefinition['componentType']>('metric-card');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showModelSetup, setShowModelSetup] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [llmConfig, setLlmConfig] = useState<LLMApiConfig>(loadLLMConfig);
  const fileRef = useRef<HTMLInputElement>(null);
  const mockSignal = useMockTelemetrySignal(true);
  const mqttSignal = useRealtimeTelemetrySignal(previewMode === 'mqtt', 'mqtt.realtime');
  const visiblePlugins = useMemo(() => {
    const source = tab === 'mine' ? userPlugins : OFFICIAL_PLUGIN_REGISTRY;
    return source.filter((plugin) => {
      const keywords = `${plugin.name} ${plugin.description} ${plugin.tags.join(' ')}`.toLowerCase();
      return (tab === 'mine' || category === '全部' || plugin.category === category) && (!query.trim() || keywords.includes(query.trim().toLowerCase()));
    });
  }, [category, query, tab, userPlugins]);
  const selected = visiblePlugins.find((plugin) => plugin.id === selectedId) || visiblePlugins[0];
  const signal = previewMode === 'mqtt' ? mqttSignal : mockSignal;

  useEffect(() => {
    if (visiblePlugins.length && !visiblePlugins.some((plugin) => plugin.id === selectedId)) setSelectedId(visiblePlugins[0].id);
  }, [selectedId, visiblePlugins]);

  const savePlugins = (next: OfficialPluginDefinition[]) => { setUserPlugins(next); saveUserPlugins(next); };
  const savePlugin = (plugin: OfficialPluginDefinition) => {
    savePlugins([...userPlugins.filter((item) => item.id !== plugin.id), plugin]);
    setSelectedId(plugin.id);
    setTab('mine');
  };
  const updateModel = (next: LLMApiConfig) => { setLlmConfig(next); saveLLMConfig(next); };
  const importPlugin = (file?: File) => {
    if (!file) return;
    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = validatePluginDefinition(JSON.parse(String(reader.result)));
        if (result.ok === false) { setUploadError(result.error); return; }
        savePlugin(withRealtimeBinding(result.plugin));
        setShowImport(false);
      } catch { setUploadError('无法读取此 JSON 文件'); }
    };
    reader.readAsText(file);
  };
  const generateLocal = () => savePlugin(withRealtimeBinding(createAiPlugin(aiPrompt, aiStyle, aiType)));
  const generateWithModel = async () => {
    const endpoint = getChatEndpoint(llmConfig.providerId, llmConfig.customEndpoint);
    if (!llmConfig.apiKey.trim() || !endpoint || !llmConfig.model.trim()) {
      setAiError('先点“连接我的模型”，填入 API Key 和模型名称。');
      setShowModelSetup(true);
      return;
    }
    setAiGenerating(true);
    setAiError('');
    try {
      const styleName = PLUGIN_STYLES.find((style) => style.id === aiStyle)?.name || '控制室';
      const response = await fetch(apiUrl('/api/llm/plugin-generate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: llmConfig.apiKey, endpoint, model: llmConfig.model, prompt: aiPrompt, styleName, componentType: aiType }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || '模型未生成有效组件');
      savePlugin(withRealtimeBinding(createAiPluginFromDraft(aiPrompt, aiStyle, aiType, data.draft as AiPluginDraft)));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setAiGenerating(false);
    }
  };
  const selectProvider = (providerId: string) => {
    const provider = getProvider(providerId);
    updateModel({ ...llmConfig, providerId, model: provider?.defaultModel || '', customEndpoint: providerId === 'custom' ? llmConfig.customEndpoint : undefined });
  };
  const removeSelected = () => {
    if (!selected || selected.source === 'official' || OFFICIAL_PLUGIN_REGISTRY.some((plugin) => plugin.id === selected.id)) return;
    savePlugins(userPlugins.filter((plugin) => plugin.id !== selected.id));
    setSelectedId(userPlugins[0]?.id || OFFICIAL_PLUGIN_REGISTRY[0]?.id || '');
  };
  const navigation = <nav className={`${showHeader ? '' : 'mx-3 '}mt-3 grid shrink-0 grid-cols-3 gap-1 rounded-md bg-black/20 p-1`} aria-label="物联网组件入口">{([['official', '浏览组件', Boxes], ['ai', 'AI 创建', WandSparkles], ['mine', '我的库', UserRound]] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={`flex h-8 items-center justify-center gap-1.5 rounded text-[10px] transition ${tab === value ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/30' : 'text-slate-500 hover:text-slate-200'}`}><Icon size={13} />{label}</button>)}</nav>;

  const renderPluginCard = (plugin: OfficialPluginDefinition) => {
    const isSelected = selected?.id === plugin.id;
    const sourceLabel = plugin.source === 'ai' ? 'AI' : plugin.source === 'community' ? '我的' : '官方';
    return <button
      key={plugin.id}
      type="button"
      draggable={plugin.status === 'installed'}
      onClick={() => setSelectedId(plugin.id)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(PLUGIN_DRAG_ID_MIME, plugin.id);
        event.dataTransfer.setData(PLUGIN_DRAG_MIME, serializePluginDrag(plugin));
      }}
      className={`plugin-component-card ${isSelected ? 'is-selected' : ''}`}
      aria-pressed={isSelected}
    >
      <span className="plugin-component-source">{sourceLabel}</span>
      <div className="plugin-component-preview">
        <div><GalaxyComponentRenderer type={plugin.componentType} data={previewData(plugin, signal, previewMode)} /></div>
      </div>
      <div className="plugin-component-meta">
        <span className="plugin-component-name" title={plugin.name}>{plugin.name}</span>
        <span className="plugin-component-description" title={plugin.description}>{plugin.description}</span>
      </div>
    </button>;
  };

  return <div className="plugin-center flex h-full min-h-0 flex-col overflow-hidden bg-[#11151d] text-slate-200">
    <style>{`
      .plugin-center { position: relative; isolation: isolate; background: #080c13; font-variant-numeric: tabular-nums; }
      .official-components-window[data-source="iot"] .official-components-search { display: none; }
      .plugin-center::before { content: ''; position: absolute; inset: 0; z-index: -1; opacity: .42; pointer-events: none; background-image: linear-gradient(rgba(89, 222, 255, .035) 1px, transparent 1px), linear-gradient(90deg, rgba(89, 222, 255, .025) 1px, transparent 1px); background-size: 22px 22px; mask-image: linear-gradient(to bottom, black, transparent 68%); }
      .plugin-center > * { position: relative; z-index: 1; }
      .plugin-center > header { background: linear-gradient(145deg, #111c28 0%, #0b1019 52%, #090d14 100%); box-shadow: inset 0 -1px rgba(119, 224, 255, .09), 0 10px 28px rgba(0, 0, 0, .18); }
      .plugin-center > header > div:first-child > div:first-child > div:first-child { box-shadow: inset 0 1px rgba(165, 243, 252, .2), 0 7px 16px rgba(8, 145, 178, .16); transform: perspective(90px) rotateX(2deg); }
      .plugin-center nav { background: rgba(2, 6, 12, .54); border: 1px solid rgba(148, 163, 184, .09); box-shadow: inset 0 1px rgba(255,255,255,.035); }
      .plugin-center nav button { border: 1px solid transparent; text-shadow: 0 1px rgba(0,0,0,.55); transition: transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
      .plugin-center nav button:hover { transform: translateY(-1px); border-color: rgba(103, 232, 249, .24); background: rgba(34, 211, 238, .08); }
      .plugin-center .plugin-component-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .plugin-center .plugin-component-card { position: relative; min-width: 0; overflow: hidden; padding: 0; color: #86a8b9; border: 1px solid rgba(125, 211, 252, .14); border-radius: 8px; background: linear-gradient(145deg, rgba(11, 32, 50, .94), rgba(9, 26, 42, .9)); box-shadow: inset 0 1px rgba(255,255,255,.045), 0 5px 12px rgba(0,0,0,.15); text-align: left; animation: plugin-card-in 300ms both; transform: translateZ(0); transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease; }
      .plugin-center .plugin-component-card::after { content: ''; position: absolute; inset: 0 auto 0 0; width: 2px; background: linear-gradient(#67e8f9, rgba(34, 211, 238, .05)); opacity: .38; }
      .plugin-center .plugin-component-card:hover, .plugin-center .plugin-component-card.is-selected { color: #e1f8ff; border-color: rgba(103, 232, 249, .64); background: linear-gradient(145deg, rgba(14, 44, 64, .98), rgba(11, 32, 50, .94)); box-shadow: inset 0 1px rgba(207, 250, 254, .11), 0 12px 20px rgba(0,0,0,.28), 0 0 20px rgba(34,211,238,.08); transform: translateY(-2px); }
      .plugin-center .plugin-component-preview { position: relative; display: grid; place-items: center; height: 104px; overflow: hidden; border-bottom: 1px solid rgba(125, 211, 252, .14); background: radial-gradient(circle at 50% 25%, rgba(65,221,255,.1), transparent 62%), #0b1d2d; }
      .plugin-center .plugin-component-preview::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, rgba(255,255,255,.06), transparent 34%); }
      .plugin-center .plugin-component-preview > div { transform: scale(.32); transform-origin: center; pointer-events: none; }
      .plugin-center .plugin-component-meta { min-width: 0; padding: 8px 9px 9px; }
      .plugin-center .plugin-component-name { display: block; overflow: hidden; color: #e4f7fb; font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
      .plugin-center .plugin-component-description { display: block; overflow: hidden; margin-top: 3px; color: #6f8fa1; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
      .plugin-center .plugin-component-source { position: absolute; top: 7px; right: 7px; z-index: 2; padding: 3px 5px; color: #09202a; border-radius: 4px; background: #8de7a9; font-size: 8px; font-weight: 700; }
      @media (max-width: 900px) { .plugin-center .plugin-component-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .plugin-center .plugin-component-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } .plugin-center .plugin-component-preview { height: 92px; } .plugin-center .plugin-component-preview > div { transform: scale(.28); } }
      .plugin-center footer { background: linear-gradient(160deg, rgba(13, 25, 38, .98), rgba(7, 11, 18, .98)); box-shadow: inset 0 1px rgba(255,255,255,.055), 0 -10px 24px rgba(0,0,0,.18); }
      .plugin-center footer > div:nth-child(2) { background: radial-gradient(circle at 50% 110%, rgba(34,211,238,.13), transparent 58%), #070d15; box-shadow: inset 0 1px rgba(165,243,252,.07); }
      .plugin-center footer > button { box-shadow: inset 0 1px rgba(255,255,255,.34), 0 5px 0 #0e7490, 0 9px 18px rgba(8,145,178,.22); transition: transform 160ms ease, box-shadow 160ms ease; }
      .plugin-center footer > button:hover { transform: translateY(-1px); box-shadow: inset 0 1px rgba(255,255,255,.42), 0 6px 0 #0e7490, 0 13px 22px rgba(8,145,178,.28); }
      @keyframes plugin-card-in { from { opacity: 0; transform: perspective(720px) rotateX(-4deg) translateY(7px); } to { opacity: 1; transform: perspective(720px) rotateX(0deg) translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .plugin-center *, .plugin-center *::before, .plugin-center *::after { animation: none !important; transition: none !important; transform: none !important; } }
    `}</style>
    {showHeader && <header className="shrink-0 border-b border-white/10 bg-[#0d1118] px-3 py-3">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><Plug size={16} /></div><div><h2 className="text-xs font-semibold text-white">物联网组件</h2><p className="text-[10px] text-slate-500">选一个，直接变成实时图层</p></div></div><span className="flex items-center gap-1 text-[9px] text-emerald-300"><Radio size={10} /> MQTT 已就绪</span></div>
      {navigation}
    </header>}
    {!showHeader && navigation}

    {tab === 'ai' ? <main className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-md"><div className="mb-4"><h3 className="text-sm font-semibold text-white">说出你要展示什么</h3><p className="mt-1 text-[10px] text-slate-500">AI 会生成安全组件，并自动绑定 MQTT 数据。</p></div>
        <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={4} placeholder="例如：显示冷却回路压力、状态和异常趋势" className="w-full resize-none rounded-md border border-white/10 bg-black/25 p-3 text-[12px] leading-5 text-white outline-none focus:border-cyan-400/60" />
        <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">展示方式<select value={aiType} onChange={(event) => setAiType(event.target.value as OfficialPluginDefinition['componentType'])} className="mt-1 h-9 w-full rounded-md border border-white/10 bg-[#0d1118] px-2 text-[11px] text-white"><option value="metric-card">数值卡片</option><option value="gauge">仪表盘</option><option value="trend-line">趋势图</option><option value="progress-ring">进度环</option><option value="alert-list">告警列表</option><option value="stats-table">状态表</option><option value="geo-map">地图点位</option><option value="topology">设备拓扑</option></select></label><label className="text-[10px] text-slate-500">视觉风格<select value={aiStyle} onChange={(event) => setAiStyle(event.target.value as PluginStyleId)} className="mt-1 h-9 w-full rounded-md border border-white/10 bg-[#0d1118] px-2 text-[11px] text-white">{PLUGIN_STYLES.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}</select></label></div>
        <button type="button" disabled={aiGenerating || !aiPrompt.trim()} onClick={generateWithModel} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-400 text-[11px] font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"><WandSparkles size={15} />{aiGenerating ? '正在生成...' : '生成实时组件'}</button>
        <button type="button" onClick={() => setShowModelSetup(!showModelSetup)} className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 text-[10px] text-slate-400 hover:text-cyan-200"><Settings size={12} /> {llmConfig.apiKey ? '已连接我的模型' : '连接我的模型'}</button>
        {showModelSetup && <div className="mt-1 border-t border-white/10 pt-3"><div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">模型平台<select value={llmConfig.providerId} onChange={(event) => selectProvider(event.target.value)} className="mt-1 h-8 w-full rounded border border-white/10 bg-[#0d1118] px-2 text-[10px] text-white">{LLM_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label><label className="text-[10px] text-slate-500">模型名称<input value={llmConfig.model} onChange={(event) => updateModel({ ...llmConfig, model: event.target.value })} placeholder="例如 gpt-4o-mini" className="mt-1 h-8 w-full rounded border border-white/10 bg-[#0d1118] px-2 text-[10px] text-white" /></label></div><label className="mt-2 block text-[10px] text-slate-500">API Key<input type="password" value={llmConfig.apiKey} onChange={(event) => updateModel({ ...llmConfig, apiKey: event.target.value })} placeholder="粘贴自己的 API Key" className="mt-1 h-8 w-full rounded border border-white/10 bg-[#0d1118] px-2 text-[10px] text-white" /></label>{llmConfig.providerId === 'custom' && <label className="mt-2 block text-[10px] text-slate-500">API 端点<input value={llmConfig.customEndpoint || ''} onChange={(event) => updateModel({ ...llmConfig, customEndpoint: event.target.value })} placeholder="https://.../v1/chat/completions" className="mt-1 h-8 w-full rounded border border-white/10 bg-[#0d1118] px-2 text-[10px] text-white" /></label>}<p className="mt-2 text-[9px] text-slate-600">Key 只保存在此设备，调用时临时使用。</p></div>}
        {aiError && <p className="mt-3 flex items-center gap-1 text-[10px] text-rose-300"><X size={12} />{aiError}</p>}
        <button type="button" disabled={aiGenerating || !aiPrompt.trim()} onClick={generateLocal} className="mt-4 w-full text-[10px] text-slate-500 hover:text-slate-300 disabled:opacity-40">先生成本地样例，不调用模型</button>
      </div>
    </main> : <><section className="shrink-0 border-b border-white/10 px-3 py-2.5"><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'mine' ? '搜索我的组件' : '搜索组件'} className="h-8 w-full rounded-md border border-white/10 bg-white/[0.04] pl-8 pr-3 text-[11px] text-white outline-none focus:border-cyan-400/60" /></div>{tab === 'official' && <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="h-8 max-w-28 rounded-md border border-white/10 bg-[#0d1118] px-2 text-[10px] text-slate-300">{categories.map((item) => <option key={item}>{item}</option>)}</select>}</div>{tab === 'mine' && <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-slate-500">{userPlugins.length} 个我的组件</span><button type="button" onClick={() => setShowImport(!showImport)} className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-100"><FileUp size={12} /> 导入 JSON</button></div>}{showImport && tab === 'mine' && <div className="mt-2 rounded-md border border-white/10 bg-white/[0.03] p-2"><button type="button" onClick={() => fileRef.current?.click()} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-cyan-400 text-[10px] font-semibold text-slate-950"><FileUp size={13} /> 选择组件文件</button><p className="mt-1.5 text-[9px] text-slate-500">仅导入安全 JSON 组件，导入后自动绑定 MQTT。</p>{uploadError && <p className="mt-1 text-[9px] text-rose-300">{uploadError}</p>}</div>}<input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importPlugin(event.target.files?.[0])} /></section>
      <main className="min-h-0 flex-1 overflow-y-auto p-2.5"><div className="mb-2 flex items-center justify-between px-0.5"><span className="text-[10px] text-slate-500">{tab === 'mine' ? '我的组件' : '可用组件'} {visiblePlugins.length}</span><button type="button" onClick={() => setPreviewMode(previewMode === 'mock' ? 'mqtt' : 'mock')} className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-cyan-200">{previewMode === 'mock' ? <Wifi size={10} /> : <WifiOff size={10} />}{previewMode === 'mock' ? '模拟预览' : 'MQTT 现场预览'}</button></div><div className="plugin-component-grid">{visiblePlugins.map(renderPluginCard)}</div>{visiblePlugins.length === 0 && <div className="flex h-32 flex-col items-center justify-center text-slate-500"><Boxes size={18} /><span className="mt-2 text-[11px]">这里还没有组件</span></div>}</main>
     {selected && <footer className="shrink-0 border-t border-white/10 bg-[#0d1118] p-3"><div className="mb-2 flex items-start justify-between"><div><p className="text-[11px] font-semibold text-white">{selected.name}</p><p className="mt-0.5 text-[9px] text-slate-500">{previewMode === 'mqtt' ? 'MQTT 现场预览' : '预览样本（插入后订阅 MQTT）'}</p></div>{tab === 'mine' && <button type="button" onClick={removeSelected} aria-label="删除我的组件" className="text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>}</div><div className="flex h-20 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#080b11] p-2"><div className="origin-center scale-[0.36]"><GalaxyComponentRenderer type={selected.componentType} data={previewData(selected, signal, previewMode)} /></div></div><button type="button" onClick={() => onInsert(withRealtimeBinding(selected))} className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-cyan-400 text-[10px] font-semibold text-slate-950 hover:bg-cyan-300"><Download size={13} /> 插入为 MQTT 实时图层</button><p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-500"><Layers3 size={11} /> 保留图层属性，可在画布继续编辑</p></footer>}</>}
  </div>;
};

export default PluginCenterPanel;
