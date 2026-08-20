import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTriggers } from './useTriggers';
import * as api from '../lib/api-client';
import type { Run } from '../types/run';
import type { Trigger } from '../types/trigger';

const trigger = (overrides: Partial<Trigger> = {}): Trigger => ({
  id: 'trg_1',
  agentId: 'agent_support',
  name: 'Support check',
  message: 'Check support.',
  kind: 'interval',
  intervalMinutes: 15,
  timeOfDay: null,
  weekdays: [],
  timezone: 'UTC',
  enabled: true,
  nextRunAt: '2026-08-20T12:15:00Z',
  lastRunAt: null,
  lastStatus: null,
  lastRunId: null,
  createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z',
  ...overrides,
});

const run: Run = {
  id: 'run_1',
  agentId: 'agent_support',
  agentName: 'Support Bot',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Help.',
  userMessage: 'Check support.',
  answer: 'Done.',
  status: 'done',
  error: null,
  latencyMs: 10,
  sessionId: null,
  triggerId: 'trg_1',
  createdAt: '2026-08-20T12:00:00Z',
  toolCalls: [],
};

const loaded = async () => {
  const view = renderHook(() => useTriggers('agent_support'));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
};

afterEach(() => vi.restoreAllMocks());

describe('useTriggers', () => {
  it('loads the selected agents triggers', async () => {
    const list = vi.spyOn(api, 'listTriggers').mockResolvedValue([trigger()]);
    const { result } = await loaded();

    expect(list).toHaveBeenCalledWith('agent_support');
    expect(result.current.triggers).toEqual([trigger()]);
    expect(result.current.error).toBeUndefined();
  });

  it('surfaces API load errors and keeps an empty list', async () => {
    vi.spyOn(api, 'listTriggers').mockRejectedValue(
      new api.ApiError(500, 'internal_error', 'Trigger store is unavailable.'),
    );
    const { result } = await loaded();

    expect(result.current.error).toBe('Trigger store is unavailable.');
    expect(result.current.triggers).toEqual([]);
  });

  it('prepends a successfully created trigger', async () => {
    vi.spyOn(api, 'listTriggers').mockResolvedValue([]);
    vi.spyOn(api, 'createTrigger').mockResolvedValue(trigger());
    const { result } = await loaded();

    await act(async () => {
      expect(
        await result.current.create({
          agentId: 'agent_support',
          kind: 'interval',
          intervalMinutes: 15,
          message: 'Check support.',
        }),
      ).toEqual({ ok: true, trigger: trigger() });
    });
    expect(result.current.triggers).toEqual([trigger()]);
  });

  it('moves the enabled switch immediately and rolls back a rejected update', async () => {
    vi.spyOn(api, 'listTriggers').mockResolvedValue([trigger()]);
    let rejectUpdate: (reason: unknown) => void = () => {};
    const update = vi.spyOn(api, 'updateTrigger').mockImplementation(
      () => new Promise((_resolve, reject) => (rejectUpdate = reject)),
    );
    const { result } = await loaded();

    let pending: ReturnType<typeof result.current.toggle> = Promise.resolve({
      ok: true,
      trigger: trigger(),
    });
    act(() => {
      pending = result.current.toggle('trg_1', false);
    });
    expect(result.current.triggers[0]?.enabled).toBe(false);
    await waitFor(() => expect(update).toHaveBeenCalledWith('trg_1', { enabled: false }));

    await act(async () => {
      rejectUpdate(new api.ApiError(500, 'internal_error', 'Could not update.'));
      expect(await pending).toEqual({ ok: false, message: 'Could not update.' });
    });
    expect(result.current.triggers[0]?.enabled).toBe(true);
  });

  it('removes optimistically and treats an already-deleted trigger as success', async () => {
    vi.spyOn(api, 'listTriggers').mockResolvedValue([trigger()]);
    vi.spyOn(api, 'deleteTrigger').mockRejectedValue(
      new api.ApiError(404, 'not_found', 'Already gone.'),
    );
    const { result } = await loaded();

    await act(async () => {
      expect(await result.current.remove('trg_1')).toEqual({ ok: true });
    });
    expect(result.current.triggers).toEqual([]);
  });

  it('runs now and refreshes server-owned activity fields', async () => {
    const refreshed = trigger({
      lastRunAt: '2026-08-20T12:01:00Z',
      lastStatus: 'done',
      lastRunId: 'run_1',
    });
    vi.spyOn(api, 'listTriggers')
      .mockResolvedValueOnce([trigger()])
      .mockResolvedValueOnce([refreshed]);
    const fire = vi.spyOn(api, 'runTriggerNow').mockResolvedValue(run);
    const { result } = await loaded();

    await act(async () => {
      expect(await result.current.fireNow('trg_1')).toEqual({ ok: true, run });
    });

    expect(fire).toHaveBeenCalledWith('trg_1');
    expect(result.current.triggers[0]).toEqual(refreshed);
  });
});
