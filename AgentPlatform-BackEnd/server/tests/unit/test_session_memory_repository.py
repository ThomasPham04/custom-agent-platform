"""The memory store is the reference implementation: the Postgres one is held to
the same contract in tests/repositories/test_repository_contract.py."""

from datetime import UTC, datetime

import pytest

from app.modules.sessions.repositories.memory import MemorySessionRepository
from app.modules.sessions.schemas import Session

pytestmark = pytest.mark.anyio


def session(session_id: str = "sess_a", agent_id: str = "agent_support", **over) -> Session:
    base = dict(
        id=session_id,
        agent_id=agent_id,
        title="Refund question",
        created_at=datetime(2026, 8, 16, 9, 0, tzinfo=UTC),
        updated_at=datetime(2026, 8, 16, 9, 0, tzinfo=UTC),
    )
    base.update(over)
    return Session(**base)


async def test_create_then_get_round_trips():
    repo = MemorySessionRepository()
    await repo.create(session())
    assert (await repo.get("sess_a")).title == "Refund question"


async def test_get_returns_none_for_an_unknown_id():
    assert await MemorySessionRepository().get("sess_missing") is None


async def test_list_orders_by_most_recent_activity():
    repo = MemorySessionRepository()
    await repo.create(session("sess_old", updated_at=datetime(2026, 8, 16, 8, 0, tzinfo=UTC)))
    await repo.create(session("sess_new", updated_at=datetime(2026, 8, 16, 10, 0, tzinfo=UTC)))
    assert [s.id for s in await repo.list(limit=50)] == ["sess_new", "sess_old"]


async def test_rename_returns_the_updated_row():
    repo = MemorySessionRepository()
    await repo.create(session())
    assert (await repo.rename("sess_a", "Billing")).title == "Billing"
    assert (await repo.get("sess_a")).title == "Billing"


async def test_rename_returns_none_for_an_unknown_id():
    assert await MemorySessionRepository().rename("sess_missing", "x") is None


async def test_stored_rows_are_cloned_so_callers_cannot_mutate_the_store():
    """The Postgres store hands back fresh objects; the memory one must too, or a
    caller's edit would silently rewrite history."""
    repo = MemorySessionRepository()
    incoming = session()
    await repo.create(incoming)
    incoming.title = "mutated"
    assert (await repo.get("sess_a")).title == "Refund question"


async def test_delete_reports_whether_a_row_was_removed():
    repo = MemorySessionRepository()
    await repo.create(session())
    assert await repo.delete("sess_a") is True
    assert await repo.delete("sess_a") is False


async def test_delete_by_agent_removes_every_session_for_that_agent():
    repo = MemorySessionRepository()
    await repo.create(session("sess_a", agent_id="agent_support"))
    await repo.create(session("sess_b", agent_id="agent_support"))
    await repo.create(session("sess_c", agent_id="agent_research"))
    assert await repo.delete_by_agent("agent_support") == 2
    assert [s.id for s in await repo.list(limit=50)] == ["sess_c"]
