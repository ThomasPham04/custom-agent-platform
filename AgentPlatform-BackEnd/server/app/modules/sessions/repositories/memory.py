"""In-memory SessionRepository.

Ordering and cloning mirror MemoryRunRepository so the shared contract suite can
hold both implementations to one behaviour.
"""

from app.core.clock import now
from app.modules.sessions.repository import SessionRepository
from app.modules.sessions.schemas import Session


class MemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    async def create(self, session: Session) -> Session:
        self._sessions[session.id] = session.model_copy(deep=True)
        return session.model_copy(deep=True)

    async def get(self, session_id: str) -> Session | None:
        found = self._sessions.get(session_id)
        return found.model_copy(deep=True) if found is not None else None

    async def list(self, limit: int) -> list[Session]:
        # Sorted here rather than in the service because Postgres sorts in SQL
        # and the contract suite keeps the two identical.
        ordered = sorted(
            self._sessions.values(), key=lambda s: s.updated_at, reverse=True
        )
        return [s.model_copy(deep=True) for s in ordered[:limit]]

    async def rename(self, session_id: str, title: str) -> Session | None:
        found = self._sessions.get(session_id)
        if found is None:
            return None
        updated = found.model_copy(update={"title": title, "updated_at": now()})
        self._sessions[session_id] = updated
        return updated.model_copy(deep=True)

    async def touch(self, session_id: str) -> None:
        found = self._sessions.get(session_id)
        if found is not None:
            self._sessions[session_id] = found.model_copy(update={"updated_at": now()})

    async def delete(self, session_id: str) -> bool:
        return self._sessions.pop(session_id, None) is not None

    async def delete_by_agent(self, agent_id: str) -> int:
        # Collected first: deleting from the dict while iterating it raises.
        doomed = [sid for sid, s in self._sessions.items() if s.agent_id == agent_id]
        for session_id in doomed:
            del self._sessions[session_id]
        return len(doomed)
