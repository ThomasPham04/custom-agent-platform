"""Deterministic provider.

Every fixture, message and number here is transcribed from
docs/superpowers/references/express-contract-reference.md §5. This module is what
lets tests/contract/ run with no API key, so it is
contract rather than a convenience — do not "improve" the values.
"""

import re
from collections.abc import AsyncIterator
from copy import deepcopy
from typing import Any

from app.core.ids import create_id
from app.modules.llm.catalog import MODELS
from app.modules.llm.provider import (
    LLMProvider,
    ModelInfo,
    RunEvent,
    RunSpec,
    ToolCallFinished,
    ToolCallStarted,
    TurnFinished,
)

MAX_CALLS = 2
MODEL_TIME_MS = 180

FAILURE_ERROR = "connection refused after 800ms"
FAILURE_DURATION_MS = 812

# A word-boundary *prefix* match: FAIL, failure and failing all trigger it;
# unfail does not.
_FAIL_RE = re.compile(r"\bfail", re.IGNORECASE)

# Note the payload spellings. These are opaque JSON values, not WireModels, so no
# alias generator runs over them — `latencyMs` must be written exactly like that
# or the frontend reads undefined.
TOOL_FIXTURES: dict[str, dict[str, Any]] = {
    "current_time": {
        "args": {"timezone": "Asia/Tokyo"},
        "result": "2026-08-04T21:03:41+09:00",
        "duration_ms": 118,
    },
    "http_request": {
        "args": {"url": "https://status.example.com/health", "method": "GET"},
        "result": {"status": 200, "latencyMs": 41, "body": {"state": "healthy"}},
        "duration_ms": 412,
    },
    "calculator": {
        "args": {"expression": "(184320 / 1024) * 0.87"},
        "result": 156.6,
        "duration_ms": 24,
    },
    "knowledge_search": {
        "args": {"query": "refund window policy", "limit": 3},
        # Two entries despite limit 3 — transcribed as-is.
        "result": [
            {"title": "Refunds — 30 day window", "score": 0.94},
            {"title": "Proration on downgrade", "score": 0.71},
        ],
        "duration_ms": 268,
    },
}

ANSWERS: dict[str, str] = {
    "agent_support": (
        "It's 9:03 PM in Tokyo, and the status endpoint is healthy — 200 in 41 ms."
    ),
    "agent_research": (
        "The refund window is 30 days from the invoice date. Downgrades prorate "
        "from the next cycle, not immediately."
    ),
    "agent_metrics": (
        "That works out to 156.6 GB billable, which is 87% of the 180 GB recorded."
    ),
    "agent_drafter": (
        "This agent has no tools attached yet, so it can only answer from its "
        "system prompt."
    ),
}

FALLBACK_ANSWER = "Done. Expand a step above to see what each tool returned."


def _failure_answer(tool_id: str) -> str:
    return f"{tool_id} failed: {FAILURE_ERROR}. Nothing was written, so retrying is safe."


class MockLLMProvider(LLMProvider):
    def models(self) -> list[ModelInfo]:
        return MODELS

    def run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        return self._run(spec)

    async def _run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        # Unknown ids are skipped rather than raising (contract §5). Every
        # registered tool has a fixture today, so this filter is a no-op — it
        # exists so adding a tool without a fixture degrades instead of breaking.
        tool_ids = [t.schema.id for t in spec.tools if t.schema.id in TOOL_FIXTURES]
        tool_ids = tool_ids[:MAX_CALLS]

        failing = (
            bool(tool_ids)
            and _FAIL_RE.search(spec.user_message) is not None
            and not spec.retry
        )

        total_ms = 0
        for index, tool_id in enumerate(tool_ids):
            fixture = TOOL_FIXTURES[tool_id]
            call_id = create_id("call")
            # deepcopy on the way out: a caller that mutates a result must not
            # reach the module-level fixture and poison the next request.
            yield ToolCallStarted(
                call_id=call_id, tool_id=tool_id, args=deepcopy(fixture["args"])
            )

            is_last = index == len(tool_ids) - 1
            if failing and is_last:
                total_ms += FAILURE_DURATION_MS
                yield ToolCallFinished(
                    call_id=call_id,
                    result=None,
                    error=FAILURE_ERROR,
                    duration_ms=FAILURE_DURATION_MS,
                )
            else:
                total_ms += fixture["duration_ms"]
                yield ToolCallFinished(
                    call_id=call_id,
                    result=deepcopy(fixture["result"]),
                    error=None,
                    duration_ms=fixture["duration_ms"],
                )

        text = (
            _failure_answer(tool_ids[-1])
            if failing
            else ANSWERS.get(spec.agent_id, FALLBACK_ANSWER)
        )
        yield TurnFinished(
            text=text, model=spec.model, latency_ms=total_ms + MODEL_TIME_MS
        )
