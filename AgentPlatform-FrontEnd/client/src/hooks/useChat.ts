import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, listRunsBySession, streamMessage } from '../lib/api-client';
import { runsToMessages } from '../lib/run-to-messages';
import type { Message, ToolCall } from '../types/message';
import type { Session } from '../types/session';

type Threads = Record<string, Message[]>;
type InFlightByChat = Record<string, true>;

let messageCounter = 0;
/** Local ids only: server ids arrive with the response and replace these. */
const localId = (prefix: string) => `${prefix}_local_${(messageCounter += 1)}`;

/**
 * A new chat has no session id until the server creates one on the first
 * send, so its turns need somewhere to live in the meantime. The placeholder
 * key is per agent, so switching agents inside a new chat starts a clean
 * draft instead of showing the other agent's unsent turn.
 */
const PENDING_PREFIX = 'pending:';
const pendingKey = (agentId: string) => `${PENDING_PREFIX}${agentId}`;
/** The namespace keeps a placeholder key from ever colliding with a session id. */
const isPendingKey = (id: string) => id.startsWith(PENDING_PREFIX);

/**
 * `sessionId` keys everything; `agentId` addresses the chat POST and names the
 * placeholder key of a chat that has no session yet.
 */
export const useChat = (sessionId: string | null, agentId: string | null) => {
  const [threads, setThreads] = useState<Threads>({});
  const [inFlightByChat, setInFlightByChat] = useState<InFlightByChat>({});
  const [hydratingByChat, setHydratingByChat] = useState<InFlightByChat>({});
  const hydrated = useRef(new Set<string>());
  // Mirrors useAgents' queue.generation: bumping a session's generation
  // invalidates any response still in flight for it.
  const generation = useRef(new Map<string, number>());
  const threadsRef = useRef<Threads>({});
  const inFlight = useRef(new Set<string>());
  /**
   * Redirect table: a pending chat's placeholder key -> the session the server
   * created for it. It is not a record of what happened, it is the live
   * address of the chat: every read and write of chat-keyed state resolves
   * through it, so a reveal already in progress, a second message sent before
   * the route catches up, and the screen itself all follow the thread to its
   * new key. A redirect is retired only once the route has landed on that
   * exact session and nothing is still writing through it.
   */
  const pendingSession = useRef(new Map<string, string>());
  const mounted = useRef(true);

  /** The key a chat's state actually lives under, after any adoption. */
  const resolveKey = useCallback((id: string) => pendingSession.current.get(id) ?? id, []);

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

  const setChatInFlight = useCallback(
    (chatId: string, running: boolean) => {
      const id = resolveKey(chatId);
      if (running) inFlight.current.add(id);
      else inFlight.current.delete(id);
      if (!mounted.current) return;

      setInFlightByChat((current) => {
        if (running) return { ...current, [id]: true };
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    [resolveKey],
  );

  // A pending chat whose session already exists reads and writes under that
  // session, so the screen follows the thread before the route does.
  const key = sessionId ?? (agentId ? resolveKey(pendingKey(agentId)) : null);

  const messages = key ? (threads[key] ?? []) : [];
  const sending = key ? Boolean(inFlightByChat[key]) : false;
  const loading = key ? Boolean(hydratingByChat[key]) : false;

  useEffect(() => {
    if (!sessionId || hydrated.current.has(sessionId)) return;
    const id = sessionId;
    // Marked before the request so StrictMode's second effect pass does not
    // fire a duplicate. Nothing here is cancelled on session switch: the
    // response is applied to threads[id] by id, so a late arrival is still
    // correct.
    hydrated.current.add(id);
    const requested = generation.current.get(id) ?? 0;
    setHydratingByChat((current) => ({ ...current, [id]: true }));

    listRunsBySession(id)
      .then((runs) => {
        if (!mounted.current) return;
        // A forget that landed while this was in flight already dropped these
        // turns; applying them now would resurrect them on screen.
        if ((generation.current.get(id) ?? 0) !== requested) return;
        // Live work wins. A turn started while this was in flight owns the
        // thread, and history must not overwrite it.
        if (inFlight.current.has(id) || (threadsRef.current[id] ?? []).length > 0) return;
        mutateThreads((current) => ({ ...current, [id]: runsToMessages(runs) }));
      })
      .catch(() => {
        // History is a convenience, not the conversation. A failed load leaves
        // an empty thread and lets the next visit try again.
        hydrated.current.delete(id);
      })
      .finally(() => {
        if (!mounted.current) return;
        setHydratingByChat((current) => {
          if (!(id in current)) return current;
          const next = { ...current };
          delete next[id];
          return next;
        });
      });
  }, [sessionId, mutateThreads]);

  // The route has landed on the session this chat created, so the placeholder
  // key is retired and the next new chat starts empty instead of reopening
  // this one. Two conditions, both part of the redirect's lifetime rule: the
  // arriving session must be the one this placeholder created, so opening some
  // other chat leaves a pending draft alone; and nothing may still be writing
  // through the redirect, or the rest of a reveal would land on a key nothing
  // reads. `inFlightByChat` is a dependency for that second condition: when
  // the run finishes, this effect re-runs and retires the redirect then.
  useEffect(() => {
    if (!sessionId || !agentId) return;
    const placeholder = pendingKey(agentId);
    if (pendingSession.current.get(placeholder) !== sessionId) return;
    if (inFlight.current.has(sessionId)) return;
    pendingSession.current.delete(placeholder);
    if (!(placeholder in threadsRef.current)) return;
    mutateThreads((current) => {
      if (!(placeholder in current)) return current;
      const next = { ...current };
      delete next[placeholder];
      return next;
    });
  }, [sessionId, agentId, inFlightByChat, mutateThreads]);

  /**
   * Moves a pending chat onto the session the server just created and
   * registers the redirect, so every later read and write of this chat -- the
   * rest of the reveal, the next message, the screen -- resolves to the
   * session key. It moves rather than copies: with the redirect in place
   * nothing addresses the placeholder any more, so a copy left behind would
   * only be a second thread to drift out of date.
   */
  const adopt = useCallback(
    (from: string, session: Session) => {
      if (from === session.id) return;
      pendingSession.current.set(from, session.id);
      // The session's only history is the turn being revealed, so it counts as
      // hydrated: fetching it would be a wasted request whose response the
      // live-work guard would discard anyway.
      hydrated.current.add(session.id);
      mutateThreads((current) => {
        const next = { ...current, [session.id]: current[from] ?? [] };
        delete next[from];
        return next;
      });

      // The run marked itself in flight under the placeholder key. Carry that
      // across too, or `sending` would go quiet for the rest of the reveal.
      if (inFlight.current.has(from)) {
        inFlight.current.delete(from);
        inFlight.current.add(session.id);
      }
      if (!mounted.current) return;
      setInFlightByChat((current) => {
        if (!(from in current)) return current;
        const next = { ...current, [session.id]: true as const };
        delete next[from];
        return next;
      });
    },
    [mutateThreads],
  );

  /** Rewrites one run placeholder in place, leaving every other turn untouched. */
  const patchPlaceholder = useCallback(
    (chatId: string, placeholderId: string, patch: Partial<Message>) => {
      // Resolved at each patch, never captured: a reveal in progress follows
      // its thread if the session id arrives mid-walk.
      const id = resolveKey(chatId);
      mutateThreads((current) => ({
        ...current,
        [id]: (current[id] ?? []).map((message) =>
          message.id === placeholderId ? { ...message, ...patch } : message,
        ),
      }));
    },
    [mutateThreads, resolveKey],
  );

  const run = useCallback(
    async (
      id: string,
      agent: string,
      content: string,
      session: string | undefined,
      isRetry = false,
    ): Promise<Session | undefined> => {
      // The ref closes the gap before React publishes the `sending` render.
      if (inFlight.current.has(resolveKey(id))) return undefined;
      setChatInFlight(id, true);

      const placeholderId = localId('msg');
      const now = new Date().toISOString();
      const opened = resolveKey(id);
      mutateThreads((current) => ({
        ...current,
        [opened]: [
          ...(current[opened] ?? []),
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

      let created: Session | undefined;

      try {
        let partial = '';
        let calls: ToolCall[] = [];
        await streamMessage(
          agent,
          content,
          { retry: isRetry, sessionId: session },
          (event) => {
            if (!mounted.current) return;
            if (event.type === 'session') {
              created = event.session;
              adopt(id, event.session);
            } else if (event.type === 'textDelta') {
              partial += event.text;
              patchPlaceholder(id, placeholderId, { content: partial });
            } else if (event.type === 'toolStarted') {
              calls = [...calls, event.call];
              patchPlaceholder(id, placeholderId, { toolCalls: calls });
            } else if (event.type === 'toolFinished') {
              calls = calls.map((call) =>
                call.id === event.callId
                  ? {
                      ...call,
                      result: event.result,
                      error: event.error,
                      durationMs: event.durationMs,
                      status: event.status,
                    }
                  : call,
              );
              patchPlaceholder(id, placeholderId, { toolCalls: calls });
            } else if (event.type === 'done') {
              const finished = event.message;
              patchPlaceholder(id, placeholderId, {
                id: finished.id,
                content: finished.content,
                toolCalls: finished.toolCalls,
                model: finished.model,
                latencyMs: finished.latencyMs,
                status: finished.status,
                createdAt: finished.createdAt,
              });
            }
          },
        );
      } catch (thrown) {
        if (mounted.current) {
          patchPlaceholder(id, placeholderId, {
            status: 'error',
            content: thrown instanceof ApiError ? thrown.message : 'The run did not complete.',
          });
        }
      } finally {
        setChatInFlight(id, false);
      }

      return created;
    },
    [adopt, mutateThreads, patchPlaceholder, resolveKey, setChatInFlight],
  );

  /**
   * The session this chat posts to. `id` is already resolved, so anything that
   * is not a placeholder key is the session itself -- including the one a
   * pending chat created before the route caught up.
   */
  const targetSession = useCallback(
    (id: string) => sessionId ?? (isPendingKey(id) ? undefined : id),
    [sessionId],
  );

  /** Resolves with the session the server created, on the first message of a new chat only. */
  const send = useCallback(
    async (content: string): Promise<Session | undefined> => {
      const trimmed = content.trim();
      if (!agentId || !key || trimmed.length === 0) return undefined;
      return run(key, agentId, trimmed, targetSession(key));
    },
    [agentId, key, run, targetSession],
  );

  const retry = useCallback(
    async (failedMessageId: string): Promise<Session | undefined> => {
      if (!agentId || !key || inFlight.current.has(key)) return undefined;
      const thread = threadsRef.current[key] ?? [];
      const failedIndex = thread.findIndex((message) => message.id === failedMessageId);
      const failedMessage = thread[failedIndex];
      const userMessage = thread[failedIndex - 1];
      if (
        failedIndex < 1 ||
        failedMessage?.role !== 'assistant' ||
        failedMessage.status !== 'error' ||
        userMessage?.role !== 'user'
      ) {
        return undefined;
      }

      mutateThreads((current) => ({
        ...current,
        [key]: (current[key] ?? []).filter(
          (_message, index) => index !== failedIndex - 1 && index !== failedIndex,
        ),
      }));
      return run(key, agentId, userMessage.content, targetSession(key), true);
    },
    [agentId, key, mutateThreads, run, targetSession],
  );

  const retryLast = useCallback(async (): Promise<Session | undefined> => {
    if (!key) return undefined;
    const lastFailure = [...(threadsRef.current[key] ?? [])]
      .reverse()
      .find((message) => message.role === 'assistant' && message.status === 'error');
    return lastFailure ? retry(lastFailure.id) : undefined;
  }, [key, retry]);

  /**
   * Drops a thread from memory. There is no network call and nothing is
   * deleted: `DELETE /api/runs` is agent-scoped, so re-keying the old `clear`
   * would have wiped every conversation with that agent. Deleting a chat for
   * real goes through `DELETE /api/sessions/{id}` in useSessions, which
   * cascades to its runs.
   */
  const forget = useCallback(
    (id?: string) => {
      const target = id ? resolveKey(id) : key;
      if (!target) return;
      /*
        A redirect is the live address of a pending chat, so it goes with the
        thread it addresses. Left behind, the next message from a screen that
        looks fresh would resolve straight back into the chat just forgotten --
        and after a delete, into a session the server no longer has.
      */
      for (const [placeholder, adopted] of pendingSession.current) {
        if (adopted === target) pendingSession.current.delete(placeholder);
      }
      // Invalidates any history response still in flight for this session.
      generation.current.set(target, (generation.current.get(target) ?? 0) + 1);
      // Forgotten, not deleted: the rows may still exist, so the next visit is
      // allowed to fetch them again.
      hydrated.current.delete(target);
      if (!(target in threadsRef.current)) return;
      mutateThreads((current) => {
        if (!(target in current)) return current;
        const next = { ...current };
        delete next[target];
        return next;
      });
    },
    [key, mutateThreads, resolveKey],
  );

  return { messages, sending, loading, send, retry, retryLast, forget };
};
