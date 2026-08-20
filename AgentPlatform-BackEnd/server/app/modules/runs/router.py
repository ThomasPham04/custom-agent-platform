from collections.abc import AsyncGenerator
from contextlib import aclosing

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse

from app.container import get_run_service
from app.core.errors import BadRequestError
from app.modules.runs.schemas import Run
from app.modules.runs.service import RunService

router = APIRouter(prefix="/api/runs", tags=["runs"])


async def export_json(runs: AsyncGenerator[Run, None]) -> AsyncGenerator[bytes, None]:
    async with aclosing(runs):
        yield b"["
        first = True
        async for run in runs:
            if not first:
                yield b","
            yield run.model_dump_json(by_alias=True).encode()
            first = False
        yield b"]"


@router.get("/export")
async def export_runs(
    agent_id: str = Query(alias="agentId"),
    svc: RunService = Depends(get_run_service),
) -> StreamingResponse:
    return StreamingResponse(
        export_json(svc.export_by_agent(agent_id)),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="run-logs.json"'},
    )


@router.get("", response_model=list[Run])
async def list_runs(
    agent_id: str | None = Query(default=None, alias="agentId"),
    session_id: str | None = Query(default=None, alias="sessionId"),
    trigger_id: str | None = Query(default=None, alias="triggerId"),
    limit: int = Query(default=50, ge=1, le=200),
    svc: RunService = Depends(get_run_service),
) -> list[Run]:
    supplied = [p for p in (agent_id, session_id, trigger_id) if p is not None]
    if len(supplied) > 1:
        # agentId+sessionId has a documented message in the Express contract
        # reference, which outranks this feature's design spec. Widening the
        # guard to a third parameter must not reword the documented case.
        if trigger_id is None:
            raise BadRequestError("Pass agentId or sessionId, not both.")
        raise BadRequestError("Pass at most one of agentId, sessionId, triggerId.")
    if trigger_id is not None:
        return await svc.list_by_trigger(trigger_id=trigger_id, limit=limit)
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
