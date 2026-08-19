"""asyncpg TriggerRepository.

weekdays is a JSONB column, so asyncpg hands back a string and takes a string.
json.dumps and json.loads sit at that boundary and nowhere else.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import asyncpg

from app.modules.triggers.repository import TriggerRepository
from app.modules.triggers.schemas import Trigger, TriggerLastStatus

_COLUMNS = """id, agent_id, name, message, kind, interval_minutes, time_of_day,
              weekdays, timezone, enabled, next_run_at, last_run_at, last_status,
              last_run_id, created_at, updated_at"""


def _weekdays(value: Any) -> list[int]:
    if value is None:
        return []
    if isinstance(value, str):
        return list(json.loads(value))
    return list(value)


def _to_trigger(record: asyncpg.Record) -> Trigger:
    return Trigger(
        id=record["id"],
        agent_id=record["agent_id"],
        name=record["name"],
        message=record["message"],
        kind=record["kind"],
        interval_minutes=record["interval_minutes"],
        time_of_day=record["time_of_day"],
        weekdays=_weekdays(record["weekdays"]),
        timezone=record["timezone"],
        enabled=record["enabled"],
        next_run_at=record["next_run_at"],
        last_run_at=record["last_run_at"],
        last_status=record["last_status"],
        last_run_id=record["last_run_id"],
        created_at=record["created_at"],
        updated_at=record["updated_at"],
    )


def _values(trigger: Trigger) -> list[Any]:
    return [
        trigger.id,
        trigger.agent_id,
        trigger.name,
        trigger.message,
        trigger.kind,
        trigger.interval_minutes,
        trigger.time_of_day,
        json.dumps(trigger.weekdays),
        trigger.timezone,
        trigger.enabled,
        trigger.next_run_at,
        trigger.last_run_at,
        trigger.last_status,
        trigger.last_run_id,
        trigger.created_at,
        trigger.updated_at,
    ]


class PostgresTriggerRepository(TriggerRepository):
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def create(self, trigger: Trigger) -> Trigger:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"""INSERT INTO triggers ({_COLUMNS})
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                    RETURNING {_COLUMNS}""",
                *_values(trigger),
            )
        return _to_trigger(record)

    async def get(self, trigger_id: str) -> Trigger | None:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"SELECT {_COLUMNS} FROM triggers WHERE id = $1", trigger_id
            )
        return _to_trigger(record) if record is not None else None

    async def list(self, agent_id: str | None, limit: int) -> list[Trigger]:
        async with self._pool.acquire() as conn:
            if agent_id is None:
                records = await conn.fetch(
                    f"""SELECT {_COLUMNS} FROM triggers
                        ORDER BY updated_at DESC LIMIT $1""",
                    limit,
                )
            else:
                records = await conn.fetch(
                    f"""SELECT {_COLUMNS} FROM triggers WHERE agent_id = $1
                        ORDER BY updated_at DESC LIMIT $2""",
                    agent_id,
                    limit,
                )
        return [_to_trigger(r) for r in records]

    async def update(self, trigger: Trigger) -> Trigger:
        async with self._pool.acquire() as conn:
            record = await conn.fetchrow(
                f"""UPDATE triggers SET
                        agent_id = $2, name = $3, message = $4, kind = $5,
                        interval_minutes = $6, time_of_day = $7, weekdays = $8,
                        timezone = $9, enabled = $10, next_run_at = $11,
                        last_run_at = $12, last_status = $13, last_run_id = $14,
                        created_at = $15, updated_at = $16
                    WHERE id = $1 RETURNING {_COLUMNS}""",
                *_values(trigger),
            )
        return _to_trigger(record)

    async def delete(self, trigger_id: str) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute("DELETE FROM triggers WHERE id = $1", trigger_id)
        return result != "DELETE 0"

    async def delete_by_agent(self, agent_id: str) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM triggers WHERE agent_id = $1", agent_id
            )
        return int(result.split()[-1])

    async def due(self, at: datetime, limit: int) -> list[Trigger]:
        async with self._pool.acquire() as conn:
            records = await conn.fetch(
                f"""SELECT {_COLUMNS} FROM triggers
                    WHERE enabled AND next_run_at IS NOT NULL AND next_run_at <= $1
                    ORDER BY next_run_at LIMIT $2""",
                at,
                limit,
            )
        return [_to_trigger(r) for r in records]

    async def claim(
        self,
        trigger_id: str,
        expected: datetime | None,
        next_run_at: datetime | None,
    ) -> bool:
        # Compare-and-set. IS NOT DISTINCT FROM rather than `=` so a NULL
        # expectation compares as a value instead of yielding NULL.
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                """UPDATE triggers SET next_run_at = $3
                   WHERE id = $1 AND next_run_at IS NOT DISTINCT FROM $2""",
                trigger_id,
                expected,
                next_run_at,
            )
        return result != "UPDATE 0"

    async def record_run(
        self,
        trigger_id: str,
        last_run_at: datetime,
        last_status: TriggerLastStatus,
        last_run_id: str | None,
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """UPDATE triggers
                   SET last_run_at = $2, last_status = $3, last_run_id = $4
                   WHERE id = $1""",
                trigger_id,
                last_run_at,
                last_status,
                last_run_id,
            )
