import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  sendMessage,
  streamMessage,
  type ChatStreamEvent,
} from './api-client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Declaring the parameters matters: a zero-arg vi.fn types its `calls` as an
 * empty tuple, so `calls[0][1]` would not compile.
 */
const fetchSpy = (impl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
  vi.fn(impl);

afterEach(() => vi.unstubAllGlobals());

describe('apiGet', () => {
  it('returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 'agent_support' }])));
    await expect(apiGet<{ id: string }[]>('/api/agents')).resolves.toEqual([{ id: 'agent_support' }]);
  });

  it('throws ApiError carrying the server code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ error: { code: 'not_found', message: 'No agent with id "x".' } }, 404),
      ),
    );
    const error = (await apiGet('/api/agents/x').catch((thrown: unknown) => thrown)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('not_found');
    expect(error.message).toBe('No agent with id "x".');
  });

  it('falls back to a readable message when the body is not the error envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway exploded', { status: 502 })));
    const error = (await apiGet('/api/agents').catch((thrown: unknown) => thrown)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('http_502');
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('reports a network failure as status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = (await apiGet('/api/agents').catch((thrown: unknown) => thrown)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.code).toBe('network_error');
  });
});

describe('apiPost', () => {
  it('sends JSON and returns the parsed body', async () => {
    const fetchMock = fetchSpy(async () => jsonResponse({ id: 'agent_new' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiPost('/api/agents', { name: 'x' })).resolves.toEqual({ id: 'agent_new' });

    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('omits the body when none is given', async () => {
    const fetchMock = fetchSpy(async () => jsonResponse({}, 201));
    vi.stubGlobal('fetch', fetchMock);
    await apiPost('/api/agents');
    expect(fetchMock.mock.calls[0]![1]!.body).toBeUndefined();
  });
});

describe('apiPatch', () => {
  it('uses the PATCH method', async () => {
    const fetchMock = fetchSpy(async () => jsonResponse({ id: 'agent_support' }));
    vi.stubGlobal('fetch', fetchMock);
    await apiPatch('/api/agents/agent_support', { name: 'Renamed' });
    expect(fetchMock.mock.calls[0]![1]!.method).toBe('PATCH');
  });
});

describe('sendMessage', () => {
  it('sends sessionId with a follow-up message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: {} }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('agent_support', 'hello', { sessionId: 'sess_1' });

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      content: 'hello',
      sessionId: 'sess_1',
    });
  });

  it('omits sessionId on the first message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: {} }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('agent_support', 'hello', {});

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ content: 'hello' });
  });
});

describe('streamMessage', () => {
  it('parses NDJSON events even when network chunks split a line', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"textDelta","text":"Hel'));
        controller.enqueue(
          encoder.encode(
            'lo"}\n{"type":"done","message":{"id":"msg_1","role":"assistant","content":"Hello","toolCalls":[],"model":"gemini","latencyMs":10,"status":"done","createdAt":"now"}}\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }),
      ),
    );
    const events: ChatStreamEvent[] = [];

    await streamMessage('agent_support', 'hello', {}, (event) => events.push(event));

    expect(events.map((event) => event.type)).toEqual(['textDelta', 'done']);
    expect(events[0]).toEqual({ type: 'textDelta', text: 'Hello' });
  });
});

describe('apiDelete', () => {
  it('resolves on a 204 with no body to parse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    await expect(apiDelete('/api/agents/agent_support')).resolves.toBeUndefined();
  });

  it('throws on a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { code: 'not_found', message: 'gone' } }, 404)),
    );
    await expect(apiDelete('/api/agents/x')).rejects.toBeInstanceOf(ApiError);
  });
});
