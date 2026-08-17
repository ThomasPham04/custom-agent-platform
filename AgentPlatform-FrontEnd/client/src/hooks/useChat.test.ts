import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import type { Message } from '../types/message';
import type { Run } from '../types/run';
import type { Session } from '../types/session';

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

const session = (over: Partial<Session> = {}): Session => ({
  id: 'sess_new',
  agentId: 'agent_support',
  title: 'what time is it?',
  createdAt: '2026-08-16T10:00:00.000Z',
  updatedAt: '2026-08-16T10:00:00.000Z',
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

/** History reads only, so a test can pin how often a session was fetched. */
const getCalls = (fetchMock: { mock: { calls: unknown[][] } }) =>
  fetchMock.mock.calls.filter(
    (call) => ((call[1] as RequestInit | undefined)?.method ?? 'GET') === 'GET',
  );

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

/** The hook is keyed by session; the agent only addresses the chat POST. */
type ChatProps = { sessionId: string | null; agentId: string | null };

const renderChat = (initialProps: ChatProps) =>
  renderHook(({ sessionId, agentId }: ChatProps) => useChat(sessionId, agentId), {
    initialProps,
  });

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useChat send', () => {
  it('appends the user turn and a thinking placeholder straight away', async () => {
    stubPost({ message: assistant() });
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

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
    const { result } = renderChat({ sessionId: 'sess_2', agentId: 'agent_drafter' });

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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('   ');
    });

    expect(postCalls(fetchMock)).toHaveLength(0);
    expect(result.current.messages).toHaveLength(0);
  });

  it('does nothing without a selected agent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderChat({ sessionId: null, agentId: null });

    await act(async () => {
      await result.current.send('hi');
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prevents overlapping runs in the same chat before React rerenders', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

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
    const { result } = renderChat({ sessionId: 'sess_gone', agentId: 'agent_gone' });

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

    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });
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
      sessionId: 'sess_1',
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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('first question');
    });
    await act(async () => {
      await result.current.send('second question');
    });

    expect(result.current).toHaveProperty('retry');
    const retryable = result.current as typeof result.current & {
      retry: (messageId: string) => Promise<unknown>;
    };
    await act(async () => {
      await retryable.retry('failed_one');
    });

    expect(JSON.parse(String(postCalls(fetchMock)[2]![1]!.body))).toEqual({
      content: 'first question',
      retry: true,
      sessionId: 'sess_1',
    });
  });
});

