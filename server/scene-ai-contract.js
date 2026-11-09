const ELEMENT_TYPES = new Set([
  'img', 'vid', 'txt', 'shape', 'saber', 'vfx', '3d_group', 'chart',
  'panorama-img', 'panorama-vid', 'model-3d', 'gaussian-splat', 'group', 'ui-component',
]);

const SAFE_ELEMENT_KEYS = new Set([
  'id', 'type', 'name', 'sourceName', 'refId', 'role', 'content',
  'x', 'y', 'w', 'h', 'rot', 'zIndex', 'opacity', 'blendMode', 'visible', 'locked',
  'mediaAspect', 'groupId', 'vidMode', 'loop', 'muted', 'playbackRate',
  'startTime', 'duration', 'animType', 'animDur', 'exitAnimType', 'exitAnimDur', 'loopAnim', 'loopAnimSpeed',
  'link', 'linkType', 'trigger', 'hoverDelay', 'hoverEffect', 'hoverColor', 'hoverIntensity',
  'interaction', 'variableName', 'variableValue',
  'popupAnimationType', 'popupAnimationDuration', 'popupPosition', 'popupSize', 'popupX', 'popupY', 'popupWidth', 'popupHeight', 'popupRatio', 'popupRatioW', 'popupRatioH', 'popupOverlayOpacity', 'popupCloseOnOverlay', 'popupTheme', 'popupDisplay', 'popupBgColor', 'popupBorderColor', 'popupGlowColor', 'popupTitleColor', 'popupRadius', 'popupOverlayBlur', 'popupAccentColor', 'linkEnterAnim', 'linkExitAnim', 'linkAnimDuration',
  'is3dLayer', 'depthZ', 'parallaxFactor', 'enable3DShadow',
  'color', 'textColor', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign', 'letterSpacing',
  'backgroundType', 'backgroundColor', 'gradientType', 'gradientAngle', 'gradientStart', 'gradientVia', 'gradientEnd',
  'borderRadius', 'borderWidth', 'borderColor', 'boxShadow', 'backdropBlur', 'shapePadding', 'shapeKind',
  'chartKind', 'chartData', 'chartTitle', 'chartColors', 'chartShowLegend', 'chartShowGrid', 'bindText', 'bindValue',
  'uiComponentType', 'uiComponentData', 'pluginId',
  'vfxMotionType', 'vfxColorA', 'vfxColorB', 'vfxColorC', 'vfxSpeed', 'vfxIntensity', 'vfxParams',
  'saberPreset', 'saberPath', 'saberPathType', 'saberShapeName', 'saberGlowColor', 'saberSecondaryGlowColor',
  'saberCoreColor', 'saberCoreWidth', 'saberGlowIntensity', 'saberGlowSpread', 'saberStartOffset', 'saberEndOffset',
  'saberGrowthMode', 'saberGrowthSpeed', 'saberFlickerIntensity', 'saberTaper', 'saberCapStyle', 'saberGlowFalloff',
  'saberDashed', 'saberDashLength', 'saberDashGap', 'saberDashOffset', 'saberBlendMode', 'saberNodes',
  'counterValue', 'counterPrefix', 'counterSuffix', 'clockFormat',
  'panoramaFov', 'panoramaAutoRotate', 'panoramaAutoRotateSpeed', 'modelAutoRotate', 'modelAutoRotateSpeed', 'modelCameraDistance', 'modelViewAzimuth', 'modelViewElevation', 'modelScale', 'splatSize',
  'ai3dLayerDirection', 'ai3dLayerDistance', 'ai3dExplodeDirection', 'ai3dExplodeDistance', 'ai3dExplodeSpeed', 'ai3dExplodeSpin', 'ai3dCollisionDirection', 'ai3dCollisionDistance', 'ai3dCollisionBounce', 'ai3dCollisionSpeed', 'ai3dLayers', 'ai3dExplode', 'ai3dPhysics', 'ai3dLoopEnabled', 'ai3dShowPanel',
  'ai3dControlVariant', 'ai3dPreviewControls', 'ai3dExportControls',
  'customCode', 'customCodeProps', 'customCodeControls',
]);

