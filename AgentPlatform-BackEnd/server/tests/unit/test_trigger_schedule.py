from datetime import UTC, datetime, timedelta

from app.modules.triggers.schedule import next_run_at
from app.modules.triggers.schemas import Trigger


def make_trigger(**overrides) -> Trigger:
    values = {
        "id": "trg_schedule",
        "agent_id": "agent_support",
        "name": "Schedule",
        "message": "Run.",
        "kind": "daily",
        "interval_minutes": None,
        "time_of_day": "09:00",
        "weekdays": [],
        "timezone": "UTC",
        "enabled": True,
        "next_run_at": None,
        "last_run_at": None,
        "last_status": None,
        "last_run_id": None,
        "created_at": datetime(2026, 8, 20, 0, 0, tzinfo=UTC),
        "updated_at": datetime(2026, 8, 20, 0, 0, tzinfo=UTC),
    }
    values.update(overrides)
    return Trigger(**values)


def test_interval_is_anchored_to_the_current_firing_time():
    after = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)
    trigger = make_trigger(kind="interval", interval_minutes=15, time_of_day=None)
    assert next_run_at(trigger, after) == after + timedelta(minutes=15)


def test_daily_uses_today_when_the_wall_time_is_still_ahead():
    after = datetime(2026, 8, 20, 8, 30, tzinfo=UTC)
    assert next_run_at(make_trigger(time_of_day="09:00"), after) == datetime(
        2026, 8, 20, 9, 0, tzinfo=UTC
    )


def test_daily_moves_to_tomorrow_when_today_has_already_fired():
    after = datetime(2026, 8, 20, 9, 0, tzinfo=UTC)
    assert next_run_at(make_trigger(time_of_day="09:00"), after) == datetime(
        2026, 8, 21, 9, 0, tzinfo=UTC
    )


def test_daily_honors_weekdays_and_the_configured_timezone():
    # Thursday 23:30 UTC is Friday 06:30 in Ho Chi Minh City. A Monday-only
    # trigger therefore advances to Monday 09:00 local time.
    after = datetime(2026, 8, 20, 23, 30, tzinfo=UTC)
    result = next_run_at(
        make_trigger(time_of_day="09:00", weekdays=[0], timezone="Asia/Ho_Chi_Minh"),
        after,
    )
    assert result.astimezone(UTC) == datetime(2026, 8, 24, 2, 0, tzinfo=UTC)


def test_spring_forward_gap_moves_to_the_first_real_minute():
    after = datetime(2026, 3, 8, 6, 0, tzinfo=UTC)
    result = next_run_at(
        make_trigger(time_of_day="02:30", timezone="America/New_York"),
        after,
    )
    assert result.astimezone(UTC) == datetime(2026, 3, 8, 7, 0, tzinfo=UTC)


def test_fall_back_ambiguity_uses_the_first_occurrence():
    after = datetime(2026, 11, 1, 4, 0, tzinfo=UTC)
    result = next_run_at(
        make_trigger(time_of_day="01:30", timezone="America/New_York"),
        after,
    )
    assert result.fold == 0
    assert result.astimezone(UTC) == datetime(2026, 11, 1, 5, 30, tzinfo=UTC)
