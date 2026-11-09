import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../core/api/url';
import {
  AlertTriangle,
  ArrowUpRight,
  Activity,
  Bot,
  Check,
  CheckCircle2,
  CircleDot,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Eye,
  EyeOff,
  FileArchive,
  FileJson,
  FileText,
  Film,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  MessageSquareText,
  Music2,
  Network,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Settings2,
  Sparkles,
  Trash2,
  WandSparkles,
  Wrench,
  Zap,
  X,
  Box,
} from 'lucide-react';
import type { ProjectData } from '../types';
import { getChatEndpoint, getModelsEndpoint, getProvider, LLM_PROVIDERS } from '../utils/llmProviders';
import { loadLLMConfig, saveLLMConfig, type LLMApiConfig } from './LLMApiConfigPanel';
import {
  analyzeAiSceneProposal,
  sanitizeAiSceneProposal,
  type ApplyAiSceneResult,
  type AiSceneProposal,
} from '../core/ai/sceneBuilder';
import {
  AETHER_HARNESS_TOOLS,
  createHarnessRun,
  getHarnessTool,
  HARNESS_TEMPLATE_CAPABILITY_GROUPS,
  markHarnessExecution,
  markHarnessRunning,
  type HarnessRun,
} from '../core/ai/agentHarness';
import {
  appendHarnessReply,
  createLocalHarnessInterview,
  isLowValueHarnessQuestion,
  normalizeHarnessInterviewResponse,
  summarizeHarnessBrief,
  type HarnessConversationMessage,
  type HarnessInterviewResponse,
  type HarnessRequirementBrief,
} from '../core/ai/harnessConversation';
import { analyzeHarnessImpact, scoreHarnessProposal, type HarnessImpactReport, type HarnessQualityReport } from '../core/ai/harnessQuality';
import {
  formatHarnessAttachmentSize,
  getClipboardFiles,
  MAX_HARNESS_ATTACHMENTS,
  readHarnessAttachment,
  serializeHarnessAttachments,
  type HarnessAttachment,
  type HarnessAttachmentCategory,
} from '../core/ai/harnessAttachments';
import { AiAgentChatWorkspace } from './AiAgentChatWorkspace';
import type { WorkToolMode } from './AiAgentChatWorkspace';

interface AiSceneBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  projectId: string;
  activeSceneId: string;
  onApply: (proposal: AiSceneProposal) => ApplyAiSceneResult | void;
  onUndo: () => void;
  canUndo: boolean;
  onUpdateProject: (updater: (prev: ProjectData) => ProjectData) => void;
  toolMode?: WorkToolMode;
  onToolModeChange?: (mode: WorkToolMode) => void;
  toolPanel?: React.ReactNode;
  onLoadPresetDemo?: () => void;
}

interface AiMemoryItem {
  id: string;
  role: 'user' | 'system';
  text: string;
  timestamp: number;
  proposalTitle?: string;
}

const MEMORY_STORAGE_KEY = 'aether_ai_scene_builder_v1';
const CONVERSATION_STORAGE_KEY = 'aether_harness_conversation_v1';
const MAX_MEMORY_ITEMS = 40;
const DEFAULT_PROMPT = '';
const DARK_OPTION_STYLE = { backgroundColor: '#07111a', color: '#f8fafc' };

const attachmentCategoryLabel: Record<HarnessAttachmentCategory, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  model: '3D',
  project: '工程',
  document: '文本',
};

function HarnessAttachmentIcon({ category, size = 14 }: { category: HarnessAttachmentCategory; size?: number }) {
  const Icon = category === 'image' ? ImageIcon
    : category === 'video' ? Film
      : category === 'audio' ? Music2
        : category === 'model' ? Box
          : category === 'project' ? FileArchive
            : category === 'document' ? FileText : FileJson;
  return <Icon size={size} strokeWidth={1.7} />;
}

function loadMemory(): AiMemoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.text === 'string').slice(-MAX_MEMORY_ITEMS);
  } catch {
    return [];
  }
}

function saveMemory(items: AiMemoryItem[]) {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(items.slice(-MAX_MEMORY_ITEMS)));
  } catch {
    // Storage can be disabled in private browsing; the editor still works in memory.
  }
}

function getConversationKey(projectId: string) {
  return `${CONVERSATION_STORAGE_KEY}:${projectId || 'unknown-project'}`;
}

function loadConversation(projectId: string, projectData: ProjectData): HarnessConversationMessage[] {
  try {
    const stableKey = getConversationKey(projectId);
    const legacyKey = `${CONVERSATION_STORAGE_KEY}:${projectData.meta.title || 'untitled'}`;
    const raw = localStorage.getItem(stableKey) || localStorage.getItem(legacyKey) || '[]';
    const parsed = JSON.parse(raw);
    if (!localStorage.getItem(stableKey) && localStorage.getItem(legacyKey)) localStorage.setItem(stableKey, raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: HarnessConversationMessage[] = [];
    let skippedLowValueQuestion = false;
    for (const item of parsed) {
      if (!item || (item.role !== 'user' && item.role !== 'assistant') || typeof item.text !== 'string') continue;
      if (item.role === 'assistant' && isLowValueHarnessQuestion(item.text)) {
        skippedLowValueQuestion = true;
        continue;
      }
      if (skippedLowValueQuestion && item.role === 'user' && /^(是|否|yes|no)$/i.test(item.text.trim())) {
        skippedLowValueQuestion = false;
        continue;
      }
      skippedLowValueQuestion = false;
      cleaned.push(item);
    }
    return cleaned.slice(-24);
  } catch {
    return [];
  }
}

function saveConversation(projectId: string, messages: HarnessConversationMessage[]) {
  try {
    localStorage.setItem(getConversationKey(projectId), JSON.stringify(messages.slice(-24)));
  } catch {
    // The working session remains available when browser storage is disabled.
  }
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function normalizeSceneEndpoint(endpoint: string) {
  const value = endpoint.trim();
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() === 'generativelanguage.googleapis.com') {
      url.pathname = '/v1beta/openai/chat/completions';
      return url.toString();
    }
    if (url.protocol === 'https:' && (url.pathname === '/' || url.pathname === '')) {
      url.pathname = '/v1/chat/completions';
      return url.toString();
    }
    if (url.protocol === 'https:' && /\/v1\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
      return url.toString();
    }
  } catch {
    // The proxy will return the actionable validation error for malformed URLs.
  }
  return value;
}

function presentGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/not supported.*chat\/completions|gpt[-_]?image|dall[-_]?e|seedream|仅用于图片生成/i.test(message)) {
    return '当前模型是图片生成模型，不支持 Chat Completions 场景编排。请切换到视觉对话模型，例如 vision、VL、4o 或 omni 系列。';
  }
  if (/VISION_MODEL_REQUIRED|视觉输入能力|视觉模型/i.test(message)) {
    return '当前模型不支持图片理解，已阻止生成无关场景。请在模型下拉中选择带 vision、VL、4o 或 omni 标识的视觉模型。';
  }
  if (/MODEL_GENERATION_TIMEOUT|MODEL_INTERVIEW_TIMEOUT|MODEL_UPSTREAM_TIMEOUT|signal is aborted|abort(?:ed)?|timeout|timed out|超时|请求超时|中止|取消/i.test(message)) {
    return '模型生成请求超时或被取消，未能在 120 秒的完整执行链路内返回结果。这不代表模型不支持生成；请检查端点响应速度、请求上下文大小和模型容量后重试。';
  }
  if (/429|rate limit|too many requests|serving capacity|capacity|temporarily unavailable|service is currently busy|503|502|500/i.test(message)) {
    return '模型服务当前繁忙或容量不足，暂时无法完成生成。请稍后重试，或切换到可用模型端点。';
  }
  if (/no executable operations|has no operations|no operations|not valid json|不符合 aether|模型方案修复失败/i.test(message)) {
    return '模型已返回内容，但没有识别出可执行的 AETHER 操作。系统可以先生成本地兼容方案，稍后再检查模型输出格式。';
  }
  if (/AI response is empty|模型返回为空|returned empty/i.test(message)) {
    return '模型返回了空结果。请确认 API 端点包含 /v1/chat/completions，并检查模型名称是否支持文本输出。';
  }
  if (/failed to fetch|networkerror|fetch/i.test(message)) {
    return '无法连接本地 AI 代理。请确认编辑器开发服务已启动，再重试一次。';
  }
  if (/401|403|unauthorized|forbidden/i.test(message)) {
    return 'API Key 未通过验证。请检查密钥、模型权限和端点是否属于同一服务。';
  }
  return message || '生成失败，请检查模型配置后重试。';
}

function isRecoverableModelOutputError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/abort|aborted|signal is aborted|timeout|timed out|超时|请求超时|中止|取消/i.test(message)) return true;
  return /no executable operations|has no operations|no operations|not valid json|不符合 aether|no executable|模型方案修复失败|service is currently busy|serving capacity|temporarily unavailable|rate limit|too many requests|model service request failed|模型服务请求失败/i.test(message);
}

function buildContext(projectData: ProjectData, activeSceneId: string) {
  const scenes = Object.values(projectData.scenes).slice(0, 16).map((scene) => ({
    id: scene.id,
    name: scene.alias,
    duration: scene.duration,
    elementCount: scene.els.length,
    elements: scene.els.slice(0, 24).map((element) => ({
      id: element.id,
      type: element.type,
      name: element.sourceName || element.content || element.id,
      refId: element.refId && !/^(data:|blob:|https?:)/.test(element.refId) ? element.refId : undefined,
      x: element.x,
      y: element.y,
      w: element.w,
      h: element.h,
    })),
  }));
  return {
    activeSceneId,
    activeSceneName: projectData.scenes[activeSceneId]?.alias,
    canvas: projectData.canvas || { width: 1920, height: 1080 },
    sceneCount: Object.keys(projectData.scenes).length,
    scenes,
    availableTools: AETHER_HARNESS_TOOLS.map((tool) => ({ id: tool.id, name: tool.name, writesProject: tool.writesProject })),
    availableCapabilities: ['基础元素', '图形图标', '3D 全景', '视觉特效', '图层属性', '场景设置', '时间线', '历史撤销', 'MQTT 样例绑定'],
  };
}

function addReferenceBackdrop(proposal: AiSceneProposal, attachments: HarnessAttachment[]) {
  const reference = attachments.find((attachment) => attachment.status === 'ready' && attachment.category === 'image' && attachment.dataUrl);
  if (!reference?.dataUrl || proposal.operations.some((operation) => operation.kind === 'create-element' && operation.element.type === 'img' && operation.element.role === 'background')) return proposal;
  const sceneId = proposal.operations.find((operation) => operation.kind === 'create-scene')?.sceneId || 'new-scene';
  return {
    ...proposal,
    operations: [
      {
        kind: 'create-element' as const,
        sceneId,
        element: {
          type: 'img' as const,
          name: `参考图背景 · ${reference.name}`,
          sourceName: reference.name,
          refId: reference.dataUrl,
          role: 'background' as const,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          opacity: 100,
          zIndex: 1,
        },
      },
      ...proposal.operations,
    ],
    warnings: [...proposal.warnings, '已将参考图作为真实背景素材写入场景，其他图层保持可编辑。'],
  };
}

