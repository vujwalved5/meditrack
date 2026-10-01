-- ============================================================
-- migration_v3b_run_log.sql
-- Creates the ai_run_log table for LLM observability.
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- ============================================================

-- ── Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_run_log (
  id            BIGSERIAL PRIMARY KEY,
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type          TEXT,                -- morning_brief | forgotten_equipment | rebalancing
  provider      TEXT,                -- gemini | anthropic | fallback | none
  model         TEXT,
  attempt       INT,                 -- 1 = first try, 2 = primary retry, 3 = backup
  outcome       TEXT,                -- success | failure
  http_status   INT,                 -- 0 if no HTTP response (network/timeout)
  error_category TEXT,               -- see error_category values below
  latency_ms    INT,
  prompt_chars  INT,
  est_tokens    INT                  -- chars / 4
);

-- Helpful index for the sample queries in README_AI.md
CREATE INDEX IF NOT EXISTS ai_run_log_run_at_idx ON ai_run_log (run_at DESC);
CREATE INDEX IF NOT EXISTS ai_run_log_type_idx   ON ai_run_log (type, run_at DESC);

-- ── Row-Level Security ───────────────────────────────────
-- Enable RLS with NO policies → only the service role (Edge Function) can
-- read or write. The browser/anon role has zero access.
ALTER TABLE ai_run_log ENABLE ROW LEVEL SECURITY;

-- (Intentionally no SELECT/INSERT/UPDATE/DELETE policies.)

-- ── Comments ────────────────────────────────────────────
COMMENT ON TABLE ai_run_log IS
  'Append-only log of every LLM call attempt made by the daily-insights Edge Function. '
  'Service role only. error_category values: timeout | rate_limited | overloaded | '
  'auth_or_config | blocked_or_empty | truncated | bad_json | schema_invalid | network.';

COMMENT ON COLUMN ai_run_log.error_category IS
  'One of: timeout, rate_limited, overloaded, auth_or_config, blocked_or_empty, '
  'truncated, bad_json, schema_invalid, network. NULL when outcome=success.';
