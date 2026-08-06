# Agent Platform UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Notion-style web UI for the AI Agent Platform proof of concept — an agents management surface and a chat testing surface with an inline tool-call trace — backed by an Express server whose handlers return fixtures.

**Architecture:** Two sibling project folders following the Apricity convention. `AgentPlatform-BackEnd/server` is plain-JavaScript ESM Express 5 exposing the final REST contract with fixture handlers, so the frontend needs no rework when a real execution engine replaces them. `AgentPlatform-FrontEnd/client` is TypeScript React 19 on Vite, styled with plain CSS colocated per component over custom-property tokens. State lives in hand-rolled hooks over `fetch`; no state library.

**Tech Stack:** Node 20+, Express 5 (ESM, plain JS), Vitest 3 + Supertest 7 on the backend. React 19, TypeScript 5.7, Vite 7, react-router 7, Vitest 3 + React Testing Library 16 + jsdom on the frontend. Playwright 1.5x for one smoke run. Fonts via `@fontsource-variable/*`. No Tailwind, no CSS-in-JS, no state library.

**Spec:** `docs/superpowers/specs/2026-08-04-agent-platform-ui-design.md`. Section references below (§4.1, §8.2, …) point into it.

## Global Constraints

Every task's requirements implicitly include this section.

- **Node 20 or newer.** Both `package.json` files declare `"type": "module"` and `"engines": { "node": ">=20" }`.
- **Backend is plain JavaScript.** No TypeScript, no build step, no `.ts` files under `AgentPlatform-BackEnd/`.
- **Frontend is TypeScript with `strict: true`.** No `any` in committed code; use `unknown` and narrow.
- **Styling is plain CSS only**, one `.css` file colocated beside the component that uses it. Every color, radius, duration, and spacing value comes from a `var(--token)` defined in `styles/tokens.css`. No hardcoded hex values outside `tokens.css`. No Tailwind, no CSS modules, no CSS-in-JS.
- **No external network requests at runtime.** Fonts are bundled from npm, never a CDN.
- **Naming, copied from Apricity:** kebab-case component folders and files (`agent-table/agent-table.tsx`); PascalCase for `components/layout/` files and `pages/` directories; `index.ts` barrel on any multi-file component folder; `index.tsx` as each page entry; page CSS named after the page (`agents.css`).
- **Colors (§4.1):** the palette is verbatim except for the approved contrast corrections recorded below: `--ink-muted` is `#6F6E6B`, `--signal` is `#1B6FC4`, and its derivatives are `--signal-ring` `rgba(27,111,196,0.28)` and `--signal-hover` `#155FA8`. The remaining tokens retain their specified values.
- **`--trace` purple is reserved for tool-call machinery only** (§4.1). It must never style a button, link, heading, or nav item. Text on trace surfaces uses `--trace-ink` for contrast; `#9065B0` is for the rail and glyphs, which are graphics.
- **Mono is JetBrains Mono** and carries every machine-produced value: tool names, latencies, model IDs, JSON, timestamps, counts, and the system prompt textarea. Always with `font-variant-numeric: tabular-nums` where numbers align.
- **Focus is always visible.** Every interactive element takes `outline: 2px solid var(--signal); outline-offset: 2px` on `:focus-visible`. Never `outline: none` without a replacement.
- **Reduced motion** is handled globally by collapsing the duration tokens in `tokens.css`. Individual components do not need their own media query unless they animate something durations cannot switch off.
- **Copy rules (§10):** sentence case, active voice. Errors state what happened and what to do, never apologize, never stay vague. An action keeps its name through the flow — a **Delete** button produces "Agent deleted".
- **Commit after every task**, using the message given in that task's final step. Conventional-commit prefixes (`feat:`, `test:`, `chore:`).

## Deviations from the spec, recorded

### Font packaging

The spec's tree (§6.2) lists `src/assets/fonts/Inter/` and `src/assets/fonts/JetBrainsMono/`, mirroring Apricity's vendored `SVN-Coders-Crux`. Apricity vendored that font because it is not distributable from npm. Inter and JetBrains Mono are, so this plan installs `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` and drops those two folders. The fonts are still self-hosted and bundled — no CDN, no runtime network request — and no binary assets need to be produced by hand.

### Accessible palette

The human reviewer approved two contrast-driven token changes after the live accessibility audit: `--ink-muted` is `#6F6E6B` instead of `#787774`, and `--signal` is `#1B6FC4` instead of `#2383E2`. Their ring and hover derivatives follow the corrected signal color. These values intentionally take precedence over the verbatim palette so secondary text and primary-action text retain accessible contrast; they must not be reverted to the original values.

## File structure

### `AgentPlatform-BackEnd/`

| File | Responsibility |
| --- | --- |
| `server/server.js` | Exports `createApp()`; listens only when run as the entry module |
| `server/utils/status.js` | `HttpError`, `notFound`, `badRequest`, and response helpers |
| `server/utils/ids.js` | `createId(prefix)` |
| `server/data/tools.js` | The four-tool registry fixture |
| `server/data/agents.js` | Four seed agents covering the render states the UI needs |
| `server/data/runs.js` | Per-tool call fixtures, canned answers, the failure fixture |
| `server/services/agentStore.js` | The only module that mutates agent state; swap point for a real database |
| `server/services/mockExecutionService.js` | Builds one canned assistant message for an agent and a user message |
| `server/controllers/toolController.js` | Tool registry handler |
| `server/controllers/agentController.js` | Agent CRUD handlers |
| `server/controllers/chatController.js` | Execution handler |
| `server/routes/*.js` | One router per resource, mounted by `server.js` |
| `deployment/` | Compose file and env example; scaffold only |

### `AgentPlatform-FrontEnd/client/src/`

| File | Responsibility |
| --- | --- |
| `styles/tokens.css` | Every design token. The single source of visual truth. |
| `styles/global.css` | Reset, base typography, focus ring, scrollbars |
| `types/{agent,tool,message}.ts` | Shared shapes, mirroring the API |
| `lib/api-host.ts` | Base URL resolution |
| `lib/api-client.ts` | `ApiError` plus the four verb helpers. The only module that calls `fetch`. |
| `lib/format.ts` | Relative time, duration, clock time, JSON pretty-printing |
| `lib/agent-icons.ts` | The 24 curated icons and a deterministic default |
| `config/models.ts` | Gemini model options |
| `data/suggested-prompts.ts` | Tool-derived starter prompts |
| `hooks/useTools.ts` | Tool registry, fetched once, module-cached |
| `hooks/useApiHealth.ts` | Polls health; drives the sidebar pill |
| `hooks/useAgents.ts` | List, create, optimistic patch with rollback, debounced autosave, delete, duplicate |
| `hooks/useChat.ts` | Per-agent threads, send, retry, and the client-staged reveal (§8.2) |
| `hooks/useMediaQuery.ts` | Breakpoint state |
| `components/ui/*` | Presentation-only primitives, no data fetching |
| `components/layout/*` | Sidebar, TopBar, Workspace shell |
| `components/agents-section/*` | Table, peek, form, tool picker |
| `components/chat-section/*` | Trace rail, tool node, turn, list, composer, switcher |
| `pages/index.tsx` | Route table |
| `pages/Agents/index.tsx`, `pages/Chat/index.tsx` | Surface composition; own the hooks |

Data fetching lives in hooks, never in `components/ui/`. `components/agents-section/` and `components/chat-section/` receive data and callbacks as props so they can be tested without a server.

---

## Phase A — Backend: the real contract, fixture answers

### Task 1: Backend scaffold, health, and the tool registry

**Files:**
- Create: `AgentPlatform-BackEnd/.gitignore`, `AgentPlatform-BackEnd/README.md`
- Create: `AgentPlatform-BackEnd/server/package.json`, `AgentPlatform-BackEnd/server/eslint.config.js`, `AgentPlatform-BackEnd/server/.env.example`, `AgentPlatform-BackEnd/server/.dockerignore`, `AgentPlatform-BackEnd/server/Dockerfile`
- Create: `AgentPlatform-BackEnd/server/utils/status.js`, `AgentPlatform-BackEnd/server/utils/ids.js`
- Create: `AgentPlatform-BackEnd/server/data/tools.js`
- Create: `AgentPlatform-BackEnd/server/controllers/toolController.js`, `AgentPlatform-BackEnd/server/routes/toolRoutes.js`
- Create: `AgentPlatform-BackEnd/server/server.js`
- Test: `AgentPlatform-BackEnd/server/tests/health.test.js`, `AgentPlatform-BackEnd/server/tests/tools.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createApp(): express.Express` from `server.js` — an app with routes mounted but not listening.
  - `class HttpError extends Error { status: number; code: string; message: string }` from `utils/status.js`.
  - `notFound(message): HttpError` (404, code `not_found`), `badRequest(message): HttpError` (400, code `bad_request`).
  - `createId(prefix: string): string` from `utils/ids.js`, producing `` `${prefix}_${8 lowercase base36 chars}` ``.
  - `TOOLS: Tool[]` from `data/tools.js`, where `Tool = { id, label, description, params: { name, type, required, description }[] }`.
  - `GET /api/health` → `{ status: 'ok', mode: 'mock' }`; `GET /api/tools` → `Tool[]`.
  - Error shape for every failure: `{ error: { code, message } }`.

- [ ] **Step 1: Create the backend package and lint config**

`AgentPlatform-BackEnd/server/package.json`:

```json
{
  "name": "agent-platform-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "eslint": "^9.17.0",
    "supertest": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

`AgentPlatform-BackEnd/server/eslint.config.js`:

```js
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
    },
  },
];
```

`AgentPlatform-BackEnd/server/.env.example`:

```
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

`AgentPlatform-BackEnd/.gitignore`:

```
node_modules/
.env
*.log
```

`AgentPlatform-BackEnd/server/.dockerignore`:

```
node_modules
.env
tests
```

`AgentPlatform-BackEnd/server/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Install dependencies**

Run from `AgentPlatform-BackEnd/server`: `npm install`
Expected: `node_modules` created, no error output.

- [ ] **Step 3: Write the failing tests**

`AgentPlatform-BackEnd/server/tests/health.test.js`:

```js
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

describe('GET /api/health', () => {
  it('reports mock mode', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mode: 'mock' });
  });
});

describe('unknown routes', () => {
  it('returns the standard error envelope', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect(typeof res.body.error.message).toBe('string');
  });
});
```

`AgentPlatform-BackEnd/server/tests/tools.test.js`:

```js
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

