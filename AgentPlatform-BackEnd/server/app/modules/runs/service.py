"""Read path for execution history.

execution/ writes runs; this module reads them. Separate lifecycles, separate
modules.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from app.core.errors import NotFoundError
from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run


class RunService:
    def __init__(self, repo: RunRepository) -> None:
        self._repo = repo

    async def list(self, agent_id: str | None = None, limit: int = 50) -> list[Run]:
        return await self._repo.list(agent_id=agent_id, limit=limit)

    def export_by_agent(self, agent_id: str) -> AsyncGenerator[Run, None]:
        return self._repo.iter_all_by_agent(agent_id)

    async def get(self, run_id: str) -> Run:
        run = await self._repo.get(run_id)
        if run is None:
            raise NotFoundError(f'No run with id "{run_id}".')
        return run

    async def delete_by_agent(self, agent_id: str) -> int:
        return await self._repo.delete_by_agent(agent_id)

    async def list_by_session(self, session_id: str, limit: int = 50) -> list[Run]:
        return await self._repo.list_by_session(session_id=session_id, limit=limit)

    async def delete_by_session(self, session_id: str) -> int:
        return await self._repo.delete_by_session(session_id)

    async def list_by_trigger(self, trigger_id: str, limit: int = 50) -> list[Run]:
        return await self._repo.list_by_trigger(trigger_id=trigger_id, limit=limit)
