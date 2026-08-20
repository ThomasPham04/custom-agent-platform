"""Wire spelling and the summary projection.

camelCase is not cosmetic here: a snake_case key reaches the frontend as
undefined with no error anywhere.
"""

from datetime import UTC, datetime

from app.modules.knowledge.schemas import (
    PREVIEW_MAX_CHARS,
    KnowledgeDocument,
    SearchHit,
    to_summary,
)
from app.modules.knowledge.seeds import SEED_DOCUMENTS

STAMP = datetime(2026, 1, 1, tzinfo=UTC)


def make_document(body: str = "Body text.") -> KnowledgeDocument:
    return KnowledgeDocument(
        id="doc_test",
        title="A title",
        body=body,
        source="typed",
        created_at=STAMP,
        updated_at=STAMP,
    )


def test_the_document_serialises_camelcase():
    dumped = make_document().model_dump(by_alias=True)
    assert "createdAt" in dumped
    assert "created_at" not in dumped


def test_the_summary_serialises_camelcase():
    dumped = to_summary(make_document()).model_dump(by_alias=True)
    assert "sizeBytes" in dumped
    assert "size_bytes" not in dumped


def test_the_summary_carries_no_body():
    assert "body" not in to_summary(make_document()).model_dump(by_alias=True)


def test_the_preview_is_the_flattened_body_when_it_is_short():
    assert to_summary(make_document("  a\n\nb  ")).preview == "a b"


def test_the_preview_truncates_with_an_ellipsis():
    summary = to_summary(make_document("q" * 400))
    assert summary.preview == ("q" * PREVIEW_MAX_CHARS) + "…"


def test_size_bytes_counts_utf8_not_characters():
    # Two characters, six UTF-8 bytes. sizeBytes is what the body cap measures,
    # so the UI must show the same unit the server enforces.
    assert to_summary(make_document("日本")).size_bytes == 6


def test_a_search_hit_serialises_to_exactly_four_keys():
    hit = SearchHit(id="doc_test", title="A title", snippet="Body text.", score=0.5)
    assert hit.to_dict() == {
        "id": "doc_test",
        "title": "A title",
        "snippet": "Body text.",
        "score": 0.5,
    }


def test_the_seed_documents_are_the_four_demo_entries():
    assert [d.id for d in SEED_DOCUMENTS] == [
        "doc_refunds",
        "doc_proration",
        "doc_usage",
        "doc_status",
    ]
    assert all(d.source == "seed" for d in SEED_DOCUMENTS)


def test_the_refund_seed_keeps_the_title_the_mock_fixture_quotes():
    assert SEED_DOCUMENTS[0].title == "Refunds — 30 day window"
