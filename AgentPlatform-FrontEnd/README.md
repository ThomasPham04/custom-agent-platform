# Agent Platform — Frontend

React UI for the AI Agent Platform proof of concept. Two surfaces behind a
Notion-style sidebar: **Agents** for configuration and **Chat** for testing a
run and reading its tool-call trace.

## Run

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

Opens on `http://localhost:5173`. Vite proxies `/api` to `http://localhost:4000`,
so no CORS configuration is needed in development.

The copied `.env` leaves `VITE_API_HOST` blank, which is what enables the proxy.
Set it to an absolute origin only when the API is hosted elsewhere. Without a
backend running, the UI loads but every request fails.

## Conventions

- Plain CSS, one file colocated beside its component. Every value comes from a
  token in `src/styles/tokens.css` — no hardcoded colors outside that file.
- `src/lib/api-client.ts` is the only module that calls `fetch`.
- Data fetching lives in `src/hooks/`. Components in `src/components/ui/` are
  presentation only.

## Test

```bash
npm test          # unit and component tests
npm run test:e2e  # Playwright smoke run, boots both servers
npm run typecheck
npm run lint
npm run build
```

`npm run test:e2e` starts the backend and the frontend itself, so do not start
them beforehand.
