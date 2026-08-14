"""Builds an ADK LlmAgent from stored agent configuration."""

from typing import Any

from app.modules.llm.provider import RunSpec


def build_adk_agent(spec: RunSpec, adk_tools: list[Any]) -> Any:
    """Map our agent config onto ADK's LlmAgent.

    The name is the agent *id*, not its display name: ADK validates that the
    name is a Python identifier, and "Support Bot" is not one. Both the seeded
    ids and create_id("agent") output are already [a-z0-9_]+.
    """
    from google.adk.agents import LlmAgent

    return LlmAgent(
        name=spec.agent_id,
        model=spec.model,
        instruction=spec.system_prompt,
        tools=adk_tools,
    )
