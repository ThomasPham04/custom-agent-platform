"""In-memory RunRepository.

A Run carries its tool calls as a list, so there is no second dict — the Postgres
implementation normalizes them into a child table instead.
Ordering and cloning match the agent store; Task 11 mirrors both in SQL.
"""

from __future__ import annotations

from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run


class MemoryRunRepository(RunRepository):
    def __init__(self) -> None:
        self._runs: dict[str, Run] = {}

    async def append(self, run: Run) -> Run:
        self._runs[run.id] = run.model_copy(deep=True)
        return run.model_copy(deep=True)

    async def get(self, run_id: str) -> Run | None:
        run = self._runs.get(run_id)
        return run.model_copy(deep=True) if run is not None else None

    async def list(self, agent_id: str | None, limit: int) -> list[Run]:
        # Sorted here rather than in the service because Task 11 sorts in SQL and
        # the repository contract suite keeps the two identical.
        matching = [
            r for r in self._runs.values() if agent_id is None or r.agent_id == agent_id
        ]
        ordered = sorted(matching, key=lambda r: r.created_at, reverse=True)
        return [r.model_copy(deep=True) for r in ordered[:limit]]

    async def delete_by_agent(self, agent_id: str) -> int:
        # Collected first: deleting from the dict while iterating it raises.
        doomed = [rid for rid, run in self._runs.items() if run.agent_id == agent_id]
        for run_id in doomed:
            del self._runs[run_id]
        return len(doomed)

    async def list_by_session(self, session_id: str, limit: int) -> list[Run]:
        matching = [r for r in self._runs.values() if r.session_id == session_id]
        ordered = sorted(matching, key=lambda r: r.created_at, reverse=True)
        return [r.model_copy(deep=True) for r in ordered[:limit]]

    async def delete_by_session(self, session_id: str) -> int:
        doomed = [rid for rid, r in self._runs.items() if r.session_id == session_id]
        for run_id in doomed:
            del self._runs[run_id]
        return len(doomed)

    async def list_by_trigger(self, trigger_id: str, limit: int) -> list[Run]:
        matching = [r for r in self._runs.values() if r.trigger_id == trigger_id]
        ordered = sorted(matching, key=lambda r: r.created_at, reverse=True)
        return [r.model_copy(deep=True) for r in ordered[:limit]]

    async def assign_session(self, run_ids: list[str], session_id: str) -> None:
        for run_id in run_ids:
            run = self._runs.get(run_id)
            if run is not None:
                self._runs[run_id] = run.model_copy(update={"session_id": session_id})

    async def list_orphans(self, limit: int) -> list[Run]:
        # Oldest first, unlike list(): the backfill drains the table from the
        # front so a batch it just migrated can never occupy the next window.
        orphans = [r for r in self._runs.values() if r.session_id is None]
        ordered = sorted(orphans, key=lambda r: r.created_at)
        return [r.model_copy(deep=True) for r in ordered[:limit]]
