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
report](AgentPlatform-FrontEnd/client/public/documents/ai-agent-platform-report.pdf),
which opens in a separate tab. That path is the only copy of the report in the
repository: it sits in Vite's `public/` directory because that is what the web
image builds and nginx serves at `/report`, so a compiled PDF belongs there and
nowhere else.

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

```bash
# macOS / Linux, via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 24 && nvm use 24

# Windows, via winget
winget install OpenJS.NodeJS.LTS
```

Verify with `node --version`
(expect `v24.x`) and `npm --version`.

Then install each side's dependencies:

```bash
cd AgentPlatform-BackEnd/server  && uv sync
cd AgentPlatform-FrontEnd/client && npm ci
```

`uv sync` creates `.venv` from the lockfile; `uv run` executes inside it, so
there is nothing to activate by hand. `npm ci` installs from
`package-lock.json`.

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

For local development, run the isolated development stack from
`AgentPlatform-BackEnd/deployment`:

```bash
docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml up -d --build --wait
```

It publishes the development UI at `http://<host-lan-ip>:8081`. Create the
environment file and use the `ps`, log, and shutdown commands in the
[deployment README](AgentPlatform-BackEnd/deployment/README.md#lan-development)
before starting it. That guide also contains the separate production workflow;
development never starts the Cloudflare Tunnel.

Set `WEB_PASSWORD` in
`/etc/agent-platform-development/development.env` before allowing any users
beyond your trusted local users. The password gate protects both the UI and
`/api`.

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

**Execute against real Gemini** instead of the mock provider.

```
LLM_PROVIDER=adk_gemini
GEMINI_API_KEY=your-key
```

Run the backend:

```bash
uv run --extra adk uvicorn app.main:app --port 4000 --reload
```

See `AgentPlatform-BackEnd/README.md` and `AgentPlatform-FrontEnd/README.md`
for details on each side.
