import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Agent } from './types/agent';

const viewport = vi.hoisted(() => ({ narrow: false }));

vi.mock('./hooks/useMediaQuery', () => ({
  BREAKPOINT_SIDEBAR: '(max-width: 900px)',
  BREAKPOINT_SHEET: '(max-width: 700px)',
  useMediaQuery: () => viewport.narrow,
}));

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: 'A',
  description: '',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: '',
  toolIds: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  viewport.narrow = false;
  window.history.pushState({}, '', '/agents');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/health')) return json({ status: 'ok', mode: 'mock' });
      if (url.includes('/api/tools')) return json([]);
      // Sessions are a distinct shape; the catch-all below would serve agents here.
      if (url.includes('/api/sessions')) return json([]);
      return json([agent]);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('mobile application drawer', () => {
  it('keeps the closed drawer inert and makes the open drawer modal with focus restoration', async () => {
    viewport.narrow = true;
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    const drawer = document.querySelector<HTMLElement>('nav[aria-label="Workspace"]');
    expect(drawer).not.toBeNull();
    const workspace = document.getElementById('workspace-content');
    const opener = screen.getByRole('button', { name: 'Open sidebar' });
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('inert');

    await userEvent.click(opener);
    expect(drawer).not.toHaveAttribute('aria-hidden');
    expect(workspace).toHaveAttribute('aria-hidden', 'true');
    expect(workspace).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Agent Platform' })).toHaveFocus();

    workspace?.focus();
    await userEvent.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Agent Platform' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(drawer).toHaveAttribute('aria-hidden', 'true'));
    expect(workspace).not.toHaveAttribute('inert');
    expect(opener).toHaveFocus();
  });
});

