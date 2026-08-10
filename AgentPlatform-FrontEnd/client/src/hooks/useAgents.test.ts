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

  it('debounces edits independently for two agents', async () => {
    const other = { ...agent, id: 'agent_research', name: 'Research Assistant' };
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return json([agent, other]);
      const body = JSON.parse(String(init?.body)) as { name: string };
      return json(String(url).endsWith(agent.id) ? { ...agent, ...body } : { ...other, ...body });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = await loaded();

    act(() => {
      result.current.updateAgent(agent.id, { name: 'Support Renamed' });
      result.current.updateAgent(other.id, { name: 'Research Renamed' });
    });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(2));
    expect(patchCalls(fetchMock).map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`/api/agents/${agent.id}`),
        expect.stringContaining(`/api/agents/${other.id}`),
      ]),
    );
  });

  it('keeps each agent save state correct when responses finish in reverse order', async () => {
    const other = { ...agent, id: 'agent_research', name: 'Research Assistant' };
    const resolvers = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return json([agent, other]);
      return new Promise<Response>((resolve) => resolvers.set(String(url), resolve));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = await loaded();

    act(() => {
      result.current.updateAgent(agent.id, { name: 'Support Renamed' });
      result.current.updateAgent(other.id, { name: 'Research Renamed' });
    });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(2));

    await act(async () => {
      resolvers.get(`/api/agents/${other.id}`)?.(json({ ...other, name: 'Research Renamed' }));
    });
    await act(async () => {
      resolvers.get(`/api/agents/${agent.id}`)?.(json({ ...agent, name: 'Support Renamed' }));
    });

    expect(result.current).toHaveProperty(`saveStates.${agent.id}.kind`, 'saved');
    expect(result.current).toHaveProperty(`saveStates.${other.id}.kind`, 'saved');
    expect(result.current.agents.find((item) => item.id === agent.id)?.name).toBe('Support Renamed');
    expect(result.current.agents.find((item) => item.id === other.id)?.name).toBe(
      'Research Renamed',
    );
  });

  it('reports saved with a timestamp', async () => {
    stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    await waitFor(() => expect(result.current.saveStates[agent.id]?.kind).toBe('saved'));
    const savedState = result.current.saveStates[agent.id];
    if (savedState?.kind !== 'saved') throw new Error('expected saved');
    expect(Number.isNaN(new Date(savedState.at).getTime())).toBe(false);
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

    await waitFor(() => expect(result.current.saveStates[agent.id]?.kind).toBe('error'));
    expect(result.current.agents[0]!.name).toBe('Support Bot');
    const failedState = result.current.saveStates[agent.id];
    if (failedState?.kind !== 'error') throw new Error('expected error');
    expect(failedState.message).toBe('Unknown model "gpt-4".');
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
    await waitFor(() => expect(result.current.saveStates[agent.id]?.kind).toBe('error'));

    await act(async () => {
      result.current.retrySave();
    });

    await waitFor(() => expect(result.current.saveStates[agent.id]?.kind).toBe('saved'));
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
    await waitFor(() => expect(result.current.saveStates[agent.id]?.kind).toBe('error'));

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

  it('cancels a pending autosave when that agent is deleted', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent(agent.id, { name: 'Do not save me' }));
    await act(async () => {
      await result.current.deleteAgent(agent.id);
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    expect(patchCalls(fetchMock)).toHaveLength(0);
    expect(result.current.agents).toHaveLength(0);
  });

  it('retries the failed create operation without turning it into an autosave error', async () => {
    let postAttempt = 0;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return json([agent]);
      if (method === 'POST') {
        postAttempt += 1;
        return postAttempt === 1
          ? json({ error: { code: 'internal_error', message: 'Create failed.' } }, 500)
          : json({ ...agent, id: 'agent_new', name: 'New agent' }, 201);
      }
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = await loaded();

    await act(async () => {
      await result.current.createAgent();
    });
    expect(result.current).toHaveProperty('operationError.kind', 'create');
    expect(result.current).toHaveProperty('operationError.message', 'Create failed.');
    expect(result.current).toHaveProperty('saveStates', {});

    const retryable = result.current as typeof result.current & {
      retryOperation: () => Promise<void>;
    };
    await act(async () => {
      await retryable.retryOperation();
    });

    expect(postAttempt).toBe(2);
    expect(result.current.agents[0]?.id).toBe('agent_new');
    expect(result.current).toHaveProperty('operationError', null);
  });

  it('retries a failed duplicate with the original source agent', async () => {
    let postAttempt = 0;
    const fetchMock = stubApi({
      post: () => {
        postAttempt += 1;
        return postAttempt === 1
          ? json({ error: { code: 'internal_error', message: 'Duplicate failed.' } }, 500)
          : json({ ...agent, id: 'agent_copy', name: 'Copy of Support Bot' }, 201);
      },
    });
    const { result } = await loaded();

    await act(async () => {
      await result.current.duplicateAgent(agent.id);
    });
    expect(result.current).toHaveProperty('operationError.kind', 'duplicate');

    await act(async () => {
      await result.current.retryOperation();
    });

    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(JSON.parse(String(posts[1]![1]!.body))).toHaveProperty('name', 'Copy of Support Bot');
    expect(result.current.agents[0]?.id).toBe('agent_copy');
    expect(result.current.operationError).toBeNull();
  });

  it('retries a failed delete against the same agent', async () => {
    let deleteAttempt = 0;
    const fetchMock = stubApi({
      del: () => {
        deleteAttempt += 1;
        return deleteAttempt === 1
          ? json({ error: { code: 'internal_error', message: 'Delete failed.' } }, 500)
          : new Response(null, { status: 204 });
      },
    });
    const { result } = await loaded();

    await act(async () => {
      await result.current.deleteAgent(agent.id);
    });
    expect(result.current).toHaveProperty('operationError.kind', 'delete');

    await act(async () => {
      await result.current.retryOperation();
    });

    const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(deletes).toHaveLength(2);
    expect(String(deletes[1]![0])).toContain(`/api/agents/${agent.id}`);
    expect(result.current.agents).toHaveLength(0);
    expect(result.current.operationError).toBeNull();
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
