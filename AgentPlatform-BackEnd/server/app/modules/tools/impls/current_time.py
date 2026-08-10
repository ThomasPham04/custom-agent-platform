"""Reads the current time in a given timezone."""

from typing import Any, ClassVar

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema


class CurrentTimeTool:
    schema: ClassVar[ToolSchema] = ToolSchema(
        id="current_time",
        label="Current time",
        description="Reads the current time in a given timezone.",
        params=[
            ToolParam(
                name="timezone",
                type="string",
                required=False,
                description="IANA timezone name. Defaults to UTC.",
            )
        ],
    )

    async def execute(self, **kwargs: Any) -> ToolResult:
        raise NotImplementedError("Phase 3 implements tool execution.")
