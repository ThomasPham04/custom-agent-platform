"""Composition root — the only place implementations are chosen.

Services receive their collaborators from here and never learn which
implementation they got.
"""

import os
from functools import lru_cache

from app.config import get_settings
from app.core.db import get_pool
from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.repositories.postgres import PostgresAgentRepository
from app.modules.agents.repository import AgentRepository
from app.modules.agents.seeds import SEED_AGENTS
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
from app.modules.sessions.repositories.memory import MemorySessionRepository
from app.modules.sessions.repositories.postgres import PostgresSessionRepository
from app.modules.sessions.repository import SessionRepository
from app.modules.sessions.service import SessionService
from app.modules.tools.registry import ToolRegistry, default_tools
from app.modules.triggers.repositories.memory import MemoryTriggerRepository
from app.modules.triggers.repositories.postgres import PostgresTriggerRepository
from app.modules.triggers.repository import TriggerRepository
from app.modules.triggers.scheduler import TriggerScheduler
from app.modules.triggers.service import TriggerService


@lru_cache
def get_tool_registry() -> ToolRegistry:
    return ToolRegistry(
        default_tools(http_timeout_ms=get_settings().tool_http_timeout_ms)
    )


@lru_cache
def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm_provider == "mock":
        return MockLLMProvider()
    # google-genai reads GOOGLE_API_KEY from the process environment and offers
    # no constructor argument through ADK's model-by-name path. This writes the
    # value config.py already read; it is not a second source of configuration.
    if settings.gemini_api_key:
        os.environ.setdefault("GOOGLE_API_KEY", settings.gemini_api_key)
    return AdkGeminiProvider(api_key=settings.gemini_api_key)


@lru_cache
def get_agent_repository() -> AgentRepository:
    settings = get_settings()
    if settings.store_backend == "memory":
        # Seeded at construction. The cache above means one store per process,
        # so this runs once — the memory equivalent of "seed only when the table
        # is empty".
        return MemoryAgentRepository(seed=SEED_AGENTS)
    # The lifespan opened this before any request could reach here; seeding is
    # its job too, because it must happen once per process rather than per call.
    return PostgresAgentRepository(pool=get_pool())


def get_agent_service() -> AgentService:
    return AgentService(
        repo=get_agent_repository(),
        tools=get_tool_registry(),
        model_ids=MODEL_IDS,
        default_model=DEFAULT_MODEL,
        sessions=get_session_repository(),
        triggers=get_trigger_repository(),
    )


@lru_cache
def get_run_repository() -> RunRepository:
    settings = get_settings()
    if settings.store_backend == "memory":
        return MemoryRunRepository()
    return PostgresRunRepository(pool=get_pool())


def get_run_service() -> RunService:
    return RunService(repo=get_run_repository())


@lru_cache
def get_session_repository() -> SessionRepository:
    settings = get_settings()
    if settings.store_backend == "memory":
        return MemorySessionRepository()
    return PostgresSessionRepository(pool=get_pool())


def get_session_service() -> SessionService:
    return SessionService(sessions=get_session_repository(), runs=get_run_repository())


@lru_cache
def get_trigger_repository() -> TriggerRepository:
    settings = get_settings()
    if settings.store_backend == "memory":
        return MemoryTriggerRepository()
    return PostgresTriggerRepository(pool=get_pool())


def get_trigger_service() -> TriggerService:
    return TriggerService(
        repo=get_trigger_repository(),
        agents=get_agent_repository(),
        execution=get_execution_service(),
    )


def get_trigger_scheduler() -> TriggerScheduler:
    return TriggerScheduler(
        triggers=get_trigger_repository(),
        execution=get_execution_service(),
        max_per_tick=get_settings().trigger_max_per_tick,
    )


def get_execution_service() -> ExecutionService:
    settings = get_settings()
    return ExecutionService(
        agents=get_agent_repository(),
        tools=get_tool_registry(),
        llm=get_llm_provider(),
        runs=get_run_repository(),
        sessions=get_session_repository(),
        log_payload_max_bytes=settings.log_payload_max_bytes,
    )


def reset_container() -> None:
    """Drop every cached singleton.

    Tests call this between cases so one test's agents never leak into the next.
    """
    get_tool_registry.cache_clear()
    get_llm_provider.cache_clear()
    get_agent_repository.cache_clear()
    get_run_repository.cache_clear()
    get_session_repository.cache_clear()
    get_trigger_repository.cache_clear()