function buildHarnessGenerationPrompt(prompt: string, brief: HarnessRequirementBrief | null) {
  if (!brief) return prompt;
  return `${prompt}\n\nHarness requirement brief (treat as the approved source of truth):\n${JSON.stringify(brief)}`.slice(0, 4000);
}

const operationLabel: Record<string, string> = {
  'create-scene': '新建场景',
  'create-element': '创建图层',
  'update-scene': '调整场景',
  'update-element': '修改图层',
  'delete-element': '删除图层',
  'reorder-elements': '排列图层',
  'bind-mqtt': '绑定 MQTT',
};

type AiTemplateCategory = '全部' | '数据大屏' | '展厅大屏' | '展陈交互' | '产品发布' | '视觉动效';

export interface AiGenerationTemplate {
  id: string;
  name: string;
  category: Exclude<AiTemplateCategory, '全部'>;
  description: string;
  tags: string[];
  accent: string;
  prompt: string;
}

interface ReferenceBrief {
  url: string;
  title: string;
  description: string;
  headings: string[];
}

const AI_GENERATION_TEMPLATES: AiGenerationTemplate[] = [
  { id: 'exhibition-foyer', name: '展厅序厅迎宾大屏', category: '展厅大屏', description: '序厅主视觉、自动巡航背景和进入展区的双场景导览。', tags: ['序厅', '全景', '跳转'], accent: '#38bdf8', prompt: '使用展厅序厅迎宾大屏模板，生成序厅主视觉、全景素材占位、展区入口热点和详情场景；所有主视觉和全景均保留为本地可替换素材位。' },
  { id: 'brand-timeline', name: '品牌时间轴叙事大屏', category: '展厅大屏', description: '适合企业历史、里程碑和成果叙事的时间轴展项。', tags: ['时间轴', '里程碑', '互动'], accent: '#a78bfa', prompt: '使用品牌时间轴叙事大屏模板，生成四段可编辑里程碑、Saber 时间轴、阶段详情场景和返回交互，适合企业展厅品牌历程展示。' },
  { id: 'campus-sandtable', name: '园区数字沙盘导览', category: '展厅大屏', description: '中心沙盘占位、分区热点和二级空间详情的导览结构。', tags: ['沙盘', '热点', '空间导览'], accent: '#2dd4bf', prompt: '使用园区数字沙盘导览模板，生成中心数字沙盘可替换占位、三个园区分区热点、空间详情场景和返回导览交互，不使用虚构外部图片或模型链接。' },
  { id: 'experience-wall', name: '互动产品体验墙', category: '展厅大屏', description: '产品主体、能力卡片和体验详情的展墙式交互布局。', tags: ['产品体验', '展墙', '交互'], accent: '#fb7185', prompt: '使用互动产品体验墙模板，生成产品主视觉可替换占位、三项体验能力卡、进入体验详情和返回展墙交互，适合展厅触控大屏。' },
  { id: 'factory-ops', name: '智能工厂监控中枢', category: '数据大屏', description: '指标、趋势、告警和设备状态的工业监控骨架。', tags: ['UI 组件', '图表', 'MQTT'], accent: '#22d3ee', prompt: '生成一个智能工厂监控中枢，包含设备状态、产能指标、能耗趋势、告警列表和设备分布，使用已有 UI 组件与图表，自动绑定 MQTT 样例数据，保持高密度但清晰。' },
  { id: 'energy-command', name: '能源指挥驾驶舱', category: '数据大屏', description: '适合园区、电力和储能场景的实时决策界面。', tags: ['图表', '状态卡', '数据绑定'], accent: '#a78bfa', prompt: '生成一个能源指挥驾驶舱，展示总负荷、光伏出力、储能电量、区域趋势和异常事件，合理调用图表、UI 组件、时间线和 MQTT 样例数据，避免图层重叠。' },
  { id: 'museum-wayfinding', name: '沉浸式展陈导览', category: '展陈交互', description: '全景、热点、Saber 引导线和场景切换的展陈起点。', tags: ['全景', 'Saber', '交互'], accent: '#f59e0b', prompt: '生成一个沉浸式展陈导览场景，调用已有全景素材能力、Saber 引导线、信息热点和场景切换交互，使用克制的暖金与青色光效，不虚构素材地址。' },
  { id: 'product-keynote', name: '产品发布主视觉', category: '产品发布', description: '标题、卖点、产品主体和节奏明确的发布场景。', tags: ['文字', '形状', '动效'], accent: '#fb7185', prompt: '生成一个高级产品发布主视觉场景，包含品牌标题、核心卖点、产品主体占位、几何形状和克制的入场出场动效，使用清晰层级与充足留白。' },
  { id: 'saber-system', name: 'Saber 光效系统', category: '视觉动效', description: '适合科技演示的光带、边缘光和循环氛围层。', tags: ['Saber', 'VFX', '循环动效'], accent: '#8b5cf6', prompt: '生成一个科技感 Saber 光效系统，包含主光带、辅助光线、低透明度 VFX 氛围层和循环动效，调用已有预设与颜色参数，保证所有元素边界清晰。' },
  { id: 'three-showcase', name: '3D 产品分层展示', category: '视觉动效', description: '围绕已有 3D 素材组织分层、说明和展示节奏。', tags: ['3D', '图层', '时间线'], accent: '#34d399', prompt: '生成一个 3D 产品分层展示场景，优先使用工程已有 3D 素材，创建标题、分层说明、引导线和时间线动效，不生成虚构的外部模型 URL。' },
];

