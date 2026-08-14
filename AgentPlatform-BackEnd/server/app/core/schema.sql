-- Applied at startup, every statement idempotent. Spec §14 rules out Alembic
-- until the schema changes under real data.

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT        NOT NULL,
  icon          TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  model         TEXT        NOT NULL,
  system_prompt TEXT        NOT NULL,
  tool_ids      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);

-- GET /api/agents is always ordered by this column.
CREATE INDEX IF NOT EXISTS agents_updated_at_idx ON agents (updated_at DESC);

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT        NOT NULL,
  -- Snapshot columns. Agents are mutable; without these, editing a prompt would
  -- retroactively rewrite the history of every past run (spec §6). Deliberately
  -- NOT a foreign key to agents(id): deleting an agent must not erase the audit
  -- trail of what it did.
  agent_name    TEXT        NOT NULL,
  model         TEXT        NOT NULL,
  system_prompt TEXT        NOT NULL,
  user_message  TEXT        NOT NULL,
  answer        TEXT        NOT NULL,
  status        TEXT        NOT NULL,
  error         TEXT,
  latency_ms    INTEGER     NOT NULL,
  session_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS runs_created_at_idx ON runs (created_at DESC);
CREATE INDEX IF NOT EXISTS runs_agent_id_idx ON runs (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS run_tool_calls (
  id          TEXT PRIMARY KEY,
  run_id      TEXT    NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  tool_id     TEXT    NOT NULL,
  args        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  result      JSONB,
  error       TEXT,
  duration_ms INTEGER NOT NULL,
  status      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS run_tool_calls_run_id_idx ON run_tool_calls (run_id, seq);
