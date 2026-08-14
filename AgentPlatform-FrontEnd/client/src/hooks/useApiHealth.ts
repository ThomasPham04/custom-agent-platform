import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api-client';

export type ApiHealthStatus = 'checking' | 'online' | 'offline';

/** Which provider the API is running: `mock` fixtures or a live model. */
export type ApiMode = 'mock' | 'live';

export interface ApiHealth {
  status: ApiHealthStatus;
  /** Null until a check succeeds, and again once the API goes offline. */
  mode: ApiMode | null;
}

/**
 * Five minutes. The footer reports which mode the API is in, not whether a
 * request is about to succeed — the request itself already reports that. Polling
 * every ten seconds bought no useful freshness and cost a request per user per
 * ten seconds for the life of the tab.
 */
export const HEALTH_POLL_MS = 5 * 60 * 1000;

const CHECKING: ApiHealth = { status: 'checking', mode: null };
const OFFLINE: ApiHealth = { status: 'offline', mode: null };

/** Drives the sidebar status pill. Pass intervalMs 0 to check exactly once. */
export const useApiHealth = (intervalMs: number = HEALTH_POLL_MS): ApiHealth => {
  const [health, setHealth] = useState<ApiHealth>(CHECKING);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        const body = await apiGet<{ status: string; mode?: string }>('/api/health');
        if (active) {
          setHealth({ status: 'online', mode: body.mode === 'live' ? 'live' : 'mock' });
        }
      } catch {
        if (active) setHealth(OFFLINE);
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
