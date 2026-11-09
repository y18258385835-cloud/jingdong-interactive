import { describe, expect, it } from 'vitest';
import { deserializePluginDrag, serializePluginDrag } from '../src/plugins/dragPayload';
import { createAiPlugin } from '../src/plugins/pluginStudio';
import { OFFICIAL_PLUGIN_REGISTRY } from '../src/plugins/registry';

describe('plugin drag payload', () => {
  it('round-trips an official plugin and a user-created AI plugin', () => {
    const official = deserializePluginDrag(serializePluginDrag(OFFICIAL_PLUGIN_REGISTRY[0]));
    const ai = deserializePluginDrag(serializePluginDrag(createAiPlugin('泵组健康度', 'control-room', 'gauge')));
    expect(official?.id).toBe(OFFICIAL_PLUGIN_REGISTRY[0].id);
    expect(ai).toMatchObject({ source: 'ai', componentType: 'gauge' });
  });

  it('rejects malformed drag payloads', () => {
    expect(deserializePluginDrag('{not-json}')).toBeUndefined();
  });
});
