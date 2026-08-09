"""Agent Management wire schemas.

STRING_LIMITS and the writable field set mirror agentStore.js exactly: id,
createdAt, and updatedAt are server-owned and are silently dropped from a patch.
"""

from typing import Literal

from pydantic import Field

from app.core.wire import WireModel

AgentStatus = Literal["active", "draft"]


class Agent(WireModel):
    id: str
    name: str = Field(max_length=120)
    icon: str = Field(max_length=32)
    description: str = Field(max_length=2000)
    model: str = Field(max_length=64)
    system_prompt: str = Field(max_length=20_000)
    tool_ids: list[str]
    status: AgentStatus
    created_at: str
    updated_at: str


class AgentCreate(WireModel):
    name: str | None = Field(default=None, max_length=120)
    icon: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    model: str | None = Field(default=None, max_length=64)
    system_prompt: str | None = Field(default=None, max_length=20_000)
    tool_ids: list[str] | None = None
    status: AgentStatus | None = None


class AgentPatch(AgentCreate):
    """Same writable surface as create. Every field optional."""
