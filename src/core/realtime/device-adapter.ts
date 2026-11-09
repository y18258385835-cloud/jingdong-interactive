/**
 * Physical device integration contract.
 * Protocol adapters normalize device messages before they enter the realtime BFF.
 */

export type DeviceProtocol =
  | 'ocpp-1.6'
  | 'ocpp-2.0.1'
  | 'mqtt-3.1.1'
  | 'mqtt-5'
  | 'opc-ua'
  | 'modbus-tcp';

export interface DeviceSourceConfig {
  sourceId: string;
  tenantId: string;
  protocol: DeviceProtocol;
  endpoint: string;
  secretRef: string;
  enabled: boolean;
  topicPrefix?: string;
}

export interface MqttMessageInput {
  topic: string;
  payload: string | Uint8Array;
}

export interface DeviceTelemetryEvent {
  eventId: string;
  tenantId: string;
  sourceId: string;
  deviceId: string;
  protocol: DeviceProtocol;
  sequence?: number;
  occurredAt: string;
  status: 'online' | 'running' | 'idle' | 'warning' | 'fault' | 'offline';
  metrics: Record<string, number>;
  location?: { siteId?: string; latitude?: number; longitude?: number };
  rawType?: string;
}

export interface DeviceAdapter {
  readonly protocol: DeviceProtocol;
  connect(config: DeviceSourceConfig): Promise<void>;
  disconnect(): Promise<void>;
  normalize(input: unknown, config: DeviceSourceConfig): DeviceTelemetryEvent[];
  health(): Promise<{ connected: boolean; lastMessageAt?: string; detail?: string }>;
}

/** Stable boundary for future OCPP/MQTT/OPC UA/Modbus implementations. */
export interface DeviceAdapterRegistry {
  register(adapter: DeviceAdapter): void;
  get(protocol: DeviceProtocol): DeviceAdapter | undefined;
}
