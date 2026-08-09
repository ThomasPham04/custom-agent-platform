from fastapi import APIRouter, Depends

from app.container import get_llm_provider
from app.modules.llm.provider import LLMProvider, ModelInfo

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=list[ModelInfo])
def list_models(provider: LLMProvider = Depends(get_llm_provider)) -> list[ModelInfo]:
    return provider.models()
