"""The sidebar's data source. Ordering is by most recent activity, because that
is the order a chat list is useful in."""

import asyncio

import pytest

from app.container import get_run_repository, get_session_repository
from app.core.clock import now
from app.modules.runs.schemas import Run
from app.modules.sessions.schemas import Session


def make_run(run_id: str, session_id: str) -> Run:
    """Mirrors tests/unit/test_run_memory_repository.py's make_run shape,
    trimmed to what the cascade tests need: a run carrying the session_id
    under test."""
    return Run(
        id=run_id,
        agent_id="agent_support",
        agent_name="Support Bot",
        model="gemini-3.1-flash-lite",
        system_prompt="You are the support agent.",
        user_message="hi",
        answer="hello",
        status="done",
        error=None,
        latency_ms=298,
        session_id=session_id,
        created_at="2026-08-04T12:00:00+00:00",
        tool_calls=[],
    )


@pytest.fixture
def made_session(client):
    """Seeded through the repository, not the API: a session is only created by
    sending a message, and these tests are about the read and write surface.

    Depends on `client` so the container is constructed (and its lru_cache
    reset by the autouse fixture in tests/conftest.py) before this seeds it.
    MemorySessionRepository is plain dict manipulation with no event-loop
    affinity, so seeding through a fresh asyncio.run is safe even though the
    request itself will later run on TestClient's own loop.
    """
    session = Session(
        id="sess_seed",
        agent_id="agent_support",
        title="Refund question",
        created_at=now(),
        updated_at=now(),
    )
    repo = get_session_repository()
    asyncio.run(repo.create(session))
    return session


def test_an_empty_workspace_lists_no_sessions(client):
    response = client.get("/api/sessions")
    assert response.status_code == 200
    assert response.json() == []


def test_a_session_is_returned_in_camel_case(client, made_session):
    body = client.get("/api/sessions").json()
    assert body[0]["agentId"] == "agent_support"
    assert body[0]["title"] == "Refund question"
    assert set(body[0]) == {"id", "agentId", "title", "createdAt", "updatedAt"}


def test_rename_updates_the_title(client, made_session):
    response = client.patch(f"/api/sessions/{made_session.id}", json={"title": "Billing"})
    assert response.status_code == 200
    assert response.json()["title"] == "Billing"
    assert client.get("/api/sessions").json()[0]["title"] == "Billing"


def test_rename_rejects_a_blank_title(client, made_session):
    response = client.patch(f"/api/sessions/{made_session.id}", json={"title": " "})
    assert response.status_code == 400
    assert response.json() == {
        "error": {"code": "bad_request", "message": "title is required."}
    }


def test_rename_of_an_unknown_session_is_a_404(client):
    response = client.patch("/api/sessions/sess_missing", json={"title": "x"})
    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "not_found",
            "message": 'No session with id "sess_missing".',
        }
    }


def test_delete_removes_the_session(client, made_session):
    assert client.delete(f"/api/sessions/{made_session.id}").status_code == 204
    assert client.get("/api/sessions").json() == []


def test_delete_of_an_unknown_session_is_a_404(client):
    assert client.delete("/api/sessions/sess_missing").status_code == 404


def test_deleting_a_session_deletes_its_runs(client, made_session):
    run_repo = get_run_repository()
    asyncio.run(run_repo.append(make_run("run_cascade", made_session.id)))

    before = client.get("/api/runs", params={"sessionId": made_session.id}).json()
    assert [r["id"] for r in before] == ["run_cascade"]

    assert client.delete(f"/api/sessions/{made_session.id}").status_code == 204

    after = client.get("/api/runs", params={"sessionId": made_session.id}).json()
    assert after == []


def test_a_404_delete_does_not_touch_runs(client):
    run_repo = get_run_repository()
    asyncio.run(run_repo.append(make_run("run_untouched", "sess_missing")))

    assert client.delete("/api/sessions/sess_missing").status_code == 404

    after = client.get("/api/runs", params={"sessionId": "sess_missing"}).json()
    assert [r["id"] for r in after] == ["run_untouched"]
