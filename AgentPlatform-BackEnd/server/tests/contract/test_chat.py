"""Ported from server/tests/chat.test.js.

Contract reference §6. This suite runs against the memory store and the mock
provider, so it needs no database and no API key (spec §9).
"""

from app.config import get_settings

# The http_request fixture result serialises to 62 bytes, so the cap has to sit
# below that to exercise truncation at all.
SMALL_CAP = "32"


def send(client, agent_id="agent_support", **body):
    return client.post(
        f"/api/chat/{agent_id}/messages", json={"content": "hello", **body}
    )


def cap_payloads_at(monkeypatch, value: str) -> None:
    """Shrink LOG_PAYLOAD_MAX_BYTES for the requests that follow.

    get_settings is lru_cached and the `client` fixture already warmed it while
    building the app, so setenv alone would be read by nothing. The container
    resolves the execution service per request, which re-reads settings once the
    cache is dropped.
    """
    monkeypatch.setenv("LOG_PAYLOAD_MAX_BYTES", value)
    get_settings.cache_clear()


def test_returns_a_finished_assistant_message(client):
    res = send(client)
    assert res.status_code == 200
    message = res.json()["message"]
    assert message["role"] == "assistant"
    assert message["status"] == "done"
    assert message["content"]
    assert message["model"] == "gemini-3.1-flash-lite"
    assert message["id"].startswith("msg_")


def test_the_response_nests_the_message(client):
    """Envelope is {message: ...}, not the message at top level."""
    assert set(send(client).json()) == {"message"}


def test_calls_tools_in_the_agent_s_declared_order(client):
    calls = send(client).json()["message"]["toolCalls"]
    assert [c["toolId"] for c in calls] == ["current_time", "http_request"]
    for call in calls:
        assert call["status"] == "ok"
        assert call["durationMs"] > 0
        assert call["result"] is not None
        assert call["id"].startswith("call_")


def test_caps_tool_calls_at_two(client):
    """agent_research has three tools attached."""
    calls = send(client, agent_id="agent_research").json()["message"]["toolCalls"]
    assert len(calls) == 2


def test_an_agent_with_no_tools_returns_an_empty_trace(client):
    message = send(client, agent_id="agent_drafter").json()["message"]
    assert message["toolCalls"] == []
    assert message["status"] == "done"


def test_latency_is_the_call_durations_plus_exactly_180(client):
    message = send(client).json()["message"]
    expected = sum(c["durationMs"] for c in message["toolCalls"]) + 180
    assert message["latencyMs"] == expected


def test_tool_calls_are_serialised_as_camel_case(client):
    call = send(client).json()["message"]["toolCalls"][0]
    assert "toolId" in call
    assert "durationMs" in call


def test_an_ok_call_carries_no_error_key(client):
    """Express built an ok call without an `error` key at all. Sending null
    instead would be a different shape from the one the trace rail reads."""
    call = send(client).json()["message"]["toolCalls"][0]
    assert "error" not in call


def test_the_fail_keyword_produces_a_failed_last_call(client):
    message = send(client, content="make this FAIL please").json()["message"]
    assert message["status"] == "error"
    first, last = message["toolCalls"]
    assert first["status"] == "ok"
    assert last["status"] == "error"
    assert "connection refused" in last["error"]


def test_a_failed_call_has_no_result_key_at_all(client):
    """Contract §5: absent, not null."""
    last = send(client, content="please fail").json()["message"]["toolCalls"][-1]
    assert "result" not in last


def test_a_failed_run_is_still_http_200(client):
    """Spec §8: a failed tool call is not an HTTP error. The frontend's error
    path reads the body, so a 4xx or 5xx would break it."""
    assert send(client, content="please fail").status_code == 200


def test_identical_messages_from_different_clients_both_fail(client):
    """retry is request metadata, never server state (spec §5.2)."""
    first = send(client, content="transient fail retry check").json()["message"]
    second = send(client, content="transient fail retry check").json()["message"]
    assert first["status"] == "error"
    assert second["status"] == "error"


