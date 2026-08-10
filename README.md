# Custom Agent Platform

A proof of concept for configuring AI agents, attaching tools to them, and
testing a run end to end.

> **The backend is being rebuilt and does not currently run.** The Express
> fixture API was deleted on 2026-08-09 and is being replaced, in the same
> folder, by a Python service on FastAPI + Google ADK. The UI still builds and
> its unit tests still pass, but nothing answers on `:4000` yet, so the "Run it"
> steps below only bring up the frontend. See
> [the migration docs](#migration) for where this is going.

## Layout

| Folder | What it is |
| --- | --- |
| `AgentPlatform-BackEnd/server` | The API. Python 3.12 + FastAPI on port 4000. Being built. |
| `AgentPlatform-BackEnd/deployment` | Docker Compose scaffold |
| `AgentPlatform-FrontEnd/client` | React 19 + TypeScript UI on Vite |
| `docs/superpowers/specs` | Design specs |
| `docs/superpowers/plans` | Implementation plans |
| `docs/superpowers/references` | The REST contract, transcribed from the deleted Express API |

## Run it

### Windows PowerShell

```powershell
Set-Location .\AgentPlatform-FrontEnd\client
npm install
npm run dev
```

### Bash/POSIX

```bash
cd AgentPlatform-FrontEnd/client
npm install
npm run dev
```

Open `http://localhost:5173`. The UI loads, and every request to `/api` fails
until the Python backend exists — agent lists render empty and the health pill
in the sidebar reads offline.

Containers (`docker compose up --build` from `AgentPlatform-BackEnd/deployment`,
then `http://localhost:8080`) are blocked on the same thing: the `api` service
has no image to build until Phase 0 lands.
