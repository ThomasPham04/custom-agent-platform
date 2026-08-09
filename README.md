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

## What works today

In the UI, against a backend that answers the contract:

- Create, rename, configure, duplicate, and delete agents
- Set a system prompt, a Gemini model, and a set of tools per agent
- Test an agent in chat and read its tool-call trace inline, expanding any
  step to see the arguments it was called with and what it returned
- Autosave with a visible save state, and a recoverable failure path

## Migration

The Express API returned fixtures behind the final REST contract: agents lived
in memory, runs were canned, and there was no LLM provider. Rather than swap the
fixtures for real implementations in place, the backend is being rewritten in
Python — Google ADK has no JavaScript runtime, and the brief calls for ADK.

The REST contract is preserved byte for byte, so the frontend is untouched.

| Document | Role |
| --- | --- |
| [`specs/2026-08-08-...-backend-architecture-design.md`](docs/superpowers/specs/2026-08-08-agent-platform-backend-architecture-design.md) | Modules, ports, data model, decisions |
| [`plans/2026-08-08-...-phase-0-skeleton.md`](docs/superpowers/plans/2026-08-08-agent-platform-backend-phase-0-skeleton.md) | Phase 0, task by task |
| [`references/express-contract-reference.md`](docs/superpowers/references/express-contract-reference.md) | **The contract.** Seed data, fixtures, exact error strings, and every behaviour the deleted tests asserted |

One fixture behaviour is worth knowing because the UI depends on it: sending a
message containing the word `fail` produces a failed tool call, which is how the
error path stays reachable without editing code.

## Documentation

- UI design spec: `docs/superpowers/specs/2026-08-04-agent-platform-ui-design.md`
- UI implementation plan: `docs/superpowers/plans/2026-08-04-agent-platform-ui.md`
