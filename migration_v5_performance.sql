-- ============================================================
-- MediTrack v5 Migration — Performance Indexes & Latest Rooms View
-- Run in: Supabase SQL Editor
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Ensure audit_log.room exists for room-tracking queries.
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS room TEXT;

-- Core indexes used by dashboard, requests, and audit pages.
CREATE INDEX IF NOT EXISTS equipment_department_status_idx
  ON equipment (department_id, status);

CREATE INDEX IF NOT EXISTS requests_status_created_at_idx
  ON requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS requests_equipment_id_idx
  ON requests (equipment_id);

CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx
  ON audit_log (timestamp DESC);

CREATE INDEX IF NOT EXISTS audit_log_equipment_timestamp_idx
  ON audit_log (equipment_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_timestamp_idx
  ON audit_log (action, timestamp DESC);

CREATE INDEX IF NOT EXISTS audit_log_checkout_room_idx
  ON audit_log (equipment_id, timestamp DESC)
  WHERE action = 'Checked Out' AND room IS NOT NULL;

-- DB-side latest room projection (replaces full audit scan in client).
CREATE OR REPLACE VIEW latest_checkout_rooms AS
SELECT DISTINCT ON (equipment_id)
  equipment_id,
  room,
  timestamp
FROM audit_log
WHERE action = 'Checked Out'
  AND room IS NOT NULL
ORDER BY equipment_id, timestamp DESC;
