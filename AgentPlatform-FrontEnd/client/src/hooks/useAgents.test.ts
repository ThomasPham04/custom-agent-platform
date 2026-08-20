import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAgents } from './useAgents';
import type { Agent } from '../types/agent';
import type { TriggerDraft } from '../types/trigger';

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-3.1-flash-lite',
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

afterEach(() => vi.unstubAllGlobals());

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

describe('useAgents explicit save', () => {
  it('sends exactly the submitted patch and updates shared state after success', async () => {
    const fetchMock = stubApi({ patch: () => json({ ...agent, name: 'Renamed' }) });
    const { result } = await loaded();

    let outcome: Awaited<ReturnType<typeof result.current.saveAgent>> | undefined;
    await act(async () => {
      outcome = await result.current.saveAgent(agent.id, { name: 'Renamed' });
    });

    expect(outcome).toEqual({ ok: true, agent: { ...agent, name: 'Renamed' } });
    expect(JSON.parse(String(patchCalls(fetchMock)[0]![1]!.body))).toEqual({ name: 'Renamed' });
    expect(result.current.agents[0]?.name).toBe('Renamed');
  });

  it('returns a readable failure and leaves shared state unchanged', async () => {
    stubApi({
      patch: () => json({ error: { code: 'bad_request', message: 'Unknown model.' } }, 400),
    });
    const { result } = await loaded();

    let outcome: Awaited<ReturnType<typeof result.current.saveAgent>> | undefined;
    await act(async () => {
      outcome = await result.current.saveAgent(agent.id, { model: 'bad-model' });
    });

    expect(outcome).toEqual({ ok: false, message: 'Unknown model.' });
    expect(result.current.agents[0]).toEqual(agent);
  });
});

describe('useAgents create, duplicate, delete', () => {
  it('posts the draft as written and prepends the created agent', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    await act(async () => {
      await result.current.saveDraft({
        name: 'Billing Bot',
        icon: '🧩',
        description: 'Handles invoices.',
        model: 'gemini-3.1-flash-lite',
        systemPrompt: 'Be terse.',
        toolIds: ['current_time'],
        status: 'draft',
      });
    });

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post![1]!.body))).toMatchObject({
      name: 'Billing Bot',
      description: 'Handles invoices.',
      systemPrompt: 'Be terse.',
      toolIds: ['current_time'],
    });
    expect(result.current.agents[0]!.id).toBe('agent_new');
    expect(result.current.agents).toHaveLength(2);
  });

  it('binds staged triggers to the new agent before exposing the saved agent', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();
    const trigger: TriggerDraft = {
      agentId: '',
      kind: 'interval',
      intervalMinutes: 15,
      message: 'Run the timer task.',
      timezone: 'Asia/Ho_Chi_Minh',
      enabled: true,
    };

    await act(async () => {
      await result.current.saveDraft(
        {
          name: 'Timer',
          icon: agent.icon,
          description: '',
          model: 'gemini-3.1-flash-lite',
          systemPrompt: 'Respond after an interval.',
          toolIds: ['current_time'],
          status: 'draft',
        },
        [trigger],
      );
    });

    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(String(posts[0]![0])).toContain('/api/agents');
    expect(String(posts[1]![0])).toContain('/api/triggers');
    expect(JSON.parse(String(posts[1]![1]!.body))).toMatchObject({
      agentId: 'agent_new',
      kind: 'interval',
      intervalMinutes: 15,
    });
    expect(result.current.agents[0]?.id).toBe('agent_new');
  });

  it('rolls the new agent back when a staged trigger cannot be created', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return json([agent]);
      if (method === 'DELETE') return new Response(null, { status: 204 });
      if (String(url).includes('/api/triggers')) {
        return json({ error: { code: 'bad_request', message: 'Invalid schedule.' } }, 400);
      }
      return json({ ...agent, id: 'agent_new', name: 'Timer' }, 201);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = await loaded();
    let saved: Agent | null = agent;

    await act(async () => {
      saved = await result.current.saveDraft(
        {
          name: 'Timer',
          icon: agent.icon,
          description: '',
          model: 'gemini-3.1-flash-lite',
          systemPrompt: 'Respond after an interval.',
          toolIds: ['current_time'],
          status: 'draft',
        },
        [{ agentId: '', kind: 'interval', intervalMinutes: 0, message: 'Run.' }],
      );
    });

    expect(saved).toBeNull();
    const deletes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(String(deletes[0]![0])).toContain('/api/agents/agent_new');
    expect(result.current.agents).toEqual([agent]);
    expect(result.current).toHaveProperty(
      'operationError.message',
      'Invalid schedule. Nothing was saved; you can retry.',
    );
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

  it('reports a failed draft save without turning it into an autosave error', async () => {
    let postAttempt = 0;
    const draft = {
      name: 'New agent',
      icon: '🧩',
      description: '',
      model: 'gemini-3.1-flash-lite',
      systemPrompt: '',
      toolIds: [],
      status: 'draft' as const,
    };
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
      await result.current.saveDraft(draft);
    });
    expect(result.current).toHaveProperty('operationError.kind', 'create');
    expect(result.current).toHaveProperty('operationError.message', 'Create failed.');
    expect(result.current.agents).toHaveLength(1);

    // Retrying a create is saving the still-open draft again, not a hook-level
    // replay: retryOperation deliberately declines it.
    await act(async () => {
      expect(await result.current.retryOperation()).toBeNull();
    });
    await act(async () => {
      await result.current.saveDraft(draft);
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
