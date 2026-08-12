"""Agent Management HTTP surface.

The write routes take the raw request body rather than a pydantic body model.
Three contract rules are unreachable through a declared body parameter: an
absent body must behave as {}, a JSON array must return "Request body must be a
JSON object.", and the field messages and their order must match Express exactly
(contract reference §4). validation.py owns all three; the schemas below stay as
the documented request shape for /docs.
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from app.container import get_agent_service
from app.core.errors import BadRequestError
from app.modules.agents.schemas import Agent, AgentCreate, AgentPatch
from app.modules.agents.service import AgentService

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _documented_body(model: type[AgentCreate]) -> dict[str, Any]:
    """FastAPI infers the request schema from the signature, and this router's
    signature is a raw Request. Declaring it here keeps /docs accurate.

    The doc models type every field `str | None` to mark it optional, which
    pydantic renders as `anyOf: [string, null]`. That would advertise
    `{"name": null}` as valid when the validator answers `name must be a
    string.`, so the null branch is dropped: these fields may be omitted, but
    never sent as null.
    """
    schema = model.model_json_schema()
    for prop in schema.get("properties", {}).values():
        variants = [v for v in prop.get("anyOf", []) if v.get("type") != "null"]
        if len(variants) == 1:
            prop.pop("anyOf")
            prop.update(variants[0])
    return {
        "requestBody": {
            "content": {"application/json": {"schema": schema}}
        }
    }


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


async def _json_body(request: Request) -> Any:
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


@router.get("", response_model=list[Agent])
async def list_agents(svc: AgentService = Depends(get_agent_service)) -> list[Agent]:
    return await svc.list()


@router.post(
    "",
    response_model=Agent,
    status_code=201,
    openapi_extra=_documented_body(AgentCreate),
)
async def create_agent(
    request: Request, svc: AgentService = Depends(get_agent_service)
) -> Agent:
    return await svc.create(await _json_body(request))


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str, svc: AgentService = Depends(get_agent_service)) -> Agent:
    return await svc.get(agent_id)


@router.patch(
    "/{agent_id}",
    response_model=Agent,
    openapi_extra=_documented_body(AgentPatch),
)
async def update_agent(
    agent_id: str, request: Request, svc: AgentService = Depends(get_agent_service)
) -> Agent:
    return await svc.update(agent_id, await _json_body(request))


@router.delete("/{agent_id}", status_code=204, response_class=Response)
async def delete_agent(agent_id: str, svc: AgentService = Depends(get_agent_service)) -> None:
    await svc.delete(agent_id)
