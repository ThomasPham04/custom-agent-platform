"""Session write validation.

Every message is transcribed from app/modules/agents/validation.py so the two
surfaces read identically to a client. Order is contract: type, then length,
then emptiness.
"""

from typing import Any

from app.core.errors import BadRequestError
from app.core.text import js_length

MAX_TITLE_LENGTH = 120


def validate_session_write(body: Any) -> dict[str, Any]:
    """Validate a rename body and return the writable fields.

    Keys outside the writable set — including the server-owned id, agentId,
    createdAt and updatedAt — are dropped silently rather than rejected.
    """
    if body is None:
        body = {}
    if not isinstance(body, dict):
        raise BadRequestError("Request body must be a JSON object.")

    if "title" in body:
        value = body["title"]
        if not isinstance(value, str):
            raise BadRequestError("title must be a string.")
        if js_length(value) > MAX_TITLE_LENGTH:
            raise BadRequestError(
                f"title must be at most {MAX_TITLE_LENGTH} characters."
            )
        trimmed = value.strip()
        if trimmed:
            return {"title": trimmed}

    raise BadRequestError("title is required.")
