-- ============================================================
-- migration_v4_room_tracking.sql — Room / Location Tracking
-- Run in: Supabase SQL Editor (https://app.supabase.com)
-- Project: qfgvjyhnvmcczhqicend
--
-- Adds a nullable `room` TEXT column to audit_log.
-- Only populated on 'Checked Out' actions (the "In Use" event).
-- Left NULL for 'Released', 'Condition Changed', and all other
-- action types.
--
-- No RLS change required: the existing policy
--   "allow_all_audit_log" FOR ALL TO anon USING (true) WITH CHECK (true)
-- already covers all columns, including newly added ones.
--
-- No realtime change required: audit_log is already a member of
-- the supabase_realtime publication (added in schema.sql).
--
-- This script is idempotent: safe to run more than once.
-- ============================================================


-- -------------------------------------------------------
-- 1. ADD room COLUMN TO audit_log (idempotent)
-- -------------------------------------------------------
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS room TEXT;


-- -------------------------------------------------------
-- 2. VERIFICATION SELECT
--    Confirm the column exists and existing rows show room = NULL.
-- -------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'audit_log'
ORDER BY ordinal_position;
