export type DocumentSource = 'typed' | 'upload' | 'seed';

/** What the detail route returns: the document including its text. */
export interface KnowledgeDocument {
  id: string;
  title: string;
  body: string;
  source: DocumentSource;
  createdAt: string;
  updatedAt: string;
}

/**
 * What the list route returns. No body: a library of fifty 100 KB documents
 * would otherwise ship several megabytes on every page load.
 */
export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  preview: string;
  sizeBytes: number;
  source: DocumentSource;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDraft {
  title: string;
  body: string;
  source: DocumentSource;
}

/** source is absent on purpose: the server drops it from a patch. */
export type DocumentPatch = Partial<Pick<KnowledgeDocument, 'title' | 'body'>>;
