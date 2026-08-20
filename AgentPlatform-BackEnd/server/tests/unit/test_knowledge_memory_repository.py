"""The memory store's own behaviour.

The shared contract suite in tests/repositories/ holds this and Postgres to
one behaviour; this file covers the seeding constructor, which is
memory-only.
"""

from datetime import UTC, datetime

import pytest

from app.modules.knowledge.repositories.memory import MemoryKnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeDocument
from app.modules.knowledge.seeds import SEED_DOCUMENTS

pytestmark = pytest.mark.anyio

STAMP = datetime(2026, 1, 1, tzinfo=UTC)


def make_document(document_id: str, title: str, body: str) -> KnowledgeDocument:
    return KnowledgeDocument(
        id=document_id,
        title=title,
        body=body,
        source="typed",
        created_at=STAMP,
        updated_at=STAMP,
    )


async def test_a_seeded_store_lists_the_seed_documents():
    repo = MemoryKnowledgeRepository(seed=SEED_DOCUMENTS)
    listed = await repo.list(limit=100)
    assert {d.id for d in listed} == {d.id for d in SEED_DOCUMENTS}


async def test_an_unseeded_store_is_empty():
    repo = MemoryKnowledgeRepository()
    assert await repo.list(limit=100) == []


async def test_mutating_a_returned_document_cannot_reach_stored_state():
    repo = MemoryKnowledgeRepository()
    await repo.create(make_document("doc_a", "A", "body"))
    fetched = await repo.get("doc_a")
    assert fetched is not None
    fetched.title = "Mutated"
    again = await repo.get("doc_a")
    assert again is not None
    assert again.title == "A"


async def test_an_empty_patch_leaves_updated_at_alone():
    repo = MemoryKnowledgeRepository()
    await repo.create(make_document("doc_a", "A", "body"))
    unchanged = await repo.update("doc_a", {})
    assert unchanged is not None
    assert unchanged.updated_at == STAMP


async def test_search_returns_a_snippet_and_skips_non_matches():
    repo = MemoryKnowledgeRepository()
    await repo.create(make_document("doc_a", "Refunds", "Refunds take 30 days."))
    await repo.create(make_document("doc_b", "Bicycles", "Nothing relevant."))
    hits = await repo.search("refunds", limit=5)
    assert [h.id for h in hits] == ["doc_a"]
    assert hits[0].snippet == "Refunds take 30 days."
    assert hits[0].score == 1.0
