import { describe, expect, it } from 'vitest';
import { buildHarnessReviewMessages, buildSceneAiMessages, extractSceneAiText, isLikelyVisionModel, normalizeHarnessAttachments, parseHarnessReviewResponse, parseSceneAiResponse } from '../server/scene-ai-contract.js';

describe('scene AI contract', () => {
  it('conservatively identifies visual-capable model names', () => {
    expect(isLikelyVisionModel('hy4-preview')).toBe(false);
    expect(isLikelyVisionModel('gpt-image-1.5')).toBe(false);
    expect(isLikelyVisionModel('hy-vision-2.0-instruct')).toBe(true);
    expect(isLikelyVisionModel('Qwen/Qwen2.5-VL-7B-Instruct')).toBe(true);
    expect(isLikelyVisionModel('gpt-4o-mini')).toBe(true);
  });
  it('builds a bounded instruction and project context message', () => {
    const messages = buildSceneAiMessages({
      prompt: '生成冷却系统监控场景',
      context: { activeSceneId: 'home', scenes: [{ id: 'home', elementCount: 2 }] },
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('ProjectData');
    expect(messages[0].content).toContain('industrial-instrument');
    expect(messages[0].content).toContain('x+w<=100');
    expect(messages[1].content).toContain('生成冷却系统监控场景');
    expect(messages[1].content).toContain('"activeSceneId":"home"');
  });

  it('mounts text and image attachments without forwarding unsupported binary payloads', () => {
    const messages = buildSceneAiMessages({
      prompt: '分析这份设计稿并生成一个场景',
      context: { activeSceneId: 'home' },
      attachments: normalizeHarnessAttachments([
        { name: 'brief.md', type: 'text/markdown', category: 'document', size: 120, textContent: '标题置左，指标卡保持三列。' },
        { name: 'reference.png', type: 'image/png', category: 'image', size: 2048, dataUrl: 'data:image/png;base64,AAAA' },
        { name: 'scene.mp4', type: 'video/mp4', category: 'video', size: 4096, dataUrl: 'data:video/mp4;base64,SHOULD_NOT_BE_SENT' },
      ]),
    });

    expect(Array.isArray(messages[1].content)).toBe(true);
    const content = messages[1].content as Array<{ type: string; text?: string; image_url?: { url?: string } }>;
    expect(content[0].text).toContain('标题置左');
    expect(content.some((part) => part.type === 'image_url')).toBe(true);
    expect(content[0].text).toContain('scene.mp4');
    expect(content.some((part) => part.image_url?.url?.includes('SHOULD_NOT_BE_SENT'))).toBe(false);
  });

  it('builds and parses an independent Harness evaluation', () => {
    const messages = buildHarnessReviewMessages({
      prompt: '生成工业监控大屏',
      context: { activeSceneId: 'home' },
      proposal: { title: '监控方案', operations: [{ kind: 'create-scene', name: 'Overview' }] },
    });
    expect(messages[0].content).toContain('independent evaluator');
    const evaluation = parseHarnessReviewResponse(JSON.stringify({
      approved: true,
      score: 91.4,
      summary: '结构和交互边界通过',
      issues: [],
      repairInstructions: [],
    }));
    expect(evaluation).toMatchObject({ source: 'model', status: 'passed', score: 91, summary: '结构和交互边界通过' });
  });

  it('bounds attachment count and strips malformed image payloads', () => {
    const attachments = normalizeHarnessAttachments([
      { name: 'bad.svg', type: 'image/svg+xml', category: 'image', size: 10, dataUrl: 'data:image/svg+xml;base64,AAAA' },
      ...Array.from({ length: 20 }, (_, index) => ({ name: `file-${index}.glb`, type: 'model/gltf-binary', category: 'model', size: 10 })),
    ]);

    expect(attachments).toHaveLength(12);
    expect(attachments[0]).not.toHaveProperty('dataUrl');
  });

  it('parses fenced JSON, filters unsafe operations, and clamps fields', () => {
    const result = parseSceneAiResponse(`\`\`\`json
      ${JSON.stringify({
        title: '冷却系统方案',
        summary: '生成可编辑监控工程',
        operations: [
          { kind: 'create-scene', sceneId: 'cooling', name: '冷却监控', duration: 999999, bgColor: '#07111d' },
          {
            kind: 'create-element',
            sceneId: 'cooling',
            element: {
              id: 'pressure',
              type: 'ui-component',
              name: '压力',
              x: -10,
              y: 120,
              w: 999,
              h: 0,
              uiComponentType: 'gauge',
              uiComponentData: { dataBinding: { sourceId: 'mqtt.realtime' } },
            },
          },
          { kind: 'bind-mqtt', sceneId: 'cooling', targetElementId: 'pressure', pluginId: 'aether.pressure-gauge' },
          { kind: 'execute-code', code: 'alert(1)' },
        ],
      })}
    \`\`\``);

    expect(result.operations).toHaveLength(3);
    expect(result.operations[0]).toMatchObject({ kind: 'create-scene', duration: 86400 });
    expect(result.operations[1]).toMatchObject({
      kind: 'create-element',
      element: { type: 'ui-component', x: 0, y: 96, w: 100, h: 1 },
    });
    expect(result.operations[2]).toMatchObject({ kind: 'bind-mqtt', targetElementId: 'pressure' });
  });

  it('clamps model element dimensions to the remaining canvas area', () => {
    const result = parseSceneAiResponse(JSON.stringify({
      title: '边界方案',
      operations: [{
        kind: 'create-element',
        sceneId: 'new-scene',
        element: { type: 'txt', x: 95, y: 96, w: 50, h: 50, content: '标题' },
      }],
    }));
    expect(result.operations[0]).toMatchObject({
      kind: 'create-element',
      element: { x: 95, y: 96, w: 5, h: 4 },
    });
  });

  it('rejects empty or non-executable model output', () => {
    expect(() => parseSceneAiResponse('')).toThrow();
    expect(() => parseSceneAiResponse(JSON.stringify({ title: '空方案', operations: [] }))).toThrow();
    expect(() => parseSceneAiResponse('not json')).toThrow();
  });

  it('extracts compatible chat, array-content, reasoning, and Responses API payloads', () => {
    const proposal = JSON.stringify({ title: '兼容方案', operations: [{ kind: 'create-scene', name: '场景' }] });
    expect(extractSceneAiText({ choices: [{ message: { content: proposal } }] })).toBe(proposal);
    expect(extractSceneAiText({ choices: [{ message: { content: [{ type: 'text', text: proposal }] } }] })).toBe(proposal);
    expect(extractSceneAiText({ choices: [{ message: { reasoning_content: proposal } }] })).toBe(proposal);
    expect(extractSceneAiText({ output_text: proposal })).toBe(proposal);
    expect(extractSceneAiText({ output: [{ content: [{ type: 'output_text', text: proposal }] }] })).toBe(proposal);
    expect(parseSceneAiResponse({ choices: [{ message: { content: [{ type: 'text', text: proposal }] } }] })).toMatchObject({ title: '兼容方案' });
  });

  it('accepts Harness local-edit operations and advanced element fields', () => {
    const result = parseSceneAiResponse(JSON.stringify({
      title: 'Harness',
      operations: [
        { kind: 'update-element', sceneId: 'home', elementId: 'headline', patch: { textAlign: 'center', popupTheme: 'hologram', muted: true } },
        { kind: 'delete-element', sceneId: 'home', elementId: 'old-layer' },
        { kind: 'reorder-elements', sceneId: 'home', elementIds: ['headline', 'metric'] },
      ],
    }));
    expect(result.operations).toMatchObject([
      { kind: 'update-element', patch: { textAlign: 'center', popupTheme: 'hologram', muted: true } },
      { kind: 'delete-element', elementId: 'old-layer' },
      { kind: 'reorder-elements', elementIds: ['headline', 'metric'] },
    ]);
  });

  it('preserves structured interactions for generated controls', () => {
    const result = parseSceneAiResponse(JSON.stringify({
      title: 'Interactive proposal',
      operations: [{
        kind: 'create-element',
        sceneId: 'details',
        element: {
          type: 'ui-component',
          uiComponentType: 'glow-button',
          name: '查看详情',
          interaction: { trigger: 'click', action: 'jump', target: 'details' },
        },
      }],
    }));
    expect(result.operations[0]).toMatchObject({
      element: { interaction: { trigger: 'click', action: 'jump', target: 'details' } },
    });
  });

  it('normalizes common model aliases into executable AETHER operations', () => {
    const result = parseSceneAiResponse(JSON.stringify({
      title: 'Gateway format',
      operations: [
        { targetOperation: 'create-scene', sceneId: 'home', name: '监控场景' },
        {
          targetOperation: 'create-element',
          sceneId: 'home',
          elementId: 'status',
          elementType: 'ui-component',
          position: { x: 40, y: 40, w: 20, h: 10 },
          properties: { uiComponentType: 'status-indicator', label: '在线状态', state: 'connected' },
          animations: { animType: 'none', loopAnim: false },
        },
        { targetOperation: 'bind-mqtt', sceneId: 'home', elementId: 'status', binding: { sourceId: 'mqtt.realtime' } },
      ],
    }));

    expect(result.operations).toMatchObject([
      { kind: 'create-scene', sceneId: 'home' },
      { kind: 'create-element', element: { id: 'status', type: 'ui-component', x: 40, y: 40, w: 20, h: 10, content: '在线状态' } },
      { kind: 'bind-mqtt', targetElementId: 'status', pluginId: 'aether.metric-card' },
    ]);
  });

  it('accepts action and layer-list response variants from compatible models', () => {
    const actionResult = parseSceneAiResponse(JSON.stringify({
      title: '动作格式',
      actions: [
        { action: 'add-scene', name: '动作场景' },
        { action: 'add-layer', layer: { type: 'txt', name: '标题', x: 8, y: 8, w: 30, h: 10, content: '设备总览' } },
      ],
    }));
    expect(actionResult.operations).toMatchObject([
      { kind: 'create-scene', name: '动作场景' },
      { kind: 'create-element', element: { type: 'txt', name: '标题', content: '设备总览' } },
    ]);

    const layerListResult = parseSceneAiResponse(JSON.stringify({
      title: '图层列表格式',
      scene: { name: '图层场景' },
      layers: [{ type: 'shape', name: '边框', x: 10, y: 10, w: 20, h: 10 }],
    }));
    expect(layerListResult.operations).toHaveLength(2);
    expect(layerListResult.operations[1]).toMatchObject({ kind: 'create-element', element: { type: 'shape', name: '边框' } });

    const nestedResult = parseSceneAiResponse(JSON.stringify({
      proposal: {
        title: '嵌套方案',
        operations: [{ action: '创建图层', layer: { type: 'text', name: '标题', content: '实时数据' } }],
      },
    }));
    expect(nestedResult.operations[0]).toMatchObject({ kind: 'create-element', element: { type: 'txt', content: '实时数据' } });
  });
});
