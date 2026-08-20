"""Agent Execution HTTP surface.

The route takes the raw request body for the same reasons agents/router.py does:
the contract's messages and its whitespace and bool rules are unreachable through
a declared pydantic body parameter, and core/http.json_body is the only parser
carrying the media-type, strict-mode and lone-surrogate protections.
"""

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse

from app.container import get_execution_service
from app.core.errors import AppError
from app.core.http import json_body
from app.modules.execution.schemas import MessageEnvelope, MessageRequest
from app.modules.execution.service import ExecutionService
from app.modules.execution.validation import validate_message_request
from app.modules.llm.provider import TextDelta, ToolCallFinished, ToolCallStarted

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
    message, session = await svc.send_message(agent_id, payload)
    return MessageEnvelope(message=message, session=session)


def _line(value: dict[str, Any]) -> bytes:
    return (json.dumps(jsonable_encoder(value), separators=(",", ":")) + "\n").encode()


@router.post(
    "/{agent_id}/messages/stream",
    openapi_extra=_documented_body(),
    response_class=StreamingResponse,
)
async def stream_message(
    agent_id: str,
    request: Request,
    svc: ExecutionService = Depends(get_execution_service),
) -> StreamingResponse:
    payload = validate_message_request(await json_body(request))
    created, events = await svc.stream_message(agent_id, payload)

    async def body() -> AsyncIterator[bytes]:
        if created is not None:
            yield _line(
                {
                    "type": "session",
                    "session": created.model_dump(by_alias=True, exclude_none=True),
                }
            )
        try:
            async for event in events:
                if isinstance(event, TextDelta):
                    yield _line({"type": "textDelta", "text": event.text})
                elif isinstance(event, ToolCallStarted):
                    yield _line(
                        {
                            "type": "toolStarted",
                            "call": {
                                "id": event.call_id,
                                "toolId": event.tool_id,
                                "args": event.args,
                                "durationMs": 0,
                                "status": "running",
                            },
                        }
                    )
                elif isinstance(event, ToolCallFinished):
                    yield _line(
                        {
                            "type": "toolFinished",
                            "callId": event.call_id,
                            "result": event.result,
                            "error": event.error,
                            "durationMs": event.duration_ms,
                            "status": "error" if event.error is not None else "ok",
                        }
                    )
                else:
                    yield _line(
                        {
                            "type": "done",
                            "message": event.model_dump(
                                by_alias=True, exclude_none=True
                            ),
                        }
                    )
        except AppError as exc:
            yield _line(
                {
                    "type": "error",
                    "error": {"code": exc.code, "message": exc.message},
                }
            )
        except Exception as exc:  # noqa: BLE001 - headers are already streaming
            print(f"stream failure: {exc!r}")
            yield _line(
                {
                    "type": "error",
                    "error": {
                        "code": "internal_error",
                        "message": "Something went wrong on the server.",
                    },
                }
            )

    return StreamingResponse(
        body(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
