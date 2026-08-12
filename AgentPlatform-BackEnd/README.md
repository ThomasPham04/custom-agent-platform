# Agent Platform — Backend

The API for the AI Agent Platform proof of concept: Python 3.12, FastAPI, and
Google ADK, listening on port 4000.

## Layout

| Folder | What it is |
| --- | --- |
| `server/` | The FastAPI service |
| `deployment/` | Docker Compose scaffold — nginx serves the client and proxies `/api` |

## Run

```bash
cd server
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

Listens on `http://localhost:4000`. Port 4000 is not a preference: the client's
`nginx.conf`, the compose healthcheck, and `playwright.config.ts` all hard-code
it.

Settings default to an in-memory agent store and a mock LLM provider, so the
service runs with no database and no credentials. `server/.env.example` lists
every setting, including the ones deployment overrides (`STORE_BACKEND=postgres`,
a real `GEMINI_API_KEY`).

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
| POST | `/api/chat/:agentId/messages` | `{ message }` |

Errors return `{ error: { code, message } }` and nothing else. FastAPI's default
422 validation body and its `{"detail": ...}` shape are both remapped.

JSON on the wire is camelCase; Python identifiers are snake_case.

## Test

```bash
uv run pytest
uv run ruff check .
```

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
