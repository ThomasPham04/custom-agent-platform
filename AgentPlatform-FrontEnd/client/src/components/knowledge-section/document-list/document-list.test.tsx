import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentList } from "./document-list";
import type { KnowledgeDocumentSummary } from "../../../types/knowledge";

const document = (
  over: Partial<KnowledgeDocumentSummary> = {},
): KnowledgeDocumentSummary => ({
  id: "doc_1",
  title: "Refunds — 30 day window",
  preview: "Refunds are available within 30 days of the invoice date.",
  sizeBytes: 120,
  source: "seed",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

describe("DocumentList", () => {
  it("shows a row as its title and the opening of its text, and nothing else", () => {
    render(
      <DocumentList
        documents={[document()]}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Refunds — 30 day window")).toBeInTheDocument();
    expect(screen.getByText(/Refunds are available/)).toBeInTheDocument();
    // The row carries no size and no seed badge: neither tells a reader
    // anything they can act on, and both crowded the title.
    expect(screen.queryByText("Sample")).not.toBeInTheDocument();
    expect(screen.queryByText(/120 B/)).not.toBeInTheDocument();
  });

  /*
    The delete control is an icon, so its accessible name is the only thing a
    screen reader has to tell one row's trash can from another's.
  */
  it("names the document in the delete control and deletes that one", async () => {
    const onDelete = vi.fn();
    render(
      <DocumentList
        documents={[
          document(),
          document({ id: "doc_2", title: "Proration on downgrade" }),
        ]}
        onOpen={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Proration on downgrade" }),
    );
    expect(onDelete).toHaveBeenCalledWith("doc_2");
  });

  it("opens the document the reader pressed", async () => {
    const onOpen = vi.fn();
    render(
      <DocumentList
        documents={[document()]}
        onOpen={onOpen}
        onDelete={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText("Refunds — 30 day window"));
    expect(onOpen).toHaveBeenCalledWith("doc_1");
  });
});
