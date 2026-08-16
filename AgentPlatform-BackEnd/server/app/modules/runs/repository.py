"""Execution history persistence port."""

from typing import Protocol

from app.modules.runs.schemas import Run


class RunRepository(Protocol):
    async def append(self, run: Run) -> Run: ...

    async def get(self, run_id: str) -> Run | None: ...

    async def list(self, agent_id: str | None, limit: int) -> list[Run]: ...

    async def delete_by_agent(self, agent_id: str) -> int: ...