const HARNESS_ATTACHMENT_CATEGORIES = new Set(['image', 'video', 'audio', 'model', 'project', 'document']);
const MAX_HARNESS_ATTACHMENTS = 12;
const MAX_HARNESS_IMAGE_DATA_CHARS = 9 * 1024 * 1024;
const MAX_HARNESS_TEXT_CHARS = 120_000;
const IMAGE_GENERATION_MODEL_PATTERN = /(?:gpt[-_]?image|dall[-_]?e|seedream|stable[-_]?diffusion|midjourney|flux(?:[-_]|$)|imagen(?:[-_]|$))/i;
const VISION_MODEL_PATTERN = /(?:vision|visual|(?:^|[-_/:.])vl(?:[-_/:.]|$)|(?:^|[-_/:.])omni(?:[-_/:.]|$)|multimodal|multi-modal|(?:^|[-_/:.])4o(?:[-_/:.]|$)|hy-vision|qwen2?\.5-vl|qwen3-vl|glm-4v|gpt-4o)/i;

// A custom OpenAI-compatible endpoint does not prove that a model accepts images.
export function isLikelyVisionModel(model) {
  return typeof model === 'string' && !IMAGE_GENERATION_MODEL_PATTERN.test(model.trim()) && VISION_MODEL_PATTERN.test(model.trim());
}

export function isImageGenerationModel(model) {
  return typeof model === 'string' && IMAGE_GENERATION_MODEL_PATTERN.test(model.trim());
}

function text(value, fallback, maxLength = 160) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function numberInRange(value, fallback, min, max) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function safeJsonValue(value, depth = 0) {
  if (depth > 3) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => safeJsonValue(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 40).map(([key, item]) => [key.slice(0, 80), safeJsonValue(item, depth + 1)]).filter(([, item]) => item !== undefined),
    );
  }
  return undefined;
}

export function normalizeHarnessAttachments(rawAttachments) {
  if (!Array.isArray(rawAttachments)) return [];
  return rawAttachments.slice(0, MAX_HARNESS_ATTACHMENTS).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const category = typeof raw.category === 'string' && HARNESS_ATTACHMENT_CATEGORIES.has(raw.category) ? raw.category : null;
    const name = text(raw.name, '未命名附件', 160);
    const type = text(raw.type, 'application/octet-stream', 120);
    const rawSize = typeof raw.size === 'number' && Number.isFinite(raw.size) ? raw.size : Number(raw.size);
    if (!category || !Number.isFinite(rawSize) || rawSize < 0 || rawSize > 25 * 1024 * 1024) return [];
    const size = rawSize;
    const attachment = { name, type, category, size };
    if (category === 'image' && typeof raw.dataUrl === 'string' && raw.dataUrl.length <= MAX_HARNESS_IMAGE_DATA_CHARS && /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(raw.dataUrl)) {
      attachment.dataUrl = raw.dataUrl;
    }
    if (category === 'document' && typeof raw.textContent === 'string') {
      attachment.textContent = raw.textContent.slice(0, MAX_HARNESS_TEXT_CHARS);
    }
    return [attachment];
  });
}

function buildAttachmentContext(attachments) {
  const normalized = normalizeHarnessAttachments(attachments);
  if (!normalized.length) return { text: '', images: [] };
  let textBudget = MAX_HARNESS_TEXT_CHARS;
  const lines = normalized.map((attachment) => {
    const descriptor = `${attachment.name} (${attachment.category}, ${Math.round(attachment.size / 1024)} KB)`;
    if (attachment.textContent && textBudget > 0) {
      const content = attachment.textContent.slice(0, textBudget);
      textBudget -= content.length;
      return `\n[文本附件 ${descriptor}]\n${content}`;
    }
    if (attachment.category === 'image' && attachment.dataUrl) return `[图片附件 ${descriptor}] 已附带视觉输入。`;
    return `[附件 ${descriptor}] 已挂载文件元数据；当前请求不直接上传其二进制内容。`;
  });
  return {
    text: `\nAttached workspace files:\n${lines.join('\n')}`,
    images: normalized.filter((attachment) => attachment.category === 'image' && attachment.dataUrl),
  };
}

function buildModelUserContent(textContent, attachments) {
  const attachmentContext = buildAttachmentContext(attachments);
  if (!attachmentContext.images.length) return `${textContent}${attachmentContext.text}`;
  return [
    { type: 'text', text: `${textContent}${attachmentContext.text}` },
    ...attachmentContext.images.map((attachment) => ({ type: 'image_url', image_url: { url: attachment.dataUrl } })),
  ];
}

