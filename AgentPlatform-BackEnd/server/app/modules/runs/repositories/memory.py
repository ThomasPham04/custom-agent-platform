"""In-memory RunRepository.

A Run carries its tool calls as a list, so there is no second dict — the Postgres
implementation normalizes them into a child table instead (spec §5.3, §6).
Phase 1 implements the bodies.
"""

from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run


class MemoryRunRepository(RunRepository):
    def __init__(self) -> None:
        self._runs: dict[str, Run] = {}

    async def append(self, run: Run) -> Run:
        raise NotImplementedError("Phase 1 implements the memory repository.")

    async def get(self, run_id: str) -> Run | None:
        raise NotImplementedError("Phase 1 implements the memory repository.")

    async def list(self, agent_id: str | None, limit: int) -> list[Run]:
        raise NotImplementedError("Phase 1 implements the memory repository.")
