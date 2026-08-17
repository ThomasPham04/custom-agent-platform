from fastapi import APIRouter, Depends, Query, Response

from app.container import get_run_service
from app.core.errors import BadRequestError
from app.modules.runs.schemas import Run
from app.modules.runs.service import RunService

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=list[Run])
async def list_runs(
    agent_id: str | None = Query(default=None, alias="agentId"),
    session_id: str | None = Query(default=None, alias="sessionId"),
    limit: int = Query(default=50, ge=1, le=200),
    svc: RunService = Depends(get_run_service),
) -> list[Run]:
    if agent_id is not None and session_id is not None:
        raise BadRequestError("Pass agentId or sessionId, not both.")
    if session_id is not None:
        return await svc.list_by_session(session_id=session_id, limit=limit)
    return await svc.list(agent_id=agent_id, limit=limit)


@router.delete("", status_code=204, response_class=Response)
async def delete_runs(
    agent_id: str | None = Query(default=None, alias="agentId"),
    svc: RunService = Depends(get_run_service),
) -> None:
    # Deliberately asymmetric with GET, where omitting agentId means "every
    # agent". On a delete that default would erase the whole history, so the
    # parameter is required and a missing one is a client error.
    if agent_id is None:
        raise BadRequestError("agentId is required.")
    await svc.delete_by_agent(agent_id)


@router.get("/{run_id}", response_model=Run)
async def get_run(run_id: str, svc: RunService = Depends(get_run_service)) -> Run:
    return await svc.get(run_id)
