-- ============================================================
-- MediTrack v3 Migration — Product Types & Tiles
-- Run in: Supabase SQL Editor (https://app.supabase.com)
-- Project: qfgvjyhnvmcczhqicend
-- ⚠️  IMPORTANT: You MUST run this script in the Supabase SQL Editor
--     before opening the updated index.html. The app will gracefully
--     degrade if the table is missing, but tile counts will not work.
-- This script is idempotent: safe to run more than once.
-- ============================================================


-- -------------------------------------------------------
-- 1. CREATE product_types TABLE (idempotent)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_types (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);


-- -------------------------------------------------------
-- 2. ADD product_type_id COLUMN TO equipment (idempotent)
-- -------------------------------------------------------
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS product_type_id INTEGER REFERENCES product_types(id);


-- -------------------------------------------------------
-- 3. SEED PRODUCT TYPES
--    image_url values match the filenames in images/ folder
-- -------------------------------------------------------
INSERT INTO product_types (name, image_url) VALUES
  ('Ventilator',      'images/ventilator.png'),
  ('Wheelchair',      'images/wheelchair.png'),
  ('Infusion Pump',   'images/infusion-pump.png'),
  ('Defibrillator',   'images/defibrillator.png'),
  ('Portable Monitor','images/portable-monitor.png')
ON CONFLICT (name) DO UPDATE
  SET image_url = EXCLUDED.image_url;


-- -------------------------------------------------------
-- 4. BACK-FILL EXISTING EQUIPMENT ROWS
--    Maps each existing item to its product type by name.
--    Uses a sub-select so it stays idempotent.
-- -------------------------------------------------------

-- Ventilator A and B
UPDATE equipment
SET product_type_id = (SELECT id FROM product_types WHERE name = 'Ventilator')
WHERE name IN ('Ventilator A', 'Ventilator B')
  AND product_type_id IS DISTINCT FROM (SELECT id FROM product_types WHERE name = 'Ventilator');

-- Wheelchair A and B
UPDATE equipment
SET product_type_id = (SELECT id FROM product_types WHERE name = 'Wheelchair')
WHERE name IN ('Wheelchair A', 'Wheelchair B')
  AND product_type_id IS DISTINCT FROM (SELECT id FROM product_types WHERE name = 'Wheelchair');

-- Infusion Pump A and B
UPDATE equipment
SET product_type_id = (SELECT id FROM product_types WHERE name = 'Infusion Pump')
WHERE name IN ('Infusion Pump A', 'Infusion Pump B')
  AND product_type_id IS DISTINCT FROM (SELECT id FROM product_types WHERE name = 'Infusion Pump');

-- Defibrillator
UPDATE equipment
SET product_type_id = (SELECT id FROM product_types WHERE name = 'Defibrillator')
WHERE name = 'Defibrillator'
  AND product_type_id IS DISTINCT FROM (SELECT id FROM product_types WHERE name = 'Defibrillator');

-- Portable Monitor
UPDATE equipment
SET product_type_id = (SELECT id FROM product_types WHERE name = 'Portable Monitor')
WHERE name = 'Portable Monitor'
  AND product_type_id IS DISTINCT FROM (SELECT id FROM product_types WHERE name = 'Portable Monitor');


-- -------------------------------------------------------
-- 5. SUPABASE REALTIME — add product_types to publication
--    Wrapped in DO block to avoid "already member" error
-- -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'product_types'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE product_types;
  END IF;
END;
$$;


-- -------------------------------------------------------
-- 6. ROW LEVEL SECURITY — full anon access (matches schema.sql style)
-- -------------------------------------------------------
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;

-- Drop policy if it already exists before recreating (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'product_types'
      AND policyname = 'allow_all_product_types'
  ) THEN
    DROP POLICY "allow_all_product_types" ON product_types;
  END IF;
END;
$$;

CREATE POLICY "allow_all_product_types" ON product_types
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- -------------------------------------------------------
-- 7. VERIFICATION SELECT
--    Run this to confirm everything looks correct.
-- -------------------------------------------------------
SELECT
  e.id          AS equipment_id,
  e.name        AS equipment_name,
  e.qr_code_id,
  pt.name       AS product_type,
  pt.image_url
FROM equipment e
LEFT JOIN product_types pt ON pt.id = e.product_type_id
ORDER BY e.id;
