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


class EventAccumulator:
    """Collect one provider turn while allowing live events to be forwarded."""

    def __init__(self) -> None:
        self.started: dict[str, ToolCallStarted] = {}
        self.finished: dict[str, ToolCallFinished] = {}
        self.deltas: list[str] = []
        self.turn: TurnFinished | None = None

    def accept(self, event: RunEvent) -> None:
        if isinstance(event, ToolCallStarted):
            self.started[event.call_id] = event
        elif isinstance(event, ToolCallFinished):
            self.finished[event.call_id] = event
        elif isinstance(event, TextDelta):
            self.deltas.append(event.text)
        elif isinstance(event, TurnFinished):
            self.turn = event

    def finish(self, spec: RunSpec) -> tuple[MessageResponse, Run]:
        if self.turn is None:
            raise RuntimeError("The provider ended without a TurnFinished event.")

        calls: list[ToolCall] = []
        for call_id, start in self.started.items():
            end = self.finished.get(call_id)
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
        content = self.turn.text if self.turn.text else "".join(self.deltas)
        timestamp = now_iso()
        message = MessageResponse(
            id=create_id("msg"),
            role="assistant",
            content=content,
            tool_calls=calls,
            model=self.turn.model,
            latency_ms=self.turn.latency_ms,
            status=status,
            created_at=timestamp,
        )
        run = Run(
            id=create_id("run"),
            agent_id=spec.agent_id,
            agent_name=spec.name,
            model=self.turn.model,
            system_prompt=spec.system_prompt,
            user_message=spec.user_message,
            answer=content,
            status=status,
            error=failure,
            latency_ms=self.turn.latency_ms,
            session_id=spec.session_id,
            trigger_id=spec.trigger_id,
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


async def translate(
    events: AsyncIterator[RunEvent], spec: RunSpec
) -> tuple[MessageResponse, Run]:
    accumulator = EventAccumulator()
    async for event in events:
        accumulator.accept(event)
    return accumulator.finish(spec)
