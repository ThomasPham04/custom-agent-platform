"""Both implementations, the same assertions.

Every test here runs twice — once against memory, once against Postgres. If one
fails and the other passes, the port has been broken, which is precisely the
failure this file exists to catch.
"""

from datetime import UTC, datetime

from app.modules.agents.schemas import Agent
from app.modules.runs.schemas import Run, RunToolCall
from app.modules.sessions.schemas import Session


def make_agent(agent_id: str, updated_at: str = "2026-08-04T12:00:00+00:00") -> Agent:
    return Agent(
        id=agent_id,
        name="Test agent",
        icon="\U0001f9e9",
        description="",
        model="gemini-3.1-flash-lite",
        system_prompt="Be brief.",
        tool_ids=["current_time"],
        status="draft",
        created_at="2026-08-01T12:00:00+00:00",
        updated_at=updated_at,
    )


def make_run(
    run_id: str,
    agent_id: str = "agent_a",
    created_at: str = "2026-08-04T12:00:00+00:00",
    with_calls: bool = True,
    session_id: str | None = None,
) -> Run:
    return Run(
        id=run_id,
        agent_id=agent_id,
        agent_name="Test agent",
        model="gemini-3.1-flash-lite",
        system_prompt="Be brief.",
        user_message="hi",
        answer="hello",
        status="done",
        error=None,
        latency_ms=298,
        session_id=session_id,
        created_at=created_at,
        tool_calls=[
            RunToolCall(
                id=f"call_{run_id}_0",
                seq=0,
                tool_id="current_time",
                args={"timezone": "Asia/Tokyo"},
                result="2026-08-04T21:03:41+09:00",
                error=None,
                duration_ms=118,
                status="ok",
            ),
            RunToolCall(
                id=f"call_{run_id}_1",
                seq=1,
                tool_id="http_request",
                args={"url": "https://status.example.com/health"},
                result={"status": 200, "latencyMs": 41},
                error=None,
                duration_ms=412,
                status="ok",
            ),
        ]
        if with_calls
        else [],
    )


# --- agents ---------------------------------------------------------------


async def test_an_empty_store_lists_nothing(agent_repo):
    assert await agent_repo.list() == []


async def test_create_then_get_round_trips_every_field(agent_repo):
    created = await agent_repo.create(make_agent("agent_a"))
    fetched = await agent_repo.get("agent_a")
    assert fetched == created


async def test_get_returns_none_for_an_unknown_id(agent_repo):
    assert await agent_repo.get("agent_missing") is None


async def test_tool_ids_survive_as_a_list_of_strings(agent_repo):
    """JSONB comes back as text without the codec from Task 9."""
    await agent_repo.create(make_agent("agent_a"))
    assert (await agent_repo.get("agent_a")).tool_ids == ["current_time"]


async def test_an_empty_tool_list_round_trips(agent_repo):
    await agent_repo.create(make_agent("agent_a").model_copy(update={"tool_ids": []}))
    assert (await agent_repo.get("agent_a")).tool_ids == []


async def test_timestamps_round_trip_unchanged(agent_repo):
    """The seeds' fixed times are asserted elsewhere as exact strings."""
    await agent_repo.create(make_agent("agent_a"))
    fetched = await agent_repo.get("agent_a")
    assert fetched.created_at == "2026-08-01T12:00:00+00:00"
    assert fetched.updated_at == "2026-08-04T12:00:00+00:00"


async def test_update_replaces_the_stored_agent(agent_repo):
    await agent_repo.create(make_agent("agent_a"))
    stored = await agent_repo.get("agent_a")
    await agent_repo.update(stored.model_copy(update={"name": "Renamed"}))
    assert (await agent_repo.get("agent_a")).name == "Renamed"


async def test_update_does_not_touch_other_agents(agent_repo):
    await agent_repo.create(make_agent("agent_a"))
    await agent_repo.create(make_agent("agent_b"))
    stored = await agent_repo.get("agent_a")
    await agent_repo.update(stored.model_copy(update={"name": "Renamed"}))
    assert (await agent_repo.get("agent_b")).name == "Test agent"


