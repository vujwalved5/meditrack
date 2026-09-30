-- ============================================================
-- seed_demo_history.sql — Demo data for testing AI Daily Insights
-- ⚠️  WARNING: This script changes the REAL state of:
--     • Wheelchair B  (sets to In Use, held by demo.ravi, 19h ago)
--     • Portable Monitor (sets condition to Needs Maintenance)
-- Run the CLEANUP block (bottom of this file) to revert those changes.
-- All demo data is tagged with usernames starting with 'demo.'
-- ============================================================

-- Use a fixed seed for reproducibility
SELECT setseed(0.42);

-- -------------------------------------------------------
-- PART 1: DEMO USERS (inactive, password disabled)
-- -------------------------------------------------------
INSERT INTO users (username, password_hash, role, department_id, is_active)
VALUES
  ('demo.nurse.icu',  '!disabled', 'Staff', 1, false),
  ('demo.nurse.gw',   '!disabled', 'Staff', 2, false),
  ('demo.ravi',       '!disabled', 'Staff', 2, false),
  ('demo.anita',      '!disabled', 'Staff', 1, false)
ON CONFLICT (username) DO UPDATE
  SET password_hash = '!disabled', is_active = false;


-- -------------------------------------------------------
-- PART 2: 14-DAY AUDIT HISTORY
-- Timestamps are naive UTC: (now() AT TIME ZONE 'UTC') - interval ...
-- -------------------------------------------------------

-- Helper: get equipment IDs
DO $$
DECLARE
  v_wheelchair_a   INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-GW-001');
  v_wheelchair_b   INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-GW-002');
  v_infusion_a     INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-ICU-002');
  v_infusion_b     INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-GW-003');
  v_ventilator_a   INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-ICU-001');
  v_ventilator_b   INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-EM-001');
  v_defibrillator  INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-EM-002');
  v_portable_mon   INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-EM-003');
  v_day            INTEGER;
  v_hour           INTEGER;
  v_dur_min        INTEGER;
  v_start          TIMESTAMPTZ;
  v_end            TIMESTAMPTZ;
BEGIN

  -- ── WHEELCHAIRS: 20-60 min sessions, multiple per day ──
  FOR v_day IN 0..13 LOOP
    -- Wheelchair A: 3-6 sessions per day
    FOR v_hour IN 1..4 LOOP
      v_dur_min := 20 + (random() * 40)::INTEGER;
      v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => v_hour * 5);
      v_end     := v_start + make_interval(mins => v_dur_min);
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_wheelchair_a, 'Checked Out', 'demo.nurse.gw', v_start);
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_wheelchair_a, 'Released', 'demo.nurse.gw', v_end);
    END LOOP;

    -- Wheelchair B: 2-4 sessions per day (except today — it's currently In Use)
    IF v_day > 0 THEN
      FOR v_hour IN 1..3 LOOP
        v_dur_min := 20 + (random() * 40)::INTEGER;
        v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => v_hour * 6);
        v_end     := v_start + make_interval(mins => v_dur_min);
        INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
        VALUES (v_wheelchair_b, 'Checked Out', 'demo.ravi', v_start);
        INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
        VALUES (v_wheelchair_b, 'Released', 'demo.ravi', v_end);
      END LOOP;
    END IF;
  END LOOP;

  -- ── DEFIBRILLATOR: 10-30 min sessions ──
  FOR v_day IN 0..13 LOOP
    v_dur_min := 10 + (random() * 20)::INTEGER;
    v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => 8);
    v_end     := v_start + make_interval(mins => v_dur_min);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_defibrillator, 'Checked Out', 'demo.anita', v_start);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_defibrillator, 'Released', 'demo.anita', v_end);
  END LOOP;

  -- ── PORTABLE MONITOR: 1-4 hour sessions ──
  FOR v_day IN 0..13 LOOP
    v_dur_min := 60 + (random() * 180)::INTEGER;
    v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => 10);
    v_end     := v_start + make_interval(mins => v_dur_min);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_portable_mon, 'Checked Out', 'demo.nurse.icu', v_start);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_portable_mon, 'Released', 'demo.nurse.icu', v_end);
  END LOOP;

  -- ── VENTILATORS: 6-20 hour sessions ──
  FOR v_day IN 0..13 LOOP
    v_dur_min := 360 + (random() * 840)::INTEGER;
    v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => 2);
    v_end     := v_start + make_interval(mins => v_dur_min);

    -- Ventilator A (ICU)
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_ventilator_a, 'Checked Out', 'demo.nurse.icu', v_start);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_ventilator_a, 'Released', 'demo.nurse.icu', v_end);

    -- Ventilator B (Emergency)
    v_dur_min := 360 + (random() * 840)::INTEGER;
    v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => 4);
    v_end     := v_start + make_interval(mins => v_dur_min);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_ventilator_b, 'Checked Out', 'demo.anita', v_start);
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_ventilator_b, 'Released', 'demo.anita', v_end);
  END LOOP;

  -- ── INFUSION PUMP A (ICU): heavy use, ~70-85% utilization, 2-6h sessions ──
  FOR v_day IN 0..13 LOOP
    -- 3-4 sessions per day to achieve high utilization
    FOR v_hour IN 0..2 LOOP
      v_dur_min := 120 + (random() * 240)::INTEGER;  -- 2-6 hours
      v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => v_hour * 7 + 1);
      v_end     := v_start + make_interval(mins => v_dur_min);
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_infusion_a, 'Checked Out', 'demo.nurse.icu', v_start);
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_infusion_a, 'Released', 'demo.nurse.icu', v_end);
    END LOOP;
  END LOOP;

  -- ── INFUSION PUMP B (General Ward): very light use, under 10h total in last 7 days ──
  -- Only 2-3 sessions in the last 7 days, each short
  FOR v_day IN 3..8 LOOP
    IF random() > 0.5 THEN
      v_dur_min := 30 + (random() * 60)::INTEGER;  -- 30-90 min sessions
      v_start   := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => 9);
      v_end     := v_start + make_interval(mins => v_dur_min);
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_infusion_b, 'Checked Out', 'demo.nurse.gw', v_start);
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_infusion_b, 'Released', 'demo.nurse.gw', v_end);
    END IF;
  END LOOP;

