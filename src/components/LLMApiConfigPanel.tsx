import React, { useCallback, useMemo, useState } from 'react';
import { apiUrl } from '../core/api/url';
import {
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import {
  getChatEndpoint,
  getModelsEndpoint,
  getProvider,
  LLM_PROVIDERS,
} from '../utils/llmProviders';

export interface LLMApiConfig {
  providerId: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
}

interface LLMApiConfigPanelProps {
  value: LLMApiConfig;
  onChange: (config: LLMApiConfig) => void;
  visionOnly?: boolean;
  availableModels?: string[];
  modelDiscoveryState?: 'idle' | 'loading' | 'ready' | 'error';
  modelDiscoveryMessage?: string;
}

const STORAGE_KEY = 'aether_llm_api_config';
const VISION_KEYWORDS = ['vision', 'vl', 'visual', '多模态', 'omni', 'multimodal', 'multi-modal', '4o', '图文'];
const IMAGE_GENERATION_KEYWORDS = ['gpt-image', 'dall-e', 'seedream', 'stable-diffusion', 'midjourney', 'flux', 'imagen'];
const DARK_OPTION_STYLE = { backgroundColor: '#1d1a38', color: '#f8fafc' };

export function loadLLMConfig(): LLMApiConfig {
  const fallback: LLMApiConfig = {
    providerId: 'deepseek',
    apiKey: '',
    model: getProvider('deepseek')?.visionModels[0] || 'deepseek-vl2',
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return fallback;
    const parsed = { ...fallback, ...JSON.parse(saved) } as LLMApiConfig;
    const provider = getProvider(parsed.providerId);
    if (provider?.visionModels.length && (!parsed.model || parsed.model === provider.defaultModel)) {
      parsed.model = provider.visionModels[0];
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveLLMConfig(config: LLMApiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function isVisionModel(model: string, provider: ReturnType<typeof getProvider>) {
  const lower = model.toLowerCase();
  return Boolean(
    !IMAGE_GENERATION_KEYWORDS.some((keyword) => lower.includes(keyword)) &&
    provider?.visionModels.some((known) => lower.includes(known.toLowerCase())) ||
      (!IMAGE_GENERATION_KEYWORDS.some((keyword) => lower.includes(keyword)) && VISION_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))),
  );
}

export const LLMApiConfigPanel: React.FC<LLMApiConfigPanelProps> = ({
  value,
  onChange,
  visionOnly = false,
  availableModels = [],
  modelDiscoveryState = 'idle',
  modelDiscoveryMessage = '',
}) => {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    models: string[];
  } | null>(null);

  const provider = getProvider(value.providerId);
  const providerList = visionOnly ? LLM_PROVIDERS.filter((item) => item.supportsVision) : LLM_PROVIDERS;
  const endpoint = value.customEndpoint?.trim() || provider?.endpoint || '';

  const discoveredModels = testResult?.success ? testResult.models : availableModels;
  const displayModels = useMemo(() => {
    const visionMatches = discoveredModels.filter((model) => isVisionModel(model, provider));
    // 某些兼容端点不会在模型 ID 中标注视觉能力，列表非空时仍应允许用户选择。
    const filtered = visionOnly ? visionMatches : discoveredModels;
    const unique = Array.from(new Set(filtered));
    if (unique.length === 0 && provider?.visionModels?.length) {
      return [...provider.visionModels];
    }
    // 只有已经收到真实列表时才保留当前值，避免把静态默认模型误认为已自动获取。
    if (unique.length > 0 && value.model && isVisionModel(value.model, provider) && !unique.includes(value.model)) unique.unshift(value.model);
    return unique;
  }, [discoveredModels, provider, value.model, visionOnly]);

  const update = useCallback(
    (patch: Partial<LLMApiConfig>) => {
      onChange({ ...value, ...patch });
      setTestResult(null);
    },
    [onChange, value],
  );

  const handleProviderChange = (providerId: string) => {
    const nextProvider = getProvider(providerId);
    const defaultModel = visionOnly && nextProvider?.visionModels.length
      ? nextProvider.visionModels[0]
      : nextProvider?.defaultModel || '';
    onChange({
      ...value,
      providerId,
      model: defaultModel,
      customEndpoint: providerId === 'custom' ? value.customEndpoint || '' : undefined,
    });
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!value.apiKey.trim() && value.providerId !== 'ollama') {
      setTestResult({ success: false, message: '请先填写 API Key', models: [] });
      return;
    }
    if (!endpoint) {
      setTestResult({ success: false, message: '请填写 API 端点', models: [] });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(apiUrl('/api/llm/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: value.apiKey.trim() || (value.providerId === 'ollama' ? 'ollama' : ''),
          endpoint: getChatEndpoint(value.providerId, value.customEndpoint),
          modelsEndpoint: getModelsEndpoint(value.providerId, value.customEndpoint),
          model: value.model,
        }),
      });
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        throw new Error(response.ok ? '服务返回异常响应格式' : `服务未就绪 (HTTP ${response.status})`);
      }
      const models = Array.isArray(data?.models) ? data.models : [];
      const isSuccess = Boolean(data?.success);
      setTestResult({
        success: isSuccess,
        message: data?.message || data?.error || (isSuccess ? '连接成功' : '连接失败'),
        models,
      });
      if (isSuccess && models.length) {
        const compatible = visionOnly ? models.find((model: string) => isVisionModel(model, provider)) : models[0];
        onChange({ ...value, model: compatible || models[0] });
      }
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : '测试失败', models: [] });
    } finally {
      setTesting(false);
    }
  };

  const modelPlaceholder = modelDiscoveryState === 'loading'
    ? '正在自动获取模型…'
    : value.apiKey.trim()
      ? modelDiscoveryState === 'error'
        ? '暂未获取到模型'
        : '等待模型列表…'
      : '填写 API Key 后自动获取模型';
  const canSelectModel = displayModels.length > 0;
  const statusMessage = testResult?.success
    ? testResult.models.length > 0
      ? `已获取 ${testResult.models.length} 个模型`
      : '连接成功，但端点未返回模型列表'
    : modelDiscoveryMessage || (modelDiscoveryState === 'error' ? '模型获取失败，请检查端点或 Key' : '');

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="llm-provider" className="mb-1 block text-xs font-semibold text-slate-400">AI 品牌</label>
        <select
          id="llm-provider"
          value={value.providerId}
          onChange={(event) => handleProviderChange(event.target.value)}
          style={{ colorScheme: 'dark' }}
          className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition hover:border-white/20 focus:border-cyan-400/60"
        >
          {providerList.map((item) => <option key={item.id} value={item.id} style={DARK_OPTION_STYLE}>{item.nameEn} · {item.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="llm-api-key" className="mb-1 block text-xs font-semibold text-slate-400">API Key</label>
        <div className="relative">
          <input
            id="llm-api-key"
            type={showKey ? 'text' : 'password'}
            value={value.apiKey}
            onChange={(event) => update({ apiKey: event.target.value })}
            placeholder={value.providerId === 'ollama' ? '本地运行无需 Key（留空即可）' : value.providerId === 'gemini' ? 'AIzaSy...' : 'sk-...'}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 pr-10 font-mono text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
          />
          <button type="button" title={showKey ? '隐藏 API Key' : '显示 API Key'} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} onClick={() => setShowKey((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {value.providerId === 'gemini' && value.apiKey.trim().startsWith('AQ.') && (
          <p className="mt-1 text-[11px] text-amber-400">
            ⚠️ 检测到当前 Key 可能是临时 OAuth 凭证。Google AI Studio 官方 API Key 通常以 AIzaSy 开头。
          </p>
        )}
      </div>

      <div>
        <label htmlFor="llm-endpoint" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-400"><Server size={12} /> API 端点</label>
        <input
          id="llm-endpoint"
          type="url"
          value={endpoint}
          onChange={(event) => update({ customEndpoint: event.target.value })}
          placeholder="https://api.example.com/v1/chat/completions"
          className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 font-mono text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
        />
        <p className="mt-1 text-[10px] text-slate-500">可填写兼容 OpenAI 格式的 chat/completions 地址。</p>
      </div>

      <div>
        <label htmlFor="llm-model" className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>模型名称{visionOnly && <span className="ml-1 text-purple-300">(视觉)</span>}</span>
          <span className="text-[10px] font-normal text-slate-500">自动获取</span>
        </label>
        {canSelectModel ? (
          <select
            id="llm-model"
            value={value.model}
            onChange={(event) => update({ model: event.target.value })}
            style={{ colorScheme: 'dark' }}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 font-mono text-xs text-white outline-none transition hover:border-white/20 focus:border-cyan-400/60"
          >
            {displayModels.map((model) => (
              <option key={model} value={model} style={DARK_OPTION_STYLE}>
                {model === 'gemini-1.5-flash'
                  ? `${model} (推荐 · 免费不限频)`
                  : model === 'gemini-2.0-flash'
                  ? `${model} (新一代极速)`
                  : model}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="llm-model"
            value={value.model}
            onChange={(event) => update({ model: event.target.value })}
            placeholder={modelPlaceholder}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 font-mono text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
          />
        )}
        {statusMessage && <p className={`mt-1 text-[10px] ${modelDiscoveryState === 'error' ? 'text-amber-300/80' : 'text-slate-500'}`}>{statusMessage}</p>}
      </div>

      <button
        type="button"
        onClick={handleTest}
        disabled={testing || !value.apiKey.trim() || !endpoint}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
      >
        {testing ? <><Loader2 size={14} className="animate-spin" />正在测试连接…</> : <><RefreshCw size={14} />连通测试</>}
      </button>

      {testResult && (
        <div className={`flex items-start gap-2 rounded-lg p-2 text-xs ${testResult.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
          {testResult.success ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
};
