import mqtt from 'mqtt';

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const topicPrefix = process.env.MQTT_TOPIC_PREFIX || 'aether';
const tenantId = process.env.MQTT_TENANT_ID || 'tenant-demo';
const sourceId = process.env.MQTT_SOURCE_ID || 'mqtt-demo';
const deviceId = process.env.MQTT_DEVICE_ID || 'demo-line-001';
const count = Math.max(1, Number(process.env.MQTT_SIMULATOR_COUNT || 10));
const intervalMs = Math.max(100, Number(process.env.MQTT_SIMULATOR_INTERVAL_MS || 2000));
const topic = `${topicPrefix}/${tenantId}/${sourceId}/${deviceId}/telemetry`;

const client = mqtt.connect(brokerUrl, { protocolVersion: 5, reconnectPeriod: 0, clientId: `aether-simulator-${Date.now()}` });
client.once('error', (error) => { console.error(`[mqtt-simulator] ${error.message}`); process.exitCode = 1; });
client.once('connect', () => {
  console.log(`[mqtt-simulator] connected to ${brokerUrl}`);
  let sequence = 0;
  const publish = () => {
    sequence += 1;
    const payload = {
      eventId: `sim-${sequence}`,
      deviceId,
      status: sequence % 7 === 0 ? 'warning' : 'running',
      sequence,
      occurredAt: new Date().toISOString(),
      metrics: { powerKw: Number((12 + Math.sin(sequence / 2) * 2).toFixed(2)), temperatureC: Number((31 + Math.cos(sequence / 3)).toFixed(2)) },
    };
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) { console.error(`[mqtt-simulator] publish failed: ${error.message}`); client.end(); process.exitCode = 1; return; }
      console.log(`[mqtt-simulator] ${sequence}/${count} ${topic} sequence=${sequence}`);
      if (sequence >= count) { client.end(); return; }
      setTimeout(publish, intervalMs);
    });
  };
  publish();
});
