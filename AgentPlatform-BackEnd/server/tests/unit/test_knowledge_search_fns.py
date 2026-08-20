"""The scoring both repository implementations share.

These are pure functions, so they are tested here once rather than twice
through each backend.
"""

from app.modules.knowledge.search import collapse_whitespace, score, snippet, terms

BODY = (
    "Refunds are available within 30 days of the invoice date. "
    "After that the charge stands and the policy window has closed."
)


def test_terms_drops_words_shorter_than_three_characters():
    assert terms("is a refund of ok") == ["refund"]


def test_terms_lowercases():
    assert terms("REFUND Window") == ["refund", "window"]


def test_score_is_zero_when_the_query_has_no_usable_terms():
    assert score("is a of", "Refunds", BODY) == 0.0


def test_score_is_one_when_every_term_matches():
    assert score("refund invoice", "Refunds — 30 day window", BODY) == 1.0


def test_score_is_the_matching_fraction():
    assert score("refund bicycle", "Refunds — 30 day window", BODY) == 0.5


def test_score_matches_the_title_as_well_as_the_body():
    assert score("proration", "Proration on downgrade", "Nothing relevant here.") == 1.0


def test_collapse_whitespace_flattens_runs_and_trims():
    assert collapse_whitespace("  a\n\n  b\tc  ") == "a b c"


def test_snippet_returns_the_whole_body_when_it_is_short_enough():
    assert snippet("Short enough.", "short") == "Short enough."


def test_snippet_collapses_markdown_blank_lines():
    assert snippet("# Title\n\n\nBody text.", "body") == "# Title Body text."


def test_snippet_centres_on_the_first_matching_term():
    body = ("x" * 400) + " unicorn " + ("y" * 400)
    result = snippet(body, "unicorn", max_chars=100)
    assert "unicorn" in result
    assert result.startswith("…")
    assert result.endswith("…")
    assert len(result) <= 102


def test_snippet_falls_back_to_the_leading_characters_when_nothing_matches():
    body = "z" * 400
    result = snippet(body, "unicorn", max_chars=100)
    assert result == ("z" * 100) + "…"


def test_snippet_at_the_very_end_still_gets_a_full_window():
    body = ("x" * 400) + " unicorn"
    result = snippet(body, "unicorn", max_chars=100)
    assert result.endswith("unicorn")
    assert result.startswith("…")
