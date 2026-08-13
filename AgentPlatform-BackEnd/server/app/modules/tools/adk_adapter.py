"""Bridges our Tool Protocol to ADK's FunctionTool.

ADK builds a function declaration by introspecting the callable: its name, its
docstring, and inspect.signature. Our Tool Protocol is `execute(**kwargs)`, which
advertises no parameters at all — handed to ADK unchanged, every tool would look
argument-less and the model would never pass one. So a real signature is
synthesized from ToolSchema.

The wrapper also times each invocation. ADK reports *that* a function was called
and what it returned, but not how long it took, and durationMs is contract. The
recorder is the single source for tool events in adk_gemini.py; correlating
ADK's own call ids would buy nothing, because the response is not streamed.

google.adk is imported inside to_adk_tools, not at module scope: it is an
optional extra and tests/test_structure.py imports every module.
"""

import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from inspect import Parameter, Signature
from typing import Any

from app.modules.tools.base import Tool

_ANNOTATIONS: dict[str, type] = {"string": str, "number": float, "boolean": bool}


@dataclass
class CallRecord:
    tool_id: str
    args: dict[str, Any]
    result: Any | None
    error: str | None
    duration_ms: int


@dataclass
class ToolRecorder:
    """Collects what happened during one turn, in invocation order."""

    calls: list[CallRecord] = field(default_factory=list)


def build_callable(tool: Tool, recorder: ToolRecorder) -> Callable[..., Awaitable[Any]]:
    schema = tool.schema

    async def invoke(**kwargs: Any) -> Any:
        # An unsupplied optional arrives as None from the synthesized default;
        # forwarding it would override the tool's own default.
        args = {k: v for k, v in kwargs.items() if v is not None}

        # The record's position is claimed *before* the await, not after the
        # tool returns. ADK runs function calls concurrently, so appending on
        # completion would order the trace — and the `seq` column persisted with
        # it — by whichever call happened to finish first rather than by the
        # order the model made them in.
        record = CallRecord(
            tool_id=schema.id, args=args, result=None, error=None, duration_ms=0
        )
        recorder.calls.append(record)

        started = time.perf_counter()
        try:
            result = await tool.execute(**args)
            value, error = (result.value, None) if result.ok else (None, result.error)
        except Exception as exc:  # noqa: BLE001 - a tool must not abort the turn
            value, error = None, f"{type(exc).__name__}: {exc}"

        record.result = value
        record.error = error
        record.duration_ms = int((time.perf_counter() - started) * 1000)

        # Returned to the model, not raised: ADK feeds this back so the model can
        # explain the failure instead of the turn collapsing.
        return {"error": error} if error is not None else value

    parameters = [
        Parameter(
            name=param.name,
            kind=Parameter.KEYWORD_ONLY,
            default=Parameter.empty if param.required else None,
            annotation=(
                _ANNOTATIONS[param.type]
                if param.required
                else _ANNOTATIONS[param.type] | None
            ),
        )
        for param in schema.params
    ]
    # Required parameters must precede defaulted ones in a signature object.
    parameters.sort(key=lambda p: p.default is not Parameter.empty)

    invoke.__name__ = schema.id
    invoke.__qualname__ = schema.id
    invoke.__doc__ = "\n".join(
        [schema.description, ""]
        + [f"    {p.name}: {p.description}" for p in schema.params]
    )
    invoke.__signature__ = Signature(parameters)
    invoke.__annotations__ = {p.name: p.annotation for p in parameters} | {
        "return": Any
    }
    return invoke


def to_adk_tools(tools: Sequence[Tool], recorder: ToolRecorder) -> list[Any]:
    from google.adk.tools import FunctionTool

    return [FunctionTool(build_callable(tool, recorder)) for tool in tools]
