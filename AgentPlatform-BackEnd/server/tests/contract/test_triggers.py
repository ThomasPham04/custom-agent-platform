import pytest


def create_trigger(client, **overrides):
    body = {
        "agentId": "agent_drafter",
        "name": "Draft release notes",
        "kind": "interval",
        "message": "Draft the release notes.",
        "intervalMinutes": 30,
        "timezone": "UTC",
    }
    body.update(overrides)
    return client.post("/api/triggers", json=body)


def test_trigger_crud_and_agent_filter(client):
    created = create_trigger(client)
    assert created.status_code == 201
    trigger = created.json()
    assert trigger["id"].startswith("trg_")
    assert trigger["agentId"] == "agent_drafter"
    assert trigger["nextRunAt"] is not None

    other = create_trigger(client, agentId="agent_support", name="Support check")
    assert other.status_code == 201

    listed = client.get("/api/triggers", params={"agentId": "agent_drafter"})
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [trigger["id"]]

    patched = client.patch(
        f'/api/triggers/{trigger["id"]}',
        json={"name": "Paused draft", "enabled": False},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Paused draft"
    assert patched.json()["nextRunAt"] is None

    assert client.delete(f'/api/triggers/{trigger["id"]}').status_code == 204
    missing = client.get(f'/api/triggers/{trigger["id"]}')
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_run_now_persists_trigger_activity_without_a_chat_session(client):
    trigger = create_trigger(client, enabled=False).json()

    response = client.post(f'/api/triggers/{trigger["id"]}/run')
    assert response.status_code == 200
    run = response.json()
    assert run["triggerId"] == trigger["id"]
    assert run["sessionId"] is None
    assert run["status"] == "done"

    activity = client.get("/api/runs", params={"triggerId": trigger["id"]})
    assert activity.status_code == 200
    assert [item["id"] for item in activity.json()] == [run["id"]]

    refreshed = client.get(f'/api/triggers/{trigger["id"]}').json()
    assert refreshed["lastStatus"] == "done"
    assert refreshed["lastRunId"] == run["id"]
    assert refreshed["lastRunAt"] is not None
    assert refreshed["nextRunAt"] is None


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({}, "agentId is required."),
        (
            {"agentId": "agent_support", "kind": "interval", "message": "x"},
            "intervalMinutes is required for an interval trigger.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "daily",
                "message": "x",
                "timeOfDay": "25:00",
            },
            "timeOfDay must be a time of day as HH:MM.",
        ),
    ],
)
def test_create_validation_uses_the_standard_error_envelope(client, body, message):
    response = client.post("/api/triggers", json=body)
    assert response.status_code == 400
    assert response.json() == {"error": {"code": "bad_request", "message": message}}


def test_unknown_agent_and_trigger_return_not_found(client):
    missing_agent = create_trigger(client, agentId="agent_missing")
    assert missing_agent.status_code == 404
    assert missing_agent.json()["error"]["message"] == 'No agent with id "agent_missing".'

    missing_trigger = client.post("/api/triggers/trg_missing/run")
    assert missing_trigger.status_code == 404
    assert missing_trigger.json()["error"]["message"] == 'No trigger with id "trg_missing".'
