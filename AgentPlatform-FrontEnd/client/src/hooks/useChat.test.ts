import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import type { Message } from '../types/message';
import type { Run } from '../types/run';

const assistant = (over: Partial<Message> = {}): Message => ({
  id: 'msg_1',
  role: 'assistant',
  content: "It's 9:03 PM in Tokyo.",
  toolCalls: [
    {
      id: 'call_1',
      toolId: 'current_time',
      args: { timezone: 'Asia/Tokyo' },
      result: '21:03',
      durationMs: 100,
      status: 'ok',
    },
    {
      id: 'call_2',
      toolId: 'http_request',
      args: { url: 'https://x' },
      result: { status: 200 },
      durationMs: 200,
      status: 'ok',
    },
  ],
  model: 'gemini-3.1-flash-lite',
  latencyMs: 480,
  status: 'done',
  createdAt: '2026-08-04T12:00:00.000Z',
  ...over,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Chat POSTs only. Mounting the hook also issues the history GET, so a raw
 * fetch-call count no longer answers "how many messages were sent?".
 */
const postCalls = (fetchMock: { mock: { calls: unknown[][] } }) =>
  fetchMock.mock.calls.filter(
    (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
  ) as [unknown, RequestInit][];

/** An empty history, so hydration never disturbs a send-focused test. */
const noHistory = () => jsonResponse([]);

const stubPost = (body: unknown, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useChat send', () => {
  it('appends the user turn and a thinking placeholder straight away', async () => {
    stubPost({ message: assistant() });
    const { result } = renderHook(() => useChat('agent_support'));

    act(() => {
      void result.current.send('what time is it in Tokyo?');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'what time is it in Tokyo?',
      status: 'done',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      status: 'thinking',
      content: '',
    });
    expect(result.current.sending).toBe(true);
  });

  it('reveals tool calls one at a time, paced by each duration', async () => {
    stubPost({ message: assistant() });
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      void result.current.send('hi');
    });

    // The first call is revealed as running before its duration elapses.
    await waitFor(() => expect(result.current.messages[1]!.toolCalls).toHaveLength(1));
    expect(result.current.messages[1]!.toolCalls![0]).toMatchObject({
      toolId: 'current_time',
      status: 'running',
    });
    expect(result.current.messages[1]!.content).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await waitFor(() => expect(result.current.messages[1]!.toolCalls![0]!.status).toBe('ok'));
    await waitFor(() => expect(result.current.messages[1]!.toolCalls).toHaveLength(2));
    expect(result.current.messages[1]!.toolCalls![1]!.status).toBe('running');

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));
    expect(result.current.messages[1]!.content).toBe("It's 9:03 PM in Tokyo.");
    expect(result.current.messages[1]!.latencyMs).toBe(480);
  });

  it('stays in the sending state for the whole reveal, not just the request', async () => {
    stubPost({ message: assistant() });
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      void result.current.send('hi');
    });
    await waitFor(() => expect(result.current.messages[1]!.toolCalls).toHaveLength(1));
    expect(result.current.sending).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(result.current.sending).toBe(false));
  });

  it('answers immediately when the agent has no tools', async () => {
    stubPost({ message: assistant({ toolCalls: [], latencyMs: 180 }) });
    const { result } = renderHook(() => useChat('agent_drafter'));

    await act(async () => {
      void result.current.send('draft notes');
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));
    expect(result.current.messages[1]!.toolCalls).toEqual([]);
  });

  it('stops the walk at a failed call and reports the failure as the answer', async () => {
    stubPost({
      message: assistant({
        status: 'error',
        content:
          'http_request failed: connection refused after 800ms. Nothing was written, so retrying is safe.',
        toolCalls: [
          {
            id: 'call_1',
            toolId: 'current_time',
            args: {},
            result: '21:03',
            durationMs: 100,
            status: 'ok',
          },
          {
            id: 'call_2',
            toolId: 'http_request',
            args: {},
            error: 'connection refused after 800ms',
            durationMs: 200,
            status: 'error',
          },
        ],
      }),
    });
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      void result.current.send('make it fail');
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('error'));
    expect(result.current.messages[1]!.toolCalls![1]!.status).toBe('error');
    expect(result.current.messages[1]!.content).toContain('connection refused');
  });

  it('refuses to send blank content', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      await result.current.send('   ');
    });

    expect(postCalls(fetchMock)).toHaveLength(0);
    expect(result.current.messages).toHaveLength(0);
  });

  it('does nothing without a selected agent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat(null));

    await act(async () => {
      await result.current.send('hi');
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prevents overlapping runs for the same agent before React rerenders', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('agent_support'));

    act(() => {
      void result.current.send('first');
      void result.current.send('second');
    });

    expect(postCalls(fetchMock)).toHaveLength(1);
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      resolveRequest?.(jsonResponse({ message: assistant({ toolCalls: [] }) }));
    });
  });
});

