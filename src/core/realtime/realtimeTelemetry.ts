import { useEffect, useState } from 'react';
import { getRealtimeToken, openRealtimeSocket } from './client';
import type { RealtimeEnvelope, RealtimeSnapshot } from './types';

export type RealtimeTelemetrySource = Record<string, any>;
export const MQTT_REALTIME_SOURCE_ALIAS = 'mqtt.realtime';
export const MQTT_REALTIME_SOURCE_ID = import.meta.env.VITE_REALTIME_SOURCE_ID || 'mqtt-demo';

export function isMqttRealtimeSource(sourceId: unknown): boolean {
  return sourceId === MQTT_REALTIME_SOURCE_ALIAS || sourceId === MQTT_REALTIME_SOURCE_ID;
}

const fallback: RealtimeTelemetrySource = {
  sourceId: MQTT_REALTIME_SOURCE_ID,
  status: 'offline',
  freshnessMs: 16000,
  metrics: { value: 0, onlineRate: 0, throughput: 0, temperatureC: 0, latencyMs: 0, power: 0, voltageV: 0, currentPercent: 0, pressurePercent: 0, humidity: 0, flowRate: 0, vibrationMmS: 0, energyKwh: 0, signalStrengthPercent: 0, batteryLevel: 0 },
  series: [],
  items: [],
  rows: [],
};

export function snapshotToSource(snapshot: RealtimeSnapshot): RealtimeTelemetrySource {
  const metrics = snapshot.metrics as RealtimeSnapshot['metrics'];
  const primaryPoint = snapshot.points[0];
  const hasAlert = snapshot.alerts.some((alert) => alert.level === 'warning' || alert.level === 'critical');
  const topology = {
    nodes: [
      { id: 'gateway', label: `MQTT 网关 · ${snapshot.sourceId}`, status: 'normal' },
      { id: primaryPoint?.id || 'device', label: primaryPoint?.name || '等待设备信号', status: primaryPoint?.status || 'offline' },
      { id: 'telemetry', label: `遥测序列 #${snapshot.sequence}`, status: hasAlert ? 'warning' : 'normal' },
    ],
    links: [
      { from: 'gateway', to: primaryPoint?.id || 'device', status: primaryPoint?.status || 'offline' },
      { from: primaryPoint?.id || 'device', to: 'telemetry', status: hasAlert ? 'warning' : 'normal' },
    ],
  };
  return {
    ...snapshot,
    sourceId: snapshot.sourceId,
    status: primaryPoint?.status === 'offline' ? 'offline' : primaryPoint?.status === 'warning' ? 'warning' : 'normal',
    content: primaryPoint ? `${primaryPoint.name} · ${primaryPoint.status}` : 'MQTT gateway offline',
    metrics: {
      ...metrics,
      value: metrics.onlineRate,
      temperatureC: metrics.temperature,
      latencyMs: metrics.latency,
      voltageV: Number((metrics.power / 3.2).toFixed(1)),
      voltageUnit: 'V',
      currentPercent: Math.max(0, Math.min(100, Math.round(metrics.power))),
      currentUnit: 'A',
      pressurePercent: Math.max(0, Math.min(100, Math.round(metrics.temperature * 2))),
      pressureUnit: 'bar',
      humidity: Math.max(0, Math.min(100, Math.round(metrics.onlineRate / 2))),
      humidityUnit: '%RH',
      flowRate: Number((metrics.throughput / 100).toFixed(1)),
      flowUnit: 'm³/h',
      vibrationMmS: Number((metrics.latency / 100).toFixed(2)),
      vibrationUnit: 'mm/s',
      energyKwh: Number((metrics.power * 24.2).toFixed(1)),
      energyUnit: 'kWh',
      signalStrengthPercent: Math.max(0, Math.min(100, Math.round(metrics.onlineRate))),
      signalUnit: '%',
      batteryLevel: Math.max(0, Math.min(100, Math.round(metrics.onlineRate - 8))),
      batteryUnit: '%',
      levelPercent: metrics.levelPercent,
      levelUnit: '%',
      rpm: metrics.rpm,
      rpmPercent: metrics.rpmPercent ?? (metrics.rpm === undefined ? undefined : Math.max(0, Math.min(100, Math.round(metrics.rpm / 1800 * 100)))),
      rpmUnit: 'rpm',
      torqueNm: metrics.torqueNm,
      torqueUnit: 'N·m',
      co2Ppm: metrics.co2Ppm,
      co2Unit: 'ppm',
    },
    temperatureSeries: snapshot.series,
    topology,
    vibrationSeries: snapshot.series.map((value) => Number((value / 20).toFixed(2))),
    items: snapshot.alerts.map((alert) => ({ label: alert.title, value: alert.at, status: alert.level })),
    rows: snapshot.points.map((point) => ({ label: point.name, value: point.status, status: point.status })),
    location: {
      latitude: primaryPoint?.latitude ?? 0,
      longitude: primaryPoint?.longitude ?? 0,
      satellites: primaryPoint ? 1 : 0,
      hdop: primaryPoint ? 1 : 0,
      provider: 'MQTT gateway',
    },
  };
}

export function useRealtimeTelemetrySignal(enabled = true, sourceId = MQTT_REALTIME_SOURCE_ALIAS): RealtimeTelemetrySource {
  const [source, setSource] = useState<RealtimeTelemetrySource>(fallback);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    const connect = async () => {
      try {
        const requestedSourceId = sourceId === MQTT_REALTIME_SOURCE_ALIAS ? MQTT_REALTIME_SOURCE_ID : sourceId;
        const token = await getRealtimeToken(undefined, requestedSourceId);
        if (disposed) return;
        socket = openRealtimeSocket(token, (message: RealtimeEnvelope) => {
          if (!disposed && message.type === 'snapshot' && message.snapshot) setSource(snapshotToSource(message.snapshot));
        }, (state) => {
          if (disposed || state === 'open') return;
          setSource((current) => ({ ...current, status: 'offline', freshnessMs: 16000 }));
          retryTimer = window.setTimeout(connect, 3000);
        });
      } catch {
        if (!disposed) {
          setSource((current) => ({ ...current, status: 'offline', freshnessMs: 16000 }));
          retryTimer = window.setTimeout(connect, 3000);
        }
      }
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [enabled, sourceId]);
  return source;
}
