"""Existing history predates sessions. Without this it would be invisible in the
new sidebar even though every run is still in the database."""

import pytest

from app.modules.runs.repositories.memory import MemoryRunRepository
from app.modules.runs.schemas import Run, RunToolCall
from app.modules.sessions.backfill import backfill_sessions
from app.modules.sessions.repositories.memory import MemorySessionRepository

pytestmark = pytest.mark.anyio


@pytest.fixture
def run():
    """Builds a Run with overridable agent_id, user_message, created_at, and
    session_id. Mirrors make_run in tests/unit/test_run_memory_repository.py."""

    def _make(
        run_id: str,
        agent_id: str = "agent_support",
        user_message: str = "hi",
        created_at: str = "2026-08-04T12:00:00+00:00",
        session_id: str | None = None,
    ) -> Run:
        return Run(
            id=run_id,
            agent_id=agent_id,
            agent_name="Support Bot",
            model="gemini-3.1-flash-lite",
            system_prompt="You are the support agent.",
            user_message=user_message,
            answer="hello",
            status="done",
            error=None,
            latency_ms=298,
            session_id=session_id,
            created_at=created_at,
            tool_calls=[
                RunToolCall(
                    id=f"call_{run_id}",
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

    return _make


async def test_one_session_is_created_per_agent(run):
    runs = MemoryRunRepository()
    sessions = MemorySessionRepository()
    await runs.append(run("run_a", agent_id="agent_support", session_id=None))
    await runs.append(run("run_b", agent_id="agent_support", session_id=None))
    await runs.append(run("run_c", agent_id="agent_research", session_id=None))

    assert await backfill_sessions(runs, sessions) == 2
    assert len(await sessions.list(limit=50)) == 2


async def test_the_title_comes_from_the_earliest_message(run):
    # Seeded so neither "first row inserted" nor "first row a naive
    # implementation might see" coincides with "earliest by created_at": the
    # run appended first ("run_late") carries the LATER timestamp and the
    # non-"first" message, so only an implementation that actually compares
    # created_at picks the right one.
    runs = MemoryRunRepository()
    sessions = MemorySessionRepository()
    await runs.append(
        run(
            "run_late",
            user_message="second",
            created_at="2026-08-10T12:00:00+00:00",
            session_id=None,
        )
    )
    await runs.append(
        run(
            "run_early",
            user_message="first",
            created_at="2026-08-01T12:00:00+00:00",
            session_id=None,
        )
    )

    await backfill_sessions(runs, sessions)
    assert (await sessions.list(limit=50))[0].title == "first"


async def test_running_twice_changes_nothing(run):
    """Every boot calls this. The second call must be a no-op."""
    runs = MemoryRunRepository()
    sessions = MemorySessionRepository()
    await runs.append(run("run_a", session_id=None))

    assert await backfill_sessions(runs, sessions) == 1
    assert await backfill_sessions(runs, sessions) == 0
    assert len(await sessions.list(limit=50)) == 1


async def test_a_backlog_bigger_than_one_batch_still_fully_drains(run):
    """Regression for the window bug: list(limit=N) sorts newest-first and
    truncates before filtering, so on a table with more than N orphans the
    oldest ones fell outside the window and could never re-enter it. Seeding
    more runs than batch_size and asserting every one gets a session_id
    proves the fetch-migrate-requery loop actually drains the backlog rather
    than only touching its first page."""
    runs = MemoryRunRepository()
    sessions = MemorySessionRepository()
    for i in range(5):
        await runs.append(
            run(
                f"run_{i}",
                user_message=f"message {i}",
                created_at=f"2026-08-{i + 1:02d}T12:00:00+00:00",
                session_id=None,
            )
        )

    created = await backfill_sessions(runs, sessions, batch_size=2)

    assert created == 1
    all_runs = await runs.list(agent_id="agent_support", limit=50)
    assert all(r.session_id is not None for r in all_runs)
    assert len({r.session_id for r in all_runs}) == 1
    # The earliest message survives even though it was in the first batch and
    # the session's title was set before the later batches were even read.
    assert (await sessions.list(limit=50))[0].title == "message 0"


async def test_interleaved_agents_still_get_one_session_each_across_batches(run):
    """batch_size=1 forces every run into its own batch, so this exercises
    the "agent already has a session from an earlier batch" branch on every
    iteration but the first for each agent."""
    runs = MemoryRunRepository()
    sessions = MemorySessionRepository()
    await runs.append(
        run(
            "run_a1",
            agent_id="agent_support",
            created_at="2026-08-01T12:00:00+00:00",
            session_id=None,
        )
    )
    await runs.append(
        run(
            "run_b1",
            agent_id="agent_research",
            created_at="2026-08-02T12:00:00+00:00",
            session_id=None,
        )
    )
    await runs.append(
        run(
            "run_a2",
            agent_id="agent_support",
            created_at="2026-08-03T12:00:00+00:00",
            session_id=None,
        )
    )
    await runs.append(
        run(
            "run_b2",
            agent_id="agent_research",
            created_at="2026-08-04T12:00:00+00:00",
            session_id=None,
        )
    )

    created = await backfill_sessions(runs, sessions, batch_size=1)

    assert created == 2
    assert len(await sessions.list(limit=50)) == 2
    support_runs = await runs.list(agent_id="agent_support", limit=50)
    assert len({r.session_id for r in support_runs}) == 1
