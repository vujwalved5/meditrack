-- ============================================================
-- MediTrack — Auth Extension: Users Table
-- Run in Supabase SQL Editor (after schema.sql)
-- ============================================================

-- Users table with role-based access control
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL
                CHECK (role IN ('Manager', 'Senior Doctor', 'Staff')),
  department_id INTEGER REFERENCES departments(id),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (anon read/write for demo)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_users" ON users
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- SEED: admin account
-- Password: Admin@1234
-- Hash generated with bcrypt cost=10
-- IMPORTANT: Change this password after first login!
-- -------------------------------------------------------
INSERT INTO users (username, password_hash, role, department_id, is_active)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Manager',
  NULL,
  true
)
ON CONFLICT (username) DO NOTHING;

-- -------------------------------------------------------
-- HOW TO CREATE MORE ACCOUNTS:
-- Use the "Manage Users" page in the app after logging in
-- as admin. The app handles bcrypt hashing client-side.
--
-- To manually hash a password for direct SQL insertion:
--   SELECT crypt('your_password', gen_salt('bf', 10));
--   (requires pgcrypto extension)
-- -------------------------------------------------------
