import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiPost } from '../lib/api-client';
import type { Message, ToolCall } from '../types/message';

export const ANSWER_FADE_MS = 180;

type Threads = Record<string, Message[]>;

let messageCounter = 0;
/** Local ids only: server ids arrive with the response and replace these. */
const localId = (prefix: string) => `${prefix}_local_${(messageCounter += 1)}`;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const useChat = (agentId: string | null) => {
  const [threads, setThreads] = useState<Threads>({});
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const messages = agentId ? (threads[agentId] ?? []) : [];

  /** Rewrites the placeholder in place, leaving every other turn untouched. */
  const patchPlaceholder = useCallback(
    (id: string, placeholderId: string, patch: Partial<Message>) => {
      setThreads((current) => ({
        ...current,
        [id]: (current[id] ?? []).map((message) =>
          message.id === placeholderId ? { ...message, ...patch } : message,
        ),
      }));
    },
    [],
  );

  const run = useCallback(
    async (id: string, content: string, retry = false) => {
      const placeholderId = localId('msg');
      const now = new Date().toISOString();

      setThreads((current) => ({
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

      setSending(true);

      let response: { message: Message };
      try {
        response = await apiPost<{ message: Message }>(`/api/chat/${id}/messages`, {
          content,
          ...(retry ? { retry: true } : {}),
        });
      } catch (thrown) {
        if (mounted.current) {
          patchPlaceholder(id, placeholderId, {
            status: 'error',
            content: thrown instanceof ApiError ? thrown.message : 'The run did not complete.',
          });
          setSending(false);
        }
        return;
      }

      const finished = response.message;
      const calls = finished.toolCalls ?? [];
      const revealed: ToolCall[] = [];
      let failed = false;

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
      setSending(false);
    },
    [patchPlaceholder],
  );

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!agentId || trimmed.length === 0 || sending) return;
      await run(agentId, trimmed);
    },
    [agentId, sending, run],
  );

  const retryLast = useCallback(async () => {
    if (!agentId) return;
    const thread = threads[agentId] ?? [];
    const last = thread[thread.length - 1];
    const previous = thread[thread.length - 2];
    if (!last || last.role !== 'assistant' || last.status !== 'error' || previous?.role !== 'user') {
      return;
    }

    const content = previous.content;
    setThreads((current) => ({ ...current, [agentId]: (current[agentId] ?? []).slice(0, -2) }));
    await run(agentId, content, true);
  }, [agentId, threads, run]);

  const clear = useCallback(() => {
    if (!agentId) return;
    setThreads((current) => ({ ...current, [agentId]: [] }));
  }, [agentId]);

  return { messages, sending, send, retryLast, clear };
};
