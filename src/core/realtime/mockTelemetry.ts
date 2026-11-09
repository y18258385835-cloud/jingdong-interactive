import { useEffect, useState } from 'react';

export interface MockTelemetrySignal {
  eventId: string;
  tenantId: string;
  sourceId: string;
  deviceId: string;
  sequence: number;
  occurredAt: string;
  status: 'running' | 'warning' | 'fault' | 'offline';
  freshnessMs: number;
  content: string;
  metrics: {
    value: number;
    onlineRate: number;
    throughput: number;
    temperature: number;
    temperatureC: number;
    latency: number;
    latencyMs: number;
    power: number;
    powerKw: number;
    temperatureUnit: string;
    voltageV: number;
    voltageUnit: string;
    currentPercent: number;
    currentA: number;
    currentUnit: string;
    pressurePercent: number;
    pressureBar: number;
    pressureUnit: string;
    humidity: number;
    humidityUnit: string;
    flowRate: number;
    flowUnit: string;
    vibrationMmS: number;
    vibrationUnit: string;
    energyKwh: number;
    energyUnit: string;
    signalStrengthPercent: number;
    signalUnit: string;
    batteryLevel: number;
    batteryUnit: string;
    levelPercent: number;
    levelUnit: string;
    rpm: number;
    rpmPercent: number;
    rpmUnit: string;
    torqueNm: number;
    torqueUnit: string;
    co2Ppm: number;
    co2Unit: string;
  };
  series: number[];
  vibrationSeries: number[];
  temperatureSeries: number[];
  items: Array<{ label: string; value: string; status: string }>;
  rows: Array<{ label: string; value: string | number; status: string }>;
  location: { latitude: number; longitude: number; satellites: number; hdop: number; provider: string };
  topology: { nodes: Array<{ id: string; label: string; status: string }>; links: Array<{ from: string; to: string; status: string }> };
}

const listeners = new Set<(signal: MockTelemetrySignal) => void>();
let timer: number | null = null;
let signal = createSignal(0);

