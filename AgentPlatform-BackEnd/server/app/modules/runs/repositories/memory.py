"""In-memory RunRepository.

A Run carries its tool calls as a list, so there is no second dict — the Postgres
implementation normalizes them into a child table instead (spec §5.3, §6).
Ordering and cloning match the agent store; Task 11 mirrors both in SQL.
"""

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
