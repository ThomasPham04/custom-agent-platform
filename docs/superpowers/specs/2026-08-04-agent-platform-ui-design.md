# AI Agent Platform — UI Design Spec

**Date:** 2026-08-04
**Status:** Approved
**Source requirement:** `AI Agent Platform.pdf` (Proof of Concept brief)

---

## 1. Objective

Build the web UI for the AI Agent Platform proof of concept: one page with a Notion-style
left sidebar holding two sections, **Agents** (create, configure, delete) and **Chat** (test an
agent and read its tool-call trace).

This spec covers the UI layer only. The React app talks to an Express server over real HTTP,
but every Express route handler returns fixtures. No LLM provider, no Google ADK integration,
no database, no auth. When the real backend lands it replaces handler bodies behind the same
REST contract, and the frontend does not change.

## 2. Scope

### In scope

| Capability | Where it lands |
| --- | --- |
| Create, update, delete agents | Agents table + side peek |
| Configure a system prompt per agent | Agent peek, mono textarea, autosave |
| Choose an LLM model per agent | Agent peek, select with Gemini options |
| Register/attach tools to an agent | Tool picker popover, purple chips |
| Execute an agent and read the result | Chat surface, message list |
| Execution history and logs | Inline trace rail inside each assistant turn |
| REST API surface for all of the above | Express routes returning fixtures |

### Out of scope for this pass

- Real LLM calls, Google ADK, streaming responses (Server-Sent Events)
- Persistence beyond an in-memory store that resets on server restart
- Auth, multi-user, workspaces, sharing
- A separate Runs/History surface. Execution history is the inline trace, decided in brainstorming.
- Architecture diagram, deployment guide, and developer guide deliverables from the PDF.
  A `deployment/` folder exists as scaffold only.

## 3. Product read

Two activities happen on this screen and they are opposite in nature.

**Authoring an agent** is human and prose-shaped. You write a personality into a text box, and
the work is forgiving.

**Running an agent** is machinery. A tool was called with these arguments, took 118ms, returned
this JSON.

Most agent-builder UIs blur the two into identical gray cards. Notion's own vocabulary already
separates them: prose blocks versus code blocks. The design leans on that split, and it decides
the palette, the typography, and the signature element.

## 4. Visual system

Values follow Notion's real light-mode tokens rather than an impression of them: the warm
near-black, the 3px radii, the hairline rules. Two places take a deliberate position — the sixth
color and the assertive use of mono.

### 4.1 Color

Declared as custom properties in `styles/tokens.css`.

| Token | Hex | Role |
| --- | --- | --- |
| `--ink` | `#37352F` | Notion's warm near-black. All prose. Never pure black. |
| `--ink-muted` | `#787774` | Secondary text, labels, descriptions |
| `--ink-faint` | `#9B9A97` | Placeholders, disabled text |
| `--paper` | `#FFFFFF` | Content canvas |
| `--shell` | `#F7F7F5` | Sidebar, chrome, user turns, prompt textarea |
| `--rule` | `#E9E9E7` | Hairlines. 1px. Preferred over shadow wherever a rule will do. |
| `--hover` | `rgba(55,53,47,0.06)` | Row and item hover |
| `--active` | `rgba(55,53,47,0.08)` | Selected sidebar item, pressed state |
| `--signal` | `#2383E2` | Notion blue. Primary action, focus ring, links, active nav. |
| `--signal-ring` | `rgba(35,131,226,0.28)` | Focus ring halo |
| `--trace` | `#9065B0` | Notion purple. Rail and step glyphs only (graphic, not text). |
| `--trace-ink` | `#6940A5` | Text on trace surfaces, for 4.5:1 contrast |
| `--trace-wash` | `#E8DEEE` | Tool chip background |
| `--ok` | `#448361` | Active status, successful step |
| `--warn` | `#D9730D` | Slow step, draft warnings |
| `--err` | `#D44C47` | Failed step, delete action, save failure |

**The position:** `--trace` purple never appears on a button, a link, or a heading. It appears
only on the trace rail, the step glyphs, and the tool chips. It becomes the color that means
*the machine acted on its own*. Status colors are Notion's own text colors, so nothing leaves
the family.

`--trace` `#9065B0` fails contrast as text on `--trace-wash`. Chip and node labels use
`--trace-ink` `#6940A5`.

### 4.2 Typography

Two faces, split along the same human/machine line.

