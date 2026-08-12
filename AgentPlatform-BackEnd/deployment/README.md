# Deployment

Scaffold for the proof of concept. It builds both images and serves the client
through nginx, which proxies `/api` to the API container on the same origin.

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

## What this is

Two services: `api` builds from `AgentPlatform-BackEnd/server`, and `web`
builds the client and serves it through nginx, which proxies `/api` to `api`
on the same origin so the browser never makes a cross-origin request. `web`
waits on `api`'s healthcheck (`GET /api/health`) before starting.

## What this is not

This scaffold runs the API with an in-memory agent store and a mock LLM
provider by default, so agents reset to the seed set on every restart and no
external credentials are required. There is no auth and no TLS — it is a
proof-of-concept deployment, not a production one.
