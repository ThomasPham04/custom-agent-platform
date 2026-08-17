"""Read and write path for chat sessions.

execution/ creates sessions; this module lists, renames and deletes them.
Deleting a session deletes its runs: the conversation and its turns are one
thing to a user, and an orphaned run is unreachable from the UI.
"""

from app.core.errors import NotFoundError
from app.modules.runs.repository import RunRepository
from app.modules.sessions.repository import SessionRepository
from app.modules.sessions.schemas import Session


class SessionService:
    def __init__(self, sessions: SessionRepository, runs: RunRepository) -> None:
        self._sessions = sessions
        self._runs = runs

    async def list(self, limit: int = 50) -> list[Session]:
        return await self._sessions.list(limit=limit)

    async def rename(self, session_id: str, title: str) -> Session:
        renamed = await self._sessions.rename(session_id, title)
        if renamed is None:
            raise NotFoundError(f'No session with id "{session_id}".')
        return renamed

    async def delete(self, session_id: str) -> None:
        removed = await self._sessions.delete(session_id)
        if not removed:
            raise NotFoundError(f'No session with id "{session_id}".')
        await self._runs.delete_by_session(session_id)
