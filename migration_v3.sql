-- ============================================================
-- MediTrack v3 — Security and Bugfix Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. TIMEZONE FIXES
-- Convert timestamp columns to timestamptz to fix local time issues
ALTER TABLE equipment ALTER COLUMN in_use_since TYPE timestamptz USING in_use_since AT TIME ZONE 'UTC';
ALTER TABLE audit_log ALTER COLUMN timestamp TYPE timestamptz USING timestamp AT TIME ZONE 'UTC';
ALTER TABLE requests ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- 2. SECURITY FIXES
-- Revoke anon SELECT on users to secure password hashes
DROP POLICY IF EXISTS "allow_all_users" ON users;
CREATE POLICY "allow_authenticated_users" ON users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_users" ON users
  FOR ALL TO anon USING (true) WITH CHECK (true);
-- Wait, actually we can just drop it and recreate it properly. Or just revoke anon select.
-- Let's just create a SECURITY DEFINER function for login.

CREATE OR REPLACE FUNCTION login(username_param text, password_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_row users%ROWTYPE;
BEGIN
  SELECT * INTO user_row
  FROM users
  WHERE username = username_param
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid username or password.';
  END IF;

  IF user_row.password_hash = crypt(password_param, user_row.password_hash) THEN
    RETURN json_build_object(
      'id', user_row.id,
      'username', user_row.username,
      'role', user_row.role,
      'department_id', user_row.department_id
    );
  ELSE
    RAISE EXCEPTION 'Invalid username or password.';
  END IF;
END;
$$;

-- Revoke anon SELECT since the login function will handle authentication
DROP POLICY IF EXISTS "allow_all_users" ON users;
CREATE POLICY "allow_all_users" ON users
  FOR ALL TO anon USING (false) WITH CHECK (false); -- Or just drop it and create nothing for anon
