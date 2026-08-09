"""Agent Management business rules.

Note what this constructor takes: a ToolRegistry and a set of model ids, injected
from container.py. This module must never import the tool catalog or the model
catalog directly — that coupling is exactly what today's agentStore.js has and
what the modular design removes (spec §4.2).
"""

from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent, AgentCreate, AgentPatch
from app.modules.tools.registry import ToolRegistry


class AgentService:
    def __init__(
        self,
        repo: AgentRepository,
        tools: ToolRegistry,
        model_ids: set[str],
        default_model: str,
    ) -> None:
        self._repo = repo
        self._tools = tools
        self._model_ids = model_ids
        self._default_model = default_model

    async def list(self) -> list[Agent]:
        raise NotImplementedError("Phase 1 implements agent management.")

    async def get(self, agent_id: str) -> Agent:
        raise NotImplementedError("Phase 1 implements agent management.")

    async def create(self, payload: AgentCreate) -> Agent:
        raise NotImplementedError("Phase 1 implements agent management.")

    async def update(self, agent_id: str, payload: AgentPatch) -> Agent:
        raise NotImplementedError("Phase 1 implements agent management.")

    async def delete(self, agent_id: str) -> None:
        raise NotImplementedError("Phase 1 implements agent management.")
