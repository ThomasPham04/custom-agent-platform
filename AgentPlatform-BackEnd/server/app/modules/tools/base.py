"""The Tool contract.

A tool is one file: its identity, its schema, and its behavior colocated. Adding
a tool means adding a file here and one line in container.py. Nothing else in the
codebase changes — that is the whole point of the registry.
"""

from typing import Any, ClassVar, Literal, Protocol, runtime_checkable

from app.core.wire import WireModel


class ToolParam(WireModel):
    name: str
    type: Literal["string", "number", "boolean"]
    required: bool = False
    description: str


class ToolSchema(WireModel):
    id: str
    label: str
    description: str
    params: list[ToolParam]


class ToolResult(WireModel):
    ok: bool
    value: Any | None = None
    error: str | None = None


@runtime_checkable
class Tool(Protocol):
    schema: ClassVar[ToolSchema]

    async def execute(self, **kwargs: Any) -> ToolResult: ...
