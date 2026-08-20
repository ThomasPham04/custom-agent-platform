"""Agent Execution wire schemas.

Limits are transcribed from server/controllers/chatController.js: content is
required, trimmed, non-empty, and at most 10000 characters.
"""

from typing import Any, Literal

from app.core.wire import WireModel
from app.modules.sessions.schemas import Session

MessageStatus = Literal["done", "error"]
CallStatus = Literal["ok", "error"]


class MessageRequest(WireModel):
    # Constraints live in validation.py, not here: the contract's messages and
    # its whitespace and bool rules are unreachable through Field().
    content: str
    # Request metadata, not server state: identical messages from different
    # clients stay independent.
    retry: bool = False
    # Absent on the first message of a chat: the session is created by the send.
    session_id: str | None = None


class ToolCall(WireModel):
    id: str
    tool_id: str
    args: dict[str, Any]
    result: Any | None = None
    error: str | None = None
    duration_ms: float
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
    """{"message": ...}, plus {"session": ...} on the request that created one."""

    message: MessageResponse
    session: Session | None = None
