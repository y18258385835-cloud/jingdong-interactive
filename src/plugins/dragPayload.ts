import type { OfficialPluginDefinition } from './registry';
import { validatePluginDefinition } from './pluginStudio';

export const PLUGIN_DRAG_MIME = 'application/x-aether-plugin-definition';
export const PLUGIN_DRAG_ID_MIME = 'application/x-aether-plugin';

export function serializePluginDrag(plugin: OfficialPluginDefinition): string {
  return JSON.stringify(plugin);
}

export function deserializePluginDrag(payload: string): OfficialPluginDefinition | undefined {
  try {
    const result = validatePluginDefinition(JSON.parse(payload));
    return result.ok ? result.plugin : undefined;
  } catch {
    return undefined;
  }
}
