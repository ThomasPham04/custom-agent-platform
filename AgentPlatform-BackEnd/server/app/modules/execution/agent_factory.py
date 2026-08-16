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


def _instruction(spec: RunSpec) -> str:
    """The stored prompt, followed by the agent's display name.

    The name goes last because ADK's request processors run `instructions`
    before `identity` (flows/llm_flows/single_flow.py), so this paragraph ends
    up immediately before the id line it needs to override.
    """
    identity = _IDENTITY.format(name=spec.name)
    return f"{spec.system_prompt}\n\n{identity}" if spec.system_prompt else identity


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
