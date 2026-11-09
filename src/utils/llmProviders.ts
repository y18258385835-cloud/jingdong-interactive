/**
 * 大模型品牌配置表
 * 统一管理各品牌的 API 端点、默认模型、是否支持视觉等
 * 所有品牌均使用 OpenAI 兼容格式（chat/completions）
 */

export interface LLMProvider {
  id: string;
  name: string;
  nameEn: string;
  icon: string; // emoji 图标
  color: string; // 主题色
  endpoint: string; // chat/completions 端点
  modelsEndpoint: string; // 获取模型列表端点（通常是 /models）
  defaultModel: string; // 默认模型
  visionModels: string[]; // 支持视觉理解的模型
  supportsVision: boolean; // 是否支持视觉（img2threejs 需要）
  website: string; // 官网
  description: string; // 简短描述
  requiresEndpointId?: boolean; // 是否需要使用推理接入点ID（如火山引擎）
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama (本地离线)',
    nameEn: 'Ollama',
    icon: '🦙',
    color: '#EA580C',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    modelsEndpoint: 'http://localhost:11434/v1/models',
    defaultModel: 'qwen2.5:7b',
    visionModels: ['llava', 'qwen2.5-vl', 'bakllava', 'llama3.2-vision', 'minicpm-v'],
    supportsVision: true,
    website: 'https://ollama.com',
    description: '本地运行零门槛，免 API Key，100% 隐私离线安全',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    nameEn: 'Gemini',
    icon: '✨',
    color: '#4285F4',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    defaultModel: 'gemini-1.5-flash',
    visionModels: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    supportsVision: true,
    website: 'https://aistudio.google.com',
    description: '谷歌长文本模型（可选，需配置 Key）',
  },
  {
    id: 'deepseek',
    name: '深度求索',
    nameEn: 'DeepSeek',
    icon: '🐋',
    color: '#4D6BFE',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    modelsEndpoint: 'https://api.deepseek.com/v1/models',
    defaultModel: 'deepseek-chat',
    visionModels: ['deepseek-vl', 'deepseek-vl2', 'deepseek-v4-flash-vision', 'deepseek-v4-pro-vision', 'deepseek-v3-vision'],
    supportsVision: true,
    website: 'https://platform.deepseek.com',
    description: '国产高性能大模型，性价比高',
  },
  {
    id: 'zhipu',
    name: '智谱清言',
    nameEn: 'GLM',
    icon: '💎',
    color: '#326BFF',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelsEndpoint: 'https://open.bigmodel.cn/api/paas/v4/models',
    defaultModel: 'glm-4-flash',
    visionModels: ['glm-4v', 'glm-4v-plus', 'glm-4v-flash', 'glm-5v', 'glm-5v-turbo', 'glm-5.3', 'glm-5.2', 'glm-5.1'],
    supportsVision: true,
    website: 'https://open.bigmodel.cn',
    description: '智谱AI，GLM系列模型',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    nameEn: 'Hunyuan',
    icon: '🐧',
    color: '#00A6FF',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    modelsEndpoint: 'https://api.hunyuan.cloud.tencent.com/v1/models',
    defaultModel: 'hunyuan-lite',
    visionModels: ['hunyuan-vision', 'hunyuan-vision-2', 'hy-vision', 'hunyuan-t1-vision', 'hy-mt2', 'hy-mt2-pro', 'hy-mt2-plus', 'hy4', 'hy3'],
    supportsVision: true,
    website: 'https://cloud.tencent.com/product/hunyuan',
    description: '腾讯混元大模型',
  },
  {
    id: 'kimi',
    name: '月之暗面',
    nameEn: 'Kimi',
    icon: '🌙',
    color: '#8F6FFF',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    modelsEndpoint: 'https://api.moonshot.cn/v1/models',
    defaultModel: 'moonshot-v1-8k',
    visionModels: ['moonshot-v1-vision', 'kimi-vl', 'kimi-k3', 'kimi-k2.6', 'kimi-k2.5'],
    supportsVision: true,
    website: 'https://platform.moonshot.cn',
    description: 'Kimi 长文本大模型',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    nameEn: 'MiniMax',
    icon: '🎬',
    color: '#D4A6FF',
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    modelsEndpoint: 'https://api.minimax.chat/v1/models',
    defaultModel: 'abab6.5s-chat',
    visionModels: ['MiniMax-01', 'abab6.5s-chat', 'minimax-m2', 'minimax-m2.7', 'minimax-m3', 'mimo'],
    supportsVision: true,
    website: 'https://www.minimaxi.com',
    description: 'MiniMax 多模态大模型',
  },
  {
    id: 'qwen',
    name: '通义千问',
    nameEn: 'Qwen',
    icon: '🐱',
    color: '#6149FF',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    modelsEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    defaultModel: 'qwen-turbo',
    visionModels: ['qwen-vl-max', 'qwen-vl-plus', 'qwen-vl', 'qwen3.5', 'qwen3', 'qwen2.5-vl'],
    supportsVision: true,
    website: 'https://dashscope.aliyun.com',
    description: '阿里通义千问系列',
  },
  {
    id: 'doubao',
    name: '豆包(火山引擎)',
    nameEn: 'Doubao',
    icon: '🫘',
    color: '#3370FF',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    modelsEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/models',
    defaultModel: '',
    visionModels: ['doubao-vision-pro', 'doubao-1-5-vision-pro', 'doubao-1-6', 'doubao-vision', 'seedream', 'doubao-seed-1-6-vision'],
    supportsVision: true,
    website: 'https://www.volcengine.com/product/doubao',
    description: '⚠️ 需使用推理接入点ID(ep-开头)，非模型ID',
    requiresEndpointId: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    nameEn: 'GPT',
    icon: '🤖',
    color: '#10A37F',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    defaultModel: 'gpt-4o-mini',
    visionModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    supportsVision: true,
    website: 'https://platform.openai.com',
    description: 'OpenAI GPT 系列',
  },
  {
    id: 'baichuan',
    name: '百川智能',
    nameEn: 'Baichuan',
    icon: '🌊',
    color: '#0052D9',
    endpoint: 'https://api.baichuan-ai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.baichuan-ai.com/v1/models',
    defaultModel: 'Baichuan4',
    visionModels: ['Baichuan4', 'Baichuan-VL', 'Baichuan-Turbo'],
    supportsVision: true,
    website: 'https://platform.baichuan-ai.com',
    description: '百川智能大模型',
  },
  {
    id: 'yi',
    name: '零一万物',
    nameEn: 'Yi',
    icon: '🦅',
    color: '#FF6B35',
    endpoint: 'https://api.lingyiwanwu.com/v1/chat/completions',
    modelsEndpoint: 'https://api.lingyiwanwu.com/v1/models',
    defaultModel: 'yi-lightning',
    visionModels: ['yi-vision', 'yi-vl', 'yi-lightning', 'yi-medium'],
    supportsVision: true,
    website: 'https://platform.lingyiwanwu.com',
    description: '零一万物 Yi 系列',
  },
  {
    id: 'stepfun',
    name: '阶跃星辰',
    nameEn: 'Step',
    icon: '⭐',
    color: '#00B42A',
    endpoint: 'https://api.stepfun.com/v1/chat/completions',
    modelsEndpoint: 'https://api.stepfun.com/v1/models',
    defaultModel: 'step-1-flash',
    visionModels: ['step-1v', 'step-1o', 'step-2', 'step-1-flash'],
    supportsVision: true,
    website: 'https://platform.stepfun.com',
    description: '阶跃星辰多模态大模型',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    nameEn: 'SiliconFlow',
    icon: '🔌',
    color: '#0084FF',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    modelsEndpoint: 'https://api.siliconflow.cn/v1/models',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    visionModels: ['Qwen/Qwen2-VL-7B-Instruct', 'deepseek-ai/DeepSeek-VL2'],
    supportsVision: true,
    website: 'https://siliconflow.cn',
    description: '硅基流动 API 中转站，模型丰富',
  },
  {
    id: 'custom',
    name: '自定义/中转站',
    nameEn: 'Custom',
    icon: '⚙️',
    color: '#6B7280',
    endpoint: '',
    modelsEndpoint: '',
    defaultModel: '',
    visionModels: [],
    supportsVision: true, // 自定义不限制，由用户决定
    website: '',
    description: '自定义 API 端点或第三方中转站',
  },
];

