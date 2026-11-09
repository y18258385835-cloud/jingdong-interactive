import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRealtimeDeviceStore } from '../server/realtime-device-store.js';

const source = process.env.REALTIME_DEVICE_DB_PATH;
const destination = process.argv[2] || process.env.REALTIME_BACKUP_PATH;
if (!source || !destination) throw new Error('Set REALTIME_DEVICE_DB_PATH and provide a backup path');
mkdirSync(dirname(destination), { recursive: true });
const store = createRealtimeDeviceStore({ dbPath: source });
try {
  console.log(JSON.stringify(store.backupTo(destination), null, 2));
} finally {
  store.close();
}

