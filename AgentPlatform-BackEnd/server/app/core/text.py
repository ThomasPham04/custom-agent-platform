"""String measurement that matches JavaScript rather than Python.

Two modules need this: agent field limits and the chat content limit were both
written against JS `String.length`, and the frontend's live character counters
still count that way.
"""


def js_length(value: str) -> int:
    """Length in UTF-16 code units, the unit JavaScript's String.length uses.

    Python's len() counts code points, so an emoji costs 1 here and 2 there.

    surrogatepass because a `\\ud800` escape parses into a lone surrogate that
    strict UTF-16 refuses to encode. JavaScript counts it as the one code unit
    it is, and a length check must never be the thing that raises.
    """
    return len(value.encode("utf-16-le", errors="surrogatepass")) // 2
