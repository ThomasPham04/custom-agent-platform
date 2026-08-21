import { useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { DocumentDraft, DocumentSource } from "../../../types/knowledge";
import "./document-form.css";

/**
 * The same cap the server enforces, measured the same way (UTF-8 bytes). The
 * client check exists to give a better message than a 400, not to be the
 * enforcement — the server checks independently.
 */
export const MAX_BODY_BYTES = 100_000;

/**
 * The server's title cap, in the unit it counts: UTF-16 code units, which is
 * what `String.length` returns and what the counter under the field shows.
 */
export const MAX_TITLE_LENGTH = 200;

const ACCEPT = ".txt,.md,text/plain,text/markdown";

const byteLength = (value: string) => new Blob([value]).size;

const count = (value: number) => value.toLocaleString("en-US");

const titleFromFilename = (name: string) => name.replace(/\.[^.]+$/, "");

/** Both fields are mandatory; these are the messages that say so. */
const MISSING_TITLE = "Give the document a title.";
const MISSING_BODY = "Add some text to search.";

/*
  Decorative: the field it marks also carries `required`, which is what a screen
  reader announces. It sits beside the label rather than inside it so the label's
  text stays exactly "Title" / "Text".
*/
const RequiredMark = () => (
  <span className="document-form__required" aria-hidden="true">
    *
  </span>
);

/**
 * FileReader rather than `file.text()`: jsdom's File does not implement the
 * Blob text method, so the shorter call works in every browser and in none of
 * the tests.
 */
const readAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsText(file);
  });

interface DocumentFormProps {
  initial?: { title: string; body: string };
  submitLabel: string;
  onSubmit: (
    draft: DocumentDraft,
  ) => Promise<{ ok: boolean; message?: string }>;
  onCancel?: () => void;
  /**
   * `card` is the standalone add form on the page, which draws its own border.
   * `panel` is the same form filling the detail peek, which already has one —
   * there it loses the card, grows the text field to the height of the pane,
   * and pins its actions to the bottom.
   */
  variant?: "card" | "panel";
}

export const DocumentForm = ({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  variant = "card",
}: DocumentFormProps) => {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [source, setSource] = useState<DocumentSource>("typed");
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  // Latched by the first rejected submit. Until then a half-filled form is not
  // scolded; after it, the messages follow the fields live.
  const [checked, setChecked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Scoped ids: the page can show the add form and the detail panel at once,
  // and two elements sharing an id would break both labels' associations.
  const ids = useId();
  const bodyBytes = byteLength(body);
  const missingTitle = checked && !title.trim();
  const missingBody = checked && !body.trim();
  // The peek footer is shared furniture with the agent panel, which sets its
  // actions at sm. On the page the form stands alone and takes the page size.
  const size = variant === "panel" ? "button--sm" : "button--md";

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let text: string;
    try {
      text = await readAsText(file);
    } catch {
      setMessage("Couldn't read that file. Try again.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (byteLength(text) > MAX_BODY_BYTES) {
      setMessage(
        `That file is larger than the ${count(MAX_BODY_BYTES)} byte limit. Trim it and try again.`,
      );
      // Cleared so the same file can be picked again after trimming.
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setMessage(undefined);
    setBody(text);
    setSource("upload");
    if (!title.trim()) setTitle(titleFromFilename(file.name));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      // Reported on the fields themselves, so the shared line stays free for
      // failures that belong to no single field.
      setChecked(true);
      setMessage(undefined);
      return;
    }
    setChecked(false);
    // Typing and pasting can pass the cap the file picker already guards, and
    // the counter has been red for a while by the time this fires.
    if (byteLength(trimmedBody) > MAX_BODY_BYTES) {
      setMessage(
        `That text is larger than the ${count(MAX_BODY_BYTES)} byte limit. Trim it and try again.`,
      );
      return;
    }

    setSaving(true);
    const result = await onSubmit({
      title: trimmedTitle,
      body: trimmedBody,
      source,
    });
    setSaving(false);
    setMessage(result.ok ? undefined : result.message);
  };

  return (
    <form
      className={`document-form document-form--${variant}`}
      noValidate
      onSubmit={submit}
    >
      <div className="document-form__fields">
        <div className="document-form__head">
          <span className="document-form__caption">
            <label className="document-form__label" htmlFor={`${ids}-title`}>
              Title
            </label>
            <RequiredMark />
          </span>
          <span className="document-form__count mono">
            {count(title.length)}/{count(MAX_TITLE_LENGTH)} characters
          </span>
        </div>
        <input
          id={`${ids}-title`}
          className="document-form__input"
          maxLength={MAX_TITLE_LENGTH}
          required
          aria-invalid={missingTitle || undefined}
          aria-describedby={missingTitle ? `${ids}-title-error` : undefined}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {missingTitle && (
          <p
            className="document-form__error"
            id={`${ids}-title-error`}
            role="alert"
          >
            {MISSING_TITLE}
          </p>
        )}

        <div className="document-form__head">
          <span className="document-form__caption">
            <label className="document-form__label" htmlFor={`${ids}-body`}>
              Text
            </label>
            <RequiredMark />
          </span>
          {/*
            Bytes, not characters: the cap is on storage, so an emoji spends
            four of these and one of the title's. Each counter names its unit
            rather than leaving the reader to assume they are the same.
          */}
          <span
            className={[
              "document-form__count mono",
              bodyBytes > MAX_BODY_BYTES ? "document-form__count--over" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {count(bodyBytes)}/{count(MAX_BODY_BYTES)} bytes
          </span>
        </div>
        <textarea
          id={`${ids}-body`}
          className="document-form__textarea"
          rows={12}
          required
          aria-invalid={missingBody || undefined}
          aria-describedby={missingBody ? `${ids}-body-error` : undefined}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setSource("typed");
          }}
        />
        {missingBody && (
          <p
            className="document-form__error"
            id={`${ids}-body-error`}
            role="alert"
          >
            {MISSING_BODY}
          </p>
        )}

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
      </div>

      <div className="document-form__actions">
        {onCancel !== undefined && (
          <button
            className={`button button--secondary ${size}`}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className={`button button--primary ${size}`}
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
};
