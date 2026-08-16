"""Folds a RunEvent stream into the HTTP response and the stored run.

Two translation steps exist deliberately. ADK-specific knowledge stops inside
llm/providers/adk_gemini.py; transport-specific knowledge lives here. Neither
leaks into the other, which is what makes the mock provider possible (spec §7).
"""

from collections.abc import AsyncIterator

from app.core.clock import now_iso
from app.core.ids import create_id
from app.modules.execution.schemas import MessageResponse, ToolCall
from app.modules.llm.provider import (
    RunEvent,
    RunSpec,
    TextDelta,
    ToolCallFinished,
    ToolCallStarted,
    TurnFinished,
)
from app.modules.runs.schemas import Run, RunToolCall

_UNFINISHED = "The provider ended the turn before this call reported a result."


async def translate(
    events: AsyncIterator[RunEvent], spec: RunSpec
) -> tuple[MessageResponse, Run]:
    # Insertion-ordered: a dict keyed by call id preserves the order calls
    # *started* in, which is the order the trace rail renders, while still
    # letting a finished event arrive late. ADK interleaves; the mock does not.
    started: dict[str, ToolCallStarted] = {}
    finished: dict[str, ToolCallFinished] = {}
    deltas: list[str] = []
    turn: TurnFinished | None = None

    async for event in events:
        if isinstance(event, ToolCallStarted):
            started[event.call_id] = event
        elif isinstance(event, ToolCallFinished):
            finished[event.call_id] = event
        elif isinstance(event, TextDelta):
            deltas.append(event.text)
        elif isinstance(event, TurnFinished):
            turn = event

    if turn is None:
        # Not reachable through either provider; guarded because the alternative
        # is an AttributeError inside a 500 rather than a legible failure.
        raise RuntimeError("The provider ended without a TurnFinished event.")

    calls: list[ToolCall] = []
    for call_id, start in started.items():
        end = finished.get(call_id)
        error = end.error if end is not None else _UNFINISHED
        calls.append(
            ToolCall(
                id=call_id,
                tool_id=start.tool_id,
                args=start.args,
                result=end.result if end is not None else None,
                error=error,
                duration_ms=end.duration_ms if end is not None else 0.0,
                status="error" if error is not None else "ok",
            )
        )

    failure = next((c.error for c in calls if c.status == "error"), None)
    status = "error" if failure is not None else "done"
    # TurnFinished.text is authoritative when the provider supplies it; the
    # deltas are the fallback for a provider that only streams (spec §5.2).
    content = turn.text if turn.text else "".join(deltas)
    # One clock read, so the message and its run cannot land a microsecond apart.
    timestamp = now_iso()

    message = MessageResponse(
        id=create_id("msg"),
        role="assistant",
        content=content,
        tool_calls=calls,
        model=turn.model,
        latency_ms=turn.latency_ms,
        status=status,
        created_at=timestamp,
    )

    run = Run(
        id=create_id("run"),
        agent_id=spec.agent_id,
        # The snapshot columns. Agents are mutable; without these, editing an
        # agent's prompt would retroactively rewrite every past run (spec §6).
        agent_name=spec.name,
        model=turn.model,
        system_prompt=spec.system_prompt,
        user_message=spec.user_message,
        answer=content,
        status=status,
        error=failure,
        latency_ms=turn.latency_ms,
        session_id=spec.session_id,
        created_at=timestamp,
        tool_calls=[
            RunToolCall(
                id=call.id,
                seq=seq,
                tool_id=call.tool_id,
                args=call.args,
                result=call.result,
                error=call.error,
                duration_ms=call.duration_ms,
                status=call.status,
            )
            for seq, call in enumerate(calls)
        ],
    )

    return message, run
