import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DocumentDetail } from '../../components/knowledge-section/document-detail/document-detail';
import { DocumentForm } from '../../components/knowledge-section/document-form/document-form';
import { DocumentList } from '../../components/knowledge-section/document-list/document-list';
import { useKnowledge } from '../../hooks/useKnowledge';
import { ApiError, getDocument } from '../../lib/api-client';
import type { DocumentDraft, KnowledgeDocument } from '../../types/knowledge';
import './knowledge.css';

const KnowledgePage = () => {
  const { documents, loading, error, create, update, remove } = useKnowledge();
  const location = useLocation();
  const navigate = useNavigate();
  // Route-driven, the same arrangement /agents/new uses and for the same
  // reason: the walkthrough can only navigate, never press a control, so the
  // form has to be reachable by URL for a tour to show what is inside it.
  // /knowledge/new means "form open", anything else means closed.
  const adding = location.pathname === '/knowledge/new';
  const [open, setOpen] = useState<KnowledgeDocument>();
  const [notice, setNotice] = useState<string>();

  // The list carries previews, not bodies, so opening one fetches its text.
  const openDocument = useCallback(async (id: string) => {
    try {
      setOpen(await getDocument(id));
    } catch (thrown) {
      setNotice(thrown instanceof ApiError ? thrown.message : "Couldn't open that document.");
    }
  }, []);

  useEffect(() => {
    if (notice === undefined) return;
    const timer = window.setTimeout(() => setNotice(undefined), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const addDocument = async (draft: DocumentDraft) => {
    const result = await create(draft);
    if (result.ok) navigate('/knowledge');
    return result;
  };

  const saveOpen = async (draft: DocumentDraft) => {
    if (open === undefined) return { ok: false, message: 'No document is open.' };
    const result = await update(open.id, { title: draft.title, body: draft.body });
    if (result.ok) setOpen(undefined);
    return result;
  };

  const deleteDocument = async (id: string) => {
    const result = await remove(id);
    if (!result.ok) setNotice(result.message);
  };

  return (
    <div className="knowledge">
      <header className="knowledge__header">
        <h1 className="knowledge__title">Knowledge</h1>
        <p className="knowledge__subtitle">
          Documents any agent with Knowledge search attached can read.
        </p>
        <button
          type="button"
          className="knowledge__add"
          data-walkthrough="knowledge-add"
          onClick={() => navigate(adding ? '/knowledge' : '/knowledge/new')}
        >
          {adding ? 'Cancel' : 'Add document'}
        </button>
      </header>

      {notice !== undefined && (
        <p className="knowledge__notice" role="alert">
          {notice}
        </p>
      )}
      {error !== undefined && (
        <p className="knowledge__notice" role="alert">
          {error}
        </p>
      )}

      {adding && (
        <div className="knowledge__form" data-walkthrough="knowledge-form">
          <DocumentForm
            submitLabel="Add document"
            onSubmit={addDocument}
            onCancel={() => navigate('/knowledge')}
          />
        </div>
      )}

      {loading ? (
        <p className="knowledge__empty">Loading your documents…</p>
      ) : documents.length === 0 ? (
        <p className="knowledge__empty">
          No documents yet. Add one to give your agents something to search.
        </p>
      ) : (
        <DocumentList
          documents={documents}
          onOpen={(id) => void openDocument(id)}
          onDelete={(id) => void deleteDocument(id)}
        />
      )}

      {open !== undefined && (
        <DocumentDetail document={open} onSave={saveOpen} onClose={() => setOpen(undefined)} />
      )}
    </div>
  );
};

export default KnowledgePage;
