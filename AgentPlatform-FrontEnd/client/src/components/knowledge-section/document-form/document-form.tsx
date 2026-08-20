import { useId, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { DocumentDraft, DocumentSource } from '../../../types/knowledge';
import './document-form.css';

/**
 * The same cap the server enforces, measured the same way (UTF-8 bytes). The
 * client check exists to give a better message than a 400, not to be the
 * enforcement — the server checks independently.
 */
export const MAX_BODY_BYTES = 100_000;

const ACCEPT = '.txt,.md,text/plain,text/markdown';

const byteLength = (value: string) => new Blob([value]).size;

const titleFromFilename = (name: string) => name.replace(/\.[^.]+$/, '');

/**
 * FileReader rather than `file.text()`: jsdom's File does not implement the
 * Blob text method, so the shorter call works in every browser and in none of
 * the tests.
 */
const readAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'));
    reader.readAsText(file);
  });

interface DocumentFormProps {
  initial?: { title: string; body: string };
  submitLabel: string;
  onSubmit: (draft: DocumentDraft) => Promise<{ ok: boolean; message?: string }>;
  onCancel?: () => void;
}

export const DocumentForm = ({ initial, submitLabel, onSubmit, onCancel }: DocumentFormProps) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [source, setSource] = useState<DocumentSource>('typed');
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Scoped ids: the page can show the add form and the detail panel at once,
  // and two elements sharing an id would break both labels' associations.
  const ids = useId();

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let text: string;
    try {
      text = await readAsText(file);
    } catch {
      setMessage("Couldn't read that file. Try again.");
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    if (byteLength(text) > MAX_BODY_BYTES) {
      setMessage(
        `That file is larger than the ${MAX_BODY_BYTES.toLocaleString('en-US')} byte limit. Trim it and try again.`,
      );
      // Cleared so the same file can be picked again after trimming.
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setMessage(undefined);
    setBody(text);
    setSource('upload');
    if (!title.trim()) setTitle(titleFromFilename(file.name));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      setMessage('Give the document a title.');
      return;
    }
    if (!trimmedBody) {
      setMessage('Add some text to search.');
      return;
    }

    setSaving(true);
    const result = await onSubmit({ title: trimmedTitle, body: trimmedBody, source });
    setSaving(false);
    setMessage(result.ok ? undefined : result.message);
  };

  return (
    <form className="document-form" onSubmit={submit}>
      <label className="document-form__label" htmlFor={`${ids}-title`}>
        Title
      </label>
      <input
        id={`${ids}-title`}
        className="document-form__input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <label className="document-form__label" htmlFor={`${ids}-body`}>
        Text
      </label>
      <textarea
        id={`${ids}-body`}
        className="document-form__textarea"
        rows={12}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setSource('typed');
        }}
      />

      <label className="document-form__label" htmlFor={`${ids}-file`}>
        Upload a .txt or .md file
      </label>
      <input
        id={`${ids}-file`}
        ref={fileRef}
        className="document-form__file"
        type="file"
        accept={ACCEPT}
        onChange={(event) => void readFile(event)}
      />

      {message !== undefined && (
        <p className="document-form__message" role="alert">
          {message}
        </p>
      )}

      <div className="document-form__actions">
        <button className="document-form__submit" type="submit" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel !== undefined && (
          <button className="document-form__cancel" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
