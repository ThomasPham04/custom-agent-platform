"""Postgres RunRepository.

Writes runs and run_tool_calls in one transaction; the child rows cascade on
delete. A run whose calls half-inserted would render a trace that never
happened, so the transaction is correctness, not tidiness.

args and result are already capped at LOG_PAYLOAD_MAX_BYTES by execution/service
before they reach here (spec §6).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run, RunToolCall

_RUN_COLUMNS = """id, agent_id, agent_name, model, system_prompt, user_message,
                  answer, status, error, latency_ms, session_id, created_at"""
_CALL_COLUMNS = "id, run_id, seq, tool_id, args, result, error, duration_ms, status"


def _to_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat()


def _row_to_run(record: Any, calls: list[RunToolCall]) -> Run:
    return Run(
        id=record["id"],
        agent_id=record["agent_id"],
        agent_name=record["agent_name"],
        model=record["model"],
        system_prompt=record["system_prompt"],
        user_message=record["user_message"],
        answer=record["answer"],
        status=record["status"],
        error=record["error"],
        latency_ms=record["latency_ms"],
        session_id=record["session_id"],
        created_at=_to_iso(record["created_at"]),
        tool_calls=calls,
    )


def _row_to_call(record: Any) -> RunToolCall:
    return RunToolCall(
        id=record["id"],
        seq=record["seq"],
        tool_id=record["tool_id"],
        args=record["args"],
        result=record["result"],
        error=record["error"],
        duration_ms=record["duration_ms"],
        status=record["status"],
    )


class PostgresRunRepository(RunRepository):
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def append(self, run: Run) -> Run:
        async with self._pool.acquire() as conn, conn.transaction():
            await conn.execute(
                f"""INSERT INTO runs ({_RUN_COLUMNS})
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
                run.id,
                run.agent_id,
                run.agent_name,
                run.model,
                run.system_prompt,
                run.user_message,
                run.answer,
                run.status,
                run.error,
                run.latency_ms,
                run.session_id,
                datetime.fromisoformat(run.created_at),
            )
            for call in run.tool_calls:
                await conn.execute(
                    f"""INSERT INTO run_tool_calls ({_CALL_COLUMNS})
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
                    call.id,
                    run.id,
                    call.seq,
                    call.tool_id,
                    call.args,
                    call.result,
                    call.error,
                    call.duration_ms,
                    call.status,
                )
        return run

    async def get(self, run_id: str) -> Run | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_RUN_COLUMNS} FROM runs WHERE id = $1", run_id
            )
            if row is None:
                return None
            calls = await conn.fetch(
                f"""SELECT {_CALL_COLUMNS} FROM run_tool_calls
                    WHERE run_id = $1 ORDER BY seq""",
                run_id,
            )
        return _row_to_run(row, [_row_to_call(c) for c in calls])

    async def list(self, agent_id: str | None, limit: int) -> list[Run]:
        async with self._pool.acquire() as conn:
            if agent_id is None:
                rows = await conn.fetch(
                    f"""SELECT {_RUN_COLUMNS} FROM runs
                        ORDER BY created_at DESC LIMIT $1""",
                    limit,
                )
            else:
                rows = await conn.fetch(
                    f"""SELECT {_RUN_COLUMNS} FROM runs WHERE agent_id = $1
                        ORDER BY created_at DESC LIMIT $2""",
                    agent_id,
                    limit,
                )
            if not rows:
                return []
            # One query for every child rather than one per run: a trace list of
            # 50 runs would otherwise be 51 round trips.
            calls = await conn.fetch(
                f"""SELECT {_CALL_COLUMNS} FROM run_tool_calls
                    WHERE run_id = ANY($1::text[]) ORDER BY run_id, seq""",
                [row["id"] for row in rows],
            )

        by_run: dict[str, list[RunToolCall]] = {}
        for record in calls:
            by_run.setdefault(record["run_id"], []).append(_row_to_call(record))
        return [_row_to_run(row, by_run.get(row["id"], [])) for row in rows]

    async def delete_by_agent(self, agent_id: str) -> int:
        async with self._pool.acquire() as conn:
            # run_tool_calls rows leave with their parent through that table's
            # ON DELETE CASCADE, so one statement is the whole delete.
            tag = await conn.execute("DELETE FROM runs WHERE agent_id = $1", agent_id)
        # asyncpg returns the command tag, e.g. "DELETE 3".
        return int(tag.split()[-1])

    async def list_by_session(self, session_id: str, limit: int) -> list[Run]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"""SELECT {_RUN_COLUMNS} FROM runs WHERE session_id = $1
                    ORDER BY created_at DESC LIMIT $2""",
                session_id,
                limit,
            )
            if not rows:
                return []
            # One query for every child rather than one per run, exactly as
            # list() does: 50 runs would otherwise be 51 round trips.
            calls = await conn.fetch(
                f"""SELECT {_CALL_COLUMNS} FROM run_tool_calls
                    WHERE run_id = ANY($1::text[]) ORDER BY run_id, seq""",
                [row["id"] for row in rows],
            )

        by_run: dict[str, list[RunToolCall]] = {}
        for record in calls:
            by_run.setdefault(record["run_id"], []).append(_row_to_call(record))
        return [_row_to_run(row, by_run.get(row["id"], [])) for row in rows]

    async def delete_by_session(self, session_id: str) -> int:
        async with self._pool.acquire() as conn:
            # run_tool_calls rows leave with their parent through that table's
            # ON DELETE CASCADE, so one statement is the whole delete.
            tag = await conn.execute(
                "DELETE FROM runs WHERE session_id = $1", session_id
            )
        # asyncpg returns the command tag, e.g. "DELETE 3".
        return int(tag.split()[-1])

    async def assign_session(self, run_ids: list[str], session_id: str) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                "UPDATE runs SET session_id = $2 WHERE id = ANY($1::text[])",
                run_ids,
                session_id,
            )

    async def list_orphans(self, limit: int) -> list[Run]:
        # Oldest first, unlike list(): the backfill drains the table from the
        # front, batch by batch, so a batch it just migrated (and which no
        # longer matches this WHERE) can never occupy the next window.
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"""SELECT {_RUN_COLUMNS} FROM runs WHERE session_id IS NULL
                    ORDER BY created_at ASC LIMIT $1""",
                limit,
            )
            if not rows:
                return []
            calls = await conn.fetch(
                f"""SELECT {_CALL_COLUMNS} FROM run_tool_calls
                    WHERE run_id = ANY($1::text[]) ORDER BY run_id, seq""",
                [row["id"] for row in rows],
            )

        by_run: dict[str, list[RunToolCall]] = {}
        for record in calls:
            by_run.setdefault(record["run_id"], []).append(_row_to_call(record))
        return [_row_to_run(row, by_run.get(row["id"], [])) for row in rows]
