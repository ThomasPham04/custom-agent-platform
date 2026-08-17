"""Deterministic titles.

Used for the title a session is born with, for the fallback when the model's
summary fails, and for the backfill — which runs at startup and must never
depend on a network call or an API key.
"""

from app.core.text import js_length

MAX_TITLE_CHARS = 60
MAX_TITLE_JS_LENGTH = 120
PLACEHOLDER = "New chat"


def truncate_title(text: str) -> str:
    cleaned = " ".join(text.split())
    if not cleaned:
        return PLACEHOLDER
    if len(cleaned) <= MAX_TITLE_CHARS:
        return cleaned

    head = cleaned[:MAX_TITLE_CHARS]
    boundary = head.rfind(" ")
    # A single word longer than the limit has no boundary; a hard cut beats
    # returning the placeholder for a message that does have content.
    if boundary > 0:
        head = head[:boundary]
    result = f"{head}…"

    # Astral characters (emojis, etc.) take 2 UTF-16 units but only 1 code point.
    # validate_session_write rejects titles over 120 UTF-16 units, so ensure
    # the result satisfies that constraint or the rename endpoint will reject it.
    if js_length(result) > MAX_TITLE_JS_LENGTH:
        # Drop trailing characters (preserving the ellipsis) until the result fits.
        # Start by removing the ellipsis temporarily to measure the content.
        content = result[:-1]  # Remove the ellipsis
        while js_length(content) + js_length("…") > MAX_TITLE_JS_LENGTH:
            content = content[:-1]
        result = content + "…"

    return result
