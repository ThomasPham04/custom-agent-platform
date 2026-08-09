"""Searches the internal knowledge base."""

from typing import Any, ClassVar

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema


class KnowledgeSearchTool:
    schema: ClassVar[ToolSchema] = ToolSchema(
        id="knowledge_search",
        label="Knowledge search",
        description="Searches the internal knowledge base.",
        params=[
            ToolParam(
                name="query", type="string", required=True, description="Search terms."
            ),
            ToolParam(
                name="limit",
                type="number",
                required=False,
                description="Maximum results. Defaults to 5.",
            ),
        ],
    )

    async def execute(self, **kwargs: Any) -> ToolResult:
        raise NotImplementedError("Phase 3 implements tool execution.")
