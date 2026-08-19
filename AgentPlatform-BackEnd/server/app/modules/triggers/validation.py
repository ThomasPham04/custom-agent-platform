"""Trigger write validation.

Shaped after agents/validation.py: the writable keys are filtered, unknown keys
are dropped silently rather than rejected, and the order of the checks is part of
the contract — a body that breaks two rules reports the earlier one.

A patch is validated against the trigger it patches, because "an interval trigger
needs intervalMinutes" is a question about the trigger's effective kind, not about
the body alone.
"""

import re
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.errors import BadRequestError
from app.core.text import js_length
from app.modules.triggers.schemas import Trigger

# (wire field name, max length), in validation order.
WRITABLE_STRING_FIELDS: tuple[tuple[str, int], ...] = (
    ("name", 120),
    ("message", 20_000),
    ("timezone", 64),
)

_KINDS = ("interval", "daily")
_TIME_OF_DAY = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

# Wire spelling -> Python spelling. Fields not listed are already identical.
_TO_SNAKE = {
    "agentId": "agent_id",
    "intervalMinutes": "interval_minutes",
    "timeOfDay": "time_of_day",
}

WRITABLE_KEYS = frozenset(
    {name for name, _ in WRITABLE_STRING_FIELDS}
    | {"agentId", "kind", "intervalMinutes", "timeOfDay", "weekdays", "enabled"}
)


def validate_trigger_write(body: Any, *, current: Trigger | None) -> dict[str, Any]:
    """Validate a create (current=None) or a patch, returning snake_cased fields.

    Server-owned keys — id, createdAt, updatedAt, nextRunAt, lastRunAt,
    lastStatus, lastRunId — fall outside WRITABLE_KEYS and are dropped silently.
    """
    if body is None:
        body = {}
    if not isinstance(body, dict):
        raise BadRequestError("Request body must be a JSON object.")

    for field, limit in WRITABLE_STRING_FIELDS:
        if field not in body:
            continue
        value = body[field]
        if not isinstance(value, str):
            raise BadRequestError(f"{field} must be a string.")
        if js_length(value) > limit:
            raise BadRequestError(f"{field} must be at most {limit} characters.")

    if current is None:
        if not isinstance(body.get("agentId"), str) or not body["agentId"]:
            raise BadRequestError("agentId is required.")
        if not isinstance(body.get("message"), str) or not body["message"].strip():
            raise BadRequestError("message is required.")
    elif "agentId" in body and not isinstance(body["agentId"], str):
        raise BadRequestError("agentId must be a string.")

    if "kind" in body and body["kind"] not in _KINDS:
        raise BadRequestError(f'Unknown kind "{body["kind"]}".')

    kind = body.get("kind") or (current.kind if current is not None else None)
    if kind is None:
        raise BadRequestError("kind is required.")

    if kind == "interval":
        _validate_interval(body, current)
    else:
        _validate_time_of_day(body, current)

    if "weekdays" in body:
        _validate_weekdays(body["weekdays"])

    if "timezone" in body:
        _validate_timezone(body["timezone"])

    if "enabled" in body and not isinstance(body["enabled"], bool):
        raise BadRequestError("enabled must be a boolean.")

    return {
        _TO_SNAKE.get(key, key): value
        for key, value in body.items()
        if key in WRITABLE_KEYS
    }


def _validate_interval(body: Any, current: Trigger | None) -> None:
    supplied = "intervalMinutes" in body
    value = body["intervalMinutes"] if supplied else (
        current.interval_minutes if current is not None else None
    )
    if value is None:
        raise BadRequestError("intervalMinutes is required for an interval trigger.")
    # bool is a subclass of int, and True is not a number of minutes.
    if isinstance(value, bool) or not isinstance(value, int):
        raise BadRequestError("intervalMinutes must be an integer.")
    if value < 1:
        raise BadRequestError("intervalMinutes must be at least 1.")


def _validate_time_of_day(body: Any, current: Trigger | None) -> None:
    supplied = "timeOfDay" in body
    value = body["timeOfDay"] if supplied else (
        current.time_of_day if current is not None else None
    )
    if value is None:
        raise BadRequestError("timeOfDay is required for a daily trigger.")
    if not isinstance(value, str) or not _TIME_OF_DAY.match(value):
        raise BadRequestError("timeOfDay must be a time of day as HH:MM.")


def _validate_weekdays(weekdays: Any) -> None:
    if not isinstance(weekdays, list):
        raise BadRequestError("weekdays must be an array.")
    for day in weekdays:
        if isinstance(day, bool) or not isinstance(day, int):
            raise BadRequestError("weekdays must contain only integers.")
        if day < 0 or day > 6:
            raise BadRequestError("weekdays must contain only values from 0 to 6.")
    if len(set(weekdays)) != len(weekdays):
        raise BadRequestError("weekdays must not contain duplicates.")


def _validate_timezone(timezone: Any) -> None:
    if not isinstance(timezone, str):
        raise BadRequestError("timezone must be a string.")
    try:
        ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise BadRequestError(f'Unknown timezone "{timezone}".') from None


def normalize_schedule(fields: dict[str, Any], kind: str) -> dict[str, Any]:
    """Blank the fields the other kind owns.

    Without this an interval trigger patched over from daily keeps a stale
    timeOfDay, and the schedule the user reads back is not the one that fires.
    """
    if kind == "interval":
        return {**fields, "time_of_day": None, "weekdays": []}
    return {**fields, "interval_minutes": None}
