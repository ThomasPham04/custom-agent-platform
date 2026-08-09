"""Agent Execution — the orchestrator.

This is the composition point for the other three components, and the only module
that depends on all of them. It is deliberately NOT behind an interface: making
the orchestrator swappable would be abstraction with nothing on the other side.

Flow (spec §7):
  1. agent_repo.get(agent_id)            -> NotFoundError if missing
  2. tools.resolve(agent.tool_ids)
  3. build RunSpec
  4. llm.run(spec)                       -> AsyncIterator[RunEvent]
  5. event_translator.translate(...)     -> (MessageResponse, Run)
  6. runs.append(run)
  7. return the message
"""

from app.modules.agents.repository import AgentRepository
from app.modules.execution.schemas import MessageRequest, MessageResponse
from app.modules.llm.provider import LLMProvider
from app.modules.runs.repository import RunRepository
from app.modules.tools.registry import ToolRegistry


class ExecutionService:
    def __init__(
        self,
        agents: AgentRepository,
        tools: ToolRegistry,
        llm: LLMProvider,
        runs: RunRepository,
    ) -> None:
        self._agents = agents
        self._tools = tools
        self._llm = llm
        self._runs = runs

    async def send_message(self, agent_id: str, payload: MessageRequest) -> MessageResponse:
        raise NotImplementedError("Phase 3 implements agent execution.")
