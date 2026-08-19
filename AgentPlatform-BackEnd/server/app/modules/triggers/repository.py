"""Trigger persistence port."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.modules.triggers.schemas import Trigger, TriggerLastStatus


class TriggerRepository(Protocol):
    async def create(self, trigger: Trigger) -> Trigger: ...

    async def get(self, trigger_id: str) -> Trigger | None: ...

    async def list(self, agent_id: str | None, limit: int) -> list[Trigger]: ...

    async def update(self, trigger: Trigger) -> Trigger: ...

    async def delete(self, trigger_id: str) -> bool: ...

    async def delete_by_agent(self, agent_id: str) -> int: ...

    async def due(self, at: datetime, limit: int) -> list[Trigger]: ...

    async def claim(
        self,
        trigger_id: str,
        expected: datetime | None,
        next_run_at: datetime | None,
    ) -> bool:
        """Move next_run_at forward only if it still holds `expected`.

        Returns False when another process got there first, which is the whole
        of the concurrency story: a claim that loses simply does not fire.
        """
        ...

    async def record_run(
        self,
        trigger_id: str,
        last_run_at: datetime,
        last_status: TriggerLastStatus,
        last_run_id: str | None,
    ) -> None: ...
