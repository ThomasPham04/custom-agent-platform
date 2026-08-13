"""Agent Management HTTP surface.

The write routes take the raw request body rather than a pydantic body model.
Three contract rules are unreachable through a declared body parameter: an
absent body must behave as {}, a JSON array must return "Request body must be a
JSON object.", and the field messages and their order must match Express exactly
(contract reference §4). validation.py owns all three; the schemas below stay as
the documented request shape for /docs.
"""

from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from app.container import get_agent_service
from app.core.http import json_body
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
    return await svc.create(await json_body(request))


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
    return await svc.update(agent_id, await json_body(request))


@router.delete("/{agent_id}", status_code=204, response_class=Response)
async def delete_agent(agent_id: str, svc: AgentService = Depends(get_agent_service)) -> None:
    await svc.delete(agent_id)
