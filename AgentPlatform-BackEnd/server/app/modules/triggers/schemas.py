"""Trigger wire schemas.

A trigger is an agent, a schedule, and one literal message sent verbatim. Every
next_* and last_* field is server-owned: validation.py drops those keys from a
write rather than rejecting them, exactly as agents/ drops id and createdAt.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.core.wire import WireModel

TriggerKind = Literal["interval", "daily"]
TriggerLastStatus = Literal["done", "error"]


class Trigger(WireModel):
    id: str
    agent_id: str
    name: str = Field(max_length=120)
    message: str = Field(max_length=20_000)
    kind: TriggerKind
    # Set for kind="interval", null for kind="daily".
    interval_minutes: int | None = None
    # "HH:MM" for kind="daily", null for kind="interval".
    time_of_day: str | None = None
    # Monday is 0. Empty means every day, and kind="interval" always stores empty.
    weekdays: list[int] = Field(default_factory=list)
    timezone: str = Field(max_length=64)
    enabled: bool
    # Null while disabled, which is what keeps the partial due index small.
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_status: TriggerLastStatus | None = None
    last_run_id: str | None = None
    created_at: datetime
    updated_at: datetime


# Applied under a create body, the way AGENT_DEFAULTS is. A create supplies
# agentId, kind, message, and the schedule field its kind requires.
TRIGGER_DEFAULTS: dict[str, Any] = {
    "name": "New trigger",
    "timezone": "UTC",
    "enabled": True,
    "weekdays": [],
    "interval_minutes": None,
    "time_of_day": None,
}
