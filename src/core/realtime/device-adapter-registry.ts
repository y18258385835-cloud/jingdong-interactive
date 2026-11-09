import type { DeviceAdapter, DeviceAdapterRegistry, DeviceProtocol } from './device-adapter';

/** Runtime registry shared by future OCPP/MQTT/OPC UA/Modbus adapters. */
export class RealtimeDeviceAdapterRegistry implements DeviceAdapterRegistry {
  private readonly adapters = new Map<DeviceProtocol, DeviceAdapter>();

  register(adapter: DeviceAdapter): void {
    if (this.adapters.has(adapter.protocol)) {
      throw new Error(`device adapter already registered: ${adapter.protocol}`);
    }
    this.adapters.set(adapter.protocol, adapter);
  }

  get(protocol: DeviceProtocol): DeviceAdapter | undefined {
    return this.adapters.get(protocol);
  }

  list(): DeviceProtocol[] {
    return [...this.adapters.keys()];
  }
}

export const realtimeDeviceAdapters = new RealtimeDeviceAdapterRegistry();
