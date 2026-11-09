# P3.5 Observability and recovery

## Metrics and logs

- `GET /metrics` returns Prometheus text for event throughput, rejects, alert operations, backups, and ingest latency.
- `GET /api/v1/realtime/metrics` returns the same process metrics as JSON for an authenticated client.
- Service operational logs are JSON lines with timestamp, level, service, actor, tenant, source, and error fields. Secrets and credentials are not logged.

## Load test

```powershell
$env:REALTIME_LOAD_EVENTS = '10000'
$env:REALTIME_LOAD_DEVICES = '100'
npm run realtime:load-test
```

The command reports accepted events, duplicate count, events/second, p95 ingest time, current device count, and retained history count. Its result is a local baseline, not a production capacity guarantee.

## Backup and recovery

Configure `REALTIME_DEVICE_DB_PATH` and run:

```powershell
$env:REALTIME_DEVICE_DB_PATH = './data/realtime/device-events.sqlite'
npm run realtime:backup -- './data/realtime/backups/realtime.sqlite'
```

Recovery is performed with the service stopped: preserve the damaged database, place the verified backup at the configured database path, start the service, and query `/api/v1/realtime/devices`, `/api/v1/realtime/history`, and `/api/v1/realtime/alerts`. The automated test also reopens a backup and verifies stored state and duplicate protection.

P3.5 does not claim a production RTO/RPO or multi-node failover target. Those require deployment-specific disk, backup scheduler, network, and database measurements.
