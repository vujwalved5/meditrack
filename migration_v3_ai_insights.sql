-- ============================================================
-- MediTrack v4 Migration — AI Insights Table
-- Run in: Supabase SQL Editor (https://app.supabase.com)
-- Project: qfgvjyhnvmcczhqicend
-- This script is idempotent (IF NOT EXISTS guards throughout).
-- ============================================================

-- -------------------------------------------------------
-- 1. CREATE ai_insights TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_insights (
  id            BIGSERIAL PRIMARY KEY,
  insight_date  DATE        NOT NULL,
  type          TEXT        NOT NULL
                CHECK (type IN ('morning_brief','forgotten_equipment','rebalancing')),
  department_id INTEGER     REFERENCES departments(id) NULL,
  title         TEXT,
  summary       TEXT,
  data          JSONB       NOT NULL DEFAULT '{}',
  model         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 2. INDEX for efficient querying
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS ai_insights_type_date_idx
  ON ai_insights (type, insight_date DESC, created_at DESC);

-- -------------------------------------------------------
-- 3. ROW LEVEL SECURITY — read-only for browser clients
--    The Edge Function uses service-role key (bypasses RLS).
--    NO insert/update/delete policies so the browser can never write.
-- -------------------------------------------------------
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- Guard: drop and recreate policies so the script is re-runnable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_insights' AND policyname = 'ai_insights_select_anon'
  ) THEN
    DROP POLICY ai_insights_select_anon ON ai_insights;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_insights' AND policyname = 'ai_insights_select_authenticated'
  ) THEN
    DROP POLICY ai_insights_select_authenticated ON ai_insights;
  END IF;
END;
$$;

CREATE POLICY ai_insights_select_anon ON ai_insights
  FOR SELECT TO anon USING (true);

CREATE POLICY ai_insights_select_authenticated ON ai_insights
  FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 4. SUPABASE REALTIME — add to publication
-- -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_insights'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;
  END IF;
END;
$$;

-- -------------------------------------------------------
-- 5. VERIFICATION SELECT
-- -------------------------------------------------------
SELECT
  c.column_name,
  c.data_type,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name   = 'ai_insights'
ORDER BY c.ordinal_position;
