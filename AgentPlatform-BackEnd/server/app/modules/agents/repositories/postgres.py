"""Postgres AgentRepository.

The ordering and clone semantics match repositories/memory.py exactly, and
tests/repositories/test_repository_contract.py runs the same assertions against
both to keep them that way (spec §9).
"""

from datetime import UTC, datetime
from typing import Any

from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent

_COLUMNS = """id, name, icon, description, model, system_prompt,
              tool_ids, status, created_at, updated_at"""


def _to_datetime(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


def _to_iso(value: datetime) -> str:
    """Always +00:00, never a local offset.

    asyncpg returns timestamps in the session's timezone, and the contract's
    strings — including the seeds' fixed ones — are UTC. The list ordering is a
    string comparison, so a mixed format would sort wrongly as well as read
    wrongly.
    """
    return value.astimezone(UTC).isoformat()


def agent_to_row(agent: Agent) -> tuple[Any, ...]:
    return (
        agent.id,
        agent.name,
        agent.icon,
        agent.description,
        agent.model,
        agent.system_prompt,
        agent.tool_ids,
        agent.status,
        _to_datetime(agent.created_at),
        _to_datetime(agent.updated_at),
    )


def row_to_agent(record: Any) -> Agent:
    return Agent(
        id=record["id"],
        name=record["name"],
        icon=record["icon"],
        description=record["description"],
        model=record["model"],
        system_prompt=record["system_prompt"],
        tool_ids=list(record["tool_ids"]),
        status=record["status"],
        created_at=_to_iso(record["created_at"]),
        updated_at=_to_iso(record["updated_at"]),
    )


class PostgresAgentRepository(AgentRepository):
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def list(self) -> list[Agent]:
        # ORDER BY here rather than in the service, for the same reason the
        # memory store sorts in list(): both sides of the port must agree.
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT {_COLUMNS} FROM agents ORDER BY updated_at DESC"
            )
        return [row_to_agent(row) for row in rows]

    async def get(self, agent_id: str) -> Agent | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"SELECT {_COLUMNS} FROM agents WHERE id = $1", agent_id
            )
        return row_to_agent(row) if row is not None else None

    async def create(self, agent: Agent) -> Agent:
        async with self._pool.acquire() as conn:
            await conn.execute(
                f"""INSERT INTO agents ({_COLUMNS})
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                *agent_to_row(agent),
            )
        return agent

    async def update(self, agent: Agent) -> Agent:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """UPDATE agents SET name=$2, icon=$3, description=$4, model=$5,
                       system_prompt=$6, tool_ids=$7, status=$8,
                       created_at=$9, updated_at=$10
                   WHERE id = $1""",
                *agent_to_row(agent),
            )
        return agent

    async def delete(self, agent_id: str) -> bool:
        async with self._pool.acquire() as conn:
            result = await conn.execute("DELETE FROM agents WHERE id = $1", agent_id)
        # asyncpg returns the command tag, e.g. "DELETE 1". The Protocol promises
        # whether anything was removed, which is what turns into the 404.
        return result.rsplit(" ", 1)[-1] != "0"
