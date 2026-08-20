"""Ids, timestamps, and not-found handling.

The service holds no search logic: the tool calls the repository's search
directly, the way catalog reads use injected ports.
"""

import pytest

from app.core.errors import NotFoundError
from app.modules.knowledge.repositories.memory import MemoryKnowledgeRepository
from app.modules.knowledge.service import KnowledgeService

pytestmark = pytest.mark.anyio

CAP = 100_000


def make_service() -> KnowledgeService:
    return KnowledgeService(repo=MemoryKnowledgeRepository(), max_body_bytes=CAP)


async def test_create_generates_a_prefixed_id():
    created = await make_service().create(
        {"title": "A title", "body": "text", "source": "typed"}
    )
    assert created.id.startswith("doc_")


async def test_create_stamps_both_timestamps_identically():
    created = await make_service().create(
        {"title": "A title", "body": "text", "source": "typed"}
    )
    assert created.created_at == created.updated_at


async def test_create_defaults_the_source_when_the_fields_omit_it():
    created = await make_service().create({"title": "A title", "body": "text"})
    assert created.source == "typed"


async def test_get_raises_not_found_for_an_unknown_id():
    with pytest.raises(NotFoundError) as excinfo:
        await make_service().get("doc_missing")
    assert excinfo.value.message == 'No document with id "doc_missing".'


async def test_update_raises_not_found_for_an_unknown_id():
    with pytest.raises(NotFoundError):
        await make_service().update("doc_missing", {"title": "x"})


async def test_delete_raises_not_found_for_an_unknown_id():
    with pytest.raises(NotFoundError):
        await make_service().delete("doc_missing")


async def test_update_returns_the_patched_document():
    service = make_service()
    created = await service.create({"title": "A title", "body": "text"})
    updated = await service.update(created.id, {"title": "Renamed"})
    assert updated.title == "Renamed"
    assert updated.body == "text"


async def test_the_body_cap_is_readable_from_the_service():
    assert make_service().max_body_bytes == CAP
