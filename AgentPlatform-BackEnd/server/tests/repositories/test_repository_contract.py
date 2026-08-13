"""Both implementations, the same assertions.

Every test here runs twice — once against memory, once against Postgres. If one
fails and the other passes, the port has been broken, which is precisely the
failure this file exists to catch.
"""

from app.modules.agents.schemas import Agent
from app.modules.runs.schemas import Run, RunToolCall


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
        session_id=None,
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
