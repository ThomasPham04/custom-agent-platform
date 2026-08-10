-- Applied at startup. Alembic earns its place once the schema changes under real
-- data (spec §14).

CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT        NOT NULL,
  icon          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  model         TEXT        NOT NULL,
  system_prompt TEXT        NOT NULL DEFAULT '',
  tool_ids      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT        NOT NULL,
  -- Snapshot of the config this run executed under. Agents are mutable; without
  -- these columns, editing an agent would rewrite the history of past runs.
  agent_name    TEXT        NOT NULL,
  model         TEXT        NOT NULL,
  system_prompt TEXT        NOT NULL DEFAULT '',
  user_message  TEXT        NOT NULL,
  answer        TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL,
  error         TEXT,
  latency_ms    INTEGER     NOT NULL DEFAULT 0,
  session_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS runs_agent_created_idx
  ON runs (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS run_tool_calls (
  id          TEXT PRIMARY KEY,
  run_id      TEXT    NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  tool_id     TEXT    NOT NULL,
  args        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  result      JSONB,
  error       TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS run_tool_calls_run_seq_idx
  ON run_tool_calls (run_id, seq);
