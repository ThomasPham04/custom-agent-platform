"""Guards the module boundaries the whole design rests on.

A circular import is the first symptom of a broken dependency rule, and it is far
cheaper to catch here than during Phase 3.
"""

import importlib
from pathlib import Path

MODULES = [
    "app.config",
    "app.container",
    "app.main",
    "app.core.wire",
    "app.core.ids",
    "app.core.clock",
    "app.core.errors",
    "app.core.db",
    "app.modules.agents.schemas",
    "app.modules.agents.repository",
    "app.modules.agents.repositories.memory",
    "app.modules.agents.repositories.postgres",
    "app.modules.agents.service",
    "app.modules.agents.router",
    "app.modules.agents.seeds",
    "app.modules.tools.base",
    "app.modules.tools.registry",
    "app.modules.tools.adk_adapter",
    "app.modules.tools.router",
    "app.modules.tools.impls.current_time",
    "app.modules.tools.impls.http_request",
    "app.modules.tools.impls.calculator",
    "app.modules.tools.impls.knowledge_search",
    "app.modules.llm.provider",
    "app.modules.llm.catalog",
    "app.modules.llm.router",
    "app.modules.llm.providers.mock",
    "app.modules.llm.providers.adk_gemini",
    "app.modules.execution.schemas",
    "app.modules.execution.agent_factory",
    "app.modules.execution.event_translator",
    "app.modules.execution.service",
    "app.modules.execution.router",
    "app.modules.runs.schemas",
    "app.modules.runs.repository",
    "app.modules.runs.repositories.memory",
    "app.modules.runs.repositories.postgres",
    "app.modules.runs.service",
    "app.modules.runs.router",
]


def test_every_module_imports_cleanly():
    for name in MODULES:
        importlib.import_module(name)


def test_agents_does_not_import_the_tool_or_model_catalogs():
    """The forbidden edges from spec §4.2.

    agents/ receives a ToolRegistry and a model id set from container.py. Importing
    the catalogs directly is the coupling today's agentStore.js has, and it is what
    this architecture exists to remove.
    """
    root = Path(__file__).resolve().parents[1] / "app" / "modules" / "agents"
    for path in root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        assert "tools.impls" not in source, f"{path} imports the tool catalog"
        assert "tools.registry import default_tools" not in source, (
            f"{path} imports the tool catalog"
        )
        assert "llm.catalog" not in source, f"{path} imports the model catalog"


def test_no_module_imports_google_adk_in_this_phase():
    """ADK's Python surface is unverified (spec §7). Phase 3 introduces it."""
    root = Path(__file__).resolve().parents[1] / "app"
    for path in root.rglob("*.py"):
        assert "import google.adk" not in path.read_text(encoding="utf-8"), str(path)