describe('GET /api/tools', () => {
  it('returns the four registered tools', async () => {
    const res = await request(createApp()).get('/api/tools');
    expect(res.status).toBe(200);
    expect(res.body.map((tool) => tool.id)).toEqual([
      'current_time',
      'http_request',
      'calculator',
      'knowledge_search',
    ]);
  });

  it('describes each tool with a label and params', async () => {
    const res = await request(createApp()).get('/api/tools');
    for (const tool of res.body) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(Array.isArray(tool.params)).toBe(true);
    }
  });

  it('marks required params', async () => {
    const res = await request(createApp()).get('/api/tools');
    const http = res.body.find((tool) => tool.id === 'http_request');
    expect(http.params.find((param) => param.name === 'url').required).toBe(true);
    expect(http.params.find((param) => param.name === 'method').required).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run from `AgentPlatform-BackEnd/server`: `npm test`
Expected: FAIL — both files error resolving `../server.js`.

- [ ] **Step 5: Write the utilities**

`AgentPlatform-BackEnd/server/utils/status.js`:

```js
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const notFound = (message) => new HttpError(404, 'not_found', message);
export const badRequest = (message) => new HttpError(400, 'bad_request', message);

export const ok = (res, body) => res.status(200).json(body);
export const created = (res, body) => res.status(201).json(body);
export const noContent = (res) => res.status(204).end();
```

`AgentPlatform-BackEnd/server/utils/ids.js`:

```js
import { randomBytes } from 'node:crypto';

export const createId = (prefix) => `${prefix}_${randomBytes(6).toString('base64url').toLowerCase().slice(0, 8)}`;
```

- [ ] **Step 6: Write the tool registry fixture**

`AgentPlatform-BackEnd/server/data/tools.js`:

```js
export const TOOLS = [
  {
    id: 'current_time',
    label: 'Current time',
    description: 'Reads the current time in a given timezone.',
    params: [
      { name: 'timezone', type: 'string', required: false, description: 'IANA timezone name. Defaults to UTC.' },
    ],
  },
  {
    id: 'http_request',
    label: 'HTTP request',
    description: 'Fetches a URL and returns the status and body.',
    params: [
      { name: 'url', type: 'string', required: true, description: 'Absolute URL to request.' },
      { name: 'method', type: 'string', required: false, description: 'HTTP method. Defaults to GET.' },
    ],
  },
  {
    id: 'calculator',
    label: 'Calculator',
    description: 'Evaluates an arithmetic expression.',
    params: [
      { name: 'expression', type: 'string', required: true, description: 'Expression to evaluate.' },
    ],
  },
  {
    id: 'knowledge_search',
    label: 'Knowledge search',
    description: 'Searches the internal knowledge base.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Search terms.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum results. Defaults to 5.' },
    ],
  },
];
```

- [ ] **Step 7: Write the controller and router**

`AgentPlatform-BackEnd/server/controllers/toolController.js`:

```js
import { TOOLS } from '../data/tools.js';
import { ok } from '../utils/status.js';

export const listTools = (_req, res) => ok(res, TOOLS);
```

`AgentPlatform-BackEnd/server/routes/toolRoutes.js`:

```js
import { Router } from 'express';
import { listTools } from '../controllers/toolController.js';

const router = Router();

router.get('/', listTools);

export default router;
```

- [ ] **Step 8: Write the server**

`AgentPlatform-BackEnd/server/server.js`:

```js
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import toolRoutes from './routes/toolRoutes.js';
import { HttpError, ok } from './utils/status.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => ok(res, { status: 'ok', mode: 'mock' }));
  app.use('/api/tools', toolRoutes);

  app.use((req, _res, next) => {
    next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
  });

  // Four parameters are required for Express to treat this as an error handler.
  app.use((err, _req, res, _next) => {
    const status = err instanceof HttpError ? err.status : 500;
    const code = err instanceof HttpError ? err.code : 'internal_error';
    const message = status === 500 ? 'Something went wrong on the server.' : err.message;
    if (status === 500) console.error(err);
    res.status(status).json({ error: { code, message } });
  });

  return app;
};

const isEntryModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryModule) {
  const port = Number(process.env.PORT ?? 4000);
  createApp().listen(port, () => console.log(`agent platform api listening on :${port} (mock mode)`));
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run from `AgentPlatform-BackEnd/server`: `npm test`
Expected: PASS, 5 tests across 2 files.

- [ ] **Step 10: Verify the server actually boots**

Run from `AgentPlatform-BackEnd/server`: `npm start`
Expected: logs `agent platform api listening on :4000 (mock mode)`. Confirm with `curl -s http://localhost:4000/api/health` returning `{"status":"ok","mode":"mock"}`, then stop the server.

- [ ] **Step 11: Write the backend README**

`AgentPlatform-BackEnd/README.md`:

```markdown
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
```

- [ ] **Step 12: Commit**

```bash
git add AgentPlatform-BackEnd
git commit -m "feat: scaffold agent platform api with health and tool registry"
```

---

### Task 2: Agent store and CRUD routes

**Files:**
- Create: `AgentPlatform-BackEnd/server/data/agents.js`
- Create: `AgentPlatform-BackEnd/server/services/agentStore.js`
- Create: `AgentPlatform-BackEnd/server/controllers/agentController.js`, `AgentPlatform-BackEnd/server/routes/agentRoutes.js`
- Modify: `AgentPlatform-BackEnd/server/server.js` — mount `/api/agents`
- Test: `AgentPlatform-BackEnd/server/tests/agents.test.js`

**Interfaces:**
- Consumes: `createId` from `utils/ids.js`; `HttpError`, `notFound`, `badRequest`, `ok`, `created`, `noContent` from `utils/status.js`; `TOOLS` from `data/tools.js`; `createApp` from `server.js`.
- Produces from `services/agentStore.js`:
  - `listAgents(): Agent[]` — newest `updatedAt` first.
  - `getAgent(id): Agent | undefined`
  - `createAgent(input): Agent` — `input` is a partial; missing fields take defaults.
  - `updateAgent(id, patch): Agent | undefined` — refreshes `updatedAt`.
  - `deleteAgent(id): boolean`
  - `resetStore(): void` — restores the seed set; tests only.
  - `Agent = { id, name, icon, description, model, systemPrompt, toolIds, status, createdAt, updatedAt }` with `status` in `'active' | 'draft'`.
- Produces from `data/agents.js`: `SEED_AGENTS: Agent[]`, `AGENT_DEFAULTS`, `DEFAULT_MODEL = 'gemini-2.5-flash'`, `MODEL_IDS`.

- [ ] **Step 1: Write the failing tests**

`AgentPlatform-BackEnd/server/tests/agents.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { resetStore } from '../services/agentStore.js';

const app = () => createApp();

beforeEach(() => resetStore());

describe('GET /api/agents', () => {
  it('returns the seeded agents', async () => {
    const res = await request(app()).get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
  });

  it('covers the render states the UI needs', async () => {
    const { body } = await request(app()).get('/api/agents');
    expect(body.some((agent) => agent.toolIds.length > 2)).toBe(true);
    expect(body.some((agent) => agent.toolIds.length === 1)).toBe(true);
    expect(body.some((agent) => agent.toolIds.length === 0 && agent.status === 'draft')).toBe(true);
    expect(body.some((agent) => agent.name.length > 24)).toBe(true);
  });
});

describe('POST /api/agents', () => {
  it('creates a draft with defaults', async () => {
    const res = await request(app()).post('/api/agents').send({});
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New agent');
    expect(res.body.status).toBe('draft');
    expect(res.body.model).toBe('gemini-2.5-flash');
    expect(res.body.toolIds).toEqual([]);
    expect(res.body.id).toMatch(/^agent_/);
  });

  it('accepts supplied fields', async () => {
    const res = await request(app())
      .post('/api/agents')
      .send({ name: 'Copy of Support', toolIds: ['current_time'], status: 'active' });
    expect(res.body.name).toBe('Copy of Support');
    expect(res.body.toolIds).toEqual(['current_time']);
    expect(res.body.status).toBe('active');
  });

  it('rejects an unknown tool id', async () => {
    const res = await request(app()).post('/api/agents').send({ toolIds: ['teleport'] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('teleport');
  });
});

describe('PATCH /api/agents/:id', () => {
  it('applies the patch and moves updatedAt forward', async () => {
    const { body: agent } = await request(app()).get('/api/agents').then((res) => ({ body: res.body[0] }));
    const res = await request(app())
      .patch(`/api/agents/${agent.id}`)
      .send({ systemPrompt: 'Be terse.' });
    expect(res.status).toBe(200);
    expect(res.body.systemPrompt).toBe('Be terse.');
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(agent.updatedAt).getTime());
  });

  it('ignores attempts to change the id', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).patch(`/api/agents/${agents[0].id}`).send({ id: 'agent_hijack' });
    expect(res.body.id).toBe(agents[0].id);
  });

  it('rejects an unknown model', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).patch(`/api/agents/${agents[0].id}`).send({ model: 'gpt-4' });
    expect(res.status).toBe(400);
  });

  it('404s for a missing agent', async () => {
    const res = await request(app()).patch('/api/agents/agent_nope').send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('DELETE /api/agents/:id', () => {
  it('removes the agent', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).delete(`/api/agents/${agents[0].id}`);
    expect(res.status).toBe(204);
    const after = await request(app()).get('/api/agents');
    expect(after.body).toHaveLength(3);
  });

  it('404s for a missing agent', async () => {
    const res = await request(app()).delete('/api/agents/agent_nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/agents/:id', () => {
  it('returns one agent', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).get(`/api/agents/${agents[0].id}`);
    expect(res.body.id).toBe(agents[0].id);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-BackEnd/server`: `npm test -- agents`
Expected: FAIL — cannot resolve `../services/agentStore.js`.

- [ ] **Step 3: Write the seed data**

`AgentPlatform-BackEnd/server/data/agents.js`:

```js
export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const MODEL_IDS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

export const AGENT_DEFAULTS = {
  name: 'New agent',
  icon: '🧩',
  description: '',
  model: DEFAULT_MODEL,
  systemPrompt: '',
  toolIds: [],
  status: 'draft',
};

// Fixed timestamps keep the seeded relative times stable and reviewable.
const HOURS = 60 * 60 * 1000;
const base = new Date('2026-08-04T12:00:00.000Z').getTime();
const at = (hoursAgo) => new Date(base - hoursAgo * HOURS).toISOString();

export const SEED_AGENTS = [
  {
    id: 'agent_support',
    name: 'Support Bot',
    icon: '🎧',
    description: 'Answers billing and account questions for the support inbox.',
    model: 'gemini-2.5-flash',
    systemPrompt:
      'You are the support agent for a subscription product.\n\n' +
      'Answer in two sentences or fewer. Quote exact policy numbers rather than\n' +
      'paraphrasing them. When a question needs the current time or a live status\n' +
      'check, call the tool instead of guessing. If you cannot answer from the\n' +
      'tools and the policy text, say so and offer to escalate.',
    toolIds: ['current_time', 'http_request'],
    status: 'active',
    createdAt: at(720),
    updatedAt: at(2),
  },
  {
    id: 'agent_research',
    name: 'Research Assistant',
    icon: '🔭',
    description: 'Gathers sources and summarises them with citations.',
    model: 'gemini-2.5-pro',
    systemPrompt:
      'You research questions and report findings with citations.\n\n' +
      'Search the knowledge base before reaching for the web. Show your arithmetic\n' +
      'through the calculator tool rather than doing it in your head.',
    toolIds: ['knowledge_search', 'http_request', 'calculator'],
    status: 'active',
    createdAt: at(600),
    updatedAt: at(24),
  },
  {
    id: 'agent_metrics',
    name: 'Metrics Analyst',
    icon: '📊',
    description: 'Converts raw usage numbers into a plain-language readout.',
    model: 'gemini-2.0-flash',
    systemPrompt: 'You explain usage metrics in plain language. Always show the calculation.',
    toolIds: ['calculator'],
    status: 'active',
    createdAt: at(400),
    updatedAt: at(72),
  },
  {
    id: 'agent_drafter',
    name: 'Release Notes Drafter (internal review copy)',
    icon: '✍️',
    description:
      'Turns a list of merged pull requests into release notes written for customers rather than for engineers, grouped by the part of the product each change affects.',
    model: 'gemini-2.5-flash',
    systemPrompt: '',
    toolIds: [],
    status: 'draft',
    createdAt: at(200),
    updatedAt: at(120),
  },
];
```

- [ ] **Step 4: Write the store**

`AgentPlatform-BackEnd/server/services/agentStore.js`:

```js
import { AGENT_DEFAULTS, MODEL_IDS, SEED_AGENTS } from '../data/agents.js';
import { TOOLS } from '../data/tools.js';
import { badRequest } from '../utils/status.js';
import { createId } from '../utils/ids.js';

const agents = new Map();

const clone = (agent) => structuredClone(agent);

export const resetStore = () => {
  agents.clear();
  for (const agent of SEED_AGENTS) agents.set(agent.id, clone(agent));
};

resetStore();

const WRITABLE = [
  'name',
  'icon',
  'description',
  'model',
  'systemPrompt',
  'toolIds',
  'status',
];

const validate = (patch) => {
  if (patch.model !== undefined && !MODEL_IDS.includes(patch.model)) {
    throw badRequest(`Unknown model "${patch.model}".`);
  }
  if (patch.status !== undefined && !['active', 'draft'].includes(patch.status)) {
    throw badRequest(`Unknown status "${patch.status}".`);
  }
  if (patch.toolIds !== undefined) {
    if (!Array.isArray(patch.toolIds)) throw badRequest('toolIds must be an array.');
    const known = new Set(TOOLS.map((tool) => tool.id));
    const unknown = patch.toolIds.filter((id) => !known.has(id));
    if (unknown.length > 0) throw badRequest(`Unknown tool ids: ${unknown.join(', ')}.`);
  }
};

// Drops keys the client must not set (id, createdAt, updatedAt) and undefined values.
const pickWritable = (input) =>
  Object.fromEntries(
    Object.entries(input ?? {}).filter(([key, value]) => WRITABLE.includes(key) && value !== undefined),
  );

export const listAgents = () =>
  [...agents.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);

export const getAgent = (id) => {
  const agent = agents.get(id);
  return agent ? clone(agent) : undefined;
};

export const createAgent = (input) => {
  const patch = pickWritable(input);
  validate(patch);
  const now = new Date().toISOString();
  const agent = {
    ...AGENT_DEFAULTS,
    ...patch,
    id: createId('agent'),
    createdAt: now,
    updatedAt: now,
  };
  agents.set(agent.id, agent);
  return clone(agent);
};

export const updateAgent = (id, input) => {
  const existing = agents.get(id);
  if (!existing) return undefined;
  const patch = pickWritable(input);
  validate(patch);
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  agents.set(id, updated);
  return clone(updated);
};

export const deleteAgent = (id) => agents.delete(id);
```

- [ ] **Step 5: Write the controller and router**

`AgentPlatform-BackEnd/server/controllers/agentController.js`:

```js
import * as store from '../services/agentStore.js';
import { created, noContent, notFound, ok } from '../utils/status.js';

export const listAgents = (_req, res) => ok(res, store.listAgents());

export const getAgent = (req, res, next) => {
  const agent = store.getAgent(req.params.id);
  if (!agent) return next(notFound(`No agent with id "${req.params.id}".`));
  return ok(res, agent);
};

export const createAgent = (req, res, next) => {
  try {
    return created(res, store.createAgent(req.body));
  } catch (error) {
    return next(error);
  }
};

export const updateAgent = (req, res, next) => {
  try {
    const agent = store.updateAgent(req.params.id, req.body);
    if (!agent) return next(notFound(`No agent with id "${req.params.id}".`));
    return ok(res, agent);
  } catch (error) {
    return next(error);
  }
};

export const deleteAgent = (req, res, next) => {
  if (!store.deleteAgent(req.params.id)) {
    return next(notFound(`No agent with id "${req.params.id}".`));
  }
  return noContent(res);
};
```

`AgentPlatform-BackEnd/server/routes/agentRoutes.js`:

```js
import { Router } from 'express';
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
} from '../controllers/agentController.js';

const router = Router();

router.get('/', listAgents);
router.post('/', createAgent);
router.get('/:id', getAgent);
router.patch('/:id', updateAgent);
router.delete('/:id', deleteAgent);

export default router;
```

- [ ] **Step 6: Mount the router**

In `AgentPlatform-BackEnd/server/server.js`, add the import beside the existing `toolRoutes` import:

```js
import agentRoutes from './routes/agentRoutes.js';
```

and mount it immediately before the `/api/tools` line:

```js
  app.use('/api/agents', agentRoutes);
  app.use('/api/tools', toolRoutes);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run from `AgentPlatform-BackEnd/server`: `npm test`
Expected: PASS, all files.

- [ ] **Step 8: Commit**

```bash
git add AgentPlatform-BackEnd
git commit -m "feat: add agent store and CRUD routes"
```

---

### Task 3: Mock execution service and the chat route

**Files:**
- Create: `AgentPlatform-BackEnd/server/data/runs.js`
- Create: `AgentPlatform-BackEnd/server/services/mockExecutionService.js`
- Create: `AgentPlatform-BackEnd/server/controllers/chatController.js`, `AgentPlatform-BackEnd/server/routes/chatRoutes.js`
- Modify: `AgentPlatform-BackEnd/server/server.js` — mount `/api/chat`
- Test: `AgentPlatform-BackEnd/server/tests/chat.test.js`

**Interfaces:**
- Consumes: `getAgent` from `services/agentStore.js`; `createId` from `utils/ids.js`; `notFound`, `badRequest`, `ok` from `utils/status.js`.
- Produces from `services/mockExecutionService.js`: `executeAgent(agent, content): Message`, where

  ```
  Message   = { id, role: 'assistant', content, toolCalls, model, latencyMs, status, createdAt }
  ToolCall  = { id, toolId, args, result?, error?, durationMs, status: 'ok' | 'error' }
  ```

  Rules: tool calls come from the agent's first two `toolIds` in order; an agent with no tools returns `toolCalls: []`. A `content` containing the word `fail` (case-insensitive) makes the **last** produced call `status: 'error'` with `error` set and no `result`, and the message `status: 'error'`. `latencyMs` is the sum of the call durations plus a fixed 180ms of model time. Every call carries a non-zero `durationMs`; the frontend paces the reveal from it (§8.2).
- Produces `POST /api/chat/:agentId/messages` taking `{ content }` and returning `{ message }`. Returns 400 when `content` is missing or blank, 404 when the agent does not exist. It does not stream and does not stall.

- [ ] **Step 1: Write the failing tests**

`AgentPlatform-BackEnd/server/tests/chat.test.js`:

```js
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { resetStore } from '../services/agentStore.js';

const app = () => createApp();

beforeEach(() => resetStore());

describe('POST /api/chat/:agentId/messages', () => {
  it('returns a finished assistant message', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'what time is it in Tokyo?' });

    expect(res.status).toBe(200);
    const { message } = res.body;
    expect(message.role).toBe('assistant');
    expect(message.status).toBe('done');
    expect(message.content.length).toBeGreaterThan(0);
    expect(message.model).toBe('gemini-2.5-flash');
    expect(message.id).toMatch(/^msg_/);
  });

  it('calls the agent tools in order, each with a duration the client can pace from', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'status check' });

    const { toolCalls } = res.body.message;
    expect(toolCalls.map((call) => call.toolId)).toEqual(['current_time', 'http_request']);
    for (const call of toolCalls) {
      expect(call.status).toBe('ok');
      expect(call.durationMs).toBeGreaterThan(0);
      expect(call.result).toBeDefined();
      expect(call.id).toMatch(/^call_/);
    }
  });

  it('caps tool calls at two', async () => {
    const res = await request(app())
      .post('/api/chat/agent_research/messages')
      .send({ content: 'summarise the refund policy' });
    expect(res.body.message.toolCalls).toHaveLength(2);
  });

  it('returns no tool calls for an agent with no tools', async () => {
    const res = await request(app())
      .post('/api/chat/agent_drafter/messages')
      .send({ content: 'draft notes' });
    expect(res.body.message.toolCalls).toEqual([]);
    expect(res.body.message.status).toBe('done');
  });

  it('reports latency as the sum of durations plus model time', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'status check' });
    const { message } = res.body;
    const toolTime = message.toolCalls.reduce((total, call) => total + call.durationMs, 0);
    expect(message.latencyMs).toBe(toolTime + 180);
  });

  it('fails the last call when the message contains "fail"', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'make this FAIL please' });

    const { message } = res.body;
    expect(message.status).toBe('error');
    const last = message.toolCalls.at(-1);
    expect(last.status).toBe('error');
    expect(last.error).toContain('connection refused');
    expect(last.result).toBeUndefined();
    expect(message.toolCalls[0].status).toBe('ok');
  });

  it('rejects a blank message', async () => {
    const res = await request(app()).post('/api/chat/agent_support/messages').send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('404s for an unknown agent', async () => {
    const res = await request(app()).post('/api/chat/agent_nope/messages').send({ content: 'hi' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-BackEnd/server`: `npm test -- chat`
Expected: FAIL — 404 on every request, since the route is not mounted.

- [ ] **Step 3: Write the run fixtures**

`AgentPlatform-BackEnd/server/data/runs.js`:

```js
export const MODEL_TIME_MS = 180;

export const TOOL_FIXTURES = {
  current_time: {
    args: { timezone: 'Asia/Tokyo' },
    result: '2026-08-04T21:03:41+09:00',
    durationMs: 118,
  },
  http_request: {
    args: { url: 'https://status.example.com/health', method: 'GET' },
    result: { status: 200, latencyMs: 41, body: { state: 'healthy' } },
    durationMs: 412,
  },
  calculator: {
    args: { expression: '(184320 / 1024) * 0.87' },
    result: 156.6,
    durationMs: 24,
  },
  knowledge_search: {
    args: { query: 'refund window policy', limit: 3 },
    result: [
      { title: 'Refunds — 30 day window', score: 0.94 },
      { title: 'Proration on downgrade', score: 0.71 },
    ],
    durationMs: 268,
  },
};

export const FAILURE = {
  error: 'connection refused after 800ms',
  durationMs: 812,
};

export const ANSWERS = {
  agent_support:
    "It's 9:03 PM in Tokyo, and the status endpoint is healthy — 200 in 41 ms.",
  agent_research:
    'The refund window is 30 days from the invoice date. Downgrades prorate from the next cycle, not immediately.',
  agent_metrics: 'That works out to 156.6 GB billable, which is 87% of the 180 GB recorded.',
  agent_drafter:
    'This agent has no tools attached yet, so it can only answer from its system prompt.',
};

export const FALLBACK_ANSWER = 'Done. Expand a step above to see what each tool returned.';

export const failureAnswer = (toolId) =>
  `${toolId} failed: ${FAILURE.error}. Nothing was written, so retrying is safe.`;
```

- [ ] **Step 4: Write the execution service**

`AgentPlatform-BackEnd/server/services/mockExecutionService.js`:

```js
import {
  ANSWERS,
  FAILURE,
  FALLBACK_ANSWER,
  MODEL_TIME_MS,
  TOOL_FIXTURES,
  failureAnswer,
} from '../data/runs.js';
import { createId } from '../utils/ids.js';

const MAX_CALLS = 2;

const shouldFail = (content) => /\bfail/i.test(content);

const buildCall = (toolId) => {
  const fixture = TOOL_FIXTURES[toolId];
  return {
    id: createId('call'),
    toolId,
    args: structuredClone(fixture.args),
    result: structuredClone(fixture.result),
    durationMs: fixture.durationMs,
    status: 'ok',
  };
};

const failCall = (call) => ({
  id: call.id,
  toolId: call.toolId,
  args: call.args,
  error: FAILURE.error,
  durationMs: FAILURE.durationMs,
  status: 'error',
});

export const executeAgent = (agent, content) => {
  const toolIds = agent.toolIds.filter((id) => TOOL_FIXTURES[id]).slice(0, MAX_CALLS);
  let toolCalls = toolIds.map(buildCall);

  const failing = toolCalls.length > 0 && shouldFail(content);
  if (failing) {
    toolCalls = [...toolCalls.slice(0, -1), failCall(toolCalls.at(-1))];
  }

  const toolTime = toolCalls.reduce((total, call) => total + call.durationMs, 0);

  return {
    id: createId('msg'),
    role: 'assistant',
    content: failing
      ? failureAnswer(toolCalls.at(-1).toolId)
      : ANSWERS[agent.id] ?? FALLBACK_ANSWER,
    toolCalls,
    model: agent.model,
    latencyMs: toolTime + MODEL_TIME_MS,
    status: failing ? 'error' : 'done',
    createdAt: new Date().toISOString(),
  };
};
```

- [ ] **Step 5: Write the controller and router**

`AgentPlatform-BackEnd/server/controllers/chatController.js`:

```js
import { getAgent } from '../services/agentStore.js';
import { executeAgent } from '../services/mockExecutionService.js';
import { badRequest, notFound, ok } from '../utils/status.js';

export const createMessage = (req, res, next) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) return next(notFound(`No agent with id "${req.params.agentId}".`));

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (content.length === 0) return next(badRequest('A message needs some content.'));

  return ok(res, { message: executeAgent(agent, content) });
};
```

`AgentPlatform-BackEnd/server/routes/chatRoutes.js`:

```js
import { Router } from 'express';
import { createMessage } from '../controllers/chatController.js';

const router = Router();

router.post('/:agentId/messages', createMessage);

export default router;
```

- [ ] **Step 6: Mount the router**

In `AgentPlatform-BackEnd/server/server.js`, add the import:

```js
import chatRoutes from './routes/chatRoutes.js';
```

and mount it after the agents line:

```js
  app.use('/api/agents', agentRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/tools', toolRoutes);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run from `AgentPlatform-BackEnd/server`: `npm test`
Expected: PASS. The whole backend contract is now covered.

- [ ] **Step 8: Lint**

Run from `AgentPlatform-BackEnd/server`: `npm run lint`
Expected: no output, exit 0.

- [ ] **Step 9: Commit**

```bash
git add AgentPlatform-BackEnd
git commit -m "feat: add mock execution service and chat route"
```

---

## Phase B — Frontend foundation

### Task 4: Frontend scaffold, design tokens, and formatting

**Files:**
- Create: `AgentPlatform-FrontEnd/.gitignore`, `AgentPlatform-FrontEnd/README.md`
- Create: `AgentPlatform-FrontEnd/client/package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.env.example`, `.dockerignore`, `Dockerfile`, `nginx.conf`, `vitest.setup.ts`
- Create: `client/src/main.tsx`, `client/src/App.tsx`, `client/src/App.css`, `client/src/index.css`, `client/src/vite-env.d.ts`
- Create: `client/src/styles/tokens.css`, `client/src/styles/global.css`
- Create: `client/src/lib/format.ts`
- Test: `client/src/lib/format.test.ts`

**Interfaces:**
- Consumes: the running backend from Task 1 (dev proxy target only).
- Produces from `lib/format.ts`:
  - `formatRelativeTime(iso: string, now?: Date): string` — `'just now'` under 60s, `'5m ago'`, `'2h ago'`, `'3d ago'` under 7 days, otherwise `'28 Jul'`.
  - `formatDuration(ms: number): string` — `'118 ms'` under 1000, otherwise `'1.2 s'` to one decimal.
  - `formatClockTime(iso: string): string` — `'21:04:12'` in the viewer's local zone, zero-padded.
  - `formatJson(value: unknown): string` — two-space `JSON.stringify`; a bare string returns itself quoted; `undefined` returns `''`; never throws.
- Produces the token vocabulary every later task depends on. Names are fixed here and never redefined.
- Produces the Vite dev proxy: `/api` → `http://localhost:4000`, so `lib/api-host.ts` (Task 5) resolves to a same-origin relative path and no CORS preflight happens in development.

- [ ] **Step 1: Create the package manifest**

`AgentPlatform-FrontEnd/client/package.json`:

```json
{
  "name": "agent-platform-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.1.0",
    "@fontsource-variable/jetbrains-mono": "^5.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@playwright/test": "^1.50.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "eslint": "^9.17.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.19.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create the TypeScript, Vite, and lint config**

`AgentPlatform-FrontEnd/client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vitest.setup.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`AgentPlatform-FrontEnd/client/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "composite": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

`AgentPlatform-FrontEnd/client/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    exclude: ['node_modules/**', 'e2e/**'],
  },
});
```

`AgentPlatform-FrontEnd/client/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia, which useMediaQuery needs.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
```

`AgentPlatform-FrontEnd/client/eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'e2e-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
);
```

`AgentPlatform-FrontEnd/client/.env.example`:

```
# Leave blank in development: Vite proxies /api to the backend.
# Set to an absolute origin when the API is on another host.
VITE_API_HOST=
```

`AgentPlatform-FrontEnd/.gitignore`:

```
node_modules/
dist/
.env
e2e-results/
playwright-report/
*.log
```

- [ ] **Step 3: Create the HTML entry and container config**

`AgentPlatform-FrontEnd/client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>Agent Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`AgentPlatform-FrontEnd/client/.dockerignore`:

```
node_modules
dist
.env
e2e
```

`AgentPlatform-FrontEnd/client/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`AgentPlatform-FrontEnd/client/nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;

  # Client-side routing: unknown paths fall through to the app shell.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Same-origin API, so the browser never needs CORS.
  location /api/ {
    proxy_pass http://api:4000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

- [ ] **Step 4: Install dependencies**

Run from `AgentPlatform-FrontEnd/client`: `npm install`
Expected: completes without peer-dependency errors.

- [ ] **Step 5: Write the design tokens**

`AgentPlatform-FrontEnd/client/src/styles/tokens.css`. This file is the single source of visual truth; nothing else in the app declares a raw color, radius, or duration.

```css
:root {
  /* Color — §4.1. Warm near-black, never pure black. */
  --ink: #37352f;
  --ink-muted: #787774;
  --ink-faint: #9b9a97;
  --paper: #ffffff;
  --shell: #f7f7f5;
  --rule: #e9e9e7;
  --hover: rgba(55, 53, 47, 0.06);
  --active: rgba(55, 53, 47, 0.08);
  --scrim: rgba(15, 15, 15, 0.28);

  --signal: #2383e2;
  --signal-ring: rgba(35, 131, 226, 0.28);
  --signal-hover: #1b6fc4;

  /* Reserved for tool-call machinery only. Never a button, link, or heading. */
  --trace: #9065b0;
  --trace-ink: #6940a5;
  --trace-wash: #e8deee;

  --ok: #448361;
  --warn: #d9730d;
  --err: #d44c47;
  --err-wash: #ffe2dd;

  /* Type */
  --font-ui: 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --text-title: 40px;
  --text-peek-title: 24px;
  --text-heading: 16px;
  --text-body: 16px;
  --text-ui: 14px;
  --text-label: 12px;
  --text-meta: 11px;

  /* Space */
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 12px;
  --space-6: 16px;
  --space-7: 24px;
  --space-8: 32px;
  --space-9: 48px;
  --space-10: 64px;

  /* Radius — 3px is Notion's default, and it is deliberate. */
  --radius-sm: 3px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 999px;

  /* Elevation, used sparingly. A rule beats a shadow wherever a rule will do. */
  --shadow-popover: 0 14px 28px -6px rgba(15, 15, 15, 0.15), 0 2px 4px rgba(15, 15, 15, 0.1);
  --shadow-peek: -4px 0 16px -6px rgba(15, 15, 15, 0.12);
  --shadow-sheet: 0 -8px 24px -8px rgba(15, 15, 15, 0.18);

  /* Layout */
  --sidebar-width: 240px;
  --peek-width: 480px;
  --content-width: 708px;
  --topbar-height: 45px;
  --row-height: 40px;

  /* Motion */
  --dur-fast: 120ms;
  --dur-mid: 180ms;
  --dur-slow: 240ms;
  --ease: cubic-bezier(0.2, 0, 0.2, 1);
}

/*
  One lever switches off every transition and animation in the app. Components
  animate with var(--dur-*) and need no media query of their own.
*/
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 1ms;
    --dur-mid: 1ms;
    --dur-slow: 1ms;
  }
}
```

- [ ] **Step 6: Write the global stylesheet**

`AgentPlatform-FrontEnd/client/src/styles/global.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

html,
body,
#root {
  height: 100%;
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: var(--text-body);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3 {
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}

input,
textarea,
select {
  font: inherit;
  color: inherit;
}

a {
  color: var(--signal);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

ul,
ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Never remove this without providing a replacement. */
:focus-visible {
  outline: 2px solid var(--signal);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

:focus:not(:focus-visible) {
  outline: none;
}

::placeholder {
  color: var(--ink-faint);
}

::selection {
  background: var(--signal-ring);
}

/* Thin, unobtrusive scrollbars, matching the chrome. */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--rule) transparent;
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-thumb {
  background: var(--rule);
  border: 3px solid transparent;
  border-radius: var(--radius-pill);
  background-clip: content-box;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

/* Visually hidden but available to screen readers. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

`AgentPlatform-FrontEnd/client/src/index.css`:

```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/jetbrains-mono';
@import './styles/tokens.css';
@import './styles/global.css';
```

- [ ] **Step 7: Write the failing formatting tests**

`AgentPlatform-FrontEnd/client/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDuration, formatJson, formatRelativeTime } from './format';

const now = new Date('2026-08-04T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('reads "just now" inside a minute', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('just now');
    expect(formatRelativeTime(ago(59 * SECOND), now)).toBe('just now');
  });

  it('switches to minutes at exactly one minute', () => {
    expect(formatRelativeTime(ago(MINUTE), now)).toBe('1m ago');
    expect(formatRelativeTime(ago(59 * MINUTE), now)).toBe('59m ago');
  });

  it('switches to hours at exactly one hour', () => {
    expect(formatRelativeTime(ago(HOUR), now)).toBe('1h ago');
    expect(formatRelativeTime(ago(23 * HOUR), now)).toBe('23h ago');
  });

  it('switches to days at exactly one day', () => {
    expect(formatRelativeTime(ago(DAY), now)).toBe('1d ago');
    expect(formatRelativeTime(ago(6 * DAY), now)).toBe('6d ago');
  });

  it('falls back to a date at seven days', () => {
    expect(formatRelativeTime('2026-07-28T12:00:00.000Z', now)).toBe('28 Jul');
  });

  it('never reports a negative age for a clock skewed slightly ahead', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 5 * SECOND).toISOString(), now)).toBe('just now');
  });
});

describe('formatDuration', () => {
  it('reports whole milliseconds below a second', () => {
    expect(formatDuration(118)).toBe('118 ms');
    expect(formatDuration(999)).toBe('999 ms');
    expect(formatDuration(0)).toBe('0 ms');
  });

  it('reports seconds to one decimal from a second up', () => {
    expect(formatDuration(1000)).toBe('1.0 s');
    expect(formatDuration(1240)).toBe('1.2 s');
    expect(formatDuration(12500)).toBe('12.5 s');
  });

  it('rounds fractional milliseconds', () => {
    expect(formatDuration(117.6)).toBe('118 ms');
  });
});

describe('formatClockTime', () => {
  it('zero-pads to hh:mm:ss', () => {
    expect(formatClockTime('2026-08-04T09:04:07.000Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('formatJson', () => {
  it('indents objects by two spaces', () => {
    expect(formatJson({ timezone: 'Asia/Tokyo' })).toBe('{\n  "timezone": "Asia/Tokyo"\n}');
  });

  it('quotes a bare string', () => {
    expect(formatJson('2026-08-04T21:03:41+09:00')).toBe('"2026-08-04T21:03:41+09:00"');
  });

  it('returns an empty string for undefined', () => {
    expect(formatJson(undefined)).toBe('');
  });

  it('survives a value it cannot serialise', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatJson(circular)).toBe('[unserialisable]');
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 9: Write the formatting module**

`AgentPlatform-FrontEnd/client/src/lib/format.ts`:

```ts
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "just now" | "5m ago" | "2h ago" | "3d ago" | "28 Jul" */
export const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
  // Clamp at zero: a server clock a few seconds ahead should not read "-1m ago".
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());

  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  return dateFormatter.format(new Date(iso));
};

/** "118 ms" below a second, "1.2 s" at or above it. */
export const formatDuration = (ms: number): string =>
  ms < SECOND ? `${Math.round(ms)} ms` : `${(ms / SECOND).toFixed(1)} s`;

/** Local wall-clock time, zero-padded: "21:04:12". */
export const formatClockTime = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** Two-space JSON for the trace code blocks. Never throws. */
export const formatJson = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '[unserialisable]';
  }
};
```

- [ ] **Step 10: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS, 14 tests.

- [ ] **Step 11: Write a placeholder app shell so the dev server boots**

`AgentPlatform-FrontEnd/client/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`AgentPlatform-FrontEnd/client/src/App.css`:

```css
.app {
  display: flex;
  height: 100%;
  overflow: hidden;
}
```

`AgentPlatform-FrontEnd/client/src/App.tsx` — Task 9 replaces this with the real shell:

```tsx
import './App.css';

const App = () => <div className="app">Agent Platform</div>;

export default App;
```

`AgentPlatform-FrontEnd/client/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 12: Verify the dev server boots and typechecks**

Run from `AgentPlatform-FrontEnd/client`: `npm run typecheck` — expected: no errors.
Then `npm run dev` and open `http://localhost:5173`. Expected: the words "Agent Platform" render in Inter on a white background, with no console errors. Stop the server.

- [ ] **Step 13: Write the frontend README**

Write `AgentPlatform-FrontEnd/README.md` with this content (the fenced blocks inside are part of the file):

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

- [ ] **Step 14: Commit**

```bash
git add AgentPlatform-FrontEnd
git commit -m "feat: scaffold client with design tokens and formatting helpers"
```

---

### Task 5: Shared types, API client, and the registry hooks

**Files:**
- Create: `client/src/types/agent.ts`, `client/src/types/tool.ts`, `client/src/types/message.ts`
- Create: `client/src/lib/api-host.ts`, `client/src/lib/api-client.ts`, `client/src/lib/agent-icons.ts`
- Create: `client/src/config/models.ts`, `client/src/data/suggested-prompts.ts`
- Create: `client/src/hooks/useTools.ts`, `client/src/hooks/useApiHealth.ts`, `client/src/hooks/useMediaQuery.ts`
- Test: `client/src/lib/api-client.test.ts`, `client/src/hooks/useApiHealth.test.ts`, `client/src/data/suggested-prompts.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces types, mirroring the backend exactly:

  ```ts
  type AgentStatus = 'active' | 'draft';
  interface Agent { id: string; name: string; icon: string; description: string; model: string;
    systemPrompt: string; toolIds: string[]; status: AgentStatus; createdAt: string; updatedAt: string }
  type AgentPatch = Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>;
  interface ToolParam { name: string; type: 'string' | 'number' | 'boolean'; required: boolean; description: string }
  interface Tool { id: string; label: string; description: string; params: ToolParam[] }
  type ToolCallStatus = 'running' | 'ok' | 'error';
  interface ToolCall { id: string; toolId: string; args: unknown; result?: unknown; error?: string;
    durationMs: number; status: ToolCallStatus }
  type MessageRole = 'user' | 'assistant';
  type MessageStatus = 'thinking' | 'done' | 'error';
  interface Message { id: string; role: MessageRole; content: string; toolCalls?: ToolCall[];
    model?: string; latencyMs?: number; status: MessageStatus; createdAt: string }
  ```

- Produces from `lib/api-client.ts`:
  - `class ApiError extends Error { readonly status: number; readonly code: string }`
  - `apiGet<T>(path): Promise<T>`, `apiPost<T>(path, body?): Promise<T>`, `apiPatch<T>(path, body): Promise<T>`, `apiDelete(path): Promise<void>`
  - Every helper throws `ApiError` on a non-2xx response, reading `{ error: { code, message } }` when present, and throws `ApiError(0, 'network_error', …)` when `fetch` itself rejects.
- Produces `apiUrl(path: string): string` and `API_HOST: string` from `lib/api-host.ts`.
- Produces `MODELS: readonly ModelOption[]`, `DEFAULT_MODEL: string`, and `modelLabel(id: string): string` from `config/models.ts`, with `ModelOption = { id: string; label: string }`.
- Produces `AGENT_ICONS: readonly string[]` (exactly 24) and `defaultAgentIcon(seed: string): string` from `lib/agent-icons.ts`.
- Produces `suggestedPrompts(toolIds: readonly string[]): string[]`, always exactly 3.
- Produces `useTools(): { tools: Tool[]; loading: boolean; error: string | null }`, `toolLabel(tools: readonly Tool[], toolId: string): string`, and `resetToolCache(): void` (tests only).
- Produces `type ApiHealth = 'checking' | 'online' | 'offline'` and `useApiHealth(intervalMs?: number): ApiHealth`.
- Produces `useMediaQuery(query: string): boolean`, `BREAKPOINT_SIDEBAR = '(max-width: 900px)'`, `BREAKPOINT_SHEET = '(max-width: 700px)'`.

- [ ] **Step 1: Write the type modules**

`client/src/types/tool.ts`:

```ts
export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface Tool {
  id: string;
  label: string;
  description: string;
  params: ToolParam[];
}
```

`client/src/types/agent.ts`:

```ts
export type AgentStatus = 'active' | 'draft';

export interface Agent {
  id: string;
  name: string;
  /** Single emoji, one of AGENT_ICONS. */
  icon: string;
  description: string;
  model: string;
  systemPrompt: string;
  toolIds: string[];
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

/** The fields a client may write. id and the timestamps are server-owned. */
export type AgentPatch = Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>;
```

`client/src/types/message.ts`:

```ts
export type ToolCallStatus = 'running' | 'ok' | 'error';

export interface ToolCall {
  id: string;
  toolId: string;
  args: unknown;
  result?: unknown;
  error?: string;
  durationMs: number;
  status: ToolCallStatus;
}

export type MessageRole = 'user' | 'assistant';
export type MessageStatus = 'thinking' | 'done' | 'error';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  model?: string;
  latencyMs?: number;
  status: MessageStatus;
  createdAt: string;
}
```

- [ ] **Step 2: Write the failing API client tests**

`client/src/lib/api-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from './api-client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('apiGet', () => {
  it('returns the parsed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 'agent_support' }])));
    await expect(apiGet<{ id: string }[]>('/api/agents')).resolves.toEqual([{ id: 'agent_support' }]);
  });

  it('throws ApiError carrying the server code and message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { code: 'not_found', message: 'No agent with id "x".' } }, 404)),
    );
    const error = (await apiGet('/api/agents/x').catch((thrown: unknown) => thrown)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('not_found');
    expect(error.message).toBe('No agent with id "x".');
  });

  it('falls back to a readable message when the body is not the error envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway exploded', { status: 502 })));
    const error = (await apiGet('/api/agents').catch((thrown: unknown) => thrown)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('http_502');
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('reports a network failure as status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = (await apiGet('/api/agents').catch((thrown: unknown) => thrown)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.code).toBe('network_error');
  });
});

describe('apiPost', () => {
  it('sends JSON and returns the parsed body', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'agent_new' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiPost('/api/agents', { name: 'x' })).resolves.toEqual({ id: 'agent_new' });

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('omits the body when none is given', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 201));
    vi.stubGlobal('fetch', fetchMock);
    await apiPost('/api/agents');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).body).toBeUndefined();
  });
});

describe('apiPatch', () => {
  it('uses the PATCH method', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'agent_support' }));
    vi.stubGlobal('fetch', fetchMock);
    await apiPatch('/api/agents/agent_support', { name: 'Renamed' });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('PATCH');
  });
});

