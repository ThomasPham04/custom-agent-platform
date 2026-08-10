import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiHealth } from './useApiHealth';

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
    expect(result.current).toBe('checking');
    await waitFor(() => expect(result.current).toBe('online'));
  });

  it('settles offline when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const { result } = renderHook(() => useApiHealth(0));
    await waitFor(() => expect(result.current).toBe('offline'));
  });
});