async def test_delete_reports_whether_it_removed_anything(agent_repo):
    await agent_repo.create(make_agent("agent_a"))
    assert await agent_repo.delete("agent_a") is True
    assert await agent_repo.delete("agent_a") is False


async def test_agents_are_listed_newest_updated_first(agent_repo):
    await agent_repo.create(
        make_agent("agent_old", updated_at="2026-08-01T12:00:00+00:00")
    )
    await agent_repo.create(
        make_agent("agent_new", updated_at="2026-08-09T12:00:00+00:00")
    )
    await agent_repo.create(
        make_agent("agent_mid", updated_at="2026-08-04T12:00:00+00:00")
    )
    listed = await agent_repo.list()
    assert [a.id for a in listed] == ["agent_new", "agent_mid", "agent_old"]


# --- runs -----------------------------------------------------------------


async def test_an_empty_run_store_lists_nothing(run_repo):
    assert await run_repo.list(agent_id=None, limit=50) == []


async def test_append_then_get_round_trips_a_run_and_its_calls(run_repo):
    appended = await run_repo.append(make_run("run_a"))
    fetched = await run_repo.get("run_a")
    assert fetched == appended


async def test_run_get_returns_none_for_an_unknown_id(run_repo):
    assert await run_repo.get("run_missing") is None


async def test_tool_calls_keep_their_order(run_repo):
    await run_repo.append(make_run("run_a"))
    fetched = await run_repo.get("run_a")
    assert [c.seq for c in fetched.tool_calls] == [0, 1]
    assert [c.tool_id for c in fetched.tool_calls] == ["current_time", "http_request"]


async def test_a_structured_result_survives_the_round_trip(run_repo):
    """The trace rail renders this payload verbatim, camelCase key included."""
    await run_repo.append(make_run("run_a"))
    fetched = await run_repo.get("run_a")
    assert fetched.tool_calls[1].result == {"status": 200, "latencyMs": 41}


async def test_a_run_with_no_calls_round_trips(run_repo):
    await run_repo.append(make_run("run_a", with_calls=False))
    assert (await run_repo.get("run_a")).tool_calls == []


async def test_runs_are_listed_newest_first(run_repo):
    await run_repo.append(make_run("run_old", created_at="2026-08-01T12:00:00+00:00"))
    await run_repo.append(make_run("run_new", created_at="2026-08-09T12:00:00+00:00"))
    listed = await run_repo.list(agent_id=None, limit=50)
    assert [r.id for r in listed] == ["run_new", "run_old"]


async def test_runs_can_be_filtered_by_agent(run_repo):
    await run_repo.append(make_run("run_a", agent_id="agent_a"))
    await run_repo.append(make_run("run_b", agent_id="agent_b"))
    listed = await run_repo.list(agent_id="agent_b", limit=50)
    assert [r.id for r in listed] == ["run_b"]


async def test_all_runs_for_an_agent_are_streamed_without_the_list_cap(run_repo):
    await run_repo.append(make_run("run_with_calls", agent_id="agent_a"))
    for index in range(201):
        await run_repo.append(
            make_run(
                f"run_{index}",
                agent_id="agent_a",
                created_at=f"2026-08-{(index % 28) + 1:02d}T12:00:00+00:00",
                with_calls=False,
            )
        )
    await run_repo.append(make_run("run_other", agent_id="agent_b"))

    exported = [run async for run in run_repo.iter_all_by_agent("agent_a")]

    assert len(exported) == 202
    assert {run.agent_id for run in exported} == {"agent_a"}
    assert [run.created_at for run in exported] == sorted(
        (run.created_at for run in exported), reverse=True
    )
    exported_with_calls = next(run for run in exported if run.id == "run_with_calls")
    assert [call.id for call in exported_with_calls.tool_calls] == [
        "call_run_with_calls_0",
        "call_run_with_calls_1",
    ]


async def test_the_limit_takes_the_newest_not_the_first_inserted(run_repo):
    await run_repo.append(make_run("run_old", created_at="2026-08-01T12:00:00+00:00"))
    await run_repo.append(make_run("run_new", created_at="2026-08-09T12:00:00+00:00"))
    listed = await run_repo.list(agent_id=None, limit=1)
    assert [r.id for r in listed] == ["run_new"]


