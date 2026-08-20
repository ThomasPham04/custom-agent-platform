# Agent Platform Service

FastAPI backend for the AI Agent Platform. It serves REST endpoints for agent
configuration, tool-calling conversations, sessions and run history, knowledge
documents, scheduled triggers, and the model/tool catalog. Google ADK is an
optional provider integration; the default mock provider runs offline. See
`AgentPlatform-BackEnd/README.md` for the endpoint list and the repository root
README for the full-stack quick start.

## Run locally

Requires Python 3.14, managed by `uv` when necessary:

```bash
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

The API listens on `http://localhost:4000`; `GET /api/health` reports whether
the selected provider is `mock` or `live`. The default configuration uses an
in-memory store and the deterministic mock provider, so neither Postgres nor an
API key is required for local development.

## Configuration

The service reads environment variables and, when present, `.env` beside
`pyproject.toml`. `server/.env.example` lists every setting.

To use Postgres outside Docker, set:

```env
STORE_BACKEND=postgres
DATABASE_URL=postgresql://app:app@localhost:5432/agents
```

To use Gemini, provide an API key and include the optional ADK dependency on
each command that runs the service:

```env
LLM_PROVIDER=adk_gemini
GEMINI_API_KEY=your-key
```

```bash
uv run --extra adk uvicorn app.main:app --port 4000 --reload
```

The trigger scheduler is enabled by default. Configure it with
`TRIGGERS_ENABLED`, `TRIGGER_TICK_SECONDS`, and `TRIGGER_MAX_PER_TICK`; see the
deployment README for container equivalents and defaults.

## Verify

```bash
uv run pytest
uv run ruff check .
```
