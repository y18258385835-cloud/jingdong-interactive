const clone = (value) => JSON.parse(JSON.stringify(value));

export function createRealtimeMetrics() {
  const counters = new Map();
  const gauges = new Map();
  const histograms = new Map();
  const startedAt = Date.now();

  const key = (name, labels = {}) => `${name}|${Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => `${label}=${value}`).join(',')}`;
  const record = (name, labels = {}) => ({ name, labels: clone(labels) });
  function inc(name, labels = {}, value = 1) { const metricKey = key(name, labels); counters.set(metricKey, { ...record(name, labels), value: (counters.get(metricKey)?.value || 0) + value }); }
  function set(name, value, labels = {}) { gauges.set(key(name, labels), { ...record(name, labels), value: Number(value) || 0 }); }
  function observe(name, value, labels = {}) {
    const metricKey = key(name, labels);
    const metric = histograms.get(metricKey) || { ...record(name, labels), count: 0, sum: 0, buckets: [0, 0, 0, 0, 0, 0] };
    const number = Math.max(0, Number(value) || 0);
    const limits = [1, 5, 10, 50, 100, Infinity];
    metric.count += 1;
    metric.sum += number;
    metric.buckets[limits.findIndex((limit) => number <= limit)] += 1;
    histograms.set(metricKey, metric);
  }
  function snapshot() { return { uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), counters: [...counters.values()].map(clone), gauges: [...gauges.values()].map(clone), histograms: [...histograms.values()].map(clone) }; }
  function prometheus() {
    const lines = ['# HELP aether_realtime_uptime_seconds Realtime service uptime in seconds', '# TYPE aether_realtime_uptime_seconds gauge', `aether_realtime_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`];
    const labelsText = (labels) => Object.entries(labels).map(([name, value]) => `${name}="${String(value).replaceAll('"', '\\"')}"`).join(',');
    for (const metric of counters.values()) lines.push(`${metric.name}{${labelsText(metric.labels)}} ${metric.value}`);
    for (const metric of gauges.values()) lines.push(`${metric.name}{${labelsText(metric.labels)}} ${metric.value}`);
    for (const metric of histograms.values()) {
      const limits = [1, 5, 10, 50, 100, '+Inf'];
      let cumulative = 0;
      limits.forEach((limit, index) => { cumulative += metric.buckets[index]; lines.push(`${metric.name}_bucket{${labelsText({ ...metric.labels, le: limit })}} ${cumulative}`); });
      lines.push(`${metric.name}_sum{${labelsText(metric.labels)}} ${metric.sum}`, `${metric.name}_count{${labelsText(metric.labels)}} ${metric.count}`);
    }
    return `${lines.join('\n')}\n`;
  }
  return { inc, set, observe, snapshot, prometheus };
}

export function createRealtimeLogger({ write = console.log, error = console.error } = {}) {
  const emit = (level, message, fields, output) => output(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'aether-realtime', message, ...fields }));
  return {
    info: (message, fields = {}) => emit('info', message, fields, write),
    warn: (message, fields = {}) => emit('warn', message, fields, write),
    error: (message, fields = {}) => emit('error', message, fields, error),
  };
}

