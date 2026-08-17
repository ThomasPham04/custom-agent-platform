"""asyncpg SessionRepository.

Held to the same contract as the memory store by
tests/repositories/test_repository_contract.py.
"""

import asyncpg

from app.core.clock import now
from app.modules.sessions.repository import SessionRepository
from app.modules.sessions.schemas import Session

_COLUMNS = "id, agent_id, title, created_at, updated_at"


def _to_session(record: asyncpg.Record) -> Session:
    return Session(
        id=record["id"],
        agent_id=record["agent_id"],
        title=record["title"],
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


class PostgresSessionRepository(SessionRepository):
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def create(self, session: Session) -> Session:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"""INSERT INTO chat_sessions ({_COLUMNS})
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING {_COLUMNS}""",
                session.id,
                session.agent_id,
                session.title,
                session.created_at,
                session.updated_at,
            )
        return _to_session(record)

    async def get(self, session_id: str) -> Session | None:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"SELECT {_COLUMNS} FROM chat_sessions WHERE id = $1", session_id
            )
        return _to_session(record) if record is not None else None

    async def list(self, limit: int) -> list[Session]:
        async with self._pool.acquire() as conn:
            records = await conn.fetch(
                f"""SELECT {_COLUMNS} FROM chat_sessions
                    ORDER BY updated_at DESC LIMIT $1""",
                limit,
            )
        return [_to_session(r) for r in records]

    async def rename(self, session_id: str, title: str) -> Session | None:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"""UPDATE chat_sessions SET title = $2, updated_at = $3
                    WHERE id = $1 RETURNING {_COLUMNS}""",
                session_id,
                title,
                now(),
            )
        return _to_session(record) if record is not None else None

    async def touch(self, session_id: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "UPDATE chat_sessions SET updated_at = $2 WHERE id = $1",
                session_id,
                now(),
            )

    async def delete(self, session_id: str) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM chat_sessions WHERE id = $1", session_id
            )
        return result != "DELETE 0"

    async def delete_by_agent(self, agent_id: str) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM chat_sessions WHERE agent_id = $1", agent_id
            )
        return int(result.split()[-1])