export const AiSceneBuilderModal: React.FC<AiSceneBuilderModalProps> = ({
  isOpen,
  onClose,
  projectData,
  projectId,
  activeSceneId,
  onApply,
  onUndo,
  canUndo,
  onUpdateProject,
  toolMode = 'none',
  onToolModeChange,
  toolPanel,
  onLoadPresetDemo,
}) => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [memory, setMemory] = useState<AiMemoryItem[]>(loadMemory);
  const [proposal, setProposal] = useState<AiSceneProposal | null>(null);
  const [harnessRun, setHarnessRun] = useState<HarnessRun | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'connecting' | 'interpreting' | 'auditing'>('idle');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState<LLMApiConfig>(loadLLMConfig);
  const [connectionState, setConnectionState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelDiscoveryState, setModelDiscoveryState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelDiscoveryMessage, setModelDiscoveryMessage] = useState('');
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState<AiTemplateCategory>('全部');
  const [isApplying, setIsApplying] = useState(false);
  const [conversation, setConversation] = useState<HarnessConversationMessage[]>([]);
  const [conversationPhase, setConversationPhase] = useState<'intake' | 'clarifying' | 'briefing' | 'planning'>('intake');
  const [requirementBrief, setRequirementBrief] = useState<HarnessRequirementBrief | null>(null);
  const [interviewState, setInterviewState] = useState<'idle' | 'loading' | 'model' | 'local' | 'unavailable'>('idle');
  const [attachments, setAttachments] = useState<HarnessAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [sessionQuery, setSessionQuery] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceBrief, setReferenceBrief] = useState<ReferenceBrief | null>(null);
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<HarnessAttachment[]>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const handleGenerateRef = useRef<(promptOverride?: string) => Promise<void> | void>(() => undefined);
  const onCloseRef = useRef(onClose);
  const generationIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const applyingRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    window.setTimeout(() => promptRef.current?.focus(), 80);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void handleGenerateRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      generationIdRef.current += 1;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const next = loadMemory();
      setMemory(next);
      setConfig(loadLLMConfig());
      setProposal(null);
      setHarnessRun(null);
      setError('');
      setConnectionState('idle');
      setModelOptions([]);
      setModelDiscoveryState('idle');
      setModelDiscoveryMessage('');
      setIsGenerating(false);
      setGenerationPhase('idle');
      setIsApplying(false);
      applyingRef.current = false;
       setConversation(loadConversation(projectId, projectData));
       setConversationPhase('intake');
       setRequirementBrief(null);
      setInterviewState('idle');
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
      setAttachments([]);
      setAttachmentError('');
      setIsDragOver(false);
      setSessionQuery('');
      setReferenceUrl('');
      setReferenceBrief(null);
      setReferenceError('');
      setIsAnalyzingReference(false);
     }
  }, [isOpen, projectId]);

  const persistConfig = useCallback((next: LLMApiConfig) => {
    setConfig(next);
    saveLLMConfig(next);
    setConnectionState('idle');
  }, []);

  const discoverModels = useCallback(async (currentConfig: LLMApiConfig, signal?: AbortSignal) => {
    const endpoint = normalizeSceneEndpoint(getChatEndpoint(currentConfig.providerId, currentConfig.customEndpoint));
    const modelsEndpoint = getModelsEndpoint(currentConfig.providerId, currentConfig.customEndpoint || endpoint);
    if (!currentConfig.apiKey.trim() || !endpoint || !modelsEndpoint) {
      setModelOptions([]);
      setModelDiscoveryState('idle');
      setModelDiscoveryMessage('填写 API Key 和端点后自动读取模型');
      return;
    }
    setModelDiscoveryState('loading');
    setModelDiscoveryMessage('正在读取可用模型…');
    try {
      const response = await fetch(apiUrl('/api/llm/models'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ apiKey: currentConfig.apiKey, modelsEndpoint, endpoint }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || data.message || '模型列表读取失败');
      const models = Array.isArray(data.models) ? data.models.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
      const provider = getProvider(currentConfig.providerId);
      const visionModels = provider?.visionModels.length
        ? models.filter((model) => provider.visionModels.some((known) => model.toLowerCase().includes(known.toLowerCase())) || /vision|vl(?:-|\b)|visual|omni|4o(?:-|\b)|multimodal/i.test(model))
        : models.filter((model) => /vision|vl(?:-|\b)|visual|omni|4o(?:-|\b)|multimodal/i.test(model) && !/gpt[-_]?image|dall[-_]?e|seedream|stable[-_]?diffusion|midjourney|flux(?:[-_]|$)|imagen(?:[-_]|$)/i.test(model));
      const usableModels = visionModels;
      setModelOptions(usableModels);
      setModelDiscoveryState(usableModels.length ? 'ready' : 'error');
      setModelDiscoveryMessage(usableModels.length ? `已读取 ${usableModels.length} 个可用模型` : '端点未返回模型列表，可手动填写模型名');
      if (usableModels.length && !usableModels.includes(currentConfig.model)) {
        persistConfig({ ...currentConfig, model: usableModels[0] });
      } else if (!usableModels.length && currentConfig.model && /gpt[-_]?image|dall[-_]?e|seedream|stable[-_]?diffusion|midjourney|flux(?:[-_]|$)|imagen(?:[-_]|$)/i.test(currentConfig.model)) {
        persistConfig({ ...currentConfig, model: '' });
      }
    } catch (discoveryError) {
      if (discoveryError instanceof DOMException && discoveryError.name === 'AbortError') return;
      setModelOptions([]);
      setModelDiscoveryState('error');
      setModelDiscoveryMessage(presentGenerationError(discoveryError));
    }
  }, [persistConfig]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void discoverModels(config, controller.signal), 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [config.apiKey, config.providerId, config.customEndpoint, discoverModels, isOpen]);

  const addMemory = useCallback((item: AiMemoryItem) => {
    setMemory((current) => {
      const next = [...current, item].slice(-MAX_MEMORY_ITEMS);
      saveMemory(next);
      return next;
    });
  }, []);

  const addConversationMessage = useCallback((message: HarnessConversationMessage) => {
    setConversation((current) => {
      const next = [...current, message].slice(-24);
      saveConversation(projectId, next);
      return next;
    });
  }, [projectId]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    const remaining = MAX_HARNESS_ATTACHMENTS - attachmentsRef.current.length;
    if (remaining <= 0) {
      setAttachmentError(`当前会话最多挂载 ${MAX_HARNESS_ATTACHMENTS} 个文件`);
      return;
    }
    const selected = files.slice(0, remaining);
    setAttachmentError(files.length > remaining ? `最多保留 ${MAX_HARNESS_ATTACHMENTS} 个文件，已忽略多余文件` : '');
    const loaded = await Promise.all(selected.map((file) => readHarnessAttachment(file)));
    setAttachments((current) => [...current, ...loaded].slice(0, MAX_HARNESS_ATTACHMENTS));
    if (!prompt.trim()) setPrompt('请分析已上传的参考文件并生成可执行的编辑方案。');
  }, [prompt]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = getClipboardFiles(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    void handleFiles(files);
  }, [handleFiles]);

  const removeAttachment = useCallback((attachment: HarnessAttachment) => {
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    setAttachmentError('');
  }, []);

  const startNewSession = useCallback(() => {
    onToolModeChange?.('none');
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
    setAttachments([]);
    setAttachmentError('');
    setConversation([]);
    setRequirementBrief(null);
    setConversationPhase('intake');
    setProposal(null);
    setHarnessRun(null);
    setPrompt('');
    setReferenceUrl('');
    setReferenceBrief(null);
    setReferenceError('');
    setError('');
    setInterviewState('idle');
    setActiveMemoryId(null);
    saveConversation(projectId, []);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }, [onToolModeChange, projectId]);

  const analyzeReference = useCallback(async (): Promise<ReferenceBrief | null> => {
    const url = referenceUrl.trim();
    if (!url) return null;
    if (referenceBrief?.url === url) return referenceBrief;
    setIsAnalyzingReference(true);
    setReferenceError('');
    try {
      const response = await fetch(apiUrl('/api/reference/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.reference) throw new Error(data.error || '网页信息读取失败');
      const next = data.reference as ReferenceBrief;
      setReferenceBrief(next);
      return next;
    } catch (analysisError) {
      setReferenceBrief(null);
      setReferenceError(presentGenerationError(analysisError));
      return null;
    } finally {
      setIsAnalyzingReference(false);
    }
  }, [referenceBrief, referenceUrl]);

  const withReferenceContext = useCallback((basePrompt: string, reference: ReferenceBrief | null) => {
    if (!reference) return basePrompt;
    return `${basePrompt}\n\n网页参考（提取页面结构与信息层级，不复制品牌素材）：${JSON.stringify(reference)}`.slice(0, 4000);
  }, []);

  const requestHarnessInterview = useCallback(async (nextPrompt: string, priorConversation: HarnessConversationMessage[]): Promise<HarnessInterviewResponse> => {
    const fallback = createLocalHarnessInterview(nextPrompt, projectData.scenes[activeSceneId]?.alias, attachmentsRef.current.some((attachment) => attachment.status === 'ready'));
    const endpoint = normalizeSceneEndpoint(getChatEndpoint(config.providerId, config.customEndpoint));
    if (!config.apiKey.trim() || !endpoint || !config.model.trim()) {
      setInterviewState('local');
      return fallback;
    }
    setInterviewState('loading');
    setIsGenerating(true);
    setGenerationPhase('connecting');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(new Error('MODEL_INTERVIEW_TIMEOUT')), 60000);
    try {
      const response = await fetch(apiUrl('/api/llm/interview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ apiKey: config.apiKey, endpoint, model: config.model, prompt: nextPrompt, conversation: priorConversation.slice(-8), context: buildContext(projectData, activeSceneId), attachments: serializeHarnessAttachments(attachmentsRef.current) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.interview) throw new Error(data.error || 'interview unavailable');
      const normalized = normalizeHarnessInterviewResponse(data.interview, fallback, 'model');
      setInterviewState(normalized.source === 'model' ? 'model' : 'local');
      return normalized;
    } catch (interviewError) {
      setInterviewState('unavailable');
      if (/abort|aborted|signal is aborted|timeout|timed out/i.test(String(interviewError instanceof Error ? interviewError.message : interviewError))) setError('');
      const timeoutReason = interviewError instanceof DOMException && interviewError.name === 'AbortError' ? '模型响应超时' : '';
      setError(`AI 需求评测暂不可用，已切换本地规则兜底：${presentGenerationError(interviewError)}`);
      if (timeoutReason) setError('AI 需求评测暂不可用，已切换本地 Harness 兜底：模型响应超时');
      return { ...fallback, ready: false, question: 'AI 需求理解未完成，本轮不会使用本地规则替代。请修复模型请求后重试。', options: [], source: 'unavailable' };
    } finally {
      window.clearTimeout(timeoutId);
      setIsGenerating(false);
      setGenerationPhase('idle');
    }
  }, [activeSceneId, config, projectData]);

  const presentInterviewResult = useCallback((result: HarnessInterviewResponse) => {
    if (result.source === 'unavailable') {
      setRequirementBrief(null);
      setConversationPhase('intake');
      addConversationMessage({ id: `c_${Date.now()}_unavailable`, role: 'assistant', text: 'AI 需求理解未完成。本轮未使用本地规则兜底，也不会进入正式场景生成；请修复模型请求后重试。', timestamp: Date.now() });
      return;
    }
    const hasImageReference = attachmentsRef.current.some((attachment) => attachment.status === 'ready' && attachment.category === 'image');
    if (hasImageReference && result.source === 'model' && result.brief.referenceAnalysis.length < 3) {
      setRequirementBrief(null);
      setConversationPhase('intake');
      setInterviewState('unavailable');
      setError('AI 未返回足够的参考图视觉拆解，已阻止生成，避免输出与附件无关的通用场景。请重试 AI 分析。');
      addConversationMessage({ id: `c_${Date.now()}_reference_missing`, role: 'assistant', text: 'AI 未完成可核对的参考图拆解。本轮不会生成场景；请重试，直到返回布局、配色、字体层级等具体观察。', timestamp: Date.now() });
      return;
    }
    setRequirementBrief(result.brief);
    const attachmentCount = attachmentsRef.current.filter((attachment) => attachment.status === 'ready').length;
    const reviewNote = result.source === 'model'
      ? '已完成 AI 需求评测，并由 Harness 约束为可执行方案。'
      : '当前模型未完成评测，本轮使用本地规则兜底；生成方案前仍会执行 Harness 结构与布局检查。';
    const auditNote = attachmentCount > 0
      ? `我已检查当前工程结构和 ${attachmentCount} 个附件。${reviewNote}`
      : `我已检查当前工程结构和可用能力。${reviewNote}`;
    if (!result.ready) {
      setConversationPhase('clarifying');
      addConversationMessage({ id: `c_${Date.now()}_assistant`, role: 'assistant', text: `${auditNote}\n先确认一个会影响方案的关键决定：${result.question}`, suggestions: result.options, timestamp: Date.now() });
      return;
    }
    setConversationPhase('briefing');
    addConversationMessage({ id: `c_${Date.now()}_brief`, role: 'assistant', text: `${auditNote}\n需求已具备生成条件：${summarizeHarnessBrief(result.brief)}`, timestamp: Date.now() });
  }, [addConversationMessage]);

  const handleClarificationReply = useCallback(async (reply: string) => {
    if (interviewState === 'loading') return;
    const nextPrompt = appendHarnessReply(prompt, reply);
    const userMessage = { id: `c_${Date.now()}`, role: 'user' as const, text: reply, timestamp: Date.now() };
    const nextConversation = [...conversation, userMessage];
    setPrompt(nextPrompt);
    addConversationMessage(userMessage);
    addMemory({ id: `m_${Date.now()}`, role: 'user', text: reply, timestamp: Date.now() });
    presentInterviewResult(await requestHarnessInterview(nextPrompt, nextConversation));
  }, [addConversationMessage, addMemory, conversation, interviewState, presentInterviewResult, prompt, requestHarnessInterview]);

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const cleanPrompt = (promptOverride ?? prompt).trim()
      || (attachmentsRef.current.length > 0 || referenceUrl.trim() ? '请分析已上传的参考文件或网页，并生成可执行的编辑方案。' : '');
    if (!cleanPrompt || isGenerating || isApplying || interviewState === 'loading') return;
    const reference = await analyzeReference();
    const contextPrompt = withReferenceContext(cleanPrompt, reference);
    const userMessage = { id: `c_${Date.now()}`, role: 'user' as const, text: cleanPrompt, timestamp: Date.now() };
    const nextConversation = [...conversation, userMessage];
    addConversationMessage(userMessage);
    addMemory({ id: `m_${Date.now()}`, role: 'user', text: cleanPrompt, timestamp: Date.now() });
    setProposal(null);
    setHarnessRun(null);
    setError('');
    presentInterviewResult(await requestHarnessInterview(contextPrompt, nextConversation));
  }, [addConversationMessage, addMemory, analyzeReference, conversation, interviewState, isApplying, isGenerating, presentInterviewResult, prompt, requestHarnessInterview, withReferenceContext]);

  const handlePlanGeneration = useCallback(async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isGenerating) return;
    const generationPrompt = buildHarnessGenerationPrompt(withReferenceContext(cleanPrompt, referenceBrief), requirementBrief);
    const generationId = generationIdRef.current + 1;
    generationIdRef.current = generationId;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(new Error('MODEL_GENERATION_TIMEOUT')), 120000);
    setIsGenerating(true);
    setConversationPhase('planning');
    setGenerationPhase('connecting');
    setError('');
    setProposal(null);
    setHarnessRun(null);
    try {
      const endpoint = normalizeSceneEndpoint(getChatEndpoint(config.providerId, config.customEndpoint));
      let nextProposal: AiSceneProposal | null = null;
      if (config.apiKey.trim() && endpoint && config.model.trim()) {
        const response = await fetch(apiUrl('/api/llm/scene-generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            apiKey: config.apiKey,
            endpoint,
            model: config.model,
            prompt: generationPrompt,
            context: buildContext(projectData, activeSceneId),
            attachments: serializeHarnessAttachments(attachmentsRef.current),
            evaluate: true,
          }),
        });
        setGenerationPhase('interpreting');
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || '模型没有返回可执行方案');
        nextProposal = sanitizeAiSceneProposal({ ...data.proposal, evaluation: data.evaluation }, 'model');
        if (nextProposal) nextProposal = addReferenceBackdrop(nextProposal, attachmentsRef.current);
        if (!nextProposal) throw new Error('模型返回的方案不符合 AETHER 工程协议');
      } else {
        throw new Error('未配置可用 AI 模型。请先填写 API Key、模型和 API 端点后重试。');
      }
      if (generationId !== generationIdRef.current) return;
      setGenerationPhase('auditing');
      if (!nextProposal.evaluation) {
        nextProposal = {
          ...nextProposal,
          evaluation: nextProposal.source === 'model'
            ? { source: 'unavailable', status: 'deferred', summary: '独立 AI 评测未返回结果，已转为本地 Harness 审计。', issues: [], repairInstructions: [] }
            : { source: 'local', status: 'deferred', summary: '本地兼容方案未经过 AI 评测。', issues: [], repairInstructions: [] },
        };
      }
      setProposal(nextProposal);
      setHarnessRun(createHarnessRun(nextProposal));
      const quality = scoreHarnessProposal(nextProposal, projectData, activeSceneId);
      const visualErrors = nextProposal.layout.visualIssues.filter((issue) => issue.severity === 'error').length;
      const evaluation = nextProposal.evaluation;
      const evaluationNote = evaluation?.source === 'model'
        ? `独立 AI 评测：${evaluation.status === 'passed' ? '通过' : '需要复核'}${evaluation.score !== undefined ? `（${evaluation.score}/100）` : ''}。${evaluation.summary}`
        : `独立 AI 评测：暂不可用。已转为本地 Harness 结构审计（${quality.score}/100，${quality.grade}）。`;
      addMemory({
        id: `m_${Date.now()}_result`,
        role: 'system',
        text: nextProposal.summary,
        proposalTitle: nextProposal.title,
        timestamp: Date.now(),
      });
      addConversationMessage({ id: `c_${Date.now()}_plan`, role: 'assistant', text: `执行方案已生成：${nextProposal.title}。${evaluationNote} Harness 本地检查：${quality.score}/100（${quality.grade}），${visualErrors ? `发现 ${visualErrors} 项阻断问题，修正后才能写入。` : '未发现阻断问题，可确认写入。'}`, timestamp: Date.now() });
    } catch (generationError) {
      // Do not fabricate a local scene when the model cannot complete.
      // Keep the conversation and surface an actionable retry state.
      if (generationId !== generationIdRef.current) return;
      if (isRecoverableModelOutputError(generationError)) {
        setProposal(null);
        setHarnessRun(null);
        const reason = presentGenerationError(generationError);
        setError(`AI 方案生成被阻断，未创建本地替代方案。${reason}`);
        addConversationMessage({ id: `c_${Date.now()}_blocked`, role: 'assistant', text: `AI 方案生成未完成，本次没有创建本地方案。Harness 已保留当前上下文；请修复模型请求后重试。原因：${reason}`, timestamp: Date.now() });
        return;
        /*
        const rawFallbackProposal = createLocalAiSceneProposal(generationPrompt);
        const fallbackProposal = {
          ...rawFallbackProposal,
          evaluation: { source: 'local' as const, status: 'deferred' as const, summary: '模型服务不可用，本地兼容方案未经过 AI 评测。', issues: [], repairInstructions: [] },
        };
        setGenerationPhase('auditing');
        setProposal(fallbackProposal);
        setHarnessRun(createHarnessRun(fallbackProposal));
        const fallbackQuality = scoreHarnessProposal(fallbackProposal, projectData, activeSceneId);
        const fallbackReason = presentGenerationError(generationError);
        setError(`模型方案已切换为本地兼容方案。未通过 AI 评测；Harness 仍会执行结构、布局和可编辑性检查。原因：${fallbackReason}`);
        setError('模型服务暂时不可用或输出未通过 AETHER 协议，已切换为本地兼容方案。该方案未经过 AI 评测，但仍会执行 Harness 结构、布局和可编辑性检查；请稍后重试模型生成。');
        addMemory({
          id: `m_${Date.now()}_fallback`,
          role: 'system',
          text: '模型输出未通过协议校验，已生成本地兼容方案。',
          proposalTitle: fallbackProposal.title,
          timestamp: Date.now(),
        });
        addConversationMessage({ id: `c_${Date.now()}_fallback`, role: 'assistant', text: `模型服务暂时不可用，未完成 AI 评测；已切换为本地兼容方案。Harness 本地检查结果：${fallbackQuality.score}/100（${fallbackQuality.grade}），仍可预览、编辑和确认写入。`, timestamp: Date.now() });
        return;
        */
      }
      setError(presentGenerationError(generationError));
    } finally {
      if (generationId === generationIdRef.current) {
        setIsGenerating(false);
        setGenerationPhase('idle');
        abortControllerRef.current = null;
      }
      window.clearTimeout(timeoutId);
    }
  }, [activeSceneId, addConversationMessage, addMemory, config, isGenerating, projectData, prompt, referenceBrief, requirementBrief, withReferenceContext]);

  handleGenerateRef.current = handleGenerate;

  const handleTestConnection = useCallback(async () => {
    const endpoint = normalizeSceneEndpoint(getChatEndpoint(config.providerId, config.customEndpoint));
    if (!config.apiKey.trim() || !endpoint || !config.model.trim()) {
      setConnectionState('error');
      setError('请先填写 API Key、模型名称和 API 端点。');
      return;
    }
    setConnectionState('testing');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/llm/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: config.apiKey, endpoint, model: config.model }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || '连接失败');
      setConnectionState('ok');
    } catch (testError) {
      setConnectionState('error');
      setError(presentGenerationError(testError));
    }
  }, [config]);

  const handleApply = useCallback(() => {
    if (!proposal || applyingRef.current) return;
    // Overlap is resolved by applyAiSceneProposal's auto-layout pass. Keep only
    // issues that cannot be repaired during write as a hard gate.
    const blockingVisualIssues = proposal.layout.visualIssues.filter((issue) => issue.severity === 'error' && issue.code !== 'overlap');
    if (blockingVisualIssues.length > 0) {
      setError(`方案未通过视觉检查：${blockingVisualIssues[0].message} 请重新生成后再写入。`);
      return;
    }
    const run = harnessRun || createHarnessRun(proposal);
    const runningRun = markHarnessRunning(run);
    setHarnessRun(runningRun);
    applyingRef.current = true;
    setIsApplying(true);
    try {
      const applied = onApply(proposal);
      setHarnessRun(markHarnessExecution(runningRun, applied));
      if (applied && applied.appliedOperationCount === 0) {
        setError('方案没有可写入的有效操作，请重新生成。');
        return;
      }
      addMemory({
        id: `m_${Date.now()}_applied`,
        role: 'system',
        text: '方案已写入当前工程，可通过历史记录撤销。',
        proposalTitle: proposal.title,
        timestamp: Date.now(),
      });
      addConversationMessage({ id: `c_${Date.now()}_applied`, role: 'assistant', text: `已将「${proposal.title}」写入当前工程。你可以继续提出局部修改，或使用右侧撤销上一次工程变更。`, timestamp: Date.now() });
      setProposal(null);
    } catch (applyError) {
      setHarnessRun({ ...markHarnessExecution(runningRun), status: 'failed' });
      setError(`写入工程失败：${presentGenerationError(applyError)}`);
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  }, [addMemory, harnessRun, onApply, proposal]);

  const layoutIssues = useMemo(() => proposal ? analyzeAiSceneProposal(proposal) : [], [proposal]);
  const visualIssues = proposal?.layout.visualIssues || [];
  const visualErrors = visualIssues.filter((issue) => issue.severity === 'error');
  const impactReport: HarnessImpactReport | null = useMemo(() => proposal ? analyzeHarnessImpact(proposal, projectData, activeSceneId) : null, [activeSceneId, projectData, proposal]);
  const qualityReport: HarnessQualityReport | null = useMemo(() => proposal ? scoreHarnessProposal(proposal, projectData, activeSceneId) : null, [activeSceneId, projectData, proposal]);
  const operationsByType = useMemo(() => {
    if (!proposal) return [];
    return Object.entries(proposal.operations.reduce<Record<string, number>>((result, operation) => {
      result[operation.kind] = (result[operation.kind] || 0) + 1;
      return result;
    }, {}));
  }, [proposal]);
  const visibleTemplates = useMemo(() => templateCategory === '全部'
    ? AI_GENERATION_TEMPLATES
    : AI_GENERATION_TEMPLATES.filter((template) => template.category === templateCategory), [templateCategory]);
  const templateCategories = useMemo(() => Array.from(new Set(AI_GENERATION_TEMPLATES.map((template) => template.category))), []);

  const handleUseTemplate = useCallback((template: AiGenerationTemplate) => {
    setPrompt(template.prompt);
    setProposal(null);
    setHarnessRun(null);
    setError('');
    setActiveMemoryId(null);
    window.setTimeout(() => void handleGenerate(template.prompt), 0);
  }, [handleGenerate]);

  const selectMemory = useCallback((item: AiMemoryItem) => {
    onToolModeChange?.('none');
    setActiveMemoryId(item.id);
    const taskPrompt = item.role === 'user'
      ? item.text
      : memory.slice().reverse().find((entry) => entry.role === 'user' && entry.timestamp <= item.timestamp)?.text || item.text;
    const historicalConversation: HarnessConversationMessage[] = [
      { id: `history_${item.id}_user`, role: 'user', text: taskPrompt, timestamp: Math.max(0, item.timestamp - 1) },
      ...(item.role === 'system' ? [{ id: `history_${item.id}_result`, role: 'assistant' as const, text: `${item.proposalTitle ? `方案「${item.proposalTitle}」：` : ''}${item.text}`, timestamp: item.timestamp }] : []),
    ];
    setPrompt(taskPrompt);
    setConversation(historicalConversation);
    setConversationPhase('intake');
    setRequirementBrief(null);
    setProposal(null);
    setHarnessRun(null);
    setError('');
    saveConversation(projectId, historicalConversation);
  }, [memory, onToolModeChange, projectId]);

  const generationPhaseIndex = { idle: 0, connecting: 1, interpreting: 2, auditing: 3 }[generationPhase];
  const generationPhaseLabels = [
    ['01', '连接模型'],
    ['02', '解析意图'],
    ['03', '审计布局'],
  ];

  const clearMemory = () => {
    setMemory([]);
    saveMemory([]);
    setActiveMemoryId(null);
  };

  if (!isOpen) return null;

  return (
    <AiAgentChatWorkspace
      projectTitle={projectData.meta.title}
      onUpdateProject={onUpdateProject}
      prompt={prompt}
      onPromptChange={setPrompt}
      promptRef={promptRef}
      conversation={conversation}
      conversationPhase={conversationPhase}
      requirementBrief={requirementBrief}
      onClarificationReply={(reply) => { void handleClarificationReply(reply); }}
      onGenerate={() => { void handleGenerate(); }}
      onPlanGeneration={() => { void handlePlanGeneration(); }}
      isGenerating={isGenerating}
      isApplying={isApplying}
      generationPhase={generationPhase}
      proposal={proposal}
      harnessRun={harnessRun}
      onApply={handleApply}
      onUndo={onUndo}
      canUndo={canUndo}
      error={error}
      templates={visibleTemplates}
      templateCategories={templateCategories}
      templateCategory={templateCategory}
      onTemplateCategoryChange={(category) => setTemplateCategory(category as AiTemplateCategory)}
      onUseTemplate={handleUseTemplate}
      attachments={attachments}
      attachmentError={attachmentError}
      fileInputRef={fileInputRef}
      onFiles={(files) => { void handleFiles(files); }}
      onRemoveAttachment={removeAttachment}
      referenceUrl={referenceUrl}
      onReferenceUrlChange={(value) => { setReferenceUrl(value); if (!value.trim()) { setReferenceBrief(null); setReferenceError(''); } }}
      referenceBrief={referenceBrief}
      isAnalyzingReference={isAnalyzingReference}
      referenceError={referenceError}
      config={config}
      onConfigChange={persistConfig}
      availableModels={modelOptions}
      modelDiscoveryState={modelDiscoveryState}
      modelDiscoveryMessage={modelDiscoveryMessage}
       memory={memory}
       activeMemoryId={activeMemoryId}
       onSelectMemory={selectMemory}
      onNewSession={startNewSession}
      onClose={onClose}
      toolMode={toolMode}
      onToolModeChange={onToolModeChange}
      toolPanel={toolPanel}
    />
  );

  return (
    <div
      className="ai-scene-builder aether-ai-dialog fixed inset-0 z-[15000] flex items-center justify-center bg-[#02060b]/80 p-3 backdrop-blur-md sm:p-5"
      role="presentation"
      onPaste={handlePaste}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="ai-scene-builder__shell aether-ai-dialog__shell flex h-[min(860px,calc(100dvh-24px))] w-[min(1320px,calc(100vw-24px))] min-w-0 flex-col overflow-hidden border border-white/15 bg-[#090d14] shadow-[0_32px_120px_rgba(0,0,0,.72)] sm:h-[min(860px,calc(100dvh-40px))]" role="dialog" aria-modal="true" aria-labelledby="ai-scene-builder-title">
        <style>{`
          .ai-scene-builder { --ai-cyan: #dbeafe; --ai-blue: #8bb7ff; --ai-violet: #c4b5fd; --ai-ink: #07144e; --ai-panel: rgba(18, 42, 128, .72); --ai-line: rgba(196,216,255,.18); color-scheme: dark; }
          .ai-scene-builder select option { background: #07111a; color: #f8fafc; }
          .ai-scene-builder__shell::selection { background: rgba(103,232,249,.3); }
          .ai-scene-builder__shell { position: relative; isolation: isolate; background-color: #07144e !important; border-color: rgba(164,197,255,.22) !important; }
          .ai-scene-builder__shell > .grid > main { background-color: #102879 !important; }
          .ai-scene-builder__shell > .grid > aside { background-color: #07144e !important; }
          .ai-scene-builder__shell::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .25; background-image: linear-gradient(rgba(130,170,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(130,170,255,.05) 1px, transparent 1px); background-size: 28px 28px; mask-image: linear-gradient(to bottom, #000, transparent 88%); }
          .ai-scene-builder button, .ai-scene-builder textarea, .ai-scene-builder input, .ai-scene-builder select { touch-action: manipulation; cursor: pointer; }
          .ai-scene-builder textarea, .ai-scene-builder input, .ai-scene-builder select { cursor: text; }
          .ai-scene-builder button:focus-visible, .ai-scene-builder textarea:focus-visible, .ai-scene-builder input:focus-visible, .ai-scene-builder select:focus-visible { outline: 2px solid rgba(103,232,249,.82); outline-offset: 2px; }
          .ai-scene-builder__scroll { scrollbar-color: rgba(103,232,249,.28) transparent; }
          .ai-scene-builder__scroll::-webkit-scrollbar { width: 8px; height: 8px; }
          .ai-scene-builder__scroll::-webkit-scrollbar-thumb { background: rgba(103,232,249,.22); border-radius: 4px; }
          .ai-scene-builder__eyebrow { font: 600 9px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .16em; text-transform: uppercase; }
          .ai-scene-builder__field-label { font-size: 10px; font-weight: 600; letter-spacing: .02em; color: #94a3b8; }
          .ai-scene-builder__glass { background: linear-gradient(145deg, rgba(40,83,206,.42), rgba(9,23,83,.7)); border: 1px solid rgba(150,190,255,.24); box-shadow: inset 0 1px 0 rgba(255,255,255,.09), 0 14px 38px rgba(1,8,55,.2); }
          .ai-scene-builder__accent-line { position: relative; }
          .ai-scene-builder__accent-line::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, rgba(103,232,249,.75), rgba(167,139,250,.45), transparent 78%); }
          .ai-scene-builder__pipeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid rgba(255,255,255,.09); background: rgba(3,9,15,.58); }
          .ai-scene-builder__pipeline-step { position: relative; min-width: 0; padding: 10px 12px; border-right: 1px solid rgba(255,255,255,.08); }
          .ai-scene-builder__pipeline-step:last-child { border-right: 0; }
          .ai-scene-builder__pipeline-step[data-active='true'] { background: linear-gradient(135deg, rgba(103,232,249,.1), rgba(167,139,250,.05)); }
          .ai-scene-builder__pipeline-step[data-current='true']::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; background: #67e8f9; box-shadow: 0 0 14px rgba(103,232,249,.8); }
          @media (max-width: 1023px) {
            .ai-scene-builder__shell { height: min(900px, calc(100dvh - 24px)); }
            .ai-scene-builder__shell > .grid { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
            .ai-scene-builder__shell > .grid > main { flex: 0 0 auto; min-height: 430px; overflow: visible; }
            .ai-scene-builder__shell > .grid > aside { flex: 0 0 auto; min-height: 150px; overflow: visible; }
            .ai-scene-builder__shell > .grid > aside:last-child { min-height: 360px; }
          }
          @media (prefers-reduced-motion: reduce) {
            .ai-scene-builder *, .ai-scene-builder *::before, .ai-scene-builder *::after { animation: none !important; transition: none !important; }
          }
        `}</style>

        <header className="relative flex min-h-[58px] shrink-0 items-center justify-between gap-3 border-b border-blue-200/15 bg-[#0a1d66]/95 px-4 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-cyan-200/45 bg-cyan-200/[.08] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,.12)]">
              <Bot size={16} strokeWidth={1.7} />
              <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="ai-scene-builder-title" className="truncate text-[14px] font-semibold tracking-[.01em] text-white sm:text-[15px]">AETHER Agent</h2>
                <span className="hidden border border-cyan-300/25 bg-cyan-300/[.04] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[.12em] text-cyan-200/80 sm:inline">HARNESS</span>
              </div>
              <p className="mt-0.5 truncate text-[9px] text-slate-500">需求对话 · 工具规划 · 可编辑工程</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-3 sm:flex">
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-300/90"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />LOCAL MEMORY {memory.filter((item) => item.role === 'user').length}</span>
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500"><ShieldCheck size={12} className="text-cyan-300/75" />TOOL SANDBOX</span>
            </div>
            <button type="button" onClick={onClose} aria-label="关闭 Agent Harness 工作台" title="关闭工作台" className="flex h-10 w-10 items-center justify-center border border-white/10 text-slate-400 transition hover:border-cyan-200/40 hover:bg-cyan-200/[.08] hover:text-white"><X size={17} /></button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[238px_minmax(0,1fr)_300px]">
          <aside className="ai-scene-builder__scroll order-2 min-h-0 overflow-y-auto border-t border-blue-200/15 bg-[#07144e]/75 lg:order-1 lg:border-r lg:border-t-0">
            <div className="border-b border-white/10 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><History size={14} className="text-cyan-300" />会话</div>
                <button type="button" onClick={startNewSession} title="新建会话" aria-label="新建会话" className="flex h-8 w-8 items-center justify-center border border-white/10 text-slate-400 transition hover:border-cyan-300/40 hover:bg-cyan-300/[.08] hover:text-white"><Plus size={14} /></button>
              </div>
              <div className="mt-3 flex items-center gap-2 border border-white/10 bg-black/10 px-2.5 py-2 text-[9px] text-slate-500"><LayoutDashboard size={12} className="shrink-0 text-cyan-300/70" /><span className="min-w-0 truncate">{projectData.meta.title || '未命名工程'}</span></div>
              <div className="mt-2 flex items-center gap-2 border border-white/10 bg-black/10 px-2.5 py-2"><Search size={12} className="shrink-0 text-slate-600" /><input value={sessionQuery} onChange={(event) => setSessionQuery(event.target.value)} placeholder="搜索会话" aria-label="搜索会话" className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-600" /></div>
            </div>
            <div className="border-b border-white/10 px-3.5 py-3"><div className="ai-scene-builder__eyebrow text-cyan-300/75">CURRENT PROJECT</div><div className="mt-1 truncate font-mono text-[9px] text-slate-600">{projectId}</div><div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-300/80"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />本地记忆已开启</div></div>
            <div className="space-y-1.5 p-2.5">
              {memory.length === 0 && <div className="px-2 py-8 text-center text-[10px] leading-5 text-slate-600">本工程的指令和方案会保留在这里。</div>}
              {memory.filter((item) => !sessionQuery.trim() || item.text.toLowerCase().includes(sessionQuery.trim().toLowerCase())).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setActiveMemoryId(item.id); if (item.role === 'user') setPrompt(item.text); }}
                  className={`w-full border px-2.5 py-2 text-left transition ${activeMemoryId === item.id ? 'border-cyan-300/35 bg-cyan-300/[.08]' : 'border-transparent hover:border-white/10 hover:bg-white/[.04]'}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[9px] text-slate-600"><span>{item.role === 'user' ? '指令' : '系统'}</span><span>{formatTime(item.timestamp)}</span></div>
                  <p className={`mt-1 line-clamp-3 text-[10px] leading-4 ${item.role === 'user' ? 'text-slate-300' : 'text-cyan-200/75'}`}>{item.text}</p>
                  {item.proposalTitle && <p className="mt-1 truncate text-[9px] text-violet-300/70">{item.proposalTitle}</p>}
                </button>
              ))}
            </div>
          </aside>

          <main className="ai-scene-builder__scroll order-1 min-h-0 overflow-y-auto bg-[#102879]/45 px-4 py-4 sm:px-7 lg:order-2">
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="ai-scene-builder__eyebrow flex items-center gap-2 text-cyan-300/80"><MessageSquareText size={12} />NEW TASK</div>
                  <h3 className="mt-1.5 text-base font-semibold tracking-normal text-white sm:text-lg">描述你要完成的工作</h3>
                </div>
                <span className="hidden items-center gap-1.5 font-mono text-[9px] text-slate-600 sm:flex"><Command size={11} />CTRL + ENTER</span>
              </div>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.glb,.gltf,.obj,.fbx,.stl,.3mf,.dae,.ply,.splat,.ksplat,.aether,.zip,.json,.html,.htm,.txt,.md,.csv,.xml" className="hidden" onChange={(event) => { if (event.target.files) void handleFiles(event.target.files); event.currentTarget.value = ''; }} />
              <div
                className={`mb-2 border px-3 py-2.5 transition ${isDragOver ? 'border-cyan-300/70 bg-cyan-300/[.08]' : 'border-white/10 bg-[#071019]/70 hover:border-white/20'}`}
                onDragEnter={(event) => { event.preventDefault(); setIsDragOver(true); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsDragOver(true); }}
                onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragOver(false); }}
                onDrop={(event) => { event.preventDefault(); setIsDragOver(false); void handleFiles(event.dataTransfer.files); }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-[10px] text-slate-500"><Paperclip size={13} className="shrink-0 text-cyan-300/75" /><span className="truncate">拖入或粘贴图片、视频、音频、3D、工程或文本文件</span></div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-8 shrink-0 items-center gap-1.5 border border-white/10 px-2.5 text-[10px] text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/[.06] hover:text-white"><Plus size={12} />添加文件</button>
                </div>
              </div>
              {attachments.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5" aria-label="当前会话附件">
                {attachments.map((attachment) => <div key={attachment.id} className={`group flex max-w-full items-center gap-1.5 border px-2 py-1.5 text-[9px] ${attachment.status === 'ready' ? 'border-cyan-300/20 bg-cyan-300/[.04] text-slate-300' : 'border-amber-300/25 bg-amber-300/[.04] text-amber-100'}`} title={attachment.statusMessage || `${attachmentCategoryLabel[attachment.category]} · ${formatHarnessAttachmentSize(attachment.size)}`}>
                  {attachment.category === 'image' && attachment.previewUrl ? <img src={attachment.previewUrl} alt="" className="h-5 w-5 object-cover" /> : <HarnessAttachmentIcon category={attachment.category} size={13} />}
                  <span className="max-w-[180px] truncate">{attachment.name}</span><span className="font-mono text-[8px] text-slate-600">{attachment.status === 'ready' ? attachmentCategoryLabel[attachment.category] : attachment.statusMessage || '不可用'}</span>
                  <button type="button" onClick={() => removeAttachment(attachment)} aria-label={`移除 ${attachment.name}`} title="移除附件" className="ml-0.5 flex h-5 w-5 items-center justify-center text-slate-600 transition hover:text-rose-300"><X size={11} /></button>
                </div>)}
              </div>}
              {attachmentError && <div className="mb-3 flex items-center gap-1.5 text-[9px] text-amber-200"><AlertTriangle size={12} />{attachmentError}</div>}
              <label htmlFor="ai-scene-prompt" className="sr-only">场景生成指令</label>
              <textarea
                id="ai-scene-prompt"
                ref={promptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="例如：做一个冷却系统监控场景，左侧显示压力和温度，右侧放趋势与报警，自动绑定 MQTT 样例数据。"
                className="ai-scene-builder__glass min-h-28 w-full resize-y border-cyan-300/35 bg-[#07121c]/90 p-4 text-[14px] leading-6 text-white placeholder:text-slate-600 transition focus:border-cyan-200/80 focus:bg-[#091722] sm:min-h-32 sm:text-[15px]"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><CircleHelp size={12} className="text-cyan-300/70" />先预览，确认后才写入工程</span>
                <span className={prompt.length > 3600 ? 'text-amber-300' : ''}>{prompt.length}/4000</span>
              </div>
               <div className="mt-3 flex flex-wrap items-center justify-between gap-3" aria-label="Composer 操作">
                 <div className="flex flex-wrap gap-2" aria-label="快速指令">
                  {['设备监控大屏', '产品发布场景', '数据趋势分析'].map((sample) => (
                    <button key={sample} type="button" onClick={() => { setPrompt(`生成一个${sample}，包含标题、核心指标、趋势和状态信息，自动绑定 MQTT 样例数据。`); setProposal(null); setHarnessRun(null); setError(''); }} className="flex min-h-9 items-center gap-1.5 border border-white/10 bg-white/[.025] px-2.5 text-[10px] text-slate-400 transition hover:border-cyan-300/35 hover:bg-cyan-300/[.06] hover:text-cyan-100"><MessageSquareText size={12} />{sample}<ArrowUpRight size={11} className="text-slate-600" /></button>
                   ))}
                 </div>
                 <button type="button" onClick={() => void handleGenerate()} disabled={isGenerating || isApplying || !prompt.trim()} className="flex min-h-10 items-center gap-2 bg-cyan-300 px-4 text-[11px] font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.12)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"><Send size={13} />{isGenerating ? '处理中' : '发送给 Agent'}</button>
               </div>

               <section className="mt-6 border border-cyan-300/20 bg-[#071019]/75" aria-labelledby="harness-conversation-title">
                 <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                   <div><div className="ai-scene-builder__eyebrow flex items-center gap-2 text-cyan-300/80"><MessageSquareText size={12} />REQUIREMENT BRIDGE</div><h4 id="harness-conversation-title" className="mt-1 text-sm font-semibold text-slate-100">需求协作</h4></div>
                    <div className="flex items-center gap-2"><span className={`border px-2 py-1 font-mono text-[8px] ${conversationPhase === 'clarifying' ? 'border-amber-300/30 text-amber-200' : conversationPhase === 'briefing' ? 'border-cyan-300/30 text-cyan-200' : conversationPhase === 'planning' ? 'border-emerald-300/30 text-emerald-200' : 'border-white/10 text-slate-600'}`}>{conversationPhase.toUpperCase()}</span>{interviewState !== 'idle' && <span className={`font-mono text-[8px] ${interviewState === 'model' ? 'text-emerald-300/80' : interviewState === 'loading' ? 'text-cyan-200/80' : interviewState === 'unavailable' ? 'text-rose-200/80' : 'text-amber-200/80'}`}>{interviewState === 'model' ? 'AI REVIEWED' : interviewState === 'loading' ? 'ANALYZING' : interviewState === 'unavailable' ? 'AI UNAVAILABLE' : 'RULE FALLBACK'}</span>}</div>
                 </div>
                 <div className="space-y-2 px-4 py-3">
                   {conversation.slice(-4).map((message) => <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}><div className={`max-w-[88%] border px-3 py-2 text-[10px] leading-5 ${message.role === 'user' ? 'border-violet-300/20 bg-violet-300/[.06] text-slate-300' : 'border-cyan-300/15 bg-cyan-300/[.035] text-slate-400'}`}>{message.text}</div></div>)}
                   {conversation.length === 0 && <p className="text-[10px] leading-5 text-slate-600">Harness 会先理解目标，再和你确认关键决策。</p>}
                   {conversationPhase === 'clarifying' && conversation.slice(-1)[0]?.suggestions && <div className="flex flex-wrap gap-1.5 pt-1">{conversation.slice(-1)[0].suggestions?.map((suggestion) => <button key={suggestion} type="button" onClick={() => handleClarificationReply(suggestion)} className="border border-amber-300/25 bg-amber-300/[.05] px-2.5 py-2 text-[10px] text-amber-100 transition hover:bg-amber-300/[.12]">{suggestion}</button>)}</div>}
                 </div>
                 {requirementBrief && conversationPhase === 'briefing' && <div className="border-t border-white/10 px-4 py-3">
                   <div className="ai-scene-builder__eyebrow text-violet-300/80">REQUIREMENT BRIEF</div>
                   <div className="mt-2 grid gap-2 sm:grid-cols-2">
                     {[['交付物', requirementBrief.deliverable], ['目标用户', requirementBrief.audience], ['视觉方向', requirementBrief.visualDirection], ['参考图拆解', requirementBrief.referenceAnalysis.join(' · ') || '未检测到可核对的图片特征'], ['数据策略', requirementBrief.dataStrategy], ['交互策略', requirementBrief.interactionStrategy], ['素材策略', requirementBrief.assetStrategy]].map(([label, value]) => <div key={label} className="border border-white/[.08] bg-black/10 px-2.5 py-2"><div className="text-[9px] text-slate-600">{label}</div><div className="mt-1 text-[10px] leading-4 text-slate-300">{value}</div></div>)}
                   </div>
                   <button type="button" onClick={() => void handlePlanGeneration()} disabled={isGenerating || isApplying} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 bg-cyan-300 px-4 text-[11px] font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"><WandSparkles size={13} />确认简报，开始生成方案</button>
                 </div>}
               </section>

               <section className="mt-7" aria-labelledby="ai-template-title">
                <div className="flex items-end justify-between gap-3">
                  <div><div className="ai-scene-builder__eyebrow flex items-center gap-2 text-violet-300/80"><Sparkles size={12} />START FROM A TEMPLATE</div><h4 id="ai-template-title" className="mt-1.5 text-sm font-semibold text-slate-100">AI 生成模板</h4></div>
                  <span className="hidden font-mono text-[9px] text-slate-600 sm:block">PROMPT + TOOL ROUTING</span>
                </div>
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="AI 模板分类">
                  {(['全部', '数据大屏', '展厅大屏', '展陈交互', '产品发布', '视觉动效'] as AiTemplateCategory[]).map((category) => <button key={category} type="button" role="tab" aria-selected={templateCategory === category} onClick={() => setTemplateCategory(category)} className={`shrink-0 border px-2.5 py-1.5 text-[9px] transition ${templateCategory === category ? 'border-cyan-300/45 bg-cyan-300/[.09] text-cyan-100' : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'}`}>{category}</button>)}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {visibleTemplates.map((template) => <button key={template.id} type="button" onClick={() => handleUseTemplate(template)} className="group relative overflow-hidden border border-white/10 bg-[#071019]/80 p-2.5 text-left transition hover:border-white/25 hover:bg-[#0b1722]">
                    <div className="relative flex h-16 items-center gap-1.5 overflow-hidden border border-white/[.07] bg-[#0a111a] p-2" style={{ boxShadow: `inset 3px 0 0 ${template.accent}` }}>
                      <div className="h-full w-[30%] border border-white/[.08] bg-white/[.025] p-1"><div className="h-1.5 w-2/3" style={{ backgroundColor: template.accent, opacity: .8 }} /><div className="mt-1 h-1 w-full bg-white/10" /><div className="mt-1 h-1 w-4/5 bg-white/10" /></div>
                      <div className="flex min-w-0 flex-1 flex-wrap content-center gap-1"><span className="h-5 w-[46%] border border-white/10 bg-white/[.04]" /><span className="h-5 w-[46%] border border-white/10 bg-white/[.04]" /><span className="h-7 w-full border border-white/10 bg-white/[.025]" /></div>
                      <span className="absolute right-2 top-1.5 font-mono text-[8px]" style={{ color: template.accent }}>AI</span>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-2"><span className="truncate text-[11px] font-semibold text-slate-200 group-hover:text-white">{template.name}</span><ArrowUpRight size={12} className="shrink-0 text-slate-600 transition group-hover:text-cyan-200" /></div>
                    <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{template.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{template.tags.map((tag) => <span key={tag} className="border border-white/[.08] px-1.5 py-0.5 font-mono text-[8px] text-slate-600">{tag}</span>)}</div>
                  </button>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Harness 能力域">{HARNESS_TEMPLATE_CAPABILITY_GROUPS.map((group) => <span key={group.id} className="border border-white/[.08] bg-white/[.02] px-2 py-1 text-[8px] text-slate-500"><span className="text-slate-300">{group.label}</span> · {group.tools.length} 工具</span>)}</div>
              </section>

              <div className="ai-scene-builder__pipeline mt-6" aria-label="生成流程">
                {generationPhaseLabels.map(([number, label], index) => {
                  const active = isGenerating && index < generationPhaseIndex;
                  const current = isGenerating && index === generationPhaseIndex - 1;
                  return (
                    <div key={number} className="ai-scene-builder__pipeline-step" data-active={active || current} data-current={current}>
                      <div className={`font-mono text-[9px] ${active || current ? 'text-cyan-200' : 'text-slate-600'}`}>{number}</div>
                      <div className={`mt-1 truncate text-[10px] ${active || current ? 'text-slate-200' : 'text-slate-500'}`}>{label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border border-cyan-200/15 bg-[#050b12]/80" aria-label="Agent Harness 执行状态">
                <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center border border-cyan-200/25 bg-cyan-200/[.06] text-cyan-200"><Wrench size={13} /></div>
                    <div><div className="ai-scene-builder__eyebrow text-cyan-300/75">AGENT HARNESS</div><div className="mt-1 text-[11px] font-semibold text-slate-200">工具执行队列</div></div>
                  </div>
                  <span className={`font-mono text-[9px] ${harnessRun?.status === 'succeeded' ? 'text-emerald-300' : harnessRun?.status === 'partial' ? 'text-amber-300' : 'text-slate-600'}`}>{harnessRun ? harnessRun.status.toUpperCase() : 'IDLE'}</span>
                </div>
                {!harnessRun && <div className="px-3.5 py-3 text-[10px] leading-5 text-slate-600">生成后将把场景需求拆成工具调用，并在确认前保持只读。</div>}
                {harnessRun && <div className="divide-y divide-white/[.06]">
                  {harnessRun.steps.map((step) => {
                    const tool = getHarnessTool(step.toolId);
                    const statusColor = step.status === 'succeeded' ? 'text-emerald-300' : step.status === 'skipped' ? 'text-amber-300' : step.status === 'failed' ? 'text-rose-300' : step.status === 'running' ? 'text-cyan-200' : 'text-slate-500';
                    return <div key={step.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center border border-white/10 ${statusColor}`}>{step.status === 'succeeded' ? <CheckCircle2 size={12} /> : step.status === 'running' ? <Loader2 size={11} className="animate-spin" /> : <CircleDot size={11} />}</span>
                      <div className="min-w-0"><div className={`text-[10px] ${statusColor}`}>{step.label}</div><div className="truncate text-[9px] text-slate-600">{tool.id} · {step.detail}</div></div>
                      <span className={`ml-auto shrink-0 font-mono text-[8px] ${statusColor}`}>{step.status}</span>
                    </div>;
                  })}
                </div>}
              </div>

              <div className="ai-scene-builder__accent-line mt-8 flex items-center justify-between border-b border-white/10 pb-3 pt-3">
                <div><div className="ai-scene-builder__eyebrow flex items-center gap-2 text-violet-300/80"><LayoutDashboard size={12} />PROPOSAL PREVIEW</div><div className="mt-1 text-sm font-semibold text-slate-100">生成前预览</div></div>
                {proposal && <span className={`text-[10px] ${proposal.source === 'model' ? 'text-emerald-300' : 'text-amber-300'}`}>{proposal.source === 'model' ? '模型方案' : '本地样例方案'}</span>}
              </div>

              {!proposal && !isGenerating && (
                <div className="ai-scene-builder__glass relative flex min-h-64 flex-col items-center justify-center overflow-hidden px-6 text-center">
                  <div className="absolute left-0 top-0 h-px w-28 bg-cyan-300 shadow-[0_0_22px_#67e8f9]" />
                  <div className="flex h-14 w-14 items-center justify-center border border-cyan-300/30 bg-cyan-300/[.06] text-cyan-200 shadow-[0_0_32px_rgba(34,211,238,.12)]"><WandSparkles size={25} strokeWidth={1.5} /></div>
                  <p className="mt-4 text-sm font-medium text-slate-200">等待你的场景意图</p>
                  <p className="mt-1 max-w-md text-[10px] leading-5 text-slate-500">AI 会先拆解场景、图层、布局与数据绑定，再把每个动作交给你确认。</p>
                  {onLoadPresetDemo && (
                    <button
                      type="button"
                      onClick={() => {
                        onLoadPresetDemo();
                        onClose();
                      }}
                      className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/30 hover:border-cyan-400 shadow-lg shadow-cyan-950/50"
                    >
                      <Sparkles size={14} className="text-cyan-300" />
                      <span>暂无密钥？一键加载预设演示场景</span>
                    </button>
                  )}
                  <div className="mt-5 flex items-center gap-2 font-mono text-[9px] text-slate-600"><span className="h-px w-7 bg-white/10" />READY FOR INPUT<span className="h-px w-7 bg-white/10" /></div>
                </div>
              )}
              {isGenerating && (
                <div className="ai-scene-builder__glass flex min-h-64 flex-col items-center justify-center border-cyan-300/25 bg-cyan-300/[.035] text-center">
                  <div className="flex h-14 w-14 items-center justify-center border border-cyan-300/35 text-cyan-200 shadow-[0_0_34px_rgba(34,211,238,.18)]"><Loader2 size={24} className="animate-spin" /></div>
                  <p className="mt-4 text-sm font-medium text-cyan-100">{generationPhase === 'connecting' ? '正在连接模型' : generationPhase === 'interpreting' ? '正在解析场景意图' : '正在审计工程布局'}</p>
                  <p className="mt-1 text-[10px] text-slate-500">检查组件能力、布局关系和 MQTT 绑定</p>
                </div>
              )}
              {proposal && !isGenerating && (
                <div className="space-y-3 pt-3">
                  <div className="ai-scene-builder__glass p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="ai-scene-builder__eyebrow flex items-center gap-2 text-emerald-300/80"><Activity size={12} />PLAN READY</div><p className="mt-2 text-[15px] font-semibold text-white">{proposal.title}</p><p className="mt-1.5 text-[11px] leading-5 text-slate-400">{proposal.summary}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-500"><span className="border border-cyan-300/20 bg-cyan-300/[.04] px-2 py-1 text-cyan-200/80">工业仪表风格</span><span className="border border-white/10 px-2 py-1">控制室总览版式</span></div></div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/[.06]"><Check size={15} className="text-emerald-300" /></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {operationsByType.map(([kind, count]) => <div key={kind} className="border border-white/10 bg-black/15 px-3 py-2.5"><div className="font-mono text-lg text-cyan-100">{count}</div><div className="mt-0.5 text-[9px] text-slate-500">{operationLabel[kind] || kind}</div></div>)}
                    </div>
                  </div>
                  <div className="border border-white/10 bg-[#071019]/75">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><div className="ai-scene-builder__eyebrow text-violet-300/80">ACTION GRAPH</div><span className="mt-1 block text-[11px] font-semibold text-slate-200">执行清单</span></div><span className="font-mono text-[10px] text-slate-600">{proposal.operations.length} OPS</span></div>
                    <div className="divide-y divide-white/[.06]">
                      {proposal.operations.map((operation, index) => <div key={`${operation.kind}-${index}`} className="flex items-center gap-2.5 px-3.5 py-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center border border-cyan-300/25 font-mono text-[9px] text-cyan-200">{String(index + 1).padStart(2, '0')}</span><span className="text-[10px] text-slate-300">{operationLabel[operation.kind] || operation.kind}</span><span className="min-w-0 truncate text-[10px] text-slate-600">{operation.kind === 'create-element' ? operation.element.name || operation.element.sourceName : operation.kind === 'create-scene' ? operation.name : operation.kind === 'bind-mqtt' ? operation.pluginId : '场景属性'}</span><Check size={12} className="ml-auto shrink-0 text-emerald-400" /></div>)}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={`border px-3.5 py-3 ${layoutIssues.length ? 'border-amber-300/30 bg-amber-300/[.04]' : 'border-emerald-300/20 bg-emerald-300/[.035]'}`}>
                      <div className="ai-scene-builder__eyebrow flex items-center gap-2 text-slate-200">{layoutIssues.length ? <AlertTriangle size={13} className="text-amber-300" /> : <Network size={13} className="text-emerald-300" />}LAYOUT AUDIT</div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">{layoutIssues.length ? `发现 ${layoutIssues.length} 组重叠，应用时自动避让。` : visualErrors.length ? `发现 ${visualErrors.length} 项视觉硬约束问题，建议重新生成。` : visualIssues.length ? `布局通过，另有 ${visualIssues.length} 项提示需要留意。` : '布局、边界和视觉约束均已通过。'}</p>
                    </div>
                    <div className="border border-cyan-300/20 bg-cyan-300/[.035] px-3.5 py-3">
                      <div className="ai-scene-builder__eyebrow flex items-center gap-2 text-slate-200"><Network size={13} className="text-cyan-300" />DATA LINK</div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-400">数据组件将连接 `mqtt.realtime`，无数据时保留可编辑占位态。</p>
                    </div>
                  </div>
                  {proposal.warnings.length > 0 && <div className="border border-amber-300/20 bg-amber-300/[.035] px-3.5 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-amber-100"><AlertTriangle size={14} />需要留意</div><ul className="mt-1.5 space-y-1 text-[10px] leading-5 text-amber-100/70">{proposal.warnings.map((warning, index) => <li key={`${warning}-${index}`}>· {warning}</li>)}</ul></div>}
                  {qualityReport && <section className="border border-violet-300/20 bg-violet-300/[.025] px-3.5 py-3" aria-label="生成质量评分"><div className="flex items-center justify-between gap-3"><div><div className="ai-scene-builder__eyebrow flex items-center gap-2 text-violet-300/80"><ShieldCheck size={12} />GENERATION QUALITY</div><div className="mt-1 text-[11px] font-semibold text-slate-200">生成质量评分</div></div><div className={`font-mono text-xl ${qualityReport.score >= 80 ? 'text-emerald-300' : qualityReport.score >= 65 ? 'text-amber-300' : 'text-rose-300'}`}>{qualityReport.score}<span className="ml-1 text-[10px] text-slate-500">/100 · {qualityReport.grade}</span></div></div><div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{qualityReport.dimensions.map((dimension) => <div key={dimension.key} title={dimension.note} className="border border-white/[.08] bg-black/15 px-2 py-2"><div className="flex items-center justify-between gap-1 text-[9px] text-slate-500"><span>{dimension.label}</span><span className={dimension.score >= 80 ? 'text-emerald-300' : dimension.score >= 65 ? 'text-amber-300' : 'text-rose-300'}>{dimension.score}</span></div><div className="mt-1 h-1 bg-white/[.08]"><div className={`h-full ${dimension.score >= 80 ? 'bg-emerald-300' : dimension.score >= 65 ? 'bg-amber-300' : 'bg-rose-300'}`} style={{ width: `${dimension.score}%` }} /></div></div>)}</div>{qualityReport.uncoveredCapabilities.length > 0 && <p className="mt-2 text-[9px] leading-4 text-slate-500">本次未涉及：{qualityReport.uncoveredCapabilities.join('、')}。它们仍可在下一轮指令中由 Harness 调用。</p>}</section>}
                  {impactReport && <details className="border border-cyan-300/20 bg-cyan-300/[.02]" open><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3"><span><span className="ai-scene-builder__eyebrow flex items-center gap-2 text-cyan-300/80"><Eye size={12} />CHANGE IMPACT</span><span className="mt-1 block text-[11px] font-semibold text-slate-200">需求变更影响分析</span></span><span className="font-mono text-[9px] text-cyan-200/70">{impactReport.items.length} ITEMS</span></summary><div className="border-t border-white/[.08] px-3.5 py-3"><p className="text-[10px] leading-5 text-slate-400">{impactReport.summary}</p><div className="mt-2 space-y-1.5">{impactReport.items.slice(0, 8).map((item, index) => <div key={`${item.area}-${item.target}-${index}`} className="flex gap-2 text-[9px] leading-4"><span className={`mt-1 h-1.5 w-1.5 shrink-0 ${item.action === 'remove' ? 'bg-rose-300' : item.action === 'modify' ? 'bg-amber-300' : item.action === 'review' ? 'bg-violet-300' : 'bg-emerald-300'}`} /><span className="text-slate-300">{item.target}</span><span className="text-slate-600">{item.detail}</span></div>)}</div></div></details>}
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button type="button" onClick={() => { setProposal(null); setError(''); promptRef.current?.focus(); }} disabled={isApplying} className="flex min-h-10 items-center gap-1.5 border border-white/10 px-3 text-[11px] text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-45"><RotateCcw size={13} />重新生成</button>
                    <button type="button" onClick={handleApply} disabled={isApplying} className="flex min-h-10 items-center gap-1.5 bg-cyan-300 px-4 text-[11px] font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-55">{isApplying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{isApplying ? '正在写入…' : '确认写入工程'}</button>
                  </div>
                </div>
              )}
              {error && <div className="mt-3 flex items-start gap-3 border border-rose-300/25 bg-rose-300/[.05] px-3 py-2.5 text-[10px] leading-5 text-rose-200" role="alert"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><span className="min-w-0 flex-1">{error}</span><button type="button" onClick={() => void (conversationPhase === 'planning' ? handlePlanGeneration() : handleGenerate())} disabled={isGenerating || isApplying || interviewState === 'loading'} className="flex min-h-7 shrink-0 items-center gap-1 border border-rose-200/25 px-2 text-[9px] text-rose-100 transition hover:bg-rose-200/10 disabled:opacity-40"><RotateCcw size={11} />重试</button></div>}
            </div>
          </main>

          <aside className="ai-scene-builder__scroll order-3 min-h-0 overflow-y-auto border-t border-blue-200/15 bg-[#07144e]/78 lg:border-l lg:border-t-0">
            <button type="button" onClick={() => setShowSettings((value) => !value)} aria-expanded={showSettings} className="flex min-h-[68px] w-full items-center justify-between border-b border-white/10 px-5 text-left transition hover:bg-white/[.03]"><span><span className="ai-scene-builder__eyebrow flex items-center gap-2 text-violet-300/80"><Settings2 size={12} />CONTROL ROOM</span><span className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-200">模型与范围</span></span>{showSettings ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}</button>
            {showSettings && <div className="space-y-4 p-5">
              {onLoadPresetDemo && (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-3 text-left">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200 mb-1">
                    <Sparkles size={13} className="text-cyan-300" />
                    <span>暂无密钥？一键加载预设演示场景</span>
                  </div>
                  <p className="mb-2.5 text-[10px] leading-relaxed text-slate-400">
                    无需联网与自配 API Key，直接向 1920×1080 画布和时间轴加载内置多图层交互预设数据。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadPresetDemo();
                      onClose();
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded bg-cyan-500 py-2 px-3 text-[11px] font-bold text-slate-950 transition hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
                  >
                    <Sparkles size={13} />
                    <span>立即加载预设演示场景</span>
                  </button>
                </div>
              )}
               <div><label htmlFor="ai-provider" className="ai-scene-builder__field-label mb-2 block">模型平台</label><select id="ai-provider" value={config.providerId} onChange={(event) => { const provider = getProvider(event.target.value); persistConfig({ ...config, providerId: event.target.value, model: provider?.defaultModel || '', customEndpoint: event.target.value === 'custom' ? (config.customEndpoint || '') : (provider?.endpoint || '') }); setModelOptions([]); setModelDiscoveryState('idle'); }} className="h-11 w-full border border-white/10 bg-[#07111a] px-3 text-[11px] text-white outline-none transition hover:border-white/20 focus:border-cyan-300/60">{LLM_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></div>
                <div><label htmlFor="ai-model" className="ai-scene-builder__field-label mb-2 flex items-center justify-between"><span>模型名称</span><span className="font-mono text-[9px] font-normal text-cyan-300/70">自动获取</span></label>{(() => { const provider = getProvider(config.providerId); const effectiveOptions = modelOptions.length > 0 ? modelOptions : (provider?.visionModels || []); return effectiveOptions.length > 0 ? <select id="ai-model" value={effectiveOptions.includes(config.model) ? config.model : effectiveOptions[0]} onChange={(event) => persistConfig({ ...config, model: event.target.value })} className="h-11 w-full border border-white/10 bg-[#07111a] px-3 text-[11px] font-mono text-white outline-none transition hover:border-white/20 focus:border-cyan-300/60">{effectiveOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select> : <input id="ai-model" value={config.model} onChange={(event) => persistConfig({ ...config, model: event.target.value })} placeholder="填写 API Key 后自动获取" className="h-11 w-full border border-white/10 bg-[#07111a] px-3 text-[11px] font-mono text-white placeholder:text-slate-600 outline-none transition hover:border-white/20 focus:border-cyan-300/60" />; })()}{modelDiscoveryMessage && <p className={`mt-1.5 text-[9px] leading-4 ${modelDiscoveryState === 'error' ? 'text-amber-300/80' : modelDiscoveryState === 'ready' ? 'text-emerald-300/80' : 'text-slate-600'}`}>{modelDiscoveryMessage}</p>}</div>
              <div><label htmlFor="ai-api-key" className="ai-scene-builder__field-label mb-2 flex items-center justify-between"><span>API Key</span><span className="font-mono text-[9px] font-normal text-slate-600">BYOK</span></label><div className="relative"><input id="ai-api-key" autoComplete="off" type={showKey ? 'text' : 'password'} value={config.apiKey} onChange={(event) => persistConfig({ ...config, apiKey: event.target.value })} placeholder="sk-..." className="h-11 w-full border border-white/10 bg-[#07111a] px-3 pr-10 text-[11px] font-mono text-white placeholder:text-slate-600 outline-none transition hover:border-white/20 focus:border-cyan-300/60" /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} title={showKey ? '隐藏 API Key' : '显示 API Key'} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-slate-500 hover:text-white">{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button></div><p className="mt-2 text-[9px] leading-4 text-slate-600">仅保存在本机；请求通过本地代理转发。</p></div>
               <div><label htmlFor="ai-endpoint" className="ai-scene-builder__field-label mb-2 flex items-center justify-between"><span>API 端点</span><span className="font-mono text-[9px] font-normal text-cyan-300/70">可编辑</span></label><input id="ai-endpoint" value={config.customEndpoint || getChatEndpoint(config.providerId)} onChange={(event) => persistConfig({ ...config, customEndpoint: event.target.value })} placeholder="https://.../v1/chat/completions" className="h-11 w-full border border-white/10 bg-[#07111a] px-2.5 text-[10px] font-mono text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/60" /><p className="mt-1.5 text-[9px] leading-4 text-slate-600">可手动填写兼容端点；输入服务根地址时会自动补全 /v1/chat/completions。</p></div>
              <div className="flex gap-2"><button type="button" onClick={handleTestConnection} disabled={connectionState === 'testing'} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 border border-white/10 text-[10px] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[.05] disabled:opacity-50">{connectionState === 'testing' ? <Loader2 size={12} className="animate-spin" /> : connectionState === 'ok' ? <Check size={12} className="text-emerald-300" /> : <Network size={12} />}{connectionState === 'ok' ? '已连接' : '测试连接'}</button><button type="button" onClick={() => { setConfig(loadLLMConfig()); setConnectionState('idle'); setError(''); }} title="重新加载已保存配置" aria-label="重新加载已保存配置" className="flex h-10 w-10 items-center justify-center border border-white/10 text-slate-500 transition hover:bg-white/10 hover:text-white"><RotateCcw size={12} /></button></div>
              {connectionState === 'error' && <div className="text-[10px] leading-4 text-rose-300/90">连接未通过。请检查 Key、模型和端点。</div>}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between gap-2"><div className="ai-scene-builder__eyebrow flex items-center gap-2 text-cyan-300/75"><Paperclip size={11} />ATTACHED CONTEXT</div><span className="font-mono text-[9px] text-slate-600">{attachments.filter((item) => item.status === 'ready').length}/{MAX_HARNESS_ATTACHMENTS}</span></div>
                <div className="mt-2 space-y-1.5">
                  {attachments.length === 0 && <p className="text-[9px] leading-4 text-slate-600">尚未挂载文件。图片会作为视觉输入，文本会进入需求上下文，其他文件保留元数据。</p>}
                  {attachments.slice(-5).map((attachment) => <div key={attachment.id} className="flex min-w-0 items-center gap-2 text-[9px] text-slate-400"><HarnessAttachmentIcon category={attachment.category} size={12} /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><span className="shrink-0 font-mono text-[8px] text-slate-600">{attachment.status === 'ready' ? attachmentCategoryLabel[attachment.category] : '待处理'}</span></div>)}
                </div>
              </div>
              <div className="border-t border-white/10 pt-4"><div className="ai-scene-builder__eyebrow mb-3 text-slate-500">ACTIVE CAPABILITIES</div><div className="space-y-2">{['只读规划，确认后执行', '场景、图层、视觉与数据工具', '自动布局与视觉约束审计', 'MQTT 样例数据绑定', '单次历史提交与撤销'].map((item) => <div key={item} className="flex items-center gap-2 text-[10px] text-slate-500"><Check size={12} className="text-emerald-300" />{item}</div>)}</div></div>
              <details className="border-t border-white/10 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] text-slate-400"><span className="ai-scene-builder__eyebrow flex items-center gap-2"><Wrench size={11} className="text-cyan-300" />TOOL REGISTRY</span><span className="font-mono text-[9px] text-cyan-300/70">{AETHER_HARNESS_TOOLS.length} TOOLS</span></summary>
                <div className="mt-3 grid grid-cols-2 gap-1.5">{AETHER_HARNESS_TOOLS.map((tool) => <div key={tool.id} title={tool.description} className="min-w-0 border border-white/[.07] bg-black/10 px-2 py-1.5"><div className="truncate text-[9px] text-slate-400">{tool.name}</div><div className="mt-0.5 truncate font-mono text-[7px] text-slate-700">{tool.id}</div></div>)}</div>
              </details>
              <div className="border-t border-white/10 pt-4"><button type="button" onClick={onUndo} disabled={!canUndo || isApplying} className="flex min-h-10 w-full items-center justify-center gap-1.5 border border-white/10 text-[10px] text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"><RotateCcw size={13} />撤销上一次工程变更</button></div>
            </div>}
          </aside>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-blue-200/15 bg-[#06113f]/95 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-slate-500"><Eye size={13} className="shrink-0 text-cyan-300/70" /><span className="truncate">当前工程：{projectData.scenes[activeSceneId]?.alias || activeSceneId}</span><span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" /><span className="hidden font-mono text-[9px] text-slate-600 sm:block">{proposal ? `${proposal.operations.length} OPS READY` : `${attachments.filter((item) => item.status === 'ready').length} ATTACHMENTS READY`}</span></div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] text-slate-600"><ShieldCheck size={12} className="text-emerald-300/70" />只读预览 · 确认后写入</span>
        </footer>
      </div>
    </div>
  );
};

export default AiSceneBuilderModal;
