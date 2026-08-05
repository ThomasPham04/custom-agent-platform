# Agent Platform — Backend

Express API for the AI Agent Platform proof of concept. Every handler currently
returns fixtures: there is no LLM provider, no database, and no auth. The REST
contract is the final one, so replacing the fixture services does not change the
frontend.

## Run

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Listens on `http://localhost:4000`.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | `{ status, mode }` |
| GET | `/api/agents` | `Agent[]` |
| POST | `/api/agents` | `Agent` (201) |
| GET | `/api/agents/:id` | `Agent` |
| PATCH | `/api/agents/:id` | `Agent` |
| DELETE | `/api/agents/:id` | 204 |
| GET | `/api/tools` | `Tool[]` |
| POST | `/api/chat/:agentId/messages` | `{ message }` |

Errors return `{ error: { code, message } }`.

## Replacing the fixtures

- `services/agentStore.js` is the only module that mutates agent state. Point it
  at a database and the controllers do not change.
- `services/mockExecutionService.js` is where a real Google ADK run belongs. It
  returns a finished message; per-step pacing is the client's job.

## Test

```bash
npm test
```
