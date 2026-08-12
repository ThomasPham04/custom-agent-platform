"""The four sample agents.

Transcribed from docs/superpowers/references/express-contract-reference.md §3,
including the fixed timestamps that keep seeded relative times stable and
reviewable. Seeded on first boot only when the store is empty (spec §6).

The model ids below are transcribed data, not an import: agents/ must not import
llm/catalog (spec §4.2, enforced by tests/test_structure.py).
"""

from datetime import UTC, datetime, timedelta

from app.modules.agents.schemas import Agent

# Express computed seed timestamps as offsets from a fixed base so that relative
# times in the UI stay stable across restarts and reviewable in a diff.
_BASE = datetime(2026, 8, 4, 12, 0, 0, tzinfo=UTC)


def _at(hours: int) -> str:
    """`hours` before the base instant, in the same format as core.clock.now_iso."""
    return (_BASE - timedelta(hours=hours)).isoformat()


SEED_AGENTS: list[Agent] = [
    Agent(
        id="agent_support",
        name="Support Bot",
        icon="\U0001f3a7",
        description="Answers billing and account questions for the support inbox.",
        model="gemini-2.5-flash",
        system_prompt=(
            "You are the support agent for a subscription product.\n"
            "\n"
            "Answer in two sentences or fewer. Quote exact policy numbers rather than\n"
            "paraphrasing them. When a question needs the current time or a live status\n"
            "check, call the tool instead of guessing. If you cannot answer from the\n"
            "tools and the policy text, say so and offer to escalate."
        ),
        tool_ids=["current_time", "http_request"],
        status="active",
        created_at=_at(720),
        updated_at=_at(2),
    ),
    Agent(
        id="agent_research",
        name="Research Assistant",
        icon="\U0001f52d",
        description="Gathers sources and summarises them with citations.",
        model="gemini-2.5-pro",
        system_prompt=(
            "You research questions and report findings with citations.\n"
            "\n"
            "Search the knowledge base before reaching for the web. Show your arithmetic\n"
            "through the calculator tool rather than doing it in your head."
        ),
        tool_ids=["knowledge_search", "http_request", "calculator"],
        status="active",
        created_at=_at(600),
        updated_at=_at(24),
    ),
    Agent(
        id="agent_metrics",
        name="Metrics Analyst",
        icon="\U0001f4ca",
        description="Converts raw usage numbers into a plain-language readout.",
        model="gemini-2.0-flash",
        system_prompt=(
            "You explain usage metrics in plain language. Always show the calculation."
        ),
        tool_ids=["calculator"],
        status="active",
        created_at=_at(400),
        updated_at=_at(72),
    ),
    Agent(
        id="agent_drafter",
        name="Release Notes Drafter (internal review copy)",
        icon="✍️",
        description=(
            "Turns a list of merged pull requests into release notes written for "
            "customers rather than for engineers, grouped by the part of the product "
            "each change affects."
        ),
        model="gemini-2.5-flash",
        system_prompt="",
        tool_ids=[],
        status="draft",
        created_at=_at(200),
        updated_at=_at(120),
    ),
]

# `model` is deliberately absent. agents/ must not import llm/catalog (spec §4.2,
# enforced by tests/test_structure.py), so AgentService receives default_model
# from container.py and applies it. Do not "fix" this by adding an import.
AGENT_DEFAULTS = {
    "name": "New agent",
    "icon": "\U0001f9e9",
    "description": "",
    "system_prompt": "",
    "tool_ids": [],
    "status": "draft",
}
