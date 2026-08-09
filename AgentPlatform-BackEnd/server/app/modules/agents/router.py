from fastapi import APIRouter, Depends, Response

from app.container import get_agent_service
from app.modules.agents.schemas import Agent, AgentCreate, AgentPatch
from app.modules.agents.service import AgentService

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[Agent])
async def list_agents(svc: AgentService = Depends(get_agent_service)) -> list[Agent]:
    return await svc.list()


@router.post("", response_model=Agent, status_code=201)
async def create_agent(
    payload: AgentCreate, svc: AgentService = Depends(get_agent_service)
) -> Agent:
    return await svc.create(payload)


@router.get("/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str, svc: AgentService = Depends(get_agent_service)) -> Agent:
    return await svc.get(agent_id)


@router.patch("/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: str, payload: AgentPatch, svc: AgentService = Depends(get_agent_service)
) -> Agent:
    return await svc.update(agent_id, payload)


@router.delete("/{agent_id}", status_code=204, response_class=Response)
async def delete_agent(agent_id: str, svc: AgentService = Depends(get_agent_service)) -> None:
    await svc.delete(agent_id)
