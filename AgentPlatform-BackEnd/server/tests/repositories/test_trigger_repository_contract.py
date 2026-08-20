from datetime import UTC, datetime, timedelta

import pytest

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


async def test_trigger_crud_filter_order_and_delete_by_agent(trigger_repo):
    old = make_trigger("trg_old")
    new = make_trigger(
        "trg_new",
        agent_id="agent_research",
        updated_at=BASE + timedelta(minutes=1),
        weekdays=[0, 2, 4],
    )
    await trigger_repo.create(old)
    await trigger_repo.create(new)

    assert [item.id for item in await trigger_repo.list(None, 10)] == [
        "trg_new",
        "trg_old",
    ]
    assert [
        item.id for item in await trigger_repo.list("agent_support", 10)
    ] == ["trg_old"]
    assert (await trigger_repo.get("trg_new")).weekdays == [0, 2, 4]

    renamed = old.model_copy(update={"name": "Renamed"})
    await trigger_repo.update(renamed)
    assert (await trigger_repo.get("trg_old")).name == "Renamed"

    assert await trigger_repo.delete_by_agent("agent_support") == 1
    assert await trigger_repo.get("trg_old") is None
    assert await trigger_repo.delete("trg_new") is True
    assert await trigger_repo.delete("trg_new") is False


async def test_trigger_due_claim_and_activity_contract(trigger_repo):
    await trigger_repo.create(
        make_trigger("trg_first", next_run_at=BASE - timedelta(minutes=2))
    )
    await trigger_repo.create(
        make_trigger("trg_second", next_run_at=BASE - timedelta(minutes=1))
    )
    await trigger_repo.create(
        make_trigger("trg_future", next_run_at=BASE + timedelta(minutes=1))
    )
    await trigger_repo.create(
        make_trigger("trg_paused", enabled=False, next_run_at=BASE - timedelta(days=1))
    )

    assert [item.id for item in await trigger_repo.due(BASE, 1)] == ["trg_first"]

    next_time = BASE + timedelta(minutes=15)
    assert (
        await trigger_repo.claim(
            "trg_first", BASE - timedelta(minutes=3), next_time
        )
        is False
    )
    assert await trigger_repo.claim(
        "trg_first", BASE - timedelta(minutes=2), next_time
    ) is True

    finished = BASE + timedelta(seconds=2)
    await trigger_repo.record_run("trg_first", finished, "done", "run_1")
    stored = await trigger_repo.get("trg_first")
    assert stored.next_run_at == next_time
    assert stored.last_run_at == finished
    assert stored.last_status == "done"
    assert stored.last_run_id == "run_1"
