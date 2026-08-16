"""Every fixture value here is transcribed from contract reference §5.

The mock is not a stand-in for the real provider — it *is* the contract for
tests/contract/test_chat.py, which asserts these exact numbers and strings.
"""

import pytest

from app.modules.llm.provider import (
    RunSpec,
    ToolCallFinished,
    ToolCallStarted,
    TurnFinished,
)
from app.modules.llm.providers.mock import MockLLMProvider
from app.modules.tools.registry import default_tools

TOOLS = {t.schema.id: t for t in default_tools(http_timeout_ms=5000)}


def spec(
    agent_id: str = "agent_support",
    tool_ids: tuple[str, ...] = ("current_time", "http_request"),
    message: str = "hello",
    retry: bool = False,
) -> RunSpec:
    return RunSpec(
        agent_id=agent_id,
        name="Support Bot",
        model="gemini-3.1-flash-lite",
        system_prompt="",
        tools=[TOOLS[i] for i in tool_ids],
        user_message=message,
        retry=retry,
    )


async def collect(run_spec: RunSpec) -> list:
    return [event async for event in MockLLMProvider().run(run_spec)]


async def test_emits_a_started_and_finished_event_per_tool():
    events = await collect(spec())
    assert [type(e) for e in events] == [
        ToolCallStarted,
        ToolCallFinished,
        ToolCallStarted,
        ToolCallFinished,
        TurnFinished,
    ]


async def test_calls_tools_in_the_agent_s_declared_order():
    events = await collect(spec(tool_ids=("http_request", "current_time")))
    started = [e.tool_id for e in events if isinstance(e, ToolCallStarted)]
    assert started == ["http_request", "current_time"]


async def test_caps_calls_at_two():
    """agent_research has three tools attached and must yield exactly two."""
    events = await collect(
        spec(
            agent_id="agent_research",
            tool_ids=("knowledge_search", "http_request", "calculator"),
        )
    )
    started = [e.tool_id for e in events if isinstance(e, ToolCallStarted)]
    assert started == ["knowledge_search", "http_request"]


async def test_an_agent_with_no_tools_still_finishes():
    events = await collect(spec(agent_id="agent_drafter", tool_ids=()))
    assert [type(e) for e in events] == [TurnFinished]
    assert events[0].text == (
        "This agent has no tools attached yet, so it can only answer from its system prompt."
    )


async def test_call_ids_are_call_prefixed_and_paired():
    events = await collect(spec())
    started = [e for e in events if isinstance(e, ToolCallStarted)]
    finished = [e for e in events if isinstance(e, ToolCallFinished)]
    assert all(e.call_id.startswith("call_") for e in started)
    assert [e.call_id for e in started] == [e.call_id for e in finished]


async def test_fixture_args_and_results_match_the_contract():
    events = await collect(spec(tool_ids=("current_time",)))
    started, finished, _turn = events
    assert started.args == {"timezone": "Asia/Tokyo"}
    assert finished.result == "2026-08-04T21:03:41+09:00"
    assert finished.duration_ms == 118
    assert finished.error is None


async def test_the_http_fixture_keeps_its_camel_case_payload_key():
    """`latencyMs` sits inside an opaque JSON value, not a WireModel, so no
    alias generator touches it. Spelling it latency_ms would reach the frontend
    unchanged and render blank."""
    events = await collect(spec(tool_ids=("http_request",)))
    assert events[1].result == {
        "status": 200,
        "latencyMs": 41,
        "body": {"state": "healthy"},
    }


async def test_the_knowledge_fixture_returns_two_entries_despite_limit_three():
    events = await collect(spec(tool_ids=("knowledge_search",)))
    assert events[0].args == {"query": "refund window policy", "limit": 3}
    assert len(events[1].result) == 2


async def test_latency_is_the_call_durations_plus_the_model_time():
    events = await collect(spec())
    turn = events[-1]
    assert turn.latency_ms == 118 + 412 + 180


async def test_latency_for_a_toolless_agent_is_just_the_model_time():
    events = await collect(spec(agent_id="agent_drafter", tool_ids=()))
    assert events[-1].latency_ms == 180


@pytest.mark.parametrize(
    "message", ["make this FAIL please", "a failure", "failing now", "fail"]
)
async def test_the_failure_keyword_is_a_word_boundary_prefix_match(message):
    events = await collect(spec(message=message))
    # Selected by type rather than by offset: the stream interleaves started and
    # finished events, so a negative index lands on the wrong one.
    finished = [e for e in events if isinstance(e, ToolCallFinished)]
    assert finished[0].error is None, "the first call stays ok"
    assert finished[-1].error == "connection refused after 800ms"
    assert finished[-1].result is None
    assert finished[-1].duration_ms == 812


@pytest.mark.parametrize("message", ["unfail this", "no problems here"])
async def test_words_that_only_contain_fail_do_not_trigger_it(message):
    events = await collect(spec(message=message))
    assert all(e.error is None for e in events if isinstance(e, ToolCallFinished))


async def test_the_failure_answer_names_the_tool_that_failed():
    events = await collect(spec(message="please fail"))
    assert events[-1].text == (
        "http_request failed: connection refused after 800ms. "
        "Nothing was written, so retrying is safe."
    )


async def test_a_toolless_agent_never_fails():
    events = await collect(
        spec(agent_id="agent_drafter", tool_ids=(), message="fail please")
    )
    assert [type(e) for e in events] == [TurnFinished]


async def test_retry_suppresses_the_failure():
    events = await collect(spec(message="transient fail retry check", retry=True))
    assert all(e.error is None for e in events if isinstance(e, ToolCallFinished))
    assert events[-1].text.startswith("It's 9:03 PM in Tokyo")


async def test_latency_uses_the_failed_call_s_duration():
    events = await collect(spec(message="please fail"))
    assert events[-1].latency_ms == 118 + 812 + 180


async def test_each_agent_gets_its_canned_answer():
    events = await collect(spec(agent_id="agent_metrics", tool_ids=("calculator",)))
    assert events[-1].text == (
        "That works out to 156.6 GB billable, which is 87% of the 180 GB recorded."
    )


async def test_an_unknown_agent_id_gets_the_fallback_answer():
    events = await collect(spec(agent_id="agent_brandnew"))
    assert events[-1].text == "Done. Expand a step above to see what each tool returned."


async def test_fixtures_are_deep_cloned_between_runs():
    """Contract §5: a caller mutating a result must not poison the next request."""
    first = await collect(spec(tool_ids=("http_request",)))
    first[1].result["body"]["state"] = "mutated"
    second = await collect(spec(tool_ids=("http_request",)))
    assert second[1].result["body"] == {"state": "healthy"}


async def test_the_turn_reports_the_requested_model():
    events = await collect(spec())
    assert events[-1].model == "gemini-3.1-flash-lite"