**Inter** (variable, self-hosted at `src/assets/fonts/Inter/`) for anything a person wrote:
agent names, descriptions, the assistant's answer, all chrome.

**JetBrains Mono** (self-hosted at `src/assets/fonts/JetBrainsMono/`) for anything a machine
produced: tool names, latencies, model IDs, JSON payloads, timestamps, counts. Set with
`font-variant-numeric: tabular-nums` so columns of numbers do not shimmer.

Mono also sets the **system prompt textarea** at 14px. A system prompt is closer to code than to
prose; mono asks for precision and files the prompt on the machine side of the split. This is a
deliberate departure from what a typical dashboard would do, and it is what makes the trace read
like an instrument panel embedded in a Notion document.

No display serif. Notion's restraint is the brief; the boldness is spent on the trace rail.

| Role | Face | Size / weight / spacing |
| --- | --- | --- |
| Page title | Inter | 40px / 700 / -0.02em |
| Peek title (agent name input) | Inter | 24px / 600 / -0.01em |
| Section heading | Inter | 16px / 600 |
| Body, message text | Inter | 16px / 400 / 1.5 |
| Sidebar item, table cell, property value | Inter | 14px / 500 (sidebar), 400 (cell) |
| Sidebar section label | Inter | 12px / 600 / `--ink-muted`, sentence case |
| Table column header | Inter | 12px / 500 / `--ink-muted` |
| System prompt | JetBrains Mono | 14px / 400 / 1.6 |
| Tool name, model ID, chip | JetBrains Mono | 12px / 500 |
| Latency, timestamp, hint, counts | JetBrains Mono | 11px / 400 / tabular |

Fonts are self-hosted with `font-display: swap`, subset to latin + latin-ext, `woff2` only.

### 4.3 Space, radius, elevation

