"""Knowledge document write validation.

Every message is transcribed from app/modules/sessions/validation.py, which
transcribed them from app/modules/agents/validation.py, so all three surfaces
read identically to a client. Order is contract: title type, title length,
body type, body length, source, then the required checks.

The two limits use different units on purpose. title is capped in UTF-16 code
units because the frontend's character counter counts that way; body is capped
in UTF-8 bytes because that limit exists to bound storage and request size,
not to bound what a user can read. Each message names its own unit.
"""

from typing import Any

from app.core.errors import BadRequestError
from app.core.text import js_length

MAX_TITLE_LENGTH = 200
SOURCES = ("typed", "upload", "seed")

# source is deliberately absent: it is accepted on create and dropped from a
# patch, so that a document cannot be relabelled "seed" after the fact.
WRITABLE_KEYS = frozenset({"title", "body"})


def validate_document_write(
    body: Any, *, partial: bool, max_body_bytes: int
) -> dict[str, Any]:
    """Validate a create or patch body and return the writable fields.

    Keys outside the writable set — including the server-owned id, createdAt
    and updatedAt — are dropped silently rather than rejected, matching the
    agent rule.
    """
    if body is None:
        body = {}
    # bool is a subclass of int, but neither is a dict, so this rejects both
    # without a special case.
    if not isinstance(body, dict):
        raise BadRequestError("Request body must be a JSON object.")

    if "title" in body:
        title = body["title"]
        if not isinstance(title, str):
            raise BadRequestError("title must be a string.")
        if js_length(title) > MAX_TITLE_LENGTH:
            raise BadRequestError(
                f"title must be at most {MAX_TITLE_LENGTH} characters."
            )

    if "body" in body:
        text = body["body"]
        if not isinstance(text, str):
            raise BadRequestError("body must be a string.")
        if len(text.encode("utf-8")) > max_body_bytes:
            raise BadRequestError(f"body must be at most {max_body_bytes} bytes.")

    if not partial and "source" in body and body["source"] not in SOURCES:
        raise BadRequestError(f'Unknown source "{body["source"]}".')

    fields = {
        key: value.strip() if isinstance(value, str) else value
        for key, value in body.items()
        if key in WRITABLE_KEYS
    }

    if partial:
        return fields

    if not fields.get("title"):
        raise BadRequestError("title is required.")
    if not fields.get("body"):
        raise BadRequestError("body is required.")
    fields["source"] = body.get("source", "typed")
    return fields