describe('useChat failure and retry', () => {
  it('keeps the user turn and marks the assistant turn as failed', async () => {
    stubPost({ error: { code: 'not_found', message: 'No agent with id "agent_gone".' } }, 404);
    const { result } = renderHook(() => useChat('agent_gone'));

    await act(async () => {
      await result.current.send('hi');
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('error'));
    expect(result.current.messages[0]!.role).toBe('user');
    expect(result.current.messages[1]!.content).toBe('No agent with id "agent_gone".');
    expect(result.current.sending).toBe(false);
  });

  it('resends the same content on retry', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'POST') return noHistory();
      attempt += 1;
      const body =
        attempt === 1
          ? { error: { code: 'network_error', message: 'nope' } }
          : { message: assistant({ toolCalls: [] }) };
      return new Response(JSON.stringify(body), {
        status: attempt === 1 ? 500 : 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat('agent_support'));
    await act(async () => {
      await result.current.send('what time is it?');
    });
    await waitFor(() => expect(result.current.messages[1]!.status).toBe('error'));

    await act(async () => {
      await result.current.retryLast();
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('what time is it?');
    expect(JSON.parse(String(postCalls(fetchMock)[1]![1]!.body))).toEqual({
      content: 'what time is it?',
      retry: true,
    });
  });

  it('retries the user message paired with a specific historical failure', async () => {
    const responses = [
      { message: assistant({ id: 'failed_one', content: 'first failed', status: 'error', toolCalls: [] }) },
      { message: assistant({ id: 'failed_two', content: 'second failed', status: 'error', toolCalls: [] }) },
      { message: assistant({ id: 'retried', content: 'first succeeded', status: 'done', toolCalls: [] }) },
    ];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
      init?.method === 'POST' ? jsonResponse(responses.shift()) : noHistory(),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      await result.current.send('first question');
    });
    await act(async () => {
      await result.current.send('second question');
    });

    expect(result.current).toHaveProperty('retry');
    const retryable = result.current as typeof result.current & {
      retry: (messageId: string) => Promise<void>;
    };
    await act(async () => {
      await retryable.retry('failed_one');
    });

    expect(JSON.parse(String(postCalls(fetchMock)[2]![1]!.body))).toEqual({
      content: 'first question',
      retry: true,
    });
  });
});

