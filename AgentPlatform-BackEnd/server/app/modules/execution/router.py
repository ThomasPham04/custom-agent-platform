from fastapi import APIRouter, Depends

from app.container import get_execution_service
from app.modules.execution.schemas import MessageEnvelope, MessageRequest
from app.modules.execution.service import ExecutionService

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/{agent_id}/messages", response_model=MessageEnvelope)
async def create_message(
    agent_id: str,
    payload: MessageRequest,
    svc: ExecutionService = Depends(get_execution_service),
) -> MessageEnvelope:
    message = await svc.send_message(agent_id, payload)
    return MessageEnvelope(message=message)
