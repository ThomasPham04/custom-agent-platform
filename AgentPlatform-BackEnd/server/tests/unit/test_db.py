"""These tests need a database. They skip cleanly without one, which is what
keeps `uv run pytest` fast and infrastructure-free (spec §9).

They read TEST_DATABASE_URL, *not* DATABASE_URL. The fixture below drops all
three tables, and DATABASE_URL is the variable that points at a running
service — it is set in deploy/env/backend.env and is often exported in a shell.
Reusing it would mean `uv run pytest` silently destroys the agents and run
history of whatever database happens to be configured. Pointing at a throwaway
database has to be a deliberate act.
"""

import os

import pytest

from app.core import db
from app.modules.agents.seeds import SEED_AGENTS

DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="TEST_DATABASE_URL is not set"
)


@pytest.fixture
async def pool():
    created = await db.create_pool(DATABASE_URL)
    async with created.acquire() as conn:
        await conn.execute("DROP TABLE IF EXISTS run_tool_calls, runs, agents CASCADE")
    await db.apply_schema(created)
    yield created
    await db.close_pool()


async def test_apply_schema_creates_the_three_tables(pool):
    async with pool.acquire() as conn:
        names = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
    assert {"agents", "runs", "run_tool_calls"} <= {r["tablename"] for r in names}


async def test_apply_schema_is_idempotent(pool):
    """It runs on every boot, including against a populated database."""
    await db.apply_schema(pool)
    await db.apply_schema(pool)


async def test_jsonb_round_trips_as_python_rather_than_text(pool):
    """asyncpg hands back JSONB as a string unless a codec is registered, which
    would make tool_ids arrive as '["a"]' instead of ['a']."""
    async with pool.acquire() as conn:
        value = await conn.fetchval("""SELECT '["a", "b"]'::jsonb""")
    assert value == ["a", "b"]


async def test_seed_agents_inserts_the_four_when_empty(pool):
    assert await db.seed_agents(pool, SEED_AGENTS) == 4
    async with pool.acquire() as conn:
        assert await conn.fetchval("SELECT count(*) FROM agents") == 4


async def test_seed_agents_does_nothing_when_the_table_has_rows(pool):
    """Spec §6: seeded on first boot only, when the table is empty. A restart
    must not resurrect an agent the user deleted."""
    await db.seed_agents(pool, SEED_AGENTS)
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM agents WHERE id = 'agent_support'")

    assert await db.seed_agents(pool, SEED_AGENTS) == 0
    async with pool.acquire() as conn:
        assert await conn.fetchval("SELECT count(*) FROM agents") == 3


async def test_get_pool_returns_none_after_close(pool):
    await db.close_pool()
    assert db.get_pool() is None
