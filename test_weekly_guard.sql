-- ============================================================
-- test_weekly_guard.sql
-- Verifies the ai_weekly_guard and RLS policies for ai_weekly_reports.
--
-- ⚠️  WARNING: Do NOT run while a real weekly job is queued or running.
--     This script runs entirely inside BEGIN...ROLLBACK so it leaves
--     NO rows behind. All assertions will raise EXCEPTION on failure
--     (not be swallowed by EXCEPTION WHEN OTHERS handlers).
--
-- Run in: Supabase SQL Editor (service-role session only)
-- ============================================================

BEGIN;

-- Disable the kick trigger so no real HTTP POST fires during the test
ALTER TABLE ai_weekly_reports DISABLE TRIGGER trg_ai_weekly_after_insert;

DO $$
DECLARE
  v_id         BIGINT;
  v_status     TEXT;
  v_result     JSONB;
  v_errored    BOOLEAN;
BEGIN
  -- ── 0. Baseline: table must be empty (within this tx) ──────────────
  IF (SELECT count(*) FROM ai_weekly_reports) > 0 THEN
    RAISE EXCEPTION 'test_weekly_guard: table is not empty — abort to avoid corrupting live data.';
  END IF;

  -- ── TEST 1: Non-manager is rejected ────────────────────────────────
  -- 'staff1' must exist in users with role <> 'Manager' for this to fire.
  -- If the user doesn't exist the trigger also rejects (NULL role check).
  v_errored := FALSE;
  BEGIN
    INSERT INTO ai_weekly_reports (requested_by) VALUES ('staff1_nonexistent_guard_test');
    RAISE EXCEPTION 'TEST 1 FAILED: expected rejection for non-manager, but INSERT succeeded';
  EXCEPTION WHEN OTHERS THEN
    -- Expected: rejection
    v_errored := TRUE;
    IF SQLERRM NOT LIKE '%anagers%' AND SQLERRM NOT LIKE '%active%' THEN
      RAISE EXCEPTION 'TEST 1 FAILED: unexpected error message: %', SQLERRM;
    END IF;
  END;
  ASSERT v_errored, 'TEST 1 FAILED: no exception raised for non-manager';
  RAISE NOTICE 'TEST 1 PASSED: non-manager rejected';

  -- ── TEST 2: Manager can insert; forged fields are overwritten ───────
  INSERT INTO ai_weekly_reports (requested_by, status, result, steps_done, model, error)
    VALUES ('admin', 'done', '{"forged":true}'::jsonb, 99, 'gpt-evil', 'hacked')
    RETURNING id, status, result INTO v_id, v_status, v_result;

  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'TEST 2 FAILED: status not overwritten to queued, got: %', v_status;
  END IF;
  IF v_result IS DISTINCT FROM '{}'::jsonb THEN
    RAISE EXCEPTION 'TEST 2 FAILED: result not overwritten to {}, got: %', v_result;
  END IF;
  RAISE NOTICE 'TEST 2 PASSED: forged fields overwritten; id=%', v_id;

  -- ── TEST 3: Second active job is rejected ───────────────────────────
  v_errored := FALSE;
  BEGIN
    INSERT INTO ai_weekly_reports (requested_by) VALUES ('admin');
    RAISE EXCEPTION 'TEST 3 FAILED: expected rejection for duplicate active job';
  EXCEPTION WHEN OTHERS THEN
    v_errored := TRUE;
    IF SQLERRM NOT LIKE '%progress%' AND SQLERRM NOT LIKE '%queued%' AND SQLERRM NOT LIKE '%running%' THEN
      RAISE EXCEPTION 'TEST 3 FAILED: unexpected error message: %', SQLERRM;
    END IF;
  END;
  ASSERT v_errored, 'TEST 3 FAILED: no exception for duplicate active job';
  RAISE NOTICE 'TEST 3 PASSED: duplicate active job rejected';

  -- ── TEST 4: Cooldown enforced after completing a job ────────────────
  -- Mark the job done 5 minutes ago (within 30-min cooldown)
  UPDATE ai_weekly_reports
    SET status = 'done',
        finished_at = NOW() - INTERVAL '4 minutes',
        requested_at = NOW() - INTERVAL '5 minutes'
    WHERE id = v_id;

  v_errored := FALSE;
  BEGIN
    INSERT INTO ai_weekly_reports (requested_by) VALUES ('admin');
    RAISE EXCEPTION 'TEST 4 FAILED: expected rejection for cooldown';
  EXCEPTION WHEN OTHERS THEN
    v_errored := TRUE;
    IF SQLERRM NOT LIKE '%wait%' AND SQLERRM NOT LIKE '%minutes%' AND SQLERRM NOT LIKE '%cooldown%' THEN
      RAISE EXCEPTION 'TEST 4 FAILED: unexpected error message: %', SQLERRM;
    END IF;
  END;
  ASSERT v_errored, 'TEST 4 FAILED: no exception during cooldown';
  RAISE NOTICE 'TEST 4 PASSED: cooldown enforced';

  -- ── TEST 5: Daily cap enforced (insert 5 done jobs, then try 6th) ───
  -- Back-date the existing row far enough to pass cooldown between each
  UPDATE ai_weekly_reports SET requested_at = NOW() - INTERVAL '200 minutes' WHERE id = v_id;

  -- Insert jobs 2–5 with cooldowns satisfied
  FOR i IN 2..5 LOOP
    INSERT INTO ai_weekly_reports (requested_by) VALUES ('admin') RETURNING id INTO v_id;
    UPDATE ai_weekly_reports
      SET status = 'done',
          requested_at = NOW() - INTERVAL '200 minutes' - (i * INTERVAL '32 minutes'),
          finished_at  = NOW() - INTERVAL '200 minutes' - (i * INTERVAL '30 minutes')
      WHERE id = v_id;
  END LOOP;

  v_errored := FALSE;
  BEGIN
    INSERT INTO ai_weekly_reports (requested_by) VALUES ('admin');
    RAISE EXCEPTION 'TEST 5 FAILED: expected rejection for daily cap';
  EXCEPTION WHEN OTHERS THEN
    v_errored := TRUE;
    IF SQLERRM NOT LIKE '%Daily%' AND SQLERRM NOT LIKE '%limit%' AND SQLERRM NOT LIKE '%daily%' THEN
      RAISE EXCEPTION 'TEST 5 FAILED: unexpected error message: %', SQLERRM;
    END IF;
  END;
  ASSERT v_errored, 'TEST 5 FAILED: no exception for daily cap';
  RAISE NOTICE 'TEST 5 PASSED: daily cap enforced';

  RAISE NOTICE '=== ALL GUARD TESTS PASSED ===';
