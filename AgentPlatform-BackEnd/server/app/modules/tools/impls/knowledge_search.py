"""Searches the knowledge library.

The corpus used to live here as a fixed list. It is now a repository, so the
documents a user uploads are the documents an agent searches. The scoring
moved to app/modules/knowledge/search.py, where both repository
implementations share it, and the four demo entries moved to
app/modules/knowledge/seeds.py, where they are seeded rows a user can delete.
"""

from typing import Any, ClassVar

from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.tools.base import ToolParam, ToolResult, ToolSchema

DEFAULT_LIMIT = 5


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

    def __init__(self, knowledge: KnowledgeRepository) -> None:
        self._knowledge = knowledge

    async def execute(self, **kwargs: Any) -> ToolResult:
        query = kwargs.get("query")
        if not isinstance(query, str) or not query.strip():
            return ToolResult(ok=False, error="query must be a non-empty string.")
        try:
            limit = int(kwargs.get("limit") or DEFAULT_LIMIT)
        except (TypeError, ValueError):
            return ToolResult(ok=False, error="limit must be a number.")

        hits = await self._knowledge.search(query, limit=max(limit, 0))
        return ToolResult(ok=True, value=[hit.to_dict() for hit in hits])