describe('apiDelete', () => {
  it('resolves on a 204 with no body to parse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    await expect(apiDelete('/api/agents/agent_support')).resolves.toBeUndefined();
  });

  it('throws on a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { code: 'not_found', message: 'gone' } }, 404)),
    );
    await expect(apiDelete('/api/agents/x')).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 3: Write the failing health-hook test**

`client/src/hooks/useApiHealth.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiHealth } from './useApiHealth';

afterEach(() => vi.unstubAllGlobals());

describe('useApiHealth', () => {
  it('starts as checking and settles online', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'ok', mode: 'mock' }), { status: 200 })),
    );

    const { result } = renderHook(() => useApiHealth(0));
    expect(result.current).toBe('checking');
    await waitFor(() => expect(result.current).toBe('online'));
  });

  it('settles offline when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const { result } = renderHook(() => useApiHealth(0));
    await waitFor(() => expect(result.current).toBe('offline'));
  });
});
```

- [ ] **Step 4: Write the failing suggested-prompts test**

`client/src/data/suggested-prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { suggestedPrompts } from './suggested-prompts';

describe('suggestedPrompts', () => {
  it('always returns exactly three prompts', () => {
    expect(suggestedPrompts([])).toHaveLength(3);
    expect(suggestedPrompts(['current_time'])).toHaveLength(3);
    expect(suggestedPrompts(['current_time', 'http_request', 'calculator', 'knowledge_search'])).toHaveLength(3);
  });

  it('leads with a prompt derived from the first tool', () => {
    expect(suggestedPrompts(['current_time'])[0]).toContain('Tokyo');
    expect(suggestedPrompts(['calculator'])[0]).toMatch(/\d/);
  });

  it('prefers tool-derived prompts over the generic fallbacks', () => {
    const prompts = suggestedPrompts(['current_time', 'http_request']);
    expect(prompts[0]).toContain('Tokyo');
    expect(prompts[1]).toContain('status.example.com');
  });

  it('falls back to generic prompts for an agent with no tools', () => {
    const prompts = suggestedPrompts([]);
    expect(prompts.every((prompt) => prompt.length > 0)).toBe(true);
    expect(new Set(prompts).size).toBe(3);
  });

  it('ignores unknown tool ids', () => {
    expect(suggestedPrompts(['teleport'])).toEqual(suggestedPrompts([]));
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: FAIL — three unresolved modules.

- [ ] **Step 6: Write the API host and client**

`client/src/lib/api-host.ts`:

```ts
/**
 * Blank in development: Vite proxies /api to the backend, so requests stay
 * same-origin and no CORS preflight happens. Set VITE_API_HOST to an absolute
 * origin when the API lives on another host.
 */
export const API_HOST = import.meta.env.VITE_API_HOST ?? '';

export const apiUrl = (path: string): string => `${API_HOST}${path}`;
```

`client/src/lib/api-client.ts`:

```ts
import { apiUrl } from './api-host';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isErrorEnvelope = (value: unknown): value is { error: { code: string; message: string } } => {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => undefined);
  if (isErrorEnvelope(body)) {
    return new ApiError(response.status, body.error.code, body.error.message);
  }
  return new ApiError(
    response.status,
    `http_${response.status}`,
    `The server returned ${response.status}. Try again in a moment.`,
  );
};

const request = async (path: string, init?: RequestInit): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(0, 'network_error', "Can't reach the server. Check that the API is running.");
  }
  if (!response.ok) throw await toApiError(response);
  return response;
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const apiGet = async <T>(path: string): Promise<T> =>
  (await request(path)).json() as Promise<T>;

export const apiPost = async <T>(path: string, body?: unknown): Promise<T> =>
  (await request(path, jsonInit('POST', body))).json() as Promise<T>;

export const apiPatch = async <T>(path: string, body: unknown): Promise<T> =>
  (await request(path, jsonInit('PATCH', body))).json() as Promise<T>;

export const apiDelete = async (path: string): Promise<void> => {
  await request(path, { method: 'DELETE' });
};
```

- [ ] **Step 7: Write the models, icons, and prompt data**

`client/src/config/models.ts`:

```ts
export interface ModelOption {
  id: string;
  label: string;
}

/** Gemini only: the brief prefers Google ADK as the agent framework. */
export const MODELS: readonly ModelOption[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const modelLabel = (id: string): string =>
  MODELS.find((model) => model.id === id)?.label ?? id;
```

`client/src/lib/agent-icons.ts`:

```ts
/**
 * A fixed set rather than a full emoji keyboard, so the table's icon column
 * stays visually coherent.
 */
export const AGENT_ICONS: readonly string[] = [
  '🧩', '🎧', '🔭', '📊', '✍️', '🧭', '🛠️', '📮',
  '🧪', '🗂️', '🔔', '🪶', '🧱', '🛰️', '📌', '🧵',
  '🔍', '📐', '🎯', '🗝️', '🧮', '📎', '🚦', '🫧',
];

/** Deterministic pick, so an agent keeps its icon across reloads. */
export const defaultAgentIcon = (seed: string): string => {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 4096;
  return AGENT_ICONS[hash % AGENT_ICONS.length] ?? '🧩';
};
```

`client/src/data/suggested-prompts.ts`:

```ts
/** Keyed by tool id so a prompt actually exercises the tool it belongs to. */
const TOOL_PROMPTS: Record<string, string> = {
  current_time: 'What time is it in Tokyo right now?',
  http_request: 'Is https://status.example.com/health responding?',
  calculator: 'What is 184320 divided by 1024, times 0.87?',
  knowledge_search: 'What does our policy say about the refund window?',
};

const GENERIC_PROMPTS = [
  'Introduce yourself in one sentence.',
  'What can you help me with?',
  'Summarise your instructions in three bullets.',
];

/** Always exactly three, tool-derived first, generic filling the remainder. */
export const suggestedPrompts = (toolIds: readonly string[]): string[] => {
  const fromTools = toolIds
    .map((id) => TOOL_PROMPTS[id])
    .filter((prompt): prompt is string => prompt !== undefined);

  const filler = GENERIC_PROMPTS.filter((prompt) => !fromTools.includes(prompt));
  return [...fromTools, ...filler].slice(0, 3);
};
```

- [ ] **Step 8: Write the hooks**

`client/src/hooks/useTools.ts`:

```ts
import { useEffect, useState } from 'react';
import { ApiError, apiGet } from '../lib/api-client';
import type { Tool } from '../types/tool';

/** The registry does not change while the app runs, so one fetch is enough. */
let cache: Tool[] | null = null;

export const toolLabel = (tools: readonly Tool[], toolId: string): string =>
  tools.find((tool) => tool.id === toolId)?.label ?? toolId;

export const useTools = () => {
  const [tools, setTools] = useState<Tool[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache !== null) return;
    let active = true;

    apiGet<Tool[]>('/api/tools')
      .then((fetched) => {
        cache = fetched;
        if (active) setTools(fetched);
      })
      .catch((thrown: unknown) => {
        if (active) {
          setError(thrown instanceof ApiError ? thrown.message : 'Could not load the tool registry.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { tools, loading, error };
};

/** Tests only: drops the module cache between cases. */
export const resetToolCache = () => {
  cache = null;
};
```

`client/src/hooks/useApiHealth.ts`:

```ts
import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api-client';

export type ApiHealth = 'checking' | 'online' | 'offline';

const DEFAULT_INTERVAL_MS = 15_000;

/** Drives the sidebar status pill. Pass intervalMs 0 to check exactly once. */
export const useApiHealth = (intervalMs: number = DEFAULT_INTERVAL_MS): ApiHealth => {
  const [health, setHealth] = useState<ApiHealth>('checking');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        await apiGet<{ status: string }>('/api/health');
        if (active) setHealth('online');
      } catch {
        if (active) setHealth('offline');
      }
      if (active && intervalMs > 0) timer = setTimeout(check, intervalMs);
    };

    void check();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return health;
};
```

`client/src/hooks/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react';

export const BREAKPOINT_SIDEBAR = '(max-width: 900px)';
export const BREAKPOINT_SHEET = '(max-width: 700px)';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};
```

- [ ] **Step 9: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS, all files.

- [ ] **Step 10: Verify the client and server agree**

Start the backend (`npm run dev` in `AgentPlatform-BackEnd/server`), then run from `AgentPlatform-FrontEnd/client`:

```bash
npm run typecheck
```

Expected: no errors. Then confirm the shape the client expects:

```bash
curl -s http://localhost:4000/api/tools
```

Expected: a JSON array whose first element has `id: "current_time"`. Stop the backend.

- [ ] **Step 11: Commit**

```bash
git add AgentPlatform-FrontEnd
git commit -m "feat: add shared types, api client, and registry hooks"
```

---

## Phase C — The primitive kit

Everything in `components/ui/` is presentation only. No `fetch`, no hooks from `hooks/`, no knowledge of agents or messages. That is what makes these testable without a server and reusable across both surfaces.

### Task 6: Button, Chip, Skeleton, and Select

**Files:**
- Create: `client/src/components/ui/button.tsx`, `client/src/components/ui/button.css`
- Create: `client/src/components/ui/select.tsx`, `client/src/components/ui/select.css`
- Create: `client/src/components/ui/skeleton.tsx`, `client/src/components/ui/skeleton.css`
- Create: `client/src/components/ui/chip/chip.tsx`, `chip.css`, `index.ts`
- Test: `client/src/components/ui/button.test.tsx`, `client/src/components/ui/chip/chip.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 4.
- Produces:
  - `Button` — props `{ variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; children: ReactNode }` plus every native `<button>` attribute. Defaults: `variant='secondary'`, `size='md'`, `type='button'`. Never renders an `<a>`.
  - `Select` — props `{ label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void; mono?: boolean; id?: string }`. Renders a native `<select>` with a bound `<label>`; `mono` sets the mono face for model ids. `label` is required and is visually hidden when the field sits in a property row that already shows it — callers pass `hideLabel`.
  - `Chip` — props `{ tone?: 'neutral' | 'trace' | 'ok' | 'draft'; mono?: boolean; onRemove?: () => void; removeLabel?: string; children: ReactNode }`. `tone='trace'` is the only place `--trace-wash`/`--trace-ink` appear outside the chat trace. When `onRemove` is given it renders a nested remove button labelled by `removeLabel`.
  - `Skeleton` — props `{ width?: string; height?: string; radius?: string }`, all CSS lengths, defaulting to `100%` / `14px` / `var(--radius-sm)`. Renders `aria-hidden` so screen readers skip placeholder geometry.

- [ ] **Step 1: Write the failing tests**

`client/src/components/ui/button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>New agent</Button>);
    expect(screen.getByRole('button', { name: 'New agent' })).toHaveAttribute('type', 'button');
  });

  it('applies the variant and size classes', () => {
    render(
      <Button variant="primary" size="sm">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('button--primary');
    expect(button.className).toContain('button--sm');
  });

  it('defaults to the secondary variant', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('button--secondary');
  });

  it('forwards native attributes and does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} aria-label="Delete agent">
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete agent' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a caller-supplied className alongside its own', () => {
    render(<Button className="agents__new">New</Button>);
    const button = screen.getByRole('button', { name: 'New' });
    expect(button.className).toContain('button');
    expect(button.className).toContain('agents__new');
  });
});
```

`client/src/components/ui/chip/chip.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './chip';

describe('Chip', () => {
  it('defaults to the neutral tone', () => {
    render(<Chip>gemini-2.5-flash</Chip>);
    expect(screen.getByText('gemini-2.5-flash').className).toContain('chip--neutral');
  });

  it('carries the trace tone for tool chips', () => {
    render(<Chip tone="trace">current_time</Chip>);
    expect(screen.getByText('current_time').className).toContain('chip--trace');
  });

  it('renders no remove control unless onRemove is given', () => {
    render(<Chip tone="trace">current_time</Chip>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a labelled remove control and reports clicks', async () => {
    const onRemove = vi.fn();
    render(
      <Chip tone="trace" onRemove={onRemove} removeLabel="Remove current_time">
        current_time
      </Chip>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove current_time' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- ui`
Expected: FAIL — cannot resolve `./button` and `./chip`.

- [ ] **Step 3: Write Button**

`client/src/components/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={['button', `button--${variant}`, `button--${size}`, className].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </button>
);
```

`client/src/components/ui/button.css`:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-ui);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.button:disabled {
  cursor: default;
  opacity: 0.4;
}

.button--md {
  height: 32px;
  padding: 0 var(--space-5);
}

.button--sm {
  height: 26px;
  padding: 0 var(--space-4);
  font-size: var(--text-label);
}

.button--primary {
  background: var(--signal);
  color: var(--paper);
  box-shadow: inset 0 0 0 1px rgba(15, 15, 15, 0.1);
}

.button--primary:hover:not(:disabled) {
  background: var(--signal-hover);
}

.button--secondary {
  background: var(--paper);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--rule);
}

.button--secondary:hover:not(:disabled) {
  background: var(--hover);
}

.button--ghost {
  background: transparent;
  color: var(--ink-muted);
}

.button--ghost:hover:not(:disabled) {
  background: var(--hover);
  color: var(--ink);
}

.button--danger {
  background: transparent;
  color: var(--err);
}

.button--danger:hover:not(:disabled) {
  background: var(--err-wash);
}
```

- [ ] **Step 4: Write Chip**

`client/src/components/ui/chip/chip.tsx`:

```tsx
import type { ReactNode } from 'react';
import './chip.css';

export type ChipTone = 'neutral' | 'trace' | 'ok' | 'draft';

interface ChipProps {
  tone?: ChipTone;
  mono?: boolean;
  onRemove?: () => void;
  /** Required whenever onRemove is set: the control needs a specific name. */
  removeLabel?: string;
  children: ReactNode;
}

export const Chip = ({ tone = 'neutral', mono = true, onRemove, removeLabel, children }: ChipProps) => (
  <span className={['chip', `chip--${tone}`, mono ? 'mono' : ''].filter(Boolean).join(' ')}>
    {children}
    {onRemove && (
      <button type="button" className="chip__remove" onClick={onRemove} aria-label={removeLabel}>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
          <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </button>
    )}
  </span>
);
```

`client/src/components/ui/chip/chip.css`:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 20px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-meta);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip--neutral {
  background: var(--shell);
  color: var(--ink-muted);
  box-shadow: inset 0 0 0 1px var(--rule);
}

/* The only place the trace palette appears outside the chat trace. */
.chip--trace {
  background: var(--trace-wash);
  color: var(--trace-ink);
}

.chip--ok {
  background: transparent;
  color: var(--ok);
}

.chip--draft {
  background: transparent;
  color: var(--ink-faint);
}

.chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-sm);
  color: inherit;
  opacity: 0.6;
  transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.chip__remove:hover {
  opacity: 1;
  background: rgba(55, 53, 47, 0.12);
}
```

- [ ] **Step 5: Write Select**

`client/src/components/ui/select.tsx`:

```tsx
import { useId } from 'react';
import './select.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Hide the label visually when a surrounding property row already shows it. */
  hideLabel?: boolean;
  /** Mono face for machine values such as model ids. */
  mono?: boolean;
  id?: string;
}

export const Select = ({ label, value, options, onChange, hideLabel, mono, id }: SelectProps) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="select">
      <label className={hideLabel ? 'sr-only' : 'select__label'} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={['select__control', mono ? 'mono' : ''].filter(Boolean).join(' ')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
```

`client/src/components/ui/select.css`:

```css
.select {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.select__label {
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--ink-muted);
}

.select__control {
  appearance: none;
  width: 100%;
  height: 28px;
  padding: 0 var(--space-7) 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background-color: transparent;
  color: var(--ink);
  font-size: var(--text-ui);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);

  /* Chevron drawn as a data URI so no network request and no icon dependency. */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23787774' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-4) center;
  background-size: 10px 6px;
}

.select__control:hover {
  background-color: var(--hover);
}

.select__control.mono {
  font-size: var(--text-label);
}
```

- [ ] **Step 6: Write Skeleton**

`client/src/components/ui/skeleton.tsx`:

```tsx
import './skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
}

export const Skeleton = ({ width = '100%', height = '14px', radius }: SkeletonProps) => (
  <span
    className="skeleton"
    aria-hidden="true"
    style={{ width, height, borderRadius: radius ?? 'var(--radius-sm)' }}
  />
);
```

`client/src/components/ui/skeleton.css`:

```css
.skeleton {
  display: block;
  background: var(--shell);
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--hover), transparent);
  transform: translateX(-100%);
  animation: skeleton-sweep 1200ms var(--ease) infinite;
}

@keyframes skeleton-sweep {
  to {
    transform: translateX(100%);
  }
}

/* Duration tokens cannot switch off a keyframe animation, so name it here. */
@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none;
  }
}
```

- [ ] **Step 7: Write the chip barrel**

`client/src/components/ui/chip/index.ts`:

```ts
export { Chip } from './chip';
export type { ChipTone } from './chip';
```

- [ ] **Step 8: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS, 9 new tests.

- [ ] **Step 9: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src/components/ui
git commit -m "feat: add button, chip, select, and skeleton primitives"
```

---

### Task 7: AutoTextarea, Popover, and EmptyState

These three carry real behavior, so their tests matter more than the previous task's.

**Files:**
- Create: `client/src/components/ui/textarea.tsx`, `client/src/components/ui/textarea.css`
- Create: `client/src/components/ui/popover/popover.tsx`, `popover.css`, `index.ts`
- Create: `client/src/components/ui/empty-state/empty-state.tsx`, `empty-state.css`, `index.ts`
- Test: `client/src/components/ui/textarea.test.tsx`, `client/src/components/ui/popover/popover.test.tsx`

**Interfaces:**
- Consumes: `Button` from Task 6 (EmptyState action).
- Produces:
  - `AutoTextarea` — props `{ value: string; onChange: (value: string) => void; label: string; hideLabel?: boolean; mono?: boolean; minRows?: number; maxHeight?: number; onBlur?: () => void; placeholder?: string; disabled?: boolean; id?: string; onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void }`. Grows with content by setting `style.height` from `scrollHeight`, capped at `maxHeight` (default 200) after which it scrolls. Growth recalculates on every value change, including programmatic ones.
  - `Popover` — props `{ open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; children: ReactNode; align?: 'start' | 'end'; label: string; width?: number }`. Renders nothing when closed. When open it positions itself under the anchor, closes on Escape and on a pointer-down outside itself and the anchor, returns focus to the anchor on close, and exposes `role="dialog"` with `aria-label={label}`. Escape and outside-click both call `onClose`; the parent owns `open`.
  - `EmptyState` — props `{ icon?: ReactNode; title: string; body: string; action?: { label: string; onClick: () => void } }`. Centered block; `title` renders as a `<p>`, not a heading, so it never competes with the page `<h1>` in the document outline.

- [ ] **Step 1: Write the failing textarea test**

`client/src/components/ui/textarea.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoTextarea } from './textarea';

