"""Agent Execution wire schemas.

Limits are transcribed from server/controllers/chatController.js: content is
required, trimmed, non-empty, and at most 10000 characters.
"""

from typing import Any, Literal

from pydantic import Field

from app.core.wire import WireModel

MessageStatus = Literal["done", "error"]
CallStatus = Literal["ok", "error"]


class MessageRequest(WireModel):
    content: str = Field(min_length=1, max_length=10_000)
    # Request metadata, not server state: identical messages from different
    # clients stay independent (spec §5.2).
    retry: bool = False


class ToolCall(WireModel):
    id: str
    tool_id: str
    args: dict[str, Any]
    result: Any | None = None
    error: str | None = None
    duration_ms: int
    status: CallStatus


class MessageResponse(WireModel):
    id: str
    role: Literal["assistant"]
    content: str
    tool_calls: list[ToolCall]
    model: str
    latency_ms: int
    status: MessageStatus
    created_at: str


class MessageEnvelope(WireModel):
    """The endpoint returns {"message": ...}, matching Express."""

    message: MessageResponse
