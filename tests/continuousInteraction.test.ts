import { describe, expect, it } from 'vitest';
import { createDefaultContinuousInteraction, createMultiStageContinuousInteraction, getCrossedContinuousNodes, nextContinuousCheckpointPosition, normalizeContinuousInteraction, removeContinuousCheckpoint, resolveContinuousNodePopup } from '../src/utils/continuousInteraction';
import { createDefaultPopup } from '../src/utils/popups';
import { isContinuousInteractionComponent } from '../src/components/ui/GalaxyComponents';

describe('continuous interaction', () => {
  it('recognizes the bare progress variants as continuous interaction controls', () => {
    expect(isContinuousInteractionComponent('bare-glossy-progress-slider')).toBe(true);
    expect(isContinuousInteractionComponent('bare-threshold-slider')).toBe(true);
  });

  it('starts with a non-triggering start anchor and a terminal node', () => {
    const config = createDefaultContinuousInteraction();
    expect(config.nodes.map((node) => [node.role, node.position])).toEqual([['start', 0], ['end', 100]]);
  });

  it('provides a visible midpoint for newly inserted multi-stage controls', () => {
    const config = createMultiStageContinuousInteraction();
    expect(config.nodes.map((node) => [node.role, node.position])).toEqual([
      ['start', 0],
      ['checkpoint', 50],
      ['end', 100],
    ]);
  });

  it('returns forward crossings in travel order and excludes the start anchor', () => {
    const config = normalizeContinuousInteraction({ nodes: [
      { id: 'start', position: 0, role: 'start' },
      { id: 'intro', position: 30, role: 'checkpoint' },
      { id: 'detail', position: 60, role: 'checkpoint' },
      { id: 'end', position: 100, role: 'end' },
    ] });
    expect(getCrossedContinuousNodes(10, 72, config).map((node) => node.id)).toEqual(['intro', 'detail']);
  });

  it('returns reverse crossings in reverse travel order', () => {
    const config = normalizeContinuousInteraction({ nodes: [
      { id: 'start', position: 0, role: 'start' },
      { id: 'intro', position: 30, role: 'checkpoint' },
      { id: 'detail', position: 60, role: 'checkpoint' },
      { id: 'end', position: 100, role: 'end' },
    ] });
    expect(getCrossedContinuousNodes(80, 12, config).map((node) => node.id)).toEqual(['detail', 'intro']);
  });

  it('adds the next checkpoint at the center of the largest gap', () => {
    expect(nextContinuousCheckpointPosition({ nodes: [
      { id: 'start', position: 0, role: 'start' },
      { id: 'mid', position: 30, role: 'checkpoint' },
      { id: 'end', position: 100, role: 'end' },
    ] })).toBe(65);
  });

  it('removes only editable checkpoints and clears their active popup selection', () => {
    const config = normalizeContinuousInteraction({ activeNodeId: 'mid', nodes: [
      { id: 'start', position: 0, role: 'start' },
      { id: 'mid', position: 50, role: 'checkpoint' },
      { id: 'end', position: 100, role: 'end' },
    ] });

    expect(removeContinuousCheckpoint(config, 'mid').nodes.map((node) => node.id)).toEqual(['start', 'end']);
    expect(removeContinuousCheckpoint(config, 'mid').activeNodeId).toBeUndefined();
    expect(removeContinuousCheckpoint(config, 'start').nodes.map((node) => node.id)).toEqual(['start', 'mid', 'end']);
  });

  it('preserves node-local popup presentation settings', () => {
    const config = normalizeContinuousInteraction({ activeNodeId: 'detail', nodes: [
      { id: 'start', position: 0, role: 'start' },
      {
        id: 'detail',
        position: 50,
        role: 'checkpoint',
        interaction: { action: 'popup', target: 'details' },
        popup: {
          popupDisplay: 'popover',
          popupPosition: 'custom',
          popupX: 76,
          popupY: 24,
          popupSize: 'custom',
          popupWidth: 42,
          popupRatio: '1:1',
          popupTheme: 'glass',
        },
      },
      { id: 'end', position: 100, role: 'end' },
    ] });

    expect(config.nodes.find((node) => node.id === 'detail')?.popup).toMatchObject({
      popupDisplay: 'popover',
      popupPosition: 'custom',
      popupX: 76,
      popupY: 24,
      popupSize: 'custom',
      popupWidth: 42,
      popupRatio: '1:1',
      popupTheme: 'glass',
    });
    expect(config.activeNodeId).toBe('detail');
  });

  it('assigns distinct default geometry to separately created popup nodes', () => {
    const first = createDefaultPopup(0);
    const second = createDefaultPopup(1);

    expect([first.popupX, first.popupY, first.popupWidth]).not.toEqual([
      second.popupX,
      second.popupY,
      second.popupWidth,
    ]);
  });

  it('resolves legacy popup nodes to one complete free-size presentation', () => {
    const popup = resolveContinuousNodePopup({
      id: 'detail',
      position: 64,
      role: 'checkpoint',
      interaction: { action: 'popup', target: 'details' },
      popup: { popupX: 83, popupY: 54, popupWidth: 28, popupHeight: 20 },
    }, 1);

    expect(popup).toMatchObject({
      id: 'continuous-detail',
      target: 'details',
      enabled: true,
      popupPosition: 'custom',
      popupSize: 'custom',
      popupX: 83,
      popupY: 54,
      popupWidth: 28,
      popupHeight: 20,
      popupRatio: 'free',
    });
  });

  it('uses a node width as the free height when legacy data omitted height', () => {
    const popup = resolveContinuousNodePopup({
      id: 'detail',
      position: 64,
      role: 'checkpoint',
      interaction: { action: 'popup', target: 'details' },
      popup: { popupWidth: 28 },
    }, 0);

    expect(popup.popupHeight).toBe(28);
    expect(popup.popupRatio).toBe('free');
  });

  it('preserves an explicitly selected locked ratio', () => {
    const popup = resolveContinuousNodePopup({
      id: 'detail',
      position: 64,
      role: 'checkpoint',
      interaction: { action: 'popup', target: 'details' },
      popup: { popupWidth: 28, popupRatio: '16:9' },
    }, 0);

    expect(popup.popupRatio).toBe('16:9');
  });
});
