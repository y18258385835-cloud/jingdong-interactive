export type RealtimeConnectionState = 'connecting' | 'live' | 'stale' | 'offline' | 'permission-denied' | 'empty' | 'error';

export interface RealtimeSnapshot {
  tenantId: string;
  sourceId: string;
  sourceType: 'rest' | 'rest-cache' | 'mock' | 'mqtt';
  source?: string;
  dataLatencyMs?: number;
  sequence: number;
  capturedAt: string;
  freshnessMs: number;
  metrics: {
    onlineRate: number;
    throughput: number;
    temperature: number;
    latency: number;
    power: number;
    levelPercent?: number;
    rpm?: number;
    rpmPercent?: number;
    torqueNm?: number;
    co2Ppm?: number;
  };
  series: number[];
  alerts: Array<{ id: string; level: 'info' | 'warning' | 'critical'; title: string; detail: string; at: string }>;
  points: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    status: 'online' | 'warning' | 'offline';
    latitude?: number;
    longitude?: number;
  }>;
}

export interface RealtimeEnvelope { type: 'snapshot' | 'hello' | 'error'; snapshot?: RealtimeSnapshot; message?: string; retryAfterMs?: number }

export interface RealtimeVisibilityMessage {
  type: 'visibility';
  hidden: boolean;
}
