"""Postgres RunRepository.

Writes runs and run_tool_calls in one transaction; the child rows cascade on
delete. args and result are capped at LOG_PAYLOAD_MAX_BYTES with an explicit
truncated marker, applied in the service layer (spec §6). Phase 2 implements.
"""

from typing import Any

from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run


class PostgresRunRepository(RunRepository):
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def append(self, run: Run) -> Run:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")

    async def get(self, run_id: str) -> Run | None:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")

    async def list(self, agent_id: str | None, limit: int) -> list[Run]:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")
