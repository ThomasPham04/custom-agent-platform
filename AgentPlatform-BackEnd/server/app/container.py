"""Composition root — the only place implementations are chosen.

Services receive their collaborators from here and never learn which
implementation they got.
"""

from functools import lru_cache

from app.config import get_settings
from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.repositories.postgres import PostgresAgentRepository
from app.modules.agents.repository import AgentRepository
from app.modules.agents.service import AgentService
from app.modules.execution.service import ExecutionService
from app.modules.llm.catalog import DEFAULT_MODEL, MODEL_IDS
from app.modules.llm.provider import LLMProvider
from app.modules.llm.providers.adk_gemini import AdkGeminiProvider
from app.modules.llm.providers.mock import MockLLMProvider
from app.modules.runs.repositories.memory import MemoryRunRepository
from app.modules.runs.repositories.postgres import PostgresRunRepository
from app.modules.runs.repository import RunRepository
from app.modules.runs.service import RunService
from app.modules.tools.registry import ToolRegistry, default_tools


@lru_cache
def get_tool_registry() -> ToolRegistry:
    return ToolRegistry(default_tools())


@lru_cache
def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm_provider == "mock":
        return MockLLMProvider()
    return AdkGeminiProvider(api_key=settings.gemini_api_key)


@lru_cache
def get_agent_repository() -> AgentRepository:
    settings = get_settings()
    if settings.store_backend == "memory":
        return MemoryAgentRepository()
    # Phase 2 passes a real asyncpg pool from core/db.py.
    return PostgresAgentRepository(pool=None)


def get_agent_service() -> AgentService:
    return AgentService(
        repo=get_agent_repository(),
        tools=get_tool_registry(),
        model_ids=MODEL_IDS,
        default_model=DEFAULT_MODEL,
    )


@lru_cache
def get_run_repository() -> RunRepository:
    settings = get_settings()
    if settings.store_backend == "memory":
        return MemoryRunRepository()
    return PostgresRunRepository(pool=None)


def get_run_service() -> RunService:
    return RunService(repo=get_run_repository())


def get_execution_service() -> ExecutionService:
    return ExecutionService(
        agents=get_agent_repository(),
        tools=get_tool_registry(),
        llm=get_llm_provider(),
        runs=get_run_repository(),
    )
