# Deployment

Scaffold for the proof of concept. It builds both images and serves the client
through nginx, which proxies `/api` to the API container on the same origin.

## Run

```powershell
Copy-Item .\deploy\env\backend.env.example .\deploy\env\backend.env
docker compose up --build
```

Open `http://localhost:8080`.

## What this is not

The API holds agents in memory, so **every restart resets them to the four
seed agents**. There is no database, no LLM provider, and no auth. Before this
becomes a real deployment it needs: a persistent store behind
`services/agentStore.js`, real credentials for the LLM provider, TLS, and a
replacement for `services/mockExecutionService.js`.
