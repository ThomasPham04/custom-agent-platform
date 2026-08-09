"""Builds an ADK LlmAgent from stored agent configuration.

Phase 3: instruction = system_prompt, model = agent.model, tools wrapped by
tools/adk_adapter. No google.adk import until the API surface is verified
against the installed package (spec §7).
"""

from typing import Any

from app.modules.llm.provider import RunSpec


def build_adk_agent(spec: RunSpec) -> Any:
    raise NotImplementedError("Phase 3 builds the ADK LlmAgent.")
