# P3 MQTT storage delivery

This delivery connects the MQTT 5 adapter to the realtime service's current-state and history boundary.

## Enable MQTT input

Set these server environment variables before starting `node server/index.js`:

```powershell
$env:REALTIME_MQTT_URL = 'mqtt://127.0.0.1:1883'
$env:REALTIME_MQTT_TENANT_ID = 'tenant-demo'
$env:REALTIME_MQTT_SOURCE_ID = 'mqtt-demo'
$env:REALTIME_MQTT_TOPIC_PREFIX = 'aether'
node server/index.js
```

Optional credentials are `REALTIME_MQTT_USERNAME`, `REALTIME_MQTT_PASSWORD`, and `REALTIME_MQTT_SECRET_REF`.

The service subscribes to:

```text
{topicPrefix}/{tenantId}/{sourceId}/+/telemetry
```

## Storage behavior

- The newest accepted event for each `tenantId + sourceId + deviceId` is the current state.
- Accepted events are retained in SQLite when `REALTIME_DEVICE_DB_PATH` is configured. The default limit is 1,000 events per source and can be changed with `REALTIME_DEVICE_HISTORY_LIMIT`. Without a path, tests and local demos use memory only.
- The same event ID is ignored as a duplicate.
- An event with a sequence number less than or equal to the current device sequence is ignored as stale.
- `fault` becomes a critical alert, while `warning` and `offline` become warning alerts in the MQTT snapshot.

Alert rules and lifecycle endpoints are available at:

```text
GET  /api/v1/realtime/alert-rules
GET  /api/v1/realtime/alerts?sourceId=mqtt-demo&status=open
GET  /api/v1/realtime/alerts/{alertId}/audit
POST /api/v1/realtime/alerts/{alertId}/acknowledge
POST /api/v1/realtime/alerts/{alertId}/close
```

The built-in rules are versioned and cover device fault, warning, offline, and high temperature. Matching events are deduplicated by rule version and tenant/source/device fingerprint. Acknowledged and closed alerts remain queryable; only open and acknowledged alerts are projected into the live snapshot.

Role permissions are `viewer` (read only), `operator` (acknowledge and close alerts), and `admin` (all operator actions plus rule publishing). Production roles must come from the trusted identity JWT; publishing rules and alert transitions are audited.

## Read APIs

Use the existing bearer token, scoped to the same tenant and source:

```text
GET /api/v1/realtime/snapshot?sourceId=mqtt-demo
GET /api/v1/realtime/devices?sourceId=mqtt-demo
GET /api/v1/realtime/history?sourceId=mqtt-demo&deviceId=demo-line-001&from=2026-09-12T09:00:00.000Z&to=2026-09-12T10:00:00.000Z&limit=100
```

## Verification

```powershell
npm test
npm run lint
npm run build
```

The automated chain uses a local MQTT 5 protocol fixture and the real `mqtt` client. SQLite reopen tests prove local durable persistence, but they do not prove external Mosquitto/EMQX deployment, physical device connectivity, or multi-instance database operation. The storage factory remains isolated so it can be replaced by TimescaleDB, InfluxDB, or the selected platform storage if deployment scale requires it.
