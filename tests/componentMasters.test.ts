import { describe, expect, it } from 'vitest';
import type { ComponentPreset, ProjectData, SceneElement } from '../src/types';
import {
  createInstanceGroup,
  createMasterFromSelection,
  deleteMaster,
  detachInstance,
  resolveMasterDataset,
  saveInstanceAsVariant,
  setInstanceOverride,
  switchInstanceVariant,
  syncInstancesForMaster,
  updateMasterFromInstance,
} from '../src/utils/componentMasters';

const makeElement = (id: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id,
  type: 'shape',
  refId: '',
  x,
  y,
  w,
  h,
  zIndex: 1,
  opacity: 100,
  startTime: 0,
  duration: 5,
  ...extra,
});

const makeProject = (elements: SceneElement[], components: ComponentPreset[] = []): ProjectData => ({
  meta: { title: '测试工程' },
  scenes: {
    scene1: {
      id: 'scene1',
      alias: '场景 1',
      duration: 10,
      els: elements,
    },
  },
  start: 'scene1',
  components,
} as unknown as ProjectData);

const findGroup = (project: ProjectData, id: string) => project.scenes.scene1.els.find((element) => element.id === id);
const findChild = (project: ProjectData, groupId: string, sourceId: string) => findGroup(project, groupId)?.children?.find((child) => child.componentSourceId === sourceId);