describe('AutoTextarea', () => {
  it('binds its label to the control', () => {
    render(<AutoTextarea label="System prompt" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('System prompt')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('hides the label visually but keeps it for screen readers', () => {
    render(<AutoTextarea label="Message" hideLabel value="" onChange={() => {}} />);
    expect(screen.getByText('Message').className).toContain('sr-only');
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('reports each keystroke as the new whole value', async () => {
    const onChange = vi.fn();
    render(<AutoTextarea label="Prompt" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Prompt'), 'Be');
    expect(onChange).toHaveBeenNthCalledWith(1, 'B');
    expect(onChange).toHaveBeenNthCalledWith(2, 'e');
  });

  it('sets an explicit height so the field grows with its content', () => {
    render(<AutoTextarea label="Prompt" value="one line" onChange={() => {}} />);
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    expect(textarea.style.height).not.toBe('');
  });

  it('caps growth at maxHeight and scrolls past it', () => {
    // jsdom reports scrollHeight 0, so assert the cap is applied as a style ceiling.
    render(<AutoTextarea label="Prompt" value={'x\n'.repeat(200)} onChange={() => {}} maxHeight={120} />);
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    expect(textarea.style.maxHeight).toBe('120px');
    expect(textarea.style.overflowY).toBe('auto');
  });

  it('applies the mono face when asked', () => {
    render(<AutoTextarea label="Prompt" value="" onChange={() => {}} mono />);
    expect(screen.getByLabelText('Prompt').className).toContain('mono');
  });

  it('forwards keydown so callers can implement Enter-to-send', async () => {
    const onKeyDown = vi.fn();
    render(<AutoTextarea label="Message" value="hi" onChange={() => {}} onKeyDown={onKeyDown} />);
    await userEvent.type(screen.getByLabelText('Message'), '{Enter}');
    expect(onKeyDown).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write the failing popover test**

`client/src/components/ui/popover/popover.test.tsx`:

```tsx
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover } from './popover';

const Harness = () => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Open menu
      </button>
      <button type="button">Outside</button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Row actions">
        <button type="button">Duplicate</button>
      </Popover>
    </div>
  );
};

describe('Popover', () => {
  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with an accessible name', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the anchor', async () => {
    render(<Harness />);
    const anchor = screen.getByRole('button', { name: 'Open menu' });
    await userEvent.click(anchor);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
  });

  it('closes when a pointer goes down outside it', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open when clicking its own content', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- textarea popover`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write AutoTextarea**

`client/src/components/ui/textarea.tsx`:

```tsx
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import './textarea.css';

interface AutoTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  mono?: boolean;
  minRows?: number;
  maxHeight?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const AutoTextarea = ({
  label,
  value,
  onChange,
  hideLabel,
  mono,
  minRows = 1,
  maxHeight = 200,
  placeholder,
  disabled,
  id,
  onBlur,
  onKeyDown,
}: AutoTextareaProps) => {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const ref = useRef<HTMLTextAreaElement>(null);

  // Recalculate on every value change, so programmatic writes grow the field too.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  return (
    <div className="textarea">
      <label className={hideLabel ? 'sr-only' : 'textarea__label'} htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        className={['textarea__control', mono ? 'mono' : ''].filter(Boolean).join(' ')}
        value={value}
        rows={minRows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={{ maxHeight: `${maxHeight}px`, overflowY: 'auto' }}
      />
    </div>
  );
};
```

`client/src/components/ui/textarea.css`:

```css
.textarea {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.textarea__label {
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--ink-muted);
}

.textarea__control {
  width: 100%;
  padding: var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--shell);
  color: var(--ink);
  font-size: var(--text-body);
  line-height: 1.6;
  resize: none;
  transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

/* Notion's code-block feel: no border until focus. */
.textarea__control:focus {
  background: var(--paper);
  border-color: var(--rule);
}

.textarea__control.mono {
  font-size: var(--text-ui);
}

.textarea__control:disabled {
  color: var(--ink-faint);
  cursor: default;
}
```

- [ ] **Step 5: Write Popover**

`client/src/components/ui/popover/popover.tsx`:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import './popover.css';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  label: string;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
}

export const Popover = ({ open, onClose, anchor, label, children, align = 'start', width }: PopoverProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Measure before paint so the panel never renders at 0,0 first.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = anchor.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = width ?? panel.offsetWidth;
    const gap = 4;

    const left = align === 'end' ? rect.right - panelWidth : rect.left;
    const wouldOverflowBottom = rect.bottom + panel.offsetHeight + gap > window.innerHeight;

    setPosition({
      top: wouldOverflowBottom ? rect.top - panel.offsetHeight - gap : rect.bottom + gap,
      // Keep an 8px margin from either edge on narrow viewports.
      left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)),
    });
  }, [open, anchor, align, width]);

  useEffect(() => {
    if (!open) return;
    const trigger = anchor.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      trigger?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || trigger?.contains(target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="popover"
      role="dialog"
      aria-label={label}
      style={{ top: position.top, left: position.left, width: width ? `${width}px` : undefined }}
    >
      {children}
    </div>
  );
};
```

`client/src/components/ui/popover/popover.css`:

```css
.popover {
  position: fixed;
  z-index: 40;
  min-width: 180px;
  max-width: calc(100vw - 16px);
  padding: var(--space-2);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-popover);
  animation: popover-in var(--dur-mid) var(--ease);
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .popover {
    animation: none;
  }
}

/* Shared menu-row look for every popover that lists actions. */
.popover__item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  height: 28px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-ui);
  color: var(--ink);
  text-align: left;
}

.popover__item:hover {
  background: var(--hover);
}

.popover__item--danger {
  color: var(--err);
}

.popover__item--danger:hover {
  background: var(--err-wash);
}

.popover__divider {
  height: 1px;
  margin: var(--space-2) 0;
  background: var(--rule);
}

.popover__note {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-meta);
  color: var(--ink-muted);
}
```

`client/src/components/ui/popover/index.ts`:

```ts
export { Popover } from './popover';
```

- [ ] **Step 6: Write EmptyState**

`client/src/components/ui/empty-state/empty-state.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button } from '../button';
import './empty-state.css';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState = ({ icon, title, body, action }: EmptyStateProps) => (
  <div className="empty-state">
    {icon && <div className="empty-state__icon">{icon}</div>}
    {/* A <p>, not a heading: this must not compete with the page h1. */}
    <p className="empty-state__title">{title}</p>
    <p className="empty-state__body">{body}</p>
    {action && (
      <Button variant="primary" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);
```

`client/src/components/ui/empty-state/empty-state.css`:

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 24px;
  line-height: 1;
  opacity: 0.7;
}

.empty-state__title {
  font-size: var(--text-ui);
  font-weight: 600;
  color: var(--ink);
}

.empty-state__body {
  max-width: 32ch;
  font-size: var(--text-ui);
  color: var(--ink-muted);
}

.empty-state > .button {
  margin-top: var(--space-2);
}
```

`client/src/components/ui/empty-state/index.ts`:

```ts
export { EmptyState } from './empty-state';
```

- [ ] **Step 7: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS, 12 new tests.

- [ ] **Step 8: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src/components/ui
git commit -m "feat: add auto-growing textarea, popover, and empty state"
```

---

### Task 8: Toast and ConfirmDelete

**Files:**
- Create: `client/src/components/ui/toast/toast.tsx`, `toast.css`, `index.ts`
- Create: `client/src/components/ui/confirm-delete/confirm-delete.tsx`, `confirm-delete.css`, `index.ts`
- Test: `client/src/components/ui/toast/toast.test.tsx`, `client/src/components/ui/confirm-delete/confirm-delete.test.tsx`

**Interfaces:**
- Consumes: `Button` (Task 6), `Popover` (Task 7).
- Produces:
  - `ToastProvider` — component with prop `{ children: ReactNode }`, rendering its children plus a fixed toast region with `role="status"` and `aria-live="polite"`.
  - `useToast(): { show: (message: string) => void }` — must be called inside a `ToastProvider`; throws a named error otherwise. Each toast dismisses itself after 4000ms; a new toast replaces the current one rather than stacking, because two at once would fight the composer for the same corner.
  - `ConfirmDelete` — props `{ open: boolean; onClose: () => void; onConfirm: () => void; anchor: RefObject<HTMLElement | null>; itemName: string }`. Renders a `Popover` whose body reads `Delete <itemName>? This can't be undone.` with Cancel and Delete. Delete calls `onConfirm` then `onClose`.

- [ ] **Step 1: Write the failing toast test**

`client/src/components/ui/toast/toast.test.tsx`:

```tsx
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './toast';

const Trigger = ({ message }: { message: string }) => {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message)}>
      Show
    </button>
  );
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const clickShow = () => act(() => screen.getByRole('button', { name: 'Show' }).click());

describe('ToastProvider', () => {
  it('exposes a polite live region even before anything is shown', () => {
    render(
      <ToastProvider>
        <Trigger message="Agent deleted" />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows a message and dismisses it after four seconds', () => {
    render(
      <ToastProvider>
        <Trigger message="Agent deleted" />
      </ToastProvider>,
    );

    clickShow();
    expect(screen.getByText('Agent deleted')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByText('Agent deleted')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Agent deleted')).not.toBeInTheDocument();
  });

  it('replaces the current toast rather than stacking', () => {
    const Two = () => {
      const { show } = useToast();
      return (
        <button type="button" onClick={() => { show('First'); show('Second'); }}>
          Show
        </button>
      );
    };
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );

    clickShow();
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('names the error when used outside a provider', () => {
    expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
  });
});
```

- [ ] **Step 2: Write the failing confirm test**

`client/src/components/ui/confirm-delete/confirm-delete.test.tsx`:

```tsx
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDelete } from './confirm-delete';

const Harness = ({ onConfirm }: { onConfirm: () => void }) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Delete agent
      </button>
      <ConfirmDelete
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        anchor={anchor}
        itemName="Support Bot"
      />
    </div>
  );
};

describe('ConfirmDelete', () => {
  it('names the item it is about to delete', async () => {
    render(<Harness onConfirm={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    expect(screen.getByText(/Delete Support Bot\?/)).toBeInTheDocument();
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
  });

  it('confirms and closes', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- toast confirm`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write Toast**

`client/src/components/ui/toast/toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './toast.css';

const DISMISS_AFTER_MS = 4000;

interface ToastApi {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be called inside a ToastProvider.');
  return api;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // One at a time: two toasts would fight the composer for the same corner.
  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), DISMISS_AFTER_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && <div className="toast">{message}</div>}
      </div>
    </ToastContext.Provider>
  );
};
```

`client/src/components/ui/toast/toast.css`:

```css
.toast-region {
  position: fixed;
  bottom: var(--space-7);
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  pointer-events: none;
}

.toast {
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-md);
  background: var(--ink);
  color: var(--paper);
  font-size: var(--text-ui);
  box-shadow: var(--shadow-popover);
  animation: toast-in var(--dur-slow) var(--ease);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
}
```

`client/src/components/ui/toast/index.ts`:

```ts
export { ToastProvider, useToast } from './toast';
```

- [ ] **Step 5: Write ConfirmDelete**

`client/src/components/ui/confirm-delete/confirm-delete.tsx`:

```tsx
import type { RefObject } from 'react';
import { Button } from '../button';
import { Popover } from '../popover';
import './confirm-delete.css';

interface ConfirmDeleteProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  anchor: RefObject<HTMLElement | null>;
  itemName: string;
}

export const ConfirmDelete = ({ open, onClose, onConfirm, anchor, itemName }: ConfirmDeleteProps) => (
  <Popover open={open} onClose={onClose} anchor={anchor} label={`Delete ${itemName}`} align="end" width={280}>
    <div className="confirm-delete">
      <p className="confirm-delete__question">Delete {itemName}?</p>
      <p className="confirm-delete__note">This can&rsquo;t be undone.</p>
      <div className="confirm-delete__actions">
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          className="confirm-delete__confirm"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  </Popover>
);
```

`client/src/components/ui/confirm-delete/confirm-delete.css`:

```css
.confirm-delete {
  padding: var(--space-4);
}

.confirm-delete__question {
  font-size: var(--text-ui);
  font-weight: 600;
  color: var(--ink);
}

.confirm-delete__note {
  margin-top: var(--space-1);
  font-size: var(--text-label);
  color: var(--ink-muted);
}

.confirm-delete__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-top: var(--space-5);
}

/* The one destructive primary in the app: red, not blue. */
.confirm-delete__confirm.button--primary {
  background: var(--err);
}

.confirm-delete__confirm.button--primary:hover:not(:disabled) {
  background: #c1403c;
}
```

`client/src/components/ui/confirm-delete/index.ts`:

```ts
export { ConfirmDelete } from './confirm-delete';
```

Note on the one hardcoded hex above: `#c1403c` is the hover shade of `--err`. Add it to `tokens.css` as `--err-hover: #c1403c` and reference `var(--err-hover)` instead, keeping the no-hex rule intact.

- [ ] **Step 6: Add the missing token**

In `client/src/styles/tokens.css`, add directly below `--err`:

```css
  --err-hover: #c1403c;
```

and change the rule in `confirm-delete.css` to `background: var(--err-hover);`.

- [ ] **Step 7: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS, 7 new tests.

- [ ] **Step 8: Confirm no stray hex values escaped tokens.css**

Run from `AgentPlatform-FrontEnd/client`:

```bash
grep -rEn "#[0-9a-fA-F]{3,8}\b" src --include=*.css | grep -v "src/styles/tokens.css"
```

Expected: only matches inside `url("data:image/svg+xml,...")` strings, where the hex is part of an encoded SVG stroke and cannot be a variable. Any other match is a defect to fix before committing.

- [ ] **Step 9: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src
git commit -m "feat: add toast region and delete confirmation"
```

---

## Phase D — Shell and agents surface

### Task 9: The Notion shell — Sidebar, Workspace, and routing

**Files:**
- Create: `client/src/components/layout/Sidebar.tsx`, `Sidebar.css`
- Create: `client/src/components/layout/Workspace.tsx`, `Workspace.css`
- Create: `client/src/components/layout/TopBar.tsx`, `TopBar.css`
- Create: `client/src/pages/index.tsx`
- Create: `client/src/pages/Agents/index.tsx`, `agents.css` (placeholder body; Task 11 fills it)
- Create: `client/src/pages/Chat/index.tsx`, `chat.css` (placeholder body; Task 15 fills it)
- Modify: `client/src/App.tsx`, `client/src/App.css`
- Test: `client/src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `useApiHealth`, `useMediaQuery`, `BREAKPOINT_SIDEBAR` (Task 5); `ToastProvider` (Task 8); `Agent` type (Task 5).
- Produces:
  - `Sidebar` — props `{ agents: Agent[]; open: boolean; onClose: () => void; onSearch: (query: string) => void; searchQuery: string }`. Renders the workspace row, the search field, the section label, the two nav items, the nested agent children under Agents, and the health pill. Nav items are `NavLink`s, so the active state comes from the router rather than component state.
  - `TopBar` — props `{ onOpenSidebar: () => void; showMenuButton: boolean; children?: ReactNode }`. A 45px sticky bar; the hamburger appears only under the sidebar breakpoint.
  - `Workspace` — props `{ children: ReactNode }`. The scrolling `--paper` canvas to the right of the sidebar.
  - `AppRoutes` (default export of `pages/index.tsx`) — the route table: `/` redirects to `/agents`; `/agents` and `/agents/:agentId` both render `AgentsPage`; `/chat` and `/chat/:agentId` both render `ChatPage`; `*` renders a not-found notice with a link to Agents.
  - `App` wires `BrowserRouter`, `ToastProvider`, sidebar open/close state, and the search query that `AgentsPage` reads.
- Search state lives in `App` because two surfaces need it: typing in the sidebar filters the Agents table and navigates to `/agents`.

- [ ] **Step 1: Write the failing sidebar test**

`client/src/components/layout/Sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Sidebar } from './Sidebar';
import type { Agent } from '../../types/agent';

const agent = (id: string, name: string, icon: string): Agent => ({
  id,
  name,
  icon,
  description: '',
  model: 'gemini-2.5-flash',
  systemPrompt: '',
  toolIds: [],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
});

const agents = [agent('agent_support', 'Support Bot', '🎧'), agent('agent_research', 'Research Assistant', '🔭')];

const renderSidebar = (props: Partial<Parameters<typeof Sidebar>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={['/agents']}>
      <Sidebar agents={agents} open onClose={() => {}} onSearch={() => {}} searchQuery="" {...props} />
    </MemoryRouter>,
  );

describe('Sidebar', () => {
  it('offers both surfaces as navigation', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /Agents/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chat/ })).toBeInTheDocument();
  });

  it('marks the current surface for assistive tech', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /^Agents/ })).toHaveAttribute('aria-current', 'page');
  });

  it('hides the nested agents until Agents is expanded', async () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: /Support Bot/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expand agents' }));
    expect(screen.getByRole('link', { name: /Support Bot/ })).toHaveAttribute('href', '/agents/agent_support');
  });

  it('reports the disclosure state', async () => {
    renderSidebar();
    const toggle = screen.getByRole('button', { name: 'Expand agents' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse agents' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reports each keystroke in search', async () => {
    const onSearch = vi.fn();
    renderSidebar({ onSearch });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search agents' }), 'sup');
    expect(onSearch).toHaveBeenCalledTimes(3);
  });

  it('reads the API status as text, not colour alone', () => {
    renderSidebar();
    expect(screen.getByText(/connected|api offline|checking/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- Sidebar`
Expected: FAIL — cannot resolve `./Sidebar`.

- [ ] **Step 3: Write Sidebar**

`client/src/components/layout/Sidebar.tsx`:

```tsx
import { useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { Popover } from '../ui/popover';
import { useApiHealth } from '../../hooks/useApiHealth';
import type { Agent } from '../../types/agent';
import './Sidebar.css';

interface SidebarProps {
  agents: Agent[];
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
}

const HEALTH_TEXT = {
  checking: 'checking…',
  online: 'connected · mock',
  offline: 'api offline',
} as const;

export const Sidebar = ({ agents, open, onClose, onSearch, searchQuery }: SidebarProps) => {
  const [agentsExpanded, setAgentsExpanded] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLButtonElement>(null);
  const health = useApiHealth();

  return (
    <nav className={['sidebar', open ? 'sidebar--open' : ''].filter(Boolean).join(' ')} aria-label="Workspace">
      <button
        ref={workspaceRef}
        type="button"
        className="sidebar__workspace"
        onClick={() => setWorkspaceOpen(true)}
      >
        <span className="sidebar__workspace-mark" aria-hidden="true">
          ▦
        </span>
        <span className="sidebar__workspace-name">Agent Platform</span>
        <span className="sidebar__chevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      <Popover
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        anchor={workspaceRef}
        label="Workspace"
        width={216}
      >
        <p className="popover__note">Mock workspace. Agents and runs reset when the API restarts.</p>
      </Popover>

      <div className="sidebar__search">
        <span className="sidebar__search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          className="sidebar__search-input"
          aria-label="Search agents"
          placeholder="Search"
          value={searchQuery}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <p className="sidebar__label">Workspace</p>

      <div className="sidebar__group">
        <button
          type="button"
          className="sidebar__disclosure"
          aria-expanded={agentsExpanded}
          aria-label={agentsExpanded ? 'Collapse agents' : 'Expand agents'}
          onClick={() => setAgentsExpanded((expanded) => !expanded)}
        >
          <span className={['sidebar__triangle', agentsExpanded ? 'sidebar__triangle--open' : ''].join(' ')}>
            ▸
          </span>
        </button>
        <NavLink to="/agents" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ▤
          </span>
          Agents
        </NavLink>
      </div>

      {agentsExpanded && (
        <ul className="sidebar__children">
          {agents.map((agent) => (
            <li key={agent.id}>
              <NavLink to={`/agents/${agent.id}`} className="sidebar__item sidebar__item--child" onClick={onClose}>
                <span className="sidebar__item-icon" aria-hidden="true">
                  {agent.icon}
                </span>
                <span className="sidebar__item-text">{agent.name}</span>
              </NavLink>
            </li>
          ))}
          {agents.length === 0 && <li className="sidebar__children-empty">No agents yet</li>}
        </ul>
      )}

      <div className="sidebar__group">
        <span className="sidebar__disclosure sidebar__disclosure--spacer" aria-hidden="true" />
        <NavLink to="/chat" className="sidebar__item" onClick={onClose}>
          <span className="sidebar__item-icon" aria-hidden="true">
            ✉
          </span>
          Chat
        </NavLink>
      </div>

      <div className="sidebar__footer">
        <span className={`sidebar__dot sidebar__dot--${health}`} aria-hidden="true" />
        <span className="sidebar__health mono">{HEALTH_TEXT[health]}</span>
      </div>
    </nav>
  );
};
```

`client/src/components/layout/Sidebar.css`:

```css
.sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--sidebar-width);
  width: var(--sidebar-width);
  height: 100%;
  padding: var(--space-4) var(--space-4) 0;
  background: var(--shell);
  border-right: 1px solid var(--rule);
  overflow-y: auto;
}

.sidebar__workspace {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  height: 28px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-ui);
  font-weight: 500;
}

.sidebar__workspace:hover {
  background: var(--active);
}

.sidebar__workspace-mark {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: var(--paper);
  font-size: 10px;
}

.sidebar__workspace-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.sidebar__chevron {
  color: var(--ink-faint);
  font-size: var(--text-label);
}

.sidebar__search {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 28px;
  margin-top: var(--space-2);
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
}

.sidebar__search:hover,
.sidebar__search:focus-within {
  background: var(--active);
}

.sidebar__search-icon {
  font-size: var(--text-ui);
}

.sidebar__search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font-size: var(--text-ui);
  outline: none;
}

/* The search field owns focus styling via :focus-within on its wrapper. */
.sidebar__search-input:focus-visible {
  outline: none;
}

.sidebar__search-input::-webkit-search-cancel-button {
  appearance: none;
}

.sidebar__label {
  margin: var(--space-6) var(--space-3) var(--space-2);
  font-size: var(--text-label);
  font-weight: 600;
  color: var(--ink-muted);
}

.sidebar__group {
  display: flex;
  align-items: center;
}

.sidebar__disclosure {
  display: grid;
  place-items: center;
  flex: 0 0 18px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--ink-faint);
  font-size: 9px;
}

.sidebar__disclosure:hover {
  background: var(--active);
  color: var(--ink-muted);
}

.sidebar__disclosure--spacer {
  pointer-events: none;
}

.sidebar__triangle {
  display: block;
  transition: transform var(--dur-fast) var(--ease);
}

.sidebar__triangle--open {
  transform: rotate(90deg);
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--ink);
  font-size: var(--text-ui);
  font-weight: 500;
}

.sidebar__item:hover {
  background: var(--active);
  text-decoration: none;
}

.sidebar__item[aria-current='page'] {
  background: var(--active);
}

.sidebar__item-icon {
  flex: 0 0 auto;
  width: 16px;
  font-size: var(--text-label);
  text-align: center;
}

.sidebar__item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__item--child {
  font-weight: 400;
  color: var(--ink-muted);
}

.sidebar__item--child[aria-current='page'] {
  color: var(--ink);
}

.sidebar__children {
  padding-left: 18px;
}

.sidebar__children-empty {
  padding: 0 var(--space-3);
  font-size: var(--text-label);
  color: var(--ink-faint);
  line-height: 28px;
}

.sidebar__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: auto;
  padding: var(--space-4) var(--space-3);
  border-top: 1px solid var(--rule);
}

.sidebar__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--ink-faint);
}

.sidebar__dot--online {
  background: var(--ok);
}

.sidebar__dot--offline {
  background: var(--err);
}

.sidebar__health {
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

/* Under the breakpoint the sidebar leaves the flow and slides over the page. */
@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform var(--dur-slow) var(--ease);
    box-shadow: var(--shadow-popover);
  }

  .sidebar--open {
    transform: translateX(0);
  }
}
```

- [ ] **Step 4: Write TopBar and Workspace**

`client/src/components/layout/TopBar.tsx`:

```tsx
import type { ReactNode } from 'react';
import './TopBar.css';

interface TopBarProps {
  onOpenSidebar: () => void;
  showMenuButton: boolean;
  children?: ReactNode;
}

export const TopBar = ({ onOpenSidebar, showMenuButton, children }: TopBarProps) => (
  <header className="topbar">
    {showMenuButton && (
      <button type="button" className="topbar__menu" onClick={onOpenSidebar} aria-label="Open sidebar">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>
    )}
    {children}
  </header>
);
```

`client/src/components/layout/TopBar.css`:

```css
.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex: 0 0 var(--topbar-height);
  height: var(--topbar-height);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
}

.topbar:empty {
  display: none;
}

.topbar__menu {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
}

.topbar__menu:hover {
  background: var(--hover);
  color: var(--ink);
}
```

`client/src/components/layout/Workspace.tsx`:

```tsx
import type { ReactNode } from 'react';
import './Workspace.css';

export const Workspace = ({ children }: { children: ReactNode }) => (
  <main className="workspace">{children}</main>
);
```

`client/src/components/layout/Workspace.css`:

```css
.workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--paper);
  overflow: hidden;
}
```

- [ ] **Step 5: Write the placeholder pages**

`client/src/pages/Agents/index.tsx` — Task 11 replaces the body:

```tsx
import './agents.css';

interface AgentsPageProps {
  searchQuery: string;
}

const AgentsPage = ({ searchQuery }: AgentsPageProps) => (
  <div className="agents">
    <h1 className="agents__title">Agents</h1>
    <p className="agents__subtitle">Configure agents and the tools they can reach.</p>
    {searchQuery && <p className="agents__subtitle">Filtering by “{searchQuery}”.</p>}
  </div>
);

export default AgentsPage;
```

`client/src/pages/Agents/agents.css`:

```css
.agents {
  flex: 1;
  min-width: 0;
  padding: var(--space-9) var(--space-8) var(--space-10);
  overflow-y: auto;
}

.agents__title {
  font-size: var(--text-title);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.agents__subtitle {
  margin-top: var(--space-3);
  font-size: var(--text-ui);
  color: var(--ink-muted);
}
```

`client/src/pages/Chat/index.tsx` — Task 15 replaces the body:

```tsx
import './chat.css';

const ChatPage = () => (
  <div className="chat">
    <div className="chat__column">
      <p className="chat__placeholder">Chat surface</p>
    </div>
  </div>
);

export default ChatPage;
```

`client/src/pages/Chat/chat.css`:

```css
.chat {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chat__column {
  width: 100%;
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 var(--space-6);
}

.chat__placeholder {
  padding: var(--space-9) 0;
  color: var(--ink-muted);
}
```

- [ ] **Step 6: Write the route table**

`client/src/pages/index.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router';
import AgentsPage from './Agents';
import ChatPage from './Chat';

interface AppRoutesProps {
  searchQuery: string;
}

const NotFound = () => (
  <div className="agents">
    <h1 className="agents__title">Nothing here</h1>
    <p className="agents__subtitle">
      That address does not match a surface. <a href="/agents">Go to Agents</a>.
    </p>
  </div>
);

const AppRoutes = ({ searchQuery }: AppRoutesProps) => (
  <Routes>
    <Route path="/" element={<Navigate to="/agents" replace />} />
    <Route path="/agents" element={<AgentsPage searchQuery={searchQuery} />} />
    <Route path="/agents/:agentId" element={<AgentsPage searchQuery={searchQuery} />} />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/chat/:agentId" element={<ChatPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default AppRoutes;
```

- [ ] **Step 7: Wire the App**

`client/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Workspace } from './components/layout/Workspace';
import { ToastProvider } from './components/ui/toast';
import { BREAKPOINT_SIDEBAR, useMediaQuery } from './hooks/useMediaQuery';
import { AgentsProvider, useAgentsContext } from './hooks/useAgents';
import AppRoutes from './pages';
import './App.css';

const Shell = () => {
  const { agents } = useAgentsContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isNarrow = useMediaQuery(BREAKPOINT_SIDEBAR);
  const navigate = useNavigate();
  const location = useLocation();

  // Searching is an Agents action, so typing moves you there.
  const onSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0 && !location.pathname.startsWith('/agents')) navigate('/agents');
  };

  // A wide viewport has no drawer to leave open.
  useEffect(() => {
    if (!isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  return (
    <div className="app">
      <Sidebar
        agents={agents}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSearch={onSearch}
        searchQuery={searchQuery}
      />
      {isNarrow && sidebarOpen && (
        <button
          type="button"
          className="app__scrim"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Workspace>
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} showMenuButton={isNarrow} />
        <AppRoutes searchQuery={searchQuery} />
      </Workspace>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <ToastProvider>
      {/* One agent list for the whole app: sidebar, Agents, and Chat share it. */}
      <AgentsProvider>
        <Shell />
      </AgentsProvider>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
```

`client/src/App.css`:

```css
.app {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.app__scrim {
  position: fixed;
  inset: 0;
  z-index: 45;
  background: var(--scrim);
  cursor: default;
}
```

`App.tsx` imports `AgentsProvider` and `useAgentsContext` from `./hooks/useAgents`, which Task 10 writes. Implement Task 10 before running the app; the test in this task renders `Sidebar` directly and does not need either.

- [ ] **Step 8: Run the test to verify it passes**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- Sidebar`
Expected: PASS, 6 tests.

- [ ] **Step 9: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src
git commit -m "feat: add sidebar shell, workspace layout, and routing"
```

---

### Task 10: useAgents — optimistic patch, rollback, and autosave

The hook that carries the most logic in the app. Autosave means no Save button, so a dropped write must be visible and recoverable.

**Files:**
- Create: `client/src/hooks/useAgents.ts`
- Test: `client/src/hooks/useAgents.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `ApiError` (Task 5); `Agent`, `AgentPatch` types (Task 5).
- Produces:

  ```ts
  export type SaveState =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; at: string }        // ISO timestamp
    | { kind: 'error'; message: string };

  export interface UseAgentsResult {
    agents: Agent[];
    loading: boolean;
    error: string | null;
    saveState: SaveState;
    createAgent: () => Promise<Agent | null>;
    duplicateAgent: (id: string) => Promise<Agent | null>;
    updateAgent: (id: string, patch: AgentPatch) => void;   // optimistic + debounced
    flushUpdates: () => Promise<void>;                      // call on blur
    deleteAgent: (id: string) => Promise<boolean>;
    retrySave: () => void;
    reload: () => Promise<void>;
  }

  export const AUTOSAVE_DELAY_MS = 600;
  export const useAgents: () => UseAgentsResult;

  // Three surfaces read the same list, so exactly one instance owns it.
  export const AgentsProvider: (props: { children: ReactNode }) => JSX.Element;
  export const useAgentsContext: () => UseAgentsResult;
  ```

- **One instance, three readers.** The sidebar, the Agents page, and the Chat page all need the agent list. If each called `useAgents()` they would hold three independent states and three independent fetches, and creating an agent on the Agents page would never appear in the sidebar. `AgentsProvider` calls `useAgents` once and publishes the result; every component reads it through `useAgentsContext`. `useAgents` itself stays exported so the tests below can drive it directly.

- Behavior contract:
  - `updateAgent` applies the patch to local state immediately, then schedules a `PATCH` after `AUTOSAVE_DELAY_MS`. Repeated calls within the window coalesce into one request carrying the merged patch.
  - `flushUpdates` sends any pending patch at once and resolves when the request settles.
  - On a failed save, local state rolls back to the last server-confirmed agent, `saveState` becomes `{ kind: 'error', message }`, and the pending patch is retained so `retrySave` can send it again.
  - `saveState` reads `{ kind: 'saved', at }` after a successful write; the peek footer renders `Saved ${formatClockTime(at)}`.

- [ ] **Step 1: Write the failing tests**

`client/src/hooks/useAgents.test.ts`:

```ts
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AUTOSAVE_DELAY_MS, useAgents } from './useAgents';
import type { Agent } from '../types/agent';

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-2.5-flash',
  systemPrompt: 'Be terse.',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Routes by method and path so each test states only what it cares about. */
const stubApi = (handlers: {
  list?: () => Response;
  patch?: () => Response;
  post?: () => Response;
  del?: () => Response;
}) => {
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET') return handlers.list?.() ?? json([agent]);
    if (method === 'PATCH') return handlers.patch?.() ?? json({ ...agent, name: 'patched' });
    if (method === 'POST') return handlers.post?.() ?? json({ ...agent, id: 'agent_new' }, 201);
    return handlers.del?.() ?? new Response(null, { status: 204 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const loaded = async () => {
  const view = renderHook(() => useAgents());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
};

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAgents loading', () => {
  it('loads the list', async () => {
    stubApi({});
    const { result } = await loaded();
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a load failure as a readable message', async () => {
    stubApi({ list: () => json({ error: { code: 'internal_error', message: 'Database is down.' } }, 500) });
    const { result } = await loaded();
    expect(result.current.error).toBe('Database is down.');
    expect(result.current.agents).toEqual([]);
  });
});

describe('useAgents optimistic update', () => {
  it('applies the patch locally before any request goes out', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));

    expect(result.current.agents[0]!.name).toBe('Renamed');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);
  });

  it('sends one coalesced request for rapid edits', async () => {
    const fetchMock = stubApi({ patch: () => json({ ...agent, name: 'C', description: 'D' }) });
    const { result } = await loaded();

    act(() => {
      result.current.updateAgent('agent_support', { name: 'A' });
      result.current.updateAgent('agent_support', { name: 'B' });
      result.current.updateAgent('agent_support', { name: 'C', description: 'D' });
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String(patches[0]![1]!.body))).toEqual({ name: 'C', description: 'D' });
  });

  it('reports saved with a timestamp', async () => {
    stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('saved'));
    if (result.current.saveState.kind !== 'saved') throw new Error('expected saved');
    expect(Number.isNaN(new Date(result.current.saveState.at).getTime())).toBe(false);
  });

  it('rolls back and reports the failure when the save is rejected', async () => {
    stubApi({ patch: () => json({ error: { code: 'bad_request', message: 'Unknown model "gpt-4".' } }, 400) });
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    expect(result.current.agents[0]!.name).toBe('Renamed');

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('error'));
    expect(result.current.agents[0]!.name).toBe('Support Bot');
    if (result.current.saveState.kind !== 'error') throw new Error('expected error');
    expect(result.current.saveState.message).toBe('Unknown model "gpt-4".');
  });

  it('retries the same patch after a failure', async () => {
    let attempt = 0;
    const fetchMock = stubApi({
      patch: () => {
        attempt += 1;
        return attempt === 1
          ? json({ error: { code: 'network_error', message: 'nope' } }, 500)
          : json({ ...agent, name: 'Renamed' });
      },
    });
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await waitFor(() => expect(result.current.saveState.kind).toBe('error'));

    await act(async () => {
      result.current.retrySave();
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('saved'));
    expect(result.current.agents[0]!.name).toBe('Renamed');
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(patches).toHaveLength(2);
    expect(JSON.parse(String(patches[1]![1]!.body))).toEqual({ name: 'Renamed' });
  });

  it('flushes a pending patch without waiting for the debounce', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    act(() => result.current.updateAgent('agent_support', { name: 'Renamed' }));
    await act(async () => {
      await result.current.flushUpdates();
    });

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
  });
});

