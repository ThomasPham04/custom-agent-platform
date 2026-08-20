import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKnowledge } from './useKnowledge';
import * as api from '../lib/api-client';
import type { KnowledgeDocument, KnowledgeDocumentSummary } from '../types/knowledge';

const summary = (
  id: string,
  title: string,
  overrides: Partial<KnowledgeDocumentSummary> = {},
): KnowledgeDocumentSummary => ({
  id,
  title,
  preview: 'preview text',
  sizeBytes: 12,
  source: 'typed',
  createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z',
  ...overrides,
});

const document = (
  id: string,
  title: string,
  body = 'Body text.',
): KnowledgeDocument => ({
  id,
  title,
  body,
  source: 'typed',
  createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z',
});

const LIST = [summary('doc_a', 'A'), summary('doc_b', 'B')];

afterEach(() => vi.restoreAllMocks());

describe('useKnowledge', () => {
  it('loads the library on mount', async () => {
    vi.spyOn(api, 'listDocuments').mockResolvedValue(LIST);
    const { result } = renderHook(() => useKnowledge());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents.map((d) => d.id)).toEqual(['doc_a', 'doc_b']);
  });

  it('reports a failed load without throwing', async () => {
    vi.spyOn(api, 'listDocuments').mockRejectedValue(
      new api.ApiError(500, 'internal_error', 'Document store is unavailable.'),
    );
    const { result } = renderHook(() => useKnowledge());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Document store is unavailable.');
  });

  it('prepends a created document without refetching', async () => {
    const list = vi.spyOn(api, 'listDocuments').mockResolvedValue(LIST);
    vi.spyOn(api, 'createDocument').mockResolvedValue(document('doc_new', 'New'));
    const { result } = renderHook(() => useKnowledge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ title: 'New', body: 'Body text.', source: 'typed' });
    });

    expect(result.current.documents.map((d) => d.id)).toEqual(['doc_new', 'doc_a', 'doc_b']);
    // The response already carried the row, so the list is not fetched again.
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('removes a document optimistically, before the request settles', async () => {
    vi.spyOn(api, 'listDocuments').mockResolvedValue(LIST);
    let release: () => void = () => {};
    vi.spyOn(api, 'deleteDocument').mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    const { result } = renderHook(() => useKnowledge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.remove('doc_a');
    });
    expect(result.current.documents.map((d) => d.id)).toEqual(['doc_b']);

    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.documents.map((d) => d.id)).toEqual(['doc_b']);
  });

  it('restores the row at its old position when the delete fails', async () => {
    vi.spyOn(api, 'listDocuments').mockResolvedValue(LIST);
    vi.spyOn(api, 'deleteDocument').mockRejectedValue(
      new api.ApiError(500, 'internal_error', 'Boom.'),
    );

    const { result } = renderHook(() => useKnowledge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: Awaited<ReturnType<typeof result.current.remove>> | undefined;
    await act(async () => {
      outcome = await result.current.remove('doc_a');
    });

    expect(outcome).toEqual({ ok: false, message: 'Boom.' });
    // Back at index 0, not appended: a failed delete must not reorder the list.
    expect(result.current.documents.map((d) => d.id)).toEqual(['doc_a', 'doc_b']);
  });

  it('reports the server message when a create is rejected', async () => {
    vi.spyOn(api, 'listDocuments').mockResolvedValue([]);
    vi.spyOn(api, 'createDocument').mockRejectedValue(
      new api.ApiError(400, 'bad_request', 'title is required.'),
    );

    const { result } = renderHook(() => useKnowledge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: Awaited<ReturnType<typeof result.current.create>> | undefined;
    await act(async () => {
      outcome = await result.current.create({ title: '', body: 'x', source: 'typed' });
    });

    expect(outcome).toEqual({ ok: false, message: 'title is required.' });
  });

  it('replaces the row in place on update', async () => {
    vi.spyOn(api, 'listDocuments').mockResolvedValue(LIST);
    vi.spyOn(api, 'updateDocument').mockResolvedValue(document('doc_a', 'Renamed'));

    const { result } = renderHook(() => useKnowledge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update('doc_a', { title: 'Renamed' });
    });

    expect(result.current.documents.map((d) => d.title)).toEqual(['Renamed', 'B']);
  });
});
