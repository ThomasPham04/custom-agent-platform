from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from app.core.clock import set_clock
from app.modules.runs.schemas import Run
from app.modules.triggers.repositories.memory import MemoryTriggerRepository
from app.modules.triggers.scheduler import TriggerScheduler
from app.modules.triggers.schemas import Trigger

pytestmark = pytest.mark.anyio

BASE = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)


def make_trigger(trigger_id: str, **overrides) -> Trigger:
    values = {
        "id": trigger_id,
        "agent_id": "agent_support",
        "name": trigger_id,
        "message": "Run scheduled work.",
        "kind": "interval",
        "interval_minutes": 15,
        "time_of_day": None,
        "weekdays": [],
        "timezone": "UTC",
        "enabled": True,
        "next_run_at": BASE - timedelta(minutes=1),
        "last_run_at": None,
        "last_status": None,
        "last_run_id": None,
        "created_at": BASE - timedelta(days=1),
        "updated_at": BASE - timedelta(days=1),
    }
    values.update(overrides)
    return Trigger(**values)


def make_run(trigger_id: str, **overrides) -> Run:
    values = {
        "id": f"run_{trigger_id}",
        "agent_id": "agent_support",
        "agent_name": "Support Bot",
        "model": "gemini-3.1-flash-lite",
        "system_prompt": "Help.",
        "user_message": "Run scheduled work.",
        "answer": "Done.",
        "status": "done",
        "error": None,
        "latency_ms": 10,
        "session_id": None,
        "trigger_id": trigger_id,
        "created_at": BASE.isoformat(),
        "tool_calls": [],
    }
    values.update(overrides)
    return Run(**values)


@pytest.fixture(autouse=True)
def frozen_clock():
    set_clock(lambda: BASE)
    yield
    set_clock(None)


async def test_tick_claims_fires_reschedules_and_records_the_run():
    repo = MemoryTriggerRepository()
    await repo.create(make_trigger("trg_due"))
    await repo.create(
        make_trigger("trg_future", next_run_at=BASE + timedelta(minutes=1))
    )
    execution = type(
        "ExecutionStub",
        (),
        {"run_trigger": AsyncMock(return_value=make_run("trg_due"))},
    )()
    scheduler = TriggerScheduler(repo, execution, max_per_tick=20)

    assert await scheduler.tick() == 1

    execution.run_trigger.assert_awaited_once_with(
        "agent_support", "Run scheduled work.", "trg_due", "UTC"
    )
    stored = await repo.get("trg_due")
    assert stored.next_run_at == BASE + timedelta(minutes=15)
    assert stored.last_run_at == BASE
    assert stored.last_status == "done"
    assert stored.last_run_id == "run_trg_due"
    assert (await repo.get("trg_future")).last_run_at is None


async def test_tick_skips_a_trigger_when_another_worker_wins_the_claim():
    trigger = make_trigger("trg_race")
    repo = type(
        "RepoStub",
        (),
        {
            "due": AsyncMock(return_value=[trigger]),
            "claim": AsyncMock(return_value=False),
            "record_run": AsyncMock(),
        },
    )()
    execution = type("ExecutionStub", (), {"run_trigger": AsyncMock()})()

    assert await TriggerScheduler(repo, execution, max_per_tick=20).tick() == 0
    execution.run_trigger.assert_not_awaited()
    repo.record_run.assert_not_awaited()


async def test_execution_failure_is_recorded_and_does_not_kill_the_tick():
    repo = MemoryTriggerRepository()
    await repo.create(make_trigger("trg_broken"))
    execution = type(
        "ExecutionStub",
        (),
        {"run_trigger": AsyncMock(side_effect=RuntimeError("provider down"))},
    )()

    assert await TriggerScheduler(repo, execution, max_per_tick=20).tick() == 1

    stored = await repo.get("trg_broken")
    assert stored.next_run_at == BASE + timedelta(minutes=15)
    assert stored.last_run_at == BASE
    assert stored.last_status == "error"
    assert stored.last_run_id is None


async def test_tick_respects_the_repository_limit():
    repo = MemoryTriggerRepository()
    await repo.create(make_trigger("trg_first", next_run_at=BASE - timedelta(minutes=2)))
    await repo.create(make_trigger("trg_second", next_run_at=BASE - timedelta(minutes=1)))
    execution = type(
        "ExecutionStub",
        (),
        {"run_trigger": AsyncMock(side_effect=lambda _a, _m, trigger_id, _z: make_run(trigger_id))},
    )()

    assert await TriggerScheduler(repo, execution, max_per_tick=1).tick() == 1
    assert execution.run_trigger.await_count == 1
