"""Agent Management persistence port.

Async throughout because asyncpg is (spec D8). Implementations live in
repositories/ and are selected in container.py by STORE_BACKEND.
"""

from typing import Protocol

from app.modules.agents.schemas import Agent


class AgentRepository(Protocol):
    async def list(self) -> list[Agent]: ...

    async def get(self, agent_id: str) -> Agent | None: ...

    async def create(self, agent: Agent) -> Agent: ...

    async def update(self, agent: Agent) -> Agent: ...

    async def delete(self, agent_id: str) -> bool: ...
