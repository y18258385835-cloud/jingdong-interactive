export type HarnessConversationPhase = 'intake' | 'clarifying' | 'briefing' | 'planning';

export interface HarnessConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestions?: string[];
}

export interface HarnessRequirementBrief {
  objective: string;
  deliverable: string;
  audience: string;
  visualDirection: string;
  dataStrategy: string;
  interactionStrategy: string;
  assetStrategy: string;
  referenceAnalysis: string[];
  constraints: string[];
}

export interface HarnessRequestAssessment {
  brief: HarnessRequirementBrief;
  question?: string;
  suggestions?: string[];
}

/** Fixed wire contract for the model-driven requirement interview. */
export interface HarnessInterviewResponse {
  question: string;
  options: string[];
  brief: HarnessRequirementBrief;
  ready: boolean;
  source?: 'model' | 'local' | 'unavailable';
}

function hasAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function cleanPrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ').slice(0, 4000);
}

function inferDeliverable(prompt: string) {
  if (hasAny(prompt, ['全景', '展陈', '导览', '展厅'])) return '沉浸式展陈场景';
  if (hasAny(prompt, ['发布', '产品', '主视觉', '发布会'])) return '产品发布主视觉场景';
  if (hasAny(prompt, ['saber', '光效', '动效', '特效'])) return '视觉动效场景';
  if (hasAny(prompt, ['监控', '大屏', '驾驶舱', '看板', '数据'])) return '数据监控场景';
  return '可编辑交互场景';
}

function inferAudience(prompt: string) {
  if (hasAny(prompt, ['工厂', '设备', '产线', '工业'])) return '现场运维与管理人员';
  if (hasAny(prompt, ['展陈', '导览', '展厅', '博物馆'])) return '展厅访客与讲解人员';
  if (hasAny(prompt, ['发布', '产品', '品牌'])) return '产品发布与品牌展示观众';
  return '项目使用者';
}

function inferDataStrategy(prompt: string) {
  if (hasAny(prompt, ['mqtt', '实时', '数据流', '传感器'])) return '接入现有 MQTT 样例数据，并保留无数据占位态';
  if (hasAny(prompt, ['静态', '占位', '模拟数据'])) return '先使用静态或占位数据';
  return '数据来源待确认';
}

function inferInteractionStrategy(prompt: string) {
  if (hasAny(prompt, ['点击', '跳转', '交互', '热点', '悬停', '弹窗'])) return '按需求绑定已有点击、热点、悬停或场景跳转能力';
  return '默认保持可浏览，交互触发方式待确认';
}

function inferAssetStrategy(prompt: string) {
  if (hasAny(prompt, ['视觉参考', '参考图', '设计稿', '提取风格', '只做参考'])) return '将上传文件作为视觉参考，提取布局与风格，不直接写入素材图层';
  if (hasAny(prompt, ['最终素材', '直接使用', '放入工程', '作为素材'])) return '优先将上传文件作为最终素材使用，并保留可替换入口';
  if (hasAny(prompt, ['已有素材', '现有素材', '工程素材', '素材库'])) return '优先复用当前工程中的已有素材';
  if (hasAny(prompt, ['3d', '模型', '全景', '视频', '图片'])) return '需要从当前工程素材中匹配可用资源';
  return '未指定外部素材，不虚构素材地址';
}

function buildBrief(prompt: string, activeSceneName?: string): HarnessRequirementBrief {
  const deliverable = inferDeliverable(prompt);
  const isData = deliverable === '数据监控场景';
  const isVisual = hasAny(prompt, ['高级', '科技', '克制', '工业', '专业', '光效']);
  const constraints = [
    '使用 AETHER 原生可编辑图层和工具',
    '先预览、审计，再写入工程',
    '自动检查边界和图层重叠',
  ];
  if (activeSceneName) constraints.push(`当前工作场景：${activeSceneName}`);
  if (isData) constraints.push('数据组件优先绑定 mqtt.realtime');
  return {
    objective: prompt,
    deliverable,
    audience: inferAudience(prompt),
    visualDirection: isVisual ? '克制、专业、层级清晰的工业仪表风格' : '采用 AETHER 工业仪表风格作为默认方向',
    dataStrategy: inferDataStrategy(prompt),
    interactionStrategy: inferInteractionStrategy(prompt),
    assetStrategy: inferAssetStrategy(prompt),
    referenceAnalysis: [],
    constraints,
  };
}

export function assessHarnessRequest(prompt: string, activeSceneName?: string): HarnessRequestAssessment {
  const value = cleanPrompt(prompt);
  const deliverable = inferDeliverable(value);
  const isData = deliverable === '数据监控场景';
  const needsSceneClarification = value.length < 12 && !hasAny(value, ['监控', '大屏', '发布', '产品', '展陈', '导览', '场景', '动效', '形状', '3d']);
  const needsDataClarification = isData && !hasAny(value, ['mqtt', '实时', '静态', '占位', '模拟', '数据源']);
  const needsAssetClarification = hasAny(value, ['3d', '全景', '视频', '图片', '附件', '文件', '设计稿']) && !hasAny(value, ['已有素材', '现有素材', '工程素材', '占位', '参考', '最终素材', '直接使用', '不加入素材']);

  const brief = buildBrief(value, activeSceneName);
  if (needsSceneClarification) {
    return {
      brief,
      question: '先确定这次工作的主要交付物，我会据此选择工具和版式。',
      suggestions: ['数据监控大屏', '产品发布主视觉', '沉浸式展陈导览'],
    };
  }
  if (needsDataClarification) {
    return {
      brief,
      question: '这个场景的数据准备采用哪种方式？这会决定组件绑定和空状态设计。',
      suggestions: ['绑定现有 MQTT 样例', '先使用静态占位数据', '稍后由我手动绑定'],
    };
  }
  if (needsAssetClarification) {
    return {
      brief,
      question: '素材策略需要确认，避免 Harness 虚构不存在的图片、视频或 3D 地址。',
      suggestions: ['优先使用工程已有素材', '先用占位图层', '暂不加入素材'],
    };
  }
  return { brief };
}

