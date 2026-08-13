"""One set of assertions, two implementations.

The memory store is the fast path and the Postgres store is what ships; a
behaviour that holds in one and not the other is a bug that reaches production
looking like a frontend problem (spec §9).
"""

import os

import pytest

from app.core import db
from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.repositories.postgres import PostgresAgentRepository
from app.modules.runs.repositories.memory import MemoryRunRepository
from app.modules.runs.repositories.postgres import PostgresRunRepository

# TEST_DATABASE_URL, not DATABASE_URL: the fixture below TRUNCATEs every table,
# and DATABASE_URL points at a running service. See tests/unit/test_db.py.
DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

BACKENDS = ["memory", "postgres"]


@pytest.fixture(params=BACKENDS)
async def backend(request):
    """Yields a clean store of the requested kind, or skips."""
    if request.param == "memory":
        yield "memory", None
        return

    if not DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set; Postgres half skipped")

    pool = await db.create_pool(DATABASE_URL)
    await db.apply_schema(pool)
    async with pool.acquire() as conn:
        # TRUNCATE rather than DROP: the schema is applied once and every test
        # starts from empty tables, which is what the memory store does for free.
        await conn.execute("TRUNCATE run_tool_calls, runs, agents CASCADE")
    yield "postgres", pool
    await db.close_pool()


@pytest.fixture
def agent_repo(backend):
    kind, pool = backend
    if kind == "memory":
        return MemoryAgentRepository()
    return PostgresAgentRepository(pool)


@pytest.fixture
def run_repo(backend):
    kind, pool = backend
    if kind == "memory":
        return MemoryRunRepository()
    return PostgresRunRepository(pool)
