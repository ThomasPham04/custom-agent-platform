"""In-memory TriggerRepository.

Ordering and cloning mirror MemorySessionRepository, so the two stores stay
interchangeable behind the Protocol.
"""

from __future__ import annotations

from datetime import datetime

from app.modules.triggers.repository import TriggerRepository
from app.modules.triggers.schemas import Trigger, TriggerLastStatus


class MemoryTriggerRepository(TriggerRepository):
    def __init__(self) -> None:
        self._triggers: dict[str, Trigger] = {}

    async def create(self, trigger: Trigger) -> Trigger:
        self._triggers[trigger.id] = trigger.model_copy(deep=True)
        return trigger.model_copy(deep=True)

    async def get(self, trigger_id: str) -> Trigger | None:
        found = self._triggers.get(trigger_id)
        return found.model_copy(deep=True) if found is not None else None

    async def list(self, agent_id: str | None, limit: int) -> list[Trigger]:
        # Sorted here rather than in the service because Postgres sorts in SQL
        # and the two implementations must agree.
        matching = [
            t
            for t in self._triggers.values()
            if agent_id is None or t.agent_id == agent_id
        ]
        ordered = sorted(matching, key=lambda t: t.updated_at, reverse=True)
        return [t.model_copy(deep=True) for t in ordered[:limit]]

    async def update(self, trigger: Trigger) -> Trigger:
        self._triggers[trigger.id] = trigger.model_copy(deep=True)
        return trigger.model_copy(deep=True)

    async def delete(self, trigger_id: str) -> bool:
        return self._triggers.pop(trigger_id, None) is not None

    async def delete_by_agent(self, agent_id: str) -> int:
        # Collected first: deleting from the dict while iterating it raises.
        doomed = [tid for tid, t in self._triggers.items() if t.agent_id == agent_id]
        for trigger_id in doomed:
            del self._triggers[trigger_id]
        return len(doomed)

    async def due(self, at: datetime, limit: int) -> list[Trigger]:
        ready = [
            t
            for t in self._triggers.values()
            if t.enabled and t.next_run_at is not None and t.next_run_at <= at
        ]
        ordered = sorted(ready, key=lambda t: t.next_run_at or at)
        return [t.model_copy(deep=True) for t in ordered[:limit]]

    async def claim(
        self,
        trigger_id: str,
        expected: datetime | None,
        next_run_at: datetime | None,
    ) -> bool:
        found = self._triggers.get(trigger_id)
        if found is None or found.next_run_at != expected:
            return False
        self._triggers[trigger_id] = found.model_copy(
            update={"next_run_at": next_run_at}
        )
        return True

    async def record_run(
        self,
        trigger_id: str,
        last_run_at: datetime,
        last_status: TriggerLastStatus,
        last_run_id: str | None,
    ) -> None:
        found = self._triggers.get(trigger_id)
        if found is None:
            return
        self._triggers[trigger_id] = found.model_copy(
            update={
                "last_run_at": last_run_at,
                "last_status": last_status,
                "last_run_id": last_run_id,
            }
        )
