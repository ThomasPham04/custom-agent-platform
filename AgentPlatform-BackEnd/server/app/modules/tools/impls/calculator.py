"""Evaluates an arithmetic expression."""

from typing import Any, ClassVar

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema


class CalculatorTool:
    schema: ClassVar[ToolSchema] = ToolSchema(
        id="calculator",
        label="Calculator",
        description="Evaluates an arithmetic expression.",
        params=[
            ToolParam(
                name="expression",
                type="string",
                required=True,
                description="Expression to evaluate.",
            )
        ],
    )

    async def execute(self, **kwargs: Any) -> ToolResult:
        raise NotImplementedError("Phase 3 implements tool execution.")