describe('useChat threads', () => {
  it('keeps a separate thread per session and restores it on return', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('first');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    rerender({ sessionId: 'sess_2', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(0);

    rerender({ sessionId: 'sess_1', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('first');
  });

  it('forgets only the active thread', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('keep me');
    });
    rerender({ sessionId: 'sess_2', agentId: 'agent_support' });
    await act(async () => {
      await result.current.send('drop me');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.forget());
    expect(result.current.messages).toHaveLength(0);

    rerender({ sessionId: 'sess_1', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
  });

  it('keeps in-flight state scoped to the session when switching threads', async () => {
    const resolvers = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      // Only the chat POST hangs; history resolves at once so the resolver map
      // holds the send, not the hydration request.
      if (init?.method !== 'POST') return noHistory();
      const id = String(url).includes('agent_support') ? 'agent_support' : 'agent_research';
      return new Promise<Response>((resolve) => resolvers.set(id, resolve));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderChat({
      sessionId: 'sess_support',
      agentId: 'agent_support',
    });

    act(() => {
      void result.current.send('support question');
    });
    expect(result.current.sending).toBe(true);

    rerender({ sessionId: 'sess_research', agentId: 'agent_research' });
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

    rerender({ sessionId: 'sess_support', agentId: 'agent_support' });
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
  sessionId: 'sess_1',
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
  it('loads the session past turns on mount', async () => {
    stubHistory([historyRun()]);
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0]!.content).toBe('what time is it in Tokyo?');
    expect(result.current.messages[1]!.content).toBe("It's 9:03 PM in Tokyo.");
    expect(result.current.loading).toBe(false);
  });

  it('reports loading until the history arrives', async () => {
    stubHistory([historyRun()]);
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('requests history once per session', async () => {
    const fetchMock = stubHistory([historyRun()]);
    const { result, rerender } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    rerender({ sessionId: 'sess_2', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ sessionId: 'sess_1', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(getCalls(fetchMock)).toHaveLength(2);
  });

  it('asks only for that session runs', async () => {
    const fetchMock = stubHistory([]);
    renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/api/runs?sessionId=sess_1');
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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);
  });

  it('lets a later visit retry a history load that failed', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') !== 'GET') return jsonResponse({ message: assistant() });
      if (!String(input).includes('sess_1')) return noHistory();
      attempts += 1;
      return attempts === 1
        ? jsonResponse({ error: { code: 'internal', message: 'boom' } }, 500)
        : jsonResponse([historyRun()]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toEqual([]);

    // The failed load un-marks the session, so coming back fetches it again.
    rerender({ sessionId: 'sess_2', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(getCalls(fetchMock).filter((call) => String(call[0]).includes('sess_1'))).toHaveLength(
      2,
    );
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
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

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

describe('useChat forget', () => {
  it('empties the thread without deleting anything on the server', async () => {
    const fetchMock = stubHistory([historyRun()]);
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.forget('sess_1'));

    expect(result.current.messages).toEqual([]);
    // Deleting a chat for real is DELETE /api/sessions/{id} in useSessions.
    // Forgetting a thread does not touch the network at all.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it('leaves the other threads alone', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('keep me');
    });
    rerender({ sessionId: 'sess_2', agentId: 'agent_support' });
    await act(async () => {
      await result.current.send('drop me');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.forget('sess_1'));
    expect(result.current.messages).toHaveLength(2);

    rerender({ sessionId: 'sess_1', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(0);
  });

  it('lets the next visit load the forgotten history again', async () => {
    const fetchMock = stubHistory([historyRun()]);
    const { result, rerender } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.forget('sess_1'));
    expect(result.current.messages).toEqual([]);

    rerender({ sessionId: 'sess_2', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(getCalls(fetchMock)).toHaveLength(3);
  });

  it('retires the redirect a forgotten new chat left behind', async () => {
    const created = session();
    let posts = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return noHistory();
      posts += 1;
      // Only a request that creates a session carries one back.
      return jsonResponse(
        posts === 1
          ? { message: assistant({ toolCalls: [] }), session: created }
          : { message: assistant({ id: 'msg_2', toolCalls: [] }) },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderChat({ sessionId: null, agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('first');
    });
    expect(result.current.messages).toHaveLength(2);

    // The chat is forgotten from the pending screen, before the route ever
    // reaches the session it created.
    act(() => result.current.forget());
    expect(result.current.messages).toHaveLength(0);

    await act(async () => {
      await result.current.send('second');
    });

    // A screen that looks fresh has to be fresh: the redirect went with the
    // thread, so this message opens a new session instead of silently
    // continuing the forgotten one.
    expect(JSON.parse(String(postCalls(fetchMock)[1]![1]!.body))).toEqual({ content: 'second' });
    expect(result.current.messages).toHaveLength(2);
  });
});

describe('useChat forget races', () => {
  it('does not let a late history response resurrect forgotten turns', async () => {
    let releaseHistory = (_value: Response) => {};
    const pending = new Promise<Response>((resolve) => {
      releaseHistory = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        (init?.method ?? 'GET') === 'GET' ? pending : jsonResponse({ message: assistant() }),
      ),
    );
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });
    expect(result.current.loading).toBe(true);

    // The thread is emptied while the history GET is still outstanding.
    act(() => result.current.forget('sess_1'));
    act(() => releaseHistory(jsonResponse([historyRun()])));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toEqual([]);
  });
});

describe('useChat sessions', () => {
  it('hydrates from the session, not the agent', async () => {
    const fetchMock = stubHistory([historyRun()]);
    const { result } = renderChat({ sessionId: 'sess_1', agentId: 'agent_support' });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain('/api/runs?sessionId=sess_1');
    expect(url).not.toContain('agentId');
  });

  it('returns the created session on the first message and nothing after it', async () => {
    const created = session();
    let posts = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return noHistory();
      posts += 1;
      return jsonResponse(
        posts === 1
          ? { message: assistant({ toolCalls: [] }), session: created }
          : { message: assistant({ id: 'msg_2', toolCalls: [] }) },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    let first: Session | undefined;
    await act(async () => {
      first = await result.current.send('what time is it?');
    });
    expect(first).toEqual(created);
    // A new chat posts without a session id; the server creates one.
    expect(JSON.parse(String(postCalls(fetchMock)[0]![1]!.body))).toEqual({
      content: 'what time is it?',
    });

    rerender({ sessionId: 'sess_new', agentId: 'agent_support' });

    let second: Session | undefined = created;
    await act(async () => {
      second = await result.current.send('and in Berlin?');
    });
    expect(second).toBeUndefined();
    expect(JSON.parse(String(postCalls(fetchMock)[1]![1]!.body))).toEqual({
      content: 'and in Berlin?',
      sessionId: 'sess_new',
    });
  });

  it('keeps a new chat turns when the session id arrives', async () => {
    const created = session({ title: 'hello' });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? noHistory()
        : jsonResponse({ message: assistant({ toolCalls: [] }), session: created }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    // No session id yet, so nothing is fetched and the turn shows at once.
    act(() => {
      void result.current.send('hello');
    });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('hello');
    expect(getCalls(fetchMock)).toHaveLength(0);

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));

    // The route catches up. The turn is already keyed by the new session, so
    // it is neither lost nor shown twice.
    rerender({ sessionId: 'sess_new', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('hello');
    expect(result.current.messages[1]!.content).toBe("It's 9:03 PM in Tokyo.");

    // Already on screen, so the created session is not fetched back.
    expect(getCalls(fetchMock)).toHaveLength(0);
  });

  it('continues the created session when a second message beats the route', async () => {
    const created = session();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? noHistory()
        : jsonResponse({ message: assistant({ toolCalls: [] }), session: created }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderChat({ sessionId: null, agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('first');
    });
    await act(async () => {
      await result.current.send('second');
    });

    expect(JSON.parse(String(postCalls(fetchMock)[1]![1]!.body))).toEqual({
      content: 'second',
      sessionId: 'sess_new',
    });
    expect(result.current.messages).toHaveLength(4);
  });

  it('keeps both turns after the route lands on the created session', async () => {
    const created = session();
    let posts = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return noHistory();
      posts += 1;
      // Only the creating request carries the session back.
      return posts === 1
        ? jsonResponse({ message: assistant({ toolCalls: [] }), session: created })
        : jsonResponse({ message: assistant({ toolCalls: [], id: 'msg_2' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('first');
    });
    await act(async () => {
      await result.current.send('second');
    });
    expect(result.current.messages).toHaveLength(4);

    rerender({ sessionId: 'sess_new', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(4);
  });

  it('does not blank the session thread when adopt runs after the route moved', async () => {
    const created = session();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? noHistory()
        : jsonResponse({ message: assistant(), session: created }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    // Start the send but do not await it: the reveal paces on a 100ms tool call.
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.send('hello');
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    rerender({ sessionId: 'sess_new', agentId: 'agent_support' });

    await act(async () => {
      await pending;
    });
    expect(result.current.messages).toHaveLength(2);
    // The rest of the reveal followed the thread to the session key.
    expect(result.current.messages[1]).toMatchObject({
      status: 'done',
      content: "It's 9:03 PM in Tokyo.",
    });
    expect(result.current.messages[1]!.toolCalls).toHaveLength(2);
    expect(result.current.sending).toBe(false);
  });

  it('keeps the chat on screen and sending when the route lands mid-reveal', async () => {
    const created = session();
    let resolvePost: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? noHistory()
        : new Promise<Response>((resolve) => {
            resolvePost = resolve;
          }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.send('hello');
    });
    expect(result.current.sending).toBe(true);

    // The response lands, so the session exists; the reveal still has 300ms of
    // tool calls to walk.
    await act(async () => {
      resolvePost?.(jsonResponse({ message: assistant(), session: created }));
    });

    // The route catches up in the middle of that walk.
    rerender({ sessionId: 'sess_new', agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.sending).toBe(true);

    await act(async () => {
      await pending;
    });
    expect(result.current.messages[1]!.status).toBe('done');
    expect(result.current.sending).toBe(false);
  });

  it('leaves a pending chat alone when the route lands on a different session', async () => {
    const created = session();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? noHistory()
        : jsonResponse({ message: assistant({ toolCalls: [] }), session: created }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('hello');
    });
    expect(result.current.messages).toHaveLength(2);

    // Some other chat is opened before the route ever reaches the created one.
    rerender({ sessionId: 'sess_other', agentId: 'agent_support' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(0);

    // Coming back still shows the turn the new chat created.
    rerender({ sessionId: null, agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('hello');
  });

  it('starts a clean draft for each agent while no session exists', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderChat({ sessionId: null, agentId: 'agent_support' });

    await act(async () => {
      await result.current.send('support draft');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    rerender({ sessionId: null, agentId: 'agent_research' });
    expect(result.current.messages).toHaveLength(0);

    rerender({ sessionId: null, agentId: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
  });
});
