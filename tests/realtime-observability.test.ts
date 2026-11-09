import { describe, expect, it, vi } from 'vitest';
import { createRealtimeLogger, createRealtimeMetrics } from '../server/realtime-observability.js';

describe('realtime observability', () => {
  it('records counters, gauges, histograms, and Prometheus output', () => {
    const metrics = createRealtimeMetrics();
    metrics.inc('events_total', { source: 'mqtt' }, 2);
    metrics.set('connected', 1);
    metrics.observe('event_seconds', 0.5, { source: 'mqtt' });
    metrics.observe('event_seconds', 7, { source: 'mqtt' });
    expect(metrics.snapshot()).toMatchObject({ counters: [{ name: 'events_total', value: 2 }], gauges: [{ name: 'connected', value: 1 }], histograms: [{ name: 'event_seconds', count: 2, sum: 7.5 }] });
    expect(metrics.prometheus()).toContain('events_total{source="mqtt"} 2');
    expect(metrics.prometheus()).toContain('event_seconds_count{source="mqtt"} 2');
  });

  it('writes structured log lines with stable fields', () => {
    const write = vi.fn();
    const error = vi.fn();
    const logger = createRealtimeLogger({ write, error });
    logger.info('connected', { sourceId: 'mqtt-line' });
    logger.warn('rejected', { reason: 'duplicate' });
    logger.error('failed', { code: 'E_TEST' });
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({ level: 'info', service: 'aether-realtime', message: 'connected', sourceId: 'mqtt-line' });
    expect(JSON.parse(write.mock.calls[1][0])).toMatchObject({ level: 'warn', reason: 'duplicate' });
    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ level: 'error', code: 'E_TEST' });
  });
});
