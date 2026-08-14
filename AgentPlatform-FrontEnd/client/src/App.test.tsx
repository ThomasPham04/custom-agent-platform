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
  it('clears the active sidebar search when the empty state clears its filter', async () => {
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    const search = screen.getByRole('searchbox', { name: 'Search agents' });
    await userEvent.type(search, 'no match');
    expect(await screen.findByText(/No agents match/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('row', { name: /Support Bot/ })).toBeInTheDocument();
  });

  it('focuses and selects the new agent name when creation opens the peek', async () => {
    const created = { ...agent, id: 'agent_new', name: 'New agent' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/health')) return json({ status: 'ok', mode: 'mock' });
        if (url.includes('/api/tools')) return json([]);
        if (init?.method === 'POST') return json(created, 201);
        return json([agent]);
      }),
    );
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    const name = await screen.findByRole('textbox', { name: 'Agent name' });
    expect(name).toHaveFocus();
    expect(name).toHaveProperty('selectionStart', 0);
    expect(name).toHaveProperty('selectionEnd', 'New agent'.length);
  });

  it('surfaces a failed create separately and retries that operation', async () => {
    let postAttempts = 0;
    const created = { ...agent, id: 'agent_new', name: 'New agent' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/health')) return json({ status: 'ok', mode: 'mock' });
        if (url.includes('/api/tools')) return json([]);
        if (init?.method === 'POST') {
          postAttempts += 1;
          return postAttempts === 1
            ? json({ error: { code: 'internal_error', message: 'Create failed.' } }, 500)
            : json(created, 201);
        }
        return json([agent]);
      }),
    );
    render(<App />);
    await screen.findByRole('table', { name: 'Agents' });

    await userEvent.click(screen.getByRole('button', { name: 'New agent' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Create failed.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(postAttempts).toBe(2);
    expect(await screen.findByRole('dialog', { name: 'Agent New agent' })).toBeInTheDocument();
  });
});