describe('useChat threads', () => {
  it('keeps a separate thread per agent and restores it on return', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderHook(({ id }: { id: string }) => useChat(id), {
      initialProps: { id: 'agent_support' },
    });

    await act(async () => {
      await result.current.send('first');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    rerender({ id: 'agent_research' });
    expect(result.current.messages).toHaveLength(0);

    rerender({ id: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('first');
  });

  it('clears only the active thread', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderHook(({ id }: { id: string }) => useChat(id), {
      initialProps: { id: 'agent_support' },
    });

    await act(async () => {
      await result.current.send('keep me');
    });
    rerender({ id: 'agent_research' });
    await act(async () => {
      await result.current.send('drop me');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.clear();
    });
    expect(result.current.messages).toHaveLength(0);

    rerender({ id: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
  });

  it('keeps in-flight state scoped to the agent when switching threads', async () => {
    const resolvers = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      // Only the chat POST hangs; history resolves at once so the resolver map
      // holds the send, not the hydration request.
      if (init?.method !== 'POST') return noHistory();
      const id = String(url).includes('agent_support') ? 'agent_support' : 'agent_research';
      return new Promise<Response>((resolve) => resolvers.set(id, resolve));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ id }: { id: string }) => useChat(id), {
      initialProps: { id: 'agent_support' },
    });

    act(() => {
      void result.current.send('support question');
    });
    expect(result.current.sending).toBe(true);

    rerender({ id: 'agent_research' });
    expect(result.current.sending).toBe(false);
    act(() => {
      void result.current.send('research question');
    });
    expect(postCalls(fetchMock)).toHaveLength(2);

    await act(async () => {
      resolvers
        .get('agent_research')
        ?.(jsonResponse({ message: assistant({ id: 'research_done', toolCalls: [] }) }));
    });
    expect(result.current.sending).toBe(false);

    rerender({ id: 'agent_support' });
    expect(result.current.sending).toBe(true);
    await act(async () => {
      resolvers
        .get('agent_support')
        ?.(jsonResponse({ message: assistant({ id: 'support_done', toolCalls: [] }) }));
    });
  });
});

const historyRun = (over: Partial<Run> = {}): Run => ({
  id: 'run_1',
  agentId: 'agent_support',
  agentName: 'Support Bot',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be brief.',
  userMessage: 'what time is it in Tokyo?',
  answer: "It's 9:03 PM in Tokyo.",
  status: 'done',
  error: null,
  latencyMs: 480,
  sessionId: null,
  createdAt: '2026-08-04T12:00:00+00:00',
  toolCalls: [],
  ...over,
});

/** Routes GET to the runs list and every other method to the chat response. */
const stubHistory = (runs: Run[], post: unknown = { message: assistant() }) => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    (init?.method ?? 'GET') === 'GET' ? jsonResponse(runs) : jsonResponse(post),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('useChat hydration', () => {
  it('loads the agent past turns on mount', async () => {
    stubHistory([historyRun()]);
    const { result } = renderHook(() => useChat('agent_support'));

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0]!.content).toBe('what time is it in Tokyo?');
    expect(result.current.messages[1]!.content).toBe("It's 9:03 PM in Tokyo.");
    expect(result.current.loading).toBe(false);
  });

  it('reports loading until the history arrives', async () => {
    stubHistory([historyRun()]);
    const { result } = renderHook(() => useChat('agent_support'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('requests history once per agent', async () => {
    const fetchMock = stubHistory([historyRun()]);
    const { result, rerender } = renderHook(({ id }) => useChat(id), {
      initialProps: { id: 'agent_support' },
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    rerender({ id: 'agent_sales' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ id: 'agent_support' });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    const historyCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init?.method ?? 'GET') === 'GET',
    );
    expect(historyCalls).toHaveLength(2);
  });

  it('asks only for that agent runs', async () => {
    const fetchMock = stubHistory([]);
    renderHook(() => useChat('agent_support'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/api/runs?agentId=agent_support');
  });

  it('leaves the thread empty when history cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'GET'
          ? jsonResponse({ error: { code: 'internal', message: 'boom' } }, 500)
          : jsonResponse({ message: assistant() }),
      ),
    );
    const { result } = renderHook(() => useChat('agent_support'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it('does not clobber a turn the user started while history was in flight', async () => {
    let releaseHistory = (_value: Response) => {};
    const pending = new Promise<Response>((resolve) => {
      releaseHistory = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'GET'
          ? pending
          : jsonResponse({ message: assistant({ toolCalls: [] }) }),
      ),
    );
    const { result } = renderHook(() => useChat('agent_support'));

    act(() => {
      void result.current.send('hello');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => releaseHistory(jsonResponse([historyRun()])));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('hello');
  });
});

describe('useChat clear', () => {
  it('deletes that agent runs and empties the thread', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return jsonResponse([historyRun()]);
      if (method === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse({ message: assistant() });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('agent_support'));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await result.current.clear();
    });

    expect(result.current.messages).toEqual([]);
    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(String(deleteCall?.[0])).toContain('/api/runs?agentId=agent_support');
  });

  it('keeps the thread when the delete fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (method === 'GET') return jsonResponse([historyRun()]);
        if (method === 'DELETE') {
          return jsonResponse({ error: { code: 'internal', message: 'boom' } }, 500);
        }
        return jsonResponse({ message: assistant() });
      }),
    );
    const { result } = renderHook(() => useChat('agent_support'));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await expect(result.current.clear()).rejects.toThrow('boom');
    });

    expect(result.current.messages).toHaveLength(2);
  });
});

describe('useChat clear races', () => {
  it('does not let a late history response resurrect cleared turns', async () => {
    let releaseHistory = (_value: Response) => {};
    const pending = new Promise<Response>((resolve) => {
      releaseHistory = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (method === 'GET') return pending;
        if (method === 'DELETE') return new Response(null, { status: 204 });
        return jsonResponse({ message: assistant() });
      }),
    );
    const { result } = renderHook(() => useChat('agent_support'));
    expect(result.current.loading).toBe(true);

    // Clear lands while the history GET is still outstanding.
    await act(async () => {
      await result.current.clear();
    });
    act(() => releaseHistory(jsonResponse([historyRun()])));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toEqual([]);
  });
});
