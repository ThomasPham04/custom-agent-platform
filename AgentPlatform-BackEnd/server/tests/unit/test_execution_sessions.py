"""A first chat gets a stable title without a second model request."""

from collections.abc import AsyncIterator

import pytest

from app.modules.agents.repositories.memory import MemoryAgentRepository
from app.modules.agents.seeds import SEED_AGENTS
from app.modules.execution.schemas import MessageRequest
from app.modules.execution.service import ExecutionService
from app.modules.knowledge.repositories.memory import MemoryKnowledgeRepository
from app.modules.knowledge.seeds import SEED_DOCUMENTS
from app.modules.llm.provider import (
    LLMProvider,
    ModelInfo,
    RunEvent,
    RunSpec,
    TurnFinished,
)
from app.modules.runs.repositories.memory import MemoryRunRepository
from app.modules.sessions.repositories.memory import MemorySessionRepository
from app.modules.tools.registry import ToolRegistry, default_tools

pytestmark = pytest.mark.anyio


class FakeLLM(LLMProvider):
    def __init__(self) -> None:
        self.run_calls = 0

    def models(self) -> list[ModelInfo]:
        return []

    def run(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        self.run_calls += 1
        return self._stream(spec)

    async def _stream(self, spec: RunSpec) -> AsyncIterator[RunEvent]:
        yield TurnFinished(text="An answer.", model=spec.model, latency_ms=10)

@pytest.fixture
def sessions() -> MemorySessionRepository:
    return MemorySessionRepository()


@pytest.fixture
def llm() -> FakeLLM:
    return FakeLLM()


@pytest.fixture
def execution_service(sessions: MemorySessionRepository, llm: FakeLLM) -> ExecutionService:
    return ExecutionService(
        agents=MemoryAgentRepository(seed=SEED_AGENTS),
        tools=ToolRegistry(default_tools(
            http_timeout_ms=5_000,
            knowledge=MemoryKnowledgeRepository(seed=SEED_DOCUMENTS),
        )),
        llm=llm,
        runs=MemoryRunRepository(),
        sessions=sessions,
        log_payload_max_bytes=1_000_000,
    )


async def test_first_message_becomes_title_without_a_second_model_call(
    execution_service: ExecutionService, llm: FakeLLM
):
    _, session = await execution_service.send_message(
        "agent_support", MessageRequest(content="Refund window please")
    )
    assert session.title == "Refund window please"
    assert llm.run_calls == 1