describe('agent page actions', () => {
  it('clears the page filter from the empty state', async () => {
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    const filter = screen.getByRole('searchbox', { name: 'Filter agents' });
    await userEvent.type(filter, 'no match');
    expect(await screen.findByText(/No agents match/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(filter).toHaveValue('');
    expect(screen.getByRole('row', { name: /Support Bot/ })).toBeInTheDocument();
  });

  it('focuses and selects the new agent name when creation opens the draft', async () => {
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    const name = await screen.findByRole('textbox', { name: 'Agent name' });
    expect(name).toHaveFocus();
    expect(name).toHaveProperty('selectionStart', 0);
    expect(name).toHaveProperty('selectionEnd', 'New agent'.length);
  });
});

describe('new agent draft', () => {
  const created = { ...agent, id: 'agent_new', name: 'Billing Bot' };

  const stubApi = (onPost: (body: unknown) => Response) => {
    const calls: { method: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/health')) return json({ status: 'ok', mode: 'mock' });
        if (url.includes('/api/tools')) return json([]);
        // Sessions are a distinct shape; the catch-all below would serve agents here.
        if (url.includes('/api/sessions')) return json([]);
        const method = init?.method ?? 'GET';
        if (method !== 'GET') {
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          calls.push({ method, body });
          if (method === 'POST') return onPost(body);
        }
        return json([agent]);
      }),
    );
    return calls;
  };

  it('writes nothing to the server until Save', async () => {
    const calls = stubApi(() => json(created, 201));
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Agent name' }), '!');

    expect(calls).toEqual([]);
  });

  it('keeps the draft out of the list while it is being typed', async () => {
    stubApi(() => json(created, 201));
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    const name = screen.getByRole('textbox', { name: 'Agent name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Billing Bot');

    expect(screen.queryByRole('row', { name: /Billing Bot/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 agent')).toBeInTheDocument();
  });

  it('posts the whole draft once, then shows it in the list', async () => {
    const calls = stubApi(() => json(created, 201));
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    const name = screen.getByRole('textbox', { name: 'Agent name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Billing Bot');
    await userEvent.click(screen.getByRole('button', { name: 'Save agent' }));

    await waitFor(() => expect(screen.getByRole('row', { name: /Billing Bot/ })).toBeInTheDocument());
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toMatchObject({
      name: 'Billing Bot',
      status: 'draft',
      toolIds: [],
      systemPrompt: '',
    });
  });

  it('discards everything when the draft is closed unsaved', async () => {
    const calls = stubApi(() => json(created, 201));
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    const name = screen.getByRole('textbox', { name: 'Agent name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Billing Bot');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(calls).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Billing Bot/)).not.toBeInTheDocument();

    // Reopening starts clean rather than resuming the abandoned draft.
    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    expect(screen.getByRole('textbox', { name: 'Agent name' })).toHaveValue('New agent');
  });

  it('keeps the draft open and retryable when the save fails', async () => {
    let attempts = 0;
    stubApi(() => {
      attempts += 1;
      return attempts === 1
        ? json({ error: { code: 'internal_error', message: 'Create failed.' } }, 500)
        : json(created, 201);
    });
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    const name = screen.getByRole('textbox', { name: 'Agent name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Billing Bot');
    await userEvent.click(screen.getByRole('button', { name: 'Save agent' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Create failed.');
    expect(screen.getByRole('textbox', { name: 'Agent name' })).toHaveValue('Billing Bot');

    await userEvent.click(screen.getByRole('button', { name: 'Save agent' }));
    await waitFor(() => expect(screen.getByRole('row', { name: /Billing Bot/ })).toBeInTheDocument());
    expect(attempts).toBe(2);
  });
});

describe('existing agent manual save', () => {
  const tool = {
    id: 'current_time',
    label: 'Current time',
    description: 'Reads the time.',
    params: [],
  };

  const stubSavedAgentApi = (
    onPatch: (body: Record<string, unknown>) => Response | Promise<Response> = (body) =>
      json({ ...agent, ...body, updatedAt: '2026-08-17T10:00:00.000Z' }),
    listedAgents: Agent[] = [agent],
  ) => {
    const calls: { method: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/health')) return json({ status: 'ok', mode: 'mock' });
        if (url.includes('/api/tools')) return json([tool]);
        if (url.includes('/api/sessions')) return json([]);
        const method = init?.method ?? 'GET';
        if (method === 'PATCH') {
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          calls.push({ method, body });
          return onPatch(body);
        }
        return json(listedAgents);
      }),
    );
    return calls;
  };

  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  const openSavedAgent = async () => {
    window.history.pushState({}, '', `/agents/${agent.id}`);
    render(<App />);
    return screen.findByRole('textbox', { name: 'Agent name' });
  };

  it('does not patch while editing and saves one merged patch on demand', async () => {
    const calls = stubSavedAgentApi();
    const name = await openSavedAgent();
    const description = screen.getByRole('textbox', { name: 'Description' });

    await userEvent.clear(name);
    await userEvent.type(name, 'Renamed');
    await userEvent.type(description, 'Updated description');

    expect(calls).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      method: 'PATCH',
      body: { name: 'Renamed', description: 'Updated description' },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('discards unsaved edits when the panel closes', async () => {
    const calls = stubSavedAgentApi();
    const name = await openSavedAgent();

    await userEvent.clear(name);
    await userEvent.type(name, 'Discard me');
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    await userEvent.click(screen.getByRole('row', { name: /Support Bot/ }));

    expect(screen.getByRole('textbox', { name: 'Agent name' })).toHaveValue('Support Bot');
    expect(calls).toEqual([]);
  });

  it('disables Save again when a value is restored to the baseline', async () => {
    stubSavedAgentApi();
    const name = await openSavedAgent();

    await userEvent.type(name, '!');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await userEvent.clear(name);
    await userEvent.type(name, agent.name);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('retains the local draft and permits retry after a failed save', async () => {
    let attempt = 0;
    const calls = stubSavedAgentApi((body) => {
      attempt += 1;
      return attempt === 1
        ? json({ error: { code: 'internal_error', message: 'Save failed.' } }, 500)
        : json({ ...agent, ...body });
    });
    const name = await openSavedAgent();

    await userEvent.type(name, '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed.');
    expect(name).toHaveValue('Support Bot!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('keeps edits made while Save is in flight dirty after the response', async () => {
    const pending = deferred<Response>();
    stubSavedAgentApi(() => pending.promise);
    const name = await openSavedAgent();

    await userEvent.clear(name);
    await userEvent.type(name, 'First');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await userEvent.clear(name);
    await userEvent.type(name, 'Second');
    pending.resolve(json({ ...agent, name: 'First' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled(),
    );
    expect(name).toHaveValue('Second');
  });

  it('discards one agent draft when another agent is selected', async () => {
    const other = { ...agent, id: 'agent_research', name: 'Research Assistant' };
    stubSavedAgentApi(undefined, [agent, other]);
    const name = await openSavedAgent();

    await userEvent.type(name, '!');
    await userEvent.click(screen.getByRole('row', { name: /Research Assistant/ }));
    await userEvent.click(screen.getByRole('row', { name: /Support Bot/ }));

    expect(screen.getByRole('textbox', { name: 'Agent name' })).toHaveValue('Support Bot');
  });
});
