"""Folds a RunEvent stream into the HTTP response and the stored run.

Two translation steps exist deliberately. ADK-specific knowledge stops inside
llm/providers/adk_gemini.py; transport-specific knowledge lives here. Neither
leaks into the other, which is what makes the mock provider possible (spec §7).
"""

from collections.abc import AsyncIterator

from app.modules.execution.schemas import MessageResponse
from app.modules.llm.provider import RunEvent, RunSpec
from app.modules.runs.schemas import Run


async def translate(
    events: AsyncIterator[RunEvent], spec: RunSpec
) -> tuple[MessageResponse, Run]:
    raise NotImplementedError("Phase 3 folds RunEvents into a message and a run.")
