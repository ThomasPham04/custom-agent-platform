"""Deterministic provider.

Phase 3 ports the fixtures from
docs/superpowers/references/express-contract-reference.md §5 and replays them as
RunEvents, including the `fail` keyword failure path that the frontend's error
handling and the Playwright suite both depend on. Suppression when spec.retry is
true is part of that contract.
"""

from collections.abc import AsyncIterator

from app.modules.llm.catalog import MODELS
from app.modules.llm.provider import LLMProvider, ModelInfo, RunEvent, RunSpec


class MockLLMProvider(LLMProvider):
    def models(self) -> list[ModelInfo]:
        return MODELS

    def run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        raise NotImplementedError("Phase 3 replays runs.js fixtures as RunEvents.")
