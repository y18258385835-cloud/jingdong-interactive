const SAFE_COMPONENT_TYPES = new Set([
  'metric-card', 'flip-number', 'progress-ring', 'gauge', 'gradient-progress',
  'trend-line', 'bar-chart', 'donut-chart', 'stats-table', 'alert-list',
  'freshness', 'outline-panel-card', 'tabs', 'geo-map', 'topology',
]);
const TELEMETRY_FIELDS = new Set(['value', 'label', 'unit', 'status', 'freshness', 'series', 'categories', 'rows', 'items', 'content', 'location', 'topology']);
const PATH_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*){0,4}$/;

export class PluginAiValidationError extends Error {}

function text(value, maxLength, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function extractJson(content) {
  if (typeof content !== 'string' || content.length > 12000) throw new PluginAiValidationError('模型未返回有效的组件 JSON');
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || content).trim();
  try { return JSON.parse(candidate); } catch { throw new PluginAiValidationError('模型返回内容不是有效 JSON'); }
}

export function buildPluginAiMessages({ prompt, styleName, componentType }) {
  const safePrompt = text(prompt, 800);
  if (!safePrompt) throw new PluginAiValidationError('请输入组件用途');
  if (!SAFE_COMPONENT_TYPES.has(componentType)) throw new PluginAiValidationError('组件类型不受支持');
  return [
    {
      role: 'system',
      content: `You design safe industrial dashboard component metadata. Return JSON only, without markdown. The UI renderer and MQTT binding are owned by the platform; never return HTML, CSS, JavaScript, URLs, code, instructions, or API keys. Return exactly {"name":"...","description":"...","dataContract":"...","tags":["..."],"telemetry":{"value":"metrics.example","unit":"metrics.exampleUnit","status":"status"}}. Telemetry values must be dot-paths into this MQTT snapshot only: metrics.*, series, items, rows, location, topology, content, status. Omit fields that do not apply.`,
    },
    {
      role: 'user',
      content: `Create metadata for a ${componentType} component. Purpose: ${safePrompt}. Visual style: ${text(styleName, 40, '控制室')}. The component must be concise, Chinese, and suitable for real-time industrial MQTT telemetry.`,
    },
  ];
}

export function parsePluginAiResponse(content, expectedComponentType) {
  if (!SAFE_COMPONENT_TYPES.has(expectedComponentType)) throw new PluginAiValidationError('组件类型不受支持');
  const raw = extractJson(content);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PluginAiValidationError('模型返回的组件定义无效');
  const name = text(raw.name, 80);
  if (!name) throw new PluginAiValidationError('模型返回缺少组件名称');
  const telemetry = {};
  if (raw.telemetry && (typeof raw.telemetry !== 'object' || Array.isArray(raw.telemetry))) throw new PluginAiValidationError('模型返回的 telemetry 无效');
  for (const [field, path] of Object.entries(raw.telemetry || {})) {
    if (TELEMETRY_FIELDS.has(field) && typeof path === 'string' && PATH_PATTERN.test(path)) telemetry[field] = path;
  }
  return {
    name,
    description: text(raw.description, 240, 'AI 生成的 MQTT 实时组件'),
    dataContract: /^[a-z][a-z0-9.-]{2,80}$/i.test(text(raw.dataContract, 81)) ? text(raw.dataContract, 81) : `user.${expectedComponentType}.v1`,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string').map((tag) => text(tag, 24)).filter(Boolean).slice(0, 8) : [],
    telemetry,
  };
}
