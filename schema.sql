-- ============================================================
-- MediTrack Database Schema
-- Supabase (PostgreSQL) — Run in Supabase SQL Editor
-- ============================================================

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
                     CHECK (status IN ('Available', 'In Use'))
);

CREATE TABLE IF NOT EXISTS requests (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES equipment(id),
  requested_by TEXT NOT NULL,
  priority     TEXT DEFAULT 'Normal'
               CHECK (priority IN ('Normal', 'Urgent')),
  status       TEXT DEFAULT 'Pending'
               CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER REFERENCES equipment(id),
  action       TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  timestamp    TIMESTAMP DEFAULT NOW()
);

-- -------------------------------------------------------
-- SEED DATA
-- -------------------------------------------------------

INSERT INTO departments (name) VALUES
  ('ICU'),
  ('General Ward'),
  ('Emergency')
ON CONFLICT DO NOTHING;

INSERT INTO equipment (qr_code_id, name, department_id, status) VALUES
  ('MT-ICU-001', 'Ventilator A',      1, 'Available'),
  ('MT-ICU-002', 'Infusion Pump A',   1, 'Available'),
  ('MT-GW-001',  'Wheelchair A',      2, 'Available'),
  ('MT-GW-002',  'Wheelchair B',      2, 'Available'),
  ('MT-GW-003',  'Infusion Pump B',   2, 'Available'),
  ('MT-EM-001',  'Ventilator B',      3, 'Available'),
  ('MT-EM-002',  'Defibrillator',     3, 'Available'),
  ('MT-EM-003',  'Portable Monitor',  3, 'Available')
ON CONFLICT (qr_code_id) DO NOTHING;

-- -------------------------------------------------------
-- SUPABASE REALTIME
-- -------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE requests;

-- -------------------------------------------------------
-- ROW LEVEL SECURITY (Demo mode — anon full access)
-- -------------------------------------------------------

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_departments" ON departments
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_equipment" ON equipment
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_requests" ON requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_audit_log" ON audit_log
  FOR ALL TO anon USING (true) WITH CHECK (true);
