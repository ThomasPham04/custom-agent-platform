# Custom Agent Platform

A proof of concept for an AI agent platform: configure agents, attach tools to
them, execute one via REST, and read its execution trace. The backend is
Python (FastAPI + Google ADK); the frontend is React + TypeScript.

## Layout

| Folder | What it is |
| --- | --- |
| `AgentPlatform-BackEnd/server` | The API. Python 3.12 + FastAPI, listening on port 4000. |
| `AgentPlatform-BackEnd/deployment` | Docker Compose scaffold — nginx serves the client and proxies `/api` to the API on the same origin |
| `AgentPlatform-FrontEnd/client` | React 19 + TypeScript UI on Vite |
| `docs/superpowers/specs` | Design and architecture specs |
| `docs/superpowers/plans` | Implementation plans |
| `docs/superpowers/references` | The REST contract the frontend and backend both implement against |

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Python | 3.12 or newer | backend |
| [uv](https://docs.astral.sh/uv/) | recent release | backend dependencies and commands |
| Node.js | 20.19+ or 22.12+ | frontend |
| Docker Desktop | any recent release | the container stack only |

Nothing else is required to start. The backend defaults to an in-memory agent
store and a deterministic mock LLM provider, so it runs with no database and no
API key, and the tool-call trace still renders end to end.

The backend and frontend are separate projects with separate toolchains. There
is no root-level install step — run each command from the directory shown.

## Run it in development

Two processes. Start the backend first; the frontend proxies to it.

### 1. Backend, on port 4000

Windows PowerShell:

```powershell
Set-Location .\AgentPlatform-BackEnd\server
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

Bash/POSIX:

```bash
cd AgentPlatform-BackEnd/server
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

`uv sync` creates the virtual environment and installs from the lockfile;
`uv run` executes inside it, so there is no environment to activate by hand.

Check it with `http://localhost:4000/api/health`, which returns the status and
the active provider mode.

Port 4000 is not a preference. The Vite dev proxy, the nginx config, the
container healthcheck, and the Playwright config all target it, so the service
has to bind that port for the rest of the stack to find it.

### 2. Frontend, on port 5173

Windows PowerShell:

```powershell
Set-Location .\AgentPlatform-FrontEnd\client
Copy-Item .env.example .env
npm ci
npm run dev
```

Bash/POSIX:

```bash
cd AgentPlatform-FrontEnd/client
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:4000`,
so there is no CORS configuration in development.

The copied `.env` leaves `VITE_API_HOST` blank, which is what enables the proxy.
Set it to an absolute origin only when the API is hosted somewhere else.

## Run it in containers

The whole stack — Postgres, the API, and nginx serving the built client — comes
up with one command. From `AgentPlatform-BackEnd/deployment`:

```powershell
Copy-Item .\deploy\env\backend.env.example .\deploy\env\backend.env
docker compose up --build
```

```bash
cp deploy/env/backend.env.example deploy/env/backend.env
docker compose up --build
```

Open `http://localhost:8080`. Startup is ordered by healthchecks, and the API
applies its schema and seeds the sample agents on first boot. `backend.env`
holds credentials and is not tracked — never commit it.

See `AgentPlatform-BackEnd/deployment/README.md` for the service breakdown and
every configuration value.

## Optional configuration

Both are off by default. The service reads settings from the environment, or
from a `.env` file beside `AgentPlatform-BackEnd/server/pyproject.toml`;
`server/.env.example` lists every key.

**Persist agents and run history to Postgres.** Point the service at a running
database and it applies its schema on startup:

```
STORE_BACKEND=postgres
DATABASE_URL=postgresql://app:app@localhost:5432/agents
```

The values in `.env.example` are the container ones, where the database host is
the compose service name `db`. Running the API outside Docker against a local
database means changing that host to `localhost`.

**Execute against real Gemini** instead of the mock provider. This needs a
Google API key and the optional `adk` extra:

```
LLM_PROVIDER=adk_gemini
GEMINI_API_KEY=your-key
```

Pass `--extra adk` on every `uv run`, not just once:

```bash
uv run --extra adk uvicorn app.main:app --port 4000 --reload
```

`uv run` re-syncs the environment to the default dependency set each time it is
invoked, so a plain `uv run` uninstalls the extra again. The service still
starts and still reports live mode, because the ADK import is deferred until a
turn actually executes — the failure surfaces on the first chat request as a
`provider_error`, not at startup.

`GET /api/health` then reports `"mode": "live"` rather than `"mock"`, and the UI
header shows it. Live mode calls a billed API and needs credit on the account;
the mock provider is what keeps the default path free and offline.

## Verify

Backend, from `AgentPlatform-BackEnd/server`:

```bash
uv run pytest
uv run ruff check .
```

Frontend, from `AgentPlatform-FrontEnd/client`:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

`uv run pytest` needs no database — the Postgres tests skip unless a test
database is configured. `npm run test:e2e` starts both servers itself, so do not
start them first.

See `AgentPlatform-BackEnd/README.md` and `AgentPlatform-FrontEnd/README.md`
for details on each side.
