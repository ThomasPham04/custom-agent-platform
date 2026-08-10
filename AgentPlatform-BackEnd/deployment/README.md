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

## Status

**This does not build yet.** The `api` service points at
`AgentPlatform-BackEnd/server`, which is empty while the backend is rewritten in
Python. Phase 0 of the migration creates the image.

## What this is not

The API will hold agents in memory until Phase 2 adds Postgres, so **every
restart resets them to the four seed agents**. There is no auth, and no LLM
credentials are wired up before Phase 3. Before this becomes a real deployment
it needs: the `db` service and a persistent volume, real credentials for the LLM
provider, and TLS.