def test_retry_true_suppresses_the_failure(client):
    res = send(client, content="transient fail retry check", retry=True)
    message = res.json()["message"]
    assert message["status"] == "done"
    assert all(c["status"] == "ok" for c in message["toolCalls"])


def test_blank_content_is_a_400(client):
    res = send(client, content="   ")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "bad_request"


def test_non_boolean_retry_is_a_400_with_the_exact_envelope(client):
    res = send(client, retry="yes")
    assert res.status_code == 400
    assert res.json() == {
        "error": {"code": "bad_request", "message": "retry must be a boolean."}
    }


def test_overlong_content_is_a_400_with_the_exact_envelope(client):
    res = send(client, content="x" * 10_001)
    assert res.status_code == 400
    assert res.json() == {
        "error": {
            "code": "bad_request",
            "message": "content must be at most 10000 characters.",
        }
    }


def test_an_unknown_agent_is_a_404(client):
    res = send(client, agent_id="agent_missing")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_a_malformed_body_is_a_400(client):
    """The chat route uses the same parser as agents, so body-parser's strict
    mode applies here too."""
    res = client.post(
        "/api/chat/agent_support/messages",
        content="null",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Malformed JSON body."


def test_a_lone_surrogate_is_rejected_rather_than_crashing(client):
    res = client.post(
        "/api/chat/agent_support/messages",
        content=r'{"content":"\ud800"}',
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400


def test_an_executed_turn_is_recorded_in_runs(client):
    send(client)
    runs = client.get("/api/runs").json()
    assert len(runs) == 1
    assert runs[0]["agentId"] == "agent_support"
    assert runs[0]["status"] == "done"
    assert [c["toolId"] for c in runs[0]["toolCalls"]] == [
        "current_time",
        "http_request",
    ]


def test_the_stored_run_snapshots_the_agent_config(client):
    send(client)
    run = client.get("/api/runs").json()[0]
    assert run["agentName"] == "Support Bot"
    assert run["model"] == "gemini-3.1-flash-lite"
    assert run["systemPrompt"].startswith("You are the support agent")


def test_editing_the_agent_does_not_rewrite_past_runs(client):
    """The whole reason the snapshot columns exist (spec §6)."""
    send(client)
    client.patch("/api/agents/agent_support", json={"name": "Renamed"})
    assert client.get("/api/runs").json()[0]["agentName"] == "Support Bot"


def test_a_failed_run_is_recorded_with_its_error(client):
    send(client, content="please fail")
    run = client.get("/api/runs").json()[0]
    assert run["status"] == "error"
    assert "connection refused" in run["error"]
    assert run["toolCalls"][-1]["status"] == "error"


def test_the_stored_run_numbers_its_calls(client):
    send(client)
    run = client.get("/api/runs").json()[0]
    assert [c["seq"] for c in run["toolCalls"]] == [0, 1]


def test_each_test_starts_from_an_empty_run_store(client):
    assert client.get("/api/runs").json() == []


def test_an_oversized_payload_is_truncated_in_the_stored_run(client, monkeypatch):
    """Spec §6 caps args and result at LOG_PAYLOAD_MAX_BYTES. http_request can
    return a large body, and an unbounded log row is a liability."""
    cap_payloads_at(monkeypatch, SMALL_CAP)
    send(client)
    call = client.get("/api/runs").json()[0]["toolCalls"][1]
    assert call["result"]["truncated"] is True
    assert call["result"]["bytes"] > int(SMALL_CAP)
    assert "preview" in call["result"]


def test_truncation_does_not_touch_the_response(client, monkeypatch):
    """The contract fixes the response bytes exactly; only the stored row is
    capped (decision 7). Truncating both would break parity."""
    cap_payloads_at(monkeypatch, SMALL_CAP)
    call = send(client).json()["message"]["toolCalls"][1]
    assert call["result"] == {
        "status": 200,
        "latencyMs": 41,
        "body": {"state": "healthy"},
    }


def test_a_payload_under_the_cap_is_stored_verbatim(client):
    send(client)
    call = client.get("/api/runs").json()[0]["toolCalls"][1]
    assert call["result"] == {
        "status": 200,
        "latencyMs": 41,
        "body": {"state": "healthy"},
    }
