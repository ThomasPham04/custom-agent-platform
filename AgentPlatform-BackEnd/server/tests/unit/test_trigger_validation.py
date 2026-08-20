import re
from datetime import UTC, datetime

import pytest

from app.core.errors import BadRequestError
from app.modules.triggers.schemas import Trigger
from app.modules.triggers.validation import normalize_schedule, validate_trigger_write


def make_trigger(**overrides) -> Trigger:
    values = {
        "id": "trg_existing",
        "agent_id": "agent_support",
        "name": "Daily support check",
        "message": "Check the support queue.",
        "kind": "daily",
        "interval_minutes": None,
        "time_of_day": "09:00",
        "weekdays": [0, 1, 2, 3, 4],
        "timezone": "UTC",
        "enabled": True,
        "next_run_at": datetime(2026, 8, 21, 9, 0, tzinfo=UTC),
        "last_run_at": None,
        "last_status": None,
        "last_run_id": None,
        "created_at": datetime(2026, 8, 20, 8, 0, tzinfo=UTC),
        "updated_at": datetime(2026, 8, 20, 8, 0, tzinfo=UTC),
    }
    values.update(overrides)
    return Trigger(**values)


def test_create_accepts_valid_interval_and_ignores_server_owned_fields():
    fields = validate_trigger_write(
        {
            "agentId": "agent_support",
            "kind": "interval",
            "message": "Check now.",
            "intervalMinutes": 15,
            "timezone": "Asia/Ho_Chi_Minh",
            "enabled": False,
            "id": "trg_client_owned",
            "nextRunAt": "2099-01-01T00:00:00Z",
        },
        current=None,
    )

    assert fields == {
        "agent_id": "agent_support",
        "kind": "interval",
        "message": "Check now.",
        "interval_minutes": 15,
        "timezone": "Asia/Ho_Chi_Minh",
        "enabled": False,
    }


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ([], "Request body must be a JSON object."),
        ({"kind": "daily", "message": "x", "timeOfDay": "09:00"}, "agentId is required."),
        (
            {"agentId": "agent_support", "kind": "daily", "timeOfDay": "09:00"},
            "message is required.",
        ),
        ({"agentId": "agent_support", "message": "x", "timeOfDay": "09:00"}, "kind is required."),
        (
            {"agentId": "agent_support", "kind": "weekly", "message": "x"},
            'Unknown kind "weekly".',
        ),
        (
            {"agentId": "agent_support", "kind": "interval", "message": "x"},
            "intervalMinutes is required for an interval trigger.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "interval",
                "message": "x",
                "intervalMinutes": True,
            },
            "intervalMinutes must be an integer.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "interval",
                "message": "x",
                "intervalMinutes": 0,
            },
            "intervalMinutes must be at least 1.",
        ),
        (
            {"agentId": "agent_support", "kind": "daily", "message": "x"},
            "timeOfDay is required for a daily trigger.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "daily",
                "message": "x",
                "timeOfDay": "9:00",
            },
            "timeOfDay must be a time of day as HH:MM.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "daily",
                "message": "x",
                "timeOfDay": "09:00",
                "weekdays": [0, 7],
            },
            "weekdays must contain only values from 0 to 6.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "daily",
                "message": "x",
                "timeOfDay": "09:00",
                "weekdays": [1, 1],
            },
            "weekdays must not contain duplicates.",
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "daily",
                "message": "x",
                "timeOfDay": "09:00",
                "timezone": "Mars/Olympus",
            },
            'Unknown timezone "Mars/Olympus".',
        ),
        (
            {
                "agentId": "agent_support",
                "kind": "daily",
                "message": "x",
                "timeOfDay": "09:00",
                "enabled": 1,
            },
            "enabled must be a boolean.",
        ),
    ],
)
def test_invalid_writes_report_the_contract_error(body, message):
    with pytest.raises(BadRequestError, match=f"^{re.escape(message)}$"):
        validate_trigger_write(body, current=None)


def test_patch_validates_against_the_effective_existing_schedule():
    fields = validate_trigger_write({"name": "Renamed"}, current=make_trigger())
    assert fields == {"name": "Renamed"}


def test_switching_kind_requires_the_new_kinds_schedule_field():
    with pytest.raises(
        BadRequestError,
        match="^intervalMinutes is required for an interval trigger\\.$",
    ):
        validate_trigger_write({"kind": "interval"}, current=make_trigger())


def test_normalize_schedule_clears_fields_owned_by_the_other_kind():
    assert normalize_schedule(
        {"interval_minutes": 30, "time_of_day": "09:00", "weekdays": [1]},
        "interval",
    ) == {"interval_minutes": 30, "time_of_day": None, "weekdays": []}
    assert normalize_schedule(
        {"interval_minutes": 30, "time_of_day": "09:00", "weekdays": [1]},
        "daily",
    ) == {"interval_minutes": None, "time_of_day": "09:00", "weekdays": [1]}
