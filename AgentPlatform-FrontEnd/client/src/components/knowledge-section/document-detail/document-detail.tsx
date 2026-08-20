import { useEffect, useRef } from "react";
import { BREAKPOINT_SHEET, useMediaQuery } from "../../../hooks/useMediaQuery";
import { useModalFocus } from "../../../hooks/useModalFocus";
import type {
  DocumentDraft,
  KnowledgeDocument,
} from "../../../types/knowledge";
import { DocumentForm } from "../document-form/document-form";
import "./document-detail.css";

interface DocumentDetailProps {
  document: KnowledgeDocument;
  onSave: (draft: DocumentDraft) => Promise<{ ok: boolean; message?: string }>;
  onClose: () => void;
}

export const DocumentDetail = ({
  document,
  onSave,
  onClose,
}: DocumentDetailProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const isSheet = useMediaQuery(BREAKPOINT_SHEET);

  /*
    Focus is trapped only in the sheet, which is the one shape that covers the
    page. Beside the list the panel is a column like any other, and trapping
    Tab there would strand a keyboard user inside an editor they can see past.
    Same rule, same hook, as the agent panel.
  */
  useModalFocus({
    active: isSheet,
    containerRef: panelRef,
    isolateOutside: true,
  });

  // Esc closes the peek, matching the agent panel and the popover.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={["document-detail", isSheet ? "document-detail--sheet" : ""]
        .filter(Boolean)
        .join(" ")}
      ref={panelRef}
      role="dialog"
      aria-modal={isSheet ? "true" : "false"}
      aria-label={document.title}
    >
      <header className="document-detail__header">
        <h2 className="document-detail__title">{document.title}</h2>
        <button
          type="button"
          className="document-detail__close"
          aria-label="Close"
          onClick={onClose}
        >
          <svg
            viewBox="0 0 14 14"
            width="12"
            height="12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      {/*
        Keyed by id so opening a second document remounts the form. DocumentForm
        seeds its state from `initial` through useState, which reads it once —
        without the key, the panel would show the previous document's text.
      */}
      <DocumentForm
        key={document.id}
        variant="panel"
        initial={{ title: document.title, body: document.body }}
        submitLabel="Save changes"
        onSubmit={onSave}
        onCancel={onClose}
      />
    </div>
  );
};