describe('useAgents create, duplicate, delete', () => {
  it('prepends a created agent', async () => {
    stubApi({});
    const { result } = await loaded();

    await act(async () => {
      await result.current.createAgent();
    });

    expect(result.current.agents[0]!.id).toBe('agent_new');
    expect(result.current.agents).toHaveLength(2);
  });

  it('duplicates an agent with a "Copy of" name and draft status', async () => {
    const fetchMock = stubApi({});
    const { result } = await loaded();

    await act(async () => {
      await result.current.duplicateAgent('agent_support');
    });

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse(String(post![1]!.body));
    expect(body.name).toBe('Copy of Support Bot');
    expect(body.status).toBe('draft');
    expect(body.toolIds).toEqual(['current_time']);
  });

  it('removes a deleted agent and reports success', async () => {
    stubApi({});
    const { result } = await loaded();

    let outcome = false;
    await act(async () => {
      outcome = await result.current.deleteAgent('agent_support');
    });

    expect(outcome).toBe(true);
    expect(result.current.agents).toHaveLength(0);
  });

  it('keeps the agent and reports failure when the delete is rejected', async () => {
    stubApi({ del: () => json({ error: { code: 'not_found', message: 'gone' } }, 404) });
    const { result } = await loaded();

    let outcome = true;
    await act(async () => {
      outcome = await result.current.deleteAgent('agent_support');
    });

    expect(outcome).toBe(false);
    expect(result.current.agents).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- useAgents`
Expected: FAIL — cannot resolve `./useAgents`.

- [ ] **Step 3: Write the hook**

`client/src/hooks/useAgents.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import type { Agent, AgentPatch } from '../types/agent';

export const AUTOSAVE_DELAY_MS = 600;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

interface PendingSave {
  agentId: string;
  patch: AgentPatch;
  /** The server-confirmed agent to restore if the write fails. */
  rollbackTo: Agent;
}

const messageOf = (thrown: unknown, fallback: string) =>
  thrown instanceof ApiError ? thrown.message : fallback;

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });

  const pending = useRef<PendingSave | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await apiGet<Agent[]>('/api/agents');
      if (!mounted.current) return;
      setAgents(fetched);
      setError(null);
    } catch (thrown) {
      if (!mounted.current) return;
      setError(messageOf(thrown, 'Could not load agents.'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Sends whatever is pending. Rolls the optimistic edit back on failure. */
  const send = useCallback(async () => {
    const save = pending.current;
    if (!save) return;

    setSaveState({ kind: 'saving' });
    try {
      const updated = await apiPatch<Agent>(`/api/agents/${save.agentId}`, save.patch);
      if (!mounted.current) return;
      pending.current = null;
      setAgents((current) => current.map((agent) => (agent.id === updated.id ? updated : agent)));
      setSaveState({ kind: 'saved', at: new Date().toISOString() });
    } catch (thrown) {
      if (!mounted.current) return;
      // Keep `pending` so retrySave can send the same patch again.
      setAgents((current) => current.map((agent) => (agent.id === save.agentId ? save.rollbackTo : agent)));
      setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not save.') });
    }
  }, []);

  const updateAgent = useCallback((id: string, patch: AgentPatch) => {
    setAgents((current) => {
      const existing = current.find((agent) => agent.id === id);
      if (!existing) return current;

      // Capture the rollback target once per burst, not on every keystroke.
      pending.current = {
        agentId: id,
        patch: { ...(pending.current?.agentId === id ? pending.current.patch : {}), ...patch },
        rollbackTo: pending.current?.agentId === id ? pending.current.rollbackTo : existing,
      };

      return current.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent));
    });

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void send(), AUTOSAVE_DELAY_MS);
  }, [send]);

  const flushUpdates = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await send();
  }, [send]);

  const retrySave = useCallback(() => {
    void send();
  }, [send]);

  const createAgent = useCallback(async (): Promise<Agent | null> => {
    try {
      const agent = await apiPost<Agent>('/api/agents', {});
      if (mounted.current) setAgents((current) => [agent, ...current]);
      return agent;
    } catch (thrown) {
      if (mounted.current) setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not create the agent.') });
      return null;
    }
  }, []);

  const duplicateAgent = useCallback(
    async (id: string): Promise<Agent | null> => {
      const source = agents.find((agent) => agent.id === id);
      if (!source) return null;

      try {
        const agent = await apiPost<Agent>('/api/agents', {
          name: `Copy of ${source.name}`,
          icon: source.icon,
          description: source.description,
          model: source.model,
          systemPrompt: source.systemPrompt,
          toolIds: source.toolIds,
          // A copy starts as a draft: it has not been tested under its new name.
          status: 'draft',
        });
        if (mounted.current) setAgents((current) => [agent, ...current]);
        return agent;
      } catch (thrown) {
        if (mounted.current) {
          setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not duplicate the agent.') });
        }
        return null;
      }
    },
    [agents],
  );

  const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiDelete(`/api/agents/${id}`);
      if (mounted.current) setAgents((current) => current.filter((agent) => agent.id !== id));
      return true;
    } catch (thrown) {
      if (mounted.current) setSaveState({ kind: 'error', message: messageOf(thrown, 'Could not delete the agent.') });
      return false;
    }
  }, []);

  return {
    agents,
    loading,
    error,
    saveState,
    createAgent,
    duplicateAgent,
    updateAgent,
    flushUpdates,
    deleteAgent,
    retrySave,
    reload,
  };
};
```

- [ ] **Step 4: Add the provider so one instance serves every surface**

The file needs `createContext` and a type import, so adjust its first line to:

```ts
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
```

and append at the end of the file:

```ts
export type UseAgentsResult = ReturnType<typeof useAgents>;

const AgentsContext = createContext<UseAgentsResult | null>(null);

/**
 * Calls useAgents exactly once for the whole app. Without this, the sidebar,
 * the Agents page, and the Chat page would each hold their own copy of the
 * list, and a create on one surface would not show up on the others.
 */
export const AgentsProvider = ({ children }: { children: ReactNode }) => {
  const value = useAgents();
  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
};

export const useAgentsContext = (): UseAgentsResult => {
  const value = useContext(AgentsContext);
  if (!value) throw new Error('useAgentsContext must be called inside an AgentsProvider.');
  return value;
};
```

The provider returns JSX, so **rename the file to `client/src/hooks/useAgents.tsx`**. Imports elsewhere are written without an extension and do not change.

- [ ] **Step 5: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- useAgents`
Expected: PASS, 12 tests.

- [ ] **Step 6: Run the whole suite and boot the app**

Run from `AgentPlatform-FrontEnd/client`: `npm test && npm run typecheck`
Expected: PASS, no type errors.

Then start the backend and `npm run dev`. Expected at `http://localhost:5173`: the sidebar renders on `--shell` with a green `connected · mock` pill, expanding **Agents** lists the four seed agents, clicking one changes the URL to `/agents/agent_support`, and the Agents placeholder page shows its title. Resize below 900px and confirm the sidebar collapses behind a hamburger with a working scrim. Stop both servers.

- [ ] **Step 7: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src
git commit -m "feat: add useAgents with optimistic patch, rollback, and autosave"
```

---

### Task 11: The agents table

**Files:**
- Create: `client/src/components/agents-section/agent-table/agent-table.tsx`, `agent-table.css`, `index.ts`
- Modify: `client/src/pages/Agents/index.tsx`, `client/src/pages/Agents/agents.css`
- Test: `client/src/components/agents-section/agent-table/agent-table.test.tsx`

**Interfaces:**
- Consumes: `Chip` (Task 6), `Skeleton` (Task 6), `Button` (Task 6), `Popover` (Task 7), `EmptyState` (Task 7); `formatRelativeTime` (Task 4); `modelLabel` (Task 5); `toolLabel`, `useTools` (Task 5); `useAgents` (Task 10).
- Produces `AgentTable` with props:

  ```ts
  interface AgentTableProps {
    agents: Agent[];
    tools: readonly Tool[];
    loading: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onTestInChat: (id: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
  }
  ```

- Behavior contract:
  - Renders a semantic `<table>`: `NAME`, `DESCRIPTION`, `MODEL`, `TOOLS`, `STATUS`, `UPDATED`, plus an unlabelled actions column whose header is `sr-only` text "Actions".
  - Each row is `<tr tabIndex={0}>` with `onClick` and `onKeyDown` for Enter and Space, so mouse and keyboard both open the peek. The selected row carries `aria-selected` and a `--active` background.
  - Tools render at most two `trace` chips followed by `+N`; zero tools render an em dash.
  - `loading` renders three skeleton rows instead of the body.
  - The `⋯` button is present in the DOM at all times for keyboard reach but is transparent until row hover or focus-within, so it does not clutter a resting table.
- `AgentsPage` owns the view bar (count, filter, New agent), filters by `searchQuery` against name and description case-insensitively, and routes selection through `navigate` so the URL always names the open agent.

- [ ] **Step 1: Write the failing tests**

`client/src/components/agents-section/agent-table/agent-table.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentTable } from './agent-table';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: '', params: [] },
  { id: 'http_request', label: 'HTTP request', description: '', params: [] },
  { id: 'calculator', label: 'Calculator', description: '', params: [] },
];