function pickSafeElementFields(raw) {
  return Object.fromEntries(
    Object.entries(raw).filter(([key]) => SAFE_ELEMENT_KEYS.has(key)).map(([key, value]) => [key, safeJsonValue(value)]),
  );
}

const AETHER_FIXED_AGENT_PROMPT = `You are the private Jingdong Interactive Platform agent, deeply adapted to Codex Harness and WorkBuddy execution patterns. Your only job is to build editable, production-quality interaction projects inside the platform: card layouts, iOS-style container transformations, charts, overlays, gestures, 3D/panoramas, exhibition dashboards, data links, scene transitions, and reusable templates. Always inspect the supplied project context and capability registry before planning. Break a request into inspect -> plan -> generate -> evaluate -> preview -> user-approved write. Preserve project state, support retry/continue/redo, and never pretend an unsupported capability exists. Platform updates are learned only when they are present in the supplied capability registry or project context; do not claim autonomous access to future features. Prefer the highest-quality supported implementation, add missing professional interaction logic when it is safe, and report concrete operations and evaluation results instead of generic chat.

You are the planning core inside the AETHER Agent Harness. Convert the user's request into strict editable ProjectData operations. Plan internally, then return only the ordered operations that the AETHER tool registry can execute. Return JSON only, never Markdown, HTML, CSS, JavaScript, arbitrary SVG, external URLs, API keys, or invented asset references.
Allowed operations: create-scene, create-element, update-scene, update-element, delete-element, reorder-elements, bind-mqtt. For local modifications, target an existing element by elementId or a generated element by targetOperation. Never delete or overwrite an element without a clear user request.
create-element supports every existing AETHER element type: img, vid, txt, shape, saber, vfx, 3d_group, chart, panorama-img, panorama-vid, model-3d, gaussian-splat, group, ui-component. Use only properties from the existing editor. For image/video/3D/panorama elements, use an existing refId from the supplied project context or leave the refId empty and add a warning; never invent a URL or file.
Harness capability domains include scenes, layers, media, shapes, pen paths, Saber, VFX, UI components, charts, 3D, panoramas, timeline animation, interactions, MQTT, layout audit, history and export. Use create-element properties to express supported media playback, animation, 3D, panorama and interaction behavior. For interactive requests, create at least one visible control or information layer with a real click/hover interaction; use interaction:{trigger,action,target} or the compatible link/linkType fields. Scene targets must use scene IDs from the plan or current project; never emit an external URL. For Saber use existing preset/path/style fields only. For VFX use existing vfxMotionType fields only. For UI use an installed uiComponentType/pluginId only. For animation use only animType, exitAnimType and loopAnim values supported by the editor. Do not return executable ai3dCode; 3D elements must reference an existing project asset. Keep x+w<=100 and y+h<=100, use a 12-column layout, keep a 6% outer margin, avoid overlap, and use no more than 12 elements. VFX may be one low-opacity background layer. MQTT bindings must target installed plugins and use sourceId=mqtt.realtime.
Use industrial-instrument only when the user provides no visual reference. When an image reference is attached, use design style reference-led and layoutTemplate reference-led. Return this shape: {title,summary,warnings,design:{style,density,layoutTemplate},operations:[...]}. A valid minimal new-scene response contains operations like [{"kind":"create-scene","sceneId":"new-scene","name":"Overview"},{"kind":"create-element","sceneId":"new-scene","element":{"type":"txt","name":"Title","content":"Overview","x":6,"y":6,"w":88,"h":7}}]. The operations array must never be empty. Do not claim an asset was created when the project has no source asset.`;

const STRICT_OPERATION_FORMAT_RULE = `Critical output rule: every item in operations MUST use the exact AETHER shape {kind,sceneId,element} or {kind,sceneId,patch}. The discriminator key is kind, never type, action, operation, or componentType. For create-element, put the element draft under element, never props or properties. Use only kind values create-scene, create-element, update-scene, update-element, delete-element, reorder-elements, bind-mqtt. Do not return createComponent, createScene, arbitrary component schemas, or presentation-only layout descriptions.`;

