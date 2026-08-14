"""Real provider — Google ADK.

ADK-specific knowledge stops inside this file. Everything above LLMProvider sees
only RunEvents, which is why the mock and this provider are interchangeable and
why the whole contract suite runs without an API key (spec §5.2).

google.adk is imported inside the methods, not at module scope: it is an optional
extra and tests/test_structure.py imports every module in the tree.
"""

import time
from collections.abc import AsyncIterator
from typing import Any

from app.core.errors import ProviderError
from app.core.ids import create_id
from app.modules.execution.agent_factory import build_adk_agent
from app.modules.llm.catalog import MODELS
from app.modules.llm.failures import provider_message
from app.modules.llm.provider import (
    LLMProvider,
    ModelInfo,
    RunEvent,
    RunSpec,
    TextDelta,
    ToolCallFinished,
    ToolCallStarted,
    TurnFinished,
)
from app.modules.tools.adk_adapter import ToolRecorder, to_adk_tools

_APP_NAME = "agent-platform"
# No auth, so every turn is the same principal. Sessions are not conversation
# memory here: runs/ is our audit record, independent of ADK's session state
# (spec §5.2, "Sessions").
_USER_ID = "local"


class AdkGeminiProvider(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def models(self) -> list[ModelInfo]:
        return MODELS

    def run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        return self._run(spec)

    async def _run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        recorder = ToolRecorder()
        started = time.perf_counter()
        parts: list[str] = []

        try:
            async for event in self._stream(spec, recorder):
                text = _text_of(event)
                if text:
                    parts.append(text)
                    yield TextDelta(text=text)
        except Exception as exc:  # noqa: BLE001 - every upstream failure is a 502
            # The raw text belongs in the log, not the answer bubble: it carries
            # billing URLs and vendor JSON the reader cannot act on. `from exc`
            # keeps the original on the traceback for whoever reads the log.
            print(f"provider failure: {exc!r}")
            raise ProviderError(provider_message(exc)) from exc

        # Tool events are replayed from the recorder rather than correlated with
        # ADK's own call ids: ADK does not report durations, and durationMs is
        # contract. The response is not streamed, so ordering is all that matters.
        for record in recorder.calls:
            call_id = create_id("call")
            yield ToolCallStarted(
                call_id=call_id, tool_id=record.tool_id, args=record.args
            )
            yield ToolCallFinished(
                call_id=call_id,
                result=record.result,
                error=record.error,
                duration_ms=record.duration_ms,
            )

        yield TurnFinished(
            text="".join(parts),
            model=spec.model,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )

    async def _stream(
        self, spec: RunSpec, recorder: ToolRecorder
    ) -> AsyncIterator[Any]:
        """Drive ADK's Runner for one turn. Separated so tests can replace it."""
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService
        from google.genai import types

        session_service = InMemorySessionService()
        runner = Runner(
            app_name=_APP_NAME,
            agent=build_adk_agent(spec, to_adk_tools(spec.tools, recorder)),
            session_service=session_service,
        )
        session = await session_service.create_session(
            app_name=_APP_NAME,
            user_id=_USER_ID,
            session_id=spec.session_id or create_id("sess"),
        )
        message = types.Content(
            role="user", parts=[types.Part.from_text(text=spec.user_message)]
        )
        async for event in runner.run_async(
            user_id=_USER_ID, session_id=session.id, new_message=message
        ):
            yield event


def _text_of(event: Any) -> str:
    """Concatenate the answer text of an ADK event, skipping tool traffic.

    Parts flagged `thought=True` carry the model's internal reasoning summary.
    They are not an answer and must never reach the user, so they are dropped
    here rather than filtered downstream — event_translator sees only RunEvents
    and has no way to tell one kind of text from another.
    """
    content = getattr(event, "content", None)
    if content is None or not getattr(content, "parts", None):
        return ""
    return "".join(
        part.text
        for part in content.parts
        if getattr(part, "text", None) and not getattr(part, "thought", False)
    )
