"""Agent Execution — the orchestrator.

This is the composition point for the other three components, and the only module
that depends on all of them. It is deliberately NOT behind an interface: making
the orchestrator swappable would be abstraction with nothing on the other side.

Flow (spec §7):
  1. agent_repo.get(agent_id)            -> NotFoundError if missing
  1b. sessions.get(payload.session_id)   -> NotFoundError if missing,
                                            BadRequestError if another agent's
  2. tools.resolve(agent.tool_ids)
  3. build RunSpec
  4. llm.run(spec)                       -> AsyncIterator[RunEvent]
  5. event_translator.translate(...)     -> (MessageResponse, Run)
  6. runs.append(run)
  7. return the message

Steps 2 through 6 above are the shared core, `_execute`: build the spec, run
the provider, cap the stored payloads, append the run. Everything about
sessions — steps 1b and 7's session bookkeeping — stays out of `_execute` and
lives in `send_message`, which owns it deliberately. `run_trigger` is the
second entry point, used by scheduled triggers rather than chat: it skips
step 1b and every other session step, calls `_execute` with a trigger_id to
stamp on the run, and returns the Run itself rather than a message, since
there is no HTTP response being built. A triggered run therefore has
session_id None and is reachable through the trigger activity log, not
through chat.
"""

import json
from typing import Any

from app.core.clock import now
from app.core.errors import BadRequestError, NotFoundError
from app.core.ids import create_id
from app.modules.agents.repository import AgentRepository
from app.modules.agents.schemas import Agent
from app.modules.execution.event_translator import translate
from app.modules.execution.schemas import MessageRequest, MessageResponse
from app.modules.llm.provider import LLMProvider, RunSpec
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
                    # Truncated now so the row is never titleless; upgraded below.
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

        message, _run = await self._execute(
            agent,
            payload.content,
            retry=payload.retry,
            session_id=session_id,
            trigger_id=None,
        )
        await self._sessions.touch(session_id)

        if created is not None:
            created = await self._retitle(created, payload.content)
        return message, created

    async def _execute(
        self,
        agent: Agent,
        message: str,
        *,
        retry: bool,
        session_id: str | None,
        trigger_id: str | None,
    ) -> tuple[MessageResponse, Run]:
        """Build the spec, run the provider, store the run.

        Shared by the chat path and the trigger path. Everything about sessions
        stays in send_message: a triggered run deliberately creates none.
        """
        spec = RunSpec(
            agent_id=agent.id,
            name=agent.name,
            model=agent.model,
            system_prompt=agent.system_prompt,
            tools=self._tools.resolve(agent.tool_ids),
            user_message=message,
            retry=retry,
            session_id=session_id,
            trigger_id=trigger_id,
        )
        response, run = await translate(self._llm.run(spec), spec)
        # Truncation applies to the stored row only. The response bytes are fixed
        # by the contract, and the frontend renders the payload the trace shows
        # (spec §6, decision 7).
        stored = self._capped(run)
        await self._runs.append(stored)
        return response, stored

    async def run_trigger(self, agent_id: str, message: str, trigger_id: str) -> Run:
        """One firing of a trigger.

        No session is created, validated, touched, or titled: a triggered run is
        reachable through the trigger activity log, and chat stays human-only.
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
        )
        return run

    async def _retitle(self, created: Session, first_message: str) -> Session:
        """Upgrade the truncated title with the model's summary.

        Only if the title is still the truncated one: a rename typed in the
        seconds before this returns must not be silently clobbered. By the
        time this runs the run is already durably appended and the session
        already touched, so nothing in here — summarize, the re-read, or the
        rename itself — may raise out of send_message. A dropped connection
        on `rename` must not turn a completed reply into a 500; the title is
        a nicety, the answer is the product. Any failure at any step leaves
        the truncated title in place.
        """
        try:
            title = await self._llm.summarize(first_message)
            current = await self._sessions.get(created.id)
            if current is None or current.title != created.title:
                return current or created
            return await self._sessions.rename(created.id, title) or created
        except Exception:  # noqa: BLE001 - a title must not fail the turn
            return created

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
