"""The adapter is what makes our Tool Protocol legible to ADK.

ADK builds a function declaration by introspecting the callable, so a wrapper
that forwards **kwargs would advertise no parameters and the model would never
pass one. These tests pin the synthesized signature.
"""

import asyncio
import inspect

import pytest

from app.modules.tools.adk_adapter import ToolRecorder, build_callable, to_adk_tools
from app.modules.tools.base import ToolParam, ToolResult, ToolSchema


class FakeTool:
    schema = ToolSchema(
        id="fake_tool",
        label="Fake tool",
        description="Does a fake thing.",
        params=[
            ToolParam(
                name="text", type="string", required=True, description="Some text."
            ),
            ToolParam(
                name="count", type="number", required=False, description="How many."
            ),
            ToolParam(
                name="loud", type="boolean", required=False, description="Shout it."
            ),
        ],
    )

    def __init__(self, result: ToolResult | None = None, boom: bool = False) -> None:
        self._result = result or ToolResult(ok=True, value="done")
        self._boom = boom
        self.seen: dict | None = None

    async def execute(self, **kwargs):
        self.seen = kwargs
        if self._boom:
            raise RuntimeError("tool exploded")
        return self._result


def test_the_synthesized_callable_carries_the_tool_s_identity():
    fn = build_callable(FakeTool(), ToolRecorder())
    assert fn.__name__ == "fake_tool"
    assert "Does a fake thing." in fn.__doc__


def test_the_synthesized_signature_names_every_parameter():
    """This is the whole point: **kwargs would advertise nothing to ADK."""
    fn = build_callable(FakeTool(), ToolRecorder())
    params = inspect.signature(fn).parameters
    assert list(params) == ["text", "count", "loud"]


def test_required_parameters_have_no_default_and_optional_ones_do():
    fn = build_callable(FakeTool(), ToolRecorder())
    params = inspect.signature(fn).parameters
    assert params["text"].default is inspect.Parameter.empty
    assert params["count"].default is None


def test_parameter_types_are_annotated_from_the_schema():
    fn = build_callable(FakeTool(), ToolRecorder())
    params = inspect.signature(fn).parameters
    assert params["text"].annotation is str
    assert params["count"].annotation == (float | None)
    assert params["loud"].annotation == (bool | None)


async def test_calling_it_reaches_the_tool_with_the_supplied_arguments():
    tool = FakeTool()
    fn = build_callable(tool, ToolRecorder())
    await fn(text="hello", count=3)
    assert tool.seen == {"text": "hello", "count": 3}


async def test_unsupplied_optional_arguments_are_not_forwarded():
    """Passing loud=None would override a tool's own default."""
    tool = FakeTool()
    fn = build_callable(tool, ToolRecorder())
    await fn(text="hello")
    assert tool.seen == {"text": "hello"}


async def test_a_successful_call_returns_the_value_to_the_model():
    fn = build_callable(FakeTool(ToolResult(ok=True, value={"n": 1})), ToolRecorder())
    assert await fn(text="x") == {"n": 1}


async def test_a_failed_call_returns_an_error_payload_rather_than_raising():
    """ADK feeds this back to the model, which can then explain the failure.
    Raising would abort the whole turn."""
    fn = build_callable(FakeTool(ToolResult(ok=False, error="nope")), ToolRecorder())
    assert await fn(text="x") == {"error": "nope"}


async def test_an_exception_inside_a_tool_becomes_an_error_payload():
    fn = build_callable(FakeTool(boom=True), ToolRecorder())
    result = await fn(text="x")
    assert "tool exploded" in result["error"]


async def test_the_recorder_captures_a_successful_call():
    recorder = ToolRecorder()
    fn = build_callable(FakeTool(ToolResult(ok=True, value="done")), recorder)
    await fn(text="hello")

    assert len(recorder.calls) == 1
    call = recorder.calls[0]
    assert call.tool_id == "fake_tool"
    assert call.args == {"text": "hello"}
    assert call.result == "done"
    assert call.error is None
    assert call.duration_ms >= 0


async def test_the_recorder_captures_a_failed_call():
    recorder = ToolRecorder()
    fn = build_callable(FakeTool(ToolResult(ok=False, error="nope")), recorder)
    await fn(text="hello")

    call = recorder.calls[0]
    assert call.error == "nope"
    assert call.result is None


async def test_the_recorder_keeps_calls_in_invocation_order():
    recorder = ToolRecorder()
    fn = build_callable(FakeTool(), recorder)
    await fn(text="first")
    await fn(text="second")
    assert [c.args["text"] for c in recorder.calls] == ["first", "second"]


def test_to_adk_tools_wraps_every_tool():
    pytest.importorskip("google.adk")
    tools = to_adk_tools([FakeTool()], ToolRecorder())
    assert len(tools) == 1
    assert tools[0].name == "fake_tool"


async def test_the_recorder_orders_by_invocation_not_completion():
    """ADK runs function calls concurrently. Appending the record only after
    the tool returns would order the trace — and the persisted `seq` — by which
    call finished first, which is not the order the model made them in.
    """

    class SlowTool(FakeTool):
        def __init__(self, delay: float, tool_id: str) -> None:
            super().__init__()
            self.schema = FakeTool.schema.model_copy(update={"id": tool_id})
            self._delay = delay

        async def execute(self, **kwargs):
            await asyncio.sleep(self._delay)
            return ToolResult(ok=True, value=self.schema.id)

    recorder = ToolRecorder()
    slow = build_callable(SlowTool(0.05, "slow_tool"), recorder)
    fast = build_callable(SlowTool(0.0, "fast_tool"), recorder)

    # slow is invoked first but finishes last.
    await asyncio.gather(slow(text="a"), fast(text="b"))

    assert [c.tool_id for c in recorder.calls] == ["slow_tool", "fast_tool"]
    assert [c.result for c in recorder.calls] == ["slow_tool", "fast_tool"]
