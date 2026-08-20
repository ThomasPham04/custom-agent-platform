"""GET /api/runs has no Express equivalent (spec §4.1), so this file defines its
contract rather than porting one. Execution fills the store from Task 4 onward;
here the store is driven directly through the container."""

import pytest

from app.container import get_run_repository
from app.modules.runs.schemas import Run

pytestmark = pytest.mark.usefixtures("client")


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
        system_prompt="",
        user_message="hi",
        answer="hello",
        status="done",
        error=None,
        latency_ms=298,
        session_id=None,
        created_at=created_at,
        tool_calls=[],
    )


async def seed(*runs: Run) -> None:
    repo = get_run_repository()
    for run in runs:
        await repo.append(run)


async def test_list_is_empty_before_anything_runs(client):
    res = client.get("/api/runs")
    assert res.status_code == 200
    assert res.json() == []


async def test_list_returns_stored_runs_newest_first(client):
    await seed(
        make_run("run_old", created_at="2026-08-01T12:00:00+00:00"),
        make_run("run_new", created_at="2026-08-09T12:00:00+00:00"),
    )
    body = client.get("/api/runs").json()
    assert [r["id"] for r in body] == ["run_new", "run_old"]


async def test_list_serialises_as_camel_case(client):
    await seed(make_run("run_a"))
    body = client.get("/api/runs").json()[0]
    assert body["agentId"] == "agent_support"
    assert body["agentName"] == "Support Bot"
    assert body["latencyMs"] == 298
    assert body["toolCalls"] == []


async def test_list_filters_by_the_agent_id_query(client):
    await seed(
        make_run("run_a", agent_id="agent_support"),
        make_run("run_b", agent_id="agent_metrics"),
    )
    body = client.get("/api/runs?agentId=agent_metrics").json()
    assert [r["id"] for r in body] == ["run_b"]


async def test_list_honours_the_limit_query(client):
    await seed(
        make_run("run_old", created_at="2026-08-01T12:00:00+00:00"),
        make_run("run_new", created_at="2026-08-09T12:00:00+00:00"),
    )
    body = client.get("/api/runs?limit=1").json()
    assert [r["id"] for r in body] == ["run_new"]


def test_limit_outside_the_documented_range_is_a_400(client):
    """Query validation is FastAPI's, remapped to our envelope by core/errors."""
    res = client.get("/api/runs?limit=0")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "bad_request"


async def test_get_returns_a_single_run(client):
    await seed(make_run("run_a"))
    res = client.get("/api/runs/run_a")
    assert res.status_code == 200
    assert res.json()["id"] == "run_a"


def test_get_returns_404_for_an_unknown_run(client):
    res = client.get("/api/runs/run_missing")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


async def test_delete_removes_that_agents_runs_and_returns_204(client):
    await seed(
        make_run("run_a1", agent_id="agent_support"),
        make_run("run_b1", agent_id="agent_sales"),
    )

    res = client.delete("/api/runs?agentId=agent_support")

    assert res.status_code == 204
    assert res.content == b""
    assert client.get("/api/runs?agentId=agent_support").json() == []
    assert [r["id"] for r in client.get("/api/runs?agentId=agent_sales").json()] == [
        "run_b1"
    ]


async def test_delete_without_agent_id_is_rejected(client):
    await seed(make_run("run_a1"))

    res = client.delete("/api/runs")

    assert res.status_code == 400
    assert res.json() == {
        "error": {"code": "bad_request", "message": "agentId is required."}
    }
    # The guard exists so a dropped query param cannot wipe every agent.
    assert [r["id"] for r in client.get("/api/runs").json()] == ["run_a1"]


async def test_delete_for_an_unknown_agent_is_idempotent(client):
    res = client.delete("/api/runs?agentId=agent_missing")

    assert res.status_code == 204


def test_runs_can_be_filtered_by_session(client):
    response = client.get("/api/runs?sessionId=sess_missing")
    assert response.status_code == 200
    assert response.json() == []


def test_supplying_both_filters_is_a_client_error(client):
    """The two filters can disagree. Silently honouring one would hide it."""
    response = client.get("/api/runs?agentId=agent_support&sessionId=sess_1")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "bad_request",
            "message": "Pass agentId or sessionId, not both.",
        }
    }
