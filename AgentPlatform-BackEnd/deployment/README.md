# Deployment

Runs the proof of concept end to end: Postgres, the Python API, and nginx serving
the built client and proxying `/api` to the API on the same origin.

## Run

### Windows PowerShell

```powershell
Copy-Item .\deploy\env\backend.env.example .\deploy\env\backend.env
docker compose up --build
```

### Bash/POSIX

```bash
cp deploy/env/backend.env.example deploy/env/backend.env
docker compose up --build
```

Open `http://localhost:8080`.

`backend.env` holds credentials and is not tracked. Never commit it.

## The three services

| Service | What it does |
| --- | --- |
| `db` | `postgres:16-alpine`, with its data in the `pgdata` volume |
| `api` | Builds from `AgentPlatform-BackEnd/server` and listens on 4000 |
| `web` | Builds the client and serves it through nginx on 8080 |

Startup is ordered by healthchecks rather than by luck: `api` waits for `db` to
report `pg_isready`, and `web` waits for `api` to answer `GET /api/health`.
The API applies its schema on boot, so starting before Postgres is ready would
fail rather than retry.

## First boot

On startup the API opens a connection pool, applies `app/core/schema.sql`, and
inserts the four sample agents **only when the `agents` table is empty**. Every
schema statement is `IF NOT EXISTS`, so a restart against a populated database
is a no-op and an agent you deleted stays deleted. The log line to look for is:

```
postgres ready; seeded 4 agents
```

On later boots it reads `seeded 0 agents`.

Data lives in the `pgdata` volume, so `docker compose down` keeps agents and run
history. To start from an empty database, remove the volume as well:

```bash
docker compose down -v
```

## Running against real Gemini

The stack defaults to the deterministic mock provider, so it runs offline with no
credentials and the tool trace still renders. To demo against live Gemini, set
both values in `deploy/env/backend.env`:

```bash
LLM_PROVIDER=adk_gemini
GEMINI_API_KEY=your-key
```

Then rebuild the API image so the `adk` extra is installed, and restart:

```bash
docker compose up -d --build api
```

`GET /api/health` reports `"mode": "live"` instead of `"mock"`, and the header in
the UI shows it.

## Configuration

Everything the API reads is in `deploy/env/backend.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | Fixed at 4000; nginx and the healthcheck both target it |
| `CORS_ORIGIN` | Fallback for direct access — nginx keeps the browser same-origin |
| `STORE_BACKEND` | `postgres` here, `memory` for a database-free run |
| `DATABASE_URL` | Points at the `db` service by its compose name |
| `LLM_PROVIDER` | `mock` or `adk_gemini` |
| `GEMINI_API_KEY` | Required only when the provider is `adk_gemini` |
| `TOOL_HTTP_TIMEOUT_MS` | Timeout for the `http_request` tool |
| `LOG_PAYLOAD_MAX_BYTES` | Cap on tool payloads stored in run history |

## What this is not

There is no auth, no TLS, and no migration tooling — the schema is applied
directly at startup. It is a proof-of-concept deployment, not a production one.
