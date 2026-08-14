# Agent Platform — Backend

The API for the AI Agent Platform proof of concept: Python 3.12, FastAPI, and
Google ADK, listening on port 4000.

## Layout

| Folder | What it is |
| --- | --- |
| `server/` | The FastAPI service |
| `deployment/` | Docker Compose scaffold — nginx serves the client and proxies `/api` |

## Run

Needs Python 3.12 or newer and [uv](https://docs.astral.sh/uv/).

```bash
cd server
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

Listens on `http://localhost:4000`; `GET /api/health` confirms it is up and
reports the active provider mode. Port 4000 is not a preference: the client's
Vite proxy and `nginx.conf`, the compose healthcheck, and `playwright.config.ts`
all hard-code it.

`uv sync` installs from the lockfile into a local virtual environment, and
`uv run` executes inside it, so there is nothing to activate by hand.

Settings default to an in-memory agent store and a mock LLM provider, so the
service runs with no database and no credentials, and tool calls still produce a
full trace.

## Configuration

The service reads the environment, or a `.env` file beside `pyproject.toml`.
`server/.env.example` lists every key.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Fixed — the rest of the stack targets it |
| `CORS_ORIGIN` | Vite's dev origin | Only used for direct cross-origin access |
| `STORE_BACKEND` | `memory` | `postgres` to persist agents and run history |
| `DATABASE_URL` | compose host | Required when the store is `postgres` |
| `LLM_PROVIDER` | `mock` | `adk_gemini` to execute against real Gemini |
| `GEMINI_API_KEY` | empty | Required when the provider is `adk_gemini` |
| `TOOL_HTTP_TIMEOUT_MS` | `5000` | Timeout for the `http_request` tool |
| `LOG_PAYLOAD_MAX_BYTES` | `32768` | Cap on tool payloads stored in run history |

The database host in `.env.example` is the compose service name `db`. Running
the API outside Docker against a local database means changing it to
`localhost`. With `STORE_BACKEND=postgres` the service applies its schema on
startup and seeds the sample agents only when the table is empty.

Google ADK is an optional extra rather than a core dependency, because nothing
imports it in mock mode. Live Gemini needs it, and needs it on every command:

```bash
uv run --extra adk uvicorn app.main:app --port 4000 --reload
```

`uv run` re-syncs the environment to the default dependency set on each
invocation, so a plain `uv run` removes the extra again even after
`uv sync --extra adk`. Because the ADK import is deferred until a turn
executes, dropping it does not stop the service or change what `/api/health`
reports — the first chat request returns `provider_error` instead.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | `{ status, mode }` |
| GET | `/api/agents` | `Agent[]` |
| POST | `/api/agents` | `Agent` (201) |
| GET | `/api/agents/:id` | `Agent` |
| PATCH | `/api/agents/:id` | `Agent` |
| DELETE | `/api/agents/:id` | 204 |
| GET | `/api/tools` | `Tool[]` |
| GET | `/api/models` | `Model[]` |
| POST | `/api/chat/:agentId/messages` | `{ message }` with `toolCalls[]` |
| GET | `/api/runs?agentId=&limit=` | `Run[]` |
| GET | `/api/runs/:id` | `Run` |

There is no streaming: the chat endpoint returns the complete assistant message,
tool calls included, in one response.

Errors return `{ error: { code, message } }` and nothing else. FastAPI's default
422 validation body and its `{"detail": ...}` shape are both remapped. A tool
that fails is not a request failure — the response is still 200, with the error
recorded on that tool call.

JSON on the wire is camelCase; Python identifiers are snake_case.

## Test

```bash
uv run pytest
uv run ruff check .
```

No database is required: the Postgres repository tests skip unless
`TEST_DATABASE_URL` names one. Point it at a throwaway database if you want to
run them — the fixtures drop and truncate tables, which is why they refuse to
read the variable that points at a running service.

## Architecture

Feature modules under `app/modules/` — `agents`, `tools`, `llm`, `execution`,
`runs` — one per component in the brief. Each owns its router, service, schemas,
and where relevant a repository Protocol. `app/container.py` is the only place
implementations are chosen, which is what lets the store swap between memory and
Postgres, and the provider between mock and ADK, without touching a module.

Full detail: `docs/superpowers/specs/2026-08-08-agent-platform-backend-architecture-design.md`.

## The contract

`docs/superpowers/references/express-contract-reference.md` holds the seed
agents, tool schemas, exact validation strings, and the mock execution
algorithm, transcribed verbatim from the deleted Express implementation. It is
the specification for `tests/contract/` — where behaviour is ambiguous, that
file is the answer.
