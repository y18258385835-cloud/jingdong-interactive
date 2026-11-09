import type { RealtimeEnvelope, RealtimeSnapshot, RealtimeVisibilityMessage } from './types';

const API_ROOT = import.meta.env.VITE_REALTIME_API ||
  // 生产/桌面构建走同源（由本机服务或反向代理转发），开发环境仍用 8080。
  (import.meta.env.PROD && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080');
const IDENTITY_TOKEN_KEY = 'aether_realtime_identity_token';
const DEFAULT_SOURCE_ID = import.meta.env.VITE_REALTIME_SOURCE_ID || 'demo-rest';

function identityHeaders(): Record<string, string> {
  const token = localStorage.getItem(IDENTITY_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getRealtimeToken(tenantId?: string, sourceId = DEFAULT_SOURCE_ID): Promise<string> {
  const effectiveTenantId = tenantId || (import.meta.env.DEV ? 'tenant-demo' : undefined);
  const response = await fetch(`${API_ROOT}/api/v1/realtime/token`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...identityHeaders() }, body: JSON.stringify({ ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}), sourceId }) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '无法获取实时发布令牌');
  return (await response.json() as { token: string }).token;
}

export async function getRealtimeSnapshot(token: string, sourceId = DEFAULT_SOURCE_ID): Promise<RealtimeSnapshot> {
  const response = await fetch(`${API_ROOT}/api/v1/realtime/snapshot?sourceId=${encodeURIComponent(sourceId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '快照读取失败');
  return response.json();
}

export function openRealtimeSocket(token: string, onMessage: (message: RealtimeEnvelope) => void, onState: (state: 'open' | 'close' | 'error') => void) {
  const socket = new WebSocket(`${API_ROOT.replace(/^http/, 'ws')}/ws/realtime?token=${encodeURIComponent(token)}`);
  socket.addEventListener('open', () => onState('open')); socket.addEventListener('close', () => onState('close')); socket.addEventListener('error', () => onState('error'));
  socket.addEventListener('message', (event) => { try { onMessage(JSON.parse(event.data) as RealtimeEnvelope); } catch { /* malformed frame */ } });
  return socket;
}

export function setRealtimeVisibility(socket: WebSocket | null, hidden: boolean) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const message: RealtimeVisibilityMessage = { type: 'visibility', hidden };
  socket.send(JSON.stringify(message));
}

export function setRealtimeIdentityToken(token: string | null): void {
  if (token) localStorage.setItem(IDENTITY_TOKEN_KEY, token);
  else localStorage.removeItem(IDENTITY_TOKEN_KEY);
}
