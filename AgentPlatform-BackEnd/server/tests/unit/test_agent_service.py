"""Defaults, identity, timestamps, and 404s.

The service is given a ToolRegistry and a model id set rather than importing
either catalog (spec §4.2), so these tests inject both directly.
"""

from datetime import UTC, datetime

import pytest

from app.core.clock import set_clock
from app.core.errors import BadRequestError, NotFoundError
from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.service import AgentService
from app.modules.tools.base import ToolSchema

MODEL_IDS = {"gemini-3.1-flash-lite"}


class FakeRegistry:
    """Stands in for ToolRegistry. The service only ever calls known_ids()."""

    def __init__(self, ids: set[str]) -> None:
        self._ids = ids

    def known_ids(self) -> set[str]:
        return self._ids

    def list(self) -> list[ToolSchema]:  # pragma: no cover - not used by the service
        return []


@pytest.fixture
def service():
    return AgentService(
        repo=MemoryAgentRepository(),
        tools=FakeRegistry({"current_time", "http_request", "calculator"}),
        model_ids=MODEL_IDS,
        default_model="gemini-3.1-flash-lite",
    )


async def test_create_applies_every_default(service):
    agent = await service.create({})
    assert agent.name == "New agent"
    assert agent.icon == "\U0001f9e9"
    assert agent.description == ""
    assert agent.model == "gemini-3.1-flash-lite"
    assert agent.system_prompt == ""
    assert agent.tool_ids == []
    assert agent.status == "draft"


async def test_create_mints_a_prefixed_id(service):
    agent = await service.create({})
    assert agent.id.startswith("agent_")


async def test_create_ids_are_unique(service):
    first = await service.create({})
    second = await service.create({})
    assert first.id != second.id


async def test_create_sets_both_timestamps_to_the_same_instant(service):
    agent = await service.create({})
    assert agent.created_at == agent.updated_at


async def test_create_overlays_the_supplied_fields(service):
    agent = await service.create(
        {"name": "Custom", "toolIds": ["current_time"], "status": "active"}
    )
    assert agent.name == "Custom"
    assert agent.tool_ids == ["current_time"]
    assert agent.status == "active"


async def test_create_stores_the_agent(service):
    created = await service.create({"name": "Custom"})
    assert (await service.get(created.id)).name == "Custom"


async def test_create_rejects_an_unknown_tool_id(service):
    with pytest.raises(BadRequestError) as exc:
        await service.create({"toolIds": ["nope"]})
    assert exc.value.message == "Unknown tool ids: nope."


async def test_get_raises_not_found_for_an_unknown_id(service):
    with pytest.raises(NotFoundError):
        await service.get("agent_missing")


async def test_update_applies_the_patch(service):
    created = await service.create({"name": "Before"})
    updated = await service.update(created.id, {"name": "After"})
    assert updated.name == "After"
    assert (await service.get(created.id)).name == "After"


async def test_update_leaves_unpatched_fields_alone(service):
    created = await service.create({"name": "Before", "toolIds": ["current_time"]})
    updated = await service.update(created.id, {"name": "After"})
    assert updated.tool_ids == ["current_time"]


async def test_update_never_moves_updated_at_backwards(service):
    created = await service.create({})
    updated = await service.update(created.id, {"name": "After"})
    assert updated.updated_at >= created.updated_at


async def test_update_touches_updated_at_even_for_an_empty_patch(service):
    """Contract §4: updateAgent always moves updatedAt to now."""
    set_clock(lambda: datetime(2026, 8, 4, 12, 0, 0, tzinfo=UTC))
    try:
        created = await service.create({})
        set_clock(lambda: datetime(2026, 8, 4, 13, 0, 0, tzinfo=UTC))
        updated = await service.update(created.id, {})
    finally:
        set_clock(None)

    assert updated.updated_at == "2026-08-04T13:00:00+00:00"
    assert updated.created_at == "2026-08-04T12:00:00+00:00"


async def test_update_ignores_server_owned_keys(service):
    created = await service.create({})
    updated = await service.update(
        created.id, {"id": "agent_hijack", "createdAt": "1999-01-01T00:00:00+00:00"}
    )
    assert updated.id == created.id
    assert updated.created_at == created.created_at


async def test_update_raises_not_found_for_an_unknown_id(service):
    with pytest.raises(NotFoundError):
        await service.update("agent_missing", {"name": "After"})


async def test_update_reports_not_found_before_validating_the_body(service):
    """A recorded free choice — the contract reference is silent (spec §9)."""
    with pytest.raises(NotFoundError):
        await service.update("agent_missing", {"model": "gpt-4"})


async def test_delete_removes_the_agent(service):
    created = await service.create({})
    await service.delete(created.id)
    assert await service.list() == []


async def test_delete_raises_not_found_for_an_unknown_id(service):
    with pytest.raises(NotFoundError):
        await service.delete("agent_missing")


async def test_list_returns_newest_updated_first(service):
    set_clock(lambda: datetime(2026, 8, 4, 12, 0, 0, tzinfo=UTC))
    try:
        first = await service.create({"name": "First"})
        set_clock(lambda: datetime(2026, 8, 4, 13, 0, 0, tzinfo=UTC))
        second = await service.create({"name": "Second"})
    finally:
        set_clock(None)

    assert [a.id for a in await service.list()] == [second.id, first.id]
