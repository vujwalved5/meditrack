-- ============================================================
-- MediTrack v2 — Migration Script
-- Run in Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. ADD NEW COLUMNS TO equipment
-- -------------------------------------------------------

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS condition      TEXT    DEFAULT 'Usable',
  ADD COLUMN IF NOT EXISTS held_by        TEXT,
  ADD COLUMN IF NOT EXISTS in_use_since   TIMESTAMP;

-- Add a CHECK constraint on condition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'equipment_condition_check'
      AND conrelid = 'equipment'::regclass
  ) THEN
    ALTER TABLE equipment
      ADD CONSTRAINT equipment_condition_check
        CHECK (condition IN ('Usable', 'Needs Maintenance', 'Out of Order'));
  END IF;
END$$;

-- Back-fill existing rows
UPDATE equipment
  SET condition = 'Usable'
  WHERE condition IS NULL;

-- -------------------------------------------------------
-- 2. ENABLE REALTIME ON audit_log
-- -------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- -------------------------------------------------------
-- 3. VERIFICATION
-- -------------------------------------------------------
SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'equipment'
    AND column_name IN ('condition', 'held_by', 'in_use_since')
  ORDER BY column_name;
