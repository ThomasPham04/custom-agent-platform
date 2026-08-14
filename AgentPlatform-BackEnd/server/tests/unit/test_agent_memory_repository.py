"""The memory store is a real implementation, not a mock (spec §5.3).

Express's store deep-cloned on every read and sorted by updatedAt descending;
both are contract, and Phase 2's Postgres implementation has to match.
"""

import pytest

from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.schemas import Agent


def make_agent(agent_id: str, updated_at: str = "2026-08-04T12:00:00+00:00") -> Agent:
    return Agent(
        id=agent_id,
        name="Test agent",
        icon="\U0001f9e9",
        description="",
        model="gemini-3.1-flash-lite",
        system_prompt="",
        tool_ids=["current_time"],
        status="draft",
        created_at="2026-08-01T12:00:00+00:00",
        updated_at=updated_at,
    )


async def test_starts_empty_without_a_seed():
    repo = MemoryAgentRepository()
    assert await repo.list() == []


async def test_seeded_agents_are_present():
    repo = MemoryAgentRepository(seed=[make_agent("agent_a")])
    assert [a.id for a in await repo.list()] == ["agent_a"]


async def test_create_then_get_round_trips():
    repo = MemoryAgentRepository()
    created = await repo.create(make_agent("agent_a"))
    assert created.id == "agent_a"
    assert (await repo.get("agent_a")).name == "Test agent"


async def test_get_returns_none_for_an_unknown_id():
    repo = MemoryAgentRepository()
    assert await repo.get("agent_missing") is None


async def test_update_replaces_the_stored_agent():
    repo = MemoryAgentRepository(seed=[make_agent("agent_a")])
    stored = await repo.get("agent_a")
    await repo.update(stored.model_copy(update={"name": "Renamed"}))
    assert (await repo.get("agent_a")).name == "Renamed"


async def test_delete_reports_whether_it_removed_anything():
    repo = MemoryAgentRepository(seed=[make_agent("agent_a")])
    assert await repo.delete("agent_a") is True
    assert await repo.delete("agent_a") is False
    assert await repo.list() == []


async def test_list_sorts_by_updated_at_descending():
    repo = MemoryAgentRepository(
        seed=[
            make_agent("agent_old", updated_at="2026-08-01T12:00:00+00:00"),
            make_agent("agent_new", updated_at="2026-08-09T12:00:00+00:00"),
            make_agent("agent_mid", updated_at="2026-08-04T12:00:00+00:00"),
        ]
    )
    assert [a.id for a in await repo.list()] == ["agent_new", "agent_mid", "agent_old"]


@pytest.mark.parametrize("read", ["list", "get"])
async def test_reads_are_deep_clones(read):
    """Contract §4: callers cannot mutate stored state. tool_ids is a list, so a
    shallow copy would still hand out the stored object's own list."""
    repo = MemoryAgentRepository(seed=[make_agent("agent_a")])
    fetched = (await repo.list())[0] if read == "list" else await repo.get("agent_a")

    fetched.name = "Mutated"
    fetched.tool_ids.append("calculator")

    stored = await repo.get("agent_a")
    assert stored.name == "Test agent"
    assert stored.tool_ids == ["current_time"]


async def test_create_does_not_store_the_caller_s_object():
    repo = MemoryAgentRepository()
    incoming = make_agent("agent_a")
    await repo.create(incoming)

    incoming.tool_ids.append("calculator")

    assert (await repo.get("agent_a")).tool_ids == ["current_time"]
