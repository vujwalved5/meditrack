-- ============================================================
-- MediTrack v4 Migration — AI Weekly Deep Analysis
-- Run in: Supabase SQL Editor (https://app.supabase.com)
-- Project: qfgvjyhnvmcczhqicend
-- This script is idempotent (IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- -------------------------------------------------------
-- 1. CREATE ai_weekly_reports TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_weekly_reports (
  id            BIGSERIAL PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','partial','failed')),
  requested_by  TEXT NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ NULL,
  finished_at   TIMESTAMPTZ NULL,
  week_start    DATE,
  week_end      DATE,
  steps_total   INT DEFAULT 0,
  steps_done    INT DEFAULT 0,
  current_step  TEXT,
  result        JSONB NOT NULL DEFAULT '{}',
  model         TEXT,
  error         TEXT,
  input_hash    TEXT
);

-- Index on requested_at DESC
CREATE INDEX IF NOT EXISTS ai_weekly_reports_requested_at_idx ON ai_weekly_reports (requested_at DESC);

-- Partial UNIQUE index so only ONE active job can exist
CREATE UNIQUE INDEX IF NOT EXISTS ai_weekly_reports_active_idx 
  ON ai_weekly_reports ((true)) 
  WHERE status IN ('queued','running');

-- -------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- -------------------------------------------------------
ALTER TABLE ai_weekly_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_weekly_reports' AND policyname = 'ai_weekly_select_anon') THEN
    DROP POLICY ai_weekly_select_anon ON ai_weekly_reports;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_weekly_reports' AND policyname = 'ai_weekly_select_authenticated') THEN
    DROP POLICY ai_weekly_select_authenticated ON ai_weekly_reports;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_weekly_reports' AND policyname = 'ai_weekly_insert_anon') THEN
    DROP POLICY ai_weekly_insert_anon ON ai_weekly_reports;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_weekly_reports' AND policyname = 'ai_weekly_insert_authenticated') THEN
    DROP POLICY ai_weekly_insert_authenticated ON ai_weekly_reports;
  END IF;
END;
$$;

CREATE POLICY ai_weekly_select_anon ON ai_weekly_reports FOR SELECT TO anon USING (true);
CREATE POLICY ai_weekly_select_authenticated ON ai_weekly_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY ai_weekly_insert_anon ON ai_weekly_reports FOR INSERT TO anon WITH CHECK (status = 'queued');
CREATE POLICY ai_weekly_insert_authenticated ON ai_weekly_reports FOR INSERT TO authenticated WITH CHECK (status = 'queued');

-- -------------------------------------------------------
-- 3. BEFORE INSERT TRIGGER: GUARD & FORCE FIELDS
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_weekly_guard()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cooldown_mins INT := 30; -- cooldown in minutes between successful or running requests
  v_daily_cap INT := 5;      -- maximum requests per 24 hours
  v_role TEXT;
  v_is_active BOOLEAN;
  v_active_count INT;
  v_last_req TIMESTAMPTZ;
  v_mins_since INT;
  v_daily_count INT;
BEGIN
  -- Force overwrite client-supplied fields
  NEW.status := 'queued';
  NEW.result := '{}';
  NEW.steps_done := 0;
  NEW.steps_total := 0;
  NEW.error := NULL;
  NEW.model := NULL;
  NEW.started_at := NULL;
  NEW.finished_at := NULL;
  NEW.input_hash := NULL;
  NEW.requested_at := NOW();

  -- Rule a: requested_by must be an active Manager
  SELECT role, is_active INTO v_role, v_is_active FROM users WHERE username = NEW.requested_by;
  IF v_role IS NULL OR v_role <> 'Manager' OR v_is_active = FALSE THEN
    RAISE EXCEPTION 'Only active Managers can run the weekly analysis.';
  END IF;

  -- Rule b: another job is queued or running
  SELECT count(*) INTO v_active_count FROM ai_weekly_reports WHERE status IN ('queued', 'running');
  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'A weekly analysis is already in progress.';
  END IF;

  -- Rule c: cooldown
  SELECT requested_at INTO v_last_req FROM ai_weekly_reports ORDER BY requested_at DESC LIMIT 1;
  IF v_last_req IS NOT NULL THEN
    v_mins_since := EXTRACT(EPOCH FROM (NEW.requested_at - v_last_req)) / 60;
    IF v_mins_since < v_cooldown_mins THEN
      RAISE EXCEPTION 'Please wait % minutes before requesting another analysis.', (v_cooldown_mins - v_mins_since);
    END IF;
  END IF;

  -- Rule d: daily cap
  SELECT count(*) INTO v_daily_count FROM ai_weekly_reports WHERE requested_at >= NEW.requested_at - INTERVAL '24 hours';
  IF v_daily_count >= v_daily_cap THEN
    RAISE EXCEPTION 'Daily limit of % weekly analysis runs reached.', v_daily_cap;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_weekly_guard ON ai_weekly_reports;
CREATE TRIGGER trg_ai_weekly_guard
BEFORE INSERT ON ai_weekly_reports
FOR EACH ROW EXECUTE PROCEDURE ai_weekly_guard();


-- -------------------------------------------------------
-- 4. KICK TRIGGER (POST to Edge Function)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_weekly_kick(report_id BIGINT)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url     => 'https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/weekly-insights',
      headers => jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_secret
      ),
      body    => jsonb_build_object('report_id', report_id)
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- swallow exceptions so INSERT doesn't fail
END;
$$;

CREATE OR REPLACE FUNCTION ai_weekly_after_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM ai_weekly_kick(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_weekly_after_insert ON ai_weekly_reports;
CREATE TRIGGER trg_ai_weekly_after_insert
AFTER INSERT ON ai_weekly_reports
FOR EACH ROW EXECUTE PROCEDURE ai_weekly_after_insert();


-- -------------------------------------------------------
-- 5. HOUSEKEEPING
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_weekly_housekeeping()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Mark timed-out running jobs as failed
  UPDATE ai_weekly_reports 
  SET status = 'failed', 
      error = 'Timed out. You can run it again.',
      finished_at = NOW()
  WHERE status = 'running' AND started_at < NOW() - INTERVAL '8 minutes';

  -- 2. Re-kick stuck queued jobs
  FOR r IN SELECT id FROM ai_weekly_reports WHERE status = 'queued' AND requested_at < NOW() - INTERVAL '90 seconds' LOOP
    PERFORM ai_weekly_kick(r.id);
  END LOOP;
END;
$$;

-- Schedule housekeeping
SELECT cron.unschedule('meditrack-weekly-housekeeping') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'meditrack-weekly-housekeeping'
);
SELECT cron.schedule('meditrack-weekly-housekeeping', '*/2 * * * *', 'select ai_weekly_housekeeping()');

-- -------------------------------------------------------
-- 6. REALTIME
-- -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_weekly_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_weekly_reports;
  END IF;
END;
$$;
