"""Agent Execution — the orchestrator."""

import json
from collections.abc import AsyncIterator
from typing import Any

from app.core.clock import now
from app.core.errors import BadRequestError, NotFoundError
from app.core.ids import create_id
from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent
from app.modules.execution.event_translator import EventAccumulator, translate
from app.modules.execution.schemas import MessageRequest, MessageResponse
from app.modules.llm.provider import LLMProvider, RunEvent, RunSpec, TurnFinished
from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run
from app.modules.sessions.repository import SessionRepository
from app.modules.sessions.schemas import Session
from app.modules.sessions.titles import truncate_title
from app.modules.tools.registry import ToolRegistry


class ExecutionService:
    def __init__(
        self,
        agents: AgentRepository,
        tools: ToolRegistry,
        llm: LLMProvider,
        runs: RunRepository,
        sessions: SessionRepository,
        log_payload_max_bytes: int,
    ) -> None:
        self._agents = agents
        self._tools = tools
        self._llm = llm
        self._runs = runs
        self._sessions = sessions
        self._log_payload_max_bytes = log_payload_max_bytes

    async def send_message(
        self, agent_id: str, payload: MessageRequest
    ) -> tuple[MessageResponse, Session | None]:
        agent, session_id, created = await self._prepare_message(agent_id, payload)
        message, _run = await self._execute(
            agent,
            payload.content,
            retry=payload.retry,
            session_id=session_id,
            trigger_id=None,
        )
        await self._sessions.touch(session_id)
        return message, created

    async def stream_message(
        self, agent_id: str, payload: MessageRequest
    ) -> tuple[Session | None, AsyncIterator[RunEvent | MessageResponse]]:
        """Validate before headers, then stream events and the persisted reply."""
        agent, session_id, created = await self._prepare_message(agent_id, payload)

        async def stream() -> AsyncIterator[RunEvent | MessageResponse]:
            spec = self._spec(
                agent,
                payload.content,
                retry=payload.retry,
                session_id=session_id,
                trigger_id=None,
            )
            accumulator = EventAccumulator()
            async for event in self._llm.run(spec):
                accumulator.accept(event)
                if not isinstance(event, TurnFinished):
                    yield event
            response, run = accumulator.finish(spec)
            await self._runs.append(self._capped(run))
            await self._sessions.touch(session_id)
            yield response

        return created, stream()

    async def _prepare_message(
        self, agent_id: str, payload: MessageRequest
    ) -> tuple[Agent, str, Session | None]:
        agent = await self._agents.get(agent_id)
        if agent is None:
            raise NotFoundError(f'No agent with id "{agent_id}".')

        created: Session | None = None
        session_id = payload.session_id
        if session_id is None:
            created = await self._sessions.create(
                Session(
                    id=create_id("sess"),
                    agent_id=agent.id,
                    # Immediate and stable: a title must not add another model call.
                    title=truncate_title(payload.content),
                    created_at=now(),
                    updated_at=now(),
                )
            )
            session_id = created.id
        else:
            # runs.session_id carries no foreign key and sessions.touch is a
            # silent no-op on a missing id, so an unchecked id writes a run
            # nobody can reach: a chat page still holding a deleted session's id
            # would store its reply against a session that no list resolves.
            # Both checks run before the provider call and before runs.append,
            # so a rejected send leaves nothing behind.
            session = await self._sessions.get(session_id)
            if session is None:
                raise NotFoundError(f'No session with id "{session_id}".')
            # The URL names the agent, the body names the session. A session
            # belonging to another agent would land its turns in that agent's
            # thread, and the sidebar reads a thread's identity from
            # session.agent_id — so it would show one agent for turns produced
            # by another.
            if session.agent_id != agent_id:
                raise BadRequestError(
                    f'Session "{session_id}" does not belong to agent "{agent_id}".'
                )

        return agent, session_id, created

    async def _execute(
        self,
        agent: Agent,
        message: str,
        *,
        retry: bool,
        session_id: str | None,
        trigger_id: str | None,
        timezone: str | None = None,
    ) -> tuple[MessageResponse, Run]:
        """Build the spec, run the provider, store the run.

        Shared by the chat path and the trigger path. Everything about sessions
        stays in send_message: a triggered run deliberately creates none.
        """
        spec = self._spec(
            agent,
            message,
            retry=retry,
            session_id=session_id,
            trigger_id=trigger_id,
            timezone=timezone,
        )
        response, run = await translate(self._llm.run(spec), spec)
        # Truncation applies to the stored row only. The response bytes are fixed
        # by the contract, and the frontend renders the payload the trace shows.
        stored = self._capped(run)
        await self._runs.append(stored)
        return response, stored

    def _spec(
        self,
        agent: Agent,
        message: str,
        *,
        retry: bool,
        session_id: str | None,
        trigger_id: str | None,
        timezone: str | None = None,
    ) -> RunSpec:
        return RunSpec(
            agent_id=agent.id,
            name=agent.name,
            model=agent.model,
            system_prompt=agent.system_prompt,
            tools=self._tools.resolve(agent.tool_ids),
            user_message=message,
            retry=retry,
            session_id=session_id,
            trigger_id=trigger_id,
            timezone=timezone,
        )

    async def run_trigger(
        self, agent_id: str, message: str, trigger_id: str, timezone: str
    ) -> Run:
        """One firing of a trigger.

        No session is created, validated, touched, or titled: a triggered run is
        reachable through the trigger activity log, and chat stays human-only.
        `timezone` is the trigger's own configured zone, so a time-aware tool call
        defaults to it instead of the container's UTC.
        """
        agent = await self._agents.get(agent_id)
        if agent is None:
            raise NotFoundError(f'No agent with id "{agent_id}".')
        _response, run = await self._execute(
            agent,
            message,
            retry=False,
            session_id=None,
            trigger_id=trigger_id,
            timezone=timezone,
        )
        return run

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
        liability regardless of store.
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
