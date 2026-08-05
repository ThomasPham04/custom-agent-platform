# Custom Agent Platform

A proof of concept for configuring AI agents, attaching tools to them, and
testing a run end to end. This repository currently contains the **UI layer**
and an Express API that answers with fixtures behind the final REST contract.

## Layout

| Folder | What it is |
| --- | --- |
| `AgentPlatform-BackEnd/server` | Express 5 API, plain JS. Fixture handlers. |
| `AgentPlatform-BackEnd/deployment` | Docker Compose scaffold |
| `AgentPlatform-FrontEnd/client` | React 19 + TypeScript UI on Vite |
| `docs/superpowers/specs` | Design spec |
| `docs/superpowers/plans` | Implementation plan |

## Run it

Open two Windows PowerShell terminals at the repository root:

```powershell
# Terminal 1 — API
Set-Location .\AgentPlatform-BackEnd\server
npm install
npm run dev
```

```powershell
# Terminal 2 — UI
Set-Location .\AgentPlatform-FrontEnd\client
npm install
npm run dev
```

Open `http://localhost:5173`.

Or with containers:

```powershell
Set-Location .\AgentPlatform-BackEnd\deployment
Copy-Item .\deploy\env\backend.env.example .\deploy\env\backend.env
docker compose up --build
```

Open `http://localhost:8080`.

## What works today

- Create, rename, configure, duplicate, and delete agents
- Set a system prompt, a Gemini model, and a set of tools per agent
- Test an agent in chat and read its tool-call trace inline, expanding any
  step to see the arguments it was called with and what it returned
- Autosave with a visible save state, and a recoverable failure path

## What is still a fixture

Agents live in memory and reset when the API restarts. Runs are canned: the
tool calls, their durations, and the answers all come from
`AgentPlatform-BackEnd/server/data/runs.js`. Sending a message containing the
word `fail` produces a failed tool call, which is how the error path is
reachable without editing code.

Replacing the fixtures means rewriting two modules and nothing else:
`services/agentStore.js` for persistence and
`services/mockExecutionService.js` for real execution. The frontend talks only
to the REST contract and does not change.

## Documentation

- Design spec: `docs/superpowers/specs/2026-08-04-agent-platform-ui-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-04-agent-platform-ui.md`
