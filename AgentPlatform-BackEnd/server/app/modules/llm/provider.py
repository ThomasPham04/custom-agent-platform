"""LLM Provider port.

The abstraction is one agent turn, not one model call. ADK's Runner already owns
the tool-calling loop, so wrapping a raw completion would fight the framework
(spec D7, §5.2).

TextDelta exists because ADK yields partial text internally. It does not imply a
streaming HTTP response — event_translator accumulates deltas and the endpoint
returns one finished message.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.wire import WireModel
from app.modules.tools.base import Tool


class ModelInfo(WireModel):
    id: str
    label: str


@dataclass
class RunSpec:
    agent_id: str
    name: str
    model: str
    system_prompt: str
    tools: list[Tool]
    user_message: str
    retry: bool  # request metadata, not server state
    session_id: str | None = None


@dataclass
class ToolCallStarted:
    call_id: str
    tool_id: str
    args: dict[str, Any]


@dataclass
class ToolCallFinished:
    call_id: str
    result: Any | None
    error: str | None
    duration_ms: float


@dataclass
class TextDelta:
    text: str


@dataclass
class TurnFinished:
    text: str
    model: str
    latency_ms: int


RunEvent = ToolCallStarted | ToolCallFinished | TextDelta | TurnFinished


class LLMProvider(Protocol):
    def models(self) -> list[ModelInfo]: ...

    def run(self, spec: RunSpec) -> AsyncIterator[RunEvent]: ...
