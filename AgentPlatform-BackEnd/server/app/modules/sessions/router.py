from typing import Any

from fastapi import APIRouter, Body, Depends, Query, Response

from app.container import get_session_service
from app.modules.sessions.schemas import Session
from app.modules.sessions.service import SessionService
from app.modules.sessions.validation import validate_session_write

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=list[Session])
async def list_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    svc: SessionService = Depends(get_session_service),
) -> list[Session]:
    return await svc.list(limit=limit)


@router.patch("/{session_id}", response_model=Session)
async def rename_session(
    session_id: str,
    # Body(default=None) rather than a model: the contract's messages and its
    # trimming rules are unreachable through pydantic's own validation.
    body: Any = Body(default=None),
    svc: SessionService = Depends(get_session_service),
) -> Session:
    # Body first, unlike PATCH /api/agents/{id}, which looks the row up first so
    # a patch to a deleted agent reports 404 rather than a validation error. The
    # orders differ only when the id is unknown *and* the body is invalid, which
    # answers 400 here and 404 there. Sessions are renamed from a list the client
    # already holds, so a bad body is the likelier mistake and naming it is the
    # more useful answer. Recorded rather than aligned: the messages are
    # transcribed from the agents module, the precedence deliberately is not.
    fields = validate_session_write(body)
    return await svc.rename(session_id, fields["title"])


@router.delete("/{session_id}", status_code=204, response_class=Response)
async def delete_session(
    session_id: str, svc: SessionService = Depends(get_session_service)
) -> None:
    await svc.delete(session_id)
