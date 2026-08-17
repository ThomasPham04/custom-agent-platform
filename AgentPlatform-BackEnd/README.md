# Agent Platform — Backend

The API for the AI Agent Platform: Python 3.12, FastAPI, and Google ADK,
listening on port 4000.

## What it delivers

A REST API for the full agent lifecycle: create, read, update, and delete
agents, each configured with a model, a system prompt, and a set of tools it
can call. Sending a chat message runs the agent and returns its complete
reply in one response — no streaming — together with the trace of every tool
call it made: arguments, result, timing, and outcome. Every run is recorded
and queryable by agent or by conversation, snapshotting the agent's name,
model, and system prompt as they were at execution time.

Messages are grouped into chat sessions: one session is one conversation with
one agent. Sending the first message of a chat creates the session and titles
it from what was asked, so a client can list past conversations, reopen one,
rename it, or delete it.

Two LLM providers implement the same interface: a deterministic mock that
needs no credentials and keeps the whole API usable offline, and Google ADK
against live Gemini. Two repository backends implement the same contract: an
in-memory store for a zero-setup run, and Postgres for agents and run history
that outlive a restart.

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
Vite proxy, `nginx.conf`, and the compose healthcheck all hard-code it.

`uv sync` installs from the lockfile into a local virtual environment, and
`uv run` executes inside it, so there is nothing to activate by hand.

Settings default to an in-memory agent store and a mock LLM provider, so the
service runs with no database and no credentials, and tool calls still produce a
full trace.

That default is not durable. With `STORE_BACKEND=memory` the store lives in the
process, so every agent and run created through the UI disappears when the API
stops, and the next boot reseeds the four sample agents. Anything meant to
outlive a restart needs `STORE_BACKEND=postgres` — see Configuration below.

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
startup and seeds the sample agents only when the table is empty, so a restart
keeps whatever was created through the UI.

To develop against a durable store without running the whole compose stack,
start only the database and point the API at it:

```powershell
docker run -d --name agents-db -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app `
  -e POSTGRES_DB=agents -p 5432:5432 postgres:16-alpine

$env:STORE_BACKEND = "postgres"
$env:DATABASE_URL = "postgresql://app:app@localhost:5432/agents"
uv run uvicorn app.main:app --port 4000 --reload
```

`DATABASE_URL` points at a store you intend to keep. `TEST_DATABASE_URL` is a
separate variable precisely because the test fixtures drop and truncate every
table — never set them to the same database.

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
| POST | `/api/chat/:agentId/messages` | `{ message, session? }` with `toolCalls[]` |
| GET | `/api/sessions?limit=` | `Session[]`, newest activity first |
| PATCH | `/api/sessions/:id` | `Session` |
| DELETE | `/api/sessions/:id` | 204 |
| GET | `/api/runs?agentId=&limit=` | `Run[]` |
| GET | `/api/runs?sessionId=&limit=` | `Run[]` for one conversation |
| GET | `/api/runs/:id` | `Run` |
| DELETE | `/api/runs?agentId=` | 204 |

There is no streaming: the chat endpoint returns the complete assistant message,
tool calls included, in one response.

Sessions have no create route. A chat message with no `sessionId` starts one, and
the response carries the new session alongside the message; later messages pass
that id and the response omits it. Runs can be filtered by agent or by session,
but not both at once. Deleting a session deletes its runs. Deleting an agent
deletes its sessions and keeps its runs, so the record of what an agent did
outlives the agent itself.

Errors return `{ error: { code, message } }` and nothing else. FastAPI's default
422 validation body and its `{"detail": ...}` shape are both remapped. A tool
that fails is not a request failure — the response is still 200, with the error
recorded on that tool call.

JSON on the wire is camelCase; Python identifiers are snake_case.

