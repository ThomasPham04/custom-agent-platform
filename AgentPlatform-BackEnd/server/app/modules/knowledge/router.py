from typing import Any

from fastapi import APIRouter, Body, Depends, Query, Response

from app.container import get_knowledge_service
from app.modules.knowledge.schemas import (
    KnowledgeDocument,
    KnowledgeDocumentSummary,
    to_summary,
)
from app.modules.knowledge.service import KnowledgeService
from app.modules.knowledge.validation import validate_document_write

router = APIRouter(prefix="/api/knowledge/documents", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeDocumentSummary])
async def list_documents(
    limit: int = Query(default=100, ge=1, le=500),
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> list[KnowledgeDocumentSummary]:
    # Projected here rather than in the repository so both backends return one
    # shape and the contract suite holds them to it.
    return [to_summary(d) for d in await svc.list(limit=limit)]


@router.post("", response_model=KnowledgeDocument, status_code=201)
async def create_document(
    # Body(default=None) rather than a model: the contract's messages and its
    # trimming rules are unreachable through pydantic's own validation.
    body: Any = Body(default=None),
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> KnowledgeDocument:
    fields = validate_document_write(
        body, partial=False, max_body_bytes=svc.max_body_bytes
    )
    return await svc.create(fields)


@router.get("/{document_id}", response_model=KnowledgeDocument)
async def get_document(
    document_id: str,
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> KnowledgeDocument:
    return await svc.get(document_id)


@router.patch("/{document_id}", response_model=KnowledgeDocument)
async def update_document(
    document_id: str,
    body: Any = Body(default=None),
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> KnowledgeDocument:
    # Body first, matching PATCH /api/sessions/{id}: a document is edited from
    # a list the client already holds, so a bad body is the likelier mistake
    # and naming it is the more useful answer.
    fields = validate_document_write(
        body, partial=True, max_body_bytes=svc.max_body_bytes
    )
    return await svc.update(document_id, fields)


@router.delete("/{document_id}", status_code=204, response_class=Response)
async def delete_document(
    document_id: str,
    svc: KnowledgeService = Depends(get_knowledge_service),
) -> None:
    await svc.delete(document_id)
