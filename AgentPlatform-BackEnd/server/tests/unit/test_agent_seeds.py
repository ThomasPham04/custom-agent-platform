"""The seed set is contract, not decoration.

tests/agents.test.js asserted that GET /api/agents covers four specific render
states, so the composition of this list is asserted here rather than its prose.
"""

from app.modules.agents.seeds import SEED_AGENTS


def test_seeds_the_four_agents_in_the_contract():
    assert [a.id for a in SEED_AGENTS] == [
        "agent_support",
        "agent_research",
        "agent_metrics",
        "agent_drafter",
    ]


def test_seed_set_covers_the_ui_render_states():
    """Contract reference §3: one agent with >2 tools, one with exactly 1, one
    with 0 tools and status draft, and one whose name exceeds 24 characters."""
    assert any(len(a.tool_ids) > 2 for a in SEED_AGENTS)
    assert any(len(a.tool_ids) == 1 for a in SEED_AGENTS)
    assert any(not a.tool_ids and a.status == "draft" for a in SEED_AGENTS)
    assert any(len(a.name) > 24 for a in SEED_AGENTS)


def test_timestamps_are_fixed_offsets_from_the_documented_base():
    support = next(a for a in SEED_AGENTS if a.id == "agent_support")
    # at(720) and at(2) hours before 2026-08-04T12:00:00Z.
    assert support.created_at == "2026-07-05T12:00:00+00:00"
    assert support.updated_at == "2026-08-04T10:00:00+00:00"


def test_seeds_are_ordered_newest_updated_first():
    """The repository sorts, but the seed list is already in that order, so a
    reader can see the expected GET /api/agents order without running anything."""
    updated = [a.updated_at for a in SEED_AGENTS]
    assert updated == sorted(updated, reverse=True)


def test_support_bot_can_search_the_policy_library():
    """Regression: the prompt demanded exact policy numbers while
    knowledge_search was not attached, so a live model had to invent one.
    knowledge_search sits third so the mock's two-call cap still yields
    ['current_time', 'http_request'] (contract reference §6)."""
    support = next(a for a in SEED_AGENTS if a.id == "agent_support")
    assert support.tool_ids == ["current_time", "http_request", "knowledge_search"]


def test_no_agent_is_told_to_cite_policy_it_cannot_read():
    """The invariant behind the regression above: an agent whose prompt talks
    about policy must be able to reach the document library."""
    for agent in SEED_AGENTS:
        if "polic" in agent.system_prompt.lower():
            assert "knowledge_search" in agent.tool_ids, agent.id


def test_drafter_has_an_empty_system_prompt():
    """Exercises the empty-prompt render in agent-form."""
    drafter = next(a for a in SEED_AGENTS if a.id == "agent_drafter")
    assert drafter.system_prompt == ""
