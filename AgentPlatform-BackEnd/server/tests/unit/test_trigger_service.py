from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from app.core.clock import set_clock
from app.core.errors import NotFoundError
from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.seeds import SEED_AGENTS
from app.modules.runs.schemas import Run
from app.modules.triggers.repositories.memory import MemoryTriggerRepository
from app.modules.triggers.service import TriggerService

pytestmark = pytest.mark.anyio

BASE = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)


def make_run(**overrides) -> Run:
    values = {
        "id": "run_triggered",
        "agent_id": "agent_support",
        "agent_name": "Support Bot",
        "model": "gemini-3.1-flash-lite",
        "system_prompt": "Help.",
        "user_message": "Check the queue.",
        "answer": "Done.",
        "status": "done",
        "error": None,
        "latency_ms": 10,
        "session_id": None,
        "trigger_id": "trg_test",
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


@pytest.fixture
def repo() -> MemoryTriggerRepository:
    return MemoryTriggerRepository()


@pytest.fixture
def execution():
    return type("ExecutionStub", (), {"run_trigger": AsyncMock(return_value=make_run())})()


@pytest.fixture
def service(repo, execution) -> TriggerService:
    return TriggerService(
        repo=repo,
        agents=MemoryAgentRepository(seed=SEED_AGENTS),
        execution=execution,
    )


async def create_interval(service: TriggerService, **overrides):
    body = {
        "agentId": "agent_support",
        "kind": "interval",
        "message": "Check the queue.",
        "intervalMinutes": 15,
        "timezone": "UTC",
    }
    body.update(overrides)
    return await service.create(body)


async def test_create_applies_defaults_and_schedules_the_first_run(service):
    trigger = await create_interval(service)
    assert trigger.id.startswith("trg_")
    assert trigger.name == "New trigger"
    assert trigger.created_at == BASE
    assert trigger.updated_at == BASE
    assert trigger.next_run_at == BASE + timedelta(minutes=15)


async def test_disabled_create_has_no_next_run(service):
    trigger = await create_interval(service, enabled=False)
    assert trigger.next_run_at is None


async def test_renaming_does_not_push_the_schedule_out(service):
    trigger = await create_interval(service)
    original_next = trigger.next_run_at
    renamed = await service.update(trigger.id, {"name": "Renamed"})
    assert renamed.name == "Renamed"
    assert renamed.next_run_at == original_next


async def test_schedule_change_recomputes_and_disabling_clears_next_run(service):
    trigger = await create_interval(service)
    changed = await service.update(trigger.id, {"intervalMinutes": 30})
    assert changed.next_run_at == BASE + timedelta(minutes=30)

    paused = await service.update(trigger.id, {"enabled": False})
    assert paused.next_run_at is None


async def test_switching_kind_clears_the_old_schedule_fields(service):
    trigger = await create_interval(service)
    daily = await service.update(
        trigger.id,
        {"kind": "daily", "timeOfDay": "16:00", "weekdays": [0, 2]},
    )
    assert daily.interval_minutes is None
    assert daily.time_of_day == "16:00"
    assert daily.weekdays == [0, 2]


async def test_create_and_update_require_an_existing_agent(service):
    with pytest.raises(NotFoundError, match='No agent with id "agent_missing"'):
        await create_interval(service, agentId="agent_missing")

    trigger = await create_interval(service)
    with pytest.raises(NotFoundError, match='No agent with id "agent_missing"'):
        await service.update(trigger.id, {"agentId": "agent_missing"})


async def test_run_now_executes_with_trigger_context_and_records_activity(
    service, repo, execution
):
    trigger = await create_interval(service, timezone="Asia/Ho_Chi_Minh")
    scheduled_for = trigger.next_run_at
    execution.run_trigger.return_value = make_run(trigger_id=trigger.id)

    run = await service.run_now(trigger.id)

    assert run.id == "run_triggered"
    execution.run_trigger.assert_awaited_once_with(
        "agent_support",
        "Check the queue.",
        trigger.id,
        "Asia/Ho_Chi_Minh",
    )
    stored = await repo.get(trigger.id)
    assert stored.last_run_at == BASE
    assert stored.last_status == "done"
    assert stored.last_run_id == "run_triggered"
    assert stored.next_run_at == scheduled_for


async def test_delete_removes_trigger_and_unknown_ids_are_not_found(service):
    trigger = await create_interval(service)
    await service.delete(trigger.id)
    with pytest.raises(NotFoundError, match="No trigger"):
        await service.get(trigger.id)
    with pytest.raises(NotFoundError, match="No trigger"):
        await service.delete(trigger.id)
