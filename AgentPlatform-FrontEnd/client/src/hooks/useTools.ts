import { useEffect, useState } from 'react';
import { ApiError, apiGet } from '../lib/api-client';
import type { Tool } from '../types/tool';

/** The registry does not change while the app runs, so one fetch is enough. */
let cache: Tool[] | null = null;

export const toolLabel = (tools: readonly Tool[], toolId: string): string =>
  tools.find((tool) => tool.id === toolId)?.label ?? toolId;

export const useTools = () => {
  const [tools, setTools] = useState<Tool[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache !== null) return;
    let active = true;

    apiGet<Tool[]>('/api/tools')
      .then((fetched) => {
        cache = fetched;
        if (active) setTools(fetched);
      })
      .catch((thrown: unknown) => {
        if (active) {
          setError(
            thrown instanceof ApiError ? thrown.message : 'Could not load the tool registry.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { tools, loading, error };
};

/** Tests only: drops the module cache between cases. */
export const resetToolCache = () => {
  cache = null;
};
