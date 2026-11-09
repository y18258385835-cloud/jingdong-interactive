import { createRealtimeDeviceStore } from '../server/realtime-device-store.js';

const total = Math.max(1, Number(process.env.REALTIME_LOAD_EVENTS || 10000));
const deviceCount = Math.max(1, Number(process.env.REALTIME_LOAD_DEVICES || 100));
const duplicateEvery = Math.max(0, Number(process.env.REALTIME_LOAD_DUPLICATE_EVERY || 1000));
const store = createRealtimeDeviceStore({ historyLimit: Math.max(total, 1000) });
const sequenceByDevice = new Map();
const durations = [];
let accepted = 0;
let duplicates = 0;
const startedAt = performance.now();

for (let index = 0; index < total; index += 1) {
  const deviceId = `load-device-${index % deviceCount}`;
  const sequence = (sequenceByDevice.get(deviceId) || 0) + 1;
  sequenceByDevice.set(deviceId, sequence);
  const event = { eventId: `load-event-${index}`, tenantId: 'tenant-load', sourceId: 'load-test', deviceId, protocol: 'mqtt-5', sequence, occurredAt: new Date().toISOString(), status: 'running', metrics: { throughput: index % 100, temperatureC: 30, powerKw: 12 } };
  const eventStartedAt = performance.now();
  const result = store.ingest(event);
  durations.push(performance.now() - eventStartedAt);
  if (result.accepted) accepted += 1;
  if (duplicateEvery && (index + 1) % duplicateEvery === 0) {
    const duplicate = store.ingest(event);
    if (!duplicate.accepted && duplicate.reason === 'duplicate') duplicates += 1;
  }
}

durations.sort((a, b) => a - b);
const elapsedMs = performance.now() - startedAt;
console.log(JSON.stringify({ total, deviceCount, accepted, duplicates, elapsedMs: Number(elapsedMs.toFixed(2)), eventsPerSecond: Number((accepted / (elapsedMs / 1000)).toFixed(2)), p95IngestMs: Number(durations[Math.floor(durations.length * 0.95)].toFixed(4)), currentDevices: store.getCurrentState('tenant-load', 'load-test').length, historyEvents: store.getHistory({ tenantId: 'tenant-load', sourceId: 'load-test', limit: total }).length }, null, 2));

