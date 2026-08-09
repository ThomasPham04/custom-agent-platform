"""Real provider — Google ADK.

Phase 3 builds an ADK LlmAgent via agent_factory, runs it, and translates ADK's
event stream into RunEvents. ADK-specific knowledge stops inside this file.

No google.adk import in Phase 0: the exact class names, import paths, and event
schema must be verified against the installed package first (spec §7).
"""

from collections.abc import AsyncIterator

from app.modules.llm.catalog import MODELS
from app.modules.llm.provider import LLMProvider, ModelInfo, RunEvent, RunSpec


class AdkGeminiProvider(LLMProvider):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def models(self) -> list[ModelInfo]:
        return MODELS

    def run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        raise NotImplementedError("Phase 3 wires the ADK Runner.")
