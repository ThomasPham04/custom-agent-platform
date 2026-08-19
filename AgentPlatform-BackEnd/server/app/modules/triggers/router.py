from typing import Any

from fastapi import APIRouter, Body, Depends, Query, Response

from app.container import get_trigger_service
from app.modules.runs.schemas import Run
from app.modules.triggers.schemas import Trigger
from app.modules.triggers.service import TriggerService

router = APIRouter(prefix="/api/triggers", tags=["triggers"])


@router.get("", response_model=list[Trigger])
async def list_triggers(
    agent_id: str | None = Query(default=None, alias="agentId"),
    limit: int = Query(default=50, ge=1, le=200),
    svc: TriggerService = Depends(get_trigger_service),
) -> list[Trigger]:
    return await svc.list(agent_id=agent_id, limit=limit)


@router.post("", response_model=Trigger, status_code=201)
async def create_trigger(
    # Body(default=None) rather than a model: the contract's messages and their
    # order are unreachable through pydantic's own validation.
    body: Any = Body(default=None),
    svc: TriggerService = Depends(get_trigger_service),
) -> Trigger:
    return await svc.create(body)


@router.get("/{trigger_id}", response_model=Trigger)
async def get_trigger(
    trigger_id: str, svc: TriggerService = Depends(get_trigger_service)
) -> Trigger:
    return await svc.get(trigger_id)


@router.patch("/{trigger_id}", response_model=Trigger)
async def update_trigger(
    trigger_id: str,
    body: Any = Body(default=None),
    svc: TriggerService = Depends(get_trigger_service),
) -> Trigger:
    return await svc.update(trigger_id, body)


@router.delete("/{trigger_id}", status_code=204, response_class=Response)
async def delete_trigger(
    trigger_id: str, svc: TriggerService = Depends(get_trigger_service)
) -> None:
    await svc.delete(trigger_id)


@router.post("/{trigger_id}/run", response_model=Run)
async def run_trigger_now(
    trigger_id: str, svc: TriggerService = Depends(get_trigger_service)
) -> Run:
    return await svc.run_now(trigger_id)
