"""Knowledge document wire schemas.

Two models, deliberately. The list route returns summaries and the detail
route returns the body: a library of fifty 100 KB documents would otherwise
ship several megabytes on every page load.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from app.core.wire import WireModel
from app.modules.knowledge.search import collapse_whitespace

PREVIEW_MAX_CHARS = 200

DocumentSource = Literal["typed", "upload", "seed"]


class KnowledgeDocument(WireModel):
    id: str
    title: str
    body: str
    source: DocumentSource
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentSummary(WireModel):
    """What the list route returns: everything except the text itself."""

    id: str
    title: str
    preview: str
    size_bytes: int
    source: DocumentSource
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class SearchHit:
    """One knowledge_search result.

    Not a WireModel: it never crosses the wire on its own. It reaches the
    client embedded in a tool result, which run_tool_calls stores as opaque
    JSONB and no alias generator runs over — so the keys are written out
    literally by to_dict().
    """

    id: str
    title: str
    snippet: str
    score: float

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "title": self.title,
            "snippet": self.snippet,
            "score": self.score,
        }


def to_summary(document: KnowledgeDocument) -> KnowledgeDocumentSummary:
    flat = collapse_whitespace(document.body)
    preview = flat if len(flat) <= PREVIEW_MAX_CHARS else f"{flat[:PREVIEW_MAX_CHARS]}…"
    return KnowledgeDocumentSummary(
        id=document.id,
        title=document.title,
        preview=preview,
        # UTF-8 bytes, the unit the body cap is enforced in. Showing characters
        # here would let a document look comfortably inside a limit it breaks.
        size_bytes=len(document.body.encode("utf-8")),
        source=document.source,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )
