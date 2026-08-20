"""asyncpg KnowledgeRepository.

Held to the same contract as the memory store by
tests/repositories/test_knowledge_repository_contract.py.

search() selects every row and scores in Python rather than using full-text
search. That is a deliberate simplification: it keeps ranking identical to the
memory store, which is what makes one set of contract assertions cover both.
Replacing it with tsvector and ts_rank touches this file and no caller.
"""

from typing import Any

import asyncpg

from app.core.clock import now
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeDocument, SearchHit
from app.modules.knowledge.search import score, snippet

_COLUMNS = "id, title, body, source, created_at, updated_at"

# The only names ever interpolated into the UPDATE below. Validation already
# restricts a patch to these, and this tuple is the second guard.
_UPDATABLE_COLUMNS = ("title", "body")


def _to_document(record: asyncpg.Record) -> KnowledgeDocument:
    return KnowledgeDocument(
        id=record["id"],
        title=record["title"],
        body=record["body"],
        source=record["source"],
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


class PostgresKnowledgeRepository(KnowledgeRepository):
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def create(self, document: KnowledgeDocument) -> KnowledgeDocument:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"""INSERT INTO knowledge_documents ({_COLUMNS})
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING {_COLUMNS}""",
                document.id,
                document.title,
                document.body,
                document.source,
                document.created_at,
                document.updated_at,
            )
        return _to_document(record)

    async def get(self, document_id: str) -> KnowledgeDocument | None:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"SELECT {_COLUMNS} FROM knowledge_documents WHERE id = $1",
                document_id,
            )
        return _to_document(record) if record is not None else None

    async def list(self, limit: int) -> list[KnowledgeDocument]:
        async with self._pool.acquire() as conn:
            records = await conn.fetch(
                f"""SELECT {_COLUMNS} FROM knowledge_documents
                    ORDER BY updated_at DESC LIMIT $1""",
                limit,
            )
        return [_to_document(r) for r in records]

    async def update(
        self, document_id: str, fields: dict[str, Any]
    ) -> KnowledgeDocument | None:
        # An empty patch must not reorder the list, so it never reaches an
        # UPDATE that would stamp updated_at.
        applicable = {k: v for k, v in fields.items() if k in _UPDATABLE_COLUMNS}
        if not applicable:
            return await self.get(document_id)

        columns = list(applicable)
        assignments = ", ".join(
            f"{column} = ${index + 3}" for index, column in enumerate(columns)
        )
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"""UPDATE knowledge_documents SET {assignments}, updated_at = $2
                    WHERE id = $1 RETURNING {_COLUMNS}""",
                document_id,
                now(),
                *(applicable[column] for column in columns),
            )
        return _to_document(record) if record is not None else None

    async def delete(self, document_id: str) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM knowledge_documents WHERE id = $1", document_id
            )
        return result != "DELETE 0"

    async def search(self, query: str, limit: int) -> list[SearchHit]:
        async with self._pool.acquire() as conn:
            records = await conn.fetch(
                f"SELECT {_COLUMNS} FROM knowledge_documents ORDER BY updated_at DESC"
            )
        documents = [_to_document(r) for r in records]
        scored = [(score(query, d.title, d.body), d) for d in documents]
        matching = [(value, d) for value, d in scored if value > 0]
        matching.sort(key=lambda pair: (pair[0], pair[1].updated_at), reverse=True)
        return [
            SearchHit(
                id=d.id, title=d.title, snippet=snippet(d.body, query), score=value
            )
            for value, d in matching[: max(limit, 0)]
        ]
