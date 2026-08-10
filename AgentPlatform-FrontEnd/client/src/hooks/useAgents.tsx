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

export type OperationError =
  | { kind: 'create'; message: string }
  | { kind: 'duplicate'; agentId: string; message: string }
  | { kind: 'delete'; agentId: string; message: string };

interface PendingSave {
  agentId: string;
  patch: AgentPatch;
  /** The last server-confirmed agent to restore if this queue fails. */
  rollbackTo: Agent;
}

interface SaveQueue {
  pending?: PendingSave;
  failed?: PendingSave;
  timer?: ReturnType<typeof setTimeout>;
  processing?: Promise<void>;
  ready: boolean;
  generation: number;
}

// Reading through a helper reflects edits that can arrive while PATCH awaits;
// TypeScript otherwise keeps the earlier `pending = undefined` narrowing.
const pendingSave = (queue: SaveQueue) => queue.pending;

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [operationError, setOperationError] = useState<OperationError | null>(null);

  const agentsRef = useRef<Agent[]>([]);
  const confirmed = useRef(new Map<string, Agent>());
  const queues = useRef(new Map<string, SaveQueue>());
  const mounted = useRef(true);

  const mutateAgents = useCallback((update: (current: Agent[]) => Agent[]) => {
    const next = update(agentsRef.current);
    agentsRef.current = next;
    if (mounted.current) setAgents(next);
  }, []);

  const setAgentSaveState = useCallback((agentId: string, state: SaveState) => {
    if (!mounted.current) return;
    setSaveStates((current) => ({ ...current, [agentId]: state }));
  }, []);

  const clearAgentSaveState = useCallback((agentId: string) => {
    if (!mounted.current) return;
    setSaveStates((current) => {
      if (!(agentId in current)) return current;
      const next = { ...current };
      delete next[agentId];
      return next;
    });
  }, []);

  const getQueue = useCallback((agentId: string): SaveQueue => {
    const existing = queues.current.get(agentId);
    if (existing) return existing;
    const created: SaveQueue = { ready: false, generation: 0 };
    queues.current.set(agentId, created);
    return created;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const queue of queues.current.values()) {
        if (queue.timer) clearTimeout(queue.timer);
        queue.generation += 1;
        queue.pending = undefined;
        queue.failed = undefined;
        queue.ready = false;
      }
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await apiGet<Agent[]>('/api/agents');
      if (!mounted.current) return;
      agentsRef.current = fetched;
      confirmed.current = new Map(fetched.map((agent) => [agent.id, agent]));
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

  /**
   * Drains one agent's queue in order. Other agents have independent queues, so
   * a slow response cannot replace their pending patches or save indicators.
   */
  const processQueue = useCallback(
    async (agentId: string): Promise<void> => {
      const queue = getQueue(agentId);
      if (queue.processing) return queue.processing;

      const processing = (async () => {
        while (queue.ready && queue.pending) {
          const save = queue.pending;
          const generation = queue.generation;
          queue.pending = undefined;
          queue.ready = false;
          setAgentSaveState(agentId, { kind: 'saving' });

          try {
            const updated = await apiPatch<Agent>(`/api/agents/${agentId}`, save.patch);
            if (!mounted.current || queue.generation !== generation) return;

            confirmed.current.set(agentId, updated);
            mutateAgents((current) =>
              current.map((item) =>
                item.id === agentId
                  ? { ...updated, ...(queue.pending?.patch ?? queue.failed?.patch ?? {}) }
                  : item,
              ),
            );
            setAgentSaveState(
              agentId,
              queue.pending ? { kind: 'saving' } : { kind: 'saved', at: new Date().toISOString() },
            );
          } catch (thrown) {
            if (!mounted.current || queue.generation !== generation) return;

            const newer = pendingSave(queue);
            queue.failed = newer
              ? {
                  agentId,
                  patch: { ...save.patch, ...newer.patch },
                  rollbackTo: save.rollbackTo,
                }
              : save;
            queue.pending = undefined;
            queue.ready = false;
            if (queue.timer) clearTimeout(queue.timer);
            queue.timer = undefined;

            const rollback = confirmed.current.get(agentId) ?? save.rollbackTo;
            mutateAgents((current) =>
              current.map((item) => (item.id === agentId ? rollback : item)),
            );
            setAgentSaveState(agentId, {
              kind: 'error',
              message: messageOf(thrown, 'Could not save.'),
            });
            return;
          }
        }
      })();

      queue.processing = processing;
      try {
        await processing;
      } finally {
        if (queue.processing === processing) queue.processing = undefined;
      }
    },
    [getQueue, mutateAgents, setAgentSaveState],
  );

  const updateAgent = useCallback(
    (id: string, patch: AgentPatch) => {
      const existing = agentsRef.current.find((item) => item.id === id);
      if (!existing) return;

      const queue = getQueue(id);
      const rollbackTo = confirmed.current.get(id) ?? existing;

      if (queue.failed) {
        queue.failed = {
          agentId: id,
          patch: { ...queue.failed.patch, ...patch },
          rollbackTo: queue.failed.rollbackTo,
        };
      } else {
        queue.pending = {
          agentId: id,
          patch: { ...queue.pending?.patch, ...patch },
          rollbackTo: queue.pending?.rollbackTo ?? rollbackTo,
        };
      }

      mutateAgents((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );

      if (queue.failed) return;
      setAgentSaveState(id, { kind: 'saving' });
      if (queue.timer) clearTimeout(queue.timer);
      queue.timer = setTimeout(() => {
        queue.timer = undefined;
        queue.ready = true;
        void processQueue(id);
      }, AUTOSAVE_DELAY_MS);
    },
    [getQueue, mutateAgents, processQueue, setAgentSaveState],
  );

  const flushUpdates = useCallback(
    async (agentId?: string) => {
      const ids = agentId ? [agentId] : [...queues.current.keys()];
      await Promise.all(
        ids.map(async (id) => {
          const queue = getQueue(id);
          if (queue.timer) clearTimeout(queue.timer);
          queue.timer = undefined;
          if (queue.pending) queue.ready = true;
          await processQueue(id);
        }),
      );
    },
    [getQueue, processQueue],
  );

  const retrySave = useCallback(
    (agentId?: string) => {
      const id = agentId ?? [...queues.current.entries()].find(([, queue]) => queue.failed)?.[0];
      if (!id) return;
      const queue = getQueue(id);
      const failed = queue.failed;
      if (!failed) return;

      queue.failed = undefined;
      queue.pending = failed;
      queue.ready = true;
      mutateAgents((current) =>
        current.map((item) => (item.id === id ? { ...item, ...failed.patch } : item)),
      );
      setAgentSaveState(id, { kind: 'saving' });
      void processQueue(id);
    },
    [getQueue, mutateAgents, processQueue, setAgentSaveState],
  );

  const cancelAgentSaves = useCallback(
    (agentId: string) => {
      const queue = getQueue(agentId);
      queue.generation += 1;
      if (queue.timer) clearTimeout(queue.timer);
      queue.timer = undefined;
      queue.pending = undefined;
      queue.failed = undefined;
      queue.ready = false;
      clearAgentSaveState(agentId);
    },
    [clearAgentSaveState, getQueue],
  );

  const createAgent = useCallback(async (): Promise<Agent | null> => {
    setOperationError(null);
    try {
      const created = await apiPost<Agent>('/api/agents', {});
      if (mounted.current) {
        confirmed.current.set(created.id, created);
        mutateAgents((current) => [created, ...current]);
      }
      return created;
    } catch (thrown) {
      if (mounted.current) {
        setOperationError({
          kind: 'create',
          message: messageOf(thrown, 'Could not create the agent.'),
        });
      }
      return null;
    }
  }, [mutateAgents]);

  const duplicateAgent = useCallback(
    async (id: string): Promise<Agent | null> => {
      const source = agentsRef.current.find((item) => item.id === id);
      if (!source) return null;
      setOperationError(null);

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
        if (mounted.current) {
          confirmed.current.set(copy.id, copy);
          mutateAgents((current) => [copy, ...current]);
        }
        return copy;
      } catch (thrown) {
        if (mounted.current) {
          setOperationError({
            kind: 'duplicate',
            agentId: id,
            message: messageOf(thrown, 'Could not duplicate the agent.'),
          });
        }
        return null;
      }
    },
    [mutateAgents],
  );

  const deleteAgent = useCallback(
    async (id: string): Promise<boolean> => {
      setOperationError(null);
      cancelAgentSaves(id);
      try {
        await apiDelete(`/api/agents/${id}`);
        if (mounted.current) {
          confirmed.current.delete(id);
          mutateAgents((current) => current.filter((item) => item.id !== id));
        }
        return true;
      } catch (thrown) {
        if (mounted.current) {
          setOperationError({
            kind: 'delete',
            agentId: id,
            message: messageOf(thrown, 'Could not delete the agent.'),
          });
        }
        return false;
      }
    },
    [cancelAgentSaves, mutateAgents],
  );

  const retryOperation = useCallback(async () => {
    const failedOperation = operationError;
    if (!failedOperation) return null;
    if (failedOperation.kind === 'create') {
      return { kind: 'create' as const, agent: await createAgent() };
    } else if (failedOperation.kind === 'duplicate') {
      return {
        kind: 'duplicate' as const,
        agent: await duplicateAgent(failedOperation.agentId),
      };
    } else {
      return {
        kind: 'delete' as const,
        agentId: failedOperation.agentId,
        deleted: await deleteAgent(failedOperation.agentId),
      };
    }
  }, [createAgent, deleteAgent, duplicateAgent, operationError]);

  return {
    agents,
    loading,
    error,
    saveStates,
    operationError,
    createAgent,
    duplicateAgent,
    updateAgent,
    flushUpdates,
    deleteAgent,
    retrySave,
    retryOperation,
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
