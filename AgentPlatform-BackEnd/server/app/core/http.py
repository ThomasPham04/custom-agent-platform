"""Body parsing that matches express.json().

Lives in core/ because two routers need identical semantics. A second, weaker
parser on one endpoint is how the lone-surrogate 500 found in the agent
management review would come back on a different route.
"""

import json
from typing import Any

from fastapi import Request

from app.core.errors import BadRequestError


def _has_unencodable_text(value: Any) -> bool:
    """True if any string in the parsed body cannot be encoded as UTF-8.

    JSON text exchanged between systems must be UTF-8 (RFC 8259 §8.1), but a
    `\\ud800` escape parses into a lone surrogate that is not. Node replaced
    such characters with U+FFFD when writing the response, so Express never
    failed; Python raises at serialization time, which would turn a write into
    a 500 well after the agent had been stored. Rejecting at the door is the
    recorded choice.
    """
    if isinstance(value, str):
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            return True
        return False
    if isinstance(value, dict):
        return any(
            _has_unencodable_text(k) or _has_unencodable_text(v) for k, v in value.items()
        )
    if isinstance(value, list):
        return any(_has_unencodable_text(item) for item in value)
    return False


def _is_json_media_type(request: Request) -> bool:
    """express.json() parses only application/json — its `type` default.

    A text/plain body was therefore never read, and req.body stayed undefined.
    That is more than a parity detail: a text/plain POST is CORS-safelisted, so
    parsing one would let an origin outside CORS_ORIGIN write an agent without
    ever tripping a preflight.

    The match is exact. type-is only honours a `+json` structured suffix when
    the *expected* type carries one (`*/*+json`), so express.json()'s default
    ignored application/merge-patch+json and everything like it. Parameters are
    dropped, because `application/json; charset=utf-8` did match.
    """
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    return media_type == "application/json"


def _reject_constant(name: str) -> Any:
    """JSON has no NaN or Infinity, but Python's json accepts both by default."""
    raise ValueError(f"Unexpected constant {name} in JSON body.")


async def json_body(request: Request) -> Any:
    """Parse the body the way Express's json parser did.

    Three behaviours are inherited from express.json(), and each one rejects
    input that a plain json.loads would happily accept:

    - a body that is absent, or not sent as JSON, is {} rather than an error
    - body-parser runs in strict mode, so the first non-whitespace byte must
      open an object or an array. That is what rejects `null`, bare numbers and
      strings, and a whitespace-only body, none of which may create an agent
    - NaN and Infinity are not JSON

    Everything else that fails to parse carries the verbatim Express message,
    the same one core/errors.py produces for FastAPI's own json_invalid path.
    """
    raw = await request.body()
    if not raw or not _is_json_media_type(request):
        return {}

    stripped = raw.lstrip()
    if not stripped or chr(stripped[0]) not in ("{", "["):
        raise BadRequestError("Malformed JSON body.")

    try:
        body = json.loads(raw, parse_constant=_reject_constant)
    except ValueError as exc:
        raise BadRequestError("Malformed JSON body.") from exc

    if _has_unencodable_text(body):
        raise BadRequestError("Malformed JSON body.")
    return body
