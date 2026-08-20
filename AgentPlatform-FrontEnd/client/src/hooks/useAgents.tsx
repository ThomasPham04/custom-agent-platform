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
import type { Agent, AgentDraft, AgentPatch } from '../types/agent';
import type { Trigger, TriggerDraft } from '../types/trigger';

export type SaveAgentResult =
  | { ok: true; agent: Agent }
  | { ok: false; message: string };

export type OperationError =
  | { kind: 'create'; message: string }
  | { kind: 'duplicate'; agentId: string; message: string }
  | { kind: 'delete'; agentId: string; message: string };

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<OperationError | null>(null);
  const [creating, setCreating] = useState(false);

  const agentsRef = useRef<Agent[]>([]);
  const mounted = useRef(true);

  const mutateAgents = useCallback((update: (current: Agent[]) => Agent[]) => {
    const next = update(agentsRef.current);
    agentsRef.current = next;
    if (mounted.current) setAgents(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await apiGet<Agent[]>('/api/agents');
      if (!mounted.current) return;
      agentsRef.current = fetched;
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

  const saveAgent = useCallback(
    async (id: string, patch: AgentPatch): Promise<SaveAgentResult> => {
      try {
        const updated = await apiPatch<Agent>(`/api/agents/${id}`, patch);
        if (mounted.current) {
          mutateAgents((current) =>
            current.map((item) => (item.id === id ? updated : item)),
          );
        }
        return { ok: true, agent: updated };
      } catch (thrown) {
        return { ok: false, message: messageOf(thrown, 'Could not save.') };
      }
    },
    [mutateAgents],
  );

  /**
   * The only path that creates an agent. It takes the finished draft rather
   * than creating an empty row and patching it, so an abandoned draft leaves
   * nothing behind on the server.
   */
  const saveDraft = useCallback(
    async (
      draft: AgentDraft,
      triggerDrafts: readonly TriggerDraft[] = [],
    ): Promise<Agent | null> => {
      setOperationError(null);
      setCreating(true);
      try {
        const created = await apiPost<Agent>('/api/agents', draft);

        try {
          // Trigger validation requires a real agent id. Keep the schedules
          // local until this point, then bind each one to the newly-created id.
          for (const trigger of triggerDrafts) {
            await apiPost<Trigger>('/api/triggers', { ...trigger, agentId: created.id });
          }
        } catch (triggerError) {
          const triggerMessage = messageOf(triggerError, 'Could not create the trigger.');
          try {
            // Make the multi-request create behave atomically from the form's
            // point of view. Agent deletion also removes its triggers.
            await apiDelete(`/api/agents/${created.id}`);
          } catch {
            // If compensation itself fails, keep the real agent visible and
            // return it so another Save click cannot create a duplicate.
            if (mounted.current) {
              mutateAgents((current) => [created, ...current]);
              setOperationError({
                kind: 'create',
                message: `${triggerMessage} The agent was saved, but its triggers were not.`,
              });
            }
            return created;
          }

          if (mounted.current) {
            setOperationError({
              kind: 'create',
              message: `${triggerMessage} Nothing was saved; you can retry.`,
            });
          }
          return null;
        }

        if (mounted.current) {
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
      } finally {
        if (mounted.current) setCreating(false);
      }
    },
    [mutateAgents],
  );

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
      try {
        await apiDelete(`/api/agents/${id}`);
        if (mounted.current) {
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
    [mutateAgents],
  );

  /**
   * Create is absent here on purpose: the draft lives in the page, so its retry
   * is the Save button that failed, still on screen with the text intact.
   */
  const retryOperation = useCallback(async () => {
    const failedOperation = operationError;
    if (!failedOperation || failedOperation.kind === 'create') return null;
    if (failedOperation.kind === 'duplicate') {
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
  }, [deleteAgent, duplicateAgent, operationError]);

  return {
    agents,
    loading,
    error,
    operationError,
    creating,
    saveDraft,
    duplicateAgent,
    saveAgent,
    deleteAgent,
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
