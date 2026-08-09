"""The snapshot fields are load-bearing.

Agents are mutable. If a run stored only agent_id, editing an agent's prompt
would retroactively rewrite the history of every past run. Snapshotting makes the
record an audit trail rather than a join (spec §6).
"""

from app.modules.runs.schemas import Run, RunToolCall


def test_run_snapshots_the_config_it_ran_under():
    run = Run(
        id="run_1",
        agent_id="agent_support",
        agent_name="Support Bot",
        model="gemini-2.5-flash",
        system_prompt="You are the support agent.",
        user_message="hi",
        answer="hello",
        status="done",
        error=None,
        latency_ms=1840,
        session_id=None,
        created_at="2026-08-08T12:00:00+00:00",
        tool_calls=[],
    )
    assert run.agent_name == "Support Bot"
    assert run.system_prompt == "You are the support agent."


def test_run_serializes_to_camel_case():
    run = Run(
        id="run_1",
        agent_id="a",
        agent_name="A",
        model="m",
        system_prompt="",
        user_message="",
        answer="",
        status="done",
        error=None,
        latency_ms=0,
        session_id=None,
        created_at="",
        tool_calls=[],
    )
    body = run.model_dump(by_alias=True)
    assert "agentId" in body
    assert "latencyMs" in body
    assert "toolCalls" in body


def test_tool_call_carries_args_result_and_duration():
    call = RunToolCall(
        id="call_1",
        seq=0,
        tool_id="current_time",
        args={"timezone": "UTC"},
        result={"iso": "2026-08-08T12:00:00+00:00"},
        error=None,
        duration_ms=12,
        status="ok",
    )
    assert call.model_dump(by_alias=True)["durationMs"] == 12
