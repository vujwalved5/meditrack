-- MediTrack Migration — Error message logging
-- Run in: Supabase SQL Editor
-- This script is idempotent.
-- ============================================================

ALTER TABLE ai_run_log ADD COLUMN IF NOT EXISTS error_message TEXT;
