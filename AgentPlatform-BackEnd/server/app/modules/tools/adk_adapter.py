"""Bridges our Tool Protocol to ADK's FunctionTool.

Deliberately unimplemented in Phase 0: ADK's Python surface is unverified and
must be checked against the installed package before it is committed to (spec §7).
Nothing in this phase imports google.adk.
"""

from collections.abc import Sequence
from typing import Any

from app.modules.tools.base import Tool


def to_adk_tools(tools: Sequence[Tool]) -> list[Any]:
    raise NotImplementedError("Phase 3 wraps tools as ADK FunctionTools.")
