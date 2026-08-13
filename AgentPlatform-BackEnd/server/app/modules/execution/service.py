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

import json
from typing import Any

from app.core.errors import NotFoundError
from app.modules.agents.repository import AgentRepository
from app.modules.execution.event_translator import translate
from app.modules.execution.schemas import MessageRequest, MessageResponse
from app.modules.llm.provider import LLMProvider, RunSpec
from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run
from app.modules.tools.registry import ToolRegistry


class ExecutionService:
    def __init__(
        self,
        agents: AgentRepository,
        tools: ToolRegistry,
        llm: LLMProvider,
        runs: RunRepository,
        log_payload_max_bytes: int,
    ) -> None:
        self._agents = agents
        self._tools = tools
        self._llm = llm
        self._runs = runs
        self._log_payload_max_bytes = log_payload_max_bytes

    async def send_message(
        self, agent_id: str, payload: MessageRequest
    ) -> MessageResponse:
        agent = await self._agents.get(agent_id)
        if agent is None:
            raise NotFoundError(f'No agent with id "{agent_id}".')

        spec = RunSpec(
            agent_id=agent.id,
            name=agent.name,
            model=agent.model,
            system_prompt=agent.system_prompt,
            tools=self._tools.resolve(agent.tool_ids),
            user_message=payload.content,
            retry=payload.retry,
        )

        message, run = await translate(self._llm.run(spec), spec)
        # Truncation applies to the stored row only. The response bytes are fixed
        # by the contract, and the frontend renders the payload the trace shows
        # (spec §6, decision 7).
        await self._runs.append(self._capped(run))
        return message

    def _capped(self, run: Run) -> Run:
        return run.model_copy(
            update={
                "tool_calls": [
                    call.model_copy(
                        update={
                            "args": self._cap(call.args),
                            "result": self._cap(call.result),
                        }
                    )
                    for call in run.tool_calls
                ]
            }
        )

    def _cap(self, value: Any) -> Any:
        """Replace an oversized payload with an explicit marker.

        http_request can return a large body, and an unbounded log row is a
        liability regardless of store (spec §6).
        """
        if value is None:
            return None
        encoded = json.dumps(value, default=str).encode("utf-8")
        if len(encoded) <= self._log_payload_max_bytes:
            return value
        return {
            "truncated": True,
            "bytes": len(encoded),
            "preview": encoded[:512].decode("utf-8", errors="replace"),
        }