async def test_listing_carries_the_tool_calls_too(run_repo):
    """A list that dropped the calls would render an empty trace rail."""
    await run_repo.append(make_run("run_a"))
    listed = await run_repo.list(agent_id=None, limit=50)
    assert len(listed[0].tool_calls) == 2


async def test_delete_by_agent_removes_only_that_agents_runs(run_repo):
    await run_repo.append(make_run("run_a1", agent_id="agent_a"))
    await run_repo.append(make_run("run_a2", agent_id="agent_a"))
    await run_repo.append(make_run("run_b1", agent_id="agent_b"))

    removed = await run_repo.delete_by_agent("agent_a")

    assert removed == 2
    assert await run_repo.list(agent_id="agent_a", limit=50) == []
    assert [r.id for r in await run_repo.list(agent_id="agent_b", limit=50)] == ["run_b1"]


async def test_delete_by_agent_takes_the_tool_calls_with_it(run_repo):
    """The child rows leave with their parent, or the next insert collides."""
    await run_repo.append(make_run("run_a1", agent_id="agent_a", with_calls=True))

    await run_repo.delete_by_agent("agent_a")

    assert await run_repo.get("run_a1") is None
    # Re-inserting the same call ids proves nothing was orphaned behind.
    await run_repo.append(make_run("run_a1", agent_id="agent_a", with_calls=True))
    assert len((await run_repo.list(agent_id="agent_a", limit=50))[0].tool_calls) == 2


async def test_delete_by_agent_is_idempotent_for_an_unknown_agent(run_repo):
    await run_repo.append(make_run("run_b1", agent_id="agent_b"))

    removed = await run_repo.delete_by_agent("agent_missing")

    assert removed == 0
    assert [r.id for r in await run_repo.list(agent_id=None, limit=50)] == ["run_b1"]


async def test_list_by_session_returns_only_that_session_newest_first(run_repo):
    await run_repo.append(
        make_run("run_1a", session_id="sess_1", created_at="2026-08-01T12:00:00+00:00")
    )
    await run_repo.append(
        make_run("run_1b", session_id="sess_1", created_at="2026-08-09T12:00:00+00:00")
    )
    await run_repo.append(
        make_run("run_2a", session_id="sess_2", created_at="2026-08-05T12:00:00+00:00")
    )

    listed = await run_repo.list_by_session("sess_1", limit=50)

    assert [r.id for r in listed] == ["run_1b", "run_1a"]


async def test_list_by_session_respects_limit(run_repo):
    await run_repo.append(
        make_run("run_old", session_id="sess_1", created_at="2026-08-01T12:00:00+00:00")
    )
    await run_repo.append(
        make_run("run_new", session_id="sess_1", created_at="2026-08-09T12:00:00+00:00")
    )

    listed = await run_repo.list_by_session("sess_1", limit=1)

    assert [r.id for r in listed] == ["run_new"]


async def test_list_by_session_carries_tool_calls_in_seq_order(run_repo):
    """The Postgres path stitches children back in a second query; this is the
    part most likely to be wrong."""
    await run_repo.append(make_run("run_a", session_id="sess_1", with_calls=True))

    listed = await run_repo.list_by_session("sess_1", limit=50)

    assert [c.seq for c in listed[0].tool_calls] == [0, 1]
    assert [c.tool_id for c in listed[0].tool_calls] == ["current_time", "http_request"]


async def test_delete_by_session_removes_only_that_sessions_runs(run_repo):
    await run_repo.append(make_run("run_1a", session_id="sess_1"))
    await run_repo.append(make_run("run_1b", session_id="sess_1"))
    await run_repo.append(make_run("run_2a", session_id="sess_2"))

    removed = await run_repo.delete_by_session("sess_1")

    assert removed == 2
    assert await run_repo.list_by_session("sess_1", limit=50) == []
    assert [r.id for r in await run_repo.list_by_session("sess_2", limit=50)] == ["run_2a"]


