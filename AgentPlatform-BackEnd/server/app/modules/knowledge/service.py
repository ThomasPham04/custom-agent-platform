"""Read and write path for knowledge documents.

Holds no search logic: knowledge_search calls the repository's search port
directly, the way the tools and models routers use their injected ports.
"""

from typing import Any

from app.core.clock import now
from app.core.errors import NotFoundError
from app.core.ids import create_id
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeDocument


class KnowledgeService:
    def __init__(self, repo: KnowledgeRepository, max_body_bytes: int) -> None:
        self._repo = repo
        # Carried here rather than read from config in the router: app/config.py
        # is the only module that reads the environment, and the router needs
        # this value to validate a write.
        self._max_body_bytes = max_body_bytes

    @property
    def max_body_bytes(self) -> int:
        return self._max_body_bytes

    async def list(self, limit: int = 100) -> list[KnowledgeDocument]:
        return await self._repo.list(limit=limit)

    async def get(self, document_id: str) -> KnowledgeDocument:
        found = await self._repo.get(document_id)
        if found is None:
            raise NotFoundError(f'No document with id "{document_id}".')
        return found

    async def create(self, fields: dict[str, Any]) -> KnowledgeDocument:
        stamp = now()
        document = KnowledgeDocument(
            id=create_id("doc"),
            title=fields["title"],
            body=fields["body"],
            source=fields.get("source", "typed"),
            created_at=stamp,
            updated_at=stamp,
        )
        return await self._repo.create(document)

    async def update(
        self, document_id: str, fields: dict[str, Any]
    ) -> KnowledgeDocument:
        updated = await self._repo.update(document_id, fields)
        if updated is None:
            raise NotFoundError(f'No document with id "{document_id}".')
        return updated

    async def delete(self, document_id: str) -> None:
        removed = await self._repo.delete(document_id)
        if not removed:
            raise NotFoundError(f'No document with id "{document_id}".')
