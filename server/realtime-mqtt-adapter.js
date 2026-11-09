import mqtt from 'mqtt';

const STATUS_VALUES = new Set(['online', 'running', 'idle', 'warning', 'fault', 'offline']);
const numberOrUndefined = (value) => Number.isFinite(Number(value)) ? Number(value) : undefined;
/** @typedef {{ on: Function, once: Function, removeListener?: Function, subscribe: Function, end: Function }} MqttClientLike */
/** @typedef {(endpoint: string, options: Record<string, unknown>) => MqttClientLike} ConnectClient */
/** @type {ConnectClient} */
const defaultConnectClient = (endpoint, options) => mqtt.connect(endpoint, options);

function parsePayload(input) {
  if (input && typeof input === 'object' && 'payload' in input) {
    const raw = input.payload instanceof Uint8Array ? Buffer.from(input.payload).toString('utf8') : input.payload;
    if (typeof raw === 'object' && raw !== null) return raw;
    try { return JSON.parse(String(raw)); } catch { return null; }
  }
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return null; }
  }
  if (input && typeof input === 'object') return input;
  return null;
}

function topicDeviceId(topic) {
  const parts = String(topic || '').split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

function topicSourceDeviceId(topic, config) {
  if (typeof topic !== 'string' || !config || typeof config.tenantId !== 'string' || typeof config.sourceId !== 'string') return '';
  const prefix = String(config.topicPrefix || 'aether').replace(/^\/+|\/+$/g, '');
  const expectedPrefix = `${prefix}/${config.tenantId}/${config.sourceId}/`;
  if (!topic.startsWith(expectedPrefix)) return '';
  const remainder = topic.slice(expectedPrefix.length).split('/').filter(Boolean);
  return remainder.length === 2 && remainder[1] === 'telemetry' ? remainder[0] : '';
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  return STATUS_VALUES.has(status) ? status : 'online';
}

export function normalizeMqtt5Message(input, config) {
  const payload = parsePayload(input);
  if (!payload || typeof payload !== 'object') return [];
  const topicDevice = topicSourceDeviceId(input?.topic, config);
  if (input?.topic && !topicDevice) return [];
  const payloadDevice = typeof payload.deviceId === 'string' && payload.deviceId.trim() ? payload.deviceId.trim() : '';
  if (topicDevice && payloadDevice && topicDevice !== payloadDevice) return [];
  const deviceId = payloadDevice || topicDevice || topicDeviceId(input?.topic);
  if (!deviceId) return [];
  const rawMetrics = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : payload;
  const metrics = {};
  for (const [key, value] of Object.entries(rawMetrics)) {
    const number = numberOrUndefined(value);
    if (number !== undefined && !['sequence', 'timestamp', 'occurredAt'].includes(key)) metrics[key] = number;
  }
  const occurredAt = typeof payload.occurredAt === 'string' ? payload.occurredAt : typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString();
  const sequence = numberOrUndefined(payload.sequence);
  const eventId = typeof payload.eventId === 'string' && payload.eventId.trim() ? payload.eventId.trim() : `${config.sourceId}:${deviceId}:${sequence ?? occurredAt}`;
  return [{
    eventId,
    tenantId: config.tenantId,
    sourceId: config.sourceId,
    deviceId,
    protocol: 'mqtt-5',
    ...(sequence === undefined ? {} : { sequence }),
    occurredAt,
    status: normalizeStatus(payload.status),
    metrics,
    ...(payload.location && typeof payload.location === 'object' ? {
      location: {
        ...(typeof payload.location.siteId === 'string' ? { siteId: payload.location.siteId } : {}),
        ...(numberOrUndefined(payload.location.latitude) === undefined ? {} : { latitude: numberOrUndefined(payload.location.latitude) }),
        ...(numberOrUndefined(payload.location.longitude) === undefined ? {} : { longitude: numberOrUndefined(payload.location.longitude) }),
      },
    } : {}),
    ...(typeof payload.type === 'string' ? { rawType: payload.type } : {}),
  }];
}

/** @param {{ connectClient?: ConnectClient, onEvent?: (event: object) => void, credentials?: Record<string, unknown> }} options */
export function createMqtt5Adapter({ connectClient = defaultConnectClient, onEvent = () => {}, credentials = {} } = {}) {
  let client = null;
  let config = null;
  let connected = false;
  let lastMessageAt;
  let detail;

  return {
    protocol: 'mqtt-5',
    async connect(nextConfig) {
      if (nextConfig.protocol !== 'mqtt-5') throw new Error('MQTT adapter requires protocol mqtt-5');
      if (!/^mqtts?:\/\//i.test(nextConfig.endpoint)) throw new Error('MQTT endpoint must use mqtt:// or mqtts://');
      config = nextConfig;
      client = connectClient(nextConfig.endpoint, {
        protocolVersion: 5,
        reconnectPeriod: 1000,
        ...credentials,
      });
      client.on('message', (messageTopic, payload) => {
        const events = normalizeMqtt5Message({ topic: messageTopic, payload }, config);
        if (events.length) {
          lastMessageAt = new Date().toISOString();
          for (const event of events) onEvent(event);
        }
      });
      const topic = `${nextConfig.topicPrefix || 'aether'}/${nextConfig.tenantId}/${nextConfig.sourceId}/+/telemetry`;
      let initialSettled = false;
      let resolveInitial;
      let rejectInitial;
      const initialConnection = new Promise((resolve, reject) => { resolveInitial = resolve; rejectInitial = reject; });
      const subscribe = () => client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          detail = error.message || 'MQTT subscription failed';
          connected = false;
          if (!initialSettled) { initialSettled = true; rejectInitial(error); }
          return;
        }
        connected = true;
        detail = undefined;
        if (!initialSettled) { initialSettled = true; resolveInitial(); }
      });
      const onConnect = () => subscribe();
      const onClose = () => { connected = false; detail = 'MQTT connection closed'; };
      const onOffline = () => { connected = false; detail = 'MQTT connection offline'; };
      client.on('connect', onConnect);
      client.on('close', onClose);
      client.on('offline', onOffline);
      const fail = (error) => {
        detail = error?.message || 'MQTT connection failed';
        if (!initialSettled) { initialSettled = true; rejectInitial(error); }
      };
      client.once('error', fail);
      await initialConnection;
      client.removeListener?.('error', fail);
    },
    async disconnect() {
      if (!client) return;
      await new Promise((resolve) => client.end(false, {}, resolve));
      client = null;
      connected = false;
    },
    normalize(input, nextConfig) { return normalizeMqtt5Message(input, nextConfig); },
    async health() { return { connected, ...(lastMessageAt ? { lastMessageAt } : {}), ...(detail ? { detail } : {}) }; },
  };
}
