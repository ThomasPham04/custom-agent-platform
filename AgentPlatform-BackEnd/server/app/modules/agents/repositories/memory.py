"""In-memory AgentRepository.

Not a mock: it stores and returns real data, so tests exercise real CRUD without
a database. Backs STORE_BACKEND=memory and the fast test path (spec §5.3).
Phase 1 implements the bodies.
"""

from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent


class MemoryAgentRepository(AgentRepository):
    def __init__(self) -> None:
        self._agents: dict[str, Agent] = {}

    async def list(self) -> list[Agent]:
        raise NotImplementedError("Phase 1 implements the memory repository.")

    async def get(self, agent_id: str) -> Agent | None:
        raise NotImplementedError("Phase 1 implements the memory repository.")

    async def create(self, agent: Agent) -> Agent:
        raise NotImplementedError("Phase 1 implements the memory repository.")

    async def update(self, agent: Agent) -> Agent:
        raise NotImplementedError("Phase 1 implements the memory repository.")

    async def delete(self, agent_id: str) -> bool:
        raise NotImplementedError("Phase 1 implements the memory repository.")
