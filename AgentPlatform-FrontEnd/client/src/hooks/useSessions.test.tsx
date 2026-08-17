/**
 * Rename and delete apply optimistically and roll back on failure, the contract
 * useAgents already honours. No save queue: a rename is one explicit action,
 * not debounced autosave.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionsProvider, useSessionsContext } from './useSessions';
import * as api from '../lib/api-client';

const session = (id: string, title: string) => ({
  id,
  agentId: 'agent_support',
  title,
  createdAt: '2026-08-16T09:00:00Z',
  updatedAt: '2026-08-16T09:00:00Z',
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionsProvider>{children}</SessionsProvider>
);

describe('useSessions', () => {
  it('lists sessions on mount', async () => {
    vi.spyOn(api, 'listSessions').mockResolvedValue([session('sess_1', 'Refunds')]);
    const { result } = renderHook(() => useSessionsContext(), { wrapper });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
  });

  it('applies a rename before the server answers', async () => {
    vi.spyOn(api, 'listSessions').mockResolvedValue([session('sess_1', 'Refunds')]);
    vi.spyOn(api, 'renameSession').mockImplementation(
      () => new Promise(() => {}), // never settles
    );
    const { result } = renderHook(() => useSessionsContext(), { wrapper });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    act(() => void result.current.rename('sess_1', 'Billing'));
    expect(result.current.sessions[0]!.title).toBe('Billing');
  });

  it('rolls a failed rename back to the confirmed title', async () => {
    // Two distinct listSessions answers: the mount fetch, and what a refetch
    // would return if the hook (wrongly) rolled back by refetching instead
    // of restoring from its own confirmed state. If rollback ever called
    // listSessions again, the title below would read "Refetched", not
    // "Refunds" — that's what makes this test able to catch a refetch-based
    // implementation instead of passing it identically.
    const listSpy = vi.spyOn(api, 'listSessions');
    listSpy.mockResolvedValueOnce([session('sess_1', 'Refunds')]);
    listSpy.mockResolvedValueOnce([session('sess_1', 'Refetched')]);
    vi.spyOn(api, 'renameSession').mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useSessionsContext(), { wrapper });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    await act(async () => {
      await result.current.rename('sess_1', 'Billing').catch(() => {});
    });
    expect(result.current.sessions[0]!.title).toBe('Refunds');
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the second rename when it resolves before the first', async () => {
    vi.spyOn(api, 'listSessions').mockResolvedValue([session('sess_1', 'Refunds')]);
    let resolveFirst: (value: ReturnType<typeof session>) => void = () => {};
    let resolveSecond: (value: ReturnType<typeof session>) => void = () => {};
    vi.spyOn(api, 'renameSession')
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    const { result } = renderHook(() => useSessionsContext(), { wrapper });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    let firstDone: Promise<void> = Promise.resolve();
    let secondDone: Promise<void> = Promise.resolve();
    act(() => {
      firstDone = result.current.rename('sess_1', 'A');
    });
    act(() => {
      secondDone = result.current.rename('sess_1', 'B');
    });

    // The second rename's response lands first.
    await act(async () => {
      resolveSecond(session('sess_1', 'B'));
      await secondDone;
    });
    expect(result.current.sessions[0]!.title).toBe('B');

    // The first (now superseded) rename's response lands after. It must not
    // overwrite the confirmed second title.
    await act(async () => {
      resolveFirst(session('sess_1', 'A'));
      await firstDone;
    });
    expect(result.current.sessions[0]!.title).toBe('B');
  });

  it('removes a session optimistically and restores it on failure', async () => {
    vi.spyOn(api, 'listSessions').mockResolvedValue([session('sess_1', 'Refunds')]);
    vi.spyOn(api, 'deleteSession').mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useSessionsContext(), { wrapper });
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    await act(async () => {
      await result.current.remove('sess_1').catch(() => {});
    });
    expect(result.current.sessions).toHaveLength(1);
  });
});
