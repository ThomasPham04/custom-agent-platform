"""The provider's job is translation, and translation is testable offline.

Fake events stand in for ADK's stream. What cannot be faked — that Gemini
actually calls a tool — is Task 8's manual verification (spec §13.4).
"""

import pytest

from app.modules.execution.agent_factory import build_adk_agent
from app.modules.llm.provider import (
    RunSpec,
    TextDelta,
    ToolCallFinished,
    ToolCallStarted,
    TurnFinished,
)
from app.modules.llm.providers.adk_gemini import AdkGeminiProvider
from app.modules.tools.adk_adapter import CallRecord
from app.modules.tools.registry import default_tools

pytest.importorskip("google.adk")

TOOLS = {t.schema.id: t for t in default_tools(http_timeout_ms=5000)}


def spec(**overrides) -> RunSpec:
    base = dict(
        agent_id="agent_support",
        name="Support Bot",
        model="gemini-3.1-flash-lite",
        system_prompt="You are the support agent.",
        tools=[TOOLS["current_time"]],
        user_message="what time is it in Tokyo?",
        retry=False,
        session_id=None,
    )
    base.update(overrides)
    return RunSpec(**base)


class FakeEvent:
    def __init__(self, text: str = "", final: bool = False) -> None:
        self._text = text
        self._final = final

    def get_function_calls(self):
        return []

    def get_function_responses(self):
        return []

    def is_final_response(self):
        return self._final

    @property
    def content(self):
        if not self._text:
            return None

        class Part:
            text = self._text

        class Content:
            parts = [Part()]

        return Content()


def _fake_stream(events, records=()):
    async def stream(_spec, recorder):
        for record in records:
            recorder.calls.append(record)
        for event in events:
            yield event

    return stream


def test_the_adk_agent_name_is_an_identifier_not_the_display_name():
    """LlmAgent validates its name; 'Support Bot' is rejected."""
    agent = build_adk_agent(spec(), adk_tools=[])
    assert agent.name == "agent_support"
    assert agent.name.isidentifier()


def test_the_adk_agent_carries_the_prompt_and_model():
    agent = build_adk_agent(spec(), adk_tools=[])
    assert agent.instruction.startswith("You are the support agent.")
    assert agent.model == "gemini-3.1-flash-lite"


def test_the_agent_is_told_its_display_name():
    """ADK appends `You are an agent. Your internal name is "<name>"` to every
    request, and that name must be the id because LlmAgent validates it as a
    Python identifier. Left alone, the id is the only name the model ever sees,
    so asked to introduce itself it answers "I am agent_support". The display
    name has to be stated in the instruction or it never reaches the model."""
    agent = build_adk_agent(spec(), adk_tools=[])
    assert "Support Bot" in agent.instruction
    assert agent.instruction.index("You are the support agent.") < agent.instruction.index(
        "Support Bot"
    )


def test_an_empty_system_prompt_still_names_the_agent():
    """agent_drafter ships with system_prompt ''."""
    agent = build_adk_agent(spec(system_prompt=""), adk_tools=[])
    assert "Support Bot" in agent.instruction
    assert agent.instruction == agent.instruction.strip()


async def test_text_events_become_deltas_and_a_finished_turn(monkeypatch):
    provider = AdkGeminiProvider(api_key="test-key")
    monkeypatch.setattr(
        provider,
        "_stream",
        _fake_stream([FakeEvent("It is "), FakeEvent("6:30 PM.", final=True)]),
    )
    events = [e async for e in provider.run(spec())]

    assert [type(e) for e in events] == [TextDelta, TextDelta, TurnFinished]
    assert events[-1].text == "It is 6:30 PM."
    assert events[-1].model == "gemini-3.1-flash-lite"
    assert events[-1].latency_ms >= 0


async def test_recorded_tool_calls_become_paired_events(monkeypatch):
    provider = AdkGeminiProvider(api_key="test-key")
    monkeypatch.setattr(
        provider,
        "_stream",
        _fake_stream(
            [FakeEvent("done", final=True)],
            records=[
                CallRecord(
                    tool_id="current_time",
                    args={"timezone": "Asia/Tokyo"},
                    result="2026-08-12T18:30:00+09:00",
                    error=None,
                    duration_ms=42,
                )
            ],
        ),
    )
    events = [e async for e in provider.run(spec())]

    # The fake event also carries text, so a TextDelta leads — replayed tool
    # events land between the model's text and the finished turn.
    assert [type(e) for e in events] == [
        TextDelta,
        ToolCallStarted,
        ToolCallFinished,
        TurnFinished,
    ]
    started = next(e for e in events if isinstance(e, ToolCallStarted))
    finished = next(e for e in events if isinstance(e, ToolCallFinished))
    assert started.tool_id == "current_time"
    assert started.args == {"timezone": "Asia/Tokyo"}
    assert finished.result == "2026-08-12T18:30:00+09:00"
    assert finished.duration_ms == 42
    assert started.call_id == finished.call_id
    assert started.call_id.startswith("call_")


async def test_a_failed_tool_call_keeps_its_error(monkeypatch):
    provider = AdkGeminiProvider(api_key="test-key")
    monkeypatch.setattr(
        provider,
        "_stream",
        _fake_stream(
            [FakeEvent("sorry", final=True)],
            records=[
                CallRecord(
                    tool_id="http_request",
                    args={"url": "https://x.example"},
                    result=None,
                    error="Timed out after 5s.",
                    duration_ms=5001,
                )
            ],
        ),
    )
    events = [e async for e in provider.run(spec())]
    finished = next(e for e in events if isinstance(e, ToolCallFinished))
    assert finished.error == "Timed out after 5s."
    assert finished.result is None


async def test_a_provider_failure_becomes_a_502(monkeypatch):
    from app.core.errors import ProviderError

    async def boom(_spec, _recorder):
        raise RuntimeError("upstream exploded")
        yield  # pragma: no cover - makes this an async generator

    provider = AdkGeminiProvider(api_key="test-key")
    monkeypatch.setattr(provider, "_stream", boom)

    with pytest.raises(ProviderError) as exc:
        [e async for e in provider.run(spec())]
    assert exc.value.status == 502


class ThoughtEvent:
    """An ADK event whose parts mix a reasoning summary with real answer text."""

    def get_function_calls(self):
        return []

    def get_function_responses(self):
        return []

    def is_final_response(self):
        return True

    @property
    def content(self):
        class Thought:
            text = "The user wants the time; I should call current_time."
            thought = True

        class Answer:
            text = "It is 6:30 PM in Tokyo."
            thought = False

        class Content:
            parts = [Thought(), Answer()]

        return Content()


async def test_thought_parts_never_reach_the_answer(monkeypatch):
    """Gemini can return its reasoning summary alongside the answer. That is
    internal, and leaking it into `content` would put the model's private
    deliberation on the user's screen and into the stored run."""
    provider = AdkGeminiProvider(api_key="test-key")
    monkeypatch.setattr(provider, "_stream", _fake_stream([ThoughtEvent()]))
    events = [e async for e in provider.run(spec())]

    assert events[-1].text == "It is 6:30 PM in Tokyo."
    assert "I should call" not in events[-1].text
