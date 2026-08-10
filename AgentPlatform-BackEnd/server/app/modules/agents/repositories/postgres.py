"""Postgres AgentRepository — the default at deployment.

Cloud SQL is managed Postgres, so this same file serves local compose and GCP;
only DATABASE_URL differs (spec §11). Phase 2 implements the bodies.
"""

from typing import Any

from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent


class PostgresAgentRepository(AgentRepository):
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def list(self) -> list[Agent]:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")

    async def get(self, agent_id: str) -> Agent | None:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")

    async def create(self, agent: Agent) -> Agent:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")

    async def update(self, agent: Agent) -> Agent:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")

    async def delete(self, agent_id: str) -> bool:
        raise NotImplementedError("Phase 2 implements the Postgres repository.")
