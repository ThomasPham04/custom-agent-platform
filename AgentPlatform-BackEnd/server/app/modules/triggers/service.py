"""Trigger business rules.

Takes the raw parsed body rather than a pydantic model: the validation messages
and their order live in validation.py.

next_run_at is recomputed here rather than in the repository, because it is a
consequence of the rules — a schedule change, a timezone change, or being
enabled — and not a storage concern.
"""

from datetime import datetime
from typing import Any

from app.core.clock import now
from app.core.errors import NotFoundError
from app.core.ids import create_id
from app.modules.agents.repository import AgentRepository
from app.modules.execution.service import ExecutionService
from app.modules.runs.schemas import Run
from app.modules.triggers.repository import TriggerRepository
from app.modules.triggers.schedule import next_run_at
from app.modules.triggers.schemas import TRIGGER_DEFAULTS, Trigger
from app.modules.triggers.validation import normalize_schedule, validate_trigger_write

# A write touching any of these changes when the trigger fires next.
_SCHEDULE_KEYS = frozenset(
    {"kind", "interval_minutes", "time_of_day", "weekdays", "timezone", "enabled"}
)


class TriggerService:
    def __init__(
        self,
        repo: TriggerRepository,
        agents: AgentRepository,
        execution: ExecutionService,
    ) -> None:
        self._repo = repo
        self._agents = agents
        self._execution = execution

    async def list(self, agent_id: str | None = None, limit: int = 50) -> list[Trigger]:
        return await self._repo.list(agent_id=agent_id, limit=limit)

    async def get(self, trigger_id: str) -> Trigger:
        trigger = await self._repo.get(trigger_id)
        if trigger is None:
            raise NotFoundError(f'No trigger with id "{trigger_id}".')
        return trigger

    async def create(self, body: Any) -> Trigger:
        fields = validate_trigger_write(body, current=None)
        await self._require_agent(fields["agent_id"])

        # Both timestamps come from one call, so createdAt and updatedAt are
        # identical rather than microseconds apart.
        timestamp = now()
        merged = normalize_schedule({**TRIGGER_DEFAULTS, **fields}, fields["kind"])
        trigger = Trigger(
            id=create_id("trg"),
            created_at=timestamp,
            updated_at=timestamp,
            **merged,
        )
        return await self._repo.create(self._scheduled(trigger, timestamp))

    async def update(self, trigger_id: str, body: Any) -> Trigger:
        # Check existence before validating the body: a patch to a deleted
        # trigger reports 404 rather than a validation error.
        current = await self.get(trigger_id)
        fields = validate_trigger_write(body, current=current)
        if "agent_id" in fields:
            await self._require_agent(fields["agent_id"])

        timestamp = now()
        kind = fields.get("kind", current.kind)
        merged = normalize_schedule(fields, kind)
        updated = current.model_copy(update={**merged, "updated_at": timestamp})
        # Tested against `fields`, the keys the client actually sent, NOT against
        # `merged`: normalize_schedule always adds the other kind's keys, so
        # testing merged would recompute on every patch — and for an interval
        # trigger that pushes the next firing out by a full interval every time
        # somebody renames it.
        if _SCHEDULE_KEYS & set(fields):
            updated = self._scheduled(updated, timestamp)
        return await self._repo.update(updated)

    async def delete(self, trigger_id: str) -> None:
        if not await self._repo.delete(trigger_id):
            raise NotFoundError(f'No trigger with id "{trigger_id}".')
        # Runs stay. The activity log is an audit trail and outlives the trigger,
        # the same way runs outlive a deleted agent.

    async def run_now(self, trigger_id: str) -> Run:
        """Fire once, out of band.

        Works whether or not the trigger is enabled, and whether or not the
        scheduler is running: firing before a schedule is turned loose is the
        main reason this exists. Deliberately does not reschedule.
        """
        trigger = await self.get(trigger_id)
        run = await self._execution.run_trigger(
            trigger.agent_id, trigger.message, trigger.id, trigger.timezone
        )
        await self._repo.record_run(
            trigger.id,
            last_run_at=now(),
            last_status=run.status,
            last_run_id=run.id,
        )
        return run

    def _scheduled(self, trigger: Trigger, at: datetime) -> Trigger:
        """next_run_at is null while disabled, which keeps it out of the due index."""
        upcoming = next_run_at(trigger, at) if trigger.enabled else None
        return trigger.model_copy(update={"next_run_at": upcoming})

    async def _require_agent(self, agent_id: str) -> None:
        if await self._agents.get(agent_id) is None:
            raise NotFoundError(f'No agent with id "{agent_id}".')
