# Agent Platform — Frontend

The React client for the AI Agent Platform including workspace for
configuring agents, attaching tools to them, and running conversations against
one, with the tool-call trace and run history visible as the conversation
happens.

## What it delivers

**Agents.** A table of every configured agent, with a filter by name or
description. Opening an agent shows a panel for its status (active or draft),
model, system prompt, and description, and the set of tools it can call.
Changes save automatically as they are made. From the table, an agent can be
duplicated, deleted, or sent straight into Chat to try.

**Chat.** A conversation with one agent at a time, switchable from a picker in
the header. Sending a message returns the agent's reply together with the
trace of any tools it called along the way — each call's arguments, result,
timing, and outcome. A failed tool call is shown with its error and a retry
action. The conversation can be cleared, and the last agent used is
remembered between visits.

**Workspace status.** The sidebar reports whether the API is reachable and
whether it is answering with the mock provider or a live model, read live
from the backend rather than hardcoded.

## Run it

Needs Node.js 20.19+ or 22.12+, the versions Vite 7 supports. Start the
backend first, on port 4000 — see `AgentPlatform-BackEnd/README.md` — then:

Windows PowerShell:

```powershell
Set-Location .\client
Copy-Item .env.example .env
npm ci
npm run dev
```

Bash/POSIX:

```bash
cd client
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://localhost:4000`,
so no CORS configuration is needed. The copied `.env` leaves `VITE_API_HOST`
blank, which is what enables the proxy — set it to an absolute origin only
when the API is hosted elsewhere. Without a backend running, the UI loads but
every request fails.

