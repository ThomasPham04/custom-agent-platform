"""Runs are append-only history, so the store is simpler than the agent one —
but the clone and ordering rules are identical, because Task 11's Postgres
implementation has to match both (spec §5.3)."""

from app.modules.runs.repositories.memory import MemoryRunRepository
from app.modules.runs.schemas import Run, RunToolCall


def make_run(
    run_id: str,
    agent_id: str = "agent_support",
    created_at: str = "2026-08-04T12:00:00+00:00",
) -> Run:
    return Run(
        id=run_id,
        agent_id=agent_id,
        agent_name="Support Bot",
        model="gemini-3.1-flash-lite",
        system_prompt="You are the support agent.",
        user_message="hi",
        answer="hello",
        status="done",
        error=None,
        latency_ms=298,
        session_id=None,
        created_at=created_at,
        tool_calls=[
            RunToolCall(
                id="call_1",
                seq=0,
                tool_id="current_time",
                args={"timezone": "Asia/Tokyo"},
                result="2026-08-04T21:03:41+09:00",
                error=None,
                duration_ms=118,
                status="ok",
            )
        ],
    )


async def test_starts_empty():
    assert await MemoryRunRepository().list(agent_id=None, limit=50) == []


async def test_append_then_get_round_trips():
    repo = MemoryRunRepository()
    appended = await repo.append(make_run("run_a"))
    assert appended.id == "run_a"
    assert (await repo.get("run_a")).answer == "hello"


async def test_get_returns_none_for_an_unknown_id():
    assert await MemoryRunRepository().get("run_missing") is None


async def test_list_returns_newest_first():
    repo = MemoryRunRepository()
    await repo.append(make_run("run_old", created_at="2026-08-01T12:00:00+00:00"))
    await repo.append(make_run("run_new", created_at="2026-08-09T12:00:00+00:00"))
    await repo.append(make_run("run_mid", created_at="2026-08-04T12:00:00+00:00"))
    listed = await repo.list(agent_id=None, limit=50)
    assert [r.id for r in listed] == ["run_new", "run_mid", "run_old"]


async def test_list_filters_by_agent():
    repo = MemoryRunRepository()
    await repo.append(make_run("run_a", agent_id="agent_support"))
    await repo.append(make_run("run_b", agent_id="agent_metrics"))
    listed = await repo.list(agent_id="agent_metrics", limit=50)
    assert [r.id for r in listed] == ["run_b"]


async def test_list_applies_the_limit_after_ordering():
    """The newest `limit` runs, not the first `limit` inserted."""
    repo = MemoryRunRepository()
    await repo.append(make_run("run_old", created_at="2026-08-01T12:00:00+00:00"))
    await repo.append(make_run("run_new", created_at="2026-08-09T12:00:00+00:00"))
    listed = await repo.list(agent_id=None, limit=1)
    assert [r.id for r in listed] == ["run_new"]


async def test_reads_are_deep_clones():
    """tool_calls is a list of models, so a shallow copy still hands out the
    stored objects."""
    repo = MemoryRunRepository()
    await repo.append(make_run("run_a"))

    fetched = await repo.get("run_a")
    fetched.answer = "mutated"
    fetched.tool_calls[0].tool_id = "mutated"

    stored = await repo.get("run_a")
    assert stored.answer == "hello"
    assert stored.tool_calls[0].tool_id == "current_time"


async def test_append_does_not_store_the_caller_s_object():
    repo = MemoryRunRepository()
    incoming = make_run("run_a")
    await repo.append(incoming)

    incoming.tool_calls[0].duration_ms = 9999

    assert (await repo.get("run_a")).tool_calls[0].duration_ms == 118
