"""Knowledge document persistence port.

search() lives here rather than in the service because the two backends will
eventually answer it differently — a linear scan today, full-text search when
the corpus outgrows one. Callers depend on this Protocol and never learn
which they got.
"""

from typing import Any, Protocol

from app.modules.knowledge.schemas import KnowledgeDocument, SearchHit


class KnowledgeRepository(Protocol):
    async def create(self, document: KnowledgeDocument) -> KnowledgeDocument: ...

    async def get(self, document_id: str) -> KnowledgeDocument | None: ...

    async def list(self, limit: int) -> list[KnowledgeDocument]: ...

    async def update(
        self, document_id: str, fields: dict[str, Any]
    ) -> KnowledgeDocument | None: ...

    async def delete(self, document_id: str) -> bool: ...

    async def search(self, query: str, limit: int) -> list[SearchHit]: ...
