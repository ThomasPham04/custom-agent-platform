"""Indirection over the current time so runs and timestamps are testable."""

from collections.abc import Callable
from datetime import UTC, datetime

_clock: Callable[[], datetime] | None = None


def set_clock(fn: Callable[[], datetime] | None) -> None:
    """Freeze time for a test. Pass None to restore the real clock."""
    global _clock
    _clock = fn


def now() -> datetime:
    return _clock() if _clock else datetime.now(UTC)


def now_iso() -> str:
    return now().isoformat()
