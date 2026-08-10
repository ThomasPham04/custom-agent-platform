"""Fetches a URL and returns the status and body."""

from typing import Any, ClassVar

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema


class HttpRequestTool:
    schema: ClassVar[ToolSchema] = ToolSchema(
        id="http_request",
        label="HTTP request",
        description="Fetches a URL and returns the status and body.",
        params=[
            ToolParam(
                name="url",
                type="string",
                required=True,
                description="Absolute URL to request.",
            ),
            ToolParam(
                name="method",
                type="string",
                required=False,
                description="HTTP method. Defaults to GET.",
            ),
        ],
    )

    async def execute(self, **kwargs: Any) -> ToolResult:
        raise NotImplementedError("Phase 3 implements tool execution.")
