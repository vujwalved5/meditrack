-- ============================================================
-- MediTrack v4 — Scheduled Cron Job for AI Daily Insights
-- Run AFTER:
--   1. migration_v3_ai_insights.sql
--   2. supabase functions deploy daily-insights --no-verify-jwt
--   3. Creating the vault secret (see step A below)
--
-- Project: qfgvjyhnvmcczhqicend
-- Function URL: https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights
-- Schedule: 00:30 UTC = 06:00 IST (Asia/Kolkata)
-- ============================================================

-- -------------------------------------------------------
-- STEP A: Store your CRON_SECRET in Supabase Vault
-- Replace REPLACE_ME with your actual secret value.
-- Run this line ONCE in the SQL editor with your real secret:
-- -------------------------------------------------------
-- SELECT vault.create_secret('REPLACE_ME', 'cron_secret');


-- -------------------------------------------------------
-- EXTENSION SETUP
-- -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- -------------------------------------------------------
-- REMOVE OLD JOB IF IT EXISTS (safe to re-run)
-- -------------------------------------------------------
SELECT cron.unschedule('meditrack-daily-insights') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'meditrack-daily-insights'
);


-- -------------------------------------------------------
-- SCHEDULE THE DAILY JOB
-- 30 0 * * *  = 00:30 UTC = 06:00 AM IST
--
-- To run at a different IST time, convert to UTC:
--   IST = UTC + 5:30
--   Desired IST 07:00 → UTC 01:30 → cron: 30 1 * * *
--   Desired IST 08:00 → UTC 02:30 → cron: 30 2 * * *
-- -------------------------------------------------------
SELECT cron.schedule(
  'meditrack-daily-insights',           -- job name
  '30 0 * * *',                         -- every day at 00:30 UTC (06:00 IST)
  $$
    SELECT net.http_post(
      url     => 'https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights',
      headers => jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_secret'
          LIMIT 1
        )
      ),
      body    => '{"types":["morning_brief","forgotten_equipment","rebalancing"]}'::jsonb
    );
  $$
);


-- -------------------------------------------------------
-- VERIFICATION: list scheduled jobs
-- -------------------------------------------------------
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'meditrack-daily-insights';


-- -------------------------------------------------------
-- HOW TO VIEW JOB HISTORY
-- (run after the cron fires at least once)
-- -------------------------------------------------------
-- SELECT jobid, runid, status, start_time, end_time, return_message
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'meditrack-daily-insights')
-- ORDER BY start_time DESC
-- LIMIT 20;


-- -------------------------------------------------------
-- HOW TO UNSCHEDULE (if you need to remove the job)
-- -------------------------------------------------------
-- SELECT cron.unschedule('meditrack-daily-insights');


-- -------------------------------------------------------
-- HOW TO TRIGGER MANUALLY (from SQL editor, not cron)
-- -------------------------------------------------------
-- SELECT net.http_post(
--   url     => 'https://qfgvjyhnvmcczhqicend.supabase.co/functions/v1/daily-insights',
--   headers => jsonb_build_object(
--     'Content-Type',  'application/json',
--     'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1)
--   ),
--   body    => '{"dry_run":true}'::jsonb
-- );