const VISUAL_REFERENCE_RULE = `A visual reference image is attached. Treat it as the primary visual authority: inspect its composition, dominant colors, typography hierarchy, spacing, corner treatment, imagery placement, and interaction affordances before planning. Use design.style and design.layoutTemplate equal to reference-led. Preserve the observed layout coordinates and colors in operations. Do not replace it with an industrial dashboard, dark AI-native interface, generic cards, or default token palette. Do not claim a pixel-perfect or 100% clone; state only observable traits and produce the closest editable reconstruction supported by the editor.`;

export function buildSceneAiMessages({ prompt, context, attachments = [] }) {
  const safePrompt = text(prompt, '', 8000);
  const safeContext = JSON.stringify(safeJsonValue(context || {}));
  const hasImageReference = normalizeHarnessAttachments(attachments).some((attachment) => attachment.category === 'image' && attachment.dataUrl);
  const aestheticRule = hasImageReference
    ? VISUAL_REFERENCE_RULE
    : 'Aesthetic acceptance rules: use a restrained AI-native dark interface with clear hierarchy, an 8px spacing rhythm, 4-8px radii, high-contrast readable text, real assets only, purposeful motion in the 150-300ms range, and no decorative card piles, random gradients, emoji icons, fake data claims, or unsupported effects. Every generated scene must look like a deliberate product system, not a generic dashboard template.';
  return [
    { role: 'system', content: `${AETHER_FIXED_AGENT_PROMPT}\n\n${STRICT_OPERATION_FORMAT_RULE}\n\n${aestheticRule}\n\nSupported platform patterns include depth/fan/cylinder/sphere/spiral/matrix-wave card layouts; capsule/dot/rounded/container morphing; crosshair/box-select/drill-down/highlight/tooltip/zoom/legend chart interactions; draggable snap/inertia/bounce overlays; 3D/panoramas, exhibition dashboards, data links, scene transitions, and reusable templates.` },
    { role: 'user', content: buildModelUserContent(`User request:\n${safePrompt}\nCurrent project context:\n${safeContext}`, attachments) },
  ];
}

const HARNESS_REVIEW_SYSTEM_PROMPT = `You are the independent evaluator in the AETHER Agent Harness. Evaluate the proposed editable operations against the user request, supplied project context, and supported capability boundary. Check task fit, completeness, interaction quality, use of real assets, editability, bounds, overlap risk, and unsupported claims. Return JSON only with exactly {approved:boolean,score:number,summary:string,issues:string[],repairInstructions:string[]}. Score 0-100. approved is false when a concrete issue would make the result unusable; do not invent issues for unsupported data. This is an evaluation, not a rewrite. Never return Markdown, code, API keys, URLs, or new operations.`;

export function buildHarnessReviewMessages({ prompt, context, proposal }) {
  const safePrompt = text(prompt, '', 4000);
  const safeContext = JSON.stringify(safeJsonValue(context || {}));
  const safeProposal = JSON.stringify(safeJsonValue(proposal || {}));
  return [
    { role: 'system', content: `${AETHER_FIXED_AGENT_PROMPT}\n\n${HARNESS_REVIEW_SYSTEM_PROMPT}\n\nAesthetic gate: reject generic card piles, weak hierarchy, low contrast, arbitrary gradients, emoji icons, fake data claims, unsupported effects, and motion that is decorative rather than purposeful. Require an 8px rhythm, 4-8px radii, readable type, real assets, and a deliberate composition.` },
    { role: 'user', content: `User request:\n${safePrompt}\nCurrent project context:\n${safeContext}\nCandidate proposal to evaluate:\n${safeProposal}` },
  ];
}

export function parseHarnessReviewResponse(content) {
  const extracted = content && typeof content === 'object' ? extractSceneAiText(content) : content;
  const rawText = flattenModelContent(extracted).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (!rawText) throw new Error('Harness review response is empty');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Harness review response is not valid JSON');
    parsed = JSON.parse(rawText.slice(start, end + 1));
  }
  const score = Math.round(numberInRange(parsed?.score, 0, 0, 100));
  const issues = Array.isArray(parsed?.issues) ? parsed.issues.map((item) => text(item, '', 240)).filter(Boolean).slice(0, 12) : [];
  const repairInstructions = Array.isArray(parsed?.repairInstructions) ? parsed.repairInstructions.map((item) => text(item, '', 240)).filter(Boolean).slice(0, 12) : [];
  const approved = parsed?.approved === true && score >= 70 && issues.length === 0;
  return {
    source: 'model',
    status: approved ? 'passed' : 'needs-review',
    approved,
    score,
    summary: text(parsed?.summary, approved ? '独立 AI 评测通过。' : '独立 AI 评测发现需要确认的问题。', 500),
    issues,
    repairInstructions,
  };
}

