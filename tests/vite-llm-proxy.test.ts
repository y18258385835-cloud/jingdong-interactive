import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vite3DProxyPlugin } from '../vite-plugin-3d-proxy';

type Middleware = (req: EventEmitter & { url: string; method: string }, res: TestResponse, next: () => void) => Promise<void>;

interface TestResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

function getMiddleware() {
  let middleware: Middleware | undefined;
  const plugin = vite3DProxyPlugin();
  const configureServer = plugin.configureServer as (server: unknown) => void;
  configureServer({
    middlewares: {
      use(handler: Middleware) {
        middleware = handler;
      },
    },
  });
  if (!middleware) throw new Error('Vite proxy middleware was not registered');
  return middleware;
}

function invoke(middleware: Middleware, payload: unknown) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = new EventEmitter() as EventEmitter & { url: string; method: string };
    req.url = '/api/llm/scene-generate';
    req.method = 'POST';
    const res: TestResponse = {
      statusCode: 200,
      setHeader: () => undefined,
      end: (body = '{}') => resolve({ status: res.statusCode, body: JSON.parse(body) }),
    };
    void middleware(req, res, () => reject(new Error('AI request unexpectedly reached next middleware')));
    queueMicrotask(() => {
      req.emit('data', Buffer.from(JSON.stringify(payload)));
      req.emit('end');
    });
  });
}

function modelResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Vite LLM scene proxy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards attachments and repairs a non-executable first model response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(modelResponse(JSON.stringify({ title: 'Draft', operations: [] })))
      .mockResolvedValueOnce(modelResponse(JSON.stringify({
        title: 'Repaired proposal',
        operations: [{ kind: 'create-scene', sceneId: 'overview', name: 'Overview' }],
      })));

    const result = await invoke(getMiddleware(), {
      apiKey: 'test-key',
      endpoint: 'https://example.com/v1/chat/completions',
      model: 'test-vision-model',
      prompt: 'Create an overview scene',
      context: { activeSceneId: 'home' },
      attachments: [{
        name: 'reference.png',
        type: 'image/png',
        category: 'image',
        size: 4,
        dataUrl: 'data:image/png;base64,AAAA',
      }],
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      repaired: true,
      proposal: { title: 'Repaired proposal', operations: [{ kind: 'create-scene' }] },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstRequest.messages[1].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image_url' }),
    ]));

    const repairRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairRequest.messages.at(-1).content).toContain('Return corrected JSON only');
  });
});
