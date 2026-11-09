import { describe, expect, it } from 'vitest';
import { OFFICIAL_PLUGIN_REGISTRY } from '../src/plugins/registry';

describe('official industrial plugin registry', () => {
  it('exposes the main terminal capabilities as installed plugins', () => {
    const names = OFFICIAL_PLUGIN_REGISTRY.map((plugin) => plugin.name);
    expect(names).toEqual(expect.arrayContaining(['温度监测卡', '电压监测卡', '压力仪表', 'GPS / 北斗定位', '电池健康度', '告警事件列表']));
    expect(OFFICIAL_PLUGIN_REGISTRY.filter((plugin) => plugin.telemetry).length).toBeGreaterThanOrEqual(14);
  });

  it('requires a data mapping for every industrial data plugin', () => {
    const industrialContracts = new Set(['temperature.v1', 'voltage.v1', 'current.v1', 'pressure.v1', 'humidity.v1', 'flow.v1', 'vibration.v1', 'energy.v1', 'geo.v1', 'signal.v1', 'battery.v1', 'topology.v1']);
    const industrial = OFFICIAL_PLUGIN_REGISTRY.filter((plugin) => industrialContracts.has(plugin.dataContract));
    expect(industrial.every((plugin) => plugin.telemetry && Object.keys(plugin.telemetry).length > 0)).toBe(true);
  });
});
