import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiPost } from '../lib/api-client';
import type { Message, ToolCall } from '../types/message';

export const ANSWER_FADE_MS = 180;

type Threads = Record<string, Message[]>;
type InFlightByAgent = Record<string, true>;

let messageCounter = 0;
/** Local ids only: server ids arrive with the response and replace these. */
const localId = (prefix: string) => `${prefix}_local_${(messageCounter += 1)}`;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const useChat = (agentId: string | null) => {
  const [threads, setThreads] = useState<Threads>({});
  const [inFlightByAgent, setInFlightByAgent] = useState<InFlightByAgent>({});
  const threadsRef = useRef<Threads>({});
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current.clear();
    };
  }, []);

  const mutateThreads = useCallback((update: (current: Threads) => Threads) => {
    const next = update(threadsRef.current);
    threadsRef.current = next;
    if (mounted.current) setThreads(next);
  }, []);

  const setAgentInFlight = useCallback((id: string, running: boolean) => {
    if (running) inFlight.current.add(id);
    else inFlight.current.delete(id);
    if (!mounted.current) return;

    setInFlightByAgent((current) => {
      if (running) return { ...current, [id]: true };
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const messages = agentId ? (threads[agentId] ?? []) : [];
  const sending = agentId ? Boolean(inFlightByAgent[agentId]) : false;

  /** Rewrites one run placeholder in place, leaving every other turn untouched. */
  const patchPlaceholder = useCallback(
    (id: string, placeholderId: string, patch: Partial<Message>) => {
      mutateThreads((current) => ({
        ...current,
        [id]: (current[id] ?? []).map((message) =>
          message.id === placeholderId ? { ...message, ...patch } : message,
        ),
      }));
    },
    [mutateThreads],
  );

  const run = useCallback(
    async (id: string, content: string, retry = false) => {
      // The ref closes the gap before React publishes the `sending` render.
      if (inFlight.current.has(id)) return;
      setAgentInFlight(id, true);

      const placeholderId = localId('msg');
      const now = new Date().toISOString();
      mutateThreads((current) => ({
        ...current,
        [id]: [
          ...(current[id] ?? []),
          { id: localId('msg'), role: 'user', content, status: 'done', createdAt: now },
          {
            id: placeholderId,
            role: 'assistant',
            content: '',
            toolCalls: [],
            status: 'thinking',
            createdAt: now,
          },
        ],
      }));

      try {
        const response = await apiPost<{ message: Message }>(`/api/chat/${id}/messages`, {
          content,
          ...(retry ? { retry: true } : {}),
        });

        const finished = response.message;
        const calls = finished.toolCalls ?? [];
        const revealed: ToolCall[] = [];
        let failed = finished.status === 'error';

        // The response is complete; the pacing is ours. Each node waits out its
        // own reported duration, so the felt wait matches the numbers on screen.
        for (const call of calls) {
          if (!mounted.current) return;

          revealed.push({ ...call, status: 'running' });
          patchPlaceholder(id, placeholderId, { toolCalls: [...revealed] });

          await delay(call.durationMs);
          if (!mounted.current) return;

          revealed[revealed.length - 1] = call;
          patchPlaceholder(id, placeholderId, { toolCalls: [...revealed] });

          if (call.status === 'error') {
            failed = true;
            break;
          }
        }

        if (!mounted.current) return;
        patchPlaceholder(id, placeholderId, {
          id: finished.id,
          content: finished.content,
          model: finished.model,
          latencyMs: finished.latencyMs,
          status: failed ? 'error' : 'done',
          createdAt: finished.createdAt,
        });
      } catch (thrown) {
        if (mounted.current) {
          patchPlaceholder(id, placeholderId, {
            status: 'error',
            content: thrown instanceof ApiError ? thrown.message : 'The run did not complete.',
          });
        }
      } finally {
        setAgentInFlight(id, false);
      }
    },
    [mutateThreads, patchPlaceholder, setAgentInFlight],
  );

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!agentId || trimmed.length === 0) return;
      await run(agentId, trimmed);
    },
    [agentId, run],
  );

  const retry = useCallback(
    async (failedMessageId: string) => {
      if (!agentId || inFlight.current.has(agentId)) return;
      const thread = threadsRef.current[agentId] ?? [];
      const failedIndex = thread.findIndex((message) => message.id === failedMessageId);
      const failedMessage = thread[failedIndex];
      const userMessage = thread[failedIndex - 1];
      if (
        failedIndex < 1 ||
        failedMessage?.role !== 'assistant' ||
        failedMessage.status !== 'error' ||
        userMessage?.role !== 'user'
      ) {
        return;
      }

      mutateThreads((current) => ({
        ...current,
        [agentId]: (current[agentId] ?? []).filter(
          (_message, index) => index !== failedIndex - 1 && index !== failedIndex,
        ),
      }));
      await run(agentId, userMessage.content, true);
    },
    [agentId, mutateThreads, run],
  );

  const retryLast = useCallback(async () => {
    if (!agentId) return;
    const lastFailure = [...(threadsRef.current[agentId] ?? [])]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status === 'error');
    if (lastFailure) await retry(lastFailure.id);
  }, [agentId, retry]);

  const clear = useCallback(() => {
    if (!agentId) return;
    mutateThreads((current) => ({ ...current, [agentId]: [] }));
  }, [agentId, mutateThreads]);

  return { messages, sending, send, retry, retryLast, clear };
};
