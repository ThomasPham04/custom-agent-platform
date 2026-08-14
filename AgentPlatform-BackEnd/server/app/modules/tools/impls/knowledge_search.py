"""Searches the internal knowledge base."""

from typing import Any, ClassVar

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema

# A fixed corpus, not a database. The brief's knowledge tool exists to show a
# tool returning structured data; the fixture in the mock provider quotes the
# first two entries, so keep the titles in step.
_CORPUS: list[dict[str, str]] = [
    {
        "title": "Refunds — 30 day window",
        "body": "Refunds are available within 30 days of the invoice date. "
        "After that the charge stands and the policy window has closed.",
    },
    {
        "title": "Proration on downgrade",
        "body": "Downgrades prorate from the next billing cycle, not immediately. "
        "The current cycle is billed at the original plan price.",
    },
    {
        "title": "Usage metering and billable storage",
        "body": "Billable storage is measured in gigabytes at the end of each cycle. "
        "Recorded usage above the plan allowance is charged per gigabyte.",
    },
    {
        "title": "Status page and incident history",
        "body": "The status endpoint reports service health. Incident history is "
        "retained for 90 days and is public.",
    },
]


def _score(query: str, entry: dict[str, str]) -> float:
    """Term overlap, normalised by query length. Deterministic and explainable —
    a real deployment would swap this for a vector store (docs/extending.md)."""
    terms = {t for t in query.lower().split() if len(t) > 2}
    if not terms:
        return 0.0
    haystack = f"{entry['title']} {entry['body']}".lower()
    hits = sum(1 for term in terms if term in haystack)
    return round(hits / len(terms), 2)


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
        query = kwargs.get("query")
        if not isinstance(query, str) or not query.strip():
            return ToolResult(ok=False, error="query must be a non-empty string.")
        try:
            limit = int(kwargs.get("limit") or 5)
        except (TypeError, ValueError):
            return ToolResult(ok=False, error="limit must be a number.")

        scored = [
            {"title": entry["title"], "score": _score(query, entry)}
            for entry in _CORPUS
        ]
        hits = sorted(
            (s for s in scored if s["score"] > 0),
            key=lambda s: s["score"],
            reverse=True,
        )
        return ToolResult(ok=True, value=hits[: max(limit, 0)])
