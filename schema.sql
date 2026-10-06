-- ============================================================
-- MediTrack Database Schema (Consolidated Master)
-- Supabase (PostgreSQL) — Run in Supabase SQL Editor
-- Includes all tables, v2/v3 features, realtime, auth & RLS
-- ============================================================

-- -------------------------------------------------------
-- EXTENSIONS
-- -------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------
-- TABLES
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment (
  id            SERIAL PRIMARY KEY,
  qr_code_id    TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  status        TEXT DEFAULT 'Available'
                     CHECK (status IN ('Available', 'In Use')),
  condition     TEXT DEFAULT 'Usable'
                     CHECK (condition IN ('Usable', 'Needs Maintenance', 'Out of Order')),
  held_by       TEXT,
  in_use_since  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS requests (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES equipment(id),
  requested_by TEXT NOT NULL,
  priority     TEXT DEFAULT 'Normal'
               CHECK (priority IN ('Normal', 'Urgent')),
  status       TEXT DEFAULT 'Pending'
               CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES equipment(id),
  action       TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  timestamp    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL
                CHECK (role IN ('Manager', 'Senior Doctor', 'Staff')),
  department_id INTEGER REFERENCES departments(id),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- FUNCTIONS & PROCEDURES
-- -------------------------------------------------------

-- Secure RPC login function (verifies password via bcrypt/crypt)
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

-- -------------------------------------------------------
-- SEED DATA
-- -------------------------------------------------------

INSERT INTO departments (name) VALUES
  ('ICU'),
  ('General Ward'),
  ('Emergency')
ON CONFLICT DO NOTHING;

INSERT INTO equipment (qr_code_id, name, department_id, status, condition) VALUES
  ('MT-ICU-001', 'Ventilator A',      1, 'Available', 'Usable'),
  ('MT-ICU-002', 'Infusion Pump A',   1, 'Available', 'Usable'),
  ('MT-GW-001',  'Wheelchair A',      2, 'Available', 'Usable'),
  ('MT-GW-002',  'Wheelchair B',      2, 'Available', 'Usable'),
  ('MT-GW-003',  'Infusion Pump B',   2, 'Available', 'Usable'),
  ('MT-EM-001',  'Ventilator B',      3, 'Available', 'Usable'),
  ('MT-EM-002',  'Defibrillator',     3, 'Available', 'Usable'),
  ('MT-EM-003',  'Portable Monitor',  3, 'Available', 'Usable')
ON CONFLICT (qr_code_id) DO NOTHING;

-- Default Admin Account:
-- Username: admin
-- Password: <SET_YOUR_OWN_PASSWORD> (set a secure password before first use)
INSERT INTO users (username, password_hash, role, department_id, is_active)
VALUES (
  'admin',
  '$2a$10$wT/pS3zB59p5gC4j9rYc3u3D/Hk39GIfqI80YlQj1q8n9/gN6/1S2',
  'Manager',
  NULL,
  true
)
ON CONFLICT (username) DO NOTHING;

-- -------------------------------------------------------
-- SUPABASE REALTIME
-- -------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- -------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_departments" ON departments
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_equipment" ON equipment
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_requests" ON requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_audit_log" ON audit_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_users" ON users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_anon_users" ON users
  FOR ALL TO anon USING (true) WITH CHECK (true);
