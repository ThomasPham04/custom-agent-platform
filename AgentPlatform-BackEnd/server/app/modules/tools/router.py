from fastapi import APIRouter, Depends

from app.container import get_tool_registry
from app.modules.tools.base import ToolSchema
from app.modules.tools.registry import ToolRegistry

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("", response_model=list[ToolSchema])
def list_tools(registry: ToolRegistry = Depends(get_tool_registry)) -> list[ToolSchema]:
    return registry.list()
