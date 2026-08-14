"""Turning an upstream failure into a sentence a person can act on.

The provider raises whatever the vendor SDK raised: a 429 carries a JSON body
with billing and docs URLs inside it, and that string used to be interpolated
straight into the chat answer. It reads as a stack trace to the one person who
cannot do anything about it, so the classification happens here and the raw text
goes to the log instead.

No ADK import, so the mapping stays testable without the optional extra.
"""

_QUOTA = "The model is out of quota right now. Try again in a few minutes."
_CREDENTIALS = "The model provider rejected its credentials. Check the server's API key."
_TIMEOUT = "The model took too long to answer. Try again."
_UNAVAILABLE = "The model provider is unavailable right now. Try again shortly."
_UNKNOWN = "The model could not answer. Try again."

# Matched against the lowercased exception text. Order matters: the first
# matching row wins, so the specific diagnoses sit above the generic ones.
_SIGNATURES: list[tuple[tuple[str, ...], str]] = [
    (("resource_exhausted", "429", "quota", "rate limit", "credits are depleted"), _QUOTA),
    (
        ("permission_denied", "unauthenticated", "api key", "401", "403", "invalid_api_key"),
        _CREDENTIALS,
    ),
    (("deadline exceeded", "timed out", "timeout"), _TIMEOUT),
    (("unavailable", "503", "500", "internal error", "overloaded"), _UNAVAILABLE),
]


def provider_message(exc: BaseException) -> str:
    """One short sentence, never the upstream text.

    Returning the exception verbatim would leak billing URLs, internal trace
    links, and occasionally the prompt, so no branch here interpolates `exc`.
    """
    if isinstance(exc, TimeoutError):
        return _TIMEOUT

    haystack = f"{type(exc).__name__} {exc}".lower()
    for needles, message in _SIGNATURES:
        if any(needle in haystack for needle in needles):
            return message
    return _UNKNOWN
