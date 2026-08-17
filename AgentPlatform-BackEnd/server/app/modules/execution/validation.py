"""Chat body validation — the contract's rules and its exact messages.

Transcribed from docs/superpowers/references/express-contract-reference.md §5,
"Chat request validation". The strings are asserted character for character.

MessageRequest's pydantic constraints cannot express these rules, and on two of
them pydantic is not merely differently worded but wrong: Field(min_length=1)
accepts a whitespace-only string, and lax bool coercion turns retry="yes" into
True. Both must be 400s.
"""

from typing import Any

from app.core.errors import BadRequestError
from app.core.text import js_length
from app.modules.execution.schemas import MessageRequest

MAX_CONTENT = 10_000


def validate_message_request(body: Any) -> MessageRequest:
    """Validate a chat body and return it as a MessageRequest.

    Order is contract: the content checks run first, then retry. A body that
    breaks both reports content (recorded choice — the reference is silent).
    """
    if not isinstance(body, dict):
        raise BadRequestError("Request body must be a JSON object.")

    content = body.get("content")
    # `True` must not slip through a truthiness check, so the type is tested
    # explicitly rather than inferred from the value.
    if not isinstance(content, str):
        raise BadRequestError("content must be a non-empty string.")

    # Trimmed once, and both checks then read the trimmed value — which is also
    # the value that gets stored. Measuring the untrimmed string would reject a
    # message whose stored form is inside the limit, and would apply the blank
    # rule and the length rule to two different strings.
    trimmed = content.strip()
    if not trimmed:
        raise BadRequestError("content must be a non-empty string.")
    if js_length(trimmed) > MAX_CONTENT:
        raise BadRequestError(f"content must be at most {MAX_CONTENT} characters.")

    retry = body.get("retry", False)
    if not isinstance(retry, bool):
        raise BadRequestError("retry must be a boolean.")

    session_id = body.get("sessionId")
    if session_id is not None and not isinstance(session_id, str):
        raise BadRequestError("sessionId must be a string.")

    return MessageRequest(content=trimmed, retry=retry, session_id=session_id)
