import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createTrigger,
  deleteTrigger,
  listTriggers,
  runTriggerNow,
  updateTrigger,
} from '../lib/api-client';
import type { Run } from '../types/run';
import type { Trigger, TriggerDraft, TriggerPatch } from '../types/trigger';

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

export type SaveTriggerResult =
  | { ok: true; trigger: Trigger }
  | { ok: false; message: string };

export type FireResult = { ok: true; run: Run } | { ok: false; message: string };

export const useTriggers = (agentId?: string) => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Async continuations must read the current value, not one closed over at
  // render time. Same reason sessionsRef exists in useSessions.
  const triggersRef = useRef<Trigger[]>([]);
  const confirmed = useRef(new Map<string, Trigger>());
  const deleted = useRef(new Set<string>());
  const generation = useRef(new Map<string, number>());
  const operationTails = useRef(new Map<string, Promise<void>>());
  const activeMutations = useRef(new Set<Promise<void>>());
  const mutationRevision = useRef(0);
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

  const enqueue = useCallback(<T,>(id: string, operation: () => Promise<T>): Promise<T> => {
    const previous = operationTails.current.get(id) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(operation);
    const tail = pending.then(
      () => undefined,
      () => undefined,
    );
    operationTails.current.set(id, tail);
    void tail.finally(() => {
      if (operationTails.current.get(id) === tail) operationTails.current.delete(id);
    });
    return pending;
  }, []);

  const trackMutation = useCallback(<T,>(operation: Promise<T>): Promise<T> => {
    const settled = operation.then(
      () => undefined,
      () => undefined,
    );
    activeMutations.current.add(settled);
    void settled.finally(() => activeMutations.current.delete(settled));
    return operation;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback((update: (current: Trigger[]) => Trigger[]) => {
    const next = update(triggersRef.current);
    triggersRef.current = next;
    if (mounted.current) setTriggers(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      for (;;) {
        while (activeMutations.current.size > 0) {
          await Promise.all([...activeMutations.current]);
        }
        const requestedRevision = mutationRevision.current;
        const fetched = (await listTriggers(agentId)).filter(
          (item) => !deleted.current.has(item.id),
        );
        // A mutation started after this GET did. Let it settle and retry so the
        // eventual snapshot also includes server-side changes to other triggers.
        if (requestedRevision !== mutationRevision.current) continue;
        confirmed.current = new Map(fetched.map((item) => [item.id, item]));
        triggersRef.current = fetched;
        if (mounted.current) {
          setTriggers(fetched);
          setError(undefined);
        }
        return;
      }
    } catch (thrown: unknown) {
      if (mounted.current) setError(messageOf(thrown, "Couldn't load triggers. Retry."));
      throw thrown;
    }
  }, [agentId]);

  useEffect(() => {
    void refresh()
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [refresh]);

  const create = useCallback(
    async (draft: TriggerDraft): Promise<SaveTriggerResult> => {
      mutationRevision.current += 1;
      try {
        const created = await trackMutation(createTrigger(draft));
        confirmed.current.set(created.id, created);
        mutate((current) => [created, ...current]);
        return { ok: true, trigger: created };
      } catch (thrown: unknown) {
        return { ok: false, message: messageOf(thrown, "Couldn't create the trigger. Retry.") };
      }
    },
    [mutate, trackMutation],
  );

  const save = useCallback(
    async (id: string, patch: TriggerPatch): Promise<SaveTriggerResult> => {
      const token = nextGeneration(id);
      mutationRevision.current += 1;
      try {
        const saved = await trackMutation(enqueue(id, () => updateTrigger(id, patch)));
        confirmed.current.set(id, saved);
        if (isCurrentGeneration(id, token)) {
          mutate((current) => current.map((item) => (item.id === id ? saved : item)));
        }
        return { ok: true, trigger: saved };
      } catch (thrown: unknown) {
        return { ok: false, message: messageOf(thrown, "Couldn't save the trigger. Retry.") };
      }
    },
    [enqueue, isCurrentGeneration, mutate, nextGeneration, trackMutation],
  );

  /** Optimistic: one click, and the switch has to move under the finger. */
  const toggle = useCallback(
    async (id: string, enabled: boolean): Promise<SaveTriggerResult> => {
      const token = nextGeneration(id);
      mutationRevision.current += 1;
      const previous = confirmed.current.get(id) ?? triggersRef.current.find((item) => item.id === id);
      mutate((current) =>
        current.map((item) => (item.id === id ? { ...item, enabled } : item)),
      );
      try {
        const saved = await trackMutation(enqueue(id, () => updateTrigger(id, { enabled })));
        confirmed.current.set(id, saved);
        if (isCurrentGeneration(id, token)) {
          mutate((current) => current.map((item) => (item.id === id ? saved : item)));
        }
        return { ok: true, trigger: saved };
      } catch (thrown: unknown) {
        if (isCurrentGeneration(id, token)) {
          const rollbackTo = confirmed.current.get(id) ?? previous;
          if (rollbackTo) {
            mutate((current) => current.map((item) => (item.id === id ? rollbackTo : item)));
          }
        }
        return { ok: false, message: messageOf(thrown, "Couldn't update the trigger. Retry.") };
      }
    },
    [enqueue, isCurrentGeneration, mutate, nextGeneration, trackMutation],
  );

  const remove = useCallback(
    async (id: string): Promise<{ ok: boolean; message?: string }> => {
      const token = nextGeneration(id);
      mutationRevision.current += 1;
      const index = triggersRef.current.findIndex((item) => item.id === id);
      const previous = confirmed.current.get(id) ?? triggersRef.current[index];
      deleted.current.add(id);
      mutate((current) => current.filter((item) => item.id !== id));
      try {
        await trackMutation(enqueue(id, () => deleteTrigger(id)));
        confirmed.current.delete(id);
        mutate((current) => current.filter((item) => item.id !== id));
        return { ok: true };
      } catch (thrown: unknown) {
        if (thrown instanceof ApiError && thrown.status === 404) {
          confirmed.current.delete(id);
          mutate((current) => current.filter((item) => item.id !== id));
          return { ok: true };
        }
        if (isCurrentGeneration(id, token)) {
          const rollbackTo = confirmed.current.get(id) ?? previous;
          if (rollbackTo) {
            deleted.current.delete(id);
            mutate((current) => {
              if (current.some((item) => item.id === id)) return current;
              const at = index >= 0 && index <= current.length ? index : current.length;
              const next = [...current];
              next.splice(at, 0, rollbackTo);
              return next;
            });
          }
        }
        return { ok: false, message: messageOf(thrown, "Couldn't delete the trigger. Retry.") };
      }
    },
    [enqueue, isCurrentGeneration, mutate, nextGeneration, trackMutation],
  );

  const fireNow = useCallback(
    async (id: string): Promise<FireResult> => {
      mutationRevision.current += 1;
      try {
        const run = await trackMutation(runTriggerNow(id));
        // last* moved on the server; re-read rather than guess at them.
        await refresh().catch(() => undefined);
        return { ok: true, run };
      } catch (thrown: unknown) {
        return { ok: false, message: messageOf(thrown, "Couldn't run the trigger. Retry.") };
      }
    },
    [refresh, trackMutation],
  );

  return { triggers, loading, error, create, save, toggle, remove, fireNow, refresh };
};
