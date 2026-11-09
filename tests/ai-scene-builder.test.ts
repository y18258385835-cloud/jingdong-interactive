import { describe, expect, it } from 'vitest';
import type { ProjectData, SceneElement } from '../src/types';
import {
  analyzeAiSceneProposal,
  applyAiSceneProposal,
  createLocalAiSceneProposal,
  sanitizeAiSceneProposal,
} from '../src/core/ai/sceneBuilder';
import { AI_SCENE_DESIGN_CONTRACT, AI_SCENE_VISUAL_TOKENS } from '../src/core/ai/sceneDesignGrammar';

const emptyProject: ProjectData = {
  meta: { v: 42.1, title: 'Test project' },
  start: 'home',
  canvas: { width: 1920, height: 1080 },
  scenes: {
    home: {
      id: 'home',
      alias: 'Home',
      type: 'scene',
      duration: 10,
      bgColor: '#070b12',
      els: [],
    },
  },
};

describe('AI scene builder', () => {
  it('creates a local first-phase proposal with MQTT operations', () => {
    const proposal = createLocalAiSceneProposal('生成冷却系统压力监控');
    expect(proposal.source).toBe('local');
    expect(proposal.operations.some((operation) => operation.kind === 'create-scene')).toBe(true);
    expect(proposal.operations.filter((operation) => operation.kind === 'create-element').length).toBeGreaterThan(4);
    expect(proposal.operations.filter((operation) => operation.kind === 'bind-mqtt').length).toBeGreaterThan(0);
    expect(proposal.layout.overlaps).toHaveLength(0);
    expect(proposal.layout.visualIssues.filter((issue) => issue.code === 'overlap')).toHaveLength(0);
    const elements = proposal.operations.filter((operation) => operation.kind === 'create-element').map((operation) => operation.element);
    expect(elements[0]).toMatchObject({ id: 'ai_vfx', type: 'vfx', opacity: 18 });
    expect(elements.find((element) => element.id === 'ai_title')).toMatchObject({ x: 6, y: 6, w: 88, h: 7, fontSize: 32, content: '冷却系统压力监控' });
    expect(elements.filter((element) => element.y === 25).map((element) => element.h)).toEqual([28, 28, 28]);
    expect(elements.find((element) => element.id === 'ai_trend')).toMatchObject({ x: 6, y: 58, w: 58, h: 29 });
    expect(elements.find((element) => element.id === 'ai_alerts')).toMatchObject({ x: 66, y: 58, w: 28, h: 29 });
    expect(proposal.operations.filter((operation) => operation.kind === 'create-scene')).toHaveLength(2);
    expect(elements.find((element) => element.id === 'ai_detail_action')).toMatchObject({ link: 'ai-detail', linkType: 'jump', trigger: 'click', uiComponentType: 'glow-button' });
    expect(elements.find((element) => element.id === 'ai_overview_action')).toMatchObject({ link: 'new-scene', linkType: 'jump', trigger: 'click', uiComponentType: 'glow-button' });
    expect(proposal.design).toMatchObject({ style: 'industrial-instrument', layoutTemplate: 'control-room-overview' });
    expect(proposal.layout.visualIssues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
  });

  it('resolves generated scene targets for the local interaction loop', () => {
    const proposal = createLocalAiSceneProposal('生成一个设备监控交互页面');
    const result = applyAiSceneProposal(emptyProject, proposal, 'home');
    const detailScene = Object.values(result.project.scenes).find((scene) => scene.alias.endsWith('详情'));
    expect(detailScene).toBeDefined();
    const overview = result.project.scenes[result.createdSceneId!];
    const overviewAction = overview.els.find((element) => element.sourceName === '查看详情');
    const detailAction = detailScene?.els.find((element) => element.sourceName === '返回总览');
    expect(overviewAction).toMatchObject({ link: detailScene?.id, linkType: 'jump', trigger: 'click' });
    expect(detailAction).toMatchObject({ link: result.createdSceneId, linkType: 'jump', trigger: 'click' });
  });

  it('writes every product template layer into its generated scene', () => {
    const proposal = createLocalAiSceneProposal('生成一个产品发布主视觉');
    const result = applyAiSceneProposal(emptyProject, proposal, 'home');
    const launchScene = Object.values(result.project.scenes).find((scene) => scene.alias.startsWith('模板 ·'));
    const detailScene = Object.values(result.project.scenes).find((scene) => scene.alias.endsWith('核心卖点'));
    expect(proposal.title).toContain('产品发布模板');
    expect(result.skippedOperationCount).toBe(0);
    expect(launchScene?.els.length).toBeGreaterThan(5);
    expect(detailScene?.els.some((element) => element.sourceName === '返回发布页')).toBe(true);
  });

  it('uses distinct editable structures for exhibition and motion templates', () => {
    const exhibition = createLocalAiSceneProposal('生成沉浸式展陈导览');
    const motion = createLocalAiSceneProposal('生成 Saber 光效系统');
    expect(exhibition.operations.some((operation) => operation.kind === 'create-element' && operation.element.type === 'panorama-img')).toBe(true);
    expect(motion.operations.some((operation) => operation.kind === 'create-element' && operation.element.type === 'saber')).toBe(true);
    expect(applyAiSceneProposal(emptyProject, exhibition, 'home').skippedOperationCount).toBe(0);
    expect(applyAiSceneProposal(emptyProject, motion, 'home').skippedOperationCount).toBe(0);
  });

  it('builds editable multi-scene structures for every exhibition wall template', () => {
    const prompts = ['展厅序厅迎宾大屏模板', '品牌时间轴叙事大屏模板', '园区数字沙盘导览模板', '互动产品体验墙模板'];
    prompts.forEach((prompt) => {
      const proposal = createLocalAiSceneProposal(prompt);
      const result = applyAiSceneProposal(emptyProject, proposal, 'home');
      const sceneOperations = proposal.operations.filter((operation) => operation.kind === 'create-scene');
      const jumpActions = proposal.operations.filter((operation) => operation.kind === 'create-element' && operation.element.linkType === 'jump');
      expect(proposal.title).toContain('展厅大屏模板');
      expect(sceneOperations).toHaveLength(2);
      expect(jumpActions.length).toBeGreaterThanOrEqual(2);
      expect(result.createdSceneId).toBeTruthy();
      expect(result.skippedOperationCount).toBe(0);
    });
  });

  it('maps explicit semantic roles without changing unknown legacy elements', () => {
    const proposal = sanitizeAiSceneProposal({
      title: 'Semantic layout',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Semantic scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'headline', role: 'page-title', type: 'txt', x: 40, y: 40, w: 10, h: 10, fontSize: 72 } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'legacy', type: 'shape', x: 40, y: 40, w: 10, h: 10 } },
      ],
    });
    expect(proposal).not.toBeNull();
    expect(proposal?.operations[1]).toMatchObject({ element: { x: 6, y: 6, w: 88, h: 7, fontSize: 36, role: 'page-title' } });
    expect(proposal?.operations[2]).toMatchObject({ element: { x: 40, y: 40, w: 10, h: 10 } });
  });

  it('keeps a full-canvas vfx out of collision avoidance', () => {
    const raw = sanitizeAiSceneProposal({
      title: 'Background test',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Effect scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'effect', type: 'vfx', x: 0, y: 0, w: 100, h: 100, opacity: 90 } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'card', type: 'ui-component', x: 10, y: 10, w: 30, h: 20 } },
      ],
    });
    const result = applyAiSceneProposal(emptyProject, raw!, 'home');
    const created = result.createdSceneId ? result.project.scenes[result.createdSceneId] : undefined;
    expect(created?.els[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 100, opacity: 24, zIndex: 0 });
    expect(created?.els[1]).toMatchObject({ x: 10, y: 10, w: 30, h: 20 });
    expect(result.adjustedCount).toBe(0);
  });

  it('detects overlaps and applies a proposal as one editable project change', () => {
    const raw = sanitizeAiSceneProposal({
      title: 'Overlap test',
      summary: 'test',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'AI scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'one', type: 'txt', content: 'A', x: 10, y: 10, w: 40, h: 20 } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'two', type: 'ui-component', uiComponentType: 'metric-card', pluginId: 'aether.metric-card', x: 10, y: 10, w: 40, h: 20 } },
      ],
      warnings: [],
    });
    expect(raw).not.toBeNull();
    expect(analyzeAiSceneProposal(raw!)).toHaveLength(1);
    const result = applyAiSceneProposal(emptyProject, raw!, 'home');
    const created = result.createdSceneId ? result.project.scenes[result.createdSceneId] : undefined;
    expect(created?.els).toHaveLength(2);
    expect(result.adjustedCount).toBeGreaterThan(0);
    expect(created?.els[1].uiComponentData?.dataBinding?.sourceId).toBe('mqtt.realtime');
    expect(created?.els[1].uiComponentData?.aiLayoutManaged).toBe(true);
    expect(result.appliedOperationCount).toBe(3);
    expect(result.skippedOperationCount).toBe(0);
  });

  it('treats auto-resolvable overlap as a visual warning instead of blocking apply', () => {
    const proposal = sanitizeAiSceneProposal({
      title: 'Overlap warning',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Overlap scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'one', type: 'shape', x: 10, y: 10, w: 40, h: 20 } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'two', type: 'shape', x: 10, y: 10, w: 40, h: 20 } },
      ],
    });
    expect(proposal?.layout.visualIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'overlap', severity: 'warning' }),
    ]));
    expect(proposal?.layout.visualIssues.some((issue) => issue.severity === 'error')).toBe(false);
  });

  it('enforces the visual contract on untrusted model styling and geometry', () => {
    const proposal = sanitizeAiSceneProposal({
      title: 'Design contract',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Contract scene', bgColor: '#ffffff' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'headline', role: 'page-title', type: 'txt', x: 41.2, y: 40.1, w: 12.7, h: 8.2, fontSize: 8, color: '#111111' } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'card', type: 'ui-component', x: 10.13, y: 20.24, w: 20.26, h: 16.74, uiComponentData: { color: '#ff0033', textColor: '#050505' } } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'custom-shape', type: 'shape', shapePath: 'M 0 0 L 100 0 L 50 100 Z', x: 41.2, y: 40.1, w: 12.7, h: 8.2, backgroundColor: '#ff0033' } },
      ],
    });

    const elements = proposal?.operations.filter((operation) => operation.kind === 'create-element').map((operation) => operation.element) || [];
    const title = elements.find((element) => element.id === 'headline');
    const card = elements.find((element) => element.id === 'card');
    const shape = elements.find((element) => element.id === 'custom-shape');
    expect(title).toMatchObject({ x: 6, y: 6, w: 88, h: 7, fontSize: 24, color: AI_SCENE_VISUAL_TOKENS.textPrimary });
    expect(card).toMatchObject({ x: 10, y: 20, w: 20.5, h: 16.5, borderRadius: AI_SCENE_DESIGN_CONTRACT.maxSurfaceRadius });
    expect(card?.uiComponentData).toMatchObject({
      surfaceColor: AI_SCENE_VISUAL_TOKENS.surface,
      accentColor: AI_SCENE_VISUAL_TOKENS.accentPrimary,
      aiDesignContract: 'industrial-instrument-v1',
    });
    expect(shape).toMatchObject({
      gradientStart: AI_SCENE_VISUAL_TOKENS.surface,
      gradientVia: AI_SCENE_VISUAL_TOKENS.accentPrimary,
      gradientEnd: AI_SCENE_VISUAL_TOKENS.accentSecondary,
    });
    expect(proposal?.layout.visualIssues.some((issue) => issue.code === 'spacing')).toBe(false);
    expect(proposal?.layout.visualIssues.some((issue) => issue.code === 'contrast' && issue.severity === 'error')).toBe(false);
  });

  it('keeps generated elements inside the canvas and reports invalid bindings', () => {
    const raw = sanitizeAiSceneProposal({
      title: 'Boundary test',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Safe scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'edge', type: 'txt', x: 95, y: 96, w: 50, h: 50 } },
        { kind: 'bind-mqtt', sceneId: 'new-scene', targetElementId: 'missing', pluginId: 'aether.metric-card' },
      ],
    });
    const result = applyAiSceneProposal(emptyProject, raw!, 'home');
    const created = result.createdSceneId ? result.project.scenes[result.createdSceneId] : undefined;
    expect(created?.els[0]).toMatchObject({ x: 95, y: 96, w: 5, h: 4 });
    expect(result.appliedOperationCount).toBe(2);
    expect(result.skippedOperationCount).toBe(1);
    expect(result.skippedOperationIndexes).toEqual([2]);
  });

  it('applies local element edits, deletes, and reorder operations', () => {
    const proposal = sanitizeAiSceneProposal({
      title: '局部修改',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Harness scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'hero', type: 'txt', name: 'Hero', content: '旧标题' } },
        { kind: 'create-element', sceneId: 'new-scene', element: { id: 'shape', type: 'shape', name: 'Shape' } },
        { kind: 'update-element', sceneId: 'new-scene', targetOperation: 1, patch: { content: '新标题', textAlign: 'center', animType: 'fade-in' } },
        { kind: 'reorder-elements', sceneId: 'new-scene', elementIds: ['shape', 'hero'] },
        { kind: 'delete-element', sceneId: 'new-scene', targetOperation: 2 },
      ],
    });
    const result = applyAiSceneProposal(emptyProject, proposal!, 'home');
    const scene = result.project.scenes[result.createdSceneId!];
    expect(result.appliedOperationCount).toBe(6);
    expect(scene.els).toHaveLength(1);
    expect(scene.els[0]).toMatchObject({ content: '新标题', textAlign: 'center', animType: 'fade-in' });
  });

  it('resolves active-scene defaults for edits to the current project', () => {
    const existingElements: SceneElement[] = [
      { id: 'hero', type: 'txt', refId: '', content: '旧标题', x: 8, y: 8, w: 40, h: 10, zIndex: 1, opacity: 100, startTime: 0, duration: 10 },
      { id: 'shape', type: 'shape', refId: '', x: 8, y: 24, w: 20, h: 20, zIndex: 2, opacity: 100, startTime: 0, duration: 10 },
    ];
    const project: ProjectData = {
      ...emptyProject,
      scenes: { ...emptyProject.scenes, home: { ...emptyProject.scenes.home, els: existingElements } },
    };
    const proposal = sanitizeAiSceneProposal({
      title: 'Edit current scene',
      operations: [
        { kind: 'update-element', elementId: 'hero', patch: { content: '新标题' } },
        { kind: 'reorder-elements', elementIds: ['shape', 'hero'] },
        { kind: 'delete-element', elementId: 'shape' },
      ],
    });
    const result = applyAiSceneProposal(project, proposal!, 'home');
    expect(result.skippedOperationCount).toBe(0);
    expect(result.project.scenes.home.els).toHaveLength(1);
    expect(result.project.scenes.home.els[0]).toMatchObject({ id: 'hero', content: '新标题' });
  });

  it('keeps advanced media, visual, timeline, interaction, and 3D fields', () => {
    const proposal = sanitizeAiSceneProposal({
      title: '高级字段',
      operations: [
        { kind: 'create-scene', sceneId: 'new-scene', name: 'Advanced scene' },
        { kind: 'create-element', sceneId: 'new-scene', element: {
          type: 'vid', refId: 'asset-video', vidMode: 'click', muted: true, playbackRate: 1.25,
          linkType: 'popup', popupTheme: 'hologram', hoverEffect: 'glow', loopAnim: 'float',
          shapePath: 'M 0 0 L 100 0 L 100 100 Z',
        } },
      ],
    });
    const result = applyAiSceneProposal(emptyProject, proposal!, 'home');
    const scene = result.project.scenes[result.createdSceneId!];
    expect(scene.els[0]).toMatchObject({
      refId: 'asset-video', vidMode: 'click', muted: true, playbackRate: 1.25,
      linkType: 'popup', popupTheme: 'hologram', hoverEffect: 'glow', loopAnim: 'float', shapePath: 'M 0 0 L 100 0 L 100 100 Z',
    });
  });
});