const make = (over: Partial<Agent>): Agent => ({
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-2.5-flash',
  systemPrompt: '',
  toolIds: ['current_time', 'http_request'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
  ...over,
});

const defaults = {
  tools,
  loading: false,
  selectedId: null,
  onSelect: () => {},
  onTestInChat: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
};

describe('AgentTable', () => {
  it('renders a real table with the documented columns', () => {
    render(<AgentTable {...defaults} agents={[make({})]} />);
    const table = screen.getByRole('table', { name: 'Agents' });
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Name', 'Description', 'Model', 'Tools', 'Status', 'Updated', 'Actions']);
  });

  it('shows at most two tool chips and counts the rest', () => {
    render(<AgentTable {...defaults} agents={[make({ toolIds: ['current_time', 'http_request', 'calculator'] })]} />);
    expect(screen.getByText('Current time')).toBeInTheDocument();
    expect(screen.getByText('HTTP request')).toBeInTheDocument();
    expect(screen.queryByText('Calculator')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders an em dash for an agent with no tools', () => {
    render(<AgentTable {...defaults} agents={[make({ toolIds: [] })]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('reports the status as text rather than colour alone', () => {
    render(<AgentTable {...defaults} agents={[make({ status: 'draft' })]} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('selects on click', async () => {
    const onSelect = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('row', { name: /Support Bot/ }));
    expect(onSelect).toHaveBeenCalledWith('agent_support');
  });

  it('selects on Enter from the keyboard', async () => {
    const onSelect = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onSelect={onSelect} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('agent_support');
  });

  it('marks the selected row', () => {
    render(<AgentTable {...defaults} agents={[make({})]} selectedId="agent_support" />);
    expect(screen.getByRole('row', { name: /Support Bot/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('offers row actions without selecting the row', async () => {
    const onSelect = vi.fn();
    const onDuplicate = vi.fn();
    render(<AgentTable {...defaults} agents={[make({})]} onSelect={onSelect} onDuplicate={onDuplicate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Support Bot' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(onDuplicate).toHaveBeenCalledWith('agent_support');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders skeleton rows while loading and no agent rows', () => {
    render(<AgentTable {...defaults} agents={[]} loading />);
    expect(screen.queryByRole('row', { name: /Support Bot/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3 skeletons
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- agent-table`
Expected: FAIL — cannot resolve `./agent-table`.

- [ ] **Step 3: Write AgentTable**

`client/src/components/agents-section/agent-table/agent-table.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Chip } from '../../ui/chip';
import { Popover } from '../../ui/popover';
import { Skeleton } from '../../ui/skeleton';
import { formatRelativeTime } from '../../../lib/format';
import { toolLabel } from '../../../hooks/useTools';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import './agent-table.css';

const MAX_VISIBLE_TOOLS = 2;
const SKELETON_ROWS = 3;

interface AgentTableProps {
  agents: Agent[];
  tools: readonly Tool[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTestInChat: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const AgentRow = ({
  agent,
  tools,
  selected,
  onSelect,
  onTestInChat,
  onDuplicate,
  onDelete,
}: {
  agent: Agent;
  tools: readonly Tool[];
  selected: boolean;
  onSelect: (id: string) => void;
  onTestInChat: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const visible = agent.toolIds.slice(0, MAX_VISIBLE_TOOLS);
  const overflow = agent.toolIds.length - visible.length;

  return (
    <tr
      className={['agent-row', selected ? 'agent-row--selected' : ''].filter(Boolean).join(' ')}
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(agent.id);
      }}
    >
      <td className="agent-row__name">
        <span className="agent-row__icon" aria-hidden="true">
          {agent.icon}
        </span>
        <span className="agent-row__name-text" title={agent.name}>
          {agent.name}
        </span>
      </td>
      <td className="agent-row__description" title={agent.description}>
        {agent.description || <span className="agent-row__dash">—</span>}
      </td>
      <td>
        {/* The raw id, not the friendly label: this column is machine data. */}
        <Chip>{agent.model}</Chip>
      </td>
      <td>
        {agent.toolIds.length === 0 ? (
          <span className="agent-row__dash">—</span>
        ) : (
          <span className="agent-row__tools">
            {visible.map((toolId) => (
              <Chip key={toolId} tone="trace">
                {toolLabel(tools, toolId)}
              </Chip>
            ))}
            {overflow > 0 && <span className="agent-row__overflow mono">+{overflow}</span>}
          </span>
        )}
      </td>
      <td>
        <span className="agent-row__status">
          <span className={`agent-row__dot agent-row__dot--${agent.status}`} aria-hidden="true" />
          {agent.status === 'active' ? 'Active' : 'Draft'}
        </span>
      </td>
      <td className="agent-row__updated mono">{formatRelativeTime(agent.updatedAt)}</td>
      <td className="agent-row__actions">
        <button
          ref={menuRef}
          type="button"
          className="agent-row__menu"
          aria-label={`Actions for ${agent.name}`}
          onClick={(event) => {
            // The row is clickable; the menu must not also select it.
            event.stopPropagation();
            setMenuOpen(true);
          }}
        >
          ⋯
        </button>
        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchor={menuRef}
          label={`Actions for ${agent.name}`}
          align="end"
          width={200}
        >
          <button
            type="button"
            className="popover__item"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onTestInChat(agent.id);
            }}
          >
            Test in chat
          </button>
          <button
            type="button"
            className="popover__item"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onDuplicate(agent.id);
            }}
          >
            Duplicate
          </button>
          <div className="popover__divider" />
          <button
            type="button"
            className="popover__item popover__item--danger"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(false);
              onDelete(agent.id);
            }}
          >
            Delete
          </button>
        </Popover>
      </td>
    </tr>
  );
};

export const AgentTable = ({
  agents,
  tools,
  loading,
  selectedId,
  onSelect,
  onTestInChat,
  onDuplicate,
  onDelete,
}: AgentTableProps) => (
  <table className="agent-table" aria-label="Agents">
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col" className="agent-table__col-description">
          Description
        </th>
        <th scope="col">Model</th>
        <th scope="col">Tools</th>
        <th scope="col" className="agent-table__col-status">
          Status
        </th>
        <th scope="col">Updated</th>
        <th scope="col">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
    <tbody>
      {loading
        ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <tr key={index} className="agent-row agent-row--skeleton">
              <td>
                <Skeleton width="140px" />
              </td>
              <td className="agent-table__col-description">
                <Skeleton width="200px" />
              </td>
              <td>
                <Skeleton width="90px" />
              </td>
              <td>
                <Skeleton width="70px" />
              </td>
              <td className="agent-table__col-status">
                <Skeleton width="50px" />
              </td>
              <td>
                <Skeleton width="48px" />
              </td>
              <td />
            </tr>
          ))
        : agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              tools={tools}
              selected={agent.id === selectedId}
              onSelect={onSelect}
              onTestInChat={onTestInChat}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
    </tbody>
  </table>
);
```

`client/src/components/agents-section/agent-table/index.ts`:

```ts
export { AgentTable } from './agent-table';
```

- [ ] **Step 4: Write the table styles**

`client/src/components/agents-section/agent-table/agent-table.css`:

```css
.agent-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.agent-table th {
  padding: 0 var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--rule);
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--ink-muted);
  text-align: left;
  white-space: nowrap;
}

.agent-table th:first-child,
.agent-table td:first-child {
  padding-left: 0;
}

.agent-table th:nth-child(1) { width: 22%; }
.agent-table th:nth-child(2) { width: 28%; }
.agent-table th:nth-child(3) { width: 15%; }
.agent-table th:nth-child(4) { width: 17%; }
.agent-table th:nth-child(5) { width: 9%; }
.agent-table th:nth-child(6) { width: 9%; }
.agent-table th:nth-child(7) { width: 32px; }

.agent-row {
  height: var(--row-height);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.agent-row td {
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--rule);
  font-size: var(--text-ui);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.agent-row:hover {
  background: var(--hover);
}

.agent-row--selected {
  background: var(--active);
}

.agent-row--skeleton {
  cursor: default;
}

.agent-row__name {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: var(--row-height);
}

.agent-row__icon {
  flex: 0 0 auto;
  font-size: var(--text-ui);
  line-height: 1;
}

.agent-row__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.agent-row__description {
  color: var(--ink-muted);
}

.agent-row__dash {
  color: var(--ink-faint);
}

.agent-row__tools {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
}

.agent-row__overflow {
  flex: 0 0 auto;
  font-size: var(--text-meta);
  color: var(--ink-faint);
}

.agent-row__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-label);
  color: var(--ink-muted);
}

.agent-row__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
}

.agent-row__dot--active {
  background: var(--ok);
}

.agent-row__dot--draft {
  background: var(--ink-faint);
}

.agent-row__updated {
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

.agent-row__actions {
  padding: 0 !important;
  text-align: right;
}

/*
  Present for keyboard reach at all times, invisible until the row is engaged,
  so a resting table stays quiet.
*/
.agent-row__menu {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.agent-row:hover .agent-row__menu,
.agent-row:focus-within .agent-row__menu,
.agent-row__menu:focus-visible {
  opacity: 1;
}

.agent-row__menu:hover {
  background: var(--active);
  color: var(--ink);
}

/* 1080px: description is the first thing a narrower table can lose. */
@media (max-width: 1080px) {
  .agent-table__col-description,
  .agent-row__description {
    display: none;
  }
}

/* 700px: status is derivable from the peek; drop it before the tools. */
@media (max-width: 700px) {
  .agent-table__col-status,
  .agent-row td:nth-child(5) {
    display: none;
  }
}
```

- [ ] **Step 5: Rewrite the Agents page around the table**

`client/src/pages/Agents/index.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentTable } from '../../components/agents-section/agent-table';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { useToast } from '../../components/ui/toast';
import { useAgentsContext } from '../../hooks/useAgents';
import { useTools } from '../../hooks/useTools';
import './agents.css';

interface AgentsPageProps {
  searchQuery: string;
}

const AgentsPage = ({ searchQuery }: AgentsPageProps) => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const { agents, loading, error, createAgent, duplicateAgent, deleteAgent } = useAgentsContext();
  const { tools } = useTools();
  const [filter, setFilter] = useState('');

  // The sidebar search and the local filter mean the same thing to the reader.
  const query = (searchQuery || filter).trim().toLowerCase();

  const visible = useMemo(() => {
    if (query.length === 0) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) || agent.description.toLowerCase().includes(query),
    );
  }, [agents, query]);

  const onCreate = async () => {
    const agent = await createAgent();
    if (agent) navigate(`/agents/${agent.id}`);
  };

  const onDelete = async (id: string) => {
    const target = agents.find((agent) => agent.id === id);
    if (!target) return;
    if (await deleteAgent(id)) {
      show('Agent deleted');
      if (agentId === id) navigate('/agents');
    }
  };

  return (
    <div className="agents">
      <h1 className="agents__title">Agents</h1>
      <p className="agents__subtitle">Configure agents and the tools they can reach.</p>

      {error && (
        <p className="agents__error" role="alert">
          {error} <button type="button" className="agents__retry" onClick={() => window.location.reload()}>Reload</button>
        </p>
      )}

      <div className="agents__viewbar">
        <span className="agents__count mono">
          {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
        </span>
        <input
          type="search"
          className="agents__filter"
          aria-label="Filter agents"
          placeholder="Filter…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <Button variant="primary" onClick={onCreate}>
          New agent
        </Button>
      </div>

      {!loading && agents.length === 0 && (
        <EmptyState
          icon="▤"
          title="No agents yet."
          body="Create your first agent to start testing."
          action={{ label: 'New agent', onClick: onCreate }}
        />
      )}

      {!loading && agents.length > 0 && visible.length === 0 && (
        <EmptyState
          title={`No agents match “${query}”.`}
          body="Try a shorter search, or clear the filter to see everything."
          action={{ label: 'Clear filter', onClick: () => setFilter('') }}
        />
      )}

      {(loading || visible.length > 0) && (
        <AgentTable
          agents={visible}
          tools={tools}
          loading={loading}
          selectedId={agentId ?? null}
          onSelect={(id) => navigate(`/agents/${id}`)}
          onTestInChat={(id) => navigate(`/chat/${id}`)}
          onDuplicate={async (id) => {
            const copy = await duplicateAgent(id);
            if (copy) navigate(`/agents/${copy.id}`);
          }}
          onDelete={onDelete}
        />
      )}
    </div>
  );
};

export default AgentsPage;
```

Append to `client/src/pages/Agents/agents.css`:

```css
.agents__viewbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin: var(--space-8) 0 var(--space-5);
}

.agents__count {
  font-size: var(--text-label);
  color: var(--ink-muted);
}

.agents__filter {
  flex: 1;
  min-width: 0;
  max-width: 240px;
  height: 28px;
  padding: 0 var(--space-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  background: var(--paper);
  font-size: var(--text-ui);
}

.agents__filter::-webkit-search-cancel-button {
  appearance: none;
}

.agents__viewbar > .button {
  margin-left: auto;
}

.agents__error {
  margin-top: var(--space-6);
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--err-wash);
  color: var(--ink);
  font-size: var(--text-ui);
}

.agents__retry {
  color: var(--signal);
  font-weight: 500;
  text-decoration: underline;
}

@media (max-width: 700px) {
  .agents {
    padding: var(--space-7) var(--space-6) var(--space-9);
  }

  .agents__title {
    font-size: 28px;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- agent-table`
Expected: PASS, 9 tests. Then `npm test` — the whole suite passes.

- [ ] **Step 7: Look at it**

Start the backend and `npm run dev`. At `http://localhost:5173/agents`, confirm: 40px rows with hairline dividers, purple tool chips, the `⋯` appearing only on hover, `Release Notes Drafter (internal review copy)` truncating with an ellipsis and showing its full name on hover, an em dash in its Tools cell, and `Draft` with a grey dot. Type in the sidebar search and confirm the table filters. Narrow to 1000px and confirm Description disappears.

- [ ] **Step 8: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src
git commit -m "feat: add agents table with row actions and filtering"
```

---

### Task 12: The agent peek — form, tool picker, autosave readout

**Files:**
- Create: `client/src/components/agents-section/agent-peek/agent-peek.tsx`, `agent-peek.css`, `index.ts`
- Create: `client/src/components/agents-section/agent-form/agent-form.tsx`, `agent-form.css`
- Create: `client/src/components/agents-section/tool-picker/tool-picker.tsx`, `tool-picker.css`
- Modify: `client/src/pages/Agents/index.tsx`, `agents.css`
- Test: `client/src/components/agents-section/agent-peek/agent-peek.test.tsx`, `client/src/components/agents-section/tool-picker/tool-picker.test.tsx`

**Interfaces:**
- Consumes: `AutoTextarea`, `Popover` (Task 7); `Button`, `Select`, `Chip` (Task 6); `ConfirmDelete` (Task 8); `AGENT_ICONS` (Task 5); `MODELS` (Task 5); `formatClockTime`, `formatRelativeTime` (Task 4); `SaveState` (Task 10); `useMediaQuery`, `BREAKPOINT_SHEET` (Task 5).
- Produces `AgentPeek`:

  ```ts
  interface AgentPeekProps {
    agent: Agent;
    tools: readonly Tool[];
    saveState: SaveState;
    onChange: (patch: AgentPatch) => void;   // wired to useAgents.updateAgent
    onFlush: () => void;                     // wired to useAgents.flushUpdates
    onRetrySave: () => void;
    onDelete: () => void;
    onClose: () => void;
  }
  ```

- Produces `AgentForm` with props `{ agent, tools, onChange, onFlush }` — the property rows and the system prompt. Split from `AgentPeek` so the panel chrome (header, footer, sheet behavior, focus handling) stays separate from the fields.
- Produces `ToolPicker` with props `{ open, onClose, anchor, tools, selectedIds, onChange }`. Search input, checkbox rows, `↑`/`↓` to move, Space to toggle, Escape to close, and a mono footer reading `N of M selected`.
- Behavior contract:
  - `role="dialog"` with `aria-modal="false"` on wide viewports; the table stays interactive and no focus trap is installed. Under `BREAKPOINT_SHEET` it becomes a bottom sheet with `aria-modal="true"` and traps focus, because the table is no longer visible behind it.
  - Escape closes the peek and returns focus to the row that opened it. `AgentsPage` restores focus by id after close.
  - Every field calls `onChange` on input and `onFlush` on blur. There is no Save button.
  - The footer renders from `saveState`: nothing when `idle`, `Saving…` when saving, `Saved 21:04:12` when saved, and `Couldn't save. Retry` in `--err` with a Retry button when errored.

- [ ] **Step 1: Write the failing peek tests**

`client/src/components/agents-section/agent-peek/agent-peek.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentPeek } from './agent-peek';
import type { Agent } from '../../../types/agent';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: 'Reads the time.', params: [] },
  { id: 'http_request', label: 'HTTP request', description: 'Fetches a URL.', params: [] },
];

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-2.5-flash',
  systemPrompt: 'Be terse.',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const defaults = {
  agent,
  tools,
  saveState: { kind: 'idle' } as const,
  onChange: () => {},
  onFlush: () => {},
  onRetrySave: () => {},
  onDelete: () => {},
  onClose: () => {},
};

describe('AgentPeek', () => {
  it('is a non-modal dialog on a wide viewport so the table stays usable', () => {
    render(<AgentPeek {...defaults} />);
    const dialog = screen.getByRole('dialog', { name: /Support Bot/ });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
  });

  it('edits the name through a plain input, with no Save button anywhere', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);

    const nameInput = screen.getByRole('textbox', { name: 'Agent name' });
    expect(nameInput).toHaveValue('Support Bot');

    await userEvent.type(nameInput, '!');
    expect(onChange).toHaveBeenLastCalledWith({ name: 'Support Bot!' });
    expect(screen.queryByRole('button', { name: /^Save$/ })).not.toBeInTheDocument();
  });

  it('flushes pending edits when a field loses focus', async () => {
    const onFlush = vi.fn();
    render(<AgentPeek {...defaults} onFlush={onFlush} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Agent name' }));
    await userEvent.tab();
    expect(onFlush).toHaveBeenCalled();
  });

  it('sets the system prompt in the mono face', () => {
    render(<AgentPeek {...defaults} />);
    expect(screen.getByRole('textbox', { name: 'System prompt' }).className).toContain('mono');
  });

  it('shows the attached tools as removable chips', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Current time' }));
    expect(onChange).toHaveBeenCalledWith({ toolIds: [] });
  });

  it('reads the save state as a timestamp', () => {
    render(<AgentPeek {...defaults} saveState={{ kind: 'saved', at: '2026-08-04T21:04:12.000Z' }} />);
    expect(screen.getByText(/^Saved \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('offers a retry when a save failed, and says what happened', async () => {
    const onRetrySave = vi.fn();
    render(
      <AgentPeek
        {...defaults}
        saveState={{ kind: 'error', message: 'Unknown model "gpt-4".' }}
        onRetrySave={onRetrySave}
      />,
    );
    expect(screen.getByText(/Couldn’t save/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetrySave).toHaveBeenCalledOnce();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<AgentPeek {...defaults} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requires a confirmation before deleting, and names the agent', async () => {
    const onDelete = vi.fn();
    render(<AgentPeek {...defaults} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete agent' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Support Bot?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('changes the model through a labelled select', async () => {
    const onChange = vi.fn();
    render(<AgentPeek {...defaults} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Model' }), 'gemini-2.5-pro');
    expect(onChange).toHaveBeenCalledWith({ model: 'gemini-2.5-pro' });
  });
});
```

- [ ] **Step 2: Write the failing tool-picker tests**

`client/src/components/agents-section/tool-picker/tool-picker.test.tsx`:

```tsx
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolPicker } from './tool-picker';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: 'Reads the time.', params: [] },
  { id: 'http_request', label: 'HTTP request', description: 'Fetches a URL.', params: [] },
  { id: 'calculator', label: 'Calculator', description: 'Does arithmetic.', params: [] },
  { id: 'knowledge_search', label: 'Knowledge search', description: 'Searches docs.', params: [] },
];

const Harness = ({ onChange }: { onChange: (ids: string[]) => void }) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(['current_time']);

  return (
    <div>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Add tool
      </button>
      <ToolPicker
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        tools={tools}
        selectedIds={selected}
        onChange={(ids) => {
          setSelected(ids);
          onChange(ids);
        }}
      />
    </div>
  );
};

const open = async () => userEvent.click(screen.getByRole('button', { name: 'Add tool' }));

describe('ToolPicker', () => {
  it('lists every tool with its id shown as machine data', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    expect(screen.getByRole('checkbox', { name: /Current time/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Calculator/ })).not.toBeChecked();
    expect(screen.getByText('knowledge_search')).toBeInTheDocument();
  });

  it('counts the selection', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();
  });

  it('adds a tool on click, preserving what was already selected', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /Calculator/ }));
    expect(onChange).toHaveBeenCalledWith(['current_time', 'calculator']);
  });

  it('removes a tool when it is unchecked', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /Current time/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters by label and by id', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    const search = screen.getByRole('searchbox', { name: 'Search tools' });

    await userEvent.type(search, 'calc');
    expect(screen.getByRole('checkbox', { name: /Calculator/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Current time/ })).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'http_');
    expect(screen.getByRole('checkbox', { name: /HTTP request/ })).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    render(<Harness onChange={() => {}} />);
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tools' }), 'teleport');
    expect(screen.getByText('No tools match that search.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- agent-peek tool-picker`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write ToolPicker**

`client/src/components/agents-section/tool-picker/tool-picker.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { Popover } from '../../ui/popover';
import type { Tool } from '../../../types/tool';
import './tool-picker.css';

interface ToolPickerProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  tools: readonly Tool[];
  selectedIds: readonly string[];
  onChange: (toolIds: string[]) => void;
}

export const ToolPicker = ({ open, onClose, anchor, tools, selectedIds, onChange }: ToolPickerProps) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return tools;
    // Search the id too: people who know the tool by its wire name find it faster.
    return tools.filter(
      (tool) => tool.label.toLowerCase().includes(needle) || tool.id.toLowerCase().includes(needle),
    );
  }, [tools, query]);

  const toggle = (toolId: string) => {
    onChange(
      selectedIds.includes(toolId)
        ? selectedIds.filter((id) => id !== toolId)
        : [...selectedIds, toolId],
    );
  };

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} label="Attach tools" width={320}>
      <div className="tool-picker">
        <input
          type="search"
          className="tool-picker__search"
          aria-label="Search tools"
          placeholder="Search tools…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <ul className="tool-picker__list">
          {matches.map((tool) => (
            <li key={tool.id}>
              <label className="tool-picker__row">
                <input
                  type="checkbox"
                  className="tool-picker__checkbox"
                  checked={selectedIds.includes(tool.id)}
                  onChange={() => toggle(tool.id)}
                />
                <span className="tool-picker__text">
                  <span className="tool-picker__label">{tool.label}</span>
                  <span className="tool-picker__id mono">{tool.id}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {matches.length === 0 && <p className="tool-picker__empty">No tools match that search.</p>}

        <p className="tool-picker__footer mono">
          {selectedIds.length} of {tools.length} selected
        </p>
      </div>
    </Popover>
  );
};
```

`client/src/components/agents-section/tool-picker/tool-picker.css`:

```css
.tool-picker {
  display: flex;
  flex-direction: column;
}

.tool-picker__search {
  height: 28px;
  margin: var(--space-2) var(--space-2) var(--space-3);
  padding: 0 var(--space-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  font-size: var(--text-ui);
}

.tool-picker__search::-webkit-search-cancel-button {
  appearance: none;
}

.tool-picker__list {
  max-height: 260px;
  overflow-y: auto;
}

.tool-picker__row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.tool-picker__row:hover {
  background: var(--hover);
}

.tool-picker__checkbox {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  accent-color: var(--signal);
}

.tool-picker__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.tool-picker__label {
  font-size: var(--text-ui);
  color: var(--ink);
}

.tool-picker__id {
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

.tool-picker__empty {
  padding: var(--space-6) var(--space-4);
  font-size: var(--text-ui);
  color: var(--ink-muted);
  text-align: center;
}

.tool-picker__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--rule);
  font-size: var(--text-meta);
  color: var(--ink-muted);
}
```

- [ ] **Step 5: Write AgentForm**

`client/src/components/agents-section/agent-form/agent-form.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Chip } from '../../ui/chip';
import { Select } from '../../ui/select';
import { AutoTextarea } from '../../ui/textarea';
import { ToolPicker } from '../tool-picker/tool-picker';
import { MODELS } from '../../../config/models';
import { formatRelativeTime } from '../../../lib/format';
import { toolLabel } from '../../../hooks/useTools';
import type { Agent, AgentPatch } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import './agent-form.css';

interface AgentFormProps {
  agent: Agent;
  tools: readonly Tool[];
  onChange: (patch: AgentPatch) => void;
  onFlush: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
];

const MODEL_OPTIONS = MODELS.map((model) => ({ value: model.id, label: model.label }));

export const AgentForm = ({ agent, tools, onChange, onFlush }: AgentFormProps) => {
  const toolButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="agent-form">
      <div className="agent-form__row">
        <span className="agent-form__label">Status</span>
        <div className="agent-form__value">
          <Select
            label="Status"
            hideLabel
            value={agent.status}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              onChange({ status: value === 'draft' ? 'draft' : 'active' });
              onFlush();
            }}
          />
        </div>
      </div>

      <div className="agent-form__row">
        <span className="agent-form__label">Model</span>
        <div className="agent-form__value">
          <Select
            label="Model"
            hideLabel
            mono
            value={agent.model}
            options={MODEL_OPTIONS}
            onChange={(value) => {
              onChange({ model: value });
              onFlush();
            }}
          />
        </div>
      </div>

      <div className="agent-form__row agent-form__row--tools">
        <span className="agent-form__label">Tools</span>
        <div className="agent-form__value">
          <div className="agent-form__chips">
            {agent.toolIds.map((toolId) => (
              <Chip
                key={toolId}
                tone="trace"
                removeLabel={`Remove ${toolLabel(tools, toolId)}`}
                onRemove={() => {
                  onChange({ toolIds: agent.toolIds.filter((id) => id !== toolId) });
                  onFlush();
                }}
              >
                {toolLabel(tools, toolId)}
              </Chip>
            ))}
            <button
              ref={toolButtonRef}
              type="button"
              className="agent-form__add-tool"
              onClick={() => setPickerOpen(true)}
            >
              {agent.toolIds.length === 0 ? 'Attach a tool' : 'Add'}
            </button>
          </div>
          <ToolPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            anchor={toolButtonRef}
            tools={tools}
            selectedIds={agent.toolIds}
            onChange={(toolIds) => {
              onChange({ toolIds });
              onFlush();
            }}
          />
        </div>
      </div>

      <div className="agent-form__row">
        <span className="agent-form__label">Created</span>
        <span className="agent-form__value agent-form__readonly mono">
          {formatRelativeTime(agent.createdAt)}
        </span>
      </div>

      <div className="agent-form__row">
        <span className="agent-form__label">Updated</span>
        <span className="agent-form__value agent-form__readonly mono">
          {formatRelativeTime(agent.updatedAt)}
        </span>
      </div>

      <hr className="agent-form__divider" />

      <h2 className="agent-form__heading">System prompt</h2>
      <AutoTextarea
        label="System prompt"
        hideLabel
        mono
        minRows={8}
        maxHeight={420}
        placeholder="Describe how this agent should behave, and when to reach for a tool."
        value={agent.systemPrompt}
        onChange={(value) => onChange({ systemPrompt: value })}
        onBlur={onFlush}
      />
      <p className="agent-form__count mono">{agent.systemPrompt.length} characters</p>

      <hr className="agent-form__divider" />

      <label className="agent-form__heading" htmlFor="agent-description">
        Description
      </label>
      <input
        id="agent-description"
        type="text"
        className="agent-form__input"
        placeholder="One line on what this agent is for."
        value={agent.description}
        onChange={(event) => onChange({ description: event.target.value })}
        onBlur={onFlush}
      />
    </div>
  );
};
```

`client/src/components/agents-section/agent-form/agent-form.css`:

```css
.agent-form {
  padding: 0 var(--space-7) var(--space-8);
}

.agent-form__row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  min-height: 32px;
  padding: var(--space-1) 0;
}

.agent-form__row--tools {
  align-items: flex-start;
  padding: var(--space-3) 0;
}

.agent-form__label {
  flex: 0 0 120px;
  font-size: var(--text-ui);
  color: var(--ink-muted);
}

.agent-form__value {
  flex: 1;
  min-width: 0;
}

.agent-form__readonly {
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

.agent-form__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.agent-form__add-tool {
  height: 20px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-meta);
  font-weight: 500;
  color: var(--ink-muted);
}

.agent-form__add-tool:hover {
  background: var(--hover);
  color: var(--ink);
}

.agent-form__divider {
  height: 1px;
  margin: var(--space-7) 0 var(--space-6);
  border: 0;
  background: var(--rule);
}

.agent-form__heading {
  display: block;
  margin-bottom: var(--space-4);
  font-size: var(--text-ui);
  font-weight: 600;
  color: var(--ink);
}

.agent-form__count {
  margin-top: var(--space-3);
  font-size: var(--text-meta);
  color: var(--ink-faint);
  text-align: right;
}

.agent-form__input {
  width: 100%;
  height: 32px;
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--shell);
  font-size: var(--text-ui);
  transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.agent-form__input:focus {
  background: var(--paper);
  border-color: var(--rule);
}
```

- [ ] **Step 6: Write AgentPeek**

`client/src/components/agents-section/agent-peek/agent-peek.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AgentForm } from '../agent-form/agent-form';
import { ConfirmDelete } from '../../ui/confirm-delete';
import { Popover } from '../../ui/popover';
import { AGENT_ICONS } from '../../../lib/agent-icons';
import { formatClockTime } from '../../../lib/format';
import { BREAKPOINT_SHEET, useMediaQuery } from '../../../hooks/useMediaQuery';
import type { SaveState } from '../../../hooks/useAgents';
import type { Agent, AgentPatch } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import './agent-peek.css';

interface AgentPeekProps {
  agent: Agent;
  tools: readonly Tool[];
  saveState: SaveState;
  onChange: (patch: AgentPatch) => void;
  onFlush: () => void;
  onRetrySave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const SaveReadout = ({ saveState, onRetrySave }: { saveState: SaveState; onRetrySave: () => void }) => {
  if (saveState.kind === 'idle') return null;

  if (saveState.kind === 'error') {
    return (
      <p className="agent-peek__save agent-peek__save--error" role="alert">
        <span className="mono">Couldn&rsquo;t save. {saveState.message}</span>
        <button type="button" className="agent-peek__retry" onClick={onRetrySave}>
          Retry
        </button>
      </p>
    );
  }

  return (
    <p className="agent-peek__save mono">
      {saveState.kind === 'saving' ? 'Saving…' : `Saved ${formatClockTime(saveState.at)}`}
    </p>
  );
};

export const AgentPeek = ({
  agent,
  tools,
  saveState,
  onChange,
  onFlush,
  onRetrySave,
  onDelete,
  onClose,
}: AgentPeekProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSheet = useMediaQuery(BREAKPOINT_SHEET);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // As a bottom sheet the table is hidden behind it, so focus must stay inside.
  useEffect(() => {
    if (!isSheet) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [isSheet]);

  return (
    <div
      ref={panelRef}
      className={['agent-peek', isSheet ? 'agent-peek--sheet' : ''].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal={isSheet ? 'true' : 'false'}
      aria-label={`Agent ${agent.name}`}
    >
      <div className="agent-peek__header">
        <button
          ref={iconRef}
          type="button"
          className="agent-peek__icon"
          aria-label="Change icon"
          onClick={() => setIconOpen(true)}
        >
          {agent.icon}
        </button>

        <Popover open={iconOpen} onClose={() => setIconOpen(false)} anchor={iconRef} label="Choose an icon" width={248}>
          <div className="agent-peek__icon-grid">
            {AGENT_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className="agent-peek__icon-option"
                aria-label={`Use ${icon}`}
                aria-pressed={icon === agent.icon}
                onClick={() => {
                  onChange({ icon });
                  onFlush();
                  setIconOpen(false);
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </Popover>

        <input
          type="text"
          className="agent-peek__name"
          aria-label="Agent name"
          value={agent.name}
          onChange={(event) => onChange({ name: event.target.value })}
          onBlur={onFlush}
        />

        <button type="button" className="agent-peek__close" aria-label="Close panel" onClick={onClose}>
          <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true" focusable="false">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="agent-peek__body">
        <AgentForm agent={agent} tools={tools} onChange={onChange} onFlush={onFlush} />

        <div className="agent-peek__danger">
          {/*
            A plain button, not <Button>: the confirm popover anchors to this
            element and Button does not forward a ref. Same classes, same look.
          */}
          <button
            ref={deleteRef}
            type="button"
            className="button button--danger button--sm"
            onClick={() => setConfirmOpen(true)}
          >
            Delete agent
          </button>
        </div>
      </div>

      <div className="agent-peek__footer">
        <SaveReadout saveState={saveState} onRetrySave={onRetrySave} />
      </div>

      <ConfirmDelete
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        anchor={deleteRef}
        itemName={agent.name}
      />
    </div>
  );
};
```

Note the import this file deliberately omits: `Button`. The delete control is a plain `<button>` carrying the same classes, because the confirm popover has to anchor to a real element and `Button` does not forward a ref.

- [ ] **Step 7: Write the peek styles**

`client/src/components/agents-section/agent-peek/agent-peek.css`:

```css
.agent-peek {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--peek-width);
  width: var(--peek-width);
  height: 100%;
  background: var(--paper);
  border-left: 1px solid var(--rule);
  box-shadow: var(--shadow-peek);
  animation: peek-in var(--dur-slow) var(--ease);
}

@keyframes peek-in {
  from {
    transform: translateX(16px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agent-peek {
    animation: none;
  }
}

.agent-peek__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-7) var(--space-5);
}

.agent-peek__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 20px;
  line-height: 1;
}

.agent-peek__icon:hover {
  background: var(--hover);
}

.agent-peek__icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-1);
  padding: var(--space-2);
}

.agent-peek__icon-option {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  font-size: 15px;
}

.agent-peek__icon-option:hover,
.agent-peek__icon-option[aria-pressed='true'] {
  background: var(--active);
}

.agent-peek__name {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font-size: var(--text-peek-title);
  font-weight: 600;
  letter-spacing: -0.01em;
  outline: none;
}

.agent-peek__name:focus-visible {
  outline: 2px solid var(--signal);
  outline-offset: 2px;
}

.agent-peek__close {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
}

.agent-peek__close:hover {
  background: var(--hover);
  color: var(--ink);
}

.agent-peek__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.agent-peek__danger {
  padding: 0 var(--space-7) var(--space-8);
}

.agent-peek__footer {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 var(--space-7) var(--space-5);
}

.agent-peek__save {
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

.agent-peek__save--error {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  color: var(--err);
}

.agent-peek__retry {
  font-family: var(--font-ui);
  font-size: var(--text-meta);
  font-weight: 500;
  color: var(--signal);
  text-decoration: underline;
}

/* Under 700px the table is gone, so the panel becomes a sheet. */
@media (max-width: 700px) {
  .agent-peek--sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 55;
    width: 100%;
    height: 92vh;
    border-left: 0;
    border-top: 1px solid var(--rule);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-sheet);
    animation: sheet-in var(--dur-slow) var(--ease);
  }

  @keyframes sheet-in {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }

  /* The drag handle is decorative; the close button does the real work. */
  .agent-peek--sheet .agent-peek__header::before {
    content: '';
    position: absolute;
    top: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--rule);
  }

  .agent-peek--sheet .agent-peek__header {
    position: relative;
    padding-top: var(--space-7);
  }
}
```

`client/src/components/agents-section/agent-peek/index.ts`:

```ts
export { AgentPeek } from './agent-peek';
```

- [ ] **Step 8: Mount the peek on the Agents page**

In `client/src/pages/Agents/index.tsx`, add the imports:

```tsx
import { AgentPeek } from '../../components/agents-section/agent-peek';
```

and read the extra values from the hook:

```tsx
  const { agents, loading, error, saveState, createAgent, duplicateAgent, deleteAgent, updateAgent, flushUpdates, retrySave } =
    useAgentsContext();
```

Wrap the returned markup so the page and the peek sit side by side. Replace the outer `<div className="agents">…</div>` with:

```tsx
  const selected = agents.find((agent) => agent.id === agentId) ?? null;

  const closePeek = () => {
    navigate('/agents');
    // Return focus to the row that opened the panel.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-agent-row="${agentId}"]`)?.focus();
    });
  };

  return (
    <div className="agents-surface">
      <div className="agents">
        {/* …the existing title, error, viewbar, empty states, and AgentTable… */}
      </div>

      {selected && (
        <AgentPeek
          agent={selected}
          tools={tools}
          saveState={saveState}
          onChange={(patch) => updateAgent(selected.id, patch)}
          onFlush={() => void flushUpdates()}
          onRetrySave={retrySave}
          onDelete={() => void onDelete(selected.id)}
          onClose={closePeek}
        />
      )}
    </div>
  );
```

Add `data-agent-row={agent.id}` to the `<tr>` in `agent-table.tsx` so that focus restore can find the row.

Append to `client/src/pages/Agents/agents.css`:

```css
.agents-surface {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS, 16 new tests and the full suite green. Then `npm run typecheck` — no errors.

- [ ] **Step 10: Look at it**

Start both servers. At `/agents`, click **Support Bot**. Confirm: the peek slides in at 480px, the table stays visible and clickable, the system prompt renders in JetBrains Mono on `--shell` with no border until focus, typing in it shows `Saving…` then `Saved 21:04:12` in mono, the tool picker filters on `http_`, removing a chip persists after a reload, Escape closes the panel and returns focus to the row, and **Delete agent** opens a confirm popover naming the agent. Narrow to 600px and confirm the peek becomes a bottom sheet with a drag handle and trapped focus.

- [ ] **Step 11: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src
git commit -m "feat: add agent peek with autosave, tool picker, and delete confirmation"
```

---

## Phase E — Chat surface

### Task 13: useChat — per-agent threads and the client-staged reveal

This is the mechanism behind §8.2. The API returns a finished message in one response; the hook reveals its tool calls one at a time, pacing each from its own `durationMs`, so the wait a person feels equals the sum of the numbers the trace displays.

**Files:**
- Create: `client/src/hooks/useChat.ts`
- Test: `client/src/hooks/useChat.test.ts`

**Interfaces:**
- Consumes: `apiPost`, `ApiError` (Task 5); `Message`, `ToolCall` types (Task 5).
- Produces:

  ```ts
  export const ANSWER_FADE_MS = 180;

  export interface UseChatResult {
    messages: Message[];
    sending: boolean;
    send: (content: string) => Promise<void>;
    retryLast: () => Promise<void>;
    clear: () => void;
  }

  export const useChat: (agentId: string | null) => UseChatResult;
  ```

- Behavior contract:
  - Threads are held per agent in a single `Record<string, Message[]>`, so switching agents and back restores that agent's thread for the session. Nothing is persisted; a reload starts empty.
  - `send` appends the user message with `status: 'done'`, appends an assistant placeholder with `status: 'thinking'`, `content: ''`, `toolCalls: []`, then posts.
  - After the response arrives, the hook walks `response.toolCalls` in order. For each call it appends the call with `status: 'running'`, waits `durationMs`, then rewrites it with its final status and result. A failed call stops the walk.
  - When the walk finishes it writes the answer content, model, latency, and `status: 'done'` (or `'error'` when a call failed).
  - `sending` is true from the moment `send` is called until the reveal completes, so the composer stays disabled for the whole run rather than only the request.
  - A request failure replaces the placeholder with `status: 'error'` and the `ApiError` message as content, leaving the user message in place so `retryLast` can resend it.
  - `retryLast` drops the failed assistant turn and the trailing user message, then re-sends that content.
  - `clear` empties only the active agent's thread.

- [ ] **Step 1: Write the failing tests**

`client/src/hooks/useChat.test.ts`:

```ts
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import type { Message } from '../types/message';

const assistant = (over: Partial<Message> = {}): Message => ({
  id: 'msg_1',
  role: 'assistant',
  content: "It's 9:03 PM in Tokyo.",
  toolCalls: [
    { id: 'call_1', toolId: 'current_time', args: { timezone: 'Asia/Tokyo' }, result: '21:03', durationMs: 100, status: 'ok' },
    { id: 'call_2', toolId: 'http_request', args: { url: 'https://x' }, result: { status: 200 }, durationMs: 200, status: 'ok' },
  ],
  model: 'gemini-2.5-flash',
  latencyMs: 480,
  status: 'done',
  createdAt: '2026-08-04T12:00:00.000Z',
  ...over,
});

const stubPost = (body: unknown, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    ),
  );

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useChat send', () => {
  it('appends the user turn and a thinking placeholder straight away', async () => {
    stubPost({ message: assistant() });
    const { result } = renderHook(() => useChat('agent_support'));

    act(() => {
      void result.current.send('what time is it in Tokyo?');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'what time is it in Tokyo?', status: 'done' });
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', status: 'thinking', content: '' });
    expect(result.current.sending).toBe(true);
  });

  it('reveals tool calls one at a time, paced by each duration', async () => {
    stubPost({ message: assistant() });
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      void result.current.send('hi');
    });

    // The first call is revealed as running before its duration elapses.
    await waitFor(() => expect(result.current.messages[1]!.toolCalls).toHaveLength(1));
    expect(result.current.messages[1]!.toolCalls![0]).toMatchObject({ toolId: 'current_time', status: 'running' });
    expect(result.current.messages[1]!.content).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await waitFor(() => expect(result.current.messages[1]!.toolCalls![0]!.status).toBe('ok'));
    await waitFor(() => expect(result.current.messages[1]!.toolCalls).toHaveLength(2));
    expect(result.current.messages[1]!.toolCalls![1]!.status).toBe('running');

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));
    expect(result.current.messages[1]!.content).toBe("It's 9:03 PM in Tokyo.");
    expect(result.current.messages[1]!.latencyMs).toBe(480);
  });

  it('stays in the sending state for the whole reveal, not just the request', async () => {
    stubPost({ message: assistant() });
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      void result.current.send('hi');
    });
    await waitFor(() => expect(result.current.messages[1]!.toolCalls).toHaveLength(1));
    expect(result.current.sending).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(result.current.sending).toBe(false));
  });

  it('answers immediately when the agent has no tools', async () => {
    stubPost({ message: assistant({ toolCalls: [], latencyMs: 180 }) });
    const { result } = renderHook(() => useChat('agent_drafter'));

    await act(async () => {
      void result.current.send('draft notes');
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));
    expect(result.current.messages[1]!.toolCalls).toEqual([]);
  });

  it('stops the walk at a failed call and reports the failure as the answer', async () => {
    stubPost({
      message: assistant({
        status: 'error',
        content: 'http_request failed: connection refused after 800ms. Nothing was written, so retrying is safe.',
        toolCalls: [
          { id: 'call_1', toolId: 'current_time', args: {}, result: '21:03', durationMs: 100, status: 'ok' },
          { id: 'call_2', toolId: 'http_request', args: {}, error: 'connection refused after 800ms', durationMs: 200, status: 'error' },
        ],
      }),
    });
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      void result.current.send('make it fail');
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('error'));
    expect(result.current.messages[1]!.toolCalls![1]!.status).toBe('error');
    expect(result.current.messages[1]!.content).toContain('connection refused');
  });

  it('refuses to send blank content', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('agent_support'));

    await act(async () => {
      await result.current.send('   ');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('does nothing without a selected agent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat(null));

    await act(async () => {
      await result.current.send('hi');
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useChat failure and retry', () => {
  it('keeps the user turn and marks the assistant turn as failed', async () => {
    stubPost({ error: { code: 'not_found', message: 'No agent with id "agent_gone".' } }, 404);
    const { result } = renderHook(() => useChat('agent_gone'));

    await act(async () => {
      await result.current.send('hi');
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('error'));
    expect(result.current.messages[0]!.role).toBe('user');
    expect(result.current.messages[1]!.content).toBe('No agent with id "agent_gone".');
    expect(result.current.sending).toBe(false);
  });

  it('resends the same content on retry', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      const body = attempt === 1 ? { error: { code: 'network_error', message: 'nope' } } : { message: assistant({ toolCalls: [] }) };
      return new Response(JSON.stringify(body), {
        status: attempt === 1 ? 500 : 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat('agent_support'));
    await act(async () => {
      await result.current.send('what time is it?');
    });
    await waitFor(() => expect(result.current.messages[1]!.status).toBe('error'));

    await act(async () => {
      await result.current.retryLast();
    });

    await waitFor(() => expect(result.current.messages[1]!.status).toBe('done'));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('what time is it?');
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]!.body))).toEqual({ content: 'what time is it?' });
  });
});

