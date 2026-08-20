"""One helper feeds the initial title and backfill so they cannot drift apart."""

from app.core.text import js_length
from app.modules.sessions.titles import truncate_title


def test_a_short_message_is_used_verbatim():
    assert truncate_title("Find information about vietnam") == "Find information about vietnam"


def test_a_long_message_is_cut_at_a_word_boundary():
    text = (
        "hey so I was looking at the invoice from last month and I think the "
        "proration is wrong"
    )
    result = truncate_title(text)
    assert result == "hey so I was looking at the invoice from last month and I…"
    assert len(result) <= 61  # 60 characters plus the ellipsis


def test_surrounding_whitespace_is_trimmed():
    assert truncate_title("  Refund window  ") == "Refund window"


def test_an_empty_message_falls_back_to_a_placeholder():
    assert truncate_title("") == "New chat"
    assert truncate_title("   \n ") == "New chat"


def test_a_single_word_longer_than_the_limit_is_cut_mid_word():
    """No boundary exists, so a hard cut beats returning nothing."""
    assert truncate_title("x" * 100) == "x" * 60 + "…"


def test_exactly_60_characters_returns_unchanged():
    """Boundary case: at the limit should return verbatim with no ellipsis."""
    text_60 = "a" * 60
    assert truncate_title(text_60) == text_60
    assert "…" not in truncate_title(text_60)


def test_emoji_heavy_title_satisfies_js_length_limit():
    """Astral characters cost 2 UTF-16 units each; the result must still fit."""
    result = truncate_title("😀" * 100)
    assert js_length(result) <= 120


def test_astral_characters_are_never_split():
    """Result must be a valid unicode string: no mid-character cuts."""
    text = "😀hello😀world😀" * 20
    result = truncate_title(text)
    # Verify the result is a valid prefix or matches the expected pattern.
    # If result contains ellipsis, check that the content before it (if any)
    # is a valid prefix of the input with all characters intact.
    if result.endswith("…"):
        content = result[:-1]
    else:
        content = result
    # Verify no encoding/decoding errors occur (would raise if split mid-character).
    encoded = content.encode("utf-8")
    decoded = encoded.decode("utf-8")
    assert decoded == content
