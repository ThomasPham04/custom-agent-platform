"""The translator is provider-agnostic: these tests feed it hand-built events
rather than either provider, which is the point of the RunEvent seam (spec §7)."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime

from app.core.clock import set_clock
from app.modules.execution.event_translator import translate
from app.modules.llm.provider import (
    RunEvent,
    RunSpec,
    TextDelta,
    ToolCallFinished,
    ToolCallStarted,
    TurnFinished,
)


def spec(**overrides) -> RunSpec:
    base = dict(
        agent_id="agent_support",
        name="Support Bot",
        model="gemini-3.1-flash-lite",
        system_prompt="You are the support agent.",
        tools=[],
        user_message="what time is it?",
        retry=False,
        session_id=None,
    )
    base.update(overrides)
    return RunSpec(**base)


async def stream(*events: RunEvent) -> AsyncIterator[RunEvent]:
    for event in events:
        yield event


OK_CALL = (
    ToolCallStarted(
        call_id="call_1", tool_id="current_time", args={"timezone": "Asia/Tokyo"}
    ),
    ToolCallFinished(
        call_id="call_1",
        result="2026-08-04T21:03:41+09:00",
        error=None,
        duration_ms=118,
    ),
)
FINISH = TurnFinished(text="It is 9:03 PM.", model="gemini-3.1-flash-lite", latency_ms=298)


async def test_returns_a_finished_assistant_message():
    message, _run = await translate(stream(*OK_CALL, FINISH), spec())
    assert message.role == "assistant"
    assert message.status == "done"
    assert message.content == "It is 9:03 PM."
    assert message.model == "gemini-3.1-flash-lite"
    assert message.latency_ms == 298
    assert message.id.startswith("msg_")


async def test_pairs_started_and_finished_events_into_one_call():
    message, _run = await translate(stream(*OK_CALL, FINISH), spec())
    assert len(message.tool_calls) == 1
    call = message.tool_calls[0]
    assert call.id == "call_1"
    assert call.tool_id == "current_time"
    assert call.args == {"timezone": "Asia/Tokyo"}
    assert call.result == "2026-08-04T21:03:41+09:00"
    assert call.duration_ms == 118
    assert call.status == "ok"
    assert call.error is None


async def test_calls_keep_the_order_they_started_in():
    events = (
        ToolCallStarted(call_id="call_1", tool_id="current_time", args={}),
        ToolCallFinished(call_id="call_1", result="a", error=None, duration_ms=1),
        ToolCallStarted(call_id="call_2", tool_id="http_request", args={}),
        ToolCallFinished(call_id="call_2", result="b", error=None, duration_ms=2),
        FINISH,
    )
    message, _run = await translate(stream(*events), spec())
    assert [c.tool_id for c in message.tool_calls] == ["current_time", "http_request"]


async def test_a_finished_event_may_arrive_out_of_order():
    """ADK can interleave; the pairing is by call id, not by adjacency."""
    events = (
        ToolCallStarted(call_id="call_1", tool_id="current_time", args={}),
        ToolCallStarted(call_id="call_2", tool_id="http_request", args={}),
        ToolCallFinished(call_id="call_2", result="b", error=None, duration_ms=2),
        ToolCallFinished(call_id="call_1", result="a", error=None, duration_ms=1),
        FINISH,
    )
    message, _run = await translate(stream(*events), spec())
    assert [c.tool_id for c in message.tool_calls] == ["current_time", "http_request"]
    assert [c.result for c in message.tool_calls] == ["a", "b"]


async def test_a_failed_call_makes_the_whole_turn_an_error():
    events = (
        ToolCallStarted(call_id="call_1", tool_id="http_request", args={}),
        ToolCallFinished(
            call_id="call_1",
            result=None,
            error="connection refused after 800ms",
            duration_ms=812,
        ),
        TurnFinished(
            text="http_request failed.", model="gemini-3.1-flash-lite", latency_ms=992
        ),
    )
    message, run = await translate(stream(*events), spec())
    assert message.status == "error"
    assert message.tool_calls[0].status == "error"
    assert message.tool_calls[0].error == "connection refused after 800ms"
    assert message.tool_calls[0].result is None
    assert run.status == "error"
    assert run.error == "connection refused after 800ms"


async def test_only_the_failed_call_is_marked_error():
    events = (
        ToolCallStarted(call_id="call_1", tool_id="current_time", args={}),
        ToolCallFinished(call_id="call_1", result="a", error=None, duration_ms=1),
        ToolCallStarted(call_id="call_2", tool_id="http_request", args={}),
        ToolCallFinished(call_id="call_2", result=None, error="boom", duration_ms=2),
        FINISH,
    )
    message, _run = await translate(stream(*events), spec())
    assert [c.status for c in message.tool_calls] == ["ok", "error"]


async def test_a_turn_with_no_tools_is_done():
    message, run = await translate(stream(FINISH), spec())
    assert message.tool_calls == []
    assert message.status == "done"
    assert run.status == "done"
    assert run.error is None


async def test_text_deltas_accumulate_when_the_turn_carries_no_text():
    """ADK yields partial text; TurnFinished may repeat it or leave it empty."""
    events = (
        TextDelta(text="It is "),
        TextDelta(text="9:03 PM."),
        TurnFinished(text="", model="gemini-3.1-flash-lite", latency_ms=298),
    )
    message, _run = await translate(stream(*events), spec())
    assert message.content == "It is 9:03 PM."


async def test_the_turn_text_wins_over_accumulated_deltas():
    events = (
        TextDelta(text="partial"),
        TurnFinished(text="the whole answer", model="gemini-3.1-flash-lite", latency_ms=1),
    )
    message, _run = await translate(stream(*events), spec())
    assert message.content == "the whole answer"


async def test_the_run_snapshots_the_config_it_executed_under():
    """Editing the agent later must not rewrite this row (spec §6)."""
    message, run = await translate(stream(*OK_CALL, FINISH), spec())
    assert run.id.startswith("run_")
    assert run.agent_id == "agent_support"
    assert run.agent_name == "Support Bot"
    assert run.model == "gemini-3.1-flash-lite"
    assert run.system_prompt == "You are the support agent."
    assert run.user_message == "what time is it?"
    assert run.answer == "It is 9:03 PM."
    assert run.latency_ms == 298
    assert message.content == run.answer


async def test_the_run_numbers_its_tool_calls():
    events = (
        ToolCallStarted(call_id="call_1", tool_id="current_time", args={}),
        ToolCallFinished(call_id="call_1", result="a", error=None, duration_ms=1),
        ToolCallStarted(call_id="call_2", tool_id="http_request", args={}),
        ToolCallFinished(call_id="call_2", result="b", error=None, duration_ms=2),
        FINISH,
    )
    _message, run = await translate(stream(*events), spec())
    assert [c.seq for c in run.tool_calls] == [0, 1]


async def test_the_message_and_the_run_share_one_timestamp():
    set_clock(lambda: datetime(2026, 8, 12, 9, 30, 0, tzinfo=UTC))
    try:
        message, run = await translate(stream(FINISH), spec())
    finally:
        set_clock(None)
    assert message.created_at == "2026-08-12T09:30:00+00:00"
    assert run.created_at == message.created_at


async def test_the_session_id_is_carried_through_when_present():
    _message, run = await translate(stream(FINISH), spec(session_id="sess_abc"))
    assert run.session_id == "sess_abc"


async def test_an_unpaired_started_event_is_recorded_as_an_error():
    """A provider that dies mid-call must still produce a coherent trace rather
    than a call with no duration and no status."""
    events = (
        ToolCallStarted(call_id="call_1", tool_id="http_request", args={}),
        TurnFinished(text="", model="gemini-3.1-flash-lite", latency_ms=5),
    )
    message, _run = await translate(stream(*events), spec())
    assert message.tool_calls[0].status == "error"
    assert message.tool_calls[0].duration_ms == 0
