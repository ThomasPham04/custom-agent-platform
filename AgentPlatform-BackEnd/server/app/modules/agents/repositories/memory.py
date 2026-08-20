"""In-memory AgentRepository.

Not a mock: it stores and returns real data, so tests exercise real CRUD without
a database. Backs STORE_BACKEND=memory and the fast test path.
"""

from collections.abc import Sequence

from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent


class MemoryAgentRepository(AgentRepository):
    def __init__(self, seed: Sequence[Agent] = ()) -> None:
        # Cloned on the way in as well as out: a caller holding the seed list
        # must not be able to reach into the store through it.
        self._agents: dict[str, Agent] = {a.id: a.model_copy(deep=True) for a in seed}

    async def list(self) -> list[Agent]:
        # Sorted here rather than in the service because Phase 2's Postgres
        # implementation sorts in SQL, and the repository contract suite exists
        # to keep the two identical. String comparison matches Express's
        # localeCompare over ISO timestamps (contract reference §4).
        ordered = sorted(self._agents.values(), key=lambda a: a.updated_at, reverse=True)
        return [a.model_copy(deep=True) for a in ordered]

    async def get(self, agent_id: str) -> Agent | None:
        agent = self._agents.get(agent_id)
        return agent.model_copy(deep=True) if agent is not None else None

    async def create(self, agent: Agent) -> Agent:
        self._agents[agent.id] = agent.model_copy(deep=True)
        return agent.model_copy(deep=True)

    async def update(self, agent: Agent) -> Agent:
        self._agents[agent.id] = agent.model_copy(deep=True)
        return agent.model_copy(deep=True)

    async def delete(self, agent_id: str) -> bool:
        return self._agents.pop(agent_id, None) is not None