function createSignal(sequence: number): MockTelemetrySignal {
  const wave = Math.sin(sequence / 2.4);
  const status = sequence > 0 && sequence % 18 === 0 ? 'offline'
    : sequence > 0 && sequence % 9 === 0 ? 'fault'
      : sequence > 0 && sequence % 6 === 0 ? 'warning'
        : 'running';
  const onlineRate = Number(Math.max(88, 98.6 + wave * 0.8 - (status === 'fault' ? 4.2 : status === 'offline' ? 8 : status === 'warning' ? 1.4 : 0)).toFixed(1));
  const throughput = Math.round(12840 + wave * 620 + (sequence % 5) * 43);
  const temperature = Number((31.8 + Math.cos(sequence / 3) * 1.4 + (status === 'fault' ? 9 : 0)).toFixed(1));
  const latency = Math.max(120, Math.round(182 - wave * 18 + (status === 'warning' ? 65 : status === 'fault' ? 180 : status === 'offline' ? 420 : 0)));
  const power = Math.max(0, Math.min(100, Math.round(76 + wave * 5 - (status === 'offline' ? 35 : 0))));
  const voltage = Number((24.2 + Math.sin(sequence / 3.1) * 0.45 - (status === 'fault' ? 1.8 : 0)).toFixed(1));
  const current = Number((42 + wave * 8 + (status === 'warning' ? 10 : 0) + (status === 'fault' ? 18 : 0)).toFixed(1));
  const pressure = Number((6.2 + Math.cos(sequence / 2.7) * 0.35 - (status === 'warning' ? 0.9 : 0) - (status === 'fault' ? 1.5 : 0)).toFixed(2));
  const humidity = Number((54 + Math.sin(sequence / 4) * 5 + (status === 'warning' ? 7 : 0)).toFixed(1));
  const flowRate = Number((128.4 + wave * 12 - (status === 'offline' ? 82 : 0)).toFixed(1));
  const vibration = Number((2.6 + Math.abs(Math.sin(sequence / 2)) * 1.8 + (status === 'fault' ? 3.8 : 0)).toFixed(2));
  const energyKwh = Number((1842.6 + sequence * 0.18).toFixed(1));
  const signalStrengthPercent = Math.max(18, Math.min(100, Math.round(78 + wave * 8 - (status === 'offline' ? 48 : status === 'warning' ? 15 : 0))));
  const batteryLevel = Math.max(12, Math.round(86 - sequence * 0.03 - (status === 'offline' ? 2 : 0)));
  const levelPercent = Math.max(12, Math.min(100, Math.round(68 + Math.sin(sequence / 3.8) * 16)));
  const rpm = Math.max(0, Math.round(1460 + wave * 90 - (status === 'fault' ? 320 : status === 'offline' ? 1460 : 0)));
  const rpmPercent = Math.max(0, Math.min(100, Math.round(rpm / 1800 * 100)));
  const torqueNm = Number((42 + Math.abs(wave) * 9 + (status === 'warning' ? 12 : 0)).toFixed(1));
  const co2Ppm = Math.round(620 + Math.sin(sequence / 3.5) * 80 + (status === 'warning' ? 240 : 0));
  const pressurePercent = Math.max(0, Math.min(100, Math.round(pressure / 10 * 100)));
  const currentPercent = Math.max(0, Math.min(100, Math.round(current / 80 * 100)));
  const statusLabel = status === 'running' ? '在线' : status === 'warning' ? '预警' : status === 'fault' ? '故障' : '离线';
  const occurredAt = new Date().toISOString();
  const items = [{ label: status === 'running' ? '设备运行稳定' : `demo-line-001 ${statusLabel}`, value: `${latency} ms`, status: statusLabel }];
  if (status !== 'running') items.push({ label: status === 'offline' ? '等待设备重新上线' : '温度或延迟超过阈值', value: occurredAt.slice(11, 19), status: status === 'fault' ? '严重' : statusLabel });
  return {
    eventId: `mock-event-${sequence}`,
    tenantId: 'tenant-demo',
    sourceId: 'mock.telemetry',
    deviceId: 'demo-line-001',
    sequence,
    occurredAt,
    status,
    freshnessMs: status === 'offline' ? 16000 : status === 'warning' ? 6200 : 700,
    content: `${statusLabel} · 延迟 ${latency} ms`,
    metrics: { value: onlineRate, onlineRate, throughput, temperature, temperatureC: temperature, latency, latencyMs: latency, power, powerKw: Number((power / 6.2).toFixed(2)), temperatureUnit: '°C', voltageV: voltage, voltageUnit: 'V', currentPercent, currentA: current, currentUnit: 'A', pressurePercent, pressureBar: pressure, pressureUnit: 'bar', humidity, humidityUnit: '%RH', flowRate, flowUnit: 'm³/h', vibrationMmS: vibration, vibrationUnit: 'mm/s', energyKwh, energyUnit: 'kWh', signalStrengthPercent, signalUnit: '%', batteryLevel, batteryUnit: '%', levelPercent, levelUnit: '%', rpm, rpmPercent, rpmUnit: 'rpm', torqueNm, torqueUnit: 'N·m', co2Ppm, co2Unit: 'ppm' },
    series: Array.from({ length: 12 }, (_, index) => Math.max(0, Math.round(throughput / 240 + Math.sin((sequence + index) / 2) * 10))),
    vibrationSeries: Array.from({ length: 12 }, (_, index) => Number(Math.max(0.5, vibration + Math.sin((sequence + index) / 2.2) * 0.7).toFixed(2))),
    temperatureSeries: Array.from({ length: 12 }, (_, index) => Number((temperature + Math.sin((sequence + index) / 2.5) * 1.3).toFixed(1))),
    items,
    rows: [
      { label: 'demo-line-001', value: `${onlineRate}%`, status: statusLabel },
      { label: '吞吐', value: `${throughput} 条 / min`, status: '正常' },
      { label: '温度', value: `${temperature} °C`, status: status === 'fault' ? '严重' : '正常' },
    ],
    location: { latitude: 31.2304 + Math.sin(sequence / 8) * 0.002, longitude: 121.4737 + Math.cos(sequence / 8) * 0.002, satellites: status === 'offline' ? 0 : 18, hdop: status === 'warning' ? 2.4 : 0.8, provider: 'GPS + 北斗' },
    topology: { nodes: [{ id: 'gateway', label: 'MQTT 网关', status: status === 'offline' ? 'warning' : 'normal' }, { id: 'device', label: 'demo-line-001', status }, { id: 'sensor', label: '温压一体探头', status: status === 'fault' ? 'fault' : 'normal' }], links: [{ from: 'gateway', to: 'device', status: status === 'offline' ? 'fault' : 'normal' }, { from: 'device', to: 'sensor', status: status === 'fault' ? 'warning' : 'normal' }] },
  };
}

function tick() {
  signal = createSignal(signal.sequence + 1);
  listeners.forEach((listener) => listener(signal));
}

function ensureTimer() {
  if (timer !== null || typeof window === 'undefined') return;
  timer = window.setInterval(tick, 1800);
}

function stopTimer() {
  if (timer === null || listeners.size > 0 || typeof window === 'undefined') return;
  window.clearInterval(timer);
  timer = null;
}

export function getMockTelemetrySignal(): MockTelemetrySignal {
  return signal;
}

export function subscribeMockTelemetry(listener: (signal: MockTelemetrySignal) => void): () => void {
  listeners.add(listener);
  listener(signal);
  ensureTimer();
  return () => {
    listeners.delete(listener);
    stopTimer();
  };
}

export function useMockTelemetrySignal(enabled = true): MockTelemetrySignal {
  const [current, setCurrent] = useState(getMockTelemetrySignal);
  useEffect(() => enabled ? subscribeMockTelemetry(setCurrent) : undefined, [enabled]);
  return current;
}
