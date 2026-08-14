"""asyncpg pool lifecycle.

The pool is opened on startup, the schema applied, and the pool handed to the
Postgres repositories through container.py. Module-level state rather than an
injected object because the composition root's providers are synchronous and the
lifespan runs before the first request reaches one.
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import asyncpg

from app.modules.agents.schemas import Agent

_pool: asyncpg.Pool | None = None

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Hand back JSONB as Python objects.

    Without this asyncpg returns the raw text, so tool_ids would arrive as the
    string '["current_time"]' and every caller would have to remember to parse
    it. Registering it once here is the only place that decision belongs.
    """
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def create_pool(database_url: str) -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(database_url, init=_init_connection)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool | None:
    return _pool


async def apply_schema(pool: asyncpg.Pool) -> None:
    """Every statement is IF NOT EXISTS, so this is safe on every boot."""
    async with pool.acquire() as conn:
        await conn.execute(_SCHEMA_PATH.read_text(encoding="utf-8"))


_INSERT_AGENT = """
INSERT INTO agents (id, name, icon, description, model, system_prompt,
                    tool_ids, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
"""


async def seed_agents(pool: asyncpg.Pool, agents: Sequence[Agent]) -> int:
    """Insert the sample agents, but only into an empty table (spec §6).

    Guarded so a restart never resurrects an agent the user deleted. Returns the
    number of rows inserted so a caller can log it.
    """
    async with pool.acquire() as conn, conn.transaction():
        existing = await conn.fetchval("SELECT count(*) FROM agents")
        if existing:
            return 0
        for agent in agents:
            await conn.execute(_INSERT_AGENT, *_agent_row(agent))
        return len(agents)


def _agent_row(agent: Agent) -> tuple[Any, ...]:
    # Imported here rather than at module scope: postgres.py owns the row
    # mapping, and core/ must not depend on a module's repository.
    from app.modules.agents.repositories.postgres import agent_to_row

    return agent_to_row(agent)
