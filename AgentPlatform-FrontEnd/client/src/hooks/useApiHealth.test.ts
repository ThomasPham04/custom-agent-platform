import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { HEALTH_POLL_MS, useApiHealth } from './useApiHealth';

afterEach(() => vi.unstubAllGlobals());

describe('useApiHealth', () => {
  it('starts as checking and settles online', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'ok', mode: 'mock' }), { status: 200 }),
      ),
    );

    const { result } = renderHook(() => useApiHealth(0));
    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).toBe('online'));
  });

  it('settles offline when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const { result } = renderHook(() => useApiHealth(0));
    await waitFor(() => expect(result.current.status).toBe('offline'));
  });

  it('reports the mode the API returned rather than assuming one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 'ok', mode: 'live' }), { status: 200 }),
      ),
    );

    const { result } = renderHook(() => useApiHealth(0));
    await waitFor(() => expect(result.current.mode).toBe('live'));
  });

  it('forgets the mode once the API goes offline', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok', mode: 'live' }), { status: 200 }),
      )
      .mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ interval }) => useApiHealth(interval), {
      initialProps: { interval: 0 },
    });
    await waitFor(() => expect(result.current.mode).toBe('live'));

    // A changed interval restarts the effect, which re-checks immediately.
    rerender({ interval: 1 });
    await waitFor(() => expect(result.current.status).toBe('offline'));
    expect(result.current.mode).toBeNull();
  });

  it('polls every five minutes by default', () => {
    expect(HEALTH_POLL_MS).toBe(5 * 60 * 1000);
  });
});
