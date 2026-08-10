import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api-client';

export type ApiHealth = 'checking' | 'online' | 'offline';

// Leave headroom for the failed request and React render so the UI changes
// within the 15-second availability target even in the worst polling phase.
const DEFAULT_INTERVAL_MS = 10_000;

/** Drives the sidebar status pill. Pass intervalMs 0 to check exactly once. */
export const useApiHealth = (intervalMs: number = DEFAULT_INTERVAL_MS): ApiHealth => {
  const [health, setHealth] = useState<ApiHealth>('checking');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        await apiGet<{ status: string }>('/api/health');
        if (active) setHealth('online');
      } catch {
        if (active) setHealth('offline');
      }
      if (active && intervalMs > 0) timer = setTimeout(check, intervalMs);
    };

    void check();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return health;
};
