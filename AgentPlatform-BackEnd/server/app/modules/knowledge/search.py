"""Scoring and excerpting for the knowledge library.

Pure functions, no I/O, no repository imports. Both repository
implementations call these, which is what keeps the memory store and Postgres
ranking identically — a behaviour that holds in one and not the other is a bug
that reaches production looking like a frontend problem.
"""

import re

# Two characters or fewer match inside almost every document and only flatten
# the ranking, so they are dropped from the query.
MIN_TERM_LENGTH = 3
SNIPPET_MAX_CHARS = 300

_WHITESPACE = re.compile(r"\s+")


def collapse_whitespace(value: str) -> str:
    """Runs of whitespace become one space, and the ends are trimmed.

    A Markdown document is mostly blank lines; without this a snippet of it
    is mostly nothing.
    """
    return _WHITESPACE.sub(" ", value).strip()


def terms(query: str) -> list[str]:
    """The query words worth matching, lower-cased."""
    return [t for t in query.lower().split() if len(t) >= MIN_TERM_LENGTH]


def score(query: str, title: str, body: str) -> float:
    """Term overlap normalised by query length, rounded to two places.

    Transcribed from the fixed-corpus scorer this replaces, so the seeded demo
    documents keep the scores the mock fixture was written against.
    """
    found = terms(query)
    if not found:
        return 0.0
    haystack = f"{title} {body}".lower()
    hits = sum(1 for term in found if term in haystack)
    return round(hits / len(found), 2)


def snippet(body: str, query: str, max_chars: int = SNIPPET_MAX_CHARS) -> str:
    """An excerpt centred on the first matching term.

    Falls back to the leading characters when nothing matches, so a document
    that scored on its title alone still returns text rather than an empty
    string.
    """
    flat = collapse_whitespace(body)
    if len(flat) <= max_chars:
        return flat

    lowered = flat.lower()
    at = -1
    for term in terms(query):
        found = lowered.find(term)
        if found != -1:
            at = found
            break

    if at == -1:
        return f"{flat[:max_chars]}…"

    start = max(0, at - max_chars // 2)
    end = min(len(flat), start + max_chars)
    # Pulled back from the right edge so a match near the end of the document
    # still gets a full-width window rather than a truncated one.
    start = max(0, end - max_chars)
    excerpt = flat[start:end].strip()
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(flat) else ""
    return f"{prefix}{excerpt}{suffix}"
