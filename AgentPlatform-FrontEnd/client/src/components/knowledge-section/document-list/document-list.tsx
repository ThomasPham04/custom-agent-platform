import type { KnowledgeDocumentSummary } from '../../../types/knowledge';
import './document-list.css';

const formatBytes = (bytes: number) =>
  bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;

interface DocumentListProps {
  documents: KnowledgeDocumentSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

/*
  Every row carries knowledge-document, not just the first. A walkthrough step
  resolves its target with querySelector, so the top row is the one that gets
  spotlighted either way — and a literal attribute is what the registry guard
  in walkthroughs.test.ts can actually see. Behind an index ternary the marker
  scans as missing and the step silently degrades to a centered card.
*/
export const DocumentList = ({ documents, onOpen, onDelete }: DocumentListProps) => (
  <ul className="document-list" data-walkthrough="knowledge-list">
    {documents.map((document) => (
      <li key={document.id} className="document-list__row" data-walkthrough="knowledge-document">
        <button type="button" className="document-list__open" onClick={() => onOpen(document.id)}>
          <span className="document-list__title">{document.title}</span>
          <span className="document-list__preview">{document.preview}</span>
        </button>
        <span className="document-list__meta">
          {document.source === 'seed' && <span className="document-list__badge">Sample</span>}
          {formatBytes(document.sizeBytes)}
        </span>
        <button
          type="button"
          className="document-list__delete"
          aria-label={`Delete ${document.title}`}
          onClick={() => onDelete(document.id)}
        >
          Delete
        </button>
      </li>
    ))}
  </ul>
);