async def test_delete_by_session_is_idempotent_for_an_unknown_session(run_repo):
    await run_repo.append(make_run("run_2a", session_id="sess_2"))

    removed = await run_repo.delete_by_session("sess_missing")

    assert removed == 0
    assert [r.id for r in await run_repo.list_by_session("sess_2", limit=50)] == ["run_2a"]


async def test_assign_session_attaches_the_given_runs(run_repo):
    """What the startup backfill relies on to rescue history predating
    sessions (spec §6)."""
    await run_repo.append(make_run("run_a", session_id=None))
    await run_repo.append(make_run("run_b", session_id=None))
    await run_repo.append(make_run("run_c", session_id=None))

    await run_repo.assign_session(["run_a", "run_b"], "sess_1")

    listed = await run_repo.list_by_session("sess_1", limit=50)
    assert {r.id for r in listed} == {"run_a", "run_b"}
    assert (await run_repo.get("run_c")).session_id is None


async def test_assign_session_ignores_an_unknown_run_id(run_repo):
    await run_repo.append(make_run("run_a", session_id=None))

    # Must not raise: the backfill hands over exactly the ids it just read.
    await run_repo.assign_session(["run_a", "run_missing"], "sess_1")

    assert (await run_repo.get("run_a")).session_id == "sess_1"


async def test_list_orphans_returns_only_session_less_runs(run_repo):
    await run_repo.append(make_run("run_a", session_id=None))
    await run_repo.append(make_run("run_b", session_id="sess_1"))

    orphans = await run_repo.list_orphans(limit=50)

    assert [r.id for r in orphans] == ["run_a"]


async def test_list_orphans_is_oldest_first(run_repo):
    """The inverse of list(): the backfill drains the table from the front,
    so an already-migrated run can never reoccupy a later window."""
    await run_repo.append(
        make_run("run_new", created_at="2026-08-09T12:00:00+00:00", session_id=None)
    )
    await run_repo.append(
        make_run("run_old", created_at="2026-08-01T12:00:00+00:00", session_id=None)
    )

    orphans = await run_repo.list_orphans(limit=50)

    assert [r.id for r in orphans] == ["run_old", "run_new"]


async def test_list_orphans_respects_the_limit(run_repo):
    await run_repo.append(
        make_run("run_old", created_at="2026-08-01T12:00:00+00:00", session_id=None)
    )
    await run_repo.append(
        make_run("run_new", created_at="2026-08-09T12:00:00+00:00", session_id=None)
    )

    orphans = await run_repo.list_orphans(limit=1)

    assert [r.id for r in orphans] == ["run_old"]


# --- sessions ---------------------------------------------------------------


async def test_sessions_round_trip(session_repo):
    await session_repo.create(
        Session(
            id="sess_a",
            agent_id="agent_support",
            title="Refund question",
            created_at=datetime(2026, 8, 16, 9, 0, tzinfo=UTC),
            updated_at=datetime(2026, 8, 16, 9, 0, tzinfo=UTC),
        )
    )
    stored = await session_repo.get("sess_a")
    assert stored.agent_id == "agent_support"
    assert stored.title == "Refund question"


async def test_sessions_list_orders_by_recent_activity(session_repo):
    for index, hour in ((1, 8), (2, 10)):
        await session_repo.create(
            Session(
                id=f"sess_{index}",
                agent_id="agent_support",
                title=f"Chat {index}",
                created_at=datetime(2026, 8, 16, hour, tzinfo=UTC),
                updated_at=datetime(2026, 8, 16, hour, tzinfo=UTC),
            )
        )
    assert [s.id for s in await session_repo.list(limit=50)] == ["sess_2", "sess_1"]


async def test_rename_of_an_unknown_session_returns_none(session_repo):
    assert await session_repo.rename("sess_missing", "x") is None


async def test_delete_by_agent_counts_removed_rows(session_repo):
    await session_repo.create(
        Session(
            id="sess_a",
            agent_id="agent_support",
            title="A",
            created_at=datetime(2026, 8, 16, 9, tzinfo=UTC),
            updated_at=datetime(2026, 8, 16, 9, tzinfo=UTC),
        )
    )
    assert await session_repo.delete_by_agent("agent_support") == 1
