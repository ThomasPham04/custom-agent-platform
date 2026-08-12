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

## Run it

Backend and frontend run as two separate processes in development.

### Windows PowerShell

```powershell
Set-Location .\AgentPlatform-BackEnd\server
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

```powershell
Set-Location .\AgentPlatform-FrontEnd\client
npm install
npm run dev
```

### Bash/POSIX

```bash
cd AgentPlatform-BackEnd/server
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```

```bash
cd AgentPlatform-FrontEnd/client
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:4000`,
so no CORS configuration is needed in development.

Or run the whole stack in containers: from `AgentPlatform-BackEnd/deployment`,
copy `deploy/env/backend.env.example` to `deploy/env/backend.env`, then
`docker compose up --build` and open `http://localhost:8080`.

See `AgentPlatform-BackEnd/README.md` and `AgentPlatform-FrontEnd/README.md`
for details on each side.