describe('componentMasters', () => {
  it('creates a master and a linked instance from selected elements', () => {
    const result = createMasterFromSelection(
      [
        makeElement('a', 10, 20, 20, 10, { type: 'txt', content: '标题' }),
        makeElement('b', 40, 50, 30, 20),
      ],
      '数据卡片',
      { masterId: 'cmp_test', groupId: 'grp_test', zIndex: 6 },
    );
    expect(result).not.toBeNull();
    const { master, group } = result!;
    expect(master.width).toBe(60);
    expect(master.height).toBe(50);
    expect(master.variants).toHaveLength(1);
    expect(master.elements.map((element) => element.componentSourceId)).toEqual(['src_cmp_test_0', 'src_cmp_test_1']);
    expect(group.x).toBe(10);
    expect(group.y).toBe(20);
    expect(group.w).toBe(60);
    expect(group.h).toBe(50);
    expect(group.componentInstance).toMatchObject({ masterId: 'cmp_test', variantId: 'default', overrides: {} });
    expect(group.children).toHaveLength(2);
    expect(group.children?.[0].componentSourceId).toBe('src_cmp_test_0');
    expect(group.children?.[0].x).toBe(0);
    expect(group.children?.[1].x).toBe(50);
  });

  it('updates linked instances and preserves per-instance overrides', () => {
    const { master } = createMasterFromSelection(
      [
        makeElement('a', 10, 20, 20, 10, { type: 'txt', content: '标题' }),
        makeElement('b', 40, 20, 20, 10),
      ],
      '卡片',
      { masterId: 'cmp_sync', groupId: 'grp_initial' },
    )!;
    const instanceA = createInstanceGroup(master, { groupId: 'grp_a', x: 10, y: 20, w: 60, h: 30 });
    const instanceB = createInstanceGroup(master, { groupId: 'grp_b', x: 10, y: 60, w: 60, h: 30 });
    let project = makeProject([instanceA, instanceB], [master]);

    const sourceId = master.elements[0].componentSourceId!;
    project = setInstanceOverride(project, 'grp_b', sourceId, { content: '副本标题' });
    expect(findChild(project, 'grp_b', sourceId)?.content).toBe('副本标题');

    const nextMaster: ComponentPreset = {
      ...master,
      elements: master.elements.map((element, index) => index === 0 ? { ...element, content: '新标题' } : element),
      variants: [{ id: 'default', name: '默认', elements: master.elements.map((element, index) => index === 0 ? { ...element, content: '新标题' } : element) }],
    };
    project = syncInstancesForMaster(project, nextMaster);
    expect(findChild(project, 'grp_a', sourceId)?.content).toBe('新标题');
    expect(findChild(project, 'grp_b', sourceId)?.content).toBe('副本标题');
  });

  it('updates the master from an instance and clears that instance overrides', () => {
    const { master } = createMasterFromSelection(
      [makeElement('a', 10, 20, 20, 10, { type: 'txt', content: '原标题' })],
      '卡片',
      { masterId: 'cmp_update', groupId: 'grp_initial' },
    )!;
    const instanceA = createInstanceGroup(master, { groupId: 'grp_a', x: 10, y: 20, w: 60, h: 30 });
    const instanceB = createInstanceGroup(master, { groupId: 'grp_b', x: 10, y: 60, w: 60, h: 30 });
    let project = makeProject([instanceA, instanceB], [master]);
    const sourceId = master.elements[0].componentSourceId!;
    project = setInstanceOverride(project, 'grp_a', sourceId, { content: '改过的标题' });
    const result = updateMasterFromInstance(project, 'grp_a');
    expect(result).not.toBeNull();
    project = result!.projectData;
    expect(result!.master.elements[0].content).toBe('改过的标题');
    expect(findGroup(project, 'grp_a')?.componentInstance?.overrides).toEqual({});
    expect(findChild(project, 'grp_a', sourceId)?.content).toBe('改过的标题');
    expect(findChild(project, 'grp_b', sourceId)?.content).toBe('改过的标题');
  });

  it('supports variants and switching an instance between them', () => {
    const { master } = createMasterFromSelection(
      [makeElement('a', 10, 20, 20, 10, { type: 'txt', content: '默认标题' })],
      '卡片',
      { masterId: 'cmp_variant', groupId: 'grp_initial' },
    )!;
    const instance = createInstanceGroup(master, { groupId: 'grp_a', x: 10, y: 20, w: 60, h: 30 });
    let project = makeProject([instance], [master]);
    const sourceId = master.elements[0].componentSourceId!;
    project = setInstanceOverride(project, 'grp_a', sourceId, { content: '悬停标题' });
    const saved = saveInstanceAsVariant(project, 'grp_a', '悬停');
    expect(saved).not.toBeNull();
    project = saved!.projectData;
    expect(project.components?.[0].variants).toHaveLength(2);
    expect(findGroup(project, 'grp_a')?.componentInstance?.variantId).toBe(saved!.variantId);
    expect(findChild(project, 'grp_a', sourceId)?.content).toBe('悬停标题');

    project = switchInstanceVariant(project, 'grp_a', 'default');
    expect(findChild(project, 'grp_a', sourceId)?.content).toBe('默认标题');
    project = switchInstanceVariant(project, 'grp_a', saved!.variantId);
    expect(findChild(project, 'grp_a', sourceId)?.content).toBe('悬停标题');
  });

  it('detaches an instance and detaches instances when a master is deleted', () => {
    const { master } = createMasterFromSelection(
      [makeElement('a', 10, 20, 20, 10)],
      '卡片',
      { masterId: 'cmp_detach', groupId: 'grp_initial' },
    )!;
    const instance = createInstanceGroup(master, { groupId: 'grp_a', x: 10, y: 20, w: 60, h: 30 });
    let project = makeProject([instance], [master]);
    project = detachInstance(project, 'grp_a');
    expect(findGroup(project, 'grp_a')?.componentInstance).toBeUndefined();
    expect(findGroup(project, 'grp_a')?.children?.[0].componentSourceId).toBeUndefined();

    const linked = createInstanceGroup(master, { groupId: 'grp_b', x: 10, y: 20, w: 60, h: 30 });
    project = makeProject([linked], [master]);
    project = deleteMaster(project, master.id);
    expect(project.components).toHaveLength(0);
    expect(findGroup(project, 'grp_b')?.componentInstance).toBeUndefined();
  });

  it('normalizes legacy presets that still use absolute coordinates', () => {
    const legacy: ComponentPreset = {
      id: 'legacy',
      name: '旧组件',
      createdAt: 1,
      elements: [makeElement('old_a', 20, 30, 10, 10), makeElement('old_b', 40, 30, 10, 10)],
    };
    const resolved = resolveMasterDataset(legacy);
    expect(resolved.width).toBe(30);
    expect(resolved.height).toBe(10);
    expect(resolved.variants).toHaveLength(1);
    expect(resolved.variants?.[0].elements[0].x).toBe(0);
    expect(resolved.variants?.[0].elements[1].x).toBeCloseTo(66.67, 1);
  });
});
