"""Execution history and logs.

This is exactly what the frontend trace rail renders, so the inline trace becomes
a read of stored history rather than a response the client discards on reload.
"""

from typing import Any, Literal

from app.core.wire import WireModel

RunStatus = Literal["done", "error"]
CallStatus = Literal["ok", "error"]


class RunToolCall(WireModel):
    id: str
    seq: int
    tool_id: str
    args: dict[str, Any]
    result: Any | None = None
    error: str | None = None
    duration_ms: int
    status: CallStatus


class Run(WireModel):
    id: str
    agent_id: str
    # Snapshot of the config this run actually executed under. See test docstring.
    agent_name: str
    model: str
    system_prompt: str
    user_message: str
    answer: str
    status: RunStatus
    error: str | None = None
    latency_ms: int
    session_id: str | None = None
    created_at: str
    tool_calls: list[RunToolCall]