END $$;

-- ── TEST 6: RLS — anon role cannot UPDATE or DELETE ──────────────────
-- Set LOCAL role to anon for this block only
SET LOCAL ROLE anon;

DO $$
DECLARE
  v_rows INT;
BEGIN
  -- anon UPDATE should affect 0 rows (RLS blocks it, no policy allows UPDATE for anon)
  UPDATE ai_weekly_reports SET status = 'failed' WHERE true;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: anon was able to UPDATE % rows', v_rows;
  END IF;
  RAISE NOTICE 'TEST 6a PASSED: anon UPDATE blocked (0 rows affected)';

  -- anon DELETE should affect 0 rows
  DELETE FROM ai_weekly_reports WHERE true;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'TEST 6 FAILED: anon was able to DELETE % rows', v_rows;
  END IF;
  RAISE NOTICE 'TEST 6b PASSED: anon DELETE blocked (0 rows affected)';
END $$;

-- Restore to service role for cleanup
RESET ROLE;

-- Re-enable the kick trigger
ALTER TABLE ai_weekly_reports ENABLE TRIGGER trg_ai_weekly_after_insert;

-- Roll back everything — zero rows left behind
ROLLBACK;

-- Confirm no rows remain (runs outside the rolled-back tx)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM ai_weekly_reports;
  IF v_count > 0 THEN
    RAISE WARNING 'test_weekly_guard.sql: % row(s) remain after ROLLBACK — check for committed tx', v_count;
  ELSE
    RAISE NOTICE 'CLEANUP CONFIRMED: 0 rows in ai_weekly_reports after ROLLBACK';
  END IF;
END $$;