describe('useChat threads', () => {
  it('keeps a separate thread per agent and restores it on return', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderHook(({ id }: { id: string }) => useChat(id), {
      initialProps: { id: 'agent_support' },
    });

    await act(async () => {
      await result.current.send('first');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    rerender({ id: 'agent_research' });
    expect(result.current.messages).toHaveLength(0);

    rerender({ id: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.content).toBe('first');
  });

  it('clears only the active thread', async () => {
    stubPost({ message: assistant({ toolCalls: [] }) });
    const { result, rerender } = renderHook(({ id }: { id: string }) => useChat(id), {
      initialProps: { id: 'agent_support' },
    });

    await act(async () => {
      await result.current.send('keep me');
    });
    rerender({ id: 'agent_research' });
    await act(async () => {
      await result.current.send('drop me');
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.clear());
    expect(result.current.messages).toHaveLength(0);

    rerender({ id: 'agent_support' });
    expect(result.current.messages).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- useChat`
Expected: FAIL — cannot resolve `./useChat`.

- [ ] **Step 3: Write the hook**

`client/src/hooks/useChat.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiPost } from '../lib/api-client';
import type { Message, ToolCall } from '../types/message';

export const ANSWER_FADE_MS = 180;

type Threads = Record<string, Message[]>;

let messageCounter = 0;
/** Local ids only: server ids arrive with the response and replace these. */
const localId = (prefix: string) => `${prefix}_local_${(messageCounter += 1)}`;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const useChat = (agentId: string | null) => {
  const [threads, setThreads] = useState<Threads>({});
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const messages = agentId ? (threads[agentId] ?? []) : [];

  /** Rewrites the placeholder in place, leaving every other turn untouched. */
  const patchPlaceholder = useCallback(
    (id: string, placeholderId: string, patch: Partial<Message>) => {
      setThreads((current) => ({
        ...current,
        [id]: (current[id] ?? []).map((message) =>
          message.id === placeholderId ? { ...message, ...patch } : message,
        ),
      }));
    },
    [],
  );

  const run = useCallback(
    async (id: string, content: string) => {
      const placeholderId = localId('msg');
      const now = new Date().toISOString();

      setThreads((current) => ({
        ...current,
        [id]: [
          ...(current[id] ?? []),
          { id: localId('msg'), role: 'user', content, status: 'done', createdAt: now },
          { id: placeholderId, role: 'assistant', content: '', toolCalls: [], status: 'thinking', createdAt: now },
        ],
      }));

      setSending(true);

      let response: { message: Message };
      try {
        response = await apiPost<{ message: Message }>(`/api/chat/${id}/messages`, { content });
      } catch (thrown) {
        if (mounted.current) {
          patchPlaceholder(id, placeholderId, {
            status: 'error',
            content: thrown instanceof ApiError ? thrown.message : 'The run did not complete.',
          });
          setSending(false);
        }
        return;
      }

      const finished = response.message;
      const calls = finished.toolCalls ?? [];
      const revealed: ToolCall[] = [];
      let failed = false;

      // The response is complete; the pacing is ours. Each node waits out its
      // own reported duration, so the felt wait matches the numbers on screen.
      for (const call of calls) {
        if (!mounted.current) return;

        revealed.push({ ...call, status: 'running' });
        patchPlaceholder(id, placeholderId, { toolCalls: [...revealed] });

        await delay(call.durationMs);
        if (!mounted.current) return;

        revealed[revealed.length - 1] = call;
        patchPlaceholder(id, placeholderId, { toolCalls: [...revealed] });

        if (call.status === 'error') {
          failed = true;
          break;
        }
      }

      if (!mounted.current) return;

      patchPlaceholder(id, placeholderId, {
        id: finished.id,
        content: finished.content,
        model: finished.model,
        latencyMs: finished.latencyMs,
        status: failed ? 'error' : 'done',
        createdAt: finished.createdAt,
      });
      setSending(false);
    },
    [patchPlaceholder],
  );

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!agentId || trimmed.length === 0 || sending) return;
      await run(agentId, trimmed);
    },
    [agentId, sending, run],
  );

  const retryLast = useCallback(async () => {
    if (!agentId) return;
    const thread = threads[agentId] ?? [];
    const last = thread[thread.length - 1];
    const previous = thread[thread.length - 2];
    if (!last || last.role !== 'assistant' || last.status !== 'error' || previous?.role !== 'user') return;

    const content = previous.content;
    setThreads((current) => ({ ...current, [agentId]: (current[agentId] ?? []).slice(0, -2) }));
    await run(agentId, content);
  }, [agentId, threads, run]);

  const clear = useCallback(() => {
    if (!agentId) return;
    setThreads((current) => ({ ...current, [agentId]: [] }));
  }, [agentId]);

  return { messages, sending, send, retryLast, clear };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- useChat`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src/hooks
git commit -m "feat: add useChat with per-agent threads and staged tool-call reveal"
```

---

### Task 14: The trace rail and its tool-call nodes

The signature element (§5). Five rules govern it: the rail stops before the answer, nodes are collapsed by default, an in-flight node sweeps, a failed node terminates the rail in `--err`, and every node is a real disclosure button.

**Files:**
- Create: `client/src/components/chat-section/tool-call-node/tool-call-node.tsx`, `tool-call-node.css`
- Create: `client/src/components/chat-section/trace-rail/trace-rail.tsx`, `trace-rail.css`, `index.ts`
- Test: `client/src/components/chat-section/trace-rail/trace-rail.test.tsx`

**Interfaces:**
- Consumes: `formatDuration`, `formatJson` (Task 4); `toolLabel` (Task 5); `ToolCall` type (Task 5).
- Produces `TraceRail` with props `{ toolCalls: readonly ToolCall[]; tools: readonly Tool[]; running: boolean }`. **Returns `null` when `toolCalls` is empty** — an agent with no tools shows no rail at all, and the answer stands alone.
- Produces `ToolCallNode` with props `{ call: ToolCall; tools: readonly Tool[] }`. A `<button>` header with `aria-expanded` and `aria-controls`, plus a region holding the request and response code blocks. Collapsed by default; expansion is local state.
- Behavior contract:
  - The header shows a disclosure triangle, the tool label, the tool id in mono, and the duration in mono with tabular figures.
  - A `running` call shows `working…` in place of the duration and a pulsing glyph.
  - An `error` call renders its glyph, label, and duration in `--err`, and its body shows the error text instead of a result block.
  - The rail's terminal cap renders only when `running` is false, marking where machinery ends.

- [ ] **Step 1: Write the failing tests**

`client/src/components/chat-section/trace-rail/trace-rail.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TraceRail } from './trace-rail';
import type { ToolCall } from '../../../types/message';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: '', params: [] },
  { id: 'http_request', label: 'HTTP request', description: '', params: [] },
];

const call = (over: Partial<ToolCall> = {}): ToolCall => ({
  id: 'call_1',
  toolId: 'current_time',
  args: { timezone: 'Asia/Tokyo' },
  result: '2026-08-04T21:03:41+09:00',
  durationMs: 118,
  status: 'ok',
  ...over,
});

describe('TraceRail', () => {
  it('renders nothing when there are no tool calls, so the answer stands alone', () => {
    const { container } = render(<TraceRail toolCalls={[]} tools={tools} running={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one node per call, labelled and timed', () => {
    render(
      <TraceRail
        toolCalls={[call(), call({ id: 'call_2', toolId: 'http_request', durationMs: 412 })]}
        tools={tools}
        running={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Current time/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP request/ })).toBeInTheDocument();
    expect(screen.getByText('118 ms')).toBeInTheDocument();
    expect(screen.getByText('412 ms')).toBeInTheDocument();
  });

  it('collapses every node by default', () => {
    render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    expect(screen.getByRole('button', { name: /Current time/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Asia\/Tokyo/)).not.toBeInTheDocument();
  });

  it('reveals the arguments and the result when expanded', async () => {
    render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    const header = screen.getByRole('button', { name: /Current time/ });

    await userEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"timezone": "Asia\/Tokyo"/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-04T21:03:41\+09:00/)).toBeInTheDocument();
  });

  it('is keyboard operable', async () => {
    render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /Current time/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reads a running call as working rather than showing a duration', () => {
    render(<TraceRail toolCalls={[call({ status: 'running' })]} tools={tools} running />);
    expect(screen.getByText('working…')).toBeInTheDocument();
    expect(screen.queryByText('118 ms')).not.toBeInTheDocument();
  });

  it('shows the error text instead of a result for a failed call', async () => {
    render(
      <TraceRail
        toolCalls={[call({ status: 'error', result: undefined, error: 'connection refused after 800ms' })]}
        tools={tools}
        running={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Current time/ }));
    expect(screen.getByText('connection refused after 800ms')).toBeInTheDocument();
  });

  it('marks a failed node for assistive tech, not by colour alone', () => {
    render(<TraceRail toolCalls={[call({ status: 'error', error: 'boom' })]} tools={tools} running={false} />);
    expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument();
  });

  it('caps the rail only once the run has finished', () => {
    const { container: whileRunning } = render(<TraceRail toolCalls={[call()]} tools={tools} running />);
    expect(whileRunning.querySelector('.trace-rail__cap')).toBeNull();

    const { container: finished } = render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    expect(finished.querySelector('.trace-rail__cap')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- trace-rail`
Expected: FAIL — cannot resolve `./trace-rail`.

- [ ] **Step 3: Write ToolCallNode**

`client/src/components/chat-section/tool-call-node/tool-call-node.tsx`:

```tsx
import { useId, useState } from 'react';
import { formatDuration, formatJson } from '../../../lib/format';
import { toolLabel } from '../../../hooks/useTools';
import type { ToolCall } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './tool-call-node.css';

interface ToolCallNodeProps {
  call: ToolCall;
  tools: readonly Tool[];
}

export const ToolCallNode = ({ call, tools }: ToolCallNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const label = toolLabel(tools, call.toolId);

  // The accessible name carries the state, so colour is never the only signal.
  const accessibleName =
    call.status === 'error'
      ? `${label} failed`
      : call.status === 'running'
        ? `${label}, working`
        : `${label}, ${formatDuration(call.durationMs)}`;

  return (
    <div className={`tool-call tool-call--${call.status}`}>
      <button
        type="button"
        className="tool-call__header"
        aria-expanded={expanded}
        aria-controls={bodyId}
        aria-label={accessibleName}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={['tool-call__triangle', expanded ? 'tool-call__triangle--open' : ''].join(' ')} aria-hidden="true">
          ▸
        </span>
        <span className="tool-call__glyph" aria-hidden="true" />
        <span className="tool-call__label mono">{label}</span>
        <span className="tool-call__id mono">{call.toolId}</span>
        <span className="tool-call__duration mono">
          {call.status === 'running' ? 'working…' : formatDuration(call.durationMs)}
        </span>
      </button>

      <div id={bodyId} className="tool-call__body" hidden={!expanded}>
        <p className="tool-call__caption mono">Arguments</p>
        <pre className="tool-call__code mono">{formatJson(call.args)}</pre>

        {call.status === 'error' ? (
          <>
            <p className="tool-call__caption mono">Error</p>
            <pre className="tool-call__code tool-call__code--error mono">{call.error}</pre>
          </>
        ) : (
          call.status === 'ok' && (
            <>
              <p className="tool-call__caption mono">Result</p>
              <pre className="tool-call__code mono">{formatJson(call.result)}</pre>
            </>
          )
        )}
      </div>
    </div>
  );
};
```

`client/src/components/chat-section/tool-call-node/tool-call-node.css`:

```css
.tool-call {
  position: relative;
}

.tool-call__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 26px;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  text-align: left;
}

.tool-call__header:hover {
  background: var(--hover);
}

.tool-call__triangle {
  flex: 0 0 10px;
  color: var(--ink-faint);
  font-size: 9px;
  transition: transform var(--dur-fast) var(--ease);
}

.tool-call__triangle--open {
  transform: rotate(90deg);
}

/* The node marker on the rail. Square, not round: this is machinery. */
.tool-call__glyph {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--trace);
}

.tool-call--running .tool-call__glyph {
  animation: node-pulse 1000ms var(--ease) infinite;
}

@keyframes node-pulse {
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-call--running .tool-call__glyph {
    animation: none;
    opacity: 0.6;
  }
}

.tool-call--error .tool-call__glyph {
  background: var(--err);
}

.tool-call__label {
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--trace-ink);
}

.tool-call--error .tool-call__label {
  color: var(--err);
}

.tool-call__id {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-meta);
  color: var(--ink-faint);
}

.tool-call__duration {
  flex: 0 0 auto;
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

.tool-call--error .tool-call__duration {
  color: var(--err);
}

.tool-call__body {
  padding: var(--space-2) var(--space-3) var(--space-4) 22px;
  animation: node-open var(--dur-mid) var(--ease);
}

@keyframes node-open {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tool-call__body {
    animation: none;
  }
}

.tool-call__caption {
  margin-bottom: var(--space-2);
  font-size: var(--text-meta);
  color: var(--ink-faint);
}

.tool-call__caption:not(:first-child) {
  margin-top: var(--space-4);
}

/* Long payloads scroll inside the block; the page never scrolls sideways. */
.tool-call__code {
  margin: 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--shell);
  color: var(--ink);
  font-size: var(--text-meta);
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
  max-height: 260px;
  overflow-y: auto;
}

.tool-call__code--error {
  background: var(--err-wash);
  color: var(--ink);
}
```

- [ ] **Step 4: Write TraceRail**

`client/src/components/chat-section/trace-rail/trace-rail.tsx`:

```tsx
import { ToolCallNode } from '../tool-call-node/tool-call-node';
import type { ToolCall } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './trace-rail.css';

interface TraceRailProps {
  toolCalls: readonly ToolCall[];
  tools: readonly Tool[];
  running: boolean;
}

export const TraceRail = ({ toolCalls, tools, running }: TraceRailProps) => {
  // No tools, no rail. The answer stands on its own.
  if (toolCalls.length === 0) return null;

  const failed = toolCalls.some((call) => call.status === 'error');

  return (
    <div className={['trace-rail', running ? 'trace-rail--running' : ''].filter(Boolean).join(' ')}>
      <span className={['trace-rail__line', failed ? 'trace-rail__line--failed' : ''].join(' ')} aria-hidden="true" />
      <div className="trace-rail__nodes">
        {toolCalls.map((call) => (
          <ToolCallNode key={call.id} call={call} tools={tools} />
        ))}
      </div>
      {/* The cap marks where machinery ends and the answer begins. */}
      {!running && (
        <span
          className={['trace-rail__cap', failed ? 'trace-rail__cap--failed' : ''].join(' ')}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
```

`client/src/components/chat-section/trace-rail/trace-rail.css`:

```css
.trace-rail {
  position: relative;
  padding-left: var(--space-5);
}

.trace-rail__line {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 0;
  width: 2px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--trace) 24%, transparent);
}

.trace-rail__line--failed {
  background: color-mix(in srgb, var(--err) 28%, transparent);
}

/*
  The sweep runs only while a step is in flight. It is decoration on top of a
  state that is already announced in text, so reduced motion can drop it.
*/
.trace-rail--running .trace-rail__line {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--trace) 12%, transparent),
    var(--trace),
    color-mix(in srgb, var(--trace) 12%, transparent)
  );
  background-size: 100% 60%;
  background-repeat: no-repeat;
  animation: rail-sweep 1600ms var(--ease) infinite;
}

@keyframes rail-sweep {
  from {
    background-position: 0 -60%;
  }
  to {
    background-position: 0 160%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trace-rail--running .trace-rail__line {
    animation: none;
    background: color-mix(in srgb, var(--trace) 45%, transparent);
  }
}

.trace-rail__nodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.trace-rail__cap {
  position: absolute;
  bottom: 0;
  left: -2px;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--trace);
}

.trace-rail__cap--failed {
  background: var(--err);
}
```

`client/src/components/chat-section/trace-rail/index.ts`:

```ts
export { TraceRail } from './trace-rail';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- trace-rail`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src/components/chat-section
git commit -m "feat: add trace rail and expandable tool-call nodes"
```

---

### Task 15: Message turns, composer, agent switcher, and the Chat page

**Files:**
- Create: `client/src/components/chat-section/message-turn/message-turn.tsx`, `message-turn.css`
- Create: `client/src/components/chat-section/message-list/message-list.tsx`, `message-list.css`, `index.ts`
- Create: `client/src/components/chat-section/composer/composer.tsx`, `composer.css`, `index.ts`
- Create: `client/src/components/chat-section/agent-switcher/agent-switcher.tsx`, `agent-switcher.css`
- Modify: `client/src/pages/Chat/index.tsx`, `chat.css`
- Modify: `client/src/pages/index.tsx` — pass `agents` and `tools` to `ChatPage`
- Test: `client/src/components/chat-section/composer/composer.test.tsx`, `client/src/components/chat-section/message-list/message-list.test.tsx`

**Interfaces:**
- Consumes: `TraceRail` (Task 14); `AutoTextarea` (Task 7); `Chip`, `Button` (Task 6); `Popover` (Task 7); `EmptyState` (Task 7); `suggestedPrompts` (Task 5); `useChat` (Task 13); `useAgents`, `useTools`; `formatDuration` (Task 4).
- Produces:
  - `MessageTurn` — props `{ message: Message; agent: Agent; tools: readonly Tool[]; onRetry: () => void }`. A user turn renders a `--shell` callout block; an assistant turn renders the avatar, the rail, and bare prose. A `thinking` turn shows a mono `working…` line where the answer will land. An `error` turn shows the failure text and a Retry button.
  - `MessageList` — props `{ messages: readonly Message[]; agent: Agent | null; agents: readonly Agent[]; tools: readonly Tool[]; onRetry: () => void; onPickPrompt: (prompt: string) => void }`. Scrolls, auto-scrolls to the newest turn, holds the `aria-live` region, and renders the two empty states.
  - `Composer` — props `{ agentName: string; disabled: boolean; onSend: (content: string) => void }`. Enter sends, Shift+Enter newlines, empty cannot send.
  - `AgentSwitcher` — props `{ agents: readonly Agent[]; selected: Agent | null; onSelect: (id: string) => void }`.
- Behavior contract:
  - `ChatPage` resolves the agent from `:agentId`, falling back to `localStorage.getItem('agentPlatform.lastAgentId')` then the first agent, and writes that key whenever the selection changes.
  - The live region announces `${agent.name} responded` on completion and the failure text on error.

- [ ] **Step 1: Write the failing composer tests**

`client/src/components/chat-section/composer/composer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from './composer';

const setup = (over: Partial<Parameters<typeof Composer>[0]> = {}) => {
  const onSend = vi.fn();
  render(<Composer agentName="Support Bot" disabled={false} onSend={onSend} {...over} />);
  return { onSend, field: screen.getByRole('textbox', { name: /Message Support Bot/ }) };
};

describe('Composer', () => {
  it('names the agent it will message', () => {
    setup();
    expect(screen.getByPlaceholderText('Message Support Bot…')).toBeInTheDocument();
  });

  it('sends on Enter and clears the field', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, 'what time is it?{Enter}');
    expect(onSend).toHaveBeenCalledWith('what time is it?');
    expect(field).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter without sending', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    expect(field).toHaveValue('line one\nline two');
  });

  it('refuses to send whitespace', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables the send button until there is something to send', async () => {
    const { field } = setup();
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();
    await userEvent.type(field, 'hi');
    expect(send).toBeEnabled();
  });

  it('sends on a click of the send button', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('blocks input entirely while a run is in flight', async () => {
    const { onSend, field } = setup({ disabled: true });
    expect(field).toBeDisabled();
    await userEvent.type(field, 'hi{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('states the keyboard contract', () => {
    setup();
    expect(screen.getByText('Enter to send · Shift+Enter for newline')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing message-list tests**

`client/src/components/chat-section/message-list/message-list.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList } from './message-list';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [{ id: 'current_time', label: 'Current time', description: '', params: [] }];

const agent: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: '🎧',
  description: 'Answers billing questions.',
  model: 'gemini-2.5-flash',
  systemPrompt: '',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

const defaults = {
  agent,
  agents: [agent],
  tools,
  onRetry: () => {},
  onPickPrompt: () => {},
};

describe('MessageList empty states', () => {
  it('introduces the agent and offers tool-derived prompts', () => {
    render(<MessageList {...defaults} messages={[]} />);
    expect(screen.getByText('Support Bot')).toBeInTheDocument();
    expect(screen.getByText('Answers billing questions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What time is it in Tokyo right now?' })).toBeInTheDocument();
  });

  it('fills the composer from a suggested prompt', async () => {
    const onPickPrompt = vi.fn();
    render(<MessageList {...defaults} messages={[]} onPickPrompt={onPickPrompt} />);
    await userEvent.click(screen.getByRole('button', { name: 'What time is it in Tokyo right now?' }));
    expect(onPickPrompt).toHaveBeenCalledWith('What time is it in Tokyo right now?');
  });

  it('points at Agents when there is nothing to test', () => {
    render(<MessageList {...defaults} agent={null} agents={[]} messages={[]} />);
    expect(screen.getByText('No agents to test.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Agents' })).toBeInTheDocument();
  });
});

describe('MessageList turns', () => {
  const user: Message = {
    id: 'msg_u',
    role: 'user',
    content: 'what time is it in Tokyo?',
    status: 'done',
    createdAt: '2026-08-04T12:00:00.000Z',
  };

  it('renders both roles in document flow', () => {
    const assistant: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: "It's 9:03 PM in Tokyo.",
      toolCalls: [
        { id: 'call_1', toolId: 'current_time', args: {}, result: '21:03', durationMs: 118, status: 'ok' },
      ],
      model: 'gemini-2.5-flash',
      latencyMs: 298,
      status: 'done',
      createdAt: '2026-08-04T12:00:01.000Z',
    };

    render(<MessageList {...defaults} messages={[user, assistant]} />);
    expect(screen.getByText('what time is it in Tokyo?')).toBeInTheDocument();
    expect(screen.getByText("It's 9:03 PM in Tokyo.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Current time/ })).toBeInTheDocument();
  });

  it('shows a working line while thinking, and no answer yet', () => {
    const thinking: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: '',
      toolCalls: [],
      status: 'thinking',
      createdAt: '2026-08-04T12:00:01.000Z',
    };
    render(<MessageList {...defaults} messages={[user, thinking]} />);
    expect(screen.getByText('working…')).toBeInTheDocument();
  });

  it('offers a retry on a failed turn and states what happened', async () => {
    const onRetry = vi.fn();
    const failed: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: 'http_request failed: connection refused after 800ms.',
      toolCalls: [
        { id: 'call_1', toolId: 'current_time', args: {}, error: 'connection refused', durationMs: 812, status: 'error' },
      ],
      status: 'error',
      createdAt: '2026-08-04T12:00:01.000Z',
    };

    render(<MessageList {...defaults} messages={[user, failed]} onRetry={onRetry} />);
    expect(screen.getByText(/connection refused after 800ms/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('announces the outcome in a polite live region', () => {
    const done: Message = {
      id: 'msg_a',
      role: 'assistant',
      content: 'Done.',
      toolCalls: [],
      status: 'done',
      createdAt: '2026-08-04T12:00:01.000Z',
    };
    render(<MessageList {...defaults} messages={[user, done]} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Support Bot responded');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `AgentPlatform-FrontEnd/client`: `npm test -- composer message-list`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write Composer**

`client/src/components/chat-section/composer/composer.tsx`:

```tsx
import { useState } from 'react';
import { AutoTextarea } from '../../ui/textarea';
import './composer.css';

interface ComposerProps {
  agentName: string;
  disabled: boolean;
  onSend: (content: string) => void;
}

export const Composer = ({ agentName, disabled, onSend }: ComposerProps) => {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <div className="composer">
      <div className="composer__field">
        <AutoTextarea
          label={`Message ${agentName}`}
          hideLabel
          value={draft}
          disabled={disabled}
          placeholder={`Message ${agentName}…`}
          maxHeight={200}
          onChange={setDraft}
          onKeyDown={(event) => {
            // Shift+Enter is a newline; Enter alone sends.
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            submit();
          }}
        />
        <button
          type="button"
          className="composer__send"
          aria-label="Send message"
          disabled={!canSend}
          onClick={submit}
        >
          {disabled ? (
            <span className="composer__spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <p className="composer__hint mono">Enter to send · Shift+Enter for newline</p>
    </div>
  );
};
```

`client/src/components/chat-section/composer/composer.css`:

```css
.composer {
  flex: 0 0 auto;
  padding: var(--space-4) 0 var(--space-6);
  background: var(--paper);
}

.composer__field {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-2) var(--space-2) 0;
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--paper);
  transition: border-color var(--dur-fast) var(--ease);
}

.composer__field:focus-within {
  border-color: var(--signal);
}

/* The wrapper owns the border, so the inner control must stay flat. */
.composer__field .textarea {
  flex: 1;
  min-width: 0;
}

.composer__field .textarea__control {
  background: transparent;
  border-color: transparent;
  padding: var(--space-4) var(--space-5);
}

.composer__field .textarea__control:focus {
  background: transparent;
  border-color: transparent;
  outline: none;
}

.composer__send {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  margin-bottom: var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--signal);
  color: var(--paper);
  transition: background var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease);
}

.composer__send:hover:not(:disabled) {
  background: var(--signal-hover);
}

.composer__send:disabled {
  background: var(--rule);
  color: var(--ink-faint);
  cursor: default;
}

.composer__spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--radius-pill);
  animation: composer-spin 700ms linear infinite;
}

@keyframes composer-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .composer__spinner {
    animation-duration: 2000ms;
  }
}

.composer__hint {
  margin-top: var(--space-3);
  font-size: var(--text-meta);
  color: var(--ink-faint);
}
```

`client/src/components/chat-section/composer/index.ts`:

```ts
export { Composer } from './composer';
```

- [ ] **Step 5: Write MessageTurn**

`client/src/components/chat-section/message-turn/message-turn.tsx`:

```tsx
import { TraceRail } from '../trace-rail';
import { formatDuration } from '../../../lib/format';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './message-turn.css';

interface MessageTurnProps {
  message: Message;
  agent: Agent;
  tools: readonly Tool[];
  onRetry: () => void;
}

export const MessageTurn = ({ message, agent, tools, onRetry }: MessageTurnProps) => {
  if (message.role === 'user') {
    return (
      <article className="turn turn--user">
        <span className="turn__avatar turn__avatar--user" aria-hidden="true">
          ▢
        </span>
        <div className="turn__body">
          <p className="turn__callout">{message.content}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="turn turn--assistant">
      <span className="turn__avatar" aria-hidden="true">
        {agent.icon}
      </span>
      <div className="turn__body">
        <TraceRail
          toolCalls={message.toolCalls ?? []}
          tools={tools}
          running={message.status === 'thinking'}
        />

        {message.status === 'thinking' ? (
          <p className="turn__working mono">working…</p>
        ) : (
          <div className={['turn__answer', message.status === 'error' ? 'turn__answer--error' : ''].join(' ')}>
            <p>{message.content}</p>
            {message.status === 'error' && (
              <button type="button" className="turn__retry" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}

        {message.status === 'done' && message.latencyMs !== undefined && (
          <p className="turn__meta mono">
            {message.model} · {formatDuration(message.latencyMs)}
          </p>
        )}
      </div>
    </article>
  );
};
```

`client/src/components/chat-section/message-turn/message-turn.css`:

```css
.turn {
  display: flex;
  gap: var(--space-5);
  padding: var(--space-6) 0;
}

.turn__avatar {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  font-size: 15px;
  line-height: 1;
}

.turn__avatar--user {
  background: var(--shell);
  color: var(--ink-muted);
  font-size: var(--text-label);
}

.turn__body {
  flex: 1;
  min-width: 0;
}

/* Notion's callout block: the alternation cue, without a chat bubble. */
.turn__callout {
  padding: var(--space-5);
  border-radius: var(--radius-sm);
  background: var(--shell);
  font-size: var(--text-body);
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.turn__working {
  margin-top: var(--space-4);
  font-size: var(--text-label);
  color: var(--ink-muted);
}

/* Bare prose on paper. No rail, no indent, no background: the answer. */
.turn__answer {
  margin-top: var(--space-5);
  font-size: var(--text-body);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.turn__answer--error {
  color: var(--ink);
}

.turn__retry {
  margin-top: var(--space-4);
  font-size: var(--text-ui);
  font-weight: 500;
  color: var(--signal);
  text-decoration: underline;
}

.turn__meta {
  margin-top: var(--space-4);
  font-size: var(--text-meta);
  color: var(--ink-faint);
}
```

- [ ] **Step 6: Write MessageList**

`client/src/components/chat-section/message-list/message-list.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { MessageTurn } from '../message-turn/message-turn';
import { Chip } from '../../ui/chip';
import { EmptyState } from '../../ui/empty-state';
import { suggestedPrompts } from '../../../data/suggested-prompts';
import { toolLabel } from '../../../hooks/useTools';
import type { Agent } from '../../../types/agent';
import type { Message } from '../../../types/message';
import type { Tool } from '../../../types/tool';
import './message-list.css';

interface MessageListProps {
  messages: readonly Message[];
  agent: Agent | null;
  agents: readonly Agent[];
  tools: readonly Tool[];
  onRetry: () => void;
  onPickPrompt: (prompt: string) => void;
  onGoToAgents?: () => void;
}

const announcementFor = (messages: readonly Message[], agent: Agent | null): string => {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || !agent) return '';
  if (last.status === 'done') return `${agent.name} responded`;
  if (last.status === 'error') return last.content;
  return '';
};

export const MessageList = ({
  messages,
  agent,
  agents,
  tools,
  onRetry,
  onPickPrompt,
  onGoToAgents,
}: MessageListProps) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div className="message-list">
      <div className="message-list__live sr-only" role="status" aria-live="polite">
        {announcementFor(messages, agent)}
      </div>

      {messages.length === 0 && agents.length === 0 && (
        <EmptyState
          icon="▤"
          title="No agents to test."
          body="Create an agent to start a test run."
          action={onGoToAgents ? { label: 'Go to Agents', onClick: onGoToAgents } : undefined}
        />
      )}

      {messages.length === 0 && agent && (
        <div className="message-list__intro">
          <span className="message-list__intro-icon" aria-hidden="true">
            {agent.icon}
          </span>
          <p className="message-list__intro-name">{agent.name}</p>
          {agent.description && <p className="message-list__intro-body">{agent.description}</p>}

          {agent.toolIds.length > 0 && (
            <div className="message-list__intro-tools">
              {agent.toolIds.map((toolId) => (
                <Chip key={toolId} tone="trace">
                  {toolLabel(tools, toolId)}
                </Chip>
              ))}
            </div>
          )}

          <ul className="message-list__prompts">
            {suggestedPrompts(agent.toolIds).map((prompt) => (
              <li key={prompt}>
                <button type="button" className="message-list__prompt" onClick={() => onPickPrompt(prompt)}>
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {agent &&
        messages.map((message) => (
          <MessageTurn key={message.id} message={message} agent={agent} tools={tools} onRetry={onRetry} />
        ))}

      <div ref={endRef} />
    </div>
  );
};
```

`client/src/components/chat-section/message-list/message-list.css`:

```css
.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-6) 0 var(--space-8);
}

.message-list__intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-9) 0 var(--space-7);
}

.message-list__intro-icon {
  font-size: 32px;
  line-height: 1;
}

.message-list__intro-name {
  font-size: var(--text-peek-title);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.message-list__intro-body {
  max-width: 48ch;
  font-size: var(--text-body);
  color: var(--ink-muted);
}

.message-list__intro-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.message-list__prompts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.message-list__prompt {
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  font-size: var(--text-ui);
  color: var(--ink);
  text-align: left;
  transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.message-list__prompt:hover {
  background: var(--hover);
  border-color: var(--ink-faint);
}
```

`client/src/components/chat-section/message-list/index.ts`:

```ts
export { MessageList } from './message-list';
```

- [ ] **Step 7: Write AgentSwitcher**

`client/src/components/chat-section/agent-switcher/agent-switcher.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import { Popover } from '../../ui/popover';
import type { Agent } from '../../../types/agent';
import './agent-switcher.css';

interface AgentSwitcherProps {
  agents: readonly Agent[];
  selected: Agent | null;
  onSelect: (id: string) => void;
}

export const AgentSwitcher = ({ agents, selected, onSelect }: AgentSwitcherProps) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(needle));
  }, [agents, query]);

  return (
    <>
      <button ref={anchor} type="button" className="agent-switcher" onClick={() => setOpen(true)}>
        <span className="agent-switcher__icon" aria-hidden="true">
          {selected?.icon ?? '▤'}
        </span>
        <span className="agent-switcher__name">{selected?.name ?? 'Pick an agent'}</span>
        <span className="agent-switcher__chevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Choose an agent" width={280}>
        <input
          type="search"
          className="agent-switcher__search"
          aria-label="Search agents"
          placeholder="Search agents…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="agent-switcher__list">
          {matches.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                className="popover__item"
                aria-pressed={agent.id === selected?.id}
                onClick={() => {
                  onSelect(agent.id);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span aria-hidden="true">{agent.icon}</span>
                <span className="agent-switcher__item-name">{agent.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {matches.length === 0 && <p className="popover__note">No agents match that search.</p>}
      </Popover>
    </>
  );
};
```

`client/src/components/chat-section/agent-switcher/agent-switcher.css`:

```css
.agent-switcher {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: 28px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-ui);
  font-weight: 500;
  max-width: 280px;
}

.agent-switcher:hover {
  background: var(--hover);
}

.agent-switcher__icon {
  flex: 0 0 auto;
  font-size: var(--text-ui);
  line-height: 1;
}

.agent-switcher__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-switcher__chevron {
  flex: 0 0 auto;
  color: var(--ink-faint);
  font-size: var(--text-label);
}

.agent-switcher__search {
  width: calc(100% - var(--space-4));
  height: 28px;
  margin: var(--space-2);
  padding: 0 var(--space-4);
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  font-size: var(--text-ui);
}

.agent-switcher__search::-webkit-search-cancel-button {
  appearance: none;
}

.agent-switcher__list {
  max-height: 280px;
  overflow-y: auto;
}

.agent-switcher__item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 8: Write the Chat page**

`client/src/pages/Chat/index.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentSwitcher } from '../../components/chat-section/agent-switcher/agent-switcher';
import { Composer } from '../../components/chat-section/composer';
import { MessageList } from '../../components/chat-section/message-list';
import { ConfirmDelete } from '../../components/ui/confirm-delete';
import { useAgentsContext } from '../../hooks/useAgents';
import { useChat } from '../../hooks/useChat';
import { useTools } from '../../hooks/useTools';
import './chat.css';

const LAST_AGENT_KEY = 'agentPlatform.lastAgentId';

const ChatPage = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { agents } = useAgentsContext();
  const { tools } = useTools();
  const clearRef = useRef<HTMLButtonElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Route first, then the last agent this browser used, then whatever exists.
  const remembered = localStorage.getItem(LAST_AGENT_KEY);
  const selected =
    agents.find((agent) => agent.id === agentId) ??
    agents.find((agent) => agent.id === remembered) ??
    agents[0] ??
    null;

  const { messages, sending, send, retryLast, clear } = useChat(selected?.id ?? null);

  useEffect(() => {
    if (selected) localStorage.setItem(LAST_AGENT_KEY, selected.id);
  }, [selected]);

  return (
    <div className="chat">
      <div className="chat__header">
        <AgentSwitcher agents={agents} selected={selected} onSelect={(id) => navigate(`/chat/${id}`)} />
        <div className="chat__header-right">
          {selected && <span className="chat__model mono">{selected.model}</span>}
          {messages.length > 0 && (
            <>
              <button ref={clearRef} type="button" className="chat__clear" onClick={() => setConfirmClear(true)}>
                Clear
              </button>
              <ConfirmDelete
                open={confirmClear}
                onClose={() => setConfirmClear(false)}
                onConfirm={clear}
                anchor={clearRef}
                itemName="this conversation"
              />
            </>
          )}
        </div>
      </div>

      <div className="chat__column">
        <MessageList
          messages={messages}
          agent={selected}
          agents={agents}
          tools={tools}
          onRetry={() => void retryLast()}
          onPickPrompt={(prompt) => void send(prompt)}
          onGoToAgents={() => navigate('/agents')}
        />
        {selected && (
          <Composer agentName={selected.name} disabled={sending} onSend={(content) => void send(content)} />
        )}
      </div>
    </div>
  );
};

export default ChatPage;
```

`client/src/pages/Chat/chat.css` — replace the placeholder file:

```css
.chat {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chat__header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex: 0 0 var(--topbar-height);
  height: var(--topbar-height);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--rule);
}

.chat__header-right {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin-left: auto;
}

.chat__model {
  font-size: var(--text-meta);
  color: var(--ink-muted);
}

.chat__clear {
  font-size: var(--text-label);
  font-weight: 500;
  color: var(--ink-muted);
}

.chat__clear:hover {
  color: var(--ink);
  text-decoration: underline;
}

/* Notion's page width. The trace and the prose share one measure. */
.chat__column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 0 var(--space-6);
}

@media (max-width: 700px) {
  .chat__header {
    padding: 0 var(--space-5);
  }

  .chat__column {
    padding: 0 var(--space-5);
  }
}
```

`ChatPage` takes no props, so no change is needed in `pages/index.tsx`. Confirm its `<Route>` entries still render `<ChatPage />` with no arguments.

- [ ] **Step 9: Run the tests to verify they pass**

Run from `AgentPlatform-FrontEnd/client`: `npm test`
Expected: PASS — 16 new tests and the whole suite green. Then `npm run typecheck` and `npm run lint` — both clean.

- [ ] **Step 10: Watch a real run**

Start both servers and open `http://localhost:5173/chat`. With **Support Bot** selected, confirm the empty state lists its two tools as purple chips and offers "What time is it in Tokyo right now?". Send it, and watch: the user turn appears in a `--shell` callout, the assistant turn draws the rail, `current_time` appears as running with a sweep, resolves at ~118ms showing its duration, then `http_request` appears and resolves at ~412ms, then the answer replaces `working…` as bare prose with the rail capped above it. Expand a node and confirm the JSON reads in mono on `--shell`. Send a message containing the word `fail` and confirm the rail terminates red and a Retry button appears that works. Switch to **Release Notes Drafter** and confirm no rail renders at all. Switch back to Support Bot and confirm the earlier thread is still there.

- [ ] **Step 11: Commit**

```bash
git add AgentPlatform-FrontEnd/client/src
git commit -m "feat: add chat surface with message turns, composer, and agent switcher"
```

---

## Phase F — Verification and delivery

### Task 16: Responsive and accessibility verification pass

Nothing new gets built here. This task proves the quality floor (§9) holds and fixes whatever it exposes. Every defect found is fixed in this task, not deferred.

**Files:**
- Modify: `client/src/App.tsx`, `client/src/App.css`, `client/src/components/layout/Workspace.tsx` (the skip link), plus whichever files the checks below expose as defective.

**Interfaces:**
- Consumes: everything built so far.
- Produces: no new exports. The deliverable is a green checklist and any fixes it forced.

- [ ] **Step 1: Add a skip link, since the sidebar precedes the content**

A keyboard user should not tab through the whole sidebar to reach the table. In `client/src/App.tsx`, add as the first child inside `<div className="app">`:

```tsx
      <a className="app__skip" href="#workspace-content">
        Skip to content
      </a>
```

In `client/src/components/layout/Workspace.tsx`, give the main element the matching id and make it focusable as a target:

```tsx
export const Workspace = ({ children }: { children: ReactNode }) => (
  <main className="workspace" id="workspace-content" tabIndex={-1}>
    {children}
  </main>
);
```

Append to `client/src/App.css`:

```css
/* Off-screen until focused, then it becomes the first thing you see. */
.app__skip {
  position: fixed;
  top: var(--space-4);
  left: var(--space-4);
  z-index: 70;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: var(--paper);
  font-size: var(--text-ui);
  font-weight: 500;
  transform: translateY(-200%);
  transition: transform var(--dur-fast) var(--ease);
}

.app__skip:focus-visible {
  transform: translateY(0);
  text-decoration: none;
}
```

- [ ] **Step 2: Verify keyboard operation end to end, with no mouse**

Start both servers, open `http://localhost:5173/agents`, put the mouse away, and walk the whole app with Tab, Shift+Tab, Enter, Space, Escape, and the arrow keys. Confirm every one of these:

- The first Tab reveals **Skip to content**, and Enter on it moves focus into the table area.
- Every focused element shows a visible 2px blue ring. Nothing receives focus invisibly.
- Tab reaches the sidebar disclosure triangle, and Enter expands it to list the agents.
- Tab reaches a table row, Enter opens the peek, and Escape closes it and returns focus to that same row.
- Inside the peek, Tab reaches the icon button, the name, both selects, the tool button, the prompt, the description, and Delete agent, in that visual order.
- Enter on the tool button opens the picker; Space toggles a checkbox; Escape closes it and focus returns to the button.
- On the chat surface, Tab reaches a collapsed tool node and Enter expands it.
- In the composer, Enter sends and Shift+Enter inserts a newline.
- Escape closes every popover: workspace, row actions, tool picker, icon grid, agent switcher, both confirmations.

Fix anything that fails before continuing.

- [ ] **Step 3: Verify every breakpoint, and that nothing scrolls sideways**

Using devtools device emulation, check 1440, 1080, 900, 768, 700, 480, and 380px wide. At each width confirm:

- `document.documentElement.scrollWidth <= window.innerWidth`. Run this in the console at each width; any horizontal page scroll is a defect:

  ```js
  document.documentElement.scrollWidth - window.innerWidth
  ```

  Expected: `0` at every width, on both surfaces, with a tool node expanded and with the peek open.
- At 1080 and below, the table's Description column is gone.
- At 900 and below, the sidebar is a drawer behind the hamburger, the scrim closes it, and Escape closes it.
- At 700 and below, the peek is a bottom sheet with a drag handle, focus is trapped inside it, and the Status column is gone.
- At 380, the composer, the trace nodes, and the agents view bar all remain usable, and long JSON scrolls inside its own block rather than widening the page.

- [ ] **Step 4: Verify reduced motion actually stops motion**

In devtools, set **Emulate CSS prefers-reduced-motion: reduce**. Reload and confirm:

- The rail does not sweep; it holds a static 45% purple.
- The peek appears without sliding, and the drawer without sliding.
- The skeleton shimmer is static.
- The running node glyph holds at 60% opacity rather than pulsing.
- The composer spinner still turns, slowly — it communicates that work is in progress, which is information, not decoration.

- [ ] **Step 5: Verify colour is never the only signal**

In devtools, apply the **Achromatopsia** vision deficiency emulation. Confirm each of these remains distinguishable without hue:

- Active versus Draft in the table — the text labels carry it.
- A failed tool node versus a successful one — the accessible name says "failed" and the body shows an Error caption.
- The sidebar health pill — the text reads `connected · mock` or `api offline`.
- The selected table row — the `--active` background differs in lightness from `--hover`.

- [ ] **Step 6: Verify text contrast**

Run a Lighthouse accessibility audit on `/agents` and `/chat` in an incognito window. Expected: no contrast failures and a score of 100. Pay particular attention to these pairs, which are the tightest in the palette:

- `--ink-muted` `#787774` on `--paper` — 4.6:1, passes.
- `--ink-faint` `#9B9A97` on `--paper` — 2.8:1. **This fails for body text.** It is used only for placeholders, the `+N` overflow count, and disabled text, which are exempt or non-essential. Confirm by inspection that `--ink-faint` never carries information a user needs; if it does anywhere, change that instance to `--ink-muted`.
- `--trace-ink` `#6940A5` on `--trace-wash` `#E8DEEE` — 5.9:1, passes.
- `--paper` on `--signal` `#2383E2` — 3.5:1, which passes for large text and UI components but not body text. Confirm `--signal` backgrounds only ever carry button labels at 14px/500 or larger, which qualify as UI components.

- [ ] **Step 7: Verify the error paths are reachable and readable**

- Stop the backend with the app open. Confirm the sidebar pill turns red and reads `api offline` within 15 seconds, and that the Agents page shows its error banner with a Reload action rather than an empty table.
- Restart the backend, edit a system prompt, then stop the backend before the 600ms autosave fires. Confirm the peek footer reads `Couldn't save.` with the network message and a working Retry, and that the field's text rolled back to the last saved value.
- Restart the backend and click Retry. Confirm it saves and the footer switches to `Saved hh:mm:ss`.
- Send a chat message containing `fail`. Confirm the rail terminates in red, the answer states the specific failure, and Retry re-sends successfully.

- [ ] **Step 8: Run every check the repo has**

Run from `AgentPlatform-FrontEnd/client`:

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Run from `AgentPlatform-BackEnd/server`:

```bash
npm test && npm run lint
```

Expected: all green, and `npm run build` produces `dist/` with no warnings about unresolved imports.

- [ ] **Step 9: Commit whatever the pass fixed**

```bash
git add AgentPlatform-FrontEnd AgentPlatform-BackEnd
git commit -m "fix: add skip link and resolve responsive and a11y findings"
```

If the pass found nothing to fix beyond the skip link, say so in the commit body rather than inventing changes.

---

### Task 17: The Playwright smoke run

One test, covering the path that matters: configure an agent, then watch it run.

**Files:**
- Create: `client/playwright.config.ts`
- Create: `client/e2e/agent-platform.spec.ts`
- Modify: `client/.gitignore` is already covered by `AgentPlatform-FrontEnd/.gitignore`

**Interfaces:**
- Consumes: both servers, started by Playwright's `webServer` array.
- Produces: `npm run test:e2e` as a single command that boots the API and the client, runs the flow, and tears both down.

- [ ] **Step 1: Write the Playwright config**

`client/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // Both servers, torn down together. The API must be reusable across runs so
  // the fixture store starts from its seed each time it boots.
  webServer: [
    {
      command: 'npm start',
      cwd: '../../AgentPlatform-BackEnd/server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
```

- [ ] **Step 2: Install the browser**

Run from `AgentPlatform-FrontEnd/client`: `npx playwright install chromium`
Expected: downloads and reports the browser as installed.

- [ ] **Step 3: Write the smoke test**

`client/e2e/agent-platform.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('configure an agent, then watch it run with its trace', async ({ page }) => {
  await page.goto('/agents');

  // The seed data loaded, and the API is reachable.
  await expect(page.getByRole('table', { name: 'Agents' })).toBeVisible();
  await expect(page.getByText('connected · mock')).toBeVisible();

  // Create an agent. It opens in the peek with its name ready to replace.
  await page.getByRole('button', { name: 'New agent' }).click();
  const peek = page.getByRole('dialog', { name: /Agent/ });
  await expect(peek).toBeVisible();

  const nameField = peek.getByRole('textbox', { name: 'Agent name' });
  await nameField.fill('Smoke Agent');

  // Write a system prompt and confirm autosave reports itself.
  await peek.getByRole('textbox', { name: 'System prompt' }).fill('Answer in one short sentence.');
  await peek.getByRole('textbox', { name: 'Agent name' }).click();
  await expect(peek.getByText(/^Saved \d{2}:\d{2}:\d{2}$/)).toBeVisible();

  // Attach two tools through the picker.
  await peek.getByRole('button', { name: /Attach a tool|Add/ }).click();
  const picker = page.getByRole('dialog', { name: 'Attach tools' });
  await picker.getByRole('checkbox', { name: /Current time/ }).check();
  await picker.getByRole('checkbox', { name: /HTTP request/ }).check();
  await expect(picker.getByText('2 of 4 selected')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(peek.getByText('Current time')).toBeVisible();
  await expect(peek.getByText('HTTP request')).toBeVisible();

  // Activate it, then leave the peek.
  await peek.getByRole('combobox', { name: 'Status' }).selectOption('active');
  await peek.getByRole('button', { name: 'Close panel' }).click();
  await expect(page.getByRole('dialog', { name: /Agent/ })).toBeHidden();

  // The table reflects everything that was just configured.
  const row = page.getByRole('row', { name: /Smoke Agent/ });
  await expect(row).toBeVisible();
  await expect(row.getByText('Active')).toBeVisible();

  // Survive a reload: the writes really reached the server.
  await page.reload();
  await expect(page.getByRole('row', { name: /Smoke Agent/ })).toBeVisible();

  // Move to chat through the row menu.
  await page.getByRole('row', { name: /Smoke Agent/ }).hover();
  await page.getByRole('button', { name: 'Actions for Smoke Agent' }).click();
  await page.getByRole('button', { name: 'Test in chat' }).click();
  await expect(page).toHaveURL(/\/chat\//);

  // The empty state is derived from the tools that were just attached.
  await expect(page.getByRole('button', { name: 'What time is it in Tokyo right now?' })).toBeVisible();

  // Send a message and watch the staged reveal produce both nodes.
  await page.getByRole('textbox', { name: /Message Smoke Agent/ }).fill('what time is it, and is the endpoint up?');
  await page.getByRole('button', { name: 'Send message' }).click();

  const timeNode = page.getByRole('button', { name: /Current time/ });
  const httpNode = page.getByRole('button', { name: /HTTP request/ });
  await expect(timeNode).toBeVisible();
  await expect(httpNode).toBeVisible({ timeout: 5000 });

  // The answer only lands after the last node resolves.
  await expect(page.getByText(/Expand a step above|Tokyo/)).toBeVisible({ timeout: 5000 });

  // Expanding a node reveals the actual payload.
  await expect(timeNode).toHaveAttribute('aria-expanded', 'false');
  await timeNode.click();
  await expect(timeNode).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/"timezone": "Asia\/Tokyo"/)).toBeVisible();

  // The failure path reports what happened and offers a way forward.
  await page.getByRole('textbox', { name: /Message Smoke Agent/ }).fill('please fail this run');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText(/connection refused/)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  // Clean up so a rerun against a warm server starts from the same place.
  await page.goto('/agents');
  await page.getByRole('row', { name: /Smoke Agent/ }).hover();
  await page.getByRole('button', { name: 'Actions for Smoke Agent' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete Smoke Agent' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Agent deleted')).toBeVisible();
  await expect(page.getByRole('row', { name: /Smoke Agent/ })).toBeHidden();
});
```

- [ ] **Step 4: Run it**

Run from `AgentPlatform-FrontEnd/client`: `npm run test:e2e`
Expected: PASS, 1 test. If a locator fails, fix the locator or the component — do not weaken an assertion to make it pass.

- [ ] **Step 5: Commit**

```bash
git add AgentPlatform-FrontEnd/client
git commit -m "test: add playwright smoke run over configure-then-execute"
```

---

### Task 18: Deployment scaffold and the root README

The PDF asks for a Docker Compose deployment. The compose file here runs the fixture backend and the built client together; it is honest scaffold, not a production deployment, and the README says so.

**Files:**
- Create: `AgentPlatform-BackEnd/deployment/docker-compose.yml`, `AgentPlatform-BackEnd/deployment/README.md`, `AgentPlatform-BackEnd/deployment/deploy/env/backend.env.example`
- Create: `AgentPlatform-BackEnd/LICENSE`, `AgentPlatform-FrontEnd/LICENSE` (copies of the repo root `LICENSE`)
- Modify: repo root `README.md`

**Interfaces:**
- Consumes: the two Dockerfiles from Tasks 1 and 4, and the `nginx.conf` from Task 4.
- Produces: `docker compose up` as one command that serves the whole PoC on `http://localhost:8080`.

- [ ] **Step 1: Write the compose file**

`AgentPlatform-BackEnd/deployment/docker-compose.yml`:

```yaml
# Runs the proof of concept end to end. The API serves fixtures: there is no
# database and no LLM provider, so nothing here needs credentials or volumes.
services:
  api:
    build:
      context: ../server
    env_file:
      - ./deploy/env/backend.env
    expose:
      - '4000'
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 5

  web:
    build:
      context: ../../AgentPlatform-FrontEnd/client
    ports:
      - '8080:80'
    depends_on:
      api:
        condition: service_healthy
```

`AgentPlatform-BackEnd/deployment/deploy/env/backend.env.example`:

```
PORT=4000
# nginx proxies /api on the same origin, so the browser never sends a
# cross-origin request and this value is only a fallback for direct access.
CORS_ORIGIN=http://localhost:8080
```

- [ ] **Step 2: Write the deployment README**

Write `AgentPlatform-BackEnd/deployment/README.md`:

    # Deployment

    Scaffold for the proof of concept. It builds both images and serves the client
    through nginx, which proxies `/api` to the API container on the same origin.

    ## Run

    ```bash
    cp deploy/env/backend.env.example deploy/env/backend.env
    docker compose up --build
    ```

    Open `http://localhost:8080`.

    ## What this is not

    The API holds agents in memory, so **every restart resets them to the four
    seed agents**. There is no database, no LLM provider, and no auth. Before this
    becomes a real deployment it needs: a persistent store behind
    `services/agentStore.js`, real credentials for the LLM provider, TLS, and a
    replacement for `services/mockExecutionService.js`.

- [ ] **Step 3: Copy the licence into both projects**

Apricity carries a `LICENSE` in each project folder. Match that:

```bash
cp LICENSE AgentPlatform-BackEnd/LICENSE
cp LICENSE AgentPlatform-FrontEnd/LICENSE
```

- [ ] **Step 4: Rewrite the root README**

Write the repo root `README.md`:

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

    Two terminals:

    ```bash
    cd AgentPlatform-BackEnd/server && npm install && npm run dev
    cd AgentPlatform-FrontEnd/client && npm install && npm run dev
    ```

    Open `http://localhost:5173`.

    Or with containers:

    ```bash
    cd AgentPlatform-BackEnd/deployment
    cp deploy/env/backend.env.example deploy/env/backend.env
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

- [ ] **Step 5: Verify the compose stack actually serves the app**

```bash
cd AgentPlatform-BackEnd/deployment
cp deploy/env/backend.env.example deploy/env/backend.env
docker compose up --build -d
```

Then confirm all three:

```bash
curl -s http://localhost:8080/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/chat
```

Expected: `{"status":"ok","mode":"mock"}`, then `200`, then `200` — the third proves the nginx `try_files` fallback serves the app shell for a client-side route. Open `http://localhost:8080` and run through one chat message. Then `docker compose down`.

If Docker is unavailable in the environment, skip this step and record it as unverified in the commit body. Do not claim it works without running it.

- [ ] **Step 6: Commit**

```bash
git add README.md AgentPlatform-BackEnd AgentPlatform-FrontEnd
git commit -m "chore: add compose deployment scaffold and project documentation"
```

---

## Spec coverage

Every requirement in the spec, mapped to the task that implements it. Checked during the self-review pass; no row is unassigned.

| Spec section | Requirement | Task |
| --- | --- | --- |
| §2 | Create, update, delete agents | 2, 10, 11, 12 |
| §2 | System prompt per agent | 12 |
| §2 | Model per agent | 5, 12 |
| §2 | Attach tools to an agent | 1, 12 |
| §2 | Execute an agent, read the result | 3, 13, 15 |
| §2 | Execution history as an inline trace | 14 |
| §2 | REST surface for all of it | 1, 2, 3 |
| §4.1 | The 15-token palette, verbatim | 4 |
| §4.1 | `--trace` reserved for machinery | 6 (Chip), 14 (rail), verified in 16 |
| §4.2 | Inter and JetBrains Mono, self-hosted | 4 |
| §4.2 | Mono system prompt | 12 |
| §4.2 | Tabular figures on aligned numbers | 4 (`.mono`) |
| §4.3 | Space, radius, elevation tokens | 4 |
| §4.4 | Motion tokens, reduced-motion lever | 4, verified in 16 |
| §5 | Trace rail, all five rules | 14 |
| §6.1 | Apricity layout, plain colocated CSS | 1, 4 |
| §6.2 | The folder tree | 1–15 |
| §6.3 | Routes, hooks, no state library | 5, 9, 10, 13 |
| §6.4 | `agentStore` and `mockExecutionService` as swap points | 2, 3 |
| §6.5 | The eight endpoints | 1, 2, 3 |
| §6.6 | Data model, models, tools, seed agents | 1, 2, 5 |
| §7.1 | Sidebar, nested agents, health pill | 9 |
| §7.2 | Table, columns, row menu, empty states | 11 |
| §7.3 | Peek, property rows, autosave, delete | 12 |
| §7.4 | Tool picker | 12 |
| §8.1 | Chat header, switcher, model, Clear | 15 |
| §8.2 | Turns, no bubbles, staged reveal, failure | 13, 14, 15 |
| §8.3 | Both chat empty states | 15 |
| §8.4 | Composer, Enter/Shift+Enter, disabled run | 15 |
| §9 | Focus, reduced motion, breakpoints, a11y, truncation, loading | 4, 6–15, verified in 16 |
| §10 | Copy rules | applied throughout, reviewed in 16 |
| §11 | Vitest units, component tests, one Playwright run | 4–15, 17 |
| §12 | Decisions on record | honoured throughout |

Two additions beyond the spec, both recorded rather than silent:

1. **Backend tests** (Tasks 1–3). §11 covers frontend testing only. The API is the contract the whole UI depends on, and Supertest coverage of it is cheap. 
2. **A skip link** (Task 16). §9 requires keyboard operability; with a 240px sidebar preceding the content, a skip link is what makes that requirement real.

Two deviations are explained in full at the top of this plan: fonts come from `@fontsource-variable/*` rather than `src/assets/fonts/`, and the approved contrast-corrected muted/signal tokens take precedence over the original palette values.
