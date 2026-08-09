from fastapi import APIRouter, Depends, Query

from app.container import get_run_service
from app.modules.runs.schemas import Run
from app.modules.runs.service import RunService

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=list[Run])
async def list_runs(
    agent_id: str | None = Query(default=None, alias="agentId"),
    limit: int = Query(default=50, ge=1, le=200),
    svc: RunService = Depends(get_run_service),
) -> list[Run]:
    return await svc.list(agent_id=agent_id, limit=limit)


@router.get("/{run_id}", response_model=Run)
async def get_run(run_id: str, svc: RunService = Depends(get_run_service)) -> Run:
    return await svc.get(run_id)
