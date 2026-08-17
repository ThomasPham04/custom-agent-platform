import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, deleteSession, listSessions, renameSession } from '../lib/api-client';
import type { Session } from '../types/session';

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

const useSessions = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Async continuations must read the current value, not one closed over at
  // render time. Same reason agentsRef exists in useAgents.
  const sessionsRef = useRef<Session[]>([]);
  // The last value the server actually confirmed, per session id. Rollback
  // reads from here rather than from a list snapshot taken at call time: a
  // snapshot can include another rename's still-unconfirmed optimistic
  // value, and restoring to that would show a title the server never set.
  const confirmed = useRef(new Map<string, Session>());
  // Latest request number per session id, shared across rename and remove.
  // Mirrors useChat's `generation` map, which invalidates a history response
  // that lands after a clear. A rename is one explicit action but nothing
  // stops two of them overlapping (retitle, reopen the menu, retitle again
  // before the first PATCH returns) or a rename overlapping a delete. Only
  // the response matching the current token for that id is allowed to touch
  // `confirmed` or the list; a superseded response - success or failure - is
  // discarded instead of silently overwriting a newer, already-confirmed
  // value.
  const generation = useRef(new Map<string, number>());
  const mounted = useRef(true);

  const nextGeneration = useCallback((id: string) => {
    const token = (generation.current.get(id) ?? 0) + 1;
    generation.current.set(id, token);
    return token;
  }, []);

  const isCurrentGeneration = useCallback(
    (id: string, token: number) => generation.current.get(id) === token,
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback((update: (current: Session[]) => Session[]) => {
    const next = update(sessionsRef.current);
    sessionsRef.current = next;
    if (mounted.current) setSessions(next);
  }, []);

  const refresh = useCallback(async () => {
    const fetched = await listSessions();
    confirmed.current = new Map(fetched.map((item) => [item.id, item]));
    sessionsRef.current = fetched;
    if (mounted.current) setSessions(fetched);
  }, []);

  useEffect(() => {
    void refresh().finally(() => {
      if (mounted.current) setLoading(false);
    });
  }, [refresh]);

  const rename = useCallback(
    async (id: string, title: string) => {
      const token = nextGeneration(id);
      const rollbackTo = confirmed.current.get(id);
      mutate((current) => current.map((item) => (item.id === id ? { ...item, title } : item)));
      try {
        const saved = await renameSession(id, title);
        // A newer rename or remove for this id started while this one was in
        // flight; that call owns `confirmed` and the list now, so this
        // response is discarded rather than clobbering its result.
        if (isCurrentGeneration(id, token)) {
          confirmed.current.set(id, saved);
          mutate((current) => current.map((item) => (item.id === id ? saved : item)));
        }
      } catch (thrown) {
        // Same guard on the failure path: a superseded rename must not roll
        // back over a value a newer call already confirmed.
        if (isCurrentGeneration(id, token) && rollbackTo) {
          mutate((current) => current.map((item) => (item.id === id ? rollbackTo : item)));
        }
        throw new Error(messageOf(thrown, 'Could not rename the chat.'));
      }
    },
    [isCurrentGeneration, mutate, nextGeneration],
  );

  const remove = useCallback(
    async (id: string) => {
      // Same overlap risk as rename - e.g. a double-clicked delete, or a
      // rename in flight when the row is deleted - so it shares the same
      // per-id generation token.
      const token = nextGeneration(id);
      const index = sessionsRef.current.findIndex((item) => item.id === id);
      const rollbackTo = confirmed.current.get(id);
      mutate((current) => current.filter((item) => item.id !== id));
      try {
        await deleteSession(id);
        if (isCurrentGeneration(id, token)) {
          confirmed.current.delete(id);
        }
      } catch (thrown) {
        if (isCurrentGeneration(id, token) && rollbackTo) {
          mutate((current) => {
            if (current.some((item) => item.id === id)) return current;
            const at = index >= 0 && index <= current.length ? index : current.length;
            const next = [...current];
            next.splice(at, 0, rollbackTo);
            return next;
          });
        }
        throw new Error(messageOf(thrown, 'Could not delete the chat.'));
      }
    },
    [isCurrentGeneration, mutate, nextGeneration],
  );

  // Prepended rather than refetched: the send already returned the new row,
  // so the sidebar does not need to refetch the whole list to show it.
  const adopt = useCallback(
    (session: Session) => {
      confirmed.current.set(session.id, session);
      mutate((current) => {
        if (current.some((item) => item.id === session.id)) {
          return current.map((item) => (item.id === session.id ? session : item));
        }
        return [session, ...current];
      });
    },
    [mutate],
  );

  return { sessions, loading, rename, remove, adopt, refresh };
};

export type UseSessionsResult = ReturnType<typeof useSessions>;

const SessionsContext = createContext<UseSessionsResult | null>(null);

/**
 * Calls useSessions exactly once for the whole app. Without this, the
 * sidebar and the Chat page would each hold their own copy of the session
 * list, and a rename or a new session on one surface would not show up on
 * the other.
 */
export const SessionsProvider = ({ children }: { children: ReactNode }) => {
  const value = useSessions();
  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
};

export const useSessionsContext = (): UseSessionsResult => {
  const value = useContext(SessionsContext);
  if (!value) throw new Error('useSessionsContext must be called inside a SessionsProvider.');
  return value;
};