- Spacing scale: 2, 4, 6, 8, 12, 16, 24, 32, 48, 64 (px), as `--space-*`.
- Radius: `--radius-sm` 3px (Notion's default: chips, rows, inputs, buttons),
  `--radius-md` 6px (popovers, composer, code blocks), `--radius-lg` 8px (drawer on mobile).
- Elevation, used sparingly. Popover/menu:
  `0 14px 28px -6px rgba(15,15,15,0.15), 0 2px 4px rgba(15,15,15,0.1)` with a 1px `--rule`
  border. Peek panel: `-4px 0 16px -6px rgba(15,15,15,0.12)` plus a 1px left rule.
- Content column: 708px max-width (Notion's page width) for chat and page bodies.

### 4.4 Motion

- Durations: 120ms (hover, color), 180ms (fade, disclosure), 240ms (peek slide).
- Easing: `cubic-bezier(0.2, 0, 0.2, 1)`.
- Under `prefers-reduced-motion: reduce`, the rail sweep holds a static state, the peek appears
  without sliding, and fades resolve instantly. No animation is the only carrier of meaning.

## 5. The signature element: the Trace Rail

An assistant turn is not a chat bubble. It is a document block with a 2px vertical rail down its
left edge in `--trace`, and each tool invocation is a node on that rail.

```
  ⚙  ┃  ▾  current_time                                       118 ms
     ┃     ┌──────────────────────────────────────────────────────┐
     ┃     │ { "timezone": "Asia/Tokyo" }                         │
     ┃     │ → "2026-08-04T21:03:41+09:00"                        │
     ┃     └──────────────────────────────────────────────────────┘
     ┃  ▸  http_request                                       412 ms
     ╹
        It's 9:03 PM in Tokyo, and the status endpoint is healthy —
        200 in 41 ms.
```

Rules that make it work:

1. **The rail stops before the answer.** The prose carries no rail, no indent decoration, no
   background. Machinery ends, answer begins, and the handoff is visible.
2. **Nodes are collapsed by default.** Expanded, a node shows the request arguments and the
   response, each in a Notion-style code block on `--shell` with mono 12px.
3. **A node in flight** shows a pulsing glyph, and the rail segment above it runs a slow vertical
   gradient sweep. Reduced motion substitutes a static two-tone segment.
4. **A failed node** renders its glyph and duration in `--err`, and the rail terminates there.
5. **Nodes are real disclosure buttons** with `aria-expanded`, keyboard-operable, not divs.

## 6. Architecture

### 6.1 Shape

Structure follows the Apricity project: two sibling project folders rather than an npm-workspaces
monorepo, backend in plain JavaScript with `controllers / routes / services / utils`, frontend in
TypeScript under a `client/` folder, and **plain CSS colocated per component**. No Tailwind, no
CSS-in-JS. Notion's look lives in hairlines and 3px radii that a utility framework fights, so
plain CSS with custom-property tokens is the right instrument here.

Both folders live inside the existing single git repository.

### 6.2 Folder tree

```
AgentPlatform-BackEnd/
  .gitignore  LICENSE  README.md
  deployment/
    README.md   docker-compose.yml   deploy/env/backend.env.example
  server/
    .dockerignore  .env.example  Dockerfile  eslint.config.js  package.json  server.js
    controllers/
      agentController.js      chatController.js      toolController.js
    routes/
      agentRoutes.js          chatRoutes.js          toolRoutes.js
    services/
      agentStore.js           mockExecutionService.js
    data/
      agents.js   tools.js   runs.js
    utils/
      status.js   ids.js

AgentPlatform-FrontEnd/
  .gitignore  LICENSE  README.md
  client/
    .dockerignore  .env.example  Dockerfile  nginx.conf
    eslint.config.js  index.html  package.json  tsconfig.json  vite.config.js
    src/
      main.tsx  App.tsx  App.css  index.css  vite-env.d.ts
      assets/fonts/Inter/  assets/fonts/JetBrainsMono/
      styles/
        global.css   tokens.css
      components/
        layout/
          Sidebar.tsx      Sidebar.css
          TopBar.tsx       TopBar.css
          Workspace.tsx    Workspace.css
        agents-section/
          agent-table/     agent-table.tsx    agent-table.css    index.ts
          agent-peek/      agent-peek.tsx     agent-peek.css     index.ts
          agent-form/      agent-form.tsx     agent-form.css
          tool-picker/     tool-picker.tsx    tool-picker.css
        chat-section/
          agent-switcher/  agent-switcher.tsx agent-switcher.css
          message-list/    message-list.tsx   message-list.css   index.ts
          message-turn/    message-turn.tsx   message-turn.css
          trace-rail/      trace-rail.tsx     trace-rail.css     index.ts
          tool-call-node/  tool-call-node.tsx tool-call-node.css
          composer/        composer.tsx       composer.css       index.ts
        ui/
          button.tsx       select.tsx       textarea.tsx       skeleton.tsx
          chip/            chip.tsx         chip.css           index.ts
          popover/         popover.tsx      popover.css        index.ts
          empty-state/     empty-state.tsx  empty-state.css    index.ts
          toast/           toast.tsx        toast.css          index.ts
          confirm-delete/  confirm-delete.tsx confirm-delete.css index.ts
      config/
        models.ts
      data/
        suggested-prompts.ts
      hooks/
        useAgents.ts   useChat.ts   useTools.ts   useApiHealth.ts   useMediaQuery.ts
      lib/
        api-client.ts  api-host.ts  agent-icons.ts  format.ts
      pages/
        index.tsx
        Agents/  index.tsx  agents.css
        Chat/    index.tsx  chat.css
      types/
        agent.ts  tool.ts  message.ts
```

Naming conventions copied from Apricity: kebab-case component folders and files, PascalCase for
`layout/` components and page directories, `index.ts` barrels on multi-file component folders,
`index.tsx` as each page's entry, page-scoped CSS named after the page (`agents.css`).

### 6.3 Frontend state and routing

State lives in hand-rolled hooks over `fetch`. No Redux, no Zustand, no query library. The two
features need list, detail, and mutate; that is roughly 60 lines each, and a cache layer over
three endpoints is weight without payoff.

`react-router` provides the routes below so refresh and links survive:

| Route | Renders |
| --- | --- |
| `/agents` | Agents table, no peek |
| `/agents/:agentId` | Agents table with that agent's peek open |
| `/chat` | Chat with the last-used agent from `localStorage`, falling back to the first agent |
| `/chat/:agentId` | Chat scoped to that agent |
| `/` | Redirect to `/agents` |

`pages/index.tsx` holds the route table, mirroring Apricity's `pages/index.jsx`.

Hook responsibilities:

- `useAgents` — list, create, patch (optimistic with rollback), delete, and the autosave debounce.
- `useTools` — fetch the tool registry once and cache it in module scope.
- `useChat` — a `Record<agentId, Message[]>` held in React state, plus send, in-flight status,
  retry, and the staged reveal described in §8.2. Switching agents and switching back restores
  that agent's thread for the session. Nothing is persisted, so a reload starts empty; **Clear**
  empties only the active agent's thread.
- `useApiHealth` — poll `GET /api/health` every 15s to drive the sidebar status pill.
- `useMediaQuery` — breakpoint state for the sidebar drawer and peek sheet.

### 6.4 Backend

> **Superseded 2026-08-09.** This section describes the Express implementation, which has
> been deleted. The REST contract it defined is unchanged and is now recorded in
> `docs/superpowers/references/express-contract-reference.md`; the replacement architecture
> is in `docs/superpowers/specs/2026-08-08-agent-platform-backend-architecture-design.md`.
> Everything else in this spec — the visual system, the interaction model, §8.2 client-side
> pacing — still stands.

Express 5, plain JavaScript, ESM. `server.js` mounts CORS for the Vite dev origin, JSON body
parsing, the three route modules, a 404 handler, and an error handler that returns
`{ error: { code, message } }`.

`services/agentStore.js` holds a `Map` seeded from `data/agents.js`. It is the only module that
mutates agent state, so swapping it for a real database touches one file.

`services/mockExecutionService.js` produces a canned run for a given agent and user message. It
picks tool calls based on which tools the agent has attached and assigns each a plausible
`durationMs`. It returns the complete message after a single short delay (roughly 150ms) rather
than sleeping between steps — the per-step pacing is the client's job, per §8.2. One scripted
input (a message containing the word `fail`) returns a failed tool call, so the error path is
reachable without editing code.

### 6.5 REST contract

Every response is JSON. Errors use `{ error: { code, message } }` with a real status code.

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/health` | `{ status: "ok", mode: "mock" }` |
| `GET` | `/api/agents` | `Agent[]` |
| `POST` | `/api/agents` | `Agent` (201) |
| `GET` | `/api/agents/:id` | `Agent` (404 if absent) |
| `PATCH` | `/api/agents/:id` | `Agent` |
| `DELETE` | `/api/agents/:id` | 204 |
| `GET` | `/api/tools` | `Tool[]` |
| `POST` | `/api/chat/:agentId/messages` | `{ message: Message }` with `toolCalls[]` |

`POST /api/chat/:agentId/messages` takes `{ content: string }` and answers with the finished
assistant message, tool calls included. This is the contract the real execution engine will
implement; `mockExecutionService` is the placeholder behind it. Per-step pacing is a client
concern (§8.2), so the endpoint does not stream and does not stall.

### 6.6 Data model

```ts
// types/agent.ts
export type AgentStatus = 'active' | 'draft';

export interface Agent {
  id: string;
  name: string;
  icon: string;          // single emoji
  description: string;
  model: string;         // one of config/models.ts
  systemPrompt: string;
  toolIds: string[];
  status: AgentStatus;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

// types/tool.ts
export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface Tool {
  id: string;            // 'current_time'
  label: string;         // 'Current time'
  description: string;
  params: ToolParam[];
}

// types/message.ts
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

**Models offered** (`config/models.ts`): `gemini-2.5-flash`, `gemini-2.5-pro`,
`gemini-2.0-flash`. The PDF prefers Google ADK, so a Gemini-only picker keeps the mock honest.

**Tools registered** (`data/tools.js`): `current_time` and `http_request` from the PDF, plus
`calculator` and `knowledge_search` so the tool picker has enough entries to filter against.

**Seed agents** (`data/agents.js`): four agents covering the states the UI must render — one with
several tools and a long prompt, one with a single tool, one `draft` with no tools, one with a
long name and description for truncation.

## 7. Surface 1 — Agents

```
┌────────────────────┬───────────────────────────────────────────────────────┐
│ ▦ Agent Platform ⌄ │                                                       │
│ ⌕ Search           │  Agents                                               │
│                    │  Configure agents and the tools they can reach.       │
│ Workspace          │                                                       │
│ ▾ ▤ Agents         │  4 agents        ⌕ Filter…            ＋ New agent    │
│    ⚙ Support Bot   │  ───────────────────────────────────────────────────  │
│    ◉ Researcher    │  NAME          MODEL             TOOLS      UPDATED   │
│    ▣ Analyst       │  ⚙ Support Bot gemini-2.5-flash  ⬡2         2h ago  ⋯│
│    ✦ Drafter       │  ◉ Researcher  gemini-2.5-pro    ⬡3         1d ago    │
│ ▸ ✉ Chat           │  ▣ Analyst     gemini-2.0-flash  ⬡1         3d ago    │
│                    │  ✦ Drafter     gemini-2.5-flash  —          5d ago    │
│ ─────────────────  │                                                       │
│ ● connected · mock │                                                       │
└────────────────────┴───────────────────────────────────────────────────────┘
```

### 7.1 Sidebar

240px wide on `--shell` with a 1px right rule. Top row is a workspace button: a 20px rounded
square holding an icon, the label "Agent Platform", and a chevron. The chevron opens a popover
with a single disabled-looking "Mock workspace" line, since there is no multi-workspace concept.

Below it a Search row. It filters the Agents table and navigates to `/agents`, so it is real
rather than decorative.

Then the section label "Workspace" and two nav items, **Agents** and **Chat**. The active item
takes `--active` background at 3px radius. Agents carries a disclosure triangle: expanding it
lists the agents as child rows with their emoji icons, and clicking a child opens
`/agents/:agentId` with the peek. Chat has no children in this pass.

The footer strip shows a status pill driven by `useApiHealth`: a green dot with mono
`connected · mock`, or a red dot with `api offline` when the poll fails. Real signal, not
decoration.

Under 900px the sidebar leaves the flow. A hamburger button appears in the page header and the
sidebar returns as an overlay drawer with a scrim, closing on Esc, on scrim click, and on
navigation.

### 7.2 Agents table

A real `<table>` with `<thead>`, hairline row dividers, and 40px rows. Six columns; the wireframe
above omits Description and Status for drawing width.

| Column | Content |
| --- | --- |
| Name | Emoji icon plus name, Inter 14px `--ink` |
| Description | `--ink-muted`, single line, ellipsis truncation |
| Model | Mono 12px chip on `--shell` |
| Tools | Up to two `--trace` chips, then `+N`; an em dash when none |
| Status | 6px dot plus label, `--ok` for active, `--ink-faint` for draft |
| Updated | Mono 11px relative time |

Row hover applies `--hover` and reveals a `⋯` button at the right edge, which opens a popover
with **Test in chat**, **Duplicate**, and **Delete**. Clicking anywhere else in the row opens the
peek. Rows are keyboard-reachable and Enter opens the peek.

The view bar above the table shows the agent count, a filter input, and the primary
**New agent** button. Creating an agent posts a draft named "New agent" and immediately opens its
peek with the name input focused and selected.

Loading shows three skeleton rows. Empty shows a centered empty state: "No agents yet.",
"Create your first agent to start testing.", and a New agent button. A filter that matches
nothing shows "No agents match \"<query>\"." with a Clear filter action.

### 7.3 Agent peek

Slides in from the right at 480px on `--paper`, with a 1px left rule and a soft shadow. It is
non-modal: `role="dialog"` with `aria-modal="false"`, so the table stays interactive and no focus
trap is installed. Esc closes it and returns focus to the originating row. Tab order enters the
peek directly after its trigger.

Header: an emoji button opening a grid of the 24 curated icons exported from `lib/agent-icons.ts`,
the agent name as a borderless Inter 24px/600 input, and a `✕` close button. The grid is a fixed
set rather than a full emoji keyboard, which keeps the table's icon column visually coherent.

Body, in Notion property-row form — a 120px `--ink-muted` label on the left, the value on the
right:

- **Status** — select, Active or Draft
- **Model** — select, mono values from `config/models.ts`
- **Tools** — a button opening the tool picker popover; selections render inline as `--trace`
  chips each with a `✕`
- **Created** and **Updated** — read-only mono 11px

A hairline divider, then a "System prompt" section heading, then an auto-growing textarea:
JetBrains Mono 14px on `--shell`, 6px radius, no visible border until focus, 200px minimum
height. A mono character count sits below it on the right.

Another divider, then **Description** as a single-line input.

**Autosave, no Save button.** Changes debounce at 600ms and flush on blur. A footer strip reads
mono `Saved 21:04:12`, `Saving…`, or a red `Couldn't save. Retry` with a retry action. Autosave
is Notion's own behavior and it removes a whole class of lost-work bug.

**Delete agent** sits at the bottom as a text button in `--err`. It opens an anchored confirm
popover: "Delete Support Bot? This can't be undone." with Cancel and Delete. On success the peek
closes, the row leaves the table, the route returns to `/agents`, and a toast reads
"Agent deleted". The toast carries no Undo: re-creating through `POST /api/agents` would mint a new
id, so an Undo would be a lie about what it restored. The confirm step is the safeguard instead.

Under 700px the peek becomes a bottom sheet at 92% viewport height with 8px top corners and a
drag handle, and it does trap focus at that size, since the table is no longer visible.

### 7.4 Tool picker

A popover anchored to the Tools row, 320px wide, 6px radius, with the menu shadow. A search input
at the top, then a scrolling list of checkbox rows: tool label in Inter 14px, tool id in mono
11px `--ink-muted` beneath it. Arrow keys move, Space toggles, Enter closes, Esc cancels. A
footer line reads mono `2 of 4 selected`.

## 8. Surface 2 — Chat

```
┌────────────────────┬───────────────────────────────────────────────────────┐
│ ▦ Agent Platform ⌄ │  ⚙ Support Bot ⌄              gemini-2.5-flash  Clear │
│ ⌕ Search           │  ───────────────────────────────────────────────────  │
│                    │                                                       │
│ Workspace          │    ▢  what time is it in Tokyo, and is the status     │
│ ▸ ▤ Agents         │       endpoint up?                                    │
│ ▾ ✉ Chat           │                                                       │
│                    │    ⚙  ┃ ▾ current_time                      118 ms   │
│                    │       ┃   { "timezone": "Asia/Tokyo" }               │
│                    │       ┃   → "2026-08-04T21:03:41+09:00"              │
│                    │       ┃ ▸ http_request                      412 ms   │
│                    │       ╹                                               │
│                    │          It's 9:03 PM in Tokyo, and the status        │
│                    │          endpoint is healthy — 200 in 41 ms.          │
│ ─────────────────  │  ┌─────────────────────────────────────────────────┐ │
│ ● connected · mock │  │ Message Support Bot…                         ➔ │ │
└────────────────────┴──┴─────────────────────────────────────────────────┴─┘
```

### 8.1 Header

Sticky, 45px tall, 1px bottom rule. On the left, the agent switcher: a button showing the agent's
emoji, name, and a chevron, opening a searchable popover list of agents. On the right, the
selected model in mono 11px `--ink-muted`, and a **Clear** text button that empties the thread
after a confirm popover, shown only when the thread has messages.

### 8.2 Message list

A 708px centered column. **No bubbles.** Both roles run in document flow.

**User turn** — a 28px `--shell` square avatar, then the message inside a `--shell` block at 3px
radius with 12px padding, which is Notion's callout block. Left-aligned.

**Assistant turn** — the agent's emoji square, then the trace rail and its nodes, then the answer
as bare Inter 16px prose on `--paper`.

The asymmetry between a washed block and a bare block gives the alternation cue without importing
chat-app chrome that would fight the rail. Right-aligned user bubbles were considered and
rejected for that reason.

**In flight** — the assistant turn renders as soon as the user sends, showing the agent avatar, a
mono `working…` line, and the rail already drawn.

The request returns the whole message at once, so `useChat` **stages the reveal on the client**.
It holds the response, then walks `toolCalls` in order, revealing each node after that call's own
`durationMs` elapses and marking it `running` while it waits. When the last node resolves, the
answer prose replaces the working line with a 180ms fade. Each node fades in over 180ms, and the
rail sweeps above whichever node is currently `running`.

Two things fall out of this. The wait a person experiences equals the sum of the real durations
the trace reports, so the pacing never contradicts the numbers on screen. And the reveal logic is
where a streaming backend will need it: swapping the fixture call for a Server-Sent Events
subscription replaces the timer that advances the cursor, not the rendering. Under
`prefers-reduced-motion` the staging still runs, since it conveys sequence rather than decoration;
only the sweep and fades are suppressed.

**Failure** — the rail terminates in an `--err` node. The answer slot reads the specific failure,
for example `current_time failed: connection refused after 5s.`, followed by a **Retry** button
that re-sends the same user message. Errors state what happened and how to proceed; they do not
apologize and they are never vague.

An `aria-live="polite"` region announces "Support Bot responded" on completion and the failure
text on error.

### 8.3 Empty states

With an agent selected and no messages: the agent's emoji at 32px, its name at Inter 24px/600,
its description in `--ink-muted`, its tools as `--trace` chips, then three suggested prompt
buttons **derived from the agent's attached tools** via `data/suggested-prompts.ts`. An agent with
`current_time` offers "What time is it in Tokyo?"; an agent with no tools falls back to three
generic prompts. Clicking one fills the composer and sends.

With no agents at all: "No agents to test." and "Create an agent to start a test run.", with a
button routing to `/agents`.

### 8.4 Composer

Sticky to the bottom of the 708px column with a `--paper` backdrop and a top fade. An
auto-growing textarea, 1px `--rule` border, 6px radius, growing to a 200px maximum before it
scrolls. Placeholder: `Message Support Bot…`. Enter sends, Shift+Enter inserts a newline. A round
send button holds an arrow glyph, disabled while empty. Below it, mono 11px `--ink-muted`:
`Enter to send · Shift+Enter for newline`.

During a run the textarea and send button are disabled and the send glyph becomes a spinner.
There is no stop control, because the mock does not stream.

## 9. Quality floor

- **Focus** — every interactive element takes a 2px `--signal` ring at 2px offset via
  `:focus-visible`. No `outline: none` without a replacement.
- **Reduced motion** — `prefers-reduced-motion: reduce` disables the rail sweep, the peek slide,
  the drawer slide, and content fades.
- **Responsive** — breakpoints at 1080px (table drops the Description column), 900px (sidebar
  becomes an overlay drawer), 700px (peek becomes a bottom sheet, table drops Status), and 380px
  (minimum supported width, no horizontal page scroll).
- **Accessibility** — semantic `<table>`; disclosure buttons carrying `aria-expanded` and
  `aria-controls`; every input bound to a `<label>`; popovers returning focus to their trigger;
  the live region for run outcomes; text contrast at 4.5:1 or better against its own background.
- **Keyboard** — Esc closes peek, popovers, and drawer. Arrow keys navigate the tool picker and
  the agent switcher. Enter opens a table row.
- **Truncation** — long agent names and descriptions truncate with ellipsis and expose a
  `title`. Long JSON payloads scroll inside their own code block rather than widening the page.
- **Loading** — skeletons for the table; the chat's in-flight state is the trace rail itself.

## 10. Copy rules

Written from the user's side of the screen, in the interface's voice.

- Labels name what the person controls: "Tools", not "Tool bindings". "System prompt", not
  "Prompt template config".
- An action keeps its name through the flow: the **Delete** button produces the toast
  "Agent deleted".
- Errors say what happened and what to do: "Couldn't save. Retry." No apologies, no vagueness.
- Empty states are invitations: "No agents yet. Create your first agent to start testing."
- Sentence case everywhere. Active voice. No filler.

## 11. Testing

Proportionate to a UI pass. Vitest plus React Testing Library where logic hides:

- `useAgents` — optimistic patch applies immediately and rolls back on a rejected request.
- `useChat` — in-flight status transitions; retry re-sends the same content; the staged reveal
  exposes nodes in `toolCalls` order and shows the answer only after the last one resolves, driven
  by fake timers rather than real waiting.
- `trace-rail` — renders one node per tool call, toggles disclosure and `aria-expanded`, and
  renders a failed node in the error state.
- `composer` — Enter sends, Shift+Enter inserts a newline, empty input cannot send.
- `format.ts` — relative time and duration formatting at boundary values.

One Playwright smoke run end to end: create an agent, set its prompt and two tools, observe the
autosave indicator, switch to Chat, select that agent, send a message, expand a tool node, and
assert the JSON payload is visible.

No markup snapshot tests. They generate churn without signal.

## 12. Decisions on record

| Decision | Choice | Reason |
| --- | --- | --- |
| Execution history location | Inline trace inside the assistant turn | Keeps the trace next to the response it explains; avoids a third surface |
| Agent editing pattern | Side peek | Notion's default; the list stays visible and switching agents is cheap |
| Backend in this pass | Express with fixture handlers | Exercises the real REST contract so the frontend needs no rework later |
| Project layout | Two sibling folders, Apricity convention | Matches the team's existing project structure |
| Styling | Plain colocated CSS with custom-property tokens | Notion's hairlines and 3px radii need direct control |
| State management | Hand-rolled hooks over `fetch` | Three endpoints do not justify a cache library |
| Save model | Autosave with a status readout | Notion's behavior; removes lost-work failures |
| Chat layout | Document flow, no bubbles | Bubbles would compete with the trace rail |
| Streaming | Not in this pass | Chosen against SSE to keep the first pass bounded; the contract allows adding it |
