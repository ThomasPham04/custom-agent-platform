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
action.

Each conversation is kept. The first message of a new chat starts one and
titles it from what was asked, and past chats are listed in the sidebar under
Chat, newest first, so any of them can be reopened where it left off. A chat
can be renamed or deleted from the sidebar or from the header of the chat
itself; deleting one takes its history with it. The last agent used is
remembered between visits.

**Knowledge.** The library of documents agents can search, reachable from the
sidebar. A document is added by typing a title and text, or by uploading a
`.txt` or `.md` file — the file is read in the browser and its name becomes the
title until you change it. Documents over 100,000 bytes are refused before
anything is sent. The list shows a preview and a size for each; opening one
reveals its full text in a side panel where it can be edited or closed with Esc.
Four samples ship with a fresh workspace, badged as samples, and can be deleted
like any other document.

Documents are shared by every agent: attach the Knowledge search tool to an
agent and it can search all of them. What it retrieves shows up in the chat
trace like any other tool call, with the matching document's title and an
excerpt.

**Guidance and reference material.** The bottom of the sidebar offers guided,
read-only walkthroughs of the workspace, agent configuration, the knowledge
library, and testing an agent. A separate sidebar link opens the AI Agent
Platform report PDF in a new browser tab.

**Workspace status.** The sidebar reports whether the API is reachable and
whether it is answering with the mock provider or a live model, read live
from the backend rather than hardcoded.

## Run it

Needs Node.js 24, the active LTS — `package.json` sets `engines.node` to
`>=24`, and the client image builds on `node:24-alpine`. Start the backend
first, on port 4000 — see `AgentPlatform-BackEnd/README.md` — then:

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

The development server has no password gate. The production nginx container can
protect both the UI and `/api` with `WEB_PASSWORD`; see
`AgentPlatform-BackEnd/deployment/README.md` before publishing a live-provider
instance.
