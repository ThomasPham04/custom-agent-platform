"""Agent Execution HTTP surface.

The route takes the raw request body for the same reasons agents/router.py does:
the contract's messages and its whitespace and bool rules are unreachable through
a declared pydantic body parameter, and core/http.json_body is the only parser
carrying the media-type, strict-mode and lone-surrogate protections.
"""

from typing import Any

from fastapi import APIRouter, Depends, Request

from app.container import get_execution_service
from app.core.http import json_body
from app.modules.execution.schemas import MessageEnvelope, MessageRequest
from app.modules.execution.service import ExecutionService
from app.modules.execution.validation import validate_message_request

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _documented_body() -> dict[str, Any]:
    """FastAPI infers the request schema from the signature, and this signature
    is a raw Request. Declaring it here keeps /docs accurate."""
    return {
        "requestBody": {
            "content": {
                "application/json": {"schema": MessageRequest.model_json_schema()}
            }
        }
    }


@router.post(
    "/{agent_id}/messages",
    response_model=MessageEnvelope,
    # A failed call carries no `result` key and an ok call carries no `error`
    # key (contract §5). Pydantic emits both as null without this.
    response_model_exclude_none=True,
    openapi_extra=_documented_body(),
)
async def create_message(
    agent_id: str,
    request: Request,
    svc: ExecutionService = Depends(get_execution_service),
) -> MessageEnvelope:
    payload = validate_message_request(await json_body(request))
    message = await svc.send_message(agent_id, payload)
    return MessageEnvelope(message=message)