const HARNESS_INTERVIEW_SYSTEM_PROMPT = `You are the requirement interviewer inside the AETHER Agent Harness. First silently inspect the current ProjectData, active scene, conversation, and attached workspace files. Then help the user turn an idea into an editable AETHER project plan. Ask at most one highest-impact product question per turn. Only ask about a decision that changes the deliverable, audience, role of an uploaded asset, data source, or essential interaction. Do not ask about thumbnails, previews, error messages, retries, buttons, components, page details, API details, or other implementation details; AETHER and the Harness decide those automatically. If the request is sufficiently clear, question must be an empty string and ready must be true. If clarification is needed, ready must be false and question must contain exactly one concise question with concrete decision options. When an image is attached, referenceAnalysis must list 4-6 observable facts about its composition, palette, typography, spacing, and visual hierarchy. Do not put generic claims such as "strictly follow the reference" in referenceAnalysis. Return JSON only with exactly this shape: {question:string, options:string[], brief:{objective:string,deliverable:string,audience:string,visualDirection:string,dataStrategy:string,interactionStrategy:string,assetStrategy:string,referenceAnalysis:string[],constraints:string[]}, ready:boolean}. Never invent asset URLs, plugin IDs, MQTT fields, or editor capabilities.`;

export function buildHarnessInterviewMessages({ prompt, conversation = [], context, attachments = [] }) {
  const safeConversation = Array.isArray(conversation) ? conversation.slice(-8).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    text: text(item?.text, '', 800),
  })) : [];
  const hasImageReference = normalizeHarnessAttachments(attachments).some((attachment) => attachment.category === 'image' && attachment.dataUrl);
  const interviewReferenceRule = hasImageReference
    ? `${VISUAL_REFERENCE_RULE}\nFor brief.visualDirection, list only concrete traits observed in the reference image. Never write industrial-instrument unless it is visibly present in that image.`
    : '';
  return [
    { role: 'system', content: `${AETHER_FIXED_AGENT_PROMPT}\n\n${HARNESS_INTERVIEW_SYSTEM_PROMPT}\n\n${interviewReferenceRule}` },
    { role: 'user', content: buildModelUserContent(JSON.stringify({ request: text(prompt, '', 4000), conversation: safeConversation, project: safeJsonValue(context || {}) }), attachments) },
  ];
}

export function parseHarnessInterviewResponse(content) {
  const extracted = content && typeof content === 'object' ? extractSceneAiText(content) : content;
  const rawText = flattenModelContent(extracted).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (!rawText) throw new Error('Interview response is empty');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Interview response is not valid JSON');
    parsed = JSON.parse(rawText.slice(start, end + 1));
  }
  const brief = parsed?.brief && typeof parsed.brief === 'object' ? parsed.brief : {};
  const options = Array.isArray(parsed?.options) ? parsed.options.map((item) => text(item, '', 120)).filter(Boolean).slice(0, 4) : [];
  const question = text(parsed?.question, '', 300);
  return {
    question,
    options,
    brief: {
      objective: text(brief.objective, '', 4000),
      deliverable: text(brief.deliverable, '', 240),
      audience: text(brief.audience, '', 240),
      visualDirection: text(brief.visualDirection, '', 240),
      dataStrategy: text(brief.dataStrategy, '', 240),
      interactionStrategy: text(brief.interactionStrategy, '', 240),
      assetStrategy: text(brief.assetStrategy, '', 240),
      referenceAnalysis: Array.isArray(brief.referenceAnalysis) ? brief.referenceAnalysis.map((item) => text(item, '', 180)).filter(Boolean).slice(0, 6) : [],
      constraints: Array.isArray(brief.constraints) ? brief.constraints.map((item) => text(item, '', 180)).filter(Boolean).slice(0, 8) : [],
    },
    ready: parsed?.ready === true && !question,
  };
}

