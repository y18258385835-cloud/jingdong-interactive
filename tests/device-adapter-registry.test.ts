import { describe, expect, it } from 'vitest';
import { RealtimeDeviceAdapterRegistry } from '../src/core/realtime/device-adapter-registry';
import type { DeviceAdapter } from '../src/core/realtime/device-adapter';

const adapter = (protocol: DeviceAdapter['protocol']): DeviceAdapter => ({
  protocol,
  connect: async () => undefined,
  disconnect: async () => undefined,
  normalize: () => [],
  health: async () => ({ connected: false }),
});

describe('realtime device adapter registry', () => {
  it('registers and retrieves protocol adapters', () => {
    const registry = new RealtimeDeviceAdapterRegistry();
    const mqtt = adapter('mqtt-5');
    registry.register(mqtt);
    expect(registry.get('mqtt-5')).toBe(mqtt);
    expect(registry.list()).toEqual(['mqtt-5']);
  });

  it('rejects duplicate protocol registrations', () => {
    const registry = new RealtimeDeviceAdapterRegistry();
    registry.register(adapter('ocpp-1.6'));
    expect(() => registry.register(adapter('ocpp-1.6'))).toThrow('already registered');
  });
});
