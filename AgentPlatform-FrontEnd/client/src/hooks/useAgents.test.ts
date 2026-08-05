import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AUTOSAVE_DELAY_MS, useAgents } from './useAgents';
import type { Agent } from '../types/agent';

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-2.5-flash',
  systemPrompt: 'Be terse.',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Routes by method so each test states only what it cares about. */
const stubApi = (handlers: {
  list?: () => Response;
  patch?: () => Response;
  post?: () => Response;
  del?: () => Response;
}) => {
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET') return handlers.list?.() ?? json([agent]);
    if (method === 'PATCH') return handlers.patch?.() ?? json({ ...agent, name: 'patched' });
    if (method === 'POST') return handlers.post?.() ?? json({ ...agent, id: 'agent_new' }, 201);
    return handlers.del?.() ?? new Response(null, { status: 204 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const loaded = async () => {
  const view = renderHook(() => useAgents());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
};

const patchCalls = (mock: ReturnType<typeof stubApi>) =>
  mock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAgents loading', () => {
  it('loads the list', async () => {
    stubApi({});
    const { result } = await loaded();
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a load failure as a readable message', async () => {
    stubApi({
      list: () => json({ error: { code: 'internal_error', message: 'Database is down.' } }, 500),
    });
    const { result } = await loaded();
    expect(result.current.error).toBe('Database is down.');
    expect(result.current.agents).toEqual([]);
  });
});

describe('useAgents optimistic update', () => {
  it('applies the patch locally before any request goes out', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));

    expect(result.current.agents[0]!.name).toBe('Renamed');
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });

  it('sends one coalesced request for rapid edits', async () => {
    const fetchMock = stubApi({ patch: () => json({ ...agent, name: 'C', description: 'D' }) });
    const { result } = await loaded();

    act(() => {
      result.current.updateAgent('agent_support', { name: 'A' });
      result.current.updateAgent('agent_support', { name: 'B' });
      result.current.updateAgent('agent_support', { name: 'C', description: 'D' });
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    const patches = patchCalls(fetchMock);
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String(patches[0]![1]!.body))).toEqual({ name: 'C', description: 'D' });
  });

  it('reports saved with a timestamp', async () => {
    stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('saved'));
    if (result.current.saveState.kind !== 'saved') throw new Error('expected saved');
    expect(Number.isNaN(new Date(result.current.saveState.at).getTime())).toBe(false);
  });

  it('rolls back and reports the failure when the save is rejected', async () => {
    stubApi({
      patch: () => json({ error: { code: 'bad_request', message: 'Unknown model "gpt-4".' } }, 400),
    });
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    expect(result.current.agents[0]!.name).toBe('Renamed');

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('error'));
    expect(result.current.agents[0]!.name).toBe('Support Bot');
    if (result.current.saveState.kind !== 'error') throw new Error('expected error');
    expect(result.current.saveState.message).toBe('Unknown model "gpt-4".');
  });

  it('retries the same patch after a failure', async () => {
    let attempt = 0;
    const fetchMock = stubApi({
      patch: () => {
        attempt += 1;
        return attempt === 1
          ? json({ error: { code: 'network_error', message: 'nope' } }, 500)
          : json({ ...agent, name: 'Renamed' });
      },
    });
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await waitFor(() => expect(result.current.saveState.kind).toBe('error'));

    await act(async () => {
      result.current.retrySave();
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('saved'));
    expect(result.current.agents[0]!.name).toBe('Renamed');
    const patches = patchCalls(fetchMock);
    expect(patches).toHaveLength(2);
    expect(JSON.parse(String(patches[1]![1]!.body))).toEqual({ name: 'Renamed' });
  });

  it('keeps an edit made while an earlier save is still in flight', async () => {
    // The server replies with the state as of the FIRST patch only. Checking a
    // second tool before that reply lands must not lose the second tool.
    let resolveFirst: ((value: Response) => void) | undefined;
    let attempt = 0;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return json([agent]);
      attempt += 1;
      if (attempt === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return json({ ...agent, toolIds: ['current_time', 'http_request'] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = await loaded();

    // First edit, flushed immediately but left hanging.
    act(() => result.current.updateAgent('agent_support', { toolIds: ['current_time'] }));
    act(() => {
      void result.current.flushUpdates();
    });

    // Second edit arrives while the first request is still open.
    act(() =>
      result.current.updateAgent('agent_support', { toolIds: ['current_time', 'http_request'] }),
    );
    expect(result.current.agents[0]!.toolIds).toEqual(['current_time', 'http_request']);

    // The stale reply lands.
    await act(async () => {
      resolveFirst?.(json({ ...agent, toolIds: ['current_time'] }));
    });

    // The newer edit survives it.
    expect(result.current.agents[0]!.toolIds).toEqual(['current_time', 'http_request']);
  });

  it('keeps another agent queued when an in-flight save fails', async () => {
    const other = { ...agent, id: 'agent_research', name: 'Research Assistant' };
    let rejectFirst: ((reason: unknown) => void) | undefined;
    let patchAttempt = 0;

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return json([agent, other]);
      patchAttempt += 1;
      if (patchAttempt === 1) {
        return new Promise<Response>((_resolve, reject) => {
          rejectFirst = reject;
        });
      }
      return json({ ...other, name: 'Research Renamed' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = await loaded();
    act(() => result.current.updateAgent('agent_support', { name: 'Support Renamed' }));
    act(() => {
      void result.current.flushUpdates();
    });
    act(() => result.current.updateAgent('agent_research', { name: 'Research Renamed' }));

    await act(async () => {
      rejectFirst?.(new TypeError('network down'));
    });
    await waitFor(() => expect(result.current.saveState.kind).toBe('error'));

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(2));

    const second = patchCalls(fetchMock)[1]!;
    expect(String(second[0])).toContain('/api/agents/agent_research');
    expect(JSON.parse(String(second[1]!.body))).toEqual({ name: 'Research Renamed' });
  });

  it('flushes a pending patch without waiting for the debounce', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      await result.current.flushUpdates();
    });

    expect(patchCalls(fetchMock)).toHaveLength(1);
  });
});

describe('useAgents create, duplicate, delete', () => {
  it('prepends a created agent', async () => {
    stubApi({});
    const { result } = await loaded();

    await act(async () => {
      await result.current.createAgent();
    });

    expect(result.current.agents[0]!.id).toBe('agent_new');
    expect(result.current.agents).toHaveLength(2);
  });

  it('duplicates an agent with a "Copy of" name and draft status', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    await act(async () => {
      await result.current.duplicateAgent('agent_support');
    });

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse(String(post![1]!.body));
    expect(body.name).toBe('Copy of Support Bot');
    expect(body.status).toBe('draft');
    expect(body.toolIds).toEqual(['current_time']);
  });

  it('removes a deleted agent and reports success', async () => {
    stubApi({});
    const { result } = await loaded();

    let outcome = false;
    await act(async () => {
      outcome = await result.current.deleteAgent('agent_support');
    });

    expect(outcome).toBe(true);
    expect(result.current.agents).toHaveLength(0);
  });

  it('keeps the agent and reports failure when the delete is rejected', async () => {
    stubApi({ del: () => json({ error: { code: 'not_found', message: 'gone' } }, 404) });
    const { result } = await loaded();

    let outcome = true;
    await act(async () => {
      outcome = await result.current.deleteAgent('agent_support');
    });

    expect(outcome).toBe(false);
    expect(result.current.agents).toHaveLength(1);
  });
});
