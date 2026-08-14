"""Reads the current time in a given timezone."""

from typing import Any, ClassVar
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.clock import now
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
        name = kwargs.get("timezone") or "UTC"
        try:
            zone = ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            # A bad argument is a failed call in the trace, not a 500.
            return ToolResult(ok=False, error=f'Unknown timezone "{name}".')
        return ToolResult(ok=True, value=now().astimezone(zone).isoformat())
