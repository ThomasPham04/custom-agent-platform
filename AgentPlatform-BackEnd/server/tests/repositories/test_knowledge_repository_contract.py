"""One set of assertions, two implementations.

A ranking that holds in memory and not in Postgres is a bug that reaches
production looking like a frontend problem, which is why both stores share a
scoring function and this file.
"""

from datetime import UTC, datetime

from app.modules.knowledge.schemas import KnowledgeDocument

EARLY = datetime(2026, 1, 1, tzinfo=UTC)
LATE = datetime(2026, 2, 1, tzinfo=UTC)


def make_document(
    document_id: str, title: str, body: str, stamp: datetime = EARLY
) -> KnowledgeDocument:
    return KnowledgeDocument(
        id=document_id,
        title=title,
        body=body,
        source="typed",
        created_at=stamp,
        updated_at=stamp,
    )


async def test_a_created_document_reads_back(knowledge_repo):
    created = await knowledge_repo.create(make_document("doc_a", "A", "body text"))
    assert created.id == "doc_a"
    fetched = await knowledge_repo.get("doc_a")
    assert fetched is not None
    assert fetched.title == "A"
    assert fetched.body == "body text"
    assert fetched.source == "typed"


async def test_an_unknown_id_reads_as_none(knowledge_repo):
    assert await knowledge_repo.get("doc_missing") is None


async def test_the_list_is_newest_updated_first(knowledge_repo):
    await knowledge_repo.create(make_document("doc_old", "Old", "body", EARLY))
    await knowledge_repo.create(make_document("doc_new", "New", "body", LATE))
    listed = await knowledge_repo.list(limit=100)
    assert [d.id for d in listed] == ["doc_new", "doc_old"]


async def test_the_list_honours_the_limit(knowledge_repo):
    await knowledge_repo.create(make_document("doc_old", "Old", "body", EARLY))
    await knowledge_repo.create(make_document("doc_new", "New", "body", LATE))
    assert len(await knowledge_repo.list(limit=1)) == 1


async def test_an_update_applies_the_fields_and_stamps_updated_at(knowledge_repo):
    await knowledge_repo.create(make_document("doc_a", "A", "body", EARLY))
    updated = await knowledge_repo.update("doc_a", {"title": "Renamed"})
    assert updated is not None
    assert updated.title == "Renamed"
    assert updated.body == "body"
    assert updated.updated_at > EARLY


async def test_an_empty_update_changes_nothing(knowledge_repo):
    await knowledge_repo.create(make_document("doc_a", "A", "body", EARLY))
    unchanged = await knowledge_repo.update("doc_a", {})
    assert unchanged is not None
    assert unchanged.updated_at == EARLY


async def test_updating_an_unknown_id_returns_none(knowledge_repo):
    assert await knowledge_repo.update("doc_missing", {"title": "x"}) is None


async def test_delete_reports_whether_a_row_went(knowledge_repo):
    await knowledge_repo.create(make_document("doc_a", "A", "body"))
    assert await knowledge_repo.delete("doc_a") is True
    assert await knowledge_repo.delete("doc_a") is False


async def test_search_ranks_by_score_and_skips_non_matches(knowledge_repo):
    await knowledge_repo.create(
        make_document("doc_both", "Refund policy", "The refund window is 30 days.")
    )
    await knowledge_repo.create(
        make_document("doc_one", "Billing", "The window closes monthly.")
    )
    await knowledge_repo.create(make_document("doc_none", "Bicycles", "Nothing here."))
    hits = await knowledge_repo.search("refund window", limit=5)
    assert [h.id for h in hits] == ["doc_both", "doc_one"]
    assert hits[0].score == 1.0
    assert hits[1].score == 0.5


async def test_search_honours_the_limit(knowledge_repo):
    await knowledge_repo.create(make_document("doc_a", "Refund A", "refund"))
    await knowledge_repo.create(make_document("doc_b", "Refund B", "refund"))
    assert len(await knowledge_repo.search("refund", limit=1)) == 1


async def test_search_carries_a_snippet(knowledge_repo):
    await knowledge_repo.create(
        make_document("doc_a", "Refunds", "Refunds take 30 days to clear.")
    )
    hits = await knowledge_repo.search("refunds", limit=5)
    assert hits[0].snippet == "Refunds take 30 days to clear."
