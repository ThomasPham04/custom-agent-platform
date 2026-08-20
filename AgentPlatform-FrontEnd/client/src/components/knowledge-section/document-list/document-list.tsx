import type { KnowledgeDocumentSummary } from '../../../types/knowledge';
import './document-list.css';

const formatBytes = (bytes: number) =>
  bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;

interface DocumentListProps {
  documents: KnowledgeDocumentSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export const DocumentList = ({ documents, onOpen, onDelete }: DocumentListProps) => (
  <ul className="document-list">
    {documents.map((document) => (
      <li key={document.id} className="document-list__row">
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
