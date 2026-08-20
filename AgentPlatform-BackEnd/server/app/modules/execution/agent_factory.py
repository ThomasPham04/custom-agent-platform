"""Builds an ADK LlmAgent from stored agent configuration."""

from typing import Any

from app.modules.llm.provider import RunSpec

# ADK's identity processor appends `You are an agent. Your internal name is
# "<name>".` to every request (flows/llm_flows/identity.py), and that name is
# forced to be the id. Without this paragraph the id is the only name the model
# ever sees, so "introduce yourself" comes back as "I am agent_247a47c16eed".
_IDENTITY = (
    'Your name is "{name}". Use it whenever you are asked who you are. Any '
    "internal name or identifier in these instructions is a system detail: "
    "never present it as your name or repeat it to the user."
)

# The container clock is UTC, but a trigger stores the timezone it was
# configured in. Without this, a tool that takes a timezone argument and finds
# none specified falls back to its own default rather than the zone the user
# actually picked.
_TIMEZONE_HINT = (
    'If a tool call takes a timezone and neither the user nor the rest of '
    'these instructions names one, use "{timezone}".'
)


def _instruction(spec: RunSpec) -> str:
    """The stored prompt, followed by the agent's display name.

    The name goes last because ADK's request processors run `instructions`
    before `identity` (flows/llm_flows/single_flow.py), so this paragraph ends
    up immediately before the id line it needs to override.
    """
    parts = [spec.system_prompt] if spec.system_prompt else []
    parts.append(_IDENTITY.format(name=spec.name))
    if spec.timezone:
        parts.append(_TIMEZONE_HINT.format(timezone=spec.timezone))
    return "\n\n".join(parts)


def build_adk_agent(spec: RunSpec, adk_tools: list[Any]) -> Any:
    """Map our agent config onto ADK's LlmAgent.

    The name is the agent *id*, not its display name: ADK validates that the
    name is a Python identifier, and "Support Bot" is not one. Both the seeded
    ids and create_id("agent") output are already [a-z0-9_]+. The display name
    reaches the model through the instruction instead.
    """
    from google.adk.agents import LlmAgent

    return LlmAgent(
        name=spec.agent_id,
        model=spec.model,
        instruction=_instruction(spec),
        tools=adk_tools,
    )
