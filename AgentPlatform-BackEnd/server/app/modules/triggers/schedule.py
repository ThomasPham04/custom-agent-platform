"""Next-fire computation.

Pure and total: no I/O, no repository, no clock. Everything the caller needs is
the trigger and the instant to search forward from, which is what lets the only
subtle logic in this feature be read on its own.

`after` must be timezone-aware. Both callers pass app.core.clock.now(), which is
UTC-aware.
"""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.modules.triggers.schemas import Trigger

# One day of minutes is far more than any real daylight saving gap, which is at
# most a few hours. The bound exists so a malformed zone cannot spin forever.
_GAP_SEARCH_MINUTES = 24 * 60


def next_run_at(trigger: Trigger, after: datetime) -> datetime:
    """The first instant strictly after `after` at which this trigger fires."""
    if trigger.kind == "interval":
        # Anchored on the firing rather than on the previous due time. That is
        # what collapses a backlog: after downtime the scheduler passes the
        # current instant, so the trigger fires once and resumes from now.
        minutes = trigger.interval_minutes or 1
        return after + timedelta(minutes=minutes)
    return _next_daily(trigger, after)


def _next_daily(trigger: Trigger, after: datetime) -> datetime:
    zone = ZoneInfo(trigger.timezone)
    local = after.astimezone(zone)
    hour, minute = (int(part) for part in (trigger.time_of_day or "00:00").split(":"))
    # An empty list means every day.
    allowed = set(trigger.weekdays) or set(range(7))

    # Eight days rather than seven: today may already be past its firing time, so
    # the same weekday one week later has to stay reachable.
    for offset in range(8):
        day = (local + timedelta(days=offset)).date()
        if day.weekday() not in allowed:
            continue
        candidate = _resolve(datetime.combine(day, time(hour, minute)), zone)
        if candidate > after:
            return candidate

    # Unreachable: `allowed` is non-empty, so one of eight consecutive days
    # matches. Guarded because the alternative is returning None into a column
    # that is not nullable while enabled.
    raise ValueError(f"No firing found for trigger {trigger.id}.")


def _resolve(naive: datetime, zone: ZoneInfo) -> datetime:
    """Attach `zone`, answering both daylight saving edges explicitly.

    fold=0 is the default, which picks the FIRST pass of a time that occurs
    twice because the clocks fell back.

    A time that does not exist at all because the clocks sprang forward cannot
    be fixed by a flag: it is skipped, so this walks forward to the first
    instant that does exist.
    """
    aware = naive.replace(tzinfo=zone)
    if _exists(aware, zone):
        return aware

    probe = aware
    for _ in range(_GAP_SEARCH_MINUTES):
        # Arithmetic on an aware datetime moves the wall clock, which is what
        # walking out of a gap needs.
        probe += timedelta(minutes=1)
        if _exists(probe, zone):
            return probe
    raise ValueError(f"No valid instant near {naive} in {zone}.")


def _exists(aware: datetime, zone: ZoneInfo) -> bool:
    """Whether this wall-clock time occurs in this zone.

    Comparing the aware values directly would always be true: `==` on aware
    datetimes compares instants, and a round trip preserves the instant by
    definition. The wall-clock fields are what differ for a skipped time, so
    tzinfo is stripped before the comparison.
    """
    round_tripped = aware.astimezone(UTC).astimezone(zone)
    return round_tripped.replace(tzinfo=None) == aware.replace(tzinfo=None)
