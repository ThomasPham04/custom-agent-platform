"""Agent Management business rules.

Note what this constructor takes: a ToolRegistry and a set of model ids, injected
from container.py. This module must never import the tool catalog or the model
catalog directly — that coupling is exactly what today's agentStore.js has and
what the modular design removes (spec §4.2).

`create` and `update` take the raw parsed JSON body rather than a pydantic model.
The contract's validation messages and their evaluation order cannot be produced
by pydantic's field constraints, so validation.py owns them instead.
"""

from typing import Any

from app.core.clock import now_iso
from app.core.errors import NotFoundError
from app.core.ids import create_id
from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent
from app.modules.agents.seeds import AGENT_DEFAULTS
from app.modules.agents.validation import validate_agent_write
from app.modules.sessions.repository import SessionRepository
from app.modules.tools.registry import ToolRegistry
from app.modules.triggers.repository import TriggerRepository


class AgentService:
    def __init__(
        self,
        repo: AgentRepository,
        tools: ToolRegistry,
        model_ids: set[str],
        default_model: str,
        sessions: SessionRepository,
        triggers: TriggerRepository,
    ) -> None:
        self._repo = repo
        self._tools = tools
        self._model_ids = model_ids
        self._default_model = default_model
        self._sessions = sessions
        self._triggers = triggers

    async def list(self) -> list[Agent]:
        return await self._repo.list()

    async def get(self, agent_id: str) -> Agent:
        agent = await self._repo.get(agent_id)
        if agent is None:
            raise NotFoundError(f'No agent with id "{agent_id}".')
        return agent

    async def create(self, body: Any) -> Agent:
        patch = self._validate(body)
        # Both timestamps come from one call, so a created agent's createdAt and
        # updatedAt are identical rather than microseconds apart (contract §2).
        timestamp = now_iso()
        # AGENT_DEFAULTS deliberately omits `model`; the default arrives from
        # container.py so agents/ never imports the model catalog.
        fields = {**AGENT_DEFAULTS, "model": self._default_model, **patch}
        agent = Agent(
            id=create_id("agent"),
            created_at=timestamp,
            updated_at=timestamp,
            **fields,
        )
        return await self._repo.create(agent)

    async def update(self, agent_id: str, body: Any) -> Agent:
        # Existence is checked before the body, so a patch to a deleted agent
        # reports 404 rather than a validation error. The contract reference is
        # silent here; this is the recorded choice (spec §9).
        current = await self.get(agent_id)
        patch = self._validate(body)
        # updatedAt moves even when the patch is empty (contract §4).
        updated = current.model_copy(update={**patch, "updated_at": now_iso()})
        return await self._repo.update(updated)

    async def delete(self, agent_id: str) -> None:
        if not await self._repo.delete(agent_id):
            raise NotFoundError(f'No agent with id "{agent_id}".')
        # Sessions are navigation: a chat with a deleted agent cannot be
        # continued. Runs stay — the audit trail outlives the agent.
        await self._sessions.delete_by_agent(agent_id)
        # Triggers go for a stronger reason than navigation: one pointing at a
        # deleted agent can never fire, so leaving it would put a permanently
        # broken row in the list.
        await self._triggers.delete_by_agent(agent_id)

    def _validate(self, body: Any) -> dict[str, Any]:
        return validate_agent_write(
            body,
            model_ids=self._model_ids,
            known_tool_ids=self._tools.known_ids(),
        )
