"""asyncpg pool lifecycle.

Phase 2 opens the pool on startup, applies schema.sql, and hands the pool to the
Postgres repositories through container.py.
"""

from typing import Any

_pool: Any = None


async def create_pool(database_url: str) -> Any:
    raise NotImplementedError("Phase 2 opens the asyncpg pool.")


async def close_pool() -> None:
    raise NotImplementedError("Phase 2 closes the asyncpg pool.")


def get_pool() -> Any:
    return _pool
