import { useEffect, useRef } from 'react';
import { useModalFocus } from '../../../hooks/useModalFocus';
import type { DocumentDraft, KnowledgeDocument } from '../../../types/knowledge';
import { DocumentForm } from '../document-form/document-form';
import './document-detail.css';

interface DocumentDetailProps {
  document: KnowledgeDocument;
  onSave: (draft: DocumentDraft) => Promise<{ ok: boolean; message?: string }>;
  onClose: () => void;
}

export const DocumentDetail = ({ document, onSave, onClose }: DocumentDetailProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // The same hook the Agents peek uses, rather than a second implementation:
  // it traps Tab inside the panel and returns focus to whatever opened it.
  useModalFocus({ active: true, containerRef: panelRef });

  // Esc closes the peek, matching the Agents peek and the popover.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="document-detail" ref={panelRef} role="dialog" aria-label={document.title}>
      <header className="document-detail__header">
        <h2 className="document-detail__title">{document.title}</h2>
        <button
          type="button"
          className="document-detail__close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      {/*
        Keyed by id so opening a second document remounts the form. DocumentForm
        seeds its state from `initial` through useState, which reads it once —
        without the key, the panel would show the previous document's text.
      */}
      <DocumentForm
        key={document.id}
        initial={{ title: document.title, body: document.body }}
        submitLabel="Save changes"
        onSubmit={onSave}
        onCancel={onClose}
      />
    </div>
  );
};
