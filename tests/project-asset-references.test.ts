import { describe, expect, it } from 'vitest';
import type { ProjectData } from '../src/types';
import { collectProjectAssetReferences, collectUnresolvedPackagedAssetReferences, isPackagedAssetReference, replaceProjectAssetReferences } from '../src/core/project/assetReferences';

describe('project export asset references', () => {
  it('collects assets used by nested layers, hotspots and interaction media', () => {
    const project = {
      start: 'main',
      scenes: {
        main: {
          id: 'main', type: 'scene', duration: 5, bgRef: 'asset_background', bgmRef: 'asset_audio', els: [{
            id: 'group', type: 'group', refId: '', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
            interaction: { action: 'media', mediaRefId: 'asset_interaction' },
            hotspots: [{ id: 'hotspot', mediaRefId: 'asset_hotspot', iconImageRefId: 'asset_icon' }],
            children: [{
              id: 'nested', type: 'img', refId: 'asset_nested', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
              vfxCards: [{ assetRef: 'asset_card' }],
            }],
          }],
        },
      },
    } as unknown as ProjectData;

    expect(collectProjectAssetReferences(project)).toEqual(new Set([
      'asset_background', 'asset_audio', 'asset_interaction', 'asset_hotspot',
      'asset_icon', 'asset_nested', 'asset_card',
    ]));
  });

  it('keeps only persisted local references for project packaging', () => {
    expect(isPackagedAssetReference('asset_local')).toBe(true);
    expect(isPackagedAssetReference('https://cdn.example.com/video.mp4')).toBe(false);
    expect(isPackagedAssetReference('data:image/png;base64,AA==')).toBe(false);
  });

  it('finds every local reference that would become a placeholder after import', () => {
    const project = {
      start: 'main',
      scenes: {
        main: {
          id: 'main', type: 'scene', duration: 5, bgRef: 'asset_background', els: [{
            id: 'group', type: 'group', refId: '', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
            children: [{
              id: 'nested', type: 'img', refId: 'asset_nested', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
              interaction: { action: 'media', mediaRefId: 'https://cdn.example.com/remote.mp4' },
              vfxCards: [{ assetRef: 'asset_card' }],
            }],
          }],
        },
      },
    } as unknown as ProjectData;

    expect(collectUnresolvedPackagedAssetReferences(project, new Set(['asset_background']))).toEqual([
      'asset_card', 'asset_nested',
    ]);
  });

  it('covers nested interaction data and component presets without rewriting ordinary content', () => {
    const project = {
      start: 'main',
      meta: { v: 1 },
      scenes: {
        main: {
          id: 'main', type: 'scene', duration: 5, els: [{
            id: 'text', type: 'text', refId: '', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
            text: 'asset_text_should_not_change',
            textHotspots: [{ id: 'text-hotspot', textKey: 'text', start: 0, end: 1, interaction: { action: 'media', mediaRefId: 'asset_text_media' } }],
            uiComponentData: {
              visual: { assetRefId: 'asset_visual' },
              continuousInteraction: { nodes: [{ id: 'node', position: 50, role: 'checkpoint', interaction: { action: 'media', mediaRefId: 'asset_node_media' } }] },
            },
          }],
        },
      },
      components: [{
        id: 'preset', name: 'Preset', createdAt: 0, elements: [{
          id: 'preset-image', type: 'img', refId: 'asset_preset', x: 0, y: 0, w: 100, h: 100, zIndex: 1, opacity: 100, startTime: 0, duration: 5,
        }],
      }],
    } as unknown as ProjectData;

    expect(collectProjectAssetReferences(project)).toEqual(new Set([
      'asset_text_media', 'asset_visual', 'asset_node_media', 'asset_preset',
    ]));

    replaceProjectAssetReferences(project, new Map([
      ['asset_text_media', 'asset_text_media_new'],
      ['asset_visual', 'asset_visual_new'],
      ['asset_node_media', 'asset_node_media_new'],
      ['asset_preset', 'asset_preset_new'],
      ['asset_text_should_not_change', 'incorrectly_changed'],
    ]));

    const element = project.scenes.main.els[0] as any;
    expect(element.text).toBe('asset_text_should_not_change');
    expect(element.textHotspots[0].interaction.mediaRefId).toBe('asset_text_media_new');
    expect(element.uiComponentData.visual.assetRefId).toBe('asset_visual_new');
    expect(element.uiComponentData.continuousInteraction.nodes[0].interaction.mediaRefId).toBe('asset_node_media_new');
    expect(project.components?.[0].elements[0].refId).toBe('asset_preset_new');
  });
});
