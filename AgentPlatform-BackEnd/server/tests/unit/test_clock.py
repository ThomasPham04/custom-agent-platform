from datetime import UTC, datetime

from app.core.clock import now_iso, set_clock


def test_returns_iso_8601_utc():
    assert now_iso().endswith("+00:00")


def test_clock_can_be_frozen_for_deterministic_tests():
    set_clock(lambda: datetime(2026, 8, 8, 12, 0, 0, tzinfo=UTC))
    try:
        assert now_iso() == "2026-08-08T12:00:00+00:00"
    finally:
        set_clock(None)
