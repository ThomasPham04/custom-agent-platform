import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createDocument,
  deleteDocument,
  listDocuments,
  updateDocument,
} from '../lib/api-client';
import type {
  DocumentDraft,
  DocumentPatch,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
} from '../types/knowledge';

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

/** Mirrors PREVIEW_MAX_CHARS in app/modules/knowledge/schemas.py. */
const PREVIEW_MAX_CHARS = 200;

export type SaveDocumentResult =
  | { ok: true; document: KnowledgeDocument }
  | { ok: false; message: string };

export type RemoveDocumentResult = { ok: true } | { ok: false; message: string };

/**
 * The row the list would have shown for a document the server just returned.
 * Derived locally rather than refetched: a write already answers with the
 * whole document, and the projection is two cheap string operations.
 */
const toSummary = (document: KnowledgeDocument): KnowledgeDocumentSummary => {
  const flat = document.body.replace(/\s+/g, ' ').trim();
  return {
    id: document.id,
    title: document.title,
    preview: flat.length <= PREVIEW_MAX_CHARS ? flat : `${flat.slice(0, PREVIEW_MAX_CHARS)}…`,
    // UTF-8 bytes, the unit the server's cap is measured in.
    sizeBytes: new Blob([document.body]).size,
    source: document.source,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
};

/**
 * The document library. A plain hook rather than a provider: one page consumes
 * it, unlike useAgents and useSessions, which the sidebar shares.
 *
 * Delete is optimistic because the row vanishing is the whole feedback; create
 * and update are request-then-apply, because a document form is a deliberate
 * submit rather than the agent form's debounced autosave.
 */
export const useKnowledge = () => {
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Async continuations must read the current value, not one closed over at
  // render time. Same reason sessionsRef exists in useSessions.
  const documentsRef = useRef<KnowledgeDocumentSummary[]>([]);
  // The last value the server confirmed, per id. Rollback reads from here
  // rather than from a list snapshot, which could carry another edit's
  // still-unconfirmed value.
  const confirmed = useRef(new Map<string, KnowledgeDocumentSummary>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(
    (update: (current: KnowledgeDocumentSummary[]) => KnowledgeDocumentSummary[]) => {
      const next = update(documentsRef.current);
      documentsRef.current = next;
      if (mounted.current) setDocuments(next);
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const fetched = await listDocuments();
      confirmed.current = new Map(fetched.map((item) => [item.id, item]));
      documentsRef.current = fetched;
      if (mounted.current) {
        setDocuments(fetched);
        setError(undefined);
      }
    } catch (thrown) {
      if (mounted.current) setError(messageOf(thrown, "Couldn't load your documents."));
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => {
      if (mounted.current) setLoading(false);
    });
  }, [refresh]);

  const create = useCallback(
    async (draft: DocumentDraft): Promise<SaveDocumentResult> => {
      try {
        const saved = await createDocument(draft);
        const row = toSummary(saved);
        confirmed.current.set(row.id, row);
        // Prepended rather than refetched: the list is newest-updated first,
        // and the response already carries the new row.
        mutate((current) => [row, ...current]);
        return { ok: true, document: saved };
      } catch (thrown) {
        return { ok: false, message: messageOf(thrown, "Couldn't save. Retry.") };
      }
    },
    [mutate],
  );

  const update = useCallback(
    async (id: string, patch: DocumentPatch): Promise<SaveDocumentResult> => {
      try {
        const saved = await updateDocument(id, patch);
        const row = toSummary(saved);
        confirmed.current.set(id, row);
        mutate((current) => current.map((item) => (item.id === id ? row : item)));
        return { ok: true, document: saved };
      } catch (thrown) {
        return { ok: false, message: messageOf(thrown, "Couldn't save. Retry.") };
      }
    },
    [mutate],
  );

  const remove = useCallback(
    async (id: string): Promise<RemoveDocumentResult> => {
      const index = documentsRef.current.findIndex((item) => item.id === id);
      const rollbackTo = confirmed.current.get(id);
      mutate((current) => current.filter((item) => item.id !== id));
      try {
        await deleteDocument(id);
        confirmed.current.delete(id);
        return { ok: true };
      } catch (thrown) {
        if (rollbackTo) {
          // Restored at its old index, so a failed delete does not silently
          // reorder the library.
          mutate((current) => {
            if (current.some((item) => item.id === id)) return current;
            const at = index >= 0 && index <= current.length ? index : current.length;
            const next = [...current];
            next.splice(at, 0, rollbackTo);
            return next;
          });
        }
        return { ok: false, message: messageOf(thrown, "Couldn't delete. Retry.") };
      }
    },
    [mutate],
  );

  return { documents, loading, error, create, update, remove, refresh };
};
