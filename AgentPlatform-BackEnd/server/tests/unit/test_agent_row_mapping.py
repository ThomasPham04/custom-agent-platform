"""The row mapping is where a Postgres repository quietly breaks a contract.

Timestamps go in as ISO strings and come back out of a TIMESTAMPTZ column; if
the round trip is not exact, the seeds' fixed times drift and the descending
sort starts comparing different formats.
"""

from datetime import UTC, datetime, timedelta, timezone

from app.modules.agents.repositories.postgres import agent_to_row, row_to_agent
from app.modules.agents.schemas import Agent

AGENT = Agent(
    id="agent_support",
    name="Support Bot",
    icon="\U0001f3a7",
    description="Answers billing questions.",
    model="gemini-3.1-flash-lite",
    system_prompt="You are the support agent.",
    tool_ids=["current_time", "http_request"],
    status="active",
    created_at="2026-07-05T12:00:00+00:00",
    updated_at="2026-08-04T10:00:00+00:00",
)

_COLUMNS = (
    "id",
    "name",
    "icon",
    "description",
    "model",
    "system_prompt",
    "tool_ids",
    "status",
    "created_at",
    "updated_at",
)


def test_the_row_is_ordered_to_match_the_insert_statement():
    row = agent_to_row(AGENT)
    assert row[0] == "agent_support"
    assert row[1] == "Support Bot"
    assert row[6] == ["current_time", "http_request"]


def test_timestamps_become_aware_datetimes():
    row = agent_to_row(AGENT)
    assert row[8] == datetime(2026, 7, 5, 12, 0, tzinfo=UTC)
    assert row[9] == datetime(2026, 8, 4, 10, 0, tzinfo=UTC)


def test_a_row_maps_back_to_an_identical_agent():
    restored = row_to_agent(dict(zip(_COLUMNS, agent_to_row(AGENT), strict=True)))
    assert restored == AGENT


def test_a_non_utc_timestamp_is_normalised_to_utc():
    """asyncpg returns whatever the session timezone is. The contract's strings
    are +00:00, and the descending sort compares them as text."""
    row = dict(zip(_COLUMNS, agent_to_row(AGENT), strict=True))
    row["updated_at"] = datetime(2026, 8, 4, 19, 0, tzinfo=timezone(timedelta(hours=9)))
    assert row_to_agent(row).updated_at == "2026-08-04T10:00:00+00:00"