function cleanInterviewText(value: unknown, fallback: string, maxLength = 240) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) || fallback : fallback;
}

const LOW_VALUE_QUESTION_TERMS = [
  '缩略图', '预览功能', '错误提示', '错误信息', '重试选项', '重试按钮', '按钮', '控件', '页面怎么',
  '接口怎么', '代码', '前端', '后端', '技术实现', '实现方式', '组件怎么', '是否需要提供',
];

/** Product decisions belong in the interview; UI implementation details belong to the Harness. */
export function isLowValueHarnessQuestion(question: string) {
  return hasAny(question, LOW_VALUE_QUESTION_TERMS);
}

/** Normalize an untrusted model result without allowing it to bypass the one-question rule. */
export function normalizeHarnessInterviewResponse(
  raw: unknown,
  fallback: HarnessRequestAssessment,
  source: HarnessInterviewResponse['source'] = 'model',
): HarnessInterviewResponse {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rawBrief = value.brief && typeof value.brief === 'object' ? value.brief as Record<string, unknown> : {};
  const brief: HarnessRequirementBrief = {
    ...fallback.brief,
    objective: cleanInterviewText(rawBrief.objective, fallback.brief.objective, 4000),
    deliverable: cleanInterviewText(rawBrief.deliverable, fallback.brief.deliverable),
    audience: cleanInterviewText(rawBrief.audience, fallback.brief.audience),
    visualDirection: cleanInterviewText(rawBrief.visualDirection, fallback.brief.visualDirection),
    dataStrategy: cleanInterviewText(rawBrief.dataStrategy, fallback.brief.dataStrategy),
    interactionStrategy: cleanInterviewText(rawBrief.interactionStrategy, fallback.brief.interactionStrategy),
    assetStrategy: cleanInterviewText(rawBrief.assetStrategy, fallback.brief.assetStrategy),
    referenceAnalysis: Array.isArray(rawBrief.referenceAnalysis)
      ? rawBrief.referenceAnalysis.filter((item): item is string => typeof item === 'string').map((item) => cleanInterviewText(item, '', 180)).filter(Boolean).slice(0, 6)
      : fallback.brief.referenceAnalysis,
    constraints: Array.isArray(rawBrief.constraints)
      ? rawBrief.constraints.filter((item): item is string => typeof item === 'string').map((item) => cleanInterviewText(item, '', 180)).filter(Boolean).slice(0, 8)
      : fallback.brief.constraints,
  };
  const options = Array.isArray(value.options)
    ? value.options.filter((item): item is string => typeof item === 'string').map((item) => cleanInterviewText(item, '', 100)).filter(Boolean).slice(0, 4)
    : [];
  const fallbackQuestion = fallback.question || '';
  const candidateQuestion = cleanInterviewText(value.question, fallbackQuestion, 300);
  const discardModelQuestion = Boolean(candidateQuestion && isLowValueHarnessQuestion(candidateQuestion));
  const question = discardModelQuestion ? fallbackQuestion : candidateQuestion;
  const effectiveOptions = discardModelQuestion ? (fallback.suggestions || []) : (options.length ? options : (fallback.suggestions || []));
  const ready = !question && (value.ready === true || discardModelQuestion || !fallbackQuestion);
  return {
    question: ready ? '' : question || fallbackQuestion,
    options: effectiveOptions,
    brief: discardModelQuestion ? fallback.brief : brief,
    ready: ready || (!question && !fallbackQuestion),
    source: discardModelQuestion ? 'local' : source,
  };
}

export function createLocalHarnessInterview(prompt: string, activeSceneName?: string, hasAttachments = false): HarnessInterviewResponse {
  const assessment = assessHarnessRequest(prompt, activeSceneName);
  if (hasAttachments && !assessment.question && !hasAny(prompt, ['参考', '设计稿', '提取风格', '最终素材', '直接使用', '放入工程', '不加入素材'])) {
    assessment.question = '这些附件在本次工作中主要承担什么角色？';
    assessment.suggestions = ['作为视觉参考，提取布局和风格', '作为最终素材直接放入工程', '只做背景资料，不加入场景'];
  }
  return normalizeHarnessInterviewResponse({
    question: assessment.question || '',
    options: assessment.suggestions || [],
    brief: assessment.brief,
    ready: !assessment.question,
  }, assessment, 'local');
}

export function appendHarnessReply(prompt: string, reply: string) {
  const value = cleanPrompt(reply);
  return value ? `${cleanPrompt(prompt)}\n补充决策：${value}`.slice(0, 4000) : cleanPrompt(prompt);
}

export function summarizeHarnessBrief(brief: HarnessRequirementBrief) {
  return `${brief.deliverable}，面向${brief.audience}。${brief.visualDirection}；${brief.dataStrategy}。`;
}
