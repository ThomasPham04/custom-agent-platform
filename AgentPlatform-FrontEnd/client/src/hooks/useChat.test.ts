import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import type { Message } from '../types/message';

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
  model: 'gemini-2.5-flash',
  latencyMs: 480,
  status: 'done',
  createdAt: '2026-08-04T12:00:00.000Z',
  ...over,
});

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

    expect(fetchMock).not.toHaveBeenCalled();
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
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
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
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]!.body))).toEqual({
      content: 'what time is it?',
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

    act(() => result.current.clear());
    expect(result.current.messages).toHaveLength(0);

    rerender({ id: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
  });
});