function normalizeDesign(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const styles = new Set(['industrial-instrument', 'reference-led']);
  const densities = new Set(['balanced', 'dense', 'spacious']);
  const templates = new Set(['control-room-overview', 'metric-first', 'trend-first', 'reference-led']);
  return {
    style: styles.has(value.style) ? value.style : 'industrial-instrument',
    density: densities.has(value.density) ? value.density : 'balanced',
    layoutTemplate: templates.has(value.layoutTemplate) ? value.layoutTemplate : 'control-room-overview',
  };
}

function normalizeElement(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const typeAliases = {
    text: 'txt',
    image: 'img',
    video: 'vid',
    rectangle: 'shape',
    polygon: 'shape',
    model: 'model-3d',
    '3d-model': 'model-3d',
    panorama: 'panorama-img',
    ui: 'ui-component',
    component: 'ui-component',
    gauge: 'ui-component',
  };
  const elementType = ELEMENT_TYPES.has(raw.type) ? raw.type : typeAliases[raw.type];
  if (!elementType) return null;
  const element = {
    ...pickSafeElementFields(raw),
    type: elementType,
    name: text(raw.name || raw.sourceName, 'AI layer', 80),
    x: numberInRange(raw.x, 10, 0, 96),
    y: numberInRange(raw.y, 10, 0, 96),
    w: 1,
    h: 1,
    opacity: numberInRange(raw.opacity, 100, 0, 100),
    startTime: numberInRange(raw.startTime, 0, 0, 86400),
    duration: numberInRange(raw.duration, 6, 0.1, 86400),
  };
  if (raw.type === 'gauge' && !element.uiComponentType) element.uiComponentType = 'gauge';
  element.w = Math.min(numberInRange(raw.w, 24, 1, 100), 100 - element.x);
  element.h = Math.min(numberInRange(raw.h, 16, 1, 100), 100 - element.y);
  if (typeof raw.content === 'string') element.content = raw.content.slice(0, 2000);
  if (raw.uiComponentData && typeof raw.uiComponentData === 'object') element.uiComponentData = safeJsonValue(raw.uiComponentData);
  if (raw.chartData && Array.isArray(raw.chartData)) element.chartData = safeJsonValue(raw.chartData);
  return element;
}

