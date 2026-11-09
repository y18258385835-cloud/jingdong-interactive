const SENSITIVE_SUFFIXES = [
  'token', 'accesstoken', 'refreshtoken', 'apikey', 'password', 'passwd',
  'authorization', 'bearer', 'credential', 'privatekey', 'clientsecret',
  'connectionstring', 'databaseurl', 'mqttpassword', 'brokerpassword',
];
const SENSITIVE_FIELD = /^(?:endpoint|endpoints|broker|brokerUrl|brokerHost|databaseHost|databaseUrl|connectionString|authorization|headers)$/i;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  return SENSITIVE_SUFFIXES.some((suffix) => normalized === suffix || normalized.endsWith(suffix));
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function isInternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

/** Removes credentials and internal connection details before project data is serialized. */
export function sanitizeExportData<T>(value: T): T {
  const visit = (current: unknown, key = ''): unknown => {
    // Review comments are an editor-only collaboration artifact. Never ship
    // them inside a standalone/ZIP export payload.
    if (key === 'comments') return undefined;
    if (isSensitiveKey(key) || SENSITIVE_FIELD.test(key)) return undefined;
    if (typeof current === 'string' && isInternalUrl(current)) return undefined;
    if (Array.isArray(current)) return current.map((item) => visit(item)).filter((item) => item !== undefined);
    if (!current || typeof current !== 'object') return current;

    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(current)) {
      const sanitized = visit(childValue, childKey);
      if (sanitized !== undefined) result[childKey] = sanitized;
    }
    return result;
  };

  return visit(value) as T;
}
