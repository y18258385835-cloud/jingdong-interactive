import { EventEmitter } from 'node:events';
import net from 'node:net';
import mqtt from 'mqtt';
import * as mqttPacket from 'mqtt-packet';
import { describe, expect, it, vi } from 'vitest';
import { createMqtt5Adapter, normalizeMqtt5Message } from '../server/realtime-mqtt-adapter.js';
import { createRealtimeDeviceStore } from '../server/realtime-device-store.js';

function topicMatches(filter: string, topic: string) {
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');
  for (let index = 0; index < filterParts.length; index += 1) {
    if (filterParts[index] === '#') return true;
    if (filterParts[index] === '+' || filterParts[index] === topicParts[index]) continue;
    return false;
  }
  return filterParts.length === topicParts.length;
}

async function startMqtt5TestBroker() {
  let nextMessageId = 1;
  const subscriptions = new Map<net.Socket, string[]>();
  const server = net.createServer((socket) => {
    const parser = mqttPacket.parser({ protocolVersion: 5 });
    subscriptions.set(socket, []);
    parser.on('packet', (packet) => {
      if (packet.cmd === 'connect') {
        socket.write(mqttPacket.generate({ cmd: 'connack', sessionPresent: false, reasonCode: 0 }, { protocolVersion: 5 }));
      } else if (packet.cmd === 'subscribe') {
        subscriptions.set(socket, packet.subscriptions.map((subscription) => subscription.topic));
        socket.write(mqttPacket.generate({ cmd: 'suback', messageId: packet.messageId, granted: packet.subscriptions.map(() => 1) }, { protocolVersion: 5 }));
      } else if (packet.cmd === 'publish') {
        for (const [subscriber, filters] of subscriptions) {
          if (subscriber.destroyed || !filters.some((filter) => topicMatches(filter, packet.topic))) continue;
          subscriber.write(mqttPacket.generate({
            cmd: 'publish',
            topic: packet.topic,
            payload: packet.payload,
            qos: 1,
            dup: false,
            retain: false,
            messageId: nextMessageId++,
          }, { protocolVersion: 5 }));
        }
        if (packet.qos === 1 && packet.messageId !== undefined) {
          socket.write(mqttPacket.generate({ cmd: 'puback', messageId: packet.messageId, reasonCode: 0 }, { protocolVersion: 5 }));
        }
      } else if (packet.cmd === 'pingreq') {
        socket.write(mqttPacket.generate({ cmd: 'pingresp' }, { protocolVersion: 5 }));
      }
    });
    parser.on('error', () => socket.destroy());
    socket.on('data', (data) => parser.parse(data));
    socket.on('close', () => subscriptions.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('embedded MQTT 5 broker did not bind');
  return {
    endpoint: `mqtt://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const config = {
  tenantId: 'tenant-alpha',
  sourceId: 'mqtt-line',
  protocol: 'mqtt-5' as const,
  endpoint: 'mqtt://127.0.0.1:1883',
  secretRef: 'vault/mqtt-line',
  enabled: true,
};

describe('MQTT 5 adapter', () => {
  it('normalizes payloads and keeps tenant/source scope from server config', () => {
    const events = normalizeMqtt5Message({
      topic: 'aether/tenant-alpha/mqtt-line/device-001/telemetry',
      payload: JSON.stringify({
        tenantId: 'tenant-attacker',
        deviceId: 'device-001',
        status: 'running',
        sequence: 7,
        occurredAt: '2026-09-12T09:00:00.000Z',
        metrics: { powerKw: '12.4', temperatureC: 31.2, invalid: 'not-a-number' },
      }),
    }, config);

    expect(events).toEqual([expect.objectContaining({
      tenantId: 'tenant-alpha', sourceId: 'mqtt-line', deviceId: 'device-001', protocol: 'mqtt-5', sequence: 7,
      status: 'running', metrics: { powerKw: 12.4, temperatureC: 31.2 },
    })]);
  });

  it('connects with MQTT protocol version 5, subscribes, and emits normalized events', async () => {
    const client = new EventEmitter() as EventEmitter & { subscribe: (topic: string, options: unknown, callback: (error?: Error) => void) => void; end: (force: boolean, options: unknown, callback: () => void) => void };
    client.subscribe = vi.fn((_topic, _options, callback) => callback());
    client.end = vi.fn((_force, _options, callback) => callback());
    const connectClient = vi.fn((_endpoint: string, _options: Record<string, unknown>) => {
      queueMicrotask(() => client.emit('connect'));
      return client;
    }) as unknown as (endpoint: string, options: Record<string, unknown>) => any;
    const received: unknown[] = [];
    const adapter = createMqtt5Adapter({ connectClient, onEvent: (event) => { received.push(event); } });

    await adapter.connect(config);
    expect(connectClient).toHaveBeenCalledWith(config.endpoint, expect.objectContaining({ protocolVersion: 5 }));
    expect(client.subscribe).toHaveBeenCalledWith('aether/tenant-alpha/mqtt-line/+/telemetry', { qos: 1 }, expect.any(Function));

    client.emit('message', 'aether/tenant-alpha/mqtt-line/device-001/telemetry', Buffer.from(JSON.stringify({ deviceId: 'device-001', sequence: 1, metrics: { powerKw: 10 } })));
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line', deviceId: 'device-001', sequence: 1 });
    expect(await adapter.health()).toMatchObject({ connected: true });

    await adapter.disconnect();
    expect(client.end).toHaveBeenCalled();
    expect(await adapter.health()).toMatchObject({ connected: false });
  });

  it('rejects non-MQTT endpoints', async () => {
    const adapter = createMqtt5Adapter({ connectClient: vi.fn() });
    await expect(adapter.connect({ ...config, endpoint: 'http://127.0.0.1:1883' })).rejects.toThrow('mqtt://');
  });

  it('marks the connection offline and resubscribes after reconnect', async () => {
    const client = new EventEmitter() as EventEmitter & { subscribe: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    client.subscribe = vi.fn((_topic, _options, callback) => callback());
    client.end = vi.fn((_force, _options, callback) => callback());
    const connectClient = vi.fn(() => client) as unknown as (endpoint: string, options: Record<string, unknown>) => any;
    const adapter = createMqtt5Adapter({ connectClient });

    const connecting = adapter.connect(config);
    client.emit('connect');
    await connecting;
    expect((await adapter.health()).connected).toBe(true);

    client.emit('close');
    expect(await adapter.health()).toMatchObject({ connected: false, detail: 'MQTT connection closed' });
    client.emit('connect');
    expect(client.subscribe).toHaveBeenCalledTimes(2);
    expect((await adapter.health()).connected).toBe(true);
    await adapter.disconnect();
  });

  it('fails the initial connection when the first subscription is rejected', async () => {
    const client = new EventEmitter() as EventEmitter & { subscribe: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    client.subscribe = vi.fn((_topic, _options, callback) => callback(new Error('subscription denied')));
    client.end = vi.fn((_force, _options, callback) => callback());
    const adapter = createMqtt5Adapter({ connectClient: vi.fn(() => client) as any });
    const connecting = adapter.connect(config);
    client.emit('connect');
    await expect(connecting).rejects.toThrow('subscription denied');
    expect(await adapter.health()).toMatchObject({ connected: false, detail: 'subscription denied' });
    await adapter.disconnect();
  });

  it('keeps known abnormal statuses and falls back unknown statuses to online', () => {
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-alpha/mqtt-line/device-001/telemetry', payload: JSON.stringify({ status: 'fault', metrics: {} }) }, config)[0]).toMatchObject({ status: 'fault' });
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-alpha/mqtt-line/device-001/telemetry', payload: JSON.stringify({ status: 'not-a-real-status', metrics: {} }) }, config)[0]).toMatchObject({ status: 'online' });
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-alpha/mqtt-line/device-001/telemetry', payload: 'not-json' }, config)).toEqual([]);
  });

  it('drops messages from another tenant/source or a mismatched device topic', () => {
    const payload = JSON.stringify({ deviceId: 'device-001', sequence: 1, metrics: { powerKw: 12 } });
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-beta/mqtt-line/device-001/telemetry', payload }, config)).toEqual([]);
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-alpha/other-line/device-001/telemetry', payload }, config)).toEqual([]);
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-alpha/mqtt-line/device-002/telemetry', payload }, config)).toEqual([]);
    expect(normalizeMqtt5Message({ topic: 'aether/tenant-alpha/mqtt-line/device-001/status', payload }, config)).toEqual([]);
  });

  it('accepts only the configured topic prefix when normalizing a source', () => {
    const events = normalizeMqtt5Message({
      topic: 'factory/tenant-alpha/mqtt-line/device-001/telemetry',
      payload: JSON.stringify({ sequence: 2, metrics: { powerKw: 13 } }),
    }, { ...config, topicPrefix: 'factory' });
    expect(events[0]).toMatchObject({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line', deviceId: 'device-001' });
  });

  it('runs the simulator-to-adapter MQTT 5 path through an embedded broker', async () => {
    const broker = await startMqtt5TestBroker();
    const received: unknown[] = [];
    const store = createRealtimeDeviceStore();
    const adapter = createMqtt5Adapter({ onEvent: (event) => { received.push(event); store.ingest(event); } });
    let simulator: mqtt.MqttClient | undefined;

    try {
      await adapter.connect({ ...config, endpoint: broker.endpoint });
      simulator = mqtt.connect(broker.endpoint, { protocolVersion: 5, reconnectPeriod: 0 });
      await new Promise<void>((resolve, reject) => {
        simulator?.once('error', reject);
        simulator?.once('connect', () => {
          simulator?.publish('aether/tenant-alpha/mqtt-line/device-001/telemetry', JSON.stringify({ deviceId: 'device-001', status: 'running', sequence: 1, metrics: { powerKw: 12.5 } }), { qos: 1 }, (error) => error ? reject(error) : resolve());
        });
      });
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 1000;
        const poll = () => received.length ? resolve() : Date.now() >= deadline ? reject(new Error('adapter did not receive simulator message')) : setTimeout(poll, 10);
        poll();
      });
      expect(received[0]).toMatchObject({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line', deviceId: 'device-001', protocol: 'mqtt-5' });
      expect(store.getCurrentState('tenant-alpha', 'mqtt-line')).toMatchObject([expect.objectContaining({ deviceId: 'device-001', sequence: 1 })]);
      expect(store.getHistory({ tenantId: 'tenant-alpha', sourceId: 'mqtt-line' })).toHaveLength(1);
    } finally {
      await adapter.disconnect();
      if (simulator) await new Promise<void>((resolve) => simulator.end(true, {}, () => resolve()));
      await broker.close();
    }
  });
});