function normalizeOperation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Some OpenAI-compatible models follow the requested semantics but rename
  // the operation discriminator and nest element fields. Convert only the
  // three known aliases into the strict AETHER contract; everything else is
  // still rejected below.
  const operationType = typeof raw.kind === 'string'
    ? raw.kind
    : typeof raw.action === 'string'
      ? raw.action
      : typeof raw.operation === 'string'
        ? raw.operation
        : typeof raw.type === 'string'
          ? raw.type
          : raw.targetOperation;
  const aliases = {
    'add-scene': 'create-scene',
    createScene: 'create-scene',
    '创建场景': 'create-scene',
    '新建场景': 'create-scene',
    'create-layer': 'create-element',
    'add-layer': 'create-element',
    'add-element': 'create-element',
    createElement: 'create-element',
    createComponent: 'create-element',
    addComponent: 'create-element',
    '创建图层': 'create-element',
    '添加图层': 'create-element',
    'update-layer': 'update-element',
    'modify-element': 'update-element',
    updateElement: 'update-element',
    updateComponent: 'update-element',
    '修改图层': 'update-element',
    'remove-layer': 'delete-element',
    'remove-element': 'delete-element',
    deleteElement: 'delete-element',
    '删除图层': 'delete-element',
    '绑定MQTT': 'bind-mqtt',
  };
  if (typeof operationType === 'string' && typeof raw.kind !== 'string') {
    raw = { ...raw, kind: aliases[operationType] || operationType };
  } else if (typeof raw.kind === 'string' && aliases[raw.kind]) {
    raw = { ...raw, kind: aliases[raw.kind] };
  }
  if (raw.kind === 'bind-mqtt' && raw.targetElementId === undefined && raw.elementId !== undefined) {
    const binding = raw.binding && typeof raw.binding === 'object' ? raw.binding : {};
    raw = {
      ...raw,
      targetElementId: raw.elementId,
      pluginId: raw.pluginId || binding.pluginId || 'aether.metric-card',
    };
  }
  if (operationType === 'create-element' && raw.elementType && !raw.element) {
    const position = raw.position && typeof raw.position === 'object' ? raw.position : {};
    const properties = raw.properties && typeof raw.properties === 'object' ? raw.properties : {};
    raw = {
      ...raw,
      kind: 'create-element',
      element: {
        ...properties,
        id: raw.elementId,
        type: raw.elementType,
        x: position.x,
        y: position.y,
        w: position.w,
        h: position.h,
        content: properties.content || properties.label,
        uiComponentData: raw.elementType === 'ui-component' ? properties : undefined,
        animType: raw.animations?.animType,
        loopAnim: raw.animations?.loopAnim,
      },
    };
  } else if ((raw.kind === 'create-element' || aliases[operationType] === 'create-element') && !raw.element && (raw.layer || raw.properties || raw.props)) {
    const source = raw.layer && typeof raw.layer === 'object' ? raw.layer : {};
    const properties = raw.properties && typeof raw.properties === 'object'
      ? raw.properties
      : raw.props && typeof raw.props === 'object' ? raw.props : {};
    raw = {
      ...raw,
      kind: 'create-element',
      element: {
        ...source,
        ...properties,
        id: raw.elementId || source.id,
        type: raw.elementType || source.type || properties.type,
        x: raw.x ?? source.x ?? properties.x,
        y: raw.y ?? source.y ?? properties.y,
        w: raw.w ?? source.w ?? properties.w,
        h: raw.h ?? source.h ?? properties.h,
      },
    };
  } else if (operationType === 'create-scene' && !raw.kind) {
    raw = { ...raw, kind: 'create-scene' };
  } else if (operationType === 'bind-mqtt' && !raw.kind) {
    const binding = raw.binding && typeof raw.binding === 'object' ? raw.binding : {};
    raw = {
      ...raw,
      kind: 'bind-mqtt',
      targetElementId: raw.elementId,
      pluginId: raw.pluginId || binding.pluginId || 'aether.metric-card',
    };
  }
  if (typeof raw.kind !== 'string') return null;
  if (raw.kind === 'create-scene') {
    return { kind: raw.kind, sceneId: text(raw.sceneId, 'new-scene', 100), name: text(raw.name || raw.alias, 'AI generated scene', 100), duration: numberInRange(raw.duration, 12, 1, 86400), bgColor: text(raw.bgColor, '#07111d', 80) };
  }
  if (raw.kind === 'create-element') {
    const element = normalizeElement(raw.element);
    return element ? { kind: raw.kind, sceneId: text(raw.sceneId, 'new-scene', 100), element } : null;
  }
  if (raw.kind === 'update-scene' && raw.patch && typeof raw.patch === 'object') {
    const patch = {};
    if (raw.patch.alias !== undefined) patch.alias = text(raw.patch.alias, 'AI generated scene', 100);
    if (raw.patch.duration !== undefined) patch.duration = numberInRange(raw.patch.duration, 12, 1, 86400);
    if (raw.patch.cruiseDuration !== undefined) patch.cruiseDuration = numberInRange(raw.patch.cruiseDuration, 8, 0, 86400);
    if (raw.patch.bgColor !== undefined) patch.bgColor = text(raw.patch.bgColor, '#07111d', 80);
    if (raw.patch.transitionIn !== undefined) patch.transitionIn = text(raw.patch.transitionIn, 'fade', 30);
    if (raw.patch.transitionOut !== undefined) patch.transitionOut = text(raw.patch.transitionOut, 'fade', 30);
    if (raw.patch.transitionDuration !== undefined) patch.transitionDuration = numberInRange(raw.patch.transitionDuration, 0.6, 0, 10);
    return { kind: raw.kind, sceneId: text(raw.sceneId, 'active-scene', 100), patch };
  }
  if (raw.kind === 'update-element' && raw.patch && typeof raw.patch === 'object') {
    const patch = pickSafeElementFields(raw.patch);
    delete patch.id;
    delete patch.type;
    return Object.keys(patch).length ? {
      kind: raw.kind,
      sceneId: text(raw.sceneId, 'active-scene', 100),
      elementId: raw.elementId === undefined ? undefined : text(raw.elementId, '', 120),
      targetOperation: raw.targetOperation === undefined ? undefined : Math.max(0, Math.floor(numberInRange(raw.targetOperation, 0, 0, 1000))),
      patch,
    } : null;
  }
  if (raw.kind === 'delete-element') {
    if (raw.elementId === undefined && raw.targetOperation === undefined) return null;
    return {
      kind: raw.kind,
      sceneId: text(raw.sceneId, 'active-scene', 100),
      elementId: raw.elementId === undefined ? undefined : text(raw.elementId, '', 120),
      targetOperation: raw.targetOperation === undefined ? undefined : Math.max(0, Math.floor(numberInRange(raw.targetOperation, 0, 0, 1000))),
    };
  }
  if (raw.kind === 'reorder-elements' && Array.isArray(raw.elementIds)) {
    const elementIds = raw.elementIds.map((id) => text(id, '', 120)).filter(Boolean).slice(0, 40);
    return elementIds.length ? { kind: raw.kind, sceneId: text(raw.sceneId, 'active-scene', 100), elementIds } : null;
  }
  if (raw.kind === 'bind-mqtt') {
    return {
      kind: raw.kind,
      sceneId: text(raw.sceneId, 'new-scene', 100),
      targetElementId: raw.targetElementId === undefined ? undefined : text(raw.targetElementId, '', 120),
      targetOperation: raw.targetOperation === undefined ? undefined : Math.max(0, Math.floor(numberInRange(raw.targetOperation, 0, 0, 1000))),
      pluginId: text(raw.pluginId, 'aether.metric-card', 120),
    };
  }
  return null;
}

function flattenModelContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      return '';
    }).join('');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.value === 'string') return content.value;
  }
  return '';
}

// Accept the response shapes used by OpenAI-compatible gateways and Responses API.
export function extractSceneAiText(data) {
  const message = data?.choices?.[0]?.message;
  const content = flattenModelContent(message?.content);
  if (content.trim()) return content;

  const reasoning = flattenModelContent(message?.reasoning_content || message?.reasoning);
  if (reasoning.trim()) return reasoning;

  const outputText = flattenModelContent(data?.output_text);
  if (outputText.trim()) return outputText;

  const output = Array.isArray(data?.output) ? data.output : [];
  const responseText = output.map((item) => flattenModelContent(item?.content)).join('');
  if (responseText.trim()) return responseText;

  return '';
}

export function parseSceneAiResponse(content) {
  const extracted = content && typeof content === 'object' ? extractSceneAiText(content) : content;
  const rawText = flattenModelContent(extracted).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (!rawText) throw new Error('AI response is empty');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI response is not valid JSON');
    parsed = JSON.parse(rawText.slice(start, end + 1));
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('AI response has no operations');
  if (parsed.proposal && typeof parsed.proposal === 'object') parsed = parsed.proposal;
  else if (parsed.result && typeof parsed.result === 'object' && !Array.isArray(parsed.result)) parsed = parsed.result;
  let rawOperations = Array.isArray(parsed.operations) ? parsed.operations : null;
  if (!rawOperations) {
    const aliases = ['actions', 'steps', 'changes', 'edits'];
    const aliasKey = aliases.find((key) => Array.isArray(parsed[key]));
    rawOperations = aliasKey ? parsed[aliasKey] : null;
  }
  if (!rawOperations && Array.isArray(parsed.elements || parsed.layers)) {
    const elements = parsed.elements || parsed.layers;
    rawOperations = [
      ...(parsed.scene && typeof parsed.scene === 'object' ? [{ kind: 'create-scene', ...parsed.scene }] : []),
      ...elements.map((element) => ({ kind: 'create-element', sceneId: parsed.sceneId, element })),
    ];
  }
  if (!rawOperations) throw new Error('AI response has no operations');
  const operations = rawOperations.map(normalizeOperation).filter(Boolean).slice(0, 24);
  if (!operations.length) throw new Error('AI returned no executable operations');
  return {
    title: text(parsed.title, 'AI scene proposal', 100),
    summary: text(parsed.summary, 'Editable AETHER project proposal.', 600),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((item) => text(item, '', 180)).filter(Boolean).slice(0, 12) : [],
    design: normalizeDesign(parsed.design),
    operations,
    generatedAt: new Date().toISOString(),
  };
}