/**
 * 根据 ID 获取品牌配置
 */
export function getProvider(id: string): LLMProvider | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}

/**
 * 获取品牌的 chat/completions 端点
 * 如果是自定义品牌，使用用户提供的 endpoint
 */
export function getChatEndpoint(providerId: string, customEndpoint?: string): string {
  // 如果用户填写了自定义端点，优先使用（覆盖所有品牌的默认端点）
  if (customEndpoint && customEndpoint.trim()) {
    const ep = customEndpoint.trim();
    try {
      const u = new URL(ep);
      if (u.hostname.toLowerCase() === 'generativelanguage.googleapis.com') {
        u.pathname = '/v1beta/openai/chat/completions';
        return u.toString();
      }
    } catch {}
    return ep;
  }
  const provider = getProvider(providerId);
  if (!provider) return '';
  return provider.endpoint;
}

/**
 * 获取品牌的模型列表端点
 */
export function getModelsEndpoint(providerId: string, customEndpoint?: string): string {
  // 用户端点可能填写 chat/completions、/v1 或服务根地址，统一推导模型列表地址。
  if (customEndpoint && customEndpoint.trim()) {
    const endpoint = customEndpoint.trim().replace(/\/$/, '');
    try {
      const u = new URL(endpoint);
      if (u.hostname.toLowerCase() === 'generativelanguage.googleapis.com') {
        u.pathname = '/v1beta/openai/models';
        return u.toString();
      }
    } catch {}
    if (/\/chat\/completions$/i.test(endpoint)) return endpoint.replace(/\/chat\/completions$/i, '/models');
    if (/\/v\d+$/i.test(endpoint)) return `${endpoint}/models`;
    if (/\/models$/i.test(endpoint)) return endpoint;
    return `${endpoint}/v1/models`;
  }
  const provider = getProvider(providerId);
  if (!provider) return '';
  return provider.modelsEndpoint;
}
