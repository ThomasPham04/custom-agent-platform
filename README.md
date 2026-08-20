# Custom Agent Platform

An AI agent platform: configure agents, attach tools to them, run a
conversation against one, and read back a full trace of what it did. The
backend is Python (FastAPI + Google ADK); the frontend is React + TypeScript.

## What it delivers

**Configure agents.** Each agent has a name, description, status, a model, a
system prompt, and the set of tools it's allowed to call. Agents are created,
edited, duplicated, and deleted through the REST API or the included UI.

**Give them tools.** Four built-in tools ship with the platform — a
calculator, a clock, an HTTP request tool, and a knowledge search — and an
agent only reaches the ones attached to it.

**Give them something to read.** The knowledge library is a set of documents
any agent with knowledge search attached can search. Add one by typing it in or
by uploading a `.txt` or `.md` file, then edit or delete it later. Four sample
documents ship with a fresh install so the search has something to find on the
first run.

**Run a conversation and see what happened.** Sending a message returns the
agent's complete reply in one response, plus the trace of every tool call it
made along the way: arguments, result, timing, and whether it succeeded. Every
run is recorded to history, snapshotting the agent's name, model, and system
prompt at execution time, so editing an agent later never rewrites its past
runs.

**Learn the platform from the workspace.** The sidebar offers guided,
read-only walkthroughs for the workspace, agent configuration, the knowledge
library, and testing an agent. It also links to the [platform
report](documents/ai-agent-platform-report.pdf), which opens in a separate tab.

**Switch providers without touching code.** The default LLM provider is a
deterministic mock, so the whole platform runs offline with no credentials and
the trace still renders end to end. Point it at live Gemini instead by setting
two environment variables.

## Layout

| Folder | What it is |
| --- | --- |
| `AgentPlatform-BackEnd/server` | The API. Python 3.14 + FastAPI, listening on port 4000. |
| `AgentPlatform-BackEnd/deployment` | Docker Compose scaffold — nginx serves the client and proxies `/api` to the API on the same origin |
| `AgentPlatform-FrontEnd/client` | React 19 + TypeScript UI on Vite |
| `docs/superpowers/specs` | Design and architecture specs |
| `docs/superpowers/plans` | Implementation plans |
| `docs/superpowers/references` | The REST contract the frontend and backend both implement against |

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| [uv](https://docs.astral.sh/uv/) | recent release | backend dependencies and commands |
| Python | 3.14 | backend — installed by uv, see below |
| Node.js | 24 (active LTS) | frontend |
| Docker | any recent release | the container stack only |

Nothing else is required to start. The backend defaults to an in-memory agent
store and a deterministic mock LLM provider, so it runs with no database and no
API key, and the tool-call trace still renders end to end.

The backend and frontend are separate projects with separate toolchains. There
is no root-level install step — run each command from the directory shown.

### Installing the toolchains

**uv** manages the backend, including its Python. You do not need to install
Python yourself — uv downloads an interpreter on the first `uv sync` if a
suitable one is not already present.

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows PowerShell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

It installs to `~/.local/bin`; open a new shell afterwards so it is on `PATH`.
Verify with `uv --version`.

**Node 24** is easiest through a version manager, so the pin travels with the
project rather than with your machine:

```bash
# macOS / Linux, via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 24 && nvm use 24

# Windows, via winget
winget install OpenJS.NodeJS.LTS
```

npm ships with Node — nothing separate to install. Verify with `node --version`
(expect `v24.x`) and `npm --version`.

Then install each side's dependencies:

```bash
cd AgentPlatform-BackEnd/server  && uv sync
cd AgentPlatform-FrontEnd/client && npm ci
```

`uv sync` creates `.venv` from the lockfile; `uv run` executes inside it, so
there is nothing to activate by hand. `npm ci` installs from
`package-lock.json` exactly.

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

Port 4000 is not a preference. The Vite dev proxy, the nginx config, and the
container healthcheck all target it, so the service has to bind that port for
the rest of the stack to find it.

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

```bash
docker compose up --build
```

Nothing to copy first — every value has a default in the compose file. Open
`http://localhost:8080`. Startup is ordered by healthchecks, and the API applies
its schema and seeds the sample agents on first boot.

To change anything — the host port, the database password, or the LLM provider
and its key — copy `.env.example` to `.env` in that directory. It holds
credentials and is not tracked; never commit it.

For a public demo, set `WEB_PASSWORD` in that same file to place the nginx
password gate in front of both the UI and `/api`. Set `WEB_BIND=127.0.0.1` when
the site is published through the included Cloudflare Tunnel, so the host port
does not bypass the tunnel's access controls.

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

See `AgentPlatform-BackEnd/README.md` and `AgentPlatform-FrontEnd/README.md`
for details on each side.
