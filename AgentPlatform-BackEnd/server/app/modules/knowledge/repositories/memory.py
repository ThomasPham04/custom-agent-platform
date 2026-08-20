"""In-memory KnowledgeRepository.

Ordering and cloning mirror MemorySessionRepository so the shared contract
suite can hold both implementations to one behaviour.
"""

from collections.abc import Sequence
from typing import Any

from app.core.clock import now
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeDocument, SearchHit
from app.modules.knowledge.search import score, snippet


class MemoryKnowledgeRepository(KnowledgeRepository):
    def __init__(self, seed: Sequence[KnowledgeDocument] = ()) -> None:
        # Seeded at construction, the way MemoryAgentRepository is. The
        # container caches one store per process, so this runs once — the
        # memory equivalent of "seed only when the table is empty".
        self._documents: dict[str, KnowledgeDocument] = {
            d.id: d.model_copy(deep=True) for d in seed
        }

    async def create(self, document: KnowledgeDocument) -> KnowledgeDocument:
        self._documents[document.id] = document.model_copy(deep=True)
        return document.model_copy(deep=True)

    async def get(self, document_id: str) -> KnowledgeDocument | None:
        found = self._documents.get(document_id)
        return found.model_copy(deep=True) if found is not None else None

    async def list(self, limit: int) -> list[KnowledgeDocument]:
        # Sorted here rather than in the service because Postgres sorts in SQL
        # and the contract suite keeps the two identical.
        ordered = sorted(
            self._documents.values(), key=lambda d: d.updated_at, reverse=True
        )
        return [d.model_copy(deep=True) for d in ordered[:limit]]

    async def update(
        self, document_id: str, fields: dict[str, Any]
    ) -> KnowledgeDocument | None:
        found = self._documents.get(document_id)
        if found is None:
            return None
        if not fields:
            # An empty patch must not reorder the list, so updated_at is left
            # exactly as it was.
            return found.model_copy(deep=True)
        updated = found.model_copy(update={**fields, "updated_at": now()})
        self._documents[document_id] = updated
        return updated.model_copy(deep=True)

    async def delete(self, document_id: str) -> bool:
        return self._documents.pop(document_id, None) is not None

    async def search(self, query: str, limit: int) -> list[SearchHit]:
        scored = [(score(query, d.title, d.body), d) for d in self._documents.values()]
        matching = [(value, d) for value, d in scored if value > 0]
        # Ties break by recency so results are stable rather than dict-ordered.
        matching.sort(key=lambda pair: (pair[0], pair[1].updated_at), reverse=True)
        return [
            SearchHit(
                id=d.id, title=d.title, snippet=snippet(d.body, query), score=value
            )
            for value, d in matching[: max(limit, 0)]
        ]
