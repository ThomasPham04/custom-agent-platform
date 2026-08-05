import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import type { Agent, AgentPatch } from '../types/agent';

export const AUTOSAVE_DELAY_MS = 600;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

interface PendingSave {
  agentId: string;
  patch: AgentPatch;
  /** The server-confirmed agent to restore if the write fails. */
  rollbackTo: Agent;
}

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const pending = useRef<PendingSave | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  // Read through a function so TypeScript does not preserve the `null`
  // narrowing across an await while another callback can update this ref.
  const readPending = () => pending.current;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await apiGet<Agent[]>('/api/agents');
      if (!mounted.current) return;
      setAgents(fetched);
      setError(null);
    } catch (thrown) {
      if (!mounted.current) return;
      setError(messageOf(thrown, 'Could not load agents.'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Sends whatever is pending. Rolls the optimistic edit back on failure. */
  const send = useCallback(async () => {
    const save = pending.current;
    if (!save) return;

    // Claim the patch up front. Edits made while this request is in flight
    // start a fresh pending entry rather than joining a batch already sent.
    pending.current = null;
    setSaveState({ kind: 'saving' });

    try {
      const updated = await apiPatch<Agent>(`/api/agents/${save.agentId}`, save.patch);
      if (!mounted.current) return;

      setAgents((current) =>
        current.map((item) => {
          if (item.id !== updated.id) return item;
          /*
            A newer edit can land while this request is in flight — checking two
            tool boxes in quick succession does exactly that. The server's reply
            predates it, so replacing the row outright would silently drop the
            second edit. Layer the still-pending patch back on top.
          */
          const queued = readPending();
          const newer = queued?.agentId === updated.id ? queued.patch : null;
          return newer ? { ...updated, ...newer } : updated;
        }),
      );
      setSaveState({ kind: 'saved', at: new Date().toISOString() });
    } catch (thrown) {
      if (!mounted.current) return;

      // Put the failed patch back so retrySave can send it, without discarding
      // anything typed since. Newer values win on the overlapping keys.
      const queued = readPending();
      const newer = queued?.agentId === save.agentId ? queued : null;
      pending.current = newer
        ? { ...newer, patch: { ...save.patch, ...newer.patch }, rollbackTo: save.rollbackTo }
        : save;

      setAgents((current) =>
        current.map((item) => (item.id === save.agentId ? save.rollbackTo : item)),
      );
      setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not save.') });
    }
  }, []);

  const updateAgent = useCallback(
    (id: string, patch: AgentPatch) => {
      setAgents((current) => {
        const existing = current.find((item) => item.id === id);
        if (!existing) return current;

        // Capture the rollback target once per burst, not on every keystroke.
        pending.current = {
          agentId: id,
          patch: {
            ...(pending.current?.agentId === id ? pending.current.patch : {}),
            ...patch,
          },
          rollbackTo: pending.current?.agentId === id ? pending.current.rollbackTo : existing,
        };

        return current.map((item) => (item.id === id ? { ...item, ...patch } : item));
      });

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void send(), AUTOSAVE_DELAY_MS);
    },
    [send],
  );

  const flushUpdates = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await send();
  }, [send]);

  const retrySave = useCallback(() => {
    void send();
  }, [send]);

  const createAgent = useCallback(async (): Promise<Agent | null> => {
    try {
      const created = await apiPost<Agent>('/api/agents', {});
      if (mounted.current) setAgents((current) => [created, ...current]);
      return created;
    } catch (thrown) {
      if (mounted.current) {
        setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not create the agent.') });
      }
      return null;
    }
  }, []);

  const duplicateAgent = useCallback(
    async (id: string): Promise<Agent | null> => {
      const source = agents.find((item) => item.id === id);
      if (!source) return null;

      try {
        const copy = await apiPost<Agent>('/api/agents', {
          name: `Copy of ${source.name}`,
          icon: source.icon,
          description: source.description,
          model: source.model,
          systemPrompt: source.systemPrompt,
          toolIds: source.toolIds,
          // A copy starts as a draft: it has not been tested under its new name.
          status: 'draft',
        });
        if (mounted.current) setAgents((current) => [copy, ...current]);
        return copy;
      } catch (thrown) {
        if (mounted.current) {
          setSaveState({
            kind: 'error',
            message: messageOf(thrown, 'Could not duplicate the agent.'),
          });
        }
        return null;
      }
    },
    [agents],
  );

  const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiDelete(`/api/agents/${id}`);
      if (mounted.current) setAgents((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (thrown) {
      if (mounted.current) {
        setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not delete the agent.') });
      }
      return false;
    }
  }, []);

  return {
    agents,
    loading,
    error,
    saveState,
    createAgent,
    duplicateAgent,
    updateAgent,
    flushUpdates,
    deleteAgent,
    retrySave,
    reload,
  };
};

export type UseAgentsResult = ReturnType<typeof useAgents>;

const AgentsContext = createContext<UseAgentsResult | null>(null);

/**
 * Calls useAgents exactly once for the whole app. Without this, the sidebar,
 * the Agents page, and the Chat page would each hold their own copy of the
 * list, and a create on one surface would not show up on the others.
 */
export const AgentsProvider = ({ children }: { children: ReactNode }) => {
  const value = useAgents();
  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
};

export const useAgentsContext = (): UseAgentsResult => {
  const value = useContext(AgentsContext);
  if (!value) throw new Error('useAgentsContext must be called inside an AgentsProvider.');
  return value;
};
