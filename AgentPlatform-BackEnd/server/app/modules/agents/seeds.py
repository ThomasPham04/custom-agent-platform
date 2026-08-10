"""The four sample agents.

Phase 1 transcribes them from
docs/superpowers/references/express-contract-reference.md §3, including the fixed
timestamps that keep relative times stable and reviewable. Seeded on first boot
only when the store is empty (spec §6).
"""

from app.modules.agents.schemas import Agent

SEED_AGENTS: list[Agent] = []

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
