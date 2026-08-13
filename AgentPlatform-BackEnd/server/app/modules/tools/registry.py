"""Tool Provider — the catalog and the invoker.

This is the only module that knows which tools exist. `known_ids()` exists so
agents/ can validate tool ids without importing the catalog (spec §4.2).
"""

# ToolRegistry defines a method named `list`, which shadows the builtin inside
# the class body. Deferring annotations keeps `-> list[Tool]` on later methods
# from being evaluated against that method object.
from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from app.core.errors import BadRequestError
from app.modules.tools.base import Tool, ToolResult, ToolSchema
from app.modules.tools.impls.calculator import CalculatorTool
from app.modules.tools.impls.current_time import CurrentTimeTool
from app.modules.tools.impls.http_request import HttpRequestTool
from app.modules.tools.impls.knowledge_search import KnowledgeSearchTool


def default_tools(http_timeout_ms: int) -> list[Tool]:
    """Registration order is the order GET /api/tools returns, and the frontend
    tool picker renders them in that order."""
    return [
        CurrentTimeTool(),
        HttpRequestTool(timeout_ms=http_timeout_ms),
        CalculatorTool(),
        KnowledgeSearchTool(),
    ]


class ToolRegistry:
    def __init__(self, tools: Sequence[Tool]) -> None:
        self._tools: dict[str, Tool] = {t.schema.id: t for t in tools}

    def list(self) -> list[ToolSchema]:
        return [t.schema for t in self._tools.values()]

    def get(self, tool_id: str) -> Tool | None:
        return self._tools.get(tool_id)

    def resolve(self, ids: Sequence[str]) -> list[Tool]:
        unknown = [i for i in ids if i not in self._tools]
        if unknown:
            raise BadRequestError(f"Unknown tool ids: {', '.join(unknown)}.")
        return [self._tools[i] for i in ids]

    def known_ids(self) -> set[str]:
        return set(self._tools)

    async def invoke(self, tool_id: str, **kwargs: Any) -> ToolResult:
        tool = self.get(tool_id)
        if tool is None:
            raise BadRequestError(f'Unknown tool "{tool_id}".')
        return await tool.execute(**kwargs)
