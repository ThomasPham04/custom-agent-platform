import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentTriggers } from './agent-triggers';
import type { Trigger } from '../../../types/trigger';

const trigger = (overrides: Partial<Trigger> = {}): Trigger => ({
  id: 'trg_1',
  agentId: 'agent_support',
  name: 'Support check',
  message: 'Check support.',
  kind: 'daily',
  intervalMinutes: null,
  timeOfDay: '09:00',
  weekdays: [0, 1, 2, 3, 4],
  timezone: 'UTC',
  enabled: true,
  nextRunAt: '2026-08-21T09:00:00Z',
  lastRunAt: null,
  lastStatus: null,
  lastRunId: null,
  createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z',
  ...overrides,
});

const triggerHook = vi.hoisted(() => ({
  current: {
    triggers: [] as Trigger[],
    loading: false,
    error: undefined as string | undefined,
    create: vi.fn(),
    save: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn(),
    fireNow: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('../../../hooks/useTriggers', () => ({
  useTriggers: () => triggerHook.current,
}));

vi.mock('../../triggers-section/trigger-activity/trigger-activity', () => ({
  TriggerActivity: ({ triggerId, refreshToken }: { triggerId: string; refreshToken: number }) => (
    <output data-testid="activity">
      {triggerId}:{refreshToken}
    </output>
  ),
}));

beforeEach(() => {
  triggerHook.current = {
    triggers: [trigger()],
    loading: false,
    error: undefined,
    create: vi.fn().mockResolvedValue({ ok: true, trigger: trigger() }),
    save: vi.fn().mockResolvedValue({ ok: true, trigger: trigger() }),
    toggle: vi.fn().mockResolvedValue({ ok: true, trigger: trigger() }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    fireNow: vi.fn().mockResolvedValue({ ok: true, run: { id: 'run_1' } }),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
});

describe('AgentTriggers', () => {
  it('lists configured schedules and toggles one', async () => {
    render(<AgentTriggers agentId="agent_support" />);

    expect(screen.getByText('1 configured')).toBeInTheDocument();
    expect(screen.getByText('Daily at 09:00 - Mon to Fri - UTC')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Disable Support check' }));
    expect(triggerHook.current.toggle).toHaveBeenCalledWith('trg_1', false);
  });

  it('opens an existing trigger and runs it immediately', async () => {
    let finishRun: (result: { ok: true; run: { id: string } }) => void = () => {};
    triggerHook.current.fireNow.mockImplementation(
      () => new Promise((resolve) => (finishRun = resolve)),
    );
    render(<AgentTriggers agentId="agent_support" />);

    await userEvent.click(screen.getByText('Daily at 09:00 - Mon to Fri - UTC'));
    expect(screen.getByRole('region', { name: 'Trigger settings' })).toBeInTheDocument();
    expect(screen.getByTestId('activity')).toHaveTextContent('trg_1:0');

    await userEvent.click(screen.getByRole('button', { name: 'Run now' }));
    expect(screen.getByRole('button', { name: /Running/ })).toBeDisabled();
    expect(triggerHook.current.fireNow).toHaveBeenCalledWith('trg_1');

    finishRun({ ok: true, run: { id: 'run_1' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled());
    expect(screen.getByTestId('activity')).toHaveTextContent('trg_1:1');
  });

  it('sends only the changed schedule fields when saving an edit', async () => {
    render(<AgentTriggers agentId="agent_support" />);
    await userEvent.click(screen.getByText('Daily at 09:00 - Mon to Fri - UTC'));

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Repeats' }),
      'interval',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save trigger' }));

    expect(triggerHook.current.save).toHaveBeenCalledWith('trg_1', {
      kind: 'interval',
      intervalMinutes: 60,
    });
  });

  it('creates a new trigger from the editor', async () => {
    triggerHook.current.triggers = [];
    render(<AgentTriggers agentId="agent_support" />);

    expect(screen.getByText('No schedules yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add trigger' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save trigger' }));

    expect(triggerHook.current.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent_support',
        kind: 'daily',
        message: 'Perform the scheduled task described in your system prompt.',
        timeOfDay: '09:00',
      }),
    );
  });

  it('keeps a failed manual run visible in the editor', async () => {
    triggerHook.current.fireNow.mockResolvedValue({ ok: false, message: 'Provider down.' });
    render(<AgentTriggers agentId="agent_support" />);

    await userEvent.click(screen.getByText('Daily at 09:00 - Mon to Fri - UTC'));
    await userEvent.click(screen.getByRole('button', { name: 'Run now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Provider down.');
    expect(screen.getByTestId('activity')).toHaveTextContent('trg_1:0');
  });
});
