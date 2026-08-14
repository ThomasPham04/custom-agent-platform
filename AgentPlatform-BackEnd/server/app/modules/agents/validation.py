"""Agent write validation — the contract's field rules and its exact messages.

Every string in this module is transcribed from
docs/superpowers/references/express-contract-reference.md §4 and asserted
character for character by tests/contract/test_agents.py. Do not reword them.

The order of the checks is contract too: the six string fields in the order
below, then model, then status, then the toolIds checks. A body that breaks two
rules must report the earlier one.

This module deliberately takes the valid model ids and tool ids as arguments.
agents/ must not import llm/catalog or the tool catalog (spec §4.2).
"""

from typing import Any

from app.core.errors import BadRequestError
from app.core.text import js_length

# (wire field name, max length), in validation order.
WRITABLE_STRING_FIELDS: tuple[tuple[str, int], ...] = (
    ("name", 120),
    ("icon", 32),
    ("description", 2000),
    ("model", 64),
    ("systemPrompt", 20_000),
    ("status", 16),
)

_STATUSES = ("active", "draft")

# Wire spelling → Python spelling. Fields not listed here are already identical.
_TO_SNAKE = {"systemPrompt": "system_prompt", "toolIds": "tool_ids"}

WRITABLE_KEYS = frozenset({name for name, _ in WRITABLE_STRING_FIELDS} | {"toolIds"})


def validate_agent_write(
    body: Any,
    *,
    model_ids: set[str],
    known_tool_ids: set[str],
) -> dict[str, Any]:
    """Validate a create or patch body and return the writable fields, snake_cased.

    Keys outside the writable set — including the server-owned `id`, `createdAt`
    and `updatedAt` — are dropped silently rather than rejected (contract §4).
    """
    if body is None:
        body = {}
    # bool is a subclass of int, but neither is a dict, so the isinstance check
    # below rejects both without a special case.
    if not isinstance(body, dict):
        raise BadRequestError("Request body must be a JSON object.")

    for field, limit in WRITABLE_STRING_FIELDS:
        if field not in body:
            continue
        value = body[field]
        if not isinstance(value, str):
            raise BadRequestError(f"{field} must be a string.")
        if js_length(value) > limit:
            raise BadRequestError(f"{field} must be at most {limit} characters.")

    if "model" in body and body["model"] not in model_ids:
        raise BadRequestError(f'Unknown model "{body["model"]}".')

    if "status" in body and body["status"] not in _STATUSES:
        raise BadRequestError(f'Unknown status "{body["status"]}".')

    if "toolIds" in body:
        _validate_tool_ids(body["toolIds"], known_tool_ids)

    return {_TO_SNAKE.get(key, key): value for key, value in body.items() if key in WRITABLE_KEYS}


def _validate_tool_ids(tool_ids: Any, known_tool_ids: set[str]) -> None:
    if not isinstance(tool_ids, list):
        raise BadRequestError("toolIds must be an array.")
    if any(not isinstance(t, str) for t in tool_ids):
        raise BadRequestError("toolIds must contain only strings.")
    if len(tool_ids) > len(known_tool_ids):
        raise BadRequestError(f"toolIds must contain at most {len(known_tool_ids)} items.")
    if len(set(tool_ids)) != len(tool_ids):
        raise BadRequestError("toolIds must not contain duplicates.")
    unknown = [t for t in tool_ids if t not in known_tool_ids]
    if unknown:
        raise BadRequestError(f"Unknown tool ids: {', '.join(unknown)}.")
