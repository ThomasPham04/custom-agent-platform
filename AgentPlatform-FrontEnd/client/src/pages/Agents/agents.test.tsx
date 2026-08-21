import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import AgentsPage from './index';
import { ToastProvider } from '../../components/ui/toast';
import type { Agent } from '../../types/agent';

vi.mock('../../hooks/useTools', () => ({
  useTools: () => ({ tools: [], loading: false, error: null }),
  toolLabel: (_tools: unknown, toolId: string) => toolId,
}));

const created: Agent = {
  id: 'agent_new',
  name: 'New agent',
  icon: '🧩',
  description: '',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be terse.',
  toolIds: [],
  status: 'draft',
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
};

const agentsApi = vi.hoisted(() => ({
  current: {
    agents: [] as Agent[],
    loading: false,
    error: null as string | null,
    operationError: null,
    creating: false,
    saveDraft: vi.fn(),
    duplicateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    saveAgent: vi.fn(),
    retryOperation: vi.fn(),
    reload: vi.fn(),
  },
}));
vi.mock('../../hooks/useAgents', () => ({ useAgentsContext: () => agentsApi.current }));

const renderDraft = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/agents/new']}>
        <Routes>
          <Route path="/agents/new" element={<AgentsPage />} />
          <Route path="/agents/:agentId" element={<AgentsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

beforeEach(() => {
  agentsApi.current.saveDraft = vi.fn(async () => created);
});

describe('AgentsPage draft validation', () => {
  it('marks name, status, model and system prompt as required', () => {
    renderDraft();
    expect(screen.getByLabelText('Agent name')).toBeRequired();
    expect(screen.getByLabelText('Status')).toBeRequired();
    expect(screen.getByLabelText('Model')).toBeRequired();
    expect(screen.getByLabelText('System prompt')).toBeRequired();
  });

  it('refuses to save a draft whose system prompt is still blank', async () => {
    const user = userEvent.setup();
    renderDraft();

    await user.click(screen.getByRole('button', { name: 'Save agent' }));

    expect(agentsApi.current.saveDraft).not.toHaveBeenCalled();
    expect(screen.getByText('System prompt is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('System prompt')).toHaveAttribute('aria-invalid', 'true');
  });

  it('reports a cleared name, and clears the message once it is retyped', async () => {
    const user = userEvent.setup();
    renderDraft();

    await user.clear(screen.getByLabelText('Agent name'));
    await user.type(screen.getByLabelText('System prompt'), 'Be terse.');
    await user.click(screen.getByRole('button', { name: 'Save agent' }));

    expect(agentsApi.current.saveDraft).not.toHaveBeenCalled();
    expect(screen.getByText('Name is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Agent name'), 'Support Bot');
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument();
  });

  it('saves once every mandatory field is filled', async () => {
    const user = userEvent.setup();
    renderDraft();

    await user.type(screen.getByLabelText('System prompt'), 'Be terse.');
    await user.click(screen.getByRole('button', { name: 'Save agent' }));

    await waitFor(() =>
      expect(agentsApi.current.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New agent', systemPrompt: 'Be terse.' }),
        [],
      ),
    );
  });
});