END;
$$;


-- -------------------------------------------------------
-- PART 3: REQUESTS — Infusion Pump A, by demo.nurse.icu
-- Mixed statuses, couple still Pending
-- -------------------------------------------------------
DO $$
DECLARE
  v_infusion_a INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-ICU-002');
  v_req_id     INTEGER;
  v_req_time   TIMESTAMPTZ;
  v_statuses   TEXT[] := ARRAY['Pending','Pending','Approved','Approved','Rejected','Pending','Approved','Rejected','Pending','Approved'];
  v_priorities TEXT[] := ARRAY['Urgent','Normal','Normal','Urgent','Normal','Urgent','Normal','Normal','Urgent','Normal'];
  v_day        INTEGER;
BEGIN
  FOR v_day IN 0..9 LOOP
    v_req_time := (now() AT TIME ZONE 'UTC') - make_interval(days => v_day, hours => 5);

    INSERT INTO requests (equipment_id, requested_by, priority, status, created_at)
    VALUES (
      v_infusion_a,
      'demo.nurse.icu',
      v_priorities[v_day + 1],
      v_statuses[v_day + 1],
      v_req_time
    )
    RETURNING id INTO v_req_id;

    -- Matching audit_log 'Request Submitted' entry
    INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
    VALUES (v_infusion_a, 'Request Submitted', 'demo.nurse.icu', v_req_time);

    -- Approved → add 'Request Approved' entry
    IF v_statuses[v_day + 1] = 'Approved' THEN
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_infusion_a, 'Request Approved', 'admin', v_req_time + interval '1 hour');
    END IF;

    -- Rejected → add 'Request Rejected' entry
    IF v_statuses[v_day + 1] = 'Rejected' THEN
      INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
      VALUES (v_infusion_a, 'Request Rejected', 'admin', v_req_time + interval '1 hour');
    END IF;
  END LOOP;
END;
$$;


-- -------------------------------------------------------
-- PART 4: WHEELCHAIR B — currently In Use, 19 hours ago
-- This should trigger a CRITICAL forgotten-equipment alert
-- (typical wheelchair duration ~30 min → 6× = 3h; 19h >> threshold)
-- -------------------------------------------------------
DO $$
DECLARE
  v_wheelchair_b INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-GW-002');
  v_since        TIMESTAMPTZ := (now() AT TIME ZONE 'UTC') - interval '19 hours';
BEGIN
  -- Update equipment to In Use
  UPDATE equipment
  SET status       = 'In Use',
      held_by      = 'demo.ravi',
      in_use_since = v_since
  WHERE qr_code_id = 'MT-GW-002';

  -- Insert matching Checked Out audit entry
  INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
  VALUES (v_wheelchair_b, 'Checked Out', 'demo.ravi', v_since);
END;
$$;


-- -------------------------------------------------------
-- PART 5: PORTABLE MONITOR — Needs Maintenance
-- -------------------------------------------------------
DO $$
DECLARE
  v_portable_mon INTEGER := (SELECT id FROM equipment WHERE qr_code_id = 'MT-EM-003');
BEGIN
  UPDATE equipment
  SET condition = 'Needs Maintenance'
  WHERE qr_code_id = 'MT-EM-003';

  INSERT INTO audit_log (equipment_id, action, performed_by, timestamp)
  VALUES (v_portable_mon, 'Condition Changed', 'admin',
    (now() AT TIME ZONE 'UTC') - interval '2 hours');
END;
$$;


-- -------------------------------------------------------
-- VERIFICATION
-- -------------------------------------------------------
SELECT
  e.name,
  e.qr_code_id,
  e.status,
  e.condition,
  e.held_by,
  e.in_use_since,
  d.name AS department
FROM equipment e
LEFT JOIN departments d ON d.id = e.department_id
ORDER BY e.id;

SELECT 'audit_log count for demo users' AS label,
  count(*) FROM audit_log WHERE performed_by LIKE 'demo.%';

SELECT 'requests count for demo users' AS label,
  count(*) FROM requests WHERE requested_by LIKE 'demo.%';


-- -------------------------------------------------------
-- ⚠️  CLEANUP BLOCK (commented out)
-- Uncomment and run to remove ALL demo data and revert equipment
-- -------------------------------------------------------
/*
-- Remove demo audit_log entries
DELETE FROM audit_log WHERE performed_by LIKE 'demo.%';

-- Remove demo requests
DELETE FROM requests WHERE requested_by LIKE 'demo.%';

-- Remove demo users
DELETE FROM users WHERE username LIKE 'demo.%';

-- Revert Wheelchair B to Available
UPDATE equipment
SET status = 'Available', held_by = NULL, in_use_since = NULL
WHERE qr_code_id = 'MT-GW-002';

-- Revert Portable Monitor to Usable
UPDATE equipment
SET condition = 'Usable'
WHERE qr_code_id = 'MT-EM-003';

-- Remove any AI insights rows (optional)
-- DELETE FROM ai_insights;
*/
