"""Read path for execution history.

execution/ writes runs; this module reads them. Separate lifecycles, separate
modules (spec D4).
"""

from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run


class RunService:
    def __init__(self, repo: RunRepository) -> None:
        self._repo = repo

    async def list(self, agent_id: str | None = None, limit: int = 50) -> list[Run]:
        raise NotImplementedError("Phase 3 implements run history.")

    async def get(self, run_id: str) -> Run:
        raise NotImplementedError("Phase 3 implements run history.")
