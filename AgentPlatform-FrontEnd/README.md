# Agent Platform — Frontend

React UI for the AI Agent Platform proof of concept. Two surfaces behind a
Notion-style sidebar: **Agents** for configuration and **Chat** for testing a
run and reading its tool-call trace.

## Run

Start the backend first (see `AgentPlatform-BackEnd/README.md`), then:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Opens on `http://localhost:5173`. Vite proxies `/api` to `http://localhost:4000`,
so no CORS configuration is needed in development.

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
```
