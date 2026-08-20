"""The trigger clock.

tick() is the entire engine. The loop below is a wrapper, which is what keeps
"run it in this process" a configuration choice rather than an architecture: the
same tick can later be called from a worker entrypoint or an endpoint.
"""

import asyncio
import logging

from app.core.clock import now
from app.modules.execution.service import ExecutionService
from app.modules.triggers.repository import TriggerRepository
from app.modules.triggers.schedule import next_run_at
from app.modules.triggers.schemas import Trigger

logger = logging.getLogger(__name__)


class TriggerScheduler:
    def __init__(
        self,
        triggers: TriggerRepository,
        execution: ExecutionService,
        max_per_tick: int,
    ) -> None:
        self._triggers = triggers
        self._execution = execution
        self._max_per_tick = max_per_tick

    async def tick(self) -> int:
        """Fire everything due. Returns how many actually fired."""
        at = now()
        due = await self._triggers.due(at=at, limit=self._max_per_tick)
        fired = 0
        for trigger in due:
            # The new time is computed from `at`, not from the stale next_run_at.
            # That is the whole of "missed firings are skipped": after downtime a
            # backlog collapses to one firing and resumes from now.
            claimed = await self._triggers.claim(
                trigger.id,
                expected=trigger.next_run_at,
                next_run_at=next_run_at(trigger, at),
            )
            if not claimed:
                # Another process got there first. Not an error.
                continue
            # Sequential and awaited: with one scheduler task this is also what
            # stops a trigger overlapping its own previous firing when a run
            # outlasts its interval.
            await self._fire(trigger)
            fired += 1
        return fired

    async def _fire(self, trigger: Trigger) -> None:
        try:
            run = await self._execution.run_trigger(
                trigger.agent_id, trigger.message, trigger.id, trigger.timezone
            )
        except Exception:
            logger.exception("trigger %s failed to run", trigger.id)
            await self._triggers.record_run(
                trigger.id, last_run_at=now(), last_status="error", last_run_id=None
            )
            return
        await self._triggers.record_run(
            trigger.id,
            last_run_at=now(),
            last_status=run.status,
            last_run_id=run.id,
        )


async def run_scheduler_loop(scheduler: TriggerScheduler, tick_seconds: int) -> None:
    """Call tick forever.

    A background task that dies silently is worse than one that logs and keeps
    going, so everything except cancellation is caught here.
    """
    while True:
        try:
            await scheduler.tick()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("trigger tick failed")
        await asyncio.sleep(tick_seconds)
