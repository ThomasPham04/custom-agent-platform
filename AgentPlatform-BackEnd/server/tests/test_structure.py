"""Guards the module boundaries the whole design rests on.

A circular import is the first symptom of a broken dependency rule, and it is far
cheaper to catch here than during Phase 3.
"""

import ast
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
    "app.core.http",
    "app.core.text",
    "app.modules.agents.schemas",
    "app.modules.agents.validation",
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
    "app.modules.execution.validation",
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


def test_google_adk_is_never_imported_at_module_scope():
    """google-adk is an optional extra, and test_every_module_imports_cleanly
    imports the whole tree. A top-level import would make the extra mandatory
    and break a fresh `uv sync`, so adk_adapter, adk_gemini and agent_factory
    all import it inside the function that needs it.

    A substring check does not catch this: `from google.adk.tools import ...`
    contains no literal "import google.adk". The tree is parsed instead, and
    only statements nested inside a function or class body are exempt.
    """
    root = Path(__file__).resolve().parents[1] / "app"
    for path in root.rglob("*.py"):
        for name in _module_scope_imports(ast.parse(path.read_text(encoding="utf-8"))):
            assert not name.startswith("google.adk"), (
                f"{path} imports {name} at module scope; move it inside the function"
            )


def _module_scope_imports(tree: ast.Module) -> list[str]:
    """Every module the file imports before any function or class body."""
    names: list[str] = []
    for node in tree.body:
        if isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            names.append(node.module or "")
    return names
