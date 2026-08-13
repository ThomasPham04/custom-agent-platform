import pytest

from app.core.errors import BadRequestError
from app.modules.tools.registry import ToolRegistry, default_tools


def test_lists_every_registered_tool_in_order():
    ids = [s.id for s in ToolRegistry(default_tools(http_timeout_ms=5000)).list()]
    assert ids == ["current_time", "http_request", "calculator", "knowledge_search"]


def test_get_returns_none_for_an_unknown_id():
    assert ToolRegistry(default_tools(http_timeout_ms=5000)).get("nope") is None


def test_resolve_returns_tools_in_the_requested_order():
    registry = ToolRegistry(default_tools(http_timeout_ms=5000))
    tools = registry.resolve(["calculator", "current_time"])
    assert [t.schema.id for t in tools] == ["calculator", "current_time"]


def test_resolve_rejects_an_unknown_id():
    with pytest.raises(BadRequestError) as exc:
        ToolRegistry(default_tools(http_timeout_ms=5000)).resolve(["current_time", "nope"])
    assert "nope" in str(exc.value)


def test_known_ids_is_what_agent_validation_uses():
    """agents/ must never import the tool catalog directly (spec §4.2)."""
    assert "http_request" in ToolRegistry(default_tools(http_timeout_ms=5000)).known_ids()


async def test_invoke_runs_the_registered_tool():
    result = await ToolRegistry(default_tools(http_timeout_ms=5000)).invoke(
        "current_time", timezone="UTC"
    )
    assert result.ok is True


async def test_invoke_rejects_an_unknown_tool_id():
    with pytest.raises(BadRequestError) as exc:
        await ToolRegistry(default_tools(http_timeout_ms=5000)).invoke("nope")
    assert "nope" in str(exc.value)
