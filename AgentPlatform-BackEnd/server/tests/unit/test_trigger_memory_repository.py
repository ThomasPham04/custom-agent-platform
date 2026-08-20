from datetime import UTC, datetime, timedelta

import pytest

from app.modules.triggers.repositories.memory import MemoryTriggerRepository
from app.modules.triggers.schemas import Trigger

pytestmark = pytest.mark.anyio

BASE = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)


def make_trigger(trigger_id: str, **overrides) -> Trigger:
    values = {
        "id": trigger_id,
        "agent_id": "agent_support",
        "name": trigger_id,
        "message": "Run.",
        "kind": "interval",
        "interval_minutes": 15,
        "time_of_day": None,
        "weekdays": [],
        "timezone": "UTC",
        "enabled": True,
        "next_run_at": BASE,
        "last_run_at": None,
        "last_status": None,
        "last_run_id": None,
        "created_at": BASE,
        "updated_at": BASE,
    }
    values.update(overrides)
    return Trigger(**values)


async def test_crud_lists_newest_first_and_filters_by_agent():
    repo = MemoryTriggerRepository()
    older = make_trigger("trg_old", updated_at=BASE)
    newer = make_trigger(
        "trg_new",
        agent_id="agent_research",
        updated_at=BASE + timedelta(minutes=1),
    )

    await repo.create(older)
    await repo.create(newer)

    assert [item.id for item in await repo.list(agent_id=None, limit=10)] == [
        "trg_new",
        "trg_old",
    ]
    assert [item.id for item in await repo.list(agent_id="agent_support", limit=10)] == [
        "trg_old"
    ]

    renamed = older.model_copy(update={"name": "Renamed"})
    await repo.update(renamed)
    assert (await repo.get("trg_old")).name == "Renamed"
    assert await repo.delete("trg_old") is True
    assert await repo.delete("trg_old") is False
    assert await repo.get("trg_old") is None


async def test_due_excludes_paused_and_future_triggers_and_honors_limit():
    repo = MemoryTriggerRepository()
    await repo.create(make_trigger("trg_first", next_run_at=BASE - timedelta(minutes=2)))
    await repo.create(make_trigger("trg_second", next_run_at=BASE - timedelta(minutes=1)))
    await repo.create(make_trigger("trg_future", next_run_at=BASE + timedelta(minutes=1)))
    await repo.create(
        make_trigger(
            "trg_paused", enabled=False, next_run_at=BASE - timedelta(days=1)
        )
    )
    await repo.create(make_trigger("trg_unscheduled", next_run_at=None))

    assert [item.id for item in await repo.due(at=BASE, limit=1)] == ["trg_first"]


async def test_claim_is_compare_and_set_and_record_run_updates_activity():
    repo = MemoryTriggerRepository()
    await repo.create(make_trigger("trg_claim"))
    next_time = BASE + timedelta(minutes=15)

    assert (
        await repo.claim(
            "trg_claim",
            expected=BASE - timedelta(seconds=1),
            next_run_at=next_time,
        )
        is False
    )
    assert await repo.claim("trg_claim", expected=BASE, next_run_at=next_time) is True
    assert (await repo.get("trg_claim")).next_run_at == next_time

    finished = BASE + timedelta(seconds=3)
    await repo.record_run("trg_claim", finished, "done", "run_1")
    stored = await repo.get("trg_claim")
    assert stored.last_run_at == finished
    assert stored.last_status == "done"
    assert stored.last_run_id == "run_1"


async def test_delete_by_agent_removes_only_that_agents_triggers():
    repo = MemoryTriggerRepository()
    await repo.create(make_trigger("trg_a1"))
    await repo.create(make_trigger("trg_a2"))
    await repo.create(make_trigger("trg_b", agent_id="agent_research"))

    assert await repo.delete_by_agent("agent_support") == 2
    assert [item.id for item in await repo.list(agent_id=None, limit=10)] == ["trg_b"]
