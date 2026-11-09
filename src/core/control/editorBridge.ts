import { useEffect, useRef } from 'react';

/**
 * 本地编辑器控制桥（浏览器侧）。
 *
 * 与 `server/control-bridge.js` 配合：通过 SSE 接收 MCP/CLI 下发的命令，
 * 周期性上报当前工程快照。控制桥不可用时静默失败，不影响编辑器本身。
 */
export interface EditorControlCommand {
  id?: string;
  type: string;
  sceneId?: string;
  layerId?: string;
  elementId?: string;
  text?: string;
  format?: 'zip' | 'single-html' | 'json';
  saveToBridge?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fontSize?: number;
}

export interface EditorControlLayer {
  id: string;
  type: string;
  name: string;
  text?: string;
}

export interface EditorControlSnapshot {
  title?: string;
  activeSceneId?: string;
  scenes: Array<{ id: string; alias: string; layers: EditorControlLayer[] }>;
}

let activeToken: string | null = null;

/** 供导出落盘等场景复用当前控制桥令牌。 */
export function getControlToken(): string | null {
  return activeToken;
}

interface EditorControlBridgeOptions {
  enabled?: boolean;
  intervalMs?: number;
  buildSnapshot: () => EditorControlSnapshot;
  onCommand: (command: EditorControlCommand) => void | string | Promise<void | string>;
}

export function useEditorControlBridge({
  enabled = true,
  intervalMs = 1500,
  buildSnapshot,
  onCommand,
}: EditorControlBridgeOptions): void {
  const snapshotRef = useRef(buildSnapshot);
  snapshotRef.current = buildSnapshot;
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let cancelled = false;
    let source: EventSource | null = null;
    let timer: number | undefined;
    let token: string | null = null;

    let lastPayload = '';
    const pushState = () => {
      if (!token || document.hidden) return;
      try {
        const body = JSON.stringify(snapshotRef.current());
        // 内容没变就不发包；控制桥的 revision 也只在变化时递增。
        if (body === lastPayload) return;
        lastPayload = body;
        void fetch('/api/control/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Control-Token': token },
          body,
        }).catch(() => { lastPayload = ''; });
      } catch {
        /* 忽略：控制桥不可用不影响编辑 */
      }
    };

    /** 命令回执：让 MCP 知道这条命令是否真的执行成功。 */
    const postResult = async (id: string | undefined, ok: boolean, message: string) => {
      if (!id || !token) return;
      try {
        await fetch('/api/control/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Control-Token': token },
          body: JSON.stringify({ id, ok, message }),
        });
      } catch {
        /* 回执失败不影响编辑 */
      }
    };

    let retryTimer: number | undefined;
    const scheduleReconnect = (delayMs = 10_000) => {
      if (cancelled) return;
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => { void connect(); }, delayMs);
    };

    const connect = async () => {
      try {
        const response = await fetch('/api/control/handshake', { cache: 'no-store' });
        if (!response.ok) { scheduleReconnect(); return; }
        const data = await response.json() as { token?: string };
        if (cancelled || !data?.token) { scheduleReconnect(); return; }
        token = data.token;
        activeToken = data.token;
        source = new EventSource(`/api/control/stream?token=${encodeURIComponent(data.token)}`);
        // 服务重启后令牌会变化，连接断开时重新握手，避免一直用旧令牌重连。
        source.onerror = () => {
          source?.close();
          source = null;
          if (timer) { window.clearInterval(timer); timer = undefined; }
          scheduleReconnect();
        };
        source.addEventListener('command', (event) => {
          void (async () => {
            let command: EditorControlCommand | null = null;
            try {
              command = JSON.parse((event as MessageEvent).data) as EditorControlCommand;
              const outcome = await onCommandRef.current(command);
              await postResult(command.id, true, typeof outcome === 'string' ? outcome : '');
            } catch (error) {
              await postResult(command?.id, false, error instanceof Error ? error.message : String(error));
            }
          })();
        });
        pushState();
        timer = window.setInterval(pushState, intervalMs);
      } catch {
        /* 控制桥未启用时保持静默，稍后重试 */
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      source?.close();
      if (activeToken === token) activeToken = null;
    };
  }, [enabled, intervalMs]);
}
