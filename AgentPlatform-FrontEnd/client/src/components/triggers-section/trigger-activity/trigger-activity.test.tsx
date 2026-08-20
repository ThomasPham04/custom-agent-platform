import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TriggerActivity } from './trigger-activity';
import * as api from '../../../lib/api-client';
import type { Run } from '../../../types/run';

const run = (overrides: Partial<Run> = {}): Run => ({
  id: 'run_1',
  agentId: 'agent_support',
  agentName: 'Support Bot',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Help.',
  userMessage: 'Check support.',
  answer: 'Queue is clear.',
  status: 'done',
  error: null,
  latencyMs: 10,
  sessionId: null,
  triggerId: 'trg_1',
  createdAt: '2026-08-20T12:00:00Z',
  toolCalls: [],
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('TriggerActivity', () => {
  it('shows loading, then completed and failed runs', async () => {
    let resolveRuns: (runs: Run[]) => void = () => {};
    vi.spyOn(api, 'listRunsByTrigger').mockImplementation(
      () => new Promise((resolve) => (resolveRuns = resolve)),
    );
    render(<TriggerActivity triggerId="trg_1" refreshToken={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading activity');

    resolveRuns([
      run(),
      run({ id: 'run_2', status: 'error', answer: '', error: 'Provider unavailable.' }),
    ]);

    expect(await screen.findByText('Queue is clear.')).toBeInTheDocument();
    expect(screen.getByText('Provider unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Trigger activity' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('shows a useful empty state', async () => {
    vi.spyOn(api, 'listRunsByTrigger').mockResolvedValue([]);
    render(<TriggerActivity triggerId="trg_1" refreshToken={0} />);
    expect(await screen.findByText('No runs yet. Use Run now to try it.')).toBeInTheDocument();
  });

  it('shows the API error message', async () => {
    vi.spyOn(api, 'listRunsByTrigger').mockRejectedValue(
      new api.ApiError(500, 'internal_error', 'Could not read activity.'),
    );
    render(<TriggerActivity triggerId="trg_1" refreshToken={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read activity.');
  });

  it('refetches when a manual run bumps the refresh token', async () => {
    const list = vi
      .spyOn(api, 'listRunsByTrigger')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([run()]);
    const { rerender } = render(<TriggerActivity triggerId="trg_1" refreshToken={0} />);
    await screen.findByText('No runs yet. Use Run now to try it.');

    rerender(<TriggerActivity triggerId="trg_1" refreshToken={1} />);
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Queue is clear.')).toBeInTheDocument();
  });
});
